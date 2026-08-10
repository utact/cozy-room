/** 프롭 스폰·물리 동기화·그랩 후보 탐색·던짐 상태 관리 */

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PROP_CATALOG, type PropMeta } from './catalog';
import { ROOM_W, ROOM_D, type World3D } from './world';
import type { AssetLibrary } from './assets';
import type { Concept } from './themes';

const THROWN_WINDOW = 1.6; // 이 시간 안에 상대를 맞히면 '뺏기' 성립 (초)

let nextPropUid = 1;

export class Prop {
  readonly uid = nextPropUid++;
  /** 정전 모드 — 실루엣 상태. 한 번 잡으면 정체가 드러난다 */
  cloaked = false;
  thrownBy = -1; // 던진 플레이어 id (-1 = 없음)
  thrownTimer = 0;
  /** 현재 이 프롭을 잡고 있는 플레이어 id 집합 (동시 그랩 = 줄다리기) */
  heldBy = new Set<number>();

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

  constructor(private world: World3D, private assets: AssetLibrary) {}

  /**
   * 콘셉트에 맞는 프롭만 깔아 놓는다. 라운드마다 맵이 바뀌므로 매번 다시 깐다.
   * 같은 물건이 둘 이상이면 "주제에 가장 맞는 물건을 든 사람"을 가릴 수 없으므로
   * 종류마다 딱 하나씩만 스폰한다.
   */
  /**
   * 바닥에 깔 프롭 총 개수.
   *
   * 종류는 12가지지만 12개만 깔면 13×9.5 바닥이 휑하다. 물건을 주우러 가는 동선이
   * 서로 겹치지 않아 부딪힐 일이 없고, 그러면 물리 난투가 성립하지 않는다.
   * 종류를 넘는 만큼은 이미 있는 것을 한 번 더 깐다 — 같은 물건이 둘이면 두 사람이
   * 같은 답을 낼 수 있는데, 그건 점수가 같아질 뿐이라 심사가 깨지지 않는다.
   */
  private static readonly FLOOR_COUNT = 22;

  setConcept(concept: Concept, rng: () => number = Math.random) {
    for (const prop of [...this.props]) this.despawn(prop);
    const metas = concept.propIds.map((id) => {
      const meta = PROP_CATALOG.find((m) => m.id === id);
      if (!meta) throw new Error(`[objects] 카탈로그에 없는 프롭 id: ${id}`);
      return meta;
    });
    for (const meta of metas) this.spawn(meta);
    // 정원까지 채우는 여벌 — 종류를 골고루 돌려 한 물건만 바닥에 널리지 않게 한다
    for (let i = 0; metas.length + i < PropManager.FLOOR_COUNT; i++) {
      this.spawn(metas[i % metas.length]);
    }
    this.scatter(rng);
  }

  /**
   * 같은 프롭을 여러 개 더 깔아 놓는다 (일치 라운드 전용).
   *
   * 평소에는 종류마다 딱 하나씩만 두지만, 일치 라운드는 "N명이 N-1개를 두고 다툰다"가
   * 규칙이라 목표 프롭만 인원수-1개가 있어야 한다. 하나만 두면 나머지 전원이 구조적으로
   * 실패해 라운드가 성립하지 않는다.
   */
  addCopies(meta: PropMeta, count: number, rng: () => number = Math.random) {
    for (let i = 0; i < count; i++) {
      const prop = this.spawn(meta);
      this.placeRandom(prop, rng);
    }
  }

  private spawn(meta: PropMeta): Prop {
    const body = this.world.physics.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(0, 2, 0)
        .setLinearDamping(0.25)
        .setAngularDamping(0.4),
    );
    const collider = this.world.physics.createCollider(buildColliderDesc(meta), body);
    const mesh = this.assets.instantiate(meta);
    this.world.scene.add(mesh);
    const prop = new Prop(meta, body, collider, mesh);
    this.props.push(prop);
    this.byCollider.set(collider.handle, prop);
    return prop;
  }

  /**
   * 착지 지점이 가구 발자국이나 그 그림자 띠 안이면 다시 뽑는다.
   * 공중에서 떨어뜨리는 방식이라 낙하 시작점의 x·z가 곧 착지 지점이다.
   * 여기서 걸러야 "가구 뒤에 가려 보이지 않는 프롭"이 원천적으로 생기지 않는다.
   */
  private placeRandom(prop: Prop, rng: () => number) {
    const margin = Math.max(...prop.meta.size) / 2 + 0.15;
    let x = 0;
    let z = 0;
    for (let attempt = 0; attempt < 40; attempt++) {
      x = (rng() - 0.5) * (ROOM_W - 3);
      z = (rng() - 0.5) * (ROOM_D - 3);
      const blocked = this.world.footprints.some(
        (f) =>
          x > f.minX - margin && x < f.maxX + margin &&
          z > f.minZ - margin && z < f.maxZ + margin,
      );
      if (!blocked) break;
    }
    prop.body.setTranslation({ x, y: 0.8 + rng() * 2.2, z }, true);
    prop.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    prop.body.setAngvel({ x: rng() * 2, y: rng() * 4, z: rng() * 2 }, true);
  }

  despawn(prop: Prop) {
    this.beforeDespawn(prop);
    this.byCollider.delete(prop.collider.handle);
    this.props = this.props.filter((p) => p !== prop);
    this.world.scene.remove(prop.mesh);
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

  update(dt: number) {
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
    }
  }

  markThrown(prop: Prop, playerId: number) {
    prop.thrownBy = playerId;
    prop.thrownTimer = THROWN_WINDOW;
  }
}
