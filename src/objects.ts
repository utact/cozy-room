/** 프롭 스폰·물리 동기화·그랩 후보 탐색·던짐 상태 관리 */

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PROP_CATALOG, type PropMeta } from './catalog';
import { ROOM_W, ROOM_D, type World3D } from './world';
import { buildProceduralVisual } from './visuals';
import type { AssetLibrary } from './assets';

const THROWN_WINDOW = 1.6; // 이 시간 안에 상대를 맞히면 '뺏기' 성립 (초)

let nextPropUid = 1;

export class Prop {
  /** 네트워크 동기화용 고유 id */
  readonly uid = nextPropUid++;
  /** 미스터리 룸 — 실루엣 상태 */
  cloaked = false;
  thrownBy = -1; // 던진 플레이어 id (-1 = 없음)
  thrownTimer = 0;
  /** 현재 이 프롭을 잡고 있는 플레이어 id 집합 (동시 그랩 = 줄다리기) */
  heldBy = new Set<number>();
  /** 추상화 모드 — 회색 프리미티브 스탠드인 (표시 중이면 mesh는 숨김) */
  abstract: THREE.Object3D | null = null;

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
    // 카탈로그 전체를 딱 하나씩. 같은 물건이 둘 이상이면 "주제에 가장 맞는 물건을
    // 든 사람"을 가릴 수 없으므로 중복 스폰은 두지 않는다.
    for (const meta of PROP_CATALOG) this.spawn(meta);
    this.scatter(rng);
  }

  private spawn(meta: PropMeta): Prop {
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
    return prop;
  }

  private placeRandom(prop: Prop, rng: () => number) {
    const x = (rng() - 0.5) * (ROOM_W - 3);
    const z = (rng() - 0.5) * (ROOM_D - 3);
    const y = 0.8 + rng() * 2.2;
    prop.body.setTranslation({ x, y, z }, true);
    prop.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    prop.body.setAngvel({ x: rng() * 2, y: rng() * 4, z: rng() * 2 }, true);
  }

  despawn(prop: Prop) {
    this.beforeDespawn(prop);
    this.byCollider.delete(prop.collider.handle);
    this.props = this.props.filter((p) => p !== prop);
    this.world.scene.remove(prop.mesh);
    if (prop.abstract) this.world.scene.remove(prop.abstract);
    this.world.physics.removeRigidBody(prop.body);
  }

  /** 라운드 시작 — 프롭 위치를 방 안에 다시 흩뿌림 */
  scatter(rng: () => number = Math.random) {
    for (const prop of this.props) {
      prop.thrownBy = -1;
      prop.thrownTimer = 0;
      prop.heldBy.clear();
      this.placeRandom(prop, rng); // 공중에서 우수수 떨어지는 연출
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
      // 추상화 스탠드인도 같은 트랜스폼 추종
      if (prop.abstract) {
        prop.abstract.position.set(t.x, t.y, t.z);
        prop.abstract.quaternion.set(r.x, r.y, r.z, r.w);
      }
    }
  }

  markThrown(prop: Prop, playerId: number) {
    prop.thrownBy = playerId;
    prop.thrownTimer = THROWN_WINDOW;
  }
}
