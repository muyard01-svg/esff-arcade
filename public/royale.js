/* Coulée Royale — FPS / TPS battle royale des métiers de la métallurgie (simulation serveur : royale.py)
   Vue à la 1re personne (arme en main) ou à la 3e personne par-dessus l'épaule, bascule avec V et ondulation.
   Personnages articulés (squelette animé), vraie physique de déplacement prédite dans le navigateur
   et vérifiée par le serveur. Au sol : uniquement des armes à looter. */
'use strict';

const RY_METIERS = {
  forgeron: { name: 'Forgeron', color: '#BA2C3A', perk: '+15 % de dégâts en mêlée', hat: '#F5B700' },
  fondeur: { name: 'Fondeur', color: '#EC641E', perk: '-40 % de dégâts dans la fonte', hat: '#c9ccd1' },
  mouleur: { name: 'Mouleur', color: '#8A8D91', perk: '+8 % de vitesse', hat: '#4a4e54' },
  noyauteur: { name: 'Noyauteur', color: '#C4A06E', perk: 'saute 20 % plus haut', hat: '#f2f4f7' },
  ebarbeur: { name: 'Ébarbeur', color: '#2E3238', perk: 'cadence de tir +12 %', hat: '#1b1d20' },
  lamineur: { name: 'Lamineur', color: '#5AA8FF', perk: 'commence avec 35 d\'armure', hat: '#F5B700' },
  chaudronnier: { name: 'Chaudronnier', color: '#7FD48A', perk: '-12 % de dégâts reçus', hat: '#6b3a1e' },
  soudeur: { name: 'Soudeur', color: '#F5B700', perk: '+20 % au chalumeau et à la louche', hat: '#2b2e33' },
  metallurgiste: { name: 'Métallurgiste', color: '#C77DFF', perk: 'voit les armes rares sur la mini-carte', hat: '#ffffff' },
};
const RY_RARITY = [
  { name: 'commun', color: '#b8bcc2' }, { name: 'rare', color: '#5AA8FF' }, { name: 'épique', color: '#C77DFF' }, { name: 'légendaire', color: '#F5B700' },
];
const RY_WEAPONS = {
  poings: 'Poings', pince: 'Pince de forgeron', marteau: 'Marteau de forge', masse: 'Masse à frapper', ringard: 'Ringard',
  riveteuse: 'Riveteuse', grenaille: 'Canon à grenaille', louche: 'Louche de fonte', chalumeau: 'Chalumeau',
};
const RY_GUNS = ['riveteuse', 'grenaille', 'louche', 'chalumeau'];

ONLINE.unshift({
  id: 'royale', title: 'Coulée Royale', tone: '#EC641E', label: 'FPS battle royale · jusqu\'à 16', tag: 'BATTLE ROYALE',
  pitch: 'FPS à la 1re ou 3e personne : forgerons, fondeurs, soudeurs… tous les métiers de la métallurgie s\'affrontent dans une halle de fonderie que la fonte envahit. Saute du pont roulant, plane jusqu\'au sol, loote les armes, récolte bois, brique et acier pour bâtir murs, rampes et planchers. Le dernier debout gagne.',
  how: '<b>ZQSD / WASD</b> se déplacer · <b>Maj</b> sprinter · <b>Espace</b> sauter · <b>souris</b> viser (clique dans le jeu pour la capturer) · <b>clic</b> frapper / tirer · <b>E</b> échanger avec l\'arme au sol · <b>1 / 2</b>, <b>Tab</b> ou <b>molette</b> changer d\'arme · <b>V</b> 1re / 3e personne. <b>Construction</b> : <b>3</b> mur, <b>4</b> rampe, <b>5</b> plancher (ou <b>B</b>), clic pour poser, <b>X</b> change de matériau, <b>1 / 2</b> reprend les armes. Frappe le décor en mêlée pour récolter bois, brique et acier. Au départ, <b>Espace</b> pour sauter du pont roulant. Tir à la tête x1,5, chaque élimination rend 25 PV.',
});
HANDLERS.royale = () => updateRoyale();

/* choix du métier dans le salon */
function renderMetierPick(box, descEl) {
  if (!save.metier || !RY_METIERS[save.metier]) save.metier = 'fondeur';
  box.innerHTML = Object.entries(RY_METIERS).map(([id, m]) => `<button data-m="${id}" style="--tone:${m.color === '#2E3238' ? '#9aa0a6' : m.color}" class="ry-pick ${id === save.metier ? 'on' : ''}"><i style="background:${m.color}"></i><b>${m.name}</b></button>`).join('');
  const paint = () => { descEl.innerHTML = `<b>${RY_METIERS[save.metier].name}</b> · ${RY_METIERS[save.metier].perk}`; };
  paint();
  box.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => {
    save.metier = b.dataset.m; persist();
    box.querySelectorAll('[data-m]').forEach(x => x.classList.toggle('on', x === b)); paint(); SFX.tick();
  }));
}

let ryClient = null;
function stopRoyale() { if (ryClient && ryClient !== 'loading') ryClient.stop(); ryClient = null; }

function updateRoyale() {
  if (!trackInfo || !trackInfo.map) return;
  if (view.finished) {
    if (ryClient && ryClient !== 'loading' && !ryClient.endShown) { ryClient.push(view); ryClient.endShown = true; setTimeout(() => updateRoyale(), 2600); return; }
    if (document.getElementById('rewardBox')) return;
    stopRoyale();
    resultScreen(view.finished.slice(0, 10).map((i, k) => {
      const p = view.p[i], m = RY_METIERS[p.m];
      return `<li><b>${k + 1}</b><i style="background:${m.color}"></i><span>${esc(p.n)} · ${m.name}${i === mySeat ? ' (toi)' : ''}</span><em>${p.k} élimination${p.k > 1 ? 's' : ''}</em></li>`;
    }));
    return;
  }
  if (!ryClient) {
    ryClient = 'loading';
    stage.innerHTML = '<div class="screen"><p>Chargement de la halle de coulée 3D…</p></div>';
    loadThree().then(() => { if (ryClient === 'loading' && onlineKind === 'royale') { ryClient = startRoyaleClient(); ryClient.push(view); } })
      .catch(e => { ryClient = null; toast(e.message); });
    return;
  }
  if (ryClient !== 'loading') ryClient.push(view);
}

/* ---------- modèles 3D des armes (construits le long de +Z, poignée à l'origine) ---------- */
const ryMats = {};
function ryMat(color, extra) {
  const key = color + JSON.stringify(extra || {});
  if (!ryMats[key]) {
    const m = ryMats[key] = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1, ...(extra || {}) });
    m.color.convertSRGBToLinear(); m.emissive.convertSRGBToLinear();   // couleurs fidèles avec la sortie sRGB
  }
  return ryMats[key];
}
function ryWeaponModel(wid, rar) {
  const g = new THREE.Group();
  const accent = ryMat(RY_RARITY[rar || 0].color, { emissive: RY_RARITY[rar || 0].color, emissiveIntensity: rar >= 2 ? 0.6 : 0.25, metalness: 0.5 });
  const steel = ryMat('#6a6f77', { metalness: 0.75, roughness: 0.35 }), dark = ryMat('#2b2e33', { metalness: 0.5, roughness: 0.5 }), wood = ryMat('#7a5434');
  const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); g.add(m); return m; };
  const rod = (r, len, mat, z, y = 0, r2 = r) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r2, len, 8), mat); m.rotation.x = Math.PI / 2; m.position.set(0, y, z); g.add(m); return m; };
  switch (wid) {
    case 'marteau': rod(1.6, 40, wood, 14); box(8, 9, 20, steel, 0, 0, 36).rotation.x = Math.PI / 2; box(8.4, 2.5, 9.4, accent, 0, 0, 30); break;
    case 'masse': rod(2, 54, wood, 20); box(13, 14, 26, dark, 0, 0, 50).rotation.x = Math.PI / 2; box(13.4, 3, 14.4, accent, 0, 0, 42); break;
    case 'pince': { const a = box(1.6, 2.2, 38, dark, -1.6, 0, 16); a.rotation.y = 0.05; const b = box(1.6, 2.2, 38, dark, 1.6, 0, 16); b.rotation.y = -0.05; box(5, 4, 4, accent, 0, 0, 4); break; }
    case 'ringard': rod(1.2, 92, steel, 40); box(2, 9, 2, steel, 0, -3.5, 86); box(3, 3, 8, accent, 0, 0, 0); break;
    case 'riveteuse': box(7, 11, 26, ryMat('#2b6cb0', { metalness: 0.3 }), 0, 3, 8); rod(1.8, 14, steel, 26, 5); box(5, 12, 6, dark, 0, -6, 0); box(7.4, 2.5, 10, accent, 0, 9, 8); break;
    case 'grenaille': box(9, 9, 34, dark, 0, 3, 10); rod(4.4, 10, steel, 30, 3, 3.4); box(7, 10, 14, wood, 0, 0, -10); box(5, 10, 5, wood, 0, -6, 1); box(9.4, 2.5, 8, accent, 0, 8, 14); break;
    case 'louche': {
      rod(1.4, 44, steel, 18);
      const bowl = new THREE.Mesh(new THREE.SphereGeometry(9, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), dark); bowl.position.set(0, 0, 46); g.add(bowl);
      const lava = new THREE.Mesh(new THREE.CircleGeometry(8, 12), new THREE.MeshBasicMaterial({ color: '#ffb347' })); lava.rotation.x = -Math.PI / 2; lava.position.set(0, -0.5, 46); g.add(lava);
      box(3.4, 3.4, 6, accent, 0, 0, 2); break;
    }
    case 'chalumeau': rod(5, 18, ryMat('#BA2C3A', { metalness: 0.3 }), 4, -4); rod(1.2, 30, steel, 20, 3); box(4, 4, 4, dark, 0, 3, 34); box(10.4, 2.5, 6, accent, 0, -4, 4); break;
    default: break;
  }
  return g;
}

/* ---------- squelette d'un ouvrier (environ 104 unités de haut, regarde vers +Z) ---------- */
function ryRig(metier) {
  const M = RY_METIERS[metier] || RY_METIERS.fondeur;
  const suit = ryMat(M.color), suitD = ryMat(shade(M.color, -0.3)), skin = ryMat('#e0a77d'), pants = ryMat('#2b2e33'), boot = ryMat('#111214'), glove = ryMat('#b07a45');
  const limb = (len, r, mat) => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.85, len, 8), mat); m.position.y = -len / 2;
    const j = new THREE.Mesh(new THREE.SphereGeometry(r * 1.05, 8, 6), mat);
    g.add(m, j);
    return g;
  };
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);          // pivot de la chute
  const hips = new THREE.Group(); hips.position.y = 50; body.add(hips);
  hips.add(new THREE.Mesh(new THREE.BoxGeometry(26, 11, 16), pants));
  const torso = new THREE.Group(); hips.add(torso);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(30, 36, 18), suit); chest.position.y = 19; torso.add(chest);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(30.6, 5, 18.6), suitD); belt.position.y = 3; torso.add(belt);
  if (metier === 'fondeur' || metier === 'forgeron' || metier === 'soudeur') {   // tablier
    const ap = new THREE.Mesh(new THREE.BoxGeometry(22, 40, 2), metier === 'fondeur' ? ryMat('#c9ccd1', { metalness: 0.7, roughness: 0.3 }) : ryMat('#6b4227'));
    ap.position.set(0, 10, 10); torso.add(ap);
  }
  const logo = new THREE.Mesh(new THREE.RingGeometry(3, 4.6, 16), new THREE.MeshBasicMaterial({ color: '#ffffff' })); logo.position.set(-7, 28, 9.2); torso.add(logo);
  const head = new THREE.Group(); head.position.y = 37; torso.add(head);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.5, 6, 8), skin); neck.position.y = 2; head.add(neck);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(9, 14, 10), skin); skull.position.y = 10; head.add(skull);
  const eyeM = ryMat('#111');
  [-3.5, 3.5].forEach(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(1.2, 6, 6), eyeM); e.position.set(x, 11, 8.3); head.add(e); });
  if (metier === 'soudeur') {
    const mask = new THREE.Mesh(new THREE.BoxGeometry(17, 14, 6), ryMat(M.hat, { metalness: 0.4 })); mask.position.set(0, 11, 8); head.add(mask);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(11, 3.5, 1), ryMat('#3a8a5a', { emissive: '#1a4a2a' })); glass.position.set(0, 12, 11.2); head.add(glass);
  } else {
    const helm = new THREE.Mesh(new THREE.SphereGeometry(10.5, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), ryMat(M.hat, { metalness: metier === 'fondeur' ? 0.7 : 0.15, roughness: 0.4 }));
    helm.position.y = 11; head.add(helm);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(14, 1.6, 6), helm.material); brim.position.set(0, 12, 10); head.add(brim);
    if (metier === 'fondeur') { const visor = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 1.5), ryMat('#f5b700', { metalness: 0.8, roughness: 0.2, emissive: '#3a2a00' })); visor.position.set(0, 9, 9.6); head.add(visor); }
  }
  const arm = side => {
    const sh = new THREE.Group(); sh.position.set(side * 18.5, 32, 0); torso.add(sh);
    sh.add(limb(18, 5, suit));
    const el = new THREE.Group(); el.position.y = -18; sh.add(el);
    el.add(limb(17, 4.4, suit));
    const hand = new THREE.Group(); hand.position.y = -19; el.add(hand);
    hand.add(new THREE.Mesh(new THREE.SphereGeometry(4.8, 8, 6), glove));
    return { sh, el, hand };
  };
  const leg = side => {
    const hp = new THREE.Group(); hp.position.set(side * 7.5, -3, 0); hips.add(hp);
    hp.add(limb(22, 6.4, pants));
    const kn = new THREE.Group(); kn.position.y = -22; hp.add(kn);
    kn.add(limb(20, 5.4, pants));
    const b = new THREE.Mesh(new THREE.BoxGeometry(10, 8, 17), boot); b.position.set(0, -21, 3.5); kn.add(b);
    return { hp, kn };
  };
  const L = { arm: arm(-1), leg: leg(-1) }, R = { arm: arm(1), leg: leg(1) };
  // couverture aluminisée qui sert de voile pendant le largage
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(70, 16, 6, 0, Math.PI * 2, 0, Math.PI * 0.32), ryMat('#d8dde3', { metalness: 0.9, roughness: 0.25, side: THREE.DoubleSide }));
  canopy.position.y = 120; canopy.visible = false; root.add(canopy);
  return { root, body, hips, torso, head, L, R, canopy, weapon: null, wkey: '', phase: Math.random() * 6, hitT: 0, shotT: 0, swingT: 0, dieT: 0, fallDir: 1 };
}

/* pose procédurale : marche/course selon la vitesse réelle, saut, visée haut/bas, coups, recul, chute */
function ryPose(rig, st, dt) {
  const { hips, torso, head, L, R } = rig;
  const sp = Math.min(1.4, st.speed / 240);
  rig.phase += st.speed * dt / 26;
  const s = Math.sin(rig.phase), c = Math.cos(rig.phase);
  const air = st.air;
  const legAmp = air ? 0 : 0.75 * sp;
  L.leg.hp.rotation.x = air ? -0.9 : -s * legAmp;
  R.leg.hp.rotation.x = air ? -0.2 : s * legAmp;
  L.leg.kn.rotation.x = air ? 1.3 : Math.max(0, c) * 1.1 * sp + 0.05;
  R.leg.kn.rotation.x = air ? 0.5 : Math.max(0, -c) * 1.1 * sp + 0.05;
  hips.position.y = 50 - Math.abs(c) * 2.5 * sp - (air ? 4 : 0);
  hips.rotation.y = s * 0.12 * sp;
  torso.rotation.y = -s * 0.1 * sp;
  // le buste suit la visée, avec un penché en avant à la course
  const lean = sp > 1.1 ? 0.18 : sp * 0.08;
  torso.rotation.x = lean - st.pitch * 0.35;
  head.rotation.x = -st.pitch * 0.45;
  torso.rotation.z = rig.hitT > 0 ? Math.sin(rig.hitT * 40) * 0.12 : 0;
  rig.hitT = Math.max(0, rig.hitT - dt);
  // bras
  const kind = st.wid === 'poings' ? 'fist' : RY_GUNS.includes(st.wid) ? 'gun' : 'melee';
  const aim = -Math.PI / 2 - st.pitch * 0.65 + lean;
  rig.shotT = Math.max(0, rig.shotT - dt);
  rig.swingT = Math.max(0, rig.swingT - dt);
  const sw = rig.swingT > 0 ? 1 - rig.swingT / 0.3 : -1;    // 0 → 1 pendant le coup
  if (kind === 'gun') {
    R.arm.sh.rotation.set(aim + rig.shotT * 2, 0, 0.1); R.arm.el.rotation.x = -0.15;
    L.arm.sh.rotation.set(aim + 0.15, 0, -0.55); L.arm.el.rotation.x = -0.9;
  } else if (kind === 'melee') {
    if (sw >= 0) { R.arm.sh.rotation.set(-2.7 + sw * 2.6, 0, 0.2); R.arm.el.rotation.x = -0.4 + sw * 0.3; }
    else { R.arm.sh.rotation.set(-0.9 - st.pitch * 0.4 + s * 0.15 * sp, 0, 0.15); R.arm.el.rotation.x = -1.3; }
    L.arm.sh.rotation.set(s * 0.7 * sp - 0.2, 0, -0.15); L.arm.el.rotation.x = -0.5;
  } else {   // poings : garde de boxeur, direct du droit
    const punch = sw >= 0 ? Math.sin(sw * Math.PI) : 0;
    R.arm.sh.rotation.set(-1.1 - punch * 0.5 - st.pitch * 0.4, 0, 0.25); R.arm.el.rotation.x = -1.9 + punch * 1.7;
    L.arm.sh.rotation.set(-1.1 - st.pitch * 0.4, 0, -0.25); L.arm.el.rotation.x = -1.9;
  }
  if (st.weaponObj) st.weaponObj.rotation.x = kind === 'gun' ? Math.PI / 2 : 0;
  rig.canopy.visible = !!st.glide;
  if (st.hang || st.glide) {   // bras levés : accroché au pont roulant ou à la voile
    const sw = Math.sin(rig.phase * 0.3 + performance.now() / 400) * 0.15;
    R.arm.sh.rotation.set(-Math.PI + 0.15, 0, 0.25); R.arm.el.rotation.x = -0.1;
    L.arm.sh.rotation.set(-Math.PI + 0.15, 0, -0.25); L.arm.el.rotation.x = -0.1;
    L.leg.hp.rotation.x = sw - 0.1; R.leg.hp.rotation.x = -sw - 0.1; L.leg.kn.rotation.x = 0.3; R.leg.kn.rotation.x = 0.3;
    torso.rotation.x = 0; head.rotation.x = st.hang ? 0.3 : 0.1;
    if (st.weaponObj) st.weaponObj.visible = false;
  } else if (st.weaponObj) st.weaponObj.visible = true;
  // chute à la mort : bascule avec l'accélération de la gravité, puis rebond amorti
  if (st.dead) {
    rig.dieT += dt;
    const k = Math.min(1, rig.dieT * rig.dieT * 3.2);
    rig.body.rotation.x = rig.fallDir * (Math.PI / 2) * k + (k >= 1 ? Math.sin(Math.min(1, rig.dieT - 0.56) * 9) * 0.04 * Math.max(0, 1 - (rig.dieT - 0.56) * 2) : 0);
    rig.body.position.y = 6 * k;
    L.arm.sh.rotation.z = -0.9 * k; R.arm.sh.rotation.z = 0.9 * k;
  } else { rig.dieT = 0; rig.body.rotation.x = 0; rig.body.position.y = 0; }
}

function startRoyaleClient() {
  const W = 960, H = 540;
  const MAP = trackInfo.map, PH = trackInfo.phys;
  const CEIL = MAP.ceil || 700;
  stage.innerHTML = '';
  $('#hudInfo').textContent = 'Battle royale FPS';
  const wrap = document.createElement('div'); wrap.className = 'play-wrap'; stage.appendChild(wrap);
  const screen = document.createElement('div'); screen.className = 'tk-screen ry-screen'; wrap.appendChild(screen);
  const { c: cv, g } = makeCanvas(screen, W, H);
  cv.classList.add('tk-hud');
  const pad = document.createElement('div'); pad.className = 'touch-pad ry-pad';
  pad.innerHTML = `<div class="ry-stick" id="ryMove"><i></i></div>
    <div class="grp"><button data-b="jump">SAUT</button><button data-b="pick">PRENDRE</button><button data-b="swap">ARME</button><button data-b="build">BÂTIR</button><button data-b="mat">MAT.</button><button data-b="view">VUE</button></div>
    <button class="hot ry-fire" data-b="fire">TIR</button>
    <div class="ry-stick" id="ryAim"><i></i></div>`;
  wrap.appendChild(pad);
  const hint = document.createElement('p'); hint.className = 'keys-hint';
  hint.textContent = 'CLIQUE POUR CAPTURER LA SOURIS · ZQSD BOUGER · MAJ SPRINT · ESPACE SAUT · CLIC TIRER · E ÉCHANGER · 1/2 ARME · 3/4/5 MUR/RAMPE/PLANCHER · X MATÉRIAU · V VUE';
  wrap.appendChild(hint);

  /* ---------- collisions (mêmes règles que le serveur) ---------- */
  const CELL = 200, GRID = new Map();
  MAP.obs.forEach(o => {
    for (let gx = Math.floor(o.x / CELL); gx <= Math.floor((o.x + o.w) / CELL); gx++)
      for (let gy = Math.floor(o.y / CELL); gy <= Math.floor((o.y + o.h) / CELL); gy++) {
        const k = gx + ',' + gy; if (!GRID.has(k)) GRID.set(k, []); GRID.get(k).push(o);
      }
  });
  const around = (x, y) => {
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), out = new Set();
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) (GRID.get((cx + a) + ',' + (cy + b)) || []).forEach(o => out.add(o));
    return out;
  };
  const touches = (o, x, y, r) => { const nx = Math.min(Math.max(x, o.x), o.x + o.w), ny = Math.min(Math.max(y, o.y), o.y + o.h); return (x - nx) ** 2 + (y - ny) ** 2 < r * r; };
  // constructions (mêmes règles que royale.py) : tuiles de TILE, étages de LEVEL
  const BT = trackInfo.build || { tile: 150, level: 150, cost: 10, mats: ['bois', 'brique', 'acier'], busZ: 560, busTime: 16 };
  const TILE = BT.tile, LEVEL = BT.level;
  const builds = new Map(), btiles = new Map();
  const bTilesOf = b => b.t === 'mur' ? [[b.gx, b.gy], b.d === 0 ? [b.gx + 1, b.gy] : [b.gx, b.gy + 1]] : [[b.gx, b.gy]];
  const bIndex = (b, add) => bTilesOf(b).forEach(([x, y]) => {
    const k = x + ',' + y;
    if (add) { if (!btiles.has(k)) btiles.set(k, []); btiles.get(k).push(b); }
    else { const l = btiles.get(k); if (l) { const i = l.indexOf(b); if (i >= 0) l.splice(i, 1); } }
  });
  const bNear = (x, y, r = 0) => {
    const out = new Set();
    for (let gx = Math.floor((x - r) / TILE); gx <= Math.floor((x + r) / TILE); gx++)
      for (let gy = Math.floor((y - r) / TILE); gy <= Math.floor((y + r) / TILE); gy++) (btiles.get(gx + ',' + gy) || []).forEach(b => out.add(b));
    return out;
  };
  const pieceBox = b => {
    const x0 = b.gx * TILE, y0 = b.gy * TILE, base = b.lv * LEVEL;
    if (b.t === 'mur') return b.d === 0 ? [x0 + TILE - 5, y0, base, x0 + TILE + 5, y0 + TILE, base + LEVEL] : [x0, y0 + TILE - 5, base, x0 + TILE, y0 + TILE + 5, base + LEVEL];
    if (b.t === 'sol') return [x0, y0, base - 8, x0 + TILE, y0 + TILE, base];
    return [x0, y0, base, x0 + TILE, y0 + TILE, base + LEVEL];
  };
  const rampH = (b, x, y) => {
    const fx = Math.min(1, Math.max(0, (x - b.gx * TILE) / TILE)), fy = Math.min(1, Math.max(0, (y - b.gy * TILE) / TILE));
    return b.lv * LEVEL + LEVEL * [fx, fy, 1 - fx, 1 - fy][b.d];
  };
  const boxTouch = (bx, x, y, r) => { const nx = Math.min(Math.max(x, bx[0]), bx[3]), ny = Math.min(Math.max(y, bx[1]), bx[4]); return (x - nx) ** 2 + (y - ny) ** 2 < r * r; };
  const inTile = (b, x, y) => b.gx * TILE <= x && x <= (b.gx + 1) * TILE && b.gy * TILE <= y && y <= (b.gy + 1) * TILE;
  const groundAt = (x, y, z) => {
    let gz = 0;
    for (const o of around(x, y)) if (o.z <= z + PH.step && o.z > gz && touches(o, x, y, PH.pr * 0.7)) gz = o.z;
    for (const b of bNear(x, y, PH.pr)) {
      if (b.t === 'sol') { const top = b.lv * LEVEL; if (gz < top && top <= z + PH.step && boxTouch(pieceBox(b), x, y, PH.pr * 0.7)) gz = top; }
      else if (b.t === 'rampe' && inTile(b, x, y)) { const h = rampH(b, x, y); if (gz < h && h <= z + PH.step) gz = h; }
    }
    return gz;
  };
  const bodyBlocked = (x, y, z) => {
    if (x < PH.pr || y < PH.pr || x > MAP.w - PH.pr || y > MAP.h - PH.pr) return true;
    for (const o of around(x, y)) if (o.z > z + PH.step && touches(o, x, y, PH.pr - 1)) return true;
    for (const b of bNear(x, y, PH.pr)) if (b.t !== 'rampe') { const bx = pieceBox(b); if (bx[2] < z + PH.body && bx[5] > z + PH.step && boxTouch(bx, x, y, PH.pr - 1)) return true; }
    return false;
  };
  const buildAt = (x, y, z) => {
    for (const b of bNear(x, y)) {
      if (b.t === 'rampe') { if (inTile(b, x, y) && Math.abs(z - rampH(b, x, y)) < 9) return b; }
      else { const bx = pieceBox(b); if (bx[0] <= x && x <= bx[3] && bx[1] <= y && y <= bx[4] && bx[2] <= z && z <= bx[5]) return b; }
    }
    return null;
  };
  const pointBlocked = (x, y, z) => {
    if (x < 0 || y < 0 || x > MAP.w || y > MAP.h || z < 0 || z > CEIL) return true;
    for (const o of (GRID.get(Math.floor(x / CELL) + ',' + Math.floor(y / CELL)) || [])) if (o.x <= x && x <= o.x + o.w && o.y <= y && y <= o.y + o.h && z <= o.z) return true;
    return !!buildAt(x, y, z);
  };
  const segClear = (x1, y1, z1, x2, y2, z2) => {
    const n = Math.floor(Math.hypot(x2 - x1, y2 - y1) / 40) + 1;
    for (let k = 1; k < n; k++) if (pointBlocked(x1 + (x2 - x1) * k / n, y1 + (y2 - y1) * k / n, z1 + (z2 - z1) * k / n)) return false;
    return true;
  };

  /* ---------- mon personnage, prédit localement ---------- */
  const me = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, gd: true, gl: false, yaw: 0, pitch: 0, tp: -1 };
  const myM = () => (trackInfo.metiers || {})[cur && cur.p[mySeat] ? cur.p[mySeat].m : 'fondeur'] || { speed: 1, jump: 1 };
  function physics(wx, wy, run, jump, dt) {
    const M = myM();
    const sp = me.gl ? (PH.glide || 430) : PH.walk * (M.speed || 1) * (run ? PH.sprint : 1);
    const k = Math.min(1, (me.gl ? 3 : me.gd ? PH.accG : PH.accA) * dt);
    me.vx += (wx * sp - me.vx) * k; me.vy += (wy * sp - me.vy) * k;
    if (jump && me.gd) { me.vz = PH.jump * (M.jump || 1); me.gd = false; sfx(220, 0.08, 'triangle', 0.03, 120); }
    me.vz -= PH.grav * dt;
    if (me.gl) me.vz = Math.max(me.vz, -(PH.fall || 200));
    // coincé dans une construction (posée sur soi) : on peut toujours en sortir
    let was = bodyBlocked(me.x, me.y, me.z);
    const ox = me.x; me.x += me.vx * dt; if (!was && bodyBlocked(me.x, me.y, me.z)) { me.x = ox; me.vx = 0; }
    was = bodyBlocked(me.x, me.y, me.z);
    const oy = me.y; me.y += me.vy * dt; if (!was && bodyBlocked(me.x, me.y, me.z)) { me.y = oy; me.vy = 0; }
    const wasAir = !me.gd, fall = me.vz;
    me.z += me.vz * dt;
    const gz = groundAt(me.x, me.y, Math.max(me.z, 0));
    if (me.z <= gz) { me.z = gz; me.vz = 0; me.gd = true; if (me.gl) { me.gl = false; sfx(120, 0.2, 'triangle', 0.05); } if (wasAir && fall < -300) { sfx(90, 0.08, 'triangle', 0.05); landKick = Math.min(1, -fall / 900); } }
    else me.gd = false;
    if (me.z + PH.body > CEIL) { me.z = CEIL - PH.body; me.vz = Math.min(0, me.vz); }
  }

  let mode = save.ryView === 'tps' ? 'tps' : 'fps';
  let prev = null, cur = null, curAt = 0, prevAt = 0, seenEv = 0;
  let loot = [];
  const floats = [], feed = [], dmgDirs = [];
  let shake = 0, banner = '', bannerAt = 0, hitMark = 0, hitHead = false, landKick = 0, recoil = 0, swingVm = 0, bob = 0, stepAcc = 0;
  let swayX = 0, swayY = 0;
  let build = null, lastPiece = 'mur', matSel = 0, placeHeld = false, lastPlace = 0;
  const PIECES = { mur: 'MUR', rampe: 'RAMPE', sol: 'PLANCHER' };
  const MAT_COL = { bois: '#c08a4c', brique: '#c4553a', acier: '#9aa4ae' };
  const setBuild = b => { build = b; if (b) lastPiece = b; fireHeld = false; sendInput(true); SFX.tick(); };

  /* ---------- entrées ---------- */
  const B = { FIRE: 16, PICK: 32, SWAP: 64, JUMP: 128, RUN: 256 };
  const held = new Set();
  let fireHeld = false, jumpQueued = false, mask = 0, lastSend = 0, sentMask = -1, touchMove = null, touchLook = null;
  const pressBits = { v: 0 };
  const isTouch = matchMedia('(pointer: coarse)').matches;
  const tap = bit => { pressBits.v |= bit; sendInput(true); };
  function sendInput(force) {
    const now = performance.now();
    const live = cur && cur.phase === 'play' && cur.p[mySeat] && cur.p[mySeat].al && !cur.p[mySeat].bu;
    mask = (fireHeld && !build ? B.FIRE : 0) | (held.has('ShiftLeft') || held.has('ShiftRight') ? B.RUN : 0) | pressBits.v;
    if (!force && mask === sentMask && now - lastSend < 50) return;
    const msg = { t: 'act', a: 'input', k: mask, yaw: +me.yaw.toFixed(3), pitch: +me.pitch.toFixed(3), tp: me.tp };
    if (live) msg.pos = [+me.x.toFixed(1), +me.y.toFixed(1), +me.z.toFixed(1), Math.round(me.vz)];
    send(msg);
    sentMask = mask; lastSend = now;
    if (pressBits.v) { pressBits.v = 0; setTimeout(() => sendInput(true), 70); }
  }
  const MOVE = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'];
  const kd = e => {
    if (e.code === 'KeyV' && !e.repeat) { e.preventDefault(); toggleView(); return; }
    if (MOVE.includes(e.code)) { e.preventDefault(); held.add(e.code); return; }
    if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) jumpQueued = true; return; }
    if (e.repeat) return;
    if (e.code === 'KeyE') { e.preventDefault(); tap(B.PICK); }
    else if (e.code === 'Tab') { e.preventDefault(); tap(B.SWAP); }
    else if (e.code === 'Digit1' || e.code === 'Digit2') { if (build) setBuild(null); const want = e.code === 'Digit1' ? 0 : 1; const p = cur && cur.p[mySeat]; if (p && p.c !== want) tap(B.SWAP); }
    else if (e.code === 'Digit3') setBuild('mur');
    else if (e.code === 'Digit4') setBuild('rampe');
    else if (e.code === 'Digit5') setBuild('sol');
    else if (e.code === 'KeyB') setBuild(build ? null : lastPiece);
    else if (e.code === 'KeyX') { matSel = (matSel + 1) % 3; SFX.tick(); }
  };
  const ku = e => { held.delete(e.code); };
  // Échap sert d'abord à libérer la souris : on ne ferme pas la borne dans la foulée
  let unlockAt = 0;
  const escGuard = e => { if (e.key === 'Escape' && (document.pointerLockElement || performance.now() - unlockAt < 400)) e.stopImmediatePropagation(); };
  const onLockChange = () => { if (document.pointerLockElement !== screen) unlockAt = performance.now(); };
  window.addEventListener('keydown', escGuard, true);
  window.addEventListener('keydown', kd);
  window.addEventListener('keyup', ku);
  document.addEventListener('pointerlockchange', onLockChange);
  const blur = () => { held.clear(); fireHeld = false; };
  window.addEventListener('blur', blur);
  const SENS = 0.0024;
  const look = (dx, dy) => {
    me.yaw = Math.atan2(Math.sin(me.yaw + dx * SENS), Math.cos(me.yaw + dx * SENS));
    me.pitch = Math.max(-1.35, Math.min(1.35, me.pitch - dy * SENS));
    swayX = Math.max(-1, Math.min(1, swayX + dx * 0.004)); swayY = Math.max(-1, Math.min(1, swayY + dy * 0.004));
  };
  let dragging = false;
  screen.addEventListener('mousedown', e => {
    if (document.pointerLockElement !== screen && !isTouch) {
      try { const r = screen.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (_) { /* pas de capture possible : on vise en glissant */ }
      dragging = true;
    }
    if (e.button === 0 || document.pointerLockElement === screen) { if (build) { placeHeld = true; lastPlace = 0; } else { fireHeld = true; sendInput(true); } }
  });
  const onMove = e => { if (document.pointerLockElement === screen || dragging) look(e.movementX || 0, e.movementY || 0); };
  const onUp = e => { if (e.pointerType === 'touch') return; dragging = false; placeHeld = false; if (fireHeld && !touchFire) { fireHeld = false; sendInput(true); } };
  document.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  screen.addEventListener('wheel', e => {
    e.preventDefault();
    if (build) { const order = ['mur', 'rampe', 'sol']; setBuild(order[(order.indexOf(build) + (e.deltaY > 0 ? 1 : 2)) % 3]); } else tap(B.SWAP);
  }, { passive: false });
  screen.addEventListener('contextmenu', e => e.preventDefault());
  // tactile : joystick de déplacement, joystick de visée, boutons
  let touchFire = false;
  const stick = (el, onMove) => {
    const knob = el.querySelector('i');
    let id = null, cx = 0, cy = 0;
    el.addEventListener('pointerdown', e => { e.preventDefault(); id = e.pointerId; el.setPointerCapture(id); const r = el.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; mv(e); });
    const mv = e => {
      if (e.pointerId !== id) return;
      const dx = e.clientX - cx, dy = e.clientY - cy, d = Math.min(1, Math.hypot(dx, dy) / 40);
      const a = Math.atan2(dy, dx);
      knob.style.transform = `translate(${Math.cos(a) * d * 26}px, ${Math.sin(a) * d * 26}px)`;
      onMove(d > 0.15 ? { x: Math.cos(a) * d, y: Math.sin(a) * d } : null);
    };
    el.addEventListener('pointermove', mv);
    const up = e => { if (e.pointerId !== id) return; id = null; knob.style.transform = ''; onMove(null); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  };
  stick(pad.querySelector('#ryMove'), v => { touchMove = v; });
  stick(pad.querySelector('#ryAim'), v => { touchLook = v; });
  pad.querySelectorAll('[data-b]').forEach(b => {
    b.addEventListener('pointerdown', e => {
      e.preventDefault();
      const k = b.dataset.b;
      if (k === 'pick') tap(B.PICK); else if (k === 'swap') tap(B.SWAP); else if (k === 'view') toggleView();
      else if (k === 'jump') jumpQueued = true;
      else if (k === 'build') { const order = [null, 'mur', 'rampe', 'sol']; setBuild(order[(order.indexOf(build) + 1) % 4]); b.textContent = build ? PIECES[build] : 'BÂTIR'; }
      else if (k === 'mat') { matSel = (matSel + 1) % 3; SFX.tick(); }
      else if (k === 'fire') { if (build) { placeHeld = true; lastPlace = 0; } else { touchFire = fireHeld = true; sendInput(true); } b.classList.add('on'); }
    });
    if (b.dataset.b === 'fire') ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => b.addEventListener(ev, () => { placeHeld = false; touchFire = fireHeld = false; b.classList.remove('on'); sendInput(true); }));
  });

  function toggleView() {
    mode = mode === 'fps' ? 'tps' : 'fps';
    save.ryView = mode; persist();
    fxWarp(screen, 'switch');
    toast(mode === 'fps' ? 'Vue 1re personne' : 'Vue 3e personne');
  }

  /* ---------- rendu three.js ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.autoClear = false;
  const canvas = renderer.domElement; canvas.className = 'tk-3d'; canvas.dataset.overlay = '1';
  screen.insertBefore(canvas, cv);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1a120d');
  scene.fog = new THREE.Fog('#1a120d', 700, 2900);
  const cam = new THREE.PerspectiveCamera(72, W / H, 2, 3400);
  scene.add(new THREE.HemisphereLight('#ffe8d0', '#3a1c0c', 0.85));
  const sun = new THREE.DirectionalLight('#ffd8b0', 0.55); sun.position.set(0.4, 1, 0.25); scene.add(sun);
  // sol de béton, allées jaunes, taches d'huile
  const floorTex = tkTexture(1100, 750, (b, w, h) => {
    const k = w / MAP.w;
    b.fillStyle = '#4a4440'; b.fillRect(0, 0, w, h);
    for (let x = 0; x < MAP.w; x += 200) for (let y = 0; y < MAP.h; y += 200) { b.fillStyle = `rgba(0,0,0,${0.03 + ((x * 7 + y * 13) % 5) * 0.015})`; b.fillRect(x * k + 1, y * k + 1, 200 * k - 2, 200 * k - 2); }
    for (let i = 0; i < 260; i++) { b.fillStyle = `rgba(20,14,10,${0.08 + Math.random() * 0.12})`; b.beginPath(); b.ellipse(Math.random() * w, Math.random() * h, 3 + Math.random() * 14, 2 + Math.random() * 8, Math.random() * 3, 0, Math.PI * 2); b.fill(); }
    b.strokeStyle = 'rgba(245,183,0,.75)'; b.lineWidth = 3; b.setLineDash([16, 10]);
    [[0, 1100, MAP.w, 1100], [0, 1900, MAP.w, 1900], [800, 0, 800, MAP.h], [3500, 0, 3500, MAP.h]].forEach(([a, c, d, e]) => { b.beginPath(); b.moveTo(a * k, c * k); b.lineTo(d * k, e * k); b.stroke(); });
    b.setLineDash([]);
    b.font = `900 ${Math.round(120 * k * 3)}px "Big Shoulders Display", Impact`; b.fillStyle = 'rgba(255,255,255,.09)'; b.textAlign = 'center';
    b.fillText('ESFF · HALLE DE COULÉE 101', w / 2, h / 2 + 330 * k);
  });
  floorTex.anisotropy = 4;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(MAP.w, MAP.h), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.92 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(MAP.w / 2, 0, MAP.h / 2); scene.add(floor);
  // toiture : tôle sombre, fermes métalliques et verrières
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(MAP.w, MAP.h), new THREE.MeshStandardMaterial({ color: '#221c19', roughness: 1 }));
  roof.rotation.x = Math.PI / 2; roof.position.set(MAP.w / 2, CEIL, MAP.h / 2); scene.add(roof);
  const beamMat = ryMat('#3a3d42', { metalness: 0.6, roughness: 0.5 }), skyMat = new THREE.MeshBasicMaterial({ color: '#c9d6e0' });
  for (let x = 300; x < MAP.w; x += 600) {
    const bm = new THREE.Mesh(new THREE.BoxGeometry(24, 40, MAP.h), beamMat); bm.position.set(x, CEIL - 20, MAP.h / 2); scene.add(bm);
    const sk = new THREE.Mesh(new THREE.PlaneGeometry(180, MAP.h - 400), skyMat); sk.rotation.x = Math.PI / 2; sk.position.set(x + 300, CEIL - 1, MAP.h / 2); scene.add(sk);
  }
  // obstacles avec textures dessinées
  const T = {
    conteneur: tkTexture(256, 128, (b, w, h) => { b.fillStyle = '#9e2430'; b.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 16) { b.fillStyle = 'rgba(255,255,255,.08)'; b.fillRect(x, 0, 6, h); b.fillStyle = 'rgba(0,0,0,.2)'; b.fillRect(x + 8, 0, 4, h); } b.fillStyle = 'rgba(255,255,255,.65)'; b.font = '900 22px Archivo, sans-serif'; b.fillText('ESFF 101', 18, 40); b.fillStyle = 'rgba(0,0,0,.25)'; b.fillRect(0, h - 8, w, 8); }),
    moules: tkTexture(128, 128, (b, w, h) => { b.fillStyle = '#8b6a46'; b.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 32) { b.fillStyle = 'rgba(0,0,0,.28)'; b.fillRect(0, y, w, 3); b.fillStyle = 'rgba(255,230,190,.12)'; b.fillRect(0, y + 3, w, 3); } for (let i = 0; i < 300; i++) { b.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,240,210'},.08)`; b.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }),
    mur: tkTexture(256, 256, (b, w, h) => { b.fillStyle = '#5c6067'; b.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 12) { b.fillStyle = 'rgba(255,255,255,.06)'; b.fillRect(x, 0, 5, h); b.fillStyle = 'rgba(0,0,0,.15)'; b.fillRect(x + 6, 0, 3, h); } b.fillStyle = '#3a3634'; b.fillRect(0, h - 40, w, 40); b.fillStyle = '#F5B700'; for (let x = 0; x < w; x += 32) { b.beginPath(); b.moveTo(x, h - 40); b.lineTo(x + 16, h - 40); b.lineTo(x + 8, h - 32); b.fill(); } }),
    bureau: tkTexture(256, 128, (b, w, h) => { b.fillStyle = '#2b4fa8'; b.fillRect(0, 0, w, h); for (let x = 12; x < w; x += 60) { b.fillStyle = '#9fd0ff'; b.fillRect(x, 26, 44, 40); b.fillStyle = 'rgba(255,255,255,.35)'; b.fillRect(x, 26, 44, 6); } b.fillStyle = '#fff'; b.font = '900 18px Archivo'; b.fillText('BUREAUX · LABO', 12, 100); }),
    palette: tkTexture(128, 64, (b, w, h) => { b.fillStyle = '#6b4c2c'; b.fillRect(0, 0, w, h); b.fillStyle = '#a07a4c'; for (let x = 4; x < w; x += 24) b.fillRect(x, 0, 18, h); }),
    convoyeur: tkTexture(128, 64, (b, w, h) => { b.fillStyle = '#26292d'; b.fillRect(0, 0, w, h); b.fillStyle = '#5c6067'; for (let x = 0; x < w; x += 16) b.fillRect(x, 6, 8, h - 12); b.fillStyle = '#F5B700'; b.fillRect(0, 0, w, 4); b.fillRect(0, h - 4, w, 4); }),
  };
  const lights = [];
  const COL = { four: '#3a302a', silo: '#9aa0a6', pilier: '#4a4e54', poche: '#3a3d42' };
  const texMats = new Map();
  for (const o of MAP.obs) {
    const h = o.z;
    const round = ['four', 'silo', 'poche'].includes(o.k);
    let mat;
    if (T[o.k]) {   // une matière par type et par répétition de motif, partagée entre obstacles semblables
      const rx = Math.max(1, Math.round(Math.max(o.w, o.h) / (o.k === 'mur' ? 300 : 120))), ry = o.k === 'mur' ? Math.max(1, Math.round(h / 300)) : 1;
      const key = o.k + rx + 'x' + ry;
      if (!texMats.has(key)) {
        const t = T[o.k].clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
        texMats.set(key, new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, metalness: o.k === 'conteneur' ? 0.3 : 0.05 }));
      }
      mat = texMats.get(key);
    } else mat = ryMat(COL[o.k] || '#555', { metalness: ['silo', 'poche', 'pilier'].includes(o.k) ? 0.6 : 0.1, roughness: o.k === 'silo' ? 0.35 : 0.8 });
    const geo = round ? new THREE.CylinderGeometry(Math.min(o.w, o.h) / 2, Math.min(o.w, o.h) / 2 * (o.k === 'poche' ? 0.78 : 1), h, 24) : new THREE.BoxGeometry(o.w, h, o.h);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(o.x + o.w / 2, h / 2, o.y + o.h / 2);
    scene.add(m);
    if (o.k === 'four' || o.k === 'poche') {
      const top = new THREE.Mesh(new THREE.CircleGeometry(Math.min(o.w, o.h) * 0.38, 20), new THREE.MeshBasicMaterial({ color: '#ffb347' }));
      top.rotation.x = -Math.PI / 2; top.position.set(o.x + o.w / 2, h + 1, o.y + o.h / 2); scene.add(top);
    }
    if (o.k === 'four') {
      const door = new THREE.Mesh(new THREE.PlaneGeometry(50, 40), new THREE.MeshBasicMaterial({ color: '#ff8a2a' })); door.position.set(o.x + o.w / 2, 40, o.y + o.h + 0.5); scene.add(door);
      if (lights.length < 5) { const pl = new THREE.PointLight('#ff7a2a', 1.6, 900, 1.5); pl.position.set(o.x + o.w / 2, h + 80, o.y + o.h / 2); scene.add(pl); lights.push(pl); }
    }
  }
  // la fonte : sol de métal en fusion hors de la zone + mur de chaleur
  const lavaMat = new THREE.MeshBasicMaterial({ color: '#ff6a1a', side: THREE.DoubleSide });
  let lava = null, lavaR = -1;
  const heatWall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 96, 1, true), new THREE.MeshBasicMaterial({ color: '#ff7a2a', transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(heatWall);
  // projectiles et étincelles
  const projMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 600);
  projMesh.count = 0; projMesh.frustumCulled = false; scene.add(projMesh);
  const PCOL = { rivet: new THREE.Color('#ffe07a'), pellet: new THREE.Color('#e8ecf2'), blob: new THREE.Color('#ff9a3a'), flame: new THREE.Color('#ff7a2a') };
  for (let k = 0; k < 600; k++) projMesh.setColorAt(k, PCOL.rivet);   // couleurs par instance dès la compilation du shader
  const NP = 700, pPos = new Float32Array(NP * 3), pCol = new Float32Array(NP * 3), parts = [];
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 5, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  pts.frustumCulled = false; scene.add(pts);
  const tmpC = new THREE.Color();
  const burst = (x, y, z, n, col, spd, life, up = 0) => {
    tmpC.set(col);
    for (let k = 0; k < n; k++) {
      if (parts.length >= NP) parts.shift();
      parts.push({ x, y, z, vx: (Math.random() - 0.5) * spd, vy: (Math.random() - 0.5) * spd, vz: (Math.random() - 0.3) * spd + up, life: life * (0.6 + Math.random() * 0.6), r: tmpC.r, g: tmpC.g, b: tmpC.b });
    }
  };
  const flash = new THREE.PointLight('#ffc070', 0, 380, 2); scene.add(flash);
  // matériaux de construction : planches, briques réfractaires, tôle d'acier (3 niveaux d'usure)
  const BTEX = {
    bois: tkTexture(128, 128, g2 => { g2.fillStyle = '#a07a4c'; g2.fillRect(0, 0, 128, 128); for (let y = 0; y < 128; y += 32) { g2.fillStyle = 'rgba(0,0,0,.35)'; g2.fillRect(0, y, 128, 3); g2.fillStyle = 'rgba(255,230,190,.12)'; g2.fillRect(0, y + 3, 128, 4); } for (let i = 0; i < 40; i++) { g2.strokeStyle = 'rgba(70,40,15,.25)'; g2.beginPath(); const y = Math.random() * 128; g2.moveTo(0, y); g2.bezierCurveTo(40, y + 4, 80, y - 4, 128, y); g2.stroke(); } g2.fillStyle = '#3a3d42'; [[10, 14], [118, 14], [10, 114], [118, 114]].forEach(([x, y]) => g2.fillRect(x - 2, y - 2, 5, 5)); }),
    brique: tkTexture(128, 128, g2 => { g2.fillStyle = '#d8c8b0'; g2.fillRect(0, 0, 128, 128); for (let y = 0; y < 128; y += 21) for (let x = (y / 21 % 2) * 21 - 21; x < 128; x += 42) { g2.fillStyle = `hsl(${8 + Math.random() * 8},${45 + Math.random() * 15}%,${36 + Math.random() * 10}%)`; g2.fillRect(x + 2, y + 2, 38, 17); } }),
    acier: tkTexture(128, 128, g2 => { g2.fillStyle = '#7d868f'; g2.fillRect(0, 0, 128, 128); for (let x = 0; x < 128; x += 16) { g2.fillStyle = 'rgba(255,255,255,.18)'; g2.fillRect(x, 0, 5, 128); g2.fillStyle = 'rgba(0,0,0,.2)'; g2.fillRect(x + 8, 0, 4, 128); } g2.fillStyle = '#F5B700'; g2.fillRect(0, 118, 128, 10); g2.fillStyle = '#1a1a1a'; for (let x = 0; x < 128; x += 20) { g2.beginPath(); g2.moveTo(x, 128); g2.lineTo(x + 10, 118); g2.lineTo(x + 18, 118); g2.lineTo(x + 8, 128); g2.fill(); } }),
  };
  const bMats = {};
  const bMat = (m, wear) => bMats[m + wear] || (bMats[m + wear] = (() => { const mt = new THREE.MeshStandardMaterial({ map: BTEX[m], roughness: m === 'acier' ? 0.4 : 0.85, metalness: m === 'acier' ? 0.6 : 0.05 }); mt.color.setScalar(1 - wear * 0.28); return mt; })());
  const RAMP_LEN = Math.hypot(TILE, LEVEL), RAMP_ANG = Math.atan2(LEVEL, TILE);
  const geoWall = new THREE.BoxGeometry(TILE, LEVEL, 10), geoFloor = new THREE.BoxGeometry(TILE, 8, TILE), geoRamp = new THREE.BoxGeometry(TILE, 8, RAMP_LEN);
  // place un objet (mur, plancher ou rampe) selon sa tuile, son étage et son orientation
  const placePiece = (obj, b) => {
    const cx = (b.gx + 0.5) * TILE, cz = (b.gy + 0.5) * TILE, base = b.lv * LEVEL;
    obj.rotation.set(0, 0, 0);
    if (b.t === 'mur') {
      const d = b.d % 4;
      if (d === 0) obj.position.set((b.gx + 1) * TILE, base + LEVEL / 2, cz); else if (d === 2) obj.position.set(b.gx * TILE, base + LEVEL / 2, cz);
      else if (d === 1) obj.position.set(cx, base + LEVEL / 2, (b.gy + 1) * TILE); else obj.position.set(cx, base + LEVEL / 2, b.gy * TILE);
      obj.rotation.y = d % 2 === 0 ? Math.PI / 2 : 0;
    } else if (b.t === 'sol') obj.position.set(cx, base - 4, cz);
    else { obj.position.set(cx, base + LEVEL / 2, cz); obj.rotation.y = [-Math.PI / 2, Math.PI, Math.PI / 2, 0][b.d]; }
  };
  const mkPiece = (t, mat) => {
    if (t !== 'rampe') return new THREE.Mesh(t === 'mur' ? geoWall : geoFloor, mat);
    const g2 = new THREE.Group(); const m = new THREE.Mesh(geoRamp, mat); m.rotation.x = RAMP_ANG; g2.add(m); g2.userData.mesh = m; return g2;
  };
  const bMeshes = new Map();
  const setPieceMat = (obj, mat) => { if (obj.isMesh) obj.material = mat; else obj.userData.mesh.material = mat; };
  const ghosts = { mur: mkPiece('mur'), rampe: mkPiece('rampe'), sol: mkPiece('sol') };
  const ghostOk = new THREE.MeshBasicMaterial({ color: '#5AA8FF', transparent: true, opacity: 0.38, depthWrite: false });
  const ghostNo = new THREE.MeshBasicMaterial({ color: '#ff5a5a', transparent: true, opacity: 0.3, depthWrite: false });
  Object.values(ghosts).forEach(gh => { setPieceMat(gh, ghostOk); gh.visible = false; scene.add(gh); });
  // pont roulant jaune qui traverse la halle au début de la partie
  const crane = new THREE.Group();
  const craneTex = tkTexture(256, 32, g2 => { g2.fillStyle = '#F5B700'; g2.fillRect(0, 0, 256, 32); g2.fillStyle = '#1a1a1a'; for (let x = -32; x < 256; x += 32) { g2.beginPath(); g2.moveTo(x, 32); g2.lineTo(x + 16, 0); g2.lineTo(x + 28, 0); g2.lineTo(x + 12, 32); g2.fill(); } }, [8, 1]);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(70, 34, MAP.h), new THREE.MeshStandardMaterial({ map: craneTex, metalness: 0.4, roughness: 0.5 }));
  beam.position.y = BT.busZ + 140; crane.add(beam);
  [80, MAP.h - 80].forEach(zz => { const tr = new THREE.Mesh(new THREE.BoxGeometry(110, 50, 80), ryMat('#3a3d42', { metalness: 0.6 })); tr.position.set(0, BT.busZ + 150, zz - MAP.h / 2); crane.add(tr); });
  crane.position.z = MAP.h / 2;
  scene.add(crane);
  let flashT = 0;
  // joueurs
  const rigs = [];
  const dummy = new THREE.Object3D();
  // butin : chaque arme flotte au-dessus d'un socle, avec un faisceau de la couleur de sa rareté
  const lootMeshes = new Map();
  const beamGeo = new THREE.CylinderGeometry(2.5, 2.5, 1, 6, 1, true), ringGeo = new THREE.RingGeometry(14, 18, 24);
  const syncLoot = () => {
    const ids = new Set(loot.map(it => it[0]));
    for (const [id, m] of lootMeshes) if (!ids.has(id)) { scene.remove(m); lootMeshes.delete(id); }
    for (const it of loot) {
      if (lootMeshes.has(it[0])) continue;
      const grp = new THREE.Group();
      const col = RY_RARITY[it[5]].color;
      const w = ryWeaponModel(it[4], it[5]); w.scale.setScalar(1.25); w.position.y = 22; grp.add(w); grp.userData.w = w;
      const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
      beam.scale.y = 50 + it[5] * 70; beam.position.y = beam.scale.y / 2; grp.add(beam);
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 1.5; grp.add(ring);
      grp.position.set(it[1], it[3], it[2]);
      scene.add(grp); lootMeshes.set(it[0], grp);
    }
  };
  // arme à la 1re personne : scène séparée dessinée par-dessus (elle ne traverse jamais les murs)
  const vmScene = new THREE.Scene();
  vmScene.add(new THREE.HemisphereLight('#ffe8d0', '#3a1c0c', 1.1));
  const vmSun = new THREE.DirectionalLight('#fff0e0', 0.6); vmSun.position.set(1, 2, 1); vmScene.add(vmSun);
  const vmCam = new THREE.PerspectiveCamera(62, W / H, 0.5, 300);
  const vm = new THREE.Group(); vmScene.add(vm);
  let vmKey = '';
  const buildVm = (wid, rar, metier) => {
    while (vm.children.length) vm.remove(vm.children[0]);
    const M = RY_METIERS[metier] || RY_METIERS.fondeur;
    const sleeve = ryMat(M.color), glove = ryMat('#b07a45');
    const arm = (x, rot) => {
      const a = new THREE.Group();
      const fo = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4, 30, 10), sleeve); fo.rotation.x = Math.PI / 2; fo.position.z = 15; a.add(fo);
      const hd = new THREE.Mesh(new THREE.SphereGeometry(4.2, 10, 8), glove); a.add(hd);
      a.position.set(x, -12, -27); a.rotation.set(0.45, rot, 0);
      return a;
    };
    const hold = new THREE.Group(); vm.add(hold); vm.userData.hold = hold;
    if (wid === 'poings') {
      const r = arm(11, 0.2), l = arm(-11, -0.2); hold.add(r); vm.add(l); vm.userData.left = l;
    } else {
      const w = ryWeaponModel(wid, rar);
      const gun = RY_GUNS.includes(wid);
      if (gun) { w.rotation.y = Math.PI; w.scale.setScalar(0.8); w.position.set(11, -12, -34); }
      else { w.rotation.set(0.5, Math.PI, 0.35); w.scale.setScalar(wid === 'ringard' ? 0.6 : 0.75); w.position.set(15, -16, -30); }
      const a = arm(gun ? 11 : 15, 0.1); a.position.set(gun ? 11 : 15, gun ? -15 : -16, gun ? -32 : -30);
      hold.add(w, a);
      if (gun) { const l = arm(3, -0.5); l.position.set(4, -15, -46); hold.add(l); }
    }
  };
  let lastW = 0, lastH = 0;
  const v3 = new THREE.Vector3();
  const project = (x, y, z) => { v3.set(x, z, y).project(cam); return v3.z < 1 && Math.abs(v3.x) < 1.2 && Math.abs(v3.y) < 1.2 ? [(v3.x + 1) / 2 * W, (1 - v3.y) / 2 * H] : null; };

  /* ---------- réception ---------- */
  function push(v) {
    prev = cur || v; prevAt = curAt || performance.now(); cur = v; curAt = performance.now();
    if (v.loot) { loot = v.loot; syncLoot(); }
    const unpack = a => ({ id: a[0], t: a[1], gx: a[2], gy: a[3], lv: a[4], d: a[5], m: a[6], hp: a[7] });
    const upsert = a => {
      const b = unpack(a), old = builds.get(b.id);
      if (old) { old.hp = b.hp; } else { builds.set(b.id, b); bIndex(b, true); }
      const nb = builds.get(b.id);
      const wear = nb.hp > (BT.hp ? BT.hp[nb.m] : 100) * 0.66 ? 0 : nb.hp > (BT.hp ? BT.hp[nb.m] : 100) * 0.33 ? 1 : 2;
      let mesh = bMeshes.get(b.id);
      if (!mesh) { mesh = mkPiece(nb.t, bMat(nb.m, wear)); placePiece(mesh, nb); mesh.scale.setScalar(0.05); mesh.userData.grow = 0; scene.add(mesh); bMeshes.set(b.id, mesh); }
      else setPieceMat(mesh, bMat(nb.m, wear));
    };
    const drop = id => { const b = builds.get(id); if (b) { bIndex(b, false); builds.delete(id); } const m = bMeshes.get(id); if (m) { scene.remove(m); bMeshes.delete(id); } };
    if (v.B) { const ids = new Set(v.B.map(a => a[0])); [...builds.keys()].forEach(id => { if (!ids.has(id)) drop(id); }); v.B.forEach(upsert); }
    if (v.bc) v.bc.forEach(upsert);
    if (v.br) v.br.forEach(drop);
    const sp = v.p[mySeat];
    if (sp && sp.tp !== me.tp) {   // recalage par le serveur (départ, déplacement refusé)
      Object.assign(me, { x: sp.x, y: sp.y, z: sp.z, vx: 0, vy: 0, vz: 0, tp: sp.tp, gl: !!sp.gl, gd: !sp.gl });
      if (me.tp <= 1) { me.yaw = sp.a; me.pitch = 0; }
    }
    for (const e of v.ev) {
      if (e.id <= seenEv) continue;
      seenEv = e.id;
      const mine = e.seat === mySeat;
      const rig = rigs[e.seat];
      if (e.k === 'hit') {
        burst(e.x, e.y, e.z + (e.hs ? 92 : 60), e.hs ? 18 : 10, e.hs ? '#ffe07a' : '#ff6a3a', 260, 0.4);
        if (rig) { rig.hitT = 0.25; }
        if (e.by === mySeat) { hitMark = 0.25; hitHead = !!e.hs; floats.push({ x: e.x, y: e.y, z: e.z + 110, txt: String(Math.round(e.dmg)), life: 0.9, c: e.hs ? '#F5B700' : '#fff' }); sfx(e.hs ? 1200 : 900, 0.05, 'triangle', 0.05); }
        if (mine) {
          shake = 0.3; sfx(140, 0.12, 'sawtooth', 0.06, -60);
          const src = e.by !== null && e.by !== undefined ? cur.p[e.by] : null;
          if (src) dmgDirs.push({ x: src.x, y: src.y, life: 1.2 });
        }
      } else if (e.k === 'kill') {
        feed.push({ txt: e.msg, at: performance.now(), mine: e.by === mySeat || mine });
        burst(e.x, e.y, e.z + 50, 40, '#ffb347', 380, 0.8, 120);
        if (rig) rig.fallDir = Math.random() < 0.5 ? 1 : -1;
        if (e.by === mySeat) { toast(`🔥 Élimination${e.hs ? ' à la tête' : ''} ! +25 PV (${e.left} restants)`); sfx(660, 0.2, 'triangle', 0.06, 300); }
        if (mine) { banner = 'ÉLIMINÉ'; bannerAt = performance.now(); sfx(70, 0.8, 'sawtooth', 0.08, -20); }
      } else if (e.k === 'splash') {
        burst(e.x, e.y, e.z, 40, '#ff8a2a', 360, 0.8, 100); sfx(120, 0.2, 'sawtooth', 0.04);
      } else if (e.k === 'spark') {
        burst(e.x, e.y, e.z, 6, '#ffe9a0', 200, 0.3);
      } else if (e.k === 'shot') {
        if (rig) rig.shotT = 0.12;
        if (mine) { recoil = Math.min(1.4, recoil + ({ grenaille: 1, louche: 0.9, riveteuse: 0.35, chalumeau: 0.08 }[e.w] || 0.3)); sfx({ riveteuse: 900, grenaille: 200, louche: 260, chalumeau: 420 }[e.w] || 600, 0.05, 'square', 0.03, -200); }
        if (e.w !== 'chalumeau' || Math.random() < 0.2) { flash.position.set(e.x, e.z + 90, e.y); flashT = 0.06; }
      } else if (e.k === 'swing') {
        if (rig) rig.swingT = 0.3;
        if (mine) { swingVm = 0.3; sfx(300, 0.08, 'triangle', 0.04, -150); }
      } else if (e.k === 'kb' && mine) {
        me.vx += e.vx; me.vy += e.vy; me.vz = e.vz; me.gd = false;
      } else if (e.k === 'pick' && mine) {
        toast(`${RY_WEAPONS[e.w]} ${RY_RARITY[e.r].name}`); sfx(980, 0.1, 'triangle', 0.05);
      } else if (e.k === 'zone') {
        banner = 'LA FONTE AVANCE !'; bannerAt = performance.now(); sfx(90, 0.9, 'sawtooth', 0.05, 30);
      } else if (e.k === 'harvest') {
        burst(e.x, e.y, e.z, 8, MAT_COL[e.m], 220, 0.35);
        if (mine) { floats.push({ x: e.x, y: e.y, z: e.z + 20, txt: `+${e.n} ${e.m}`, life: 0.9, c: MAT_COL[e.m] }); sfx(e.m === 'acier' ? 1400 : e.m === 'brique' ? 500 : 300, 0.06, 'triangle', 0.04); }
      } else if (e.k === 'build') {
        if (mine) sfx(640, 0.06, 'square', 0.03, 200); else if (Math.hypot(e.x - me.x, e.y - me.y) < 900) sfx(520, 0.04, 'square', 0.015);
      } else if (e.k === 'bhit') {
        burst(e.x, e.y, e.z, 6, MAT_COL[e.m], 180, 0.3);
      } else if (e.k === 'bbreak') {
        burst(e.x, e.y, e.z, 40, MAT_COL[e.m], 340, 0.7, 60); sfx(110, 0.25, 'sawtooth', 0.04, -40);
      } else if (e.k === 'drop') {
        if (mine) { sfx(300, 0.5, 'sine', 0.05, -200); toast('Largage ! Dirige ta descente avec ZQSD'); }
      } else if (e.k === 'win') {
        banner = e.msg.toUpperCase(); bannerAt = performance.now();
      }
    }
  }

  /* ---------- outils ---------- */
  const lerp = (a, b, t) => a + (b - a) * t;
  const angLerp = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
  const others = [];
  function interp() {
    const span = Math.max(30, curAt - prevAt);
    const t = Math.min(1.25, (performance.now() - curAt) / span);
    return cur.p.map((p, i) => {
      const q = prev.p[i] || p;
      if (i === mySeat && p.al && !p.bu) return { ...p, x: me.x, y: me.y, z: me.z, a: me.yaw, pt: me.pitch, vx: me.vx, vy: me.vy, gl: me.gl };
      if (!p.al) return p;
      return { ...p, x: lerp(q.x, p.x, t), y: lerp(q.y, p.y, t), z: lerp(q.z, p.z, Math.min(1, t)), a: angLerp(q.a, p.a, Math.min(1, t)), pt: lerp(q.pt || 0, p.pt || 0, Math.min(1, t)),
        vx: (p.x - q.x) / (span / 1000), vy: (p.y - q.y) / (span / 1000) };
    });
  }
  function focusIndex() {
    const p = cur.p[mySeat];
    if (p && p.al) return mySeat;
    if (p && p.by !== null && p.by !== undefined && cur.p[p.by] && cur.p[p.by].al) return p.by;
    const alive = cur.p.findIndex(q => q.al);
    return alive >= 0 ? alive : mySeat;
  }

  /* ---------- HUD ---------- */
  function hud(ps, fi, dt, t) {
    const sp = cur.p[mySeat];
    const f = ps[fi];
    g.clearRect(0, 0, W, H);
    const z = cur.z;
    // dans la fonte : l'écran rougeoie
    if (sp && sp.al && Math.hypot(me.x - z.x, me.y - z.y) > z.r) { g.fillStyle = `rgba(255,90,20,${0.18 + Math.sin(t * 8) * 0.05})`; g.fillRect(0, 0, W, H); }
    // noms et vie au-dessus des têtes visibles
    ps.forEach((p, i) => {
      if (i === fi || !p.al) return;
      const d = Math.hypot(p.x - f.x, p.y - f.y);
      if (d > 1300 || !segClear(f.x, f.y, f.z + PH.eye, p.x, p.y, p.z + 90)) return;
      const s = project(p.x, p.y, p.z + 122);
      if (!s) return;
      g.font = '800 12px "Big Shoulders Display", Impact'; g.textAlign = 'center'; g.fillStyle = '#fff';
      g.fillText(p.n, s[0], s[1] - 8);
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(s[0] - 18, s[1] - 4, 36, 4); g.fillStyle = '#ff5a5a'; g.fillRect(s[0] - 18, s[1] - 4, 36 * p.hp / 100, 4);
      if (p.ar > 0) { g.fillStyle = '#c9ccd1'; g.fillRect(s[0] - 18, s[1] + 1, 36 * p.ar / 100, 2); }
    });
    // dégâts flottants
    for (let i = floats.length - 1; i >= 0; i--) {
      const fl = floats[i]; fl.life -= dt; fl.z += 40 * dt; if (fl.life <= 0) { floats.splice(i, 1); continue; }
      const s = project(fl.x, fl.y, fl.z); if (!s) continue;
      g.globalAlpha = Math.min(1, fl.life * 2); g.font = '900 20px "Big Shoulders Display", Impact'; g.textAlign = 'center'; g.fillStyle = fl.c;
      g.fillText(fl.txt, s[0], s[1]); g.globalAlpha = 1;
    }
    // viseur
    if (sp && sp.al) {
      const s = sp.s[sp.c], wid = s ? s.w : 'poings';
      const spread = (wid === 'grenaille' ? 26 : wid === 'chalumeau' ? 16 : RY_GUNS.includes(wid) ? 8 : 5) + recoil * 10 + Math.min(10, Math.hypot(me.vx, me.vy) / 30) + (me.gd ? 0 : 8);
      g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2; g.shadowColor = '#000'; g.shadowBlur = 3;
      g.beginPath();
      if (RY_GUNS.includes(wid)) { [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => { g.moveTo(W / 2 + a * spread, H / 2 + b * spread); g.lineTo(W / 2 + a * (spread + 9), H / 2 + b * (spread + 9)); }); }
      else g.arc(W / 2, H / 2, spread + 4, 0, Math.PI * 2);
      g.stroke(); g.shadowBlur = 0;
      g.fillStyle = '#fff'; g.fillRect(W / 2 - 1, H / 2 - 1, 2, 2);
      if (hitMark > 0) {
        g.strokeStyle = hitHead ? '#F5B700' : '#fff'; g.lineWidth = 2.5; g.beginPath();
        [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([a, b]) => { g.moveTo(W / 2 + a * 7, H / 2 + b * 7); g.lineTo(W / 2 + a * 15, H / 2 + b * 15); });
        g.stroke(); hitMark -= dt;
      }
    }
    // d'où viennent les coups reçus
    for (let i = dmgDirs.length - 1; i >= 0; i--) {
      const d = dmgDirs[i]; d.life -= dt; if (d.life <= 0) { dmgDirs.splice(i, 1); continue; }
      const a = Math.atan2(d.y - me.y, d.x - me.x) - me.yaw - Math.PI / 2;
      g.save(); g.translate(W / 2, H / 2); g.rotate(a + Math.PI);
      g.fillStyle = `rgba(255,60,40,${Math.min(0.85, d.life)})`; g.beginPath(); g.moveTo(-22, -110); g.lineTo(22, -110); g.lineTo(0, -132); g.closePath(); g.fill();
      g.restore();
    }
    // mini-carte (nord en haut) avec cône de vue
    const mw = 180, mh = mw * MAP.h / MAP.w, mx = 12, my = 12, k = mw / MAP.w;
    g.fillStyle = 'rgba(8,9,11,.75)'; g.fillRect(mx, my, mw, mh);
    g.fillStyle = 'rgba(255,255,255,.2)'; for (const o of MAP.obs) g.fillRect(mx + o.x * k, my + o.y * k, Math.max(1, o.w * k), Math.max(1, o.h * k));
    g.save(); g.beginPath(); g.rect(mx, my, mw, mh); g.clip();
    g.fillStyle = 'rgba(255,106,26,.35)'; g.beginPath(); g.rect(mx, my, mw, mh); g.arc(mx + z.x * k, my + z.y * k, z.r * k, 0, Math.PI * 2, true); g.fill('evenodd');
    g.strokeStyle = '#ff8a2a'; g.lineWidth = 2; g.beginPath(); g.arc(mx + z.x * k, my + z.y * k, z.r * k, 0, Math.PI * 2); g.stroke();
    if (z.to) { g.strokeStyle = 'rgba(255,255,255,.7)'; g.setLineDash([3, 3]); g.beginPath(); g.arc(mx + z.to[0] * k, my + z.to[1] * k, z.to[2] * k, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); }
    if (sp && sp.m === 'metallurgiste') for (const it of loot) if (it[5] >= 2) { g.fillStyle = RY_RARITY[it[5]].color; g.fillRect(mx + it[1] * k - 1.5, my + it[2] * k - 1.5, 3, 3); }
    const fx = mx + f.x * k, fy = my + f.y * k, fa = fi === mySeat ? me.yaw : f.a;
    g.fillStyle = 'rgba(127,212,255,.25)'; g.beginPath(); g.moveTo(fx, fy); g.arc(fx, fy, 26, fa - 0.6, fa + 0.6); g.closePath(); g.fill();
    g.restore();
    g.fillStyle = '#7fd4ff'; g.beginPath(); g.arc(fx, fy, 3.5, 0, Math.PI * 2); g.fill();
    // survivants, éliminations, fonte
    g.fillStyle = 'rgba(8,9,11,.75)'; g.fillRect(W - 170, 12, 158, 62);
    g.font = '400 11px "Press Start 2P", monospace'; g.textAlign = 'right'; g.fillStyle = '#fff';
    g.fillText(`${cur.alive} EN VIE`, W - 22, 34);
    g.fillStyle = '#F5B700'; g.fillText(`${sp ? sp.k : 0} ÉLIM.`, W - 22, 52);
    g.font = '600 11px Archivo, sans-serif'; g.fillStyle = z.sh ? '#ff8a2a' : '#c6cad0';
    g.fillText(z.sh ? `La fonte avance (${z.t} s)` : z.ph >= 5 ? 'Fonte finale' : `Fonte dans ${z.t} s`, W - 22, 68);
    const now = performance.now();
    feed.filter(x => now - x.at < 6000).slice(-5).forEach((x, i) => {
      g.font = '800 14px "Big Shoulders Display", Impact'; g.textAlign = 'right';
      const tw = g.measureText(x.txt).width + 16;
      g.fillStyle = x.mine ? 'rgba(236,100,30,.5)' : 'rgba(8,9,11,.6)'; g.fillRect(W - 12 - tw, 82 + i * 22, tw, 19);
      g.fillStyle = '#fff'; g.fillText(x.txt, W - 20, 96 + i * 22);
    });
    // vie, armure, armes
    if (sp && sp.al) {
      const bx = W / 2 - 160, by = H - 64;
      g.fillStyle = 'rgba(8,9,11,.75)'; g.fillRect(bx - 8, by - 10, 336, 58);
      g.fillStyle = '#3a0d0d'; g.fillRect(bx, by, 320, 14); g.fillStyle = sp.hp > 30 ? '#ff5a5a' : '#ff2a2a'; g.fillRect(bx, by, 320 * sp.hp / 100, 14);
      g.fillStyle = '#22262a'; g.fillRect(bx, by + 17, 320, 6); g.fillStyle = '#c9ccd1'; g.fillRect(bx, by + 17, 320 * sp.ar / 100, 6);
      g.font = '800 12px Archivo, sans-serif'; g.textAlign = 'left'; g.fillStyle = '#fff'; g.fillText(`${sp.hp} PV`, bx + 4, by + 11);
      if (sp.ar > 0) { g.textAlign = 'right'; g.fillText(`${sp.ar} armure`, bx + 316, by + 11); }
      [0, 1].forEach(sl => {
        const s = sp.s[sl], x = bx + sl * 162, y = by + 27;
        g.fillStyle = sl === sp.c ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.05)'; g.fillRect(x, y, 158, 18);
        g.fillStyle = s ? RY_RARITY[s.r].color : '#666'; g.fillRect(x, y, 4, 18);
        g.font = '700 11px Archivo, sans-serif'; g.textAlign = 'left'; g.fillStyle = s ? '#fff' : '#888';
        g.fillText(s ? `${sl + 1}. ${RY_WEAPONS[s.w]} · ${RY_RARITY[s.r].name}` : `${sl + 1}. mains nues`, x + 9, y + 13);
      });
      const near = loot.find(it => (it[1] - me.x) ** 2 + (it[2] - me.y) ** 2 < 50 ** 2 && Math.abs(it[3] - me.z) < 60);
      if (near && sp.s[0] && sp.s[1]) {
        g.font = '400 9px "Press Start 2P", monospace'; g.textAlign = 'center'; g.fillStyle = RY_RARITY[near[5]].color;
        g.fillText(`E : PRENDRE ${RY_WEAPONS[near[4]].toUpperCase()} ${RY_RARITY[near[5]].name.toUpperCase()}`, W / 2, by - 22);
      }
      if (!sp.s[0] && !sp.s[1] && cur.time < 40 && !build && !sp.bu && !sp.gl) {
        g.font = '400 9px "Press Start 2P", monospace'; g.textAlign = 'center'; g.fillStyle = '#ffd27a';
        g.fillText('À MAINS NUES : TROUVE UNE ARME (FAISCEAUX DE COULEUR)', W / 2, by - 22);
      }
    } else if (sp) {
      g.font = '400 11px "Press Start 2P", monospace'; g.textAlign = 'center'; g.fillStyle = '#ff8a8a';
      g.fillText(`SPECTATEUR · ${cur.p[fi].n.toUpperCase()}`, W / 2, H - 30);
    }
    g.font = '400 8px "Press Start 2P", monospace'; g.textAlign = 'left'; g.fillStyle = '#9aa0a6';
    g.fillText(`${mode === 'fps' ? '1RE' : '3E'} PERSONNE (V)`, 14, my + mh + 16);
    // matériaux récoltés
    if (sp && sp.al && sp.mt) {
      const bx0 = W - 128, by0 = H - 104;
      g.fillStyle = 'rgba(8,9,11,.75)'; g.fillRect(bx0 - 8, by0 - 8, 124, 84);
      BT.mats.forEach((m, k) => {
        const y = by0 + k * 24, on = build && k === matSel;
        g.fillStyle = on ? 'rgba(255,255,255,.16)' : 'transparent'; g.fillRect(bx0 - 4, y - 2, 116, 22);
        g.fillStyle = MAT_COL[m]; g.fillRect(bx0, y + 2, 14, 14);
        g.font = '800 12px Archivo, sans-serif'; g.textAlign = 'left'; g.fillStyle = sp.mt[k] >= BT.cost ? '#fff' : '#888';
        g.fillText(m.toUpperCase(), bx0 + 20, y + 14); g.textAlign = 'right'; g.fillText(String(sp.mt[k]), bx0 + 106, y + 14);
      });
    }
    if (build && sp && sp.al) {
      g.font = '400 9px "Press Start 2P", monospace'; g.textAlign = 'center';
      const txt = ['mur', 'rampe', 'sol'].map((k, i) => `${k === build ? '▶' : ''}${PIECES[k]} ${i + 3}`).join('   ');
      g.fillStyle = 'rgba(8,9,11,.8)'; g.fillRect(W / 2 - 250, H - 140, 500, 30);
      g.fillStyle = '#7fd4ff'; g.fillText(`CONSTRUCTION · ${txt}`, W / 2, H - 128);
      g.fillStyle = '#c6cad0'; g.fillText('CLIC POSER · X MATÉRIAU · 1/2 ARMES', W / 2, H - 115);
    }
    if (sp && sp.al && sp.bu) {
      const left = Math.max(0, Math.ceil((BT.busTime || 16) - (cur.time || 0)));
      bigText(g, 'ESPACE : SAUTE !', W / 2, H / 2 + 70, 34, '#F5B700');
      g.font = '400 9px "Press Start 2P", monospace'; g.textAlign = 'center'; g.fillStyle = '#fff';
      g.fillText(cur.phase === 'count' ? 'LE PONT ROULANT VA TRAVERSER LA HALLE' : `LARGAGE AUTOMATIQUE DANS ${left} S`, W / 2, H / 2 + 100);
    } else if (sp && sp.al && sp.gl) {
      g.font = '400 9px "Press Start 2P", monospace'; g.textAlign = 'center'; g.fillStyle = '#d8dde3';
      g.fillText('VOL PLANÉ · ZQSD POUR CHOISIR OÙ ATTERRIR', W / 2, H / 2 + 90);
    }
    if (!isTouch && sp && sp.al && !sp.bu && document.pointerLockElement !== screen && !dragging) {
      g.fillStyle = 'rgba(8,9,11,.7)'; g.fillRect(W / 2 - 200, H / 2 + 40, 400, 34);
      g.font = '400 9px "Press Start 2P", monospace'; g.textAlign = 'center'; g.fillStyle = '#fff';
      g.fillText('CLIQUE POUR VISER À LA SOURIS', W / 2, H / 2 + 61);
    }
    if (cur.phase === 'count') bigText(g, String(Math.ceil(cur.countdown)), W / 2, H / 2 - 40, 96, '#F5B700');
    if (banner && performance.now() - bannerAt < 2600) bigText(g, banner, W / 2, H / 2 - 90, 54, banner === 'ÉLIMINÉ' ? '#ff6b6b' : '#F5B700');
  }

  /* ---------- boucle ---------- */
  const stop = loop((dt, tms) => {
    if (!cur) return;
    const t = tms / 1000;
    const sp = cur.p[mySeat];
    const alive = sp && sp.al;
    // visée au joystick tactile
    if (touchLook) look(touchLook.x * 900 * dt, touchLook.y * 600 * dt);
    swayX *= Math.max(0, 1 - dt * 8); swayY *= Math.max(0, 1 - dt * 8);
    // déplacement prédit
    if (alive && sp.bu && jumpQueued) tap(B.JUMP);   // sauter du pont roulant
    if (alive && cur.phase === 'play' && !sp.bu) {
      let fw = 0, st = 0;
      if (held.has('KeyW') || held.has('ArrowUp')) fw += 1;
      if (held.has('KeyS') || held.has('ArrowDown')) fw -= 1;
      if (held.has('KeyD') || held.has('ArrowRight')) st += 1;
      if (held.has('KeyA') || held.has('ArrowLeft')) st -= 1;
      if (touchMove) { fw = -touchMove.y; st = touchMove.x; }
      let wx = Math.cos(me.yaw) * fw - Math.sin(me.yaw) * st, wy = Math.sin(me.yaw) * fw + Math.cos(me.yaw) * st;
      const n = Math.hypot(wx, wy); if (n > 1) { wx /= n; wy /= n; }
      const run = (held.has('ShiftLeft') || held.has('ShiftRight') || (touchMove && Math.hypot(touchMove.x, touchMove.y) > 0.95)) && fw > 0;
      physics(wx, wy, run, jumpQueued, dt);
      const hs = Math.hypot(me.vx, me.vy);
      if (me.gd && hs > 40) { bob += hs * dt / 26; stepAcc += hs * dt; if (stepAcc > (run ? 95 : 80)) { stepAcc = 0; sfx(60 + Math.random() * 30, 0.04, 'triangle', 0.025); } }
    }
    jumpQueued = false;
    sendInput(false);
    // construction : pièce visée et pose (maintenir le clic pour enchaîner)
    let ghostSpec = null;
    Object.values(ghosts).forEach(gh => { gh.visible = false; });
    if (build && alive && !sp.bu && cur.phase === 'play') {
      const di = ((Math.round(me.yaw / (Math.PI / 2)) % 4) + 4) % 4;
      const ahead = [me.x + Math.cos(me.yaw) * TILE * 0.8, me.y + Math.sin(me.yaw) * TILE * 0.8];
      const lvFeet = Math.max(0, Math.floor((me.z + 30) / LEVEL));
      if (build === 'mur') ghostSpec = { t: 'mur', gx: Math.floor(me.x / TILE), gy: Math.floor(me.y / TILE), lv: lvFeet, d: di };
      else if (build === 'rampe') ghostSpec = { t: 'rampe', gx: Math.floor(ahead[0] / TILE), gy: Math.floor(ahead[1] / TILE), lv: lvFeet, d: di };
      else ghostSpec = { t: 'sol', gx: Math.floor(ahead[0] / TILE), gy: Math.floor(ahead[1] / TILE), lv: me.pitch > 0.35 ? lvFeet + 1 : Math.max(0, Math.round(me.z / LEVEL)), d: 0 };
      const mt = sp.mt || [0, 0, 0];
      let mi = matSel;
      if (mt[mi] < BT.cost) { const alt = [0, 1, 2].find(k => mt[k] >= BT.cost); if (alt !== undefined) mi = alt; }
      ghostSpec.m = BT.mats[mi]; ghostSpec.ok = mt[mi] >= BT.cost;
      const gh = ghosts[build];
      placePiece(gh, ghostSpec); setPieceMat(gh, ghostSpec.ok ? ghostOk : ghostNo); gh.visible = true;
      const nowMs = performance.now();
      if (placeHeld && ghostSpec.ok && nowMs - lastPlace > 140) {
        lastPlace = nowMs;
        send({ t: 'act', a: 'build', piece: ghostSpec.t, gx: ghostSpec.gx, gy: ghostSpec.gy, lv: ghostSpec.lv, d: ghostSpec.d, m: ghostSpec.m });
      }
    }
    // pont roulant
    crane.position.x = cur.crane || 200;
    crane.visible = cur.p.some(q => q.bu) || cur.phase === 'count';
    // constructions qui sortent de terre
    for (const m of bMeshes.values()) if (m.userData.grow !== undefined) { m.userData.grow = Math.min(1, m.userData.grow + dt * 6); m.scale.setScalar(Math.max(0.05, m.userData.grow)); if (m.userData.grow >= 1) delete m.userData.grow; }
    if (shake > 0) shake -= dt;
    recoil = Math.max(0, recoil - dt * 4); landKick = Math.max(0, landKick - dt * 4); swingVm = Math.max(0, swingVm - dt);
    const ps = interp();
    const fi = focusIndex();
    const f = ps[fi];
    // taille du rendu
    const cw = cv.clientWidth, ch = cv.clientHeight;
    if (cw && (cw !== lastW || ch !== lastH)) {
      lastW = cw; lastH = ch; renderer.setSize(cw, ch, false); canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
      cam.aspect = vmCam.aspect = cw / ch; cam.updateProjectionMatrix(); vmCam.updateProjectionMatrix();
    }
    const firstPerson = mode === 'fps' && fi === mySeat && alive && !sp.bu;   // le spectateur suit toujours par-dessus l'épaule
    // personnages
    ps.forEach((p, i) => {
      if (!rigs[i]) { rigs[i] = ryRig(p.m); scene.add(rigs[i].root); }
      const rig = rigs[i];
      const deadLong = !p.al && rig.dieT > 4;
      rig.root.visible = !deadLong && !(i === fi && firstPerson);
      if (deadLong) return;
      rig.root.position.set(p.x, p.z, p.y);
      rig.root.rotation.y = Math.PI / 2 - p.a;
      const s = p.s[p.c], key = s ? s.w + s.r : 'poings';
      if (rig.wkey !== key) {
        if (rig.weapon) rig.R.arm.hand.remove(rig.weapon);
        rig.weapon = s ? ryWeaponModel(s.w, s.r) : null; rig.wkey = key;
        if (rig.weapon) rig.R.arm.hand.add(rig.weapon);
      }
      const air = p.z > groundAt(p.x, p.y, p.z) + 3;
      ryPose(rig, { speed: p.bu ? 0 : Math.hypot(p.vx || 0, p.vy || 0), air, pitch: p.pt || 0, wid: s ? s.w : 'poings', weaponObj: rig.weapon, dead: !p.al, hang: p.bu, glide: p.gl }, dt);
    });
    // caméra
    const fa = fi === mySeat && alive ? me.yaw : f.a, fp = fi === mySeat && alive ? me.pitch : (f.pt || 0);
    const eyeZ = f.z + PH.eye - landKick * 8 + (firstPerson ? Math.sin(bob * 2) * 1.6 : 0);
    const dir = new THREE.Vector3(Math.cos(fa) * Math.cos(fp), Math.sin(fp), Math.sin(fa) * Math.cos(fp));
    if (firstPerson) {
      cam.position.set(f.x, eyeZ, f.y);
    } else {
      // par-dessus l'épaule droite, recule tant que la caméra ne rentre pas dans un mur
      const rx = -Math.sin(fa), ry = Math.cos(fa);
      let best = 0;
      const far = f.bu || f.gl ? 300 : 170;
      for (let d = 10; d <= far; d += 10) {
        const px = f.x - dir.x * d + rx * 38 * d / 150, py = f.y - dir.z * d + ry * 38 * d / 150, pz = eyeZ + 20 - dir.y * d;
        if (pointBlocked(px, py, pz) || pz < 8) break;
        best = d;
      }
      best = Math.max(0, best - 8);
      cam.position.set(f.x - dir.x * best + rx * 38 * best / 150, eyeZ + 20 - dir.y * best, f.y - dir.z * best + ry * 38 * best / 150);
    }
    if (shake > 0) { cam.position.x += (Math.random() - 0.5) * 6 * shake; cam.position.y += (Math.random() - 0.5) * 6 * shake; }
    cam.lookAt(cam.position.x + dir.x * 100, cam.position.y + dir.y * 100 + recoil * 3, cam.position.z + dir.z * 100);
    // fonte
    const z = cur.z;
    if (Math.abs(z.r - lavaR) > 6) {
      if (lava) { scene.remove(lava); lava.geometry.dispose(); }
      lava = new THREE.Mesh(new THREE.RingGeometry(Math.max(1, z.r), 6000, 96, 1), lavaMat);
      lava.rotation.x = -Math.PI / 2; scene.add(lava); lavaR = z.r;
    }
    lava.position.set(z.x, 2, z.y);
    lavaMat.color.setHSL(0.06 + Math.sin(t * 2) * 0.01, 1, 0.5 + Math.sin(t * 3) * 0.04);
    heatWall.scale.set(Math.max(1, z.r), CEIL, Math.max(1, z.r)); heatWall.position.set(z.x, CEIL / 2, z.y);
    heatWall.material.opacity = 0.16 + Math.sin(t * 4) * 0.05;
    lights.forEach((l, k) => { l.intensity = 1.4 + Math.sin(t * 7 + k) * 0.3; });
    flashT -= dt; flash.intensity = flashT > 0 ? 2.5 : 0;
    // projectiles extrapolés depuis le dernier état
    const age = Math.min(0.15, (performance.now() - curAt) / 1000);
    projMesh.count = Math.min(600, cur.pr.length);
    cur.pr.slice(0, 600).forEach((q, k) => {
      const grav = q[6] === 'blob' ? 700 : q[6] === 'flame' ? -120 : 0;
      const px = q[0] + q[3] * age, py = q[1] + q[4] * age, pz = q[2] + q[5] * age - grav * age * age / 2;
      dummy.position.set(px, pz, py);
      dummy.lookAt(px + q[3], pz + q[5], py + q[4]);
      const sc = { rivet: [1.6, 1.6, 34], pellet: [1.2, 1.2, 18], blob: [12, 12, 14], flame: [9 + Math.random() * 8, 9 + Math.random() * 8, 12] }[q[6]] || [2, 2, 10];
      dummy.scale.set(sc[0], sc[1], sc[2]); dummy.updateMatrix();
      projMesh.setMatrixAt(k, dummy.matrix); projMesh.setColorAt(k, PCOL[q[6]] || PCOL.rivet);
      if (q[6] === 'flame' && Math.random() < 0.3) burst(px, py, pz, 1, '#ffb347', 40, 0.25, 40);
      if (q[6] === 'blob' && Math.random() < 0.4) burst(px, py, pz, 1, '#ff8a2a', 30, 0.4);
    });
    projMesh.instanceMatrix.needsUpdate = true;
    if (projMesh.instanceColor) projMesh.instanceColor.needsUpdate = true;
    // particules
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.vz -= 600 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z = Math.max(1, p.z + p.vz * dt);
    }
    parts.forEach((p, i) => { pPos[i * 3] = p.x; pPos[i * 3 + 1] = p.z; pPos[i * 3 + 2] = p.y; const a = Math.min(1, p.life * 3); pCol[i * 3] = p.r * a; pCol[i * 3 + 1] = p.g * a; pCol[i * 3 + 2] = p.b * a; });
    pGeo.setDrawRange(0, parts.length);
    pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
    // butin qui tourne
    for (const [id, m] of lootMeshes) {
      const d = Math.abs(m.position.x - cam.position.x) + Math.abs(m.position.z - cam.position.z);
      m.visible = d < 2600;
      if (m.visible) { m.userData.w.rotation.y = t * 1.6 + id; m.userData.w.position.y = 22 + Math.sin(t * 2.5 + id) * 3; }
    }
    renderer.clear();
    renderer.render(scene, cam);
    // arme à la 1re personne
    if (firstPerson && !build && !me.gl) {
      const s = sp.s[sp.c], key = (s ? s.w + s.r : 'poings') + sp.m;
      if (key !== vmKey) { vmKey = key; buildVm(s ? s.w : 'poings', s ? s.r : 0, sp.m); }
      const hs = Math.hypot(me.vx, me.vy) / 240;
      const hold = vm.userData.hold;
      vm.position.set(Math.cos(bob) * 1.2 * hs - swayX * 2, -Math.abs(Math.sin(bob)) * 1.2 * hs + swayY * 1.5 - landKick * 3, recoil * 4);
      vm.rotation.set(recoil * 0.12, -swayX * 0.05, 0);
      const swg = swingVm > 0 ? 1 - swingVm / 0.3 : -1;
      if (swg >= 0) {
        if (s) { hold.rotation.set(Math.sin(swg * Math.PI) * -1.1, Math.sin(swg * Math.PI) * 0.3, 0); hold.position.set(-swg * 6, 0, -Math.sin(swg * Math.PI) * 6); }
        else { hold.rotation.set(0, 0, 0); hold.position.set(-Math.sin(swg * Math.PI) * 4, Math.sin(swg * Math.PI) * 3, -Math.sin(swg * Math.PI) * 14); }
      } else { hold.rotation.set(0, 0, 0); hold.position.set(0, 0, 0); }
      renderer.clearDepth();
      renderer.render(vmScene, vmCam);
    }
    hud(ps, fi, dt, t);
  });

  return {
    push, endShown: false,
    stop() {
      stop();
      window.removeEventListener('keydown', escGuard, true);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', blur);
      window.removeEventListener('mouseup', onUp);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('pointerlockchange', onLockChange);
      if (document.pointerLockElement) document.exitPointerLock();
      renderer.dispose();
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map) o.material.map.dispose(); });
    },
  };
}
