"use strict";

/* ============================================================
   PACK LAB — the cards (lab only, never loaded by the game)

   A believable set per pack so the owner can feel the collection. The
   names, numbers and rules are placeholders, not decisions: nothing here
   is balanced, and the wild, jinx and challenge rules aren't built. Every
   card that can be fed plays an existing catalogue event (`plays`).

   Kinds: event, format, character, big, challenge, jinx, wild, chips,
   cosmetic. Rarity: common, uncommon, rare, foil.
   ============================================================ */
const PackCards = (() => {
  const C = (tier, kind, rarity, title, more) => Object.assign({ tier, kind, rarity, title }, more);
  const LIST = [
    // ---- BACK ALLEY ----
    C('alley','event','common','5-HAND',        { sub:'BACK ROOM · TOP 2 PAID', seats:5, buyIn:100, pays:'$350 / $150', plays:'back-room-five' }),
    C('alley','event','common','3-HAND',        { sub:'BACK ROOM · WINNER TAKES IT', seats:3, buyIn:100, pays:'$300', plays:'back-room-freezeout' }),
    C('alley','event','common','HEADS-UP',      { sub:'BACK ROOM · ONE ON ONE', seats:2, buyIn:100, pays:'$200', plays:'back-room-heads-up' }),
    C('alley','event','common','HOUSE GAME',    { sub:'BACK ROOM · ALWAYS ON', seats:4, buyIn:100, pays:'$350 / $150', plays:'back-room-five', house:true }),
    C('alley','format','uncommon','BOUNTY NIGHT',{ sub:'BACK ROOM · NEW FORMAT', seats:5, buyIn:100, rule:'Every knockout pays $40 on the spot.', glyph:'skull', plays:'back-room-five' }),
    C('alley','format','uncommon','LAST ORDERS', { sub:'BACK ROOM · NEW FORMAT', seats:4, buyIn:100, rule:'The bell rings after 15 hands. The chip leader takes it.', glyph:'bolt', plays:'back-room-freezeout' }),
    C('alley','character','rare','HARRY\'S TABLE',{ sub:'THE BACK TABLE', seats:2, buyIn:100, rule:'Harry runs the back table. Beat him heads-up and he\'ll remember it.', face:6, mood:'sly', who:'HARRY', plays:'back-room-heads-up' }),
    C('alley','chips','common','A TIP',          { sub:'FROM THE HOUSE', chips:40 }),
    C('alley','wild','rare','LOOSE LIPS',        { sub:'WILD · RULES BEND', seats:5, buyIn:100, rule:'Everyone talks all night, and every tell is loud.', glyph:'eye', plays:'back-room-five' }),
    C('alley','jinx','uncommon','COLD DECK',     { sub:'JINX · YOUR CHOICE', seats:5, buyIn:100, rule:'No pocket pairs for you for 10 hands. Cash anyway: +$100.', plays:'back-room-five' }),
    // ---- PUB CIRCUIT ----
    C('pub','event','common','4-HAND',           { sub:'PUB CIRCUIT · WINNER TAKES IT', seats:4, buyIn:300, pays:'$1,200', plays:'pub-freezeout' }),
    C('pub','event','common','5-HAND',           { sub:'PUB CIRCUIT · TOP 2 PAID', seats:5, buyIn:300, pays:'$1,050 / $450', plays:'pub-open' }),
    C('pub','format','uncommon','PUB TURBO',     { sub:'PUB CIRCUIT · FAST BLINDS', seats:4, buyIn:300, rule:'Blinds go up every 6 hands. Keep up.', glyph:'bolt', plays:'pub-turbo' }),
    C('pub','format','uncommon','SHOOTOUT',      { sub:'PUB CIRCUIT · NEW FORMAT', seats:4, buyIn:300, rule:'Win your table, then win the final table.', glyph:'bolt', plays:'pub-open' }),
    C('pub','challenge','uncommon','THE HAMMER', { sub:'CHALLENGE · BONUS $150', seats:5, buyIn:300, rule:'Win a pot with 7-2. Any pot, any way.', plays:'pub-open' }),
    C('pub','character','rare','LUCY\'S LOCK-IN',{ sub:'AFTER HOURS', seats:4, buyIn:300, rule:'Lucy locks the door at closing. Nobody leaves till someone busts.', face:2, mood:'smug', who:'LUCY', plays:'pub-freezeout' }),
    C('pub','chips','common','LAST ROUND',       { sub:'THE LANDLORD\'S SHOUT', chips:120 }),
    C('pub','cosmetic','uncommon','PUB GREEN',   { sub:'COSMETIC · FELT', rule:'A worn green felt for your table.', swatch:['#2F6B43','#E9D9A8'] }),
    C('pub','wild','rare','BOMB POT NIGHT',      { sub:'WILD · RULES BEND', seats:5, buyIn:300, rule:'Every fifth hand everyone antes big and it goes straight to the flop.', glyph:'bolt', plays:'pub-open' }),
    C('pub','jinx','uncommon','MARKED DECK',     { sub:'JINX · YOUR CHOICE', seats:4, buyIn:300, rule:'Blinds double. So does the payout.', plays:'pub-freezeout' }),
    // ---- CARD CLUB ----
    C('club','event','common','DEEP STACK',      { sub:'CARD CLUB · WINNER TAKES IT', seats:4, buyIn:1000, pays:'$4,000', plays:'card-club-deep' }),
    C('club','event','common','CLUB SIX',        { sub:'CARD CLUB · TOP 2 PAID', seats:6, buyIn:1000, pays:'$3,600 / $2,400', plays:'card-club-six' }),
    C('club','format','uncommon','SURVIVAL',     { sub:'CARD CLUB · NEW FORMAT', seats:6, buyIn:1000, rule:'Paid by how long you last, not by winning.', glyph:'bolt', plays:'card-club-six' }),
    C('club','character','rare','TONY\'S DUEL',  { sub:'BEST OF THREE', seats:2, buyIn:1000, rule:'Three heads-up matches against Tony and his crew.', face:5, mood:'gloating', who:'TONY', plays:'card-club-deep' }),
    C('club','challenge','uncommon','NO SHOVES', { sub:'CHALLENGE · BONUS $400', seats:6, buyIn:1000, rule:'Cash without ever going all in.', plays:'card-club-six' }),
    C('club','cosmetic','uncommon','NAVY LATTICE',{ sub:'COSMETIC · CARD BACK', rule:'A navy card back with a silver lattice.', swatch:['#2B3F73','#C9D3E6'] }),
    C('club','wild','rare','LIGHTS OUT',         { sub:'WILD · RULES BEND', seats:4, buyIn:1000, rule:'The table goes dark. No faces, no moods, no talk. Just cards.', glyph:'eye', plays:'card-club-deep' }),
    C('club','chips','uncommon','MEMBERS\' DIVIDEND',{ sub:'PAID TO MEMBERS', chips:400 }),
    C('club','jinx','uncommon','SHORT STACK',    { sub:'JINX · YOUR CHOICE', seats:4, buyIn:1000, rule:'Start with half the chips. Win it and the prize is tripled.', plays:'card-club-deep' }),
    // ---- CASINO ----
    C('casino','event','common','MAIN EVENT',    { sub:'CASINO FLOOR · TOP 3 PAID', seats:6, buyIn:3000, pays:'$9K / $6K / $3K', plays:'casino-main' }),
    C('casino','format','uncommon','MIDNIGHT TURBO',{ sub:'CASINO FLOOR · FAST BLINDS', seats:4, buyIn:3000, rule:'Blinds up every 5 hands, from midnight till it\'s done.', glyph:'bolt', plays:'casino-turbo' }),
    C('casino','character','rare','ROXY\'S HIGH LIMIT',{ sub:'THE ROPED-OFF TABLE', seats:4, buyIn:3000, rule:'Roxy plays big and talks bigger. Knock her out for a bonus.', face:1, mood:'sly', who:'ROXY', plays:'casino-turbo' }),
    C('casino','wild','rare','SUDDEN DEATH',     { sub:'WILD · RULES BEND', seats:4, buyIn:3000, rule:'The blinds double every single hand.', glyph:'skull', plays:'casino-turbo' }),
    C('casino','wild','foil','THE GHOST SEAT',   { sub:'WILD · RULES BEND', seats:5, buyIn:3000, rule:'An empty chair with chips. It goes all in every hand. Someone has to call it.', glyph:'skull', plays:'casino-main' }),
    C('casino','chips','uncommon','COMPS',       { sub:'ON THE HOUSE', chips:1500 }),
    C('casino','challenge','uncommon','KNOCK OUT ROXY',{ sub:'CHALLENGE · BONUS $1,000', seats:6, buyIn:3000, rule:'Be the one who busts Roxy.', plays:'casino-main' }),
    C('casino','cosmetic','rare','CASINO RED',   { sub:'COSMETIC · FELT', rule:'Deep red felt with a gold rail.', swatch:['#A3242E','#F2D27A'] }),
    C('casino','jinx','uncommon','LOUDMOUTH',    { sub:'JINX · YOUR CHOICE', seats:6, buyIn:3000, rule:'Your own mood shows. They read you better. Prize +50%.', plays:'casino-main' }),
    // ---- HIGH ROLLER ----
    C('high','event','common','FEATURE TABLE',   { sub:'HIGH ROLLER · WINNER TAKES IT', seats:4, buyIn:10000, pays:'$40,000', plays:'high-roller-feature' }),
    C('high','event','common','PRESSURE FIVE',   { sub:'HIGH ROLLER · TOP 2 PAID', seats:5, buyIn:10000, pays:'$35K / $15K', plays:'high-roller-pressure' }),
    C('high','character','rare','NIGEL\'S PRIVATE GAME',{ sub:'BY INVITATION', seats:4, buyIn:10000, rule:'Nigel\'s game, Nigel\'s house rules. He hates losing to newcomers.', face:3, mood:'smug', who:'NIGEL', plays:'high-roller-feature' }),
    C('high','wild','rare','THE MIRROR',         { sub:'WILD · RULES BEND', seats:4, buyIn:10000, rule:'Once an orbit you see one opponent\'s hole card.', glyph:'eye', plays:'high-roller-feature' }),
    C('high','big','foil','MILLION NIGHT',       { sub:'BIG MONEY · ONE NIGHT', seats:5, buyIn:20000, pays:'$120,000', rule:'A steep entry, a stacked field, a pot you\'ll tell people about.', plays:'high-roller-pressure' }),
    C('high','chips','uncommon','MARKER PAID',   { sub:'A DEBT SETTLED', chips:5000 }),
    C('high','cosmetic','rare','GOLD LEAF',      { sub:'COSMETIC · CARD FACES', rule:'Card faces edged in gold leaf.', swatch:['#1E1C24','#E2B640'] }),
    C('high','wild','foil','P.I.P. DRIVES',      { sub:'WILD · RULES BEND', seats:4, buyIn:10000, rule:'P.I.P. plays one hand for you each orbit, for better or worse.', glyph:'bolt', plays:'high-roller-feature' }),
    // ---- GOLD INVITATIONAL ----
    C('gold','event','foil','THE FINAL',         { sub:'INVITATIONAL CHAMPIONSHIP', seats:6, buyIn:30000, pays:'$100K / $50K / $30K', plays:'invitational-final', invite:true }),
    C('gold','character','foil','THE VISITOR',   { sub:'ONE NIGHT ONLY', seats:5, buyIn:30000, rule:'A stranger sits in. Nobody knows their name. Their head is worth $25,000.', face:7, mood:'tilted', who:'???', plays:'invitational-final' }),
    C('gold','chips','rare','THE PURSE',         { sub:'FOR THE INVITED', chips:20000 }),
    C('gold','cosmetic','foil','VELVET CROWN',   { sub:'COSMETIC · DECK', rule:'A whole deck: velvet backs, gold crowns.', swatch:['#5A1520','#E8B83A'] }),
    C('gold','wild','rare','DOUBLE BOARD',       { sub:'WILD · RULES BEND', seats:6, buyIn:30000, rule:'Two boards every hand. Each half of the pot has its own winner.', glyph:'eye', plays:'invitational-final' }),
    C('gold','big','foil','THE HEIST',           { sub:'BIG MONEY · ONE NIGHT', seats:6, buyIn:30000, pays:'$250,000', rule:'The house seeds the pot. Once.', plays:'invitational-final' }),
    C('gold','character','rare','STEVE\'S LAST STAND',{ sub:'THE OLD CHAMPION', seats:2, buyIn:30000, rule:'Steve won it all once. He wants it back.', face:4, mood:'idle', who:'STEVE', plays:'invitational-final' })
  ];
  // set numbers within each tier
  const byTier = {};
  LIST.forEach(c => { (byTier[c.tier] = byTier[c.tier] || []).push(c); c.no = byTier[c.tier].length; });
  LIST.forEach(c => { c.of = byTier[c.tier].length; c.id = c.tier + '-' + String(c.no).padStart(2, '0'); });
  const byId = Object.fromEntries(LIST.map(c => [c.id, c]));
  const RANK = { common:0, uncommon:1, rare:2, foil:3 };
  const KIND_LABEL = { event:'EVENT', format:'FORMAT', character:'CHARACTER', big:'BIG MONEY', challenge:'CHALLENGE', jinx:'JINX', wild:'WILD', chips:'CHIPS', cosmetic:'COSMETIC' };
  const GEM = { common:'●', uncommon:'◆', rare:'★', foil:'✦' };
  const money = n => '$' + Number(n).toLocaleString('en-US');

  /* ---- opening a pack ----
     force: normal | rare | foil | wild | jinx | chips | all */
  function open(tierId, force){
    const t = PackArt.tier(tierId);
    const set = byTier[tierId];
    const pick = pred => { const pool = set.filter(pred); return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null; };
    const lowly = c => RANK[c.rarity] <= 1 && c.kind !== 'chips';
    const out = [];
    const odds = { alley:[.14,.02], pub:[.2,.03], club:[.25,.05], casino:[.33,.07], high:[.45,.12], gold:[.6,.3] }[tierId];
    // the commons and uncommons, with a chip tip now and then
    const fill = t.cards - 1;
    let chipsDone = false;
    for (let i = 0; i < fill; i++){
      let c = null;
      if (!chipsDone && Math.random() < .3){ c = pick(x => x.kind === 'chips' && RANK[x.rarity] <= 1); chipsDone = !!c; }
      if (!c) c = pick(x => lowly(x) && Math.random() < (x.rarity === 'uncommon' ? .5 : 1)) || pick(lowly) || set[0];
      out.push(c);
    }
    // the hit: the last card in the pack
    const roll = Math.random();
    let hit = roll < odds[1] ? pick(x => x.rarity === 'foil') : roll < odds[0] ? pick(x => x.rarity === 'rare') : null;
    hit = hit || pick(x => x.rarity === 'uncommon') || pick(lowly);
    out.push(hit);
    // the gold pack always holds the invitation, and treats you
    if (tierId === 'gold'){
      out.length = 0;
      out.push(pick(x => x.kind === 'chips'), pick(x => x.kind === 'cosmetic'), pick(x => x.kind === 'wild') || set[0],
        pick(x => x.kind === 'character' && x.rarity === 'rare'), pick(x => x.kind === 'big'), byId['gold-01']);
      if (Math.random() < .5) out[3] = pick(x => x.kind === 'character' && x.rarity === 'foil');
    }
    // forced pulls (TUNE)
    const any = (pred, from) => (from || set).filter(pred);
    const force1 = (pred) => {
      let pool = any(pred);
      if (!pool.length) pool = LIST.filter(pred);
      return pool[Math.floor(Math.random() * pool.length)];
    };
    if (force === 'rare') out[out.length - 1] = force1(x => x.rarity === 'rare');
    if (force === 'foil') out[out.length - 1] = force1(x => x.rarity === 'foil');
    if (force === 'wild') out[out.length - 1] = force1(x => x.kind === 'wild');
    if (force === 'jinx') out[out.length - 1] = force1(x => x.kind === 'jinx');
    if (force === 'chips') out[0] = force1(x => x.kind === 'chips');
    if (force === 'all'){
      out.length = 0;
      out.push(force1(x => x.kind === 'chips'), force1(x => x.kind === 'jinx'), force1(x => x.kind === 'wild' && x.rarity === 'rare'),
        force1(x => x.kind === 'character'), force1(x => x.rarity === 'foil'));
    }
    // commons first, the best last (as in a real pack)
    return out.filter(Boolean).map((c, i) => ({ c, i })).sort((a, b) => (RANK[a.c.rarity] - RANK[b.c.rarity]) || (a.i - b.i)).map(x => x.c);
  }

  /* ---- drawing a card ---- */
  function artCanvas(card){
    const cv = document.createElement('canvas');
    cv.width = 56; cv.height = 30;
    cv.className = 'pk-art-cv';
    PackArt.scene(cv.getContext('2d'), 56, 30, card, 0);
    return cv;
  }
  function backCanvas(rarity){
    const cv = document.createElement('canvas');
    cv.width = 70; cv.height = 98; cv.className = 'pk-back-cv';
    PackArt.back(cv.getContext('2d'), 70, 98, rarity);
    return cv;
  }
  function esc(s){ return String(s).replace(/[&<>"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[ch]); }
  function make(card, opts = {}){
    const t = PackArt.tier(card.tier);
    const el = document.createElement('div');
    el.className = 'pk-card';
    el.dataset.rarity = card.rarity; el.dataset.kind = card.kind; el.dataset.tier = card.tier;
    el.style.setProperty('--tier', t.body); el.style.setProperty('--tier-hi', t.hi); el.style.setProperty('--tier-lo', t.lo); el.style.setProperty('--tier-band', t.band);
    let mid = '';
    if (card.kind === 'chips'){
      mid = '<div class="pk-cf-big tabular">' + money(card.chips) + '</div><div class="pk-cf-note">ADDED TO YOUR BANKROLL</div>';
    } else if (card.kind === 'cosmetic'){
      mid = '<div class="pk-cf-rule">' + esc(card.rule) + '</div>';
    } else {
      const stats = '<div class="pk-cf-stats">' +
        '<span><small>BUY-IN</small><b class="tabular">' + money(card.buyIn) + '</b></span>' +
        '<span><small>SEATS</small><b class="tabular">' + card.seats + '</b></span>' +
        (card.pays ? '<span class="is-wide"><small>PAYS</small><b class="tabular">' + esc(card.pays) + '</b></span>' : '') + '</div>';
      mid = (card.rule ? '<div class="pk-cf-rule">' + esc(card.rule) + '</div>' : '') + stats;
    }
    el.innerHTML =
      '<div class="pk-card-inner">' +
        '<div class="pk-face pk-front">' +
          '<div class="pk-cf-top"><span class="pk-cf-kind">' + KIND_LABEL[card.kind] + '</span>' +
            (card.house ? '<span class="pk-cf-house">HOUSE</span>' : '') +
            '<span class="pk-cf-tier" aria-hidden="true"></span></div>' +
          '<div class="pk-cf-art"></div>' +
          '<div class="pk-cf-title">' + esc(card.title) + '</div>' +
          '<div class="pk-cf-sub">' + esc(card.sub || '') + '</div>' +
          mid +
          '<div class="pk-cf-foot"><span class="tabular">' + t.short.slice(0, 2) + ' ' + String(card.no).padStart(2, '0') + '/' + String(card.of).padStart(2, '0') + '</span>' +
            '<span class="pk-cf-gem">' + GEM[card.rarity] + ' ' + card.rarity.toUpperCase() + '</span></div>' +
          (RANK[card.rarity] >= 2 ? '<div class="pk-foil" aria-hidden="true"><i></i></div>' : '') +
          '<div class="pk-glare" aria-hidden="true"></div>' +
        '</div>' +
        '<div class="pk-face pk-back"></div>' +
      '</div>';
    const art = el.querySelector('.pk-cf-art');
    if (card.kind === 'character' && typeof renderFace === 'function'){
      art.classList.add('is-face');
      art.appendChild(artCanvas(Object.assign({}, card, { kind:'event', seats:0 })));
      const f = document.createElement('div');
      f.className = 'pk-cf-face';
      f.innerHTML = renderFace({ faceColorIdx:card.face }, card.mood || 'idle') + '<span class="pk-cf-who">' + esc(card.who || '') + '</span>';
      art.appendChild(f);
    } else art.appendChild(artCanvas(card));
    const tierIcon = document.createElement('canvas');
    tierIcon.width = 9; tierIcon.height = 9;
    const ti = tierIcon.getContext('2d');
    const es = PackArt.spriteSize(t.emblem);
    PackArt.sprite(ti, t.emblem, Math.floor((9 - es.w) / 2), Math.floor((9 - es.h) / 2), { o:'#F4EFE1', y:'#F6D06B', W:'#FFFFFF', k:t.ink });
    el.querySelector('.pk-cf-tier').appendChild(tierIcon);
    el.querySelector('.pk-back').appendChild(backCanvas(card.rarity));
    if (opts.faceDown) el.classList.add('is-down');
    return el;
  }
  /* the little version in the case: art, title, gem */
  function mini(card, count, isNew){
    const t = PackArt.tier(card.tier);
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'pk-mini';
    el.dataset.rarity = card.rarity; el.dataset.kind = card.kind; el.dataset.id = card.id;
    el.style.setProperty('--tier', t.body); el.style.setProperty('--tier-band', t.band);
    el.innerHTML = '<span class="pk-mini-kind">' + KIND_LABEL[card.kind] + '</span><span class="pk-mini-art"></span>' +
      '<span class="pk-mini-title">' + esc(card.title) + '</span><span class="pk-mini-gem">' + GEM[card.rarity] + '</span>' +
      (count > 1 ? '<span class="pk-mini-count tabular">×' + count + '</span>' : '') +
      (isNew ? '<span class="pk-mini-new">NEW</span>' : '') +
      (RANK[card.rarity] >= 2 ? '<span class="pk-foil" aria-hidden="true"><i></i></span>' : '');
    const art = el.querySelector('.pk-mini-art');
    if (card.kind === 'character' && typeof renderFace === 'function'){
      art.classList.add('is-face');
      art.innerHTML = renderFace({ faceColorIdx:card.face }, card.mood || 'idle');
    } else art.appendChild(artCanvas(card));
    return el;
  }
  return { LIST, byId, byTier, RANK, KIND_LABEL, open, make, mini, money, artCanvas };
})();
