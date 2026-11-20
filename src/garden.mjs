import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { paintedRenderer } from './painted-garden.mjs';
import { flowerModel, meadowGrass, varieties } from './models.mjs';

const groundY = .01;
function seeded(seed) {
  return () => { seed = (Math.imul(1664525,seed) + 1013904223) >>> 0; return seed / 4294967296; };
}
function validFlower(f) {
  return f && ['x','z','yaw','size'].every(k => Number.isFinite(f[k])) &&
    Math.abs(f.x) <= 30 && Math.abs(f.z) <= 30 && f.size >= .28 && f.size <= 1.95 &&
    Number.isInteger(f.kind) && f.kind >= 0 && f.kind < varieties.length;
}
export function createGarden({host, seed, words, saved, onChange, onPlant, phraseTiming, phraseTime, onNotice}) {
  const maximum = Math.max(180, (saved?.length||0) + words.length);
  const scene = new T.Scene();
  const camera = new T.OrthographicCamera(-4,4,2.3,-2.3,.05,75);
  const random = seeded((seed ^ 0x58a31) >>> 0);
  let renderer;
  try {
    renderer = new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    renderer.setClearColor(0x000000,0);
  } catch {
    renderer = paintedRenderer();
  }
  const surface = renderer.domElement;
  surface.setAttribute('aria-hidden','true');
  host.replaceChildren(surface);
  camera.position.set(0,5.3,10);
  const controls = new OrbitControls(camera,surface);
  controls.target.set(0,.44,0);
  controls.enablePan=false;
  controls.minZoom=.75; controls.maxZoom=2.4;
  controls.minPolarAngle=.38; controls.maxPolarAngle=1.23;
  controls.mouseButtons.LEFT=null; controls.mouseButtons.RIGHT=T.MOUSE.ROTATE;
  controls.touches.ONE=null; controls.touches.TWO=T.TOUCH.DOLLY_ROTATE;
  controls.update();
  const ambient = new T.HemisphereLight('#fff0dd','#a5b2ad',1.65);
  const sun = new T.DirectionalLight('#ffdfbc',2.05);
  sun.position.set(-3,6,4);
  const rim = new T.DirectionalLight('#a4bed9',.68);
  rim.position.set(3,4,-3);
  scene.add(ambient,sun,rim);
  const mat = new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide});
  const geometries = [];
  function own(geo){ geometries.push(geo); return geo; }
  if(renderer.isWebGLRenderer) scene.add(new T.Mesh(own(meadowGrass(seeded(seed ^ 2048))),mat));
  const shadowGeometry=own(new T.CircleGeometry(1,18));
  const shadowMaterial = new T.MeshBasicMaterial({color:'#627958',transparent:true,opacity:.34,depthWrite:false});
  function shadow(x,z,width,depth) {
    const s=new T.Mesh(shadowGeometry,shadowMaterial);
    s.rotation.x=-Math.PI/2; s.scale.set(width,depth,1);
    s.position.set(x,groundY+.003,z); scene.add(s); return s;
  }
  const templates = new Map();
  const flowers = new T.Group(); flowers.name='flowers'; scene.add(flowers);
  const bed = [], growing = new Map();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let mode='plant', frame=0, disposed=false;
  function render(t) {
    frame=0;
    if(disposed) return;
    for(const [mesh,born] of growing) {
      const elapsed=Math.max(0, Math.min(1,(t-born)/540));
      mesh.scale.setScalar(mesh.userData.record.size * (.012+.988*(1-Math.pow(1-elapsed,3))));
      if(elapsed===1) growing.delete(mesh);
    }
    renderer.render(scene,camera);
    if(growing.size) requestDraw();
  }
  function requestDraw(){ if(!disposed && !frame) frame=requestAnimationFrame(render); }
  function resize(){
    const {width,height}=host.getBoundingClientRect();
    if(!width || !height) return;
    const aspect=width/height, half=Math.max(2.40,1.95/aspect);
    camera.left=-half*aspect; camera.right=half*aspect; camera.top=half; camera.bottom=-half;
    camera.updateProjectionMatrix(); renderer.setSize(width,height); requestDraw();
  }
  function add(record, delay=null) {
    if(!templates.has(record.kind)) templates.set(record.kind,own(flowerModel(record.kind)));
    const mesh=new T.Mesh(templates.get(record.kind),mat);
    mesh.position.set(record.x,groundY,record.z); mesh.rotation.y=record.yaw;
    mesh.scale.setScalar(reduced || delay===null ? record.size : .01);
    mesh.userData.record=record;
    mesh.userData.shadow=shadow(record.x+.05,record.z,.17*record.size,.085*record.size);
    bed.push(record); flowers.add(mesh);
    if(!reduced && delay!==null) growing.set(mesh,performance.now()+delay);
    requestDraw();
  }
  function record(x,z,kind,size=.87+random()*.28) {
    return {x,z,kind,size,yaw:(random()-.5)*1.8};
  }
  if(Array.isArray(saved)) {
    saved.filter(validFlower).slice(0,maximum).forEach(f=>add({...f}));
  } else {
    // Low clusters leave paths through the meadow and keep the cottage in view.
    for (const [cx,cz,count] of [[-5,2,8],[-3.1,3.1,7],[-1.4,.35,5],[.45,3.1,6],[2.8,.22,7],[4.6,2.6,7],[6,.1,4],[-4.1,-1.6,5],[1.1,-1.4,4]]) {
      for(let i=0;i<count;i++){
        const x=cx+(random()-.5)*1.65,z=cz+(random()-.5)*1.14;
        const kind=Math.floor(random()*varieties.length);
        add(record(x,z,kind,.35+random()*.34+Math.max(0,z)*.059));
      }
    }
  }
  // Space earned blooms across the center of both portrait and landscape views.
  for(const [i,word] of words.entries()){
    const hash=[...word].reduce((h,c)=>Math.imul(h,31)+c.charCodeAt(0)|0,seed);
    const a=2.39996*i+(hash>>>0)%9, radius=Math.sqrt((i+.4)/words.length);
    const x=Math.cos(a)*1.63*radius,z=.95+Math.sin(a)*1.48*radius;
    add(record(x,z,(hash>>>0)%varieties.length,.72+Math.min(.45,word.length*.045)),Math.min(i*60,650));
  }
  const publish=()=>onChange(bed.map(f=>({...f})));
  const ray = new T.Raycaster(), plane=new T.Plane(new T.Vector3(0,1,0),-groundY);
  function groundAt(x,y) {
    const rect=surface.getBoundingClientRect();
    ray.setFromCamera(new T.Vector2((x-rect.left)*2/rect.width-1,1-(y-rect.top)*2/rect.height),camera);
    const p=ray.ray.intersectPlane(plane,new T.Vector3());
    if(!p || Math.abs(p.x)>30 || Math.abs(p.z)>30) return null;
    return p;
  }
  let lastPlantAt=-Infinity;
  function plant(x,z) {
    if(bed.length>=maximum){onNotice('The bed is full. Cut a flower to make room.');return false;}
    const kind=Math.floor(random()*varieties.length);
    add(record(x,z,kind),0); lastPlantAt=performance.now(); publish(); onPlant();
    return true;
  }
  let trail=null,phraseTimer=0;
  function stopTrail() {
    clearTimeout(phraseTimer);phraseTimer=0;trail=null;
  }
  function extendTrail(point) {
    if(!trail || !point)return;
    const last=trail.path.at(-1);
    const distance=point.distanceTo(last.point);
    if(distance>.025)trail.path.push({point,distance:last.distance+distance});
  }
  function startTrail(first,second) {
    stopTrail();
    const delays=phraseTiming(), path=[{point:first,distance:0}];
    trail={path};extendTrail(second);
    let beat=0,segment=0,due=null;
    function bloom() {
      const wait=due===null?0:due-phraseTime();
      if(wait>8){phraseTimer=setTimeout(bloom,wait);return;}
      const distance=path.at(-1).distance*beat/(delays.length-1);
      while(segment+1<path.length && path[segment+1].distance<distance)segment++;
      const a=path[segment],b=path[segment+1]||a;
      const part=b===a?0:(distance-a.distance)/(b.distance-a.distance);
      const x=a.point.x+(b.point.x-a.point.x)*part,z=a.point.z+(b.point.z-a.point.z)*part;
      if(!plant(x,z) || beat===delays.length-1){stopTrail();return;}
      const now=phraseTime();
      due=Math.max(due??now,now-40)+delays[beat++];
      phraseTimer=setTimeout(bloom,Math.max(0,due-now));
    }
    bloom();
  }
  function change(mesh) {
    if(!mesh) return;
    const f=mesh.userData.record;
    if(mode==='cut') {
      bed.splice(bed.indexOf(f),1); scene.remove(mesh.userData.shadow); flowers.remove(mesh); growing.delete(mesh);
    } else {
      f.size=Math.max(.5,Math.min(1.95,f.size*(mode==='grow'?1.24:1/1.24)));
      growing.delete(mesh); mesh.scale.setScalar(f.size);
      mesh.userData.shadow.scale.set(.17*f.size,.085*f.size,1);
    }
    publish(); requestDraw();
  }
  function apply(x,y,drag=false) {
    const p=groundAt(x,y);
    if(mode==='plant') {
      if(!p) { if(!drag) onNotice('Tap the meadow to plant.'); return false; }
      return plant(p.x,p.z);
    }
    const hit=ray.intersectObjects(flowers.children,false)[0]?.object;
    let closest=hit;
    if(!closest && p){
      let distance=.50;
      for(const mesh of flowers.children){
        const d=Math.hypot(p.x-mesh.position.x,p.z-mesh.position.z);
        if(d<distance){closest=mesh;distance=d;}
      }
    }
    if(closest && (!drag || !gesture?.visited.has(closest))) {
      change(closest); gesture?.visited.add(closest); return true;
    }
    if(!drag && !closest) onNotice('Tap a flower to use this brush.');
    return false;
  }
  const touches=new Set();
  let gesture=null;
  const abort=new AbortController(), opts={signal:abort.signal};
  function cancelGesture(){gesture=null;stopTrail();}
  document.addEventListener('pointerdown',e=>{if(!host.contains(e.target))cancelGesture();},{...opts,capture:true});
  document.addEventListener('focusin',e=>{if(!host.contains(e.target))cancelGesture();},opts);
  window.addEventListener('blur',()=>{touches.clear();cancelGesture();},opts);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){touches.clear();cancelGesture();}},opts);
  surface.addEventListener('pointerdown',e=>{
    cancelGesture();
    if(e.pointerType==='touch') touches.add(e.pointerId);
    if(touches.size>1 || e.button!==0)return;
    gesture={id:e.pointerId,x:e.clientX,y:e.clientY,drag:false,played:false,visited:new Set()};
    surface.setPointerCapture(e.pointerId);
  },opts);
  function dragTo(x,y) {
    if(!gesture.drag && Math.hypot(x-gesture.x,y-gesture.y)<9)return;
    gesture.drag=true;
    if(mode!=='plant'){apply(x,y,true);return;}
    const point=groundAt(x,y);
    if(!point)return;
    if(gesture.played){extendTrail(point);return;}
    gesture.played=true;startTrail(groundAt(gesture.x,gesture.y)||point,point);
  }
  surface.addEventListener('pointermove',e=>{
    if(gesture?.id===e.pointerId && touches.size<2)dragTo(e.clientX,e.clientY);
  },opts);
  surface.addEventListener('pointerup',e=>{
    touches.delete(e.pointerId);
    if(gesture?.id!==e.pointerId)return;
    dragTo(e.clientX,e.clientY);
    if(!gesture.drag)apply(e.clientX,e.clientY);
    gesture=null;
  },opts);
  function cancelPointer(e){touches.delete(e.pointerId);if(gesture?.id===e.pointerId)cancelGesture();}
  surface.addEventListener('pointercancel',cancelPointer,opts);
  surface.addEventListener('lostpointercapture',cancelPointer,opts);
  host.addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===' '){
      e.preventDefault();
      if(mode==='plant'){
        if(e.shiftKey && e.key==='Enter'){
          if(!e.repeat)startTrail(new T.Vector3(-1.3,groundY,.92),new T.Vector3(1.3,groundY,.58));
          return;
        }
        if(e.repeat && performance.now()-lastPlantAt<95)return;
        stopTrail();const a=random()*6.28,r=Math.sqrt(random())*.91;plant(2.7*r*Math.cos(a),1.58*r*Math.sin(a));
      }
      else change(flowers.children.at(-1));
    } else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){
      e.preventDefault(); const offset=camera.position.clone().sub(controls.target);
      offset.applyAxisAngle(new T.Vector3(0,1,0),e.key==='ArrowLeft'?-.22:.22);
      camera.position.copy(controls.target).add(offset); controls.update(); requestDraw();
    } else if(e.key==='+'||e.key==='='||e.key==='-'){
      e.preventDefault();camera.zoom=Math.max(.75,Math.min(2.4,camera.zoom*(e.key==='-'?.86:1.16)));
      camera.updateProjectionMatrix();requestDraw();
    }
  },opts);
  controls.addEventListener('change',requestDraw);
  const observer=new ResizeObserver(resize); observer.observe(host); resize(); publish();
  return {
    setMode(next){cancelGesture();mode=next;},
    stopTrail,
    dispose(){
      disposed=true;cancelGesture();abort.abort();observer.disconnect();controls.dispose();cancelAnimationFrame(frame);
      for(const g of geometries)g.dispose();mat.dispose();shadowMaterial.dispose();renderer.dispose?.();
      renderer.forceContextLoss?.();surface.remove();
    },
  };
}
