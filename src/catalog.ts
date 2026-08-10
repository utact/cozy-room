/**
 * 프롭 카탈로그 — 콘셉트 1「코지 거실」 12종.
 *
 * 비주얼은 전적으로 `public/assets/props/{id}.glb` 가 담당한다. 절차적 폴백은 없다.
 * 여기 남은 shape/size 는 **물리 콜라이더 전용**이다 — GLB에서 convex hull을 뽑으면
 * 액자·리모컨처럼 얇은 물건에서 부정확해져 잡기·던지기 체감이 예측 불가능해진다.
 *
 * size 는 게임 안에서의 실제 크기이기도 하다. assets.ts 가 GLB를 이 치수에 맞춰 정규화한다.
 * tags 는 AI 심사 판정의 근거이므로 신중하게 부여할 것.
 */

export type PropShape = 'box' | 'ball' | 'cylinder' | 'cone';

export interface PropMeta {
  id: string;
  /** 화면·심사평에 노출되는 한글 이름 */
  name: string;
  /** AI 심사 판정 근거 태그 */
  tags: string[];
  /** 콜라이더 형태 */
  shape: PropShape;
  /** box: 전체 크기 / ball: 반지름=x / cylinder·cone: 반지름=x, 반높이=y */
  size: [number, number, number];
  /** 밀도 — 무거울수록 던지기 느리고 맞으면 아프다 */
  density: number;
}

/**
 * 닮은꼴 그룹 — 위에서 봤을 때 실루엣이 서로 닮은 묶음.
 * 정전 모드의 판단 부하와 일치 라운드의 낚임이 여기서 나온다.
 * 그룹 안의 프롭은 최대 변 길이를 ±20% 안에 맞춰 크기만으로 구별되지 않게 한다.
 */
const GROUPS: string[][] = [
  ['monstera', 'speaker'],                  // A — 둥근 덩어리
  ['photo-frame', 'laptop', 'tv-remote'],   // B — 납작한 사각형
  ['blanket', 'cushion'],                   // C — 부드러운 사각 덩어리
];

/** id → 같은 그룹의 나머지 */
export const LOOKALIKES: Record<string, string[]> = Object.fromEntries(
  GROUPS.flatMap((g) => g.map((id) => [id, g.filter((o) => o !== id)])),
);

/**
 * 치수는 전부 실물보다 크다 — 캐릭터 키 1.52 대비 최대 변 0.5~0.9다.
 *
 * 사실적인 비율(리모컨 0.15)로 두면 게임 카메라에서 20px짜리 점이 되어 "무엇을 들었는가"가
 * 안 보인다. 이 게임의 판단은 전부 실루엣 식별에서 나오므로 판독성이 사실성을 이긴다.
 * 대신 무게감은 density가 담당한다 — 리모컨은 커도 가볍고 청소기는 묵직하다.
 */
export const PROP_CATALOG: PropMeta[] = [
  // ── 화재 대피 후보 ──
  {
    id: 'photo-frame', name: '가족 사진 액자', tags: ['소중함', '추억', '인테리어', '납작함'],
    shape: 'box', size: [0.72, 0.09, 0.5], density: 0.6,
  },
  {
    id: 'laptop', name: '노트북', tags: ['비쌈', '전자기기', '일', '소중함', '납작함'],
    shape: 'box', size: [0.72, 0.23, 0.46], density: 1.0,
  },
  {
    id: 'passport-pouch', name: '여권·통장 파우치', tags: ['소중함', '안전', '생존', '가벼움'],
    shape: 'box', size: [0.5, 0.32, 0.27], density: 0.4,
  },
  {
    id: 'teddy-bear', name: '곰인형', tags: ['귀여움', '포근함', '부드러움', '소중함'],
    shape: 'box', size: [0.56, 0.63, 0.45], density: 0.3,
  },

  // ── 층간소음 복수 후보 ──
  {
    id: 'broom', name: '빗자루', tags: ['청소', '정리', '길쭉함', '소음'],
    shape: 'box', size: [0.32, 0.98, 0.24], density: 0.5,
  },
  {
    id: 'vacuum', name: '무선청소기', tags: ['청소', '정리', '전자기기', '무거움', '소음'],
    shape: 'box', size: [0.43, 0.81, 0.9], density: 1.4,
  },
  {
    id: 'speaker', name: '블루투스 스피커', tags: ['전자기기', '파티', '분위기', '소음'],
    shape: 'cylinder', size: [0.21, 0.33, 0.21], density: 0.8,
  },
  {
    id: 'monstera', name: '몬스테라 화분', tags: ['인테리어', '식물', '자연', '무거움'],
    shape: 'box', size: [0.7, 0.63, 0.69], density: 1.8,
  },

  // ── 넷플릭스 정주행 후보 ──
  {
    id: 'blanket', name: '극세사 담요', tags: ['포근함', '수면', '부드러움', '생존'],
    shape: 'box', size: [0.7, 0.45, 0.57], density: 0.2,
  },
  {
    id: 'cushion', name: '쿠션', tags: ['포근함', '부드러움', '수면', '인테리어'],
    shape: 'box', size: [0.63, 0.6, 0.42], density: 0.15,
  },
  {
    id: 'tv-remote', name: 'TV 리모컨', tags: ['전자기기', '일상', '납작함', '가벼움'],
    shape: 'box', size: [0.63, 0.23, 0.13], density: 0.35,
  },
  {
    id: 'headphones', name: '헤드폰', tags: ['전자기기', '수면', '소중함', '분위기'],
    shape: 'box', size: [0.56, 0.48, 0.2], density: 0.45,
  },
];
