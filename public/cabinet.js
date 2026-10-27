/* Arcade 101 — la borne : menu de sélection, pupitre, pseudo, classement, tickets */
'use strict';

const SOLO_ORDER = ['galaxie', 'usine', 'quiz', 'coulee', 'enclume', 'teintes', 'poche'];
const SOLO_TAGS = { galaxie: 'SHOOTER', usine: 'GESTION', quiz: 'QUIZ' };
const toneOf = gm => (gm.teinte === 'acier' ? '#9aa0a6' : TONES[gm.teinte].hex);
const MENU = [
  { sep: 'EN LIGNE' },
  ...ONLINE.map(o => ({ id: o.id, kind: 'online', title: o.title, tone: o.tone, tag: o.tag, pitch: o.pitch })),
  { sep: 'SOLO' },
  ...[...GAMES].sort((a, b) => SOLO_ORDER.indexOf(a.id) - SOLO_ORDER.indexOf(b.id))
    .map(gm => ({ id: gm.id, kind: 'solo', title: gm.title, tone: toneOf(gm), tag: SOLO_TAGS[gm.id] || `TEINTE ${TONES[gm.teinte].name.toUpperCase()}`, pitch: gm.pitch })),
  { sep: 'BORNE' },
  { id: 'tickets', kind: 'panel', title: 'Mes tickets', tone: '#F5B700', tag: '-10 %', pitch: 'Gratte le sable du moule : 1 ticket sur 5 cache un code de -10 % pour la boutique de la promo.' },
  { id: 'scores', kind: 'panel', title: 'Classement', tone: '#7fd4ff', tag: 'HI-SCORES', pitch: 'Les meilleurs fondeurs de la promo, jeu par jeu. Ton pseudo y apparaît dès ta première partie.' },
];
const ITEMS = MENU.filter(m => !m.sep);
let sel = 0;
let previewStop = null;
const menuEl = $('#menu'), panelEl = $('#panel'), ticketsPanel = $('#ticketsPanel');

/* ---------------- Menu ---------------- */
function renderMenu() {
  let n = -1;
  $('#gameList').innerHTML = MENU.map(m => {
    if (m.sep) return `<li class="sep">${m.sep}</li>`;
    n++;
    return `<li><button role="option" data-i="${n}" class="${n === sel ? 'on' : ''}" aria-selected="${n === sel}" style="--tone:${m.tone}">
      <i></i>${esc(m.title)}${m.kind === 'online' ? '<em>EN LIGNE</em>' : ''}</button></li>`;
  }).join('');
  $('#gameList').querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => {
    const i = +b.dataset.i;
    if (i === sel) launch(ITEMS[i]); else select(i);
  }));
  $('#p1Name').textContent = (server && server.name) ? server.name.toUpperCase() : '???';
  renderPreview();
}
// appelé par les jeux quand un record ou les tickets changent
function renderGames() { if (!menuEl.hidden) renderMenu(); }

function select(i, scroll = true) {
  sel = (i + ITEMS.length) % ITEMS.length;
  $('#gameList').querySelectorAll('[data-i]').forEach(b => { const on = +b.dataset.i === sel; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  if (scroll) { const b = $(`#gameList [data-i="${sel}"]`); if (b) b.scrollIntoView({ block: 'nearest' }); }
  renderPreview();
  SFX.tick();
}

function ruleFor(it) {
  if (!server) return '<span class="rule">Serveur requis pour les tickets</span>';
  if (it.kind === 'panel') return it.id === 'tickets' ? `<span class="rule">${server.tickets} ticket(s) à gratter</span>` : '';
  const left = server.left[it.id];
  if (left === 0) return '<span class="rule done">✔ Tickets du jour gagnés</span>';
  if (it.kind === 'online') return '<span class="rule">🎟️ Finir = 1 · Gagner = 2</span>';
  if (it.id === 'quiz') return `<span class="rule">🎟️ ${server.quizPass}/10 bonnes réponses</span>`;
  if (it.id === 'usine') return '<span class="rule">🎟️ Tenir 5 ans sans faillite</span>';
  return `<span class="rule">🎟️ Dès ${server.thresholds[it.id]} pts</span>`;
}

function renderPreview() {
  if (previewStop) { previewStop(); previewStop = null; }
  const it = ITEMS[sel];
  const pv = $('#preview');
  pv.style.setProperty('--tone', it.tone);
  const best = save.best[it.id];
  pv.innerHTML = `
    <span class="pv-tag ${it.kind === 'online' ? 'online' : ''}">${it.kind === 'online' ? 'EN LIGNE · ' : ''}${esc(it.tag)}</span>
    <div class="pv-art" id="pvArt"></div>
    <div class="pv-body">
      <h3>${esc(it.title)}</h3>
      <p>${esc(it.pitch)}</p>
      <div class="pv-meta">${ruleFor(it)}${best ? `<span class="rec">Record : ${best}${it.id === 'quiz' ? '/10' : it.id === 'usine' ? ' k€ créés' : ''}</span>` : ''}</div>
      <div class="pv-go"><button class="btn btn-hot" id="pvGo">${it.kind === 'panel' ? 'Ouvrir' : 'Jouer'} ▶</button>
      ${it.kind !== 'panel' ? '<button class="btn btn-ghost" id="pvScores">Classement</button>' : ''}</div>
    </div>`;
  $('#pvGo').addEventListener('click', () => launch(it));
  const sc = $('#pvScores'); if (sc) sc.addEventListener('click', () => openPanel('scores', it.id));
  previewStop = paintArt($('#pvArt'), it);
}

/* Illustrations animées du menu (mode « attract ») */
function paintArt(box, it) {
  if (it.id === 'fighter') {
    const cv = document.createElement('canvas'); cv.width = 640; cv.height = 300; box.appendChild(cv);
    const g = cv.getContext('2d');
    const seq = ['jab', 'kick', 'upper', 'low', 'coulee', 'masse', 'sable', 'meuleuse'];
    const chars = Object.keys(FIGHTERS);
    return loop((dt, t) => {
      const s = t / 1000;
      g.clearRect(0, 0, 640, 300);
      const glow = g.createRadialGradient(320, 300, 10, 320, 300, 300); glow.addColorStop(0, 'rgba(236,100,30,.45)'); glow.addColorStop(1, 'rgba(236,100,30,0)');
      g.fillStyle = glow; g.fillRect(0, 0, 640, 300);
      const round = Math.floor(s / 1.1), ph = (s % 1.1) / 1.1;
      const a = chars[Math.floor(s / 4.4) % 4], b = chars[(Math.floor(s / 4.4) + 2) % 4];
      const attacker = round % 2;
      const mv = seq[round % seq.length];
      const fa = { ch: a, fc: 1, y: 0, st: attacker === 0 ? 'attack' : (ph > 0.4 && ph < 0.7 ? 'hit' : 'idle'), mv, p: ph };
      const fb = { ch: b, fc: -1, y: 0, st: attacker === 1 ? 'attack' : (ph > 0.4 && ph < 0.7 ? 'hit' : 'idle'), mv, p: ph };
      drawFighter(g, fa, 230, 285, 1.05, s);
      drawFighter(g, fb, 410, 285, 1.05, s + 1);
      g.font = '400 14px "Press Start 2P", monospace'; g.textAlign = 'center'; g.fillStyle = '#F5B700';
      g.fillText(`${FIGHTERS[a].name.toUpperCase()}  VS  ${FIGHTERS[b].name.toUpperCase()}`, 320, 62);
    });
  }
  if (it.id === 'tekken') {
    const cv = document.createElement('canvas'); cv.width = 640; cv.height = 300; box.appendChild(cv);
    const g = cv.getContext('2d');
    const ids = Object.keys(TK_ROSTER), seq = ['jab', 'kick', 'upper', 'low', 'masse', 'coulee'];
    return loop((dt, t) => {
      const s = t / 1000;
      g.clearRect(0, 0, 640, 300);
      // sol en perspective
      g.fillStyle = '#1a120d'; g.beginPath(); g.ellipse(320, 280, 300, 60, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#ff8a2a'; g.lineWidth = 3; g.beginPath(); g.ellipse(320, 280, 300, 60, 0, 0, Math.PI * 2); g.stroke();
      const turn = Math.sin(s * 0.6);
      const a = ids[Math.floor(s / 3.3) % ids.length], b = ids[(Math.floor(s / 3.3) + 3) % ids.length];
      const ph = (s % 1.1) / 1.1, mv = seq[Math.floor(s / 1.1) % seq.length];
      drawFighter(g, { ch: a, fc: 1, y: 0, st: 'attack', mv, p: ph }, 250 - turn * 30, 285 - turn * 12, 1.0 + turn * 0.08, s);
      drawFighter(g, { ch: b, fc: -1, y: 0, st: ph > 0.4 && ph < 0.7 ? 'hit' : 'idle', p: 0 }, 400 + turn * 30, 285 + turn * 12, 1.0 - turn * 0.08, s + 1);
      g.font = '900 64px "Big Shoulders Display", Impact'; g.textAlign = 'right'; g.fillStyle = '#F5B700'; g.fillText('3D', 620, 70);
    });
  }
  if (it.id === 'planes') {
    const cv = document.createElement('canvas'); cv.width = 640; cv.height = 300; box.appendChild(cv);
    const g = cv.getContext('2d');
    const cols = ['#EC641E', '#BA2C3A', '#F2F4F7', '#5AA8FF'];
    return loop((dt, t) => {
      const s = t / 1000;
      g.fillStyle = '#123247'; g.fillRect(0, 0, 640, 300);
      g.fillStyle = '#3d4a2e'; g.beginPath(); g.arc(470, 220, 70, 0, Math.PI * 2); g.fill();
      cols.forEach((c, i) => {
        const a = s * 0.9 + i * Math.PI / 2;
        const x = 320 + Math.cos(a) * (200 - i * 12), y = 150 + Math.sin(a) * 95;
        g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2); drawPlane(g, c, i === 0 && Math.sin(s * 5) > 0, s, 1.4); g.restore();
      });
    });
  }
  if (it.id === 'course') {
    box.innerHTML = `<svg class="mini-track" viewBox="0 0 2100 1500" aria-hidden="true"><path id="pvTrack" d="M400 300 L1000 200 L1600 260 L1900 520 L1820 900 L1480 1040 L1150 900 L880 1060 L940 1300 L560 1380 L240 1180 L220 700 Z" fill="none" stroke="#3a3d42" stroke-width="140" stroke-linejoin="round"/><path d="M400 300 L1000 200 L1600 260 L1900 520 L1820 900 L1480 1040 L1150 900 L880 1060 L940 1300 L560 1380 L240 1180 L220 700 Z" fill="none" stroke="#BA2C3A" stroke-width="18" stroke-dasharray="60 60" stroke-linejoin="round"/><circle r="40" fill="#EC641E" id="pvCar"/><circle r="40" fill="#F2F4F7" id="pvCar2"/></svg>`;
    const path = $('#pvTrack', box), car = $('#pvCar', box), car2 = $('#pvCar2', box), L = path.getTotalLength();
    return loop((dt, t) => {
      const p = path.getPointAtLength((t / 6) % L), q = path.getPointAtLength((t / 6.4 + 300) % L);
      car.setAttribute('cx', p.x); car.setAttribute('cy', p.y); car2.setAttribute('cx', q.x); car2.setAttribute('cy', q.y);
    });
  }
  if (it.id === 'forgeopoly') {
    box.innerHTML = `<div class="mini-board">${Array.from({ length: 24 }, (_, i) => `<i style="background:${['#B08A5A', '#8A8D91', '#5AA8FF', '#EC641E', '#BA2C3A', '#F5B700'][i % 6]}"></i>`).join('')}<b>F</b></div>`;
    return null;
  }
  if (it.id === 'quiz') { box.innerHTML = '<span class="quiz-art">?</span>'; return null; }
  if (it.id === 'galaxie') {
    const cv = document.createElement('canvas'); cv.width = 640; cv.height = 300; box.appendChild(cv);
    const g = cv.getContext('2d');
    const stars = Array.from({ length: 60 }, () => [Math.random() * 640, Math.random() * 300, 20 + Math.random() * 60]);
    return loop((dt, t) => {
      const s = t / 1000;
      g.fillStyle = '#05060a'; g.fillRect(0, 0, 640, 300);
      stars.forEach(st => { st[1] = (st[1] + st[2] * dt) % 300; g.fillStyle = '#fff'; g.fillRect(st[0], st[1], 2, 2); });
      for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) {
        const e = { x: 320 + (c - 3.5) * 44 + Math.sin(s * 1.2) * 20, y: 50 + r * 36, type: r === 0 ? 'boss' : r === 1 ? 'papi' : 'abeille', state: 'form', col: c, hp: 2, a: 0 };
        if (r === 0 && c % 2) continue;
        drawEnemy(g, e, s);
      }
      const dx = 320 + Math.sin(s * 1.6) * 160;
      drawEnemy(g, { x: 320 + Math.cos(s) * 200, y: 170 + Math.sin(s * 2) * 40, type: 'papi', state: 'dive', a: s, col: 1, hp: 1 }, s);
      drawShip(g, dx - 16, 265, '#EC641E', s); drawShip(g, dx + 16, 265, '#EC641E', s);
      g.fillStyle = '#fff3c0'; g.fillRect(dx - 17, 230 - (s * 400 % 160), 3, 12); g.fillRect(dx + 15, 230 - (s * 400 % 160), 3, 12);
    });
  }
  if (it.id === 'usine') {
    const ccs = Object.keys(USINE_COUNTRIES);
    box.innerHTML = `<div class="usine-roll" id="pvFlag">${flagImg('cn', 140)}</div>`;
    let i = 0, acc = 0;
    return loop(dt => { acc += dt; if (acc > 0.45) { acc = 0; const el = $('#pvFlag', box); if (!el) return false; el.innerHTML = flagImg(ccs[i++ % ccs.length], 140); } });
  }
  if (it.id === 'tickets') { box.innerHTML = `<div class="ticket-strip" style="font-size:52px;padding:18px 34px"><i class="ticket-ico" style="width:44px;height:28px"></i>-10&nbsp;%</div>`; return null; }
  if (it.id === 'scores') { box.innerHTML = '<span class="quiz-art" style="color:#7fd4ff">HI</span>'; return null; }
  const gm = GAMES.find(x => x.id === it.id);
  box.innerHTML = `<div class="sweat-art">${sweatSVG(PRODUCTS[gm.product].model, TONES[gm.teinte].hex === '#1D1E20' ? '#3a3d42' : TONES[gm.teinte].hex)}</div>`;
  return null;
}

function launch(it) {
  SFX.good();
  if (previewStop) { previewStop(); previewStop = null; }
  if (it.kind === 'online') openOnline(it.id);
  else if (it.kind === 'solo') openGame(it.id);
  else openPanel(it.id);
}

/* appelé quand on revient au menu (fin de partie, fermeture) */
function onMenuReturn() { renderMenu(); }

/* ---------------- Panneaux ---------------- */
function openPanel(id, game) {
  panelEl.hidden = true; ticketsPanel.hidden = true;
  if (previewStop) { previewStop(); previewStop = null; }
  if (id === 'tickets') {
    ticketsPanel.hidden = false;
    refreshTickets();
    return;
  }
  panelEl.hidden = false;
  if (id === 'name') return renderNamePanel();
  if (id === 'scores') return renderScores(game);
}
function closePanel() {
  panelEl.hidden = true; ticketsPanel.hidden = true;
  onMenuReturn();
}
document.addEventListener('click', e => { if (e.target.closest('[data-back]')) closePanel(); });

function renderNamePanel() {
  panelEl.innerHTML = `<div class="name-entry">
    <h3>ENTRE TON NOM</h3>
    <p>Il s'affiche au classement de la promo et dans les parties en ligne.</p>
    <input id="nameIn" maxlength="16" autocomplete="nickname" placeholder="FONDEUR" value="${esc((server && server.name) || save.onlineName || '')}">
    <div class="end-actions"><button class="btn btn-hot" id="nameOk">Valider</button>${server && server.name ? '<button class="btn btn-ghost" data-back>Annuler</button>' : ''}</div>
  </div>`;
  const inp = $('#nameIn');
  inp.focus();
  const ok = async () => {
    const v = inp.value.trim();
    if (v.length < 2) { toast('2 caractères minimum.'); return; }
    try {
      await apiCall('/api/name', { name: v });
      save.onlineName = server.name; persist();
      toast(`Bienvenue ${server.name} !`);
      closePanel();
    } catch (e) { toast(e.message); }
  };
  $('#nameOk').addEventListener('click', ok);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
}

async function renderScores(game) {
  const tabs = ITEMS.filter(i => i.kind !== 'panel');
  let cur = game && tabs.some(t => t.id === game) ? game : tabs[0].id;
  panelEl.innerHTML = `<div class="panel-head"><button class="icon-btn" data-back aria-label="Retour au menu">◀</button><h3 class="pixel">HI-SCORES</h3></div>
    <div class="board-tabs" id="boardTabs">${tabs.map(t => `<button data-g="${t.id}">${esc(t.title)}</button>`).join('')}</div>
    <ol class="hiscore" id="hiscore"><li class="empty">Chargement…</li></ol>`;
  let data = null;
  const paint = () => {
    $('#boardTabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.g === cur));
    if (!data) return;
    const rows = data[cur] || [];
    const online = ONLINE.some(o => o.id === cur);
    const me = server && server.name;
    $('#hiscore').innerHTML = rows.length ? rows.map((r, i) => `<li class="${r.name === me ? 'me' : ''}"><span>${String(i + 1).padStart(2, '0')}.</span><span>${esc(r.name).toUpperCase()}</span><span>${r.v}${cur === 'quiz' ? '/10' : cur === 'usine' ? ' k€' : online ? ' VICT.' : ''}</span></li>`).join('')
      : '<li class="empty">Personne encore… à toi de jouer !</li>';
  };
  $('#boardTabs').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { cur = b.dataset.g; paint(); }));
  paint();
  try { data = await (await fetch('/api/leaderboard')).json(); } catch (e) { $('#hiscore').innerHTML = '<li class="empty">Serveur injoignable.</li>'; return; }
  paint();
}

$('#p1Btn').addEventListener('click', () => openPanel('name'));
$('#dispenser').addEventListener('click', () => { if (!modal.hidden) closeGame(); openPanel('tickets'); });

/* ---------------- Clavier & pupitre ---------------- */
const inMenu = () => modal.hidden && panelEl.hidden && ticketsPanel.hidden;
window.addEventListener('keydown', e => {
  if (e.target.matches && e.target.matches('input, textarea')) return;
  if (!modal.hidden) return;                       // les jeux gèrent leurs touches
  if (!panelEl.hidden || !ticketsPanel.hidden) {
    if (e.key === 'Escape' || e.code === 'KeyK') { e.preventDefault(); closePanel(); }
    return;
  }
  if (e.code === 'ArrowDown' || e.code === 'ArrowRight') { e.preventDefault(); select(sel + 1); }
  else if (e.code === 'ArrowUp' || e.code === 'ArrowLeft') { e.preventDefault(); select(sel - 1); }
  else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyJ') { e.preventDefault(); launch(ITEMS[sel]); }
});

// le joystick et les boutons suivent le clavier, et s'utilisent à la souris
const stick = $('#stick');
const held = new Set();
function paintStick() {
  const x = (held.has('ArrowRight') ? 1 : 0) - (held.has('ArrowLeft') ? 1 : 0);
  const y = (held.has('ArrowDown') ? 1 : 0) - (held.has('ArrowUp') ? 1 : 0);
  stick.style.transform = `rotate(${x * 22}deg) translateY(${y * 4}px) scaleY(${1 - Math.abs(y) * 0.12})`;
}
window.addEventListener('keydown', e => { held.add(e.code); paintStick(); document.querySelectorAll(`.cab-deck [data-key="${e.code}"]`).forEach(b => b.classList.add('on')); });
window.addEventListener('keyup', e => { held.delete(e.code); paintStick(); document.querySelectorAll(`.cab-deck [data-key="${e.code}"]`).forEach(b => b.classList.remove('on')); });
document.querySelectorAll('.cab-deck [data-key]').forEach(b => {
  const code = b.dataset.key;
  const key = code === 'Space' ? ' ' : code.startsWith('Key') ? code.slice(3).toLowerCase() : code;
  const fire = type => window.dispatchEvent(new KeyboardEvent(type, { code, key, bubbles: true }));
  b.addEventListener('pointerdown', e => { e.preventDefault(); fire('keydown'); });
  const up = () => fire('keyup');
  b.addEventListener('pointerup', up);
  b.addEventListener('pointerleave', () => { if (held.has(code)) up(); });
});

// le distributeur « crache » un ticket quand le compteur monte
let lastCount = 0;
new MutationObserver(() => {
  const n = +$('#ticketCount').textContent;
  if (n > lastCount) { const s = $('.ticket-strip'); s.classList.remove('bump'); void s.offsetWidth; s.classList.add('bump'); }
  lastCount = n;
}).observe($('#ticketCount'), { childList: true, characterData: true, subtree: true });

/* ---------------- Démarrage ---------------- */
renderMenu();
refreshTickets();
hello().then(() => {
  renderMenu();
  if (server && !server.name && modal.hidden) openPanel('name');
});
