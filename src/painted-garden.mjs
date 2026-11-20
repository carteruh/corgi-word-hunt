import {Vector3} from 'three';
import {varieties} from './models.mjs';

// Paint the same editable flower positions when a browser has no WebGL context.
export function paintedRenderer() {
  const canvas=document.createElement('canvas'), ctx=canvas.getContext('2d');
  let width=0,height=0;
  const pos=new Vector3();
  function project(x,y,z,camera) {
    pos.set(x,y,z).project(camera);
    return [(pos.x+1)*width/2,(1-pos.y)*height/2,pos.z];
  }
  function leaf(x,y,dx,dy) {
    ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+dx*.18,y+dy,x+dx,y+dy);ctx.quadraticCurveTo(x+dx*.82,y+dy*.15,x,y);ctx.fill();
  }
  return {
    domElement:canvas,
    setSize(w,h){width=w;height=h;const ratio=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);},
    render(scene,camera) {
      ctx.clearRect(0,0,width,height);camera.updateMatrixWorld();
      const flowers=scene.getObjectByName('flowers');
      for(const {flower,foot} of (flowers?.children??[]).map(flower=>({flower,foot:project(flower.position.x,0,flower.position.z,camera)})).sort((a,b)=>b.foot[2]-a.foot[2])){
        const {x,z,kind}=flower.userData.record,top=project(x,flower.scale.x*1.12,z,camera),h=foot[1]-top[1],r=h*.30;
        if(r<.15) continue;
        ctx.strokeStyle='#46633b';ctx.lineWidth=Math.max(1,h*.034);ctx.beginPath();ctx.moveTo(foot[0],foot[1]);ctx.lineTo(top[0],top[1]);ctx.stroke();
        ctx.fillStyle='#496d44';leaf(foot[0],foot[1]-h*.3,h*.23,-h*.22);leaf(foot[0],foot[1]-h*.48,-h*.27,-h*.25);
        ctx.save();ctx.translate(top[0],top[1]);ctx.scale(1,.67);ctx.rotate(flower.rotation.y*.18);
        const [color,n]=varieties[kind];ctx.fillStyle=color;
        for(let i=0;i<n;i++){ctx.rotate(2*Math.PI/n);ctx.beginPath();ctx.ellipse(0,-r*.57,r*.31,r*.58,0,0,Math.PI*2);ctx.fill();}
        ctx.fillStyle='#f1bf52';ctx.beginPath();ctx.arc(0,0,r*.24,0,Math.PI*2);ctx.fill();ctx.restore();
      }
    }
  };
}
