/* ============================ RESULTS: 1 on 1（js/results.js から分割・挙動不変） ============================ */
/* 1 on 1 のオープン演出用表示状態（§13.2/§14.1・揮発＝再読込で既定に戻る。localStorage には保存しない） */
let m1RevealMode='all';      // 'all'=全組一括（既定） | 'one'=一組ずつ
let m1Opened=new Map();      // 一組ずつモードのオープン済みカード（キー='pidA:pidB'・並び替え/削除に不変。値=その組の開封ホール数0〜18 §14.1）
/* ---- 1 on 1 マッチプレー タブ（§11.13・docs/handoff/2026-08-20-1on1-match.md §13 が正。一組ずつモードの開封は §14・編集UIの置き場所とサマリ表示は §15 が正）----
   組合せ=幹事の手動作成（編集UIは §15.1 で選手タブ js/players.js へ移設＝本タブは閲覧・オープン演出専用）。判定/配点/データ構造（§3/§5/§6）は不変。
   投影原則（正本 §11.14）適用第1号: 大型UP表示が主役。 */
// オープン演出（§13.2/§14.1）: 表示状態のみを更新（save() しない＝localStorage 非保存）
function m1Key(a,b){ return a+':'+b; }
/* ======== 開封順（OUT/IN スタート・docs/handoff/2026-09-11-m1-start-side.md §3）========
   スタートホール s（1-based）の組について、開封順 k(0-based) ↔ 実ホール index i(0-based) は
     holeAt(k,s) = ((s-1)+k)%18   /   m1Off(i,s) = (i-(s-1)+18)%18   （互いに逆写像）
   s=1（OUT・既定）は恒等写像＝従来の 1H→18H と完全一致。§3 計算には非接触（js/calc.js は読むだけ）。 */
function m1Off(i,s){ return (i-(s-1)+18)%18; }
/* 1 on 1 専用のマスク（js/results.js の viewGameN は共用＝1文字も触らない・§3.2）。
   s=1 では viewGameN にそのまま委譲＝既定の出力は現行とバイト一致。 */
function m1ViewGameN(g,n,s){
  if(!(s>1)) return viewGameN(g,n);          // OUT / 未設定 / 不正値 → 従来どおり
  if(n>=18) return g;
  const scores={};
  g.participants.forEach(pid=>{ const a=g.scores[pid]||[]; scores[pid]=a.map((v,i)=> m1Off(i,s)<n ? v : null); });
  return Object.assign({}, g, {scores});
}
/* ペアのスタートホール解決（★将来 #132／組概念と統合するときに差し替える唯一の場所・§7.2）。
   k=m1Key(a,b)。starts にキーが無い＝OUT(1H)＝既存データ・旧バックアップの既定。 */
function m1StartOf(g,k){ const s=((g.match1v1||{}).starts||{})[k]; return (s>=1&&s<=18)?s:1; }
/* ★自動再生の停止点（2026-09-12-m1-autoplay.md §4.3(a) #4〜#8）: 開封に関わる手動操作はすべて冒頭で m1AutoStop()。
   「手動は常に自動に勝つ」（§6.2）＝リセット/前へ/次へ/全開・別カードを開く・一括開封・すべて伏せる・モード切替で必ず止まる。 */
function m1SetMode(mode){ m1AutoStop(); if(mode!==m1RevealMode) m1Opened.clear(); m1RevealMode=mode; renderResult(); }   // モード切替で組状態リセット（§14.1）
function m1OpenCard(k){ m1AutoStop(); m1Opened.set(k,0); renderResult(); }   // オープン直後=0開封（全ホール伏せ・§14.1）
function m1OpenNext(){ m1AutoStop(); const g=curGame(); if(!g)return;
  const k=m1ValidPairs(g).map(([a,b])=>m1Key(a,b)).find(x=>!m1Opened.has(x));   // 未オープンの先頭＝登録リスト順
  if(k){ m1Opened.set(k,0); renderResult(); } }
function m1OpenAllCards(){ m1AutoStop(); const g=curGame(); if(!g)return;
  m1ValidPairs(g).forEach(([a,b])=>m1Opened.set(m1Key(a,b),18)); renderResult(); }   // 演出スキップ＝全開
function m1CoverAll(){ m1AutoStop(); m1Opened.clear(); renderResult(); }
// 組ローカルのホール開封（一組ずつモード・カード内バー §14.2）
function m1Holes(k,op){ m1AutoStop(); const c=m1Opened.get(k)||0;
  m1Opened.set(k, op==='reset'?0 : op==='prev'?Math.max(0,c-1) : op==='next'?Math.min(18,c+1) : 18);
  renderResult(); }

/* ============ ホール自動オープン演出（docs/handoff/2026-09-12-m1-autoplay.md・一組ずつモード専用 §5.1）============
   タイマーの状態（m1Auto / m1AutoStop）は js/nav.js（rl と同じ場所）。ここは演出ロジックのみ。
   §3 計算には非接触＝js/calc.js は1行も触らない（m1HoleWin を読むだけ）。開封状態は揮発＝localStorage に保存しない。 */
const M1_AUTO_MS={ step:1000, hold:3000, rest:200 };   // 通常 / ため / 決着後（§6.3 ハードコード＝設定UIなし）
/* 開封開始ホール（1..18）は組ごとの m1StartOf(g,k)（#140）。自動再生・「ため」・次列の脈打ちは
   すべてこの s を起点にした巡回順で効く（全組 OUT の既定では s=1＝従来どおり 1→18）。 */
/* 演出専用（§3）: その組の「決定ホール」の開封順 index（0-based）＝最終結果（A勝ち/B勝ち/AS）が確定する最初のホール。
   決着 = 残りの“勝敗のつくホール”をすべて相手が取ってもリードを守り切れる（|d|>rem）
          または 残りの“勝敗のつくホール”が 0 本（＝18H 決着 / AS / 末尾未入力もこの1本の式で畳める・§3.2）。
   勝敗のつくホールが1本も無い（全ホール未入力）組は null＝ため無し。計算・配点には一切使わない（§11）。 */
function m1ClinchAt(g,a,b,s){
  const w=[]; let dec=0;
  for(let k=0;k<18;k++){ const x=m1HoleWin(g,a,b,((s-1)+k)%18); w.push(x); if(x!=null) dec++; }   // ((s-1)+k)%18 = 開封順 index → 実ホール index（§2）
  if(!dec) return null;
  let d=0, rem=dec;
  for(let k=0;k<18;k++){
    if(w[k]==='A') d++; else if(w[k]==='B') d--;
    if(w[k]!=null) rem--;                     // rem = k より後ろの“勝敗のつくホール”本数
    if(rem===0 || Math.abs(d)>rem) return k;
  }
  return null;                                // 到達しない（rem は必ず 0 になる）
}
function m1PairOf(k){ const g=curGame(); return g? (m1ValidPairs(g).find(([a,b])=>m1Key(a,b)===k)||null) : null; }
/* 開封順 index j のホールを開くまでの待ち時間（§4.4）。first=押下直後だけ通常区間を 0 にする（＝即反応）。
   ただし j===D なら first でも 3.0秒を返す＝「ため」は必ず守られる（§10-7）。 */
function m1AutoDelay(g,a,b,s,j,first){
  const D=m1ClinchAt(g,a,b,s);
  if(D!=null && j===D) return M1_AUTO_MS.hold;   // 3000: 決定ホールの「ため」
  if(D!=null && j>D)   return M1_AUTO_MS.rest;   //  200: 決着後の消化
  return first ? 0 : M1_AUTO_MS.step;            // 1000
}
function m1AutoTick(){
  m1Auto.timer=null;                             // 自分は発火済み
  const g=curGame(), k=m1Auto.key;
  /* 自己終了ガード（§4.3(b)）: 停止点を1つ書き忘れた経路でも最大1tick で必ず止まる */
  const alive = g && k && activeTab==='result' && resGrp==='team' && resGame.team==='m1'
             && m1RevealMode==='one' && m1Opened.has(k)
             && m1ValidPairs(g).some(([a,b])=>m1Key(a,b)===k);
  if(!alive){ m1AutoStop(); return; }
  const p=m1PairOf(k), s=m1StartOf(g,k);
  const c=Math.min(18,(m1Opened.get(k)||0)+1);
  m1Opened.set(k,c);
  if(c>=18) m1AutoStop();                        // 18 で終了（次の timer を張らない）
  else m1Auto.timer=setTimeout(m1AutoTick, m1AutoDelay(g,p[0],p[1],s,c,false));
  renderResult();                                // 停止状態を反映してから描く（ボタンが ▶再生 に戻る）
}
function m1AutoPlay(k){                          // ▶再生 / ■停止 のトグル
  if(m1Auto.key===k){ m1AutoStop(); renderResult(); return; }    // 走行中の同じ組 → 停止
  m1AutoStop();                                  // ★多重起動防止（rlBeginSpin と同じ作法・§4.5）
  const g=curGame(); if(!g||m1RevealMode!=='one'||!m1Opened.has(k)) return;
  const p=m1PairOf(k); if(!p) return;
  const c=m1Opened.get(k)||0; if(c>=18) return;   // 全開の組は再生しない（ボタンも disabled）
  m1Auto.key=k;
  m1Auto.timer=setTimeout(m1AutoTick, m1AutoDelay(g,p[0],p[1],m1StartOf(g,k),c,true));
  renderResult();                                // 押した瞬間に ■停止 と脈打ちを出す
}

/* §8.3 D15: 返り値 {head, body}。head=チームサマリカード＋共通開封バーカード（.result-sticky 同居＝固定）・body=対戦カード群。
   ガード時（emptyFmt / need2Teams / 組合せなし）は {head:'', body:空状態カード}＝空状態は固定しない。中身/挙動は §13〜§15 のまま不変 */
function renderMatch1v1Parts(g){
  const F=chFormats(g);   // チャンネル共通（2026-08-30 α昇格・2026-08-30-m1-alpha.md）
  // 空状態カードの <h2> は廃止＝タイトルはゲームタブ名（result.sub.match1v1）が兼ねる（heading-unify §3.2）
  if(!F.match1v1) return {head:'', body:`<div class="card"><div class="empty">${t('m1.emptyFmt')}</div></div>`};
  const T=m1Teams(g);
  if(T.length!==2) return {head:'', body:`<div class="card"><div class="empty">${t('m1.need2Teams')}</div></div>`};
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
    const rs=one   // 組ごとのスタートから何ホール目まで回ったか（§4.4。全組 OUT では gAll/viewGameN のまま＝現行と同一）
      ? pairs.filter(([a,b])=>m1Opened.has(m1Key(a,b))).map(([a,b])=>m1Result(m1ViewGameN(g,m1Opened.get(m1Key(a,b))||0,m1StartOf(g,m1Key(a,b))),a,b))
      : pairs.map(([a,b])=>{ const s=m1StartOf(g,m1Key(a,b)); return m1Result(s===1?gAll:m1ViewGameN(g,n,s),a,b); });
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
      <button class="btn gray sm" onclick="m1CoverAll()">${t('m1.coverAll')}</button>`:''}${tpAnnounceUI(g,'match1v1')}</div></div>`;
  /* 連携ボタン=操作バー右端のまま（§11.2。開封演出 m1Opened は揮発のまま・連携だけがデータに残る）。
     2026-09-12 の連携UI配置統一（heading-unify §5.3-A）でも 1 on 1 だけは現状維持＝サマリカードの下に
     専用フッタ行を作ると sticky 固定領域が +33〜52px 増え、320×568 で可視領域が足りなくなるため
     （results-regroup §8.3 の実測）。操作バーは sticky ブロックの最下段＝ブロック単位で見れば既に「右下」。 */
  // 対戦カード（1試合=1カード・登録リスト順）: hero=大型UP表示（§13.3）＋[一組ずつ: カード内開封バー §14.2]＋ホール表（値=adjHole・勝ち=rwin・ハーフ=rtie・未開封=空欄）
  const H0=[...Array(18).keys()];
  const colg=`<colgroup><col class="cnm">${H0.map(()=>'<col class="ch">').join('')}</colgroup>`;
  const colA=tmColor(v.A.name), colB=tmColor(v.B.name);
  const cards=pairs.map(([a,b])=>{
    const k=m1Key(a,b);
    const s=m1StartOf(g,k);                    // この組のスタートホール（1=OUT / 10=IN）
    const H=s===1? H0 : H0.map(x=>((s-1)+x)%18);   // 列＝その組の巡回順（§4.1 案Y。見出しは実ホール番号 i+1）
    const hero=c=>`<div class="m1-hero"><div class="m1-nm" style="color:${colA}">${nameOf(a)}</div><div class="m1-mid">${c}</div><div class="m1-nm" style="color:${colB}">${nameOf(b)}</div></div>`;   // 中央要素=.m1-mid（3カラムグリッドの中央固定・#103）
    if(!isOpen(a,b))   // 伏せ状態（一組ずつ・未オープン §13.2）: 名前は見える・結果とホール表は隠す
      return `<div class="card">${hero(`<button class="btn gold" onclick="m1OpenCard('${k}')">${t('m1.open')}</button>`)}</div>`;
    const c=one? (m1Opened.get(k)||0) : 18;      // 一組ずつ=組ローカル開封数（オープン直後0）
    const gc=one? m1ViewGameN(g,c,s) : (s===1?gAll:m1ViewGameN(g,n,s));   // 表示・判定の基準ゲーム（§14.1／§3.3。revealHoles は一組ずつでは関与しない）
    const r=m1Result(gc,a,b);
    const big = !r.played ? `<div class="m1-big n">—</div>`   // 機能色維持＋文字併記: 勝ち=緑＋矢印（リード側を指す）/ AS=橙 / 未プレー=sub
      : r.diff>0 ? `<div class="m1-big w">◀ ${t('m1.up',{n:r.diff})}</div>`
      : r.diff<0 ? `<div class="m1-big w">${t('m1.up',{n:-r.diff})} ▶</div>`
      : `<div class="m1-big d">${t('m1.as')}</div>`;
    // 暫定タグ: 一組ずつ=c<18 で常に表示（0/18H で進捗ゼロが分かる §14.2）／一括=従来（revealHoles<18 かつ played>0）
    const ptag=one ? (c<18?`<span class="tag tagtie">${c}/18H</span>`:'')
      : ((n<18&&r.played>0)?`<span class="tag tagtie">${n}/18H</span>`:'');
    const stag=s>1?`<span class="tag">${t('m1.startTag',{h:s})}</span>`:'';   // IN 組だけ（列並びが違うことの明示・§4.2）。OUT では出力ゼロ＝現行と同一
    const prov=(ptag||stag)?`<div class="mt6">${ptag}${stag}</div>`:'';
    /* 自動再生（m1-autoplay §4・§7）: 走行中のカードだけが「次に開く列の脈打ち」と「ため」のタグを持つ。
       m1Auto.key!==k（＝自動再生を使っていない）のときは playing=false → 下の出力は ▶再生 ボタン1個の追加のみ（受け入れ条件 A1）。 */
    const playing=one && m1Auto.key===k;
    const D=playing? m1ClinchAt(g,a,b,s) : null;        // 決定ホール（開封順 index・その組の巡回順で数える）
    const nx=(playing&&c<18)? ((s-1)+c)%18 : -1;        // 次に開く列の実ホール index（-1=付けない）
    // カード内開封バー（一組ずつのみ・既存キー流用＝新キーは再生/停止トグル1個のみ。disabled 境界 0/18）
    const cardbar=one?`<div class="reveal-bar m1-cardbar">
      <button class="btn gray sm" onclick="m1Holes('${k}','reset')" ${c<=0?'disabled':''}>${t('btn.reset')}</button>
      <button class="btn gray sm" onclick="m1Holes('${k}','prev')" ${c<=0?'disabled':''}>${t('sc.prev')}</button>
      <button class="btn gold sm" onclick="m1Holes('${k}','next')" ${c>=18?'disabled':''}>${t('sc.next')}</button>
      <button class="btn ${playing?'gray':'gold'} sm" onclick="m1AutoPlay('${k}')" ${c>=18?'disabled':''}>${playing?'■ '+t('m1.pause'):'▶ '+t('m1.play')}</button>
      <button class="btn gray sm" onclick="m1Holes('${k}','all')" ${c>=18?'disabled':''}>${t('btn.all')}</button>
      <span class="tag tagtie">${c>=18?t('sc.allHoles'):c+'/18H'}</span>${(D!=null&&c===D)?`<span class="tag">${t('m1.hold')}</span>`:''}</div>`:'';
    const row=(pid,me,col)=>`<tr><td class="nm" style="color:${col}">${nameOf(pid)}</td>${H.map(i=>{
      const w=m1HoleWin(gc,a,b,i); const cls=(w===me?'rwin':w==='H'?'rtie':'')+(i===nx?' m1-nx':'');
      const val=adjHole(gc,pid,i); return `<td class="${cls}">${val==null?'':val}</td>`; }).join('')}</tr>`;
    return `<div class="card">${hero(big+prov)}${cardbar}
      <table class="sc2">${colg}<tr><th class="nm"></th>${H.map(i=>`<th${i===nx?' class="m1-nx"':''}>${i+1}</th>`).join('')}</tr>
      ${row(a,'A',colA)}${row(b,'B',colB)}</table></div>`;
  }).join('');
  return {head: top + bar, body: cards + ruleBox('rule.match1v1')};
}

