/* =========================================================
   Zoh OS: storage, migration and date helpers
   ========================================================= */

const STORAGE_KEY = 'zoh-os-v3';   // never change: existing installs load from here
const SCHEMA_VERSION = 4;
const DAY = 86400000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MUSCLES = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core'];

/* ---------- dates (local time) ---------- */
function monthKey(ts) { const d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function mkLabel(mk) { const [y, m] = mk.split('-').map(Number); return MONTHS[m - 1] + ' ' + y; }
function mkShort(mk) { const [y, m] = mk.split('-').map(Number); return MONTHS[m - 1] + (m === 1 ? ' ’' + String(y).slice(2) : ''); }
function mkIndex(mk) { const [y, m] = mk.split('-').map(Number); return y * 12 + (m - 1); }
function indexToMk(i) { return Math.floor(i / 12) + '-' + String((i % 12) + 1).padStart(2, '0'); }
function addMonthsMk(mk, n) { return indexToMk(mkIndex(mk) + n); }
function monthBounds(mk) {
  const [y, m] = mk.split('-').map(Number);
  return { start: new Date(y, m - 1, 1).getTime(), end: new Date(y, m, 1).getTime() };
}
function daysInMonth(mk) { const [y, m] = mk.split('-').map(Number); return new Date(y, m, 0).getDate(); }
// Weeks run Monday to Sunday.
function weekStart(d = new Date()) {
  const day = d.getDay() || 7;
  const start = new Date(d); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - day + 1);
  return start;
}
function weekStartTs(ts = Date.now()) { return weekStart(new Date(ts)).getTime(); }
function addWeeks(ts, n) { const d = new Date(ts); d.setDate(d.getDate() + 7 * n); return d.getTime(); }
// Same formula as v3 so stored physique weeks still line up.
function weekKey(d = new Date()) {
  const ws = weekStart(d);
  return ws.getFullYear() + '-W' + Math.ceil(((ws - new Date(ws.getFullYear(), 0, 1)) / DAY + 1) / 7);
}
function quarterOf(ts = Date.now()) {
  const d = new Date(ts);
  const q = Math.floor(d.getMonth() / 3);
  return { year: d.getFullYear(), q: q + 1, key: d.getFullYear() + '-Q' + (q + 1) };
}
function quarterBounds(key) {
  const [y, qs] = key.split('-Q'); const q = Number(qs) - 1;
  const start = new Date(Number(y), q * 3, 1).getTime(), end = new Date(Number(y), q * 3 + 3, 1).getTime();
  const firstMk = y + '-' + String(q * 3 + 1).padStart(2, '0');
  return { start, end, key, label: 'Q' + (q + 1) + ' ' + y, months: [firstMk, addMonthsMk(firstMk, 1), addMonthsMk(firstMk, 2)] };
}
function addQuarters(key, n) {
  const [y, qs] = key.split('-Q');
  const i = Number(y) * 4 + Number(qs) - 1 + n;
  return Math.floor(i / 4) + '-Q' + ((i % 4) + 1);
}
function quarterOfMk(mk) { const [y, m] = mk.split('-').map(Number); return y + '-Q' + (Math.floor((m - 1) / 3) + 1); }
function dateInputToTs(val) {
  if (!val) return Date.now();
  const [y, m, d] = val.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).getTime();
}
function tsToDateInput(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function isoToTs(iso) { return dateInputToTs(iso); }
function daysAgo(ts) { return Math.floor((Date.now() - ts) / DAY); }
function sameDay(a, b) { return new Date(a).toDateString() === new Date(b).toDateString(); }

/* ---------- ids ---------- */
let _uidN = 0;
function uid(prefix = 'id') { _uidN = (_uidN + 1) % 1000; return prefix + '_' + Date.now().toString(36) + _uidN.toString(36) + Math.floor(Math.random() * 1296).toString(36); }

/* ---------- state ---------- */
function defaultState() {
  return {
    version: SCHEMA_VERSION,
    gym: { sessions: [], pbs: [], target: 4 },
    bjj: {
      sessions: [], instructionals: [], priorSessions: 0, compDate: null,
      perWeek: 2, rampTo: 3, sessionMinutes: 75, hoursTarget: 225, matlog: null,
    },
    career: {
      meetings: [], target: 8,
      // On-target quarterly bonus at level 1 was £1,995; promotion adds 25%.
      gartner: { level: 2, l1Bonus: 1995, uplift: 25, promotedFrom: '2026-Q4', takeHome: 72 },
    },
    sales: { closes: [], role: 'setter', active: true },
    money: {
      incomes: [], portfolio: 0, portfolioHistory: [], baseMonthly: 2000, usdToGbp: 0.74,
      target: 10000, targetDate: null,
      lanes: { setter: { perWeek: 2, avgDeal: 1800, rate: 5 }, closer: { perMonth: 5, avgDeal: 3000, rate: 10 } },
      milestonesIncome: [3000, 5000, 7500, 10000, 15000, 20000].map(a => ({ amount: a })),
      milestonesPortfolio: [2500, 5000, 10000, 20000, 50000].map(a => ({ amount: a })),
    },
    physique: { ratings: [] },
    injuries: [],
    wins: [],
    legacy: { items: [] },
    reviews: {},
    settings: { theme: 'dark', lastBackupAt: null, backupEveryDays: 7 },
    archive: {},
  };
}

function arr(v) { return Array.isArray(v) ? v : []; }
function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }

/* v2 (and earlier) saves had a different shape. Convert to the v3 shape first. */
function fromV2(old) {
  const s = { version: 3, gym: {}, bjj: {}, career: {}, sales: {}, money: {}, legacy: {} };
  if (old.gym) s.gym = { sessions: arr(old.gym.sessions), pbs: arr(old.gym.pbs) };
  if (old.bjj) s.bjj = Object.assign({}, old.bjj);
  if (old.career) s.career = { meetings: arr(old.career.meetings), target: old.career.target };
  if (old.sales) s.sales = { closes: arr(old.sales.closes), role: old.sales.role };
  const fin = old.money || old.finance;
  if (fin) {
    s.money = Object.assign({}, fin, {
      incomes: arr(fin.incomes).map(i => ({ monthKey: i.monthKey, amount: i.amount, updated: i.date || i.updated || Date.now() })),
    });
  }
  ['physique', 'injuries', 'wins', 'feed', 'reports'].forEach(k => { if (old[k]) s[k] = old[k]; });
  if (old.legacy) s.legacy = { items: arr(old.legacy.items) };
  if (old.weight && arr(old.weight.entries).length) s.archive = { weight: old.weight };
  return s;
}

/* Bring any older save (or imported backup) up to the current shape.
   Only adds or derives fields; records are never dropped. */
function migrate(input) {
  let d = JSON.parse(JSON.stringify(input || {}));
  if (!d.version) d = fromV2(d);
  const base = defaultState();
  const out = base;
  const before = d.version || 3;

  // ---- gym ----
  const g = obj(d.gym);
  out.gym.sessions = arr(g.sessions).map(x => ({
    id: x.id || uid('gym'), date: x.date, muscles: arr(x.muscles), notes: x.notes || '', quality: x.quality || null,
  }));
  out.gym.pbs = arr(g.pbs).map(x => ({ id: x.id || uid('pb'), date: x.date || Date.now(), name: x.name || '' }));
  if (g.target) out.gym.target = g.target;

  // ---- bjj ----
  const b = obj(d.bjj);
  out.bjj.sessions = arr(b.sessions).map(x => ({
    id: x.id || uid('bjj'), date: x.date, notes: x.notes || '', quality: x.quality || null,
    minutes: x.minutes || null, rounds: x.rounds || null,
  }));
  out.bjj.instructionals = arr(b.instructionals).map(i => ({
    id: i.id || uid('inst'), name: i.name || '', done: !!i.done, added: i.added || Date.now(), completed: i.completed || null,
  }));
  ['priorSessions', 'compDate', 'perWeek', 'rampTo', 'sessionMinutes', 'hoursTarget', 'matlog'].forEach(k => {
    if (b[k] !== undefined) out.bjj[k] = b[k];
  });
  if (b.benchmark) out.archive.bjjBenchmarkSessions = b.benchmark;

  // ---- career ----
  const c = obj(d.career);
  out.career.meetings = arr(c.meetings).map(m => ({ id: m.id || uid('mtg'), date: m.date, notes: m.notes || '' }));
  if (c.target) out.career.target = c.target;
  out.career.gartner = Object.assign(out.career.gartner, obj(c.gartner));

  // ---- sales ----
  const sl = obj(d.sales);
  out.sales.closes = arr(sl.closes).map(x => {
    // v2 stored 5% as 0.05; v3 stored it as 5. Normalise to percent.
    let rate = Number(x.rate) || 0;
    if (rate > 0 && rate < 1) rate = Math.round(rate * 10000) / 100;
    return { id: x.id || uid('close'), date: x.date, cash: Number(x.cash) || 0, rate, earnings: Number(x.earnings) || 0, role: x.role || 'setter' };
  });
  if (sl.role) out.sales.role = sl.role;
  if (sl.active !== undefined) out.sales.active = sl.active;

  // ---- money ----
  const m = obj(d.money);
  out.money.incomes = arr(m.incomes).map(i => ({
    id: i.id || uid('inc'), monthKey: i.monthKey, amount: Number(i.amount) || 0,
    sources: i.sources && typeof i.sources === 'object' ? i.sources : null, updated: i.updated || i.date || Date.now(),
  }));
  ['portfolio', 'baseMonthly', 'usdToGbp', 'target'].forEach(k => { if (m[k] != null) out.money[k] = m[k]; });
  out.money.portfolioHistory = arr(m.portfolioHistory);
  if (m.lanes) out.money.lanes = Object.assign(out.money.lanes, m.lanes);
  if (arr(m.milestonesIncome).length) out.money.milestonesIncome = m.milestonesIncome.map(x => ({ amount: x.amount }));
  if (arr(m.milestonesPortfolio).length) out.money.milestonesPortfolio = m.milestonesPortfolio.map(x => ({ amount: x.amount }));
  if (before >= 4) out.money.targetDate = m.targetDate || null;
  else if (m.targetDate) out.archive.oldTargetDate = m.targetDate;   // v4: no deadline by default

  // ---- the rest ----
  out.physique = { ratings: arr(obj(d.physique).ratings) };
  out.injuries = arr(d.injuries).map(i => Object.assign({ id: uid('inj') }, i));
  out.wins = arr(d.wins).map(w => ({ id: w.id || uid('win'), date: w.date || Date.now(), title: w.title || '', pillar: w.pillar || 'life' }));
  out.legacy.items = arr(obj(d.legacy).items).map(l => Object.assign({}, l));
  out.reviews = obj(d.reviews);
  out.settings = Object.assign(out.settings, obj(d.settings));
  out.archive = Object.assign(out.archive, obj(d.archive));
  // v3's feed, cached review and frozen report cards are replaced by live
  // calculations. Keep them in the archive rather than throwing them away.
  if (arr(d.feed).length) out.archive.feedV3 = d.feed;
  if (arr(d.reports).length) out.archive.reportsV3 = d.reports;
  if (d.review && d.review.cache) out.archive.reviewV3 = d.review;

  out.version = SCHEMA_VERSION;
  return out;
}

function loadState() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // older installs used other keys
      const old = localStorage.getItem('zoh-os-v2') || localStorage.getItem('zohos') || localStorage.getItem('zoh-os');
      return old ? migrate(JSON.parse(old)) : defaultState();
    }
    const parsed = JSON.parse(raw);
    if ((parsed.version || 0) < SCHEMA_VERSION) {
      // one-time safety copy before upgrading the data format
      try { localStorage.setItem(STORAGE_KEY + '_pre_v' + SCHEMA_VERSION, raw); } catch (_) {}
    }
    return migrate(parsed);
  } catch (e) {
    // Never silently throw away unreadable data; park it so it can be recovered.
    try { if (raw) localStorage.setItem(STORAGE_KEY + '_unreadable_' + Date.now(), raw); } catch (_) {}
    return defaultState();
  }
}

let state = loadState();

/* Derived values are cached between saves; any write clears them. */
let _cache = {};
function memo(key, fn) { return key in _cache ? _cache[key] : (_cache[key] = fn()); }
function clearCaches() { _cache = {}; }

function saveState() {
  clearCaches();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    if (typeof toast === 'function') toast('Could not save: storage full or blocked');
    return false;
  }
}

function isEmptyState(s = state) {
  return !s.gym.sessions.length && !s.bjj.sessions.length && !s.career.meetings.length
    && !s.sales.closes.length && !s.money.incomes.length;
}

/* ---------- backups ---------- */
function backupJSON() { return JSON.stringify(state, null, 2); }

// Returns { kind: 'zoh' | 'matlog' | 'unknown', data }
function classifyBackup(data) {
  if (!data || typeof data !== 'object') return { kind: 'unknown' };
  if (Array.isArray(data.sessions) && data.moves && typeof data.moves === 'object') return { kind: 'matlog', data };
  if (data.gym || data.bjj || data.career || data.money || data.finance || data.sales) return { kind: 'zoh', data };
  return { kind: 'unknown' };
}

/* ---------- MatLog link ----------
   Keep only what the belt estimate needs from a MatLog save. */
function matlogSnapshot(ml, source) {
  const sessions = arr(ml.sessions).map(s => ({
    date: s.date, minutes: s.minutes || 0, spars: s.spars || 0, feel: s.feel || 0,
    rolls: obj(s.rolls), positional: arr(s.positional),
  })).filter(s => typeof s.date === 'string');
  const moves = {};
  Object.entries(obj(ml.moves)).forEach(([id, v]) => { if (v && v.state) moves[id] = v.state; });
  const gp = obj(ml.gameplan);
  const escapePlans = ['mount-bottom', 'side-bottom', 'back-bottom'].filter(id => arr(gp[id] && gp[id].moves).length).length;
  const goals = obj(ml.goals);
  return {
    source, importedAt: Date.now(), sessions, moves, escapePlans,
    perWeek: goals.perWeek || null, rampTo: goals.rampTo || null,
    belt: ml.belt || 'white', stripes: ml.stripes || 0,
  };
}

// If MatLog shares this browser's storage (same site, same browser), read it directly.
function refreshMatlogFromLocal() {
  try {
    const raw = localStorage.getItem('matlog_v1');
    if (!raw) return false;
    state.bjj.matlog = matlogSnapshot(JSON.parse(raw), 'local');
    return true;
  } catch (_) { return false; }
}
