/**
 * 넷코드 공통 — WebSocket 릴레이 채널과 와이어 타입.
 *
 * 모델: 호스트 권위. 게스트는 입력만 보내고, 호스트가 스냅샷(20Hz)과
 * UI/사운드 오퍼레이션을 중계한다. 릴레이 서버는 server/relay.mjs.
 */

// ── 와이어 타입 ────────────────────────────────────────

/** 게스트 → 호스트 입력. 버튼은 프레임 유실에 견디도록 누적 카운터로 보낸다 */
export interface WireInput {
  mx: number;
  mz: number;
  /** 액션 버튼 현재 눌림 (level) */
  a: 0 | 1;
  /** 액션 누른 횟수 누적 (edge 복원용) */
  ac: number;
  /** 점프 누른 횟수 누적 */
  jc: number;
}

export interface SnapPlayer {
  i: number; // player id
  p: [number, number, number];
  yw: number;
  hd: 0 | 1; // 들고 있음
  ms: string; // 뜯긴 팔 'L'|'R'|'LR'|''
  ind: [number, number] | 0; // 그랩 후보 링 위치
}

export interface SnapProp {
  k: number; // uid
  id: string; // 카탈로그 id (arm-*는 팔)
  p: [number, number, number];
  q: [number, number, number, number];
  au: number; // 팔 오라 색 (0 = 없음)
  cl: 0 | 1; // 미스터리 실루엣
}

export interface Snapshot {
  pl: SnapPlayer[];
  pr: SnapProp[];
}

/** 호스트 → 게스트 오퍼레이션 (UI 호출·사운드·카메라·세션 제어) */
export type NetOp =
  | { op: 'ui'; m: string; a: unknown[] }
  | { op: 'sfx'; m: string; a: unknown[] }
  | { op: 'cam'; f: [number, number, number] | null }
  | { op: 'init'; theme: string }
  | { op: 'assign'; playerId: number }
  | { op: 'busy' };

// ── 릴레이 채널 ────────────────────────────────────────

type Handler = (msg: Record<string, unknown>) => void;

export class NetChannel {
  private handlers = new Map<string, Handler[]>();

  private constructor(private ws: WebSocket) {
    ws.addEventListener('message', (e) => {
      try {
        const msg = JSON.parse(e.data as string);
        for (const h of this.handlers.get(msg.t) ?? []) h(msg);
      } catch { /* 무시 */ }
    });
    ws.addEventListener('close', () => {
      for (const h of this.handlers.get('__close') ?? []) h({});
    });
  }

  static connect(url: string): Promise<NetChannel> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      const timer = setTimeout(() => reject(new Error('릴레이 서버 연결 시간 초과')), 6000);
      ws.addEventListener('open', () => {
        clearTimeout(timer);
        resolve(new NetChannel(ws));
      });
      ws.addEventListener('error', () => {
        clearTimeout(timer);
        reject(new Error('릴레이 서버 연결 실패'));
      });
    });
  }

  on(type: string, handler: Handler) {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
  }

  onClose(handler: () => void) {
    this.on('__close', handler);
  }

  send(msg: Record<string, unknown>) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  /** 호스트: 방 생성 → 코드 반환 */
  createRoom(): Promise<string> {
    return new Promise((resolve) => {
      this.on('created', (m) => resolve(m.room as string));
      this.send({ t: 'create' });
    });
  }

  /** 게스트: 방 입장 → 내 id와 기존 피어 목록 */
  joinRoom(code: string): Promise<{ guestId: number; peers: number[] }> {
    return new Promise((resolve, reject) => {
      this.on('joined', (m) => resolve({ guestId: m.guestId as number, peers: (m.peers as number[]) ?? [0] }));
      this.on('error', (m) => reject(new Error(
        m.reason === 'no-room' ? '방을 찾을 수 없습니다' : m.reason === 'full' ? '방이 가득 찼습니다' : '입장 실패',
      )));
      this.send({ t: 'join', room: code });
    });
  }

  /** WebRTC 시그널링 (보이스챗) */
  signal(to: number, data: unknown) {
    this.send({ t: 'signal', to, data });
  }

  onSignal(handler: (from: number, data: never) => void) {
    this.on('signal', (m) => handler(m.from as number, m.data as never));
  }
}

/** 릴레이 서버 주소 결정: ?relay= > VITE_RELAY_URL > localhost 개발 기본값 */
export function resolveRelayUrl(): string | null {
  const p = new URLSearchParams(location.search).get('relay');
  if (p) return p;
  const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env?.VITE_RELAY_URL;
  if (env) return env;
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    return 'ws://localhost:8787';
  }
  return null;
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
