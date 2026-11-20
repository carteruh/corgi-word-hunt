import {drawBouquet} from './tulips.mjs';

// Shape coordinates are centered and normalized to the longest painted edge.
// Sample the painted artwork itself so the eyes, bone, and individual stems move with the wind.
const edge = 320;
export const colors = [
  '#392830','#593534','#774437','#96513e','#af6747','#c98459','#e59a54','#f5af61',
  '#ffc77d','#ffd69a','#e2b791','#f6d4aa','#fff0cb','#fff4dc','#eadbc6','#c9b195',
  '#b1766b','#d17f76','#ea9a93','#f8b7a3','#9b373c','#c84946','#ef6054','#ff8371',
  '#b74f65','#dd7184','#f99caa','#ffccd0','#c88b35','#edab3e','#ffcd55','#ffe999',
  '#38534d','#4c6651','#638155','#7e9b60','#a2b873','#c6d692',
  '#588f99','#8bb8b5','#c3dfca','#fed9a2',
];
const rgb = colors.map(hex => [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)));
const cache = new Map();

function colorFor(r,g,b) {
  const key = (r >> 3) * 1024 + (g >> 3) * 32 + (b >> 3);
  if (cache.has(key)) return cache.get(key);
  let distance = Infinity, closest = 0;
  for (let i=0; i<rgb.length; i++) {
    const [pr,pg,pb] = rgb[i];
    const delta = (r-pr)**2 * .32 + (g-pg)**2 * .48 + (b-pb)**2 * .2;
    if (delta < distance) { distance=delta; closest=i; }
  }
  cache.set(key,closest);
  return closest;
}

async function readArt(image) {
  if (!image.getAttribute('src') || (image.complete && !image.naturalWidth)) image.src = image.dataset.src;
  await image.decode();
  return image;
}

function sample(draw, count, random) {
  const tile = document.createElement('canvas');
  tile.width = tile.height = edge;
  const ctx = tile.getContext('2d', {willReadFrequently:true});
  draw(ctx);
  const data = ctx.getImageData(0,0,edge,edge).data;
  let left=edge, right=0, top=edge, bottom=0, area=0;
  for (let y=0; y<edge; y++) for (let x=0; x<edge; x++) {
    if (data[(y*edge+x)*4+3] < 110) continue;
    left=Math.min(left,x); right=Math.max(right,x); top=Math.min(top,y); bottom=Math.max(bottom,y);
    area++;
  }
  if (!area) throw new Error('The petal shape has no painted pixels.');
  const step = Math.sqrt(area/(count*1.14)), span = Math.max(right-left+1,bottom-top+1);
  const cx=(left+right)/2, cy=(top+bottom)/2, samples=[];
  for (let y=top; y<=bottom; y+=step) for (let x=left; x<=right; x+=step) {
    const px=x+random()*step, py=y+random()*step;
    if (px>=edge || py>=edge) continue;
    const offset = (Math.floor(py)*edge+Math.floor(px))*4;
    if (data[offset+3]<110) continue;
    samples.push({x:(px-cx)/span, y:(py-cy)/span, color:colorFor(data[offset],data[offset+1],data[offset+2])});
  }
  // Give fine dark lines their own smaller petals. These carry Clover's eyes
  // and the outline of her bone, as well as veins and stems in the bouquet.
  const detail=[];
  const luminance=k=>data[k]*.28+data[k+1]*.57+data[k+2]*.15;
  for (let y=Math.max(2,top);y<=Math.min(edge-3,bottom);y++) for (let x=Math.max(2,left);x<=Math.min(edge-3,right);x++) {
    const k=4*(y*edge+x);
    if (data[k+3]<170 || luminance(k)>179) continue;
    if (![k-8,k+8,k-edge*8,k+edge*8].some(n=>data[n+3]>150 && luminance(n)-luminance(k)>31)) continue;
    detail.push({x:(x-cx)/span,y:(y-cy)/span,color:colorFor(data[k],data[k+1],data[k+2]),fine:true});
  }
  const choose=(list,n)=>Array.from({length:n},(_,i)=>list[Math.floor((i+random())*list.length/n)]);
  const fineCount=detail.length?Math.round(count*.18):0;
  samples.sort((a,b)=>a.y-b.y || a.x-b.x);
  return choose(samples,count-fineCount).concat(choose(detail,fineCount));
}

export async function makePortraits(cloverImage, tulipImage, count) {
  const [clover,tulips] = await Promise.all([readArt(cloverImage),readArt(tulipImage)]);
  let seed=127741;
  function random() { seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; }
  return {
    clover: sample(ctx=>{
      const fit=(edge-10)/Math.max(clover.naturalWidth,clover.naturalHeight);
      const w=clover.naturalWidth*fit, h=clover.naturalHeight*fit;
      ctx.drawImage(clover,(edge-w)/2,(edge-h)/2,w,h);
    },count,random),
    tulips: sample(ctx=>{
      ctx.translate(edge/2,258); ctx.scale(2.5,2.5);
      drawBouquet(ctx,tulips,.21,0,0);
    },count,random),
  };
}

// Prepaint a sheet of two-tone petal dabs. The renderer can turn a petal without
// saving and rotating the drawing context for each of several thousand particles.
export const stampSize=16, turns=12;
export function petalStamps() {
  const sheet=document.createElement('canvas');
  sheet.width=stampSize*turns; sheet.height=stampSize*colors.length;
  const ctx=sheet.getContext('2d');
  for (let color=0; color<colors.length; color++) for (let turn=0; turn<turns; turn++) {
    ctx.save();
    ctx.translate((turn+.5)*stampSize,(color+.5)*stampSize);
    ctx.rotate(turn*Math.PI*2/turns);
    ctx.beginPath(); ctx.moveTo(-6.8,.1);
    ctx.bezierCurveTo(-4.3,-5.4,3.8,-5.6,6.5,-1.5);
    ctx.bezierCurveTo(5.2,3.2,-1.3,5.7,-6.8,.1);
    ctx.fillStyle=colors[color]; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-4,1); ctx.quadraticCurveTo(-.3,-2.2,4.7,-2.6);
    ctx.strokeStyle='rgba(255,238,203,.34)'; ctx.lineWidth=.75; ctx.stroke();
    ctx.restore();
  }
  return sheet;
}
