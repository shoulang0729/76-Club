/* Honest John: independent raw-score calculation; no display state is persisted.
   Contract: docs/handoff/2026-11-17-tosho-event-support.md §4. */
function newHonestJohn(){ return {hidden:Array(18).fill(false),declarations:{}}; }
// View provenance is volatile: HJ is revealed by its own announcement, not other events' hole controls.
const hjViewSources=new WeakMap();
function hjRawGame(g){ return hjViewSources.get(g)||g; }
function hjHiddenShape(g){ const h=g.honestJohn&&g.honestJohn.hidden;
  return Array.isArray(h)&&h.length===18&&Array.from(h).every(v=>typeof v==='boolean'); }
function hjHiddenValid(g){ return hjHiddenShape(g)&&g.honestJohn.hidden.filter(Boolean).length===4; }
function hjNumber(v){ return typeof v==='number'&&Number.isFinite(v)&&v>0; }
function hjDeclaration(g,pid){ const d=g.honestJohn&&g.honestJohn.declarations;
  if(!d||typeof d!=='object'||Array.isArray(d)||!Object.prototype.hasOwnProperty.call(d,pid))return null;
  const v=d[pid]; return typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null; }
function hjPlayer(g,pid){
  const sc=(g.scores||{})[pid], declared=hjDeclaration(g,pid);
  const scoresValid=Array.isArray(sc)&&sc.length===18&&Array.from(sc).every(hjNumber);
  const hiddenValid=hjHiddenValid(g);
  const parValid=hiddenValid&&Array.isArray(g.par)&&g.par.length===18&&
    g.honestJohn.hidden.every((v,i)=>!v||hjNumber(g.par[i]));
  const raw=scoresValid?sc.reduce((s,v)=>s+v,0):null;
  const adjusted=scoresValid&&parValid?sc.reduce((s,v,i)=>s+(g.honestJohn.hidden[i]?g.par[i]:v),0):null;
  const valid=adjusted!==null&&declared!==null&&Number.isFinite(adjusted)&&Number.isFinite(raw);
  const difference=valid?adjusted-declared:null;
  const penalty=valid?Math.max(difference,0)*10+Math.max(-difference,0)*30:null;
  const ready=valid&&Number.isFinite(penalty);
  return {pid,valid:ready,ready,pending:!ready,scoresValid,hiddenValid,parValid,
    raw,adjusted,declared,difference,penalty:ready?penalty:null};
}
function hjStanding(g){
  const rows=teamsOf(g).map(t=>{
    const members=teamMembers(g,t).map(pid=>hjPlayer(g,pid));
    const ready=members.every(p=>p.valid), total=ready?members.reduce((s,p)=>s+p.penalty,0):null;
    return {t,members,ready:ready&&Number.isFinite(total),total:Number.isFinite(total)?total:null,rank:null};
  });
  const ready=rows.length>0&&rows.every(r=>r.ready);
  if(ready){
    rows.sort((a,b)=>a.total-b.total);
    rows.forEach((r,i)=>{ r.rank=i&&r.total===rows[i-1].total?rows[i-1].rank:i+1; });
  }
  return {rows,ready};
}

/* Only explicit edits repair malformed settings; calculation/rendering never do. */
function hjEditData(g){
  if(!g.honestJohn||typeof g.honestJohn!=='object'||Array.isArray(g.honestJohn))g.honestJohn=newHonestJohn();
  if(!g.honestJohn.declarations||typeof g.honestJohn.declarations!=='object'||Array.isArray(g.honestJohn.declarations))g.honestJohn.declarations={};
  return g.honestJohn;
}
function hjChanged(){ const g=curGame(); (g.announced=g.announced||{}).honestJohn=false; save(); render(); }
function hjSetHidden(i,on){
  const g=curGame(); if(!g||!Number.isInteger(i)||i<0||i>=18)return;
  if(!hjHiddenShape(g)){ toast(t('hj.chooseFour')); renderBasic(); return; }
  const h=g.honestJohn.hidden;
  if(on&&!h[i]&&h.filter(Boolean).length>=4){ toast(t('hj.chooseFour')); renderBasic(); return; }
  h[i]=!!on; hjChanged();
}
function hjRandomHidden(){
  const g=curGame(); if(!g)return;
  const indices=Array.from({length:18},(_,i)=>i);
  for(let i=17;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [indices[i],indices[j]]=[indices[j],indices[i]]; }
  const h=Array(18).fill(false); indices.slice(0,4).forEach(i=>h[i]=true);
  hjEditData(g).hidden=h; hjChanged();
}
function hjClearHidden(){ const g=curGame(); if(!g)return; hjEditData(g).hidden=Array(18).fill(false); hjChanged(); }
function hjSetDeclaration(index,value){
  const g=curGame(); if(!g||!Number.isInteger(index))return;
  const pid=g.participants[index]; if(!state.players.some(p=>p.id===pid))return;
  const text=String(value).trim(), n=Number(text);
  if(text!==''&&(!Number.isFinite(n)||n<0)){ toast(t('hj.invalidDeclaration')); render(); return; }
  const d=hjEditData(g).declarations;
  if(text==='')delete d[pid]; else Object.defineProperty(d,pid,{value:n,writable:true,enumerable:true,configurable:true});
  hjChanged();
}
function hjDeclarationsHtml(g){
  return `<h3>${t('hj.declarations')}</h3><div class="muted">${t('hj.declarationNote')}</div>`+
    g.participants.map((pid,i)=>{ const p=state.players.find(p=>p.id===pid); if(!p)return '';
      const v=hjDeclaration(g,pid);
      return `<div class="ptsrow"><span>${esc(p.name)}</span><span class="ptsedit"><input type="number" min="0" step="any" aria-label="${esc(p.name)} ${t('hj.declared')}" value="${v===null?'':v}" onchange="hjSetDeclaration(${i},this.value)"></span></div>`;
    }).join('');
}
function hjSettingsHtml(g){
  const h=hjHiddenShape(g)?g.honestJohn.hidden:Array(18).fill(false);
  const count=h.filter(Boolean).length;
  return gsSec('honestJohn',t('term.honestJohn'),`<div class="muted">${t('hj.hiddenNote')}</div>
    <div class="row mt6"><button class="btn sec sm" onclick="hjRandomHidden()">${t('hj.randomFour')}</button>
      <button class="btn gray sm" onclick="hjClearHidden()">${t('btn.clear')}</button><span class="tag">${t('hj.selected',{n:count})}</span></div>
    <div class="fmtgrid mt8">${h.map((v,i)=>`<label><input type="checkbox" ${v?'checked':''} onchange="hjSetHidden(${i},this.checked)"> ${i+1}</label>`).join('')}</div>
    ${hjHiddenValid(g)?'':`<div class="muted mt6" style="color:var(--red)">${t('hj.chooseFour')}</div>`}
    ${hjDeclarationsHtml(g)}<div class="muted mt8">${t('hj.rule')}</div>`);
}
function hjStatus(p){
  const issues=[];
  if(!p.scoresValid)issues.push(t('hj.missingScores'));
  if(p.declared===null)issues.push(t('hj.missingDeclaration'));
  if(!p.hiddenValid)issues.push(t('hj.chooseFour'));
  else if(!p.parValid)issues.push(t('hj.invalidPar'));
  return issues.length?issues.join(' / '):t('hj.ready');
}
function renderTeamHonest(g){
  const st=hjStanding(g), ann=!!(g.announced||{}).honestJohn;
  const eligible=st.ready&&st.rows.length>=2, visible=ann&&eligible;
  if(!visible){ const order=new Map(teamsOf(g).map((t,i)=>[t.id,i])); st.rows.sort((a,b)=>order.get(a.t.id)-order.get(b.t.id)); }
  const ev=visible?teamWinPoints(g).events.find(e=>e.key==='honestJohn'):null;
  const mask='<span class="mask">···</span>';
  const hero=st.rows.map(r=>{
    const winner=visible&&r.rank===1;
    const tied=st.rows.filter(x=>x.rank===1).length>1;
    const tag=winner?`<span class="tag ${tied?'tagtie':'tagwin'}">${tied?t('custom.tie'):t('custom.win')}</span>`:'';
    const share=winner&&ev?`<span class="tag">${t('team.winpt')} +${tpShare(ev.w,ev.winners.length)}</span>`:'';
    return `<span class="rl-st tp-nd tp-ovh"><span class="rl-st-team" style="color:${tmColor(r.t.name)}">${esc(r.t.name)}</span>
      <span class="rl-st-h">${visible?r.total:mask}</span><span class="tp-nd-sub">${r.ready?t('hj.ready'):t('team.pending')}</span>
      ${visible?`<span class="tp-nd-tagrow">${posBadge(r.rank,winner)}${tag}${share}</span>`:''}</span>`;
  }).join('');
  const columns=['col.team','col.player','hj.declared','hj.raw','hj.adjusted','hj.difference','hj.penalty','hj.status'];
  const rows=st.rows.flatMap(r=>r.members.map(p=>{
    const person=state.players.find(x=>x.id===p.pid);
    const nums=[p.declared,p.raw,p.adjusted,p.difference,p.penalty];
    return `<tr><td class="tal">${esc(r.t.name)}</td><td class="nmc">${esc(person.name)}</td>${nums.map(v=>`<td>${visible?v:mask}</td>`).join('')}<td>${hjStatus(p)}</td></tr>`;
  })).join('');
  const controls=eligible||ann?tpAnnounceUI(g,'honestJohn'):`<button class="btn gray sm" disabled>${t('team.announce')}</button>`;
  const note=!st.rows.length?t('team.emptyTeams'):!st.ready?t('hj.pending'):st.rows.length<2?t('hj.needTeams'):!ann?t('hj.unannounced'):'';
  return `<div class="card">${hero?`<div class="rl-standing tp-ovh-wrap">${hero}</div>`:''}
    ${note?`<div class="muted mt8">${note}</div>`:''}
    ${rows?`<div class="scroll mt10"><table class="lb big"><tr>${columns.map(k=>`<th>${t(k)}</th>`).join('')}</tr>${rows}</table></div>`:''}
    <div class="cardtools mt8">${controls}</div>
    <details class="mt10"><summary>${t('rule.summary')}</summary><div class="in">${t('hj.rule')}</div></details></div>`;
}
