/* ============================================================
   CAREER LINK — the New Career preview's connector
   (docs/career/INVITATIONS_PLAN.md, Stage 4).

   The hub (js/career-main.js), the shop (js/vending-machine.js), the
   opening (js/pack-opening.js) and the album (js/collection-book.js) each
   run on their own placeholder data. Loaded before them, this file turns
   on the preview (window.CAREER_PREVIEW) and gives them the real Career
   instead, through window.CareerLink; each asks for it only if it exists,
   so they still work alone in their labs.

   The real Career is js/07-ui-wiring.js: the bankroll, your invitations
   (career.invitations), your unopened packets (career.packets), the
   starter and pity packets, and playing a card. Nothing here keeps money,
   cards or packets of its own: every change is one of those functions,
   each a single save write.
   ============================================================ */
(() => {
  'use strict';
  window.CAREER_PREVIEW = true;
  const toCard = inv => EventCards.fromInvitation(inv);

  window.CareerLink = {
    // the shop sells what the Career sells: the House Packet
    editions(){ return { house:{ name:'HOUSE', price:CAREER_PACKETS.house.price, odds:'ssff' } }; },
    bank:() => careerBankroll(),
    // your case: the invitations you own, as cards
    pool:() => careerInvitations().map(toCard).filter(Boolean),
    // a purchase: the money goes and the packet arrives in one write
    buy:() => buyCareerPacket('house'),
    packetIds:() => careerPackets().map(p => p.id),
    // a packet torn open on the felt: its cards join yours (one write)
    open(id){ const cards = openCareerPacket(id); return cards ? cards.map(toCard).filter(Boolean) : null; },
    // the starter packet the first time, the pity packet when stuck
    arrivals:() => careerHubArrivals().map(p => p.id),
    // PLAY: the card is used up as its event starts, and you're seated
    play(card){
      if (!card || !card.invId || !playCareerInvitation(card.invId)) return false;
      careerDepartToTable(startCareerEvent);
      return true;
    },
    // an event left in progress (a reload, or leaving the table)
    resume(){
      if (!careerHasActiveEvent()) return false;
      careerDepartToTable(continueCareerEvent);
      return true;
    },
    get active(){ return careerActiveEventSnapshot(); },
    // the album: one place per event, in catalogue order; the cards you
    // hold of each, and whether you've ever pulled one
    albumPages(){
      const owned = careerInvitations();
      return CAREER_INVITATION_EVENTS.map(ev => {
        const mine = owned.filter(c => c.eventId === ev.id);
        return { eventId:ev.id, cards:mine.map(toCard).filter(Boolean), count:mine.length,
          design:toCard({ id:'design-' + ev.id, eventId:ev.id, rarity:ev.rarity, roster:null }) };
      });
    }
  };

  // Back from a table: the drum turns the results away and the hub comes
  // round (the game's returnToCareer, with the hub in place of the old
  // Career screen), and the hub catches up with the bankroll and cards.
  function backToHub(){
    if (careerReturnInFlight || (game && game._careerReturnDone)) return;
    careerReturnInFlight = true;
    clearTimeout(autoDealT);
    endQuickResolve();
    closeOverlays();
    if (game){ game.over = true; game._careerReturnDone = true; }
    pendingHumanPlayer = null;
    coachToken++;
    rollBackTo($('table-screen'), $('home'),
      () => { $('home').classList.remove('hidden'); window.CareerMain?.refresh?.(); },
      () => {
        hideResultCard();
        exitResultsConsole();
        clearCompletedEventConsole();
        setArcadeMode(false);
        const felt = $('felt');
        if (felt) felt.classList.remove('results-mode', 'tone-negative');
        $('btn-new-table').textContent = 'New Table';
        $('btn-new-table').classList.add('hidden');
        $('table-screen').classList.add('hidden');
        applyTheme();
        careerReturnInFlight = false;
      });
  }
  returnToCareer = backToHub;
  // the results key names where it goes
  enterCareerResultsConsole = onBack => activateResultsConsole(onBack, 'BACK TO THE HUB', 'career-return-mode', true);
  // anything else that would show the old Career screen shows the hub
  showCareerScreen = () => {
    $('career').classList.add('hidden');
    $('table-screen').classList.add('hidden');
    $('home').classList.remove('hidden');
    window.CareerMain?.refresh?.();
  };
})();
