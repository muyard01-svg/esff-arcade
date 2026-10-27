/* Générique d'Arcade 101 : animation façon jeu d'arcade, jouée à l'arrivée sur le site.
   Coulée de fonte → titre en métal en fusion → montage des jeux → logo ESFF → INSERT COIN.
   Une fois par session (rejouable depuis le pied de page). */
'use strict';

const INTRO_KEY = 'esff-intro-seen';
const INTRO_LEN = 13.8;   // secondes

function playIntro() {
  const box = document.getElementById('intro');
  const cv = document.getElementById('introCanvas');
  if (!box || !cv) return;
  box.hidden = false;
  document.documentElement.classList.add('intro-on');
  const g = cv.getContext('2d');
  let W = 0, H = 0, S = 1, done = false, t0 = performance.now(), last = t0, ended = false;
  const resize = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    S = Math.min(W / 1000, H / 720);   // échelle de la mise en scène (pensée en 1280×720, titre lisible sur téléphone)
  };
  resize();
  window.addEventListener('resize', resize);

  const logo = new Image();
  logo.src = 'https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=400,fit=crop/sfgsxbx6Dl11FkMl/designer-1-UZ1AcVWRrdt1Rehi.png';
  const parts = [];
  const spark = (x, y, n, sp = 1, hue = 30) => {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = (80 + Math.random() * 420) * sp; parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120 * sp, life: 0.6 + Math.random() * 0.8, hue: hue + Math.random() * 25 }); }
  };

  /* ---------- musique et bruitages (WebAudio, déclenchés au fil de l'animation) ---------- */
  let ctx = null;
  try { ctx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx = ctx; } catch (e) { ctx = null; }
  const soundOn = () => ctx && ctx.state === 'running' && !muted;
  const note = (f, start, dur, type = 'square', vol = 0.06) => {
    if (!soundOn()) return;
    const tt = ctx.currentTime + start;
    const o = ctx.createOscillator(), gg = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, tt);
    gg.gain.setValueAtTime(0.0001, tt); gg.gain.exponentialRampToValueAtTime(vol, tt + 0.01); gg.gain.exponentialRampToValueAtTime(0.0001, tt + dur);
    o.connect(gg).connect(ctx.destination); o.start(tt); o.stop(tt + dur + 0.02);
  };
  const noise = (start, dur, vol = 0.12, freq = 400) => {
    if (!soundOn()) return;
    const len = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), gg = ctx.createGain();
    src.buffer = buf; f.type = 'lowpass'; f.frequency.value = freq; gg.gain.value = vol;
    src.connect(f).connect(gg).connect(ctx.destination); src.start(ctx.currentTime + start);
  };
  const N = { C4: 262, D4: 294, E4: 330, G4: 392, A4: 440, C5: 523, D5: 587, E5: 659, G5: 784, A5: 880, C6: 1047 };
  const cues = [
    [0.05, () => noise(0, 2.5, 0.1, 220)],                                         // grondement de la coulée
    [0.9, () => { note(N.C4 / 2, 0, 1.6, 'sawtooth', 0.04); }],
    [2.7, () => [N.C4, N.E4, N.G4, N.C5].forEach((f, i) => note(f, i * 0.12, 0.2, 'square', 0.05))],
    [3.4, () => [N.D4, N.G4, N.A4, N.D5].forEach((f, i) => note(f, i * 0.12, 0.2, 'square', 0.05))],
    [4.4, () => { noise(0, 0.9, 0.35, 900); note(65, 0, 0.9, 'sawtooth', 0.12); [N.C5, N.E5, N.G5, N.C6].forEach(f => note(f, 0.02, 0.8, 'square', 0.035)); }],
    ...[0, 1, 2, 3, 4].map(k => [5.2 + k * 0.84, () => { const base = [N.C5, N.D5, N.E5, N.G5, N.A5][k]; note(base, 0, 0.12); note(base * 1.5, 0.14, 0.12); note(base * 2, 0.28, 0.18); noise(0, 0.12, 0.15, 3000); }]),
    [9.4, () => [N.C4, N.G4, N.C5, N.E5, N.G5, N.C6].forEach((f, i) => note(f, i * 0.09, 0.9 - i * 0.08, 'triangle', 0.06))],
    [12.0, () => { note(N.G5, 0, 0.1); note(N.C6, 0.12, 0.35); }],
  ];
  let cueIdx = 0;

  /* ---------- boutons ---------- */
  const skipBtn = document.getElementById('introSkip'), soundBtn = document.getElementById('introSound');
  const paintSound = () => { soundBtn.textContent = soundOn() ? '🔊 Son activé' : '🔇 Activer le son'; };
  paintSound();
  soundBtn.onclick = e => {
    e.stopPropagation();
    if (!ctx) return;
    if (muted) { muted = false; save.muted = false; persist(); if (typeof paintMute === 'function') paintMute(); }
    ctx.resume().then(paintSound);
  };
  skipBtn.onclick = e => { e.stopPropagation(); finish(); };
  box.onclick = () => { if ((performance.now() - t0) / 1000 > 11.5) finish(); else if (ctx && ctx.state !== 'running') { ctx.resume().then(paintSound); } };
  // pendant le générique, le clavier ne pilote pas la borne derrière ; Échap / Entrée / Espace le passent
  const keyHandler = e => { e.stopImmediatePropagation(); if (['Escape', 'Enter', 'Space'].includes(e.code)) { e.preventDefault(); finish(); } };
  window.addEventListener('keydown', keyHandler, true);

  function finish() {
    if (ended) return;
    ended = true;
    try { sessionStorage.setItem(INTRO_KEY, '1'); } catch (e) { /* ignore */ }
    box.classList.add('intro-out');
    setTimeout(() => {
      done = true;
      box.hidden = true; box.classList.remove('intro-out');
      document.documentElement.classList.remove('intro-on');
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', keyHandler, true);
    }, 650);
  }

  /* ---------- dessin ---------- */
  const ease = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
  const text = (txt, x, y, size, color, align = 'center', font = '"Big Shoulders Display", Impact, sans-serif', weight = 900) => {
    g.font = `${weight} ${size * S}px ${font}`; g.textAlign = align; g.textBaseline = 'middle'; g.fillStyle = color; g.fillText(txt, x, y);
  };
  const pixel = (txt, x, y, size, color) => text(txt, x, y, size, color, 'center', '"Press Start 2P", monospace', 400);

  function sceneLadle(t) {   // 0 → 2.6 s : la coulée
    const cx = W / 2, top = H * 0.12;
    const tilt = ease(t / 0.9) * 0.9;
    g.save(); g.translate(cx - 230 * S, top + 40 * S); g.rotate(tilt);
    g.fillStyle = '#2a2d31'; g.beginPath(); g.moveTo(-90 * S, -60 * S); g.lineTo(90 * S, -60 * S); g.lineTo(70 * S, 60 * S); g.lineTo(-70 * S, 60 * S); g.closePath(); g.fill();
    g.strokeStyle = '#5c6067'; g.lineWidth = 5 * S; g.stroke();
    const lg = g.createLinearGradient(0, -60 * S, 0, -40 * S); lg.addColorStop(0, '#fff3c0'); lg.addColorStop(1, '#EC641E');
    g.fillStyle = lg; g.fillRect(-84 * S, -58 * S, 168 * S, 16 * S);
    g.fillStyle = '#3a3d42'; g.fillRect(-260 * S, -10 * S, 175 * S, 18 * S);
    g.restore();
    if (t > 0.6) {
      const k = ease((t - 0.6) / 0.5);
      const sx = cx - 230 * S + Math.cos(tilt) * 90 * S, sy = top + 40 * S + Math.sin(tilt) * 90 * S - 40 * S;
      const by = H * 0.78;
      const wdt = (14 + Math.sin(t * 30) * 2) * S;
      const sg = g.createLinearGradient(0, sy, 0, by); sg.addColorStop(0, '#fff6d0'); sg.addColorStop(1, '#ff7a20');
      g.fillStyle = sg; g.shadowColor = '#ff8a2a'; g.shadowBlur = 40 * S;
      g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(sx + 60 * S, sy + 40 * S, cx - wdt / 2, sy + (by - sy) * 0.35); g.lineTo(cx - wdt / 2, sy + (by - sy) * k); g.lineTo(cx + wdt / 2, sy + (by - sy) * k); g.lineTo(cx + wdt / 2, sy + (by - sy) * 0.35); g.quadraticCurveTo(sx + 80 * S, sy + 30 * S, sx + 10 * S, sy - 10 * S); g.fill();
      g.shadowBlur = 0;
      if (k >= 1) {
        const pool = ease((t - 1.1) / 1.5) * 260 * S;
        const pg = g.createRadialGradient(cx, by, 4, cx, by, pool + 1);
        pg.addColorStop(0, '#fff3c0'); pg.addColorStop(0.4, '#ff9a3a'); pg.addColorStop(1, 'rgba(236,100,30,0)');
        g.fillStyle = pg; g.beginPath(); g.ellipse(cx, by, pool + 1, (pool + 1) * 0.22, 0, 0, Math.PI * 2); g.fill();
        if (Math.random() < 0.8) spark(cx, by, 3, 0.8);
      }
    }
    if (t > 1.0) { g.globalAlpha = Math.min(1, (t - 1.0) * 2) * Math.max(0, 1 - (t - 2.2) * 3); pixel('ESFF · 101E PROMOTION PRÉSENTE', W / 2, H * 0.92, 14, '#F5B700'); g.globalAlpha = 1; }
  }

  function sceneTitle(t) {   // 2.6 → 5.2 s : le titre se remplit de fonte
    const cx = W / 2, cy = H * 0.46;
    const size = 190;
    g.font = `900 ${size * S}px "Big Shoulders Display", Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const fill = ease((t - 0.2) / 1.6);
    const tw = g.measureText('ARCADE 101').width;
    g.lineWidth = 3 * S; g.strokeStyle = 'rgba(255,170,90,.55)'; g.strokeText('ARCADE 101', cx, cy);
    g.save();
    const top = cy - size * 0.55 * S, bottom = cy + size * 0.5 * S;
    g.beginPath(); g.rect(cx - tw / 2 - 20, bottom - (bottom - top) * fill + Math.sin(t * 9) * 4 * S, tw + 40, (bottom - top) * fill + 40);
    g.clip();
    const mg = g.createLinearGradient(0, top, 0, bottom); mg.addColorStop(0, '#fff6d0'); mg.addColorStop(0.35, '#F5B700'); mg.addColorStop(0.7, '#EC641E'); mg.addColorStop(1, '#BA2C3A');
    g.shadowColor = '#ff8a2a'; g.shadowBlur = 50 * S; g.fillStyle = mg; g.fillText('ARCADE 101', cx, cy);
    g.restore();
    if (t > 1.8) {   // refroidissement : le métal fige en blanc
      const k = Math.min(1, (t - 1.8) / 0.25) * Math.max(0, 1 - (t - 2.05) * 2);
      g.fillStyle = `rgba(255,255,255,${k})`; g.fillRect(0, 0, W, H);
      if (t < 1.9) spark(cx, cy, 30, 1.6);
    }
    if (t > 1.9) { g.globalAlpha = Math.min(1, (t - 1.9) * 2); text('FONDERIE · FORGE · CHÂLONS-EN-CHAMPAGNE', cx, cy + 140 * S, 30, '#ffcf9e', 'center', 'Archivo, sans-serif', 800); g.globalAlpha = 1; }
  }

  const CARDS = [
    { label: 'POING DE FONTE 3D', sub: 'combat 1 contre 1', color: '#F5B700' },
    { label: 'COULÉE GALACTIQUE', sub: 'shooter en 3D', color: '#BA2C3A' },
    { label: 'ESCADRILLE 101', sub: 'avions en ligne', color: '#5AA8FF' },
    { label: 'GRAND PRIX', sub: 'course en ligne', color: '#EC641E' },
    { label: 'USINE 101', sub: 'forge ou fonderie ?', color: '#7FD48A' },
  ];
  function sceneMontage(t) {  // 5.2 → 9.4 s : un plan par jeu
    const k = Math.min(CARDS.length - 1, Math.floor(t / 0.84)), lt = t - k * 0.84;
    const C = CARDS[k];
    // fond en biais
    g.fillStyle = C.color; g.globalAlpha = 0.18;
    g.beginPath(); g.moveTo(0, H * 0.15); g.lineTo(W, H * 0.05); g.lineTo(W, H * 0.85); g.lineTo(0, H * 0.95); g.fill(); g.globalAlpha = 1;
    const tall = H > W;   // écran en hauteur (téléphone) : illustration sous le titre
    const ax = tall ? W / 2 : W * 0.66, ay = tall ? H * 0.62 : H * 0.55, s = S * (tall ? 2.4 : 1.6);
    g.save(); g.translate(ax, ay);
    if (k === 0 && typeof drawFighter === 'function') {
      const ph = Math.min(1, lt / 0.6);
      drawFighter(g, { ch: 'forgeronne', fc: 1, y: 0, st: 'attack', mv: 'masse', p: ph }, -90 * s, 120 * s, s * 0.9, lt);
      drawFighter(g, { ch: 'lamineur', fc: -1, y: 0, st: ph > 0.5 ? 'hit' : 'idle', p: 0 }, 90 * s, 120 * s, s * 0.9, lt + 1);
    } else if (k === 1 && typeof drawShip === 'function') {
      for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) drawEnemy(g, { x: (c - 2.5) * 50 * s, y: (-110 + r * 42) * s, type: r === 0 ? 'boss' : r === 1 ? 'papi' : 'abeille', state: 'form', col: c, hp: 2, a: 0 }, lt * 3);
      drawShip(g, Math.sin(lt * 6) * 60 * s, 110 * s, '#EC641E', lt, false, s * 1.3);
      g.fillStyle = '#fff3c0'; for (let i = 0; i < 4; i++) g.fillRect(Math.sin(lt * 6) * 60 * s - 2, (80 - ((lt * 900 + i * 60) % 220)) * s, 4 * s, 16 * s);
    } else if (k === 2 && typeof drawPlane === 'function') {
      ['#EC641E', '#BA2C3A', '#F2F4F7'].forEach((col, i) => { const a = lt * 2.4 + i * 2.1; g.save(); g.translate(Math.cos(a) * 150 * s, Math.sin(a) * 70 * s); g.rotate(a + Math.PI / 2); drawPlane(g, col, i === 0, lt * 5, s * 1.6); g.restore(); });
    } else if (k === 3) {
      g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 3 * s;
      for (let i = 0; i < 14; i++) { const y = ((i * 37 + lt * 1400) % 300 - 150) * s; g.beginPath(); g.moveTo(-200 * s, y); g.lineTo(-140 * s, y); g.moveTo(140 * s, y); g.lineTo(200 * s, y); g.stroke(); }
      g.fillStyle = '#EC641E'; g.beginPath(); g.roundRect(-30 * s, -55 * s, 60 * s, 110 * s, 12 * s); g.fill();
      g.fillStyle = '#121417'; g.fillRect(-22 * s, -30 * s, 44 * s, 26 * s);
      g.fillStyle = '#111'; [[-38, -40], [28, -40], [-38, 22], [28, 22]].forEach(([x, y]) => g.fillRect(x * s, y * s, 10 * s, 22 * s));
    } else {
      const ccs = typeof USINE_COUNTRIES !== 'undefined' ? Object.keys(USINE_COUNTRIES) : ['fr'];
      const cc = ccs[Math.floor(lt * 12) % ccs.length].toLowerCase();
      const img = flagCache[cc] || (flagCache[cc] = Object.assign(new Image(), { src: `https://flagcdn.com/w160/${cc}.png` }));
      if (img.complete && img.naturalWidth) g.drawImage(img, -110 * s, -75 * s, 220 * s, 147 * s);
      text('🔥  🔨', 0, 130 * s, 50, '#fff');
    }
    g.restore();
    // titre du plan qui glisse
    const slide = ease(lt / 0.25);
    g.save(); g.translate(W * 0.08 - (1 - slide) * 300 * S, tall ? H * 0.26 : H * 0.5);
    g.fillStyle = C.color; g.fillRect(0, -78 * S, 12 * S, 156 * S);
    text(C.label, 34 * S, -20 * S, 78, '#ffffff', 'left');
    text(C.sub.toUpperCase(), 36 * S, 50 * S, 24, C.color, 'left', 'Archivo, sans-serif', 800);
    g.restore();
    if (lt < 0.06) { g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, 0, W, H); }
  }
  const flagCache = {};

  function sceneLogo(t) {     // 9.4 → 12 s : logo et promesse
    const cx = W / 2, cy = H * 0.4;
    const k = ease(t / 0.6);
    const r = 150 * S * (0.6 + 0.4 * k);
    g.save(); g.translate(cx, cy); g.rotate(t * 0.4);
    for (let i = 0; i < 24; i++) { g.rotate(Math.PI / 12); g.fillStyle = i % 2 ? 'rgba(236,100,30,.25)' : 'rgba(245,183,0,.18)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(r * 2.6, -r * 0.35); g.lineTo(r * 2.6, r * 0.35); g.fill(); }
    g.restore();
    g.fillStyle = '#121417'; g.beginPath(); g.arc(cx, cy, r * 1.08, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#F5B700'; g.lineWidth = 6 * S; g.stroke();
    if (logo.complete && logo.naturalWidth) g.drawImage(logo, cx - r, cy - r, r * 2, r * 2);
    else text('ESFF', cx, cy, 80, '#fff');
    g.globalAlpha = Math.min(1, Math.max(0, (t - 0.5) * 2));
    text('GAGNE DES TICKETS À GRATTER', cx, H * 0.74, 46, '#ffffff');
    text('1 chance sur 5 de décrocher -10 % sur ton sweat de promo', cx, H * 0.81, 24, '#F5B700', 'center', 'Archivo, sans-serif', 800);
    g.globalAlpha = 1;
    if (t < 0.4 && Math.random() < 0.6) spark(cx, cy, 6, 1.2, 40);
  }

  function sceneCoin(t) {     // 12 → fin : INSERT COIN puis extinction du tube
    const off = Math.max(0, t - 1.2) / 0.6;
    if (off < 1) {
      text('ARCADE 101', W / 2, H * 0.36, 120, '#F5B700');
      if (Math.floor(t * 3) % 2 === 0) pixel('INSERT COIN', W / 2, H * 0.56, 26, '#ffffff');
      pixel('APPUIE POUR JOUER', W / 2, H * 0.66, 12, '#9aa0a6');
    }
    if (off > 0) {   // effet d'extinction d'écran cathodique
      const h = Math.max(2, H * (1 - ease(off)));
      g.fillStyle = '#000'; g.fillRect(0, 0, W, (H - h) / 2); g.fillRect(0, (H + h) / 2, W, (H - h) / 2);
      if (off > 0.7) { g.fillStyle = `rgba(255,255,255,${1 - (off - 0.7) * 3})`; g.fillRect(W * 0.2, H / 2 - 1, W * 0.6, 3); }
    }
  }

  function frame(now) {
    if (done) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = (now - t0) / 1000;
    while (cueIdx < cues.length && t >= cues[cueIdx][0]) { cues[cueIdx][1](); cueIdx++; }
    // fond : halle sombre avec lueur de four
    const bg = g.createRadialGradient(W / 2, H * 0.85, 10, W / 2, H * 0.85, Math.max(W, H));
    bg.addColorStop(0, '#2a1208'); bg.addColorStop(0.5, '#0d0705'); bg.addColorStop(1, '#030202');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    let shakeX = 0, shakeY = 0;
    if (t > 4.4 && t < 5.0) { shakeX = (Math.random() - 0.5) * 18 * S; shakeY = (Math.random() - 0.5) * 12 * S; }
    g.save(); g.translate(shakeX, shakeY);
    if (t < 2.6) sceneLadle(t);
    else if (t < 5.2) sceneTitle(t - 2.6);
    else if (t < 9.4) sceneMontage(t - 5.2);
    else if (t < 12.0) sceneLogo(t - 9.4);
    else sceneCoin(t - 12.0);
    g.restore();
    // étincelles
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.vy += 700 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      g.fillStyle = `hsla(${p.hue},100%,${60 + p.life * 30}%,${Math.min(1, p.life * 2)})`;
      g.fillRect(p.x, p.y, 3 * S + 1, 3 * S + 1);
    }
    // lignes de balayage
    g.fillStyle = 'rgba(0,0,0,.18)';
    for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
    paintSound();
    if (t >= INTRO_LEN) { finish(); return; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* lancement : à l'arrivée sur le site (une fois par session), sauf lien d'invitation à un salon */
(function initIntro() {
  const replay = document.getElementById('introReplay');
  if (replay) replay.addEventListener('click', e => { e.preventDefault(); window.scrollTo(0, 0); playIntro(); });
  let seen = false;
  try { seen = sessionStorage.getItem(INTRO_KEY) === '1'; } catch (e) { /* ignore */ }
  const invite = new URLSearchParams(location.search).has('salon');
  if (!seen && !invite) playIntro();
  else document.documentElement.classList.remove('intro-on');
})();
