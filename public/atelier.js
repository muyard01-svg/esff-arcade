/* L'Atelier de Coulée — coopération en ligne façon « cuisine en équipe », dans une fonderie à ligne Disamatic
   (serveur : atelier.py). Presse DISA, chaîne de mottes sur convoyeur, coulée au passage, tambour de décochage,
   four à induction qui peut prendre feu, comptoirs où poser n'importe quoi, meuleuse et expédition.
   Vue d'ensemble, 3e personne ou 1re personne (V) ; un guidage façon GPS montre le prochain poste (H pour le masquer). */
'use strict';

ONLINE.push({
  id: 'atelier', title: 'L’Atelier de Coulée', tone: '#F5B700', label: 'Coopération · 1 à 4 ouvriers', tag: 'COOP 1-4',
  pitch: 'Une fonderie à ligne Disamatic en plein coup de feu : remplissez la trémie, posez les noyaux, pressez les mottes, coulez-les au vol sur le convoyeur, décochez, ébarbez et expédiez avant la fin du poste. Petite série (grosses pièces) ou grande série (petites pièces) : à vous de choisir. Et gare au four qui s’emballe !',
  how: '<b>ZQSD / flèches</b> se déplacer · <b>V</b> vue d’ensemble / 3e / 1re personne (clic = souris pour tourner) · <b>Maj</b> ruée · <b>E</b> prendre / poser · <b>Espace maintenu</b> travailler (presser, tirer un noyau, couler, ébarber) · <b>H</b> masquer le guidage. Une flèche dorée et un chemin lumineux montrent toujours le prochain poste.',
});
HANDLERS.atelier = () => updateAtelier();

const AT_MODES = {
  grande: { name: 'Grande série', desc: 'Petites pièces (brides, raccords) : préparation rapide, beaucoup de commandes.' },
  petite: { name: 'Petite série', desc: 'Grosses pièces (collecteurs, blocs moteurs) : plus de noyaux, plus de fonte, plus de points.' },
};
function renderAtelierModePick(box) {
  if (!AT_MODES[save.atMode]) save.atMode = 'grande';
  box.innerHTML = Object.entries(AT_MODES).map(([id, m]) => `<button type="button" data-map="${id}" class="ry-map ${id === save.atMode ? 'on' : ''}"><b>${m.name}</b><small>${m.desc}</small></button>`).join('');
  box.querySelectorAll('[data-map]').forEach(b => b.addEventListener('click', () => {
    save.atMode = b.dataset.map; persist();
    box.querySelectorAll('[data-map]').forEach(x => x.classList.toggle('on', x === b)); SFX.tick();
  }));
}

let atClient = null;
function stopAtelier() { if (atClient && atClient !== 'loading') atClient.stop(); atClient = null; }

function updateAtelier() {
  if (!trackInfo || !trackInfo.stations || !view || onlineKind !== 'atelier') return;
  if (view.finished) {
    if (atClient && atClient !== 'loading' && !atClient.endShown) { atClient.push(view); atClient.endShown = true; setTimeout(() => updateAtelier(), 3500); return; }
    if (document.getElementById('rewardBox')) return;
    stopAtelier();
    const stars = trackInfo.stars.filter(s => view.score >= s).length;
    resultScreen([`<li><b>${'★'.repeat(stars) || '–'}</b><i style="background:${stars >= 2 ? '#7FD48A' : '#EC641E'}"></i><span>Équipe · ${trackInfo.mode.name} · ${view.done} pièce${view.done > 1 ? 's' : ''} expédiée${view.done > 1 ? 's' : ''}</span><em>${view.score} pts</em></li>`,
      ...view.p.map(p => `<li><b>·</b><i style="background:${(RY_METIERS[p.m] || RY_METIERS.fondeur).color}"></i><span>${esc(p.n)}${p.b ? ' · apprenti' : ''}</span><em>${(RY_METIERS[p.m] || RY_METIERS.fondeur).name}</em></li>`)]);
    return;
  }
  if (!atClient) {
    atClient = 'loading';
    stage.innerHTML = '<div class="screen"><p>Démarrage de la ligne DISA…</p></div>';
    loadThree().then(() => { if (atClient === 'loading' && onlineKind === 'atelier') { atClient = startAtelierClient(); atClient.push(view); } })
      .catch(e => { atClient = null; toast(e.message); });
    return;
  }
  if (atClient !== 'loading') atClient.push(view);
}

function startAtelierClient() {
  const W = 960, H = 540;
  const GR = trackInfo.grid, TT = GR.tile, HW = GR.cols * TT, HH = GR.rows * TT, PR = trackInfo.pr;
  const ST = trackInfo.stations, DEF = trackInfo.defects, PARTS = trackInfo.parts, BELT = trackInfo.belt, MODE = trackInfo.mode;
  const BIG = MODE.big ? 1.3 : 1;
  stage.innerHTML = '';
  $('#hudInfo').textContent = `Ligne Disamatic · ${MODE.name}`;
  const wrap = document.createElement('div'); wrap.className = 'play-wrap'; stage.appendChild(wrap);
  const screen = document.createElement('div'); screen.className = 'tk-screen'; wrap.appendChild(screen);
  const { c: hud, g } = makeCanvas(screen, W, H);
  hud.classList.add('tk-hud');
  const pad = document.createElement('div'); pad.className = 'touch-pad';
  pad.innerHTML = `<div class="grp"><button data-d="l">◀</button><button data-d="u">▲</button><button data-d="d">▼</button><button data-d="r">▶</button></div>
    <div class="grp"><button data-b="view">VUE</button><button data-b="dash">RUÉE</button><button data-b="use" class="warm">E</button><button data-b="work" class="hot">TRAVAIL</button></div>`;
  wrap.appendChild(pad);
  const hint = document.createElement('p'); hint.className = 'keys-hint';
  hint.textContent = 'ZQSD / FLÈCHES BOUGER · V CHANGER DE VUE · CLIC SOURIS POUR TOURNER · MAJ RUÉE · E PRENDRE / POSER · ESPACE MAINTENU TRAVAILLER · H GUIDAGE';
  wrap.appendChild(hint);
  const center = s => [s.tx * TT + TT / 2, s.ty * TT + TT / 2];
  const stOf = k => ST.find(s => s.k === k);
  const stAt = (tx, ty) => ST.find(s => s.tx === tx && s.ty === ty);
  const partName = t => PARTS[t] || 'Pièce sans commande';

  /* ---------- entrées ---------- */
  const held = new Set();
  let work = false, lastSend = 0, dashT = 0, dashCd = 0, guide = true;
  const VIEWS = ['3e', '1re', 'ensemble'];
  let camMode = VIEWS.includes(save.atView) ? save.atView : '3e', yaw = -Math.PI / 2, camYaw = -Math.PI / 2;
  const KEY = { KeyW: 'u', KeyZ: 'u', ArrowUp: 'u', KeyS: 'd', ArrowDown: 'd', KeyA: 'l', KeyQ: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
  const use = () => send({ t: 'act', a: 'use' });
  const dash = () => { if (dashCd <= 0) { dashT = 0.16; dashCd = 0.6; sfx(260, 0.08, 'triangle', 0.03, 300); } };
  const cycleView = () => {
    camMode = VIEWS[(VIEWS.indexOf(camMode) + 1) % VIEWS.length]; save.atView = camMode; persist();
    if (camMode === 'ensemble' && document.pointerLockElement) document.exitPointerLock();
    toast(camMode === 'ensemble' ? 'Vue d’ensemble' : `Vue à la ${camMode} personne`);
  };
  const kd = e => {
    if (e.code === 'KeyE' && !e.repeat) { e.preventDefault(); use(); return; }
    if (e.code === 'KeyV' && !e.repeat) { e.preventDefault(); cycleView(); return; }
    if (e.code === 'KeyH' && !e.repeat) { e.preventDefault(); guide = !guide; toast(guide ? 'Guidage affiché' : 'Guidage masqué'); return; }
    if (e.code === 'Space') { e.preventDefault(); work = true; return; }
    if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) { e.preventDefault(); dash(); return; }
    const k = KEY[e.code]; if (k) { e.preventDefault(); held.add(k); }
  };
  const ku = e => { if (e.code === 'Space') work = false; const k = KEY[e.code]; if (k) held.delete(k); };
  const mm = e => { if (document.pointerLockElement === hud && camMode !== 'ensemble') yaw += e.movementX * 0.0035; };
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); document.addEventListener('mousemove', mm);
  hud.addEventListener('click', () => { if (camMode !== 'ensemble' && hud.requestPointerLock) hud.requestPointerLock(); });
  const blur = () => { held.clear(); work = false; }; window.addEventListener('blur', blur);
  pad.querySelectorAll('[data-d]').forEach(b => {
    b.addEventListener('pointerdown', e => { e.preventDefault(); held.add(b.dataset.d); b.classList.add('on'); });
    const up = () => { held.delete(b.dataset.d); b.classList.remove('on'); };
    b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
  });
  pad.querySelector('[data-b="use"]').addEventListener('pointerdown', e => { e.preventDefault(); use(); });
  pad.querySelector('[data-b="dash"]').addEventListener('pointerdown', e => { e.preventDefault(); dash(); });
  pad.querySelector('[data-b="view"]').addEventListener('pointerdown', e => { e.preventDefault(); cycleView(); });
  const wb = pad.querySelector('[data-b="work"]');
  wb.addEventListener('pointerdown', e => { e.preventDefault(); work = true; wb.classList.add('on'); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => wb.addEventListener(ev, () => { work = false; wb.classList.remove('on'); }));

  /* ---------- mon ouvrier (prédit ici, vérifié par le serveur) ---------- */
  const me = { x: 0, y: 0, a: 0, tp: -1 };
  const solid = new Set(ST.map(s => s.tx + ',' + s.ty));
  const blocked = (x, y) => {
    if (x < PR || y < PR || x > HW - PR || y > HH - PR) return true;
    for (const s of ST) {
      const nx = Math.min(Math.max(x, s.tx * TT + 4), s.tx * TT + TT - 4), ny = Math.min(Math.max(y, s.ty * TT + 4), s.ty * TT + TT - 4);
      if ((x - nx) ** 2 + (y - ny) ** 2 < PR * PR) return true;
    }
    return false;
  };

  /* ---------- scène ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputEncoding = THREE.sRGBEncoding;
  const canvas = renderer.domElement; canvas.className = 'tk-3d'; canvas.dataset.overlay = '1';
  screen.insertBefore(canvas, hud);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1c130e');
  scene.fog = new THREE.Fog('#1c130e', 1400, 3200);
  const cam = new THREE.PerspectiveCamera(40, W / H, 5, 6000);
  scene.add(new THREE.HemisphereLight('#fff4e0', '#4a2a14', 0.95));
  const sun = new THREE.DirectionalLight('#fff0dc', 0.55); sun.position.set(-400, 1200, 700); scene.add(sun);
  const M = (color, extra) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1, ...(extra || {}) }); m.color.convertSRGBToLinear(); if (m.emissive) m.emissive.convertSRGBToLinear(); return m; };
  const Glow = (color, op = 0.8) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
  const add = (geo, mat, x, y, z, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  const steel = M('#5c6067', { metalness: 0.7, roughness: 0.35 }), chrome = M('#d8dde3', { metalness: 0.95, roughness: 0.15 }), dark = M('#26292d', { metalness: 0.5 });
  const disaGreen = M('#2f7a4f', { metalness: 0.35, roughness: 0.45 }), yellow = M('#F5B700', { roughness: 0.5 });

  // sol, zone de coulée balisée, murs et charpente
  const floorTex = tkTexture(512, 320, (b, w, h) => {
    const cs = w / GR.cols;
    for (let x = 0; x < GR.cols; x++) for (let y = 0; y < GR.rows; y++) { b.fillStyle = (x + y) % 2 ? '#5a524c' : '#4e4741'; b.fillRect(x * cs, y * cs, cs, cs); }
    b.strokeStyle = 'rgba(0,0,0,.25)'; b.lineWidth = 1; for (let x = 0; x <= GR.cols; x++) { b.beginPath(); b.moveTo(x * cs, 0); b.lineTo(x * cs, h); b.stroke(); } for (let y = 0; y <= GR.rows; y++) { b.beginPath(); b.moveTo(0, y * cs); b.lineTo(w, y * cs); b.stroke(); }
    const px0 = BELT.pour[0] / TT * cs, px1 = BELT.pour[1] / TT * cs, py = (BELT.y + 1) * cs;
    b.fillStyle = 'rgba(245,183,0,.35)'; b.fillRect(px0, py, px1 - px0, cs);
    b.fillStyle = '#1a1a1a'; for (let x = px0; x < px1; x += 16) { b.beginPath(); b.moveTo(x, py); b.lineTo(x + 8, py); b.lineTo(x, py + 8); b.fill(); }
    b.fillStyle = 'rgba(255,255,255,.75)'; b.font = '900 13px "Big Shoulders Display", Impact'; b.textAlign = 'center'; b.fillText('ZONE DE COULÉE', (px0 + px1) / 2, py + cs * 0.62);
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HW + 400, HH + 400), new THREE.MeshStandardMaterial({ color: '#2a2420', roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(HW / 2, -1, HH / 2); scene.add(floor);
  const tiles = new THREE.Mesh(new THREE.PlaneGeometry(HW, HH), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9 }));
  tiles.rotation.x = -Math.PI / 2; tiles.position.set(HW / 2, 0, HH / 2); scene.add(tiles);
  const wallM = M('#7a3a2a');
  [[HW / 2, -30, HW + 120, 60], [-30, HH / 2, 60, HH], [HW + 30, HH / 2, 60, HH]].forEach(([x, z, w, d]) => add(new THREE.BoxGeometry(w, 420, d), wallM, x, 210, z));
  const frontParts = [add(new THREE.BoxGeometry(HW + 120, 420, 60), wallM, HW / 2, 210, HH + 30)];
  for (let x = 0; x <= HW; x += 400) { add(new THREE.BoxGeometry(24, 520, 24), dark, x, 260, -6); frontParts.push(add(new THREE.BoxGeometry(24, 520, 24), dark, x, 260, HH + 6)); }
  add(new THREE.BoxGeometry(HW + 60, 20, 30), yellow, HW / 2, 500, -6); frontParts.push(add(new THREE.BoxGeometry(HW + 60, 20, 30), yellow, HW / 2, 500, HH + 6));
  // pont roulant de la halle (décor qui se promène)
  const gantry = new THREE.Group(); scene.add(gantry);
  add(new THREE.BoxGeometry(40, 30, HH + 20), yellow, 0, 490, HH / 2, gantry);
  add(new THREE.BoxGeometry(70, 40, 70), dark, 0, 465, HH / 2, gantry);
  add(new THREE.CylinderGeometry(2, 2, 200, 6), steel, 0, 345, HH / 2, gantry);
  const hook = add(new THREE.TorusGeometry(14, 4, 6, 12, Math.PI * 1.4), steel, 0, 240, HH / 2, gantry);

  /* ---------- postes : de vraies machines ---------- */
  const obj = { rollers: [] };
  const counterTop = M('#c9ccd1', { metalness: 0.6, roughness: 0.35 }), counterBody = M('#3a5f8a');
  const counter = (x, z, top = counterTop, body = counterBody) => { add(new THREE.BoxGeometry(94, 56, 94), body, x, 28, z); add(new THREE.BoxGeometry(98, 6, 98), top, x, 59, z); };
  const crate = (x, z, col) => { counter(x, z, M('#6b4c2c'), M('#4a3420')); add(new THREE.BoxGeometry(70, 26, 70), M(col), x, 76, z); };
  const beacon = (x, y, z) => { const b = add(new THREE.CylinderGeometry(7, 7, 12, 10), Glow('#ff8a2a', 0.9), x, y, z); const l = new THREE.PointLight('#ff8a2a', 0, 260, 2); l.position.set(x, y + 10, z); scene.add(l); return { b, l }; };
  ST.forEach(s => {
    const [x, z] = center(s);
    switch (s.k) {
      case 'comptoir': counter(x, z); break;
      case 'sable': crate(x, z, '#c49a64'); add(new THREE.ConeGeometry(32, 30, 12), M('#d4aa74', { roughness: 1 }), x, 104, z); break;
      case 'ferraille': crate(x, z, '#5c6067'); for (let k = 0; k < 7; k++) add(new THREE.BoxGeometry(34, 8, 10), M('#8a8d91', { metalness: 0.7 }), x - 14 + (k % 3) * 14, 94 + Math.floor(k / 3) * 9, z - 10 + k * 4).rotation.y = k; break;
      case 'alliage': crate(x, z, '#9aa0a6'); for (let k = 0; k < 5; k++) add(new THREE.DodecahedronGeometry(9), M('#d8dde3', { metalness: 0.8, roughness: 0.2 }), x - 12 + (k % 2) * 24, 96 + (k > 3 ? 12 : 0), z - 10 + Math.floor(k / 2) * 12); break;
      case 'noyauteuse': {   // machine à tirer les noyaux : tête de soufflage qui descend sur la boîte à noyaux
        add(new THREE.BoxGeometry(90, 60, 90), dark, x, 30, z);
        [-38, 38].forEach(d => add(new THREE.BoxGeometry(10, 200, 10), yellow, x + d, 100, z - 36));
        add(new THREE.BoxGeometry(96, 24, 30), yellow, x, 205, z - 36);
        obj.coreHead = add(new THREE.BoxGeometry(70, 34, 70), steel, x, 150, z);
        add(new THREE.CylinderGeometry(24, 12, 50, 12), M('#c49a64'), x, 240, z - 10);
        add(new THREE.BoxGeometry(70, 22, 70), M('#8a8d91', { metalness: 0.6 }), x, 72, z);
        obj.coreOut = add(new THREE.CylinderGeometry(9, 9, 40, 12), M('#e2d2a8'), x, 92, z); obj.coreOut.rotation.z = Math.PI / 2;
        break;
      }
      case 'expedition': counter(x, z, M('#7FD48A'), M('#2b6cb0')); add(new THREE.BoxGeometry(60, 18, 70), M('#8b5a2b'), x - 10, 70, z); add(new THREE.BoxGeometry(14, 160, 14), yellow, x - 40, 80, z - 40); break;
      case 'tremie': {     // silo à sable au-dessus de la trémie, avec sa goulotte
        add(new THREE.BoxGeometry(80, 110, 80), disaGreen, x, 55, z);
        const fun = add(new THREE.CylinderGeometry(52, 22, 70, 4, 1, true), M('#2f7a4f', { metalness: 0.4, side: THREE.DoubleSide }), x, 145, z); fun.rotation.y = Math.PI / 4;
        obj.hopperSand = add(new THREE.CylinderGeometry(44, 20, 4, 4), M('#c49a64'), x, 125, z); obj.hopperSand.rotation.y = Math.PI / 4;
        add(new THREE.CylinderGeometry(55, 55, 160, 18), M('#9aa0a6', { metalness: 0.6 }), x - 20, 330, z - 30);
        add(new THREE.ConeGeometry(55, 60, 18), M('#9aa0a6', { metalness: 0.6 }), x - 20, 220, z - 30).rotation.x = Math.PI;
        add(new THREE.CylinderGeometry(8, 8, 120, 8), steel, x + 10, 230, z + 30).rotation.z = 0.5;
        break;
      }
      case 'disa': {       // la Disamatic : chambre de serrage, vérins, plaque pivotante, pupitre et gyrophare
        add(new THREE.BoxGeometry(100, 40, 100), dark, x, 20, z);
        add(new THREE.BoxGeometry(100, 190, 96), disaGreen, x - 4, 135, z);
        add(new THREE.BoxGeometry(110, 24, 106), yellow, x - 4, 240, z);
        obj.cyl = [-28, 28].map(d => { add(new THREE.CylinderGeometry(14, 14, 90, 14), disaGreen, x - 70, 150 + d * 1.2, z + d).rotation.z = Math.PI / 2; const rod = add(new THREE.CylinderGeometry(6, 6, 90, 10), chrome, x - 20, 150 + d * 1.2, z + d); rod.rotation.z = Math.PI / 2; return rod; });
        obj.ram = add(new THREE.BoxGeometry(14, 90, 86), chrome, x + 44, 80, z);
        obj.swing = add(new THREE.BoxGeometry(10, 90, 86), steel, x + 52, 80, z);
        const sign = tkTexture(256, 64, (b, w, h) => { b.fillStyle = '#F5B700'; b.fillRect(0, 0, w, h); b.fillStyle = '#1a1a1a'; b.font = '900 46px "Big Shoulders Display", Impact'; b.textAlign = 'center'; b.fillText('DISAMATIC', w / 2, 50); });
        add(new THREE.PlaneGeometry(94, 24), new THREE.MeshBasicMaterial({ map: sign }), x - 4, 210, z + 49);
        add(new THREE.PlaneGeometry(94, 24), new THREE.MeshBasicMaterial({ map: sign }), x - 4, 210, z - 49).rotation.y = Math.PI;
        add(new THREE.BoxGeometry(30, 50, 40), M('#d8dde3'), x - 60, 90, z + 34);
        obj.panelLeds = [0, 1, 2].map(k => add(new THREE.BoxGeometry(4, 6, 6), Glow(['#7FD48A', '#F5B700', '#ff5a3a'][k], 0.9), x - 76, 100 - k * 12, z + 34));
        obj.disaBeacon = beacon(x - 4, 260, z);
        break;
      }
      case 'posenoyau': { counter(x, z, yellow, disaGreen); add(new THREE.BoxGeometry(60, 6, 60), dark, x, 64, z); obj.setter = [0, 1].map(k => { const c = add(new THREE.CylinderGeometry(9, 9, 34, 12), M('#e2d2a8'), x - 16 + k * 32, 76, z); c.rotation.z = Math.PI / 2; return c; }); add(new THREE.BoxGeometry(10, 10, 80), steel, x - 30, 120, z); break; }
      case 'tapis': {
        add(new THREE.BoxGeometry(100, 36, 96), M('#26292d'), x, 18, z);
        for (let k = 0; k < 4; k++) { const r = add(new THREE.CylinderGeometry(6, 6, 90, 8), steel, x - 37 + k * 25, 40, z); r.rotation.x = Math.PI / 2; obj.rollers.push(r); }
        [-46, 46].forEach(d => add(new THREE.BoxGeometry(100, 14, 6), yellow, x, 44, z + d));
        if (x > BELT.pour[1]) {   // tunnel de refroidissement après la zone de coulée
          add(new THREE.BoxGeometry(100, 8, 110), M('#5c6067', { metalness: 0.6, transparent: true, opacity: 0.85 }), x, 170, z);
          [-52, 52].forEach(d => add(new THREE.BoxGeometry(100, 120, 6), M('#5c6067', { metalness: 0.6, transparent: true, opacity: 0.55 }), x, 110, z + d));
        }
        if (x > BELT.pour[0] && x < BELT.pour[1]) add(new THREE.BoxGeometry(100, 10, 12), yellow, x, 300, z - 40);   // monorail de la poche
        break;
      }
      case 'tambour': {
        add(new THREE.BoxGeometry(96, 40, 96), dark, x, 20, z);
        obj.drum = add(new THREE.CylinderGeometry(58, 58, 96, 18, 1, true), M('#8a8d91', { metalness: 0.7, side: THREE.DoubleSide }), x, 100, z); obj.drum.rotation.z = Math.PI / 2;
        [-48, 48].forEach(d => add(new THREE.TorusGeometry(60, 6, 6, 18), steel, x + d, 100, z).rotation.y = Math.PI / 2);
        add(new THREE.CylinderGeometry(30, 50, 80, 12), M('#3a3d42'), x, 220, z);
        break;
      }
      case 'sortie': counter(x, z, M('#5c6067'), M('#3a3d42')); add(new THREE.BoxGeometry(90, 6, 90), M('#2b2e33', { metalness: 0.6 }), x, 64, z); break;
      case 'four': {       // four à induction sur berceau basculant, hotte d'aspiration au-dessus
        add(new THREE.BoxGeometry(100, 30, 100), dark, x, 15, z);
        [-50, 50].forEach(d => add(new THREE.BoxGeometry(12, 120, 30), yellow, x + d, 70, z));
        obj.furn = new THREE.Group(); obj.furn.position.set(x, 120, z); scene.add(obj.furn);
        add(new THREE.CylinderGeometry(48, 52, 120, 20), M('#2b6cb0', { metalness: 0.4 }), 0, 0, 0, obj.furn);
        obj.coils = [-30, 0, 30].map(d => { const c = add(new THREE.TorusGeometry(52, 5, 6, 22), M('#c87533', { metalness: 0.8, emissive: '#000000' }), 0, d, 0, obj.furn); c.rotation.x = Math.PI / 2; return c; });
        obj.melt = add(new THREE.CircleGeometry(40, 20), new THREE.MeshBasicMaterial({ color: '#3a2a20' }), 0, 61, 0, obj.furn); obj.melt.rotation.x = -Math.PI / 2;
        add(new THREE.BoxGeometry(20, 10, 30), M('#2b6cb0'), 0, 56, 54, obj.furn);    // bec de coulée
        add(new THREE.CylinderGeometry(70, 40, 60, 16, 1, true), M('#5c6067', { metalness: 0.6, side: THREE.DoubleSide }), x, 330, z);
        add(new THREE.CylinderGeometry(18, 18, 200, 10), M('#5c6067', { metalness: 0.6 }), x, 460, z);
        obj.fire = new THREE.Group(); obj.fire.position.set(x, 180, z); scene.add(obj.fire);
        for (let k = 0; k < 8; k++) add(new THREE.ConeGeometry(16, 80, 8), Glow(k % 2 ? '#ff6a1a' : '#ffd27a', 0.85), Math.cos(k) * 24, 36, Math.sin(k) * 24, obj.fire);
        obj.fireLight = new THREE.PointLight('#ff6a1a', 0, 700, 1.5); obj.fireLight.position.set(x, 260, z); scene.add(obj.fireLight);
        obj.furnBeacon = beacon(x + 60, 150, z + 60);
        break;
      }
      case 'meuleuse': { counter(x, z, M('#BA2C3A'), M('#3a3d42')); add(new THREE.BoxGeometry(40, 50, 30), dark, x, 100, z - 32); obj.wheel = add(new THREE.CylinderGeometry(26, 26, 8, 20), M('#9aa0a6', { metalness: 0.8 }), x, 100, z - 12); obj.wheel.rotation.x = Math.PI / 2; add(new THREE.CylinderGeometry(30, 30, 10, 20, 1, true, 0, Math.PI), M('#BA2C3A', { side: THREE.DoubleSide }), x, 104, z - 12).rotation.x = Math.PI / 2; break; }
      case 'poubelle': { add(new THREE.CylinderGeometry(38, 32, 74, 14), M('#3a3d42', { metalness: 0.5 }), x, 37, z); add(new THREE.CylinderGeometry(28, 28, 2, 14), new THREE.MeshBasicMaterial({ color: '#111' }), x, 75, z); break; }
    }
  });

  /* ---------- particules (étincelles, poussière, vapeur) ---------- */
  const NP = 400, pPos = new Float32Array(NP * 3), pCol = new Float32Array(NP * 3), pv = [];
  for (let i = 0; i < NP; i++) { pPos[i * 3 + 1] = -999; pv.push({ life: 0, vx: 0, vy: 0, vz: 0, g: 0 }); }
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  scene.add(new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 7, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
  let pi = 0;
  const tmpC = new THREE.Color();
  const emit = (x, y, z, col, n, sp, up, life = 0.8, gr = -400) => {
    tmpC.set(col);
    for (let k = 0; k < n; k++) {
      const i = pi = (pi + 1) % NP, q = pv[i];
      pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z;
      pCol[i * 3] = tmpC.r; pCol[i * 3 + 1] = tmpC.g; pCol[i * 3 + 2] = tmpC.b;
      Object.assign(q, { life: life * (0.5 + Math.random() * 0.5), vx: (Math.random() - 0.5) * sp, vy: up + Math.random() * sp * 0.5, vz: (Math.random() - 0.5) * sp, g: gr });
    }
  };

  // mottes de sable (sans châssis) sur le convoyeur
  const moulds = new Map();
  const moldTex = tkTexture(64, 64, (b, w, h) => { b.fillStyle = '#9a7650'; b.fillRect(0, 0, w, h); for (let i = 0; i < 300; i++) { b.fillStyle = `rgba(${Math.random() < 0.5 ? '60,40,20' : '255,230,190'},.12)`; b.fillRect(Math.random() * w, Math.random() * h, 2, 2); } b.strokeStyle = 'rgba(0,0,0,.35)'; b.lineWidth = 2; b.beginPath(); b.moveTo(w / 2, 0); b.lineTo(w / 2, h); b.stroke(); });
  const mkMould = () => {
    const grp = new THREE.Group();
    add(new THREE.BoxGeometry(BELT.mould - 4, 70 * BIG, 80), new THREE.MeshStandardMaterial({ map: moldTex, roughness: 1 }), 0, 35 * BIG, 0, grp);
    const cup = add(new THREE.CylinderGeometry(12 * BIG, 6, 4, 12), new THREE.MeshBasicMaterial({ color: '#1a120c' }), 0, 70 * BIG + 1, 0, grp);
    const glow = add(new THREE.BoxGeometry(BELT.mould - 2, 72 * BIG, 82), Glow('#ff6a1a', 0), 0, 35 * BIG, 0, grp);
    scene.add(grp);
    return { grp, cup, glow };
  };
  // objets : ce qu'on porte et ce qui est posé
  const itemMesh = c => {
    const grp = new THREE.Group(), it = c.it;
    if (it === 'sable') { add(new THREE.CylinderGeometry(15, 12, 22, 12), M('#5c6067', { metalness: 0.5 }), 0, 0, 0, grp); add(new THREE.SphereGeometry(14, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M('#c49a64'), 0, 9, 0, grp); }
    else if (it === 'noyau') add(new THREE.CylinderGeometry(8, 8, 32, 10), M('#e2d2a8'), 0, 0, 0, grp).rotation.z = Math.PI / 2;
    else if (it === 'ferraille') for (let k = 0; k < 3; k++) add(new THREE.BoxGeometry(32, 6, 9), M('#8a8d91', { metalness: 0.7 }), 0, k * 7 - 6, 0, grp).rotation.y = k * 0.6;
    else if (it === 'alliage') for (let k = 0; k < 3; k++) add(new THREE.DodecahedronGeometry(8), M('#d8dde3', { metalness: 0.8 }), k * 12 - 12, 0, 0, grp);
    else if (it === 'poche') { add(new THREE.CylinderGeometry(22, 16, 30, 16), M('#3a3d42', { metalness: 0.6 }), 0, 0, 0, grp); grp.userData.lava = add(new THREE.CircleGeometry(20, 16), new THREE.MeshBasicMaterial({ color: '#ffb347' }), 0, 15.5, 0, grp); grp.userData.lava.rotation.x = -Math.PI / 2; add(new THREE.CylinderGeometry(2, 2, 50, 6), M('#5c6067'), -34, 6, 0, grp).rotation.z = Math.PI / 2; }
    else {
      const raw = it === 'brute', mat = M(raw ? '#5a5048' : '#9aa0a6', { metalness: raw ? 0.3 : 0.85, roughness: raw ? 0.8 : 0.3 }), t2 = c.type || 0;
      if (t2 === 0) { add(new THREE.CylinderGeometry(22, 22, 6, 20), mat, 0, 0, 0, grp); add(new THREE.CylinderGeometry(8, 8, 8, 12), M('#2b2e33'), 0, 0, 0, grp); }
      else if (t2 === 1) { add(new THREE.CylinderGeometry(9, 9, 40, 12), mat, 0, 0, 0, grp).rotation.z = Math.PI / 2; add(new THREE.CylinderGeometry(9, 9, 20, 12), mat, 10, 10, 0, grp); }
      else { add(new THREE.BoxGeometry(44, 26, 30), mat, 0, 0, 0, grp); for (let k = 0; k < 3; k++) add(new THREE.CylinderGeometry(6, 6, 6, 10), M('#2b2e33'), -14 + k * 14, 13, 0, grp); }
      if (raw) add(new THREE.BoxGeometry(4, 12, 4), mat, -8, 14, 0, grp);    // jet de coulée à meuler
      grp.scale.setScalar(BIG);
    }
    scene.add(grp);
    return grp;
  };
  const shown = new Map();
  const showItem = (key, c, x, y, z) => {
    let o = shown.get(key);
    const sig = c && (c.it + (c.type ?? ''));
    if (o && o.userData.sig !== sig) { scene.remove(o); shown.delete(key); o = null; }
    if (!c) return;
    if (!o) { o = itemMesh(c); o.userData.sig = sig; shown.set(key, o); }
    o.position.set(x, y, z); o.userData.seen = true;
    if (c.it === 'poche' && o.userData.lava) { o.userData.lava.visible = c.metal > 0; o.userData.lava.material.color.set(c.temp >= 1330 ? '#ffb347' : '#c86a2a'); }
  };
  const rigs = [];

  /* ---------- guidage : surbrillance, flèche et chemin lumineux ---------- */
  const gArrow = new THREE.Group(); scene.add(gArrow);
  add(new THREE.ConeGeometry(22, 44, 4), Glow('#F5B700', 0.95), 0, 0, 0, gArrow).rotation.x = Math.PI;
  add(new THREE.CylinderGeometry(7, 7, 40, 8), Glow('#F5B700', 0.95), 0, 40, 0, gArrow);
  const gRing = add(new THREE.RingGeometry(58, 70, 32), Glow('#F5B700', 0.7), 0, 2, 0); gRing.rotation.x = -Math.PI / 2;
  const gBeam = add(new THREE.CylinderGeometry(46, 46, 600, 16, 1, true), Glow('#F5B700', 0.08), 0, 300, 0);
  const gBox = add(new THREE.BoxGeometry(104, 1, 104), Glow('#ffd27a', 0.25), 0, 0, 0);
  const crumbs = [];
  for (let k = 0; k < 40; k++) { const m = add(new THREE.CircleGeometry(9, 12), Glow('#F5B700', 0.8), 0, 3, 0); m.rotation.x = -Math.PI / 2; m.visible = false; crumbs.push(m); }
  const pathTo = (sx, sy, gx, gy) => {     // parcours en largeur sur la grille, en contournant les postes
    const key = (a, b) => a + ',' + b, start = [Math.floor(sx / TT), Math.floor(sy / TT)], goal2 = [Math.floor(gx / TT), Math.floor(gy / TT)];
    const prevN = new Map([[key(...start), null]]), q = [start];
    while (q.length) {
      const c = q.shift();
      if (c[0] === goal2[0] && c[1] === goal2[1]) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = [c[0] + dx, c[1] + dy], k = key(...n);
        if (n[0] < 0 || n[1] < 0 || n[0] >= GR.cols || n[1] >= GR.rows || prevN.has(k) || solid.has(k)) continue;
        prevN.set(k, c); q.push(n);
      }
    }
    const out = []; let c = goal2;
    if (!prevN.has(key(...goal2))) return out;
    while (c) { out.unshift(c); c = prevN.get(key(...c)); }
    return out;
  };
  const frontOf = s => {      // case libre d'où l'on travaille sur un poste
    const opts = [[-1, 0], [1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [s.tx + dx, s.ty + dy]).filter(([a, b]) => a >= 0 && b >= 0 && a < GR.cols && b < GR.rows && !solid.has(a + ',' + b));
    opts.sort((A, B) => Math.hypot(A[0] * TT - me.x, A[1] * TT - me.y) - Math.hypot(B[0] * TT - me.x, B[1] * TT - me.y));
    const o = opts[0] || [s.tx, s.ty + 1];
    return [o[0] * TT + TT / 2, o[1] * TT + TT / 2];
  };
  const STEPS = ['Sable dans la trémie', 'Noyaux au pose-noyau', 'Presser la motte (DISA)', 'Charger le four', 'Remplir la poche et couler', 'Décocher et ébarber', 'Expédier la pièce'];
  function computeGoal(sp) {
    const c = sp.c, it = c && c.it, f = cur.furnace, ladleId = Object.keys(cur.items).find(id => cur.items[id].it === 'poche');
    const S = k => stOf(k), G = (st, text, step, x, y) => ({ st, text, step, x, y });
    const pending = cur.orders.map(o => o.type);
    cur.moulds.forEach(m => { const i = pending.indexOf(m.cores); if (i >= 0) pending.splice(i, 1); });
    const need = pending.length ? pending[0] : Math.min(...Object.keys(PARTS).map(Number));
    const free = !cur.moulds.length || Math.min(...cur.moulds.map(m => m.u)) >= BELT.mould;
    const grinder = S('meuleuse'), gItem = cur.items[grinder.id];
    const emptyCounter = () => ST.filter(s => s.k === 'comptoir' && !cur.items[s.id]).sort((a, b) => Math.hypot(center(a)[0] - me.x, center(a)[1] - me.y) - Math.hypot(center(b)[0] - me.x, center(b)[1] - me.y))[0];
    if (it === 'sable') {
      if (f.state === 'feu') return G(S('four'), 'Vite : E sur le four pour étouffer le feu avec le sable !', -1);
      if (cur.setter < need && !cur.core.sand && !cur.core.ready) return G(S('noyauteuse'), `E : charge le sable dans la noyauteuse (il faut ${need} noyau${need > 1 ? 'x' : ''} pour un ${partName(need)})`, 1);
      if (cur.hopper < 4) return G(S('tremie'), 'E : verse le sable dans la trémie de la DISA', 0);
      if (!cur.core.sand && !cur.core.ready) return G(S('noyauteuse'), 'E : charge le sable dans la noyauteuse', 1);
      return G(emptyCounter() || S('poubelle'), 'Trémie pleine : pose ce seau sur un comptoir', 0);
    }
    if (it === 'noyau') return cur.setter < 2 ? G(S('posenoyau'), `E : pose le noyau dans le pose-noyau (${cur.setter + 1}/${Math.max(1, need)})`, 1) : G(emptyCounter(), 'Pose-noyau plein : pose le noyau sur un comptoir', 1);
    if (it === 'ferraille' || it === 'alliage') return G(S('four'), `E : charge ${it === 'alliage' ? 'le ferroalliage' : 'la ferraille'} dans le four (2 ferrailles + 1 ferroalliage)`, 3);
    if (it === 'poche') {
      if (c.metal >= MODE.metal) {
        const cand = cur.moulds.filter(m => !m.poured).map(m => BELT.x0 + m.u - BELT.mould / 2).filter(x => x < BELT.pour[1] - 10);
        const x = cand.length ? Math.max(BELT.pour[0] + 20, Math.min(BELT.pour[1] - 20, Math.max(...cand))) : (BELT.pour[0] + BELT.pour[1]) / 2;
        return G(null, cand.length ? 'Face à la motte dans la zone jaune : MAINTIENS ESPACE pour couler' : 'Attends la prochaine motte dans la zone jaune (la DISA doit presser)', 4, x, (BELT.y + 1) * TT + TT / 2);
      }
      if (f.state === 'pret') return G(S('four'), 'E : remplis la poche au four', 4);
      return G(stAt(12, 6), 'Poche vide : repose-la près du four en attendant la fonte', 4);
    }
    if (it === 'brute') return gItem ? G(emptyCounter(), 'Meuleuse occupée : pose la pièce sur un comptoir', 5) : G(grinder, 'E : pose la pièce brute à la meuleuse', 5);
    if (it === 'ebarbee') return G(S('expedition'), 'E : expédie la pièce ébarbée', 6);
    // mains vides
    if (f.state === 'feu') return G(S('sable'), 'LE FOUR BRÛLE : prends un seau de sable !', -1);
    if (gItem && gItem.it === 'brute') return G(grinder, 'MAINTIENS ESPACE pour ébarber la pièce', 5);
    if (gItem && gItem.it === 'ebarbee') return G(grinder, 'E : prends la pièce ébarbée', 6);
    if (cur.out.length) return G(S('sortie'), 'E : prends la pièce brute à la sortie du tambour', 5);
    if (ladleId && cur.items[ladleId].metal >= MODE.metal && cur.moulds.some(m => !m.poured)) return G(ST[ladleId], 'E : prends la poche pleine pour couler', 4);
    if (f.state === 'pret' && ladleId && cur.items[ladleId].metal === 0) return G(ST[ladleId], 'Le four est prêt : E pour prendre la poche', 4);
    if (cur.setter < need) {
      if (cur.core.ready) return G(S('noyauteuse'), 'E : prends le noyau', 1);
      if (cur.core.sand) return G(S('noyauteuse'), 'MAINTIENS ESPACE pour tirer le noyau', 1);
      return G(S('sable'), `Prends du sable pour la noyauteuse (${partName(need)} : ${need} noyau${need > 1 ? 'x' : ''})`, 1);
    }
    if (!cur.hopper) return G(S('sable'), 'Trémie vide : prends un seau de sable', 0);
    if (free && cur.moulds.length < 5) return G(S('disa'), `MAINTIENS ESPACE pour presser une motte « ${partName(cur.setter)} »`, 2);
    if (f.state === 'vide') return G(S(f.al < 1 ? 'alliage' : 'ferraille'), `Prends ${f.al < 1 ? 'du ferroalliage' : 'de la ferraille'} pour le four`, 3);
    if (cur.hopper < 4) return G(S('sable'), 'Remplis la trémie : prends du sable', 0);
    return G(S('disa'), 'Surveille la DISA et la ligne', 2);
  }

  /* ---------- réception ---------- */
  let prev = null, cur = null, curAt = 0, prevAt = 0, seenEv = 0, banner = '', bannerAt = 0, bannerCol = '#F5B700', goal = null;
  const msgs = [], pops = [];
  function push(v) {
    const first = !cur;
    prev = cur || v; prevAt = curAt || performance.now(); cur = v; curAt = performance.now();
    const sp = v.p[mySeat];
    if (sp && sp.tp !== me.tp) Object.assign(me, { x: sp.x, y: sp.y, a: sp.a, tp: sp.tp });
    if (sp && first) yaw = camYaw = sp.a;
    for (const e of v.ev) {
      if (e.id <= seenEv) continue;
      seenEv = e.id;
      const say = (t, c) => msgs.push({ t, at: performance.now(), c });
      if (e.k === 'deliver') {
        if (e.ok) { pops.push({ x: e.x, y: e.y, t: `+${e.pts}`, at: performance.now(), c: e.defects.length ? '#ffd27a' : '#7FD48A' }); SFX.good(); if (e.defects.length) say(`${partName(e.type)} : ${e.defects.map(d => DEF[d][0]).join(', ')} (points ÷2)`, '#ffd27a'); }
        else { say(`Pas de commande « ${partName(e.type)} » en attente`, '#ff8a8a'); SFX.bad(); }
      } else if (e.k === 'shake') { sfx(90, 0.3, 'sawtooth', 0.05, -30); pops.push({ x: e.x, y: e.y, t: partName(e.type), at: performance.now(), c: '#fff' }); emit(e.x, 140, e.y, '#c49a64', 40, 220, 120, 1.2, -200); }
      else if (e.k === 'empty') { say('Une motte est partie sans être coulée !', '#ff8a8a'); sfx(140, 0.3, 'square', 0.04, -60); }
      else if (e.k === 'expire') { say(`Commande perdue : ${partName(e.type)}`, '#ff8a8a'); sfx(150, 0.3, 'square', 0.04, -60); }
      else if (e.k === 'press') { sfx(110, 0.25, 'square', 0.06, -30); pops.push({ x: e.x, y: e.y, t: `Motte ${partName(e.cores)}`, at: performance.now(), c: '#F5B700' }); emit(e.x + 50, 80, e.y, '#c49a64', 20, 120, 60, 0.8, -200); }
      else if (e.k === 'poured') { sfx(880, 0.15, 'triangle', 0.05); emit(e.x, 140, e.y, '#ffd27a', 30, 260, 200, 0.9); }
      else if (e.k === 'tap') { sfx(300, 0.3, 'sawtooth', 0.05, 200); emit(e.x, 200, e.y, '#ffb347', 50, 260, 260, 1); }
      else if (e.k === 'ready') { say('Four prêt : venez remplir la poche !', '#ffb347'); sfx(660, 0.2, 'triangle', 0.05); }
      else if (e.k === 'fire') { banner = 'LE FOUR S’EMBALLE !'; bannerCol = '#ff5a3a'; bannerAt = performance.now(); say('Un seau de sable sur le four pour l’éteindre !', '#ff8a5a'); sfx(80, 0.8, 'sawtooth', 0.08, 40); }
      else if (e.k === 'extinct') { say('Feu éteint', '#7fd4ff'); sfx(400, 0.4, 'sine', 0.05, -300); emit(e.x, 220, e.y, '#9aa0a6', 60, 200, 150, 1.6, 40); }
      else if (e.k === 'frozen') say('La fonte s’est figée dans la poche !', '#ff8a8a');
      else if (e.k === 'coreok') sfx(720, 0.1, 'triangle', 0.04);
      else if (e.k === 'ground') sfx(1500, 0.15, 'sawtooth', 0.03);
      else if (e.k === 'take' && e.seat === mySeat) sfx(600, 0.05, 'triangle', 0.03);
      else if (e.k === 'end') { banner = `${'★'.repeat(e.stars)}${'☆'.repeat(3 - e.stars)}  FIN DU POSTE`; bannerCol = e.ok ? '#7FD48A' : '#F5B700'; bannerAt = performance.now(); }
    }
  }

  const lerp = (a, b, t) => a + (b - a) * t;
  function interpP(i) {
    const p = cur.p[i], q = (prev && prev.p[i]) || p;
    if (i === mySeat) return { ...p, x: me.x, y: me.y, a: me.a };
    const t = Math.min(1.2, (performance.now() - curAt) / Math.max(30, curAt - prevAt));
    return { ...p, x: lerp(q.x, p.x, t), y: lerp(q.y, p.y, t), a: q.a + Math.atan2(Math.sin(p.a - q.a), Math.cos(p.a - q.a)) * Math.min(1, t) };
  }
  const nearStation = () => {
    const fx = me.x + Math.cos(me.a) * 55, fy = me.y + Math.sin(me.a) * 55;
    let best = null, bd = 1e9;
    for (const s of ST) { const [cx, cy] = center(s); if (Math.hypot(cx - me.x, cy - me.y) > trackInfo.reach) continue; const d = Math.hypot(cx - fx, cy - fy); if (d < bd) { bd = d; best = s; } }
    return best;
  };

  /* ---------- HUD ---------- */
  const v3 = new THREE.Vector3();
  const project = (x, y, z) => { v3.set(x, y, z).project(cam); return v3.z > 1 ? [-999, -999] : [(v3.x + 1) / 2 * W, (1 - v3.y) / 2 * H]; };
  const bar = (x, y, k, col) => { if (x < -100) return; g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(x - 28, y, 56, 8); g.fillStyle = col; g.fillRect(x - 28, y, 56 * Math.min(1, k), 8); };
  function contextHint(sp) {
    const s = nearStation(), it = sp.c && sp.c.it;
    if (it === 'poche' && sp.c.metal >= MODE.metal && me.x >= BELT.pour[0] - 40 && me.x <= BELT.pour[1] + 40 && me.y < (BELT.y + 1) * TT + 80) return 'ESPACE MAINTENU DEVANT UNE MOTTE : COULER';
    if (!s) return '';
    const f = cur.furnace;
    switch (s.k) {
      case 'sable': case 'ferraille': case 'alliage': return it ? 'E : REPOSER' : `E : PRENDRE ${trackInfo.items[s.k].toUpperCase()}`;
      case 'comptoir': return it ? 'E : POSER ICI' : cur.items[s.id] ? 'E : PRENDRE' : '';
      case 'tremie': return it === 'sable' ? `E : REMPLIR LA TRÉMIE (${cur.hopper}/4)` : `TRÉMIE : ${cur.hopper}/4 SEAUX`;
      case 'disa': return cur.hopper ? `ESPACE MAINTENU : PRESSER → ${partName(cur.setter).toUpperCase()}` : 'TRÉMIE VIDE : APPORTEZ DU SABLE';
      case 'posenoyau': return it === 'noyau' ? `E : POSER LE NOYAU (${cur.setter}/2)` : `${cur.setter} NOYAU${cur.setter > 1 ? 'X' : ''} POSÉ${cur.setter > 1 ? 'S' : ''}`;
      case 'noyauteuse': return cur.core.ready ? 'E : PRENDRE LE NOYAU' : cur.core.sand ? 'ESPACE MAINTENU : TIRER LE NOYAU' : it === 'sable' ? 'E : CHARGER LE SABLE' : 'NOYAUTEUSE : APPORTE UN SEAU DE SABLE';
      case 'four': return f.state === 'feu' ? (it === 'sable' ? 'E : ÉTEINDRE AU SABLE !' : 'AU FEU ! APPORTEZ UN SEAU DE SABLE') : f.state === 'pret' ? (it === 'poche' ? 'E : REMPLIR LA POCHE' : 'FONTE PRÊTE : AMENEZ LA POCHE') : f.state === 'fusion' ? 'FUSION EN COURS…' : (['ferraille', 'alliage'].includes(it) ? 'E : CHARGER' : `CHARGE : ${f.fe}/2 FERRAILLE · ${f.al}/1 FERROALLIAGE`);
      case 'sortie': return cur.out.length ? 'E : PRENDRE LA PIÈCE BRUTE' : 'SORTIE DU TAMBOUR';
      case 'meuleuse': { const m = cur.items[s.id]; return m ? (m.it === 'brute' ? 'ESPACE MAINTENU : ÉBARBER' : 'E : PRENDRE LA PIÈCE ÉBARBÉE') : it === 'brute' ? 'E : POSER À LA MEULEUSE' : 'MEULEUSE'; }
      case 'expedition': return it === 'ebarbee' ? 'E : EXPÉDIER' : 'EXPÉDITION : PIÈCES ÉBARBÉES';
      case 'poubelle': return it ? (it === 'poche' ? 'E : VIDER LA POCHE' : 'E : JETER') : 'POUBELLE';
    }
    return '';
  }
  function drawHud(t) {
    g.clearRect(0, 0, W, H);
    const now = performance.now();
    const [dx, dz] = center(stOf('disa')); if (cur.press > 0) { const [px, py] = project(dx, 290, dz); bar(px, py, cur.press / MODE.press, '#7fd4ff'); }
    const [cx2, cz2] = center(stOf('noyauteuse')); if (cur.core.sand) { const [px, py] = project(cx2, 260, cz2); bar(px, py, cur.core.p / MODE.core, '#e2d2a8'); }
    const [gx, gz] = center(stOf('meuleuse')); if (cur.grind > 0) { const [px, py] = project(gx, 150, gz); bar(px, py, cur.grind / MODE.grind, '#ffd27a'); }
    const [fx, fz] = center(stOf('four')), f = cur.furnace;
    { const [px, py] = project(fx, 300, fz);
      if (f.state === 'fusion') bar(px, py, f.t / 9, '#ff8a2a');
      else if (f.state === 'pret') { bar(px, py, 1 - f.t / 22, f.t > 15 ? '#ff3a2a' : '#7FD48A'); if (f.t > 15 && Math.sin(t * 12) > 0 && px > -100) { g.font = '900 22px "Big Shoulders Display", Impact'; g.textAlign = 'center'; g.fillStyle = '#ff5a3a'; g.fillText('!', px, py - 6); } }
      else if (f.state === 'feu' && px > -100) { g.font = '900 18px "Big Shoulders Display", Impact'; g.textAlign = 'center'; g.fillStyle = '#ff5a3a'; g.fillText('🔥 AU FEU', px, py); } }
    cur.moulds.forEach(m => {
      const mx = BELT.x0 + m.u - BELT.mould / 2, mz = BELT.y * TT + TT / 2;
      if (m.pp > 0 && !m.poured) { const [px, py] = project(mx, 140, mz); bar(px, py, m.pp / MODE.pour, '#EC641E'); }
      const [px, py] = project(mx, 70 * BIG + 60, mz);
      if (px > -100) { g.font = '800 10px Archivo, sans-serif'; g.textAlign = 'center'; g.fillStyle = m.poured ? '#ffb347' : '#fff'; g.fillText(partName(m.cores).toUpperCase(), px, py); }
    });
    cur.p.forEach((p, i) => { if (i === mySeat && camMode === '1re') return; const q = interpP(i); const [px, py] = project(q.x, 210, q.y); if (px < -100) return; g.font = '800 11px Archivo, sans-serif'; g.textAlign = 'center'; g.fillStyle = i === mySeat ? '#F5B700' : '#fff'; g.fillText(`${p.n}${p.b ? ' (apprenti)' : ''}`, px, py); });
    for (let k = pops.length - 1; k >= 0; k--) { const pp = pops[k], a2 = (now - pp.at) / 1500; if (a2 > 1) { pops.splice(k, 1); continue; } const [px, py] = project(pp.x, 160 + a2 * 80, pp.y); if (px < -100) continue; g.globalAlpha = 1 - a2; g.font = '900 18px "Big Shoulders Display", Impact'; g.textAlign = 'center'; g.fillStyle = pp.c; g.strokeStyle = '#000'; g.lineWidth = 4; g.strokeText(pp.t, px, py); g.fillText(pp.t, px, py); g.globalAlpha = 1; }
    // tickets de commande
    cur.orders.forEach((o, k) => {
      const x = 14 + k * 132, y = 10;
      g.fillStyle = '#f2eadc'; g.fillRect(x, y, 124, 62); g.fillStyle = o.left < 25 ? '#ff5a5a' : '#2E9E5B'; g.fillRect(x, y + 56, 124 * o.left / o.lim, 6);
      g.font = '900 15px "Big Shoulders Display", Impact'; g.textAlign = 'left'; g.fillStyle = '#1a1612'; g.fillText(partName(o.type).toUpperCase(), x + 8, y + 19);
      g.font = '700 10px Archivo, sans-serif'; g.fillStyle = '#5a4a3a'; g.fillText(`${o.type} noyau${o.type > 1 ? 'x' : ''} · ébarbée`, x + 8, y + 34);
      for (let c = 0; c < o.type; c++) { g.fillStyle = '#e2d2a8'; g.strokeStyle = '#8b6a46'; g.lineWidth = 1.5; g.fillRect(x + 8 + c * 22, y + 40, 18, 8); g.strokeRect(x + 8 + c * 22, y + 40, 18, 8); }
    });
    // score, étoiles, temps
    g.fillStyle = 'rgba(8,9,11,.85)'; g.fillRect(W - 190, 10, 176, 62);
    g.font = '900 24px "Big Shoulders Display", Impact'; g.textAlign = 'right'; g.fillStyle = '#F5B700'; g.fillText(`${cur.score}`, W - 22, 36);
    trackInfo.stars.forEach((s, k) => { g.font = '20px serif'; g.textAlign = 'left'; g.fillStyle = cur.score >= s ? '#F5B700' : 'rgba(255,255,255,.25)'; g.fillText('★', W - 180 + k * 22, 36); });
    const left = Math.max(0, Math.ceil(trackInfo.round - cur.time));
    g.font = '400 10px "Press Start 2P", monospace'; g.textAlign = 'right'; g.fillStyle = left < 30 ? '#ff5a5a' : '#fff'; g.fillText(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, W - 22, 60);
    g.font = '700 9px Archivo, sans-serif'; g.textAlign = 'right'; g.fillStyle = '#ffd27a'; g.fillText(`${MODE.name.toUpperCase()} · VUE ${camMode === 'ensemble' ? 'D’ENSEMBLE' : camMode.toUpperCase() + ' PERS.'} (V)`, W - 16, 86);
    // guidage : fiche de poste, consigne et boussole
    if (guide && goal) {
      const x0 = 12, y0 = 84;
      g.fillStyle = 'rgba(8,9,11,.78)'; g.fillRect(x0, y0, 190, 20 + STEPS.length * 17);
      g.font = '400 8px "Press Start 2P", monospace'; g.textAlign = 'left'; g.fillStyle = '#F5B700'; g.fillText('FICHE DE POSTE', x0 + 8, y0 + 13);
      STEPS.forEach((s, k) => { const on = k === goal.step; g.fillStyle = on ? '#F5B700' : 'rgba(255,255,255,.55)'; g.font = `${on ? 800 : 600} 10px Archivo, sans-serif`; g.fillText(`${on ? '▶' : k + 1 + '.'} ${s}`, x0 + 8, y0 + 30 + k * 17); });
      const txt = goal.text;
      g.font = '800 13px Archivo, sans-serif'; g.textAlign = 'center';
      const w = g.measureText(txt).width + 60, yy = H - 80;
      g.fillStyle = goal.step < 0 ? 'rgba(160,30,20,.92)' : 'rgba(245,183,0,.95)'; g.fillRect(W / 2 - w / 2, yy, w, 30);
      g.fillStyle = goal.step < 0 ? '#fff' : '#1a1612'; g.fillText(txt, W / 2 + 14, yy + 20);
      const ang = Math.atan2(goal.gy - me.y, goal.gx - me.x) - (camMode === 'ensemble' ? -Math.PI / 2 : camYaw) + Math.PI / 2;
      g.save(); g.translate(W / 2 - w / 2 + 18, yy + 15); g.rotate(ang); g.fillStyle = goal.step < 0 ? '#fff' : '#1a1612';
      g.beginPath(); g.moveTo(0, -11); g.lineTo(8, 7); g.lineTo(0, 3); g.lineTo(-8, 7); g.fill(); g.restore();
    }
    const sp = cur.p[mySeat];
    if (sp) { const h2 = contextHint(sp); if (h2) { g.font = '400 9px "Press Start 2P", monospace'; g.textAlign = 'center'; const w = g.measureText(h2).width + 20; g.fillStyle = 'rgba(8,9,11,.85)'; g.fillRect(W / 2 - w / 2, H - 36, w, 24); g.fillStyle = '#ffd27a'; g.fillText(h2, W / 2, H - 20); } }
    if (camMode === '1re') { g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(W / 2 - 7, H / 2); g.lineTo(W / 2 + 7, H / 2); g.moveTo(W / 2, H / 2 - 7); g.lineTo(W / 2, H / 2 + 7); g.stroke(); }
    msgs.splice(0, Math.max(0, msgs.length - 4));
    msgs.filter(m => now - m.at < 5000).forEach((m, k) => { g.font = '700 11px Archivo, sans-serif'; g.textAlign = 'right'; const w = g.measureText(m.t).width + 14; g.fillStyle = 'rgba(8,9,11,.82)'; g.fillRect(W - 14 - w, 96 + k * 20, w, 18); g.fillStyle = m.c; g.fillText(m.t, W - 21, 109 + k * 20); });
    if (cur.phase === 'count') bigText(g, String(Math.ceil(cur.countdown)), W / 2, H / 2, 90, '#F5B700');
    if (banner && now - bannerAt < 2500) bigText(g, banner, W / 2, H / 2 - 40, 40, bannerCol);
  }

  /* ---------- boucle ---------- */
  const [dx0] = center(stOf('disa')), [gx0, gz0] = center(stOf('meuleuse'));
  let lastW = 0, lastH = 0, myRun = 0;
  const camPos = new THREE.Vector3(HW / 2, 1050, HH + 500), camLook = new THREE.Vector3(HW / 2, 0, HH / 2), tv = new THREE.Vector3();
  const stop = loop((dt, tms) => {
    if (!cur) return;
    const t = tms / 1000, now = performance.now();
    const sp = cur.p[mySeat];
    const chase = camMode !== 'ensemble', locked = document.pointerLockElement === hud;
    let mx = 0, my = 0;
    if (chase) {
      const fwd = (held.has('u') ? 1 : 0) - (held.has('d') ? 1 : 0);
      let side = 0;
      const tr = (held.has('r') ? 1 : 0) - (held.has('l') ? 1 : 0);
      if (locked) side = tr; else yaw += tr * 2.6 * dt;    // sans la souris, ← → tournent
      mx = Math.cos(yaw) * fwd - Math.sin(yaw) * side; my = Math.sin(yaw) * fwd + Math.cos(yaw) * side;
    } else { mx = (held.has('r') ? 1 : 0) - (held.has('l') ? 1 : 0); my = (held.has('d') ? 1 : 0) - (held.has('u') ? 1 : 0); }
    const n = Math.hypot(mx, my); if (n > 1) { mx /= n; my /= n; }
    dashT = Math.max(0, dashT - dt); dashCd = Math.max(0, dashCd - dt);
    if (sp && cur.phase === 'play') {
      const heavy = sp.c && sp.c.it === 'poche' && sp.c.metal > 0 ? 0.75 : 1;
      const boost = dashT > 0 ? 2.6 : 1;
      myRun = mx || my ? 1 : 0;
      if (mx || my || dashT > 0) {
        const dirx = mx || (dashT > 0 ? Math.cos(me.a) : 0), diry = my || (dashT > 0 ? Math.sin(me.a) : 0);
        const sp2 = trackInfo.speed * heavy * boost * dt;
        const nx = me.x + dirx * sp2, ny = me.y + diry * sp2;
        if (!blocked(nx, me.y)) me.x = nx;
        if (!blocked(me.x, ny)) me.y = ny;
      }
      if (chase) me.a = yaw; else { if (mx || my) me.a = Math.atan2(my, mx); yaw = me.a; }
    }
    if (now - lastSend > 50 && cur.phase === 'play') { lastSend = now; send({ t: 'act', a: 'in', k: work ? 1 : 0, pos: [+me.x.toFixed(1), +me.y.toFixed(1), +me.a.toFixed(2)], tp: me.tp }); }
    const cw = hud.clientWidth, ch = hud.clientHeight;
    if (cw && (cw !== lastW || ch !== lastH)) { lastW = cw; lastH = ch; renderer.setSize(cw, ch, false); canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px'; cam.aspect = cw / ch; cam.updateProjectionMatrix(); }
    // caméra
    camYaw += Math.atan2(Math.sin(yaw - camYaw), Math.cos(yaw - camYaw)) * Math.min(1, dt * (camMode === '1re' ? 30 : 8));
    let cp, cl;
    if (camMode === 'ensemble') { cp = [HW / 2, 1050, HH + 500]; cl = [HW / 2, 0, HH / 2 + 20]; cam.fov = 40; }
    else if (camMode === '3e') {
      const bx = me.x - Math.cos(camYaw) * 300, bz = me.y - Math.sin(camYaw) * 300;
      cp = [Math.max(-10, Math.min(HW + 10, bx)), 330, Math.max(-10, Math.min(HH + 10, bz))]; cl = [me.x + Math.cos(camYaw) * 160, 70, me.y + Math.sin(camYaw) * 160]; cam.fov = 60;
    } else { cp = [me.x + Math.cos(camYaw) * 6, 150, me.y + Math.sin(camYaw) * 6]; cl = [me.x + Math.cos(camYaw) * 200, 70, me.y + Math.sin(camYaw) * 200]; cam.fov = 72; }
    const kk = camMode === 'ensemble' ? Math.min(1, dt * 4) : camMode === '1re' ? 1 : Math.min(1, dt * 10);
    camPos.lerp(tv.set(...cp), kk); camLook.lerp(tv.set(...cl), kk);
    cam.position.copy(camPos); cam.lookAt(camLook); cam.updateProjectionMatrix();
    frontParts.forEach(o => { o.visible = camMode !== 'ensemble'; });
    shown.forEach(o => { o.userData.seen = false; });
    // ouvriers
    cur.p.forEach((p, i) => {
      if (!rigs[i]) { rigs[i] = ryRig(p.m); scene.add(rigs[i].root); rigs[i].root.scale.setScalar(1.3); }
      const q = interpP(i), rig = rigs[i];
      const pq = prev && prev.p[i] ? prev.p[i] : p;
      const moving = i === mySeat ? !!myRun : Math.hypot(p.x - pq.x, p.y - pq.y) > 1;
      rig.root.visible = !(i === mySeat && camMode === '1re');
      rig.root.position.set(q.x, 0, q.y);
      rig.root.rotation.y = Math.PI / 2 - q.a;
      ryPose(rig, { speed: moving ? (i === mySeat && dashT > 0 ? 400 : 260) : 0, air: false, pitch: p.w ? -0.4 + Math.sin(t * 14) * 0.25 : 0, wid: p.c ? 'riveteuse' : 'poings', weaponObj: null, dead: false }, dt);
      if (p.c) {
        if (i === mySeat && camMode === '1re') showItem('p' + i, p.c, me.x + Math.cos(camYaw) * 46 - Math.sin(camYaw) * 14, 112, me.y + Math.sin(camYaw) * 46 + Math.cos(camYaw) * 14);
        else showItem('p' + i, p.c, q.x + Math.cos(q.a) * 38, 92, q.y + Math.sin(q.a) * 38);
      }
      if (p.w && p.c && p.c.it === 'poche') emit(q.x + Math.cos(q.a) * 60, 80, q.y + Math.sin(q.a) * 60, '#ffb347', 3, 80, 40, 0.4);
    });
    for (const id in cur.items) { const s = ST[id], [x, z] = center(s); showItem('s' + id, cur.items[id], x, s.k === 'meuleuse' ? 74 : 76, z); }
    const [sx, sz] = center(stOf('sortie'));
    cur.out.forEach((typ, k) => showItem('o' + k, { it: 'brute', type: typ }, sx, 76 + k * 18, sz));
    shown.forEach((o, key) => { if (!o.userData.seen) { scene.remove(o); shown.delete(key); } });
    // mottes sur le convoyeur
    const ids = new Set(cur.moulds.map(m => m.id));
    for (const [id, o] of moulds) if (!ids.has(id)) { scene.remove(o.grp); moulds.delete(id); }
    const pm = new Map((prev ? prev.moulds : []).map(m => [m.id, m]));
    const ct = Math.min(1.2, (now - curAt) / Math.max(30, curAt - prevAt));
    cur.moulds.forEach(m => {
      let o = moulds.get(m.id); if (!o) { o = mkMould(); moulds.set(m.id, o); }
      const pu = pm.has(m.id) ? pm.get(m.id).u : m.u, u = lerp(pu, m.u, ct);
      o.grp.position.set(BELT.x0 + u - BELT.mould / 2, 46, BELT.y * TT + TT / 2);
      o.cup.material.color.set(m.poured ? (m.cool < 8 ? '#ff8a2a' : '#5a3a2a') : '#1a120c');
      o.glow.material.opacity = m.poured ? Math.max(0, 0.35 - m.cool * 0.02) : 0;
      if (m.poured && m.cool < 10 && Math.random() < 0.15) emit(o.grp.position.x, 130, o.grp.position.z, '#bbbbbb', 1, 20, 60, 1.4, 30);
    });
    // machines vivantes
    const pk = Math.min(1, cur.press / MODE.press), pressing = cur.press > 0, push2 = Math.sin(pk * Math.PI);
    obj.ram.position.x = dx0 + 44 + push2 * 26; obj.swing.position.x = dx0 + 52 + push2 * 30;
    obj.cyl.forEach(r => { r.position.x = dx0 - 20 + push2 * 26; });
    obj.panelLeds.forEach((l, k) => { l.visible = k === 0 ? true : k === 1 ? pressing && Math.sin(t * 10) > 0 : !cur.hopper; });
    obj.disaBeacon.b.rotation.y += dt * 8; obj.disaBeacon.l.intensity = pressing ? 1.2 + Math.sin(t * 16) * 0.8 : 0; obj.disaBeacon.b.material.opacity = pressing ? 1 : 0.3;
    obj.hopperSand.position.y = 95 + cur.hopper * 12;
    obj.setter.forEach((c, k) => { c.visible = k < cur.setter; });
    obj.coreOut.visible = cur.core.ready;
    obj.coreHead.position.y = cur.core.sand ? 100 + Math.abs(Math.sin(t * 6)) * 8 : 150;
    if (cur.core.sand && Math.random() < 0.3) { const [x, z] = center(stOf('noyauteuse')); emit(x, 90, z, '#c49a64', 2, 80, 40, 0.5); }
    obj.drum.rotation.y += dt * 2;
    if (Math.random() < 0.2) { const [x, z] = center(stOf('tambour')); emit(x, 100, z + 40, '#9a7650', 2, 60, 20, 1, -100); }
    obj.rollers.forEach(r => { r.rotation.y += dt * 4; });
    obj.wheel.rotation.y += cur.grind > 0 ? dt * 40 : dt * 2;
    if (cur.grind > 0) emit(gx0, 96, gz0 + 14, Math.random() < 0.5 ? '#ffd27a' : '#ff8a2a', 4, 160, 80, 0.45);
    gantry.position.x = HW / 2 + Math.sin(t * 0.12) * (HW / 2 - 100); hook.position.y = 240 + Math.sin(t * 0.5) * 20;
    const f = cur.furnace;
    obj.melt.material.color.set(f.state === 'pret' ? '#ffb347' : f.state === 'fusion' ? (Math.sin(t * 6) > 0 ? '#ff8a2a' : '#c85a1a') : f.state === 'feu' ? '#ff5a1a' : '#3a2a20');
    obj.coils.forEach((c, k) => c.material.emissive.set(f.state === 'fusion' || f.state === 'pret' ? (Math.sin(t * 8 + k) > 0 ? '#7a3a00' : '#4a2000') : '#000000'));
    obj.furn.rotation.x = f.state === 'pret' ? Math.sin(t * 2) * 0.03 : 0;
    if ((f.state === 'fusion' || f.state === 'pret') && Math.random() < 0.5) emit(obj.furn.position.x, 185, obj.furn.position.z, '#ffd27a', 2, 120, 180, 0.7);
    obj.fire.visible = f.state === 'feu'; obj.fire.children.forEach(c => { c.scale.y = 0.7 + Math.random() * 0.8; });
    if (f.state === 'feu') emit(obj.furn.position.x, 240, obj.furn.position.z, '#555555', 2, 60, 120, 2, 20);
    obj.fireLight.intensity = f.state === 'feu' ? 1.8 + Math.random() : f.state === 'pret' ? 0.7 : f.state === 'fusion' ? 0.35 : 0;
    obj.furnBeacon.b.rotation.y += dt * 8; obj.furnBeacon.l.intensity = f.state === 'pret' || f.state === 'feu' ? 1.2 + Math.sin(t * 16) * 0.8 : 0; obj.furnBeacon.b.material.opacity = f.state === 'pret' || f.state === 'feu' ? 1 : 0.3;
    // particules
    for (let i = 0; i < NP; i++) {
      const q = pv[i]; if (q.life <= 0) { pPos[i * 3 + 1] = -999; continue; }
      q.life -= dt; q.vy += q.g * dt;
      pPos[i * 3] += q.vx * dt; pPos[i * 3 + 1] += q.vy * dt; pPos[i * 3 + 2] += q.vz * dt;
      if (pPos[i * 3 + 1] < 0) { pPos[i * 3 + 1] = 0; q.vy *= -0.3; }
    }
    pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
    // guidage
    goal = sp && cur.phase !== 'over' ? computeGoal(sp) : null;
    const showG = guide && goal;
    gArrow.visible = gRing.visible = gBeam.visible = gBox.visible = !!showG;
    crumbs.forEach(m => { m.visible = false; });
    if (showG) {
      let gx1, gz1, fx2, fz2;
      if (goal.st) { [gx1, gz1] = center(goal.st); [fx2, fz2] = frontOf(goal.st); }
      else { gx1 = fx2 = goal.x; gz1 = fz2 = goal.y; }
      goal.gx = gx1; goal.gy = gz1;
      const col = goal.step < 0 ? '#ff5a3a' : '#F5B700';
      [gArrow.children[0], gArrow.children[1], gRing, gBeam].forEach(m => m.material.color.set(col));
      gArrow.position.set(gx1, (goal.st ? 300 : 200) + Math.sin(t * 4) * 18, gz1); gArrow.rotation.y = t * 2;
      gRing.position.set(gx1, 3, gz1); gRing.scale.setScalar(1 + Math.sin(t * 5) * 0.08);
      gBeam.position.set(gx1, 300, gz1); gBeam.material.opacity = 0.06 + Math.sin(t * 4) * 0.03;
      gBox.visible = !!goal.st; if (goal.st) { gBox.position.set(gx1, 64, gz1); gBox.material.opacity = 0.25 + Math.sin(t * 6) * 0.15; }
      const path = pathTo(me.x, me.y, fx2, fz2);
      const pts = [[me.x, me.y], ...path.slice(1, -1).map(([a, b]) => [a * TT + TT / 2, b * TT + TT / 2]), [fx2, fz2]];
      let k = 0;
      for (let s = 0; s < pts.length - 1 && k < crumbs.length; s++) {
        const [ax, ay] = pts[s], [bx, by] = pts[s + 1], L = Math.hypot(bx - ax, by - ay), nn = Math.max(1, Math.floor(L / 34));
        for (let j = 0; j < nn && k < crumbs.length; j++) {
          const u = j / nn, m = crumbs[k++];
          m.visible = true; m.position.set(ax + (bx - ax) * u, 3, ay + (by - ay) * u);
          m.material.color.set(col); m.scale.setScalar(0.6 + 0.4 * Math.max(0, Math.sin(t * 8 - k * 0.5)));
        }
      }
    }
    renderer.render(scene, cam);
    drawHud(t);
  });

  return {
    push, endShown: false,
    stop() {
      stop();
      if (document.pointerLockElement === hud) document.exitPointerLock();
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur); document.removeEventListener('mousemove', mm);
      renderer.dispose();
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; ms.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); });
    },
  };
}
