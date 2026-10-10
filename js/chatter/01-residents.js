/* ============================================================
   CHATTER — RESIDENT ADAPTER

   This file used to hold its own copy of the five residents: names,
   portrait colours, biographies and expression vocabularies, all
   duplicated from nothing and editable independently of the game. The
   Enemy Personality pass promoted that cast into production, so the copy
   is gone and this is now an ADAPTER over the one canonical registry in
   `js/03-residents.js`.

   THE BOUNDARY, stated once. Only the identity module crosses it. It is
   pure data with no DOM, no game state, no save access and no AI, so the
   prototype gains a shared cast without gaining a dependency on the
   engine — and the arrow only points one way: nothing in production
   reads anything from js/chatter/.

   What the adapter still owns, because it is chatter's business and not
   the game's: the `ChatterResidents` API shape, and the inert
   `venues` / `rivals` / `record` fields the director and any future
   familiarity work expect to find on a record.
   ============================================================ */
(function(global){
  'use strict';

  var source = (global.TheResidents && global.TheResidents.all) || null;
  if (!source){
    // Loud rather than silently empty: a stage that forgot to load
    // js/03-residents.js should fail visibly, not act as though the
    // house has nobody in it.
    throw new Error('ChatterResidents requires js/03-residents.js to be loaded first');
  }

  /* One projected record per production resident. `moods` and `rest` are
     the production expression vocabulary verbatim — the semantic roles
     ('smug', 'sly', 'pleased', 'wound', 'rattled', 'cross', 'wild') that
     02-lines.js tags its lines with live on the canonical record now, so
     the authored line library needs no change at all. */
  var RESIDENTS = source.map(function(res){
    return {
      id:res.id,
      name:res.name,
      faceColorIdx:res.faceColorIdx,
      style:res.style,
      blurb:res.blurb,
      voice:res.voice,
      chattiness:res.chattiness,
      rest:res.rest,
      moods:res.moods,
      venues:[],                                     // venue-specific rosters
      rivals:[],                                     // resident-to-resident feeling
      record:{ encounters:0, koByPlayer:0, koOfPlayer:0 }
    };
  });

  var BY_ID = {};
  RESIDENTS.forEach(function(r){ BY_ID[r.id] = r; });

  /* A resident rendered through the production portrait pipeline needs
     only the two fields renderFace() actually reads. Kept as one helper
     so no caller has to know that. */
  function facePlayer(res){
    return { faceColorIdx: res.faceColorIdx, name: res.name, isHuman:false };
  }

  /* Resolves a semantic mood role ('smug','rattled', ...) to this
     resident's own FACE_ART key, falling back to their resting face so
     an unlisted role can never produce a broken portrait. */
  function moodArt(res, role){
    if (!res) return 'idle';
    if (!role || role === 'rest') return res.rest;
    return (res.moods && res.moods[role]) || res.rest;
  }

  global.ChatterResidents = {
    all: RESIDENTS,
    byId: function(id){ return BY_ID[id] || null; },
    ids: RESIDENTS.map(function(r){ return r.id; }),
    facePlayer: facePlayer,
    moodArt: moodArt
  };
})(this);
