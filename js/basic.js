/* ============================ BASIC SETUP（コンペ設定・2026-08-20-game-split.md ＋ 2026-09-12-settings-consolidation.md） ============================
   2026-09-12: 旧「ゲーム設定」タブを本タブへ統合（設計 §3.2）。描画順は
     S1 ゲーム（コンペ）→ S2 大会情報 → S3〜S10 gameSettingsHtml(g) → S11 幹事メニュー。 */

/* 設定セクションの開閉（2026-09-12-settings-consolidation.md §3.4）。
   揮発＝localStorage 非保存（§11.14 原則4・保存キーは5つのまま）。
   renderBasic() の再描画（setFmt / setKanjiBadge / setKanjiRank / setUniv）をまたいで
   開いたままにするためだけの表示状態。リロードすると全閉に戻る。 */
let gsOpen = {};                                 // 'peria'|'every'|'kanji'|'roulette'|'vegas'|'univ'|'pts'|'host' → true=開
function gsToggle(k, open){ gsOpen[k] = open; }   // ontoggle から呼ぶだけ（★再描画しない＝無限ループ防止・§12-3）
/* 折りたたみセクションの共通ヘルパ（gameSettingsHtml / hostMenuCard が使う）。
   見た目は既存の details 規則＋ details.gsec>summary（styles.css）のみ。
   <summary> は動的 HTML なので data-i18n ではなく t() で埋める（§12-6）。 */
function gsSec(k, titleHtml, inner, extraCls=''){
  return `<details class="gsec${extraCls?' '+extraCls:''}"${gsOpen[k]?' open':''} ontoggle="gsToggle('${k}',this.open)">
  <summary>${titleHtml}</summary><div class="in">${inner}</div></details>`;
}
function renderBasic(){
  const el=document.getElementById('view-basic');
  let html = `<div class="card"><h2>${t('game.title')}</h2>
    <div class="row between">
      <select id="gameSel" onchange="selectGame(this.value)" class="fx1">
        <option value="">${t('game.selectPh')}</option>
        ${state.games.map(g=>`<option value="${g.id}" ${g.id===state.currentGameId?'selected':''}>${esc(g.name)} (${g.date})</option>`).join('')}
      </select>
      <button class="btn" onclick="createGame()">${t('game.newBtn')}</button>
    </div></div>`;

  const g=curGame();
  if(!g){ el.innerHTML=html+`<div class="empty">${t('game.emptyCreate')}</div>`+backupCard()+hostMenuCard(); return; }   // ゲーム未選択でも読み込み(import)できるようにバックアップは出す（#166③）

  // S2 大会情報。日付/コースの2カラムは .row.cols2（#166① の重なり修正・styles.css 参照）
  html += `<div class="card"><h2>${t('game.basic')}</h2>
    <label class="fl">${t('game.compeName')}</label><input value="${esc(g.name)}" onchange="setG('name',this.value)">
    <div class="row cols2"><div class="fx1"><label class="fl">${t('game.date')}</label><input type="date" value="${g.date}" onchange="setG('date',this.value)"></div>
    <div class="fx1"><label class="fl">${t('game.course')}</label><input value="${esc(g.course)}" placeholder="${t('game.coursePh')}" onchange="setG('course',this.value)"></div></div>
    <div class="row">
      <button class="btn danger sm" onclick="deleteGame()">${t('game.deleteBtn')}</button>
      <button class="btn gray sm" onclick="dupGame()">${t('btn.dup')}</button>
    </div>
  </div>`;

  html += gameSettingsHtml(g);   // S3〜S10（旧「ゲーム設定」タブの8カード・js/game.js）
  html += backupCard();          // S11 バックアップ（#166③・js/backup.js）。幹事メニューより前＝動作確認用パネルを最下段に残す
  html += hostMenuCard();        // S12
  el.innerHTML=html;
}
// 幹事メニュー（動作確認用・目立たせない。Phase2で幹事のみ表示に制限予定）
function hostMenuCard(){
  // テストデータのパターン選択（2026-08-31-testdata-patterns.md §7）。選択は揮発変数 sdPat（localStorage 非保存）
  const sp=SD_PATTERNS.find(x=>x.key===sdPat)||SD_PATTERNS[0];
  // ★外側（幹事メニュー）にだけ .gsec を付ける。内側の auditCard() は素の <details> のまま（設計 §12-2）
  return gsSec('host', t('host.summary'), `<div class="muted" style="margin-bottom:8px">${t('host.note')}</div>
    <label class="fl">${t('host.seedPattern')}</label>
    <select onchange="sdSetPat(this.value)">${SD_PATTERNS.map(x=>
      `<option value="${x.key}" ${x.key===sp.key?'selected':''}>${esc(t(x.label))}</option>`).join('')}</select>
    <div class="muted" id="sdDesc" style="margin:6px 0 8px">${esc(t(sp.desc))}</div>
    <button class="btn gold sm" onclick="seedTestData()">${t('host.seedBtn')}</button>
    <div class="muted">${t('host.seedNote')}</div>
    ${auditCard()}`);
}

/* ============================ データ点検（#171 PR2）============================
   目的: 過去のバックアップに残ってしまった「削除済み選手IDへの参照」と、
   par 変更で対象外になったホールに取り残された受賞記録を、幹事が1件ずつ確認して消せるようにする。
   ★migrate では自動修復しない（設計判断・#171）: 読み込んだ瞬間に消すと「誰だったか特定して戻す」道が絶たれる。
   ★点検結果は毎回その場で計算する揮発データ。localStorage には一切保存しない（キーは5つのまま）。
   検出対象は delPlayer（js/players.js #174）が掃除するようになった5フィールドと同一:
     roulette.reps[h][teamId] / roulette.pool[teamId][] / prizes.*Winner*（2セット含む） / match1v1.pairs[][]
   対象ホールの判定は必ず niapinHolesOf/draconHolesOf 経由（prizes.npdcOverride の手動上書きを反映・#153）。 */
const AUDIT_PRIZE_FIELDS=[['niapinWinner','np',1],['niapinWinner2','np',2],['draconWinner','dc',1],['draconWinner2','dc',2]];
let auditRan=false;   // 揮発: 「点検する」を押したか（localStorage 非保存）

// 参照切れ（ghosts）と対象外ホールの受賞記録（off）を全ゲームから収集。古いデータ（各フィールド未定義）でも落ちないよう全段ガードする
function auditScan(){
  const live=new Set(state.players.map(p=>p.id));
  const ghosts=[], off=[];
  (state.games||[]).forEach(g=>{
    const gname=g.name||'';
    const tname=tid=>{ const tm=(g.teams||[]).find(x=>x.id===tid); return (tm&&tm.name)||tid; };
    const R=g.roulette;
    if(R&&R.reps&&typeof R.reps==='object') Object.keys(R.reps).forEach(h=>{ const rp=R.reps[h]; if(!rp||typeof rp!=='object')return;
      Object.keys(rp).forEach(tid=>{ const pid=rp[tid];
        if(pid&&!live.has(pid)) ghosts.push({gid:g.id,gname,type:'rep',a:h,b:tid,pid,team:tname(tid),hole:Number(h)}); }); });
    // pool は同じ選手が複数ホール分入りうるが、削除は「そのチームの pool から全部除く」ので (team,pid) 単位に畳む
    if(R&&R.pool&&typeof R.pool==='object') Object.keys(R.pool).forEach(tid=>{ const q=R.pool[tid]; if(!Array.isArray(q))return;
      [...new Set(q.filter(pid=>pid&&!live.has(pid)))].forEach(pid=>
        ghosts.push({gid:g.id,gname,type:'pool',a:'',b:tid,pid,team:tname(tid),hole:null})); });
    const hasPar=Array.isArray(g.par);
    const NP=hasPar?niapinHolesOf(g):[], DC=hasPar?draconHolesOf(g):[];   // npdcOverride 込み（自前で par を見ない）
    AUDIT_PRIZE_FIELDS.forEach(([f,kind,s])=>{ const w=g.prizes&&g.prizes[f]; if(!w||typeof w!=='object')return;
      Object.keys(w).forEach(h=>{ const pid=w[h]; if(!pid)return;                     // '' は「該当なし」＝記録なし
        const outside=hasPar && !(kind==='np'?NP:DC).includes(Number(h));
        const it={gid:g.id,gname,type:'prize',a:f,b:h,pid,kind,set:s,hole:Number(h),outside};
        if(!live.has(pid)) ghosts.push(it);       // 参照切れは（対象外ホールでも）ghosts 側に1回だけ出す＝二重掲載しない
        else if(outside)  off.push(it); }); });
    const pairs=g.match1v1&&g.match1v1.pairs;
    if(Array.isArray(pairs)) pairs.forEach((pr,i)=>{ if(!Array.isArray(pr))return;
      const gs=[...new Set(pr.filter(x=>x&&!live.has(x)))];
      if(gs.length) ghosts.push({gid:g.id,gname,type:'m1',a:String(i),b:'',pid:gs.join(','),hole:null}); });
  });
  return {ghosts,off};
}
function auditKey(it){ return [it.gid,it.type,it.a,it.b,it.pid].join('|'); }           // onclick に載せる不変キー（一覧の並び順に依存しない）
function auditSrc(it){                                                                 // 種目名（動的キー連結をしない＝未使用キー検査を通す）
  if(it.type==='rep')  return t('audit.src.rep');
  if(it.type==='pool') return t('audit.src.pool');
  if(it.type==='m1')   return t('fmt.match1v1');
  const base=it.kind==='np'?t('term.niapin'):t('term.dracon');
  return base+' '+prizeSetLabel(it.set);                                               // OUT/IN（リテラル・§4.2）
}
// 1件を表す素のテキスト（confirm 用。HTML 側は esc() して使う）
function auditLabel(it){
  const parts=[it.gname, auditSrc(it)];
  if(it.hole!=null) parts.push(t('audit.hole',{n:it.hole+1}));
  if(it.team) parts.push(it.team);
  if(it.type==='m1') parts.push('#'+(Number(it.a)+1));
  const p=state.players.find(x=>x.id===it.pid);
  parts.push(p? p.name : t('audit.idLbl',{v:it.pid}));
  return parts.filter(x=>x!=='').join(' / ');
}
function auditRow(it){
  return `<div class="row between mt6"><div class="fx1 tal">${esc(auditLabel(it))}${
    it.type==='prize'&&it.outside?`<span class="tag">${t('audit.tagOff')}</span>`:''}</div>
    <button class="btn danger sm" onclick="auditDel('${esc(auditKey(it))}')">${t('audit.del')}</button></div>`;
}
function auditBody(){
  const r=auditScan();
  if(!r.ghosts.length && !r.off.length) return `<div class="empty">${t('audit.none')}</div>`;
  const sec=(title,note,list)=> list.length? `<div class="mt10"><b>${title}</b><span class="tag">${t('audit.count',{n:list.length})}</span></div>
    <div class="muted">${note}</div>`+list.map(auditRow).join('') : '';
  return sec(t('audit.ghostTitle'),t('audit.ghostNote'),r.ghosts)+sec(t('audit.offTitle'),t('audit.offNote'),r.off);
}
function auditCard(){
  return `<details><summary>${t('audit.summary')}</summary><div class="in">
    <div class="muted">${t('audit.note')}</div>
    <div class="row mt8"><button class="btn gray sm" onclick="runDataAudit()">${t('audit.runBtn')}</button></div>
    <div id="auditOut">${auditRan?auditBody():''}</div>
  </div></details>`;
}
function runDataAudit(){ auditRan=true; auditRefresh(); }
function auditRefresh(){ const el=document.getElementById('auditOut'); if(el) el.innerHTML=auditBody(); }
/* 削除は必ず1件ずつ（一括削除は作らない＝誤操作で復旧不能にしない）。
   キーから現在の点検結果を引き直す＝表示後にデータが変わっていても取り違えない。 */
function auditDel(key){
  const r=auditScan(); const it=[...r.ghosts,...r.off].find(x=>auditKey(x)===key);
  if(!it){ auditRefresh(); return; }                                   // 既に消えている（再点検で一覧から落とすだけ）
  if(!confirm(t('audit.confirmDel',{v:auditLabel(it)})))return;
  const g=state.games.find(x=>x.id===it.gid); if(!g)return;
  if(it.type==='rep'){ const rp=(g.roulette&&g.roulette.reps||{})[it.a];
    if(rp){ delete rp[it.b]; if(!Object.keys(rp).length) delete g.roulette.reps[it.a]; } }   // 空になったホールごと削除（delPlayer と同じ）
  else if(it.type==='pool'){ const P=g.roulette&&g.roulette.pool;
    if(P&&Array.isArray(P[it.b])) P[it.b]=P[it.b].filter(x=>x!==it.pid); }
  else if(it.type==='prize'){ const w=g.prizes&&g.prizes[it.a]; if(w) delete w[it.b]; }      // キーごと削除＝「該当なし（—）」表示（#174 と同じ）
  else if(it.type==='m1'){ const pairs=g.match1v1&&g.match1v1.pairs; const i=Number(it.a);
    if(Array.isArray(pairs)&&Array.isArray(pairs[i])&&it.pid.split(',').every(p=>pairs[i].includes(p))) pairs.splice(i,1); }
  save(); auditRefresh(); toast(t('audit.deleted'));
}
function createGame(){ const g=newGame(); state.games.push(g); state.currentGameId=g.id; save(); render(); toast(t('toast.gameCreated')); }
function selectGame(id){ state.currentGameId=id||null; save(); render(); }
function deleteGame(){ if(!confirm(t('confirm.deleteGame')))return;
  state.games=state.games.filter(x=>x.id!==state.currentGameId); state.currentGameId=state.games[0]?.id||null; save(); render(); }
function dupGame(){ const g=JSON.parse(JSON.stringify(curGame())); g.id=uid(); g.name=g.name+' (複製)'; state.games.push(g); state.currentGameId=g.id; save(); render(); }
