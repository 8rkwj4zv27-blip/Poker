"use strict";

/* ============================================================
   SAVE DATA: back up, restore, reset

   Everything the game keeps lives in this phone's storage, and an app on
   the Home Screen has storage of its own: delete the icon and it all goes.
   So the Settings sheet gets a SAVE DATA plate (and the main menu a SAVE
   DATA key that opens it):

   - BACK UP: every saved key in one small file, handed to the iPhone's
     share sheet (Save to Files, AirDrop, Notes). COPY CODE puts the same
     save on the clipboard as one line of text, for when files won't do.
   - RESTORE: a save file, or a pasted code. It is read and checked first,
     shown, and only then written over what's here.
   - RESET STATS: lifetime stats, the high score and awards, the pacing
     record. Career, tables and settings stay.
   - START OVER: all of that, plus the Career, every saved table and
     P.I.P.'s memory. Settings and Workshop picks stay.

   Every saved key is read and written as it is: nothing is renamed or
   reformatted. After a restore or a reset the game reloads, so every part
   starts again from what's saved. Off a table only: the plate hides at a
   table (refreshSettingsContext, 07-ui-wiring.js).
   ============================================================ */
const SaveData = (() => {
  const FORMAT = 'poker-faces-save';
  const VERSION = 1;
  const CODE_PREFIX = 'PF1:';
  // every key the game saves (docs/QUICKMAP.md, "Saved data")
  const KEYS = ['felt.settings', 'felt.stats', 'felt.table', 'felt.career', 'felt.career.table',
    'felt.arcade', 'felt.finishes', 'felt.gameplay.metrics.v1', 'pip.coach'];
  const STATS_KEYS = ['felt.stats', 'felt.arcade', 'felt.gameplay.metrics.v1'];
  const START_OVER_KEYS = STATS_KEYS.concat(['felt.career', 'felt.career.table', 'felt.table', 'pip.coach']);

  /* ---- the save itself ---- */
  function snapshot(){
    const data = {};
    KEYS.forEach(k => { const v = Store.get(k, undefined); if (v !== undefined) data[k] = v; });
    return { format:FORMAT, v:VERSION, build:BUILD_VERSION, savedAt:new Date().toISOString(), data };
  }
  // text in, a checked save out (or null): a file's JSON or a PF1: code
  function parse(text){
    let save;
    try{
      const t = String(text || '').trim();
      save = JSON.parse(t.startsWith(CODE_PREFIX) ? fromBase64(t.slice(CODE_PREFIX.length)) : t);
    }catch(e){ return null; }
    if (!save || save.format !== FORMAT || save.v !== VERSION) return null;
    const data = save.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    if (Object.keys(data).some(k => !KEYS.includes(k))) return null;
    const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
    if ('felt.settings' in data && !isObj(data['felt.settings'])) return null;
    if ('felt.stats' in data && !isObj(data['felt.stats'])) return null;
    if ('felt.career' in data && !(isObj(data['felt.career']) && Number.isFinite(data['felt.career'].bankroll))) return null;
    return save;
  }
  // a restore replaces everything: a key the save doesn't have is cleared
  function write(save){
    KEYS.forEach(k => { if (k in save.data) Store.set(k, save.data[k]); else Store.remove(k); });
  }
  function clear(keys){ keys.forEach(k => Store.remove(k)); }

  const toBase64 = s => btoa(unescape(encodeURIComponent(s)));
  const fromBase64 = s => decodeURIComponent(escape(atob(s.replace(/\s+/g, ''))));
  const toCode = save => CODE_PREFIX + toBase64(JSON.stringify(save));

  // what a save holds, in a line the confirm dialog can show
  function describe(save){
    const d = save.data, parts = [];
    const c = d['felt.career'];
    if (c) parts.push('Career bankroll $' + Math.round(c.bankroll).toLocaleString());
    const s = d['felt.stats'];
    if (s && Number.isFinite(s.hands)) parts.push(s.hands.toLocaleString() + ' hands played');
    const when = new Date(save.savedAt);
    if (!isNaN(when)) parts.push('saved ' + when.toLocaleDateString(undefined, { day:'numeric', month:'short', year:'numeric' }));
    return parts.join(' · ');
  }

  /* ---- the plate ---- */
  const el = (tag, cls, inner) => { const e = document.createElement(tag); if (cls) e.className = cls; if (inner != null) e.innerHTML = inner; return e; };
  const key = (label, id, danger) => { const b = el('button', 'btn-secondary' + (danger ? ' btn-danger' : ''), label); b.type = 'button'; b.id = id; return b; };
  function row(label, hint, keys, below){
    const r = el('div', 'st-row' + (below ? ' st-row--below' : ''));
    r.appendChild(el('div', 'st-text', '<div class="st-label">' + label + '</div><div class="st-hint">' + hint + '</div>'));
    const c = el('div', 'st-ctl'), k = el('div', 'sheet-keys');
    keys.forEach(b => k.appendChild(b));
    c.appendChild(k); r.appendChild(c);
    return r;
  }
  const plate = el('div', 'sheet-section st-plate st-save');
  plate.id = 'settings-save';
  plate.dataset.stPlate = 'save';
  plate.appendChild(el('h3', null, 'Save data'));
  const note = el('div', 'st-note');
  plate.appendChild(note);
  const keys = {
    file:key('Save file', 'save-export'), code:key('Copy code', 'save-copy'),
    open:key('Open file', 'save-import'), paste:key('Paste code', 'save-paste'),
    stats:key('Reset', 'save-reset-stats', true), over:key('Start over', 'save-start-over', true)
  };
  plate.appendChild(row('Back up', 'Career, stats and settings in one file. Keep it somewhere safe.', [keys.file, keys.code], true));
  plate.appendChild(row('Restore', 'From a save file or code. Replaces everything on this phone.', [keys.open, keys.paste], true));
  plate.appendChild(row('Reset stats', 'Hands, wins, high score and awards. Your career stays.', [keys.stats]));
  plate.appendChild(row('Start over', 'A new career, no stats, no saved tables. Settings and Workshop picks stay.', [keys.over]));
  const picker = el('input');
  picker.type = 'file'; picker.accept = '.json,application/json,text/plain'; picker.hidden = true;
  plate.appendChild(picker);

  function paintNote(said){
    const at = settings.saveExportedAt;
    const days = at ? Math.floor((Date.now() - at) / 86400000) : -1;
    const last = days < 0 ? 'never' : days === 0 ? 'today' : days === 1 ? 'yesterday' : days + ' days ago';
    note.innerHTML = (said ? '<b>' + said + '</b><br>' : '') +
      'Your saves live on this phone only: removing the app from the Home Screen deletes them. Last backed up: <b>' + last + '</b>.';
  }
  function backedUp(said){ settings.saveExportedAt = Date.now(); saveSettings(); paintNote(said); }

  /* ---- back up ---- */
  function fileName(){
    const d = new Date(), p = n => String(n).padStart(2, '0');
    return 'poker-faces-save-' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '.json';
  }
  // the share sheet on the phone; a plain download where there isn't one.
  // Built and shared in the same tap: iOS only shares from a user gesture.
  function exportFile(){
    const text = JSON.stringify(snapshot()), name = fileName();
    let file = null;
    try{ file = new File([text], name, { type:'application/json' }); }catch(e){}
    if (file && navigator.canShare && navigator.canShare({ files:[file] })){
      navigator.share({ files:[file], title:'Poker Faces save' })
        .then(() => backedUp('Saved.'))
        .catch(e => { if (!e || e.name !== 'AbortError') copyCode(); });
      return;
    }
    const a = el('a');
    a.href = URL.createObjectURL(new Blob([text], { type:'application/json' }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    backedUp('Saved as ' + name + '.');
  }
  function copyCode(){
    const code = toCode(snapshot());
    const done = () => backedUp('Save code copied. Paste it into Notes.');
    if (navigator.clipboard && navigator.clipboard.writeText)
      navigator.clipboard.writeText(code).then(done, () => offerCode(code));
    else offerCode(code);
  }
  // no clipboard: show the code to copy by hand
  function offerCode(code){
    window.prompt('Copy this save code and keep it somewhere safe:', code);
    backedUp('Save code shown.');
  }

  /* ---- restore ---- */
  function restoreFrom(text){
    const save = parse(text);
    if (!save){ paintNote('That isn’t a Poker Faces save.'); return; }
    showConfirmDialog({
      title:'Restore this save?',
      body:(describe(save) || 'A Poker Faces save') + '. Everything on this phone is replaced with it.',
      confirmLabel:'Restore', danger:true,
      onConfirm:() => { write(save); reload(); }
    });
  }
  picker.addEventListener('change', () => {
    const f = picker.files && picker.files[0];
    picker.value = '';
    if (!f) return;
    f.text().then(restoreFrom, () => paintNote('That file couldn’t be read.'));
  });
  function pasteCode(){
    const ask = () => { const t = window.prompt('Paste your save code:'); if (t) restoreFrom(t); };
    if (navigator.clipboard && navigator.clipboard.readText)
      navigator.clipboard.readText().then(t => { if (parse(t)) restoreFrom(t); else ask(); }, ask);
    else ask();
  }

  /* ---- reset ---- */
  function resetStats(){
    showConfirmDialog({
      title:'Reset your stats?',
      body:'Hands, wins, your high score and every award go back to zero. Your career, tables and settings stay.',
      confirmLabel:'Reset stats', danger:true,
      onConfirm:() => { clear(STATS_KEYS); reload(); }
    });
  }
  function startOver(){
    showConfirmDialog({
      title:'Start over?',
      body:'Your career, stats, awards and saved tables are wiped, and the bankroll goes back to $' + CAREER_START_BANKROLL + '. Settings and Workshop picks stay. Back up first if you might want them back.',
      confirmLabel:'Wipe and start over', danger:true,
      onConfirm:() => showConfirmDialog({
        title:'Really start over?',
        body:'This can’t be undone without a backup.',
        confirmLabel:'Start over', danger:true,
        onConfirm:() => { clear(START_OVER_KEYS); reload(); }
      })
    });
  }
  // nothing may save over the new state on the way out
  function reload(){ Store.freeze(); location.reload(); }

  keys.file.addEventListener('click', exportFile);
  keys.code.addEventListener('click', copyCode);
  keys.open.addEventListener('click', () => picker.click());
  keys.paste.addEventListener('click', pasteCode);
  keys.stats.addEventListener('click', resetStats);
  keys.over.addEventListener('click', startOver);

  /* ---- into the Settings sheet, above the service plate; the main
     menu's SAVE DATA key opens the sheet on it ---- */
  const body = document.querySelector('#settings-sheet > .sheet-body:not(#finishes-body)');
  if (body) body.insertBefore(plate, body.querySelector('.sheet-service'));
  paintNote();
  function open(){
    openOverlay('settings');
    requestAnimationFrame(() => { if (body) body.scrollTop = plate.offsetTop - body.offsetTop - 8; });
  }
  const homeKey = document.getElementById('open-save');
  if (homeKey) homeKey.addEventListener('click', open);

  // each time the sheet opens: off a table only, and the backup date fresh
  function refresh(onTable){ plate.classList.toggle('hidden', !!onTable); paintNote(); }

  return { refresh, KEYS, STATS_KEYS, START_OVER_KEYS, snapshot, parse, write, clear, toCode };
})();
