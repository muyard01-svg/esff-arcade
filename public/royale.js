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
  pitch: 'FPS à la 1re ou 3e personne : forgerons, fondeurs, soudeurs… tous les métiers de la métallurgie s\'affrontent dans une halle de fonderie que la fonte envahit. Saute du pont roulant, plane jusqu\'au sol, fouille les coffres pour t\'armer. Quatre cartes : halle de coulée, forge, laminoir et parc à ferraille. Le dernier debout gagne.',
  how: '<b>ZQSD / WASD</b> se déplacer · <b>Maj</b> sprinter · <b>Espace</b> sauter · <b>souris</b> viser (clique dans le jeu pour la capturer) · <b>clic</b> frapper / tirer · <b>1 / 2</b>, <b>Tab</b> ou <b>molette</b> changer d\'arme · <b>V</b> 1re / 3e personne · <b>E</b> ouvrir un coffre / ramasser une arme · <b>G</b> lâcher l\'arme en main. Au départ, <b>Espace</b> pour sauter du pont roulant. Tir à la tête x1,5, chaque élimination rend 25 PV.',
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

const RY_MAPS = {
  random: { name: 'Au hasard', desc: 'Une des quatre cartes, tirée au sort' },
  halle: { name: 'Halle de coulée', desc: 'Fours, conteneurs et piles de moules sous la grande charpente' },
  forge: { name: 'La Forge', desc: 'Îlots de marteaux-pilons, foyers, enclumes et cuves de trempe' },
  laminoir: { name: 'Le Laminoir', desc: 'Une longue halle traversée par le train de laminage, bobines et brames' },
  ferraille: { name: 'Parc à ferraille', desc: 'À ciel ouvert : tas de ferraille, cubes compactés, grues et bennes' },
};
function renderMapPick(box) {
  if (!RY_MAPS[save.ryMap]) save.ryMap = 'random';
  box.innerHTML = Object.entries(RY_MAPS).map(([id, m]) => `<button type="button" data-map="${id}" class="ry-map ${id === save.ryMap ? 'on' : ''}" title="${m.desc}"><b>${m.name}</b><small>${m.desc}</small></button>`).join('');
  box.querySelectorAll('[data-map]').forEach(b => b.addEventListener('click', () => {
    save.ryMap = b.dataset.map; persist();
    box.querySelectorAll('[data-map]').forEach(x => x.classList.toggle('on', x === b)); SFX.tick();
  }));
}

let ryClient = null;
function stopRoyale() { if (ryClient && ryClient !== 'loading') ryClient.stop(); ryClient = null; }

function updateRoyale() {
  if (!trackInfo || !trackInfo.map) return;
  if (view.finished) {
    if (ryClient && ryClient !== 'loading' && !ryClient.endShown) {
      ryClient.push(view); ryClient.endShown = true;
      const won = view.finished[0] === mySeat && view.p[mySeat] && view.p[mySeat].al;
      if (won) ryClient.victory();
      setTimeout(() => updateRoyale(), won ? 6500 : 2600);
      return;
    }
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

/* ---------- squelette d'un ouvrier (environ 108 unités de haut, regarde vers +Z) ----------
   bassin → bas du dos → poitrine → cou → tête ; clavicules → épaules → coudes → poignets → mains ;
   hanches → genoux → chevilles → orteils. */
function ryRig(metier) {
  const M = RY_METIERS[metier] || RY_METIERS.fondeur;
  const suit = ryMat(M.color), suitD = ryMat(shade(M.color, -0.3)), skin = ryMat('#e0a77d'), pants = ryMat('#2b2e33'), boot = ryMat('#111214'), glove = ryMat('#b07a45');
  const limb = (len, r, mat) => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.82, len, 9), mat); m.position.y = -len / 2;
    const j = new THREE.Mesh(new THREE.SphereGeometry(r * 1.05, 9, 7), mat);
    g.add(m, j);
    return g;
  };
  const G = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const mesh = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  const root = new THREE.Group();
  const body = G(root);                                    // pivot de la chute
  const hips = G(body, 0, 50, 0);
  mesh(hips, new THREE.BoxGeometry(26, 11, 16), pants);
  const spine = G(hips, 0, 4, 0);                          // bas du dos
  mesh(spine, new THREE.BoxGeometry(27, 15, 16.5), suit, 0, 7, 0);
  mesh(spine, new THREE.BoxGeometry(28, 5, 17.5), suitD, 0, 0, 0);   // ceinture
  const torso = G(spine, 0, 15, 0);                        // poitrine
  mesh(torso, new THREE.BoxGeometry(31, 22, 18.5), suit, 0, 11, 0);
  if (metier === 'fondeur' || metier === 'forgeron' || metier === 'soudeur') {   // tablier
    mesh(torso, new THREE.BoxGeometry(22, 40, 2), metier === 'fondeur' ? ryMat('#c9ccd1', { metalness: 0.7, roughness: 0.3 }) : ryMat('#6b4227'), 0, 2, 10);
  }
  mesh(torso, new THREE.RingGeometry(3, 4.6, 16), new THREE.MeshBasicMaterial({ color: '#ffffff' }), -7, 14, 9.4);
  const neck = G(torso, 0, 22, 0);
  mesh(neck, new THREE.CylinderGeometry(4, 4.6, 7, 8), skin, 0, 2.5, 0);
  const head = G(neck, 0, 5, 0);
  mesh(head, new THREE.SphereGeometry(9, 16, 12), skin, 0, 0, 0);
  const eyeM = ryMat('#111');
  [-3.5, 3.5].forEach(x => mesh(head, new THREE.SphereGeometry(1.2, 6, 6), eyeM, x, 1, 8.3));
  mesh(head, new THREE.BoxGeometry(6, 1.5, 1), ryMat('#7a4a3a'), 0, -4, 8.4);    // bouche
  if (metier === 'soudeur') {
    mesh(head, new THREE.BoxGeometry(17, 14, 6), ryMat(M.hat, { metalness: 0.4 }), 0, 1, 8);
    mesh(head, new THREE.BoxGeometry(11, 3.5, 1), ryMat('#3a8a5a', { emissive: '#1a4a2a' }), 0, 2, 11.2);
  } else {
    const helm = mesh(head, new THREE.SphereGeometry(10.5, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), ryMat(M.hat, { metalness: metier === 'fondeur' ? 0.7 : 0.15, roughness: 0.4 }), 0, 1, 0);
    mesh(head, new THREE.BoxGeometry(14, 1.6, 6), helm.material, 0, 2, 10);
    if (metier === 'fondeur') mesh(head, new THREE.BoxGeometry(14, 6, 1.5), ryMat('#f5b700', { metalness: 0.8, roughness: 0.2, emissive: '#3a2a00' }), 0, -1, 9.6);
  }
  const arm = side => {
    const clav = G(torso, side * 7, 18, 0);                // clavicule
    mesh(clav, new THREE.BoxGeometry(11, 5, 7), suit, side * 5, 0, 0);
    const sh = G(clav, side * 11.5, -1, 0);                // épaule
    sh.add(limb(18, 5, suit));
    const el = G(sh, 0, -18, 0);                           // coude
    el.add(limb(16, 4.4, suit));
    const wrist = G(el, 0, -17, 0);                        // poignet
    mesh(wrist, new THREE.SphereGeometry(3.2, 8, 6), glove);
    mesh(wrist, new THREE.BoxGeometry(7, 8, 5), glove, 0, -4.5, 0.5);             // paume
    mesh(wrist, new THREE.BoxGeometry(6.4, 4, 4.4), glove, 0, -9, 1.5);          // doigts repliés
    mesh(wrist, new THREE.BoxGeometry(2.6, 5, 2.6), glove, -side * 4, -4, 2.5);  // pouce
    const hand = G(wrist, 0, -6, 0);                       // prise de l'outil
    return { clav, sh, el, wrist, hand };
  };
  const leg = side => {
    const hp = G(hips, side * 7.5, -3, 0);
    hp.add(limb(22, 6.4, pants));
    const kn = G(hp, 0, -22, 0);
    kn.add(limb(19, 5.4, pants));
    const ank = G(kn, 0, -19, 0);                          // cheville
    mesh(ank, new THREE.BoxGeometry(10, 7, 12), boot, 0, -3, 2);
    const toe = G(ank, 0, -4, 8);                          // orteils
    mesh(toe, new THREE.BoxGeometry(10, 5, 7), boot, 0, -1.5, 3);
    return { hp, kn, ank, toe };
  };
  const L = { arm: arm(-1), leg: leg(-1) }, R = { arm: arm(1), leg: leg(1) };
  // couverture aluminisée qui sert de voile pendant le largage
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(70, 16, 6, 0, Math.PI * 2, 0, Math.PI * 0.32), ryMat('#d8dde3', { metalness: 0.9, roughness: 0.25, side: THREE.DoubleSide }));
  canopy.position.y = 120; canopy.visible = false; root.add(canopy);
  const bones = { hips, spine, torso, neck, head };
  ['L', 'R'].forEach(sd => {
    const S = sd === 'L' ? L : R;
    Object.assign(bones, { [`${sd}clav`]: S.arm.clav, [`${sd}sh`]: S.arm.sh, [`${sd}el`]: S.arm.el, [`${sd}wr`]: S.arm.wrist,
      [`${sd}hp`]: S.leg.hp, [`${sd}kn`]: S.leg.kn, [`${sd}an`]: S.leg.ank, [`${sd}to`]: S.leg.toe });
  });
  return { root, body, hips, spine, torso, neck, head, L, R, canopy, bones, J: {}, spd: 0, weapon: null, wkey: '', phase: Math.random() * 6, hitT: 0, shotT: 0, swingT: 0, dieT: 0, fallDir: 1, t: Math.random() * 10 };
}

/* pose procédurale : chaque articulation vise un angle cible et le rejoint en douceur (amorti),
   d'où des enchaînements souples entre marche, course, saut, visée, coups, recul et chute */
function ryPose(rig, st, dt) {
  rig.t += dt;
  rig.spd += (st.speed - rig.spd) * Math.min(1, dt * 7);          // vitesse lissée : pas de saccade au démarrage
  const sp = Math.min(1.4, rig.spd / 240);
  rig.phase += rig.spd * dt / 26;
  const s = Math.sin(rig.phase), c = Math.cos(rig.phase), t = rig.t;
  const air = st.air;
  const T = {};
  const set = (bone, x = 0, y = 0, z = 0) => { T[bone + '.x'] = x; T[bone + '.y'] = y; T[bone + '.z'] = z; };
  const breathe = Math.sin(t * 2.1) * 0.025;
  const lean = sp > 1.1 ? 0.2 : sp * 0.09;
  // jambes : balancier, genou qui se plie au passage, pied qui se déroule (talon puis pointe)
  const legAmp = air ? 0 : 0.78 * sp;
  if (air) {
    set('Lhp', -0.95); set('Rhp', -0.25); set('Lkn', 1.35); set('Rkn', 0.55); set('Lan', 0.35); set('Ran', 0.2); set('Lto'); set('Rto');
  } else {
    set('Lhp', -s * legAmp, 0, -0.03); set('Rhp', s * legAmp, 0, 0.03);
    set('Lkn', Math.max(0, c) * 1.15 * sp + 0.06); set('Rkn', Math.max(0, -c) * 1.15 * sp + 0.06);
    set('Lan', (Math.max(0, -c) * 0.38 - Math.max(0, s) * 0.22) * sp); set('Ran', (Math.max(0, c) * 0.38 - Math.max(0, -s) * 0.22) * sp);
    set('Lto', Math.max(0, -s) * 0.5 * sp); set('Rto', Math.max(0, s) * 0.5 * sp);
  }
  // bassin qui rebondit et balance, colonne en contre-rotation, tête stabilisée
  T['hips.py'] = 50 - Math.abs(c) * 2.6 * sp - (air ? 4 : 0) + (sp < 0.1 ? Math.sin(t * 2.1) * 0.4 : 0);
  set('hips', 0, s * 0.13 * sp, c * 0.05 * sp);
  set('spine', lean * 0.5 - st.pitch * 0.15, -s * 0.07 * sp, -c * 0.035 * sp);
  set('torso', lean * 0.5 - st.pitch * 0.2 + breathe, -s * 0.08 * sp, rig.hitT > 0 ? Math.sin(rig.hitT * 40) * 0.12 : 0);
  set('neck', -st.pitch * 0.2, s * 0.05 * sp);
  set('head', -st.pitch * 0.3 - lean * 0.6, s * 0.04 * sp, -c * 0.02 * sp);
  set('Lclav', 0, 0, breathe * 0.5); set('Rclav', 0, 0, -breathe * 0.5);
  rig.hitT = Math.max(0, rig.hitT - dt);
  // bras selon l'outil en main
  const kind = st.wid === 'poings' ? 'fist' : RY_GUNS.includes(st.wid) ? 'gun' : 'melee';
  const aim = -Math.PI / 2 - st.pitch * 0.65 + lean;
  rig.shotT = Math.max(0, rig.shotT - dt);
  rig.swingT = Math.max(0, rig.swingT - dt);
  const sw = rig.swingT > 0 ? 1 - rig.swingT / 0.3 : -1;          // 0 → 1 pendant le coup
  let fast = false;
  if (kind === 'gun') {
    set('Rsh', aim + rig.shotT * 2, 0, 0.1); set('Rel', -0.15); set('Rwr', 0.1 - rig.shotT);
    set('Lsh', aim + 0.15, 0, -0.55); set('Lel', -0.9); set('Lwr', 0.2);
    set('Rclav', 0, 0.12, 0); set('Lclav', 0, -0.2, 0);
    fast = rig.shotT > 0;
  } else if (kind === 'melee') {
    if (sw >= 0) { set('Rsh', -2.7 + sw * 2.6, 0, 0.2); set('Rel', -0.4 + sw * 0.3); set('Rwr', -0.6 + sw * 1.1); set('Rclav', 0, 0, 0.15 - sw * 0.2); fast = true; }
    else { set('Rsh', -0.9 - st.pitch * 0.4 + s * 0.15 * sp, 0, 0.15); set('Rel', -1.3); set('Rwr', 0.3); }
    set('Lsh', s * 0.7 * sp - 0.2, 0, -0.15); set('Lel', -0.45 - Math.max(0, s) * 0.5 * sp); set('Lwr', 0.1);
  } else {   // poings : garde de boxeur, direct du droit
    const punch = sw >= 0 ? Math.sin(sw * Math.PI) : 0;
    set('Rsh', -1.1 - punch * 0.5 - st.pitch * 0.4, 0, 0.25); set('Rel', -1.9 + punch * 1.7); set('Rwr', 0.2 - punch * 0.3);
    set('Lsh', -1.1 - st.pitch * 0.4 + s * 0.1 * sp, 0, -0.25); set('Lel', -1.9); set('Lwr', 0.2);
    set('Rclav', 0, punch * 0.25, 0);
    fast = punch > 0;
  }
  if (st.weaponObj) st.weaponObj.rotation.x = kind === 'gun' ? Math.PI / 2 : 0;
  rig.canopy.visible = !!st.glide;
  if (st.hang || st.glide) {   // bras levés : accroché au pont roulant ou à la voile
    const swg = Math.sin(t * 2.5) * 0.15;
    set('Rsh', -Math.PI + 0.15, 0, 0.25); set('Rel', -0.1); set('Lsh', -Math.PI + 0.15, 0, -0.25); set('Lel', -0.1);
    set('Rclav', 0, 0, 0.3); set('Lclav', 0, 0, -0.3);
    set('Lhp', swg - 0.1); set('Rhp', -swg - 0.1); set('Lkn', 0.3); set('Rkn', 0.3); set('Lan', 0.3); set('Ran', 0.3);
    set('spine'); set('torso'); set('head', st.hang ? 0.3 : 0.1);
    if (st.weaponObj) st.weaponObj.visible = false;
  } else if (st.weaponObj) st.weaponObj.visible = true;
  if (st.win) {   // victoire : bras en V qui battent la mesure, petits sauts
    const pump = Math.sin(t * 8);
    set('Rsh', -2.7 + pump * 0.25, 0, 0.45); set('Lsh', -2.7 - pump * 0.25, 0, -0.45); set('Rel', -0.3); set('Lel', -0.3);
    set('Rwr', 0.4); set('Lwr', 0.4); set('Rclav', 0, 0, 0.35); set('Lclav', 0, 0, -0.35);
    set('torso', -0.25); set('spine', -0.1); set('head', -0.35, Math.sin(t * 3) * 0.3);
    const hop = Math.max(0, Math.sin(t * 8));
    T['hips.py'] = 50 + hop * 8;
    set('Lkn', 0.4 - hop * 0.3); set('Rkn', 0.4 - hop * 0.3); set('Lhp', -0.2); set('Rhp', -0.2);
    fast = true;
    if (st.weaponObj) st.weaponObj.visible = false;
  }
  // amorti vers les cibles (plus vif pour les coups et les tirs)
  const k = 1 - Math.exp(-dt * 14), kf = 1 - Math.exp(-dt * 40);
  for (const key in T) {
    const cur = rig.J[key] === undefined ? T[key] : rig.J[key];
    const quick = fast && (key[0] === 'R' || key[0] === 'L') && (key.includes('sh') || key.includes('el') || key.includes('wr') || key.includes('clav'));
    rig.J[key] = cur + (T[key] - cur) * (quick ? kf : k);
  }
  for (const key in rig.J) {
    const [bone, ax] = key.split('.');
    if (ax === 'py') rig.hips.position.y = rig.J[key];
    else rig.bones[bone].rotation[ax] = rig.J[key];
  }
  // chute à la mort : bascule avec l'accélération de la gravité, puis rebond amorti
  if (st.dead) {
    rig.dieT += dt;
    const kk = Math.min(1, rig.dieT * rig.dieT * 3.2);
    rig.body.rotation.x = rig.fallDir * (Math.PI / 2) * kk + (kk >= 1 ? Math.sin(Math.min(1, rig.dieT - 0.56) * 9) * 0.04 * Math.max(0, 1 - (rig.dieT - 0.56) * 2) : 0);
    rig.body.position.y = 6 * kk;
    rig.L.arm.sh.rotation.z = -0.9 * kk; rig.R.arm.sh.rotation.z = 0.9 * kk;
    rig.head.rotation.x = 0.4 * kk;
  } else { rig.dieT = 0; rig.body.rotation.x = 0; rig.body.position.y = 0; }
}

function startRoyaleClient() {
  const W = 960, H = 540;
  const MAP = trackInfo.map, PH = trackInfo.phys;
  const CEIL = MAP.ceil || 700;
  stage.innerHTML = '';
  $('#hudInfo').textContent = `Battle royale · ${MAP.title || ''}`;
  const wrap = document.createElement('div'); wrap.className = 'play-wrap'; stage.appendChild(wrap);
  const screen = document.createElement('div'); screen.className = 'tk-screen ry-screen'; wrap.appendChild(screen);
  const { c: cv, g } = makeCanvas(screen, W, H);
  cv.classList.add('tk-hud');
  const pad = document.createElement('div'); pad.className = 'touch-pad ry-pad';
  pad.innerHTML = `<div class="ry-stick" id="ryMove"><i></i></div>
    <div class="grp"><button data-b="jump">SAUT</button><button data-b="pick">PRENDRE</button><button data-b="swap">ARME</button><button data-b="drop">LÂCHER</button><button data-b="view">VUE</button></div>
    <button class="hot ry-fire" data-b="fire">TIR</button>
    <div class="ry-stick" id="ryAim"><i></i></div>`;
  wrap.appendChild(pad);
  const hint = document.createElement('p'); hint.className = 'keys-hint';
  hint.textContent = 'CLIQUE POUR CAPTURER LA SOURIS · ZQSD BOUGER · MAJ SPRINT · ESPACE SAUT · CLIC TIRER · E OUVRIR / PRENDRE · G LÂCHER · 1/2 ARME · V VUE';
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
  const groundAt = (x, y, z) => { let gz = 0; for (const o of around(x, y)) if (o.z <= z + PH.step && o.z > gz && touches(o, x, y, PH.pr * 0.7)) gz = o.z; return gz; };
  const bodyBlocked = (x, y, z) => {
    if (x < PH.pr || y < PH.pr || x > MAP.w - PH.pr || y > MAP.h - PH.pr) return true;
    for (const o of around(x, y)) if (o.z > z + PH.step && touches(o, x, y, PH.pr - 1)) return true;
    return false;
  };
  const pointBlocked = (x, y, z) => {
    if (x < 0 || y < 0 || x > MAP.w || y > MAP.h || z < 0 || z > CEIL) return true;
    for (const o of (GRID.get(Math.floor(x / CELL) + ',' + Math.floor(y / CELL)) || [])) if (o.x <= x && x <= o.x + o.w && o.y <= y && y <= o.y + o.h && z <= o.z) return true;
    return false;
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
    const ox = me.x; me.x += me.vx * dt; if (bodyBlocked(me.x, me.y, me.z)) { me.x = ox; me.vx = 0; }
    const oy = me.y; me.y += me.vy * dt; if (bodyBlocked(me.x, me.y, me.z)) { me.y = oy; me.vy = 0; }
    const wasAir = !me.gd, fall = me.vz;
    me.z += me.vz * dt;
    const gz = groundAt(me.x, me.y, Math.max(me.z, 0));
    if (me.z <= gz) { me.z = gz; me.vz = 0; me.gd = true; if (me.gl) { me.gl = false; sfx(120, 0.2, 'triangle', 0.05); } if (wasAir && fall < -300) { sfx(90, 0.08, 'triangle', 0.05); landKick = Math.min(1, -fall / 900); } }
    else me.gd = false;
    if (me.z + PH.body > CEIL) { me.z = CEIL - PH.body; me.vz = Math.min(0, me.vz); }
  }

  let mode = save.ryView === 'tps' ? 'tps' : 'fps';
  let prev = null, cur = null, curAt = 0, prevAt = 0, seenEv = 0;
  let loot = [], chestList = [];
  const floats = [], feed = [], dmgDirs = [];
  let shake = 0, banner = '', bannerAt = 0, hitMark = 0, hitHead = false, landKick = 0, recoil = 0, swingVm = 0, bob = 0, stepAcc = 0;
  let swayX = 0, swayY = 0;

  /* ---------- entrées ---------- */
  const B = { FIRE: 16, PICK: 32, SWAP: 64, JUMP: 128, RUN: 256, DROP: 512 };
  const held = new Set();
  let fireHeld = false, jumpQueued = false, mask = 0, lastSend = 0, sentMask = -1, touchMove = null, touchLook = null;
  const pressBits = { v: 0 };
  const isTouch = matchMedia('(pointer: coarse)').matches;
  const tap = bit => { pressBits.v |= bit; sendInput(true); };
  function sendInput(force) {
    const now = performance.now();
    const live = cur && cur.phase === 'play' && cur.p[mySeat] && cur.p[mySeat].al && !cur.p[mySeat].bu;
    mask = (fireHeld ? B.FIRE : 0) | (held.has('ShiftLeft') || held.has('ShiftRight') ? B.RUN : 0) | pressBits.v;
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
    else if (e.code === 'Digit1' || e.code === 'Digit2') { const want = e.code === 'Digit1' ? 0 : 1; const p = cur && cur.p[mySeat]; if (p && p.c !== want) tap(B.SWAP); }
    else if (e.code === 'KeyG') { e.preventDefault(); tap(B.DROP); }
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
    if (e.button === 0 || document.pointerLockElement === screen) { fireHeld = true; sendInput(true); }
  });
  const onMove = e => { if (document.pointerLockElement === screen || dragging) look(e.movementX || 0, e.movementY || 0); };
  const onUp = e => { if (e.pointerType === 'touch') return; dragging = false; if (fireHeld && !touchFire) { fireHeld = false; sendInput(true); } };
  document.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  screen.addEventListener('wheel', e => { e.preventDefault(); tap(B.SWAP); }, { passive: false });
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
      else if (k === 'drop') tap(B.DROP);
      else if (k === 'fire') { touchFire = fireHeld = true; sendInput(true); b.classList.add('on'); }
    });
    if (b.dataset.b === 'fire') ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => b.addEventListener(ev, () => { touchFire = fireHeld = false; b.classList.remove('on'); sendInput(true); }));
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
  const SKY = !!MAP.sky;
  scene.background = new THREE.Color(SKY ? '#9db4c8' : '#1a120d');
  scene.fog = new THREE.Fog(SKY ? '#b9c6cf' : '#1a120d', SKY ? 1200 : 700, SKY ? 4200 : 2900);
  const cam = new THREE.PerspectiveCamera(72, W / H, 2, SKY ? 6000 : 3400);
  scene.add(new THREE.HemisphereLight(SKY ? '#e8f0ff' : '#ffe8d0', SKY ? '#5a4632' : '#3a1c0c', SKY ? 1.0 : 0.85));
  const sun = new THREE.DirectionalLight(SKY ? '#fff6e6' : '#ffd8b0', SKY ? 0.9 : 0.55); sun.position.set(0.4, 1, 0.25); scene.add(sun);
  // sol propre à chaque carte
  const FLOOR = {
    halle: { base: '#4a4440', lines: [[0, 1100, MAP.w, 1100], [0, 1900, MAP.w, 1900], [800, 0, 800, MAP.h], [3500, 0, 3500, MAP.h]] },
    forge: { base: '#3a3330', lines: [[0, MAP.h / 2, MAP.w, MAP.h / 2], [MAP.w / 2, 0, MAP.w / 2, MAP.h]], soot: true },
    laminoir: { base: '#55524e', lines: [[0, MAP.h / 2 - 220, MAP.w, MAP.h / 2 - 220], [0, MAP.h / 2 + 220, MAP.w, MAP.h / 2 + 220]] },
    ferraille: { base: '#6b5a44', lines: [], dirt: true },
  }[MAP.key] || { base: '#4a4440', lines: [] };
  const floorTex = tkTexture(1100, Math.round(1100 * MAP.h / MAP.w), (b, w, h) => {
    const k = w / MAP.w;
    b.fillStyle = FLOOR.base; b.fillRect(0, 0, w, h);
    if (FLOOR.dirt) {
      for (let i = 0; i < 1400; i++) { b.fillStyle = `rgba(${Math.random() < 0.5 ? '40,30,20' : '150,130,100'},${0.05 + Math.random() * 0.1})`; b.beginPath(); b.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 6, 0, Math.PI * 2); b.fill(); }
      for (let i = 0; i < 30; i++) { b.fillStyle = 'rgba(70,90,110,.35)'; b.beginPath(); b.ellipse(Math.random() * w, Math.random() * h, 8 + Math.random() * 20, 4 + Math.random() * 10, Math.random() * 3, 0, Math.PI * 2); b.fill(); }
    } else for (let x = 0; x < MAP.w; x += 200) for (let y = 0; y < MAP.h; y += 200) { b.fillStyle = `rgba(0,0,0,${0.03 + ((x * 7 + y * 13) % 5) * 0.015})`; b.fillRect(x * k + 1, y * k + 1, 200 * k - 2, 200 * k - 2); }
    for (let i = 0; i < (FLOOR.soot ? 520 : 260); i++) { b.fillStyle = `rgba(20,14,10,${0.08 + Math.random() * 0.12})`; b.beginPath(); b.ellipse(Math.random() * w, Math.random() * h, 3 + Math.random() * 14, 2 + Math.random() * 8, Math.random() * 3, 0, Math.PI * 2); b.fill(); }
    b.strokeStyle = 'rgba(245,183,0,.75)'; b.lineWidth = 3; b.setLineDash([16, 10]);
    FLOOR.lines.forEach(([a, c, d, e]) => { b.beginPath(); b.moveTo(a * k, c * k); b.lineTo(d * k, e * k); b.stroke(); });
    b.setLineDash([]);
    b.font = `900 ${Math.round(90 * k * 3)}px "Big Shoulders Display", Impact`; b.fillStyle = 'rgba(255,255,255,.09)'; b.textAlign = 'center';
    b.fillText(`ESFF 101 · ${(MAP.title || '').toUpperCase()}`, w / 2, h / 2 + 330 * k);
  });
  floorTex.anisotropy = 4;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(MAP.w, MAP.h), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.92 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(MAP.w / 2, 0, MAP.h / 2); scene.add(floor);
  if (!SKY) {   // toiture : tôle sombre, fermes métalliques et verrières
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(MAP.w, MAP.h), new THREE.MeshStandardMaterial({ color: '#221c19', roughness: 1 }));
    roof.rotation.x = Math.PI / 2; roof.position.set(MAP.w / 2, CEIL, MAP.h / 2); scene.add(roof);
    const beamMat = ryMat('#3a3d42', { metalness: 0.6, roughness: 0.5 }), skyMat = new THREE.MeshBasicMaterial({ color: '#c9d6e0' });
    for (let x = 300; x < MAP.w; x += 600) {
      const bm = new THREE.Mesh(new THREE.BoxGeometry(24, 40, MAP.h), beamMat); bm.position.set(x, CEIL - 20, MAP.h / 2); scene.add(bm);
      const sk = new THREE.Mesh(new THREE.PlaneGeometry(180, MAP.h - 400), skyMat); sk.rotation.x = Math.PI / 2; sk.position.set(x + 300, CEIL - 1, MAP.h / 2); scene.add(sk);
    }
  }
  // obstacles avec textures dessinées
  const stripes = (b, w, y, hh) => { b.fillStyle = '#F5B700'; b.fillRect(0, y, w, hh); b.fillStyle = '#1a1a1a'; for (let x = -hh; x < w; x += hh * 2) { b.beginPath(); b.moveTo(x, y + hh); b.lineTo(x + hh, y); b.lineTo(x + hh * 1.6, y); b.lineTo(x + hh * 0.6, y + hh); b.fill(); } };
  const T = {
    conteneur: tkTexture(256, 128, (b, w, h) => { b.fillStyle = '#9e2430'; b.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 16) { b.fillStyle = 'rgba(255,255,255,.08)'; b.fillRect(x, 0, 6, h); b.fillStyle = 'rgba(0,0,0,.2)'; b.fillRect(x + 8, 0, 4, h); } b.fillStyle = 'rgba(255,255,255,.65)'; b.font = '900 22px Archivo, sans-serif'; b.fillText('ESFF 101', 18, 40); b.fillStyle = 'rgba(0,0,0,.25)'; b.fillRect(0, h - 8, w, 8); }),
    moules: tkTexture(128, 128, (b, w, h) => { b.fillStyle = '#8b6a46'; b.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 32) { b.fillStyle = 'rgba(0,0,0,.28)'; b.fillRect(0, y, w, 3); b.fillStyle = 'rgba(255,230,190,.12)'; b.fillRect(0, y + 3, w, 3); } for (let i = 0; i < 300; i++) { b.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,240,210'},.08)`; b.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }),
    mur: tkTexture(256, 256, (b, w, h) => { b.fillStyle = '#5c6067'; b.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 12) { b.fillStyle = 'rgba(255,255,255,.06)'; b.fillRect(x, 0, 5, h); b.fillStyle = 'rgba(0,0,0,.15)'; b.fillRect(x + 6, 0, 3, h); } b.fillStyle = '#3a3634'; b.fillRect(0, h - 40, w, 40); b.fillStyle = '#F5B700'; for (let x = 0; x < w; x += 32) { b.beginPath(); b.moveTo(x, h - 40); b.lineTo(x + 16, h - 40); b.lineTo(x + 8, h - 32); b.fill(); } }),
    cloture: tkTexture(128, 128, (b, w, h) => { b.fillStyle = '#7a7f86'; b.fillRect(0, 0, w, h); b.strokeStyle = 'rgba(40,40,40,.55)'; b.lineWidth = 2; for (let k = -w; k < w * 2; k += 14) { b.beginPath(); b.moveTo(k, 0); b.lineTo(k + h, h); b.moveTo(k + h, 0); b.lineTo(k, h); b.stroke(); } b.fillStyle = '#4a4e54'; b.fillRect(0, 0, w, 8); }),
    bureau: tkTexture(256, 128, (b, w, h) => { b.fillStyle = '#2b4fa8'; b.fillRect(0, 0, w, h); for (let x = 12; x < w; x += 60) { b.fillStyle = '#9fd0ff'; b.fillRect(x, 26, 44, 40); b.fillStyle = 'rgba(255,255,255,.35)'; b.fillRect(x, 26, 44, 6); } b.fillStyle = '#fff'; b.font = '900 18px Archivo'; b.fillText('BUREAUX · LABO', 12, 100); }),
    cabine: tkTexture(256, 128, (b, w, h) => { b.fillStyle = '#3a3d42'; b.fillRect(0, 0, w, h); b.fillStyle = '#9fd0ff'; b.fillRect(10, 18, w - 20, 54); b.fillStyle = 'rgba(255,255,255,.3)'; b.fillRect(10, 18, w - 20, 10); stripes(b, w, h - 22, 22); }),
    palette: tkTexture(128, 64, (b, w, h) => { b.fillStyle = '#6b4c2c'; b.fillRect(0, 0, w, h); b.fillStyle = '#a07a4c'; for (let x = 4; x < w; x += 24) b.fillRect(x, 0, 18, h); }),
    etabli: tkTexture(128, 64, (b, w, h) => { b.fillStyle = '#8b6a46'; b.fillRect(0, 0, w, h); b.fillStyle = '#5c4630'; b.fillRect(0, 0, w, 12); b.fillStyle = '#4a4e54'; b.fillRect(10, 24, 30, 10); b.fillRect(70, 30, 40, 8); }),
    convoyeur: tkTexture(128, 64, (b, w, h) => { b.fillStyle = '#26292d'; b.fillRect(0, 0, w, h); b.fillStyle = '#5c6067'; for (let x = 0; x < w; x += 16) b.fillRect(x, 6, 8, h - 12); b.fillStyle = '#F5B700'; b.fillRect(0, 0, w, 4); b.fillRect(0, h - 4, w, 4); }),
    barres: tkTexture(128, 64, (b, w, h) => { b.fillStyle = '#2b2e33'; b.fillRect(0, 0, w, h); for (let y = 4; y < h; y += 8) { b.fillStyle = `hsl(20,${10 + Math.random() * 20}%,${30 + Math.random() * 15}%)`; b.fillRect(0, y, w, 6); } }),
    brames: tkTexture(128, 64, (b, w, h) => { for (let y = 0; y < h; y += 16) { b.fillStyle = `hsl(${15 + Math.random() * 10},45%,${26 + Math.random() * 10}%)`; b.fillRect(0, y, w, 14); b.fillStyle = 'rgba(0,0,0,.4)'; b.fillRect(0, y + 14, w, 2); } }),
    cube: tkTexture(64, 64, (b, w, h) => { const c = ['#BA2C3A', '#2b6cb0', '#7FD48A', '#F5B700', '#9aa0a6', '#5c4630']; for (let i = 0; i < 26; i++) { b.fillStyle = c[i % c.length]; b.fillRect(Math.random() * w - 8, Math.random() * h - 4, 10 + Math.random() * 24, 4 + Math.random() * 8); } b.strokeStyle = 'rgba(0,0,0,.5)'; b.strokeRect(1, 1, w - 2, h - 2); }),
    pilon: tkTexture(128, 256, (b, w, h) => { b.fillStyle = '#3a3d42'; b.fillRect(0, 0, w, h); b.fillStyle = 'rgba(255,255,255,.07)'; b.fillRect(10, 0, 14, h); stripes(b, w, 30, 18); stripes(b, w, h - 24, 18); }),
    cage: tkTexture(128, 256, (b, w, h) => { b.fillStyle = '#4f5a66'; b.fillRect(0, 0, w, h); b.fillStyle = '#2b2e33'; b.fillRect(20, 60, w - 40, 90); b.fillStyle = '#9aa4ae'; b.beginPath(); b.arc(w / 2, 85, 22, 0, Math.PI * 2); b.arc(w / 2, 125, 22, 0, Math.PI * 2); b.fill(); stripes(b, w, h - 20, 16); }),
  };
  T.rouleaux = T.convoyeur;
  const lights = [];
  const COL = { four: '#3a302a', silo: '#9aa0a6', pilier: '#4a4e54', poche: '#3a3d42', foyer: '#2b2522', enclume: '#24272b', cuve: '#1d2a33',
    bobine: '#9aa4ae', tas: '#6b4a33', grue: '#F5B700', benne: '#2b6cb0', presse: '#3a5f3a' };
  const METAL = ['silo', 'poche', 'pilier', 'enclume', 'bobine', 'grue', 'benne', 'presse', 'cuve'];
  const ROUND = { four: 1, silo: 1, poche: 0.78, bobine: 1 };
  const GLOW = { four: '#ffb347', poche: '#ffb347', foyer: '#ff6a1a' };
  const texMats = new Map();
  for (const o of MAP.obs) {
    const h = o.z;
    let mat;
    if (T[o.k]) {   // une matière par type et par répétition de motif, partagée entre obstacles semblables
      const big = o.k === 'mur' || o.k === 'cloture';
      const rx = Math.max(1, Math.round(Math.max(o.w, o.h) / (big ? 300 : 120))), ry = big ? Math.max(1, Math.round(h / 300)) : 1;
      const key = o.k + rx + 'x' + ry;
      if (!texMats.has(key)) {
        const t = T[o.k].clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
        texMats.set(key, new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, metalness: ['conteneur', 'pilon', 'cage', 'cube'].includes(o.k) ? 0.35 : 0.05 }));
      }
      mat = texMats.get(key);
    } else mat = ryMat(COL[o.k] || '#555', { metalness: METAL.includes(o.k) ? 0.6 : 0.1, roughness: ['silo', 'bobine'].includes(o.k) ? 0.35 : 0.8 });
    const r = Math.min(o.w, o.h) / 2;
    const geo = o.k === 'tas' ? new THREE.ConeGeometry(r * 1.1, h, 9) : ROUND[o.k] ? new THREE.CylinderGeometry(r, r * ROUND[o.k], h, 24) : new THREE.BoxGeometry(o.w, h, o.h);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(o.x + o.w / 2, h / 2, o.y + o.h / 2);
    if (o.k === 'tas') m.rotation.y = (o.x * 7 + o.y) % 3;
    scene.add(m);
    if (GLOW[o.k]) {
      const top = new THREE.Mesh(new THREE.CircleGeometry(Math.min(o.w, o.h) * 0.38, 20), new THREE.MeshBasicMaterial({ color: GLOW[o.k] }));
      top.rotation.x = -Math.PI / 2; top.position.set(o.x + o.w / 2, h + 1, o.y + o.h / 2); scene.add(top);
    }
    if (o.k === 'cuve') {
      const oil = new THREE.Mesh(new THREE.PlaneGeometry(o.w - 12, o.h - 12), ryMat('#0d1418', { metalness: 0.9, roughness: 0.1 }));
      oil.rotation.x = -Math.PI / 2; oil.position.set(o.x + o.w / 2, h + 0.5, o.y + o.h / 2); scene.add(oil);
    }
    if (o.k === 'grue') {   // flèche de la grue
      const jib = new THREE.Mesh(new THREE.BoxGeometry(900, 40, 40), ryMat('#F5B700', { metalness: 0.5 })); jib.position.set(o.x + o.w / 2 + 300, h - 30, o.y + o.h / 2); scene.add(jib);
    }
    if ((o.k === 'four' || o.k === 'foyer') && lights.length < 6) {
      if (o.k === 'four') { const door = new THREE.Mesh(new THREE.PlaneGeometry(50, 40), new THREE.MeshBasicMaterial({ color: '#ff8a2a' })); door.position.set(o.x + o.w / 2, 40, o.y + o.h + 0.5); scene.add(door); }
      const pl = new THREE.PointLight('#ff7a2a', 1.6, 900, 1.5); pl.position.set(o.x + o.w / 2, h + 80, o.y + o.h / 2); scene.add(pl); lights.push(pl);
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
  // coffres de l'atelier : caisse rouge à couvercle qui s'ouvre, lueur dorée tant qu'elle est fermée
  const chestBody = tkTexture(128, 64, (b, w, h) => { b.fillStyle = '#9e2430'; b.fillRect(0, 0, w, h); b.fillStyle = '#4a4e54'; b.fillRect(0, 0, w, 6); b.fillRect(0, h - 6, w, 6); b.fillRect(10, 0, 8, h); b.fillRect(w - 18, 0, 8, h); b.fillStyle = '#F5B700'; b.fillRect(w / 2 - 8, 6, 16, 14); });
  const chestMat = new THREE.MeshStandardMaterial({ map: chestBody, roughness: 0.5, metalness: 0.3 });
  const chestLidMat = ryMat('#7a1c26', { metalness: 0.3, roughness: 0.5 });
  const chests = new Map();
  const chestGlowGeo = new THREE.CylinderGeometry(3, 3, 1, 6, 1, true);
  const syncChests = list => {
    for (const c of list) {
      let ch = chests.get(c[0]);
      if (!ch) {
        const grp = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(56, 30, 34), chestMat); body.position.y = 15; grp.add(body);
        const hinge = new THREE.Group(); hinge.position.set(0, 30, -17); grp.add(hinge);
        const lid = new THREE.Mesh(new THREE.BoxGeometry(58, 8, 36), chestLidMat); lid.position.set(0, 4, 17); hinge.add(lid);
        const glow = new THREE.Mesh(chestGlowGeo, new THREE.MeshBasicMaterial({ color: '#F5B700', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
        glow.scale.y = 90; glow.position.y = 45; grp.add(glow);
        grp.position.set(c[1], c[3], c[2]); grp.rotation.y = Math.PI / 2 - c[4];
        scene.add(grp);
        ch = { grp, hinge, glow, open: false, t: 0 };
        chests.set(c[0], ch);
      }
      if (c[5] && !ch.open) { ch.open = true; ch.t = 0; }
    }
  };
  // pont roulant jaune qui traverse la halle au début de la partie
  const crane = new THREE.Group();
  const craneTex = tkTexture(256, 32, g2 => { g2.fillStyle = '#F5B700'; g2.fillRect(0, 0, 256, 32); g2.fillStyle = '#1a1a1a'; for (let x = -32; x < 256; x += 32) { g2.beginPath(); g2.moveTo(x, 32); g2.lineTo(x + 16, 0); g2.lineTo(x + 28, 0); g2.lineTo(x + 12, 32); g2.fill(); } }, [8, 1]);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(70, 34, MAP.h), new THREE.MeshStandardMaterial({ map: craneTex, metalness: 0.4, roughness: 0.5 }));
  const BUSZ = MAP.busZ || 560;
  beam.position.y = BUSZ + 140; crane.add(beam);
  [80, MAP.h - 80].forEach(zz => { const tr = new THREE.Mesh(new THREE.BoxGeometry(110, 50, 80), ryMat('#3a3d42', { metalness: 0.6 })); tr.position.set(0, BUSZ + 150, zz - MAP.h / 2); crane.add(tr); });
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
  const snaps = [];
  let victory = null, myPlace = 0;
  function push(v) {
    prev = cur || v; prevAt = curAt || performance.now(); cur = v; curAt = performance.now();
    snaps.push({ at: curAt, v }); if (snaps.length > 30) snaps.shift();
    if (v.loot) { loot = v.loot; syncLoot(); }
    if (v.ch) { chestList = v.ch; syncChests(v.ch); }
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
        if (mine) { myPlace = (e.left || 0) + 1; banner = `ÉLIMINÉ · TOP ${myPlace}`; bannerAt = performance.now(); sfx(70, 0.8, 'sawtooth', 0.08, -20); }
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
      } else if (e.k === 'chest') {
        burst(e.x, e.y, e.z + 30, 30, '#F5B700', 260, 0.7, 160);
        if (mine || Math.hypot(e.x - me.x, e.y - me.y) < 600) { sfx(330, 0.12, 'triangle', 0.05, 200); setTimeout(() => sfx(990, 0.25, 'triangle', 0.05, 400), 120); }
      } else if (e.k === 'throw') {
        if (mine) sfx(240, 0.08, 'triangle', 0.04, -100);
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
  const DELAY = 110;      // ms de retard d'affichage : on interpole toujours entre deux états reçus, sans à-coups
  function interp() {
    const rt = performance.now() - DELAY;
    let a = snaps[0], b = snaps[snaps.length - 1];
    for (let k = snaps.length - 1; k > 0; k--) if (snaps[k - 1].at <= rt) { a = snaps[k - 1]; b = snaps[k]; break; }
    const span = Math.max(16, b.at - a.at);
    const t = Math.max(0, Math.min(1.6, (rt - a.at) / span));        // au-delà de 1 : courte extrapolation
    return cur.p.map((p, i) => {
      if (i === mySeat && p.al && !p.bu) return { ...p, x: me.x, y: me.y, z: me.z, a: me.yaw, pt: me.pitch, vx: me.vx, vy: me.vy, gl: me.gl };
      if (!p.al) return p;
      const q = a.v.p[i] || p, r = b.v.p[i] || p;
      if (!q.al) return { ...r };
      return { ...p, x: lerp(q.x, r.x, t), y: lerp(q.y, r.y, t), z: lerp(q.z, r.z, Math.min(1, t)), a: angLerp(q.a, r.a, Math.min(1, t)), pt: lerp(q.pt || 0, r.pt || 0, Math.min(1, t)),
        vx: (r.x - q.x) / (span / 1000), vy: (r.y - q.y) / (span / 1000), sw: r.sw, s: r.s, c: r.c };
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
    if (sp && sp.m === 'metallurgiste') {
      for (const it of loot) if (it[5] >= 2) { g.fillStyle = RY_RARITY[it[5]].color; g.fillRect(mx + it[1] * k - 1.5, my + it[2] * k - 1.5, 3, 3); }
      g.fillStyle = '#F5B700'; for (const c of chestList) if (!c[5]) g.fillRect(mx + c[1] * k - 1, my + c[2] * k - 1, 2, 2);
    }
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
      // ce qu'il y a à portée : une arme à ramasser, sinon un coffre à ouvrir
      const RCH = trackInfo.reach || { item: 55, chest: 80 };
      const near = loot.filter(it => (it[1] - me.x) ** 2 + (it[2] - me.y) ** 2 < RCH.item ** 2 && Math.abs(it[3] - me.z) < 70)
        .sort((a, b) => ((a[1] - me.x) ** 2 + (a[2] - me.y) ** 2) - ((b[1] - me.x) ** 2 + (b[2] - me.y) ** 2))[0];
      const box = !near && chestList.find(c => !c[5] && (c[1] - me.x) ** 2 + (c[2] - me.y) ** 2 < RCH.chest ** 2 && Math.abs(c[3] - me.z) < 70);
      g.font = '400 9px "Press Start 2P", monospace'; g.textAlign = 'center';
      if (near) {
        g.fillStyle = RY_RARITY[near[5]].color;
        g.fillText(`E : ${sp.s[0] && sp.s[1] ? 'ÉCHANGER CONTRE' : 'PRENDRE'} ${RY_WEAPONS[near[4]].toUpperCase()} ${RY_RARITY[near[5]].name.toUpperCase()}`, W / 2, by - 22);
      } else if (box) { g.fillStyle = '#F5B700'; g.fillText('E : OUVRIR LE COFFRE', W / 2, by - 22); }
      else if (sp.s[sp.c]) { g.fillStyle = 'rgba(255,255,255,.5)'; g.fillText('G : LÂCHER L\'ARME', W / 2, by - 22); }
      if (!sp.s[0] && !sp.s[1] && cur.time < 40 && !sp.bu && !sp.gl && !near && !box) {
        g.font = '400 9px "Press Start 2P", monospace'; g.textAlign = 'center'; g.fillStyle = '#ffd27a';
        g.fillText('À MAINS NUES : OUVRE LES COFFRES (LUEUR DORÉE)', W / 2, by - 22);
      }
    } else if (sp) {
      g.font = '400 11px "Press Start 2P", monospace'; g.textAlign = 'center'; g.fillStyle = '#ff8a8a';
      g.fillText(`SPECTATEUR · ${cur.p[fi].n.toUpperCase()}`, W / 2, H - 30);
    }
    g.font = '400 8px "Press Start 2P", monospace'; g.textAlign = 'left'; g.fillStyle = '#9aa0a6';
    g.fillText(`${mode === 'fps' ? '1RE' : '3E'} PERSONNE (V)`, 14, my + mh + 16);
    if (sp && sp.al && sp.bu) {
      const left = Math.max(0, Math.ceil((trackInfo.busTime || 16) - (cur.time || 0)));
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
    if (victory) {   // écran de victoire : TOP 1 en lettres de métal qui claquent
      const vt = (performance.now() - victory.t0) / 1000;
      g.clearRect(0, 0, W, H);
      g.fillStyle = '#000'; g.fillRect(0, 0, W, 60 * Math.min(1, vt * 3)); g.fillRect(0, H - 60 * Math.min(1, vt * 3), W, 60);
      const k = Math.min(1, vt / 0.45), s2 = 1 + (1 - k) * 2.5;
      g.save(); g.translate(W / 2, 170); g.scale(s2, s2); g.globalAlpha = k;
      g.font = '900 120px "Big Shoulders Display", Impact'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 12; g.strokeStyle = '#000'; g.strokeText('TOP 1', 0, 0);
      const gr = g.createLinearGradient(0, -60, 0, 60); gr.addColorStop(0, '#fffbe6'); gr.addColorStop(0.45, '#ffd27a'); gr.addColorStop(0.55, '#F5B700'); gr.addColorStop(1, '#8a3a0a');
      g.fillStyle = gr; g.shadowColor = '#ff8a2a'; g.shadowBlur = 30; g.fillText('TOP 1', 0, 0); g.restore();
      if (vt > 0.5) {
        g.globalAlpha = Math.min(1, (vt - 0.5) / 0.4); g.font = '400 16px "Press Start 2P", monospace'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = '#fff';
        g.fillText('DERNIER DEBOUT DE LA COULÉE !', W / 2, 260);
        g.font = '900 26px "Big Shoulders Display", Impact'; g.fillStyle = '#F5B700';
        const kills = sp ? sp.k : 0;
        g.fillText(`${kills} ÉLIMINATION${kills > 1 ? 'S' : ''} · ${(RY_METIERS[sp ? sp.m : 'fondeur'] || RY_METIERS.fondeur).name.toUpperCase()}`, W / 2, 300);
        g.globalAlpha = 1;
      }
      return;
    }
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
    // pont roulant
    crane.position.x = cur.crane || 200;
    crane.visible = cur.p.some(q => q.bu) || cur.phase === 'count';
    // coffres : le couvercle bascule à l'ouverture, la lueur s'éteint
    for (const ch of chests.values()) {
      if (ch.open && ch.t < 1) { ch.t = Math.min(1, ch.t + dt * 3); ch.hinge.rotation.x = -1.9 * (1 - (1 - ch.t) ** 3); ch.glow.material.opacity = 0.35 * (1 - ch.t); }
      else if (!ch.open) ch.glow.material.opacity = 0.25 + Math.sin(t * 3 + ch.grp.position.x) * 0.1;
    }
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
    const firstPerson = mode === 'fps' && fi === mySeat && alive && !sp.bu && !victory;   // le spectateur suit toujours par-dessus l'épaule
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
      const winner = !!victory && i === mySeat;
      ryPose(rig, { speed: p.bu || winner ? 0 : Math.hypot(p.vx || 0, p.vy || 0), air, pitch: winner ? 0 : p.pt || 0, wid: s ? s.w : 'poings', weaponObj: rig.weapon, dead: !p.al, hang: p.bu, glide: p.gl, win: winner }, dt);
    });
    // caméra
    const fa = fi === mySeat && alive ? me.yaw : f.a, fp = fi === mySeat && alive ? me.pitch : (f.pt || 0);
    const eyeZ = f.z + PH.eye - landKick * 8 + (firstPerson ? Math.sin(bob * 2) * 1.6 : 0);
    const dir = new THREE.Vector3(Math.cos(fa) * Math.cos(fp), Math.sin(fp), Math.sin(fa) * Math.cos(fp));
    if (victory) {
      // top 1 : la caméra tourne autour du vainqueur pendant que la fonte jaillit en gerbes dorées
      const vt = (performance.now() - victory.t0) / 1000, ang = vt * 0.7 + fa + Math.PI;
      const R0 = 210 - Math.min(1, vt / 2) * 70;
      cam.position.set(f.x + Math.cos(ang) * R0, f.z + 75 + Math.sin(vt * 0.8) * 15, f.y + Math.sin(ang) * R0);
      cam.lookAt(f.x, f.z + 75, f.y);
      if (Math.random() < 0.7) burst(f.x + (Math.random() - 0.5) * 60, f.y + (Math.random() - 0.5) * 60, f.z + 10, 4, Math.random() < 0.5 ? '#F5B700' : '#ff8a2a', 300, 1.2, 420);
      if (vt > 0.2 && Math.floor(vt * 2) !== victory.beat) {
        victory.beat = Math.floor(vt * 2);
        burst(f.x + (Math.random() - 0.5) * 300, f.y + (Math.random() - 0.5) * 300, f.z + 220, 40, ['#F5B700', '#ff6a3a', '#ffffff', '#7fd4ff'][victory.beat % 4], 500, 1.2, 50);
        sfx(600 + (victory.beat % 4) * 120, 0.15, 'triangle', 0.04);
      }
    } else if (firstPerson) {
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
    if (!victory) cam.lookAt(cam.position.x + dir.x * 100, cam.position.y + dir.y * 100 + recoil * 3, cam.position.z + dir.z * 100);
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
    if (firstPerson && !me.gl) {
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
    victory() {
      victory = { t0: performance.now(), beat: -1 };
      if (document.pointerLockElement) document.exitPointerLock();
      [523, 659, 784, 1047].forEach((f, k) => setTimeout(() => sfx(f, 0.35, 'square', 0.05), k * 160));
      setTimeout(() => { sfx(1047, 0.9, 'triangle', 0.06); sfx(784, 0.9, 'triangle', 0.04); }, 700);
    },
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
