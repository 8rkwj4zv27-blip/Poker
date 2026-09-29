"use strict";

/* ============================================================
   SKIN LAB — the controls, inside the game (the card pilot, phone-first)

   Runs in the game copy the host page (skin-lab.html,
   js/skin-lab-host.js) builds. A SKIN key opens a bottom sheet:

   TEMPLATES  the game's own cards cut into drawing templates (made by
              validation/tools/skin-cards-export.js from the real game):
              per size, the back, a blank face and the index sheet (plus
              the sheet with its cells shaded, to draw over). Save one, or
              all of them in one .zip.
   YOUR ART   load a drawing into each slot from the phone; the table's
              cards wear it at once (js/card-skin.js). SHOW flips between
              your art, the templates (which must look exactly like the
              game), a loud DEMO recolour, and the game's own cards. HAND
              IN sends your drawings to Claude.
   LOOK       deal to the moments where cards show: a new hand, the
              river, a showdown with everyone's cards up, and the whole
              deck spread out.

   Everything plays the real game; only the pictures on the cards change.
   ============================================================ */
(() => {
  const host = (() => { try{ return parent !== window && parent.__lab ? parent.__lab : null; }catch(e){ return null; } })();
  const state = host ? host.state : { art:{}, show:'yours', opp:'3', tab:'templates' };
  const set = patch => { Object.assign(state, patch); if (host) host.set(patch); };
  const $id = id => document.getElementById(id);
  const BASE = 'assets/skin/templates/cards/';
  const TIERS = [['L', 'YOUR HAND', 'The two cards in your holder.'], ['M', 'BOARD + DECK', 'The five on the table, and the deck.'], ['S', 'OPPONENTS', 'Their cards, tucked and at a showdown (shown a bit bigger).']];
  const PARTS = [['back', 'BACK'], ['face', 'BLANK FACE'], ['index', 'INDEX SHEET']];
  let manifest = null;
  const templates = {}, demo = {}, art = {};

  /* ---------------- pictures ---------------- */
  const img = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('image ' + String(src).slice(0, 60))); i.src = src; });
  async function loadTemplates(){
    manifest = await (await fetch(BASE + 'cards.json', { cache:'no-store' })).json();
    await Promise.all(TIERS.flatMap(([t]) => PARTS.map(async ([p]) => { templates[t + '-' + p] = await img(BASE + 'cards-' + t + '-' + p + '.png'); })));
    // the DEMO: the templates with their colours swapped round, loud enough
    // that nobody mistakes it for the game's own cards
    for (const [k, im] of Object.entries(templates)){
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height);
      for (let i = 0; i < d.data.length; i += 4){ const r = d.data[i], g = d.data[i + 1], b = d.data[i + 2]; d.data[i] = b; d.data[i + 1] = r; d.data[i + 2] = g; }
      x.putImageData(d, 0, 0);
      demo[k] = await img(c.toDataURL('image/png'));
    }
  }
  async function loadArt(){
    for (const [k, url] of Object.entries(state.art || {})){ try{ art[k] = await img(url); }catch(e){ delete art[k]; } }
  }
  function apply(){
    if (!manifest) return;
    if (state.show === 'off') CardSkin.off();
    else CardSkin.set({ manifest, templates, art:state.show === 'demo' ? demo : state.show === 'templates' ? {} : art });
  }

  /* ---------------- files ---------------- */
  const fileName = (t, p, guide) => 'cards-' + t + '-' + p + (guide ? '-guide' : '') + '.png';
  const toBlob = async src => (await fetch(src)).blob();
  // a .zip with nothing squashed (store only): every template in one save
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++){ let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(files){   // [{ name, data:Uint8Array }]
    const enc = new TextEncoder(), parts = [], dir = [];
    let off = 0;
    for (const f of files){
      const name = enc.encode(f.name), crc = crc32(f.data), n = f.data.length;
      const head = new DataView(new ArrayBuffer(30));
      [[0, 0x04034b50, 4], [4, 20, 2], [6, 0, 2], [8, 0, 2], [10, 0, 2], [12, 0x21, 2], [14, crc, 4], [18, n, 4], [22, n, 4], [26, name.length, 2], [28, 0, 2]]
        .forEach(([o, v, s]) => s === 4 ? head.setUint32(o, v, true) : head.setUint16(o, v, true));
      parts.push(new Uint8Array(head.buffer), name, f.data);
      const cd = new DataView(new ArrayBuffer(46));
      [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0, 2], [10, 0, 2], [12, 0, 2], [14, 0x21, 2], [16, crc, 4], [20, n, 4], [24, n, 4], [28, name.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, off, 4]]
        .forEach(([o, v, s]) => s === 4 ? cd.setUint32(o, v, true) : cd.setUint16(o, v, true));
      dir.push(new Uint8Array(cd.buffer), name);
      off += 30 + name.length + n;
    }
    const dirLen = dir.reduce((s, p) => s + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    [[0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2], [8, files.length, 2], [10, files.length, 2], [12, dirLen, 4], [16, off, 4], [20, 0, 2]]
      .forEach(([o, v, s]) => s === 4 ? end.setUint32(o, v, true) : end.setUint16(o, v, true));
    return new Blob([...parts, ...dir, new Uint8Array(end.buffer)], { type:'application/zip' });
  }
  async function save(name, blob){
    say(host ? 'Saving ' + name + '…' : 'Saving…');
    const r = host ? await host.save(name, blob) : 'failed:no host';
    say(r === 'saved' ? 'Saved ' + name + '.' : r === 'declined' ? 'Not saved.' : 'Couldn\'t save (' + r.replace(/^failed:/, '') + ').');
  }
  async function saveAll(){
    const list = ['cards.json'];
    TIERS.forEach(([t]) => { PARTS.forEach(([p]) => list.push(fileName(t, p))); list.push(fileName(t, 'index', true)); });
    const files = [];
    for (const n of list) files.push({ name:'card-templates/' + n, data:new Uint8Array(await (await fetch(BASE + n)).arrayBuffer()) });
    files.push({ name:'card-templates/READ ME.txt', data:new TextEncoder().encode(README()) });
    await save('card-templates.zip', zip(files));
  }
  const README = () => [
    'THE TABLE: CARD TEMPLATES',
    '',
    'Three sizes, each drawn in three parts. Draw over each file at exactly',
    'the same size (or exactly 2x or 3x it, for finer pixels). Keep the',
    'transparent parts transparent.',
    '',
    ...TIERS.map(([t, n]) => { const m = manifest.tiers[t]; return '  ' + t + '  ' + n + ': cards ' + m.w + 'x' + m.h + ', index sheet ' + m.sheet.w + 'x' + m.sheet.h; }),
    '',
    'cards-?-back.png          the whole back of a card',
    'cards-?-face.png          a blank face: edge, paper, highlight; no rank or suit',
    'cards-?-index.png         row 1: A 2 3 4 5 6 7 8 9 10 J Q K in black',
    '                          row 2: the same in red',
    '                          row 3: the small suits  spade heart diamond club',
    '                          row 4: the big pips, same order',
    'cards-?-index-guide.png   the index sheet with every cell shaded. Keep it',
    '                          on a layer under your drawing: whatever you draw',
    '                          outside a shaded cell never reaches a card.',
    '',
    'The game builds each card from these: the blank face, then the rank, the',
    'small suit and the big pip, in the same places the game uses today.',
    'Only drew one size? It is used for the others too, scaled.',
    '',
    'Then open the Skin Lab, SKIN > YOUR ART, load each drawing into its slot,',
    'and play. HAND IN sends them to Claude.'
  ].join('\n');

  /* ---------------- your drawings ---------------- */
  function status(key){
    const im = art[key];
    if (!im) return { cls:'', text:'—' };
    const c = CardSkin.check(key, im), w = c.want;
    if (c.ok) return { cls:'is-ok', text:im.naturalWidth + '×' + im.naturalHeight + (c.k > 1 ? ' · ' + c.k + '×' : '') + ' ✓' };
    return { cls:'is-bad', text:im.naturalWidth + '×' + im.naturalHeight + ': should be ' + w.w + '×' + w.h + ' (or 2×, 3×). Stretched to fit.' };
  }
  function pickFile(key){
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/png,image/*';
    input.style.cssText = 'position:fixed;left:-9999px;top:0';
    input.addEventListener('change', async () => {
      const f = input.files && input.files[0]; input.remove();
      if (!f) return;
      const url = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(f); });
      try{
        let im = await img(url);
        // anything but a PNG (a photo's JPEG, a HEIC turned JPEG) is kept as a PNG
        let keep = url;
        if (!/^data:image\/png/.test(url)){
          const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
          c.getContext('2d').drawImage(im, 0, 0); keep = c.toDataURL('image/png'); im = await img(keep);
        }
        art[key] = im;
        set({ art:Object.assign({}, state.art, { [key]:keep }), show:'yours' });
        apply(); paint();
        const s = status(key);
        say(s.cls === 'is-bad' ? 'Loaded, but ' + s.text : 'Loaded. The cards are wearing it now.');
      }catch(e){ say('That file didn\'t open as a picture.'); }
    }, { once:true });
    document.body.appendChild(input);
    input.click();
  }
  function clear(key){
    delete art[key];
    const a = Object.assign({}, state.art); delete a[key];
    set({ art:a }); apply(); paint();
  }
  async function handIn(){
    const keys = Object.keys(art);
    if (!keys.length){ say('Load a drawing first.'); return; }
    say('Handing in ' + keys.length + ' drawing' + (keys.length > 1 ? 's' : '') + '…');
    const items = [];
    for (const k of keys) items.push({ key:k, blob:await toBlob(state.art[k]), w:art[k].naturalWidth, h:art[k].naturalHeight, note:status(k).text });
    const r = host ? await host.handIn(items) : { ok:false, why:'no host' };
    say(r.ok ? 'Handed in: ' + r.done.join(', ') + '. Tell Claude they\'re in.' : 'Couldn\'t hand in (' + r.why + ')' + (r.done && r.done.length ? '; these got through: ' + r.done.join(', ') : '') + '.');
  }

  /* ---------------- the sheet ---------------- */
  const seg = (key, opts, cur) => '<div class="skl-seg" data-key="' + key + '">' + opts.map(o => '<button type="button" data-v="' + o[0] + '"' + (o[0] === cur ? ' class="is-on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
  let sheet, key;
  function build(){
    key = document.createElement('button');
    key.type = 'button'; key.className = 'skl-key'; key.textContent = 'SKIN';
    sheet = document.createElement('div');
    sheet.className = 'skl-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Skin lab');
    document.body.appendChild(key); document.body.appendChild(sheet);
    key.addEventListener('click', () => open(!sheet.classList.contains('is-open')));
    sheet.addEventListener('click', onClick);
    paint();
  }
  const open = on => { sheet.classList.toggle('is-open', on); key.classList.toggle('is-on', on); };
  function thumb(src, w, h, label, act, cls){
    // shown at a whole number of screen pixels per template pixel
    const z = Math.max(1, Math.min(4, Math.floor(88 / Math.max(h, w * .7))));
    return '<button type="button" class="skl-thumb ' + (cls || '') + '" data-act="' + act + '">' +
      '<span class="skl-img"><img alt="" src="' + src + '" style="width:' + (w * z) + 'px;height:' + (h * z) + 'px"></span>' +
      '<b>' + label + '</b></button>';
  }
  function paint(){
    if (!sheet) return;
    const tab = state.tab || 'templates';
    const m = manifest;
    let body = '';
    if (!m) body = '<p class="skl-sub">Loading the templates…</p>';
    else if (tab === 'templates'){
      body = '<p class="skl-sub"><b>1</b> Save the templates. <b>2</b> Draw over each one at the same size (or exactly 2× or 3×). <b>3</b> Load them in YOUR ART and watch the table wear them. <b>4</b> HAND IN sends them to Claude.</p>' +
        '<button type="button" class="skl-big" data-act="zip">SAVE ALL TEMPLATES (.ZIP)</button>' +
        TIERS.map(([t, name, sub]) => {
          const tm = m.tiers[t];
          return '<h3>' + name + ' · ' + tm.w + '×' + tm.h + '<small>' + sub + ' Tap a template to save it.</small></h3>' +
            '<div class="skl-thumbs">' +
              thumb(BASE + fileName(t, 'back'), tm.back.w, tm.back.h, 'BACK', 'save:' + fileName(t, 'back')) +
              thumb(BASE + fileName(t, 'face'), tm.w, tm.h, 'BLANK FACE', 'save:' + fileName(t, 'face')) +
            '</div>' +
            '<div class="skl-sheetrow">' +
              thumb(BASE + fileName(t, 'index'), tm.sheet.w, tm.sheet.h, 'INDEX SHEET · ' + tm.sheet.w + '×' + tm.sheet.h, 'save:' + fileName(t, 'index'), 'is-wide') +
              thumb(BASE + fileName(t, 'index', true), tm.sheet.w, tm.sheet.h, 'SHEET WITH CELLS SHADED (A GUIDE LAYER)', 'save:' + fileName(t, 'index', true), 'is-wide') +
            '</div>';
        }).join('') +
        '<p class="skl-note">The index sheet: black ranks A–K, red ranks, the four small suits, the four big pips. The game puts them on the blank face where it puts them now (a 10 pushes its suit over). Anything outside a shaded cell never reaches a card.</p>';
    }
    else if (tab === 'art'){
      body = '<div class="skl-row"><div class="skl-name">SHOW ON THE TABLE</div>' +
        seg('show', [['yours', 'YOUR ART'], ['templates', 'TEMPLATES'], ['demo', 'DEMO'], ['off', 'GAME\'S OWN']], state.show) +
        '<p class="skl-note">TEMPLATES should look exactly like the game (that is the check). DEMO is the templates recoloured, to see a swap at once. A part you haven\'t drawn shows the template.</p></div>' +
        TIERS.map(([t, name]) => {
          const tm = m.tiers[t];
          return '<h3>' + name + ' · ' + tm.w + '×' + tm.h + '</h3><div class="skl-slots">' + PARTS.map(([p, label]) => {
            const k = t + '-' + p, s = status(k), w = CardSkin.want(k);
            const src = state.art[k] || BASE + fileName(t, p);
            return '<div class="skl-slot ' + (state.art[k] ? 'has-art' : '') + '">' +
              '<div class="skl-slot-img"><img alt="" src="' + src + '"></div>' +
              '<div class="skl-slot-text"><b>' + label + '</b><span>' + w.w + '×' + w.h + '</span><span class="skl-st ' + s.cls + '">' + s.text + '</span></div>' +
              '<div class="skl-slot-keys"><button type="button" data-act="load:' + k + '">LOAD</button>' + (state.art[k] ? '<button type="button" class="is-dim" data-act="clear:' + k + '">CLEAR</button>' : '') + '</div>' +
            '</div>';
          }).join('') + '</div>';
        }).join('') +
        '<p class="skl-note">Only drew one size? It\'s used for the others too, scaled. Your drawings stay in this browser until you clear them.</p>' +
        '<button type="button" class="skl-big" data-act="handin"' + (caps.handin ? '' : ' disabled') + '>HAND IN TO CLAUDE</button>' +
        '<p class="skl-note">' + (caps.handin ? 'Sends each drawing you\'ve loaded, pixel for pixel, to this lab\'s link, where Claude can pick them up.' : 'Handing in works from the published lab link.') + '</p>';
    }
    else {
      body = '<p class="skl-sub">Deal to the moments where cards show. It\'s the real game; only the pictures change.</p>' +
        '<div class="skl-moments">' +
          '<button type="button" data-act="play:deal">NEW HAND</button>' +
          '<button type="button" data-act="play:river">TO THE RIVER</button>' +
          '<button type="button" data-act="play:showdown" class="is-wide">SHOWDOWN · EVERYONE\'S CARDS UP</button>' +
          '<button type="button" data-act="spread" class="is-wide">THE WHOLE DECK</button>' +
        '</div>' +
        '<h3>THE TABLE</h3><div class="skl-row"><div class="skl-name">OPPONENTS</div>' + seg('opp', [['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']], state.opp) + '</div>';
    }
    sheet.innerHTML =
      '<div class="skl-tabs" role="tablist">' +
        [['templates', 'TEMPLATES'], ['art', 'YOUR ART'], ['look', 'LOOK']].map(([k, n]) => '<button type="button" data-tab="' + k + '"' + (k === tab ? ' class="is-on"' : '') + '>' + n + '</button>').join('') +
        '<button type="button" class="skl-close" aria-label="Close">✕</button></div>' +
      '<div class="skl-body">' + body + '</div>' +
      '<div class="skl-say" aria-live="polite"></div>';
    if (lastSay) sheet.querySelector('.skl-say').textContent = lastSay;
  }
  let lastSay = '', sayTimer = 0;
  function say(t){
    lastSay = t;
    const el = sheet && sheet.querySelector('.skl-say');
    if (el) el.textContent = t;
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => { lastSay = ''; const e = sheet && sheet.querySelector('.skl-say'); if (e) e.textContent = ''; }, 6000);
  }
  async function onClick(e){
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.classList.contains('skl-close')){ open(false); return; }
    if (b.dataset.tab){ set({ tab:b.dataset.tab }); paint(); return; }
    const sg = b.closest('.skl-seg');
    if (sg){
      set({ [sg.dataset.key]:b.dataset.v }); paint();
      if (sg.dataset.key === 'show') apply();
      return;
    }
    const act = b.dataset.act || '';
    if (act === 'zip') return saveAll();
    if (act.startsWith('save:')){ const n = act.slice(5); return save(n, await toBlob(BASE + n)); }
    if (act.startsWith('load:')) return pickFile(act.slice(5));
    if (act.startsWith('clear:')) return clear(act.slice(6));
    if (act === 'handin') return handIn();
    if (act.startsWith('play:')){ open(false); return run(act.slice(5)); }
    if (act === 'spread'){ open(false); return spread(); }
  }

  /* ---------------- moments: the real game ---------------- */
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function waitFor(test, ms){ const end = performance.now() + ms; while (performance.now() < end){ try{ if (test()) return true; }catch(e){} await sleep(60); } return false; }
  const myTurn = () => !!(game && !game.over && pendingHumanPlayer && !$id('actions-row').classList.contains('disabled') && !$id('console-flip').classList.contains('flipped'));
  const passive = () => { const call = game.currentBet - pendingHumanPlayer.betThisRound; humanAct(call > 0 ? 'call' : 'check'); };
  const setDev = on => { DEV_MODE = !!on; FAST_DEV = false; };
  async function deal(){
    closeSpread();
    startSinglePlayerRun({ opponentCount:Number(state.opp) || 3 });
    if (!await waitFor(myTurn, 40000)) throw new Error('the deal never reached your turn');
  }
  const PLAYS = {
    async deal(){ await deal(); },
    // everyone calls to the river, which stops on your turn
    async river(){
      await deal();
      setDev(true);
      await waitFor(() => {
        game.players.forEach(p => { if (!p.isHuman && !p.folded && !p.allIn) p._devAutoCall = true; });
        if (game.board.length === 5 && myTurn()) return true;
        if (myTurn()) passive();
        return game.phase === 'showdown' || game.over;
      }, 60000);
      setDev(false);
    },
    // everyone all in: every hand turns face up
    async showdown(){
      await deal();
      setDev(true);
      game.players.forEach(p => { if (!p.isHuman && !p.folded) p._devForceAllIn = true; });
      if (myTurn()) humanAct('allin');
      await waitFor(() => { if (myTurn()) passive(); return game.phase === 'showdown' || game.over; }, 60000);
      setDev(false);
    }
  };
  let busy = false;
  async function run(m){
    if (busy || !PLAYS[m]) return;
    busy = true;
    try{ await PLAYS[m](); }catch(err){ console.error(err); say('That moment didn\'t play: ' + (err.message || err)); }
    finally{ busy = false; }
  }
  // the whole deck, spread on the felt: 52 real card elements at the
  // board's size, and a back (tap to put it away)
  function spread(){
    closeSpread();
    const wrap = document.createElement('div');
    wrap.className = 'skl-spread'; wrap.id = 'skl-spread';
    const cards = [];
    for (const s of SUITS) for (const r of ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'])
      cards.push('<div class="' + cardClass(false, { rank:r, suit:s }, false) + '" role="img" aria-label="' + r + s + '">' + cardInner({ rank:r, suit:s }) + '</div>');
    cards.push('<div class="card back" role="img" aria-label="Card back"></div>');
    wrap.innerHTML = '<p>THE WHOLE DECK · BOARD SIZE · TAP TO CLOSE</p><div class="skl-grid">' + cards.join('') + '</div>';
    wrap.addEventListener('click', closeSpread);
    document.body.appendChild(wrap);
  }
  function closeSpread(){ const s = $id('skl-spread'); if (s) s.remove(); }

  /* ---------------- start ---------------- */
  const caps = { downloads:false, handin:false };
  async function start(){
    try{ if (typeof TableIntro !== 'undefined') TableIntro.uninstall(); }catch(e){}
    try{ settings.sound = false; }catch(e){}
    build();
    try{ await loadTemplates(); await loadArt(); apply(); }
    catch(err){ console.error(err); say('The templates didn\'t load: ' + (err.message || err)); }
    paint();
    if (host) host.caps().then(c => { Object.assign(caps, c); paint(); });
    run('deal');
  }
  window.__skinLab = { run, spread, apply, get state(){ return state; }, get ready(){ return !!manifest; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})();
