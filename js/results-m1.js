/* ============================ RESULTS: 1 on 1（js/results.js から分割・挙動不変） ============================ */
/* 1 on 1 のオープン演出用表示状態（§13.2/§14.1・揮発＝再読込で既定に戻る。localStorage には保存しない） */
let m1RevealMode='all';      // 'all'=全組一括（既定） | 'one'=一組ずつ
let m1Opened=new Map();      // 一組ずつモードのオープン済みカード（キー='pidA:pidB'・並び替え/削除に不変。値=その組の開封ホール数0〜18 §14.1）
/* ---- 1 on 1 マッチプレー タブ（§11.13・docs/handoff/2026-08-20-1on1-match.md §13 が正。一組ずつモードの開封は §14・編集UIの置き場所とサマリ表示は §15 が正）----
   組合せ=幹事の手動作成（編集UIは §15.1 で選手タブ js/players.js へ移設＝本タブは閲覧・オープン演出専用）。判定/配点/データ構造（§3/§5/§6）は不変。
   投影原則（正本 §11.14）適用第1号: 大型UP表示が主役。 */
// オープン演出（§13.2/§14.1）: 表示状態のみを更新（save() しない＝localStorage 非保存）
function m1Key(a,b){ return a+':'+b; }
function m1SetMode(mode){ if(mode!==m1RevealMode) m1Opened.clear(); m1RevealMode=mode; renderResult(); }   // モード切替で組状態リセット（§14.1）
function m1OpenCard(k){ m1Opened.set(k,0); renderResult(); }   // オープン直後=0開封（全ホール伏せ・§14.1）
function m1OpenNext(){ const g=curGame(); if(!g)return;
  const k=m1ValidPairs(g).map(([a,b])=>m1Key(a,b)).find(x=>!m1Opened.has(x));   // 未オープンの先頭＝登録リスト順
  if(k){ m1Opened.set(k,0); renderResult(); } }
function m1OpenAllCards(){ const g=curGame(); if(!g)return;
  m1ValidPairs(g).forEach(([a,b])=>m1Opened.set(m1Key(a,b),18)); renderResult(); }   // 演出スキップ＝全開
function m1CoverAll(){ m1Opened.clear(); renderResult(); }
// 組ローカルのホール開封（一組ずつモード・カード内バー §14.2）
function m1Holes(k,op){ const c=m1Opened.get(k)||0;
  m1Opened.set(k, op==='reset'?0 : op==='prev'?Math.max(0,c-1) : op==='next'?Math.min(18,c+1) : 18);
  renderResult(); }

/* §8.3 D15: 返り値 {head, body}。head=チームサマリカード＋共通開封バーカード（.result-sticky 同居＝固定）・body=対戦カード群。
   ガード時（emptyFmt / need2Teams / 組合せなし）は {head:'', body:空状態カード}＝空状態は固定しない。中身/挙動は §13〜§15 のまま不変 */
function renderMatch1v1Parts(g){
  const F=chFormats(g);   // チャンネル共通（2026-08-30 α昇格・2026-08-30-m1-alpha.md）
  if(!F.match1v1) return {head:'', body:`<div class="card"><h2>${t('term.match1v1')}</h2><div class="empty">${t('m1.emptyFmt')}</div></div>`};
  const T=m1Teams(g);
  if(T.length!==2) return {head:'', body:`<div class="card"><h2>${t('term.match1v1')}</h2><div class="empty">${t('m1.need2Teams')}</div></div>`};
  const m=g.match1v1||{pairs:[]};
  const raw=m.pairs||[];              // 登録済み全組（無効組も編集UIには出す）
  const v=m1Valid(g);                 // 現在の2チームと一致する保存済み組合せ（なければ null）
  const pairs=m1ValidPairs(g);        // 有効試合のみ（無効試合は表示・集計からスキップ §4.3）
  const stale=raw.length>0 && pairs.length<raw.length;
  const nameOf=pid=>{ const p=state.players.find(x=>x.id===pid); return p?esc(p.name):'?'; };
  const n=revealHoles;
  const one=m1RevealMode==='one';
  const isOpen=(a,b)=> !one || m1Opened.has(m1Key(a,b));
  const gAll=viewGame(g);   // 全組一括モード用（従来どおり共通 revealHoles でマスク。一組ずつは組ごとに viewGameN §14.1）
  // 未出場（両チームの参加メンバーで組合せに1度も現れない選手）: 警告のみ・登録/集計はブロックしない（§13.1 運用ガイド）
  const appeared=new Set(); raw.forEach(([a,b])=>{ appeared.add(a); appeared.add(b); });
  const notPlayed=[...m1MemberIds(g,T[0]),...m1MemberIds(g,T[1])].filter(pid=>!appeared.has(pid));
  const npNote=(raw.length&&notPlayed.length)?`<div class="muted mt6" style="color:var(--red)">${t('m1.notPlayed',{name:notPlayed.map(nameOf).join(', ')})}</div>`:'';
  // 上部カード：h2 見出し行なし＝チームサマリ行から始まる（§15.2。開封状況 pill は開封バーカード側に表示）。
  // チーム対抗サマリ（表示のみ・配点には使わない。一組ずつモードではオープン済みカードの現在開封数のみ集計 §14.2）
  let top=`<div class="card">`;
  if(v && pairs.length){
    const rs=one
      ? pairs.filter(([a,b])=>m1Opened.has(m1Key(a,b))).map(([a,b])=>m1Result(viewGameN(g,m1Opened.get(m1Key(a,b))||0),a,b))
      : pairs.map(([a,b])=>m1Result(gAll,a,b));
    const wA=rs.filter(r=>r.played&&r.diff>0).length, wB=rs.filter(r=>r.played&&r.diff<0).length, dr=rs.filter(r=>r.played&&r.diff===0).length;
    top+=`<div class="m1-teamsum">
      <span style="color:${tmColor(v.A.name)}">${esc(v.A.name)}</span> <b>${wA}</b> – <b>${wB}</b> <span style="color:${tmColor(v.B.name)}">${esc(v.B.name)}</span>
      ${dr?`<span class="tag tagtie">${t('m1.as')} ${dr}</span>`:''}</div>`;
  }
  if(!raw.length) top+=`<div class="empty">${t('m1.noPairs')}</div>`;
  top+=npNote;
  if(stale) top+=`<div class="muted mt6" style="color:var(--red)">${t('m1.stale')}</div>`;
  top+=`</div>`;
  if(!pairs.length) return {head:'', body:top};   // 編集UIは選手タブ側（§15.1。m1.noPairs / m1.stale が選手タブへ誘導）
  // 共通開封バー：全組一括=従来どおり4ボタン＋タグ（revealHoles）。一組ずつ=ホール開封は組ローカルに一本化するため4ボタン・タグ非表示（§14.2）
  const allOpen=pairs.every(([a,b])=>m1Opened.has(m1Key(a,b)));
  const bar=`<div class="card"><div class="reveal-bar">
    ${one?'':`<button class="btn gray sm" onclick="resetHoles()" ${n<=0?'disabled':''}>${t('btn.reset')}</button>
    <button class="btn gray sm" onclick="closeHole()" ${n<=0?'disabled':''}>${t('sc.prev')}</button>
    <button class="btn gold sm" onclick="openNextHole()" ${n>=18?'disabled':''}>${t('sc.next')}</button>
    <button class="btn gray sm" onclick="openAllHoles()" ${n>=18?'disabled':''}>${t('btn.all')}</button>
    <span class="tag tagtie">${n>=18?t('sc.allHoles'):n+'/18H'}</span>`}
    <span class="seg"><button class="${one?'':'on'}" onclick="m1SetMode('all')">${t('m1.modeAll')}</button><button class="${one?'on':''}" onclick="m1SetMode('one')">${t('m1.modeOne')}</button></span>
    ${one?`<button class="btn gold sm" onclick="m1OpenNext()" ${allOpen?'disabled':''}>${t('m1.openNext')}</button>
      <button class="btn gray sm" onclick="m1OpenAllCards()">${t('m1.openAllCards')}</button>
      <button class="btn gray sm" onclick="m1CoverAll()">${t('m1.coverAll')}</button>`:''}${tpAnnounceUI(g,'match1v1')}</div></div>`;   // 連携ボタン=操作バー右端（§11.2。開封演出 m1Opened は揮発のまま・連携だけがデータに残る）
  // 対戦カード（1試合=1カード・登録リスト順）: hero=大型UP表示（§13.3）＋[一組ずつ: カード内開封バー §14.2]＋ホール表（値=adjHole・勝ち=rwin・ハーフ=rtie・未開封=空欄）
  const H=[...Array(18).keys()];
  const colg=`<colgroup><col class="cnm">${H.map(()=>'<col class="ch">').join('')}</colgroup>`;
  const colA=tmColor(v.A.name), colB=tmColor(v.B.name);
  const cards=pairs.map(([a,b])=>{
    const k=m1Key(a,b);
    const hero=c=>`<div class="m1-hero"><div class="m1-nm" style="color:${colA}">${nameOf(a)}</div><div>${c}</div><div class="m1-nm" style="color:${colB}">${nameOf(b)}</div></div>`;
    if(!isOpen(a,b))   // 伏せ状態（一組ずつ・未オープン §13.2）: 名前は見える・結果とホール表は隠す
      return `<div class="card">${hero(`<button class="btn gold" onclick="m1OpenCard('${k}')">${t('m1.open')}</button>`)}</div>`;
    const c=one? (m1Opened.get(k)||0) : 18;      // 一組ずつ=組ローカル開封数（オープン直後0）
    const gc=one? viewGameN(g,c) : gAll;         // 表示・判定の基準ゲーム（§14.1。revealHoles は一組ずつでは関与しない）
    const r=m1Result(gc,a,b);
    const big = !r.played ? `<div class="m1-big n">—</div>`   // 機能色維持＋文字併記: 勝ち=緑＋矢印（リード側を指す）/ AS=橙 / 未プレー=sub
      : r.diff>0 ? `<div class="m1-big w">◀ ${t('m1.up',{n:r.diff})}</div>`
      : r.diff<0 ? `<div class="m1-big w">${t('m1.up',{n:-r.diff})} ▶</div>`
      : `<div class="m1-big d">${t('m1.as')}</div>`;
    // 暫定タグ: 一組ずつ=c<18 で常に表示（0/18H で進捗ゼロが分かる §14.2）／一括=従来（revealHoles<18 かつ played>0）
    const prov=one ? (c<18?`<div class="mt6"><span class="tag tagtie">${c}/18H</span></div>`:'')
      : ((n<18&&r.played>0)?`<div class="mt6"><span class="tag tagtie">${n}/18H</span></div>`:'');
    // カード内開封バー（一組ずつのみ・既存キー流用＝新キーなし。disabled 境界 0/18）
    const cardbar=one?`<div class="reveal-bar m1-cardbar">
      <button class="btn gray sm" onclick="m1Holes('${k}','reset')" ${c<=0?'disabled':''}>${t('btn.reset')}</button>
      <button class="btn gray sm" onclick="m1Holes('${k}','prev')" ${c<=0?'disabled':''}>${t('sc.prev')}</button>
      <button class="btn gold sm" onclick="m1Holes('${k}','next')" ${c>=18?'disabled':''}>${t('sc.next')}</button>
      <button class="btn gray sm" onclick="m1Holes('${k}','all')" ${c>=18?'disabled':''}>${t('btn.all')}</button>
      <span class="tag tagtie">${c>=18?t('sc.allHoles'):c+'/18H'}</span></div>`:'';
    const row=(pid,me,col)=>`<tr><td class="nm" style="color:${col}">${nameOf(pid)}</td>${H.map(i=>{
      const w=m1HoleWin(gc,a,b,i); const cls=w===me?'rwin':w==='H'?'rtie':'';
      const val=adjHole(gc,pid,i); return `<td class="${cls}">${val==null?'':val}</td>`; }).join('')}</tr>`;
    return `<div class="card">${hero(big+prov)}${cardbar}
      <table class="sc2">${colg}<tr><th class="nm"></th>${H.map(i=>`<th>${i+1}</th>`).join('')}</tr>
      ${row(a,'A',colA)}${row(b,'B',colB)}</table></div>`;
  }).join('');
  return {head: top + bar, body: cards + ruleBox('rule.match1v1')};
}

