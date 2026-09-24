"use strict";

/* ============================================================
   CRT — the change engine for the CRT component (css/crt.css)

   CRT.set(screen, html)  changes what a .crt shows, with the change
                          effect chosen by the nearest data-crt-change
                          (burst | roll | channel | wipe | type) and the
                          ghost of the old picture (data-crt-ghost 0–4).
                          Same content: nothing happens. Reduced Motion:
                          the text just swaps.
   CRT.glitch(screen)     a one-off signal glitch.
   CRT.onChange = fn      called after each change (the Lab's crackle).

   Candidate: loaded by crt-lab.html only until the owner picks a recipe.
   ============================================================ */

const CRT = (() => {
  const GHOST = { 1:[.25,380], 2:[.4,560], 3:[.55,800], 4:[.7,1100] };   // opacity, ms
  const DUR = { burst:260, roll:340, channel:440, wipe:320 };

  const reduced = () =>
    (typeof motionOff === 'function' && motionOff()) ||
    !!document.querySelector('[data-motion="off"]') ||
    (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  const setting = (el, name, fallback) => {
    const host = el.closest('[data-crt-' + name + ']');
    return host ? host.getAttribute('data-crt-' + name) : fallback;
  };

  function body(el){
    let b = el.querySelector(':scope > .crt-body');
    if (!b){ b = document.createElement('div'); b.className = 'crt-body'; while (el.firstChild) b.appendChild(el.firstChild); el.appendChild(b); }
    return b;
  }

  function ghost(el, b, level){
    const g = GHOST[level]; if (!g) return;
    const shade = b.cloneNode(true);
    shade.classList.remove('crt-chg-burst','crt-chg-roll','crt-chg-channel','crt-chg-wipe');
    shade.classList.add('crt-ghost');
    shade.setAttribute('aria-hidden', 'true');
    shade.style.setProperty('--crt-ghost-a', g[0]);
    shade.style.setProperty('--crt-ghost-ms', g[1] + 'ms');
    el.insertBefore(shade, b);
    setTimeout(() => shade.remove(), g[1] + 40);
  }

  function typeOn(b){
    const walker = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
    const nodes = []; let n;
    while ((n = walker.nextNode())) if (n.nodeValue.trim()) nodes.push([n, n.nodeValue]);
    nodes.forEach(([node]) => node.nodeValue = '');
    let i = 0, j = 0;
    const step = () => {
      if (i >= nodes.length) return;
      const [node, full] = nodes[i];
      j += 2; node.nodeValue = full.slice(0, j);
      if (j >= full.length){ i++; j = 0; }
      b._typeT = setTimeout(step, 16);
    };
    clearTimeout(b._typeT); step();
  }

  function set(el, html){
    const b = body(el);
    if (b.innerHTML === html) return;
    if (reduced()){ b.innerHTML = html; return; }
    const kind = setting(el, 'change', 'burst');
    ghost(el, b, Number(setting(el, 'ghost', 0)));
    b.innerHTML = html;
    if (kind === 'type'){ typeOn(b); }
    else {
      b.classList.remove('crt-chg-burst','crt-chg-roll','crt-chg-channel','crt-chg-wipe');
      void b.offsetWidth;
      b.classList.add('crt-chg-' + kind);
      if (kind === 'channel'){ el.classList.add('crt-static'); setTimeout(() => el.classList.remove('crt-static'), 140); }
      clearTimeout(b._chgT);
      b._chgT = setTimeout(() => b.classList.remove('crt-chg-' + kind), DUR[kind] || 300);
    }
    if (typeof CRT.onChange === 'function') CRT.onChange(el, kind);
  }

  function glitch(el){
    if (reduced()) return;
    el.classList.remove('crt-glitch'); void el.offsetWidth; el.classList.add('crt-glitch');
    setTimeout(() => el.classList.remove('crt-glitch'), 620);
  }

  return { set, glitch, body, onChange:null };
})();
