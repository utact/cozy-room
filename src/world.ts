/** 씬·카메라·조명·방(바닥/벽/가구) 구성 — 렌더링(Three)과 물리(Rapier)의 공통 무대 */

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { pickTheme, type RoomTheme } from './themes';

export const ROOM_W = 16; // x
export const ROOM_D = 12; // z
const WALL_VISIBLE_H = 1.4;
const WALL_PHYS_H = 6; // 보이지 않는 높은 벽으로 물건 이탈 방지

export class World3D {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  physics: RAPIER.World;
  eventQueue: RAPIER.EventQueue;
  floorCollider!: RAPIER.Collider;
  theme: RoomTheme;

  // ── 카메라 리그 — focusOn/resetFocus로 클로즈업 연출 ──
  private hemi!: THREE.HemisphereLight;
  private sun!: THREE.DirectionalLight;
  private spot!: THREE.SpotLight;
  private readonly homePos = new THREE.Vector3(0, 13.5, 12.5);
  private readonly homeLook = new THREE.Vector3(0, 0, -0.5);
  private posTarget = this.homePos.clone();
  private lookTarget = this.homeLook.clone();
  private lookCur = this.homeLook.clone();

  constructor(container: HTMLElement, themeId?: string) {
    this.theme = pickTheme(themeId);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x241f38);
    this.scene.fog = new THREE.Fog(0x241f38, 26, 44);

    this.camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 100);
    this.camera.position.set(0, 13.5, 12.5);
    this.camera.lookAt(0, 0, -0.5);

    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });

    // 조명 — 아늑한 방 분위기
    this.scene.add(new THREE.HemisphereLight(0xfff2dd, 0x353050, 0.75));
    const sun = new THREE.DirectionalLight(0xffe8c8, 1.6);
    sun.position.set(6, 12, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -12;
    sun.shadow.camera.right = 12;
    sun.shadow.camera.top = 12;
    sun.shadow.camera.bottom = -12;
    this.scene.add(sun);
    const warm = new THREE.PointLight(this.theme.glow, 30, 18);
    warm.position.set(-4, 3, -3);
    this.scene.add(warm);
    this.hemi = this.scene.children.find((c) => c instanceof THREE.HemisphereLight) as THREE.HemisphereLight;
    this.sun = sun;

    // 클로즈업 연출용 스포트라이트 (평소 꺼짐)
    this.spot = new THREE.SpotLight(0xfff1cc, 260, 14, Math.PI / 7, 0.45);
    this.spot.visible = false;
    this.spot.target = new THREE.Object3D();
    this.scene.add(this.spot);
    this.scene.add(this.spot.target);

    // 물리 월드
    this.physics = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.eventQueue = new RAPIER.EventQueue(true);

    this.buildRoom();
  }

  private mat(color: number) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  }

  private staticBox(x: number, y: number, z: number, hx: number, hy: number, hz: number, color?: number) {
    const body = this.physics.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));
    this.physics.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setFriction(0.9), body);
    if (color !== undefined) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2), this.mat(color));
      mesh.position.set(x, y, z);
      mesh.castShadow = mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
  }

  private buildRoom() {
    const theme = this.theme;
    // 바닥 (테마 팔레트)
    const floor = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, 0.3, ROOM_D), this.mat(theme.floor));
    floor.position.y = -0.15;
    floor.receiveShadow = true;
    this.scene.add(floor);
    if (theme.rug !== null) {
      const rug = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W * 0.55, 0.02, ROOM_D * 0.55), this.mat(theme.rug));
      rug.position.y = 0.01;
      rug.receiveShadow = true;
      this.scene.add(rug);
    }
    const floorBody = this.physics.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    this.floorCollider = this.physics.createCollider(
      RAPIER.ColliderDesc.cuboid(ROOM_W / 2, 0.15, ROOM_D / 2).setTranslation(0, -0.15, 0).setFriction(0.9),
      floorBody,
    );

    // 벽 — 시각용 낮은 벽 + 물리용 높은 벽
    const wallColor = theme.wall;
    const t = 0.25;
    // 뒤 (카메라 반대편)
    this.staticBox(0, WALL_VISIBLE_H / 2, -ROOM_D / 2 - t, ROOM_W / 2 + t * 2, WALL_VISIBLE_H / 2, t, wallColor);
    this.staticBox(0, WALL_PHYS_H / 2, -ROOM_D / 2 - t, ROOM_W / 2 + t * 2, WALL_PHYS_H / 2, t);
    // 앞 (시각 벽은 얇고 낮게 — 시야 확보)
    this.staticBox(0, 0.35, ROOM_D / 2 + t, ROOM_W / 2 + t * 2, 0.35, t, wallColor);
    this.staticBox(0, WALL_PHYS_H / 2, ROOM_D / 2 + t, ROOM_W / 2 + t * 2, WALL_PHYS_H / 2, t);
    // 좌우
    this.staticBox(-ROOM_W / 2 - t, WALL_VISIBLE_H / 2, 0, t, WALL_VISIBLE_H / 2, ROOM_D / 2, wallColor);
    this.staticBox(-ROOM_W / 2 - t, WALL_PHYS_H / 2, 0, t, WALL_PHYS_H / 2, ROOM_D / 2);
    this.staticBox(ROOM_W / 2 + t, WALL_VISIBLE_H / 2, 0, t, WALL_VISIBLE_H / 2, ROOM_D / 2, wallColor);
    this.staticBox(ROOM_W / 2 + t, WALL_PHYS_H / 2, 0, t, WALL_PHYS_H / 2, ROOM_D / 2);

    // 가구 — 테마별 배치 (프롭이 올라가는 무대 겸 장애물)
    for (const f of theme.furniture) {
      this.staticBox(f.x, f.hy, f.z, f.hx, f.hy, f.hz, f.color);
    }
  }

  /** 특정 지점 클로즈업 — 스포트라이트 켜고 주변광을 낮춰 극적 연출 */
  focusOn(p: THREE.Vector3) {
    this.posTarget.set(p.x, p.y + 3.2, p.z + 3.8);
    this.lookTarget.copy(p);
    this.spot.position.set(p.x, p.y + 5.5, p.z + 0.6);
    this.spot.target.position.copy(p);
    this.spot.visible = true;
    this.hemi.intensity = 0.18;
    this.sun.intensity = 0.35;
  }

  resetFocus() {
    this.posTarget.copy(this.homePos);
    this.lookTarget.copy(this.homeLook);
    this.spot.visible = false;
    this.hemi.intensity = 0.75;
    this.sun.intensity = 1.6;
  }

  /** 매 프레임 카메라를 목표 위치·시선으로 부드럽게 보간 */
  updateCamera(dt: number) {
    const k = 1 - Math.pow(0.004, dt);
    this.camera.position.lerp(this.posTarget, k);
    this.lookCur.lerp(this.lookTarget, k);
    this.camera.lookAt(this.lookCur);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
