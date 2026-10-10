/* A presentation-only fixture. No game scripts, saves or transactions load here. */
(() => {
  'use strict';
  const windowEl = document.getElementById('motion-window');
  const careerFace = document.getElementById('motion-career-face');
  const careerFrame = document.getElementById('motion-career-frame');
  const careerButton = document.getElementById('motion-career');
  const homeButton = document.getElementById('motion-return');
  const replayButton = document.getElementById('motion-replay');
  const reduceButton = document.getElementById('motion-reduce');
  const glass = document.getElementById('motion-glass');
  const spriteLayer = document.getElementById('motion-sprite-layer');
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = motionPreference.matches;
  let scene = 'home';
  let busy = false;
  let glassBusy = false;
  let frameReady = false;
  const wait = ms => new Promise(resolve => setTimeout(resolve,ms));

  function syncReduced() {
    document.body.classList.toggle('motion-reduced',reduced);
    reduceButton.textContent = reduced ? 'MOTION OFF' : 'MOTION ON';
    reduceButton.setAttribute('aria-pressed',String(reduced));
    if (frameReady) careerFrame.contentWindow.postMessage({type:'career-motion-reduced',value:reduced},location.origin);
  }

  async function travel(toCareer) {
    if (busy || (toCareer && scene === 'career') || (!toCareer && scene === 'home')) return;
    busy = true;
    careerButton.disabled = true;
    homeButton.disabled = true;
    replayButton.disabled = true;
    if (toCareer) {
      careerFace.inert = false;
      careerButton.classList.add('motion-pressed');
      windowEl.classList.add('is-preparing');
      await wait(reduced ? 0 : 190);
      windowEl.classList.add('is-rolling');
      requestAnimationFrame(() => windowEl.classList.add('is-career'));
    } else {
      windowEl.classList.add('is-rolling','is-returning');
      requestAnimationFrame(() => windowEl.classList.remove('is-career'));
    }
    await wait(reduced ? 20 : toCareer ? 690 : 500);
    windowEl.classList.remove('is-rolling','is-returning','is-preparing');
    careerButton.classList.remove('motion-pressed');
    scene = toCareer ? 'career' : 'home';
    if (!toCareer) careerFace.inert = true;
    careerButton.disabled = false;
    homeButton.disabled = !toCareer;
    replayButton.disabled = false;
    busy = false;
  }

  function playGlass() {
    if (glassBusy || busy) return;
    glassBusy = true;
    glass.classList.remove('is-tapped');
    void glass.offsetWidth;
    glass.classList.add('is-tapped');
    if (reduced) {
      setTimeout(() => { glass.classList.remove('is-tapped'); glassBusy = false; },200);
      return;
    }
    const bounds = spriteLayer.getBoundingClientRect();
    const types = [
      ['face','assets/faces/red-sly01.PNG'],
      ['face','assets/faces/yellow-thinking01.PNG'],
      ['face','assets/faces/purple-sly01.PNG'],
      ['chip',''],['chip',''],['card','']
    ];
    const pieces = types.map(([type,src],i) => {
      const el = document.createElement(type === 'face' ? 'img' : 'span');
      el.className = `motion-prop ${type}`;
      if (src) { el.src = src; el.alt = ''; }
      if (type === 'card') el.textContent = 'A';
      spriteLayer.appendChild(el);
      return {
        el, x:bounds.width*.46 + (i-2.5)*7, y:bounds.height*.55,
        vx:(i%2 ? 1 : -1)*(2.9+i*.47), vy:-3.9-(i%3)*.65,
        size:type === 'face' ? 44 : type === 'chip' ? 30 : 28,
        angle:(i-2.5)*9, spin:(i%2 ? 1 : -1)*(2+i*.3)
      };
    });
    let last = 0;
    const started = performance.now();
    function tick(now) {
      const elapsed = now-started;
      const step = last ? Math.min(2,(now-last)/16.67) : 1;
      last = now;
      pieces.forEach(piece => {
        piece.vy += .22*step;
        piece.x += piece.vx*step;
        piece.y += piece.vy*step;
        piece.angle += piece.spin*step;
        if (piece.x < 0) { piece.x = 0; piece.vx = Math.abs(piece.vx)*.76; }
        if (piece.x > bounds.width-piece.size) { piece.x = bounds.width-piece.size; piece.vx = -Math.abs(piece.vx)*.76; }
        if (piece.y < 0) { piece.y = 0; piece.vy = Math.abs(piece.vy)*.7; }
        if (piece.y > bounds.height-piece.size) {
          piece.y = bounds.height-piece.size; piece.vy = -Math.abs(piece.vy)*.64;
          piece.vx *= .93; piece.spin *= .8;
        }
        piece.el.style.transform = `translate(${piece.x}px,${piece.y}px) rotate(${piece.angle}deg)`;
        piece.el.style.opacity = elapsed > 1450 ? String(Math.max(0,(1780-elapsed)/330)) : '1';
      });
      if (elapsed < 1780) requestAnimationFrame(tick);
      else {
        pieces.forEach(piece => piece.el.remove());
        glass.classList.remove('is-tapped');
        glassBusy = false;
      }
    }
    requestAnimationFrame(tick);
  }

  careerFrame.addEventListener('load',() => { frameReady = true; syncReduced(); });
  careerButton.addEventListener('click',() => travel(true));
  homeButton.addEventListener('click',() => travel(false));
  replayButton.addEventListener('click',async () => {
    if (busy) return;
    if (scene === 'career') await travel(false);
    await wait(reduced ? 0 : 100);
    await travel(true);
  });
  reduceButton.addEventListener('click',() => { reduced = !reduced; syncReduced(); });
  motionPreference.addEventListener('change',event => { reduced = event.matches; syncReduced(); });
  glass.addEventListener('click',playGlass);
  syncReduced();
})();
