/**
 * 생성형 UI 아트 후처리 — 단색 배경 제거 → 여백 트림 → webp 변환.
 *
 * 이미지 생성 도구가 투명 배경을 못 만들어서 단색(녹색·하늘색 등) 배경으로 뽑아주는데,
 * 그걸 게임 UI에 그대로 쓰면 배경 사각형이 그대로 보인다. 이 스크립트가 그걸 정리한다.
 *
 *   node tools/prepare-ui-art.mjs <입력파일> <출력파일.webp> [배경허용치]
 *
 * 배경허용치(기본 40)는 "배경색으로 칠지" 판정하는 RGB 거리다. 배경이 그림자로 서서히
 * 어두워지는 경우 값을 키운다(60~80). 피사체 색이 배경과 비슷하면 줄인다(20~25).
 */

import sharp from 'sharp';
import { statSync } from 'node:fs';

/** 네 모서리 평균을 배경 기준색으로 잡는다 */
function sampleBackground(data, width, height, channels) {
  const pts = [[2, 2], [width - 3, 2], [2, height - 3], [width - 3, height - 3]];
  let r = 0, g = 0, b = 0;
  for (const [x, y] of pts) {
    const o = (y * width + x) * channels;
    r += data[o]; g += data[o + 1]; b += data[o + 2];
  }
  return [r / pts.length, g / pts.length, b / pts.length];
}

/**
 * 테두리에서 시작하는 flood fill로 배경을 지운다.
 *
 * 이웃 픽셀과의 "국소" 색차로 번지면 부드러운 그라디언트를 타고 피사체 안쪽까지
 * 새어 들어가므로, 반드시 고정 기준색과의 거리로 판정해야 한다.
 */
function floodFillBackground(data, width, height, channels, threshold) {
  const [br, bg, bb] = sampleBackground(data, width, height, channels);
  const n = width * height;
  const isBg = new Uint8Array(n);
  const stack = new Int32Array(n);
  let sp = 0;
  const t2 = threshold * threshold;

  const matches = (i) => {
    const o = i * channels;
    const dr = data[o] - br, dg = data[o + 1] - bg, db = data[o + 2] - bb;
    return dr * dr + dg * dg + db * db <= t2;
  };
  const seed = (i) => {
    if (!isBg[i] && matches(i)) { isBg[i] = 1; stack[sp++] = i; }
  };

  for (let x = 0; x < width; x++) { seed(x); seed((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { seed(y * width); seed(y * width + width - 1); }

  while (sp > 0) {
    const i = stack[--sp];
    const x = i % width, y = (i / width) | 0;
    if (x > 0) seed(i - 1);
    if (x < width - 1) seed(i + 1);
    if (y > 0) seed(i - width);
    if (y < height - 1) seed(i + width);
  }
  return isBg;
}

/** 본체와 떨어진 작은 덩어리(생성 도구 워터마크 등)를 걸러내고 가장 큰 덩어리만 남긴다 */
function largestComponent(isBg, width, height) {
  const n = width * height;
  const label = new Int32Array(n).fill(-1);
  const stack = new Int32Array(n);
  let best = -1, bestSize = 0;

  for (let start = 0; start < n; start++) {
    if (isBg[start] || label[start] !== -1) continue;
    let sp = 0, size = 0;
    stack[sp++] = start;
    label[start] = start;
    while (sp > 0) {
      const i = stack[--sp];
      size++;
      const x = i % width, y = (i / width) | 0;
      const push = (j) => { if (!isBg[j] && label[j] === -1) { label[j] = start; stack[sp++] = j; } };
      if (x > 0) push(i - 1);
      if (x < width - 1) push(i + 1);
      if (y > 0) push(i - width);
      if (y < height - 1) push(i + width);
    }
    if (size > bestSize) { bestSize = size; best = start; }
  }
  return { label, best };
}

const [, , src, dst, thresholdArg] = process.argv;
if (!src || !dst) {
  console.error('사용법: node tools/prepare-ui-art.mjs <입력> <출력.webp> [배경허용치]');
  process.exit(1);
}
const threshold = Number(thresholdArg ?? 40);

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;

const isBg = floodFillBackground(data, width, height, channels, threshold);
const { label, best } = largestComponent(isBg, width, height);

const out = Buffer.from(data);
for (let i = 0; i < width * height; i++) {
  if (isBg[i] || label[i] !== best) out[i * channels + 3] = 0;
}

await sharp(out, { raw: { width, height, channels } })
  .trim({ threshold: 10 }) // 투명 여백 잘라내기
  .webp({ quality: 92 })
  .toFile(dst);

const meta = await sharp(dst).metadata();
console.log(
  `${src} → ${dst}  ${width}x${height} → ${meta.width}x${meta.height}` +
  `  ${(statSync(dst).size / 1024).toFixed(0)}KB  (배경허용치 ${threshold})`,
);
