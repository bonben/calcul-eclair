'use strict';

/* =========================================================
   Calcul Éclair — calcul mental gamifié
   ========================================================= */

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

// ---------- Hasard (remplaçable par un générateur seedé pour le défi du jour) ----------
let rng = Math.random;
const rint = (a, b) => a + Math.floor(rng() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
function seeded(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const hashStr = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

// ---------- Dates ----------
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const yesterdayKey = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); };

// ---------- Sauvegarde ----------
const STORE = 'calcul-eclair-v1';
const DEFAULT_STATE = {
  xp: 0,
  games: 0,
  skill: { add: 2, sub: 2, mul: 2, div: 1 },
  ops: { add: true, sub: true, mul: true, div: true },
  sound: true,
  vibrate: true,
  best: { sprint: 0, survie: 0 },
  daily: { day: '', best: 0 },
  tricks: {},            // id -> étoiles (0..3)
  streak: { count: 0, last: '' },
  missed: [],            // répétition espacée : {q, a, op, box, due}
  badges: [],
  stats: { correct: 0, answered: 0, rtSum: 0, rtCount: 0, bestCombo: 0, fastest: 0, revanches: 0 },
  opCount: { add: 0, sub: 0, mul: 0, div: 0 }, // réponses par opération (calibrage rapide au début)
  dailyBest: 0,
};
let S = load();
// Barème v2 : les points dépendent fortement de la difficulté. Les anciens records ne sont plus comparables.
if (S.scoring !== 2) {
  S.best = { sprint: 0, survie: 0 };
  S.dailyBest = S.daily.best || 0;
  S.badges = S.badges.filter((b) => b !== 'sprint1500' && b !== 'sprint4000');
  S.scoring = 2;
  save();
}
function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE));
    if (raw) return deepMerge(structuredClone(DEFAULT_STATE), raw);
  } catch (e) { /* stockage indisponible : on repart de zéro */ }
  return structuredClone(DEFAULT_STATE);
}
function deepMerge(base, over) {
  for (const k in over) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && base[k] && typeof base[k] === 'object') deepMerge(base[k], over[k]);
    else base[k] = over[k];
  }
  return base;
}
function save() { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* ignore */ } }

// ---------- Niveaux de joueur ----------
const xpForNext = (lvl) => 100 + 50 * lvl;
function levelInfo(xp) {
  let lvl = 1, rest = xp;
  while (rest >= xpForNext(lvl)) { rest -= xpForNext(lvl); lvl++; }
  return { lvl, rest, need: xpForNext(lvl) };
}
const TITLES = [[1, 'Recrue'], [3, 'Challenger'], [5, 'Ninja du calcul'], [8, 'Cerveau turbo'], [12, 'Machine à calculer'],
  [16, 'Sniper des chiffres'], [20, 'Boss final'], [25, 'Légende'], [30, 'Divinité des nombres']];
const titleFor = (lvl) => TITLES.filter(([l]) => lvl >= l).pop()[1];

/* =========================================================
   Génération des calculs (difficulté adaptative)
   ========================================================= */
const OP_SYM = { add: '+', sub: '−', mul: '×', div: '÷' };
const OP_NAME = { add: 'Additions', sub: 'Soustractions', mul: 'Multiplications', div: 'Divisions' };
const ADD_LV = [[1, 9, 1, 9], [10, 40, 1, 9], [10, 99, 2, 9], [10, 50, 10, 40], [10, 99, 10, 99], [100, 500, 10, 99], [100, 999, 10, 99], [100, 999, 100, 999]];
const MUL_LV = [[2, 9, 2, 5], [2, 9, 2, 9], [2, 12, 2, 9], [2, 12, 2, 12], [11, 19, 2, 9], [11, 30, 2, 9], [20, 99, 2, 9], [11, 25, 11, 19]];
const MAX_LV = 8;
const opLevel = (op) => Math.min(MAX_LV, Math.max(1, Math.floor(S.skill[op])));
// Temps "cible" d'une réponse : sert au bonus de vitesse et à l'ajustement du niveau
const targetTime = (op, lvl) => 1.2 * Math.pow(1.3, lvl - 1) + 0.25 + (op === 'mul' || op === 'div' ? 0.4 : 0);
// Points d'un calcul : doublent à chaque niveau, pour qu'un calcul plus dur rapporte toujours plus
// que plusieurs calculs faciles faits dans le même temps.
const basePoints = (lvl) => 10 * Math.pow(2, lvl - 1);

function makeQuestion(op, lvl) {
  const [a1, a2, b1, b2] = (op === 'add' || op === 'sub' ? ADD_LV : MUL_LV)[lvl - 1];
  let a = rint(a1, a2), b = rint(b1, b2);
  if (rng() < 0.5 && (op === 'add' || op === 'mul')) [a, b] = [b, a];
  switch (op) {
    case 'add': return { q: `${a} + ${b}`, a: a + b, k: `+${Math.min(a, b)},${Math.max(a, b)}` };
    case 'sub': { const x = Math.max(a, b), y = Math.min(a, b); return { q: `${x + y} − ${y}`, a: x }; }
    case 'mul': return { q: `${a} × ${b}`, a: a * b, k: `×${Math.min(a, b)},${Math.max(a, b)}` };
    case 'div': { const x = Math.max(a, b), y = Math.min(a, b); return { q: `${x * y} ÷ ${y}`, a: x }; }
  }
}
const qKey = (q) => q.k || q.q;
// Évite les calculs vus récemment ; si le niveau en a trop peu, prend le plus ancien
const RECENT = 25;
function freshQuestion(gen) {
  let best = null, bestAge = -1;
  for (let i = 0; i < 30; i++) {
    const q = gen();
    const idx = G.recent.lastIndexOf(qKey(q));
    if (idx < 0) return q;
    const age = G.recent.length - idx;
    if (age > bestAge) { best = q; bestAge = age; }
  }
  return best;
}
function enabledOps() {
  const ops = Object.keys(S.ops).filter((o) => S.ops[o]);
  return ops.length ? ops : ['add'];
}
// Ajuste le niveau pour viser ~90 % de réussite (zone de "flow")
function adapt(op, ok, rt, lvl) {
  if (!op) return;
  const k = S.opCount[op]++ < 25 ? 2.5 : 1; // au début, on monte vite jusqu'au bon niveau
  if (!ok) S.skill[op] -= 1;
  else if (rt < targetTime(op, lvl)) S.skill[op] += 0.15 * k;
  else S.skill[op] += 0.03 * k;
  S.skill[op] = Math.min(MAX_LV + 0.99, Math.max(1, S.skill[op]));
}

/* =========================================================
   Astuces
   ========================================================= */
const TRICKS = [
  { id: 'x11', ico: '×11', name: '× 11 en un éclair', sub: '43 × 11 = 473',
    how: 'Pour multiplier un nombre à 2 chiffres par 11 : écarte ses deux chiffres et place leur <b>somme au milieu</b>. Si la somme dépasse 9, ajoute la retenue au premier chiffre.',
    ex: '43 × 11 → 4 _ 3 → 4 <em>7</em> 3 = <em>473</em><br>78 × 11 → 7 (15) 8 → 8 5 8 = <em>858</em>',
    gen: () => { const n = rintNot10(12, 99); return { q: `${n} × 11`, a: n * 11 }; } },
  { id: 'x5', ico: '×5', name: '× 5 = × 10 ÷ 2', sub: '48 × 5 = 240',
    how: 'Multiplier par 5, c\'est multiplier par 10 (ajouter un 0) puis <b>diviser par 2</b>.',
    ex: '48 × 5 → 480 ÷ 2 = <em>240</em><br>37 × 5 → 370 ÷ 2 = <em>185</em>',
    gen: () => { const n = rintNot10(12, 98); return { q: `${n} × 5`, a: n * 5 }; } },
  { id: 'x9', ico: '×9', name: '× 9 = × 10 − 1 fois', sub: '37 × 9 = 333',
    how: 'Multiplie par 10, puis <b>enlève le nombre</b> une fois.',
    ex: '37 × 9 → 370 − 37 = <em>333</em><br>64 × 9 → 640 − 64 = <em>576</em>',
    gen: () => { const n = rintNot10(12, 99); return { q: `${n} × 9`, a: n * 9 }; } },
  { id: 'c100', ico: '100', name: 'Compléments à 100', sub: '100 − 37 = 63',
    how: 'Pour 100 − un nombre : le chiffre des dizaines va jusqu\'à <b>9</b>, celui des unités va jusqu\'à <b>10</b>.',
    ex: '100 − 37 → 3 + <em>6</em> = 9 et 7 + <em>3</em> = 10 → <em>63</em><br>100 − 82 → <em>18</em>',
    gen: () => { let n; do n = rint(11, 99); while (n % 10 === 0); return { q: `100 − ${n}`, a: 100 - n }; } },
  { id: 'sq5', ico: 'x²', name: 'Carrés finissant par 5', sub: '35² = 1225',
    how: 'Multiplie le chiffre des dizaines par <b>son suivant</b>, puis colle <b>25</b> à la fin.',
    ex: '35² → 3 × 4 = 12 → <em>1225</em><br>75² → 7 × 8 = 56 → <em>5625</em>',
    gen: () => { const n = rint(1, 9) * 10 + 5; return { q: `${n}²`, a: n * n }; } },
  { id: 'x25', ico: '×25', name: '× 25 = × 100 ÷ 4', sub: '32 × 25 = 800',
    how: 'Multiplie par 100, puis <b>divise par 4</b> (= moitié de la moitié).',
    ex: '32 × 25 → 3200 ÷ 4 = <em>800</em><br>18 × 25 → 1800 → 900 → <em>450</em>',
    gen: () => { const n = rint(2, 24) * 2; return { q: `${n} × 25`, a: n * 25 }; } },
  { id: 'round', ico: '+', name: 'Additionner en arrondissant', sub: '47 + 38 = 85',
    how: 'Quand un nombre finit par 7, 8 ou 9 : <b>arrondis-le</b> à la dizaine au-dessus, puis corrige.',
    ex: '47 + 38 → 47 + 40 − 2 = <em>85</em><br>156 + 29 → 156 + 30 − 1 = <em>185</em>',
    gen: () => { const a = rint(15, 180), b = rint(1, 9) * 10 + pick([7, 8, 9]); return { q: `${a} + ${b}`, a: a + b }; } },
  { id: 'comp', ico: '−', name: 'Soustraire par compensation', sub: '83 − 29 = 54',
    how: 'Pour enlever 29, enlève <b>30</b> puis <b>rajoute 1</b>. Pareil pour 48 (−50 +2), 97 (−100 +3)…',
    ex: '83 − 29 → 83 − 30 + 1 = <em>54</em><br>152 − 97 → 152 − 100 + 3 = <em>55</em>',
    gen: () => { const b = rint(1, 9) * 10 + pick([7, 8, 9]); const a = b + rint(5, 90); return { q: `${a} − ${b}`, a: a - b }; } },
  { id: 'half', ico: '½', name: 'Double et moitié', sub: '16 × 35 = 560',
    how: 'Dans une multiplication, tu peux <b>doubler un nombre et diviser l\'autre par 2</b> : le résultat ne change pas. Continue jusqu\'à tomber sur un calcul facile.',
    ex: '16 × 35 → 8 × 70 → 4 × 140 = <em>560</em><br>14 × 45 → 7 × 90 = <em>630</em>',
    gen: () => { const a = pick([12, 14, 16, 18, 22, 24, 28, 32]), b = pick([15, 25, 35, 45, 55]); return { q: `${a} × ${b}`, a: a * b }; } },
  { id: 'x4', ico: '×4', name: '× 4 et × 8 : double-double', sub: '37 × 4 = 148',
    how: '× 4, c\'est <b>doubler deux fois</b>. × 8, c\'est doubler trois fois.',
    ex: '37 × 4 → 74 → <em>148</em><br>23 × 8 → 46 → 92 → <em>184</em>',
    gen: () => rng() < 0.6 ? (n => ({ q: `${n} × 4`, a: n * 4 }))(rint(13, 99)) : (n => ({ q: `${n} × 8`, a: n * 8 }))(rint(12, 49)) },
];
const TRICK_Q = 10;
function rintNot10(a, b) { let n; do n = rint(a, b); while (n % 10 === 0); return n; }

/* =========================================================
   Badges
   ========================================================= */
const BADGES = [
  { id: 'first', ico: '🎮', name: 'Premier pas', desc: 'Finir une partie' },
  { id: 'combo10', ico: '🔥', name: 'En feu', desc: 'Combo de 10' },
  { id: 'combo25', ico: '☄️', name: 'Inarrêtable', desc: 'Combo de 25' },
  { id: 'flash', ico: '⚡', name: 'Éclair', desc: 'Répondre en moins de 0,8 s' },
  { id: 'sprint1500', ico: '🏃', name: 'Rapide', desc: '2 500 pts en Sprint' },
  { id: 'sprint4000', ico: '🚀', name: 'Supersonique', desc: '8 000 pts en Sprint' },
  { id: 'survie20', ico: '🛡️', name: 'Increvable', desc: '20 justes en Survie' },
  { id: 'perfect', ico: '💎', name: 'Sans faute', desc: 'Défi du jour à 20/20' },
  { id: 'trick1', ico: '🧠', name: 'Première astuce', desc: '3 étoiles sur une astuce' },
  { id: 'trickAll', ico: '🎓', name: 'Prof de maths', desc: '3 étoiles sur toutes les astuces' },
  { id: 'streak3', ico: '📆', name: 'Régulier', desc: '3 jours d\'affilée' },
  { id: 'streak7', ico: '🗓️', name: 'Semaine de feu', desc: '7 jours d\'affilée' },
  { id: 'streak30', ico: '👑', name: 'Mois de fou', desc: '30 jours d\'affilée' },
  { id: 'revenge', ico: '🔁', name: 'Revanche', desc: 'Réussir 10 revanches' },
  { id: 'total100', ico: '💯', name: 'Centurion', desc: '100 calculs justes' },
  { id: 'total1000', ico: '🏆', name: 'Millénaire', desc: '1 000 calculs justes' },
  { id: 'lvl10', ico: '⭐', name: 'Niveau 10', desc: 'Atteindre le niveau 10' },
];
function unlock(id) {
  if (S.badges.includes(id)) return;
  S.badges.push(id);
  G && G.newBadges.push(id);
}

/* =========================================================
   Sons & vibrations
   ========================================================= */
let AC = null;
function audio() {
  if (!S.sound) return null;
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
function tone(freq, dur, type = 'sine', vol = 0.18, delay = 0, slideTo = null) {
  const ac = audio(); if (!ac) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
}
const SFX = {
  ok: (combo) => { const f = 520 * Math.pow(2, Math.min(combo, 24) / 24); tone(f, 0.09, 'triangle', 0.2); tone(f * 1.5, 0.12, 'triangle', 0.12, 0.05); },
  bad: () => tone(180, 0.28, 'sawtooth', 0.14, 0, 80),
  tier: () => [0, 4, 7, 12].forEach((s, i) => tone(660 * Math.pow(2, s / 12), 0.12, 'square', 0.08, i * 0.06)),
  tick: () => tone(1000, 0.03, 'square', 0.05),
  count: () => tone(440, 0.12, 'square', 0.1),
  go: () => tone(880, 0.25, 'square', 0.12),
  end: () => [0, 4, 7, 12, 16].forEach((s, i) => tone(523 * Math.pow(2, s / 12), 0.18, 'triangle', 0.15, i * 0.09)),
  life: () => { tone(300, 0.15, 'square', 0.12); tone(200, 0.3, 'square', 0.12, 0.12); },
};
const buzz = (p) => { if (S.vibrate && navigator.vibrate) navigator.vibrate(p); };

/* =========================================================
   Navigation
   ========================================================= */
function show(name) {
  $$('.screen').forEach((s) => s.classList.remove('active'));
  $(`#screen-${name}`).classList.add('active');
  ({ home: renderHome, tricks: renderTricks, badges: renderBadges, stats: renderStats, settings: renderSettings }[name] || (() => {}))();
}
document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) { audio(); show(go.dataset.go); return; }
  const mode = e.target.closest('[data-mode]');
  if (mode && mode.dataset.mode === 'daily' && dailyDone()) {
    const left = new Date().setHours(24, 0, 0, 0) - Date.now();
    toast(`Défi déjà fait : ${S.daily.best} pts. Le prochain dans ${Math.floor(left / 3600000)} h ${Math.floor(left / 60000) % 60} min ⏳`);
    return;
  }
  if (mode) { audio(); startGame(mode.dataset.mode); }
});

const dailyDone = () => S.daily.day === dayKey();

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

/* =========================================================
   Écrans
   ========================================================= */
function currentStreak() {
  const { count, last } = S.streak;
  return last === dayKey() || last === yesterdayKey() ? count : 0;
}
function renderHome() {
  const L = levelInfo(S.xp);
  $('#p-level').textContent = L.lvl;
  $('#p-title').textContent = titleFor(L.lvl);
  $('#p-xpfill').style.width = `${(L.rest / L.need) * 100}%`;
  $('#p-xptext').textContent = `${L.rest} / ${L.need} XP`;
  const st = currentStreak();
  const se = $('#p-streak');
  se.querySelector('span').textContent = st;
  se.classList.toggle('off', S.streak.last !== dayKey());
  $('#best-sprint').textContent = S.best.sprint ? `🏆 ${S.best.sprint}` : '';
  $('#best-survie').textContent = S.best.survie ? `🏆 ${S.best.survie}` : '';
  $('#best-daily').textContent = dailyDone() ? `✓ ${S.daily.best}` : 'NOUVEAU';
  const stars = TRICKS.reduce((n, t) => n + (S.tricks[t.id] || 0), 0);
  $('#best-tricks').textContent = `⭐ ${stars}/${TRICKS.length * 3}`;
}

function renderTricks() {
  $('#tricks-list').innerHTML = TRICKS.map((t) => {
    const s = S.tricks[t.id] || 0;
    return `<button class="card trick-item" data-trick="${t.id}">
      <span class="t-ico">${t.ico}</span>
      <span class="t-txt"><b>${t.name}</b><small>${t.sub}</small></span>
      <span class="t-stars">${'⭐'.repeat(s)}${'☆'.repeat(3 - s)}</span></button>`;
  }).join('');
}
let currentTrick = null;
$('#tricks-list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-trick]'); if (!b) return;
  currentTrick = TRICKS.find((t) => t.id === b.dataset.trick);
  $('#trick-name').textContent = currentTrick.name;
  $('#trick-how').innerHTML = currentTrick.how;
  $('#trick-ex').innerHTML = currentTrick.ex;
  show('trick');
});
$('#trick-start').addEventListener('click', () => { audio(); startGame('trick', currentTrick); });

function renderBadges() {
  $('#badges-list').innerHTML = BADGES.map((b) => `
    <div class="badge ${S.badges.includes(b.id) ? '' : 'locked'}">
      <div class="b-ico">${b.ico}</div><b>${b.name}</b><small>${b.desc}</small></div>`).join('');
}

function renderStats() {
  const st = S.stats;
  const acc = st.answered ? Math.round((st.correct / st.answered) * 100) : 0;
  const rt = st.rtCount ? (st.rtSum / st.rtCount).toFixed(2) + ' s' : '–';
  const rows = [
    ['Parties jouées', S.games], ['Calculs justes', st.correct], ['Précision', acc + ' %'],
    ['Réaction moyenne', rt], ['Plus rapide', st.fastest ? st.fastest.toFixed(2) + ' s' : '–'],
    ['Meilleur combo', st.bestCombo], ['Record Sprint', S.best.sprint], ['Record Survie', S.best.survie], ['Record Défi du jour', S.dailyBest],
    ['Série actuelle', currentStreak() + ' j'], ['Revanches réussies', st.revanches], ['Calculs à revoir', S.missed.length],
  ];
  $('#stats-body').innerHTML = `<div class="card">${rows.map(([k, v]) => `<div class="stat-row"><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;
}

function renderSettings() {
  $$('[data-op]').forEach((c) => { c.checked = S.ops[c.dataset.op]; });
  $('#set-sound').checked = S.sound;
  $('#set-vibrate').checked = S.vibrate;
  $('#op-levels').innerHTML = Object.keys(OP_SYM).map((op) => `
    <div class="op-lvl"><span style="width:24px">${OP_SYM[op]}</span><span class="bar"><i style="width:${(opLevel(op) / MAX_LV) * 100}%"></i></span><span>${opLevel(op)}/${MAX_LV}</span></div>`).join('');
}
$$('[data-op]').forEach((c) => c.addEventListener('change', () => {
  S.ops[c.dataset.op] = c.checked;
  if (!enabledOps().some((o) => S.ops[o])) { S.ops[c.dataset.op] = true; c.checked = true; toast('Garde au moins une opération 😉'); }
  save();
}));
$('#set-sound').addEventListener('change', (e) => { S.sound = e.target.checked; save(); });
$('#set-vibrate').addEventListener('change', (e) => { S.vibrate = e.target.checked; save(); if (S.vibrate) buzz(50); });
$('#reset').addEventListener('click', () => {
  if (confirm('Effacer toute la progression (XP, records, badges) ?')) { S = structuredClone(DEFAULT_STATE); save(); show('home'); toast('Remis à zéro'); }
});

/* =========================================================
   Moteur de jeu
   ========================================================= */
const SPRINT_MS = 60000;
const DAILY_Q = 20;
const COMBO_TIERS = [[10, 2], [5, 1.5], [0, 1]];
const multFor = (combo) => COMBO_TIERS.find(([c]) => combo >= c)[1];

let G = null;

function startGame(mode, trick = null) {
  rng = mode === 'daily' ? seeded(hashStr('eclair-' + dayKey())) : Math.random;
  G = {
    mode, trick,
    score: 0, combo: 0, maxCombo: 0, correct: 0, answered: 0, rts: [],
    qIndex: 0, q: null, typed: '', qStart: 0, locked: true,
    lives: 3, endAt: 0, qDeadline: 0, qDur: 0, startAt: 0,
    retry: [], newBadges: [], recent: [], retried: new Set(), seen: new Set(),
    xpBefore: S.xp, running: false,
  };
  // Un seul essai par jour : l'essai compte dès le départ, même si on quitte en cours
  if (mode === 'daily') { S.daily = { day: dayKey(), best: 0 }; save(); }
  $('#score').textContent = '0';
  $('#combo').textContent = ''; $('#combo').className = 'combo';
  $('#stage').classList.remove('fire');
  $('#answer').innerHTML = '&nbsp;'; $('#answer').className = 'answer';
  $('#feedback').innerHTML = '&nbsp;';
  $('#question').textContent = '';
  $('#qtag').classList.remove('show');
  $('#timefill').style.transform = 'scaleX(1)';
  $('#timefill').classList.remove('warn');
  $('#hud-info').textContent = '';
  show('game');
  countdown(() => {
    G.running = true;
    G.startAt = performance.now();
    if (mode === 'sprint') G.endAt = G.startAt + SPRINT_MS;
    nextQuestion();
    requestAnimationFrame(loop);
  });
}

function countdown(done) {
  const el = $('#countdown');
  el.classList.add('show');
  let n = 3;
  const g = G;
  const step = () => {
    if (G !== g) return;
    if (n === 0) { el.innerHTML = '<span>GO!</span>'; SFX.go(); buzz(40); setTimeout(() => { if (G !== g) return; el.classList.remove('show'); done(); }, 450); return; }
    el.innerHTML = `<span>${n}</span>`; SFX.count(); n--;
    setTimeout(step, 600);
  };
  step();
}

// Choix de la question suivante : revanches (erreurs récentes / anciennes) ou nouvelle question adaptée
function chooseQuestion() {
  if (G.mode === 'trick') {
    let q, tries = 0;
    do q = G.trick.gen(); while (G.seen.has(q.q) && ++tries < 15);
    G.seen.add(q.q);
    return { ...q, op: null, lvl: 3 };
  }
  if (G.mode === 'daily') {
    const op = pick(['add', 'sub', 'mul', 'div']);
    const lvl = 3 + Math.floor((G.qIndex / DAILY_Q) * 4); // monte de 3 à 6
    return { ...freshQuestion(() => makeQuestion(op, lvl)), op, lvl };
  }
  // Erreur de cette partie, revient ~4 questions plus tard
  const r = G.retry.findIndex((x) => x.at <= G.qIndex);
  if (r >= 0) { const x = G.retry.splice(r, 1)[0]; return { ...x, revenge: true }; }
  // Erreurs des parties précédentes (répétition espacée)
  const due = S.missed.filter((m) => m.due <= S.games && enabledOps().includes(m.op) && !G.retried.has(m.q));
  if (due.length && Math.random() < 0.2) {
    const m = pick(due);
    G.retried.add(m.q); // une seule fois par partie
    return { q: m.q, a: m.a, op: m.op, lvl: m.lvl, revenge: true, stored: true };
  }
  const op = pick(enabledOps());
  const lvl = opLevel(op);
  return { ...freshQuestion(() => makeQuestion(op, lvl)), op, lvl };
}

function nextQuestion() {
  if (!G || !G.running) return;
  if (G.mode === 'daily' && G.qIndex >= DAILY_Q) return endGame();
  if (G.mode === 'trick' && G.qIndex >= TRICK_Q) return endGame();
  G.q = chooseQuestion();
  G.recent.push(qKey(G.q));
  if (G.recent.length > RECENT) G.recent.shift();
  G.typed = '';
  G.locked = false;
  const qe = $('#question');
  qe.textContent = G.q.q;
  qe.classList.remove('pop'); void qe.offsetWidth; qe.classList.add('pop');
  $('#answer').innerHTML = '&nbsp;'; $('#answer').className = 'answer';
  $('#qtag').textContent = G.mode === 'trick' ? `💡 ${G.trick.sub}` : '🔁 REVANCHE';
  $('#qtag').classList.toggle('show', !!G.q.revenge || G.mode === 'trick');
  G.qStart = performance.now();
  if (G.mode === 'survie') {
    const base = targetTime(G.q.op, G.q.lvl) * 2.2;
    G.qDur = Math.max(1800, base * 1000 * Math.max(0.45, 1 - 0.025 * G.correct));
    G.qDeadline = G.qStart + G.qDur;
  }
  updateHudInfo();
}

function updateHudInfo() {
  const h = $('#hud-info');
  if (G.mode === 'survie') h.innerHTML = `<span class="lives">${'❤️'.repeat(G.lives)}${'🖤'.repeat(3 - G.lives)}</span> · niv. ${G.q ? G.q.lvl : ''}`;
  else if (G.mode === 'daily') h.textContent = `Défi du jour · ${Math.min(G.qIndex + 1, DAILY_Q)}/${DAILY_Q}`;
  else if (G.mode === 'trick') h.textContent = `${G.trick.name} · ${Math.min(G.qIndex + 1, TRICK_Q)}/${TRICK_Q}`;
}

let lastTickSec = -1;
function loop(now) {
  if (!G || !G.running) return;
  const fill = $('#timefill');
  if (G.mode === 'sprint') {
    const left = G.endAt - now;
    fill.style.transform = `scaleX(${Math.max(0, left / SPRINT_MS)})`;
    fill.classList.toggle('warn', left < 10000);
    const sec = Math.ceil(left / 1000);
    $('#hud-info').textContent = `⏱ ${Math.max(0, sec)} s · niv. ${G.q ? G.q.lvl : ''}`;
    if (sec <= 5 && sec > 0 && sec !== lastTickSec) { lastTickSec = sec; SFX.tick(); }
    if (left <= 0) return endGame();
  } else if (G.mode === 'survie') {
    const left = G.qDeadline - now;
    fill.style.transform = `scaleX(${Math.max(0, left / G.qDur)})`;
    fill.classList.toggle('warn', left < G.qDur * 0.3);
    if (left <= 0 && !G.locked) answer(false, true);
  } else {
    const total = G.mode === 'daily' ? DAILY_Q : TRICK_Q;
    fill.style.transform = `scaleX(${1 - G.qIndex / total})`;
    if (G.mode === 'daily') $('#hud-info').textContent = `Défi du jour · ${Math.min(G.qIndex + 1, DAILY_Q)}/${DAILY_Q} · ${((now - G.startAt) / 1000).toFixed(0)} s`;
  }
  requestAnimationFrame(loop);
}

// ---------- Saisie ----------
function press(k) {
  if (!G || G.locked || !G.running) return;
  if (k === 'del') { G.typed = G.typed.slice(0, -1); renderTyped(); return; }
  if (k === 'skip') { answer(false); return; }
  if (G.typed.length >= 6) return;
  G.typed += k;
  renderTyped();
  const target = String(G.q.a);
  if (Number(G.typed) === G.q.a) answer(true);
  else if (G.typed.length >= target.length) answer(false);
}
function renderTyped() { $('#answer').textContent = G.typed || ' '; }

$('#keypad').addEventListener('pointerdown', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  e.preventDefault();
  b.classList.add('press'); setTimeout(() => b.classList.remove('press'), 90);
  press(b.dataset.k);
});
document.addEventListener('keydown', (e) => {
  if (!$('#screen-game').classList.contains('active')) return;
  if (/^[0-9]$/.test(e.key)) press(e.key);
  else if (e.key === 'Backspace') press('del');
  else if (e.key === 'Enter' || e.key === ' ') press('skip');
  else if (e.key === 'Escape') quitGame();
});

// ---------- Résolution d'une réponse ----------
function answer(ok, timeout = false) {
  G.locked = true;
  const rt = (performance.now() - G.qStart) / 1000;
  const q = G.q;
  G.answered++;
  G.qIndex++;
  S.stats.answered++;
  adapt(q.op, ok, rt, q.lvl);

  if (ok) {
    G.correct++;
    G.rts.push(rt);
    S.stats.correct++; S.stats.rtSum += rt; S.stats.rtCount++;
    if (!S.stats.fastest || rt < S.stats.fastest) S.stats.fastest = rt;
    if (rt < 0.8 && String(q.a).length >= 2) unlock('flash');
    const prevMult = multFor(G.combo);
    G.combo++;
    G.maxCombo = Math.max(G.maxCombo, G.combo);
    const mult = multFor(G.combo);
    const tgt = targetTime(q.op || 'mul', q.lvl);
    const base = basePoints(q.lvl);
    const bonus = rt < tgt ? base * 0.5 * (1 - rt / tgt) : 0; // jusqu'à +50 % si très rapide
    const pts = Math.round((base + bonus) * mult);
    G.score += pts;
    if (q.revenge) handleRevenge(q, true);

    $('#answer').classList.add('ok');
    const fb = $('#feedback');
    fb.className = 'feedback' + (rt < 1.2 ? ' fast' : '');
    fb.textContent = rt < 1 ? `⚡ ${rt.toFixed(2)} s — ÉCLAIR !` : rt < 2 ? `${rt.toFixed(2)} s — rapide !` : `${rt.toFixed(2)} s`;
    floatText(`+${pts}`);
    bumpScore();
    SFX.ok(G.combo);
    if (mult > prevMult) { SFX.tier(); buzz([30, 40, 30]); sparks(18); } else if (G.combo >= 5) sparks(6);
    renderCombo();
    setTimeout(nextQuestion, 140);
  } else {
    G.combo = 0;
    renderCombo();
    if (q.revenge) handleRevenge(q, false);
    else if (q.op) {
      queueRetry(q);
      storeMissed(q);
    }
    const ae = $('#answer');
    ae.textContent = `${q.a}`;
    ae.className = 'answer bad';
    $('#feedback').className = 'feedback';
    $('#feedback').textContent = timeout ? '⏰ Trop tard !' : G.typed ? `✗ pas ${G.typed}` : 'passé';
    $('#screen-game').classList.remove('flash-red'); void $('#screen-game').offsetWidth; $('#screen-game').classList.add('flash-red');
    buzz(120);
    if (G.mode === 'survie') {
      G.lives--; SFX.life(); updateHudInfo();
      if (G.lives <= 0) { setTimeout(endGame, 900); return; }
    } else SFX.bad();
    setTimeout(nextQuestion, 850);
  }
}

function storeMissed(q) {
  const m = S.missed.find((x) => x.q === q.q);
  if (m) { m.box = 0; m.due = S.games + 1; }
  else S.missed.push({ q: q.q, a: q.a, op: q.op, lvl: q.lvl, box: 0, due: S.games + 1 });
  if (S.missed.length > 40) S.missed.shift();
}
// Boîtes de Leitner : chaque réussite espace la prochaine apparition
function handleRevenge(q, ok) {
  const m = S.missed.find((x) => x.q === q.q);
  if (ok) {
    S.stats.revanches++;
    if (S.stats.revanches >= 10) unlock('revenge');
    if (m) {
      m.box++;
      if (m.box >= 3) S.missed.splice(S.missed.indexOf(m), 1);
      else m.due = S.games + [1, 2, 4][m.box];
    }
  } else {
    if (m) { m.box = 0; m.due = S.games + 1; } else storeMissed(q);
    queueRetry(q);
  }
}
// Un calcul raté revient ~4 questions plus tard, mais une seule fois par partie
function queueRetry(q) {
  if (G.retried.has(q.q)) return;
  G.retried.add(q.q);
  G.retry.push({ q: q.q, a: q.a, op: q.op, lvl: q.lvl, at: G.qIndex + 4 });
}

// ---------- Effets ----------
function renderCombo() {
  const c = $('#combo');
  const m = multFor(G.combo);
  c.className = 'combo' + (m >= 2 ? ' x4' : m > 1 ? ' x2' : '');
  c.textContent = G.combo >= 3 ? `${m >= 2 ? '🔥 ' : ''}COMBO ${G.combo}${m > 1 ? ` · ×${String(m).replace('.', ',')}` : ''}` : '';
  $('#stage').classList.toggle('fire', m >= 2);
}
function bumpScore() {
  const s = $('#score'); s.textContent = G.score;
  s.classList.remove('bump'); void s.offsetWidth; s.classList.add('bump');
}
function floatText(txt) {
  const st = $('#stage');
  const f = document.createElement('div');
  f.className = 'float'; f.textContent = txt;
  f.style.left = `${45 + Math.random() * 20}%`; f.style.top = '38%';
  st.appendChild(f); setTimeout(() => f.remove(), 800);
}
function sparks(n) {
  const st = $('#stage');
  const colors = ['#ffd23f', '#ff3d81', '#00e5ff', '#3dffa2', '#a66bff'];
  for (let i = 0; i < n; i++) {
    const s = document.createElement('div');
    s.className = 'spark';
    const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 90;
    s.style.left = '50%'; s.style.top = '55%';
    s.style.background = colors[i % colors.length];
    s.style.setProperty('--dx', `${Math.cos(a) * d}px`);
    s.style.setProperty('--dy', `${Math.sin(a) * d}px`);
    st.appendChild(s); setTimeout(() => s.remove(), 650);
  }
}

// ---------- Pause automatique si l'appli passe en arrière-plan ----------
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (!G || !G.running) return;
  if (document.hidden) { hiddenAt = performance.now(); return; }
  const d = performance.now() - hiddenAt;
  G.endAt += d; G.qDeadline += d; G.qStart += d; G.startAt += d;
});

function quitGame() {
  if (!G) return;
  G.running = false; G = null;
  $('#countdown').classList.remove('show');
  save();
  show('home');
}
$('#quit').addEventListener('click', quitGame);

/* =========================================================
   Fin de partie
   ========================================================= */
const TIPS = [
  'Astuce : pour × 5, fais × 10 puis ÷ 2.',
  'Astuce : 100 − 37 ? Les dizaines vont à 9, les unités à 10 → 63.',
  'Astuce : pour + 9, fais + 10 − 1.',
  'Astuce : 25 × 4 = 100. Donc 25 × 12 = 300.',
  'Joue un peu chaque jour : 5 minutes par jour valent mieux qu\'une heure le dimanche.',
  'Tes erreurs reviennent en « revanche » plus tard : c\'est là que tu progresses le plus.',
  'Le niveau s\'adapte tout seul : si c\'est trop facile, va plus vite !',
  'Pour × 9 : × 10 puis enlève le nombre. 7 × 9 = 70 − 7 = 63.',
];

function endGame() {
  if (!G || !G.running) return;
  G.running = false;
  G.locked = true;
  const mode = G.mode;
  const acc = G.answered ? Math.round((G.correct / G.answered) * 100) : 0;
  const avg = G.rts.length ? G.rts.reduce((a, b) => a + b, 0) / G.rts.length : 0;
  let record = false, stars = 0;

  S.games++;
  S.stats.bestCombo = Math.max(S.stats.bestCombo, G.maxCombo);

  if (mode === 'sprint' || mode === 'survie') {
    if (G.score > S.best[mode]) { record = S.best[mode] > 0; S.best[mode] = G.score; }
    if (mode === 'sprint' && G.score >= 2500) unlock('sprint1500');
    if (mode === 'sprint' && G.score >= 8000) unlock('sprint4000');
    if (mode === 'survie' && G.correct >= 20) unlock('survie20');
  } else if (mode === 'daily') {
    S.daily = { day: dayKey(), best: G.score };
    if (G.score > S.dailyBest) { record = S.dailyBest > 0; S.dailyBest = G.score; }
    if (G.correct === DAILY_Q) unlock('perfect');
  } else if (mode === 'trick') {
    stars = G.correct === TRICK_Q && avg < 5 ? 3 : G.correct >= 9 ? 2 : G.correct >= 6 ? 1 : 0;
    const prev = S.tricks[G.trick.id] || 0;
    if (stars > prev) { S.tricks[G.trick.id] = stars; record = prev > 0; }
    if (stars === 3) unlock('trick1');
    if (TRICKS.every((t) => S.tricks[t.id] === 3)) unlock('trickAll');
  }

  // Série de jours
  const today = dayKey();
  if (S.streak.last !== today) {
    S.streak.count = S.streak.last === yesterdayKey() ? S.streak.count + 1 : 1;
    S.streak.last = today;
  }
  if (S.streak.count >= 3) unlock('streak3');
  if (S.streak.count >= 7) unlock('streak7');
  if (S.streak.count >= 30) unlock('streak30');

  unlock('first');
  if (G.maxCombo >= 10) unlock('combo10');
  if (G.maxCombo >= 25) unlock('combo25');
  if (S.stats.correct >= 100) unlock('total100');
  if (S.stats.correct >= 1000) unlock('total1000');

  const xpGain = mode === 'trick' ? 20 + G.correct * 5 + stars * 10 : 10 + Math.round(G.score / 25);
  const before = levelInfo(S.xp);
  S.xp += xpGain;
  const after = levelInfo(S.xp);
  if (after.lvl >= 10) unlock('lvl10');
  save();

  // Affichage
  SFX.end(); buzz([40, 60, 40]);
  const labels = { sprint: 'Sprint 60 s', survie: 'Survie', daily: 'Défi du jour', trick: G.trick && G.trick.name };
  $('#res-mode').textContent = labels[mode];
  $('#res-record').classList.toggle('show', record);
  $('#res-record').textContent = mode === 'trick' ? '🎉 NOUVEAU RECORD D\'ÉTOILES !' : '🎉 NOUVEAU RECORD !';
  $('#res-score').textContent = mode === 'trick' ? `${G.correct}/${TRICK_Q}` : '0';
  $('#res-stars').textContent = mode === 'trick' ? '⭐'.repeat(stars) + '☆'.repeat(3 - stars) : '';
  $('#res-correct').textContent = mode === 'daily' ? `${G.correct}/${DAILY_Q}` : G.correct;
  $('#res-acc').textContent = acc + '%';
  $('#res-rt').textContent = avg ? avg.toFixed(2) + ' s' : '–';
  $('#res-combo').textContent = G.maxCombo;
  $('#res-xpgain').textContent = `+${xpGain} XP`;
  $('#res-lvl').textContent = after.lvl > before.lvl ? `⬆️ NIVEAU ${after.lvl} !` : `Niv. ${after.lvl}`;
  $('#res-xpfill').style.width = `${(before.rest / before.need) * 100}%`;
  setTimeout(() => { $('#res-xpfill').style.width = `${(after.lvl > before.lvl ? 100 : (after.rest / after.need) * 100)}%`; }, 300);
  if (after.lvl > before.lvl) setTimeout(() => { $('#res-xpfill').style.transition = 'none'; $('#res-xpfill').style.width = '0'; void $('#res-xpfill').offsetWidth; $('#res-xpfill').style.transition = ''; $('#res-xpfill').style.width = `${(after.rest / after.need) * 100}%`; toast(`⬆️ Niveau ${after.lvl} : ${titleFor(after.lvl)} !`); }, 1200);
  $('#res-badges').innerHTML = G.newBadges.map((id) => { const b = BADGES.find((x) => x.id === id); return `<div class="nb">${b.ico} Badge débloqué : ${b.name}</div>`; }).join('');
  $('#res-tip').textContent = acc < 70 && G.answered >= 5 ? 'Conseil : ralentis un poil. La précision d\'abord, la vitesse suit toute seule.' : pick(TIPS);

  const replay = { mode, trick: G.trick };
  $('#res-again').style.display = mode === 'daily' ? 'none' : '';
  $('#res-again').onclick = () => startGame(replay.mode, replay.trick);
  $('#res-home').onclick = () => show(mode === 'trick' ? 'tricks' : 'home');
  show('results');
  if (mode !== 'trick') countUp($('#res-score'), G.score);
}

function countUp(el, target) {
  const t0 = performance.now(), dur = 900;
  const step = (now) => {
    const p = Math.min(1, (now - t0) / dur);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* =========================================================
   Démarrage
   ========================================================= */
renderHome();

// iPhone : pas d'installation automatique, on explique comment faire (bouton Partager)
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
let hintClosed = false;
try { hintClosed = localStorage.getItem('install-hint-closed') === '1'; } catch (e) { /* ignore */ }
if (isIOS && !standalone && !hintClosed) $('#install-hint').classList.add('show');
$('#install-close').addEventListener('click', () => {
  $('#install-hint').classList.remove('show');
  try { localStorage.setItem('install-hint-closed', '1'); } catch (e) { /* ignore */ }
});
// Les iPhone ne savent pas vibrer depuis une page web
if (!navigator.vibrate) $('#vibrate-row').style.display = 'none';
// iOS peut remettre le son en pause : on le réveille à chaque toucher
document.addEventListener('touchend', () => { if (AC && AC.state !== 'running') audio(); }, { passive: true });

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
