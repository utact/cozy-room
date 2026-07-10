/** 게임 흐름 — Menu → (Topic → Scramble → Judging) ×N → Results */

import * as THREE from 'three';
import { World3D } from './world';
import { PropManager } from './objects';
import { Player, PLAYER_COLORS, PLAYER_NAMES } from './player';
import { InputManager, type InputSource } from './input';
import { UI } from './ui';
import { createJudge, winnerComment, type JudgeEntry } from './judge';
import { pickTopics, type Topic } from './topics';

const TOPIC_TIME = 3.5;
const SCRAMBLE_TIME = 25;
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
  private accumulator = 0;
  private lastTime = performance.now();
  private restartRequested = false;

  constructor(container: HTMLElement) {
    this.world = new World3D(container);
    this.props = new PropManager(this.world);
    this.ui = new UI(container);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyR') this.restartRequested = true;
    });
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
    for (const src of this.input.allSources()) {
      const st = src.getState();
      if (st.actionPressed && !this.joinedSources.has(src.id) && this.players.length < 4) {
        this.joinedSources.add(src.id);
        this.addPlayer(src);
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

  private beginRound() {
    this.round++;
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
    if (this.stateTime >= TOPIC_TIME) this.setState('scramble');
  }

  private tickScramble(dt: number) {
    this.tickGameplay(dt);
    const remain = SCRAMBLE_TIME - this.stateTime;
    this.ui.setTimer(Math.max(0, remain));
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
