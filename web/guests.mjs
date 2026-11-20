export function read(storage, key) {
  try { return JSON.parse(window[storage].getItem(key)); } catch { return null; }
}
export function write(storage, key, value) {
  try { window[storage].setItem(key,JSON.stringify(value)); } catch { /* Keep playing in memory. */ }
}
export function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b=crypto.getRandomValues(new Uint8Array(16));
  b[6]=(b[6]&15)|64; b[8]=(b[8]&63)|128;
  const s=Array.from(b,n=>n.toString(16).padStart(2,'0')).join('');
  return [s.slice(0,8),s.slice(8,12),s.slice(12,16),s.slice(16,20),s.slice(20)].join('-');
}
const key='clover.guest.v1';
const existing=read('localStorage',key) || read('sessionStorage',key);
const ferns=['Clover','Hazel','Moss','Fern','Willow','Maple','Poppy','Aster','Peach','Basil','Cedar','Daisy'];
const animals=['Pup','Wren','Finch','Otter','Bunny','Robin','Fawn','Badger','Fox','Mouse','Sparrow','Bee'];
const pick=items=>items[crypto.getRandomValues(new Uint8Array(1))[0]%items.length];
export const guest=existing?.id && typeof existing.name==='string' ? existing :
  {id:newId(),name:pick(ferns)+' '+pick(animals)+' '+String(crypto.getRandomValues(new Uint16Array(1))[0]%90+10)};
export function rememberGuest() { write('localStorage',key,guest); write('sessionStorage',key,guest); }
rememberGuest();
export const onlineGame=['http:','https:'].includes(location.protocol);
const scoreService=location.origin==='https://carteruh.github.io'?'https://moonpetal-moonlit-word-hunt.smoky-dune-6060.chatgpt.site':'';

export async function boardRequest(seed, action, method='GET', body, timeout=6500) {
  if (!onlineGame) throw new Error('Open the shared game online to see board scores.');
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),timeout);
  try {
    const response=await fetch(scoreService+'/api/boards/'+seed.toString(36)+'/'+action,{
      method,headers:{'X-Garden-Guest':guest.id,...(body?{'Content-Type':'application/json'}:{})},
      body:body?JSON.stringify(body):undefined,cache:'no-store',credentials:'same-origin',keepalive:method==='PUT',signal:controller.signal,
    });
    const data=await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not reach the board.');
    return data;
  } finally { clearTimeout(timer); }
}

export function connectLeaderboard({getRound,share,onRank}) {
  const $=id=>document.getElementById(id), dialog=$('scores-dialog');
  let generation=0, poll=0;
  $('guest-label').textContent=guest.name;
  function render(rows) {
    $('leaders').replaceChildren(...rows.map(row=>{
      const li=document.createElement('li'); if(row.mine) li.className='mine';
      for (const [className,value] of [['rank','#'+row.rank],['player',row.nickname+(row.mine?' (you)':'')],['pts',row.score.toLocaleString()+' pts']]) {
        const cell=document.createElement('span');cell.className=className;cell.textContent=value;li.append(cell);
      }
      return li;
    }));
  }
  async function refresh() {
    const {seed}=getRound(), id=++generation;
    try {
      const data=await boardRequest(seed,'scores');
      if (id!==generation || getRound().seed!==seed) return;
      const rows=[...data.leaders];
      if(data.me && !rows.some(r=>r.mine)) rows.push(data.me);
      render(rows);
      $('leaders-status').textContent=rows.length?'':'No scores yet. Find a word to take the first spot.';
      onRank(data.me);
    } catch {
      if (id!==generation || getRound().seed!==seed) return;
      $('leaders-status').textContent=onlineGame?'Scores couldn’t refresh. Try again in a moment.':'Shared scores are available in the online game.';
      onRank(undefined);
    }
  }
  function open(edit=false) {
    document.querySelector('[data-board-code]').textContent=getRound().seed.toString(36).toUpperCase();
    $('nickname').value=guest.name;$('name-status').textContent='';render([]);
    $('leaders-status').textContent='Checking this board…';
    if (!dialog.open) dialog.showModal();
    if (edit) { $('nickname').focus(); $('nickname').select(); }
    refresh(); clearInterval(poll);
    poll=setInterval(()=>{if(!document.hidden) refresh();},12000);
  }
  dialog.addEventListener('close',()=>clearInterval(poll));
  document.addEventListener('visibilitychange',()=>{if(dialog.open&&!document.hidden) refresh();});
  $('guest-form').addEventListener('submit',async e=>{
    e.preventDefault();
    const name=$('nickname').value.normalize('NFC').trim().replace(/\s+/gu,' ');
    if (!name||[...name].length>20||/[\p{C}<>]/u.test(name)) { $('name-status').textContent='Use 1 to 20 letters, spaces, numbers or symbols.';return; }
    if (onlineGame) {
      try { await boardRequest(getRound().seed,'name','PUT',{nickname:name}); }
      catch { $('name-status').textContent='Couldn’t save that nickname. Please try again.';return; }
    }
    guest.name=name;rememberGuest();$('guest-label').textContent=name;$('nickname').value=name;$('name-status').textContent='Nickname saved.';
    if(onlineGame) refresh();
  });
  $('scores-button').onclick=()=>open();$('result-scores').onclick=()=>open();$('guest-button').onclick=()=>open(true);
  $('scores-share').onclick=share;$('scores-refresh').onclick=refresh;
  return {refresh};
}
