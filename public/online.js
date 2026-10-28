/* Arcade 101 — jeux en ligne : salons et résultats ; chaque jeu (Forgeopoly, Grand Prix, combats, avions…) a son fichier */
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
    id: 'course', title: 'Grand Prix de la Coulée', tone: '#EC641E', label: 'Kart · 2 à 8 pilotes', tag: 'KART 2-8',
    pitch: 'Course de karts déjantée avec les persos de la métallurgie : 3 tours, des caisses à outils pleines d’objets de fonderie (lingots, boulets de fonte, poches guidées, huile de trempe…), dérapages et mini-turbos. Vue 1re ou 3e personne.',
    how: '<b>↑ / Z / W</b> accélérer · <b>↓ / S</b> freiner, reculer · <b>← → / Q D / A D</b> tourner · <b>Maj</b> ou <b>Espace</b> déraper (relâche pour le mini-turbo) · <b>E</b> ou <b>clic</b> utiliser l’objet · <b>V</b> 1re / 3e personne · <b>C</b> regarder derrière.',
  },
  {
    id: 'forgeopoly', title: 'Forgeopoly', tone: '#F5B700', label: 'Plateau · 2 à 4 joueurs', tag: 'PLATEAU 2-4',
    pitch: "Rachète les ateliers de l'école, encaisse les loyers et mets tes adversaires en faillite. 15 tours maximum.",
    how: 'Lance les dés, rachète les ateliers, évite la retouche.',
  },
];

let ws = null, wsReady = null;
let onlineKind = null, room = null, mySeat = -1, isHost = false, view = null, trackInfo = null;
let lastReward = null, quickStart = false;
const HANDLERS = {
  forgeopoly: () => renderForgeo(),
  fighter: () => updateFighter(),
  planes: () => updatePlanes(),
};
function stopClients() {
  if (typeof stopKart === 'function') stopKart();
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
  const fighterPick = o.id === 'course' ? `<label>Choisis ton pilote</label><div class="char-pick" id="charPick"></div><p class="char-desc" id="charDesc"></p><label>Circuit</label><div class="ry-maps" id="mapPick"></div>`
    : (o.id === 'fighter' || o.id === 'tekken') ? `<label>Choisis ton combattant</label><div class="char-pick" id="charPick"></div><p class="char-desc" id="charDesc"></p>`
    : o.id === 'royale' ? `<label>Choisis ton métier</label><div class="ry-picks" id="charPick"></div><p class="char-desc" id="charDesc"></p><label>Carte</label><div class="ry-maps" id="mapPick"></div>` : '';
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
  if (o.id === 'course') { renderCharPick($('#charPick'), $('#charDesc'), TK_ROSTER, 'charKart'); renderTrackPick($('#mapPick')); }
  if (o.id === 'royale') { renderMetierPick($('#charPick'), $('#charDesc')); renderMapPick($('#mapPick')); }
  if (o.id === 'fighter' || o.id === 'tekken') { const b = document.createElement('button'); b.className = 'btn btn-sm btn-ghost combo-btn'; b.type = 'button'; b.textContent = '📖 Guide des combos'; b.addEventListener('click', () => openComboGuide(o.id)); $('#charDesc').after(b); }
  const name = () => { const n = $('#onName').value.trim().slice(0, 16) || 'Fondeur'; save.onlineName = n; persist(); return n; };
  const opt = () => (o.id === 'fighter' ? { char: save.char || 'fondeur' } : o.id === 'tekken' ? { char: save.char3d || 'fondeur' }
    : o.id === 'royale' ? { char: save.metier || 'fondeur', map: save.ryMap || 'random' }
    : o.id === 'course' ? { char: save.charKart || 'fondeur', map: save.kartMap || 'random' } : {});
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
    ${room.kind === 'fighter' || room.kind === 'tekken' ? '<button class="btn btn-sm btn-ghost combo-btn" id="roomCombos">📖 Guide des combos</button>' : ''}
    ${isHost ? `<div class="end-actions">
        ${room.seats.length < room.max ? '<button class="btn btn-ghost" id="botBtn">+ Ajouter un robot</button>' : ''}
        <button class="btn btn-hot" id="startBtn">Lancer la partie</button>
      </div>
      <p class="muted small">Il manque du monde ? Des robots complètent automatiquement.</p>`
      : '<p class="muted">En attente du lancement par l\'hôte…</p>'}
  </div>`;
  const rc = $('#roomCombos'); if (rc) rc.addEventListener('click', () => openComboGuide(room.kind));
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

/* ---------------- Démarrage ---------------- */
(function autoJoin() {
  const q = new URLSearchParams(location.search);
  const code = (q.get('salon') || '').toUpperCase(), kind = q.get('jeu');
  if (code && ONLINE.some(o => o.id === kind)) {
    history.replaceState(null, '', location.pathname + '#en-ligne');
    openOnline(kind, code);
  }
})();
