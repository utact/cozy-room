/** 라운드 랜덤 이벤트 — 리플레이성을 위한 '한 스푼'. 난투 중에만 활성화된다. */

import type { World3D } from './world';
import type { Player } from './player';
import type { PropManager } from './objects';
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

class WindEvent implements RoundEvent {
  id = 'wind';
  title = '돌풍 주의보!';
  desc = '창문을 안 닫았다! 몇 초마다 돌풍이 분다!';
  private timer = 0;

  start() {
    this.timer = 2.2;
  }

  tick(ctx: EventCtx, dt: number) {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 2.2 + Math.random() * 1.2;
    const angle = Math.random() * Math.PI * 2;
    const dir = { x: Math.cos(angle), z: Math.sin(angle) };
    for (const p of ctx.players) {
      const m = p.body.mass();
      p.body.applyImpulse({ x: dir.x * m * 3.2, y: m * 0.6, z: dir.z * m * 3.2 }, true);
    }
    for (const prop of ctx.props.props) {
      const m = prop.body.mass();
      prop.body.applyImpulse({ x: dir.x * m * 2.0, y: m * 1.2, z: dir.z * m * 2.0 }, true);
    }
    sfx.gust();
    ctx.pulse('휘이이잉!');
  }

  end() {}
}

/** 라운드 1은 평화롭게(조작 학습), 이후 라운드는 랜덤 이벤트 */
export function pickEvent(round: number, rng: () => number = Math.random): RoundEvent | null {
  if (round <= 1) return null;
  const pool: RoundEvent[] = [slippery, moon, new WindEvent()];
  return pool[Math.floor(rng() * pool.length)];
}
