/* ============================ TEST DATA ============================ */
function seedTestData(){
  if(!confirm(t('confirm.seedTest')))return;
  const samples=[
    ['田中 太郎','M','none',false,'1975-04-12'],['佐藤 花子','F','every2',false,'1982-09-03'],['鈴木 一郎','M','none',false,'1968-01-25'],
    ['高橋 美咲','F','every1',false,'1990-11-18'],['渡辺 健','M','none',false,'1979-06-30'],['伊藤 由美','F','none',false,'1985-03-14'],
    ['山本 大輔','M','none',true,'1972-12-05'],['中村 彩','F','every2',false,'1988-07-22'],['小林 誠','M','none',false,'1965-02-09'],
    ['加藤 香織','F','every1',false,'1993-05-17'],['吉田 隆','M','none',false,'1981-08-28'],['松本 恵','F','none',false,'1977-10-11']];
  const ids=samples.map(([name,gender,everyType,kanjiExempt,birth])=>{
    let p=state.players.find(x=>x.name===name);
    if(!p){ p={id:uid(),name,gender,birth,everyType,kanjiExempt}; state.players.push(p); }
    else { p.gender=gender; p.birth=birth; p.everyType=everyType; p.kanjiExempt=kanjiExempt; }
    return p.id;
  });
  const g=newGame();
  g.name='テストコンペ'; g.course='テスト国際CC';
  g.par=[4,4,3,5,4,4,3,4,5, 4,4,3,4,5,4,4,3,5];  // 72
  // 隠し12ホールをランダム（前後半×パー帯 均等・course.js の pickHidden12）
  g.hidden=pickHidden12(g.par);
  g.womenEvery.enabled=true;
  g.prizePool=24000;
  g.participants=ids.slice();
  ids.forEach(pid=>{ g.scores[pid]=g.par.map(par=>{ const r=Math.random();
    const d=r<0.05?-1:r<0.45?0:r<0.75?1:r<0.92?2:3; return Math.max(2,par+d); }); });
  // 3チームに自動割当
  const tnames=['レッド','ブルー','グリーン'];
  g.teams=tnames.map(n=>({id:uid(),name:'チーム'+n,memberIds:[]}));
  ids.forEach((pid,i)=>g.teams[i%3].memberIds.push(pid));
  // ニアピン(par3)・ドラコン(par5)は par から自動導出（2026-08-20-npdc-par.md）。勝者だけランダム生成
  niapinHolesOf(g).forEach(h=>{ g.prizes.niapinWinner[h]=ids[Math.floor(Math.random()*ids.length)]; });
  draconHolesOf(g).forEach(h=>{ g.prizes.draconWinner[h]=ids[Math.floor(Math.random()*ids.length)]; });
  state.games.push(g); state.currentGameId=g.id; save(); render(); toast(t('toast.testCreated'));
}

