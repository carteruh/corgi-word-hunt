import {read,write} from './guests.mjs';

function connectSoup(button, root, pages) {
  let x=0, y=0, grab=null;
  function place(left,top) {
    const card=button.getBoundingClientRect(), bounds=root.getBoundingClientRect(), content=pages.getBoundingClientRect();
    const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
    x+=clamp(left,bounds.left+15,bounds.right-card.width-15)-card.left;
    y+=clamp(top,content.top+10,content.bottom-card.height-10)-card.top;
    button.style.setProperty('--soup-x',Math.round(x)+'px');
    button.style.setProperty('--soup-y',Math.round(y)+'px');
  }
  function drop() {
    if(grab && button.hasPointerCapture(grab.id))button.releasePointerCapture(grab.id);
    grab=null;button.classList.remove('is-held');
  }
  function reset() {
    drop();x=0;y=0;
    for(const prop of ['--soup-x','--soup-y','--soup-tilt'])button.style.removeProperty(prop);
  }
  button.addEventListener('pointerdown',event=>{
    if(!event.isPrimary || event.button!==0 || grab)return;
    event.preventDefault();button.focus({preventScroll:true});
    const card=button.getBoundingClientRect();
    grab={id:event.pointerId,dx:event.clientX-card.left,dy:event.clientY-card.top,lastX:event.clientX};
    button.setPointerCapture(event.pointerId);button.classList.add('is-held');
  });
  button.addEventListener('pointermove',event=>{
    if(!grab || event.pointerId!==grab.id)return;
    button.style.setProperty('--soup-tilt',Math.max(-6,Math.min(6,(event.clientX-grab.lastX)*.25))+'deg');
    grab.lastX=event.clientX;place(event.clientX-grab.dx,event.clientY-grab.dy);
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,event=>{
    if(grab?.id===event.pointerId)drop();
  });
  button.addEventListener('keydown',event=>{
    const offsets={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
    if(event.key==='Home')reset();
    else if(offsets[event.key]){
      const [dx,dy]=offsets[event.key], card=button.getBoundingClientRect(), step=event.shiftKey?55:22;
      place(card.left+dx*step,card.top+dy*step);
    }else return;
    event.preventDefault();event.stopPropagation();
  });
  window.addEventListener('resize',()=>{
    if(!(x || y) || !button.getClientRects().length)return;
    const card=button.getBoundingClientRect();place(card.left,card.top);
  });
  return reset;
}

export function connectWelcome(root, enterMeadow, playChime) {
  const slides=[...root.querySelectorAll('.welcome-slide')];
  const dots=[...root.querySelectorAll('.welcome-dots i')];
  const pages=root.querySelector('#welcome-pages'), status=root.querySelector('#welcome-status');
  const back=root.querySelector('#welcome-back'), next=root.querySelector('#welcome-next');
  const soup=root.querySelector('#welcome-soup'), resetSoup=connectSoup(soup,root,pages);
  const key='clover.welcome-note.v1', saved=read('sessionStorage',key);
  let page=Number.isInteger(saved) && saved>=0 && saved<=slides.length?saved:0;
  let active=false, touch=null;

  function remember(index) {
    page=index; write('sessionStorage',key,index);
  }
  function paint(animate=false) {
    resetSoup();
    root.dataset.page=String(page+1);
    for (const [i,slide] of slides.entries()) {
      slide.hidden=i!==page;
      dots[i].classList.toggle('current',i===page);
      slide.classList.toggle('is-entering',animate && i===page);
      if (slide.hidden) slide.querySelectorAll('picture').forEach(picture=>picture.remove());
      else for(const template of slide.querySelectorAll('template')){
        if(!template.nextElementSibling)template.after(template.content.cloneNode(true));
      }
    }
    back.disabled=page===0;
    next.textContent=page===slides.length-1?'Enter the meadow':'Next';
    const lines=[...slides[page].querySelectorAll('.welcome-message p')].map(p=>p.textContent);
    status.textContent='Slide '+(page+1)+' of '+slides.length+'. '+lines.join(' ');
  }
  function finish() {
    if (!active) return;
    remember(slides.length);
    playChime();
    enterMeadow();
  }
  function move(direction) {
    if (!active || page+direction<0) return;
    if (page+direction===slides.length) { finish(); return; }
    const wasBack=document.activeElement===back;
    remember(page+direction); paint(true); playChime();
    if (back.disabled && wasBack) next.focus({preventScroll:true});
  }
  back.addEventListener('click',()=>move(-1));
  next.addEventListener('click',()=>move(1));
  root.querySelector('#welcome-skip').addEventListener('click',finish);
  document.addEventListener('keydown',event=>{
    if (!active || event.repeat || event.altKey || event.metaKey || event.ctrlKey) return;
    if (event.key==='ArrowRight') move(1);
    else if (event.key==='ArrowLeft') move(-1);
    else if (event.key==='Escape') finish();
    else return;
    event.preventDefault();
  });
  pages.addEventListener('touchstart',event=>{
    const finger=event.touches.length===1 && !soup.contains(event.target)?event.touches[0]:null;
    touch=finger?{id:finger.identifier,x:finger.clientX,y:finger.clientY}:null;
  },{passive:true});
  pages.addEventListener('touchcancel',()=>{touch=null;});
  pages.addEventListener('touchend',event=>{
    const origin=touch; touch=null;
    if (!origin || event.touches.length) return;
    const finger=[...event.changedTouches].find(t=>t.identifier===origin.id);
    if (!finger) return;
    const dx=finger.clientX-origin.x, dy=finger.clientY-origin.y;
    if (Math.abs(dx)>44 && Math.abs(dx)>Math.abs(dy)*1.3) move(dx<0?1:-1);
    else if (Math.abs(dy)>55 && Math.abs(dy)>Math.abs(dx)*1.3 && document.documentElement.scrollHeight<=innerHeight+1) move(dy<0?1:-1);
  },{passive:true});

  return {
    get finished(){return page===slides.length;},
    restart(){remember(0); if(active)paint();},
    show(){active=true; paint();},
    hide(){active=false; touch=null; resetSoup(); root.querySelectorAll('picture').forEach(picture=>picture.remove()); status.textContent='';},
  };
}
