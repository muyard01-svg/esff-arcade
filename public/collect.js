/* Collection : les Secrets de l'École (tickets à gratter) et les Boosters ESFF (102 cartes d'entreprises).
   Les tirages sont faits par le serveur. Les illustrations sont dessinées ici, sans logo d'entreprise.
   Les arts « alternative » et « légendaire » sont dans HERO : c'est là qu'il faudra les retravailler. */
'use strict';

const RARITY = {
  commun: { name: 'Commune', mark: '●', color: '#b9bdc4' }, rare: { name: 'Rare', mark: '◆', color: '#5AA8FF' },
  super: { name: 'Super rare', mark: '★', color: '#C77DFF' }, alternative: { name: 'Alternative', mark: '✦', color: '#7FD48A' },
  legendaire: { name: 'Légendaire', mark: '♛', color: '#F5B700' }, secrete: { name: 'Secrète', mark: '✹', color: '#ff5ad0' },
};
const RAR_ORDER = ['commun', 'rare', 'super', 'alternative', 'legendaire', 'secrete'];
const KIND_LABEL = { fonderie: 'Fonderie', forge: 'Forge', art: 'Fonderie d’art', cloche: 'Fonderie de cloches', fournisseur: 'Fournisseur', ecole: 'École' };
const CARD_ATK = {
  fonderie: ['Coulée en source', 'Jet de métal', 'Remplissage express', 'Grappe infernale'], forge: ['Coup de pilon', 'Estampage', 'Matriçage', 'Frappe à chaud'],
  art: ['Cire perdue', 'Patine sacrée', 'Chef-d’œuvre'], cloche: ['Volée de bronze', 'Tocsin'], fournisseur: ['Livraison express', 'Réglage fin', 'Liant mystère'], ecole: ['Promo légendaire'],
};
const METAL_PAL = {
  Fonte: ['#1c1210', '#6a2a12', '#ff7a2a', '#ffd27a'], Acier: ['#0f1620', '#27425e', '#7fb4e8', '#e6f2ff'], Aluminium: ['#141a20', '#46586a', '#c9d6e2', '#ffffff'],
  Cuivreux: ['#1a120a', '#6a4016', '#d9963a', '#ffe0a0'], Zinc: ['#14181a', '#3c5258', '#9cc4c8', '#eefcff'], Titane: ['#16121e', '#463a66', '#b49ae6', '#f0e8ff'], Magnésium: ['#10181a', '#2c5a50', '#8ae0c0', '#eafff6'], Autres: ['#181418', '#4a3a4a', '#c8a8c8', '#fff0ff'],
};
const seeded = n => { let s = (n * 2654435761) >>> 0; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };

/* ---------- sujets dessinés (centre 0,0 ; environ 200 unités de haut) ---------- */
function brass(g, y0, y1, a, b, c) { const gr = g.createLinearGradient(-90, y0, 90, y1); gr.addColorStop(0, a); gr.addColorStop(0.5, b); gr.addColorStop(1, c); return gr; }
const SUBJECT = {
  fonderie(g, p) {
    g.save(); g.translate(-30, -62); g.rotate(0.55);
    g.fillStyle = brass(g, -40, 40, '#2b2e33', '#6a6f77', '#1a1c20'); g.beginPath(); g.moveTo(-46, -36); g.lineTo(46, -36); g.lineTo(32, 42); g.lineTo(-32, 42); g.fill();
    g.fillStyle = p[3]; g.fillRect(-42, -38, 84, 8); g.fillStyle = '#3a3d42'; g.fillRect(-110, -8, 66, 8); g.restore();
    const s = g.createLinearGradient(0, -40, 0, 70); s.addColorStop(0, '#fff'); s.addColorStop(1, p[2]);
    g.fillStyle = s; g.beginPath(); g.moveTo(14, -48); g.quadraticCurveTo(24, -10, 12, 62); g.lineTo(26, 62); g.quadraticCurveTo(36, -14, 22, -50); g.fill();
    g.fillStyle = '#7a5a3a'; g.fillRect(-70, 62, 170, 46); g.fillStyle = '#5a4028'; g.fillRect(-70, 84, 170, 4); g.fillStyle = p[2]; g.fillRect(8, 58, 22, 6);
  },
  forge(g, p) {
    g.fillStyle = brass(g, 0, 90, '#1a1c20', '#5c6067', '#26292d');
    g.beginPath(); g.moveTo(-90, 10); g.lineTo(80, 10); g.quadraticCurveTo(90, 26, 40, 34); g.lineTo(32, 66); g.lineTo(60, 96); g.lineTo(-50, 96); g.lineTo(-24, 66); g.lineTo(-30, 34); g.quadraticCurveTo(-70, 30, -90, 10); g.fill();
    g.fillStyle = p[2]; g.fillRect(-46, 0, 84, 10); g.fillStyle = p[3]; g.fillRect(-30, 2, 40, 4);
    g.save(); g.translate(26, -46); g.rotate(-0.5); g.fillStyle = '#7a5434'; g.fillRect(-6, -8, 12, 100 - 30); g.fillStyle = brass(g, -40, 0, '#8a8d91', '#d8dde3', '#3a3d42'); g.fillRect(-34, -38, 68, 34); g.restore();
  },
  art(g, p) { SUBJECT.statue(g, p); },
  statue(g, p) {
    g.fillStyle = brass(g, -100, 100, p[1], p[2], p[0]);
    g.beginPath(); g.arc(0, -78, 18, 0, 7); g.fill();
    g.beginPath(); g.moveTo(-26, -56); g.quadraticCurveTo(0, -66, 26, -56); g.lineTo(62, -104); g.lineTo(74, -96); g.lineTo(32, -28); g.lineTo(24, 26); g.lineTo(32, 86); g.lineTo(12, 86); g.lineTo(0, 34); g.lineTo(-12, 86); g.lineTo(-32, 86); g.lineTo(-24, 26); g.lineTo(-30, -28); g.lineTo(-72, -86); g.lineTo(-60, -96); g.fill();
    g.fillStyle = '#2b2e33'; g.fillRect(-58, 86, 116, 16); g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(-20, -48, 7, 60);
  },
  cloche(g, p) {
    g.fillStyle = brass(g, -100, 100, p[1], p[3], p[1]);
    g.beginPath(); g.moveTo(-14, -96); g.quadraticCurveTo(-52, -84, -56, -24); g.quadraticCurveTo(-60, 44, -94, 72); g.lineTo(94, 72); g.quadraticCurveTo(60, 44, 56, -24); g.quadraticCurveTo(52, -84, 14, -96); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 3; g.beginPath(); g.moveTo(-60, 12); g.quadraticCurveTo(0, 26, 60, 12); g.moveTo(-74, 46); g.quadraticCurveTo(0, 62, 74, 46); g.stroke();
    g.fillStyle = p[1]; g.beginPath(); g.arc(0, 86, 15, 0, 7); g.fill(); g.fillRect(-9, -112, 18, 18);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(-30, -66); g.quadraticCurveTo(-42, -10, -56, 40); g.lineTo(-40, 40); g.quadraticCurveTo(-28, -10, -22, -70); g.fill();
  },
  fournisseur(g, p) {
    g.fillStyle = brass(g, -90, 90, '#26292d', '#6a6f77', '#1a1c20'); g.fillRect(-82, -70, 164, 170);
    g.fillStyle = p[1]; g.fillRect(-82, -86, 164, 18); g.fillStyle = '#111'; g.fillRect(-46, -36, 92, 74);
    const f = g.createRadialGradient(0, 8, 4, 0, 8, 60); f.addColorStop(0, '#fff'); f.addColorStop(0.4, p[3]); f.addColorStop(1, p[2]); g.fillStyle = f; g.fillRect(-40, -30, 80, 62);
    g.fillStyle = '#F5B700'; for (let i = 0; i < 7; i++) g.fillRect(-80 + i * 24, 78, 12, 8);
  },
  ecole(g, p) {
    const f = g.createRadialGradient(0, -30, 6, 0, -30, 90); f.addColorStop(0, '#fff'); f.addColorStop(0.4, p[3]); f.addColorStop(1, 'rgba(255,90,20,0)'); g.fillStyle = f; g.beginPath(); g.arc(0, -30, 90, 0, 7); g.fill();
    g.fillStyle = brass(g, 0, 90, '#3a3d42', '#9aa0a6', '#1a1c20'); g.beginPath(); g.moveTo(-62, 0); g.lineTo(62, 0); g.lineTo(42, 92); g.lineTo(-42, 92); g.fill();
    g.fillStyle = p[3]; g.beginPath(); g.ellipse(0, 0, 62, 12, 0, 0, 7); g.fill();
  },
  disa(g, p) {
    g.fillStyle = brass(g, -90, 90, '#163a26', '#2f8a58', '#102a1c'); g.fillRect(-120, -84, 112, 170); g.fillStyle = '#F5B700'; g.fillRect(-126, -96, 124, 16);
    g.fillStyle = '#d8dde3'; g.fillRect(-120, -34, -40, 8); g.fillRect(-120, 16, -40, 8); g.fillStyle = '#163a26'; g.fillRect(-168, -44, 30, 78);
    for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? '#a07c54' : '#b08a5a'; g.fillRect(-8 + i * 42, 6, 40, 68); g.fillStyle = '#1a120c'; g.beginPath(); g.arc(12 + i * 42, 6, 6, 0, 7); g.fill(); }
    g.fillStyle = '#26292d'; g.fillRect(-8, 74, 220, 14); g.fillStyle = '#ff5a1a'; g.fillRect(-90, -60, 10, 10);
  },
  piece(g, p) {
    g.fillStyle = brass(g, -100, 100, '#8a5a10', '#ffe9a0', '#a8761a'); g.beginPath(); g.arc(0, 0, 100, 0, 7); g.fill();
    g.strokeStyle = 'rgba(90,50,0,.55)'; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 86, 0, 7); g.stroke();
    for (let i = 0; i < 60; i++) { const a = i / 60 * 6.283; g.lineWidth = 2; g.beginPath(); g.moveTo(Math.cos(a) * 92, Math.sin(a) * 92); g.lineTo(Math.cos(a) * 99, Math.sin(a) * 99); g.stroke(); }
    g.fillStyle = 'rgba(110,70,10,.8)'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -1.571 + i * 0.6283, r = i % 2 ? 26 : 62; g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } g.fill();
  },
  cocotte(g, p) {
    g.fillStyle = brass(g, -40, 80, '#7a1e08', '#ff7a2a', '#a82e0c'); g.beginPath(); g.moveTo(-96, -10); g.lineTo(96, -10); g.quadraticCurveTo(100, 84, 60, 88); g.lineTo(-60, 88); g.quadraticCurveTo(-100, 84, -96, -10); g.fill();
    g.fillRect(-120, 0, 26, 14); g.fillRect(94, 0, 26, 14);
    g.fillStyle = brass(g, -50, -10, '#ffb060', '#ff7a2a', '#7a1e08'); g.beginPath(); g.ellipse(0, -14, 102, 28, 0, 0, 7); g.fill();
    g.fillStyle = '#2b2e33'; g.beginPath(); g.arc(0, -46, 13, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(-74, 12, 12, 52);
    for (let i = 0; i < 3; i++) { g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 5; g.beginPath(); g.moveTo(-30 + i * 30, -70); g.quadraticCurveTo(-46 + i * 30, -90, -30 + i * 30, -110); g.stroke(); }
  },
  poele(g, p) {
    g.fillStyle = brass(g, -90, 90, '#1a1c20', '#4a4e54', '#121417'); g.fillRect(-70, -60, 140, 130); g.fillRect(-80, -72, 160, 14); g.fillRect(-16, -128, 32, 58); g.fillRect(-62, 70, 16, 26); g.fillRect(46, 70, 16, 26);
    g.fillStyle = '#111'; g.fillRect(-50, -40, 100, 76);
    const f = g.createRadialGradient(0, 16, 4, 0, 10, 56); f.addColorStop(0, '#fff'); f.addColorStop(0.35, '#ffd27a'); f.addColorStop(1, '#c8380c'); g.fillStyle = f; g.fillRect(-46, -36, 92, 68);
    g.strokeStyle = '#26292d'; g.lineWidth = 5; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(-50 + i * 25, -40); g.lineTo(-50 + i * 25, 36); g.stroke(); }
  },
  jante(g, p) {
    g.fillStyle = '#121417'; g.beginPath(); g.arc(0, 0, 104, 0, 7); g.fill();
    g.fillStyle = brass(g, -80, 80, '#6a7a8a', '#f2f6fa', '#6a7a8a'); g.beginPath(); g.arc(0, 0, 80, 0, 7); g.fill();
    g.fillStyle = '#1a1c20'; for (let i = 0; i < 5; i++) { const a = i * 1.2566 + 0.63; g.beginPath(); g.moveTo(Math.cos(a - 0.34) * 26, Math.sin(a - 0.34) * 26); g.lineTo(Math.cos(a - 0.42) * 72, Math.sin(a - 0.42) * 72); g.quadraticCurveTo(Math.cos(a) * 80, Math.sin(a) * 80, Math.cos(a + 0.42) * 72, Math.sin(a + 0.42) * 72); g.lineTo(Math.cos(a + 0.34) * 26, Math.sin(a + 0.34) * 26); g.fill(); }
    g.fillStyle = '#d8dde3'; g.beginPath(); g.arc(0, 0, 20, 0, 7); g.fill();
  },
};
// décor des cartes de prestige : à retravailler carte par carte
const HERO = {
  alternative(g, W, H, p, r) {
    const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, p[1]); bg.addColorStop(0.55, p[0]); bg.addColorStop(1, '#06050a'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) { g.strokeStyle = `rgba(255,255,255,${0.03 + r() * 0.07})`; g.lineWidth = 2 + r() * 12; g.beginPath(); const y = r() * H; g.moveTo(-10, y); g.bezierCurveTo(W * 0.3, y - 120 * r(), W * 0.7, y + 160 * r(), W + 10, y - 80); g.stroke(); }
    g.globalCompositeOperation = 'source-over';
  },
  legendaire(g, W, H, p, r) {
    const bg = g.createRadialGradient(W / 2, H * 0.42, 10, W / 2, H * 0.42, H * 0.8); bg.addColorStop(0, '#fff3c4'); bg.addColorStop(0.25, p[2]); bg.addColorStop(0.6, p[1]); bg.addColorStop(1, '#0a0604'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.save(); g.translate(W / 2, H * 0.42); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 28; i++) { g.rotate(6.283 / 28); g.fillStyle = `rgba(255,220,140,${0.04 + r() * 0.08})`; g.beginPath(); g.moveTo(0, 0); g.lineTo(H, -14 - r() * 30); g.lineTo(H, 14 + r() * 30); g.fill(); }
    g.restore();
  },
  secrete(g, W, H, p, r) {
    const bg = g.createLinearGradient(0, 0, W, H); ['#2a0a4a', '#a0145a', '#ff7a2a', '#ffd27a', '#27a0c8', '#14205a'].forEach((c, i) => bg.addColorStop(i / 5, c)); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.2})`; g.beginPath(); g.arc(r() * W, r() * H, 2 + r() * 30, 0, 7); g.fill(); } g.globalCompositeOperation = 'source-over';
  },
};

function paintCardArt(cv, c) {
  const full = ['alternative', 'legendaire', 'secrete'].includes(c.r);
  const W = cv.width = 360, H = cv.height = full ? 504 : 250, g = cv.getContext('2d');
  const p = METAL_PAL[c.metal] || METAL_PAL.Fonte, r = seeded(c.id + 7);
  if (full) HERO[c.r](g, W, H, p, r);
  else {
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, p[0]); bg.addColorStop(0.75, p[1]); bg.addColorStop(1, p[2]); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(0,0,0,.45)'; for (let x = 0; x < W;) { const w = 30 + r() * 60, h = 40 + r() * 90; g.fillRect(x, H - h, w, h); if (r() < 0.4) g.fillRect(x + w * 0.4, H - h - 50, 12, 50); x += w + r() * 12; }
  }
  g.save(); g.translate(W / 2, full ? H * 0.42 : H * 0.52); const s = full ? 1.32 : 0.92; g.scale(s, s);
  g.shadowColor = full ? 'rgba(255,200,120,.75)' : 'rgba(0,0,0,.6)'; g.shadowBlur = full ? 34 : 12;
  (SUBJECT[c.scene] || SUBJECT[c.kind] || SUBJECT.fonderie)(g, p); g.restore();
  for (let i = 0; i < (full ? 70 : 22); i++) { g.fillStyle = r() < 0.5 ? p[3] : p[2]; g.globalAlpha = 0.3 + r() * 0.7; const z = 1 + r() * 2.4; g.fillRect(r() * W, r() * H, z, z); } g.globalAlpha = 1;
}

/* ---------- une carte ---------- */
function cardHTML(c) {
  const R = RARITY[c.r], atk = (CARD_ATK[c.kind] || CARD_ATK.fonderie), name = atk[c.id % atk.length];
  return `<div class="cc r-${c.r}" data-card="${c.id}"><div class="cc-in"><canvas class="cc-art"></canvas>
    <div class="cc-top"><b>${esc(c.name)}</b><span>${c.pv} PV</span></div>
    <div class="cc-info"><small>${KIND_LABEL[c.kind]} · ${esc(c.metal)} · ${esc(c.city)}</small><p><b>${name}</b><i>${c.atk}</i></p></div>
    <div class="cc-foot"><span style="color:${R.color}">${R.mark} ${R.name}</span><span>${c.id}/102</span></div><div class="cc-foil"></div><div class="cc-glare"></div></div></div>`;
}
function mountCard(host, c) {
  host.innerHTML = cardHTML(c);
  paintCardArt($('canvas', host), c);
  const el = $('.cc', host);
  const mv = e => { const b = el.getBoundingClientRect(), x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height; el.style.setProperty('--mx', `${x * 100}%`); el.style.setProperty('--my', `${y * 100}%`); el.style.setProperty('--ry', `${(x - 0.5) * 26}deg`); el.style.setProperty('--rx', `${(0.5 - y) * 26}deg`); el.classList.add('tilt'); };
  el.addEventListener('pointermove', mv);
  el.addEventListener('pointerleave', () => { el.classList.remove('tilt'); el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
  return el;
}

/* ---------- animation immersive de la carte secrète : on entre dans la fonderie ---------- */
function immersive(c, done) {
  const box = document.createElement('div'); box.className = 'imm'; box.dataset.overlay = '1';
  box.innerHTML = '<canvas width="960" height="540"></canvas><small>Touche l’écran pour passer</small>';
  $('.modal-box').appendChild(box);
  const cv = $('canvas', box), g = cv.getContext('2d'), W = 960, H = 540;
  const art = document.createElement('canvas'); paintCardArt(art, c);
  const sparks = Array.from({ length: 160 }, () => ({ a: Math.random() * 6.283, z: Math.random(), s: 0.3 + Math.random() * 0.8 }));
  const ease = k => k * k * (3 - 2 * k), cl = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));
  [196, 247, 294, 392].forEach((f, i) => setTimeout(() => sfx(f, 1.4, 'sine', 0.035), i * 260));
  let t = 0, over = false;
  const finish = () => { if (over) return; over = true; stop(); box.remove(); if (done) done(); };
  box.addEventListener('click', finish);
  let boomed = false;
  const stop = loop(dt => {
    t += dt;
    const fly = ease(cl(t, 1.2, 5)), pour = ease(cl(t, 4.6, 6.6)), flood = ease(cl(t, 5.8, 7.2)), flash = cl(t, 7, 7.3) * (1 - cl(t, 7.3, 8));
    g.fillStyle = '#080506'; g.fillRect(0, 0, W, H);
    // la halle défile : piliers et poutres qui passent de chaque côté, avec du relief
    const ph = t * 0.55 + fly * 2;
    for (let i = 9; i >= 0; i--) {
      const z = 1 - ((i / 10 + ph) % 1), k = 1 / (z * z * 6 + 0.12), a = cl(1 - z, 0, 0.3);
      g.globalAlpha = a; g.fillStyle = `rgb(${18 + 40 * (1 - z)},${10 + 16 * (1 - z)},${10})`;
      const x = 170 * k, y = 120 * k;
      g.fillRect(W / 2 - x - 16 * k, H / 2 - y, 22 * k, y * 2); g.fillRect(W / 2 + x - 6 * k, H / 2 - y, 22 * k, y * 2); g.fillRect(W / 2 - x, H / 2 - y - 8 * k, x * 2, 12 * k);
    }
    g.globalAlpha = 1;
    const hg = g.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, 340); hg.addColorStop(0, `rgba(255,140,50,${0.25 + fly * 0.5})`); hg.addColorStop(1, 'rgba(255,90,20,0)'); g.fillStyle = hg; g.fillRect(0, 0, W, H);
    // étincelles qui filent vers la caméra
    g.fillStyle = '#ffd27a'; sparks.forEach(s => { s.z += s.s * dt * (0.4 + fly); if (s.z > 1) s.z = 0; const r = s.z * s.z * 620; const x = W / 2 + Math.cos(s.a) * r, y = H / 2 + Math.sin(s.a) * r * 0.7, z = 1 + s.z * 4; g.fillRect(x, y, z, z); });
    // la poche géante s'avance, bascule et verse
    const ls = 0.2 + fly * 0.95;
    g.save(); g.translate(W / 2 - 60 * ls, H * 0.34); g.scale(ls * 2.1, ls * 2.1); g.rotate(pour * 0.8);
    g.fillStyle = brass(g, -40, 40, '#2b2e33', '#7a7f87', '#1a1c20'); g.beginPath(); g.moveTo(-50, -38); g.lineTo(50, -38); g.lineTo(34, 44); g.lineTo(-34, 44); g.fill(); g.fillStyle = '#ffd27a'; g.fillRect(-46, -41, 92, 8); g.restore();
    if (pour > 0) { const sg = g.createLinearGradient(W / 2 - 30, 0, W / 2 + 90, 0); sg.addColorStop(0, '#ff6a1a'); sg.addColorStop(0.5, '#fff6c8'); sg.addColorStop(1, '#ff6a1a'); g.fillStyle = sg; const w = 60 * pour; g.fillRect(W / 2 + 40 - w / 2 + Math.sin(t * 40) * 3, H * 0.28, w, H); }
    if (flood > 0) { const fy = H * (1 - flood * 1.1); const fg = g.createLinearGradient(0, fy, 0, H); fg.addColorStop(0, '#fff6c8'); fg.addColorStop(0.1, '#ffb347'); fg.addColorStop(1, '#c8380c'); g.fillStyle = fg; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 20) g.lineTo(x, fy + Math.sin(x * 0.02 + t * 7) * 14); g.lineTo(W, H); g.fill(); }
    if (t > 7.1 && !boomed) { boomed = true; sfx(70, 0.9, 'sawtooth', 0.08, -20); [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => sfx(f, 0.5, 'triangle', 0.05), i * 110)); }
    // le médaillon de la promo sort du métal
    const med = ease(cl(t, 7.2, 8.2)) * (1 - ease(cl(t, 9.6, 10.3)));
    if (med > 0) {
      g.save(); g.translate(W / 2, H / 2); g.globalAlpha = med;
      for (let i = 0; i < 24; i++) { g.rotate(0.2618 + (i ? 0 : t * 0.25)); g.fillStyle = 'rgba(255,220,150,.13)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(700, -30); g.lineTo(700, 30); g.fill(); }
      g.restore(); g.save(); g.translate(W / 2, H / 2); g.globalAlpha = med; g.scale(0.7 + med * 0.5, 0.7 + med * 0.5); SUBJECT.piece(g, METAL_PAL.Fonte);
      g.fillStyle = '#3a1e06'; g.textAlign = 'center'; g.font = '900 54px "Big Shoulders Display", Impact'; g.fillText('ESFF', 0, 4); g.font = '900 34px "Big Shoulders Display", Impact'; g.fillText('102', 0, 40); g.restore();
      g.globalAlpha = 1;
    }
    if (flash > 0) { g.fillStyle = `rgba(255,255,255,${flash})`; g.fillRect(0, 0, W, H); }
    // la carte au début et à la fin
    const open = 1 - ease(cl(t, 0.5, 1.5)), back = ease(cl(t, 10, 11));
    const a = Math.max(open, back);
    if (a > 0) { const s = 0.62 + (1 - a) * 3.2, ch = H * s, cw = ch * 5 / 7; g.globalAlpha = Math.min(1, a * 1.6); g.drawImage(art, W / 2 - cw / 2, H / 2 - ch / 2, cw, ch); g.globalAlpha = 1; }
    if (t > 11.2) { finish(); return false; }
  });
}

/* ---------- jeu 1 : tickets secrets ---------- */
const COVER_FAIL = ['Rien ici. Captain Obvious confirme : un ticket vide est vide.', 'Pas de secret. C’est sans doute parce qu’il n’y en a pas.', 'Perdu. Évidemment, sinon tu aurais gagné.', 'Ce ticket ne contient rien, à part ce message.'];
function runSecrets(stage) {
  let left = 0, owned = [], total = 50, busy = false;
  const render = () => {
    stage.innerHTML = `<div class="cl-wrap">
      <div class="sc-ticket idle" id="scT"><div class="sc-res" id="scRes"><b>TOP SECRET</b><p>Appuie sur « Gratter un ticket ».</p></div><canvas id="scC"></canvas></div>
      <p class="cl-hint" id="scHint">Il te reste <b>${left}</b> ticket${left > 1 ? 's' : ''} aujourd’hui. Chaque ticket gagné dans un jeu en ajoute un.</p>
      <div class="end-actions"><button class="btn btn-hot" id="scGo" ${left ? '' : 'disabled'}>Gratter un ticket</button></div>
      <h4 class="cl-h">Carnet de Captain Obvious · ${owned.length}/${total}</h4>
      <ol class="sc-book">${owned.map(s => `<li>${esc(s.text)}</li>`).join('') || '<li class="muted">Aucun secret percé pour l’instant.</li>'}</ol></div>`;
    $('#scGo', stage).addEventListener('click', draw);
  };
  const draw = async () => {
    if (busy) return; busy = true;
    $('#scGo', stage).disabled = true;
    let r; try { r = await apiCall('/api/secret/draw', {}, true); } catch (e) { toast(e.message); busy = false; return; }
    const tk = $('#scT', stage), cv = $('#scC', stage), res = $('#scRes', stage);
    const W = cv.clientWidth, H = cv.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr; const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // la couche à gratter d'abord, le contenu ensuite : on ne peut rien voir avant
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#c9ccd1'); gr.addColorStop(0.5, '#8a8d91'); gr.addColorStop(1, '#5c6067'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 2400; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.14})`; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
    g.fillStyle = '#1a1612'; g.textAlign = 'center'; g.font = '900 34px "Big Shoulders Display", Impact'; g.fillText('CAPTAIN OBVIOUS', W / 2, H / 2 - 8); g.font = '700 13px Archivo, sans-serif'; g.fillText('Gratte : un secret se cache peut-être ici. Ou pas.', W / 2, H / 2 + 18);
    tk.classList.remove('idle', 'done'); tk.classList.add('live');
    g.globalCompositeOperation = 'destination-out';
    res.innerHTML = r.win ? `<span>SECRET N° ${r.secret.id + 1}</span><p>${esc(r.secret.text)}</p>` : `<span>${r.done ? 'CARNET COMPLET' : 'RAS'}</span><p>${esc(r.done ? 'Tu connais déjà les 50 secrets. Évidemment.' : COVER_FAIL[Math.floor(Math.random() * COVER_FAIL.length)])}</p>`;
    $('#scHint', stage).textContent = 'Gratte avec ta souris ou ton doigt.';
    let down = false, last = null, n = 0, over = false;
    const pt = e => { const b = cv.getBoundingClientRect(); return { x: (e.clientX - b.left) / b.width * W, y: (e.clientY - b.top) / b.height * H }; };
    const finish = () => {
      if (over) return; over = true; tk.classList.remove('live'); tk.classList.add('done'); cv.style.opacity = '0';
      if (r.win) { owned.push(r.secret); SFX.win(); } else SFX.bad();
      left = r.left; busy = false;
      setTimeout(() => { if (stage.isConnected && $('#scT', stage) === tk) { const keep = res.innerHTML; render(); $('#scRes', stage).innerHTML = keep; $('#scC', stage).style.opacity = '0'; $('#scT', stage).classList.replace('idle', 'done'); } }, 1400);
    };
    const scrape = p => {
      g.lineWidth = 40; g.lineCap = 'round'; g.beginPath(); g.moveTo((last || p).x, (last || p).y); g.lineTo(p.x, p.y); g.stroke(); last = p;
      if (++n % 8 === 0) { SFX.tick(); check(); }
    };
    const check = () => { const d = g.getImageData(0, 0, cv.width, cv.height).data; let c = 0, s = 0; for (let i = 3; i < d.length; i += 160) { s++; if (d[i] < 40) c++; } if (c / s > 0.55) finish(); };
    cv.onpointerdown = e => { e.preventDefault(); down = true; last = null; cv.setPointerCapture(e.pointerId); scrape(pt(e)); };
    cv.onpointermove = e => { if (down) scrape(pt(e)); };
    cv.onpointerup = cv.onpointercancel = () => { down = false; last = null; check(); };
  };
  stage.innerHTML = '<div class="screen"><p>Ouverture du coffre…</p></div>';
  apiCall('/api/secrets', {}, true).then(r => { left = r.left; owned = r.owned; total = r.total; render(); }).catch(e => toast(e.message));
}

/* ---------- jeu 2 : boosters ---------- */
function runBoosters(stage) {
  let set = [], owned = {}, left = 0, byId = {};
  const countOwned = () => Object.keys(owned).length;
  const home = () => {
    stage.innerHTML = `<div class="cl-wrap"><div class="pk" id="pk"><i class="pk-tear"></i><b>ESFF</b><span>Collection 102</span><small>5 cartes</small></div>
      <p class="cl-hint"><b>${countOwned()}/102</b> cartes · ${left} booster${left > 1 ? 's' : ''} à ouvrir aujourd’hui (chaque ticket gagné dans un jeu en ajoute un).</p>
      <div class="end-actions"><button class="btn btn-hot" id="pkGo" ${left ? '' : 'disabled'}>Ouvrir un booster</button><button class="btn btn-ghost" id="pkBook">Mon classeur</button></div></div>`;
    $('#pkGo', stage).addEventListener('click', open);
    $('#pkBook', stage).addEventListener('click', () => binder());
  };
  const open = async () => {
    $('#pkGo', stage).disabled = true;
    let r; try { r = await apiCall('/api/booster', {}, true); } catch (e) { toast(e.message); return; }
    owned = r.owned; left = r.left;
    const pk = $('#pk', stage);
    $('.cl-hint', stage).textContent = 'Déchire le booster : clique dessus.';
    $('.end-actions', stage).remove();
    pk.classList.add('ready');
    pk.addEventListener('click', () => {
      pk.classList.add('torn'); sfx(1800, 0.25, 'sawtooth', 0.03, -1400);
      setTimeout(() => reveal(r), 650);
    }, { once: true });
  };
  const reveal = r => {
    const pack = r.cards.map((id, i) => ({ c: byId[id], isNew: r.isNew[i] })).sort((a, b) => RAR_ORDER.indexOf(a.c.r) - RAR_ORDER.indexOf(b.c.r));
    let k = 0;
    const show = () => {
      if (k >= pack.length) return summary(pack);
      const { c, isNew } = pack[k];
      stage.innerHTML = `<div class="cl-wrap"><div class="fl" id="fl"><div class="fl-in"><div class="fl-back"><b>ESFF</b><span>102</span></div><div class="fl-front"></div></div></div><p class="cl-hint">Carte ${k + 1}/${pack.length} : clique pour la retourner</p></div>`;
      const fl = $('#fl', stage); mountCard($('.fl-front', fl), c);
      let flipped = false;
      fl.addEventListener('click', () => {
        if (!flipped) {
          flipped = true; fl.classList.add('flip', `fx-${c.r}`);
          const i = RAR_ORDER.indexOf(c.r);
          if (i >= 3) [523, 659, 784, 1047].forEach((f, n) => setTimeout(() => sfx(f, 0.3, 'triangle', 0.05), n * 90)); else sfx(420 + i * 160, 0.12, 'triangle', 0.04);
          $('.cl-hint', stage).innerHTML = `${isNew ? '<b class="new">NOUVELLE !</b> ' : ''}${RARITY[c.r].name} · clique pour continuer`;
          if (c.r === 'secrete') setTimeout(() => immersive(c), 900);
        } else { k++; show(); }
      });
    };
    show();
  };
  const summary = pack => {
    stage.innerHTML = `<div class="cl-wrap"><h4 class="cl-h">Ton booster · ${countOwned()}/102</h4><div class="cl-grid" id="sm"></div><div class="end-actions"><button class="btn btn-hot" id="smAg" ${left ? '' : 'disabled'}>Encore un (${left})</button><button class="btn btn-ghost" id="smBk">Mon classeur</button></div></div>`;
    pack.forEach(({ c, isNew }) => { const d = document.createElement('div'); d.className = 'cl-slot'; $('#sm', stage).appendChild(d); mountCard(d, c); if (isNew) d.insertAdjacentHTML('beforeend', '<em>NEW</em>'); d.addEventListener('click', () => zoom(c)); });
    $('#smAg', stage).addEventListener('click', home);
    $('#smBk', stage).addEventListener('click', () => binder());
  };
  const zoom = c => {
    const box = document.createElement('div'); box.className = 'cl-zoom'; box.dataset.overlay = '1';
    box.innerHTML = `<div class="cl-z"></div><div class="end-actions">${c.r === 'secrete' ? '<button class="btn btn-hot" id="zImm">Entrer dans la carte</button>' : ''}<button class="btn btn-ghost" id="zOut">Fermer</button></div><small>Exemplaires : ${owned[c.id] || 0}. PV et attaque sont fictifs.</small>`;
    $('.modal-box').appendChild(box); mountCard($('.cl-z', box), c);
    $('#zOut', box).addEventListener('click', () => box.remove());
    const b = $('#zImm', box); if (b) b.addEventListener('click', () => { box.remove(); immersive(c, () => zoom(c)); });
  };
  const binder = (filter = 'all') => {
    const list = set.filter(c => filter === 'all' || c.r === filter);
    stage.innerHTML = `<div class="cl-wrap wide"><div class="cl-bar"><button class="btn btn-sm btn-ghost" id="bkBack">◀ Boosters</button><b>${countOwned()}/102</b>
      <div class="cl-chips"><button data-f="all" class="${filter === 'all' ? 'on' : ''}">Toutes</button>${RAR_ORDER.map(r => `<button data-f="${r}" class="${filter === r ? 'on' : ''}" style="--c:${RARITY[r].color}">${RARITY[r].mark} ${set.filter(c => c.r === r && owned[c.id]).length}/${set.filter(c => c.r === r).length}</button>`).join('')}</div></div><div class="cl-grid book" id="bk"></div></div>`;
    $('#bkBack', stage).addEventListener('click', home);
    stage.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => binder(b.dataset.f)));
    const bk = $('#bk', stage);
    list.forEach(c => {
      const d = document.createElement('div'); d.className = 'cl-slot';
      if (owned[c.id]) { mountCard(d, c); if (owned[c.id] > 1) d.insertAdjacentHTML('beforeend', `<u>×${owned[c.id]}</u>`); d.addEventListener('click', () => zoom(c)); }
      else d.innerHTML = `<div class="cc-none"><b>${c.id}</b><span style="color:${RARITY[c.r].color}">${RARITY[c.r].mark}</span></div>`;
      bk.appendChild(d);
    });
  };
  stage.innerHTML = '<div class="screen"><p>Préparation des boosters…</p></div>';
  apiCall('/api/cards', {}, true).then(r => { set = r.set; owned = r.owned; left = r.left; set.forEach(c => { byId[c.id] = c; }); home(); }).catch(e => toast(e.message));
}

function openCollect(id) {
  openShell(id === 'secrets' ? 'Les Secrets de l’École' : 'Boosters ESFF', id === 'secrets' ? 'Par Captain Obvious' : 'Collection 102', false);
  (id === 'secrets' ? runSecrets : runBoosters)(stage);
}
function collectArt(box, it) {
  box.innerHTML = it.id === 'secrets'
    ? '<div class="sc-mini"><b>CAPTAIN OBVIOUS</b><span>TOP SECRET</span></div>'
    : '<div class="pk mini" style="transform:rotate(-8deg)"><i class="pk-tear"></i><b>ESFF</b><span>Collection 102</span></div><div class="pk mini" style="transform:rotate(7deg) translateX(-30px)"><i class="pk-tear"></i><b>ESFF</b><span>Collection 102</span></div>';
  return null;
}
