/**
 * 코지 룸 — 온라인 모드용 룸 코드 릴레이 서버 (스캐폴드).
 *
 * 설계: 호스트 권위(host-authoritative) 모델.
 *  - 방을 만든 브라우저(호스트)가 물리·게임 로직을 그대로 돌린다 (현 코드 재사용).
 *  - 게스트는 입력(InputState)만 보내고, 호스트가 20Hz로 상태 스냅샷을 뿌린다.
 *  - 이 서버는 중계만 한다 → 게임 로직 무지식, 방 코드 매칭 + 메시지 릴레이.
 *
 * 실행: cd server && npm install && node relay.mjs  (기본 포트 8787)
 * 배포: Render/Fly.io 무료 티어 또는 Cloudflare Durable Objects 포팅.
 */

import { WebSocketServer } from 'ws';

const PORT = process.env.PORT ?? 8787;
const wss = new WebSocketServer({ port: PORT });

/** roomCode → { host: ws, guests: Map<guestId, ws> } */
const rooms = new Map();

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 혼동 문자 제외

function newRoomCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () => CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0]).join('');
  } while (rooms.has(code));
  return code;
}

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

wss.on('connection', (ws) => {
  let role = null;   // 'host' | 'guest'
  let room = null;   // roomCode
  let guestId = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    switch (msg.t) {
      case 'create': { // 호스트: 방 생성
        room = newRoomCode();
        role = 'host';
        rooms.set(room, { host: ws, guests: new Map(), nextGuest: 1 });
        send(ws, { t: 'created', room });
        break;
      }
      case 'join': { // 게스트: 방 코드로 입장
        const r = rooms.get(msg.room?.toUpperCase?.());
        if (!r) return send(ws, { t: 'error', reason: 'no-room' });
        if (r.guests.size >= 3) return send(ws, { t: 'error', reason: 'full' });
        room = msg.room.toUpperCase();
        role = 'guest';
        guestId = r.nextGuest++;
        r.guests.set(guestId, ws);
        send(ws, { t: 'joined', room, guestId });
        send(r.host, { t: 'guest-joined', guestId });
        break;
      }
      case 'input': { // 게스트 → 호스트 (InputState)
        const r = rooms.get(room);
        if (r && role === 'guest') send(r.host, { t: 'input', guestId, s: msg.s });
        break;
      }
      case 'state': { // 호스트 → 전체 게스트 (20Hz 스냅샷)
        const r = rooms.get(room);
        if (r && role === 'host') for (const g of r.guests.values()) send(g, { t: 'state', s: msg.s });
        break;
      }
      case 'ev': { // 호스트 → 게스트 (사운드·UI 단발 이벤트)
        const r = rooms.get(room);
        if (r && role === 'host') for (const g of r.guests.values()) send(g, { t: 'ev', e: msg.e });
        break;
      }
    }
  });

  ws.on('close', () => {
    const r = rooms.get(room);
    if (!r) return;
    if (role === 'host') {
      for (const g of r.guests.values()) send(g, { t: 'host-left' });
      rooms.delete(room);
    } else if (role === 'guest') {
      r.guests.delete(guestId);
      send(r.host, { t: 'guest-left', guestId });
    }
  });
});

console.log(`[relay] ws://0.0.0.0:${PORT} 대기 중`);
