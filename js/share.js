/* ============================ SHARE（結果表1枚画像の描画と保存） ============================
   設計: docs/handoff/2026-09-23-result-image-export.md
         §2 セクションと順序 ／ §4 canvas サイズと自動縮尺 ／ §5 Web フォント待ち ／ §7 保存の3段構え ／ §11.1 レイアウト仕様

   ★このファイルの責務は「渡されたモデルを描いて、PNG を持ち出せるようにする」ことだけ（§6.1 のレイヤ図）。
   1) 計算しない・データを読まない。描くのは sheetModel(g) ＋ tpShareModel(g) を合成したモデルの値だけで、
      合成は画面側（js/results.js の sheetImgInput）が行う。ここから state / 計算モジュール / 保存領域は触らない。
   2) DOM を組まない（プレビューやボタンの HTML は js/results.js 側）。ここが触る DOM は
      「自分で作った canvas」と「色トークンを読むための documentElement」だけ。
   3) 揮発の発表演出（ホール開封数・合計値トグル・順位行の目隠し・旗の伏せ）を参照しない（§3）。
      モデルが既にそうなっているので、ここで画面状態を読み足さないこと。
   4) 画像は常にライト固定。テーマの設定値（保存キー）には一切触らず、トークンを読む一瞬だけ
      ルート要素の属性を外して元に戻す（同期処理なので途中で画面が再描画されることはない）。
   5) 外部通信ゼロ（ネットワーク API を1つも使わない）。画像は端末内で作って端末内に渡すだけ（§9）。 */

/* ---- 上限と縮尺（§4.1/§4.3・load-bearing）----
   iOS Safari（〜17）の canvas 上限は「辺」ではなく「面積 16,777,216px」で、超えると例外なく黙って
   空（真っ白）になる。5% の安全マージンを取った面積上限と、辺の保険の小さい方で縮尺 k を決める。
   k は 1 を超えない（高解像度化はしない＝ファイルサイズを無駄に増やさない）。 */
const IMG_AREA_MAX = 16000000;
const IMG_SIDE_MAX = 16384;
/* ---- レイアウト定数（論理px・幅 1080 固定・§11.1 の実測値）----
   ★幅・行高・文字サイズはモック承認済みの見本の値。調整は Issue を立ててから（勝手に変えない）。 */
const SL = { W:1080, PAD:40, SECT:62, ROW:40, HEAD:44, SCROW:38, GAP:24 };
/* 画像に使う色トークン（ライトの値を一度だけ snapshot する。getComputedStyle の戻りは live なので
   属性を戻した後に読むとダークの値になってしまう＝必ずここで実値へ写し取る） */
const SHEET_TOKENS = ['--bg','--card','--strong','--ink','--sub','--line',
  '--win','--win-ink','--win-bg','--tie','--tie-ink','--tie-bg',
  '--tm-red','--tm-blue','--tm-green','--tm-yellow','--tm-gray',
  '--tm-purple','--tm-orange','--tm-teal','--tm-pink','--tm-lime'];

/* ライト固定のトークン値を取る（§12.4-1）。ダークのページから呼ばれても白地の画像になる。
   属性の退避→復帰は同期＝この間に描画フレームは挟まらない。保存キーは読み書きしない。 */
function sheetTokens(){
  const el = document.documentElement, prev = el.getAttribute('data-theme');
  if(prev !== null) el.removeAttribute('data-theme');      // 属性なし＝:root のライト値（画面のライトと同一）
  const cs = getComputedStyle(el), C = {};
  SHEET_TOKENS.forEach(n => { C[n] = cs.getPropertyValue(n).trim(); });
  if(prev !== null) el.setAttribute('data-theme', prev);   // 元に戻す（dark のページは dark のまま）
  return C;
}
/* 2段組のしきい値（§11.1・17行以上は左右2列）。高さの計算と描画で同じ関数を使う＝ズレない */
function sheetColRows(n){ return n>16 ? Math.ceil(n/2) : n; }
/* 明細セクションを描くか（PM 判断で v1 から 1on1・大学対抗・任意対決の明細を入れる）。
   未連携（幹事がまだ連携を押していない）種目は行を持たない＝描かない。種目別勝ち点表の ？ 行が結論を兼ねる（§3） */
function sheetDetOn(d){ return !!(d && d.on && d.rows && d.rows.length); }
function sheetUvLines(d){ return d.rows.reduce((a,r)=> a + 1 + r.members.length, 0); }

/* ============ 本体: 結果表を1枚の PNG に描く ============
   drawSheet(M)             → {W,H,k,bytes,url}   bytes=PNG の生バイト（同期で作る・§7.2）
   drawSheet(M,{probe:true}) → {W,H,k,sections,overflow,fit}  canvas を作らずレイアウト情報だけ返す（§12.3）
   M = {...sheetModel(g), tp: tpShareModel(g)|null} */
function drawSheet(M, opt){
  const probe = !!(opt && opt.probe);
  const W = SL.W, CW = W - SL.PAD*2;
  const FF = getComputedStyle(document.body).fontFamily;   // 画面と同じフォントスタック（zh の字形指定にも自動追従・§5.3）
  const f = (w,s) => w + ' ' + s + 'px ' + FF;
  const mc = document.createElement('canvas').getContext('2d');   // 計測専用（1x1）
  const tw = (s,font) => { mc.font = font; return mc.measureText(String(s)).width; };

  /* ---- パス1: セクションの高さを積む（順序＝§2。明細3種目は総合の後・ポイントの前）---- */
  const sect = []; let H = SL.PAD;
  const add = (id,h) => { sect.push({id, y:H, h}); H += h; };
  add('title', 70+40+18+SL.GAP);
  const scRows = M.sc.groups.reduce((a,gp)=> a + gp.rows.length + (gp.team?1:0), 0);
  add('sc', SL.SECT + SL.HEAD + SL.SCROW*(1+scRows) + SL.GAP);          // +1 = Par 行
  M.ind.forEach((cd,i)=> add('ind:'+i, SL.SECT + SL.HEAD + SL.ROW*sheetColRows(cd.rows.length) + SL.GAP));
  if(M.flags.length) add('flags', SL.SECT + 96*Math.ceil(M.flags.length/4) + SL.GAP);
  if(M.tp)           add('tp',    SL.SECT + 200 + SL.HEAD + 56*M.tp.events.length + SL.GAP);
  const D = M.det || {};
  if(sheetDetOn(D.m1))     add('det:m1',     SL.SECT + SL.HEAD + SL.ROW*D.m1.rows.length + SL.GAP);
  if(sheetDetOn(D.univ))   add('det:univ',   SL.SECT + SL.HEAD + SL.SCROW*sheetUvLines(D.univ) + SL.GAP);
  if(sheetDetOn(D.custom)) add('det:custom', SL.SECT + SL.HEAD + SL.ROW*D.custom.rows.length + SL.GAP);
  add('pay', SL.SECT + SL.HEAD + SL.ROW*sheetColRows(M.pay.rows.length) + SL.GAP);
  add('foot', 40);
  H += SL.PAD;

  const k = Math.min(1, Math.sqrt(IMG_AREA_MAX/(W*H)), IMG_SIDE_MAX/H, IMG_SIDE_MAX/W);
  if(probe) return { W:Math.round(W*k), H:Math.round(H*k), k, sections:sect,
    overflow: sheetFit(M,tw,f,CW), fit: sheetFitInfo(tw,f,CW) };

  /* ---- パス2: 描画（論理座標は常に幅 1080。k は scale で吸収＝以降のコードは k を意識しない）---- */
  const cv = document.createElement('canvas');
  cv.width = Math.round(W*k); cv.height = Math.round(H*k);
  const c = cv.getContext('2d'); c.scale(k,k);
  const C = sheetTokens();                                  // ★ライト固定の色（§12.4-1）
  /* チーム色: モデルは生のチーム名だけを返すので、ここでトークン名に解決する（§6.2） */
  const tmc = nm => { const v = (tmColor(nm).match(/--[a-z0-9-]+/)||['--sub'])[0]; return C[v] || C['--ink']; };
  const gcol = M.sc.groups.map(gp => gp.team ? tmc(gp.team) : C['--ink']);

  c.fillStyle = C['--bg'] || '#ffffff'; c.fillRect(0,0,W,H);
  c.textBaseline = 'middle';
  const line = y => { c.strokeStyle=C['--line']; c.lineWidth=1; c.beginPath();
    c.moveTo(SL.PAD, y+.5); c.lineTo(W-SL.PAD, y+.5); c.stroke(); };
  const txt = (s,x,y,font,col,align) => { c.font=font; c.fillStyle=col; c.textAlign=align||'left'; c.fillText(String(s),x,y); };
  const clip = (s,font,max) => { s=String(s); mc.font=font; if(mc.measureText(s).width<=max) return s;
    let r=s; while(r.length>1 && mc.measureText(r+'…').width>max) r=r.slice(0,-1); return r+'…'; };
  const sectTitle = (s,y) => { txt(s, SL.PAD, y+34, f(700,30), C['--strong']); line(y+54); };
  const num = v => v==null ? '—' : (Number.isInteger(v) ? String(v) : String(Math.round(v*10)/10));
  /* 表のヘッダ帯（スコア表・明細で共用。地色は --card＝面に濃色ベタ塗りを使わない原則） */
  const headBand = ry => { c.fillStyle=C['--card']; c.fillRect(SL.PAD, ry, CW, SL.HEAD); };

  for(const S of sect){
    const y = S.y;
    if(S.id==='title'){
      txt(M.meta.name, SL.PAD, y+34, f(800,46), C['--strong']);
      const meta = [M.meta.date, M.meta.course, t('col.player')+' '+M.meta.n].filter(x=>x).join('  ・  ');
      txt(meta, SL.PAD, y+92, f(400,24), C['--sub']);
      line(y+118);

    } else if(S.id==='sc'){
      /* スコア表（§2 #2）: 全員 × 18ホール（エブリ適用後）＋ OUT/IN/G/HD/Net。チーム設定があればチーム別。
         隠しホール（ダブルペリアの12H）は見本どおり印を付けない＝罫線と記号を増やさない（§11.1） */
      sectTitle(t('sc.title'), y);
      const nameW=200, totW=64, subW=56, holeW=(CW-nameW-totW*3-subW*2)/18;
      const cols = [{w:nameW, label:t('col.player'), al:'left'}];
      for(let i=0;i<9;i++)  cols.push({w:holeW, label:i+1});
      cols.push({w:subW, label:'OUT'});
      for(let i=9;i<18;i++) cols.push({w:holeW, label:i+1});
      cols.push({w:subW, label:'IN'});
      cols.push({w:totW, label:'G'}); cols.push({w:totW, label:t('col.hd')}); cols.push({w:totW, label:t('col.net')});
      let x=SL.PAD; cols.forEach(cc=>{ cc.x=x; x+=cc.w; });
      let ry=y+SL.SECT;
      headBand(ry);
      cols.forEach(cc=> txt(cc.label, cc.al==='left'?cc.x+8:cc.x+cc.w/2, ry+SL.HEAD/2, f(700,19), C['--sub'], cc.al||'center'));
      ry+=SL.HEAD;
      const parCells=['Par'].concat(M.sc.par.slice(0,9),[M.sc.parOut],M.sc.par.slice(9,18),[M.sc.parIn],['-','-','-']);
      parCells.forEach((v,i)=> txt(v, i===0?cols[i].x+8:cols[i].x+cols[i].w/2, ry+SL.SCROW/2, f(600,19), C['--sub'], i===0?'left':'center'));
      line(ry+SL.SCROW); ry+=SL.SCROW;
      M.sc.groups.forEach((gp,gi)=>{
        if(gp.team){ txt(clip(gp.team,f(700,21),CW-16), SL.PAD+8, ry+SL.SCROW/2, f(700,21), gcol[gi]);
          line(ry+SL.SCROW); ry+=SL.SCROW; }
        gp.rows.forEach(r=>{
          txt(clip(r.name,f(600,20),nameW-12), cols[0].x+8, ry+SL.SCROW/2, f(600,20), C['--ink']);
          const vals = r.holes.slice(0,9).map(v=>v==null?'':v).concat([r.out],
            r.holes.slice(9,18).map(v=>v==null?'':v), [r.inn], [r.gross, r.hd, r.net]);
          vals.forEach((v,i)=>{ const cc=cols[i+1];
            txt(v, cc.x+cc.w/2, ry+SL.SCROW/2, f(i>=21?700:400,19), i>=21?C['--strong']:C['--ink'], 'center'); });
          line(ry+SL.SCROW); ry+=SL.SCROW; });
      });

    } else if(S.id.indexOf('ind:')===0){
      /* 個人戦の順位（§2 #3）: 採用種目ごとに1表・全員分。ラベルはモデルの i18n キーを訳す（§6.2） */
      const cd = M.ind[+S.id.split(':')[1]];
      sectTitle(t(cd.labelKey), y);
      const two = cd.rows.length>16, colW = two?CW/2:CW, per = sheetColRows(cd.rows.length);
      cd.rows.forEach((r,i)=>{
        const bx = SL.PAD + (two?Math.floor(i/per):0)*colW, by = y+SL.SECT+SL.HEAD + (two?i%per:i)*SL.ROW;
        if(r.rank===1){ c.fillStyle=C['--win-bg']; c.fillRect(bx,by,colW-12,SL.ROW-4); }   // 1位＝勝ち色（意味を保持）
        txt(r.rank, bx+30, by+SL.ROW/2, f(700,22), r.rank===1?C['--win-ink']:C['--sub'], 'right');
        txt(clip(r.name+(r.team?' ('+r.team+')':''), f(600,22), colW-190), bx+46, by+SL.ROW/2, f(600,22), C['--ink']);
        txt(r.val+(r.unit||''), bx+colW-24, by+SL.ROW/2, f(800,24), C['--strong'], 'right'); });

    } else if(S.id==='flags'){
      /* ニアピン／ドラコン（§2 #4）: 旗ごとのカードを4列。勝者未登録は — */
      sectTitle(t('term.niadora'), y);
      const cw = CW/4;
      M.flags.forEach((fl,i)=>{
        const bx = SL.PAD + (i%4)*cw, by = y+SL.SECT + Math.floor(i/4)*96;
        c.strokeStyle=C['--line']; c.lineWidth=1; c.strokeRect(bx+4.5, by+4.5, cw-12, 86);
        txt((fl.kind==='np'?'NP':'DC')+' '+fl.holeNo+'H'+(fl.set?' '+fl.set:''), bx+16, by+26, f(700,19), C['--sub']);
        txt(clip(fl.name||'—', f(700,26), cw-36), bx+16, by+62, f(700,26), C['--ink']); });

    } else if(S.id==='tp'){
      /* チーム戦 総合（§2 #5）: ①ヒーロー ②種目別勝ち点表。未連携行はモデルが値を持たない＝？ のまま（§3） */
      sectTitle(t('result.sub.overall'), y);
      const T=M.tp, cw=CW/T.teams.length;
      T.teams.forEach((r,i)=>{ const bx=SL.PAD+i*cw, col=tmc(r.name);
        /* 順位は数字だけ（画面の順位バッジ posBadge と同じ表記）。「位」の literal を置くと zh/en で日本語が残る */
        txt(r.rank, bx+cw/2, y+SL.SECT+24, f(600,22), C['--sub'], 'center');
        txt(clip(r.name,f(700,34),cw-16), bx+cw/2, y+SL.SECT+66, f(700,34), col, 'center');
        txt(r.winText, bx+cw/2, y+SL.SECT+124, f(800,56), col, 'center');
        txt(t('team.rankTag',{rank:r.rank, p:r.pt}), bx+cw/2, y+SL.SECT+166, f(400,20), C['--sub'], 'center'); });
      let ry=y+SL.SECT+200;
      const lw=260, vw=(CW-lw)/T.cols.length;
      txt(t('team.matrixTitle'), SL.PAD+8, ry+22, f(700,20), C['--sub']);
      T.cols.forEach((cc,i)=> txt(clip(cc.name,f(700,20),vw-10), SL.PAD+lw+vw*i+vw/2, ry+22, f(700,20), tmc(cc.name), 'center'));
      line(ry+44); ry+=SL.HEAD;
      T.events.forEach(ev=>{
        txt(clip(ev.labelRaw+(ev.on?'':' ('+t('team.pending')+')'), f(600,22), lw-12), SL.PAD+8, ry+28, f(600,22), C['--ink']);
        ev.cells.forEach((cell,i)=>{ const bx=SL.PAD+lw+vw*i;
          if(cell.state==='win'||cell.state==='tie'){ c.fillStyle = cell.state==='win'?C['--win-bg']:C['--tie-bg'];
            c.fillRect(bx+4, ry+4, vw-8, 48); }
          const s = cell.state==='mask' ? '？' : cell.state==='none' ? '—'
            : (cell.unitPre?cell.unit:'') + cell.val + (cell.unitPre?'':cell.unit) + (cell.pts?' '+cell.pts:'');
          txt(s, bx+vw/2, ry+28, f(700,26),
            cell.state==='win'?C['--win-ink']:cell.state==='tie'?C['--tie-ink']:C['--ink'], 'center'); });
        line(ry+56); ry+=56; });

    } else if(S.id==='det:m1'){
      /* 1 on 1 の組別結果（明細・PM 判断で v1 に収録）。勝ち/引分の判定はモデルの値をそのまま使う
         （勝者をここで決め直さない＝二重管理を作らない）。色だけに頼らず UP / 引き分け の文字を併記 */
      const d=M.det.m1;
      sectTitle(t('term.match1v1'), y);
      const sideW=330, midW=CW-sideW*2;
      let ry=y+SL.SECT;
      headBand(ry);
      txt(clip(d.teamA,f(700,21),sideW-16), SL.PAD+8, ry+SL.HEAD/2, f(700,21), tmc(d.teamA));
      txt(clip(d.teamB,f(700,21),sideW-16), W-SL.PAD-8, ry+SL.HEAD/2, f(700,21), tmc(d.teamB), 'right');
      ry+=SL.HEAD;
      d.rows.forEach(r=>{
        txt(clip(r.a,f(600,22),sideW-16), SL.PAD+8, ry+SL.ROW/2, f(600,22), C['--ink']);
        txt(clip(r.b,f(600,22),sideW-16), W-SL.PAD-8, ry+SL.ROW/2, f(600,22), C['--ink'], 'right');
        const mx=SL.PAD+sideW;
        if(r.win==='A'||r.win==='B') { c.fillStyle=C['--win-bg']; c.fillRect(mx+8, ry+4, midW-16, SL.ROW-8); }
        else if(r.win==='H')         { c.fillStyle=C['--tie-bg']; c.fillRect(mx+8, ry+4, midW-16, SL.ROW-8); }
        const s = !r.played ? '—' : r.diff>0 ? '◀ '+t('m1.up',{n:r.diff})
          : r.diff<0 ? t('m1.up',{n:-r.diff})+' ▶' : t('m1.as');
        txt(s, mx+midW/2, ry+SL.ROW/2, f(700,22),
          !r.played?C['--sub']:r.win==='H'?C['--tie-ink']:C['--win-ink'], 'center');
        line(ry+SL.ROW); ry+=SL.ROW; });

    } else if(S.id==='det:univ'){
      /* 大学対抗の校別明細（明細・PM 判断で v1 に収録）: 校ごとに「順位・校名・対象n/参加P・平均」行＋メンバー行。
         対象（足切り通過）は文字で併記する＝色だけに頼らない */
      const d=M.det.univ;
      sectTitle(t('term.univ') + (d.every?'   '+t('univ.everyOn'):''), y);
      const nameW=300, cw=110, markW=CW-nameW-cw*3;
      const cols=[{w:nameW,label:t('col.player'),al:'left'},{w:cw,label:'G'},{w:cw,label:t('col.hd')},
        {w:cw,label:t('col.net')},{w:markW,label:t('univ.selMark')}];
      let x=SL.PAD; cols.forEach(cc=>{ cc.x=x; x+=cc.w; });
      let ry=y+SL.SECT;
      headBand(ry);
      cols.forEach(cc=> txt(cc.label, cc.al==='left'?cc.x+8:cc.x+cc.w/2, ry+SL.HEAD/2, f(700,19), C['--sub'], cc.al||'center'));
      ry+=SL.HEAD;
      d.rows.forEach(r=>{
        txt(clip(r.rank+'   '+r.team, f(700,21), nameW+cw-16), SL.PAD+8, ry+SL.SCROW/2, f(700,21), tmc(r.team));
        txt(t('univ.selOf',{n:r.N,p:r.P}) + '  ・  ' + t('univ.avgNetSel') + ' ' + r.r4[0].toFixed(2)
            + '  ・  G ' + r.r4[1].toFixed(2), W-SL.PAD-8, ry+SL.SCROW/2, f(600,19), C['--sub'], 'right');
        line(ry+SL.SCROW); ry+=SL.SCROW;
        r.members.forEach(m=>{
          const ink = m.sel?C['--ink']:C['--sub'];
          txt(clip(m.name,f(600,20),nameW-24), cols[0].x+16, ry+SL.SCROW/2, f(600,20), ink);
          [m.gross,m.hdcp,m.net].forEach((v,i)=> txt(num(v), cols[i+1].x+cols[i+1].w/2, ry+SL.SCROW/2,
            f(i===2?700:400,19), (i===2&&m.sel)?C['--strong']:ink, 'center'));
          if(m.sel) txt(t('univ.selMark'), cols[4].x+cols[4].w/2, ry+SL.SCROW/2, f(700,18), C['--win-ink'], 'center');
          line(ry+SL.SCROW); ry+=SL.SCROW; });
      });

    } else if(S.id==='det:custom'){
      /* 任意対決の明細（明細・PM 判断で v1 に収録）: 幹事が入力した得点をチームごとに並べるだけ。
         勝者の強調は置かない（勝ち/山分けの判定は種目別勝ち点表の正を使う） */
      const d=M.det.custom;
      sectTitle(d.nameRaw || t('term.custom'), y);
      let ry=y+SL.SECT;
      headBand(ry);
      txt(t('col.team'), SL.PAD+8, ry+SL.HEAD/2, f(700,19), C['--sub']);
      txt(t('col.pts'), W-SL.PAD-8, ry+SL.HEAD/2, f(700,19), C['--sub'], 'right');
      ry+=SL.HEAD;
      d.rows.forEach(r=>{
        txt(clip(r.team,f(700,22),CW-220), SL.PAD+8, ry+SL.ROW/2, f(700,22), tmc(r.team));
        txt(r.pts==null?t('custom.unset'):String(r.pts), W-SL.PAD-8, ry+SL.ROW/2, f(800,24), C['--strong'], 'right');
        line(ry+SL.ROW); ry+=SL.ROW; });

    } else if(S.id==='pay'){
      /* ポイント配分（§2 #6）: 全員分・17行以上は2段組。¥ 列は原資がある（pool>0）ときだけ */
      sectTitle(t('result.sub.pts'), y);
      const two=M.pay.rows.length>16, colW=two?CW/2:CW, per=sheetColRows(M.pay.rows.length);
      M.pay.rows.forEach((r,i)=>{
        const bx=SL.PAD+(two?Math.floor(i/per):0)*colW, by=y+SL.SECT+SL.HEAD+(two?i%per:i)*SL.ROW;
        txt(r.rank||'-', bx+30, by+SL.ROW/2, f(700,22), C['--sub'], 'right');
        txt(clip(r.name,f(600,22),colW-230), bx+46, by+SL.ROW/2, f(600,22), C['--ink']);
        txt(r.pt+'pt', bx+colW-130, by+SL.ROW/2, f(700,22), C['--strong'], 'right');
        if(M.pay.pool) txt('¥'+r.yen.toLocaleString(), bx+colW-24, by+SL.ROW/2, f(800,22), C['--strong'], 'right'); });

    } else if(S.id==='foot'){
      /* フッタ: 左＝暫定HDCP の注記（該当時のみ。画像は常に18H基準なので n/18H は併記しない・§14）／右＝76-Club */
      if(M.meta.prov) txt(t('hd.prov')+' ・ '+t('sc.noteProvHd'), SL.PAD, y+20, f(400,18), C['--sub']);
      txt('76-Club', W-SL.PAD, y+20, f(600,18), C['--sub'], 'right');
    }
  }

  /* ---- PNG 化（★すべて同期。非同期の変換 API は使わない＝iOS が共有シートを出せなくなる・§7.2）---- */
  const url = cv.toDataURL('image/png');
  const bin = atob(url.split(',')[1]);
  const bytes = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  const out = { W:cv.width, H:cv.height, k, bytes, url };
  cv.width = cv.height = 0;                      // canvas のメモリを即解放（iOS の合計 384MB 対策・§4.3）
  return out;
}

/* 列幅に収まらない文字列の報告（probe・§12.3）。描画は clip() で … 省略するので破綻はしないが、
   省略が起きた＝情報が落ちたということなので検証で拾えるようにする */
function sheetFit(M, tw, f, CW){
  const out=[], nameW=200;
  M.sc.groups.forEach(gp=> gp.rows.forEach(r=>{ const w=tw(r.name, f(600,20));
    if(w > nameW-12) out.push({kind:'scname', text:r.name, w:Math.round(w)}); }));
  M.ind.forEach(cd=>{ const colW = cd.rows.length>16 ? CW/2 : CW;
    cd.rows.forEach(r=>{ const s=r.name+(r.team?' ('+r.team+')':''), w=tw(s, f(600,22));
      if(w > colW-190) out.push({kind:'indname', text:s, w:Math.round(w)}); }); });
  const payW = M.pay.rows.length>16 ? CW/2 : CW;
  M.pay.rows.forEach(r=>{ const w=tw(r.name, f(600,22));
    if(w > payW-230) out.push({kind:'payname', text:r.name, w:Math.round(w)}); });
  return out;
}
/* スコア表のホール列が 19px の2桁数字を飲めるかの実測値（§11.1 の裏づけを probe で再現可能にする） */
function sheetFitInfo(tw, f, CW){
  const holeW=(CW-200-64*3-56*2)/18;
  return { holeW:Math.round(holeW*10)/10, d2:Math.round(tw('12',f(400,19))*10)/10 };
}

/* ============ 保存の3段構え（§7）============
   sheetImg は揮発（保存領域に入れない）。{bytes, url(objectURL), w, h, k, name, title, sig} */
let sheetImg = null;
function sheetImgCur(){ return sheetImg; }
/* 鮮度チェック（§7.2 の「古い画像を配らせない」）: 画像の元データが変わったらプレビューを捨てる。
   sig は画面側が作る（連携トグル・スコア保存・ゲーム切替・選手名変更などで必ず変わる） */
function sheetImgFresh(sig){
  if(!sheetImg) return null;
  if(sheetImg.sig !== sig){ URL.revokeObjectURL(sheetImg.url); sheetImg=null; return null; }
  return sheetImg;
}
/* ファイル名は ASCII 安全形（§7.3・実測で非ASCII は名前ごと捨てられ拡張子まで消えた）。
   コンペ名は画像の一番上に大きく描かれているので、名前から落ちても取り違えない */
function sheetImgName(meta){
  const m = meta || {};
  const d = String(m.date || new Date().toISOString().slice(0,10)).replace(/-/g,'');
  const s = String(m.name || '').normalize('NFKC').replace(/[^\w]+/g,'-')
    .replace(/^-+|-+$/g,'').slice(0,24).replace(/-+$/,'');
  return '76club-' + (s || 'result') + '-' + d + '.png';
}
/* ---- ① 画像を作成（★ここだけ async でよい＝共有シートを呼ばないので user activation を失っても害がない・§5.3）----
   フォント待ちは document.fonts.load を 1.5秒で打ち切る。fonts.check() は取得失敗でも true を返すので
   分岐には使わない（実測・§5.2）。オフライン（ゴルフ場）でも必ず描き切る。 */
async function sheetFontsReady(){
  try{
    const FF = getComputedStyle(document.body).fontFamily;
    const loads = ['400 24px','600 22px','700 30px','800 46px'].map(s=> document.fonts.load(s+' '+FF));
    await Promise.race([
      Promise.all(loads.concat([document.fonts.ready])).catch(()=>{}),
      new Promise(r=> setTimeout(r, 1500))
    ]);
  }catch(e){ /* 握りつぶす＝フォントが無くても画像は作る（画面と同じフォールバックで描かれる） */ }
}
async function sheetImgMake(){
  const IN = sheetImgInput();            // モデルの合成は画面側（js/results.js）。ここは state を読まない
  if(!IN) return;
  await sheetFontsReady();
  const r = drawSheet(IN.model, {});
  if(sheetImg) URL.revokeObjectURL(sheetImg.url);
  sheetImg = { bytes:r.bytes, url:URL.createObjectURL(new Blob([r.bytes],{type:'image/png'})),
    w:r.W, h:r.H, k:r.k, name:sheetImgName(IN.model.meta), title:IN.model.meta.name || '76-Club', sig:IN.sig };
  renderResult();                        // プレビュー＋共有ボタンを出す（HTML は画面側の責務）
  toast(t('img.done'));
}
/* ---- ② 共有・保存（★onclick から return するまで await を1つも挟まない・§7.2）----
   iOS は transient activation を失うと共有シートが黙って出ないので、ここは完全同期のまま保つ
   （だから「作成」と「共有・保存」の2ボタン構成が必要＝1ボタンにまとめてはいけない）。
   ③ プレビュー長押し（右クリック保存）は常設なので、①②が効かない端末でも必ず持ち出せる。 */
function sheetImgSave(){
  if(!sheetImg) return;
  const file = new File([sheetImg.bytes], sheetImg.name, {type:'image/png'});
  if(navigator.canShare && navigator.canShare({files:[file]})){
    navigator.share({files:[file], title:sheetImg.title}).catch(()=>{});   // 中断（キャンセル）は無視
    return;
  }
  const a = document.createElement('a');
  a.href = sheetImg.url; a.download = sheetImg.name;   // dataURL ではなく objectURL（3〜6MB の文字列を href に置かない）
  a.click();
}
