/**
 * 입력 — 한 대의 노트북을 둘이 나눠 쓴다. 키보드 2세트(좌: WASD / 우: 방향키).
 * 배치는 메뉴에서 리바인딩 가능하며 localStorage에 저장된다.
 * 게임 로직은 InputSource 인터페이스(getState)만 보므로 AI 봇도 같은 자리에 낀다.
 */

export interface InputState {
  moveX: number; // -1 ~ 1
  moveZ: number; // -1 ~ 1
  /** 그랩/던지기 버튼이 이번 프레임에 눌렸는가 (edge) */
  actionPressed: boolean;
  /** 현재 눌려 있는가 (level) */
  actionHeld: boolean;
  /** 점프 버튼 edge */
  jumpPressed: boolean;
}

export interface InputSource {
  readonly id: string;
  readonly label: string;
  getState(): InputState;
}

// ── 키보드 ──────────────────────────────────────────────

export interface KeyScheme {
  up: string; down: string; left: string; right: string;
  action: string; jump: string;
}

const DEFAULT_SCHEMES: KeyScheme[] = [
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', action: 'Space', jump: 'ShiftLeft' },
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', action: 'Enter', jump: 'ShiftRight' },
];

const SCHEME_KEYS: (keyof KeyScheme)[] = ['up', 'down', 'left', 'right', 'action', 'jump'];

const STORAGE_KEY = 'cozy-room-keys';

export function keyName(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num' + code.slice(6);
  const map: Record<string, string> = {
    Space: 'Space', Enter: 'Enter', ShiftLeft: 'LShift', ShiftRight: 'RShift',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    ControlLeft: 'LCtrl', ControlRight: 'RCtrl', Slash: '/', Period: '.', Comma: ',',
  };
  return map[code] ?? code;
}

function loadSchemes(): KeyScheme[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as KeyScheme[];
      if (
        Array.isArray(parsed) && parsed.length === DEFAULT_SCHEMES.length &&
        parsed.every((s) => SCHEME_KEYS.every((k) => typeof s[k] === 'string'))
      ) {
        return parsed;
      }
    }
  } catch { /* 무시하고 기본값 */ }
  return DEFAULT_SCHEMES.map((s) => ({ ...s }));
}

class KeyboardSource implements InputSource {
  readonly id: string;
  private prevAction = false;
  private prevJump = false;

  constructor(private scheme: KeyScheme, private keys: Set<string>, index: number) {
    this.id = `kb${index}`;
  }

  get label(): string {
    const s = this.scheme;
    return `${keyName(s.up)}${keyName(s.left)}${keyName(s.down)}${keyName(s.right)} 이동<br/>` +
      `잡기 ${keyName(s.action)} · 점프 ${keyName(s.jump)}`;
  }

  getState(): InputState {
    const s = this.scheme;
    const moveX = (this.keys.has(s.right) ? 1 : 0) - (this.keys.has(s.left) ? 1 : 0);
    const moveZ = (this.keys.has(s.down) ? 1 : 0) - (this.keys.has(s.up) ? 1 : 0);
    const held = this.keys.has(s.action);
    const actionPressed = held && !this.prevAction;
    this.prevAction = held;
    const jumpHeld = this.keys.has(s.jump);
    const jumpPressed = jumpHeld && !this.prevJump;
    this.prevJump = jumpHeld;
    return { moveX, moveZ, actionPressed, actionHeld: held, jumpPressed };
  }
}

// ── 매니저 ──────────────────────────────────────────────

const REBIND_STEPS: [keyof KeyScheme, string][] = [
  ['up', '위 이동'],
  ['down', '아래 이동'],
  ['left', '왼쪽 이동'],
  ['right', '오른쪽 이동'],
  ['action', '잡기/던지기'],
  ['jump', '점프'],
];

export class InputManager {
  private keys = new Set<string>();
  private sources: InputSource[] = [];
  readonly schemes: KeyScheme[];

  constructor() {
    this.schemes = loadSchemes();
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      // 스크롤·폼 기본 동작 차단 (2P가 방향키·Enter를 쓴다)
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    this.sources = this.schemes.map((scheme, i) => new KeyboardSource(scheme, this.keys, i));
  }

  allSources(): InputSource[] {
    return this.sources;
  }

  /**
   * 키 배치 리바인딩 — 안내 문구를 prompt로 내보내고 키 입력을 순서대로 받는다.
   * Escape로 중단(이미 입력한 키까지만 반영). 완료 시 localStorage에 저장.
   */
  async rebindScheme(index: number, prompt: (msg: string) => void): Promise<void> {
    const scheme = this.schemes[index];
    for (const [slot, name] of REBIND_STEPS) {
      prompt(`P${index + 1} — [${name}] 키를 누르세요 (Esc 중단)`);
      const code = await nextKeydown();
      if (code === 'Escape') break;
      scheme[slot] = code;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.schemes));
  }
}

function nextKeydown(): Promise<string> {
  return new Promise((resolve) => {
    window.addEventListener(
      'keydown',
      (e) => {
        e.preventDefault();
        resolve(e.code);
      },
      { once: true, capture: true },
    );
  });
}
