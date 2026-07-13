/**
 * 장비 아이템 + 비행선 배달 (크레이지 아케이드식).
 *
 * 점수용 프롭과 달리 '효과'를 발동한다. 비행선이 난투 중 주기적으로 방을 가로지르며
 * 장비 하나를 떨어뜨린다.
 *  - 돌풍폭탄(windbomb): 잡는 순간 소비 — 3초간 습득자 주위에 방사형 바람이 일어
 *    주변 인물·아이템을 밀쳐낸다. 습득자도 붕 떠서 자기 페이스가 무너진다(자해).
 *  - 스카우터(scouter): 들고 있는 동안 방의 모든 프롭 위에 실제 이름표가 뜬다
 *    (미스터리/추상화 모드 카운터).
 *  - 레이저 안경(laser): 들고 있는 동안 바라보는 정면으로 레이저 빔이 나가,
 *    빔에 닿은 인물·아이템을 빔 방향으로 밀쳐낸다.
 */

import * as THREE from 'three';
import type { World3D } from './world';
import type { PropManager, Prop } from './objects';
import type { Player } from './player';
import type { PropMeta } from './catalog';
import { makeLabelSprite } from './visuals';
import { sfx } from './sound';
import { ROOM_W, ROOM_D } from './world';

const DARK = 0x2f2f38;

export const EQUIP_CATALOG: Record<string, PropMeta> = {
  windbomb: {
    id: 'windbomb', name: '돌풍폭탄', tags: ['장비', '위험함', '유머'],
    shape: 'ball', size: [0.22, 0.22, 0.22], color: 0x3a3f4a, density: 0.6, equip: 'windbomb',
    parts: [
      { shape: 'ball', size: [0.2, 0.2, 0.2], pos: [0, 0, 0], color: 0x2b303a },
      { shape: 'cylinder', size: [0.03, 0.06, 0.03], pos: [0, 0.2, 0], color: 0x6a6f7a },
      { shape: 'ball', size: [0.035, 0.035, 0.035], pos: [0, 0.29, 0], color: 0xffb14a },
    ],
  },
  scouter: {
    id: 'scouter', name: '스카우터', tags: ['장비', '전자기기', '멋짐'],
    shape: 'box', size: [0.34, 0.14, 0.1], color: 0x2f6f4f, density: 0.3, equip: 'scouter',
    parts: [
      { shape: 'box', size: [0.3, 0.1, 0.05], pos: [0, 0, 0], color: 0x30363f },
      { shape: 'box', size: [0.16, 0.12, 0.03], pos: [0.12, 0, 0.03], color: 0x4fe0a0 },
      { shape: 'cylinder', size: [0.02, 0.12, 0.02], pos: [-0.17, 0, 0], rot: [0, 0, 1.5708], color: 0x30363f },
    ],
  },
  laser: {
    id: 'laser', name: '레이저 안경', tags: ['장비', '무기', '위험함', '멋짐'],
    shape: 'box', size: [0.36, 0.12, 0.08], color: 0xd93a3a, density: 0.3, equip: 'laser',
    parts: [
      { shape: 'box', size: [0.14, 0.1, 0.06], pos: [-0.1, 0, 0], color: 0xd93a3a },
      { shape: 'box', size: [0.14, 0.1, 0.06], pos: [0.1, 0, 0], color: 0xd93a3a },
      { shape: 'box', size: [0.06, 0.02, 0.04], pos: [0, 0, 0], color: DARK },
    ],
  },
};

const EQUIP_IDS = Object.keys(EQUIP_CATALOG);

interface WindBurst {
  x: number; z: number;
  t: number;
  ring: THREE.Mesh;
}

const BURST_LIFE = 3; // 초
const BURST_RADIUS = 3.4;

export class EquipmentSystem {
  private airship: THREE.Group | null = null;
  private airshipT = 0;
  private dropTimer = 0;
  private dir = 1;
  private bursts: WindBurst[] = [];
  /** 스카우터 이름표가 붙은 프롭 */
  private labeled = new Set<Prop>();
  /** 레이저 빔 메시 (플레이어별) */
  private beams = new Map<number, THREE.Mesh>();
  /** 사용자에게 이벤트 알림용 (game이 주입) */
  onPulse: (text: string) => void = () => {};

  constructor(private world: World3D, private props: PropManager) {}

  /** 라운드 난투 시작 */
  start() {
    this.reset();
    this.dropTimer = 6 + Math.random() * 3; // 첫 투하까지
  }

  private reset() {
    if (this.airship) {
      this.world.scene.remove(this.airship);
      this.airship = null;
    }
    for (const b of this.bursts) this.world.scene.remove(b.ring);
    this.bursts = [];
    for (const beam of this.beams.values()) this.world.scene.remove(beam);
    this.beams.clear();
    this.clearLabels();
  }

  end() {
    this.reset();
  }

  private clearLabels() {
    for (const prop of this.labeled) {
      if (prop.label) {
        this.world.scene.remove(prop.label);
        prop.label = null;
      }
    }
    this.labeled.clear();
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
        this.onPulse('보급 비행선 등장!');
      }
    } else {
      this.airshipT += dt;
      const span = ROOM_W + 4;
      this.airship.position.x += this.dir * (span / 5) * dt; // ~5초에 횡단
      this.airship.position.y = 4.2 + Math.sin(this.airshipT * 2) * 0.15;
      // 중앙 부근에서 1회 투하
      if (this.airshipT > 2.3 && !this.dropped) {
        this.dropped = true;
        this.dropEquip(this.airship.position.x, this.airship.position.z);
      }
      if (Math.abs(this.airship.position.x) > ROOM_W / 2 + 2) {
        this.world.scene.remove(this.airship);
        this.airship = null;
        this.dropped = false;
        this.dropTimer = 9 + Math.random() * 5; // 다음 비행선까지
      }
    }

    // ── 장비 효과 ──
    this.updateScouter(players);
    this.updateLaser(dt, players);
    this.updateWindbomb(players);
    this.updateBursts(dt, players);
  }

  private dropped = false;

  private dropEquip(x: number, z: number) {
    const id = EQUIP_IDS[Math.floor(Math.random() * EQUIP_IDS.length)];
    const meta = EQUIP_CATALOG[id];
    const prop = this.props.spawnDrop(meta, new THREE.Vector3(x, 3.6, z));
    // 낙하 연출 — 낙하산 대신 천천히
    prop.body.setLinvel({ x: 0, y: -1.5, z: 0 }, true);
    sfx.reveal(90);
  }

  // ── 돌풍폭탄: 잡는 순간 소비 ──
  private updateWindbomb(players: Player[]) {
    for (const p of players) {
      if (p.held?.meta.equip === 'windbomb') {
        const pos = p.position;
        const prop = p.held;
        p.release();
        this.props.despawn(prop);
        this.spawnBurst(pos.x, pos.z);
        // 자해 — 습득자도 붕 뜬다
        const m = p.body.mass();
        const ang = Math.random() * Math.PI * 2;
        p.body.applyImpulse({ x: Math.cos(ang) * m * 3, y: m * 5, z: Math.sin(ang) * m * 3 }, true);
        sfx.bonk();
        this.onPulse('돌풍폭탄 작렬!');
      }
    }
  }

  private spawnBurst(x: number, z: number) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.7, 32),
      new THREE.MeshBasicMaterial({ color: 0x8ad0ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.1, z);
    this.world.scene.add(ring);
    this.bursts.push({ x, z, t: 0, ring });
  }

  private updateBursts(dt: number, players: Player[]) {
    for (const burst of this.bursts) {
      burst.t += dt;
      const prog = burst.t / BURST_LIFE;
      const r = BURST_RADIUS * Math.min(1, prog * 1.4);
      burst.ring.scale.set(r / 0.6, r / 0.6, 1);
      (burst.ring.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - prog);
      // 방사형 밀침 — 반경 안의 인물·프롭
      const push = (bodyPos: THREE.Vector3, applyImpulse: (v: { x: number; y: number; z: number }) => void, mass: number) => {
        const dx = bodyPos.x - burst.x;
        const dz = bodyPos.z - burst.z;
        const d = Math.hypot(dx, dz);
        if (d < r && d > 0.01) {
          const f = (1 - d / r) * mass * 0.6;
          applyImpulse({ x: (dx / d) * f, y: mass * 0.08, z: (dz / d) * f });
        }
      };
      for (const p of players) {
        push(p.position, (v) => p.body.applyImpulse(v, true), p.body.mass());
      }
      for (const prop of this.props.props) {
        push(prop.position, (v) => prop.body.applyImpulse(v, true), prop.body.mass());
      }
    }
    this.bursts = this.bursts.filter((b) => {
      if (b.t >= BURST_LIFE) {
        this.world.scene.remove(b.ring);
        return false;
      }
      return true;
    });
  }

  // ── 스카우터: 들고 있는 동안 모든 프롭 이름표 노출 ──
  private updateScouter(players: Player[]) {
    const active = players.some((p) => p.held?.meta.equip === 'scouter');
    if (!active) {
      if (this.labeled.size > 0) this.clearLabels();
      return;
    }
    for (const prop of this.props.props) {
      if (prop.meta.equip || prop.meta.armOwner !== undefined) continue;
      if (!prop.label) {
        prop.label = makeLabelSprite(prop.meta.name);
        this.world.scene.add(prop.label);
        this.labeled.add(prop);
      }
    }
  }

  // ── 레이저 안경: 정면 빔이 닿은 대상 밀침 ──
  private updateLaser(dt: number, players: Player[]) {
    const holders = new Set<number>();
    for (const p of players) {
      if (p.held?.meta.equip !== 'laser') continue;
      holders.add(p.id);
      const origin = p.position;
      const dir = p.facing;
      const LEN = 5.5;
      // 빔 비주얼
      let beam = this.beams.get(p.id);
      if (!beam) {
        beam = new THREE.Mesh(
          new THREE.BoxGeometry(1, 0.09, 0.09),
          new THREE.MeshBasicMaterial({ color: 0xff4a4a, transparent: true, opacity: 0.75 }),
        );
        this.world.scene.add(beam);
        this.beams.set(p.id, beam);
      }
      const mid = origin.clone().add(dir.clone().multiplyScalar(LEN / 2 + 0.5)).setY(0.6);
      beam.position.copy(mid);
      beam.scale.x = LEN;
      beam.rotation.y = Math.atan2(dir.x, dir.z);
      // 빔 코리도(직선) 안의 대상 밀침
      const pushAlong = (bp: THREE.Vector3, apply: (v: { x: number; y: number; z: number }) => void, mass: number) => {
        const rel = bp.clone().sub(origin);
        const along = rel.dot(dir);
        if (along < 0.4 || along > LEN) return;
        const perp = rel.clone().sub(dir.clone().multiplyScalar(along)).setY(0);
        if (perp.length() < 0.5) {
          apply({ x: dir.x * mass * 6 * dt, y: mass * 1.5 * dt, z: dir.z * mass * 6 * dt });
        }
      };
      for (const other of players) {
        if (other.id === p.id) continue;
        pushAlong(other.position, (v) => other.body.applyImpulse(v, true), other.body.mass());
      }
      for (const prop of this.props.props) {
        if (prop.heldBy.has(p.id)) continue;
        pushAlong(prop.position, (v) => prop.body.applyImpulse(v, true), prop.body.mass());
      }
    }
    // 더 이상 들지 않는 플레이어의 빔 제거
    for (const [id, beam] of this.beams) {
      if (!holders.has(id)) {
        this.world.scene.remove(beam);
        this.beams.delete(id);
      }
    }
  }
}
