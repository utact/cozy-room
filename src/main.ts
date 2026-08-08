import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import RAPIER from '@dimforge/rapier3d-compat';
import { Game } from './game';
import { AssetLibrary } from './assets';

async function boot() {
  const container = document.getElementById('app')!;
  const assets = new AssetLibrary();
  await Promise.all([RAPIER.init(), assets.load()]);
  const game = new Game(container, assets);
  game.start();
  // 개발·자동화 테스트용 디버그 핸들
  const w = window as unknown as Record<string, unknown>;
  w.__cozy = game;
}

boot().catch((err) => {
  console.error('부팅 실패:', err);
  document.body.innerHTML = `<pre style="color:#fff;padding:24px">게임 로드 실패: ${err}</pre>`;
});
