/* ============================================================
   EVENT CARDS — what a card is (lab only, placeholder numbers)

   Decided with the owner (11 Oct 2026):
   - A card is ONE specific table: a real Career event plus the opponents
     drawn for it when the pack is opened (the game's own roster code,
     generateCareerRoster), so the faces on a card are the people you'd
     play.
   - Playing a card uses it up. The album is a separate, permanent record
     of every design you've pulled.
   - Rarity raises the prize money (MULT, placeholder). Special rules and
     wild modes come later.
   Reads the live game's catalogue (careerEventById, careerPayouts) and the
   placeholder faces (PokerCollectibleLab).
   ============================================================ */
(() => {
  'use strict';
  const KINDS = ['table', 'freezeout', 'bomb', 'wild'];
  const RARITIES = ['common', 'uncommon', 'rare', 'legendary'];
  const MULT = { common:1, uncommon:1.5, rare:2.5, legendary:5 };
  // which events each packet series deals from
  const SERIES = {
    house:['back-room-five', 'back-room-freezeout', 'back-room-heads-up'],
    club:['pub-freezeout', 'pub-open', 'pub-turbo', 'card-club-deep', 'card-club-six'],
    reserve:['casino-main', 'casino-turbo', 'high-roller-feature', 'high-roller-pressure']
  };
  let uid = 0;
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const round = v => v >= 1000 ? Math.round(v / 50) * 50 : Math.round(v / 10) * 10;
  const event = id => { try { return careerEventById(id); } catch (e) { return null; } };

  /* One card. roster:false makes a design-only card (the album's), with
     no specific table behind it. */
  function make(kind, rarity, eventId, { roster = true } = {}){
    const ev = event(eventId) || event('back-room-five');
    const tier = RARITIES.indexOf(rarity), m = MULT[rarity] || 1;
    let base = [];
    try { base = careerPayouts(ev); } catch (e) {}
    if (!base.length) base = [ev.prize];
    const payouts = base.map(p => round(p * m));
    let seats = null;
    if (roster){ try { seats = generateCareerRoster(ev); } catch (e) {} }
    const def = PokerCollectibleLab.cards.find(c => c.kind === kind) || PokerCollectibleLab.cards[0];
    const spec = { ...PokerCollectibleLab.specimen(def, rarity), prize:payouts[0] };
    return { uid:'c' + (++uid), kind, rarity, tier, eventId:ev.id, event:ev, payouts, prize:payouts[0], roster:seats, spec, design:kind + ':' + rarity };
  }

  /* A packet's four cards: two commons, an uncommon and a rare, or a
     Legendary in the last slot (two, for the lab's TWO setting). */
  function pack(series, { legend = false, double = false, event:evKind = 'random' } = {}){
    const ids = SERIES[series] || SERIES.house, kind = () => pick(KINDS), lkind = () => evKind === 'random' ? kind() : evKind;
    const tiers = double ? ['common', 'uncommon', 'legendary', 'legendary'] : ['common', 'common', 'uncommon', legend ? 'legendary' : 'rare'];
    return tiers.map(r => make(r === 'legendary' ? lkind() : kind(), r, pick(ids)));
  }

  /* What the inspect screen prints about a card (the card prints the rest). */
  function describe(card){
    const ev = card.event;
    return { venue:ev.venue, title:ev.title || ev.name, seats:ev.playerCount, entry:ev.buyIn, payouts:card.payouts };
  }

  const designs = () => KINDS.flatMap(k => RARITIES.map(r => k + ':' + r));
  window.EventCards = Object.freeze({ KINDS, RARITIES, MULT, SERIES, make, pack, describe, designs });
})();
