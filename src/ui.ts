/** DOM 오버레이 UI — 메뉴/주제 배너/타이머/HUD/심사 패널/결과 */

const CSS = `
.ui-root { position: absolute; inset: 0; pointer-events: none; color: #fff;
  font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; }
.screen { position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 18px; }
.dim { background: rgba(20, 16, 36, 0.72); backdrop-filter: blur(3px); }

.title { font-size: clamp(40px, 7vw, 76px); font-weight: 900; letter-spacing: -2px;
  text-shadow: 0 6px 24px rgba(0,0,0,.5); }
.title em { color: #ffb86b; font-style: normal; }
.subtitle { font-size: 18px; opacity: .85; }
.hint { font-size: 15px; opacity: .65; line-height: 1.9; text-align: center; }
.joinrow { display: flex; gap: 14px; margin-top: 8px; }
.joincard { width: 150px; padding: 16px 10px; border-radius: 14px; text-align: center;
  background: rgba(255,255,255,.08); border: 2px dashed rgba(255,255,255,.25);
  font-size: 14px; opacity: .55; }
.joincard.joined { border-style: solid; opacity: 1; background: rgba(255,255,255,.14); }
.joincard .who { font-size: 22px; font-weight: 800; }
.start-hint { margin-top: 10px; font-size: 20px; font-weight: 700; color: #ffd98c;
  animation: pulse 1.4s infinite; }
@keyframes pulse { 50% { opacity: .45; } }

.topic-banner { position: absolute; top: 12%; left: 50%; transform: translateX(-50%);
  max-width: 86vw; padding: 18px 38px; border-radius: 18px; text-align: center;
  background: linear-gradient(135deg, #ff9a5b, #e4573d); box-shadow: 0 10px 40px rgba(0,0,0,.45);
  font-size: clamp(20px, 3.4vw, 34px); font-weight: 900;
  transition: transform .35s cubic-bezier(.2,1.6,.4,1), opacity .3s; }
.topic-banner.hidden { transform: translateX(-50%) translateY(-30px) scale(.8); opacity: 0; }
.topic-banner .label { display: block; font-size: 13px; font-weight: 700; opacity: .8;
  letter-spacing: 3px; margin-bottom: 4px; }

.timer { position: absolute; top: 3%; left: 50%; transform: translateX(-50%);
  font-size: 44px; font-weight: 900; text-shadow: 0 4px 14px rgba(0,0,0,.6);
  font-variant-numeric: tabular-nums; }
.timer.urgent { color: #ff6b5b; animation: pulse .5s infinite; }

.hud { position: absolute; bottom: 2.5%; left: 50%; transform: translateX(-50%);
  display: flex; gap: 12px; }
.chip { min-width: 170px; padding: 10px 16px; border-radius: 14px;
  background: rgba(20,16,36,.75); border-left: 6px solid #888;
  display: flex; flex-direction: column; gap: 2px; }
.chip .row1 { display: flex; justify-content: space-between; font-weight: 800; }
.chip .item { font-size: 13px; opacity: .85; min-height: 17px; }

.judge-panel { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%);
  width: min(680px, 92vw); padding: 26px 30px; border-radius: 22px;
  background: rgba(24,19,44,.92); box-shadow: 0 16px 60px rgba(0,0,0,.55);
  display: flex; flex-direction: column; gap: 14px; }
.judge-panel h2 { margin: 0 0 4px; font-size: 22px; color: #ffb86b; }
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

.results-list { display: flex; flex-direction: column; gap: 10px; width: min(520px, 90vw); }
.result-row { display: flex; align-items: center; gap: 14px; padding: 14px 20px;
  border-radius: 14px; background: rgba(255,255,255,.08); font-size: 20px; font-weight: 800; }
.result-row.winner { background: linear-gradient(135deg, rgba(255,184,107,.35), rgba(228,87,61,.3));
  border: 2px solid #ffb86b; font-size: 24px; }
.result-row .rank { width: 40px; }
.result-row .pts { margin-left: auto; font-variant-numeric: tabular-nums; }
.winner-comment { font-size: 18px; color: #ffd98c; max-width: 620px; text-align: center; line-height: 1.6; }
.hidden { display: none !important; }
`;

export interface HudEntry {
  name: string;
  color: number;
  heldName: string | null;
  score: number;
}

function colorHex(c: number): string {
  return `#${c.toString(16).padStart(6, '0')}`;
}

export class UI {
  private root: HTMLDivElement;
  private menuEl!: HTMLDivElement;
  private joinRow!: HTMLDivElement;
  private startHint!: HTMLDivElement;
  private topicEl!: HTMLDivElement;
  private timerEl!: HTMLDivElement;
  private hudEl!: HTMLDivElement;
  private judgeEl!: HTMLDivElement;
  private judgeList!: HTMLDivElement;
  private resultsEl!: HTMLDivElement;

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
    this.el('div', 'title', this.menuEl, '잡아라! <em>코지 룸</em>');
    this.el('div', 'subtitle', this.menuEl, '주제에 맞는 물건을 잡아라 — 뺏고, 던지고, AI 심사위원의 채점을 받아라!');
    this.joinRow = this.el('div', 'joinrow', this.menuEl);
    this.el('div', 'hint', this.menuEl,
      '참가: <b>P1</b> WASD 이동 + Space 잡기/던지기 &nbsp;|&nbsp; <b>P2</b> 방향키 + Enter<br/>' +
      '게임패드: 스틱 이동 + A버튼 잡기/던지기 (연결하면 자동 인식)<br/>' +
      '자기 <b>잡기 버튼</b>을 누르면 참가! 혼자서도 심사 모드로 플레이 가능');
    this.startHint = this.el('div', 'start-hint hidden', this.menuEl, 'R 키를 눌러 시작!');
  }

  private buildGameHud() {
    this.topicEl = this.el('div', 'topic-banner hidden', this.root);
    this.timerEl = this.el('div', 'timer hidden', this.root);
    this.hudEl = this.el('div', 'hud hidden', this.root);
  }

  private buildJudge() {
    this.judgeEl = this.el('div', 'judge-panel hidden', this.root);
  }

  private buildResults() {
    this.resultsEl = this.el('div', 'screen dim hidden', this.root);
  }

  // ── 메뉴 ──
  showMenu(joined: { label: string; color: number; name: string }[], canStart: boolean) {
    this.menuEl.classList.remove('hidden');
    this.joinRow.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const j = joined[i];
      const card = document.createElement('div');
      card.className = 'joincard' + (j ? ' joined' : '');
      if (j) {
        card.style.borderColor = colorHex(j.color);
        card.innerHTML = `<div class="who" style="color:${colorHex(j.color)}">${j.name}</div><div>${j.label}</div>`;
      } else {
        card.innerHTML = `<div class="who">?</div><div>버튼을 눌러 참가</div>`;
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
    this.topicEl.classList.remove('hidden');
    this.topicEl.innerHTML = `<span class="label">ROUND ${round}/${totalRounds}</span>${text}`;
    requestAnimationFrame(() => this.topicEl.classList.remove('hidden'));
  }

  hideTopic() {
    this.topicEl.classList.add('hidden');
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
        `<div class="item">${e.heldName ? '🤲 ' + e.heldName : '빈손'}</div>`;
      this.hudEl.appendChild(chip);
    }
  }

  // ── 심사 ──
  showJudgePanel(topicText: string) {
    this.judgeEl.classList.remove('hidden');
    this.judgeEl.innerHTML = `<h2>🤖 AI 심사위원</h2><div class="topic-small">주제: ${topicText}</div>`;
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
    this.el('div', 'title', this.resultsEl, '최종 결과');
    const list = this.el('div', 'results-list', this.resultsEl);
    rows.forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'result-row' + (i === 0 ? ' winner' : '');
      row.innerHTML =
        `<span class="rank">${i === 0 ? '🏆' : `${i + 1}위`}</span>` +
        `<span style="color:${colorHex(r.color)}">${r.name}</span>` +
        `<span class="pts">${r.score}점</span>`;
      list.appendChild(row);
    });
    this.el('div', 'winner-comment', this.resultsEl, `“${comment}”`);
    this.el('div', 'start-hint', this.resultsEl, 'R 키를 눌러 다시하기');
  }
}
