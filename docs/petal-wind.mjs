// The fragment can open the experience from a friend's link or the browser's Back/Forward buttons.
export function connectPetalWind({dialog, available, onNote, onOpen, onClose, returnFocus}) {
  const canvas=dialog.querySelector('canvas'), hint=dialog.querySelector('#wind-instruction');
  const status=dialog.querySelector('#wind-error'), shapes=[...dialog.querySelectorAll('[data-shape]')];
  const pointerHint=hint.textContent;
  let resources, field, visit=0, chosen='clover', opener, owner=null, keyDown=false, keyPoint;
  let noteX=0, noteY=0, lastNote=0;

  function select(name) {
    chosen=name;
    for (const button of shapes) button.setAttribute('aria-pressed',String(button.dataset.shape===name));
    field?.change(name);
  }
  function release() {
    const id=owner;
    owner=null; keyDown=false;
    if (id!==null && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    field?.release();
  }
  function size() {
    const box=canvas.getBoundingClientRect();
    if (!field || !box.width || !box.height) return;
    field.resize(box.width,box.height);
    keyPoint={x:box.width*.5,y:box.height*.475};
  }
  const observer=new ResizeObserver(size);
  async function open() {
    if (dialog.open || !available()) return;
    const current=++visit;
    onOpen();
    dialog.showModal();
    canvas.focus({preventScroll:true});
    canvas.setAttribute('aria-busy','true');
    status.hidden=true; hint.textContent=pointerHint;
    const slow=setTimeout(()=>{
      if (dialog.open && !field) { status.textContent='Gathering petals…'; status.hidden=false; }
    },450);
    try {
      resources??=Promise.all([import('./petal-portraits.mjs'),import('./petal-field.mjs')])
        .then(async ([art,physics])=>{
          const compact=matchMedia('(pointer: coarse)').matches || innerWidth<650;
          const portraits=await art.makePortraits(dialog.querySelector('#wind-clover'),document.querySelector('[data-frame="pov-tulips"]'),compact?3700:6500);
          return {portraits,create:physics.createPetalField};
        }).catch(error=>{resources=null; throw error;});
      const {portraits,create}=await resources;
      if (!dialog.open || current!==visit) return;
      field=create(canvas,portraits,matchMedia('(prefers-reduced-motion: reduce)').matches);
      size(); select(chosen);
      observer.observe(canvas); status.hidden=true;
    } catch {
      if (dialog.open && current===visit) {
        status.textContent='The petals couldn’t load. Reopen Petal wind to try again.';
        status.hidden=false;
      }
    } finally {
      clearTimeout(slow);
      if (current===visit) canvas.setAttribute('aria-busy','false');
    }
  }
  function cleanUp() {
    visit++; release(); observer.disconnect(); field?.dispose(); field=null;
    onClose();
    const target=opener?.getClientRects().length?opener:returnFocus();
    target?.focus({preventScroll:true}); opener=null;
  }
  function sync() {
    if (location.hash==='#petals' && available()) open();
    else if (dialog.open) { dialog.close(); cleanUp(); }
  }
  function leave() {
    if (history.state?.petalWind) history.back();
    else {
      const url=new URL(location.href); url.hash='';
      history.replaceState(history.state,'',url);
      sync();
    }
  }
  for (const button of document.querySelectorAll('[data-open-petals]')) button.addEventListener('click',()=>{
    if (!available()) return;
    opener=button;
    if (location.hash!=='#petals') history.pushState({...history.state,petalWind:true},'','#petals');
    sync();
  });
  window.addEventListener('popstate',sync);
  window.addEventListener('hashchange',sync);
  dialog.querySelector('#leave-wind').addEventListener('click',leave);
  dialog.addEventListener('cancel',e=>{e.preventDefault(); leave();});
  for (const button of shapes) button.addEventListener('click',()=>select(button.dataset.shape));

  function note(x,y) {
    onNote(); lastNote=performance.now(); noteX=x; noteY=y;
  }
  canvas.addEventListener('pointerdown',e=>{
    if (!field || owner!==null || e.button!==0) return;
    e.preventDefault(); canvas.focus({preventScroll:true}); delete canvas.dataset.keyboard; hint.textContent=pointerHint;
    owner=e.pointerId; canvas.setPointerCapture(owner);
    field.point(e.offsetX,e.offsetY,true,true); note(e.offsetX,e.offsetY);
  });
  canvas.addEventListener('pointermove',e=>{
    if (!field || (owner!==null && e.pointerId!==owner) || (owner===null && e.pointerType==='touch')) return;
    const x=e.offsetX, y=e.offsetY, down=owner!==null;
    field.point(x,y,down);
    if (down && performance.now()-lastNote>230 && Math.hypot(x-noteX,y-noteY)>58) note(x,y);
  });
  for (const event of ['pointerup','pointercancel','lostpointercapture']) {
    canvas.addEventListener(event,e=>{if (owner===e.pointerId) release();});
  }
  canvas.addEventListener('pointerleave',()=>{if (owner===null && !keyDown) field?.release();});
  canvas.addEventListener('keydown',e=>{
    if (!field || !keyPoint || owner!==null) return;
    canvas.dataset.keyboard='';
    const step=e.shiftKey?53:24, {width,height}=canvas.getBoundingClientRect();
    switch (e.key) {
      case 'ArrowLeft': keyPoint.x-=step; break;
      case 'ArrowRight': keyPoint.x+=step; break;
      case 'ArrowUp': keyPoint.y-=step; break;
      case 'ArrowDown': keyPoint.y+=step; break;
      case ' ': case 'Enter':
        e.preventDefault();
        if (!keyDown) {
          keyDown=true; field.point(keyPoint.x,keyPoint.y,true,true,true); note(keyPoint.x,keyPoint.y);
        }
        return;
      default: return;
    }
    e.preventDefault();
    keyPoint.x=Math.max(10,Math.min(width-10,keyPoint.x)); keyPoint.y=Math.max(10,Math.min(height-10,keyPoint.y));
    hint.textContent='Arrow keys move the wind. Space releases petals.';
    field.point(keyPoint.x,keyPoint.y,keyDown,false,true);
  });
  canvas.addEventListener('keyup',e=>{if (keyDown && (e.key===' ' || e.key==='Enter')) release();});
  canvas.addEventListener('blur',release);
  window.addEventListener('blur',release);
  document.addEventListener('visibilitychange',()=>{
    if (document.hidden) release();
    field?.setActive(!document.hidden);
  });
  return sync;
}
