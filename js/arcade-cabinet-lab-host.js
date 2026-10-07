"use strict";
// The real v0.66.1 page, with cabinet art only in this copy.
// Local previews and the baked phone bundle both use volatile storage.
(() => {
  const frame = document.getElementById('ps-game');
  const inject = JSON.parse(document.getElementById('lab-inject').textContent);
  const shim = `(function(){
    var mem=Object.create(null),P=Storage.prototype;
    P.getItem=function(k){return String(k) in mem?mem[String(k)]:null;};
    P.setItem=function(k,v){mem[String(k)]=String(v);};
    P.removeItem=function(k){delete mem[String(k)];};
    P.clear=function(){mem=Object.create(null);};
    P.key=function(i){return Object.keys(mem)[i]||null;};
    try{Object.defineProperty(P,'length',{configurable:true,get:function(){return Object.keys(mem).length;}});}catch(e){}
    if(navigator.serviceWorker){try{navigator.serviceWorker.register=function(){return Promise.reject(new Error('lab'));};}catch(e){}}
  })();`;
  let source;
  async function load(){
    if (window.LAB_STATIC){ frame.src='game.html?t='+Date.now(); return; }
    if (!source) source=await (await fetch('index.html',{cache:'no-store'})).text();
    const base=new URL('.',location.href).href;
    const tail=inject.css.map(f=>'<link rel="stylesheet" href="'+f+'?v='+inject.v+'">').join('')+
      inject.js.map(f=>'<script src="'+f+'?v='+inject.v+'"><\/script>').join('');
    frame.srcdoc=source.replace(/<script id="pwa-service-worker">[\s\S]*?<\/script>/,'')
      .replace(/<head>/i,'<head><base href="'+base+'"><script>'+shim+'<\/script>')
      .replace(/<\/body>/i,tail+'</body>');
  }
  load().catch(err=>{
    const p=document.createElement('p'); p.id='ps-error';
    p.textContent='Preview could not load: '+err.message; document.body.appendChild(p);
  });
})();
