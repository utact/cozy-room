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
 * 가구는 방 안쪽까지 들어온다. 예전에는 전부 벽에 붙이고 중앙을 비웠는데 — 가구 그림자가
 * 바닥의 프롭을 가리지 않게 하려는 의도였다 — 그 결과 8×5.5짜리 빈 마루가 생겼다.
 * 뛰어들 틈도 걸려 넘어질 것도 없으면 물리 난투가 산책이 된다.
 *
 * 대신 **중앙에는 낮은 것만 둔다**. 티테이블은 높이 0.4라 그림자가 0.37밖에 안 되고,
 * 상판 위에 프롭이 올라가면 오히려 눈에 더 잘 띈다. 등받이가 높은 소파만 벽에 붙인다.
 *
 * 창문은 뒷벽 중앙이라 그 앞은 비워 둔다 — 돌풍의 출처가 가려지면 안 된다.
 */
const COZY_LIVING: Concept = {
  id: 'living',
  name: '코지 거실',
  floorTex: 'floor',
  wallTex: 'wall',
  rug: { tex: 'rug', w: 5.6, d: 3.9 },
  shade: 0x191411, // --night
  glow: 0xf0a94c,  // --lamp
  // 반치수는 GLB 실측 비율(tools 로 잰 바운딩 박스)에서 역산했다. instantiateFurniture 가
  // max(hx,hy,hz)×2 를 최대 변으로 삼아 정규화하므로, 비율이 어긋나면 상판과 콜라이더가
  // 따로 놀아 물건이 공중에 뜨거나 파묻힌다.
  furniture: [
    // 소파 — 뒷벽 밀착. 등받이가 높아도 뒷벽이라 바닥을 가리지 않는다
    { glb: 'sofa', x: -3.4, z: -4.1, hx: 1.6, hy: 0.4, hz: 0.5 },
    // 티테이블 — 소파 앞 0.9. 그 틈은 좁은 통로가 된다(캡슐 지름 0.68)
    { glb: 'coffee-table', x: -3.4, z: -2.3, hx: 0.7, hy: 0.2, hz: 0.45 },
    // TV장 + TV — 앞벽에서 소파와 마주 본다
    { glb: 'tv-stand', x: -3.4, z: 4.2, hx: 1.2, hy: 0.415, hz: 0.25 },
    // 1인 안락의자 — 우측. 예전엔 소파를 한 번 더 복사해 놨는데 같은 화면에 소파가 둘이면
    // 밀도는 올라가도 에셋을 돌려막은 게 그대로 읽혔다 (GLB 1.93×1.99×2.00)
    { glb: 'armchair', x: 5.1, z: -1.2, hx: 0.502, hy: 0.517, hz: 0.52,
      rotY: -Math.PI / 2.4 },
    // 낮은 책장 — 우측벽. 높이 1.1이라 벽면이면 바닥을 가리지 않는다 (GLB 1.69×2.00×1.03)
    { glb: 'bookshelf', x: 5.4, z: 2.6, hx: 0.465, hy: 0.55, hz: 0.284,
      rotY: -Math.PI / 2 },
    // 플로어 램프 — 뒷벽 우측. 방의 온기를 담당하는 실제 광원이다 (GLB 0.71×2.00×0.71)
    {
      glb: 'floor-lamp', x: 2.6, z: -4.0, hx: 0.231, hy: 0.65, hz: 0.231,
      glow: { y: 1.15, color: 0xf0a94c, intensity: 7, distance: 5.5 },
    },
    // 중앙 티테이블 — 러그 오른쪽 끝. 방 한복판을 가로지를 때 돌아가게 만드는 유일한 장애물
    { glb: 'coffee-table', x: 1.4, z: 2.9, hx: 0.7, hy: 0.2, hz: 0.45 },
  ],
  decals: [
    // 창문 — 돌풍의 출처이자 정전 때의 유일한 광원. 벽 시각높이 1.4 안에 들어간다
    { tex: 'window', x: 0, y: 0.72, z: -4.73, w: 3, h: 1.0 },
  ],
  // 창문 양옆에 한 장씩. 모드가 꺼져 있어도 흔들려서 "창문이 열려 있다"는 신호가 끊기지 않는다
  curtain: { x: 0, y: 1.24, z: -4.65, w: 1.0, h: 1.05, color: 0xf7efe4 },
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
 * 화로대를 중심으로 테이블·아이스박스를 둘러 배치한다. 거실과 마찬가지로 높이 0.6 이하만
 * 안쪽에 두므로 프롭이 가구 뒤에 숨지 않는다.
 *
 * 프롭은 거실 12종을 그대로 쓴다. 그래서 질문도 **그 12종으로 답할 수 있는 것만** 낸다 —
 * "고기 다 탄다, 뭐가 필요해?"처럼 방에 없는 물건(집게·토치)을 정답으로 요구하는 질문은
 * 태그가 하나도 안 걸려 점수가 기본점 30 + 난수로 수렴한다. topics.ts 주석 참고.
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
    // 화로대 — 캠핑장의 중심. 모닥불 주위에 나머지를 둘러 앉히면 "왜 저것만 한가운데 있지"가
    // 아니라 "여기가 불멍 자리구나"로 읽힌다. 높이 0.42라 가리는 바닥은 0.39에 그친다
    {
      glb: 'fire-pit', x: -0.4, z: -0.6, hx: 0.6, hy: 0.21, hz: 0.6,
      glow: { y: 0.3, color: 0xf0a94c, intensity: 6, distance: 4.5 },
    },
    // 캠핑 테이블 — 좌측. 거실 티테이블과 같은 역할(상판 프롭). GLB 1.99×1.05×1.16
    { glb: 'camp-table', x: -5.2, z: 0.8, hx: 0.65, hy: 0.343, hz: 0.379 },
    // 아이스박스 — 우측. 너구리가 튀어나오는 굴. GLB 2.00×1.25×1.43
    { glb: 'cooler', x: 5.6, z: 1.4, hx: 0.475, hy: 0.297, hz: 0.34 },
    // 캠핑 의자 둘 — 불을 사이에 두고 마주 본다. 여기가 불멍 자리라는 걸 배치로 말한다
    // (GLB 1.90×2.00×1.29)
    { glb: 'camp-chair', x: -2.6, z: -2.5, hx: 0.45, hy: 0.475, hz: 0.306,
      rotY: Math.PI / 5 },
    { glb: 'camp-chair', x: 1.9, z: -2.4, hx: 0.45, hy: 0.475, hz: 0.306,
      rotY: -Math.PI / 5 },
    // 장작더미 — 화로대 옆. 불의 연료가 옆에 있어야 화로대가 장식이 아니게 된다
    // (GLB 2.00×1.88×1.90)
    { glb: 'log-pile', x: -2.2, z: 0.7, hx: 0.42, hy: 0.395, hz: 0.399 },
    // 랜턴 — 우측 앞. 화로대와 떨어진 곳에 두 번째 광원을 둬 그림자가 한쪽으로만
    // 몰리지 않게 한다 (GLB 0.89×2.00×0.78)
    {
      glb: 'lantern', x: 3.4, z: 2.9, hx: 0.122, hy: 0.275, hz: 0.108,
      glow: { y: 0.42, color: 0xffc978, intensity: 4, distance: 4 },
    },
  ],
  decals: [
    // 텐트 — 뒷벽 중앙. 소나기 때 자락이 펄럭인다
    { tex: 'tent', x: 0, y: 0.7, z: -4.73, w: 3.5, h: 1.4 },
  ],
  // 텐트 자락 — 거실 커튼과 같은 코드로 흔든다. 호출자만 RainEvent로 바뀐다
  curtain: { x: 0, y: 1.25, z: -4.65, w: 0.85, h: 0.95, color: 0xc9905a },
  topics: CAMPING_TOPICS,
  // 1단계 임시 — 거실 프롭 12종 재사용. 2단계에서 캠핑 전용으로 교체한다
  propIds: [
    'photo-frame', 'laptop', 'passport-pouch', 'teddy-bear',
    'broom', 'vacuum', 'speaker', 'monstera',
    'blanket', 'cushion', 'tv-remote', 'headphones',
  ],
  eventIds: ['raccoon', 'rain'],
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
