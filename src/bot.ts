/**
 * AI 봇 — LLM이 아닌 로컬 행동 로직(상태 머신). API 호출·비용 없음.
 * InputSource 인터페이스를 구현해 사람 플레이어와 완전히 동일한 경로로 게임에 참가한다.
 * (심사자가 혼자 평가할 때도 난투가 성립하도록 하는 것이 주 목적)
 *
 * 행동: 빈손이면 근처 프롭 물색·그랩
 *      → 들고 있으면 잠시 어슬렁대다 가장 가까운 상대에게 접근해 던지기.
 */

import * as THREE from 'three';
import type { InputSource, InputState } from './input';
import type { Player } from './player';
import type { Prop, PropManager } from './objects';

const IDLE: InputState = { moveX: 0, moveZ: 0, actionPressed: false, actionHeld: false };
const DT = 1 / 60; // getState는 고정 스텝 틱마다 1회 호출된다

export class BotSource implements InputSource {
  readonly id: string;
  readonly label = 'AI 봇 (로컬 로직)';

  private self: Player | null = null;
  private players: Player[] = [];
  private props: PropManager | null = null;

  private targetProp: Prop | null = null;
  private repickTimer = 0;
  private holdTimer = 0;
  private patience: number;
  private wander = new THREE.Vector3();
  private prevAction = false;

  constructor(index: number) {
    this.id = `bot${index}`;
    this.patience = 2.0 + Math.random() * 2.0; // 봇마다 성격이 조금 다르다
  }

  /** 플레이어 생성 후 게임이 연결해 준다 */
  bind(self: Player, players: Player[], props: PropManager) {
    this.self = self;
    this.players = players;
    this.props = props;
  }

  getState(): InputState {
    if (!this.self || !this.props) return IDLE;
    this.repickTimer -= DT;

    const me = this.self.position;
    let dest: THREE.Vector3 | null = null;
    let action = false;

    if (this.self.held) {
      // 들고 있음 — 인내심이 다하면 가장 가까운 상대에게 투척
      this.holdTimer += DT;
      const foe = this.nearestFoe(me);
      if (this.holdTimer > this.patience && foe) {
        dest = foe.position;
        if (dest.distanceTo(me) < 4.2) {
          action = true; // 던지기
          this.holdTimer = 0;
          this.patience = 2.0 + Math.random() * 2.5;
        }
      } else {
        if (this.repickTimer <= 0) {
          this.wander.set((Math.random() - 0.5) * 10, 0, (Math.random() - 0.5) * 7);
          this.repickTimer = 1.5 + Math.random();
        }
        dest = this.wander;
      }
    } else {
      // 빈손 — 프롭 물색
      this.holdTimer = 0;
      if (!this.targetProp || this.repickTimer <= 0 || !this.props.props.includes(this.targetProp)) {
        this.targetProp = this.pickProp(me);
        this.repickTimer = 1.8 + Math.random() * 1.5;
      }
      if (this.targetProp) {
        dest = this.targetProp.position;
        const d = dest.distanceTo(me);
        if (d < 0.95) action = true;
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

  /** 가까운 프롭 5개 중 랜덤 — 매번 같은 것만 노리지 않게 */
  private pickProp(me: THREE.Vector3): Prop | null {
    const candidates = this.props!.props
      .filter((p) => !p.heldBy.has(this.self!.id))
      .map((p) => ({ p, d: p.position.distanceTo(me) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 5);
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)].p;
  }
}
