/* BITZ ORIGINAL GAMEPLAY SOUNDTRACK
 * Procedurally composed with Web Audio. No third-party music, files, or paid assets.
 * Browsers require the first tap/click/key press before sound can start.
 * Quiet 8-bar melodic loop with gentle chords, bass, percussion, and lead motifs.
 */
(() => {
  'use strict';
  let ctx=null, master=null, timer=null, index=0, nextAt=0, unlocked=false;
  let enabled=false, hidden=!!document.hidden;
  const TEMPO=106, STEP=60/TEMPO/2, LOOKAHEAD=.24, TRACK_STEPS=128;
  // Original BITZ melody in a relaxed D major / B minor progression.
  const chords=[[50,54,57,61],[47,50,54,57],[43,47,50,54],[45,49,52,57],
                [50,54,57,61],[45,49,52,57],[47,50,54,57],[43,47,50,54]];
  const lead=[73,null,76,78,null,76,73,null,71,null,73,76,78,null,76,null,
              69,null,71,73,null,74,73,null,71,null,69,71,73,null,69,null,
              71,null,73,76,null,73,71,null,69,null,71,73,76,null,73,null,
              69,null,71,73,76,null,74,null,73,null,71,69,71,null,69,null];
  const freq=m=>440*Math.pow(2,(m-69)/12);
  function init() {
    if(ctx) return ctx;
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio) return null;
    ctx=new Audio(); master=ctx.createGain();master.gain.value=.0001;
    const lim=ctx.createDynamicsCompressor();lim.threshold.value=-15;lim.knee.value=20;lim.ratio.value=3;
    lim.attack.value=.004;lim.release.value=.18;
    master.connect(lim);lim.connect(ctx.destination);
    return ctx;
  }
  function tone(note,when,duration,volume,type='triangle',cutoff=2400) {
    if(!ctx||!master||!Number.isFinite(note))return;
    const o=ctx.createOscillator(),filter=ctx.createBiquadFilter(),g=ctx.createGain();
    o.type=type;o.frequency.setValueAtTime(freq(note),when);
    filter.type='lowpass';filter.frequency.value=cutoff;filter.Q.value=.15;
    const attack=Math.min(.075,duration*.18);
    g.gain.setValueAtTime(.0001,when);
    g.gain.exponentialRampToValueAtTime(Math.max(.00011,volume),when+attack);
    g.gain.exponentialRampToValueAtTime(.0001,when+duration);
    o.connect(filter);filter.connect(g);g.connect(master);
    o.start(when);o.stop(when+duration+.02);
    o.onended=()=>{try{o.disconnect();filter.disconnect();g.disconnect();}catch(e){}};
  }
  function kick(when,volume=.035) {
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.type='sine';o.frequency.setValueAtTime(120,when);
    o.frequency.exponentialRampToValueAtTime(43,when+.13);
    g.gain.setValueAtTime(Math.max(.0001,volume),when);
    g.gain.exponentialRampToValueAtTime(.0001,when+.2);
    o.connect(g);g.connect(master);o.start(when);o.stop(when+.22);
    o.onended=()=>{o.disconnect();g.disconnect();};
  }
  function tick(when,vol=.012) {
    const length=.065, size=Math.max(1,Math.floor(ctx.sampleRate*length));
    const buf=ctx.createBuffer(1,size,ctx.sampleRate),data=buf.getChannelData(0);
    for(let i=0;i<size;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/size,2);
    const o=ctx.createBufferSource(),hp=ctx.createBiquadFilter(),g=ctx.createGain();
    o.buffer=buf;hp.type='highpass';hp.frequency.value=5800;
    g.gain.setValueAtTime(Math.max(.0001,vol),when);
    g.gain.exponentialRampToValueAtTime(.0001,when+length);
    o.connect(hp);hp.connect(g);g.connect(master);o.start(when);o.stop(when+length);
    o.onended=()=>{o.disconnect();hp.disconnect();g.disconnect();};
  }
  function schedule(step,at) {
    const n=step%TRACK_STEPS,beat=n%8,bar=Math.floor(n/8),chord=chords[bar%chords.length];
    if(beat===0){
      chord.forEach((m,i)=>tone(m+12,at,STEP*7.75,.0045,i%2?'sine':'triangle',950));
      tone(chord[0]-12,at,STEP*2.9,.022,'sine',480);
    }
    if(beat===4)tone(chord[0]-5,at,STEP*2.4,.015,'sine',520);
    if(beat===0||beat===4)kick(at,beat===0?.039:.027);
    if(beat===2||beat===6)tick(at,.013);
    if(beat%2===0)tick(at,.006);
    const note=lead[n%64];
    if(note!=null)tone(note,at,STEP*(n%8===0?2.8:1.35),.009,'triangle',1700);
    // A small counter-melody every second pass keeps the loop from sounding mechanical.
    if(bar%4===3&&beat===6)tone(chord[2]+24,at,STEP*2.7,.006,'sine',2000);
  }
  function stopScheduler() {if(timer!==null){clearInterval(timer);timer=null;}}
  function scheduler() {
    if(!ctx||!enabled||hidden||ctx.state!=='running')return;
    let guard=0;
    while(nextAt < ctx.currentTime+LOOKAHEAD && guard++<12){
      schedule(index,nextAt);index=(index+1)%TRACK_STEPS;nextAt+=STEP;
    }
  }
  function start() {
    if(!enabled||hidden||!ctx||ctx.state!=='running'||timer!==null)return;
    nextAt=ctx.currentTime+.07;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(Math.max(.0001,master.gain.value),ctx.currentTime);
    master.gain.linearRampToValueAtTime(.58,ctx.currentTime+.6);
    scheduler();timer=setInterval(scheduler,95);
  }
  function stop(){
    stopScheduler();
    if(master&&ctx){
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(Math.max(.0001,master.gain.value),ctx.currentTime);
      master.gain.linearRampToValueAtTime(.0001,ctx.currentTime+.16);
    }
  }
  async function unlock(){
    if(!enabled||hidden)return;
    try{
      const c=init();if(!c)return;
      if(c.state==='suspended')await c.resume();
      unlocked=c.state==='running';start();
    }catch(e){/* Browsers with unavailable audio stay silent without affecting gameplay. */}
  }
  function setEnabled(value){
    enabled=!!value;
    if(!enabled)stop();
    else if(unlocked)unlock();
  }
  document.addEventListener('pointerdown',()=>{if(enabled&&!unlocked)unlock();},{capture:true,passive:true});
  document.addEventListener('keydown',()=>{if(enabled&&!unlocked)unlock();},{capture:true});
  document.addEventListener('visibilitychange',()=>{
    hidden=document.hidden;
    if(hidden)stop();
    else if(unlocked&&enabled)unlock();
  });
  window.addEventListener('pagehide',stop);
  globalThis.BITZAUDIO=Object.freeze({
    setEnabled,unlock,state:()=>({enabled,unlocked,active:timer!==null,context:ctx?.state||'not-started'})
  });
})();
