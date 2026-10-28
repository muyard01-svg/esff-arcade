/* Guide des combos (Forge Fighters 2D et Poing de Fonte 3D) et grande annonce quand un combo passe.
   Les combos sont reconnus par le serveur (combos.py) ; ce fichier les montre et les met en scène. */
'use strict';

// demo : coups joués par l'animation du guide (noms des animations 2D de fighter.js)
const COMBO_GUIDE = {
  fighter: {
    title: 'Forge Fighters',
    keys: { P: 'J', K: 'K', S: 'L', D: '↓', U: '↑', F: '→', B: '←' },
    moves: [
      ['Poing', ['P'], 'jab'], ['Pied', ['K'], 'kick'], ['Balayette', ['D', 'K'], 'low'], ['Uppercut', ['D', 'P'], 'upper'],
      ['Coup sauté', ['U', 'P'], 'air'], ['Spécial (jauge de chaleur)', ['S'], 'S'], ['Garde', ['B'], null],
    ],
    combos: [
      ['Martelage', [['P'], ['P'], ['K']], ['jab', 'jab', 'kick'], 'Le classique : deux directs et un pied.'],
      ['Forge infernale', [['P'], ['P'], ['K'], ['D', 'K']], ['jab', 'jab', 'kick', 'low'], 'Martelage prolongé d\'une balayette.'],
      ['Fauchage', [['D', 'K'], ['D', 'P']], ['low', 'upper'], 'Balayette puis uppercut qui envoie en l\'air.'],
      ['Coup de trempe', [['P'], ['D', 'P']], ['jab', 'upper'], 'Direct puis uppercut.'],
      ['SIG', [['P'], ['K'], ['S']], ['jab', 'kick', 'S'], 'Signature du personnage (jauge de chaleur pleine au tiers).'],
    ],
    signatures: { fondeur: 'Déluge de fonte', forgeronne: 'Écrasement du pilon', mouleur: 'Tempête de sable noir', ebarbeuse: 'Ébarbage total' },
    specials: { fondeur: 'coulee', forgeronne: 'masse', mouleur: 'sable', ebarbeuse: 'meuleuse' },
    roster: () => FIGHTERS, saveKey: 'char',
  },
  tekken: {
    title: 'Poing de Fonte 3D',
    keys: { 1: 'U', 2: 'I', 3: 'J', 4: 'K', D: '↓', F: '→', B: '←', U: '↑', DF: '↘' },
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
      <p class="cg-foot">Un combo réussi déclenche son annonce et ajoute ${4} dégâts. Les coups enchaînés doivent toucher : face à une garde, la chaîne s'arrête.</p>
    </div>`;
    box.querySelector('#cgClose').addEventListener('click', closeComboGuide);
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
  const host = document.querySelector('#modal .modal-box') || document.body;
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

/* ---------- annonce d'un combo réussi : bandes noires, flash, titre métallique qui claque, voix grave ---------- */
function comboFx(host, name, hits, color, mine) {
  if (!host) return;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  host.querySelectorAll('.cfx').forEach(x => x.remove());
  const fx = document.createElement('div');
  fx.className = `cfx ${mine ? 'mine' : 'foe'}`; fx.dataset.overlay = '1';
  fx.style.setProperty('--tone', color || '#EC641E');
  const letters = name.toUpperCase().split('').map((ch, i) => `<span style="--i:${i}">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('');
  fx.innerHTML = `<i class="bar top"></i><i class="bar bot"></i><i class="flash"></i><i class="rays"></i>
    <div class="cfx-txt"><small>${mine ? 'COMBO !' : 'COMBO ADVERSE'}</small><b>${letters}</b><em>${hits} COUPS</em></div>`;
  for (let k = 0; k < 26; k++) {
    const s = document.createElement('i'); s.className = 'spark';
    const a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 260;
    s.style.cssText = `--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d * 0.6}px;--dl:${Math.random() * 0.25}s`;
    fx.appendChild(s);
  }
  const cvEl = host.querySelector('canvas.tk-hud, canvas.game-canvas');
  if (cvEl) Object.assign(fx.style, { left: cvEl.offsetLeft + 'px', top: cvEl.offsetTop + 'px', width: cvEl.offsetWidth + 'px', height: cvEl.offsetHeight + 'px' });
  host.appendChild(fx);
  host.classList.add('cfx-shake');
  setTimeout(() => host.classList.remove('cfx-shake'), 450);
  setTimeout(() => fx.remove(), 2300);
  // sons : impact grave, coup d'enclume, montée
  sfx(50, 0.6, 'sawtooth', 0.09, -20);
  setTimeout(() => sfx(1600, 0.25, 'triangle', 0.06, -900), 90);
  setTimeout(() => { sfx(220, 0.4, 'square', 0.04, 220); sfx(330, 0.4, 'square', 0.03, 330); }, 260);
  // annonceur à voix grave
  try {
    if (!muted && 'speechSynthesis' in window) {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(name);
      u.lang = 'fr-FR'; u.pitch = 0.2; u.rate = 0.85; u.volume = 0.9;
      setTimeout(() => speechSynthesis.speak(u), 250);
    }
  } catch (_) { /* pas de synthèse vocale : l'annonce reste visuelle */ }
}
