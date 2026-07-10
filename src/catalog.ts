/**
 * 프롭 카탈로그 — M1은 프리미티브 스탠드인.
 * M3에서 생성형 3D GLB로 교체될 때도 이 메타데이터(id/이름/태그)는 그대로 유지된다.
 * tags는 AI 심사 판정의 근거가 되므로 신중하게 부여할 것.
 */

export type PropShape = 'box' | 'ball' | 'cylinder' | 'cone';

export interface PropMeta {
  id: string;
  /** 화면·심사평에 노출되는 한글 이름 */
  name: string;
  /** AI 심사 판정 근거 태그 */
  tags: string[];
  shape: PropShape;
  /** [x, y, z] 또는 반지름 스케일(m) */
  size: [number, number, number];
  color: number;
  /** 밀도 — 무거울수록 던지기 느리고 맞으면 아픔 */
  density: number;
}

export const PROP_CATALOG: PropMeta[] = [
  { id: 'frying-pan',  name: '프라이팬',     tags: ['무기', '주방', '금속', '방어', '요리'],        shape: 'cylinder', size: [0.5, 0.1, 0.5],  color: 0x4a4a55, density: 2.5 },
  { id: 'teddy-bear',  name: '곰인형',       tags: ['귀여움', '부드러움', '포근함', '로맨스', '선물'], shape: 'box',      size: [0.5, 0.6, 0.4],  color: 0xb5793b, density: 0.3 },
  { id: 'toaster',     name: '토스터',       tags: ['전자기기', '주방', '금속', '아침'],             shape: 'box',      size: [0.5, 0.4, 0.3],  color: 0xd94f4f, density: 1.2 },
  { id: 'plant-pot',   name: '화분',         tags: ['식물', '자연', '인테리어', '무거움', '선물'],    shape: 'cone',     size: [0.35, 0.5, 0.35], color: 0x5d9e57, density: 1.8 },
  { id: 'guitar',      name: '기타',         tags: ['악기', '로맨스', '예술', '길쭉함', '낭만'],      shape: 'box',      size: [0.35, 1.1, 0.2],  color: 0xa06a2c, density: 0.8 },
  { id: 'rubber-duck', name: '고무오리',     tags: ['귀여움', '욕실', '가벼움', '유머', '장난감'],    shape: 'ball',     size: [0.28, 0.28, 0.28], color: 0xf5c531, density: 0.2 },
  { id: 'laptop',      name: '노트북',       tags: ['전자기기', '비쌈', '일', '소중함', '납작함'],    shape: 'box',      size: [0.55, 0.06, 0.4],  color: 0x8a8f98, density: 1.0 },
  { id: 'pillow',      name: '베개',         tags: ['부드러움', '포근함', '수면', '방어', '무해함'],   shape: 'box',      size: [0.7, 0.18, 0.45], color: 0xe8e2f0, density: 0.15 },
  { id: 'baseball-bat',name: '야구방망이',   tags: ['무기', '스포츠', '길쭉함', '나무', '든든함'],    shape: 'cylinder', size: [0.09, 1.0, 0.09], color: 0xc98d4e, density: 1.1 },
  { id: 'wine-bottle', name: '와인병',       tags: ['음식', '로맨스', '유리', '선물', '어른'],        shape: 'cylinder', size: [0.12, 0.5, 0.12], color: 0x6d2438, density: 1.4 },
  { id: 'cactus',      name: '선인장',       tags: ['식물', '뾰족함', '무기', '위험함', '인테리어'],   shape: 'cylinder', size: [0.2, 0.55, 0.2],  color: 0x3f7d3a, density: 0.9 },
  { id: 'tv-remote',   name: 'TV 리모컨',    tags: ['전자기기', '가벼움', '일상', '납작함'],          shape: 'box',      size: [0.18, 0.05, 0.4],  color: 0x2f2f38, density: 0.4 },
  { id: 'umbrella',    name: '우산',         tags: ['생존', '방어', '길쭉함', '비', '다용도'],        shape: 'cylinder', size: [0.08, 0.9, 0.08], color: 0x3b5fb8, density: 0.6 },
  { id: 'microwave',   name: '전자레인지',   tags: ['전자기기', '주방', '무거움', '요리'],            shape: 'box',      size: [0.65, 0.42, 0.45], color: 0xcfd2d8, density: 2.2 },
  { id: 'flower',      name: '꽃 한 송이',   tags: ['로맨스', '선물', '자연', '향기', '가벼움'],      shape: 'cone',     size: [0.15, 0.45, 0.15], color: 0xe86fa4, density: 0.15 },
  { id: 'book',        name: '두꺼운 책',    tags: ['지식', '교양', '무기', '납작함', '든든함'],      shape: 'box',      size: [0.35, 0.12, 0.45], color: 0x7a4b96, density: 1.0 },
  { id: 'soccer-ball', name: '축구공',       tags: ['스포츠', '장난감', '던지기좋음', '둥긂'],        shape: 'ball',     size: [0.3, 0.3, 0.3],   color: 0xf0eee9, density: 0.5 },
  { id: 'ramen-pot',   name: '라면냄비',     tags: ['주방', '음식', '금속', '요리', '한국인'],        shape: 'cylinder', size: [0.3, 0.22, 0.3],  color: 0xd8b23a, density: 1.3 },
  { id: 'fire-ext',    name: '소화기',       tags: ['생존', '안전', '무거움', '금속', '든든함'],      shape: 'cylinder', size: [0.16, 0.5, 0.16], color: 0xc42f2f, density: 2.0 },
  { id: 'game-pad',    name: '게임패드',     tags: ['전자기기', '장난감', '일상', '소중함'],          shape: 'box',      size: [0.3, 0.12, 0.2],  color: 0x4442d6, density: 0.4 },
  { id: 'skateboard',  name: '스케이트보드', tags: ['스포츠', '탈것', '납작함', '멋짐'],              shape: 'box',      size: [0.8, 0.08, 0.25], color: 0x30b8a8, density: 0.9 },
  { id: 'lamp',        name: '스탠드 조명',  tags: ['인테리어', '전자기기', '길쭉함', '분위기'],      shape: 'cone',     size: [0.3, 0.8, 0.3],   color: 0xf2d98c, density: 0.7 },
  { id: 'watermelon',  name: '수박',         tags: ['음식', '무거움', '둥긂', '여름', '유머'],        shape: 'ball',     size: [0.35, 0.35, 0.35], color: 0x2e7d3e, density: 1.6 },
  { id: 'keyboard',    name: '기계식 키보드', tags: ['전자기기', '일', '무기', '납작함', '소중함'],    shape: 'box',      size: [0.5, 0.06, 0.2],  color: 0x35333d, density: 0.8 },
  { id: 'trophy',      name: '트로피',       tags: ['비쌈', '금속', '소중함', '자랑', '반짝임'],      shape: 'cone',     size: [0.22, 0.5, 0.22], color: 0xe3b341, density: 1.5 },
  { id: 'slipper',     name: '삼선 슬리퍼',  tags: ['무기', '일상', '납작함', '유머', '한국인'],      shape: 'box',      size: [0.15, 0.06, 0.4],  color: 0x3654b0, density: 0.3 },
  { id: 'blanket',     name: '담요',         tags: ['부드러움', '포근함', '수면', '생존', '무해함'],   shape: 'box',      size: [0.6, 0.15, 0.6],  color: 0xd9788f, density: 0.2 },
  { id: 'first-aid',   name: '구급상자',     tags: ['생존', '안전', '의료', '다용도', '든든함'],      shape: 'box',      size: [0.4, 0.25, 0.3],  color: 0xf4f4f2, density: 0.8 },
];
