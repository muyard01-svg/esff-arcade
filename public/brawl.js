/* Forge Fighters — bagarre de bonshommes-bâtons (la simulation tourne sur le serveur, brawl.py).
   Ici : les pantins désarticulés (verlet + ressorts vers la pose voulue), les plateformes, la fonte, les armes. */
'use strict';

HANDLERS.fighter = () => updateBrawl();

const BR_COLORS = { fondeur: '#EC641E', forgeronne: '#E8443A', mouleur: '#5AA8FF', ebarbeuse: '#7FD48A' };
const BR_KEYS = { L: 1, R: 2, U: 4, D: 8, A: 16, B: 32, T: 64 };
// os du pantin : [de, à, longueur]
const BR_BONES = [['fL', 'kL', 25], ['kL', 'p', 25], ['fR', 'kR', 25], ['kR', 'p', 25], ['p', 'n', 32], ['n', 'h', 13],
  ['n', 'eL', 18], ['eL', 'hL', 18], ['n', 'eR', 18], ['eR', 'hR', 18]];
const BR_PTS = ['h', 'n', 'p', 'eL', 'hL', 'eR', 'hR', 'kL', 'fL', 'kR', 'fR'];

/* Pose voulue d'un combattant (repère monde, pieds en (x, y)). L = bras/jambe arrière, R = avant. */
function brawlPose(b, t, run) {
  const fc = b.fc, x = b.x, y = b.y, P = {};
  const at = (k, dx, dy) => { P[k] = [x + dx * fc, y + dy]; };
  const lean = Math.max(-10, Math.min(10, b.vx * 1.1)) * fc;
  const crouch = b.bl ? 6 : 0;
  // jambes
  if (!b.g) {
    const tuck = b.vy < 0 ? 10 : 4;
    at('fL', -8, -tuck); at('kL', 4, -28 - tuck); at('fR', 10, -tuck - 4); at('kR', 14, -30 - tuck);
  } else if (Math.abs(b.vx) > 1.2) {
    const ph = run * 0.11;
    const s1 = Math.sin(ph), s2 = Math.sin(ph + Math.PI);
    at('fL', s1 * 20, -Math.max(0, Math.cos(ph)) * 12); at('kL', s1 * 9 + 6, -26 - Math.max(0, Math.cos(ph)) * 6);
    at('fR', s2 * 20, -Math.max(0, -Math.cos(ph)) * 12); at('kR', s2 * 9 + 6, -26 - Math.max(0, -Math.cos(ph)) * 6);
  } else {
    at('fL', -11, 0); at('kL', -6, -25 + crouch); at('fR', 11, 0); at('kR', 8, -25 + crouch);
  }
  const bob = b.g && Math.abs(b.vx) > 1.2 ? Math.abs(Math.sin(run * 0.11)) * 3 : Math.sin(t * 3) * 1.2;
  P.p = [x + lean * 0.3, y - 48 + crouch + bob];
  P.n = [x + lean + (b.st ? -8 * fc : 0), y - 80 + crouch + bob];
  P.h = [P.n[0] + lean * 0.2 + (b.st ? -5 * fc : 0), P.n[1] - 13];
  const nx = P.n[0], ny = P.n[1];
  const arm = (side, hx, hy, ex, ey) => { P['h' + side] = [nx + hx * fc, ny + hy]; P['e' + side] = [nx + ex * fc, ny + ey]; };
  const aimA = b.aim < 0 ? -0.6 : b.aim > 0 ? 0.6 : 0;
  if (b.al === false) { arm('L', -10, 24, -6, 14); arm('R', 10, 24, 6, 14); return P; }
  if (b.win) { arm('L', -16, -30, -12, -14); arm('R', 16, -30, 12, -14); return P; }
  if (b.bl) { arm('L', 16, -8, 10, 8); arm('R', 20, -2, 14, 12); return P; }
  if (b.w === 'masse') {
    // la masse passe de derrière l'épaule à devant, vers le bas
    const k = b.at === 'masse' && b.atk > 0 ? 1 - b.atk / 14 : 0;
    const a = b.at === 'masse' && b.atk > 0 ? -2.4 + Math.min(1, k * 1.6) * 3.1 : -1.9;
    const hx = Math.cos(a) * 30, hy = Math.sin(a) * 30;
    arm('R', hx, hy, hx * 0.5, hy * 0.5 + 4); arm('L', hx * 0.75, hy * 0.75, hx * 0.35, hy * 0.4 + 6);
    P.weaponA = a; return P;
  }
  if (b.w) {
    const rec = b.at === 'tir' && b.atk > 0 ? -6 : 0;
    const hx = Math.cos(aimA) * (30 + rec), hy = Math.sin(aimA) * (30 + rec);
    arm('R', hx, hy, hx * 0.5, hy * 0.5 + 6); arm('L', hx * 0.6, hy * 0.6 + 4, hx * 0.25, hy * 0.3 + 10);
    P.weaponA = aimA; return P;
  }
  if (b.at === 'lancer' && b.atk > 0) { arm('R', 30, -16, 16, -12); arm('L', -8, 14, -6, 10); return P; }
  if (b.at === 'punch' && b.atk > 0) {
    const k = b.atk > 4 ? 1 : b.atk / 4;
    const front = b.hd ? 'R' : 'L', back = b.hd ? 'L' : 'R';
    arm(front, 14 + 30 * k, 2, 10 + 12 * k, 6 - 4 * k); arm(back, 10, 8, 4, 14);
    return P;
  }
  const sw = Math.sin(t * 3) * 2;
  arm('L', 10, 10 + sw, 2, 14); arm('R', 16, 6 - sw, 8, 14);
  return P;
}

/* Dessin d'un pantin (points monde → écran via k) */
function drawStick(g, P, col, ch, k, o = {}) {
  const S = p => [p[0] * k, p[1] * k];
  g.save();
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = o.flash ? '#fff' : col;
  g.globalAlpha = o.alpha ?? 1;
  g.lineWidth = 7 * k;
  const seg = (...ks) => { g.beginPath(); ks.forEach((q, i) => { const [x, y] = S(P[q]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); };
  seg('fL', 'kL', 'p'); seg('fR', 'kR', 'p'); seg('p', 'n');
  seg('n', 'eL', 'hL'); seg('n', 'eR', 'hR');
  const [hx, hy] = S(P.h), r = 11 * k;
  g.fillStyle = o.flash ? '#fff' : col;
  g.beginPath(); g.arc(hx, hy, r, 0, Math.PI * 2); g.fill();
  // coiffe du métier
  const fc = o.fc || 1;
  g.lineWidth = 2 * k;
  if (ch === 'mouleur') { g.fillStyle = '#F5B700'; g.beginPath(); g.arc(hx, hy - 2 * k, r * 1.05, Math.PI, 0); g.fill(); g.fillRect(hx - r * 1.35, hy - 3 * k, r * 2.7, 3 * k); }
  else if (ch === 'fondeur') { g.fillStyle = '#c9ccd1'; g.beginPath(); g.arc(hx, hy - 1 * k, r * 1.12, Math.PI * 0.95, Math.PI * 2.05); g.fill(); g.fillStyle = '#F5B700'; g.fillRect(hx + fc * r * 0.1 - (fc < 0 ? r * 0.9 : 0), hy - 3 * k, r * 0.9, 5 * k); }
  else if (ch === 'forgeronne') { g.fillStyle = '#3a2a22'; g.fillRect(hx - r, hy - r * 0.95, r * 2, r * 0.6); g.fillStyle = '#F5B700'; g.fillRect(hx - r, hy - r * 0.45, r * 2, 2 * k); }
  else if (ch === 'ebarbeuse') { g.fillStyle = 'rgba(160,220,255,.55)'; g.strokeStyle = '#2b2e33'; g.beginPath(); g.rect(hx + (fc > 0 ? 0 : -r * 1.15), hy - r * 0.9, r * 1.15, r * 1.6); g.fill(); g.stroke(); }
  // yeux
  g.fillStyle = '#111'; g.fillRect(hx + fc * 4 * k - 1.5 * k, hy - 2 * k, 3 * k, 3 * k);
  g.restore();
}

function drawBrawlWeapon(g, w, x, y, a, k, fc = 1) {
  g.save(); g.translate(x, y); g.rotate(a); if (fc < 0 && w !== 'masse') g.scale(1, -1);
  g.lineCap = 'round';
  if (w === 'masse') { g.strokeStyle = '#8b5a2b'; g.lineWidth = 5 * k; g.beginPath(); g.moveTo(-6 * k, 0); g.lineTo(40 * k, 0); g.stroke(); g.fillStyle = '#5c6067'; g.fillRect(34 * k, -12 * k, 18 * k, 24 * k); g.fillStyle = '#9aa0a6'; g.fillRect(34 * k, -12 * k, 18 * k, 5 * k); }
  else if (w === 'riveteuse') { g.fillStyle = '#F5B700'; g.fillRect(-2 * k, -6 * k, 30 * k, 11 * k); g.fillStyle = '#2b2e33'; g.fillRect(2 * k, 3 * k, 7 * k, 12 * k); g.fillRect(26 * k, -3 * k, 10 * k, 5 * k); }
  else if (w === 'lance') { g.strokeStyle = '#9aa0a6'; g.lineWidth = 4 * k; g.beginPath(); g.moveTo(-10 * k, 0); g.lineTo(50 * k, 0); g.stroke(); g.fillStyle = '#2b6cb0'; g.fillRect(-14 * k, -6 * k, 14 * k, 12 * k); g.fillStyle = '#c87533'; g.fillRect(46 * k, -3 * k, 8 * k, 6 * k); }
  else if (w === 'tromblon') { g.fillStyle = '#6b4c2c'; g.fillRect(-10 * k, -4 * k, 18 * k, 10 * k); g.fillStyle = '#3a3d42'; g.beginPath(); g.moveTo(6 * k, -4 * k); g.lineTo(40 * k, -9 * k); g.lineTo(40 * k, 9 * k); g.lineTo(6 * k, 4 * k); g.fill(); }
  else if (w === 'boulet') { g.fillStyle = '#1e1e22'; g.beginPath(); g.arc(8 * k, 0, 10 * k, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#c9a36a'; g.lineWidth = 2 * k; g.beginPath(); g.moveTo(8 * k, -10 * k); g.quadraticCurveTo(12 * k, -18 * k, 6 * k, -20 * k); g.stroke(); }
  g.restore();
}

/* Illustration animée du menu de la borne */
function brawlAttract(g, s, W2, H2) {
  const k = 1.15, base = 250;
  g.fillStyle = '#2b2e33'; g.fillRect(150, base * k - 4, 340, 14);
  g.fillStyle = '#F5B700'; for (let x = 150; x < 490; x += 28) g.fillRect(x, base * k - 4, 14, 4);
  const ph = s % 2.4, cyc = Math.floor(s / 2.4);
  const chars = Object.keys(BR_COLORS), a = chars[cyc % 4], c = chars[(cyc + 1) % 4];
  const hitT = ph > 0.5 && ph < 1.0;
  const fa = { x: 230 + Math.min(ph, 0.5) * 60, y: base, fc: 1, vx: ph < 0.5 ? 4 : 0, vy: 0, g: true, at: ph > 0.5 && ph < 0.8 ? 'punch' : '', atk: ph > 0.5 && ph < 0.8 ? 8 : 0, hd: cyc % 2, w: cyc % 3 === 2 ? 'masse' : null, al: true };
  if (fa.w) { fa.at = ph > 0.45 && ph < 0.95 ? 'masse' : ''; fa.atk = fa.at ? Math.max(0, 14 - (ph - 0.45) * 28) : 0; }
  const fly = ph > 0.6 ? (ph - 0.6) : 0;
  const fb = { x: 330 + fly * 160, y: base - Math.sin(Math.min(1, fly * 1.4) * Math.PI) * 30, fc: -1, vx: 0, vy: fly ? -4 : 0, g: !fly, st: hitT ? 4 : 0, al: true };
  [[fa, a], [fb, c]].forEach(([b, ch]) => {
    const P = brawlPose(b, s, s * 60);
    drawStick(g, P, BR_COLORS[ch], ch, k, { fc: b.fc, flash: b === fb && hitT && ph < 0.7 });
    if (b.w && P.weaponA !== undefined) drawBrawlWeapon(g, b.w, P.hR[0] * k, P.hR[1] * k, b.fc > 0 ? P.weaponA : Math.PI - P.weaponA, k, b.fc);
  });
  if (hitT && ph < 0.75) { g.fillStyle = '#ffd27a'; for (let i = 0; i < 6; i++) { const an = i * 1.05 + s * 9; g.fillRect(320 * k - 30 + Math.cos(an) * 18, (base - 70) * k + Math.sin(an) * 18, 4, 4); } }
  g.font = '400 14px "Press Start 2P", monospace'; g.textAlign = 'center'; g.fillStyle = '#F5B700';
  g.fillText('LE DERNIER DEBOUT GAGNE', W2 / 2, 50);
}

/* ---------- client ---------- */
let brawlClient = null;
function stopFighter() { if (brawlClient) { brawlClient.stop(); brawlClient = null; } }

function updateBrawl() {
  if (!trackInfo || !trackInfo.arena || !view || onlineKind !== 'fighter') return;
  if (view.finished) {
    if (brawlClient && !brawlClient.endShown) { brawlClient.push(view); brawlClient.endShown = true; setTimeout(() => updateBrawl(), 3000); return; }
    if (document.getElementById('rewardBox')) return;
    stopFighter();
    resultScreen(view.finished.map((i, k) => {
      const b = view.b[i];
      return `<li><b>${k + 1}</b><i style="background:${BR_COLORS[b.ch]}"></i><span>${esc(b.n)}${i === mySeat ? ' (toi)' : ''}</span><em>${b.wins} manche${b.wins > 1 ? 's' : ''} · ${b.k} K.O.</em></li>`;
    }));
    return;
  }
  if (!brawlClient) brawlClient = startBrawlClient();
  brawlClient.push(view);
}

function startBrawlClient() {
  const W = 960, H = 540, A = trackInfo.arena, K = W / A.w;
  stage.innerHTML = '';
  $('#hudInfo').textContent = `Premier à ${A.toWin} manches`;
  const wrap = document.createElement('div'); wrap.className = 'play-wrap'; stage.appendChild(wrap);
  const { c, g } = makeCanvas(wrap, W, H);
  const pad = document.createElement('div'); pad.className = 'touch-pad';
  pad.innerHTML = `<div class="grp"><button data-m="1">◀</button><button data-m="4">▲</button><button data-m="8">▼</button><button data-m="2">▶</button></div>
    <div class="grp"><button data-m="16" class="hot">FRAPPE</button><button data-m="32">GARDE</button><button data-m="64" class="warm">LANCER</button></div>`;
  wrap.appendChild(pad);
  const hint = document.createElement('p'); hint.className = 'keys-hint';
  hint.textContent = '← → / Q D BOUGER · ↑ / Z SAUTER (DOUBLE SAUT) · ↓ / S DESCENDRE · J / ESPACE FRAPPER, TIRER · K GARDE · L LANCER L’ARME · ↑↓ VISER';
  wrap.appendChild(hint);

  /* entrées */
  let mask = 0, lastSent = -1, lastAt = 0;
  const MAP = { ArrowLeft: 1, KeyA: 1, KeyQ: 1, ArrowRight: 2, KeyD: 2, ArrowUp: 4, KeyW: 4, KeyZ: 4, ArrowDown: 8, KeyS: 8, KeyJ: 16, Space: 16, KeyK: 32, KeyL: 64 };
  const flush = () => { if (mask !== lastSent) { lastSent = mask; lastAt = performance.now(); send({ t: 'act', a: 'input', k: mask }); } };
  const kd = e => { const m = MAP[e.code]; if (!m) return; e.preventDefault(); mask |= m; flush(); };
  const ku = e => { const m = MAP[e.code]; if (!m) return; mask &= ~m; flush(); };
  const blur = () => { mask = 0; flush(); };
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('blur', blur);
  pad.querySelectorAll('[data-m]').forEach(bt => {
    const m = +bt.dataset.m;
    bt.addEventListener('pointerdown', e => { e.preventDefault(); mask |= m; bt.classList.add('on'); flush(); });
    const up = () => { mask &= ~m; bt.classList.remove('on'); flush(); };
    bt.addEventListener('pointerup', up); bt.addEventListener('pointerleave', up); bt.addEventListener('pointercancel', up);
  });

  /* décor pré-rendu : halle sombre, charpente, cheminées */
  const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
  (() => {
    const b = bg.getContext('2d');
    const sky = b.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#0e0b0a'); sky.addColorStop(0.65, '#24140c'); sky.addColorStop(1, '#4a1e08');
    b.fillStyle = sky; b.fillRect(0, 0, W, H);
    b.fillStyle = 'rgba(0,0,0,.45)';
    for (let x = 0; x < W; x += 120) { b.fillRect(x + 20, 60 + (x * 37 % 90), 70, H); }
    b.strokeStyle = 'rgba(0,0,0,.6)'; b.lineWidth = 8;
    b.beginPath(); b.moveTo(0, 22); b.lineTo(W, 22); b.stroke();
    b.lineWidth = 3; for (let x = 0; x < W; x += 80) { b.beginPath(); b.moveTo(x, 22); b.lineTo(x + 40, 56); b.lineTo(x + 80, 22); b.stroke(); }
    for (let i = 0; i < 60; i++) { b.fillStyle = `rgba(255,${120 + Math.random() * 80 | 0},40,${Math.random() * 0.25})`; b.fillRect(Math.random() * W, Math.random() * H * 0.8, 2, 2); }
  })();

  /* pantins */
  const dolls = [];
  const mkDoll = (P) => { const d = {}; BR_PTS.forEach(k => { d[k] = { x: P[k][0], y: P[k][1], px: P[k][0], py: P[k][1] }; }); return d; };
  let prev = null, cur = null, prevAt = 0, curAt = 0, seen = 0, round = 0;
  let shake = 0;
  const parts = [], floats = [], booms = [];
  const burst = (x, y, n, col, sp = 6, life = 0.5, grav = 0.3) => { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = Math.random() * sp; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * 0.3, life, t: 0, col, grav }); } };

  function push(v) {
    if (v.round !== round) { round = v.round; dolls.length = 0; parts.length = 0; prev = null; }
    prev = cur && cur.round === v.round ? cur : v; prevAt = curAt || performance.now(); cur = v; curAt = performance.now();
    for (const e of v.ev) {
      if (e.id <= seen) continue;
      seen = e.id;
      if (e.k === 'hit') { burst(e.x, e.y, e.big ? 18 : 8, e.big ? '#ffd27a' : '#fff', e.big ? 9 : 5); shake = Math.max(shake, e.big ? 10 : 4); sfx(e.big ? 90 : 160, 0.12, 'square', e.big ? 0.08 : 0.05, -40); floats.push({ x: e.x, y: e.y - 20, t: `-${e.d}`, at: performance.now() }); }
      else if (e.k === 'block') { burst(e.x, e.y, 6, '#7fd4ff', 4); sfx(900, 0.06, 'triangle', 0.04); }
      else if (e.k === 'swing') sfx(220, 0.05, 'triangle', 0.02, 200);
      else if (e.k === 'jump') sfx(e.d ? 520 : 380, 0.07, 'sine', 0.03, 300);
      else if (e.k === 'shot') { sfx(e.w === 'tromblon' ? 110 : 700, e.w === 'tromblon' ? 0.2 : 0.06, 'sawtooth', 0.05, -200); burst(e.x, e.y, 4, '#ffd27a', 3, 0.2, 0); shake = Math.max(shake, e.w === 'tromblon' ? 6 : 2); }
      else if (e.k === 'spark') burst(e.x, e.y, 4, '#ffd27a', 3, 0.25);
      else if (e.k === 'boom') { booms.push({ x: e.x, y: e.y, at: performance.now() }); burst(e.x, e.y, 40, '#ff8a2a', 12, 0.8); shake = 18; sfx(60, 0.6, 'sawtooth', 0.1, -20); }
      else if (e.k === 'pick') { floats.push({ x: e.x, y: e.y - 20, t: A.weapons[e.w], at: performance.now(), c: '#F5B700' }); sfx(880, 0.08, 'triangle', 0.04, 400); }
      else if (e.k === 'throw') sfx(300, 0.1, 'triangle', 0.03, 300);
      else if (e.k === 'die') {
        const d = dolls[e.seat];
        if (d) BR_PTS.forEach(k => { const p = d[k]; p.px = p.x - e.vx * 0.5 * (0.6 + Math.random() * 0.8); p.py = p.y - e.vy * 0.5 * (0.6 + Math.random() * 0.8); });
        if (e.how === 'fonte') { burst(e.x, Math.min(e.y, v.lava), 30, '#ff8a2a', 10, 0.9); sfx(120, 0.5, 'sawtooth', 0.07, -60); }
        else { burst(e.x, e.y - 50, 20, '#fff', 7); }
        shake = Math.max(shake, 8);
        if (e.seat === mySeat) bannerT = performance.now();
        sfx(70, 0.5, 'square', 0.07, -30);
      }
      else if (e.k === 'go') { sfx(660, 0.2, 'square', 0.05); }
      else if (e.k === 'win') { if (e.seat === mySeat) [523, 659, 784].forEach((f, i) => setTimeout(() => sfx(f, 0.2, 'square', 0.05), i * 130)); }
      else if (e.k === 'belt') sfx(140, 0.3, 'sawtooth', 0.04, 60);
    }
  }
  let bannerT = 0;
  const lerp = (a, b, t) => a + (b - a) * t;

  function stepDoll(i, b, t, dt) {
    const P = brawlPose(b, t, b.run || 0);
    let d = dolls[i];
    if (!d || (b.al && Math.hypot(d.p.x - P.p[0], d.p.y - P.p[1]) > 220)) d = dolls[i] = mkDoll(P);
    const f = Math.min(2, dt * 60);
    BR_PTS.forEach(k => {
      const p = d[k];
      if (b.al) {
        const vx = (p.x - p.px) * 0.45, vy = (p.y - p.py) * 0.45;
        p.px = p.x; p.py = p.y;
        p.x += vx; p.y += vy;
        const pull = k === 'p' || k === 'n' ? 0.7 : k[0] === 'f' ? 0.75 : 0.5;
        p.x += (P[k][0] - p.x) * pull; p.y += (P[k][1] - p.y) * pull;
      } else {      // pantin désarticulé : inertie, gravité, rebonds sur les plateformes
        const vx = (p.x - p.px) * 0.985, vy = (p.y - p.py) * 0.985;
        p.px = p.x; p.py = p.y;
        p.x += vx * f; p.y += vy * f + 0.9 * f;
        if (p.y < cur.lava) for (const q of cur.plats) {
          if (p.x > q[0] && p.x < q[0] + q[2] && p.y > q[1] && p.py <= q[1] + 2) { p.y = q[1]; p.px = p.x - (p.x - p.px) * 0.6; }
        }
      }
    });
    for (let it = 0; it < (b.al ? 2 : 4); it++) for (const [a2, b2, len] of BR_BONES) {
      const p = d[a2], q = d[b2], dx = q.x - p.x, dy = q.y - p.y, dd = Math.hypot(dx, dy) || 1, diff = (dd - len) / dd * 0.5;
      p.x += dx * diff; p.y += dy * diff; q.x -= dx * diff; q.y -= dy * diff;
    }
    // la tête reste au-dessus du cou tant qu'on est debout
    if (b.al) { d.h.x += (P.h[0] - d.h.x) * 0.5; d.h.y += (P.h[1] - d.h.y) * 0.5; }
    const out = {}; BR_PTS.forEach(k => { out[k] = [d[k].x, d[k].y]; }); out.weaponA = P.weaponA;
    return out;
  }

  const runs = [];
  function drawPlat(q, t) {
    const [x, y, w, h, gnd, belt, mv] = q;
    const X = x * K, Y = y * K, Wd = w * K, Hd = h * K;
    if (mv) { g.strokeStyle = '#555'; g.lineWidth = 2; g.beginPath(); g.moveTo(X + 10, 0); g.lineTo(X + 10, Y); g.moveTo(X + Wd - 10, 0); g.lineTo(X + Wd - 10, Y); g.stroke(); g.fillStyle = '#F5B700'; g.fillRect(X + Wd / 2 - 18, 18, 36, 10); }
    g.fillStyle = gnd ? '#3a3d42' : '#2b2e33'; g.fillRect(X, Y, Wd, Hd);
    g.fillStyle = gnd ? '#5c6067' : '#4a4e55'; g.fillRect(X, Y, Wd, 4);
    if (belt) {
      const s = belt * cur.belt, off = (t * s * 30) % 16;
      g.fillStyle = '#1a1a1a'; g.fillRect(X, Y, Wd, 6);
      g.fillStyle = '#8a8d91'; for (let xx = X - 16 + ((off % 16) + 16) % 16; xx < X + Wd; xx += 16) if (xx > X) g.fillRect(xx, Y + 1, 6, 4);
      g.fillStyle = '#F5B700'; g.font = '900 12px "Big Shoulders Display", Impact'; g.textAlign = 'center'; g.fillText(s > 0 ? '▶▶' : '◀◀', X + Wd / 2, Y + Hd - 4);
    } else if (mv || !gnd) { g.fillStyle = '#F5B700'; for (let xx = X; xx < X + Wd - 6; xx += 20) { g.beginPath(); g.moveTo(xx, Y + Hd); g.lineTo(xx + 10, Y + 4); g.lineTo(xx + 16, Y + 4); g.lineTo(xx + 6, Y + Hd); g.fill(); } }
  }

  const stop = loop((dt, tms) => {
    if (!cur) return;
    const t = tms / 1000, now = performance.now();
    if (now - lastAt > 150) { lastSent = -1; flush(); }
    const it = Math.min(1.2, (now - curAt) / Math.max(25, curAt - prevAt));
    g.save();
    if (shake > 0.2) { g.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake); shake *= 0.86; }
    g.drawImage(bg, 0, 0);
    // jet de fonte de la halle
    const M = A.maps[cur.map];
    if (M.pour) {
      const px = M.pour.x * K, per = M.pour.period, warn = cur.t % per >= per - M.pour.on - 45;
      g.fillStyle = '#3a3d42'; g.fillRect(px - 30, 0, 60, 34); g.fillStyle = '#5c6067'; g.fillRect(px - 12, 30, 24, 14);
      if (cur.pour) { const gr = g.createLinearGradient(px - 14, 0, px + 14, 0); gr.addColorStop(0, '#ff6a1a'); gr.addColorStop(0.5, '#fff1a8'); gr.addColorStop(1, '#ff6a1a'); g.fillStyle = gr; g.fillRect(px - 12 + Math.sin(t * 30) * 1.5, 40, 24, H); g.shadowBlur = 0; }
      else if (warn) { g.fillStyle = Math.sin(t * 20) > 0 ? '#ffb347' : '#ff6a1a'; for (let k2 = 0; k2 < 3; k2++) g.fillRect(px - 3, 44 + ((t * 300 + k2 * 60) % 200), 6, 10); }
    }
    // plateformes (interpolées)
    cur.plats.forEach((q, k2) => { const pq = prev && prev.plats[k2] ? prev.plats[k2] : q; drawPlat([lerp(pq[0], q[0], it), lerp(pq[1], q[1], it), ...q.slice(2)], t); });
    // caisses d'armes
    cur.crates.forEach(cr => {
      const [x, y, w, land] = cr, X = x * K, Y = y * K;
      if (!land) { g.strokeStyle = '#ddd'; g.lineWidth = 1; g.beginPath(); g.moveTo(X - 14, Y - 26); g.lineTo(X - 22, Y - 56); g.moveTo(X + 14, Y - 26); g.lineTo(X + 22, Y - 56); g.stroke(); g.fillStyle = '#BA2C3A'; g.beginPath(); g.arc(X, Y - 54, 26, Math.PI, 0); g.fill(); }
      g.fillStyle = '#8b5a2b'; g.fillRect(X - 16, Y - 26, 32, 26); g.strokeStyle = '#5a3a1a'; g.lineWidth = 2; g.strokeRect(X - 16, Y - 26, 32, 26);
      g.beginPath(); g.moveTo(X - 16, Y - 26); g.lineTo(X + 16, Y); g.stroke();
      drawBrawlWeapon(g, w, X - 14, Y - 13, 0, 0.45);
      if (land) { g.fillStyle = `rgba(245,183,0,${0.4 + Math.sin(t * 6) * 0.3})`; g.fillRect(X - 16, Y - 30, 32, 2); }
    });
    // combattants
    cur.b.forEach((b, i) => {
      const pb = prev && prev.b[i] ? prev.b[i] : b;
      const q = { ...b, x: b.al ? lerp(pb.x, b.x, it) : b.x, y: b.al ? lerp(pb.y, b.y, it) : b.y, win: cur.phase === 'ko' && b.al };
      runs[i] = (runs[i] || 0) + Math.abs(b.vx) * dt * 30; q.run = runs[i];
      const P = stepDoll(i, q, t, dt);
      const col = BR_COLORS[b.ch];
      if (!b.al && P.p[1] > cur.lava + 60) return;
      drawStick(g, P, col, b.ch, K, { fc: b.fc, flash: b.f > 0, alpha: b.al ? 1 : 0.85 });
      if (b.w && P.weaponA !== undefined) drawBrawlWeapon(g, b.w, P.hR[0] * K, P.hR[1] * K, b.fc > 0 ? P.weaponA : Math.PI - P.weaponA, K, b.fc);
      if (b.fl) {      // flamme de la lance thermique
        const a = b.fc > 0 ? P.weaponA : Math.PI - P.weaponA, ox = P.hR[0] + Math.cos(a) * 52, oy = P.hR[1] + Math.sin(a) * 52;
        for (let k2 = 0; k2 < 5; k2++) parts.push({ x: ox, y: oy, vx: Math.cos(a + (Math.random() - 0.5) * 0.5) * (14 + Math.random() * 6), vy: Math.sin(a + (Math.random() - 0.5) * 0.5) * (14 + Math.random() * 6), life: 0.32, t: 0, col: Math.random() < 0.5 ? '#ffd27a' : '#ff6a1a', grav: -0.1, big: 1 });
        if (Math.random() < 0.3) sfx(120 + Math.random() * 40, 0.05, 'sawtooth', 0.015);
      }
      if (b.bl) { g.strokeStyle = 'rgba(127,212,255,.7)'; g.lineWidth = 3; g.beginPath(); g.arc((q.x + b.fc * 20) * K, (q.y - 60) * K, 34 * K, -1.1, 1.1); if (b.fc < 0) { g.beginPath(); g.arc((q.x + b.fc * 20) * K, (q.y - 60) * K, 34 * K, Math.PI - 1.1, Math.PI + 1.1); } g.stroke(); }
      if (b.al) {
        g.font = '800 10px Archivo, sans-serif'; g.textAlign = 'center'; g.fillStyle = i === mySeat ? '#F5B700' : 'rgba(255,255,255,.8)';
        g.fillText(i === mySeat ? '▼ TOI' : b.n, q.x * K, (q.y - 120) * K);
      }
    });
    // projectiles
    cur.proj.forEach(([x, y, kd, w, vx]) => {
      const X = x * K, Y = y * K;
      if (kd === 'balle') { g.strokeStyle = '#fff1a8'; g.lineWidth = 3; g.beginPath(); g.moveTo(X - vx * K * 0.7, Y); g.lineTo(X, Y); g.stroke(); }
      else if (kd === 'boulet') { drawBrawlWeapon(g, 'boulet', X - 8 * K, Y, 0, K); if (Math.random() < 0.6) parts.push({ x: x, y: y - 18, vx: (Math.random() - 0.5) * 3, vy: -2, life: 0.25, t: 0, col: '#ffd27a', grav: 0 }); }
      else drawBrawlWeapon(g, w, X, Y, t * 14 * Math.sign(vx || 1), K);
    });
    // fonte en bas
    const ly = Math.min(cur.lava, A.h - 18) * K;
    const lg = g.createLinearGradient(0, ly, 0, H); lg.addColorStop(0, '#fff1a8'); lg.addColorStop(0.08, '#ff8a2a'); lg.addColorStop(1, '#8a1e08');
    g.fillStyle = lg; g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 24) g.lineTo(x, ly + Math.sin(x * 0.03 + t * 3) * 3);
    g.lineTo(W, H); g.fill();
    for (let k2 = 0; k2 < 6; k2++) { const bx = (k2 * 173 + t * 40) % W, ph = (t * 1.3 + k2 * 0.37) % 1; g.fillStyle = `rgba(255,241,168,${1 - ph})`; g.beginPath(); g.arc(bx, ly + 6 - ph * 8, 3 + ph * 4, 0, Math.PI * 2); g.fill(); }
    if (cur.lava < A.h && cur.phase === 'fight' && Math.sin(t * 6) > 0) { g.font = '400 10px "Press Start 2P", monospace'; g.textAlign = 'center'; g.fillStyle = '#ffb347'; g.fillText('LA FONTE MONTE !', W / 2, ly - 12); }
    // particules
    for (let k2 = parts.length - 1; k2 >= 0; k2--) {
      const p = parts[k2]; p.t += dt; if (p.t > p.life) { parts.splice(k2, 1); continue; }
      p.x += p.vx * dt * 30; p.y += p.vy * dt * 30; p.vy += p.grav * dt * 30;
      g.globalAlpha = 1 - p.t / p.life; g.fillStyle = p.col; const s2 = p.big ? 7 : 3; g.fillRect(p.x * K - s2 / 2, p.y * K - s2 / 2, s2, s2);
    }
    g.globalAlpha = 1;
    for (let k2 = booms.length - 1; k2 >= 0; k2--) { const bm = booms[k2], a2 = (now - bm.at) / 450; if (a2 > 1) { booms.splice(k2, 1); continue; } g.fillStyle = `rgba(255,${200 - a2 * 120 | 0},80,${1 - a2})`; g.beginPath(); g.arc(bm.x * K, bm.y * K, 150 * K * (0.3 + a2 * 0.7), 0, Math.PI * 2); g.fill(); }
    for (let k2 = floats.length - 1; k2 >= 0; k2--) { const f = floats[k2], a2 = (now - f.at) / 900; if (a2 > 1) { floats.splice(k2, 1); continue; } g.globalAlpha = 1 - a2; g.font = '900 16px "Big Shoulders Display", Impact'; g.textAlign = 'center'; g.fillStyle = f.c || '#fff'; g.strokeStyle = '#000'; g.lineWidth = 3; g.strokeText(f.t, f.x * K, (f.y - a2 * 40) * K); g.fillText(f.t, f.x * K, (f.y - a2 * 40) * K); g.globalAlpha = 1; }
    g.restore();
    // bandeau des joueurs
    const n = cur.b.length, cw = Math.min(220, (W - 20) / n);
    cur.b.forEach((b, i) => {
      const x = 10 + i * cw, y = 26;
      g.fillStyle = 'rgba(8,9,11,.82)'; g.fillRect(x, y, cw - 8, 38);
      g.fillStyle = BR_COLORS[b.ch]; g.fillRect(x, y, 5, 38);
      g.font = '800 11px Archivo, sans-serif'; g.textAlign = 'left'; g.fillStyle = b.al ? '#fff' : '#777';
      g.fillText(`${b.n}${i === mySeat ? ' (toi)' : ''}`, x + 11, y + 14);
      g.fillStyle = '#333'; g.fillRect(x + 11, y + 20, cw - 70, 7);
      g.fillStyle = b.hp > 50 ? '#7FD48A' : b.hp > 25 ? '#F5B700' : '#ff5a5a'; g.fillRect(x + 11, y + 20, (cw - 70) * Math.max(0, b.hp) / 100, 7);
      for (let k2 = 0; k2 < A.toWin; k2++) { g.fillStyle = k2 < b.wins ? '#F5B700' : 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(x + cw - 50 + k2 * 13, y + 24, 5, 0, Math.PI * 2); g.fill(); }
      if (b.w) { g.font = '700 9px Archivo, sans-serif'; g.fillStyle = '#ffd27a'; g.fillText(`${A.weapons[b.w]}${b.w === 'lance' ? ` ${Math.round(b.am / 75 * 100)} %` : b.am > 1 ? ` ×${b.am}` : ''}`, x + 11, y + 36); }
    });
    g.font = '400 10px "Press Start 2P", monospace'; g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,.7)';
    g.fillText(`MANCHE ${cur.round} · ${M.name.toUpperCase()}`, W / 2, 17);
    if (cur.phase === 'intro' || cur.phase === 'ko' || cur.phase === 'over') bigText(g, cur.banner, W / 2, H / 2 - 60, cur.banner.length > 26 ? 30 : 40, '#F5B700');
    if (cur.phase === 'fight' && cur.t < 25) bigText(g, 'BAGARRE !', W / 2, H / 2 - 60, 56, '#ff5a3a');
    const me = cur.b[mySeat];
    if (me && !me.al && cur.phase === 'fight') { g.font = '400 11px "Press Start 2P", monospace'; g.textAlign = 'center'; g.fillStyle = '#ff8a8a'; g.fillText('TU ES AU TAPIS · ATTENDS LA MANCHE SUIVANTE', W / 2, 90); }
  });

  return {
    push, endShown: false,
    stop() { stop(); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur); },
  };
}
