"use strict";

/* ============================================================
   CARTOON FACES
   ============================================================ */
function hslHex(h, s, l){
  s/=100; l/=100;
  const k = n => (n + h/30) % 12;
  const a = s * Math.min(l, 1-l);
  const f = n => {
    const v = l - a * Math.max(-1, Math.min(Math.min(k(n)-3, 9-k(n)), 1));
    return Math.round(255*v).toString(16).padStart(2,'0');
  };
  return '#' + f(0) + f(8) + f(4);
}

/* Moods: idle, think, happy, sad, angry, smug, shock, dead */
function faceSVG(mood, hue){
  let skin  = hslHex(hue, 48, 66);
  let shade = hslHex(hue, 44, 52);
  const ink = '#20302c';
  if (mood === 'dead'){ skin = '#A8ACA4'; shade = '#82867E'; }

  let eyes, brows, mouth, extra = '';
  switch(mood){
    case 'dead':
      // X eyes and a lolling tongue — properly, cartoonishly dead
      eyes  = '<path d="M12 16 L18 22 M18 16 L12 22" stroke="'+ink+'" stroke-width="2.4" stroke-linecap="round"/>' +
              '<path d="M22 16 L28 22 M28 16 L22 22" stroke="'+ink+'" stroke-width="2.4" stroke-linecap="round"/>';
      brows = '';
      mouth = '<path d="M13 28 h11" stroke="'+ink+'" stroke-width="2.2" stroke-linecap="round"/>' +
              '<rect x="21" y="28" width="6" height="8" rx="3" fill="#C0453F" stroke="'+ink+'" stroke-width="1.6"/>';
      break;
    case 'happy':
      eyes  = '<path d="M12 18.6 q3 -3.4 6 0" stroke="'+ink+'" stroke-width="2" fill="none" stroke-linecap="round"/>' +
              '<path d="M22 18.6 q3 -3.4 6 0" stroke="'+ink+'" stroke-width="2" fill="none" stroke-linecap="round"/>';
      brows = '<path d="M11 12 q4 -2 7 -0.6" stroke="'+ink+'" stroke-width="1.7" fill="none" stroke-linecap="round"/>' +
              '<path d="M22 11.4 q3 -1.4 7 0.6" stroke="'+ink+'" stroke-width="1.7" fill="none" stroke-linecap="round"/>';
      mouth = '<path d="M13 25 q7 7 14 0" stroke="'+ink+'" stroke-width="2.1" fill="none" stroke-linecap="round"/>';
      break;
    case 'sad':
      // inner ends of the brows lift — this is what separates sad from angry
      eyes  = '<circle cx="15" cy="19.6" r="2.1" fill="'+ink+'"/><circle cx="25" cy="19.6" r="2.1" fill="'+ink+'"/>';
      brows = '<path d="M11 15.4 q3.6 -3 7 -3.4" stroke="'+ink+'" stroke-width="1.8" fill="none" stroke-linecap="round"/>' +
              '<path d="M29 15.4 q-3.6 -3 -7 -3.4" stroke="'+ink+'" stroke-width="1.8" fill="none" stroke-linecap="round"/>';
      mouth = '<path d="M14 29 q6 -6 12 0" stroke="'+ink+'" stroke-width="2.1" fill="none" stroke-linecap="round"/>';
      break;
    case 'angry':
      // inner ends drive down toward the nose
      eyes  = '<circle cx="15" cy="20" r="2.2" fill="'+ink+'"/><circle cx="25" cy="20" r="2.2" fill="'+ink+'"/>';
      brows = '<path d="M10.5 12.2 L18.6 16.4" stroke="'+ink+'" stroke-width="2.3" stroke-linecap="round"/>' +
              '<path d="M29.5 12.2 L21.4 16.4" stroke="'+ink+'" stroke-width="2.3" stroke-linecap="round"/>';
      mouth = '<path d="M14 28.6 q6 -4.4 12 0" stroke="'+ink+'" stroke-width="2.1" fill="none" stroke-linecap="round"/>';
      break;
    case 'smug':
      eyes  = '<path d="M12.4 19.4 q2.8 -2 5.6 0" stroke="'+ink+'" stroke-width="2" fill="none" stroke-linecap="round"/>' +
              '<path d="M22.4 19.4 q2.8 -2 5.6 0" stroke="'+ink+'" stroke-width="2" fill="none" stroke-linecap="round"/>';
      brows = '<path d="M11 13.4 q4 -1.4 7 -0.4" stroke="'+ink+'" stroke-width="1.7" fill="none" stroke-linecap="round"/>' +
              '<path d="M22 10.4 q3.4 -1.6 7 0.4" stroke="'+ink+'" stroke-width="1.9" fill="none" stroke-linecap="round"/>';
      mouth = '<path d="M14 26 q6 4.4 11 -1.6" stroke="'+ink+'" stroke-width="2.1" fill="none" stroke-linecap="round"/>';
      break;
    case 'shock':
      eyes  = '<circle cx="15" cy="19" r="3.1" fill="#fff"/><circle cx="15" cy="19" r="1.5" fill="'+ink+'"/>' +
              '<circle cx="25" cy="19" r="3.1" fill="#fff"/><circle cx="25" cy="19" r="1.5" fill="'+ink+'"/>';
      brows = '<path d="M11 10.4 q4 -1.8 7 -0.4" stroke="'+ink+'" stroke-width="1.7" fill="none" stroke-linecap="round"/>' +
              '<path d="M22 10 q3 -1.4 7 0.4" stroke="'+ink+'" stroke-width="1.7" fill="none" stroke-linecap="round"/>';
      mouth = '<ellipse cx="20" cy="28" rx="3.2" ry="3.9" fill="'+ink+'"/>';
      break;
    case 'think':
      eyes  = '<circle cx="16" cy="18.6" r="2.1" fill="'+ink+'"/><circle cx="26" cy="18.6" r="2.1" fill="'+ink+'"/>';
      brows = '<path d="M11 12.8 q4 -1.8 7 -0.6" stroke="'+ink+'" stroke-width="1.7" fill="none" stroke-linecap="round"/>' +
              '<path d="M22 10.8 q3.4 -1.4 7 0.6" stroke="'+ink+'" stroke-width="1.7" fill="none" stroke-linecap="round"/>';
      mouth = '<path d="M15.5 27.6 q4.5 -1.8 9 0" stroke="'+ink+'" stroke-width="2" fill="none" stroke-linecap="round"/>';
      extra = '<circle cx="32" cy="9" r="1.7" fill="#fff" opacity=".85"><animate attributeName="opacity" values=".15;.9;.15" dur="1.4s" repeatCount="indefinite"/></circle>';
      break;
    default: // idle
      eyes  = '<circle cx="15" cy="19" r="2.2" fill="'+ink+'"/><circle cx="25" cy="19" r="2.2" fill="'+ink+'"/>';
      brows = '<path d="M11 12.6 q4 -1.6 7 -0.4" stroke="'+ink+'" stroke-width="1.7" fill="none" stroke-linecap="round"/>' +
              '<path d="M22 12.2 q3 -1.4 7 0.4" stroke="'+ink+'" stroke-width="1.7" fill="none" stroke-linecap="round"/>';
      mouth = '<path d="M15 27 q5 1.8 10 0" stroke="'+ink+'" stroke-width="2" fill="none" stroke-linecap="round"/>';
  }

  return '<svg class="face" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<rect x="0" y="0" width="40" height="40" fill="'+skin+'"/>' +
    '<rect x="0" y="24" width="40" height="16" fill="'+shade+'" opacity=".5"/>' +
    brows + eyes + mouth + extra +
    '</svg>';
}


/* A proper pixel heart: 9x8 grid of hard blocks with a stepped outline and
   a single highlight pixel — filled/empty state handled by CSS on .h/.off */
function pixelHeartSVG(){
  return '<svg class="pxheart" viewBox="0 0 9 8" aria-hidden="true">' +
    '<path fill="currentColor" d="M1 1h2v1H1zM6 1h2v1H6zM0 2h4v1H0zM5 2h4v1H5zM0 3h9v2H0zM1 5h7v1H1zM2 6h5v1H2zM3 7h3v1H3z"/>' +
    '<rect x="1" y="2" width="1" height="1" fill="rgba(255,255,255,.55)"/>' +
  '</svg>';
}

/* ============================================================
   FACE ART — one illustrated portrait set per expression, shared by
   every opponent regardless of AI personality (rock/shark/maniac/etc).
   Appearance and personality are deliberately decoupled: a `rock` and a
   `maniac` seated at the same table can end up wearing the same face in
   different colours, and that's fine — the roster isn't limited to the
   four personas that used to own custom art.

   Every file below is authored in one hue ("red"); every other palette
   colour is produced at runtime with a CSS hue-rotate filter (see
   FACE_COLORS/faceHue) rather than shipping the art 8x over. Checked
   against the actual supplied red/blue/yellow/purple variants first —
   plain hue-rotate reproduces them closely enough to read as clean,
   distinct colours, and black linework/white eyes stay put since
   rotating a grayscale pixel is a no-op.

   idle/think/happy/smug/sad/shock/angry/dead are the original hand-drawn
   set — extracted from the old maniac/professor/wildcard/shark base64
   art, which turned out to be the same 8 drawings recoloured per
   persona (see assets/faces/legacy-*.jpg; one copy kept instead of
   four). Everything else is the newer expression pack supplied in
   assets/faces/red-*.PNG. */
const FACE_ART = {
  idle:      'assets/faces/legacy-idle.jpg',
  think:     'assets/faces/legacy-think.jpg',
  happy:     'assets/faces/legacy-happy.jpg',
  smug:      'assets/faces/legacy-smug.jpg',
  sad:       'assets/faces/legacy-sad.jpg',
  shock:     'assets/faces/legacy-shock.jpg',
  angry:     'assets/faces/legacy-angry.jpg',
  dead:      'assets/faces/legacy-dead.jpg',
  thinking1: 'assets/faces/red-thinking01.PNG',
  thinking2: 'assets/faces/red-thinking02.PNG',
  worried:   'assets/faces/red-worried01.PNG',
  shocked:   'assets/faces/red-shocked01.PNG',
  furious:   'assets/faces/red-furious01.PNG',
  tilted:    'assets/faces/red-tilted01.PNG',
  sly:       'assets/faces/red-sly01.PNG',
  gloating:  'assets/faces/red-gloating01.PNG',
  dead1:     'assets/faces/red-dead01.PNG',
  dead2:     'assets/faces/red-dead02.PNG',
  dead3:     'assets/faces/red-dead03.PNG',

  /* ---- expression pack 0242-0275 ------------------------------------
     Deliberately keyed under NEW names rather than repointing the keys
     above: every pre-existing key keeps resolving to exactly the art it
     always did, so nothing that still asks for 'happy'/'smug'/'angry'
     changes appearance. Numeric suffixes mark genuine duplicate
     drawings of one expression (cosmetic variants), not intensity
     steps — intensity banding lives in FACE_MOOD_POOLS below. */
  neutral1:      'assets/faces/0249-neutral.PNG',
  neutral2:      'assets/faces/0250-neutral.PNG',
  neutral3:      'assets/faces/0264-neutral.PNG',
  neutral4:      'assets/faces/0265-neutral.PNG',
  neutral5:      'assets/faces/0266-neutral.PNG',
  worried1:      'assets/faces/0242-worried.PNG',
  nervous1:      'assets/faces/0243-nervous.PNG',
  nervous2:      'assets/faces/0261-nervous.PNG',
  nervous3:      'assets/faces/0269-nervous.PNG',
  veryNervous1:  'assets/faces/0247-very-nervous.PNG',
  veryNervous2:  'assets/faces/0270-very-nervous.PNG',
  terrified1:    'assets/faces/0273-terrified.PNG',
  panic1:        'assets/faces/0244-panic.PNG',
  shocked1:      'assets/faces/0272-shocked.PNG',
  suspicious1:   'assets/faces/0245-suspicious.PNG',
  suspicious2:   'assets/faces/0262-suspicious.PNG',
  confused1:     'assets/faces/0253-confused.PNG',
  confused2:     'assets/faces/0254-confused.PNG',
  baffled1:      'assets/faces/0268-baffled.PNG',
  happyConfused1:'assets/faces/0255-happy-confused.PNG',
  smug1:         'assets/faces/0246-smug.PNG',
  cocky1:        'assets/faces/0248-cocky.PNG',
  cocky2:        'assets/faces/0257-cocky.PNG',
  scheming1:     'assets/faces/0251-scheming.PNG',
  sly1:          'assets/faces/0258-sly.PNG',
  gloating1:     'assets/faces/0259-gloating.PNG',
  manic1:        'assets/faces/0260-manic.PNG',
  happy1:        'assets/faces/0252-happy.PNG',
  happy2:        'assets/faces/0267-happy.PNG',
  relieved1:     'assets/faces/0263-relieved.PNG',
  joyful1:       'assets/faces/0274-joyful.PNG',
  ecstatic1:     'assets/faces/0256-ecstatic.PNG',
  angry1:        'assets/faces/0271-angry.PNG',
  displeased1:   'assets/faces/0275-displeased.PNG'
};
// Last-resort mapping down to the 8 moods faceSVG() actually knows how to
// draw, for the (shouldn't-happen-now) case a mood key has no FACE_ART
// entry at all — keeps renderFace from ever producing a broken image.
const FACE_SVG_FALLBACK = {
  thinking1:'think', thinking2:'think', sly:'smug', worried:'sad',
  tilted:'angry', shocked:'shock', furious:'angry', gloating:'smug',
  dead1:'dead', dead2:'dead', dead3:'dead',
  // expression pack 0242-0275 — same last-resort role as the rows above
  neutral1:'idle', neutral2:'idle', neutral3:'idle', neutral4:'idle', neutral5:'idle',
  worried1:'sad', nervous1:'sad', nervous2:'sad', nervous3:'sad',
  veryNervous1:'sad', veryNervous2:'sad', terrified1:'shock',
  panic1:'shock', shocked1:'shock',
  suspicious1:'think', suspicious2:'think',
  confused1:'think', confused2:'think', baffled1:'think', happyConfused1:'happy',
  smug1:'smug', cocky1:'smug', cocky2:'smug', scheming1:'smug', sly1:'smug',
  gloating1:'smug', manic1:'happy',
  happy1:'happy', happy2:'happy', relieved1:'happy', joyful1:'happy', ecstatic1:'happy',
  angry1:'angry', displeased1:'angry'
};

/* Which moods get swapFace()'s hard face-jolt shake rather than the softer
   face-pop. Extracted from an inline array literal so that wiring a new
   expression in is a one-line addition HERE rather than a silently-missed
   edit inside swapFace() — a new punchy face that isn't listed just gets
   the gentle pop, which reads as a bug but never throws. */
const FACE_JOLT_MOODS = [
  'shock','angry','shocked','furious','tilted',
  'angry1','shocked1','panic1','terrified1','manic1'
];

/* ---- presentation mood -> candidate art ------------------------------
   Family AND intensity together choose the candidate pool; cosmetic
   variant selection then happens only WITHIN that band. This is why the
   bands exist rather than one pool per family: an opponent at the top of
   the NERVOUS ladder must never randomly show 'worried', and one mildly
   pleased must never flash 'ecstatic'. Bands are ordered ascending and
   read as "up to this intensity"; the last band catches 1.0.

   Every pool here is a list of MOOD KEYS in FACE_ART above — no file
   paths, so the art can be re-pointed without touching mood logic.

   NOTE (anti-tell): nothing in this file ever sees hole cards, equity,
   bluff state or a pending decision. Pools are indexed purely by
   (family, intensity), and both of those are computed from public
   events only — see faceMood/nudgeFaceMood in 03-opponents.js. */
const FACE_MOOD_POOLS = {
  neutral: [
    { max: 1.01, pool: ['neutral1','neutral2','neutral3','neutral4','neutral5','idle'] }
  ],
  positive: [
    { max: 0.35, pool: ['relieved1','happy1'] },
    { max: 0.70, pool: ['happy1','happy2','joyful1'] },
    { max: 1.01, pool: ['ecstatic1','joyful1'] }
  ],
  confident: [
    { max: 0.35, pool: ['smug1','sly1'] },
    { max: 0.70, pool: ['cocky1','cocky2','scheming1'] },
    { max: 1.01, pool: ['gloating1','manic1'] }
  ],
  irritated: [
    { max: 0.55, pool: ['displeased1'] },
    { max: 1.01, pool: ['angry1'] }
  ],
  nervous: [
    { max: 0.30, pool: ['worried1'] },
    { max: 0.60, pool: ['nervous1','nervous2','nervous3'] },
    { max: 0.85, pool: ['veryNervous1','veryNervous2'] },
    { max: 1.01, pool: ['terrified1'] }
  ],
  uncertain: [
    { max: 0.50, pool: ['suspicious1','suspicious2','confused1','confused2'] },
    { max: 1.01, pool: ['baffled1','confused1','confused2'] }
  ],
  shock: [
    { max: 0.75, pool: ['shocked1'] },
    { max: 1.01, pool: ['panic1'] }
  ]
};
const FACE_MOOD_FAMILIES = Object.keys(FACE_MOOD_POOLS);

/* The candidate pool for a (family, intensity) pair. Unknown families
   fall back to neutral rather than throwing — a bad family name should
   degrade to a plain portrait, never to an empty seat. */
function faceMoodPool(family, intensity){
  const bands = FACE_MOOD_POOLS[family] || FACE_MOOD_POOLS.neutral;
  const i = Math.max(0, Math.min(1, Number(intensity) || 0));
  for (const b of bands){ if (i < b.max) return b.pool; }
  return bands[bands.length-1].pool;
}
/* Picks one mood key from the (family, intensity) band, avoiding an
   immediate repeat of whatever that seat last showed so repeated events
   don't always produce the identical drawing. Degrades gracefully when a
   band holds only one entry (most of them do) — then repetition is
   simply correct, not something to work around.

   `lastKey` is cosmetic memory only. The draw is Math.random() over an
   already-decided band, so it can never carry information: it selects
   WHICH drawing of a mood the player can already infer, never which
   mood. */
function pickFaceExpression(family, intensity, lastKey){
  const pool = faceMoodPool(family, intensity);
  if (!pool.length) return 'idle';
  if (pool.length === 1) return pool[0];
  const choices = pool.filter(k=>k !== lastKey);
  const from = choices.length ? choices : pool;
  return from[Math.floor(Math.random()*from.length)];
}

/* ---- opponent portrait recolouring ----
   Every portrait in FACE_ART is a flat three-colour drawing: a character
   fill, near-black linework #0E0E18, near-white eyes/teeth #F3F3FF, plus
   a darker shaded fill for cheeks/shading. BUT there are now TWO batches
   authored in two different reference hues, confirmed by sampling the
   shipped PNGs' actual pixels — not assumed:
     - the original red-/legacy- batch:   fill (233,42,42)
     - the newer 0242-0275 batch:         fill (171,85,216) = #AB55D8,
       which is exactly FACE_COLORS's own 'purple' target below.
   A recolour matrix solved for one batch's fill, fed the OTHER batch's
   pixels, does not land on the target — it produces a de-saturated
   near-grey (verified: e.g. solving for 'orange' against the red fill
   and then applying that same matrix to the purple fill's actual RGB
   yields (170,161,151), not orange). So which matrix applies depends on
   which batch supplied the art being shown, not just on the opponent's
   target colour — see FACE_SOURCE_FAMILIES/FACE_ART_PURPLE_SOURCE below.

   Recolouring used to be a hue-rotate()/saturate()/brightness() chain.
   That can only push the source around — it can't be aimed at a specific
   colour — and the saturate/brightness needed to drag a dark, desaturated
   source out of the muddy band it passes through is exactly what made
   several stops read neon or olive. So each entry declares the exact
   colour its FILL should become, and the recolouring matrix is DERIVED
   from that target instead of being eyeballed.

   The matrix rows are [k, (1-k)/2, (1-k)/2] — one free parameter per
   output channel, solved so the fill lands precisely on the target:

       out_c = k_c * r + (1 - k_c) * (g + b) / 2
       k_c   = (target_c - mid0) / (r0 - mid0)      mid0 = (g0 + b0) / 2

   Two properties fall out of this for free, with no saturation or
   brightness pushing anywhere, REGARDLESS of which batch's source fill r0
   was solved from:
     - every row sums to 1, so any neutral pixel maps to itself: black
       linework stays black and white stays white BY CONSTRUCTION, not by
       being checked afterwards;
     - the map is linear, so a shaded/cheek fill becomes a proportionally
       darker version of the new colour rather than being crushed dark or
       blown out bright.

   `hue` is now only the true hue angle of each target, used solely by the
   inert procedural faceSVG() fallback — nothing recolours through it.

   Index order note: `indigo` deliberately sits at index 2, the slot the
   retired `gold` used to hold, so every other saved faceColorIdx keeps
   the colour it already had. Only the one genuinely replaced stop moves.
   Colour is still assigned per player and never derived from persona —
   FACE_COLORS/faceColorIdx are the opponent's colour IDENTITY and are
   untouched by anything below; only which FILTER expresses that identity
   for a given piece of art changes. */
const FACE_COLORS = [
  { name:'red',    hue:0,   fill:'#E92A2A', filter:'' },  // pristine for the red batch — see FACE_SOURCE_FAMILIES.red.pristineIndex
  { name:'orange', hue:32,  fill:'#DF8E2F', filter:'url(#face-tint-1)' },
  { name:'indigo', hue:240, fill:'#6969C9', filter:'url(#face-tint-2)' },
  { name:'green',  hue:136, fill:'#4E9F63', filter:'url(#face-tint-3)' },
  { name:'teal',   hue:179, fill:'#4B9D9C', filter:'url(#face-tint-4)' },
  { name:'blue',   hue:217, fill:'#6EA6FF', filter:'url(#face-tint-5)' },
  { name:'purple', hue:279, fill:'#AB55D8', filter:'url(#face-tint-6)' },  // pristine for the purple batch — see FACE_SOURCE_FAMILIES.purple.pristineIndex
  { name:'pink',   hue:335, fill:'#D3578B', filter:'url(#face-tint-7)' }
];
/* One entry per art batch: its measured source fill, and which
   FACE_COLORS index that fill already equals (so that one target can
   skip filtering — an identity matrix through the DOM for no reason). */
const FACE_SOURCE_FAMILIES = {
  red:    { sourceFill:[233, 42, 42],  pristineIndex:0, idPrefix:'face-tint'        },
  purple: { sourceFill:[171, 85, 216], pristineIndex:6, idPrefix:'face-tint-purple' }
};
/* Which FACE_ART keys are drawn from the 0242-0275 (purple-fill) batch
   rather than the original red-/legacy- batch. An explicit list rather
   than inferring from the semantic mood name, so mis-tagging a key's
   source family can't happen silently when a mood is renamed or a new
   one is added — see requirement to keep source-family lookup explicit. */
const FACE_ART_PURPLE_SOURCE = new Set([
  'neutral1','neutral2','neutral3','neutral4','neutral5',
  'worried1','nervous1','nervous2','nervous3',
  'veryNervous1','veryNervous2','terrified1','panic1','shocked1',
  'suspicious1','suspicious2','confused1','confused2','baffled1','happyConfused1',
  'smug1','cocky1','cocky2','scheming1','sly1','gloating1','manic1',
  'happy1','happy2','relieved1','joyful1','ecstatic1',
  'angry1','displeased1'
]);
/* Solves the three k values retargeting ONE source fill to ONE target
   fill (see the block above). */
function faceTintK(hex, sourceFill){
  const r0 = sourceFill[0]/255;
  const mid0 = (sourceFill[1] + sourceFill[2]) / 510;
  return [1,3,5].map(i=>((parseInt(hex.slice(i,i+2),16)/255) - mid0) / (r0 - mid0));
}
/* The purple batch's filter per FACE_COLORS index — the batch's own
   analogue of each entry's `.filter` field above (which is, and remains,
   the red-batch filter; kept there rather than moved, so the one existing
   direct read of it — the home-screen hero faces in 08-dev-mode.js, which
   only ever cycle red-batch moods — needs no change). Plain id strings,
   computable eagerly with no DOM dependency. */
const FACE_TINT_PURPLE = FACE_COLORS.map((c,i)=>
  i === FACE_SOURCE_FAMILIES.purple.pristineIndex ? '' : 'url(#'+FACE_SOURCE_FAMILIES.purple.idPrefix+'-'+i+')'
);
/* Builds one batch's set of <filter> defs — the same shape as the
   original single-batch version, just parameterised over which source
   family it's solving from. */
function buildTintFilterDefs(family){
  return FACE_COLORS.map((c,i)=>{
    if (i === family.pristineIndex) return '';
    const rows = faceTintK(c.fill, family.sourceFill).map(k=>{
      const off = ((1-k)/2).toFixed(4);
      return k.toFixed(4)+' '+off+' '+off+' 0 0';
    }).join(' ');
    return '<filter id="'+family.idPrefix+'-'+i+'" color-interpolation-filters="sRGB">'+
      '<feColorMatrix type="matrix" values="'+rows+' 0 0 0 1 0"/></filter>';
  }).join('');
}
/* Builds the <filter> defs BOTH batches' url(#...) entries point at, once,
   into a zero-size hidden <svg> on the document. Idempotent.
   color-interpolation-filters MUST be sRGB — SVG's default is linearRGB,
   which would miss every target by a wide margin. */
function installFaceTintFilters(){
  if (typeof document === 'undefined' || document.getElementById('face-tint-defs')) return;
  const filters = buildTintFilterDefs(FACE_SOURCE_FAMILIES.red) + buildTintFilterDefs(FACE_SOURCE_FAMILIES.purple);
  // Built as an HTML string inside a plain <div> rather than via
  // createElementNS + innerHTML: the HTML parser's own foreign-content
  // rules put <svg>/<filter>/<feColorMatrix> in the SVG namespace and fix
  // the camelCase tag names for us, which is the better-supported path.
  const host = document.createElement('div');
  host.id = 'face-tint-defs';
  host.setAttribute('aria-hidden','true');
  host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
  host.innerHTML = '<svg width="0" height="0"><defs>'+filters+'</defs></svg>';
  document.body.appendChild(host);
}
if (typeof document !== 'undefined'){
  if (document.body) installFaceTintFilters();
  else document.addEventListener('DOMContentLoaded', installFaceTintFilters);
}

/* Assigns every opponent still missing one a stable FACE_COLORS index —
   called once when a table's players are created (newGame) and again on
   resume (restoreTable) to backfill any player a save from before this
   system existed doesn't already have one. Shuffled rather than
   sequential so a 4-opponent table doesn't always show the same 4
   colours in seat order; only ever touches players without a colour
   already, so an existing table's assignments never shuffle out from
   under a player mid-session. */
function assignFaceColors(players){
  const used = new Set(players.filter(p=>Number.isInteger(p.faceColorIdx)).map(p=>p.faceColorIdx));
  const pool = shuffle(FACE_COLORS.map((_,i)=>i));
  let cursor = 0;
  players.forEach(p=>{
    if (p.isHuman || Number.isInteger(p.faceColorIdx)) return;
    while (used.has(pool[cursor % pool.length]) && used.size < pool.length) cursor++;
    const idx = pool[cursor % pool.length];
    p.faceColorIdx = idx;
    used.add(idx);
    cursor++;
  });
}
function faceHue(p){
  const c = p && Number.isInteger(p.faceColorIdx) && FACE_COLORS[p.faceColorIdx];
  return c ? c.hue : 0;
}
/* The opponent's target colour always comes from p.faceColorIdx alone —
   mood/art never changes WHICH colour an opponent is. `mood` here only
   selects which of the two calibrated filter sets expresses that same
   target colour correctly for the batch the art was drawn in. */
function faceFilter(p, mood){
  const idx = p && Number.isInteger(p.faceColorIdx) ? p.faceColorIdx : null;
  if (idx === null || !FACE_COLORS[idx]) return '';
  return FACE_ART_PURPLE_SOURCE.has(mood) ? FACE_TINT_PURPLE[idx] : FACE_COLORS[idx].filter;
}

function faceArtPath(mood){
  return FACE_ART[mood] || FACE_ART[FACE_SVG_FALLBACK[mood]] || FACE_ART.idle;
}
/* Every opponent seat renders through here. Art no longer keys off
   personality.key — see FACE_ART above — and colour comes from the
   player's own faceColorIdx (assignFaceColors), not their personality
   either. faceArtPath() always resolves to SOME file (idle is the final
   fallback), so the procedural SVG branch below is otherwise dead — the
   img can still fail at the network/decode level though (uncached
   expression variant while offline, a corrupted fetch, a genuinely
   missing file), and nothing was catching that: a broken <img> just
   renders as an empty box, an empty seat. onerror on the tag below
   routes any such failure through faceImgFallback (idle image first,
   then the fully offline-safe procedural SVG), so a load failure can
   never produce a blank portrait. */
function renderFace(p, mood){
  const path = faceArtPath(mood);
  const filter = faceFilter(p, mood);
  const hue = faceHue(p);
  if (path){
    const style = filter ? ' style="filter:'+filter+'"' : '';
    return '<img class="face face-img" src="'+path+'"'+style+' alt="" draggable="false"' +
      ' onerror="faceImgFallback(this,'+hue+')">';
  }
  return faceSVG(FACE_SVG_FALLBACK[mood] || mood, hue);
}
/* Runtime rescue for a face <img> that failed to load (see renderFace).
   Step 1: retry once against the idle portrait — cheap, and almost
   certainly already cached (it's the default/most-shown expression).
   Step 2: if THAT also fails (or was already the image that just failed),
   drop the whole <img> for the procedural SVG face, which draws itself
   from vector paths and needs no network/cache at all — the guaranteed
   last resort, so a broken/missing asset can never leave an empty seat. */
function faceImgFallback(img, hue){
  if (!img || !img.parentNode) return;
  if (img.dataset.faceFallback !== 'idle' && img.src.indexOf(FACE_ART.idle) === -1){
    img.dataset.faceFallback = 'idle';
    img.src = FACE_ART.idle;
    return;
  }
  const wrap = document.createElement('span');
  wrap.innerHTML = faceSVG('idle', hue||0);
  const svg = wrap.firstElementChild;
  if (svg) img.parentNode.replaceChild(svg, img);
}

/* Preloads one image and reports whether it's genuinely paintable — used
   by swapFace() so a portrait's currently-visible art is never torn down
   before its replacement has actually finished loading. `img.complete`
   can already be true synchronously right after `src` is set when the
   browser already has the image decoded (warm cache) — that's what lets
   the common case swap with no perceptible delay; onload/onerror cover
   the case where a real fetch is still in flight. */
function loadImage(path, onOk, onFail){
  const img = new Image();
  let settled = false;
  const done = ok=>{
    if (settled) return;
    settled = true;
    if (ok) onOk(); else onFail();
  };
  img.onload = ()=>done(true);
  img.onerror = ()=>done(false);
  img.src = path;
  if (img.complete) done(!!img.naturalWidth);
}

/* Atomic portrait swap — the single place a live opponent's face actually
   gets written to the DOM (setMood, resetRunSeatDOM's idle reset,
   playDeath, playElimination/playEliminationGroup's shock/dead beats).
   Preloads the target mood's art via loadImage() and only replaces
   e.avatar's innerHTML once it's confirmed paintable, so the
   currently-visible portrait is never removed while its replacement is
   still loading — closing the blank-portrait gap a bare
   `avatar.innerHTML = renderFace(...)` leaves open on anything slower
   than an already-warm cache hit.

   A per-seat monotonic token (e._faceReq) guards every async completion
   below: if a newer swapFace() call for the same seat has started since
   this one began, its result is silently dropped instead of landing over
   the newer mood — this is what stops a slow "think" load from clobbering
   a "shock" that was requested (and already painted) after it.

   Falls back through the same idle -> procedural-SVG ladder
   faceImgFallback() already provides for a failure discovered
   post-insertion, just resolved here BEFORE anything is written, so a
   load failure never produces a blank portrait either.

   `animate` mirrors setMood's existing face-pop/face-jolt beat — passed
   false from the elimination/reset paths below, none of which ever
   triggered that animation. */
function swapFace(e, p, mood, animate){
  if (!e || !e.avatar) return;
  const token = (e._faceReq = (e._faceReq||0) + 1);
  const stillCurrent = ()=> e._faceReq === token && e.avatar;
  const paint = renderMood=>{
    if (!stillCurrent()) return;
    e.avatar.innerHTML = renderFace(p, renderMood);
    if (animate && !motionOff()){
      const f = e.avatar.querySelector('.face');
      const jolt = FACE_JOLT_MOODS.includes(mood);
      if (f){
        f.classList.remove('face-pop','face-jolt'); void f.offsetWidth;
        f.classList.add(jolt ? 'face-jolt' : 'face-pop');
      }
    }
  };
  const finalFallback = ()=>{
    if (!stillCurrent()) return;
    e.avatar.innerHTML = faceSVG('idle', faceHue(p));
  };
  const path = faceArtPath(mood);
  loadImage(path,
    ()=>paint(mood),
    ()=>{
      if (path === FACE_ART.idle){ finalFallback(); return; }
      loadImage(FACE_ART.idle, ()=>paint('idle'), finalFallback);
    }
  );
}

/* ---- reaction-sequence lock ------------------------------------------
   While a seat holds a lock, ordinary mood updates are suppressed, so a
   routine resting-face update can't cut a deliberate multi-step reaction
   in half. Exactly ONE field (e._faceLock, holding the owning sequence's
   token) does this — there is deliberately no priority ladder, because
   the only thing that must outrank a reaction is elimination, and
   elimination already wins two other ways: it bypasses setMood()
   entirely, and every sequence step re-checks p.eliminated, which
   resolveEliminations()/processLives() set SYNCHRONOUSLY before their
   ceremony's first await.

   e._faceLock is orthogonal to swapFace()'s e._faceReq: _faceReq answers
   "is this the newest image load for this seat", _faceLock answers
   "which chain owns this seat's expression right now". */
let faceSeqCounter = 0;
function clearFaceLock(playerId){
  const e = seatEls[playerId];
  if (e) e._faceLock = null;
}

function setMood(playerId, mood){
  const e = seatEls[playerId];
  if (!e || !e.avatar || !settings.faces) return;
  const p = game && game.players.find(x=>x.id===playerId);
  if (!p || p.isHuman || p.eliminated) return;
  if (e._faceLock != null) return;   // a reaction sequence owns this seat
  if (e._mood === mood) return;
  e._mood = mood;
  swapFace(e, p, mood, true);
}

/* Plays a short expression chain (e.g. shocked -> angry -> displeased)
   for one opponent. `steps` is [{mood, ms}, ...]; the LAST step is the
   one that stays on screen, and its ms is how long ordinary mood updates
   stay suppressed afterwards, i.e. the hold.

   Deliberately fire-and-forget: callers do not await it, so the pot
   payout/chip-flight beats and the next deal never wait on a face. A
   sequence still running when the next hand begins is cut short there
   (startNewHand clears every lock before any new-hand portrait update),
   which is why an abandoned sequence can never freeze a stale face into
   a new hand.

   Respects settings.faces exactly like setMood() does — a player who has
   turned faces off must not start seeing reaction chains. */
async function playReactionSequence(playerId, steps){
  const e = seatEls[playerId];
  if (!e || !e.avatar || !settings.faces) return;
  if (!Array.isArray(steps) || !steps.length) return;
  const p = game && game.players.find(x=>x.id===playerId);
  if (!p || p.isHuman || p.eliminated) return;

  const mine = ++faceSeqCounter;
  e._faceLock = mine;                     // claimed BEFORE the first await
  const owns = ()=> e._faceLock === mine && !p.eliminated && e.avatar;
  const paint = mood=>{ e._mood = mood; swapFace(e, p, mood, true); };

  try{
    if (motionOff()){
      // Reduced motion: land straight on the expression the chain was
      // heading for, no intermediate beats — same convention
      // playEliminationGroup already uses.
      const last = steps[steps.length-1];
      if (owns() && last) paint(last.mood);
      return;
    }
    for (const step of steps){
      if (!owns()) return;
      paint(step.mood);
      await sleep(step.ms);
    }
  } finally {
    // Only the owner releases: if a newer sequence (or a reset) took the
    // seat mid-chain, its lock must survive this one unwinding.
    if (e._faceLock === mine) e._faceLock = null;
  }
}
const Store = (function(){
  let memory = {};
  let usable = null;
  function probe(){
    if (usable !== null) return usable;
    try{
      const k='__felt_probe__';
      window.localStorage.setItem(k,'1');
      window.localStorage.removeItem(k);
      usable = true;
    } catch(e){ usable = false; }
    return usable;
  }
  return {
    get(key, fallback){
      try{
        if (probe()){
          const raw = window.localStorage.getItem(key);
          if (raw !== null) return JSON.parse(raw);
        } else if (key in memory) return memory[key];
      } catch(e){ if (key in memory) return memory[key]; }
      return fallback;
    },
    set(key, value){
      memory[key] = value;
      try{ if (probe()) window.localStorage.setItem(key, JSON.stringify(value)); }
      catch(e){ /* stay in memory */ }
    },
    remove(key){
      delete memory[key];
      try{ if (probe()) window.localStorage.removeItem(key); }
      catch(e){ /* stay in memory */ }
    },
    persistent(){ return probe(); }
  };
})();

const DEFAULT_SETTINGS = {
  coach:false, strength:true, review:false, faces:true,
  theme:'emerald', fourColour:false, cardBack:'table', tableTalk:true,
  sound:false, haptics:true, reduceMotion:false, highContrast:false, largeText:false,
  speed:'normal', autoDeal:true, lives:true, confirmAllIn:false,
  playerName:'You', avatarColour:'#D9A93B', opponentNames:'persona',
  opponents:4, difficulty:'medium', mode:'cash', stack:1000, blindLevel:0,
  seenIntro:false, devMode:false
};
const DEFAULT_STATS = { hands:0, won:0, showdownsWon:0, biggestPot:0, net:0 };
const SAVE_VERSION = 1;
/* Bump on every release so the main-menu header shows what's actually installed. */
const BUILD_VERSION = 'v0.15.0-dev · table drum';

let settings = Object.assign({}, DEFAULT_SETTINGS, Store.get('felt.settings', {}));
// The Settings menu cleanup dropped RELAXED from the Game Speed control
// (now just NORMAL/FAST) — migrate anyone still on it so the segmented
// control has a matching active state instead of showing nothing selected.
if (settings.speed === 'relaxed') settings.speed = 'normal';
let stats = Object.assign({}, DEFAULT_STATS, Store.get('felt.stats', {}));
function saveSettings(){ Store.set('felt.settings', settings); }
function saveStats(){ Store.set('felt.stats', stats); }

const AVATAR_COLOURS = ['#D9A93B','#5FA8D3','#7FC79E','#E0716A','#B98BD3','#E0A458'];

function motionOff(){
  if (settings.reduceMotion) return true;
  try{ return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  catch(e){ return false; }
}

/* ============================================================
   SOUND (synthesised — no assets) + HAPTICS
   ============================================================ */
const Sound = (function(){
  let ctx = null;
  function ac(){
    if (!settings.sound) return null;
    if (!ctx){
      try{ const AC = window.AudioContext || window.webkitAudioContext; ctx = AC ? new AC() : null; }
      catch(e){ ctx = null; }
    }
    if (ctx && ctx.state === 'suspended'){ try{ ctx.resume(); }catch(e){} }
    return ctx;
  }
  function blip(freq, dur, type, vol, when){
    const c = ac(); if (!c) return;
    try{
      const t = c.currentTime + (when||0);
      const osc = c.createOscillator(), g = c.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol||0.06, t+0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
      osc.connect(g); g.connect(c.destination);
      osc.start(t); osc.stop(t+dur+0.02);
    } catch(e){}
  }
  /* Generalized from its original 2-arg form (dur,vol) — every pre-V1
     call site (e.g. Sound.fold(), still 2-arg) behaves EXACTLY as
     before (opts defaults reproduce the original fixed bandpass@1800Hz/
     decayPow2.5 curve). The optional 3rd `opts` arg ({filterType, freq,
     freqSweepTo, Q, decayPow}) is what SFX V1's card/button/counter
     families below build on, so every noise-based sound in the game
     — old and new — goes through this one buffer-fill implementation
     rather than each duplicating it. */
  function noise(dur, vol, opts){
    const c = ac(); if (!c) return;
    try{
      opts = opts || {};
      const n = Math.max(1, Math.floor(c.sampleRate*dur));
      const buf = c.createBuffer(1, n, c.sampleRate);
      const d = buf.getChannelData(0);
      const decayPow = opts.decayPow!=null ? opts.decayPow : 2.5;
      for (let i=0;i<n;i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/n, decayPow);
      const s = c.createBufferSource(); s.buffer = buf;
      const g = c.createGain(); g.gain.value = vol||0.05;
      const f = c.createBiquadFilter();
      f.type = opts.filterType || 'bandpass';
      const freq = opts.freq!=null ? opts.freq : 1800;
      f.frequency.setValueAtTime(freq, c.currentTime);
      if (opts.freqSweepTo!=null) f.frequency.exponentialRampToValueAtTime(Math.max(40,opts.freqSweepTo), c.currentTime+dur);
      if (opts.Q!=null) f.Q.value = opts.Q;
      s.connect(f); f.connect(g); g.connect(c.destination);
      s.start();
    } catch(e){}
  }

  /* ---- Chip SFX v0.1 (experimental) ----
     Procedural, retro/arcade "hard little impact" — a very short
     bandpassed-noise transient (the strike) layered with one or two
     brief, slightly detuned high-frequency tonal partials (the metallic
     ring), NOT a clean pitched oscillator. Every parameter below is
     randomized within a tight, restrained range per hit, so repeated
     chips read as one irregular family (tik/tink/tk/klik) rather than
     the same sample replayed. Reuses this module's own shared
     AudioContext (ac()) — no second context, same settings.sound gate
     as every other Sound.* call. chipSfxEnabled is a plain, directly
     settable property (Sound.chipSfxEnabled = false) — a deliberately
     dumb kill-switch for this experimental pass, ahead of a real
     Settings UI. activeVoices/MAX_VOICES is a hard polyphony cap; the
     density tracker below (see chipLand) softens hits before that cap
     is ever likely to bind, so a 30-50 chip cascade tapers in perceived
     loudness rather than either stacking full-volume gain or abruptly
     going silent once the cap is hit. */
  let chipActiveVoices = 0;
  const CHIP_MAX_VOICES = 10;
  let chipLandTimes = [];
  const CHIP_DENSITY_WINDOW_MS = 140;
  const CHIP_DENSITY_SOFTEN_AFTER = 4;
  /* Independent rolling windows for the pot-smash physics chips (bounce
     off a boundary / settle into the bank) — separate arrays from
     chipLandTimes so a burst of physics bounces never cross-throttles an
     unrelated concurrent AI payout's ordinary chipLand() hits, and vice
     versa. Same taper shape as chipLand's own density gate, just tuned
     per-moment: bounces soften a bit sooner (a burst is denser than an
     ordinary payout), collection is allowed a slightly wider window since
     the whole pot settling into the bank is the payoff beat and should
     read as a satisfying cascade rather than being over-silenced. */
  let chipBounceTimes = [];
  const CHIP_BOUNCE_WINDOW_MS = 140;
  const CHIP_BOUNCE_SOFTEN_AFTER = 3;
  let chipCollectTimes = [];
  const CHIP_COLLECT_WINDOW_MS = 180;
  const CHIP_COLLECT_SOFTEN_AFTER = 5;

  /* `power` — an optional intensity multiplier around 1.0, passed by
     Sound.chipBounce() (soft ping ~0.7 / normal clack 1.0 / hard plonk
     ~1.4, see maybePlayBounceSound in 06-presentation.js) and by
     Sound.chipCollect() for its own "late snap" chips (~1.3). Every other
     caller (chipLand) omits it and gets exactly the prior behaviour —
     louder AND lower-pitched for a hard hit (plonkier), quieter and
     higher-pitched for a soft one (crisper ping), rather than just a volume
     change, so collision character actually varies with how hard the hit
     was, not just how loud it is. */
  function chipClink(soft, power){
    const c = ac(); if (!c) return;
    if (chipActiveVoices >= CHIP_MAX_VOICES) return; // drop, don't stack — last-resort cap under the density taper
    chipActiveVoices++;
    let released = false;
    const release = ()=>{ if (released) return; released = true; chipActiveVoices = Math.max(0, chipActiveVoices-1); };
    setTimeout(release, 160); // safety net in case a node's own 'ended'/stop callback is ever missed — always frees the voice slot

    try{
      const t = c.currentTime;
      const p = power==null ? 1 : Math.max(0.5, Math.min(1.6, power));
      const vol = 0.05 * (soft ? 0.55 : 1) * p;

      // the strike: a very short bandpassed noise burst, hard fast decay
      const noiseDur = 0.014 + Math.random()*0.010;              // ~14-24ms
      const n = Math.max(1, Math.floor(c.sampleRate*noiseDur));
      const buf = c.createBuffer(1, n, c.sampleRate);
      const d = buf.getChannelData(0);
      const decayPow = 3.2 + Math.random()*1.6;                   // steeper = drier/harder
      for (let i=0;i<n;i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/n, decayPow);
      const src = c.createBufferSource(); src.buffer = buf;
      const nf = c.createBiquadFilter(); nf.type = 'bandpass';
      nf.frequency.value = (2600 + Math.random()*2400) / p;       // harder hit -> lower centre freq (plonkier), softer -> higher (pingier)
      nf.Q.value = 1.1 + Math.random()*0.8;
      const ng = c.createGain();
      ng.gain.value = vol * (0.55 + Math.random()*0.35);
      src.connect(nf); nf.connect(ng); ng.connect(c.destination);

      // the ring: one or two short, inharmonically-related tonal partials
      const partials = Math.random()<0.15 ? 1 : 2;
      const f1 = (1500 + Math.random()*2200) / p;                  // ~1.5-3.7kHz, shifted the same way as the strike above
      const ratio = 2.1 + Math.random()*1.1;                        // inharmonic -> metallic, not a clean pitch
      const freqs = partials===2 ? [f1, f1*ratio] : [f1];
      freqs.forEach((f,i)=>{
        const osc = c.createOscillator();
        osc.type = Math.random()<0.5 ? 'triangle' : 'square';
        osc.frequency.setValueAtTime(f, t);
        const g = c.createGain();
        const partialVol = vol * (i===0 ? 0.5 : 0.32) * (0.6 + Math.random()*0.5);
        const dur = 0.02 + Math.random()*0.03;                      // ~20-50ms, extremely short
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0005, partialVol), t+0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
        osc.connect(g); g.connect(c.destination);
        osc.start(t); osc.stop(t+dur+0.02);
      });

      src.start(t);
      src.stop(t+noiseDur+0.005);
      src.onended = release;
    } catch(e){ release(); }
  }

  /* ---- SFX V1 — physical/retro pass over the rest of the game ----
     Same procedural-Web-Audio approach as the chip pass above, same
     shared AudioContext/settings.sound gate, same "hook the real event,
     never a fake timer" rule. Organized as one shared lightweight
     polyphony guard (withVoiceCap — cards/buttons/results are far less
     dense than chips, so a single generous cap across all of them is
     enough; it does NOT need chip-land's precise real-onended tracking,
     just a coarse duration-based release) plus one function per named
     sound family below. CARD sounds are noise-only by design (no
     oscillators) — papery/dry, never tonal. BUTTON/COUNTER/RESULT/ALLIN/
     BUSTED sounds mix a noise "impact" with small tonal components for
     character. Every per-family constants object near the top of its
     section is the tuning surface — see the summary given to the user
     after implementation for the full map. */
  let miscActiveVoices = 0;
  const MISC_MAX_VOICES = 14;
  function withVoiceCap(approxDurMs, fn){
    if (miscActiveVoices >= MISC_MAX_VOICES) return;
    miscActiveVoices++;
    setTimeout(()=>{ miscActiveVoices = Math.max(0, miscActiveVoices-1); }, approxDurMs);
    try{ fn(); } catch(e){}
  }

  /* -- 2. Physical action buttons --
     PRESS = chunky compression (noise + a low thump); RELEASE = a
     smaller spring/catch tick. Both noise-and-tone, not pure oscillators
     — the noise gives the "plastic/mechanical" body, the tiny tonal tail
     gives it a catch/latch character. Weight (not pitch/melody) is what
     differentiates actions — see BUTTON_WEIGHT. */
  const BUTTON_WEIGHT = {
    check:  { pFreq:1100, pDur:0.032, pThump:150, pGain:0.045, rFreq:1900, rGain:0.03 },
    call:   { pFreq: 900, pDur:0.038, pThump:120, pGain:0.055, rFreq:1700, rGain:0.032 },
    bet:    { pFreq: 650, pDur:0.048, pThump: 95, pGain:0.065, rFreq:1500, rGain:0.034 },
    raise:  { pFreq: 600, pDur:0.052, pThump: 88, pGain:0.07,  rFreq:1450, rGain:0.036 },
    fold:   { pFreq: 500, pDur:0.05,  pThump: 0,  pGain:0.05,  rFreq:1100, rGain:0.024, dull:true },
    allin:  { pFreq: 420, pDur:0.075, pThump: 62, pGain:0.10,  rFreq:1300, rGain:0.05  },
    award:  { pFreq: 460, pDur:0.07,  pThump: 72, pGain:0.095, rFreq:1600, rGain:0.05  }
  };
  function doButtonPress(kind){
    const w = BUTTON_WEIGHT[kind] || BUTTON_WEIGHT.call;
    withVoiceCap(140, ()=>{
      const jitter = 0.9 + Math.random()*0.2;
      noise(w.pDur*jitter, w.pGain*(0.85+Math.random()*0.3), {
        filterType: w.dull ? 'lowpass' : 'bandpass',
        freq: w.pFreq*(0.92+Math.random()*0.16),
        freqSweepTo: w.dull ? w.pFreq*0.5 : undefined,
        Q: w.dull ? undefined : 1.0+Math.random()*0.6,
        decayPow: 2.2+Math.random()*0.8
      });
      if (w.pThump) blip(w.pThump*(0.94+Math.random()*0.12), 0.05+Math.random()*0.02, 'triangle', 0.05*(0.8+Math.random()*0.4));
    });
  }
  function doButtonRelease(kind){
    const w = BUTTON_WEIGHT[kind] || BUTTON_WEIGHT.call;
    if (kind==='award'){
      // KA-CHUNK: a short high 'K' transient immediately followed by a
      // heavier low 'CHUNK' — the machine physically releasing the pot.
      withVoiceCap(220, ()=>{
        noise(0.012+Math.random()*0.006, 0.05, { filterType:'highpass', freq:3200 });
        setTimeout(()=>{
          noise(0.05+Math.random()*0.015, 0.09, { filterType:'lowpass', freq:500, freqSweepTo:220, decayPow:2.4 });
          blip(70+Math.random()*10, 0.09, 'triangle', 0.06);
        }, 16+Math.random()*8);
      });
      return;
    }
    withVoiceCap(90, ()=>{
      noise(0.01+Math.random()*0.008, w.rGain*(0.8+Math.random()*0.4), { filterType:'highpass', freq:w.rFreq*(0.9+Math.random()*0.2) });
      blip(w.rFreq*0.55*(0.95+Math.random()*0.1), 0.025+Math.random()*0.01, 'sine', w.rGain*0.7);
    });
  }

  /* -- 3/4/5. Cards — dealt, landed, flipped, returned, deck settle --
     Noise-only, by design: shaped/filtered transients suggest paper and
     cardstock, never a pitched tone. Every call randomizes duration/
     filter/gain a little so ten dealt cards don't sound identical. */
  function cardDealSound(){        // FWIP/FLICK — leaves the dealer deck
    withVoiceCap(90, ()=>noise(0.05+Math.random()*0.02, 0.04+Math.random()*0.015, {
      filterType:'bandpass', freq:3200+Math.random()*1800, freqSweepTo:1400+Math.random()*600, Q:0.7+Math.random()*0.4, decayPow:2.0+Math.random()*0.6
    }));
  }
  function cardLandSound(){        // soft PAP/TAK — reaches its destination
    withVoiceCap(70, ()=>noise(0.035+Math.random()*0.015, 0.028+Math.random()*0.012, {
      filterType:'lowpass', freq:1100+Math.random()*500, decayPow:2.6+Math.random()*0.8
    }));
  }
  function cardFlipSound(strong){  // FWAP/SNAP — turns face-up
    withVoiceCap(90, ()=>noise(0.045+Math.random()*0.02, (strong?0.05:0.04)+Math.random()*0.015, {
      filterType:'bandpass', freq:2600+Math.random()*1600, freqSweepTo:5200+Math.random()*1200, Q:0.9+Math.random()*0.5, decayPow:1.8+Math.random()*0.5
    }));
  }
  function cardReturnSound(){      // frrp/fwip — magnetic return flutter
    withVoiceCap(80, ()=>{
      noise(0.03+Math.random()*0.02, 0.03+Math.random()*0.012, {
        filterType:'bandpass', freq:2800+Math.random()*2000, freqSweepTo:1200+Math.random()*600, Q:0.6+Math.random()*0.4, decayPow:2.2+Math.random()*0.6
      });
      if (Math.random()<0.35) setTimeout(()=>noise(0.018+Math.random()*0.012, 0.02, {
        filterType:'bandpass', freq:2200+Math.random()*1400, decayPow:2.4
      }), 20+Math.random()*20);
    });
  }
  function deckSettleSound(){      // firmer THK — the return cascade completes
    withVoiceCap(120, ()=>noise(0.05+Math.random()*0.015, 0.045, { filterType:'lowpass', freq:700, freqSweepTo:260, decayPow:2.3 }));
  }

  /* -- 6. Mechanical number / jackpot counter --
     Small dry relay ticks as digits settle, a firmer CLACK on lock.
     Restrained on purpose — this is only for the animated showdown
     amount reveal, not every static number in the UI. */
  function counterTickSound(mine){
    withVoiceCap(50, ()=>noise(0.012+Math.random()*0.006, (mine?0.026:0.02)*(0.8+Math.random()*0.4), {
      filterType:'highpass', freq:3600+Math.random()*1200, decayPow:3.0
    }));
  }
  function counterLockSound(mine){
    withVoiceCap(90, ()=>{
      noise(0.03+Math.random()*0.01, mine?0.05:0.038, { filterType:'bandpass', freq:2200, Q:1.2, decayPow:2.4 });
      blip(mine?900:760, 0.05, 'square', mine?0.035:0.026);
    });
  }

  /* -- 7. Showdown begins -- a short "pay attention" cue, not a sting. */
  function showdownBeginSound(){
    withVoiceCap(260, ()=>{
      noise(0.09+Math.random()*0.02, 0.07, { filterType:'lowpass', freq:380, freqSweepTo:150, decayPow:2.0 });
      blip(96, 0.16, 'triangle', 0.045);
      blip(91, 0.16, 'sine', 0.03, 0.01);
    });
  }

  /* -- 8/9/10. Showdown result stings --
     ONE function, one call per showdown — deliberately avoids ever
     layering a separate opponent-win sound on top of a separate human-
     loss sound for the same event (see the coordination note at the
     handleShowdown() call site). 'humanWin' is the deliberately bigger
     arcade-jackpot moment; 'opponentWin' is short/restrained; 'humanLose'
     shares opponentWin's impact but ends on a small descending tone
     instead of an upward one. */
  function doResultSting(kind){
    if (kind==='humanWin'){
      withVoiceCap(650, ()=>{
        noise(0.05, 0.075, { filterType:'lowpass', freq:500, freqSweepTo:220, decayPow:2.2 });
        const notes = [392, 523, 659, 880];              // short crunchy ascending run — retro, not orchestral
        notes.forEach((f,i)=>blip(f, 0.09, i%2?'square':'triangle', 0.05-i*0.004, 0.05+i*0.045));
      });
      return;
    }
    const humanLose = kind==='humanLose';
    withVoiceCap(320, ()=>{
      noise(0.05, humanLose?0.05:0.04, { filterType:'lowpass', freq:420, freqSweepTo:humanLose?140:220, decayPow:2.3 });
      if (humanLose){
        blip(220, 0.14, 'triangle', 0.032);
        blip(165, 0.16, 'triangle', 0.028, 0.06);
      } else {
        blip(330, 0.09, 'square', 0.03);
        blip(392, 0.1, 'triangle', 0.026, 0.05);
      }
    });
  }

  /* -- 11. All-in moment -- heavy physical hit + a very short low
     retro punctuation note. Shared by both the human's own button-press
     release (see buttonRelease('allin')) and an AI opponent's all-in
     (see applyAction) — never both for the same event. */
  function allInSound(mine){
    withVoiceCap(220, ()=>{
      noise(0.07, mine?0.1:0.075, { filterType:'lowpass', freq:340, freqSweepTo:130, decayPow:2.1 });
      blip(mine?118:100, 0.09, 'square', mine?0.05:0.036);
    });
  }

  /* -- 13. Busted / rebuy -- */
  function bustedSound(mine){
    withVoiceCap(400, ()=>{
      noise(0.09, mine?0.09:0.065, { filterType:'lowpass', freq:300, freqSweepTo:90, decayPow:2.0 });
      [220,175,130].forEach((f,i)=>blip(f, 0.11, 'triangle', (mine?0.04:0.028)-i*0.004, i*0.055));
    });
  }
  function rebuyConfirmSound(){
    withVoiceCap(150, ()=>{
      noise(0.02, 0.03, { filterType:'highpass', freq:2400 });
      blip(520, 0.08, 'triangle', 0.03, 0.03);
    });
  }

  /* -- 14. Human K.O. stamp -- the "you personally defeated that opponent"
     payoff, following bustedSound()'s procedural-synth pattern but bigger:
     a harder noise thump plus a short descending three-note stamp, timed
     to land under playElimination()'s stamp stage (elimination mode only). */
  function humanKOSound(){
    withVoiceCap(480, ()=>{
      noise(0.12, 0.13, { filterType:'lowpass', freq:360, freqSweepTo:80, decayPow:1.8 });
      [294,220,147].forEach((f,i)=>blip(f, 0.13, 'square', 0.055-i*0.006, i*0.06));
    });
  }

  /* -- 14b. K.O. physical-panel beats (physical-polish pass) — the panel
     itself, not the human-specific fanfare above. `mult` scales a THUNK's
     weight the same way playElimination()'s own hit escalation already
     does. koFailClick is the tiny "unlatching" tick right before the
     portrait gets blasted out (see 14d below for the ejection itself). */
  function koThunkSound(mult){
    const m = mult||1;
    withVoiceCap(200, ()=>{
      noise(0.05+m*0.008, 0.075*Math.min(1.5,m), { filterType:'lowpass', freq:310-m*18, freqSweepTo:85, decayPow:1.9 });
      blip(Math.max(58,84-m*7), 0.1, 'square', 0.042*Math.min(1.5,m));
    });
  }
  function koFailClickSound(){
    withVoiceCap(90, ()=>{
      noise(0.018, 0.045, { filterType:'highpass', freq:3200, decayPow:3 });
      blip(1400, 0.03, 'square', 0.02, 0.006);
    });
  }

  /* -- 14d. K.O. portrait ejection (physical-polish rework) — the module
     itself getting kicked out, not the panel. koBlast is the one big
     initial punch (heavier/lower than koEjectSound's old whoosh — this is
     the whole portrait leaving, not a small panel-trim sound); each
     koPortraitImpact is one meaningful mid-air ricochet, `power` scaled
     from that bounce's own velocity (see maybePlayPortraitImpact) so a
     glancing tap and a hard wall CLONK read differently, and `isExit`
     marks the final forced-exit collision with an extra bright crack on
     top. koSocketSpark is deliberately tiny — a brief contact short, not
     a particle-show sting. */
  /* THUNK-POP/BLAM — two distinct layers, not one blob: a low mechanical
     "THUNK" body (the noise sweep + low square blips, as before, just
     louder — this should read as the loudest of the three K.O. sound
     families) plus a genuinely sharp, bright "POP" transient on top (the
     new high blip) standing in for the plastic module actually releasing.
     Small per-call pitch jitter — a rapid multi-K.O. sequence fires this
     several times ~80-140ms apart, and identical repeats of one sample
     read as a stutter rather than a rhythm; a ~±10% wobble is enough that
     "POP - POP - POP - POP" sounds like a sequence of distinct hits. */
  function koBlastSound(){
    const j = 0.9 + Math.random()*0.2;
    withVoiceCap(300, ()=>{
      noise(0.06, 0.17, { filterType:'lowpass', freq:230*j, freqSweepTo:55*j, decayPow:1.5 });
      blip(78*j, 0.13, 'square', 0.11);
      blip(48*j, 0.16, 'square', 0.09, 0.02);
      blip(1200*j, 0.025, 'square', 0.05, 0.004); // the sharp plastic-release "POP" on top of the low body
    });
  }
  /* Heavy plastic/cabinet CLONK/KRAK/TOK/THUD — noticeably heavier than a
     poker-chip bounce (lower frequencies, longer noise body). Small
     per-call pitch jitter layered ON TOP of the existing power-based
     scaling so two hits at similar velocity still sound like distinct
     impacts, not one sample retriggered — same reasoning as koBlastSound.
     `isExit` (final boundary release) gets a distinctly stronger, brighter
     WHACK/KLANG on top — the portrait's actual send-off, not just another
     bounce. */
  function koPortraitImpactSound(power, isExit){
    const p = power||1;
    const j = 0.92 + Math.random()*0.16;
    withVoiceCap(isExit?340:220, ()=>{
      noise(0.04+p*0.02, (isExit?0.14:0.08)*Math.min(1.6,p), { filterType:'lowpass', freq:(260-p*20)*j, freqSweepTo:70*j, decayPow:1.8 });
      blip(Math.max(70,110-p*14)*j, 0.09, 'square', 0.06*Math.min(1.6,p));
      if (isExit){ blip(380, 0.07, 'triangle', 0.05, 0.02); blip(620, 0.03, 'square', 0.03, 0.045); }
    });
  }
  /* Multi-K.O. only — two ejected portraits colliding mid-air. Heavier/
     duller than a wall impact (a thicker double-thunk, no bright top
     note) since it's plastic-on-plastic rather than plastic-on-machine. */
  function koPortraitClackSound(power){
    const p = power||1;
    const j = 0.92 + Math.random()*0.16;
    withVoiceCap(220, ()=>{
      noise(0.05+p*0.015, 0.09*Math.min(1.5,p), { filterType:'lowpass', freq:(200-p*12)*j, freqSweepTo:55*j, decayPow:1.7 });
      blip(Math.max(55,90-p*10)*j, 0.1, 'square', 0.055*Math.min(1.5,p));
      blip(Math.max(40,64-p*8)*j, 0.09, 'square', 0.038*Math.min(1.5,p), 0.02);
    });
  }
  function koSocketSparkSound(){
    withVoiceCap(70, ()=>{
      noise(0.02, 0.04, { filterType:'highpass', freq:3800, decayPow:3.2 });
      blip(1800, 0.02, 'square', 0.018, 0.004);
    });
  }

  /* -- 14c. Bank intake hatch (physical-polish pass) — open is a small
     mechanical unlock click (light, high, brief); close is a heavier
     CLUNK (low thump + a couple of low blips) so the two ends of the
     hatch's motion are clearly distinct beats, not mirror images of each
     other. */
  function hatchOpenSound(){
    withVoiceCap(140, ()=>{
      noise(0.02, 0.05, { filterType:'highpass', freq:2600, decayPow:2.6 });
      blip(920, 0.05, 'square', 0.03, 0.01);
    });
  }
  function hatchCloseSound(){
    withVoiceCap(260, ()=>{
      noise(0.08, 0.12, { filterType:'lowpass', freq:260, freqSweepTo:75, decayPow:1.8 });
      blip(150, 0.12, 'square', 0.055);
      blip(90, 0.1, 'triangle', 0.04, 0.05);
    });
  }

  /* -- 14e. Central stage roll (mechanical loader, table-cleared/next-table
     transition) — a small physical event family, matching the hatch's
     click/clunk pairing rather than inventing new language. unlock is the
     tiny latch-release tick (same shape as hatchOpenSound, brighter/
     shorter). roll is a scheduled series of low ratchet ticks spread
     across the travel time — this module has no real audio-loop
     primitive, so a sustained mechanical texture is built the same way
     doButtonRelease()'s 'award' case schedules a follow-up hit: several
     noise ticks fired via setTimeout across the given duration, each with
     a little jitter so it doesn't read as a repeating sample. lock is the
     heavy final clunk
     when the new stage seats into the bay — deliberately the weightiest
     of the three, distinct from hatchCloseSound (lower, longer body). */
  function stageUnlockSound(){
    withVoiceCap(120, ()=>{
      noise(0.016, 0.05, { filterType:'highpass', freq:3000, decayPow:2.8 });
      blip(1500, 0.035, 'square', 0.025, 0.008);
    });
  }
  const STAGE_RATCHET_BEATS = [0.035,0.17,0.29,0.395,0.49,0.575,0.65,0.72,0.785,0.845,0.905,0.958];
  function stageRollSound(durationMs){
    const c = ac(); if (!c) return;
    const durMs = Math.max(120, durationMs||600);
    // One authored ratchet rhythm follows the drum's visible inertia:
    // reluctant widely-spaced teeth, a tightening run through the middle,
    // then opening gaps as the face brakes toward its stop. Keeping these
    // as individual impacts (rather than a loop) makes every tick belong to
    // an actual point in the travel curve.
    withVoiceCap(durMs+120, ()=>{
      STAGE_RATCHET_BEATS.forEach((beat,i)=>{
        const atMs = beat*durMs;
        const middle = 1-Math.abs((i/(STAGE_RATCHET_BEATS.length-1))*2-1);
        setTimeout(()=>{
          const j = 0.92+Math.random()*0.16;
          // A dry pawl strike is layered over the wheel's low wooden body.
          // The bright transient is what lets each visible marker read as
          // a real tooth passing beneath it on a phone speaker.
          noise(0.012+middle*0.006, (0.034+middle*0.01)*j, {
            filterType:'bandpass', freq:(1850+middle*850)*j, freqSweepTo:(980+middle*300)*j, Q:2.2, decayPow:3.2
          });
          noise(0.035+middle*0.014+Math.random()*0.006, (0.052+middle*0.014)*j, {
            filterType:'lowpass', freq:(430+middle*90)*j, freqSweepTo:(115+middle*30)*j, decayPow:2.2
          });
          blip((520+middle*180)*j, 0.025, 'square', 0.018+middle*0.007);
        }, atMs);
      });
    });
  }
  function stageLockSound(){
    withVoiceCap(420, ()=>{
      noise(0.13, 0.17, { filterType:'lowpass', freq:290, freqSweepTo:52, decayPow:1.55 });
      noise(0.026, 0.075, { filterType:'bandpass', freq:1350, freqSweepTo:520, Q:1.4, decayPow:2.8 });
      blip(118, 0.17, 'square', 0.085);
      blip(61, 0.24, 'triangle', 0.07, 0.028);
      setTimeout(()=>noise(0.065,0.065,{filterType:'lowpass',freq:170,freqSweepTo:55,decayPow:2}),34);
    });
  }
  function consoleShiftSound(){
    withVoiceCap(180, ()=>{
      noise(0.025, 0.035, { filterType:'bandpass', freq:1250, freqSweepTo:720, Q:1.2, decayPow:2.8 });
      blip(420, 0.055, 'square', 0.025);
      blip(180, 0.07, 'triangle', 0.022, 0.045);
    });
  }

  /* Arcade scoring hooks. These are deliberately synthesized from the
     existing noise/tone toolkit so the feature has a complete event API
     without adding assets or a second audio system. */
  /* Four-step escalation matching the STANDARD/STRONG/ELITE/JACKPOT
     presentation tiers — quiet crisp ding, stronger two-note hit, a
     punchier three-note sweep, then a full five-note fanfare with the
     heaviest low end, reserved for JACKPOT so it actually means
     something (section 15/20). */
  function arcadeRewardSound(tier,id){
    if (tier==='jackpot'){
      withVoiceCap(680,()=>{
        noise(.09,.11,{filterType:'lowpass',freq:520,freqSweepTo:160,decayPow:2.1});
        if (id==='ko') [392,294,196].forEach((f,i)=>blip(f,.1,'square',.045,i*.045));
        else [392,523,659,784,988].forEach((f,i)=>blip(f,.12,i%2?'square':'triangle',.05,i*.04));
      });
    } else if (tier==='elite'){
      withVoiceCap(460,()=>{
        noise(.05,.07,{filterType:'bandpass',freq:900,freqSweepTo:2600,decayPow:2.3});
        if (id==='ko') [392,294,196].forEach((f,i)=>blip(f,.09,'square',.04,i*.04));
        else [523,659,880].forEach((f,i)=>blip(f,.09,i%2?'square':'triangle',.038,i*.04));
      });
    } else if (tier==='strong'){
      withVoiceCap(320,()=>{
        noise(.03,.045,{filterType:'bandpass',freq:1800,freqSweepTo:3000,decayPow:2.2});
        [660,880].forEach((f,i)=>blip(f,.08,i%2?'square':'triangle',.032,i*.045));
      });
    } else {
      withVoiceCap(220,()=>{
        noise(.02,.03,{filterType:'bandpass',freq:2200,freqSweepTo:3400,decayPow:2.2});
        blip(740,.06,'triangle',.026);
      });
    }
  }
  function arcadeComboSound(up){
    withVoiceCap(180,()=>{
      noise(.025,.035,{filterType:'highpass',freq:2500,decayPow:3});
      blip(up?740:260,.07,'square',.03);
      blip(up?980:190,.08,'triangle',.025,.055);
    });
  }
  /* kind: 'good'/'extreme-good'/'bad'/'extreme-bad' (luck tags) or
     'negative' (a mistake message) — negative gets its own quieter, duller
     "duk" so a pointed-out mistake never sounds like a bad-luck sting. */
  function arcadeLuckSound(kind){
    if (kind==='negative'){
      blip(160,.1,'triangle',.02); blip(120,.12,'triangle',.018,.06);
      return;
    }
    const extreme=kind==='extreme-good'||kind==='extreme-bad';
    if (kind==='bad'||kind==='extreme-bad'){
      blip(245,extreme?.15:.12,'triangle',extreme?.034:.028); blip(174,extreme?.18:.15,'triangle',extreme?.03:.024,.07);
    } else { blip(740,extreme?.09:.07,'square',extreme?.03:.025); blip(988,extreme?.11:.09,'triangle',extreme?.03:.024,.06); }
  }

  /* Pot smash — the moment the TOTAL plate stamps down and breaks the pot
     apart. A heavier, drier hit than allInSound/humanKOSound (this is a
     physical OBJECT landing, not a betting action or a stamp), plus a
     short high metallic rattle right behind it standing in for the chips
     it's about to send bursting outward. */
  function scoreSmashSound(major){
    withVoiceCap(major?560:380,()=>{
      noise(major?.1:.075,major?.16:.12,{filterType:'lowpass',freq:major?260:320,freqSweepTo:major?70:100,decayPow:1.7});
      blip(major?58:74,major?.15:.12,'square',major?.08:.065);
      setTimeout(()=>noise(.03+Math.random()*.015,.035,{filterType:'highpass',freq:3000+Math.random()*1200,decayPow:2.6}),20+Math.random()*12);
    });
  }

  return {
    unlock(){ ac(); },
    /* Gated to AI opponents only as of SFX V1 — the human's own fold/
       check/call/bet/raise now comes from the physical button press/
       release family below instead (see the applyAction() call sites,
       which now guard these three with `if (!player.isHuman)`). Kept
       exactly as they were for the AI case — no redesign. */
    chip(){ blip(320,0.09,'triangle',0.05); blip(220,0.11,'sine',0.035,0.02); },
    check(){ blip(180,0.07,'sine',0.045); },
    fold(){ noise(0.13, 0.03); },
    turn(){ blip(660,0.11,'sine',0.045); blip(880,0.13,'sine',0.035,0.07); },
    /* Chip SFX v0.1 kill-switch — set Sound.chipSfxEnabled = false to A/B
       test with the experimental chip sound off, without touching the
       main sound setting. */
    chipSfxEnabled: true,
    /* Call exactly once per REAL chip landing (see flyChip's land()) —
       never from an independent timer, so the audio always follows the
       actual visible rhythm. Tracks a short rolling window of recent
       landings and, once several chips have landed within it, plays
       subsequent hits softer — a perceptual taper that kicks in well
       before the hard polyphony cap above, so a large cascade still
       reads as many individual chips rather than one wall of noise. */
    chipLand(){
      if (!this.chipSfxEnabled) return;
      const now = performance.now();
      chipLandTimes = chipLandTimes.filter(t=>now-t < CHIP_DENSITY_WINDOW_MS);
      chipLandTimes.push(now);
      chipClink(chipLandTimes.length > CHIP_DENSITY_SOFTEN_AFTER);
    },
    /* Pot-smash physics — one boundary bounce. `power` (~0.7 soft ping /
       1.0 normal clack / ~1.4 hard plonk, see maybePlayBounceSound in
       06-presentation.js) varies the hit's own character, on top of the
       existing density-window softening below. Caller (the physics
       controller) already enforces a per-chip minimum re-trigger gap so a
       single chip rattling in a corner can't itself flood this; this
       density window is the cross-chip guard for a whole burst landing at
       once. */
    chipBounce(power){
      if (!this.chipSfxEnabled) return;
      const now = performance.now();
      chipBounceTimes = chipBounceTimes.filter(t=>now-t < CHIP_BOUNCE_WINDOW_MS);
      chipBounceTimes.push(now);
      chipClink(chipBounceTimes.length > CHIP_BOUNCE_SOFTEN_AFTER, power);
    },
    /* Pot-smash physics — one chip settling into the bank during the
       magnetic collection phase. `power` (item 7) lets the last few
       "late snap" chips land with a more pronounced clack than the
       steady early cascade. */
    chipCollect(power){
      if (!this.chipSfxEnabled) return;
      const now = performance.now();
      chipCollectTimes = chipCollectTimes.filter(t=>now-t < CHIP_COLLECT_WINDOW_MS);
      chipCollectTimes.push(now);
      chipClink(chipCollectTimes.length > CHIP_COLLECT_SOFTEN_AFTER, power);
    },
    /* SFX V1 kill-switch — mirrors chipSfxEnabled, separate flag so the
       whole non-chip pass can be A/B'd off independently while testing. */
    sfxV1Enabled: true,
    buttonPress(kind){ if (this.sfxV1Enabled) doButtonPress(kind); },
    buttonRelease(kind){ if (this.sfxV1Enabled) doButtonRelease(kind); },
    cardDeal(){ if (this.sfxV1Enabled) cardDealSound(); },
    cardLanded(){ if (this.sfxV1Enabled) cardLandSound(); },
    cardFlip(strong){ if (this.sfxV1Enabled) cardFlipSound(strong); },
    cardReturn(){ if (this.sfxV1Enabled) cardReturnSound(); },
    deckSettle(){ if (this.sfxV1Enabled) deckSettleSound(); },
    counterTick(mine){ if (this.sfxV1Enabled) counterTickSound(mine); },
    counterLock(mine){ if (this.sfxV1Enabled) counterLockSound(mine); },
    showdownBegin(){ if (this.sfxV1Enabled) showdownBeginSound(); },
    resultSting(kind){ if (this.sfxV1Enabled) doResultSting(kind); },
    allIn(mine){ if (this.sfxV1Enabled) allInSound(mine); },
    busted(mine){ if (this.sfxV1Enabled) bustedSound(mine); },
    humanKO(){ if (this.sfxV1Enabled) humanKOSound(); },
    rebuy(){ if (this.sfxV1Enabled) rebuyConfirmSound(); },
    arcadeReward(tier,id){ if (this.sfxV1Enabled) arcadeRewardSound(tier,id); },
    arcadeCombo(up){ if (this.sfxV1Enabled) arcadeComboSound(up); },
    arcadeLuck(kind){ if (this.sfxV1Enabled) arcadeLuckSound(kind); },
    arcadeBankTick(){ if (this.sfxV1Enabled) counterTickSound(true); },
    arcadeBankLock(){ if (this.sfxV1Enabled) counterLockSound(true); },
    scoreSmash(major){ if (this.sfxV1Enabled) scoreSmashSound(major); },
    koThunk(mult){ if (this.sfxV1Enabled) koThunkSound(mult); },
    koFailClick(){ if (this.sfxV1Enabled) koFailClickSound(); },
    koBlast(){ if (this.sfxV1Enabled) koBlastSound(); },
    koPortraitImpact(power,isExit){ if (this.sfxV1Enabled) koPortraitImpactSound(power,isExit); },
    koPortraitClack(power){ if (this.sfxV1Enabled) koPortraitClackSound(power); },
    koSocketSpark(){ if (this.sfxV1Enabled) koSocketSparkSound(); },
    hatchOpen(){ if (this.sfxV1Enabled) hatchOpenSound(); },
    hatchClose(){ if (this.sfxV1Enabled) hatchCloseSound(); },
    stageRatchetBeats: STAGE_RATCHET_BEATS,
    stageUnlock(){ if (this.sfxV1Enabled) stageUnlockSound(); },
    stageRoll(durationMs){ if (this.sfxV1Enabled) stageRollSound(durationMs); },
    stageLock(){ if (this.sfxV1Enabled) stageLockSound(); },
    consoleShift(){ if (this.sfxV1Enabled) consoleShiftSound(); }
  };
})();
function haptic(pattern){
  if (!settings.haptics) return;
  try{ if (navigator.vibrate) navigator.vibrate(pattern); } catch(e){}
}
