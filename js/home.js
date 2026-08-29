/* ============================ HOME（トップ画面・§11.12 B） ============================ */
/* 起動時に表示する使い方ガイド＋リンクメニュー＋α/β解説。表示状態のみで計算・データには介入しない。
   「次回から表示しない」は golfCompe_seenTop に永続化（golfCompe_v1 とは分離）。ホームタブからいつでも再表示。 */
function seenTop(){ return localStorage.getItem('golfCompe_seenTop')==='1'; }
function setSeenTop(v){ localStorage.setItem('golfCompe_seenTop', v?'1':'0'); }

// 各版で遊べるゲーム名の一覧（i18n の fmt.* をそのまま使う＝辞書の二重管理を避ける）
const ALPHA_GAMES=['fmt.net','fmt.gross','fmt.teamGross','fmt.teamNet','fmt.hbh','term.roulette','term.niapin','term.dracon'];
const BETA_GAMES =['fmt.stableford','fmt.olympic','fmt.callaway','fmt.nassau','fmt.best2','fmt.vegas'];

// 概要サブタブ（2026-08-20-home-subtabs.md §4）: 1カラム全幅。ガイド→α/β解説→α/βカード50:50→skip
function renderHome(){
  const el=document.getElementById('view-home');
  const chCard=(c)=>{
    const on = CHANNEL===c;
    const games=(c==='a'?ALPHA_GAMES:BETA_GAMES).map(k=>`<span class="pill">${t(k)}</span>`).join(' ');
    return `<div class="card chcard ${c==='b'?'beta':''} ${on?'on':''}">
      <h2>${t('ch.'+c)} ${on?`<span class="tag tagtie">${t('ch.current')}</span>`:''}</h2>
      <div class="muted">${t('ch.'+c+'.desc')}</div>
      <div class="mt8">${games}</div>
      <div class="mt10"><button class="btn ${on?'gray':''} wide" ${on?'disabled':''} onclick="setChannel('${c}')">${t('ch.enter',{v:t('ch.'+c)})}</button></div>
    </div>`; };

  el.innerHTML = `
    <div class="card hometop">
      <h2>${t('home.title')}</h2>
      <div class="muted">${t('home.lead')}</div>
      <ol class="homesteps">
        <li>${t('home.step1')}</li><li>${t('home.step2')}</li><li>${t('home.step3')}</li><li>${t('home.step4')}</li>
      </ol>
    </div>
    <div class="card"><h2>${t('ch.title')}</h2>
      <div class="rule">${t('ch.note')}</div>
      <div class="muted mt6">${t('ch.common')}</div>
    </div>
    <div class="chwrap">${chCard('a')}${chCard('b')}</div>
    <label class="tgl seentop"><input type="checkbox" ${seenTop()?'checked':''} onchange="setSeenTop(this.checked)"> ${t('home.skip')}</label>`;
}
