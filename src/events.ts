/**
 * 라운드 모드 — 콘셉트가 허용한 것만 발동한다.
 *
 * 모드는 그냥 일어나지 않는다. 방 안의 장치가 원인이어야 한다.
 * 돌풍은 뒷벽 창문에서 불어오고, 정전은 그 창문만 남기고 불이 꺼진다.
 * 진동은 원인이 윗집이라 화면 밖에 있으므로, 대신 플레이어의 몸이 증거가 된다.
 */

import * as THREE from 'three';
import { ROOM_D, type World3D } from './world';
import type { Player } from './player';
import type { Prop, PropManager } from './objects';
import { cloakObject, uncloakObject } from './visuals';
import { sfx } from './sound';

export interface EventCtx {
  world: World3D;
  players: Player[];
  props: PropManager;
  /** 순간 연출용 콜백 */
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

/**
 * 돌풍 — 뒷벽 창문에서 앞벽 쪽(+z)으로 분다. 방향은 창문 위치가 정하므로 항상 같다.
 *
 * 방 전체가 아니라 창문 앞 띠 구역에만 힘이 작용한다. 그래서 존을 좌우로 가로지르는
 * 플레이어는 안에 있는 동안만 하류로 밀리고, 벗어나면 즉시 정상으로 돌아온다.
 */
class WindEvent implements RoundEvent {
  id = 'wind';
  title = '누가 또 창문 안 닫았어!';
  desc = '창가를 지나가면 떠밀린다. 강풍이 물건을 쓸어간다!';

  /** 창문 x중심 기준 띠의 반폭 */
  private static readonly ZONE_HALF_W = 2.5;

  private phase: 'calm' | 'blow' = 'calm';
  private timer = 1.6;
  private streaks: THREE.Group | null = null;
  private originX = 0;

  start(ctx: EventCtx) {
    this.phase = 'calm';
    this.timer = 1.6;
    // 바람의 출처는 콘셉트가 정의한 창문이다
    this.originX = ctx.world.concept.decals.find((d) => d.tex === 'window')?.x ?? 0;

    this.streaks = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xfff2dd, transparent: true, opacity: 0.3 });
    for (let i = 0; i < 30; i++) {
      const len = 0.9 + Math.random() * 1.3;
      const streak = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, len), mat);
      streak.position.set(
        this.originX + (Math.random() - 0.5) * WindEvent.ZONE_HALF_W * 2,
        0.3 + Math.random() * 2.0,
        (Math.random() - 0.5) * ROOM_D,
      );
      this.streaks.add(streak);
    }
    this.streaks.visible = false;
    ctx.world.scene.add(this.streaks);
  }

  private inZone(x: number): boolean {
    return Math.abs(x - this.originX) <= WindEvent.ZONE_HALF_W;
  }

  tick(ctx: EventCtx, dt: number) {
    ctx.world.setCurtainWind(this.phase === 'blow' ? 1 : 0);
    this.timer -= dt;

    if (this.phase === 'calm') {
      if (this.timer <= 0) {
        this.phase = 'blow';
        this.timer = 2.6;
        if (this.streaks) this.streaks.visible = true;
        sfx.gust();
        ctx.pulse('강풍 ↓');
      }
      return;
    }

    // 강풍 — 존 안에서만, 항상 +z 방향 (질량 비례로 매 틱 적분)
    for (const p of ctx.players) {
      if (!this.inZone(p.position.x)) continue;
      const m = p.body.mass();
      p.body.applyImpulse({ x: 0, y: 0, z: m * 4.5 * dt }, true);
    }
    for (const prop of ctx.props.props) {
      if (!this.inZone(prop.position.x)) continue;
      const m = prop.body.mass();
      prop.body.applyImpulse({ x: 0, y: m * 1.4 * dt, z: m * 7 * dt }, true);
      // 굴림 토크 — 바람에 데굴데굴 굴러가는 느낌
      prop.body.applyTorqueImpulse({ x: m * 0.9 * dt, y: 0, z: 0 }, true);
    }

    if (this.streaks) {
      for (const s of this.streaks.children) {
        s.position.z += 11 * dt;
        if (s.position.z > ROOM_D / 2 + 1) {
          s.position.z = -ROOM_D / 2;
          s.position.x = this.originX + (Math.random() - 0.5) * WindEvent.ZONE_HALF_W * 2;
          s.position.y = 0.3 + Math.random() * 2.0;
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
    ctx.world.setCurtainWind(0);
    if (this.streaks) {
      ctx.world.scene.remove(this.streaks);
      this.streaks = null;
    }
  }
}

/**
 * 진동 — 윗집이 쿵쿵거린다.
 *
 * 원인이 화면 밖에 있고 천장도 없어서 매달아 흔들 물건을 둘 수 없다. 그래서 이 모드는
 * **플레이어의 몸**을 증거로 삼는다. 쿵 할 때마다 캐릭터가 떴다가 가라앉고, 프롭도 같이 튄다.
 */
class RumbleEvent implements RoundEvent {
  id = 'rumble';
  title = '윗집에서 또 쿵쿵거려!';
  desc = '바닥이 울린다. 몸도 물건도 같이 떠오른다!';

  private next = 0.8;

  start(ctx: EventCtx) {
    // 달 중력만큼 띄우면 "묵직한데 살짝 가벼워진" 체감과 어긋난다
    ctx.world.physics.gravity = { x: 0, y: -6.5, z: 0 };
    this.next = 0.8;
  }

  tick(ctx: EventCtx, dt: number) {
    this.next -= dt;
    if (this.next > 0) return;
    // 층간소음은 규칙적이지 않다 — 간격을 흔들어야 진짜 같다
    this.next = 1.3 + Math.random() * 0.3;

    for (const p of ctx.players) {
      const m = p.body.mass();
      p.body.applyImpulse({ x: 0, y: m * 3.4, z: 0 }, true);
    }
    for (const prop of ctx.props.props) {
      if (prop.heldBy.size > 0) continue;
      const m = prop.body.mass();
      prop.body.applyImpulse(
        { x: (Math.random() - 0.5) * m * 0.6, y: m * 2.6, z: (Math.random() - 0.5) * m * 0.6 },
        true,
      );
    }
    ctx.world.shake(0.35);
    sfx.thump();
  }

  end(ctx: EventCtx) {
    ctx.world.physics.gravity = { x: 0, y: -9.81, z: 0 };
  }
}

/**
 * 정전 — 불이 나가고 창문으로 드는 빛만 남는다.
 * 프롭은 실루엣이 되고, 직접 잡은 것만 정체가 드러난다.
 */
class BlackoutEvent implements RoundEvent {
  id = 'blackout';
  title = '정전이야!';
  desc = '물건이 실루엣만 보인다. 잡아봐야 정체를 안다!';

  private saved = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  private active: Prop[] = [];
  private lamps: THREE.PointLight[] = [];

  start(ctx: EventCtx) {
    ctx.world.setDim(0.12);
    sfx.blackout();

    // 각자 손에 든 것 주변만 겨우 보이는 개인 광원
    for (let i = 0; i < ctx.players.length; i++) {
      const lamp = new THREE.PointLight(0xffc978, 9, 4.5, 1.8);
      ctx.world.scene.add(lamp);
      this.lamps.push(lamp);
    }
    for (const prop of ctx.props.props) {
      cloakObject(prop.mesh, this.saved);
      prop.cloaked = true;
      this.active.push(prop);
    }
  }

  tick(ctx: EventCtx) {
    ctx.players.forEach((p, i) => {
      const lamp = this.lamps[i];
      if (!lamp) return;
      const pos = p.position;
      lamp.position.set(pos.x, pos.y + 1.1, pos.z);
    });
    // 잡는 순간 정체 공개 (이후 계속 공개 상태 유지)
    for (const prop of ctx.props.props) {
      if (prop.heldBy.size > 0 && prop.cloaked) {
        uncloakObject(prop.mesh, this.saved);
        prop.cloaked = false;
        sfx.reveal(70);
      }
    }
  }

  end(ctx: EventCtx) {
    ctx.world.setDim(1);
    for (const lamp of this.lamps) ctx.world.scene.remove(lamp);
    this.lamps = [];
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

const FACTORIES: Record<string, () => RoundEvent> = {
  wind: () => new WindEvent(),
  rumble: () => new RumbleEvent(),
  blackout: () => new BlackoutEvent(),
};

/**
 * 라운드 1은 평화롭게(조작 학습), 이후 라운드는 콘셉트가 허용한 모드 중 하나.
 * `?event=id` 로 강제할 수 있다.
 */
export function pickEvent(
  round: number,
  allowed: string[],
  rng: () => number = Math.random,
): RoundEvent | null {
  const forced = new URLSearchParams(location.search).get('event');
  if (forced) return FACTORIES[forced]?.() ?? null;
  if (round <= 1 || allowed.length === 0) return null;
  const id = allowed[Math.floor(rng() * allowed.length)];
  return FACTORIES[id]?.() ?? null;
}
