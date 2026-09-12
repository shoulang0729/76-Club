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
     （2026-08-20-npdc-par.md §6 / 2026-09-12-npdc-manual-holes.md §9）。setPar・setNpdc→renderCourse で即時追従。
     手動で指定したホールには ＊ を付け、1件以上あるときだけ凡例行を出す。廃止フィールドは読まない */
  const NP=niapinHolesOf(g), DC=draconHolesOf(g);
  const mk=h=>`${h+1}H${npdcManual(g,h)?'＊':''}`;
  const anyMan=g.par.some((p,h)=>npdcManual(g,h));
  const npAuto=h=>{ const p=g.par[h]; return p===3?t('term.niapin'):p===5?t('term.dracon'):'—'; };
  const npCur=h=>npdcManual(g,h)?npdcOv(g)[h]:'auto';   // 列挙外の値は 'auto' 扱い（npdcKindOf の防御と同じ）
  const npOpt=(h,v,label)=>`<option value="${v}"${npCur(h)===v?' selected':''}>${label}</option>`;
  const npRows=g.par.map((p,h)=>`<div class="pz2-row"><span class="pz-set">${h+1}H</span>`
    +`<select onchange="setNpdc(${h},this.value)">`
    +npOpt(h,'auto',t('npdc.optAuto',{x:npAuto(h)}))+npOpt(h,'np',t('term.niapin'))
    +npOpt(h,'dc',t('term.dracon'))+npOpt(h,'none',t('npdc.optOff'))
    +`</select></div>`).join('');
  html += `<div class="card"><h2>${t('game.npdcCard')}</h2>
    <div class="muted">${t('game.npdcNote')}</div>
    ${(NP.length||DC.length)?`
    <div class="mt6"><span class="pill e1">${t('term.niapin')}</span> ${NP.length?NP.map(mk).join('・'):'—'}</div>
    <div class="mt6"><span class="pill f" style="background:var(--danger-bg);color:var(--red)">${t('term.dracon')}</span> ${DC.length?DC.map(mk).join('・'):'—'}</div>`
    :`<div class="empty">${t('game.npdcNone')}</div>`}
    ${anyMan?`<div class="muted mt6">${t('npdc.manualMark')}</div>`:''}
    <details class="mt8" ${npdcEditOpen?'open':''} ontoggle="npdcEditToggle(this.open)"><summary>${t('npdc.editTitle')}</summary><div class="in">
      <div class="muted">${t('npdc.editNote')}</div>
      <div class="pz2 mt6">${npRows}</div>
      <div class="mt8"><button class="btn gray sm" onclick="resetNpdc()">${t('npdc.resetAuto')}</button></div>
    </div></details>
    <div class="muted mt6">${t('game.npdcLocal')}</div></div>`;

  el.innerHTML=html;
}
function setPar(i,v){ curGame().par[i]=parseInt(v)||0; save(); renderCourse(); }
/* NPDC 対象ホールの手動上書き（2026-09-12-npdc-manual-holes.md §9.3）。
   <details> の開閉は揮発変数で保持する（renderCourse が innerHTML を作り直すため。clibOpen と同型・localStorage 非保存） */
let npdcEditOpen=false;
function npdcEditToggle(open){ npdcEditOpen=!!open; }
function setNpdc(h,v){ const P=curGame().prizes;
  if(!P.npdcOverride) P.npdcOverride={};                  // 防御（migrate 前相当のデータでも落ちない）
  if(v==='auto') delete P.npdcOverride[h]; else P.npdcOverride[h]=v;   // 自動＝キーを削除（§4.1）
  save(); renderCourse(); }
function resetNpdc(){ curGame().prizes.npdcOverride={}; save(); renderCourse(); }   // 上書きを全破棄＝2026-08-20 と同じ状態
function toggleHidden(i){ const g=curGame(); g.hidden[i]=!g.hidden[i]; save(); document.getElementById('hidCount').textContent=g.hidden.filter(Boolean).length; }
/* 隠し12H＝前後半×パー帯で層化抽選: 各半分(1-9H/10-18H)から Par3×1・Par5×1・Par4×4 の計6ずつ。
   帯分類は par===3→P3 / par===4→P4 / par>=5→P5（Par6はP5扱い）/ par<3→未設定U。
   非標準コースは各帯 min(quota,n) でクリップし、不足は同じ半分の P4残→P5残→P3残→U 順に無作為補充して必ず各半6。
   シャッフルは Fisher–Yates（一様）。sort(()=>Math.random()-0.5) は非一様で Par4 帯内に偏りが出るため使わない
   （2026-08-20-hidden12-balance.md rev.2 §R2。true は常にちょうど12個・標準par72 の隠しPar合計は48） */
function pickHidden12(par){
  const shuf=a=>{ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
  const pick=(arr,n)=>shuf(arr).slice(0,Math.max(0,n));
  const hidden=Array(18).fill(false);
  [0,9].forEach(s=>{
    const p3=[],p4=[],p5=[],u=[];
    for(let i=s;i<s+9;i++){ const p=par[i]; (p===3?p3:p===4?p4:p>=5?p5:u).push(i); }
    const sel=[...pick(p3,Math.min(1,p3.length)), ...pick(p5,Math.min(1,p5.length)), ...pick(p4,Math.min(4,p4.length))];
    [p4,p5,p3,u].forEach(grp=>{ pick(grp,grp.length).forEach(i=>{ if(sel.length<6 && !sel.includes(i)) sel.push(i); }); });
    sel.forEach(i=>hidden[i]=true);
  });
  return hidden;
}
function randomHidden(){ const g=curGame(); g.hidden=pickHidden12(g.par); save(); renderCourse(); }
function clearHidden(){ curGame().hidden=Array(18).fill(false); save(); renderCourse(); }
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
