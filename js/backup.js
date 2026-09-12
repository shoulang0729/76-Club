/* ============================ BACKUP ============================ */
function exportData(){ const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='76club-backup.json'; a.click(); toast(t('toast.exported')); }
function importData(inp){ const f=inp.files[0]; if(!f)return; const r=new FileReader();
  r.onload=()=>{ try{ const s=JSON.parse(r.result); if(!s.players)throw 0; migrate(s); state=s; save(); render(); toast(t('toast.imported')); }
    catch(e){ toast(t('toast.badFile')); } }; r.readAsText(f); }
/* #166③: バックアップUI（旧「選手・チーム」タブ末尾のカード）を「コンペ設定」タブへ移設。
   保存されるのは state 丸ごと（選手マスタ＋全コンペ＋スコア）＝特定コンペの設定ではないので、
   コンペ設定タブの末尾（幹事メニューの直前）に置く。見た目は #180 の他セクションと同じ
   <details class="gsec">（gsSec は js/basic.js。呼び出しは実行時なので読込順に依存しない）。
   exportData / importData は無改変＝挙動は従来どおり。 */
function backupCard(){
  return gsSec('backup', t('backup.title'), `<div class="muted">${t('backup.note')}</div>
    <div class="row mt8">
      <button class="btn sec" onclick="exportData()">${t('backup.export')}</button>
      <label class="btn sec" style="cursor:pointer">${t('backup.import')}<input type="file" accept="application/json" style="display:none" onchange="importData(this)"></label>
    </div>`);
}
