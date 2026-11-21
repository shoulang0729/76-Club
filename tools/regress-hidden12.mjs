#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const memory=new Map();
const timers=new Map();
const listeners={};
let nextTimer=0, now=0, card=null, downloads=0;
const toasts=[];
const sandbox={
  assert, toasts, console, Blob,
  Date:class extends Date { static now(){ return now; } },
  document:{
    hidden:false,
    activeElement:null,
    addEventListener:(name,fn)=>{ listeners[name]=fn; },
    getElementById:id=>id==='hidden12Roulette'?card:null,
    createElement:tag=>{
      assert.equal(tag,'a','A blocked result must never reach canvas rendering');
      return {click(){ downloads++; }};
    }
  },
  File:class {},
  FileReader:class { readAsText(file){ this.result=file.text; this.onload(); } },
  navigator:{},
  URL:{createObjectURL:()=> 'blob:fixture',revokeObjectURL(){}},
  window:{matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){}},
  localStorage:{getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)},
  setTimeout:fn=>{ const id=++nextTimer; timers.set(id,fn); return id; },
  clearTimeout:id=>timers.delete(id),
  setInterval:fn=>{ const id=++nextTimer; timers.set(id,fn); return id; },
  clearInterval:id=>timers.delete(id),
  confirm:()=>true,
  __card:()=>card,
  __time:ms=>{ now+=ms; },
  __visibility:hidden=>{ sandbox.document.hidden=hidden; listeners.visibilitychange(); },
  __lastTimer:()=>timers.get(nextTimer),
  __saved:()=>memory.get('golfCompe_v1'),
  __downloads:()=>downloads,
  __renderCard:html=>{
    if(!html){ card=null; return; }
    const nodes=new Map(['summary','.h12-grid','.h12-stop','.h12-controls'].map(selector=>[selector,{
      setAttribute(k,v){ this[k]=v; }, focus(){ sandbox.document.activeElement=this; }
    }]));
    card={open:/<details [^>]+ open /.test(html), html, button:{},
      contains(button){ return this.button===button; },
      querySelector:selector=>nodes.get(selector)};
    for(const [selector,pattern] of [
      ['summary',/<summary>([\s\S]*?)<\/summary>/],
      ['.h12-grid',/<div class="h12-grid">([\s\S]*?)<div class="cardtools h12-controls">/],
      ['.h12-controls',/<div class="cardtools h12-controls">([\s\S]*?)<\/div>/]
    ]) nodes.get(selector).innerHTML=html.match(pattern)?.[1];
  }
};
const context=vm.createContext(sandbox);
const run=src=>vm.runInContext(src,context);
const loadModules=names=>names.forEach(name=>run(fs.readFileSync(`js/${name}.js`,'utf8')));

// Pure calculation and validation deliberately run without the roulette module.
loadModules(['state','nav','score','calc','results']);
run(`
  const clone=value=>JSON.parse(JSON.stringify(value));
  const par=[4,3,4,4,5,4,4,3,5, 5,4,3,4,4,3,4,5,4];
  const twelve=[1,0,2,3,5,4, 11,10,12,13,15,9];
  const fixture=()=>{
    const g=newGame();
    g.par=par.slice();
    g.courseRef={courseId:'club',outId:'central',inId:'east'};
    g.participants=['a','b'];
    g.teams=[{id:'red',name:'Red',memberIds:['a']},{id:'blue',name:'Blue',memberIds:['b']}];
    g.scores={a:[15,3,6,11,8,5,4,6,2,10,6,4,6,4,3,6,5,5],b:Array(18).fill(7)};
    g.formats=Object.fromEntries(Object.keys(g.formats).map(key=>[key,false]));
    for(const key of ['net','nassau','teamNet','univMatch','teamGross']) g.formats[key]=true;
    g.points.net=[3,1]; g.points.nassauTotal=[2,1]; g.points.teamRankPts=[2,1]; g.prizePool=1000;
    g.announced={univMatch:true,teamNet:true,teamGross:true,honestJohn:true};
    state={
      players:[{id:'a',name:'A',gender:'F',everyType:'every2'},{id:'b',name:'B',gender:'M',everyType:'every1'}],
      games:[g],currentGameId:g.id,
      courses:[{id:'club',name:'Club',nines:[
        {id:'central',name:'中',par:g.par.slice(0,9)},{id:'east',name:'東',par:g.par.slice(9)}
      ]}]
    };
    CHANNEL='b';
    return g;
  };
  const register=(g,count)=>{
    const order=twelve.slice(0,count);
    g.hidden=Array.from({length:18},(_,i)=>order.includes(i));
    g.hidden12Draw={version:1,order,sourcePar:g.par.slice(),sourceCourseRef:{...g.courseRef}};
  };
  const expected=(g,univ,revealed)=>{
    const strokes=g.scores.a.filter(score=>score!=null&&score!=='');
    const every=(univ?g.univ.every:g.womenEvery.enabled)?2:0;
    const chosen=g.hidden12Draw.order.filter(i=>!revealed||revealed.has(i)).filter(i=>g.scores.a[i]!=null&&g.scores.a[i]!=='');
    if(!chosen.length) return 0;
    const subtotal=chosen.reduce((total,i)=>{
      const score=Number(g.scores.a[i])-every;
      return total+((univ||g.periaDblPar)?Math.min(score,2*g.par[i]):score);
    },0);
    const totalPar=g.par.reduce((sum,value)=>sum+value,0);
    const raw=(subtotal*12/chosen.length*1.5-totalPar)*(univ?0.8:g.periaCoef);
    const floored=!univ&&g.periaAllowNeg?raw:Math.max(0,raw);
    const cap=univ?(g.univ.capMode==='common36'?36:40):g.periaCap;
    return Math.round(Math.min(floored,cap??Infinity)*strokes.length/18*10)/10;
  };
  const totals=g=>JSON.stringify([
    periaParts(g,'a'),periaHdcp(g,'a'),netScore(g,'a'),nassauTotalNet(g,'a'),uvHdcpA(g,'a'),uvNetA(g,'a'),
    teamNetVal(g,g.teams[0]),teamWinPoints(g),computePayout(g),nextKanji(g),
    hrHdcpAt(g,'a',new Set()),hrHdcpAt(g,'a',new Set(twelve.slice(0,4))),hrHdcpAt(g,'a',new Set(twelve))
  ]);
  const assertStatus=(g,active,valid,count,complete)=>assert.deepEqual(hidden12Status(g),
    {active,valid,count,complete,provisional:active&&!complete});
  let countCases=0;
  for(const count of [0,1,11,12])
  for(const opened of [0,1,9,18])
  for(const holesMissing of [false,true])
  for(const dpEvery of [false,true])
  for(const uvEvery of [false,true])
  for(const dblPar of [false,true])
  for(const allowNeg of [false,true])
  for(const capMode of ['standard','common36']){
    const game=fixture();
    register(game,count);
    game.periaCoef=0.75;
    game.periaCap=holesMissing?20:null;
    game.periaDblPar=dblPar;
    game.periaAllowNeg=allowNeg;
    game.womenEvery.enabled=dpEvery;
    game.univ={every:uvEvery,capMode};
    if(holesMissing){ game.scores.a[1]=null; game.scores.a[5]=''; game.scores.a[11]=null; }
    const g=viewGameN(game,opened);
    assertStatus(g,true,true,count,count===12);
    assert.equal(hidden12CanPublish(g),count===12);
    if(count===12){
      const old=clone(g); delete old.hidden12Draw;
      assert.equal(totals(g),totals(old),'completed draw preserves each dependent calculation');
      assert.equal(periaProv(g),periaProv(old));
    }else{
      assert.equal(periaProv(g),true);
      assert.equal(periaHdcp(g,'a'),expected(g,false));
      assert.equal(uvHdcpA(g,'a'),expected(g,true));
      assert.equal(netScore(g,'a'),Math.round((effGross(g,'a')-expected(g,false))*10)/10);
      const revealed=new Set(twelve.slice(0,4));
      assert.equal(hrHdcpAt(g,'a',revealed),opened===0?null:expected(g,false,revealed));
      assert.equal(hrHdcpAt(g,'a',new Set()),opened===0?null:0);
    }
    countCases++;
  }
  const check=fixture();
  register(check,0);
  check.periaAllowNeg=true;
  assert.equal(periaHdcp(check,'a'),0);
  delete check.hidden12Draw;
  assertStatus(check,false,false,0,false);
  assert.equal(periaHdcp(check,'a'),-57.6,'historic empty manual selection uses its existing formula');
  check.hidden[0]=true;
  assert.equal(periaHdcp(check,'a'),-39.6,'historic one-hole manual selection uses its existing formula');
  assert.equal(hidden12CanPublish(check),true);
  for(const damage of [
    g=>{ g.hidden12Draw=null; }, g=>{ g.hidden12Draw.version=2; },
    g=>{ g.hidden12Draw.order[1]=g.hidden12Draw.order[0]; }, g=>{ g.hidden12Draw.order[1]=50; },
    g=>{ g.hidden12Draw.order[1]=8; }, g=>{ g.hidden[15]=true; },
    g=>{ g.hidden12Draw.sourcePar[2]=NaN; }, g=>{ g.hidden12Draw.sourceCourseRef={}; },
    g=>{ g.par[1]=6; },g=>{ g.courseRef.inId='north'; }
  ]){
    const g=fixture(); register(g,2); damage(g);
    assert.equal(hidden12Status(g).valid,false);
    assert.equal(hidden12CanPublish(g),false);
  }
  const badQuota=fixture(); register(badQuota,1);
  badQuota.hidden[7]=true; badQuota.hidden12Draw.order.push(7);
  assert.equal(hidden12Status(badQuota).valid,false,'declaring two standard OUT par-3 holes is invalid');
  const stale=fixture(); register(stale,1);
  stale.par[1]=6; stale.periaAllowNeg=true;
  assert.equal(periaHdcp(stale,'a'),expected(stale,false),'An invalidated draw still uses current pars');
  const blocked=fixture(); register(blocked,1);
  const events=teamWinPoints(blocked).events;
  assert.deepEqual(events.map(e=>[e.key,e.on]),[['teamGross',true],['teamNet',false],['univMatch',false]]);
  assert.deepEqual(teamWinPoints(blocked).wins,[1,0]);
  console.log('Hidden 12 calculations: '+countCases+' option and score-mask combinations, legacy manual values, validity, announcement gates');
`);

loadModules(['course','basic','results-team','backup','sheet-model','share']);
run(`
  globalThis.t=(key,values)=>values?key+' '+Object.values(values).join(' '):key;
  globalThis.toast=message=>toasts.push(message);
  globalThis.renderResult=()=>{
    const g=curGame();
    __renderCard(activeTab==='result'&&resGrp==='team'&&resGame.team==='univ'&&g
      ?renderHidden12Roulette(g):'');
  };
  globalThis.render=renderResult;
  globalThis.renderCourse=()=>{};
  const openDraw=()=>{
    activeTab='result'; resGrp='team'; resGame.team='univ';
    renderResult(); __card().open=true; hidden12Toggle(__card());
  };
  const launch=()=>hidden12Start(__card().button);
  const commit=()=>{
    __time(300);
    const g=curGame(), before=g.hidden12Draw.order.length, generation=hidden12Spin.generation;
    const shown=hidden12Spin.frame.find(i=>!g.hidden[i]);
    hidden12CommitSpin(generation,before);
    assert.equal(g.hidden12Draw.order.at(-1),shown);
    assert.equal(g.hidden.filter(Boolean).length,before+1);
    assert.equal(JSON.parse(__saved()).games.find(saved=>saved.id===g.id).hidden12Draw.order.at(-1),shown);
    assert.ok(!Object.hasOwn(JSON.parse(__saved()).games.find(saved=>saved.id===g.id).hidden12Draw,'frame'));
    return {generation,before};
  };
  const stateWithSpin=()=>{
    const g=fixture(); save(); openDraw(); launch();
    return {g,spin:hidden12Spin,timer:__lastTimer()};
  };
  const reject=(action,nowValid)=>{
    const {g,spin,timer}=stateWithSpin(), gameId=g.id;
    commit(); const before=__saved();
    action(g);
    assert.equal(hidden12Spin,null);
    timer();
    const saved=__saved();
    hidden12CommitSpin(spin.generation,1);
    assert.equal(__saved(),saved,'stale STOP never writes');
    assert.equal(g.hidden12Draw.order.length,1);
    const persisted=JSON.parse(before).games.find(game=>game.id===gameId);
    assert.equal(persisted.hidden12Draw.order.length,1);
    assert.equal(hidden12Status(g).valid,nowValid);
  };
  const quotaFixtures=[
    {holes:par,quotas:[[1,4,1,0],[1,4,1,0]]},
    {holes:[3,3,3,3,3,6,6,0,0, 0,1,2,0,1,2,4,6,3],quotas:[[4,0,2,0],[1,1,1,3]]},
    {holes:[...Array(9).fill(4), ...Array(9).fill(0)],quotas:[[0,6,0,0],[0,0,0,6]]}
  ];
  const band=v=>v===3?0:v===4?1:v>=5?2:3;
  for(const {holes,quotas} of quotaFixtures){
    const verify=frame=>{
      assert.equal(new Set(frame).size,12);
      for(const side of [0,1]){
        const quota=[0,0,0,0], start=side*9;
        const inHalf=frame.filter(i=>i>=start&&i<start+9);
        assert.equal(inHalf.length,6);
        inHalf.forEach(i=>quota[band(holes[i])]++);
        assert.deepEqual(quota,quotas[side]);
      }
    };
    for(let run=0;run<40;run++){
      verify(pickHidden12(holes).flatMap((v,i)=>v?[i]:[]));
      const order=[];
      for(let step=0;step<12;step++){
        const frame=hidden12Frame(holes,order);
        verify(frame);
        assert.deepEqual(frame.slice(0,Math.min(step,6)),order.slice(0,6));
        assert.deepEqual(frame.slice(6,6+Math.max(step-6,0)),order.slice(6));
        order.push(frame.find(i=>!order.includes(i)));
      }
    }
  }
  const initial=fixture();
  save();
  const untouchedMaster=JSON.stringify(state.courses);
  initial.hidden[0]=true; save();
  initial.announced.teamNet=initial.announced.univMatch=true; save();
  openDraw();
  assert.match(__card().html,/h12.replace/);
  launch();
  assert.equal(hidden12Status(initial).count,0);
  assert.equal(periaHdcp(initial,'a'),0);
  assert.equal(initial.announced.teamNet,false);
  assert.equal(initial.announced.univMatch,false);
  assert.equal(initial.announced.teamGross,true);
  assert.equal(initial.announced.honestJohn,true);
  assert.notEqual(initial.hidden12Draw.sourcePar,initial.par);
  assert.notEqual(initial.hidden12Draw.sourceCourseRef,initial.courseRef);
  assert.match(__card().html,/OUT 中[1-9]/);
  assert.match(__card().html,/IN 東[1-9]/);
  assert.equal((__card().html.match(/h12-slot spinning/g)||[]).length,12);
  const first=commit();
  hidden12CommitSpin(first.generation,first.before);   // detached STOP callback
  hidden12CommitSpin(first.generation,1);               // second tap on the new STOP
  assert.equal(initial.hidden12Draw.order.length,1);
  assert.equal(hidden12Spin.frame.filter(i=>initial.hidden[i]).length,1);
  const order=initial.hidden12Draw.order.slice();
  state=load(); hidden12BeforeSave(state); openDraw();
  const resumed=curGame();
  assert.notEqual(resumed,initial);
  assert.deepEqual(resumed.hidden12Draw.order,order);
  assert.match(__card().html,/h12.resume/);
  assert.equal(hidden12Spin,null);
  launch();
  hidden12CommitSpin(first.generation,1);
  assert.deepEqual(resumed.hidden12Draw.order,order);
  for(let i=1;i<12;i++) commit();
  assertStatus(resumed,true,true,12,true);
  assert.equal(hidden12Spin,null);
  assert.equal(JSON.stringify(state.courses),untouchedMaster);
  assert.equal((__card().html.match(/h12-slot fixed/g)||[]).length,12);
  assert.equal((courseGrid(resumed,0,18).match(/type="checkbox" checked/g)||[]).length,12);
  assert.equal(hidden12CanPublish(resumed),true);
  hidden12Reset(__card().button);
  assertStatus(resumed,true,true,0,false);
  assert.equal(periaHdcp(resumed,'a'),0);
  assert.equal(uvHdcpA(resumed,'a'),0);
  assert.equal((courseGrid(resumed,0,18).match(/type="checkbox" checked/g)||[]).length,0);
  assert.equal(hidden12Spin,null);

  reject(()=>{__card().open=false; hidden12Toggle(__card());},true);
  reject(()=>go('basic'),true);
  reject(()=>setResGrp('ind'),true);
  reject(()=>setResGame('overall'),true);
  reject(()=>__visibility(true),true);
  __visibility(false);
  reject(()=>{const next=newGame(); state.games.push(next); selectGame(next.id);},true);
  reject(()=>{ const text=JSON.stringify(state); importData({files:[{text}]}); },true);
  reject(g=>{ setPar(0,'5'); assert.match(__card().querySelector('summary').innerHTML,/h12.sourceChanged/); },false);
  reject(g=>{ g.courseRef.inId='north'; save(); },false);
  reject(g=>{
    const {par}=state.courses[0].nines[1];
    state.courses[0].nines.push({id:'north',name:'North',par:par.slice()});
    clibSel={courseId:'club',outId:'central',inId:'north'};
    const hidden=g.hidden.slice(), before=g.par.slice();
    clibLoad();
    assert.deepEqual(g.hidden,hidden);
    assert.deepEqual(g.par,before);
    assert.equal(g.courseRef.inId,'north');
  },false);
  reject(g=>{ g.hidden12Draw.order[0]=17; save(); assert.match(__card().querySelector('summary').innerHTML,/h12.invalid/); },false);
  const master=stateWithSpin().g;
  state.courses[0].nines[0].name='Renamed';
  save();
  assert.equal(hidden12Status(master).valid,true);
  assert.ok(hidden12Spin,'master label changes neither invalidate source nor stop a running draw');
  hidden12StopSpin();
  for(const manual of [()=>toggleHidden(17),randomHidden,clearHidden]){
    const {g,spin}=stateWithSpin();
    commit();
    g.announced.univMatch=g.announced.teamNet=true; save();
    manual();
    assert.equal(Object.hasOwn(g,'hidden12Draw'),false);
    assert.equal(g.announced.univMatch,false);
    assert.equal(g.announced.teamNet,false);
    assert.equal(g.announced.teamGross,true);
    assert.equal(g.announced.honestJohn,true);
    assert.equal(hidden12Spin,null);
    const saved=__saved();
    hidden12CommitSpin(spin.generation,1);
    assert.equal(__saved(),saved);
  }
  const g=fixture();
  // A previous result image cannot be shared once a reset or new draw is in progress.
  const legacy=sheetModel(g);
  assert.equal(legacy.meta.hidden12Pending,undefined);
  assert.ok(sheetImgInput());
  register(g,12);
  assert.deepEqual(sheetModel(g).meta,legacy.meta);
  sheetImg={bytes:new Uint8Array([0]),name:'result.png',url:'blob:result',sig:sheetImgSig(g)};
  sheetImgSave();
  const shared=__downloads();
  assert.equal(shared,1);
  register(g,1);
  assert.match(tpAnnounceUI(g,'univMatch'),/disabled/);
  assert.match(tpAnnounceUI(g,'teamNet'),/disabled/);
  assert.doesNotMatch(tpAnnounceUI(g,'teamGross'),/disabled/);
  g.announced.teamNet=false;
  tpAnnounce('teamNet',true);
  assert.equal(g.announced.teamNet,false);
  assert.equal(sheetModel(g).det.univ.on,false);
  assert.equal(sheetModel(g).meta.hidden12Pending,true);
  assert.equal(drawSheet(sheetModel(g),{probe:true}),null);
  assert.equal(drawSheet(sheetModel(g)),null);
  assert.equal(sheetImgInput(),null);
  sheetImgSave();
  assert.equal(__downloads(),shared);
  assert.match(sheetImgBox(g),/h12.exportBlocked/);
  assert.match(sheetImgBox(g),/<button[^>]*disabled/);
  exportData();
  assert.equal(__downloads(),shared+1,'JSON export remains available');
  assert.equal(toasts.at(-2),'h12.exportBlocked');
  console.log('Hidden 12 draw: quota sampling, stored-order replay, reset, cancellation, isolation, publish and JSON paths');
`);

const raced=await run(`(async()=>{
  const g=fixture();
  let releaseFonts;
  globalThis.sheetFontsReady=()=>new Promise(resolve=>{releaseFonts=resolve;});
  const building=sheetImgMake();
  register(g,0); releaseFonts();
  await building;
  return toasts.at(-1);
})()`);
assert.equal(raced,'h12.exportBlocked','An in-flight export cannot publish after a draw starts');
