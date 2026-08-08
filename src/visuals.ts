/** 공유 비주얼 빌더 — 플레이어와 프롭의 외형을 한곳에서 만든다 */

import * as THREE from 'three';
import type { PropMeta, PropShape } from './catalog';

export const CAPSULE_HALF = 0.42;
export const CAPSULE_R = 0.34;

/**
 * 플레이어 외형 — 생성형 GLB 캐릭터와 절차적 캡슐이 공유하는 인터페이스.
 * player.ts 는 어느 쪽인지 모른 채 update/trigger 만 호출한다.
 */
export interface PlayerVisual {
  readonly group: THREE.Group;
  /** 매 틱 — moving 은 이동 입력 중인지, held 는 물건을 들고 있는지 */
  update(dt: number, moving: boolean, held: boolean): void;
  /** 1회성 동작 */
  trigger(action: 'grab' | 'throw' | 'hit'): void;
}

/** 캡슐 캐릭터 (눈·팔) — GLB가 없을 때의 폴백 */
export function createProceduralPlayerVisual(color: number): PlayerVisual {
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
  const arms = {} as { L: THREE.Mesh; R: THREE.Mesh };
  for (const [key, side] of [['L', -1], ['R', 1]] as const) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.24, 4, 10), armMat);
    arm.castShadow = true;
    arm.position.set(side * (CAPSULE_R + 0.06), 0.12, 0.02);
    arm.rotation.z = side * 0.55;
    group.add(arm);
    arms[key] = arm;
  }

  // 관절이 없으므로 '동작'은 팔을 앞으로 뻗는 것과 짧은 반동뿐이다
  let reach = 0; // 0 = 옆으로, 1 = 앞으로
  let recoil = 0; // 1회성 동작 후 잔여 시간
  return {
    group,
    update(dt, moving, held) {
      const target = recoil > 0 || held ? 1 : moving ? 0.25 : 0;
      reach += (target - reach) * 0.2;
      recoil = Math.max(0, recoil - dt);
      for (const [key, side] of [['L', -1], ['R', 1]] as const) {
        arms[key].rotation.x = -1.15 * reach;
        arms[key].rotation.z = side * (0.55 - 0.4 * reach);
      }
    },
    trigger() {
      recoil = 0.25;
    },
  };
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

/** 추상화 모드 — 프롭을 콜라이더 모양의 회색 프리미티브로 표현 (형태만 보고 추측) */
const ABSTRACT_MAT = new THREE.MeshStandardMaterial({ color: 0x9a9aa6, roughness: 0.85, flatShading: true });

export function buildAbstractVisual(meta: PropMeta): THREE.Mesh {
  const mesh = new THREE.Mesh(buildGeometry(meta.shape, meta.size), ABSTRACT_MAT);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
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
