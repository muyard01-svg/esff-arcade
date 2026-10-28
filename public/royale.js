/* Coulée Royale — battle royale des métiers de la métallurgie (simulation serveur : royale.py)
   Vue 2D du dessus ou 3D (three.js), bascule avec V et effet d'ondulation. */
'use strict';

const RY_METIERS = {
  forgeron: { name: 'Forgeron', color: '#BA2C3A', perk: '+15 % de dégâts en mêlée' },
  fondeur: { name: 'Fondeur', color: '#EC641E', perk: '-40 % de dégâts dans la fonte' },
  mouleur: { name: 'Mouleur', color: '#8A8D91', perk: '+8 % de vitesse' },
  noyauteur: { name: 'Noyauteur', color: '#C4A06E', perk: 'soins +40 %' },
  ebarbeur: { name: 'Ébarbeur', color: '#2E3238', perk: 'cadence de tir +12 %' },
  lamineur: { name: 'Lamineur', color: '#5AA8FF', perk: 'commence avec 25 d\'armure' },
  chaudronnier: { name: 'Chaudronnier', color: '#7FD48A', perk: 'tabliers +30 %' },
  soudeur: { name: 'Soudeur', color: '#F5B700', perk: '+20 % au chalumeau et à la louche' },
  metallurgiste: { name: 'Métallurgiste', color: '#C77DFF', perk: 'voit les armes rares sur la mini-carte' },
};
const RY_RARITY = [
  { name: 'commun', color: '#b8bcc2' }, { name: 'rare', color: '#5AA8FF' }, { name: 'épique', color: '#C77DFF' }, { name: 'légendaire', color: '#F5B700' },
];
const RY_WEAPONS = {
  poings: 'Poings', pince: 'Pince de forgeron', marteau: 'Marteau de forge', masse: 'Masse à frapper', ringard: 'Ringard',
  riveteuse: 'Riveteuse', grenaille: 'Canon à grenaille', louche: 'Louche de fonte', chalumeau: 'Chalumeau',
};

ONLINE.unshift({
  id: 'royale', title: 'Coulée Royale', tone: '#EC641E', label: 'Battle royale · jusqu\'à 16', tag: 'BATTLE ROYALE',
  pitch: 'Forgerons, fondeurs, soudeurs… tous les métiers de la métallurgie s\'affrontent dans une halle de fonderie que la fonte envahit. 100 PV, des armes de l\'atelier, le dernier debout gagne.',
  how: '<b>ZQSD / WASD / flèches</b> se déplacer · <b>souris</b> viser · <b>clic</b> ou <b>Espace</b> frapper / tirer · <b>E</b> ramasser · <b>Tab</b> ou <b>molette</b> changer d\'arme · <b>V</b> vue 2D / 3D. Les armes vont du commun (gris) au légendaire (or) : plus elles sont rares, plus elles font mal.',
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
function stopRoyale() { if (ryClient) { ryClient.stop(); ryClient = null; } }

function updateRoyale() {
  if (!trackInfo || !trackInfo.map) return;
  if (view.finished) {
    if (ryClient && !ryClient.endShown) { ryClient.push(view); ryClient.endShown = true; setTimeout(() => updateRoyale(), 2200); return; }
    if (document.getElementById('rewardBox')) return;
    stopRoyale();
    resultScreen(view.finished.slice(0, 10).map((i, k) => {
      const p = view.p[i], m = RY_METIERS[p.m];
      return `<li><b>${k + 1}</b><i style="background:${m.color}"></i><span>${esc(p.n)} · ${m.name}${i === mySeat ? ' (toi)' : ''}</span><em>${p.k} élimination${p.k > 1 ? 's' : ''}</em></li>`;
    }));
    return;
  }
  if (!ryClient) ryClient = startRoyaleClient();
  ryClient.push(view);
}

function startRoyaleClient() {
  const W = 960, H = 540;
  const MAP = trackInfo.map;
  stage.innerHTML = '';
  $('#hudInfo').textContent = 'Battle royale';
  const wrap = document.createElement('div'); wrap.className = 'play-wrap'; stage.appendChild(wrap);
  const screen = document.createElement('div'); screen.className = 'tk-screen ry-screen'; wrap.appendChild(screen);
  const { c: cv, g } = makeCanvas(screen, W, H);
  cv.classList.add('tk-hud');
  const pad = document.createElement('div'); pad.className = 'touch-pad ry-pad';
  pad.innerHTML = `<div class="ry-stick" id="ryMove"><i></i></div>
    <div class="grp"><button data-b="pick">PRENDRE</button><button data-b="swap">ARME</button><button data-b="view">VUE</button></div>
    <div class="ry-stick fire" id="ryAim"><i></i></div>`;
  wrap.appendChild(pad);
  const hint = document.createElement('p'); hint.className = 'keys-hint';
  hint.textContent = 'ZQSD / FLÈCHES · SOURIS VISER · CLIC TIRER · E RAMASSER · TAB ARME · V VUE 2D/3D';
  wrap.appendChild(hint);

  let mode = save.ryView === '3d' ? '3d' : '2d';
  let three = null;
  let prev = null, cur = null, curAt = 0, prevAt = 0, seenEv = 0;
  let loot = [];
  const parts = [], floats = [], feed = [];
  let shake = 0, banner = '', bannerAt = 0;
  const camPos = { x: 0, y: 0 };
  const ZOOM = 0.85;

  /* ---------- entrées ---------- */
  const B = { L: 1, R: 2, U: 4, D: 8, FIRE: 16, PICK: 32, SWAP: 64 };
  const KEYS = { KeyA: 'L', KeyQ: 'L', ArrowLeft: 'L', KeyD: 'R', ArrowRight: 'R', KeyW: 'U', KeyZ: 'U', ArrowUp: 'U', KeyS: 'D', ArrowDown: 'D', Space: 'FIRE', KeyE: 'PICK', Tab: 'SWAP', Digit1: 'SWAP', Digit2: 'SWAP' };
  let mask = 0, ang = 0, sent = -1, sentAng = 99, lastSend = 0, mouse = null, touchAim = false;
  const pushInput = force => {
    const now = performance.now();
    if (force || mask !== sent || (Math.abs(ang - sentAng) > 0.03 && now - lastSend > 50) || now - lastSend > 250) {
      send({ t: 'act', a: 'input', k: mask, ang: +ang.toFixed(3) }); sent = mask; sentAng = ang; lastSend = now;
    }
  };
  const tap = bit => { mask |= bit; pushInput(true); setTimeout(() => { mask &= ~bit; pushInput(true); }, 60); };
  const kd = e => {
    if (e.code === 'KeyV' && !e.repeat) { e.preventDefault(); toggleView(); return; }
    const k = KEYS[e.code]; if (!k) return;
    e.preventDefault();
    if (k === 'PICK' || k === 'SWAP') { if (!e.repeat) tap(B[k]); return; }
    if (!(mask & B[k])) { mask |= B[k]; pushInput(true); }
  };
  const ku = e => { const k = KEYS[e.code]; if (k && k !== 'PICK' && k !== 'SWAP') { mask &= ~B[k]; pushInput(true); } };
  window.addEventListener('keydown', kd);
  window.addEventListener('keyup', ku);
  const toLocal = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
  screen.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') mouse = toLocal(e); });
  screen.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') { mouse = toLocal(e); mask |= B.FIRE; pushInput(true); } });
  window.addEventListener('pointerup', onUp);
  function onUp(e) { if (e.pointerType === 'mouse' && mask & B.FIRE && !touchAim) { mask &= ~B.FIRE; pushInput(true); } }
  screen.addEventListener('wheel', e => { e.preventDefault(); tap(B.SWAP); }, { passive: false });
  screen.addEventListener('contextmenu', e => e.preventDefault());
  // joysticks tactiles
  const stick = (el, onMove) => {
    const knob = el.querySelector('i');
    let id = null, cx = 0, cy = 0;
    el.addEventListener('pointerdown', e => { e.preventDefault(); id = e.pointerId; el.setPointerCapture(id); const r = el.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; mv(e); });
    const mv = e => {
      if (e.pointerId !== id) return;
      const dx = e.clientX - cx, dy = e.clientY - cy, d = Math.min(1, Math.hypot(dx, dy) / 40);
      const a = Math.atan2(dy, dx);
      knob.style.transform = `translate(${Math.cos(a) * d * 26}px, ${Math.sin(a) * d * 26}px)`;
      onMove(d > 0.25 ? a : null);
    };
    el.addEventListener('pointermove', mv);
    const up = e => { if (e.pointerId !== id) return; id = null; knob.style.transform = ''; onMove(null); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  };
  stick(pad.querySelector('#ryMove'), a => {
    mask &= ~(B.L | B.R | B.U | B.D);
    if (a !== null) { const x = Math.cos(a), y = Math.sin(a); if (x > 0.38) mask |= B.R; if (x < -0.38) mask |= B.L; if (y > 0.38) mask |= B.D; if (y < -0.38) mask |= B.U; }
    pushInput(true);
  });
  stick(pad.querySelector('#ryAim'), a => {
    touchAim = a !== null;
    if (a !== null) { ang = a; mask |= B.FIRE; } else mask &= ~B.FIRE;
    pushInput(true);
  });
  pad.querySelectorAll('[data-b]').forEach(b => b.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (b.dataset.b === 'pick') tap(B.PICK); else if (b.dataset.b === 'swap') tap(B.SWAP); else toggleView();
  }));

  function toggleView() {
    mode = mode === '2d' ? '3d' : '2d';
    save.ryView = mode; persist();
    fxWarp(screen, 'switch');
    if (mode === '3d') ensureThree(); else if (three) three.canvas.style.display = 'none';
    toast(mode === '3d' ? 'Vue 3D' : 'Vue 2D');
  }

  /* ---------- réception ---------- */
  function push(v) {
    prev = cur || v; prevAt = curAt || performance.now(); cur = v; curAt = performance.now();
    if (v.loot) loot = v.loot;
    for (const e of v.ev) {
      if (e.id <= seenEv) continue;
      seenEv = e.id;
      const mine = e.seat === mySeat;
      if (e.k === 'hit') {
        for (let k = 0; k < 8; k++) parts.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 260, vy: (Math.random() - 0.5) * 260, life: 0.35, c: '#ff5a3a' });
        floats.push({ x: e.x, y: e.y - 30, txt: String(Math.round(e.dmg)), life: 0.8, c: e.by === mySeat ? '#F5B700' : '#fff' });
        if (mine) { shake = 0.25; sfx(140, 0.12, 'sawtooth', 0.06, -60); } else if (e.by === mySeat) sfx(900, 0.05, 'triangle', 0.05);
      } else if (e.k === 'kill') {
        feed.push({ txt: e.msg, at: performance.now(), mine: e.by === mySeat || mine });
        for (let k = 0; k < 30; k++) parts.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 420, vy: (Math.random() - 0.5) * 420, life: 0.7, c: '#ffb347' });
        if (e.by === mySeat) { toast(`🔥 Élimination ! (${e.left} restants)`); sfx(660, 0.2, 'triangle', 0.06, 300); }
        if (mine) { banner = 'ÉLIMINÉ'; bannerAt = performance.now(); sfx(70, 0.8, 'sawtooth', 0.08, -20); }
      } else if (e.k === 'splash') {
        for (let k = 0; k < 24; k++) parts.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 300, vy: (Math.random() - 0.5) * 300, life: 0.6, c: '#ff8a2a' });
        sfx(120, 0.2, 'sawtooth', 0.04);
      } else if (e.k === 'shot' && e.seat === mySeat) {
        sfx({ riveteuse: 900, grenaille: 200, louche: 260, chalumeau: 420 }[e.w] || 600, 0.05, 'square', 0.03, -200);
      } else if (e.k === 'swing' && e.seat === mySeat) {
        sfx(300, 0.08, 'triangle', 0.04, -150);
      } else if (e.k === 'pick' && mine) {
        toast(`${RY_WEAPONS[e.w]} ${RY_RARITY[e.r].name}`); sfx(980, 0.1, 'triangle', 0.05);
      } else if ((e.k === 'heal' || e.k === 'armor') && mine) {
        sfx(e.k === 'heal' ? 760 : 520, 0.15, 'triangle', 0.05, 300);
      } else if (e.k === 'zone') {
        banner = 'LA FONTE AVANCE !'; bannerAt = performance.now(); sfx(90, 0.9, 'sawtooth', 0.05, 30);
      } else if (e.k === 'win') {
        banner = e.msg.toUpperCase(); bannerAt = performance.now();
      }
    }
  }

  /* ---------- outils de rendu ---------- */
  const lerp2 = (a, b, t) => a + (b - a) * t;
  function interp() {
    const span = Math.max(30, curAt - prevAt);
    const t = Math.min(1.2, (performance.now() - curAt) / span);
    return cur.p.map((p, i) => {
      const q = prev.p[i] || p;
      if (!p.al) return p;
      let da = p.a - q.a; da = Math.atan2(Math.sin(da), Math.cos(da));
      return { ...p, x: lerp2(q.x, p.x, t), y: lerp2(q.y, p.y, t), a: i === mySeat ? ang : q.a + da * Math.min(1, t) };
    });
  }
  function focusIndex() {
    const me = cur.p[mySeat];
    if (me && me.al) return mySeat;
    if (me && me.by !== null && me.by !== undefined && cur.p[me.by] && cur.p[me.by].al) return me.by;
    const alive = cur.p.findIndex(p => p.al);
    return alive >= 0 ? alive : mySeat;
  }

  // décor pré-rendu (sol + obstacles) pour la vue 2D
  const SC = 0.5;   // échelle du pré-rendu
  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = MAP.w * SC; bgCanvas.height = MAP.h * SC;
  (function paintFloor() {
    const b = bgCanvas.getContext('2d');
    b.scale(SC, SC);
    b.fillStyle = '#3a3634'; b.fillRect(0, 0, MAP.w, MAP.h);
    for (let x = 0; x < MAP.w; x += 160) for (let y = 0; y < MAP.h; y += 160) { b.fillStyle = `rgba(0,0,0,${0.04 + ((x * 7 + y * 13) % 5) * 0.012})`; b.fillRect(x + 2, y + 2, 156, 156); }
    // allées de circulation jaunes
    b.strokeStyle = 'rgba(245,183,0,.55)'; b.lineWidth = 8; b.setLineDash([60, 40]);
    [[0, 820, MAP.w, 820], [0, 1360, MAP.w, 1360], [620, 0, 620, MAP.h], [2560, 0, 2560, MAP.h]].forEach(([a, c, d, e]) => { b.beginPath(); b.moveTo(a, c); b.lineTo(d, e); b.stroke(); });
    b.setLineDash([]);
    b.font = '900 90px "Big Shoulders Display", Impact'; b.fillStyle = 'rgba(255,255,255,.06)'; b.textAlign = 'center';
    b.fillText('ESFF · HALLE DE COULÉE 101', MAP.w / 2, MAP.h / 2 + 260);
    for (const o of MAP.obs) {
      b.save();
      if (o.k === 'four') {
        b.fillStyle = '#2b2522'; b.beginPath(); b.arc(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, 0, Math.PI * 2); b.fill();
        b.strokeStyle = '#5a504a'; b.lineWidth = 8; b.stroke();
      } else if (o.k === 'silo') {
        b.fillStyle = '#8a8d91'; b.beginPath(); b.arc(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, 0, Math.PI * 2); b.fill();
        b.strokeStyle = '#5c6067'; b.lineWidth = 6; b.stroke();
      } else {
        const col = { mur: '#16181b', convoyeur: '#2a2d31', bureau: '#2b4fa8', pilier: '#5c6067', moules: '#7a5a3a', conteneur: '#BA2C3A', poche: '#3a3d42', palette: '#8b6a42' }[o.k] || '#444';
        b.fillStyle = col; b.fillRect(o.x, o.y, o.w, o.h);
        b.strokeStyle = 'rgba(0,0,0,.45)'; b.lineWidth = 4; b.strokeRect(o.x, o.y, o.w, o.h);
        if (o.k === 'conteneur') { b.strokeStyle = 'rgba(255,255,255,.12)'; b.lineWidth = 3; for (let k = 10; k < Math.max(o.w, o.h); k += 18) { b.beginPath(); if (o.w > o.h) { b.moveTo(o.x + k, o.y); b.lineTo(o.x + k, o.y + o.h); } else { b.moveTo(o.x, o.y + k); b.lineTo(o.x + o.w, o.y + k); } b.stroke(); } }
        if (o.k === 'moules') { b.fillStyle = '#9b774e'; for (let k = 0; k < 3; k++) b.fillRect(o.x + 8 + k * 6, o.y + 8 + k * 6, o.w - 16 - k * 12, o.h - 16 - k * 12); }
        if (o.k === 'poche') { b.fillStyle = '#ffb347'; b.beginPath(); b.arc(o.x + o.w / 2, o.y + o.h / 2, o.w * 0.32, 0, Math.PI * 2); b.fill(); }
        if (o.k === 'bureau') { b.font = '900 40px "Big Shoulders Display", Impact'; b.fillStyle = 'rgba(255,255,255,.5)'; b.textAlign = 'center'; b.fillText('BUREAUX', o.x + o.w / 2, o.y + o.h / 2 + 14); }
      }
      b.restore();
    }
  })();

  function drawWeapon(c, wid, r, swing) {
    const col = RY_RARITY[r || 0].color;
    c.save();
    if (swing) c.rotate(-0.7 + (1 - swing) * 1.4);
    c.lineCap = 'round';
    const handle = (len, w = 4) => { c.strokeStyle = '#7a5434'; c.lineWidth = w; c.beginPath(); c.moveTo(10, 0); c.lineTo(10 + len, 0); c.stroke(); };
    switch (wid) {
      case 'marteau': handle(26); c.fillStyle = '#6a6f77'; c.fillRect(32, -9, 12, 18); c.fillStyle = col; c.fillRect(32, -9, 12, 3); break;
      case 'masse': handle(32, 5); c.fillStyle = '#4a4e54'; c.fillRect(38, -12, 16, 24); c.fillStyle = col; c.fillRect(38, -12, 16, 4); break;
      case 'pince': c.strokeStyle = '#4a4e54'; c.lineWidth = 3; c.beginPath(); c.moveTo(10, -3); c.lineTo(40, -6); c.moveTo(10, 3); c.lineTo(40, 6); c.stroke(); c.fillStyle = col; c.fillRect(14, -4, 8, 8); break;
      case 'ringard': c.strokeStyle = '#8a8d91'; c.lineWidth = 4; c.beginPath(); c.moveTo(8, 0); c.lineTo(68, 0); c.stroke(); c.strokeStyle = col; c.beginPath(); c.moveTo(62, 0); c.lineTo(72, -6); c.stroke(); break;
      case 'riveteuse': c.fillStyle = '#2b6cb0'; c.fillRect(10, -6, 26, 12); c.fillStyle = col; c.fillRect(30, -3, 12, 6); break;
      case 'grenaille': c.fillStyle = '#4a4e54'; c.fillRect(10, -7, 36, 14); c.fillStyle = col; c.fillRect(42, -8, 6, 16); break;
      case 'louche': handle(28, 3); c.fillStyle = '#3a3d42'; c.beginPath(); c.arc(44, 0, 9, 0, Math.PI * 2); c.fill(); c.fillStyle = '#ffb347'; c.beginPath(); c.arc(44, 0, 5, 0, Math.PI * 2); c.fill(); break;
      case 'chalumeau': c.fillStyle = '#BA2C3A'; c.fillRect(10, -4, 22, 8); c.fillStyle = col; c.fillRect(30, -2, 12, 4); break;
      default: c.fillStyle = '#e0a77d'; c.beginPath(); c.arc(22, -8, 6, 0, Math.PI * 2); c.arc(22, 8, 6, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  /* ---------- rendu 2D ---------- */
  function render2D(ps, fi, t, dt) {
    const f = ps[fi];
    camPos.x += (f.x - camPos.x) * Math.min(1, dt * 10); camPos.y += (f.y - camPos.y) * Math.min(1, dt * 10);
    const sx = x => W / 2 + (x - camPos.x) * ZOOM, sy = y => H / 2 + (y - camPos.y) * ZOOM;
    g.fillStyle = '#100c0a'; g.fillRect(0, 0, W, H);
    g.save();
    if (shake > 0) g.translate((Math.random() - 0.5) * 16 * shake, (Math.random() - 0.5) * 16 * shake);
    // décor
    const vw = W / ZOOM, vh = H / ZOOM, x0 = camPos.x - vw / 2, y0 = camPos.y - vh / 2;
    g.drawImage(bgCanvas, x0 * SC, y0 * SC, vw * SC, vh * SC, 0, 0, W, H);
    // fours qui rougeoient
    for (const o of MAP.obs) if (o.k === 'four') {
      const cx = sx(o.x + o.w / 2), cy = sy(o.y + o.h / 2);
      if (cx < -120 || cx > W + 120 || cy < -120 || cy > H + 120) continue;
      const fl = 0.75 + Math.sin(t * 6 + o.x) * 0.15;
      const gr = g.createRadialGradient(cx, cy, 4, cx, cy, o.w * ZOOM);
      gr.addColorStop(0, `rgba(255,220,140,${fl})`); gr.addColorStop(0.35, `rgba(236,100,30,${fl * 0.7})`); gr.addColorStop(1, 'rgba(236,100,30,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, o.w * ZOOM, 0, Math.PI * 2); g.fill();
    }
    // tapis des convoyeurs qui défilent
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 2;
    for (const o of MAP.obs) if (o.k === 'convoyeur') for (let k = (t * 60) % 24; k < o.w; k += 24) { g.beginPath(); g.moveTo(sx(o.x + k), sy(o.y)); g.lineTo(sx(o.x + k), sy(o.y + o.h)); g.stroke(); }
    // fonte en fusion hors zone
    const z = cur.z;
    g.save();
    g.beginPath(); g.rect(0, 0, W, H); g.arc(sx(z.x), sy(z.y), z.r * ZOOM, 0, Math.PI * 2, true);
    g.clip('evenodd');
    const lg = g.createLinearGradient(0, 0, W, H);
    lg.addColorStop(0, '#ff7a1a'); lg.addColorStop(0.5, '#c4361a'); lg.addColorStop(1, '#ff9a3a');
    g.globalAlpha = 0.72; g.fillStyle = lg; g.fillRect(0, 0, W, H);
    g.globalAlpha = 0.35; g.fillStyle = '#fff3a0';
    for (let k = 0; k < 26; k++) { const bx = (k * 137 + t * 30 * (k % 3 + 1)) % W, by = (k * 89 + Math.sin(t + k) * 40) % H; g.beginPath(); g.arc(bx, by, 6 + (k % 4) * 4, 0, Math.PI * 2); g.fill(); }
    g.restore();
    g.strokeStyle = '#ffb347'; g.lineWidth = 4; g.shadowColor = '#ff8a2a'; g.shadowBlur = 20;
    g.beginPath(); g.arc(sx(z.x), sy(z.y), z.r * ZOOM, 0, Math.PI * 2); g.stroke(); g.shadowBlur = 0;
    if (z.to) { g.setLineDash([12, 10]); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2; g.beginPath(); g.arc(sx(z.to[0]), sy(z.to[1]), z.to[2] * ZOOM, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); }
    // butin
    for (const it of loot) {
      const x = sx(it[1]), y = sy(it[2]);
      if (x < -30 || x > W + 30 || y < -30 || y > H + 30) continue;
      g.save(); g.translate(x, y + Math.sin(t * 3 + it[0]) * 2);
      if (it[3] === 'arme') {
        const col = RY_RARITY[it[5]].color;
        g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.arc(0, 0, 20, 0, Math.PI * 2); g.fill();
        g.strokeStyle = col; g.lineWidth = 3; g.shadowColor = col; g.shadowBlur = it[5] >= 2 ? 16 : 6;
        g.beginPath(); g.arc(0, 0, 20, 0, Math.PI * 2); g.stroke(); g.shadowBlur = 0;
        g.rotate(-0.6); g.translate(-28, 0); drawWeapon(g, it[4], it[5], 0);
      } else if (it[3] === 'soin') {
        g.fillStyle = '#f2f4f7'; g.fillRect(-12, -12, 24, 24); g.fillStyle = '#2E9E5B'; g.fillRect(-3, -9, 6, 18); g.fillRect(-9, -3, 18, 6);
      } else {
        g.fillStyle = '#c9ccd1'; g.beginPath(); g.moveTo(-10, -12); g.lineTo(10, -12); g.lineTo(14, 12); g.lineTo(-14, 12); g.closePath(); g.fill();
        g.fillStyle = '#7fd4ff'; g.fillRect(-6, -6, 12, 4);
      }
      g.restore();
    }
    // projectiles
    for (const q of cur.pr) {
      const x = sx(q[0]), y = sy(q[1]);
      if (q[2] === 'rivet') { g.fillStyle = '#ffe07a'; g.fillRect(x - 2, y - 2, 5, 5); }
      else if (q[2] === 'pellet') { g.fillStyle = '#d0d4da'; g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); }
      else if (q[2] === 'blob') { const gr = g.createRadialGradient(x, y, 1, x, y, 14); gr.addColorStop(0, '#fff3c0'); gr.addColorStop(0.5, '#ff8a2a'); gr.addColorStop(1, 'rgba(236,100,30,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 14, 0, Math.PI * 2); g.fill(); }
      else { g.fillStyle = `rgba(255,${120 + Math.random() * 100},40,.75)`; g.beginPath(); g.arc(x, y, 6 + Math.random() * 6, 0, Math.PI * 2); g.fill(); }
    }
    // joueurs
    ps.forEach((p, i) => {
      if (!p.al) return;
      const x = sx(p.x), y = sy(p.y);
      if (x < -60 || x > W + 60 || y < -60 || y > H + 60) return;
      const M = RY_METIERS[p.m] || RY_METIERS.fondeur;
      g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(x + 3, y + 6, 18, 12, 0, 0, Math.PI * 2); g.fill();
      g.save(); g.translate(x, y); g.rotate(p.a);
      const s = p.s[p.c]; drawWeapon(g, s ? s.w : 'poings', s ? s.r : 0, p.sw ? 0.5 : 0);
      g.fillStyle = M.color; g.beginPath(); g.arc(0, 0, 16, 0, Math.PI * 2); g.fill();
      g.strokeStyle = i === mySeat ? '#fff' : 'rgba(0,0,0,.5)'; g.lineWidth = i === mySeat ? 3 : 2; g.stroke();
      g.fillStyle = '#e0a77d'; g.beginPath(); g.arc(4, 0, 8, 0, Math.PI * 2); g.fill();
      g.fillStyle = p.m === 'soudeur' ? '#2b2e33' : p.m === 'fondeur' ? '#c9ccd1' : '#F5B700'; g.beginPath(); g.arc(2, 0, 8, Math.PI / 2, Math.PI * 1.5); g.fill();   // casque
      g.restore();
      if (i !== mySeat) {
        g.font = '800 12px "Big Shoulders Display", Impact'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(p.n, x, y - 30);
        g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x - 18, y - 26, 36, 4); g.fillStyle = '#ff5a5a'; g.fillRect(x - 18, y - 26, 36 * p.hp / 100, 4);
        if (p.ar > 0) { g.fillStyle = '#c9ccd1'; g.fillRect(x - 18, y - 22, 36 * p.ar / 100, 2); }
      }
    });
    effects2D(sx, sy, dt);
    g.restore();
  }
  function effects2D(sx, sy, dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92;
      g.globalAlpha = Math.min(1, p.life * 3); g.fillStyle = p.c; g.fillRect(sx(p.x) - 2, sy(p.y) - 2, 4, 4);
    }
    g.globalAlpha = 1;
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i]; f.life -= dt; f.y -= 40 * dt; if (f.life <= 0) { floats.splice(i, 1); continue; }
      g.globalAlpha = Math.min(1, f.life * 2); g.font = '900 18px "Big Shoulders Display", Impact'; g.textAlign = 'center'; g.fillStyle = f.c;
      g.fillText(f.txt, sx(f.x), sy(f.y)); g.globalAlpha = 1;
    }
  }

  /* ---------- rendu 3D ---------- */
  function ensureThree() {
    if (three) { three.canvas.style.display = ''; return; }
    loadThree().then(() => { if (!ryClient) return; three = build3D(); if (mode !== '3d') three.canvas.style.display = 'none'; })
      .catch(e => { toast(e.message); mode = '2d'; });
  }
  function build3D() {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.outputEncoding = THREE.sRGBEncoding;
    const canvas = renderer.domElement; canvas.className = 'tk-3d'; canvas.dataset.overlay = '1';
    screen.insertBefore(canvas, cv);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#120c09');
    scene.fog = new THREE.Fog('#120c09', 900, 2600);
    const cam = new THREE.PerspectiveCamera(50, W / H, 10, 6000);
    scene.add(new THREE.HemisphereLight('#ffe8d0', '#2a1408', 0.7));
    const sun = new THREE.DirectionalLight('#fff4e6', 0.6); sun.position.set(800, 1400, 600); scene.add(sun);
    const floorTex = new THREE.CanvasTexture(bgCanvas); floorTex.encoding = THREE.sRGBEncoding;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(MAP.w, MAP.h), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(MAP.w / 2, 0, MAP.h / 2); scene.add(floor);
    const HEIGHT = { mur: 260, four: 220, convoyeur: 50, bureau: 190, silo: 320, pilier: 420, moules: 90, conteneur: 150, poche: 120, palette: 28 };
    const COL = { mur: '#1d1f22', four: '#3a302a', convoyeur: '#2a2d31', bureau: '#2b4fa8', silo: '#8a8d91', pilier: '#5c6067', moules: '#7a5a3a', conteneur: '#BA2C3A', poche: '#3a3d42', palette: '#8b6a42' };
    const lights = [];
    for (const o of MAP.obs) {
      const h = HEIGHT[o.k] || 100;
      const round = ['four', 'silo', 'poche'].includes(o.k);
      const geo = round ? new THREE.CylinderGeometry(o.w / 2, o.w / 2 * (o.k === 'poche' ? 0.8 : 1), h, 20) : new THREE.BoxGeometry(o.w, h, o.h);
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: COL[o.k] || '#444', roughness: 0.8, metalness: ['silo', 'poche', 'pilier'].includes(o.k) ? 0.5 : 0.1 }));
      m.position.set(o.x + o.w / 2, h / 2, o.y + o.h / 2);
      scene.add(m);
      if (o.k === 'four' || o.k === 'poche') {
        const top = new THREE.Mesh(new THREE.CircleGeometry(o.w * 0.38, 20), new THREE.MeshBasicMaterial({ color: '#ffb347' }));
        top.rotation.x = -Math.PI / 2; top.position.set(o.x + o.w / 2, h + 1, o.y + o.h / 2); scene.add(top);
      }
      if (o.k === 'four' && lights.length < 5) { const pl = new THREE.PointLight('#ff7a2a', 1.4, 700, 1.6); pl.position.set(o.x + o.w / 2, h + 60, o.y + o.h / 2); scene.add(pl); lights.push(pl); }
    }
    // fonte : anneau autour de la zone sûre
    const lavaMat = new THREE.MeshBasicMaterial({ color: '#ff6a1a', transparent: true, opacity: 0.82, side: THREE.DoubleSide });
    let lava = null, lavaR = -1;
    const players = [];
    const mkPlayer = m => {
      const grp = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(15, 17, 46, 12), new THREE.MeshStandardMaterial({ color: (RY_METIERS[m] || RY_METIERS.fondeur).color }));
      body.position.y = 23;
      const head = new THREE.Mesh(new THREE.SphereGeometry(11, 12, 10), new THREE.MeshStandardMaterial({ color: '#e0a77d' })); head.position.y = 58;
      const helm = new THREE.Mesh(new THREE.SphereGeometry(12.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: m === 'fondeur' ? '#c9ccd1' : m === 'soudeur' ? '#2b2e33' : '#F5B700', metalness: 0.4 })); helm.position.y = 60;
      const tool = new THREE.Mesh(new THREE.BoxGeometry(44, 8, 8), new THREE.MeshStandardMaterial({ color: '#6a6f77' })); tool.position.set(28, 34, 0);
      grp.add(body, head, helm, tool);
      grp.userData.tool = tool;
      scene.add(grp);
      return grp;
    };
    const projMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(5, 6, 6), new THREE.MeshBasicMaterial({ color: '#ffd27a' }), 400);
    projMesh.count = 0; scene.add(projMesh);
    const lootGroup = new THREE.Group(); scene.add(lootGroup);
    let lootKey = '';
    const dummy = new THREE.Object3D();
    const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hitPt = new THREE.Vector3();
    let lastW = 0, lastH = 0;
    return {
      canvas,
      aim(mx, my, me) {   // vise le point du sol sous la souris
        ray.setFromCamera({ x: mx / W * 2 - 1, y: -(my / H * 2 - 1) }, cam);
        if (ray.ray.intersectPlane(plane, hitPt)) return Math.atan2(hitPt.z - me.y, hitPt.x - me.x);
        return null;
      },
      render(ps, fi, t) {
        const cw = cv.clientWidth, ch = cv.clientHeight;
        if (cw && (cw !== lastW || ch !== lastH)) { lastW = cw; lastH = ch; renderer.setSize(cw, ch, false); canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px'; cam.aspect = cw / ch; cam.updateProjectionMatrix(); }
        const f = ps[fi];
        cam.position.set(f.x, 760, f.y + 560);
        if (shake > 0) { cam.position.x += (Math.random() - 0.5) * 20 * shake; cam.position.y += (Math.random() - 0.5) * 20 * shake; }
        cam.lookAt(f.x, 0, f.y);
        const z = cur.z;
        if (Math.abs(z.r - lavaR) > 6) {
          if (lava) { scene.remove(lava); lava.geometry.dispose(); }
          lava = new THREE.Mesh(new THREE.RingGeometry(Math.max(1, z.r), 4200, 72, 1), lavaMat);
          lava.rotation.x = -Math.PI / 2; scene.add(lava); lavaR = z.r;
        }
        lava.position.set(z.x, 3, z.y);
        lavaMat.color.setHSL(0.06 + Math.sin(t * 2) * 0.01, 1, 0.5 + Math.sin(t * 3) * 0.04);
        lights.forEach((l, k) => { l.intensity = 1.2 + Math.sin(t * 7 + k) * 0.25; });
        ps.forEach((p, i) => {
          if (!players[i]) players[i] = mkPlayer(p.m);
          const m = players[i];
          m.visible = p.al;
          m.position.set(p.x, 0, p.y);
          m.rotation.y = -p.a;
          const s = p.s[p.c], col = s ? RY_RARITY[s.r].color : '#e0a77d';
          m.userData.tool.material.color.set(col);
          m.userData.tool.rotation.y = p.sw ? Math.sin(t * 30) * 0.8 : 0;
        });
        projMesh.count = Math.min(400, cur.pr.length);
        cur.pr.slice(0, 400).forEach((q, k) => { dummy.position.set(q[0], 34, q[1]); dummy.scale.setScalar(q[2] === 'blob' ? 2.4 : q[2] === 'flame' ? 1.6 : 0.8); dummy.updateMatrix(); projMesh.setMatrixAt(k, dummy.matrix); });
        projMesh.instanceMatrix.needsUpdate = true;
        const key = loot.map(it => it[0]).join(',');
        if (key !== lootKey) {
          lootKey = key;
          while (lootGroup.children.length) { const c = lootGroup.children.pop(); c.geometry.dispose(); }
          for (const it of loot) {
            const col = it[3] === 'arme' ? RY_RARITY[it[5]].color : it[3] === 'soin' ? '#2E9E5B' : '#c9ccd1';
            const m = new THREE.Mesh(it[3] === 'arme' ? new THREE.OctahedronGeometry(12) : new THREE.BoxGeometry(18, 18, 18), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.5 }));
            m.position.set(it[1], 22, it[2]); lootGroup.add(m);
          }
        }
        lootGroup.children.forEach((m, k) => { m.rotation.y = t * 2 + k; m.position.y = 22 + Math.sin(t * 3 + k) * 4; });
        renderer.render(scene, cam);
      },
      dispose() { renderer.dispose(); scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); },
    };
  }

  /* ---------- HUD ---------- */
  function hud(ps, fi, dt) {
    const me = cur.p[mySeat];
    const f = ps[fi];
    // mini-carte
    const mw = 190, mh = mw * MAP.h / MAP.w, mx = 12, my = 12, k = mw / MAP.w;
    g.fillStyle = 'rgba(8,9,11,.75)'; g.fillRect(mx, my, mw, mh);
    g.fillStyle = 'rgba(255,255,255,.18)'; for (const o of MAP.obs) g.fillRect(mx + o.x * k, my + o.y * k, Math.max(1, o.w * k), Math.max(1, o.h * k));
    const z = cur.z;
    g.save(); g.beginPath(); g.rect(mx, my, mw, mh); g.clip();
    g.strokeStyle = '#ff8a2a'; g.lineWidth = 2; g.beginPath(); g.arc(mx + z.x * k, my + z.y * k, z.r * k, 0, Math.PI * 2); g.stroke();
    if (z.to) { g.strokeStyle = 'rgba(255,255,255,.7)'; g.setLineDash([3, 3]); g.beginPath(); g.arc(mx + z.to[0] * k, my + z.to[1] * k, z.to[2] * k, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); }
    if (me && me.m === 'metallurgiste') for (const it of loot) if (it[3] === 'arme' && it[5] >= 2) { g.fillStyle = RY_RARITY[it[5]].color; g.fillRect(mx + it[1] * k - 1.5, my + it[2] * k - 1.5, 3, 3); }
    g.restore();
    g.fillStyle = '#7fd4ff'; g.beginPath(); g.arc(mx + f.x * k, my + f.y * k, 3.5, 0, Math.PI * 2); g.fill();
    // survivants, éliminations, fonte
    g.fillStyle = 'rgba(8,9,11,.75)'; g.fillRect(W - 170, 12, 158, 62);
    g.font = '400 11px "Press Start 2P", monospace'; g.textAlign = 'right'; g.fillStyle = '#fff';
    g.fillText(`${cur.alive} EN VIE`, W - 22, 34);
    g.fillStyle = '#F5B700'; g.fillText(`${me ? me.k : 0} ÉLIM.`, W - 22, 52);
    g.font = '600 11px Archivo, sans-serif'; g.fillStyle = z.sh ? '#ff8a2a' : '#c6cad0';
    g.fillText(z.sh ? `La fonte avance (${z.t} s)` : z.ph >= 5 ? 'Fonte finale' : `Fonte dans ${z.t} s`, W - 22, 68);
    // fil des éliminations
    const now = performance.now();
    feed.filter(x => now - x.at < 6000).slice(-5).forEach((x, i) => {
      g.font = '800 14px "Big Shoulders Display", Impact'; g.textAlign = 'right';
      const tw = g.measureText(x.txt).width + 16;
      g.fillStyle = x.mine ? 'rgba(236,100,30,.5)' : 'rgba(8,9,11,.6)'; g.fillRect(W - 12 - tw, 82 + i * 22, tw, 19);
      g.fillStyle = '#fff'; g.fillText(x.txt, W - 20, 96 + i * 22);
    });
    // vie, armure, armes
    if (me && me.al) {
      const bx = W / 2 - 160, by = H - 64;
      g.fillStyle = 'rgba(8,9,11,.75)'; g.fillRect(bx - 8, by - 10, 336, 58);
      g.fillStyle = '#3a0d0d'; g.fillRect(bx, by, 320, 14); g.fillStyle = me.hp > 30 ? '#ff5a5a' : '#ff2a2a'; g.fillRect(bx, by, 320 * me.hp / 100, 14);
      g.fillStyle = '#22262a'; g.fillRect(bx, by + 17, 320, 6); g.fillStyle = '#c9ccd1'; g.fillRect(bx, by + 17, 320 * me.ar / 100, 6);
      g.font = '800 12px Archivo, sans-serif'; g.textAlign = 'left'; g.fillStyle = '#fff'; g.fillText(`${me.hp} PV`, bx + 4, by + 11);
      if (me.ar > 0) { g.textAlign = 'right'; g.fillText(`${me.ar} armure`, bx + 316, by + 11); }
      [0, 1].forEach(sl => {
        const s = me.s[sl], x = bx + sl * 162, y = by + 27;
        g.fillStyle = sl === me.c ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.05)'; g.fillRect(x, y, 158, 18);
        g.fillStyle = s ? RY_RARITY[s.r].color : '#666'; g.fillRect(x, y, 4, 18);
        g.font = '700 11px Archivo, sans-serif'; g.textAlign = 'left'; g.fillStyle = s ? '#fff' : '#888';
        g.fillText(s ? `${sl + 1}. ${RY_WEAPONS[s.w]} · ${RY_RARITY[s.r].name}` : `${sl + 1}. vide`, x + 9, y + 13);
      });
      // butin proche à ramasser
      const near = loot.find(it => it[3] === 'arme' && (it[1] - me.x) ** 2 + (it[2] - me.y) ** 2 < 46 ** 2);
      if (near && me.s[0] && me.s[1]) {
        g.font = '400 9px "Press Start 2P", monospace'; g.textAlign = 'center'; g.fillStyle = RY_RARITY[near[5]].color;
        g.fillText(`E : PRENDRE ${RY_WEAPONS[near[4]].toUpperCase()} ${RY_RARITY[near[5]].name.toUpperCase()}`, W / 2, by - 20);
      }
    } else if (me) {
      g.font = '400 11px "Press Start 2P", monospace'; g.textAlign = 'center'; g.fillStyle = '#ff8a8a';
      g.fillText(`SPECTATEUR · ${cur.p[fi].n.toUpperCase()}`, W / 2, H - 30);
    }
    g.font = '400 8px "Press Start 2P", monospace'; g.textAlign = 'left'; g.fillStyle = '#9aa0a6';
    g.fillText(`VUE ${mode.toUpperCase()} (V)`, 14, my + mh + 16);
    if (cur.phase === 'count') bigText(g, String(Math.ceil(cur.countdown)), W / 2, H / 2 - 40, 96, '#F5B700');
    if (banner && performance.now() - bannerAt < 2600) bigText(g, banner, W / 2, H / 2 - 90, 54, banner === 'ÉLIMINÉ' ? '#ff6b6b' : '#F5B700');
    // viseur
    if (mouse && me && me.al) { g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2; g.beginPath(); g.arc(mouse[0], mouse[1], 9, 0, Math.PI * 2); g.moveTo(mouse[0] - 14, mouse[1]); g.lineTo(mouse[0] - 5, mouse[1]); g.moveTo(mouse[0] + 5, mouse[1]); g.lineTo(mouse[0] + 14, mouse[1]); g.stroke(); }
  }

  if (mode === '3d') ensureThree();
  const stop = loop((dt, tms) => {
    if (!cur) return;
    const t = tms / 1000;
    if (shake > 0) shake -= dt;
    const ps = interp();
    const fi = focusIndex();
    const me = ps[mySeat];
    // visée à la souris
    if (mouse && me && me.al && !touchAim) {
      if (mode === '3d' && three) { const a = three.aim(mouse[0], mouse[1], me); if (a !== null) ang = a; }
      else ang = Math.atan2((mouse[1] - H / 2) / ZOOM + camPos.y - me.y, (mouse[0] - W / 2) / ZOOM + camPos.x - me.x);
    }
    if (me) ps[mySeat] = { ...me, a: ang };
    if (mode === '3d' && three) {
      three.render(ps, fi, t);
      g.clearRect(0, 0, W, H);
      camPos.x = ps[fi].x; camPos.y = ps[fi].y;
      g.save(); effects2D(x => W / 2 + (x - camPos.x) * 0.55, y => H / 2 + (y - camPos.y) * 0.55 + 40, dt); g.restore();
    } else {
      render2D(ps, fi, t, dt);
    }
    hud(ps, fi, dt);
    pushInput(false);
  });

  return {
    push, endShown: false,
    stop() {
      stop();
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('pointerup', onUp);
      if (three) three.dispose();
    },
  };
}
