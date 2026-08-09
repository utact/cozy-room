/** DOM 오버레이 UI — 메뉴/주제 배너/타이머/HUD/심사 패널/결과 */

import { ART, loadArt } from './art';
import type { CharacterStage } from './character';

const CSS = `
@font-face { font-family: 'Jalnan'; src: url('assets/fonts/jalnan.woff') format('woff');
  font-weight: 400; font-display: swap; }

/*
 * 색은 게임이 벌어지는 장소 — 램프 하나 켜둔 밤의 거실 — 에서 가져온다.
 * 채도 높은 색은 플레이어 4명(빨강·파랑·노랑·초록)의 정체성으로만 쓰고,
 * UI 자체는 밤(어두운 중성 갈색)·램프빛(호박색)·크림(따뜻한 종이색) 셋으로만 民다.
 * 강조색을 램프빛 하나로 묶어 두면 어디를 봐야 하는지가 분명해진다.
 */
.ui-root {
  --night: #191411;          /* 방의 그림자 — 보랏빛 한 톨 없는 따뜻한 먹빛 */
  --night-deep: #0f0c0a;
  --panel: rgba(28,22,18,.9);
  --panel-solid: #1f1915;
  --lamp: #f0a94c;           /* 유일한 강조색 — 스탠드 조명 */
  --lamp-hot: #ffc978;
  --cream: #f7efe4;          /* 본문 — 순백 대신 따뜻한 종이색 */
  --cream-dim: rgba(247,239,228,.62);
  --cream-faint: rgba(247,239,228,.34);
  --line: rgba(247,239,228,.14);
  --shadow: 0 12px 32px rgba(0,0,0,.45);
  --shadow-lg: 0 22px 64px rgba(0,0,0,.6);

  --fs-h1: clamp(28px, 3.6vw, 40px);
  --fs-h2: 21px;
  --fs-body: 15px;
  --fs-label: 11px;

  position: absolute; inset: 0; pointer-events: none; color: var(--cream);
  font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
}
/* 굵고 통통한 타이틀/헤드라인 전용 — 본문·수치는 가독성 위해 Pretendard 유지 */
.headline { font-family: 'Jalnan', 'Pretendard', sans-serif; font-weight: 400; }
.screen { position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 18px; }
.dim { background: radial-gradient(ellipse at 50% 42%,
  rgba(25,20,17,.35) 0%, rgba(15,12,10,.9) 100%); }

/* ── 키캡 ── */
/* Kenney CC0 Input Prompts 아이콘이 기본. 리바인딩 불가라 매핑에 없는 키는 없지만,
   혹시 빠지면 아래 텍스트 칩으로 폴백된다 */
.key { display: inline-block; min-width: 14px; padding: 2px 9px; border-radius: 6px;
  background: var(--cream); color: var(--night); border-bottom: 2px solid rgba(0,0,0,.25);
  font-weight: 800; font-size: 12px; text-align: center; }
.key.key-icon { width: 25px; height: 25px; min-width: 0; padding: 0; border: none;
  background: none; background-size: contain; background-repeat: no-repeat;
  background-position: center; vertical-align: middle;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,.4)); }

/* ── 메뉴 ── */
.menu-backdrop { position: absolute; inset: 0; z-index: 0; opacity: 0;
  background-size: cover; background-position: center; transition: opacity .9s; }
.menu-backdrop.on { opacity: 1; }
/* 왼쪽(타이틀)은 짙게 덮어 글자가 읽히게, 가운데는 열어 키비주얼을 보여준다 */
.menu-backdrop::after { content: ''; position: absolute; inset: 0;
  background: linear-gradient(100deg, rgba(15,12,10,.94) 0%, rgba(15,12,10,.62) 40%,
    rgba(15,12,10,.42) 60%, rgba(15,12,10,.9) 100%); }
.screen.dim > :not(.menu-backdrop):not(.confetti):not(.results-scrim) {
  position: relative; z-index: 1; }

/* 파티 게임 로비의 정석 — 타이틀을 중앙에 크게 박고 그 아래 참가 슬롯을 한 줄로 세운다.
   위아래 여백이 비슷해 보이도록 블록 간격을 촘촘히 잡는다 */
.lobby-layout { display: flex; flex-direction: column; align-items: center;
  gap: 20px; width: min(1100px, 94vw); }
.lobby-hero { display: flex; flex-direction: column; align-items: center; text-align: center; }

.logo { position: relative; transform: rotate(-2.5deg);
  animation: logo-bob 3.2s ease-in-out infinite; }
.logo-img { width: min(440px, 38vw); display: block; margin: 0 auto;
  filter: drop-shadow(0 16px 34px rgba(0,0,0,.6)); }
@keyframes logo-bob { 50% { transform: rotate(-2.5deg) translateY(-7px); } }
.logo .pending { visibility: hidden; }
.logo .big { font-size: clamp(38px, 5.2vw, 60px); font-weight: 900; letter-spacing: -2px;
  line-height: 1.02;
  text-shadow: 0 3px 0 #c94b32, 0 7px 0 #7e2e1f, 0 16px 34px rgba(0,0,0,.65); }
.logo .big em { color: var(--lamp); font-style: normal;
  text-shadow: 0 3px 0 #c98029, 0 7px 0 #7e511a, 0 16px 34px rgba(0,0,0,.65); }
.logo .ribbon { position: absolute; top: -18px; right: -34px; transform: rotate(9deg);
  background: #e4573d; padding: 6px 14px; border-radius: 999px;
  font-weight: 800; font-size: 13px; box-shadow: var(--shadow); }
/* 로고 webp는 투명 여백을 잘라낸 상태라, 리본을 그림 모서리 기준으로 바로 붙일 수 있다 */
.logo.has-img .ribbon { top: -12%; right: -11%; }
.logo .ribbon.has-img { background: none; padding: 0; box-shadow: none; transform: none; }
.logo .ribbon.has-img img { display: block; width: 132px; transform: rotate(50deg);
  filter: drop-shadow(0 6px 12px rgba(0,0,0,.5)); }

/* 한 줄에 한 동사 — 게임이 뭘 시키는지 순서대로 읽힌다 */
.tagline { margin-top: 14px; font-size: 16px; font-weight: 700; line-height: 1.7;
  color: var(--cream-dim); text-shadow: 0 2px 8px rgba(0,0,0,.7); }
.tagline .lead { display: block; font-size: 20px; color: var(--cream); font-weight: 800; }
.tagline em { font-style: normal; color: var(--lamp); font-weight: 800; }
.start-hint { font-size: 19px; font-weight: 800; color: var(--lamp-hot);
  display: flex; align-items: center; gap: 9px;
  animation: pulse 1.4s infinite; text-shadow: 0 2px 10px rgba(0,0,0,.6); }
@keyframes pulse { 50% { opacity: .5; } }

/* ── 참가 슬롯 — 한 줄에 넷, 카드마다 자기 조작키를 직접 들고 있다 (별도 범례표 없음) ── */
.player-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
/* 카드 높이를 고정하고 내용을 위·아래로 분배 — 사람 슬롯(키 2줄)과 AI 슬롯(1줄)의
   높이가 달라 줄이 안 맞던 문제를 없앤다 */
.joincard { position: relative; width: 168px; height: 202px; padding: 14px 12px 12px;
  border-radius: 16px; text-align: center; display: flex; flex-direction: column;
  align-items: center; background: var(--panel); border: 2px dashed var(--line);
  backdrop-filter: blur(16px); box-shadow: var(--shadow);
  transition: box-shadow .3s, border-color .3s; }
/* 캐릭터 자리는 상태와 무관하게 크기가 고정 — 참가 순간 카드가 들썩이지 않는다.
   (빈칸·정지이미지·실시간 3D 어느 쪽이 들어와도 같은 상자) */
.slot-figure { width: 100%; height: 96px; flex: none;
  display: flex; align-items: center; justify-content: center; }
.slot-figure canvas { display: block; width: 100%; height: 100%; }
.slot-figure.as-image { background-size: contain; background-repeat: no-repeat;
  background-position: center; }
.slot-ghost { width: 46px; height: 46px; color: var(--cream); opacity: .16; }
/* 이름·안내 칸도 높이를 고정 — 사람 슬롯(키 2줄)과 AI 슬롯(1줄)의 줄이 어긋나지 않는다 */
.slot-name { height: 24px; line-height: 24px; font-size: 17px; font-weight: 900; }
.slot-name.empty { color: var(--cream-faint); }
.slot-foot { height: 58px; display: flex; flex-direction: column; gap: 6px;
  align-items: center; justify-content: center; }
.slot-tag { font-size: var(--fs-label); color: var(--cream-dim);
  letter-spacing: .3px; font-weight: 700;
  display: flex; align-items: center; gap: 6px; }
/* READY는 카드 안이 아니라 모서리에 걸린 태그 — 내부 여백을 먹지 않는다 */
.ready-badge { position: absolute; top: -9px; left: 12px; padding: 3px 9px;
  border-radius: 6px; background: #4fbf5e; color: #10240f;
  font-size: 9.5px; letter-spacing: 2px; font-weight: 900; }
.joincard .tag { font-size: var(--fs-label); color: var(--cream-dim);
  min-height: 13px; letter-spacing: .5px; font-weight: 700; }
.joincard .who { font-size: 17px; font-weight: 900; }
.joincard .who.empty { color: var(--cream-faint); }
/* 참가해도 카드가 움직이지 않는다 — 테두리와 배경만 채워진다 */
.joincard.joined { border-style: solid; border-color: currentColor;
  background: rgba(40,32,26,.92);
  box-shadow: var(--shadow-lg); }
.joincard:not(.joined) { animation: slot-pulse 2.4s ease-in-out infinite; }
@keyframes slot-pulse { 50% { border-color: rgba(247,239,228,.3); } }

.avatar { width: 50px; height: 62px; border-radius: 25px; position: relative; flex: none;
  background: #4a423a; box-shadow: inset -6px -8px 0 rgba(0,0,0,.16); }
.avatar .eye { position: absolute; top: 16px; width: 11px; height: 13px;
  border-radius: 50%; background: var(--cream); }
.avatar .eye::after { content: ''; position: absolute; bottom: 2px; left: 3px;
  width: 5px; height: 6px; border-radius: 50%; background: #1b1b22; }
.avatar .eye.l { left: 11px; } .avatar .eye.r { right: 11px; }
.avatar.portrait { background: none; box-shadow: none; border-radius: 0;
  background-size: contain; background-repeat: no-repeat; background-position: center bottom; }
/* 빈 슬롯 — CSS로 캐릭터 모양을 흉내 내면 실제 에셋과 안 맞는다. 같은 초상 이미지를
   그대로 쓰되 밝기를 눌러 실루엣으로만 보여준다 (형태가 언제나 실물과 일치) */
.avatar.ghost { background: none; box-shadow: none; border-radius: 0;
  background-size: contain; background-repeat: no-repeat; background-position: center bottom;
  filter: brightness(0) invert(1); opacity: .17; }

.keys { display: flex; flex-direction: column; gap: 6px; align-items: center; }
.keys-row { display: flex; gap: 5px; align-items: center; }
/* 액션 키 옆 설명 — 키가 하나뿐이라 무슨 키인지 글자로 붙여 준다 */
.key-cap { font-size: var(--fs-label); color: var(--cream-dim); font-weight: 700; }
.keys-row.ai-hint { gap: 7px; font-size: var(--fs-label); color: var(--cream-dim); font-weight: 700; }

/* ── 라운드 ── */
/* 주제 판 — 이미지 대신 코드로 그린다. 글자 길이에 따라 자유롭게 늘어나고, 어떤 길이에도
   모서리나 질감이 뭉개지지 않는다 */
.topic-banner { position: absolute; top: 10%; left: 50%; transform: translateX(-50%);
  max-width: min(860px, 86vw); padding: 16px 42px 20px; border-radius: 18px;
  text-align: center; background: var(--panel-solid);
  box-shadow: var(--shadow-lg);
  font-size: var(--fs-h1); line-height: 1.32; color: var(--cream);
  /* 한국어는 음절 단위로 끊으면 "챙긴다/면?" 처럼 어절이 쪼개진다 — 어절 단위로 넘기고
     줄 길이를 고르게 맞춘다 */
  word-break: keep-all; text-wrap: balance;
  transition: transform .35s cubic-bezier(.2,1.6,.4,1), opacity .3s,
    font-size .35s, padding .35s, top .35s, left .35s; }
.topic-banner.hidden { transform: translateX(-50%) translateY(-30px) scale(.8); opacity: 0; }
.topic-banner .label { display: block; font-size: var(--fs-label); font-weight: 800;
  color: var(--lamp); letter-spacing: 3px; margin-bottom: 6px; }
/* 난투 중엔 시야를 비워야 하므로 좌상단으로 축소 */
.topic-banner.mini { left: 16px; top: 14px; transform: none; max-width: 34vw;
  padding: 9px 20px 11px; font-size: 16px; border-radius: 12px; }
.topic-banner.mini .label { display: none; }

.timer { position: absolute; top: 3%; left: 50%; transform: translateX(-50%);
  font-size: 46px; font-weight: 900; text-shadow: 0 4px 14px rgba(0,0,0,.7);
  font-variant-numeric: tabular-nums; }
.timer.urgent { color: #ff6b5b; animation: pulse .5s infinite; }

.event-banner { position: absolute; top: 13%; left: 50%; transform: translateX(-50%);
  padding: 13px 34px; border-radius: 14px; text-align: center;
  background: var(--panel); backdrop-filter: blur(6px);
  border: 1px solid var(--line); box-shadow: var(--shadow);
  transition: transform .3s cubic-bezier(.2,1.6,.4,1), opacity .3s; }
.event-banner.hidden { transform: translateX(-50%) scale(.7); opacity: 0; pointer-events: none; }
.event-banner .ev-title { font-size: 22px; font-weight: 900; color: var(--lamp-hot); }
.event-banner .ev-desc { font-size: 13.5px; color: var(--cream-dim); margin-top: 3px; }
.event-banner.pulse { animation: evpulse .5s; }
@keyframes evpulse { 30% { transform: translateX(-50%) scale(1.12); } }

/* 아래 여백은 %가 아니라 고정값 — 화면이 낮으면 %가 작아져 칩이 가장자리에 붙어 잘린다.
   4인이 항상 한 줄에 들어가야 하므로 줄바꿈 없이 칩 폭을 줄인다 */
.hud { position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%);
  display: flex; gap: 8px; flex-wrap: nowrap; justify-content: center; max-width: 96vw; }
.chip { display: flex; align-items: center; gap: 8px; padding: 6px 13px 6px 7px;
  border-radius: 999px; background: var(--panel); backdrop-filter: blur(6px);
  border: 1px solid var(--line); min-width: 0; }
/* 물건 이름이 잘리면 뭘 들었는지 알 수 없다 — 이름 길이에 맞춰 늘어나게 두고,
   아주 긴 이름일 때만 말줄임으로 넘긴다 */
.chip .info { display: flex; flex-direction: column; gap: 0; min-width: 0;
  max-width: 150px; text-align: left; }
.chip .item { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chip .pname { font-size: 12.5px; font-weight: 800; letter-spacing: .3px; }
.chip .item { font-size: 12.5px; font-weight: 600; }
.chip .item.empty { color: var(--cream-faint); font-weight: 400; }
.chip .pts { font-size: 17px; font-weight: 900; font-variant-numeric: tabular-nums; }
.chip .pts small { font-size: 11px; color: var(--cream-dim); font-weight: 700; }
.avatar.mini { width: 30px; height: 36px; }
.avatar.mini .eye { top: 9px; width: 6px; height: 7px; }
.avatar.mini .eye::after { bottom: 1px; left: 1.5px; width: 3px; height: 3.5px; }
.avatar.mini .eye.l { left: 6px; } .avatar.mini .eye.r { right: 6px; }

/* ── 심사 ── */
/* 주제 판과 같은 조형(어두운 판 + 램프색 윗선)을 써서 두 화면이 한 게임처럼 보이게 한다 */
.judge-panel { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%);
  width: min(600px, 92vw); padding: 22px 26px 24px; border-radius: 18px;
  background: var(--panel-solid);
  box-shadow: var(--shadow-lg);
  display: flex; flex-direction: column; gap: 10px; }
.judge-panel h2 { margin: 0; font-size: var(--fs-h2); color: var(--lamp-hot);
  display: flex; align-items: center; gap: 11px; }
.judge-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover;
  border: 2px solid rgba(255,214,150,.35); }
.tada-avatar { width: 60px; height: 60px; border-radius: 50%; object-fit: cover;
  border: 2px solid var(--lamp); margin: 0 auto 8px; display: block; }
.judge-panel .topic-small { font-size: 14px; color: var(--cream-dim);
  padding-bottom: 4px; }
/* 판정 한 줄 — 누구 것인지는 왼쪽 색 막대로 안다. 이름 앞글자를 딴 동그라미는 쓰지 않는다 */
.verdict { display: flex; align-items: center; gap: 14px; padding: 11px 14px;
  border-radius: 10px; background: rgba(0,0,0,.26);
  transform: translateX(24px); opacity: 0; transition: all .4s cubic-bezier(.2,1.4,.4,1); }
.verdict.shown { transform: none; opacity: 1; }
.verdict .body { flex: 1; min-width: 0; }
.verdict .who { font-size: var(--fs-label); font-weight: 900; letter-spacing: 1px; }
.verdict .head { font-weight: 800; font-size: var(--fs-body); margin-top: 1px; }
.verdict .comment { font-size: 13px; color: var(--cream-dim); margin-top: 2px;
  line-height: 1.5; word-break: keep-all; }
.verdict .score { font-size: 27px; font-weight: 900; font-variant-numeric: tabular-nums; }
.verdict.hi { background: rgba(240,169,76,.13); }
.verdict.hi .score { color: var(--lamp-hot); }
.verdict.lo .score { color: var(--cream-faint); }

/* ── 결과 ── */
/* 우승자 한 명이 가운데서 춤춘다. 시상대·띠·말풍선 없이 이 장면 하나로만 승부한다 */
/* 배경 키비주얼이 화려해서 그대로 두면 우승자가 묻힌다 — 결과 화면에서만 더 깊게 덮는다 */
.results-scrim { position: absolute; inset: 0; z-index: 0;
  background: radial-gradient(ellipse 42% 52% at 50% 46%,
    rgba(12,9,7,.4) 0%, rgba(12,9,7,.88) 55%, rgba(12,9,7,.95) 100%); }
.results-inner { display: flex; flex-direction: column; align-items: center; gap: 6px;
  position: relative; z-index: 1; }
.win-label { font-size: var(--fs-label); letter-spacing: 6px; font-weight: 900;
  color: var(--lamp); }
.win-stage { position: relative; width: clamp(260px, 30vw, 380px);
  height: clamp(300px, 42vh, 440px);
  animation: win-in .6s cubic-bezier(.2,1.4,.4,1) backwards; }
/* 램프빛이 바닥에 고인 듯한 원 — 캐릭터를 배경에서 떼어 놓는다 */
.win-stage::before { content: ''; position: absolute; left: 50%; bottom: 4%;
  width: 116%; height: 46%; transform: translateX(-50%); z-index: -1;
  background: radial-gradient(ellipse at center,
    rgba(240,169,76,.34) 0%, rgba(240,169,76,.12) 45%, transparent 72%); }
.win-stage canvas { display: block; width: 100%; height: 100%; }
@keyframes win-in { from { transform: scale(.8); opacity: 0; } }
.win-name { font-size: clamp(34px, 5vw, 52px); line-height: 1; margin-top: -8px; }
.win-score { font-size: 22px; font-weight: 900; color: var(--cream-dim);
  font-variant-numeric: tabular-nums; }
/* 나머지 순위는 조용한 한 줄 — 우승자와 경쟁하지 않게 */
.rank-row { display: flex; gap: 22px; margin-top: 26px; }
.rank-item { display: flex; align-items: center; gap: 7px; font-size: 14px; font-weight: 700; }
.rank-item .sc { color: var(--cream-dim); font-variant-numeric: tabular-nums; }
.rank-item .avatar { width: 26px; height: 32px; }

.tada-card { position: absolute; left: 50%; top: 18%; transform: translateX(-50%) scale(.55);
  opacity: 0; padding: 22px 44px; border-radius: 18px; text-align: center;
  background: var(--panel-solid); border: 3px solid var(--lamp);
  box-shadow: var(--shadow-lg); pointer-events: none;
  transition: transform .38s cubic-bezier(.2,1.7,.4,1), opacity .3s; }
.tada-card.shown { transform: translateX(-50%) scale(1); opacity: 1; }
.tada-card .t-label { font-size: 14px; font-weight: 800; letter-spacing: 4px; color: var(--lamp); }
.tada-card .t-main { font-size: clamp(20px, 3vw, 30px); margin-top: 8px;
  max-width: 70vw; line-height: 1.45; word-break: keep-all; text-wrap: balance; }

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
}

/** 색종이는 플레이어 4색 + 램프빛만 — 팔레트 밖의 색을 뿌리지 않는다 */
const CONFETTI_COLORS = ['#e4573d', '#3d7de4', '#e4b53d', '#4fbf5e', '#f0a94c', '#f7efe4'];

function colorHex(c: number): string {
  return `#${c.toString(16).padStart(6, '0')}`;
}

function avatarHtml(color: number | null, mini = false, portrait: string | null = null): string {
  const cls = mini ? 'avatar mini' : 'avatar';
  // color === null → 빈 슬롯. portrait이 있으면 그 형태를 실루엣으로 눌러 쓴다
  if (color === null) {
    const bg = portrait ? ` style="background-image:url('${portrait}')"` : '';
    return `<div class="${cls} ghost"${bg}></div>`;
  }
  if (portrait) return `<div class="${cls} portrait" style="background-image:url('${portrait}')"></div>`;
  return `<div class="${cls}" style="background:${colorHex(color)}"><span class="eye l"></span><span class="eye r"></span></div>`;
}

/** 표시 텍스트(keyName() 결과) → Kenney 키캡 아이콘 파일명. 매핑에 없는 키(리바인딩된
 * 임의 키 등)는 기존 텍스트 칩으로 자연스럽게 폴백 */
const KEY_ICONS: Record<string, string> = {
  W: 'W', A: 'A', S: 'S', D: 'D', E: 'E', R: 'R', K: 'K', B: 'B',
  Space: 'Space', Enter: 'Enter', LShift: 'Shift', RShift: 'Shift',
  '↑': 'Up', '↓': 'Down', '←': 'Left', '→': 'Right',
};

/**
 * 빈 슬롯 표시.
 *
 * 3D 캐릭터의 외곽선을 따라 그리면 각도·포즈 때문에 팔이 잘린 것처럼 보이고, 어설픈
 * 모조품이 된다. 여기서 전할 건 "이 자리에 사람이 하나 더 앉을 수 있다"뿐이므로,
 * 어디서나 그 뜻으로 읽히는 인물 아이콘을 쓴다.
 */
const SLOT_SILHOUETTE = `
<svg class="slot-ghost" viewBox="0 0 64 64" aria-hidden="true">
  <g fill="currentColor">
    <circle cx="32" cy="20" r="11.5"/>
    <path d="M32 36c-11.6 0-20.5 7.6-20.5 17.4V58h41v-4.6C52.5 43.6 43.6 36 32 36Z"/>
  </g>
</svg>`;

/** 슬롯 이름 — 비어 있든 차 있든 같은 라벨을 쓴다 (player.ts의 PLAYER_NAMES와 같은 순서) */
const SLOT_NAMES = ['1P', '2P', '3P', '4P'];

export function kbd(text: string): string {
  const icon = KEY_ICONS[text];
  if (icon) {
    return `<span class="key key-icon" style="background-image:url('assets/ui/keys/key-${icon}.webp')" title="${text}"></span>`;
  }
  return `<span class="key">${text}</span>`;
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
  private eventEl!: HTMLDivElement;
  private tadaEl!: HTMLDivElement;
  private portraits = new Map<number, string>();
  private portraitsFull = new Map<number, string>();
  /** 살아 움직이는 캐릭터를 만들어 주는 콜백 (CharacterLibrary.createStage) */
  private stageFactory: ((color: number, clip: string) => CharacterStage | null) | null = null;
  private winStage: CharacterStage | null = null;
  private lobbyStages: CharacterStage[] = [];
  /** 로비 카드를 다시 그릴지 판단하는 서명 — 바뀔 때만 DOM을 손댄다 */
  private menuSig = '';

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

    const layout = this.el('div', 'lobby-layout', this.lobbyEl);
    const hero = this.el('div', 'lobby-hero', layout);
    const logo = this.el('div', 'logo', hero,
      `<div class="big pending headline">잡아라! <em>코지 룸</em></div><div class="ribbon pending">2~4인 물리 난투!</div>`);
    const ribbonEl = logo.querySelector('.ribbon') as HTMLDivElement;
    this.el('div', 'tagline', hero,
      '<span class="lead">주제에 맞는 물건을 주워라!</span>' +
      '뺏고, 던지고, <em>우당탕탕 물리 난투</em><br/>' +
      '시간이 끝나면 AI가 점수를 매긴다');

    this.joinRow = this.el('div', 'player-grid', layout);
    // 시작 안내는 슬롯 아래 — 타이틀 → 소개 → 참가 → 시작 순서로 읽힌다
    this.startHint = this.el('div', 'start-hint hidden', layout, `${kbd('R')} 눌러 시작!`);

    // 생성형 아트 — 로컬 번들이 항상 있으므로 이미지가 뜨는 게 기본. 텍스트는
    // pending으로 숨겨뒀다가, 로드가 실패했을 때만(거의 없음) 드러내 — 로드 중
    // "이상한" 텍스트가 잠깐 번쩍였다 이미지로 바뀌는 깜빡임을 없앤다
    loadArt(ART.logo, (url) => {
      const big = logo.querySelector('.big')!;
      if (!url) { big.classList.remove('pending'); return; }
      big.outerHTML = `<img class="logo-img" src="${url}" alt="잡아라! 코지 룸" />`;
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
    loadArt(ART.ribbonBadge, (url) => {
      ribbonEl.classList.remove('pending');
      if (!url) return;
      ribbonEl.innerHTML = `<img src="${url}" alt="2~4인 물리 난투!" />`;
      ribbonEl.classList.add('has-img');
    });
  }

  /** 실제 캐릭터 GLB 렌더 초상 등록 — 없으면 CSS 실루엣 폴백 (CharacterLibrary 참고) */
  setPortraits(portraits: { bust: Map<number, string>; full: Map<number, string> }) {
    this.portraits = portraits.bust;
    this.portraitsFull = portraits.full;
  }

  /** 결과 화면에서 우승자를 실제로 춤추게 하려면 필요 */
  setStageFactory(fn: (color: number, clip: string) => CharacterStage | null) {
    this.stageFactory = fn;
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
    this.tadaEl.innerHTML = `${avatar}<div class="t-label">${label}</div><div class="t-main headline">${main}</div>`;
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
    this.el('div', 'results-scrim', this.resultsEl);
    loadArt(ART.keyart2, (url) => {
      if (url) {
        backdrop.style.backgroundImage = `url('${url}')`;
        backdrop.classList.add('on');
      }
    });
    this.resultsInner = this.el('div', 'results-inner', this.resultsEl);
  }

  // ── 메뉴 ──
  /**
   * @param totalSlots 로비 슬롯 총원 (사람+AI)
   * @param humanControls 키보드로 직접 참가 가능한 슬롯의 조작키(순서대로 P1, P2…) —
   *   길이만큼이 humanSlots. 나머지 슬롯은 AI 전용
   */
  showMenu(
    joined: { bot: boolean; color: number; name: string }[],
    canStart: boolean,
    totalSlots: number,
    humanControls: { up: string; down: string; left: string; right: string; action: string }[],
  ) {
    this.menuEl.classList.remove('hidden');
    this.lobbyEl.classList.remove('hidden');
    this.startHint.classList.toggle('hidden', !canStart);

    // 이 메서드는 매 프레임 호출된다. 참가 상황이 그대로면 아무것도 건드리지 않는다 —
    // 매번 DOM을 다시 그리면 애니메이션이 끊기고 카드가 들썩인다
    const sig = joined.map((j) => `${j.name}:${j.color}:${j.bot}`).join('|') + `/${totalSlots}`;
    if (sig === this.menuSig) return;
    this.menuSig = sig;

    for (const s of this.lobbyStages) s.dispose();
    this.lobbyStages = [];
    this.joinRow.innerHTML = '';

    const humanSlots = humanControls.length;
    for (let i = 0; i < totalSlots; i++) {
      const j = joined[i];
      const card = document.createElement('div');
      card.className = 'joincard' + (j ? ' joined' : '');
      const figure = document.createElement('div');
      figure.className = 'slot-figure';

      // 모든 카드가 [캐릭터 / 이름 / 안내] 3단을 똑같이 갖는다 — 네 장의 각 줄이 항상 맞는다.
      // 이름(1P·2P…)은 참가 전후로 동일하다. 채워질 때 바뀌는 건 캐릭터·테두리·READY뿐이라
      // 글자가 밀리지 않는다
      const name = SLOT_NAMES[i];
      const nameStyle = j ? ` style="color:${colorHex(j.color)}"` : '';
      let foot: string;

      if (j) {
        card.style.borderColor = colorHex(j.color);
        card.insertAdjacentHTML('beforeend', '<span class="ready-badge">READY</span>');
      } else {
        figure.innerHTML = SLOT_SILHOUETTE;
      }

      if (j?.bot) {
        foot = `<span class="slot-tag">AI가 대신 플레이</span>`;
      } else if (i < humanSlots) {
        // 사람 자리는 참가 후에도 자기 키를 계속 보여 준다 (내 키가 뭐였는지 확인용)
        const c = humanControls[i];
        foot =
          `<div class="keys-row">${kbd(c.up)}${kbd(c.left)}${kbd(c.down)}${kbd(c.right)}</div>` +
          `<div class="keys-row">${kbd(c.action)}<span class="key-cap">잡기 · 던지기</span></div>`;
      } else {
        foot = `<span class="slot-tag">${kbd('B')} 눌러 AI 채우기</span>`;
      }

      card.appendChild(figure);
      if (j) {
        // 참가한 캐릭터는 로비에서 실제로 숨 쉬며 서 있는다 (대기 클립)
        const stage = this.stageFactory?.(j.color, 'lobby') ?? null;
        if (stage) {
          this.lobbyStages.push(stage);
          stage.mount(figure);
        } else {
          figure.style.backgroundImage = `url('${this.portraitsFull.get(j.color) ?? ''}')`;
          figure.classList.add('as-image');
        }
      }
      card.insertAdjacentHTML('beforeend',
        `<div class="slot-name${j ? '' : ' empty'}"${nameStyle}>${name}</div>` +
        `<div class="slot-foot">${foot}</div>`);
      this.joinRow.appendChild(card);
    }
  }

  hideMenu() {
    this.menuEl.classList.add('hidden');
    // 로비를 떠나면 WebGL 컨텍스트를 놓아 준다
    for (const s of this.lobbyStages) s.dispose();
    this.lobbyStages = [];
    this.menuSig = '';
  }

  // ── 라운드 ──
  showTopic(round: number, totalRounds: number, text: string, themeName: string) {
    this.topicEl.classList.remove('hidden', 'mini');
    this.topicEl.innerHTML = `<span class="label">ROUND ${round}/${totalRounds} — ${themeName}</span><span class="headline">${text}</span>`;
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
        avatarHtml(e.color, true, this.portraits.get(e.color) ?? null) +
        `<div class="info"><span class="pname" style="color:${colorHex(e.color)}">${e.name}</span>` +
        (e.heldName
          ? `<span class="item">${e.heldName}</span>`
          : `<span class="item empty">빈손</span>`) +
        `</div><span class="pts">${e.score}<small>점</small></span>`;
      this.hudEl.appendChild(chip);
    }
  }

  // ── 심사 ──
  showJudgePanel(topicText: string) {
    this.judgeEl.classList.remove('hidden');
    // 초상이 있으면 그것만, 없으면 글자만 — "AI"를 아이콘과 제목에 두 번 쓰지 않는다
    const avatar = this.judgeArtUrl
      ? `<img class="judge-avatar" src="${this.judgeArtUrl}" alt="" />` : '';
    this.judgeEl.innerHTML =
      `<h2>${avatar}AI 심사위원의 판정</h2>` +
      `<div class="topic-small">${topicText}</div>`;
    this.judgeList = this.el('div', '', this.judgeEl);
    this.judgeList.style.display = 'flex';
    this.judgeList.style.flexDirection = 'column';
    this.judgeList.style.gap = '10px';
  }

  addVerdict(name: string, color: number, itemName: string | null, score: number, comment: string) {
    const v = document.createElement('div');
    v.className = 'verdict' + (score >= 70 ? ' hi' : score < 40 ? ' lo' : '');
    v.style.borderLeftColor = colorHex(color);
    v.innerHTML =
      `<div class="body">` +
      `<div class="who" style="color:${colorHex(color)}">${name}</div>` +
      `<div class="head">${itemName ?? '빈손'}</div>` +
      `<div class="comment">${comment}</div></div>` +
      `<div class="score">${score}</div>`;
    this.judgeList.appendChild(v);
    requestAnimationFrame(() => requestAnimationFrame(() => v.classList.add('shown')));
  }

  hideJudgePanel() {
    this.judgeEl.classList.add('hidden');
  }

  // ── 결과 ──
  showResults(rows: { name: string; color: number; score: number }[]) {
    this.resultsEl.classList.remove('hidden');
    this.resultsInner.innerHTML = '';
    this.winStage?.dispose();
    this.winStage = null;

    const winner = rows[0];
    this.el('div', 'win-label', this.resultsInner, 'WINNER');

    // 우승자는 정지 이미지가 아니라 실제로 춤춘다 — 세레모니 클립을 그 자리에서 재생
    const stage = this.el('div', 'win-stage', this.resultsInner);
    const live = this.stageFactory?.(winner.color, 'win') ?? null;
    if (live) {
      this.winStage = live;
      live.mount(stage);
    } else {
      // GLB가 없을 때 — 전신 정지 이미지로 폴백
      const url = this.portraitsFull.get(winner.color);
      if (url) {
        stage.style.backgroundImage = `url('${url}')`;
        stage.style.backgroundSize = 'contain';
        stage.style.backgroundRepeat = 'no-repeat';
        stage.style.backgroundPosition = 'center bottom';
      }
    }

    this.el('div', 'win-name headline', this.resultsInner, winner.name)
      .style.color = colorHex(winner.color);
    this.el('div', 'win-score', this.resultsInner, `${winner.score}점`);

    if (rows.length > 1) {
      const row = this.el('div', 'rank-row', this.resultsInner);
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        // 등수 숫자는 붙이지 않는다 — 왼쪽부터 점수 순이라 순서가 곧 등수고,
        // 숫자를 두 개 늘어놓으면 어느 쪽이 점수인지 헷갈린다
        this.el('div', 'rank-item', row,
          avatarHtml(r.color, true, this.portraits.get(r.color) ?? null) +
          `<span style="color:${colorHex(r.color)}">${r.name}</span>` +
          `<span class="sc">${r.score}점</span>`);
      }
    }

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
