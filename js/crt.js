"use strict";

/* ============================================================
   CRT — the change engine for the CRT component (css/crt.css)

   Every .crt on the page is watched: whenever what it shows changes (the
   table's paintCRT, the Home Boot's self-test, Career's record pages, the
   results stage's stat pages — whoever writes it), the change effect set by
   the nearest data-crt-change plays (burst | roll | channel | wipe | type),
   and the old picture burns out behind it (data-crt-ghost 0–4).

   - Runs of rapid changes (a spinning counter) settle into one change.
   - A screen's first text is never treated as a change.
   - data-crt-quiet on a screen opts it out (its changes are a number wheel
     or its own reveal).
   - Reduced Motion: text just swaps.

   CRT.set(screen, html)  write + change in one call (the Lab uses this).
   CRT.glitch(screen)     a one-off signal glitch.
   CRT.onChange = fn      called after each change.

   Presentation only.
   ============================================================ */

const CRT = (() => {
  // The CRT Lab's presets, mild to extreme; the Lab and the Finishes menu
  // both read them from here. The game's own recipe is on <html>.
  const PRESETS = [
    { id:'clean',    name:'Clean',    dials:{ tint:'blue',  glow:0, scan:1, rgb:0, grain:0, curve:1, flicker:1, roll:0, tear:0, ghost:0, change:'burst',   ink:'meaning' } },
    { id:'warm',     name:'Warm',     dials:{ tint:'dark',  glow:1, scan:1, rgb:0, grain:1, curve:2, flicker:1, roll:1, tear:0, ghost:0, change:'burst',   ink:'meaning' } },
    { id:'pulp',     name:'Pulp',     dials:{ tint:'amber', glow:2, scan:2, rgb:1, grain:1, curve:2, flicker:2, roll:2, tear:0, ghost:1, change:'roll',    ink:'meaning' } },
    { id:'vhs',      name:'VHS',      dials:{ tint:'dark',  glow:2, scan:3, rgb:3, grain:3, curve:2, flicker:2, roll:2, tear:2, ghost:2, change:'channel', ink:'meaning' } },
    { id:'meltdown', name:'Meltdown', dials:{ tint:'green', glow:4, scan:4, rgb:4, grain:4, curve:4, flicker:4, roll:4, tear:4, ghost:4, change:'channel', ink:'meaning' } }
  ];
  const SETTLE_MS = 120;
  const GHOST = { 1:[.25,380], 2:[.4,560], 3:[.55,800], 4:[.7,1100] };   // opacity, ms
  const DUR = { burst:260, roll:340, channel:440, wipe:320 };
  const KINDS = ['burst','roll','channel','wipe'];

  const reduced = () =>
    (typeof motionOff === 'function' && motionOff()) ||
    !!document.querySelector('[data-motion="off"]') ||
    (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  const setting = (el, name, fallback) => {
    const host = el.closest('[data-crt-' + name + ']');
    return host ? host.getAttribute('data-crt-' + name) : fallback;
  };

  // What a screen shows, without any ghost left in it.
  function picture(el){
    let html = '';
    for (const c of el.childNodes){
      if (c.nodeType === 1 && c.classList.contains('crt-ghost')) continue;
      html += c.nodeType === 1 ? c.outerHTML : (c.nodeType === 3 ? c.nodeValue : '');
    }
    return html;
  }
  const textOf = html => { const d = document.createElement('div'); d.innerHTML = html; return d.textContent.trim(); };

  // The old picture, laid out like the screen, fading behind the new one.
  function ghost(el, oldHTML, level){
    const g = GHOST[level]; if (!g || !oldHTML) return;
    const cs = getComputedStyle(el);
    const shade = document.createElement('div');
    shade.className = 'crt-ghost';
    shade.setAttribute('aria-hidden', 'true');
    ['display','flexDirection','alignItems','justifyContent','gap','gridTemplateColumns','gridTemplateRows','paddingTop','paddingRight','paddingBottom','paddingLeft','textAlign']
      .forEach(p => { shade.style[p] = cs[p]; });
    shade.style.setProperty('--crt-ghost-a', g[0]);
    shade.style.setProperty('--crt-ghost-ms', g[1] + 'ms');
    shade.innerHTML = oldHTML;
    shade.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    el.insertBefore(shade, el.firstChild);
    setTimeout(() => shade.remove(), g[1] + 40);
  }

  function typeOn(el){
    const nodes = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.parentElement.closest('.crt-ghost') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    let n; while ((n = walker.nextNode())) if (n.nodeValue.trim()) nodes.push([n, n.nodeValue]);
    nodes.forEach(([node]) => node.nodeValue = '');
    let i = 0, j = 0;
    el._typing = true;
    const step = () => {
      if (i >= nodes.length){ el._typing = false; return; }
      const [node, full] = nodes[i];
      j += 2; node.nodeValue = full.slice(0, j);
      if (j >= full.length){ i++; j = 0; }
      el._typeT = setTimeout(step, 16);
    };
    clearTimeout(el._typeT); step();
  }

  // Play the change effect for a screen whose picture just changed.
  function play(el, oldHTML){
    if (reduced()) return;
    const kind = setting(el, 'change', 'burst');
    ghost(el, oldHTML, Number(setting(el, 'ghost', 0)));
    if (kind === 'type'){ typeOn(el); }
    else {
      el.classList.remove(...KINDS.map(k => 'crt-chg-' + k));
      void el.offsetWidth;
      el.classList.add('crt-chg-' + kind);
      if (kind === 'channel'){ el.classList.add('crt-static'); setTimeout(() => el.classList.remove('crt-static'), 140); }
      clearTimeout(el._chgT);
      el._chgT = setTimeout(() => el.classList.remove('crt-chg-' + kind), DUR[kind] || 300);
    }
    if (typeof CRT.onChange === 'function') CRT.onChange(el, kind);
  }

  // ---- watching ----
  const seen = new WeakSet();
  const shown = new WeakMap();    // last settled picture
  const timers = new WeakMap();

  function settle(el){
    if (el._typing) return;
    const now = picture(el);
    const before = shown.get(el) || '';
    shown.set(el, now);
    if (now === before) return;
    if (!textOf(before)) return;          // first text, not a change
    if (textOf(before) === textOf(now)) return;   // markup-only change
    play(el, before);
  }

  const watcher = new MutationObserver(records => {
    for (const r of records){
      const node = r.target.nodeType === 1 ? r.target : r.target.parentElement;
      if (!node || node.closest('.crt-ghost')) continue;
      const el = node.closest('.crt');
      if (!el || el.hasAttribute('data-crt-quiet') || el._typing) continue;
      clearTimeout(timers.get(el));
      timers.set(el, setTimeout(() => settle(el), SETTLE_MS));
    }
  });

  function adopt(el){
    if (seen.has(el)) return;
    seen.add(el);
    shown.set(el, picture(el));
    watcher.observe(el, { childList:true, characterData:true, subtree:true });
  }
  function scan(root){
    if (root.nodeType !== 1) return;
    if (root.classList.contains('crt')) adopt(root);
    root.querySelectorAll('.crt').forEach(adopt);
  }
  function watch(){
    new MutationObserver(records => { for (const r of records) r.addedNodes.forEach(scan); })
      .observe(document.body, { childList:true, subtree:true });
    scan(document.body);
  }

  // ---- direct use ----
  function set(el, html){
    const target = el.querySelector(':scope > .crt-body') || el;
    if (target.innerHTML === html) return;
    const before = picture(el);
    target.innerHTML = html;
    shown.set(el, picture(el));   // the watcher will see nothing new
    play(el, before);
  }

  function glitch(el){
    if (reduced()) return;
    el.classList.remove('crt-glitch'); void el.offsetWidth; el.classList.add('crt-glitch');
    setTimeout(() => el.classList.remove('crt-glitch'), 620);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch);
  else watch();

  return { set, glitch, onChange:null, PRESETS };
})();
