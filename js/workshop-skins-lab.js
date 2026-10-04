"use strict";
/* WORKSHOP SKINS LAB — runs inside the game copy (workshop-skins-lab.html).
   Opens the Workshop once the home screen is up, so the owner lands on the
   new choices. Back (←) returns to the home screen; Quick Deal plays a
   hand with whatever was picked. Never loaded by the game itself. */
(() => {
  let tries = 0;
  const open = () => {
    const key = document.getElementById('open-workshop'), home = document.getElementById('home');
    if (key && home && !home.classList.contains('hidden')){ key.click(); return; }
    if (++tries < 40) setTimeout(open, 250);
  };
  setTimeout(open, 600);
})();
