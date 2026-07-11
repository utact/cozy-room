/** 룸 테마 — 매치마다 랜덤 선택. 팔레트·가구 배치·프롭 가중치가 달라진다. */

export interface Furniture {
  x: number; z: number;
  hx: number; hy: number; hz: number;
  color: number;
}

export interface RoomTheme {
  id: string;
  name: string;
  floor: number;
  rug: number | null;
  wall: number;
  /** 포인트 조명 색 (분위기) */
  glow: number;
  furniture: Furniture[];
  /** 이 태그를 가진 프롭이 추가로 더 스폰된다 */
  boostTags: string[];
}

export const THEMES: RoomTheme[] = [
  {
    id: 'living',
    name: '코지 거실',
    floor: 0x8a6d55,
    rug: 0xb0485c,
    wall: 0x5e5378,
    glow: 0xffb86b,
    furniture: [
      { x: -4.2, z: -2.8, hx: 1.6, hy: 0.45, hz: 1.0, color: 0x9a7b4f }, // 티테이블
      { x: 4.5, z: 2.2, hx: 1.2, hy: 0.45, hz: 1.4, color: 0x9a7b4f },
      { x: 0, z: -4.9, hx: 2.2, hy: 0.5, hz: 0.7, color: 0x7d4b68 },    // 소파
    ],
    boostTags: ['포근함', '인테리어', '장난감'],
  },
  {
    id: 'office',
    name: '야근 사무실',
    floor: 0x6e7076,
    rug: 0x4c5668,
    wall: 0x474a58,
    glow: 0x8ad0ff,
    furniture: [
      { x: -4.6, z: -3.2, hx: 2.0, hy: 0.42, hz: 0.8, color: 0xb0a695 }, // 책상 줄
      { x: -4.6, z: 0.6, hx: 2.0, hy: 0.42, hz: 0.8, color: 0xb0a695 },
      { x: 4.8, z: -1.4, hx: 0.9, hy: 0.42, hz: 2.2, color: 0xb0a695 },
      { x: 1.2, z: 4.2, hx: 1.4, hy: 0.55, hz: 0.6, color: 0x5a616e },   // 파티션
    ],
    boostTags: ['전자기기', '일', '지식'],
  },
  {
    id: 'kitchen',
    name: '심야 주방',
    floor: 0xa89680,
    rug: null,
    wall: 0x715c50,
    glow: 0xffd98c,
    furniture: [
      { x: 0, z: -0.6, hx: 2.6, hy: 0.5, hz: 1.1, color: 0xcabba4 },    // 아일랜드 조리대
      { x: -5.4, z: 3.6, hx: 1.4, hy: 0.45, hz: 1.0, color: 0x8c6f52 }, // 식탁
      { x: 5.6, z: -3.8, hx: 1.1, hy: 0.6, hz: 1.1, color: 0xd8d3c8 },  // 냉장고(낮은 버전)
    ],
    boostTags: ['주방', '음식', '요리'],
  },
];

export function pickTheme(rng: () => number = Math.random): RoomTheme {
  return THEMES[Math.floor(rng() * THEMES.length)];
}
