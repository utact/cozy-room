/**
 * 생성형 3D 에셋 파이프라인.
 *
 * public/assets/props/manifest.json 에 프롭 id 배열을 적고 {id}.glb 를 같은 폴더에
 * 넣으면, 해당 프롭의 절차적 비주얼이 생성형 3D 모델로 자동 교체된다.
 * (물리 콜라이더·태그·심사 로직은 카탈로그 메타데이터를 그대로 사용)
 *
 * 매니페스트가 없으면 전부 절차적 비주얼로 폴백 — 빌드는 항상 플레이 가능.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { PropMeta } from './catalog';

/** 주 형태 기준 목표 크기(최대 변) — GLB를 카탈로그 스케일에 자동 정규화 */
function targetExtent(meta: PropMeta): number {
  const [sx, sy, sz] = meta.size;
  switch (meta.shape) {
    case 'box': return Math.max(sx, sy, sz);
    case 'ball': return sx * 2;
    case 'cylinder':
    case 'cone': return Math.max(sx * 2, sy * 2);
  }
}

export class AssetLibrary {
  private models = new Map<string, THREE.Object3D>();

  async load(): Promise<void> {
    let ids: string[];
    try {
      const res = await fetch('assets/props/manifest.json');
      if (!res.ok) return;
      ids = await res.json();
      if (!Array.isArray(ids)) return;
    } catch {
      return; // 매니페스트 없음 → 절차적 비주얼 사용
    }
    const loader = new GLTFLoader();
    await Promise.all(
      ids.map(async (id) => {
        try {
          const gltf = await loader.loadAsync(`assets/props/${id}.glb`);
          const obj = gltf.scene;
          obj.traverse((o) => {
            if ((o as THREE.Mesh).isMesh) {
              o.castShadow = o.receiveShadow = true;
            }
          });
          this.models.set(id, obj);
        } catch (err) {
          console.warn(`[assets] ${id}.glb 로드 실패 — 절차적 비주얼로 폴백`, err);
        }
      }),
    );
    if (this.models.size > 0) {
      console.info(`[assets] 생성형 3D 모델 ${this.models.size}개 로드 완료`);
    }
  }

  /** 카탈로그 스케일로 정규화·중앙 정렬된 사본을 반환. 없으면 null */
  instantiate(meta: PropMeta): THREE.Object3D | null {
    const src = this.models.get(meta.id);
    if (!src) return null;
    const obj = src.clone(true);
    const bbox = new THREE.Box3().setFromObject(obj);
    const size = bbox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = targetExtent(meta) / maxDim;
    obj.scale.setScalar(scale);
    const center = bbox.getCenter(new THREE.Vector3()).multiplyScalar(scale);
    obj.position.sub(center);
    const wrapper = new THREE.Group();
    wrapper.add(obj);
    return wrapper;
  }
}
