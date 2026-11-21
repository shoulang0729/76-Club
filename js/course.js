/* ============================ COURSE SETUP（コースタブ・§11.12 N） ============================ */
/* ホールのデータ（Par/隠しホール/ニアピン・ドラコン対象ホール）専用タブ。
   カードと関数は js/game.js から移動（マークアップ・保存ロジックは不変＝表示の置き場所のみ変更）。 */
function renderCourse(){
  const el=document.getElementById('view-course');
  const g=curGame();
  if(!g){ el.innerHTML=`<div class="empty">${t('msg.needGame')}</div>`; return; }

  clibSync(g);
  let html = clibCard(g);

  html += `<div class="card"><h2>${t('game.courseCard')}</h2>
    <div class="muted">${t('game.hiddenNote',{n:`<b id="hidCount">${g.hidden.filter(Boolean).length}</b>`})}</div>
    <div class="row" style="margin:8px 0"><button class="btn sec sm" onclick="randomHidden()">${t('game.random12')}</button>
      <button class="btn gray sm" onclick="clearHidden()">${t('btn.clear')}</button></div>
    ${(scNarrow()? [[0,9],[9,18]] : [[0,18]]).map(([s,e])=>courseGrid(g,s,e)).join('')}</div>`;

  /* NPDC は par から自動導出（Par3=NP / Par5=DC）＋ prizes.npdcOverride による手動上書き
     （2026-08-20-npdc-par.md §6 / 2026-09-12-npdc-manual-holes.md §9）。setPar・setNpdc→render で即時追従。
     手動で指定したホールには ＊ を付け、1件以上あるときだけ凡例行を出す。廃止フィールドは読まない。
     #184: ここは「現在の対象ホールの確認」専用（par 表の隣に置く価値があるため残す）。
     手動調整の操作 UI はコンペ設定タブの「ニアピン / ドラコン ホール」へ移設し、案内行だけを出す。 */
  const NP=niapinHolesOf(g), DC=draconHolesOf(g);
  const mk=h=>`${h+1}H${npdcManual(g,h)?'＊':''}`;
  const anyMan=g.par.some((p,h)=>npdcManual(g,h));
  html += `<div class="card"><h2>${t('game.npdcCard')}</h2>
    <div class="muted">${t('game.npdcNote')}</div>
    ${(NP.length||DC.length)?`
    <div class="mt6"><span class="pill e1">${t('term.niapin')}</span> ${NP.length?NP.map(mk).join('・'):'—'}</div>
    <div class="mt6"><span class="pill f" style="background:var(--danger-bg);color:var(--red)">${t('term.dracon')}</span> ${DC.length?DC.map(mk).join('・'):'—'}</div>`
    :`<div class="empty">${t('game.npdcNone')}</div>`}
    ${anyMan?`<div class="muted mt6">${t('npdc.manualMark')}</div>`:''}
    <div class="muted mt6">${t('npdc.editWhere')}</div>
    <div class="muted mt6">${t('game.npdcLocal')}</div></div>`;

  el.innerHTML=html;
}
function setPar(i,v){ curGame().par[i]=parseInt(v)||0; save(); renderCourse(); }
/* NPDC 対象ホールの手動上書き（2026-09-12-npdc-manual-holes.md §9.3）。保存内容・シグネチャは不変。
   #184: 操作 UI がコンペ設定タブへ移ったので、再描画は renderCourse() ではなく render()（＝表示中のタブだけ描く）。
   コンペ設定タブで操作しても select 群と「すべて自動に戻す」の結果が即反映され、コース側のピル一覧は
   タブに入った時点の render() で最新になる。<details> の開閉は gsSec の gsOpen 側で保持する（揮発・二重管理しない） */
function setNpdc(h,v){ const P=curGame().prizes;
  if(!P.npdcOverride) P.npdcOverride={};                  // 防御（migrate 前相当のデータでも落ちない）
  if(v==='auto') delete P.npdcOverride[h]; else P.npdcOverride[h]=v;   // 自動＝キーを削除（§4.1）
  save(); render(); }
function resetNpdc(){ curGame().prizes.npdcOverride={}; save(); render(); }   // 上書きを全破棄＝2026-08-20 と同じ状態
function toggleHidden(i){
  const g=curGame(), hidden=g.hidden.slice();
  hidden[i]=!hidden[i]; setManualHidden(g,hidden);
  const count=document.getElementById('hidCount');
  if(count) count.textContent=hidden.filter(Boolean).length;
}
/* 隠し12H＝前後半×パー帯で層化抽選: 各半分(1-9H/10-18H)から Par3×1・Par5×1・Par4×4 の計6ずつ。
   帯分類は par===3→P3 / par===4→P4 / par>=5→P5（Par6はP5扱い）/ par<3→未設定U。
   非標準コースは各帯 min(quota,n) でクリップし、不足は同じ半分の P4残→P5残→P3残→U 順に無作為補充して必ず各半6。
   シャッフルは Fisher–Yates（一様）。sort(()=>Math.random()-0.5) は非一様で Par4 帯内に偏りが出るため使わない
   （2026-08-20-hidden12-balance.md rev.2 §R2。true は常にちょうど12個・標準par72 の隠しPar合計は48） */
function hidden12Sample(holes,n){
  for(let i=0;i<n;i++){
    const j=i+Math.floor(Math.random()*(holes.length-i));
    [holes[i],holes[j]]=[holes[j],holes[i]];
  }
  return holes.slice(0,n);
}
function hidden12Frame(par,order){
  const picked=new Set(order);
  return [0,9].flatMap(start=>{
    const fixed=order.filter(i=>i>=start&&i<start+9);
    const candidates=hidden12Groups(par,start).flatMap(b=>{
      const available=b.holes.filter(i=>!picked.has(i));
      return hidden12Sample(available,b.count-(b.holes.length-available.length));
    });
    return fixed.concat(candidates);
  });
}
function pickHidden12(par){
  const holes=new Set(hidden12Frame(par,[]));
  return Array.from({length:18},(_,i)=>holes.has(i));
}
function setManualHidden(g,hidden){
  hidden12StopSpin();
  hidden12BeforeSave(state);
  delete g.hidden12Draw;
  g.hidden=hidden;
  save();
}
function randomHidden(){ const g=curGame(); setManualHidden(g,pickHidden12(g.par)); renderCourse(); }
function clearHidden(){ setManualHidden(curGame(),Array(18).fill(false)); renderCourse(); }

/* 大学対抗で行う共通隠し12H抽選。回転中の枠と開閉はメモリだけに置く。 */
let hidden12Spin=null, hidden12Generation=0, hidden12Game=null, hidden12Open=false;
const hidden12SavedHoles=new WeakMap();
function hidden12Signature(g){
  const ref=g.courseRef?HIDDEN12_REF_KEYS.map(k=>g.courseRef[k]):null;
  return JSON.stringify([g.hidden,g.par,ref,Object.hasOwn(g,'hidden12Draw'),g.hidden12Draw]);
}
function hidden12BeforeSave(s){
  const spin=hidden12Spin;
  if(spin && (s.currentGameId!==spin.game.id || !s.games.includes(spin.game) ||
    hidden12Signature(spin.game)!==spin.signature)) hidden12StopSpin();
  (s.games||[]).forEach(g=>{
    const holes=Array.isArray(g.hidden)?g.hidden.map(Boolean).join(','):'';
    if(hidden12SavedHoles.has(g) && hidden12SavedHoles.get(g)!==holes){
      const a=g.announced=g.announced||{};
      a.univMatch=false; a.teamNet=false;
    }
    hidden12SavedHoles.set(g,holes);
  });
}
if(typeof state!=='undefined') hidden12BeforeSave(state);

function hidden12Details(){ return document.getElementById('hidden12Roulette'); }
function hidden12OnScreen(g,card=hidden12Details()){
  return !!(card&&card.open&&hidden12Game===g&&curGame()===g&&!document.hidden&&
    activeTab==='result'&&resGrp==='team'&&resGame.team==='univ'&&chFormats(g).univMatch);
}
function hidden12Toggle(card){
  if(card!==hidden12Details()) return;
  hidden12Open=card.open;
  if(!card.open) hidden12StopSpin();
}
function hidden12StopSpin(){
  const spin=hidden12Spin;
  if(!spin) return;
  clearTimeout(spin.timer);
  hidden12Spin=null;
  const card=hidden12Details();
  if(card&&hidden12Game===spin.game){
    const view=hidden12View(spin.game);
    card.querySelector('summary').innerHTML=hidden12Summary(view);
    card.querySelector('.h12-grid').innerHTML=hidden12Slots(spin.game,view.order,null);
    card.querySelector('.h12-controls').innerHTML=hidden12Controls(view.status,null);
  }
}
function hidden12SpinCurrent(spin){
  return hidden12Spin===spin && hidden12OnScreen(spin.game) && hidden12Signature(spin.game)===spin.signature;
}
function hidden12Tick(spin){
  if(hidden12Spin!==spin) return;
  if(!hidden12SpinCurrent(spin)){ hidden12StopSpin(); return; }
  const g=spin.game, order=g.hidden12Draw.order, card=hidden12Details();
  spin.frame=hidden12Frame(g.par,order);
  card.querySelector('.h12-grid').innerHTML=hidden12Slots(g,order,spin.frame);
  card.querySelector('.h12-stop').setAttribute('aria-disabled',Date.now()<spin.readyAt);
  spin.timer=setTimeout(()=>hidden12Tick(spin),100);
}
function hidden12ResetData(g){
  // 未保存のコンペでも、置換前の隠しホールを記録する。
  hidden12BeforeSave(state);
  const ref=g.courseRef;
  g.hidden=Array(18).fill(false);
  g.hidden12Draw={version:1,order:[],sourcePar:g.par.slice(),
    sourceCourseRef:ref?{courseId:ref.courseId,outId:ref.outId,inId:ref.inId}:null};
  save();
}
function hidden12Start(button){
  const g=curGame(), card=hidden12Details();
  if(!hidden12OnScreen(g,card)||!card.contains(button)||hidden12Spin) return;
  const status=hidden12Status(g);
  if(status.active&&(!status.valid||status.complete)) return;
  if(!status.active) hidden12ResetData(g);
  if(!hidden12Status(g).valid){ renderResult(); return; }
  const order=g.hidden12Draw.order;
  const spin={game:g, generation:++hidden12Generation, signature:hidden12Signature(g),
    frame:hidden12Frame(g.par,order), timer:null, readyAt:0};
  hidden12Spin=spin;
  hidden12Open=true;
  renderResult();
  spin.timer=setTimeout(()=>hidden12Tick(spin),100);
}
function hidden12CommitSpin(generation,step){
  const spin=hidden12Spin;
  if(!spin||spin.generation!==generation) return;
  if(!hidden12SpinCurrent(spin)){ hidden12StopSpin(); renderResult(); return; }
  const g=spin.game, order=g.hidden12Draw.order;
  if(step!==order.length||Date.now()<spin.readyAt) return;
  const hole=spin.frame.find(i=>!g.hidden[i]);
  if(hole===undefined) return;
  const keepFocus=hidden12Details().querySelector('.h12-stop')===document.activeElement;
  order.push(hole); g.hidden[hole]=true; spin.signature=hidden12Signature(g);
  spin.readyAt=Date.now()+250;
  save();
  if(order.length===12) hidden12StopSpin();
  renderResult();
  if(keepFocus){
    const stop=hidden12Details()?.querySelector('.h12-stop');
    if(stop) stop.focus({preventScroll:true});
  }
}
function hidden12Reset(button){
  const g=curGame(), card=hidden12Details();
  if(!hidden12OnScreen(g,card)||!card.contains(button)||!hidden12Status(g).active) return;
  hidden12StopSpin();
  hidden12ResetData(g);
  renderResult();
}
function hidden12View(g){
  const status=hidden12Status(g), draw=g.hidden12Draw;
  const changed=status.active&&!status.valid&&draw&&hidden12Status({
    ...g, par:draw.sourcePar, courseRef:draw.sourceCourseRef
  }).valid;
  return {status,changed,order:status.valid||changed?draw.order:[]};
}
function hidden12Slots(g,order,frame){
  const link=clibLinked(g), fixed=new Set(order);
  const next=frame?.find(i=>!fixed.has(i));
  return [0,9].map((start,side)=>{
    const half=side?'IN':'OUT';
    const nine=link?clibNineLabel(link.c,side?link.i:link.o):'';
    const title=esc(nine?half+' '+nine:half);
    const holes=frame?frame.slice(side*6,side*6+6):order.filter(i=>i>=start&&i<start+9);
    const slots=Array.from({length:6},(_,i)=>{
      const h=holes[i], cls=fixed.has(h)?' fixed':h===undefined?'':' spinning'+(h===next?' next':'');
      const label=h===undefined?'—':nine?title+(h-start+1):title+' '+(h+1);
      return `<div class="h12-slot${cls}"><strong class="h12-hole">${label}</strong>
        <small class="h12-par">${h===undefined?'':'Par '+esc(String(g.par[h]??''))}</small></div>`;
    }).join('');
    return `<div class="h12-line"><div class="h12-label">${title}</div>${slots}</div>`;
  }).join('');
}
function hidden12Controls(status,spin){
  const start=status.active?(status.count?t('h12.resume'):t('h12.start')):status.count?t('h12.replace'):t('h12.start');
  const main=spin
    ? `<button class="btn gold sm h12-stop" aria-disabled="${Date.now()<spin.readyAt}" onclick="hidden12CommitSpin(${spin.generation},${status.count})">${t('h12.stop')}</button>`
    : status.active&&(!status.valid||status.complete)?'':`<button class="btn gold sm" onclick="hidden12Start(this)">${start}</button>`;
  const reset=status.active?`<button class="btn gray sm" onclick="hidden12Reset(this)">${t('h12.reset')}</button>`:'';
  return main+reset;
}
function hidden12Summary({status,changed}){
  const statusText=status.active&&!status.valid ? (changed?t('h12.sourceChanged'):t('h12.invalid'))
    : status.complete?t('status.fixed'):status.active?t('h12.progress',{n:status.count}):'';
  const tag=statusText?`<span class="tag h12-summary-status${status.complete?'':' tagtie'}">${statusText}</span>`:'';
  return t('h12.title')+' '+tag;
}
function renderHidden12Roulette(g){
  if(hidden12Game!==g){ hidden12StopSpin(); hidden12Game=g; hidden12Open=false; }
  if(hidden12Spin&&hidden12Signature(g)!==hidden12Spin.signature) hidden12StopSpin();
  const view=hidden12View(g), {status,order}=view, spin=hidden12Spin;
  return `<details id="hidden12Roulette" class="card h12-roulette"${hidden12Open?' open':''} ontoggle="hidden12Toggle(this)">
    <summary>${hidden12Summary(view)}</summary><div class="in">
      <div class="muted h12-note">${t('h12.note')}</div>
      <div class="h12-grid">${hidden12Slots(g,order,spin?.frame)}</div>
      <div class="cardtools h12-controls">${hidden12Controls(status,spin)}</div>
      ${status.active?`<div class="muted h12-note">${t('h12.resetConfirm')}</div>`:''}
    </div></details>`;
}
/* コース設定のホール表（§11.12 D）: 狭幅は OUT(1-9)/IN(10-18) の2段、iPad/PC は18列1段。
   合計列は区間で決まる（前半=OUT小計 / 後半=IN小計＋合計、1段時は合計のみ＝従来どおり）。 */
function courseGrid(g,s,e){
  const H=[]; for(let i=s;i<e;i++)H.push(i);
  const one=(s===0&&e===18);
  const cols = one ? [{label:t('col.total'), f:a=>sum(a,0,18)}]
    : (s===0 ? [{label:'OUT', f:a=>sum(a,0,9)}]
             : [{label:'IN', f:a=>sum(a,9,18)}, {label:t('col.total'), f:a=>sum(a,0,18)}]);
  return `<div class="scroll"><table class="scoregrid">
      <tr><th class="name">H</th>${H.map(i=>`<th class="${g.hidden[i]?'hidden-h':''}">${i+1}</th>`).join('')}${cols.map(c=>`<th class="sum">${c.label}</th>`).join('')}</tr>
      <tr><td class="name">Par</td>${H.map(i=>`<td class="${g.hidden[i]?'hidden-h':''}"><input type="number" min="3" max="6" value="${g.par[i]}" onchange="setPar(${i},this.value)"></td>`).join('')}${cols.map(c=>`<td class="sum">${c.f(g.par)}</td>`).join('')}</tr>
      <tr><td class="name">${t('game.rowHidden')}</td>${H.map(i=>`<td class="${g.hidden[i]?'hidden-h':''}"><input type="checkbox" ${g.hidden[i]?'checked':''} onchange="toggleHidden(${i})"></td>`).join('')}${cols.map(()=>`<td class="sum">-</td>`).join('')}</tr>
    </table></div>`;
}
/* ============================ COURSE LIBRARY（コースライブラリ・2026-09-06-course-master.md） ============================ */
/* ゴルフ場を「9ホールのコース（ナイン）の集合」として state.courses に保存し、OUT/IN の2ナインを選んで
   g.par（18要素のフラット配列）へ*コピー方式*で展開する。計算(§3)は g.par を読むだけなので非接触（同書 §7）。
   選択状態は揮発の module 変数（localStorage キーは増やさない・同書 §6）。 */
let clibSel = { courseId:null, outId:null, inId:null };   // 読込元の選択（揮発）
let clibSaveTo = '';                                      // 保存先ゴルフ場ID（''＝新しいゴルフ場・揮発）
let clibGid = null;                                       // 選択状態を紐づけているゲームID（切替時に選択をリセット）
let clibOpen = false;                                     // 管理 <details> の開閉（揮発・既定は閉じ・同書 §8.5）

/* 唯一の変換ロジック（同書 §5）。必ず length 18 になる（読込側ガードと migrate 正規化で二重に担保） */
function clibExpand(out, inn){ return out.par.slice(0,9).concat(inn.par.slice(0,9)); }

function clibNineLabel(c,n){ return n.name || t('clib.nineNo',{n:c.nines.indexOf(n)+1}); }
function clibVenueLabel(c){ return c.name || t('clib.untitled'); }
function clibToday(){ return new Date().toISOString().slice(0,10); }
/* g.courseRef を解決（マスタ削除後は null＝未リンク扱い。dangling でも無害・同書 §4.3） */
function clibLinked(g){
  const r = g && g.courseRef; if(!r) return null;
  const c = state.courses.find(x=>x.id===r.courseId); if(!c) return null;
  const o = c.nines.find(n=>n.id===r.outId), i = c.nines.find(n=>n.id===r.inId);
  if(!o||!i) return null;
  return { c, o, i, canUpdate:r.outId!==r.inId,
    label:t('clib.combo',{course:clibVenueLabel(c), out:clibNineLabel(c,o), in:clibNineLabel(c,i)}) };
}
/* 揮発の選択状態を現在のデータに合わせて整合させる（未選択なら g.courseRef から復元・同書 §6） */
function clibSync(g){
  const has = id => state.courses.some(c=>c.id===id);
  /* コンペを切り替えたら選択をリセット（保存先の既定は「新しいゴルフ場」＝§8.3）。直後に g.courseRef から復元する */
  if(g && g.id!==clibGid){ clibGid=g.id; clibSel={courseId:null,outId:null,inId:null}; clibSaveTo=''; }
  if(clibSel.courseId && !has(clibSel.courseId)) clibSel={courseId:null,outId:null,inId:null};
  if(!clibSel.courseId){
    const r = g && g.courseRef;
    if(r && has(r.courseId)) clibSel={courseId:r.courseId, outId:r.outId, inId:r.inId};
  }
  const c = state.courses.find(x=>x.id===clibSel.courseId);
  if(c){
    if(!c.nines.some(n=>n.id===clibSel.outId)) clibSel.outId = c.nines[0]?.id || null;
    if(!c.nines.some(n=>n.id===clibSel.inId))  clibSel.inId  = (c.nines[1]||c.nines[0])?.id || null;
  }else{ clibSel.outId=null; clibSel.inId=null; }
  if(clibSaveTo && !has(clibSaveTo)) clibSaveTo='';
}
/* カード（コースタブの先頭・同書 §8.1）。既存クラスのみ使用＝新規 CSS ゼロ */
function clibCard(g){
  const cs = state.courses.slice().sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
  const c = state.courses.find(x=>x.id===clibSel.courseId) || null;
  const nineOpts = sel => c ? c.nines.map(n=>`<option value="${n.id}" ${n.id===sel?'selected':''}>${esc(clibNineLabel(c,n))}</option>`).join('') : '';
  const venueOpts = sel => cs.map(x=>`<option value="${x.id}" ${x.id===sel?'selected':''}>${esc(clibVenueLabel(x))}${x.note?' / '+esc(x.note):''}</option>`).join('');
  const L = clibLinked(g);
  let h = `<div class="card"><h2>${t('clib.card')}</h2>
    <div class="muted">${t('clib.note')}</div>
    <div class="row mt8"><div class="fx1"><label class="fl">${t('clib.venue')}</label>
      <select onchange="clibPickVenue(this.value)"><option value="">${t('game.selectPh')}</option>${venueOpts(clibSel.courseId)}</select></div></div>
    <div class="row mt6">
      <div class="fx1"><label class="fl">${t('clib.outNine')}</label><select onchange="clibPickNine('out',this.value)">${nineOpts(clibSel.outId)}</select></div>
      <div class="fx1"><label class="fl">${t('clib.inNine')}</label><select onchange="clibPickNine('in',this.value)">${nineOpts(clibSel.inId)}</select></div>
      <button class="btn sm" onclick="clibLoad()">${t('clib.load')}</button>
    </div>`;
  if(L) h += `<div class="muted mt6">${t('clib.linked',{name:esc(L.label)})}</div>`;
  h += `<div class="muted mt6">${t('clib.hiddenHint')}</div>
    <div class="row mt8"><div class="fx1" style="min-width:200px"><label class="fl">${t('clib.saveTo')}</label>
      <select onchange="clibPickTarget(this.value)"><option value="">${t('clib.newVenue')}</option>${venueOpts(clibSaveTo)}</select></div>
      <button class="btn sec sm" onclick="clibSave()">${t('clib.save')}</button>
      ${(L&&L.canUpdate)?`<button class="btn gray sm" onclick="clibUpdate()">${t('clib.update')}</button>`:''}
    </div>
    <div class="muted mt6">${t('clib.saveNote')}</div>`;
  if(L && !L.canUpdate) h += `<div class="muted mt6">${t('clib.updateNg')}</div>`;
  h += clibManage(cs);
  return h+`</div>`;
}
/* 管理（同書 §8.5）: ゴルフ場ごとのブロック＋ナイン一覧。名前／メモ／ナイン名はインライン編集、削除は confirm 付き。
   パーの編集はここでは提供しない（コンペに読み込む→既存のパー表で直す→上書き保存）。既定は閉じ・開閉は揮発。 */
function clibManage(cs){
  let h = `<details class="mt8" ${clibOpen?'open':''} ontoggle="clibToggleManage(this.open)"><summary>${t('clib.manage')}</summary><div class="in">`;
  if(!cs.length) return h+`<div class="empty">${t('clib.empty')}</div></div></details>`;
  h += cs.map(c=>`<div class="mt8">
      <div class="row">
        <div class="fx1"><label class="fl">${t('clib.colName')}</label>
          <input value="${esc(c.name)}" placeholder="${t('clib.untitled')}" onchange="clibSetVenue('${c.id}','name',this.value)"></div>
        <div class="fx1"><label class="fl">${t('clib.colNote')}</label>
          <input value="${esc(c.note)}" placeholder="${t('clib.notePh')}" onchange="clibSetVenue('${c.id}','note',this.value)"></div>
        <button class="btn danger sm" onclick="clibDelVenue('${c.id}')">×</button>
      </div>
      <div class="muted mt6">${t('clib.colUpdated')} ${esc(c.updatedAt)}</div>
      <div class="fl mt6">${t('clib.ninesTitle')}</div>
      <div class="scroll"><table><tr><th>${t('clib.colName')}</th><th>${t('clib.colPar')}</th><th></th></tr>
        ${c.nines.map(n=>`<tr>
          <td><input value="${esc(n.name)}" placeholder="${t('clib.ninePh')}" onchange="clibSetNine('${c.id}','${n.id}','name',this.value)"></td>
          <td>${sum(n.par,0,9)}</td>
          <td><button class="btn danger sm" onclick="clibDelNine('${c.id}','${n.id}')">×</button></td>
        </tr>`).join('')}</table></div>
    </div>`).join('');
  return h+`</div></details>`;
}
function clibToggleManage(open){ clibOpen=!!open; }   // localStorage には保存しない（表示状態キーを増やさない）
/* インライン編集（同書 §8.5）: updatedAt は更新しない（パーの版とは別物）。読込済みコンペの g.course は追随しない（コピー方式・§8.6） */
function clibSetVenue(cid,field,val){
  const c=state.courses.find(x=>x.id===cid); if(!c) return;
  c[field]=(val||'').trim(); save(); renderCourse();
}
function clibSetNine(cid,nid,field,val){
  const c=state.courses.find(x=>x.id===cid); const n=c&&c.nines.find(y=>y.id===nid); if(!n) return;
  n[field]=(val||'').trim(); save(); renderCourse();
}
/* 削除（同書 §8.5）: ゲーム側は何も壊れない（g.par は値コピー済み）。dangling な courseRef は未リンク扱いになるだけ */
function clibDelNine(cid,nid){
  const c=state.courses.find(x=>x.id===cid); const n=c&&c.nines.find(y=>y.id===nid); if(!n) return;
  if(!confirm(t('clib.cfmDelNine',{name:clibNineLabel(c,n)}))) return;
  c.nines=c.nines.filter(y=>y.id!==nid);
  save(); renderCourse(); toast(t('clib.deletedT'));
}
function clibDelVenue(cid){
  const c=state.courses.find(x=>x.id===cid); if(!c) return;
  if(!confirm(t('clib.cfmDelVenue',{name:clibVenueLabel(c)}))) return;
  state.courses=state.courses.filter(x=>x.id!==cid);
  save(); renderCourse(); toast(t('clib.deletedT'));
}
function clibPickVenue(id){
  const c = state.courses.find(x=>x.id===id);
  clibSel = c ? { courseId:c.id, outId:c.nines[0]?.id||null, inId:(c.nines[1]||c.nines[0])?.id||null }
              : { courseId:null, outId:null, inId:null };
  renderCourse();
}
function clibPickNine(which,id){ if(which==='out') clibSel.outId=id||null; else clibSel.inId=id||null; }
function clibPickTarget(id){ clibSaveTo=id||''; }
/* 読込（同書 §8.2）: 書き込むのは g.par / g.course / g.courseRef の3つだけ。g.hidden は絶対に触らない */
function clibLoad(){
  const g=curGame(); if(!g) return;
  const c=state.courses.find(x=>x.id===clibSel.courseId); if(!c) return;
  const o=c.nines.find(n=>n.id===clibSel.outId), i=c.nines.find(n=>n.id===clibSel.inId);
  if(!o||!i) return;
  if(o.par.length!==9 || i.par.length!==9) return toast(t('toast.badFile'));   // ★読込時ガード（g.par を必ず18要素に保つ）
  const label=t('clib.combo',{course:clibVenueLabel(c), out:clibNineLabel(c,o), in:clibNineLabel(c,i)});
  if(!confirm(t('clib.cfmLoad',{name:label}))) return;
  g.par=clibExpand(o,i);
  g.course=label;
  g.courseRef={ courseId:c.id, outId:o.id, inId:i.id };
  save(); render(); toast(t('clib.loadedT'));
}
/* 保存（同書 §8.3）: 現在の18Hを前半9／後半9に割る。既存ゴルフ場では par 一致のナインを再利用＝ナインが増殖しない */
function clibSave(){
  const g=curGame(); if(!g) return;
  const front=g.par.slice(0,9), back=g.par.slice(9,18);
  if(front.length!==9 || back.length!==9) return toast(t('toast.badFile'));
  let c=state.courses.find(x=>x.id===clibSaveTo);
  if(!c){
    c={ id:uid(), name:(g.course||'').trim()||t('clib.untitled'),
        nines:[{id:uid(),name:'OUT',par:front},{id:uid(),name:'IN',par:back}], note:'', updatedAt:clibToday() };
    state.courses.push(c);
    g.courseRef={ courseId:c.id, outId:c.nines[0].id, inId:c.nines[1].id };
  }else{
    const findNine = par => c.nines.find(n=> n.par.length===9 && n.par.every((v,k)=>v===par[k]));
    const addNine  = par => { const n={id:uid(),name:'',par:par}; c.nines.push(n); return n; };
    const o = findNine(front) || addNine(front);
    const i = findNine(back)  || addNine(back);
    c.updatedAt=clibToday();
    g.courseRef={ courseId:c.id, outId:o.id, inId:i.id };
  }
  clibSel={ courseId:g.courseRef.courseId, outId:g.courseRef.outId, inId:g.courseRef.inId };
  clibSaveTo=c.id;
  save(); renderCourse(); toast(t('clib.savedT'));
}
/* 上書き保存（同書 §8.4）: リンク中かつ OUT≠IN のときだけ。name/note は壊さない */
function clibUpdate(){
  const g=curGame(); const L=clibLinked(g);
  if(!L || !L.canUpdate) return;
  if(!confirm(t('clib.cfmUpdate',{name:L.label}))) return;
  L.o.par=g.par.slice(0,9); L.i.par=g.par.slice(9,18);
  L.c.updatedAt=clibToday();
  save(); renderCourse(); toast(t('clib.updatedT'));
}
