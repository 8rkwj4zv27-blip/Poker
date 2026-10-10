(() => {
  const crtSequences = {
    action: [
      { small: 'Action log', text: 'Wildboar raises $40' },
      { small: 'Action log', text: 'Manao calls $40' },
      { small: 'Action log', text: 'Shark folds' },
      { small: 'Action log', text: 'Pot awarded $180' }
    ],
    hand: [
      { small: 'Hand scanner', text: 'Ace-three offsuit' },
      { small: 'Hand scanner', text: 'Pocket eights' },
      { small: 'Hand scanner', text: 'King-jack suited' },
      { small: 'Hand scanner', text: 'Seven-two offsuit' }
    ],
    status: [
      { small: 'Table ready', text: 'Your action', cursor: true },
      { small: 'Live process', text: 'Dealer thinking', cursor: true },
      { small: 'Warning', text: 'Signal unstable', warning: true },
      { small: 'Table ready', text: 'Cards incoming' }
    ]
  };

  const crtPositions = { action: 0, hand: 0, status: 0 };

  const updateCrt = (name, button) => {
    const screen = document.querySelector(`[data-crt="${name}"]`);
    if (!screen || screen.classList.contains('is-changing')) return;

    const sequence = crtSequences[name];
    crtPositions[name] = (crtPositions[name] + 1) % sequence.length;
    const next = sequence[crtPositions[name]];
    const strong = screen.querySelector('[data-crt-copy]');
    const small = screen.querySelector('[data-crt-small]') || screen.querySelector('small');

    screen.classList.remove('is-warning');
    screen.classList.add('is-changing');
    button.disabled = true;

    window.setTimeout(() => {
      small.textContent = next.small;
      strong.textContent = next.text;

      if (next.cursor) {
        const cursor = document.createElement('span');
        cursor.className = 'crt-cursor';
        cursor.setAttribute('aria-hidden', 'true');
        strong.append(cursor);
      }

      screen.classList.toggle('is-warning', Boolean(next.warning));
    }, 190);

    window.setTimeout(() => {
      screen.classList.remove('is-changing');
      button.disabled = false;
    }, 470);
  };

  document.querySelectorAll('[data-cycle-crt]').forEach((button) => {
    button.addEventListener('click', () => updateCrt(button.dataset.cycleCrt, button));
  });

  document.querySelectorAll('.action-button').forEach((button) => {
    button.addEventListener('click', () => {
      button.classList.add('is-pressed');
      window.setTimeout(() => button.classList.remove('is-pressed'), 130);
    });
  });

  const counter = document.querySelector('[data-counter]');
  const rollButton = document.querySelector('[data-roll-counter]');
  const rollCounter = () => {
    if (!counter) return;
    counter.classList.remove('is-rolling');
    void counter.offsetWidth;
    counter.classList.add('is-rolling');
  };

  rollButton?.addEventListener('click', rollCounter);

  document.querySelectorAll('[data-submenu-row]').forEach((row) => {
    row.addEventListener('click', () => {
      document.querySelectorAll('[data-submenu-row]').forEach((item) => item.classList.remove('is-selected'));
      row.classList.add('is-selected');
    });
  });

  const resultStage = document.querySelector('[data-result-stage]');
  const resultButton = document.querySelector('[data-toggle-result]');
  let negativeResult = false;

  const setResultText = (negative) => {
    const values = negative ? {
      title: 'Run over', scoreLabel: 'Final score', digits: ['0', '8', '4', '2', '0'],
      stack: '$0', kos: '7', hands: '23', cleared: '3', next: 'No chips'
    } : {
      title: 'Table cleared', scoreLabel: 'Table score', digits: ['+', '8', '4', '2', '0'],
      stack: '$2,480', kos: '4 / 4', hands: '11 / 18', cleared: '4', next: 'Next · Table 5'
    };

    resultStage.querySelector('[data-result-title]').textContent = values.title;
    resultStage.querySelector('[data-result-score-label]').textContent = values.scoreLabel;
    resultStage.querySelectorAll('.result-digits i').forEach((digit, index) => { digit.textContent = values.digits[index]; });
    resultStage.querySelector('[data-result-stack]').textContent = values.stack;
    resultStage.querySelector('[data-result-kos]').textContent = values.kos;
    resultStage.querySelector('[data-result-hands]').textContent = values.hands;
    resultStage.querySelector('[data-result-cleared]').textContent = values.cleared;
    resultStage.querySelector('[data-result-next]').textContent = values.next;
  };

  resultButton?.addEventListener('click', () => {
    if (resultStage.classList.contains('is-switching')) return;
    resultStage.classList.add('is-switching');
    resultButton.disabled = true;

    window.setTimeout(() => {
      negativeResult = !negativeResult;
      resultStage.classList.toggle('result-stage--positive', !negativeResult);
      resultStage.classList.toggle('result-stage--negative', negativeResult);
      setResultText(negativeResult);
      resultButton.textContent = negativeResult ? 'Switch to Table Cleared' : 'Switch to Run Over';
    }, 300);

    window.setTimeout(() => {
      resultStage.classList.remove('is-switching');
      resultButton.disabled = false;
    }, 640);
  });

  rollCounter();
})();
