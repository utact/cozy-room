/**
 * 라운드 주제 풀 — 콘셉트별로 묶인다.
 *
 * 한 콘셉트의 질문은 서로 태그 축이 겹치지 않아야 한다. 겹치면 어느 질문이 뽑혀도
 * 같은 프롭이 정답이 되어 라운드가 반복처럼 느껴진다.
 */

export interface Topic {
  text: string;
  /** 태그별 가산점 (양수) / 감점 (음수) */
  tagWeights: Record<string, number>;
}

/** 콘셉트 1「코지 거실」 — 소중함 / 소음 / 포근함 세 축 */
export const LIVING_ROOM_TOPICS: Topic[] = [
  {
    text: '집에 불났다! 하나만 들고 튀어라!',
    tagWeights: {
      소중함: 40, 비쌈: 28, 안전: 18, 추억: 18, 생존: 15,
      무거움: -22, 청소: -12, 소음: -10,
    },
  },
  {
    text: '층간소음 복수전, 무엇으로 응수할까?',
    tagWeights: {
      소음: 42, 무거움: 22, 길쭉함: 16, 청소: 10, 전자기기: 8,
      부드러움: -28, 포근함: -22, 소중함: -12,
    },
  },
  {
    text: '넷플릭스 정주행 필수템은?',
    tagWeights: {
      포근함: 40, 부드러움: 24, 수면: 22, 전자기기: 20, 일상: 15,
      청소: -25, 소음: -18, 무거움: -12,
    },
  },
];

export function pickTopics(
  pool: Topic[],
  count: number,
  rng: () => number = Math.random,
): Topic[] {
  const rest = [...pool];
  const picked: Topic[] = [];
  while (picked.length < count && rest.length > 0) {
    picked.push(...rest.splice(Math.floor(rng() * rest.length), 1));
  }
  return picked;
}
