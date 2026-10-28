/* Poing de Fonte 3D — affichage three.js du combat 3D (simulation serveur : tekken.py) */
'use strict';

const TK_ROSTER = {
  fondeur:       { ...FIGHTERS.fondeur, special: 'Coulée de fonte', desc: 'Équilibré. Arrière + 2 : jet de fonte qui renverse.' },
  forgeronne:    { ...FIGHTERS.forgeronne, special: 'Marteau-pilon', desc: 'Puissante. Arrière + 2 : coup de masse qui fait tomber.' },
  mouleur:       { ...FIGHTERS.mouleur, special: 'Tempête de sable', desc: 'Contrôle. Arrière + 2 : nuage de sable qui suit et étourdit.' },
  ebarbeuse:     { ...FIGHTERS.ebarbeuse, special: 'Meuleuse', desc: 'Rapide. Arrière + 2 : ruée à la meuleuse, 4 coups.' },
  lamineur:      { name: 'Yanis', title: 'Le Lamineur', color: '#5AA8FF', skin: '#b07a55', pants: '#26313d', special: 'Laminage', desc: 'Lutteur. Avant + 1 + 3 : projection imparable, 38 dégâts.' },
  chaudronniere: { name: 'Léa', title: 'La Chaudronnière', color: '#7FD48A', skin: '#e8b48f', pants: '#2b2f36', special: 'Rivetage', desc: 'Vive. Arrière + 2 : rafale de 3 coups de pied.' },
};
// apparence utilisée par drawFighter (aperçus 2D du choix de personnage)
const FIGHTER_LOOKS = TK_ROSTER;

ONLINE.unshift({
  id: 'tekken', title: 'Poing de Fonte 3D', tone: '#F5B700', label: 'Combat 3D · 1 contre 1', tag: 'COMBAT 3D',
  pitch: "Le tournoi du Poing de Fonte, en 3D façon Tekken 2 : six fondeurs, quatre membres, pas de côté, projections et jongles.",
  how: '<b>← →</b> reculer / avancer (double appui = dash) · <b>↑ ↓</b> appui bref = pas de côté, maintenu = saut / accroupi · <b>U I J K</b> = poing gauche, poing droit, pied gauche, pied droit. ↓↘ + I = uppercut, 1+3 = projection, ← + I = spécial. Rester immobile = garde.',
});
HANDLERS.tekken = () => updateTekken();

let THREE_PROMISE = null;
function loadThree() {
  if (window.THREE) return Promise.resolve();
  if (!THREE_PROMISE) THREE_PROMISE = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    s.onload = resolve;
    s.onerror = () => { THREE_PROMISE = null; reject(new Error('Impossible de charger le moteur 3D.')); };
    document.head.appendChild(s);
  });
  return THREE_PROMISE;
}

let tkClient = null;
function stopTekken() { if (tkClient && tkClient !== 'loading') tkClient.stop(); tkClient = null; }

function updateTekken() {
  if (view.finished) {
    if (document.getElementById('rewardBox')) return;
    stopTekken();
    resultScreen(view.finished.map((i, k) => {
      const f = view.f[i], c = TK_ROSTER[f.ch];
      return `<li><b>${k + 1}</b><i style="background:${c.color}"></i><span>${esc(f.n)} · ${c.name}${i === mySeat ? ' (toi)' : ''}</span><em>${f.w} manche(s)</em></li>`;
    }));
    return;
  }
  if (!tkClient) {
    tkClient = 'loading';
    stage.innerHTML = '<div class="screen"><p>Chargement de l\'arène 3D…</p></div>';
    loadThree().then(() => { if (tkClient === 'loading' && onlineKind === 'tekken') { tkClient = startTekkenClient(); tkClient.push(view); } })
      .catch(e => { tkClient = null; toast(e.message); });
    return;
  }
  if (tkClient !== 'loading') tkClient.push(view);
}

/* ---------- textures dessinées à la main ---------- */
function tkTexture(w, h, paint, repeat) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  paint(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.encoding = THREE.sRGBEncoding;   // couleurs fidèles avec la sortie sRGB du rendu
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

/* ---------- squelette d'un combattant ---------- */
function tkRig(look) {
  const M = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0.05, ...extra });
  const sweat = M(look.color), sweatD = M(shade(look.color, -0.25)), skin = M(look.skin), pants = M(look.pants), boots = M('#111214'), glove = M('#b07a45');
  const limb = (len, r, mat) => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.85, len, 10), mat);
    m.position.y = -len / 2; m.castShadow = true;
    const j = new THREE.Mesh(new THREE.SphereGeometry(r * 1.05, 10, 8), mat); j.castShadow = true;
    g.add(m, j);
    return g;
  };
  const root = new THREE.Group();
  const hips = new THREE.Group(); root.add(hips);
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(40, 18, 26), pants); pelvis.castShadow = true; hips.add(pelvis);
  const torso = new THREE.Group(); hips.add(torso);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(46, 64, 30), sweat); chest.position.y = 34; chest.castShadow = true; torso.add(chest);
  const band = new THREE.Mesh(new THREE.BoxGeometry(47, 8, 31), sweatD); band.position.y = 4; torso.add(band);
  const logo = new THREE.Mesh(new THREE.RingGeometry(5, 7.5, 20), new THREE.MeshBasicMaterial({ color: '#ffffff' })); logo.position.set(-10, 52, 15.6); torso.add(logo);
  if (look.title === 'Le Fondeur' || look.title === 'La Forgeronne') {
    const apron = new THREE.Mesh(new THREE.BoxGeometry(34, 70, 3), M(look.title === 'Le Fondeur' ? '#c9ccd1' : '#6b4227', { metalness: look.title === 'Le Fondeur' ? 0.6 : 0 }));
    apron.position.set(0, 14, 16.5); torso.add(apron);
  }
  const head = new THREE.Group(); head.position.y = 76; torso.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(16, 16, 12), skin); skull.position.y = 14; skull.castShadow = true; head.add(skull);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 10, 8), skin); neck.position.y = 2; head.add(neck);
  // couvre-chefs
  const hat = {
    'Le Fondeur': () => { const h = new THREE.Mesh(new THREE.SphereGeometry(19, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), M('#c9ccd1', { metalness: 0.7, roughness: 0.3 })); h.position.y = 14; const v = new THREE.Mesh(new THREE.BoxGeometry(22, 12, 4), M('#f5b700', { metalness: 0.8, roughness: 0.2, emissive: '#3a2a00' })); v.position.set(0, 14, 15); head.add(h, v); },
    'La Forgeronne': () => { const h = new THREE.Mesh(new THREE.SphereGeometry(17, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), M('#BA2C3A')); h.position.y = 15; const bun = new THREE.Mesh(new THREE.SphereGeometry(8, 10, 8), M('#3b2216')); bun.position.set(0, 22, -14); head.add(h, bun); },
    'Le Mouleur': () => { const h = new THREE.Mesh(new THREE.SphereGeometry(17, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), M('#4a4e54')); h.position.y = 15; const p = new THREE.Mesh(new THREE.BoxGeometry(22, 3, 16), M('#4a4e54')); p.position.set(0, 17, 16); const gg = new THREE.Mesh(new THREE.BoxGeometry(26, 7, 4), M('#7fd4ff', { metalness: 0.5, roughness: 0.2 })); gg.position.set(0, 13, 15); head.add(h, p, gg); },
    "L'Ébarbeuse": () => { const m = new THREE.Mesh(new THREE.BoxGeometry(28, 16, 22), M('#2b2e33', { metalness: 0.4 })); m.position.set(0, 30, 2); m.rotation.x = -0.5; const tail = new THREE.Mesh(new THREE.CylinderGeometry(4, 2, 26, 8), M('#1b1d20')); tail.position.set(0, 8, -18); tail.rotation.x = 0.6; head.add(m, tail); },
    'Le Lamineur': () => { const h = new THREE.Mesh(new THREE.SphereGeometry(19, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), M('#f5b700', { roughness: 0.4 })); h.position.y = 15; const brim = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 2, 20), M('#f5b700')); brim.position.y = 15; head.add(h, brim); },
    'La Chaudronnière': () => { const hair = new THREE.Mesh(new THREE.SphereGeometry(17, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), M('#6b3a1e')); hair.position.y = 15; const gg = new THREE.Mesh(new THREE.TorusGeometry(5, 2, 6, 12), M('#222')); gg.position.set(-6, 24, 12); const gg2 = gg.clone(); gg2.position.x = 6; head.add(hair, gg, gg2); },
  }[look.title];
  if (hat) hat();
  const eye = new THREE.Mesh(new THREE.SphereGeometry(2, 6, 6), M('#111')); eye.position.set(-6, 16, 14.5); const eye2 = eye.clone(); eye2.position.x = 6; head.add(eye, eye2);
  const arm = side => {
    const sh = new THREE.Group(); sh.position.set(side * 28, 60, 0); torso.add(sh);
    const up = limb(36, 8.5, sweat); sh.add(up);
    const el = new THREE.Group(); el.position.y = -36; sh.add(el);
    const fo = limb(33, 7.5, sweat); el.add(fo);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(9, 10, 8), glove); hand.position.y = -36; hand.castShadow = true; el.add(hand);
    return { sh, el, hand };
  };
  const leg = side => {
    const hp = new THREE.Group(); hp.position.set(side * 12, -4, 0); hips.add(hp);
    const th = limb(48, 11, pants); hp.add(th);
    const kn = new THREE.Group(); kn.position.y = -48; hp.add(kn);
    const sh = limb(46, 9, pants); kn.add(sh);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(16, 12, 30), boots); boot.position.set(0, -50, 7); boot.castShadow = true; kn.add(boot);
    return { hp, kn };
  };
  const L = { arm: arm(-1), leg: leg(-1) }, R = { arm: arm(1), leg: leg(1) };
  // outils des coups spéciaux, tenus dans la main droite
  const tools = {};
  const handR = R.arm.hand;
  tools.ladle = new THREE.Group();
  { const h = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 46, 6), M('#6a6f77', { metalness: 0.6 })); h.position.y = -22; const b = new THREE.Mesh(new THREE.SphereGeometry(13, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M('#3a3d42', { metalness: 0.6 })); b.position.y = -48; const lava = new THREE.Mesh(new THREE.CircleGeometry(11, 12), new THREE.MeshBasicMaterial({ color: '#ffb347' })); lava.rotation.x = -Math.PI / 2; lava.position.y = -47; tools.ladle.add(h, b, lava); }
  tools.hammer = new THREE.Group();
  { const h = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 70, 6), M('#7a5434')); h.position.y = -30; const hd = new THREE.Mesh(new THREE.BoxGeometry(26, 22, 44), M('#5c6067', { metalness: 0.7, roughness: 0.3 })); hd.position.y = -64; tools.hammer.add(h, hd); }
  tools.grinder = new THREE.Group();
  { const b = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 30, 8), M('#2b6cb0')); b.position.y = -14; const d = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 2, 20), M('#9aa0a6', { metalness: 0.8 })); d.position.y = -32; tools.grinder.add(b, d); tools.disc = d; }
  Object.values(tools).forEach(t => { if (t.isObject3D) { t.visible = false; handR.add(t); } });
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { root, hips, torso, head, L, R, tools };
}

/* applique la pose (calculée par fighterPose, partagée avec la version 2D) au squelette 3D */
function tkPose(rig, f, t) {
  const an = f.an;
  const tm = (an && F_MOVES[an]) || [4, 4, 8];
  const total = tm[0] + tm[1] + tm[2];
  const fr = f.ph === 0 ? f.pp * tm[0] : f.ph === 1 ? tm[0] + f.pp * tm[1] : tm[0] + tm[1] + f.pp * tm[2];
  const stMap = { ss: 'walk', dash: 'walk', air: 'down', thrown: 'hit', getup: 'getup' };
  let st = stMap[f.st] || f.st;
  if (f.st === 'idle' && f.cr) st = 'crouch';
  const pf = { st, mv: an, p: total ? fr / total : 0, bl: false, lg: f.cr, y: f.y, fc: 1, ch: f.ch };
  if (f.st === 'down' || f.st === 'ko') pf.y = 0;
  const P = fighterPose(pf, t);
  // le membre qui frappe est devant : gauche pour 1/3, droit pour 2/4
  const front = f.st === 'attack' && f.lb === 'R' ? rig.R : rig.L, back = front === rig.L ? rig.R : rig.L;
  const legLen = (h, k) => Math.cos(h) * 48 + Math.cos(h + k) * 46;
  const hipY = Math.max(legLen(P.hF, P.kF), legLen(P.hB, P.kB));
  rig.hips.position.y = hipY + 4 + (P.lift || 0);
  rig.hips.rotation.x = P.rot || 0;
  if (P.rot) rig.hips.position.y = f.y > 4 ? hipY : 26;
  rig.torso.rotation.x = P.lean;
  rig.head.rotation.x = -(P.head || 0);
  front.arm.sh.rotation.set(-(P.sF - P.lean), 0, front === rig.L ? -0.12 : 0.12);
  front.arm.el.rotation.x = -P.eF;
  back.arm.sh.rotation.set(-(P.sB - P.lean), 0, back === rig.L ? -0.18 : 0.18);
  back.arm.el.rotation.x = -P.eB;
  front.leg.hp.rotation.x = -P.hF; front.leg.kn.rotation.x = -P.kF;
  back.leg.hp.rotation.x = -P.hB; back.leg.kn.rotation.x = -P.kB;
  rig.tools.ladle.visible = P.tool === 'ladle';
  rig.tools.hammer.visible = P.tool === 'hammer';
  rig.tools.grinder.visible = P.tool === 'grinder';
  if (rig.tools.disc) rig.tools.disc.rotation.y = t * 40;
}

/* ---------- client ---------- */
function startTekkenClient() {
  const W = 960, H = 540, ARENA = 520;
  stage.innerHTML = '';
  $('#hudInfo').textContent = 'Meilleur des 3 manches';
  const wrap = document.createElement('div'); wrap.className = 'play-wrap'; stage.appendChild(wrap);
  const screen = document.createElement('div'); screen.className = 'tk-screen'; wrap.appendChild(screen);
  const { c: hud, g } = makeCanvas(screen, W, H);
  hud.classList.add('tk-hud');
  const pad = document.createElement('div'); pad.className = 'touch-pad';
  pad.innerHTML = `<div class="grp"><button data-m="1">◀</button><button data-m="4">▲</button><button data-m="8">▼</button><button data-m="2">▶</button></div>
    <div class="grp"><button data-m="16" class="warm">1</button><button data-m="32" class="warm">2</button><button data-m="64" class="hot">3</button><button data-m="128" class="hot">4</button><button data-m="256" class="hot">ULTI</button></div>`;
  wrap.appendChild(pad);
  const hint = document.createElement('p'); hint.className = 'keys-hint';
  hint.textContent = '← → BOUGER · ↑↓ BREF = PAS DE CÔTÉ · U I J K = 1 2 3 4 · ↓↘+I UPPERCUT · U+J PROJECTION · ←+I SPÉCIAL · L ULTIME';
  wrap.appendChild(hint);
  const unGuide = comboGuideButton(wrap, 'tekken');

  // ---- three.js ----
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  const tcv = renderer.domElement; tcv.className = 'tk-3d'; tcv.dataset.overlay = '1';
  screen.insertBefore(tcv, hud);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#120a07');
  scene.fog = new THREE.Fog('#160b06', 900, 2400);
  const cam = new THREE.PerspectiveCamera(38, W / H, 10, 5000);
  scene.add(new THREE.HemisphereLight('#ffe2c4', '#1a0c06', 0.55));
  const sun = new THREE.DirectionalLight('#fff4e6', 0.85);
  sun.position.set(250, 700, 350); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -700, right: 700, top: 700, bottom: -700, near: 100, far: 1800 });
  scene.add(sun);
  const furnace = new THREE.PointLight('#ff7a2a', 2.2, 2600, 1.4); furnace.position.set(0, 260, -1050); scene.add(furnace);
  const rim = new THREE.PointLight('#ff9a40', 0.8, 1400, 1.5); rim.position.set(0, 120, 0); scene.add(rim);

  // sol : tôles rivetées + rigoles de fonte
  const floorTex = tkTexture(1024, 1024, (x, w, h) => {
    x.fillStyle = '#2a2420'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      x.fillStyle = `hsl(20, 8%, ${12 + Math.random() * 6}%)`; x.fillRect(i * 128 + 3, j * 128 + 3, 122, 122);
      x.fillStyle = '#4a4440'; [[10, 10], [118, 10], [10, 118], [118, 118]].forEach(([a, b]) => { x.beginPath(); x.arc(i * 128 + a, j * 128 + b, 4, 0, Math.PI * 2); x.fill(); });
    }
    x.strokeStyle = 'rgba(255,255,255,.04)'; for (let k = 0; k < 300; k++) { x.beginPath(); const a = Math.random() * w, b = Math.random() * h; x.moveTo(a, b); x.lineTo(a + Math.random() * 60, b + Math.random() * 6); x.stroke(); }
  });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(ARENA + 110, 64), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9, metalness: 0.2 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(ARENA + 18, 7, 8, 80), new THREE.MeshBasicMaterial({ color: '#ff8a2a' }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 2; scene.add(ring);
  const logoTex = tkTexture(512, 512, (x, w, h) => { x.clearRect(0, 0, w, h); x.font = '900 120px "Big Shoulders Display", Impact'; x.textAlign = 'center'; x.fillStyle = 'rgba(236,100,30,.35)'; x.fillText('ESFF', w / 2, h / 2 + 10); x.font = '900 70px "Big Shoulders Display", Impact'; x.fillText('101', w / 2, h / 2 + 90); });
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, depthWrite: false }));
  logo.rotation.x = -Math.PI / 2; logo.position.y = 1; scene.add(logo);
  const lower = new THREE.Mesh(new THREE.CircleGeometry(2600, 48), new THREE.MeshStandardMaterial({ color: '#100906', roughness: 1 }));
  lower.rotation.x = -Math.PI / 2; lower.position.y = -2; scene.add(lower);

  // murs de la halle (briques + fours)
  const wallTex = tkTexture(1024, 512, (x, w, h) => {
    x.fillStyle = '#1d0f0a'; x.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 26) for (let i = ((y / 26) % 2) * 35 - 35; i < w; i += 70) { x.fillStyle = `rgb(${70 + Math.random() * 30},${30 + Math.random() * 12},${20})`; x.fillRect(i + 2, y + 2, 66, 22); }
    for (let k = 0; k < 4; k++) { const cx = 128 + k * 256; const gr = x.createRadialGradient(cx, 330, 10, cx, 330, 120); gr.addColorStop(0, 'rgba(255,200,90,1)'); gr.addColorStop(0.4, 'rgba(236,100,30,.8)'); gr.addColorStop(1, 'rgba(236,100,30,0)'); x.fillStyle = gr; x.fillRect(cx - 130, 200, 260, 260); x.fillStyle = '#ffcf6a'; x.beginPath(); x.roundRect(cx - 50, 300, 100, 70, 30); x.fill(); }
  }, [4, 1]);
  const walls = new THREE.Mesh(new THREE.CylinderGeometry(1600, 1600, 1000, 48, 1, true), new THREE.MeshBasicMaterial({ map: wallTex, side: THREE.BackSide }));
  walls.position.y = 480; scene.add(walls);
  // public en sweats de promo
  const crowdTones = ['#EC641E', '#BA2C3A', '#8A8D91', '#2E3238'];
  const crowd = [];
  for (let k = 0; k < 70; k++) {
    const a = (k / 70) * Math.PI * 2 + Math.random() * 0.04, r = 900 + Math.random() * 160;
    const p = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(22, 26, 90, 8), new THREE.MeshStandardMaterial({ color: crowdTones[k % 4], roughness: 0.9 }));
    body.position.y = 45; const hd = new THREE.Mesh(new THREE.SphereGeometry(15, 8, 6), new THREE.MeshStandardMaterial({ color: '#2a1a12' })); hd.position.y = 105;
    p.add(body, hd); p.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); p.userData.ph = Math.random() * 6;
    scene.add(p); crowd.push(p);
  }
  // creuset suspendu qui coule
  const crucible = new THREE.Group();
  { const cr = new THREE.Mesh(new THREE.CylinderGeometry(70, 55, 90, 20), new THREE.MeshStandardMaterial({ color: '#3a3d42', metalness: 0.7, roughness: 0.35 })); const lava = new THREE.Mesh(new THREE.CircleGeometry(66, 20), new THREE.MeshBasicMaterial({ color: '#ffb347' })); lava.rotation.x = -Math.PI / 2; lava.position.y = 46; const stream = new THREE.Mesh(new THREE.CylinderGeometry(6, 9, 420, 10), new THREE.MeshBasicMaterial({ color: '#ff9a3a' })); stream.position.set(60, -230, 0); crucible.add(cr, lava, stream); crucible.position.set(-700, 480, -700); crucible.rotation.z = 0.35; scene.add(crucible); }

  // braises (particules additives)
  const EMB = 260, embPos = new Float32Array(EMB * 3);
  for (let k = 0; k < EMB; k++) { embPos[k * 3] = (Math.random() - 0.5) * 2600; embPos[k * 3 + 1] = Math.random() * 900; embPos[k * 3 + 2] = (Math.random() - 0.5) * 2600; }
  const embGeo = new THREE.BufferGeometry(); embGeo.setAttribute('position', new THREE.BufferAttribute(embPos, 3));
  const embers = new THREE.Points(embGeo, new THREE.PointsMaterial({ color: '#ff9a40', size: 5, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(embers);
  // étincelles des coups
  const SP = 400, spPos = new Float32Array(SP * 3), spVel = new Float32Array(SP * 3), spLife = new Float32Array(SP), spCol = new Float32Array(SP * 3);
  const spGeo = new THREE.BufferGeometry();
  spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3)); spGeo.setAttribute('color', new THREE.BufferAttribute(spCol, 3));
  const sparksPts = new THREE.Points(spGeo, new THREE.PointsMaterial({ size: 7, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(sparksPts);
  let spNext = 0;
  const burst = (x, y, z, n, col, speed = 320) => {
    const cc = new THREE.Color(col);
    for (let k = 0; k < n; k++) {
      const j = spNext++ % SP;
      spPos[j * 3] = x; spPos[j * 3 + 1] = y; spPos[j * 3 + 2] = z;
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2, s = speed * (0.3 + Math.random());
      spVel[j * 3] = Math.cos(a) * Math.cos(b) * s; spVel[j * 3 + 1] = Math.sin(b) * s + 120; spVel[j * 3 + 2] = Math.sin(a) * Math.cos(b) * s;
      spLife[j] = 0.35 + Math.random() * 0.4;
      spCol[j * 3] = cc.r; spCol[j * 3 + 1] = cc.g; spCol[j * 3 + 2] = cc.b;
    }
  };

  // combattants
  let rigs = null;
  const ensureRigs = v => {
    if (rigs) return;
    rigs = v.f.map(f => { const r = tkRig(TK_ROSTER[f.ch] || TK_ROSTER.fondeur); scene.add(r.root); return r; });
  };

  // ---- entrées (mon combattant est toujours à gauche : → = avancer) ----
  let mask = 0, sent = -1, lastSend = 0;
  const KEYMAP = {
    ArrowLeft: 1, KeyA: 1, KeyQ: 1, ArrowRight: 2, KeyD: 2, ArrowUp: 4, KeyW: 4, KeyZ: 4, ArrowDown: 8, KeyS: 8,
    KeyU: 16, Space: 16, KeyI: 32, KeyJ: 64, KeyK: 128, KeyL: 256,
  };
  const pushInput = force => {
    const now = performance.now();
    if (force || mask !== sent || now - lastSend > 200) { send({ t: 'act', a: 'input', k: mask }); sent = mask; lastSend = now; }
  };
  const kd = e => { const b = KEYMAP[e.code]; if (b) { e.preventDefault(); if (!(mask & b)) { mask |= b; pushInput(); } } };
  const ku = e => { const b = KEYMAP[e.code]; if (b) { mask &= ~b; pushInput(); } };
  window.addEventListener('keydown', kd);
  window.addEventListener('keyup', ku);
  pad.querySelectorAll('[data-m]').forEach(btn => {
    const b = +btn.dataset.m;
    btn.addEventListener('pointerdown', e => { e.preventDefault(); mask |= b; btn.classList.add('on'); pushInput(); });
    const up = () => { mask &= ~b; btn.classList.remove('on'); pushInput(); };
    btn.addEventListener('pointerup', up); btn.addEventListener('pointerleave', up); btn.addEventListener('pointercancel', up);
  });

  // ---- réception de l'état ----
  let prev = null, cur = null, curAt = 0, seenEv = 0, shake = 0, banner = '', bannerAt = 0;
  const trail = [100, 100];
  function push(v) {
    ensureRigs(v);
    prev = cur || v; cur = v; curAt = performance.now();
    if (v.banner !== banner) { banner = v.banner; bannerAt = performance.now(); if (banner) sfx(banner.startsWith('K.O') ? 110 : 520, 0.35, 'square', 0.06, banner.startsWith('K.O') ? -50 : 220); }
    for (const e of v.ev) {
      if (e.id <= seenEv) continue;
      seenEv = e.id;
      if (e.k === 'hit') { burst(e.x, e.y, e.z, e.big ? 60 : 30, '#ffb347', e.big ? 420 : 300); shake = e.big ? 0.3 : 0.12; sfx(e.big ? 100 : 160, e.big ? 0.18 : 0.1, 'square', 0.08, -60); }
      else if (e.k === 'block') { burst(e.x, e.y, e.z, 16, '#9fdcff', 220); sfx(1300, 0.05, 'triangle', 0.05); }
      else if (e.k === 'grab') { sfx(220, 0.15, 'sawtooth', 0.05); }
      else if (e.k === 'break') { burst(e.x, e.y, e.z, 24, '#ffffff', 260); sfx(900, 0.2, 'triangle', 0.06, 300); toast('Projection dégagée !'); }
      else if (e.k === 'land') { burst(e.x, 10, e.z, 14, '#c4a06e', 160); sfx(70, 0.2, 'sine', 0.08); }
      else if (e.k === 'ko') { shake = 0.6; sfx(55, 0.7, 'sawtooth', 0.08, -20); }
      else if (e.k === 'ult') ultCutIn(screen, e.ch, e.seat === mySeat);
      else if (e.k === 'ulthit') ultScene(screen, e.ch, e.foe, e.dmg, e.seat === mySeat);
      else if (e.k === 'ultmiss') ultMiss(screen);
      else if (e.k === 'combo') { const f = v.f[e.seat]; comboFx(screen, e.name, e.n, (TK_ROSTER[f.ch] || TK_ROSTER.fondeur).color, e.seat === mySeat); shake = 0.5; }
    }
  }

  // ---- rendu ----
  const camPos = new THREE.Vector3(0, 200, 700), camLook = new THREE.Vector3(0, 95, 0);
  let lastW = 0, lastH = 0;
  const stop = loop((dt, tms) => {
    if (!cur || !rigs) return;
    const t = tms / 1000;
    // taille du rendu 3D = taille affichée du HUD
    const cw = hud.clientWidth, ch = hud.clientHeight;
    if (cw && (cw !== lastW || ch !== lastH)) { lastW = cw; lastH = ch; renderer.setSize(cw, ch, false); tcv.style.width = cw + 'px'; tcv.style.height = ch + 'px'; }
    const a = Math.min(1, (performance.now() - curAt) / 34);
    const pos = cur.f.map((f, i) => { const p = prev.f[i] || f; return { x: lerp(p.x, f.x, a), z: lerp(p.z, f.z, a), y: lerp(p.y, f.y, a) }; });
    cur.f.forEach((f, i) => {
      const r = rigs[i], p = pos[i];
      r.root.position.set(p.x, p.y, p.z);
      const yaw = Math.atan2(f.dx, f.dz);
      let dy = yaw - r.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      r.root.rotation.y += dy * Math.min(1, dt * 18);
      tkPose(r, { ...f, y: p.y }, t + i);
      if (f.st === 'attack' && f.an === 'meuleuse' && f.ph < 2 && Math.random() < 0.8) burst(p.x + f.dx * 90, 110, p.z + f.dz * 90, 4, '#ffd27a', 260);
      if (f.st === 'attack' && f.an === 'sable' && f.ph === 1) burst(p.x + f.dx * (60 + Math.random() * 120), 40 + Math.random() * 120, p.z + f.dz * (60 + Math.random() * 120), 6, '#c4a06e', 120);
      if (f.st === 'attack' && f.an === 'coulee' && f.ph === 1) burst(p.x + f.dx * 130, 90, p.z + f.dz * 130, 10, '#ff8a2a', 200);
    });
    // caméra : perpendiculaire à l'axe des combattants, mon combattant à gauche
    const me = pos[mySeat] || pos[0], op = pos[1 - (mySeat < 0 ? 0 : mySeat)] || pos[1];
    let ax = op.x - me.x, az = op.z - me.z; const sep = Math.hypot(ax, az) || 1; ax /= sep; az /= sep;
    const mx = (me.x + op.x) / 2, mz = (me.z + op.z) / 2;
    const dist = Math.max(380, Math.min(950, sep * 0.95 + 300));
    const target = new THREE.Vector3(mx - az * dist, 140 + dist * 0.12, mz + ax * dist);
    camPos.lerp(target, Math.min(1, dt * 4));
    camLook.lerp(new THREE.Vector3(mx, 100, mz), Math.min(1, dt * 6));
    cam.position.copy(camPos);
    if (shake > 0) { shake -= dt; cam.position.x += (Math.random() - 0.5) * 30 * shake; cam.position.y += (Math.random() - 0.5) * 20 * shake; }
    cam.lookAt(camLook);
    // ambiance
    furnace.intensity = 2.0 + Math.sin(t * 7) * 0.25 + Math.random() * 0.15;
    for (let k = 0; k < EMB; k++) { embPos[k * 3 + 1] += 40 * dt * (1 + (k % 3)); if (embPos[k * 3 + 1] > 900) embPos[k * 3 + 1] = 0; }
    embGeo.attributes.position.needsUpdate = true;
    crowd.forEach(p => { p.position.y = Math.max(0, Math.sin(t * 6 + p.userData.ph)) * 8; });
    for (let j = 0; j < SP; j++) {
      if (spLife[j] <= 0) { spPos[j * 3 + 1] = -999; continue; }
      spLife[j] -= dt;
      spVel[j * 3 + 1] -= 900 * dt;
      spPos[j * 3] += spVel[j * 3] * dt; spPos[j * 3 + 1] += spVel[j * 3 + 1] * dt; spPos[j * 3 + 2] += spVel[j * 3 + 2] * dt;
    }
    spGeo.attributes.position.needsUpdate = true;
    renderer.render(scene, cam);

    // ---- HUD (mon combattant à gauche) ----
    g.clearRect(0, 0, W, H);
    const order = mySeat === 1 ? [1, 0] : [0, 1];
    const bw = 380, by = 22;
    order.forEach((idx, side) => {
      const f = cur.f[idx], left = side === 0;
      const x0 = left ? W / 2 - 52 - bw : W / 2 + 52;
      const ratio = Math.max(0, f.hp / f.max);
      trail[side] = Math.max(ratio * 100, trail[side] - dt * 40);
      g.fillStyle = 'rgba(0,0,0,.75)'; g.fillRect(x0 - 3, by - 3, bw + 6, 26);
      g.fillStyle = '#3a0d0d'; g.fillRect(x0, by, bw, 20);
      const tw = bw * trail[side] / 100, hw = bw * ratio;
      g.fillStyle = '#fff'; g.fillRect(left ? x0 + bw - tw : x0, by, tw, 20);
      const hg = g.createLinearGradient(0, by, 0, by + 20);
      hg.addColorStop(0, ratio > 0.3 ? '#ffe07a' : '#ff8a8a'); hg.addColorStop(1, ratio > 0.3 ? '#EC641E' : '#BA2C3A');
      g.fillStyle = hg; g.fillRect(left ? x0 + bw - hw : x0, by, hw, 20);
      const C = TK_ROSTER[f.ch];
      g.font = `900 22px ${DISPLAY}`; g.textAlign = left ? 'left' : 'right'; g.fillStyle = '#fff';
      g.shadowColor = '#000'; g.shadowBlur = 6;
      g.fillText(`${f.n.toUpperCase()}${idx === mySeat ? '  (TOI)' : ''}`, left ? x0 : x0 + bw, by + 46);
      g.font = '600 13px Archivo, sans-serif'; g.fillStyle = C.color === '#2E3238' ? '#c6cad0' : C.color;
      g.fillText(`${C.name} · ${C.title}`, left ? x0 : x0 + bw, by + 64);
      g.shadowBlur = 0;
      // jauge d'énergie de l'attaque ultime
      const ew = 220, ex = left ? x0 + bw - ew : x0, ey = by + 72, en = Math.min(100, f.m || 0), full = en >= 100;
      g.fillStyle = 'rgba(0,0,0,.7)'; g.fillRect(ex - 2, ey - 2, ew + 4, 12);
      const eg = g.createLinearGradient(ex, 0, ex + ew, 0); eg.addColorStop(0, '#2b6cb0'); eg.addColorStop(1, full ? '#fff3c0' : '#7fd4ff');
      g.fillStyle = eg; g.fillRect(left ? ex + ew - ew * en / 100 : ex, ey, ew * en / 100, 8);
      g.font = '400 8px "Press Start 2P", monospace'; g.textAlign = left ? 'right' : 'left';
      g.fillStyle = full ? (Math.sin(tms / 90) > 0 ? '#fff3c0' : '#7fd4ff') : '#9aa0a6';
      g.fillText(full ? `ULTIME PRÊTE${idx === mySeat ? ' (L)' : ''}` : 'ÉNERGIE', left ? x0 + bw : x0, ey + 22);
      for (let r = 0; r < cur.toWin; r++) {
        const px = left ? x0 + bw - 14 - r * 22 : x0 + 4 + r * 22;
        g.fillStyle = r < f.w ? '#F5B700' : 'rgba(255,255,255,.18)';
        g.beginPath(); g.moveTo(px + 3, by + 30); g.lineTo(px + 15, by + 30); g.lineTo(px + 18, by + 40); g.lineTo(px, by + 40); g.fill();
      }
      if (f.cb >= 2) { g.font = `900 ${30 + Math.min(10, f.cb) * 2}px ${DISPLAY}`; g.fillStyle = '#F5B700'; g.textAlign = left ? 'left' : 'right'; g.shadowColor = '#000'; g.shadowBlur = 8; g.fillText(`${f.cb} COUPS !`, left ? 30 : W - 30, 160); g.shadowBlur = 0; }
    });
    g.fillStyle = 'rgba(0,0,0,.8)'; g.fillRect(W / 2 - 40, 12, 80, 50);
    g.strokeStyle = '#F5B700'; g.lineWidth = 2; g.strokeRect(W / 2 - 40, 12, 80, 50);
    g.font = '400 22px "Press Start 2P", monospace'; g.textAlign = 'center'; g.fillStyle = cur.timer <= 10 ? '#ff6b6b' : '#fff';
    g.fillText(String(cur.timer).padStart(2, '0'), W / 2, 50);
    if (banner) {
      const age = (performance.now() - bannerAt) / 1000, sc = Math.min(1, age * 6);
      g.save(); g.translate(W / 2, H / 2 - 30); g.scale(sc, sc);
      g.font = `900 96px ${DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 10; g.strokeStyle = '#000'; g.strokeText(banner, 0, 0);
      const bgr = g.createLinearGradient(0, -40, 0, 40); bgr.addColorStop(0, '#fff3c0'); bgr.addColorStop(0.5, '#F5B700'); bgr.addColorStop(1, '#EC641E');
      g.fillStyle = bgr; g.fillText(banner, 0, 0);
      g.restore();
    }
    pushInput(false);
  });

  return {
    push,
    stop() {
      stop();
      unGuide();
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      renderer.dispose();
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); });
    },
  };
}
