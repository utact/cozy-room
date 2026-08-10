/**
 * AI 심사위원 — 주제 대비 제출물 채점 + 한 줄 평.
 *
 * 프롭에 부여된 태그와 주제별 태그 가중치를 매칭해 점수를 내고, 점수 구간별
 * 템플릿 문장 풀에서 한 줄 평을 뽑는다. 외부 API 호출이 없어 정적 웹 빌드에서
 * 키 없이 항상 동작한다.
 */

import type { PropMeta } from './catalog';
import type { Topic } from './topics';
import { verdictLine } from './verdicts';

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

/**
 * 점수대별 폴백 문장.
 *
 * 실제 심사평은 verdicts.ts 의 질문×물건 전용 문장이 담당한다. 여기 있는 것은 표에
 * 칸이 없을 때(새 프롭·새 질문을 추가했는데 문장을 아직 안 쓴 경우)만 쓰인다.
 * 그래서 일부러 물건 이름에 기대지 않는, 짧고 안전한 문장으로 둔다.
 */
const HIGH_TEMPLATES = [
  '{item}. 이 주제에 이보다 나은 답은 없다.',
  '{name} 선수, {item}. 고민한 티가 난다.',
  '{item}. 반박할 구석을 못 찾겠다.',
];

const MID_TEMPLATES = [
  '{item}. 나쁘진 않은데 결정적이지도 않다.',
  '{name} 선수의 {item}, 무난하다. 무난함이 죄는 아니고.',
  '{item}. 왜 골랐는지는 알겠는데, 그게 최선이었나.',
];

const LOW_TEMPLATES = [
  '{item}. 이 주제에 이걸 내미는 건 좀.',
  '{name} 선수, {item}은(는) 다시 생각해 보자.',
  '{item}. 오답인데 당당해서 더 할 말이 없다.',
];

const EMPTY_TEMPLATES = [
  '{name} 선수, 제출물 없음. 물건 쟁탈전에서 물건을 못 구해 왔다.',
  '{name} 선수의 제출물은 공기다. 신선하긴 한데 채점표에 칸이 없다.',
  '{name} 선수, 그 시간 동안 대체 뭘 하다 오셨나.',
  '빈손. 두 손 다 비었다. 이건 전략이 아니라 사고다.',
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
  '우승 {name}. 물건 보는 눈이 남다르다.',
  '{name} 선수 우승. 오늘 이 방의 주인이다.',
  '최종 우승 {name}. 나머지 분들은 내일 다시 오시라.',
  '{name} 선수 우승. 그 손버릇은 계속 유지하시길.',
];

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * 주제 대비 프롭 점수 (0~100).
 *
 * 봇도 이 함수를 쓴다 — 심사 기준과 봇의 목표가 같은 함수에서 나와야 "봇이 좋은 걸
 * 골랐는데 낮은 점수를 받는" 모순이 생기지 않는다. 그래서 변덕(rng)은 분리해 둔다.
 */
export function scoreProp(topic: Topic, item: PropMeta): number {
  let score = 30; // 기본점 — 일단 뭐라도 들고 왔으면 성의 점수
  for (const tag of item.tags) score += topic.tagWeights[tag] ?? 0;
  return Math.max(0, Math.min(100, score));
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
  '{name} 선수, 두 손이 텅 비었습니다. 박수 부탁드립니다.',
  '모두가 하나씩 집을 때, {name} 선수만 아무것도 못 잡았습니다.',
  '{name} 선수, 뭐라도 들었어야죠. 뭐라도.',
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
  '정확히 그거다. 통과.',
  '눈썰미 인정. 군말 없이 정답.',
  '헷갈릴 만한데 안 헷갈렸다.',
  '이 정도면 감정사 자격증 줘도 된다.',
];
const MATCH_WRONG_COMMENTS = [
  '자신감은 만점이었다. 물건이 틀렸을 뿐.',
  '실루엣만 보고 뛰어들면 이렇게 된다.',
  '비슷하게 생겼다는 건 인정한다. 그래도 틀렸다.',
  '한 번 더 보고 집었어야 했다.',
];

const MATCH_EMPTY_COMMENTS = [
  '아무것도 못 들었다. 틀린 것보다 나쁘다.',
  '하나가 모자랐고, 그 하나가 이 선수였다.',
  '남는 게 있었는데 손이 안 닿았다.',
  '빈손. 고를 기회조차 못 잡았다.',
];

/**
 * 일치 라운드 한 줄 평.
 *
 * 빈손을 "물건이 틀렸을 뿐" 같은 문장으로 평하면 안 된다 — 들지도 않은 사람에게
 * 뭘 들었는지 얘기하는 게 되어 심사가 화면을 안 보고 있다는 인상을 준다.
 */
export function matchComment(
  correct: boolean,
  hasItem: boolean,
  used: Set<string> = new Set(),
  rng: () => number = Math.random,
): string {
  // 일치 라운드는 정답자가 여럿이라 같은 문장이 나란히 뜨기 쉽다. 한 심사 안에서는
  // 쓴 문장을 피해 뽑는다 (풀이 바닥나면 그때만 중복 허용)
  const pool = correct
    ? MATCH_CORRECT_COMMENTS
    : hasItem
      ? MATCH_WRONG_COMMENTS
      : MATCH_EMPTY_COMMENTS;
  return pickFresh(pool, rng, used);
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
        comment: this.comment(payload.topic, entry, score, used),
      };
    });
    return { verdicts };
  }

  private scoreItem(topic: Topic, item: PropMeta): number {
    const base = scoreProp(topic, item);
    const varied = base + (this.rng() - 0.5) * 16; // AI 심사위원의 변덕 ±8
    return Math.max(0, Math.min(100, Math.round(varied)));
  }

  private comment(topic: Topic, entry: JudgeEntry, score: number, used: Set<string>): string {
    const item = entry.item!;
    // 이 질문에 이 물건을 들고 온 것에 대한 전용 문장이 있으면 그게 항상 최우선이다.
    // 범용 템플릿에 추임새를 얹어 만든 문장보다 짧아도 훨씬 정확하고 웃기다
    const specific = verdictLine(topic.id, item.id);
    if (specific) return specific;

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
