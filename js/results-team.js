/* ============================ RESULTS: チーム戦（js/results.js から分割・挙動不変） ============================ */
/* チーム戦グループ（§5.2）: key ごとに 当該対抗カード（上）＋チーム別スコア表（下・グロス/ネット/HBH のみ）。
   'm1'/'roulette' は renderResult 側で renderMatch1v1Parts / renderRouletteParts を直接使う（sticky 同居 D15・roulette-standings §5）。
   総合=①チーム総合カード＋②種目別勝ち点表の2つのみ（スコア表なし・winpoints-reveal 要件A）、nd=ニアドラ・ヒーローカード（team-points §6.2①③・配置=regroup §6） */
function renderTeamGame(g, g0, parts, key){
  const teams=g.teams.filter(t=>t.memberIds.length);
  if(!teams.length)
    return `<div class="card"><h2>${t('team.title')}</h2><div class="empty">${t('team.emptyTeams')}</div></div>`;
  const sc=()=>renderScorecard(g, g.participants, teams);
  /* 総合は g0（生ゲーム・viewGame マスクを通さない）を渡す（2026-08-30 バッチ98 バグ修正）:
     #97 で revealHoles 既定が 0 になり、リロード直後はマスク済み g の entered 判定が全滅→ events=[] → 総合が必ず空
     （総合タブに開封バーは無く復旧不能）だった。勝ち点・種目別勝ち点表は announced（連携）ゲートで既に守られている
     ＝未連携行は？マスクのままなのでネタバレなし。他タブ（gross/net/hbh 等）の viewGame マスクは意図どおり不変 */
  if(key==='overall') return renderTeamOverall(g0);
  /* 大学対抗は g（viewGame マスク後）＋スコア表併設（univ-match §14.1・PR#3 でユーザー確定）:
     g0 にしていた唯一の根拠は「開封バーが無く revealHoles=0 の空から復旧できない」ことだったが、
     本PRで sc()（開封バー・合計値トグル）を併設したため復旧経路ができ、'net'/'hbh' と同型に戻した。
     結果、ヒーロー・タイブレーク表が開封済みホールまでで再計算される＝段階開封（§14.2）。
     スコア表には足切り情報（uvScSel）を渡す＝対象外はグレーアウト・対象者は「対象」併記（PR#3 指示⑤。他タブは引数なし＝不変）*/
  if(key==='univ')  return renderTeamUniv(g) + renderScorecard(g, g.participants, teams, uvScSel(g)) + ruleBox('rule.univ');   // ルール解説は最下部（2026-08-30 指示）
  if(key==='nd')    return renderTeamNiadora(g);
  if(key==='gross') return `<div class="rank-wrap">${renderTeams(g,'teamGross')}</div>` + sc();
  if(key==='net')   return `<div class="rank-wrap">${renderTeams(g,'teamNet')}</div>` + sc();
  if(key==='hbh')   return `<div class="rank-wrap">${renderTeams(g,'holeByHole')}</div>` + sc();
  if(key==='b2')    return `<div class="rank-wrap">${renderTeams(g,'best2ball')}</div>`;
  if(key==='vegas') return `<div class="rank-wrap">${renderTeams(g,'vegas')}</div>` + ruleBox('rule.vegas');
  /* 任意対決は g0（生ゲーム）を渡す（custom-match §6.1）: 総合タブと同じ理由＝本タブに開封バーが無く、
     revealHoles=0 のリロード直後に viewGame マスク後の g を渡すと teamWinPoints の対象チームが全滅し勝敗タグが復旧不能に消える。
     値はスコア非依存なのでマスクを通す意味もない。ネタバレ保護は announced.customMatch ゲートで担保 */
  if(key==='custom') return renderTeamCustom(g0) + ruleBox('rule.custom');
  return '';
}

/* ---- 連携ボタン（winpoints-reveal §5.2＋追補§11.2・D1/D8・投影原則 §11.14「幹事操作は控えめ配置」）----
   g.announced はデータ（幹事の運営記録）＝save() で golfCompe_v1 に保存（開封・めくり演出の揮発状態とは別物）。
   ボタンは常時活性・不成立種目の連携フラグは休眠（算入は 成立∧on の AND・D9）。取り消しは可逆・confirm なし（D8）。
   配置は各カード内の右寄せ（§11.2）＝flex 親の中で margin-left:auto。flush=true は右寄せ済み要素の直後に置く場合（ルーレット head） */
function tpAnnounce(key,on){ const g=curGame(); if(!g)return;
  (g.announced=g.announced||{})[key]=!!on; save(); renderResult(); }
function tpAnnounceUI(g,key,flush){ const on=!!(g.announced||{})[key];
  const inner = on
    ? `<span class="tag" style="background:var(--win);color:var(--on-fill)">${t('team.announced')}</span><button class="btn gray sm" onclick="tpAnnounce('${key}',false)">${t('team.unannounce')}</button>`
    : `<button class="btn gold sm" onclick="tpAnnounce('${key}',true)">${t('team.announce')}</button>`;
  return `<span style="display:inline-flex;gap:6px;align-items:center${flush?'':';margin-left:auto'}">${inner}</span>`; }

/* ---- チーム総合カード＋種目別勝ち点表（team-points.md §6.2①・winpoints-reveal §5.1・投影原則 §11.14）----
   総合順位・勝ち点は calc.js の teamWinPoints(g) だけを正とする（表示側で再計算しない）。
   総合順位はヒーロー型の左右均等横並び（.tp-nd 縦積みブロック共用・2026-08-30 #87 指示④）。
   大型勝ち点=チームカラー・勝ちセル=緑（値併記）＝モック承認済み。
   目隠し（'overall' 系 tgMasked）は廃止＝発表状態連動マスク（未確定行の？）が代替（winpoints-reveal 要件A/D6）。
   ヘッダは発表進捗タグ「発表 n/N」（全発表で「確定」緑・D5）。順位バッジ・配分タグは発表≥1 のときのみ＝computePoints のゲートと一致 */
function tpFmtWin(v){   // 勝ち点合計の表示（1→"1"・0.5刻み→"2.5"・1/3混じり→小数2桁）
  if(Math.abs(v-Math.round(v))<1e-9) return String(Math.round(v));
  if(Math.abs(v*2-Math.round(v*2))<1e-9) return v.toFixed(1);
  return String(Math.round(v*100)/100);
}
/* 種目セルの獲得分＝w/同点チーム数（winpoints-reveal §13.5・weight 一般化）。
   整数はそのまま・0.5刻みは小数1桁・それ以外は分数表記（w=1 は従来の '1'/'0.5'/'1/3' と完全一致） */
function tpShare(w,n){ const v=w/n;
  if(Number.isInteger(v)) return String(v);
  if(Number.isInteger(v*2)) return v.toFixed(1);
  return w+'/'+n; }
/* 種目別勝ち点の重み設定（winpoints-reveal §13.5・D20）: 0以上の整数にクランプ（既存 setPointsNum 慣例＋非負）。
   グローバル関数（inline onchange 前提・ESM化しない）。golfCompe_v1 に保存 */
function setTeamEventPts(key,v){ const g=curGame(); if(!g)return;
  (g.points.teamEventPts=g.points.teamEventPts||{})[key]=Math.max(0,parseInt(v)||0);
  save(); renderResult(); }
/* 種目別勝ち点の配点設定 details の開閉（手動トグルのみ・重み入力の再描画で閉じない）。
   pzCfgOpen と同方式＝揮発の表示状態・localStorage に保存しない（既定=閉・リロードで閉に戻る） */
let tpEvPtsOpen=false;
function tpEvPtsToggle(open){ tpEvPtsOpen=open; }
const TP_EV_LABEL={teamGross:'term.teamGross',teamNet:'term.teamNet',univMatch:'term.univ',holeByHole:'term.hbh',best2ball:'term.best2',
  roulette:'term.roulette',match1v1:'term.match1v1',vegas:'term.vegas',niadora:'term.niadora',customMatch:'term.custom'};
/* 種目ラベル（任意対決だけユーザー入力名を優先・§11.21）。名前が空なら i18n 既定（term.custom）にフォールバック。
   ユーザー入力は esc() 必須（辞書文字列と違い HTML が混ざり得る） */
function tpEvLabel(g,key){ const nm=(key==='customMatch')?(((g&&g.custom&&g.custom.name)||'').trim()):'';
  return nm? esc(nm) : t(TP_EV_LABEL[key]||key); }
/* 種目別勝ち点表の行順（#87 指示③）＝チーム戦下段タブの生成順（resGameTabs grp='team'・総合を除く）:
   nd→gross→net→univ→hbh→b2→vegas→m1→roulette。タブ生成順を変えるときは本配列も同期させる */
const TP_EV_ORDER=['niadora','teamGross','teamNet','univMatch','holeByHole','best2ball','vegas','match1v1','roulette','customMatch'];
function renderTeamOverall(g){
  const {teams,wins,events}=teamWinPoints(g);
  if(!events.length) return '';   // 成立種目0＝総合カード非表示（配分もされない・§3.4）
  const P=g.points||{};
  const N=events.length, n=events.filter(e=>e.on).length;   // 発表進捗（winpoints-reveal D5）。n=N(≥1)で「確定」
  const prog = n===N ? `<span class="tag" style="background:var(--win);color:var(--on-fill)">${t('status.fixed')}</span>`
                     : `<span class="tag tagtie">${t('team.annProg',{n,N})}</span>`;
  const rows=teams.map((tm,i)=>({tm,i,v:wins[i]})); rows.sort((a,b)=>b.v-a.v);
  let rank=0,prev=null;
  rows.forEach((r,idx)=>{ if(prev===null||r.v!==prev){rank=idx+1;prev=r.v;} r.rank=rank; r.p=(P.teamRankPts||[])[rank-1]||0; });
  // ヒーロー横並び（#87 指示④）: 順=勝ち点降順。勝ち点=確定(on)分のみの積み上げ（teamWinPoints が正）。
  // 順位バッジ＋配分タグは発表≥1 のときのみ（n=0 はチーム名と「0」だけ＝computePoints の配分ゲートと一致・D5）
  const hero=rows.map(r=>{ const col=tmColor(r.tm.name);
    return `<span class="rl-st tp-nd tp-ovh">
      <span class="rl-st-team" style="color:${col}">${esc(r.tm.name)}</span>
      <span class="tp-ov-pt" style="color:${col}">${tpFmtWin(r.v)}</span>
      ${n>=1?`<span class="tp-nd-tagrow">${posBadge(r.rank,r.rank===1)}<span class="tag">${t('team.rankTag',{rank:r.rank,p:r.p})}</span></span>`:''}
    </span>`; }).join('');   // 配分は各員満額（人数割りしない・D4）
  // 種目別勝ち点表（補助・通常サイズ）: 行=成立種目・列=チーム。勝ち=緑＋値・山分け=橙＋獲得分・負け=空欄・対象外=—。
  // 未確定(!on)行=ラベルに「未確定」タグ＋値セルは対象外含め全チーム？マスク（勝者ネタバレ防止・D6）
  // 行順=チーム戦の下段ゲームタブ（resGameTabs 左→右・総合を除く）に一致（2026-08-30 ユーザー指示・#87）。
  // 表示順のみの並べ替え＝teamWinPoints の値・成立判定は不変。タブに無いキーは末尾（安定ソートで元順維持）
  const mxEvs=[...events].sort((a,b)=>{ const o=k=>{ const i=TP_EV_ORDER.indexOf(k); return i<0?TP_EV_ORDER.length:i; }; return o(a.key)-o(b.key); });
  const mxHead=`<tr><th class="tal">${t('team.matrixTitle')}</th>${teams.map(tm=>
    `<th style="color:${tmColor(tm.name)}">${esc(tm.name)}</th>`).join('')}</tr>`;
  const mxRows=mxEvs.map(ev=>`<tr><td class="tal">${tpEvLabel(g,ev.key)}${ev.w!==1?` <span class="muted">×${ev.w}</span>`:''}${ev.on?'':` <span class="tag tagtie">${t('team.pending')}</span>`}</td>${teams.map((tm,i)=>{
    if(!ev.on) return '<td><span class="mask">？</span></td>';
    if(ev.vals[i]==null) return '<td><span class="muted">—</span></td>';
    if(ev.winners.includes(i)) return `<td class="${ev.winners.length>1?'rtie':'winc'}"><b>${tpShare(ev.w,ev.winners.length)}</b></td>`;
    return '<td></td>'; }).join('')}</tr>`).join('');
  // 重み設定 details（winpoints-reveal §13.5・D14/D15・投影原則 §11.14「幹事操作は控えめ配置」）:
  // 採用中の種目のみ TP_EV_ORDER 順（niadora は F.niadoraTeam・βはαチャネルで自動除外）。成立前でも事前設定可。
  // ゲーム設定タブには置かない（teamRankPts と同居させず重複配置回避）。
  // 開閉は手動トグルのみ＝tpEvPtsOpen（揮発）で再描画をまたいで維持（pzCfgOpen と同方式・重み入力の再描画で閉じない）
  const F=chFormats(g), W=P.teamEventPts||{};
  const evPtsRows=TP_EV_ORDER.filter(k=> k==='niadora'?F.niadoraTeam:F[k]).map(k=>
    `<div class="ptsrow"><span>${tpEvLabel(g,k)}</span><span class="ptsedit"><input type="number" min="0" step="1" value="${W[k]===undefined?1:W[k]}" onchange="setTeamEventPts('${k}',this.value)"></span></div>`).join('');
  const evPts=evPtsRows?`<details class="mt10"${tpEvPtsOpen?' open':''} ontoggle="tpEvPtsToggle(this.open)"><summary>${t('team.evPtsTitle')}</summary><div class="in">
      <div class="muted">${t('team.evPtsNote')}</div>${evPtsRows}</div></details>`:'';
  return `<div class="card"><h2 class="lbh"><span>${t('team.overallTitle')} ${prog}</span></h2>
    <div class="rl-standing tp-ovh-wrap">${hero}</div>
    <div class="scroll mt10"><table class="lb tp-mx">${mxHead}${mxRows}</table></div>
    <div class="muted mt6">${t('team.noteOverall')}</div>
    <div class="muted">${t('team.noteAnnounce')}</div>
    <div class="muted">${t('pts.teamRank')}: ${(P.teamRankPts||[]).join(', ')}</div>
    ${evPts}
  </div>`;
}

/* ---- チーム戦ニアドラ・ヒーローカード（team-points.md §6.2③）----
   .rl-standing/.rl-st 共用＋縦積みバリアント .tp-nd。本数=開封済みホールのみの表示側カウント（全開封で niadoraTeamCount と一致＝calc と同値保証）・本数降順（同数=登録順の安定ソート）。
   勝ち点タグ=文字併記（勝者に緑 +1・同数に橙 +0.5/+1/3）＝総合タブの種目別勝ち点表セルと同じ値。
   ヒーローは常時表示＝目隠しなし（#87 指示⑨で master トグル撤去・総合カード④と同じ扱い）。
   下部にホール別勝者カード群を併設（renderPrizeHero(g,true)＝チーム名併記・#87 指示⑤）。伏せ状態は個人戦ニアドラと共有＝開封演出はこちら側で行う。
   勝者登録パネル（prize-edit details）は最下部にも配置（2026-08-30 指示②で #87⑤「個人戦のみ」を上書き）:
   formats.niadoraInd OFF で個人戦ニアドラタブが消えても登録場所を確保。個人戦側と同一パネル（renderPrizes 流用＝同じ g.prizes を読み書き・
   どちらで登録しても両方に反映）。開閉状態 pzCfgOpen も個人戦側と共有（手動トグルのみ・再描画で維持・localStorage 非保存） */
function renderTeamNiadora(g){
  const teams=g.teams.filter(t=>t.memberIds.length);
  const {teams:wt,events}=teamWinPoints(g);
  const ev=events.find(e=>e.key==='niadora');
  const winIds=ev?ev.winners.map(i=>wt[i].id):[];
  /* 2026-08-30 指示④: ヒーローの本数・NP/DC内訳は下部ホール別カードの「開封済み」ホールのみカウント（表示側フィルタ・
     開封状態=pzMode/pzExcept は個人戦と共有の揮発）。全ホール開封時は niadoraTeamCount(g,tm) と一致（計算側は不変）。
     勝ち点タグは全開封時のみ表示＝部分開封中のネタバレ防止（teamWinPoints・種目別勝ち点表は不変） */
  const opened=h=>!pzMasked(h);
  const npOf=T=>niapinHolesOf(g).filter(h=>{const pid=(g.prizes.niapinWinner||{})[h];return !!pid&&T.memberIds.includes(pid)&&opened(h);}).length;
  const dcOf=T=>draconHolesOf(g).filter(h=>{const pid=(g.prizes.draconWinner||{})[h];return !!pid&&T.memberIds.includes(pid)&&opened(h);}).length;
  const allOpen=[...niapinHolesOf(g).filter(h=>(g.prizes.niapinWinner||{})[h]),
                 ...draconHolesOf(g).filter(h=>(g.prizes.draconWinner||{})[h])].every(opened);
  const rows=teams.map(tm=>{const np=npOf(tm),dc=dcOf(tm);return {tm,n:np+dc,np,dc};}).sort((a,b)=>b.n-a.n);   // 並び=現表示値の降順
  const blocks=rows.map(({tm,n,np,dc})=>{
    const col=tmColor(tm.name);
    const sub=`NP ${np} ・ DC ${dc}`;   // NP/DC はリテラル略号（言語非依存）
    const tag=(ev&&ev.on&&allOpen&&winIds.includes(tm.id))   // 勝ち点タグは「発表済み(on)かつ全開封」でのみ表示（winpoints-reveal §5.2＝マスクと整合）
      ?`<span class="tp-nd-tagrow"><span class="tag ${ev.winners.length>1?'tagtie':'tagwin'}">${t('team.winpt')} +${tpShare(ev.w,ev.winners.length)}</span></span>`:'';
    return `<span class="rl-st tp-nd"><span class="rl-st-team" style="color:${col}">${esc(tm.name)}</span><span class="rl-st-h">${n}</span><span class="tp-nd-sub">${sub}</span>${tag}</span>`; }).join('');
  const hasHoles=niapinHolesOf(g).length||draconHolesOf(g).length;
  const holeCards=hasHoles? renderPrizeHero(g,true) : '';   // 対象ホールなしは併設カード・登録パネルとも省略
  const editPanel=hasHoles? `<details class="prize-edit mt10"${pzCfgOpen?' open':''} ontoggle="pzCfgToggle(this.open)"><summary>${t('prize.recTitle')}</summary><div class="in">${renderPrizes(g)}</div></details>` : '';
  return `<div class="card"><h2 class="lbh"><span>${t('term.niadora')}</span></h2>
    <div class="rl-standing">${blocks}</div>
    <div class="muted mt6">${t('team.noteNiadora')}</div>
    <div class="cardtools mt8">${tpAnnounceUI(g,'niadora')}</div></div>` + holeCards + editPanel;
}

/* ---- 大学対抗タブ（univMatch・docs/handoff/2026-08-30-univ-match.md §6.2・投影原則 §11.14・モック承認 2026-08-30）----
   計算・表示は g 基準＝viewGame マスク後（§14.1/§14.2・renderTeamGame 側コメント）。値の正は calc.js の uvStanding/teamWinPoints（表示側で再計算しない）。
   ①学校ヒーロー（.rl-st.tp-nd 共用・r4 順位順で1位が左・校名=チームカラー --f-rl-name・平均ネット=--f-rl-score）
   ②タイブレーク明細表（4段・①〜④を常に数値表示＝§14.3・決着した段の1位セルのみ winc 緑）
   ③学校別メンバー表は PR#3 指示④で廃止（併設スコア表と重複）。対象/対象外の区別は
     スコア表側で表現する（uvScSel→renderScorecard・対象外グレーアウト＋「対象」文字併記＝色のみに依存しない）。
   順位バッジ・勝ち点タグは連携（announced.univMatch）後のみ。表示は平均系 toFixed(2)。
   大学対抗固有の進行状態は持たない（揮発変数も localStorage 保存もなし・§6.2） */
function renderTeamUniv(g){
  const uv=uvStanding(g);
  const ann=!!(g.announced||{}).univMatch;
  const evTag=(g.univ&&g.univ.every)?`<span class="tag uv-tagev">${t('univ.everyOn')}</span>`:'';   // ON時のみ（OFF=規定準拠が無印・§7）
  const head=`<h2>${t('term.univ')}${evTag}${tpAnnounceUI(g,'univMatch')}</h2>`;
  if(!uv.rows.length)   // 対象校0（スコア未入力等）＝集計ルールを案内（チームなしは renderTeamGame 冒頭の team.emptyTeams）
    return `<div class="card">${head}<div class="empty">${t('univ.note')}</div></div>`;
  const {teams:wt,events}=teamWinPoints(g);
  const ev=events.find(e=>e.key==='univMatch');
  const winIds=ev?ev.winners.map(i=>wt[i].id):[];
  const f2=v=>v.toFixed(2);
  // 決着段（§4.3 辞書式・§6.2「決着した段を緑」）: 1位と同値の集合を段ごとに絞り、1校に定まった段=決着。
  // 4段すべて同値の同率1位が残る場合は決着なし（dstage=-1・全段表示＝勝ち点は山分け）
  let cont=uv.rows, dstage=-1;
  for(let i=0;i<4;i++){ const nxt=cont.filter(r=>r.r4[i]===cont[0].r4[i]); if(nxt.length===1){ dstage=i; break; } cont=nxt; }
  const hero=uv.rows.map(r=>{ const col=tmColor(r.t.name);
    const tag=(ann&&ev&&winIds.includes(r.t.id))
      ?`<span class="tag ${ev.winners.length>1?'tagtie':'tagwin'}">${t('team.winpt')} +${tpShare(ev.w,ev.winners.length)}</span>`:'';
    return `<span class="rl-st tp-nd tp-ovh">
      <span class="rl-st-team" style="color:${col}">${esc(r.t.name)}</span>
      <span class="rl-st-h">${f2(r.r4[0])}</span>
      <span class="tp-nd-sub">${t('univ.selOf',{n:r.N,p:r.P})} ・ G ${f2(r.r4[1])}</span>
      ${ann?`<span class="tp-nd-tagrow">${posBadge(r.rank,r.rank===1)}${tag}</span>`:''}
    </span>`; }).join('');
  // タイブレーク明細表（通常サイズ .lb・列=校は r4 順位順）。G は言語非依存のリテラル略号（NP/DC と同じ扱い）
  // ③④（全員平均）は 2026-08-30 指示で表示から削除（判定＝dstage の算出には引き続き r4 の4段すべてを使う）
  const tbLabels=['univ.avgNetSel','univ.avgGrossSel'];
  const tbHead=`<tr><th class="tal"></th>${uv.rows.map(r=>`<th style="color:${tmColor(r.t.name)}">${esc(r.t.name)}</th>`).join('')}</tr>`;
  // §14.7: 表示は①②のみ（③④は非表示）。決着段が①②のときだけ1位セルを winc 緑にする
  const tbRows=tbLabels.map((k,i)=>{
    const cells=uv.rows.map(r=>`<td${(i===dstage&&r.rank===1)?' class="winc"':''}>${f2(r.r4[i])}</td>`).join('');
    return `<tr><td class="tal">${'①②③④'[i]} ${t(k)}</td>${cells}</tr>`; }).join('');
  const card1=`<div class="card">${head}
    <div class="rl-standing tp-ovh-wrap">${hero}</div>
    <div class="scroll mt10"><table class="lb uv-tb">${tbHead}${tbRows}</table></div>
    </div>`;   // 注記2行（univ.note/calcNote）は 2026-08-30 指示で削除＝ルール解説（最下部 ruleBox）に集約
  return card1;   // メンバー表カードは PR#3 指示④で廃止（併設スコア表と重複）。ルール解説は最下部（renderTeamGame でスコア表の後ろに付与）
}

/* 併設スコア表に渡す足切り情報（PR#3 指示⑤）: uvStanding の各校 sel（対象pid）を集合化し、
   チームごとの 対象n/参加P も添える。呼ぶたびに uvStanding を引き直す＝開封に応じて対象者が入れ替わる（§14.2 と整合）。
   対象校0（未開封など）は null＝スコア表は現行どおり（グレーアウトなし）。renderScorecard の第4引数は省略可＝他タブ不変 */
function uvScSel(g){ const uv=uvStanding(g); if(!uv.rows.length) return null;
  const sel=new Set(), team={};
  uv.rows.forEach(r=>{ r.sel.forEach(pid=>sel.add(pid)); team[r.t.id]={n:r.N,p:r.P}; });
  return {sel,team}; }


/* ---- 任意対決タブ（customMatch・docs/handoff/2026-08-31-custom-match.md §6.2・投影原則 §11.14・モック承認 2026-08-31）----
   スコアから一切計算しない「幹事入力ポイント」だけで勝敗が決まるチーム種目（§11.21）。
   大型ヒーローが主役・幹事の入力UIは最下部の <details>（既定=閉）。既存クラスのみ＝新規CSSなし。
   引数は g0（生ゲーム）＝renderTeamGame 側のコメント参照（マスク後の g を渡すとリロード直後にタグが消える）。
   勝敗タグ・順位バッジの正は teamWinPoints(g).events の customMatch（表示側で勝者を再計算しない＝univ/ニアドラと同じ規律）。
   タグは announced.customMatch（ev.on）のときだけ＝未連携はネタバレ防止（総合タブの？マスクと整合）。
   色のみに依存しない（緑タグ＝「勝ち」・橙タグ＝「引分」の文字併記・勝ち点は数値併記）。 */
let cmCfgOpen=false;   // 入力パネルの開閉（pzCfgOpen / tpEvPtsOpen と同方式＝揮発の表示状態・localStorage に保存しない）
function cmCfgToggle(open){ cmCfgOpen=open; }
/* セッター（グローバル関数・inline onchange 前提／ESM化しない）。golfCompe_v1 に保存 */
function setCustomName(v){ const g=curGame(); if(!g)return;
  (g.custom=g.custom||{name:'',pts:{}}).name=String(v||'').slice(0,20); save(); renderResult(); }
function setCustomPts(tid,v){ const g=curGame(); if(!g)return;
  const c=(g.custom=g.custom||{name:'',pts:{}}); c.pts=c.pts||{};
  const s=String(v==null?'':v).trim();
  if(s===''){ delete c.pts[tid]; }                       // 空欄＝未入力に戻す（0 とは区別する）
  else { const n=Number(s); if(!isFinite(n))return; c.pts[tid]=Math.round(n*10)/10; }
  save(); renderResult(); }
function renderTeamCustom(g){
  const teams=g.teams.filter(t=>t.memberIds.length);   // スコア未入力チームも出す（幹事が入力漏れに気づける・§6.2-1）
  const C=g.custom||{name:'',pts:{}}, P=C.pts||{};
  const val=T=>{ const v=P[T.id]; if(v==null||v==='')return null; const n=Number(v); return isFinite(n)?n:null; };
  const {teams:wt,events}=teamWinPoints(g);
  const ev=events.find(e=>e.key==='customMatch');
  const winIds=ev?ev.winners.map(i=>wt[i].id):[];
  const head=`<h2>${tpEvLabel(g,'customMatch')}${tpAnnounceUI(g,'customMatch')}</h2>`;
  // 並び=ポイント降順・未入力は末尾・同値は g.teams の登録順（安定ソート）。順位は入力済みのみで算出（同値は同順位 1,1,3）
  const rows=teams.map((tm,i)=>({tm,i,v:val(tm)}));
  rows.sort((a,b)=>{ if(a.v==null&&b.v==null) return a.i-b.i; if(a.v==null) return 1; if(b.v==null) return -1;
    return b.v-a.v || a.i-b.i; });
  const ent=rows.filter(r=>r.v!=null);
  let rank=0,prev=null;
  ent.forEach((r,idx)=>{ if(prev===null||r.v!==prev){rank=idx+1;prev=r.v;} r.rank=rank; });
  const fmt=v=>String(Math.round(v*10)/10);
  const hero=rows.map(r=>{ const col=tmColor(r.tm.name), unset=r.v==null;
    const tag=(ev&&ev.on&&!unset&&winIds.includes(r.tm.id))
      ?`<span class="tag ${ev.winners.length>1?'tagtie':'tagwin'}">${ev.winners.length>1?t('custom.tie'):t('custom.win')}</span>`
       +`<span class="tag">${t('team.winpt')} +${tpShare(ev.w,ev.winners.length)}</span>`:'';
    return `<span class="rl-st tp-nd tp-ovh">
      <span class="rl-st-team" style="color:${col}">${esc(r.tm.name)}</span>
      <span class="rl-st-h"${unset?' style="color:var(--sub)"':''}>${unset?'—':fmt(r.v)}</span>
      ${unset?`<span class="tp-nd-sub">${t('custom.unset')}</span>`:''}
      ${(ev&&ev.on&&!unset)?`<span class="tp-nd-tagrow">${posBadge(r.rank,r.rank===1)}${tag}</span>`:''}
    </span>`; }).join('');
  const body=ent.length? `<div class="rl-standing tp-ovh-wrap">${hero}</div>`
                       : `<div class="empty">${t('custom.emptyPts')}</div>`;   // 全未入力＝ヒーローの代わりに案内（入力 details は必ず出す）
  const note=(!ev&&ent.length)?`<div class="muted mt6">${t('custom.needTeams')}</div>`:'';
  const ptsRows=teams.map(tm=>{ const v=P[tm.id];
    return `<div class="ptsrow"><span style="color:${tmColor(tm.name)}">● ${esc(tm.name)}</span><span class="ptsedit">`
      +`<input type="number" step="any" value="${v==null?'':esc(String(v))}" onchange="setCustomPts('${tm.id}',this.value)"></span></div>`; }).join('');
  const edit=`<details class="prize-edit mt10"${cmCfgOpen?' open':''} ontoggle="cmCfgToggle(this.open)"><summary>${t('custom.ptsTitle')}</summary><div class="in">
      <label class="fl">${t('custom.name')}</label>
      <input type="text" maxlength="20" value="${esc(C.name||'')}" placeholder="${esc(t('custom.namePh'))}" onchange="setCustomName(this.value)">
      <div class="muted mt6">${t('custom.ptsNote')}</div>${ptsRows}</div></details>`;
  return `<div class="card">${head}${body}${note}${edit}</div>`;
}
