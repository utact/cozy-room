/**
 * 입력 — 로컬 동일화면 2~4인.
 * 게임패드 우선(연결된 패드 = 플레이어 후보), 키보드 2세트 폴백.
 * 온라인 확장 대비: 게임 로직은 InputSource 인터페이스(getState)만 본다.
 */

export interface InputState {
  moveX: number; // -1 ~ 1
  moveZ: number; // -1 ~ 1
  /** 그랩/던지기 버튼이 이번 프레임에 눌렸는가 (edge) */
  actionPressed: boolean;
  /** 현재 눌려 있는가 (level) */
  actionHeld: boolean;
}

export interface InputSource {
  readonly id: string;
  readonly label: string;
  getState(): InputState;
}

// ── 키보드 ──────────────────────────────────────────────

interface KeyScheme {
  up: string; down: string; left: string; right: string; action: string;
  label: string;
}

const KEY_SCHEMES: KeyScheme[] = [
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', action: 'Space', label: 'WASD + Space' },
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', action: 'Enter', label: '방향키 + Enter' },
];

class KeyboardSource implements InputSource {
  readonly id: string;
  readonly label: string;
  private prevAction = false;

  constructor(private scheme: KeyScheme, private keys: Set<string>, index: number) {
    this.id = `kb${index}`;
    this.label = scheme.label;
  }

  getState(): InputState {
    const s = this.scheme;
    const moveX = (this.keys.has(s.right) ? 1 : 0) - (this.keys.has(s.left) ? 1 : 0);
    const moveZ = (this.keys.has(s.down) ? 1 : 0) - (this.keys.has(s.up) ? 1 : 0);
    const held = this.keys.has(s.action);
    const pressed = held && !this.prevAction;
    this.prevAction = held;
    return { moveX, moveZ, actionPressed: pressed, actionHeld: held };
  }
}

// ── 게임패드 ────────────────────────────────────────────

const AXIS_DEADZONE = 0.22;

class GamepadSource implements InputSource {
  readonly id: string;
  readonly label: string;
  private prevAction = false;

  constructor(private index: number) {
    this.id = `pad${index}`;
    this.label = `게임패드 ${index + 1}`;
  }

  getState(): InputState {
    const pad = navigator.getGamepads()[this.index];
    if (!pad) return { moveX: 0, moveZ: 0, actionPressed: false, actionHeld: false };
    const dz = (v: number) => (Math.abs(v) < AXIS_DEADZONE ? 0 : v);
    let moveX = dz(pad.axes[0] ?? 0);
    let moveZ = dz(pad.axes[1] ?? 0);
    // 디지털 패드 폴백
    if (pad.buttons[14]?.pressed) moveX = -1;
    if (pad.buttons[15]?.pressed) moveX = 1;
    if (pad.buttons[12]?.pressed) moveZ = -1;
    if (pad.buttons[13]?.pressed) moveZ = 1;
    const held = !!(pad.buttons[0]?.pressed || pad.buttons[1]?.pressed);
    const pressed = held && !this.prevAction;
    this.prevAction = held;
    return { moveX, moveZ, actionPressed: pressed, actionHeld: held };
  }
}

// ── 매니저 ──────────────────────────────────────────────

export class InputManager {
  private keys = new Set<string>();
  private sources = new Map<string, InputSource>();

  constructor() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      // 스크롤 등 브라우저 기본 동작 방지
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    KEY_SCHEMES.forEach((scheme, i) => {
      const src = new KeyboardSource(scheme, this.keys, i);
      this.sources.set(src.id, src);
    });
    window.addEventListener('gamepadconnected', (e) => {
      const src = new GamepadSource(e.gamepad.index);
      this.sources.set(src.id, src);
    });
    // 페이지 로드 전에 이미 연결된 패드
    for (const pad of navigator.getGamepads()) {
      if (pad) {
        const src = new GamepadSource(pad.index);
        this.sources.set(src.id, src);
      }
    }
  }

  /** 참가 대기 중 아무 소스에서 액션이 눌렸는지 — 메뉴 조인용 */
  allSources(): InputSource[] {
    return [...this.sources.values()];
  }
}
