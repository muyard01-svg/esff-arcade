/* Grand Prix de la Coulée — course de karts façon « party kart » avec les persos de la métallurgie (serveur : kart.py)
   Vue 3e personne derrière le kart ou 1re personne au volant (V), objets de fonderie dans les caisses à outils,
   dérapage avec mini-turbo. Mon kart est piloté ici et sa position envoyée au serveur, qui gère objets et classement. */
'use strict';

const KART_TRACKS = {
  random: { name: 'Au hasard', desc: 'Un des deux circuits, tiré au sort' },
  coulee: { name: 'Circuit de la Coulée', desc: 'Autour de la fonderie : sable de moulage, fours et cheminées' },
  laminoir: { name: 'Boucle du Laminoir', desc: 'Grande boucle rapide à travers l’aciérie, épingles serrées' },
};
const KART_ITEMS = {
  lingot: { name: 'Lingot d’acier', col: '#c9ccd1', tip: 'posé derrière toi, fait déraper' },
  huile: { name: 'Flaque d’huile de trempe', col: '#3a4450', tip: 'grande flaque glissante derrière toi' },
  boulet: { name: 'Boulet de fonte', col: '#2b2e33', tip: 'tiré tout droit devant' },
  poche: { name: 'Poche de fonte guidée', col: '#EC641E', tip: 'file vers le kart juste devant' },
  oxygene: { name: 'Bouteille d’oxygène', col: '#5AA8FF', tip: 'turbo' },
  tablier: { name: 'Tablier aluminisé', col: '#F5B700', tip: 'invincible et plus rapide' },
  coupure: { name: 'Coupure de courant', col: '#C77DFF', tip: 'ralentit tous les autres' },
};
const ORD = n => (n === 1 ? '1er' : `${n}e`);

function renderTrackPick(box) {
  if (!KART_TRACKS[save.kartMap]) save.kartMap = 'random';
  box.innerHTML = Object.entries(KART_TRACKS).map(([id, m]) => `<button type="button" data-map="${id}" class="ry-map ${id === save.kartMap ? 'on' : ''}"><b>${m.name}</b><small>${m.desc}</small></button>`).join('');
  box.querySelectorAll('[data-map]').forEach(b => b.addEventListener('click', () => {
    save.kartMap = b.dataset.map; persist();
    box.querySelectorAll('[data-map]').forEach(x => x.classList.toggle('on', x === b)); SFX.tick();
  }));
}

HANDLERS.course = () => updateKart();
let kartClient = null;
function stopKart() { if (kartClient && kartClient !== 'loading') kartClient.stop(); kartClient = null; }

function updateKart() {
  if (!trackInfo || !trackInfo.track) return;
  if (view.phase === 'over' && view.finished) {
    if (kartClient && kartClient !== 'loading' && !kartClient.endShown) { kartClient.push(view); kartClient.endShown = true; setTimeout(() => updateKart(), 2500); return; }
    if (document.getElementById('rewardBox')) return;
    stopKart();
    resultScreen(view.finished.map((i, k) => {
      const c = view.k[i], d = (trackInfo.drivers || {})[c.ch] || { name: '', color: '#888' };
      return `<li><b>${k + 1}</b><i style="background:${d.color}"></i><span>${esc(c.n)} · ${d.name}${i === mySeat ? ' (toi)' : ''}</span><em>${c.fin !== null ? c.fin.toFixed(2) + ' s' : 'abandon'}</em></li>`;
    }));
    return;
  }
  if (!kartClient) {
    kartClient = 'loading';
    stage.innerHTML = '<div class="screen"><p>Préparation du circuit 3D…</p></div>';
    loadThree().then(() => { if (kartClient === 'loading' && onlineKind === 'course') { kartClient = startKartClient(); kartClient.push(view); } })
      .catch(e => { kartClient = null; toast(e.message); });
    return;
  }
  if (kartClient !== 'loading') kartClient.push(view);
}

function startKartClient() {
  const W = 960, H = 540;
  const TR = trackInfo.track, PH = trackInfo.phys, DRV = trackInfo.drivers, LAPS = trackInfo.laps, KR = trackInfo.kartR || 26;
  const PATH = TR.path, N = PATH.length, TW = TR.width;
  const SEG = PATH.map((p, i) => Math.hypot(PATH[(i + 1) % N][0] - p[0], PATH[(i + 1) % N][1] - p[1]));
  const CUM = []; SEG.reduce((a, l, i) => { CUM[i] = a; return a + l; }, 0);
  const LEN = TR.length;
  stage.innerHTML = '';
  $('#hudInfo').textContent = TR.title;
  const wrap = document.createElement('div'); wrap.className = 'play-wrap'; stage.appendChild(wrap);
  const screen = document.createElement('div'); screen.className = 'tk-screen'; wrap.appendChild(screen);
  const { c: cv, g } = makeCanvas(screen, W, H);
  cv.classList.add('tk-hud');
  const pad = document.createElement('div'); pad.className = 'touch-pad';
  pad.innerHTML = `<div class="grp"><button data-k="left">◀</button><button data-k="right">▶</button></div>
    <div class="grp"><button data-k="drift" class="warm">DÉRAPE</button><button data-k="item">OBJET</button><button data-k="view">VUE</button><button data-k="down">FREIN</button><button data-k="up" class="hot">GAZ</button></div>`;
  wrap.appendChild(pad);
  const hint = document.createElement('p'); hint.className = 'keys-hint';
  hint.textContent = '↑ GAZ · ↓ FREIN · ← → TOURNER · MAJ / ESPACE DÉRAPER · E OBJET · V 1RE / 3E PERSONNE · C REGARDER DERRIÈRE';
  wrap.appendChild(hint);

  /* ---------- piste ---------- */
  const pointAt = s => {
    s = ((s % LEN) + LEN) % LEN;
    let lo = 0, hi = N - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (CUM[m] <= s) lo = m; else hi = m - 1; }
    const a = PATH[lo], b = PATH[(lo + 1) % N], t = SEG[lo] ? (s - CUM[lo]) / SEG[lo] : 0;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[1] - a[1], b[0] - a[0])];
  };
  const locate = (x, y, hint) => {
    let best = [1e18, 0, 0, 0];
    const scan = i => {
      i = ((i % N) + N) % N;
      const a = PATH[i], b = PATH[(i + 1) % N], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2));
      const px = a[0] + dx * t, py = a[1] + dy * t, d2 = (x - px) ** 2 + (y - py) ** 2;
      if (d2 < best[0]) best = [d2, i, CUM[i] + SEG[i] * t, (dx * (y - a[1]) - dy * (x - a[0]) > 0 ? 1 : -1) * Math.sqrt(d2)];
    };
    if (hint === null || hint === undefined) for (let i = 0; i < N; i++) scan(i); else for (let d = -14; d <= 14; d++) scan(hint + d);
    return { s: best[2], lat: best[3], i: best[1] };
  };

  /* ---------- mon kart ---------- */
  const me = { x: 0, y: 0, a: 0, v: 0, lap: -1, s: 0, hint: null, drift: 0, charge: 0, boost: 0, star: 0, spin: 0, slow: 0, tp: -1, off: false, wrong: 0 };
  const myDrv = () => DRV[(cur && cur.k[mySeat] && cur.k[mySeat].ch) || 'fondeur'] || { speed: 1, grip: 1, color: '#EC641E' };
  let mode = save.kartView === 'fps' ? 'fps' : 'tps', lookBack = false;
  const held = new Set();
  let driftHeld = false, lastSend = 0, roulette = 0, rouletteItem = null, msg = '', msgAt = 0, finishedShown = false;
  const KEY = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ShiftLeft: 'drift', ShiftRight: 'drift', Space: 'drift' };
  const useItem = () => { const k = cur && cur.k[mySeat]; if (k && k.it && roulette <= 0) send({ t: 'act', a: 'use' }); };
  const kd = e => {
    if (e.code === 'KeyV' && !e.repeat) { e.preventDefault(); toggleView(); return; }
    if (e.code === 'KeyE' && !e.repeat) { e.preventDefault(); useItem(); return; }
    if (e.code === 'KeyC') { e.preventDefault(); lookBack = true; return; }
    const k = KEY[e.code]; if (!k) return;
    e.preventDefault(); held.add(k);
  };
  const ku = e => { if (e.code === 'KeyC') lookBack = false; const k = KEY[e.code]; if (k) held.delete(k); };
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
  const blur = () => held.clear(); window.addEventListener('blur', blur);
  screen.addEventListener('mousedown', e => { if (e.button === 0) useItem(); });
  pad.querySelectorAll('[data-k]').forEach(b => {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (k === 'item') useItem(); else if (k === 'view') toggleView(); else { held.add(k); b.classList.add('on'); }
    });
    const up = () => { held.delete(k); b.classList.remove('on'); };
    b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
  });
  function toggleView() {
    mode = mode === 'tps' ? 'fps' : 'tps'; save.kartView = mode; persist();
    fxWarp(screen, 'switch'); toast(mode === 'fps' ? 'Vue 1re personne (au volant)' : 'Vue 3e personne');
  }

  /* ---------- rendu three.js ---------- */
  const steel = TR.theme === 'acierie';
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
  renderer.outputEncoding = THREE.sRGBEncoding;
  const canvas = renderer.domElement; canvas.className = 'tk-3d'; canvas.dataset.overlay = '1';
  screen.insertBefore(canvas, cv);
  const scene = new THREE.Scene();
  const skyCol = steel ? '#8fa6bd' : '#f0a868';
  scene.background = tkTexture(4, 256, (b, w, h) => { const gr = b.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, steel ? '#3d5a80' : '#2b2140'); gr.addColorStop(0.55, skyCol); gr.addColorStop(1, steel ? '#d8dde3' : '#ffd8a0'); b.fillStyle = gr; b.fillRect(0, 0, w, h); });
  scene.fog = new THREE.Fog(skyCol, 1400, 5200);
  const cam = new THREE.PerspectiveCamera(70, W / H, 2, 9000);
  scene.add(new THREE.HemisphereLight('#fff4e0', steel ? '#3a3d42' : '#6b4a2c', 0.9));
  const sun = new THREE.DirectionalLight('#fff0d8', 0.8); sun.position.set(-0.5, 1, 0.3); scene.add(sun);
  const M = (color, extra) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, ...(extra || {}) }); m.color.convertSRGBToLinear(); if (m.emissive) m.emissive.convertSRGBToLinear(); return m; };
  // sol autour de la piste : sable de moulage ou dalle d'aciérie
  const xs = PATH.map(p => p[0]), ys = PATH.map(p => p[1]);
  const minX = Math.min(...xs) - 1400, maxX = Math.max(...xs) + 1400, minY = Math.min(...ys) - 1400, maxY = Math.max(...ys) + 1400;
  const groundTex = tkTexture(256, 256, (b, w, h) => { b.fillStyle = steel ? '#6d6a66' : '#9a7a52'; b.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { b.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,240,210'},${0.04 + Math.random() * 0.06})`; b.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }, [(maxX - minX) / 400, (maxY - minY) / 400]);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(maxX - minX, maxY - minY), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set((minX + maxX) / 2, 0, (minY + maxY) / 2); scene.add(ground);
  // ruban de piste (enrobé), bordures rouge et blanc, murets à bandes jaunes et noires
  const ribbon = (inner, outer, y, tex, vScale, wall) => {
    const pos = [], uv = [], idx = [];
    let acc = 0;
    for (let i = 0; i <= N; i++) {
      const p = PATH[i % N], q = PATH[(i + 1) % N];
      const a = Math.atan2(q[1] - p[1], q[0] - p[0]), nx = -Math.sin(a), ny = Math.cos(a);
      if (wall) { pos.push(p[0] + nx * inner, 0, p[1] + ny * inner, p[0] + nx * inner, wall, p[1] + ny * inner); }
      else pos.push(p[0] + nx * inner, y, p[1] + ny * inner, p[0] + nx * outer, y, p[1] + ny * outer);
      uv.push(0, acc / vScale, 1, acc / vScale);
      acc += SEG[i % N];
      if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide }));
    scene.add(m); return m;
  };
  const asphalt = tkTexture(128, 256, (b, w, h) => { b.fillStyle = '#3a3a3e'; b.fillRect(0, 0, w, h); for (let i = 0; i < 1500; i++) { b.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '200,200,210'},${0.05 + Math.random() * 0.08})`; b.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); } b.fillStyle = 'rgba(255,255,255,.55)'; b.fillRect(w / 2 - 2, 0, 4, h * 0.45); });
  asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping;
  ribbon(-TW / 2, TW / 2, 1, asphalt, 260);
  const kerb = tkTexture(16, 64, (b, w, h) => { b.fillStyle = '#BA2C3A'; b.fillRect(0, 0, w, h / 2); b.fillStyle = '#f2f4f7'; b.fillRect(0, h / 2, w, h / 2); });
  kerb.wrapS = kerb.wrapT = THREE.RepeatWrapping;
  ribbon(-TW / 2 - 20, -TW / 2, 1.5, kerb, 60); ribbon(TW / 2, TW / 2 + 20, 1.5, kerb, 60);
  const hazard = tkTexture(64, 32, (b, w, h) => { b.fillStyle = '#F5B700'; b.fillRect(0, 0, w, h); b.fillStyle = '#1a1a1a'; for (let x = -32; x < w; x += 32) { b.beginPath(); b.moveTo(x, h); b.lineTo(x + 16, 0); b.lineTo(x + 32, 0); b.lineTo(x + 16, h); b.fill(); } });
  hazard.wrapS = hazard.wrapT = THREE.RepeatWrapping;
  ribbon(-TW / 2 - 140, 0, 0, hazard, 120, 40); ribbon(TW / 2 + 140, 0, 0, hazard, 120, 40);
  // ligne de départ et portique avec les feux
  const [sx0, sy0, sa0] = pointAt(0);
  const checker = tkTexture(64, 16, (b, w, h) => { for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { b.fillStyle = (i + j) % 2 ? '#111' : '#fff'; b.fillRect(i * 4, j * 4, 4, 4); } });
  const line = new THREE.Mesh(new THREE.PlaneGeometry(TW, 30), new THREE.MeshBasicMaterial({ map: checker }));
  line.rotation.x = -Math.PI / 2; line.rotation.z = -sa0 + Math.PI / 2; line.position.set(sx0, 2, sy0); scene.add(line);
  const gantry = new THREE.Group();
  const yel = M('#F5B700', { metalness: 0.5 });
  [-1, 1].forEach(sd => { const p = new THREE.Mesh(new THREE.BoxGeometry(20, 260, 20), yel); p.position.set(0, 130, sd * (TW / 2 + 40)); gantry.add(p); });
  const banner = tkTexture(512, 64, (b, w, h) => { b.fillStyle = '#1a1a1a'; b.fillRect(0, 0, w, h); b.fillStyle = '#EC641E'; b.font = '900 40px "Big Shoulders Display", Impact'; b.textAlign = 'center'; b.fillText('GRAND PRIX DE LA COULÉE · ESFF 101', w / 2, 46); });
  const beamG = new THREE.Mesh(new THREE.BoxGeometry(14, 50, TW + 100), [M('#1a1a1a'), M('#1a1a1a'), M('#1a1a1a'), M('#1a1a1a'), new THREE.MeshBasicMaterial({ map: banner }), new THREE.MeshBasicMaterial({ map: banner })]);
  beamG.position.y = 250; gantry.add(beamG);
  const lightsG = [0, 1, 2, 3].map(k => { const l = new THREE.Mesh(new THREE.SphereGeometry(9, 12, 8), new THREE.MeshBasicMaterial({ color: '#330808' })); l.position.set(-10, 210, -45 + k * 30); gantry.add(l); return l; });
  gantry.position.set(sx0, 0, sy0); gantry.rotation.y = -sa0; scene.add(gantry);
  // décor d'usine autour du circuit
  const rnd = (() => { let s = 101; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const smoke = [];
  const corr = tkTexture(128, 128, (b, w, h) => { b.fillStyle = steel ? '#6a7480' : '#7a5a46'; b.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 10) { b.fillStyle = 'rgba(255,255,255,.08)'; b.fillRect(x, 0, 4, h); b.fillStyle = 'rgba(0,0,0,.15)'; b.fillRect(x + 5, 0, 3, h); } b.fillStyle = 'rgba(255,220,150,.75)'; for (let x = 10; x < w; x += 30) b.fillRect(x, 20, 16, 12); });
  for (let n = 0, tries = 0; n < 34 && tries < 800; tries++) {
    const x = minX + rnd() * (maxX - minX), y = minY + rnd() * (maxY - minY);
    if (Math.abs(locate(x, y).lat) < TW / 2 + 380) continue;
    n++;
    const kind = rnd();
    if (kind < 0.45) {        // halle
      const w = 300 + rnd() * 400, d = 200 + rnd() * 300, h = 160 + rnd() * 200;
      const t2 = corr.clone(); t2.needsUpdate = true; t2.wrapS = t2.wrapT = THREE.RepeatWrapping; t2.repeat.set(Math.round(w / 150), Math.round(h / 150));
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ map: t2, roughness: 0.8 })); b.position.set(x, h / 2, y); b.rotation.y = rnd() * 3; scene.add(b);
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(d / 2, d / 2, w, 3), M('#3a3d42')); roof.rotation.z = Math.PI / 2; roof.rotation.y = b.rotation.y; roof.position.set(x, h + d / 4, y); scene.add(roof);
    } else if (kind < 0.75) { // cheminée qui fume
      const h = 380 + rnd() * 300;
      const c = new THREE.Mesh(new THREE.CylinderGeometry(22, 34, h, 14), M('#7a4a3a')); c.position.set(x, h / 2, y); scene.add(c);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(23, 23, 20, 14), M('#f2f4f7')); band.position.set(x, h - 40, y); scene.add(band);
      smoke.push({ x, y: h, z: y });
    } else if (kind < 0.9) {  // four de fusion qui rougeoie
      const f = new THREE.Mesh(new THREE.CylinderGeometry(80, 90, 160, 16), M('#2b2522')); f.position.set(x, 80, y); scene.add(f);
      const top = new THREE.Mesh(new THREE.CircleGeometry(60, 16), new THREE.MeshBasicMaterial({ color: '#ffb347' })); top.rotation.x = -Math.PI / 2; top.position.set(x, 161, y); scene.add(top);
    } else {                  // bobines / poches
      const r = 40 + rnd() * 30;
      const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 70, 18), M(steel ? '#9aa4ae' : '#3a3d42', { metalness: 0.7, roughness: 0.3 })); c.position.set(x, 35, y); scene.add(c);
    }
  }
  const smokeMat = new THREE.MeshBasicMaterial({ color: '#d8d0c8', transparent: true, opacity: 0.35, depthWrite: false });
  const puffs = [];
  smoke.forEach(sm => { for (let k = 0; k < 6; k++) { const p = new THREE.Mesh(new THREE.SphereGeometry(40, 8, 6), smokeMat); p.userData = { base: sm, k }; scene.add(p); puffs.push(p); } });
  // caisses à outils
  const boxTex = tkTexture(64, 64, (b, w, h) => { b.fillStyle = '#BA2C3A'; b.fillRect(0, 0, w, h); b.strokeStyle = '#F5B700'; b.lineWidth = 6; b.strokeRect(3, 3, w - 6, h - 6); b.fillStyle = '#F5B700'; b.font = '900 40px "Big Shoulders Display", Impact'; b.textAlign = 'center'; b.fillText('?', w / 2, 47); });
  const boxMat = new THREE.MeshStandardMaterial({ map: boxTex, emissive: '#3a1006', roughness: 0.4, metalness: 0.2 });
  const boxes = (trackInfo.boxes || []).map(([x, y]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(34, 34, 34), boxMat); m.position.set(x, 30, y); scene.add(m); return m; });

  /* ---------- karts et pilotes ---------- */
  const mkKart = ch => {
    const D = DRV[ch] || { color: '#EC641E' }, look = (typeof TK_ROSTER !== 'undefined' && TK_ROSTER[ch]) || { skin: '#e0a77d', pants: '#2b2f36' };
    const grp = new THREE.Group(), body = new THREE.Group(); grp.add(body);
    const col = M(D.color, { metalness: 0.45, roughness: 0.35 }), dark = M('#1a1c1f'), chrome = M('#c9ccd1', { metalness: 0.9, roughness: 0.2 });
    const add = (geo, mat, x, y, z, parent = body) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
    add(new THREE.BoxGeometry(62, 12, 38), col, 0, 14, 0);                 // châssis
    add(new THREE.BoxGeometry(22, 10, 40), col, 26, 18, 0).rotation.z = -0.25;  // nez
    add(new THREE.BoxGeometry(10, 8, 46), dark, 36, 10, 0);                // pare-chocs
    add(new THREE.BoxGeometry(18, 20, 26), dark, -12, 26, 0);              // siège
    [-1, 1].forEach(sd => { const ex = add(new THREE.CylinderGeometry(3.5, 4.5, 16, 8), chrome, -34, 20, sd * 9); ex.rotation.z = Math.PI / 2; });
    const wheels = [[22, 20], [22, -20], [-22, 21], [-22, -21]].map(([x, z]) => { const w = add(new THREE.CylinderGeometry(9, 9, 9, 14), dark, x, 9, z); w.rotation.x = Math.PI / 2; return w; });
    const wheel = add(new THREE.TorusGeometry(6, 1.4, 6, 14), dark, 8, 30, 0); wheel.rotation.y = Math.PI / 2; wheel.rotation.x = 0.3;
    // pilote
    const driver = new THREE.Group(); driver.position.set(-10, 26, 0); body.add(driver);
    add(new THREE.BoxGeometry(14, 22, 20), M(D.color), 0, 12, 0, driver);
    const head = new THREE.Group(); head.position.set(2, 30, 0); driver.add(head);
    add(new THREE.SphereGeometry(7, 12, 10), M(look.skin || '#e0a77d'), 0, 0, 0, head);
    add(new THREE.SphereGeometry(8, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), M(ch === 'fondeur' ? '#c9ccd1' : ch === 'lamineur' ? '#F5B700' : shade(D.color, -0.2), { metalness: 0.5 }), 0, 1, 0, head);
    add(new THREE.BoxGeometry(2, 4, 10), M('#7fd4ff', { metalness: 0.5 }), 6, 1, 0, head);
    [-1, 1].forEach(sd => { const arm = add(new THREE.BoxGeometry(18, 5, 5), M(D.color), 10, 20, sd * 8, driver); arm.rotation.z = -0.4; });
    // flammes du turbo
    const flameM = new THREE.MeshBasicMaterial({ color: '#ff9a3a', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const flames = [-1, 1].map(sd => { const f = add(new THREE.ConeGeometry(4, 18, 8), flameM, -46, 20, sd * 9); f.rotation.z = Math.PI / 2; f.visible = false; return f; });
    const aura = new THREE.Mesh(new THREE.SphereGeometry(50, 16, 12), new THREE.MeshBasicMaterial({ color: '#F5B700', transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    aura.position.y = 22; aura.visible = false; grp.add(aura);
    scene.add(grp);
    return { grp, body, wheels, wheel, head, driver, flames, aura, flameM };
  };
  const karts = [];

  /* ---------- objets sur la piste ---------- */
  const objMeshes = new Map();
  const mkObj = k => {
    let m;
    if (k === 'lingot') { m = new THREE.Mesh(new THREE.BoxGeometry(34, 12, 18), M('#c9ccd1', { metalness: 0.9, roughness: 0.2 })); m.position.y = 7; }
    else if (k === 'huile') { m = new THREE.Mesh(new THREE.CircleGeometry(46, 20), M('#0d1418', { metalness: 0.9, roughness: 0.05 })); m.rotation.x = -Math.PI / 2; m.position.y = 2; }
    else if (k === 'boulet') { m = new THREE.Mesh(new THREE.SphereGeometry(14, 14, 10), M('#2b2e33', { metalness: 0.6, emissive: '#5a1a06' })); m.position.y = 14; }
    else { m = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(14, 10, 20, 12), M('#3a3d42', { metalness: 0.6 })); const top = new THREE.Mesh(new THREE.CircleGeometry(12, 12), new THREE.MeshBasicMaterial({ color: '#ffb347' })); top.rotation.x = -Math.PI / 2; top.position.y = 10.5; m.add(c, top); m.position.y = 16; }
    const grp = new THREE.Group(); grp.add(m); scene.add(grp); return grp;
  };
  // étincelles, poussière, flammes
  const NP = 500, pPos = new Float32Array(NP * 3), pCol = new Float32Array(NP * 3), parts = [];
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 6, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  pts.frustumCulled = false; scene.add(pts);
  const tmpC = new THREE.Color();
  const burst = (x, y, z, n, col, spd, life, up = 0) => {
    tmpC.set(col);
    for (let k = 0; k < n; k++) { if (parts.length >= NP) parts.shift(); parts.push({ x, y, z, vx: (Math.random() - 0.5) * spd, vy: (Math.random() - 0.5) * spd, vz: Math.random() * spd * 0.5 + up, life: life * (0.6 + Math.random() * 0.6), r: tmpC.r, g: tmpC.g, b: tmpC.b }); }
  };

  /* ---------- réception ---------- */
  let prev = null, cur = null, curAt = 0, prevAt = 0, seenEv = 0;
  function push(v) {
    prev = cur || v; prevAt = curAt || performance.now(); cur = v; curAt = performance.now();
    const sk = v.k[mySeat];
    if (sk && sk.tp !== me.tp) {     // départ ou recalage par le serveur
      const L = locate(sk.x, sk.y, null);
      Object.assign(me, { x: sk.x, y: sk.y, a: sk.a, v: 0, tp: sk.tp, hint: L.i, s: L.s });
      if (me.lap === -1 && L.s < LEN * 0.5) me.lap = Math.max(0, sk.lap);
    }
    for (const e of v.ev) {
      if (e.id <= seenEv) continue;
      seenEv = e.id;
      const mine = e.seat === mySeat;
      if (e.k === 'box') {
        burst(e.x, 30, e.y, 20, '#F5B700', 220, 0.5, 80);
        if (mine) { roulette = 1.1; rouletteItem = e.it; sfx(660, 0.08, 'triangle', 0.04); }
      } else if (e.k === 'use') {
        if (mine) {
          if (e.it === 'oxygene') { me.boost = 1.4; sfx(180, 0.5, 'sawtooth', 0.05, 400); }
          if (e.it === 'tablier') { me.star = 6; sfx(880, 0.6, 'triangle', 0.05, 440); }
          if (e.it === 'boulet' || e.it === 'poche') sfx(220, 0.15, 'square', 0.05, -100);
          if (e.it === 'lingot' || e.it === 'huile') sfx(400, 0.08, 'triangle', 0.04);
        }
        if (e.it === 'coupure') {
          if (!mine && me.star <= 0) { me.slow = 3; msg = `⚡ ${v.k[e.seat].n} a coupé le courant !`; msgAt = performance.now(); }
          sfx(90, 0.6, 'sawtooth', 0.05, -40); flashT = 0.25;
        }
      } else if (e.k === 'spin') {
        burst(e.x, 20, e.y, 26, '#ffb347', 300, 0.6, 120);
        if (mine) { me.spin = 1.1; me.v *= 0.2; me.drift = 0; me.charge = 0; shake = 0.5; sfx(120, 0.4, 'sawtooth', 0.06, -60); msg = `Touché : ${(KART_ITEMS[e.why] || { name: 'tablier' }).name} !`; msgAt = performance.now(); }
        else if (e.by === mySeat) { sfx(990, 0.15, 'triangle', 0.05); msg = `🎯 ${v.k[e.seat].n} dérape !`; msgAt = performance.now(); }
      } else if (e.k === 'pop') {
        burst(e.x, 15, e.y, 18, '#c9ccd1', 240, 0.4, 60);
      } else if (e.k === 'finish') {
        if (mine) { msg = `ARRIVÉE ! ${ORD(e.place)}`; msgAt = performance.now(); sfx(523, 0.15, 'square', 0.05); setTimeout(() => sfx(784, 0.4, 'square', 0.05), 150); }
      }
    }
  }

  /* ---------- pilotage de mon kart ---------- */
  let shake = 0, flashT = 0, prevDriftHeld = false, engine = 0;
  function drive(dt) {
    const D = myDrv();
    const L = locate(me.x, me.y, me.hint);
    me.hint = L.i;
    me.off = Math.abs(L.lat) > TW / 2 + 6;
    let cap = PH.vmax * (D.speed || 1) * (me.off ? PH.offroad : 1) * (me.slow > 0 ? PH.slow : 1);
    if (me.boost > 0) cap = Math.max(cap, PH.boost);
    if (me.star > 0) cap = Math.max(cap, PH.star);
    const steer = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
    const drift = held.has('drift');
    if (me.spin > 0) {
      me.v -= Math.sign(me.v) * Math.min(Math.abs(me.v), 900 * dt);
      me.a += 10 * dt;
    } else {
      if (held.has('up')) { if (me.v < cap) me.v = Math.min(cap, me.v + PH.acc * dt * (me.v < 0 ? 2 : 1)); }
      else if (held.has('down')) me.v -= (me.v > 0 ? PH.brake : PH.acc * 0.6) * dt;
      else me.v -= Math.sign(me.v) * Math.min(Math.abs(me.v), (120 + Math.abs(me.v) * PH.drag) * dt);
      me.v = Math.max(-180, me.v);
      if (me.v > cap) me.v -= (me.v - cap) * Math.min(1, (me.boost > 0 ? 6 : 2.2) * dt);
      if (me.boost > 0 && held.has('up')) me.v = Math.max(me.v, Math.min(cap, me.v + 900 * dt));
      const rate = PH.steer * (D.grip || 1) * Math.max(-1, Math.min(1, me.v / 220));
      // dérapage : on appuie en tournant, on charge le mini-turbo, on relâche pour le déclencher
      if (drift && !prevDriftHeld && steer && me.v > 250 && !me.off) { me.drift = steer; me.charge = 0; sfx(200, 0.08, 'triangle', 0.03); }
      if (me.drift && (!drift || me.v < 180)) {
        if (me.charge > 1.4) { me.boost = Math.max(me.boost, 1.0); sfx(240, 0.3, 'sawtooth', 0.05, 500); }
        else if (me.charge > 0.7) { me.boost = Math.max(me.boost, 0.55); sfx(240, 0.2, 'sawtooth', 0.04, 300); }
        me.drift = 0; me.charge = 0;
      }
      if (me.drift) {
        me.a += (me.drift * 0.75 + steer * 0.45) * Math.abs(rate) * dt;
        me.charge += dt * (steer === me.drift ? 1.25 : 0.7);
      } else me.a += steer * rate * dt;
    }
    prevDriftHeld = drift;
    // glisse en dérapage : la trajectoire suit le cap avec un peu de retard
    const slip = me.drift ? me.drift * 0.32 : 0;
    me.x += Math.cos(me.a - slip) * me.v * dt; me.y += Math.sin(me.a - slip) * me.v * dt;
    // muret : on rebondit
    const L2 = locate(me.x, me.y, me.hint);
    if (Math.abs(L2.lat) > TW / 2 + 128) {
      const [px, py, pa] = pointAt(L2.s), nx = -Math.sin(pa), ny = Math.cos(pa), lim = Math.sign(L2.lat) * (TW / 2 + 124);
      me.x = px + nx * lim; me.y = py + ny * lim;
      if (Math.abs(me.v) > 200) { burst(me.x, 15, me.y, 12, '#ffe07a', 200, 0.3); sfx(160, 0.08, 'square', 0.04); shake = 0.2; }
      me.v *= 0.55;
    }
    // tours : passage de la ligne (dans le bon sens)
    const ns = L2.s;
    if (me.s > LEN * 0.8 && ns < LEN * 0.2) { me.lap++; if (me.lap >= 1 && me.lap < LAPS) { msg = me.lap === LAPS - 1 ? 'DERNIER TOUR !' : `TOUR ${me.lap + 1}`; msgAt = performance.now(); sfx(660, 0.2, 'square', 0.04); } }
    else if (me.s < LEN * 0.2 && ns > LEN * 0.8) me.lap--;
    // mauvais sens
    const [, , ta] = pointAt(ns);
    me.wrong = Math.cos(me.a - ta) < -0.3 && me.v > 80 ? me.wrong + dt : 0;
    me.s = ns; me.hint = L2.i;
    for (const k of ['boost', 'star', 'spin', 'slow']) me[k] = Math.max(0, me[k] - dt);
    // collisions entre karts (on se pousse)
    cur.k.forEach((o, i) => {
      if (i === mySeat) return;
      const p = interpK(i), d = Math.hypot(p.x - me.x, p.y - me.y);
      if (d < KR * 2 && d > 0.1) { const push2 = (KR * 2 - d) / 2; me.x -= (p.x - me.x) / d * push2; me.y -= (p.y - me.y) / d * push2; if (me.star <= 0) me.v *= 0.97; }
    });
    // particules du dérapage et du hors-piste
    const back = [me.x - Math.cos(me.a) * 30, me.y - Math.sin(me.a) * 30];
    if (me.drift && Math.random() < 0.8) burst(back[0], 6, back[1], 1, me.charge > 1.4 ? '#ff9a3a' : me.charge > 0.7 ? '#5AA8FF' : '#e8ecf2', 120, 0.25, 40);
    if (me.off && Math.abs(me.v) > 100 && Math.random() < 0.5) burst(back[0], 6, back[1], 1, steel ? '#b0b0b0' : '#c4a06e', 80, 0.5, 30);
    // envoi au serveur
    const now = performance.now();
    if (now - lastSend > 50 && cur.phase === 'race') {
      lastSend = now;
      send({ t: 'act', a: 'pos', x: +me.x.toFixed(1), y: +me.y.toFixed(1), ang: +me.a.toFixed(3), v: Math.round(me.v), lap: me.lap });
    }
  }

  const lerp = (a, b, t) => a + (b - a) * t;
  const angLerp = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
  function interpK(i) {
    const p = cur.k[i], q = (prev && prev.k[i]) || p;
    if (i === mySeat && p.fin === null) return { ...p, x: me.x, y: me.y, a: me.a, v: me.v };
    const t = Math.min(1.2, (performance.now() - curAt) / Math.max(30, curAt - prevAt));
    return { ...p, x: lerp(q.x, p.x, t), y: lerp(q.y, p.y, t), a: angLerp(q.a, p.a, Math.min(1, t)) };
  }

  /* ---------- HUD ---------- */
  const itemIcon = (k, x, y, s) => {
    const it = KART_ITEMS[k]; if (!it) return;
    g.save(); g.translate(x, y); g.scale(s, s);
    g.fillStyle = it.col; g.strokeStyle = '#000'; g.lineWidth = 2;
    if (k === 'lingot') { g.beginPath(); g.moveTo(-18, 8); g.lineTo(18, 8); g.lineTo(12, -8); g.lineTo(-12, -8); g.closePath(); g.fill(); g.stroke(); }
    else if (k === 'huile') { g.beginPath(); g.ellipse(0, 4, 22, 10, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = 'rgba(160,120,255,.6)'; g.beginPath(); g.ellipse(-4, 2, 8, 3, 0, 0, Math.PI * 2); g.fill(); }
    else if (k === 'boulet') { g.beginPath(); g.arc(0, 0, 16, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = '#ff8a2a'; g.beginPath(); g.arc(-5, -5, 4, 0, Math.PI * 2); g.fill(); }
    else if (k === 'poche') { g.fillStyle = '#3a3d42'; g.beginPath(); g.moveTo(-16, -8); g.lineTo(16, -8); g.lineTo(10, 14); g.lineTo(-10, 14); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#ffb347'; g.fillRect(-14, -12, 28, 6); }
    else if (k === 'oxygene') { g.beginPath(); g.roundRect(-9, -18, 18, 36, 7); g.fill(); g.stroke(); g.fillStyle = '#ddd'; g.fillRect(-4, -24, 8, 7); }
    else if (k === 'tablier') { g.beginPath(); g.moveTo(-14, -18); g.lineTo(14, -18); g.lineTo(18, 18); g.lineTo(-18, 18); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#fff6c0'; g.fillRect(-10, -12, 6, 26); }
    else { g.beginPath(); g.moveTo(4, -20); g.lineTo(-10, 2); g.lineTo(0, 2); g.lineTo(-4, 20); g.lineTo(12, -4); g.lineTo(2, -4); g.closePath(); g.fill(); g.stroke(); }
    g.restore();
  };
  function hud(dt) {
    g.clearRect(0, 0, W, H);
    const sk = cur.k[mySeat];
    if (me.slow > 0) { g.fillStyle = `rgba(160,110,255,${0.12 + Math.sin(performance.now() / 60) * 0.05})`; g.fillRect(0, 0, W, H); }
    if (flashT > 0) { g.fillStyle = `rgba(230,220,255,${flashT * 2})`; g.fillRect(0, 0, W, H); }
    // case de l'objet (roulette quand on vient d'ouvrir une caisse)
    g.fillStyle = 'rgba(8,9,11,.75)'; g.strokeStyle = '#F5B700'; g.lineWidth = 3;
    g.beginPath(); g.roundRect(16, 16, 84, 84, 14); g.fill(); g.stroke();
    if (roulette > 0) {
      roulette -= dt;
      const keys = Object.keys(KART_ITEMS); itemIcon(keys[Math.floor(performance.now() / 70) % keys.length], 58, 58, 1.3);
      if (roulette <= 0) sfx(990, 0.12, 'triangle', 0.05);
    } else if (sk && sk.it) {
      itemIcon(sk.it, 58, 58, 1.3);
      g.font = '800 12px Archivo, sans-serif'; g.textAlign = 'left'; g.fillStyle = '#fff'; g.fillText(KART_ITEMS[sk.it].name, 110, 46);
      g.fillStyle = '#9aa0a6'; g.font = '600 11px Archivo, sans-serif'; g.fillText(`${KART_ITEMS[sk.it].tip} · E`, 110, 64);
    }
    // place et tours
    if (sk) {
      const place = sk.rk;
      g.font = '900 72px "Big Shoulders Display", Impact'; g.textAlign = 'right';
      g.lineWidth = 8; g.strokeStyle = '#000'; g.strokeText(ORD(place), W - 24, H - 34);
      g.fillStyle = place === 1 ? '#F5B700' : place <= 3 ? '#fff' : '#ff8a8a'; g.fillText(ORD(place), W - 24, H - 34);
      g.font = '400 11px "Press Start 2P", monospace'; g.fillStyle = '#fff';
      g.fillText(`TOUR ${Math.min(LAPS, Math.max(1, me.lap + 1))}/${LAPS}`, W - 24, H - 112);
      g.fillText(`${cur.elapsed.toFixed(1)} s`, W - 24, H - 130);
      // vitesse
      g.textAlign = 'left'; g.font = '900 34px "Big Shoulders Display", Impact'; g.fillStyle = me.boost > 0 ? '#ff9a3a' : '#fff';
      g.fillText(`${Math.round(Math.abs(me.v) * 0.22)}`, 24, H - 30); g.font = '600 12px Archivo, sans-serif'; g.fillText('km/h', 24 + g.measureText('000').width + 26, H - 32);
      if (me.drift) { const c = me.charge > 1.4 ? '#ff9a3a' : me.charge > 0.7 ? '#5AA8FF' : '#c6cad0'; g.fillStyle = c; g.fillRect(24, H - 80, Math.min(1, me.charge / 1.4) * 140, 8); g.font = '400 8px "Press Start 2P", monospace'; g.fillText('MINI-TURBO', 24, H - 88); }
    }
    // mini-carte
    const mw = 180, mh = 150, mx0 = W - mw - 16, my0 = 16;
    const sc = Math.min(mw / (maxX - minX - 2400), mh / (maxY - minY - 2400));
    const toM = (x, y) => [mx0 + (x - minX - 1200) * sc, my0 + (y - minY - 1200) * sc];
    g.fillStyle = 'rgba(8,9,11,.6)'; g.fillRect(mx0 - 6, my0 - 6, mw + 12, mh + 12);
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 5; g.beginPath(); PATH.forEach((p, i) => { const [a, b] = toM(p[0], p[1]); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.closePath(); g.stroke();
    cur.k.forEach((k, i) => { const p = interpK(i), [a, b] = toM(p.x, p.y); g.fillStyle = i === mySeat ? '#fff' : (DRV[k.ch] || {}).color || '#888'; g.beginPath(); g.arc(a, b, i === mySeat ? 5 : 3.5, 0, Math.PI * 2); g.fill(); if (i === mySeat) { g.strokeStyle = '#000'; g.lineWidth = 2; g.stroke(); } });
    // décompte, messages
    if (cur.phase === 'count') { const n = Math.ceil(cur.countdown); bigText(g, n > 3 ? 'PRÊTS ?' : String(n), W / 2, H / 2 - 40, n > 3 ? 60 : 110, '#F5B700'); }
    else if (cur.elapsed < 1.2) bigText(g, 'PARTEZ !', W / 2, H / 2 - 40, 90, '#7FD48A');
    if (msg && performance.now() - msgAt < 2200) bigText(g, msg, W / 2, H / 2 + 60, 34, '#fff');
    if (me.wrong > 1) bigText(g, 'MAUVAIS SENS !', W / 2, H / 2 - 120, 44, '#ff5a5a');
    if (sk && sk.fin !== null) bigText(g, `ARRIVÉE : ${ORD(sk.rk)} · ${sk.fin.toFixed(2)} s`, W / 2, H / 2 - 120, 40, '#F5B700');
    g.font = '400 8px "Press Start 2P", monospace'; g.textAlign = 'left'; g.fillStyle = '#9aa0a6';
    g.fillText(`${mode === 'fps' ? '1RE' : '3E'} PERSONNE (V)`, 18, 118);
  }

  /* ---------- boucle ---------- */
  let lastW = 0, lastH = 0;
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  let camInit = false;
  const stop = loop((dt, tms) => {
    if (!cur) return;
    const t = tms / 1000;
    const sk = cur.k[mySeat];
    if (sk && cur.phase === 'race' && sk.fin === null) drive(dt);
    else if (sk && sk.fin !== null) { me.x = sk.x; me.y = sk.y; me.a = sk.a; }
    // moteur : un petit ronronnement qui suit la vitesse
    engine -= dt;
    if (engine <= 0 && cur.phase === 'race') { engine = 0.11; sfx(55 + Math.abs(me.v) * 0.18, 0.1, 'sawtooth', 0.012); }
    shake = Math.max(0, shake - dt); flashT = Math.max(0, flashT - dt);
    const cw = cv.clientWidth, ch = cv.clientHeight;
    if (cw && (cw !== lastW || ch !== lastH)) { lastW = cw; lastH = ch; renderer.setSize(cw, ch, false); canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px'; cam.aspect = cw / ch; cam.updateProjectionMatrix(); }
    // karts
    cur.k.forEach((k, i) => {
      if (!karts[i]) karts[i] = mkKart(k.ch);
      const K = karts[i], p = interpK(i);
      K.grp.position.set(p.x, 0, p.y);
      const drift = i === mySeat ? me.drift : 0;
      K.grp.rotation.y = -p.a + (k.sp > 0 || (i === mySeat && me.spin > 0) ? t * 12 : 0);
      K.body.rotation.y = -drift * 0.35;
      K.body.rotation.z = Math.sin(t * 30 + i) * Math.min(1, Math.abs(p.v || 0) / 500) * 0.01;
      K.wheels.forEach(w => { w.rotation.y += (p.v || 0) * dt * 0.1; });
      const boosting = i === mySeat ? me.boost > 0 : k.bo > 0;
      K.flames.forEach(f => { f.visible = boosting; f.scale.set(1, 1 + Math.random() * 0.8, 1); });
      const star = i === mySeat ? me.star > 0 : k.st > 0;
      K.aura.visible = star; if (star) K.aura.material.color.setHSL((t * 0.8) % 1, 1, 0.6);
      K.head.visible = K.driver.visible = !(i === mySeat && mode === 'fps');
    });
    // objets
    const ids = new Set(cur.o.map(o => o[0]));
    for (const [id, m] of objMeshes) if (!ids.has(id)) { scene.remove(m); objMeshes.delete(id); }
    for (const o of cur.o) {
      let m = objMeshes.get(o[0]);
      if (!m) { m = mkObj(o[1]); objMeshes.set(o[0], m); m.position.set(o[2], 0, o[3]); }
      m.position.x += (o[2] - m.position.x) * Math.min(1, dt * 15); m.position.z += (o[3] - m.position.z) * Math.min(1, dt * 15);
      if (o[1] === 'boulet' || o[1] === 'poche') { m.rotation.y += dt * 8; if (Math.random() < 0.5) burst(m.position.x, 16, m.position.z, 1, '#ff8a2a', 40, 0.3); }
      if (o[1] === 'lingot') m.rotation.y += dt;
    }
    // caisses
    boxes.forEach((b, k) => { b.visible = (cur.bx || '')[k] !== '0'; b.rotation.y = t * 1.5 + k; b.rotation.x = t; b.position.y = 30 + Math.sin(t * 3 + k) * 5; });
    // feux du portique
    const cd = cur.countdown;
    lightsG.forEach((l, k) => l.material.color.set(cur.phase === 'count' ? (cd <= 3 - k + 1 && cd > 0 ? '#ff2a2a' : '#330808') : cur.elapsed < 2 ? '#2aff5a' : '#0a2a10'));
    // fumées
    puffs.forEach(p => { const b = p.userData.base, ph = ((t * 0.25 + p.userData.k / 6) % 1); p.position.set(b.x + ph * 120, b.y + ph * 300, b.z + Math.sin(ph * 6) * 30); p.scale.setScalar(0.6 + ph * 1.8); });
    // particules
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; } p.vz -= 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z = Math.max(1, p.z + p.vz * dt); }
    parts.forEach((p, i) => { pPos[i * 3] = p.x; pPos[i * 3 + 1] = p.z; pPos[i * 3 + 2] = p.y; const a = Math.min(1, p.life * 3); pCol[i * 3] = p.r * a; pCol[i * 3 + 1] = p.g * a; pCol[i * 3 + 2] = p.b * a; });
    pGeo.setDrawRange(0, parts.length); pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
    // caméra : derrière le kart, ou au volant
    const meK = interpK(mySeat), dir = lookBack ? -1 : 1;
    const ca = Math.cos(meK.a), sa = Math.sin(meK.a);
    const fov = 70 + (me.boost > 0 ? 12 : 0) + Math.min(8, Math.abs(me.v) / 90);
    if (Math.abs(cam.fov - fov) > 0.2) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 4); cam.updateProjectionMatrix(); }
    if (mode === 'fps' && !lookBack) {
      camPos.set(meK.x - ca * 6, 58, meK.y - sa * 6);
      camLook.set(meK.x + ca * 200, 46, meK.y + sa * 200);
      cam.position.copy(camPos);
    } else {
      const want = new THREE.Vector3(meK.x - ca * 170 * dir, 78, meK.y - sa * 170 * dir);
      if (!camInit) { camPos.copy(want); camInit = true; }
      camPos.lerp(want, Math.min(1, dt * 6));
      camLook.set(meK.x + ca * 110 * dir, 22, meK.y + sa * 110 * dir);
      cam.position.copy(camPos);
    }
    if (shake > 0) { cam.position.x += (Math.random() - 0.5) * 10 * shake; cam.position.y += (Math.random() - 0.5) * 10 * shake; }
    cam.lookAt(camLook);
    if (mode === 'fps') cam.rotateZ(-(me.drift * 0.08 + ((held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0)) * 0.03));
    renderer.render(scene, cam);
    hud(dt);
  });

  return {
    push, endShown: false, me,
    stop() {
      stop();
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur);
      renderer.dispose();
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; ms.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); });
    },
  };
}
