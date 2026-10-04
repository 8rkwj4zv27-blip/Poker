"use strict";

/* ============================================================
   CARD FACES — the fronts of the cards (Workshop → Cards → Face)

   settings.cardFace, put on <body> as data-face by applyTheme():
     classic   the machine's own: the index top left, one big pip
     standard  a real deck: an index in two corners (the bottom one upside
               down), the pips laid out as on a casino card, framed court
               cards with a pixel crown, a big ace
     jumbo     a poker-room jumbo-index deck: the full-size index in two
               corners, one small pip in the middle
     royals    the cast as the royals: the classic face, but J, Q and K
               wear a face from the cast (King smug, Queen neutral, Jack
               nervous), one colour per suit
     misprint  the machine prints its own cards, badly: off-register ink,
               a wonky index, specks on the card

   cardInner() (js/06-presentation.js) adds the parts every face may use:
   a second index (.ci-flip) and the art (.cf). They are hidden unless a
   face shows them (css/02-screens.css hides them; css/card-faces.css
   shows them), and they are aria-hidden: the card's own label is
   unchanged. Each face decides by the card's own width (a container
   query), so the same card works at every size the game draws it, and
   tiny cards (results, hand rankings) stay classic.

   The royals' faces are the cast's portraits (FACE_ART), tinted once at
   load into small images (the face's hue, as FACE_COLORS does), so no
   filter runs while a card moves.

   Presentation only.
   ============================================================ */
const CardFaces = (() => {
  const FACES = [
    { id:'classic',  name:'Classic',  note:'The machine’s own: a big index and one big pip.' },
    { id:'standard', name:'Standard', note:'A real deck: an index in both corners, the pips laid out, framed court cards.' },
    { id:'jumbo',    name:'Jumbo',    note:'A poker-room deck: the big index in both corners, a small pip between.' },
    { id:'royals',   name:'Royals',   note:'The cast play the court cards: smug Kings, cool Queens, nervous Jacks.' },
    { id:'misprint', name:'Misprint', note:'The machine printed these itself: off-register ink and a wonky index.' }
  ];

  // where the pips sit on a number card: x across (0 left column, .5 the
  // middle, 1 right column), y down (0 to 1); the lower half is upside down
  const PIPS = {
    2:[[.5,0],[.5,1]],
    3:[[.5,0],[.5,.5],[.5,1]],
    4:[[0,0],[1,0],[0,1],[1,1]],
    5:[[0,0],[1,0],[.5,.5],[0,1],[1,1]],
    6:[[0,0],[1,0],[0,.5],[1,.5],[0,1],[1,1]],
    7:[[0,0],[1,0],[.5,.25],[0,.5],[1,.5],[0,1],[1,1]],
    8:[[0,0],[1,0],[.5,.25],[0,.5],[1,.5],[.5,.75],[0,1],[1,1]],
    9:[[0,0],[1,0],[0,1/3],[1,1/3],[.5,.5],[0,2/3],[1,2/3],[0,1],[1,1]],
    10:[[0,0],[1,0],[.5,1/6],[0,1/3],[1,1/3],[0,2/3],[1,2/3],[.5,5/6],[0,1],[1,1]]
  };
  const COURT = { J:1, Q:1, K:1 };

  // the parts a face may show (cardInner adds them to every face-up card)
  function art(card){
    const r = String(card.rank), s = card.suit;
    let inner = '<i class="cf-mid">' + s + '</i>';
    if (PIPS[r]) inner += PIPS[r].map(([x, y]) => '<i class="cf-p' + (y > .5 ? ' cf-dn' : '') + '" style="--x:' + x + ';--y:' + y.toFixed(3) + '">' + s + '</i>').join('');
    if (COURT[r]){
      const half = '<i class="cf-crown"></i><span class="cf-l">' + r + '</span><span class="cf-s">' + s + '</span>';
      inner += '<b class="cf-half">' + half + '</b><b class="cf-half cf-dn">' + half + '</b><i class="cf-mug"></i>';
    }
    const kind = COURT[r] ? 'court' : (r === 'A' ? 'ace' : 'num');
    return '<div class="cf" data-k="' + kind + '" data-r="' + r + '" aria-hidden="true">' + inner + '</div>';
  }
  // misprint's wobble: the same card is always printed the same wrong way
  function wobble(card){
    const r = String(card.rank);
    return ((r.charCodeAt(0) * 7 + r.length * 3 + String(card.suit).charCodeAt(0)) % 5);
  }

  /* ---- the royals' faces: tinted once, kept as small images ---- */
  const MUGS = { K:'smug1', Q:'neutral1', J:'nervous1' };
  // one face colour per suit (FACE_COLORS): hearts red, diamonds orange,
  // clubs blue, spades purple. The cast's portraits are the purple-fill
  // batch, recoloured the game's own way (faceTintK: each output channel
  // is k*r + (1-k)*(g+b)/2, so black and white stay put)
  const SUIT_COLOUR = { heart:'red', diamond:'orange', club:'blue', spade:'purple' };
  function tintRows(name){
    const c = FACE_COLORS.find(x => x.name === name);
    if (!c || name === 'purple') return null;
    return faceTintK(c.fill, FACE_SOURCE_FAMILIES.purple.sourceFill);
  }
  const SIZE = 96;
  let mugsStarted = false;
  function makeMugs(){
    if (mugsStarted || typeof FACE_ART === 'undefined' || typeof faceTintK === 'undefined') return;
    mugsStarted = true;
    const root = document.documentElement;
    let left = Object.keys(MUGS).length;
    Object.entries(MUGS).forEach(([rank, key]) => {
      const img = new Image();
      img.onload = () => {
        try{
          const cv = document.createElement('canvas'); cv.width = cv.height = SIZE;
          const ctx = cv.getContext('2d');
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(img, 0, 0, SIZE, SIZE);
          const src = ctx.getImageData(0, 0, SIZE, SIZE);
          Object.entries(SUIT_COLOUR).forEach(([suit, name]) => {
            const k = tintRows(name), out = ctx.createImageData(SIZE, SIZE), a = src.data, b = out.data;
            for (let i = 0; i < a.length; i += 4){
              const R = a[i], gb = (a[i + 1] + a[i + 2]) / 2;
              for (let c = 0; c < 3; c++) b[i + c] = k ? Math.max(0, Math.min(255, k[c] * R + (1 - k[c]) * gb)) : a[i + c];
              b[i + 3] = a[i + 3];
            }
            ctx.putImageData(out, 0, 0);
            root.style.setProperty('--mug-' + rank + '-' + suit, 'url(' + cv.toDataURL() + ')');
          });
        }catch(e){ /* a face that can't be read stays a pip */ }
        if (--left === 0) root.dataset.mugs = 'ready';
      };
      img.onerror = () => { --left; };
      img.src = FACE_ART[key];
    });
  }
  // the faces are made the first time Royals is on (or browsed)
  function sync(){ if ((document.body && document.body.dataset.face) === 'royals') makeMugs(); }
  function watch(){ sync(); new MutationObserver(sync).observe(document.body, { attributes:true, attributeFilter:['data-face'] }); }
  if (document.body) watch(); else document.addEventListener('DOMContentLoaded', watch);

  function choose(id){
    if (!FACES.some(f => f.id === id)) id = 'classic';
    settings.cardFace = id; saveSettings();
    document.body.setAttribute('data-face', id);
    if (id === 'royals') makeMugs();
  }

  return { FACES, art, wobble, choose, makeMugs };
})();
