/* ============================================================
   INVITATION CARDS LAB — runs inside the game copy (invitation-cards-lab
   .html). Lays the proposed first catalogue (js/invitation-cards.js) over
   the real game as a gallery, sorted by rarity. Tap a card to look at it
   with its terms. Only an event whose rules the game really has offers
   PLAY (the Back Room invitation), and it plays in this in-memory copy;
   every other card says what it still needs and launches nothing.
   ============================================================ */
(() => {
  'use strict';
  const IC = window.InvitationCards;
  const ORDER = ['common', 'uncommon', 'rare', 'legendary'];
  let filter = 'all', root = null, sheet = null, reopen = null;
  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

  function cards(){
    return IC.CATALOGUE.filter(e => filter === 'all' || e.rarity === filter)
      .sort((a, b) => ORDER.indexOf(a.rarity) - ORDER.indexOf(b.rarity));
  }
  function render(){
    root.querySelector('.invl-grid').innerHTML = cards().map(e =>
      '<button class="invl-pick" type="button" data-id="' + e.id + '">' + IC.cardHTML(e) + '</button>').join('');
    root.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));
  }
  function build(){
    root = el('<div class="invl" role="dialog" aria-label="Invitation cards">' +
      '<div class="invl-head"><div class="invl-brand">INVITATIONS<small>PROPOSED FIRST CATALOGUE · PLACEHOLDER ART</small></div>' +
        '<button class="ccl-key invl-close" type="button" aria-label="Show the table">TABLE</button></div>' +
      '<div class="invl-filters">' + ['all'].concat(ORDER).map(r =>
        '<button class="ccl-key" type="button" data-filter="' + r + '">' + (r === 'all' ? 'ALL' : IC.RARITY[r].code) + '</button>').join('') + '</div>' +
      '<div class="invl-grid"></div>' +
      '<p class="invl-note">PLAYABLE · DEV: plays in this copy. NOT BUILT YET: standard poker, still to build. ' +
        'SPECIAL RULES: needs its own rules stage. PROVISIONAL: terms not settled (TBC).</p>' +
      '</div>');
    root.addEventListener('click', e => {
      const f = e.target.closest('[data-filter]');
      if (f){ filter = f.dataset.filter; render(); return; }
      const pick = e.target.closest('.invl-pick');
      if (pick){ open(IC.CATALOGUE.find(c => c.id === pick.dataset.id)); return; }
      if (e.target.closest('.invl-close')) hide();
    });
    document.body.appendChild(root);
    reopen = el('<button class="ccl-key invl-reopen" type="button" aria-label="Show the invitation cards">CARDS</button>');
    reopen.addEventListener('click', show);
    document.body.appendChild(reopen);
    render();
  }
  function show(){ root.hidden = false; reopen.hidden = true; }
  function hide(){ closeSheet(); root.hidden = true; reopen.hidden = false; }

  function open(entry){
    const d = IC.describe(entry);
    const row = (k, v) => '<div class="invl-row"><span>' + k + '</span><b>' + esc(v) + '</b></div>';
    const verdict = d.playable ? '' : d.status === 'special'
      ? '<p class="invl-verdict">SPECIAL RULES · Can’t be played yet: these rules need their own stage, so no normal poker table stands in for them.</p>'
      : '<p class="invl-verdict">NOT BUILT YET · Standard poker; the event isn’t in the game yet.</p>';
    sheet = el('<div class="invl-sheet" role="dialog" aria-label="' + esc(d.title) + '"><div class="invl-sheet-card">' + IC.cardHTML(entry) + '</div>' +
      '<div class="invl-readout pc-display crt" data-crt-quiet>' + row('RARITY', d.rarity) + row('PLAYERS', d.players) + row('LENGTH', d.hands) +
        row('PAID', d.paid) + row('PRIZES', d.prizes) + '<p class="invl-rules">' + esc(d.rules) + '</p><p class="invl-small">' + esc(d.note) + '</p></div>' +
      verdict +
      '<div class="invl-keys"><button class="ccl-key" type="button" data-act="back">BACK</button>' +
        (d.playable ? '<button class="ccl-key ccl-finish-key" type="button" data-act="play">PLAY IN THIS COPY</button>' : '') + '</div></div>');
    sheet.addEventListener('click', e => {
      const act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'back') closeSheet();
      if (act.dataset.act === 'play') play(d.eventId);
    });
    root.appendChild(sheet);
  }
  function closeSheet(){ if (sheet){ sheet.remove(); sheet = null; } }

  // Plays only an event the game really has, through the real Career entry
  // (the copy's storage is in memory). DEV is switched on here, in the copy,
  // because invitation events are DEV only.
  function play(eventId){
    if (!eventId || typeof careerEventById !== 'function' || !careerEventById(eventId)) return;
    DEV_MODE = true;
    hide();
    // playing uses up a card (Stage 2): this copy gives itself one first
    if (careerEventState(eventId) === 'available' && !careerInvitations().some(c=>c.eventId === eventId)) giveCareerInvitation(eventId, 'common');
    if (!devPlayCareerInvitation()){
      show();
      root.querySelector('.invl-note').textContent = 'The table is busy: finish or abandon the event in play first.';
    }
  }

  const start = () => { if (!root){ build(); show(); } };
  if (document.readyState === 'complete') setTimeout(start, 600);
  else window.addEventListener('load', () => setTimeout(start, 600));
})();
