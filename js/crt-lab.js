"use strict";

/* CRT Lab — see crt-lab.html. Builds every CRT screen in the game from the
   candidate component, and drives the presets, dials and demo controls.
   Writes nothing but the page address. */
(() => {
  // ---------------- dials and presets ----------------
  const DIALS = [
    { key:'tint',    label:'Glass',        values:['blue','dark','green','amber','black'] },
    { key:'glow',    label:'Glow',         values:[0,1,2,3,4] },
    { key:'scan',    label:'Scanlines',    values:[0,1,2,3,4] },
    { key:'rgb',     label:'RGB split',    values:[0,1,2,3,4] },
    { key:'grain',   label:'Grain',        values:[0,1,2,3,4] },
    { key:'curve',   label:'Curve',        values:[0,1,2,3,4] },
    { key:'flicker', label:'Flicker',      values:[0,1,2,3,4] },
    { key:'roll',    label:'Rolling bar',  values:[0,1,2,3,4] },
    { key:'tear',    label:'VHS tears',    values:[0,1,2,3,4] },
    { key:'ghost',   label:'Ghosting',     values:[0,1,2,3,4] },
    { key:'change',  label:'On change',    values:['burst','roll','channel','wipe','type'] },
    { key:'ink',     label:'Ink',          values:['meaning','one','mono'] }
  ];
  const PRESETS = [
    { id:'clean',    name:'Clean',    hint:'mild',    dials:{ tint:'blue',  glow:0, scan:1, rgb:0, grain:0, curve:1, flicker:1, roll:0, tear:0, ghost:0, change:'burst',   ink:'meaning' } },
    { id:'warm',     name:'Warm',     hint:'soft',    dials:{ tint:'dark',  glow:1, scan:1, rgb:0, grain:1, curve:2, flicker:1, roll:1, tear:0, ghost:0, change:'burst',   ink:'meaning' } },
    { id:'pulp',     name:'Pulp',     hint:'punchy',  dials:{ tint:'amber', glow:2, scan:2, rgb:1, grain:1, curve:2, flicker:2, roll:2, tear:0, ghost:1, change:'roll',    ink:'meaning' } },
    { id:'vhs',      name:'VHS',      hint:'tape',    dials:{ tint:'dark',  glow:2, scan:3, rgb:3, grain:3, curve:2, flicker:2, roll:2, tear:2, ghost:2, change:'channel', ink:'meaning' } },
    { id:'meltdown', name:'Meltdown', hint:'extreme', dials:{ tint:'green', glow:4, scan:4, rgb:4, grain:4, curve:4, flicker:4, roll:4, tear:4, ghost:4, change:'channel', ink:'meaning' } }
  ];

  // ---------------- every CRT in the game ----------------
  const L = t => '<div class="crt-line">' + t + '</div>';
  const F = (t, lg, money) => '<div class="crt-figure' + (lg ? ' crt-figure--lg' : '') + (money ? ' crt-money' : '') + '">' + t + '</div>';
  const C = t => '<div class="crt-caption">' + t + '</div>';
  const cells = list => list.map(([cap, fig, money]) => '<div class="crt-cell">' + F(fig, true, money) + C(cap) + '</div>').join('');
  const capFirst = (list, lg = true) => list.map(([cap, fig, money]) => '<div class="crt-cell">' + C(cap) + F(fig, lg, money) + '</div>').join('');
  const card = (r, s) => '<div class="mcard' + (s === '♥' || s === '♦' ? ' red' : '') + '"><span>' + r + '</span><span>' + s + '</span></div>';

  const GROUPS = [
    { name:'Home', note:'The main menu cabinet.', items:[
      { where:'Home · Dealer Ready readout', what:'Machine status in the top bar; runs the self-test on boot.', w:150, h:24,
        states:['DEALER READY','SHUFFLING','SELF-TEST OK','INSERT COIN'].map(t => '<div class="crt-row"><span class="crt-lamp"></span>' + L(t) + '</div>') },
      { where:'Home · Stats window', what:'Lifetime hands, win rate and best win.', w:322, h:62, cells:true,
        states:[cells([['HANDS','210'],['WON','30%'],['BEST HAND WIN','606']]), cells([['HANDS','211'],['WON','31%'],['BEST HAND WIN','606']])] }
    ]},
    { name:'Career', note:'The Career hub.', items:[
      { where:'Career · Record', what:'Cycles bankroll and progress statistics; tap for the next page.', w:340, h:46, cells:true,
        // Standard figures here: word values like PUB CIRCUIT must fit a half-width cell.
        states:[capFirst([['TOTAL OWNED','$399',true],['HIGHEST ACCESS','PUB CIRCUIT']], false), capFirst([['EVENTS PLAYED','012'],['EVENTS WON','003']], false), capFirst([['BEST FINISH','1ST'],['CASHED','$1,240',true]], false)] },
      { where:'Career · Ticket slot', what:'The readout above the ticket intake.', w:202, h:24,
        states:['INSERT TICKET','READING TICKET','ENTRY PAID'].map(t => '<div class="crt-row"><span class="crt-lamp is-amber"></span>' + L(t) + '</div>') }
    ]},
    { name:'Table', note:'Your console during a hand.', items:[
      { where:'Table · Hand readout', what:'Your current hand, live.', w:164, h:26, ink:'live',
        states:['KING-JACK OFFSUIT','POCKET SIXES','TWO PAIR, KINGS','FLUSH, ACE HIGH'].map(L) },
      { where:'Table · Turn banner', what:'Whose turn it is and what just happened.', w:164, h:36, ink:'live',
        states:[L('YOUR TURN') + L('20 TO CALL'), L('SHARK') + L('RAISES TO 60'), L('PROF') + L('FOLDS'), L('DEALING') + L('THE FLOP')] },
      { where:'Table · Bet this hand', what:'What you have in this hand.', w:74, h:30, ink:'money',
        states:['$000','$020','$060','$120'].map(t => F(t)) },
      { where:'Table · Raise to', what:'The amount on the raise slider.', w:110, h:28, ink:'money',
        states:['$040','$080','$160','$320'].map(t => F(t)) }
    ]},
    { name:'Results stage', note:'TABLE CLEARED / RUN OVER / EVENT WON / EVENT LOST.', items:[
      { where:'Results · Score', what:'The run\'s score, counted up.', w:330, h:52, ink:'money',
        states:[C('SCORE') + F('0 012 480', true), C('SCORE') + F('0 013 960', true)] },
      { where:'Results · Instruments', what:'Two readouts side by side: pot winnings and chips.', w:330, h:62, pair:true, ink:'money',
        states:[[C('POT WINNINGS') + F('$1,240'), C('CHIPS') + F('$2,480')], [C('POT WINNINGS') + F('$1,460'), C('CHIPS') + F('$2,700')]] },
      { where:'Results · Stats bank', what:'Three statistics that page through.', w:330, h:52, cells:true,
        states:[capFirst([['HANDS','48'],['WON','19'],['BIG POTS','4']]), capFirst([['ALL-INS','6'],['HIGH WATER','$3,100',true],['WIN RATE','40%']])] },
      { where:'Results · Best-hand trophy', what:'Your best hand of the run, with its cards.', w:330, h:66,
        states:[
          '<div class="crt-row"><div class="crt-cards">' + card('6','♠') + card('6','♥') + card('6','♦') + card('K','♣') + card('K','♥') + '</div><div>' + C('BEST HAND') + L('FULL HOUSE') + L('SIXES OVER KINGS') + '</div></div>',
          '<div class="crt-row"><div class="crt-cards">' + card('A','♥') + card('J','♥') + card('8','♥') + card('5','♥') + card('2','♥') + '</div><div>' + C('BEST HAND') + L('FLUSH') + L('ACE HIGH') + '</div></div>'] },
      { where:'Results · Run progress', what:'How far through the run you are.', w:330, h:40,
        states:[L('TABLE 2 OF 5') + '<div class="crt-meter"><i style="--v:40%"></i></div>', L('TABLE 3 OF 5') + '<div class="crt-meter"><i style="--v:60%"></i></div>'] }
    ]}
  ];

  // ---------------- build ----------------
  const scope = document.getElementById('scope');
  const host = document.getElementById('screens');
  const screens = [];   // { el(s), states, i }

  function crtEl(item, html){
    const el = document.createElement('div');
    el.className = 'crt';
    if (item.ink) el.dataset.ink = item.ink;
    el.style.width = item.pair ? 'auto' : item.w + 'px';
    el.style.height = item.h + 'px';
    const b = document.createElement('div'); b.className = 'crt-body' + (item.cells ? ' crt-cells' : '');
    b.innerHTML = html;
    el.appendChild(b);
    return el;
  }

  GROUPS.forEach(group => {
    const g = document.createElement('section'); g.className = 'group';
    g.innerHTML = '<h2>' + group.name + '</h2><p>' + group.note + '</p>';
    group.items.forEach(item => {
      const wrap = document.createElement('div'); wrap.className = 'item';
      wrap.innerHTML = '<div class="where"><b>' + item.where + '</b><span>' + item.what + '</span></div>';
      const housing = document.createElement('div'); housing.className = 'housing' + (item.pair ? ' pair' : '');
      if (item.pair) housing.style.width = item.w + 'px';
      const first = item.states[0];
      const els = item.pair ? first.map(h => crtEl(item, h)) : [crtEl(item, first)];
      els.forEach(e => housing.appendChild(e));
      wrap.appendChild(housing); g.appendChild(wrap);
      screens.push({ item, els, i:0 });
    });
    host.appendChild(g);
  });

  function change(){
    screens.forEach(s => {
      s.i = (s.i + 1) % s.item.states.length;
      const next = s.item.states[s.i];
      s.els.forEach((el, k) => {
        const html = s.item.pair ? next[k] : next;
        CRT.set(el, html);
      });
    });
  }

  // ---------------- state ----------------
  let state = Object.assign({}, PRESETS[2].dials);
  let presetId = 'pulp';

  function fromHash(){
    const h = decodeURIComponent(location.hash.slice(1));
    if (!h) return;
    const parts = Object.fromEntries(h.split(',').map(p => p.split('=')));
    if (parts.preset && PRESETS.some(p => p.id === parts.preset)){ presetId = parts.preset; state = Object.assign({}, PRESETS.find(p => p.id === presetId).dials); }
    DIALS.forEach(d => { if (parts[d.key] !== undefined){ const v = isNaN(parts[d.key]) ? parts[d.key] : Number(parts[d.key]); if (d.values.includes(v)) state[d.key] = v; } });
  }

  function tweaked(){ const p = PRESETS.find(x => x.id === presetId); return !p || DIALS.some(d => p.dials[d.key] !== state[d.key]); }

  function apply(){
    DIALS.forEach(d => scope.setAttribute('data-crt-' + d.key, state[d.key]));
    // presets
    document.querySelectorAll('#presets button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === presetId && !tweaked())));
    // dials
    document.querySelectorAll('#dials button').forEach(b => b.setAttribute('aria-pressed', String(String(state[b.dataset.key]) === b.dataset.value)));
    // recipe
    const p = PRESETS.find(x => x.id === presetId);
    const text = (p ? p.name.toUpperCase() : 'CUSTOM') + (tweaked() ? ' (tweaked)' : '') + ' · ' +
      DIALS.map(d => d.label.toLowerCase() + ' ' + state[d.key]).join(' · ');
    document.getElementById('recipe').textContent = text;
    const hash = 'preset=' + presetId + ',' + DIALS.map(d => d.key + '=' + state[d.key]).join(',');
    history.replaceState(null, '', '#' + hash);
  }

  // ---------------- controls ----------------
  const presetBox = document.getElementById('presets');
  PRESETS.forEach((p, n) => {
    const b = document.createElement('button');
    b.className = 'key'; b.type = 'button'; b.dataset.id = p.id;
    b.innerHTML = '<b>' + (n + 1) + ' ' + p.name + '</b><span>' + p.hint + '</span>';
    b.addEventListener('click', () => { presetId = p.id; state = Object.assign({}, p.dials); apply(); change(); });
    presetBox.appendChild(b);
  });
  const dialBox = document.getElementById('dials');
  DIALS.forEach(d => {
    const row = document.createElement('div'); row.className = 'dial';
    row.innerHTML = '<label>' + d.label + '</label><div class="seg">' +
      d.values.map(v => '<button class="key" type="button" data-key="' + d.key + '" data-value="' + v + '">' + v + '</button>').join('') + '</div>';
    dialBox.appendChild(row);
  });
  dialBox.addEventListener('click', e => {
    const b = e.target.closest('button[data-key]'); if (!b) return;
    const d = DIALS.find(x => x.key === b.dataset.key);
    state[d.key] = typeof d.values[0] === 'number' ? Number(b.dataset.value) : b.dataset.value;
    apply();
    if (d.key === 'change' || d.key === 'ghost') change();
  });

  document.getElementById('btn-change').addEventListener('click', change);
  let auto = null;
  const autoBtn = document.getElementById('btn-auto');
  const setAuto = on => { clearInterval(auto); auto = on ? setInterval(change, 3500) : null; autoBtn.setAttribute('aria-pressed', String(on)); };
  autoBtn.addEventListener('click', () => setAuto(!auto));
  document.getElementById('btn-glitch').addEventListener('click', () => screens.forEach(s => s.els.forEach(el => CRT.glitch(el))));
  document.getElementById('btn-copy').addEventListener('click', () => {
    const t = document.getElementById('recipe').textContent;
    const done = () => { const b = document.getElementById('btn-copy'); b.textContent = 'Copied'; setTimeout(() => b.textContent = 'Copy', 1200); };
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(done, () => {});
  });
  document.getElementById('theme').addEventListener('change', e => { document.documentElement.dataset.theme = e.target.value; });
  const motionBtn = document.getElementById('btn-motion');
  motionBtn.addEventListener('click', () => {
    const on = motionBtn.getAttribute('aria-pressed') !== 'true';
    motionBtn.setAttribute('aria-pressed', String(on));
    if (on) scope.setAttribute('data-motion', 'off'); else scope.removeAttribute('data-motion');
  });

  // A prototype crackle for content changes (Web Audio, short filtered noise).
  // If chosen, it moves into the game's Sound module.
  let audio = null;
  const soundBtn = document.getElementById('btn-sound');
  soundBtn.addEventListener('click', () => {
    const on = soundBtn.getAttribute('aria-pressed') !== 'true';
    soundBtn.setAttribute('aria-pressed', String(on));
    if (on && !audio){ try{ audio = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){} }
    if (audio && audio.state === 'suspended') audio.resume();
  });
  let lastCrackle = 0;
  CRT.onChange = () => {
    if (!audio || soundBtn.getAttribute('aria-pressed') !== 'true') return;
    const now = audio.currentTime; if (now - lastCrackle < 0.05) return; lastCrackle = now;
    const len = Math.floor(audio.sampleRate * 0.07), buf = audio.createBuffer(1, len, audio.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
    const src = audio.createBufferSource(); src.buffer = buf;
    const f = audio.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = .8;
    const g = audio.createGain(); g.gain.value = .05;
    src.connect(f).connect(g).connect(audio.destination); src.start();
  };

  fromHash();
  apply();
  setAuto(!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches));
})();
