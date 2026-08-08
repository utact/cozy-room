/** 라운드 랜덤 이벤트 — 리플레이성을 위한 '한 스푼'. 난투 중에만 활성화된다. */

import * as THREE from 'three';
import { ROOM_W, ROOM_D, type World3D } from './world';
import type { Player } from './player';
import type { Prop, PropManager } from './objects';
import { cloakObject, uncloakObject, buildAbstractVisual } from './visuals';
import { sfx } from './sound';

export interface EventCtx {
  world: World3D;
  players: Player[];
  props: PropManager;
  /** 돌풍 등 순간 연출용 콜백 */
  pulse: (text: string) => void;
}

export interface RoundEvent {
  id: string;
  title: string;
  desc: string;
  start(ctx: EventCtx): void;
  tick?(ctx: EventCtx, dt: number): void;
  end(ctx: EventCtx): void;
}

const slippery: RoundEvent = {
  id: 'slippery',
  title: '바닥 왁스칠!',
  desc: '속도는 붙는데 브레이크가 없다… 과속 주의!',
  start(ctx) {
    ctx.world.floorCollider.setFriction(0.02);
    for (const p of ctx.players) p.slippery = true;
  },
  end(ctx) {
    ctx.world.floorCollider.setFriction(0.9);
    for (const p of ctx.players) p.slippery = false;
  },
};

const moon: RoundEvent = {
  id: 'moon',
  title: '달 중력!',
  desc: '중력이 가출했다. 모든 것이 붕붕 뜬다!',
  start(ctx) {
    ctx.world.physics.gravity = { x: 0, y: -2.6, z: 0 };
  },
  end(ctx) {
    ctx.world.physics.gravity = { x: 0, y: -9.81, z: 0 };
  },
};

/** 8방위 화살표 — 바람 방향 안내용 */
function dirArrow(x: number, z: number): string {
  const arrows = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
  // 화면 기준: +x 오른쪽, +z 아래
  const angle = Math.atan2(z, x);
  const idx = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
  return arrows[idx];
}

/**
 * 돌풍 — 잠잠함(2~3초)과 강풍(2.6초)이 번갈아 온다.
 * 강풍 동안 매 틱 지속적인 힘 + 굴림 토크가 작용해 물건이 바람에 '굴러간다'.
 * 바람 방향은 화면을 가로지르는 스트릭 파티클로 보인다.
 */
class WindEvent implements RoundEvent {
  id = 'wind';
  title = '돌풍 주의보!';
  desc = '창문을 안 닫았다! 강풍이 물건을 쓸어간다!';
  private phase: 'calm' | 'blow' = 'calm';
  private timer = 1.6;
  private dir = { x: 1, z: 0 };
  private streaks: THREE.Group | null = null;

  start(ctx: EventCtx) {
    this.phase = 'calm';
    this.timer = 1.6;
    // 스트릭 파티클 — 바람 방향으로 흐르는 흰 줄
    this.streaks = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32 });
    for (let i = 0; i < 34; i++) {
      const len = 0.9 + Math.random() * 1.3;
      const streak = new THREE.Mesh(new THREE.BoxGeometry(len, 0.025, 0.025), mat);
      streak.position.set(
        (Math.random() - 0.5) * ROOM_W,
        0.3 + Math.random() * 2.4,
        (Math.random() - 0.5) * ROOM_D,
      );
      this.streaks.add(streak);
    }
    this.streaks.visible = false;
    ctx.world.scene.add(this.streaks);
  }

  tick(ctx: EventCtx, dt: number) {
    this.timer -= dt;
    if (this.phase === 'calm') {
      if (this.timer <= 0) {
        this.phase = 'blow';
        this.timer = 2.6;
        const angle = Math.random() * Math.PI * 2;
        this.dir = { x: Math.cos(angle), z: Math.sin(angle) };
        // 스트릭을 바람 방향으로 정렬
        if (this.streaks) {
          this.streaks.visible = true;
          const yaw = Math.atan2(-this.dir.z, this.dir.x);
          for (const s of this.streaks.children) s.rotation.y = yaw;
        }
        sfx.gust();
        ctx.pulse(`강풍 ${dirArrow(this.dir.x, this.dir.z)}`);
      }
      return;
    }
    // 강풍 — 지속적인 힘 (질량 비례, 매 틱 적분)
    for (const p of ctx.players) {
      const m = p.body.mass();
      p.body.applyImpulse({ x: this.dir.x * m * 4.5 * dt, y: 0, z: this.dir.z * m * 4.5 * dt }, true);
    }
    for (const prop of ctx.props.props) {
      const m = prop.body.mass();
      prop.body.applyImpulse(
        { x: this.dir.x * m * 7 * dt, y: m * 1.4 * dt, z: this.dir.z * m * 7 * dt },
        true,
      );
      // 굴림 토크 — 바람에 데굴데굴 굴러가는 느낌
      prop.body.applyTorqueImpulse(
        { x: this.dir.z * m * 0.9 * dt, y: 0, z: -this.dir.x * m * 0.9 * dt },
        true,
      );
    }
    // 스트릭 이동 — 방 밖으로 나가면 반대편에서 재등장
    if (this.streaks) {
      for (const s of this.streaks.children) {
        s.position.x += this.dir.x * 11 * dt;
        s.position.z += this.dir.z * 11 * dt;
        if (Math.abs(s.position.x) > ROOM_W / 2 + 1 || Math.abs(s.position.z) > ROOM_D / 2 + 1) {
          s.position.x = -this.dir.x * (ROOM_W / 2) + (Math.random() - 0.5) * 4;
          s.position.z = -this.dir.z * (ROOM_D / 2) + (Math.random() - 0.5) * 4;
          s.position.y = 0.3 + Math.random() * 2.4;
        }
      }
    }
    if (this.timer <= 0) {
      this.phase = 'calm';
      this.timer = 2.0 + Math.random() * 1.4;
      if (this.streaks) this.streaks.visible = false;
    }
  }

  end(ctx: EventCtx) {
    if (this.streaks) {
      ctx.world.scene.remove(this.streaks);
      this.streaks = null;
    }
  }
}

/**
 * 미스터리 룸 — 모든 프롭이 실루엣으로 변한다.
 * 한 번이라도 잡은 물건만 정체(색·이름)가 드러난다. 초기 회색 상자 시절의 재미를 모드화.
 */
class MysteryEvent implements RoundEvent {
  id = 'mystery';
  title = '미스터리 룸!';
  desc = '물건이 전부 실루엣이다. 직접 잡아야 정체를 안다!';
  private saved = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  private active: Prop[] = [];

  start(ctx: EventCtx) {
    for (const prop of ctx.props.props) {
      if (prop.meta.armOwner !== undefined) continue; // 팔은 누구 것인지 보여야 한다
      cloakObject(prop.mesh, this.saved);
      prop.cloaked = true;
      this.active.push(prop);
    }
  }

  tick(ctx: EventCtx) {
    // 잡는 순간 정체 공개 (이후 계속 공개 상태 유지)
    for (const prop of ctx.props.props) {
      if (prop.heldBy.size > 0 && prop.cloaked) {
        uncloakObject(prop.mesh, this.saved);
        prop.cloaked = false;
        sfx.reveal(70);
      }
    }
  }

  end() {
    for (const prop of this.active) {
      if (prop.cloaked) {
        uncloakObject(prop.mesh, this.saved);
        prop.cloaked = false;
      }
    }
    this.saved.clear();
    this.active = [];
  }
}

/**
 * 사물들이 이상해졌다 — 모든 프롭이 회색 프리미티브(정육면체·구·원뿔 등)로 변한다.
 * 미스터리(실루엣)보다 한 단계 더 추상적: 색·디테일이 전부 사라지고 대략의 형태만 남아,
 * 직접 잡아봐야 정체를 안다. 잡으면 원래 모습으로 복원.
 */
class AbstractEvent implements RoundEvent {
  id = 'abstract';
  title = '사물들이 이상해졌다!';
  desc = '전부 밋밋한 도형이 됐다. 잡아봐야 정체를 안다!';
  private active: Prop[] = [];

  start(ctx: EventCtx) {
    for (const prop of ctx.props.props) {
      if (prop.meta.armOwner !== undefined) continue;
      const stand = buildAbstractVisual(prop.meta);
      ctx.world.scene.add(stand);
      prop.abstract = stand;
      prop.mesh.visible = false;
      prop.cloaked = true; // 게스트 미러링용 플래그 재사용
      this.active.push(prop);
    }
  }

  tick(ctx: EventCtx) {
    for (const prop of this.active) {
      if (prop.cloaked && prop.heldBy.size > 0) this.reveal(ctx, prop);
    }
  }

  private reveal(ctx: EventCtx, prop: Prop) {
    if (prop.abstract) {
      ctx.world.scene.remove(prop.abstract);
      prop.abstract = null;
    }
    prop.mesh.visible = true;
    prop.cloaked = false;
    sfx.reveal(70);
  }

  end(ctx: EventCtx) {
    for (const prop of this.active) this.reveal(ctx, prop);
    this.active = [];
  }
}

/** 라운드 1은 평화롭게(조작 학습), 이후 라운드는 랜덤 이벤트. ?event=id 로 강제 가능 */
export function pickEvent(round: number, rng: () => number = Math.random): RoundEvent | null {
  const pool: () => RoundEvent[] = () =>
    [slippery, moon, new WindEvent(), new MysteryEvent(), new AbstractEvent()];
  const forced = new URLSearchParams(location.search).get('event');
  if (forced) return pool().find((e) => e.id === forced) ?? null;
  if (round <= 1) return null;
  const events = pool();
  return events[Math.floor(rng() * events.length)];
}
