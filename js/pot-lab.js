"use strict";

/* ============================================================
   POT LAB — the controls, inside the game (phone-first)

   Runs in the game copy pot-lab.html builds (its host is the Showdown
   Lab's, js/showdown-lab-host.js). The pot work itself is already in the
   game (js/coin-world.js: potSlots, trayBox/holdIn; js/coin-table.js: the
   rake and the tap); this only drives it:
   - a TUNE key opens a bottom sheet: MOMENTS deal a fresh table and play
     it to a pot (small, big, huge, built over every street, an opponent
     raking it in); THE POT picks the shape and its odds
   - a TIDY key next to it tidies the pot the way a tap on the empty felt
     does (a new shape each press), and reads which shape it built
   Picks go to CoinWorld.OPT at once and to the host, so they survive the
   reload every moment starts with.
   ============================================================ */
(() => {
  const host = (() => { try{ return parent !== window && parent.__lab ? parent.__lab : null; }catch(e){ return null; } })();
  const state = host ? host.state : { opp:'3', sound:'on', moment:null };
  const CW = () => window.CoinWorld;
  const $id = id => document.getElementById(id);

  /* ---- the pot's picks (every row's first option is the game's default) ---- */
  const ODDS = [['3','OFTEN'],['2','SOMETIMES'],['1','RARELY'],['0','NEVER']];
  const ROWS = [
    ['shape','SHAPE', [['mix','MIX'],['pyramid','PYRAMID'],['heap','HEAP'],['rows','NEAT'],['towers','TOWERS']], 'MIX picks one each hand from the odds below. The others force one, to look at it on its own.'],
    ['every','NEW SHAPE', [['hand','EACH HAND'],['tidy','EVERY TIDY']], 'EACH HAND: the pile keeps its shape while it grows, street by street. EVERY TIDY: it can change each time it tidies.'],
    ['tap','TAP THE FELT', [['on','RESHAPES'],['off','ONLY TIDIES']], 'A tap on the empty felt tidies the pot. RESHAPES: it picks a new shape as it does.'],
    ['pyramid','PYRAMID', ODDS], ['heap','HEAP', ODDS], ['rows','NEAT', ODDS], ['towers','TOWERS', ODDS]
  ];
  const DEFAULTS = { shape:'mix', every:'hand', tap:'on', pyramid:'3', heap:'3', rows:'2', towers:'1' };
  const NAMES = { pyramid:'PYRAMID', heap:'HEAP', rows:'NEAT', towers:'TOWERS' };
  let pot = Object.assign({}, DEFAULTS, state.pot || {});
  function apply(){
    const O = CW() && CW().OPT; if (!O) return;
    O.potShape = pot.shape; O.potEvery = pot.every; O.potTap = pot.tap;
    O.potMix = { pyramid:+pot.pyramid, heap:+pot.heap, rows:+pot.rows, towers:+pot.towers };
    if (host) host.set({ pot:Object.assign({}, pot) });
  }

  /* ---- the keys and the sheet ---- */
  const MOMENTS = [
    ['small','SMALL POT'], ['big','BIG POT'], ['huge','HUGE POT'], ['streets','EVERY STREET'],
    ['theywin','THEY WIN IT', true], ['out','PLAY IT OUT', true]
  ];
  const seg = (key, opts, cur) => '<div class="sdl-seg" data-key="' + key + '">' + opts.map(o => '<button type="button" data-v="' + o[0] + '"' + (o[0] === cur ? ' class="is-on"' : '') + '>' + o[1] + '</button>').join('') + '</div>';
  const row = r => '<div class="sdl-row"><div class="sdl-name">' + r[1] + '</div>' + seg(r[0], r[2], r[0] === 'opp' || r[0] === 'sound' ? state[r[0]] : pot[r[0]]) + (r[3] ? '<p class="sdl-note">' + r[3] + '</p>' : '') + '</div>';
  let tidyKey = null;
  function build(){
    const key = document.createElement('button');
    key.type = 'button'; key.className = 'sdl-key'; key.textContent = 'TUNE';
    tidyKey = document.createElement('button');
    tidyKey.type = 'button'; tidyKey.className = 'sdl-key sdl-again-key'; tidyKey.textContent = 'TIDY';
    const sheet = document.createElement('div');
    sheet.className = 'sdl-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Pot lab');
    sheet.innerHTML =
      '<div class="sdl-tabs" role="tablist">' +
        '<button type="button" data-tab="moments" class="is-on">MOMENTS</button><button type="button" data-tab="pot">THE POT</button>' +
        '<button type="button" class="sdl-close" aria-label="Close">✕</button></div>' +
      '<div class="sdl-body">' +
        '<section data-pane="moments"><p class="sdl-sub">Each deals a fresh table and plays it until the pot is built, then hands it back to you: play on, or tap the empty felt (or TIDY) to tidy it into a new shape. THEY WIN IT: you fold and watch an opponent rake it in.</p>' +
          '<div class="sdl-moments">' + MOMENTS.map(m => '<button type="button" data-moment="' + m[0] + '"' + (m[2] ? ' class="is-wide"' : '') + '>' + m[1] + '</button>').join('') + '</div>' +
          '<h3>THE TABLE</h3>' + row(['opp','OPPONENTS', [['2','2'],['3','3'],['4','4'],['5','5']]]) + row(['sound','SOUND', [['on','ON'],['off','OFF']]]) +
        '</section>' +
        '<section data-pane="pot" hidden><h3>THE SHAPE<small>How the pile builds when it tidies.</small></h3>' + ROWS.slice(0, 3).map(row).join('') +
          '<h3>THE MIX<small>How often MIX picks each one.</small></h3>' + ROWS.slice(3).map(row).join('') +
          '<div class="sdl-actions"><button type="button" data-act="reset">START OVER</button><button type="button" data-act="copy">COPY MY PICKS</button></div>' +
          '<textarea class="sdl-copytext" readonly hidden></textarea></section>' +
      '</div>';
    document.body.appendChild(key); document.body.appendChild(tidyKey); document.body.appendChild(sheet);
    const open = on => { sheet.classList.toggle('is-open', on); key.classList.toggle('is-on', on); };
    key.addEventListener('click', () => open(!sheet.classList.contains('is-open')));
    tidyKey.addEventListener('click', () => { open(false); tidy(); });
    sheet.querySelector('.sdl-close').addEventListener('click', () => open(false));
    sheet.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.tab){
        sheet.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('is-on', b === t));
        sheet.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== t.dataset.tab; });
        return;
      }
      if (t.dataset.moment){
        const m = t.dataset.moment; open(false);
        if (m === 'out' || !host) run(m); else host.play(m);
        return;
      }
      const s = t.closest('.sdl-seg');
      if (s){
        const k = s.dataset.key, v = t.dataset.v;
        if (k === 'opp' || k === 'sound'){
          state[k] = v; if (host) host.set({ [k]:v });
          if (k === 'sound') try{ settings.sound = v === 'on'; }catch(err){}
        } else {
          pot[k] = v; apply();
          // a new SHAPE shows at once on the pile that's there
          if (k === 'shape' && CW().zones.pot && CW().zones.pot.list.length){ CW().newPotShape(); retidy(); }
        }
        s.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b === t));
        return;
      }
      if (t.dataset.act === 'reset'){ pot = Object.assign({}, DEFAULTS); apply(); paint(); return; }
      if (t.dataset.act === 'copy'){
        const text = 'The pot:\n' + ROWS.map(r => '- ' + r[1] + ': ' + (r[2].find(o => o[0] === pot[r[0]]) || ['', pot[r[0]]])[1]).join('\n');
        const ta = sheet.querySelector('.sdl-copytext');
        const done = ok => { t.textContent = ok ? 'COPIED' : 'SELECT + COPY BELOW'; setTimeout(() => { t.textContent = 'COPY MY PICKS'; }, 2200); if (!ok){ ta.hidden = false; ta.value = text; ta.focus(); ta.select(); } };
        try{ navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); }catch(err){ done(false); }
      }
    });
  }
  function paint(){
    document.querySelectorAll('.sdl-seg').forEach(s => {
      const k = s.dataset.key, cur = k === 'opp' || k === 'sound' ? state[k] : pot[k];
      s.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b.dataset.v === cur));
    });
  }
  // the TIDY key reads the shape the pile is in (or will be, once it tidies)
  function label(){ if (tidyKey) tidyKey.textContent = 'TIDY · ' + (NAMES[CW() && CW().potShape()] || '—'); }
  setInterval(label, 400);
  // the TIDY key is a tap on the empty felt
  function tidy(){
    const z = CW() && CW().zones.pot; if (!z || !z.list.length || CW().zoneBusy(z) || z.tidying) return;
    if (pot.tap === 'on') CW().newPotShape(CW().potShape());
    retidy();
  }
  function retidy(){
    const z = CW().zones.pot; if (!z || CW().zoneBusy(z) || z.tidying) return;
    z.neat = false; CW().tidyZone(z); label();
  }

  /* ---- moments: the real game, played until the pot is built ---- */
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function waitFor(test, ms){ const end = performance.now() + ms; while (performance.now() < end){ try{ if (test()) return true; }catch(e){} await sleep(60); } return false; }
  const setDev = on => { DEV_MODE = !!on; FAST_DEV = false; };
  const opps = () => game.players.filter(p => !p.isHuman && !p.eliminated);
  const myTurn = () => !!(game && !game.over && pendingHumanPlayer && !$id('actions-row').classList.contains('disabled') && !$id('console-flip').classList.contains('flipped'));
  const passive = () => { const call = game.currentBet - pendingHumanPlayer.betThisRound; humanAct(call > 0 ? 'call' : 'check'); };
  async function deal(need){
    startSinglePlayerRun({ opponentCount:Math.max(Number(state.opp) || 3, need || 1) });
    if (!await waitFor(myTurn, 40000)) throw new Error('the deal never reached your turn');
    await sleep(200);
  }
  function foldAllBut(keep){
    opps().forEach(p => { if (!keep.includes(p) && p.inHand && !p.folded && !p.allIn) applyAction(p, { action:'fold' }); });
    render();
  }
  async function seat(n){
    for (let tries = 0; tries < 6; tries++){
      await deal(n + (tries > 1 ? 1 : 0));
      const ins = opps().filter(p => p.inHand && !p.folded && !p.allIn);
      if (ins.length >= n){ const pick = ins.slice(0, n); foldAllBut(pick); return pick; }
    }
    throw new Error('could not seat ' + n + ' rivals');
  }
  const setStack = (p, bb) => { p.chips = Math.max(1, Math.round(bb * game.bigBlind) - p.betThisRound); render(); };
  // you raise to betBB each street (or just call/check) and the rivals call,
  // until the board
  // has `cards` on it and it's your turn again
  async function grow(rivals, betBB, cards){
    setDev(true);
    await waitFor(() => {
      rivals.forEach(p => { if (!p.folded && !p.allIn) p._devAutoCall = true; });
      if (game.board.length >= cards && myTurn()) return true;
      if (myTurn()){
        if (betBB && game.currentBet < Math.round(betBB * game.bigBlind)){
          const b = wagerBounds(game, pendingHumanPlayer);
          humanAct('raise', Math.max(b.min, Math.min(b.max, Math.round(betBB * game.bigBlind))));
        } else passive();
      }
      return game.phase === 'showdown' || game.phase === 'foldwin' || game.over;
    }, 90000);
    setDev(false);
  }
  const PLAYS = {
    async small(){ const r = await seat(Math.min(3, Number(state.opp) || 3)); await grow(r, 0, 3); },
    async big(){ const r = await seat(Math.min(3, Number(state.opp) || 3)); await grow(r, 5, 3); },
    async huge(){ const r = await seat(Math.min(4, Math.max(3, Number(state.opp) || 3))); r.concat(game.players.filter(p => p.isHuman)).forEach(p => setStack(p, 60)); await grow(r, 16, 3); },
    async streets(){ const r = await seat(2); await grow(r, 3, 5); },
    async theywin(){
      const r = await seat(2); r.forEach(p => setStack(p, 40));
      await grow(r, 5, 3);
      setDev(true);
      if (myTurn()) humanAct('fold');
      await waitFor(() => { r.forEach(p => { if (!p.folded && !p.allIn) p._devAutoCall = true; }); return game.phase === 'showdown' || game.over; }, 60000);
      setDev(false);
    },
    async out(){
      if (!game || game.over) return;
      await waitFor(() => { if (myTurn()) passive(); return game.phase === 'showdown' || game.phase === 'foldwin' || game.over; }, 90000);
    }
  };
  let busy = false;
  async function run(m){
    if (busy || !PLAYS[m]) return;
    busy = true;
    try{ await PLAYS[m](); }catch(err){ console.error(err); }
    finally{ busy = false; }
  }
  window.__potLab = { run, tidy, get pot(){ return Object.assign({}, pot); }, set(o){ Object.assign(pot, o); apply(); paint(); }, get busy(){ return busy; } };

  /* ---- start ---- */
  function start(){
    try{ if (typeof TableIntro !== 'undefined') TableIntro.uninstall(); }catch(e){}
    try{ settings.sound = state.sound !== 'off'; }catch(e){}
    apply();
    build();
    label();
    const m = state.moment;
    if (host) host.set({ moment:null });
    run(m || 'big');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})();
