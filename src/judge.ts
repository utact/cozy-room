/**
 * AI 심사위원 — 주제 대비 제출물 채점 + 한 줄 평.
 *
 * Judge 인터페이스만 맞추면 구현체 교체 가능:
 *  - LocalJudge : 태그 매칭 + 템플릿 문장 풀. 오프라인에서 항상 작동 (기본값).
 *  - RemoteJudge: 실제 Claude 엔드포인트 프록시 호출. 실패 시 LocalJudge로 폴백.
 */

import type { PropMeta } from './catalog';
import type { Topic } from './topics';

export interface JudgeEntry {
  playerId: number;
  playerName: string;
  item: PropMeta | null; // 버저 순간 빈손이면 null
}

export interface JudgePayload {
  topic: Topic;
  entries: JudgeEntry[];
}

export interface JudgeVerdict {
  playerId: number;
  score: number; // 0~100
  comment: string;
}

export interface JudgeResult {
  verdicts: JudgeVerdict[];
}

export interface Judge {
  judge(payload: JudgePayload): Promise<JudgeResult>;
}

// ─────────────────────────────────────────────────────────────
// LocalJudge

const HIGH_TEMPLATES = [
  '{item}?! 이건 심사할 필요도 없다. 만점에 가까운 선택!',
  '{name} 선수, {item}을(를) 고르다니… 오늘 밤 주인공은 당신이다.',
  '{item}이라니, 이 주제를 위해 태어난 물건 아닌가?',
  '심사위원 만장일치. {item}은(는) 정답 그 자체.',
  '{item}… 소름 돋았다. 이게 바로 프로의 선택.',
];

const MID_TEMPLATES = [
  '{item}… 나쁘지 않다. 하지만 세상을 바꾸진 못한다.',
  '{name} 선수의 {item}, 무난하다. 무난함이 죄는 아니지.',
  '{item}? 음… 60점짜리 인생을 보는 것 같다.',
  '{item}을(를) 골랐다는 건 알겠는데, 왜 골랐는지는 모르겠다.',
  '{item}, 절반의 성공. 나머지 절반은 어디에…?',
];

const LOW_TEMPLATES = [
  '{item}…? 진심인가? 심사위원 일동 침묵.',
  '{name} 선수, {item}은(는) 좀… 다시 생각해 보자.',
  '이 주제에 {item}을(를) 내밀다니, 용기 하나는 인정한다.',
  '{item}. 오답도 이렇게 당당하면 반칙이다.',
  '{item}을(를) 보고 심사위원이 한숨을 쉬었다. 아주 길게.',
];

const EMPTY_TEMPLATES = [
  '빈손?! {name} 선수, 물건 쟁탈전에서 물건을 안 들고 왔다…',
  '{name} 선수의 제출물: 공기. 신선하긴 한데 점수는 못 준다.',
  '빈손으로 온 {name} 선수, 미니멀리즘도 정도가 있다.',
  '{name} 선수, 손이 예쁘긴 한데 심사 대상은 아니다.',
];

const TAG_QUIPS: Record<string, string> = {
  무기: '전투력 하나는 확실하고',
  귀여움: '귀여움은 만점인데',
  무거움: '허리 조심해야 하고',
  부드러움: '촉감은 최고지만',
  음식: '일단 맛있어 보이고',
  비쌈: '지갑 사정이 느껴지고',
  유머: '웃음은 보장되고',
  한국인: 'K-감성이 넘치고',
};

const WINNER_TEMPLATES = [
  '오늘의 우승자는 {name}! 물건 보는 눈이 남다르다.',
  '{name} 선수 우승! 코지 룸의 지배자가 탄생했다.',
  '최종 우승 {name}! 나머지는… 내일 다시 오자.',
  '{name} 선수, 우승 축하한다. 그 손버릇은 계속 유지하길.',
];

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** 같은 심사에서 같은 문장이 두 번 나오지 않도록 사용 이력을 피해 뽑기 */
function pickFresh(arr: string[], rng: () => number, used: Set<string>): string {
  const fresh = arr.filter((t) => !used.has(t));
  const chosen = pick(fresh.length > 0 ? fresh : arr, rng);
  used.add(chosen);
  return chosen;
}

function fill(template: string, name: string, item: string): string {
  return template.replaceAll('{name}', name).replaceAll('{item}', item);
}

export class LocalJudge implements Judge {
  constructor(private rng: () => number = Math.random) {}

  async judge(payload: JudgePayload): Promise<JudgeResult> {
    const used = new Set<string>();
    const verdicts: JudgeVerdict[] = payload.entries.map((entry) => {
      if (!entry.item) {
        return {
          playerId: entry.playerId,
          score: 3 + Math.floor(this.rng() * 10),
          comment: fill(pickFresh(EMPTY_TEMPLATES, this.rng, used), entry.playerName, ''),
        };
      }
      const score = this.scoreItem(payload.topic, entry.item);
      return {
        playerId: entry.playerId,
        score,
        comment: this.comment(entry, score, used),
      };
    });
    return { verdicts };
  }

  private scoreItem(topic: Topic, item: PropMeta): number {
    let score = 30; // 기본점 — 일단 뭐라도 들고 왔으면 성의 점수
    for (const tag of item.tags) {
      score += topic.tagWeights[tag] ?? 0;
    }
    score += (this.rng() - 0.5) * 16; // AI 심사위원의 변덕 ±8
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private comment(entry: JudgeEntry, score: number, used: Set<string>): string {
    const item = entry.item!;
    const pool = score >= 70 ? HIGH_TEMPLATES : score >= 40 ? MID_TEMPLATES : LOW_TEMPLATES;
    let comment = fill(pickFresh(pool, this.rng, used), entry.playerName, item.name);
    // 태그 기반 추임새를 확률적으로 앞에 붙여 다양성 확보
    const quipTag = item.tags.find((t) => TAG_QUIPS[t]);
    if (quipTag && this.rng() < 0.45) {
      comment = `${TAG_QUIPS[quipTag]}… ${comment}`;
    }
    return comment;
  }
}

export function winnerComment(name: string, rng: () => number = Math.random): string {
  return fill(pick(WINNER_TEMPLATES, rng), name, '');
}

// ─────────────────────────────────────────────────────────────
// RemoteJudge — 실AI 연결부 (프록시 엔드포인트 준비 시 활성화)

export class RemoteJudge implements Judge {
  private fallback = new LocalJudge();

  constructor(private endpoint: string) {}

  async judge(payload: JudgePayload): Promise<JudgeResult> {
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: payload.topic.text,
          entries: payload.entries.map((e) => ({
            playerId: e.playerId,
            playerName: e.playerName,
            item: e.item ? { name: e.item.name, tags: e.item.tags } : null,
          })),
        }),
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) throw new Error(`judge endpoint ${res.status}`);
      const data = (await res.json()) as JudgeResult;
      if (!Array.isArray(data.verdicts)) throw new Error('malformed judge response');
      return data;
    } catch (err) {
      console.warn('[judge] 원격 심사 실패, 로컬 심사로 폴백:', err);
      return this.fallback.judge(payload);
    }
  }
}

/** URL ?judge=https://... 로 원격 심사 엔드포인트 지정 가능 */
export function createJudge(): Judge {
  const endpoint = new URLSearchParams(location.search).get('judge');
  return endpoint ? new RemoteJudge(endpoint) : new LocalJudge();
}
