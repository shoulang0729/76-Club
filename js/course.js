/* ============================ COURSE SETUP（コースタブ・§11.12 N） ============================ */
/* ホールのデータ（Par/隠しホール/ニアピン・ドラコン対象ホール）専用タブ。
   カードと関数は js/game.js から移動（マークアップ・保存ロジックは不変＝表示の置き場所のみ変更）。 */
function renderCourse(){
  const el=document.getElementById('view-course');
  const g=curGame();
  if(!g){ el.innerHTML=`<div class="empty">${t('msg.needGame')}</div>`; return; }

  let html = `<div class="card"><h2>${t('game.courseCard')}</h2>
    <div class="muted">${t('game.hiddenNote',{n:`<b id="hidCount">${g.hidden.filter(Boolean).length}</b>`})}</div>
    <div class="row" style="margin:8px 0"><button class="btn sec sm" onclick="randomHidden()">${t('game.random12')}</button>
      <button class="btn gray sm" onclick="clearHidden()">${t('btn.clear')}</button></div>
    ${(scNarrow()? [[0,9],[9,18]] : [[0,18]]).map(([s,e])=>courseGrid(g,s,e)).join('')}</div>`;

  html += `<div class="card"><h2>${t('game.npdcCard')}</h2>
    <div class="muted">${t('game.npdcNote')}</div>
    <div class="mt6">${g.par.map((_,i)=>{
      const np=g.prizes.niapinHoles.includes(i), dc=g.prizes.draconHoles.includes(i);
      return `<button class="holebtn ${np?'np':''} ${dc?'dc':''}" onclick="cyclePrize(${i})">${i+1}</button>`}).join('')}</div>
    <div class="muted" class="mt6">${t('game.npdcLocal')}</div></div>`;

  el.innerHTML=html;
}
function setPar(i,v){ curGame().par[i]=parseInt(v)||0; save(); renderCourse(); }
function toggleHidden(i){ const g=curGame(); g.hidden[i]=!g.hidden[i]; save(); document.getElementById('hidCount').textContent=g.hidden.filter(Boolean).length; }
/* 隠し12H＝ショート(Par3)2・ミドル(Par4)8・ロング(Par5)2（隠しPar合計48の標準新ペリア構成）。
   非標準コースは各グループ数でクリップし、不足はミドル→ロング→ショート順に補充（§11.1） */
function randomHidden(){ const g=curGame();
  const pick=(arr,n)=>arr.slice().sort(()=>Math.random()-0.5).slice(0,Math.max(0,n));
  const p3=[],p4=[],p5=[]; g.par.forEach((p,i)=>{ (p<=3?p3:p===4?p4:p5).push(i); });
  const sel=[...pick(p3,Math.min(2,p3.length)), ...pick(p4,Math.min(8,p4.length)), ...pick(p5,Math.min(2,p5.length))];
  [p4,p5,p3].forEach(grp=>{ pick(grp,grp.length).forEach(i=>{ if(sel.length<12 && !sel.includes(i)) sel.push(i); }); });
  g.hidden=Array(18).fill(false); sel.forEach(i=>g.hidden[i]=true); save(); renderCourse(); }
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
function cyclePrize(i){ const p=curGame().prizes;
  const np=p.niapinHoles.includes(i), dc=p.draconHoles.includes(i);
  p.niapinHoles=p.niapinHoles.filter(x=>x!==i); p.draconHoles=p.draconHoles.filter(x=>x!==i);
  if(!np&&!dc)p.niapinHoles.push(i); else if(np)p.draconHoles.push(i);
  save(); renderCourse(); }
