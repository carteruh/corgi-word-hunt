import { SIZE, ROUND_MS, boardFor, seedFromLink, boardLink, freshRound, restoreRound, msLeft, stepPath, spell, points, judge } from './puzzle.mjs';

import {read,write,guest,newId,onlineGame,boardRequest,connectLeaderboard} from './guests.mjs';
import {placeCorgi} from './corgi.mjs';
import {connectPetalWind} from './petal-wind.mjs';
import {connectWelcome} from './welcome.mjs';
import {gardenAudio,melodyLength,phraseDelays} from './garden-audio.mjs';

const $ = id => document.getElementById(id);
const board = $('board'), roundKey = 'moonpetal.timed.v2', bestKey = 'moonpetal.best.v2', soundKey = 'moonpetal.sound.v1';
const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
const invited = seedFromLink(new URL(location.href).searchParams.get('board'));
let round = restoreRound(read('sessionStorage',roundKey),invited) ?? freshRound(invited ?? randomSeed());
const gardenKey = seed=>'clover.meadow.v1.'+seed.toString(36);
let starting=false, mounted=0, garden=null, queued=null, lastRetry=0;
let field = boardFor(round.seed), tiles = [], path = [], gesture = null, focusCell = 0;
let ticker = 0, secondsShown = -1, sound = read('localStorage',soundKey) !== false;
const audio=gardenAudio(sound);
let best = Math.max(0,Number(read('localStorage',bestKey))||0);
let gardenImport, screen;
const total = () => round.words.reduce((sum,word)=>sum+points(word),0);
const persist = () => write('sessionStorage',roundKey,round);
const running = () => round.startedAt!==null && !round.finished;

// Mobile browsers unlock audio during a touch or key gesture, before a drag plants its first flower.
for(const type of ['pointerdown','pointerup','touchend','click','keydown'])document.addEventListener(type,audio.unlock,{capture:true,passive:true});
let melodyKey='',nextNote=0;
function currentNote() {
  const key='clover.merry-go-round.v1.'+round.seed.toString(36);
  if(melodyKey!==key){
    const saved=read('localStorage',key);
    nextNote=Number.isInteger(saved) && saved>=0?saved%melodyLength:0;
    melodyKey=key;
  }
  return nextNote;
}
function playFlowerNote() {
  const seed=round.seed;
  audio.whenReady(()=>{
    if(round.seed!==seed)return;
    audio.flower(currentNote());
    nextNote=(nextNote+1)%melodyLength;write('localStorage',melodyKey,nextNote);
  });
}
function paintSound() {
  for(const button of document.querySelectorAll('[data-sound]')){
    button.setAttribute('aria-pressed',String(sound));button.title=sound?'Turn sound off':'Turn sound on';
    button.querySelector('use').setAttribute('href',sound?'#i-sound':'#i-mute');
    const label=button.querySelector('[data-sound-label]');if(label)label.textContent=sound?'Sound on':'Sound off';
  }
}
document.querySelectorAll('[data-sound]').forEach(b=>b.addEventListener('click',()=>{
  garden?.stopTrail();sound=!sound;write('localStorage',soundKey,sound);audio.setEnabled(sound);paintSound();
  if(sound)audio.cue('page');
}));
function feedback(message,tone='plain') {
  $('feedback').textContent=message; $('feedback').parentElement.dataset.tone=tone;
  $('note-icon').setAttribute('href',tone==='success'?'#i-check':'#i-trace');
}
function newBoardView(){
  focusCell=0; tiles=[];
  const ready=round.startedAt===null;
  const rows=Array.from({length:SIZE},(_,r)=>{
    const row=document.createElement('div');row.className='grid-row';row.setAttribute('role','row');
    for(let c=0;c<SIZE;c++){
      const i=r*SIZE+c, l=field.tiles[i], tile=document.createElement('button');
      tile.type='button';tile.className='tile';tile.dataset.cell=i;tile.setAttribute('role','gridcell');
      tile.setAttribute('aria-label',(ready?'Covered':l)+', row '+(r+1)+', column '+(c+1));
      tile.setAttribute('aria-selected','false');tile.tabIndex=i===0&&!ready?0:-1;tile.disabled=ready;
      const glyph=document.createElement('span');glyph.textContent=ready?'✦':l==='QU'?'Qu':l;
      tile.append(glyph);tiles.push(tile);row.append(tile);
    }
    return row;
  });
  board.replaceChildren(...rows);
  board.classList.toggle('covered',ready);

}
function journal(){
  $('score').textContent=total().toLocaleString(); $('compact-score').textContent=total().toLocaleString()+' pts'; $('count').textContent=round.words.length;
  $('best').textContent=best.toLocaleString()+' pts';
  $('empty-journal').hidden=round.words.length>0;
  $('words').replaceChildren(...[...round.words].reverse().map(word=>{
    const li=document.createElement('li'),name=document.createElement('span'),value=document.createElement('span');
    name.textContent=word;value.textContent='+'+points(word).toLocaleString();li.append(name,value);return li;
  }));
}
function drawPath(){
  const active=new Set(path);
  tiles.forEach((tile,i)=>{
    tile.classList.toggle('tracing',active.has(i));tile.classList.toggle('tip',i===path.at(-1));
    tile.setAttribute('aria-selected',String(active.has(i)));
  });
  $('trace-line').setAttribute('points',path.map(i=>(i%SIZE+.5)+','+(Math.floor(i/SIZE)+.5)).join(' '));
  $('draft-word').textContent=spell(field.tiles,path);
  $('draft-row').hidden=!path.length;
  $('submit-button').disabled=spell(field.tiles,path).length<3;
}
function clearPath(){path=[];gesture=null;drawPath();}
function step(cell) {
  const next=stepPath(path,cell);
  if(next===path) return;
  path=next;drawPath();
}
function paintTime(ms){
  const seconds=Math.ceil(ms/1000);
  if(seconds!==secondsShown){
    secondsShown=seconds; $('timer').textContent=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
    $('time-chip').classList.toggle('urgent',seconds<=10 && running());
  }
  $('clock-fill').style.transform='scaleX('+ms/ROUND_MS+')';
}
function clock(){
  const left=msLeft(round);paintTime(left);
  if(running() && round.ticket && (round.syncedWords||0)<round.words.length && !queued && Date.now()-lastRetry>2300) pushWords();
  if(running() && left===0){finishRound();return false;}
  return running();
}
function setFocus(i, focus=true){
  tiles[focusCell].tabIndex=-1;focusCell=i;tiles[i].tabIndex=0;
  if(focus)tiles[i].focus({preventScroll:true});
}
function submit(){
  if(!clock() || !path.length)return;
  const verdict=judge(field,path,round.words);
  clearPath();
  if(!verdict.word){feedback(verdict.message,'miss');return;}
  round.words.push(verdict.word);persist();journal();pushWords();
  feedback(verdict.word+'  +'+verdict.points.toLocaleString()+' pts','success');audio.cue('word');
}
function importGarden(){
  gardenImport ??= import('./garden-view.mjs').catch(error=>{gardenImport=null;throw error;});
  return gardenImport;
}
function useBoardAddress(hash='',push=false){
  const url=new URL(onlineGame?boardLink(location.href,round.seed):location.href);
  url.hash=hash;
  if(url.href!==location.href) {
    if(push)history.pushState(null,'',url);
    else history.replaceState(null,'',url);
  }
}
function showScreen(next){
  if(screen===next)return;
  if(screen==='welcome')welcome.hide();
  if(screen==='home')petals.stop();
  if(screen==='garden'){garden?.dispose();garden=null;}
  screen=next;document.body.dataset.screen=next;
  document.body.classList.toggle('in-game',next==='hunt');
  $('welcome').hidden=next!=='welcome';$('petal-wind').hidden=next!=='home';$('game-shell').hidden=next!=='hunt';$('garden-home').hidden=next!=='garden';
  if(next==='welcome')welcome.show();
  if(next==='home'){
    $('visit-garden').hidden=!round.finished;
    petals.start();
  }
  window.scrollTo(0,0);
}
function playView(){
  showScreen('hunt');newBoardView();journal();paintTime(msLeft(round));
  importGarden().catch(()=>{}); // Have the planting tools ready when the minute ends.
  $('sync-status').textContent=round.ticket?'':'Practice round · shared scores are offline.';
}
async function startRound(){
  if(starting || running() || screen==='welcome')return;
  starting=true;
  const button=screen==='garden'?$('replay-button'):$('start-button');
  button.disabled=true;const label=button.textContent;
  const labelNode=button.querySelector('span'); if(labelNode)labelNode.textContent='Opening board…';
  const fresh=freshRound(round.seed);
  let elapsed=0;
  if(onlineGame){
    const ticket=newId();
    try{
      const ack=await boardRequest(fresh.seed,'rounds','POST',{ticket,nickname:guest.name},4800);
      if(ack.ticket===ticket && Number.isFinite(ack.endsAt)){
        fresh.ticket=ticket;elapsed=Math.max(0,ROUND_MS-(ack.endsAt-ack.serverTime));
      }
    }catch{ /* An offline player still gets a full practice round. */ }
  }
  round=fresh;round.startedAt=Date.now()-elapsed;round.syncedWords=0;
  field=boardFor(round.seed);secondsShown=-1;persist();useBoardAddress();playView();setFocus(0);
  feedback('Trace a word and lift, or tap tiles and submit.');
  ticker=window.setInterval(clock,100);audio.cue('start');
  button.disabled=false;if(labelNode)labelNode.textContent=label.trim();
  starting=false;
}
function pushWords(){
  const current=round;
  if(!current.ticket||queued?.round===current||(current.syncedWords||0)>=current.words.length) return queued?.promise;
  const words=[...current.words];lastRetry=Date.now();
  const task=boardRequest(current.seed,'rounds/'+current.ticket,'PUT',{words}).then(()=>{
    current.syncedWords=Math.max(current.syncedWords||0,words.length);
    if(current===round){persist();$('sync-status').textContent='';}
  }).catch(()=>{
    if(current===round) $('sync-status').textContent='Some words are waiting for a connection.';
  }).finally(()=>{
    if(queued?.round===current) queued=null;
    if(current===round && current.syncedWords>=words.length && current.words.length>words.length) pushWords();
  });
  queued={round:current,promise:task};return task;
}
function finishRound(){
  if(round.finished)return;
  clearInterval(ticker);ticker=0;round.finished=true;clearPath();paintTime(0);
  best=Math.max(best,Number(read('localStorage',bestKey))||0,total());
  write('localStorage',bestKey,best);persist();journal();
  for(const d of document.querySelectorAll('dialog[open]')) d.close();
  audio.cue('end');
  useBoardAddress('#garden',true);showGarden();$('result-title').focus({preventScroll:true});
  const current=round;
  (async()=>{
    await pushWords();
    if(current!==round)return;
    if(current.words.length>(current.syncedWords||0))await pushWords();
    if(current===round) leaderboard.refresh();
  })();
  setTimeout(()=>{if(round===current) leaderboard.refresh();},2500);
}
function nextBoard(){
  if(running() || starting)return;
  let seed=randomSeed();while(field.tiles.join('')===boardFor(seed).tiles.join(''))seed=(seed+8)>>>0;
  round=freshRound(seed);field=boardFor(seed);clearPath();persist();useBoardAddress();followAddress();
}
function hit(x,y,slop=false){
  const r=board.getBoundingClientRect(), fx=(x-r.left)*SIZE/r.width,fy=(y-r.top)*SIZE/r.height;
  const col=Math.floor(fx),row=Math.floor(fy);
  if(row<0||row>=SIZE||col<0||col>=SIZE)return null;
  if(!slop && Math.hypot(fx-col-.5,fy-row-.5)>.46)return null;
  return row*SIZE+col;
}
function traceSegment(x,y){
  const g=gesture;
  const distance=Math.hypot(x-g.x,y-g.y), size=board.getBoundingClientRect().width/SIZE;
  const steps=Math.max(1,Math.min(70,Math.ceil(distance/(size*.23))));
  for(let i=1;i<=steps;i++){
    const cell=hit(g.x+(x-g.x)*i/steps,g.y+(y-g.y)*i/steps);
    if(cell===null)continue;
    if(cell!==g.first)g.dragged=true;
    step(cell);
  }
  g.x=x;g.y=y;
}
board.addEventListener('pointerdown',e=>{
  if(!e.isPrimary || e.button!==0 || gesture || !clock())return;
  const cell=hit(e.clientX,e.clientY,true);if(cell===null)return;
  e.preventDefault();gesture={id:e.pointerId,first:cell,x:e.clientX,y:e.clientY,dragged:false};
  board.setPointerCapture(e.pointerId);setFocus(cell);step(cell);
});
board.addEventListener('pointermove',e=>{
  if(gesture?.id!==e.pointerId || !clock())return;
  for(const sample of e.getCoalescedEvents?.()??[])traceSegment(sample.clientX,sample.clientY);
  traceSegment(e.clientX,e.clientY);
});
board.addEventListener('pointerup',e=>{
  if(gesture?.id!==e.pointerId || !clock())return;
  traceSegment(e.clientX,e.clientY);
  const dragged=gesture.dragged;gesture=null;
  if(dragged)submit();
});
for(const event of ['pointercancel','lostpointercapture']){
  board.addEventListener(event,e=>{if(gesture?.id===e.pointerId)clearPath();});
}
board.addEventListener('contextmenu',e=>e.preventDefault());
board.addEventListener('focusin',e=>{const tile=e.target.closest('.tile');if(tile)setFocus(Number(tile.dataset.cell),false);});
board.addEventListener('click',e=>{
  const tile=e.target.closest('.tile');if(tile && e.detail===0 && clock())step(Number(tile.dataset.cell));
});
board.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey||!clock())return;
  const row=Math.floor(focusCell/SIZE),col=focusCell%SIZE;
  let idx=focusCell;
  switch(e.key){
    case 'ArrowLeft': if(col)idx--;break;
    case 'ArrowRight': if(col<SIZE-1)idx++;break;
    case 'ArrowUp': if(row)idx-=SIZE;break;
    case 'ArrowDown': if(row<SIZE-1)idx+=SIZE;break;
    case ' ': if(!e.repeat)step(focusCell);break;
    case 'Enter': if(!e.repeat)submit();break;
    case 'Backspace': path=path.slice(0,-1);drawPath();break;
    case 'Escape': clearPath();break;
    default:return;
  }
  e.preventDefault();if(idx!==focusCell)setFocus(idx);
});
$('undo-button').addEventListener('click',()=>{if(clock()){path=path.slice(0,-1);drawPath();}});
$('submit-button').addEventListener('click',submit);
window.addEventListener('blur',()=>{if(gesture)clearPath();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)clock();});
window.addEventListener('pageshow',clock);

let brush='plant';
function brushText(mode){
  if(mode==='plant')return matchMedia('(pointer:coarse)').matches?'Tap for one flute note. Drag to plant a whole phrase.':'Click for one flute note. Drag to plant a whole phrase.';
  return 'Tap or brush over a flower to '+mode+' it.';
}
function setBrush(mode){
  brush=mode;garden?.setMode(mode);$('garden-tip').textContent=brushText(mode);
  document.querySelectorAll('[data-brush]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.brush===mode)));
}
function showRank(me){
  if(!round.finished) return;
  let message;
  if(!round.ticket) message='This was a practice round. Play online to rank on this board.';
  else if(me) message='Your board best is #'+me.rank+' with '+me.score.toLocaleString()+' points.';
  else if(!round.words.length) message='Find a word on your next hunt to join the board scores.';
  else if(me===undefined || (round.syncedWords||0)<round.words.length) message='The connection interrupted score sharing. Board scores show the words received.';
  else message='Your board score is updating…';
  $('rank-summary').textContent=message;
}
async function showGarden(){
  const current=round, id=++mounted, count=current.words.length;
  showScreen('garden');
  $('result-title').textContent=count?'Your garden grew!':'Welcome to your garden';
  $('win-message').textContent=count+' '+(count===1?'word':'words')+' · '+total().toLocaleString()+' points'+(count?' · '+count+(count===1?' new flower':' new flowers'):'');
  $('rank-summary').textContent='Checking board scores…';showRank(null);
  setBrush('plant');
  try{
    const mod=await importGarden();
    if(id!==mounted || current!==round || screen!=='garden') return;
    const bedKey=gardenKey(current.seed), saved=read('localStorage',bedKey);
    const earned=current.planted?[]:current.words;
    garden=mod.createGarden({host:$('garden-stage'),seed:current.seed,words:earned,saved,
      onChange:bed=>{write('localStorage',bedKey,bed);if(!current.planted){current.planted=true;persist();}},
      onPlant:playFlowerNote,phraseTiming:()=>phraseDelays(currentNote()),phraseTime:()=>performance.now(),
      onNotice:msg=>{$('garden-tip').textContent=msg;}});
    garden.setMode(brush);
  }catch{
    if(id===mounted)$('garden-tip').textContent='Reload to try the flower brushes again.';
  }
}
document.querySelectorAll('[data-brush]').forEach(b=>b.addEventListener('click',()=>setBrush(b.dataset.brush)));
$('help-button').addEventListener('click',()=>{clearPath();$('help-dialog').showModal();});
$('start-button').onclick=startRound;$('replay-button').onclick=startRound;$('new-board').onclick=nextBoard;
async function shareBoard(){
  const url=boardLink(document.querySelector('link[rel="canonical"]').href,round.seed);
  if(navigator.share){
    try{await navigator.share({title:'Corgi Word Hunt',text:'Play my 60-second word hunt with Clover and compare board scores!',url});return;}
    catch(error){if(error.name==='AbortError')return;}
  }
  $('share-url').value=url;$('copy-note').textContent='';$('copy-button').textContent='Copy link';
  if(!$('share-dialog').open)$('share-dialog').showModal();
}
$('share-button').onclick=shareBoard;
const leaderboard=connectLeaderboard({getRound:()=>round,share:shareBoard,onRank:showRank});
const petals=connectPetalWind($('petal-wind'),playFlowerNote);
const welcome=connectWelcome($('welcome'),()=>{
  showScreen('home');$('start-button').focus({preventScroll:true});
},()=>audio.cue('page'));
$('read-note').onclick=()=>{
  if(starting || screen!=='home')return;
  welcome.restart();showScreen('welcome');$('welcome-next').focus({preventScroll:true});
};
const petClover=()=>audio.cue('pet');
const huntPet=$('corgi').cloneNode(true);huntPet.id='hunt-corgi';
$('hunt-companion').append(huntPet);
placeCorgi($('corgi'),$('garden-home'),petClover);
placeCorgi(huntPet,$('hunt-companion'),petClover,'clover.hunt-pet-position.v1');
$('copy-button').addEventListener('click',async()=>{
  const input=$('share-url');
  try{
    if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(input.value);
    else{input.focus();input.select();if(!document.execCommand('copy'))throw new Error();}
    $('copy-button').textContent='Copied';$('copy-note').textContent='Ready to send to a friend.';
  }catch{input.focus();input.select();$('copy-note').textContent='Select and copy the game link above.';}
});
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{
  if(e.target.closest('[data-dismiss]')){d.close();return;}
  if(e.target===d){
    const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();
  }
}));

function followAddress(){
  if(running() || starting){useBoardAddress();return;}
  const requested=seedFromLink(new URL(location.href).searchParams.get('board'));
  if(onlineGame && requested!==null && requested!==round.seed){location.reload();return;}
  const wantsGarden=round.finished && location.hash==='#garden';
  if(location.hash==='#welcome')welcome.restart();
  useBoardAddress(wantsGarden?'#garden':'');
  if(wantsGarden && screen!=='garden'){
    showGarden();leaderboard.refresh();$('result-title').focus({preventScroll:true});
  }else if(!wantsGarden){
    const fromGarden=screen==='garden';
    const next=welcome.finished?'home':'welcome';
    showScreen(next);
    if(fromGarden)$(next==='home'?'start-button':'welcome-next').focus({preventScroll:true});
  }
}
window.addEventListener('popstate',followAddress);
window.addEventListener('hashchange',followAddress);
paintSound();newBoardView();journal();persist();
if(running()){
  useBoardAddress();playView();if(clock())ticker=window.setInterval(clock,100);
}else{
  paintTime(msLeft(round));followAddress();
}
window.addEventListener('online',()=>{if(running())pushWords();if(round.finished)leaderboard.refresh();});
