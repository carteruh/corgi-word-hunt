// Each stalk has its own depth and bend. The bouquet pivots around its ribbon.
const stalks = [
  {x:-21, up:68, z:-16, size:26, color:2, bend:-.23},
  {x:4,   up:78, z:-13, size:29, color:1, bend:.10},
  {x:31,  up:61, z:-6,  size:30, color:0, bend:.39},
  {x:-35, up:52, z:2,   size:32, color:1, bend:-.50},
  {x:13,  up:50, z:8,   size:34, color:2, bend:.25},
  {x:-8,  up:60, z:18,  size:37, color:0, bend:-.12},
  {x:24,  up:49, z:22,  size:26, color:1, bend:.27},
];

function blade(ctx, x, y, tipX, tipY, width, light) {
  const dx=tipX-x, dy=tipY-y, length=Math.hypot(dx,dy)||1;
  const nx=-dy/length*width, ny=dx/length*width;
  const midX=x+dx*.48, midY=y+dy*.48;
  ctx.beginPath(); ctx.moveTo(x,y);
  ctx.quadraticCurveTo(midX+nx, midY+ny, tipX, tipY);
  ctx.quadraticCurveTo(midX-nx*.37, midY-ny*.37, x, y);
  ctx.fillStyle=light?'#789b52':'#456f50'; ctx.fill();
  ctx.strokeStyle=light?'#557b48':'#3e6347'; ctx.lineWidth=.8; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x,y); ctx.quadraticCurveTo(midX+nx*.33,midY+ny*.33,tipX,tipY);
  ctx.strokeStyle=light?'#b2be72':'#8bab6d'; ctx.lineWidth=.8; ctx.stroke();
}

function stem(ctx, x, y, bend, index) {
  const bottomX=-x*.12+(index%3-1)*.9, bottomY=14+(index*3%7);
  ctx.beginPath(); ctx.moveTo(bottomX,bottomY); ctx.quadraticCurveTo(1.5,0,0,-2);
  ctx.quadraticCurveTo(x*.38+bend*4,y*.60,x,y);
  ctx.lineCap='round'; ctx.strokeStyle='#456346'; ctx.lineWidth=2.7; ctx.stroke();
  ctx.strokeStyle=index%2?'#91aa60':'#a8b76c'; ctx.lineWidth=1.25; ctx.stroke();
}

function ribbon(ctx, flutter) {
  ctx.beginPath(); ctx.moveTo(-1,0); ctx.bezierCurveTo(-9,8,-6+flutter,14,-15+flutter,17);
  ctx.lineTo(-11+flutter,10); ctx.lineTo(-14+flutter,10); ctx.quadraticCurveTo(-9,7,-4,-1); ctx.closePath();
  ctx.moveTo(1,1); ctx.bezierCurveTo(7,7,7-flutter,18,12-flutter,20); ctx.lineTo(12-flutter,12);
  ctx.lineTo(15-flutter,14); ctx.quadraticCurveTo(9,4,4,-1); ctx.closePath();
  ctx.fillStyle='#ad443a'; ctx.fill(); ctx.lineWidth=.65; ctx.strokeStyle='#7b3c32'; ctx.stroke();
  ctx.fillStyle='#cc6352'; ctx.beginPath(); ctx.ellipse(-.5,-.2,5.1,2.8,-.24,0,Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle='#eea07c'; ctx.beginPath(); ctx.moveTo(-3.8,-.6); ctx.lineTo(2,-1.8); ctx.stroke();
}

export function drawBouquet(ctx, atlas, pitch, t, breeze) {
  const sine=Math.sin(pitch), cosine=Math.cos(pitch);
  const heads=stalks.map((s,i)=>{
    const flick=Math.sin(t*3.7+i*.75)*breeze;
    const depth=s.up*sine+s.z*cosine, scale=1/(1-depth/239);
    return {...s, x:(s.x+flick*.95)*scale, y:(-s.up*cosine+s.z*sine+flick*.58)*scale, depth, scale};
  }).sort((a,b)=>a.depth-b.depth);
  for (const [i,head] of heads.entries()) stem(ctx,head.x,head.y,head.bend,i);
  blade(ctx,-2,0,-42,-40*cosine-4,8,true);
  blade(ctx,1,-4,42,-58*cosine+4,8,false);
  blade(ctx,-1,-5,-30,-73*cosine+3,6,false);
  blade(ctx,2,-6,26,-80*cosine-3,6,true);
  blade(ctx,0,-3,37,-31*cosine+5,6,true);
  ribbon(ctx,Math.sin(t*4.4)*(.6+breeze));
  const cell=atlas.naturalWidth/3;
  // The upper petals open into view as the bunch turns to face the lens.
  const f=Math.max(0,Math.min(1,(pitch-.46)/.65));
  const open=f*f*(3-2*f);
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for (const head of heads) {
    const size=head.size*head.scale;
    const centerY=head.y-size*.25*cosine;
    left=Math.min(left,head.x-size*.5);right=Math.max(right,head.x+size*.5);
    top=Math.min(top,centerY-size*.5);bottom=Math.max(bottom,centerY+size*.5);
    ctx.save(); ctx.translate(head.x,centerY); ctx.rotate(head.bend*(.9-.3*sine));
    if(open<1) {
      ctx.globalAlpha=1-open;
      ctx.drawImage(atlas,head.color*cell,0,cell,cell,-size/2,-size*(.49-.10*open),size,size*(1-.20*open));
    }
    if(open>0) {
      ctx.globalAlpha=open;
      const faceHeight=size*(.78+.22*open);
      ctx.drawImage(atlas,head.color*cell,cell,cell,cell,-size/2,-faceHeight/2,size,faceHeight);
    }
    ctx.restore();
  }
  return {cx:(left+right)/2,cy:(top+bottom)/2,rx:(right-left)/2,ry:(bottom-top)/2};
}
