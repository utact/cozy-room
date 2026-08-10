/**
 * GLB 텍스처 축소 — 생성형 3D 도구가 붙여 주는 4K 텍스처를 게임용 크기로 줄인다.
 *
 *   node tools/shrink-glb.mjs public/assets/furniture/armchair.glb [최대변]
 *
 * Meshy가 뱉는 GLB는 개당 2.6~3.4MB인데 그 대부분이 텍스처다. 화면에서 가구 하나가
 * 차지하는 넓이가 200px 남짓인데 4096px 텍스처를 싣는 건 낭비고, 웹에서 첫 로딩이
 * 그만큼 늦어진다.
 *
 * `@gltf-transform/cli optimize` 를 먼저 시도했지만 이 텍스처들에서 vips가
 * "colourspace: parameter space not set" 으로 실패해, 필요한 부분만 직접 처리한다.
 *
 * GLB 구조: [12B 헤더][4B len][4B type]JSON[4B len][4B type]BIN
 * 이미지는 JSON 의 images[].bufferView 가 가리키는 BIN 구간에 들어 있다.
 * 바이트 길이가 바뀌므로 BIN 을 통째로 다시 쌓고 모든 bufferView 오프셋을 새로 적는다.
 */

import { readFileSync, writeFileSync, statSync } from 'node:fs';
import sharp from 'sharp';

const [, , file, maxDimArg] = process.argv;
if (!file) {
  console.error('사용법: node tools/shrink-glb.mjs <파일.glb> [최대변=1024]');
  process.exit(1);
}
const MAX_DIM = Number(maxDimArg ?? 1024);

const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

const src = readFileSync(file);
const before = statSync(file).size;

if (src.readUInt32LE(0) !== 0x46546c67) throw new Error('glTF 매직이 아니다');

// ── 청크 파싱 ──
let off = 12;
let json = null;
let bin = Buffer.alloc(0);
while (off < src.length) {
  const len = src.readUInt32LE(off);
  const type = src.readUInt32LE(off + 4);
  const data = src.subarray(off + 8, off + 8 + len);
  if (type === JSON_CHUNK) json = JSON.parse(data.toString('utf8'));
  else if (type === BIN_CHUNK) bin = data;
  off += 8 + len + ((4 - ((off + 8 + len) % 4)) % 4);
}
if (!json) throw new Error('JSON 청크 없음');

const views = json.bufferViews ?? [];
/** bufferView 인덱스 → 새 바이트 내용. 손대지 않은 것은 원본 구간 그대로 */
const replaced = new Map();

for (const [i, img] of (json.images ?? []).entries()) {
  if (img.bufferView === undefined) continue;
  const v = views[img.bufferView];
  const raw = bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
  try {
    const meta = await sharp(raw).metadata();
    // 이미 충분히 작으면 건드리지 않는다 — 다시 인코딩하면 오히려 커질 수 있다
    if (Math.max(meta.width ?? 0, meta.height ?? 0) <= MAX_DIM && meta.format === 'webp') continue;
    const out = await sharp(raw)
      .resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true })
      .toColourspace('srgb')
      .webp({ quality: 82 })
      .toBuffer();
    replaced.set(img.bufferView, out);
    img.mimeType = 'image/webp';
    console.log(
      `  이미지 ${i}: ${meta.width}x${meta.height} ${meta.format} ` +
      `${(raw.length / 1024).toFixed(0)}KB → ${(out.length / 1024).toFixed(0)}KB`,
    );
  } catch (e) {
    console.warn(`  이미지 ${i}: 건너뜀 (${e.message})`);
  }
}

if (replaced.size === 0) {
  console.log('바꿀 텍스처 없음 — 원본 유지');
  process.exit(0);
}

// WebP 텍스처는 확장 선언이 필요하다
json.extensionsUsed = [...new Set([...(json.extensionsUsed ?? []), 'EXT_texture_webp'])];
for (const tex of json.textures ?? []) {
  if (tex.source !== undefined && replaced.has((json.images[tex.source] ?? {}).bufferView)) {
    tex.extensions = { ...(tex.extensions ?? {}), EXT_texture_webp: { source: tex.source } };
  }
}

// ── BIN 재구성: 모든 bufferView를 4바이트 정렬로 다시 쌓는다 ──
const parts = [];
let cursor = 0;
views.forEach((v, i) => {
  const data = replaced.get(i) ?? bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
  v.byteOffset = cursor;
  v.byteLength = data.length;
  parts.push(data);
  cursor += data.length;
  const pad = (4 - (cursor % 4)) % 4;
  if (pad) {
    parts.push(Buffer.alloc(pad));
    cursor += pad;
  }
});
const newBin = Buffer.concat(parts);
json.buffers = [{ byteLength: newBin.length }];

// ── 재조립 ──
const jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
const jsonPad = Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20); // 공백으로 패딩
const binPad = Buffer.alloc((4 - (newBin.length % 4)) % 4, 0);

const jsonLen = jsonBuf.length + jsonPad.length;
const binLen = newBin.length + binPad.length;
const total = 12 + 8 + jsonLen + 8 + binLen;

const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(total, 8);

const jsonHeader = Buffer.alloc(8);
jsonHeader.writeUInt32LE(jsonLen, 0);
jsonHeader.writeUInt32LE(JSON_CHUNK, 4);

const binHeader = Buffer.alloc(8);
binHeader.writeUInt32LE(binLen, 0);
binHeader.writeUInt32LE(BIN_CHUNK, 4);

writeFileSync(
  file,
  Buffer.concat([header, jsonHeader, jsonBuf, jsonPad, binHeader, newBin, binPad]),
);
const after = statSync(file).size;
console.log(`${file}: ${(before / 1024).toFixed(0)}KB → ${(after / 1024).toFixed(0)}KB`);
