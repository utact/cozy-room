/**
 * 맵 콘셉트 — 질문·프롭·모드·가구를 함께 묶는 단위.
 *
 * 라운드마다 콘셉트 하나가 배정되고, 그 안에서 질문이 뽑히고 그 콘셉트의 프롭만 깔린다.
 * 색만 바꾸던 예전 '테마'와 달리, 한 콘셉트 안에서는 그 배경에 실제로 있을 법한 물건만
 * 나오고 그 배경의 사물이 일으킬 법한 모드만 발동한다.
 */

import { LIVING_ROOM_TOPICS, CAMPING_TOPICS, type Topic } from './topics';

/** 가구 — 시각 메쉬는 GLB, 물리는 손으로 적은 박스 콜라이더 */
export interface FurniturePiece {
  /** public/assets/furniture/{glb}.glb */
  glb: string;
  x: number;
  z: number;
  /** 콜라이더 반치수. 시각 메쉬도 이 크기에 맞춰 정규화된다 */
  hx: number;
  hy: number;
  hz: number;
  rotY?: number;
  /**
   * 모드 발동 여부와 무관하게 항상 켜진 점광원.
   * 불티 모드의 화로대처럼, 장치가 꺼져 있을 때도 방에 보여야 하는 가구용이다.
   */
  glow?: { y: number; color: number; intensity: number; distance: number };
}

/** 벽에 붙는 평면 텍스처 — 창문처럼 깊이가 없는 것들 */
export interface WallDecal {
  /** public/assets/textures/{tex}.webp */
  tex: string;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  rotY?: number;
}

export interface Concept {
  id: string;
  name: string;
  /** 바닥·벽 타일 텍스처 (public/assets/textures) */
  floorTex: string;
  wallTex: string;
  /** 바닥 중앙 러그. 알파 텍스처라 술 장식 사이가 비친다 */
  rug: { tex: string; w: number; d: number } | null;
  /** 벽·씬 기본색 — UI 팔레트의 --night 계열 */
  shade: number;
  /** 포인트 조명 색 — UI 팔레트의 --lamp */
  glow: number;
  furniture: FurniturePiece[];
  decals: WallDecal[];
  /** 창문 앞 커튼 — 평상시 미세하게, 돌풍 때 크게 펄럭인다. 코드로 만든 평면이다 */
  curtain: { x: number; y: number; z: number; w: number; h: number; color: number } | null;
  topics: Topic[];
  /** 이 콘셉트에서 바닥에 깔리는 프롭 id (catalog.ts) */
  propIds: string[];
  /** 이 콘셉트에서 발동 가능한 모드 id (events.ts) */
  eventIds: string[];
  /** 폭격 비행선 등장 여부 — 거실 상공에 비행선이 지나갈 근거가 없어 끈다 */
  airship: boolean;
}

/**
 * 콘셉트 1「코지 거실」
 *
 * 가구는 전부 벽면에 붙이고 방 중앙을 비운다. 가구 그림자는 항상 -z(카메라 반대) 방향으로
 * 생기므로, 뒷벽에 밀착한 가구는 그림자가 벽 안쪽으로 떨어져 바닥을 가리지 않는다.
 * 중앙에 장애물을 두면 그림자 배제 구역이 한복판에 생겨 판독성을 해친다.
 *
 * 창문은 뒷벽 중앙이고 소파는 x=-3.5로 비켜 두었다 — 돌풍의 출처가 가려지면 안 된다.
 */
const COZY_LIVING: Concept = {
  id: 'living',
  name: '코지 거실',
  floorTex: 'floor',
  wallTex: 'wall',
  rug: { tex: 'rug', w: 6.4, d: 4.4 },
  shade: 0x191411, // --night
  glow: 0xf0a94c,  // --lamp
  furniture: [
    // 소파 — 뒷벽 밀착. 등받이가 0.8로 높아도 뒷벽이라 바닥을 가리지 않는다
    { glb: 'sofa', x: -3.5, z: -5.5, hx: 1.6, hy: 0.4, hz: 0.5 },
    // 티테이블 — 소파 앞 0.9. 그 틈은 좁은 통로가 된다(캡슐 지름 0.68)
    { glb: 'coffee-table', x: -3.5, z: -3.6, hx: 0.7, hy: 0.2, hz: 0.45 },
    // TV장 + TV — 앞벽에서 소파와 마주 본다. 앞벽은 카메라 각이 64°라 그림자가 0.4로 짧다
    { glb: 'tv-stand', x: -3.5, z: 5.6, hx: 1.2, hy: 0.415, hz: 0.25 },
  ],
  decals: [
    // 창문 — 돌풍의 출처이자 정전 때의 유일한 광원. 벽 시각높이 1.4 안에 들어간다
    { tex: 'window', x: 0, y: 0.72, z: -5.98, w: 3, h: 1.0 },
  ],
  // 창문 양옆에 한 장씩. 모드가 꺼져 있어도 흔들려서 "창문이 열려 있다"는 신호가 끊기지 않는다
  curtain: { x: 0, y: 1.24, z: -5.9, w: 1.0, h: 1.05, color: 0xf7efe4 },
  topics: LIVING_ROOM_TOPICS,
  propIds: [
    'photo-frame', 'laptop', 'passport-pouch', 'teddy-bear',
    'broom', 'vacuum', 'speaker', 'monstera',
    'blanket', 'cushion', 'tv-remote', 'headphones',
  ],
  eventIds: ['wind', 'rumble', 'blackout'],
  airship: false,
};

/**
 * 콘셉트 2「오토캠핑 데크」
 *
 * 실외지만 방 구조(바닥 + 벽 4장)는 거실과 똑같이 쓴다. 벽을 없애면 맵 경계가 사라지고,
 * 나무를 세우면 높이 3짜리가 바닥을 2.8만큼 가려 은닉 0이 깨진다. 그래서 벽의 **정체만**
 * 바꾼다 — 뒷벽은 텐트, 좌우·앞은 낮은 통나무 울타리와 그 너머 수풀이다.
 *
 * 화로대만 방 중앙에 둔다. 거실의 "가구는 전부 벽면" 관행은 규칙이 아니라 은닉 0을 지키기
 * 위한 수단이었는데, 화로대는 높이 0.3이라 중앙에서도 가림 길이가 0.3×0.93≈0.28에 그친다.
 *
 * 1단계: 캠핑 전용 프롭 10종을 아직 만들지 않아 거실 12종을 그대로 쓴다. 맵·가구·모드를
 * 먼저 실플레이로 검증한 뒤 전용 프롭으로 교체한다.
 */
const CAMPING: Concept = {
  id: 'camping',
  name: '오토캠핑 데크',
  floorTex: 'camp-floor',
  wallTex: 'camp-wall',
  rug: { tex: 'camp-mat', w: 3.2, d: 3.2 },
  shade: 0x191411, // --night, 거실과 통일
  glow: 0xf0a94c,  // --lamp, 거실과 통일
  // 반치수는 GLB의 실측 비율에서 역산했다. instantiateFurniture 가 시각 메쉬를
  // max(hx,hy,hz)×2 로 정규화하므로, 비율이 어긋나면 상판과 콜라이더가 따로 놀아
  // 물건이 공중에 뜨거나 파묻힌다.
  furniture: [
    // 화로대 — 중앙. 모드가 꺼져 있어도 불빛이 새어 나와 "저기 불이 있다"는 신호가 끊기지 않는다.
    // 높이 0.42라 중앙에 있어도 가리는 바닥은 0.42×0.93≈0.39에 그친다 (GLB 1.99×0.70×2.00)
    {
      glb: 'fire-pit', x: 0, z: -1, hx: 0.6, hy: 0.21, hz: 0.6,
      glow: { y: 0.3, color: 0xf0a94c, intensity: 6, distance: 4.5 },
    },
    // 캠핑 테이블 — 좌측벽. 거실 티테이블과 같은 역할(상판 프롭). GLB 1.99×1.05×1.16
    { glb: 'camp-table', x: -6.6, z: 1, hx: 0.65, hy: 0.343, hz: 0.379 },
    // 아이스박스 — 우측벽. 너구리가 튀어나오는 곳. GLB 2.00×1.25×1.43
    { glb: 'cooler', x: 6.9, z: 2, hx: 0.475, hy: 0.297, hz: 0.34 },
  ],
  decals: [
    // 텐트 — 뒷벽 중앙. 소나기 때 자락이 펄럭인다
    { tex: 'tent', x: 0, y: 0.7, z: -5.98, w: 3.5, h: 1.4 },
  ],
  // 텐트 자락 — 거실 커튼과 같은 코드로 흔든다. 호출자만 RainEvent로 바뀐다
  curtain: { x: 0, y: 1.25, z: -5.9, w: 0.85, h: 0.95, color: 0xc9905a },
  topics: CAMPING_TOPICS,
  // 1단계 임시 — 거실 프롭 12종 재사용. 2단계에서 캠핑 전용으로 교체한다
  propIds: [
    'photo-frame', 'laptop', 'passport-pouch', 'teddy-bear',
    'broom', 'vacuum', 'speaker', 'monstera',
    'blanket', 'cushion', 'tv-remote', 'headphones',
  ],
  eventIds: ['ember', 'raccoon', 'rain'],
  airship: false,
};

export const CONCEPTS: Concept[] = [COZY_LIVING, CAMPING];

/** 매치에 쓸 콘셉트를 라운드 수만큼 고른다. 보유분이 모자라면 있는 것을 반복한다 */
export function pickConcepts(count: number, rng: () => number = Math.random): Concept[] {
  const forced = new URLSearchParams(location.search).get('concept');
  if (forced) {
    const found = CONCEPTS.find((c) => c.id === forced);
    if (found) return Array(count).fill(found);
  }
  const pool = [...CONCEPTS];
  const picked: Concept[] = [];
  while (picked.length < count) {
    if (pool.length === 0) pool.push(...CONCEPTS);
    picked.push(...pool.splice(Math.floor(rng() * pool.length), 1));
  }
  return picked;
}
