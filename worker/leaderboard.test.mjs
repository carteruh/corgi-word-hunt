import test from 'node:test';
import assert from 'node:assert/strict';
import {serveScores} from './leaderboard.mjs';
import {localDb} from '../tools/local-db.mjs';
import {boardFor,points} from '../docs/puzzle.mjs';

test('the GitHub Pages game can preflight and play on the same scoreboard',async()=>{
  const db=localDb(),origin='https://carteruh.github.io',url='https://garden.example/api/boards/1dh1/';
  try {
    const guest=crypto.randomUUID(),ticket=crypto.randomUUID();
    const preflight=await serveScores(new Request(url+'rounds',{method:'OPTIONS',headers:{
      Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type,x-garden-guest'}}),db);
    assert.equal(preflight.status,204);
    assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),origin);
    assert.match(preflight.headers.get('Access-Control-Allow-Headers'),/X-Garden-Guest/i);
    const round=await serveScores(new Request(url+'rounds',{method:'POST',headers:{Origin:origin,'X-Garden-Guest':guest},
      body:JSON.stringify({ticket,nickname:'Clover'})}),db);
    assert.equal(round.status,200);assert.equal((await round.json()).ticket,ticket);
    const scores=await serveScores(new Request(url+'scores',{headers:{Origin:origin}}),db);
    assert.equal(scores.headers.get('Access-Control-Allow-Origin'),origin);
    assert.equal((await scores.json()).board,'1dh1');
  } finally {db.close();}
});

test('independent guests see one verified best per board and share ranks on ties',async()=>{
  const db=localDb(),board='1dh1', origin='https://garden.example';
  const [alice,bob,cat]=Array.from({length:3},()=>crypto.randomUUID());
  const [a,b,c,a2]=Array.from({length:4},()=>crypto.randomUUID());
  const words=[...boardFor(parseInt(board,36)).validWords].slice(0,3);
  const score=words.reduce((sum,w)=>sum+points(w),0);
  const call=async(guest,action,method='GET',body,now=1000,slug=board)=>{
    const request=new Request(origin+'/api/boards/'+slug+'/'+action,{method,
      headers:{Origin:origin,...(guest?{'X-Garden-Guest':guest}:{})},body:body?JSON.stringify(body):undefined});
    const response=await serveScores(request,db,now);
    return {status:response.status,data:await response.json()};
  };
  try{
    for(const [guest,ticket,nickname] of [[alice,a,'Willow'],[bob,b,'Fern'],[cat,c,'Moss']]){
      const {data}=await call(guest,'rounds','POST',{ticket,nickname});assert.equal(data.endsAt,61000);
    }
    assert.equal((await call(alice,'rounds','POST',{ticket:a,nickname:'Willow'},5000)).data.endsAt,61000);
    assert.equal((await call(bob,'rounds/'+a,'PUT',{words})).status,404);
    await call(alice,'rounds/'+a,'PUT',{words:[...words,...words,'NOTAWORD'],score:99999});
    await call(alice,'rounds/'+a,'PUT',{words:[words[0]]});
    await call(bob,'rounds/'+b,'PUT',{words:[words[0]]});
    await call(cat,'rounds/'+c,'PUT',{words});
    assert.equal((await call(null,'scores')).data.leaders.length,0);
    assert.equal((await call(bob,'rounds/'+b,'PUT',{words},68000)).status,410);
    const publicList=(await call(null,'scores','GET',null,68000)).data;
    assert.deepEqual(publicList.leaders.map(p=>[p.rank,p.score]),[[1,score],[1,score],[3,points(words[0])]]);
    assert.equal(publicList.me,null);assert.equal(JSON.stringify(publicList).includes(alice),false);
    assert.equal((await call(bob,'scores','GET',null,68000)).data.me.rank,3);
    assert.equal((await call(alice,'name','PUT',{nickname:'Clover Fan'},69000)).data.nickname,'Clover Fan');
    await call(alice,'rounds','POST',{ticket:a2,nickname:'Clover Fan'},70000);
    await call(alice,'rounds/'+a2,'PUT',{words:[words[0]]},71000);
    const result=(await call(alice,'scores','GET',null,131000)).data;
    assert.equal(result.leaders.length,3);assert.equal(result.me.score,score);assert.equal(result.me.nickname,'Clover Fan');
    assert.deepEqual((await call(null,'scores','GET',null,131000,'other')).data.leaders,[]);
    assert.equal((await call(null,'rounds','POST',{ticket:a,nickname:'Anon'})).status,401);
    assert.equal((await call(alice,'name','PUT',{nickname:'<script>'})).status,400);
  }finally{db.close();}
});
