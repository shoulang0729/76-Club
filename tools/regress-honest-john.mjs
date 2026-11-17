#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const memory=new Map(), writes=[], timers=new Map(), timerHistory=[];
let timerId=0;
const candidateNode={textContent:''};
const spinNode={textContent:'',disabled:false,onclickText:'',setAttribute(k,v){if(k==='onclick')this.onclickText=v;}};
const sandbox={console,Math,JSON,localStorage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>{writes.push(k);memory.set(k,v);}},
  window:{matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){}},
  document:{hidden:false,addEventListener(){},getElementById:()=>candidateNode,querySelector:()=>spinNode},
  setTimeout:callback=>{const id=++timerId;timers.set(id,callback);timerHistory.push(callback);return id;},
  clearTimeout:id=>timers.delete(id),__timers:timers,__timerHistory:timerHistory};
const context=vm.createContext(sandbox);
for(const name of ['state','nav','score','calc','honest-john'])vm.runInContext(fs.readFileSync(`js/${name}.js`,'utf8'),context);
const result=vm.runInContext(`
  const clone=x=>JSON.parse(JSON.stringify(x));
  state.players=['a','b','c','d','solo'].map(id=>({id,name:id,everyType:'every2'}));
  const fixture=()=>{ const g=newGame();
    g.participants=['a','b','c','d','solo'];
    g.teams=[{id:'A',name:'A',memberIds:['a','b','ghost']},{id:'B',name:'B',memberIds:['c','d']},{id:'ghost',name:'Ghost',memberIds:['ghost']}];
    g.honestJohn=newHonestJohn(); g.honestJohn.hidden=g.honestJohn.hidden.map((_,i)=>i<4);
    g.par=Array(18).fill(4); g.hidden=Array(18).fill(true);
    // raw100 - hidden25 + par16 = actual91.
    g.scores=Object.fromEntries(g.participants.map(pid=>[pid,[7,6,6,6,...Array(13).fill(5),10]]));
    g.honestJohn.declarations={a:90,b:92,c:91,d:86};
    g.formats=Object.fromEntries(Object.keys(g.formats).map(k=>[k,false]));
    g.formats.honestJohn=true; g.announced.honestJohn=true;
    state.games=[g]; state.currentGameId=g.id; return g;
  };
  const g=fixture(), a=hjPlayer(g,'a'), b=hjPlayer(g,'b'), c=hjPlayer(g,'c');
  const base=JSON.stringify(hjStanding(g));
  g.womenEvery.enabled=true; g.periaCoef=99; g.periaCap=1;
  const everySame=JSON.stringify(hjStanding(g))===base;
  g.hidden.fill(false); const dpSame=JSON.stringify(hjStanding(g))===base;
  const totals=hjStanding(g).rows.map(r=>r.total);
  const missing=[],pendingPoints=[];
  for(const modify of [g=>delete g.honestJohn.declarations.a,g=>delete g.scores.a,
    g=>delete g.scores.c,g=>{g.scores.a[0]=null;},g=>{g.scores.a[17]='';},
    g=>{g.honestJohn.hidden[4]=true;},g=>{g.honestJohn.hidden[3]=false;},
    g=>{g.honestJohn.hidden=Array(17).fill(false);},g=>{delete g.honestJohn.hidden[6];},
    g=>{g.honestJohn.hidden[4]=0;},g=>{g.par[0]=NaN;},g=>{g.par[0]=0;},
    g=>{g.scores.a[5]=NaN;},g=>{g.scores.a[5]=Infinity;},g=>{g.scores.a[5]=-1;},
    g=>{g.scores.a[5]='5';},g=>{g.scores.a[5]=0;},g=>{delete g.scores.a[5];},
    g=>{g.honestJohn.declarations.a=Infinity;},g=>{g.honestJohn.declarations.a=-1;},
    g=>{g.honestJohn.declarations.a='90';}]){ const x=fixture();modify(x);missing.push(!hjStanding(x).ready);
      const points=teamWinPoints(x);pendingPoints.push(points.wins.every(v=>v===0)&&points.events.every(e=>e.key!=='honestJohn'||(!e.on&&!e.winners.length))); }
  const sparse=fixture(); sparse.scores.c=[]; sparse.scores.d=[];
  const sparsePoints=teamWinPoints(sparse);
  const allTeamMissing=!hjStanding(sparse).ready&&hjStanding(sparse).rows.length===2&&
    sparsePoints.teams.length===2&&sparsePoints.wins.every(v=>v===0)&&
    sparsePoints.events.every(e=>e.key!=='honestJohn'||(!e.on&&!e.winners.length));
  const noSoloNeeded=hjStanding(fixture()).ready;
  const zero=fixture(); zero.honestJohn.declarations.a=0;
  const zeroValid=hjPlayer(zero,'a').valid;
  const tie=fixture();tie.honestJohn.declarations.d=87;
  const ranks=hjStanding(tie).rows.map(r=>r.rank);
  const tieWins=teamWinPoints(tie).wins;
  tie.points.teamEventPts.honestJohn=2;const weightTwo=teamWinPoints(tie).wins;
  tie.points.teamEventPts.honestJohn=0;const weightZero=teamWinPoints(tie).wins;
  const three=fixture();three.teams.push({id:'C',name:'C',memberIds:['solo']});three.honestJohn.declarations.solo=90;
  const threeWins=teamWinPoints(three).wins;
  three.announced.honestJohn=false;const unannouncedWins=teamWinPoints(three).wins;
  const round=fixture(); save(); state=load(); const reloaded=JSON.stringify(hjStanding(curGame()))===JSON.stringify(hjStanding(round));
  ({a,b,c,everySame,dpSame,totals,missing,pendingPoints,allTeamMissing,noSoloNeeded,zeroValid,ranks,reloaded,
    tieWins,weightTwo,weightZero,threeWins,unannouncedWins});
`,context);
assert.deepEqual([result.a.raw,result.a.adjusted,result.a.difference,result.a.penalty],[100,91,1,10]);
assert.deepEqual([result.b.difference,result.b.penalty,result.c.penalty],[-1,30,0]);
assert.deepEqual(Array.from(result.totals),[40,50]);
assert.ok(result.everySame&&result.dpSame,'Raw scores ignore Every, DP and handicap settings');
assert.ok(result.missing.every(Boolean),'Every invalid/missing datum keeps all teams pending');
assert.ok(result.pendingPoints.every(Boolean),'Missing data blocks every win point despite a saved announcement');
assert.ok(result.allTeamMissing&&result.noSoloNeeded&&result.zeroValid);
assert.deepEqual(Array.from(result.ranks),[1,1]);
assert.deepEqual(Array.from(result.tieWins),[0.5,0.5]);
assert.deepEqual(Array.from(result.weightTwo),[1,1]);
assert.deepEqual(Array.from(result.weightZero),[0,0]);
assert.deepEqual(Array.from(result.threeWins),[0,0,1]);
assert.deepEqual(Array.from(result.unannouncedWins),[0,0,0]);
assert.ok(result.reloaded,'Save/load preserves honest settings and arithmetic');
assert.deepEqual(writes,['golfCompe_v1'],'Helpers never persist data or display flags');
console.log('Honest John regression PASS: arithmetic, strict readiness, independent holes, ties and persistence');

const ui=vm.runInContext(`
  globalThis.t=(key,values)=>key==='hj.rank'?values.n+'位':key+(values?JSON.stringify(values):'');
  globalThis.gsSec=(key,title,html)=>html;
  globalThis.tpAnnounceUI=()=>'<button>announce</button>';
  globalThis.tpShare=(w,n)=>String(w/n);
  globalThis.__renders=0;
  globalThis.render=()=>{__renders++;};globalThis.renderResult=()=>{__renders++;};
  globalThis.renderBasic=()=>{};globalThis.toast=()=>{};
  const x=fixture(); x.announced.honestJohn=false;
  state.players[0].name='佐藤 長い名前 Full Middle Family <img src=x onerror=alert(1)>';
  const hiddenHtml=renderTeamHonest(x);
  const settingsHtml=hjSettingsHtml(x);
  const noColumnState=!('columns' in hjView(x));
  const openBeforeAnnounce=renderTeamHonest(x);
  const announceReady=hjCanAnnounce(x);
  x.announced.honestJohn=true;
  const visibleHtml=renderTeamHonest(x);
  const table=visibleHtml.split('<table')[1].split('</table>')[0];
  const grouped=table.includes('hj-team-head')&&table.indexOf('>A</th>')<table.indexOf('>B</th>');
  const noStatusColumn=!table.includes('hj.status')&&!table.includes('hj.missing');
  const plainHeaders=!table.split('</thead>')[0].includes('<button');
  const sumRows=visibleHtml.split('<tr class="hj-total tsum">').slice(1).map(row=>row.split('</tr>')[0]);
  const displayedTotals=hjDisplayStanding(x).rows.map(hjDisplayTotals);
  const explicitRanks=sumRows[0].includes('1位')&&sumRows[1].includes('2位')&&!visibleHtml.includes('rankno');
  const noHero=!visibleHtml.includes('rl-standing')&&!visibleHtml.includes('rl-st-h');
  const operatorClosed=visibleHtml.includes('<details class="hj-operator mt10">');
  const linkPosition=visibleHtml.indexOf('<button>announce</button>');
  const linkPlacement=linkPosition>visibleHtml.indexOf('</table>')&&linkPosition<visibleHtml.indexOf('class="hj-roulette')&&
    !visibleHtml.split('class="hj-operator')[1].includes('<button>announce</button>');
  delete x.scores.b;
  const pendingHtml=renderTeamHonest(x);
  x.scores.b=Array(18).fill(4); const dpBefore=JSON.stringify(x.hidden);
  const allDrawsValid=Array.from({length:20},()=>{hjRandomHidden();return hjHiddenValid(x);}).every(Boolean);
  const randomIndependent=dpBefore===JSON.stringify(x.hidden)&&x.hidden!==x.honestJohn.hidden;
  hjSetHidden(17,true);
  // A fifth check is refused when hole18 was not already among the random four.
  const excessSafe=hjHiddenValid(x);
  x.announced.honestJohn=true;hjSetDeclaration(0,'');
  const blankMissing=hjDeclaration(x,'a')===null&&!x.announced.honestJohn;
  hjSetDeclaration(0,'0');const zeroSaved=hjDeclaration(x,'a')===0;
  hjSetDeclaration(0,'NaN');const invalidRejected=hjDeclaration(x,'a')===0;
  x.honestJohn.hidden=[true];const malformedBefore=JSON.stringify(x.honestJohn);
  hjStanding(x);hjSettingsHtml(x);const malformedUntouched=JSON.stringify(x.honestJohn)===malformedBefore;
  hjClearHidden();const cleared=hjHiddenShape(x)&&!hjHiddenValid(x);
  const pre=fixture();pre.honestJohn.hidden.fill(false);renderTeamHonest(pre);
  const earlyHtml=renderTeamHonest(pre);
  ({hiddenHtml,settingsHtml,visibleHtml,pendingHtml,allDrawsValid,randomIndependent,excessSafe,
    blankMissing,zeroSaved,invalidRejected,malformedUntouched,cleared,noColumnState,
    openBeforeAnnounce,announceReady,grouped,noStatusColumn,plainHeaders,operatorClosed,earlyHtml,linkPlacement,
    sumRows,totals:displayedTotals,explicitRanks,noHero});
`,context);
assert.ok(ui.hiddenHtml.includes('<td>90</td><td>100</td><td>91</td><td>1</td><td>10</td>'),'All five available values display immediately');
assert.ok(ui.openBeforeAnnounce.includes('<td>100</td>')&&ui.openBeforeAnnounce.includes('tagwin'),'Comparable results show before formal announcement');
assert.ok(ui.visibleHtml.includes('<td>100</td>')&&ui.visibleHtml.includes('<td>91</td>'),'Announced complete breakdown is visible');
assert.ok(ui.visibleHtml.includes('tagwin'),'Comparable team winners display without column controls');
assert.ok(!ui.pendingHtml.includes('<td>30</td>')&&!ui.pendingHtml.includes('tagwin'),'Missing member has no invented penalty and blocks team winners');
assert.ok(ui.hiddenHtml.includes('&lt;img')&&ui.settingsHtml.includes('&lt;img')&&!ui.visibleHtml.includes('<img'),'Names are escaped in every surface');
assert.ok(ui.visibleHtml.includes('佐藤 長い名前 Full Middle Family &lt;img'),'Full names remain intact');
assert.ok(ui.earlyHtml.includes('<td>90</td><td>100</td><td>100</td><td>10</td><td>100</td>'),'Every available value displays before drawing four holes');
for(const key of ['allDrawsValid','randomIndependent','excessSafe','blankMissing','zeroSaved','invalidRejected','malformedUntouched','cleared',
  'noColumnState','announceReady','grouped','noStatusColumn','plainHeaders','operatorClosed','linkPlacement','explicitRanks','noHero'])assert.ok(ui[key],key);
assert.deepEqual(JSON.parse(JSON.stringify(ui.totals)),[[182,200,182,0,40],[177,200,182,5,50]],'Sum every column independently; opposite differences still retain individual penalties');
assert.equal(ui.sumRows.length,2);
assert.ok(ui.sumRows[0].includes('<td>182</td><td>200</td><td>182</td><td>0</td><td>40'),'Team total row contains all five sums');
assert.ok(writes.every(k=>k==='golfCompe_v1'),'Edits use only the existing data key');
console.log('Honest John UI regression PASS: always-visible values, plain headers, grouped full names and link placement');

const provisional=vm.runInContext(`(()=>{
  const g=fixture();g.honestJohn.hidden.fill(false);g.announced.honestJohn=false;
  renderTeamHonest(g);
  const values=[],totals=[],labels=[],pointsBlocked=[],candidateStable=[];
  for(let count=0;count<=4;count++){
    const player=hjDisplayPlayer(g,'a'), standing=hjDisplayStanding(g);
    values.push([player.adjusted,player.difference,player.penalty]);totals.push(standing.rows.map(r=>r.total));
    labels.push(renderTeamHonest(g).includes('hj.provisional')===(count<4));
    pointsBlocked.push(teamWinPoints(g).wins.every(v=>v===0));
    if(count<4){hjStartSpin();const before=JSON.stringify(hjDisplayStanding(g));__timerHistory.at(-1)();
      candidateStable.push(before===JSON.stringify(hjDisplayStanding(g)));
      hjSpin.candidates=[count,...hjSpin.candidates.filter(v=>v!==count)].slice(0,4-count);hjCommitSpin(hjSpin.generation,count);}
  }
  const noDisplayFlags=!('columns' in hjView(g));
  const finalReady=hjStanding(g).ready&&hjCanAnnounce(g);
  g.announced.honestJohn=true;save();const published=teamWinPoints(g).wins;
  g.scores.a[4]++;save();
  const inputChangesRecomputed=hjDisplayPlayer(g,'a').adjusted===92&&hjDisplayPlayer(g,'a').penalty===20&&!g.announced.honestJohn;
  const absent=fixture();absent.honestJohn.hidden.fill(false);delete absent.honestJohn.declarations.a;
  const noDeclaration=hjDisplayPlayer(absent,'a');
  const noDeclaredSafe=noDeclaration.adjusted===100&&noDeclaration.difference===null&&noDeclaration.penalty===null&&!hjDisplayStanding(absent).ready;
  const declarationOnlyTotals=hjDisplayTotals(hjDisplayStanding(absent).rows[0]);
  delete absent.scores.b;const noScores=hjDisplayPlayer(absent,'b');
  const missingSafe=noScores.adjusted===null&&noScores.penalty===null&&hjDisplayStanding(absent).rows.length===2&&
    hjDisplayStanding(absent).rows[0].members.length===2&&hjDisplayStanding(absent).rows[0].total===null;
  const scoresOnly=clone(absent);scoresOnly.honestJohn.declarations.a=90;
  const scoresOnlyTotals=hjDisplayTotals(hjDisplayStanding(scoresOnly).rows[0]);
  absent.honestJohn.hidden.fill(true);const excess=hjDisplayPlayer(absent,'c');
  const excessSafe=excess.adjusted===null&&excess.penalty===null&&!hjDisplayStanding(absent).ready;
  const missingTotals=hjDisplayStanding(absent).rows.map(hjDisplayTotals);
  const noRankWhenMissing=!renderTeamHonest(absent).includes('1位')&&!renderTeamHonest(absent).includes('2位');
  absent.honestJohn.hidden=[true];const malformedSafe=hjDisplayPlayer(absent,'c').adjusted===null;
  return {values,totals,labels,pointsBlocked,candidateStable,noDisplayFlags,finalReady,published,inputChangesRecomputed,
    noDeclaredSafe,missingSafe,excessSafe,malformedSafe,missingTotals,noRankWhenMissing,declarationOnlyTotals,scoresOnlyTotals};
})()`,context);
assert.deepEqual(JSON.parse(JSON.stringify(provisional.values)),[[100,10,100],[97,7,70],[95,5,50],[93,3,30],[91,1,10]]);
assert.deepEqual(JSON.parse(JSON.stringify(provisional.totals)),[[180,230],[120,170],[80,130],[40,90],[40,50]]);
assert.deepEqual(Array.from(provisional.published),[1,0],'Only four confirmed holes plus announcement publish points');
for(const key of ['noDisplayFlags','finalReady','inputChangesRecomputed','noDeclaredSafe','missingSafe','excessSafe','malformedSafe','noRankWhenMissing'])assert.ok(provisional[key],key);
assert.deepEqual(Array.from(provisional.missingTotals[0]),[null,null,null,null,null],'Missing individual values leave the corresponding team sums empty');
assert.deepEqual(Array.from(provisional.declarationOnlyTotals),[null,200,200,null,null],'Missing declaration does not erase valid gross and adjusted totals');
assert.deepEqual(Array.from(provisional.scoresOnlyTotals),[182,null,null,null,null],'Missing scores do not erase a valid declaration total');
assert.ok(provisional.labels.every(Boolean)&&provisional.pointsBlocked.every(Boolean)&&provisional.candidateStable.every(Boolean));
console.log('Honest John provisional regression PASS: confirmed 0–4 arithmetic, input updates, missing data and formal publication gate');

const draws=vm.runInContext(`(()=>{
  const x=fixture();x.honestJohn.hidden.fill(false);renderTeamHonest(x);
  const dp=JSON.stringify(x.hidden), counts=[],unique=[],remaining=[];
  hjStartSpin();const generation=hjSpin.generation;
  for(let i=0;i<4;i++){
    remaining.push(hjSpin.candidates.length);
    const callback=__timerHistory.at(-1), before=__renders;
    callback();const onlyCandidateUpdated=before===__renders;
    const frameUnique=new Set(hjSpin.candidates).size===4-i&&hjSpin.candidates.every(v=>!x.honestJohn.hidden[v]);
    const stopped=hjSpin.candidates[0];hjCommitSpin(generation,i);hjCommitSpin(generation,i);
    counts.push(x.honestJohn.hidden.filter(Boolean).length);
    unique.push(onlyCandidateUpdated&&frameUnique&&x.honestJohn.hidden[stopped]&&
      (i===3?hjSpin===null:hjSpin&&hjSpin.generation===generation&&hjSpin.candidates.length===3-i));
  }
  const exactFour=hjHiddenValid(x)&&new Set(hjDrawOrder(x)).size===4;
  hjStartSpin();const finishedIdle=hjSpin===null;
  const independent=JSON.stringify(x.hidden)===dp;
  const old=JSON.parse(JSON.stringify(x));state.games=[old];state.currentGameId=old.id;
  const reloadDisplay=!('columns' in hjView(old))&&renderTeamHonest(old).includes('<td>100</td>'), oldFour=hjDrawOrder(old).length===4;
  hjStartSpin();const oldIdle=hjSpin===null;
  const partial=fixture();partial.honestJohn.hidden.fill(false);partial.honestJohn.hidden[8]=true;partial.honestJohn.hidden[13]=true;
  const loaded=JSON.parse(JSON.stringify(partial));state.games=[loaded];state.currentGameId=loaded.id;
  hjStartSpin();const resumedCandidate=hjSpin.candidates.length===2&&hjSpin.candidates.every(v=>!loaded.honestJohn.hidden[v]);
  hjCommitSpin(hjSpin.generation,2);const resumedCount=loaded.honestJohn.hidden.filter(Boolean).length;
  hjStartSpin();const stale=__timerHistory.at(-1), staleGeneration=hjSpin.generation;
  const other=fixture();const before=JSON.stringify(other.honestJohn.hidden);
  hjStopSpin();hjStopSpin();stale();hjCommitSpin(staleGeneration,3);
  const noCrossWrite=JSON.stringify(other.honestJohn.hidden)===before&&loaded.honestJohn.hidden.filter(Boolean).length===3&&hjSpin===null;
  hjClearHidden();hjStartSpin();const hiddenCallback=__timerHistory.at(-1), hiddenGeneration=hjSpin.generation;
  document.hidden=true;hiddenCallback();hjCommitSpin(hiddenGeneration,0);document.hidden=false;
  const backgroundSafe=other.honestJohn.hidden.filter(Boolean).length===0&&hjSpin===null;
  const resumeButton=document.querySelector('.hj-spin-button').onclickText==='hjStartSpin()';
  hjStartSpin();const oldCallback=__timerHistory.at(-1), oldGeneration=hjSpin.generation;
  hjStopSpin();hjStartSpin();const currentGeneration=hjSpin.generation;
  oldCallback();hjCommitSpin(oldGeneration,0);
  const newerSpinSafe=hjSpin&&hjSpin.generation===currentGeneration&&other.honestJohn.hidden.filter(Boolean).length===0;
  hjStopSpin();
  hjStartSpin();const removedCallback=__timerHistory.at(-1);state.games=[];hjBeforeSave(state);removedCallback();
  const deletedSafe=hjSpin===null;
  const external=fixture();external.honestJohn.hidden.fill(false);renderTeamHonest(external);hjStartSpin();
  hjCommitSpin(hjSpin.generation,0);const ownSaveContinues=hjSpin!==null;
  external.scores.a[0]++;save();const externalSaveStops=hjSpin===null;
  return {counts,unique,remaining,exactFour,finishedIdle,independent,reloadDisplay,oldFour,oldIdle,resumedCandidate,resumedCount,noCrossWrite,backgroundSafe,resumeButton,newerSpinSafe,deletedSafe,ownSaveContinues,externalSaveStops};
})()`,context);
assert.deepEqual(Array.from(draws.counts),[1,2,3,4],'Each STOP commits exactly one hole, even on double click');
assert.deepEqual(Array.from(draws.remaining),[4,3,2,1],'One START rotates all remaining slots throughout all four STOPs');
assert.equal(draws.resumedCount,3,'Reloaded partial draw continues from the remaining holes');
for(const key of ['exactFour','finishedIdle','independent','reloadDisplay','oldFour','oldIdle','resumedCandidate','noCrossWrite','backgroundSafe','resumeButton','newerSpinSafe','deletedSafe','ownSaveContinues','externalSaveStops'])assert.ok(draws[key],key);
assert.ok(draws.unique.every(Boolean),'Each draw excludes selected holes and ticks avoid full rerenders');
console.log('Honest John roulette regression PASS: four unique stops, old/partial reload, stale callbacks and context cancellation');

const reset=vm.runInContext(`(()=>{
  const g=fixture();g.honestJohn.hidden.fill(false);
  g.scores.a=[8,8,7,7,...Array(12).fill(4),6,6];
  g.scores.b=[8,8,7,7,...Array(12).fill(6),3,3];
  g.scores.c=[9,9,8,8,...Array(14).fill(4)];
  g.scores.d=[9,9,8,8,...Array(13).fill(5),9];
  g.honestJohn.declarations={a:70,b:85,c:65,d:81};
  renderTeamHonest(g);
  const inputs=JSON.stringify([g.scores,g.honestJohn.declarations]);
  hjStartSpin();for(let step=0;step<4;step++){
    hjSpin.candidates=[step,...hjSpin.candidates.filter(v=>v!==step)].slice(0,4-step);hjCommitSpin(hjSpin.generation,step);
  }
  g.announced.honestJohn=true;save();const final=hjDisplayStanding(g).rows.map(r=>r.total);
  hjResetDraw();const html=renderTeamHonest(g), display=hjDisplayStanding(g);
  const sumRows=html.split('<tr class="hj-total tsum">').slice(1).map(row=>row.split('</tr>')[0]);
  return {final,reset:display.rows.map(r=>r.total),adjusted:hjDisplayPlayer(g,'a').adjusted,
    preserved:inputs===JSON.stringify([g.scores,g.honestJohn.declarations])&&!('columns' in hjView(g)),
    cleared:!g.announced.honestJohn&&hjSpin===null&&hjDrawOrder(g).length===0&&g.honestJohn.hidden.every(v=>!v),
    htmlCorrect:sumRows[0].includes('<td>430')&&sumRows[1].includes('<td>520')&&html.includes('<td>70</td><td>90</td><td>90</td><td>20</td><td>200</td>')&&
      sumRows.every(row=>row.includes('hj.provisional'))&&!sumRows.some(row=>row.includes('<td>150')||row.includes('<td>160'))};
})()`,context);
assert.deepEqual(Array.from(reset.final),[150,160]);
assert.deepEqual(Array.from(reset.reset),[430,520],'Reset recalculates every penalty and team total from zero confirmed holes');
assert.equal(reset.adjusted,90,'Adjusted value returns immediately to raw gross');
assert.ok(reset.preserved&&reset.cleared&&reset.htmlCorrect,'Reset preserves every input while clearing draw/link state and displaying all recalculated values');
console.log('Honest John numeric reset PASS: final 150/160 returns to visible raw-based 430/520');

const invalidation=vm.runInContext(`(()=>{
  const changes=[g=>{g.scores.a[0]++;},g=>{g.par[0]++;},g=>{g.honestJohn.declarations.a++;},
    g=>{g.honestJohn.hidden[0]=false;},g=>{g.participants.pop();},g=>{g.teams[0].memberIds.pop();}];
  const detected=changes.map(change=>{const g=fixture();hjBeforeSave(state);hjView(g);
    change(g);save();return !g.announced.honestJohn&&!('columns' in hjView(g));});
  const unchanged=fixture();hjBeforeSave(state);hjView(unchanged);
  unchanged.name='Renamed';unchanged.womenEvery.enabled=true;unchanged.hidden.fill(false);save();
  const irrelevantPreserved=unchanged.announced.honestJohn;
  const imported=JSON.parse(JSON.stringify(unchanged));state.games=[imported];state.currentGameId=imported.id;save();
  const importedPreserved=imported.announced.honestJohn&&!('columns' in hjView(imported));
  imported.scores.a[1]++;save();
  const firstImportedChange=!imported.announced.honestJohn;
  const serial=JSON.stringify(imported);
  return {detected,irrelevantPreserved,importedPreserved,firstImportedChange,serial};
})()`,context);
assert.ok(invalidation.detected.every(Boolean),'Save hook cancels announcement for every relevant edit without adding column state');
assert.ok(invalidation.irrelevantPreserved&&invalidation.importedPreserved&&invalidation.firstImportedChange);
assert.ok(!/columns|generation|candidate|hjViews|hjSignatures/.test(invalidation.serial),'Presentation state never enters saved data');
console.log('Honest John invalidation regression PASS: all input edits, import baselines and data/display separation');

const initialState=vm.runInContext('fixture(); JSON.stringify(state)',context);
const initialContext=vm.createContext({...sandbox,localStorage:{getItem:k=>k==='golfCompe_v1'?initialState:null,setItem(){}}});
for(const name of ['state','nav','calc','honest-john'])vm.runInContext(fs.readFileSync(`js/${name}.js`,'utf8'),initialContext);
assert.equal(vm.runInContext(`curGame().scores.a[0]++;save();curGame().announced.honestJohn`,initialContext),false,
  'Module initialization tracks existing games before their first edit or render');

// HJ announcement is independent of other events' hole reveal controls.
vm.runInContext(fs.readFileSync('js/results.js','utf8'),context);
const provenance=vm.runInContext(`(()=>{
  const g=fixture();
  const full=JSON.stringify(computePoints(g));
  const view=viewGameN(g,0);
  const closed=JSON.stringify(computePoints(view));
  const event=teamWinPoints(view).events.find(e=>e.key==='honestJohn');
  const nested=viewGameN(view,0);
  const nestedPoints=JSON.stringify(computePoints(nested));
  g.announced.honestJohn=false;
  // Before announcement, the lower total belongs to team B; row order must still be A, B.
  g.honestJohn.declarations={a:86,b:86,c:91,d:91};
  const masked=renderTeamHonest(g);
  const order=masked.indexOf('>A</th>')<masked.indexOf('>B</th>');
  return {full,closed,nestedPoints,on:event.on,order,serialized:JSON.stringify(view)};
})()`,context);
assert.equal(provenance.full,provenance.closed,'Closed unrelated holes retain announced HJ points');
assert.equal(provenance.full,provenance.nestedPoints,'Nested views retain original HJ source');
assert.equal(provenance.on,true);
assert.equal(provenance.order,true,'Unannounced team ordering must not reveal winner');
assert.ok(!provenance.serialized.includes('hjViewSources'),'View source must never enter JSON');
console.log('Honest John reveal provenance and pre-announcement ordering PASS');
