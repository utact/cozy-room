/**
 * 캐릭터 비주얼 — 생성형 3D 캐릭터(GLB) 또는 절차적 캡슐 폴백.
 *
 * public/assets/characters/character.glb 는 tools/merge-character.mjs 가 Meshy 출력
 * 4개를 합쳐 만든 파일로, 30fps 클립 walk·pickup·throw·hit 을 담고 있다.
 * 게임이 필요로 하는 상태는 5개(idle 포함)인데 idle 클립이 없어서, 9.6초짜리
 * pickup 에서 구간 둘을 잘라 쓴다 — 뒷부분의 서 있는 동작이 idle, 쭈그려 집는
 * 부분이 grab 이다.
 *
 * GLB가 없거나 로드에 실패하면 절차적 캡슐로 폴백하므로 빌드는 항상 플레이 가능.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { createProceduralPlayerVisual, type PlayerVisual } from './visuals';

const GLB_URL = 'assets/characters/character.glb';

/** 물리 캡슐 총 높이(=CAPSULE_HALF*2 + CAPSULE_R*2)에 맞춘 목표 키 */
const TARGET_HEIGHT = 1.52;
const FPS = 30;

/** pickup 클립에서 잘라 쓰는 구간 (초) */
const IDLE_RANGE: [number, number] = [8.4, 9.6]; // 서 있는 동작 — 루프
/**
 * 잡기 — 물건은 버튼 누르는 순간 손에 붙으므로, 바닥까지 숙였다 오는 구간을 쓰면
 * "줍는 중인데 물건은 이미 공중" 이 된다. 물건을 몸쪽으로 끌어올리는 뒷부분만
 * 잘라 빠르게 돌려서 어긋남을 0.4초 안으로 줄인다.
 */
const GRAB_RANGE: [number, number] = [4.5, 5.7];
const GRAB_SPEED = 2.8;
/** 들고 있는 동안 — hit 클립 도입부의 두 손을 가슴 앞에 든 자세 */
const HOLD_RANGE: [number, number] = [0.0, 0.2];

export type CharAction = 'grab' | 'throw' | 'hit';

/**
 * 스킨드 캐릭터의 실제 렌더 높이.
 *
 * Box3.setFromObject 를 쓰면 안 된다. 그건 노드 트랜스폼을 곱하는데, 이 모델은
 * Armature 노드에 scale 0.01 이 걸려 있어 0.017 이라는 엉뚱한 값이 나온다.
 * 스키닝은 boneWorld × inverseBind 로 그 스케일을 상쇄하므로 화면에 그려지는
 * 크기는 지오메트리 좌표 그대로다 (여기선 1.7). 그래서 노드 트랜스폼을 빼고
 * 지오메트리 bbox 만 합친다.
 */
function measureHeight(root: THREE.Object3D): number {
  const box = new THREE.Box3();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    box.union(mesh.geometry.boundingBox!);
  });
  const h = box.getSize(new THREE.Vector3()).y;
  return h > 0.01 ? h : TARGET_HEIGHT; // 측정 실패 시 스케일 1
}

export class CharacterLibrary {
  private scene: THREE.Object3D | null = null;
  private clips = new Map<string, THREE.AnimationClip>();

  async load(): Promise<void> {
    let gltf;
    try {
      gltf = await new GLTFLoader().loadAsync(GLB_URL);
    } catch (err) {
      console.warn('[character] GLB 로드 실패 — 절차적 캡슐로 폴백', err);
      return;
    }
    const byName = new Map(gltf.animations.map((c) => [c.name, c]));
    const pickup = byName.get('pickup');
    const walk = byName.get('walk');
    if (!pickup || !walk) {
      console.warn('[character] 필수 클립(walk/pickup)이 없어 절차적 캡슐로 폴백');
      return;
    }
    const sub = (src: THREE.AnimationClip, name: string, [from, to]: [number, number]) =>
      THREE.AnimationUtils.subclip(src, name, Math.round(from * FPS), Math.round(to * FPS), FPS);

    this.clips.set('idle', sub(pickup, 'idle', IDLE_RANGE));
    this.clips.set('walk', walk);
    this.clips.set('grab', sub(pickup, 'grab', GRAB_RANGE));
    for (const n of ['throw', 'hit']) {
      const c = byName.get(n);
      if (c) this.clips.set(n, c);
    }
    const hit = byName.get('hit');
    if (hit) this.clips.set('hold', sub(hit, 'hold', HOLD_RANGE));

    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.castShadow = true;
    });
    this.scene = gltf.scene;
    console.info(`[character] 캐릭터 GLB 로드 완료 — 클립 ${[...this.clips.keys()].join(', ')}`);
  }

  /** 플레이어 한 명분 비주얼. GLB가 없으면 null (호출부가 절차적 폴백을 쓴다) */
  create(color: number): PlayerVisual | null {
    if (!this.scene) return null;
    // 스킨드 메시는 clone(true) 로 복제하면 스켈레톤이 공유돼 둘이 똑같이 움직인다
    const model = cloneSkinned(this.scene);

    // 텍스처가 한 벌뿐이라 머티리얼 색을 곱해 1P/2P를 구분한다 (인스턴스마다 복제).
    // 이 GLB는 같은 텍스처가 emissiveFactor [1,1,1] 로도 물려 있어서, 끄지 않으면
    // 자체발광 분홍이 diffuse 틴트를 덮어 두 플레이어가 똑같아 보인다.
    // 발광을 끄면 씬 조명을 받아 음영도 생긴다.
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      mat.color = new THREE.Color(color);
      mat.emissive = new THREE.Color(0x000000);
      m.material = mat;
    });

    // 발바닥이 원점인 모델을 캡슐 중심에 맞춰 내리고, 캡슐 높이에 맞춰 축소
    const height = measureHeight(model);
    model.scale.setScalar(TARGET_HEIGHT / height);
    model.position.y = -TARGET_HEIGHT / 2;

    const group = new THREE.Group();
    group.add(model);
    return new GlbPlayerVisual(group, model, this.clips);
  }
}

/** 지속 상태(idle/walk/hold)와 1회성 동작(grab/throw/hit)을 크로스페이드로 전환한다 */
class GlbPlayerVisual implements PlayerVisual {
  private mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private current = 'idle';
  /** 재생 중인 1회성 동작 — 끝나면 idle/walk로 복귀 */
  private oneShot: THREE.AnimationAction | null = null;

  constructor(readonly group: THREE.Group, model: THREE.Object3D, clips: Map<string, THREE.AnimationClip>) {
    this.mixer = new THREE.AnimationMixer(model);
    for (const [name, clip] of clips) {
      const action = this.mixer.clipAction(clip);
      if (name === 'grab' || name === 'throw' || name === 'hit') {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        if (name === 'grab') action.timeScale = GRAB_SPEED;
      } else if (name === 'hold') {
        // 0.2초짜리 짧은 구간이라 그냥 루프하면 매번 튄다. 왕복 재생으로 이어 붙인다
        action.setLoop(THREE.LoopPingPong, Infinity);
        action.timeScale = 0.5;
      }
      this.actions.set(name, action);
    }
    this.actions.get('idle')?.play();
    // clampWhenFinished 로 끝난 동작은 weight 1을 유지하므로, 복귀 동작과 겹치지
    // 않도록 직접 페이드아웃시킨다
    this.mixer.addEventListener('finished', (e) => {
      const done = (e as unknown as { action: THREE.AnimationAction }).action;
      if (done !== this.oneShot) return;
      this.oneShot = null;
      done.fadeOut(0.15);
      this.actions.get(this.current)?.reset().fadeIn(0.15).play();
    });
  }

  update(dt: number, moving: boolean, held: boolean) {
    // 들고 있을 때는 두 손을 앞으로 든 자세를 유지해야 물건이 허공에 뜬 것처럼
    // 보이지 않는다. 걷기 클립은 팔을 흔들지만 이동감이 더 중요해 그대로 쓴다.
    const want = moving ? 'walk' : held && this.actions.has('hold') ? 'hold' : 'idle';
    if (want !== this.current) {
      const from = this.actions.get(this.current);
      const to = this.actions.get(want);
      this.current = want;
      // 1회성 동작 중이면 목표 상태만 기억해 두고, 끝난 뒤에 그쪽으로 복귀한다
      if (!this.oneShot && from && to) {
        to.reset().play();
        from.crossFadeTo(to, 0.2, false);
      }
    }
    this.mixer.update(dt);
  }

  trigger(action: CharAction) {
    const next = this.actions.get(action);
    if (!next) return;
    this.oneShot?.stop(); // stop 은 finished 를 쏘지 않는다
    for (const name of ['idle', 'walk', 'hold']) this.actions.get(name)?.fadeOut(0.1);
    this.oneShot = next;
    next.reset().fadeIn(0.1).play();
  }
}

/** GLB가 없을 때 쓰는 폴백 — 기존 절차적 캡슐 */
export function createFallbackVisual(color: number): PlayerVisual {
  return createProceduralPlayerVisual(color);
}
