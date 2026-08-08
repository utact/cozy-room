/** DOM 오버레이 UI — 메뉴/주제 배너/타이머/HUD/심사 패널/결과 */

import { ART, loadArt } from './art';

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
.menu-backdrop { position: absolute; inset: 0; z-index: 0; opacity: 0;
  background-size: cover; background-position: center; transition: opacity .9s; }
.menu-backdrop.on { opacity: 1; }
.menu-backdrop::after { content: ''; position: absolute; inset: 0;
  background: linear-gradient(rgba(14,10,26,.78) 0%, rgba(14,10,26,.5) 38%, rgba(14,10,26,.9) 100%); }
.screen.dim > :not(.menu-backdrop):not(.confetti) { position: relative; z-index: 1; }
.logo { position: relative; transform: rotate(-2.5deg); text-align: center;
  animation: logo-bob 3.2s ease-in-out infinite; }
.logo-img { width: min(600px, 74vw); display: block; margin: 0 auto;
  filter: drop-shadow(0 16px 34px rgba(0,0,0,.6)); }
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
/* 이미지 로고는 사방에 투명 여백(상 14%·우 12%)이 있어, 텍스트 로고 기준 오프셋을
   그대로 쓰면 리본이 허공에 뜬다. 여백만큼 안으로 당겨 글자 모서리에 붙인다. */
.logo.has-img .ribbon { top: 8.5%; right: 4.5%; }
.subtitle { font-size: 17px; opacity: .9; font-weight: 600;
  text-shadow: 0 2px 8px rgba(0,0,0,.6); }

.menu-foot { margin-top: 10px; font-size: 12.5px; opacity: .7; display: flex; gap: 18px; }

/* 로비 — 컴팩트, 100% 줌 720p 수납 */
.joinrow { display: flex; gap: 12px; }
.joincard { width: 128px; padding: 12px 8px 10px; border-radius: 16px; text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  background: linear-gradient(165deg, rgba(255,255,255,.07), rgba(255,255,255,.02));
  border: 2px dashed rgba(255,255,255,.18); backdrop-filter: blur(10px);
  transition: transform .3s cubic-bezier(.2,1.4,.4,1), box-shadow .3s, border-color .3s; }
.joincard .ready { font-size: 9px; letter-spacing: 3px; font-weight: 900;
  color: #4fbf5e; text-shadow: 0 0 12px rgba(79,191,94,.6); min-height: 11px; }
.joincard .tag { font-size: 10px; opacity: .6; min-height: 12px; letter-spacing: 1px; font-weight: 700; }
.joincard.joined { border-style: solid;
  background: linear-gradient(165deg, rgba(255,255,255,.13), rgba(255,255,255,.05));
  transform: translateY(-4px); box-shadow: 0 12px 28px rgba(0,0,0,.45); }
.joincard.joined .avatar { animation: avatar-float 2.6s ease-in-out infinite; }
@keyframes avatar-float { 50% { transform: translateY(-4px); } }
.joincard:not(.joined) { animation: slot-pulse 2.4s ease-in-out infinite; }
@keyframes slot-pulse { 50% { border-color: rgba(255,255,255,.34); } }
.joincard .avatar { width: 42px; height: 52px; border-radius: 21px; }
.joincard .avatar .eye { top: 13px; width: 9px; height: 11px; }
.joincard .avatar .eye.l { left: 9px; } .joincard .avatar .eye.r { right: 9px; }
.joincard .who { font-size: 16px; }

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
.hint { font-size: 13px; color: rgba(255,255,255,.85);
  background: linear-gradient(180deg, rgba(20,15,38,.72), rgba(14,10,26,.72));
  padding: 14px 26px 12px; border-radius: 18px;
  border: 1px solid rgba(255,255,255,.09); backdrop-filter: blur(10px); }
.ctl-table { display: grid; grid-template-columns: 46px auto auto auto; gap: 7px 26px;
  align-items: center; justify-items: start; }
.ctl-h { font-size: 10.5px; letter-spacing: 2px; opacity: .5; font-weight: 800; }
.ctl-who { font-weight: 900; font-size: 13px; }
.ctl-meta { margin-top: 10px; padding-top: 9px; border-top: 1px solid rgba(255,255,255,.09);
  display: flex; gap: 20px; justify-content: center; font-size: 12.5px; opacity: .85; }
.ctl-meta span { display: flex; align-items: center; gap: 6px; }
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
  padding: 13px 34px; border-radius: 16px; text-align: center;
  background: rgba(15,11,28,.88); backdrop-filter: blur(6px);
  border: 1px solid rgba(255,255,255,.13); box-shadow: 0 12px 36px rgba(0,0,0,.5);
  transition: transform .3s cubic-bezier(.2,1.6,.4,1), opacity .3s; }
.event-banner.hidden { transform: translateX(-50%) scale(.7); opacity: 0; pointer-events: none; }
.event-banner .ev-title { font-size: 23px; font-weight: 900; color: #8ad0ff;
  text-shadow: 0 0 22px rgba(138,208,255,.55); letter-spacing: -0.5px; }
.event-banner .ev-desc { font-size: 13.5px; opacity: .75; margin-top: 3px; }
.event-banner.pulse { animation: evpulse .5s; }
@keyframes evpulse { 30% { transform: translateX(-50%) scale(1.12); } }

.hud { position: absolute; bottom: 2.5%; left: 50%; transform: translateX(-50%);
  display: flex; gap: 10px; }
.chip { display: flex; align-items: center; gap: 10px; padding: 8px 16px 8px 9px;
  border-radius: 999px; background: rgba(15,11,28,.82); backdrop-filter: blur(6px);
  border: 1px solid rgba(255,255,255,.09); }
.chip .info { display: flex; flex-direction: column; gap: 0; min-width: 92px; }
.chip .pname { font-size: 12.5px; font-weight: 800; letter-spacing: .3px; }
.chip .item { font-size: 12.5px; font-weight: 600; }
.chip .item.empty { opacity: .38; font-weight: 400; }
.chip .item.warn { color: #ff8a7a; font-weight: 800; animation: pulse 1s infinite; }
.chip .pts { font-size: 17px; font-weight: 900; font-variant-numeric: tabular-nums; }
.chip .pts small { font-size: 11px; opacity: .6; font-weight: 700; }
.avatar.mini { width: 27px; height: 34px; border-radius: 14px; }
.avatar.mini .eye { top: 9px; width: 6px; height: 7px; }
.avatar.mini .eye::after { bottom: 1px; left: 1.5px; width: 3px; height: 3.5px; }
.avatar.mini .eye.l { left: 6px; } .avatar.mini .eye.r { right: 6px; }

/* ── 심사 ── */
.judge-panel { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%);
  width: min(680px, 92vw); padding: 26px 30px; border-radius: 22px;
  background: linear-gradient(180deg, rgba(31,24,54,.97), rgba(19,14,36,.97));
  box-shadow: 0 20px 70px rgba(0,0,0,.6);
  border: 1px solid rgba(255,255,255,.09); border-top: 3px solid #ffcf6b;
  display: flex; flex-direction: column; gap: 14px; }
.judge-panel h2 { margin: 0 0 4px; font-size: 22px; color: #ffb86b;
  display: flex; align-items: center; gap: 10px; }
.judge-avatar { width: 46px; height: 46px; border-radius: 50%; object-fit: cover;
  border: 2px solid rgba(255,255,255,.22); box-shadow: 0 4px 14px rgba(0,0,0,.4); }
.tada-avatar { width: 62px; height: 62px; border-radius: 50%; object-fit: cover;
  border: 2px solid #ffd66b; margin: 0 auto 8px; display: block; }
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
.verdict.hi { background: linear-gradient(90deg, rgba(255,207,107,.14), rgba(255,255,255,.05)); }
.verdict.hi .score { color: #ffcf6b; text-shadow: 0 0 16px rgba(255,207,107,.4); }
.verdict.lo .score { color: #a89ec4; opacity: .8; }

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
.pod .stand.r1 { border-top: 4px solid #ffd66b; color: #ffd66b; }
.pod .stand.r2 { border-top: 4px solid #c8cdd6; color: #c8cdd6; }
.pod .stand.r3 { border-top: 4px solid #d2905c; color: #d2905c; }
.also-ran { display: flex; gap: 10px; align-items: center; font-size: 16px; font-weight: 700;
  opacity: .8; margin-top: 4px; }
.results-inner { display: flex; flex-direction: column; align-items: center; gap: 18px;
  position: relative; z-index: 1; }
.bubble { position: relative; margin-top: 20px; background: #fdf6ec; color: #2c2440;
  padding: 15px 26px; border-radius: 18px; font-weight: 700; font-size: 17px;
  max-width: 620px; text-align: center; line-height: 1.6;
  box-shadow: 0 10px 30px rgba(0,0,0,.4); }
.bubble::before { content: ''; position: absolute; top: -9px; left: 50%;
  transform: translateX(-50%); border: 10px solid transparent;
  border-bottom-color: #fdf6ec; border-top: 0; }
.bubble .by { display: block; margin-top: 6px; font-size: 12.5px; opacity: .55; font-weight: 800; }

.tada-card { position: absolute; left: 50%; top: 18%; transform: translateX(-50%) scale(.55);
  opacity: 0; padding: 22px 44px; border-radius: 22px; text-align: center;
  background: rgba(15,11,28,.95); border: 3px solid #ffd66b;
  box-shadow: 0 18px 60px rgba(0,0,0,.6), 0 0 46px rgba(255,214,107,.25);
  transition: transform .38s cubic-bezier(.2,1.7,.4,1), opacity .3s; pointer-events: none; }
.tada-card.shown { transform: translateX(-50%) scale(1); opacity: 1; }
.tada-card .t-label { font-size: 15px; font-weight: 800; letter-spacing: 4px; color: #ffd66b; }
.tada-card .t-main { font-size: clamp(20px, 3vw, 30px); font-weight: 900; margin-top: 8px;
  max-width: 70vw; line-height: 1.45; }

.confetti { position: absolute; top: -8vh; width: 10px; height: 16px; border-radius: 2px;
  pointer-events: none; z-index: 2; animation: confetti-fall linear forwards; }
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
  armless: boolean;
}

const CONFETTI_COLORS = ['#e4573d', '#3d7de4', '#e4b53d', '#4fbf5e', '#ffb86b', '#d9788f', '#8ad0ff'];

function colorHex(c: number): string {
  return `#${c.toString(16).padStart(6, '0')}`;
}

function avatarHtml(color: number | null, mini = false): string {
  const cls = mini ? 'avatar mini' : 'avatar';
  if (color === null) return `<div class="${cls} ghost"></div>`;
  return `<div class="${cls}" style="background:${colorHex(color)}"><span class="eye l"></span><span class="eye r"></span></div>`;
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
  private tadaEl!: HTMLDivElement;

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

  /** 생성형 아트 로드 성공 시 채워지는 URL (심사 패널 등에서 사용) */
  private judgeArtUrl: string | null = null;

  private lobbyEl!: HTMLDivElement;

  private buildMenu() {
    this.menuEl = this.el('div', 'screen dim', this.root);
    const backdrop = this.el('div', 'menu-backdrop', this.menuEl);

    this.lobbyEl = this.el('div', 'screen', this.menuEl);
    this.lobbyEl.style.position = 'relative';
    this.lobbyEl.style.inset = 'auto';
    const logo = this.el('div', 'logo', this.lobbyEl,
      `<div class="big">잡아라! <em>코지 룸</em></div><div class="ribbon">1~2인 물리 난투!</div>`);
    this.el('div', 'subtitle', this.lobbyEl, '주제에 맞는 물건을 잡아라 — 뺏고, 던지고, AI 심사를 받아라!');
    this.joinRow = this.el('div', 'joinrow', this.lobbyEl);
    this.controlsHint = this.el('div', 'hint', this.lobbyEl);
    this.rebindPrompt = this.el('div', 'rebind-prompt', this.lobbyEl);
    this.startHint = this.el('div', 'start-hint hidden', this.lobbyEl, `${kbd('R')} 눌러 시작!`);
    this.el('div', 'menu-foot', this.lobbyEl, `<span>${kbd('K')} 키 변경</span>`);

    // 생성형 아트 — 로드되면 텍스트 로고를 이미지로, 배경에 키 비주얼
    loadArt(ART.logo, (url) => {
      if (!url) return;
      logo.querySelector('.big')!.outerHTML = `<img class="logo-img" src="${url}" alt="잡아라! 코지 룸" />`;
      logo.classList.add('has-img'); // 리본 위치를 이미지 여백에 맞춰 보정
    });
    loadArt(ART.keyart, (url) => {
      if (url) {
        backdrop.style.backgroundImage = `url('${url}')`;
        backdrop.classList.add('on');
      }
    });
    loadArt(ART.judge, (url) => {
      this.judgeArtUrl = url;
    });
  }

  /** 로비 화면으로 전환 */
  showLobbyScreen() {
    this.menuEl.classList.remove('hidden');
    this.lobbyEl.classList.remove('hidden');
  }

  private buildGameHud() {
    this.topicEl = this.el('div', 'topic-banner hidden', this.root);
    this.timerEl = this.el('div', 'timer hidden', this.root);
    this.hudEl = this.el('div', 'hud hidden', this.root);
    this.eventEl = this.el('div', 'event-banner hidden', this.root);
    this.tadaEl = this.el('div', 'tada-card', this.root);
  }

  hideResults() {
    this.resultsEl.classList.add('hidden');
  }

  // ── 클로즈업 "따란" 카드 ──
  showTada(label: string, main: string) {
    const avatar = this.judgeArtUrl ? `<img class="tada-avatar" src="${this.judgeArtUrl}" alt="" />` : '';
    this.tadaEl.innerHTML = `${avatar}<div class="t-label">${label}</div><div class="t-main">${main}</div>`;
    this.tadaEl.classList.remove('shown');
    requestAnimationFrame(() => requestAnimationFrame(() => this.tadaEl.classList.add('shown')));
  }

  hideTada() {
    this.tadaEl.classList.remove('shown');
  }

  private buildJudge() {
    this.judgeEl = this.el('div', 'judge-panel hidden', this.root);
  }

  private resultsInner!: HTMLDivElement;

  private buildResults() {
    this.resultsEl = this.el('div', 'screen dim hidden', this.root);
    const backdrop = this.el('div', 'menu-backdrop', this.resultsEl);
    loadArt(ART.keyart2, (url) => {
      if (url) {
        backdrop.style.backgroundImage = `url('${url}')`;
        backdrop.classList.add('on');
      }
    });
    this.resultsInner = this.el('div', 'results-inner', this.resultsEl);
  }

  // ── 메뉴 ──
  setControlsHint(html: string) {
    this.controlsHint.innerHTML = html;
  }

  setRebindPrompt(text: string | null) {
    this.rebindPrompt.textContent = text ?? '';
  }

  showMenu(joined: { tag: string; color: number; name: string }[], canStart: boolean) {
    this.menuEl.classList.remove('hidden');
    this.lobbyEl.classList.remove('hidden');
    this.joinRow.innerHTML = '';
    for (let i = 0; i < 2; i++) {
      const j = joined[i];
      const card = document.createElement('div');
      card.className = 'joincard' + (j ? ' joined' : '');
      if (j) {
        card.style.borderColor = colorHex(j.color);
        card.innerHTML =
          `<div class="ready">READY!</div>${avatarHtml(j.color)}` +
          `<div class="who" style="color:${colorHex(j.color)}">${j.name}</div><div class="tag">${j.tag}</div>`;
      } else {
        card.innerHTML =
          `<div class="ready"></div>${avatarHtml(null)}` +
          `<div class="who" style="opacity:.4">?</div><div class="tag">잡기 버튼으로 참가</div>`;
      }
      this.joinRow.appendChild(card);
    }
    this.startHint.classList.toggle('hidden', !canStart);
  }

  hideMenu() {
    this.menuEl.classList.add('hidden');
  }

  // ── 라운드 ──
  showTopic(round: number, totalRounds: number, text: string, themeName: string) {
    this.topicEl.classList.remove('hidden', 'mini');
    this.topicEl.innerHTML = `<span class="label">ROUND ${round}/${totalRounds} — ${themeName}</span>${text}`;
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
      chip.innerHTML =
        avatarHtml(e.color, true) +
        `<div class="info"><span class="pname" style="color:${colorHex(e.color)}">${e.name}</span>` +
        (e.heldName
          ? `<span class="item">${e.heldName}</span>`
          : e.armless
            ? `<span class="item warn">팔이 없다! 팔을 찾아라!</span>`
            : `<span class="item empty">빈손</span>`) +
        `</div><span class="pts">${e.score}<small>점</small></span>`;
      this.hudEl.appendChild(chip);
    }
  }

  // ── 심사 ──
  showJudgePanel(topicText: string) {
    this.judgeEl.classList.remove('hidden');
    const avatar = this.judgeArtUrl ? `<img class="judge-avatar" src="${this.judgeArtUrl}" alt="" />` : `<span class="ai-chip">AI</span>`;
    this.judgeEl.innerHTML = `<h2>${avatar}AI 심사위원의 판정</h2><div class="topic-small">주제: ${topicText}</div>`;
    this.judgeList = this.el('div', '', this.judgeEl);
    this.judgeList.style.display = 'flex';
    this.judgeList.style.flexDirection = 'column';
    this.judgeList.style.gap = '10px';
  }

  addVerdict(name: string, color: number, itemName: string | null, score: number, comment: string) {
    const v = document.createElement('div');
    v.className = 'verdict' + (score >= 70 ? ' hi' : score < 40 ? ' lo' : '');
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
    this.resultsInner.innerHTML = '';
    this.el('div', 'results-title', this.resultsInner, '결과 발표!');

    // 시상대 — 상위 3명 (2등 · 1등 · 3등 배치)
    const podium = this.el('div', 'podium', this.resultsInner);
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
        `<div class="stand r${rank + 1}" style="height:${standH[rank]}px">${rank + 1}</div>`;
      podium.appendChild(pod);
    }
    // 4위
    for (let i = 3; i < rows.length; i++) {
      const r = rows[i];
      this.el('div', 'also-ran', this.resultsInner,
        `<span style="opacity:.6">${i + 1}위</span><span style="color:${colorHex(r.color)}">${r.name}</span><span>${r.score}점</span>`);
    }

    const avatar = this.judgeArtUrl
      ? `<img class="tada-avatar" src="${this.judgeArtUrl}" alt="" style="margin-bottom:4px" />` : '';
    this.el('div', 'bubble', this.resultsInner, `${avatar}${comment}<span class="by">— AI 심사위원</span>`);
    this.el('div', 'start-hint', this.resultsInner, `${kbd('R')} 눌러 다시하기`);
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
