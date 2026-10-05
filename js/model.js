/* =========================================================
   Zoh OS: analytics. Pure functions over `state`; everything is
   recalculated live, so backfilled data always shows up.
   ========================================================= */

/* ---------- money helpers ---------- */
function fx() { return state.money.usdToGbp || 0.74; }
function usdToGbp(n) { return n * fx(); }
function gbpToUsd(n) { return fx() > 0 ? n / fx() : n; }
function sum(list, f = x => x) { return list.reduce((a, x) => a + (Number(f(x)) || 0), 0); }
function inRange(list, start, end) { return list.filter(x => x.date >= start && x.date < end); }
function clamp01(v) { return Math.max(0, Math.min(1, v)); }

/* ---------- targets ----------
   Weekly targets come from last week's review when one set them. */
function reviewKey(ts = Date.now()) { return tsToDateInput(weekStartTs(ts)); }
function targetsFor(ws) {
  const prev = state.reviews[reviewKey(addWeeks(ws, -1))];
  const t = (prev && prev.next) || {};
  return {
    gym: t.gym != null ? t.gym : state.gym.target,
    bjj: t.bjj != null ? t.bjj : state.bjj.perWeek,
    closes: t.closes != null ? t.closes : null,
    focus: t.focus || '',
    fromReview: !!(prev && prev.next),
  };
}

/* ---------- counts ---------- */
function gymIn(start, end) { return inRange(state.gym.sessions, start, end); }
function bjjIn(start, end) { return bjjSessionsAll().filter(s => s.date >= start && s.date < end); }
function closesIn(start, end) { return inRange(state.sales.closes, start, end); }
// Meetings are logged in the right month but not always on the right day,
// so they are only ever counted by month or quarter.
function meetingsInMonth(mk) { return state.career.meetings.filter(m => monthKey(m.date) === mk).length; }
function meetingsInQuarter(qKey) { const b = quarterBounds(qKey); return state.career.meetings.filter(m => m.date >= b.start && m.date < b.end).length; }
function closesInMonth(mk) { const b = monthBounds(mk); return closesIn(b.start, b.end); }
function cashInMonth(mk) { return sum(closesInMonth(mk), c => c.cash); }
function commissionUSD(mk) { return sum(closesInMonth(mk), c => c.earnings); }

function weekCounts(ws) {
  const we = addWeeks(ws, 1);
  const closes = closesIn(ws, we);
  return { gym: gymIn(ws, we).length, bjj: bjjIn(ws, we).length, closes: closes.length, cash: sum(closes, c => c.cash) };
}

// Consecutive weeks hitting a target. An unfinished current week never breaks it.
function targetStreak(countFn, targetFn) {
  let ws = weekStartTs(), streak = 0;
  if (countFn(ws) >= targetFn(ws)) streak++;
  ws = addWeeks(ws, -1);
  for (let i = 0; i < 260; i++) {
    if (countFn(ws) >= targetFn(ws) && targetFn(ws) > 0) { streak++; ws = addWeeks(ws, -1); } else break;
  }
  let best = 0, run = 0;
  for (let i = 104; i >= 0; i--) {
    const w = addWeeks(weekStartTs(), -i);
    if (countFn(w) >= targetFn(w) && targetFn(w) > 0) { run++; best = Math.max(best, run); } else if (i > 0) run = 0;
  }
  return { current: streak, best: Math.max(best, streak) };
}
function gymStreak() { return targetStreak(ws => gymIn(ws, addWeeks(ws, 1)).length, ws => targetsFor(ws).gym); }
function bjjStreak() { return targetStreak(ws => bjjIn(ws, addWeeks(ws, 1)).length, ws => targetsFor(ws).bjj); }
function trailingRate(items, weeks = 4) {
  const since = addWeeks(weekStartTs(), -(weeks - 1));
  const n = items.filter(x => x.date >= since).length;
  const elapsed = weeks - 1 + Math.min(7, Math.floor((Date.now() - weekStartTs()) / DAY) + 1) / 7;
  return n / elapsed;
}
function lastDate(items) { return items.length ? Math.max(...items.map(x => x.date)) : null; }

/* ---------- gym ---------- */
function muscleCoverage(weeks = 4) {
  const since = Date.now() - weeks * 7 * DAY;
  const counts = {}; MUSCLES.forEach(m => { counts[m] = 0; });
  state.gym.sessions.filter(s => s.date >= since).forEach(s => s.muscles.forEach(m => { if (counts[m] != null) counts[m]++; }));
  return { counts, hit: MUSCLES.filter(m => counts[m] > 0).length, total: MUSCLES.length, missing: MUSCLES.filter(m => counts[m] === 0) };
}
function latestPhysiqueRating() {
  const r = state.physique.ratings;
  return r.length ? r.slice().sort((a, b) => b.date - a.date)[0] : null;
}
function physiqueScore() {
  const consistency = Math.min(1, trailingRate(state.gym.sessions) / (state.gym.target || 4));
  const cov = muscleCoverage();
  const balance = cov.hit / cov.total;
  const r = latestPhysiqueRating();
  const rating = r ? r.value / 10 : null;
  const score = Math.round((rating === null ? consistency * 0.65 + balance * 0.35 : consistency * 0.5 + balance * 0.3 + rating * 0.2) * 100);
  return { score, consistency, balance, rating, ratedThisWeek: r ? r.week === weekKey() : false };
}
// The muscle combos you actually train, most common first: one-tap templates.
function gymTemplates() {
  const counts = {};
  state.gym.sessions.slice(-30).forEach(s => {
    if (!s.muscles.length) return;
    const k = s.muscles.slice().sort((a, b) => MUSCLES.indexOf(a) - MUSCLES.indexOf(b)).join('+');
    counts[k] = (counts[k] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => k.split('+'));
}

/* ---------- income ---------- */
const INCOME_SOURCES = [
  { id: 'base', label: 'Gartner base' },
  { id: 'commission', label: 'Commission' },
  { id: 'bonus', label: 'Gartner bonus' },
  { id: 'other', label: 'Other' },
];
function incomeTotal(i) { return i.sources ? sum(Object.values(i.sources)) : (i.amount || 0); }
function incomesSorted() { return state.money.incomes.slice().sort((a, b) => mkIndex(a.monthKey) - mkIndex(b.monthKey)); }
function incomeFor(mk) { return state.money.incomes.find(i => i.monthKey === mk) || null; }
function latestIncome() { const l = incomesSorted(); return l.length ? l[l.length - 1] : null; }
function bestIncome() { return state.money.incomes.reduce((b, i) => (!b || incomeTotal(i) > incomeTotal(b) ? i : b), null); }
// Suggested split for a month: base from settings, commission from logged closes.
function suggestedSources(mk) {
  return {
    base: state.money.baseMonthly || 0,
    commission: state.sales.active ? Math.round(usdToGbp(commissionUSD(mk))) : 0,
    bonus: 0, other: 0,
  };
}
function incomeTrend() {
  const inc = incomesSorted().slice(-6);
  const pts = inc.map(i => ({ x: mkIndex(i.monthKey), y: incomeTotal(i) }));
  let slope = null;
  if (pts.length >= 3) {
    const n = pts.length, mx = sum(pts, p => p.x) / n, my = sum(pts, p => p.y) / n;
    let num = 0, den = 0;
    pts.forEach(p => { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2; });
    slope = den ? num / den : null;
  }
  const last3 = incomesSorted().slice(-3);
  const avg3 = last3.length ? sum(last3, incomeTotal) / last3.length : 0;
  const best = bestIncome();
  return { slope, avg3, best: best ? incomeTotal(best) : 0, bestMk: best ? best.monthKey : null, months: inc.length };
}
function monthProjection() {
  const now = new Date(), mk = monthKey(now.getTime());
  const d = now.getDate(), D = daysInMonth(mk);
  const commSoFar = state.sales.active ? usdToGbp(commissionUSD(mk)) : 0;
  const projComm = (commSoFar / d) * D;
  const base = state.money.baseMonthly || 0;
  const logged = incomeFor(mk);
  return { mk, d, D, commSoFar, cashSoFar: cashInMonth(mk), projected: Math.round(base + projComm), logged: logged ? incomeTotal(logged) : null, base };
}
function moneyPath() {
  const M = state.money, target = M.target || 10000;
  const tr = incomeTrend();
  const ref = tr.avg3 || M.baseMonthly || 0;
  const gap = Math.max(0, target - ref);
  const monthsAtTrend = tr.slope && tr.slope > 10 ? Math.ceil(gap / tr.slope) : null;
  const etaMk = monthsAtTrend != null ? addMonthsMk(monthKey(Date.now()), monthsAtTrend) : null;
  // What it takes, per month, on top of base and an on-target Gartner bonus.
  const bonusMonthly = onTargetBonus(quarterOf().key) / 3;
  const commNeeded = Math.max(0, target - (M.baseMonthly || 0) - bonusMonthly);
  const setterRate = (M.lanes.setter.rate || 5) / 100, closerRate = (M.lanes.closer.rate || 10) / 100;
  const setterCash = setterRate ? gbpToUsd(commNeeded / setterRate) : 0;
  const closerCash = closerRate ? gbpToUsd(commNeeded / closerRate) : 0;
  let deadline = null;
  if (M.targetDate) {
    const monthsLeft = Math.max(1, mkIndex(M.targetDate) - mkIndex(monthKey(Date.now())));
    deadline = { mk: M.targetDate, monthsLeft, growthPerMonth: gap / monthsLeft, onPace: tr.slope != null && tr.slope >= gap / monthsLeft };
  }
  return {
    target, ref, gap, trend: tr, monthsAtTrend, etaMk, bonusMonthly, commNeeded, deadline,
    setterCash, closerCash,
    setterDeals: M.lanes.setter.avgDeal ? setterCash / M.lanes.setter.avgDeal : null,
    closerDeals: M.lanes.closer.avgDeal ? closerCash / M.lanes.closer.avgDeal : null,
  };
}
function incomeMilestones() {
  const inc = incomesSorted();
  return state.money.milestonesIncome.map(m => {
    const hit = inc.find(i => incomeTotal(i) >= m.amount);
    return { amount: m.amount, hit: !!hit, mk: hit ? hit.monthKey : null };
  });
}
function portfolioMilestones() {
  const maxVal = Math.max(state.money.portfolio || 0, ...state.money.portfolioHistory.map(h => h.value || 0), 0);
  return state.money.milestonesPortfolio.map(m => {
    const h = state.money.portfolioHistory.find(x => x.value >= m.amount);
    return { amount: m.amount, hit: maxVal >= m.amount, date: h ? h.date : null };
  });
}
function nextIncomeMilestone(ref) {
  const m = state.money.milestonesIncome.map(x => x.amount).sort((a, b) => a - b).find(a => a > ref);
  return m || state.money.target || 10000;
}

/* ---------- Gartner bonus ----------
   Bonus is paid per quarter on meetings vs the quarter target (monthly
   target x 3). Up to 100% attainment it pays pro rata; from 100% to 170%
   it climbs to a 150% payout cap. */
function quarterIndex(key) { const [y, q] = key.split('-Q').map(Number); return y * 4 + q - 1; }
function onTargetBonus(qKey) {
  const G = state.career.gartner;
  const promoted = G.promotedFrom && quarterIndex(qKey) >= quarterIndex(G.promotedFrom);
  return (G.l1Bonus || 0) * (promoted ? 1 + (G.uplift || 0) / 100 : 1);
}
function payoutPct(att) { return att <= 100 ? Math.max(0, att) : Math.min(150, 100 + (att - 100) * (50 / 70)); }
function quarterBonus(qKey) {
  const t = state.career.target || 8, qTarget = t * 3;
  const count = meetingsInQuarter(qKey);
  const att = qTarget ? count / qTarget * 100 : 0;
  const pay = payoutPct(att);
  const otb = onTargetBonus(qKey);
  const b = quarterBounds(qKey);
  return {
    key: qKey, label: b.label, months: b.months, count, qTarget, att, pay, onTarget: otb,
    amount: otb * pay / 100, max: otb * 1.5, maxMeetings: Math.ceil(qTarget * 1.7),
    takeHome: otb * pay / 100 * (state.career.gartner.takeHome || 100) / 100,
    perMeetingBelow: otb / qTarget, perMeetingAbove: (otb * 0.5) / (qTarget * 0.7),
  };
}
function gartnerNow() {
  const q = quarterOf().key, b = quarterBounds(q);
  const qb = quarterBonus(q);
  const t = state.career.target || 8;
  const mk = monthKey(Date.now());
  const monthInQ = b.months.indexOf(mk) + 1;
  const elapsed = clamp01((Date.now() - b.start) / (b.end - b.start));
  const projectedCount = elapsed > 0.08 ? Math.round(qb.count / elapsed) : null;
  const projAtt = projectedCount != null ? projectedCount / qb.qTarget * 100 : null;
  const projPay = projAtt != null ? payoutPct(projAtt) : null;
  const dueSoFar = t * monthInQ;
  return Object.assign(qb, {
    monthCount: meetingsInMonth(mk), monthInQ, target: t, elapsed,
    catchUp: Math.max(0, dueSoFar - qb.count), toTarget: Math.max(0, qb.qTarget - qb.count), toMax: Math.max(0, qb.maxMeetings - qb.count),
    projectedCount, projAtt, projPay, projAmount: projPay != null ? qb.onTarget * projPay / 100 : null,
    paceRatio: elapsed > 0 ? (qb.count / qb.qTarget) / elapsed : 1,
    monthly: b.months.map(m => ({ mk: m, count: meetingsInMonth(m), future: mkIndex(m) > mkIndex(mk) })),
  });
}
function gartnerHistory() {
  if (!state.career.meetings.length) return [];
  const first = quarterOf(Math.min(...state.career.meetings.map(m => m.date))).key;
  const out = [];
  for (let k = first; quarterIndex(k) <= quarterIndex(quarterOf().key); k = addQuarters(k, 1)) out.push(quarterBonus(k));
  return out.reverse();
}

/* ---------- drift ---------- */
function driftFlags() {
  const flags = [];
  const check = (key, name, items, days) => {
    const last = lastDate(items);
    if (last === null) return;
    const d = daysAgo(last);
    if (d >= days) flags.push({ key, name, days: d, severity: d >= days * 2 ? 'risk' : 'warn' });
  };
  check('gym', 'Gym', state.gym.sessions, 5);
  check('bjj', 'BJJ', bjjSessionsAll(), 10);
  if (state.sales.active) check('sales', 'Sales', state.sales.closes, 21);
  state.injuries.filter(i => !i.resolved && daysAgo(i.started) >= 14).forEach(i => flags.push({ key: 'injury', name: i.name, days: daysAgo(i.started), severity: 'warn', injury: i }));
  return flags.sort((a, b) => b.days - a.days);
}

/* ---------- weekly score (0-100) ----------
   Behaviour you control in a week, against the targets you set. */
const SCORE_WEIGHTS = { gym: 30, bjj: 20, career: 20, sales: 15, review: 15 };
function weekScore(ws) {
  const we = addWeeks(ws, 1);
  const now = Date.now();
  const t = targetsFor(ws);
  const c = weekCounts(ws);
  const parts = {};
  parts.gym = t.gym ? clamp01(c.gym / t.gym) : 1;
  parts.bjj = t.bjj ? clamp01(c.bjj / t.bjj) : 1;
  // Meetings: month-to-date pace at the end of this week.
  const asOf = Math.min(we - 1, now);
  const mk = monthKey(asOf);
  const frac = new Date(asOf).getDate() / daysInMonth(mk);
  const due = (state.career.target || 8) * frac;
  parts.career = due ? clamp01(meetingsInMonth(mk) / due) : 1;
  if (state.sales.active) parts.sales = t.closes ? clamp01(c.closes / t.closes) : (c.closes > 0 ? 1 : 0);
  const rv = state.reviews[reviewKey(addWeeks(ws, -1))];
  parts.review = rv && rv.completedAt ? 1 : 0;
  let wSum = 0, total = 0;
  Object.entries(parts).forEach(([k, v]) => { wSum += SCORE_WEIGHTS[k]; total += v * SCORE_WEIGHTS[k]; });
  return { ws, score: Math.round(total / wSum * 100), parts, counts: c, targets: t };
}
function weekScoreSeries(n = 12) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(weekScore(addWeeks(weekStartTs(), -i)));
  return out;
}

/* ---------- report cards (always live) ---------- */
function gradeFromRatio(r) { return r >= 1 ? 'A' : r >= 0.8 ? 'B' : r >= 0.6 ? 'C' : r >= 0.4 ? 'D' : 'F'; }
const GPA = { A: 4, B: 3, C: 2, D: 1, F: 0 };
function monthReport(mk) {
  const b = monthBounds(mk);
  const isCurrent = mk === monthKey(Date.now());
  const end = isCurrent ? Date.now() : b.end;
  const weeks = Math.max(1, (end - b.start) / (7 * DAY));
  const gymN = gymIn(b.start, b.end).length, bjjN = bjjIn(b.start, b.end).length;
  const meetN = meetingsInMonth(mk);
  const closes = closesInMonth(mk), cash = sum(closes, c => c.cash), comm = sum(closes, c => c.earnings);
  const meetDue = (state.career.target || 8) * (isCurrent ? new Date().getDate() / daysInMonth(mk) : 1);
  const grades = [
    { pillar: 'gym', name: 'Gym', grade: gradeFromRatio(gymN / ((state.gym.target || 4) * weeks)), value: gymN, note: gymN + ' sessions · ' + (gymN / weeks).toFixed(1) + '/wk vs ' + state.gym.target },
    { pillar: 'bjj', name: 'BJJ', grade: gradeFromRatio(bjjN / ((state.bjj.perWeek || 2) * weeks)), value: bjjN, note: bjjN + ' sessions · ' + (bjjN / weeks).toFixed(1) + '/wk vs ' + state.bjj.perWeek },
    { pillar: 'career', name: 'Gartner', grade: gradeFromRatio(meetN / meetDue), value: meetN, note: meetN + ' meetings vs ' + state.career.target + '/mo' },
  ];
  if (state.sales.active) {
    const prevCash = cashInMonth(addMonthsMk(mk, -1));
    grades.push({ pillar: 'sales', name: 'Sales', grade: cash >= 10000 ? 'A' : cash >= 6000 ? 'B' : cash >= 3000 ? 'C' : cash > 0 ? 'D' : 'F', value: cash,
      note: closes.length + ' closes · $' + Math.round(cash).toLocaleString() + ' collected' + (prevCash ? ' (prev $' + Math.round(prevCash).toLocaleString() + ')' : '') });
  }
  const inc = incomeFor(mk);
  if (inc) {
    const prev = incomesSorted().filter(i => mkIndex(i.monthKey) < mkIndex(mk)).slice(-3);
    const prevAvg = prev.length ? sum(prev, incomeTotal) / prev.length : null;
    const v = incomeTotal(inc);
    const ch = prevAvg ? (v - prevAvg) / prevAvg * 100 : null;
    const grade = ch == null ? 'C' : ch >= 15 ? 'A' : ch >= 5 ? 'B' : ch >= -5 ? 'C' : ch >= -20 ? 'D' : 'F';
    grades.push({ pillar: 'money', name: 'Income', grade, value: v, note: '£' + Math.round(v).toLocaleString() + (ch != null ? ' · ' + (ch >= 0 ? '+' : '') + ch.toFixed(0) + '% vs 3-mo avg' : '') });
  } else if (!isCurrent) {
    grades.push({ pillar: 'money', name: 'Income', grade: null, value: null, note: 'Not logged yet' });
  }
  const graded = grades.filter(g => g.grade);
  const avg = graded.length ? sum(graded, g => GPA[g.grade]) / graded.length : 0;
  const overall = avg >= 3.5 ? 'A' : avg >= 2.5 ? 'B' : avg >= 1.5 ? 'C' : avg >= 0.8 ? 'D' : 'F';
  return { mk, grades, overall, gpa: avg, isCurrent };
}
function firstDataMonth() {
  const dates = [...state.gym.sessions, ...state.bjj.sessions, ...state.sales.closes, ...state.career.meetings].map(x => x.date);
  const mks = state.money.incomes.map(i => i.monthKey);
  const idx = [...dates.map(d => mkIndex(monthKey(d))), ...mks.map(mkIndex)];
  return idx.length ? indexToMk(Math.min(...idx)) : monthKey(Date.now());
}
function monthReports() {
  const out = [];
  for (let i = mkIndex(monthKey(Date.now())); i >= mkIndex(firstDataMonth()); i--) out.push(monthReport(indexToMk(i)));
  return out;
}

/* ---------- period summaries for the review ---------- */
function periodRange(kind, anchor) {
  if (kind === 'week') { const s = weekStartTs(anchor); return { start: s, end: addWeeks(s, 1), label: weekLabel(s) }; }
  if (kind === 'month') { const mk = monthKey(anchor); const b = monthBounds(mk); return Object.assign(b, { label: mkLabel(mk), mk }); }
  const q = quarterBounds(quarterOf(anchor).key); return Object.assign({}, q);
}
function shiftAnchor(kind, anchor, n) {
  if (kind === 'week') return addWeeks(anchor, n);
  const d = new Date(anchor); d.setDate(1); d.setMonth(d.getMonth() + (kind === 'month' ? n : 3 * n)); return d.getTime();
}
function weekLabel(ws) {
  const s = new Date(ws), e = new Date(addWeeks(ws, 1) - DAY);
  return s.getDate() + ' ' + MONTHS[s.getMonth()] + ' – ' + e.getDate() + ' ' + MONTHS[e.getMonth()];
}
function periodStats(kind, anchor) {
  const r = periodRange(kind, anchor);
  const end = Math.min(r.end, Date.now());
  const weeks = Math.max(1 / 7, (end - r.start) / (7 * DAY));
  const closes = closesIn(r.start, r.end);
  const gymS = gymIn(r.start, r.end), bjjS = bjjIn(r.start, r.end);
  const months = kind === 'week' ? [] : kind === 'month' ? [r.mk] : r.months;
  const meetings = kind === 'week' ? null : sum(months, meetingsInMonth);
  const income = kind === 'week' ? null : sum(months.map(incomeFor).filter(Boolean), incomeTotal);
  const incomeMonths = months.filter(incomeFor).length;
  const injuries = state.injuries.filter(i => i.started < r.end && (!i.resolved || i.resolved >= r.start));
  return {
    kind, range: r, weeks,
    gym: gymS.length, gymQ: avgOf(gymS.map(s => s.quality)), bjj: bjjS.length, bjjHours: sum(bjjS, s => s.minutes) / 60,
    closes: closes.length, cash: sum(closes, c => c.cash), earned: sum(closes, c => c.earnings),
    meetings, income, incomeMonths,
    muscles: MUSCLES.map(m => ({ m, n: gymS.filter(s => s.muscles.includes(m)).length })),
    wins: allWins().filter(w => w.date >= r.start && w.date < r.end),
    injuries,
  };
}
function avgOf(list) { const v = list.filter(x => x); return v.length ? sum(v) / v.length : null; }

/* ---------- weekly review accountability ---------- */
function reviewFor(ws) { return state.reviews[reviewKey(ws)] || null; }
function lastWeekPlanCheck() {
  // Targets set in last week's review vs what happened this week (or the most recent completed week).
  const ws = weekStartTs();
  const plan = targetsFor(ws);
  const c = weekCounts(ws);
  const rows = [
    { key: 'gym', label: 'Gym sessions', target: plan.gym, actual: c.gym },
    { key: 'bjj', label: 'BJJ sessions', target: plan.bjj, actual: c.bjj },
  ];
  if (state.sales.active && plan.closes) rows.push({ key: 'closes', label: 'Closes', target: plan.closes, actual: c.closes });
  return { rows, focus: plan.focus, fromReview: plan.fromReview };
}
function planHitHistory(n = 8) {
  // For each past week whose targets came from a review: share of targets hit.
  const out = [];
  for (let i = n; i >= 1; i--) {
    const ws = addWeeks(weekStartTs(), -i);
    const t = targetsFor(ws);
    if (!t.fromReview) continue;
    const c = weekCounts(ws);
    const items = [[c.gym, t.gym], [c.bjj, t.bjj]];
    if (t.closes) items.push([c.closes, t.closes]);
    const hit = items.filter(([a, b]) => a >= b).length;
    out.push({ ws, hit, total: items.length });
  }
  return out;
}
function reviewStreak() {
  let n = 0, ws = addWeeks(weekStartTs(), -1);
  if (reviewFor(weekStartTs()) && reviewFor(weekStartTs()).completedAt) n++;
  for (let i = 0; i < 260; i++) { const r = reviewFor(ws); if (r && r.completedAt) { n++; ws = addWeeks(ws, -1); } else break; }
  return n;
}
// The review is due from Friday; the previous week's is still open until done.
function reviewDue() {
  const now = new Date(), dow = now.getDay() || 7;
  const thisWeek = reviewFor(weekStartTs());
  if (dow >= 5 && !(thisWeek && thisWeek.completedAt)) return { ws: weekStartTs(), label: 'this week' };
  const lastWs = addWeeks(weekStartTs(), -1);
  const last = reviewFor(lastWs);
  if (dow <= 2 && !(last && last.completedAt)) return { ws: lastWs, label: 'last week' };
  return null;
}

/* ---------- insights ---------- */
function correlationInsights() {
  const out = [];
  const weeks = [];
  for (let i = 12; i >= 1; i--) weeks.push(weekCounts(addWeeks(weekStartTs(), -i)));
  const active = weeks.filter(w => w.gym || w.bjj || w.cash);
  if (active.length < 4) return [{ text: 'Patterns unlock after 4 active weeks. ' + active.length + ' so far.' }];
  const gt = state.gym.target || 4;
  const heavy = weeks.filter(w => w.gym >= gt), light = weeks.filter(w => w.gym > 0 && w.gym < gt);
  if (heavy.length >= 2 && light.length >= 2) {
    const h = sum(heavy, w => w.bjj) / heavy.length, l = sum(light, w => w.bjj) / light.length;
    if (Math.abs(h - l) >= 0.3) out.push({ text: 'In weeks you hit ' + gt + '+ gym sessions you average <b>' + h.toFixed(1) + ' BJJ sessions</b>, vs ' + l.toFixed(1) + ' in lighter weeks.' });
  }
  const q = state.gym.sessions.filter(s => s.quality && s.date > Date.now() - 120 * DAY);
  if (q.length >= 6) {
    const byGap = { short: [], long: [] };
    const sorted = state.gym.sessions.slice().sort((a, b) => a.date - b.date);
    sorted.forEach((s, i) => { if (!s.quality || !i) return; const gap = (s.date - sorted[i - 1].date) / DAY; (gap <= 2 ? byGap.short : byGap.long).push(s.quality); });
    if (byGap.short.length >= 3 && byGap.long.length >= 3) {
      const a = avgOf(byGap.short), b = avgOf(byGap.long);
      if (Math.abs(a - b) >= 0.3) out.push({ text: 'Sessions within 2 days of the last one rate <b>' + a.toFixed(1) + '/5</b>; after a longer gap, <b>' + b.toFixed(1) + '/5</b>.' });
    }
  }
  const tr = incomeTrend();
  if (tr.months >= 3) out.push({ text: 'Income averages <b>£' + Math.round(tr.avg3).toLocaleString() + '</b> over the last 3 logged months. Best month: £' + Math.round(tr.best).toLocaleString() + ' (' + mkLabel(tr.bestMk) + ').' });
  const gap = muscleCoverage(8);
  const under = MUSCLES.filter(m => gap.counts[m] <= 1);
  if (under.length) out.push({ text: '<b>' + under.map(cap).join(' and ') + '</b> trained ' + (under.length > 1 ? 'once or less each' : 'once or less') + ' in 8 weeks.' });
  return out.slice(0, 3);
}
function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

/* ---------- automatic wins ---------- */
function autoWins() {
  const w = [];
  const add = (date, title, pillar, key) => w.push({ id: 'auto_' + key, date, title, pillar, auto: true });
  // income milestones and record months
  const inc = incomesSorted();
  const monthEnd = mk => Math.min(monthBounds(mk).end - DAY / 2, Date.now());
  incomeMilestones().forEach(m => { if (m.hit) add(monthEnd(m.mk), 'First £' + m.amount.toLocaleString() + ' month (' + mkLabel(m.mk) + ')', 'money', 'inc' + m.amount); });
  let best = 0;
  inc.forEach((i, idx) => {
    const v = incomeTotal(i);
    if (idx >= 2 && v > best) add(monthEnd(i.monthKey), 'Record income month: £' + Math.round(v).toLocaleString(), 'money', 'rec' + i.monthKey);
    best = Math.max(best, v);
  });
  portfolioMilestones().forEach(m => { if (m.hit) add(m.date || Date.now(), 'Portfolio passed £' + m.amount.toLocaleString(), 'money', 'pf' + m.amount); });
  // Gartner quarters
  gartnerHistory().forEach(q => {
    if (q.att >= 170) add(quarterBounds(q.key).end - DAY, q.label + ': maxed the bonus (' + Math.round(q.att) + '%)', 'career', 'q170' + q.key);
    else if (q.att >= 100) add(Math.min(quarterBounds(q.key).end - DAY, Date.now()), q.label + ': quarter target hit (' + q.count + '/' + q.qTarget + ')', 'career', 'q100' + q.key);
  });
  // session counts
  const gymSorted = state.gym.sessions.slice().sort((a, b) => a.date - b.date);
  [25, 50, 75, 100, 150, 200, 300].forEach(n => { if (gymSorted[n - 1]) add(gymSorted[n - 1].date, n + ' gym sessions logged', 'gym', 'g' + n); });
  // best gym month
  const byMonth = {};
  gymSorted.forEach(s => { const k = monthKey(s.date); byMonth[k] = (byMonth[k] || 0) + 1; });
  let bestM = 0;
  Object.keys(byMonth).sort((a, b) => mkIndex(a) - mkIndex(b)).forEach((k, idx) => {
    if (idx >= 2 && byMonth[k] > bestM && mkIndex(k) < mkIndex(monthKey(Date.now()))) add(monthEnd(k), 'Best gym month: ' + byMonth[k] + ' sessions (' + mkLabel(k) + ')', 'gym', 'gm' + k);
    bestM = Math.max(bestM, byMonth[k]);
  });
  // mat hours
  const be = beltEstimate();
  const bjjSorted = bjjSessionsAll().slice().reverse();
  let hrs = be.priorHours;
  const marks = [50, 100, 150, 200, 225];
  bjjSorted.forEach(s => {
    const before = hrs; hrs += s.minutes / 60;
    marks.forEach(m => { if (before < m && hrs >= m) add(s.date, m + ' mat hours', 'bjj', 'h' + m); });
  });
  state.bjj.instructionals.filter(i => i.done && i.completed).forEach(i => add(i.completed, 'Finished ' + i.name.split(' - ')[0], 'bjj', 'inst' + i.id));
  // sales: biggest deal
  let big = 0;
  state.sales.closes.slice().sort((a, b) => a.date - b.date).forEach((c, idx) => {
    if (idx >= 2 && c.cash > big) add(c.date, 'Biggest deal yet: $' + c.cash.toLocaleString() + ' collected', 'sales', 'deal' + c.id);
    big = Math.max(big, c.cash);
  });
  state.injuries.filter(i => i.resolved).forEach(i => add(i.resolved, 'Back from injury: ' + i.name, 'gym', 'inj' + i.id));
  state.legacy.items.filter(l => l.done && l.hitDate).forEach(l => add(l.hitDate, 'Legacy goal: ' + l.name, 'life', 'leg' + l.id));
  return w;
}
function allWins() {
  return memo('wins', () => [...state.wins, ...autoWins()].sort((a, b) => b.date - a.date));
}

/* ---------- XP: rewards hitting targets, not tapping ---------- */
const XP_RULES = {
  gymSession: 10, gymWeek: 40, bjjSession: 15, bjjWeek: 40,
  meeting: 8, meetingMonth: 80, quarter100: 150, quarter170: 250,
  close: 20, per500Cash: 5, incomeMilestone: 200, portfolioMilestone: 150, recordMonth: 75,
  review: 60, planTargetHit: 20, win: 10, legacy: 300, physique: 5, instructional: 20,
};
function xpBreakdown() {
  const R = XP_RULES, rows = [];
  const weeksBack = ts => { const out = []; for (let ws = weekStartTs(ts); ws <= weekStartTs(); ws = addWeeks(ws, 1)) out.push(ws); return out; };
  const first = Math.min(Date.now(), ...state.gym.sessions.map(s => s.date), ...state.bjj.sessions.map(s => s.date));
  const weeks = weeksBack(first);
  const gymWeeks = weeks.filter(ws => gymIn(ws, addWeeks(ws, 1)).length >= targetsFor(ws).gym).length;
  const bjjWeeks = weeks.filter(ws => bjjIn(ws, addWeeks(ws, 1)).length >= targetsFor(ws).bjj).length;
  rows.push({ pillar: 'gym', label: 'Gym', xp: state.gym.sessions.length * R.gymSession + gymWeeks * R.gymWeek, note: state.gym.sessions.length + ' sessions · ' + gymWeeks + ' target weeks' });
  rows.push({ pillar: 'bjj', label: 'BJJ', xp: bjjSessionsAll().length * R.bjjSession + bjjWeeks * R.bjjWeek + state.bjj.instructionals.filter(i => i.done).length * R.instructional, note: bjjSessionsAll().length + ' sessions · ' + bjjWeeks + ' target weeks' });
  const months = {};
  state.career.meetings.forEach(m => { const k = monthKey(m.date); months[k] = (months[k] || 0) + 1; });
  const tMonths = Object.values(months).filter(n => n >= (state.career.target || 8)).length;
  const hist = gartnerHistory();
  const q100 = hist.filter(q => q.att >= 100).length, q170 = hist.filter(q => q.att >= 170).length;
  rows.push({ pillar: 'career', label: 'Gartner', xp: state.career.meetings.length * R.meeting + tMonths * R.meetingMonth + q100 * R.quarter100 + q170 * R.quarter170, note: tMonths + ' target months · ' + q100 + ' target quarters' });
  if (state.sales.closes.length) rows.push({ pillar: 'sales', label: 'Sales', xp: state.sales.closes.length * R.close + Math.floor(sum(state.sales.closes, c => c.cash) / 500) * R.per500Cash, note: state.sales.closes.length + ' closes' });
  const im = incomeMilestones().filter(m => m.hit).length, pm = portfolioMilestones().filter(m => m.hit).length;
  const records = autoWins().filter(w => w.id.startsWith('auto_rec')).length;
  rows.push({ pillar: 'money', label: 'Money', xp: im * R.incomeMilestone + pm * R.portfolioMilestone + records * R.recordMonth, note: im + ' income milestones · ' + records + ' record months' });
  const reviews = Object.values(state.reviews).filter(r => r.completedAt).length;
  const hits = sum(planHitHistory(260), h => h.hit);
  rows.push({ pillar: 'review', label: 'Reviews', xp: reviews * R.review + hits * R.planTargetHit, note: reviews + ' reviews · ' + hits + ' targets hit' });
  rows.push({ pillar: 'life', label: 'Wins & goals', xp: state.wins.length * R.win + state.legacy.items.filter(l => l.done).length * R.legacy + state.physique.ratings.length * R.physique, note: state.wins.length + ' wins banked' });
  return rows;
}
function totalXP() { return sum(xpBreakdown(), r => r.xp); }
function xpForLevel(level) { return Math.floor(100 * Math.pow(level, 1.35)); }
function levelFromXP(xp) {
  let lvl = 1, total = 0;
  for (;;) {
    const need = xpForLevel(lvl);
    if (total + need > xp || lvl >= 200) return { level: lvl, xpInLevel: xp - total, xpNeeded: need };
    total += need; lvl++;
  }
}
const RANKS = [
  { min: 1, name: 'Architect' }, { min: 6, name: 'Builder' }, { min: 12, name: 'Operator' },
  { min: 20, name: 'Craftsman' }, { min: 30, name: 'Closer' }, { min: 45, name: 'Authority' }, { min: 65, name: 'Sovereign' },
];
function rankFor(level) { return RANKS.filter(r => level >= r.min).pop(); }

/* ---------- the next action ---------- */
function nextActions() {
  const out = [];
  const now = new Date(), dow = now.getDay() || 7, daysLeft = 8 - dow;
  const ws = weekStartTs(), t = targetsFor(ws), c = weekCounts(ws);
  const due = reviewDue();
  if (due) out.push({ act: 'review', pillar: 'review', title: 'Do your weekly review', why: 'Takes 3 minutes. Sets next week\'s targets so the score means something.' });
  const g = gartnerNow();
  const gymLeft = Math.max(0, t.gym - c.gym);
  if (gymLeft > 0) out.push({ act: 'log:gym', pillar: 'gym', title: gymLeft >= daysLeft ? 'Gym today' : 'Get a gym session in', why: c.gym + '/' + t.gym + ' this week, ' + daysLeft + ' day' + (daysLeft > 1 ? 's' : '') + ' left.', urgency: gymLeft / daysLeft });
  if (g.catchUp > 0) out.push({ act: 'log:meeting', pillar: 'career', title: 'Book ' + g.catchUp + ' more meeting' + (g.catchUp > 1 ? 's' : '') + ' this month', why: g.count + '/' + g.qTarget + ' in ' + g.label + '. Each meeting is worth ~£' + Math.round(g.perMeetingBelow) + ' of bonus up to 100%.', urgency: 0.8 });
  else if (g.toMax > 0 && g.att >= 100) out.push({ act: 'log:meeting', pillar: 'career', title: 'Push past ' + Math.round(g.att) + '%', why: g.toMax + ' meetings to the 150% payout cap; each is worth ~£' + Math.round(g.perMeetingAbove) + '.', urgency: 0.3 });
  const bjjLeft = Math.max(0, t.bjj - c.bjj);
  if (bjjLeft > 0) out.push({ act: 'log:bjj', pillar: 'bjj', title: 'Get on the mats', why: c.bjj + '/' + t.bjj + ' BJJ sessions this week.', urgency: bjjLeft / daysLeft * 0.8 });
  const cov = muscleCoverage();
  if (cov.missing.length) out.push({ act: 'log:gym', pillar: 'gym', title: 'Train ' + cov.missing.join(' + '), why: 'Untouched for 4 weeks.', urgency: 0.4 });
  if (!physiqueScore().ratedThisWeek && dow >= 5) out.push({ act: 'physique', pillar: 'gym', title: 'Rate your physique', why: 'Weekly 5-second check-in.', urgency: 0.2 });
  out.sort((a, b) => (a.act === 'review' ? -1 : b.act === 'review' ? 1 : (b.urgency || 0) - (a.urgency || 0)));
  if (!out.length) out.push({ act: 'log:win', pillar: 'life', title: 'Bank a win', why: 'Everything is on target. Capture what\'s working.' });
  return out;
}

/* ---------- recent activity (from the records themselves) ---------- */
function recentActivity(n = 8) {
  const items = [];
  state.gym.sessions.forEach(s => items.push({ date: s.date, pillar: 'gym', title: 'Gym', sub: s.muscles.map(cap).join(', ') || 'Session' }));
  bjjSessionsAll().forEach(s => items.push({ date: s.date, pillar: 'bjj', title: 'BJJ', sub: (s.notes || (Math.round(s.minutes) + ' min')).split('\n')[0] }));
  state.sales.closes.forEach(c => items.push({ date: c.date, pillar: 'sales', title: 'Close', sub: '$' + c.cash.toLocaleString() + ' collected' }));
  const mDays = {};
  state.career.meetings.forEach(m => { const k = dayKey(m.date); mDays[k] = mDays[k] || { date: m.date, n: 0 }; mDays[k].n++; });
  Object.values(mDays).forEach(d => items.push({ date: d.date, pillar: 'career', title: 'Gartner', sub: d.n + ' meeting' + (d.n > 1 ? 's' : '') }));
  state.money.incomes.forEach(i => items.push({ date: i.updated, pillar: 'money', title: 'Income', sub: mkLabel(i.monthKey) + ' · £' + Math.round(incomeTotal(i)).toLocaleString() }));
  state.wins.forEach(w => items.push({ date: w.date, pillar: 'life', title: 'Win', sub: w.title }));
  return items.sort((a, b) => b.date - a.date).slice(0, n);
}

/* ---------- calendar ---------- */
function calendarDays(weeks = 16) {
  const start = addWeeks(weekStartTs(), -(weeks - 1));
  const days = [];
  const gymBy = {}, bjjBy = {}, closeBy = {};
  state.gym.sessions.forEach(s => { const k = dayKey(s.date); gymBy[k] = (gymBy[k] || 0) + 1; });
  bjjSessionsAll().forEach(s => { const k = dayKey(s.date); bjjBy[k] = (bjjBy[k] || 0) + 1; });
  state.sales.closes.forEach(s => { const k = dayKey(s.date); closeBy[k] = (closeBy[k] || 0) + 1; });
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start); d.setDate(d.getDate() + i);
    const ts = d.getTime(), k = dayKey(ts);
    days.push({ ts, k, gym: gymBy[k] || 0, bjj: bjjBy[k] || 0, close: closeBy[k] || 0, future: ts > Date.now() });
  }
  return days;
}

/* ---------- backups ---------- */
function backupStatus() {
  const last = state.settings.lastBackupAt;
  const every = state.settings.backupEveryDays || 7;
  const age = last ? daysAgo(last) : null;
  return { last, age, overdue: age == null || age >= every };
}
