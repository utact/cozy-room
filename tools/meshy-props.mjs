/**
 * Meshy 가구·장식 생성 파이프라인 (프롭이 아니라 방을 채우는 것들).
 *
 *   MESHY_API_KEY=msy_... node tools/meshy-props.mjs
 *
 * 왜 필요한가: 콘셉트당 가구 GLB가 3종뿐이라 방을 채우려면 같은 걸 두세 번 복사해
 * 놓을 수밖에 없었다. 아이스박스 3개, 소파 2개가 한 화면에 보이면 밀도는 올라가도
 * "에셋이 모자라서 돌려막았다"가 그대로 읽힌다.
 *
 * 캐릭터와 달리 가구는 리깅·애니메이션이 필요 없다. preview → refine → GLB 저장이 끝이다.
 * 여섯 개를 동시에 돌린다 — 순차로 하면 태스크당 3~5분씩 30분이 넘는다.
 *
 * 저장 위치: public/assets/furniture/{id}.glb
 * 다운로드 후 tools/measure-glb.mjs 로 실측 비율을 재서 themes.ts 의 hx/hy/hz 에 반영할 것.
 */

import { writeFileSync, mkdirSync } from 'node:fs';

const KEY = process.env.MESHY_API_KEY;
if (!KEY) {
  console.error('MESHY_API_KEY 환경변수가 필요합니다');
  process.exit(1);
}
const API = 'https://api.meshy.ai/openapi/v2/text-to-3d';
const HEADERS = { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` };

/**
 * 프롬프트 공통 규칙:
 *  - "single object, centered, Y-up, resting on ground" — 기울거나 누운 채로 나오면
 *    바닥면 정렬(originAtBottom)이 엉뚱한 면을 바닥으로 잡는다
 *  - 기존 에셋과 톤을 맞추기 위해 따뜻한 목재·크림·앰버 팔레트를 고정한다
 */
const COMMON =
  'single object, centered, upright, Y-up orientation, resting flat on the ground, ' +
  'cute stylized 3D game asset, soft matte claymation look, warm cozy palette of ' +
  'honey wood, cream and amber, clean low poly, no background, no base plate, no text';

const PIECES = [
  {
    id: 'armchair',
    prompt: `A cozy single-seat armchair with plump rounded cushions, warm burnt-orange fabric, short wooden legs, high soft backrest. ${COMMON}`,
  },
  {
    id: 'bookshelf',
    prompt: `A low wide wooden bookshelf with two shelves filled with colorful tilted books and a small potted plant on top. ${COMMON}`,
  },
  {
    id: 'floor-lamp',
    prompt: `A tall slim floor lamp with a cream fabric drum shade, thin brass stand and a round weighted base, warm glowing bulb. ${COMMON}`,
  },
  {
    id: 'camp-chair',
    prompt: `A folding camping chair with taut forest-green fabric seat, black tubular metal frame, cup holder on the armrest. ${COMMON}`,
  },
  {
    id: 'log-pile',
    prompt: `A neat stack of chopped firewood logs, cut birch and oak rounds with visible bark and pale end grain, stacked in a low pyramid. ${COMMON}`,
  },
  {
    id: 'lantern',
    prompt: `A vintage camping lantern with a glass chamber glowing warm amber, metal cage frame, carry handle on top, standing on a small wooden crate. ${COMMON}`,
  },
];

async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${url} → ${res.status} ${await res.text()}`);
  return res.json();
}

async function poll(taskId, label) {
  for (;;) {
    const res = await fetch(`${API}/${taskId}`, { headers: HEADERS });
    const task = await res.json();
    if (task.status === 'SUCCEEDED') return task;
    if (task.status === 'FAILED' || task.status === 'CANCELED') {
      throw new Error(`${label} 태스크 실패: ${JSON.stringify(task.task_error ?? task)}`);
    }
    await new Promise((r) => setTimeout(r, 6000));
  }
}

mkdirSync(new URL('../public/assets/furniture/', import.meta.url), { recursive: true });

async function build(piece) {
  const t0 = Date.now();
  const prev = await post(API, {
    mode: 'preview',
    prompt: piece.prompt,
    // meshy-5 는 art_style 로 'realistic' 만 받는다 (예전 'sculpture' 는 400).
    // 그래서 스타일은 전적으로 프롬프트(COMMON)가 잡는다
    art_style: 'realistic',
    ai_model: 'meshy-5',
    topology: 'quad',
    target_polycount: 6000,
  });
  const prevTask = await poll(prev.result, `${piece.id}/preview`);
  console.log(`[${piece.id}] preview 완료 (${((Date.now() - t0) / 1000).toFixed(0)}s)`);

  const ref = await post(API, { mode: 'refine', preview_task_id: prevTask.id });
  const refTask = await poll(ref.result, `${piece.id}/refine`);

  const glbUrl = refTask.model_urls?.glb;
  if (!glbUrl) throw new Error(`${piece.id}: GLB URL 없음`);
  const glb = await fetch(glbUrl);
  const buf = Buffer.from(await glb.arrayBuffer());
  const out = new URL(`../public/assets/furniture/${piece.id}.glb`, import.meta.url);
  writeFileSync(out, buf);
  console.log(
    `[${piece.id}] 저장 완료 ${(buf.length / 1024).toFixed(0)}KB ` +
    `(총 ${((Date.now() - t0) / 1000).toFixed(0)}s)`,
  );
  return piece.id;
}

const results = await Promise.allSettled(PIECES.map(build));
console.log('\n=== 결과 ===');
results.forEach((r, i) => {
  console.log(r.status === 'fulfilled' ? `✓ ${PIECES[i].id}` : `✗ ${PIECES[i].id}: ${r.reason}`);
});
