/* Escadrille 102 — combat aérien en 3D, vue 3e personne ou cockpit (simulation serveur : planes.py) */
'use strict';

let planeClient = null;
function stopPlanes() { if (planeClient && planeClient !== 'loading') planeClient.stop(); planeClient = null; }

function updatePlanes() {
  if (!view || onlineKind !== 'planes') return;
  if (view.finished) {
    if (document.getElementById('rewardBox')) return;
    stopPlanes();
    resultScreen(view.finished.map((i, k) => {
      const p = view.p[i];
      return `<li><b>${k + 1}</b><i style="background:${p.c}"></i><span>${esc(p.n)}${i === mySeat ? ' (toi)' : ''}</span><em>${p.k} abattus · ${p.d} chutes</em></li>`;
    }));
    return;
  }
  if (!planeClient) {
    planeClient = 'loading';
    stage.innerHTML = '<div class="screen"><p>Mise en route des réacteurs…</p></div>';
    loadThree().then(() => { if (planeClient === 'loading' && onlineKind === 'planes') { planeClient = startPlanesClient(); planeClient.push(view); } })
      .catch(e => { planeClient = null; toast(e.message); });
    return;
  }
  if (planeClient !== 'loading') planeClient.push(view);
}

/* Avion vu du dessus, nez vers +x (aperçus de la borne et de l'intro) */
function drawPlane(g, color, firing, t, scale = 1) {
  g.save(); g.scale(scale, scale);
  g.fillStyle = 'rgba(0,0,0,.28)';                    // ombre portée
  g.save(); g.translate(-8, 14); drawPlaneBody(g, 'rgba(0,0,0,.35)', true); g.restore();
  drawPlaneBody(g, color, false);
  // hélice
  g.fillStyle = 'rgba(230,230,230,.35)'; g.beginPath(); g.ellipse(25, 0, 3, 13, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(30,30,30,.7)'; g.lineWidth = 2; g.beginPath();
  const pa = t * 60; g.moveTo(25, Math.sin(pa) * 13); g.lineTo(25, -Math.sin(pa) * 13); g.stroke();
  if (firing && Math.random() < 0.7) {
    g.fillStyle = '#ffe07a';
    [-9, 9].forEach(y => { g.beginPath(); g.moveTo(14, y); g.lineTo(30 + Math.random() * 8, y); g.lineTo(14, y + 2); g.fill(); });
  }
  g.restore();
}
function drawPlaneBody(g, color, flat) {
  g.fillStyle = color;
  g.beginPath(); g.roundRect(-18, -24, 14, 48, 4); g.fill();                     // ailes
  g.beginPath(); g.roundRect(-26, -10, 7, 20, 3); g.fill();                       // empennage
  g.beginPath(); g.ellipse(0, 0, 24, 6.5, 0, 0, Math.PI * 2); g.fill();          // fuselage
  if (flat) return;
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(-18, -24, 14, 4); g.fillRect(-18, 20, 14, 4);
  g.fillStyle = '#1b2a38'; g.beginPath(); g.ellipse(4, 0, 6, 3.5, 0, 0, Math.PI * 2); g.fill();   // cockpit
  g.fillStyle = '#fff'; g.beginPath(); g.arc(-11, -16, 3, 0, Math.PI * 2); g.arc(-11, 16, 3, 0, Math.PI * 2); g.fill();  // cocardes
}


/* ---------- combat aérien en 3D ---------- */
const PL_KEYS = { L: 1, R: 2, U: 4, D: 8, F: 16, M: 32, B: 64, BR: 128, FL: 256 };

function startPlanesClient() {
  const W = 960, H = 540, DT = 1 / 30;
  stage.innerHTML = '';
  $('#hudInfo').textContent = 'Combat aérien · chacun pour soi';
  const wrap = document.createElement('div'); wrap.className = 'play-wrap'; stage.appendChild(wrap);
  const screen = document.createElement('div'); screen.className = 'tk-screen'; wrap.appendChild(screen);
  const { c: hud, g } = makeCanvas(screen, W, H);
  hud.classList.add('tk-hud');
  const pad = document.createElement('div'); pad.className = 'touch-pad';
  pad.innerHTML = `<div class="grp"><button data-m="1">◀</button><button data-m="4">▲</button><button data-m="8">▼</button><button data-m="2">▶</button></div>
    <div class="grp"><button data-m="64">PC</button><button data-m="128">FREIN</button><button data-m="16" class="hot">CANON</button><button data-m="32" class="warm">MISSILE</button><button data-m="256">LEURRES</button><button data-v="1">VUE</button></div>`;
  wrap.appendChild(pad);
  const hint = document.createElement('p'); hint.className = 'keys-hint';
  hint.textContent = '← → / Q D VIRER · ↑ / Z MONTER · ↓ / S PIQUER · MAJ POSTCOMBUSTION · C FREIN · ESPACE / J CANON · K MISSILE (VERROUILLE D’ABORD) · L LEURRES · V VUE 1RE / 3E';
  wrap.appendChild(hint);

  /* entrées */
  let mask = 0, lastSent = -1, lastAt = 0;
  let camMode = save.plView === '1re' ? '1re' : '3e';
  const KEYS = { ArrowLeft: 1, KeyA: 1, KeyQ: 1, ArrowRight: 2, KeyD: 2, ArrowUp: 4, KeyW: 4, KeyZ: 4, ArrowDown: 8, KeyS: 8, Space: 16, KeyJ: 16, KeyK: 32, KeyE: 32, ShiftLeft: 64, ShiftRight: 64, KeyC: 128, KeyL: 256, KeyF: 256 };
  const flush = () => { if (mask !== lastSent) { lastSent = mask; lastAt = performance.now(); send({ t: 'act', a: 'input', k: mask }); } };
  const toggleView = () => { camMode = camMode === '3e' ? '1re' : '3e'; save.plView = camMode; persist(); toast(`Vue à la ${camMode} personne`); };
  const kd = e => { if (e.code === 'KeyV' && !e.repeat) { e.preventDefault(); toggleView(); return; } const m = KEYS[e.code]; if (!m) return; e.preventDefault(); mask |= m; flush(); };
  const ku = e => { const m = KEYS[e.code]; if (!m) return; mask &= ~m; flush(); };
  const blur = () => { mask = 0; flush(); };
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('blur', blur);
  pad.querySelectorAll('[data-m]').forEach(bt => {
    const m = +bt.dataset.m;
    bt.addEventListener('pointerdown', e => { e.preventDefault(); mask |= m; bt.classList.add('on'); flush(); });
    const up = () => { mask &= ~m; bt.classList.remove('on'); flush(); };
    bt.addEventListener('pointerup', up); bt.addEventListener('pointerleave', up); bt.addEventListener('pointercancel', up);
  });
  pad.querySelector('[data-v]').addEventListener('pointerdown', e => { e.preventDefault(); toggleView(); });

  /* scène : vallée des fonderies, ciel, nuages */
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputEncoding = THREE.sRGBEncoding;
  const canvas = renderer.domElement; canvas.className = 'tk-3d'; canvas.dataset.overlay = '1';
  screen.insertBefore(canvas, hud);
  const scene = new THREE.Scene();
  const skyCol = new THREE.Color('#8fb8dc');
  scene.background = skyCol; scene.fog = new THREE.Fog('#a9c6e0', 2500, 11000);
  const cam = new THREE.PerspectiveCamera(65, W / H, 1, 30000);
  scene.add(new THREE.HemisphereLight('#dfefff', '#5a6a3a', 0.85));
  const sun = new THREE.DirectionalLight('#fff3dc', 0.9); sun.position.set(3000, 5000, 2000); scene.add(sun);
  const M = (color, extra) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.2, ...(extra || {}) }); m.color.convertSRGBToLinear(); return m; };
  const Glow = (color, op = 0.9) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
  const add = (geo, mat, x, y, z, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  // sol en damier de champs, routes et rivière
  const fields = tkTexture(1024, 1024, (b, w, h) => {
    const cols = ['#6f8a4a', '#7d9a52', '#8a8a4e', '#a39a5c', '#5f7a40', '#8aa25a'];
    for (let i = 0; i < 260; i++) { b.fillStyle = cols[i % cols.length]; b.fillRect(Math.random() * w, Math.random() * h, 40 + Math.random() * 140, 40 + Math.random() * 140); }
    b.strokeStyle = '#9a9488'; b.lineWidth = 4; for (let i = 0; i < 6; i++) { b.beginPath(); b.moveTo(0, Math.random() * h); b.lineTo(w, Math.random() * h); b.stroke(); }
    b.strokeStyle = '#4a7aa8'; b.lineWidth = 16; b.beginPath(); b.moveTo(0, h * 0.3); b.bezierCurveTo(w * 0.3, h * 0.1, w * 0.6, h * 0.9, w, h * 0.6); b.stroke();
  }, [8, 8]);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), new THREE.MeshStandardMaterial({ map: fields, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  // la ville-usine au centre : halles, cheminées, tours de refroidissement
  const town = new THREE.Group(); scene.add(town);
  const brick = M('#8a4a32'), roof = M('#5c6067', { metalness: 0.5 }), concrete = M('#b8b2a8');
  const chimneys = [];
  for (let i = 0; i < 26; i++) {
    const x = (Math.random() - 0.5) * 2200, z = (Math.random() - 0.5) * 2200, w = 80 + Math.random() * 160, d = 60 + Math.random() * 120, hh = 30 + Math.random() * 50;
    add(new THREE.BoxGeometry(w, hh, d), brick, x, hh / 2, z, town);
    add(new THREE.BoxGeometry(w + 6, 6, d + 6), roof, x, hh + 3, z, town);
  }
  for (let i = 0; i < 9; i++) {
    const a = i * 0.7, r = 300 + (i % 3) * 400, x = Math.cos(a) * r, z = Math.sin(a) * r, hh = 160 + (i % 4) * 50;
    add(new THREE.CylinderGeometry(9, 14, hh, 12), brick, x, hh / 2, z, town);
    add(new THREE.CylinderGeometry(11, 11, 8, 12), M('#F5B700'), x, hh - 20, z, town);
    chimneys.push([x, hh, z]);
  }
  [[900, 700], [-1100, -600], [700, -1200]].forEach(([x, z]) => { const t = add(new THREE.CylinderGeometry(70, 110, 180, 24, 1, true), M('#c9c4ba', { side: THREE.DoubleSide }), x, 90, z, town); });
  // montagnes à l'horizon
  for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2, r = 9000 + Math.random() * 2500, hh = 900 + Math.random() * 1600; add(new THREE.ConeGeometry(1400 + Math.random() * 900, hh, 6), M(i % 2 ? '#5a6a54' : '#6a7660', { flatShading: true }), Math.cos(a) * r, hh / 2 - 20, Math.sin(a) * r); }
  // nuages
  const cloudTex = tkTexture(128, 128, (b, w, h) => { for (let i = 0; i < 9; i++) { const gr = b.createRadialGradient(30 + Math.random() * 68, 40 + Math.random() * 48, 2, 64, 64, 50); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); b.fillStyle = gr; b.beginPath(); b.arc(30 + Math.random() * 68, 40 + Math.random() * 48, 30 + Math.random() * 20, 0, Math.PI * 2); b.fill(); } });
  for (let i = 0; i < 70; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.85, depthWrite: false, fog: true })); const a = Math.random() * Math.PI * 2, r = Math.random() * 6500; s.position.set(Math.cos(a) * r, 700 + Math.random() * 1200, Math.sin(a) * r); s.scale.setScalar(400 + Math.random() * 700); scene.add(s); }
  // limite de la zone de combat (visible quand on s'en approche)
  const fence = new THREE.Mesh(new THREE.CylinderGeometry(4200, 4200, 3000, 64, 1, true), new THREE.MeshBasicMaterial({ color: '#ff5a3a', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, wireframe: true }));
  fence.position.y = 1500; scene.add(fence);

  /* avion original : fuselage, aile delta, plans canard, double dérive, tuyère qui s'allume en postcombustion */
  const wingGeo = (() => { const s = new THREE.Shape(); s.moveTo(4, 0); s.lineTo(-6, 9); s.lineTo(-8, 9); s.lineTo(-7, 0); s.lineTo(4, 0); const g2 = new THREE.ExtrudeGeometry(s, { depth: 0.4, bevelEnabled: false }); g2.rotateX(Math.PI / 2); return g2; })();
  const mkPlane = color => {
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body); body.rotation.order = 'YZX';
    const paint = M(color, { metalness: 0.35, roughness: 0.45 }), grey = M('#3a3d42', { metalness: 0.6 });
    add(new THREE.CylinderGeometry(1.3, 1.7, 15, 12), paint, 0, 0, 0, body).rotation.z = Math.PI / 2;
    add(new THREE.ConeGeometry(1.3, 5, 12), paint, 10, 0, 0, body).rotation.z = -Math.PI / 2;
    const canopy = add(new THREE.SphereGeometry(1.2, 12, 8), M('#1b2a38', { metalness: 0.9, roughness: 0.1 }), 4, 1.1, 0, body); canopy.scale.set(2.2, 0.8, 0.9);
    [1, -1].forEach(sd => {
      const w2 = add(wingGeo, paint, -1, -0.3, 0, body); w2.scale.z = sd;
      const c2 = add(new THREE.BoxGeometry(2.5, 0.2, 2.6), paint, 5, 0, sd * 2.2, body); c2.rotation.y = sd * 0.3;
      const fin = add(new THREE.BoxGeometry(3.6, 4, 0.25), paint, -6.5, 2.2, sd * 1.3, body); fin.rotation.x = sd * -0.25;
      add(new THREE.BoxGeometry(3, 0.2, 2.8), paint, -7, 0, sd * 2.6, body);
      add(new THREE.BoxGeometry(0.5, 0.5, 0.5), Glow(sd > 0 ? '#3aff6a' : '#ff3a3a', 1), -6.8, -0.3, sd * 9, body);   // feux de position
    });
    add(new THREE.CylinderGeometry(1.4, 1.2, 1.6, 12), grey, -8, 0, 0, body).rotation.z = Math.PI / 2;
    const ab = add(new THREE.ConeGeometry(1.1, 7, 10), Glow('#ffb347', 0.85), -12, 0, 0, body); ab.rotation.z = Math.PI / 2;
    root.userData = { body, ab };
    scene.add(root);
    return root;
  };
  const planes = [];

  /* particules : fumée, feu, étincelles, leurres, traînées */
  const NP = 1600, pPos = new Float32Array(NP * 3), pCol = new Float32Array(NP * 3), pv = [];
  for (let i = 0; i < NP; i++) { pPos[i * 3 + 1] = -9999; pv.push({ life: 0, max: 1, vx: 0, vy: 0, vz: 0, g: 0, c: null }); }
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const pMat = new THREE.PointsMaterial({ size: 9, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true });
  scene.add(new THREE.Points(pGeo, pMat));
  let pi = 0; const tc = new THREE.Color();
  const emit = (x, y, z, col, n, sp, life, gr = 0, vx = 0, vy = 0, vz = 0) => {
    tc.set(col);
    for (let k = 0; k < n; k++) {
      const i = pi = (pi + 1) % NP, q = pv[i];
      pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z;
      pCol[i * 3] = tc.r; pCol[i * 3 + 1] = tc.g; pCol[i * 3 + 2] = tc.b;
      Object.assign(q, { life: life * (0.6 + Math.random() * 0.4), max: life, vx: vx + (Math.random() - 0.5) * sp, vy: vy + (Math.random() - 0.5) * sp, vz: vz + (Math.random() - 0.5) * sp, g: gr });
    }
  };
  // traçantes du canon (simulées ici à partir du drapeau « tire »)
  const NT = 400, tPos = new Float32Array(NT * 6), tr = [];
  for (let i = 0; i < NT; i++) tr.push({ life: 0 });
  const tGeo = new THREE.BufferGeometry(); tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
  scene.add(new THREE.LineSegments(tGeo, new THREE.LineBasicMaterial({ color: '#ffe07a', transparent: true, opacity: 0.9 })));
  let ti = 0;
  // boules de feu
  const booms = [];
  const fireball = (x, y, z, big) => {
    const m = add(new THREE.SphereGeometry(1, 14, 10), Glow('#ffb347', 1), x, y, z); booms.push({ m, t: 0, big });
    emit(x, y, z, '#ff8a2a', big ? 60 : 25, big ? 60 : 30, 1.2);
    emit(x, y, z, '#555555', big ? 50 : 20, big ? 40 : 20, 3, 4);
  };
  // missiles
  const missiles = new Map();
  const mkMissile = () => { const grp = new THREE.Group(); add(new THREE.CylinderGeometry(0.35, 0.35, 4, 8), M('#e8e8e8'), 0, 0, 0, grp).rotation.z = Math.PI / 2; add(new THREE.ConeGeometry(0.6, 1.6, 8), Glow('#ffd27a', 1), -2.6, 0, 0, grp).rotation.z = Math.PI / 2; scene.add(grp); return grp; };

  /* état reçu et avion prédit localement */
  let prev = null, cur = null, prevAt = 0, curAt = 0, seen = 0;
  const me = { x: 0, y: 1000, z: 0, h: 0, p: 0, r: 0, v: 230, ok: false };
  const msgs = [], feed = [];
  let flash = 0, shake = 0, hitMark = 0, bigMsg = '', bigAt = 0, bigCol = '#F5B700', lockBeep = 0, alertBeep = 0;
  function push(v) {
    prev = cur || v; prevAt = curAt || performance.now(); cur = v; curAt = performance.now();
    const sp = v.p[mySeat];
    if (sp) {
      if (!me.ok || !sp.al || Math.hypot(sp.x - me.x, sp.y - me.y, sp.z - me.z) > 150) Object.assign(me, { x: sp.x, y: sp.y, z: sp.z, h: sp.h, p: sp.pi, r: sp.r, v: sp.v, ok: sp.al });
      me.tx = sp.x; me.ty = sp.y; me.tz = sp.z; me.th = sp.h; me.tp = sp.pi; me.tv = sp.v;
    }
    for (const e of v.ev) {
      if (e.id <= seen) continue;
      seen = e.id;
      if (e.k === 'hit') {
        if (e.i === mySeat) { flash = 0.5; shake = e.how === 'missile' ? 1.2 : 0.35; sfx(e.how === 'missile' ? 70 : 180, 0.12, 'square', 0.06, -40); }
        if (e.s === mySeat) { hitMark = 0.25; sfx(1200, 0.04, 'square', 0.03); }
        emit(e.x, e.y, e.z, '#ffd27a', 8, 25, 0.4);
      } else if (e.k === 'kill') {
        fireball(e.x, e.y, e.z, true);
        const kn = e.by >= 0 ? v.p[e.by].n : null, vn = v.p[e.vic].n;
        feed.push({ t: e.how === 'sol' && !kn ? `${vn} s'est écrasé` : `${kn || '?'} ➜ ${vn}${e.how === 'missile' ? ' (missile)' : e.how === 'sol' ? ' (au sol)' : ''}`, at: performance.now(), mine: e.by === mySeat || e.vic === mySeat });
        if (e.by === mySeat && e.vic !== mySeat) { bigMsg = 'ENNEMI ABATTU'; bigCol = '#7FD48A'; bigAt = performance.now(); [660, 880, 1100].forEach((f, k) => setTimeout(() => sfx(f, 0.12, 'square', 0.05), k * 90)); }
        if (e.vic === mySeat) { bigMsg = e.by >= 0 && e.by !== mySeat ? `ABATTU PAR ${v.p[e.by].n.toUpperCase()}` : 'CRASH'; bigCol = '#ff5a5a'; bigAt = performance.now(); shake = 1.5; sfx(60, 0.8, 'sawtooth', 0.09, -20); }
      } else if (e.k === 'boom') fireball(e.x, e.y, e.z, false);
      else if (e.k === 'missile') { if (e.i === mySeat) sfx(300, 0.4, 'sawtooth', 0.05, 500); if (e.t === mySeat) { msgs.push({ t: 'MISSILE TIRÉ SUR TOI : LEURRES (L) OU VIRE SEC !', at: performance.now() }); } }
      else if (e.k === 'flare') { for (let k = 0; k < 8; k++) emit(e.x, e.y, e.z, '#fff6c8', 1, 30, 2.5, -12, (Math.random() - 0.5) * 60, -10, (Math.random() - 0.5) * 60); if (e.i === mySeat) sfx(500, 0.15, 'triangle', 0.04, -300); }
    }
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  const angLerp = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
  const fwdV = (h, p) => [Math.cos(p) * Math.cos(h), Math.sin(p), Math.cos(p) * Math.sin(h)];

  // le même pilotage que le serveur, pour que mon avion réponde tout de suite
  function predict(dt) {
    if (!me.ok || cur.phase === 'over') return;
    const m = cur.phase === 'count' ? 0 : mask;
    let turn = (m & 2 ? 1 : 0) - (m & 1 ? 1 : 0), climb = (m & 4 ? 1 : 0) - (m & 8 ? 1 : 0);
    if (Math.hypot(me.x, me.z) > cur.arena) turn = Math.atan2(Math.sin(Math.atan2(-me.z, -me.x) - me.h), Math.cos(Math.atan2(-me.z, -me.x) - me.h)) > 0 ? 1 : -1;
    if (me.y > cur.ceil) climb = -1;
    me.h += turn * 1.25 * dt * (0.75 + 0.25 * 230 / Math.max(120, me.v));
    me.p = Math.max(-1.25, Math.min(1.25, me.p + climb * 1.0 * dt)); if (!climb) me.p *= Math.pow(0.985, dt * 30);
    me.r += (turn * 1.05 - me.r) * Math.min(1, 5 * dt);
    const target = m & 64 ? 360 : m & 128 ? 150 : 230;
    me.v += Math.max(-90 * dt, Math.min(70 * dt, target - me.v)) - Math.sin(me.p) * 55 * dt; me.v = Math.max(120, Math.min(420, me.v));
    const [fx, fy, fz] = fwdV(me.h, me.p);
    me.x += fx * me.v * dt; me.y += fy * me.v * dt; me.z += fz * me.v * dt;
    // recalage doux sur le serveur (qui a reçu nos touches un peu plus tard)
    const k = Math.min(1, dt * 3);
    me.x = lerp(me.x, me.tx + fx * me.v * 0.05, k); me.y = lerp(me.y, me.ty + fy * me.v * 0.05, k); me.z = lerp(me.z, me.tz + fz * me.v * 0.05, k);
    me.h = angLerp(me.h, me.th, k * 0.5); me.p = lerp(me.p, me.tp, k * 0.5); me.v = lerp(me.v, me.tv, k);
  }
  function stateOf(i) {
    const p = cur.p[i];
    if (i === mySeat && p.al && me.ok) return { ...p, x: me.x, y: me.y, z: me.z, h: me.h, pi: me.p, r: me.r, v: me.v };
    const q = (prev && prev.p[i]) || p;
    if (!q.al || !p.al) return p;
    const t = Math.min(1.3, (performance.now() - curAt) / Math.max(25, curAt - prevAt));
    return { ...p, x: lerp(q.x, p.x, t), y: lerp(q.y, p.y, t), z: lerp(q.z, p.z, t), h: angLerp(q.h, p.h, t), pi: lerp(q.pi, p.pi, t), r: lerp(q.r, p.r, t) };
  }

  /* HUD */
  const v3 = new THREE.Vector3();
  const project = (x, y, z) => { v3.set(x, y, z).project(cam); return [(v3.x + 1) / 2 * W, (1 - v3.y) / 2 * H, v3.z < 1]; };
  const green = '#7dffa0';
  function drawHud(t, S) {
    g.clearRect(0, 0, W, H);
    const now = performance.now(), sp = cur.p[mySeat];
    if (camMode === '1re' && sp && sp.al) {
      // armature de verrière
      g.strokeStyle = 'rgba(20,24,28,.9)'; g.lineWidth = 18;
      g.beginPath(); g.moveTo(-20, H * 0.15); g.quadraticCurveTo(W * 0.15, -10, W / 2 - 40, -20); g.moveTo(W + 20, H * 0.15); g.quadraticCurveTo(W * 0.85, -10, W / 2 + 40, -20); g.stroke();
      g.fillStyle = 'rgba(20,24,28,.92)'; g.fillRect(0, H - 50, W, 50);
      // échelle d'assiette et cap
      g.save(); g.translate(W / 2, H / 2); g.rotate(-S.r * 0.9); g.strokeStyle = green; g.fillStyle = green; g.lineWidth = 1.5; g.font = '700 10px Archivo, sans-serif'; g.textAlign = 'center';
      for (let a = -60; a <= 60; a += 10) { const y = (S.pi * 180 / Math.PI - a) * 6; if (Math.abs(y) > 200) continue; g.beginPath(); if (a < 0) g.setLineDash([6, 5]); g.moveTo(-120, y); g.lineTo(-50, y); g.moveTo(50, y); g.lineTo(120, y); g.stroke(); g.setLineDash([]); if (a) { g.fillText(a, -136, y + 4); g.fillText(a, 136, y + 4); } }
      g.restore();
      const hd = ((S.h * 180 / Math.PI) % 360 + 450) % 360;
      g.strokeStyle = green; g.fillStyle = green; g.font = '700 10px Archivo, sans-serif'; g.textAlign = 'center';
      for (let d = -40; d <= 40; d += 5) { const v2 = Math.round((hd + d) / 5) * 5, x = W / 2 + (v2 - hd) * 5; g.beginPath(); g.moveTo(x, 30); g.lineTo(x, v2 % 10 ? 36 : 40); g.stroke(); if (!(v2 % 30)) g.fillText(((v2 % 360) + 360) % 360, x, 52); }
    }
    if (sp && sp.al) {
      // viseur du canon : point où passent les obus à 700 m
      const [fx, fy, fz] = fwdV(S.h, S.pi);
      const [gx, gy, ok] = project(S.x + fx * 700, S.y + fy * 700, S.z + fz * 700);
      if (ok) { g.strokeStyle = hitMark > 0 ? '#ff5a5a' : green; g.lineWidth = 2; g.beginPath(); g.arc(gx, gy, 14, 0, Math.PI * 2); g.moveTo(gx - 24, gy); g.lineTo(gx - 16, gy); g.moveTo(gx + 16, gy); g.lineTo(gx + 24, gy); g.moveTo(gx, gy + 16); g.lineTo(gx, gy + 24); g.stroke(); g.fillStyle = g.strokeStyle; g.fillRect(gx - 1.5, gy - 1.5, 3, 3); if (hitMark > 0) { g.font = '900 14px "Big Shoulders Display", Impact'; g.textAlign = 'center'; g.fillText('TOUCHÉ', gx, gy - 28); } }
      // marqueurs des ennemis
      cur.p.forEach((o, i) => {
        if (i === mySeat || !o.al) return;
        const O = stateOf(i), d = Math.hypot(O.x - S.x, O.y - S.y, O.z - S.z);
        let [x, y, on] = project(O.x, O.y, O.z);
        const locked = sp.lk === i, lp = locked ? sp.lp : 0;
        if (!on || x < 20 || x > W - 20 || y < 20 || y > H - 20) {   // flèche au bord de l'écran
          if (!on) { x = W - x; y = H - y; }
          const a = Math.atan2(y - H / 2, x - W / 2), ex = W / 2 + Math.cos(a) * (W / 2 - 40), ey = H / 2 + Math.sin(a) * (H / 2 - 40);
          g.save(); g.translate(Math.max(30, Math.min(W - 30, ex)), Math.max(30, Math.min(H - 30, ey))); g.rotate(a); g.fillStyle = locked ? '#ff5a5a' : '#ffd27a';
          g.beginPath(); g.moveTo(12, 0); g.lineTo(-6, -8); g.lineTo(-6, 8); g.fill(); g.restore();
          return;
        }
        const col = locked && lp >= 1 ? '#ff4a4a' : locked ? '#ffd27a' : green;
        g.strokeStyle = col; g.lineWidth = 2; const s = 12;
        g.strokeRect(x - s, y - s, s * 2, s * 2);
        if (locked) { const r = 40 - 26 * Math.min(1, lp); g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); g.stroke(); }
        g.font = '700 10px Archivo, sans-serif'; g.textAlign = 'left'; g.fillStyle = col;
        g.fillText(o.n.toUpperCase(), x + s + 4, y - 2); g.fillText(`${Math.round(d)} m`, x + s + 4, y + 10);
        if (locked && lp >= 1) { g.font = '900 13px "Big Shoulders Display", Impact'; g.textAlign = 'center'; g.fillText('VERROUILLÉ', x, y - 30); }
      });
      // missiles en vol
      cur.m.forEach(m => { if (m[7] !== mySeat) return; const [x, y, on] = project(m[1], m[2], m[3]); if (on) { g.strokeStyle = '#ff4a4a'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 8, 0, Math.PI * 2); g.stroke(); } });
      // instruments
      const box = (x, y, w, h) => { g.fillStyle = 'rgba(8,12,10,.55)'; g.fillRect(x, y, w, h); g.strokeStyle = green; g.lineWidth = 1; g.strokeRect(x, y, w, h); };
      box(16, H - 118, 150, 100);
      g.font = '400 9px "Press Start 2P", monospace'; g.textAlign = 'left'; g.fillStyle = green;
      g.fillText(`VIT ${Math.round(S.v * 3.6)} km/h`, 26, H - 98); g.fillText(`ALT ${Math.round(S.y)} m`, 26, H - 80);
      g.fillText('BLINDAGE', 26, H - 60); g.fillStyle = '#222'; g.fillRect(26, H - 54, 128, 8); g.fillStyle = sp.hp > 50 ? green : sp.hp > 25 ? '#F5B700' : '#ff4a4a'; g.fillRect(26, H - 54, 128 * sp.hp / 100, 8);
      g.fillStyle = mask & 64 ? '#ffb347' : 'rgba(125,255,160,.5)'; g.fillText(mask & 64 ? 'POSTCOMB.' : mask & 128 ? 'FREINS' : 'CROISIÈRE', 26, H - 30);
      box(W - 166, H - 118, 150, 100);
      g.fillStyle = green; g.fillText('MISSILES', W - 156, H - 98);
      sp.mr.forEach((r, k) => { const x = W - 150 + k * 40, y = H - 86; g.strokeStyle = green; g.strokeRect(x, y, 30, 12); g.fillStyle = r >= 1 ? green : 'rgba(125,255,160,.35)'; g.fillRect(x, y, 30 * r, 12); });
      g.fillStyle = green; g.fillText(`LEURRES ×${sp.fl}`, W - 156, H - 52);
      g.fillText(sp.lk >= 0 ? (sp.lp >= 1 ? 'K : TIRER !' : 'ACCROCHAGE…') : 'CHERCHE CIBLE', W - 156, H - 32);
      // radar (cap en haut)
      const rx = W / 2, ry = H - 74, rr = 58;
      g.fillStyle = 'rgba(8,12,10,.6)'; g.beginPath(); g.arc(rx, ry, rr, 0, Math.PI * 2); g.fill(); g.strokeStyle = green; g.lineWidth = 1; g.stroke();
      g.beginPath(); g.arc(rx, ry, rr / 2, 0, Math.PI * 2); g.stroke();
      const sweep = t * 2.5; g.strokeStyle = 'rgba(125,255,160,.35)'; g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx + Math.cos(sweep) * rr, ry + Math.sin(sweep) * rr); g.stroke();
      const RS = rr / 3000;
      const rad = (x, z) => { const dx = x - S.x, dz = z - S.z, a = Math.atan2(dz, dx) - S.h - Math.PI / 2, d = Math.min(rr - 3, Math.hypot(dx, dz) * RS); return [rx + Math.cos(a) * d, ry + Math.sin(a) * d]; };
      cur.p.forEach((o, i) => { if (i === mySeat || !o.al) return; const O = stateOf(i), [x, y] = rad(O.x, O.z); g.fillStyle = sp.lk === i ? '#ff4a4a' : '#ffd27a'; g.fillRect(x - 3, y - 3, 6, 6); });
      cur.m.forEach(m => { const [x, y] = rad(m[1], m[3]); g.fillStyle = m[7] === mySeat ? '#ff4a4a' : '#fff'; g.beginPath(); g.arc(x, y, 2, 0, Math.PI * 2); g.fill(); });
      const [bx, by] = rad(0, 0); g.strokeStyle = 'rgba(125,255,160,.5)'; g.beginPath(); g.arc(bx, by, Math.min(rr * 3, 4200 * RS), 0, Math.PI * 2); g.stroke();
      g.fillStyle = green; g.beginPath(); g.moveTo(rx, ry - 6); g.lineTo(rx + 4, ry + 4); g.lineTo(rx - 4, ry + 4); g.fill();
      // alertes
      if (sp.inc && Math.sin(t * 14) > 0) { g.font = '900 34px "Big Shoulders Display", Impact'; g.textAlign = 'center'; g.fillStyle = '#ff3a3a'; g.fillText('⚠ MISSILE ⚠', W / 2, 110); }
      if (S.y < 260 && S.pi < 0 && Math.sin(t * 10) > 0) { g.font = '900 30px "Big Shoulders Display", Impact'; g.textAlign = 'center'; g.fillStyle = '#ff3a3a'; g.fillText('REMONTE !', W / 2, H / 2 + 80); }
      if (sp.oob) { g.font = '900 22px "Big Shoulders Display", Impact'; g.textAlign = 'center'; g.fillStyle = '#ffb347'; g.fillText('SORTIE DE ZONE : DEMI-TOUR', W / 2, 150); }
      if (sp.sh) { g.font = '700 11px Archivo, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#7fd4ff'; g.fillText('PROTÉGÉ (APPARITION)', W / 2, H / 2 + 50); }
    } else if (sp && !sp.al) {
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, W, H);
      g.font = '400 14px "Press Start 2P", monospace'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(`RETOUR EN VOL DANS ${sp.rs}`, W / 2, H / 2 + 60);
    }
    // score et temps
    const rank = cur.p.map((p, i) => ({ ...p, i })).sort((a, b) => b.k - a.k || a.d - b.d).slice(0, 4);
    g.fillStyle = 'rgba(8,9,11,.7)'; g.fillRect(W - 200, 10, 186, 22 + rank.length * 16);
    g.font = '400 9px "Press Start 2P", monospace'; g.textAlign = 'left'; g.fillStyle = '#F5B700';
    const tl = cur.time; g.fillText(`${Math.floor(tl / 60)}:${String(tl % 60).padStart(2, '0')} · ${cur.killsToWin} POUR GAGNER`, W - 192, 26);
    rank.forEach((p, k) => { g.font = '700 11px Archivo, sans-serif'; g.fillStyle = p.i === mySeat ? '#F5B700' : '#fff'; g.fillText(`${k + 1}. ${p.n}`, W - 192, 44 + k * 16); g.textAlign = 'right'; g.fillText(`${p.k}`, W - 22, 44 + k * 16); g.textAlign = 'left'; });
    feed.splice(0, Math.max(0, feed.length - 5));
    feed.filter(f => now - f.at < 6000).forEach((f, k) => { g.font = '700 11px Archivo, sans-serif'; g.textAlign = 'left'; const w = g.measureText(f.t).width + 12; g.fillStyle = f.mine ? 'rgba(245,183,0,.85)' : 'rgba(8,9,11,.7)'; g.fillRect(14, 14 + k * 20, w, 18); g.fillStyle = f.mine ? '#1a1612' : '#fff'; g.fillText(f.t, 20, 27 + k * 20); });
    msgs.splice(0, Math.max(0, msgs.length - 2));
    msgs.filter(m => now - m.at < 3000).forEach((m, k) => { g.font = '800 12px Archivo, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#ff8a8a'; g.fillText(m.t, W / 2, 180 + k * 18); });
    if (bigMsg && now - bigAt < 2200) bigText(g, bigMsg, W / 2, H / 2 - 70, 40, bigCol);
    if (cur.phase === 'count') bigText(g, String(Math.ceil(cur.countdown)), W / 2, H / 2, 90, '#F5B700');
    if (flash > 0) { g.fillStyle = `rgba(255,40,30,${flash * 0.5})`; g.fillRect(0, 0, W, H); }
  }

  /* boucle */
  let lastW = 0, lastH = 0, lastT = 0;
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tmpV = new THREE.Vector3();
  const qFix = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
  const stop = loop((dt, tms) => {
    if (!cur) return;
    const t = tms / 1000, now = performance.now();
    if (now - lastAt > 120) { lastSent = -1; flush(); }
    const cw = hud.clientWidth, ch = hud.clientHeight;
    if (cw && (cw !== lastW || ch !== lastH)) { lastW = cw; lastH = ch; renderer.setSize(cw, ch, false); canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px'; cam.aspect = cw / ch; cam.updateProjectionMatrix(); }
    predict(dt);
    flash = Math.max(0, flash - dt); hitMark = Math.max(0, hitMark - dt); shake = Math.max(0, shake - dt * 1.5);
    // avions
    cur.p.forEach((p, i) => {
      if (!planes[i]) planes[i] = mkPlane(p.c);
      const o = planes[i], S = stateOf(i);
      o.visible = p.al && !(i === mySeat && camMode === '1re');
      if (!p.al) return;
      o.position.set(S.x, S.y, S.z);
      const b = o.userData.body; b.rotation.set(S.r * 0.9, -S.h, S.pi);
      o.userData.ab.visible = S.v > 290; o.userData.ab.scale.set(1, 0.7 + Math.random() * 0.6, 1);
      const [fx, fy, fz] = fwdV(S.h, S.pi);
      // traînées de condensation en virage serré, fumée quand l'avion est touché
      if (Math.abs(S.r) > 0.8 && Math.random() < 0.6) { const rx = -Math.sin(S.h) * 9, rz = Math.cos(S.h) * 9; emit(S.x + rx, S.y, S.z + rz, '#ffffff', 1, 1, 0.7); emit(S.x - rx, S.y, S.z - rz, '#ffffff', 1, 1, 0.7); }
      if (p.hp < 40 && Math.random() < 0.5) emit(S.x - fx * 10, S.y, S.z - fz * 10, p.hp < 20 ? '#ff8a2a' : '#666666', 1, 3, 1.6, 2);
      if (p.f && Math.random() < 0.8) {      // rafale : traçantes depuis le nez
        const tt = tr[ti = (ti + 1) % NT], bv = 900 + S.v;
        Object.assign(tt, { x: S.x + fx * 12, y: S.y + fy * 12, z: S.z + fz * 12, vx: fx * bv, vy: fy * bv, vz: fz * bv, life: 1.1 });
        if (i === mySeat && Math.random() < 0.5) sfx(140 + Math.random() * 40, 0.03, 'square', 0.02);
      }
    });
    // traçantes
    for (let i = 0; i < NT; i++) {
      const q = tr[i];
      if (q.life <= 0) { tPos.fill(0, i * 6, i * 6 + 6); tPos[i * 6 + 1] = tPos[i * 6 + 4] = -9999; continue; }
      q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      tPos.set([q.x, q.y, q.z, q.x - q.vx * 0.025, q.y - q.vy * 0.025, q.z - q.vz * 0.025], i * 6);
    }
    tGeo.attributes.position.needsUpdate = true;
    // missiles (interpolés) et leur fumée
    const ids = new Set(cur.m.map(m => m[0]));
    for (const [id, o] of missiles) if (!ids.has(id)) { scene.remove(o); missiles.delete(id); }
    const pm = new Map((prev ? prev.m : []).map(m => [m[0], m]));
    const mt = Math.min(1.3, (now - curAt) / Math.max(25, curAt - prevAt));
    cur.m.forEach(m => {
      let o = missiles.get(m[0]); if (!o) { o = mkMissile(); missiles.set(m[0], o); }
      const q = pm.get(m[0]) || m;
      o.position.set(lerp(q[1], m[1], mt), lerp(q[2], m[2], mt), lerp(q[3], m[3], mt));
      o.rotation.set(0, -m[4], m[5], 'YZX');
      emit(o.position.x, o.position.y, o.position.z, '#dddddd', 2, 2, 2.2, 1);
    });
    if (cur.p[mySeat] && cur.p[mySeat].inc && now - alertBeep > 260) { alertBeep = now; sfx(1300, 0.08, 'square', 0.04); }
    const spm = cur.p[mySeat];
    if (spm && spm.al && spm.lk >= 0 && now - lockBeep > (spm.lp >= 1 ? 90 : 300)) { lockBeep = now; sfx(spm.lp >= 1 ? 1700 : 1000, 0.05, 'sine', 0.025); }
    // fumée des cheminées
    if (Math.random() < 0.5) { const c = chimneys[Math.floor(Math.random() * chimneys.length)]; emit(c[0], c[1], c[2], '#8a8a8a', 1, 6, 6, 8); }
    // boules de feu
    for (let k = booms.length - 1; k >= 0; k--) { const b = booms[k]; b.t += dt; const s = (b.big ? 40 : 22) * Math.min(1, b.t * 4); b.m.scale.setScalar(s); b.m.material.opacity = Math.max(0, 1 - b.t * 1.2); if (b.t > 1) { scene.remove(b.m); b.m.geometry.dispose(); b.m.material.dispose(); booms.splice(k, 1); } }
    // particules
    for (let i = 0; i < NP; i++) {
      const q = pv[i]; if (q.life <= 0) { pPos[i * 3 + 1] = -9999; continue; }
      q.life -= dt; q.vy += q.g * dt;
      pPos[i * 3] += q.vx * dt; pPos[i * 3 + 1] += q.vy * dt; pPos[i * 3 + 2] += q.vz * dt;
    }
    pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
    // caméra
    const sp = cur.p[mySeat], S = stateOf(mySeat);
    if (sp) {
      const [fx, fy, fz] = fwdV(S.h, S.pi);
      if (camMode === '1re' && sp.al) {
        planes[mySeat].userData.body.updateMatrixWorld();
        cam.position.set(S.x + fx * 5, S.y + 1.6, S.z + fz * 5);
        planes[mySeat].userData.body.getWorldQuaternion(cam.quaternion); cam.quaternion.multiply(qFix);
        cam.fov = 72;
      } else {
        const back = sp.al ? 46 : 160, up = sp.al ? 11 : 60;
        tmpV.set(S.x - Math.cos(S.h) * back, S.y + up - fy * back * 0.6, S.z - Math.sin(S.h) * back);
        camPos.lerp(tmpV, sp.al ? Math.min(1, dt * 9) : Math.min(1, dt * 2));
        camLook.lerp(tmpV.set(S.x + fx * 80, S.y + fy * 80 + 4, S.z + fz * 80), Math.min(1, dt * 12));
        cam.position.copy(camPos); cam.up.set(Math.sin(S.r * 0.4) * Math.sin(S.h) * -1, 1, Math.sin(S.r * 0.4) * Math.cos(S.h)).normalize(); cam.lookAt(camLook);
        cam.fov = 65 + Math.max(0, S.v - 250) * 0.06;
      }
      if (shake > 0) { cam.position.x += (Math.random() - 0.5) * shake * 3; cam.position.y += (Math.random() - 0.5) * shake * 3; }
      cam.updateProjectionMatrix();
      const r = Math.hypot(S.x, S.z); fence.material.opacity = Math.max(0, Math.min(0.5, (r - 3400) / 1600));
    }
    renderer.render(scene, cam);
    drawHud(t, S);
  });

  return {
    push,
    stop() {
      stop();
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur);
      renderer.dispose();
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; ms.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); });
    },
  };
}
