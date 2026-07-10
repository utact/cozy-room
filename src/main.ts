import RAPIER from '@dimforge/rapier3d-compat';
import { Game } from './game';

async function boot() {
  await RAPIER.init();
  const container = document.getElementById('app')!;
  new Game(container).start();
}

boot().catch((err) => {
  console.error('부팅 실패:', err);
  document.body.innerHTML = `<pre style="color:#fff;padding:24px">게임 로드 실패: ${err}</pre>`;
});
