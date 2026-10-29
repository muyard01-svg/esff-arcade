/* Combattants dessinés en 2D : choix du personnage, guide des combos et aperçus de Poing de Fonte 3D */
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
