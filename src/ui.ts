/** DOM 오버레이 UI — 메뉴/주제 배너/타이머/HUD/심사 패널/결과 */

const CSS = `
.ui-root { position: absolute; inset: 0; pointer-events: none; color: #fff;
  font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; }
.screen { position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 18px; }
.dim { background: radial-gradient(ellipse at 50% 42%, rgba(26,20,44,.42) 0%, rgba(16,12,30,.88) 100%); }

/* ── 키캡 ── */
.key { display: inline-block; min-width: 14px; padding: 2px 9px; border-radius: 7px;
  background: linear-gradient(#4a4468, #363050); border: 1px solid rgba(255,255,255,.28);
  border-bottom-width: 3px; box-shadow: 0 2px 5px rgba(0,0,0,.35);
  font-weight: 800; font-size: 13px; text-align: center; }

/* ── 메뉴 ── */
.logo { position: relative; transform: rotate(-2.5deg); text-align: center;
  animation: logo-bob 3.2s ease-in-out infinite; }
@keyframes logo-bob { 50% { transform: rotate(-2.5deg) translateY(-7px); } }
.logo .big { font-size: clamp(46px, 8vw, 92px); font-weight: 900; letter-spacing: -3px;
  line-height: 1.05;
  text-shadow: 0 3px 0 #c94b32, 0 7px 0 #7e2e1f, 0 16px 34px rgba(0,0,0,.65); }
.logo .big em { color: #ffcf6b; font-style: normal;
  text-shadow: 0 3px 0 #c98029, 0 7px 0 #7e511a, 0 16px 34px rgba(0,0,0,.65); }
.logo .ribbon { position: absolute; top: -20px; right: -46px; transform: rotate(9deg);
  background: linear-gradient(135deg, #e4573d, #b03a26); padding: 7px 16px;
  border-radius: 999px; font-weight: 800; font-size: 14px;
  box-shadow: 0 5px 16px rgba(0,0,0,.45); border: 2px solid rgba(255,255,255,.25); }
.subtitle { font-size: 17px; opacity: .9; font-weight: 600;
  text-shadow: 0 2px 8px rgba(0,0,0,.6); }

.joinrow { display: flex; gap: 14px; margin-top: 6px; }
.joincard { width: 158px; padding: 16px 10px 13px; border-radius: 18px; text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 9px;
  background: rgba(255,255,255,.06); border: 2px dashed rgba(255,255,255,.22);
  transition: transform .25s, box-shadow .25s; }
.joincard.joined { border-style: solid; background: rgba(255,255,255,.12);
  transform: translateY(-5px); box-shadow: 0 10px 26px rgba(0,0,0,.4); }
.avatar { width: 50px; height: 62px; border-radius: 25px; position: relative; flex: none;
  background: #57506e; box-shadow: inset -6px -8px 0 rgba(0,0,0,.16); }
.avatar .eye { position: absolute; top: 16px; width: 11px; height: 13px;
  border-radius: 50%; background: #fff; }
.avatar .eye::after { content: ''; position: absolute; bottom: 2px; left: 3px;
  width: 5px; height: 6px; border-radius: 50%; background: #1b1b22; }
.avatar .eye.l { left: 11px; } .avatar .eye.r { right: 11px; }
.avatar.ghost { background: rgba(255,255,255,.1); box-shadow: none; }
.avatar.ghost::after { content: '?'; position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 26px; font-weight: 900; opacity: .4; }
.joincard .who { font-size: 19px; font-weight: 900; }
.joincard .src { font-size: 11.5px; opacity: .78; line-height: 1.55; min-height: 34px; }
.hint { font-size: 14px; opacity: .8; line-height: 2.1; text-align: center; }
.start-hint { margin-top: 8px; font-size: 19px; font-weight: 800; color: #ffd98c;
  animation: pulse 1.4s infinite; text-shadow: 0 2px 10px rgba(0,0,0,.5); }
@keyframes pulse { 50% { opacity: .45; } }
.rebind-prompt { margin-top: 6px; font-size: 17px; font-weight: 800; color: #8ad0ff;
  min-height: 24px; }

/* ── 라운드 ── */
.topic-banner { position: absolute; top: 12%; left: 50%; transform: translateX(-50%);
  max-width: 86vw; padding: 18px 38px; border-radius: 18px; text-align: center;
  background: linear-gradient(135deg, #ff9a5b, #e4573d); box-shadow: 0 10px 40px rgba(0,0,0,.45);
  font-size: clamp(20px, 3.4vw, 34px); font-weight: 900;
  transition: transform .35s cubic-bezier(.2,1.6,.4,1), opacity .3s,
    font-size .35s, padding .35s, top .35s, left .35s; }
.topic-banner.hidden { transform: translateX(-50%) translateY(-30px) scale(.8); opacity: 0; }
.topic-banner .label { display: block; font-size: 13px; font-weight: 700; opacity: .8;
  letter-spacing: 3px; margin-bottom: 4px; }
.topic-banner.mini { left: 16px; top: 14px; transform: none; max-width: 32vw;
  padding: 8px 18px; font-size: 16px; border-radius: 12px; }
.topic-banner.mini .label { display: none; }

.timer { position: absolute; top: 3%; left: 50%; transform: translateX(-50%);
  font-size: 44px; font-weight: 900; text-shadow: 0 4px 14px rgba(0,0,0,.6);
  font-variant-numeric: tabular-nums; }
.timer.urgent { color: #ff6b5b; animation: pulse .5s infinite; }

.event-banner { position: absolute; top: 13%; left: 50%; transform: translateX(-50%);
  padding: 12px 28px; border-radius: 14px; text-align: center;
  background: linear-gradient(135deg, #7b5cd6, #4a3aa8); box-shadow: 0 8px 30px rgba(0,0,0,.45);
  border: 2px solid rgba(255,255,255,.2);
  transition: transform .3s cubic-bezier(.2,1.6,.4,1), opacity .3s; }
.event-banner.hidden { transform: translateX(-50%) scale(.7); opacity: 0; pointer-events: none; }
.event-banner .ev-title { font-size: 24px; font-weight: 900; }
.event-banner .ev-desc { font-size: 14px; opacity: .85; margin-top: 2px; }
.event-banner.pulse { animation: evpulse .5s; }
@keyframes evpulse { 30% { transform: translateX(-50%) scale(1.12); } }

.hud { position: absolute; bottom: 2.5%; left: 50%; transform: translateX(-50%);
  display: flex; gap: 12px; }
.chip { min-width: 172px; padding: 10px 16px; border-radius: 14px;
  background: rgba(20,16,36,.78); border-left: 6px solid #888;
  display: flex; flex-direction: column; gap: 2px; }
.chip .row1 { display: flex; justify-content: space-between; font-weight: 800; }
.chip .item { font-size: 13px; min-height: 17px; font-weight: 600; }
.chip .item.empty { opacity: .45; font-weight: 400; }

/* ── 심사 ── */
.judge-panel { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%);
  width: min(680px, 92vw); padding: 26px 30px; border-radius: 22px;
  background: rgba(24,19,44,.94); box-shadow: 0 16px 60px rgba(0,0,0,.55);
  border: 1px solid rgba(255,255,255,.08);
  display: flex; flex-direction: column; gap: 14px; }
.judge-panel h2 { margin: 0 0 4px; font-size: 22px; color: #ffb86b;
  display: flex; align-items: center; gap: 10px; }
.ai-chip { display: inline-block; padding: 3px 12px; border-radius: 9px; font-size: 15px;
  background: linear-gradient(135deg, #7b5cd6, #4a3aa8); color: #fff;
  border: 1px solid rgba(255,255,255,.3); letter-spacing: 1px; }
.judge-panel .topic-small { font-size: 15px; opacity: .8; margin-bottom: 6px; }
.verdict { display: flex; align-items: center; gap: 14px; padding: 12px 14px;
  border-radius: 12px; background: rgba(255,255,255,.06);
  transform: translateX(24px); opacity: 0; transition: all .4s cubic-bezier(.2,1.4,.4,1); }
.verdict.shown { transform: none; opacity: 1; }
.verdict .badge { width: 44px; height: 44px; border-radius: 50%; flex: none;
  display: flex; align-items: center; justify-content: center; font-weight: 900; }
.verdict .body { flex: 1; }
.verdict .head { font-weight: 800; font-size: 15px; }
.verdict .comment { font-size: 14px; opacity: .9; margin-top: 2px; line-height: 1.5; }
.verdict .score { font-size: 26px; font-weight: 900; font-variant-numeric: tabular-nums; }

/* ── 결과 ── */
.results-title { font-size: clamp(34px, 5vw, 54px); font-weight: 900; letter-spacing: -1px;
  transform: rotate(-2deg); text-shadow: 0 3px 0 #c94b32, 0 6px 0 #7e2e1f, 0 14px 30px rgba(0,0,0,.6); }
.podium { display: flex; align-items: flex-end; gap: 20px; margin-top: 4px; }
.pod { display: flex; flex-direction: column; align-items: center; gap: 7px;
  animation: pod-rise .65s cubic-bezier(.2,1.4,.4,1) backwards; }
@keyframes pod-rise { from { transform: translateY(60px); opacity: 0; } }
.crown { width: 38px; height: 26px; margin-bottom: -3px;
  background: linear-gradient(#ffe08a, #eab63e);
  clip-path: polygon(0 100%, 4% 26%, 28% 54%, 50% 0, 72% 54%, 96% 26%, 100% 100%);
  filter: drop-shadow(0 3px 6px rgba(0,0,0,.45)); }
.pod .pname { font-weight: 900; font-size: 19px; }
.pod .pscore { font-weight: 900; font-size: 23px; font-variant-numeric: tabular-nums; }
.pod .stand { width: 116px; border-radius: 12px 12px 0 0;
  background: linear-gradient(#453c6c, #2c2647);
  border: 1px solid rgba(255,255,255,.12); border-bottom: none;
  display: flex; align-items: flex-start; justify-content: center; padding-top: 9px;
  font-weight: 900; font-size: 21px; color: rgba(255,255,255,.65); }
.also-ran { display: flex; gap: 10px; align-items: center; font-size: 16px; font-weight: 700;
  opacity: .8; margin-top: 4px; }
.bubble { position: relative; margin-top: 20px; background: #fdf6ec; color: #2c2440;
  padding: 15px 26px; border-radius: 18px; font-weight: 700; font-size: 17px;
  max-width: 620px; text-align: center; line-height: 1.6;
  box-shadow: 0 10px 30px rgba(0,0,0,.4); }
.bubble::before { content: ''; position: absolute; top: -9px; left: 50%;
  transform: translateX(-50%); border: 10px solid transparent;
  border-bottom-color: #fdf6ec; border-top: 0; }
.bubble .by { display: block; margin-top: 6px; font-size: 12.5px; opacity: .55; font-weight: 800; }

.confetti { position: absolute; top: -8vh; width: 10px; height: 16px; border-radius: 2px;
  pointer-events: none; animation: confetti-fall linear forwards; }
@keyframes confetti-fall {
  to { transform: translateY(122vh) rotate(760deg); opacity: .75; }
}
.hidden { display: none !important; }
`;

export interface HudEntry {
  name: string;
  color: number;
  heldName: string | null;
  score: number;
}

const CONFETTI_COLORS = ['#e4573d', '#3d7de4', '#e4b53d', '#4fbf5e', '#ffb86b', '#d9788f', '#8ad0ff'];

function colorHex(c: number): string {
  return `#${c.toString(16).padStart(6, '0')}`;
}

function avatarHtml(color: number | null): string {
  if (color === null) return `<div class="avatar ghost"></div>`;
  return `<div class="avatar" style="background:${colorHex(color)}"><span class="eye l"></span><span class="eye r"></span></div>`;
}

export function kbd(text: string): string {
  return `<span class="key">${text}</span>`;
}

export class UI {
  private root: HTMLDivElement;
  private menuEl!: HTMLDivElement;
  private joinRow!: HTMLDivElement;
  private controlsHint!: HTMLDivElement;
  private startHint!: HTMLDivElement;
  private rebindPrompt!: HTMLDivElement;
  private topicEl!: HTMLDivElement;
  private timerEl!: HTMLDivElement;
  private hudEl!: HTMLDivElement;
  private judgeEl!: HTMLDivElement;
  private judgeList!: HTMLDivElement;
  private resultsEl!: HTMLDivElement;
  private eventEl!: HTMLDivElement;

  constructor(container: HTMLElement) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.root = document.createElement('div');
    this.root.className = 'ui-root';
    container.appendChild(this.root);
    this.buildMenu();
    this.buildGameHud();
    this.buildJudge();
    this.buildResults();
  }

  private el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement, html = ''): HTMLElementTagNameMap[K] {
    const e = document.createElement(tag);
    e.className = cls;
    if (html) e.innerHTML = html;
    parent.appendChild(e);
    return e;
  }

  private buildMenu() {
    this.menuEl = this.el('div', 'screen dim', this.root);
    this.el('div', 'logo', this.menuEl,
      `<div class="big">잡아라! <em>코지 룸</em></div><div class="ribbon">1~4인 물리 난투!</div>`);
    this.el('div', 'subtitle', this.menuEl, '주제에 맞는 물건을 잡아라 — 뺏고, 던지고, AI 심사를 받아라!');
    this.joinRow = this.el('div', 'joinrow', this.menuEl);
    this.controlsHint = this.el('div', 'hint', this.menuEl);
    this.rebindPrompt = this.el('div', 'rebind-prompt', this.menuEl);
    this.startHint = this.el('div', 'start-hint hidden', this.menuEl, `${kbd('R')} 눌러 시작!`);
  }

  private buildGameHud() {
    this.topicEl = this.el('div', 'topic-banner hidden', this.root);
    this.timerEl = this.el('div', 'timer hidden', this.root);
    this.hudEl = this.el('div', 'hud hidden', this.root);
    this.eventEl = this.el('div', 'event-banner hidden', this.root);
  }

  private buildJudge() {
    this.judgeEl = this.el('div', 'judge-panel hidden', this.root);
  }

  private buildResults() {
    this.resultsEl = this.el('div', 'screen dim hidden', this.root);
  }

  // ── 메뉴 ──
  setControlsHint(html: string) {
    this.controlsHint.innerHTML = html;
  }

  setRebindPrompt(text: string | null) {
    this.rebindPrompt.textContent = text ?? '';
  }

  showMenu(joined: { label: string; color: number; name: string }[], canStart: boolean) {
    this.menuEl.classList.remove('hidden');
    this.joinRow.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const j = joined[i];
      const card = document.createElement('div');
      card.className = 'joincard' + (j ? ' joined' : '');
      if (j) {
        card.style.borderColor = colorHex(j.color);
        card.innerHTML = `${avatarHtml(j.color)}<div class="who" style="color:${colorHex(j.color)}">${j.name}</div><div class="src">${j.label}</div>`;
      } else {
        card.innerHTML = `${avatarHtml(null)}<div class="who" style="opacity:.4">?</div><div class="src">잡기 버튼을 눌러<br/>참가</div>`;
      }
      this.joinRow.appendChild(card);
    }
    this.startHint.classList.toggle('hidden', !canStart);
  }

  hideMenu() {
    this.menuEl.classList.add('hidden');
  }

  // ── 라운드 ──
  showTopic(round: number, totalRounds: number, text: string) {
    this.topicEl.classList.remove('hidden', 'mini');
    this.topicEl.innerHTML = `<span class="label">ROUND ${round}/${totalRounds}</span>${text}`;
    requestAnimationFrame(() => this.topicEl.classList.remove('hidden'));
  }

  /** 난투 시작 후 주제를 좌상단 미니 배너로 축소 (시야 확보) */
  minifyTopic() {
    this.topicEl.classList.add('mini');
  }

  hideTopic() {
    this.topicEl.classList.add('hidden');
  }

  // ── 라운드 이벤트 ──
  showEvent(title: string, desc: string) {
    this.eventEl.classList.remove('hidden');
    this.eventEl.innerHTML = `<div class="ev-title">${title}</div><div class="ev-desc">${desc}</div>`;
    setTimeout(() => this.eventEl.classList.add('hidden'), 3200);
  }

  pulseEvent(text: string) {
    this.eventEl.innerHTML = `<div class="ev-title">${text}</div>`;
    this.eventEl.classList.remove('hidden', 'pulse');
    requestAnimationFrame(() => this.eventEl.classList.add('pulse'));
    setTimeout(() => this.eventEl.classList.add('hidden'), 900);
  }

  hideEvent() {
    this.eventEl.classList.add('hidden');
  }

  setTimer(sec: number | null) {
    if (sec === null) {
      this.timerEl.classList.add('hidden');
      return;
    }
    this.timerEl.classList.remove('hidden');
    this.timerEl.textContent = Math.ceil(sec).toString();
    this.timerEl.classList.toggle('urgent', sec <= 5.5);
  }

  setHud(entries: HudEntry[] | null) {
    if (!entries) {
      this.hudEl.classList.add('hidden');
      return;
    }
    this.hudEl.classList.remove('hidden');
    this.hudEl.innerHTML = '';
    for (const e of entries) {
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.style.borderLeftColor = colorHex(e.color);
      chip.innerHTML =
        `<div class="row1"><span style="color:${colorHex(e.color)}">${e.name}</span><span>${e.score}점</span></div>` +
        (e.heldName
          ? `<div class="item">${e.heldName}</div>`
          : `<div class="item empty">빈손</div>`);
      this.hudEl.appendChild(chip);
    }
  }

  // ── 심사 ──
  showJudgePanel(topicText: string) {
    this.judgeEl.classList.remove('hidden');
    this.judgeEl.innerHTML = `<h2><span class="ai-chip">AI</span>심사위원의 판정</h2><div class="topic-small">주제: ${topicText}</div>`;
    this.judgeList = this.el('div', '', this.judgeEl);
    this.judgeList.style.display = 'flex';
    this.judgeList.style.flexDirection = 'column';
    this.judgeList.style.gap = '10px';
  }

  addVerdict(name: string, color: number, itemName: string | null, score: number, comment: string) {
    const v = document.createElement('div');
    v.className = 'verdict';
    v.innerHTML =
      `<div class="badge" style="background:${colorHex(color)}">${name}</div>` +
      `<div class="body"><div class="head">${itemName ?? '(빈손)'}</div><div class="comment">${comment}</div></div>` +
      `<div class="score">${score}</div>`;
    this.judgeList.appendChild(v);
    requestAnimationFrame(() => requestAnimationFrame(() => v.classList.add('shown')));
  }

  hideJudgePanel() {
    this.judgeEl.classList.add('hidden');
  }

  // ── 결과 ──
  showResults(rows: { name: string; color: number; score: number }[], comment: string) {
    this.resultsEl.classList.remove('hidden');
    this.resultsEl.innerHTML = '';
    this.el('div', 'results-title', this.resultsEl, '결과 발표!');

    // 시상대 — 상위 3명 (2등 · 1등 · 3등 배치)
    const podium = this.el('div', 'podium', this.resultsEl);
    const standH = [128, 88, 62];
    const order = [1, 0, 2].filter((r) => r < rows.length);
    for (const rank of order) {
      const r = rows[rank];
      const pod = document.createElement('div');
      pod.className = 'pod';
      pod.style.animationDelay = `${0.15 + rank * 0.22}s`;
      pod.innerHTML =
        (rank === 0 ? '<div class="crown"></div>' : '') +
        avatarHtml(r.color) +
        `<div class="pname" style="color:${colorHex(r.color)}">${r.name}</div>` +
        `<div class="pscore">${r.score}점</div>` +
        `<div class="stand" style="height:${standH[rank]}px">${rank + 1}</div>`;
      podium.appendChild(pod);
    }
    // 4위
    for (let i = 3; i < rows.length; i++) {
      const r = rows[i];
      this.el('div', 'also-ran', this.resultsEl,
        `<span style="opacity:.6">${i + 1}위</span><span style="color:${colorHex(r.color)}">${r.name}</span><span>${r.score}점</span>`);
    }

    this.el('div', 'bubble', this.resultsEl, `${comment}<span class="by">— AI 심사위원</span>`);
    this.el('div', 'start-hint', this.resultsEl, `${kbd('R')} 눌러 다시하기`);
    this.dropConfetti();
  }

  private dropConfetti() {
    for (let i = 0; i < 56; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti';
      piece.style.left = `${Math.random() * 100}vw`;
      piece.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      piece.style.animationDuration = `${2.2 + Math.random() * 2.6}s`;
      piece.style.animationDelay = `${Math.random() * 1.8}s`;
      piece.style.transform = `rotate(${Math.random() * 360}deg)`;
      if (Math.random() < 0.4) piece.style.borderRadius = '50%';
      this.resultsEl.appendChild(piece);
    }
  }
}
