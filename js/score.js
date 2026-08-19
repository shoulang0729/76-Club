/* ============================ SCORE ENTRY ============================ */
function renderScore(){
  const el=document.getElementById('view-score'); const g=curGame();
  if(!g){ el.innerHTML=`<div class="empty">${t('score.createFirst')}</div>`; return; }
  if(!g.participants.length){ el.innerHTML=`<div class="empty">${t('score.pickParts')}</div>`; return; }
  let html=`<div class="card"><h2>${t('score.title')}</h2>
    <div class="muted">${t('score.note')}</div>
    <div class="row" class="mt8"><button class="btn sec sm" onclick="fillRandomScores()">${t('score.fillRandom')}</button>
      <button class="btn gray sm" onclick="clearScores()">${t('score.clearBtn')}</button></div>
  </div>`;
  // §11.12 D: 狭幅は OUT(1-9)/IN(10-18) の2段に折り返す。iPad/PCは従来どおり18列1段
  html += (scNarrow()? [[0,9],[9,18]] : [[0,18]]).map(([s,e])=>scoreGrid(g,s,e)).join('');
  el.innerHTML=html;
}
/* 合計列の構成（区間で自動的に決まる）: 前半を含めばOUT / 後半を含めばIN / 18Hまで含めば計 */
function scSumCols(s,e){ const c=[];
  if(s===0) c.push({key:'out', label:'OUT', f:a=>sum(a,0,9)});
  if(e===18) c.push({key:'in', label:'IN', f:a=>sum(a,9,18)});
  if(e===18) c.push({key:'tot', label:t('col.total'), f:a=>sum(a,0,18)});
  return c; }
function scoreGrid(g,s,e){
  const H=[]; for(let i=s;i<e;i++)H.push(i);
  const cols=scSumCols(s,e);
  return `<div class="card"><div class="scroll"><table class="scoregrid">
    <tr><th class="name">${t('col.player')}</th>${H.map(i=>`<th class="${g.hidden[i]?'hidden-h':''}">${i+1}</th>`).join('')}${cols.map(c=>`<th class="sum">${c.label}</th>`).join('')}</tr>
    <tr><td class="name parlbl">Par</td>${H.map(i=>`<td class="parlbl ${g.hidden[i]?'hidden-h':''}">${g.par[i]}</td>`).join('')}${cols.map(c=>`<td class="sum">${c.f(g.par)}</td>`).join('')}</tr>
    ${g.participants.map(pid=>{ const p=state.players.find(x=>x.id===pid); if(!p)return'';
      const sc=g.scores[pid]||Array(18).fill(null);
      return `<tr><td class="name">${esc(p.name)}</td>
        ${H.map(i=>`<td class="${g.hidden[i]?'hidden-h':''}"><input id="sc-${pid}-${i}" type="number" inputmode="numeric" pattern="[0-9]*" min="1" max="15" value="${sc[i]??''}" onchange="setScore('${pid}',${i},this)"></td>`).join('')}
        ${cols.map(c=>`<td class="sum" id="${c.key}-${pid}">${c.f(sc)||''}</td>`).join('')}</tr>`;
    }).join('')}
  </table></div></div>`;
}
function sum(a,s,e){ let t=0,any=false; for(let i=s;i<e;i++){ if(a[i]!=null&&a[i]!==''){t+=Number(a[i]);any=true;} } return any?t:0; }
// フォーカスを失わないよう、再描画せず合計セルだけ更新
function setScore(pid,i,el){ const g=curGame(); g.scores[pid]=g.scores[pid]||Array(18).fill(null);
  const v=el.value; g.scores[pid][i] = v===''?null:(parseInt(v)||null); save(); updateRowSums(g,pid); }
function updateRowSums(g,pid){ const sc=g.scores[pid]||[];
  const o=document.getElementById('out-'+pid), n=document.getElementById('in-'+pid), t=document.getElementById('tot-'+pid);
  if(o)o.textContent=sum(sc,0,9)||''; if(n)n.textContent=sum(sc,9,18)||''; if(t)t.textContent=sum(sc,0,18)||''; }
function fillRandomScores(){ const g=curGame(); if(!g)return;
  g.participants.forEach(pid=>{ g.scores[pid]=g.par.map(par=>{ const r=Math.random();
    const d = r<0.05?-1 : r<0.45?0 : r<0.75?1 : r<0.92?2 : 3;  // バーディ寄り〜大叩き
    return Math.max(2, par+d); }); });
  save(); renderScore(); toast(t('toast.randomFilled')); }
function clearScores(){ const g=curGame(); if(!g)return; if(!confirm(t('confirm.clearScores')))return;
  g.participants.forEach(pid=>{ g.scores[pid]=Array(18).fill(null); }); save(); renderScore(); }

/* ---- 確定/暫定判定 ---- */
function allComplete(g){ const parts=g.participants.filter(pid=>state.players.find(x=>x.id===pid));
  return parts.length>0 && parts.every(pid=>complete(g,pid)); }
function statusBadge(g){ return allComplete(g)
  ? `<span class="tag" style="background:var(--win);color:var(--on-fill)">${t('status.fixed')}</span>`
  : `<span class="tag tagtie">${t('status.prov')}</span>`; }

