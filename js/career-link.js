/* ============================================================
   CAREER LINK — the new Career in the game (docs/career/INVITATIONS_PLAN.md,
   Stage 5).

   With Settings → Career on NEW (settings.newCareer, NEW_CAREER for the
   whole load), the Career key on the menu opens the Career hub instead of
   the classic Career screen: the hub (js/career-main.js), the shop
   (js/vending-machine.js), the opening (js/pack-opening.js) and the album
   (js/collection-book.js). This file loads those parts (PARTS, below; the
   classic Career never loads them) and gives them the real Career through
   window.CareerLink; each asks for it only if it exists, so they still
   work alone in their labs.

   The real Career is js/07-ui-wiring.js: the bankroll, your invitations
   (career.invitations), your unopened packets (career.packets), the
   starter and pity packets, and playing a card. The new Career keeps its
   own save (CAREER_KEY 'felt.career.new'), so the classic one is never
   touched. Nothing here keeps money, cards or packets of its own: every
   change is one of those functions, each a single save write.

   The hub lives in #home, over the menu: open() lays it on (the classes
   cm-home on #home, cm-lab on the body), the hub's back key takes it off.
   A lab's framed copy of the game brings its own parts, so none of this
   runs there.
   ============================================================ */
(() => {
  'use strict';
  if (!NEW_CAREER || window.parent !== window) return;
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
    // START OVER: the new Career's save alone, never the classic one's
    wipe(){ Store.remove(CAREER_KEY); Store.remove(CAREER_TABLE_KEY); },
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

  // The hub over the menu, or not. The hub builds itself the first time
  // (js/career-main.js, CareerMain.start); after that it catches up with
  // the bankroll and the cards each time it's shown.
  const hub = window.CareerHub = {
    get open(){ return $('home').classList.contains('cm-home'); },
    // laid over the menu (the menu itself may still be hidden)
    lay(){ $('home').classList.add('cm-home'); document.body.classList.add('cm-lab'); },
    show(){
      // the hub's parts still on their way: it comes out as soon as they're here
      if (!window.CareerMain){ hub.pending = true; return; }
      hub.pending = false;
      hub.lay();
      if (window.CareerMain?.root) window.CareerMain.refresh();
      else window.CareerMain?.start?.();
    },
    hide(){
      $('home').classList.remove('cm-home');
      document.body.classList.remove('cm-lab');
      refreshCareerMenuButton();
    }
  };

  // Career from the menu: the hub, with the key's own press
  function enter(){
    if (typeof pressFeelSounded !== 'function' || !pressFeelSounded($('open-career'))) Sound.buttonPress('allin');
    haptic([25, 18, 42]);
    hub.show();
  }
  // Every way back to the classic Career screen (an event finished, a
  // table left mid-event) turns to the hub instead, with the drum.
  const realRollBackTo = rollBackTo;
  rollBackTo = (from, to, reveal, settle) => {
    if (to !== $('career')) return realRollBackTo(from, to, reveal, settle);
    hub.lay();
    return realRollBackTo(from, $('home'), reveal, settle);
  };
  // the menu's Career key (09-controls.js calls this; machine-wheel.js
  // installed its own drum version before this loaded)
  enterCareerFromHome = enter;
  showCareerScreen = () => {
    ['career', 'setup', 'rankings', 'awards', 'table-screen'].forEach(id => $(id)?.classList.add('hidden'));
    $('home').classList.remove('hidden');
    hub.show();
  };
  // a table left mid-event comes back to the menu: the hub, if it was out
  const realMenu = reconstructMainMenu;
  reconstructMainMenu = (...args) => { const r = realMenu(...args); if (hub.open) window.CareerMain?.refresh?.(); return r; };
  // the results key names where it goes
  enterCareerResultsConsole = onBack => activateResultsConsole(onBack, 'BACK TO THE HUB', 'career-return-mode', true);

  // The hub's parts, in order. sw.js precaches each with this same tag
  // (offline-list-checks.js holds the two together).
  const V = '69-0';
  const PARTS = {
    css:['css/pack-ritual-cards.css', 'css/invitation-cards.css', 'css/pack-opening.css', 'css/card-inspect.css',
      'css/career-main.css', 'css/vending-machine.css', 'css/collection-book.css'],
    js:['js/pack-ritual-art.js', 'js/pack-ritual-cards.js', 'js/invitation-art.js', 'js/invitation-cards.js',
      'js/pack-opening-core.js', 'js/pack-opening-packet.js', 'js/event-cards.js', 'js/card-inspect.js',
      'js/career-main.js', 'js/vending-machine.js', 'js/collection-book.js', 'js/pack-opening.js']
  };
  PARTS.css.forEach(f => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = f + '?v=' + V; document.head.append(l); });
  PARTS.js.forEach(f => { const s = document.createElement('script'); s.src = f + '?v=' + V; s.async = false; document.body.append(s); });
})();
