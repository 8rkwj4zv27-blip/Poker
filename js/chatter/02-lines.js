/* ============================================================
   CHATTER — LINE LIBRARY
   Prototype-scale test material ONLY. Roughly eight one-liners per
   resident across ten triggers, plus eight authored exchanges.

   This is deliberately NOT the final writing library. It exists so the
   visual and audio prototype has something honest to render: real
   speaker identity, real length variance, real reply timing.

   Shape:
     LINES[residentId][trigger] = [ {t:text, m:moodRole} ]
     EXCHANGES = [ {trigger, cast:[ids], beats:[{who,t,m}]} ]

   `m` is a SEMANTIC role, resolved to that resident's own FACE_ART key
   by ChatterResidents.moodArt() — so the same role reads as a smirk on
   Harry and as almost nothing on Lucy, which is the point.

   Anti-tell contract: not one line here refers to a hole card, an
   equity, a pending decision or anything else the speaker could not
   know from public table events. Chatter must never leak information.
   ============================================================ */
(function(global){
  'use strict';

  var TRIGGERS = [
    { key:'table-intro',       label:'Table intro',       chance:0.85 },
    { key:'player-return',     label:'Player returns',    chance:0.75 },
    { key:'repeat-fold',       label:'Repeated folds',    chance:0.30 },
    { key:'repeat-aggression', label:'Repeated raises',   chance:0.35 },
    { key:'bluff-caught',      label:'Bluff caught',      chance:0.60 },
    { key:'bluff-worked',      label:'Bluff worked',      chance:0.45 },
    { key:'big-pot-win',       label:'Big pot won',       chance:0.55 },
    { key:'showdown-surprise', label:'Surprise showdown', chance:0.50 },
    { key:'lull',              label:'Slow decision',     chance:0.22 },
    { key:'knockout',          label:'Knockout',          chance:0.70 }
  ];

  var LINES = {
    harry:{
      'table-intro':      [{t:"Oh good. You again.", m:'sly'},
                           {t:"Budge up, I've had a day.", m:'wound'}],
      'player-return':    [{t:"He's back. Told you.", m:'smug'}],
      'repeat-fold':      [{t:"Fold, fold, fold. Riveting.", m:'sly'},
                           {t:"Are we playing or filing?", m:'wound'}],
      'repeat-aggression':[{t:"Someone's had a coffee.", m:'sly'}],
      'bluff-caught':     [{t:"Worth a go.", m:'rattled'},
                           {t:"You weren't meant to do that.", m:'cross'}],
      'bluff-worked':     [{t:"Never had it. Never once.", m:'pleased'}],
      'big-pot-win':      [{t:"That's coming out of your wages.", m:'pleased'}],
      'showdown-surprise':[{t:"Where did THAT live?", m:'rattled'}],
      'lull':             [{t:"Take your time. I'll age.", m:'wound'}],
      'knockout':         [{t:"Say goodnight, sunshine.", m:'wild'}]
    },
    tony:{
      'table-intro':      [{t:"Here we go! Lovely table this.", m:'pleased'}],
      'player-return':    [{t:"There he is! Get in.", m:'wound'}],
      'repeat-fold':      [{t:"Patience. I respect it.", m:'smug'}],
      'repeat-aggression':[{t:"Oh he's SWINGING now.", m:'wild'},
                           {t:"Big man. Big, big man.", m:'wound'}],
      'bluff-caught':     [{t:"Ohhh he had nothing!", m:'wild'}],
      'bluff-worked':     [{t:"Beautiful. Just beautiful.", m:'pleased'}],
      'big-pot-win':      [{t:"That is a POT. Look at it.", m:'pleased'}],
      'showdown-surprise':[{t:"No. No! Show me again.", m:'rattled'}],
      'lull':             [{t:"Whenever you're ready, chief.", m:'smug'}],
      'knockout':         [{t:"Unlucky mate. Genuinely.", m:'cross'}]
    },
    lucy:{
      'table-intro':      [{t:"Evening.", m:'rest'}],
      'player-return':    [{t:"Still here, then.", m:'smug'}],
      'repeat-fold':      [{t:"Sensible.", m:'rest'}],
      'repeat-aggression':[{t:"Loud hands, quiet cards.", m:'sly'}],
      'bluff-caught':     [{t:"Thought so.", m:'smug'}],
      'bluff-worked':     [{t:"You'll want that back later.", m:'sly'}],
      'big-pot-win':      [{t:"Thank you.", m:'smug'}],
      'showdown-surprise':[{t:"Huh.", m:'rattled'}],
      'lull':             [{t:"Clock's fine. Take a week.", m:'cross'}],
      'knockout':         [{t:"Door's behind you.", m:'smug'}]
    },
    nigel:{
      'table-intro':      [{t:"Right. Let's keep it civil.", m:'smug'}],
      'player-return':    [{t:"Back for more punishment, I see.", m:'smug'}],
      'repeat-fold':      [{t:"Finally, someone with discipline.", m:'pleased'}],
      'repeat-aggression':[{t:"This is not how the game is played.", m:'cross'},
                           {t:"Absolutely reckless. Note it.", m:'wound'}],
      'bluff-caught':     [{t:"I did say. I said it out loud.", m:'wound'}],
      'bluff-worked':     [{t:"A technicality. Nothing more.", m:'smug'}],
      'big-pot-win':      [{t:"Correct play, correctly rewarded.", m:'pleased'}],
      'showdown-surprise':[{t:"That cannot be right.", m:'rattled'}],
      'lull':             [{t:"There is a clock, you know.", m:'cross'}],
      'knockout':         [{t:"Predictable, in hindsight.", m:'smug'}]
    },
    steve:{
      'table-intro':      [{t:"Deck's warm. Been handled.", m:'cross'}],
      'player-return':    [{t:"You brought the weather with you.", m:'sly'}],
      'repeat-fold':      [{t:"He's waiting for something. I felt it.", m:'smug'}],
      'repeat-aggression':[{t:"That's not confidence. That's a signal.", m:'cross'}],
      'bluff-caught':     [{t:"Knew it. The chair told me.", m:'smug'}],
      'bluff-worked':     [{t:"The cards allowed it.", m:'sly'}],
      'big-pot-win':      [{t:"That pot was always his. Ask the felt.", m:'wild'}],
      'showdown-surprise':[{t:"Something moved. Did nobody see it?", m:'rattled'}],
      'lull':             [{t:"He's listening to it. Good. Good.", m:'smug'}],
      'knockout':         [{t:"He was never really sat down.", m:'wild'}]
    }
  };

  /* Length-test material — the same trigger at three deliberate widths,
     so the Lab can prove each treatment against a two-word reaction, a
     normal line, and an over-long line nobody should ever write. */
  var LENGTH_TESTS = {
    short:  { t:"Nope.", m:'cross' },
    medium: { t:"That's the third time you've done that to me.", m:'wound' },
    long:   { t:"I want it on record that I folded the better hand there, and that nobody at this table has the decency to acknowledge it.", m:'cross' }
  };

  /* Authored exchanges. Two-beat is the common case; three-beat is rare
     and reserved for a genuine punchline. Cast is checked against who
     is actually seated before one is used. */
  var EXCHANGES = [
    { trigger:'table-intro', cast:['harry','nigel'], beats:[
      {who:'harry', t:"Nigel's wearing the lucky jumper.", m:'sly'},
      {who:'nigel', t:"It is a cardigan.", m:'cross'}
    ]},
    { trigger:'repeat-aggression', cast:['nigel','lucy'], beats:[
      {who:'nigel', t:"He's raising every single hand.", m:'cross'},
      {who:'lucy',  t:"And you're calling every single one.", m:'smug'}
    ]},
    { trigger:'bluff-caught', cast:['tony','harry','lucy'], beats:[
      {who:'tony',  t:"He had NOTHING!", m:'wild'},
      {who:'harry', t:"I had a plan.", m:'rattled'},
      {who:'lucy',  t:"You had nothing.", m:'smug'}
    ]},
    { trigger:'bluff-worked', cast:['steve','nigel'], beats:[
      {who:'steve', t:"The deck wanted that.", m:'sly'},
      {who:'nigel', t:"The deck wants nothing, Steven.", m:'cross'}
    ]},
    { trigger:'big-pot-win', cast:['tony','lucy'], beats:[
      {who:'tony', t:"What a pot! What a POT!", m:'pleased'},
      {who:'lucy', t:"It's forty quid, Tony.", m:'rest'}
    ]},
    { trigger:'lull', cast:['harry','tony'], beats:[
      {who:'harry', t:"He's thinking. Bless him.", m:'sly'},
      {who:'tony',  t:"Let him cook!", m:'wound'}
    ]},
    { trigger:'showdown-surprise', cast:['nigel','harry','steve'], beats:[
      {who:'nigel', t:"That cannot be right.", m:'rattled'},
      {who:'harry', t:"Check his sleeves.", m:'sly'},
      {who:'steve', t:"I already did.", m:'smug'}
    ]},
    { trigger:'knockout', cast:['harry','tony'], beats:[
      {who:'harry', t:"And he's gone.", m:'wild'},
      {who:'tony',  t:"Have some respect. Awful. Anyway.", m:'cross'}
    ]}
  ];

  function linesFor(residentId, trigger){
    var byRes = LINES[residentId];
    return (byRes && byRes[trigger]) || null;
  }

  function exchangesFor(trigger, seatedIds){
    return EXCHANGES.filter(function(x){
      if (x.trigger !== trigger) return false;
      return x.beats.every(function(b){ return seatedIds.indexOf(b.who) !== -1; });
    });
  }

  global.ChatterLines = {
    TRIGGERS: TRIGGERS,
    LINES: LINES,
    EXCHANGES: EXCHANGES,
    LENGTH_TESTS: LENGTH_TESTS,
    linesFor: linesFor,
    exchangesFor: exchangesFor,
    triggerMeta: function(key){
      for (var i=0;i<TRIGGERS.length;i++) if (TRIGGERS[i].key===key) return TRIGGERS[i];
      return null;
    }
  };
})(this);
