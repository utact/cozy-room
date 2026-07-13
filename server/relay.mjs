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

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { WebSocketServer } from 'ws';

// .env 로드 (의존성 없이) — NVIDIA_API_KEY 등
try {
  for (const line of readFileSync(new URL('./.env', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch { /* .env 없음 — 환경변수만 사용 */ }

const PORT = process.env.PORT ?? 8787;

// ── LLM 심사 프록시 (NVIDIA NIM, OpenAI 호환) ─────────────
// 비용 최소화: 라운드당 1회 호출(클라이언트가 보장), 소형 모델, max_tokens 캡,
// 입력 길이 제한. 키가 없거나 호출 실패 시 5xx → 클라이언트가 로컬 심사로 폴백.

const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NVIDIA_MODEL = process.env.NVIDIA_MODEL ?? 'meta/llama-3.1-8b-instruct';

const JUDGE_SYSTEM = `당신은 파티 게임의 유쾌한 심사위원이다. 주제와 각 플레이어가 제출한
물건(이름/태그)을 보고 주제 적합도를 0~100점으로 채점하고, 한국어로 위트 있는
한 줄 평(40자 이내)을 작성하라. 빈손(item이 null) 제출자는 낮은 점수와 함께 가볍게 놀려라.
반드시 JSON만 출력하라: {"verdicts":[{"playerId":0,"score":85,"comment":"..."}]}`;

async function handleJudge(req, res) {
  let body = '';
  req.on('data', (c) => {
    body += c;
    if (body.length > 16_384) req.destroy(); // 입력 크기 캡
  });
  req.on('end', async () => {
    const key = process.env.NVIDIA_API_KEY;
    if (!key) return sendJson(res, 503, { error: 'no-key' });
    try {
      const payload = JSON.parse(body);
      const compact = {
        topic: String(payload.topic ?? '').slice(0, 200),
        entries: (payload.entries ?? []).slice(0, 4).map((e) => ({
          playerId: e.playerId,
          playerName: String(e.playerName ?? '').slice(0, 20),
          item: e.item ? { name: String(e.item.name).slice(0, 40), tags: (e.item.tags ?? []).slice(0, 6) } : null,
        })),
      };
      const nv = await fetch(NVIDIA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: NVIDIA_MODEL,
          messages: [
            { role: 'system', content: JUDGE_SYSTEM },
            { role: 'user', content: JSON.stringify(compact) },
          ],
          temperature: 0.9,
          max_tokens: 320,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!nv.ok) return sendJson(res, 502, { error: `nvidia-${nv.status}` });
      const data = await nv.json();
      const text = data.choices?.[0]?.message?.content ?? '';
      const match = text.match(/\{[\s\S]*\}/); // JSON 블록 추출
      const parsed = JSON.parse(match ? match[0] : text);
      if (!Array.isArray(parsed.verdicts)) throw new Error('malformed');
      // 점수 클램프
      for (const v of parsed.verdicts) v.score = Math.max(0, Math.min(100, Math.round(v.score ?? 0)));
      sendJson(res, 200, { verdicts: parsed.verdicts });
    } catch (err) {
      sendJson(res, 502, { error: String(err).slice(0, 120) });
    }
  });
}

function sendJson(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(obj));
}

const httpServer = createServer((req, res) => {
  if (req.method === 'OPTIONS') return sendJson(res, 204, {});
  if (req.method === 'POST' && req.url === '/judge') return handleJudge(req, res);
  if (req.url === '/health') return sendJson(res, 200, { ok: true, judge: !!process.env.NVIDIA_API_KEY });
  sendJson(res, 404, { error: 'not-found' });
});

const wss = new WebSocketServer({ server: httpServer });

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
        // 보이스챗 메시 구성을 위해 기존 참가자(호스트=0 포함) 목록을 알려준다
        const peers = [0, ...r.guests.keys()];
        r.guests.set(guestId, ws);
        send(ws, { t: 'joined', room, guestId, peers });
        send(r.host, { t: 'guest-joined', guestId });
        break;
      }
      case 'signal': { // WebRTC 시그널링 중계 (보이스챗) — to: 0=호스트, n=게스트
        const r = rooms.get(room);
        if (!r) return;
        const from = role === 'host' ? 0 : guestId;
        const dest = msg.to === 0 ? r.host : r.guests.get(msg.to);
        if (dest) send(dest, { t: 'signal', from, data: msg.data });
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
      case 'ev': { // 호스트 → 게스트 (사운드·UI 단발 이벤트). to 지정 시 해당 게스트에게만
        const r = rooms.get(room);
        if (!r || role !== 'host') break;
        if (msg.to !== undefined) {
          const g = r.guests.get(msg.to);
          if (g) send(g, { t: 'ev', e: msg.e });
        } else {
          for (const g of r.guests.values()) send(g, { t: 'ev', e: msg.e });
        }
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

httpServer.listen(PORT, () => {
  console.log(`[relay] ws+http://0.0.0.0:${PORT} 대기 중 (LLM 심사: ${process.env.NVIDIA_API_KEY ? 'ON' : 'OFF'})`);
});
