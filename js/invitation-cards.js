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
    { id:'back-room', live:'back-room-invite', rarity:'common', art:'back-room', status:'live' },
    { id:'full-house', live:'full-house', rarity:'common', art:'full-house', status:'live' },
    { id:'closing-time', live:'closing-time', rarity:'common', art:'closing-time', status:'live' },
    { id:'face-to-face', live:'face-to-face', rarity:'common', art:'face-to-face', status:'live' },
    { id:'deep-pockets', live:'deep-pockets', rarity:'common', art:'deep-pockets', status:'live' },
    { id:'sponsored-night', live:'sponsored-night', rarity:'uncommon', art:'sponsored-night', status:'live' },
    { id:'last-stack-wins', live:'last-stack-wins', rarity:'uncommon', art:'last-stack-wins', status:'live' },
    { id:'bounty-night', title:'BOUNTY NIGHT', rarity:'uncommon', status:'special',
      rules:'Placement prizes, plus a bonus for each player you knock out.' },
    { id:'threes-company', title:'THREE\u2019S COMPANY', rarity:'rare', status:'special',
      rules:'Three hole cards each. Best five from any mix of yours and the board.' },
    { id:'private-game', live:'private-game', rarity:'rare', art:'private-game', status:'live' },
    { id:'final-table', live:'final-table', rarity:'rare', art:'final-table', status:'live' },
    { id:'pair-pressure', title:'PAIR PRESSURE', rarity:'rare', status:'special',
      rules:'Exactly one pair beats every other hand. The rest rank as normal.' },
    { id:'golden-ticket', live:'golden-ticket', rarity:'legendary', art:'golden-ticket', status:'live' }
  ];

  // which hub card's picture stands in until the owner's art exists
  const ART_FROM = { special:'wild', elimination:'freezeout', bounty:'bomb', standard:'table' };
  function artOf(entry){
    if (entry.art && window.InvitationArt) return InvitationArt.get(entry.art);
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

  // each rarity's finish, on the stock's own surface effects: rare is
  // lacquered (a sheen), legendary foiled (the title and prize in foil)
  const FINISH = { common:'paper', uncommon:'paper', rare:'lacquer', legendary:'foil' };
  const LEGEND = { common:'ADMIT ONE', uncommon:'INVITATION', rare:'RESERVED', legendary:'BY INVITATION' };
  // a rule for an event the game has, from its definition
  function ruleOf(t){
    const length = t.hands === 'elimination' ? 'Play to the last player.' : t.hands + ' hands, then most chips wins.';
    return length + ' ' + paidText(t).charAt(0) + paidText(t).slice(1).toLowerCase() + '.';
  }

  /* The face: the hub card, with this event's words, its art and its
     rarity's colour and finish. */
  function cardHTML(entry){
    const t = terms(entry), rarity = RARITY[entry.rarity], line = termsText(t), fin = FINISH[entry.rarity];
    const top = t.payouts ? money(t.payouts[0]) : 'TBC';
    const no = 'NO.' + String(CATALOGUE.indexOf(entry) + 1).padStart(2, '0');
    const fx = fin === 'paper' ? '' : '<span class="ccl-surface-fx" aria-hidden="true"><span class="ccl-finish"></span></span>';
    return '<div class="ccl-object inv-object" data-kind="table" data-inv-rarity="' + entry.rarity + '" data-material="paper" data-finish="' + fin + '">' +
      '<div class="ccl-stock"><article class="ccl-card inv-card" data-kind="table" data-finish="' + fin + '"' +
      ' aria-label="' + esc(t.title + ', ' + rarity.name + ', top prize ' + top) + '">' +
      '<header class="ccl-card-header"><span class="ccl-rarity-index" aria-label="' + rarity.name + '">' + rarity.code + '</span>' +
        '<span class="ccl-header-legend">' + LEGEND[entry.rarity] + '</span></header>' +
      '<h2 class="ccl-card-title">' + esc(t.title) + '</h2>' +
      '<div class="ccl-art">' + artOf(entry) + '<i class="inv-corner is-tl"></i><i class="inv-corner is-tr"></i><i class="inv-corner is-bl"></i><i class="inv-corner is-br"></i></div>' +
      '<div class="ccl-type"' + (line.length > 20 ? ' data-long="true"' : '') + '>' + esc(line) + '</div>' +
      '<div class="ccl-prize"><small>TOP PRIZE</small><strong' + (t.payouts ? '' : ' class="inv-tbc"') + '>' + top + '</strong></div>' +
      '<footer class="ccl-card-footer"><span>' + rarity.name.toUpperCase() + '</span><span>' + no + '</span></footer>' +
      fx + '<i class="inv-shine" aria-hidden="true"></i>' +
      '</article></div></div>';
  }
  // the catalogue entry for a live event, for the game's own cards
  const byEvent = eventId => CATALOGUE.find(e => e.live === eventId) || null;

  /* What the lab's detail view lists beside the card. */
  function describe(entry){
    const t = terms(entry);
    return { title:t.title, rarity:RARITY[entry.rarity].name, players:playersText(t.players), hands:handsText(t.hands),
      paid:paidText(t), prizes:t.payouts ? t.payouts.map(money).join(' / ') : 'TBC',
      rules:entry.rules || ruleOf(t),
      status:entry.status, playable:entry.status === 'live' && !!entry.live, eventId:entry.live || null, note:t.note };
  }

  window.InvitationCards = Object.freeze({ CATALOGUE, RARITY, cardHTML, describe, byEvent });
})();
