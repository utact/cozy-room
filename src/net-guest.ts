/**
 * 온라인 게스트 — 물리 없이 호스트 스냅샷을 미러링하고 입력만 보낸다.
 * ?join=CODE 로 진입하면 main.ts가 Game 대신 이 앱을 띄운다.
 */

import * as THREE from 'three';
import { World3D } from './world';
import { UI } from './ui';
import { InputManager } from './input';
import { NetChannel, type Snapshot, type NetOp, type WireInput } from './net';
import { VoiceChat } from './voice';
import { PROP_CATALOG } from './catalog';
import { PLAYER_COLORS } from './player';
import {
  createPlayerVisual, poseArms, buildProceduralVisual, buildArmVisual,
  buildAuraRing, cloakObject, uncloakObject, type PlayerVisual,
} from './visuals';
import { sfx } from './sound';

interface PlayerMirror {
  vis: PlayerVisual;
  ring: THREE.Mesh;
  targetPos: THREE.Vector3;
  targetYaw: number;
  held: boolean;
}

interface PropMirror {
  obj: THREE.Object3D;
  aura: THREE.Mesh | null;
  targetPos: THREE.Vector3;
  targetQuat: THREE.Quaternion;
  saved: Map<THREE.Mesh, THREE.Material | THREE.Material[]>;
  cloaked: boolean;
}

export class GuestApp {
  private world!: World3D;
  private ui!: UI;
  private input = new InputManager();
  private channel!: NetChannel;
  private voice!: VoiceChat;
  private players = new Map<number, PlayerMirror>();
  private props = new Map<number, PropMirror>();
  /** 호스트가 배정한 내 플레이어 번호 (디버그·표시용) */
  myPlayerId = -1;
  private roomCode = '';
  private ac = 0;
  private jc = 0;
  private time = 0;

  constructor(private container: HTMLElement, private relayUrl: string, private code: string) {}

  async start() {
    this.ui = new UI(this.container);
    this.ui.showOverlay('접속 중…', `방 코드 ${this.code}`);
    try {
      this.channel = await NetChannel.connect(this.relayUrl);
      const { guestId, peers } = await this.channel.joinRoom(this.code);
      this.roomCode = this.code.toUpperCase();
      this.voice = new VoiceChat(this.channel, guestId);
      this.voice.onStateChange = (s, n) => this.ui.setVoiceState(s, n);
      this.ui.initVoiceChip(() => this.voice.toggle());
      window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyV') this.voice.toggle();
      });
      this.voice.connectToPeers(peers);
      this.wireChannel();
      this.ui.showOverlay('접속 완료', '호스트의 게임 정보를 기다리는 중…');
    } catch (err) {
      this.ui.showOverlay('접속 실패', String(err instanceof Error ? err.message : err));
      return;
    }
  }

  private wireChannel() {
    this.channel.on('ev', (m) => this.applyOp(m.e as NetOp));
    this.channel.on('state', (m) => this.applySnapshot(m.s as Snapshot));
    this.channel.on('host-left', () => {
      this.ui.showOverlay('호스트가 나갔습니다', '방이 종료되었습니다. 새 방 코드로 다시 접속해 주세요.');
    });
    this.channel.onClose(() => {
      this.ui.showOverlay('연결이 끊겼습니다', '네트워크를 확인하고 새로고침해 주세요.');
    });
  }

  private applyOp(op: NetOp) {
    switch (op.op) {
      case 'init':
        if (!this.world) {
          this.world = new World3D(this.container, op.theme);
          this.ui.hideOverlay();
          this.startLoops();
        }
        break;
      case 'assign':
        this.myPlayerId = op.playerId;
        this.ui.setOnlineStatus(
          `<b>온라인</b> 방 <span class="code">${this.roomCode}</span><br/>당신은 <b>${op.playerId + 1}P</b> 입니다`,
        );
        break;
      case 'busy':
        this.ui.showOverlay('입장 불가', '게임이 이미 진행 중이거나 방이 가득 찼습니다.');
        break;
      case 'ui': {
        const fn = (this.ui as unknown as Record<string, unknown>)[op.m];
        if (typeof fn === 'function') (fn as (...a: unknown[]) => void).apply(this.ui, op.a);
        break;
      }
      case 'sfx': {
        const fn = (sfx as unknown as Record<string, unknown>)[op.m];
        if (typeof fn === 'function') (fn as (...a: unknown[]) => void).apply(sfx, op.a);
        break;
      }
      case 'cam':
        if (!this.world) break;
        if (op.f) this.world.focusOn(new THREE.Vector3(...op.f));
        else this.world.resetFocus();
        break;
    }
  }

  // ── 스냅샷 적용 ──────────────────────────────────────

  private applySnapshot(s: Snapshot) {
    if (!this.world) return;
    for (const sp of s.pl) {
      let m = this.players.get(sp.i);
      if (!m) {
        const vis = createPlayerVisual(PLAYER_COLORS[sp.i]);
        this.world.scene.add(vis.group);
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.42, 0.55, 24),
          new THREE.MeshBasicMaterial({
            color: PLAYER_COLORS[sp.i], transparent: true, opacity: 0.75,
            side: THREE.DoubleSide, depthWrite: false,
          }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.visible = false;
        this.world.scene.add(ring);
        m = { vis, ring, targetPos: new THREE.Vector3(), targetYaw: 0, held: false };
        this.players.set(sp.i, m);
      }
      m.targetPos.set(...sp.p);
      m.targetYaw = sp.yw;
      m.held = sp.hd === 1;
      m.vis.arms.L.visible = !sp.ms.includes('L');
      m.vis.stubs.L.visible = sp.ms.includes('L');
      m.vis.arms.R.visible = !sp.ms.includes('R');
      m.vis.stubs.R.visible = sp.ms.includes('R');
      if (sp.ind !== 0) {
        m.ring.position.set(sp.ind[0], 0.04 + sp.i * 0.012, sp.ind[1]);
        m.ring.visible = true;
      } else {
        m.ring.visible = false;
      }
    }

    const seen = new Set<number>();
    for (const pp of s.pr) {
      seen.add(pp.k);
      let m = this.props.get(pp.k);
      if (!m) {
        let obj: THREE.Object3D;
        let aura: THREE.Mesh | null = null;
        if (pp.id.startsWith('arm-')) {
          obj = buildArmVisual(pp.au);
          aura = buildAuraRing(pp.au);
          this.world.scene.add(aura);
        } else {
          const meta = PROP_CATALOG.find((c) => c.id === pp.id);
          obj = meta ? buildProceduralVisual(meta) : new THREE.Object3D();
        }
        this.world.scene.add(obj);
        m = {
          obj, aura,
          targetPos: new THREE.Vector3(...pp.p),
          targetQuat: new THREE.Quaternion(...pp.q),
          saved: new Map(), cloaked: false,
        };
        m.obj.position.copy(m.targetPos);
        this.props.set(pp.k, m);
      }
      m.targetPos.set(...pp.p);
      m.targetQuat.set(...pp.q);
      if (pp.cl === 1 && !m.cloaked) {
        cloakObject(m.obj, m.saved);
        m.cloaked = true;
      } else if (pp.cl === 0 && m.cloaked) {
        uncloakObject(m.obj, m.saved);
        m.cloaked = false;
      }
    }
    for (const [k, m] of this.props) {
      if (!seen.has(k)) {
        this.world.scene.remove(m.obj);
        if (m.aura) this.world.scene.remove(m.aura);
        this.props.delete(k);
      }
    }
  }

  // ── 렌더/입력 루프 ──────────────────────────────────

  private startLoops() {
    let last = performance.now();
    let inputTick = 0;
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      this.time += dt;
      const k = 1 - Math.pow(0.0001, dt); // 스냅샷(20Hz) 보간 계수

      for (const m of this.players.values()) {
        m.vis.group.position.lerp(m.targetPos, k);
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), m.targetYaw);
        m.vis.group.quaternion.slerp(q, k);
        poseArms(m.vis.arms, m.held);
      }
      for (const m of this.props.values()) {
        m.obj.position.lerp(m.targetPos, k);
        m.obj.quaternion.slerp(m.targetQuat, k);
        if (m.aura) {
          m.aura.position.set(m.obj.position.x, 0.05, m.obj.position.z);
          const s = 1 + 0.18 * Math.sin(this.time * 5.5);
          m.aura.scale.set(s, s, 1);
        }
      }

      // 입력 송신 (30Hz)
      inputTick += dt;
      if (inputTick >= 1 / 30) {
        inputTick = 0;
        this.sendInput();
      }

      this.world.updateCamera(dt);
      this.world.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /** 연결된 모든 로컬 입력(키보드 2세트+패드)을 합쳐 하나의 플레이어 입력으로 */
  private sendInput() {
    let mx = 0;
    let mz = 0;
    let held = false;
    for (const src of this.input.allSources()) {
      const st = src.getState();
      mx += st.moveX;
      mz += st.moveZ;
      held = held || st.actionHeld;
      if (st.actionPressed) this.ac++;
      if (st.jumpPressed) this.jc++;
    }
    const wire: WireInput = {
      mx: Math.max(-1, Math.min(1, mx)),
      mz: Math.max(-1, Math.min(1, mz)),
      a: held ? 1 : 0,
      ac: this.ac,
      jc: this.jc,
    };
    this.channel.send({ t: 'input', s: wire });
  }
}
