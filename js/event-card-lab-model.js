"use strict";

// Lab fixtures only. No catalogue, money, unlock or saved-data authority.
// An artwork source is independent of all three classification axes.
const EventCardLabModel = (() => {
  const axes = Object.freeze({
    rarity: Object.freeze(['common', 'uncommon', 'rare', 'legendary']),
    category: Object.freeze(['classic', 'format', 'wild', 'chaos', 'rival', 'variant']),
    venue: Object.freeze(['backroom', 'pub', 'cardclub', 'casino', 'highroller', 'invitational'])
  });
  const venues = Object.freeze({
    backroom: 'BACK ROOM', pub: 'PUB CIRCUIT', cardclub: 'CARD CLUB',
    casino: 'CASINO FLOOR', highroller: 'HIGH ROLLER', invitational: 'INVITATIONAL'
  });
  const marks = Object.freeze({ classic: '♣', format: '≡', wild: '✦', chaos: 'ϟ', rival: '↔', variant: '±' });
  const fixtures = Object.freeze([
    Object.freeze({ id: 'freezeout', title: 'BACK ROOM FREEZEOUT', shortTitle: 'FREEZEOUT', rarity: 'common', category: 'classic', venue: 'backroom', buyIn: 100, top: 300, seats: 3, art: 'assets/faces/red-thinking01.PNG', artAlt: 'Existing red Poker Faces thinking portrait' }),
    Object.freeze({ id: 'bomb', title: 'BOMB TABLE', shortTitle: 'BOMB TABLE', rarity: 'rare', category: 'format', venue: 'pub', buyIn: 300, top: 1050, seats: 5, art: 'assets/faces/0242-worried.PNG', artAlt: 'Existing Poker Faces worried portrait' }),
    Object.freeze({ id: 'wild', title: 'WILD EVENT', shortTitle: 'WILD EVENT', rarity: 'legendary', category: 'wild', venue: 'invitational', buyIn: 30000, top: 100000, seats: 6, art: 'assets/faces/0259-gloating.PNG', artAlt: 'Existing Poker Faces gloating portrait' })
  ]);
  function withAxis(card, axis, value) {
    if (!axes[axis] || !axes[axis].includes(value)) throw new Error('Unknown card classification');
    return { ...card, [axis]: value };
  }
  function label(card) {
    return card.title + ', ' + card.rarity + ', ' + card.category + ', ' + venues[card.venue];
  }
  return Object.freeze({ axes, venues, marks, fixtures, withAxis, label });
})();
