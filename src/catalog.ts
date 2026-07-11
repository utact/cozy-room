/**
 * 프롭 카탈로그.
 * - 물리 콜라이더는 shape/size(주 형태)로 만든다.
 * - 비주얼은 parts(다부품 조합)가 있으면 그걸 쓰고, 없으면 주 형태 하나로 그린다.
 * - assets/props/{id}.glb 가 존재하면 생성형 3D 모델이 비주얼을 대체한다(assets.ts).
 * - tags는 AI 심사 판정의 근거가 되므로 신중하게 부여할 것.
 */

export type PropShape = 'box' | 'ball' | 'cylinder' | 'cone';

export interface PropPart {
  shape: PropShape;
  /** box: 전체 크기 / ball: 반지름=x / cylinder·cone: 반지름=x, 반높이=y */
  size: [number, number, number];
  pos: [number, number, number];
  rot?: [number, number, number];
  /** 생략 시 프롭 기본색 */
  color?: number;
}

export interface PropMeta {
  id: string;
  /** 화면·심사평에 노출되는 한글 이름 */
  name: string;
  /** AI 심사 판정 근거 태그 */
  tags: string[];
  shape: PropShape;
  size: [number, number, number];
  color: number;
  /** 밀도 — 무거울수록 던지기 느리고 맞으면 아픔 */
  density: number;
  parts?: PropPart[];
  /** 줄다리기에서 뜯긴 팔 프롭 — 주인 플레이어 id (잡으면 재장착) */
  armOwner?: number;
}

const WOOD = 0x6b4a2f;
const DARK = 0x2f2f38;
const METAL = 0xcfd2d8;
const CREAM = 0xf0ead6;

export const PROP_CATALOG: PropMeta[] = [
  {
    id: 'frying-pan', name: '프라이팬', tags: ['무기', '주방', '금속', '방어', '요리'],
    shape: 'cylinder', size: [0.36, 0.06, 0.36], color: 0x4a4a55, density: 2.5,
    parts: [
      { shape: 'cylinder', size: [0.3, 0.045, 0.3], pos: [0.08, 0, 0], color: 0x3a3a44 },
      { shape: 'cylinder', size: [0.26, 0.02, 0.26], pos: [0.08, 0.035, 0], color: 0x23232b },
      { shape: 'box', size: [0.38, 0.05, 0.08], pos: [-0.34, 0.01, 0], color: WOOD },
    ],
  },
  {
    id: 'teddy-bear', name: '곰인형', tags: ['귀여움', '부드러움', '포근함', '로맨스', '선물'],
    shape: 'box', size: [0.45, 0.6, 0.4], color: 0xb5793b, density: 0.3,
    parts: [
      { shape: 'ball', size: [0.19, 0.19, 0.19], pos: [0, -0.09, 0] },
      { shape: 'ball', size: [0.14, 0.14, 0.14], pos: [0, 0.17, 0] },
      { shape: 'ball', size: [0.05, 0.05, 0.05], pos: [-0.1, 0.29, 0] },
      { shape: 'ball', size: [0.05, 0.05, 0.05], pos: [0.1, 0.29, 0] },
      { shape: 'ball', size: [0.06, 0.06, 0.06], pos: [0, 0.14, 0.11], color: 0xd9a869 },
      { shape: 'ball', size: [0.07, 0.07, 0.07], pos: [-0.19, -0.02, 0.03] },
      { shape: 'ball', size: [0.07, 0.07, 0.07], pos: [0.19, -0.02, 0.03] },
      { shape: 'ball', size: [0.08, 0.08, 0.08], pos: [-0.11, -0.26, 0.05] },
      { shape: 'ball', size: [0.08, 0.08, 0.08], pos: [0.11, -0.26, 0.05] },
    ],
  },
  {
    id: 'toaster', name: '토스터', tags: ['전자기기', '주방', '금속', '아침'],
    shape: 'box', size: [0.5, 0.36, 0.28], color: 0xd94f4f, density: 1.2,
    parts: [
      { shape: 'box', size: [0.5, 0.32, 0.28], pos: [0, -0.02, 0] },
      { shape: 'box', size: [0.36, 0.04, 0.07], pos: [0, 0.15, -0.06], color: DARK },
      { shape: 'box', size: [0.36, 0.04, 0.07], pos: [0, 0.15, 0.06], color: DARK },
      { shape: 'box', size: [0.05, 0.08, 0.06], pos: [0.26, 0, 0], color: DARK },
    ],
  },
  {
    id: 'plant-pot', name: '화분', tags: ['식물', '자연', '인테리어', '무거움', '선물'],
    shape: 'cylinder', size: [0.24, 0.35, 0.24], color: 0x5d9e57, density: 1.8,
    parts: [
      { shape: 'cylinder', size: [0.2, 0.16, 0.2], pos: [0, -0.19, 0], color: 0xa8593a },
      { shape: 'ball', size: [0.23, 0.23, 0.23], pos: [0, 0.14, 0] },
      { shape: 'ball', size: [0.14, 0.14, 0.14], pos: [0.12, 0.28, 0.05], color: 0x4c8a47 },
    ],
  },
  {
    id: 'guitar', name: '기타', tags: ['악기', '로맨스', '예술', '길쭉함', '낭만'],
    shape: 'box', size: [0.35, 1.1, 0.18], color: 0xa06a2c, density: 0.8,
    parts: [
      { shape: 'box', size: [0.34, 0.42, 0.13], pos: [0, -0.3, 0] },
      { shape: 'cylinder', size: [0.08, 0.02, 0.08], pos: [0, -0.26, 0.07], rot: [1.5708, 0, 0], color: DARK },
      { shape: 'box', size: [0.07, 0.62, 0.06], pos: [0, 0.16, 0], color: 0x5f3d1e },
      { shape: 'box', size: [0.1, 0.14, 0.07], pos: [0, 0.51, 0], color: 0x3c2712 },
    ],
  },
  {
    id: 'rubber-duck', name: '고무오리', tags: ['귀여움', '욕실', '가벼움', '유머', '장난감'],
    shape: 'ball', size: [0.24, 0.24, 0.24], color: 0xf5c531, density: 0.2,
    parts: [
      { shape: 'ball', size: [0.16, 0.16, 0.16], pos: [0, -0.05, 0] },
      { shape: 'ball', size: [0.1, 0.1, 0.1], pos: [0, 0.12, 0.06] },
      { shape: 'cone', size: [0.05, 0.05, 0.05], pos: [0, 0.11, 0.18], rot: [1.5708, 0, 0], color: 0xe86a2a },
    ],
  },
  {
    id: 'laptop', name: '노트북', tags: ['전자기기', '비쌈', '일', '소중함', '납작함'],
    shape: 'box', size: [0.55, 0.1, 0.4], color: 0x8a8f98, density: 1.0,
    parts: [
      { shape: 'box', size: [0.55, 0.03, 0.4], pos: [0, -0.03, 0.05] },
      { shape: 'box', size: [0.55, 0.36, 0.02], pos: [0, 0.12, -0.14], rot: [-0.35, 0, 0] },
      { shape: 'box', size: [0.48, 0.3, 0.015], pos: [0, 0.12, -0.125], rot: [-0.35, 0, 0], color: 0x1e2530 },
    ],
  },
  {
    id: 'pillow', name: '베개', tags: ['부드러움', '포근함', '수면', '방어', '무해함'],
    shape: 'box', size: [0.7, 0.18, 0.45], color: 0xe8e2f0, density: 0.15,
  },
  {
    id: 'baseball-bat', name: '야구방망이', tags: ['무기', '스포츠', '길쭉함', '나무', '든든함'],
    shape: 'cylinder', size: [0.08, 0.52, 0.08], color: 0xc98d4e, density: 1.1,
    parts: [
      { shape: 'cylinder', size: [0.075, 0.28, 0.075], pos: [0, 0.22, 0] },
      { shape: 'cylinder', size: [0.045, 0.24, 0.045], pos: [0, -0.26, 0], color: 0xb07a3e },
      { shape: 'ball', size: [0.06, 0.06, 0.06], pos: [0, -0.5, 0], color: 0x8c5e2e },
    ],
  },
  {
    id: 'wine-bottle', name: '와인병', tags: ['음식', '로맨스', '유리', '선물', '어른'],
    shape: 'cylinder', size: [0.11, 0.32, 0.11], color: 0x3a5a34, density: 1.4,
    parts: [
      { shape: 'cylinder', size: [0.1, 0.22, 0.1], pos: [0, -0.1, 0] },
      { shape: 'cylinder', size: [0.035, 0.12, 0.035], pos: [0, 0.24, 0] },
      { shape: 'box', size: [0.15, 0.14, 0.01], pos: [0, -0.08, 0.1], color: CREAM },
    ],
  },
  {
    id: 'cactus', name: '선인장', tags: ['식물', '뾰족함', '무기', '위험함', '인테리어'],
    shape: 'cylinder', size: [0.18, 0.45, 0.18], color: 0x3f7d3a, density: 0.9,
    parts: [
      { shape: 'cylinder', size: [0.16, 0.1, 0.16], pos: [0, -0.35, 0], color: 0xa8593a },
      { shape: 'cylinder', size: [0.11, 0.3, 0.11], pos: [0, 0.02, 0] },
      { shape: 'cylinder', size: [0.055, 0.12, 0.055], pos: [-0.17, 0.08, 0], rot: [0, 0, 1.1] },
      { shape: 'cylinder', size: [0.055, 0.1, 0.055], pos: [0.16, 0.16, 0], rot: [0, 0, -1.1] },
    ],
  },
  {
    id: 'tv-remote', name: 'TV 리모컨', tags: ['전자기기', '가벼움', '일상', '납작함'],
    shape: 'box', size: [0.18, 0.05, 0.4], color: DARK, density: 0.4,
    parts: [
      { shape: 'box', size: [0.16, 0.04, 0.38], pos: [0, 0, 0] },
      { shape: 'box', size: [0.1, 0.02, 0.08], pos: [0, 0.025, -0.1], color: 0xd93a3a },
      { shape: 'box', size: [0.1, 0.02, 0.14], pos: [0, 0.025, 0.08], color: 0x565460 },
    ],
  },
  {
    id: 'umbrella', name: '우산', tags: ['생존', '방어', '길쭉함', '비', '다용도'],
    shape: 'cylinder', size: [0.07, 0.5, 0.07], color: 0x3b5fb8, density: 0.6,
    parts: [
      { shape: 'cylinder', size: [0.022, 0.42, 0.022], pos: [0, -0.05, 0], color: 0x7a6a52 },
      { shape: 'cone', size: [0.3, 0.13, 0.3], pos: [0, 0.32, 0] },
      { shape: 'ball', size: [0.03, 0.03, 0.03], pos: [0, 0.48, 0], color: 0x7a6a52 },
      { shape: 'box', size: [0.09, 0.03, 0.03], pos: [0.035, -0.46, 0], color: 0x7a6a52 },
    ],
  },
  {
    id: 'microwave', name: '전자레인지', tags: ['전자기기', '주방', '무거움', '요리'],
    shape: 'box', size: [0.62, 0.4, 0.42], color: METAL, density: 2.2,
    parts: [
      { shape: 'box', size: [0.62, 0.4, 0.42], pos: [0, 0, 0] },
      { shape: 'box', size: [0.34, 0.28, 0.02], pos: [-0.08, 0, 0.21], color: 0x1c222c },
      { shape: 'box', size: [0.14, 0.3, 0.02], pos: [0.21, 0, 0.21], color: 0xb8bcc4 },
      { shape: 'ball', size: [0.025, 0.025, 0.025], pos: [0.21, 0.08, 0.23], color: DARK },
    ],
  },
  {
    id: 'flower', name: '꽃 한 송이', tags: ['로맨스', '선물', '자연', '향기', '가벼움'],
    shape: 'cylinder', size: [0.12, 0.3, 0.12], color: 0xe86fa4, density: 0.15,
    parts: [
      { shape: 'cylinder', size: [0.018, 0.2, 0.018], pos: [0, -0.1, 0], color: 0x3f7d3a },
      { shape: 'ball', size: [0.055, 0.055, 0.055], pos: [0, 0.12, 0], color: 0xf2d94e },
      { shape: 'ball', size: [0.05, 0.05, 0.05], pos: [0.09, 0.12, 0] },
      { shape: 'ball', size: [0.05, 0.05, 0.05], pos: [0.028, 0.12, 0.086] },
      { shape: 'ball', size: [0.05, 0.05, 0.05], pos: [-0.073, 0.12, 0.053] },
      { shape: 'ball', size: [0.05, 0.05, 0.05], pos: [-0.073, 0.12, -0.053] },
      { shape: 'ball', size: [0.05, 0.05, 0.05], pos: [0.028, 0.12, -0.086] },
    ],
  },
  {
    id: 'book', name: '두꺼운 책', tags: ['지식', '교양', '무기', '납작함', '든든함'],
    shape: 'box', size: [0.35, 0.12, 0.45], color: 0x7a4b96, density: 1.0,
    parts: [
      { shape: 'box', size: [0.35, 0.025, 0.45], pos: [0, -0.045, 0] },
      { shape: 'box', size: [0.33, 0.07, 0.42], pos: [0.012, 0, 0.01], color: CREAM },
      { shape: 'box', size: [0.35, 0.025, 0.45], pos: [0, 0.045, 0] },
    ],
  },
  {
    id: 'soccer-ball', name: '축구공', tags: ['스포츠', '장난감', '던지기좋음', '둥긂'],
    shape: 'ball', size: [0.28, 0.28, 0.28], color: 0xf0eee9, density: 0.5,
    parts: [
      { shape: 'ball', size: [0.28, 0.28, 0.28], pos: [0, 0, 0] },
      { shape: 'ball', size: [0.09, 0.09, 0.09], pos: [0, 0.22, 0.11], color: DARK },
      { shape: 'ball', size: [0.09, 0.09, 0.09], pos: [0.19, -0.1, 0.14], color: DARK },
      { shape: 'ball', size: [0.09, 0.09, 0.09], pos: [-0.19, -0.1, 0.14], color: DARK },
    ],
  },
  {
    id: 'ramen-pot', name: '라면냄비', tags: ['주방', '음식', '금속', '요리', '한국인'],
    shape: 'cylinder', size: [0.3, 0.2, 0.3], color: 0xd8b23a, density: 1.3,
    parts: [
      { shape: 'cylinder', size: [0.28, 0.16, 0.28], pos: [0, -0.03, 0] },
      { shape: 'cylinder', size: [0.3, 0.018, 0.3], pos: [0, 0.15, 0], color: METAL },
      { shape: 'ball', size: [0.04, 0.04, 0.04], pos: [0, 0.2, 0], color: DARK },
      { shape: 'box', size: [0.1, 0.03, 0.12], pos: [-0.34, 0.06, 0], color: DARK },
      { shape: 'box', size: [0.1, 0.03, 0.12], pos: [0.34, 0.06, 0], color: DARK },
    ],
  },
  {
    id: 'fire-ext', name: '소화기', tags: ['생존', '안전', '무거움', '금속', '든든함'],
    shape: 'cylinder', size: [0.15, 0.42, 0.15], color: 0xc42f2f, density: 2.0,
    parts: [
      { shape: 'cylinder', size: [0.13, 0.32, 0.13], pos: [0, -0.06, 0] },
      { shape: 'cylinder', size: [0.05, 0.07, 0.05], pos: [0, 0.32, 0], color: DARK },
      { shape: 'box', size: [0.03, 0.2, 0.03], pos: [0.13, 0.22, 0], rot: [0, 0, 0.5], color: 0x1f1f24 },
    ],
  },
  {
    id: 'game-pad', name: '게임패드', tags: ['전자기기', '장난감', '일상', '소중함'],
    shape: 'box', size: [0.3, 0.12, 0.2], color: 0x4442d6, density: 0.4,
    parts: [
      { shape: 'box', size: [0.28, 0.09, 0.16], pos: [0, 0, -0.01] },
      { shape: 'ball', size: [0.07, 0.07, 0.07], pos: [-0.13, -0.01, 0.05] },
      { shape: 'ball', size: [0.07, 0.07, 0.07], pos: [0.13, -0.01, 0.05] },
      { shape: 'ball', size: [0.022, 0.022, 0.022], pos: [0.08, 0.055, -0.03], color: 0xd93a3a },
      { shape: 'ball', size: [0.022, 0.022, 0.022], pos: [0.11, 0.055, 0.005], color: 0x3fbf5e },
    ],
  },
  {
    id: 'skateboard', name: '스케이트보드', tags: ['스포츠', '탈것', '납작함', '멋짐'],
    shape: 'box', size: [0.75, 0.12, 0.25], color: 0x30b8a8, density: 0.9,
    parts: [
      { shape: 'box', size: [0.7, 0.035, 0.24], pos: [0, 0.045, 0] },
      { shape: 'ball', size: [0.05, 0.05, 0.05], pos: [-0.25, -0.02, 0.09], color: 0xf2e14c },
      { shape: 'ball', size: [0.05, 0.05, 0.05], pos: [-0.25, -0.02, -0.09], color: 0xf2e14c },
      { shape: 'ball', size: [0.05, 0.05, 0.05], pos: [0.25, -0.02, 0.09], color: 0xf2e14c },
      { shape: 'ball', size: [0.05, 0.05, 0.05], pos: [0.25, -0.02, -0.09], color: 0xf2e14c },
    ],
  },
  {
    id: 'lamp', name: '스탠드 조명', tags: ['인테리어', '전자기기', '길쭉함', '분위기'],
    shape: 'cone', size: [0.24, 0.42, 0.24], color: 0xf2d98c, density: 0.7,
    parts: [
      { shape: 'cylinder', size: [0.14, 0.02, 0.14], pos: [0, -0.4, 0], color: 0x4a4a55 },
      { shape: 'cylinder', size: [0.022, 0.3, 0.022], pos: [0, -0.08, 0], color: 0x4a4a55 },
      { shape: 'cone', size: [0.2, 0.14, 0.2], pos: [0, 0.32, 0] },
    ],
  },
  {
    id: 'watermelon', name: '수박', tags: ['음식', '무거움', '둥긂', '여름', '유머'],
    shape: 'ball', size: [0.32, 0.32, 0.32], color: 0x2e7d3e, density: 1.6,
    parts: [
      { shape: 'ball', size: [0.32, 0.32, 0.32], pos: [0, 0, 0] },
      { shape: 'cylinder', size: [0.02, 0.05, 0.02], pos: [0, 0.34, 0], rot: [0.3, 0, 0], color: 0x5f4a2e },
      { shape: 'ball', size: [0.06, 0.06, 0.06], pos: [0, 0.18, 0.27], color: 0x1e5c2c },
      { shape: 'ball', size: [0.06, 0.06, 0.06], pos: [0.24, 0, 0.2], color: 0x1e5c2c },
      { shape: 'ball', size: [0.06, 0.06, 0.06], pos: [-0.24, 0, 0.2], color: 0x1e5c2c },
    ],
  },
  {
    id: 'keyboard', name: '기계식 키보드', tags: ['전자기기', '일', '무기', '납작함', '소중함'],
    shape: 'box', size: [0.5, 0.06, 0.2], color: 0x35333d, density: 0.8,
    parts: [
      { shape: 'box', size: [0.5, 0.05, 0.2], pos: [0, 0, 0] },
      { shape: 'box', size: [0.44, 0.025, 0.14], pos: [0, 0.03, 0], color: 0x565460 },
      { shape: 'box', size: [0.14, 0.03, 0.04], pos: [0.05, 0.032, 0.055], color: 0x8a86d6 },
    ],
  },
  {
    id: 'trophy', name: '트로피', tags: ['비쌈', '금속', '소중함', '자랑', '반짝임'],
    shape: 'cone', size: [0.2, 0.32, 0.2], color: 0xe3b341, density: 1.5,
    parts: [
      { shape: 'cone', size: [0.18, 0.15, 0.18], pos: [0, 0.16, 0], rot: [3.1416, 0, 0] },
      { shape: 'cylinder', size: [0.04, 0.09, 0.04], pos: [0, -0.08, 0] },
      { shape: 'box', size: [0.24, 0.08, 0.24], pos: [0, -0.24, 0], color: 0x4a3524 },
    ],
  },
  {
    id: 'slipper', name: '삼선 슬리퍼', tags: ['무기', '일상', '납작함', '유머', '한국인'],
    shape: 'box', size: [0.16, 0.07, 0.4], color: 0x3654b0, density: 0.3,
    parts: [
      { shape: 'box', size: [0.15, 0.04, 0.4], pos: [0, -0.01, 0] },
      { shape: 'box', size: [0.16, 0.028, 0.13], pos: [0, 0.03, -0.05] },
      { shape: 'box', size: [0.165, 0.03, 0.025], pos: [0, 0.032, -0.09], color: 0xf0f0f0 },
      { shape: 'box', size: [0.165, 0.03, 0.025], pos: [0, 0.032, -0.05], color: 0xf0f0f0 },
      { shape: 'box', size: [0.165, 0.03, 0.025], pos: [0, 0.032, -0.01], color: 0xf0f0f0 },
    ],
  },
  {
    id: 'blanket', name: '담요', tags: ['부드러움', '포근함', '수면', '생존', '무해함'],
    shape: 'box', size: [0.6, 0.15, 0.6], color: 0xd9788f, density: 0.2,
    parts: [
      { shape: 'box', size: [0.6, 0.13, 0.6], pos: [0, 0, 0] },
      { shape: 'box', size: [0.62, 0.05, 0.62], pos: [0, -0.02, 0], color: 0xc4607a },
    ],
  },
  {
    id: 'first-aid', name: '구급상자', tags: ['생존', '안전', '의료', '다용도', '든든함'],
    shape: 'box', size: [0.4, 0.25, 0.3], color: 0xf4f4f2, density: 0.8,
    parts: [
      { shape: 'box', size: [0.4, 0.25, 0.3], pos: [0, 0, 0] },
      { shape: 'box', size: [0.05, 0.02, 0.18], pos: [0, 0.13, 0], color: 0xd93a3a },
      { shape: 'box', size: [0.18, 0.02, 0.05], pos: [0, 0.13, 0], color: 0xd93a3a },
      { shape: 'box', size: [0.42, 0.04, 0.32], pos: [0, 0.02, 0], color: 0xd93a3a },
    ],
  },
];
