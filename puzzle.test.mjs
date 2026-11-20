import assert from 'node:assert/strict';
import test from 'node:test';
import { FIELDS } from './docs/boards.mjs';
import { SIZE, boardFor, stepPath, spell, judge, points, seedFromLink, boardLink, freshRound, restoreRound, msLeft } from './docs/puzzle.mjs';

function reachable(tiles, word, cell, prefix='', used=0){
  if(used&(1<<cell))return false;
  const next=prefix+tiles[cell];
  if(!word.startsWith(next))return false;
  if(word===next)return true;
  for(let i=0;i<16;i++){
    if(Math.max(Math.abs((i>>2)-(cell>>2)),Math.abs(i%4-cell%4))!==1)continue;
    if(reachable(tiles,word,i,next,used|(1<<cell)))return true;
  }
  return false;
}
test('each board has ample words including longer bent paths; rotations preserve spellings',()=>{
  for(const [i,entry] of FIELDS.entries()){
    const field=boardFor(i*8+(i%8));
    assert.equal(field.tiles.length,SIZE*SIZE);assert.ok(field.validWords.size>=75);
    assert.ok([...field.validWords].some(w=>w.length>=7));
    for(const word of entry[1].split(' '))assert.ok(field.tiles.some((_,cell)=>reachable(field.tiles,word,cell)),word);
  }
});
test('bent paths, backwards movement, adjacency, duplicate rejection, and Qu',()=>{
  const tiles=['C','A','X','X','S','T','QU','E','X','X','I','T','X','X','X','X'];
  const field={tiles,validWords:new Set(['CAT','CATS','QUIT'])};
  let p=[];for(const cell of [0,1,5,4])p=stepPath(p,cell);
  assert.equal(spell(tiles,p),'CATS');assert.deepEqual(judge(field,p,[]),{word:'CATS',points:400});
  assert.ok(judge(field,p,['CATS']).message);assert.deepEqual(stepPath(p,5),[0,1,5]);
  assert.deepEqual(stepPath(p,0),p);assert.deepEqual(stepPath([3],4),[3]);assert.deepEqual(stepPath(p,15),p);
  assert.ok(judge(field,[0,1,0,5],[]).message);assert.equal(judge(field,[6,10,11],[]).word,'QUIT');
  assert.ok(judge(field,[0,1],[]).message);assert.ok(judge(field,[1,6,7],[]).message);
  assert.ok(points('BLOOMING')>points('BLOOM'));
});
test('the timer starts explicitly, expires at 60 seconds and survives reload',()=>{
  const start=1_000_000;const fresh=freshRound(7);
  assert.equal(msLeft(fresh,start),60000);
  assert.equal(msLeft({...fresh,startedAt:start},start+59999),1);
  assert.equal(msLeft({...fresh,startedAt:start},start+60000),0);
  assert.equal(msLeft({...fresh,startedAt:start},start+70000),0);
  const word=[...boardFor(7).validWords][0];
  const state={...fresh,startedAt:start,words:[word,word,'!'],bed:[]};
  assert.deepEqual(restoreRound(state,7).words,[word]);assert.equal(msLeft(restoreRound(state,7),start+12000),48000);
  assert.equal(restoreRound(state,8),null);assert.equal(restoreRound({version:1,round:1,found:{}},null),null);
});
test('a shared URL carries only the board and reproduces its layout',()=>{
  for(const seed of [0,1,2345687123,0xffffffff]){
    const url=new URL(boardLink('https://example.test/?old=yes#old',seed));
    assert.equal(url.searchParams.size,1);assert.equal(url.hash,'');assert.equal(seedFromLink(url.searchParams.get('board')),seed);
    assert.deepEqual(boardFor(seed),boardFor(seedFromLink(url.searchParams.get('board'))));
  }
  for(const value of ['','-1','../../x','zzzzzzz','a b'])assert.equal(seedFromLink(value),null);
});
