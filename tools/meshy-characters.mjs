/**
 * Meshy 젤리빈 캐릭터 4종 생성 파이프라인.
 *
 * 실행 위치: api.meshy.ai 로 나가는 네트워크가 열린 곳 (로컬 PC 또는
 * 네트워크 허용 목록에 api.meshy.ai / assets.meshy.ai 를 추가한 원격 환경).
 *
 *   MESHY_API_KEY=msy_... node tools/meshy-characters.mjs
 *
 * 단계: text-to-3d preview → refine(텍스처) → GLB 다운로드
 *   → public/assets/characters/jelly-{color}.glb 저장.
 * 리깅·애니메이션(walk/idle/pickup/throw)은 Meshy MCP의 rig/animate 툴
 * 또는 웹 스튜디오에서 이어서 진행 (아래 TODO 참고).
 */

import { writeFileSync, mkdirSync } from 'node:fs';

const KEY = process.env.MESHY_API_KEY;
if (!KEY) {
  console.error('MESHY_API_KEY 환경변수가 필요합니다');
  process.exit(1);
}
const API = 'https://api.meshy.ai/openapi/v2/text-to-3d';
const HEADERS = { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` };

const CHARACTERS = [
  { id: 'red', color: 'warm red-orange (#e4573d)' },
  { id: 'blue', color: 'vivid blue (#3d7de4)' },
  { id: 'yellow', color: 'golden yellow (#e4b53d)' },
  { id: 'green', color: 'fresh green (#4fbf5e)' },
];

const PROMPT = (color) =>
  `Cute jellybean capsule game character, ${color} smooth rounded capsule body, ` +
  `big white oval eyes with black pupils, two tiny stub arms, small flat feet, ` +
  `no mouth, T-pose friendly for rigging, clean stylized 3D, single character, game-ready low poly`;

async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${url} → ${res.status} ${await res.text()}`);
  return res.json();
}

async function poll(taskId) {
  for (;;) {
    const res = await fetch(`${API}/${taskId}`, { headers: HEADERS });
    const task = await res.json();
    if (task.status === 'SUCCEEDED') return task;
    if (task.status === 'FAILED' || task.status === 'CANCELED') {
      throw new Error(`태스크 실패: ${JSON.stringify(task.task_error ?? task)}`);
    }
    process.stdout.write(`\r  ${taskId} ${task.status} ${task.progress ?? 0}%   `);
    await new Promise((r) => setTimeout(r, 5000));
  }
}

mkdirSync(new URL('../public/assets/characters/', import.meta.url), { recursive: true });

for (const ch of CHARACTERS) {
  console.log(`\n=== ${ch.id} ===`);
  // 1) 프리뷰 (지오메트리)
  const prev = await post(API, {
    mode: 'preview',
    prompt: PROMPT(ch.color),
    art_style: 'sculpture',
    ai_model: 'meshy-5',
    topology: 'quad',
    target_polycount: 8000,
  });
  const prevTask = await poll(prev.result);
  console.log('\n  preview 완료');
  // 2) 리파인 (텍스처)
  const ref = await post(API, { mode: 'refine', preview_task_id: prevTask.id });
  const refTask = await poll(ref.result);
  console.log('\n  refine 완료');
  // 3) GLB 다운로드
  const glbUrl = refTask.model_urls?.glb;
  if (!glbUrl) throw new Error('GLB URL 없음');
  const glb = await fetch(glbUrl);
  const buf = Buffer.from(await glb.arrayBuffer());
  const out = new URL(`../public/assets/characters/jelly-${ch.id}.glb`, import.meta.url);
  writeFileSync(out, buf);
  console.log(`  저장: jelly-${ch.id}.glb (${(buf.length / 1024).toFixed(0)}KB)`);
}

console.log(`
완료! 다음 단계 (TODO):
1. 리깅/애니메이션: Meshy MCP의 rig → animate 툴로 idle/walk/pickup/throw
   클립을 붙이거나 (커넥터 연결 시 Claude가 수행), Meshy 웹 스튜디오의
   Animate 기능 사용 → 애니메이션 포함 GLB로 재다운로드.
2. 게임 통합: src/visuals.ts의 createPlayerVisual이 GLB 존재 시 이를 사용하고
   THREE.AnimationMixer로 상태(이동/그랩/던지기)에 맞는 클립 재생.
`);
