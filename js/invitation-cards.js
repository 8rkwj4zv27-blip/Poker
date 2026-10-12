/* ============================================================
   INVITATION CARDS (lab) — one reusable face for every invitation event
   (docs/career/INVITATIONS_PLAN.md, the proposed first catalogue).

   The hub's own event card (js/pack-ritual-cards.js, the TABLE EVENT
   layout: header, title, art, one line, top prize, footer), recoloured by
   rarity (owner, 12 Oct 2026): Common cream, Uncommon green, Rare blue,
   Legendary yellow (css/invitation-cards.css). The picture is a slot of its
   own; until the owner's artwork exists it borrows the hub cards' art.
   Full rules belong on the card inspect screen, not the face.

   Every word comes from an event definition:
   - an event the game can play reads the LIVE definition the table is
     launched from (careerEventById), so the card can never disagree with
     the table;
   - the rest come from the provisional list below. Anything not yet
     agreed reads TBC, and the card is marked PROVISIONAL.
   A card here never launches play; the lab offers PLAY only for an event
   whose rules the game really has.
   ============================================================ */
(() => {
  'use strict';
  const RARITY = { common:{ name:'Common', code:'C' }, uncommon:{ name:'Uncommon', code:'U' },
    rare:{ name:'Rare', code:'R' }, legendary:{ name:'Legendary', code:'L' } };

  /* The proposed catalogue (owner, 12 Oct 2026). `live` names a definition
     in the game's catalogue; everything else is provisional. status:
     'dev' — playable now, in DEV only; 'standard' — standard poker, not
     built yet; 'special' — needs its own rules stage before it can exist. */
  const CATALOGUE = [
    { id:'back-room', live:'back-room-invite', rarity:'common', status:'dev',
      rules:'Ten hands. Most chips wins; every place is paid.' },
    { id:'full-house', title:'FULL HOUSE', rarity:'common', status:'standard',
      players:6, hands:10, paid:3, rules:'A full table for ten hands. Most chips wins.' },
    { id:'closing-time', title:'CLOSING TIME', rarity:'common', status:'standard',
      players:4, hands:20, paid:3, rules:'Twenty hands before the lights come up.' },
    { id:'face-to-face', title:'FACE TO FACE', rarity:'common', status:'standard',
      players:2, hands:10, paid:2, rules:'One opponent, ten hands. Both places paid.' },
    { id:'deep-pockets', title:'DEEP POCKETS', rarity:'common', status:'standard',
      players:4, hands:10, rules:'Deeper starting stacks: room to play your hands.' },
    { id:'sponsored-night', title:'SPONSORED NIGHT', rarity:'uncommon', status:'standard',
      rules:'Standard poker. A sponsor boosts the placement prizes.' },
    { id:'last-stack-wins', title:'LAST STACK WINS', rarity:'uncommon', status:'standard',
      players:4, hands:10, paid:1, rules:'Ten hands. Only the biggest stack is paid.' },
    { id:'bounty-night', title:'BOUNTY NIGHT', rarity:'uncommon', status:'special',
      rules:'Placement prizes, plus a bonus for each player you knock out.' },
    { id:'threes-company', title:'THREE’S COMPANY', rarity:'rare', status:'special',
      rules:'Three hole cards each. Best five from any mix of yours and the board.' },
    { id:'private-game', title:'THE PRIVATE GAME', rarity:'rare', status:'standard',
      players:4, hands:20, paid:2, rules:'A quiet back table. Generous prizes, top two paid.' },
    { id:'final-table', title:'FINAL TABLE', rarity:'rare', status:'standard',
      players:6, hands:'elimination', paid:3, rules:'Shallow stacks, rising blinds, play to the last player.' },
    { id:'pair-pressure', title:'PAIR PRESSURE', rarity:'rare', status:'special',
      rules:'Exactly one pair beats every other hand. The rest rank as normal.' },
    { id:'golden-ticket', title:'THE GOLDEN TICKET', rarity:'legendary', status:'standard',
      players:3, hands:10, paid:1, rules:'Standard poker for an extraordinary jackpot. Winner takes all.' }
  ];

  // which hub card's picture stands in until the owner's art exists
  const ART_FROM = { special:'wild', elimination:'freezeout', bounty:'bomb', standard:'table' };
  function artOf(entry){
    const kind = entry.id === 'bounty-night' ? ART_FROM.bounty : entry.status === 'special' ? ART_FROM.special
      : entry.hands === 'elimination' ? ART_FROM.elimination : ART_FROM.standard;
    const L = window.PokerCollectibleLab, def = L.cards.find(c => c.kind === kind);
    const html = L.cardHTML(L.specimen(def, 'common'));
    const m = html.match(/<div class="ccl-art">(<svg[\s\S]*?<\/svg>)/);
    return m ? m[1] : '';
  }

  const money = n => '$' + Number(n).toLocaleString('en-US');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

  /* One card's terms, from its definition. Unknowns stay null (TBC). */
  function terms(entry){
    const live = entry.live && typeof careerEventById === 'function' ? careerEventById(entry.live) : null;
    if (live){
      const payouts = careerPayouts(live);
      return { title:careerEventTitle(live), venue:live.venue, players:live.playerCount,
        hands:live.handLimit || 'elimination', paid:payouts.length, payouts, provisional:false,
        note:'Prizes are temporary test values.' };
    }
    return { title:entry.title, venue:'INVITATION', players:entry.players || null, hands:entry.hands || null,
      paid:entry.paid || null, payouts:null, provisional:true, note:'Terms not settled.' };
  }
  const handsText = h => h === 'elimination' ? 'ELIMINATION' : h ? h + ' HANDS' : 'HANDS TBC';
  const playersText = n => n ? n + ' PLAYERS' : 'PLAYERS TBC';
  function paidText(t){
    if (!t.paid) return 'PAID PLACES TBC';
    if (t.paid === 1) return 'WINNER TAKES ALL';
    return t.players && t.paid >= t.players ? 'EVERY PLACE PAID' : 'TOP ' + t.paid + ' PAID';
  }
  // the face's one line: players · length; TERMS TBC when neither is set
  function termsText(t){
    return !t.players && !t.hands ? 'TERMS TBC' : playersText(t.players) + ' · ' + handsText(t.hands);
  }

  /* The face: the hub card, with this event's words and its rarity colour. */
  function cardHTML(entry){
    const t = terms(entry), rarity = RARITY[entry.rarity], line = termsText(t);
    const top = t.payouts ? money(t.payouts[0]) : 'TBC';
    const no = String(CATALOGUE.indexOf(entry) + 1).padStart(3, '0') + '·' + rarity.code;
    return '<div class="ccl-object inv-object" data-kind="table" data-inv-rarity="' + entry.rarity + '" data-material="paper" data-finish="paper">' +
      '<div class="ccl-stock"><article class="ccl-card inv-card" data-kind="table" data-finish="paper"' +
      ' aria-label="' + esc(t.title + ', ' + rarity.name + ', top prize ' + top) + '">' +
      '<header class="ccl-card-header"><span class="ccl-rarity-index" aria-label="' + rarity.name + '">' + rarity.code + '</span>' +
        '<span class="ccl-header-legend">ADMIT ONE</span></header>' +
      '<h2 class="ccl-card-title">' + esc(t.title) + '</h2>' +
      '<div class="ccl-art">' + artOf(entry) + '</div>' +
      '<div class="ccl-type"' + (line.length > 20 ? ' data-long="true"' : '') + '>' + esc(line) + '</div>' +
      '<div class="ccl-prize"><small>TOP PRIZE</small><strong' + (t.payouts ? '' : ' class="inv-tbc"') + '>' + top + '</strong></div>' +
      '<footer class="ccl-card-footer"><span>' + rarity.name.toUpperCase() + '</span><span>' + no + '</span></footer>' +
      '</article></div></div>';
  }

  /* What the lab's detail view lists beside the card. */
  function describe(entry){
    const t = terms(entry);
    return { title:t.title, rarity:RARITY[entry.rarity].name, players:playersText(t.players), hands:handsText(t.hands),
      paid:paidText(t), prizes:t.payouts ? t.payouts.map(money).join(' / ') : 'TBC', rules:entry.rules,
      status:entry.status, playable:entry.status === 'dev' && !!entry.live, eventId:entry.live || null, note:t.note };
  }

  window.InvitationCards = Object.freeze({ CATALOGUE, RARITY, cardHTML, describe });
})();
