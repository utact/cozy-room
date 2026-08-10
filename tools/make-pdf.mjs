/**
 * 마크다운 → 제출용 PDF. 한 방에 끝낸다.
 *
 *   node tools/make-pdf.mjs docs/게임소개.md
 *   node tools/make-pdf.mjs                     (인자 없으면 docs/*.md 전부)
 *
 * 결과는 docs/build/{이름}.pdf 에 나온다.
 *
 * PDF는 나온 뒤에 고칠 수 없다. 그래서 링크처럼 나중에 확정되는 값이 있으면 마크다운
 * 한 줄만 바꾸고 이 명령을 다시 돌리는 게 맞다 — PDF를 손보려 하지 말 것.
 *
 * 설치된 Chrome/Edge의 헤드리스 인쇄를 쓴다. Playwright/Puppeteer를 새로 받지 않는
 * 이유는 제출 직전에 수백 MB짜리 의존성을 들이는 위험을 피하기 위해서다.
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve, basename, join } from 'node:path';

const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];

const browser = BROWSERS.find((p) => existsSync(p));
if (!browser) {
  console.error('Chrome 또는 Edge를 찾지 못했다. 대신 HTML을 브라우저에서 열고 인쇄해라:');
  console.error('  node tools/md-to-html.mjs <입력.md> <출력.html>');
  process.exit(1);
}

const docsDir = resolve('docs');
const buildDir = join(docsDir, 'build');

const targets = process.argv.slice(2).length
  ? process.argv.slice(2).map((p) => resolve(p))
  : readdirSync(docsDir)
      .filter((f) => f.endsWith('.md') && !f.startsWith('제출체크리스트'))
      .map((f) => join(docsDir, f));

for (const md of targets) {
  const name = basename(md, '.md');
  const html = join(buildDir, `${name}.html`);
  const pdf = join(buildDir, `${name}.pdf`);

  execFileSync(process.execPath, [join('tools', 'md-to-html.mjs'), md, html], {
    stdio: 'inherit',
  });

  execFileSync(
    browser,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--no-pdf-header-footer',
      `--print-to-pdf=${pdf}`,
      pathToFileURL(html).href,
    ],
    { stdio: 'ignore' },
  );

  if (!existsSync(pdf)) throw new Error(`${name}: PDF 생성 실패`);
  console.log(`  → ${pdf} (${(statSync(pdf).size / 1024).toFixed(0)}KB)`);
}
