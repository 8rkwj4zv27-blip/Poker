/* Live menu motion. Presentation only: Career transactions and poker state
   remain owned by the existing entry and game functions. */
let careerEntranceInFlight = false;
let careerEntranceRaf = 0;

function resetCareerEntrance(){
  if (careerEntranceRaf) cancelAnimationFrame(careerEntranceRaf);
  careerEntranceRaf = 0;
  careerEntranceInFlight = false;
  const app = $('app'), home = $('home'), career = $('career'), key = $('open-career');
  app?.classList.remove('career-entry-machine','career-entry-poweroff','career-entry-recess','career-entry-rolling','career-entry-rolled','career-entry-locked');
  if (home) home.inert = false;
  if (career) career.inert = false;
  if (key){ key.disabled = false; key.classList.remove('career-entry-pressed'); }
}

async function enterCareerFromHome(){
  const app = $('app'), home = $('home'), career = $('career'), key = $('open-career');
  if (!app || !home || !career || !key || home.classList.contains('hidden')) { showCareerScreen(); return; }
  if (careerEntranceInFlight) return;
  if (motionOff()){ showCareerScreen(); return; }
  careerEntranceInFlight = true;
  key.disabled = true;
  home.inert = true;
  key.classList.add('career-entry-pressed');
  app.classList.add('career-entry-machine','career-entry-poweroff');
  Sound.buttonPress('allin');
  haptic([25,18,42]);
  try{
    // Power-down, then the whole assembly retracts into its wheel socket.
    await sleep(240);
    app.classList.add('career-entry-recess');
    Sound.stageUnlock();
    await sleep(350);

    // Mount the real Career screen before the wheel starts. No snapshot of
    // money or event state is ever substituted for the actual reader.
    showCareerScreen({keepHomeVisible:true});
    career.inert = true;
    career.getBoundingClientRect();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    app.classList.add('career-entry-rolling');
    await new Promise(resolve => requestAnimationFrame(() => { app.classList.add('career-entry-rolled'); resolve(); }));

    // Ratchets follow measured travel, as on the table's stage wheel.
    const travel = Math.max(1,career.getBoundingClientRect().height+22);
    let notch = 0;
    const tick = () => {
      if (!app.classList.contains('career-entry-rolling')) return;
      const progress = Math.max(0,Math.min(1,(career.getBoundingClientRect().top+travel)/travel));
      while (notch<13 && progress >= (notch+1)/14){
        notch++;
        Sound.stageRollClick(Math.min(1,.32+notch/18),notch===13);
      }
      careerEntranceRaf = requestAnimationFrame(tick);
    };
    careerEntranceRaf = requestAnimationFrame(tick);
    await sleep(1200);
    cancelAnimationFrame(careerEntranceRaf);
    careerEntranceRaf = 0;
    app.classList.remove('career-entry-rolling');
    app.classList.add('career-entry-locked');
    Sound.stageLock();
    haptic([32,22,55]);
    await sleep(280);
    home.classList.add('hidden');
  } catch (error){
    console.error('Career entrance failed; opening the Career screen directly.',error);
    showCareerScreen();
  } finally{
    resetCareerEntrance();
  }
}

/* Career -> Table. `launch` is one of the real Career launch functions; it
   builds the table under cover of the roll, and its first deal is held until
   the house lights are up. Money has already moved before this is called,
   and nothing here reads or writes Career state. A tap skips to the table. */
let tableEntranceInFlight = false;

function swallowNextClick(){
  const stop = event => { event.stopPropagation(); event.preventDefault(); };
  document.addEventListener('click',stop,true);
  window.setTimeout(() => document.removeEventListener('click',stop,true),450);
}

function careerTableCallout(text){
  const felt = $('felt');
  if (!felt || !text || motionOff()) return;
  const callout = document.createElement('div');
  callout.className = 'table-round-callout is-career-event';
  callout.textContent = text;
  callout.style.setProperty('--run-announce-ms','1050ms');
  const room = felt.clientWidth * .86;
  callout.style.fontSize = Math.max(13,Math.min(22,Math.floor(room / (text.length * 1.18)))) + 'px';
  felt.appendChild(callout);
  window.setTimeout(() => callout.remove(),1100);
}

async function careerDepartToTable(launch, options = {}){
  const app = $('app'), careerScreen = $('career'), table = $('table-screen');
  if (!app || !careerScreen || !table || motionOff() || careerScreen.classList.contains('hidden')){
    launch();
    return;
  }
  if (tableEntranceInFlight) return;
  tableEntranceInFlight = true;
  let skipped = false, wake = null, built = false, dealArgs = null, dealt = false, raf = 0;
  const realStartNewHand = startNewHand;
  const wait = ms => skipped ? Promise.resolve() : new Promise(resolve => {
    const timer = window.setTimeout(() => { wake = null; resolve(); },ms);
    wake = () => { window.clearTimeout(timer); wake = null; resolve(); };
  });
  const skip = event => {
    if (skipped || !built) return;
    event.preventDefault();
    skipped = true;
    app.classList.add('table-entry-skip');
    swallowNextClick();
    if (wake) wake();
  };
  const build = () => {
    if (built) return;
    built = true;
    startNewHand = (...args) => { dealArgs = args; };
    try { launch(); } finally { startNewHand = realStartNewHand; }
    if (!dealArgs) dealt = true;
  };
  const deal = () => {
    if (dealt) return;
    dealt = true;
    realStartNewHand(...dealArgs);
  };
  app.addEventListener('pointerdown',skip,true);
  try{
    app.classList.add('table-entry-machine','table-entry-poweroff');
    careerScreen.inert = true;
    Sound.buttonPress('allin');
    haptic([22,16,34]);
    await wait(230);
    app.classList.add('table-entry-recess');
    Sound.stageUnlock();
    await wait(250);

    build();
    if (table.classList.contains('hidden')){
      // The launch refused (stale state). Nothing was seated; stay put.
      return;
    }
    // showTableScreen() hid the reader; it rides the wheel out regardless.
    careerScreen.classList.remove('hidden');
    table.inert = true;
    table.getBoundingClientRect();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    app.classList.add('table-entry-rolling');
    await new Promise(resolve => requestAnimationFrame(() => { app.classList.add('table-entry-rolled'); resolve(); }));

    const travel = Math.max(1,table.getBoundingClientRect().height + 22);
    let notch = 0;
    const tick = () => {
      if (skipped || !app.classList.contains('table-entry-rolling')) return;
      const progress = Math.max(0,Math.min(1,(table.getBoundingClientRect().top + travel) / travel));
      while (notch < 11 && progress >= (notch + 1) / 12){
        notch++;
        Sound.stageRollClick(Math.min(1,.36 + notch / 15),notch === 11);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    await wait(940);
    cancelAnimationFrame(raf); raf = 0;
    app.classList.remove('table-entry-rolling');
    app.classList.add('table-entry-locked');
    if (!skipped){ Sound.stageLock(); haptic([30,20,50]); }
    await wait(200);
    careerScreen.classList.add('hidden');
    app.classList.add('table-entry-lights');
    if (!skipped){ Sound.consoleShift(); careerTableCallout(options.callout); }
    await wait(skipped ? 0 : 520);
  } catch (error){
    console.error('Table entrance failed; opening the table directly.',error);
    build();
  } finally{
    if (raf) cancelAnimationFrame(raf);
    app.removeEventListener('pointerdown',skip,true);
    app.classList.remove('table-entry-machine','table-entry-poweroff','table-entry-recess','table-entry-rolling',
      'table-entry-rolled','table-entry-locked','table-entry-lights','table-entry-skip');
    careerScreen.inert = false;
    table.inert = false;
    if (built && !table.classList.contains('hidden')) careerScreen.classList.add('hidden');
    tableEntranceInFlight = false;
    if (built) deal();
  }
}
