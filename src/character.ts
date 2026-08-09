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
/** CharacterStage 카메라 수직 화각 */
const FOV = 34;

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
 * 텍스처가 몸(채도 높은 빨강)과 눈(거의 흰색)을 한 아틀라스에 같이 담고 있어서 두 가지가
 * 문제였다: (1) 재질 색을 그대로 곱하면 눈까지 1P/2P 색으로 물든다 — 채도가 낮은(=흰자·
 * 동공) 텍셀은 원색 그대로 두고, 채도가 높은(=몸통) 텍셀만 골라 바꾼다.
 * (2) 원본 텍스처가 이미 빨강으로 구워져 있어서 곱셈으로는 파랑을 만들 수 없다 —
 * 파랑을 곱하면 (빨강×파랑)이 되어 짙은 와인/검정에 가까워진다. 그래서 곱하는 대신 원본
 * 텍셀의 명도(HSV Value = 최대 채널)만 유지하고 색상(Hue)은 틴트로 통째로 교체한다.
 */
const TINT_FRAGMENT = `
  {
    float maxC = max( max( diffuseColor.r, diffuseColor.g ), diffuseColor.b );
    float minC = min( min( diffuseColor.r, diffuseColor.g ), diffuseColor.b );
    float sat = maxC > 0.0001 ? ( maxC - minC ) / maxC : 0.0;
    // 실측: 눈(크림빛 흰자)은 채도 0.1~0.3대, 몸통(빨강)은 0.6~0.7대에 뭉쳐 있다 —
    // 그 사이 빈 구간에 경계를 둔다
    float tintAmt = smoothstep( 0.40, 0.50, sat );
    float tintMaxC = max( max( uTint.r, uTint.g ), max( uTint.b, 0.0001 ) );
    vec3 recolored = ( uTint / tintMaxC ) * maxC;
    diffuseColor.rgb = mix( diffuseColor.rgb, recolored, tintAmt );
  }
`;

/** 몸통만 색을 입히고 눈은 원래 흰색을 유지하는 머티리얼 (채도 기반 마스킹) */
function tintedMaterial(src: THREE.MeshStandardMaterial, color: number): THREE.MeshStandardMaterial {
  const mat = src.clone();
  mat.color = new THREE.Color(0xffffff);
  // 이 GLB는 같은 텍스처가 emissiveFactor [1,1,1] 로도 물려 있어서, 끄지 않으면
  // 자체발광이 틴트를 덮어 두 플레이어가 똑같아 보인다. 끄면 씬 조명을 받아 음영도 생긴다.
  mat.emissive = new THREE.Color(0x000000);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTint = { value: new THREE.Color(color) };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uTint;')
      .replace('#include <map_fragment>', `#include <map_fragment>\n${TINT_FRAGMENT}`);
  };
  return mat;
}

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
    // throw·hit은 인게임 동작, lobby·win은 화면용 (로비 대기 / 우승 세레모니)
    for (const n of ['throw', 'hit', 'lobby', 'win']) {
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

    // 텍스처가 한 벌뿐이라 몸통 색으로 1P/2P를 구분한다 (인스턴스마다 복제 — tintedMaterial 참고)
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.material = tintedMaterial(m.material as THREE.MeshStandardMaterial, color);
    });

    // 발바닥이 원점인 모델을 캡슐 중심에 맞춰 내리고, 캡슐 높이에 맞춰 축소
    const height = measureHeight(model);
    model.scale.setScalar(TARGET_HEIGHT / height);
    model.position.y = -TARGET_HEIGHT / 2;

    const group = new THREE.Group();
    group.add(model);
    return new GlbPlayerVisual(group, model, this.clips);
  }

  /**
   * 화면에 쓸 캐릭터 초상 — 색상별로 실제 GLB를 오프스크린 렌더해 PNG data URL로 만든다.
   *
   * 두 가지 프레이밍을 뽑는다. 쓰임새가 다르기 때문이다:
   *  - bust: 로비 카드·HUD 칩처럼 작게 들어가는 자리 — 얼굴(눈)이 보여야 누군지 읽힌다.
   *  - full: 시상대처럼 캐릭터가 무언가 위에 "서 있어야" 하는 자리 — 상반신만 띄우면
   *    프로필 사진처럼 보여서 어색하다.
   *
   * GLB가 없으면 빈 Map (호출부가 CSS 폴백을 쓴다).
   */
  renderPortraits(colors: number[]): { bust: Map<number, string>; full: Map<number, string> } {
    const bust = new Map<number, string>();
    const full = new Map<number, string>();
    if (!this.scene) return { bust, full };

    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 1.15));
    const dir = new THREE.DirectionalLight(0xffffff, 1.35);
    dir.position.set(1.2, 2.4, 2.6);
    scene.add(dir);
    // 뒤쪽에서 살짝 받쳐 어두운 배경 위에서도 실루엣이 죽지 않게 한다
    const rim = new THREE.DirectionalLight(0xffffff, 0.5);
    rim.position.set(-1.6, 1.2, -1.8);
    scene.add(rim);

    // 그룹 좌표계: 발바닥 -TARGET_HEIGHT/2, 정수리 +TARGET_HEIGHT/2 근방
    const half = TARGET_HEIGHT / 2;
    const shots = [
      { out: bust, w: 220, h: 260, top: half + 0.06, bottom: -0.05, pad: 1.15 },
      { out: full, w: 240, h: 400, top: half + 0.12, bottom: -half - 0.06, pad: 1.08 },
    ];

    for (const shot of shots) {
      const canvas = document.createElement('canvas');
      canvas.width = shot.w;
      canvas.height = shot.h;
      const renderer = new THREE.WebGLRenderer({
        canvas, alpha: true, antialias: true, preserveDrawingBuffer: true,
      });
      renderer.setSize(shot.w, shot.h, false);
      renderer.setClearColor(0x000000, 0);

      const centerY = (shot.top + shot.bottom) / 2;
      const halfH = ((shot.top - shot.bottom) / 2) * shot.pad;
      const fov = 32;
      const dist = halfH / Math.tan(THREE.MathUtils.degToRad(fov / 2));
      const camera = new THREE.PerspectiveCamera(fov, shot.w / shot.h, 0.1, 12);
      camera.position.set(0, centerY, dist);
      camera.lookAt(0, centerY, 0);

      for (const color of colors) {
        const visual = this.create(color);
        if (!visual) continue;
        visual.update(0.35, false, false); // idle 클립을 살짝 재생해 정지 포즈로
        scene.add(visual.group);
        renderer.render(scene, camera);
        shot.out.set(color, canvas.toDataURL('image/png'));
        scene.remove(visual.group);
      }
      renderer.dispose();
    }
    return { bust, full };
  }

  /**
   * 살아 움직이는 캐릭터 한 명을 DOM에 얹는다 — 결과 화면의 우승 세레모니처럼
   * 정지 이미지로는 안 되는 자리에 쓴다. 쓰고 나면 반드시 dispose() 할 것.
   * GLB가 없으면 null.
   */
  createStage(color: number, clipName: string): CharacterStage | null {
    const visual = this.create(color);
    const clip = this.clips.get(clipName);
    if (!visual || !clip) return null;
    return new CharacterStage(visual.group, clip);
  }
}

/** 캐릭터 하나를 자체 캔버스에 반복 재생하는 작은 무대 */
export class CharacterStage {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private mixer: THREE.AnimationMixer;
  private clock = new THREE.Clock();
  private raf = 0;
  private observer: ResizeObserver | null = null;

  constructor(group: THREE.Group, clip: THREE.AnimationClip) {
    this.canvas = document.createElement('canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);

    // 화려한 배경 위에 올라가므로 인게임보다 밝게 — 안 그러면 캐릭터가 배경에 묻힌다
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.9));
    const key = new THREE.DirectionalLight(0xfff2e0, 2.1);
    key.position.set(1.2, 2.4, 2.6);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xffd9a8, 1.1);
    rim.position.set(-1.8, 1.4, -1.6);
    this.scene.add(rim);
    this.scene.add(group);

    // 캐릭터 키에 딱 맞춘 화각 — 팔을 뻗는 동작을 감안해 15%만 여유를 둔다
    this.halfExtent = (TARGET_HEIGHT / 2) * 1.15;
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 20);
    this.camera.lookAt(0, 0, 0);

    this.mixer = new THREE.AnimationMixer(group);
    this.mixer.clipAction(clip).play();
  }

  private halfExtent: number;

  /**
   * 캔버스 픽셀 크기를 요소 실제 크기에 맞춘다.
   *
   * mount 직후엔 아직 레이아웃 전이라 clientWidth가 0일 수 있고, 그때 임의값으로
   * 버퍼를 잡으면 CSS가 그걸 늘려서 캐릭터가 납작해진다. ResizeObserver로 실제 크기가
   * 정해지는 시점에 맞춘다.
   */
  private fit(w: number, h: number) {
    if (w < 1 || h < 1) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // 가로가 좁으면 세로 화각만으로는 좌우가 잘린다 — 좁은 쪽 기준으로 거리를 잡는다
    const vFit = this.halfExtent / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const hFit = (this.halfExtent * 0.42) / Math.tan(THREE.MathUtils.degToRad(FOV / 2)) / this.camera.aspect;
    this.camera.position.set(0, 0, Math.max(vFit, hFit));
    this.camera.updateProjectionMatrix();
  }

  /** DOM에 붙이고 재생 시작 */
  mount(parent: HTMLElement) {
    parent.appendChild(this.canvas);
    this.observer = new ResizeObserver(([e]) => {
      const box = e.contentRect;
      this.fit(Math.round(box.width), Math.round(box.height));
    });
    this.observer.observe(parent);
    this.fit(parent.clientWidth, parent.clientHeight);

    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this.mixer.update(this.clock.getDelta());
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.observer?.disconnect();
    this.renderer.dispose();
    this.canvas.remove();
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
