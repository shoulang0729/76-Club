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
  html+=`<div class="card"><div class="scroll"><table class="scoregrid">
    <tr><th class="name">${t('col.player')}</th>${g.par.map((_,i)=>`<th class="${g.hidden[i]?'hidden-h':''}">${i+1}</th>`).join('')}<th class="sum">OUT</th><th class="sum">IN</th><th class="sum">${t('col.total')}</th></tr>
    <tr><td class="name" style="font-size:11px;color:var(--sub)">Par</td>${g.par.map((p,i)=>`<td class="${g.hidden[i]?'hidden-h':''}" style="font-size:11px;color:var(--sub)">${p}</td>`).join('')}<td class="sum">${sum(g.par,0,9)}</td><td class="sum">${sum(g.par,9,18)}</td><td class="sum">${sum(g.par,0,18)}</td></tr>
    ${g.participants.map(pid=>{ const p=state.players.find(x=>x.id===pid); if(!p)return'';
      const sc=g.scores[pid]||Array(18).fill(null);
      return `<tr><td class="name">${esc(p.name)}</td>
        ${sc.map((v,i)=>`<td class="${g.hidden[i]?'hidden-h':''}"><input id="sc-${pid}-${i}" type="number" inputmode="numeric" pattern="[0-9]*" min="1" max="15" value="${v??''}" onchange="setScore('${pid}',${i},this)"></td>`).join('')}
        <td class="sum" id="out-${pid}">${sum(sc,0,9)||''}</td><td class="sum" id="in-${pid}">${sum(sc,9,18)||''}</td><td class="sum" id="tot-${pid}">${sum(sc,0,18)||''}</td></tr>`;
    }).join('')}
  </table></div></div>`;
  el.innerHTML=html;
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

