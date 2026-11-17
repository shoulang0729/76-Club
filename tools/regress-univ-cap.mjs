#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context=vm.createContext({console,localStorage:{getItem:()=>null,setItem:()=>{}},window:{matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){}}});
vm.runInContext(['state','nav','score','calc','game'].map(n=>fs.readFileSync(`js/${n}.js`,'utf8')).join('\n')+`
globalThis.checkCaps=()=>{
  state.players=[{id:'p',gender:'F',everyType:'every1'}];
  const g=newGame();g.participants=['p'];g.par=Array(18).fill(4);g.hidden=Array.from({length:18},(_,i)=>i<12);g.scores={p:Array(18).fill(9)};
  const results=[];
  for(const gender of ['F','M'])for(const every of [false,true])for(const entered of [18,9]){
    state.players[0].gender=gender;g.univ.every=every;g.scores.p=Array.from({length:18},(_,i)=>i<entered?9:null);
    g.univ.capMode='standard';const standard=uvHdcpA(g,'p');
    g.univ.capMode='common36';const common=uvHdcpA(g,'p');
    results.push({gender,every,entered,standard,common});
  }
  g.scores.p=Array(18).fill(5);g.univ.every=false;state.players[0].gender='F';
  g.univ.capMode='standard';const belowStandard=uvHdcpA(g,'p');g.univ.capMode='common36';const belowCommon=uvHdcpA(g,'p');
  g.univ.capMode='future';const unknown=uvCapMode(g);
  state.games=[g];state.currentGameId=g.id;globalThis.renderBasic=()=>{};
  setUniv('capMode','common36');const saved=g.univ.capMode;setUniv('capMode','bad');const rejected=g.univ.capMode;
  return {results,belowStandard,belowCommon,unknown,saved,rejected};
};`,context);
const r=context.checkCaps();
for(const row of r.results){
  const ratio=row.entered/18;
  assert.equal(row.standard,(row.gender==='F'?40:36)*ratio,JSON.stringify(row));
  assert.equal(row.common,36*ratio,JSON.stringify(row));
}
assert.equal(r.belowStandard,14.4);assert.equal(r.belowCommon,14.4);
assert.equal(r.unknown,'standard');assert.equal(r.saved,'common36');assert.equal(r.rejected,'common36');
console.log('University cap: 2 modes × genders × Every × full/partial, below-cap and setter checks PASS');
