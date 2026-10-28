/* Forgeopoly en relief : plateau 3D (three.js) branché sur l'affichage de forgeo.js.
   Plateau épais, bandes de couleur en relief, ateliers et usines en volume, pions sculptés qui sautent
   de case en case, dés qui roulent, ombres. Glisser pour tourner autour, molette pour zoomer, V pour la vue 2D. */
'use strict';

const fg3dWanted = () => save.fgView !== '2d';

function fg3dToggle() {
  if (!fg) return;
  save.fgView = fg3dWanted() ? '2d' : '3d'; persist();
  fxWarp(fg.root.querySelector('#fgoBoard'), 'switch');
  if (fg3dWanted()) fg3dStart(); else fg3dStop();
  toast(fg3dWanted() ? 'Plateau en relief 3D' : 'Plateau 2D');
}

function fg3dStart() {
  if (!fg || fg.three) return;
  const host = fg;
  loadThree().then(() => {
    if (fg !== host || !fg.root.isConnected || fg.three || !fg3dWanted()) return;
    fg.three = fg3dCreate(fg.root.querySelector('#fgoBoard'), fg.view);
    fg.root.classList.add('fg3d');
    // les boutons passent dans la colonne de droite pour laisser tout le plateau visible
    fg.root.querySelector('#fgoView').after(fg.root.querySelector('#fgoActions'));
    fgPaint(); fgPlaceTokens(true); fg.three.dice(fg.view.dice, false);
  }).catch(e => toast(e.message));
}
function fg3dStop() {
  if (!fg) return;
  fg.root.classList.remove('fg3d');
  fg.root.querySelector('.fgo-center').appendChild(fg.root.querySelector('#fgoActions'));
  if (fg.three) { fg.three.dispose(); fg.three = null; }
  fgPlaceTokens(true);
}

window.addEventListener('keydown', e => {
  const act = document.activeElement;
  if (e.code !== 'KeyV' || e.repeat || !fg || !fg.root.isConnected || (act && /INPUT|TEXTAREA/.test(act.tagName) && act.isConnected && act.offsetParent)) return;
  e.preventDefault(); fg3dToggle();
});

function fg3dCreate(boardEl, v0) {
  const S = 1210, C = 155, U = 100, T = 36;            // plateau : 1,55 + 9 + 1,55 cases, comme en 2D
  const TOP = T / 2;
  const coord = k => (k === 1 ? C / 2 : k === 11 ? S - C / 2 : C + (k - 2) * U + U / 2) - S / 2;
  const cellXZ = i => { const [r, c] = fgCellPos(i); return [coord(c), coord(r)]; };
  const cellWH = i => { const [r, c] = fgCellPos(i); return [c === 1 || c === 11 ? C : U, r === 1 || r === 11 ? C : U]; };
  const sideOf = i => (i < 10 ? 'b' : i < 20 ? 'l' : i < 30 ? 't' : 'r');
  // direction vers le centre du plateau (où se trouve la bande de couleur)
  const inward = { b: [0, -1], l: [1, 0], t: [0, 1], r: [-1, 0] };
  const board = v0.board;

  /* ---------- rendu ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement; canvas.className = 'fgo-3d';
  boardEl.prepend(canvas);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(38, 1, 10, 8000);
  scene.add(new THREE.HemisphereLight('#fff2e0', '#2a160c', 0.75));
  const sun = new THREE.DirectionalLight('#ffe6c8', 0.9);
  sun.position.set(-500, 1400, 700); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -760, right: 760, top: 760, bottom: -760, near: 100, far: 3200 });
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  const glow = new THREE.PointLight('#ff7a2a', 0.8, 1400, 1.6); glow.position.set(0, 260, 0); scene.add(glow);
  const M = (color, extra) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, ...(extra || {}) }); m.color.convertSRGBToLinear(); if (m.emissive) m.emissive.convertSRGBToLinear(); return m; };

  /* ---------- dessus du plateau, peint comme la version 2D ---------- */
  const PX = 2048 / S;
  const top = tkTexture(2048, 2048, (g) => {
    g.scale(PX, PX); g.translate(S / 2, S / 2);
    g.fillStyle = '#0a0c0e'; g.fillRect(-S / 2, -S / 2, S, S);
    // centre
    const cg = g.createRadialGradient(0, -60, 20, 0, 0, 520);
    cg.addColorStop(0, '#3a2414'); cg.addColorStop(1, '#120c08');
    g.fillStyle = cg; g.fillRect(-S / 2 + C + 2, -S / 2 + C + 2, S - 2 * C - 4, S - 2 * C - 4);
    g.save(); g.rotate(-0.14);
    g.font = '900 118px "Big Shoulders Display", Impact'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(236,100,30,.7)'; g.shadowBlur = 30; g.fillStyle = '#EC641E'; g.fillText('FORGEOPOLY', 0, -150);
    g.shadowBlur = 0; g.font = '700 26px Archivo, sans-serif'; g.fillStyle = 'rgba(255,255,255,.5)'; g.fillText('ESFF · PROMOTION 101', 0, -78);
    g.restore();
    const deck = (x, y, rot, col, l1, l2, ico) => {
      g.save(); g.translate(x, y); g.rotate(rot);
      g.fillStyle = col; g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 4;
      g.beginPath(); g.roundRect(-95, -60, 190, 120, 12); g.fill(); g.stroke();
      g.fillStyle = '#fff'; g.font = '900 24px "Big Shoulders Display", Impact'; g.textAlign = 'center';
      g.fillText(l1, 0, -18); g.fillText(l2, 0, 10); g.font = '40px serif'; g.fillText(ico, 0, 52);
      g.restore();
    };
    deck(-170, 130, -0.6, '#c4361a', 'COULÉE', 'SURPRISE', '?');
    deck(170, 130, 0.6, '#2b4fa8', 'CAISSE DE', 'LA PROMO', '🎁');
    // cases
    board.forEach((sq, i) => {
      const [x, z] = cellXZ(i), [w, h] = cellWH(i), side = sideOf(i), corner = i % 10 === 0;
      g.fillStyle = corner ? '#e2d2b4' : '#efe7d8';
      g.fillRect(x - w / 2 + 1, z - h / 2 + 1, w - 2, h - 2);
      g.save(); g.translate(x, z);
      // le texte se lit depuis le bord extérieur ; les coins sont en diagonale
      g.rotate(corner ? { 0: -Math.PI / 4, 10: Math.PI / 4, 20: Math.PI * 3 / 4, 30: -Math.PI * 3 / 4 }[i] : { b: 0, l: Math.PI / 2, t: Math.PI, r: -Math.PI / 2 }[side]);
      const lw = corner ? C : U, lh = C;          // largeur le long du bord, profondeur vers le centre
      g.fillStyle = '#1a1612'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const icon = { go: '➜', jail: '🔧', free: '☕', gojail: '👮', chance: '?', cc: '🎁', tax: '💸', station: '🚌', utility: sq.name.includes('gaz') ? '🔥' : '⚡' }[sq.type] || '';
      if (sq.color) { g.fillStyle = sq.color; g.fillRect(-lw / 2 + 1, -lh / 2 + 1, lw - 2, lh * 0.22); g.fillStyle = '#1a1612'; }
      // nom sur plusieurs lignes
      const words = sq.name.toUpperCase().split(' ');
      const lines = []; let cur = '';
      g.font = `800 ${corner ? 17 : 14}px Archivo, sans-serif`;
      for (const wd of words) { const t = cur ? cur + ' ' + wd : wd; if (g.measureText(t).width > lw - 14 && cur) { lines.push(cur); cur = wd; } else cur = t; }
      if (cur) lines.push(cur);
      const y0 = corner ? 18 : sq.color ? -lh * 0.12 : -lh * 0.2;
      lines.slice(0, 3).forEach((l, k) => g.fillText(l, 0, y0 + k * 17));
      if (icon) { g.font = `${corner ? 54 : 38}px serif`; g.fillText(icon, 0, corner ? -26 : sq.color ? 22 : 14); }
      if (sq.price) { g.font = '700 14px Archivo, sans-serif'; g.fillStyle = '#5a4a3a'; g.fillText(`${sq.price} ₤`, 0, lh / 2 - 16); }
      g.restore();
    });
  });
  top.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const edge = M('#2a1d14', { roughness: 0.8 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(S, T, S), [edge, edge, new THREE.MeshStandardMaterial({ map: top, roughness: 0.85 }), edge, edge, edge]);
  slab.receiveShadow = true; scene.add(slab);
  // cadre en acier et socle
  const frameM = M('#4a4e54', { metalness: 0.7, roughness: 0.35 });
  [[0, -S / 2 - 12, S + 48, 24], [0, S / 2 + 12, S + 48, 24], [-S / 2 - 12, 0, 24, S], [S / 2 + 12, 0, 24, S]].forEach(([x, z, w, d]) => {
    const f = new THREE.Mesh(new THREE.BoxGeometry(w, T + 10, d), frameM); f.position.set(x, 5, z); f.castShadow = f.receiveShadow = true; scene.add(f);
  });
  const table = new THREE.Mesh(new THREE.CylinderGeometry(1500, 1500, 20, 64), M('#1a120d', { roughness: 0.9 }));
  table.position.y = -TOP - 10; table.receiveShadow = true; scene.add(table);

  // bandes de couleur en relief
  board.forEach((sq, i) => {
    if (!sq.color) return;
    const [x, z] = cellXZ(i), side = sideOf(i), [ix, iz] = inward[side];
    const along = side === 'b' || side === 't';
    const depth = C * 0.22;
    const b = new THREE.Mesh(new THREE.BoxGeometry(along ? U - 4 : depth, 8, along ? depth : U - 4), M(sq.color, { roughness: 0.45 }));
    b.position.set(x + ix * (C / 2 - depth / 2), TOP + 4, z + iz * (C / 2 - depth / 2));
    b.castShadow = b.receiveShadow = true; scene.add(b);
  });

  /* ---------- ateliers, usines, propriétaires, hypothèques ---------- */
  const houseM = M('#2E9E5B'), roofM = M('#1f6b3e'), hotelM = M('#BA2C3A'), hotelRoof = M('#7a1c26'), chimM = M('#3a3d42', { metalness: 0.5 });
  const mkHouse = hotel => {
    const g = new THREE.Group();
    const w = hotel ? 46 : 18, d = hotel ? 22 : 18, h = hotel ? 22 : 13;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hotel ? hotelM : houseM); body.position.y = h / 2;
    // toit en sheds (dents de scie) comme une halle d'usine
    const teeth = hotel ? 3 : 1;
    for (let k = 0; k < teeth; k++) {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(w / teeth / 1.6, w / teeth / 1.6, d, 3), hotel ? hotelRoof : roofM);
      r.rotation.x = Math.PI / 2; r.rotation.z = Math.PI / 2;
      r.position.set(-w / 2 + w / teeth * (k + 0.5), h + 4, 0); g.add(r);
    }
    const ch = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.2, hotel ? 30 : 12, 8), chimM); ch.position.set(w / 2 - 6, h + (hotel ? 15 : 6), d / 4); g.add(ch);
    g.add(body);
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  };
  const cellObjs = board.map(() => ({ houses: null, n: -1, own: null, ownC: null, mort: null }));
  const placeHouses = (i, n, pop) => {
    const st = cellObjs[i];
    if (st.n === n) return;
    if (st.houses) scene.remove(st.houses);
    st.n = n; st.houses = null;
    if (!n) return;
    const grp = new THREE.Group();
    const [x, z] = cellXZ(i), side = sideOf(i), [ix, iz] = inward[side];
    const along = side === 'b' || side === 't';
    const cx = x + ix * (C / 2 - C * 0.11), cz = z + iz * (C / 2 - C * 0.11);
    const items = n === 5 ? [0] : [...Array(n).keys()];
    items.forEach(k => {
      const h = mkHouse(n === 5);
      const off = n === 5 ? 0 : (k - (n - 1) / 2) * 22;
      h.position.set(cx + (along ? off : 0), TOP + 8, cz + (along ? 0 : off));
      h.rotation.y = along ? 0 : Math.PI / 2;
      if (pop && k === items.length - 1) { h.scale.setScalar(0.01); h.userData.pop = 0; }
      grp.add(h);
    });
    scene.add(grp); st.houses = grp;
  };
  const ingotGeo = new THREE.BoxGeometry(34, 7, 14);
  const setOwner = (i, color, pop) => {
    const st = cellObjs[i];
    if (st.ownC === color) return;
    if (st.own) { scene.remove(st.own); st.own = null; }
    st.ownC = color;
    if (!color) return;
    const [x, z] = cellXZ(i), side = sideOf(i), [ix, iz] = inward[side];
    const m = new THREE.Mesh(ingotGeo, M(color, { metalness: 0.75, roughness: 0.3, emissive: color, emissiveIntensity: 0.15 }));
    m.position.set(x - ix * (C / 2 - 14), TOP + 3.5, z - iz * (C / 2 - 14));
    m.rotation.y = side === 'b' || side === 't' ? 0 : Math.PI / 2;
    m.castShadow = true;
    if (pop) m.userData.pop = 0;
    scene.add(m); st.own = m;
  };
  const mortGeo = new THREE.PlaneGeometry(1, 1), mortM = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.45, depthWrite: false });
  const setMortgage = (i, on) => {
    const st = cellObjs[i];
    if (!!st.mort === !!on) return;
    if (st.mort) { scene.remove(st.mort); st.mort = null; return; }
    const [x, z] = cellXZ(i), [w, h] = cellWH(i);
    const m = new THREE.Mesh(mortGeo, mortM); m.rotation.x = -Math.PI / 2; m.scale.set(w - 4, h - 4, 1); m.position.set(x, TOP + 0.6, z);
    scene.add(m); st.mort = m;
  };
  const selM = new THREE.MeshBasicMaterial({ color: '#F5B700', transparent: true, opacity: 0.5, depthWrite: false });
  const sel = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.5, 4, 1, Math.PI / 4), selM);
  sel.rotation.x = -Math.PI / 2; sel.visible = false; scene.add(sel);
  const hoverM = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.12, depthWrite: false });
  const hover = new THREE.Mesh(mortGeo, hoverM); hover.rotation.x = -Math.PI / 2; hover.visible = false; scene.add(hover);

  /* ---------- pions sculptés ---------- */
  const tokenModel = (kind, color) => {
    const g = new THREE.Group();
    const mat = M(color, { metalness: 0.8, roughness: 0.25 });
    const dark = M(shade(color, -0.4), { metalness: 0.7, roughness: 0.35 });
    const lava = new THREE.MeshBasicMaterial({ color: '#ffb347' });
    const add = (geo, m, x, y, z, rx = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.x = rx; o.rotation.z = rz; o.castShadow = true; g.add(o); return o; };
    add(new THREE.CylinderGeometry(15, 17, 6, 24), dark, 0, 3, 0);                     // socle
    if (kind === 'louche') {
      add(new THREE.CylinderGeometry(2.4, 2.4, 44, 8), mat, -6, 30, 0, 0, 0.5);
      add(new THREE.SphereGeometry(11, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat, 6, 16, 0);
      const l = add(new THREE.CircleGeometry(9.5, 16), lava, 6, 15.5, 0, -Math.PI / 2);
    } else if (kind === 'marteau') {
      add(new THREE.CylinderGeometry(2.6, 2.6, 40, 8), dark, 0, 24, 0);
      add(new THREE.BoxGeometry(28, 12, 12), mat, 0, 46, 0);
    } else if (kind === 'creuset') {
      add(new THREE.CylinderGeometry(13, 8, 26, 18), mat, 0, 19, 0);
      add(new THREE.CircleGeometry(11.5, 18), lava, 0, 32.2, 0, -Math.PI / 2);
      add(new THREE.TorusGeometry(13, 1.6, 6, 18), dark, 0, 32, 0, Math.PI / 2);
    } else {   // enclume
      add(new THREE.BoxGeometry(18, 8, 14), dark, 0, 10, 0);
      add(new THREE.BoxGeometry(10, 10, 9), mat, 0, 19, 0);
      add(new THREE.BoxGeometry(26, 8, 14), mat, 2, 28, 0);
      add(new THREE.ConeGeometry(6, 16, 10), mat, -18, 28, 0, 0, Math.PI / 2);
    }
    return g;
  };
  const OFF = [[-0.2, -0.16], [0.2, -0.16], [-0.2, 0.18], [0.2, 0.18]];
  const tokens = v0.players.map((p, s) => {
    const m = tokenModel(p.token, p.color);
    scene.add(m);
    return { m, from: null, to: null, t0: 0, dur: 0, arc: 0 };
  });
  const ringM = new THREE.MeshBasicMaterial({ color: '#F5B700', transparent: true, opacity: 0.8, side: THREE.DoubleSide });
  const curRing = new THREE.Mesh(new THREE.RingGeometry(19, 24, 32), ringM); curRing.rotation.x = -Math.PI / 2; scene.add(curRing);
  const tokenSpot = (sq, s) => { const [x, z] = cellXZ(sq), [w, h] = cellWH(sq); return new THREE.Vector3(x + OFF[s % 4][0] * w, TOP, z + OFF[s % 4][1] * h); };

  /* ---------- dés ---------- */
  const pipTex = n => tkTexture(128, 128, (g) => {
    g.fillStyle = '#f4efe6'; g.beginPath(); g.roundRect(0, 0, 128, 128, 18); g.fill();
    g.fillStyle = n === 1 ? '#BA2C3A' : '#1a1612';
    FG_PIPS[n].forEach(k => { const cx = 26 + ((k - 1) % 3) * 38, cy = 26 + Math.floor((k - 1) / 3) * 38; g.beginPath(); g.arc(cx, cy, 11, 0, Math.PI * 2); g.fill(); });
  });
  const FACE_ORDER = [3, 4, 1, 6, 2, 5];   // faces +x, -x, +y, -y, +z, -z
  const dieMats = FACE_ORDER.map(n => new THREE.MeshStandardMaterial({ map: pipTex(n), roughness: 0.4 }));
  const UP = { 1: [0, 0, 0], 6: [Math.PI, 0, 0], 2: [-Math.PI / 2, 0, 0], 5: [Math.PI / 2, 0, 0], 3: [0, 0, Math.PI / 2], 4: [0, 0, -Math.PI / 2] };
  const dice = [0, 1].map(k => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(44, 44, 44), dieMats); m.castShadow = true;
    scene.add(m);
    return { m, start: null, end: null, qs: null, qe: null, t0: 0, spin: new THREE.Vector3() };
  });
  const faceQuat = (n, yaw) => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...UP[n])));
  const setDice = (d, animate) => {
    dice.forEach((D, k) => {
      const end = new THREE.Vector3(k ? 48 : -48, TOP + 22, 150);
      const qe = faceQuat(d[k], (Math.random() - 0.5) * 0.8);
      if (!animate) { D.m.position.copy(end); D.m.quaternion.copy(qe); D.t0 = 0; return; }
      D.start = new THREE.Vector3(-420 + k * 60, 360, 420); D.end = end;
      D.qs = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
      D.qe = qe; D.t0 = performance.now() + k * 60;
      D.spin.set(8 + Math.random() * 6, 6 + Math.random() * 6, 4 + Math.random() * 4);
    });
  };

  /* ---------- caméra : glisser pour tourner, molette pour zoomer ---------- */
  let yaw = 0, pitch = 0.92, dist = 1720, drag = null, moved = 0;
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP), hit = new THREE.Vector3();
  const pick = e => {
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera({ x: (e.clientX - r.left) / r.width * 2 - 1, y: -((e.clientY - r.top) / r.height * 2 - 1) }, cam);
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    for (let i = 0; i < board.length; i++) {
      const [x, z] = cellXZ(i), [w, h] = cellWH(i);
      if (Math.abs(hit.x - x) <= w / 2 && Math.abs(hit.z - z) <= h / 2) return i;
    }
    return null;
  };
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; moved = 0; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; moved += Math.abs(dx) + Math.abs(dy);
      yaw -= dx * 0.006; pitch = Math.max(0.35, Math.min(1.35, pitch + dy * 0.004));
      drag = { x: e.clientX, y: e.clientY };
    } else {
      const i = pick(e);
      hover.visible = i !== null;
      if (i !== null) { const [x, z] = cellXZ(i), [w, h] = cellWH(i); hover.scale.set(w - 2, h - 2, 1); hover.position.set(x, TOP + 0.8, z); }
      canvas.style.cursor = i !== null ? 'pointer' : 'grab';
    }
  });
  canvas.addEventListener('pointerup', e => {
    if (drag && moved < 6) { const i = pick(e); if (i !== null) { fg.selected = i; fgPaint(); SFX.tick(); } }
    drag = null;
  });
  canvas.addEventListener('pointerleave', () => { hover.visible = false; });
  canvas.addEventListener('wheel', e => { e.preventDefault(); dist = Math.max(900, Math.min(2600, dist * (1 + Math.sign(e.deltaY) * 0.08))); }, { passive: false });

  let lastW = 0, lastH = 0;
  const easeOut = t => 1 - (1 - t) ** 3;
  const stop = loop((dt, tms) => {
    if (!boardEl.isConnected) { api.dispose(); return false; }
    const now = performance.now(), t = tms / 1000;
    const cw = boardEl.clientWidth, ch = boardEl.clientHeight;
    if (cw && (cw !== lastW || ch !== lastH)) { lastW = cw; lastH = ch; renderer.setSize(cw, ch, false); cam.aspect = cw / ch; cam.updateProjectionMatrix(); }
    cam.position.set(Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist);
    cam.lookAt(0, 0, 40);
    // pions : glissent et sautent vers leur case
    tokens.forEach((tk, s) => {
      if (!tk.to) return;
      const k = tk.dur ? Math.min(1, (now - tk.t0) / tk.dur) : 1;
      const p = tk.from ? tk.from.clone().lerp(tk.to, easeOut(k)) : tk.to.clone();
      p.y += Math.sin(Math.PI * k) * tk.arc;
      tk.m.position.copy(p);
      if (k < 1 && tk.from) tk.m.rotation.y = Math.atan2(tk.to.x - tk.from.x, tk.to.z - tk.from.z);
      tk.m.scale.y = k < 1 ? 1 + Math.sin(Math.PI * k) * 0.15 : 1;
    });
    const turn = fg && fg.view ? fg.view.turn : 0;
    const ct = tokens[turn];
    if (ct) { curRing.position.set(ct.m.position.x, ct.m.position.y + 1, ct.m.position.z); curRing.scale.setScalar(1 + Math.sin(t * 5) * 0.08); ringM.color.set(fg.view.players[turn].color); curRing.visible = !fg.view.players[turn].out; }
    // dés
    dice.forEach(D => {
      if (!D.t0 || now < D.t0) return;
      const k = Math.min(1, (now - D.t0) / 900);
      const pos = D.start.clone().lerp(D.end, easeOut(k));
      pos.y = D.end.y + (D.start.y - D.end.y) * (1 - k) ** 2 + Math.abs(Math.sin(k * Math.PI * 3)) * 60 * (1 - k);
      D.m.position.copy(pos);
      const spin = new THREE.Quaternion().setFromEuler(new THREE.Euler(D.spin.x * (1 - k) ** 2, D.spin.y * (1 - k) ** 2, D.spin.z * (1 - k) ** 2));
      D.m.quaternion.copy(D.qs).multiply(spin).slerp(D.qe, easeOut(Math.min(1, k * 1.25)));
      if (k >= 1) { D.m.quaternion.copy(D.qe); D.m.position.copy(D.end); D.t0 = 0; }
    });
    // apparitions qui rebondissent
    scene.traverse(o => {
      if (o.userData.pop === undefined) return;
      const s = o.userData.pop = Math.min(1, o.userData.pop + dt * 3);
      o.scale.setScalar(s < 1 ? Math.max(0.01, easeOut(s) + Math.sin(s * Math.PI) * 0.35) : 1);
      if (s >= 1) delete o.userData.pop;
    });
    glow.intensity = 0.7 + Math.sin(t * 3) * 0.15;
    selM.opacity = 0.45 + Math.sin(t * 6) * 0.25;
    renderer.render(scene, cam);
  });

  const api = {
    sync(v, selected) {
      v.board.forEach((sq, i) => {
        const o = v.owner[i];
        setOwner(i, o !== undefined ? v.players[o].color : null, false);
        setMortgage(i, !!v.mortgaged[i]);
        if (sq.type === 'prop') placeHouses(i, v.houses[i] || 0, false);
      });
      sel.visible = selected !== null && selected !== undefined;
      if (sel.visible) { const [x, z] = cellXZ(selected), [w, h] = cellWH(selected); sel.scale.set(w * 1.38, h * 1.38, 1); sel.position.set(x, TOP + 1, z); }
      tokens.forEach((tk, s) => { tk.m.visible = !v.players[s].out; });
    },
    tokens(pos, v, instant) {
      tokens.forEach((tk, s) => {
        const to = tokenSpot(pos[s], s);
        if (tk.to && tk.to.distanceTo(to) < 0.5) return;
        const far = tk.to ? tk.to.distanceTo(to) : 0;
        tk.from = instant || !tk.to ? null : tk.m.position.clone();
        tk.to = to; tk.t0 = performance.now();
        tk.dur = instant ? 0 : far > 260 ? 650 : 160;
        tk.arc = far > 260 ? 220 : 26;
      });
    },
    dice: setDice,
    build(sq, n) { placeHouses(sq, n, true); },
    own(sq, color) { setOwner(sq, color, true); },
    dispose() {
      stop(); renderer.dispose(); canvas.remove();
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; ms.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); });
    },
  };
  return api;
}
