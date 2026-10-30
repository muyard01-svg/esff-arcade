/* Collection : les Secrets de l'École (tickets à gratter) et les Boosters ESFF (102 cartes d'entreprises).
   Les tirages sont faits par le serveur. Les illustrations sont dessinées ici, sans logo d'entreprise.
   Style cartoon : toonMan, toonFactory et paintCardArt dessinent des personnages originaux, différents pour chaque entreprise. */
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
let CARD_TOTAL = 558;
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
/* ---------- style cartoon : gros contours, couleurs franches, un personnage original par entreprise ---------- */
const INK = '#2a1c14';
const SKINS = ['#f6cfa8', '#eab98c', '#d59a6a', '#a8704a', '#7a4e32'], HAIRS = ['#2a1c14', '#5a3a20', '#8a5a2c', '#c9a15a', '#6a6f77', '#3a2a4a'];
const SUITS = { fonderie: ['#3a4a5e', '#6a4a30', '#2f6f6a', '#4a3a5e'], forge: ['#2f4a7a', '#5a2f2f', '#3a3d42'], art: ['#6a3a5e', '#8a5a2c', '#2f6f4a'], cloche: ['#7a5a1e', '#4a3a5e'], ecole: ['#23232e'] };
const QUIPS = {
  fonderie: ['Ici, le métal ne dort jamais.', 'Ça coule de source.', 'Chaud devant, ça coule !', 'Le sable, c’est la vie.', 'Moule d’abord, discute après.', 'Toujours à la bonne température.'],
  forge: ['Frappe d’abord, discute après.', 'Quand ça tape, ça forme.', 'Le fer se bat tant qu’il est chaud.', 'Ici, on a le bras long.', 'Une main de fer, évidemment.'],
  art: ['Le bronze a du style.', 'La cire est perdue, pas le talent.', 'Ici, chaque pièce est une œuvre.'], cloche: ['On l’entend de loin.', 'Ça sonne juste.'],
  ecole: ['Forme les fondeurs et les forgerons de demain. Le cœur de toute la filière.'],
};
const FRAME = { commun: '#a39a88', rare: '#3f7fd8', super: '#4a3fb0', alternative: '#1f9a7a', legendaire: '#f5b700', secrete: '#ff5ad0' };
const BADGE = { commun: 'C', rare: 'R', super: 'SR', alternative: 'ALT', legendaire: 'LEG', secrete: 'SEC' };
const stroke = (g, w = 4) => { g.lineWidth = w; g.strokeStyle = INK; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); };
const shape = (g, fill, w) => { g.fillStyle = fill; g.fill(); stroke(g, w); };
function rrect(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }

function toonCloud(g, x, y, s) { g.beginPath(); g.arc(x, y, 18 * s, 0, 7); g.arc(x + 22 * s, y - 8 * s, 22 * s, 0, 7); g.arc(x + 46 * s, y, 16 * s, 0, 7); g.fillStyle = '#fff'; g.fill(); }
function toonFactory(g, x, y, w, h, r, name) {
  const wall = ['#d8d2c4', '#c9b8a0', '#b8c4cc', '#d9c08e'][Math.floor(r() * 4)];
  [[0.14, 56], [0.3, 76]].forEach(([k, ch]) => { rrect(g, x + w * k, y - ch, 20, ch + 6, 3); shape(g, '#8a5a44', 3); g.fillStyle = '#fff'; g.fillRect(x + w * k + 1, y - ch + 10, 18, 5); });
  rrect(g, x, y, w, h, 6); shape(g, wall);
  g.beginPath(); g.moveTo(x - 6, y); for (let i = 0; i < 5; i++) { const a = x + i * w / 5; g.lineTo(a + w / 10, y - 16); g.lineTo(a + w / 5, y); } shape(g, '#6a6f77', 3);
  for (let i = 0; i < 4; i++) { rrect(g, x + 12 + i * (w - 24) / 4, y + h * 0.56, (w - 24) / 4 - 8, h * 0.28, 3); shape(g, '#7fc4e8', 3); }
  const label = name.length > 18 ? name.slice(0, 17) + '…' : name;
  g.font = `900 ${label.length > 13 ? 15 : 19}px Fredoka, Archivo, sans-serif`;
  const tw = Math.min(w - 12, g.measureText(label).width + 18);
  rrect(g, x + w / 2 - tw / 2, y + 8, tw, 28, 5); shape(g, '#fbf3e0', 3);
  g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, x + w / 2, y + 23, w - 20);
}
function toonWorkshop(g, W, H, c, r, p) {
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#3a2a24'); bg.addColorStop(1, '#7a4a2a'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 3; for (let y = 24; y < H; y += 26) for (let x = (y % 52 ? 0 : 26) - 26; x < W; x += 52) g.strokeRect(x, y, 52, 26);
  const gl = g.createRadialGradient(W * 0.72, H * 0.62, 10, W * 0.72, H * 0.62, 190); gl.addColorStop(0, '#fff1a8'); gl.addColorStop(0.3, p[2]); gl.addColorStop(1, 'rgba(255,120,30,0)'); g.fillStyle = gl; g.fillRect(0, 0, W, H);
  rrect(g, W * 0.56, 40, W * 0.38, H - 40, 8); g.save(); g.clip(); g.fillStyle = 'rgba(60,30,14,.45)'; g.fillRect(0, 0, W, H); g.restore();
  g.save(); g.translate(W * 0.74, H * 0.5); g.scale(0.72, 0.72); (SUBJECT[c.kind] || SUBJECT.fonderie)(g, p); g.restore();
  g.font = '900 15px Fredoka, Archivo, sans-serif'; const label = c.name.length > 22 ? c.name.slice(0, 21) + '…' : c.name, tw = Math.min(W * 0.62, g.measureText(label).width + 18);
  rrect(g, W - tw - 12, 10, tw, 26, 5); shape(g, '#fbf3e0', 3); g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, W - 12 - tw / 2, 23, tw - 10);
}
// personnage : tête ronde, petits yeux, gros contour. pose 'up' = bras levés
function toonMan(g, x, y, s, r, o = {}) {
  const skin = SKINS[Math.floor(r() * SKINS.length)], hair = HAIRS[Math.floor(r() * HAIRS.length)], suits = SUITS[o.kind] || SUITS.fonderie, suit = o.suit || suits[Math.floor(r() * suits.length)];
  const style = Math.floor(r() * 5), glasses = r() < 0.3, beard = r() < 0.3, hat = o.hat !== undefined ? o.hat : Math.floor(r() * 4), up = o.pose === 'up';
  g.save(); g.translate(x, y); g.scale(s, s);
  // corps et bras
  if (up) [-1, 1].forEach(k => { g.beginPath(); g.moveTo(k * 44, 66); g.quadraticCurveTo(k * 84, 40, k * 92, -14); g.lineTo(k * 72, -18); g.quadraticCurveTo(k * 62, 30, k * 34, 44); g.closePath(); shape(g, suit); g.beginPath(); g.arc(k * 84, -22, 13, 0, 7); shape(g, skin); });
  g.beginPath(); g.moveTo(-68, 120); g.quadraticCurveTo(-66, 44, -24, 36); g.lineTo(24, 36); g.quadraticCurveTo(66, 44, 68, 120); g.closePath(); shape(g, suit);
  g.beginPath(); g.moveTo(-16, 38); g.lineTo(0, 62); g.lineTo(16, 38); shape(g, skin, 3);
  if (o.mark) { g.font = '900 17px Fredoka, Archivo, sans-serif'; g.fillStyle = '#ffe9a0'; g.textAlign = 'center'; g.fillText(o.mark, 0, 92); }
  // tête
  g.beginPath(); g.arc(-44, -2, 9, 0, 7); g.arc(44, -2, 9, 0, 7); shape(g, skin, 3);
  g.beginPath(); g.ellipse(0, -6, 44, 46, 0, 0, 7); shape(g, skin);
  if (beard) { g.beginPath(); g.moveTo(-42, 2); g.quadraticCurveTo(-40, 48, 0, 48); g.quadraticCurveTo(40, 48, 42, 2); g.quadraticCurveTo(22, 16, 0, 14); g.quadraticCurveTo(-22, 16, -42, 2); shape(g, hair, 3); }
  // coiffure ou casque
  if (hat === 0) { g.beginPath(); g.arc(0, -22, 45, Math.PI, 0); g.closePath(); shape(g, '#f5b700'); rrect(g, -56, -26, 112, 11, 5); shape(g, '#f5b700', 3); }
  else if (hat === 1) { g.beginPath(); g.arc(0, -20, 44, Math.PI, 0); g.closePath(); shape(g, o.suit || '#3f7fd8'); rrect(g, 0, -26, 62, 10, 5); shape(g, o.suit || '#3f7fd8', 3); }
  else if (hat === 2) { g.beginPath(); g.moveTo(-58, -30); g.lineTo(0, -52); g.lineTo(58, -30); g.lineTo(0, -10); g.closePath(); shape(g, '#23232e'); g.beginPath(); g.moveTo(40, -28); g.lineTo(46, 4); stroke(g, 3); g.beginPath(); g.arc(46, 8, 5, 0, 7); shape(g, '#f5b700', 2); }
  else if (style === 4) { /* crâne chauve */ }
  else {
    g.beginPath(); g.moveTo(-46, -6);
    const spikes = 5 + style; for (let i = 0; i <= spikes; i++) { const a = Math.PI + i / spikes * Math.PI, rr = i % 2 ? 56 : 46; g.lineTo(Math.cos(a) * rr, -12 + Math.sin(a) * rr); }
    g.lineTo(46, -6); g.quadraticCurveTo(10, -30, -46, -6); shape(g, hair);
  }
  // visage
  [-16, 16].forEach(k => { g.beginPath(); g.arc(k, -6, 5, 0, 7); g.fillStyle = INK; g.fill(); g.beginPath(); g.arc(k + 1.6, -8, 1.6, 0, 7); g.fillStyle = '#fff'; g.fill(); });
  g.beginPath(); g.moveTo(-24, -18); g.lineTo(-8, -20); g.moveTo(8, -20); g.lineTo(24, -18); stroke(g, 3);
  g.beginPath(); g.moveTo(-2, 2); g.quadraticCurveTo(4, 8, -2, 11); stroke(g, 2.5);
  g.beginPath(); g.moveTo(-12, 20); g.quadraticCurveTo(0, 30, 14, 18); stroke(g, 3);
  if (glasses) { [-16, 16].forEach(k => { g.beginPath(); g.arc(k, -6, 13, 0, 7); stroke(g, 3); }); g.beginPath(); g.moveTo(-3, -6); g.lineTo(3, -6); stroke(g, 3); }
  g.restore();
}
function toonFire(g, W, H, r, n, cols) { for (let i = 0; i < n; i++) { const x0 = r() * W, y0 = H * (0.3 + r() * 0.7), a = r() * 6.28; g.strokeStyle = cols[i % cols.length]; g.lineWidth = 3 + r() * 7; g.lineCap = 'round'; g.globalAlpha = 0.7; g.beginPath(); g.moveTo(x0, y0); g.bezierCurveTo(x0 + Math.cos(a) * 80, y0 - 60, x0 - Math.cos(a) * 70, y0 - 130, x0 + Math.sin(a) * 60, y0 - 190); g.stroke(); } g.globalAlpha = 1; }

function paintCardArt(cv, c) {
  const full = c.r === 'secrete', W = cv.width = 360, H = cv.height = full ? 504 : 228, g = cv.getContext('2d');
  const p = METAL_PAL[c.metal] || METAL_PAL.Fonte, r = seeded(c.id);
  if (full) {
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#2a1a4a'); bg.addColorStop(0.5, '#a0241e'); bg.addColorStop(1, '#ff8a2a'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    toonFactory(g, 190, 150, 160, 120, seeded(5), 'ESFF');
    toonFire(g, W, H, r, 26, ['#ffd27a', '#ff8a2a', '#fff1a8', '#ff5ad0']);
    toonMan(g, W / 2, 196, 1.15, seeded(21), { kind: 'ecole', suit: '#23232e', hat: 2, pose: 'up', mark: 'ESFF' });
    toonFire(g, W, H, r, 8, ['#fff1a8', '#ffd27a']);
    return;
  }
  const leg = c.r === 'legendaire', alt = c.r === 'alternative', sup = c.r === 'super';
  if (leg) {
    const bg = g.createRadialGradient(W / 2, H * 0.5, 10, W / 2, H * 0.5, 280); bg.addColorStop(0, '#fff1a8'); bg.addColorStop(0.4, '#ff9a2a'); bg.addColorStop(1, '#8a1e0c'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.save(); g.translate(W / 2, H * 0.52); for (let i = 0; i < 24; i++) { g.rotate(0.2618); g.fillStyle = i % 2 ? 'rgba(255,240,170,.35)' : 'rgba(255,120,30,.2)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(420, -40); g.lineTo(420, 40); g.fill(); } g.restore();
    toonFactory(g, 196, 74, 150, 110, r, c.name); toonFire(g, W, H, r, 12, ['#fff1a8', '#ff5a1a', '#ffd27a']);
    toonMan(g, 112, 112, 0.92, r, { kind: c.kind, hat: 0, pose: 'up' });
  } else if (alt) {
    const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#2a1f6a'); bg.addColorStop(0.55, '#c8386a'); bg.addColorStop(1, '#ffb347'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${r()})`; g.fillRect(r() * W, r() * H * 0.6, 2, 2); }
    g.save(); g.translate(W * 0.68, H * 0.52); g.scale(0.82, 0.82); g.shadowColor = '#fff1a8'; g.shadowBlur = 26; (SUBJECT[c.scene] || SUBJECT[c.kind])(g, p); g.restore();
    toonMan(g, 96, 118, 0.88, r, { kind: c.kind });
  } else if (r() < (c.kind === 'forge' ? 0.7 : 0.5)) {
    toonWorkshop(g, W, H, c, r, p);
    toonMan(g, 98, 122, sup ? 0.92 : 0.86, r, { kind: c.kind, pose: sup ? 'up' : '' });
  } else {
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#6db4ea'); bg.addColorStop(1, '#d8efff'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    toonCloud(g, 40 + r() * 60, 40, 0.8); toonCloud(g, 190 + r() * 90, 28, 1);
    g.fillStyle = '#7fb45a'; g.fillRect(0, H * 0.78, W, H * 0.22); g.fillStyle = '#b8b2a8'; g.fillRect(0, H * 0.88, W, H * 0.12);
    toonFactory(g, 150, 78, 196, 104, r, c.name);
    toonMan(g, 92, 122, sup ? 0.92 : 0.86, r, { kind: c.kind, pose: sup ? 'up' : '' });
  }
  for (let i = 0; i < (leg || alt ? 40 : 10); i++) { g.fillStyle = p[3]; const z = 1 + r() * 3; g.fillRect(r() * W, r() * H, z, z); }
}

/* ---------- une carte ---------- */
function cardHTML(c) {
  // carte illustrée à la main : l'image est la carte entière
  if (c.img) return `<div class="cc has-img r-${c.r}" data-card="${c.id}"><div class="cc-in"><img src="${c.img}" alt="${esc(c.name)}" draggable="false"><div class="cc-foil"></div><div class="cc-glare"></div></div></div>`;
  const qs = QUIPS[c.kind] || QUIPS.fonderie, quip = qs[c.id % qs.length], L = ['Savoir-faire', 'Innovation', 'Rayonnement'];
  return `<div class="cc r-${c.r}" data-card="${c.id}" style="--fr:${FRAME[c.r]}"><div class="cc-in"><canvas class="cc-art"></canvas><div class="cc-foil"></div>
    <div class="cc-top"><b>${esc(c.name)}</b></div><span class="cc-badge">${BADGE[c.r]}</span>
    <div class="cc-info"><p>${esc(quip)}</p><small>${KIND_LABEL[c.kind]} · ${esc(c.city)}</small></div>
    <div class="cc-stats">${c.st.map((v, i) => `<div><span>${L[i]}</span><b>${v}</b></div>`).join('')}</div>
    <div class="cc-tags">${c.tags.map(t => `<i>${esc(t)}</i>`).join('')}</div>
    <div class="cc-num">${c.id - 1000}/${CARD_TOTAL}</div><div class="cc-glare"></div></div></div>`;
}
function mountCard(host, c) {
  host.innerHTML = cardHTML(c);
  if (!c.img) paintCardArt($('canvas', host), c);
  const el = $('.cc', host);
  const mv = e => { const b = el.getBoundingClientRect(), x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height; el.style.setProperty('--mx', `${x * 100}%`); el.style.setProperty('--my', `${y * 100}%`); el.style.setProperty('--ry', `${(x - 0.5) * 26}deg`); el.style.setProperty('--rx', `${(0.5 - y) * 26}deg`); el.classList.add('tilt'); };
  el.addEventListener('pointermove', mv);
  el.addEventListener('pointerleave', () => { el.classList.remove('tilt'); el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
  return el;
}

/* ---------- animation immersive de la carte secrète : on entre dans la carte et on suit tout le savoir-faire,
   poste par poste, de la fusion au contrôle. Chaque poste est une fonction (g, k, t) : k va de 0 à 1 pendant le poste. ---------- */
const IM_HOT = '#ffb347', IM_WHITE = '#fff1a8', IM_FLOOR = 440;
function imPiece(g, x, y, s, col, burr = 0) {
  g.save(); g.translate(x, y); g.scale(s, s);
  rrect(g, -70, -26, 140, 52, 12); shape(g, col);
  rrect(g, -30, -52, 60, 34, 8); shape(g, col);
  g.beginPath(); g.arc(0, 0, 13, 0, 7); shape(g, '#2a1c14', 3);
  if (burr > 0) { g.fillStyle = col; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-60 + i * 24, 26); g.lineTo(-50 + i * 24, 26 + 16 * burr); g.lineTo(-40 + i * 24, 26); g.fill(); stroke(g, 2); } }
  g.restore();
}
function imSparks(g, x, y, t, n, spread, col = '#ffd27a') {
  g.fillStyle = col;
  for (let i = 0; i < n; i++) { const ph = (t * 1.7 + i * 0.137) % 1, a = -1.57 + (i * 2.399 % 1 - 0.5) * spread, v = 40 + (i * 37 % 60) * 3.4; g.globalAlpha = 1 - ph; g.fillRect(x + Math.cos(a) * v * ph, y + Math.sin(a) * v * ph + 90 * ph * ph, 4, 4); }
  g.globalAlpha = 1;
}
const IM_STEPS = [
  ['La fusion', 'Ferraille et ferroalliages fondent au four à induction, vers 1 450 °C.', (g, k, t) => {
    rrect(g, 300, 190, 240, 250, 14); shape(g, '#2b6cb0');
    for (let i = 0; i < 4; i++) { rrect(g, 288, 222 + i * 48, 264, 18, 8); shape(g, '#c87533', 3); }
    g.beginPath(); g.ellipse(420, 190, 112, 24, 0, 0, 7); shape(g, k > 0.35 ? IM_HOT : '#4a3a30');
    if (k < 0.5) for (let i = 0; i < 6; i++) { const y = 20 + ((t * 300 + i * 70) % 170); rrect(g, 370 + (i * 53 % 90), y, 34, 12, 3); shape(g, '#8a8d91', 3); }
    if (k > 0.35) imSparks(g, 420, 186, t, 26, 1.6);
    rrect(g, 640, 300, 170, 140, 14); shape(g, '#3a3d42');
    const lv = Math.max(0, (k - 0.5) * 2); g.fillStyle = IM_HOT; g.fillRect(652, 312, 146, 12); if (k > 0.5) { g.fillStyle = IM_WHITE; g.fillRect(585, 204, 14 , 16); g.beginPath(); g.moveTo(538, 196); g.quadraticCurveTo(690, 190, 716, 310); g.lineTo(734, 310); g.quadraticCurveTo(700, 170, 538, 176); g.fill(); }
    rrect(g, 660, 120, 190, 74, 10); shape(g, '#14181a'); g.fillStyle = '#7dffa0'; g.font = '700 38px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(`${Math.round(25 + Math.min(1, k * 1.5) * 1425)} °C`, 755, 158);
  }],
  ['Le contrôle du métal', 'Le spectromètre vérifie la composition avant de couler : la nuance doit être exacte.', (g, k, t) => {
    rrect(g, 170, 340, 620, 100, 8); shape(g, '#c9b8a0');
    rrect(g, 210, 190, 200, 150, 12); shape(g, '#d8dde3'); g.beginPath(); g.arc(310, 262, 34, 0, 7); shape(g, '#3a3d42');
    g.beginPath(); g.arc(310, 262, 14, 0, 7); g.fillStyle = Math.sin(t * 40) > 0 ? '#fff' : '#7fd4ff'; g.fill(); imSparks(g, 310, 262, t, 12, 3, '#bfe8ff');
    rrect(g, 470, 120, 300, 220, 12); shape(g, '#14181a');
    [['C', 0.72, '3,50 %'], ['Si', 0.5, '2,40 %'], ['Mn', 0.22, '0,30 %'], ['Mg', 0.12, '0,04 %']].forEach(([n, v, txt], i) => {
      const y = 150 + i * 44, w = 150 * v * Math.min(1, k * 2.2); g.font = '700 22px Fredoka, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#7dffa0'; g.fillText(n, 488, y + 10);
      g.fillRect(530, y, w, 20); if (k > 0.5) { g.textAlign = 'right'; g.fillText(txt, 756, y + 10); }
    });
    if (k > 0.7) { g.font = '700 26px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#ffd27a'; g.fillText('NUANCE OK', 620, 322); }
  }],
  ['Le moulage', 'Le sable est versé autour du modèle, puis serré pour garder l’empreinte.', (g, k, t) => {
    rrect(g, 280, 220, 400, 220, 6); shape(g, '#2a2420');
    const lv = Math.min(1, k * 1.7); g.fillStyle = '#c49a64'; g.fillRect(292, 430 - 196 * lv, 376, 196 * lv);
    g.fillStyle = 'rgba(90,60,30,.35)'; for (let i = 0; i < 60; i++) g.fillRect(296 + (i * 83 % 360), 428 - (i * 47 % 190) * lv, 3, 3);
    imPiece(g, 480, 380, 1, '#5a5048');
    rrect(g, 268, 214, 24, 228, 4); shape(g, '#2f7a4f'); rrect(g, 668, 214, 24, 228, 4); shape(g, '#2f7a4f');
    g.beginPath(); g.moveTo(400, 40); g.lineTo(560, 40); g.lineTo(510, 110); g.lineTo(450, 110); g.closePath(); shape(g, '#5c6067');
    if (k < 0.6) { g.fillStyle = '#c49a64'; g.fillRect(462, 110, 36, 330 - 196 * lv); }
    if (k >= 0.6) { const h = Math.abs(Math.sin((k - 0.6) * 22)); const y = 180 - h * 110; rrect(g, 470, y - 110, 20, 130, 4); shape(g, '#7a5434'); rrect(g, 436, y + 18, 88, 22, 6); shape(g, '#5c6067'); if (h < 0.15) imSparks(g, 480, 225, t, 8, 2.4, '#c49a64'); }
  }],
  ['Le noyautage et le remmoulage', 'Les noyaux forment les creux de la pièce. On les pose, puis on referme le moule.', (g, k, t) => {
    rrect(g, 270, 320, 420, 120, 6); shape(g, '#c49a64'); g.fillStyle = '#2a1c14'; rrect(g, 370, 320, 220, 74, 10); g.fill();
    const cy = 120 + Math.min(1, k * 2) * 212; rrect(g, 405, cy, 150, 34, 14); shape(g, '#e2d2a8');
    rrect(g, 462, 0, 36, cy, 0); shape(g, 'rgba(92,96,103,.9)', 3);
    const top = -130 + Math.max(0, (k - 0.5) * 2) * 320; rrect(g, 270, top, 420, 130, 6); shape(g, '#b08a5a');
    g.font = '700 20px Fredoka, sans-serif'; g.fillStyle = '#2a1c14'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('CHAPE', 480, top + 65); g.fillText('DESSOUS', 480, 416);
  }],
  ['La coulée', 'Le métal entre par le système de coulée et remplit l’empreinte sans s’interrompre.', (g, k, t) => {
    rrect(g, 300, 210, 380, 230, 6); shape(g, '#b08a5a');
    g.fillStyle = '#2a1c14'; rrect(g, 370, 300, 240, 90, 12); g.fill(); g.fillRect(380, 210, 26, 100); g.fillRect(556, 230, 34, 80);
    g.save(); g.beginPath(); g.rect(360, 390 - Math.min(1, k * 1.2) * 190, 260, 200); g.clip(); g.fillStyle = IM_HOT; rrect(g, 374, 304, 232, 82, 10); g.fill(); g.fillRect(384, 210, 18, 100); g.fillRect(560, 230, 26, 80); g.restore();
    g.save(); g.translate(330, 110); g.rotate(0.7); rrect(g, -70, -50, 130, 100, 12); shape(g, '#3a3d42'); g.fillStyle = IM_HOT; g.fillRect(-60, -46, 110, 12); rrect(g, -230, -8, 160, 16, 4); shape(g, '#5c6067'); g.restore();
    g.fillStyle = IM_WHITE; g.fillRect(383, 120, 20, 96); imSparks(g, 393, 214, t, 22, 2.6);
    const gl = g.createRadialGradient(480, 330, 10, 480, 330, 300); gl.addColorStop(0, `rgba(255,140,40,${0.15 + k * 0.3})`); gl.addColorStop(1, 'rgba(255,120,30,0)'); g.fillStyle = gl; g.fillRect(100, 0, 760, 540);
  }],
  ['Le décochage', 'Le moule refroidi passe sur la grille vibrante : le sable tombe, la pièce apparaît.', (g, k, t) => {
    const sh = Math.sin(t * 60) * 4; rrect(g, 240, 400, 480, 26, 4); shape(g, '#3a3d42'); g.fillStyle = '#14181a'; for (let i = 0; i < 12; i++) g.fillRect(256 + i * 38, 404, 18, 18);
    imPiece(g, 480 + sh, 340, 1.05, '#5a5048');
    rrect(g, 470 + sh, 230, 20, 60, 2); shape(g, '#5a5048', 3);
    const a = Math.max(0, 1 - k * 1.5); if (a > 0) { g.globalAlpha = a; rrect(g, 300 + sh, 200 + 30 * k, 360, 200, 8); shape(g, '#b08a5a'); g.globalAlpha = 1; }
    g.fillStyle = '#c49a64'; for (let i = 0; i < 70; i++) { const ph = (t * 1.3 + i * 0.09) % 1; g.fillRect(260 + (i * 71 % 440), 300 + ph * 200, 5, 5); }
  }],
  ['La forge', 'Le lopin chauffé à blanc passe sous le pilon : la frappe donne la forme et resserre le métal.', (g, k, t) => {
    const hits = 4, ph = k * hits, n = Math.floor(ph), f = ph - n, y = f < 0.2 ? 1 - f / 0.2 : (f - 0.2) / 0.8;
    rrect(g, 170, 60, 60, 380, 4); shape(g, '#2f4a7a'); rrect(g, 730, 60, 60, 380, 4); shape(g, '#2f4a7a'); rrect(g, 150, 40, 660, 50, 6); shape(g, '#2a3a5a');
    rrect(g, 320, 390, 320, 50, 6); shape(g, '#3a3d42'); rrect(g, 370, 360, 220, 30, 4); shape(g, '#5c6067');
    const w = 110 + (n + (f < 0.2 ? f * 5 : 1)) * 42, h = 104 - (n + (f < 0.2 ? f * 5 : 1)) * 13;
    rrect(g, 480 - w / 2, 360 - h, w, h, 14); shape(g, IM_WHITE); rrect(g, 490 - w / 2, 366 - h, w - 20, h - 12, 12); g.fillStyle = IM_HOT; g.fill();
    const ry = 360 - h - 60 - y * 170; rrect(g, 400, ry - 100, 160, 160, 6); shape(g, '#8a8d91'); rrect(g, 455, 80, 50, Math.max(0, ry - 180), 0); shape(g, '#d8dde3', 3);
    if (f < 0.25) imSparks(g, 480, 340 - h, t * 3, 40, 3);
  }],
  ['Le traitement thermique', 'Trempe puis revenu : on chauffe et on refroidit pour régler dureté et résilience.', (g, k, t) => {
    rrect(g, 300, 300, 360, 140, 8); shape(g, '#3a5f8a'); g.fillStyle = '#7fc4e8'; g.fillRect(312, 316, 336, 114);
    const dip = k < 0.45 ? k / 0.45 : k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3, y = 110 + dip * 260;
    rrect(g, 471, 0, 18, y - 40, 0); shape(g, '#5c6067', 3);
    imPiece(g, 480, y, 1, k < 0.45 ? '#ff8a2a' : '#8a8d91');
    if (k > 0.38 && k < 0.85) { g.fillStyle = 'rgba(255,255,255,.75)'; for (let i = 0; i < 16; i++) { const ph = (t * 0.9 + i * 0.13) % 1; g.beginPath(); g.arc(340 + (i * 89 % 280) + Math.sin(ph * 8 + i) * 16, 310 - ph * 240, 16 + ph * 26, 0, 7); g.fill(); } }
    rrect(g, 700, 130, 170, 70, 10); shape(g, '#14181a'); g.fillStyle = '#7dffa0'; g.font = '700 30px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(k < 0.45 ? '900 °C' : k < 0.7 ? '60 °C' : 'HRC 42', 785, 165);
  }],
  ['L’ébarbage et l’usinage', 'On retire les bavures, puis on usine les surfaces à la cote, au centième près.', (g, k, t) => {
    rrect(g, 240, 380, 480, 60, 6); shape(g, '#3a3d42');
    imPiece(g, 420, 325, 1, k > 0.75 ? '#c9d6e2' : '#8a8d91', Math.max(0, 1 - k * 1.5));
    g.save(); g.translate(600, 300); g.rotate(t * 30); g.beginPath(); g.arc(0, 0, 72, 0, 7); shape(g, '#9aa0a6'); for (let i = 0; i < 8; i++) { g.rotate(0.785); g.beginPath(); g.moveTo(14, 0); g.lineTo(66, 0); stroke(g, 3); } g.beginPath(); g.arc(0, 0, 12, 0, 7); shape(g, '#2a1c14', 3); g.restore();
    if (k < 0.8) imSparks(g, 530, 340, t * 2.2, 40, 1.8);
    if (k > 0.75) { g.fillStyle = 'rgba(255,255,255,.7)'; g.save(); g.translate(300 + (k - 0.75) * 960, 325); g.rotate(0.4); g.fillRect(-8, -80, 16, 160); g.restore(); }
    g.font = '700 26px Fredoka, sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; if (k > 0.5) g.fillText('Ø 50,00 ± 0,01', 420, 200);
  }],
  ['Le contrôle qualité', 'Ultrasons, mesures, essais : une pièce ne sort que si elle est conforme.', (g, k, t) => {
    rrect(g, 170, 390, 340, 50, 6); shape(g, '#c9b8a0'); imPiece(g, 340, 340, 1, '#c9d6e2');
    const px = 280 + Math.sin(k * 12) * 60; rrect(g, px - 12, 240, 24, 50, 5); shape(g, '#F5B700'); g.beginPath(); g.moveTo(px, 240); g.quadraticCurveTo(px + 60, 140, 560, 170); stroke(g, 4);
    rrect(g, 540, 110, 300, 210, 12); shape(g, '#14181a'); g.strokeStyle = '#7dffa0'; g.lineWidth = 3; g.beginPath(); for (let x = 0; x <= 280; x += 4) { const pk = Math.exp(-((x - 60) ** 2) / 90) * 120 + Math.exp(-((x - 230) ** 2) / 90) * 70, v = 280 - pk - Math.sin(x * 0.7 + t * 24) * 5; x ? g.lineTo(550 + x, v) : g.moveTo(550, v); } g.stroke();
    if (k > 0.72) { const s = 1 + Math.max(0, 0.9 - k) * 12; g.save(); g.translate(340, 300); g.rotate(-0.18); g.scale(s, s); rrect(g, -130, -38, 260, 76, 10); g.fillStyle = 'rgba(255,255,255,.9)'; g.fill(); g.lineWidth = 7; g.strokeStyle = '#2E9E5B'; g.stroke(); g.fillStyle = '#2E9E5B'; g.font = '700 42px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('CONFORME', 0, 2); g.restore(); }
  }],
];

function immersive(c, done) {
  const box = document.createElement('div'); box.className = 'imm'; box.dataset.overlay = '1';
  box.innerHTML = '<canvas width="960" height="540"></canvas><small>Touche l’écran pour passer</small>';
  $('.modal-box').appendChild(box);
  const cv = $('canvas', box), g = cv.getContext('2d'), W = 960, H = 540;
  let art = document.createElement('canvas');
  if (c.img) { art = new Image(); art.src = c.img; } else paintCardArt(art, c);
  const ease = k => k * k * (3 - 2 * k), cl = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));
  const T0 = 1.4, MOVE = 0.8, HOLD = 3.1, SEG = MOVE + HOLD, N = IM_STEPS.length, T1 = T0 + N * SEG, END = T1 + 5.2;
  let t = 0, over = false, lastIdx = -1, lastHit = -1;
  const finish = () => { if (over) return; over = true; stop(); box.remove(); if (done) done(); };
  box.addEventListener('click', finish);
  const stop = loop(dt => {
    t += dt;
    const tt = Math.max(0, t - T0), idx = Math.min(N - 1, Math.floor(tt / SEG)), loc = Math.min(SEG, tt - idx * SEG);
    const k = loc < MOVE ? 0 : Math.min(1, (loc - MOVE) / HOLD), cam = (idx + (idx && loc < MOVE ? ease(loc / MOVE) - 1 : 0)) * W;
    if (idx !== lastIdx) { lastIdx = idx; sfx(330 + idx * 44, 0.18, 'triangle', 0.04); }
    if (idx === 6) { const n = Math.floor(k * 4); if (n !== lastHit) { lastHit = n; sfx(80, 0.25, 'square', 0.08, -30); } }
    // la halle : brique, charpente et piliers qui défilent à des vitesses différentes
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#2a1a1a'); sky.addColorStop(1, '#6a3a20'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 3; const bx = -(cam * 0.3) % 80; for (let y = 0; y < IM_FLOOR; y += 40) for (let x = bx - 80 + (y % 80 ? 40 : 0); x < W + 80; x += 80) g.strokeRect(x, y, 80, 40);
    const px = -(cam * 0.6) % 480; g.fillStyle = 'rgba(0,0,0,.4)'; for (let x = px - 480; x < W + 480; x += 480) { g.fillRect(x, 0, 40, IM_FLOOR); g.beginPath(); g.moveTo(x, 40); g.lineTo(x + 240, 90); g.lineTo(x + 480, 40); g.lineTo(x + 480, 20); g.lineTo(x + 240, 70); g.lineTo(x, 20); g.fill(); }
    g.fillStyle = '#3a3330'; g.fillRect(0, IM_FLOOR, W, H - IM_FLOOR); g.fillStyle = '#F5B700'; const st = -cam % 80; for (let x = st - 80; x < W; x += 80) g.fillRect(x, IM_FLOOR + 6, 40, 6);
    for (let s = Math.max(0, idx - 1); s <= Math.min(N - 1, idx + 1); s++) { g.save(); g.translate(s * W - cam, 0); IM_STEPS[s][2](g, s < idx ? 1 : s > idx ? 0 : k, t); g.restore(); }
    // le premier plan passe vite : on a l'impression d'avancer dans l'atelier
    const fx = -(cam * 1.5) % 1400; g.fillStyle = 'rgba(10,6,4,.85)'; for (let x = fx - 1400; x < W + 1400; x += 1400) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + 60, 300); g.lineTo(x + 170, 300); g.lineTo(x + 230, H); g.fill(); }
    // nom du métier
    if (t < T1 + 0.2) {
      const [ti, fact] = IM_STEPS[idx], a = cl(loc, MOVE * 0.5, MOVE) * (1 - cl(loc, SEG - 0.3, SEG));
      g.globalAlpha = a; g.fillStyle = 'rgba(251,243,224,.96)'; rrect(g, 24, 460, W - 48, 62, 12); g.fill(); stroke(g, 4);
      g.fillStyle = INK; g.textAlign = 'left'; g.textBaseline = 'middle'; g.font = '700 25px Fredoka, Archivo, sans-serif'; g.fillText(`${idx + 1}. ${ti}`, 42, 478); g.font = '600 16px Fredoka, Archivo, sans-serif'; g.fillText(fact, 42, 505, W - 84); g.globalAlpha = 1;
      for (let i = 0; i < N; i++) { g.beginPath(); g.arc(W / 2 - (N - 1) * 11 + i * 22, 24, i === idx ? 8 : 5, 0, 7); g.fillStyle = i <= idx ? '#F5B700' : 'rgba(255,255,255,.3)'; g.fill(); }
    }
    // final : tous les métiers réunis
    const fin = ease(cl(t, T1, T1 + 0.8)) * (1 - ease(cl(t, END - 1.6, END - 0.8)));
    if (fin > 0) {
      g.globalAlpha = fin; const bg = g.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, 620); bg.addColorStop(0, '#fff1a8'); bg.addColorStop(0.45, '#ff9a2a'); bg.addColorStop(1, '#6a1e0c'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.save(); g.translate(W / 2, 220); g.rotate(t * 0.15); for (let i = 0; i < 24; i++) { g.rotate(0.2618); g.fillStyle = 'rgba(255,240,170,.22)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(760, -32); g.lineTo(760, 32); g.fill(); } g.restore();
      g.save(); g.translate(W / 2, 214); g.scale(1.25, 1.25); SUBJECT.piece(g, METAL_PAL.Fonte); g.fillStyle = '#3a1e06'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.font = '700 50px Fredoka, sans-serif'; g.fillText('ESFF', 0, 2); g.font = '700 32px Fredoka, sans-serif'; g.fillText('102', 0, 38); g.restore();
      g.fillStyle = INK; g.font = '700 32px Fredoka, Archivo, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Fondre, mouler, couler, forger, contrôler', W / 2, 420); g.font = '600 21px Fredoka, Archivo, sans-serif'; g.fillText('Tout le savoir-faire de la fonderie et de la forge', W / 2, 462);
      g.globalAlpha = 1;
    }
    // entrée dans la carte et retour à la carte
    const a = Math.max(1 - ease(cl(t, 0.5, 1.4)), ease(cl(t, END - 1.2, END - 0.2)));
    if (a > 0) { const s = 0.9 + (1 - a) * 3.4, ch = H * s, cw = ch * 0.74; g.globalAlpha = Math.min(1, a * 1.5); g.fillStyle = '#000'; g.fillRect(0, 0, W, H); if (!c.img || art.complete) g.drawImage(art, W / 2 - cw / 2, H / 2 - ch / 2, cw, ch); g.globalAlpha = 1; }
    if (t > END) { finish(); return false; }
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
  let set = [], owned = {}, byId = {}, query = '';
  const countOwned = () => Object.keys(owned).length;
  const home = () => {
    stage.innerHTML = `<div class="cl-wrap"><div class="pk" id="pk"><i class="pk-tear"></i><b>ESFF</b><span>Collection 102</span><small>5 cartes</small></div>
      <p class="cl-hint"><b>${countOwned()}/${CARD_TOTAL}</b> cartes · boosters gratuits et illimités</p>
      <div class="end-actions"><button class="btn btn-hot" id="pkGo">Ouvrir un booster</button><button class="btn btn-ghost" id="pkBook">Mon classeur</button></div></div>`;
    $('#pkGo', stage).addEventListener('click', open);
    $('#pkBook', stage).addEventListener('click', () => binder());
  };
  const open = async () => {
    $('#pkGo', stage).disabled = true;
    let r; try { r = await apiCall('/api/booster', {}, true); } catch (e) { toast(e.message); return; }
    owned = r.owned;
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
    stage.innerHTML = `<div class="cl-wrap"><h4 class="cl-h">Ton booster · ${countOwned()}/${CARD_TOTAL}</h4><div class="cl-grid" id="sm"></div><div class="end-actions"><button class="btn btn-hot" id="smAg">Encore un</button><button class="btn btn-ghost" id="smBk">Mon classeur</button></div></div>`;
    pack.forEach(({ c, isNew }) => { const d = document.createElement('div'); d.className = 'cl-slot'; $('#sm', stage).appendChild(d); mountCard(d, c); if (isNew) d.insertAdjacentHTML('beforeend', '<em>NEW</em>'); d.addEventListener('click', () => zoom(c)); });
    $('#smAg', stage).addEventListener('click', home);
    $('#smBk', stage).addEventListener('click', () => binder());
  };
  const zoom = c => {
    const box = document.createElement('div'); box.className = 'cl-zoom'; box.dataset.overlay = '1';
    box.innerHTML = `<div class="cl-z"></div><div class="end-actions">${c.r === 'secrete' ? '<button class="btn btn-hot" id="zImm">Entrer dans la carte</button>' : ''}<button class="btn btn-ghost" id="zOut">Fermer</button></div><small>Exemplaires : ${owned[c.id] || 0}. Les stats sont fictives, pour le jeu.</small>`;
    $('.modal-box').appendChild(box); mountCard($('.cl-z', box), c);
    $('#zOut', box).addEventListener('click', () => box.remove());
    const b = $('#zImm', box); if (b) b.addEventListener('click', () => { box.remove(); immersive(c, () => zoom(c)); });
  };
  const PAGE = 48;
  const binder = (filter = 'all', page = 0) => {
    const q = query.toLowerCase();
    const list = set.filter(c => (filter === 'all' || c.r === filter) && (!q || c.name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q)));
    const pages = Math.max(1, Math.ceil(list.length / PAGE)); page = Math.min(page, pages - 1);
    stage.innerHTML = `<div class="cl-wrap wide"><div class="cl-bar"><button class="btn btn-sm btn-ghost" id="bkBack">◀ Boosters</button><b>${countOwned()}/${CARD_TOTAL}</b>
      <input id="bkQ" placeholder="Chercher une entreprise ou une ville" value="${esc(query)}">
      <div class="cl-chips"><button data-f="all" class="${filter === 'all' ? 'on' : ''}">Toutes</button>${RAR_ORDER.map(r => `<button data-f="${r}" class="${filter === r ? 'on' : ''}" style="--c:${RARITY[r].color}">${BADGE[r]} ${set.filter(c => c.r === r && owned[c.id]).length}/${set.filter(c => c.r === r).length}</button>`).join('')}</div></div>
      <div class="cl-grid book" id="bk"></div>
      <div class="cl-pages"><button class="btn btn-sm btn-ghost" id="bkP" ${page ? '' : 'disabled'}>◀</button><span>Page ${page + 1}/${pages}</span><button class="btn btn-sm btn-ghost" id="bkN" ${page + 1 < pages ? '' : 'disabled'}>▶</button></div></div>`;
    $('#bkBack', stage).addEventListener('click', home);
    $('#bkP', stage).addEventListener('click', () => binder(filter, page - 1));
    $('#bkN', stage).addEventListener('click', () => binder(filter, page + 1));
    const qi = $('#bkQ', stage);
    qi.addEventListener('change', () => { query = qi.value.trim(); binder(filter, 0); });
    qi.addEventListener('keydown', e => e.stopPropagation());
    stage.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => binder(b.dataset.f, 0)));
    const bk = $('#bk', stage);
    list.slice(page * PAGE, (page + 1) * PAGE).forEach(c => {
      const d = document.createElement('div'); d.className = 'cl-slot';
      if (owned[c.id]) { mountCard(d, c); if (owned[c.id] > 1) d.insertAdjacentHTML('beforeend', `<u>×${owned[c.id]}</u>`); d.addEventListener('click', () => zoom(c)); }
      else d.innerHTML = `<div class="cc-none"><b>${c.id - 1000}</b><span style="color:${RARITY[c.r].color}">${BADGE[c.r]}</span><small>${esc(c.name)}</small></div>`;
      bk.appendChild(d);
    });
  };
  stage.innerHTML = '<div class="screen"><p>Préparation des boosters…</p></div>';
  apiCall('/api/cards', {}, true).then(r => { set = r.set; owned = r.owned; CARD_TOTAL = set.length; set.forEach(c => { byId[c.id] = c; }); home(); }).catch(e => toast(e.message));
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
