"use strict";

/* ============================================================
   FINISHES — swap the look of each Pattern Book set, live

   Every repeated part of the machine is one shared set (see
   docs/ui/PATTERN_BOOK.md), so trying a different look is attributes on
   <html>: the CRT look swaps the data-crt-* dials of css/crt.css to one of
   the CRT Lab presets (CRT.PRESETS); the press swaps css/press-feel.css
   tokens. Every instance follows at once.

   The menu is a page inside the Settings sheet (Settings → Finishes). A
   choice sticks on this device only (localStorage 'felt.finishes'); the
   blank option of each set is the signed-off default everyone gets.
   An inline script at the top of index.html applies saved choices before
   first paint so nothing flashes.

   Presentation only. Set FINISHES_MENU to false to hide the menu and
   return this device to the defaults.

   Adding an option: a new entry below, plus the tokens for its attribute
   value in that set's stylesheet.
   ============================================================ */

const FINISHES_MENU = true;
const FINISHES_KEY = 'felt.finishes';

const FINISH_SETS = [
  { attr:'finishCrt', group:'CRT screens', label:'Look', dials:true, options:[
    { id:'',         name:'Game',     note:'Signed off: dark tube, heavy scanlines and grain, strong flicker, VHS tears, channel change with ghosting, one ink.' },
    { id:'clean',    name:'Clean',    note:'CRT Lab preset 1: calm blue glass, a faint flicker.' },
    { id:'warm',     name:'Warm',     note:'CRT Lab preset 2: soft glow, gentle flicker, a slight curve.' },
    { id:'pulp',     name:'Pulp',     note:'CRT Lab preset 3: amber phosphor, colour fringe, a rolling bar.' },
    { id:'vhs',      name:'VHS',      note:'CRT Lab preset 4: tracking lines, colour bleed, tears, channel change.' },
    { id:'meltdown', name:'Meltdown', note:'CRT Lab preset 5: everything at full.' }
  ]},
  { attr:'finishPress', group:'Buttons', label:'Press', options:[
    { id:'',         name:'Thunk',    note:'Every button sinks and springs back with a clunk, scaled by size.' },
    { id:'heavy',    name:'Heavy',    note:'Deeper sink, bigger bounce.' },
    { id:'light',    name:'Light',    note:'Shallower sink, a quicker settle.' },
    { id:'original', name:'Original', note:'Each button\'s press from before the Pattern Book, for comparison.' }
  ]}
];

const Finishes = (() => {
  const root = document.documentElement;

  function load(){
    try{ return JSON.parse(localStorage.getItem(FINISHES_KEY)) || {}; }
    catch(e){ return {}; }
  }
  function save(picks){
    try{ localStorage.setItem(FINISHES_KEY, JSON.stringify(picks)); }
    catch(e){ /* this session only */ }
  }
  // A CRT look writes that preset's dials; the game's own is on <html>
  // (captured before any pick by the inline script, as window.CRT_RECIPE).
  const camel = k => 'crt' + k[0].toUpperCase() + k.slice(1);
  function crtDials(id){
    const preset = id && typeof CRT !== 'undefined' && CRT.PRESETS.find(p => p.id === id);
    if (!preset) return Object.assign({}, window.CRT_RECIPE || {});
    const out = {};
    Object.entries(preset.dials).forEach(([k, v]) => out[camel(k)] = String(v));
    return out;
  }
  function apply(picks){
    FINISH_SETS.forEach(set => {
      const v = picks[set.attr];
      const valid = v && set.options.some(o => o.id === v);
      if (valid) root.dataset[set.attr] = v; else delete root.dataset[set.attr];
      if (set.dials) Object.entries(crtDials(valid ? v : '')).forEach(([k, val]) => root.dataset[k] = val);
    });
  }
  // What gets saved: the picks, plus a CRT look's dials so the inline
  // script can apply them before first paint. Older keys are dropped.
  function stored(picks){
    const out = {};
    FINISH_SETS.forEach(set => {
      const v = picks[set.attr];
      if (!v || !set.options.some(o => o.id === v)) return;
      out[set.attr] = v;
      if (set.dials) Object.assign(out, crtDials(v));
    });
    return out;
  }

  function current(set){ return root.dataset[set.attr] || ''; }

  function render(){
    const list = document.getElementById('finishes-list');
    if (!list) return;
    let html = '', group = '';
    FINISH_SETS.forEach(set => {
      if (set.group !== group){
        if (group) html += '</div>';
        group = set.group;
        html += '<div class="sheet-section"><h3>' + group + '</h3>';
        if (group === 'CRT screens') html += '<div class="finish-preview"><div class="crt finish-crt" data-ink="live" id="finish-crt-a">Dealer ready</div><div class="crt finish-crt finish-crt-money" data-ink="money" id="finish-crt-b"><span class="crt-figure">$1,250</span></div></div>';
        if (group === 'Buttons') html += '<div class="finish-preview finish-keys"><button class="icon-btn" type="button" aria-label="Try the small key">⚙</button><button class="btn-secondary" type="button">Try me</button><button class="btn-primary" type="button">Big key</button></div>';
      }
      const now = current(set);
      const note = (set.options.find(o => o.id === now) || set.options[0]).note;
      html += '<div class="field finish-field"><div class="field-label">' + set.label + '</div>' +
        '<div class="segmented compact finish-seg" role="group" aria-label="' + set.group + ' ' + set.label + '">' +
        set.options.map(o => '<button type="button" data-finish="' + set.attr + '" data-value="' + o.id + '"' + (o.id === now ? ' class="active"' : '') + '>' + o.name + '</button>').join('') +
        '</div><div class="hint">' + note + '</div></div>';
    });
    html += '</div>';
    list.innerHTML = html;
  }

  function choose(attr, value){
    const picks = load();
    if (value) picks[attr] = value; else delete picks[attr];
    save(stored(picks));
    apply(picks);
    render();
  }

  // The preview CRTs change what they say while the page is open, so the
  // motion options can be seen.
  const LINES = [['Dealer ready','$1,250'],['Your turn · 20 to call','$1,270'],['Shark raises to 60','$1,210']];
  let line = 0, ticker = null;
  function tick(){
    line = (line + 1) % LINES.length;
    const a = document.getElementById('finish-crt-a'), b = document.getElementById('finish-crt-b');
    if (a) a.textContent = LINES[line][0];
    if (b) b.innerHTML = '<span class="crt-figure">' + LINES[line][1] + '</span>';
  }

  function open(){
    const sheet = document.getElementById('settings-sheet');
    render();
    sheet.classList.add('show-finishes');
    const body = document.getElementById('finishes-body');
    if (body) body.scrollTop = 0;
    clearInterval(ticker); ticker = setInterval(tick, 3000);
  }
  function close(){
    document.getElementById('settings-sheet').classList.remove('show-finishes');
    clearInterval(ticker); ticker = null;
  }

  function install(){
    if (!FINISHES_MENU){
      apply({});
      const entry = document.getElementById('finishes-entry');
      if (entry) entry.classList.add('hidden');
      return;
    }
    const picks = stored(load());   // drops options that no longer exist
    save(picks);
    apply(picks);
    const openBtn = document.getElementById('open-finishes');
    const backBtn = document.getElementById('close-finishes');
    const resetBtn = document.getElementById('reset-finishes');
    if (openBtn) openBtn.addEventListener('click', open);
    if (backBtn) backBtn.addEventListener('click', close);
    const headBack = document.getElementById('finishes-back');
    if (headBack) headBack.addEventListener('click', close);
    if (resetBtn) resetBtn.addEventListener('click', () => { save({}); apply({}); render(); });
    const list = document.getElementById('finishes-list');
    if (list) list.addEventListener('click', event => {
      const b = event.target.closest('[data-finish]');
      if (b) choose(b.dataset.finish, b.dataset.value);
    });
    // Closing Settings any other way (the scrim, Done) resets the page.
    const sheet = document.getElementById('settings-sheet');
    if (sheet) new MutationObserver(() => {
      if (!sheet.classList.contains('open') && sheet.classList.contains('show-finishes')) close();
    })
      .observe(sheet, { attributes:true, attributeFilter:['class'] });
  }

  return { install, choose, sets:FINISH_SETS };
})();

Finishes.install();
