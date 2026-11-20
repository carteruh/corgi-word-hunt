import {drawClover} from './cinematic-clover.mjs';
import {drawBouquet} from './tulips.mjs';

export const filmSeconds=11.2;
const mix=(a,b,p)=>a+(b-a)*p;
function ease(a,b,t) {
  const p=Math.max(0,Math.min(1,(t-a)/(b-a)));
  return p*p*(3-2*p);
}

function meadow(ctx, image, w, h, near, recoil, t) {
  const scale=Math.max(w/image.naturalWidth,h/image.naturalHeight)*(1.035+.048*near-.013*recoil);
  const width=image.naturalWidth*scale, height=image.naturalHeight*scale;
  const x=(w-width)*(.48+.035*near)+w*.002*Math.sin(t*.72);
  const y=(h-height)*.51+h*(.006*near+.008*recoil);
  ctx.drawImage(image,x,y,width,height);
}

function shadow(ctx,x,y,size) {
  ctx.save();ctx.translate(x,y);ctx.scale(size,size*.15);
  const ink=ctx.createRadialGradient(0,0,0,0,0,1);
  ink.addColorStop(0,'rgba(63,44,23,.48)');ink.addColorStop(.5,'rgba(73,62,34,.28)');ink.addColorStop(1,'rgba(70,64,37,0)');
  ctx.fillStyle=ink;ctx.fillRect(-1,-1,2,2);ctx.restore();
}

function pollen(ctx,w,h,t) {
  ctx.save();ctx.fillStyle='#fff6c3';
  for(let i=0;i<11;i++) {
    const x=(((.137+i*.276+t*.009)%1.1)-.04)*w;
    const y=(.26+(i*.348%1)*.58+Math.sin(t*.8+i*2)*.012)*h;
    ctx.globalAlpha=.18+.25*(1+Math.sin(i*1.84+t));
    ctx.beginPath();ctx.ellipse(x,y,Math.max(1,w*.00145),Math.max(.65,w*.0009),-.65,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}

export function drawDelivery(ctx, art, w, h, t) {
  if(w<=0 || h<=0)return;
  const stride=t*9.4+.36*Math.sin(t*1.9);
  const journey=ease(.25,4.58,t);
  const depth=.45*journey+.55*((1/(4-3*journey)-.25)/.75);
  const nudge=ease(5.35,6.93,t)*(1-ease(7.3,8.28,t));
  const received=ease(6.78,7.77,t), settle=ease(7.73,9.45,t);
  const happy=ease(7.14,7.90,t);
  const energy=(.32+.68*ease(.08,.75,t))*(1-ease(3.65,4.75,t));
  const contact=ease(6.89,7.65,t)*(1-ease(7.66,8.78,t));
  const portrait=ease(.77,1.6,h/w);
  const closeSize=Math.min(h*.75,w*.96);
  const height=closeSize*mix(.19,1,depth)*(1+.115*nudge-.135*settle);
  const dogX=w*(.452+.050*depth-.035*settle)+(.8*Math.sin(stride)*energy+Math.sin(t*1.9)*.25)*height/100;
  const dogY=h*mix(.565,mix(.887,.759,portrait),depth)+height*(.025*nudge-.012*settle);
  meadow(ctx,art['pov-meadow'],w,h,depth,contact,t);pollen(ctx,w,h,t);
  shadow(ctx,dogX+height*.02,dogY-height*.007,height*.44);

  const tilt=-.115*ease(4.12,4.93,t)*(1-ease(5.42,6.20,t))+.11*settle;
  ctx.save();ctx.translate(dogX,dogY);ctx.scale(height/100,height/100);
  const grip=drawClover(ctx,art,{time:t,gait:stride,energy,offer:nudge,happy,tilt});
  ctx.restore();

  // First the ribbon is in Clover’s teeth. As she lets go, its pivot moves into
  // the viewer’s space while she stays on the path behind the flowers.
  const mouthX=dogX+grip.x*height/100, mouthY=dogY+grip.y*height/100;
  const lensScale=Math.min(w*.020,h*.025);
  const handScale=Math.min(w*.0077,h*.0071);
  const bear=height*.00455;
  const reach=ease(5.59,7.64,t);
  let scale=mix(bear,lensScale,reach*reach);
  scale=mix(scale,handScale,settle);
  let x=mix(mouthX,w*.575,received), y=mix(mouthY,h*.665,received);
  x=mix(x,w*mix(.754,.747,portrait)+Math.sin(t*1.47)*w*.003,settle);
  y=mix(y,h*mix(1.055,.95,portrait)+Math.sin(t*1.87)*h*.003,settle);
  const carryAngle=1.68+.055*Math.sin(stride-.62)*energy-.035*ease(4,5,t);
  let angle=mix(carryAngle,.20,reach);angle=mix(angle,-.19,settle);
  let pitch=mix(.16+.045*Math.sin(stride-.24)*energy,1.26,reach);
  pitch=mix(pitch,.53+.038*Math.sin(t*1.6),settle);
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(scale,scale);
  const blooms=drawBouquet(ctx,art['pov-tulips'],pitch,t,energy*.90+contact*.45+.2);
  ctx.restore();
  const cos=Math.cos(angle),sin=Math.sin(angle);
  return {
    x:x+scale*(blooms.cx*cos-blooms.cy*sin),y:y+scale*(blooms.cx*sin+blooms.cy*cos),
    rx:scale*Math.hypot(blooms.rx*cos,blooms.ry*sin),ry:scale*Math.hypot(blooms.rx*sin,blooms.ry*cos),
  };
}
