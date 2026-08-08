/**
 * 플레이어 캐릭터 — 힘 기반 캡슐 + 조인트 그랩.
 * y축 회전만 허용해 밀치면 밀리고, 들고 있는 물건은 스프링처럼 흐느적 매달린다.
 */

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { InputSource, InputState } from './input';
import type { World3D } from './world';
import type { Prop, PropManager } from './objects';
import { CAPSULE_HALF, CAPSULE_R, type PlayerVisual } from './visuals';
import { sfx } from './sound';

const MOVE_SPEED = 4.6;
const YAW_GAIN = 11;
const HAND_LOCAL = { x: 0, y: 0.15, z: 0.62 }; // 몸 기준 손 위치 (앞)

export const PLAYER_COLORS = [0xe4573d, 0x3d7de4];
export const PLAYER_NAMES = ['1P', '2P'];

export class Player {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  group: THREE.Group;
  held: Prop | null = null;
  private joint: RAPIER.ImpulseJoint | null = null;
  private targetYaw = 0;
  score = 0;
  frozen = false;
  /** 바닥 왁스칠 이벤트 — 조향이 잘 안 듣는다 */
  slippery = false;
  /** 직전 프레임 이동 입력 크기 — 줄다리기 힘 계산용 */
  lastMoveMag = 0;
  private jumpBuffer = 0;
  private coyote = 0;
  /** 현재 잡기 후보 프롭 위치 (네트워크 동기화용) */
  indicatorPos: { x: number; z: number } | null = null;
  /** 잡기 가능한 프롭 아래 표시되는 링 */
  private indicator: THREE.Mesh;

  constructor(
    public id: number,
    public source: InputSource,
    private world: World3D,
    private propMgr: PropManager,
    spawn: THREE.Vector3,
    private visual: PlayerVisual,
  ) {
    this.body = world.physics.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(spawn.x, spawn.y, spawn.z)
        .setLinearDamping(0.6)
        .setAngularDamping(4),
    );
    this.body.setEnabledRotations(false, true, false, true);
    this.collider = world.physics.createCollider(
      RAPIER.ColliderDesc.capsule(CAPSULE_HALF, CAPSULE_R)
        .setDensity(600)
        .setFriction(0.4)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      this.body,
    );

    this.group = visual.group;
    world.scene.add(this.group);

    this.indicator = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.55, 24),
      new THREE.MeshBasicMaterial({
        color: PLAYER_COLORS[this.id],
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.indicator.rotation.x = -Math.PI / 2;
    this.indicator.visible = false;
    world.scene.add(this.indicator);
  }

  get position(): THREE.Vector3 {
    const t = this.body.translation();
    return new THREE.Vector3(t.x, t.y, t.z);
  }

  get yaw(): number {
    const r = this.body.rotation();
    const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    return Math.atan2(fwd.x, fwd.z);
  }

  get facing(): THREE.Vector3 {
    const y = this.yaw;
    return new THREE.Vector3(Math.sin(y), 0, Math.cos(y));
  }

  get handWorld(): THREE.Vector3 {
    return this.position.add(this.facing.multiplyScalar(HAND_LOCAL.z)).add(new THREE.Vector3(0, HAND_LOCAL.y, 0));
  }

  update(dt: number) {
    const input: InputState = this.frozen
      ? { moveX: 0, moveZ: 0, actionPressed: false, actionHeld: false, jumpPressed: false }
      : this.source.getState();

    // 이동 — 현재 속도를 목표 속도로 서서히 블렌드 (밀침·넉백이 살아있도록)
    // 왁스칠: 가속·감속이 굼떠지는 대신 최고 속도가 붙는다 (빙판 과속)
    this.lastMoveMag = Math.min(Math.hypot(input.moveX, input.moveZ), 1);
    const lv = this.body.linvel();
    const len = Math.hypot(input.moveX, input.moveZ) || 1;
    const speed = MOVE_SPEED * (this.slippery ? 1.3 : 1);
    const tx = (input.moveX / len) * speed * Math.min(len, 1);
    const tz = (input.moveZ / len) * speed * Math.min(len, 1);
    const blend = this.slippery ? 0.06 : 0.18;
    this.body.setLinvel(
      { x: lv.x + (tx - lv.x) * blend, y: lv.y, z: lv.z + (tz - lv.z) * blend },
      true,
    );

    // 점프 — 입력 버퍼(착지 직전 입력 허용) + 코요테 타임(모서리 이탈 직후 허용)
    if (input.jumpPressed) this.jumpBuffer = 0.15;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.coyote = this.isGrounded() ? 0.1 : Math.max(0, this.coyote - dt);
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.jumpBuffer = 0;
      this.coyote = 0;
      const v = this.body.linvel();
      this.body.setLinvel({ x: v.x, y: 5.4, z: v.z }, true);
      sfx.jump();
    }

    // 조향 — 입력 방향으로 y축 회전 (P 제어)
    if (Math.abs(input.moveX) > 0.01 || Math.abs(input.moveZ) > 0.01) {
      this.targetYaw = Math.atan2(input.moveX, input.moveZ);
    }
    let yawErr = this.targetYaw - this.yaw;
    while (yawErr > Math.PI) yawErr -= Math.PI * 2;
    while (yawErr < -Math.PI) yawErr += Math.PI * 2;
    this.body.setAngvel({ x: 0, y: yawErr * YAW_GAIN * Math.min(dt * 60, 1.5), z: 0 }, true);

    // 그랩 / 던지기
    if (input.actionPressed) {
      if (this.held) this.throwHeld();
      else this.tryGrab();
    }

    // 렌더 동기화
    const t = this.body.translation();
    const r = this.body.rotation();
    this.group.position.set(t.x, t.y, t.z);
    this.group.quaternion.set(r.x, r.y, r.z, r.w);

    // 캐릭터 애니메이션 — 이동 중이면 걷기, 아니면 대기
    this.visual.update(dt, this.lastMoveMag > 0.05, this.held !== null);

    // 그랩 가능 표시 링
    this.indicatorPos = null;
    if (!this.held && !this.frozen) {
      const candidate = this.findCandidate();
      if (candidate) {
        const cp = candidate.position;
        this.indicator.position.set(cp.x, 0.04 + this.id * 0.012, cp.z);
        this.indicator.visible = true;
        this.indicatorPos = { x: cp.x, z: cp.z };
      } else {
        this.indicator.visible = false;
      }
    } else {
      this.indicator.visible = false;
    }
  }

  /** 발밑 0.9m 안에 뭔가 있으면 접지로 간주 (가구·프롭 위 포함) */
  private isGrounded(): boolean {
    const t = this.body.translation();
    const ray = new RAPIER.Ray({ x: t.x, y: t.y, z: t.z }, { x: 0, y: -1, z: 0 });
    const hit = this.world.physics.castRay(ray, 0.9, true, undefined, undefined, this.collider, this.body);
    return hit !== null;
  }

  /** 지금 잡을 수 있는 대상 */
  private findCandidate(): Prop | null {
    return this.propMgr.findGrabbable(this.handWorld, this.id);
  }

  private tryGrab() {
    const prop = this.findCandidate();
    if (!prop) return;
    sfx.grab();
    this.visual.trigger('grab');
    const params = RAPIER.JointData.spherical(
      { x: HAND_LOCAL.x, y: HAND_LOCAL.y, z: HAND_LOCAL.z },
      { x: 0, y: 0, z: 0 },
    );
    this.joint = this.world.physics.createImpulseJoint(params, this.body, prop.body, true);
    prop.heldBy.add(this.id);
    this.held = prop;
  }

  private throwHeld() {
    const prop = this.held;
    if (!prop) return;
    this.release();
    sfx.throw();
    this.visual.trigger('throw');
    // 무거울수록 느리게 날아간다
    const mass = prop.body.mass();
    const speed = Math.max(5, 13 - mass * 0.006);
    const dir = this.facing;
    prop.body.setLinvel({ x: dir.x * speed, y: 3.6, z: dir.z * speed }, true);
    this.propMgr.markThrown(prop, this.id);
  }

  /** 그랩 해제 (맞았을 때 강제 낙하 포함) */
  release() {
    if (this.joint) {
      this.world.physics.removeImpulseJoint(this.joint, true);
      this.joint = null;
    }
    if (this.held) {
      this.held.heldBy.delete(this.id);
      this.held = null;
    }
  }

  /** 던진 물건에 맞음 — 들고 있던 물건 낙하 + 넉백 */
  onHit(fromDir: THREE.Vector3) {
    sfx.bonk();
    this.visual.trigger('hit');
    this.release();
    const kb = fromDir.clone().setY(0).normalize().multiplyScalar(900);
    this.body.applyImpulse({ x: kb.x, y: 350, z: kb.z }, true);
  }

  resetForRound(spawn: THREE.Vector3) {
    this.release();
    this.body.setTranslation({ x: spawn.x, y: spawn.y, z: spawn.z }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }
}
