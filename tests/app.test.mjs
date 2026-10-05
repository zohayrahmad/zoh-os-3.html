import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const NOW = new Date(2026, 9, 5, 20).getTime();   // Mon 5 Oct 2026, 8pm
const at = (y, m, d) => new Date(y, m - 1, d, 12).getTime();

// A v3-era save with the same shape (and quirks) as a real one.
const v3 = {
  version: 3,
  gym: { sessions: [
    { date: at(2026, 9, 28), muscles: ['chest', 'arms'], notes: '', quality: 4 },
    { date: at(2026, 9, 30), muscles: ['back', 'shoulders'], notes: 'good', quality: 3 },
    { date: at(2026, 10, 5), muscles: ['legs', 'core'], notes: '', quality: null },
  ], pbs: [] },
  bjj: { sessions: [{ date: at(2026, 9, 30), notes: 'ankle locks', quality: 4 }], instructionals: [{ name: 'Kimura Trap - JD', done: true, added: 1, completed: at(2026, 4, 21) }],
    priorSessions: 28, benchmark: 200, compDate: '2026-06-20' },
  career: { meetings: [
    ...Array.from({ length: 8 }, () => ({ date: at(2026, 7, 10), notes: '' })),
    ...Array.from({ length: 9 }, () => ({ date: at(2026, 8, 10), notes: '' })),
    ...Array.from({ length: 9 }, () => ({ date: at(2026, 9, 30), notes: '' })),
    ...Array.from({ length: 13 }, () => ({ date: at(2026, 10, 4), notes: '' })),
  ], target: 8 },
  sales: { closes: [
    { date: at(2026, 6, 1), cash: 2500, earnings: 125, rate: 0.05, role: 'setter' },
    { date: at(2026, 7, 2), cash: 1000, earnings: 100, rate: 10, role: 'setter' },
  ], role: 'setter' },
  money: { incomes: [
    { monthKey: '2026-06', amount: 4400, updated: at(2026, 7, 1) },
    { monthKey: '2026-07', amount: 2900, updated: at(2026, 7, 28) },
    { monthKey: '2026-08', amount: 4200, updated: at(2026, 9, 4) },
    { monthKey: '2026-09', amount: 2100, updated: at(2026, 9, 29) },
  ], portfolio: 0, portfolioHistory: [], baseMonthly: 2000, targetDate: '2026-12', usdToGbp: 0.74,
    lanes: { setter: { perWeek: 2, avgDeal: 1800, rate: 5 }, closer: { perMonth: 5, avgDeal: 3000, rate: 10 } },
    milestonesIncome: [3000, 5000, 7500, 10000].map(amount => ({ amount })), milestonesPortfolio: [{ amount: 2500 }] },
  physique: { ratings: [{ week: '2026-W40', value: 4, date: at(2026, 10, 4) }] },
  injuries: [{ id: 'inj-arm', name: 'Right arm', started: at(2026, 5, 5), resolved: at(2026, 6, 10), notes: '' }],
  wins: [],
  legacy: { items: [{ id: 9, name: 'First £10k Month', done: false, hitDate: null, locked: false }] },
  feed: [{ date: 1, title: 'Gym session', sub: '+25 XP' }],
  reports: [{ monthKey: '2026-08', grades: [{ pillar: 'Money', grade: 'C', note: 'No income logged' }], overall: 'D' }],
  review: { cache: 'old', cacheWeek: '2026-W40', cacheDate: 1 },
  archive: { weight: { entries: [{ date: 1, value: 64.4 }], target: 60.5 } },
};
const boot = (data = v3) => loadApp({ 'zoh-os-v3': JSON.stringify(data) }, NOW);

test('upgrade keeps every record and saves a pre-upgrade copy', () => {
  const app = boot();
  const s = app.run('state');
  assert.equal(s.version, 4);
  assert.equal(s.gym.sessions.length, 3);
  assert.equal(s.bjj.sessions.length, 1);
  assert.equal(s.career.meetings.length, 39);
  assert.equal(s.sales.closes.length, 2);
  assert.equal(s.money.incomes.length, 4);
  assert.equal(s.injuries.length, 1);
  assert.equal(s.legacy.items.length, 1);
  assert.ok(s.gym.sessions.every(x => x.id), 'stable ids');
  assert.equal(s.archive.weight.entries.length, 1, 'weight history kept');
  assert.equal(s.archive.feedV3.length, 1, 'old feed archived');
  assert.equal(s.archive.reportsV3.length, 1, 'frozen report cards archived');
  assert.ok(app.store['zoh-os-v3_pre_v4'], 'pre-upgrade copy saved');
});

test('commission rates are normalised to percent', () => {
  const s = boot().run('state.sales.closes.map(c => c.rate)');
  assert.deepEqual(s, [5, 10]);
});

test('no deadline after the upgrade; the old one is archived', () => {
  const app = boot();
  assert.equal(app.run('state.money.targetDate'), null);
  assert.equal(app.run('state.archive.oldTargetDate'), '2026-12');
  assert.equal(app.run('state.money.target'), 10000);
});

test('v2 saves without a version still migrate', () => {
  const v2 = { gym: { xp: 0, sessions: [{ date: at(2026, 4, 21), muscles: ['chest'], notes: 'x' }], pbs: [] },
    finance: { incomes: [{ date: 5, monthKey: '2026-04', amount: 2250 }], portfolio: 0 },
    weight: { entries: [{ date: 1, value: 64 }], target: 60.5 }, career: { meetings: [{ date: at(2026, 4, 21) }] } };
  const s = boot(v2).run('state');
  assert.equal(s.version, 4);
  assert.equal(s.gym.sessions.length, 1);
  assert.equal(s.money.incomes[0].amount, 2250);
  assert.equal(s.career.meetings.length, 1);
  assert.equal(s.archive.weight.entries.length, 1);
});

test('Gartner bonus: level 2 is level 1 + 25%, paid on the quarter curve', () => {
  const app = boot();
  assert.equal(app.run('onTargetBonus("2026-Q4")'), 1995 * 1.25);
  assert.equal(app.run('onTargetBonus("2026-Q3")'), 1995, 'quarters before promotion use level 1');
  assert.equal(app.run('payoutPct(100)'), 100);
  assert.equal(app.run('payoutPct(170)'), 150);
  assert.equal(app.run('payoutPct(200)'), 150, 'capped');
  assert.equal(app.run('payoutPct(50)'), 50);
  const q3 = app.run('quarterBonus("2026-Q3")');
  assert.equal(q3.count, 26);
  assert.equal(q3.qTarget, 24);
  assert.ok(Math.abs(q3.amount - 1995 * (100 + (26 / 24 * 100 - 100) * 50 / 70) / 100) < 1e-6);
  const g = app.run('gartnerNow()');
  assert.equal(g.count, 13);
  assert.equal(g.onTarget, 2493.75);
  assert.equal(g.max, 2493.75 * 1.5);
  assert.ok(Math.abs(g.perMeetingBelow - 2493.75 / 24) < 1e-9);
});

test('meetings count by month, whatever the day', () => {
  const app = boot();
  assert.equal(app.run('meetingsInMonth("2026-09")'), 9);
  assert.equal(app.run('meetingsInMonth("2026-10")'), 13);
});

test('report cards are live: income logged later shows up', () => {
  const app = boot();
  const aug = app.run('monthReport("2026-08")');
  const inc = aug.grades.find(g => g.pillar === 'money');
  assert.equal(inc.value, 4200);
  assert.notEqual(inc.note, 'No income logged');
  const sep = app.run('monthReport("2026-09")');
  assert.equal(sep.grades.find(g => g.pillar === 'career').value, 9);
});

test('income by source sums, and legacy totals stay intact', () => {
  const app = boot();
  app.run('state.money.incomes.push({ id: "x", monthKey: "2026-10", amount: 0, sources: { base: 2000, commission: 150, bonus: 2114, other: 0 } }); clearCaches(); 0');
  assert.equal(app.run('incomeTotal(incomeFor("2026-10"))'), 4264);
  assert.equal(app.run('incomeTotal(incomeFor("2026-09"))'), 2100);
  assert.equal(app.run('suggestedSources("2026-07").commission'), Math.round(100 * 0.74));
});

test('money path has no deadline by default and uses the 3-month average', () => {
  const p = boot().run('moneyPath()');
  assert.equal(p.deadline, null);
  assert.equal(Math.round(p.ref), Math.round((2900 + 4200 + 2100) / 3));
  assert.equal(p.target, 10000);
});

test('a weekly review sets next week\'s targets and counts toward the score', () => {
  const app = boot();
  const before = app.run('weekScore(weekStartTs()).score');
  app.run(`state.reviews[reviewKey(addWeeks(weekStartTs(), -1))] = { completedAt: Date.now(), next: { gym: 3, bjj: 1, closes: 0, focus: 'Legs' } }; clearCaches(); 0`);
  const t = app.run('targetsFor(weekStartTs())');
  assert.deepEqual([t.gym, t.bjj, t.focus, t.fromReview], [3, 1, 'Legs', true]);
  assert.ok(app.run('weekScore(weekStartTs()).score') > before);
  assert.equal(app.run('reviewDue()'), null, 'last week is reviewed');
});

test('automatic wins come from the data', () => {
  const titles = boot().run('autoWins().map(w => w.title)');
  assert.ok(titles.some(t => t.startsWith('First £3,000 month')));
  assert.ok(titles.some(t => t.includes('Q3 2026: quarter target hit')));
  assert.ok(titles.some(t => t.startsWith('Back from injury')));
  const ids = boot().run('autoWins().map(w => w.id)');
  assert.equal(new Set(ids).size, ids.length, 'no duplicates');
});

test('belt estimate without Mat Log uses mat time, rating and consistency', () => {
  const b = boot().run('beltEstimate()');
  assert.equal(b.linked, false);
  assert.equal(b.pillars.find(p => p.id === 'skill').score, null);
  assert.equal(b.prior, 28);
  assert.ok(Math.abs(b.hours - (28 + 1) * 75 / 60) < 1e-9);
  assert.ok(b.pct > 0 && b.pct < 100);
});

test('Mat Log link merges sessions per day without double counting', () => {
  const app = boot();
  app.ctx.__ml = { sessions: [{ date: '2026-09-30', minutes: 90, spars: 4, feel: 3 }, { date: '2026-10-01', minutes: 60, spars: 3, feel: 2 }], moves: { e1: { state: 3 } } };
  app.run('state.bjj.matlog = matlogSnapshot(__ml, "test"); clearCaches(); 0');
  const all = app.run('bjjSessionsAll()');
  assert.equal(all.length, 2, '30 Sep counted once');
  assert.equal(all.find(s => s.source === 'matlog' && s.minutes === 90) != null, true);
  const b = app.run('beltEstimate()');
  assert.equal(b.linked, true);
  assert.notEqual(b.pillars.find(p => p.id === 'skill').score, null);
});

test('backups are classified', () => {
  const app = boot();
  assert.equal(app.run('classifyBackup(state).kind'), 'zoh');
  assert.equal(app.run('classifyBackup({ sessions: [], moves: {} }).kind'), 'matlog');
  assert.equal(app.run('classifyBackup({ foo: 1 }).kind'), 'unknown');
});

test('unreadable data is parked, not thrown away', () => {
  const app = loadApp({ 'zoh-os-v3': '{not json' }, NOW);
  assert.ok(Object.keys(app.store).some(k => k.startsWith('zoh-os-v3_unreadable_')));
  assert.equal(app.run('state.version'), 4);
});
