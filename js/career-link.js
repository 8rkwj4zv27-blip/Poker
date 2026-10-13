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
    // how many more packets the Career has room for
    room:() => CAREER_PACKETS_LIMIT - careerPackets().length,
    // whether a packet on the felt can be opened (its cards fit)
    canOpen:id => { const p = careerPackets().find(q => q.id === id); return !!p && careerInvitations().length + p.cards.length <= CAREER_INVITATIONS_LIMIT; },
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

  // The preview has no old Career screen: every way back to it (an event
  // finished, a table left mid-event, the menu) turns to the hub instead,
  // with the drum, and the hub catches up with the bankroll and cards.
  const realRollBackTo = rollBackTo;
  rollBackTo = (from, to, reveal, settle) => realRollBackTo(from, to === $('career') ? $('home') : to, reveal, settle);
  showCareerScreen = () => {
    ['career', 'setup', 'rankings', 'awards', 'table-screen'].forEach(id => $(id)?.classList.add('hidden'));
    $('home').classList.remove('hidden');
    window.CareerMain?.refresh?.();
  };
  // a table left mid-event comes back to the menu, which here is the hub
  const realMenu = reconstructMainMenu;
  reconstructMainMenu = (...args) => { const r = realMenu(...args); window.CareerMain?.refresh?.(); return r; };
  // the results key names where it goes
  enterCareerResultsConsole = onBack => activateResultsConsole(onBack, 'BACK TO THE HUB', 'career-return-mode', true);
})();
