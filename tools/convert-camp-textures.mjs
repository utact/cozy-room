/**
 * 캠핑장 룸 셸 텍스처 변환 — Meshy가 뱉은 PNG를 게임이 쓰는 WebP로 만든다.
 *
 *   node tools/convert-camp-textures.mjs
 *   public/_preview/*.png → public/assets/textures/*.webp
 *
 * 텐트·매트는 알파가 필요하다. 배경이 균일하지 않고 은은한 그라데이션이라
 * "구석 픽셀과의 색 거리"로 판정하면 한쪽 끝에서 새는데, 마젠타 배경은 파랑이
 * 초록보다 확실히 높은 유일한 영역이라 그 조건으로 잡으면 안정적이다.
 * (피사체는 탄·크림·테라코타 계열이라 전부 초록 ≥ 파랑이다)
 *
 * 전역 색상 키 대신 가장자리에서 시작하는 플러드 필을 쓴다 — 피사체 안쪽에
 * 우연히 배경색과 가까운 픽셀이 있어도 뚫리지 않는다.
 */

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../public/_preview/', import.meta.url));
const OUT = fileURLToPath(new URL('../public/assets/textures/', import.meta.url));

/** [입력, 출력, 알파 필요 여부] */
const JOBS = [
  ['camp-floor.png', 'camp-floor.webp', false],
  ['camp-wall2.png', 'camp-wall.webp', false], // 재생성본(B)을 채택
  ['tent.png', 'tent.webp', true],
  ['camp-mat.png', 'camp-mat.webp', true],
];

/** 마젠타 배경인가 — 파랑이 초록보다 뚜렷이 높은 픽셀 */
const isMagenta = (r, g, b) => b > g + 25 && r > g + 25;

async function keyOutBackground(path) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const visited = new Uint8Array(width * height);
  const stack = [];
  for (let x = 0; x < width; x++) stack.push(x, x + (height - 1) * width);
  for (let y = 0; y < height; y++) stack.push(y * width, y * width + width - 1);

  let cleared = 0;
  while (stack.length) {
    const p = stack.pop();
    if (visited[p]) continue;
    visited[p] = 1;
    const i = p * channels;
    if (!isMagenta(data[i], data[i + 1], data[i + 2])) continue;
    data[i + 3] = 0;
    cleared++;
    const x = p % width;
    const y = (p / width) | 0;
    if (x > 0) stack.push(p - 1);
    if (x < width - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - width);
    if (y < height - 1) stack.push(p + width);
  }
  const pct = ((cleared / (width * height)) * 100).toFixed(1);
  return { img: sharp(data, { raw: { width, height, channels } }), pct };
}

for (const [src, out, alpha] of JOBS) {
  if (alpha) {
    const { img, pct } = await keyOutBackground(SRC + src);
    await img.resize(880, 880, { fit: 'inside' }).webp({ quality: 90 }).toFile(OUT + out);
    console.log(`  ${src} → ${out}  (배경 ${pct}% 투명 처리)`);
  } else {
    await sharp(SRC + src).resize(880, 880, { fit: 'cover' }).webp({ quality: 90 }).toFile(OUT + out);
    console.log(`  ${src} → ${out}`);
  }
}
