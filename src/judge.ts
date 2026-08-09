/**
 * AI 심사위원 — 주제 대비 제출물 채점 + 한 줄 평.
 *
 * 프롭에 부여된 태그와 주제별 태그 가중치를 매칭해 점수를 내고, 점수 구간별
 * 템플릿 문장 풀에서 한 줄 평을 뽑는다. 외부 API 호출이 없어 정적 웹 빌드에서
 * 키 없이 항상 동작한다.
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

/**
 * 태그별 추임새 — 한 줄 평 앞에 확률적으로 붙는다.
 * 카탈로그의 태그는 되도록 전부 채워 둔다. 비어 있으면 그 프롭을 든 사람만
 * 유독 밋밋한 평을 받아 심사가 성의 없어 보인다.
 */
const TAG_QUIPS: Record<string, string> = {
  귀여움: '귀여움은 만점인데',
  무거움: '허리 조심해야 하고',
  부드러움: '촉감은 최고지만',
  비쌈: '지갑 사정이 느껴지고',
  소중함: '애착은 인정하고',
  추억: '사연은 있어 보이고',
  인테리어: '보기엔 그럴듯하고',
  납작함: '납작한 건 알겠고',
  전자기기: '전원은 들어오겠지만',
  일: '일 생각이 나긴 하고',
  안전: '안전제일은 좋은데',
  생존: '살아남을 의지는 보이고',
  가벼움: '들기는 편하겠고',
  포근함: '포근하긴 한데',
  청소: '집은 깨끗해지겠지만',
  정리: '정리정돈 점수는 높고',
  길쭉함: '리치 하나는 길고',
  소음: '시끄럽기로는 일등이고',
  파티: '분위기는 띄우겠고',
  분위기: '무드는 잡히는데',
  식물: '생명은 소중하고',
  자연: '자연 친화적이긴 하고',
  수면: '졸음이 몰려오고',
  일상: '너무 평범한 거 아닌가 싶고',
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

/** 받침 유무에 따른 조사 선택 — "곰인형을" / "프라이팬을" / "고무오리를" */
export function josa(word: string, pair: '을를' | '이가' | '은는' | '와과'): string {
  const code = word.charCodeAt(word.length - 1);
  const hasJong = code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 !== 0 : false;
  const table: Record<string, [string, string]> = {
    을를: ['을', '를'], 이가: ['이', '가'], 은는: ['은', '는'], 와과: ['과', '와'],
  };
  const [withJong, withoutJong] = table[pair];
  return word + (hasJong ? withJong : withoutJong);
}

// ── 일치 라운드 — 주인공(틀린 사람) 폭로 멘트 ──────────────

// 조사 토큰: {target을} {target이} {actual을} {actual이} {actual였} 은 받침에 맞게 치환된다
const PUNCH_LOOKALIKE = [
  '이런… {target}같이 생긴 {actual였}습니다!',
  '{name} 선수, 그것은 {target이} 아니라 {actual}입니다!',
  '아깝다! 실루엣은 완벽했지만… {actual}입니다.',
];
const PUNCH_WRONG = [
  '{name} 선수, 아무리 봐도 그건 {actual}인데요.',
  '{target을} 들라고 했는데 {actual을} 들고 당당하게 서 있습니다.',
  '{actual}… 그건 누가 봐도 {actual}입니다, {name} 선수.',
];
const PUNCH_EMPTY = [
  '{name} 선수, 손이 텅 비었습니다. 박수 부탁드립니다.',
  '모두가 하나씩 들 때, {name} 선수는 아무것도 잡지 못했습니다.',
  '오늘의 주인공은 빈손의 {name} 선수입니다. 따란~',
];

/** 받침 유무에 따라 '였습니다/이었습니다' 앞부분 생성 */
function yeot(word: string): string {
  const code = word.charCodeAt(word.length - 1);
  const hasJong = code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 !== 0 : false;
  return word + (hasJong ? '이었' : '였');
}

export function matchPunchline(
  name: string,
  targetName: string,
  actualName: string | null,
  isLookalike: boolean,
  rng: () => number = Math.random,
): string {
  const pool = actualName === null ? PUNCH_EMPTY : isLookalike ? PUNCH_LOOKALIKE : PUNCH_WRONG;
  const actual = actualName ?? '';
  return pick(pool, rng)
    .replaceAll('{name}', name)
    .replaceAll('{target을}', josa(targetName, '을를'))
    .replaceAll('{target이}', josa(targetName, '이가'))
    .replaceAll('{actual을}', josa(actual, '을를'))
    .replaceAll('{actual이}', josa(actual, '이가'))
    .replaceAll('{actual였}', yeot(actual))
    .replaceAll('{target}', targetName)
    .replaceAll('{actual}', actual);
}

const MATCH_CORRECT_COMMENTS = [
  '완벽한 일치. 통과!',
  '정확하다. 눈썰미 인정.',
  '군말 없이 정답.',
  '이 정도면 프로 감정사.',
];
const MATCH_WRONG_COMMENTS = [
  '오늘의 주인공… 다시 보게 됐다.',
  '자신감 하나는 만점이었다.',
  '실루엣 감정 능력 재교육 필요.',
  '빈손도 패션이라면 할 말 없다.',
];

export function matchComment(correct: boolean, rng: () => number = Math.random): string {
  return pick(correct ? MATCH_CORRECT_COMMENTS : MATCH_WRONG_COMMENTS, rng);
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

export class LocalJudge {
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
