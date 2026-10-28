/* Le Moulage — jeu solo en 3D (three.js) : on fait son moule en sable, on place les noyaux, on perce les évents,
   on pose les masselottes, on règle la température puis on coule. Au décochage, la pièce est contrôlée :
   chaque défaut métallurgique est montré sur la pièce et expliqué. Trois pièces de plus en plus complexes. */
'use strict';

/* ---------- les pièces : formes (en unités de scène), noyaux, points chauds, masselottes possibles ---------- */
const ML_ALLOYS = {
  fonte: { name: 'Fonte grise EN-GJL-250', liquidus: 1200, ideal: [1360, 1420], cold: '#6a6f77' },
  alu: { name: 'Aluminium AS7G06', liquidus: 615, ideal: [690, 740], cold: '#c9ccd1' },
};
const ML_PARTS = [
  {
    name: 'Roue de wagonnet', alloy: 'fonte', ram: 0.9,
    prims: [{ t: 'cyl', x: 0, y: 6, z: 0, r: 42, h: 12 }, { t: 'cyl', x: 0, y: 15, z: 0, r: 15, h: 30 }],
    top: 30,
    cores: [{ shape: 'cyl', r: 7, h: 34, axis: 'y', x: 0, y: 15, z: 0, label: 'Noyau d’alésage Ø14' }],
    decoys: [{ shape: 'box', w: 20, h: 10, d: 30, x: 0, y: 0, z: 0, label: 'Noyau-boîte 20×30' }],
    hot: [{ x: 0, y: 30, z: 0, name: 'moyeu épais' }],
    feeders: [{ x: 0, y: 30, z: 0 }, { x: 30, y: 12, z: 0 }, { x: -30, y: 12, z: 0 }, { x: 0, y: 12, z: 30 }],
    sprue: { x: 28, y: 12, z: -28 },
  },
  {
    name: 'Carter de pompe', alloy: 'alu', ram: 1.15,
    prims: [{ t: 'box', x: 0, y: 17, z: 0, w: 80, h: 34, d: 56 }, { t: 'cyl', x: 55, y: 17, z: 0, r: 12, h: 30, axis: 'x' },
      { t: 'cyl', x: -30, y: 39, z: -18, r: 10, h: 10 }, { t: 'cyl', x: 30, y: 39, z: 18, r: 10, h: 10 }],
    top: 44,
    cores: [{ shape: 'box', w: 60, h: 24, d: 38, x: 0, y: 17, z: 0, label: 'Noyau de chambre 60×38' },
      { shape: 'cyl', r: 7, h: 40, axis: 'x', x: 52, y: 17, z: 0, label: 'Noyau de sortie Ø14' }],
    decoys: [{ shape: 'cyl', r: 10, h: 30, axis: 'y', x: 0, y: 0, z: 0, label: 'Noyau Ø20 droit' }],
    hot: [{ x: -30, y: 44, z: -18, name: 'bossage' }, { x: 30, y: 44, z: 18, name: 'bossage' }],
    feeders: [{ x: -30, y: 44, z: -18 }, { x: 30, y: 44, z: 18 }, { x: 0, y: 34, z: 0 }, { x: -28, y: 34, z: 18 }],
    sprue: { x: 30, y: 34, z: -20 },
  },
  {
    name: 'Bloc-cylindres', alloy: 'fonte', ram: 1.4,
    prims: [{ t: 'box', x: 0, y: 25, z: 0, w: 112, h: 50, d: 56 }, { t: 'box', x: -62, y: 30, z: 0, w: 14, h: 60, d: 60 }, { t: 'box', x: 62, y: 30, z: 0, w: 14, h: 60, d: 60 }],
    top: 60,
    cores: [{ shape: 'cyl', r: 11, h: 54, axis: 'y', x: -36, y: 25, z: -4, label: 'Noyau de cylindre Ø22' },
      { shape: 'cyl', r: 11, h: 54, axis: 'y', x: 0, y: 25, z: -4, label: 'Noyau de cylindre Ø22' },
      { shape: 'cyl', r: 11, h: 54, axis: 'y', x: 36, y: 25, z: -4, label: 'Noyau de cylindre Ø22' },
      { shape: 'box', w: 100, h: 30, d: 6, x: 0, y: 25, z: 22, label: 'Noyau de chemise d’eau 100×6' }],
    decoys: [{ shape: 'box', w: 30, h: 30, d: 30, x: 0, y: 0, z: 0, label: 'Noyau cubique 30' }, { shape: 'cyl', r: 7, h: 40, axis: 'x', x: 0, y: 0, z: 0, label: 'Noyau Ø14 couché' }],
    hot: [{ x: -62, y: 60, z: 0, name: 'bride épaisse' }, { x: 62, y: 60, z: 0, name: 'bride épaisse' }],
    feeders: [{ x: -62, y: 60, z: 0 }, { x: 62, y: 60, z: 0 }, { x: -18, y: 50, z: -20 }, { x: 18, y: 50, z: 10 }, { x: -40, y: 50, z: 18 }],
    sprue: { x: 20, y: 50, z: -22 },
  },
];
const ML_DEFECTS = {
  retassure: { name: 'Retassure', crit: true, why: 'Le métal se contracte en refroidissant : un point chaud sans masselotte pour l’alimenter laisse une cavité.' },
  soufflure_noyau: { name: 'Soufflures de noyau', crit: false, why: 'Les gaz du noyau n’avaient pas d’évent pour s’échapper : ils ont traversé le métal.' },
  gale: { name: 'Gale (inclusions de sable)', crit: false, why: 'Sable pas assez serré : il s’est érodé sous le jet de métal et s’est incrusté dans la pièce.' },
  soufflure_sable: { name: 'Soufflures (sable trop serré)', crit: false, why: 'Sable trop serré, plus assez perméable : les gaz sont restés piégés contre la paroi.' },
  malvenue: { name: 'Malvenue', crit: true, why: 'Métal trop froid : il s’est figé avant de remplir toute l’empreinte.' },
  reprise: { name: 'Reprise de coulée', crit: false, why: 'Coulée interrompue ou métal un peu froid : deux fronts de métal se sont mal soudés.' },
  penetration: { name: 'Pénétration / brûlure', crit: false, why: 'Métal trop chaud : il a pénétré entre les grains de sable, surface rugueuse à reprendre.' },
  inclusions: { name: 'Inclusions d’oxydes', crit: false, why: 'Coulée trop turbulente : de l’air et des oxydes ont été entraînés dans le métal.' },
  bavure: { name: 'Bavures', crit: false, why: 'On a continué à verser une fois le moule plein : le métal a débordé au plan de joint.' },
  manque: { name: 'Pièce incomplète', crit: true, why: 'Le moule n’a pas été rempli jusqu’au bout.' },
};

GAMES.push({
  id: 'moulage', title: 'Le Moulage 3D', teinte: 'acier', product: 'capuche',
  pitch: 'Fais ton moule en sable, place les noyaux, perce les évents, pose les masselottes, règle la température et coule. Au décochage, chaque défaut métallurgique est montré sur la pièce : évite le rebut !',
  how: 'Trois pièces : roue de wagonnet, carter de pompe en aluminium, bloc-cylindres. <b>Clic</b> sur les objets en 3D, <b>glisser</b> pour tourner autour du moule, <b>molette</b> pour zoomer. Serrage : <b>clic ou Espace</b> dans la zone verte. Noyaux : choisis-le à gauche, <b>R</b> pour le tourner, puis clique sa portée. Coulée : <b>maintiens</b> pour verser, garde le débit dans le vert et relâche quand c’est plein.',
  run: runMoulage,
});

function runMoulage(stage, api) {
  let alive = true, client = null;
  stage.innerHTML = '<div class="screen"><p>Préparation de l’atelier de moulage…</p></div>';
  loadThree().then(() => { if (alive) { stage.innerHTML = ''; client = moulage3d(stage, api); } })
    .catch(e => { if (alive) stage.innerHTML = `<div class="screen"><h4>Oups</h4><p>${esc(e.message)}</p></div>`; });
  return () => { alive = false; if (client) client(); };
}

function moulage3d(stage, api) {
  const W = 960, H = 540;
  const wrap = document.createElement('div'); wrap.className = 'play-wrap'; stage.appendChild(wrap);
  const screen = document.createElement('div'); screen.className = 'tk-screen ml-screen'; wrap.appendChild(screen);
  const { c: hud, g } = makeCanvas(screen, W, H);
  hud.classList.add('tk-hud');
  const panel = document.createElement('div'); panel.className = 'ml-panel'; panel.dataset.overlay = '1'; screen.appendChild(panel);
  const hint = document.createElement('p'); hint.className = 'keys-hint';
  hint.textContent = 'CLIC SUR LES OBJETS · GLISSER POUR TOURNER · MOLETTE ZOOM · R TOURNER LE NOYAU · ESPACE / MAINTIEN POUR SERRER ET COULER';
  wrap.appendChild(hint);

  /* ---------- scène ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.localClippingEnabled = true;
  const canvas = renderer.domElement; canvas.className = 'tk-3d'; canvas.dataset.overlay = '1';
  screen.insertBefore(canvas, hud);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1a120d');
  scene.fog = new THREE.Fog('#1a120d', 500, 1100);
  const cam = new THREE.PerspectiveCamera(45, W / H, 1, 3000);
  scene.add(new THREE.HemisphereLight('#ffe8d0', '#3a1c0c', 0.8));
  const sun = new THREE.DirectionalLight('#fff0dc', 0.8); sun.position.set(120, 260, 160); scene.add(sun);
  const glow = new THREE.PointLight('#ff7a2a', 0, 500, 1.5); glow.position.set(0, 120, 0); scene.add(glow);
  const M = (color, extra) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.1, ...(extra || {}) }); m.color.convertSRGBToLinear(); if (m.emissive) m.emissive.convertSRGBToLinear(); return m; };
  // atelier : sol, établi, four au fond
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), M('#3a3330', { roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -60; scene.add(floor);
  const bench = new THREE.Mesh(new THREE.BoxGeometry(300, 30, 220), M('#4a3a2c')); bench.position.y = -45; scene.add(bench);
  const furnace = new THREE.Mesh(new THREE.CylinderGeometry(70, 80, 160, 18), M('#2b2522')); furnace.position.set(-260, 20, -240); scene.add(furnace);
  const fTop = new THREE.Mesh(new THREE.CircleGeometry(55, 18), new THREE.MeshBasicMaterial({ color: '#ffb347' })); fTop.rotation.x = -Math.PI / 2; fTop.position.set(-260, 101, -240); scene.add(fTop);
  const fLight = new THREE.PointLight('#ff7a2a', 1.2, 600, 1.5); fLight.position.set(-260, 160, -240); scene.add(fLight);

  const sandTex = tkTexture(128, 128, (b, w, h) => { b.fillStyle = '#b08a5a'; b.fillRect(0, 0, w, h); for (let i = 0; i < 1600; i++) { b.fillStyle = `rgba(${Math.random() < 0.5 ? '60,40,20' : '255,240,210'},${0.08 + Math.random() * 0.1})`; b.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); } }, [3, 3]);
  const coreTex = tkTexture(64, 64, (b, w, h) => { b.fillStyle = '#e2d2a8'; b.fillRect(0, 0, w, h); for (let i = 0; i < 500; i++) { b.fillStyle = `rgba(120,90,50,${0.08 + Math.random() * 0.1})`; b.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); } });
  const coreMat = new THREE.MeshStandardMaterial({ map: coreTex, roughness: 0.9 });

  // géométrie d'une primitive (boîte ou cylindre couché selon un axe)
  const primMesh = (p, mat) => {
    let geo;
    if (p.t === 'box' || p.shape === 'box') geo = new THREE.BoxGeometry(p.w, p.h, p.d);
    else geo = new THREE.CylinderGeometry(p.r, p.r, p.h, 28);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(p.x, p.y, p.z);
    if (p.axis === 'x') m.rotation.z = Math.PI / 2; else if (p.axis === 'z') m.rotation.x = Math.PI / 2;
    return m;
  };

  /* ---------- état de la partie ---------- */
  let partIdx = -1, part, total = 0, partScore = 0;
  let step = '', stepT = 0;
  let group = null;                  // tout ce qui appartient à la pièce en cours (retiré à la suivante)
  let rams = [], ramPos = 0, ramDir = 1, rammer = null, ramAnim = 0;
  let tray = [], selected = null, slots = [], sloppy = 0;
  let feederSpots = [], hotMarks = [], vents = [];
  let temp = 1300;
  let fill = 0, flow = 0, holding = false, turbulence = 0, gap = 0, started = false, overT = 0, interrupted = false, fullAt = 0;
  let metalMat = null, metalPlane = null, cope = null, ladle = null, stream = null, sprueCup = null;
  let defects = [], markers = [], coolT = 0;
  let msg = '', msgAt = 0;
  const say = (m) => { msg = m; msgAt = performance.now(); };
  const A = () => ML_ALLOYS[part.alloy];

  /* ---------- caméra orbitale ---------- */
  let yaw = 0.6, pitch = 0.85, dist = 400, target = new THREE.Vector3(-70, 10, 40);
  let drag = null, moved = 0;
  const placeCam = () => { cam.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * dist, target.y + Math.sin(pitch) * dist, target.z + Math.cos(yaw) * Math.cos(pitch) * dist); cam.lookAt(target); };
  const ray = new THREE.Raycaster();
  const pickables = [];
  const pick = e => {
    const r = hud.getBoundingClientRect();
    ray.setFromCamera({ x: (e.clientX - r.left) / r.width * 2 - 1, y: -((e.clientY - r.top) / r.height * 2 - 1) }, cam);
    const hits = ray.intersectObjects(pickables.filter(o => o.visible), true);
    for (const h of hits) { let o = h.object; while (o && !o.userData.pick) o = o.parent; if (o) return o; }
    return null;
  };
  hud.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; moved = 0; hud.setPointerCapture(e.pointerId); if (step === 'pour' || step === 'ram') press(true); });
  hud.addEventListener('pointermove', e => {
    if (!drag) { const o = pick(e); hud.style.cursor = o ? 'pointer' : 'grab'; return; }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; moved += Math.abs(dx) + Math.abs(dy);
    if (step !== 'pour') { yaw -= dx * 0.008; pitch = Math.max(0.2, Math.min(1.45, pitch + dy * 0.006)); }
    drag = { x: e.clientX, y: e.clientY };
  });
  hud.addEventListener('pointerup', e => {
    if (step === 'pour') press(false);
    if (drag && moved < 6) { const o = pick(e); if (o) clickObj(o); }
    drag = null;
  });
  hud.addEventListener('wheel', e => { e.preventDefault(); dist = Math.max(160, Math.min(560, dist * (1 + Math.sign(e.deltaY) * 0.08))); }, { passive: false });
  const kd = e => {
    if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) press(true); }
    else if (e.code === 'KeyR' && step === 'cores' && selected) { selected.rot = (selected.rot + 90) % 180; renderPanel(); SFX.tick(); }
  };
  const ku = e => { if (e.code === 'Space') press(false); };
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);

  function press(down) {
    if (step === 'ram' && down) doRam();
    if (step === 'pour') { holding = down; if (down) started = true; }
  }

  /* ---------- déroulé d'une pièce ---------- */
  function nextPart() {
    partIdx++;
    if (partIdx >= ML_PARTS.length) { api.end(total); step = 'end'; renderPanel(); return; }
    part = ML_PARTS[partIdx];
    if (group) { scene.remove(group); group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    group = new THREE.Group(); scene.add(group);
    pickables.length = 0;
    rams = []; ramPos = 0; ramDir = 1; tray = []; selected = null; slots = []; sloppy = 0; vents = []; feederSpots = []; hotMarks = [];
    temp = A().liquidus + 60; fill = 0; flow = 0; holding = false; turbulence = 0; gap = 0; started = false; overT = 0; interrupted = false; fullAt = 0;
    defects = []; markers = []; coolT = 0;
    api.info(`Pièce ${partIdx + 1}/${ML_PARTS.length} · ${part.name}`);
    // châssis vert et sable du dessous (transparent : on voit l'empreinte comme en coupe)
    const top = part.top;
    const frameM = M('#2f6b4a', { metalness: 0.5, roughness: 0.4 });
    [[0, -88, 196, 12], [0, 88, 196, 12], [-98, 0, 12, 176], [98, 0, 12, 176]].forEach(([x, z, w, d]) => { const f = new THREE.Mesh(new THREE.BoxGeometry(w, top + 30, d), frameM); f.position.set(x, (top + 30) / 2 - 28, z); group.add(f); });
    const drag2 = new THREE.Mesh(new THREE.BoxGeometry(184, top + 26, 164), new THREE.MeshStandardMaterial({ map: sandTex, transparent: true, opacity: 0.42, depthWrite: false, roughness: 1 }));
    drag2.position.y = (top + 26) / 2 - 26; group.add(drag2);
    // empreinte de la pièce (sombre) et métal (caché jusqu'à la coulée)
    const cav = new THREE.Group();
    const cavMat = M('#1a120c', { roughness: 1 });
    part.prims.forEach(p => cav.add(primMesh(p, cavMat)));
    group.add(cav);
    metalPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), -1);
    metalMat = new THREE.MeshStandardMaterial({ color: '#ff8a2a', emissive: '#ff5a10', emissiveIntensity: 1.2, roughness: 0.4, metalness: 0.3, clippingPlanes: [metalPlane] });
    const metal = new THREE.Group(); metal.name = 'metal';
    part.prims.forEach(p => { const m = primMesh({ ...p, r: p.r ? p.r + 0.4 : p.r, w: p.w && p.w + 0.6, h: p.h + 0.6, d: p.d && p.d + 0.6 }, metalMat); metal.add(m); });
    group.add(metal);
    // pilon de serrage
    rammer = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 120, 8), M('#7a5434')); shaft.position.y = 60; rammer.add(shaft);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 10, 16), M('#5c6067', { metalness: 0.7 })); rammer.add(foot);
    rammer.position.set(-50, top + 60, 40); group.add(rammer);
    goStep('ram');
  }

  function goStep(s) {
    step = s; stepT = 0;
    if (s === 'cores') setupCores();
    if (s === 'vents') setupVents();
    if (s === 'feeders') setupFeeders();
    if (s === 'close') closeMould();
    if (s === 'pour') setupPour();
    if (s === 'result') shakeOut();
    renderPanel();
  }

  /* 1) serrage du sable : arrêter le curseur dans la zone verte, trois fois */
  function doRam() {
    if (rams.length >= 3) return;
    rams.push(ramPos);
    ramAnim = 0.3;
    const ok = ramPos >= 0.4 && ramPos <= 0.6;
    sfx(ok ? 140 : 90, 0.12, 'square', 0.06, -40);
    say(ok ? 'Bien serré !' : ramPos < 0.4 ? 'Pas assez serré' : 'Trop serré');
    if (rams.length === 3) setTimeout(() => { rammer.visible = false; goStep('cores'); }, 700);
    renderPanel();
  }

  /* 2) noyaux : choisir dans le bac, tourner (R), cliquer la portée */
  const coreKey = c => c.shape === 'box' ? `box${c.w}x${c.h}x${c.d}` : `cyl${c.r}x${c.h}`;
  const coreRot = c => c.shape === 'box' ? 0 : (c.axis === 'z' ? 90 : 0);
  const coreSym = c => (c.shape === 'cyl' && c.axis === 'y') || (c.shape === 'box' && c.w === c.d);
  function setupCores() {
    const all = [...part.cores.map(c => ({ ...c })), ...part.decoys.map(c => ({ ...c, decoy: true }))];
    tray = all.map((c, i) => ({ ...c, id: i, rot: c.decoy || coreSym(c) ? 0 : Math.random() < 0.5 ? 0 : 90, used: false })).sort(() => Math.random() - 0.5);
    slots = part.cores.map((c, i) => {
      const ghost = primMesh({ ...c, t: c.shape }, new THREE.MeshBasicMaterial({ color: '#7fd4ff', wireframe: true, transparent: true, opacity: 0.7 }));
      const grp = new THREE.Group(); grp.add(ghost); grp.userData = { pick: true, kind: 'slot', i };
      group.add(grp); pickables.push(grp);
      return { def: c, grp, filled: false, mesh: null };
    });
    say('Choisis un noyau à gauche, puis clique sa portée (en bleu)');
  }
  function placeCore(slot) {
    if (!selected) { say('Choisis d’abord un noyau dans le bac'); return; }
    if (slot.filled) return;
    const c = slot.def;
    if (coreKey(selected) !== coreKey(c)) { sloppy++; say('Ce noyau ne rentre pas dans cette portée'); SFX.bad(); return; }
    // orientation : un noyau couché ou une boîte allongée doivent être tournés comme la portée
    const want = coreRot(c);
    const have = selected.shape === 'cyl' ? (selected.rot === 90 ? 90 : 0) : selected.rot;
    if (!coreSym(c) && have !== want) { sloppy++; say('Mauvaise orientation : tourne-le avec R'); SFX.bad(); return; }
    slot.filled = true; selected.used = true; selected = null;
    slot.grp.visible = false;
    const m = primMesh({ ...c, t: c.shape }, coreMat); m.userData.baseY = c.y; m.userData.drop = true; m.position.y = c.y + 40; group.add(m); slot.mesh = m;
    sfx(520, 0.08, 'triangle', 0.05); SFX.good && SFX.good();
    if (slots.every(s => s.filled)) setTimeout(() => goStep('vents'), 600);
    renderPanel();
  }

  /* 3) évents : percer chaque noyau pour laisser sortir ses gaz */
  function setupVents() {
    vents = slots.map((s, i) => {
      const c = s.def;
      const topY = c.axis === 'y' || c.shape === 'box' ? c.y + c.h / 2 : c.y + c.r;
      const ex = c.axis === 'x' ? c.x + c.h / 2 - 4 : c.x;
      const mk = new THREE.Group(); mk.position.set(ex, topY + 1, c.z);
      const dot = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 2, 12), new THREE.MeshBasicMaterial({ color: '#111' }));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(7, 1.2, 6, 18), new THREE.MeshBasicMaterial({ color: '#F5B700' })); ring.rotation.x = Math.PI / 2;
      mk.add(dot, ring); mk.userData = { pick: true, kind: 'vent', i };
      group.add(mk); pickables.push(mk);
      return { mk, ring, done: false, pos: mk.position.clone() };
    });
    say('Clique chaque noyau pour percer son évent');
  }
  function drill(v) {
    if (v.done) return;
    v.done = true; v.ring.visible = false;
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, part.top - v.pos.y + 34, 8), M('#e2d2a8'));
    tube.position.set(v.pos.x, v.pos.y + (part.top - v.pos.y + 34) / 2, v.pos.z); group.add(tube);
    sfx(900, 0.06, 'square', 0.03); renderPanel();
  }

  /* 4) masselottes : réservoirs de métal au-dessus des points chauds */
  function setupFeeders() {
    hotMarks = part.hot.map(h => { const s = new THREE.Mesh(new THREE.SphereGeometry(9, 14, 10), new THREE.MeshBasicMaterial({ color: '#ff3a2a', transparent: true, opacity: 0.5, depthWrite: false })); s.position.set(h.x, h.y - 6, h.z); group.add(s); return s; });
    feederSpots = part.feeders.map((f, i) => {
      const grp = new THREE.Group(); grp.position.set(f.x, f.y, f.z);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(9, 1.6, 6, 20), new THREE.MeshBasicMaterial({ color: '#7fd4ff' })); ring.rotation.x = Math.PI / 2; ring.position.y = 1;
      const riser = new THREE.Mesh(new THREE.CylinderGeometry(9, 10, 34, 18), M('#5a4632')); riser.position.y = 17; riser.visible = false;
      grp.add(ring, riser); grp.userData = { pick: true, kind: 'feeder', i };
      group.add(grp); pickables.push(grp);
      return { f, grp, ring, riser, on: false };
    });
    say('Les points chauds (en rouge) refroidissent en dernier : pose des masselottes');
  }
  function toggleFeeder(s) { s.on = !s.on; s.riser.visible = s.on; s.ring.material.color.set(s.on ? '#F5B700' : '#7fd4ff'); sfx(s.on ? 600 : 400, 0.06, 'triangle', 0.04); renderPanel(); }

  /* 5) fermeture : la chape (sable du dessus) descend, avec le godet de coulée */
  function closeMould() {
    hotMarks.forEach(h => { h.visible = false; });
    feederSpots.forEach(s => { s.ring.visible = false; });
    pickables.length = 0;
    cope = new THREE.Group();
    const sandTop = new THREE.Mesh(new THREE.BoxGeometry(184, 34, 164), new THREE.MeshStandardMaterial({ map: sandTex, transparent: true, opacity: 0.35, depthWrite: false, roughness: 1 }));
    sandTop.position.y = part.top + 17; cope.add(sandTop);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(196, 34, 176), new THREE.MeshStandardMaterial({ color: '#2f6b4a', wireframe: true }));
    frame.position.y = part.top + 17; cope.add(frame);
    const sp = part.sprue;
    sprueCup = new THREE.Mesh(new THREE.CylinderGeometry(14, 5, 16, 18, 1, true), M('#5a4632', { side: THREE.DoubleSide })); sprueCup.position.set(sp.x, part.top + 42, sp.z); cope.add(sprueCup);
    const sprue = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, part.top + 34 - sp.y, 10), M('#1a120c')); sprue.position.set(sp.x, sp.y + (part.top + 34 - sp.y) / 2, sp.z); cope.add(sprue);
    cope.position.y = 140; group.add(cope);
    sfx(80, 0.4, 'triangle', 0.05);
  }

  /* 6) coulée */
  function setupPour() {
    const sp = part.sprue;
    ladle = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(22, 16, 34, 20), M('#3a3d42', { metalness: 0.6 }));
    const lava = new THREE.Mesh(new THREE.CircleGeometry(20, 20), new THREE.MeshBasicMaterial({ color: '#ffb347' })); lava.rotation.x = -Math.PI / 2; lava.position.y = 17.5;
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 90, 8), M('#5c6067')); handle.rotation.z = Math.PI / 2; handle.position.x = -60;
    ladle.add(body, lava, handle);
    ladle.position.set(sp.x - 26, part.top + 95, sp.z); group.add(ladle);
    stream = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 1, 8), new THREE.MeshBasicMaterial({ color: '#ffcf6a' })); stream.visible = false; group.add(stream);
    target.set(sp.x * 0.5 - 50, part.top * 0.6, sp.z * 0.5 + 30);
  }

  /* 7) décochage et contrôle */
  function shakeOut() {
    holding = false;
    const T = temp, [lo, hi] = A().ideal;
    const add = (k, pos) => defects.push({ k, pos: pos || new THREE.Vector3(0, part.top, 0) });
    // serrage
    const under = rams.filter(r => r < 0.4).length, over = rams.filter(r => r > 0.6).length;
    if (under >= 2) add('gale', new THREE.Vector3(-30, 8, 20));
    if (over >= 2) add('soufflure_sable', new THREE.Vector3(30, 8, -20));
    // noyaux non ventilés
    const unvented = vents.filter(v => !v.done);
    if (unvented.length) add('soufflure_noyau', unvented[0].pos.clone());
    // retassures : points chauds sans masselotte
    part.hot.forEach(h => { if (!feederSpots.some(s => s.on && Math.hypot(s.f.x - h.x, s.f.z - h.z) < 6)) add('retassure', new THREE.Vector3(h.x, h.y - 6, h.z)); });
    // température
    if (T < lo - 40) add('malvenue', new THREE.Vector3(-40, part.top - 4, 0));
    else if (T < lo) add('reprise', new THREE.Vector3(-20, part.top / 2, 10));
    if (T > hi + 40) add('penetration', new THREE.Vector3(20, 4, 20));
    // déroulé de la coulée
    if (fill < 0.98) add('manque', new THREE.Vector3(0, part.top, 0));
    if (turbulence > 0.7) add('inclusions', new THREE.Vector3(part.sprue.x, part.top - 4, part.sprue.z));
    if (interrupted && !defects.some(d => d.k === 'reprise')) add('reprise', new THREE.Vector3(-20, part.top / 2, 10));
    if (overT > 0.7) add('bavure', new THREE.Vector3(part.sprue.x, part.top + 2, part.sprue.z));
    // points : 100 par pièce, -45 par défaut critique, -15 par défaut mineur, petites pénalités d'atelier
    const extra = Math.max(0, feederSpots.filter(s => s.on).length - part.hot.length);
    partScore = 100 - defects.reduce((a, d) => a + (ML_DEFECTS[d.k].crit ? 45 : 15), 0) - extra * 4 - Math.min(15, sloppy * 3);
    partScore = Math.max(0, partScore);
    total += partScore * 10;
    api.score(total);
    // marqueurs rouges sur la pièce
    markers = defects.map(d => { const s = new THREE.Mesh(new THREE.SphereGeometry(6, 12, 10), new THREE.MeshBasicMaterial({ color: '#ff2a2a' })); s.position.copy(d.pos); s.visible = false; group.add(s); return s; });
    coolT = 0;
    const rebut = defects.some(d => ML_DEFECTS[d.k].crit);
    setTimeout(() => { (rebut ? SFX.bad : SFX.good)(); }, 1400);
    renderPanel();
  }

  function clickObj(o) {
    const u = o.userData;
    if (step === 'cores' && u.kind === 'slot') placeCore(slots[u.i]);
    else if (step === 'vents' && u.kind === 'vent') drill(vents[u.i]);
    else if (step === 'feeders' && u.kind === 'feeder') toggleFeeder(feederSpots[u.i]);
  }

  /* ---------- panneau d'instructions ---------- */
  function renderPanel() {
    const steps = ['ram', 'cores', 'vents', 'feeders', 'temp', 'pour', 'result'];
    const names = ['Serrage', 'Noyaux', 'Évents', 'Masselottes', 'Température', 'Coulée', 'Contrôle'];
    const prog = step === 'end' ? '' : `<ol class="ml-steps">${steps.map((s, i) => `<li class="${s === step || (s === 'pour' && step === 'close') ? 'on' : steps.indexOf(step) > i ? 'done' : ''}">${names[i]}</li>`).join('')}</ol>`;
    let body = '';
    if (step === 'ram') body = `<h4>1 · Serrer le sable</h4><p>Tasse le sable autour du modèle : arrête le curseur dans la <b>zone verte</b> (clic ou Espace). Trop peu serré : le sable s'érode ; trop serré : les gaz ne passent plus.</p><p class="ml-big">${rams.length}/3 coups</p>`;
    else if (step === 'cores') body = `<h4>2 · Placer les noyaux</h4><p>Les noyaux forment les creux de la pièce. Choisis-en un, <b>R</b> pour le tourner, puis clique sa portée bleue.</p>
      <div class="ml-tray">${tray.map(c => `<button type="button" data-core="${c.id}" class="${selected && selected.id === c.id ? 'on' : ''}" ${c.used ? 'disabled' : ''}><i class="ml-ico ${c.shape} ${c.shape === 'cyl' ? (c.axis === 'y' ? 'up' : (c.rot === 90 ? 'z' : 'x')) : (c.rot === 90 ? 'z' : 'x')}"></i><span>${c.label}</span><small>${c.shape === 'cyl' && c.axis === 'y' ? 'debout' : c.rot === 90 ? 'orienté ↕' : 'orienté ↔'}</small></button>`).join('')}</div>
      ${selected ? '<button type="button" class="btn btn-sm btn-ghost" id="mlRot">↻ Tourner (R)</button>' : ''}`;
    else if (step === 'vents') body = `<h4>3 · Percer les évents</h4><p>En chauffant, le liant des noyaux dégage des gaz. Perce un évent dans chaque noyau (clique les anneaux jaunes).</p><p class="ml-big">${vents.filter(v => v.done).length}/${vents.length}</p><button type="button" class="btn btn-hot" id="mlNext">Continuer ▶</button>`;
    else if (step === 'feeders') body = `<h4>4 · Poser les masselottes</h4><p>Les zones épaisses (<b style="color:#ff6a5a">points chauds</b>) refroidissent en dernier et se creusent. Une masselotte au-dessus les alimente en métal. Clique les anneaux pour en poser ; chacune coûte du métal.</p><p class="ml-big">${feederSpots.filter(s => s.on).length} masselotte(s)</p><button type="button" class="btn btn-hot" id="mlNext">Fermer le moule ▶</button>`;
    else if (step === 'temp') { const a = A(); body = `<h4>5 · Température de coulée</h4><p><b>${a.name}</b> · liquidus ${a.liquidus} °C. On coule avec une surchauffe : trop froid, le métal se fige avant de tout remplir ; trop chaud, il brûle le sable.</p><label class="ml-temp"><input type="range" id="mlTemp" min="${a.liquidus}" max="${a.liquidus + 320}" step="5" value="${temp}"><b id="mlTempV">${temp} °C</b></label><button type="button" class="btn btn-hot" id="mlNext">Couler ▶</button>`; }
    else if (step === 'pour' || step === 'close') body = `<h4>6 · Couler</h4><p><b>Maintiens</b> (clic ou Espace) pour verser. Garde le débit dans la <b>zone verte</b> : trop fort, ça tourbillonne ; une interruption fait une reprise. Relâche quand le métal monte dans les masselottes.</p>`;
    else if (step === 'result') {
      const rebut = defects.some(d => ML_DEFECTS[d.k].crit);
      body = `<h4>7 · Décochage et contrôle</h4><p class="ml-verdict ${rebut ? 'bad' : defects.length ? 'mid' : 'good'}">${rebut ? 'REBUT' : defects.length ? 'PIÈCE À RETOUCHER' : 'PIÈCE CONFORME'} · ${partScore}/100</p>
        ${defects.length ? `<ul class="ml-defects">${defects.map(d => `<li class="${ML_DEFECTS[d.k].crit ? 'crit' : ''}"><b>${ML_DEFECTS[d.k].name}</b>${ML_DEFECTS[d.k].crit ? ' · critique' : ''}<small>${ML_DEFECTS[d.k].why}</small></li>`).join('')}</ul>` : '<p>Aucun défaut : bravo, la pièce part à l’usinage.</p>'}
        <button type="button" class="btn btn-hot" id="mlNext">${partIdx + 1 < ML_PARTS.length ? 'Pièce suivante ▶' : 'Terminer ▶'}</button>`;
    } else if (step === 'end') body = `<h4>Fin de la série</h4><p class="ml-big">${total} points</p>`;
    panel.innerHTML = `<div class="ml-card"><span class="ml-part">${part ? `Pièce ${partIdx + 1}/${ML_PARTS.length} · ${part.name}` : ''}</span>${prog}${body}</div>`;
    panel.querySelectorAll('[data-core]').forEach(b => b.addEventListener('click', () => { selected = tray.find(c => c.id === +b.dataset.core); SFX.tick(); renderPanel(); }));
    const rot = panel.querySelector('#mlRot'); if (rot) rot.addEventListener('click', () => { selected.rot = (selected.rot + 90) % 180; renderPanel(); SFX.tick(); });
    const tr = panel.querySelector('#mlTemp'); if (tr) tr.addEventListener('input', () => { temp = +tr.value; panel.querySelector('#mlTempV').textContent = `${temp} °C`; });
    const nx = panel.querySelector('#mlNext');
    if (nx) nx.addEventListener('click', () => {
      SFX.tick();
      if (step === 'vents') goStep('feeders');
      else if (step === 'feeders') { goStep('close'); setTimeout(() => goStep('temp'), 900); }
      else if (step === 'temp') goStep('pour');
      else if (step === 'result') nextPart();
    });
  }

  /* ---------- HUD ---------- */
  const v3 = new THREE.Vector3();
  const project = p => { v3.copy(p).project(cam); return v3.z < 1 ? [(v3.x + 1) / 2 * W, (1 - v3.y) / 2 * H] : null; };
  function drawHud(t) {
    g.clearRect(0, 0, W, H);
    const gx = 600, gw = 320;
    if (step === 'ram') {
      g.fillStyle = 'rgba(8,9,11,.8)'; g.fillRect(gx - 10, H - 70, gw + 20, 50);
      g.fillStyle = '#3a0d0d'; g.fillRect(gx, H - 50, gw, 16);
      g.fillStyle = '#2E9E5B'; g.fillRect(gx + gw * 0.4, H - 50, gw * 0.2, 16);
      g.fillStyle = '#fff'; g.fillRect(gx + gw * ramPos - 3, H - 56, 6, 28);
      g.font = '400 9px "Press Start 2P", monospace'; g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText('SERRAGE : CLIC DANS LE VERT', gx, H - 58);
      rams.forEach((r, i) => { g.fillStyle = r >= 0.4 && r <= 0.6 ? '#7FD48A' : '#ff6a5a'; g.fillRect(gx + gw * r - 1, H - 34, 3, 8); });
    }
    if (step === 'feeders') part.hot.forEach(h => { const s = project(new THREE.Vector3(h.x, h.y + 14, h.z)); if (s) { g.font = '800 12px Archivo, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#ff8a7a'; g.fillText(`POINT CHAUD · ${h.name}`, s[0], s[1]); } });
    if (step === 'pour') {
      g.fillStyle = 'rgba(8,9,11,.8)'; g.fillRect(gx - 10, H - 110, gw + 20, 90);
      g.font = '400 9px "Press Start 2P", monospace'; g.fillStyle = '#fff'; g.textAlign = 'left';
      g.fillText('DÉBIT', gx, H - 92);
      g.fillStyle = '#22262a'; g.fillRect(gx, H - 86, gw, 14);
      g.fillStyle = 'rgba(46,158,91,.6)'; g.fillRect(gx + gw * 0.4, H - 86, gw * 0.35, 14);
      g.fillStyle = flow > 0.75 ? '#ff6a5a' : '#ffb347'; g.fillRect(gx, H - 82, gw * flow, 6);
      g.fillStyle = '#fff'; g.fillText(`REMPLISSAGE ${Math.min(100, Math.round(fill * 100))} %`, gx, H - 52);
      g.fillStyle = '#22262a'; g.fillRect(gx, H - 46, gw, 12); g.fillStyle = '#EC641E'; g.fillRect(gx, H - 46, gw * Math.min(1, fill), 12);
      if (fill >= 1) bigText(g, 'PLEIN ! RELÂCHE', W / 2 + 120, 120, 34, '#F5B700');
      else if (!started) bigText(g, 'MAINTIENS POUR VERSER', W / 2 + 120, 120, 26, '#f2f4f7');
      if (turbulence > 0.4 && flow > 0.75) { g.font = '800 14px Archivo, sans-serif'; g.fillStyle = '#ff6a5a'; g.textAlign = 'center'; g.fillText('Trop fort : ça tourbillonne !', W / 2 + 120, 150); }
    }
    if (step === 'result') {
      defects.forEach((d, i) => { const s = project(d.pos); if (s && coolT > 1.4) { g.font = '800 12px Archivo, sans-serif'; g.textAlign = 'center'; g.fillStyle = ML_DEFECTS[d.k].crit ? '#ff5a5a' : '#ffd27a'; g.strokeStyle = '#000'; g.lineWidth = 3; g.strokeText(ML_DEFECTS[d.k].name.toUpperCase(), s[0], s[1] - 14); g.fillText(ML_DEFECTS[d.k].name.toUpperCase(), s[0], s[1] - 14); } });
    }
    if (msg && performance.now() - msgAt < 2000) { g.font = '800 16px Archivo, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 4; g.strokeText(msg, W / 2 + 120, 40); g.fillText(msg, W / 2 + 120, 40); }
    g.font = '900 20px "Big Shoulders Display", Impact'; g.textAlign = 'right'; g.fillStyle = '#F5B700'; g.fillText(`${total} pts`, W - 16, 30);
  }

  /* ---------- boucle ---------- */
  let lastW = 0, lastH = 0;
  nextPart();
  const stop = loop((dt, tms) => {
    const t = tms / 1000;
    stepT += dt;
    const cw = hud.clientWidth, ch = hud.clientHeight;
    if (cw && (cw !== lastW || ch !== lastH)) { lastW = cw; lastH = ch; renderer.setSize(cw, ch, false); canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px'; cam.aspect = cw / ch; cam.updateProjectionMatrix(); }
    if (step === 'ram' && rams.length < 3) {
      ramPos += ramDir * dt * (0.9 + rams.length * 0.25) * part.ram;
      if (ramPos > 1) { ramPos = 1; ramDir = -1; } if (ramPos < 0) { ramPos = 0; ramDir = 1; }
      rammer.position.x = -50 + Math.sin(t * 2) * 30;
    }
    if (ramAnim > 0) { ramAnim -= dt; rammer.position.y = part.top + 10 + Math.abs(Math.sin(ramAnim * 10)) * 50; }
    // noyaux qui descendent dans leur portée
    group.children.forEach(o => { if (o.userData.drop) { o.position.y = Math.max(o.userData.baseY, o.position.y - 160 * dt); if (o.position.y <= o.userData.baseY) delete o.userData.drop; } });
    slots.forEach(s => { if (!s.filled) s.grp.children[0].material.opacity = 0.4 + Math.sin(t * 5) * 0.3; });
    vents.forEach(v => { if (!v.done) v.ring.scale.setScalar(1 + Math.sin(t * 6) * 0.15); });
    hotMarks.forEach(h => { h.material.opacity = 0.35 + Math.sin(t * 4) * 0.2; });
    if (cope && cope.position.y > 0) cope.position.y = Math.max(0, cope.position.y - 220 * dt);
    // coulée
    if (step === 'pour') {
      const want = holding ? 1 : 0;
      flow += (want - flow) * Math.min(1, dt * (holding ? 1.6 : 3.5));
      if (flow > 0.05) fill += flow * dt * 0.22;
      if (started && fill < 1) {
        if (flow > 0.75) turbulence += dt;
        if (flow < 0.08) { gap += dt; if (gap > 0.9) interrupted = true; } else gap = 0;
      }
      if (fill >= 1 && holding) overT += dt;
      if (fill >= 1 && !fullAt) { fullAt = t; sfx(880, 0.2, 'triangle', 0.05); }
      // la poche bascule, le jet tombe dans le godet
      ladle.rotation.z = -flow * 0.9;
      const sp = part.sprue;
      stream.visible = flow > 0.04;
      if (stream.visible) { const top = part.top + 90, bot = part.top + 44; stream.scale.set(0.6 + flow, top - bot, 0.6 + flow); stream.position.set(sp.x, (top + bot) / 2, sp.z); }
      if (flow > 0.04 && Math.random() < 0.3) sfx(70 + Math.random() * 40, 0.05, 'sawtooth', 0.015);
      glow.intensity = flow * 1.5; glow.position.set(sp.x, part.top + 60, sp.z);
      if (fill >= 1 && !holding && flow < 0.05 && stepT > 0.5) { stream.visible = false; ladle.visible = false; goStep('result'); }
    }
    metalPlane.constant = step === 'pour' || step === 'result' ? Math.min(part.top + 2, fill * (part.top + 2)) : -1;
    // décochage : la chape se soulève, le sable s'efface, la pièce refroidit
    if (step === 'result') {
      coolT += dt;
      if (cope) { cope.position.y += 140 * dt; cope.children.forEach(o => { if (o.material) o.material.opacity = Math.max(0, (o.material.opacity ?? 1) - dt * 0.5); }); if (coolT > 1.2) cope.visible = false; }
      group.children.forEach(o => { if (o.material && o.material.map === sandTex) o.material.opacity = Math.max(0, 0.42 - coolT * 0.35); });
      const k = Math.min(1, coolT / 2.2);
      metalMat.emissiveIntensity = 1.2 * (1 - k);
      metalMat.color.set('#ff8a2a').lerp(new THREE.Color(A().cold), k);
      metalMat.metalness = 0.3 + k * 0.4;
      glow.intensity = (1 - k) * 1.2;
      markers.forEach(m => { m.visible = coolT > 1.4; m.scale.setScalar(1 + Math.sin(t * 6) * 0.2); });
      // les noyaux s'effritent : on voit les creux de la pièce
      slots.forEach(s => { if (s.mesh) s.mesh.visible = coolT < 1.6; });
    }
    fLight.intensity = 1.1 + Math.sin(t * 7) * 0.2;
    placeCam();
    renderer.render(scene, cam);
    drawHud(t);
  });

  return () => {
    stop();
    window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku);
    renderer.dispose();
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; ms.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); });
  };
}
