import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import RAPIER from '@dimforge/rapier3d-compat';
import { Game } from './game';
import { GuestApp } from './net-guest';
import { resolveRelayUrl } from './net';
import { AssetLibrary } from './assets';

async function boot() {
  const container = document.getElementById('app')!;
  const joinCode = new URLSearchParams(location.search).get('join');

  if (joinCode) {
    // 온라인 게스트 모드 — 물리 없이 호스트 미러링
    await RAPIER.init(); // World3D 구성에 필요
    const relay = resolveRelayUrl();
    if (!relay) {
      document.body.innerHTML =
        '<pre style="color:#fff;padding:24px">릴레이 서버 주소가 없습니다. URL에 &relay=wss://… 를 붙여 주세요.</pre>';
      return;
    }
    const guest = new GuestApp(container, relay, joinCode);
    await guest.start();
    (window as unknown as Record<string, unknown>).__cozyGuest = guest;
    return;
  }

  const assets = new AssetLibrary();
  await Promise.all([RAPIER.init(), assets.load()]);
  const game = new Game(container, assets);
  game.start();
  // 개발·자동화 테스트용 디버그 핸들
  (window as unknown as Record<string, unknown>).__cozy = game;
}

boot().catch((err) => {
  console.error('부팅 실패:', err);
  document.body.innerHTML = `<pre style="color:#fff;padding:24px">게임 로드 실패: ${err}</pre>`;
});
