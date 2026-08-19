/* ============================ BACKUP ============================ */
function exportData(){ const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='76club-backup.json'; a.click(); toast(t('toast.exported')); }
function importData(inp){ const f=inp.files[0]; if(!f)return; const r=new FileReader();
  r.onload=()=>{ try{ const s=JSON.parse(r.result); if(!s.players)throw 0; migrate(s); state=s; save(); render(); toast(t('toast.imported')); }
    catch(e){ toast(t('toast.badFile')); } }; r.readAsText(f); }

