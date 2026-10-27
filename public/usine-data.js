/* Usine 101 — données réelles (ou estimées à partir de sources réelles) utilisées par le jeu de gestion.
   Chaque valeur « est. » est une estimation calibrée sur les sources listées dans USINE_SOURCES.
   Monnaie de calcul : euro. Taux de change indicatifs, octobre 2026. */
'use strict';

const USINE_SOURCES = [
  { id: 'ff', label: 'Fédération Forge Fonderie — chiffres clés France 2025 (CA, effectifs, tonnages, sites)', url: 'https://www.forgefonderie.org/en/forging-casting/economic-overview' },
  { id: 'cn', label: 'China Foundry Association via Dawang Metals — production chinoise 2023 : 51,9 Mt', url: 'https://dawangmetals.com/industry/2023-china-foundry-industry-data-released/' },
  { id: 'wfo', label: 'Modern Casting / WFO — recensement mondial (Inde 11,5 Mt, USA 11,3 Mt, Japon 5,3 Mt, Allemagne 5,0 Mt en 2019)', url: 'https://www.qgdigitalpublishing.com/publication/?i=687958&article_id=3844717&view=articleBrowser' },
  { id: 'eff', label: 'EFF (CAEF) — fonderie européenne 2024 : 12,6 Mt, 4 000 sites, 200 000 emplois', url: 'https://eff-eu.org/statistics/' },
  { id: 'pan', label: 'Archives of Foundry Engineering — production 2024 des 5 plus grands pays', url: 'https://journals.pan.pl/Content/138677' },
  { id: 'elec', label: 'Eurostat — électricité non domestique S2 2025 (UE 0,184 €/kWh ; Allemagne 0,226)', url: 'https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20260508-2' },
  { id: 'gas', label: 'Eurostat — gaz non domestique S2 2025 (UE 6,05 c€/kWh ; Allemagne 7,13)', url: 'https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20260508-3' },
  { id: 'eia', label: 'EIA — prix industriel américain de l\'électricité (≈ 8,6 c$/kWh en 2025)', url: 'https://www.eia.gov/electricity/monthly/epm_table_grapher.php?t=epmt_5_6_a' },
  { id: 'elecw', label: 'Comparatifs prix industriels électricité hors UE (Chine ≈ 0,10 $/kWh, Japon 0,20, Turquie ≈ 0,09-0,12)', url: 'https://www.rhnuttall.co.uk/blog/industrial-electricity-prices-by-country/' },
  { id: 'lc', label: 'Eurostat — coût horaire de la main-d\'œuvre 2025 (UE 34,9 €, industrie zone euro 40,3 €)', url: 'https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Hourly_labour_costs' },
  { id: 'wages', label: 'Tetakawi — coût horaire usine Chine ≈ 6,69 $, Mexique ≈ 5,56 $ (2024-2026)', url: 'https://insights.tetakawi.com/manufacturing-wages-mexico-vs-china' },
  { id: 'smic', label: 'Eurostat — salaires minimums janvier 2026 (France 1 823 €, Allemagne 2 343 €, Espagne 1 381 €…)', url: 'https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20260130-2' },
  { id: 'tax', label: 'Tax Foundation — taux d\'impôt sur les sociétés 2025', url: 'https://taxfoundation.org/data/all/global/corporate-tax-rates-by-country-2025/' },
  { id: 'alu', label: 'Trading Economics — aluminium LME 3 047 $/t (23/10/2026)', url: 'https://tradingeconomics.com/commodity/aluminum' },
  { id: 'scrap', label: 'Ferraille HMS 1&2 : 394 $/t CFR Turquie, 356 $/t FOB Rotterdam (oct. 2026)', url: 'https://iscrapapp.com/metals/1-hms/' },
  { id: 'gi', label: 'IMARC — fonte grise : Allemagne ≈ 3 291 $/t, France ≈ 2 926 $/t (déc. 2025)', url: 'https://www.imarcgroup.com/grey-cast-iron-pricing-report' },
  { id: 'kwh', label: 'Fusion par induction : 500-650 kWh/t (Foundry Planet, Archives of Foundry Engineering, norme indienne 620 kWh/t)', url: 'https://www.foundry-planet.com/d/saving-energy-when-melting-metals-in-induction-furnaces-through-practical-measures-and-by-analyzing-digital-melting-process-data/' },
  { id: 'steel', label: 'worldsteel — acier brut 2024 (Chine 1 005 Mt, Inde 149 Mt, Japon 84 Mt, USA 79,5 Mt, Allemagne 37,2 Mt)', url: 'https://worldsteel.org/data/world-steel-in-figures/world-steel-in-figures-2025/' },
];

/* Pays. weight = part de la production mondiale (pièces de fonderie / pièces forgées, Mt/an, est. à partir des sources).
   labour = coût horaire complet (salaire + charges) industrie, €/h. hours = heures annuelles travaillées par salarié.
   elec/gas = €/MWh industriel. price = prix moyen de vente €/kg (France : sourcé ; autres pays : est., calés sur une marge
   d'exploitation de 8 à 11 %, cohérente avec les prix observés). prod = t/salarié/an (France sourcée, autres est.). */
const USINE_COUNTRIES = {
  FR: { name: 'France', flag: '🇫🇷', cur: 'EUR', fx: 1, weight: { fonderie: 1.28, forge: 0.44 }, competitors: { fonderie: 330, forge: 73 },
    labour: 46, hours: 1600, minWage: 1823, social: 0.42, elec: 125, gas: 55, tax: 0.25, rate: 0.042, infl: 0.015,
    price: { fonderie: 4.31, forge: 4.22 }, prod: { fonderie: 44.7, forge: 58.9 }, sev: 0.25, week: 35,
    admin: { form: 'SAS', env: 'Autorisation ICPE (DREAL)', social: 'URSSAF', note: '35 h/semaine, indemnité légale de licenciement = 1/4 de mois par année d\'ancienneté.' },
    cities: [
      { name: 'Charleville-Mézières', region: 'Ardennes', base: { fonderie: 18, forge: 9 }, note: 'Bassin historique de la fonderie et de la forge ardennaise (automobile, poids lourds).' },
      { name: 'Saint-Dizier', region: 'Haute-Marne', base: { fonderie: 9, forge: 3 }, note: 'Tradition de fonderie d\'art et de fonte de voirie.' },
      { name: 'Le Creusot', region: 'Saône-et-Loire', base: { fonderie: 5, forge: 6 }, note: 'Grosses forges historiques (énergie, ferroviaire).' },
      { name: 'Thiers', region: 'Puy-de-Dôme', base: { fonderie: 2, forge: 10 }, note: 'Capitale de la coutellerie, nombreuses petites forges.' },
      { name: 'Châlons-en-Champagne', region: 'Marne', base: { fonderie: 4, forge: 2 }, note: 'Ville de l\'ESFF : accès direct aux jeunes ingénieurs fondeurs.' },
    ] },
  DE: { name: 'Allemagne', flag: '🇩🇪', cur: 'EUR', fx: 1, weight: { fonderie: 3.8, forge: 2.4 }, competitors: { fonderie: 550, forge: 230 },
    labour: 48, hours: 1650, minWage: 2343, social: 0.21, elec: 226, gas: 71, tax: 0.299, rate: 0.045, infl: 0.022,
    price: { fonderie: 4.12, forge: 4.04 }, prod: { fonderie: 58, forge: 72 }, sev: 0.5, week: 38,
    admin: { form: 'GmbH', env: 'Genehmigung nach BImSchG', social: 'Berufsgenossenschaft Holz und Metall', note: 'Convention collective de la métallurgie (IG Metall), forte prise en compte du conseil d\'entreprise.' },
    cities: [
      { name: 'Hagen', region: 'Rhénanie-du-Nord-Westphalie', base: { fonderie: 14, forge: 30 }, note: 'Sauerland : premier bassin de forgeage à chaud d\'Europe.' },
      { name: 'Duisburg', region: 'Rhénanie-du-Nord-Westphalie', base: { fonderie: 20, forge: 8 }, note: 'Sidérurgie de la Ruhr, clients acier et machines.' },
      { name: 'Stuttgart', region: 'Bade-Wurtemberg', base: { fonderie: 25, forge: 15 }, note: 'Automobile premium et équipementiers.' },
    ] },
  IT: { name: 'Italie', flag: '🇮🇹', cur: 'EUR', fx: 1, weight: { fonderie: 1.8, forge: 1.0 }, competitors: { fonderie: 950, forge: 300 },
    labour: 32, hours: 1700, minWage: null, social: 0.30, elec: 215, gas: 58, tax: 0.279, rate: 0.05, infl: 0.018,
    price: { fonderie: 3.63, forge: 3.63 }, prod: { fonderie: 46, forge: 55 }, sev: 0.6, week: 40,
    admin: { form: 'S.r.l.', env: 'Autorizzazione Integrata Ambientale (AIA)', social: 'INPS / INAIL', note: 'Pas de salaire minimum légal (conventions collectives). TFR versé au départ de chaque salarié.' },
    cities: [
      { name: 'Brescia', region: 'Lombardie', base: { fonderie: 60, forge: 25 }, note: 'Capitale italienne de la fonderie et de la robinetterie.' },
      { name: 'Lecco', region: 'Lombardie', base: { fonderie: 12, forge: 35 }, note: 'Forte concentration de forges et décolletage.' },
      { name: 'Turin', region: 'Piémont', base: { fonderie: 25, forge: 10 }, note: 'Automobile et aéronautique.' },
    ] },
  ES: { name: 'Espagne', flag: '🇪🇸', cur: 'EUR', fx: 1, weight: { fonderie: 1.1, forge: 0.5 }, competitors: { fonderie: 120, forge: 60 },
    labour: 27, hours: 1750, minWage: 1381, social: 0.31, elec: 140, gas: 50, tax: 0.25, rate: 0.045, infl: 0.025,
    price: { fonderie: 3.07, forge: 3.11 }, prod: { fonderie: 45, forge: 55 }, sev: 0.67, week: 40,
    admin: { form: 'S.L.', env: 'Autorización Ambiental Integrada (AAI)', social: 'Seguridad Social', note: 'Indemnité de licenciement : 20 à 33 jours par année d\'ancienneté.' },
    cities: [
      { name: 'Bilbao', region: 'Pays basque', base: { fonderie: 18, forge: 14 }, note: 'Bassin métallurgique basque, éolien et machine-outil.' },
      { name: 'Saragosse', region: 'Aragon', base: { fonderie: 8, forge: 4 }, note: 'Automobile (Stellantis Figueruelas).' },
    ] },
  PL: { name: 'Pologne', flag: '🇵🇱', cur: 'PLN', fx: 4.25, weight: { fonderie: 0.9, forge: 0.35 }, competitors: { fonderie: 400, forge: 90 },
    labour: 16, hours: 1850, minWage: 1139, social: 0.205, elec: 185, gas: 60, tax: 0.19, rate: 0.075, infl: 0.035,
    price: { fonderie: 2.63, forge: 2.5 }, prod: { fonderie: 36, forge: 45 }, sev: 0.15, week: 40,
    admin: { form: 'Sp. z o.o.', env: 'Pozwolenie zintegrowane', social: 'ZUS', note: 'Coûts salariaux en hausse rapide (+8 %/an ces dernières années, est.).' },
    cities: [
      { name: 'Katowice', region: 'Silésie', base: { fonderie: 35, forge: 10 }, note: 'Silésie industrielle, ancien cœur charbon-acier.' },
      { name: 'Wrocław', region: 'Basse-Silésie', base: { fonderie: 15, forge: 6 }, note: 'Équipementiers automobiles allemands.' },
    ] },
  CZ: { name: 'Tchéquie', flag: '🇨🇿', cur: 'CZK', fx: 24.4, weight: { fonderie: 0.3, forge: 0.25 }, competitors: { fonderie: 150, forge: 50 },
    labour: 19, hours: 1800, minWage: 924, social: 0.338, elec: 180, gas: 58, tax: 0.21, rate: 0.065, infl: 0.025,
    price: { fonderie: 2.7, forge: 2.9 }, prod: { fonderie: 40, forge: 48 }, sev: 0.25, week: 40,
    admin: { form: 's.r.o.', env: 'Integrované povolení (IPPC)', social: 'ČSSZ', note: 'Impôt sur les sociétés relevé de 19 % à 21 % en 2024.' },
    cities: [
      { name: 'Ostrava', region: 'Moravie-Silésie', base: { fonderie: 20, forge: 8 }, note: 'Sidérurgie et fonderies lourdes.' },
      { name: 'Brno', region: 'Moravie-du-Sud', base: { fonderie: 10, forge: 5 }, note: 'Machines et turbines.' },
    ] },
  TR: { name: 'Turquie', flag: '🇹🇷', cur: 'TRY', fx: 47, weight: { fonderie: 2.2, forge: 0.6 }, competitors: { fonderie: 1200, forge: 250 },
    labour: 7, hours: 2250, minWage: 654, social: 0.225, elec: 105, gas: 40, tax: 0.25, rate: 0.42, infl: 0.04, fxDrift: 0.25,
    price: { fonderie: 1.65, forge: 1.56 }, prod: { fonderie: 30, forge: 38 }, sev: 1.0, week: 45,
    admin: { form: 'Ltd. Şti.', env: 'Évaluation ÇED + permis d\'émission', social: 'SGK', note: 'Inflation très forte (≈ 30 %/an en livres, compensée par la chute de la livre face à l\'euro) : salaires et prix renégociés plusieurs fois par an. Kıdem tazminatı : 1 mois de salaire par année.' },
    cities: [
      { name: 'Bursa', region: 'Marmara', base: { fonderie: 90, forge: 20 }, note: 'Automobile (Renault, Fiat) et équipementiers.' },
      { name: 'Konya', region: 'Anatolie centrale', base: { fonderie: 120, forge: 15 }, note: 'Grand pôle de fonderie de pièces agricoles et automobiles.' },
      { name: 'Kocaeli', region: 'Marmara', base: { fonderie: 50, forge: 25 }, note: 'Zone industrielle de Gebze, sidérurgie.' },
    ] },
  IN: { name: 'Inde', flag: '🇮🇳', cur: 'INR', fx: 98, weight: { fonderie: 14, forge: 3.0 }, competitors: { fonderie: 5000, forge: 400 },
    labour: 1.6, hours: 2300, minWage: 110, social: 0.15, elec: 85, gas: 45, tax: 0.2517, rate: 0.10, infl: 0.04, fxDrift: 0.02,
    price: { fonderie: 0.88, forge: 1.05 }, prod: { fonderie: 15, forge: 14 }, sev: 0.5, week: 48,
    admin: { form: 'Private Limited (Pvt Ltd)', env: 'Consent to Operate (State Pollution Control Board)', social: 'EPF / ESIC', note: 'GST, coupures d\'électricité fréquentes selon l\'État, main-d\'œuvre abondante mais peu automatisée.' },
    cities: [
      { name: 'Rajkot', region: 'Gujarat', base: { fonderie: 500, forge: 60 }, note: 'Des centaines de petites fonderies (moteurs, pompes).' },
      { name: 'Kolhapur', region: 'Maharashtra', base: { fonderie: 300, forge: 20 }, note: 'Fonderies automobiles et tracteurs.' },
      { name: 'Pune', region: 'Maharashtra', base: { fonderie: 150, forge: 120 }, note: 'Pôle automobile, grandes forges.' },
      { name: 'Ludhiana', region: 'Pendjab', base: { fonderie: 120, forge: 150 }, note: 'Forgeage de pièces de vélos et machines agricoles.' },
    ] },
  CN: { name: 'Chine', flag: '🇨🇳', cur: 'CNY', fx: 8.0, weight: { fonderie: 51.9, forge: 12 }, competitors: { fonderie: 26000, forge: 3000 },
    labour: 6.0, hours: 2200, minWage: 330, social: 0.30, elec: 89, gas: 50, tax: 0.25, rate: 0.04, infl: 0.005,
    price: { fonderie: 1.61, forge: 1.65 }, prod: { fonderie: 25, forge: 30 }, sev: 1.0, week: 44,
    admin: { form: 'Société à responsabilité limitée (有限责任公司)', env: 'Étude d\'impact (环评) et permis de rejet', social: 'Assurances sociales (社保)', note: 'Quotas d\'énergie et fermetures environnementales imposées lors des pics de pollution.' },
    cities: [
      { name: 'Botou', region: 'Hebei', base: { fonderie: 1500, forge: 100 }, note: 'Surnommée « capitale chinoise de la fonderie ».' },
      { name: 'Weifang', region: 'Shandong', base: { fonderie: 600, forge: 200 }, note: 'Moteurs diesel et machines agricoles.' },
      { name: 'Ningbo', region: 'Zhejiang', base: { fonderie: 700, forge: 300 }, note: 'Port exportateur, moulage sous pression aluminium.' },
      { name: 'Changzhou', region: 'Jiangsu', base: { fonderie: 400, forge: 250 }, note: 'Pièces forgées pour l\'éolien et les machines.' },
    ] },
  US: { name: 'États-Unis', flag: '🇺🇸', cur: 'USD', fx: 1.12, weight: { fonderie: 10, forge: 2.2 }, competitors: { fonderie: 1750, forge: 300 },
    labour: 42, hours: 1900, minWage: 1150, social: 0.10, elec: 78, gas: 22, tax: 0.256, rate: 0.075, infl: 0.028,
    price: { fonderie: 3.83, forge: 3.93 }, prod: { fonderie: 56, forge: 70 }, sev: 0, week: 40,
    admin: { form: 'LLC', env: 'EPA NESHAP (sous-partie ZZZZZ, fonderies) + permis de l\'État', social: 'Sécurité sociale, assurance santé employeur', note: 'Licenciement « at will » sans indemnité légale, mais assurance santé coûteuse. Droits de douane variables.' },
    cities: [
      { name: 'Milwaukee', region: 'Wisconsin', base: { fonderie: 60, forge: 25 }, note: 'Fonderies historiques (machines, moteurs).' },
      { name: 'Birmingham', region: 'Alabama', base: { fonderie: 45, forge: 10 }, note: 'Tuyaux en fonte et canalisations.' },
      { name: 'Cleveland', region: 'Ohio', base: { fonderie: 50, forge: 35 }, note: 'Rust Belt : forges pour l\'automobile et l\'aéronautique.' },
    ] },
  MX: { name: 'Mexique', flag: '🇲🇽', cur: 'MXN', fx: 21, weight: { fonderie: 2.6, forge: 0.4 }, competitors: { fonderie: 1500, forge: 120 },
    labour: 5.0, hours: 2200, minWage: 400, social: 0.30, elec: 110, gas: 25, tax: 0.30, rate: 0.12, infl: 0.04, fxDrift: 0.01,
    price: { fonderie: 1.58, forge: 1.48 }, prod: { fonderie: 22, forge: 28 }, sev: 0.6, week: 48,
    admin: { form: 'S.A. de C.V.', env: 'Licencia Ambiental Única (SEMARNAT)', social: 'IMSS / INFONAVIT', note: 'Nearshoring vers les États-Unis : forte demande, mais dépendance aux droits de douane américains.' },
    cities: [
      { name: 'Monterrey', region: 'Nuevo León', base: { fonderie: 120, forge: 30 }, note: 'Cœur industriel du Mexique (Nemak, aciéries).' },
      { name: 'Saltillo', region: 'Coahuila', base: { fonderie: 60, forge: 15 }, note: 'Automobile et fonte pour moteurs.' },
    ] },
  BR: { name: 'Brésil', flag: '🇧🇷', cur: 'BRL', fx: 6.2, weight: { fonderie: 2.3, forge: 0.5 }, competitors: { fonderie: 1200, forge: 150 },
    labour: 7.5, hours: 2000, minWage: 260, social: 0.36, elec: 140, gas: 60, tax: 0.34, rate: 0.18, infl: 0.05, fxDrift: 0.03,
    price: { fonderie: 1.78, forge: 1.68 }, prod: { fonderie: 28, forge: 35 }, sev: 0.4, week: 44,
    admin: { form: 'Ltda.', env: 'Licença ambiental (ex. CETESB)', social: 'INSS / FGTS', note: 'Fiscalité complexe (ICMS, IPI, PIS/COFINS) et taux d\'intérêt très élevés.' },
    cities: [
      { name: 'Joinville', region: 'Santa Catarina', base: { fonderie: 50, forge: 15 }, note: 'Tupy, l\'un des plus grands fondeurs de fonte au monde.' },
      { name: 'Itaúna', region: 'Minas Gerais', base: { fonderie: 70, forge: 5 }, note: 'Pôle de fonderie du Minas Gerais.' },
      { name: 'Caxias do Sul', region: 'Rio Grande do Sul', base: { fonderie: 40, forge: 20 }, note: 'Poids lourds et machines agricoles.' },
    ] },
  JP: { name: 'Japon', flag: '🇯🇵', cur: 'JPY', fx: 172, weight: { fonderie: 5.0, forge: 2.3 }, competitors: { fonderie: 1800, forge: 400 },
    labour: 26, hours: 1900, minWage: 1100, social: 0.16, elec: 185, gas: 65, tax: 0.306, rate: 0.018, infl: 0.025,
    price: { fonderie: 3.33, forge: 3.3 }, prod: { fonderie: 45, forge: 55 }, sev: 0.8, week: 40,
    admin: { form: 'Kabushiki kaisha (株式会社)', env: 'Loi sur la pollution atmosphérique (大気汚染防止法)', social: 'Assurances sociales et accidents du travail (労災)', note: 'Main-d\'œuvre vieillissante : recrutement difficile, forte culture qualité (kaizen).' },
    cities: [
      { name: 'Kawaguchi', region: 'Saitama', base: { fonderie: 120, forge: 10 }, note: 'Ville historique de la fonte (« ville des fonderies »).' },
      { name: 'Toyota', region: 'Aichi', base: { fonderie: 80, forge: 60 }, note: 'Fournisseurs de rang 1 et 2 de l\'automobile.' },
      { name: 'Higashiosaka', region: 'Osaka', base: { fonderie: 40, forge: 50 }, note: 'Milliers de PME de mécanique.' },
    ] },
};

/* Matières et énergie (prix mondiaux, € ; oct. 2026) */
const USINE_MARKET = {
  scrap: 350,        // €/t ferraille HMS (394 $/t CFR Turquie ≈ 352 €/t)
  alu: 2720,         // €/t aluminium LME (3 047 $/t)
  steelBar: 820,     // €/t barre d'acier pour forge (est.)
  // consommation par tonne de pièces bonnes (est. à partir de 500-650 kWh/t de fusion + utilités)
  kwh: { fonderie: { elec: 1050, gas: 180 }, forge: { elec: 280, gas: 520 } },
  // part des matières dans le prix de vente (structure de coûts typique, est.) : métal + alliages + sable/liants pour la fonderie,
  // barres d'acier (rendement matière ≈ 80 %) pour la forge ; + achats divers (outillages, sous-traitance, transport)
  matShare: { fonderie: 0.30, forge: 0.45 },
  otherShare: 0.09,
};

/* Investissements possibles (prix Europe ; ajustés par l'indice de prix du pays) */
const USINE_INVEST = {
  fonderie: [
    { id: 'four', name: 'Four à induction moyenne fréquence 2 t', cost: 650000, cap: 0.18, energy: -0.08, desc: '+18 % de capacité, -8 % d\'énergie par tonne.' },
    { id: 'moulage', name: 'Ligne de moulage automatique', cost: 1800000, cap: 0.35, prodBoost: 0.25, desc: '+35 % de capacité, +25 % de productivité.' },
    { id: 'robot', name: 'Cellule robotisée d\'ébarbage', cost: 420000, prodBoost: 0.12, quality: 0.015, desc: '+12 % de productivité, rebuts en baisse.' },
    { id: 'filtre', name: 'Dépoussiérage et filtres neufs', cost: 300000, env: 1, desc: 'Mise en conformité environnementale.' },
    { id: 'sim', name: 'Logiciel de simulation de coulée', cost: 90000, quality: 0.02, desc: 'Moins de rebuts dès la conception.' },
    { id: 'pv', name: 'Toiture photovoltaïque 500 kWc', cost: 450000, energy: -0.05, desc: '-5 % sur la facture d\'électricité.' },
  ],
  forge: [
    { id: 'presse', name: 'Presse à vis 1 600 t', cost: 1200000, cap: 0.3, desc: '+30 % de capacité.' },
    { id: 'induction', name: 'Chauffe par induction (remplace le four gaz)', cost: 550000, energy: -0.15, env: 1, desc: '-15 % d\'énergie, moins de calamine.' },
    { id: 'robot', name: 'Robot de transfert sur presse', cost: 380000, prodBoost: 0.18, desc: '+18 % de productivité.' },
    { id: 'usinage', name: 'Centre d\'usinage (pièces finies)', cost: 700000, priceBoost: 0.12, desc: 'Vente de pièces usinées : +12 % de prix moyen.' },
    { id: 'cnd', name: 'Contrôle non destructif (ultrasons)', cost: 150000, quality: 0.02, desc: 'Accès aux marchés exigeants, moins de retours.' },
    { id: 'pv', name: 'Toiture photovoltaïque 500 kWc', cost: 450000, energy: -0.04, desc: '-4 % sur la facture d\'énergie.' },
  ],
};

/* Marchés clients (part du carnet de commandes) */
const USINE_MARKETS = {
  fonderie: [
    { id: 'auto', name: 'Automobile', share: 0.45, margin: 0.95, risk: 'ev' },
    { id: 'pl', name: 'Poids lourds et agricole', share: 0.2, margin: 1.0 },
    { id: 'machines', name: 'Machines et robinetterie', share: 0.2, margin: 1.05 },
    { id: 'energie', name: 'Énergie (éolien, nucléaire)', share: 0.1, margin: 1.15 },
    { id: 'btp', name: 'Voirie et bâtiment', share: 0.05, margin: 0.9 },
  ],
  forge: [
    { id: 'auto', name: 'Automobile', share: 0.5, margin: 0.95, risk: 'ev' },
    { id: 'aero', name: 'Aéronautique', share: 0.12, margin: 1.3 },
    { id: 'energie', name: 'Énergie et pétrole', share: 0.13, margin: 1.15 },
    { id: 'outils', name: 'Outillage et coutellerie', share: 0.1, margin: 1.1 },
    { id: 'rail', name: 'Ferroviaire et défense', share: 0.15, margin: 1.15 },
  ],
};

/* Événements. p = probabilité par mois ; countries = pays concernés (vide = tous) ; choices = décisions du joueur. */
const USINE_EVENTS = [
  { id: 'energy_spike', title: 'Flambée des prix de l\'énergie', p: 0.012, text: 'Les prix de gros de l\'électricité et du gaz s\'envolent, comme en 2022.',
    effect: { energyMult: 1.8, months: 8 },
    choices: [{ label: 'Encaisser', act: {} }, { label: 'Signer un contrat à prix fixe (+15 % sur 2 ans)', act: { energyFix: 1.15, months: 24 } }, { label: 'Réduire la production la nuit (-10 % de capacité)', act: { capMult: 0.9, energyMult: 0.85, months: 8 } }] },
  { id: 'auto_crisis', title: 'Crise de l\'automobile', p: 0.01, text: 'Les constructeurs réduisent leurs cadences : -30 % de commandes automobiles.',
    effect: { demandMarket: { auto: 0.7 }, months: 12 },
    choices: [{ label: 'Prospecter d\'autres secteurs (40 k€)', act: { cash: -40000, diversify: 0.08 } }, { label: 'Baisser les prix de 5 %', act: { price: -0.05 } }, { label: 'Attendre', act: {} }] },
  { id: 'ev_shift', title: 'Bascule vers l\'électrique', p: 0.006, text: 'Un client arrête ses carters moteur thermiques. Les pièces de châssis électriques demandent un nouvel outillage.',
    effect: { demandMarket: { auto: 0.85 }, months: 999 },
    choices: [{ label: 'Investir dans l\'outillage (150 k€)', act: { cash: -150000, demandMarket: { auto: 1.15 }, months: 999 } }, { label: 'Abandonner ce client', act: {} }] },
  { id: 'big_order', title: 'Grosse commande', p: 0.015, text: 'Un donneur d\'ordres vous propose un contrat de 2 ans, payé à 60 jours.',
    effect: {}, choices: [{ label: 'Accepter (+20 % de commandes, prix -3 %)', act: { demand: 1.2, price: -0.03, months: 24 } }, { label: 'Refuser', act: {} }] },
  { id: 'unpaid', title: 'Client en faillite', p: 0.008, text: 'Un client dépose le bilan : un mois de factures ne sera jamais payé.', effect: { cashRevenueMonths: -0.6 }, choices: [{ label: 'Déclarer la créance', act: {} }] },
  { id: 'breakdown', title: 'Panne majeure', p: 0.012, text: 'Une machine critique casse. Production réduite le temps de la réparation.',
    effect: { capMult: 0.6, months: 1 },
    choices: [{ label: 'Réparation express (60 k€)', act: { cash: -60000, capMult: 1 / 0.6, months: 1 } }, { label: 'Réparation normale (3 semaines)', act: { cash: -20000 } }] },
  { id: 'accident', title: 'Accident du travail', p: 0.006, text: 'Un opérateur est brûlé par une projection de métal. L\'inspection du travail ouvre une enquête.',
    effect: { reputation: -0.05, cash: -25000 },
    choices: [{ label: 'Plan sécurité complet (80 k€)', act: { cash: -80000, safety: 0.5 } }, { label: 'Mesures minimales', act: { safety: -0.2 } }] },
  { id: 'strike', title: 'Grève', p: 0.006, countries: ['FR', 'DE', 'IT', 'ES', 'BR', 'IN'], text: 'Les salariés réclament une augmentation pour suivre l\'inflation.',
    effect: { capMult: 0.5, months: 1 },
    choices: [{ label: 'Accorder +4 % de salaire', act: { wage: 0.04, capMult: 2, months: 1 } }, { label: 'Négocier +2 % et une prime', act: { wage: 0.02, cash: -15000, capMult: 1.6, months: 1 } }, { label: 'Tenir bon', act: { morale: -0.15 } }] },
  { id: 'env_norm', title: 'Nouvelle norme environnementale', p: 0.006, text: 'Les seuils d\'émission de poussières sont abaissés. Mise en conformité exigée sous 12 mois.',
    effect: { envDeadline: 12 }, choices: [{ label: 'Compris', act: {} }] },
  { id: 'audit', title: 'Contrôle fiscal', p: 0.004, text: 'L\'administration fiscale examine vos trois derniers exercices.', effect: { taxAudit: true }, choices: [{ label: 'Coopérer', act: {} }] },
  { id: 'esff', title: 'Un ingénieur de l\'ESFF postule', p: 0.01, text: 'Un jeune diplômé de l\'École supérieure de fonderie et de forge veut vous rejoindre.',
    effect: {}, choices: [{ label: 'L\'embaucher (+1 salarié qualifié, rebuts en baisse)', act: { hire: 1, quality: 0.01, wageExtra: 1.3 } }, { label: 'Pas maintenant', act: {} }] },
  { id: 'subsidy', title: 'Aide à la décarbonation', p: 0.005, countries: ['FR', 'DE', 'IT', 'ES', 'PL', 'CZ'], text: 'Un appel à projets public finance 40 % des investissements bas carbone.',
    effect: { subsidy: 0.4, months: 12 }, choices: [{ label: 'Bonne nouvelle', act: {} }] },
  { id: 'price_war', title: 'Guerre des prix', p: 0.008, text: 'Des importations à bas prix arrivent sur votre marché.',
    effect: { marketPrice: 0.92, months: 12 }, choices: [{ label: 'S\'aligner (-6 %)', act: { price: -0.06 } }, { label: 'Miser sur la qualité', act: { quality: 0.005, cash: -30000 } }] },
  { id: 'competitor_close', title: 'Un concurrent ferme', p: 0.008, text: 'Une usine voisine ferme ses portes. Ses clients cherchent un fournisseur.',
    effect: { demand: 1.12, months: 18 }, choices: [{ label: 'Reprendre une partie du personnel (+4 salariés)', act: { hire: 4 } }, { label: 'Juste prendre les clients', act: {} }] },
  { id: 'scrap_up', title: 'Flambée des métaux', p: 0.01, text: 'Le prix de la ferraille et des alliages bondit de 25 %.', effect: { matMult: 1.25, months: 6 },
    choices: [{ label: 'Appliquer une surcharge matière aux clients', act: { price: 0.04, reputation: -0.02 } }, { label: 'Absorber', act: {} }] },
  { id: 'power_cut', title: 'Restrictions d\'électricité', p: 0.012, countries: ['IN', 'CN', 'BR', 'TR', 'MX'], text: 'Le réseau impose des coupures tournantes aux industriels.',
    effect: { capMult: 0.75, months: 2 }, choices: [{ label: 'Louer un groupe électrogène (35 k€)', act: { cash: -35000, capMult: 1.25, months: 2 } }, { label: 'Subir', act: {} }] },
  { id: 'currency', title: 'Chute de la monnaie', p: 0.015, countries: ['TR', 'BR', 'MX', 'IN'], text: 'La monnaie locale perd du terrain : les exportations deviennent plus compétitives, mais les matières importées coûtent plus cher.',
    effect: { matMult: 1.12, demand: 1.08, months: 6 }, choices: [{ label: 'OK', act: {} }] },
  { id: 'tariff', title: 'Droits de douane', p: 0.006, countries: ['MX', 'CN', 'DE', 'IT', 'JP', 'IN'], text: 'Les États-Unis relèvent leurs droits de douane sur les pièces métalliques.',
    effect: { demand: 0.88, months: 12 }, choices: [{ label: 'Chercher des clients ailleurs (30 k€)', act: { cash: -30000, diversify: 0.05 } }, { label: 'Attendre', act: {} }] },
  { id: 'pollution_stop', title: 'Arrêt pour pollution', p: 0.008, countries: ['CN'], text: 'Pic de pollution : les autorités ordonnent l\'arrêt des fours pendant deux semaines.',
    effect: { capMult: 0.5, months: 1 }, choices: [{ label: 'Compris', act: {} }] },
  { id: 'aero_cert', title: 'Certification aéronautique', p: 0.005, text: 'Un motoriste propose de vous qualifier EN 9100 si vous investissez dans la qualité.',
    effect: {}, choices: [{ label: 'Se lancer (120 k€)', act: { cash: -120000, quality: 0.01, price: 0.05, reputation: 0.05 } }, { label: 'Décliner', act: {} }] },
  { id: 'labour_short', title: 'Pénurie de main-d\'œuvre', p: 0.007, countries: ['DE', 'JP', 'FR', 'CZ', 'PL', 'US'], text: 'Impossible de recruter des fondeurs et des forgerons qualifiés.',
    effect: { hireBlock: 6 }, choices: [{ label: 'Créer une école interne (50 k€)', act: { cash: -50000, quality: 0.005 } }, { label: 'Augmenter les salaires de 3 %', act: { wage: 0.03 } }] },
  { id: 'cyber', title: 'Cyberattaque', p: 0.004, text: 'Un rançongiciel bloque vos ordinateurs et votre ERP.', effect: { capMult: 0.7, months: 1, cash: -40000 }, choices: [{ label: 'Restaurer les sauvegardes', act: {} }] },
  { id: 'pandemic', title: 'Pandémie', p: 0.0015, text: 'Une épidémie mondiale ferme des usines clientes pendant des mois.', effect: { demand: 0.55, months: 4 },
    choices: [{ label: 'Chômage partiel (aide publique)', act: { wageMult: 0.4, months: 3 } }, { label: 'Garder tout le monde', act: {} }] },
];
