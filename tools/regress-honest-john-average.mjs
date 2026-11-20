#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const memory=new Map(),timers=new Map(),drawn=[];
let serial=0;
const canvasContext={measureText:s=>({width:String(s).length*8}),fillText:(s,x,y)=>drawn.push({text:String(s),x,y}),
  scale(){},fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}};
const sandbox={console,assert,Math,JSON,atob,
  localStorage:{getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)},
  window:{matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){}},
  document:{hidden:false,body:{},addEventListener(){},getElementById:()=>null,querySelector:()=>null,
    documentElement:{getAttribute:()=>null,removeAttribute(){},setAttribute(){}},
    createElement:()=>({getContext:()=>canvasContext,toDataURL:()=>'data:image/png;base64,AA=='})},
  getComputedStyle:()=>({fontFamily:'Arial',getPropertyValue:()=>'#111111'}),
  FileReader:class{readAsText(file){this.result=file.content;this.onload();}},
  setTimeout:fn=>{const id=++serial;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),
  clearInterval:id=>timers.delete(id),__drawn:drawn};
const context=vm.createContext(sandbox);
for(const name of ['state','i18n','nav','score','calc','honest-john','results','results-team','roulette','sheet-model','share','basic','backup'])
  vm.runInContext(fs.readFileSync('js/'+name+'.js','utf8'),context,{filename:'js/'+name+'.js'});
vm.runInContext(String.raw`
  render=()=>{};renderResult=()=>{};toast=()=>{};
  const eq=(a,b,msg)=>assert.equal(JSON.stringify(a),JSON.stringify(b),msg);
  const clone=value=>JSON.parse(JSON.stringify(value));
  const make=(mode='avg')=>{
    const A=Array.from({length:6},(_,i)=>'A'+i), B=Array.from({length:7},(_,i)=>'B'+i);
    state.players=[...A,...B].map(id=>({id,name:'Full name '+id,gender:'M',everyType:'none'}));
    const g=newGame();g.participants=[...A,...B];
    g.teams=[{id:'A',name:'東大',color:'red',memberIds:A},{id:'B',name:'一橋',color:'blue',memberIds:B}];
    g.par=Array(18).fill(4);g.hidden=Array.from({length:18},(_,i)=>i<12);
    g.scores=Object.fromEntries(g.participants.map(id=>[id,Array(18).fill(5)]));
    g.honestJohn={teamScoreMode:mode,hidden:Array.from({length:18},(_,i)=>i<4),
      declarations:Object.fromEntries([...A.map((id,i)=>[id,i===5?81:84]),...B.map((id,i)=>[id,i===6?82:84])])};
    g.formats=Object.fromEntries(Object.keys(g.formats).map(key=>[key,key==='honestJohn']));
    g.announced.honestJohn=true;state.games=[g];state.currentGameId=g.id;return g;
  };
  assert.equal(newGame().honestJohn.teamScoreMode,'avg');
  assert.equal(newHonestJohn().teamScoreMode,'avg');
  for(const mode of [undefined,'unknown','sum','avg']){
    const g=make(mode);if(mode===undefined)delete g.honestJohn.teamScoreMode;
    const expected=mode==='avg'?'avg':'sum';assert.equal(hjTeamScoreMode(g),expected);
    migrate(state);assert.equal(g.honestJohn.teamScoreMode,expected);
    const once=JSON.stringify(state);migrate(state);assert.equal(JSON.stringify(state),once);
    assert.equal(g.announced.honestJohn,true,'Migration preserves saved announcement');
    eq(teamWinPoints(g).wins,expected==='sum'?[1,0]:[0,1]);
  }
  const old=make();delete old.honestJohn;migrate(state);
  assert.equal(old.honestJohn.teamScoreMode,'sum','Missing legacy object is a sum event');
  old.honestJohn=null;hjEditData(old);assert.equal(hjTeamScoreMode(old),'sum','Repair never switches legacy sum to avg');

  let g=make(), st=hjStanding(g), byId=id=>st.rows.find(row=>row.t.id===id);
  eq([byId('A').count,byId('A').total,byId('A').average,byId('A').value],[6,150,25,25]);
  eq([byId('B').count,byId('B').total,byId('B').average,byId('B').value],[7,160,160/7,160/7]);
  eq(teamWinPoints(g).wins,[0,1],'Different team sizes reverse the sum winner');
  const html=renderTeamHonest(g);
  const summaryRows=html.match(/<tr class="hj-(?:total|average) tsum[^"]*"[^>]*>[\s\S]*?<\/tr>/g);
  assert.equal(summaryRows.length,4);assert.ok(summaryRows[0].includes('hj-total')&&summaryRows[1].includes('hj-average'));
  assert.ok(!summaryRows[0].includes('位')&&summaryRows[1].includes('2位')&&!summaryRows[2].includes('位')&&summaryRows[3].includes('1位'));
  assert.ok(summaryRows[1].includes('hj-selected')&&summaryRows[3].includes('22.86'),'Only avg rows carry adopted ranks and two-place display');
  eq(hjDisplayAverages(byId('A')),[83.5,90,86,2.5,25]);
  const overall=tpShareModel(g).events.find(event=>event.key==='honestJohn');
  eq(overall.cells.map(cell=>cell.val),['25.00','22.86']);assert.ok(overall.label.includes('平均'));
  g.honestJohn.teamScoreMode='sum';st=hjStanding(g);
  eq(teamWinPoints(g).wins,[1,0]);eq(tpShareModel(g).events[0].cells.map(cell=>cell.val),['150','160']);
  assert.ok(!tpShareModel(g).events[0].label.includes('平均'));
  const sumModel=sheetModel(g).det.honestJohn;
  eq(Object.keys(sumModel),['on','pending','rows'],'Legacy sum model keeps its exact shape');
  eq(Object.keys(sumModel.rows[0]),['team','name','declared','raw','adjusted','difference','penalty','total']);
  assert.equal(sheetHjLines(sumModel),13,'Sum image retains its legacy individual-only layout');

  g=make();g.honestJohn.hidden.fill(false);
  for(let count=0;count<=4;count++){
    g.honestJohn.hidden=g.honestJohn.hidden.map((_,i)=>i<count);
    const provisional=hjDisplayStanding(g);assert.equal(provisional.rows[0].count,6);assert.equal(provisional.rows[1].count,7);
    eq(provisional.rows.map(row=>row.total),[390-count*60,440-count*70]);
    assert.equal(provisional.rows[0].rank,2);assert.equal(provisional.rows[1].rank,1);
    assert.equal(hjStanding(g).ready,count===4);
    if(count<4){eq(teamWinPoints(g).wins,[0,0]);eq(sheetModel(g).det.honestJohn.rows,[]);eq(sheetModel(g).det.honestJohn.teams,[]);}
  }
  delete g.scores.B6;st=hjStanding(g);const missing=st.rows.find(row=>row.t.id==='B');
  assert.equal(missing.count,7);assert.equal(missing.total,null);assert.equal(missing.average,null);assert.equal(missing.value,null);
  assert.equal(st.ready,false);assert.ok(st.rows.every(row=>row.rank===null));eq(teamWinPoints(g).wins,[0,0]);
  assert.equal(hjDisplayAverages(hjDisplayStanding(g).rows[1])[0],586/7);
  assert.ok(hjDisplayAverages(hjDisplayStanding(g).rows[1]).slice(1).every(value=>value===null));
  g.teams.push({id:'empty',name:'Empty',memberIds:[]});assert.equal(hjStanding(g).rows.length,2);

  // Display rounding never participates in comparison, and exact equal averages split points.
  g=make();g.scores=Object.fromEntries(g.participants.map(id=>[id,Array(18).fill(4)]));
  g.participants.forEach(id=>g.honestJohn.declarations[id]=72-(id[0]==='A'?1.0004:1.0003)/10);
  st=hjStanding(g);assert.equal(hjFmtNumber(st.rows[0].value,true),'1.00');assert.equal(hjFmtNumber(st.rows[1].value,true),'1.00');
  eq(teamWinPoints(g).wins,[0,1],'Two displayed 1.00 averages still have distinct ranks');
  g.participants.forEach(id=>g.honestJohn.declarations[id]=71);
  eq(teamWinPoints(g).wins,[0.5,0.5],'Different-sized teams with exact equal averages tie');
  g.participants.forEach(id=>g.honestJohn.declarations[id]=72);eq(teamWinPoints(g).wins,[0.5,0.5]);
  g=make();g.honestJohn.declarations.A0=85;g.honestJohn.declarations.A1=87;
  const pair={members:[hjPlayer(g,'A0'),hjPlayer(g,'A1')],count:2};
  assert.equal(hjDisplayAverages(pair)[3],0);assert.equal(hjDisplayAverages(pair)[4],20,'Average penalties, never apply penalty to averaged difference');

  // A mode edit invalidates publication even before any signature/view has been initialized.
  g=make('sum');hjSetTeamScoreMode('avg');assert.equal(g.announced.honestJohn,false);assert.equal(hjTeamScoreMode(g),'avg');
  g.announced.honestJohn=true;hjSetTeamScoreMode('avg');assert.equal(g.announced.honestJohn,true);
  hjBeforeSave(state);g.honestJohn.hidden.fill(false);save();hjStartSpin();assert.ok(hjSpin);
  hjSetTeamScoreMode('sum');assert.equal(hjSpin,null);assert.equal(g.announced.honestJohn,false);
  hjStartSpin();g.honestJohn.teamScoreMode='avg';save();assert.equal(hjSpin,null,'Direct mode edits are caught by the save signature');
  g=make();hjBeforeSave(state);g.participants=g.participants.filter(id=>id!=='B6');save();assert.equal(g.announced.honestJohn,false);
  assert.equal(hjStanding(g).rows.find(row=>row.t.id==='B').count,6);
  g=make();const encoded=JSON.stringify(state);importData({files:[{content:encoded}]});
  assert.equal(hjTeamScoreMode(curGame()),'avg');assert.equal(curGame().announced.honestJohn,true);
  dupGame();assert.equal(hjTeamScoreMode(curGame()),'avg');assert.equal(state.games.length,2);

  // The five-event overall result changes only the HJ point: 3.5/1.5 becomes 2.5/2.5.
  g=make();g.scores.A0[17]=4;g.honestJohn.declarations.A0=83;g.scores.B1[0]=4;
  for(const key of ['niadoraTeam','match1v1','univMatch','roulette'])g.formats[key]=true;
  g.univ={every:false,capMode:'standard'};
  g.prizes.npdcOverride={0:'np',1:'np'};g.prizes.niapinWinner={0:'A0',1:'B0'};
  g.match1v1={teamA:'A',teamB:'B',starts:{},pairs:[...Array.from({length:6},(_,i)=>['A1','B'+i]),['A1',['B5','B6']]]};
  g.roulette.cur=18;g.roulette.reps=Object.fromEntries(Array.from({length:18},(_,h)=>[h,{A:'A0',B:'B0'}]));
  for(const key of ['niadora','match1v1','univMatch','roulette'])g.announced[key]=true;
  eq(teamWinPoints(g).wins,[2.5,2.5]);g.honestJohn.teamScoreMode='sum';eq(teamWinPoints(g).wins,[3.5,1.5]);

  // Avg reports preserve full precision, identify teams by ID, and allocate all summary rows.
  g=make();g.teams.forEach(team=>team.name='同名大学');
  const model=sheetModel(g), detail=model.det.honestJohn;assert.equal(detail.mode,'avg');
  assert.equal(detail.rows.length,13);assert.equal(detail.teams.length,2);assert.equal(detail.teams[1].average,160/7);
  assert.equal(detail.rows.filter(row=>row.teamId==='A').length,6);assert.equal(detail.rows.filter(row=>row.teamId==='B').length,7);
  eq(detail.teams[0].totals,[501,540,516,15,150]);assert.equal(detail.teams[1].averages[4],160/7);
  const probe=drawSheet(model,{probe:true}), section=probe.sections.find(section=>section.id==='det:honestJohn');
  assert.equal(sheetHjLines(detail),19);assert.equal(section.h,SL.SECT+SL.HEAD+SL.ROW*19+SL.GAP);
  __drawn.length=0;drawSheet(model);
  const detailText=__drawn.filter(item=>item.y>section.y&&item.y<section.y+section.h);
  assert.ok(detailText.some(item=>item.text==='22.86'));assert.ok(detailText.some(item=>item.text==='平均 1位'));
  assert.equal(detailText.filter(item=>item.text==='Full name A0').length,1);
  assert.equal(detailText.filter(item=>item.text==='Full name B6').length,1);
  assert.ok(detailText.filter(item=>item.text.startsWith('平均 ')).every(item=>item.y<section.y+section.h-SL.GAP),'Last average row fits allocated section');
  g.announced.honestJohn=false;const unlinked=sheetModel(g).det.honestJohn;eq(unlinked.rows,[]);eq(unlinked.teams,[]);
  assert.ok(!drawSheet(sheetModel(g),{probe:true}).sections.some(section=>section.id==='det:honestJohn'));
  console.log('Honest John average PASS: legacy migration, exact averages, both summary rows, mode invalidation, backup, overall 2.5/2.5 and complete gated image output');
`,context);
