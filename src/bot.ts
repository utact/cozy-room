/**
 * AI 봇 — LLM이 아닌 로컬 행동 로직(상태 머신). API 호출·비용 없음.
 * InputSource 인터페이스를 구현해 사람 플레이어와 완전히 동일한 경로로 게임에 참가한다.
 * (심사자가 혼자 평가할 때도 난투가 성립하도록 하는 것이 주 목적)
 *
 * **봇은 주제를 읽는다.** 예전 봇은 가까운 프롭 다섯 중 아무거나 집고, 인내심이 다하면
 * 그걸 그대로 상대에게 던졌다. 그래서 정답을 들고도 버저 직전에 던져 버리고 빈손으로
 * 심사를 받는 일이 잦았고, 던지기 말고는 하는 게 없어 움직임이 한 가지로 보였다.
 *
 * 지금은 심사위원과 **같은 채점 함수**(judge.scoreProp)로 프롭을 평가한다:
 *
 *   - 물색: 점수 높고 가까운 것을 고른다 (거리로 나눈 기대값)
 *   - 교체: 들고 있는 것보다 확실히 나은 게 가까이 있으면 갈아탄다
 *   - 견제: 나보다 좋은 걸 든 상대에게 던진다 — 뺏기 위해서지 화풀이가 아니다
 *   - 사수: 남은 시간이 얼마 없고 손에 든 게 쓸 만하면, 던지지 않고 상대를 피해 도망친다
 */

import * as THREE from 'three';
import type { InputSource, InputState } from './input';
import type { Player } from './player';
import type { Prop, PropManager } from './objects';
import type { Topic } from './topics';
import type { PropMeta } from './catalog';
import { scoreProp } from './judge';

const IDLE: InputState = { moveX: 0, moveZ: 0, actionPressed: false, actionHeld: false };
const DT = 1 / 60; // getState는 고정 스텝 틱마다 1회 호출된다

/** 이 점수 아래면 "들고 있어 봐야 소용없다"고 보고 갈아탄다 */
const KEEP_THRESHOLD = 45;
/** 남은 시간이 이보다 적으면 던지지 않고 지킨다 */
const ENDGAME_SEC = 6;
/** 갈아탈 만한 가치가 있으려면 이만큼은 더 좋아야 한다 (점수 진동에 낚이지 않게) */
const SWAP_MARGIN = 12;

export class BotSource implements InputSource {
  readonly id: string;
  readonly label = 'AI 봇 (로컬 로직)';

  private self: Player | null = null;
  private players: Player[] = [];
  private props: PropManager | null = null;

  /** 이번 라운드 채점 기준 — 게임이 라운드마다 넣어 준다 */
  private topic: Topic | null = null;
  /** 일치 라운드에서는 이 프롭만이 정답이다 */
  private matchTarget: PropMeta | null = null;
  private timeLeft: () => number = () => 99;

  private targetProp: Prop | null = null;
  private repickTimer = 0;
  private holdTimer = 0;
  private patience: number;
  private wander = new THREE.Vector3();
  private prevAction = false;
  /** 성격 — 0에 가까우면 신중하고 1에 가까우면 공격적이다 */
  private readonly aggression: number;

  constructor(index: number) {
    this.id = `bot${index}`;
    this.patience = 1.6 + Math.random() * 1.8;
    this.aggression = 0.3 + Math.random() * 0.6;
  }

  /** 플레이어 생성 후 게임이 연결해 준다 */
  bind(self: Player, players: Player[], props: PropManager) {
    this.self = self;
    this.players = players;
    this.props = props;
  }

  /** 라운드 시작마다 게임이 목표를 갱신해 준다 */
  setRound(topic: Topic | null, matchTarget: PropMeta | null, timeLeft: () => number) {
    this.topic = topic;
    this.matchTarget = matchTarget;
    this.timeLeft = timeLeft;
    this.targetProp = null;
    this.holdTimer = 0;
  }

  /** 이 프롭이 이번 라운드에 얼마나 값어치 있는가 (0~100) */
  private valueOf(meta: PropMeta): number {
    if (this.matchTarget) return meta.id === this.matchTarget.id ? 100 : 5;
    if (!this.topic) return 50; // 주제를 못 받았으면 전부 동등하게 본다
    return scoreProp(this.topic, meta);
  }

  getState(): InputState {
    if (!this.self || !this.props) return IDLE;
    this.repickTimer -= DT;

    const me = this.self.position;
    const held = this.self.held;
    let dest: THREE.Vector3 | null = null;
    let action = false;

    if (held) {
      this.holdTimer += DT;
      const myValue = this.valueOf(held.meta);
      const endgame = this.timeLeft() <= ENDGAME_SEC;

      // 더 나은 프롭이 근처에 있으면 갈아탄다 (지금 든 게 신통찮을 때만)
      const upgrade = myValue < KEEP_THRESHOLD ? this.bestProp(me, myValue + SWAP_MARGIN) : null;

      if (upgrade) {
        dest = upgrade.position;
        // 새 걸 잡으면 조인트가 옮겨 붙으므로 든 것을 따로 버릴 필요가 없다
        if (dest.distanceTo(me) < 1.0) action = true;
      } else if (endgame && myValue >= KEEP_THRESHOLD) {
        // 사수 — 좋은 걸 들고 있고 시간이 없다. 가장 가까운 상대 반대쪽으로 도망친다
        const foe = this.nearestFoe(me);
        dest = foe ? me.clone().sub(foe.position).setLength(4).add(me) : null;
      } else {
        // 견제 — 나보다 좋은 걸 든 상대가 우선 표적이다
        const foe = this.throwTarget(me, myValue);
        const ready = this.holdTimer > this.patience * (1.4 - this.aggression);
        if (foe && ready && !endgame) {
          dest = foe.position;
          if (dest.distanceTo(me) < 4.2) {
            action = true; // 던지기
            this.holdTimer = 0;
            this.patience = 1.6 + Math.random() * 2.0;
          }
        } else {
          dest = this.roam(me);
        }
      }
    } else {
      // 빈손 — 값어치 있는 프롭을 물색한다
      this.holdTimer = 0;
      const gone = this.targetProp && !this.props.props.includes(this.targetProp);
      if (!this.targetProp || gone || this.repickTimer <= 0) {
        this.targetProp = this.bestProp(me, -1);
        this.repickTimer = 1.2 + Math.random();
      }
      if (this.targetProp) {
        dest = this.targetProp.position;
        if (dest.distanceTo(me) < 1.0) action = true;
      } else {
        dest = this.roam(me);
      }
    }

    let moveX = 0;
    let moveZ = 0;
    if (dest) {
      const dx = dest.x - me.x;
      const dz = dest.z - me.z;
      const len = Math.hypot(dx, dz);
      if (len > 0.3) {
        moveX = dx / len + (Math.random() - 0.5) * 0.25;
        moveZ = dz / len + (Math.random() - 0.5) * 0.25;
      }
    }
    const actionPressed = action && !this.prevAction;
    this.prevAction = action;
    return { moveX, moveZ, actionPressed, actionHeld: action };
  }

  /** 목적 없이 돌아다닐 때의 목적지 */
  private roam(me: THREE.Vector3): THREE.Vector3 {
    if (this.repickTimer <= 0) {
      this.wander.set((Math.random() - 0.5) * 9, 0, (Math.random() - 0.5) * 6.5);
      this.repickTimer = 1.5 + Math.random();
    }
    // 이미 도착했으면 다음 틱에 새 지점을 뽑게 한다
    if (this.wander.distanceTo(me) < 0.6) this.repickTimer = 0;
    return this.wander;
  }

  /**
   * 값어치 대비 거리가 가장 좋은 프롭. minValue보다 낮은 것은 아예 보지 않는다.
   * 남이 들고 있는 것도 후보다 — 붙어서 그랩하면 줄다리기가 걸린다.
   */
  private bestProp(me: THREE.Vector3, minValue: number): Prop | null {
    let best: Prop | null = null;
    let bestScore = -Infinity;
    for (const p of this.props!.props) {
      if (p.heldBy.has(this.self!.id)) continue;
      const value = this.valueOf(p.meta);
      if (value <= minValue) continue;
      // 남이 쥐고 있으면 뺏는 데 품이 드니 조금 깎는다 (공격적인 봇일수록 덜 깎는다)
      const contested = p.heldBy.size > 0 ? 1 - 0.45 * (1 - this.aggression) : 1;
      const dist = Math.max(1, p.position.distanceTo(me));
      const s = (value * contested) / dist;
      if (s > bestScore) {
        bestScore = s;
        best = p;
      }
    }
    return best;
  }

  /** 던질 상대 — 나보다 좋은 걸 든 사람이 1순위, 없으면 가장 가까운 사람 */
  private throwTarget(me: THREE.Vector3, myValue: number): Player | null {
    let best: Player | null = null;
    let bestD = Infinity;
    for (const p of this.players) {
      if (p === this.self || !p.held) continue;
      if (this.valueOf(p.held.meta) <= myValue) continue;
      const d = p.position.distanceTo(me);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best ?? this.nearestFoe(me);
  }

  private nearestFoe(me: THREE.Vector3): Player | null {
    let best: Player | null = null;
    let bestD = Infinity;
    for (const p of this.players) {
      if (p === this.self) continue;
      const d = p.position.distanceTo(me);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }
}
