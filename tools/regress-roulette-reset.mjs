#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const timers=new Map(), writes=[];
let timerId=0;
const sandbox={console,Math,JSON,
  localStorage:{getItem:()=>null,setItem:(key,value)=>writes.push({key,value})},
  window:{matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){}},
  setTimeout:fn=>{const id=++timerId;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),
  setInterval:fn=>{const id=++timerId;timers.set(id,fn);return id;},clearInterval:id=>timers.delete(id),
  confirm:()=>{throw new Error('Native confirmation must never be used for reset');}};
const context=vm.createContext(sandbox);
for(const name of ['state','nav','score','calc','roulette'])vm.runInContext(fs.readFileSync(`js/${name}.js`,'utf8'),context);
const result=vm.runInContext(`(()=>{
  globalThis.t=key=>key;globalThis.renderResult=()=>{};
  globalThis.tpAnnounceUI=()=>'<button>link</button>';
  const clone=value=>JSON.parse(JSON.stringify(value));
  const fixture=(cur=5)=>{
    const g=newGame();state.players=[{id:'a',name:'A',everyType:'none'},{id:'b',name:'B',everyType:'none'}];
    g.participants=['a','b'];g.teams=[{id:'A',name:'Red',memberIds:['a']},{id:'B',name:'Blue',memberIds:['b']}];
    g.scores={a:Array(18).fill(4),b:Array(18).fill(5)};
    g.honestJohn={hidden:Array(18).fill(false),declarations:{a:72,b:90}};
    g.roulette={changeN:2,challengeM:3,cur,reps:Object.fromEntries(Array.from({length:18},(_,i)=>[i,{A:'a',B:'b'}])),
      pool:{A:['a'],B:['b']},remChange:{A:0,B:1},remChallenge:{A:1,B:0}};
    g.formats=Object.fromEntries(Object.keys(g.formats).map(key=>[key,false]));g.formats.roulette=true;
    g.announced={roulette:true,honestJohn:true};state.games=[g];state.currentGameId=g.id;return g;
  };
  const checks=[];
  for(const cur of [0,5,17,18]){
    const g=fixture(cur), before=JSON.stringify(g), inputs=JSON.stringify([g.scores,g.honestJohn,g.participants]);
    rlStartInitial();rl.challengeFrom='A';
    rlReset();const askUnchanged=before===JSON.stringify(g), stopped=!rl.spinning&&rl.timer===null&&rl.lockTimer===null&&
      !rl.stopLock&&rl.spinTeams.length===0&&rl.challengeFrom===null;
    const html=renderRouletteParts(g).head;
    const inline=html.includes('confirm.rlReset')&&html.includes('onclick="rlResetApply()"')&&html.includes('onclick="rlResetCancel()"');
    rlResetCancel();const cancelUnchanged=before===JSON.stringify(g)&&rl.resetPending===null&&!rlResetUI(g);
    rlReset();rlResetApply();const R=g.roulette, points=teamWinPoints(g);
    const reset=R.cur===0&&Object.keys(R.reps).length===0&&Object.keys(R.pool).length===0&&
      JSON.stringify(R.remChange)==='{"A":2,"B":2}'&&JSON.stringify(R.remChallenge)==='{"A":3,"B":3}'&&R.changeN===2&&R.challengeM===3;
    const flags=!g.announced.roulette&&g.announced.honestJohn&&rl.undo===null&&rl.resetPending===null&&rl.spinTeams.length===0&&rl.challengeFrom===null;
    checks.push({cur,askUnchanged,stopped,inline,cancelUnchanged,reset,flags,
      inputs:inputs===JSON.stringify([g.scores,g.honestJohn,g.participants]),zeroPoints:points.wins.every(value=>value===0)});
  }
  // Missing confirm has the same supported behavior as a throwing/blocked native dialog.
  delete globalThis.confirm;const absent=fixture();rlReset();const noConfirm=rl.resetPending===absent;rlResetCancel();
  const original=fixture(), originalBefore=JSON.stringify(original);rlReset();
  const replacement=clone(original);state.games=[replacement];state.currentGameId=replacement.id;
  rlResetApply();const sameIdSafe=JSON.stringify(original)===originalBefore&&JSON.stringify(replacement)===originalBefore&&rl.resetPending===null;
  const first=fixture();rlReset();const second=fixture();const secondBefore=JSON.stringify(second);rlResetApply();
  const otherGameSafe=secondBefore===JSON.stringify(second)&&rl.resetPending===null;
  const removed=fixture();rlReset();state.games=[];rlResetApply();const deletedSafe=removed.roulette.cur===5&&rl.resetPending===null;
  const nav=fixture();rlReset();rlStopTimer();const navigationCancels=rl.resetPending===null;
  return {checks,noConfirm,sameIdSafe,otherGameSafe,deletedSafe,navigationCancels};
})()`,context);
for(const check of result.checks)for(const [name,value] of Object.entries(check))if(name!=='cur')assert.equal(value,true,`${name} at hole ${check.cur}`);
for(const name of ['noConfirm','sameIdSafe','otherGameSafe','deletedSafe','navigationCancels'])assert.equal(result[name],true,name);
vm.runInContext(fs.readFileSync('js/results.js','utf8'),context);
const switches=vm.runInContext(`(()=>{
  globalThis.renderResult=()=>{};
  resGrp='team';resGame.team='roulette';rlReset();setResGame('overall');
  const eventCancelled=rl.resetPending===null;
  resGame.team='roulette';rlReset();setResGrp('ind');
  return eventCancelled&&rl.resetPending===null;
})()`,context);
assert.equal(switches,true,'Leaving roulette through either result game or result group tabs cancels pending reset');
assert.equal(timers.size,0,'Reset request stops every interval and STOP-lock timeout');
assert.equal(writes.length,4,'Only confirmed resets save data');
assert.ok(writes.every(write=>write.key==='golfCompe_v1'&&!write.value.includes('resetPending')),'Pending confirmation stays out of persistence');
console.log('Roulette reset regression PASS: inline ask/cancel/apply at 0/5/17/18H, timer cleanup, object guards, refills and unlinked zero points');
