/**
 * 생성형 3D 에셋 로더.
 *
 *   public/assets/props/{id}.glb      — 프롭. manifest.json 에 id 목록
 *   public/assets/furniture/{id}.glb  — 가구
 *   public/assets/textures/{id}.webp  — 바닥·벽 타일, 창문·러그 알파
 *
 * **폴백은 없다.** 파일이 없으면 조용히 프리미티브로 대체하지 않고 에러를 던진다.
 * 폴백이 있으면 화면에 실제로 무엇이 렌더링되는지 알 수 없어진다.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { PropMeta } from './catalog';
import { CONCEPTS, type FurniturePiece } from './themes';

/** GLB를 카탈로그 치수에 맞추기 위한 목표 최대 변 */
function targetExtent(meta: PropMeta): number {
  const [sx, sy, sz] = meta.size;
  switch (meta.shape) {
    case 'box': return Math.max(sx, sy, sz);
    case 'ball': return sx * 2;
    case 'cylinder':
    case 'cone': return Math.max(sx * 2, sy * 2);
  }
}

/** 원점을 바닥면 중앙으로 맞춘 사본. 물리 바디와 겹치도록 정규화한다 */
function normalize(src: THREE.Object3D, extent: number, originAtBottom: boolean): THREE.Object3D {
  const obj = src.clone(true);
  const bbox = new THREE.Box3().setFromObject(obj);
  const size = bbox.getSize(new THREE.Vector3());
  const scale = extent / (Math.max(size.x, size.y, size.z) || 1);
  obj.scale.setScalar(scale);

  const box2 = new THREE.Box3().setFromObject(obj);
  const center = box2.getCenter(new THREE.Vector3());
  obj.position.set(-center.x, originAtBottom ? -box2.min.y : -center.y, -center.z);

  const wrapper = new THREE.Group();
  wrapper.add(obj);
  return wrapper;
}

export class AssetLibrary {
  private props = new Map<string, THREE.Object3D>();
  private furniture = new Map<string, THREE.Object3D>();
  private textures = new Map<string, THREE.Texture>();

  async load(): Promise<void> {
    const loader = new GLTFLoader();
    const texLoader = new THREE.TextureLoader();

    const res = await fetch('assets/props/manifest.json');
    if (!res.ok) throw new Error('[assets] props/manifest.json 을 읽을 수 없다');
    const ids: string[] = await res.json();

    // 콘셉트 정의에서 필요한 가구·텍스처를 모은다 — 목록을 두 곳에 적지 않기 위해
    const furnitureIds = new Set<string>();
    const textureIds = new Set<string>();
    for (const c of CONCEPTS) {
      for (const f of c.furniture) furnitureIds.add(f.glb);
      for (const d of c.decals) textureIds.add(d.tex);
      textureIds.add(c.floorTex);
      textureIds.add(c.wallTex);
      if (c.rug) textureIds.add(c.rug.tex);
    }

    const loadGlb = async (url: string, into: Map<string, THREE.Object3D>, id: string) => {
      const gltf = await loader.loadAsync(url);
      gltf.scene.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true;
      });
      into.set(id, gltf.scene);
    };

    await Promise.all([
      ...ids.map((id) => loadGlb(`assets/props/${id}.glb`, this.props, id)),
      ...[...furnitureIds].map((id) => loadGlb(`assets/furniture/${id}.glb`, this.furniture, id)),
      ...[...textureIds].map(async (id) => {
        const tex = await texLoader.loadAsync(`assets/textures/${id}.webp`);
        tex.colorSpace = THREE.SRGBColorSpace;
        this.textures.set(id, tex);
      }),
    ]);

    console.info(
      `[assets] 프롭 ${this.props.size} · 가구 ${this.furniture.size} · 텍스처 ${this.textures.size} 로드 완료`,
    );
  }

  /** 카탈로그 치수로 정규화된 프롭 사본 */
  instantiate(meta: PropMeta): THREE.Object3D {
    const src = this.props.get(meta.id);
    if (!src) throw new Error(`[assets] 프롭 GLB 없음: ${meta.id}`);
    return normalize(src, targetExtent(meta), false);
  }

  /** 콜라이더 크기에 맞춘 가구 사본. 원점이 바닥면이라 바닥에 딱 붙는다 */
  instantiateFurniture(piece: FurniturePiece): THREE.Object3D {
    const src = this.furniture.get(piece.glb);
    if (!src) throw new Error(`[assets] 가구 GLB 없음: ${piece.glb}`);
    const obj = normalize(src, Math.max(piece.hx, piece.hy, piece.hz) * 2, true);
    if (piece.rotY) obj.rotation.y = piece.rotY;
    return obj;
  }

  texture(id: string): THREE.Texture {
    const tex = this.textures.get(id);
    if (!tex) throw new Error(`[assets] 텍스처 없음: ${id}`);
    return tex;
  }

  /** 바닥·벽처럼 반복해서 까는 텍스처 — 원본을 건드리지 않도록 사본을 만든다 */
  tiled(id: string, repeatX: number, repeatY: number): THREE.Texture {
    const tex = this.texture(id).clone();
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.needsUpdate = true;
    return tex;
  }
}
