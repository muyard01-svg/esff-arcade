/* Effets de passage de la borne : « on rentre dans le jeu » (zoom + ondulations) et grand écran.
   fxWarp(élément, type) déforme l'élément avec un filtre SVG animé pendant ~0,9 s. */
'use strict';

(function installRippleFilter() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  svg.innerHTML = `<filter id="fxRipple" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence id="fxTurb" type="turbulence" baseFrequency="0.008 0.02" numOctaves="2" seed="7" result="noise"/>
      <feDisplacementMap id="fxDisp" in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G"/>
    </filter>`;
  document.body.appendChild(svg);
})();

let fxRunning = null;
function fxWarp(el, kind = 'enter') {
  if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
  if (fxRunning) fxRunning.cancel();
  const turb = document.getElementById('fxTurb'), disp = document.getElementById('fxDisp');
  // anneaux d'onde qui partent du centre de l'écran
  const rings = document.createElement('div');
  rings.className = `fx-rings fx-${kind}`;
  rings.innerHTML = '<i></i><i></i><i></i>';
  const host = el.closest('.crt') || el;
  host.appendChild(rings);
  const dur = kind === 'switch' ? 650 : 900;
  const t0 = performance.now();
  let raf = 0, done = false;
  sfx(kind === 'exit' ? 520 : 180, 0.5, 'sine', 0.05, kind === 'exit' ? -360 : 520);
  return new Promise(resolve => {
    const end = () => {
      if (done) return;
      done = true; cancelAnimationFrame(raf);
      el.style.filter = ''; el.style.transform = ''; el.style.transformOrigin = '';
      disp.setAttribute('scale', '0');
      rings.remove();
      fxRunning = null;
      resolve();
    };
    fxRunning = { cancel: end };
    const step = now => {
      const p = Math.min(1, (now - t0) / dur);
      const wave = Math.sin(Math.PI * p);                 // monte puis redescend
      disp.setAttribute('scale', String(Math.round(wave * (kind === 'switch' ? 55 : 85))));
      turb.setAttribute('baseFrequency', `${(0.006 + 0.012 * p).toFixed(4)} ${(0.018 + 0.03 * wave).toFixed(4)}`);
      turb.setAttribute('seed', String(7 + Math.floor(p * 6)));
      let zoom = 1;
      if (kind === 'enter') zoom = p < 0.5 ? 1 + 0.18 * (p / 0.5) : 1.18 - 0.18 * ((p - 0.5) / 0.5);   // on plonge dans l'écran
      else if (kind === 'exit') zoom = 1 - 0.1 * wave;
      el.style.transformOrigin = '50% 50%';
      el.style.transform = `scale(${zoom.toFixed(3)})`;
      el.style.filter = `url(#fxRipple) brightness(${(1 + wave * 0.35).toFixed(2)}) saturate(${(1 + wave * 0.5).toFixed(2)})`;
      if (p < 1) raf = requestAnimationFrame(step); else end();
    };
    raf = requestAnimationFrame(step);
    setTimeout(end, dur + 400);   // sécurité si l'onglet est en arrière-plan
  });
}

/* ---------- grand écran ---------- */
function fxIsFull() { return !!document.fullscreenElement || document.body.classList.contains('pseudo-fs'); }
function fxToggleFullscreen() {
  const crt = document.querySelector('.crt');
  if (fxIsFull()) {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    document.body.classList.remove('pseudo-fs');
  } else if (crt.requestFullscreen) {
    crt.requestFullscreen({ navigationUI: 'hide' }).catch(() => document.body.classList.add('pseudo-fs'));
  } else {
    document.body.classList.add('pseudo-fs');      // iPhone : plein écran simulé
  }
  fxWarp(document.querySelector('.crt-content'), 'switch');
  setTimeout(fxPaintFsBtn, 120);
}
function fxPaintFsBtn() {
  const b = document.getElementById('fsBtn');
  if (b) { b.textContent = fxIsFull() ? '🗗' : '⛶'; b.title = fxIsFull() ? 'Quitter le grand écran (F)' : 'Grand écran (F)'; }
}
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) document.body.classList.remove('pseudo-fs'); fxPaintFsBtn(); });
(function addFsButton() {
  const top = document.querySelector('.modal-top');
  if (!top) return;
  const b = document.createElement('button');
  b.className = 'icon-btn'; b.id = 'fsBtn'; b.textContent = '⛶'; b.title = 'Grand écran (F)';
  b.setAttribute('aria-label', 'Grand écran');
  b.addEventListener('click', fxToggleFullscreen);
  top.appendChild(b);
})();
window.addEventListener('keydown', e => {
  if (e.code !== 'KeyF' || e.repeat || (e.target.matches && e.target.matches('input, textarea'))) return;
  if (document.getElementById('modal').hidden) return;    // le grand écran se commande en jeu
  e.preventDefault();
  fxToggleFullscreen();
});
