/**
 * 라운드 모드 — 콘셉트가 허용한 것만 발동한다.
 *
 * 모드는 그냥 일어나지 않는다. 방 안의 장치가 원인이어야 한다.
 * 돌풍은 뒷벽 창문에서 불어오고, 정전은 그 창문만 남기고 불이 꺼진다.
 * 진동은 원인이 윗집이라 화면 밖에 있으므로, 대신 플레이어의 몸이 증거가 된다.
 */

import * as THREE from 'three';
import { ROOM_D, ROOM_W, type World3D } from './world';
import type { Player } from './player';
import type { Prop, PropManager } from './objects';
import type { AssetLibrary } from './assets';
import { cloakObject, uncloakObject } from './visuals';
import { sfx } from './sound';

export interface EventCtx {
  world: World3D;
  players: Player[];
  props: PropManager;
  /** 모드가 직접 스폰하는 GLB(너구리 등)를 꺼내 쓰는 통로 */
  assets: AssetLibrary;
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
      // 손에 든 물건은 바람을 타지 않는다. 그랩은 조인트로 손에 붙여 두는 방식이라
      // 여기서 토크를 걸면 물건이 손 안에서 팽이처럼 돌아 "들고 있다"가 깨진다.
      if (prop.heldBy.size > 0) continue;
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

/**
 * 야생동물 난입 — 아이스박스에서 너구리가 튀어나와 프롭 하나를 물고 도망친다.
 *
 * 리그·애니메이션 없이 코드로만 움직인다. 이동 방향으로 기울이고 위아래로 통통 튀게
 * 하는 것만으로 달리는 느낌이 난다 — 커튼을 코드로 흔드는 것과 같은 방식이다.
 *
 * 너구리는 물리 콜라이더가 없는 순수 시각 엔티티다. 그래서 던진 프롭과의 충돌은
 * Rapier 이벤트가 아니라 매 틱 거리 비교로 판정한다(airship의 폭탄 착탄과 같은 접근).
 * 도주 내내 화면에 계속 보이므로 은닉 0을 해치지 않는다.
 */
class RaccoonEvent implements RoundEvent {
  id = 'raccoon';
  title = '너구리가 물어간다!';
  desc = '물고 도망치기 전에 던져서 맞혀라!';

  private static readonly APPROACH_SPEED = 3.5;
  private static readonly FLEE_SPEED = 4.2;
  private static readonly HIT_R = 0.55;
  /** 최대 변 기준 크기 — 캐릭터(1.52)의 3분의 1쯤이라 작지만 눈에 띈다 */
  private static readonly SIZE = 0.55;

  private mesh: THREE.Object3D | null = null;
  private phase: 'wait' | 'approach' | 'flee' = 'wait';
  private target: Prop | null = null;
  private carrying: Prop | null = null;
  private goal = new THREE.Vector3();
  private timer = 2.5;
  private homeX = 0;
  private homeZ = 0;
  private bob = 0;

  start(ctx: EventCtx) {
    const cooler = ctx.world.concept.furniture.find((f) => f.glb === 'cooler');
    this.homeX = cooler?.x ?? ROOM_W / 2 - 1;
    this.homeZ = cooler?.z ?? 0;

    // 형태 후보가 둘이라 아직 확정되지 않았다 — ?raccoon=b 로 바꿔 본다
    const variant = new URLSearchParams(location.search).get('raccoon') === 'b' ? 'b' : 'a';
    this.mesh = ctx.assets.instantiateCreature(`raccoon-${variant}`, RaccoonEvent.SIZE);
    this.mesh.visible = false;
    ctx.world.scene.add(this.mesh);

    this.phase = 'wait';
    // 라운드가 12초다. 등장이 늦으면 한 번도 못 보고 끝나므로 거의 바로 튀어나온다
    this.timer = 0.5 + Math.random() * 0.5;
    this.target = null;
    this.carrying = null;
  }

  tick(ctx: EventCtx, dt: number) {
    const mesh = this.mesh;
    if (!mesh) return;

    if (this.phase === 'wait') {
      this.timer -= dt;
      if (this.timer <= 0) this.beginApproach(ctx);
      return;
    }

    this.bob += dt;
    const pos = mesh.position;
    // 목표를 든 사람이 생기면 추격을 포기한다 — 손에 든 걸 뺏지는 않는다
    if (this.phase === 'approach' && this.target && this.target.heldBy.size > 0) {
      this.retreat();
    }

    const dest = this.phase === 'approach' ? this.target!.position : this.goal;
    const dir = new THREE.Vector3(dest.x - pos.x, 0, dest.z - pos.z);
    const dist = dir.length();
    const speed = this.phase === 'approach'
      ? RaccoonEvent.APPROACH_SPEED
      : RaccoonEvent.FLEE_SPEED;

    if (dist > 0.02) {
      dir.divideScalar(dist);
      pos.addScaledVector(dir, Math.min(speed * dt, dist));
      mesh.rotation.y = Math.atan2(dir.x, dir.z);
    }
    // 달리는 시늉 — 통통 튀고 앞뒤로 기운다
    pos.y = Math.abs(Math.sin(this.bob * 11)) * 0.07;
    mesh.rotation.x = Math.sin(this.bob * 11) * 0.12;

    if (this.carrying) {
      this.carrying.body.setTranslation({ x: pos.x, y: 0.3, z: pos.z }, true);
      this.carrying.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      for (const prop of ctx.props.props) {
        if (prop === this.carrying || prop.thrownBy < 0) continue;
        if (prop.position.distanceTo(pos) > RaccoonEvent.HIT_R) continue;
        this.dropCarried();
        sfx.critter();
        ctx.pulse('너구리가 놓쳤다!');
        break;
      }
    }

    if (dist > 0.25) return;

    if (this.phase === 'approach') {
      const prize = this.target;
      // 도착하는 사이에 누가 집었거나 던져진 상태면 빈손으로 돌아간다
      if (prize && prize.heldBy.size === 0 && prize.thrownBy < 0) {
        this.carrying = prize;
        sfx.critter();
        ctx.pulse('너구리가 물었다!');
      }
      this.retreat();
    } else {
      if (this.carrying) ctx.props.despawn(this.carrying);
      this.carrying = null;
      this.target = null;
      mesh.visible = false;
      this.phase = 'wait';
      // 굴로 돌아간 뒤 다시 나오기까지. 바닥에 프롭이 22개 깔려 있어 하나씩 물어가도
      // 판이 비지 않으므로, 12초 라운드 내내 쉬지 않고 들락거리게 둔다
      this.timer = 0.6 + Math.random() * 0.6;
    }
  }

  private beginApproach(ctx: EventCtx) {
    const free = ctx.props.props.filter((p) => p.heldBy.size === 0 && p.thrownBy < 0);
    if (free.length === 0) {
      this.timer = 0.4; // 노릴 게 없다 — 곧바로 다시 본다
      return;
    }
    this.target = free[Math.floor(Math.random() * free.length)];
    this.mesh!.position.set(this.homeX, 0, this.homeZ);
    this.mesh!.visible = true;
    this.phase = 'approach';
    sfx.critter();
    ctx.pulse('너구리 등장!');
  }

  /**
   * 도주 — 나왔던 아이스박스로 되돌아간다.
   *
   * "가장 가까운 벽으로"가 자연스러워 보이지만 그러면 안 된다. 프롭은 방 안쪽
   * (x ±6.5 · z ±4.5)에 깔리므로 가장 가까운 벽까지는 1~2밖에 안 되고, 속도 4.2면
   * 0.3초 만에 사라진다 — 던져서 맞힐 틈이 없어 모드의 핵심이 죽는다.
   * 굴로 되돌아가면 경로가 길어져 쫓아가 맞힐 여지가 생기고, 나온 곳으로 돌아간다는
   * 점에서 이야기도 맞는다.
   */
  private retreat() {
    this.goal.set(this.homeX, 0, this.homeZ);
    this.phase = 'flee';
  }

  private dropCarried() {
    const prop = this.carrying;
    if (!prop) return;
    prop.body.setLinvel({ x: (Math.random() - 0.5) * 3, y: 2.4, z: (Math.random() - 0.5) * 3 }, true);
    this.carrying = null;
  }

  end(ctx: EventCtx) {
    if (this.mesh) {
      ctx.world.scene.remove(this.mesh);
      this.mesh = null;
    }
    // 물고 가던 중 라운드가 끝나면 프롭은 그 자리에 그대로 남긴다
    this.carrying = null;
    this.target = null;
    this.phase = 'wait';
  }
}

/**
 * 소나기 — 텐트와 트인 하늘이 장치다.
 *
 * 정전이 "정체를 못 알아보게", 돌풍이 "힘으로 떠밀리게" 만든다면 이건 "다리가 말을
 * 안 듣게" 만든다. 미끄러움은 콜라이더 마찰이 아니라 `Player.slippery` 로 구현한다 —
 * 이동이 매 프레임 setLinvel 로 속도를 강제하는 방식이라 마찰은 이동감에 관여하지 않는다.
 *
 * 과거 왁스칠 모드가 같은 수치 레버를 썼는데 체감이 약했다. 화면에 아무 단서가 없으면
 * "미끄럽다"가 아니라 "조작이 둔하다"로 읽히기 때문으로 보고, 이번엔 젖은 발자국·빗줄기·
 * 몸 기울임·효과음을 함께 붙였다. 어느 신호가 실제로 기여하는지는 하나씩 꺼 보며 확인한다.
 */
class RainEvent implements RoundEvent {
  id = 'rain';
  title = '비 온다, 발밑 조심!';
  desc = '바닥이 미끄럽다. 방향을 바꾸면 그대로 밀려난다!';

  private static readonly DROPS = 150;

  private rain: THREE.InstancedMesh | null = null;
  private drops: { x: number; y: number; z: number; speed: number }[] = [];
  private marks: { mesh: THREE.Mesh; age: number }[] = [];
  private cooldown: number[] = [];

  start(ctx: EventCtx) {
    // 정전(0.12)보다 훨씬 여리게 — 어두워질 뿐 실루엣까지 가지 않는다
    ctx.world.setDim(0.45);
    for (const p of ctx.players) p.slippery = true;
    this.cooldown = ctx.players.map(() => 0);
    this.marks = [];

    const geo = new THREE.BoxGeometry(0.025, 0.55, 0.025);
    const mat = new THREE.MeshBasicMaterial({ color: 0xcfe0f5, transparent: true, opacity: 0.32 });
    this.rain = new THREE.InstancedMesh(geo, mat, RainEvent.DROPS);
    this.drops = [];
    for (let i = 0; i < RainEvent.DROPS; i++) {
      this.drops.push({
        x: (Math.random() - 0.5) * ROOM_W,
        y: Math.random() * 6,
        z: (Math.random() - 0.5) * ROOM_D,
        speed: 9 + Math.random() * 4,
      });
    }
    ctx.world.scene.add(this.rain);
  }

  tick(ctx: EventCtx, dt: number) {
    ctx.world.setCurtainWind(0.55); // 텐트 자락이 평소보다 크게 흔들린다

    if (this.rain) {
      const m = new THREE.Matrix4();
      for (let i = 0; i < this.drops.length; i++) {
        const d = this.drops[i];
        d.y -= d.speed * dt;
        if (d.y < 0) {
          d.y = 6;
          d.x = (Math.random() - 0.5) * ROOM_W;
          d.z = (Math.random() - 0.5) * ROOM_D;
        }
        m.makeTranslation(d.x, d.y, d.z);
        this.rain.setMatrixAt(i, m);
      }
      this.rain.instanceMatrix.needsUpdate = true;
    }

    // 젖은 발자국 — 미끄러지는 중일 때만 남는다. "지금 밀리고 있다"를 눈으로 보여준다
    ctx.players.forEach((p, i) => {
      this.cooldown[i] -= dt;
      const v = p.body.linvel();
      if (Math.hypot(v.x, v.z) < 2.4 || this.cooldown[i] > 0) return;
      this.cooldown[i] = 0.14;
      this.mark(ctx, p.position.x, p.position.z);
      if (Math.random() < 0.35) sfx.slip();
    });

    for (const f of this.marks) f.age += dt;
    this.marks = this.marks.filter((f) => {
      const t = f.age / 0.45;
      (f.mesh.material as THREE.MeshBasicMaterial).opacity = 0.34 * Math.max(0, 1 - t);
      if (t < 1) return true;
      ctx.world.scene.remove(f.mesh);
      return false;
    });
  }

  private mark(ctx: EventCtx, x: number, z: number) {
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(0.24, 12),
      new THREE.MeshBasicMaterial({
        color: 0x9fc2e4, transparent: true, opacity: 0.34, depthWrite: false,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.014, z);
    ctx.world.scene.add(mesh);
    this.marks.push({ mesh, age: 0 });
  }

  end(ctx: EventCtx) {
    ctx.world.setDim(1);
    ctx.world.setCurtainWind(0);
    for (const p of ctx.players) p.slippery = false;
    if (this.rain) {
      ctx.world.scene.remove(this.rain);
      this.rain = null;
    }
    for (const f of this.marks) ctx.world.scene.remove(f.mesh);
    this.marks = [];
  }
}

const FACTORIES: Record<string, () => RoundEvent> = {
  wind: () => new WindEvent(),
  rumble: () => new RumbleEvent(),
  blackout: () => new BlackoutEvent(),
  raccoon: () => new RaccoonEvent(),
  rain: () => new RainEvent(),
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
