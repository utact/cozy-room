/** 게임 흐름 — Menu → (Topic → Scramble → Judging) ×N → Results */

import * as THREE from 'three';
import { World3D } from './world';
import { PropManager, type Prop } from './objects';
import { Player, PLAYER_COLORS, PLAYER_NAMES } from './player';
import { InputManager, keyName, type InputSource } from './input';
import { UI, kbd } from './ui';
import { LocalJudge, winnerComment, josa, matchPunchline, matchComment, type JudgeEntry } from './judge';
import { pickTopics, type Topic } from './topics';
import { PROP_CATALOG, LOOKALIKES, type PropMeta } from './catalog';
import { pickEvent, type EventCtx, type RoundEvent } from './events';
import { AirshipSystem } from './airship';
import { sfx } from './sound';
import { BotSource } from './bot';
import type { AssetLibrary } from './assets';

// ?fast — 개발·시연용 단축 라운드
const FAST = new URLSearchParams(location.search).has('fast');
const TOPIC_TIME = FAST ? 1.5 : 3.5;
const SCRAMBLE_TIME = FAST ? 6 : 25;
const ROUNDS = 3;
const FIXED_DT = 1 / 60;

const MAX_PLAYERS = 2;

const SPAWNS = [
  new THREE.Vector3(-5.5, 1.2, 3.5),
  new THREE.Vector3(5.5, 1.2, 3.5),
];

type State = 'menu' | 'topic' | 'scramble' | 'judging' | 'results';

export class Game {
  private world: World3D;
  private props: PropManager;
  private input = new InputManager();
  private ui: UI;
  private judge = new LocalJudge();

  private players: Player[] = [];
  private playersByCollider = new Map<number, Player>();
  private state: State = 'menu';
  private stateTime = 0;
  private round = 0;
  private topics: Topic[] = [];
  private event: RoundEvent | null = null;
  private airship!: AirshipSystem;
  private lastBeepSec = -1;
  /** 라운드별 타입 — 'match' = 일치 라운드 (지목된 물건 하나를 둘이 다툰다) */
  private roundTypes: ('normal' | 'match')[] = [];
  private matchTarget: PropMeta | null = null;
  private accumulator = 0;
  private lastTime = performance.now();
  private restartRequested = false;
  private reloading = false;
  private rebinding = false;

  constructor(container: HTMLElement, assets: AssetLibrary) {
    this.world = new World3D(container);
    this.props = new PropManager(this.world, assets);
    // 프롭 제거 시 잡고 있던 조인트부터 해제 (팔 재장착·수거 안전장치)
    this.props.beforeDespawn = (prop) => {
      for (const id of [...prop.heldBy]) this.players[id]?.release();
    };
    this.ui = new UI(container);
    this.airship = new AirshipSystem(this.world, this.props);
    this.airship.onPulse = (t) => this.ui.pulseEvent(t);
    this.refreshControlsHint();
    this.ui.showLobbyScreen();
    window.addEventListener('keydown', (e) => {
      if (this.rebinding) return;
      if (e.code === 'KeyR') this.restartRequested = true;
      if (this.state !== 'menu') return;
      if (e.code === 'KeyK') this.startRebind();
      if (e.code === 'KeyB') this.addBot();
    });
  }

  private botCount = 0;

  private addBot() {
    if (this.players.length >= MAX_PLAYERS) return;
    const source = new BotSource(this.botCount++);
    this.joinedSources.add(source.id);
    this.addPlayer(source);
    const bot = this.players[this.players.length - 1];
    source.bind(bot, this.players, this.props);
    sfx.grab();
  }

  private refreshControlsHint() {
    const [p1, p2] = this.input.schemes;
    const move = (s: typeof p1) =>
      `${kbd(keyName(s.up))}${kbd(keyName(s.left))}${kbd(keyName(s.down))}${kbd(keyName(s.right))}`;
    const row = (who: string, color: string, scheme: typeof p1) =>
      `<span class="ctl-who" style="color:${color}">${who}</span>` +
      `<span>${move(scheme)}</span><span>${kbd(keyName(scheme.action))}</span>` +
      `<span>${kbd(keyName(scheme.jump))}</span>`;
    this.ui.setControlsHint(
      `<div class="ctl-table">` +
      `<span></span><span class="ctl-h">이동</span><span class="ctl-h">잡기 · 던지기</span><span class="ctl-h">점프</span>` +
      row('P1', '#e4573d', p1) +
      row('P2', '#3d7de4', p2) +
      `</div>` +
      `<div class="ctl-meta">` +
      `<span>${kbd('B')} AI 봇 추가</span><span>${kbd('K')} 키 변경</span>` +
      `</div>`,
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
      this.world.updateCamera(dt);
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
        if (this.restartRequested && !this.reloading) {
          this.restartRequested = false;
          // reload는 딱 한 번만 — 매 틱 반복 호출되면 무한 로딩처럼 보인다
          this.reloading = true;
          location.reload();
        }
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

  /** 참가 카드에 표시할 입력 소스 태그 */
  private sourceTag(id: string): string {
    if (id.startsWith('bot')) return 'AI 봇';
    return '키보드';
  }

  private tickMenu() {
    if (!this.rebinding) {
      for (const src of this.input.allSources()) {
        const st = src.getState();
        if (st.actionPressed && !this.joinedSources.has(src.id) && this.players.length < MAX_PLAYERS) {
          this.joinedSources.add(src.id);
          this.addPlayer(src);
        }
      }
    }
    this.ui.showMenu(
      this.players.map((p) => ({
        tag: this.sourceTag(p.source.id),
        color: PLAYER_COLORS[p.id],
        name: PLAYER_NAMES[p.id],
      })),
      this.players.length >= 1,
    );
    if (this.players.length >= 1 && this.restartRequested) {
      this.restartRequested = false;
      this.beginMatch();
    }
    this.restartRequested = false;
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
    // 2인이면 라운드 하나(2~마지막)가 일치 라운드가 된다. ?match 로 전부 강제 가능
    this.roundTypes = Array(ROUNDS).fill('normal');
    const forceMatch = new URLSearchParams(location.search).has('match');
    if (this.players.length >= 2) {
      if (forceMatch) this.roundTypes.fill('match');
      else this.roundTypes[1 + Math.floor(Math.random() * (ROUNDS - 1))] = 'match';
    }
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
    this.tugs.clear();
    this.props.scatter();
    this.matchTarget =
      this.roundTypes[this.round - 1] === 'match' ? this.setupMatchRound() : null;
    this.players.forEach((p, i) => {
      p.frozen = false;
      p.resetForRound(SPAWNS[i]);
    });
    const topicText = this.matchTarget
      ? `모두 【${this.matchTarget.name}】 들어라!`
      : this.currentTopic.text;
    const label = this.matchTarget
      ? `${this.world.theme.name} · 하나 모자란다!`
      : this.world.theme.name;
    this.ui.showTopic(this.round, ROUNDS, topicText, label);
    this.ui.setHud(this.hudEntries());
    this.setState('topic');
  }

  /**
   * 일치 라운드 목표 선정 — 의자앉기 + 낚시.
   * 방에는 모든 물건이 딱 하나씩만 있으므로, 목표를 정하는 것만으로 "하나 모자란"
   * 상황이 성립한다(2인 기준). 닮은꼴 미끼도 이미 방에 하나씩 깔려 있다.
   */
  private setupMatchRound(): PropMeta | null {
    const candidates = Object.keys(LOOKALIKES).filter((id) =>
      PROP_CATALOG.some((m) => m.id === id),
    );
    if (candidates.length === 0) return null; // 조건 미달 → 일반 라운드로
    const targetId = candidates[Math.floor(Math.random() * candidates.length)];
    return PROP_CATALOG.find((m) => m.id === targetId)!;
  }

  private get currentTopic(): Topic {
    return this.topics[this.round - 1];
  }

  private tickTopic(dt: number) {
    this.tickGameplay(dt);
    if (this.stateTime >= TOPIC_TIME) {
      this.setState('scramble');
      this.ui.minifyTopic();
      this.airship.start();
      if (this.event) {
        this.event.start(this.eventCtx);
        this.ui.showEvent(this.event.title, this.event.desc);
      }
    }
  }

  private tickScramble(dt: number) {
    this.tickGameplay(dt);
    this.event?.tick?.(this.eventCtx, dt);
    this.airship.tick(dt, this.players);
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
    this.tickTug(dt);
    this.props.update(dt);
    this.stepPhysics(dt);
    this.ui.setHud(this.hudEntries());
  }

  // ── 줄다리기 — 동시 그랩 시 이동 입력(버둥거림) 누적이 큰 쪽이 이긴다 ──
  private tugs = new Map<Prop, { time: number; limit: number; effort: number[] }>();

  private tickTug(dt: number) {
    for (const prop of this.props.props) {
      if (prop.heldBy.size < 2) {
        this.tugs.delete(prop);
        continue;
      }
      let tug = this.tugs.get(prop);
      if (!tug) {
        tug = { time: 0, limit: 1.3 + Math.random() * 1.2, effort: [0, 0] };
        this.tugs.set(prop, tug);
      }
      tug.time += dt;
      for (const id of prop.heldBy) {
        tug.effort[id] += (this.players[id]?.lastMoveMag ?? 0) * dt + 0.001;
      }
      if (tug.time < tug.limit) continue;
      const holders = [...prop.heldBy];
      const rolls = holders.map((id) => tug.effort[id] * (0.85 + Math.random() * 0.3));
      const winner = holders[rolls.indexOf(Math.max(...rolls))];
      for (const id of holders) {
        if (id === winner) continue;
        const loser = this.players[id];
        loser.release();
        // 패배의 대가 — 팔이 뜯겨 아이템이 된다. 되찾기 전까진 아무것도 못 줍는다.
        const rip = loser.ripArm();
        if (!rip) continue;
        this.props.spawnArm(id, PLAYER_NAMES[id], PLAYER_COLORS[id], rip.pos, rip.side);
        sfx.rip();
        // 25% 확률 대참사 — 양팔이 다 뜯긴다
        const rip2 = Math.random() < 0.25 ? loser.ripArm() : null;
        if (rip2) {
          this.props.spawnArm(id, PLAYER_NAMES[id], PLAYER_COLORS[id], rip2.pos, rip2.side);
          sfx.rip();
          this.ui.pulseEvent(`${PLAYER_NAMES[id]} 양팔 대참사!!`);
        } else {
          this.ui.pulseEvent(`${PLAYER_NAMES[id]}의 팔이 뜯어졌다!`);
        }
      }
      this.tugs.delete(prop);
    }
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
      armless: p.armless,
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
    this.airship.end();
    this.ui.hideEvent();
    this.ui.setTimer(null);
    this.ui.hideTopic();
    for (const p of this.players) p.frozen = true;

    const entries: JudgeEntry[] = this.players.map((p) => ({
      playerId: p.id,
      playerName: PLAYER_NAMES[p.id],
      item: p.held?.meta ?? null,
    }));

    if (this.matchTarget) {
      await this.matchShow(entries);
    } else {
      this.ui.showJudgePanel(this.currentTopic.text);
      const result = await this.judge.judge({ topic: this.currentTopic, entries });
      await this.revealVerdicts(entries, result.verdicts);
    }

    await delay(2800);
    this.ui.hideJudgePanel();
    for (const p of this.players) p.release();

    if (this.round >= ROUNDS) this.showResults();
    else this.beginRound();
  }

  /** 낮은 점수부터 공개해 긴장감 유지 */
  private async revealVerdicts(
    entries: JudgeEntry[],
    verdicts: { playerId: number; score: number; comment: string }[],
  ) {
    const sorted = [...verdicts].sort((a, b) => a.score - b.score);
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
  }

  /** 일치 라운드 — 틀린 사람 클로즈업 쇼 → 폭로 → 점수 공개 */
  private async matchShow(entries: JudgeEntry[]) {
    const target = this.matchTarget!;
    const isCorrect = (e: JudgeEntry) => e.item?.id === target.id;
    const losers = entries.filter((e) => !isCorrect(e));
    // 주인공 우선순위: 닮은꼴을 든 사람 > 오답 > 빈손
    const rank = (e: JudgeEntry) =>
      e.item ? ((LOOKALIKES[target.id] ?? []).includes(e.item.id) ? 0 : 1) : 2;
    const star = [...losers].sort((a, b) => rank(a) - rank(b))[0] ?? null;

    if (star) {
      await delay(600);
      const p = this.players[star.playerId];
      this.world.focusOn(p.position);
      sfx.drumroll();
      this.ui.showTada('과연', '오늘의 주인공은…?');
      await delay(2000);
      sfx.tada();
      const isLook = !!star.item && (LOOKALIKES[target.id] ?? []).includes(star.item.id);
      this.ui.showTada(
        `따란~ 오늘의 주인공: ${PLAYER_NAMES[star.playerId]}`,
        matchPunchline(PLAYER_NAMES[star.playerId], target.name, star.item?.name ?? null, isLook),
      );
      await delay(3400);
      this.ui.hideTada();
      this.world.resetFocus();
      await delay(700);
    }

    this.ui.showJudgePanel(`모두 ${josa(target.name, '을를')} 들어라!`);
    const verdicts = entries.map((e) => {
      const correct = isCorrect(e);
      const score = correct
        ? 65 + Math.floor(Math.random() * 21)
        : e.item
          ? 8 + Math.floor(Math.random() * 12)
          : 3 + Math.floor(Math.random() * 8);
      return { playerId: e.playerId, score, comment: matchComment(correct) };
    });
    await this.revealVerdicts(entries, verdicts);
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
