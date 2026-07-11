/** 게임 흐름 — Menu → (Topic → Scramble → Judging) ×N → Results */

import * as THREE from 'three';
import { World3D } from './world';
import { PropManager } from './objects';
import { Player, PLAYER_COLORS, PLAYER_NAMES } from './player';
import { InputManager, keyName, type InputSource } from './input';
import { UI, kbd } from './ui';
import { createJudge, winnerComment, type JudgeEntry } from './judge';
import { pickTopics, type Topic } from './topics';
import { pickEvent, type EventCtx, type RoundEvent } from './events';
import { sfx } from './sound';
import type { AssetLibrary } from './assets';

// ?fast — 개발·시연용 단축 라운드
const FAST = new URLSearchParams(location.search).has('fast');
const TOPIC_TIME = FAST ? 1.5 : 3.5;
const SCRAMBLE_TIME = FAST ? 6 : 25;
const ROUNDS = 3;
const FIXED_DT = 1 / 60;

const SPAWNS = [
  new THREE.Vector3(-5.5, 1.2, 3.5),
  new THREE.Vector3(5.5, 1.2, 3.5),
  new THREE.Vector3(-5.5, 1.2, -3.5),
  new THREE.Vector3(5.5, 1.2, -3.5),
];

type State = 'menu' | 'topic' | 'scramble' | 'judging' | 'results';

export class Game {
  private world: World3D;
  private props: PropManager;
  private input = new InputManager();
  private ui: UI;
  private judge = createJudge();

  private players: Player[] = [];
  private playersByCollider = new Map<number, Player>();
  private state: State = 'menu';
  private stateTime = 0;
  private round = 0;
  private topics: Topic[] = [];
  private event: RoundEvent | null = null;
  private lastBeepSec = -1;
  private accumulator = 0;
  private lastTime = performance.now();
  private restartRequested = false;
  private rebinding = false;

  constructor(container: HTMLElement, assets: AssetLibrary) {
    this.world = new World3D(container);
    this.props = new PropManager(this.world, assets);
    this.ui = new UI(container);
    this.refreshControlsHint();
    window.addEventListener('keydown', (e) => {
      if (this.rebinding) return;
      if (e.code === 'KeyR') this.restartRequested = true;
      if (e.code === 'KeyK' && this.state === 'menu') this.startRebind();
    });
  }

  private refreshControlsHint() {
    const [p1, p2] = this.input.schemes;
    const keys = (s: typeof p1) =>
      `${kbd(keyName(s.up))}${kbd(keyName(s.left))}${kbd(keyName(s.down))}${kbd(keyName(s.right))} 이동 · ` +
      `${kbd(keyName(s.action))} 잡기/던지기 · ${kbd(keyName(s.jump))} 점프`;
    this.ui.setControlsHint(
      `<b>P1</b> ${keys(p1)}<br/><b>P2</b> ${keys(p2)}<br/>` +
      `게임패드: 스틱 이동 · A 잡기 · B 점프 (연결하면 자동 인식) &nbsp;|&nbsp; ${kbd('K')} 키 변경`,
    );
  }

  private async startRebind() {
    this.rebinding = true;
    try {
      await this.input.rebindScheme(0, (msg) => this.ui.setRebindPrompt(msg));
      await this.input.rebindScheme(1, (msg) => this.ui.setRebindPrompt(msg));
      this.ui.setRebindPrompt('저장 완료!');
    } finally {
      this.refreshControlsHint();
      setTimeout(() => {
        this.ui.setRebindPrompt(null);
        this.rebinding = false;
      }, 900);
    }
  }

  start() {
    const loop = (now: number) => {
      const dt = Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;
      this.accumulator += dt;
      while (this.accumulator >= FIXED_DT) {
        this.tick(FIXED_DT);
        this.accumulator -= FIXED_DT;
      }
      this.world.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  private tick(dt: number) {
    this.stateTime += dt;

    switch (this.state) {
      case 'menu': this.tickMenu(); break;
      case 'topic': this.tickTopic(dt); break;
      case 'scramble': this.tickScramble(dt); break;
      case 'judging': this.tickPhysicsOnly(dt); break;
      case 'results':
        this.tickPhysicsOnly(dt);
        if (this.restartRequested) location.reload();
        break;
    }
    this.restartRequested = this.state === 'results' && this.restartRequested;
  }

  private setState(s: State) {
    this.state = s;
    this.stateTime = 0;
  }

  // ── 메뉴: 소스별 액션 버튼으로 참가 ──
  private joinedSources = new Set<string>();

  private tickMenu() {
    if (!this.rebinding) {
      for (const src of this.input.allSources()) {
        const st = src.getState();
        if (st.actionPressed && !this.joinedSources.has(src.id) && this.players.length < 4) {
          this.joinedSources.add(src.id);
          this.addPlayer(src);
        }
      }
    }
    this.ui.showMenu(
      this.players.map((p) => ({
        label: p.source.label,
        color: PLAYER_COLORS[p.id],
        name: PLAYER_NAMES[p.id],
      })),
      this.players.length >= 1,
    );
    if (this.players.length >= 1 && this.restartRequested) {
      this.restartRequested = false;
      this.beginMatch();
    }
    this.stepPhysics(1 / 60);
  }

  private addPlayer(source: InputSource) {
    const id = this.players.length;
    const player = new Player(id, source, this.world, this.props, SPAWNS[id]);
    this.players.push(player);
    this.playersByCollider.set(player.collider.handle, player);
  }

  private beginMatch() {
    this.ui.hideMenu();
    this.topics = pickTopics(ROUNDS);
    this.round = 0;
    for (const p of this.players) p.score = 0;
    this.beginRound();
  }

  private get eventCtx(): EventCtx {
    return {
      world: this.world,
      players: this.players,
      props: this.props,
      pulse: (text) => this.ui.pulseEvent(text),
    };
  }

  private beginRound() {
    this.round++;
    this.event = pickEvent(this.round);
    this.lastBeepSec = -1;
    this.props.scatter();
    this.players.forEach((p, i) => {
      p.frozen = false;
      p.resetForRound(SPAWNS[i]);
    });
    this.ui.showTopic(this.round, ROUNDS, this.currentTopic.text);
    this.ui.setHud(this.hudEntries());
    this.setState('topic');
  }

  private get currentTopic(): Topic {
    return this.topics[this.round - 1];
  }

  private tickTopic(dt: number) {
    this.tickGameplay(dt);
    if (this.stateTime >= TOPIC_TIME) {
      this.setState('scramble');
      this.ui.minifyTopic();
      if (this.event) {
        this.event.start(this.eventCtx);
        this.ui.showEvent(this.event.title, this.event.desc);
      }
    }
  }

  private tickScramble(dt: number) {
    this.tickGameplay(dt);
    this.event?.tick?.(this.eventCtx, dt);
    const remain = SCRAMBLE_TIME - this.stateTime;
    this.ui.setTimer(Math.max(0, remain));
    // 마지막 5초 카운트다운 비프
    const sec = Math.ceil(remain);
    if (sec <= 5 && sec >= 1 && sec !== this.lastBeepSec) {
      this.lastBeepSec = sec;
      sfx.tick();
    }
    if (remain <= 0) this.buzzer();
  }

  private tickGameplay(dt: number) {
    for (const p of this.players) p.update(dt);
    this.props.update(dt);
    this.stepPhysics(dt);
    this.ui.setHud(this.hudEntries());
  }

  private tickPhysicsOnly(dt: number) {
    for (const p of this.players) p.update(dt); // frozen 상태라 입력 무시, 동기화만
    this.props.update(dt);
    this.stepPhysics(dt);
  }

  private stepPhysics(dt: number) {
    this.world.physics.timestep = dt;
    this.world.physics.step(this.world.eventQueue);
    // 던진 물건 명중 판정
    this.world.eventQueue.drainCollisionEvents((h1, h2, started) => {
      if (!started) return;
      this.handleHit(h1, h2);
      this.handleHit(h2, h1);
    });
  }

  /** thrownHandle 프롭이 victimHandle(플레이어 or 들고 있는 프롭)을 맞혔는가 */
  private handleHit(thrownHandle: number, victimHandle: number) {
    const prop = this.props.byCollider.get(thrownHandle);
    if (!prop || prop.thrownBy < 0) return;
    const thrower = prop.thrownBy;

    // 1) 플레이어 본체 명중 → 들고 있던 물건 낙하 + 넉백
    const player = this.playersByCollider.get(victimHandle);
    if (player && player.id !== thrower) {
      const dir = player.position.sub(prop.position);
      player.onHit(dir);
      prop.thrownBy = -1;
      return;
    }
    // 2) 상대가 들고 있는 프롭 명중 → 강제 낙하
    const victimProp = this.props.byCollider.get(victimHandle);
    if (victimProp && victimProp.heldBy.size > 0 && !victimProp.heldBy.has(thrower)) {
      for (const holderId of [...victimProp.heldBy]) {
        this.players[holderId]?.release();
      }
      prop.thrownBy = -1;
    }
  }

  private hudEntries() {
    return this.players.map((p) => ({
      name: PLAYER_NAMES[p.id],
      color: PLAYER_COLORS[p.id],
      heldName: p.held?.meta.name ?? null,
      score: p.score,
    }));
  }

  // ── 버저 → AI 심사 ──
  private async buzzer() {
    this.setState('judging');
    sfx.buzzer();
    if (this.event) {
      this.event.end(this.eventCtx);
      this.event = null;
    }
    this.ui.hideEvent();
    this.ui.setTimer(null);
    this.ui.hideTopic();
    for (const p of this.players) p.frozen = true;

    const entries: JudgeEntry[] = this.players.map((p) => ({
      playerId: p.id,
      playerName: PLAYER_NAMES[p.id],
      item: p.held?.meta ?? null,
    }));

    this.ui.showJudgePanel(this.currentTopic.text);
    const result = await this.judge.judge({ topic: this.currentTopic, entries });

    // 낮은 점수부터 공개해 긴장감 유지
    const sorted = [...result.verdicts].sort((a, b) => a.score - b.score);
    for (const v of sorted) {
      await delay(1100);
      const p = this.players[v.playerId];
      const entry = entries.find((e) => e.playerId === v.playerId)!;
      p.score += v.score;
      sfx.reveal(v.score);
      this.ui.addVerdict(
        PLAYER_NAMES[v.playerId], PLAYER_COLORS[v.playerId],
        entry.item?.name ?? null, v.score, v.comment,
      );
      this.ui.setHud(this.hudEntries());
    }

    await delay(2800);
    this.ui.hideJudgePanel();
    for (const p of this.players) p.release();

    if (this.round >= ROUNDS) this.showResults();
    else this.beginRound();
  }

  private showResults() {
    this.setState('results');
    sfx.fanfare();
    this.ui.setHud(null);
    const rows = [...this.players]
      .sort((a, b) => b.score - a.score)
      .map((p) => ({ name: PLAYER_NAMES[p.id], color: PLAYER_COLORS[p.id], score: p.score }));
    this.ui.showResults(rows, winnerComment(rows[0].name));
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
