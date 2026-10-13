/* Approved packet illustration preserved from the earlier visual study. */
(() => {
  function packetArt(type,back=false){
    const crimps=Array.from({length:22},(_,i)=>`<path d="M${5+i*4} 142h1v12h-1z" class="${i%3?'pko-foil-dark':'pko-foil-light'}"/>`).join('');
    const engraving=type==='reserve'?Array.from({length:20},(_,i)=>`<path d="M${17+(i%4)*18} ${27+Math.floor(i/4)*22}h3v3h-3z" class="pko-foil-light" opacity=".1"/>`).join(''):'';
    const reserve=type==='reserve'?'<path d="M14 35h7v7h-7zM76 35h7v7h-7zM14 108h7v7h-7zM76 108h7v7h-7z" class="pko-foil-dark"/><path d="M9 23h78v2H9zM9 137h78v2H9z" class="pko-foil-light"/>':'';
    return `<svg viewBox="0 0 96 156" aria-hidden="true"><path d="M3 0h90v3h3v150h-3v3H3v-3H0V3h3z" class="pko-foil-base"/><path d="M3 14h90v127H3z" class="pko-print"/><path d="M7 18h82v119H7z" class="pko-print-dark"/><path d="M11 22h74v111H11z" class="pko-print"/><path d="M3 14h9v37H7v27H3zM89 52h4v89H80v-13h9z" class="pko-foil-dark"/><path d="M3 15h3v87H3zM90 17h3v33h-3zM78 141h12v2H78z" class="pko-foil-light"/><path d="M12 25h4v2h-2v34h-2zM80 98h4v32h-4v-2h2V98z" class="pko-foil-dark"/><path d="M10 13h42L10 60zM43 141h40L83 103z" class="pko-foil-light" opacity=".08"/>${crimps}${engraving}${reserve}${back?'':`<path d="M28 68h40v5h7v24h-7v5H28v-5h-7V73h7z" class="pko-foil-dark"/><path d="M30 71h36v4h6v20h-6v4H30v-4h-6V75h6z" class="pko-ink"/><path d="M33 75h30v20H33z" class="pko-print-dark"/><path d="M37 78h7v2h-7zM52 76h7v2h-7zM39 82h4v5h-4zM53 80h4v5h-4zM40 90h4v2h10v-4h4v6H40z" class="pko-ink"/><path d="M11 80h3v-4h3v4h4v3h-4v4h-3v-4h-3zM78 80h4v-4h3v4h4v3h-4v4h-3v-4h-4z" class="pko-foil-light"/>`}</svg>`;
  }

window.PackRitualArt={packetArt};
})();
