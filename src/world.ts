/** 씬·카메라·조명·방(바닥/벽/가구) 구성 — 렌더링(Three)과 물리(Rapier)의 공통 무대 */

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

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

  constructor(container: HTMLElement) {
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
    const warm = new THREE.PointLight(0xffb86b, 30, 18);
    warm.position.set(-4, 3, -3);
    this.scene.add(warm);

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
    // 바닥 (러그 느낌 투톤)
    const floor = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, 0.3, ROOM_D), this.mat(0x8a6d55));
    floor.position.y = -0.15;
    floor.receiveShadow = true;
    this.scene.add(floor);
    const rug = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W * 0.55, 0.02, ROOM_D * 0.55), this.mat(0xb0485c));
    rug.position.y = 0.01;
    rug.receiveShadow = true;
    this.scene.add(rug);
    const floorBody = this.physics.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    this.floorCollider = this.physics.createCollider(
      RAPIER.ColliderDesc.cuboid(ROOM_W / 2, 0.15, ROOM_D / 2).setTranslation(0, -0.15, 0).setFriction(0.9),
      floorBody,
    );

    // 벽 — 시각용 낮은 벽 + 물리용 높은 벽
    const wallColor = 0x5e5378;
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

    // 가구 — 테이블 2개 (프롭이 올라가는 무대)
    this.staticBox(-4.2, 0.45, -2.8, 1.6, 0.45, 1.0, 0x9a7b4f);
    this.staticBox(4.5, 0.45, 2.2, 1.2, 0.45, 1.4, 0x9a7b4f);
    // 소파 (장식 겸 장애물)
    this.staticBox(0, 0.5, -4.9, 2.2, 0.5, 0.7, 0x7d4b68);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
