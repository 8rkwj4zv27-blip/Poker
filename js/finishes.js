"use strict";

/* ============================================================
   FINISHES — swap the look of each Pattern Book set, live

   Every repeated part of the machine is one shared set (see
   docs/ui/PATTERN_BOOK.md), so trying a different look is one attribute on
   <html>: css/machine-crt.css and css/press-feel.css redefine that set's
   tokens for it, and every instance follows at once.

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
  { attr:'finishCrtGlass', group:'CRT screens', label:'Glass', options:[
    { id:'',          name:'Blue',        note:'Signed off: blue-tinted tube, soft bezel, no glow.' },
    { id:'blue-glow', name:'Blue + glow', note:'The same blue tube with a soft glow on the text.' },
    { id:'dark',      name:'Dark',        note:'The earlier table glass: near-black tube, hard bezel, phosphor glow.' },
    { id:'green',     name:'Green',       note:'A green phosphor tube with a matching glow.' },
    { id:'amber',     name:'Amber',       note:'A warm amber tube with a matching glow.' },
    { id:'black',     name:'Black',       note:'A deep black tube with strong bloom around the text.' }
  ]},
  { attr:'finishCrtInk', group:'CRT screens', label:'Ink', options:[
    { id:'',     name:'By meaning', note:'Signed off: pale blue for live table info, gold for money, cream for everything else.' },
    { id:'one',  name:'One ink',    note:'Cream everywhere; gold kept for money.' },
    { id:'mono', name:'Mono',       note:'Cream everywhere, money included.' }
  ]},
  { attr:'finishCrtMotion', group:'CRT screens', label:'Motion', options:[
    { id:'',      name:'Flicker + blink', note:'Signed off: a faint idle flicker, and a static burst when the text changes.' },
    { id:'blink', name:'Blink only',      note:'Steady at rest; a static burst when the text changes.' },
    { id:'still', name:'Still',           note:'No flicker, no burst. Text just swaps.' }
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
  function apply(picks){
    FINISH_SETS.forEach(set => {
      const v = picks[set.attr];
      if (v && set.options.some(o => o.id === v)) root.dataset[set.attr] = v;
      else delete root.dataset[set.attr];
    });
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
        if (group === 'CRT screens') html += '<div class="finish-preview"><div class="pc-display machine-crt finish-crt" data-ink="live" id="finish-crt-a">Dealer ready</div><div class="pc-display machine-crt finish-crt finish-crt-money" data-ink="money" id="finish-crt-b">$1,250</div></div>';
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
    save(picks);
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
    if (b) b.textContent = LINES[line][1];
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
    apply(load());
    const openBtn = document.getElementById('open-finishes');
    const backBtn = document.getElementById('close-finishes');
    const resetBtn = document.getElementById('reset-finishes');
    if (openBtn) openBtn.addEventListener('click', open);
    if (backBtn) backBtn.addEventListener('click', close);
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
