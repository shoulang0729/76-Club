#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const memory=new Map(), writes=[];
const sandbox={console,Math,JSON,localStorage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>{writes.push(k);memory.set(k,v);}},
  window:{matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){}}};
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
  globalThis.t=(key,values)=>key+(values?JSON.stringify(values):'');
  globalThis.gsSec=(key,title,html)=>html;
  globalThis.tpAnnounceUI=()=>'<button>announce</button>';
  globalThis.tpShare=(w,n)=>String(w/n);
  globalThis.render=()=>{};globalThis.renderBasic=()=>{};globalThis.toast=()=>{};
  const x=fixture(); x.announced.honestJohn=false;
  state.players[0].name='<img src=x onerror=alert(1)>';
  const hiddenHtml=renderTeamHonest(x);
  const settingsHtml=hjSettingsHtml(x);
  x.announced.honestJohn=true;
  const visibleHtml=renderTeamHonest(x);
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
  ({hiddenHtml,settingsHtml,visibleHtml,pendingHtml,allDrawsValid,randomIndependent,excessSafe,
    blankMissing,zeroSaved,invalidRejected,malformedUntouched,cleared});
`,context);
assert.ok(!ui.hiddenHtml.includes('<td>100</td>')&&!ui.hiddenHtml.includes('<td>91</td>'),'Unannounced breakdown is masked');
assert.ok(ui.visibleHtml.includes('<td>100</td>')&&ui.visibleHtml.includes('<td>91</td>'),'Announced complete breakdown is visible');
assert.ok(!ui.pendingHtml.includes('<td>100</td>')&&!ui.pendingHtml.includes('tagwin'),'Stale announcement never reveals incomplete event results');
assert.ok(ui.hiddenHtml.includes('&lt;img')&&ui.settingsHtml.includes('&lt;img')&&!ui.visibleHtml.includes('<img'),'Names are escaped in every surface');
for(const key of ['allDrawsValid','randomIndependent','excessSafe','blankMissing','zeroSaved','invalidRejected','malformedUntouched','cleared'])assert.ok(ui[key],key);
assert.ok(writes.every(k=>k==='golfCompe_v1'),'Edits use only the existing data key');
console.log('Honest John UI regression PASS: masks, escaped names, four-hole controls and declaration edits');

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
  const order=masked.indexOf('>A</span>')<masked.indexOf('>B</span>');
  return {full,closed,nestedPoints,on:event.on,order,serialized:JSON.stringify(view)};
})()`,context);
assert.equal(provenance.full,provenance.closed,'Closed unrelated holes retain announced HJ points');
assert.equal(provenance.full,provenance.nestedPoints,'Nested views retain original HJ source');
assert.equal(provenance.on,true);
assert.equal(provenance.order,true,'Unannounced team ordering must not reveal winner');
assert.ok(!provenance.serialized.includes('hjViewSources'),'View source must never enter JSON');
console.log('Honest John reveal provenance and pre-announcement ordering PASS');
