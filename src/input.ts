/**
 * 입력 — 한 대의 노트북을 둘이 나눠 쓴다. 키보드 2세트(좌: WASD / 우: 방향키), 고정 배치.
 *
 * 한 사람당 키는 이동 4개 + 잡기/던지기 1개가 전부다. 점프는 뺐다 — 노트북 하나를
 * 둘이 나눠 쓰는데 키가 늘수록 배치가 빡빡해지고, 잡기 판정이 테이블 위 물건까지
 * 닿기 때문에 점프가 없어도 못 줍는 물건이 생기지 않는다.
 *
 * 게임 로직은 InputSource 인터페이스(getState)만 보므로 AI 봇도 같은 자리에 낀다.
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

export interface KeyScheme {
  up: string; down: string; left: string; right: string;
  action: string;
}

// 표준 로컬 2P 배치 — 왼손은 WASD+Space, 오른손은 방향키+Enter.
// 각자 이동 클러스터 바로 옆의 큰 키가 유일한 액션 키라 손을 옮기지 않아도 된다.
// 노트북 하나를 나눠 쓰는 게 전제라 우Ctrl처럼 압축 키보드에 없는 키는 쓰지 않는다.
const DEFAULT_SCHEMES: KeyScheme[] = [
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', action: 'Space' },
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', action: 'Enter' },
];

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

class KeyboardSource implements InputSource {
  readonly id: string;
  private prevAction = false;

  constructor(private scheme: KeyScheme, private keys: Set<string>, index: number) {
    this.id = `kb${index}`;
  }

  get label(): string {
    const s = this.scheme;
    return `${keyName(s.up)}${keyName(s.left)}${keyName(s.down)}${keyName(s.right)} 이동<br/>` +
      `잡기 ${keyName(s.action)}`;
  }

  getState(): InputState {
    const s = this.scheme;
    const moveX = (this.keys.has(s.right) ? 1 : 0) - (this.keys.has(s.left) ? 1 : 0);
    const moveZ = (this.keys.has(s.down) ? 1 : 0) - (this.keys.has(s.up) ? 1 : 0);
    const held = this.keys.has(s.action);
    const actionPressed = held && !this.prevAction;
    this.prevAction = held;
    return { moveX, moveZ, actionPressed, actionHeld: held };
  }
}

// ── 매니저 ──────────────────────────────────────────────

export class InputManager {
  private keys = new Set<string>();
  private sources: InputSource[] = [];
  readonly schemes: KeyScheme[] = DEFAULT_SCHEMES.map((s) => ({ ...s }));

  constructor() {
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
}
