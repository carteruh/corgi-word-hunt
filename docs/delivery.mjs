import {drawDelivery,filmSeconds} from './delivery-scene.mjs';

function stillTime(elapsed) {
  if(elapsed<3.4)return 2.15;
  if(elapsed<6.3)return 4.92;
  if(elapsed<8.4)return 6.80;
  return 10.15;
}

export function createTulipDelivery(dialog,playFlowerNote) {
  const screen=dialog.querySelector('.film-screen'), canvas=dialog.querySelector('canvas');
  const skip=dialog.querySelector('.film-skip'), flowers=dialog.querySelector('.film-flowers');
  const images=Array.from(dialog.querySelectorAll('[data-frame]'));
  const art=Object.fromEntries(images.map(img=>[img.dataset.frame,img]));
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let preload=null,session=null,frame=0,last=0,elapsed=0,lastDraw=-1,ctx,ready=false,viewWidth=0,viewHeight=0;

  function warm() {
    if(!preload){
      preload=Promise.all(images.map(img=>{
        if(!img.complete || !img.naturalWidth)img.src=img.dataset.src;
        if(img.decode)return img.decode();
        return img.complete && img.naturalWidth?Promise.resolve():new Promise((resolve,reject)=>{
          img.onload=resolve;img.onerror=reject;
        });
      })).then(()=>{ready=true;}).catch(()=>{preload=null;ready=false;});
    }
    return preload;
  }
  function cover() {
    const callback=session?.onCover;
    if(callback){session.onCover=null;callback();}
  }
  function close() {
    if(!session)return;
    cover();const focus=session.returnFocus;session=null;cancelAnimationFrame(frame);frame=0;
    screen.getAnimations().forEach(animation=>animation.cancel());canvas.getAnimations().forEach(animation=>animation.cancel());
    screen.style.opacity='';document.documentElement.classList.remove('film-showing');
    if(dialog.open)dialog.close();
    if(focus?.isConnected && !focus.closest('[hidden]'))focus.focus({preventScroll:true});
  }
  function resize() {
    const w=screen.clientWidth,h=screen.clientHeight;
    if(w<1||h<1)return;
    viewWidth=w;viewHeight=h;
    const ratio=Math.min(devicePixelRatio||1,2,Math.sqrt(2200000/(w*h)));
    const rw=Math.round(w*ratio),rh=Math.round(h*ratio);
    if(canvas.width!==rw||canvas.height!==rh){canvas.width=rw;canvas.height=rh;lastDraw=-1;}
    ctx.setTransform(rw/w,0,0,rh/h,0,0);
  }
  function paint() {
    const t=reduced.matches?stillTime(elapsed):elapsed;
    if(t===lastDraw)return;
    const bloom=drawDelivery(ctx,art,viewWidth,viewHeight,t);lastDraw=t;
    if(bloom){
      const rx=Math.max(22,bloom.rx),ry=Math.max(22,bloom.ry);
      flowers.style.transform='translate('+(bloom.x-rx)+'px,'+(bloom.y-ry)+'px) scale('+rx/50+','+ry/50+')';
      flowers.hidden=false;
    }
  }
  function tick(time) {
    frame=0;if(!session || document.hidden)return;
    if(last)elapsed+=(time-last)/1000;
    last=time;
    if(elapsed>=.68)cover();
    if(elapsed>=filmSeconds){close();return;}
    paint();
    if(!reduced.matches && elapsed>filmSeconds-.46)screen.style.opacity=String((filmSeconds-elapsed)/.46);
    frame=requestAnimationFrame(tick);
  }
  function start() {
    if(!session || document.hidden || frame || !session.loaded)return;
    last=0;frame=requestAnimationFrame(tick);
  }
  function play({origin,onCover,returnFocus}) {
    if(session)return;
    const current={onCover,returnFocus,loaded:false};session=current;
    flowers.hidden=true;elapsed=0;last=0;lastDraw=-1;document.documentElement.classList.add('film-showing');
    dialog.showModal();screen.focus({preventScroll:true});
    ctx??=canvas.getContext('2d');if(ctx)resize();
    if(!reduced.matches && origin?.width){
      const x=origin.left+origin.width/2,y=origin.top+origin.height/2;
      const radius=Math.hypot(Math.max(x,screen.clientWidth-x),Math.max(y,screen.clientHeight-y));
      screen.animate([{clipPath:'circle('+Math.max(13,origin.width*.4)+'px at '+x+'px '+y+'px)'},
        {clipPath:'circle('+Math.ceil(radius+3)+'px at '+x+'px '+y+'px)'}],{duration:670,easing:'cubic-bezier(.22,.64,.28,1)'});
      canvas.animate([{transform:'scale(1.04)'},{transform:'scale(1)'}],{duration:850,easing:'ease-out'});
    }
    const timer=setTimeout(()=>{if(session===current&&!current.loaded)close();},4200);
    warm().then(()=>{
      clearTimeout(timer);if(session!==current)return;
      if(!ready || !ctx){close();return;}
      current.loaded=true;resize();paint();start();
    });
  }
  flowers.addEventListener('click',playFlowerNote);
  skip.addEventListener('click',close);
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  dialog.addEventListener('close',()=>{if(session&&!dialog.open)close();});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){cancelAnimationFrame(frame);frame=0;last=0;}else start();
  });
  new ResizeObserver(()=>{if(session && ctx){resize();if(session.loaded)paint();}}).observe(screen);
  return {warm,play};
}
