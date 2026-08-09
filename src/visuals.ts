/** 공유 비주얼 계약과 실루엣 처리 — 외형 자체는 전부 GLB가 담당한다 */

import * as THREE from 'three';

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

/** 정전 모드 실루엣 재질 */
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
