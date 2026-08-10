/**
 * 생성형 아트 에셋 매니페스트 (Higgsfield / Google nano-banana-pro로 생성).
 *
 * **전부 저장소에 번들되어 있다. 런타임 외부 요청은 없다.**
 * 예전에는 로컬이 없으면 생성 계정의 CDN에서 받아오는 폴백이 있었는데, 그 계정이
 * 정리되면 제출본이 조용히 깨진다(실제로 심사위원 초상이 그렇게 403으로 죽었다).
 * 새 아트를 추가할 때도 반드시 파일을 여기 커밋할 것 — URL을 적지 말 것.
 *
 * 출처·라이선스는 docs/2-AI활용기술문서.md 에 기재.
 */

export interface ArtAsset {
  local: string;
}

export const ART = {
  /** 타이틀 로고 (투명 배경) */
  logo: { local: 'assets/ui/logo.webp' },
  /** 메뉴 배경 키 비주얼 (16:9) */
  keyart: { local: 'assets/ui/keyart.webp' },
  /** 결과 화면 배경 키 비주얼 (16:9, 메뉴와 다른 컷) */
  keyart2: { local: 'assets/ui/keyart2.webp' },
  /** 타이틀 리본 배지 — "2~4인 물리 난투!" 텍스트가 이미지에 포함됨 */
  ribbonBadge: { local: 'assets/ui/ribbon-badge.webp' },
} satisfies Record<string, ArtAsset>;

/** 로컬 번들을 로드하고, 성공한 URL(또는 실패 시 null)을 콜백 */
export function loadArt(asset: ArtAsset, cb: (url: string | null) => void) {
  const img = new Image();
  img.onload = () => cb(asset.local);
  img.onerror = () => cb(null);
  img.src = asset.local;
}
