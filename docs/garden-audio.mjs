// Joe Hisaishi, “Merry-Go-Round of Life”. Solo flute setting of the main waltz.
// Each pair is a concert MIDI pitch and the number of quarter beats to the next attack.
const beatMs=400;
const phrases = [
  [[62,.5], [67,.5], [70,.5], [74,2], [74,1], [72,1], [70,1], [69,1], [70,4.5]],
  [[67,.5], [70,.5], [74,.5], [79,2], [79,1], [79,1], [77,1], [75,1], [77,4.5]],
  [[69,.5], [74,.5], [77,.5], [81,2], [79,1], [77,1], [76,1], [77,1], [79,2], [77,1]],
  [[76,2], [74,1], [72,1], [70,1], [72,1], [74,1], [72,1], [67,1], [69,4.5]],
];
const melody=phrases.flat();
export const melodyLength=melody.length;

export function phraseDelays(index) {
  let offset=index%melodyLength;
  for(const [i,phrase] of phrases.entries()) {
    if(offset<phrase.length) {
      const notes=phrase.slice(offset);
      // A swipe mid-phrase finishes that thought, then plays a complete phrase.
      if(offset>0)notes.push(...phrases[(i+1)%phrases.length]);
      return notes.map(([,beats])=>beats*beatMs);
    }
    offset-=phrase.length;
  }
}
const floor=.0001;
const pitch=note=>440*2**((note-69)/12);

export function gardenAudio(initiallyEnabled) {
  let enabled=initiallyEnabled,ctx,master,fluteBus,wave,air,lastVoice,lastStart=-1,clockUsable=true;

  function unlock() {
    if(!enabled)return false;
    try {
      if(!ctx) {
        const Audio=window.AudioContext || window.webkitAudioContext;
        if(!Audio)return false;
        ctx=new Audio();master=ctx.createGain();master.gain.value=.70;master.connect(ctx.destination);
        // Reflections decay behind the flute while the next attack stays clear.
        const echo=ctx.createDelay(.4),feedback=ctx.createGain(),send=ctx.createGain();
        echo.delayTime.value=.145;feedback.gain.value=.18;send.gain.value=.14;
        echo.connect(feedback).connect(echo);echo.connect(send).connect(master);
        fluteBus=ctx.createGain();fluteBus.connect(master);fluteBus.connect(echo);
        wave=ctx.createPeriodicWave(new Float32Array(7),new Float32Array([0,1,.14,.11,.032,.028,.011]));
        air=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.82),ctx.sampleRate);
        const data=air.getChannelData(0);let random=58129;
        for(let i=0;i<data.length;i++){random=(Math.imul(random,1664525)+1013904223)>>>0;data[i]=random/2147483648-1;}
      }
      if(ctx.state!=='running')ctx.resume().catch(()=>{clockUsable=false;});
      return true;
    } catch{return false;}
  }
  function setEnabled(next) {
    enabled=next;
    if(next)unlock();
    if(master)master.gain.setTargetAtTime(next ? .70 : 0,ctx.currentTime,.007);
  }

  function flower(index) {
    if(!unlock())return false;
    const [note,beats]=melody[index%melody.length],hz=pitch(note);
    const start=Math.max(ctx.currentTime+.009,lastStart+.055);
    lastStart=start;
    const sustain=start+.095, release=start+Math.max(.12,beats*beatMs/1000*.89-.035), end=release+.15;
    const osc=ctx.createOscillator(), vibrato=ctx.createOscillator(), depth=ctx.createGain();
    const breath=ctx.createBufferSource(), filter=ctx.createBiquadFilter(), airLevel=ctx.createGain();
    const env=ctx.createGain();
    if(lastVoice && lastVoice.release>start) {
      const level=lastVoice.gain;
      if(level.cancelAndHoldAtTime)level.cancelAndHoldAtTime(start);
      else {level.cancelScheduledValues(start);level.setValueAtTime(.14,start);}
      level.exponentialRampToValueAtTime(floor,start+.046);
    }
    lastVoice={gain:env.gain,release:end};
    osc.setPeriodicWave(wave);osc.frequency.value=hz;
    osc.detune.setValueAtTime(-13,start);osc.detune.linearRampToValueAtTime(0,start+.06);
    vibrato.frequency.value=5.05+(index%3)*.13;depth.gain.setValueAtTime(0,start);
    depth.gain.linearRampToValueAtTime(0,start+.12);depth.gain.linearRampToValueAtTime(5,start+.30);
    vibrato.connect(depth).connect(osc.detune);
    breath.buffer=air;breath.loop=true;filter.type='bandpass';filter.frequency.value=hz*2.35+670;filter.Q.value=.82;
    airLevel.gain.setValueAtTime(.39,start);airLevel.gain.exponentialRampToValueAtTime(.135,start+.095);
    breath.connect(filter).connect(airLevel).connect(env);osc.connect(env);env.connect(fluteBus);
    env.gain.setValueAtTime(floor,start);env.gain.linearRampToValueAtTime(.215,start+.037);
    env.gain.exponentialRampToValueAtTime(.153,sustain);env.gain.exponentialRampToValueAtTime(.127,release);
    env.gain.exponentialRampToValueAtTime(floor,end);
    osc.onended=()=>{
      for(const node of [osc,vibrato,depth,breath,filter,airLevel,env])node.disconnect();
      if(lastVoice?.gain===env.gain)lastVoice=null;
    };
    osc.start(start);vibrato.start(start);breath.start(start,(index*.113)%air.duration);
    osc.stop(end+.012);vibrato.stop(end+.012);breath.stop(end+.012);
    return true;
  }

  function cue(kind) {
    if(!unlock())return;
    const notes=kind==='end'?[523.25,659.25,783.99,1046.5]:kind==='word'?[659.25,880]:kind==='pet'?[392,494]:[523.25];
    for(const [i,hz] of notes.entries()) {
      const start=ctx.currentTime+.012+i*.09;
      const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=kind==='pet'?'sine':'triangle';osc.frequency.value=hz;
      gain.gain.setValueAtTime(floor,start);gain.gain.exponentialRampToValueAtTime(.073,start+.019);gain.gain.exponentialRampToValueAtTime(floor,start+.33);
      osc.connect(gain).connect(master);osc.onended=()=>{osc.disconnect();gain.disconnect();};osc.start(start);osc.stop(start+.35);
    }
  }
  // On a phone's first swipe the audio clock may wait for touch-up to start.
  const phraseTime=()=>enabled && ctx && clockUsable?ctx.currentTime*1000:performance.now();
  return {unlock,setEnabled,flower,cue,phraseTime};
}
