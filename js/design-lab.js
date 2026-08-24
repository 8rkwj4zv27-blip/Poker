(() => {
  const FAMILIES = {
    crts: {
      title: 'C0 CRT Effects · A–G',
      key: 'pokerFaces.designLab.crtEffects.v1',
      classPrefix: 'crt-effect-',
      variants: [
        { id: 'C0-A', name: 'Balanced raster' },
        { id: 'C0-B', name: 'Phosphor bloom' },
        { id: 'C0-C', name: 'Fine grille' },
        { id: 'C0-D', name: 'Signal stutter' },
        { id: 'C0-E', name: 'Low refresh' },
        { id: 'C0-F', name: 'Sync roll' },
        { id: 'C0-G', name: 'Static burst' }
      ]
    },
    buttons: {
      title: 'B0 Press Motion · A–G',
      key: 'pokerFaces.designLab.buttonMotion.v1',
      classPrefix: 'button-motion-',
      variants: [
        { id: 'B0-A', name: 'Gentle press' },
        { id: 'B0-B', name: 'Short clack' },
        { id: 'B0-C', name: 'Soft spring' },
        { id: 'B0-D', name: 'Firm hold' },
        { id: 'B0-E', name: 'Cabinet tap' },
        { id: 'B0-F', name: 'Side rock' },
        { id: 'B0-G', name: 'Hinged press' }
      ]
    },
    frames: {
      title: 'Frames & Panels · F0–F6',
      key: 'pokerFaces.designLab.frames.v1',
      classPrefix: 'variant-',
      variants: [
        { id: 'F0', name: 'Current baseline' },
        { id: 'F1', name: 'Stepped corners' },
        { id: 'F2', name: 'Padded leather' },
        { id: 'F3', name: 'Wood rail' },
        { id: 'F4', name: 'Deep bezel' },
        { id: 'F5', name: 'Layered rim' },
        { id: 'F6', name: 'Raised crown', wildcard: true }
      ]
    },
    labels: {
      title: 'Printed Markings · P0–P4',
      key: 'pokerFaces.designLab.printedLabels.v1',
      classPrefix: 'print-',
      variants: [
        { id: 'P0', name: 'Production ink' },
        { id: 'P1', name: 'Struck impression' },
        { id: 'P2', name: 'Moulded relief' },
        { id: 'P3', name: 'Screen print' },
        { id: 'P4', name: 'Etched fill' }
      ]
    },
    /* One assembled console. The console is identical in all four; only the
       chassis differs, so the complete object settles the open frame question.
       cardClasses wear the already-approved parts rather than restating them. */
    composite: {
      title: 'Composite Console · shortlisted chassis',
      key: 'pokerFaces.designLab.composite.v1',
      classPrefix: 'composite-',
      cardClasses: 'print-p4 crt-effect-c0-g button-motion-b0-c',
      variants: [
        { id: 'F0', name: 'Current baseline chassis' },
        { id: 'F2', name: 'Padded leather chassis' },
        { id: 'F3', name: 'Wood rail chassis' },
        { id: 'F5', name: 'Layered rim chassis' }
      ]
    }
  };

  const familySelect = document.querySelector('#lab-family');
  const themeSelect = document.querySelector('#lab-theme');
  const themeOptions = [...themeSelect.options]
    .map((option) => option.value)
    .filter((value) => value !== 'all');
  const board = document.querySelector('#design-board');
  const familyTitle = document.querySelector('[data-lab-family-title]');
  const approvedSummary = document.querySelector('[data-lab-approved]');
  const shortlistSummary = document.querySelector('[data-lab-shortlist]');
  const resetButton = document.querySelector('#lab-reset');

  const freshDefaults = () => ({ theme: 'emerald', approved: null, shortlisted: [] });
  const states = {};
  let activeFamily = 'crts';

  Object.entries(FAMILIES).forEach(([familyId, family]) => {
    const nextState = freshDefaults();
    try {
      const stored = JSON.parse(window.localStorage.getItem(family.key) || 'null');
      if (stored && typeof stored === 'object') {
        nextState.theme = [...themeOptions, 'all'].includes(stored.theme) ? stored.theme : nextState.theme;
        nextState.approved = family.variants.some((variant) => variant.id === stored.approved) ? stored.approved : null;
        nextState.shortlisted = Array.isArray(stored.shortlisted)
          ? stored.shortlisted.filter((id) => family.variants.some((variant) => variant.id === id))
          : [];
      }
    } catch (error) { /* This family starts clean if stored data is malformed. */ }
    states[familyId] = nextState;
  });

  const persist = (familyId = activeFamily) => {
    try { window.localStorage.setItem(FAMILIES[familyId].key, JSON.stringify(states[familyId])); }
    catch (error) { /* The board remains usable without persistence. */ }
  };

  const frameSpecimenMarkup = () => `
    <div class="specimen-viewport">
      <div class="frame-demo">
        <div class="frame-well">
          <div class="frame-head"><span>Poker Faces</span><i aria-hidden="true"></i></div>
          <div class="frame-content">
            <div class="frame-title">Table summary</div>
            <div class="frame-rule"></div>
            <div class="frame-blocks" aria-hidden="true"><span></span><span></span><span></span></div>
          </div>
          <div class="frame-foot"><span>Table 4</span><span>Complete</span></div>
        </div>
      </div>

      <div class="panel-demo">
        <div class="panel-row">
          <div class="panel-stat"><strong>12</strong><small>Hands</small></div>
          <div class="panel-stat"><strong>$840</strong><small>Best pot</small></div>
          <div class="panel-stat"><strong>4/4</strong><small>K.O.s</small></div>
        </div>
      </div>

      <div class="corner-detail" aria-label="Enlarged corner construction detail">
        <div class="corner-sample"></div>
      </div>
    </div>`;

  const buttonSpecimenMarkup = () => `
    <div class="button-specimen-viewport">
      <div class="button-console">
        <div class="button-bank-label">Select table</div>
        <div class="launch-cradle">
          <button class="demo-control launch-button" type="button" data-demo-control>
            <i class="demo-lamp" aria-hidden="true"></i>
            <span>Single Player<small>Start elimination run</small></span>
            <i class="demo-lamp" aria-hidden="true"></i>
          </button>
        </div>
        <button class="demo-control secondary-button" type="button" data-demo-control>Career</button>
        <div class="button-row">
          <button class="demo-control compact-button" type="button" data-demo-control>Hand Rankings</button>
          <button class="demo-control compact-button" type="button" data-demo-control>Score / Awards</button>
        </div>
      </div>
    </div>`;

  const crtSpecimenMarkup = () => `
    <div class="crt-specimen-viewport">
      <div class="crt-machine-board">
        <div class="crt-board-label"><span>Table monitor</span><i aria-hidden="true"></i></div>
        <div class="crt-housing">
          <div class="crt-screen crt-role-live" data-crt-screen data-channel="0">
            <span class="crt-screen-label">Previous action</span>
            <strong data-crt-primary>Villain raises $120</strong>
            <small data-crt-secondary>Your action</small>
            <i class="crt-live-cursor" aria-hidden="true"></i>
          </div>
        </div>
        <div class="crt-role-row">
          <div class="crt-mini-screen crt-role-machine"><span>Machine</span><strong>Dealer ready</strong></div>
          <div class="crt-mini-screen crt-role-money"><span>Stack</span><strong>$840</strong></div>
          <div class="crt-mini-screen crt-role-danger"><span>Warning</span><strong>All in</strong></div>
        </div>
        <button class="crt-channel-key" type="button" data-crt-demo>Change feed</button>
      </div>
    </div>`;

  /* One physical carrier, one wording set. Only the printing changes between P0 and P4.
     Nothing here is CRT output, so nothing here glows, flickers, blinks or animates. */
  const labelSpecimenMarkup = () => `
    <div class="print-specimen-viewport">
      <div class="print-board">
        <div class="print-heading"><span>Table controls</span><i aria-hidden="true"></i></div>

        <div class="print-key print-key-primary">
          <span class="print-legend">Single Player</span>
          <small class="print-sublegend">Start elimination run</small>
        </div>

        <div class="print-plate print-plate-instrument">
          <div class="print-instrument-cell">
            <span class="print-instrument">Blind level</span>
            <i class="print-scale" aria-hidden="true"></i>
          </div>
          <div class="print-instrument-cell">
            <span class="print-instrument">Seats remaining</span>
            <i class="print-scale" aria-hidden="true"></i>
          </div>
        </div>

        <div class="print-plate print-plate-money">
          <span class="print-caption">Table stakes</span>
          <strong class="print-money">$25 min &middot; $500 max</strong>
        </div>

        <div class="print-key-row">
          <div class="print-key print-key-warning">
            <i class="print-hazard" aria-hidden="true"></i>
            <span class="print-legend-sm">Clear data</span>
            <small class="print-note">Irreversible</small>
          </div>
          <div class="print-key print-key-disabled">
            <span class="print-legend-sm">Continue</span>
            <small class="print-note">No run saved</small>
          </div>
        </div>
      </div>
    </div>`;

  /* Invented neutral console content. The production player dashboard is
     locked, so nothing here reproduces its geometry or information layout. */
  const compositeSpecimenMarkup = () => `
    <div class="composite-specimen-viewport">
      <div class="composite-console">

        <div class="composite-rail">
          <span class="print-legend-sm">Poker Faces</span>
          <span class="print-note">Table console</span>
          <i class="demo-lamp" aria-hidden="true"></i>
        </div>

        <div class="composite-crt-bay">
          <div class="crt-housing">
            <div class="crt-screen crt-role-live" data-crt-screen data-channel="0">
              <span class="crt-screen-label">Previous action</span>
              <strong data-crt-primary>Villain raises $120</strong>
              <small data-crt-secondary>Your action</small>
              <i class="crt-live-cursor" aria-hidden="true"></i>
            </div>
          </div>
          <div class="crt-role-row">
            <div class="crt-mini-screen crt-role-machine"><span>Machine</span><strong>Ready</strong></div>
            <div class="crt-mini-screen crt-role-money"><span>Pot</span><strong>$360</strong></div>
            <div class="crt-mini-screen crt-role-danger"><span>Warning</span><strong>All in</strong></div>
          </div>
        </div>

        <div class="composite-reel-bay">
          <div class="print-heading"><span>Session total</span><i aria-hidden="true"></i></div>
          <div class="reel-readout" data-composite-reel></div>
        </div>

        <div class="print-plate print-plate-instrument composite-instrument">
          <div class="print-instrument-cell">
            <span class="print-instrument">Blind level</span>
            <i class="print-scale" aria-hidden="true"></i>
          </div>
          <div class="print-instrument-cell">
            <span class="print-instrument">Seats remaining</span>
            <i class="print-scale" aria-hidden="true"></i>
          </div>
        </div>

        <div class="composite-control-bay">
          <div class="print-heading"><span>Table controls</span><i aria-hidden="true"></i></div>
          <div class="launch-cradle">
            <button class="demo-control launch-button" type="button" data-demo-control data-composite-deal>
              <i class="demo-lamp" aria-hidden="true"></i>
              <span>Deal<small>Next hand</small></span>
              <i class="demo-lamp" aria-hidden="true"></i>
            </button>
          </div>
          <button class="demo-control secondary-button" type="button" data-demo-control data-composite-cash>Cash out</button>
          <div class="button-row">
            <button class="demo-control compact-button" type="button" data-demo-control>Hand rankings</button>
            <button class="compact-button" type="button" disabled>Continue<br>No run saved</button>
          </div>
        </div>

      </div>
    </div>`;

  const SPECIMENS = {
    frames: frameSpecimenMarkup,
    buttons: buttonSpecimenMarkup,
    crts: crtSpecimenMarkup,
    labels: labelSpecimenMarkup,
    composite: compositeSpecimenMarkup
  };

  /* Mechanical numbers: the production reel treatment from js/06-presentation.js
     reproduced here so the composite demonstrates the existing system rather than
     redesigning it. Same rest/roll markup, same staggered cascade, same direction
     rule and the same 310ms settle. No sound and no production state is touched. */
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const reelRest = (cell, ch) => {
    cell.innerHTML = `<span class="reel-strip" aria-hidden="true"><span>${ch}</span><span>${ch}</span></span>`;
    cell.dataset.value = ch;
    cell.classList.remove('rolling-up', 'rolling-down');
  };

  const rollReelCell = (cell, ch, delay, direction) => {
    const old = cell.dataset.value == null ? ch : cell.dataset.value;
    window.clearTimeout(cell._reelStartT);
    window.clearTimeout(cell._reelEndT);
    cell.classList.remove('rolling-up', 'rolling-down');
    const down = direction === 'down';
    cell.innerHTML = down
      ? `<span class="reel-strip" aria-hidden="true" style="transform:translateY(-50%)"><span>${ch}</span><span>${old}</span></span>`
      : `<span class="reel-strip" aria-hidden="true"><span>${old}</span><span>${ch}</span></span>`;
    cell.dataset.value = ch;
    if (reduceMotion() || old === ch) { reelRest(cell, ch); return; }
    cell._reelStartT = window.setTimeout(() => {
      void cell.offsetWidth;
      cell.classList.add(down ? 'rolling-down' : 'rolling-up');
      cell._reelEndT = window.setTimeout(() => reelRest(cell, ch), 310);
    }, delay || 0);
  };

  const REEL_DIGITS = 6;

  const ensureReelCells = (el) => {
    const existing = [...el.querySelectorAll('.reel-digit')];
    if (existing.length === REEL_DIGITS) return existing;
    el.innerHTML = '<span class="jp-cell jp-sym" aria-hidden="true">$</span>';
    const cells = [];
    for (let i = 0; i < REEL_DIGITS; i += 1) {
      const cell = document.createElement('span');
      cell.className = 'jp-cell jp-digit reel-digit reel-cell tabular';
      reelRest(cell, '0');
      el.appendChild(cell);
      cells.push(cell);
    }
    el.dataset.reelValue = '';
    return cells;
  };

  const updateReel = (el, value, options) => {
    const opts = options || {};
    const amount = Math.max(0, Math.min(999999, Math.round(Number(value) || 0)));
    const text = String(amount).padStart(REEL_DIGITS, '0');
    const previous = Number(el.dataset.reelNumber);
    const direction = Number.isFinite(previous) && amount < previous ? 'down' : 'up';
    const cells = ensureReelCells(el);
    el.setAttribute('aria-label', `Session total: ${amount.toLocaleString()}`);
    if (el.dataset.reelValue === text) return;
    el.dataset.reelValue = text;
    el.dataset.reelNumber = String(amount);
    let leading = true;
    let changed = 0;
    cells.forEach((cell, index) => {
      const ch = text[index];
      const dim = leading && ch === '0' && index < cells.length - 1;
      if (!dim) leading = false;
      cell.classList.toggle('dim', dim);
      if (cell.dataset.value === ch) return;
      if (opts.animate === false) reelRest(cell, ch);
      else rollReelCell(cell, ch, changed * 24, direction);
      changed += 1;
    });
  };

  /* Composite demonstration state. Held outside the DOM so re-rendering the
     board (which happens on every select) redraws a settled machine rather
     than a blank one. */
  const COMPOSITE_STEPS = [12480, 13650, 15920, 24075];
  let compositeStep = 0;
  let compositeAmount = COMPOSITE_STEPS[0];

  const compositeReels = () => [...board.querySelectorAll('[data-composite-reel]')];
  const compositeCards = () => [...board.querySelectorAll('.option-card[data-variant]')]
    .filter((card) => card.querySelector('[data-composite-reel]'));

  const syncCompositeReels = () => {
    compositeReels().forEach((el) => updateReel(el, compositeAmount, { animate: false }));
  };

  const setCompositeAmount = (amount) => {
    compositeAmount = amount;
    compositeReels().forEach((el) => updateReel(el, compositeAmount));
  };

  const optionMarkup = (variant) => {
    const state = states[activeFamily];
    const shortlisted = state.shortlisted.includes(variant.id);
    const approved = state.approved === variant.id;
    const variantClass = `${FAMILIES[activeFamily].classPrefix}${variant.id.toLowerCase()}`;
    const extraClasses = FAMILIES[activeFamily].cardClasses ? ` ${FAMILIES[activeFamily].cardClasses}` : '';
    const specimen = SPECIMENS[activeFamily]();
    return `
      <article class="option-card ${variantClass}${extraClasses}${shortlisted ? ' is-shortlisted' : ''}${approved ? ' is-approved' : ''}" data-variant="${variant.id}">
        <div class="option-head">
          <h3><span>${variant.id}</span>${variant.name}</h3>
          ${variant.wildcard ? '<em>Wildcard</em>' : ''}
        </div>
        ${specimen}
        <div class="option-actions">
          <button class="shortlist-button" type="button" data-shortlist="${variant.id}" aria-pressed="${shortlisted}" aria-label="Shortlist ${variant.id}">${shortlisted ? 'Shortlisted' : 'Shortlist'}</button>
          <button class="approve-button" type="button" data-approve="${variant.id}" aria-pressed="${approved}" aria-label="Select ${variant.id}">${approved ? 'Selected' : 'Select'}</button>
        </div>
      </article>`;
  };

  const themeLabel = (theme) => themeSelect.querySelector(`option[value="${theme}"]`).textContent;

  const render = () => {
    const family = FAMILIES[activeFamily];
    const state = states[activeFamily];
    const themes = state.theme === 'all' ? themeOptions : [state.theme];
    board.innerHTML = themes.map((theme) => `
      <section class="theme-board" data-theme="${theme}" aria-labelledby="theme-${theme}">
        <h2 class="theme-board-heading" id="theme-${theme}">${themeLabel(theme)}</h2>
        <div class="option-grid">${family.variants.map(optionMarkup).join('')}</div>
      </section>`).join('');

    familySelect.value = activeFamily;
    familyTitle.textContent = family.title;
    approvedSummary.textContent = state.approved || 'None';
    shortlistSummary.textContent = state.shortlisted.length ? state.shortlisted.join(', ') : 'None';
    themeSelect.value = state.theme;
    document.body.dataset.theme = state.theme === 'all' ? 'emerald' : state.theme;

    const background = getComputedStyle(document.body).getPropertyValue('--bg-deep').trim();
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && background) meta.setAttribute('content', background);

    if (activeFamily === 'composite') syncCompositeReels();
  };

  familySelect.addEventListener('change', () => {
    activeFamily = familySelect.value;
    render();
  });

  themeSelect.addEventListener('change', () => {
    states[activeFamily].theme = themeSelect.value;
    persist();
    render();
  });

  /* Each run owns an identity token. The composite invites repeated pressing,
     and without this a finishing run would strip the class out from under the
     run that replaced it, cutting the later burst or press short. */
  let runId = 0;

  const runChannelChange = (optionCard, override) => {
    const screen = optionCard.querySelector('[data-crt-screen]');
    if (!screen) return;
    const token = String(++runId);
    optionCard.dataset.channelRun = token;
    const nextChannel = screen.dataset.channel === '0' ? '1' : '0';
    optionCard.classList.remove('is-channel-changing');
    window.requestAnimationFrame(() => {
      if (optionCard.dataset.channelRun !== token) return;
      optionCard.classList.add('is-channel-changing');
    });
    window.setTimeout(() => {
      if (optionCard.dataset.channelRun !== token) return;
      screen.dataset.channel = nextChannel;
      optionCard.querySelector('[data-crt-primary]').textContent = override
        ? override.primary
        : (nextChannel === '1' ? 'You call $120' : 'Villain raises $120');
      optionCard.querySelector('[data-crt-secondary]').textContent = override
        ? override.secondary
        : (nextChannel === '1' ? 'Pot $360' : 'Your action');
    }, 250);
    window.setTimeout(() => {
      if (optionCard.dataset.channelRun !== token) return;
      optionCard.classList.remove('is-channel-changing');
    }, 620);
  };

  const runPress = (demoControl, optionCard) => {
    const token = String(++runId);
    demoControl.dataset.pressRun = token;
    optionCard.dataset.pressRun = token;
    demoControl.classList.remove('is-demo-press');
    optionCard.classList.remove('is-demonstrating-press');
    window.requestAnimationFrame(() => {
      if (demoControl.dataset.pressRun !== token) return;
      demoControl.classList.add('is-demo-press');
      optionCard.classList.add('is-demonstrating-press');
    });
    window.setTimeout(() => {
      if (demoControl.dataset.pressRun === token) demoControl.classList.remove('is-demo-press');
      if (optionCard.dataset.pressRun === token) optionCard.classList.remove('is-demonstrating-press');
    }, 760);
  };

  board.addEventListener('click', (event) => {
    const crtDemo = event.target.closest('[data-crt-demo]');
    if (crtDemo) {
      runChannelChange(crtDemo.closest('.option-card'));
      return;
    }

    const demoControl = event.target.closest('[data-demo-control]');
    if (demoControl) {
      const optionCard = demoControl.closest('.option-card');
      runPress(demoControl, optionCard);

      /* On the composite the whole machine answers one press: the CRT
         resynchronises and the mechanical total settles to its new value. */
      if (demoControl.hasAttribute('data-composite-deal')) {
        compositeStep = (compositeStep + 1) % COMPOSITE_STEPS.length;
        setCompositeAmount(COMPOSITE_STEPS[compositeStep]);
        compositeCards().forEach((card) => runChannelChange(card));
      } else if (demoControl.hasAttribute('data-composite-cash')) {
        compositeStep = 0;
        setCompositeAmount(0);
        compositeCards().forEach((card) => runChannelChange(card, {
          primary: 'You cash out',
          secondary: 'Session settled'
        }));
      }
      return;
    }

    const state = states[activeFamily];
    const shortlistButton = event.target.closest('[data-shortlist]');
    const approveButton = event.target.closest('[data-approve]');

    if (shortlistButton) {
      const id = shortlistButton.dataset.shortlist;
      state.shortlisted = state.shortlisted.includes(id)
        ? state.shortlisted.filter((item) => item !== id)
        : [...state.shortlisted, id];
      persist();
      render();
    }

    if (approveButton) {
      const id = approveButton.dataset.approve;
      state.approved = state.approved === id ? null : id;
      persist();
      render();
    }
  });

  resetButton.addEventListener('click', () => {
    states[activeFamily] = freshDefaults();
    try { window.localStorage.removeItem(FAMILIES[activeFamily].key); }
    catch (error) { /* Reset still applies in memory. */ }
    render();
  });

  render();
})();
