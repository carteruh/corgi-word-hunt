import {petalStamps,stampSize,turns} from './petal-portraits.mjs';
import {petalRaster} from './petal-raster.mjs';

const tau=Math.PI*2;
const driftColors=[38,39,40,41,9,18,36];
const trailColors=[8,12,18,21,22,23,25,26,27,30,31,40];
const pick=list=>list[Math.floor(Math.random()*list.length)];

export function createPetalField(canvas, portraits, reduced) {
  // Thousands of tiny alpha stamps share a CPU surface and reach the compositor as one layer.
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const sheet=petalStamps();
  const count=portraits.clover.length;
  const particles=Array.from({length:count},()=>({
    x:0,y:0,vx:0,vy:0, weight:.77+Math.random()*.48, angle:Math.floor(Math.random()*turns),
    changeAt:Math.random()*.42, key:Math.random(),
  }));
  // Two loose currents of garden dust make the breeze visible in the open meadow, too.
  const dust=Array.from({length:Math.round(count/12)},(_,i)=>{
    const x=Math.random(), band=i%3;
    const y=band===0 ? Math.random() : .61+.14*Math.sin(x*7+band*2)+(Math.random()-.5)*.16;
    return {u:x, v:y,x:0,y:0,vx:0,vy:0, weight:.6+Math.random()*1.25,angle:i%turns,color:pick(driftColors)};
  });
  let raster, flights=[], shape='clover', previous=shape, morph=1, width=0,height=0,span=0,midX=0,midY=0;
  let brush=null, pulse=null, frame=0, last=0, awakeUntil=0, nextEmission=0, active=true;

  function stamp(x,y,size,color,angle) {
    ctx.drawImage(sheet,angle*stampSize,color*stampSize,stampSize,stampSize,x-size/2,y-size/2,size,size);
  }
  function wake(seconds=1.65) {
    awakeUntil=Math.max(awakeUntil,performance.now()+seconds*1000);
    if (active && !frame && !document.hidden) frame=requestAnimationFrame(draw);
  }
  function resize(w,h,cx,cy,size) {
    if (width===w && height===h && midX===cx && midY===cy && span===size) return;
    width=w; height=h; midX=cx; midY=cy; span=size;
    const dpr=Math.min(1.5,window.devicePixelRatio||1);
    canvas.width=Math.round(w*dpr); canvas.height=Math.round(h*dpr);
    ctx.setTransform(canvas.width/w,0,0,canvas.height/h,0,0);
    raster=petalRaster(ctx,sheet,canvas.width,canvas.height,dpr);
    for (let i=0;i<count;i++) {
      const p=particles[i], target=portraits[shape][i];
      p.x=midX+target.x*span; p.y=midY+target.y*span;
      p.vx=p.vy=0;
      for (const [name,points] of Object.entries(portraits)) {
        const t=points[i], dot=span/Math.sqrt(count)*(t.fine?1.05:1.93)*p.weight;
        p[name]=raster.dab(dot,t.color,p.angle);
      }
    }
    for (const p of dust) {
      p.x=p.u*w; p.y=p.v*h; p.vx=p.vy=0;
      p.dab=raster.dab((w<620?2.7:3.4)*p.weight,p.color,p.angle,.48);
    }
    flights=[]; brush=null; pulse=null; last=0;
    wake(0);
  }
  function change(next) {
    if (next===shape) return;
    previous=shape; shape=next; morph=0;
    if (reduced) {
      previous=shape;
      for (let i=0;i<count;i++) {
        const p=particles[i], t=portraits[shape][i];
        p.x=midX+t.x*span; p.y=midY+t.y*span; p.vx=p.vy=0;
      }
    } else {
      for (const p of particles) {
        const kick=span*.52*(p.key-.5);
        p.vx+=kick; p.vy-=Math.abs(kick)*.3;
      }
    }
    wake(2.1);
  }
  function emit(x,y,n,dx=0,dy=0) {
    const limit=reduced?45:170;
    for (let i=0;i<n && flights.length<limit;i++) {
      const angle=Math.random()*tau, speed=(reduced?17:46)*(1+Math.random()*2.4);
      const life=(reduced?.65:1.25)+Math.random()*.6;
      flights.push({
        x:x+Math.cos(angle)*4, y:y+Math.sin(angle)*4,
        vx:Math.cos(angle)*speed+dx*.22, vy:Math.sin(angle)*speed-26+dy*.22,
        age:0, life, size:(reduced?4:7)+Math.random()*7, spin:Math.random()-.5,
        turn:Math.random()*turns, phase:Math.random()*tau, color:pick(trailColors),
      });
    }
    wake(2.3);
  }
  function point(x,y,down=false,kick=false,keyboard=false) {
    const old=brush, now=performance.now(), same=old && old.keyboard===keyboard;
    brush={x,y,down,keyboard,at:now,fromX:same?old.fromX:x,fromY:same?old.fromY:y};
    if (kick) {
      pulse={x,y}; nextEmission=0;
      emit(x,y,reduced?5:20);
    } else if (down && same) {
      const dx=x-old.x, dy=y-old.y, length=Math.hypot(dx,dy);
      if (length>1) {
        const steps=Math.min(10,Math.ceil(length/(reduced?24:11)));
        for (let i=1;i<=steps;i++) emit(old.x+dx*i/steps,old.y+dy*i/steps,1,Math.max(-100,Math.min(100,dx)),Math.max(-100,Math.min(100,dy)));
      }
    }
    wake(2.1);
  }
  function release() {
    if (brush?.keyboard) { brush.down=false; brush.at=0; }
    else brush=null;
    wake(2.1);
  }
  function reset() {
    brush=null; pulse=null; last=0; flights=[];
    cancelAnimationFrame(frame); frame=0;
  }
  function setActive(on) {
    active=on;
    if (!on) reset();
    else wake();
  }

  function draw(now) {
    frame=0;
    if (!active || document.hidden) return;
    const elapsed=last?Math.max(0,(now-last)/1000):1/60;
    const dt=Math.min(elapsed,.25), forceStep=Math.min(elapsed,.05);
    last=now; morph+=elapsed;
    const spring=reduced?11:7.8, damping=Math.exp(-spring*elapsed);
    const radius=Math.max(54,Math.min(143,span*.30))*(reduced?.72:1);
    const finger=brush && (brush.down || now-brush.at<140) ? brush : null;
    const dx=finger?finger.x-finger.fromX:0, dy=finger?finger.y-finger.fromY:0, travel=dx*dx+dy*dy;
    const gust=reduced?1350:(finger?.down?5000:3400);
    raster.clear();

    function move(p,tx,ty) {
      if (finger) {
        // Distance to the entire stroke since the last frame keeps even fast flicks continuous.
        const along=travel?Math.max(0,Math.min(1,((p.x-finger.fromX)*dx+(p.y-finger.fromY)*dy)/travel)):0;
        const rx=p.x-finger.fromX-dx*along, ry=p.y-finger.fromY-dy*along, rr=rx*rx+ry*ry;
        if (rr<radius*radius) {
          const distance=Math.sqrt(rr), force=(1-distance/radius)**1.6*gust/Math.max(1,distance);
          p.vx+=(rx-ry*.24)*force*forceStep; p.vy+=(ry+rx*.24)*force*forceStep;
        }
      }
      if (pulse) {
        const rx=p.x-pulse.x, ry=p.y-pulse.y, distance=Math.hypot(rx,ry);
        if (distance<radius*1.25) {
          const push=(1-distance/(radius*1.25))*(reduced?92:450)/Math.max(distance,1);
          p.vx+=(rx-ry*.18)*push; p.vy+=(ry+rx*.18)*push;
        }
      }
      // Closed-form critically damped spring also catches up after a missed frame.
      const ex=p.x-tx, ey=p.y-ty, jx=p.vx+spring*ex, jy=p.vy+spring*ey;
      p.x=tx+(ex+jx*elapsed)*damping; p.y=ty+(ey+jy*elapsed)*damping;
      p.vx=(p.vx-spring*jx*elapsed)*damping; p.vy=(p.vy-spring*jy*elapsed)*damping;
    }
    for (const p of dust) {
      move(p,width*p.u,height*p.v);
      raster.stamp(p.x,p.y,p.dab);
    }
    const target=portraits[shape];
    for (let i=0;i<count;i++) {
      const p=particles[i], t=target[i];
      move(p,midX+t.x*span,midY+t.y*span);
      raster.stamp(p.x,p.y,p[morph<p.changeAt?previous:shape]);
    }
    raster.paint();
    pulse=null;
    if (brush) { brush.fromX=brush.x; brush.fromY=brush.y; }
    if (brush?.down) {
      nextEmission-=dt;
      if (nextEmission<=0) { emit(brush.x,brush.y,reduced?1:2); nextEmission=reduced?.16:.07; }
    }
    for (let i=flights.length-1;i>=0;i--) {
      const f=flights[i]; f.age+=elapsed;
      if (f.age>=f.life) { flights.splice(i,1); continue; }
      f.vx+=(Math.sin(f.age*3.7+f.phase)*(reduced?8:32)+13-f.vx*.97)*dt;
      f.vy+=(26-f.vy*.87)*dt; f.x+=f.vx*dt; f.y+=f.vy*dt;
      ctx.globalAlpha=Math.min(1,(f.life-f.age)*2.7);
      const turn=(Math.floor(f.turn+f.spin*f.age*14)%turns+turns)%turns;
      stamp(f.x,f.y,f.size*(.85+.15*Math.cos(f.age*6+f.phase)),f.color,turn);
    }
    ctx.globalAlpha=1;
    if (brush?.keyboard) {
      ctx.strokeStyle='#ffe5abab'; ctx.lineWidth=1.5;
      ctx.beginPath();ctx.arc(brush.x,brush.y,14,0,tau);ctx.stroke();
    }
    if (brush?.down || flights.length || now<awakeUntil) {
      if (!frame) frame=requestAnimationFrame(draw);
    } else last=0;
  }

  return {resize,change,point,release,setActive,dispose:()=>setActive(false)};
}
