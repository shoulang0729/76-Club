/* ============================ ルーレット対抗 ============================ */
function rTeams(g){ return teamsOf(g); }
function rColor(name){ return tmColor(name); }
function rColorBg(name){ return rColor(name).replace(')','-bg)'); }   // 'var(--tm-red)'→'var(--tm-red-bg)'（勝ちカードの淡色塗り。2026-08-20-roulette-standings.md §9.2）
// エブリ支給（各ホール）：エブリワン=−1・エブリツー=−2（ゲームでエブリ適用ON時）。ルーレットの1ホール勝負に反映
function rlEvery(g,pid){ if(!g.womenEvery.enabled)return 0; const p=state.players.find(x=>x.id===pid); return p?(p.everyType==='every1'?1:p.everyType==='every2'?2:0):0; }
function rlRaw(g,pid,h){ const v=(g.scores[pid]||[])[h]; return (v!=null&&v!=='')?Number(v):null; }
function rlHoleScore(g,pid,h){ const v=rlRaw(g,pid,h); return v==null?null:v-rlEvery(g,pid); }  // 比較に使う実質スコア
function rlDraw(g, teamId, excludePid){
  const t=g.teams.find(x=>x.id===teamId); const members=teamMembers(g,t);
  let cand=members.filter(m=>!(g.roulette.pool[teamId]||[]).includes(m));
  if(excludePid) cand=cand.filter(m=>m!==excludePid);
  if(cand.length===0){ g.roulette.pool[teamId]=[]; cand=members.filter(m=>m!==excludePid); if(!cand.length)cand=members.slice(); }
  return cand[Math.floor(Math.random()*cand.length)];
}
function rlTick(){ const g=curGame(); if(!g)return; const h=g.roulette.cur;
  const pick=Object.assign({}, g.roulette.reps[h]||{});   // 非回転チームは確定代表で比較（#6）
  rl.spinTeams.forEach(tid=>{ const t=g.teams.find(x=>x.id===tid); if(!t)return;
    const m=teamMembers(g,t); if(!m.length)return;
    const pid=m[Math.floor(Math.random()*m.length)]; pick[tid]=pid;
    const p=state.players.find(x=>x.id===pid);
    const el=document.getElementById('rl-name-'+tid);
    if(el) el.textContent=p?p.name:'';
    // 名前とセットで候補のスコア（エブリ適用後）も回す（#5）
    const es=document.getElementById('rl-score-'+tid);
    if(es){ const av=adjHole(g,pid,h); es.textContent = av==null?'—':av; } });
  rlFlash(g,h,pick); }
/* 回転中の勝敗予告（#6）：今表示中の候補どうしを比較し、勝ち=緑/負け=赤/引分=橙で点滅。未入力が混じれば消灯 */
function rlFlash(g,h,pick){ const teams=rTeams(g);
  const sc=teams.map(t=>{ const pid=pick[t.id]; return pid?adjHole(g,pid,h):null; });
  const ok=!sc.some(s=>s==null); const mn=ok?Math.min(...sc):null;
  const allTie=ok && sc.every(s=>s===mn);
  teams.forEach((t,i)=>{ const el=document.getElementById('rl-panel-'+t.id); if(!el)return;
    el.classList.remove('fwin','flose','ftie');
    if(ok) el.classList.add(allTie?'ftie':(sc[i]===mn?'fwin':'flose')); }); }
/* STOP 誤爆の防止（2026-09-20-roulette-undo.md §8）: START と STOP は .rl-main の同じ位置・同じ大きさに出るので、
   START を押した指の2度目のタップがそのまま STOP を踏む。スピン開始から 800ms は STOP を受け付けない
   （rlTick は 75ms 刻み＝約10コマ。ボタンは disabled で描くので既存の button.btn:disabled{opacity:.4} が効く） */
const RL_STOP_LOCK_MS=800;
function rlBeginSpin(teamIds){ if(rl.timer)clearInterval(rl.timer); rl.spinning=true; rl.spinTeams=teamIds.slice(); rl.challengeFrom=null;
  if(rl.lockTimer)clearTimeout(rl.lockTimer);
  rl.stopLock=true; rl.lockTimer=setTimeout(()=>{ rl.stopLock=false; rl.lockTimer=null; const b=document.getElementById('rl-main'); if(b)b.disabled=false; }, RL_STOP_LOCK_MS);
  renderResult(); rl.timer=setInterval(rlTick,75); }
function rlStop(){ if(rl.stopLock)return; rlStopTimer(); const g=curGame(); const R=g.roulette; const h=R.cur; R.reps[h]=R.reps[h]||{};
  rl.spinTeams.forEach(tid=>{ const prev=R.reps[h][tid]; R.reps[h][tid]=rlDraw(g,tid, rl.spinTeams.length===1?prev:null); });
  rl.spinTeams=[]; save(); renderResult(); }
function rlStartInitial(){ const g=curGame(); const ids=rTeams(g).map(t=>t.id); rlMark(g,'spin',ids); rlBeginSpin(ids); }
function rlChange(tid){ const g=curGame(); const R=g.roulette; if((R.remChange[tid]||0)<=0)return; rlMark(g,'spin',[tid]); R.remChange[tid]--; save(); rlBeginSpin([tid]); }
function rlChallengeStart(fromTid){ const g=curGame(); const R=g.roulette; if((R.remChallenge[fromTid]||0)<=0)return;
  const others=rTeams(g).filter(t=>t.id!==fromTid);
  if(others.length===1){ rlChallengeDo(fromTid, others[0].id); } else { rl.challengeFrom=fromTid; renderResult(); } }
function rlChallengeDo(fromTid, targetTid){ const g=curGame(); const R=g.roulette; if((R.remChallenge[fromTid]||0)<=0)return; rlMark(g,'spin',[targetTid]); R.remChallenge[fromTid]--; rl.challengeFrom=null; save(); rlBeginSpin([targetTid]); }
function rlCancelChallenge(){ rl.challengeFrom=null; renderResult(); }
function rlHoleDrawn(g){ const reps=g.roulette.reps[g.roulette.cur]||{}; return rTeams(g).every(t=>reps[t.id]); }
/* 使い切り必須の判定はハーフ単位（§11.3）：前半=9番(index8)終了まで／後半=18番(index17)終了までに残チェンジ0 */
function rlCanAdvance(g){ if(!rlHoleDrawn(g))return false; const cur=g.roulette.cur;
  const left = cur<=8 ? 8-cur : 17-cur;
  return rTeams(g).every(t=>(g.roulette.remChange[t.id]||0)<=left); }
/* 取り消し用スナップショット（2026-09-20-roulette-undo.md §5.2）: 状態を変える操作の直前に必ず呼ぶ。
   最大1件・揮発（rl.undo）＝保存しない。kind は 'spin'（抽選のやり直し）/'next'（1ホール戻す） */
function rlMark(g,kind,teams){ rl.undo={ gid:g.id, kind, h:g.roulette.cur, teams:(teams||[]).slice(), snap:JSON.parse(JSON.stringify(g.roulette)) }; }
/* rlNextHole の状態遷移部分だけを切り出した純関数（同 §5.2）。DOM も save も呼ばないので回帰ハーネスの vm から直接呼べる。
   中身は切り出し前の3文をそのまま移しただけ（pool へ代表を push → cur++ → 後半開始で再付与）＝挙動不変 */
function rlAdvance(g){ const R=g.roulette;
  const reps=R.reps[R.cur]||{}; rTeams(g).forEach(t=>{ R.pool[t.id]=[...(R.pool[t.id]||[]), reps[t.id]]; });
  R.cur=Math.min(18,R.cur+1);
  // OUT終了→後半開始：チェンジ/チャレンジをハーフ分再付与（上書き＝前半の余りは失効・§11.3）
  if(R.cur===9) rTeams(g).forEach(t=>{ R.remChange[t.id]=R.changeN; R.remChallenge[t.id]=R.challengeM; }); }
function rlNextHole(){ const g=curGame(); if(!rlCanAdvance(g)){toast(t('toast.useChange'));return;}
  rlMark(g,'next',[]); rlAdvance(g);
  rl.challengeFrom=null; save(); renderResult(); }
function rlReset(){ if(!confirm(t('confirm.rlReset')))return; const g=curGame(); const R=g.roulette;
  R.reps={};R.pool={};R.remChange={};R.remChallenge={};R.cur=0; rTeams(g).forEach(t=>{R.remChange[t.id]=R.changeN;R.remChallenge[t.id]=R.challengeM;});
  rl.challengeFrom=null; rl.undo=null; rlStopTimer(); rl.spinTeams=[]; save(); renderResult(); }
/* ===== 直前の1操作の取り消し（2026-09-20-roulette-undo.md §5）=====
   逆操作ではなくスナップショット方式: rlDraw の pool リセットやハーフ境界の再付与といった
   「rlNextHole が何を副作用に持つか」を知らずに済み、復元は代入1回＝過去の結果を壊す経路が構造的に無い。
   深さは1手だけ・gid 一致の進行中コンペのみ・リロードで消える（§4.1・§5.3） */
// 今出すべきボタンの種別（'spin'=抽選のやり直し / 'next'=1ホール戻す / null=出さない）。別コンペ・スピン中は null
function rlUndoKind(g){ const u=rl.undo; return (u&&g&&u.gid===g.id&&!rl.spinning)?u.kind:null; }
/* 純関数（DOM/confirm/save を呼ばない＝回帰ハーネスから直接呼べる）。ガードは §5.4 の2つ:
   ① gid 不一致（別コンペ・リロード後）② snap が参照する選手が state.players に居ない（復元で削除済み選手を蘇らせない） */
function rlApplyUndo(g){ const u=rl.undo; if(!u||!g||u.gid!==g.id)return false;
  const alive=pid=>pid==null||!!state.players.find(x=>x.id===pid); const s=u.snap;
  for(const hh in (s.reps||{})){ const rp=s.reps[hh]||{}; for(const tid in rp) if(!alive(rp[tid]))return false; }
  for(const tid in (s.pool||{})) if(!(s.pool[tid]||[]).every(alive))return false;
  g.roulette=JSON.parse(JSON.stringify(s)); return true; }
function rlUndo(){ const g=curGame(); const kind=rlUndoKind(g); if(!kind)return;
  if(!confirm(t(kind==='spin'?'confirm.rlUndoSpin':'confirm.rlUndoHole')))return;
  const teams=rl.undo.teams.slice();
  if(!rlApplyUndo(g)){ rl.undo=null; toast(t('toast.rlUndoStale')); renderResult(); return; }
  save();
  // 'spin' は rl.undo を残す＝気に入るまで何度でも「そのスピンの直前」に戻せる。'next' は1回きり（同じ復元の再適用は無意味）
  if(kind==='spin') rlBeginSpin(teams);
  else { rl.undo=null; rl.challengeFrom=null; renderResult(); } }
// .rl-head の右端グループ（リセットの左・§9）。margin-left:auto は「その行で最初に出る右寄せ要素」に付ける
function rlUndoBtn(g){ const k=rlUndoKind(g);
  return k?`<button class="btn gray sm" style="margin-left:auto" onclick="rlUndo()">${t(k==='spin'?'rl.undoSpin':'rl.undoHole')}</button>`:''; }
function rlStandings(g){ const teams=rTeams(g); const won=teams.map(()=>0); let pending=0;
  for(let h=0; h<g.roulette.cur; h++){ const reps=g.roulette.reps[h]; if(!reps)continue;
    const sc=teams.map(t=>{const pid=reps[t.id];return pid!=null?rlHoleScore(g,pid,h):null;});
    if(sc.some(s=>s==null)){pending++;continue;}
    const mn=Math.min(...sc); const w=sc.map((s,i)=>s===mn?i:-1).filter(i=>i>=0); w.forEach(i=>won[i]+=1/w.length); }
  return {teams,won,pending}; }

// 開発者メニュー：代表を手動指定 / 回数を戻す（誤操作の復旧用）
function rlForceRep(tid,pid){ if(!pid)return; const g=curGame(); const R=g.roulette; R.reps[R.cur]=R.reps[R.cur]||{}; R.reps[R.cur][tid]=pid; save(); renderResult(); }
function rlRefund(tid,which){ const g=curGame(); const R=g.roulette; if(which==='change')R.remChange[tid]=(R.remChange[tid]||0)+1; else R.remChallenge[tid]=(R.remChallenge[tid]||0)+1; save(); renderResult(); }

// ルーレット用スコア表（読み取り専用・現在ホール強調・各チームの代表行に印）
// 各ホールの「採用代表セル」に印。全ホール分：勝ち=緑/引分=橙/採用(負け)=太枠
function rlMarks(g){
  const teams=rTeams(g); const R=g.roulette; const mark={}; const last=Math.min(R.cur,17);
  for(let hh=0; hh<=last; hh++){ const rp=R.reps[hh]; if(!rp)continue;
    const complete = teams.every(t=>rp[t.id]);
    const sc=teams.map(t=>{const pid=rp[t.id];return pid!=null?rlHoleScore(g,pid,hh):null;});
    const scored = complete && sc.every(s=>s!=null);
    let winI=new Set(), tie=false;
    if(scored){ const mn=Math.min(...sc); const wi=sc.map((s,i)=>s===mn?i:-1).filter(i=>i>=0); if(wi.length===teams.length)tie=true; else wi.forEach(i=>winI.add(i)); }
    teams.forEach((t,ti)=>{ const pid=rp[t.id]; if(!pid)return; mark[pid]=mark[pid]||{};
      mark[pid][hh]= scored ? (tie?'rtie':(winI.has(ti)?'rwin':'adopt')) : 'adopt'; });
  }
  return mark;
}
/* スコアカードの開閉（§11.14: <details> の控えめ操作・既定=閉 #97）。揮発の表示状態＝localStorage に保存しない */
let rlScOpen=false;
function rlScToggle(open){ rlScOpen=open; }
function rlScorecard(g){
  const teams=rTeams(g); const R=g.roulette; const h=R.cur<18?R.cur:-1; const cols=[...Array(18).keys()]; const mark=rlMarks(g);
  const cg=`<colgroup><col style="width:72px">${cols.map(()=>'<col>').join('')}</colgroup>`;
  const head=`<tr><th class="nm">${t('col.player')}</th>${cols.map(i=>`<th class="${i===h?'cur':''}">${i+1}</th>`).join('')}</tr>`;
  const parRow=`<tr class="parr"><td class="nm">Par</td>${cols.map(i=>`<td class="${i===h?'cur':''} ${g.hidden[i]?'hh':''}">${g.par[i]}</td>`).join('')}</tr>`;
  let body='';
  /* §11.12 J②: チーム戦スコア表と同じ並べ方＝チームは取得Hの多い順、メンバーはネット順。
     並べ替えは表示だけで、代表/採用の印（rlMarks）や集計には影響しない。 */
  const wonOf=rlStandings(g).won;
  const ordered=teams.map((tm,ti)=>({tm,v:wonOf[ti]||0})).sort((a,b)=>b.v-a.v).map(o=>o.tm);
  ordered.forEach(t=>{ const col=rColor(t.name);
    body+=`<tr><td class="nm" colspan="19" style="background:${col};color:var(--bg);text-align:left;font-weight:var(--w-bold)">${esc(t.name)}</td></tr>`;
    const mem=teamMembers(g,t);
    const byNet=ranked(mem, pid=>enteredCount(g,pid)?netScore(g,pid):null, 'asc').map(o=>o.pid);
    byNet.concat(mem.filter(pid=>!byNet.includes(pid))).forEach(pid=>{ const p=state.players.find(x=>x.id===pid); if(!p)return; const av=adjArr(g,pid); const mm=mark[pid]||{};
      body+=`<tr><td class="nm">${esc(p.name)}</td>${cols.map(i=>`<td class="${i===h?'cur':''} ${g.hidden[i]?'hh':''} ${mm[i]||''}">${av[i]??''}</td>`).join('')}</tr>`; }); });
  return `<details class="rl-sc"${rlScOpen?' open':''} ontoggle="rlScToggle(this.open)"><summary>${t('sc.title')} <span class="muted" style="font-weight:var(--w-med);font-size:11px">${t('rl.legend')}</span></summary>
    <div class="in"><div class="scroll"><table class="sc2 rlsc">${cg}${head}${parRow}${body}</table></div></div></details>`;
}

/* 返り値 {head, body}（2026-08-20-roulette-standings.md §5・renderMatch1v1Parts と同型）。
   head=抽選カード一式（card rl-play）＝.result-sticky に同居して固定・body=スコア表＋開発者メニュー＝スクロール領域。
   ガード（rl.need2）は {head:'', body:空状態カード}＝空状態は固定しない */
function renderRouletteParts(g){
  const teams=rTeams(g);
  // 空状態カードの <h2> は廃止＝タイトルはゲームタブ名（result.sub.roulette）が兼ねる（heading-unify §3.2）
  if(teams.length<2) return {head:'', body:`<div class="card"><div class="empty">${t('rl.need2')}</div></div>`};
  const R=g.roulette;
  teams.forEach(t=>{ if(R.remChange[t.id]===undefined)R.remChange[t.id]=R.changeN; if(R.remChallenge[t.id]===undefined)R.remChallenge[t.id]=R.challengeM; });
  const {won,pending}=rlStandings(g);
  const wonH=ti=>Math.round((won[ti]||0)*10)/10;   // 0Hから常時表示（引分は0.5刻み）

  /* 18H終了後（#31）：抽選は終わっているのでカードは描かず、スタンディング行（取得H降順）→ 操作行（リセット＋連携）のみ。
     ★2026-09-12（heading-unify §5.3-B）: 行順を rl-head → standRow から standRow → rl-head へ入れ替えた＝
     結果が先・幹事操作が後（投影原則 §11.14-3）。連携UIは自動的に「チーム合計（取得H）の右下」に来る＝追加高さ0。
     取得H降順（同点=登録順・Array#sort は安定）。won/wonH は既存のまま再利用＝計算不変。数値は濃色インク（--strong・CSS側） */
  if(R.cur>=18){
    const standRow=`<div class="rl-standing">${
      teams.map((tm,ti)=>({tm,ti,v:won[ti]||0})).sort((a,b)=>b.v-a.v)
        .map(({tm,ti})=>{ const col=rColor(tm.name);
          return `<span class="rl-st"><span class="rl-st-team" style="color:${col}">${esc(tm.name)}</span><span class="rl-st-h">${wonH(ti)}<small>H</small></span></span>`; }).join('')
    }</div>`;
    /* 連携ボタン（2026-08-30 ユーザー確定・自動確定廃止）: 18H終了後も進行中と同じ tpAnnounceUI を
       リセットの右（右端）に設置＝未連携なら「結果を連携する」・連携済みなら取り消し可（他種目と同じ可逆動作） */
    // §7.3: 18H終了後も「1ホール戻す」を出す（ここは現状 rlReset=18H全消し しか戻す手段が無い＝被害が最大のケース）
    const undoBtn=rlUndoBtn(g);
    return {head:`<div class="rlwrap">
      <div class="card rl-play">${standRow}<div class="rl-head">${undoBtn}<button class="btn gray sm"${undoBtn?'':' style="margin-left:auto"'} onclick="rlReset()">${t('btn.reset')}</button>${tpAnnounceUI(g,'roulette',true)}</div></div></div>`,
      body:`<div class="rlwrap">${rlScorecard(g)}</div>`};
  }

  const h=R.cur; const reps=R.reps[h]||{}; const drawn=rlHoleDrawn(g);
  const holeScores=()=>teams.map(t=>{const pid=reps[t.id];return pid!=null?rlHoleScore(g,pid,h):null;});
  let holeInfo='';
  /* 大型勝敗表示（rl-head・roulette-hero 設計）。表示条件は下の stCls と同一
     （!spinning && 全代表確定 && 全スコア入力済み）。判定は既存の holeScores()+Math.min の再利用＝計算不変。
     WIN はリテラル（UP/AS/nH/Par と同じ言語非依存の記号扱い）。引分は rl.tie を rl-info から移動して大型化 */
  let holeRes='';
  if(drawn){ const sc=holeScores();
    if(sc.some(s=>s==null)) holeInfo=`<span class="muted">${t('rl.repNoScore')}</span>`;
    else if(!rl.spinning){ const mn=Math.min(...sc); const wi=sc.map((s,i)=>s===mn?i:-1).filter(i=>i>=0);
      if(wi.length===teams.length) holeRes=`<div class="rl-res"><span class="rl-res-tie">${t('rl.tie')}</span></div>`;
      else holeRes=`<div class="rl-res">${wi.map(i=>`<span class="rl-res-nm" style="color:${rColor(teams[i].name)}">${esc(teams[i].name)}</span>`).join('')}<span class="rl-res-w"${wi.length===1?` style="color:${rColor(teams[wi[0]].name)}"`:''}>WIN</span></div>`; } }
  // 確定時の勝敗クラス（#6）：勝ち=win/負け=lose/全チーム同点=tie。スコア未入力が混じれば無色
  const stCls=(()=>{ const none=teams.map(()=>''); if(!drawn||rl.spinning)return none;
    const sc=holeScores(); if(sc.some(s=>s==null))return none;
    const mn=Math.min(...sc); if(sc.every(s=>s===mn))return teams.map(()=>' tie');
    return sc.map(s=>s===mn?' win':' lose'); })();
  /* 各チームの取得H（.rl-st）はカードの直上・カード幅中央に1つずつ（カードの並び順どおり・数値は濃色インク=CSS側）。
     カード内のチーム名ラベルは撤去（直上の .rl-st と重複のため・2026-08-30 #87 指示⑥）＝ .rl-nmrow は選手名のみ中央 */
  const panels=teams.map((tm,ti)=>{ const pid=reps[tm.id]; const p=pid?state.players.find(x=>x.id===pid):null;
    const av=pid?adjHole(g,pid,h):null; const sv=pid?(av==null?'—':av):'';
    const col=rColor(tm.name);
    // 固定高さのアクション欄（ボタンが動かないように）
    let act='';
    if(rl.spinning) act='';
    else if(rl.challengeFrom) act = (rl.challengeFrom!==tm.id)?`<button class="btn sm" onclick="rlChallengeDo('${rl.challengeFrom}','${tm.id}')">${t('rl.spinThis')}</button>`:`<span class="muted" style="font-size:11px">${t('rl.choosing')}</span>`;
    else if(drawn) act=`<button class="btn sec sm" ${(R.remChange[tm.id]||0)<=0?'disabled':''} onclick="rlChange('${tm.id}')">${t('roulette.change')} ${R.remChange[tm.id]||0}</button><button class="btn gray sm" ${(R.remChallenge[tm.id]||0)<=0?'disabled':''} onclick="rlChallengeStart('${tm.id}')">${t('roulette.challenge')} ${R.remChallenge[tm.id]||0}</button>`;
    return `<div class="rl-col">
      <div class="rl-st"><span class="rl-st-team" style="color:${col}">${esc(tm.name)}</span><span class="rl-st-h">${wonH(ti)}<small>H</small></span></div>
      <div class="rl-panel${stCls[ti]}" id="rl-panel-${tm.id}" style="border-color:${col};--rl-tc:${col};--rl-tc-bg:${rColorBg(tm.name)}">
        <div class="rl-nmrow"><span class="rl-name" id="rl-name-${tm.id}">${rl.spinning&&rl.spinTeams.includes(tm.id)?'…':(p?esc(p.name):'―')}</span></div>
        <div class="rl-scorebig" id="rl-score-${tm.id}">${pid?sv:'&nbsp;'}</div>
      </div>
      <div class="rl-act">${act}</div>
    </div>`; }).join('');
  let mainBtn;
  // id と disabled は STOP ロック（§8）用。再描画が挟まってもロック中は押せない状態が保たれる
  if(rl.spinning) mainBtn=`<button class="btn danger wide rl-main" id="rl-main" ${rl.stopLock?'disabled':''} onclick="rlStop()">${t('rl.stop')}</button>`;
  else if(!drawn) mainBtn=`<button class="btn wide rl-main" onclick="rlStartInitial()">${t('rl.start')}</button>`;
  else mainBtn=`<button class="btn wide rl-main" ${rlCanAdvance(g)?'':'disabled'} onclick="rlNextHole()">${t('rl.confirmNext')}</button>`;
  const devMenu=`<details class="rl-dev"><summary>${t('rl.dev')}</summary><div class="in">
    ${teams.map(tm=>`<div class="row between" style="margin:3px 0"><span style="color:${rColor(tm.name)};font-weight:var(--w-bold);min-width:64px">${esc(tm.name)}</span>
      <select style="flex:1;max-width:52%" onchange="rlForceRep('${tm.id}',this.value)"><option value="">${t('rl.pickRep')}</option>${teamMembers(g,tm).map(pid=>{const p=state.players.find(x=>x.id===pid);return `<option value="${pid}" ${reps[tm.id]===pid?'selected':''}>${esc(p&&p.name)}</option>`}).join('')}</select></div>`).join('')}
    <hr>${teams.map(tm=>`<div class="row between" style="margin:2px 0"><span style="color:${rColor(tm.name)};min-width:64px">${esc(tm.name)}</span><span><button class="btn gray sm" onclick="rlRefund('${tm.id}','change')">${t('rl.refundChange',{n:R.remChange[tm.id]||0})}</button> <button class="btn gray sm" onclick="rlRefund('${tm.id}','challenge')">${t('rl.refundChallenge',{n:R.remChallenge[tm.id]||0})}</button></span></div>`).join('')}
  </div></details>`;
  const undoBtn=rlUndoBtn(g);   // 幹事の訂正操作。競技アクション（.rl-act のチェンジ/チャレンジ）とは視覚的に分ける（§9）
  const head=`<div class="rlwrap">
    <div class="card rl-play">
      <div class="rl-head"><div class="rl-hole">${h+1}<small>H</small></div><div class="rl-par">Par ${g.par[h]}</div>
        ${holeRes}
        ${rl.challengeFrom?`<span class="muted">${t('rl.pickOpp')} <button class="btn gray sm" onclick="rlCancelChallenge()">${t('btn.cancel')}</button></span>`:''}
        ${undoBtn}<button class="btn gray sm"${undoBtn?'':' style="margin-left:auto"'} onclick="rlReset()">${t('btn.reset')}</button>${tpAnnounceUI(g,'roulette',true)}</div>
      <div class="rl-panels">${panels}</div>
      <div class="rl-ctrl">
        <div class="rl-info">${(!rl.spinning&&drawn)?holeInfo:'&nbsp;'}</div>
        ${mainBtn}
        ${(!rl.spinning&&drawn&&!rlCanAdvance(g))?`<div class="muted" style="margin-top:6px;text-align:center">${t('rl.useChanges')}</div>`:''}
      </div>
    </div>
  </div>`;
  return {head, body:`<div class="rlwrap">${rlScorecard(g)}${devMenu}</div>`};
}


/* リーダーボード（1行=1選手。hlMap=強調・big=大表示・maskable=名前/スコアを show.names で隠せる）。
   heading-unify §10.1: 見出し <h2> を廃止（タイトルはゲームタブ名が兼ねる）。第1引数は「見出し文字列」→
   「カード末尾フッタ行の左端に置く状態タグHTML」。'' のときは行そのものを作らない（縦スペースを増やさない）。
   旧 note 引数（h2 内のタイトル横注記・専用クラスごと廃止）は全呼び出しが '' だったので削除した＝dead 引数を残さない */
function leaderboard(tagHtml, pids, valFn, dir, fmt, key, hlMap, big){
  const rows=ranked(pids,valFn,dir);
  const nameOf=pid=>{const p=state.players.find(x=>x.id===pid);return esc(p&&p.name);};
  const body=`<table class="lb ${big?'big':''}"><tr><th class="c-pos">${t('col.rank')}</th><th>${t('col.player')}</th><th class="c-val">${dir==='asc'?t('col.score'):t('col.pts')}</th></tr>
    ${rows.map(r=>{ const hb=hlMap&&hlMap[r.pid];
      return `<tr class="rank ${hb?'hlrow':''}"><td class="c-pos">${posBadge(r.rank,r.rank===1)}</td><td class="nmc">${nameOf(r.pid)}${hb?`<span class="kanjibadge">${hb}</span>`:''}</td><td class="c-val"><b>${fmt(r.v)}</b></td></tr>`; }).join('')}</table>`;
  return `<div class="card tight ${big?'wide':''}">${body}${tagHtml?`<div class="cardtools mt8">${tagHtml}</div>`:''}</div>`;
}

function renderPrizes(g){
  const NP=niapinHolesOf(g), DC=draconHolesOf(g);   // 対象ホールは par から導出（2026-08-20-npdc-par.md）
  if(!NP.length && !DC.length) return '';
  const parts=g.participants.filter(pid=>state.players.find(x=>x.id===pid));
  const opts=(sel)=>`<option value="">—</option>${parts.map(pid=>{const p=state.players.find(x=>x.id===pid);
    return `<option value="${pid}" ${sel===pid?'selected':''}>${esc(p.name)}</option>`}).join('')}`;
  // ニアドラ2セット（2026-09-12-niadora-2sets.md §9）。S===1（既定）は従来と同一の1セレクト行、
  // S===2 は OUT/IN の2セレクトを縦積み（375px で横スクロールなし・氏名を省略しない）
  const S=prizeSetCount(g);
  const one=(kind,h)=>`<select style="flex:1;max-width:60%" onchange="setPrize('${prizeField(kind,1)}',${h},this.value)">${opts(prizeWinnerOf(g,kind,h,1))}</select>`;
  const two=(kind,h)=>`<div class="pz2">${[1,2].map(s=>`<div class="pz2-row"><span class="pz-set">${prizeSetLabel(s)}</span><select onchange="setPrize('${prizeField(kind,s)}',${h},this.value)">${opts(prizeWinnerOf(g,kind,h,s))}</select></div>`).join('')}</div>`;
  const inputs=(kind,h)=> S===2? two(kind,h) : one(kind,h);
  // <h2> は廃止: このカードを包む <details> の <summary> が同じ prize.recTitle を出しており二重表示だった（heading-unify §3.2）
  // #184: 「1ホールに旗2本」のトグルはコンペ設定タブへ移設（npdcSettingsSec・js/basic.js）。
  //       ここは発表時に使う勝者の select だけを残す（個人戦・チーム戦の両ニアドラから設定が消える）
  let html=`<div class="card prizewin">
    <div class="muted">${t('prize.recNote')}</div>`;
  if(NP.length){ html+=`<h3>${t('term.niapin')}</h3>`;
    NP.forEach(h=>{ html+=`<div class="row between" style="margin:4px 0">
      <span class="pill e1">${h+1}H</span>
      ${inputs('np',h)}</div>`; }); }
  if(DC.length){ html+=`<h3>${t('term.dracon')}</h3>`;
    DC.forEach(h=>{ html+=`<div class="row between" style="margin:4px 0">
      <span class="pill f" style="background:var(--danger-bg);color:var(--red)">${h+1}H</span>
      ${inputs('dc',h)}</div>`; }); }
  html+=`</div>`; return html;
}
// k はフィールド名（'niapinWinner' | 'niapinWinner2' | 'draconWinner' | 'draconWinner2'）。シグネチャ不変（§3.5）。
// 防御ガード: migrate 前の旧データ相当でも TypeError にしない（§3.3 の罠）
function setPrize(k,h,v){ const P=curGame().prizes; if(!P[k])P[k]={}; P[k][h]=v; save(); renderResult(); }
// 2セット運用の切替（§5・コンペごと・既定OFF。OFF にしてもセット2のデータは残置＝可逆）
function setPrizeTwoSets(v){ curGame().prizes.twoSets=!!v; save(); renderResult(); }

// チーム対抗の各結果を「個別カード」で返す。ゲームごとに master トグル＋チームごとの目隠しボタン（名前＋合計をまとめて隠す）
// only（省略可・2026-08-20-results-regroup.md §5.2）: 指定時は当該フォーマットのカード1枚だけ返す。無指定は現行どおり全カード＝後方互換
function renderTeams(g, only){
  const F=chFormats(g); const teams=teamsOf(g);   // αではβゲームのカードを出さない（§11.12 C）
  /* グロス対抗／ネット対抗の値は calc.js の teamGrossVal/teamNetVal が唯一の正（常に1人あたり平均）。
     #157 の教訓で表示側に式を持たない＝勝ち点（teamWinPoints）とカードの値が構造的に一致する。 */
  // master トグルは表の下（結果が先・操作が後＝追加指示⑪・§11.14 幹事操作は控えめ配置）
  // heading-unify §10.1: card() から title 引数を削除（見出し <h2> 廃止＝タイトルはゲームタブ名が兼ねる）。
  // note（h2 の外の .muted 注記「少ないほど上位」等）は残す
  /* ★null（＝種目の対象外。全員未入力のチームの best2 など）の扱い（best2-per-hole §5.5 / team-score-average §4.4）:
     値は「—」・並びは方向（asc/desc）によらず**末尾**。以前は a.v-b.v が NaN になって並びが不定になり、
     値セルも Math.round(null*10)/10 ＝ 0 と描かれて最上位に見えていた。
     valFn が数値しか返さないカード（teamGross/teamNet/holeByHole）の出力は不変（null が出ないため）。 */
  /* 平均の表示（2026-09-19-team-avg-only.md §5.1）: グロス対抗／ネット対抗カードのときだけ、値列ヘッダを
     「平均」にし、チーム名に母数の人数を併記する（投影先で平均が検算できる＝§11.14 の文字併記と同じ思想）。
     ★avg 変数を消して常時「平均」にしてはいけない（card() は5種目共用＝ベスト2ボールの「計」まで巻き込む）。
     best2ball/holeByHole/vegas のカードは1pxも変えない。 */
  const card=(key,valFn,dir,note)=>{ const rows=teams.map(t=>({t,v:valFn(t)}))
      .sort((a,b)=> (a.v==null||b.v==null) ? (a.v==null?1:0)-(b.v==null?1:0) : (dir==='desc'? b.v-a.v : a.v-b.v));
    const avg = (key==='teamGross'||key==='teamNet');
    const on = tgMode[key]==='show';
    // 発表ボタン（winpoints-reveal §5.2・card の key と種目 key は一致）: 目隠しトグルと同列の控えめ配置（§11.14）
    const tools=`<div class="cardtools mt8"><span class="tgl ${on?'on':'off'}" onclick="toggleTgAll('${key}')">${on?t('ns.allShow'):t('ns.allHide')}</span>${tpAnnounceUI(g,key)}</div>`;
    return `<div class="card tight">${note?`<div class="muted" style="margin-bottom:4px">${note}</div>`:''}<table class="lb"><tr><th class="c-eye"></th><th class="c-pos">${t('col.rank')}</th><th>${t('col.team')}</th><th class="c-val">${dir==='desc'?'H':(avg?t('col.avg'):t('col.total'))}</th></tr>
      ${rows.map((r,i)=>{ const m=tgMasked(key,r.t.id);
        const nm = m ? '<span class="mask">？？？</span>'
          : esc(r.t.name)+(avg?` <span class="muted">${t('team.memN',{n:teamScoreMembers(g,r.t).length})}</span>`:'');   // 目隠し中は人数も出さない
        const val = m ? '<span class="mask">？</span>'
          : (r.v==null ? `<span class="muted">—</span>` : `<b>${Math.round(r.v*10)/10}</b>`);
        return `<tr class="rank"><td class="c-eye"><button class="eyebtn ${m?'off':'on'}" onclick="toggleTgRow('${key}','${r.t.id}')">${m?EYEOFF:EYE}</button></td><td class="c-pos">${posBadge(i+1,i===0)}</td><td class="nmc">${nm}</td><td class="c-val">${val}</td></tr>`; }).join('')}</table>${tools}</div>`; };
  let out='';
  /* 注記行（2026-09-19-team-avg-only.md §5.1）: 常に「1人あたりの平均が少ない方が勝ち」。
     人数不揃い警告（#195）は合計モードの廃止で根拠が消えたため撤去した（設計 §4）。 */
  const tsNote=t('team.noteAvg');
  if(F.teamGross && (!only||only==='teamGross')) out+=card('teamGross',T=>teamGrossVal(g,T),'asc',tsNote);
  if(F.teamNet && (!only||only==='teamNet')) out+=card('teamNet',T=>teamNetVal(g,T),'asc',tsNote);
  if(F.best2ball && (!only||only==='best2ball')) out+=card('best2ball',tm=>best2(g,tm),'asc',t('team.noteBest2'));
  if(F.holeByHole && (!only||only==='holeByHole') && teams.length>=2){ const {won}=holesWon(g);
    out+=card('holeByHole',(tm)=>{const i=teams.indexOf(tm);return won[i];},'desc',t('team.noteHbh')); }
  if(F.vegas && (!only||only==='vegas')){ const vs=vegasStandings(g);
    if(vs.teams.length<2){ out+=`<div class="card tight"><div class="muted">${t('vegas.needTeams')}</div></div>`; }
    else{ const rows=vs.teams.map((T,i)=>({t:T,v:vs.tot[i]})).sort((a,b)=>b.v-a.v);
      const on = tgMode.vegas==='show';
      const tools=`<div class="cardtools mt8"><span class="tgl ${on?'on':'off'}" onclick="toggleTgAll('vegas')">${on?t('ns.allShow'):t('ns.allHide')}</span>${tpAnnounceUI(g,'vegas')}</div>`;
      out+=`<div class="card tight"><table class="lb"><tr><th class="c-eye"></th><th class="c-pos">${t('col.rank')}</th><th>${t('col.team')}</th><th class="c-val">${t('vegas.total')}</th></tr>
        ${rows.map((r,i)=>{ const m=tgMasked('vegas',r.t.id);
          const nm = m ? '<span class="mask">？？？</span>' : esc(r.t.name);
          const val = m ? '<span class="mask">？</span>' : `<b>${r.v>0?'+':''}${r.v}</b>`;
          return `<tr class="rank"><td class="c-eye"><button class="eyebtn ${m?'off':'on'}" onclick="toggleTgRow('vegas','${r.t.id}')">${m?EYEOFF:EYE}</button></td><td class="c-pos">${posBadge(i+1,i===0)}</td><td class="nmc" style="text-align:left">${nm}</td><td class="c-val">${val}</td></tr>`; }).join('')}</table>
        <div class="muted mt6">${t('team.noteVegasHbh')}</div>${tools}</div>`; } }   // 勝ち点はホール勝敗数（team-points §3.3.2）・点差は独立集計のまま
  return out;
}

