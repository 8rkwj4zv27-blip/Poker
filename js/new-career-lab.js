"use strict";

/* ============================================================
   NEW CAREER LAB — the controls, inside the game (new-career-lab.html)

   For the owner's sign-off on v0.71.0 on the phone: the event clock (it
   finds a clear spot; pick it up, put it anywhere, flick it) and the
   curated tray (keep as many as you like; REDEAL deals onto the felt;
   carry a card out of the album). The copy starts on a new Career made
   up for it: $500, one card of every event (two Back Rooms), three of
   them on the tray. A LAB key opens a sheet: what to try, a card for any
   event straight to its table, and a fresh start.
   ============================================================ */
(() => {
  if (typeof NEW_CAREER === 'undefined' || !NEW_CAREER || !window.CareerLink) return;
  const host = (() => { try{ return parent !== window && parent.__newCareerLab ? parent.__newCareerLab : null; }catch(e){ return null; } })();

  // the made-up Career, the first time this copy loads
  if (!careerInvitations().length && !career.starterGiven){
    const ids = CAREER_INVITATION_EVENTS.map(e => e.id).concat(['back-room-invite']);
    career.invitations = ids.map((ev, i) => ({ id:'inv-lab' + i, eventId:ev, rarity:careerEventById(ev).rarity, roster:null, addedAt:i }));
    career.tray = [{ id:'inv-lab0', x:.08 }, { id:'inv-lab3', x:.5 }, { id:'inv-lab9', x:.92 }];
    career.starterGiven = true;
    saveCareer();
  }

  const key = document.createElement('button');
  key.className = 'ncl-key'; key.type = 'button'; key.textContent = 'LAB';
  const sheet = document.createElement('section');
  sheet.className = 'ncl-sheet'; sheet.hidden = true;
  const card = ev => careerEventById(ev);
  sheet.innerHTML = `
    <h2>NEW CAREER · v0.71.0</h2>
    <p><b>The event clock.</b> On the felt in every invitation: HAND n/10 in a hand-count event, the time played in a knock-out. Pick it up and put it anywhere; flick it across the felt. It never sits on a face.</p>
    <p><b>The tray.</b> Let a card go half or more over the tray and it's kept there (as many as twelve). REDEAL deals three onto the felt; slide up the ones you want. A double tap on empty felt clears the felt, not the tray. In CARDS, hold a card and carry it off the book: the book goes, the card's in your hand.</p>
    <p><b>The rules.</b> Hand-count events: the blinds rise as it goes, and every chip you keep pays $1 per 100 on top of your place. FACE TO FACE is a duel to the last chip; LAST STACK WINS is a knock-out.</p>
    <h3>STRAIGHT TO A TABLE</h3>
    <div class="ncl-grid">${CAREER_INVITATION_EVENTS.map(e => `<button type="button" data-ev="${e.id}">${(e.title || e.name)}<small>${e.playerCount}P · ${e.handLimit ? e.handLimit + ' HANDS' : 'KNOCKOUT'}</small></button>`).join('')}</div>
    <div class="ncl-row"><button type="button" data-do="fresh">FRESH START</button><button type="button" data-do="done">DONE</button></div>`;
  document.body.append(key, sheet);
  key.addEventListener('click', () => { sheet.hidden = !sheet.hidden; });
  sheet.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.do === 'done'){ sheet.hidden = true; return; }
    if (b.dataset.do === 'fresh'){ localStorage.clear(); localStorage.setItem('felt.settings', JSON.stringify({ sound:true, seenIntro:true, seenTour:true })); if (host) host.reload(); else location.reload(); return; }
    if (b.dataset.ev){
      if (careerHasActiveEvent()){ b.classList.add('is-no'); setTimeout(() => b.classList.remove('is-no'), 600); return; }
      const inv = giveCareerInvitation(b.dataset.ev, card(b.dataset.ev).rarity);
      sheet.hidden = true;
      if (inv) CareerLink.play(CareerLink.pool().find(c => c.invId === inv.id));
    }
  });
})();
