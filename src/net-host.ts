/**
 * 호스트 세션 — 게스트 입력 수신, 스냅샷 송출(20Hz), UI/사운드/카메라 중계.
 * 게임 로직은 전부 호스트 브라우저에서 돈다 (호스트 권위).
 */

import type { NetChannel, WireInput, Snapshot } from './net';
import type { InputSource, InputState } from './input';
import type { UI } from './ui';
import type { World3D } from './world';
import { sfx } from './sound';

/** 원격 게스트의 입력 — 마지막 수신 상태 + 카운터로 edge 복원 */
export class RemoteInputSource implements InputSource {
  readonly id: string;
  readonly label = '온라인 게스트';
  private latest: WireInput = { mx: 0, mz: 0, a: 0, ac: 0, jc: 0 };
  private seenAc = 0;
  private seenJc = 0;
  connected = true;

  constructor(guestId: number) {
    this.id = `net${guestId}`;
  }

  push(input: WireInput) {
    this.latest = input;
  }

  getState(): InputState {
    if (!this.connected) return { moveX: 0, moveZ: 0, actionPressed: false, actionHeld: false, jumpPressed: false };
    const w = this.latest;
    const actionPressed = w.ac > this.seenAc;
    if (actionPressed) this.seenAc = w.ac;
    const jumpPressed = w.jc > this.seenJc;
    if (jumpPressed) this.seenJc = w.jc;
    return {
      moveX: w.mx,
      moveZ: w.mz,
      actionPressed,
      actionHeld: w.a === 1,
      jumpPressed,
    };
  }
}

/** 게스트에게 중계할 UI 메서드 — 고빈도 호출은 인자 변경 시에만 전송 */
const RELAYED_UI = new Set([
  'showTopic', 'minifyTopic', 'hideTopic', 'setTimer', 'setHud',
  'showEvent', 'pulseEvent', 'hideEvent',
  'showJudgePanel', 'addVerdict', 'hideJudgePanel',
  'showResults', 'hideResults', 'showTada', 'hideTada', 'showMenu', 'hideMenu',
]);
const DEDUPED_UI = new Set(['setTimer', 'setHud', 'showMenu']);

export interface HostHooks {
  /** 로비 상태면 원격 플레이어 추가 후 playerId, 아니면 null */
  addRemotePlayer(source: RemoteInputSource): number | null;
  buildSnapshot(): Snapshot;
  themeId: string;
  onGuestLeft(source: RemoteInputSource): void;
}

export class HostSession {
  private guests = new Map<number, RemoteInputSource>();
  private snapTimer: ReturnType<typeof setInterval>;

  constructor(private channel: NetChannel, private hooks: HostHooks) {
    channel.on('guest-joined', (m) => this.onGuestJoined(m.guestId as number));
    channel.on('input', (m) => {
      this.guests.get(m.guestId as number)?.push(m.s as WireInput);
    });
    channel.on('guest-left', (m) => {
      const src = this.guests.get(m.guestId as number);
      if (src) {
        src.connected = false;
        this.hooks.onGuestLeft(src);
      }
    });
    this.snapTimer = setInterval(() => {
      if (this.guests.size > 0) {
        channel.send({ t: 'state', s: this.hooks.buildSnapshot() });
      }
    }, 50);
  }

  private onGuestJoined(guestId: number) {
    const source = new RemoteInputSource(guestId);
    const playerId = this.hooks.addRemotePlayer(source);
    if (playerId === null) {
      this.channel.send({ t: 'ev', to: guestId, e: { op: 'busy' } });
      return;
    }
    this.guests.set(guestId, source);
    this.channel.send({ t: 'ev', to: guestId, e: { op: 'init', theme: this.hooks.themeId } });
    this.channel.send({ t: 'ev', to: guestId, e: { op: 'assign', playerId } });
  }

  sendOp(e: Record<string, unknown>) {
    this.channel.send({ t: 'ev', e });
  }

  guestCount(): number {
    return this.guests.size;
  }

  dispose() {
    clearInterval(this.snapTimer);
  }
}

/** UI 프록시 — 로컬 호출 + 게스트 중계 (고빈도 메서드는 변경 시에만) */
export function wrapUIForHost(ui: UI, session: HostSession): UI {
  const cache = new Map<string, string>();
  return new Proxy(ui, {
    get(target, prop: string) {
      const orig = (target as unknown as Record<string, unknown>)[prop];
      if (typeof orig !== 'function') return orig;
      const bound = (orig as (...a: unknown[]) => unknown).bind(target);
      if (!RELAYED_UI.has(prop)) return bound;
      return (...args: unknown[]) => {
        let skip = false;
        if (DEDUPED_UI.has(prop)) {
          const key = prop === 'setTimer' && typeof args[0] === 'number'
            ? String(Math.ceil(args[0] as number))
            : JSON.stringify(args);
          if (cache.get(prop) === key) skip = true;
          else cache.set(prop, key);
        }
        if (!skip) session.sendOp({ op: 'ui', m: prop, a: args });
        return bound(...args);
      };
    },
  }) as UI;
}

const RELAYED_SFX = [
  'grab', 'throw', 'bonk', 'tick', 'buzzer', 'gust', 'reveal',
  'fanfare', 'rip', 'drumroll', 'tada', 'jump', 'whistle', 'explode',
] as const;

/** 호스트에서 나는 효과음을 게스트에게도 중계 */
export function patchSfxForHost(session: HostSession) {
  const s = sfx as unknown as Record<string, (...a: unknown[]) => void>;
  for (const name of RELAYED_SFX) {
    const orig = s[name].bind(sfx);
    s[name] = (...args: unknown[]) => {
      session.sendOp({ op: 'sfx', m: name, a: args });
      orig(...args);
    };
  }
}

/** 클로즈업 카메라 이동을 게스트에게도 중계 */
export function patchCameraForHost(world: World3D, session: HostSession) {
  const origFocus = world.focusOn.bind(world);
  const origReset = world.resetFocus.bind(world);
  world.focusOn = (p) => {
    session.sendOp({ op: 'cam', f: [p.x, p.y, p.z] });
    origFocus(p);
  };
  world.resetFocus = () => {
    session.sendOp({ op: 'cam', f: null });
    origReset();
  };
}
