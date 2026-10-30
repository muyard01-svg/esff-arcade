/* Forge Tactique — auto-battler sur les métiers de la métallurgie (simulation serveur : tactique.py).
   Recrutement, placement à la souris ou au doigt, puis le combat calculé par le serveur est rejoué ici. */
'use strict';

ONLINE.push({
  id: 'tactique', title: 'Forge Tactique', tone: '#C77DFF', label: 'Stratégie auto · 2 à 8 joueurs', tag: 'TACTIQUE 2-8',
  pitch: 'Recrute les métiers de la métallurgie, place ton équipe sur l’atelier et regarde-la se battre toute seule. 14 corps de métier, 56 unités, des fusions en étoiles : le dernier atelier debout gagne.',
  how: '<b>Clic</b> sur une carte de la boutique pour recruter · <b>glisse</b> une unité pour la placer, sur la boutique pour la vendre · 3 exemplaires identiques fusionnent · 2, 4 ou 6 unités différentes d’un corps de métier donnent une synergie. La rareté suit la difficulté de recrutement et la spécialisation : ce n’est pas un jugement sur la valeur des métiers.',
});
HANDLERS.tactique = () => updateTactique();

let tqClient = null;
function stopTactique() { if (tqClient) { tqClient.stop(); tqClient = null; } }

function updateTactique() {
  if (!view || !trackInfo || !trackInfo.tq || onlineKind !== 'tactique') return;
  if (view.finished) {
    if (document.getElementById('rewardBox')) return;
    stopTactique();
    resultScreen(view.finished.map((i, k) => { const p = view.p[i]; return `<li><b>${k + 1}</b><i style="background:${k ? '#8a8d91' : '#F5B700'}"></i><span>${esc(p.n)}${i === mySeat ? ' (toi)' : ''}</span><em>niveau ${p.lv}</em></li>`; }));
    return;
  }
  if (!tqClient) tqClient = startTactiqueClient();
  tqClient.push(view);
}

function startTactiqueClient() {
  const W = 960, H = 540, D = trackInfo.tq, U = D.units, F = Object.fromEntries(D.families.map(f => [f.id, f]));
  const TIER = ['#a39a88', '#3f7fd8', '#8a4fd8', '#f5b700'], CELL = 46, BX = 170, BY = 6, SX = 170, SY = 380, SHY = 432;
  stage.innerHTML = '';
  $('#hudInfo').textContent = 'Le dernier atelier debout gagne';
  const wrap = document.createElement('div'); wrap.className = 'play-wrap'; stage.appendChild(wrap);
  const { c, g } = makeCanvas(wrap, W, H);
  c.style.touchAction = 'none';

  /* portraits : un personnage original par métier, mis en cache */
  const sprites = {};
  const sprite = id => {
    if (sprites[id]) return sprites[id];
    const s = document.createElement('canvas'); s.width = s.height = 88; const b = s.getContext('2d');
    b.save(); b.beginPath(); b.arc(44, 44, 42, 0, 7); b.clip(); b.fillStyle = F[U[id].f].c; b.fillRect(0, 0, 88, 88);
    toonMan(b, 44, 40, 0.56, seeded(id + 11), { kind: 'fonderie', suit: '#2b2e33' }); b.restore();
    b.beginPath(); b.arc(44, 44, 41, 0, 7); b.lineWidth = 5; b.strokeStyle = TIER[U[id].tier]; b.stroke();
    return sprites[id] = s;
  };
  const drawUnit = (id, star, x, y, size, o = {}) => {
    g.globalAlpha = o.a ?? 1; g.drawImage(sprite(id), x - size / 2, y - size / 2, size, size); g.globalAlpha = 1;
    if (star > 1) { g.font = '700 12px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = star === 3 ? '#ffd27a' : '#fff'; g.strokeStyle = '#000'; g.lineWidth = 3; const t = '★'.repeat(star); g.strokeText(t, x, y + size / 2 - 3); g.fillText(t, x, y + size / 2 - 3); }
  };

  /* état */
  let cur = null, recvAt = 0, combatAt = 0, combatRound = 0, drag = null, hover = null, mouse = { x: 0, y: 0 }, floats = [], seenHit = 0, sparks = [];
  const me = () => cur.p[mySeat];
  const act = (a, o = {}) => send({ t: 'act', a, ...o });
  function push(v) {
    if (v.phase === 'combat' && combatRound !== v.round) { combatRound = v.round; combatAt = performance.now(); seenHit = 0; floats = []; sparks = []; drag = null; sfx(330, 0.2, 'square', 0.05); }
    if (cur && v.phase === 'prep' && cur.phase !== 'prep') sfx(660, 0.1, 'triangle', 0.04);
    cur = v; recvAt = performance.now();
  }
  const myFight = () => {
    if (!cur.fights.length) return null;
    return cur.fights.find(f => f.a === mySeat || f.b === mySeat) || cur.fights[0];
  };
  const cellAt = (x, y) => {
    const col = Math.floor((x - BX) / CELL), row = Math.floor((y - BY) / CELL) - 4;
    if (col >= 0 && col < D.cols && row >= 0 && row < D.rows) return ['b', col, row];
    const k = Math.floor((x - SX) / CELL);
    if (y >= SY && y < SY + CELL && k >= 0 && k < D.bench) return ['s', k];
    return null;
  };
  const spotPos = s => s[0] === 'b' ? [BX + (s[1] + 0.5) * CELL, BY + (s[2] + 4.5) * CELL] : [SX + (s[1] + 0.5) * CELL, SY + CELL / 2];
  const unitAt = s => { const p = me(); if (s[0] === 's') return p.bench[s[1]]; const b = p.board.find(u => u[0] === s[1] && u[1] === s[2]); return b ? [b[2], b[3]] : null; };
  const BTN = { roll: [8, 432, 150, 44], xp: [8, 482, 150, 44], ready: [800, 492, 152, 40] };
  const inBox = (b, x, y) => x >= b[0] && y >= b[1] && x < b[0] + b[2] && y < b[1] + b[3];
  const pos = e => { const r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };
  const shopBox = i => [SX + i * 122, SHY, 116, 102];
  c.addEventListener('pointerdown', e => {
    if (!cur) return; const m = pos(e); mouse = m;
    if (inBox(BTN.ready, m.x, m.y)) { act('skip'); SFX.tick(); return; }
    if (cur.phase !== 'prep' || !me().hp) return;
    if (inBox(BTN.roll, m.x, m.y)) { act('roll'); SFX.tick(); return; }
    if (inBox(BTN.xp, m.x, m.y)) { act('xp'); SFX.tick(); return; }
    for (let i = 0; i < 5; i++) if (inBox(shopBox(i), m.x, m.y)) { if (me().shop[i] !== null) { act('buy', { i }); sfx(700, 0.06, 'triangle', 0.04); } return; }
    const s = cellAt(m.x, m.y);
    if (s && unitAt(s)) { drag = { s, u: unitAt(s) }; try { c.setPointerCapture(e.pointerId); } catch (_) {} }
  });
  c.addEventListener('pointermove', e => { if (cur) mouse = pos(e); });
  c.addEventListener('pointerup', e => {
    if (!drag) return; const m = pos(e), t = cellAt(m.x, m.y);
    if (m.y >= SHY && m.x >= SX && m.x < SX + 610) { act('sell', { b: drag.s }); sfx(300, 0.08, 'triangle', 0.04); }
    else if (t && t.join() !== drag.s.join()) { const ok = !(t[0] === 'b' && drag.s[0] === 's' && !unitAt(t) && me().board.length >= me().lv); if (ok) act('move', { a2: drag.s, b: t }); else toast(`Niveau ${me().lv} : ${me().lv} unités au maximum sur l’atelier.`); }
    drag = null;
  });

  /* synergies : unités différentes d'un même corps de métier */
  const traits = () => {
    const p = me(), m = {}; p.board.forEach(b => { const f = U[b[2]].f; (m[f] = m[f] || new Set()).add(b[2]); });
    return Object.entries(m).map(([f, s]) => ({ f, n: s.size, lv: s.size >= 6 ? 3 : s.size >= 4 ? 2 : s.size >= 2 ? 1 : 0 })).sort((a, b) => b.lv - a.lv || b.n - a.n);
  };
  function drawTraits() {
    g.textBaseline = 'middle'; let y = 12;
    traits().slice(0, 13).forEach(t => {
      const fam = F[t.f], box = [8, y, 154, 24], on = t.lv > 0;
      g.fillStyle = on ? fam.c : 'rgba(255,255,255,.08)'; rrect(g, ...box, 6); g.fill();
      g.fillStyle = on ? '#14110e' : '#c9c4ba'; g.font = '600 11px Fredoka, sans-serif'; g.textAlign = 'left'; g.fillText(fam.n, 14, y + 12, 112); g.textAlign = 'right'; g.fillText(`${t.n}/${[2, 4, 6][Math.min(2, t.lv)]}`, 156, y + 12);
      if (inBox(box, mouse.x, mouse.y)) hover = { t: fam.n, l: [`${fam.eff} : ${fam.lv.join(' / ')}`, 'Paliers : 2, 4 et 6 unités différentes', `Sort : ${fam.spell}`] };
      y += 28;
    });
  }
  function drawPlayers() {
    let y = 8; cur.p.map((p, i) => ({ ...p, i })).sort((a, b) => b.hp - a.hp).forEach(p => {
      g.fillStyle = p.i === mySeat ? 'rgba(245,183,0,.2)' : 'rgba(255,255,255,.06)'; rrect(g, 800, y, 152, 30, 6); g.fill();
      g.globalAlpha = p.hp ? 1 : 0.35; g.font = '600 12px Fredoka, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(p.n, 806, y + 10, 104); g.textAlign = 'right'; g.fillStyle = p.hp > 40 ? '#7FD48A' : p.hp > 15 ? '#F5B700' : '#ff5a5a'; g.fillText(p.hp, 946, y + 10);
      g.fillStyle = '#333'; g.fillRect(806, y + 20, 140, 4); g.fillStyle = p.hp > 40 ? '#7FD48A' : p.hp > 15 ? '#F5B700' : '#ff5a5a'; g.fillRect(806, y + 20, 140 * p.hp / 100, 4); g.globalAlpha = 1;
      y += 34;
    });
  }
  function drawGrid(dim) {
    for (let r = 0; r < 8; r++) for (let q = 0; q < D.cols; q++) { const mine = r >= 4; g.fillStyle = (q + r) % 2 ? (mine ? '#4a3a2c' : '#3a2a2a') : (mine ? '#3e3024' : '#322424'); if (!mine && dim) g.fillStyle = (q + r) % 2 ? '#201a18' : '#1c1614'; g.fillRect(BX + q * CELL, BY + r * CELL, CELL, CELL); }
    g.fillStyle = '#F5B700'; g.fillRect(BX, BY + 4 * CELL - 1, D.cols * CELL, 2);
  }
  function drawCombat(f, now) {
    const t = (now - combatAt) / 1000, ti = Math.min(f.frames.length - 1.001, t / D.frame), fa = Math.floor(ti), k = ti - fa, A = f.frames[fa], B = f.frames[fa + 1] || A, flip = f.b !== mySeat;
    const scr = (x, y) => flip && f.a === mySeat || flip ? [BX + (x / 10 + 0.5) * CELL, BY + (7 - y / 10 + 0.5) * CELL] : [BX + (6 - x / 10 + 0.5) * CELL, BY + (y / 10 + 0.5) * CELL];
    f.units.forEach((u, i) => {
      const o = i * 4, hp = A[o + 2]; if (!hp) return;
      const [x, y] = scr(A[o] + (B[o] - A[o]) * k, A[o + 1] + (B[o + 1] - A[o + 1]) * k);
      drawUnit(u[0], u[1], x, y, 40);
      g.fillStyle = '#000'; g.fillRect(x - 20, y - 26, 40, 8); g.fillStyle = u[2] === (f.b === mySeat ? 1 : 0) ? '#7FD48A' : '#ff5a5a'; g.fillRect(x - 19, y - 25, 38 * hp / 100, 4); g.fillStyle = '#5AA8FF'; g.fillRect(x - 19, y - 21, 38 * A[o + 3] / 100, 2);
    });
    const tick = t / D.tick;
    while (seenHit < f.hits.length && f.hits[seenHit][0] <= tick) {
      const [, a, b, dmg, kind] = f.hits[seenHit++], ob = b * 4, [x, y] = scr(A[ob] || 0, A[ob + 1] || 0), oa = a * 4, [ax, ay] = scr(A[oa] || 0, A[oa + 1] || 0);
      const col = kind === 5 ? '#7FD48A' : kind === 4 ? '#7fd4ff' : kind >= 2 ? '#ffb347' : kind === 1 ? '#ffd27a' : '#fff';
      if (dmg) floats.push({ x, y: y - 18, t: kind === 5 ? `+${dmg}` : `${dmg}`, c: col, at: now, big: kind >= 1 });
      sparks.push({ ax, ay, x, y, c: col, at: now, w: kind >= 2 ? 5 : 2 });
      if (kind >= 2) sfx(kind === 5 ? 880 : 220, 0.06, 'triangle', 0.02);
    }
    sparks = sparks.filter(s => now - s.at < 140); sparks.forEach(s => { g.strokeStyle = s.c; g.lineWidth = s.w; g.beginPath(); g.moveTo(s.ax, s.ay); g.lineTo(s.x, s.y); g.stroke(); });
    floats = floats.filter(p => now - p.at < 700); floats.forEach(p => { const a = (now - p.at) / 700; g.globalAlpha = 1 - a; g.font = `700 ${p.big ? 16 : 12}px Fredoka, sans-serif`; g.textAlign = 'center'; g.fillStyle = p.c; g.strokeStyle = '#000'; g.lineWidth = 3; g.strokeText(p.t, p.x, p.y - a * 22); g.fillText(p.t, p.x, p.y - a * 22); g.globalAlpha = 1; });
    if (t > f.dur + 0.2 && (f.a === mySeat || f.b === mySeat)) {
      const won = f.win === 2 ? null : (f.win === 0) === (f.a === mySeat);
      bigText(g, won === null ? 'ÉGALITÉ' : won ? 'VICTOIRE' : `DÉFAITE  -${f.dmg}`, BX + D.cols * CELL / 2, BY + 4 * CELL, 38, won === null ? '#fff' : won ? '#7FD48A' : '#ff5a5a');
    }
  }
  function button(b, label, sub, on, col) {
    rrect(g, ...b, 8); g.fillStyle = on ? col : '#26292d'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#000'; g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = on ? '#14110e' : '#777'; g.font = '700 14px Fredoka, sans-serif'; g.fillText(label, b[0] + b[2] / 2, b[1] + (sub ? 15 : b[3] / 2)); if (sub) { g.font = '600 11px Fredoka, sans-serif'; g.fillText(sub, b[0] + b[2] / 2, b[1] + 32); }
  }
  const stop = loop(() => {
    if (!cur) return;
    const now = performance.now(), p = me(), prep = cur.phase === 'prep', f = cur.phase === 'combat' ? myFight() : null;
    hover = null;
    g.fillStyle = '#14110e'; g.fillRect(0, 0, W, H);
    drawGrid(prep);
    drawTraits();
    drawPlayers();
    if (prep) {
      g.font = '600 13px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(255,255,255,.3)'; g.fillText('Le rang du haut est le plus proche de l’ennemi', BX + D.cols * CELL / 2, BY + 3.5 * CELL);
      p.board.forEach(b => { if (drag && drag.s[0] === 'b' && drag.s[1] === b[0] && drag.s[2] === b[1]) return; const [x, y] = spotPos(['b', b[0], b[1]]); drawUnit(b[2], b[3], x, y, 42); if (Math.hypot(mouse.x - x, mouse.y - y) < 22) hover = { u: b[2] }; });
    } else if (f) drawCombat(f, now);
    // banc
    for (let i = 0; i < D.bench; i++) { const x = SX + i * CELL; g.fillStyle = '#1f1a16'; g.fillRect(x + 1, SY + 1, CELL - 2, CELL - 2); const v = p.bench[i]; if (v && !(drag && drag.s[0] === 's' && drag.s[1] === i)) { drawUnit(v[0], v[1], x + CELL / 2, SY + CELL / 2, 42); if (inBox([x, SY, CELL, CELL], mouse.x, mouse.y)) hover = { u: v[0] }; } }
    // boutique
    for (let i = 0; i < 5; i++) {
      const b = shopBox(i), id = p.shop[i]; rrect(g, ...b, 8); g.fillStyle = id === null ? '#1a1612' : '#fbf3e0'; g.fill();
      if (id === null) continue;
      const u = U[id]; g.lineWidth = 3; g.strokeStyle = TIER[u.tier]; g.stroke(); g.drawImage(sprite(id), b[0] + 30, b[1] + 3, 56, 56);
      g.fillStyle = '#2a1c14'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '600 10.5px Fredoka, sans-serif'; g.fillText(u.n, b[0] + 58, b[1] + 67, 110); g.fillStyle = F[u.f].c === '#f2f4f7' || F[u.f].c === '#d8dde3' ? '#5c6067' : F[u.f].c; g.font = '600 9px Fredoka, sans-serif'; g.fillText(F[u.f].n, b[0] + 58, b[1] + 80, 110);
      g.fillStyle = '#2a1c14'; g.font = '700 11px Fredoka, sans-serif'; g.fillText(`${u.cost} or`, b[0] + 58, b[1] + 93);
      if (inBox(b, mouse.x, mouse.y)) hover = { u: id };
    }
    if (drag) { g.fillStyle = 'rgba(186,44,58,.14)'; g.fillRect(SX, SHY, 610, 102); drawUnit(drag.u[0], drag.u[1], mouse.x, mouse.y, 46, { a: 0.9 }); }
    // or, niveau, boutons
    g.textAlign = 'left'; g.textBaseline = 'middle'; g.font = '700 17px Fredoka, sans-serif'; g.fillStyle = '#F5B700'; g.fillText(`${p.gold} or`, 8, 392); g.fillStyle = '#fff'; g.font = '600 12px Fredoka, sans-serif'; g.fillText(`Niveau ${p.lv} · ${p.board.length}/${p.lv} unités`, 8, 412);
    if (p.lv < 9) { g.textAlign = 'right'; g.fillStyle = 'rgba(255,255,255,.6)'; g.fillText(`XP ${p.xp}/${D.xp[p.lv]}`, 160, 392); }
    button(BTN.roll, 'Actualiser', '2 or', prep && p.gold >= 2, '#ffb347');
    button(BTN.xp, 'Acheter de l’XP', '4 or', prep && p.gold >= 4 && p.lv < 9, '#7fd4ff');
    button(BTN.ready, prep ? (p.ready ? 'Prêt ✓' : 'Prêt au combat') : (p.ready ? 'Passé ✓' : 'Passer le combat'), '', p.hp > 0 || !prep, '#7FD48A');
    const left = Math.max(0, Math.ceil(cur.left - (now - recvAt) / 1000));
    g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = '700 15px Fredoka, sans-serif'; g.fillText(`Manche ${cur.round} · ${left} s`, 876, 306);
    g.font = '600 11px Fredoka, sans-serif'; g.fillStyle = 'rgba(255,255,255,.55)'; const odds = D.odds[p.lv]; g.fillText(odds.map((v, i) => `${v}%`).join('  '), 876, 324);
    // infobulle
    if (hover) {
      const lines = hover.u !== undefined ? (() => { const u = U[hover.u], fam = F[u.f]; return [u.n, `${D.rarity[u.tier]} · ${u.cost} or`, fam.n, `Sort : ${fam.spell}`, fam.sd]; })() : [hover.t, ...hover.l];
      const bx = 796, by = 336; rrect(g, bx, by, 160, 150, 8); g.fillStyle = '#fbf3e0'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#2a1c14'; g.stroke();
      g.fillStyle = '#2a1c14'; g.textAlign = 'left'; g.textBaseline = 'top'; let y = by + 8;
      lines.forEach((l, i) => { g.font = `${i ? 600 : 700} ${i ? 11 : 13}px Fredoka, sans-serif`; const ws = l.split(' '); let line = ''; ws.forEach(w => { if (g.measureText(line + w).width > 144) { g.fillText(line, bx + 8, y); y += 14; line = ''; } line += w + ' '; }); g.fillText(line, bx + 8, y); y += i ? 16 : 18; });
    }
    if (!p.hp) bigText(g, 'ATELIER FERMÉ', BX + D.cols * CELL / 2, BY + 2 * CELL, 32, '#ff5a5a');
  });
  return { push, stop() { stop(); } };
}
