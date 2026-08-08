/**
 * 폭격 비행선 — 난투 중 주기적으로 방을 가로지르며 폭탄 하나를 떨어뜨린다.
 *
 * 폭탄은 지면(바닥·가구·물건)에 닿는 순간 즉시 터지고, 폭발 반경 안의 캐릭터는
 * 들고 있던 물건을 놓치며 바깥으로 밀려난다. 주변 물건들도 함께 날아간다.
 * 낙하 중에는 착탄 지점에 경고 링이 깜빡이므로 피할 수 있다.
 */

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { World3D } from './world';
import type { PropManager } from './objects';
import type { Player } from './player';
import { sfx } from './sound';
import { ROOM_W, ROOM_D } from './world';

const BOMB_R = 0.22;
const BOMB_GRAVITY = 16; // 실제 중력보다 조금 느리게 — 경고 링을 보고 피할 여유
const BLAST_RADIUS = 3.4; // 이 안의 캐릭터는 들고 있던 물건을 놓친다
const BLAST_LIFE = 0.7; // 폭발 연출 시간 (초)

interface FallingBomb {
  mesh: THREE.Group;
  /** 착탄 지점 경고 링 */
  marker: THREE.Mesh;
  vy: number;
  t: number;
}

interface Blast {
  ring: THREE.Mesh;
  flash: THREE.Mesh;
  t: number;
}

function buildBombVisual(): THREE.Group {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(BOMB_R, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x2b303a, roughness: 0.5, metalness: 0.3 }),
  );
  shell.castShadow = true;
  g.add(shell);
  const fuse = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.12, 8),
    new THREE.MeshStandardMaterial({ color: 0x6a6f7a, roughness: 0.8 }),
  );
  fuse.position.y = BOMB_R + 0.04;
  g.add(fuse);
  const spark = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffb14a }),
  );
  spark.position.y = BOMB_R + 0.13;
  g.add(spark);
  return g;
}

export class AirshipSystem {
  private airship: THREE.Group | null = null;
  private airshipT = 0;
  private dropped = false;
  private dropTimer = 0;
  private dir = 1;
  private bomb: FallingBomb | null = null;
  private blasts: Blast[] = [];
  /** 사용자에게 이벤트 알림용 (game이 주입) */
  onPulse: (text: string) => void = () => {};

  constructor(private world: World3D, private props: PropManager) {}

  /** 라운드 난투 시작 */
  start() {
    this.reset();
    this.dropTimer = 6 + Math.random() * 3; // 첫 비행선까지
  }

  end() {
    this.reset();
  }

  private reset() {
    if (this.airship) {
      this.world.scene.remove(this.airship);
      this.airship = null;
    }
    this.dropped = false;
    this.removeBomb();
    for (const b of this.blasts) {
      this.world.scene.remove(b.ring);
      this.world.scene.remove(b.flash);
    }
    this.blasts = [];
  }

  private spawnAirship() {
    const ship = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xe0663c, roughness: 0.6 });
    const balloon = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 12), mat);
    balloon.scale.set(1.5, 0.9, 0.9);
    balloon.castShadow = true;
    ship.add(balloon);
    const basket = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.3, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x8a5a2c, roughness: 0.8 }),
    );
    basket.position.y = -0.75;
    ship.add(basket);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.6, 4), mat);
    fin.rotation.z = Math.PI / 2;
    fin.position.x = -1.4 * this.dir;
    ship.add(fin);
    ship.position.set(-this.dir * (ROOM_W / 2 + 2), 4.2, -ROOM_D / 2 + 1 + Math.random() * (ROOM_D - 2));
    this.world.scene.add(ship);
    this.airship = ship;
    this.airshipT = 0;
  }

  /** 난투 중 매 틱 */
  tick(dt: number, players: Player[]) {
    // ── 비행선 등장·이동·투하 ──
    if (!this.airship) {
      this.dropTimer -= dt;
      if (this.dropTimer <= 0) {
        this.dir = Math.random() < 0.5 ? 1 : -1;
        this.spawnAirship();
        this.onPulse('폭격 비행선 등장!');
      }
    } else {
      this.airshipT += dt;
      const span = ROOM_W + 4;
      this.airship.position.x += this.dir * (span / 5) * dt; // ~5초에 횡단
      this.airship.position.y = 4.2 + Math.sin(this.airshipT * 2) * 0.15;
      // 중앙 부근에서 1회 투하
      if (this.airshipT > 2.3 && !this.dropped) {
        this.dropped = true;
        this.dropBomb(this.airship.position.x, this.airship.position.z);
      }
      if (Math.abs(this.airship.position.x) > ROOM_W / 2 + 2) {
        this.world.scene.remove(this.airship);
        this.airship = null;
        this.dropped = false;
        this.dropTimer = 9 + Math.random() * 5; // 다음 비행선까지
      }
    }

    this.updateBomb(dt, players);
    this.updateBlasts(dt);
  }

  // ── 폭탄 낙하 ──────────────────────────────────────
  private dropBomb(x: number, z: number) {
    // 앞선 폭탄이 아직 떨어지는 중이면 그대로 둔다 (동시에 하나만)
    if (this.bomb) return;
    const mesh = buildBombVisual();
    mesh.position.set(x, 3.4, z);
    this.world.scene.add(mesh);
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1.2, 32),
      new THREE.MeshBasicMaterial({
        color: 0xff5a4a, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(x, 0.06, z);
    this.world.scene.add(marker);
    this.bomb = { mesh, marker, vy: -1.5, t: 0 };
    sfx.whistle();
    this.onPulse('폭탄 투하!');
  }

  private removeBomb() {
    if (!this.bomb) return;
    this.world.scene.remove(this.bomb.mesh);
    this.world.scene.remove(this.bomb.marker);
    this.bomb = null;
  }

  private updateBomb(dt: number, players: Player[]) {
    const bomb = this.bomb;
    if (!bomb) return;
    bomb.t += dt;
    bomb.vy -= BOMB_GRAVITY * dt;
    const pos = bomb.mesh.position;
    const step = -bomb.vy * dt; // 이번 틱 낙하 거리
    // 낙하 경로 아래에 바닥·가구·물건이 있으면 그 지점에서 즉시 폭발
    const ray = new RAPIER.Ray({ x: pos.x, y: pos.y, z: pos.z }, { x: 0, y: -1, z: 0 });
    const hit = this.world.physics.castRay(ray, step + BOMB_R, true);
    if (hit) {
      this.explode(pos.x, pos.y - Math.max(0, hit.timeOfImpact - BOMB_R), pos.z, players);
      return;
    }
    pos.y -= step;
    bomb.mesh.rotation.y += dt * 3;
    // 경고 링 — 착탄이 가까워질수록 빠르게 점멸
    const blink = 6 + bomb.t * 14;
    const mat = bomb.marker.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.35 + 0.35 * Math.abs(Math.sin(bomb.t * blink));
    const s = 1 + 0.1 * Math.sin(bomb.t * blink);
    bomb.marker.scale.set(s, s, 1);
  }

  // ── 폭발: 반경 안 캐릭터는 물건을 놓치고 밀려난다 ──
  private explode(x: number, y: number, z: number, players: Player[]) {
    this.removeBomb();
    const cy = Math.max(0.12, y);
    this.spawnBlast(x, cy, z);
    sfx.explode();

    let dropped = 0;
    for (const p of players) {
      const pos = p.position;
      const d = Math.hypot(pos.x - x, pos.z - z);
      if (d > BLAST_RADIUS) continue;
      if (p.held) {
        p.release(); // 들고 있던 물건을 놓친다
        dropped++;
      }
      const m = p.body.mass();
      const f = 1 - d / BLAST_RADIUS;
      const ang = d > 0.01 ? Math.atan2(pos.z - z, pos.x - x) : Math.random() * Math.PI * 2;
      p.body.applyImpulse(
        { x: Math.cos(ang) * m * f * 5, y: m * (1.5 + f * 3.5), z: Math.sin(ang) * m * f * 5 },
        true,
      );
    }
    // 주변 물건들도 함께 날아간다 (방금 놓친 물건 포함)
    for (const prop of this.props.props) {
      const pos = prop.position;
      const d = Math.hypot(pos.x - x, pos.z - z);
      if (d > BLAST_RADIUS) continue;
      const m = prop.body.mass();
      const f = 1 - d / BLAST_RADIUS;
      const ang = d > 0.01 ? Math.atan2(pos.z - z, pos.x - x) : Math.random() * Math.PI * 2;
      prop.body.applyImpulse(
        { x: Math.cos(ang) * m * f * 4, y: m * (1 + f * 3), z: Math.sin(ang) * m * f * 4 },
        true,
      );
    }
    this.onPulse(dropped > 0 ? `쾅! ${dropped}명이 물건을 놓쳤다` : '쾅! 폭탄 작렬');
  }

  private spawnBlast(x: number, y: number, z: number) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.7, 32),
      new THREE.MeshBasicMaterial({
        color: 0xffb14a, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, y + 0.05, z);
    this.world.scene.add(ring);
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 16, 12),
      new THREE.MeshBasicMaterial({
        color: 0xfff0c0, transparent: true, opacity: 0.9, depthWrite: false,
      }),
    );
    flash.position.set(x, y + 0.35, z);
    this.world.scene.add(flash);
    this.blasts.push({ ring, flash, t: 0 });
  }

  private updateBlasts(dt: number) {
    for (const b of this.blasts) {
      b.t += dt;
      const prog = Math.min(1, b.t / BLAST_LIFE);
      // 충격파 링 — 폭발 반경까지 빠르게 퍼지며 사라진다
      const r = BLAST_RADIUS * Math.min(1, prog * 1.6);
      b.ring.scale.set(r / 0.6, r / 0.6, 1);
      (b.ring.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - prog);
      // 섬광 — 부풀었다 급히 사그라든다
      const fs = 1 + prog * 2.2;
      b.flash.scale.set(fs, fs, fs);
      (b.flash.material as THREE.MeshBasicMaterial).opacity = 0.9 * Math.max(0, 1 - prog * 2.4);
    }
    this.blasts = this.blasts.filter((b) => {
      if (b.t < BLAST_LIFE) return true;
      this.world.scene.remove(b.ring);
      this.world.scene.remove(b.flash);
      return false;
    });
  }
}
