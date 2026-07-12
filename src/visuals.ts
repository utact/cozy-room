/** 공유 비주얼 빌더 — 호스트(물리 연동)와 온라인 게스트(미러링)가 같은 외형을 쓴다 */

import * as THREE from 'three';
import type { PropMeta, PropShape } from './catalog';

export const CAPSULE_HALF = 0.42;
export const CAPSULE_R = 0.34;

export interface PlayerVisual {
  group: THREE.Group;
  arms: { L: THREE.Mesh; R: THREE.Mesh };
  stubs: { L: THREE.Mesh; R: THREE.Mesh };
}

/** 캡슐 캐릭터 (눈·팔·뜯긴 자리 스텁 포함) */
export function createPlayerVisual(color: number): PlayerVisual {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  const capsule = new THREE.Mesh(
    new THREE.CapsuleGeometry(CAPSULE_R, CAPSULE_HALF * 2, 6, 16),
    bodyMat,
  );
  capsule.castShadow = true;
  group.add(capsule);
  for (const ex of [-0.13, 0.13]) {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }),
    );
    eye.position.set(ex, 0.34, CAPSULE_R * 0.82);
    group.add(eye);
    const pupil = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x1b1b22 }),
    );
    pupil.position.set(ex, 0.34, CAPSULE_R * 0.82 + 0.06);
    group.add(pupil);
  }
  const armMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  const stubMat = new THREE.MeshStandardMaterial({ color: 0x8e3423, roughness: 0.85 });
  const arms = {} as PlayerVisual['arms'];
  const stubs = {} as PlayerVisual['stubs'];
  for (const [key, side] of [['L', -1], ['R', 1]] as const) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.24, 4, 10), armMat);
    arm.castShadow = true;
    arm.position.set(side * (CAPSULE_R + 0.06), 0.12, 0.02);
    arm.rotation.z = side * 0.55;
    group.add(arm);
    arms[key] = arm;
    const stub = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), stubMat);
    stub.position.set(side * (CAPSULE_R + 0.02), 0.2, 0.02);
    stub.visible = false;
    group.add(stub);
    stubs[key] = stub;
  }
  return { group, arms, stubs };
}

/** 팔 자세 블렌딩 — held 여부에 따라 앞으로 뻗기 */
export function poseArms(arms: PlayerVisual['arms'], held: boolean) {
  for (const [key, side] of [['L', -1], ['R', 1]] as const) {
    const targetX = held ? -1.15 : 0;
    const targetZ = held ? side * 0.15 : side * 0.55;
    const arm = arms[key];
    arm.rotation.x += (targetX - arm.rotation.x) * 0.2;
    arm.rotation.z += (targetZ - arm.rotation.z) * 0.2;
  }
}

export function buildGeometry(shape: PropShape, size: [number, number, number]): THREE.BufferGeometry {
  const [sx, sy, sz] = size;
  switch (shape) {
    case 'box': return new THREE.BoxGeometry(sx, sy, sz);
    case 'ball': return new THREE.SphereGeometry(sx, 18, 14);
    case 'cylinder': return new THREE.CylinderGeometry(sx, sx, sy * 2, 18);
    case 'cone': return new THREE.ConeGeometry(sx, sy * 2, 18);
  }
}

/** parts 조합 또는 단일 프리미티브로 프롭 비주얼 생성 */
export function buildProceduralVisual(meta: PropMeta): THREE.Object3D {
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

/** 뜯긴 팔 비주얼 (캡슐 + 주먹) */
export function buildArmVisual(color: number): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  const limb = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.24, 4, 10), mat);
  limb.castShadow = true;
  group.add(limb);
  const fist = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), mat);
  fist.position.y = 0.19;
  fist.castShadow = true;
  group.add(fist);
  return group;
}

/** 팔 프롭 아래 맥동 오라 링 */
export function buildAuraRing(color: number): THREE.Mesh {
  const aura = new THREE.Mesh(
    new THREE.RingGeometry(0.3, 0.46, 26),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  aura.rotation.x = -Math.PI / 2;
  return aura;
}

/** 미스터리 룸 실루엣 재질 */
export const SILHOUETTE_MAT = new THREE.MeshStandardMaterial({ color: 0x232030, roughness: 0.95 });

/** Object3D 전체를 실루엣으로 / 원복 — saved 맵에 원본 재질 보관 */
export function cloakObject(obj: THREE.Object3D, saved: Map<THREE.Mesh, THREE.Material | THREE.Material[]>) {
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && !saved.has(mesh)) {
      saved.set(mesh, mesh.material);
      mesh.material = SILHOUETTE_MAT;
    }
  });
}

export function uncloakObject(obj: THREE.Object3D, saved: Map<THREE.Mesh, THREE.Material | THREE.Material[]>) {
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && saved.has(mesh)) {
      mesh.material = saved.get(mesh)!;
      saved.delete(mesh);
    }
  });
}
