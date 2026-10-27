/* Forgeopoly — plateau animé (règles complètes côté serveur : forgeopoly.py) */
'use strict';

const FG_TOKENS = {
  louche: '<svg viewBox="0 0 24 24"><path d="M4 3l9 9" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M10 12a6 5 0 0 0 12 0z" fill="currentColor"/></svg>',
  marteau: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="12" height="7" rx="1.5" fill="currentColor"/><path d="M11 11l8 10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  creuset: '<svg viewBox="0 0 24 24"><path d="M4 6h16l-3 14H7z" fill="currentColor"/><ellipse cx="12" cy="6" rx="8" ry="2.4" fill="#ffb347"/></svg>',
  enclume: '<svg viewBox="0 0 24 24"><path d="M2 7h15c3 0 5 1 5 3h-6l-2 3v3h3v3H7v-3h3v-3L7 11H2z" fill="currentColor"/></svg>',
};
const FG_PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
// rotation du cube pour montrer chaque face vers l'avant
const FG_FACE = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };

let fg = null;   // état d'affichage du plateau

function fgCellPos(i) {   // plateau 11 × 11, départ en bas à droite
  if (i <= 10) return [11, 11 - i];
  if (i <= 20) return [11 - (i - 10), 1];
  if (i <= 30) return [1, 1 + (i - 20)];
  return [1 + (i - 30), 11];
}
const fgMoney = n => `${n.toLocaleString('fr-FR')} ₤`;

function renderForgeo() {
  const v = view;
  if (v.finished) {
    if (fg && fg.queue.length) { fg.pendingEnd = true; return; }   // laisse finir les animations
    if (document.getElementById('rewardBox')) return;
    fg = null;
    resultScreen(v.finished.map((i, k) => {
      const p = v.players[i];
      return `<li><b>${k + 1}</b><i style="background:${p.color}"></i><span>${esc(p.name)}${i === mySeat ? ' (toi)' : ''}</span><em>${p.out ? 'faillite' : fgMoney(p.worth)}</em></li>`;
    }));
    return;
  }
  if (!fg || !fg.root.isConnected) fgBuild(v);
  // nouvelles animations à rejouer
  for (const a of v.anims) if (a.id > fg.seen) { fg.queue.push(a); fg.seen = a.id; }
  fg.view = v;
  fgPaint();
  fgPump();
}

function fgBuild(v) {
  stage.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'fgo';
  const cells = v.board.map((sq, i) => {
    const [r, c] = fgCellPos(i);
    const side = i < 10 ? 'b' : i < 20 ? 'l' : i < 30 ? 't' : 'r';
    const corner = i % 10 === 0;
    const icon = { go: '➜', jail: '🔧', free: '☕', gojail: '👮', chance: '?', cc: '🎁', tax: '💸', station: '🚌', utility: sq.name.includes('gaz') ? '🔥' : '⚡' }[sq.type] || '';
    return `<div class="fgo-cell side-${side} ${corner ? 'corner' : ''} type-${sq.type}" data-sq="${i}" style="grid-area:${r}/${c}">
      ${sq.color ? `<span class="fgo-band" style="background:${sq.color}"><span class="fgo-houses"></span></span>` : ''}
      <span class="fgo-name">${icon ? `<em>${icon}</em>` : ''}${esc(sq.name)}</span>
      ${sq.price ? `<span class="fgo-price">${sq.price}</span>` : ''}
      <span class="fgo-owner"></span>
    </div>`;
  }).join('');
  root.innerHTML = `
    <div class="fgo-board" id="fgoBoard">
      ${cells}
      <div class="fgo-center">
        <div class="fgo-title">FORGEOPOLY</div>
        <div class="fgo-decks"><div class="fgo-deck chance">COULÉE<br>SURPRISE<b>?</b></div><div class="fgo-deck cc">CAISSE DE<br>LA PROMO<b>🎁</b></div></div>
        <div class="fgo-dice"><div class="fgo-die" id="die0"></div><div class="fgo-die" id="die1"></div></div>
        <div class="fgo-actions" id="fgoActions"></div>
      </div>
      <div class="fgo-tokens" id="fgoTokens"></div>
      <div class="fgo-card" id="fgoCard" hidden><div class="fgo-card-inner"><div class="fgo-card-back"></div><div class="fgo-card-front"></div></div></div>
    </div>
    <aside class="fgo-side">
      <ul class="fgo-players" id="fgoPlayers"></ul>
      <div class="fgo-detail" id="fgoDetail"><p class="muted small">Clique sur une case pour voir ses loyers, construire ou hypothéquer.</p></div>
      <ol class="fgo-log" id="fgoLog"></ol>
    </aside>
    <div class="fgo-modal" id="fgoModal" hidden></div>`;
  stage.appendChild(root);
  // dés en 3D
  ['die0', 'die1'].forEach(id => {
    root.querySelector('#' + id).innerHTML = `<div class="fgo-cube">${[1, 2, 3, 4, 5, 6].map(n => `<div class="fgo-face f${n}">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => `<i class="${FG_PIPS[n].includes(k) ? 'on' : ''}"></i>`).join('')}</div>`).join('')}</div>`;
  });
  root.querySelectorAll('.fgo-cell').forEach(c => c.addEventListener('click', () => { fg.selected = +c.dataset.sq; fgPaint(); SFX.tick(); }));
  // pions
  root.querySelector('#fgoTokens').innerHTML = v.players.map((p, i) => `<div class="fgo-token" data-seat="${i}" style="--c:${p.color}">${FG_TOKENS[p.token] || ''}</div>`).join('');
  fg = { root, seen: Math.max(0, ...v.anims.map(a => a.id)), queue: [], playing: false, pos: v.players.map(p => p.pos), selected: null, view: v, pendingEnd: false };
  $('#hudInfo').textContent = '';
  const ro = new ResizeObserver(() => fgPlaceTokens(true));
  ro.observe(root.querySelector('#fgoBoard'));
  fg.ro = ro;
  fgSetDice(v.dice, false);
}

/* ---------- affichage ---------- */
function fgPaint() {
  const v = fg.view, root = fg.root;
  const me = mySeat, cur = v.players[v.turn], myTurn = v.turn === me;
  $('#hudInfo').textContent = `Tour ${v.round}/${v.maxRounds}`;
  // cases : propriétaire, maisons, hypothèques
  root.querySelectorAll('.fgo-cell').forEach(c => {
    const i = +c.dataset.sq, o = v.owner[i];
    c.style.setProperty('--own', o !== undefined ? v.players[o].color : 'transparent');
    c.classList.toggle('owned', o !== undefined);
    c.classList.toggle('mortgaged', !!v.mortgaged[i]);
    c.classList.toggle('sel', fg.selected === i);
    const h = v.houses[i], hs = c.querySelector('.fgo-houses');
    if (hs) {
      const html = h === 5 ? '<i class="hotel"></i>' : '<i class="house"></i>'.repeat(h);
      if (hs.dataset.n !== String(h)) { hs.innerHTML = html; hs.dataset.n = h; }
    }
  });
  // joueurs
  $('#fgoPlayers', root).innerHTML = v.players.map((p, i) => `<li class="${i === v.turn ? 'cur' : ''} ${p.out ? 'out' : ''}" data-seat="${i}">
      <span class="fgo-tok-mini" style="--c:${p.color}">${FG_TOKENS[p.token] || ''}</span>
      <span class="nm">${esc(p.name)}${i === me ? ' <em>(toi)</em>' : ''}${p.jail ? ' <em>🔧 en retouche</em>' : ''}${p.jailcards ? ` <em>🎫×${p.jailcards}</em>` : ''}</span>
      <b>${p.out ? 'faillite' : fgMoney(p.cash)}</b></li>`).join('');
  // journal
  $('#fgoLog', root).innerHTML = v.log.slice().reverse().map(l => `<li>${esc(l)}</li>`).join('');
  // actions
  const busy = fg.queue.length > 0 || fg.playing;
  const A = $('#fgoActions', root);
  let html = '';
  if (v.phase === 'auction' && v.auction) {
    const sq = v.board[v.auction.sq], by = v.auction.by !== null ? v.players[v.auction.by].name : 'personne';
    const can = !v.players[me]?.out;
    html = `<div class="fgo-auction"><b>🔨 Enchères : ${esc(sq.name)}</b><span>Mise : ${fgMoney(v.auction.bid)} (${esc(by)}) · ${Math.ceil(v.auction.left)} s</span>
      ${can ? `<div class="fgo-row">${[10, 50, 100].map(d => `<button class="btn btn-sm btn-hot" data-bid="${v.auction.bid + d}" ${v.auction.bid + d > (v.players[me]?.cash || 0) ? 'disabled' : ''}>+${d}</button>`).join('')}</div>` : ''}</div>`;
  } else if (v.phase === 'debt' && myTurn) {
    html = `<div class="fgo-debt"><b>Tu dois ${fgMoney(-cur.cash)}</b><span>Vends des maisons ou hypothèque des terrains (clique sur tes cases), sinon :</span><button class="btn btn-sm btn-ghost" data-a="bankrupt">Déclarer faillite</button></div>`;
  } else if (myTurn) {
    const sq = v.board[cur.pos];
    if (v.phase === 'roll') html = `<button class="btn btn-hot" data-a="roll" ${busy ? 'disabled' : ''}>🎲 Lancer les dés</button>`;
    else if (v.phase === 'jail') html = `<div class="fgo-row"><button class="btn btn-sm btn-hot" data-a="roll" ${busy ? 'disabled' : ''}>🎲 Tenter un double</button><button class="btn btn-sm btn-ghost" data-a="jail_pay" ${cur.cash < 50 ? 'disabled' : ''}>Payer 50</button>${cur.jailcards ? '<button class="btn btn-sm btn-ghost" data-a="jail_card">Utiliser ma carte</button>' : ''}</div>`;
    else if (v.phase === 'buy') html = busy ? '<p class="muted small">…</p>' : `<p class="fgo-q">Acheter <b>${esc(sq.name)}</b> pour ${fgMoney(sq.price)} ?</p><div class="fgo-row"><button class="btn btn-sm btn-hot" data-a="buy" ${cur.cash < sq.price ? 'disabled' : ''}>Acheter</button><button class="btn btn-sm btn-ghost" data-a="pass">Mettre aux enchères</button></div>`;
    else if (v.phase === 'end') html = `<button class="btn btn-hot" data-a="end" ${busy ? 'disabled' : ''}>Fin du tour ▶</button>`;
    if (['roll', 'end', 'jail'].includes(v.phase) && !v.offer) html += `<button class="btn btn-sm btn-ghost fgo-trade" data-trade="1">🤝 Proposer un échange</button>`;
    if (!busy && ['roll', 'end', 'buy', 'jail'].includes(v.phase)) html += `<span class="fgo-timer">${v.timeLeft} s</span>`;
  } else {
    html = `<p class="muted small">Au tour de <b style="color:${cur.color}">${esc(cur.name)}</b>…</p>`;
  }
  if (A.dataset.html !== html) {
    A.innerHTML = html; A.dataset.html = html;
    A.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => { send({ t: 'act', a: b.dataset.a }); b.disabled = true; SFX.tick(); }));
    A.querySelectorAll('[data-bid]').forEach(b => b.addEventListener('click', () => { send({ t: 'act', a: 'bid', v: +b.dataset.bid }); sfx(660, 0.08, 'triangle', 0.05); }));
    const tr = A.querySelector('[data-trade]'); if (tr) tr.addEventListener('click', fgTradeBuilder);
  }
  fgDetail();
  fgOfferModal();
  if (!fg.playing && !fg.queue.length) { fg.pos = v.players.map(p => p.pos); fgPlaceTokens(); }
}

function fgDetail() {
  const v = fg.view, i = fg.selected, box = $('#fgoDetail', fg.root);
  if (i === null || i === undefined) return;
  const sq = v.board[i], o = v.owner[i], mine = o === mySeat;
  const manage = mine && v.turn === mySeat && ['roll', 'end', 'jail', 'debt', 'buy'].includes(v.phase);
  let rows = '';
  if (sq.type === 'prop') rows = `<table class="fgo-rents"><tr><td>Terrain nu</td><td>${sq.rents[0]} <small>(×2 si groupe complet)</small></td></tr>${[1, 2, 3, 4].map(n => `<tr class="${v.houses[i] === n ? 'now' : ''}"><td>${n} maison${n > 1 ? 's' : ''}</td><td>${sq.rents[n]}</td></tr>`).join('')}<tr class="${v.houses[i] === 5 ? 'now' : ''}"><td>Hôtel</td><td>${sq.rents[5]}</td></tr></table><p class="small muted">Maison : ${sq.house} · hypothèque : ${sq.price / 2}</p>`;
  else if (sq.type === 'station') rows = '<p class="small">Loyer : 25 / 50 / 100 / 200 selon le nombre de navettes possédées.</p>';
  else if (sq.type === 'utility') rows = '<p class="small">Loyer : 4 × les dés (10 × avec les deux réseaux).</p>';
  else if (sq.type === 'tax') rows = `<p class="small">À payer : ${sq.amount}</p>`;
  const html = `<div class="fgo-deed" style="--g:${sq.color || '#3a3d42'}">
    <div class="fgo-deed-head">${esc(sq.name)}${sq.price ? `<small>${fgMoney(sq.price)}</small>` : ''}</div>
    ${rows}
    <p class="small">${o !== undefined ? `Propriétaire : <b style="color:${v.players[o].color}">${esc(v.players[o].name)}</b>${v.mortgaged[i] ? ' · <b>hypothéqué</b>' : ''}` : sq.price ? 'À vendre' : ''}</p>
    ${manage ? `<div class="fgo-row">
      ${sq.type === 'prop' ? `<button class="btn btn-sm btn-hot" data-m="build">🏠 Construire (${sq.house})</button><button class="btn btn-sm btn-ghost" data-m="sell">Vendre (+${sq.house / 2})</button>` : ''}
      ${v.mortgaged[i] ? `<button class="btn btn-sm btn-ghost" data-m="unmortgage">Lever l'hypothèque (${Math.floor(sq.price / 2 * 1.1)})</button>` : `<button class="btn btn-sm btn-ghost" data-m="mortgage">Hypothéquer (+${sq.price / 2})</button>`}
    </div>` : ''}
  </div>`;
  if (box.dataset.html !== html) {
    box.innerHTML = html; box.dataset.html = html;
    box.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => { send({ t: 'act', a: b.dataset.m, sq: i }); SFX.tick(); }));
  }
}

/* ---------- échanges ---------- */
function fgTradeBuilder() {
  const v = fg.view, me = mySeat;
  const others = v.players.map((p, i) => ({ p, i })).filter(x => x.i !== me && !x.p.out);
  if (!others.length) return;
  const M = $('#fgoModal', fg.root);
  let to = others[0].i;
  const ownedBy = s => Object.entries(v.owner).filter(([k, o]) => o === s).map(([k]) => +k)
    .filter(k => !(v.board[k].type === 'prop' && v.board.some((b, j) => b.group === v.board[k].group && v.houses[j] > 0)));
  const paint = () => {
    M.hidden = false;
    M.innerHTML = `<div class="fgo-modal-box"><h4>🤝 Proposer un échange</h4>
      <div class="fgo-row">${others.map(x => `<button class="btn btn-sm ${x.i === to ? 'btn-hot' : 'btn-ghost'}" data-to="${x.i}">${esc(x.p.name)}</button>`).join('')}</div>
      <div class="fgo-trade-cols">
        <div><b>Tu donnes</b>${ownedBy(me).map(k => `<label><input type="checkbox" data-give="${k}"> <i style="background:${v.board[k].color || '#666'}"></i>${esc(v.board[k].name)}</label>`).join('') || '<p class="muted small">Aucun terrain échangeable</p>'}</div>
        <div><b>Tu reçois</b>${ownedBy(to).map(k => `<label><input type="checkbox" data-take="${k}"> <i style="background:${v.board[k].color || '#666'}"></i>${esc(v.board[k].name)}</label>`).join('') || '<p class="muted small">Aucun terrain échangeable</p>'}</div>
      </div>
      <label class="fgo-cash">Lingots : <input type="number" id="fgoCash" value="0" step="10"> <small>(positif = tu paies, négatif = il te paie)</small></label>
      <div class="fgo-row"><button class="btn btn-hot" id="fgoSendOffer">Envoyer l'offre</button><button class="btn btn-ghost" id="fgoCloseModal">Annuler</button></div></div>`;
    M.querySelectorAll('[data-to]').forEach(b => b.addEventListener('click', () => { to = +b.dataset.to; paint(); }));
    $('#fgoCloseModal', M).addEventListener('click', () => { M.hidden = true; });
    $('#fgoSendOffer', M).addEventListener('click', () => {
      const give = [...M.querySelectorAll('[data-give]:checked')].map(x => +x.dataset.give);
      const take = [...M.querySelectorAll('[data-take]:checked')].map(x => +x.dataset.take);
      const cash = Math.round(+$('#fgoCash', M).value || 0);
      send({ t: 'act', a: 'offer', to, give, take, cash });
      M.hidden = true; toast('Offre envoyée.');
    });
  };
  paint();
}

function fgOfferModal() {
  const v = fg.view, o = v.offer, M = $('#fgoModal', fg.root);
  if (!o || o.to !== mySeat) { if (M.dataset.offer) { M.hidden = true; M.dataset.offer = ''; } return; }
  const key = JSON.stringify(o);
  if (M.dataset.offer === key) return;
  M.dataset.offer = key;
  const nm = l => l.map(k => `<li><i style="background:${v.board[k].color || '#666'}"></i>${esc(v.board[k].name)}</li>`).join('') || '<li class="muted">rien</li>';
  M.hidden = false;
  M.innerHTML = `<div class="fgo-modal-box"><h4>🤝 ${esc(v.players[o.from].name)} te propose un échange</h4>
    <div class="fgo-trade-cols"><div><b>Tu reçois</b><ul>${nm(o.give)}${o.cash > 0 ? `<li>+ ${fgMoney(o.cash)}</li>` : ''}</ul></div>
    <div><b>Tu donnes</b><ul>${nm(o.take)}${o.cash < 0 ? `<li>+ ${fgMoney(-o.cash)}</li>` : ''}</ul></div></div>
    <div class="fgo-row"><button class="btn btn-hot" data-ans="accept">Accepter</button><button class="btn btn-ghost" data-ans="refuse">Refuser</button></div></div>`;
  sfx(880, 0.15, 'triangle', 0.05);
  M.querySelectorAll('[data-ans]').forEach(b => b.addEventListener('click', () => { send({ t: 'act', a: b.dataset.ans }); M.hidden = true; }));
}

/* ---------- pions et animations ---------- */
function fgCellCenter(i, seat, n) {
  const board = $('#fgoBoard', fg.root), cell = board.querySelector(`[data-sq="${i}"]`);
  if (!cell) return [0, 0];
  const off = [[-0.18, -0.12], [0.18, -0.12], [-0.18, 0.18], [0.18, 0.18]][seat % 4];
  return [cell.offsetLeft + cell.offsetWidth * (0.5 + off[0]), cell.offsetTop + cell.offsetHeight * (0.55 + off[1])];
}
function fgPlaceTokens(instant) {
  if (!fg || !fg.root.isConnected) { if (fg && fg.ro) fg.ro.disconnect(); return; }
  fg.root.querySelectorAll('.fgo-token').forEach(t => {
    const s = +t.dataset.seat, p = fg.view.players[s];
    t.hidden = p.out;
    const [x, y] = fgCellCenter(fg.pos[s], s);
    if (instant) t.style.transition = 'none';
    t.style.transform = `translate(${x}px, ${y}px)`;
    t.classList.toggle('cur', s === fg.view.turn);
    if (instant) { void t.offsetWidth; t.style.transition = ''; }
  });
}
const fgSleep = ms => new Promise(r => setTimeout(r, ms));

function fgSetDice(d, animate) {
  [0, 1].forEach(k => {
    const cube = fg.root.querySelector(`#die${k} .fgo-cube`);
    const [rx, ry] = FG_FACE[d[k]];
    const spin = animate ? 720 + 360 * k : 0;
    cube.style.transition = animate ? 'transform .9s cubic-bezier(.2,.8,.3,1)' : 'none';
    cube.style.transform = `rotateX(${rx + spin}deg) rotateY(${ry + spin}deg)`;
    if (!animate) { void cube.offsetWidth; }
  });
}

async function fgPump() {
  if (!fg || fg.playing) return;
  fg.playing = true;
  try {
    while (fg && fg.queue.length && fg.root.isConnected) {
      const a = fg.queue.shift();
      await fgPlay(a);
    }
  } finally {
    if (fg) {
      fg.playing = false;
      if (fg.root.isConnected) { fg.pos = fg.view.players.map(p => p.pos); fgPlaceTokens(); fgPaint(); }
      if (fg.pendingEnd) { fg.pendingEnd = false; renderForgeo(); }
    }
  }
}

async function fgPlay(a) {
  const root = fg.root;
  if (a.k === 'dice') {
    const box = root.querySelector('.fgo-dice');
    box.classList.remove('rolling'); void box.offsetWidth; box.classList.add('rolling');
    for (let k = 0; k < 5; k++) setTimeout(() => sfx(300 + Math.random() * 400, 0.03, 'square', 0.03), k * 90);
    // rotation de départ aléatoire puis arrivée sur les bonnes faces
    [0, 1].forEach(k => { const c = root.querySelector(`#die${k} .fgo-cube`); c.style.transition = 'none'; c.style.transform = `rotateX(${Math.random() * 360}deg) rotateY(${Math.random() * 360}deg)`; void c.offsetWidth; });
    fgSetDice(a.d, true);
    await fgSleep(950);
    sfx(a.d[0] === a.d[1] ? 880 : 520, 0.12, 'triangle', 0.05);
  } else if (a.k === 'move') {
    const t = root.querySelector(`.fgo-token[data-seat="${a.seat}"]`);
    if (a.jump) {
      t.classList.add('jump');
      fg.pos[a.seat] = a.to; fgPlaceTokens();
      sfx(200, 0.5, 'sawtooth', 0.05, -120);
      await fgSleep(700);
      t.classList.remove('jump');
    } else {
      const dir = a.steps < 0 ? -1 : 1, n = Math.abs(a.steps) || ((a.to - a.frm + 40) % 40);
      for (let s = 0; s < n; s++) {
        fg.pos[a.seat] = (fg.pos[a.seat] + dir + 40) % 40;
        t.classList.remove('hop'); void t.offsetWidth; t.classList.add('hop');
        fgPlaceTokens();
        sfx(400 + (s % 4) * 60, 0.04, 'triangle', 0.035);
        if (fg.pos[a.seat] === 0 && dir > 0) fgFloat(-1, '+200 Départ !', '#7fd48a', 0);
        await fgSleep(165);
      }
      fg.pos[a.seat] = a.to; fgPlaceTokens();
    }
  } else if (a.k === 'card') {
    const C = root.querySelector('#fgoCard');
    C.querySelector('.fgo-card-back').textContent = a.deck === 'chance' ? '?' : '🎁';
    C.querySelector('.fgo-card-front').innerHTML = `<small>${a.deck === 'chance' ? 'COULÉE SURPRISE' : 'CAISSE DE LA PROMO'}</small><p>${esc(a.text)}</p>`;
    C.className = `fgo-card ${a.deck}`;
    C.hidden = false; void C.offsetWidth; C.classList.add('show');
    sfx(600, 0.2, 'triangle', 0.05, 300);
    await fgSleep(2200);
    C.classList.remove('show'); await fgSleep(300); C.hidden = true;
  } else if (a.k === 'money') {
    fgFloat(a.seat, `${a.amt > 0 ? '+' : ''}${a.amt.toLocaleString('fr-FR')}`, a.amt > 0 ? '#7fd48a' : '#ff7b7b');
    if (a.amt > 0) sfx(1200, 0.06, 'triangle', 0.03); else sfx(300, 0.06, 'square', 0.025);
  } else if (a.k === 'buy') {
    const c = root.querySelector(`.fgo-cell[data-sq="${a.sq}"]`);
    if (c) { c.style.setProperty('--own', fg.view.players[a.seat].color); c.classList.add('owned', 'stamp'); setTimeout(() => c.classList.remove('stamp'), 700); }
    sfx(700, 0.1, 'square', 0.04); await fgSleep(250);
  } else if (a.k === 'build') {
    const c = root.querySelector(`.fgo-cell[data-sq="${a.sq}"] .fgo-houses`);
    if (c) { c.innerHTML = a.n === 5 ? '<i class="hotel pop"></i>' : '<i class="house"></i>'.repeat(Math.max(0, a.n - 1)) + (a.n ? '<i class="house pop"></i>' : ''); c.dataset.n = a.n; }
    sfx(520, 0.08, 'square', 0.04); setTimeout(() => sfx(780, 0.1, 'square', 0.04), 90);
    await fgSleep(200);
  } else if (a.k === 'auction') {
    sfx(330, 0.25, 'triangle', 0.05);
  } else if (a.k === 'bankrupt') {
    const li = root.querySelector(`#fgoPlayers [data-seat="${a.seat}"]`);
    if (li) { li.classList.add('shake'); }
    sfx(80, 0.6, 'sawtooth', 0.07, -30); await fgSleep(600);
  } else if (a.k === 'offer') {
    if (a.to !== mySeat) toast(`${fg.view.players[a.frm].name} propose un échange à ${fg.view.players[a.to].name}`);
  }
}

/* montant qui s'envole au-dessus de la ligne du joueur (seat = -1 : au centre du plateau) */
function fgFloat(seat, txt, color) {
  const host = seat >= 0 ? fg.root.querySelector(`#fgoPlayers [data-seat="${seat}"]`) : fg.root.querySelector('.fgo-center');
  if (!host) return;
  // calque propre au plateau : la liste des joueurs est redessinée à chaque état sans effacer l'animation
  const r = host.getBoundingClientRect(), R = fg.root.getBoundingClientRect();
  const el = document.createElement('span');
  el.className = 'fgo-float'; el.textContent = txt; el.style.color = color;
  el.style.left = `${r.left - R.left + r.width * (seat >= 0 ? 0.62 : 0.5)}px`;
  el.style.top = `${r.top - R.top + (seat >= 0 ? 4 : r.height * 0.3)}px`;
  fg.root.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}
