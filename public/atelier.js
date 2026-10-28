/* L'Atelier de Coulée — jeu coopératif en ligne en 3D (serveur : atelier.py).
   Chaque joueur incarne un ouvrier (squelette animé de Coulée Royale). Il faut se coordonner : un au pupitre du
   pont roulant, un autre qui accroche ; tasser le sable à plusieurs ; doser le cubilot ; inoculer la poche ; couler. */
'use strict';

ONLINE.push({
  id: 'atelier', title: 'L’Atelier de Coulée', tone: '#F5B700', label: 'Coopération · 1 à 4 ouvriers', tag: 'COOP 1-4',
  pitch: 'Toute l’équipe dans la même fonderie : moulage, noyaux, pont roulant, cubilot, dosage du métal, coulée et décochage. Coordonnez-vous pour livrer les commandes sans rebut !',
  how: '<b>ZQSD / flèches</b> se déplacer · <b>E</b> prendre, poser, utiliser, accrocher au pont · <b>Espace maintenu</b> travailler (tasser, percer le cubilot, couler, décocher). Au <b>pupitre</b>, E prend les commandes du pont roulant et les flèches le déplacent ; un équipier accroche avec E sous le crochet. Cubilot : 1 coke pour 2 gueuses, 1 castine pour 4 ; poche : 1 ferrosilicium pour 2 unités de fonte ; coulez au-dessus de 1330 °C.',
});
HANDLERS.atelier = () => updateAtelier();

let atClient = null;
function stopAtelier() { if (atClient && atClient !== 'loading') atClient.stop(); atClient = null; }

function updateAtelier() {
  if (!trackInfo || !trackInfo.stations) return;
  if (view.finished) {
    if (atClient && atClient !== 'loading' && !atClient.endShown) { atClient.push(view); atClient.endShown = true; setTimeout(() => updateAtelier(), 3000); return; }
    if (document.getElementById('rewardBox')) return;
    stopAtelier();
    const ok = view.score >= trackInfo.goal;
    resultScreen([`<li><b>${ok ? '🏆' : '🔥'}</b><i style="background:${ok ? '#7FD48A' : '#EC641E'}"></i><span>Équipe · ${view.done} pièce${view.done > 1 ? 's' : ''} livrée${view.done > 1 ? 's' : ''}</span><em>${view.score} / ${trackInfo.goal} pts</em></li>`,
      ...view.p.map(p => `<li><b>·</b><i style="background:${(RY_METIERS[p.m] || RY_METIERS.fondeur).color}"></i><span>${esc(p.n)}${p.b ? ' · apprenti' : ''}</span><em>${(RY_METIERS[p.m] || RY_METIERS.fondeur).name}</em></li>`)]);
    return;
  }
  if (!atClient) {
    atClient = 'loading';
    stage.innerHTML = '<div class="screen"><p>Ouverture de l’atelier…</p></div>';
    loadThree().then(() => { if (atClient === 'loading' && onlineKind === 'atelier') { atClient = startAtelierClient(); atClient.push(view); } })
      .catch(e => { atClient = null; toast(e.message); });
    return;
  }
  if (atClient !== 'loading') atClient.push(view);
}

function startAtelierClient() {
  const W = 960, H = 540;
  const GR = trackInfo.grid, TT = GR.tile, HW = GR.cols * TT, HH = GR.rows * TT, PR = trackInfo.pr;
  const ST = trackInfo.stations, DEF = trackInfo.defects, PARTS = trackInfo.parts;
  stage.innerHTML = '';
  $('#hudInfo').textContent = 'Coopération';
  const wrap = document.createElement('div'); wrap.className = 'play-wrap'; stage.appendChild(wrap);
  const screen = document.createElement('div'); screen.className = 'tk-screen'; wrap.appendChild(screen);
  const { c: hud, g } = makeCanvas(screen, W, H);
  hud.classList.add('tk-hud');
  const pad = document.createElement('div'); pad.className = 'touch-pad';
  pad.innerHTML = `<div class="grp"><button data-d="l">◀</button><button data-d="u">▲</button><button data-d="d">▼</button><button data-d="r">▶</button></div>
    <div class="grp"><button data-b="use" class="warm">E</button><button data-b="work" class="hot">TRAVAIL</button></div>`;
  wrap.appendChild(pad);
  const hint = document.createElement('p'); hint.className = 'keys-hint';
  hint.textContent = 'ZQSD / FLÈCHES BOUGER · E PRENDRE / POSER / ACCROCHER · ESPACE MAINTENU TRAVAILLER · AU PUPITRE : E PUIS FLÈCHES = PONT ROULANT';
  wrap.appendChild(hint);
  const center = (s) => [s.tx * TT + TT / 2, s.ty * TT + TT / 2];

  /* ---------- entrées ---------- */
  const held = new Set();
  let work = false, lastSend = 0;
  const KEY = { KeyW: 'u', ArrowUp: 'u', KeyS: 'd', ArrowDown: 'd', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
  const use = () => send({ t: 'act', a: 'use' });
  const kd = e => {
    if (e.code === 'KeyE' && !e.repeat) { e.preventDefault(); use(); return; }
    if (e.code === 'Space') { e.preventDefault(); work = true; return; }
    const k = KEY[e.code]; if (k) { e.preventDefault(); held.add(k); }
  };
  const ku = e => { if (e.code === 'Space') work = false; const k = KEY[e.code]; if (k) held.delete(k); };
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
  const blur = () => { held.clear(); work = false; }; window.addEventListener('blur', blur);
  pad.querySelectorAll('[data-d]').forEach(b => {
    b.addEventListener('pointerdown', e => { e.preventDefault(); held.add(b.dataset.d); b.classList.add('on'); });
    const up = () => { held.delete(b.dataset.d); b.classList.remove('on'); };
    b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
  });
  pad.querySelector('[data-b="use"]').addEventListener('pointerdown', e => { e.preventDefault(); use(); });
  const wb = pad.querySelector('[data-b="work"]');
  wb.addEventListener('pointerdown', e => { e.preventDefault(); work = true; wb.classList.add('on'); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => wb.addEventListener(ev, () => { work = false; wb.classList.remove('on'); }));

  /* ---------- mon ouvrier (prédit ici, vérifié par le serveur) ---------- */
  const me = { x: 0, y: 0, a: 0, tp: -1 };
  const solid = new Set(ST.map(s => s.tx + ',' + s.ty));
  const blocked = (x, y) => {
    if (x < PR || y < PR || x > HW - PR || y > HH - PR) return true;
    for (const s of ST) {
      const nx = Math.min(Math.max(x, s.tx * TT + 6), s.tx * TT + TT - 6), ny = Math.min(Math.max(y, s.ty * TT + 6), s.ty * TT + TT - 6);
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
  scene.background = new THREE.Color('#140d09');
  const cam = new THREE.PerspectiveCamera(42, W / H, 10, 6000);
  cam.position.set(HW / 2, 1020, HH + 560); cam.lookAt(HW / 2, 0, HH / 2 + 40);
  scene.add(new THREE.HemisphereLight('#ffe8d0', '#3a1c0c', 0.85));
  const sun = new THREE.DirectionalLight('#fff0dc', 0.7); sun.position.set(-400, 1200, 600); scene.add(sun);
  const M = (color, extra) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.1, ...(extra || {}) }); m.color.convertSRGBToLinear(); if (m.emissive) m.emissive.convertSRGBToLinear(); return m; };
  const floorTex = tkTexture(512, 320, (b, w, h) => {
    b.fillStyle = '#4a4440'; b.fillRect(0, 0, w, h);
    for (let x = 0; x < GR.cols; x++) for (let y = 0; y < GR.rows; y++) { b.fillStyle = `rgba(0,0,0,${0.04 + ((x * 7 + y * 3) % 4) * 0.02})`; b.fillRect(x * 32 + 1, y * 32 + 1, 30, 30); }
    for (let i = 0; i < 200; i++) { b.fillStyle = `rgba(20,14,10,${0.1 + Math.random() * 0.15})`; b.beginPath(); b.ellipse(Math.random() * w, Math.random() * h, 2 + Math.random() * 8, 1 + Math.random() * 5, Math.random() * 3, 0, Math.PI * 2); b.fill(); }
    b.strokeStyle = 'rgba(245,183,0,.7)'; b.lineWidth = 2; b.setLineDash([8, 6]); b.strokeRect(4 * 32 + 8, 8, 8 * 32 - 16, h - 16); b.setLineDash([]);
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HW, HH), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(HW / 2, 0, HH / 2); scene.add(floor);
  const wallM = M('#5c6067', { metalness: 0.3 });
  [[HW / 2, -20, HW + 80, 40], [-20, HH / 2, 40, HH], [HW + 20, HH / 2, 40, HH]].forEach(([x, z, w, d]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 200, d), wallM); m.position.set(x, 100, z); scene.add(m); });

  // postes de travail
  const glows = [];
  const add = (geo, mat, x, y, z, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  const stObj = {};
  const pile = (x, z, col, n, shape) => { const grp = new THREE.Group(); for (let k = 0; k < n; k++) { const a = k * 2.4, r = 10 + (k % 5) * 6; const geo = shape === 'ingot' ? new THREE.BoxGeometry(40, 12, 16) : shape === 'stone' ? new THREE.DodecahedronGeometry(9) : new THREE.IcosahedronGeometry(10); const m = add(geo, M(col, { roughness: shape === 'ingot' ? 0.4 : 0.9, metalness: shape === 'ingot' ? 0.6 : 0 }), x + Math.cos(a) * r, 8 + Math.floor(k / 6) * 12, z + Math.sin(a) * r, grp); m.rotation.y = a; } scene.add(grp); return grp; };
  ST.forEach(s => {
    const [x, z] = center(s);
    const base = add(new THREE.BoxGeometry(TT - 6, 6, TT - 6), M('#2b2e33'), x, 3, z);
    switch (s.k) {
      case 'sable': { const m = add(new THREE.ConeGeometry(42, 50, 14), M('#b08a5a', { roughness: 1 }), x, 28, z); break; }
      case 'noyaux': { add(new THREE.BoxGeometry(80, 90, 40), M('#6b4c2c'), x, 48, z); for (let k = 0; k < 6; k++) add(new THREE.CylinderGeometry(7, 7, 26, 10), M('#e2d2a8'), x - 28 + (k % 3) * 28, 30 + Math.floor(k / 3) * 40, z + 4); break; }
      case 'livraison': { add(new THREE.BoxGeometry(80, 40, 80), M('#2b6cb0'), x, 22, z); add(new THREE.BoxGeometry(70, 4, 70), M('#1a1a1a'), x, 44, z); break; }
      case 'etabli': { add(new THREE.BoxGeometry(84, 50, 84), M('#6b4c2c'), x, 28, z); break; }
      case 'grille': { for (let k = 0; k < 6; k++) add(new THREE.BoxGeometry(80, 8, 6), M('#2b2e33', { metalness: 0.6 }), x, 30, z - 30 + k * 12); add(new THREE.BoxGeometry(84, 26, 84), M('#3a3d42'), x, 14, z); break; }
      case 'coulee': { add(new THREE.BoxGeometry(90, 10, 90), M('#3a302a'), x, 8, z); const ring = add(new THREE.RingGeometry(34, 40, 4, 1, Math.PI / 4), new THREE.MeshBasicMaterial({ color: '#F5B700' }), x, 14, z); ring.rotation.x = -Math.PI / 2; break; }
      case 'pupitre': { add(new THREE.CylinderGeometry(5, 5, 120, 8), M('#5c6067'), x, 60, z); const box = add(new THREE.BoxGeometry(36, 46, 24), M('#F5B700'), x, 120, z); add(new THREE.SphereGeometry(5, 8, 6), new THREE.MeshBasicMaterial({ color: '#2aff5a' }), x - 8, 130, z + 13); add(new THREE.SphereGeometry(5, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff2a2a' }), x + 8, 130, z + 13); stObj.pupitre = box; break; }
      case 'cubilot': { add(new THREE.CylinderGeometry(58, 70, 380, 20), M('#7a3a2a', { roughness: 0.9 }), x, 190, z); add(new THREE.CylinderGeometry(30, 34, 120, 14), M('#3a3d42', { metalness: 0.5 }), x, 440, z); const mouth = add(new THREE.CircleGeometry(26, 14), new THREE.MeshBasicMaterial({ color: '#ff8a2a' }), x - 40, 50, z + 52); mouth.rotation.y = -0.6; stObj.cubilot = mouth; const flame = add(new THREE.ConeGeometry(20, 60, 10), new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }), x, 530, z); stObj.flame = flame; const pl = new THREE.PointLight('#ff7a2a', 0, 700, 1.5); pl.position.set(x - 60, 120, z + 80); scene.add(pl); stObj.cupLight = pl; break; }
      case 'bec': { const tr = add(new THREE.BoxGeometry(70, 16, 30), M('#3a3d42', { metalness: 0.5 }), x + 20, 70, z); tr.rotation.z = 0.25; const lava = add(new THREE.BoxGeometry(60, 4, 22), new THREE.MeshBasicMaterial({ color: '#ff8a2a' }), x + 20, 79, z); lava.rotation.z = 0.25; stObj.becLava = lava; break; }
      case 'soufflerie': { add(new THREE.BoxGeometry(70, 70, 70), M('#2f6b4a', { metalness: 0.4 }), x, 38, z); const fan = add(new THREE.BoxGeometry(6, 54, 10), M('#c9ccd1', { metalness: 0.7 }), x - 37, 40, z); stObj.fan = fan; break; }
      case 'coke': pile(x, z, '#1a1a1a', 18); break;
      case 'fonte': pile(x, z, '#6a6f77', 12, 'ingot'); break;
      case 'castine': pile(x, z, '#e8e4dc', 16, 'stone'); break;
      case 'fesi': { add(new THREE.BoxGeometry(70, 50, 60), M('#9aa0a6', { metalness: 0.7, roughness: 0.3 }), x, 28, z); break; }
    }
  });
  // pont roulant : poutre jaune qui avance en x, chariot en y, crochet au bout du câble
  const beamTex = tkTexture(256, 32, (b, w, h) => { b.fillStyle = '#F5B700'; b.fillRect(0, 0, w, h); b.fillStyle = '#1a1a1a'; for (let x = -32; x < w; x += 32) { b.beginPath(); b.moveTo(x, h); b.lineTo(x + 16, 0); b.lineTo(x + 28, 0); b.lineTo(x + 12, h); b.fill(); } }, [6, 1]);
  const bridge = new THREE.Group(); scene.add(bridge);
  add(new THREE.BoxGeometry(46, 36, HH + 60), new THREE.MeshStandardMaterial({ map: beamTex, metalness: 0.4, roughness: 0.5 }), 0, 470, HH / 2, bridge);
  const trolley = add(new THREE.BoxGeometry(70, 30, 60), M('#3a3d42', { metalness: 0.6 }), 0, 440, 0, bridge);
  const cable = add(new THREE.CylinderGeometry(1.5, 1.5, 1, 6), M('#1a1a1a'), 0, 0, 0, bridge);
  const hook = add(new THREE.TorusGeometry(10, 3, 6, 12, Math.PI * 1.4), M('#c9ccd1', { metalness: 0.8 }), 0, 0, 0, bridge);
  const hookRing = new THREE.Mesh(new THREE.RingGeometry(58, 68, 32), new THREE.MeshBasicMaterial({ color: '#F5B700', transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
  hookRing.rotation.x = -Math.PI / 2; scene.add(hookRing);
  // poche de coulée
  const ladle = new THREE.Group(); scene.add(ladle);
  add(new THREE.CylinderGeometry(30, 22, 50, 18), M('#3a3d42', { metalness: 0.6 }), 0, 0, 0, ladle);
  const ladleLava = add(new THREE.CircleGeometry(27, 18), new THREE.MeshBasicMaterial({ color: '#ffb347' }), 0, 18, 0, ladle); ladleLava.rotation.x = -Math.PI / 2;
  const bail = add(new THREE.TorusGeometry(34, 2.5, 6, 16, Math.PI), M('#5c6067'), 0, 24, 0, ladle);
  const stream = add(new THREE.CylinderGeometry(4, 4, 1, 8), new THREE.MeshBasicMaterial({ color: '#ffcf6a' }), 0, 0, 0); stream.visible = false;
  // châssis de moulage (un par moule)
  const moulds = new Map();
  const mkMould = () => {
    const grp = new THREE.Group();
    const frame = add(new THREE.BoxGeometry(80, 34, 80), M('#2f6b4a', { metalness: 0.4 }), 0, 17, 0, grp);
    const sand = add(new THREE.BoxGeometry(70, 1, 70), M('#b08a5a', { roughness: 1 }), 0, 4, 0, grp);
    const cope = add(new THREE.BoxGeometry(80, 26, 80), M('#2f6b4a', { metalness: 0.4 }), 0, 47, 0, grp);
    const copeSand = add(new THREE.BoxGeometry(70, 2, 70), M('#b08a5a'), 0, 61, 0, grp);
    const sprue = add(new THREE.CylinderGeometry(9, 5, 6, 12), new THREE.MeshBasicMaterial({ color: '#1a120c' }), 18, 63, -18, grp);
    const cores = [0, 1, 2].map(k => add(new THREE.CylinderGeometry(6, 6, 20, 10), M('#e2d2a8'), -20 + k * 20, 40, 0, grp));
    const hot = add(new THREE.BoxGeometry(72, 2, 72), new THREE.MeshBasicMaterial({ color: '#ff6a1a', transparent: true, opacity: 0 }), 0, 63, 0, grp);
    scene.add(grp);
    return { grp, sand, cope, copeSand, sprue, cores, hot };
  };
  // pièces brutes, objets portés et posés
  const itemMesh = it => {
    const grp = new THREE.Group();
    if (it === 'sable') { add(new THREE.CylinderGeometry(14, 11, 20, 12), M('#5c6067', { metalness: 0.5 }), 0, 0, 0, grp); add(new THREE.SphereGeometry(13, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M('#b08a5a'), 0, 8, 0, grp); }
    else if (it === 'noyau') add(new THREE.CylinderGeometry(7, 7, 28, 10), M('#e2d2a8'), 0, 0, 0, grp).rotation.z = Math.PI / 2;
    else if (it === 'coke') for (let k = 0; k < 4; k++) add(new THREE.IcosahedronGeometry(7), M('#1a1a1a'), (k % 2) * 10 - 5, Math.floor(k / 2) * 8, 0, grp);
    else if (it === 'fonte') add(new THREE.BoxGeometry(36, 12, 14), M('#6a6f77', { metalness: 0.7, roughness: 0.35 }), 0, 0, 0, grp);
    else if (it === 'castine') for (let k = 0; k < 3; k++) add(new THREE.DodecahedronGeometry(7), M('#e8e4dc'), k * 9 - 9, 0, 0, grp);
    else if (it === 'fesi') add(new THREE.BoxGeometry(22, 16, 16), M('#c9ccd1', { metalness: 0.8, roughness: 0.2 }), 0, 0, 0, grp);
    else { add(new THREE.CylinderGeometry(22, 22, 10, 18), M('#4a4e54', { metalness: 0.6 }), 0, 0, 0, grp); add(new THREE.CylinderGeometry(8, 8, 18, 12), M('#4a4e54', { metalness: 0.6 }), 0, 6, 0, grp); }
    scene.add(grp);
    return grp;
  };
  const floorItems = new Map();
  // ouvriers
  const rigs = [], carried = [];

  /* ---------- réception ---------- */
  let prev = null, cur = null, curAt = 0, prevAt = 0, seenEv = 0, banner = '', bannerAt = 0, bannerCol = '#F5B700';
  const msgs = [];
  function push(v) {
    prev = cur || v; prevAt = curAt || performance.now(); cur = v; curAt = performance.now();
    const sp = v.p[mySeat];
    if (sp && sp.tp !== me.tp) Object.assign(me, { x: sp.x, y: sp.y, a: sp.a, tp: sp.tp });
    for (const e of v.ev) {
      if (e.id <= seenEv) continue;
      seenEv = e.id;
      const mine = e.seat === mySeat;
      if (e.k === 'deliver') {
        const names = (e.defects || []).map(d => DEF[d][0]).join(', ');
        banner = e.verdict === 'conforme' ? `PIÈCE CONFORME +${e.pts}` : e.verdict === 'retouche' ? `À RETOUCHER +${e.pts}` : 'REBUT !';
        bannerCol = e.verdict === 'conforme' ? '#7FD48A' : e.verdict === 'retouche' ? '#F5B700' : '#ff5a5a'; bannerAt = performance.now();
        if (names) msgs.push({ t: `${PARTS[e.type]} : ${names}`, at: performance.now(), c: bannerCol });
        (e.verdict === 'rebut' ? SFX.bad : SFX.good)();
      } else if (e.k === 'shake') {
        sfx(90, 0.4, 'sawtooth', 0.05, -30);
        (e.defects || []).forEach(d => msgs.push({ t: `Défaut : ${DEF[d][0]} — ${DEF[d][2]}`, at: performance.now(), c: DEF[d][1] ? '#ff8a8a' : '#ffd27a' }));
      } else if (e.k === 'expire') { msgs.push({ t: `Commande perdue : ${PARTS[e.type]} (−20)`, at: performance.now(), c: '#ff8a8a' }); sfx(150, 0.3, 'square', 0.04, -60); }
      else if (e.k === 'full') sfx(880, 0.15, 'triangle', 0.05);
      else if (e.k === 'rammed') sfx(520, 0.12, 'triangle', 0.05, 200);
      else if (e.k === 'close') sfx(300, 0.15, 'square', 0.04);
      else if (e.k === 'hook' || e.k === 'unhook') sfx(e.k === 'hook' ? 700 : 500, 0.1, 'square', 0.04);
      else if (e.k === 'charge') sfx(160, 0.12, 'sawtooth', 0.03);
      else if (e.k === 'fesi') sfx(1200, 0.12, 'triangle', 0.04);
      else if (e.k === 'blow') msgs.push({ t: e.on ? 'Soufflerie en marche : le cubilot fond' : 'Soufflerie arrêtée', at: performance.now(), c: '#7fd4ff' });
      else if (e.k === 'op' && !mine) msgs.push({ t: e.on ? `${v.p[e.seat].n} pilote le pont roulant` : `${v.p[e.seat].n} lâche le pupitre`, at: performance.now(), c: '#7fd4ff' });
      else if (e.k === 'take' && mine) sfx(600, 0.05, 'triangle', 0.03);
      else if (e.k === 'end') { banner = e.ok ? 'COMMANDES HONORÉES !' : 'FIN DE POSTE'; bannerCol = e.ok ? '#7FD48A' : '#ff8a8a'; bannerAt = performance.now(); }
    }
  }

  const lerp = (a, b, t) => a + (b - a) * t;
  function interpP(i) {
    const p = cur.p[i], q = (prev && prev.p[i]) || p;
    if (i === mySeat && !p.op) return { ...p, x: me.x, y: me.y, a: me.a };
    const t = Math.min(1.2, (performance.now() - curAt) / Math.max(30, curAt - prevAt));
    return { ...p, x: lerp(q.x, p.x, t), y: lerp(q.y, p.y, t), a: q.a + Math.atan2(Math.sin(p.a - q.a), Math.cos(p.a - q.a)) * Math.min(1, t) };
  }

  /* ---------- aide contextuelle : ce que fait E / Espace ici ---------- */
  const nearStation = () => {
    const fx = me.x + Math.cos(me.a) * 55, fy = me.y + Math.sin(me.a) * 55;
    let best = null, bd = 1e9;
    for (const s of ST) { const [cx, cy] = center(s); if (Math.hypot(cx - me.x, cy - me.y) > trackInfo.reach) continue; const d = Math.hypot(cx - fx, cy - fy); if (d < bd) { bd = d; best = s; } }
    return best;
  };
  function contextHint(sp) {
    if (sp.op) return 'PONT ROULANT : FLÈCHES POUR LE DÉPLACER · E POUR LÂCHER LE PUPITRE';
    const s = nearStation(); if (!s) return sp.c ? `TU PORTES : ${(trackInfo.items[sp.c.it] || sp.c.it).toUpperCase()} · E POUR LE POSER PAR TERRE` : '';
    const [cx, cy] = center(s), cr = cur.crane, hookHere = Math.hypot(cr.x - cx, cr.y - cy) < trackInfo.hook;
    const m = cur.moulds.find(mm => mm.loc[0] === 'st' && mm.loc[1] === s.id);
    const it = sp.c && sp.c.it, la = cur.ladle, cu = cur.cupola;
    switch (s.k) {
      case 'sable': case 'noyaux': case 'coke': case 'fonte': case 'castine': case 'fesi':
        return it ? 'E : REPOSER' : `E : PRENDRE ${(trackInfo.items[{ sable: 'sable', noyaux: 'noyau' }[s.k] || s.k]).toUpperCase()}`;
      case 'etabli':
        if (!m) return 'UN NOUVEAU CHÂSSIS ARRIVE…';
        if (m.closed) return hookHere ? 'E : ACCROCHER LE MOULE AU PONT' : 'MOULE PRÊT : AMENEZ LE CROCHET DU PONT AU-DESSUS';
        if (m.sand < 2) return it === 'sable' ? 'E : VERSER LE SABLE' : `IL FAUT DU SABLE (${m.sand}/2)`;
        if (m.ram < 1) return 'ESPACE MAINTENU : TASSER LE SABLE (À PLUSIEURS, C’EST PLUS RAPIDE)';
        if (it === 'noyau') return `E : POSER LE NOYAU (${m.cores}/3)`;
        return m.cores ? `E : FERMER LE MOULE → ${PARTS[m.cores].toUpperCase()} · OU AJOUTER UN NOYAU` : 'APPORTE UN NOYAU (1 = ROUE, 2 = CARTER, 3 = BLOC)';
      case 'coulee':
        if (!m) return cr.o && cr.o[0] === 'mould' && hookHere ? 'E : DÉCROCHER LE MOULE ICI' : 'PLACE LIBRE SUR LA LIGNE DE COULÉE';
        if (m.metal >= m.need) return m.cool >= 12 ? (hookHere && !cr.o ? 'E : ACCROCHER POUR LE DÉCOCHAGE' : 'REFROIDI : AU PONT, DIRECTION LA GRILLE') : `REFROIDISSEMENT… ${Math.ceil(12 - m.cool)} S`;
        if (cr.o && cr.o[0] === 'ladle' && hookHere) return la.metal > 0 ? `ESPACE MAINTENU : COULER (${m.metal.toFixed(1)}/${m.need})` : 'LA POCHE EST VIDE';
        return 'AMENEZ LA POCHE AU-DESSUS DE CE MOULE';
      case 'grille':
        if (cur.floor.some(f => f[1] === 'piece' && Math.hypot(f[2] - cx, f[3] - cy) < 10)) return 'E : PRENDRE LA PIÈCE';
        if (m) return 'ESPACE MAINTENU : DÉCOCHER';
        return cr.o && cr.o[0] === 'mould' && hookHere ? 'E : DÉCROCHER LE MOULE SUR LA GRILLE' : 'GRILLE DE DÉCOCHAGE';
      case 'livraison': return it === 'piece' ? 'E : LIVRER LA PIÈCE' : 'EXPÉDITION DES PIÈCES';
      case 'pupitre': return 'E : PRENDRE LES COMMANDES DU PONT ROULANT';
      case 'soufflerie': return `E : ${cu.blow ? 'ARRÊTER' : 'LANCER'} LA SOUFFLERIE`;
      case 'cubilot': return ['coke', 'fonte', 'castine'].includes(it) ? 'E : CHARGER LE CUBILOT' : 'CHARGE : 1 COKE POUR 2 GUEUSES, 1 CASTINE POUR 4';
      case 'bec':
        if (it === 'fesi') return la.loc === 'bec' ? 'E : INOCULER LA POCHE' : 'LA POCHE N’EST PAS AU BEC';
        if (la.loc !== 'bec') return cr.o && cr.o[0] === 'ladle' && hookHere ? 'E : REPOSER LA POCHE' : 'POCHE PARTIE AVEC LE PONT';
        if (hookHere && !cr.o) return 'E : ACCROCHER LA POCHE · ESPACE : PERCER LE CUBILOT';
        return cu.metal > 0.05 ? 'ESPACE MAINTENU : PERCER LE TROU DE COULÉE' : 'PAS ENCORE DE FONTE DANS LE CREUSET';
    }
    return '';
  }

  /* ---------- HUD ---------- */
  const v3 = new THREE.Vector3();
  const project = (x, y, z) => { v3.set(x, y, z).project(cam); return [(v3.x + 1) / 2 * W, (1 - v3.y) / 2 * H]; };
  const LABEL = { sable: 'SABLE', noyaux: 'NOYAUX', livraison: 'EXPÉDITION', etabli: 'MOULAGE', grille: 'DÉCOCHAGE', coulee: 'COULÉE', pupitre: 'PUPITRE DU PONT', cubilot: 'CUBILOT', bec: 'TROU DE COULÉE', soufflerie: 'SOUFFLERIE', coke: 'COKE', fonte: 'FONTE', castine: 'CASTINE', fesi: 'FERROSILICIUM' };
  function drawHud(t) {
    g.clearRect(0, 0, W, H);
    // étiquettes des postes
    g.font = '800 10px Archivo, sans-serif'; g.textAlign = 'center';
    ST.forEach(s => { if (s.k === 'coulee' && s.tx !== 8) return; const [x, z] = center(s); const [px, py] = project(x, s.k === 'cubilot' ? 420 : 120, z); g.fillStyle = 'rgba(0,0,0,.55)'; const w = g.measureText(LABEL[s.k]).width + 8; g.fillRect(px - w / 2, py - 10, w, 14); g.fillStyle = '#fff'; g.fillText(LABEL[s.k], px, py + 1); });
    // progression des moules
    cur.moulds.forEach(m => {
      const [px, py] = project(m.x, 90, m.y);
      const bar = (k, col) => { g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(px - 26, py, 52, 7); g.fillStyle = col; g.fillRect(px - 26, py, 52 * Math.min(1, k), 7); };
      if (!m.closed && m.sand >= 2 && m.ram < 1) bar(m.ram, '#7fd4ff');
      else if (m.closed && m.metal > 0 && m.metal < m.need) bar(m.metal / m.need, '#EC641E');
      else if (m.metal >= m.need && m.need && m.cool < 12) bar(m.cool / 12, '#c6cad0');
      else if (m.shake > 0) bar(m.shake / 2, '#F5B700');
      if (m.closed) { g.font = '800 10px Archivo, sans-serif'; g.fillStyle = '#F5B700'; g.fillText(PARTS[m.need], px, py - 4); }
    });
    // noms des ouvriers et objets portés
    cur.p.forEach((p, i) => { const q = interpP(i); const [px, py] = project(q.x, 150, q.y); g.font = '800 11px Archivo, sans-serif'; g.fillStyle = i === mySeat ? '#F5B700' : '#fff'; g.fillText(`${p.n}${p.b ? ' (apprenti)' : ''}`, px, py); });
    // commandes
    cur.orders.forEach((o, k) => {
      const x = 14 + k * 150, y = 12;
      g.fillStyle = 'rgba(8,9,11,.82)'; g.fillRect(x, y, 140, 52);
      g.fillStyle = o.left < 30 ? '#ff5a5a' : '#2E9E5B'; g.fillRect(x, y + 46, 140 * o.left / o.lim, 6);
      g.font = '900 15px "Big Shoulders Display", Impact'; g.textAlign = 'left'; g.fillStyle = '#fff'; g.fillText(PARTS[o.type].toUpperCase(), x + 8, y + 20);
      g.font = '600 10px Archivo, sans-serif'; g.fillStyle = '#c6cad0'; g.fillText(`${o.type} noyau${o.type > 1 ? 'x' : ''} · ${o.type} unité${o.type > 1 ? 's' : ''} de fonte`, x + 8, y + 36);
    });
    // score et temps
    g.fillStyle = 'rgba(8,9,11,.82)'; g.fillRect(W - 170, 12, 156, 52);
    g.font = '900 22px "Big Shoulders Display", Impact'; g.textAlign = 'right'; g.fillStyle = cur.score >= trackInfo.goal ? '#7FD48A' : '#F5B700';
    g.fillText(`${cur.score} / ${trackInfo.goal}`, W - 22, 36);
    const left = Math.max(0, Math.ceil(trackInfo.round - cur.time));
    g.font = '400 10px "Press Start 2P", monospace'; g.fillStyle = left < 30 ? '#ff5a5a' : '#fff'; g.fillText(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, W - 22, 56);
    // cubilot et poche
    const cu = cur.cupola, la = cur.ladle;
    const bx = W - 220, by = H - 150;
    g.fillStyle = 'rgba(8,9,11,.82)'; g.fillRect(bx, by, 206, 136);
    g.textAlign = 'left'; g.font = '900 14px "Big Shoulders Display", Impact'; g.fillStyle = '#ff8a5a'; g.fillText('CUBILOT', bx + 8, by + 18);
    g.font = '600 11px Archivo, sans-serif'; g.fillStyle = '#fff';
    const ratio = cu.fonte ? cu.coke / cu.fonte : 0, okR = ratio >= 0.35 && ratio <= 0.7, okC = cu.fonte ? cu.castine / cu.fonte >= 0.2 : true;
    g.fillText(`Coke ${cu.coke} · Fonte ${cu.fonte} · Castine ${cu.castine}`, bx + 8, by + 34);
    g.fillStyle = okR ? '#7FD48A' : '#ffd27a'; g.fillText(`Dosage coke/fonte : ${cu.fonte ? ratio.toFixed(2) : '–'} (0,5)`, bx + 8, by + 48);
    g.fillStyle = okC ? '#7FD48A' : '#ffd27a'; g.fillText(okC ? 'Castine : laitier fluide' : 'Manque de castine : laitier épais', bx + 8, by + 62);
    g.fillStyle = cu.blow ? '#7fd4ff' : '#9aa0a6'; g.fillText(`${cu.blow ? 'Soufflerie ON' : 'Soufflerie OFF'} · ${cu.temp} °C · creuset ${cu.metal.toFixed(1)}`, bx + 8, by + 76);
    g.font = '900 14px "Big Shoulders Display", Impact'; g.fillStyle = '#ffb347'; g.fillText('POCHE', bx + 8, by + 96);
    g.font = '600 11px Archivo, sans-serif';
    const inoc = la.tapped > 0 ? la.fesi / la.tapped : 0;
    g.fillStyle = la.metal <= 0 ? '#9aa0a6' : la.temp >= 1330 ? '#7FD48A' : la.temp >= 1280 ? '#ffd27a' : '#ff8a8a';
    g.fillText(la.metal > 0 ? `${la.metal.toFixed(1)} unités · ${la.temp} °C` : 'Vide', bx + 8, by + 112);
    g.fillStyle = la.metal <= 0 ? '#9aa0a6' : inoc >= 0.25 && inoc <= 0.95 ? '#7FD48A' : '#ff8a8a';
    g.fillText(la.metal > 0 ? `FeSi : ${la.fesi} pour ${la.tapped.toFixed(1)} (½ par unité)` : 'Inoculer : ½ FeSi par unité', bx + 8, by + 126);
    // aide contextuelle
    const sp = cur.p[mySeat];
    if (sp) {
      const h2 = contextHint(sp);
      if (h2) { g.font = '400 9px "Press Start 2P", monospace'; g.textAlign = 'center'; const w = g.measureText(h2).width + 20; g.fillStyle = 'rgba(8,9,11,.85)'; g.fillRect(W / 2 - 110 - w / 2, H - 38, w, 24); g.fillStyle = '#ffd27a'; g.fillText(h2, W / 2 - 110, H - 22); }
    }
    // messages
    const now = performance.now();
    msgs.splice(0, Math.max(0, msgs.length - 5));
    msgs.filter(m => now - m.at < 6000).forEach((m, k) => { g.font = '700 11px Archivo, sans-serif'; g.textAlign = 'left'; const w = Math.min(560, g.measureText(m.t).width + 14); g.fillStyle = 'rgba(8,9,11,.8)'; g.fillRect(14, 74 + k * 20, w, 18); g.fillStyle = m.c; g.fillText(m.t, 21, 87 + k * 20, 546); });
    if (cur.phase === 'count') bigText(g, String(Math.ceil(cur.countdown)), W / 2, H / 2, 90, '#F5B700');
    if (banner && now - bannerAt < 2500) bigText(g, banner, W / 2, H / 2 - 40, 42, bannerCol);
  }

  /* ---------- boucle ---------- */
  let lastW = 0, lastH = 0;
  const stop = loop((dt, tms) => {
    if (!cur) return;
    const t = tms / 1000;
    const sp = cur.p[mySeat];
    let mx = (held.has('r') ? 1 : 0) - (held.has('l') ? 1 : 0), my = (held.has('d') ? 1 : 0) - (held.has('u') ? 1 : 0);
    const n = Math.hypot(mx, my); if (n > 1) { mx /= n; my /= n; }
    if (sp && cur.phase === 'play' && !sp.op && (mx || my)) {
      const sp2 = trackInfo.speed * dt;
      const nx = me.x + mx * sp2, ny = me.y + my * sp2;
      if (!blocked(nx, me.y)) me.x = nx;
      if (!blocked(me.x, ny)) me.y = ny;
      me.a = Math.atan2(my, mx);
    }
    const now = performance.now();
    if (now - lastSend > 50 && cur.phase === 'play') {
      lastSend = now;
      send({ t: 'act', a: 'in', k: work ? 1 : 0, mx, my, pos: sp && !sp.op ? [+me.x.toFixed(1), +me.y.toFixed(1), +me.a.toFixed(2)] : null, tp: me.tp });
    }
    const cw = hud.clientWidth, ch = hud.clientHeight;
    if (cw && (cw !== lastW || ch !== lastH)) { lastW = cw; lastH = ch; renderer.setSize(cw, ch, false); canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px'; cam.aspect = cw / ch; cam.updateProjectionMatrix(); }
    // ouvriers
    cur.p.forEach((p, i) => {
      if (!rigs[i]) { rigs[i] = ryRig(p.m); scene.add(rigs[i].root); rigs[i].root.scale.setScalar(1.25); }
      const q = interpP(i), rig = rigs[i];
      const pq = prev && prev.p[i] ? prev.p[i] : p;
      const moving = i === mySeat ? (mx || my) && !p.op : Math.hypot(p.x - pq.x, p.y - pq.y) > 1;
      rig.root.position.set(q.x, 0, q.y);
      rig.root.rotation.y = Math.PI / 2 - q.a;
      ryPose(rig, { speed: moving ? 260 : 0, air: false, pitch: p.w ? -0.4 + Math.sin(t * 14) * 0.25 : 0, wid: p.c ? 'riveteuse' : 'poings', weaponObj: null, dead: false }, dt);
      if (p.w && !p.c) rig.swingT = rig.swingT > 0 ? rig.swingT : 0.3;   // gestes de travail
      // objet porté devant soi
      const it = p.c && p.c.it;
      if (carried[i] && carried[i].it !== it) { scene.remove(carried[i].mesh); carried[i] = null; }
      if (it && !carried[i]) carried[i] = { it, mesh: itemMesh(it) };
      if (carried[i]) carried[i].mesh.position.set(q.x + Math.cos(q.a) * 34, 78, q.y + Math.sin(q.a) * 34);
    });
    // pont roulant et crochet
    const cr = cur.crane, cq = (prev && prev.crane) || cr, ct = Math.min(1, (now - curAt) / Math.max(30, curAt - prevAt));
    const hx = lerp(cq.x, cr.x, ct), hz = lerp(cq.y, cr.y, ct);
    bridge.position.x = hx;
    trolley.position.z = hz;
    const hookY = cr.o ? 170 : 130;
    cable.scale.y = 440 - hookY; cable.position.set(0, (440 + hookY) / 2, hz);
    hook.position.set(0, hookY, hz);
    hookRing.position.set(hx, 2, hz);
    hookRing.material.opacity = 0.35 + Math.sin(t * 5) * 0.2;
    // poche
    const la = cur.ladle, bec = ST.find(s => s.k === 'bec'), [bx, bz] = center(bec);
    if (la.loc === 'crane') ladle.position.set(hx, hookY - 30, hz); else ladle.position.set(bx, 40, bz + 30);
    ladleLava.visible = la.metal > 0.02; ladleLava.position.y = -20 + Math.min(1, la.metal / 4) * 38;
    // jet pendant la coulée : un ouvrier travaille sous la poche au-dessus d'un moule
    const pouring = la.loc === 'crane' && la.metal > 0 && cur.p.some(p => p.w) && cur.moulds.some(m => m.closed && m.metal < m.need && Math.hypot(m.x - cr.x, m.y - cr.y) < trackInfo.hook && m.loc[0] === 'st');
    stream.visible = pouring;
    if (pouring) { stream.scale.y = hookY - 90; stream.position.set(hx + 10, (hookY - 30 + 60) / 2, hz); ladle.rotation.z = 0.5; if (Math.random() < 0.2) sfx(80, 0.05, 'sawtooth', 0.015); } else ladle.rotation.z = 0;
    // moules
    const ids = new Set(cur.moulds.map(m => m.id));
    for (const [id, o] of moulds) if (!ids.has(id)) { scene.remove(o.grp); moulds.delete(id); }
    cur.moulds.forEach(m => {
      let o = moulds.get(m.id); if (!o) { o = mkMould(); moulds.set(m.id, o); }
      const onCrane = m.loc[0] === 'crane';
      const s = !onCrane && ST[m.loc[1]];
      const baseY = onCrane ? hookY - 75 : s && s.k === 'etabli' ? 54 : s && s.k === 'grille' ? 34 : 14;
      o.grp.position.set(onCrane ? hx : m.x, baseY, onCrane ? hz : m.y);
      o.sand.scale.y = 1 + m.sand * 12; o.sand.position.y = 4 + m.sand * 6;
      o.sand.material.color.set(m.ram >= 1 ? '#8b6a46' : '#b08a5a');
      o.cores.forEach((c, k) => { c.visible = k < m.cores && !m.closed; });
      o.cope.visible = o.copeSand.visible = o.sprue.visible = m.closed;
      const hot = m.metal > 0 ? Math.max(0, 1 - Math.max(0, m.cool - 2) / 10) : 0;
      o.hot.material.opacity = hot * 0.7; o.hot.visible = m.closed;
      o.sprue.material.color.set(m.metal > 0 && m.cool < 8 ? '#ff8a2a' : '#1a120c');
      if (m.shake > 0) o.grp.position.x += Math.sin(t * 60) * 3;
    });
    // objets par terre (pièces sur la grille comprises)
    const fids = new Set(cur.floor.map(f => f[0]));
    for (const [id, o] of floorItems) if (!fids.has(id)) { scene.remove(o); floorItems.delete(id); }
    cur.floor.forEach(f => { let o = floorItems.get(f[0]); if (!o) { o = itemMesh(f[1]); floorItems.set(f[0], o); } o.position.set(f[2], f[1] === 'piece' ? 40 : 10, f[3]); });
    // cubilot qui ronfle
    const cu = cur.cupola;
    stObj.flame.visible = cu.blow; stObj.flame.scale.set(1, 0.8 + Math.random() * 0.6, 1);
    stObj.cupLight.intensity = cu.blow ? 1.2 + Math.sin(t * 9) * 0.3 : 0.3;
    stObj.cubilot.material.color.set(cu.metal > 0.1 ? '#ffb347' : '#5a2a1a');
    stObj.fan.rotation.x += cu.blow ? dt * 20 : 0;
    stObj.becLava.visible = cur.p.some((p, i) => p.w && Math.hypot(p.x - bx, p.y - bz) < trackInfo.reach) && cu.metal > 0.05 && la.loc === 'bec';
    stObj.pupitre.material.emissive.set(cur.p.some(p => p.op) ? '#3a2a00' : '#000000');
    renderer.render(scene, cam);
    drawHud(t);
  });

  return {
    push, endShown: false,
    stop() {
      stop();
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur);
      renderer.dispose();
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; ms.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); });
    },
  };
}
