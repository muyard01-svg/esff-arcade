/* Arcade 102 — mini-jeux de la 102e promotion de l'ESFF */
'use strict';

/* ================= Données marque ================= */
const SHOP = 'https://www.esff2027.shop';
const IMG = 'https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=600,fit=crop/sfgsxbx6Dl11FkMl/';

const TEINTES = {
  liquidus:  { name: 'Liquidus',  sub: 'Orange',      hex: '#EC641E' },
  solidus:   { name: 'Solidus',   sub: 'Rouge',       hex: '#BA2C3A' },
  aluminium: { name: 'Aluminium', sub: 'Gris oxford', hex: '#8A8D91' },
  acier:     { name: 'Acier',     sub: 'Noir',        hex: '#1D1E20' },
};

const PRODUCTS = {
  rond:    { model: 'rond',    tag: "L'indispensable", name: 'Sweat col rond',  ref: 'Kariban K474', price: 36.99, img: IMG + 'k474_rouge_devant-gD25sh9fMy1lA4NR.png', url: SHOP + '/sweat-shirt-col-rond' },
  capuche: { model: 'capuche', tag: "L'indémodable",   name: 'Sweat à capuche', ref: 'Kariban K476', price: 40.99, img: IMG + 'k476_rouge_devant-dm2VfRHZJY4aqe4t.png', url: SHOP + '/sweat-a-capuche' },
  zip:     { model: 'zip',     tag: 'Le tendance',     name: 'Sweat col zippé', ref: 'Kariban K478', price: 45.99, img: IMG + 'k478_rouge_devant-ixCy4xltgMRkaAop.png', url: SHOP + '/sweat-shirt-col-zippe' },
};

const GAMES = [
  {
    id: 'coulee', title: 'La Coulée', teinte: 'liquidus', product: 'rond',
    pitch: 'Remplis le moule pile à la ligne de coulée. Chaque moule a sa forme (bouteille, cloche, sablier, boulet…) : le niveau file dans les parties étroites et traîne dans les larges. Et le métal continue de couler après que tu relâches.',
    how: '<b>Maintiens</b> (clic, doigt ou Espace) pour verser, <b>relâche</b> avant la ligne. 6 moules de formes différentes, de plus en plus rapides. La jauge à droite montre le volume versé et celui qu’il faut.',
    run: runCoulee,
  },
  {
    id: 'enclume', title: "Frappe d'enclume", teinte: 'solidus', product: 'capuche',
    pitch: "Forge ton surnom lettre par lettre. Frappe quand le curseur passe dans la zone chaude.",
    how: '<b>Tape</b> (clic, doigt ou Espace) quand le curseur est dans la zone rouge. 3 ratés et le métal refroidit.',
    ask: 'pseudo',
    run: runEnclume,
  },
  {
    id: 'teintes', title: 'Tri des teintes', teinte: 'aluminium', product: 'zip',
    pitch: 'Retrouve les paires de sweats : même coupe, même teinte. Le moins de coups possible.',
    how: '<b>Retourne</b> deux cartes. Même modèle et même teinte : la paire reste. Vite et sans erreur = gros score.',
    run: runTeintes,
  },
  {
    id: 'poche', title: 'La Poche', teinte: 'acier', product: 'capuche',
    pitch: "Déplace la poche de coulée, attrape le métal en fusion et les sweats. Évite scories et gouttes d'eau.",
    how: '<b>Glisse</b> le doigt / la souris ou utilise <b>← →</b>. 45 secondes, 3 vies.',
    run: runPoche,
  },
  {
    id: 'quiz', title: 'Quiz métallurgie', teinte: 'laiton', product: 'zip', server: true,
    pitch: 'Dix questions de fonderie, de forge et de métallurgie. Prouve que tu as suivi en cours.',
    how: '<b>10 questions</b>, 20 secondes chacune. Il faut <b>7 bonnes réponses</b> pour gagner un ticket.',
    run: runQuiz,
  },
];
// teinte décorative du quiz (hors collection)
const TONES = { ...TEINTES, laiton: { name: 'Laiton', sub: 'Or', hex: '#F5B700' } };

/* ================= Sauvegarde locale ================= */
const STORE_KEY = 'esff-arcade-v1';
let save = { best: {}, pseudo: '', player: '' };
try { Object.assign(save, JSON.parse(localStorage.getItem(STORE_KEY)) || {}); } catch (e) { /* stockage indisponible */ }
function persist() { try { localStorage.setItem(STORE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } }

/* ================= Serveur : tickets à gratter ================= */
let server = null; // dernier état renvoyé par le serveur
async function apiCall(path, body, defer = false) {
  const res = await fetch(path, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player: save.player, ...body }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erreur serveur');
  // defer : l'appelant applique l'état plus tard (ticket pas encore gratté)
  if (data.player && !defer) { applyStatus(data); }
  return data;
}
async function hello() {
  try {
    await apiCall('/api/hello', {});
    document.getElementById('serverWarn').hidden = true;
  } catch (e) {
    document.getElementById('serverWarn').hidden = false;
  }
}
function applyStatus(st) {
  server = st;
  if (st.player !== save.player) { save.player = st.player; persist(); }
  if (typeof refreshTickets === 'function') refreshTickets();
}

/* ================= Son ================= */
let audioCtx = null;
let muted = save.muted === true;
function sfx(freq = 440, dur = 0.08, type = 'square', vol = 0.05, slide = 0) {
  if (muted) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(audioCtx.destination);
    o.start(t); o.stop(t + dur);
  } catch (e) { /* audio indisponible */ }
}
const SFX = {
  clank: () => { sfx(880, 0.12, 'square', 0.05, -500); sfx(1760, 0.06, 'triangle', 0.03); },
  good: () => { sfx(660, 0.08, 'triangle', 0.06); setTimeout(() => sfx(990, 0.12, 'triangle', 0.06), 70); },
  bad: () => sfx(160, 0.25, 'sawtooth', 0.05, -80),
  tick: () => sfx(520, 0.04, 'triangle', 0.03),
  win: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => sfx(f, 0.16, 'triangle', 0.06), i * 110)),
};

/* ================= Utilitaires ================= */
const $ = (s, r = document) => r.querySelector(s);
const euro = n => n.toFixed(2).replace('.', ',') + ' €';
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const DISPLAY = '"Big Shoulders Display", Impact, sans-serif';

/* Silhouette de sweat en SVG, colorée selon la teinte */
function sweatSVG(model, hex) {
  const dark = hex === TEINTES.acier.hex;
  const stroke = dark ? '#4a4e54' : 'rgba(0,0,0,.25)';
  const trim = 'rgba(0,0,0,.22)';
  const hood = model === 'capuche'
    ? `<path d="M33 19 Q34 4 50 3 Q66 4 67 19 Q58 27 50 27 Q42 27 33 19Z" fill="${hex}" stroke="${stroke}" stroke-width="1.2"/><path d="M39 19 Q50 28 61 19" fill="none" stroke="${trim}" stroke-width="3"/><path d="M46 26 v12 M54 26 v12" stroke="#f2f4f7" stroke-width="1.2"/>`
    : '';
  const neck = model === 'rond'
    ? `<path d="M38 17 Q50 27 62 17" fill="none" stroke="${trim}" stroke-width="4"/>`
    : model === 'zip'
      ? `<path d="M37 12 L40 22 Q50 26 60 22 L63 12" fill="${hex}" stroke="${stroke}" stroke-width="1.2"/><path d="M50 22 V46" stroke="#cfd3d8" stroke-width="1.6"/><circle cx="50" cy="28" r="1.8" fill="#cfd3d8"/>`
      : '';
  const pocket = model === 'capuche' ? `<path d="M34 66 L38 56 H62 L66 66 V78 H34Z" fill="none" stroke="${trim}" stroke-width="1.6"/>` : '';
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M30 16 L18 21 L5 52 L15 57 L25 38 L25 88 L75 88 L75 38 L85 57 L95 52 L82 21 L70 16 Q50 26 30 16Z" fill="${hex}" stroke="${stroke}" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M25 84 H75 M6 50 L15 55 M94 50 L85 55" stroke="${trim}" stroke-width="4"/>
    ${hood}${neck}${pocket}
    <circle cx="${model === 'zip' ? 62 : 50}" cy="40" r="4.5" fill="none" stroke="#f2f4f7" stroke-width="1.4" opacity=".85"/>
  </svg>`;
}

/* Canvas net quel que soit l'écran */
function makeCanvas(parent, W, H) {
  const c = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = W * dpr; c.height = H * dpr;
  c.className = 'game-canvas';
  parent.appendChild(c);
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  // ajuste la taille affichée à la place libre dans l'écran, sans déformer
  const st = c.closest('.stage') || parent;
  const fit = () => {
    if (!c.isConnected) { ro.disconnect(); return; }
    const cs = getComputedStyle(st);
    const aw = st.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    let ah = st.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    for (let node = c; node.parentElement && node.parentElement !== st; node = node.parentElement) {
      const par = node.parentElement;
      for (const el of par.children) if (el !== node && el.offsetParent && !el.dataset.overlay) ah -= el.offsetHeight + 8;
      if (getComputedStyle(par, '::before').content !== 'none') ah -= 30;  // message « tourne ton téléphone »
    }
    const k = Math.max(0.1, Math.min(aw / W, ah / H));
    c.style.width = `${Math.floor(W * k)}px`;
    c.style.height = `${Math.floor(H * k)}px`;
  };
  const ro = new ResizeObserver(fit);
  ro.observe(st);
  fit();
  requestAnimationFrame(fit);
  return { c, g };
}

function loop(fn) {
  let last = performance.now(), id = 0, stopped = false;
  const f = t => {
    if (stopped) return;
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    if (fn(dt, t) === false) return;
    id = requestAnimationFrame(f);
  };
  id = requestAnimationFrame(f);
  return () => { stopped = true; cancelAnimationFrame(id); };
}

/* Appui maintenu (souris, doigt, Espace) */
function holdInput(el, down, up) {
  const pd = e => { e.preventDefault(); down(); };
  const pu = () => up();
  const kd = e => { if (e.code === 'Space' && !e.repeat) { e.preventDefault(); down(); } };
  const ku = e => { if (e.code === 'Space') { e.preventDefault(); up(); } };
  el.addEventListener('pointerdown', pd);
  window.addEventListener('pointerup', pu);
  window.addEventListener('pointercancel', pu);
  window.addEventListener('keydown', kd);
  window.addEventListener('keyup', ku);
  return () => {
    el.removeEventListener('pointerdown', pd);
    window.removeEventListener('pointerup', pu);
    window.removeEventListener('pointercancel', pu);
    window.removeEventListener('keydown', kd);
    window.removeEventListener('keyup', ku);
  };
}

function sparks(list, x, y, n, hue = 30, spread = 1) {
  for (let i = 0; i < n; i++) {
    const a = rand(-Math.PI, 0) * spread - (spread < 1 ? Math.PI / 2 * (1 - spread) : 0);
    const s = rand(80, 260);
    list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.35, 0.8), max: 0.8, hue: hue + rand(-10, 20) });
  }
}
function drawSparks(g, list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life -= dt; p.vy += 520 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.life <= 0) { list.splice(i, 1); continue; }
    g.fillStyle = `hsla(${p.hue},100%,${55 + p.life * 40}%,${Math.min(1, p.life * 2)})`;
    g.fillRect(p.x, p.y, 2.5, 2.5);
  }
}

function bgWorkshop(g, W, H) {
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#191b1f'); grd.addColorStop(1, '#0d0e10');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W / 2, H, 20, W / 2, H, H * 0.8);
  glow.addColorStop(0, 'rgba(236,100,30,.22)'); glow.addColorStop(1, 'rgba(236,100,30,0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
}

function bigText(g, txt, x, y, size, color = '#fff') {
  g.save();
  g.font = `900 ${size}px ${DISPLAY}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 12;
  g.fillStyle = color; g.fillText(txt, x, y);
  g.restore();
}

/* ================= Jeu 1 : La Coulée ================= */
// formes de moule : largeur relative de l'empreinte selon la hauteur (0 = fond, 1 = haut)
const COULEE_SHAPES = [
  { name: 'Lingot', tip: 'Il s’évase vers le bas : le niveau monte de plus en plus vite.', w: h => 1 - 0.35 * h },
  { name: 'Bouteille', tip: 'Le goulot se remplit d’un coup !', w: h => (h < 0.5 ? 1 : h < 0.68 ? 1 - (h - 0.5) / 0.18 * 0.72 : 0.28) },
  { name: 'Cloche', tip: 'Large en bas, fine en haut.', w: h => 0.3 + 0.7 * (1 - h) ** 1.7 },
  { name: 'Entonnoir', tip: 'Fin en bas, large en haut : ça ralentit en montant.', w: h => 0.18 + 0.82 * h },
  { name: 'Sablier', tip: 'Étranglé au milieu : attention au passage rapide.', w: h => 0.22 + 0.78 * Math.abs(2 * h - 1) ** 1.2 },
  { name: 'Gradins', tip: 'Trois marches : le débit change à chaque palier.', w: h => (h < 0.34 ? 1 : h < 0.67 ? 0.62 : 0.3) },
  { name: 'Boulet', tip: 'Une sphère : lent au milieu, rapide aux bouts.', w: h => Math.max(0.12, 2 * Math.sqrt(Math.max(0, h * (1 - h)))) },
  { name: 'Vase', tip: 'Ventre, col étroit, puis évasé.', w: h => 0.5 + 0.38 * Math.sin(h * Math.PI * 1.6 + 0.3) },
  { name: 'Rouet', tip: 'Une roue à rayons : alternance de vides et de pleins.', w: h => (Math.floor(h * 6) % 2 ? 0.35 : 1) },
];

function runCoulee(stage, api) {
  const W = 360, H = 520, ROUNDS = 6;
  const { c, g } = makeCanvas(stage, W, H);
  const mold = { x: 70, y: 215, w: 220, h: 255 };
  const STEPS = 200;
  let round = 0, score = 0, level, vol, target, tol, flow, rate, holding = false, phase, timer = 0, msg = '', msgColor = '#fff', poured, pts = 0;
  let shape, cum, order = [];
  const parts = [];

  // volume cumulé (aire de la coupe) en fonction de la hauteur, normalisé à 1
  function prepare(sh) {
    cum = [0];
    for (let i = 1; i <= STEPS; i++) cum.push(cum[i - 1] + sh.w((i - 0.5) / STEPS));
    const total = cum[STEPS];
    cum = cum.map(v => v / total);
  }
  const levelOf = v => {   // hauteur atteinte pour un volume versé donné
    if (v <= 0) return 0;
    if (v >= 1) return 1;
    let lo = 0, hi = STEPS;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= v) lo = m; else hi = m; }
    return (lo + (v - cum[lo]) / (cum[hi] - cum[lo] || 1)) / STEPS;
  };
  const volOf = h => { const i = Math.min(STEPS - 1, Math.floor(h * STEPS)); return cum[i] + (cum[i + 1] - cum[i]) * (h * STEPS - i); };

  function next() {
    round++;
    if (!order.length) order = COULEE_SHAPES.map((_, i) => i).sort(() => Math.random() - 0.5);
    shape = COULEE_SHAPES[order.pop()];
    prepare(shape);
    level = 0; vol = 0; flow = 0; poured = false; msg = '';
    target = rand(0.42, 0.88);
    tol = 0.07 - round * 0.006;
    rate = 0.2 + round * 0.04;                   // débit en part du volume total par seconde
    phase = 'ready';
    api.info(`Moule ${round}/${ROUNDS} · ${shape.name}`);
  }
  next();

  function evaluate() {
    const err = Math.abs(level - target);
    if (err <= tol) {
      pts = Math.round(100 - (err / tol) * 30);
      msg = err < tol * 0.3 ? 'COULÉE PARFAITE' : 'DANS LA LIGNE';
      msgColor = '#F5B700'; SFX.good();
    } else {
      pts = Math.max(0, Math.round(70 - (err - tol) * 700));
      msg = level < target ? 'PAS ASSEZ' : 'TROP PLEIN';
      msgColor = '#ff8a8a'; SFX.bad();
    }
    score += pts; api.score(score);
    phase = 'result'; timer = 1.6;
  }

  const offInput = holdInput(c,
    () => { if (phase === 'ready' || phase === 'pour') { holding = true; phase = 'pour'; poured = true; } },
    () => { holding = false; });

  // contour de l'empreinte (moitié gauche puis droite), en coordonnées écran
  const outline = () => {
    const pts2 = [], cx = mold.x + mold.w / 2;
    for (let i = 0; i <= 60; i++) { const h = i / 60; pts2.push([cx - shape.w(h) * mold.w / 2, mold.y + mold.h - h * mold.h]); }
    for (let i = 60; i >= 0; i--) { const h = i / 60; pts2.push([cx + shape.w(h) * mold.w / 2, mold.y + mold.h - h * mold.h]); }
    return pts2;
  };

  const stop = loop((dt, t) => {
    if (phase === 'pour') {
      flow += ((holding ? rate : 0) - flow) * Math.min(1, dt * 5);
      vol += flow * dt;
      level = levelOf(vol);
      const cxp = mold.x + mold.w / 2;
      if (flow > 0.02 && Math.random() < 0.6) sparks(parts, rand(cxp - 10, cxp + 10), mold.y + mold.h - level * mold.h, 1, 25);
      if (vol >= 1) { level = 1; pts = 0; msg = 'DÉBORDEMENT !'; msgColor = '#ff8a8a'; SFX.bad(); sparks(parts, W / 2, mold.y, 40, 20); phase = 'result'; timer = 1.6; }
      else if (!holding && poured && flow < 0.004) evaluate();
    } else if (phase === 'result') {
      flow *= 0.9;
      timer -= dt;
      if (timer <= 0) {
        if (round >= ROUNDS) { api.end(score); return false; }
        next();
      }
    }

    /* --- rendu --- */
    bgWorkshop(g, W, H);
    const cx = mold.x + mold.w / 2;
    // poche de coulée
    const tilt = clamp(flow / rate, 0, 1) * 0.55;
    g.save();
    g.translate(cx - 30, 85); g.rotate(tilt);
    g.fillStyle = '#4a4e54'; g.fillRect(-120, -6, 70, 10);
    g.beginPath(); g.moveTo(-50, -34); g.lineTo(40, -34); g.lineTo(30, 26); g.lineTo(-40, 26); g.closePath();
    g.fillStyle = '#3a3d42'; g.fill(); g.strokeStyle = '#5c6067'; g.lineWidth = 3; g.stroke();
    const lg = g.createLinearGradient(0, -34, 0, -20); lg.addColorStop(0, '#ffe08a'); lg.addColorStop(1, '#EC641E');
    g.fillStyle = lg; g.fillRect(-46, -32, 82, 9);
    g.restore();
    // châssis et sable
    g.fillStyle = '#2f6b4a'; g.fillRect(mold.x - 22, mold.y - 30, mold.w + 44, mold.h + 46);
    g.fillStyle = '#6a553e'; g.fillRect(mold.x - 14, mold.y - 22, mold.w + 28, mold.h + 30);
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(${i % 2 ? '0,0,0' : '255,230,190'},.08)`; g.fillRect(mold.x - 14 + ((i * 53) % (mold.w + 28)), mold.y - 22 + ((i * 97) % (mold.h + 30)), 3, 3); }
    // descente de coulée jusqu'au haut de l'empreinte
    g.fillStyle = '#16120e'; g.fillRect(cx - 9, mold.y - 22, 18, 24);
    // empreinte
    const poly = outline();
    g.beginPath(); poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
    g.fillStyle = '#16120e'; g.fill();
    g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 3; g.stroke();
    // jet de métal
    const surfaceY = mold.y + mold.h - level * mold.h;
    if (flow > 0.006) {
      const wdt = 3 + (flow / rate) * 10;
      const jet = g.createLinearGradient(0, 100, 0, surfaceY);
      jet.addColorStop(0, '#ffe7a0'); jet.addColorStop(1, '#EC641E');
      g.fillStyle = jet;
      g.fillRect(cx - wdt / 2 + Math.sin(t / 40) * 1.5, 98, wdt, surfaceY - 98);
    }
    // métal : l'empreinte remplie jusqu'au niveau
    if (level > 0) {
      g.save();
      g.beginPath(); poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.clip();
      const mg = g.createLinearGradient(0, surfaceY, 0, mold.y + mold.h);
      mg.addColorStop(0, '#ffd56b'); mg.addColorStop(0.25, '#EC641E'); mg.addColorStop(1, '#8a1f1f');
      g.fillStyle = mg;
      g.beginPath(); g.moveTo(mold.x, mold.y + mold.h + 2);
      for (let x = 0; x <= mold.w; x += 8) g.lineTo(mold.x + x, surfaceY + Math.sin(x / 12 + t / 120) * (flow > 0.01 ? 2.5 : 0.8));
      g.lineTo(mold.x + mold.w, mold.y + mold.h + 2); g.closePath(); g.fill();
      g.restore();
    }
    // ligne cible et bande de tolérance
    const ty = mold.y + mold.h - target * mold.h, band = tol * mold.h;
    g.fillStyle = 'rgba(245,183,0,.14)'; g.fillRect(mold.x - 14, ty - band, mold.w + 28, band * 2);
    g.setLineDash([8, 6]); g.strokeStyle = '#F5B700'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(mold.x - 22, ty); g.lineTo(mold.x + mold.w + 22, ty); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#F5B700'; g.font = `800 12px ${DISPLAY}`; g.textAlign = 'left';
    g.fillText('LIGNE', mold.x + mold.w + 18, ty - 6);
    // jauge de volume versé
    const need = volOf(target);
    g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(W - 22, mold.y, 10, mold.h);
    g.fillStyle = '#EC641E'; g.fillRect(W - 22, mold.y + mold.h * (1 - vol), 10, mold.h * vol);
    g.fillStyle = '#F5B700'; g.fillRect(W - 26, mold.y + mold.h * (1 - need) - 1, 18, 2);
    drawSparks(g, parts, dt);
    // textes
    g.font = `900 22px ${DISPLAY}`; g.fillStyle = '#f2f4f7'; g.textAlign = 'center';
    g.fillText(`MOULE « ${shape.name.toUpperCase()} »`, W / 2, 150);
    g.font = '600 12px Archivo, sans-serif'; g.fillStyle = '#c6cad0'; g.fillText(shape.tip, W / 2, 168);
    if (phase === 'ready') bigText(g, round === 1 ? 'MAINTIENS POUR VERSER' : `MOULE ${round}`, W / 2, 196, 22, '#f2f4f7');
    if (phase === 'result') { bigText(g, msg, W / 2, 330, 34, msgColor); bigText(g, `+${pts}`, W / 2, 365, 26, '#fff'); }
    g.fillStyle = '#9aa0a6'; g.font = '600 13px Archivo, sans-serif'; g.textAlign = 'center';
    g.fillText(`Moule ${round} / ${ROUNDS}`, W / 2, H - 22);
  });

  return () => { stop(); offInput(); };
}

/* ================= Jeu 2 : Frappe d'enclume ================= */
function runEnclume(stage, api) {
  const W = 360, H = 520;
  const { c, g } = makeCanvas(stage, W, H);
  const word = (save.pseudo || 'ESFF102').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'ESFF102';
  let pos = 0, dir = 1, speed = 0.75, zoneC = 0.5, zoneW = 0.24, lives = 3, combo = 0, idx = 0, words = 0, score = 0;
  let hammer = 0, msg = '', msgT = 0, msgColor = '#fff', shake = 0, over = false, overT = 0;
  const parts = [];
  api.info(`Vies ${'●'.repeat(lives)}`);

  function newZone() { zoneC = rand(0.2, 0.8); }
  newZone();

  function strike() {
    if (over) return;
    hammer = 0.22;
    if (Math.abs(pos - zoneC) <= zoneW / 2) {
      const perfect = Math.abs(pos - zoneC) < zoneW * 0.14;
      combo++;
      score += 10 * combo + (perfect ? 15 : 0);
      idx++;
      SFX.clank();
      sparks(parts, W / 2, 330, perfect ? 34 : 18, 30);
      msg = perfect ? 'PARFAIT !' : `COMBO ×${combo}`; msgColor = perfect ? '#F5B700' : '#fff'; msgT = 0.7;
      if (idx >= word.length) {
        words++; idx = 0; score += 60; msg = 'SURNOM FORGÉ !'; msgColor = '#F5B700'; msgT = 1.1; SFX.win();
      }
      zoneW = Math.max(0.075, zoneW - 0.011);
      speed = Math.min(2.3, speed + 0.06);
      newZone();
    } else {
      lives--; combo = 0; shake = 0.3;
      SFX.bad();
      msg = 'TROP FROID'; msgColor = '#8fb8ff'; msgT = 0.8;
      api.info(`Vies ${'●'.repeat(Math.max(0, lives))}${'○'.repeat(3 - Math.max(0, lives))}`);
      if (lives <= 0) { over = true; overT = 1.1; }
    }
    api.score(score);
  }
  const offInput = holdInput(c, strike, () => {});

  const stop = loop((dt, t) => {
    if (!over) {
      pos += dir * speed * dt;
      if (pos > 1) { pos = 1; dir = -1; } else if (pos < 0) { pos = 0; dir = 1; }
    } else {
      overT -= dt;
      if (overT <= 0) { api.end(score); return false; }
    }
    hammer = Math.max(0, hammer - dt); msgT = Math.max(0, msgT - dt); shake = Math.max(0, shake - dt);

    g.save();
    if (shake) g.translate(rand(-4, 4), rand(-3, 3));
    bgWorkshop(g, W, H);

    // lettres du surnom
    const n = word.length, bw = Math.min(30, (W - 40) / n - 4), total = n * (bw + 4) - 4;
    let x0 = (W - total) / 2;
    g.font = `900 ${Math.round(bw * 0.95)}px ${DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < n; i++) {
      const x = x0 + i * (bw + 4);
      g.fillStyle = i < idx ? 'rgba(236,100,30,.2)' : '#202226';
      g.fillRect(x, 60, bw, bw * 1.3);
      if (i === idx) { g.fillStyle = '#EC641E'; g.fillRect(x, 60 + bw * 1.3 + 3, bw, 3); }
      g.save();
      if (i < idx) { g.shadowColor = '#EC641E'; g.shadowBlur = 14; g.fillStyle = '#fff'; } else g.fillStyle = '#4a4e54';
      g.fillText(word[i], x + bw / 2, 60 + bw * 0.68);
      g.restore();
    }
    g.fillStyle = '#9aa0a6'; g.font = `600 12px Archivo, sans-serif`;
    g.fillText(`Surnoms forgés : ${words}`, W / 2, 40);

    // enclume
    g.fillStyle = '#2e3136';
    g.beginPath();
    g.moveTo(70, 345); g.lineTo(300, 345); g.quadraticCurveTo(300, 370, 260, 372);
    g.lineTo(230, 372); g.lineTo(220, 400); g.lineTo(250, 420); g.lineTo(110, 420); g.lineTo(140, 400); g.lineTo(130, 372);
    g.lineTo(110, 372); g.quadraticCurveTo(60, 365, 30, 345); g.closePath(); g.fill();
    g.fillStyle = '#41454b'; g.fillRect(70, 343, 230, 5);

    // barre à forger
    const heat = lives / 3;
    const ig = g.createLinearGradient(0, 318, 0, 344);
    ig.addColorStop(0, heat > 0.66 ? '#ffe29a' : heat > 0.33 ? '#ff9a4a' : '#c4452c');
    ig.addColorStop(1, heat > 0.33 ? '#EC641E' : '#6a2219');
    g.save(); g.shadowColor = '#EC641E'; g.shadowBlur = 24 * heat + 4;
    g.fillStyle = ig; g.fillRect(120, 322, 130, 22); g.restore();

    // marteau
    // le marteau tombe sur la barre à l'impact puis remonte
    const ang = hammer > 0 ? -0.85 + (1 - hammer / 0.22) * 1.35 : 0.5 + Math.sin(t / 300) * 0.05;
    g.save(); g.translate(300, 200); g.rotate(ang);
    g.fillStyle = '#7a5434'; g.fillRect(-120, -5, 120, 10);
    g.fillStyle = '#5c6067'; g.fillRect(-150, -22, 40, 44);
    g.fillStyle = '#7d828a'; g.fillRect(-150, -22, 40, 6);
    g.restore();

    drawSparks(g, parts, dt);

    // jauge de frappe
    const bx = 30, by = 455, bwid = W - 60, bh = 26;
    g.fillStyle = '#202226'; g.fillRect(bx, by, bwid, bh);
    const zg = g.createLinearGradient(bx + (zoneC - zoneW / 2) * bwid, 0, bx + (zoneC + zoneW / 2) * bwid, 0);
    zg.addColorStop(0, '#BA2C3A'); zg.addColorStop(0.5, '#ff6a3a'); zg.addColorStop(1, '#BA2C3A');
    g.fillStyle = zg; g.fillRect(bx + (zoneC - zoneW / 2) * bwid, by, zoneW * bwid, bh);
    g.fillStyle = 'rgba(245,183,0,.9)'; g.fillRect(bx + zoneC * bwid - 1.5, by, 3, bh);
    g.fillStyle = '#fff'; g.fillRect(bx + pos * bwid - 2.5, by - 8, 5, bh + 16);
    g.fillStyle = '#9aa0a6'; g.font = `600 12px Archivo, sans-serif`; g.textAlign = 'center';
    g.fillText('Frappe dans la zone chaude', W / 2, by + bh + 22);

    if (msgT > 0) bigText(g, msg, W / 2, 210, 40, msgColor);
    if (over) bigText(g, 'LE MÉTAL A REFROIDI', W / 2, 260, 32, '#8fb8ff');
    g.restore();
  });

  return () => { stop(); offInput(); };
}

/* ================= Jeu 3 : Tri des teintes (memory) ================= */
function runTeintes(stage, api) {
  const models = { rond: 'Col rond', capuche: 'Capuche', zip: 'Zippé' };
  const combos = [];
  Object.keys(models).forEach(m => Object.keys(TEINTES).forEach(t => combos.push({ m, t })));
  const picks = shuffle(combos).slice(0, 8);
  const deck = shuffle([...picks, ...picks].map((p, i) => ({ ...p, key: p.m + p.t, i })));

  const grid = document.createElement('div');
  grid.className = 'memo';
  const status = document.createElement('p');
  status.className = 'memo-status';
  stage.append(grid, status);

  let open = [], lock = false, moves = 0, found = 0, start = 0, timerId = 0, done = false;
  const updateStatus = () => {
    const s = start ? Math.floor((performance.now() - start) / 1000) : 0;
    status.textContent = `${moves} coups · ${s} s · ${found}/8 paires`;
    api.info(`${found}/8 paires`);
  };
  updateStatus();

  deck.forEach(card => {
    const b = document.createElement('button');
    b.className = 'memo-card';
    b.setAttribute('aria-label', 'Carte retournée');
    const te = TEINTES[card.t];
    b.innerHTML = `<div class="memo-inner"><div class="memo-face memo-back">102</div><div class="memo-face memo-front">${sweatSVG(card.m, te.hex)}<span>${models[card.m]}<br>${te.name}</span></div></div>`;
    b.addEventListener('click', () => {
      if (lock || done || b.classList.contains('flip') || b.classList.contains('ok')) return;
      if (!start) { start = performance.now(); timerId = setInterval(updateStatus, 500); }
      b.classList.add('flip'); b.setAttribute('aria-label', `${models[card.m]} ${te.name}`);
      SFX.tick();
      open.push({ b, card });
      if (open.length === 2) {
        moves++;
        const [a, z] = open;
        if (a.card.key === z.card.key) {
          a.b.classList.add('ok'); z.b.classList.add('ok');
          found++; open = []; SFX.good();
          if (found === 8) {
            done = true; clearInterval(timerId);
            const secs = (performance.now() - start) / 1000;
            const score = Math.max(50, Math.round(600 - (moves - 8) * 20 - secs * 4));
            api.score(score); SFX.win();
            setTimeout(() => api.end(score), 700);
          }
        } else {
          lock = true;
          setTimeout(() => {
            a.b.classList.remove('flip'); z.b.classList.remove('flip');
            a.b.setAttribute('aria-label', 'Carte retournée'); z.b.setAttribute('aria-label', 'Carte retournée');
            open = []; lock = false;
          }, 750);
        }
        updateStatus();
      }
    });
    grid.appendChild(b);
  });

  return () => clearInterval(timerId);
}

/* ================= Jeu 4 : La Poche ================= */
function runPoche(stage, api) {
  const W = 360, H = 520, DURATION = 45;
  const { c, g } = makeCanvas(stage, W, H);
  let px = W / 2, tx = W / 2, keyDir = 0, time = DURATION, lives = 3, score = 0, spawn = 0, fill = 0, flash = 0, over = false, overT = 0;
  const items = [], parts = [], pops = [];
  const TYPES = [
    { type: 'drop',  w: 58, pts: 10 },
    { type: 'slag',  w: 22 },
    { type: 'water', w: 11 },
    { type: 'sweat', w: 9, pts: 50 },
  ];
  const sweatTones = Object.values(TEINTES).map(t => t.hex);
  const info = () => api.info(`${Math.ceil(time)} s · ${'●'.repeat(Math.max(0, lives))}${'○'.repeat(3 - Math.max(0, lives))}`);
  info();

  const toLocal = e => { const r = c.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * W; };
  const pm = e => { tx = toLocal(e); };
  const pd = e => { e.preventDefault(); tx = toLocal(e); };
  const kd = e => { if (e.key === 'ArrowLeft') { keyDir = -1; e.preventDefault(); } if (e.key === 'ArrowRight') { keyDir = 1; e.preventDefault(); } };
  const ku = e => { if ((e.key === 'ArrowLeft' && keyDir < 0) || (e.key === 'ArrowRight' && keyDir > 0)) keyDir = 0; };
  c.addEventListener('pointermove', pm);
  c.addEventListener('pointerdown', pd);
  window.addEventListener('keydown', kd);
  window.addEventListener('keyup', ku);

  function pickType() {
    const tot = TYPES.reduce((s, t) => s + t.w, 0);
    let r = Math.random() * tot;
    for (const t of TYPES) { if ((r -= t.w) < 0) return t; }
    return TYPES[0];
  }

  const stop = loop((dt, t) => {
    const prog = 1 - time / DURATION;
    if (!over) {
      time -= dt;
      if (keyDir) tx = clamp(tx + keyDir * 420 * dt, 40, W - 40);
      px += (clamp(tx, 40, W - 40) - px) * Math.min(1, dt * 14);
      spawn -= dt;
      if (spawn <= 0) {
        const ty = pickType();
        items.push({ ...ty, x: rand(24, W - 24), y: -20, vy: rand(150, 210) + prog * 170, rot: rand(0, 6), tone: sweatTones[Math.floor(Math.random() * 4)] });
        spawn = rand(0.45, 0.8) - prog * 0.25;
      }
      if (time <= 0 || lives <= 0) { over = true; overT = 1.2; if (lives > 0) SFX.win(); }
      if (Math.ceil(time) !== Math.ceil(time + dt)) info();
    } else {
      overT -= dt;
      if (overT <= 0) { api.end(score); return false; }
    }

    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.y += it.vy * dt; it.rot += dt * 2;
      if (!over && it.y > H - 92 && it.y < H - 58 && Math.abs(it.x - px) < 46) {
        items.splice(i, 1);
        if (it.pts) {
          score += it.pts; fill = Math.min(1, fill + (it.type === 'drop' ? 0.03 : 0.08));
          pops.push({ x: it.x, y: H - 100, txt: `+${it.pts}`, life: 0.8 });
          sparks(parts, it.x, H - 80, it.type === 'sweat' ? 20 : 8, 30);
          it.type === 'sweat' ? SFX.good() : SFX.tick();
        } else {
          lives--; flash = 0.3; SFX.bad(); info();
          sparks(parts, it.x, H - 80, 16, it.type === 'water' ? 200 : 0);
          pops.push({ x: it.x, y: H - 100, txt: it.type === 'water' ? 'VAPEUR !' : 'SCORIE !', life: 0.9, bad: true });
        }
        api.score(score);
        continue;
      }
      if (it.y > H + 30) items.splice(i, 1);
    }

    /* rendu */
    bgWorkshop(g, W, H);
    for (const it of items) {
      g.save(); g.translate(it.x, it.y);
      if (it.type === 'drop') {
        g.shadowColor = '#EC641E'; g.shadowBlur = 16;
        const dg = g.createRadialGradient(-3, -3, 1, 0, 0, 12); dg.addColorStop(0, '#fff2b0'); dg.addColorStop(0.5, '#ffb347'); dg.addColorStop(1, '#EC641E');
        g.fillStyle = dg; g.beginPath(); g.arc(0, 2, 10, 0, Math.PI * 2); g.moveTo(-8, -3); g.lineTo(0, -16); g.lineTo(8, -3); g.fill();
      } else if (it.type === 'slag') {
        g.rotate(it.rot); g.fillStyle = '#55504a'; g.strokeStyle = '#2a2724'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(-13, -6); g.lineTo(-4, -14); g.lineTo(10, -10); g.lineTo(14, 4); g.lineTo(3, 13); g.lineTo(-12, 8); g.closePath(); g.fill(); g.stroke();
      } else if (it.type === 'water') {
        g.fillStyle = '#5aa8ff'; g.beginPath(); g.arc(0, 2, 9, 0, Math.PI * 2); g.moveTo(-7, -2); g.lineTo(0, -15); g.lineTo(7, -2); g.fill();
        g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(-4, -1, 3, 5);
      } else {
        g.rotate(Math.sin(it.rot) * 0.3);
        g.fillStyle = it.tone; g.strokeStyle = '#f2f4f7'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(-8, -14); g.lineTo(-20, -9); g.lineTo(-25, 3); g.lineTo(-17, 6); g.lineTo(-14, 0); g.lineTo(-14, 16); g.lineTo(14, 16); g.lineTo(14, 0); g.lineTo(17, 6); g.lineTo(25, 3); g.lineTo(20, -9); g.lineTo(8, -14); g.quadraticCurveTo(0, -8, -8, -14); g.closePath(); g.fill(); g.stroke();
      }
      g.restore();
    }

    // poche de coulée (joueur)
    g.save(); g.translate(px, H - 70);
    g.fillStyle = '#2e3136'; g.strokeStyle = '#6a6f77'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-46, -22); g.lineTo(46, -22); g.lineTo(36, 26); g.lineTo(-36, 26); g.closePath(); g.fill(); g.stroke();
    if (fill > 0) {
      const fh = 44 * fill;
      const fg = g.createLinearGradient(0, 24 - fh, 0, 24); fg.addColorStop(0, '#ffd56b'); fg.addColorStop(1, '#EC641E');
      g.save(); g.beginPath(); g.moveTo(-44, -20); g.lineTo(44, -20); g.lineTo(35, 24); g.lineTo(-35, 24); g.closePath(); g.clip();
      g.fillStyle = fg; g.fillRect(-46, 24 - fh, 92, fh); g.restore();
    }
    g.fillStyle = '#4a4e54'; g.fillRect(-60, -6, 14, 8); g.fillRect(46, -6, 14, 8);
    g.restore();

    drawSparks(g, parts, dt);
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i]; p.life -= dt; p.y -= 40 * dt;
      if (p.life <= 0) { pops.splice(i, 1); continue; }
      g.globalAlpha = Math.min(1, p.life * 2);
      bigText(g, p.txt, p.x, p.y, 22, p.bad ? '#ff8a8a' : '#F5B700');
      g.globalAlpha = 1;
    }
    // chrono
    g.fillStyle = '#202226'; g.fillRect(20, 16, W - 40, 6);
    g.fillStyle = '#EC641E'; g.fillRect(20, 16, (W - 40) * clamp(time / DURATION, 0, 1), 6);
    if (flash > 0) { flash -= dt; g.fillStyle = `rgba(186,44,58,${flash})`; g.fillRect(0, 0, W, H); }
    if (over) bigText(g, lives > 0 ? 'FIN DE COULÉE' : 'POCHE PERCÉE', W / 2, H / 2 - 40, 40, lives > 0 ? '#F5B700' : '#ff8a8a');
  });

  return () => {
    stop();
    c.removeEventListener('pointermove', pm);
    c.removeEventListener('pointerdown', pd);
    window.removeEventListener('keydown', kd);
    window.removeEventListener('keyup', ku);
  };
}

/* ================= Jeu 5 : Quiz métallurgie (questions et correction côté serveur) ================= */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function runQuiz(stage, api) {
  const LIMIT = 20000;
  let alive = true, timerId = 0, qs = [];
  const answers = [];
  stage.innerHTML = '<div class="screen"><p>Chargement des questions…</p></div>';
  fetch('/api/quiz').then(r => r.json()).then(d => { if (alive) { qs = d.questions; ask(0); } })
    .catch(() => { if (alive) stage.innerHTML = '<div class="screen"><h4>Serveur requis</h4><p>Le quiz a besoin du serveur Arcade 102 (python server.py).</p></div>'; });

  function ask(i) {
    if (i >= qs.length) return submit();
    const q = qs[i];
    api.info(`Question ${i + 1}/${qs.length}`);
    stage.innerHTML = `<div class="quiz">
      <div class="quiz-bar"><i></i></div>
      <p class="quiz-num">Question ${i + 1} / ${qs.length}</p>
      <h4 class="quiz-q">${esc(q.q)}</h4>
      <div class="quiz-choices">${q.choices.map((c, k) => `<button class="quiz-choice" data-k="${k}">${esc(c)}</button>`).join('')}</div>
    </div>`;
    const bar = $('.quiz-bar i', stage);
    const t0 = performance.now();
    let answered = false;
    const pick = (choice, btn) => {
      if (answered) return;
      answered = true;
      clearInterval(timerId);
      answers.push({ id: q.id, choice });
      if (btn) btn.classList.add('picked');
      SFX.tick();
      setTimeout(() => { if (alive) ask(i + 1); }, 380);
    };
    stage.querySelectorAll('.quiz-choice').forEach(b => b.addEventListener('click', () => pick(q.choices[+b.dataset.k], b)));
    timerId = setInterval(() => {
      const f = 1 - (performance.now() - t0) / LIMIT;
      bar.style.width = `${Math.max(0, f * 100)}%`;
      if (f <= 0) pick(null, null);
    }, 100);
  }

  async function submit() {
    stage.innerHTML = '<div class="screen"><p>Correction en cours…</p></div>';
    let r;
    try { r = await apiCall('/api/quiz', { answers }); } catch (e) {
      stage.innerHTML = `<div class="screen"><h4>Oups</h4><p>${esc(e.message)}</p></div>`;
      return;
    }
    if (!alive) return;
    api.score(r.score);
    const prev = save.best.quiz || 0;
    if (r.score > prev) { save.best.quiz = r.score; persist(); renderGames(); }
    r.ticket ? (SFX.win(), toast('🎟️ Ticket à gratter gagné !')) : SFX.bad();
    const wrong = r.correction.filter(c => !c.ok);
    stage.innerHTML = `<div class="screen">
      <span class="kicker" style="margin:0">Résultat</span>
      <div class="big-score">${r.score}<small>/10</small></div>
      <div class="ticket-box ${r.ticket ? 'won' : ''}">${r.ticket ? '🎟️ ' : ''}${esc(r.message)}</div>
      ${wrong.length ? `<div class="quiz-review"><b>À revoir</b>${wrong.map(c => `<p>${esc(c.q)}<br><span>✔ ${esc(c.answer)}</span>${c.given ? ` <em>· ta réponse : ${esc(c.given)}</em>` : ' <em>· pas de réponse</em>'}</p>`).join('')}</div>` : '<p>Sans faute, chapeau le fondeur !</p>'}
      <div class="end-actions">
        ${r.ticket ? '<button class="btn btn-hot" data-go="scratch">Gratter mon ticket</button>' : ''}
        <button class="btn ${r.ticket ? 'btn-ghost' : 'btn-hot'}" data-go="again">Rejouer</button>
        <button class="btn btn-ghost" data-go="back">Menu</button>
      </div>
    </div>`;
    bindEndButtons(stage);
  }
  return () => { alive = false; clearInterval(timerId); };
}

/* ================= Interface : modal de jeu ================= */
const modal = $('#modal'), stage = $('#stage');
let cleanup = null, current = null;

function clearStage() {
  if (cleanup) { cleanup(); cleanup = null; }
  stage.innerHTML = '';
}

function openShell(title, label, showScore = true) {
  clearStage();
  $('#modalTitle').textContent = title;
  $('#modalTeinte').textContent = label;
  $('#hudScoreWrap').hidden = !showScore;
  $('#hudScore').textContent = '0';
  $('#hudInfo').textContent = '';
  const entering = modal.hidden;
  modal.hidden = false;
  document.body.classList.add('playing');
  if (entering && typeof fxWarp === 'function') fxWarp($('.crt-content'), 'enter');   // on « rentre » dans le jeu
}

function ticketRule(gm) {
  if (!server) return 'Lance le serveur pour gagner des tickets.';
  if (server.left[gm.id] === 0) return '✔ Ticket du jour déjà gagné sur ce jeu. Tu peux t\'entraîner, reviens demain.';
  if (gm.id === 'quiz') return `🎟️ ${server.quizPass} bonnes réponses sur 10 = 1 ticket à gratter.`;
  if (gm.id === 'usine') return '🎟️ 5 ans de gestion sans faillite = 1 ticket à gratter.';
  return `🎟️ ${server.thresholds[gm.id]} points = 1 ticket à gratter.`;
}

function openGame(id) {
  current = GAMES.find(g => g.id === id);
  const te = TONES[current.teinte];
  openShell(current.title, `Teinte ${te.name} · ${te.sub}`);
  showIntro();
}

function showIntro() {
  clearStage();
  const best = save.best[current.id] || 0;
  const s = document.createElement('div');
  s.className = 'screen';
  s.innerHTML = `
    <div style="width:110px">${sweatSVG(PRODUCTS[current.product].model, TONES[current.teinte].hex)}</div>
    <h4>${current.title}</h4>
    <p>${current.pitch}</p>
    <div class="how">${current.how}</div>
    <div class="ticket-box">${ticketRule(current)}</div>
    ${current.ask === 'pseudo' ? `<label for="pseudoIn">Ton surnom à forger (comme celui brodé dans le dos)</label><input id="pseudoIn" maxlength="10" placeholder="ESFF102" value="${esc(save.pseudo || '')}">` : ''}
    ${best ? `<span class="chip">Ton record : <b>${best}</b></span>` : ''}
    <button class="btn btn-hot" id="goBtn">C'est parti</button>`;
  stage.appendChild(s);
  const go = () => {
    const pin = $('#pseudoIn', s);
    if (pin) { save.pseudo = pin.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10); persist(); }
    startGame();
  };
  $('#goBtn', s).addEventListener('click', go);
  const pin = $('#pseudoIn', s);
  if (pin) pin.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  $('#goBtn', s).focus({ preventScroll: true });
}

function startGame() {
  clearStage();
  $('#hudScore').textContent = '0';
  // retire le focus du bouton pour qu'Espace ne le réactive pas
  if (document.activeElement) document.activeElement.blur();
  cleanup = current.run(stage, {
    score: v => { $('#hudScore').textContent = v; },
    info: v => { $('#hudInfo').textContent = v; },
    end: finish,
  });
}

function bindEndButtons(root) {
  root.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => {
    const go = b.dataset.go;
    if (go === 'again') startGame();
    else if (go === 'back') closeGame();
    else if (go === 'scratch') { closeGame(); openPanel('tickets'); }
  }));
}

function finish(score) {
  const prevBest = save.best[current.id] || 0;
  const isRecord = score > prevBest;
  if (isRecord) { save.best[current.id] = score; persist(); renderGames(); }
  const p = PRODUCTS[current.product];
  const te = TONES[current.teinte];
  const gameId = current.id;
  clearStage();
  const s = document.createElement('div');
  s.className = 'screen';
  s.innerHTML = `
    <span class="kicker" style="margin:0">Score final</span>
    <div class="big-score">${score}</div>
    <div class="end-meta">
      ${isRecord ? '<span class="chip new">Nouveau record</span>' : `<span class="chip">Record : ${prevBest}</span>`}
    </div>
    <div class="ticket-box" id="ticketBox">Envoi du score…</div>
    <div class="end-actions" id="endActions">
      <button class="btn btn-hot" data-go="again">Rejouer</button>
      <button class="btn btn-ghost" data-go="back">Menu</button>
    </div>
    <a class="end-product" href="${p.url}" target="_blank" rel="noopener">
      <img src="${p.img}" alt="${p.name}">
      <div>
        <small>Ce poste se joue en ${te.name}</small>
        <strong>${p.name}</strong>
        <span>${euro(p.price)} · ton code -10 % s'y applique</span>
      </div>
    </a>`;
  stage.appendChild(s);
  bindEndButtons(s);
  $('[data-go="again"]', s).focus({ preventScroll: true });

  apiCall('/api/score', { game: gameId, score }).then(r => {
    const box = $('#ticketBox', s);
    if (!box) return;
    box.textContent = (r.ticket ? '🎟️ ' : '') + r.message;
    if (r.ticket) {
      box.classList.add('won');
      SFX.win();
      toast('🎟️ Ticket à gratter gagné !');
      const b = document.createElement('button');
      b.className = 'btn btn-hot'; b.dataset.go = 'scratch'; b.textContent = 'Gratter mon ticket';
      const actions = $('#endActions', s);
      actions.prepend(b);
      $('[data-go="again"]', s).className = 'btn btn-ghost';
      bindEndButtons(actions);
    }
  }).catch(() => {
    const box = $('#ticketBox', s);
    if (box) box.textContent = 'Serveur injoignable : score non envoyé, pas de ticket.';
  });
}

function closeGame() {
  if (!modal.hidden && typeof fxWarp === 'function') fxWarp($('.crt-content'), 'exit');
  clearStage();
  modal.hidden = true;
  document.body.classList.remove('playing');
  current = null;
  if (typeof onMenuReturn === 'function') onMenuReturn();
}
$('#closeBtn').addEventListener('click', closeGame);
window.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeGame(); });

/* ================= Notifications ================= */
let toastTimer = 0;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

/* ================= Tickets à gratter ================= */
const scratchCard = $('#scratchCard'), scratchCanvas = $('#scratchCanvas'), scratchResult = $('#scratchResult');
let scratching = false;

function refreshTickets() {
  const n = server ? server.tickets : 0;
  $('#ticketCount').textContent = n;
  $('#ticketBig').textContent = n;
  const btn = $('#scratchBtn');
  btn.disabled = scratching || !n;
  btn.textContent = n ? 'Gratter un ticket' : 'Aucun ticket pour l\'instant';
  if (!scratching && !scratchCard.classList.contains('win') && !scratchCard.classList.contains('lose')) {
    $('#scratchHint').textContent = n ? 'Appuie sur « Gratter un ticket » pour commencer.' : 'Joue pour gagner ton premier ticket.';
  }
  const codes = server ? server.codes : [];
  $('#codes').innerHTML = codes.length ? `
    <p class="kicker" style="margin:18px 0 8px">Mon code promo</p>
    ${codes.map(c => `<div class="code-row"><code>${esc(c)}</code><span>-10 % sur esff2027.shop</span><button class="btn btn-sm btn-ghost" data-copy="${esc(c)}">Copier</button></div>`).join('')}
    <p class="muted small">${server.wins} ticket(s) gagnant(s) sur ${server.scratched} gratté(s).</p>` :
    (server && server.scratched ? `<p class="muted small">${server.scratched} ticket(s) gratté(s), pas encore de code. Courage !</p>` : '');
  $('#codes').querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); toast('Code copié !'); } catch (e) { toast(b.dataset.copy); }
  }));
  renderGames();
}

$('#scratchBtn').addEventListener('click', async () => {
  if (scratching || !server || !server.tickets) return;
  scratching = true;
  $('#scratchBtn').disabled = true;
  try {
    const r = await apiCall('/api/scratch', {}, true);
    server.tickets = r.tickets;
    refreshTickets();
    setupScratch(r);
  } catch (e) {
    toast(e.message);
    scratching = false;
    refreshTickets();
  }
});

function setupScratch(r) {
  scratchResult.innerHTML = r.win
    ? `<span class="scratch-tag">Pièce saine !</span><strong>-10 %</strong><code>${esc(r.code)}</code><small>à saisir sur esff2027.shop</small>`
    : `<span class="scratch-tag">Pièce rebutée</span><strong>Perdu</strong><small>Rejoue pour gagner un autre ticket.</small>`;
  scratchCard.classList.remove('idle', 'win', 'lose');
  scratchCard.classList.add('live');
  $('#scratchHint').textContent = 'Gratte le sable avec ton doigt ou ta souris.';

  const cv = scratchCanvas;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = cv.clientWidth, H = cv.clientHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  cv.style.opacity = '1';
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.globalCompositeOperation = 'source-over';
  // texture de sable de moulage
  const grd = g.createLinearGradient(0, 0, W, H);
  grd.addColorStop(0, '#6b5640'); grd.addColorStop(1, '#4a3a2a');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,230,190' : '20,12,6'},${Math.random() * 0.25})`;
    g.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }
  g.fillStyle = 'rgba(255,240,220,.9)';
  g.font = `900 34px ${DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('GRATTE LE SABLE', W / 2, H / 2 - 14);
  g.font = `600 14px Archivo, sans-serif`;
  g.fillText('1 chance sur 5 de gagner -10 %', W / 2, H / 2 + 20);
  g.globalCompositeOperation = 'destination-out';

  let down = false, last = null, strokes = 0, done = false;
  const pt = e => { const b = cv.getBoundingClientRect(); return { x: (e.clientX - b.left) / b.width * W, y: (e.clientY - b.top) / b.height * H }; };
  const scrape = p => {
    g.lineWidth = 44; g.lineCap = 'round';
    g.beginPath(); g.moveTo((last || p).x, (last || p).y); g.lineTo(p.x, p.y); g.stroke();
    last = p;
    if (++strokes % 8 === 0) { SFX.tick(); check(); }
  };
  const check = () => {
    const data = g.getImageData(0, 0, cv.width, cv.height).data;
    let clear = 0, total = 0;
    for (let i = 3; i < data.length; i += 4 * 40) { total++; if (data[i] < 40) clear++; }
    if (clear / total > 0.5) reveal();
  };
  const reveal = () => {
    if (done) return;
    done = true;
    cv.style.opacity = '0';
    scratchCard.classList.remove('live');
    scratchCard.classList.add(r.win ? 'win' : 'lose');
    $('#scratchHint').textContent = r.win ? 'Bravo ! Ton code est aussi gardé dans « Mon code promo ».' : 'Pas de chance cette fois. Rejoue pour un nouveau ticket !';
    r.win ? (SFX.win(), toast('🔥 Code -10 % gagné !')) : SFX.bad();
    off();
    scratching = false;
    applyStatus(r);
  };
  const pd = e => { e.preventDefault(); down = true; last = null; cv.setPointerCapture(e.pointerId); scrape(pt(e)); };
  const pm = e => { if (down) scrape(pt(e)); };
  const pu = () => { down = false; last = null; };
  cv.addEventListener('pointerdown', pd);
  cv.addEventListener('pointermove', pm);
  cv.addEventListener('pointerup', pu);
  cv.addEventListener('pointercancel', pu);
  function off() {
    cv.removeEventListener('pointerdown', pd);
    cv.removeEventListener('pointermove', pm);
    cv.removeEventListener('pointerup', pu);
    cv.removeEventListener('pointercancel', pu);
  }
}

/* Son on/off */
const muteBtn = $('#muteBtn');
function paintMute() { muteBtn.textContent = muted ? '🔇' : '🔊'; muteBtn.setAttribute('aria-label', muted ? 'Activer le son' : 'Couper le son'); }
muteBtn.addEventListener('click', () => { muted = !muted; save.muted = muted; persist(); paintMute(); });
paintMute();

/* ================= Braises du hero ================= */
(function embers() {
  const cv = $('#embers');
  const g = cv.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0;
  const pts = [];
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);
  for (let i = 0; i < 70; i++) pts.push({ x: Math.random() * W, y: Math.random() * H, s: rand(0.6, 2.4), v: rand(18, 60), w: rand(0, 6) });
  if (reduce) return;
  loop((dt, t) => {
    g.clearRect(0, 0, W, H);
    for (const p of pts) {
      p.y -= p.v * dt; p.x += Math.sin(t / 900 + p.w) * 12 * dt;
      if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
      const a = clamp(p.y / H, 0, 1);
      g.fillStyle = `rgba(255,${120 + p.s * 40 | 0},40,${0.25 + a * 0.6})`;
      g.beginPath(); g.arc(p.x, p.y, p.s, 0, Math.PI * 2); g.fill();
    }
  });
})();


