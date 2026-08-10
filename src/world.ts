/** 씬·카메라·조명·방(바닥/벽/가구) 구성 — 렌더링(Three)과 물리(Rapier)의 공통 무대 */

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Concept } from './themes';
import type { AssetLibrary } from './assets';

export const ROOM_W = 16; // x
export const ROOM_D = 12; // z
const WALL_VISIBLE_H = 1.4;
const WALL_PHYS_H = 6; // 보이지 않는 높은 벽으로 물건 이탈 방지
const WALL_T = 0.25;

/** 가구가 차지하는 바닥 영역 + 그 뒤 그림자 띠 — 프롭 스폰 배제에 쓰인다 */
export interface Footprint {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export class World3D {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  physics: RAPIER.World;
  eventQueue: RAPIER.EventQueue;
  floorCollider!: RAPIER.Collider;
  concept!: Concept;
  /** 프롭이 착지하면 안 되는 구역 (가구 발자국 + 그림자 띠) */
  footprints: Footprint[] = [];

  // ── 카메라 리그 — focusOn/resetFocus로 클로즈업 연출 ──
  private hemi!: THREE.HemisphereLight;
  private sun!: THREE.DirectionalLight;
  private warm!: THREE.PointLight;
  private spot!: THREE.SpotLight;
  private readonly homePos = new THREE.Vector3(0, 13.5, 12.5);
  private readonly homeLook = new THREE.Vector3(0, 0, -0.5);
  private posTarget = this.homePos.clone();
  private lookTarget = this.homeLook.clone();
  private lookCur = this.homeLook.clone();
  /** 진동 모드 — 남은 흔들림 시간과 세기 */
  private shakeTime = 0;
  private shakeMag = 0;
  /** 기본 조명 세기 — 정전에서 낮췄다가 되돌릴 때 기준이 된다 */
  private baseLight = { hemi: 0.75, sun: 1.6, warm: 30 };

  /** 창문 커튼 — 돌풍 세기에 따라 펄럭인다 */
  private curtains: THREE.Mesh[] = [];
  private curtainWind = 0;
  private curtainPhase = 0;

  /** 방을 다시 지을 때 걷어낼 것들 */
  private roomObjects: THREE.Object3D[] = [];
  private roomBodies: RAPIER.RigidBody[] = [];

  constructor(container: HTMLElement, private assets: AssetLibrary) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 100);
    this.camera.position.copy(this.homePos);
    this.camera.lookAt(this.homeLook);

    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });

    // 조명 — 아늑한 방 분위기. 색은 UI 팔레트(--cream/--lamp)에 맞춘다
    this.hemi = new THREE.HemisphereLight(0xfff2dd, 0x2a201a, this.baseLight.hemi);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffe8c8, this.baseLight.sun);
    this.sun.position.set(6, 12, 5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -12;
    this.sun.shadow.camera.right = 12;
    this.sun.shadow.camera.top = 12;
    this.sun.shadow.camera.bottom = -12;
    this.scene.add(this.sun);
    this.warm = new THREE.PointLight(0xf0a94c, this.baseLight.warm, 18);
    this.warm.position.set(-4, 3, -3);
    this.scene.add(this.warm);

    // 클로즈업 연출용 스포트라이트 (평소 꺼짐)
    this.spot = new THREE.SpotLight(0xfff1cc, 260, 14, Math.PI / 7, 0.45);
    this.spot.visible = false;
    this.spot.target = new THREE.Object3D();
    this.scene.add(this.spot);
    this.scene.add(this.spot.target);

    this.physics = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.eventQueue = new RAPIER.EventQueue(true);
  }

  // ── 방 짓기 ──

  /** 라운드마다 콘셉트가 바뀌므로 방을 통째로 다시 짓는다 */
  setConcept(concept: Concept) {
    this.clearRoom();
    this.concept = concept;
    this.scene.background = new THREE.Color(concept.shade);
    this.scene.fog = new THREE.Fog(concept.shade, 26, 44);
    this.warm.color.set(concept.glow);
    this.buildRoom();
  }

  private clearRoom() {
    for (const o of this.roomObjects) {
      this.scene.remove(o);
      o.traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.isMesh) m.geometry.dispose();
      });
    }
    for (const b of this.roomBodies) this.physics.removeRigidBody(b);
    this.roomObjects = [];
    this.roomBodies = [];
    this.footprints = [];
    this.curtains = [];
  }

  private track<T extends THREE.Object3D>(obj: T): T {
    this.scene.add(obj);
    this.roomObjects.push(obj);
    return obj;
  }

  /** 시각 메쉬 없이 물리 벽만. 물건이 방 밖으로 새는 걸 막는다 */
  private staticBox(x: number, y: number, z: number, hx: number, hy: number, hz: number) {
    const body = this.physics.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));
    this.physics.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setFriction(0.9), body);
    this.roomBodies.push(body);
    return body;
  }

  private buildRoom() {
    const c = this.concept;

    // ── 바닥 ──
    const floorMat = new THREE.MeshStandardMaterial({
      map: this.assets.tiled(c.floorTex, ROOM_W / 4, ROOM_D / 4),
      roughness: 0.9,
    });
    const floor = this.track(new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), floorMat));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;

    const floorBody = this.physics.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    this.floorCollider = this.physics.createCollider(
      RAPIER.ColliderDesc.cuboid(ROOM_W / 2, 0.15, ROOM_D / 2)
        .setTranslation(0, -0.15, 0)
        .setFriction(0.9),
      floorBody,
    );
    this.roomBodies.push(floorBody);

    // ── 러그 — 알파 텍스처라 술 장식 사이로 바닥이 비친다 ──
    if (c.rug) {
      const rugMat = new THREE.MeshStandardMaterial({
        map: this.assets.texture(c.rug.tex),
        transparent: true,
        alphaTest: 0.35,
        roughness: 0.95,
      });
      const rug = this.track(new THREE.Mesh(new THREE.PlaneGeometry(c.rug.w, c.rug.d), rugMat));
      rug.rotation.x = -Math.PI / 2;
      rug.position.y = 0.012; // z-fighting 회피
      rug.receiveShadow = true;
    }

    // ── 벽 — 보이는 낮은 벽(텍스처) + 보이지 않는 높은 물리 벽 ──
    const wallMat = (w: number) =>
      new THREE.MeshStandardMaterial({
        map: this.assets.tiled(c.wallTex, w / 3, 1),
        roughness: 0.95,
      });
    const wall = (x: number, y: number, z: number, w: number, h: number, rotY: number) => {
      const m = this.track(new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat(w)));
      m.position.set(x, y, z);
      m.rotation.y = rotY;
      m.receiveShadow = true;
    };
    const halfW = ROOM_W / 2;
    const halfD = ROOM_D / 2;
    // 뒷벽(카메라 반대편)만 제 높이로 보인다. 앞벽은 시야를 막지 않게 낮게 깐다
    wall(0, WALL_VISIBLE_H / 2, -halfD, ROOM_W, WALL_VISIBLE_H, 0);
    wall(0, 0.35 / 2, halfD, ROOM_W, 0.35, Math.PI);
    wall(-halfW, WALL_VISIBLE_H / 2, 0, ROOM_D, WALL_VISIBLE_H, Math.PI / 2);
    wall(halfW, WALL_VISIBLE_H / 2, 0, ROOM_D, WALL_VISIBLE_H, -Math.PI / 2);

    for (const [x, z, hx, hz] of [
      [0, -halfD - WALL_T, halfW + WALL_T * 2, WALL_T],
      [0, halfD + WALL_T, halfW + WALL_T * 2, WALL_T],
      [-halfW - WALL_T, 0, WALL_T, halfD],
      [halfW + WALL_T, 0, WALL_T, halfD],
    ] as const) {
      this.staticBox(x, WALL_PHYS_H / 2, z, hx, WALL_PHYS_H / 2, hz);
    }

    // ── 벽 데칼(창문 등) — 깊이가 없는 것은 평면으로 붙인다 ──
    for (const d of c.decals) {
      const mat = new THREE.MeshStandardMaterial({
        map: this.assets.texture(d.tex),
        transparent: true,
        alphaTest: 0.4,
        roughness: 0.9,
      });
      const plane = this.track(new THREE.Mesh(new THREE.PlaneGeometry(d.w, d.h), mat));
      plane.position.set(d.x, d.y, d.z);
      plane.rotation.y = d.rotY ?? 0;
    }

    // ── 커튼 — 창문 양옆. 윗변을 축으로 흔들리도록 지오메트리를 위로 밀어 둔다 ──
    if (c.curtain) {
      const cu = c.curtain;
      const mat = new THREE.MeshStandardMaterial({
        color: cu.color,
        roughness: 1,
        side: THREE.DoubleSide,
      });
      for (const side of [-1, 1]) {
        const geo = new THREE.PlaneGeometry(cu.w, cu.h, 1, 4);
        geo.translate(0, -cu.h / 2, 0); // 피벗을 윗변으로
        const panel = this.track(new THREE.Mesh(geo, mat));
        panel.position.set(cu.x + side * (cu.w / 2 + 0.55), cu.y, cu.z);
        panel.castShadow = true;
        this.curtains.push(panel);
      }
    }

    // ── 가구 — 시각은 GLB, 물리는 손으로 적은 박스 ──
    for (const f of c.furniture) {
      const mesh = this.assets.instantiateFurniture(f);
      mesh.position.set(f.x, 0, f.z);
      this.track(mesh);
      this.staticBox(f.x, f.hy, f.z, f.hx, f.hy, f.hz);

      // 화로대처럼 스스로 빛나는 가구 — track()이 정리까지 맡으므로 별도 해제가 필요 없다
      if (f.glow) {
        const light = this.track(
          new THREE.PointLight(f.glow.color, f.glow.intensity, f.glow.distance),
        );
        light.position.set(f.x, f.glow.y, f.z);
      }

      // 그림자는 항상 -z 방향으로 가구 높이만큼 늘어난다. 그 띠까지 스폰을 막아야
      // 프롭이 가구 뒤에 숨는 일이 생기지 않는다
      const shadow = f.hy * 2;
      this.footprints.push({
        minX: f.x - f.hx,
        maxX: f.x + f.hx,
        minZ: f.z - f.hz - shadow,
        maxZ: f.z + f.hz,
      });
    }
  }

  // ── 연출 ──

  /** 특정 지점 클로즈업 — 스포트라이트 켜고 주변광을 낮춰 극적 연출 */
  focusOn(p: THREE.Vector3) {
    this.posTarget.set(p.x, p.y + 3.2, p.z + 3.8);
    this.lookTarget.copy(p);
    this.spot.position.set(p.x, p.y + 5.5, p.z + 0.6);
    this.spot.target.position.copy(p);
    this.spot.visible = true;
    this.applyLight(0.22);
  }

  resetFocus() {
    this.posTarget.copy(this.homePos);
    this.lookTarget.copy(this.homeLook);
    this.spot.visible = false;
    this.applyLight(1);
  }

  /** 정전 — 메인 조명을 낮춘다. 창문발 보조광과 개인 광원만 남는다 */
  setDim(factor: number) {
    this.applyLight(factor);
  }

  private applyLight(factor: number) {
    this.hemi.intensity = this.baseLight.hemi * factor;
    this.sun.intensity = this.baseLight.sun * factor;
    this.warm.intensity = this.baseLight.warm * factor;
  }

  /** 돌풍 세기 (0 = 평상시 미세한 흔들림, 1 = 강풍) */
  setCurtainWind(strength: number) {
    this.curtainWind = strength;
  }

  /** 커튼처럼 매 프레임 살아 움직이는 것들 */
  updateScene(dt: number) {
    if (this.curtains.length === 0) return;
    this.curtainPhase += dt * (2.2 + this.curtainWind * 4);
    const amp = 0.05 + this.curtainWind * 0.55;
    this.curtains.forEach((panel, i) => {
      panel.rotation.x = Math.sin(this.curtainPhase + i * 1.3) * amp;
    });
  }

  /** 진동 모드의 "쿵" — 짧고 굵게 흔든다 */
  shake(magnitude: number, duration = 0.15) {
    this.shakeMag = magnitude;
    this.shakeTime = duration;
  }

  /** 매 프레임 카메라를 목표 위치·시선으로 부드럽게 보간 */
  updateCamera(dt: number) {
    const k = 1 - Math.pow(0.004, dt);
    this.camera.position.lerp(this.posTarget, k);
    this.lookCur.lerp(this.lookTarget, k);
    this.camera.lookAt(this.lookCur);

    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const s = this.shakeMag * Math.max(0, this.shakeTime / 0.15);
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
