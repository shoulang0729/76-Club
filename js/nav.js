/* ============================ TAB NAV ============================ */
const views = { home:'view-home', game:'view-game', course:'view-course', players:'view-players', score:'view-score', result:'view-result' };
let activeTab='home';   // 起動時はトップ（§11.12 B）。init.js で golfCompe_seenTop を見て上書き
let revealHoles=18;            // 個人戦で開封済みのホール数(0-18)。18=全開（既定）
let rl={ spinning:false, spinTeams:[], timer:null, challengeFrom:null };  // ルーレットの実行時状態（非保存）
function rlStopTimer(){ if(rl.timer){clearInterval(rl.timer);rl.timer=null;} rl.spinning=false; }
// 発表用の表示/非表示スイッチ（true=表示）。totals=スコア表の合計欄（個人/チーム共通・チーム小計の色も含む）
let show={ totals:true };
function toggleShow(k){ show[k]=!show[k]; renderResult(); }
// グロス/ネットの名前・スコアの表示制御（表ごと master ＋順位ごと個別ボタン）。mode XOR except
let nsMode={ gross:'show', net:'show' };
let nsExcept={ gross:new Set(), net:new Set() };
function nsMasked(table,pid){ return (nsMode[table]==='hide') !== nsExcept[table].has(pid); }
function toggleNSAll(table){ nsMode[table]= nsMode[table]==='show'?'hide':'show'; nsExcept[table].clear(); renderResult(); }
function toggleNSRow(table,pid){ const s=nsExcept[table]; if(s.has(pid))s.delete(pid); else s.add(pid); renderResult(); }
// チーム対抗の各ゲーム：ゲームごと master ＋チームごと個別ボタン。チーム名＋合計をまとめて表示/非表示
let tgMode={ teamGross:'show', teamNet:'show', best2ball:'show', holeByHole:'show', vegas:'show' };
let tgExcept={ teamGross:new Set(), teamNet:new Set(), best2ball:new Set(), holeByHole:new Set(), vegas:new Set() };
function tgMasked(key,tid){ return (tgMode[key]==='hide') !== tgExcept[key].has(tid); }
function toggleTgAll(key){ tgMode[key]= tgMode[key]==='show'?'hide':'show'; tgExcept[key].clear(); renderResult(); }
function toggleTgRow(key,tid){ const s=tgExcept[key]; if(s.has(tid))s.delete(tid); else s.add(tid); renderResult(); }
let resultSub='ind';   // 'pts' | 'ind' | 'prize' | 'team'
/* スコア表の並べ替え指標（§11.12 I）。表示状態のみ＝計算には介入しない。既定はどちらもネット。
   個人=グロス/ネットの2択、チーム=グロス/ネット/ホールバイホールの3択。 */
let scSortInd='net';    // 'gross' | 'net'
let scSortTeam='net';   // 'gross' | 'net' | 'hbh'
function setScSortInd(v){ scSortInd=v; renderResult(); }
function setScSortTeam(v){ scSortTeam=v; renderResult(); }
/* α/β チャネル（§11.12 C）: 表示状態のみ。golfCompe_channel に永続化（golfCompe_v1 とは分離＝データ非干渉）。
   α='a'（検証済みの安定版・既定） / β='b'（テスト中の新機能）。βゲームは β でだけ選択・集計・表示する。 */
const CHANNELS=['a','b'];
const BETA_FMT=['stableford','olympic','callaway','nassau','best2ball','vegas','match1v1'];   // β版のゲーム（残りは全てα）
let CHANNEL = CHANNELS.includes(localStorage.getItem('golfCompe_channel')) ? localStorage.getItem('golfCompe_channel') : 'a';
function setChannel(c){ if(!CHANNELS.includes(c))return; CHANNEL=c; localStorage.setItem('golfCompe_channel',c); render(); }
function toggleChannel(){ setChannel(CHANNEL==='a'?'b':'a'); toast(t('ch.switched',{v:t('ch.'+CHANNEL)})); }
/* 現チャネルで有効なフォーマット。αではβゲームを一律 false（＝集計・表示しない）。g.formats 自体は書き換えない＝データは保持 */
function chFormats(g){ const F=Object.assign({}, g.formats||{});
  if(CHANNEL!=='b') BETA_FMT.forEach(k=>{ F[k]=false; });
  return F; }
const isBetaFmt=k=>BETA_FMT.includes(k);
/* §11.12 D: 狭幅（<1024px＝スマホ/小型タブレット）はホール表を OUT(1-9)/IN(10-18) の2段に折り返す。
   iPad Pro 13"縦(1024pt)以上とPCは従来どおり18列1段。
   段が変わったら該当タブ（スコア入力／コースの Par・隠しH 表）だけ描き直す（入力中の値は保存済みなので再描画で失われない）。 */
const SC_NARROW_MQ = window.matchMedia('(max-width:1023px)');
function scNarrow(){ return SC_NARROW_MQ.matches; }
SC_NARROW_MQ.addEventListener('change', ()=>{ if(activeTab==='score'||activeTab==='course') render(); });
const tabLabel=k=>t('tab.'+k);
/* ドロワー開閉（2026-08-20-home-drawer.md §3）。開閉状態は style.display のみ＝揮発（§11.14 原則4・localStorage 非接触） */
function drawerToggle(force){ const d=document.getElementById('appDrawer'), o=document.getElementById('drawerOverlay');
  const open = (force!==undefined)? force : (d.style.display!=='block');
  d.style.display=open?'block':'none'; o.style.display=open?'block':'none'; }
const WORK_TABS=['game','course','players','score'];   // ドロワー項目＝幹事の作業画面
function go(tab){ rlStopTimer(); drawerToggle(false); activeTab=tab; render(); }
function render(){
  Object.entries(views).forEach(([k,id])=> document.getElementById(id).style.display = k===activeTab?'':'none');
  const g=curGame();
  document.getElementById('hdrGame').textContent = g? `${g.name}　${g.date}${g.course?'　@'+g.course:''}` : t('hdr.noGame');
  const nc=document.getElementById('navCur'), isWork=WORK_TABS.includes(activeTab);
  nc.style.display=isWork?'':'none'; nc.dataset.tab=isWork?activeTab:''; if(isWork) nc.textContent=t('nav.'+activeTab);
  document.querySelectorAll('#mainNav button,#appDrawer button').forEach(b=>b.classList.toggle('on', b.dataset.tab===activeTab));
  const cb=document.getElementById('chBadge'); if(cb){ cb.textContent=t('ch.'+CHANNEL); cb.classList.toggle('beta', CHANNEL==='b'); }
  if(activeTab==='home') renderHome();
  if(activeTab==='game') renderGame();
  if(activeTab==='course') renderCourse();
  if(activeTab==='players') renderPlayers();
  if(activeTab==='score') renderScore();
  if(activeTab==='result') renderResult();
}
function esc(s){ return (s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
const everyLabel=k=> k==='none'?t('every.s.none'):k==='every1'?'E1(−18)':'E2(−36)';
// 最小の線アイコン（目のオン/オフ）と丸数字の順位バッジ
const EYE='<svg class="ei" viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYEOFF='<svg class="ei" viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 10.6a3 3 0 004.2 4.2M9.9 5.2A9.7 9.7 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.2 3.9M6.1 6.1A17 17 0 002 12s3.5 7 10 7a9.7 9.7 0 003.2-.5"/></svg>';
const posBadge=(rank,first)=>`<span class="rankno${first?' r1':''}">${rank}</span>`;
/* チーム名から識別色を引く（値はトークン＝ライト/ダークで自動反転 §11.8）。塗りに使う場合の文字色は var(--bg) */
function tmColor(name){ return /レッド|赤/.test(name)?'var(--tm-red)':/ブルー|青/.test(name)?'var(--tm-blue)'
  :/グリーン|緑/.test(name)?'var(--tm-green)':/イエロー|黄/.test(name)?'var(--tm-yellow)':'var(--tm-gray)'; }

