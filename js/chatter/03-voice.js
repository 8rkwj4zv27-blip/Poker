/* One shared pixel-chatter instrument. Fast pitched ticks make a phrase-like
   machine cadence; they never attempt words or character-specific voices. */
(function(global){
  'use strict';
  var ctx=null,master=null,compressor=null,live=[];
  var phraseIndex=-1,tickIndex=0,api;
  var PATTERNS=[
    [850,1010,910,1080,880,980,820],
    [960,870,1040,920,1090,900,990],
    [820,940,1060,890,990,1110,930]
  ];

  function audio(){
    if(api.enabled===false) return null;
    try{
      if(!ctx){
        var AC=global.AudioContext||global.webkitAudioContext;
        if(!AC) return null;
        ctx=new AC();
        compressor=ctx.createDynamicsCompressor();
        compressor.threshold.value=-27; compressor.knee.value=6; compressor.ratio.value=8;
        master=ctx.createGain(); master.gain.value=api.volume;
        master.connect(compressor); compressor.connect(ctx.destination);
      }
      if(ctx.state==='suspended') ctx.resume();
      master.gain.value=api.volume;
      return ctx;
    }catch(e){ return null; }
  }
  function remember(source){ live.push(source); if(live.length>64) live=live.slice(-32); }
  function tone(c,opt){
    var o=c.createOscillator(),g=c.createGain(),f=c.createBiquadFilter();
    var t=c.currentTime+.006,d=opt.duration;
    f.type='lowpass'; f.frequency.value=2500; f.Q.value=.5;
    g.gain.setValueAtTime(.0001,t);
    g.gain.exponentialRampToValueAtTime(opt.gain,t+.0025);
    g.gain.exponentialRampToValueAtTime(.0001,t+d);
    o.type=opt.type||'square';
    o.frequency.setValueAtTime(opt.frequency,t);
    if(opt.finish) o.frequency.exponentialRampToValueAtTime(opt.finish,t+d*.82);
    o.connect(f); f.connect(g); g.connect(master);
    o.start(t); o.stop(t+d+.01); remember(o);
    return Math.round(d*1000);
  }
  function beginPhrase(){
    phraseIndex=(phraseIndex+1)%PATTERNS.length;
    tickIndex=0;
  }
  function open(){
    var c=audio(); if(!c) return 0;
    return tone(c,{duration:.014,frequency:350,finish:270,gain:.024,type:'triangle'});
  }
  function tick(options){
    var c=audio(); if(!c) return 0;
    options=options||{};
    var pattern=PATTERNS[Math.max(0,phraseIndex)%PATTERNS.length];
    var frequency=options.final?620:pattern[tickIndex%pattern.length];
    var accent=!options.final&&tickIndex>0&&tickIndex%4===3;
    tickIndex++;
    return tone(c,{
      duration:options.final ? .038 : .019,
      frequency:frequency,
      finish:options.final?frequency*.78:frequency*.95,
      gain:options.final ? .052 : (accent ? .05 : .042),
      type:options.final?'triangle':'square'
    });
  }
  function stopAll(){
    live.forEach(function(source){ try{ source.stop(0); }catch(e){} });
    live=[]; tickIndex=0;
  }
  api={
    enabled:true,
    volume:.5,
    patterns:PATTERNS.length,
    durations:{open:14,tick:19,final:38},
    beginPhrase:beginPhrase,
    open:open,
    tick:tick,
    stopAll:stopAll
  };
  global.ChatterVoice=api;
})(this);
