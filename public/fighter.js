/* Forge Fighters — affichage du combat (la simulation tourne sur le serveur, fighter.py) */
'use strict';

const FIGHTERS = {
  fondeur:    { name: 'Marius',   title: 'Le Fondeur',    color: '#EC641E', skin: '#e0a77d', pants: '#2b2f36', special: 'Coulée de fonte', desc: 'Équilibré. Spécial : projette une louche de fonte en fusion.' },
  forgeronne: { name: 'Brigitte', title: 'La Forgeronne', color: '#BA2C3A', skin: '#c98c63', pants: '#3a2a22', special: 'Marteau-pilon',  desc: 'Lente mais lourde. Spécial : coup de masse par-dessus la garde.' },
  mouleur:    { name: 'Sacha',    title: 'Le Mouleur',    color: '#8A8D91', skin: '#f0c39b', pants: '#33383f', special: 'Tempête de sable', desc: 'Solide. Spécial : souffle de sable qui repousse et étourdit.' },
  ebarbeuse:  { name: 'Nina',     title: "L'Ébarbeuse",   color: '#2E3238', skin: '#8d5a3b', pants: '#1f2227', special: 'Meuleuse',        desc: 'Rapide. Spécial : ruée à la meuleuse, plusieurs coups.' },
};
// timings miroirs de fighter.py (pour animer les coups)
const F_MOVES = {
  jab: [3, 3, 7], kick: [6, 3, 11], low: [6, 3, 12], upper: [6, 4, 18], air: [4, 6, 6],
  coulee: [10, 1, 16], masse: [14, 4, 22], sable: [8, 5, 18], meuleuse: [5, 12, 14],
};
const F_KEYS = { L: 1, R: 2, U: 4, D: 8, P: 16, K: 32, S: 64 };
const LEN = { thigh: 48, shin: 46, torso: 62, upper: 36, fore: 34 };

/* ---------- utilitaires de dessin ---------- */
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = c => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c * amt : (255 - c) * amt))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
const lerp = (a, b, t) => a + (b - a) * t;
const dirDown = (a, l) => [Math.sin(a) * l, Math.cos(a) * l];   // angle compté depuis la verticale basse, + = vers l'avant

/* Pose d'un combattant selon son état serveur (repère local : x vers l'avant, y vers le bas) */
function fighterPose(f, t) {
  if (f.mv === 'ultime' && typeof ultAnim === 'function') f = { ...f, mv: ultAnim(f.ch) };   // ruée de l'ultime : geste du spécial
  const P = { lean: 0.12, head: 0, sF: 0.5, eF: 2.3, sB: 0.2, eB: 2.4, hF: 0.32, kF: -0.35, hB: -0.28, kB: -0.3, rot: 0, lift: 0, tool: null, toolT: 0 };
  const breathe = Math.sin(t * 3.2) * 0.04;
  P.eF += breathe; P.eB -= breathe; P.lean += breathe * 0.5;
  const crouchLegs = () => { P.hF = 1.25; P.kF = -2.05; P.hB = 0.6; P.kB = -2.25; P.lean = 0.38; };
  const guardHigh = () => { P.sF = 1.25; P.eF = 2.5; P.sB = 1.05; P.eB = 2.65; };
  switch (f.st) {
    case 'walk': {
      const ph = t * 11;
      P.hF = 0.08 + Math.sin(ph) * 0.42; P.hB = 0.08 - Math.sin(ph) * 0.42;
      P.kF = -0.15 - Math.max(0, Math.cos(ph)) * 0.7; P.kB = -0.15 - Math.max(0, -Math.cos(ph)) * 0.7;
      if (f.bl) guardHigh();
      break;
    }
    case 'crouch':
      crouchLegs();
      if (f.bl) guardHigh(); else { P.sF = 0.7; P.eF = 2.2; P.sB = 0.4; P.eB = 2.3; }
      break;
    case 'jump':
      P.hF = 1.0; P.kF = -1.7; P.hB = 0.35; P.kB = -1.5; P.sF = 1.1; P.eF = 1.6; P.sB = 0.6; P.eB = 1.8;
      break;
    case 'blockstun':
      if (f.lg) crouchLegs();
      guardHigh(); P.lean = f.lg ? 0.3 : -0.05;
      break;
    case 'hit':
      P.lean = -0.45; P.head = -0.35; P.sF = -0.35; P.eF = 0.7; P.sB = -0.9; P.eB = 0.5; P.hF = 0.45; P.kF = -0.25; P.hB = -0.45;
      break;
    case 'down': case 'ko':
      P.rot = f.y > 4 ? -0.9 - Math.min(0.6, f.y / 200) : -1.5; P.sF = 2.2; P.eF = 0.3; P.sB = 1.6; P.eB = 0.2; P.hF = 0.5; P.kF = -0.6; P.hB = 0.15; P.kB = -0.2; P.lean = 0;
      break;
    case 'getup':
      crouchLegs(); P.sF = 1.3; P.eF = 0.6;
      break;
    case 'win':
      P.sF = 3.05; P.eF = 0.15; P.sB = 0.35; P.eB = 2.2; P.lean = -0.06; P.lift = Math.abs(Math.sin(t * 5)) * 10;
      break;
    case 'attack': {
      const tm = F_MOVES[f.mv] || [4, 4, 8];
      const total = tm[0] + tm[1] + tm[2];
      const fr = f.p * total;
      const w = fr < tm[0] ? fr / tm[0] : 0;                                   // armé
      const x = fr < tm[0] ? 0 : fr < tm[0] + tm[1] ? 1 : 1 - (fr - tm[0] - tm[1]) / tm[2];   // extension
      const strike = fr >= tm[0] ? x : 0;
      switch (f.mv) {
        case 'jab':
          P.sF = lerp(0.5 - w * 0.25, 1.58, strike); P.eF = lerp(2.3, 0.05, strike); P.lean = 0.12 + strike * 0.14;
          break;
        case 'kick':
          P.hF = lerp(0.32 + w * 0.7, 1.58, strike); P.kF = lerp(-0.35 - w * 1.3, -0.04, strike); P.lean = lerp(0.12, -0.38, Math.max(w, strike));
          P.hB = -0.12;
          break;
        case 'low':
          crouchLegs(); P.hF = lerp(1.25, 1.5, strike); P.kF = lerp(-2.05, -0.08, strike); P.lean = 0.55; P.sF = 0.8; P.eF = 1.9;
          break;
        case 'upper':
          P.hF = lerp(0.9, 0.3, strike); P.kF = lerp(-1.4, -0.3, strike); P.hB = lerp(0.4, -0.2, strike); P.kB = lerp(-1.6, -0.2, strike);
          P.sF = lerp(-0.3, 2.95, strike); P.eF = lerp(1.9, 0.35, strike); P.lean = lerp(0.45, -0.1, strike); P.lift = strike * 14;
          break;
        case 'air':
          P.hF = lerp(1.2, 0.95, strike); P.kF = lerp(-1.9, 0, strike); P.hB = 0.25; P.kB = -1.6; P.sF = 0.9; P.eF = 1.4; P.lean = lerp(0.1, -0.3, strike);
          break;
        case 'coulee':
          P.sF = lerp(0.4 - w * 0.9, 1.45, strike); P.eF = lerp(1.5, 0.15, strike); P.sB = lerp(0.2 - w * 0.9, 1.3, strike); P.eB = lerp(1.6, 0.3, strike);
          P.lean = lerp(-0.1 * w, 0.3, strike); P.hF = 0.55; P.hB = -0.4; P.tool = 'ladle'; P.toolT = strike;
          break;
        case 'masse':
          P.sF = strike ? lerp(3.4, 1.25, strike) : lerp(0.5, 3.4, w); P.eF = 0.25; P.sB = P.sF - 0.15; P.eB = 0.35;
          P.lean = strike ? lerp(-0.2, 0.55, strike) : -0.2 * w; P.hF = 0.6; P.kF = -0.5; P.hB = -0.5; P.tool = 'hammer';
          break;
        case 'sable':
          P.sF = strike ? lerp(-0.9, 1.7, strike) : -0.9 * w; P.eF = 0.1; P.sB = strike ? lerp(-1.1, 1.4, strike) : -1.1 * w; P.eB = 0.2;
          P.lean = strike ? 0.35 : -0.15 * w; P.hF = 0.6; P.kF = -0.3; P.hB = -0.5;
          break;
        case 'meuleuse':
          P.lean = 0.5; P.sF = 1.42; P.eF = 0.35; P.sB = 1.25; P.eB = 0.55; P.hF = 0.7; P.kF = -0.9; P.hB = -0.7; P.kB = -0.3; P.tool = 'grinder'; P.toolT = t;
          break;
      }
      break;
    }
  }
  return P;
}

/* Dessine un combattant ; (sx, sy) = pieds à l'écran, k = échelle */
function drawFighter(g, f, sx, sy, k, t, opts = {}) {
  const LOOKS = typeof FIGHTER_LOOKS !== 'undefined' ? FIGHTER_LOOKS : FIGHTERS;
  const C = LOOKS[f.ch] || FIGHTERS.fondeur;
  const P = fighterPose(f, t);
  // chaîne des jambes depuis la hanche (0,0)
  const leg = (h, kn) => { const kx = dirDown(h, LEN.thigh); const s = dirDown(h + kn, LEN.shin); return { knee: kx, foot: [kx[0] + s[0], kx[1] + s[1]] }; };
  const lf = leg(P.hF, P.kF), lb = leg(P.hB, P.kB);
  const hipY = -Math.max(lf.foot[1], lb.foot[1]);          // pieds posés au sol
  const neck = [Math.sin(P.lean) * LEN.torso, -Math.cos(P.lean) * LEN.torso];
  const sh = [neck[0] * 0.92, neck[1] * 0.92];
  const arm = (s, e) => { const el = dirDown(s, LEN.upper); const hd = dirDown(s + e, LEN.fore); return { elbow: [sh[0] + el[0], sh[1] + el[1]], hand: [sh[0] + el[0] + hd[0], sh[1] + el[1] + hd[1]], fa: s + e }; };
  const af = arm(P.sF, P.eF), ab = arm(P.sB, P.eB);

  g.save();
  g.translate(sx, sy);
  // ombre au sol
  g.fillStyle = 'rgba(0,0,0,.35)';
  g.beginPath(); g.ellipse(0, 0, 48 * k, 9 * k, 0, 0, Math.PI * 2); g.fill();
  g.scale(k * (f.fc || 1), k);
  g.translate(0, -(f.y || 0) / 1 - P.lift);
  if (P.rot) { g.translate(0, -30); g.rotate(P.rot); g.translate(0, 30 + (f.y > 4 ? 0 : 52)); }
  g.translate(0, hipY);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const limb = (a, b, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); };
  const seg = (pts, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.stroke(); };
  const boot = (lg, col) => { g.fillStyle = col; g.save(); g.translate(lg.foot[0], lg.foot[1]); g.beginPath(); g.roundRect(-9, -8, 28, 13, 4); g.fill(); g.restore(); };
  const glove = (h, col) => { g.fillStyle = col; g.beginPath(); g.arc(h[0], h[1], 9, 0, Math.PI * 2); g.fill(); };
  const hit = opts.flash ? '#ffffff' : null;
  const sweat = hit || C.color, sweatB = hit || shade(C.color, -0.3);
  const pants = hit || C.pants, pantsB = hit || shade(C.pants, -0.35);
  const gloveC = hit || '#b07a45';

  // membres arrière
  seg([sh, ab.elbow], 17, sweatB); seg([ab.elbow, ab.hand], 15, sweatB); glove(ab.hand, hit || shade('#b07a45', -0.3));
  seg([[0, 0], lb.knee, lb.foot], 21, pantsB); boot(lb, hit || '#0b0b0c');
  // torse (sweat de promo)
  g.save(); g.rotate(P.lean);
  g.fillStyle = sweat;
  g.beginPath(); g.roundRect(-20, -LEN.torso - 4, 42, LEN.torso + 14, 14); g.fill();
  if (!hit) {
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(-20, 2, 42, 8);                 // bord-côte
    if (f.ch === 'fondeur' || f.ch === 'forgeronne') {                          // tablier (aluminisé ou cuir)
      g.fillStyle = f.ch === 'fondeur' ? '#c9ccd1' : '#6b4227';
      g.beginPath(); g.roundRect(4, -LEN.torso * 0.55, 20, LEN.torso * 0.55 + 40, 6); g.fill();
    }
    g.strokeStyle = '#fff'; g.lineWidth = 2.2; g.beginPath(); g.arc(10, -LEN.torso + 22, 6, 0, Math.PI * 2); g.stroke();  // logo ESFF
  }
  g.restore();
  // tête
  const hx = neck[0] + Math.sin(P.lean + P.head) * 14, hy = neck[1] - Math.cos(P.lean + P.head) * 14;
  g.fillStyle = hit || C.skin;
  g.beginPath(); g.arc(hx, hy - 4, 17, 0, Math.PI * 2); g.fill();
  if (!hit) {
    g.save(); g.translate(hx, hy - 4); g.rotate(P.lean + P.head);
    if (f.ch === 'fondeur') {        // cagoule aluminisée + visière
      g.fillStyle = '#c9ccd1'; g.beginPath(); g.arc(-2, -2, 20, Math.PI * 0.55, Math.PI * 2.25); g.lineTo(-6, 22); g.fill();
      g.fillStyle = '#f5b700'; g.beginPath(); g.roundRect(2, -8, 16, 12, 4); g.fill();
    } else if (f.ch === 'forgeronne') { // bandana + chignon
      g.fillStyle = '#3b2216'; g.beginPath(); g.arc(-15, -10, 8, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#BA2C3A'; g.beginPath(); g.arc(0, -4, 18, Math.PI * 1.02, Math.PI * 1.98); g.fill(); g.fillRect(-18, -6, 36, 5);
      g.fillStyle = '#111'; g.fillRect(9, -1, 4, 4);
    } else if (f.ch === 'mouleur') {    // casquette + lunettes
      g.fillStyle = '#4a4e54'; g.beginPath(); g.arc(0, -5, 18, Math.PI, Math.PI * 2); g.fill(); g.fillRect(4, -7, 22, 5);
      g.fillStyle = '#7fd4ff'; g.beginPath(); g.roundRect(4, -3, 13, 8, 3); g.fill();
    } else if (f.ch === 'lamineur') {  // casque de chantier
      g.fillStyle = '#F5B700'; g.beginPath(); g.arc(0, -6, 19, Math.PI, Math.PI * 2); g.fill(); g.fillRect(-22, -8, 44, 5);
      g.fillStyle = '#111'; g.fillRect(9, -1, 4, 4);
    } else if (f.ch === 'chaudronniere') {  // cheveux courts + lunettes de soudure sur le front
      g.fillStyle = '#6b3a1e'; g.beginPath(); g.arc(0, -5, 18, Math.PI * 0.9, Math.PI * 2.1); g.fill();
      g.fillStyle = '#222'; g.beginPath(); g.arc(-5, -14, 5, 0, Math.PI * 2); g.arc(7, -14, 5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#111'; g.fillRect(9, -1, 4, 4);
    } else {                           // masque de soudure relevé + queue de cheval
      g.fillStyle = '#1b1d20'; g.beginPath(); g.moveTo(-14, -12); g.quadraticCurveTo(-30, 2, -24, 16); g.lineTo(-18, 14); g.quadraticCurveTo(-22, 0, -10, -8); g.fill();
      g.fillStyle = '#3a3d42'; g.beginPath(); g.roundRect(-12, -26, 30, 14, 5); g.fill();
      g.fillStyle = '#111'; g.fillRect(9, -1, 4, 4);
    }
    g.restore();
  }
  // membres avant
  seg([[0, 0], lf.knee, lf.foot], 23, pants); boot(lf, hit || '#111214');
  seg([sh, af.elbow], 17, sweat); seg([af.elbow, af.hand], 15, sweat); glove(af.hand, gloveC);

  // outils des coups spéciaux
  if (P.tool === 'ladle') {
    g.save(); g.translate(af.hand[0], af.hand[1]); g.rotate(-af.fa + Math.PI / 2);
    g.strokeStyle = '#6a6f77'; g.lineWidth = 6; g.beginPath(); g.moveTo(0, 0); g.lineTo(42, 0); g.stroke();
    g.fillStyle = '#3a3d42'; g.beginPath(); g.arc(52, 0, 14, -0.2, Math.PI + 0.2); g.fill();
    g.fillStyle = '#ffb347'; g.beginPath(); g.ellipse(52, 0, 12, 4, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  } else if (P.tool === 'hammer') {
    g.save(); g.translate(af.hand[0], af.hand[1]); g.rotate(-af.fa + Math.PI / 2);
    g.strokeStyle = '#7a5434'; g.lineWidth = 7; g.beginPath(); g.moveTo(-10, 0); g.lineTo(62, 0); g.stroke();
    g.fillStyle = '#5c6067'; g.fillRect(56, -20, 26, 40); g.fillStyle = '#8a8f96'; g.fillRect(56, -20, 26, 6);
    g.restore();
  } else if (P.tool === 'grinder') {
    g.save(); g.translate(af.hand[0], af.hand[1]); g.rotate(-af.fa + Math.PI / 2);
    g.fillStyle = '#2b6cb0'; g.beginPath(); g.roundRect(-4, -8, 34, 16, 5); g.fill();
    g.save(); g.translate(36, 0); g.rotate(P.toolT * 40);
    g.fillStyle = '#9aa0a6'; g.beginPath(); g.arc(0, 0, 15, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#555'; g.lineWidth = 2; g.beginPath(); g.moveTo(-15, 0); g.lineTo(15, 0); g.stroke();
    g.restore(); g.restore();
  }
  g.restore();
  return { hand: af.hand, hipY };
}

/* ---------- Sélection du combattant (dans le salon) ---------- */
function renderCharPick(box, descEl, roster = FIGHTERS, key = 'char') {
  if (!save[key] || !roster[save[key]]) save[key] = 'fondeur';
  box.innerHTML = Object.entries(roster).map(([id, c]) => `<button data-char="${id}" style="--tone:${c.color === '#2E3238' ? '#9aa0a6' : c.color}" class="${id === save[key] ? 'on' : ''}"><canvas width="160" height="160"></canvas><b>${c.name}</b><small>${c.title}</small></button>`).join('');
  const paint = () => { const c = roster[save[key]]; descEl.innerHTML = `<b>${c.title}</b> · ${c.desc}`; };
  paint();
  const canv = [...box.querySelectorAll('canvas')];
  box.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    save[key] = b.dataset.char; persist();
    box.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    paint(); SFX.tick();
  }));
  const stop = loop((dt, t) => {
    if (!box.isConnected) return false;
    canv.forEach((cv, i) => {
      const g = cv.getContext('2d');
      g.clearRect(0, 0, 160, 160);
      const id = Object.keys(roster)[i];
      const on = id === save[key];
      drawFighter(g, { ch: id, st: on ? 'win' : 'idle', fc: 1, y: 0, p: 0 }, 76, 152, 0.62, t / 1000 + i);
    });
  });
  return stop;
}

/* ---------- Client de combat ---------- */
let fightClient = null;
function stopFighter() { if (fightClient) { fightClient.stop(); fightClient = null; } }

function updateFighter() {
  if (view.finished) {
    if (document.getElementById('rewardBox')) return;
    stopFighter();
    resultScreen(view.finished.map((i, k) => {
      const f = view.f[i];
      const c = FIGHTERS[f.ch];
      return `<li><b>${k + 1}</b><i style="background:${c.color}"></i><span>${esc(f.n)} · ${c.name}${i === mySeat ? ' (toi)' : ''}</span><em>${f.w} manche(s)</em></li>`;
    }));
    return;
  }
  if (!fightClient) fightClient = startFighterClient();
  fightClient.push(view);
}

function startFighterClient() {
  const W = 960, H = 540, GROUND = 478, K = W / 1000;
  stage.innerHTML = '';
  $('#hudInfo').textContent = 'Meilleur des 3 manches';
  const wrap = document.createElement('div');
  wrap.className = 'play-wrap';
  stage.appendChild(wrap);
  const pad = document.createElement('div');
  pad.className = 'touch-pad';
  pad.innerHTML = `<div class="grp"><button data-m="1">◀</button><button data-m="4">▲</button><button data-m="8">▼</button><button data-m="2">▶</button></div>
    <div class="grp"><button data-m="16" class="warm">POING</button><button data-m="32" class="hot">PIED</button><button data-m="64">SPÉ</button><button data-m="128" class="hot">ULTI</button></div>`;
  const { c, g } = makeCanvas(wrap, W, H);
  wrap.appendChild(pad);
  const hint = document.createElement('p');
  hint.className = 'keys-hint';
  hint.textContent = '← → BOUGER · ↑ SAUTER · ↓ ACCROUPI · J POING · K PIED · L SPÉCIAL · I ULTIME (JAUGE PLEINE) · RECULER = GARDE';
  wrap.appendChild(hint);
  const unGuide = comboGuideButton(wrap, 'fighter');

  // ---- décor de la halle de fonderie (pré-rendu) ----
  const bg = document.createElement('canvas');
  bg.width = W; bg.height = H;
  (function paintBg() {
    const b = bg.getContext('2d');
    const sky = b.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#120c0a'); sky.addColorStop(0.7, '#2a160d'); sky.addColorStop(1, '#3a1d0e');
    b.fillStyle = sky; b.fillRect(0, 0, W, H);
    // briques
    for (let y = 40; y < GROUND - 60; y += 22) for (let x = (y / 22 % 2) * 30 - 30; x < W; x += 60) {
      b.fillStyle = `rgba(${90 + Math.random() * 30},${40 + Math.random() * 15},${25},${0.25 + Math.random() * 0.15})`;
      b.fillRect(x, y, 56, 18);
    }
    // charpente métallique
    b.fillStyle = '#0b0b0c';
    b.fillRect(0, 0, W, 34);
    for (let x = 0; x < W; x += 160) { b.fillRect(x, 0, 14, GROUND); b.beginPath(); b.moveTo(x, 34); b.lineTo(x + 80, 90); b.lineTo(x + 160, 34); b.lineWidth = 6; b.strokeStyle = '#0b0b0c'; b.stroke(); }
    // four (gueule incandescente au centre)
    b.fillStyle = '#1a1412'; b.beginPath(); b.roundRect(W / 2 - 120, 120, 240, GROUND - 150, 20); b.fill();
    b.fillStyle = '#0d0a09'; b.fillRect(W / 2 - 40, 40, 80, 90);
    // public : étudiants en sweats de promo
    const tones = ['#EC641E', '#BA2C3A', '#8A8D91', '#2E3238'];
    for (let x = 10; x < W; x += 34) {
      if (Math.abs(x - W / 2) < 140) continue;
      const h = 70 + Math.random() * 30, y = GROUND - 70;
      b.fillStyle = tones[Math.floor(Math.random() * 4)];
      b.beginPath(); b.roundRect(x, y - h * 0.4, 28, h, 10); b.fill();
      b.fillStyle = '#0d0a09'; b.beginPath(); b.arc(x + 14, y - h * 0.4 - 12, 11, 0, Math.PI * 2); b.fill();
    }
    // garde-corps
    b.fillStyle = '#0b0b0c'; b.fillRect(0, GROUND - 74, W, 6);
    for (let x = 0; x < W; x += 50) b.fillRect(x, GROUND - 74, 4, 74);
    // sol en tôle
    const fl = b.createLinearGradient(0, GROUND, 0, H);
    fl.addColorStop(0, '#2b2522'); fl.addColorStop(1, '#141110');
    b.fillStyle = fl; b.fillRect(0, GROUND, W, H - GROUND);
    b.strokeStyle = 'rgba(255,255,255,.05)'; b.lineWidth = 1;
    for (let x = -W; x < W * 2; x += 80) { b.beginPath(); b.moveTo(W / 2 + (x - W / 2) * 0.6, GROUND); b.lineTo(x, H); b.stroke(); }
    b.fillStyle = '#EC641E'; b.fillRect(0, GROUND, W, 3);
  })();

  // ---- entrées ----
  let mask = 0, sent = -1, lastSend = 0;
  const KEYMAP = {
    ArrowLeft: 1, KeyA: 1, KeyQ: 1, ArrowRight: 2, KeyD: 2, ArrowUp: 4, KeyW: 4, KeyZ: 4, ArrowDown: 8, KeyS: 8,
    KeyJ: 16, Space: 16, KeyX: 16, KeyK: 32, KeyC: 32, KeyL: 64, KeyV: 64, KeyI: 128,
  };
  const pushInput = force => {
    const now = performance.now();
    if (force || mask !== sent || now - lastSend > 200) { send({ t: 'act', a: 'input', k: mask }); sent = mask; lastSend = now; }
  };
  const kd = e => { const b = KEYMAP[e.code]; if (b) { e.preventDefault(); if (!(mask & b)) { mask |= b; pushInput(); } } };
  const ku = e => { const b = KEYMAP[e.code]; if (b) { mask &= ~b; pushInput(); } };
  window.addEventListener('keydown', kd);
  window.addEventListener('keyup', ku);
  pad.querySelectorAll('[data-m]').forEach(btn => {
    const b = +btn.dataset.m;
    btn.addEventListener('pointerdown', e => { e.preventDefault(); mask |= b; btn.classList.add('on'); pushInput(); });
    const up = () => { mask &= ~b; btn.classList.remove('on'); pushInput(); };
    btn.addEventListener('pointerup', up); btn.addEventListener('pointerleave', up); btn.addEventListener('pointercancel', up);
  });

  // ---- état reçu + interpolation ----
  let prev = null, cur = null, curAt = 0, seenEv = 0, shake = 0, flash = [0, 0], banner = '', bannerAt = 0;
  // caméra : zoome sur les combattants quand ils sont proches
  let camX = 500, camK = K;
  const SX = x => W / 2 + (x - camX) * camK;
  const SY = y => GROUND - y * camK;
  const parts = [], trail = [100, 100], prevHp = [null, null];
  function push(v) {
    prev = cur || v; cur = v; curAt = performance.now();
    if (v.banner !== banner) { banner = v.banner; bannerAt = performance.now(); if (banner) sfx(banner.startsWith('K.O') ? 120 : 520, 0.3, 'square', 0.06, banner.startsWith('K.O') ? -60 : 200); }
    for (const e of v.ev) {
      if (e.id <= seenEv) continue;
      seenEv = e.id;
      const x = SX(e.x), y = SY(e.y);
      if (e.k === 'hit') {
        for (let i = 0; i < (e.big ? 26 : 14); i++) { const a = Math.random() * Math.PI * 2, s = 120 + Math.random() * 280; parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: 0.5, hue: 30 + Math.random() * 20, size: 3 }); }
        parts.push({ x, y, ring: 1, life: 0.25, big: e.big });
        shake = e.big ? 0.25 : 0.1;
        sfx(e.big ? 110 : 170, e.big ? 0.16 : 0.09, 'square', 0.08, -60);
      } else if (e.k === 'block') {
        for (let i = 0; i < 10; i++) { const a = Math.random() * Math.PI * 2, s = 80 + Math.random() * 160; parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.3, hue: 200, size: 2 }); }
        sfx(1200, 0.05, 'triangle', 0.05);
      } else if (e.k === 'cast') {
        sfx(260, 0.25, 'sawtooth', 0.04, 260);
      } else if (e.k === 'clash') {
        for (let i = 0; i < 30; i++) { const a = Math.random() * Math.PI * 2, s = 100 + Math.random() * 300; parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6, hue: 25, size: 3 }); }
        shake = 0.2; sfx(90, 0.3, 'sawtooth', 0.06);
      } else if (e.k === 'ko') {
        shake = 0.5; sfx(60, 0.6, 'sawtooth', 0.08, -20);
      } else if (e.k === 'ult') {
        ultCutIn(wrap, e.ch, e.seat === mySeat);
      } else if (e.k === 'ulthit') {
        ultScene(wrap, e.ch, e.foe, e.dmg, e.seat === mySeat);
      } else if (e.k === 'ultmiss') {
        ultMiss(wrap);
      } else if (e.k === 'combo') {
        const f = v.f[e.seat];
        comboFx(wrap, e.name, e.n, (FIGHTERS[f.ch] || FIGHTERS.fondeur).color, e.seat === mySeat);
        shake = 0.45;
      }
    }
    v.f.forEach((f, i) => {
      if (prevHp[i] !== null && f.hp < prevHp[i]) flash[i] = 0.12;
      prevHp[i] = f.hp;
      // sable et étincelles de meuleuse
      if (f.st === 'attack' && f.mv === 'sable' && f.ph === 1) for (let j = 0; j < 8; j++) parts.push({ x: SX(f.x + f.fc * (40 + Math.random() * 140)), y: SY(40 + Math.random() * 140), vx: f.fc * (200 + Math.random() * 200), vy: -40 + Math.random() * 80, life: 0.5, sand: true, size: 4 + Math.random() * 4 });
      if (f.st === 'attack' && f.mv === 'meuleuse' && f.ph < 2) for (let j = 0; j < 5; j++) parts.push({ x: SX(f.x + f.fc * 95), y: SY(120), vx: -f.fc * (100 + Math.random() * 250), vy: -100 - Math.random() * 200, life: 0.4, hue: 40, size: 2 });
    });
  }

  // ---- rendu ----
  const embers = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 20 + Math.random() * 50, s: 1 + Math.random() * 2 }));
  const stop = loop((dt, tms) => {
    if (!cur) return;
    const t = tms / 1000;
    const a = Math.min(1, (performance.now() - curAt) / 34);
    {
      const x0 = lerp(prev.f[0].x, cur.f[0].x, a), x1 = lerp(prev.f[1].x, cur.f[1].x, a);
      const viewW = Math.max(600, Math.min(1000, Math.abs(x1 - x0) + 440));
      const tx = Math.max(viewW / 2, Math.min(1000 - viewW / 2, (x0 + x1) / 2));
      const k = Math.min(1, dt * 5);
      camK += (W / viewW - camK) * k;
      camX += (tx - camX) * k;
    }
    g.save();
    if (shake > 0) { shake -= dt; g.translate((Math.random() - 0.5) * 14 * shake * 4, (Math.random() - 0.5) * 10 * shake * 4); }
    g.drawImage(bg, 0, 0, W, H);
    // lueur vivante du four
    const fl = 0.75 + Math.sin(t * 7) * 0.08 + Math.random() * 0.06;
    const glow = g.createRadialGradient(W / 2, 230, 10, W / 2, 230, 200);
    glow.addColorStop(0, `rgba(255,190,90,${fl})`); glow.addColorStop(0.35, `rgba(236,100,30,${fl * 0.6})`); glow.addColorStop(1, 'rgba(236,100,30,0)');
    g.fillStyle = glow; g.fillRect(W / 2 - 220, 30, 440, 420);
    g.fillStyle = `rgba(255,${180 + Math.random() * 40},90,${fl})`; g.beginPath(); g.roundRect(W / 2 - 70, 190, 140, 90, 40); g.fill();
    g.font = `900 22px ${DISPLAY}`; g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,.12)'; g.fillText('ESFF · PROMO 101', W / 2, 330);
    for (const e of embers) { e.y -= e.v * dt; if (e.y < 0) { e.y = H; e.x = Math.random() * W; } g.fillStyle = `rgba(255,150,60,${0.3 + e.y / H * 0.5})`; g.fillRect(e.x, e.y, e.s, e.s); }

    // projectiles de fonte
    for (const p of cur.proj) {
      const x = SX(p[0]), y = SY(p[1]);
      const pg = g.createRadialGradient(x, y, 2, x, y, 26);
      pg.addColorStop(0, '#fff6c8'); pg.addColorStop(0.4, '#ffb347'); pg.addColorStop(1, 'rgba(236,100,30,0)');
      g.fillStyle = pg; g.beginPath(); g.arc(x, y, 26, 0, Math.PI * 2); g.fill();
      if (Math.random() < 0.7) parts.push({ x, y, vx: -Math.sign(p[0] - 500) * 40, vy: 60 + Math.random() * 80, life: 0.35, hue: 25, size: 3 });
    }
    // combattants (le plus récent devant)
    cur.f.forEach((f, i) => {
      const pf = prev.f[i] || f;
      const x = lerp(pf.x, f.x, a), y = lerp(pf.y, f.y, a);
      const df = { ...f, y };
      flash[i] = Math.max(0, flash[i] - dt);
      drawFighter(g, df, SX(x), GROUND, camK, t, { flash: flash[i] > 0.06 });
      if (i === mySeat && cur.phase !== 'over') {
        g.fillStyle = '#7fd4ff'; g.font = `400 10px ${'"Press Start 2P", monospace'}`; g.textAlign = 'center';
        g.fillText('TOI', SX(x), SY(y + 230));
        g.beginPath(); g.moveTo(SX(x) - 6, SY(y + 222)); g.lineTo(SX(x) + 6, SY(y + 222)); g.lineTo(SX(x), SY(y + 212)); g.fill();
      }
    });
    // particules
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      if (p.ring) {
        g.strokeStyle = `rgba(255,240,200,${p.life * 4})`; g.lineWidth = 4;
        g.beginPath(); g.arc(p.x, p.y, (0.25 - p.life) * (p.big ? 260 : 160) + 8, 0, Math.PI * 2); g.stroke();
        continue;
      }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.sand ? 60 : 500) * dt;
      g.fillStyle = p.sand ? `rgba(196,160,110,${p.life * 1.6})` : `hsla(${p.hue},100%,${60 + p.life * 40}%,${Math.min(1, p.life * 3)})`;
      g.fillRect(p.x, p.y, p.size, p.size);
    }
    g.restore();

    // ---- HUD ----
    const bw = 380, by = 22;
    cur.f.forEach((f, i) => {
      const left = i === 0;
      const x0 = left ? W / 2 - 52 - bw : W / 2 + 52;
      const ratio = Math.max(0, f.hp / f.max);
      trail[i] = Math.max(ratio * 100, trail[i] - dt * 40);
      g.fillStyle = '#000'; g.fillRect(x0 - 3, by - 3, bw + 6, 26);
      g.fillStyle = '#3a0d0d'; g.fillRect(x0, by, bw, 20);
      const tw = bw * trail[i] / 100, hw = bw * ratio;
      g.fillStyle = '#fff'; g.fillRect(left ? x0 + bw - tw : x0, by, tw, 20);
      const hg = g.createLinearGradient(0, by, 0, by + 20);
      hg.addColorStop(0, ratio > 0.3 ? '#ffe07a' : '#ff8a8a'); hg.addColorStop(1, ratio > 0.3 ? '#EC641E' : '#BA2C3A');
      g.fillStyle = hg; g.fillRect(left ? x0 + bw - hw : x0, by, hw, 20);
      const C = FIGHTERS[f.ch];
      g.font = `900 22px ${DISPLAY}`; g.textAlign = left ? 'left' : 'right'; g.fillStyle = '#fff';
      g.fillText(`${f.n.toUpperCase()}`, left ? x0 : x0 + bw, by + 46);
      g.font = `600 13px Archivo, sans-serif`; g.fillStyle = C.color === '#2E3238' ? '#c6cad0' : C.color;
      g.fillText(`${C.name} · ${C.title}`, left ? x0 : x0 + bw, by + 64);
      // manches gagnées
      for (let r = 0; r < cur.toWin; r++) {
        const px = left ? x0 + bw - 14 - r * 22 : x0 + 4 + r * 22;
        g.fillStyle = r < f.w ? '#F5B700' : 'rgba(255,255,255,.15)';
        g.beginPath(); g.moveTo(px + 3, by + 30); g.lineTo(px + 15, by + 30); g.lineTo(px + 18, by + 40); g.lineTo(px, by + 40); g.fill();
      }
      // jauge de chaleur
      const mx = left ? 30 : W - 30 - 220, my = H - 34;
      g.fillStyle = '#000'; g.fillRect(mx - 2, my - 2, 224, 16);
      const mg = g.createLinearGradient(mx, 0, mx + 220, 0); mg.addColorStop(0, '#BA2C3A'); mg.addColorStop(1, '#ffd25a');
      g.fillStyle = mg; g.fillRect(left ? mx : mx + 220 - 2.2 * f.m, my, 2.2 * f.m, 12);
      g.fillStyle = 'rgba(0,0,0,.6)'; [35, 70].forEach(v => g.fillRect(left ? mx + 2.2 * v : mx + 220 - 2.2 * v, my, 2, 12));
      g.font = `400 8px "Press Start 2P", monospace`; g.fillStyle = f.m >= 35 ? '#F5B700' : '#9aa0a6'; g.textAlign = left ? 'left' : 'right';
      const full = f.m >= 100;
      g.fillStyle = full ? (Math.sin(performance.now() / 90) > 0 ? '#fff3c0' : '#F5B700') : f.m >= 35 ? '#F5B700' : '#9aa0a6';
      g.fillText(full ? `ÉNERGIE PLEINE · ULTIME ${i === mySeat ? '(I)' : ''}` : f.m >= 35 ? 'ÉNERGIE · SPÉCIAL PRÊT' : 'ÉNERGIE', left ? mx : mx + 220, my - 6);
      if (full) { g.strokeStyle = `rgba(255,224,122,${0.5 + Math.sin(performance.now() / 90) * 0.4})`; g.lineWidth = 3; g.strokeRect(mx - 3, my - 3, 226, 18); }
      if (f.cb >= 2) { g.font = `900 ${30 + f.cb * 2}px ${DISPLAY}`; g.fillStyle = '#F5B700'; g.fillText(`${f.cb} COUPS !`, left ? 30 : W - 30, 150); }
    });
    g.fillStyle = '#000'; g.fillRect(W / 2 - 40, 12, 80, 50);
    g.strokeStyle = '#EC641E'; g.lineWidth = 2; g.strokeRect(W / 2 - 40, 12, 80, 50);
    g.font = `400 22px "Press Start 2P", monospace`; g.textAlign = 'center'; g.fillStyle = cur.timer <= 10 ? '#ff6b6b' : '#fff';
    g.fillText(String(cur.timer).padStart(2, '0'), W / 2, 50);
    if (banner) {
      const age = (performance.now() - bannerAt) / 1000;
      const sc = Math.min(1, age * 6);
      g.save(); g.translate(W / 2, H / 2 - 30); g.scale(sc, sc);
      g.font = `900 92px ${DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 10; g.strokeStyle = '#000'; g.strokeText(banner, 0, 0);
      const bgr = g.createLinearGradient(0, -40, 0, 40); bgr.addColorStop(0, '#fff3c0'); bgr.addColorStop(0.5, '#F5B700'); bgr.addColorStop(1, '#EC641E');
      g.fillStyle = bgr; g.fillText(banner, 0, 0);
      g.restore();
    }
    pushInput(false);
  });

  return {
    push,
    stop() {
      stop();
      unGuide();
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    },
  };
}
