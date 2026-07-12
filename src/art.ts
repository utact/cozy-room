/**
 * 생성형 아트 에셋 매니페스트 (Higgsfield / Google nano-banana-pro로 생성).
 *
 * 로드 순서: 로컬 번들(public/assets/ui/*) → 원격 CDN → 실패 시 CSS 폴백.
 * 저장소에 파일을 넣으면(경로 동일) 원격 의존 없이 동작한다 — 제출 전 권장.
 * 출처·라이선스는 docs/2-AI활용기술문서.md 에 기재.
 */

export interface ArtAsset {
  local: string;
  remote: string;
}

const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_3GOqsfd5P2KANwOZMG13mVTJvX3';

export const ART = {
  /** 타이틀 로고 (투명 배경) */
  logo: {
    local: 'assets/ui/logo.png',
    remote: `${CDN}/hf_20260712_111726_9b9d247b-1447-443a-943b-1b43d95fb751.png`,
  },
  /** 메뉴 배경 키 비주얼 (16:9) */
  keyart: {
    local: 'assets/ui/keyart.png',
    remote: `${CDN}/hf_20260712_111330_8993f377-480f-4f36-8cfa-f35ee658fb12.png`,
  },
  /** AI 심사위원 로봇 초상 (1:1, 어두운 배경) */
  judge: {
    local: 'assets/ui/judge.png',
    remote: `${CDN}/hf_20260712_111746_5fed78a7-549d-43a7-b29c-e7688f475d70.png`,
  },
} satisfies Record<string, ArtAsset>;

/** 로컬 → 원격 순서로 로드를 시도하고, 성공한 URL(또는 null)을 콜백 */
export function loadArt(asset: ArtAsset, cb: (url: string | null) => void) {
  const attempt = (url: string, onFail: () => void) => {
    const img = new Image();
    img.onload = () => cb(url);
    img.onerror = onFail;
    img.src = url;
  };
  attempt(asset.local, () => attempt(asset.remote, () => cb(null)));
}
