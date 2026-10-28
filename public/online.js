/* Arcade 101 — jeux en ligne : salons, Forgeopoly, Grand Prix ; Forge Fighters et Escadrille dans leurs fichiers */
'use strict';

const ONLINE = [
  {
    id: 'fighter', title: 'Forge Fighters', tone: '#BA2C3A', label: 'Combat · 1 contre 1', tag: 'COMBAT 1V1',
    pitch: "Le tournoi de baston de la fonderie. Quatre fondeurs, des combos, des coups spéciaux à la louche et au marteau-pilon.",
    how: '<b>← →</b> bouger · <b>↑</b> sauter · <b>↓</b> s\'accroupir · <b>J</b> poing · <b>K</b> pied · <b>L</b> spécial. Reculer = garde.',
  },
  {
    id: 'planes', title: 'Escadrille 101', tone: '#5AA8FF', label: 'Avions · 4 à 8 pilotes', tag: 'AVIONS 4-8',
    pitch: "Combat aérien au-dessus des cheminées de l'usine. Chacun pour soi : abats le plus d'avions en 3 minutes.",
    how: '<b>← →</b> virer · <b>↑</b> accélérer · <b>↓</b> ralentir · <b>Espace</b> ou <b>J</b> tirer.',
  },
  {
    id: 'course', title: 'Grand Prix de la Coulée', tone: '#EC641E', label: 'Course · 2 à 6 pilotes', tag: 'COURSE 2-6',
    pitch: '3 tours de circuit autour du campus. Le premier sur la ligne rafle deux tickets.',
    how: '<b>↑</b> gaz · <b>↓</b> frein · <b>← →</b> tourner.',
  },
  {
    id: 'forgeopoly', title: 'Forgeopoly', tone: '#F5B700', label: 'Plateau · 2 à 4 joueurs', tag: 'PLATEAU 2-4',
    pitch: "Rachète les ateliers de l'école, encaisse les loyers et mets tes adversaires en faillite. 15 tours maximum.",
    how: 'Lance les dés, rachète les ateliers, évite la retouche.',
  },
];

let ws = null, wsReady = null;
let onlineKind = null, room = null, mySeat = -1, isHost = false, view = null, trackInfo = null;
let raceClient = null, lastReward = null, quickStart = false;
const HANDLERS = {
  forgeopoly: () => renderForgeo(),
  course: () => updateRace(),
  fighter: () => updateFighter(),
  planes: () => updatePlanes(),
};
function stopClients() {
  stopRace();
  if (typeof stopFighter === 'function') stopFighter();
  if (typeof stopPlanes === 'function') stopPlanes();
  if (typeof stopTekken === 'function') stopTekken();
  if (typeof stopRoyale === 'function') stopRoyale();
}

/* ---------------- Connexion ---------------- */
async function connect() {
  if (ws && ws.readyState <= 1) return wsReady;
  if (!save.player) await apiCall('/api/hello', {});
  wsReady = new Promise((resolve, reject) => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const sock = new WebSocket(`${proto}://${location.host}/ws?player=${encodeURIComponent(save.player)}`);
    ws = sock;
    sock.onopen = () => resolve();
    sock.onerror = () => reject(new Error('Connexion au serveur impossible.'));
    sock.onmessage = e => { try { onMessage(JSON.parse(e.data)); } catch (err) { console.error(err); } };
    sock.onclose = () => {
      if (ws === sock) ws = null;
      if (onlineKind && !(view && view.finished)) toast('Connexion perdue avec le salon.');
    };
  });
  return wsReady;
}
function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }

function onMessage(m) {
  if (!onlineKind && m.t !== 'reward') return;
  if (m.t === 'error') { toast(m.msg); return; }
  if (m.t === 'room') {
    room = m.room; mySeat = m.seat; isHost = m.isHost;
    if (!room.started && quickStart && isHost) { quickStart = false; send({ t: 'start' }); return; }
    if (!room.started) renderRoom();
  } else if (m.t === 'init') {
    trackInfo = m;
  } else if (m.t === 'state') {
    view = m.state;
    const h = HANDLERS[onlineKind];
    if (h) h();
  } else if (m.t === 'reward') {
    lastReward = m;
    applyStatus(m);
    toast(m.ticket ? '🎟️ ' + m.message : m.message);
    const box = document.getElementById('rewardBox');
    if (box) { box.textContent = (m.ticket ? '🎟️ ' : '') + m.message; box.classList.toggle('won', !!m.ticket); }
    if (m.ticket) SFX.win();
  }
}

/* ---------------- Ouverture / salon ---------------- */
function openOnline(kind, code = '') {
  const o = ONLINE.find(x => x.id === kind);
  openShell(o.title, o.label, false);
  onlineKind = kind; room = null; view = null; trackInfo = null; lastReward = null;
  cleanup = () => {
    send({ t: 'leave' });
    stopClients();
    onlineKind = null; room = null; view = null; quickStart = false;
  };
  renderLobbyForm(o, code);
}

function renderLobbyForm(o, code = '') {
  stopClients();
  room = null; view = null; lastReward = null; quickStart = false;
  $('#hudInfo').textContent = '';
  const fighterPick = (o.id === 'fighter' || o.id === 'tekken') ? `<label>Choisis ton combattant</label><div class="char-pick" id="charPick"></div><p class="char-desc" id="charDesc"></p>`
    : o.id === 'royale' ? `<label>Choisis ton métier</label><div class="ry-picks" id="charPick"></div><p class="char-desc" id="charDesc"></p>` : '';
  stage.innerHTML = `<div class="screen">
    <h4>${o.title}</h4>
    <div class="how">${o.how}</div>
    ${fighterPick}
    <label for="onName">Ton nom de fondeur</label>
    <input id="onName" maxlength="16" placeholder="Fondeur" value="${esc(save.onlineName || (server && server.name) || save.pseudo || '')}">
    <div class="end-actions">
      <button class="btn btn-hot" id="quickBtn">Jouer contre l'ordi</button>
      <button class="btn btn-ghost" id="createBtn">Créer un salon</button>
    </div>
    <div class="or"><span>ou rejoins tes potes</span></div>
    <div class="join-row"><input id="onCode" maxlength="4" placeholder="CODE" value="${esc(code)}"><button class="btn btn-ghost" id="joinBtn">Rejoindre</button></div>
    <div class="ticket-box">🎟️ Finir une partie = 1 ticket, la gagner = 2 (2 tickets max par jour sur ce jeu).</div>
  </div>`;
  if (o.id === 'fighter') renderCharPick($('#charPick'), $('#charDesc'));
  if (o.id === 'tekken') renderCharPick($('#charPick'), $('#charDesc'), TK_ROSTER, 'char3d');
  if (o.id === 'royale') renderMetierPick($('#charPick'), $('#charDesc'));
  const name = () => { const n = $('#onName').value.trim().slice(0, 16) || 'Fondeur'; save.onlineName = n; persist(); return n; };
  const opt = () => (o.id === 'fighter' ? { char: save.char || 'fondeur' } : o.id === 'tekken' ? { char: save.char3d || 'fondeur' }
    : o.id === 'royale' ? { char: save.metier || 'fondeur' } : {});
  const go = async msg => {
    try { await connect(); send({ ...msg, name: name(), opt: opt() }); } catch (e) { toast(e.message); }
  };
  $('#quickBtn').addEventListener('click', () => { quickStart = true; go({ t: 'create', kind: o.id }); });
  $('#createBtn').addEventListener('click', () => go({ t: 'create', kind: o.id }));
  $('#joinBtn').addEventListener('click', () => {
    const c = $('#onCode').value.trim().toUpperCase();
    if (c.length !== 4) { toast('Le code du salon fait 4 lettres.'); return; }
    go({ t: 'join', code: c });
  });
  $('#onCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('#joinBtn').click(); });
}

function renderRoom() {
  const link = `${location.origin}${location.pathname}?salon=${room.code}&jeu=${room.kind}`;
  const colors = ['#EC641E', '#BA2C3A', '#8A8D91', '#F2F4F7', '#F5B700', '#5AA8FF', '#7FD48A', '#C77DFF'];
  const roster = room.kind === 'tekken' ? TK_ROSTER : FIGHTERS;
  const charOf = s => ((room.kind === 'fighter' || room.kind === 'tekken') && s.opt && s.opt.char && roster[s.opt.char]) ? ` · ${roster[s.opt.char].name}` : '';
  $('#hudInfo').textContent = `${room.seats.length}/${room.max} joueurs`;
  stage.innerHTML = `<div class="screen room">
    <span class="kicker" style="margin:0">Code du salon</span>
    <div class="room-code">${room.code}</div>
    <button class="btn btn-sm btn-ghost" id="copyLink">Copier le lien d'invitation</button>
    <ul class="seats">${room.seats.map((s, i) => `<li>
      <i style="background:${colors[i % colors.length]}"></i>
      <span>${esc(s.name)}<em>${esc(charOf(s))}</em>${i === mySeat ? ' <em>(toi)</em>' : ''}${s.bot ? ' <em>· robot</em>' : ''}${!s.online ? ' <em>· déconnecté</em>' : ''}</span>
      ${isHost && s.bot ? `<button class="icon-btn small" data-kick="${i}" aria-label="Retirer ${esc(s.name)}">✕</button>` : ''}
    </li>`).join('')}</ul>
    ${isHost ? `<div class="end-actions">
        ${room.seats.length < room.max ? '<button class="btn btn-ghost" id="botBtn">+ Ajouter un robot</button>' : ''}
        <button class="btn btn-hot" id="startBtn">Lancer la partie</button>
      </div>
      <p class="muted small">Il manque du monde ? Des robots complètent automatiquement.</p>`
      : '<p class="muted">En attente du lancement par l\'hôte…</p>'}
  </div>`;
  $('#copyLink').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(link); toast('Lien copié, envoie-le à ta promo !'); } catch (e) { toast(link); }
  });
  stage.querySelectorAll('[data-kick]').forEach(b => b.addEventListener('click', () => send({ t: 'kick', seat: +b.dataset.kick })));
  const bot = $('#botBtn'); if (bot) bot.addEventListener('click', () => send({ t: 'bot' }));
  const st = $('#startBtn'); if (st) st.addEventListener('click', () => send({ t: 'start' }));
}

function resultScreen(rows) {
  const o = ONLINE.find(x => x.id === onlineKind);
  stage.innerHTML = `<div class="screen">
    <span class="kicker" style="margin:0">Classement</span>
    <ol class="podium">${rows.join('')}</ol>
    <div class="ticket-box ${lastReward && lastReward.ticket ? 'won' : ''}" id="rewardBox">${lastReward ? (lastReward.ticket ? '🎟️ ' : '') + esc(lastReward.message) : 'Calcul des tickets…'}</div>
    <div class="end-actions">
      <button class="btn btn-hot" id="scratchGo">Gratter mes tickets</button>
      <button class="btn btn-ghost" id="againOnline">Rejouer</button>
      <button class="btn btn-ghost" id="menuOnline">Menu</button>
    </div>
  </div>`;
  $('#scratchGo').addEventListener('click', () => { closeGame(); openPanel('tickets'); });
  $('#menuOnline').addEventListener('click', closeGame);
  $('#againOnline').addEventListener('click', () => { send({ t: 'leave' }); renderLobbyForm(o); });
}

/* ================= Grand Prix de la Coulée ================= */
function stopRace() {
  if (raceClient) { raceClient.stop(); raceClient = null; }
}

function updateRace() {
  if (!trackInfo) return;
  if (view.phase === 'over' && view.finished) {
    if (document.getElementById('rewardBox')) return;
    stopRace();
    resultScreen(view.finished.map((i, k) => {
      const c = view.cars[i];
      return `<li><b>${k + 1}</b><i style="background:${c.color}"></i><span>${esc(c.name)}${i === mySeat ? ' (toi)' : ''}</span><em>${c.fin !== null ? c.fin.toFixed(2) + ' s' : 'abandon'}</em></li>`;
    }));
    return;
  }
  if (!raceClient) raceClient = startRaceClient();
  raceClient.sync(view);
}

function startRaceClient() {
  const W = 800, H = 500, ZOOM = 0.8;
  const path = trackInfo.path, N = path.length, HALF = trackInfo.width / 2, LAPS = trackInfo.laps, MAXV = trackInfo.maxSpeed;
  $('#hudInfo').textContent = `${view.cars.length} pilotes · ${LAPS} tours`;
  stage.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'play-wrap';
  stage.appendChild(wrap);
  const pad = document.createElement('div');
  pad.className = 'touch-pad';
  pad.innerHTML = '<div class="grp"><button data-k="left" aria-label="Gauche">◀</button><button data-k="right" aria-label="Droite">▶</button></div><div class="grp"><button data-k="down" aria-label="Frein">FREIN</button><button data-k="up" class="hot" aria-label="Accélérer">GAZ</button></div>';
  const { c, g } = makeCanvas(wrap, W, H);
  wrap.appendChild(pad);
  const hint = document.createElement('p');
  hint.className = 'keys-hint';
  hint.textContent = '↑ GAZ · ↓ FREIN · ← → TOURNER';
  wrap.appendChild(hint);

  const mine = view.cars[mySeat];
  const car = { x: mine.x, y: mine.y, a: mine.a, v: 0 };
  let idx = nearest(car.x, car.y, 0, N), armed = false, lap = 0, finished = false, sendT = 0, off = false;
  const keys = { up: false, down: false, left: false, right: false };
  const shown = {}; // positions lissées des autres voitures

  // pré-calculs du circuit
  const track = new Path2D();
  path.forEach((p, i) => i ? track.lineTo(p[0], p[1]) : track.moveTo(p[0], p[1]));
  track.closePath();
  const xs = path.map(p => p[0]), ys = path.map(p => p[1]);
  const minX = Math.min(...xs) - 120, maxX = Math.max(...xs) + 120, minY = Math.min(...ys) - 120, maxY = Math.max(...ys) + 120;
  const startAng = Math.atan2(path[1][1] - path[0][1], path[1][0] - path[0][0]);

  function nearest(x, y, from, span) {
    let best = from, bd = Infinity;
    for (let k = 0; k < span; k++) {
      const j = ((from + k) % N + N) % N;
      const d = (path[j][0] - x) ** 2 + (path[j][1] - y) ** 2;
      if (d < bd) { bd = d; best = j; }
    }
    return best;
  }
  const distTo = (x, y, j) => Math.hypot(path[j][0] - x, path[j][1] - y);

  const map = { ArrowUp: 'up', KeyW: 'up', KeyZ: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', KeyQ: 'left', ArrowRight: 'right', KeyD: 'right' };
  const kd = e => { const k = map[e.code]; if (k) { keys[k] = true; e.preventDefault(); } };
  const ku = e => { const k = map[e.code]; if (k) keys[k] = false; };
  window.addEventListener('keydown', kd);
  window.addEventListener('keyup', ku);
  pad.querySelectorAll('[data-k]').forEach(b => {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', e => { e.preventDefault(); keys[k] = true; b.classList.add('on'); });
    const up = () => { keys[k] = false; b.classList.remove('on'); };
    b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
  });

  function drawCar(x, y, a, color, label, me) {
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-17, -8, 38, 20);
    g.fillStyle = color; g.strokeStyle = me ? '#fff' : 'rgba(0,0,0,.5)'; g.lineWidth = me ? 2.5 : 1.5;
    g.beginPath(); g.roundRect(-19, -10, 38, 20, 5); g.fill(); g.stroke();
    g.fillStyle = 'rgba(20,24,30,.85)'; g.fillRect(2, -7, 9, 14);
    g.fillStyle = '#111'; [[-13, -12], [7, -12], [-13, 9], [7, 9]].forEach(([wx, wy]) => g.fillRect(wx, wy, 8, 3));
    g.restore();
    g.save(); g.font = `800 14px ${DISPLAY}`; g.textAlign = 'center'; g.fillStyle = me ? '#F5B700' : '#fff';
    g.shadowColor = '#000'; g.shadowBlur = 4; g.fillText(label, x, y - 22); g.restore();
  }

  const stop = loop((dt, t) => {
    const racing = view.phase === 'race';
    // ---- physique de ma voiture ----
    if (racing && !finished) {
      const cap = off ? 150 : MAXV;
      // l'accélérateur ne pousse jamais au-delà du plafond ; au-dessus, on ralentit vers lui
      if (keys.up) car.v = Math.min(car.v + 330 * dt, Math.max(cap, car.v));
      else if (keys.down) car.v -= 520 * dt;
      else car.v *= 1 - 0.9 * dt;
      car.v = Math.max(-120, car.v);
      if (car.v > cap) car.v += (cap - car.v) * Math.min(1, dt * 3);
      const steer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      car.a += steer * 2.7 * dt * clamp(car.v / 140, -1, 1);
      car.x = clamp(car.x + Math.cos(car.a) * car.v * dt, minX, maxX);
      car.y = clamp(car.y + Math.sin(car.a) * car.v * dt, minY, maxY);
      const ni = nearest(car.x, car.y, idx - 12, 36);
      off = distTo(car.x, car.y, ni) > HALF + 4;
      if (ni > N * 0.4 && ni < N * 0.6) armed = true;
      if (armed && idx > N * 0.75 && ni < N * 0.25) {
        lap++; armed = false;
        if (lap >= LAPS) { finished = true; SFX.win(); } else SFX.good();
      }
      idx = ni;
      sendT -= dt;
      if (sendT <= 0) {
        sendT = 1 / 15;
        const prog = (armed || idx < N * 0.5) ? idx / N : 0;
        send({ t: 'act', a: 'pos', x: +car.x.toFixed(1), y: +car.y.toFixed(1), ang: +car.a.toFixed(3), lap, prog: +prog.toFixed(4) });
      }
    } else if (finished) {
      car.v *= 1 - 2 * dt;
      car.x += Math.cos(car.a) * car.v * dt; car.y += Math.sin(car.a) * car.v * dt;
    }

    // ---- rendu ----
    g.fillStyle = '#1d2a1f'; g.fillRect(0, 0, W, H);
    g.save();
    g.translate(W / 2 - Math.cos(car.a) * 120, H / 2 - Math.sin(car.a) * 90); g.scale(ZOOM, ZOOM); g.translate(-car.x, -car.y);
    // herbe texturée
    g.fillStyle = '#22331f';
    for (let gx = Math.floor((car.x - 760) / 80) * 80; gx < car.x + 760; gx += 80)
      for (let gy = Math.floor((car.y - 560) / 80) * 80; gy < car.y + 560; gy += 80)
        if (((gx + gy) / 80) % 2 === 0) g.fillRect(gx, gy, 80, 80);
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.strokeStyle = '#f2f4f7'; g.lineWidth = HALF * 2 + 16; g.stroke(track);
    g.setLineDash([24, 24]); g.strokeStyle = '#BA2C3A'; g.stroke(track); g.setLineDash([]);
    g.strokeStyle = '#3a3d42'; g.lineWidth = HALF * 2; g.stroke(track);
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 3; g.setLineDash([30, 40]); g.stroke(track); g.setLineDash([]);
    // ligne de départ en damier
    g.save(); g.translate(path[0][0], path[0][1]); g.rotate(startAng);
    for (let k = -HALF; k < HALF; k += 12) for (let m = 0; m < 2; m++) {
      g.fillStyle = ((k / 12 + m) & 1) ? '#fff' : '#111'; g.fillRect(m * 12 - 12, k, 12, 12);
    }
    g.restore();
    // autres voitures
    view.cars.forEach((o, i) => {
      if (i === mySeat) return;
      const s = shown[i] || (shown[i] = { x: o.x, y: o.y, a: o.a });
      const k = Math.min(1, dt * 10);
      s.x += (o.x - s.x) * k; s.y += (o.y - s.y) * k;
      let da = o.a - s.a; da = Math.atan2(Math.sin(da), Math.cos(da)); s.a += da * k;
      drawCar(s.x, s.y, s.a, o.color, o.name, false);
    });
    drawCar(car.x, car.y, car.a, mine.color, 'TOI', true);
    g.restore();

    // ---- HUD ----
    const order = view.cars.map((o, i) => {
      const l = i === mySeat ? lap : o.lap, p = i === mySeat ? ((armed || idx < N * 0.5) ? idx / N : 0) : o.prog;
      const f = i === mySeat && finished ? (o.fin ?? 1e9) : o.fin;
      return { i, score: f !== null && f !== undefined ? 1000 - f / 1000 : l + p };
    }).sort((a, b) => b.score - a.score);
    const place = order.findIndex(o => o.i === mySeat) + 1;
    g.fillStyle = 'rgba(18,20,23,.75)'; g.fillRect(10, 10, 170, 64);
    bigText(g, `TOUR ${Math.min(lap + 1, LAPS)}/${LAPS}`, 95, 30, 24);
    g.font = `600 14px Archivo, sans-serif`; g.fillStyle = '#c6cad0'; g.textAlign = 'center';
    g.fillText(`${place}e / ${view.cars.length} · ${view.elapsed.toFixed(1)} s`, 95, 58);
    // mini-carte
    const mw = 120, mh = 90, mx = W - mw - 10, my = 10;
    g.fillStyle = 'rgba(18,20,23,.75)'; g.fillRect(mx, my, mw, mh);
    const sc = Math.min((mw - 12) / (maxX - minX), (mh - 12) / (maxY - minY));
    g.save(); g.translate(mx + 6 - minX * sc, my + 6 - minY * sc); g.scale(sc, sc);
    g.strokeStyle = '#6a6f77'; g.lineWidth = 40; g.stroke(track);
    view.cars.forEach((o, i) => { g.fillStyle = o.color; const p = i === mySeat ? car : o; g.beginPath(); g.arc(p.x, p.y, i === mySeat ? 50 : 36, 0, Math.PI * 2); g.fill(); });
    g.restore();
    if (off && racing && !finished) bigText(g, 'HORS PISTE', W / 2, 110, 26, '#ff8a8a');
    if (view.phase === 'count') {
      const n = Math.ceil(view.countdown);
      bigText(g, n > 3 ? 'PRÊTS ?' : n > 0 ? String(n) : 'GO !', W / 2, H / 2 - 60, 90, n > 0 ? '#fff' : '#F5B700');
    } else if (racing && view.elapsed < 1) bigText(g, 'GO !', W / 2, H / 2 - 60, 90, '#F5B700');
    if (finished) {
      bigText(g, 'ARRIVÉE !', W / 2, H / 2 - 80, 60, '#F5B700');
      bigText(g, 'En attente des autres pilotes…', W / 2, H / 2 - 30, 20, '#fff');
    }
  });

  let lastCount = null;
  return {
    sync(v) {
      const n = Math.ceil(v.countdown);
      if (v.phase === 'count' && n !== lastCount && n <= 3 && n > 0) { lastCount = n; sfx(440, 0.15, 'square', 0.05); }
      if (v.phase === 'race' && lastCount !== 0) { lastCount = 0; sfx(880, 0.3, 'square', 0.06); }
    },
    stop() {
      stop();
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    },
  };
}

/* ---------------- Démarrage ---------------- */
(function autoJoin() {
  const q = new URLSearchParams(location.search);
  const code = (q.get('salon') || '').toUpperCase(), kind = q.get('jeu');
  if (code && ONLINE.some(o => o.id === kind)) {
    history.replaceState(null, '', location.pathname + '#en-ligne');
    openOnline(kind, code);
  }
})();
