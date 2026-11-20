// Blit the small, prepainted petals into a single transparent frame. A phone
// can composite the whole portrait without thousands of scaled canvas draws.
import {colors,turns} from './petal-portraits.mjs';

export function petalRaster(ctx, sheet, width, height, ratio) {
  const frame=ctx.createImageData(width,height);
  const pixels=new Uint32Array(frame.data.buffer);
  const scaled=new Map(), petals=new Map();

  function dab(cssSize,color,angle,opacity=1) {
    const side=Math.max(2,Math.round(cssSize*ratio));
    const key=((side*colors.length+color)*turns+angle)*2+Number(opacity===1);
    if (petals.has(key)) return petals.get(key);
    if (!scaled.has(side)) {
      const atlas=document.createElement('canvas');
      atlas.width=side*turns; atlas.height=side*colors.length;
      const brush=atlas.getContext('2d',{willReadFrequently:true});
      brush.drawImage(sheet,0,0,sheet.width,sheet.height,0,0,atlas.width,atlas.height);
      scaled.set(side,brush.getImageData(0,0,atlas.width,atlas.height).data);
    }
    const atlas=scaled.get(side), offsets=[], ink=[];
    for (let y=0;y<side;y++) for (let x=0;x<side;x++) {
      const i=4*((color*side+y)*turns*side+angle*side+x);
      const a=Math.round(atlas[i+3]*opacity);
      if (a<12) continue;
      offsets.push(y*width+x); ink.push(((a<<24)|(atlas[i+2]<<16)|(atlas[i+1]<<8)|atlas[i])>>>0);
    }
    const result={side,offsets:Int32Array.from(offsets),ink:Uint32Array.from(ink)};
    petals.set(key,result);
    return result;
  }
  function stamp(x,y,dab) {
    const {side,offsets,ink}=dab;
    const left=Math.round(x*ratio-side*.5), top=Math.round(y*ratio-side*.5);
    if (left<0 || top<0 || left+side>width || top+side>height) return;
    const start=top*width+left;
    for (let i=0;i<offsets.length;i++) {
      const j=start+offsets[i], value=ink[i], alpha=value>>>24;
      if (alpha>128 || (pixels[j]>>>24)<alpha) pixels[j]=value;
    }
  }
  return {dab,stamp,clear:()=>pixels.fill(0),paint:()=>ctx.putImageData(frame,0,0)};
}
