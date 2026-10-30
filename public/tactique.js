/* Forge Tactique — auto-battler sur les métiers de la métallurgie (simulation serveur : tactique.py).
   Plateau en 3D, personnages en pixel art dessinés ici puis extrudés en petits cubes (un cube par pixel).
   Chaque corps de métier a son outil et son attaque. Les combats calculés par le serveur sont rejoués ici. */
'use strict';

ONLINE.push({
  id: 'tactique', title: 'Forge Tactique', tone: '#C77DFF', label: 'Stratégie auto · 2 à 8 joueurs', tag: 'TACTIQUE 2-8',
  pitch: 'Recrute les métiers de la métallurgie, combine leurs familles, équipe-les d’objets pris sur les monstres et regarde ton atelier se battre tout seul. Le dernier debout gagne.',
  how: '<b>Clic</b> sur une carte ou touches <b>1 à 5</b> pour recruter · <b>R</b> actualiser · <b>X</b> acheter de l\u2019XP · <b>Espace</b> prêt · <b>glisse dans le vide</b> pour tourner, <b>molette</b> pour zoomer, <b>C</b> pour recentrer · <b>glisse</b> une unité pour la placer, sur la boutique pour la vendre (ou <b>E</b> au survol) · 3 exemplaires identiques fusionnent · chaque unité a 2 ou 3 familles : réunis-en plusieurs pour les combos · les manches de monstres donnent des objets : clique un objet, puis une unité. La rareté suit la difficulté de recrutement et la spécialisation : ce n’est pas un jugement sur la valeur des métiers.',
});
HANDLERS.tactique = () => updateTactique();

/* ---------- pixel art : 32 × 32, grosse tête, couleurs terreuses ---------- */
const PX_FAM = {
  metal: ['#5f6670', '#474d56', '#3a3d42'], chaudro: ['#8a5a34', '#6a4426', '#4a3a2c'], soudage: ['#3f5f86', '#2f4868', '#2b3442'], tuyau: ['#3f7a78', '#2f5e5c', '#3a3d42'], usinage: ['#7a8087', '#5e646b', '#3a4048'],
  fonderie: ['#a8552a', '#84401e', '#4a3024'], surface: ['#7a5a96', '#5e4476', '#3e3448'], maint: ['#4f8a5a', '#3a6c46', '#3a3d32'], bureau: ['#c9a44a', '#a08236', '#4a4238'], qualite: ['#cfd3cc', '#a8aca6', '#55585c'],
  prod: ['#964048', '#763038', '#3e2e30'], chantier: ['#c08a2a', '#9a6e20', '#4a3a24'], recyclage: ['#66753e', '#4e5a2e', '#3e3a28'], commerce: ['#39608e', '#2c4a70', '#2e3440'],
};
const PX_SKIN = [['#e8c09a', '#c99c78'], ['#d4a078', '#b0805c'], ['#a8724c', '#885a3a'], ['#74492e', '#5a3822']], PX_HAIR = ['#3a2a1e', '#5a3c24', '#8a6036', '#b8843c', '#6a6e72', '#2a2a30'];
function pxTool(P, fam) {
  const W = '#7a5434', M = '#8a8d91', D = '#4a4e54';
  if (fam === 'metal') { P(26, 12, 2, 12, W); P(24, 9, 6, 4, M); }
  else if (fam === 'chaudro') { P(26, 10, 2, 14, W); P(23, 6, 8, 5, '#a8724c'); P(23, 6, 8, 1, '#c99c78'); }
  else if (fam === 'soudage') { P(25, 18, 5, 2, D); P(29, 16, 2, 2, '#7fd4ff'); P(30, 14, 1, 2, '#fff'); P(31, 16, 1, 1, '#ffd27a'); }
  else if (fam === 'tuyau') { P(26, 10, 2, 13, '#8a3a2a'); P(24, 8, 6, 2, '#8a3a2a'); P(24, 10, 2, 2, '#8a3a2a'); P(28, 10, 2, 2, '#8a3a2a'); }
  else if (fam === 'usinage') { P(26, 9, 2, 14, M); P(26, 9, 6, 2, M); P(26, 13, 5, 2, M); P(29, 11, 1, 2, '#d8dde3'); }
  else if (fam === 'fonderie') { P(23, 22, 6, 1, D); P(27, 20, 5, 5, D); P(28, 19, 3, 2, '#ff8a2a'); P(29, 18, 1, 1, '#ffd27a'); }
  else if (fam === 'surface') { P(25, 18, 5, 3, '#c9c4ba'); P(28, 21, 2, 3, D); P(30, 18, 2, 1, '#c77dff'); P(31, 16, 1, 1, '#c77dff'); }
  else if (fam === 'maint') { P(26, 11, 2, 12, M); P(25, 8, 1, 4, M); P(28, 8, 1, 4, M); P(26, 11, 3, 1, M); }
  else if (fam === 'bureau') { P(25, 12, 4, 12, '#e8e0c8'); P(25, 12, 4, 1, '#3f7fd8'); P(25, 23, 4, 1, '#3f7fd8'); }
  else if (fam === 'qualite') { P(26, 16, 2, 8, W); P(25, 10, 6, 6, D); P(26, 11, 4, 4, '#bfe8ff'); }
  else if (fam === 'prod') { P(25, 13, 6, 9, W); P(26, 14, 4, 7, '#e8e0c8'); P(27, 12, 2, 2, M); }
  else if (fam === 'chantier') { P(26, 3, 1, 15, M); P(25, 18, 3, 3, M); P(27, 21, 2, 2, M); }
  else if (fam === 'recyclage') { P(25, 12, 2, 12, D); P(28, 12, 2, 12, D); P(26, 18, 3, 1, M); P(24, 10, 3, 2, M); P(28, 10, 3, 2, M); }
  else if (fam === 'commerce') { P(25, 19, 7, 5, '#5a3c24'); P(27, 18, 3, 1, '#3a2a1e'); P(28, 21, 1, 1, '#F5B700'); }
}
function pxMonster(P, kind) {
  if (kind === 'rat') { P(7, 19, 17, 9, '#6a6058'); P(5, 23, 4, 2, '#d09a8a'); P(21, 15, 8, 9, '#6a6058'); P(22, 12, 3, 4, '#d09a8a'); P(26, 18, 2, 2, '#c8301e'); P(29, 21, 2, 2, '#d09a8a'); P(10, 27, 3, 2, '#d09a8a'); P(19, 27, 3, 2, '#d09a8a'); P(1, 21, 5, 1, '#d09a8a'); }
  else if (kind === 'crasse') { P(7, 16, 19, 13, '#5a4a3a'); P(10, 11, 13, 6, '#6a5844'); P(5, 22, 3, 7, '#5a4a3a'); P(25, 22, 3, 7, '#5a4a3a'); P(11, 19, 4, 3, '#ffb347'); P(19, 19, 4, 3, '#ffb347'); P(13, 25, 8, 2, '#2a1c14'); P(12, 12, 3, 1, '#8a7458'); }
  else if (kind === 'golem') { P(8, 13, 16, 12, '#b08a5a'); P(10, 5, 12, 8, '#c49a64'); P(3, 13, 5, 12, '#a07c54'); P(24, 13, 5, 12, '#a07c54'); P(10, 25, 5, 5, '#a07c54'); P(17, 25, 5, 5, '#a07c54'); P(13, 8, 2, 2, '#ffd27a'); P(18, 8, 2, 2, '#ffd27a'); P(11, 17, 3, 2, '#8a6a44'); P(18, 20, 4, 2, '#8a6a44'); }
  else if (kind === 'salamandre') { P(6, 18, 18, 7, '#c8501e'); P(21, 13, 9, 7, '#d8622a'); P(1, 16, 6, 3, '#c8501e'); P(0, 13, 2, 3, '#ffb347'); P(8, 25, 3, 4, '#a03c14'); P(19, 25, 3, 4, '#a03c14'); P(26, 15, 2, 2, '#fff1a8'); for (let i = 0; i < 4; i++) P(8 + i * 4, 16, 2, 2, '#ffb347'); }
  else if (kind === 'spectre') { P(9, 6, 14, 18, '#8a93a0'); P(7, 12, 18, 12, '#737c8a'); for (let i = 0; i < 4; i++) P(7 + i * 5, 24, 3, 3 + i % 2 * 3, '#737c8a'); P(12, 10, 3, 4, '#7fd4ff'); P(18, 10, 3, 4, '#7fd4ff'); P(14, 17, 5, 2, '#2a2e36'); P(3, 14, 4, 2, '#737c8a'); P(25, 14, 4, 2, '#737c8a'); }
  else { P(6, 15, 20, 11, '#7a2a1e'); P(18, 7, 12, 9, '#963424'); P(26, 13, 6, 3, '#963424'); P(0, 20, 7, 4, '#7a2a1e'); P(2, 7, 11, 8, '#a8552a'); P(4, 5, 5, 3, '#c07040'); P(8, 26, 4, 4, '#5a1e14'); P(19, 26, 4, 4, '#5a1e14'); P(25, 9, 2, 2, '#ffd27a'); P(20, 5, 2, 3, '#e8e0c8'); P(24, 5, 2, 3, '#e8e0c8'); P(10, 18, 12, 6, '#ff8a2a'); P(12, 20, 8, 2, '#ffd27a'); }
}
function pxUnit(u) {
  const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d');
  const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  if (u.mon) { pxMonster(P, u.mon); return c; }
  const r = seeded(u.id * 7 + 3), [suit, dk, pants] = PX_FAM[u.f], skin = PX_SKIN[Math.floor(r() * 4)], hair = PX_HAIR[Math.floor(r() * 6)], style = Math.floor(r() * 5), beard = r() < 0.4;
  if (u.tier === 3) P(6, 16, 3, 12, '#6a2030');
  P(11, 24, 4, 4, pants); P(17, 24, 4, 4, pants); P(10, 28, 5, 2, '#3a2a1e'); P(17, 28, 5, 2, '#3a2a1e');
  P(10, 16, 12, 9, suit); P(10, 16, 2, 9, dk); P(10, 23, 12, 1, '#4a3420'); P(15, 17, 2, 6, dk);
  P(7, 17, 3, 7, suit); P(7, 24, 3, 2, skin[0]); P(22, 17, 3, 5, suit); P(23, 22, 3, 2, skin[0]);
  P(9, 6, 14, 10, skin[0]); P(9, 14, 14, 2, skin[1]); P(21, 7, 2, 8, skin[1]); P(14, 10, 2, 2, '#2a1c14'); P(19, 10, 2, 2, '#2a1c14'); P(17, 12, 2, 2, skin[1]);
  if (beard) { P(10, 13, 12, 4, hair); P(15, 13, 3, 1, skin[1]); }
  if (u.f === 'soudage') { P(9, 4, 14, 3, '#3a3d42'); P(10, 8, 12, 5, '#2a2e36'); P(12, 10, 8, 1, '#7fd4ff'); }
  else if (style === 1 || u.f === 'chantier') { P(8, 3, 16, 4, '#d9a02a'); P(6, 7, 20, 1, '#b8841e'); }
  else if (style === 0) { P(9, 3, 14, 4, hair); P(8, 5, 2, 8, hair); }
  else if (style === 2) { P(9, 3, 14, 4, hair); P(7, 5, 3, 14, hair); P(22, 5, 2, 6, hair); }
  else if (style === 3) { P(8, 7, 2, 5, hair); P(22, 7, 2, 5, hair); }
  else { P(8, 3, 16, 5, suit); P(8, 7, 16, 1, dk); }
  if (u.tier >= 2) { P(8, 15, 4, 2, '#d9b048'); P(20, 15, 4, 2, '#d9b048'); }
  if (u.tier === 3) { P(14, 19, 4, 2, '#f5d060'); }
  pxTool(P, u.f);
  return c;
}

let tqClient = null;
function stopTactique() { if (tqClient && tqClient !== 'loading') tqClient.stop(); tqClient = null; }

function updateTactique() {
  if (!view || !trackInfo || !trackInfo.tq || onlineKind !== 'tactique') return;
  if (view.finished) {
    if (document.getElementById('rewardBox')) return;
    stopTactique();
    resultScreen(view.finished.map((i, k) => { const p = view.p[i]; return `<li><b>${k + 1}</b><i style="background:${k ? '#8a8d91' : '#F5B700'}"></i><span>${esc(p.n)}${i === mySeat ? ' (toi)' : ''}</span><em>niveau ${p.lv}</em></li>`; }));
    return;
  }
  if (!tqClient) {
    tqClient = 'loading';
    stage.innerHTML = '<div class="screen"><p>Ouverture de l’atelier…</p></div>';
    loadThree().then(() => { if (tqClient === 'loading' && onlineKind === 'tactique') { tqClient = startTactiqueClient(); tqClient.push(view); } }).catch(e => { tqClient = null; toast(e.message); });
    return;
  }
  if (tqClient !== 'loading') tqClient.push(view);
}

function startTactiqueClient() {
  const W = 960, H = 540, D = trackInfo.tq, U = D.units, FAMS = Object.fromEntries(D.families.map(f => [f.id, f])), T = D.traits, IT = Object.fromEntries(D.items.map(i => [i.id, i]));
  const TIER = ['#a39a88', '#5a9ae8', '#b070f0', '#f5b700'];
  // attaque de chaque corps de métier : au corps à corps (lunge) ou à distance (forme du projectile)
  const ATK = {
    metal: { c: '#d8dde3' }, chaudro: { c: '#c87533', ring: 1 }, tuyau: { c: '#7fd4ff' }, prod: { c: '#ff6a6a' }, chantier: { c: '#f5c040' }, recyclage: { c: '#a8c060' },
    soudage: { c: '#7fd4ff', arc: 1 }, usinage: { c: '#e8ecf0', shot: 'balle' }, fonderie: { c: '#ff8a2a', shot: 'lob' }, surface: { c: '#c77dff', shot: 'spray' }, maint: { c: '#7FD48A', shot: 'balle' },
    bureau: { c: '#f5d060', shot: 'plan' }, qualite: { c: '#ffffff', beam: 1 }, commerce: { c: '#f5b700', shot: 'piece' }, monstre: { c: '#ff8a2a', shot: 'lob' },
  };
  stage.innerHTML = '';
  $('#hudInfo').textContent = 'Le dernier atelier debout gagne';
  const wasFull = fxIsFull();
  document.body.classList.add('ft-play');
  if (!wasFull) document.body.classList.add('pseudo-fs');
  fxPaintFsBtn();
  const wrap = document.createElement('div'); wrap.className = 'play-wrap'; stage.appendChild(wrap);
  const screen = document.createElement('div'); screen.className = 'tk-screen'; wrap.appendChild(screen);
  const { c: hud, g } = makeCanvas(screen, W, H); hud.classList.add('tk-hud'); hud.style.touchAction = 'none';
  const ui = document.createElement('div'); ui.className = 'ft'; ui.dataset.overlay = '1'; screen.appendChild(ui);

  /* ---------- scène ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.outputEncoding = THREE.sRGBEncoding;
  const canvas = renderer.domElement; canvas.className = 'tk-3d'; canvas.dataset.overlay = '1'; screen.insertBefore(canvas, hud);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#3a3028');
  const cam = new THREE.PerspectiveCamera(34, W / H, 0.5, 120);
  // caméra libre, comme sur Forgeopoly : glisser dans le vide pour tourner, molette pour zoomer
  const CAM0 = { yaw: 0, pitch: 1.12, dist: 16.4 };
  let yaw = CAM0.yaw, pitch = CAM0.pitch, dist = CAM0.dist, orbit = null;
  const placeCam = () => { cam.position.set(Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, 1.2 + Math.cos(yaw) * Math.cos(pitch) * dist); cam.lookAt(0, 0, 1.2); };
  const resetCam = () => { yaw = CAM0.yaw; pitch = CAM0.pitch; dist = CAM0.dist; };
  scene.add(new THREE.HemisphereLight('#fff8ec', '#8a6a4a', 1.5));
  const sun = new THREE.DirectionalLight('#fff0dc', 1.1); sun.position.set(-5, 12, 8); scene.add(sun);
  const M = (color, x) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...(x || {}) }); m.color.convertSRGBToLinear(); return m; };
  const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); scene.add(m); return m; };
  box(10.4, 0.5, 13.6, M('#5a4c40'), 0, -0.45, 0.9);
  const tileA = M('#d8c4a0'), tileB = M('#b8a07c'), foeA = M('#b88a80'), foeB = M('#9a6e66');
  for (let c = 0; c < 7; c++) for (let r = 0; r < 8; r++) box(0.96, 0.2, 0.96, r >= 4 ? ((c + r) % 2 ? tileA : tileB) : ((c + r) % 2 ? foeA : foeB), c - 3, -0.1, r - 3.5);
  for (let k = 0; k < 9; k++) box(0.92, 0.14, 0.92, M('#8a9aa8'), k - 4, -0.08, 5.15);
  const lava = M('#ff7a2a', { emissive: '#c8400c', emissiveIntensity: 1 }); [-5.1, 5.1].forEach(x => box(0.45, 0.2, 13, lava, x, -0.25, 0.9));
  const glow = new THREE.PointLight('#ff7a2a', 1.1, 22, 1.6); glow.position.set(0, 4, -7); scene.add(glow);
  const hoverTile = box(0.98, 0.04, 0.98, new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.4 }), 0, 0.03, 0); hoverTile.visible = false;

  /* figurines : un cube par pixel du dessin */
  const voxGeo = new THREE.BoxGeometry(1, 1, 1), voxMat = new THREE.MeshStandardMaterial({ roughness: 0.8 }), VS = 0.066;
  const sprites = {}, pxData = {}, urls = {};
  const sprite = id => sprites[id] || (sprites[id] = pxUnit(U[id]));
  const portrait = id => urls[id] || (urls[id] = sprite(id).toDataURL());
  const voxels = id => {
    if (pxData[id]) return pxData[id];
    const d = sprite(id).getContext('2d').getImageData(0, 0, 32, 32).data, out = [];
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const i = (y * 32 + x) * 4; if (d[i + 3] > 40) out.push([x, y, d[i] / 255, d[i + 1] / 255, d[i + 2] / 255]); }
    return pxData[id] = out;
  };
  const figure = (id, star) => {
    const px = voxels(id), m = new THREE.InstancedMesh(voxGeo, voxMat, px.length), mt = new THREE.Matrix4(), col = new THREE.Color(), s = VS * (star === 3 ? 1.32 : star === 2 ? 1.14 : 1);
    px.forEach(([x, y, r, gg, b], i) => { mt.makeScale(s, s, s * 2.2); mt.setPosition((x - 15.5) * s, (31.5 - y) * s, 0); m.setMatrixAt(i, mt); col.setRGB(r, gg, b).convertSRGBToLinear(); m.setColorAt(i, col); });
    const grp = new THREE.Group(); grp.add(m); m.rotation.x = -0.32; grp.userData = { m }; scene.add(grp); return grp;
  };
  const drop = o => { scene.remove(o); o.userData.m.dispose(); };

  /* ---------- état ---------- */
  let hoverSpot = null, cur = null, recvAt = 0, combatRound = 0, combatAt = 0, drag = null, selItem = null, info = null, seenHit = 0, floats = [], shots = [], lunges = {}, mouse = { x: 0, y: 0 }, fightKey = '';
  const shown = new Map(); let fightFig = [];
  const me = () => cur.p[mySeat], act = (a, o = {}) => send({ t: 'act', a, ...o });
  const worldOf = s => s[0] === 'b' ? [s[1] - 3, s[2] + 0.5] : [s[1] - 4, 5.15];
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  const toWorld = e => { const r = hud.getBoundingClientRect(); ray.setFromCamera({ x: (e.clientX - r.left) / r.width * 2 - 1, y: -((e.clientY - r.top) / r.height * 2 - 1) }, cam); return ray.ray.intersectPlane(plane, hit) ? [hit.x, hit.z] : null; };
  const cellOf = w => {
    if (!w) return null; const c = Math.round(w[0] + 3), r = Math.round(w[1] - 0.5), k = Math.round(w[0] + 4);
    if (c >= 0 && c < 7 && r >= 0 && r < 4) return ['b', c, r];
    if (Math.abs(w[1] - 5.15) < 0.6 && k >= 0 && k < 9) return ['s', k];
    return null;
  };
  const unitAt = s => { const p = me(); if (s[0] === 's') return p.bench[s[1]]; const b = p.board.find(u => u[0] === s[1] && u[1] === s[2]); return b ? [b[2], b[3], b[4]] : null; };

  function syncPrep() {
    const want = new Map();
    if (cur.phase === 'prep') {
      const p = me();
      p.board.forEach(b => want.set(`b${b[0]},${b[1]}:${b[2]}:${b[3]}`, { s: ['b', b[0], b[1]], id: b[2], star: b[3], it: b[4] }));
      p.bench.forEach((v, k) => { if (v) want.set(`s${k}:${v[0]}:${v[1]}`, { s: ['s', k], id: v[0], star: v[1], it: v[2] }); });
    }
    for (const [k, o] of shown) if (!want.has(k)) { drop(o.fig); shown.delete(k); }
    for (const [k, v] of want) { if (!shown.has(k)) { const fig = figure(v.id, v.star); shown.set(k, { ...v, fig }); } const o = shown.get(k); o.it = v.it; const [x, z] = worldOf(o.s); o.fig.position.set(x, 0, z); }
  }
  function clearFight() { fightFig.forEach(f => f && drop(f)); fightFig = []; fightKey = ''; }

  /* ---------- interface ---------- */
  const traitsNow = () => {
    const m = {}; me().board.forEach(b => U[b[2]].tr.forEach(t => (m[t] = m[t] || new Set()).add(b[2])));
    return Object.entries(m).map(([t, s]) => { const at = T[t].at, lv = at.filter(a => s.size >= a).length; return { t, n: s.size, lv, next: at[Math.min(lv, 2)] }; }).sort((a, b) => b.lv - a.lv || b.n - a.n);
  };
  const itemChip = (id, extra = '') => `<i class="ft-it" style="--c:${IT[id].c}" title="${esc(IT[id].n)} : ${esc(IT[id].d)}" ${extra}></i>`;
  const unitTip = (id, star, items) => {
    const u = U[id], f = FAMS[u.f];
    return `<b style="color:${TIER[u.tier]}">${esc(u.n)}${star > 1 ? ' ' + '★'.repeat(star) : ''}</b><small>${D.rarity[u.tier]}${u.cost ? ` · ${u.cost} or` : ' · monstre'}</small>
      <div class="ft-tags">${u.tr.map(t => `<span style="--c:${T[t].c}">${esc(T[t].n)}</span>`).join('')}</div>
      ${f ? `<p><b>${esc(f.atk)}</b> : ${esc(f.ad)}</p><p><b>${esc(f.spell)}</b> : ${esc(f.sd)}</p>` : ''}${items && items.length ? `<p>${items.map(i => esc(IT[i].n)).join(', ')}</p>` : ''}`;
  };
  function renderUI() {
    const p = me(), prep = cur.phase === 'prep', pve = D.pve.includes(cur.round);
    ui.innerHTML = `<div class="ft-cam">Glisser dans le vide : tourner · Molette : zoomer · C : recentrer</div><div class="ft-top"><b>Manche ${cur.round}</b><span>${pve ? 'Monstres · butin' : 'Duel'}</span><em id="ftTime"></em></div>
      <div class="ft-left">${traitsNow().map(t => `<div class="ft-tr ${t.lv ? 'on' : ''}" style="--c:${T[t.t].c}" data-tr="${t.t}"><i>${t.n}</i><span>${esc(T[t.t].n)}</span><small>${t.n}/${t.next}</small></div>`).join('')}</div>
      <div class="ft-right">${cur.p.map((q, i) => ({ ...q, i })).sort((a, b) => b.hp - a.hp).map(q => `<div class="ft-pl ${q.i === mySeat ? 'me' : ''} ${q.hp ? '' : 'out'}"><span>${esc(q.n)}</span><b>${q.hp}</b><u style="width:${q.hp}%"></u></div>`).join('')}</div>
      <div class="ft-info" id="ftInfo" hidden></div>
      <div class="ft-items">${p.items.map((id, i) => `<button class="ft-itb ${selItem === i ? 'on' : ''}" data-item="${i}" title="${esc(IT[id].n)} : ${esc(IT[id].d)}">${itemChip(id)}</button>`).join('')}</div>
      <div class="ft-bot">
        <div class="ft-eco"><b>${p.gold} or</b><small>Niveau ${p.lv} · ${p.board.length}/${p.lv}${p.lv < 9 ? ` · XP ${p.xp}/${D.xp[p.lv]}` : ''}</small>
          <button data-do="roll" ${prep && p.gold >= 2 ? '' : 'disabled'}>Actualiser · 2 or <kbd>R</kbd></button><button data-do="xp" ${prep && p.gold >= 4 && p.lv < 9 ? '' : 'disabled'}>XP · 4 or <kbd>X</kbd></button></div>
        <div class="ft-shop" id="ftShop">${p.shop.map((id, i) => id === null ? '<div class="ft-card off"></div>' : `<button class="ft-card" data-buy="${i}" data-u="${id}" style="--c:${TIER[U[id].tier]}" ${prep && p.gold >= U[id].cost ? '' : 'disabled'}><img src="${portrait(id)}" alt=""><b>${esc(U[id].n)}</b><small>${U[id].tr.map(t => esc(T[t].n)).join(' · ')}</small><em>${U[id].cost}</em><kbd>${i + 1}</kbd></button>`).join('')}</div>
        <button class="ft-ready" data-do="skip" ${p.ready ? 'disabled' : ''}>${prep ? (p.ready ? 'Prêt ✓' : 'Prêt') : 'Passer'}<kbd>Espace</kbd></button></div>
      ${prep && p.loot.length ? `<div class="ft-loot"><h4>Butin : choisis un objet</h4><div>${p.loot.map((id, i) => `<button data-loot="${i}">${itemChip(id)}<b>${esc(IT[id].n)}</b><small>${esc(IT[id].d)}</small><kbd>${i + 1}</kbd></button>`).join('')}</div></div>` : ''}
      ${selItem !== null ? '<div class="ft-hint">Clique maintenant une unité pour l’équiper</div>' : ''}${!p.hp ? '<div class="ft-hint">Atelier fermé : tu regardes la fin</div>' : ''}`;
  }
  const doBuy = i => { const id = me().shop[i]; if (cur.phase === 'prep' && id !== null && id !== undefined && me().gold >= U[id].cost) { act('buy', { i }); sfx(700, 0.06, 'triangle', 0.04); } };
  const doRoll = () => { if (cur.phase === 'prep' && me().gold >= 2) { act('roll'); SFX.tick(); } };
  const doXp = () => { if (cur.phase === 'prep' && me().gold >= 4 && me().lv < 9) { act('xp'); SFX.tick(); } };
  ui.addEventListener('pointerdown', e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    e.preventDefault();
    if (b.dataset.do === 'roll') doRoll();
    else if (b.dataset.do === 'xp') doXp();
    else if (b.dataset.do) { act(b.dataset.do); SFX.tick(); }
    else if (b.dataset.buy) doBuy(+b.dataset.buy);
    else if (b.dataset.loot) { act('loot', { i: +b.dataset.loot }); SFX.good(); }
    else if (b.dataset.item) { selItem = selItem === +b.dataset.item ? null : +b.dataset.item; renderUI(); }
  });
  // clavier, et boutons A, B, C de la borne
  const kd = e => {
    if (e.repeat || !cur || (e.target.matches && e.target.matches('input, textarea'))) return;
    const p = me(), c = e.code, n = /^(Digit|Numpad)([1-5])$/.exec(c);
    if (n) { e.preventDefault(); const i = +n[2] - 1; if (p.loot.length) { if (i < p.loot.length) { act('loot', { i }); SFX.good(); } } else doBuy(i); }
    else if (c === 'KeyR' || c === 'KeyK') { e.preventDefault(); doRoll(); }
    else if (c === 'KeyX' || c === 'KeyL') { e.preventDefault(); doXp(); }
    else if (c === 'Space' || c === 'KeyJ') { e.preventDefault(); act('skip'); SFX.tick(); }
    else if (c === 'KeyE' && hoverSpot && cur.phase === 'prep' && unitAt(hoverSpot)) { e.preventDefault(); act('sell', { b: hoverSpot }); sfx(300, 0.08, 'triangle', 0.04); }
    else if (c === 'KeyC') { e.preventDefault(); resetCam(); }
    else if (c === 'Escape' && selItem !== null) { e.stopPropagation(); selItem = null; renderUI(); }
  };
  window.addEventListener('keydown', kd, true);
  const showInfo = html => { const el = $('#ftInfo', ui); if (!el) return; el.hidden = !html; if (html) el.innerHTML = html; };
  ui.addEventListener('pointerover', e => {
    const c = e.target.closest('[data-u]'), t = e.target.closest('[data-tr]');
    if (c) showInfo(unitTip(+c.dataset.u, 1));
    else if (t) { const x = T[t.dataset.tr]; showInfo(`<b style="color:${x.c}">${esc(x.n)}</b><p>${esc(x.name)} : ${x.val.join(' / ')}</p><small>Paliers : ${x.at.join(', ')} unités différentes</small>`); }
  });
  ui.addEventListener('pointerout', e => { if (e.target.closest('[data-u],[data-tr]')) showInfo(''); });
  // on attrape une figurine là où elle se voit à l'écran, quel que soit l'angle de la caméra
  const pickUnit = e => {
    const r = hud.getBoundingClientRect(), mx = (e.clientX - r.left) / r.width * W, my = (e.clientY - r.top) / r.height * H, reach = 34 * 16.4 / dist;
    let best = null, bd = reach * reach;
    shown.forEach(o => { const [x, z] = worldOf(o.s), [sx, sy] = project(x, 0.9, z), d = (sx - mx) ** 2 + ((sy - my) * 0.7) ** 2; if (d < bd) { bd = d; best = o.s; } });
    return best;
  };
  hud.addEventListener('pointerdown', e => {
    if (!cur) return;
    try { hud.setPointerCapture(e.pointerId); } catch (_) {}
    const s = cur.phase === 'prep' && me().hp ? pickUnit(e) : null, u = s && unitAt(s);
    if (!u) { orbit = { x: e.clientX, y: e.clientY }; return; }     // dans le vide : on tourne autour du plateau
    if (selItem !== null) { act('equip', { i: selItem, b: s }); selItem = null; sfx(880, 0.08, 'triangle', 0.04); return; }
    drag = { s, u };
  });
  hud.addEventListener('wheel', e => { e.preventDefault(); dist = Math.max(9, Math.min(26, dist * (1 + Math.sign(e.deltaY) * 0.08))); }, { passive: false });
  hud.addEventListener('dblclick', resetCam);
  hud.addEventListener('pointermove', e => {
    if (!cur) return;
    if (orbit) { yaw -= (e.clientX - orbit.x) * 0.006; pitch = Math.max(0.4, Math.min(1.45, pitch + (e.clientY - orbit.y) * 0.004)); orbit = { x: e.clientX, y: e.clientY }; return; }
    const r = hud.getBoundingClientRect(); mouse = { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
    const w = toWorld(e); if (w) mouse.w = w; const s = cellOf(w); hoverSpot = (cur.phase === 'prep' && pickUnit(e)) || s;
    hoverTile.visible = !!(drag && s); if (s) { const [x, z] = worldOf(s); hoverTile.position.x = x; hoverTile.position.z = z; }
    if (!drag && cur.phase === 'prep') { const u = hoverSpot && unitAt(hoverSpot); showInfo(u ? unitTip(u[0], u[1], u[2]) : ''); hud.style.cursor = u ? 'grab' : 'move'; }
  });
  hud.addEventListener('pointerup', e => {
    orbit = null;
    if (!drag) return; const t = cellOf(toWorld(e)), r = hud.getBoundingClientRect(), y = (e.clientY - r.top) / r.height;
    if (y > 0.78 && !t) { act('sell', { b: drag.s }); sfx(300, 0.08, 'triangle', 0.04); }
    else if (t && t.join() !== drag.s.join()) { if (t[0] === 'b' && drag.s[0] === 's' && !unitAt(t) && me().board.length >= me().lv) toast(`Niveau ${me().lv} : ${me().lv} unités au maximum.`); else act('move', { a2: drag.s, b: t }); }
    drag = null; hoverTile.visible = false; syncPrep();
  });
  function push(v) {
    if (v.phase === 'combat' && combatRound !== v.round) { combatRound = v.round; combatAt = performance.now(); seenHit = 0; floats = []; shots = []; lunges = {}; drag = null; selItem = null; clearFight(); sfx(330, 0.2, 'square', 0.05); }
    if (v.phase === 'prep') clearFight();
    if (cur && selItem !== null && selItem >= v.p[mySeat].items.length) selItem = null;
    cur = v; recvAt = performance.now(); syncPrep(); renderUI();
  }

  /* ---------- rendu ---------- */
  const v3 = new THREE.Vector3();
  const project = (x, y, z) => { v3.set(x, y, z).project(cam); return [Math.round((v3.x + 1) / 2 * W), Math.round((1 - v3.y) / 2 * H)]; };
  const bar = (x, y, w, h, k, col) => { g.fillStyle = '#000'; g.fillRect(x - w / 2 - 1, y - 1, w + 2, h + 2); g.fillStyle = col; g.fillRect(x - w / 2, y, w * Math.max(0, k), h); };
  const myFight = () => cur.fights.find(f => f.a === mySeat || f.b === mySeat) || cur.fights[0];
  function drawCombat(f, now) {
    if (fightKey !== cur.round + ':' + f.a) { clearFight(); fightKey = cur.round + ':' + f.a; fightFig = f.units.map(u => figure(u[0], u[1])); }
    const t = (now - combatAt) / 1000, last = f.frames.length - 1, fa = Math.min(last, Math.floor(t / D.frame)), over = t >= f.dur, flip = f.b === mySeat, mine = flip ? 1 : 0;
    const A = over ? f.frames[last] : f.frames[Math.min(fa, last - 1)] || f.frames[last], B = over ? A : f.frames[Math.min(fa + 1, last)];
    // la dernière image tombe à la fin exacte du combat, pas forcément au bout d'un intervalle régulier
    const span = !over && fa + 1 >= last ? Math.max(0.05, f.dur - fa * D.frame) : D.frame, k = over ? 0 : Math.min(1, (t - fa * D.frame) / span);
    const pos = i => { const o = i * 4, x = (A[o] + (B[o] - A[o]) * k) / 10, y = (A[o + 1] + (B[o + 1] - A[o + 1]) * k) / 10; return flip ? [3 - x, y - 3.5] : [x - 3, 3.5 - y]; };
    f.units.forEach((u, i) => {
      const o = i * 4, fig = fightFig[i], [x, z] = pos(i), dying = A[o + 2] > 0 && B[o + 2] === 0, hp = A[o + 2] + (B[o + 2] - A[o + 2]) * k;
      if (fig.visible && (hp <= 0 || (dying && k > 0.5))) { fig.visible = false; const c = project(x, 0.9, z); shots.push({ type: 'ring', S: c, E: c, c: '#ffd27a', at: now, dur: 320 }); }
      if (!fig.visible) return;
      const L = lunges[i]; let dx = 0, dz = 0;
      if (L) { const a = (now - L.at) / 180; if (a < 1) { const s = Math.sin(a * Math.PI) * 0.4; dx = L.dx * s; dz = L.dz * s; } else delete lunges[i]; }
      fig.position.set(x + dx, 0.03 + Math.abs(Math.sin(now / 130 + i)) * 0.04, z + dz);
      const [sx, sy] = project(x, 2.3, z);
      bar(sx, sy, 38, 4, hp / 100, u[2] === mine ? '#7FD48A' : '#ff5a5a'); bar(sx, sy + 5, 38, 2, A[o + 3] / 100, '#5AA8FF');
    });
    const tick = t / D.tick;
    while (seenHit < f.hits.length && f.hits[seenHit][0] <= tick) {
      const [, a, b, dmg, kind] = f.hits[seenHit++], [ax, az] = pos(a), [bx, bz] = pos(b), u = U[f.units[a][0]], st = ATK[u.f] || ATK.monstre, d = Math.hypot(bx - ax, bz - az) || 1;
      const S = project(ax, 0.9, az), E = project(bx, 0.9, bz), col = kind === 5 ? '#7FD48A' : kind === 4 ? '#7fd4ff' : st.c;
      if (kind === 6 || st.arc) shots.push({ type: 'arc', S, E, c: '#7fd4ff', at: now, dur: 170 });
      else if (kind >= 2) shots.push({ type: kind === 3 ? 'ring' : kind === 5 || kind === 4 ? 'pillar' : 'bolt', S, E, c: col, at: now, dur: 380 });
      else if (st.beam) shots.push({ type: 'beam', S, E, c: st.c, at: now, dur: 150 });
      else if (st.shot) shots.push({ type: st.shot, S, E, c: st.c, at: now, dur: 260 });
      else { lunges[a] = { dx: (bx - ax) / d, dz: (bz - az) / d, at: now }; shots.push({ type: st.ring ? 'ring' : 'slash', S: E, E, c: st.c, at: now, dur: 150 }); }
      if (dmg) floats.push({ S: E, t: kind === 5 ? `+${dmg}` : `${dmg}`, c: kind === 5 ? '#7FD48A' : kind === 1 ? '#ffd27a' : kind >= 2 ? '#ffb347' : '#fff', at: now, big: kind === 1 || kind === 2 || kind === 3 });
      if (kind >= 2) sfx(kind === 5 ? 880 : 220, 0.06, 'square', 0.02); else if (Math.random() < 0.3) sfx(st.shot ? 500 : 160, 0.03, 'square', 0.012);
    }
    const P = (x, y, s, c) => { g.fillStyle = c; g.fillRect(Math.round(x / 3) * 3, Math.round(y / 3) * 3, s, s); };
    shots = shots.filter(s => now - s.at < s.dur);
    shots.forEach(s => {
      const a = (now - s.at) / s.dur, x = s.S[0] + (s.E[0] - s.S[0]) * a, y = s.S[1] + (s.E[1] - s.S[1]) * a;
      if (s.type === 'balle') { P(x, y, 6, s.c); P(x - (s.E[0] - s.S[0]) * 0.05, y - (s.E[1] - s.S[1]) * 0.05, 3, s.c); }
      else if (s.type === 'lob') { const yy = y - Math.sin(a * Math.PI) * 60; P(x, yy, 9, s.c); P(x + 3, yy + 3, 3, '#ffd27a'); }
      else if (s.type === 'spray') for (let i = 0; i < 7; i++) P(x + (i * 37 % 26) - 13, y + (i * 53 % 22) - 11, 3, s.c);
      else if (s.type === 'plan') { P(x, y, 9, '#f2eadc'); P(x + 3, y + 3, 3, '#3f7fd8'); }
      else if (s.type === 'piece') { P(x, y, 6, s.c); P(x + 3, y, 3, '#fff1a8'); }
      else if (s.type === 'beam') { g.strokeStyle = s.c; g.lineWidth = 3; g.beginPath(); g.moveTo(...s.S); g.lineTo(...s.E); g.stroke(); }
      else if (s.type === 'arc') { g.strokeStyle = s.c; g.lineWidth = 3; g.beginPath(); g.moveTo(...s.S); for (let i = 1; i < 6; i++) g.lineTo(s.S[0] + (s.E[0] - s.S[0]) * i / 6 + (i % 2 ? 10 : -10), s.S[1] + (s.E[1] - s.S[1]) * i / 6 + (i * 7 % 13) - 6); g.lineTo(...s.E); g.stroke(); }
      else if (s.type === 'slash') for (let i = -2; i <= 2; i++) P(s.E[0] + i * 7 * (1 + a), s.E[1] - 20 - i * 6 * (1 + a), 4, s.c);
      else if (s.type === 'ring') for (let i = 0; i < 14; i++) { const an = i / 14 * 6.283, r = 10 + a * 44; P(s.E[0] + Math.cos(an) * r, s.E[1] - 12 + Math.sin(an) * r * 0.55, 4, s.c); }
      else if (s.type === 'pillar') for (let i = 0; i < 9; i++) P(s.E[0] + (i * 41 % 26) - 13, s.E[1] + 10 - ((a * 60 + i * 11) % 60), 4, s.c);
      else { P(x, y, 12, s.c); P(x + 3, y + 3, 6, '#fff'); }
    });
    floats = floats.filter(p => now - p.at < 700);
    floats.forEach(p => { const a = (now - p.at) / 700; g.globalAlpha = 1 - a; g.font = `400 ${p.big ? 12 : 9}px "Press Start 2P", monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 3; g.strokeStyle = '#000'; g.fillStyle = p.c; g.strokeText(p.t, p.S[0], p.S[1] - 26 - a * 22); g.fillText(p.t, p.S[0], p.S[1] - 26 - a * 22); g.globalAlpha = 1; });
    if (over && (f.a === mySeat || f.b === mySeat)) { const won = f.win === 2 ? null : (f.win === 0) === (f.a === mySeat); bigText(g, won === null ? 'ÉGALITÉ' : won ? (f.b < 0 ? 'BUTIN !' : 'VICTOIRE') : `DÉFAITE  -${f.dmg}`, W / 2, H * 0.34, 36, won === null ? '#fff' : won ? '#7FD48A' : '#ff5a5a'); }
  }
  let lastW = 0, lastH = 0;
  const stop = loop(() => {
    if (!cur) return;
    const now = performance.now(), cw = hud.clientWidth, ch = hud.clientHeight;
    if (cw && (cw !== lastW || ch !== lastH)) { lastW = cw; lastH = ch; renderer.setSize(cw, ch, false); canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px'; cam.aspect = cw / ch; cam.setViewOffset(cw, ch, 0, ch * 0.18, cw, ch); cam.updateProjectionMatrix(); }
    g.clearRect(0, 0, W, H);
    placeCam();
    // les figurines restent tournées vers la caméra
    const face = o => { o.rotation.y = yaw; o.userData.m.rotation.x = 0.68 - pitch; };
    shown.forEach(o => face(o.fig)); fightFig.forEach(face);
    lava.emissiveIntensity = 0.9 + Math.sin(now / 400) * 0.25; glow.intensity = 1.1 + Math.sin(now / 170) * 0.15;
    const f = cur.phase === 'combat' ? myFight() : null;
    if (f) drawCombat(f, now);
    if (cur.phase === 'prep') shown.forEach(o => {
      const dragged = drag && drag.s.join() === o.s.join();
      if (dragged && mouse.w) o.fig.position.set(mouse.w[0], 0.4, mouse.w[1]);
      else { const [x, z] = worldOf(o.s); o.fig.position.y = Math.abs(Math.sin(now / 420 + x * 2)) * 0.03; const [sx, sy] = project(x, 2.25, z); if (o.star > 1) { g.font = '400 8px "Press Start 2P", monospace'; g.textAlign = 'center'; g.fillStyle = o.star === 3 ? '#ffd27a' : '#fff'; g.fillText('★'.repeat(o.star), sx, sy); } o.it.forEach((id, i) => { g.fillStyle = IT[id].c; g.fillRect(sx - 10 + i * 8, sy + 4, 6, 6); }); }
    });
    const left = Math.max(0, Math.ceil(cur.left - (now - recvAt) / 1000)), el = $('#ftTime', ui); if (el && el.textContent !== `${left} s`) el.textContent = `${left} s`;
    renderer.render(scene, cam);
  });
  return { push, stop() { stop(); window.removeEventListener('keydown', kd, true); document.body.classList.remove('ft-play'); if (!wasFull) document.body.classList.remove('pseudo-fs'); fxPaintFsBtn(); clearFight(); shown.forEach(o => drop(o.fig)); renderer.dispose(); scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); } };
}
