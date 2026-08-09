import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import RAPIER from '@dimforge/rapier3d-compat';
import { Game } from './game';
import { AssetLibrary } from './assets';
import { CharacterLibrary } from './character';

async function boot() {
  const container = document.getElementById('app')!;
  const assets = new AssetLibrary();
  const characters = new CharacterLibrary();
  await Promise.all([RAPIER.init(), assets.load(), characters.load()]);
  const game = new Game(container, assets, characters);
  game.start();
  // 개발·자동화 테스트용 핸들 — 프로덕션 번들에는 포함되지 않는다
  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__cozy = game;
  }
}

boot().catch((err) => {
  console.error('부팅 실패:', err);
  document.body.innerHTML = `<pre style="color:#fff;padding:24px">게임 로드 실패: ${err}</pre>`;
});
