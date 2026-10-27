/* Usine 101 — gère ta forge ou ta fonderie, façon « 1 sur 8 milliards » :
   tu choisis seulement le métier, le hasard (pondéré par la production mondiale réelle) choisit
   le pays, la ville et ton capital. Le temps passe tout seul, les événements tombent. */
'use strict';

const USINE_KEY = 'esff-usine-v1';
const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const SPEEDS_MS = [0, 6000, 3000, 1400];   // pause, x1, x2, x4 (durée d'un mois)

const fmtEur = v => {
  const a = Math.abs(v), s = v < 0 ? '-' : '';
  if (a >= 1e6) return `${s}${(a / 1e6).toFixed(2).replace('.', ',')} M€`;
  if (a >= 1e4) return `${s}${Math.round(a / 1e3)} k€`;
  return `${s}${Math.round(a).toLocaleString('fr-FR')} €`;
};
const fmtLocal = (v, C, s) => {
  if (C.cur === 'EUR') return '';
  const fx = C.fx * Math.pow(1 + (C.fxDrift || 0), s ? s.month / 12 : 0);  // dépréciation de la monnaie locale
  const x = v * fx, a = Math.abs(x);
  const t = a >= 1e9 ? `${(x / 1e9).toFixed(1)} Md` : a >= 1e6 ? `${(x / 1e6).toFixed(1)} M` : a >= 1e3 ? `${Math.round(x / 1e3)} k` : Math.round(x);
  return `${t} ${C.cur}`.replace('.', ',');
};
// drapeaux en image : les emojis drapeaux ne s'affichent pas sous Windows
const flagImg = (cc, w = 40) => `<img class="flag" src="https://flagcdn.com/w80/${cc.toLowerCase()}.png" width="${w}" height="${Math.round(w * 0.66)}" alt="">`;
const pct = v => `${(v * 100).toFixed(1).replace('.', ',')} %`;
// montant de référence (pour une PME française d'environ 6 M€ de CA) ramené à la taille de l'entreprise
const scaled = (s, eur) => Math.max(2000, Math.round(eur * (s.scale || 1) / 1000) * 1000);
const scaleLabel = (s, txt) => txt.replace(/(\d+) k€/g, (_, n) => fmtEur(scaled(s, n * 1000)));

/* ---------------- Création d'une entreprise (tirage au sort réaliste) ---------------- */
function usineDraw(type, forceCC) {
  const entries = Object.entries(USINE_COUNTRIES);
  const total = entries.reduce((s, [, c]) => s + c.weight[type], 0);
  let r = Math.random() * total, cc = entries[0][0];
  for (const [k, c] of entries) { r -= c.weight[type]; if (r <= 0) { cc = k; break; } }
  if (forceCC) cc = forceCC;  // utilisé pour les tests d'équilibrage
  const C = USINE_COUNTRIES[cc];
  const ctot = C.cities.reduce((s, c) => s + c.base[type], 0);
  let rc = Math.random() * ctot, city = C.cities[0];
  for (const c of C.cities) { rc -= c.base[type]; if (rc <= 0) { city = c; break; } }

  const employees = Math.round(rand(12, 45));
  const prod = C.prod[type];
  const capacity = employees * prod / 12 * rand(1.08, 1.25);           // t/mois
  const priceIdx = C.price[type] / USINE_COUNTRIES.FR.price[type];
  const capex = (type === 'fonderie' ? 1800 : 1500) * Math.max(0.35, priceIdx); // €/t de capacité annuelle (est.)
  const equip = capacity * 12 * capex * rand(0.6, 1.0);
  const monthlyRev = capacity * 0.82 * 1000 * C.price[type];
  const cash = monthlyRev * rand(0.8, 1.8);
  const debt = equip * rand(0.2, 0.5);
  const prefix = type === 'fonderie' ? 'Fonderie' : 'Forges';
  const s = {
    v: 1, type, cc, city: city.name, region: city.region, cityNote: city.note,
    name: `${prefix} de ${city.name}`,
    competitors: Math.round(city.base[type] * rand(0.85, 1.15)),
    age: Math.round(rand(27, 46)), month: 0, startMonth: 10, startYear: 2026,
    employees, seniority: rand(4, 12), capacity, baseDemand: capacity * 0.82,
    prodIdx: 1, priceIdx: 1, wageIdx: 1, marketIdx: 1, costIdx: 1,
    scrap: type === 'fonderie' ? rand(0.06, 0.1) : rand(0.03, 0.06),
    reputation: rand(0.5, 0.7), morale: 0.7, machine: rand(0.55, 0.85), maint: 1, safety: 0.5,
    cash, debt, debtStart: debt, debtTerm: 84, rate: C.rate, equip,
    diversify: 0, energyEff: 1, priceBoost: 0, extraWage: 0,
    mods: [], energyFix: null, envOk: Math.random() < 0.7, envDeadline: null, envFine: false,
    invest: [], hireBlock: 0, subsidy: 0, taxAudit: false, stopped: false,
    yearProfit: 0, lastTax: 0, neg: 0, overhead: monthlyRev * 0.07,
    hist: [], log: [], last: null, ebitda12: [], events: 0, over: false,
  };
  s.startCash = cash; s.startEquity = cash + equip - debt;
  s.scale = monthlyRev / 500000;  // taille de l'entreprise : les montants fixes des événements y sont proportionnés
  usineLog(s, `Reprise de ${s.name} (${city.region}, ${C.name}) avec ${employees} salariés.`);
  if (!s.envOk) usineLog(s, `⚠ ${C.admin.env} à renouveler : la conformité environnementale n'est pas assurée.`);
  return s;
}

function usineLog(s, msg) { s.log.unshift({ d: usineDate(s), msg }); s.log = s.log.slice(0, 40); }
function usineDate(s) { const m = (s.startMonth + s.month) % 12; const y = s.startYear + Math.floor((s.startMonth + s.month) / 12); return `${MONTHS_FR[m]} ${y}`; }
function modMult(s, k) { return s.mods.filter(m => m.k === k).reduce((p, m) => p * m.v, 1); }
function marketMult(s) {
  const mk = USINE_MARKETS[s.type];
  let d = 0, mg = 0;
  for (const m of mk) {
    const f = s.mods.filter(x => x.k === 'dm_' + m.id).reduce((p, x) => p * x.v, 1);
    d += m.share * f; mg += m.share * f * m.margin;
  }
  return { demand: d, margin: mg / d };
}

/* ---------------- Un mois qui passe ---------------- */
function usineStep(s) {
  const C = USINE_COUNTRIES[s.cc], T = s.type, M = USINE_MARKET;
  s.month++;
  // inflation : coûts et prix dérivent
  const infl = C.infl / 12;
  s.costIdx *= 1 + infl;
  s.marketIdx *= 1 + infl;
  s.wageIdx *= 1 + infl + (s.cc === 'PL' ? 0.002 : 0);  // rattrapage salarial polonais
  // usure des machines selon l'entretien
  s.machine = clamp(s.machine - 0.007 + [0.001, 0.0065, 0.012][s.maint], 0.05, 1);
  s.mods.forEach(m => m.left--);
  s.mods = s.mods.filter(m => m.left > 0);
  if (s.hireBlock > 0) s.hireBlock--;
  if (s.subsidy > 0) s.subsidy--;
  if (s.energyFix) { s.energyFix.left--; if (s.energyFix.left <= 0) s.energyFix = null; }

  // capacité et production
  const staffCap = s.employees * C.prod[T] * s.prodIdx / 12 * (0.75 + 0.35 * s.morale);
  const machCap = s.capacity * (0.55 + 0.45 * s.machine) * modMult(s, 'capMult');
  let capacity = Math.min(staffCap, machCap);
  if (s.envFine) capacity *= 0.5;
  const mm = marketMult(s);
  const cycle = 1 + 0.08 * Math.sin((s.month / 48) * Math.PI * 2) + rand(-0.04, 0.04);
  const elastic = Math.pow(1 / s.priceIdx, 2.2);
  const demand = s.baseDemand * (1 + s.diversify) * cycle * modMult(s, 'demand') * mm.demand * elastic * (0.7 + 0.6 * s.reputation);
  const sold = Math.max(0, Math.min(demand, capacity));
  const service = demand > 0 ? sold / demand : 1;

  // finances du mois (€)
  const price = C.price[T] * 1000 * s.marketIdx * s.priceIdx * modMult(s, 'marketPrice') * mm.margin * (1 + s.priceBoost);
  const revenue = sold * price;
  // matières (métal, alliages, sable, liants) et achats divers (outillages, sous-traitance, transport),
  // en part du prix de marché local : la matière suit le niveau de prix de chaque pays
  const listPrice = C.price[T] * 1000 * s.marketIdx;
  const materials = sold * listPrice * M.matShare[T] * s.costIdx / s.marketIdx * modMult(s, 'matMult') * (1 + s.scrap)
    + sold * listPrice * M.otherShare;
  const k = M.kwh[T];
  const eMult = s.energyFix ? s.energyFix.v : modMult(s, 'energyMult');
  const energy = sold * (k.elec * C.elec + k.gas * C.gas) / 1000 * s.energyEff * eMult * s.costIdx * (1 + s.scrap);
  const labour = (s.employees * C.labour * C.hours / 12 * s.wageIdx + s.extraWage) * modMult(s, 'wageMult');
  const overhead = s.overhead * s.costIdx;
  const maintenance = s.equip * [0.008, 0.02, 0.035][s.maint] / 12;
  const ebitda = revenue - materials - energy - labour - overhead - maintenance;
  const depreciation = s.equip / 120;
  const interest = s.debt * s.rate / 12;
  const principal = Math.min(s.debt, s.debtStart / s.debtTerm);
  s.debt -= principal;
  s.equip = Math.max(0, s.equip - depreciation * 0.6);
  s.cash += ebitda - interest - principal;
  s.yearProfit += ebitda - depreciation - interest;

  // impôt sur les sociétés payé chaque fin d'exercice (décembre)
  if ((s.startMonth + s.month) % 12 === 11) {
    const tax = Math.max(0, s.yearProfit) * C.tax;
    s.cash -= tax; s.lastTax = tax;
    usineLog(s, `Clôture de l'exercice : résultat ${fmtEur(s.yearProfit)}, impôt sur les sociétés (${pct(C.tax)}) ${fmtEur(tax)}.`);
    if (s.taxAudit) {
      const pen = Math.random() < 0.4 ? Math.max(scaled(s, 15000), revenue * 0.4) : 0;
      s.cash -= pen; s.taxAudit = false;
      usineLog(s, pen ? `Contrôle fiscal : redressement de ${fmtEur(pen)}.` : 'Contrôle fiscal : aucune irrégularité.');
    }
    s.yearProfit = 0;
    s.age++;
  }

  // qualité, réputation, moral
  s.reputation = clamp(s.reputation + ((0.35 + 0.45 * service + (0.08 - s.scrap) * 2 + s.safety * 0.1) - s.reputation) * 0.06, 0.05, 1);
  const wageGap = s.wageIdx - s.costIdx;  // salaires qui suivent (ou non) l'inflation
  s.morale = clamp(s.morale + ((0.7 + wageGap * 3 + (s.safety - 0.5) * 0.2) - s.morale) * 0.05, 0.1, 1);
  s.scrap = clamp(s.scrap + ((s.type === 'fonderie' ? 0.07 : 0.045) * (1.3 - s.machine * 0.5) - s.scrap) * 0.02, 0.01, 0.25);

  // conformité environnementale
  if (s.envDeadline !== null) {
    s.envDeadline--;
    if (s.envDeadline <= 0 && !s.envOk) { s.envFine = true; s.envDeadline = null; s.cash -= scaled(s, 50000); usineLog(s, `⚠ Mise en demeure : ${C.admin.env} non respecté. Amende de ${fmtEur(scaled(s, 50000))} et production limitée de moitié jusqu'à mise en conformité.`); }
    else if (s.envOk) s.envDeadline = null;
  }

  s.last = { revenue, materials, energy, labour, overhead, maintenance, ebitda, interest, sold, demand, capacity, price, service };
  s.ebitda12.push(ebitda); if (s.ebitda12.length > 12) s.ebitda12.shift();
  s.hist.push({ cash: s.cash, rev: revenue, res: ebitda - depreciation - interest });
  if (s.startValue === undefined) s.startValue = usineValue(s);   // valeur de référence à la reprise
  if (s.hist.length > 120) s.hist.shift();

  // faillite : trésorerie sous le découvert autorisé trois mois de suite
  const overdraft = -Math.max(50000, revenue * 0.6);
  s.neg = s.cash < overdraft ? s.neg + 1 : 0;
  if (s.neg === 2) usineLog(s, '⚠ La banque menace de couper la ligne de crédit. Redresse la trésorerie !');
  if (s.neg >= 3) return usineEnd(s, 'faillite');
  if (s.age >= 67 || s.month >= 360) return usineEnd(s, 'retraite');
  return null;
}

function usineValue(s) {
  const e12 = s.ebitda12.reduce((a, b) => a + b, 0) * (12 / Math.max(1, s.ebitda12.length));
  return Math.max(0, s.cash - s.debt + s.equip * 0.6 + Math.max(0, e12) * 4);
}
function usineEnd(s, why) { s.over = why; return why; }

/* Événements aléatoires du mois */
function usinePickEvent(s) {
  if (s.month < 2) return null;
  for (const ev of shuffle([...USINE_EVENTS])) {
    if (ev.countries && !ev.countries.includes(s.cc)) continue;
    let p = ev.p;
    if (ev.id === 'breakdown') p *= 1 + (1 - s.machine) * 3;
    if (ev.id === 'accident') p *= 1.5 - s.safety;
    if (ev.id === 'strike') p *= 1.6 - s.morale;
    if (Math.random() < p) return ev;
  }
  return null;
}

function usineApply(s, eff) {
  const C = USINE_COUNTRIES[s.cc];
  const months = eff.months || 1;
  const timed = (k, v) => s.mods.push({ k, v, left: months });
  if (eff.energyMult) timed('energyMult', eff.energyMult);
  if (eff.capMult) timed('capMult', eff.capMult);
  if (eff.demand) timed('demand', eff.demand);
  if (eff.marketPrice) timed('marketPrice', eff.marketPrice);
  if (eff.matMult) timed('matMult', eff.matMult);
  if (eff.wageMult) timed('wageMult', eff.wageMult);
  if (eff.demandMarket) for (const [id, v] of Object.entries(eff.demandMarket)) timed('dm_' + id, v);
  if (eff.energyFix) s.energyFix = { v: eff.energyFix, left: months };
  if (eff.cash) s.cash += Math.sign(eff.cash) * scaled(s, Math.abs(eff.cash));
  if (eff.cashRevenueMonths && s.last) s.cash += eff.cashRevenueMonths * s.last.revenue;
  if (eff.price) s.priceIdx *= 1 + eff.price;
  if (eff.wage) s.wageIdx *= 1 + eff.wage;
  if (eff.quality) s.scrap = Math.max(0.01, s.scrap - eff.quality);
  if (eff.reputation) s.reputation = clamp(s.reputation + eff.reputation, 0, 1);
  if (eff.morale) s.morale = clamp(s.morale + eff.morale, 0, 1);
  if (eff.safety) s.safety = clamp(s.safety + eff.safety, 0, 1);
  if (eff.diversify) s.diversify += eff.diversify;
  if (eff.hire) { s.employees += eff.hire; if (eff.wageExtra) s.extraWage += C.labour * C.hours / 12 * (eff.wageExtra - 1) * eff.hire; }
  if (eff.envDeadline) s.envDeadline = s.envOk ? null : eff.envDeadline;
  if (eff.taxAudit) s.taxAudit = true;
  if (eff.subsidy) s.subsidy = months;
  if (eff.hireBlock) s.hireBlock = eff.hireBlock;
}

/* ---------------- Jeu (dans l'écran de la borne) ---------------- */
function runUsine(stage, api) {
  let s = null, speed = 1, timer = 0, lastTick = 0, alive = true, paused = false;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(USINE_KEY)); } catch (e) { /* stockage indisponible */ }
  const persistGame = () => { try { if (s && !s.over) localStorage.setItem(USINE_KEY, JSON.stringify(s)); else localStorage.removeItem(USINE_KEY); } catch (e) { /* ignore */ } };
  $('#hudScoreWrap').hidden = true;

  /* --- écran 1 : choix du métier --- */
  function choose() {
    stage.innerHTML = `<div class="screen usine-start">
      <h4>Usine 101</h4>
      <p>Comme dans <em>1 sur 8 milliards</em>, tu ne choisis presque rien : seulement ton métier. Le pays, la ville et ton capital seront tirés au sort selon la vraie répartition mondiale de la production.</p>
      <div class="usine-pick">
        <button class="usine-type" data-t="fonderie"><b>🔥 Fonderie</b><span>Tu fonds le métal et tu le coules dans des moules.</span></button>
        <button class="usine-type" data-t="forge"><b>🔨 Forge</b><span>Tu chauffes l'acier et tu le mets en forme sous la presse.</span></button>
      </div>
      ${saved && !saved.over ? `<button class="btn btn-ghost" id="usineResume">Reprendre ${esc(saved.name)} (${usineDate(saved)})</button>` : ''}
      <button class="linkish" id="usineSources">Sources et hypothèses des chiffres</button>
    </div>`;
    stage.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => draw(b.dataset.t)));
    const rs = $('#usineResume', stage); if (rs) rs.addEventListener('click', () => { s = saved; play(); });
    $('#usineSources', stage).addEventListener('click', () => sources(choose));
  }

  /* --- écran 2 : tirage au sort animé --- */
  function draw(type) {
    const ccs = Object.keys(USINE_COUNTRIES);
    stage.innerHTML = `<div class="screen"><span class="kicker" style="margin:0">Tirage au sort</span><div class="usine-roll" id="roll">${flagImg('fr', 120)}</div><p id="rollTxt">Le monde compte plus de 45 000 fonderies et des milliers de forges…</p></div>`;
    let n = 0;
    const id = setInterval(() => {
      if (!alive) { clearInterval(id); return; }
      $('#roll', stage).innerHTML = flagImg(ccs[n++ % ccs.length], 120);
      SFX.tick();
      if (n > 22) { clearInterval(id); s = usineDraw(type); reveal(); }
    }, 90);
  }

  /* --- écran 3 : fiche de départ --- */
  function reveal() {
    const C = USINE_COUNTRIES[s.cc];
    SFX.win();
    stage.innerHTML = `<div class="usine-card">
      <div class="usine-flag">${flagImg(s.cc, 96)}</div>
      <div>
        <span class="kicker" style="margin:0">Tu reprends</span>
        <h4>${esc(s.name)}</h4>
        <p class="muted">${esc(s.city)}, ${esc(s.region)} — ${esc(C.name)} · ${esc(C.admin.form)}</p>
        <p class="usine-note">${esc(s.cityNote)}</p>
      </div>
      <dl class="usine-facts">
        <div><dt>Capital de départ (trésorerie)</dt><dd>${fmtEur(s.cash)} <small>${fmtLocal(s.cash, C, s)}</small></dd></div>
        <div><dt>Dette bancaire</dt><dd>${fmtEur(s.debt)} <small>à ${pct(s.rate)}</small></dd></div>
        <div><dt>Salariés</dt><dd>${s.employees}</dd></div>
        <div><dt>Capacité</dt><dd>${Math.round(s.capacity * 12)} t/an</dd></div>
        <div><dt>Concurrents dans le bassin</dt><dd>≈ ${s.competitors} <small>(${C.competitors[s.type]} dans le pays)</small></dd></div>
        <div><dt>Prix de vente moyen</dt><dd>${C.price[s.type].toFixed(2).replace('.', ',')} €/kg</dd></div>
        <div><dt>Coût du travail</dt><dd>${C.labour.toString().replace('.', ',')} €/h · ${C.week} h/sem.</dd></div>
        <div><dt>Électricité · gaz</dt><dd>${C.elec} · ${C.gas} €/MWh</dd></div>
        <div><dt>Impôt sur les sociétés</dt><dd>${pct(C.tax)}</dd></div>
        <div><dt>Ton âge</dt><dd>${s.age} ans</dd></div>
      </dl>
      <div class="usine-admin"><b>Administration :</b> ${esc(C.admin.env)} · ${esc(C.admin.social)}. ${esc(C.admin.note)}</div>
      <div class="end-actions"><button class="btn btn-hot" id="usineGo">Prendre les commandes</button><button class="btn btn-ghost" id="usineSrc">Sources</button></div>
    </div>`;
    $('#usineGo', stage).addEventListener('click', play);
    $('#usineSrc', stage).addEventListener('click', () => sources(reveal));
  }

  function sources(back) {
    stage.innerHTML = `<div class="usine-sources">
      <h4>Sources et hypothèses</h4>
      <p class="muted small">Les chiffres viennent de ces sources (consultées en octobre 2026). Quand une donnée n'existait pas pour un pays ou une ville (nombre exact de concurrents, coût du travail hors UE, etc.), elle est estimée à partir des sources les plus proches. Les pays sont tirés au sort en proportion de leur production réelle : la Chine pèse à elle seule environ la moitié des pièces de fonderie du monde.</p>
      <ol>${USINE_SOURCES.map(x => `<li><a href="${x.url}" target="_blank" rel="noopener">${esc(x.label)}</a></li>`).join('')}</ol>
      <button class="btn btn-hot" id="srcBack">Retour</button>
    </div>`;
    $('#srcBack', stage).addEventListener('click', back);
  }

  /* --- écran de jeu --- */
  function play() {
    const C = USINE_COUNTRIES[s.cc];
    api.info(`${s.city}, ${C.name}`);
    stage.innerHTML = `<div class="usine">
      <header class="u-top">
        <div><b>${esc(s.name)}</b><span class="muted"> · ${flagImg(s.cc, 22)} ${esc(s.city)}, ${esc(C.name)}</span></div>
        <div class="u-date" id="uDate"></div>
        <div class="u-speed" id="uSpeed">${['⏸', '▶', '▶▶', '▶▶▶'].map((t, i) => `<button data-sp="${i}">${t}</button>`).join('')}</div>
      </header>
      <section class="u-kpis" id="uKpis"></section>
      <section class="u-mid">
        <canvas id="uChart" width="520" height="150"></canvas>
        <div class="u-costs" id="uCosts"></div>
      </section>
      <section class="u-actions">
        <div class="u-tabs" id="uTabs">${['Production', 'Équipe', 'Commercial', 'Finance', 'Investir', 'Journal'].map((t, i) => `<button data-tab="${i}" class="${i === 0 ? 'on' : ''}">${t}</button>`).join('')}</div>
        <div class="u-panel" id="uPanel"></div>
      </section>
      <div class="u-event" id="uEvent" hidden></div>
    </div>`;
    let tab = 0;
    stage.querySelectorAll('[data-sp]').forEach(b => b.addEventListener('click', () => { speed = +b.dataset.sp; paint(); }));
    stage.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { tab = +b.dataset.tab; stage.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x === b)); panel(); }));

    function act(fn, msg) { fn(); if (msg) usineLog(s, msg); SFX.tick(); paint(); panel(); persistGame(); }
    function monthlyWage() { return C.labour * C.hours / 12 * s.wageIdx; }
    function panel() {
      const P = $('#uPanel', stage);
      const btn = (id, label, dis = false) => `<button class="btn btn-sm ${dis ? '' : 'btn-hot'}" data-a="${id}" ${dis ? 'disabled' : ''}>${label}</button>`;
      const inv = USINE_INVEST[s.type];
      const priceK = C.price[s.type] / USINE_COUNTRIES.FR.price[s.type];
      const sub = s.subsidy > 0 ? 0.4 : 0;
      if (tab === 0) {
        P.innerHTML = `<p>Entretien des machines : <b>${['minimal', 'normal', 'renforcé'][s.maint]}</b> (état ${Math.round(s.machine * 100)} %)</p>
          <div class="u-row">${btn('m0', 'Minimal', s.maint === 0)}${btn('m1', 'Normal', s.maint === 1)}${btn('m2', 'Renforcé', s.maint === 2)}</div>
          <p class="muted small">Un entretien minimal économise de l'argent mais use les machines : pannes et rebuts augmentent.</p>
          <p>Sécurité : <b>${Math.round(s.safety * 100)} %</b> ${btn('safety', `Former les équipes (${fmtEur(scaled(s, 25000))})`)}</p>
          <p>Environnement : <b>${s.envOk ? '✔ conforme' : '✖ non conforme'}</b>${s.envDeadline !== null ? ` · échéance dans ${s.envDeadline} mois` : ''}${s.envFine ? ' · <b class="bad">production bridée</b>' : ''}</p>`;
      } else if (tab === 1) {
        const sevCost = C.sev * Math.min(15, s.seniority + s.month / 12) * monthlyWage();
        P.innerHTML = `<p>Effectif : <b>${s.employees}</b> · coût moyen ${fmtEur(monthlyWage())}/mois chargé · moral ${Math.round(s.morale * 100)} %</p>
          <div class="u-row">${btn('hire1', 'Embaucher 1', s.hireBlock > 0)}${btn('hire5', 'Embaucher 5', s.hireBlock > 0)}${btn('fire1', 'Licencier 1', s.employees <= 3)}${btn('fire5', 'Licencier 5', s.employees <= 7)}</div>
          <p class="muted small">Recrutement : 1 mois de salaire. Licenciement : ≈ ${fmtEur(sevCost)} par personne (${C.sev} mois de salaire par année d'ancienneté en ${C.name}).${s.hireBlock > 0 ? ' Pénurie de main-d\'œuvre : aucune embauche possible pour l\'instant.' : ''}</p>
          <div class="u-row">${btn('raise', 'Augmenter les salaires de 2 %')}</div>`;
      } else if (tab === 2) {
        const l = s.last || {};
        P.innerHTML = `<p>Ton prix : <b>${(s.priceIdx * 100).toFixed(0)} %</b> du prix du marché (≈ ${((l.price || C.price[s.type] * 1000) / 1000).toFixed(2).replace('.', ',')} €/kg)</p>
          <div class="u-row">${btn('pdown', 'Baisser de 5 %')}${btn('pup', 'Augmenter de 5 %')}</div>
          <p class="muted small">Le marché réagit fortement : +5 % de prix ≈ -10 % de commandes. Ta réputation (${Math.round(s.reputation * 100)} %) dépend des délais tenus et de la qualité.</p>
          <div class="u-row">${btn('prospect', `Campagne de prospection (${fmtEur(scaled(s, 30000))})`)}</div>
          <p class="muted small">Clients : ${USINE_MARKETS[s.type].map(m => `${m.name} ${Math.round(m.share * 100)} %`).join(' · ')}</p>`;
      } else if (tab === 3) {
        const e12 = s.ebitda12.reduce((a, b) => a + b, 0) * 12 / Math.max(1, s.ebitda12.length);
        const canBorrow = s.debt < Math.max(200000, e12 * 4) && s.reputation > 0.3;
        P.innerHTML = `<p>Dette : <b>${fmtEur(s.debt)}</b> à ${pct(s.rate)} (taux du crédit aux PME en ${C.name})</p>
          <div class="u-row">${btn('loan1', 'Emprunter 100 k€', !canBorrow)}${btn('loan5', 'Emprunter 500 k€', !canBorrow)}${btn('repay', 'Rembourser 100 k€', s.debt < 1000 || s.cash < 100000)}</div>
          <p class="muted small">La banque prête tant que ta dette reste sous 4 fois ton excédent brut d'exploitation annuel. Dernier impôt sur les sociétés : ${fmtEur(s.lastTax)}.</p>
          <p>Valeur estimée de l'entreprise : <b>${fmtEur(usineValue(s))}</b></p>
          <div class="u-row"><button class="btn btn-sm btn-ghost" data-a="sell">Vendre l'entreprise et partir à la retraite</button></div>`;
      } else if (tab === 4) {
        P.innerHTML = `${sub ? '<p class="good">Aide à la décarbonation active : 40 % de l\'investissement pris en charge.</p>' : ''}<div class="u-inv">${inv.map(it => {
          const cost = it.cost * Math.max(0.45, priceK) * clamp(s.capacity * 12 / 1500, 0.25, 3) * (1 - sub);
          const done = s.invest.includes(it.id);
          return `<div class="u-inv-item"><b>${esc(it.name)}</b><span>${esc(it.desc)}</span><em>${fmtEur(cost)}</em>${done ? '<span class="good">✔ installé</span>' : `<button class="btn btn-sm btn-hot" data-inv="${it.id}" ${s.cash < cost * 0.3 ? 'disabled' : ''}>Investir</button>`}</div>`;
        }).join('')}</div><p class="muted small">Un investissement est payé à 30 % comptant, le reste est financé par un prêt bancaire sur 7 ans.</p>`;
        P.querySelectorAll('[data-inv]').forEach(b => b.addEventListener('click', () => {
          const it = inv.find(x => x.id === b.dataset.inv);
          const cost = it.cost * Math.max(0.45, priceK) * clamp(s.capacity * 12 / 1500, 0.25, 3) * (1 - sub);
          act(() => {
            s.cash -= cost * 0.3; s.debt += cost * 0.7; s.debtStart = Math.max(s.debtStart, s.debt); s.equip += cost;
            if (it.cap) { s.capacity *= 1 + it.cap; s.baseDemand *= 1 + it.cap * 0.5; }
            if (it.prodBoost) s.prodIdx *= 1 + it.prodBoost;
            if (it.energy) s.energyEff *= 1 + it.energy;
            if (it.quality) s.scrap = Math.max(0.01, s.scrap - it.quality);
            if (it.priceBoost) s.priceBoost += it.priceBoost;
            if (it.env) { s.envOk = true; s.envFine = false; }
            s.invest.push(it.id);
          }, `Investissement : ${it.name} (${fmtEur(cost)}).`);
        }));
        return;
      } else {
        P.innerHTML = `<ol class="u-log">${s.log.map(l => `<li><span>${esc(l.d)}</span>${esc(l.msg)}</li>`).join('')}</ol>`;
        return;
      }
      P.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => {
        const a = b.dataset.a, w = monthlyWage();
        const sevCost = C.sev * Math.min(15, s.seniority + s.month / 12) * w;
        const actions = {
          m0: () => act(() => { s.maint = 0; }, 'Entretien réduit au minimum.'),
          m1: () => act(() => { s.maint = 1; }, 'Entretien normal.'),
          m2: () => act(() => { s.maint = 2; }, 'Entretien renforcé.'),
          safety: () => act(() => { s.cash -= scaled(s, 25000); s.safety = clamp(s.safety + 0.15, 0, 1); }, 'Formation sécurité des équipes.'),
          hire1: () => act(() => { s.employees += 1; s.cash -= w; }, 'Embauche d\'un salarié.'),
          hire5: () => act(() => { s.employees += 5; s.cash -= 5 * w; }, 'Embauche de 5 salariés.'),
          fire1: () => act(() => { s.employees -= 1; s.cash -= sevCost; s.morale -= 0.03; }, `Licenciement d'un salarié (${fmtEur(sevCost)}).`),
          fire5: () => act(() => { s.employees -= 5; s.cash -= 5 * sevCost * (s.cc === 'FR' ? 1.3 : 1); s.morale -= 0.12; s.reputation -= 0.02; }, `Licenciement de 5 salariés (${fmtEur(5 * sevCost)}).`),
          raise: () => act(() => { s.wageIdx *= 1.02; s.morale = clamp(s.morale + 0.06, 0, 1); }, 'Augmentation générale de 2 %.'),
          pdown: () => act(() => { s.priceIdx *= 0.95; }, 'Baisse des prix de 5 %.'),
          pup: () => act(() => { s.priceIdx *= 1.05; }, 'Hausse des prix de 5 %.'),
          prospect: () => act(() => { s.cash -= scaled(s, 30000); s.diversify += 0.03; s.reputation = clamp(s.reputation + 0.02, 0, 1); }, 'Campagne de prospection commerciale.'),
          loan1: () => act(() => { s.cash += 100000; s.debt += 100000; s.debtStart = Math.max(s.debtStart, s.debt); }, 'Nouvel emprunt de 100 k€.'),
          loan5: () => act(() => { s.cash += 500000; s.debt += 500000; s.debtStart = Math.max(s.debtStart, s.debt); }, 'Nouvel emprunt de 500 k€.'),
          repay: () => act(() => { const r = Math.min(100000, s.debt); s.cash -= r; s.debt -= r; }, 'Remboursement anticipé.'),
          sell: () => { usineEnd(s, 'vente'); finish(); },
        };
        if (actions[a]) actions[a]();
      }));
    }

    function paint() {
      const l = s.last;
      $('#uDate', stage).textContent = `${usineDate(s)} · ${s.age} ans · année ${Math.floor(s.month / 12) + 1}`;
      stage.querySelectorAll('[data-sp]').forEach(b => b.classList.toggle('on', +b.dataset.sp === speed));
      const res = l ? l.ebitda - s.equip / 120 - l.interest : 0;
      const kp = [
        ['Trésorerie', fmtEur(s.cash), s.cash < 0 ? 'bad' : '', fmtLocal(s.cash, C, s)],
        ['Chiffre d\'affaires (mois)', l ? fmtEur(l.revenue) : '—', ''],
        ['Résultat (mois)', l ? fmtEur(res) : '—', res < 0 ? 'bad' : 'good'],
        ['Commandes / production', l ? `${Math.round(l.demand)} / ${Math.round(l.sold)} t` : '—', l && l.service < 0.9 ? 'bad' : ''],
        ['Salariés', s.employees, ''],
        ['Rebuts', pct(s.scrap), s.scrap > 0.1 ? 'bad' : ''],
        ['Réputation', `${Math.round(s.reputation * 100)} %`, ''],
        ['Machines', `${Math.round(s.machine * 100)} %`, s.machine < 0.45 ? 'bad' : ''],
      ];
      $('#uKpis', stage).innerHTML = kp.map(([k, v, c, sub]) => `<div class="u-kpi"><span>${k}</span><b class="${c}">${v}</b>${sub ? `<small>${sub}</small>` : ''}</div>`).join('');
      if (l) {
        const parts = [['Matières', l.materials, '#8A8D91'], ['Énergie', l.energy, '#F5B700'], ['Salaires', l.labour, '#EC641E'], ['Frais généraux', l.overhead + l.maintenance, '#5AA8FF'], ['Intérêts', l.interest, '#BA2C3A']];
        const tot = parts.reduce((a, p) => a + p[1], 0) || 1;
        $('#uCosts', stage).innerHTML = `<div class="u-bar">${parts.map(p => `<i style="width:${p[1] / tot * 100}%;background:${p[2]}" title="${p[0]}"></i>`).join('')}</div>
          <div class="u-legend">${parts.map(p => `<span><i style="background:${p[2]}"></i>${p[0]} ${fmtEur(p[1])}</span>`).join('')}</div>`;
      }
      // courbe de trésorerie
      const cv = $('#uChart', stage), g = cv.getContext('2d');
      g.clearRect(0, 0, cv.width, cv.height);
      const H = s.hist;
      if (H.length > 1) {
        const vals = H.map(h => h.cash);
        const mn = Math.min(0, ...vals), mx = Math.max(1, ...vals);
        const y = v => 140 - (v - mn) / (mx - mn) * 125;
        g.strokeStyle = 'rgba(255,255,255,.15)'; g.beginPath(); g.moveTo(0, y(0)); g.lineTo(cv.width, y(0)); g.stroke();
        g.strokeStyle = '#F5B700'; g.lineWidth = 2; g.beginPath();
        H.forEach((h, i) => { const x = i / (H.length - 1) * (cv.width - 4) + 2; i ? g.lineTo(x, y(h.cash)) : g.moveTo(x, y(h.cash)); });
        g.stroke();
        g.fillStyle = '#9aa0a6'; g.font = '11px Archivo, sans-serif'; g.fillText(`Trésorerie sur ${H.length} mois`, 6, 14);
      }
    }

    function showEvent(ev) {
      paused = true;
      const box = $('#uEvent', stage);
      box.hidden = false;
      box.innerHTML = `<div class="u-event-card"><span class="kicker" style="margin:0">${usineDate(s)}</span><h4>${esc(ev.title)}</h4><p>${esc(scaleLabel(s, ev.text))}</p>
        <div class="u-choices">${ev.choices.map((c, i) => `<button class="btn btn-sm ${i === 0 ? 'btn-hot' : 'btn-ghost'}" data-c="${i}">${esc(scaleLabel(s, c.label))}</button>`).join('')}</div></div>`;
      sfx(520, 0.15, 'triangle', 0.05);
      box.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => {
        const ch = ev.choices[+b.dataset.c];
        usineApply(s, ev.effect);
        usineApply(s, ch.act);
        usineLog(s, `${ev.title} — ${scaleLabel(s, ch.label)}`);
        s.events++;
        box.hidden = true; paused = false;
        paint(); panel(); persistGame();
      }));
    }

    paint(); panel();
    const stop = loop((dt, t) => {
      if (!alive) return false;
      if (paused || speed === 0 || s.over) return;
      if (!lastTick) lastTick = t;
      if (t - lastTick >= SPEEDS_MS[speed]) {
        lastTick = t;
        const end = usineStep(s);
        if (end) { finish(); return false; }
        const ev = usinePickEvent(s);
        paint(); if (tab === 5 || tab === 3) panel();
        if (ev) showEvent(ev);
        if (s.month % 6 === 0) persistGame();
      }
    });
    timer = stop;
  }

  async function finish() {
    if (timer) timer();
    persistGame();
    const C = USINE_COUNTRIES[s.cc];
    const value = usineValue(s);
    const created = s.over === 'faillite' ? 0 : Math.max(0, value - (s.startValue || 0));
    const years = (s.month / 12).toFixed(1).replace('.', ',');
    const why = { faillite: 'Faillite', retraite: 'Retraite bien méritée', vente: 'Entreprise vendue' }[s.over] || 'Fin';
    stage.innerHTML = `<div class="screen">
      <span class="kicker" style="margin:0">${why} · ${usineDate(s)}</span>
      <h4>${esc(s.name)}</h4>
      <p>${flagImg(s.cc, 22)} ${esc(s.city)}, ${esc(C.name)} · ${years} ans de gestion · ${s.events} événements traversés</p>
      <div class="big-score">${s.over === 'faillite' ? '0 €' : fmtEur(value)}</div>
      <p class="muted">${s.over === 'faillite' ? 'Le tribunal de commerce a prononcé la liquidation.' : `Valeur de l'entreprise à ta sortie, contre ${fmtEur(s.startValue || 0)} à la reprise. Valeur créée : <b>${fmtEur(created)}</b> (c'est ton score au classement).`}</p>
      <div class="ticket-box" id="uTicket">Envoi du résultat…</div>
      <div class="end-actions"><button class="btn btn-hot" data-go="again">Nouvelle vie d'entrepreneur</button><button class="btn btn-ghost" data-go="back">Menu</button></div>
    </div>`;
    bindEndButtons(stage);
    const score = Math.round(created / 1000);   // en k€ de valeur créée
    if (score > (save.best.usine || 0)) { save.best.usine = score; persist(); }
    try {
      const r = await apiCall('/api/score', { game: 'usine', score, months: s.month });
      const box = $('#uTicket', stage);
      if (box) { box.textContent = (r.ticket ? '🎟️ ' : '') + r.message; box.classList.toggle('won', !!r.ticket); }
      if (r.ticket) { SFX.win(); toast('🎟️ Ticket à gratter gagné !'); }
    } catch (e) { const box = $('#uTicket', stage); if (box) box.textContent = 'Serveur injoignable : résultat non envoyé.'; }
    s = null;
  }

  choose();
  return () => { alive = false; if (timer) timer(); persistGame(); };
}

GAMES.push({
  id: 'usine', title: 'Usine 101', teinte: 'laiton', product: 'capuche',
  pitch: 'Reprends une forge ou une fonderie quelque part dans le monde et fais-la tourner jusqu\'à la retraite. Prix, salaires et énergie réels.',
  how: 'Choisis <b>forge</b> ou <b>fonderie</b>, le hasard fait le reste. Le temps défile tout seul : gère prix, équipe, entretien, dettes et investissements. Tiens <b>5 ans</b> sans faillite pour gagner un ticket.',
  run: runUsine,
});
