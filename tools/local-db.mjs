import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';

// Run the same migration and SQL locally that the hosted D1 binding uses.
export function localDb(){
  const db=new DatabaseSync(':memory:');
  const dir=new URL('../drizzle/',import.meta.url);
  for(const file of readdirSync(dir).filter(f=>f.endsWith('.sql')).sort()) db.exec(readFileSync(new URL(file,dir),'utf8'));
  function prepare(sql,params=[]){
    const stmt=db.prepare(sql);
    return {bind:(...args)=>prepare(sql,args),first:()=>stmt.get(...params)??null,
      all:()=>({results:stmt.all(...params)}),run:()=>stmt.run(...params)};
  }
  return {prepare,batch(statements){
    db.exec('BEGIN');try{const result=statements.map(s=>s.run());db.exec('COMMIT');return result;}
    catch(error){db.exec('ROLLBACK');throw error;}
  },close:()=>db.close()};
}
