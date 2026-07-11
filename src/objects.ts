/** 프롭 스폰·물리 동기화·그랩 후보 탐색·던짐 상태 관리 */

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PROP_CATALOG, type PropMeta, type PropShape } from './catalog';
import { ROOM_W, ROOM_D, type World3D } from './world';
import type { AssetLibrary } from './assets';

const THROWN_WINDOW = 1.6; // 이 시간 안에 상대를 맞히면 '뺏기' 성립 (초)

export class Prop {
  thrownBy = -1; // 던진 플레이어 id (-1 = 없음)
  thrownTimer = 0;
  /** 현재 이 프롭을 잡고 있는 플레이어 id 집합 (동시 그랩 = 줄다리기) */
  heldBy = new Set<number>();
  /** 뜯긴 팔 전용 — 바닥에서 눈에 띄게 하는 오라 링 */
  aura: THREE.Mesh | null = null;

  constructor(
    public meta: PropMeta,
    public body: RAPIER.RigidBody,
    public collider: RAPIER.Collider,
    public mesh: THREE.Object3D,
  ) {}

  get position(): THREE.Vector3 {
    const t = this.body.translation();
    return new THREE.Vector3(t.x, t.y, t.z);
  }
}

function buildGeometry(shape: PropShape, size: [number, number, number]): THREE.BufferGeometry {
  const [sx, sy, sz] = size;
  switch (shape) {
    case 'box': return new THREE.BoxGeometry(sx, sy, sz);
    case 'ball': return new THREE.SphereGeometry(sx, 18, 14);
    case 'cylinder': return new THREE.CylinderGeometry(sx, sx, sy * 2, 18);
    case 'cone': return new THREE.ConeGeometry(sx, sy * 2, 18);
  }
}

/** parts 조합 또는 단일 프리미티브로 프롭 비주얼 생성 */
function buildProceduralVisual(meta: PropMeta): THREE.Object3D {
  const makeMesh = (shape: PropShape, size: [number, number, number], color: number) => {
    const mesh = new THREE.Mesh(
      buildGeometry(shape, size),
      new THREE.MeshStandardMaterial({ color, roughness: 0.7 }),
    );
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  };
  if (!meta.parts) return makeMesh(meta.shape, meta.size, meta.color);
  const group = new THREE.Group();
  for (const part of meta.parts) {
    const mesh = makeMesh(part.shape, part.size, part.color ?? meta.color);
    mesh.position.set(...part.pos);
    if (part.rot) mesh.rotation.set(...part.rot);
    group.add(mesh);
  }
  return group;
}

function buildColliderDesc(meta: PropMeta): RAPIER.ColliderDesc {
  const [sx, sy, sz] = meta.size;
  let desc: RAPIER.ColliderDesc;
  switch (meta.shape) {
    case 'box': desc = RAPIER.ColliderDesc.cuboid(sx / 2, sy / 2, sz / 2); break;
    case 'ball': desc = RAPIER.ColliderDesc.ball(sx); break;
    case 'cylinder': desc = RAPIER.ColliderDesc.cylinder(sy, sx); break;
    case 'cone': desc = RAPIER.ColliderDesc.cone(sy, sx); break;
  }
  return desc
    .setDensity(meta.density * 400) // 사람이 밀 수 있는 스케일로 보정
    .setFriction(0.75)
    .setRestitution(0.25)
    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
}

export class PropManager {
  props: Prop[] = [];
  /** collider handle → Prop 역참조 (충돌 이벤트 매핑용) */
  byCollider = new Map<number, Prop>();

  /** 프롭 제거 전 훅 — 잡고 있는 플레이어의 조인트 해제용 (game이 설정) */
  beforeDespawn: (prop: Prop) => void = () => {};

  constructor(private world: World3D, private assets: AssetLibrary, rng: () => number = Math.random) {
    // 카탈로그 전체 1개씩 + 테마 가중 프롭 중복으로 물량 확보
    const metas: PropMeta[] = [...PROP_CATALOG];
    const boosted = PROP_CATALOG.filter((m) =>
      m.tags.some((t) => world.theme.boostTags.includes(t)),
    );
    const extraPool = boosted.length > 0 ? boosted : PROP_CATALOG;
    for (let i = 0; i < 6; i++) {
      metas.push(extraPool[Math.floor(rng() * extraPool.length)]);
    }
    for (const meta of metas) this.spawn(meta);
    this.scatter(rng);
  }

  private spawn(meta: PropMeta) {
    const body = this.world.physics.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(0, 2, 0)
        .setLinearDamping(0.25)
        .setAngularDamping(0.4),
    );
    const collider = this.world.physics.createCollider(buildColliderDesc(meta), body);
    // 생성형 3D GLB가 있으면 사용, 없으면 절차적 비주얼
    const mesh = this.assets.instantiate(meta) ?? buildProceduralVisual(meta);
    this.world.scene.add(mesh);
    const prop = new Prop(meta, body, collider, mesh);
    this.props.push(prop);
    this.byCollider.set(collider.handle, prop);
  }

  /** 줄다리기에서 뜯긴 팔을 아이템으로 스폰 */
  spawnArm(playerId: number, playerName: string, color: number, pos: THREE.Vector3, side: 'L' | 'R'): Prop {
    const meta: PropMeta = {
      id: `arm-${playerId}-${side}`,
      name: `${playerName}의 ${side === 'L' ? '왼팔' : '오른팔'}`,
      tags: ['팔', '유머', '섬뜩함', '물귀신'],
      shape: 'box',
      size: [0.18, 0.42, 0.18],
      color,
      density: 0.5,
      armOwner: playerId,
      armSide: side,
    };
    const body = this.world.physics.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(pos.x, pos.y + 0.4, pos.z)
        .setLinearDamping(0.25)
        .setAngularDamping(0.4),
    );
    const collider = this.world.physics.createCollider(
      RAPIER.ColliderDesc.capsule(0.12, 0.085)
        .setDensity(200)
        .setFriction(0.75)
        .setRestitution(0.35)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body,
    );
    // 팔 비주얼 — 캡슐 + 손끝 구
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const limb = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.24, 4, 10), mat);
    limb.castShadow = true;
    group.add(limb);
    const fist = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), mat);
    fist.position.y = 0.19;
    fist.castShadow = true;
    group.add(fist);
    this.world.scene.add(group);
    // 오라 링 — 바닥에서 맥동하며 주인 색으로 빛난다
    const aura = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.46, 26),
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    aura.rotation.x = -Math.PI / 2;
    this.world.scene.add(aura);
    // 뜯기는 임펄스 — 위로 팝
    body.setLinvel({ x: (Math.random() - 0.5) * 3, y: 4.2, z: (Math.random() - 0.5) * 3 }, true);
    body.setAngvel({ x: 6, y: 2, z: 6 }, true);
    const prop = new Prop(meta, body, collider, group);
    prop.aura = aura;
    this.props.push(prop);
    this.byCollider.set(collider.handle, prop);
    return prop;
  }

  despawn(prop: Prop) {
    this.beforeDespawn(prop);
    this.byCollider.delete(prop.collider.handle);
    this.props = this.props.filter((p) => p !== prop);
    this.world.scene.remove(prop.mesh);
    if (prop.aura) this.world.scene.remove(prop.aura);
    this.world.physics.removeRigidBody(prop.body);
  }

  /** 라운드 시작 — 프롭 위치를 방 안에 다시 흩뿌림. 뜯긴 팔은 수거된다. */
  scatter(rng: () => number = Math.random) {
    for (const arm of this.props.filter((p) => p.meta.armOwner !== undefined)) {
      this.despawn(arm);
    }
    for (const prop of this.props) {
      prop.thrownBy = -1;
      prop.thrownTimer = 0;
      prop.heldBy.clear();
      const x = (rng() - 0.5) * (ROOM_W - 3);
      const z = (rng() - 0.5) * (ROOM_D - 3);
      const y = 0.8 + rng() * 2.2; // 공중에서 우수수 떨어지는 연출
      prop.body.setTranslation({ x, y, z }, true);
      prop.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      prop.body.setAngvel({ x: rng() * 2, y: rng() * 4, z: rng() * 2 }, true);
    }
  }

  /** handPos 근처에서 잡을 수 있는 가장 가까운 프롭 */
  findGrabbable(handPos: THREE.Vector3, excludePlayerId: number, radius = 1.15): Prop | null {
    let best: Prop | null = null;
    let bestDist = radius;
    for (const prop of this.props) {
      if (prop.heldBy.has(excludePlayerId)) continue;
      const d = prop.position.distanceTo(handPos);
      if (d < bestDist) {
        best = prop;
        bestDist = d;
      }
    }
    return best;
  }

  private time = 0;

  update(dt: number) {
    this.time += dt;
    for (const prop of this.props) {
      if (prop.thrownTimer > 0) {
        prop.thrownTimer -= dt;
        if (prop.thrownTimer <= 0) prop.thrownBy = -1;
      }
      // 물리 → 렌더 동기화
      const t = prop.body.translation();
      const r = prop.body.rotation();
      prop.mesh.position.set(t.x, t.y, t.z);
      prop.mesh.quaternion.set(r.x, r.y, r.z, r.w);
      // 팔 오라 — 바닥에 붙어 맥동
      if (prop.aura) {
        prop.aura.position.set(t.x, 0.05, t.z);
        const s = 1 + 0.18 * Math.sin(this.time * 5.5);
        prop.aura.scale.set(s, s, 1);
      }
    }
  }

  markThrown(prop: Prop, playerId: number) {
    prop.thrownBy = playerId;
    prop.thrownTimer = THROWN_WINDOW;
  }
}
