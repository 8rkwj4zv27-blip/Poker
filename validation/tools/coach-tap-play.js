"use strict";
/* P.I.P., tap only, in the REAL game (docs/coach/BRAIN_PLAN.md, "Tap only").

   Plays real hands in an emulated iPhone with P.I.P. switched on, and taps
   his screen (a real touch) at the awkward moments: your turn, their
   turn, your cards still face down, an all in running out, the showdown
   before the result, the result, and between hands. Every bubble he shows
   is logged with what the table was doing at that moment. Fails on:
     - anything said without a tap (he only talks when tapped);
     - a read of your cards before they're turned over;
     - anything but "wait and see" while an all in runs out or before the
       result is on screen;
     - a verdict for the wrong hand.

   Needs a local server (python3 -m http.server 8765) and Playwright
   (NODE_PATH=$(npm root -g)). Usage:
     node validation/tools/coach-tap-play.js [seconds=300] */
const { withPage } = require('./touch-harness');
const SECONDS = +process.argv[2] || 300;

(async () => {
  const problems = [], said = [];
  let taps = 0;
  await withPage({ width:390, height:844 }, async (page, touch) => {
    await page.goto('http://localhost:8765/index.html?dev');
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('felt.settings', JSON.stringify({ coachBot:true })); });
    await page.reload(); await page.waitForTimeout(2800); await page.mouse.click(200, 5); await page.waitForTimeout(600);
    await page.evaluate(() => {
      window.__pip = { lastTap:0, said:[] };
      // his taps: the document click he listens for
      document.addEventListener('click', e => { if (e.target.closest && e.target.closest('#coach-station')) window.__pip.lastTap = performance.now(); }, true);
      const state = () => {
        const g = game, me = g.players.find(p => p.isHuman);
        const flip = document.getElementById('console-flip'), btn = document.getElementById('btn-award-pot-console'), face = document.getElementById('console-face-award');
        const live = g.players.filter(p => p.inHand && !p.folded);
        const free = live.filter(p => !p.allIn && p.chips > 0);
        return { hand:g.handNumber, phase:g.phase, board:(g.board || []).length, hidden:g._humanCardsVisible === false,
          result: !!(flip && flip.classList.contains('flipped') && btn && !btn.disabled && !(face && face.classList.contains('sd-lit'))),
          runout: live.length > 1 && live.some(p => p.allIn) && (free.length === 0 || (free.length === 1 && free[0].betThisRound >= (g.currentBet || 0))),
          inHand: !!(me && me.inHand && !me.folded), last: (CoachBrain.history.slice(-1)[0] || {}).n };
      };
      new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => {
        if (!n.classList || !n.classList.contains('ctk')) return;
        const s = state();
        setTimeout(() => window.__pip.said.push({ t:performance.now(), sinceTap:Math.round(performance.now() - window.__pip.lastTap), moment:n.dataset.moment, text:n.textContent.trim(), at:s }), 30);
      }))).observe(document.body, { childList:true, subtree:true });
      startSinglePlayerRun();
    });
    const tapHim = async () => {
      const r = await page.evaluate(() => { const e = document.querySelector('#coach-station'); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
      if (!r) return;
      await touch.start(r[0], r[1]); await page.waitForTimeout(60); await touch.end();
      taps++;
    };
    const t0 = Date.now();
    let lastHand = -1, mode = 'call';
    while (Date.now() - t0 < SECONDS * 1000){
      await page.waitForTimeout(700 + Math.random() * 900);
      const st = await page.evaluate(() => ({ hn:game.handNumber, pend: typeof pendingHumanPlayer !== 'undefined' && !!pendingHumanPlayer,
        flip: !!document.querySelector('#console-flip.flipped'), live: !!(document.getElementById('btn-award-pot-console') && !document.getElementById('btn-award-pot-console').disabled),
        over: !!game.over, out: !!(game.players.find(p => p.isHuman) || {}).eliminated }));
      if (st.over || st.out){ await page.evaluate(() => { try{ startSinglePlayerRun(); }catch(e){} }); await page.waitForTimeout(3000); continue; }
      if (st.hn !== lastHand){ lastHand = st.hn; mode = Math.random() < 0.3 ? 'allin' : Math.random() < 0.5 ? 'call' : 'fold'; }
      // tap him now and then, whatever is going on (and sometimes twice)
      if (Math.random() < 0.55){ await tapHim(); if (Math.random() < 0.3){ await page.waitForTimeout(500); await tapHim(); } }
      if (st.pend){
        await page.waitForTimeout(300);
        await page.evaluate(m => { try{ humanAct(m); }catch(e){ try{ humanAct('call'); }catch(e2){} } }, mode === 'fold' && Math.random() < 0.5 ? 'call' : mode);
      }
      if (st.flip && st.live){
        await page.waitForTimeout(1200);
        if (Math.random() < 0.7) await tapHim();
        await page.waitForTimeout(1200);
        await page.evaluate(() => { const b = document.getElementById('btn-award-pot-console'); if (b && !b.disabled) b.click(); });
        await page.waitForTimeout(800);
        if (Math.random() < 0.5) await tapHim();   // between hands
      }
    }
    said.push(...await page.evaluate(() => window.__pip.said));
    const errs = (page._errors || []).filter(e => !/coin-bank|reading 'build'/.test(e));
    if (errs.length) problems.push('page errors: ' + errs.join(' | ').slice(0, 600));
  });
  // ---- judge the log ----
  said.forEach(s => {
    const a = s.at, tag = '[hand ' + a.hand + ' ' + a.phase + ' board ' + a.board + (a.hidden ? ' HIDDEN' : '') + (a.runout ? ' RUNOUT' : '') + (a.result ? ' RESULT' : '') + '] ' + s.moment + ': ' + s.text;
    if (s.sinceTap > 400) problems.push('said without a tap (' + s.sinceTap + 'ms after the last): ' + tag);
    if (a.hidden && a.inHand && !a.result && s.moment !== 'read.cards' && s.moment !== 'tap.done') problems.push('spoke about the hand with your cards face down: ' + tag);
    // (before the result: not once the hand's been settled, nor while the next is dealt)
    if ((a.runout || a.phase === 'showdown') && a.inHand && !a.result && !a.hidden && a.last !== a.hand && !/^(read\.wait|tap\.done)$/.test(s.moment)) problems.push('spoiler while the cards run out: ' + tag);
    if ((a.phase === 'showdown') && a.last === a.hand && !a.result && !a.hidden && s.moment === 'read.wait') problems.push('"wait" after the result was shown: ' + tag);
    if (s.moment === 'tap.verdict' && a.result && a.last !== a.hand) problems.push('a verdict for another hand: ' + tag);
  });
  console.log('taps ' + taps + ', bubbles ' + said.length);
  said.forEach(s => console.log('  ' + (s.at.result ? 'RESULT ' : s.at.runout ? 'RUNOUT ' : s.at.hidden ? 'HIDDEN ' : '') + 'h' + s.at.hand + ' ' + s.at.phase + '/' + s.at.board + ' ' + s.moment + ': ' + s.text.slice(0, 140)));
  console.log(problems.length ? '\nPROBLEMS (' + problems.length + '):\n' + problems.join('\n') : '\nNo problems.');
  process.exit(problems.length ? 1 : 0);
})();
