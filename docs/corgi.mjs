import {read,write} from './guests.mjs';

export function placeCorgi(pet, meadow, onPet, key='clover.pet-position.v1') {
  let position=read('localStorage',key), drag=null, hop=0;
  if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y)) position=null;
  function setPoint(x,y) {
    const w=meadow.clientWidth,h=meadow.clientHeight;
    if (!w||!h) return;
    const marginX=pet.offsetWidth/2,marginY=pet.offsetHeight/2;
    x=Math.max(marginX,Math.min(w-marginX,x));y=Math.max(marginY,Math.min(h-marginY,y));
    pet.style.setProperty('--pet-x',x/w*100+'%');pet.style.setProperty('--pet-y',y/h*100+'%');
    position={x:x/w,y:y/h};
  }
  const restore=()=>{if(position) setPoint(position.x*meadow.clientWidth,position.y*meadow.clientHeight);};
  if(position){pet.classList.add('moved');restore();}
  new ResizeObserver(restore).observe(meadow);
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  function playWithBone(){
    if(!reducedMotion.matches) pet.classList.add('playing');
  }
  pet.addEventListener('animationiteration',e=>{
    // Let a released bone finish its arc and land back in Clover's mouth.
    if(e.animationName==='clover-bone-toss' && !drag?.moved) pet.classList.remove('playing');
  });
  reducedMotion.addEventListener?.('change',()=>{
    if(reducedMotion.matches) pet.classList.remove('playing');
  });
  function petDog() {
    pet.classList.remove('petted');void pet.offsetWidth;pet.classList.add('petted');
    clearTimeout(hop);hop=setTimeout(()=>pet.classList.remove('petted'),480);playWithBone();onPet();
  }
  pet.addEventListener('pointerdown',e=>{
    if(e.button!==0||!e.isPrimary||drag) return;
    const r=pet.getBoundingClientRect();
    drag={id:e.pointerId,startX:e.clientX,startY:e.clientY,dx:r.left+r.width/2-e.clientX,dy:r.top+r.height/2-e.clientY,lastX:e.clientX,moved:false};
    pet.setPointerCapture(e.pointerId);e.preventDefault();
  });
  pet.addEventListener('pointermove',e=>{
    if(drag?.id!==e.pointerId) return;
    if(!drag.moved && Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<4) return;
    drag.moved=true;pet.classList.add('dragging','moved');playWithBone();
    pet.style.setProperty('--lean',Math.max(-8,Math.min(8,(e.clientX-drag.lastX)*.18))+'deg');drag.lastX=e.clientX;
    const r=meadow.getBoundingClientRect();setPoint(e.clientX-r.left+drag.dx,e.clientY-r.top+drag.dy);
  });
  function finish(e){
    if(drag?.id!==e.pointerId) return;
    if(drag.moved) write('localStorage',key,position);
    else if(e.type==='pointerup') petDog();
    drag=null;pet.classList.remove('dragging');
  }
  for(const name of ['pointerup','pointercancel','lostpointercapture']) pet.addEventListener(name,finish);
  pet.addEventListener('dragstart',e=>e.preventDefault());
  pet.addEventListener('click',e=>{if(e.detail===0) petDog();});
  pet.addEventListener('keydown',e=>{
    const vector={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
    if(!vector) return;
    e.preventDefault();const r=pet.getBoundingClientRect(),m=meadow.getBoundingClientRect(),step=e.shiftKey?50:14;
    setPoint(r.left+r.width/2-m.left+step*vector[0],r.top+r.height/2-m.top+step*vector[1]);
    pet.classList.add('moved');write('localStorage',key,position);playWithBone();
  });
}
