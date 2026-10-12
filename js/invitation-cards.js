/* ============================================================
   INVITATION CARDS (lab) — one reusable face for every invitation event
   (docs/career/INVITATIONS_PLAN.md, the proposed first catalogue).

   Built on the event cards' stock (css/pack-ritual-cards.css: the card's
   proportions, type, cut corners and rarity trim; css/invitation-cards.css
   adds the invitation's rows). The picture is a separate slot
   (js/invitation-art.js), so the owner's artwork replaces it without
   touching any words.

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
  const RARITY = { common:{ name:'Common', code:'C' }, uncommon:{ name:'Uncommon', code:'UC' },
    rare:{ name:'Rare', code:'R' }, legendary:{ name:'Legendary', code:'L' } };

  /* The proposed catalogue (owner, 12 Oct 2026). `live` names a definition
     in the game's catalogue; everything else is provisional. status:
     'dev' — playable now, in DEV only; 'standard' — standard poker, not
     built yet; 'special' — needs its own rules stage before it can exist. */
  const CATALOGUE = [
    { id:'back-room', live:'back-room-invite', rarity:'common', art:'back-room', status:'dev',
      rules:'Ten hands. Most chips wins; every place is paid.' },
    { id:'full-house', title:'FULL HOUSE', rarity:'common', art:'full-house', status:'standard',
      players:6, hands:10, paid:3, rules:'A full table for ten hands. Most chips wins.' },
    { id:'closing-time', title:'CLOSING TIME', rarity:'common', art:'closing-time', status:'standard',
      players:4, hands:20, paid:3, rules:'Twenty hands before the lights come up.' },
    { id:'face-to-face', title:'FACE TO FACE', rarity:'common', art:'face-to-face', status:'standard',
      players:2, hands:10, paid:2, rules:'One opponent, ten hands. Both places paid.' },
    { id:'deep-pockets', title:'DEEP POCKETS', rarity:'common', art:'deep-pockets', status:'standard',
      players:4, hands:10, rules:'Deeper starting stacks: room to play your hands.' },
    { id:'sponsored-night', title:'SPONSORED NIGHT', rarity:'uncommon', art:'sponsored-night', status:'standard',
      rules:'Standard poker. A sponsor boosts the placement prizes.' },
    { id:'last-stack-wins', title:'LAST STACK WINS', rarity:'uncommon', art:'last-stack-wins', status:'standard',
      players:4, hands:10, paid:1, rules:'Ten hands. Only the biggest stack is paid.' },
    { id:'bounty-night', title:'BOUNTY NIGHT', rarity:'uncommon', art:'bounty-night', status:'special',
      rules:'Placement prizes, plus a bonus for each player you knock out.' },
    { id:'threes-company', title:'THREE’S COMPANY', rarity:'rare', art:'threes-company', status:'special',
      rules:'Three hole cards each. Best five from any mix of yours and the board.' },
    { id:'private-game', title:'THE PRIVATE GAME', rarity:'rare', art:'private-game', status:'standard',
      players:4, hands:20, paid:2, rules:'A quiet back table. Generous prizes, top two paid.' },
    { id:'final-table', title:'FINAL TABLE', rarity:'rare', art:'final-table', status:'standard',
      players:6, hands:'elimination', paid:3, rules:'Shallow stacks, rising blinds, play to the last player.' },
    { id:'pair-pressure', title:'PAIR PRESSURE', rarity:'rare', art:'pair-pressure', status:'special',
      rules:'Exactly one pair beats every other hand. The rest rank as normal.' },
    { id:'golden-ticket', title:'THE GOLDEN TICKET', rarity:'legendary', art:'golden-ticket', status:'standard', gold:true,
      players:3, hands:10, paid:1, rules:'Standard poker for an extraordinary jackpot. Winner takes all.' }
  ];

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
  const STATUS = { dev:'PLAYABLE · DEV', standard:'NOT BUILT YET', special:'SPECIAL RULES' };
  // the terms strip: one line, players · length; TERMS TBC when neither is set
  function termsText(t){
    return !t.players && !t.hands ? 'TERMS TBC' : playersText(t.players) + ' · ' + handsText(t.hands);
  }

  /* The face: the event cards' rows, with the type strip split into the
     terms and a one-line rule. */
  function cardHTML(entry){
    const t = terms(entry), rarity = RARITY[entry.rarity];
    const prize = t.payouts
      ? '<small>PRIZES</small><strong class="inv-payouts" data-n="' + t.payouts.length + '">' + t.payouts.map(money).join(' ') + '</strong>'
      : '<small>' + esc(paidText(t)) + '</small><strong class="inv-tbc">PRIZES TBC</strong>';
    // data-inv-rarity, not the stock's data-rarity: the stock rebuilds rare
    // and legendary cards in its own layouts; invitations keep one layout
    // and take only the stock's rarity trim (css/invitation-cards.css).
    return '<div class="ccl-object inv-object" data-kind="invite" data-inv-rarity="' + entry.rarity + '" data-material="paper" data-finish="paper"' +
      (entry.gold ? ' data-gold="true"' : '') + ' data-status="' + entry.status + '">' +
      '<div class="ccl-stock"><article class="ccl-card inv-card" data-kind="invite" data-finish="paper"' +
      ' aria-label="' + esc(t.title + ', ' + rarity.name + ', ' + playersText(t.players) + ', ' + handsText(t.hands)) + '">' +
      '<header class="ccl-card-header"><span class="ccl-rarity-index" aria-label="' + rarity.name + '">' + rarity.code + '</span>' +
        '<span class="ccl-header-legend">' + esc(t.venue) + '</span></header>' +
      '<h2 class="ccl-card-title">' + esc(t.title) + '</h2>' +
      '<div class="ccl-art">' + InvitationArt.get(entry.art) + '</div>' +
      '<div class="ccl-type inv-terms"' + (termsText(t).length > 20 ? ' data-long="true"' : '') + '>' + esc(termsText(t)) + '</div>' +
      '<p class="inv-rule">' + esc(entry.rules) + '</p>' +
      '<div class="ccl-prize">' + prize + '</div>' +
      '<footer class="ccl-card-footer"><span>' + (t.provisional ? 'PROVISIONAL' : rarity.name.toUpperCase()) + '</span><span>' + STATUS[entry.status] + '</span></footer>' +
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
