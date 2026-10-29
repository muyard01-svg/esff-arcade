/* Guide des combos (Poing de Fonte 3D) et grande annonce quand un combo passe.
   Les combos sont reconnus par le serveur (combos.py) ; ce fichier les montre et les met en scène. */
'use strict';

// demo : coups joués par l'animation du guide (noms des animations 2D de fighter.js)
const COMBO_GUIDE = {
  tekken: {
    title: 'Poing de Fonte 3D',
    keys: { 1: 'U', 2: 'I', 3: 'J', 4: 'K', D: '↓', F: '→', B: '←', U: '↑', DF: '↘', ULT3: 'L' },
    moves: [
      ['Poing gauche', ['1'], 'jab'], ['Poing droit', ['2'], 'jab'], ['Enchaînement 1,2', ['1', '2'], 'jab'], ['Pied gauche', ['3'], 'kick'],
      ['Pied droit', ['4'], 'kick'], ['Coup de pied avant', ['F', '3'], 'kick'], ['Balayette', ['D', '3'], 'low'],
      ['Uppercut lanceur', ['DF', '2'], 'upper'], ['Projection', ['1', '+', '3'], null], ['Spécial', ['B', '2'], 'S'],
    ],
    combos: [
      ['Martelage', [['1'], ['2'], ['F', '3']], ['jab', 'jab', 'kick'], '1,2 puis coup de pied avant.'],
      ['Coulée continue', [['1'], ['2'], ['D', '3'], ['4']], ['jab', 'jab', 'low', 'kick'], '1,2, balayette, puis pied droit.'],
      ['Fauchage', [['D', '3'], ['4']], ['low', 'kick'], 'Balayette puis pied droit.'],
      ['Enclume', [['F', '3'], ['1']], ['kick', 'jab'], 'Coup de pied avant puis poing.'],
      ['Trempe aérienne', [['DF', '2'], ['1'], ['1']], ['upper', 'jab', 'jab'], 'Uppercut lanceur puis deux coups en l\'air.'],
      ['SIG', [['1'], ['2'], ['B', '2']], ['jab', 'jab', 'S'], 'Signature : 1,2 puis le spécial (Lamineur : 1,2 puis → + 4).'],
    ],
    signatures: { fondeur: 'Déluge de fonte', forgeronne: 'Écrasement du pilon', mouleur: 'Tempête de sable noir', ebarbeuse: 'Ébarbage total', lamineur: 'Laminage à chaud', chaudronniere: 'Rivetage express' },
    specials: { fondeur: 'coulee', forgeronne: 'masse', mouleur: 'sable', ebarbeuse: 'meuleuse', lamineur: 'kick', chaudronniere: 'kick' },
    roster: () => TK_ROSTER, saveKey: 'char3d',
  },
};

/* ---------- guide ---------- */
function openComboGuide(kind) {
  const G = COMBO_GUIDE[kind];
  if (!G) return;
  closeComboGuide();
  const roster = G.roster();
  let char = roster[save[G.saveKey]] ? save[G.saveKey] : Object.keys(roster)[0];
  const chip = k => k === '+' ? '<i>+</i>' : `<kbd>${G.keys[k] || k}</kbd>`;
  const seq = steps => steps.map(s => s.map(chip).join('')).join('<i>,</i>');
  const box = document.createElement('div');
  box.className = 'combo-guide'; box.id = 'comboGuide'; box.dataset.overlay = '1';
  const render = () => {
    const sig = G.signatures[char];
    box.innerHTML = `<div class="cg-card">
      <header><h4>Guide des combos · ${G.title}</h4><button class="icon-btn" id="cgClose" aria-label="Fermer">✕</button></header>
      <div class="cg-chars">${Object.entries(roster).map(([id, c]) => `<button data-c="${id}" class="${id === char ? 'on' : ''}" style="--tone:${c.color}">${c.name}</button>`).join('')}</div>
      <div class="cg-body">
        <div class="cg-demo"><canvas width="420" height="230"></canvas><p id="cgCaption">Choisis un combo pour le voir</p></div>
        <div class="cg-lists">
          <h5>Combos <small>(enchaîne dès que le coup touche)</small></h5>
          <ul class="cg-combos">${G.combos.map(([name, steps, , desc], i) => `<li data-i="${i}" class="${name === 'SIG' ? 'sig' : ''}">
            <b>${name === 'SIG' ? sig : name}</b><span class="cg-seq">${seq(steps)}</span><em>${desc}</em></li>`).join('')}</ul>
          <h5>Coups de base</h5>
          <ul class="cg-moves">${G.moves.map(([n, k]) => `<li><span>${n}</span><span class="cg-seq">${k.map(chip).join('')}</span></li>`).join('')}</ul>
        </div>
      </div>
      <h5 class="cg-ult-h">Attaque ultime <small>(jauge d'énergie pleine)</small></h5>
      <div class="cg-ult" style="--tone:${(ULT_INFO[char] || ULT_INFO.fondeur).col}"><b>${(ULT_INFO[char] || ULT_INFO.fondeur).name}</b><span class="cg-seq">${chip(kind === 'tekken' ? 'ULT3' : 'ULT2')}</span>
        <em>La jauge se remplit en frappant et en encaissant. Ruée imparable : si elle touche, la cinématique se lance et le coup final fait ${kind === 'tekken' ? 42 : 30} dégâts ; si l'adversaire l'esquive (trop loin, en l'air, de côté), tu restes vulnérable.</em>
        <button type="button" class="btn btn-sm btn-hot" id="cgUltDemo">▶ Voir la cinématique</button></div>
      <p class="cg-foot">Un combo réussi ajoute ${4} dégâts. Les coups enchaînés doivent toucher : face à une garde, la chaîne s'arrête.</p>
    </div>`;
    box.querySelector('#cgClose').addEventListener('click', closeComboGuide);
    box.querySelector('#cgUltDemo').addEventListener('click', () => {
      const foe = Object.keys(roster).find(c => c !== char);
      const host = box.querySelector('.cg-demo'); host.classList.add('ult-host');
      ultCutIn(host, char, true);
      setTimeout(() => ultScene(host, char, foe, kind === 'tekken' ? 42 : 30, true), 1000);
    });
    box.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => { char = b.dataset.c; SFX.tick(); render(); }));
    box.querySelectorAll('[data-i]').forEach(li => li.addEventListener('click', () => play(+li.dataset.i)));
    cv = box.querySelector('canvas'); g = cv.getContext('2d');
    play(cur);
  };
  let cv, g, cur = 0, startAt = 0;
  const play = i => {
    cur = i; startAt = performance.now();
    box.querySelectorAll('[data-i]').forEach(li => li.classList.toggle('on', +li.dataset.i === i));
    const [name, steps] = G.combos[i];
    const cap = box.querySelector('#cgCaption');
    if (cap) cap.innerHTML = `<b>${name === 'SIG' ? G.signatures[char] : name}</b> ${seq(steps)}`;
  };
  // animation : chaque coup dure son vrai nombre d'images, l'adversaire encaisse, puis l'annonce s'affiche
  const stop = loop((dt, t) => {
    if (!g) return;
    const anims = G.combos[cur][2].map(a => a === 'S' ? G.specials[char] : a);
    const dur = anims.map(a => { const m = F_MOVES[a] || [4, 4, 8]; return (m[0] + m[1] + Math.min(m[2], 6)) / 30 * 1.6; });
    const total = dur.reduce((a, b) => a + b, 0);
    let el = (t - startAt) / 1000;
    const cycle = total + 2.2;
    el %= cycle;
    g.clearRect(0, 0, 420, 230);
    const bg = g.createLinearGradient(0, 0, 0, 230); bg.addColorStop(0, '#1c120d'); bg.addColorStop(1, '#3a1d0e');
    g.fillStyle = bg; g.fillRect(0, 0, 420, 230);
    g.fillStyle = '#120c0a'; g.fillRect(0, 200, 420, 30);
    let k = 0, acc = 0;
    while (k < anims.length - 1 && el > acc + dur[k]) { acc += dur[k]; k++; }
    const done = el > total;
    const p = done ? 1 : Math.min(1, (el - acc) / dur[k]);
    const mv = anims[k];
    const tm = F_MOVES[mv] || [4, 4, 8];
    const hitAt = tm[0] / (tm[0] + tm[1] + Math.min(tm[2], 6));
    const struck = !done && p > hitAt;
    const push = Math.min(60, (k + (struck ? 1 : 0)) * 14);
    drawFighter(g, { ch: char, fc: 1, y: 0, st: done ? 'win' : 'attack', mv, p: done ? 0 : p * (tm[0] + tm[1] + Math.min(tm[2], 6)) / (tm[0] + tm[1] + tm[2]) }, 150 + push * 0.6, 200, 0.82, t / 1000);
    const foe = Object.keys(roster).find(c => c !== char);
    const air = mv === 'upper' && struck ? Math.sin(Math.min(1, (p - hitAt) * 2) * Math.PI) * 40 : 0;
    drawFighter(g, { ch: foe, fc: -1, y: air, st: done ? 'down' : struck || k > 0 ? 'hit' : 'idle', p: 0 }, 250 + push, 200 - air, 0.82, t / 1000 + 1);
    if (struck && p - hitAt < 0.12) { g.fillStyle = 'rgba(255,190,90,.85)'; g.beginPath(); g.arc(232 + push, 120, 18, 0, Math.PI * 2); g.fill(); }
    g.font = '900 22px "Big Shoulders Display", Impact'; g.textAlign = 'left'; g.fillStyle = '#F5B700';
    if (!done && k > 0) g.fillText(`${k + (struck ? 1 : 0)} COUPS`, 14, 30);
    if (done) {
      const s = Math.min(1, (el - total) * 4);
      g.save(); g.translate(210, 70); g.scale(2 - s, 2 - s); g.globalAlpha = s;
      g.font = '900 34px "Big Shoulders Display", Impact'; g.textAlign = 'center';
      const name = G.combos[cur][0] === 'SIG' ? G.signatures[char] : G.combos[cur][0];
      g.lineWidth = 6; g.strokeStyle = '#000'; g.strokeText(name.toUpperCase(), 0, 0);
      const gr = g.createLinearGradient(0, -30, 0, 6); gr.addColorStop(0, '#fff3c0'); gr.addColorStop(0.5, '#F5B700'); gr.addColorStop(1, '#a8410f');
      g.fillStyle = gr; g.fillText(name.toUpperCase(), 0, 0);
      g.restore();
    }
  });
  box._stop = stop;
  const modal = document.querySelector('#modal');
  const host = modal && !modal.hidden ? modal.querySelector('.modal-box') : document.body;
  box.classList.toggle('page', host === document.body);
  host.appendChild(box);
  render();
  const onKey = e => { if (e.key === 'Escape' || e.code === 'KeyG') { e.preventDefault(); e.stopImmediatePropagation(); closeComboGuide(); } };
  window.addEventListener('keydown', onKey, true);
  box._key = onKey;
}
function closeComboGuide() {
  const box = document.getElementById('comboGuide');
  if (!box) return;
  box._stop(); window.removeEventListener('keydown', box._key, true); box.remove();
}

/* bouton « Guide des combos » + touche G pendant un combat ; renvoie une fonction de nettoyage */
function comboGuideButton(parent, kind) {
  const b = document.createElement('button');
  b.className = 'btn btn-sm btn-ghost combo-btn'; b.type = 'button';
  b.innerHTML = '📖 Guide des combos <kbd>G</kbd>';
  b.addEventListener('click', () => openComboGuide(kind));
  parent.appendChild(b);
  const key = e => { if (e.code === 'KeyG' && !e.repeat && !document.getElementById('comboGuide')) { e.preventDefault(); openComboGuide(kind); } };
  window.addEventListener('keydown', key);
  return () => { window.removeEventListener('keydown', key); closeComboGuide(); };
}

/* ---------- combo réussi : simple bandeau (la grande mise en scène est réservée à l'attaque ultime) ---------- */
function comboFx(host, name, hits, color, mine) {
  if (!host) return;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  host.querySelectorAll('.cfx').forEach(x => x.remove());
  const fx = document.createElement('div');
  fx.className = `cfx lite ${mine ? 'mine' : 'foe'}`; fx.dataset.overlay = '1';
  fx.style.setProperty('--tone', color || '#EC641E');
  fx.innerHTML = `<div class="cfx-txt"><small>${mine ? 'COMBO' : 'COMBO ADVERSE'}</small><b>${esc(name.toUpperCase())}</b><em>${hits} COUPS</em></div>`;
  ultPlace(host, fx);
  host.appendChild(fx);
  setTimeout(() => fx.remove(), 1500);
  sfx(880, 0.08, 'triangle', 0.05); setTimeout(() => sfx(1320, 0.12, 'triangle', 0.05), 80);
}

/* ======================= attaque ultime : mise en scène façon anime ======================= */
const ULT_INFO = {
  fondeur: { name: 'Coulée Éternelle', col: '#EC641E', fx: 'fonte', anim: 'coulee' },
  forgeronne: { name: 'Marteau-Pilon Divin', col: '#BA2C3A', fx: 'marteau', anim: 'masse' },
  mouleur: { name: 'Tempête du Désert Noir', col: '#C4A06E', fx: 'sable', anim: 'sable' },
  ebarbeuse: { name: 'Disque Fulgurant', col: '#7fd4ff', fx: 'disque', anim: 'meuleuse' },
  lamineur: { name: 'Laminoir Infernal', col: '#5AA8FF', fx: 'rouleaux', anim: 'masse' },
  chaudronniere: { name: 'Mille Rivets', col: '#7FD48A', fx: 'rivets', anim: 'kick' },
};
const ultAnim = ch => (ULT_INFO[ch] || ULT_INFO.fondeur).anim;

// calque posé exactement sur l'écran de jeu
function ultPlace(host, el) {
  const cvEl = host.querySelector('canvas.tk-hud, canvas.game-canvas');
  if (cvEl) Object.assign(el.style, { left: cvEl.offsetLeft + 'px', top: cvEl.offsetTop + 'px', width: cvEl.offsetWidth + 'px', height: cvEl.offsetHeight + 'px' });
}
function ultLayer(host) {
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  host.querySelectorAll('.ult-layer').forEach(x => { if (x._stop) x._stop(); x.remove(); });
  const cv = document.createElement('canvas');
  cv.width = 960; cv.height = 540; cv.className = 'ult-layer'; cv.dataset.overlay = '1';
  ultPlace(host, cv);
  host.appendChild(cv);
  return { cv, g: cv.getContext('2d') };
}
function ultVoice(text, delay) {
  try {
    if (muted || !('speechSynthesis' in window)) return;
    setTimeout(() => { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'fr-FR'; u.pitch = 0.15; u.rate = 0.8; speechSynthesis.speak(u); }, delay);
  } catch (_) { /* pas de voix de synthèse : l'animation suffit */ }
}
const uEase = t => 1 - (1 - t) ** 3;
const uClamp = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));

// lignes de vitesse : radiales (vers un point) ou verticales (montée)
function ultSpeedLines(g, t, cx, cy, col, n = 70, radial = true) {
  g.save(); g.strokeStyle = col; g.lineCap = 'round';
  for (let k = 0; k < n; k++) {
    const seed = (k * 9301 + 49297) % 233280 / 233280;
    if (radial) {
      const a = seed * Math.PI * 2, r0 = 160 + ((t * 900 + seed * 700) % 600), len = 80 + seed * 160;
      g.globalAlpha = 0.25 + seed * 0.5; g.lineWidth = 1 + seed * 4;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len)); g.stroke();
    } else {
      const x = seed * 960, y = ((t * 1800 + seed * 1000) % 700) - 100, len = 60 + seed * 200;
      g.globalAlpha = 0.2 + seed * 0.5; g.lineWidth = 1 + seed * 3;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + len); g.stroke();
    }
  }
  g.restore();
}
// silhouette unie d'un dessin (cases d'impact en noir et blanc)
const ultOff = document.createElement('canvas'); ultOff.width = 960; ultOff.height = 540;
function ultSilhouette(g, draw, color) {
  const o = ultOff.getContext('2d');
  o.globalCompositeOperation = 'source-over'; o.clearRect(0, 0, 960, 540);
  draw(o);
  o.globalCompositeOperation = 'source-in'; o.fillStyle = color; o.fillRect(0, 0, 960, 540);
  o.globalCompositeOperation = 'source-over';
  g.drawImage(ultOff, 0, 0);
}
function ultTitle(g, text, x, y, size, prog, col) {
  const up = text.toUpperCase();
  g.save(); g.font = `900 ${size}px "Big Shoulders Display", Impact`; g.textAlign = 'left'; g.textBaseline = 'middle';
  const total = g.measureText(up).width;
  let cx = x - total / 2;
  const shown = Math.floor(up.length * prog + 0.001);
  for (let i = 0; i < up.length; i++) {
    const ch = up[i], w = g.measureText(ch).width;
    if (i < shown) {
      const pop = Math.min(1, (up.length * prog - i) * 1.5);
      g.save(); g.translate(cx + w / 2, y); g.scale(1 + (1 - pop) * 1.4, 1 + (1 - pop) * 1.4); g.globalAlpha = pop;
      g.lineWidth = 8; g.strokeStyle = '#000'; g.strokeText(ch, -w / 2, 0);
      const gr = g.createLinearGradient(0, -size / 2, 0, size / 2); gr.addColorStop(0, '#fffbe6'); gr.addColorStop(0.45, '#ffd27a'); gr.addColorStop(0.55, col); gr.addColorStop(1, '#3a1206');
      g.fillStyle = gr; g.fillText(ch, -w / 2, 0);
      g.restore();
    }
    cx += w;
  }
  g.restore();
}

/* 1) ouverture : bandeau en diagonale avec le personnage, « 奥義 » et le nom de la technique */
function ultCutIn(host, ch, mine) {
  const info = ULT_INFO[ch] || ULT_INFO.fondeur;
  const { cv, g } = ultLayer(host);
  const t0 = performance.now(), DUR = 1.0;
  sfx(90, 0.5, 'sawtooth', 0.06, 200); setTimeout(() => sfx(1200, 0.3, 'triangle', 0.05, -600), 150);
  const stop = loop((dt, tms) => {
    const t = (performance.now() - t0) / 1000;
    if (t > DUR) { cv.remove(); return false; }
    const inK = uEase(uClamp(t, 0, 0.18)), outK = uClamp(t, DUR - 0.18, DUR);
    g.clearRect(0, 0, 960, 540);
    g.fillStyle = `rgba(0,0,0,${0.6 * inK * (1 - outK)})`; g.fillRect(0, 0, 960, 540);
    g.save();
    g.translate((1 - inK) * -960 + outK * 960, 0);
    // bandeau incliné
    g.beginPath(); g.moveTo(0, 150); g.lineTo(960, 90); g.lineTo(960, 390); g.lineTo(0, 450); g.closePath();
    const bg = g.createLinearGradient(0, 90, 0, 450); bg.addColorStop(0, '#120a06'); bg.addColorStop(0.5, info.col); bg.addColorStop(1, '#120a06');
    g.fillStyle = bg; g.fill(); g.save(); g.clip();
    ultSpeedLines(g, t * 2, 260, 270, 'rgba(255,255,255,.8)', 50);
    drawFighter(g, { ch, fc: 1, y: 0, st: 'attack', mv: info.anim, p: 0.3 }, 250, 470, 2.3, t);
    g.restore();
    g.strokeStyle = '#fff'; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 150); g.lineTo(960, 90); g.moveTo(0, 450); g.lineTo(960, 390); g.stroke();
    g.font = '900 64px serif'; g.fillStyle = 'rgba(255,255,255,.9)'; g.textAlign = 'center'; g.fillText('奥義', 860, 200);
    g.restore();
    const tx = uClamp(t, 0.15, 0.45);
    g.font = '400 14px "Press Start 2P", monospace'; g.textAlign = 'center'; g.fillStyle = mine ? '#F5B700' : '#ff8a8a'; g.globalAlpha = tx * (1 - outK);
    g.fillText(mine ? 'ATTAQUE ULTIME !' : 'ULTIME ADVERSE !', 600, 230);
    g.globalAlpha = 1 - outK;
    ultTitle(g, info.name, 600, 300, 64, tx, info.col);
    g.globalAlpha = 1;
  });
  cv._stop = stop;
}

/* 2) le coup a touché : cinématique complète en quatre plans, puis retour au combat */
function ultScene(host, ch, foe, dmg, mine) {
  const info = ULT_INFO[ch] || ULT_INFO.fondeur;
  const { cv, g } = ultLayer(host);
  const t0 = performance.now(), DUR = 4.3;
  const parts = [];
  // bande-son : impact, coups en l'air, charge, coup final
  sfx(45, 0.7, 'sawtooth', 0.1, -20); sfx(1800, 0.2, 'square', 0.05, -1500);
  [700, 950, 1200, 1450, 1700].forEach((ms, k) => setTimeout(() => { sfx(150 + k * 40, 0.12, 'square', 0.07, -80); sfx(900, 0.06, 'triangle', 0.04); }, ms));
  setTimeout(() => sfx(70, 1.1, 'sawtooth', 0.06, 160), 2000);
  setTimeout(() => { sfx(40, 1.0, 'sawtooth', 0.12, -15); sfx(2200, 0.3, 'square', 0.05, -2000); }, 3450);
  ultVoice(info.name, 2150);
  const stop = loop((dt, tms) => {
    const t = (performance.now() - t0) / 1000;
    if (t > DUR) { cv.remove(); return false; }
    g.save();
    const shake = t < 0.6 || (t > 3.4 && t < 3.9) ? 14 : t > 0.6 && t < 2 && (t * 4 % 1) < 0.15 ? 8 : 0;
    if (shake) g.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    g.clearRect(-20, -20, 1000, 580);
    if (t < 0.6) {
      /* plan 1 : case d'impact */
      const flip = Math.floor(t / 0.08) % 2;
      const drawPair = o => { drawFighter(o, { ch, fc: 1, y: 0, st: 'attack', mv: info.anim, p: 0.55 }, 400, 470, 1.9, t); drawFighter(o, { ch: foe, fc: -1, y: 0, st: 'hit', p: 0 }, 560, 470, 1.9, t); };
      if (t < 0.3) {
        g.fillStyle = flip ? '#000' : '#fff'; g.fillRect(-20, -20, 1000, 580);
        ultSilhouette(g, drawPair, flip ? '#fff' : '#000');
        g.strokeStyle = flip ? '#fff' : '#000'; g.lineWidth = 6;
        for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2; g.beginPath(); g.moveTo(480 + Math.cos(a) * 60, 300 + Math.sin(a) * 60); g.lineTo(480 + Math.cos(a) * 700, 300 + Math.sin(a) * 700); g.stroke(); }
      } else {
        const rg = g.createRadialGradient(480, 300, 10, 480, 300, 600); rg.addColorStop(0, '#fff'); rg.addColorStop(0.25, info.col); rg.addColorStop(1, '#120606');
        g.fillStyle = rg; g.fillRect(-20, -20, 1000, 580);
        ultSpeedLines(g, t, 480, 300, 'rgba(255,255,255,.9)', 80);
        drawPair(g);
        const k = uClamp(t, 0.3, 0.6);
        for (let r = 0; r < 3; r++) { g.strokeStyle = `rgba(255,255,255,${1 - k})`; g.lineWidth = 10 - r * 3; g.beginPath(); g.arc(480, 300, 60 + k * (300 + r * 120), 0, Math.PI * 2); g.stroke(); }
      }
    } else if (t < 2.0) {
      /* plan 2 : l'adversaire est projeté en l'air, poursuivi et frappé sous les lignes de vitesse */
      const k = uClamp(t, 0.6, 2.0);
      const sky = g.createLinearGradient(0, 0, 0, 540); sky.addColorStop(0, '#0d0612'); sky.addColorStop(0.6, shade(info.col, -0.45)); sky.addColorStop(1, info.col);
      g.fillStyle = sky; g.fillRect(-20, -20, 1000, 580);
      ultSpeedLines(g, t, 0, 0, 'rgba(255,255,255,.55)', 60, false);
      const fy = 380 - k * 160, ax = 380 + Math.sin(t * 9) * 60;
      g.save(); g.translate(560, fy); g.rotate(t * 7);
      drawFighter(g, { ch: foe, fc: -1, y: 0, st: 'hit', p: 0 }, 0, 70, 1.5, t); g.restore();
      drawFighter(g, { ch, fc: 1, y: 0, st: 'attack', mv: Math.floor(t * 4) % 2 ? 'kick' : 'jab', p: (t * 4) % 1 }, ax, fy + 240, 1.5, t);
      ultEffect(g, info.fx, t, 560, fy, 0.6, info.col, parts, dt);
      if ((t * 4 % 1) < 0.18) {   // éclat de chaque coup
        g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath();
        for (let s = 0; s < 12; s++) { const a = s / 12 * Math.PI * 2, r = s % 2 ? 30 : 90; g.lineTo(560 + Math.cos(a) * r, fy + Math.sin(a) * r); }
        g.fill();
      }
      g.font = '900 46px "Big Shoulders Display", Impact'; g.textAlign = 'right'; g.fillStyle = '#F5B700'; g.strokeStyle = '#000'; g.lineWidth = 6;
      const hits = Math.min(5, 1 + Math.floor((t - 0.7) * 4));
      g.strokeText(`${hits} COUPS`, 930, 70); g.fillText(`${hits} COUPS`, 930, 70);
    } else if (t < 3.1) {
      /* plan 3 : gros plan sur le personnage qui concentre son énergie, nom de la technique */
      const k = uClamp(t, 2.0, 3.1);
      g.fillStyle = '#050304'; g.fillRect(-20, -20, 1000, 580);
      const rg = g.createRadialGradient(480, 360, 20, 480, 360, 420); rg.addColorStop(0, info.col); rg.addColorStop(0.5, shade(info.col, -0.6)); rg.addColorStop(1, '#050304');
      g.globalAlpha = 0.6 + Math.sin(t * 30) * 0.15; g.fillStyle = rg; g.fillRect(-20, -20, 1000, 580); g.globalAlpha = 1;
      if (Math.random() < 0.9) parts.push({ x: 300 + Math.random() * 360, y: 560, vx: (Math.random() - 0.5) * 40, vy: -200 - Math.random() * 300, life: 1, c: info.col, r: 2 + Math.random() * 4 });
      ultParts(g, parts, dt);
      const zoom = 3.0 + k * 0.6;
      drawFighter(g, { ch, fc: 1, y: 0, st: 'attack', mv: info.anim, p: 0.25 + k * 0.1 }, 480, 620 + k * 40, zoom, t);
      g.font = '900 120px serif'; g.fillStyle = `rgba(255,255,255,${0.15 + k * 0.2})`; g.textAlign = 'center'; g.fillText('奥', 120, 260); g.fillText('義', 120, 390);
      ultTitle(g, info.name, 480, 90, 70, uClamp(t, 2.1, 2.9), info.col);
    } else {
      /* plan 4 : le coup final, propre à chaque personnage, puis l'explosion */
      const k = uClamp(t, 3.1, 3.45);
      const sky = g.createLinearGradient(0, 0, 0, 540); sky.addColorStop(0, '#120606'); sky.addColorStop(1, shade(info.col, -0.3));
      g.fillStyle = sky; g.fillRect(-20, -20, 1000, 580);
      drawFighter(g, { ch: foe, fc: -1, y: 0, st: t > 3.45 ? 'down' : 'hit', p: 0 }, 480, 470, 1.4, t);
      ultEffect(g, info.fx, t, 480, 380, k, info.col, parts, dt, true);
      if (t > 3.45) {
        const e = uClamp(t, 3.45, 4.0);
        if (e < 0.18) { g.fillStyle = `rgba(255,255,255,${1 - e / 0.18})`; g.fillRect(-20, -20, 1000, 580); }
        for (let r = 0; r < 4; r++) { g.strokeStyle = `rgba(255,${200 - r * 40},120,${1 - e})`; g.lineWidth = 14 - r * 3; g.beginPath(); g.ellipse(480, 470, 40 + e * (500 + r * 90), 12 + e * (120 + r * 20), 0, 0, Math.PI * 2); g.stroke(); }
        g.save(); g.translate(480, 230); const s = 1 + (1 - uEase(uClamp(t, 3.5, 3.7))) * 2; g.scale(s, s);
        g.font = '900 96px "Big Shoulders Display", Impact'; g.textAlign = 'center'; g.lineWidth = 10; g.strokeStyle = '#000'; g.strokeText(`-${dmg}`, 0, 0);
        g.fillStyle = mine ? '#F5B700' : '#ff5a5a'; g.fillText(`-${dmg}`, 0, 0); g.restore();
      }
      const fade = uClamp(t, 3.95, DUR);
      if (fade > 0) { g.fillStyle = `rgba(0,0,0,${fade * 0.9})`; g.fillRect(-20, -20, 1000, 580); }
    }
    // bandes noires de cinéma
    g.fillStyle = '#000'; g.fillRect(-20, -20, 1000, 56); g.fillRect(-20, 504, 1000, 56);
    g.restore();
  });
  cv._stop = stop;
}

function ultParts(g, parts, dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life -= dt * 1.2; if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    g.globalAlpha = Math.min(1, p.life * 2); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
}

/* effets propres à chaque personnage (k : avancement du coup final de 0 à 1) */
function ultEffect(g, fx, t, x, y, k, col, parts, dt, finale) {
  g.save();
  if (fx === 'fonte') {            // vague de fonte en fusion
    const top = finale ? -200 + uEase(k) * 520 : y - 140;
    const gr = g.createLinearGradient(0, top - 100, 0, top + 300); gr.addColorStop(0, '#fff3c0'); gr.addColorStop(0.3, '#ffb347'); gr.addColorStop(0.7, '#EC641E'); gr.addColorStop(1, 'rgba(160,40,10,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(-20, top + 300);
    for (let px = -20; px <= 980; px += 30) g.lineTo(px, top + Math.sin(px / 60 + t * 8) * 30 + (finale ? 0 : Math.abs(px - x) * 0.4));
    g.lineTo(980, top + 300); g.closePath(); g.globalAlpha = finale ? 1 : 0.7; g.fill();
    for (let n = 0; n < 3; n++) parts.push({ x: x + (Math.random() - 0.5) * 400, y: top, vx: (Math.random() - 0.5) * 200, vy: -150 - Math.random() * 200, life: 0.8, c: '#ffb347', r: 3 + Math.random() * 5 });
  } else if (fx === 'marteau') {   // marteau-pilon géant qui s'abat
    const ang = finale ? -1.6 + uEase(k) * 1.6 : Math.sin(t * 6) * 0.6 - 0.8;
    g.translate(finale ? 160 : x - 220, finale ? 520 : y + 120); g.rotate(ang);
    g.fillStyle = '#7a5434'; g.fillRect(-14, -420, 28, 420);
    g.fillStyle = '#4a4e54'; g.fillRect(-120, -520, 240, 130); g.fillStyle = col; g.fillRect(-120, -420, 240, 18);
    g.strokeStyle = '#000'; g.lineWidth = 6; g.strokeRect(-120, -520, 240, 130);
  } else if (fx === 'sable') {     // tourbillon de sable noir
    for (let n = 0; n < 160; n++) {
      const a = n * 0.7 + t * (finale ? 9 : 6), r = (n * 3 + t * 200) % (finale ? 420 * (1 - k * 0.8) + 40 : 260);
      g.fillStyle = n % 3 ? '#2b2018' : '#C4A06E'; g.globalAlpha = 0.7;
      g.beginPath(); g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6, 3 + (n % 4), 0, Math.PI * 2); g.fill();
    }
  } else if (fx === 'disque') {    // disque de meuleuse géant et gerbes d'étincelles
    const R = finale ? 120 + uEase(k) * 200 : 90;
    g.translate(finale ? 480 : x, finale ? 300 : y); g.rotate(t * 30);
    g.fillStyle = '#9aa0a6'; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#2b2e33'; g.lineWidth = 6; for (let s = 0; s < 12; s++) { g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(s) * R, Math.sin(s) * R); g.stroke(); }
    g.fillStyle = '#2b6cb0'; g.beginPath(); g.arc(0, 0, R * 0.25, 0, Math.PI * 2); g.fill();
    for (let n = 0; n < 6; n++) parts.push({ x: (finale ? 480 : x) + R, y: finale ? 300 : y, vx: 200 + Math.random() * 500, vy: (Math.random() - 0.7) * 400, life: 0.5, c: '#ffe07a', r: 2 });
  } else if (fx === 'rouleaux') {  // deux cylindres de laminoir qui écrasent
    const gap = finale ? 480 * (1 - uEase(k)) + 40 : 260 + Math.sin(t * 6) * 40;
    [-1, 1].forEach(sd => {
      const cx = (finale ? 480 : x) + sd * (gap + 140);
      const gr = g.createLinearGradient(cx - 140, 0, cx + 140, 0); gr.addColorStop(0, '#2b2e33'); gr.addColorStop(0.5, '#d8dde3'); gr.addColorStop(1, '#2b2e33');
      g.fillStyle = gr; g.fillRect(cx - 140, -20, 280, 580);
      g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 3; for (let ly = (t * 600) % 40; ly < 540; ly += 40) { g.beginPath(); g.moveTo(cx - 140, ly); g.lineTo(cx + 140, ly); g.stroke(); }
    });
  } else {                         // mille rivets
    for (let n = 0; n < (finale ? 90 : 40); n++) {
      const sx = ((n * 137 + t * 1600) % 1300) - 200, sy = ((n * 89) % 600) - 40 + (sx - 480) * 0.35;
      g.fillStyle = n % 4 ? '#c9ccd1' : '#7FD48A'; g.strokeStyle = '#ffe07a'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(sx - 40, sy - 14); g.lineTo(sx, sy); g.stroke();
      g.beginPath(); g.arc(sx, sy, 6, 0, Math.PI * 2); g.fill();
    }
  }
  g.restore();
  ultParts(g, parts, dt);
}

/* 3) l'ultime a été esquivé */
function ultMiss(host) {
  host.querySelectorAll('.ult-layer').forEach(x => { if (x._stop) x._stop(); x.remove(); });
  const fx = document.createElement('div');
  fx.className = 'cfx lite foe'; fx.dataset.overlay = '1';
  fx.innerHTML = '<div class="cfx-txt"><b>ESQUIVÉ !</b></div>';
  ultPlace(host, fx); host.appendChild(fx);
  setTimeout(() => fx.remove(), 1000);
  sfx(300, 0.3, 'sawtooth', 0.05, -250);
}
