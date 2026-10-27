/* Coulée Galactique — shooter inspiré de la formule de Galaga, en 3D (three.js) :
   vagues en formation, piqués, rayon tracteur, double vaisseau, étapes bonus et bonus de tir.
   Vue à la 3e personne, à la 1re personne ou vue arcade (touche V). */
'use strict';

const GX_POWERS = {
  double:   { label: 'DOUBLE',   color: '#F5B700', dur: 15, desc: 'deux tirs parallèles' },
  eventail: { label: 'ÉVENTAIL', color: '#7fd4ff', dur: 12, desc: 'trois tirs en éventail' },
  laser:    { label: 'LASER',    color: '#ff5a5a', dur: 10, desc: 'tir perçant' },
  rafale:   { label: 'RAFALE',   color: '#ffffff', dur: 15, desc: 'tir rapide' },
  bouclier: { label: 'BOUCLIER', color: '#7fd48a', desc: 'encaisse un coup' },
  bombe:    { label: 'BOMBE',    color: '#EC641E', desc: 'nettoie l\'écran' },
};
const GX_VIEWS = [
  { id: 'tps', label: '3E PERSONNE' },
  { id: 'fps', label: '1RE PERSONNE' },
  { id: 'top', label: 'VUE ARCADE' },
];

function runGalaxie(stage, api) {
  let alive = true, client = null;
  stage.innerHTML = '<div class="screen"><p>Chargement de la 3D…</p></div>';
  loadThree().then(() => { if (alive) { stage.innerHTML = ''; client = galaxie3d(stage, api); } })
    .catch(e => { if (alive) stage.innerHTML = `<div class="screen"><h4>Oups</h4><p>${esc(e.message)}</p></div>`; });
  return () => { alive = false; if (client) client(); };
}

function galaxie3d(stage, api) {
  const W = 480, H = 640;           // terrain de jeu logique (x : largeur, y : profondeur)
  const SW = 960, SH = 540;         // écran
  const wrap = document.createElement('div'); wrap.className = 'play-wrap'; stage.appendChild(wrap);
  const screen = document.createElement('div'); screen.className = 'tk-screen'; wrap.appendChild(screen);
  const { c: hud, g } = makeCanvas(screen, SW, SH);
  hud.classList.add('tk-hud');
  const pad = document.createElement('div'); pad.className = 'touch-pad';
  pad.innerHTML = '<div class="grp"><button data-k="L">◀</button><button data-k="R">▶</button></div><div class="grp"><button data-k="V">VUE</button><button data-k="F" class="hot">FEU</button></div>';
  wrap.appendChild(pad);
  const hint = document.createElement('p'); hint.className = 'keys-hint';
  hint.textContent = '← → SE DÉPLACER · ESPACE / J TIRER (MAINTENIR) · V CHANGER DE VUE';
  wrap.appendChild(hint);

  /* ---------------- entrées ---------------- */
  let viewIdx = save.gxView || 0;
  const keys = { L: false, R: false, F: false };
  const KM = { ArrowLeft: 'L', KeyA: 'L', KeyQ: 'L', ArrowRight: 'R', KeyD: 'R', Space: 'F', KeyJ: 'F', KeyX: 'F', KeyV: 'V', KeyC: 'V' };
  const switchView = () => { viewIdx = (viewIdx + 1) % GX_VIEWS.length; save.gxView = viewIdx; persist(); viewFlash = 1.2; sfx(700, 0.08, 'triangle', 0.04); };
  const kd = e => { const k = KM[e.code]; if (!k) return; e.preventDefault(); if (k === 'V') { if (!e.repeat) switchView(); return; } keys[k] = true; };
  const ku = e => { const k = KM[e.code]; if (k && k !== 'V') keys[k] = false; };
  window.addEventListener('keydown', kd);
  window.addEventListener('keyup', ku);
  pad.querySelectorAll('[data-k]').forEach(b => {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', e => { e.preventDefault(); b.classList.add('on'); if (k === 'V') switchView(); else keys[k] = true; });
    const up = () => { b.classList.remove('on'); if (k !== 'V') keys[k] = false; };
    b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
  });

  /* ---------------- état du jeu ---------------- */
  let score = 0, lives = 3, stageN = 0;
  const extra = [20000, 70000];
  const best = save.best.galaxie || 0;
  const ship = { x: W / 2, y: H - 70, dual: false, alive: true, respawn: 0, inv: 0, captured: false, shield: false, cd: 0 };
  let shots = [], ebullets = [], enemies = [], drops = [], pops = [];
  let banner = '', bannerT = 0, formT = 0, diveT = 2, spawnQueue = [], challenge = false, challengeHits = 0, over = false, overT = 0;
  let capturedShip = null, power = null, viewFlash = 1.5, bombFlash = 0;

  /* trajectoires */
  function bez(p0, p1, p2, p3, n = 24) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      out.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
    }
    return out;
  }
  const mirror = path => path.map(([x, y]) => [W - x, y]);
  const ENTRY = [
    () => [...bez([W * 0.55, -30], [W * 0.55, 160], [W * 0.1, 260], [W * 0.18, 380]), ...bez([W * 0.18, 380], [W * 0.25, 470], [W * 0.5, 420], [W * 0.42, 300]).slice(1)],
    () => [...bez([-30, H * 0.72], [W * 0.3, H * 0.62], [W * 0.45, H * 0.45], [W * 0.3, H * 0.4]), ...bez([W * 0.3, H * 0.4], [W * 0.1, H * 0.35], [W * 0.15, H * 0.55], [W * 0.35, H * 0.5]).slice(1)],
  ];
  const SLOT_W = 40;
  function slotPos(row, col, cols) {
    const sway = Math.sin(formT * 1.2) * 18, breathe = 1 + Math.sin(formT * 2) * 0.05;
    return [W / 2 + (col - (cols - 1) / 2) * SLOT_W * breathe + sway, 80 + row * 38 * breathe];
  }
  const TYPES = { boss: { pts: [150, 400], hp: 2, r: 17 }, papi: { pts: [80, 160], hp: 1, r: 14 }, abeille: { pts: [50, 100], hp: 1, r: 13 } };

  function newStage() {
    stageN++;
    challenge = stageN % 4 === 3;
    challengeHits = 0;
    banner = challenge ? 'ÉTAPE BONUS' : `ÉTAPE ${stageN}`;
    bannerT = 2.4;
    enemies.forEach(e => removeMesh(e)); enemies = []; spawnQueue = [];
    const layout = [['boss', 0, 4], ['papi', 1, 8], ['papi', 2, 8], ['abeille', 3, 10], ['abeille', 4, 10]];
    const slots = [];
    layout.forEach(([type, row, cols]) => { for (let col = 0; col < cols; col++) slots.push({ type, row, col, cols }); });
    const groups = [slots.filter(s => s.type === 'papi' && s.row === 1).concat(slots.filter(s => s.type === 'boss')).slice(0, 8),
      slots.filter(s => s.type === 'abeille' && s.row === 3).slice(0, 8)];
    const used = new Set(groups.flat());
    const rest = slots.filter(s => !used.has(s));
    for (let i = 0; i < rest.length; i += 8) groups.push(rest.slice(i, i + 8));
    groups.forEach((grp, gi) => {
      const base = ENTRY[gi % 2]();
      grp.forEach((sl, k) => spawnQueue.push({ at: 2.4 + gi * 2.6 + Math.floor(k / 2) * 0.22, sl, path: k % 2 ? mirror(base) : base }));
    });
  }
  function spawn(q) {
    const t = TYPES[q.sl.type];
    const e = { ...q.sl, hp: t.hp, r: t.r, state: 'enter', path: q.path, pi: 0, x: q.path[0][0], y: q.path[0][1], a: Math.PI / 2, fireT: 0.6 + Math.random() * 1.2, beam: 0 };
    e.mesh = makeEnemyMesh(e.type);
    scene.add(e.mesh);
    enemies.push(e);
  }

  /* tirs, avec les bonus */
  function fire() {
    if (!ship.alive || over || ship.captured || ship.cd > 0) return;
    const P = power && power.type;
    const max = (ship.dual ? 4 : 2) * (P === 'rafale' ? 3 : P === 'double' || P === 'eventail' ? 2 : 1);
    if (shots.length >= max) return;
    ship.cd = P === 'rafale' ? 0.09 : 0.16;
    const guns = ship.dual ? [-16, 16] : [0];
    for (const gx of guns) {
      const x = ship.x + gx, y = ship.y - 18;
      if (P === 'double') { addShot(x - 7, y, 0, '#F5B700'); addShot(x + 7, y, 0, '#F5B700'); }
      else if (P === 'eventail') { addShot(x, y, -150, '#7fd4ff'); addShot(x, y, 0, '#7fd4ff'); addShot(x, y, 150, '#7fd4ff'); }
      else if (P === 'laser') addShot(x, y, 0, '#ff5a5a', true);
      else addShot(x, y, 0, P === 'rafale' ? '#ffffff' : '#fff3c0');
    }
    sfx(P === 'laser' ? 500 : 1200, P === 'laser' ? 0.12 : 0.06, P === 'laser' ? 'sawtooth' : 'square', 0.03, -700);
  }
  function addShot(x, y, vx, color, pierce = false) {
    const s = { x, y, vx, pierce, hit: new Set() };
    s.mesh = new THREE.Mesh(pierce ? geo.laser : geo.shot, mat(color, true));
    scene.add(s.mesh);
    shots.push(s);
  }

  function addScore(v, x, y) {
    score += v; api.score(score);
    if (v >= 150) pops.push({ x, y, txt: String(v), life: 0.9 });
    if (extra.length && score >= extra[0]) { extra.shift(); lives++; sfx(880, 0.3, 'triangle', 0.06); pops.push({ x: W / 2, y: H / 2, txt: 'VIE BONUS !', life: 1.5 }); }
  }
  function killShip() {
    if (!ship.alive) return;
    if (ship.shield) { ship.shield = false; ship.inv = 1; burst(ship.x, ship.y, 30, '#7fd48a'); sfx(400, 0.3, 'triangle', 0.06, -200); return; }
    burst(ship.x, ship.y, 60, '#ff8a2a', 1.4);
    sfx(90, 0.5, 'sawtooth', 0.07, -40);
    shake = 0.5;
    if (ship.dual) { ship.dual = false; ship.inv = 1.2; return; }
    ship.alive = false; lives--; ship.respawn = 2; power = null;
    if (lives <= 0) { over = true; overT = 2.5; }
  }
  function killEnemy(e, byBomb = false) {
    e.dead = true; e.wasDiving = e.state !== 'form';
    const T = TYPES[e.type];
    let v = e.state === 'form' ? T.pts[0] : T.pts[1];
    if (e.type === 'boss' && e.state !== 'form') { const esc2 = enemies.filter(o => o.escort && !o.dead).length; v = esc2 === 0 ? 400 : esc2 === 1 ? 800 : 1600; }
    if (challenge) { v = 100; challengeHits++; }
    addScore(v, e.x, e.y);
    burst(e.x, e.y, e.type === 'boss' ? 50 : 26, e.type === 'boss' ? '#7fd48a' : e.type === 'papi' ? '#ff5a5a' : '#ffb347');
    if (!byBomb) sfx(e.type === 'boss' ? 140 : 220, 0.15, 'square', 0.05, -120);
    // bonus de tir : surtout les boss, parfois les autres
    if (!challenge && Math.random() < (e.type === 'boss' ? 0.35 : e.type === 'papi' ? 0.09 : 0.05)) {
      const types = Object.keys(GX_POWERS);
      const type = types[Math.floor(Math.random() * types.length)];
      const d = { x: e.x, y: e.y, type };
      d.mesh = makeDropMesh(type); scene.add(d.mesh);
      drops.push(d);
    }
  }
  function applyPower(type) {
    const P = GX_POWERS[type];
    pops.push({ x: ship.x, y: ship.y - 50, txt: P.label, life: 1.4, color: P.color });
    sfx(980, 0.2, 'triangle', 0.06, 400);
    if (type === 'bouclier') { ship.shield = true; return; }
    if (type === 'bombe') {
      bombFlash = 1; shake = 0.6; sfx(60, 0.8, 'sawtooth', 0.08, -20);
      for (const e of enemies) { if (e.dead) continue; if (e.state === 'form') { e.hp--; if (e.hp <= 0) killEnemy(e, true); } else killEnemy(e, true); }
      ebullets.forEach(b => removeMesh(b)); ebullets = [];
      return;
    }
    power = { type, t: P.dur };
  }

  function startDive(e) {
    const tx = ship.x + (Math.random() - 0.5) * 120, sx = e.x, sy = e.y;
    const capture = e.type === 'boss' && !capturedShip && !ship.dual && ship.alive && Math.random() < 0.45 && !challenge;
    if (capture) {
      e.state = 'beamdive';
      e.path = bez([sx, sy], [sx, sy - 40], [ship.x, H * 0.3], [ship.x, H - 250], 30);
    } else {
      const side = sx < W / 2 ? 1 : -1;
      e.state = 'dive';
      e.path = [...bez([sx, sy], [sx - side * 60, sy - 60], [sx - side * 120, sy + 20], [sx, sy + 80], 12),
        ...bez([sx, sy + 80], [sx + side * 40, H * 0.5], [tx - side * 80, H * 0.75], [tx, H + 40], 26).slice(1)];
      if (e.type === 'boss') enemies.filter(o => o.type === 'papi' && o.state === 'form' && Math.abs(o.col / o.cols - e.col / e.cols) < 0.25).slice(0, 2)
        .forEach((o, i) => { o.state = 'dive'; o.escort = true; o.path = e.path.map(([x, y]) => [x + (i ? 30 : -30), y + 24]); o.pi = 0; });
    }
    e.pi = 0; e.fireT = 0.3 + Math.random() * 0.6;
    sfx(300, 0.35, 'sine', 0.035, 500);
  }

  /* ---------------- scène 3D ---------------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputEncoding = THREE.sRGBEncoding;
  const tcv = renderer.domElement; tcv.className = 'tk-3d'; tcv.dataset.overlay = '1';
  screen.insertBefore(tcv, hud);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#03040a');
  scene.fog = new THREE.FogExp2('#05060f', 0.0009);
  const cam = new THREE.PerspectiveCamera(62, SW / SH, 1, 6000);
  scene.add(new THREE.HemisphereLight('#cfe4ff', '#2a1006', 0.7));
  const key = new THREE.DirectionalLight('#ffffff', 0.9); key.position.set(200, 500, 300); scene.add(key);
  const engine = new THREE.PointLight('#ff8a2a', 1.4, 260); scene.add(engine);

  // coordonnées : x logique → X 3D (centré), y logique → profondeur Z (le joueur est devant, la formation au loin)
  const X = x => x - W / 2, Z = y => y - H;
  // planète-fonderie au loin et nébuleuse
  const neb = tkTexture(1024, 512, (x, w, h) => {
    const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#05060f'); gr.addColorStop(1, '#120612'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) { const rg = x.createRadialGradient(Math.random() * w, Math.random() * h, 10, Math.random() * w, Math.random() * h, 260); rg.addColorStop(0, `rgba(${120 + Math.random() * 60},${40 + Math.random() * 40},${90 + Math.random() * 80},.12)`); rg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = rg; x.fillRect(0, 0, w, h); }
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), new THREE.MeshBasicMaterial({ map: neb, side: THREE.BackSide, fog: false }));
  scene.add(sky);
  const planetTex = tkTexture(512, 256, (x, w, h) => {
    x.fillStyle = '#3a1a0e'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { x.strokeStyle = `rgba(255,${120 + Math.random() * 100},40,${0.3 + Math.random() * 0.5})`; x.lineWidth = 1 + Math.random() * 3; x.beginPath(); const yy = Math.random() * h; x.moveTo(0, yy); for (let xx = 0; xx < w; xx += 20) x.lineTo(xx, yy + Math.sin(xx / 30 + i) * 8); x.stroke(); }
  });
  const planet = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), new THREE.MeshStandardMaterial({ map: planetTex, emissive: '#ff5a1a', emissiveIntensity: 0.55, emissiveMap: planetTex, roughness: 1, fog: false }));
  planet.position.set(-2600, -1200, -3800); scene.add(planet);
  // étoiles qui défilent vers le joueur (sensation de vitesse)
  const NST = 600, stPos = new Float32Array(NST * 3);
  for (let i = 0; i < NST; i++) { stPos[i * 3] = (Math.random() - 0.5) * 2400; stPos[i * 3 + 1] = (Math.random() - 0.5) * 1400; stPos[i * 3 + 2] = -Math.random() * 3000; }
  const stGeo = new THREE.BufferGeometry(); stGeo.setAttribute('position', new THREE.BufferAttribute(stPos, 3));
  scene.add(new THREE.Points(stGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, fog: false })));
  // grille du terrain (repère de profondeur, discret)
  const grid = new THREE.GridHelper(1200, 30, '#3a1a0e', '#1a0c08'); grid.position.set(0, -70, -400); scene.add(grid);

  const geo = {
    shot: new THREE.CylinderGeometry(1.6, 1.6, 22, 6).rotateX(Math.PI / 2),
    laser: new THREE.CylinderGeometry(2.2, 2.2, 80, 6).rotateX(Math.PI / 2),
    bullet: new THREE.SphereGeometry(4, 8, 6),
  };
  const matCache = {};
  function mat(color, glow) {
    const k = color + (glow ? 'g' : '');
    if (!matCache[k]) matCache[k] = glow ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3 });
    return matCache[k];
  }
  function removeMesh(o) { if (o && o.mesh) { scene.remove(o.mesh); o.mesh = null; } }

  // vaisseau du joueur : creuset volant
  function makeShipMesh(red = false) {
    const s = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(9, 40, 10).rotateX(-Math.PI / 2), mat(red ? '#ff5a5a' : '#e9ebee'));
    const wing = new THREE.Mesh(new THREE.BoxGeometry(46, 3, 14), mat('#EC641E')); wing.position.z = 8;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(3, 12, 12), mat('#BA2C3A')); fin.position.set(0, 6, 12);
    const pod1 = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 18, 8).rotateX(Math.PI / 2), mat('#8A8D91')); pod1.position.set(-22, 0, 8);
    const pod2 = pod1.clone(); pod2.position.x = 22;
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(5, 10, 8), mat('#5AA8FF', true)); cockpit.position.set(0, 4, -4);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(5, 18, 8).rotateX(Math.PI / 2), mat('#ffb347', true)); flame.position.z = 28; s.userData.flame = flame;
    s.add(body, wing, fin, pod1, pod2, cockpit, flame);
    return s;
  }
  const shipMesh = makeShipMesh(), shipMesh2 = makeShipMesh();
  scene.add(shipMesh, shipMesh2);
  let capturedMesh = null;
  const shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(30, 16, 12), new THREE.MeshBasicMaterial({ color: '#7fd48a', transparent: true, opacity: 0.25, depthWrite: false }));
  scene.add(shieldMesh);

  function makeEnemyMesh(type) {
    const e = new THREE.Group();
    if (type === 'abeille') {        // goutte de fonte ailée
      const b = new THREE.Mesh(new THREE.SphereGeometry(10, 12, 10), new THREE.MeshStandardMaterial({ color: '#ffb347', emissive: '#EC641E', emissiveIntensity: 0.8 }));
      const tip = new THREE.Mesh(new THREE.ConeGeometry(6, 12, 10).rotateX(Math.PI / 2), b.material); tip.position.z = 12;
      const w1 = new THREE.Mesh(new THREE.BoxGeometry(14, 1, 9), mat('#7fd4ff', true)); w1.position.x = -12; const w2 = w1.clone(); w2.position.x = 12;
      e.add(b, tip, w1, w2); e.userData.wings = [w1, w2];
    } else if (type === 'papi') {    // scorie aux ailes rouges
      const b = new THREE.Mesh(new THREE.DodecahedronGeometry(10), mat('#8A8D91'));
      const w1 = new THREE.Mesh(new THREE.BoxGeometry(18, 1, 16), mat('#BA2C3A')); w1.position.x = -15; const w2 = w1.clone(); w2.position.x = 15;
      const ey = new THREE.Mesh(new THREE.SphereGeometry(2, 6, 6), mat('#ffd25a', true)); ey.position.set(-3, 3, 9); const ey2 = ey.clone(); ey2.position.x = 3;
      e.add(b, w1, w2, ey, ey2); e.userData.wings = [w1, w2];
    } else {                         // Grand Creuset
      const cr = new THREE.Mesh(new THREE.CylinderGeometry(14, 10, 20, 14), mat('#3a3d42'));
      const lava = new THREE.Mesh(new THREE.CircleGeometry(13, 14).rotateX(-Math.PI / 2), mat('#ffb347', true)); lava.position.y = 10.2;
      const w1 = new THREE.Mesh(new THREE.BoxGeometry(22, 2, 18), mat('#7fd48a')); w1.position.x = -20; const w2 = w1.clone(); w2.position.x = 20;
      e.add(cr, lava, w1, w2); e.userData.wings = [w1, w2]; e.userData.boss = cr;
      e.scale.setScalar(1.25);
    }
    return e;
  }
  function makeDropMesh(type) {
    const P = GX_POWERS[type];
    const grp = new THREE.Group();
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(9, 0), new THREE.MeshStandardMaterial({ color: P.color, emissive: P.color, emissiveIntensity: 0.6, roughness: 0.3 }));
    const halo = new THREE.Mesh(new THREE.TorusGeometry(15, 1.5, 6, 20), mat(P.color, true));
    grp.add(core, halo);
    return grp;
  }
  // rayon tracteur
  const beamMesh = new THREE.Mesh(new THREE.CylinderGeometry(10, 52, 230, 20, 1, true).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#7fd4ff', transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  beamMesh.visible = false; scene.add(beamMesh);

  // explosions (particules)
  const NP = 700, pPos = new Float32Array(NP * 3), pVel = new Float32Array(NP * 3), pLife = new Float32Array(NP), pCol = new Float32Array(NP * 3);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  scene.add(new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 4, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
  let pNext = 0, shake = 0;
  function burst(x, y, n, col, k = 1) {
    const cc = new THREE.Color(col);
    for (let i = 0; i < n; i++) {
      const j = pNext++ % NP;
      pPos[j * 3] = X(x); pPos[j * 3 + 1] = 0; pPos[j * 3 + 2] = Z(y);
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2, s = (60 + Math.random() * 160) * k;
      pVel[j * 3] = Math.cos(a) * Math.cos(b) * s; pVel[j * 3 + 1] = Math.sin(b) * s; pVel[j * 3 + 2] = Math.sin(a) * Math.cos(b) * s;
      pLife[j] = 0.5 + Math.random() * 0.5;
      pCol[j * 3] = cc.r; pCol[j * 3 + 1] = cc.g; pCol[j * 3 + 2] = cc.b;
    }
  }

  newStage();
  const camPos = new THREE.Vector3(0, 80, 160), camLook = new THREE.Vector3(0, 0, -400);
  let lastW = 0, lastH = 0;

  /* ---------------- boucle ---------------- */
  const stop = loop((dt, tms) => {
    const t = tms / 1000;
    formT += dt;
    if (viewFlash > 0) viewFlash -= dt;
    if (bombFlash > 0) bombFlash -= dt * 1.5;
    if (power) { power.t -= dt; if (power.t <= 0) power = null; }
    ship.cd = Math.max(0, ship.cd - dt);
    // vaisseau
    if (ship.alive && !ship.captured) {
      if (keys.L) ship.x -= 270 * dt;
      if (keys.R) ship.x += 270 * dt;
      ship.x = clamp(ship.x, ship.dual ? 36 : 20, W - (ship.dual ? 36 : 20));
      if (keys.F) fire();
    } else if (!ship.alive && !over && !ship.captured) {
      ship.respawn -= dt;
      if (ship.respawn <= 0 && !enemies.some(e => e.state === 'dive' || e.state === 'beamdive')) { ship.alive = true; ship.inv = 2; ship.x = W / 2; }
    }
    ship.inv = Math.max(0, ship.inv - dt);
    if (bannerT > 0) bannerT -= dt;
    for (let i = spawnQueue.length - 1; i >= 0; i--) { spawnQueue[i].at -= dt; if (spawnQueue[i].at <= 0) { spawn(spawnQueue[i]); spawnQueue.splice(i, 1); } }

    // ennemis
    const formed = enemies.filter(e => e.state === 'form');
    if (!challenge && spawnQueue.length === 0 && formed.length && ship.alive) {
      diveT -= dt;
      const divers = enemies.filter(e => e.state === 'dive' || e.state === 'beamdive').length;
      if (diveT <= 0 && divers < 2 + Math.floor(stageN / 3)) { startDive(formed[Math.floor(Math.random() * formed.length)]); diveT = Math.max(0.8, 2.6 - stageN * 0.15) * (0.6 + Math.random() * 0.8); }
    }
    let beamOn = null;
    for (const e of enemies) {
      const speed = (e.state === 'enter' ? 230 : 210 + stageN * 8) * dt;
      if (e.state === 'enter' || e.state === 'dive' || e.state === 'beamdive' || e.state === 'return') {
        let move = speed;
        while (move > 0 && e.pi < e.path.length - 1) {
          const [nx, ny] = e.path[e.pi + 1];
          const d = Math.hypot(nx - e.x, ny - e.y);
          if (d <= move) { e.x = nx; e.y = ny; e.pi++; move -= d; } else { e.a = Math.atan2(ny - e.y, nx - e.x); e.x += (nx - e.x) / d * move; e.y += (ny - e.y) / d * move; move = 0; }
        }
        if (e.pi >= e.path.length - 1) {
          if (e.state === 'beamdive') { e.state = 'beam'; e.beam = 3.2; sfx(200, 1.2, 'sine', 0.04, 200); }
          else if (challenge && e.state === 'enter') e.state = 'gone';
          else {
            const [fx, fy] = slotPos(e.row, e.col, e.cols);
            if (e.y > H) { e.y = -30; e.x = fx; }
            e.state = 'return'; e.path = [[e.x, e.y], [fx, fy]]; e.pi = 0;
          }
        }
        if (e.state === 'return') { const [fx, fy] = slotPos(e.row, e.col, e.cols); e.path[1] = [fx, fy]; if (Math.hypot(fx - e.x, fy - e.y) < 4) { e.state = 'form'; e.escort = false; } }
        if (e.state === 'dive' && e.y < H - 160 && e.y > 120 && !challenge) {
          e.fireT -= dt;
          if (e.fireT <= 0) {
            e.fireT = 99;
            const a = Math.atan2(ship.y - e.y, ship.x - e.x);
            const b = { x: e.x, y: e.y, vx: Math.cos(a) * 240, vy: Math.max(160, Math.sin(a) * 240) };
            b.mesh = new THREE.Mesh(geo.bullet, mat('#ff5a5a', true)); scene.add(b.mesh);
            ebullets.push(b);
          }
        }
      } else if (e.state === 'form') {
        const [fx, fy] = slotPos(e.row, e.col, e.cols); e.x = fx; e.y = fy; e.a = Math.PI / 2;
      } else if (e.state === 'beam') {
        e.beam -= dt; beamOn = e;
        if (ship.alive && !ship.captured && ship.inv <= 0 && !ship.shield && Math.abs(ship.x - e.x) < 34 && e.beam < 2.6 && e.beam > 0.4) {
          ship.captured = true; ship.alive = false; power = null;
          capturedShip = { boss: e, x: ship.x, y: ship.y, state: 'pull' };
          capturedMesh = makeShipMesh(true); scene.add(capturedMesh);
          lives--; if (lives <= 0) { over = true; overT = 2.5; }
          sfx(160, 1.0, 'sawtooth', 0.05, 600);
        }
        if (e.beam <= 0) { e.state = 'return'; const [fx, fy] = slotPos(e.row, e.col, e.cols); e.path = [[e.x, e.y], [fx, fy]]; e.pi = 0; }
      }
      if (ship.alive && ship.inv <= 0 && e.state !== 'form') {
        const hitDual = ship.dual && Math.hypot(e.x - (ship.x + 16), e.y - ship.y) < e.r + 12;
        if (Math.hypot(e.x - (ship.x - (ship.dual ? 16 : 0)), e.y - ship.y) < e.r + 12 || hitDual) { e.hp = 0; killEnemy(e); killShip(); }
      }
    }
    // vaisseau capturé
    if (capturedShip) {
      const b = capturedShip.boss;
      if (b.dead || !enemies.includes(b)) {
        if (capturedShip.state === 'held' && b.wasDiving && lives > 0) { capturedShip.state = 'free'; capturedShip.vy = 120; }
        else if (capturedShip.state !== 'free') { capturedShip = null; scene.remove(capturedMesh); capturedMesh = null; }
      }
      if (capturedShip) {
        if (capturedShip.state === 'pull') {
          capturedShip.y -= 140 * dt; capturedShip.x += (b.x - capturedShip.x) * dt * 3;
          if (capturedShip.y <= b.y + 30) { capturedShip.state = 'held'; ship.captured = false; ship.respawn = 1.5; }
        } else if (capturedShip.state === 'held') { capturedShip.x = b.x; capturedShip.y = b.y - 30; }
        else if (capturedShip.state === 'free') {
          capturedShip.y += capturedShip.vy * dt; capturedShip.x += (ship.x + 32 - capturedShip.x) * dt * 2;
          if (capturedShip.y >= ship.y && ship.alive) { ship.dual = true; capturedShip = null; scene.remove(capturedMesh); capturedMesh = null; sfx(660, 0.4, 'triangle', 0.06, 400); pops.push({ x: ship.x, y: ship.y - 40, txt: 'DOUBLE !', life: 1.4 }); }
          else if (capturedShip.y > H) { capturedShip = null; scene.remove(capturedMesh); capturedMesh = null; }
        }
      }
    }
    // tirs du joueur
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i]; s.y -= 640 * dt; s.x += s.vx * dt;
      if (s.y < -20 || s.x < -40 || s.x > W + 40) { removeMesh(s); shots.splice(i, 1); continue; }
      for (const e of enemies) {
        if (e.dead || e.state === 'gone' || s.hit.has(e) || Math.abs(e.x - s.x) > e.r + (s.pierce ? 4 : 0) || Math.abs(e.y - s.y) > e.r + (s.pierce ? 30 : 0)) continue;
        s.hit.add(e);
        e.hp--;
        if (e.hp <= 0) killEnemy(e); else { sfx(600, 0.06, 'square', 0.04); burst(e.x, e.y, 8, '#7fd4ff'); }
        if (!s.pierce) { removeMesh(s); shots.splice(i, 1); }
        break;
      }
    }
    enemies = enemies.filter(e => { if (e.dead || e.state === 'gone') { removeMesh(e); return false; } return true; });
    // bonus qui tombent
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i]; d.y += 110 * dt;
      if (ship.alive && Math.abs(d.x - ship.x) < (ship.dual ? 44 : 28) && Math.abs(d.y - ship.y) < 26) { applyPower(d.type); removeMesh(d); drops.splice(i, 1); continue; }
      if (d.y > H + 20) { removeMesh(d); drops.splice(i, 1); }
    }
    // tirs ennemis
    for (let i = ebullets.length - 1; i >= 0; i--) {
      const b = ebullets[i]; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y > H + 30) { removeMesh(b); ebullets.splice(i, 1); continue; }
      if (ship.alive && ship.inv <= 0 && (Math.hypot(b.x - (ship.x - (ship.dual ? 16 : 0)), b.y - ship.y) < 11 || (ship.dual && Math.hypot(b.x - ship.x - 16, b.y - ship.y) < 11))) { removeMesh(b); ebullets.splice(i, 1); killShip(); }
    }
    // fin d'étape
    if (!over && spawnQueue.length === 0 && enemies.length === 0 && bannerT <= 0) {
      if (challenge) { const bonus = challengeHits === 40 ? 10000 : challengeHits * 100; addScore(bonus, W / 2, H / 2); pops.push({ x: W / 2, y: H / 2 - 40, txt: challengeHits === 40 ? 'PARFAIT ! 10 000' : `${challengeHits} touchés`, life: 2 }); }
      newStage();
    }
    if (over) { overT -= dt; if (overT <= 0) { api.end(score); return false; } }

    /* ---------------- rendu 3D ---------------- */
    const cw = hud.clientWidth, ch = hud.clientHeight;
    if (cw && (cw !== lastW || ch !== lastH)) { lastW = cw; lastH = ch; renderer.setSize(cw, ch, false); tcv.style.width = cw + 'px'; tcv.style.height = ch + 'px'; cam.aspect = cw / ch; cam.updateProjectionMatrix(); }
    const sx = X(ship.x), sz = Z(ship.y);
    const showShip = ship.alive && (ship.inv <= 0 || Math.floor(t * 12) % 2);
    const view = GX_VIEWS[viewIdx].id;
    const off = ship.dual ? 16 : 0;
    const bank = (keys.R ? -0.45 : 0) + (keys.L ? 0.45 : 0);
    [shipMesh, shipMesh2].forEach((m, k) => {
      m.visible = showShip && (k === 0 || ship.dual) && view !== 'fps';
      m.position.set(sx + (k === 0 ? -off : off), 0, sz);
      m.rotation.z += (bank - m.rotation.z) * Math.min(1, dt * 8);
      m.userData.flame.scale.z = 0.8 + Math.random() * 0.5;
    });
    engine.position.set(sx, 10, sz + 30);
    shieldMesh.visible = ship.alive && ship.shield; shieldMesh.position.set(sx, 0, sz); shieldMesh.material.opacity = 0.18 + Math.sin(t * 8) * 0.08;
    for (const e of enemies) {
      const m = e.mesh; if (!m) continue;
      const bob = e.state === 'form' ? Math.sin(t * 2 + e.col) * 4 : 0;
      m.position.set(X(e.x), bob + (e.state === 'dive' ? Math.sin(t * 6 + e.col) * 10 : 0), Z(e.y));
      m.rotation.y = Math.PI / 2 - e.a;   // nez de l'ennemi dans sa direction de vol
      const flap = Math.sin(t * 14 + e.col) * 0.5;
      if (m.userData.wings) { m.userData.wings[0].rotation.z = flap; m.userData.wings[1].rotation.z = -flap; }
      if (m.userData.boss && e.hp < 2) m.userData.boss.material = mat('#2b6cb0');
    }
    if (beamOn && beamOn.mesh) {
      const k = Math.min(1, (3.2 - beamOn.beam) / 0.6) * Math.min(1, beamOn.beam / 0.4);
      beamMesh.visible = true; beamMesh.position.set(X(beamOn.x), 0, Z(beamOn.y) + 130); beamMesh.material.opacity = 0.3 * k; beamMesh.rotation.z = t * 3;
    } else beamMesh.visible = false;
    if (capturedMesh && capturedShip) { capturedMesh.position.set(X(capturedShip.x), 0, Z(capturedShip.y)); capturedMesh.rotation.y = capturedShip.state === 'free' ? 0 : Math.PI; }
    for (const s of shots) if (s.mesh) { s.mesh.position.set(X(s.x), 0, Z(s.y)); s.mesh.rotation.y = Math.atan2(s.vx, -640) ; }
    for (const b of ebullets) if (b.mesh) b.mesh.position.set(X(b.x), 0, Z(b.y));
    for (const d of drops) if (d.mesh) { d.mesh.position.set(X(d.x), 0, Z(d.y)); d.mesh.rotation.y = t * 3; d.mesh.rotation.x = t * 2; }
    for (let j = 0; j < NP; j++) {
      if (pLife[j] <= 0) { pPos[j * 3 + 1] = -9999; continue; }
      pLife[j] -= dt;
      pPos[j * 3] += pVel[j * 3] * dt; pPos[j * 3 + 1] += pVel[j * 3 + 1] * dt; pPos[j * 3 + 2] += pVel[j * 3 + 2] * dt;
    }
    pGeo.attributes.position.needsUpdate = true;
    for (let i = 0; i < NST; i++) { stPos[i * 3 + 2] += 220 * dt; if (stPos[i * 3 + 2] > 300) stPos[i * 3 + 2] = -3000; }
    stGeo.attributes.position.needsUpdate = true;
    planet.rotation.y += dt * 0.02;
    // caméras
    let tp, tl, fov;
    if (view === 'tps') { tp = [sx * 0.85, 75, sz + 165]; tl = [sx * 0.55, 0, sz - 420]; fov = 62; }
    else if (view === 'fps') { tp = [sx, 14, sz - 10]; tl = [sx * 0.9, 6, sz - 500]; fov = 74; }
    else { tp = [0, 780, -330]; tl = [0, 0, -331]; fov = 50; }
    const kk = Math.min(1, dt * (view === 'fps' ? 14 : 5));
    camPos.lerp(new THREE.Vector3(...tp), kk); camLook.lerp(new THREE.Vector3(...tl), kk);
    cam.position.copy(camPos);
    if (shake > 0) { shake -= dt; cam.position.x += (Math.random() - 0.5) * 18 * shake; cam.position.y += (Math.random() - 0.5) * 12 * shake; }
    cam.lookAt(camLook);
    if (Math.abs(cam.fov - fov) > 0.1) { cam.fov += (fov - cam.fov) * kk; cam.updateProjectionMatrix(); }
    if (view === 'fps') cam.rotation.z += bank * 0.15;
    renderer.render(scene, cam);

    /* ---------------- HUD ---------------- */
    g.clearRect(0, 0, SW, SH);
    if (bombFlash > 0) { g.fillStyle = `rgba(255,160,60,${bombFlash * 0.6})`; g.fillRect(0, 0, SW, SH); }
    if (view === 'fps' && ship.alive) {      // cockpit : viseur et montants
      g.strokeStyle = 'rgba(127,212,255,.8)'; g.lineWidth = 2;
      g.beginPath(); g.arc(SW / 2, SH / 2 + 20, 18, 0, Math.PI * 2); g.moveTo(SW / 2 - 30, SH / 2 + 20); g.lineTo(SW / 2 - 10, SH / 2 + 20); g.moveTo(SW / 2 + 10, SH / 2 + 20); g.lineTo(SW / 2 + 30, SH / 2 + 20); g.stroke();
      g.fillStyle = 'rgba(20,22,26,.85)';
      g.beginPath(); g.moveTo(0, SH); g.lineTo(0, SH - 90); g.lineTo(SW * 0.28, SH - 30); g.lineTo(SW * 0.72, SH - 30); g.lineTo(SW, SH - 90); g.lineTo(SW, SH); g.fill();
      g.fillStyle = '#EC641E'; g.fillRect(SW * 0.28, SH - 32, SW * 0.44, 3);
      if (ship.shield) { g.strokeStyle = 'rgba(127,212,98,.5)'; g.lineWidth = 6; g.strokeRect(6, 6, SW - 12, SH - 12); }
    }
    g.font = '400 14px "Press Start 2P", monospace'; g.textAlign = 'left'; g.shadowColor = '#000'; g.shadowBlur = 6;
    g.fillStyle = '#ff5a5a'; g.fillText('1UP', 20, 28); g.fillStyle = '#fff'; g.fillText(String(score).padStart(6, '0'), 20, 50);
    g.textAlign = 'center'; g.fillStyle = '#ff5a5a'; g.fillText('RECORD', SW / 2, 28); g.fillStyle = '#fff'; g.fillText(String(Math.max(best, score)).padStart(6, '0'), SW / 2, 50);
    g.textAlign = 'right'; g.font = '400 9px "Press Start 2P", monospace'; g.fillStyle = viewFlash > 0 ? '#F5B700' : '#9aa0a6';
    g.fillText(`VUE : ${GX_VIEWS[viewIdx].label} (V)`, SW - 20, 28);
    for (let i = 0; i < lives - (ship.alive ? 1 : 0); i++) drawShip(g, 30 + i * 28, SH - 22, '#EC641E', 0, false, 0.65);
    for (let i = 0; i < Math.min(stageN, 20); i++) { g.fillStyle = i % 5 === 4 ? '#F5B700' : '#BA2C3A'; const bx = SW - 20 - (i % 10) * 13; g.beginPath(); g.moveTo(bx, SH - 10); g.lineTo(bx - 6, SH - 28); g.lineTo(bx + 6, SH - 28); g.fill(); }
    if (power) {
      const P = GX_POWERS[power.type];
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(SW / 2 - 110, SH - 52, 220, 36);
      g.font = '400 11px "Press Start 2P", monospace'; g.textAlign = 'center'; g.fillStyle = P.color; g.fillText(`${P.label}`, SW / 2, SH - 36);
      g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(SW / 2 - 90, SH - 28, 180, 5); g.fillStyle = P.color; g.fillRect(SW / 2 - 90, SH - 28, 180 * power.t / P.dur, 5);
    } else if (ship.shield) { g.font = '400 11px "Press Start 2P", monospace'; g.textAlign = 'center'; g.fillStyle = '#7fd48a'; g.fillText('BOUCLIER ACTIF', SW / 2, SH - 30); }
    // textes flottants projetés depuis la 3D
    const v3 = new THREE.Vector3();
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i]; p.life -= dt; p.y -= 20 * dt;
      if (p.life <= 0) { pops.splice(i, 1); continue; }
      v3.set(X(p.x), 20, Z(p.y)).project(cam);
      if (v3.z > 1) continue;
      g.font = '400 12px "Press Start 2P", monospace'; g.textAlign = 'center'; g.fillStyle = p.color || '#7fd4ff';
      g.fillText(p.txt, (v3.x + 1) / 2 * SW, (1 - v3.y) / 2 * SH);
    }
    if (bannerT > 0) { g.font = '400 24px "Press Start 2P", monospace'; g.textAlign = 'center'; g.fillStyle = challenge ? '#F5B700' : '#7fd4ff'; g.fillText(banner, SW / 2, SH / 2 - 40); }
    if (capturedShip && capturedShip.state === 'held') { g.font = '400 11px "Press Start 2P", monospace'; g.fillStyle = '#ff5a5a'; g.textAlign = 'center'; g.fillText('VAISSEAU CAPTURÉ : ABATS LE CREUSET EN PLEIN PIQUÉ !', SW / 2, SH - 70); }
    if (over) { g.font = '400 30px "Press Start 2P", monospace'; g.textAlign = 'center'; g.fillStyle = '#ff5a5a'; g.fillText('GAME OVER', SW / 2, SH / 2); }
    g.shadowBlur = 0;
    api.info(`Étape ${stageN} · ${lives} vie${lives > 1 ? 's' : ''}`);
  });

  return () => {
    stop();
    window.removeEventListener('keydown', kd);
    window.removeEventListener('keyup', ku);
    renderer.dispose();
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); });
  };
}

/* Sprites 2D (aperçu animé du menu de la borne) */
function drawShip(g, x, y, color, t, red = false, s = 1) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = red ? '#ff5a5a' : '#e9ebee';
  g.beginPath(); g.moveTo(0, -18); g.lineTo(6, -6); g.lineTo(15, 4); g.lineTo(15, 12); g.lineTo(6, 8); g.lineTo(0, 12); g.lineTo(-6, 8); g.lineTo(-15, 12); g.lineTo(-15, 4); g.lineTo(-6, -6); g.closePath(); g.fill();
  g.fillStyle = color; g.fillRect(-15, 2, 4, 10); g.fillRect(11, 2, 4, 10);
  g.fillStyle = '#BA2C3A'; g.beginPath(); g.arc(0, -2, 4, 0, Math.PI * 2); g.fill();
  if (t) { g.fillStyle = `rgba(255,${150 + Math.random() * 80},60,.9)`; g.beginPath(); g.moveTo(-4, 12); g.lineTo(0, 18 + Math.random() * 6); g.lineTo(4, 12); g.fill(); }
  g.restore();
}

function drawEnemy(g, e, t) {
  const flap = Math.sin(t * 10 + e.col) > 0;
  g.save(); g.translate(e.x, e.y);
  g.rotate(e.state === 'form' ? 0 : e.a + Math.PI / 2);
  if (e.type === 'abeille') {
    g.fillStyle = '#7fd4ff'; g.beginPath(); g.ellipse(-9, -2, 7, flap ? 4 : 7, -0.4, 0, Math.PI * 2); g.ellipse(9, -2, 7, flap ? 4 : 7, 0.4, 0, Math.PI * 2); g.fill();
    const gr = g.createRadialGradient(-2, -3, 1, 0, 0, 10); gr.addColorStop(0, '#fff3c0'); gr.addColorStop(0.5, '#F5B700'); gr.addColorStop(1, '#EC641E');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 2, 8, 0, Math.PI * 2); g.moveTo(-6, -2); g.lineTo(0, -12); g.lineTo(6, -2); g.fill();
  } else if (e.type === 'papi') {
    g.fillStyle = '#BA2C3A'; g.beginPath(); g.moveTo(0, 0); g.lineTo(-16, flap ? -10 : -4); g.lineTo(-14, 10); g.closePath(); g.moveTo(0, 0); g.lineTo(16, flap ? -10 : -4); g.lineTo(14, 10); g.closePath(); g.fill();
    g.fillStyle = '#8A8D91'; g.beginPath(); g.ellipse(0, 1, 6, 11, 0, 0, Math.PI * 2); g.fill();
  } else {
    g.fillStyle = e.hp < 2 ? '#5AA8FF' : '#7fd48a';
    g.beginPath(); g.moveTo(-20, flap ? -12 : -2); g.lineTo(-8, 4); g.lineTo(-18, 12); g.closePath(); g.moveTo(20, flap ? -12 : -2); g.lineTo(8, 4); g.lineTo(18, 12); g.closePath(); g.fill();
    g.fillStyle = '#3a3d42'; g.beginPath(); g.moveTo(-11, -12); g.lineTo(11, -12); g.lineTo(8, 12); g.lineTo(-8, 12); g.closePath(); g.fill();
    g.fillStyle = '#ffb347'; g.beginPath(); g.ellipse(0, -12, 11, 4, 0, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

GAMES.push({
  id: 'galaxie', title: 'Coulée Galactique', teinte: 'solidus', product: 'zip',
  pitch: 'Le shooter qui a perfectionné la formule, en 3D : vue à la 3e ou à la 1re personne, rayon tracteur, double vaisseau et bonus de tir.',
  how: '<b>← →</b> pour te déplacer, <b>Espace</b> ou <b>J</b> (maintenu) pour tirer, <b>V</b> pour changer de vue (3e personne, 1re personne, arcade). Ramasse les bonus : <b>Double</b>, <b>Éventail</b>, <b>Laser</b> perçant, <b>Rafale</b>, <b>Bouclier</b> et <b>Bombe</b>. Laisse un Grand Creuset capturer ton vaisseau, puis abats-le en piqué pour piloter en double.',
  run: runGalaxie,
});
