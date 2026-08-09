/**
 * 캐릭터 GLB 병합 — Meshy가 애니메이션마다 뱉은 GLB 4개를 하나로 합친다.
 *
 * 네 파일은 같은 메시·스킨·텍스처(2048² PNG 3.4MB)를 중복으로 들고 있어서
 * 합계 16MB인데, 정작 다른 건 애니메이션 데이터 114KB뿐이다.
 * 첫 파일을 베이스로 삼고 나머지에서 클립만 뽑아 붙여 4MB 한 덩어리로 만든다.
 * (노드 배열이 네 파일에서 동일한 것을 확인했으므로 채널의 노드 인덱스를 그대로 쓴다)
 *
 * 원본은 배포에 포함되지 않도록 public/ 밖(assets-src/)에 둔다.
 *
 *   node tools/merge-character.mjs
 *   assets-src/characters/*.glb → public/assets/characters/character.glb
 *
 * 병합 직후엔 베이스 파일의 원본 애니메이션 accessor가 남고 텍스처도 2048²라
 * 4.3MB다. 아래 두 단계를 이어서 돌리면 1.6MB가 된다 (배포 파일은 이 상태):
 *
 *   npx @gltf-transform/cli prune  public/assets/characters/character.glb /tmp/c.glb
 *   npx @gltf-transform/cli resize --width 1024 --height 1024 /tmp/c.glb \
 *       public/assets/characters/character.glb
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../assets-src/characters/', import.meta.url));
const OUT = fileURLToPath(new URL('../public/assets/characters/', import.meta.url));

/** 파일명 조각 → 게임에서 쓸 클립 이름 */
const CLIPS = [
  { match: 'jelly-walk', name: 'walk' },
  { match: 'jelly-pickup', name: 'pickup' },
  { match: 'jelly-throw', name: 'throw' },
  { match: 'jelly-hit', name: 'hit' },
  { match: 'jelly-lobby', name: 'lobby' }, // 로비 대기 — 두리번거리는 idle
  { match: 'jelly-win', name: 'win' },     // 결과 화면 우승 세레모니 (춤)
];

const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

function readGlb(path) {
  const buf = readFileSync(path);
  const total = buf.readUInt32LE(8);
  let off = 12;
  let json = null;
  let bin = Buffer.alloc(0);
  while (off < total) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === JSON_CHUNK) json = JSON.parse(data.toString('utf8'));
    else if (type === BIN_CHUNK) bin = Buffer.from(data);
    off += 8 + len;
  }
  return { json, bin };
}

function writeGlb(path, json, bin) {
  const pad = (b, fill) => {
    const r = b.length % 4;
    return r === 0 ? b : Buffer.concat([b, Buffer.alloc(4 - r, fill)]);
  };
  const jsonBuf = pad(Buffer.from(JSON.stringify(json), 'utf8'), 0x20);
  const binBuf = pad(bin, 0);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + binBuf.length, 8);
  const jsonHdr = Buffer.alloc(8);
  jsonHdr.writeUInt32LE(jsonBuf.length, 0);
  jsonHdr.writeUInt32LE(JSON_CHUNK, 4);
  const binHdr = Buffer.alloc(8);
  binHdr.writeUInt32LE(binBuf.length, 0);
  binHdr.writeUInt32LE(BIN_CHUNK, 4);
  writeFileSync(path, Buffer.concat([header, jsonHdr, jsonBuf, binHdr, binBuf]));
}

const files = readdirSync(SRC).filter((f) => f.endsWith('.glb'));
const pick = (m) => {
  const f = files.find((x) => x.includes(m));
  if (!f) throw new Error(`${m} 에 해당하는 GLB를 찾을 수 없습니다`);
  return f;
};

// 베이스 = 첫 클립의 파일 (메시·스킨·텍스처를 여기서 가져온다)
const base = readGlb(SRC + pick(CLIPS[0].match));
const outJson = base.json;
const chunks = [base.bin];
let binLen = base.bin.length;

/** 새 bin 데이터를 4바이트 정렬로 붙이고 bufferView 인덱스를 반환 */
function addView(data) {
  const padded = binLen % 4 === 0 ? 0 : 4 - (binLen % 4);
  if (padded) {
    chunks.push(Buffer.alloc(padded));
    binLen += padded;
  }
  const offset = binLen;
  chunks.push(data);
  binLen += data.length;
  outJson.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: data.length });
  return outJson.bufferViews.length - 1;
}

/** src 문서의 accessor 하나를 outJson으로 복사 */
function copyAccessor(src, idx) {
  const a = src.json.accessors[idx];
  const bv = src.json.bufferViews[a.bufferView];
  const stride = bv.byteStride;
  if (stride) throw new Error('인터리브된 애니메이션 accessor는 지원하지 않습니다');
  const nc = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type];
  const bytes = a.count * nc * 4; // 애니메이션 샘플러는 전부 float32
  const start = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const view = addView(src.bin.subarray(start, start + bytes));
  outJson.accessors.push({
    bufferView: view,
    componentType: a.componentType,
    count: a.count,
    type: a.type,
    ...(a.min ? { min: a.min } : {}),
    ...(a.max ? { max: a.max } : {}),
  });
  return outJson.accessors.length - 1;
}

// outJson 은 base.json 과 같은 객체라, 클립은 항상 파일에서 새로 읽어 온다
outJson.animations = [];
for (const clip of CLIPS) {
  const src = readGlb(SRC + pick(clip.match));
  const anim = src.json.animations[0];
  const samplers = anim.samplers.map((s) => ({
    input: copyAccessor(src, s.input),
    output: copyAccessor(src, s.output),
    interpolation: s.interpolation ?? 'LINEAR',
  }));
  outJson.animations.push({
    name: clip.name,
    samplers,
    channels: anim.channels.map((c) => ({ sampler: c.sampler, target: { ...c.target } })),
  });
  const dur = Math.max(...anim.samplers.map((s) => src.json.accessors[s.input].max?.[0] ?? 0));
  console.log(`  ${clip.name.padEnd(7)} ← ${pick(clip.match).slice(0, 52)}  (${dur.toFixed(2)}초)`);
}

const bin = Buffer.concat(chunks);
outJson.buffers = [{ byteLength: bin.length }];
writeGlb(OUT + 'character.glb', outJson, bin);

const before = files.reduce((n, f) => n + readFileSync(SRC + f).length, 0);
const after = readFileSync(OUT + 'character.glb').length;
console.log(
  `\n병합 완료: character.glb  ${(after / 1024 / 1024).toFixed(2)}MB` +
  `  (원본 ${files.length}개 합계 ${(before / 1024 / 1024).toFixed(1)}MB)`,
);
