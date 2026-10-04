/* ============================ SHEET MODEL（結果表1枚画像の表示モデル・純データ） ============================
   設計: docs/handoff/2026-09-23-result-image-export.md §6（契約は §6.2・使う既存関数は §6.3 の表）

   ★契約（load-bearing・崩すと設計の前提が消える）:
   1) 新しい計算を1つも書かない。js/calc.js の既存関数を呼ぶだけ（§6.3）。js/calc.js は1バイトも変更していない。
   2) DOM を読まない／HTML を組まない／i18n 関数を呼ばない／チーム色の解決関数を呼ばない／
      エスケープを通さない／ブラウザの保存領域を触らない。
      → ラベルは **i18n キー（labelKey）** で返し訳語は描画側、色は **生のチーム名** を返し解決は描画側（§6.2）。
      → 返り値が言語にもテーマにも依存しない＝vm で JSON.stringify を丸ごとスナップショット比較できる
        （tools/regress-sheet.mjs・§12.2）。
   3) 発表演出の揮発状態（ホール開封数・合計値トグル・順位行の目隠し・ニアドラの旗の伏せ）を
      **1つも参照しない**（§3）。配布物の中身が「幹事が押したボタンの履歴」で変わる事故を防ぐため、
      画像は常に18ホール・全員・全合計を持つ。呼び出し側も生ゲーム（g0）を渡すこと。
   4) ただし g.announced（種目の連携＝幹事が明示的に押した宣言）は **データ**なので従う（§3 根拠②）。
      未連携の種目は明細を載せず pending:true を返す（描画側が ？ 相当の印を出す）。
      チーム総合（種目別勝ち点表）は tpShareModel(g) が同じ規律で ？ マスクするので本モデルには含めない
      （描画側が {...sheetModel(g), tp:tpShareModel(g)} と合成する・§6.1）。
   5) 文字列は生（未エスケープ）。canvas は HTML エンティティを解さないため（§6.2）。
   6) 出さない個人情報: 生年月日・性別・退会フラグ（§9）。本モデルは player.birth / player.gender を参照しない
      （タイブレークは ranked() の内部＝calc.js 側の責務）。

   ★明細セクション（det）について（PM 判断・設計 §10 Q4 の既定を広げた）:
   設計の既定は「1on1・大学対抗・任意対決の明細は画像に入れない」だが、**モデルは取れるものを全部持ち、
   何を描くかは描画側（PR-2）が決める**という分担にするため det を持たせてある。採用していない種目は null、
   データが無い／未連携の種目は rows:[] を返す。det で呼ぶのも既存関数だけ（新しい計算は無い）。 */

/* ---- 小ヘルパ（すべて state.players と g だけを読む） ---- */
function smPlayer(pid){ return state.players.find(x=>x.id===pid)||null; }
function smName(pid){ const p=smPlayer(pid); return p?(p.name||''):''; }
function smTeamName(g,pid){ const T=(g.teams||[]).find(x=>(x.memberIds||[]).includes(pid)); return T?(T.name||''):''; }
/* 参加者（選手マスターに実在するものだけ）＝画面 renderResult の parts と同じ母数 */
function smParts(g){ return (g.participants||[]).filter(pid=>smPlayer(pid)); }
/* 数値の表示文字列（言語非依存）。calc 側で丸め済みなので再丸めはしない＝値は不変 */
function smVal(v){ return v==null?'':String(v); }
/* エブリ適用後の18ホール（未入力は null に正規化・配列長は必ず18） */
function smHoles(g,pid){ const a=adjArr(g,pid), out=[];
  for(let i=0;i<18;i++){ const v=a[i]; out.push((v==null||v==='')?null:Number(v)); }
  return out; }
/* 行の並び（表示状態を読まずに決める）: ネット昇順＝画面スコア表の既定指標と同じ ranked()＋tieBreak。
   値を持たない選手は ranked() から落ちるので元の順序で末尾に付ける（画面 sortPids と同型） */
function smOrder(g,pids){ const ord=ranked(pids, pid=>netScore(g,pid), 'asc').map(r=>r.pid);
  return ord.concat(pids.filter(pid=>!ord.includes(pid))); }

/* ---- セクション2: スコア表（§2 #2） ---- */
function smScRow(g,pid){ const av=adjArr(g,pid);
  return { name:smName(pid), team:smTeamName(g,pid), holes:smHoles(g,pid),
    out:sum(av,0,9), inn:sum(av,9,18),
    gross:effGross(g,pid), hd:periaHdcp(g,pid), net:netScore(g,pid) }; }
/* チーム設定があればチームごとにグループ化（team=生のチーム名）。未所属の参加者は team:'' の最終グループ。
   teamMembers(g,T) は「参加中かつ選手マスターに実在」で絞り込み済み（ゴースト対策・calc.js の正） */
function smScGroups(g,parts){
  const groups=[], teams=teamsOf(g);
  if(!teams.length) return [{ team:'', rows:smOrder(g,parts).map(pid=>smScRow(g,pid)) }];
  const seen={};
  teams.forEach(T=>{ const mem=teamMembers(g,T); if(!mem.length)return;
    mem.forEach(pid=>{ seen[pid]=1; });
    groups.push({ team:T.name||'', rows:smOrder(g,mem).map(pid=>smScRow(g,pid)) }); });
  const rest=parts.filter(pid=>!seen[pid]);
  if(rest.length) groups.push({ team:'', rows:smOrder(g,rest).map(pid=>smScRow(g,pid)) });
  return groups;
}

/* ---- セクション3: 個人戦の順位（§2 #3） ----
   採用判定は chFormats(g)（α/β 反映済み）。値と並びは画面の順位カードと同じ関数・同じ引数
   （ranked()＋同じ valFn＝表示側でソートし直さない・§6.4）。unit は言語非依存のリテラル（pt） */
function smInd(g,parts){
  const F=chFormats(g), out=[];
  const add=(key,labelKey,valFn,dir,unit)=>{ out.push({ key, labelKey, dir, unit,
    rows:ranked(parts,valFn,dir).map(r=>({ rank:r.rank, name:smName(r.pid), team:smTeamName(g,r.pid),
      val:smVal(r.v), unit })) }); };
  if(F.gross)      add('gross','term.gross',           pid=>effGross(g,pid),       'asc',  '');
  if(F.net)        add('net','term.net',               pid=>netScore(g,pid),       'asc',  '');
  if(F.stableford) add('stableford','term.stableford', pid=>stablefordPts(g,pid),  'desc', 'pt');
  if(F.olympic)    add('olympic','term.olympic',       pid=>olympicPts(g,pid),     'desc', 'pt');
  if(F.callaway)   add('callaway','term.callaway',     pid=>callawayNet(g,pid),    'asc',  '');
  if(F.nassau)     add('nassau','pts.nassauTotal',     pid=>nassauTotalNet(g,pid), 'asc',  '');
  return out;
}

/* ---- セクション4: ニアピン／ドラコンの旗（§2 #4） ----
   旗1本＝(kind,hole,set)。2セット運用（prizes.twoSets）では set に OUT/IN のリテラルが入り、
   1セット（既定）では set:''。勝者未登録＝name:''（＝該当なし）。hole は 0-based の内部 index、
   holeNo は表示用の 1-based（描画側で ±1 しないで済むよう両方返す）。 */
function smFlags(g){
  const F=chFormats(g);
  if(!(F.niadoraInd||F.niadoraTeam)) return [];
  const S=prizeSetCount(g), out=[];
  const cells=[...niapinHolesOf(g).map(h=>({h,kind:'np'})), ...draconHolesOf(g).map(h=>({h,kind:'dc'}))]
    .sort((a,b)=>a.h-b.h);
  cells.forEach(c=>{ for(let s=1;s<=S;s++){ const pid=prizeWinnerOf(g,c.kind,c.h,s);
    out.push({ kind:c.kind, hole:c.h, holeNo:c.h+1, set:S===2?prizeSetLabel(s):'',
      name:pid?smName(pid):'', team:pid?smTeamName(g,pid):'' }); } });
  return out;
}

/* ---- セクション6: ポイント配分（§2 #6） ----
   値・並びは配分タブ（renderStanding）と同じ computePayout(g) ＋ pt 降順。
   pt が 0 の行は順位を付けない（画面の '-' と同じ）＝rank:null。yen は pool>0 のときだけ意味を持つ */
function smPay(g,parts){
  const R=computePayout(g);
  const rows=parts.map(pid=>({ pid, pt:R.pts[pid]||0, yen:R.payout[pid]||0 }))
    .sort((a,b)=>b.pt-a.pt)
    .map((r,i)=>({ rank:r.pt>0?(i+1):null, name:smName(r.pid), team:smTeamName(g,r.pid), pt:r.pt, yen:r.yen }));
  return { pool:R.pool, total:R.total, rows };
}

/* ---- 明細（det・PM 判断で追加。採用していない種目は null） ----
   連携（g.announced）が済んでいない種目は rows:[] ＋ pending:true＝結論値も明細もモデルに載せない
   （未連携の種目は ？ のまま／tpShareModel の規律と同じ・§3） */
function smDetM1(g){
  if(!chFormats(g).match1v1) return null;
  const on=!!(g.announced||{}).match1v1, v=m1Valid(g);
  const d={ labelKey:'term.match1v1', on, pending:!on,
    teamA:v?(v.A.name||''):'', teamB:v?(v.B.name||''):'', rows:[] };
  if(!on||!v) return d;
  d.rows=m1ValidPairs(g).map(([a,b])=>{ const r=m1Result(g,a,b);
    return { a:smName(a), b:smName(b), upA:r.upA, upB:r.upB, half:r.half, played:r.played, diff:r.diff,
      win:r.played?(r.diff>0?'A':r.diff<0?'B':'H'):'' }; });
  return d;
}
function smDetUniv(g){
  if(!chFormats(g).univMatch) return null;
  const on=!!(g.announced||{}).univMatch;
  const d={ labelKey:'term.univ', on, pending:!on, every:!!(g.univ&&g.univ.every), rows:[] };
  if(!on) return d;
  d.rows=uvStanding(g).rows.map(r=>({ team:r.t.name||'', rank:r.rank, P:r.P, N:r.N, r4:r.r4.slice(),
    members:r.members.map(pid=>({ name:smName(pid), gross:uvGrossA(g,pid), hdcp:uvHdcpA(g,pid),
      net:uvNetA(g,pid), sel:r.sel.includes(pid) })) }));
  return d;
}
function smDetCustom(g){
  if(!chFormats(g).customMatch) return null;
  const on=!!(g.announced||{}).customMatch;
  /* nameRaw＝幹事が入力した種目名（生・空なら描画側が labelKey にフォールバック）。
     ユーザー入力なので esc は通さない＝canvas 用（§6.2）。DOM に出すのは描画側の責務 */
  const d={ labelKey:'term.custom', nameRaw:(((g.custom||{}).name)||'').trim(), on, pending:!on, rows:[] };
  if(!on) return d;
  d.rows=teamsOf(g).map(T=>({ team:T.name||'', pts:customPts(g,T) }));
  return d;
}

/* ============ 本体 ============
   g は **生ゲーム**（開封マスクを通さないもの）を渡す（§3・§6.4）。 */
function sheetModel(g){
  const parts=smParts(g);
  return {
    meta:{ name:g.name||'', date:g.date||'', course:g.course||'', n:parts.length,
      prov:periaProv(g,parts) },                       // prov=暫定HDCP（1人でも18H未入力なら true・§14）
    sc:{ par:(g.par||[]).slice(), parOut:sum(g.par,0,9), parIn:sum(g.par,9,18),
      hidden:(g.hidden||[]).map(v=>!!v), groups:smScGroups(g,parts) },
    ind:smInd(g,parts),
    flags:smFlags(g),
    pay:smPay(g,parts),
    det:{ m1:smDetM1(g), univ:smDetUniv(g), custom:smDetCustom(g) }
  };
}
