#!/usr/bin/env node
// Composite match contract: exact mean, validity, legacy points, reveal/start/edit lifecycle and cleanup.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const elements={}; let timer=0;
const sandbox={assert,console, elements, window:{addEventListener:()=>{},matchMedia:()=>({matches:false,addEventListener:()=>{}})}, localStorage:{getItem:()=>null,setItem:()=>{}},
  document:{addEventListener:()=>{},getElementById:id=>elements[id]||null},
  setTimeout:()=>++timer,clearTimeout:()=>{},clearInterval:()=>{},confirm:()=>true,
  t:key=>key,toast:()=>{}};
const ctx=vm.createContext(sandbox);
for(const file of ['state','nav','score','basic','players','calc','results','results-m1','roulette','sheet-model'])
  vm.runInContext(fs.readFileSync(`js/${file}.js`,'utf8'),ctx,{filename:`js/${file}.js`});
vm.runInContext(`
renderPlayers=()=>{}; renderResult=()=>{}; tpAnnounceUI=()=>''; toast=()=>{};
const eq=(a,b,msg)=>assert.equal(JSON.stringify(a),JSON.stringify(b),msg);
const reset=()=>{
  state.players=['a','a2','b','b2'].map(id=>({id,name:id,everyType:'none',gender:'M',retired:false}));
  const g=newGame(); g.id='G'; g.participants=state.players.map(p=>p.id);
  g.teams=[{id:'A',name:'A',memberIds:['a','a2']},{id:'B',name:'B',memberIds:['b','b2']}];
  g.formats=Object.fromEntries(Object.keys(g.formats).map(k=>[k,k==='match1v1']));
  g.points.teamRankPts=[]; g.announced.match1v1=true;
  g.scores={a:Array(18).fill(5),a2:Array(18).fill(4),b:Array(18).fill(4),b2:Array(18).fill(5)};
  g.match1v1={teamA:'A',teamB:'B',pairs:[['a',['b','b2']]],starts:{}};
  state.games=[g]; state.currentGameId='G'; migrate(state); m1Opened.clear(); m1AutoStop(); m1Editing=null;
  revealHoles=18; m1RevealMode='all'; return g;
};
let g=reset();
assert.equal(m1HoleWin(g,'a',['b','b2'],0),'B','4.5 must beat5');
assert.equal(m1HoleWin(g,['a','a2'],'b2',0),'A','reverse2v1 comparison');
assert.equal(m1HoleWin(g,['a','a2'],['b','b2'],0),'H','2v2 half');
assert.equal(m1SideHole(g,['b','b2'],0),4.5);
g.scores.b[0]=null; assert.equal(m1HoleWin(g,'a',['b','b2'],0),null);
g.scores.b[0]=''; assert.equal(m1HoleWin(g,'a',['b','b2'],0),null);
g.scores.b[0]=6; g.scores.b2[0]=6; g.womenEvery.enabled=true; state.players.find(p=>p.id==='b').everyType='every1';
assert.equal(m1SideHole(g,['b','b2'],0),5.5); assert.equal(m1HoleWin(g,'a',['b','b2'],0),'A');
state.players.find(p=>p.id==='b2').everyType='every2';
assert.equal(m1SideHole(g,['b','b2'],0),4.5); assert.equal(m1HoleWin(g,'a',['b','b2'],0),'B');
g=reset();
const key=m1Key('a',['b','b2']);
assert.equal(key,m1Key('a',['b2','b'])); assert.equal(key.includes(':'),false);
assert.notEqual(m1Key(['a,b','c'],'d'),m1Key(['a','b,c'],'d'));
assert.equal(m1Key('a','b'),'a:b');
assert.equal(m1Key("a'",['b','b2']).includes("'"),false,'inline-handler-safe composite key');
for(const side of [[],['b'],Object.assign(Array(2),{0:'b'}),['b','b','b2'],['b','b'],[['b'],'b2'],['b',null],['b',1],{},null,'','ghost','a']){
  g.match1v1.pairs=[['a',side]]; assert.equal(m1ValidPairs(g).length,0,JSON.stringify(side));
  assert.doesNotThrow(()=>m1EditCard(g)); assert.doesNotThrow(()=>renderMatch1v1Parts(g));
}
g.match1v1.pairs=[null,{},42,['a'],['a','b','b2'],['a',['b','b2']]];
assert.equal(m1ValidPairs(g).length,1); assert.doesNotThrow(()=>m1EditCard(g)); assert.doesNotThrow(()=>renderMatch1v1Parts(g));
g.participants=g.participants.filter(p=>p!=='b2'); assert.equal(m1ValidPairs(g).length,0);
g.participants.push('b2'); g.teams[1].memberIds=['b']; assert.equal(m1ValidPairs(g).length,0);
g.teams[1].memberIds.push('b2'); g.match1v1.teamB='A'; assert.equal(m1ValidPairs(g).length,0);
g=reset();
// Win, loss and draw composites give no personal match points to either side.
for(const pair of [['a',['b','b2']],[['a','a2'],'b'],[['a','a2'],['b','b2']]]){
  g.match1v1.pairs=[pair]; eq(computePoints(g),{a:0,a2:0,b:0,b2:0});
}
g.match1v1.pairs=[['a','b'],['a',['b','b2']]];
eq(computePoints(g),{a:0,a2:0,b:2,b2:0},'legacy1v1 still wins2points');
g.match1v1.pairs=[['a','b2']]; eq(computePoints(g),{a:1,a2:0,b:0,b2:1},'legacy draw');
g.match1v1.pairs=[['a',['b','b2']]];
let tw=teamWinPoints(g); eq(tw.events.find(e=>e.key==='match1v1').vals,[0,1],'composite counts as one match');
// Export carries joined real names and the exact mean, and follows announced flag.
const detail=smDetM1(g); assert.equal(detail.rows[0].b,'b＋b2'); assert.equal(detail.rows[0].sideB.average[0],4.5);
eq(detail.rows[0].sideB.members.map(p=>p.name),['b','b2']);
g.announced.match1v1=false; assert.equal(smDetM1(g).rows.length,0); g.announced.match1v1=true;
const form=(a,a2,b,b2)=>{ for(const [id,value] of Object.entries({m1selA:a,m1selA2:a2,m1selB:b,m1selB2:b2}))elements[id]={value}; };
form('a','','b2','b'); m1AddPair(); assert.equal(g.match1v1.pairs.length,1,'order-independent duplication');
form('a','','b','b'); m1AddPair(); assert.equal(g.match1v1.pairs.length,1,'duplicate side member rejected');
form('a','','ghost','b'); m1AddPair(); assert.equal(g.match1v1.pairs.length,1,'stale selector rejected');
// Starts/reveal/autoplay share canonical identity and mask every member.
m1SetStart(0,10); assert.equal(m1StartOf(g,key),10);
m1SetStart(0,7); assert.equal(m1StartOf(g,key),7); m1SetStart(0,10);
g.match1v1.pairs[0][1].reverse(); assert.equal(m1StartOf(g,m1Key(...g.match1v1.pairs[0])),10);
let masked=m1ViewGameN(g,1,10); assert.equal(m1HoleWin(masked,'a',['b','b2'],9),'B'); assert.equal(m1HoleWin(masked,'a',['b','b2'],0),null);
m1RevealMode='one'; m1OpenNext(); assert.equal(m1Opened.get(key),0);
assert.equal(renderMatch1v1Parts(g).body.includes('4.5'),false,'zero reveal leaks no mean');
m1Holes(key,'next'); assert.equal(renderMatch1v1Parts(g).body.includes('4.5'),true);
activeTab='result'; resGrp='team'; resGame.team='m1'; m1AutoPlay(key); assert.equal(m1Auto.key,key);
m1AutoTick(); assert.equal(m1Opened.get(key),2); assert.equal(m1Auto.key,key); m1AutoStop();
m1OpenAllCards(); assert.equal(m1Opened.get(key),18);
// Editing transfers start, clears old reveal, and preserves row order. Moving does not alter keys.
m1EditPair(0); form('a','a2','b',''); m1AddPair();
const edited=m1Key(['a','a2'],'b'); assert.equal(g.match1v1.starts[key],undefined); assert.equal(g.match1v1.starts[edited],10); assert.equal(m1Opened.has(key),false);
form('a','','b2',''); m1AddPair(); const starts=JSON.stringify(g.match1v1.starts); m1MovePair(0,1);
assert.equal(JSON.stringify(g.match1v1.starts),starts); assert.equal(m1Key(...g.match1v1.pairs[1]),edited);
m1DelPair(1); assert.equal(g.match1v1.starts[edited],undefined);
m1EditPair(0); g.match1v1.pairs[0]=['a','b']; form('a','','b2',''); m1AddPair();
assert.equal(g.match1v1.pairs.length,1); eq(g.match1v1.pairs[0],['a','b'],'stale edit must not append or overwrite');
const backup=JSON.parse(JSON.stringify(state)); migrate(backup); eq(backup.games[0].match1v1,g.match1v1,'backup roundtrip');
// Ghost audit expands composites, never labels an array of live players as a ghost.
g=reset(); assert.equal(auditScan().ghosts.length,0);
state.players=state.players.filter(p=>p.id!=='b2'); let ghost=auditScan().ghosts.find(p=>p.type==='m1'); assert.equal(ghost.pid,'b2');
g.match1v1.starts[key]=10; m1Opened.set(key,4); m1Auto.key=key; auditDel(auditKey(ghost));
assert.equal(g.match1v1.pairs.length,0); assert.equal(g.match1v1.starts[key],undefined); assert.equal(m1Opened.has(key),false); assert.equal(m1Auto.key,null);
g=reset(); g.match1v1.starts[key]=10; assert.equal(delPlayerRefs('b2').m1,1); delPlayer('b2');
assert.equal(g.match1v1.pairs.length,0); assert.equal(g.match1v1.starts[key],undefined); assert.equal(state.players.some(p=>p.id==='b2'),false);
g=reset(); m1ClearAll(); eq(g.match1v1,{teamA:null,teamB:null,pairs:[],starts:{}});
console.log('PASS composite match sides: exact mean, validation, points, export, edit, starts/reveal/autoplay, audit/delete');
`,ctx,{filename:'match-side-cases'});
