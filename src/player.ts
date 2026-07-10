/**
 * 플레이어 캐릭터 — 힘 기반 캡슐 + 조인트 그랩.
 * y축 회전만 허용해 밀치면 밀리고, 들고 있는 물건은 스프링처럼 흐느적 매달린다.
 */

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { InputSource, InputState } from './input';
import type { World3D } from './world';
import type { Prop, PropManager } from './objects';

const CAPSULE_HALF = 0.42;
const CAPSULE_R = 0.34;
const MOVE_SPEED = 4.6;
const YAW_GAIN = 11;
const HAND_LOCAL = { x: 0, y: 0.15, z: 0.62 }; // 몸 기준 손 위치 (앞)

export const PLAYER_COLORS = [0xe4573d, 0x3d7de4, 0xe4b53d, 0x4fbf5e];
export const PLAYER_NAMES = ['1P', '2P', '3P', '4P'];

export class Player {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  group = new THREE.Group();
  held: Prop | null = null;
  private joint: RAPIER.ImpulseJoint | null = null;
  private targetYaw = 0;
  score = 0;
  /** 최근 라운드 제출물 이름 (HUD) */
  frozen = false;

  constructor(
    public id: number,
    public source: InputSource,
    private world: World3D,
    private propMgr: PropManager,
    spawn: THREE.Vector3,
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

    this.buildMesh();
    world.scene.add(this.group);
  }

  private buildMesh() {
    const color = PLAYER_COLORS[this.id];
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const capsule = new THREE.Mesh(
      new THREE.CapsuleGeometry(CAPSULE_R, CAPSULE_HALF * 2, 6, 16),
      bodyMat,
    );
    capsule.castShadow = true;
    this.group.add(capsule);
    // 눈 — 진행 방향(+z) 표시 겸 캐릭터성
    for (const ex of [-0.13, 0.13]) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }),
      );
      eye.position.set(ex, 0.34, CAPSULE_R * 0.82);
      this.group.add(eye);
      const pupil = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x1b1b22 }),
      );
      pupil.position.set(ex, 0.34, CAPSULE_R * 0.82 + 0.06);
      this.group.add(pupil);
    }
    // 손 — 그랩 위치 시각화
    const hand = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 10, 8),
      new THREE.MeshStandardMaterial({ color, roughness: 0.5 }),
    );
    hand.position.set(HAND_LOCAL.x, HAND_LOCAL.y, HAND_LOCAL.z);
    this.group.add(hand);
  }

  get position(): THREE.Vector3 {
    const t = this.body.translation();
    return new THREE.Vector3(t.x, t.y, t.z);
  }

  private get yaw(): number {
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
      ? { moveX: 0, moveZ: 0, actionPressed: false, actionHeld: false }
      : this.source.getState();

    // 이동 — 현재 속도를 목표 속도로 서서히 블렌드 (밀침·넉백이 살아있도록)
    const lv = this.body.linvel();
    const len = Math.hypot(input.moveX, input.moveZ) || 1;
    const tx = (input.moveX / len) * MOVE_SPEED * Math.min(len, 1);
    const tz = (input.moveZ / len) * MOVE_SPEED * Math.min(len, 1);
    const blend = 0.18;
    this.body.setLinvel(
      { x: lv.x + (tx - lv.x) * blend, y: lv.y, z: lv.z + (tz - lv.z) * blend },
      true,
    );

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
  }

  private tryGrab() {
    const prop = this.propMgr.findGrabbable(this.handWorld, this.id);
    if (!prop) return;
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
