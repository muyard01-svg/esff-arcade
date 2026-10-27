/* Escadrille 101 — affichage du combat aérien (simulation serveur : planes.py) */
'use strict';

let planeClient = null;
function stopPlanes() { if (planeClient) { planeClient.stop(); planeClient = null; } }

function updatePlanes() {
  if (view.finished) {
    if (document.getElementById('rewardBox')) return;
    stopPlanes();
    resultScreen(view.finished.map((i, k) => {
      const p = view.p[i];
      return `<li><b>${k + 1}</b><i style="background:${p.c}"></i><span>${esc(p.n)}${i === mySeat ? ' (toi)' : ''}</span><em>${p.k} abattus · ${p.d} chutes</em></li>`;
    }));
    return;
  }
  if (!planeClient) planeClient = startPlanesClient();
  planeClient.push(view);
}

/* Avion vu du dessus, nez vers +x */
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

function startPlanesClient() {
  const W = 960, H = 540;
  const [WW, WH] = view.world;
  stage.innerHTML = '';
  $('#hudInfo').textContent = `${view.p.length} avions · ${view.killsToWin} victoires`;
  const wrap = document.createElement('div');
  wrap.className = 'play-wrap';
  stage.appendChild(wrap);
  const pad = document.createElement('div');
  pad.className = 'touch-pad';
  pad.innerHTML = `<div class="grp"><button data-m="1">◀</button><button data-m="2">▶</button></div>
    <div class="grp"><button data-m="8">▼</button><button data-m="4">▲</button><button data-m="16" class="hot">FEU</button></div>`;
  const { c, g } = makeCanvas(wrap, W, H);
  wrap.appendChild(pad);
  const hint = document.createElement('p');
  hint.className = 'keys-hint';
  hint.textContent = '← → VIRER · ↑ ACCÉLÉRER · ↓ RALENTIR · ESPACE / J TIRER';
  wrap.appendChild(hint);

  // ---- monde : mer, îles-usines, nuages (identiques pour tous, graine fixe) ----
  let seed = 101;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const islands = Array.from({ length: 9 }, (_, i) => ({ x: rnd() * WW, y: rnd() * WH, r: 60 + rnd() * 110, chim: 1 + Math.floor(rnd() * 3), main: i === 0 }));
  islands[0].x = WW / 2; islands[0].y = WH / 2; islands[0].r = 170;
  const clouds = Array.from({ length: 14 }, () => ({ x: rnd() * WW, y: rnd() * WH, r: 60 + rnd() * 90, v: 8 + rnd() * 14 }));
  const smoke = [];
  const parts = [];

  const wrapD = (a, b, L) => ((b - a + L / 2) % L + L) % L - L / 2;

  // ---- entrées ----
  let mask = 0, sent = -1, lastSend = 0;
  const KEYMAP = { ArrowLeft: 1, KeyA: 1, KeyQ: 1, ArrowRight: 2, KeyD: 2, ArrowUp: 4, KeyW: 4, KeyZ: 4, ArrowDown: 8, KeyS: 8, Space: 16, KeyJ: 16, KeyX: 16 };
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

  // ---- état reçu ----
  let cur = null, prev = null, curAt = 0, seenFeed = 0, lastCount = null;
  const wasAlive = [];
  const feedShown = [];
  const disp = []; // positions lissées
  function push(v) {
    prev = cur || v; cur = v; curAt = performance.now();
    v.p.forEach((p, i) => {
      if (wasAlive[i] && !p.al) {          // explosion
        for (let k = 0; k < 40; k++) { const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 220; parts.push({ x: p.x, y: p.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6 + Math.random() * 0.6, fire: true }); }
        sfx(80, 0.5, 'sawtooth', 0.07, -40);
      }
      wasAlive[i] = p.al;
    });
    for (const f of v.feed) {
      if (f.id <= seenFeed) continue;
      seenFeed = f.id;
      feedShown.push({ ...f, at: performance.now() });
      if (f.k === v.p[mySeat].n) { toast(`🎯 Tu as abattu ${f.v} !`); sfx(880, 0.15, 'triangle', 0.06); }
    }
    const n = Math.ceil(v.countdown);
    if (v.phase === 'count' && n !== lastCount && n > 0) { lastCount = n; sfx(440, 0.15, 'square', 0.05); }
    if (v.phase === 'play' && lastCount !== 0) { lastCount = 0; sfx(880, 0.3, 'square', 0.06); }
  }

  let gunT = 0;
  const stop = loop((dt, tms) => {
    if (!cur) return;
    const t = tms / 1000;
    const a = Math.min(1, (performance.now() - curAt) / 34);
    // positions interpolées (monde torique)
    cur.p.forEach((p, i) => {
      const q = (prev.p[i] || p);
      disp[i] = { x: (q.x + wrapD(q.x, p.x, WW) * a + WW) % WW, y: (q.y + wrapD(q.y, p.y, WH) * a + WH) % WH, a: q.a + Math.atan2(Math.sin(p.a - q.a), Math.cos(p.a - q.a)) * a };
    });
    const me = disp[mySeat], mp = cur.p[mySeat];
    const camX = me.x + Math.cos(me.a) * 120, camY = me.y + Math.sin(me.a) * 80;
    const toScreen = (x, y) => [W / 2 + wrapD(camX, x, WW), H / 2 + wrapD(camY, y, WH)];

    // mer
    g.fillStyle = '#123247'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 2;
    const off = ((camX % 60) + 60) % 60, offY = ((camY % 40) + 40) % 40;
    for (let y = -offY; y < H; y += 40) for (let x = -off + ((Math.floor((y + camY) / 40) & 1) * 30); x < W; x += 60) { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 8, y - 4 + Math.sin(t * 2 + x) * 1.5, x + 16, y); g.stroke(); }
    // îles-usines
    for (const is of islands) {
      const [sx, sy] = toScreen(is.x, is.y);
      if (sx < -is.r - 50 || sx > W + is.r + 50 || sy < -is.r - 50 || sy > H + is.r + 50) continue;
      g.fillStyle = '#d8c48f'; g.beginPath(); g.arc(sx, sy, is.r + 10, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#3d4a2e'; g.beginPath(); g.arc(sx, sy, is.r, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2b2f36'; g.fillRect(sx - is.r * 0.45, sy - is.r * 0.3, is.r * 0.9, is.r * 0.55);
      g.fillStyle = '#EC641E'; g.fillRect(sx - is.r * 0.45, sy - is.r * 0.3, is.r * 0.9, 5);
      for (let k = 0; k < is.chim; k++) {
        const cx = sx - is.r * 0.3 + k * 26, cy = sy - is.r * 0.1;
        g.fillStyle = '#5a4a3a'; g.beginPath(); g.arc(cx, cy, 9, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#ffb347'; g.beginPath(); g.arc(cx, cy, 4, 0, Math.PI * 2); g.fill();
        if (Math.random() < 0.25) smoke.push({ x: is.x - is.r * 0.3 + k * 26, y: is.y - is.r * 0.1, r: 6, life: 3 });
      }
      if (is.main) { g.font = `900 30px ${DISPLAY}`; g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText('ESFF', sx, sy + is.r * 0.55); }
    }
    for (let i = smoke.length - 1; i >= 0; i--) {
      const s = smoke[i]; s.life -= dt; s.r += dt * 10; s.x += dt * 14; s.y -= dt * 4;
      if (s.life <= 0) { smoke.splice(i, 1); continue; }
      const [sx, sy] = toScreen(s.x, s.y);
      g.fillStyle = `rgba(40,40,44,${s.life * 0.12})`; g.beginPath(); g.arc(sx, sy, s.r, 0, Math.PI * 2); g.fill();
    }
    // balles traçantes
    g.strokeStyle = '#ffe07a'; g.lineWidth = 2.5; g.lineCap = 'round';
    for (const b of cur.b) {
      const [sx, sy] = toScreen(b[0], b[1]);
      if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue;
      g.beginPath(); g.moveTo(sx - b[2] * 0.9, sy - b[3] * 0.9); g.lineTo(sx, sy); g.stroke();
    }
    // avions
    cur.p.forEach((p, i) => {
      if (!p.al) return;
      const d = disp[i];
      const [sx, sy] = toScreen(d.x, d.y);
      if (sx < -60 || sx > W + 60 || sy < -60 || sy > H + 60) return;
      if (p.hp < 40 && Math.random() < 0.5) parts.push({ x: d.x - Math.cos(d.a) * 20, y: d.y - Math.sin(d.a) * 20, vx: 0, vy: 0, life: 1, smoke: true });
      g.save(); g.translate(sx, sy); g.rotate(d.a);
      if (p.sh) { g.strokeStyle = `rgba(127,212,255,${0.4 + Math.sin(t * 12) * 0.3})`; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 34, 0, Math.PI * 2); g.stroke(); }
      drawPlane(g, p.c, p.f, t, i === mySeat ? 1.15 : 1);
      g.restore();
      g.font = `800 13px ${DISPLAY}`; g.textAlign = 'center'; g.fillStyle = i === mySeat ? '#7fd4ff' : '#fff';
      g.fillText(i === mySeat ? 'TOI' : p.n, sx, sy - 38);
      if (i !== mySeat) { g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(sx - 20, sy - 33, 40, 4); g.fillStyle = p.hp > 40 ? '#7fd48a' : '#ff6b6b'; g.fillRect(sx - 20, sy - 33, 40 * p.hp / 100, 4); }
    });
    // particules (explosions, fumée)
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96;
      const [sx, sy] = toScreen(p.x, p.y);
      if (p.smoke) { g.fillStyle = `rgba(60,60,60,${p.life * 0.5})`; g.beginPath(); g.arc(sx, sy, 6 + (1 - p.life) * 10, 0, Math.PI * 2); g.fill(); }
      else { g.fillStyle = `hsla(${20 + p.life * 30},100%,${45 + p.life * 30}%,${Math.min(1, p.life * 2)})`; g.beginPath(); g.arc(sx, sy, 3 + p.life * 5, 0, Math.PI * 2); g.fill(); }
    }
    // nuages au-dessus
    for (const cl of clouds) {
      cl.x = (cl.x + cl.v * dt) % WW;
      const [sx, sy] = toScreen(cl.x, cl.y);
      if (sx < -cl.r * 2 || sx > W + cl.r * 2 || sy < -cl.r * 2 || sy > H + cl.r * 2) continue;
      g.fillStyle = 'rgba(255,255,255,.16)';
      g.beginPath(); g.arc(sx, sy, cl.r, 0, Math.PI * 2); g.arc(sx + cl.r * 0.7, sy + 8, cl.r * 0.7, 0, Math.PI * 2); g.arc(sx - cl.r * 0.7, sy + 10, cl.r * 0.6, 0, Math.PI * 2); g.fill();
    }

    // ---- HUD ----
    // vie + vitesse
    g.fillStyle = 'rgba(8,9,11,.75)'; g.fillRect(14, H - 58, 250, 44);
    g.font = `400 8px "Press Start 2P", monospace`; g.textAlign = 'left'; g.fillStyle = '#9aa0a6';
    g.fillText('BLINDAGE', 24, H - 42); g.fillText(`VITESSE ${mp.v}`, 150, H - 42);
    g.fillStyle = '#300'; g.fillRect(24, H - 34, 226, 12);
    g.fillStyle = mp.hp > 40 ? '#7fd48a' : '#ff6b6b'; g.fillRect(24, H - 34, 226 * Math.max(0, mp.hp) / 100, 12);
    // chrono
    const mm = Math.floor(cur.time / 60), ss = String(cur.time % 60).padStart(2, '0');
    g.fillStyle = 'rgba(8,9,11,.75)'; g.fillRect(W / 2 - 60, 10, 120, 36);
    g.font = `400 16px "Press Start 2P", monospace`; g.textAlign = 'center'; g.fillStyle = cur.time <= 20 ? '#ff6b6b' : '#fff';
    g.fillText(`${mm}:${ss}`, W / 2, 36);
    // tableau des scores
    const order = cur.p.map((p, i) => ({ ...p, i })).sort((x, y) => y.k - x.k || x.d - y.d);
    g.fillStyle = 'rgba(8,9,11,.75)'; g.fillRect(W - 210, 10, 196, 24 + order.length * 20);
    g.font = `400 8px "Press Start 2P", monospace`; g.textAlign = 'left'; g.fillStyle = '#F5B700'; g.fillText('PILOTES', W - 200, 28);
    order.forEach((p, r) => {
      const y = 48 + r * 20;
      g.fillStyle = p.c; g.fillRect(W - 200, y - 9, 10, 10);
      g.font = `800 14px ${DISPLAY}`; g.fillStyle = p.i === mySeat ? '#7fd4ff' : '#fff'; g.fillText(p.n.slice(0, 16), W - 184, y);
      g.textAlign = 'right'; g.fillText(`${p.k} / ${p.d}`, W - 22, y); g.textAlign = 'left';
    });
    // mini-carte
    const mw = 150, mh = mw * WH / WW, mx = 14, my = 14;
    g.fillStyle = 'rgba(8,9,11,.75)'; g.fillRect(mx, my, mw, mh);
    g.strokeStyle = '#34373b'; g.strokeRect(mx, my, mw, mh);
    islands.forEach(is => { g.fillStyle = '#3d4a2e'; g.beginPath(); g.arc(mx + is.x / WW * mw, my + is.y / WH * mh, Math.max(2, is.r / WW * mw), 0, Math.PI * 2); g.fill(); });
    cur.p.forEach((p, i) => { if (!p.al) return; g.fillStyle = p.c; g.beginPath(); g.arc(mx + disp[i].x / WW * mw, my + disp[i].y / WH * mh, i === mySeat ? 4 : 3, 0, Math.PI * 2); g.fill(); });
    // fil des victoires
    const now = performance.now();
    feedShown.filter(f => now - f.at < 5000).slice(-4).forEach((f, r) => {
      g.font = `800 15px ${DISPLAY}`; g.textAlign = 'right';
      g.fillStyle = 'rgba(8,9,11,.6)'; g.fillRect(W - 300, H - 110 + r * 22 - 15, 286, 20);
      g.fillStyle = '#fff'; g.fillText(`${f.k}  ✈✕  ${f.v}`, W - 22, H - 110 + r * 22);
    });
    // compte à rebours / mort
    if (cur.phase === 'count') bigText(g, String(Math.max(1, Math.ceil(cur.countdown))), W / 2, H / 2 - 60, 90);
    else if (cur.phase === 'play' && performance.now() - curAt < 2000 && cur.time > 177) bigText(g, 'DÉCOLLAGE !', W / 2, H / 2 - 60, 60, '#F5B700');
    if (!mp.al) {
      g.fillStyle = 'rgba(186,44,58,.25)'; g.fillRect(0, 0, W, H);
      bigText(g, 'ABATTU !', W / 2, H / 2 - 30, 70, '#ff8a8a');
      bigText(g, `Retour en vol dans ${mp.rs}…`, W / 2, H / 2 + 26, 24, '#fff');
    }
    // son des mitrailleuses
    gunT -= dt;
    if (mp.f && gunT <= 0) { gunT = 0.09; sfx(140 + Math.random() * 30, 0.04, 'square', 0.025); }
    pushInput(false);
  });

  return {
    push,
    stop() {
      stop();
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    },
  };
}
