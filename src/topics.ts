/**
 * 라운드 주제 풀 — 콘셉트별로 묶인다.
 *
 * 한 콘셉트의 질문은 서로 태그 축이 겹치지 않아야 한다. 겹치면 어느 질문이 뽑혀도
 * 같은 프롭이 정답이 되어 라운드가 반복처럼 느껴진다.
 */

export interface Topic {
  /** verdicts.ts 의 전용 심사평을 찾는 키 */
  id: string;
  text: string;
  /** 태그별 가산점 (양수) / 감점 (음수) */
  tagWeights: Record<string, number>;
}

/** 콘셉트 1「코지 거실」 — 소중함 / 소음 / 포근함 세 축 */
export const LIVING_ROOM_TOPICS: Topic[] = [
  {
    id: 'fire',
    text: '집에 불났다! 하나만 들고 튀어라!',
    tagWeights: {
      소중함: 40, 비쌈: 28, 안전: 18, 추억: 18, 생존: 15,
      무거움: -22, 청소: -12, 소음: -10,
    },
  },
  {
    id: 'noise',
    text: '층간소음 복수전, 무엇으로 응수할까?',
    tagWeights: {
      소음: 42, 무거움: 22, 길쭉함: 16, 청소: 10, 전자기기: 8,
      부드러움: -28, 포근함: -22, 소중함: -12,
    },
  },
  {
    id: 'netflix',
    text: '넷플릭스 정주행 필수템은?',
    tagWeights: {
      포근함: 40, 부드러움: 24, 수면: 22, 전자기기: 20, 일상: 15,
      청소: -25, 소음: -18, 무거움: -12,
    },
  },
];

/**
 * 콘셉트 2「오토캠핑 데크」— 생존·안전 / 분위기 / 포근함 세 축.
 *
 * **질문은 바닥에 실제로 깔린 프롭으로만 답할 수 있어야 한다.** 캠핑장이라고 해서
 * "고기 다 탄다, 뭐가 필요해?"처럼 집게·토치를 정답으로 요구하면, 방에 있는 12종 중
 * 어느 것도 그 태그를 갖고 있지 않아 전원이 기본점 30 + 난수를 받는다 — AI 심사가
 * 통째로 무의미해진다. 새 태그를 쓰고 싶으면 catalog.ts에 먼저 그 태그를 심을 것.
 *
 * 그래서 여기 질문은 전부 "캠핑장에 이걸 들고 왔다고?" 쪽으로 비튼다. 노트북·청소기·
 * 곰인형이 굴러다니는 게 오히려 웃음의 재료가 된다.
 */
export const CAMPING_TOPICS: Topic[] = [
  {
    id: 'intruder',
    text: '텐트에 뭔가 부스럭거린다! 손에 잡히는 무기는?',
    tagWeights: {
      길쭉함: 40, 무거움: 30, 소음: 20, 안전: 16, 전자기기: 8,
      부드러움: -28, 포근함: -24, 귀여움: -18, 납작함: -12,
    },
  },
  {
    id: 'notcamping',
    text: '캠핑 왔는데 이건 진짜 아니지 않냐?',
    tagWeights: {
      전자기기: 40, 일: 34, 비쌈: 22, 청소: 20, 일상: 12,
      자연: -30, 포근함: -22, 생존: -20, 식물: -18,
    },
  },
  {
    id: 'cold',
    text: '해 지고 급 추워졌다. 지금 뭐부터 챙겨?',
    tagWeights: {
      포근함: 42, 부드러움: 26, 수면: 22, 생존: 18, 귀여움: 10,
      청소: -26, 소음: -20, 납작함: -16, 무거움: -10,
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
