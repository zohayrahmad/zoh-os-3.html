/* =========================================================
   Blue belt estimate, ported from Mat Log (js/data.js + js/analytics.js).
   Same model, weights and benchmarks. Zoh OS supplies mat time,
   consistency and session ratings itself; technical skill and roll
   results come from a linked Mat Log save when there is one.
   ========================================================= */

const READINESS = {
  hoursTarget: 225,          // midpoint of the common 150-300h range
  roundsTarget: 500,         // ~150 classes x 3-4 rounds
  consistencyWeeks: 12,
  consistencyPerWeek: 2,     // "consistent" = 2+ sessions/week
  stateScore: [0, 0.25, 0.5, 0.8, 1],
  domainReadyAt: 0.7,
  pillars: {
    time:        { weight: 0.35, label: 'Mat time' },
    skill:       { weight: 0.40, label: 'Technical skill' },
    live:        { weight: 0.15, label: 'Live performance' },
    consistency: { weight: 0.10, label: 'Consistency' },
  },
  domains: [
    { id: 'escapes', label: 'Escapes & survival', weight: 0.22, moves: ['f1', 'f2', 'f6', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8'] },
    { id: 'defence', label: 'Submission defence', weight: 0.14, moves: ['d1', 'd2', 'd3', 'd4', 'd5', 'l8'] },
    { id: 'guard',   label: 'Guard', weight: 0.20, moves: ['g1', 'g2', 'g3', 'g5', 'g6', 'g7', 'g9', 'g10', 'g13', 'g16', 'o9'] },
    { id: 'passing', label: 'Passing', weight: 0.14, moves: ['p1', 'p2', 'p4', 'p7', 'p8'] },
    { id: 'top',     label: 'Control & finishes', weight: 0.18, moves: ['t1', 't2', 't3', 't4', 't5', 'b1', 'b3', 'b4', 'l1', 'l2'] },
    { id: 'standup', label: 'Standup', weight: 0.12, moves: ['st1', 'st2', 'st5', 'st7', 'st12', 'st14'] },
  ],
  // Common rule of thumb: each white-belt stripe ~ 20% of the way to blue.
  stages: [
    { min: 0,  label: 'New white belt', stripes: 0 },
    { min: 20, label: 'Developing white belt', stripes: 1 },
    { min: 40, label: 'Mid white belt', stripes: 2 },
    { min: 60, label: 'Experienced white belt', stripes: 3 },
    { min: 80, label: 'Senior white belt', stripes: 4 },
    { min: 90, label: 'Blue belt range', stripes: 4 },
  ],
};
const ROLL_BENCHMARKS = { higher: 0.35, peer: 0.5, newer: 0.75 };
const POSITIONAL = [
  { id: 'mount-bottom', domain: 'escapes', benchmark: 0.4 },
  { id: 'side-bottom',  domain: 'escapes', benchmark: 0.4 },
  { id: 'back-bottom',  domain: 'escapes', benchmark: 0.35 },
  { id: 'guard-bottom', domain: 'guard',   benchmark: 0.5 },
  { id: 'half-bottom',  domain: 'guard',   benchmark: 0.45 },
  { id: 'passing',      domain: 'passing', benchmark: 0.45 },
  { id: 'mount-top',    domain: 'top',     benchmark: 0.55 },
  { id: 'side-top',     domain: 'top',     benchmark: 0.55 },
  { id: 'back-top',     domain: 'top',     benchmark: 0.5 },
  { id: 'standing',     domain: 'standup', benchmark: 0.45 },
];

/* ---------- Mat Log evidence (only when linked) ---------- */
function mlMoveState(ml, id) { return (ml && ml.moves && ml.moves[id]) || 0; }
function mlRecent(ml, days) {
  const from = Date.now() - days * DAY;
  return ml ? ml.sessions.filter(s => isoToTs(s.date) > from) : [];
}
function mlRollStats(sessions) {
  const out = {};
  ['higher', 'peer', 'newer'].forEach(l => { out[l] = { win: 0, even: 0, loss: 0, n: 0, score: 0 }; });
  sessions.forEach(s => Object.entries(s.rolls || {}).forEach(([lvl, r]) => {
    if (!out[lvl]) return;
    ['win', 'even', 'loss'].forEach(k => { out[lvl][k] += (r && r[k]) || 0; });
  }));
  Object.entries(out).forEach(([lvl, o]) => {
    o.n = o.win + o.even + o.loss;
    o.score = o.n ? (lvl === 'higher' ? (o.win + o.even) / o.n : (o.win + o.even * 0.5) / o.n) : 0;
  });
  return out;
}
function mlRollReadiness(rolls) {
  const total = Object.values(rolls).reduce((a, r) => a + r.n, 0);
  if (total < 6) return null;
  const parts = Object.entries(rolls).filter(([, r]) => r.n >= 3).map(([lvl, r]) => Math.min(r.score / ROLL_BENCHMARKS[lvl], 1));
  return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;
}
function mlPositionalStats(sessions) {
  const out = {};
  sessions.forEach(s => (s.positional || []).forEach(p => {
    if (!out[p.pos]) out[p.pos] = { win: 0, even: 0, loss: 0, n: 0, rate: 0 };
    out[p.pos][p.result] = (out[p.pos][p.result] || 0) + 1;
  }));
  Object.values(out).forEach(o => { o.n = o.win + o.even + o.loss; o.rate = o.n ? (o.win + o.even * 0.5) / o.n : 0; });
  return out;
}
function mlDomainScores(ml) {
  const R = READINESS;
  const stats = mlPositionalStats(mlRecent(ml, 120));
  return R.domains.map(d => {
    const avg = d.moves.reduce((a, id) => a + R.stateScore[mlMoveState(ml, id)], 0) / d.moves.length;
    const selfPct = Math.min(avg / R.domainReadyAt, 1);
    const ps = POSITIONAL.filter(p => p.domain === d.id && stats[p.id] && stats[p.id].n >= 1);
    const reps = ps.reduce((a, p) => a + stats[p.id].n, 0);
    let evidence = null;
    if (reps >= 5) evidence = { reps, score: ps.reduce((a, p) => a + Math.min(stats[p.id].rate / p.benchmark, 1) * stats[p.id].n, 0) / reps };
    const pct = evidence ? selfPct * 0.4 + evidence.score * 0.6 : selfPct;
    return { id: d.id, label: d.label, weight: d.weight, pct, evidence };
  });
}
function mlChecklist(ml, ctx) {
  const lvl = (v, full, part) => (v >= full ? 2 : v >= part ? 1 : 0);
  const best = ids => Math.max(...ids.map(id => mlMoveState(ml, id)));
  const countAt = (ids, min) => ids.filter(id => mlMoveState(ml, id) >= min).length;
  const pos = mlPositionalStats(mlRecent(ml, 120));
  const esc = (posId, ids) => {
    const p = pos[posId], bm = POSITIONAL.find(x => x.id === posId).benchmark;
    if (p && p.n >= 5) return lvl(p.rate, bm, bm / 2);
    return lvl(best(ids), 3, 2);
  };
  const { peer, newer, higher } = ctx.rolls;
  const live = peer && peer.n >= 4 ? lvl(peer.score, 0.5, 0.3) : (ctx.avgFeel == null ? 0 : lvl(ctx.avgFeel, 2.8, 2));
  return [
    { group: 'Hard to pin', label: 'Escape bottom mount', status: esc('mount-bottom', ['e1', 'e2']) },
    { group: 'Hard to pin', label: 'Escape bottom side control', status: esc('side-bottom', ['e3', 'e4']) },
    { group: 'Hard to pin', label: 'Escape the back', status: esc('back-bottom', ['e5', 'e6']) },
    { group: 'Hard to submit', label: 'Defend RNC, armbar, triangle, guillotine', status: lvl(countAt(['d1', 'd2', 'd3', 'd4'], 3), 3, 1) },
    { group: 'Hard to pass', label: 'Retain guard under pressure', status: lvl(best(['g16', 'o9', 'g9']), 3, 2) },
    { group: 'Guard', label: 'A sweep from closed guard', status: lvl(best(['g2', 'g3', 'g4']), 3, 2) },
    { group: 'Guard', label: 'Two attacks from closed guard', status: lvl(countAt(['g5', 'g6', 'g7', 'g8'], 3), 2, 1) },
    { group: 'Top game', label: 'Two passes that work', status: lvl(countAt(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'], 3), 2, 1) },
    { group: 'Top game', label: 'Hold mount and the back', status: lvl(Math.min(mlMoveState(ml, 't1'), mlMoveState(ml, 'b3')), 3, 2) },
    { group: 'Top game', label: 'Finish 3+ standard submissions', status: lvl(countAt(['t2', 't3', 't4', 't5', 'b4', 'g5', 'g6', 'g7', 'l1'], 3), 3, 1) },
    { group: 'Standing', label: 'A takedown or safe guard pull', status: lvl(best(['st5', 'st7', 'st8', 'st14', 'st11']), 3, 2) },
    { group: 'Mat time', label: '150+ mat hours', status: lvl(ctx.hours, 150, 75) },
    { group: 'Mat time', label: 'Training 2+ times a week', status: lvl(ctx.perWeek12, 2, 1) },
    { group: 'Live', label: 'Competitive with peers', status: live },
    { group: 'Live', label: 'Controls newer people safely', status: newer && newer.n >= 3 ? lvl(newer.score, 0.75, 0.5) : 0 },
    { group: 'Live', label: 'Survives higher belts', status: higher && higher.n >= 3 ? lvl(higher.score, 0.35, 0.15) : 0 },
    { group: 'Game plan', label: 'A go-to escape from mount, side and back', status: lvl(ctx.escapePlans, 3, 1) },
  ];
}

/* ---------- BJJ sessions: Zoh OS + Mat Log, merged per day ---------- */
function dayKey(ts) { return tsToDateInput(ts); }
function bjjSessionsAll() { return memo('bjjAll', bjjSessionsAllRaw).slice(); }
function bjjSessionsAllRaw() {
  const B = state.bjj, ml = B.matlog;
  const defMin = B.sessionMinutes || 75;
  const byDay = {};
  B.sessions.forEach(s => {
    const k = dayKey(s.date);
    (byDay[k] = byDay[k] || { zoh: [], ml: [] }).zoh.push({
      date: s.date, minutes: s.minutes || defMin, estimated: !s.minutes, rounds: s.rounds || 0,
      // Zoh OS rates 1-5; Mat Log's "how did the rolls go" is 1-3.
      feel: s.quality ? 1 + (s.quality - 1) / 2 : 0, quality: s.quality, notes: s.notes, source: 'zoh', id: s.id,
    });
  });
  if (ml) ml.sessions.forEach(s => {
    const k = s.date;
    (byDay[k] = byDay[k] || { zoh: [], ml: [] }).ml.push({
      date: isoToTs(s.date), minutes: s.minutes || defMin, estimated: !s.minutes, rounds: s.spars || 0,
      feel: s.feel || 0, quality: null, notes: '', source: 'matlog',
    });
  });
  const out = [];
  Object.values(byDay).forEach(d => { out.push(...(d.ml.length >= d.zoh.length ? d.ml : d.zoh)); });
  return out.sort((a, b) => b.date - a.date);
}

function beltEstimate() { return memo('belt', beltEstimateRaw); }
function beltEstimateRaw() {
  const R = READINESS, B = state.bjj, ml = B.matlog;
  const sessions = bjjSessionsAll();
  const zohFirst = B.sessions.length ? Math.min(...B.sessions.map(s => s.date)) : Infinity;
  const mlFirst = ml && ml.sessions.length ? Math.min(...ml.sessions.map(s => isoToTs(s.date))) : Infinity;
  // Sessions logged before tracking started, unless Mat Log already holds that history.
  const priorCounts = mlFirst >= zohFirst - 7 * DAY;
  const prior = priorCounts ? (B.priorSessions || 0) : 0;
  const defMin = B.sessionMinutes || 75;
  const priorHours = prior * defMin / 60;
  const hours = priorHours + sessions.reduce((a, s) => a + s.minutes, 0) / 60;
  const rounds = sessions.reduce((a, s) => a + (s.rounds || 0), 0);
  const hoursTarget = B.hoursTarget || R.hoursTarget;

  // Mat Log counts live rounds for a quarter of mat time; without round data, hours carry it all.
  const timeScore = ml || rounds > 0
    ? Math.min(hours / hoursTarget, 1) * 0.75 + Math.min(rounds / R.roundsTarget, 1) * 0.25
    : Math.min(hours / hoursTarget, 1);

  const domains = ml ? mlDomainScores(ml) : null;
  const skillScore = domains ? domains.reduce((a, d) => a + d.pct * d.weight, 0) : null;

  const rated = sessions.filter(s => s.feel).slice(0, 10);
  const avgFeel = rated.length ? rated.reduce((a, s) => a + s.feel, 0) / rated.length : null;
  const feelScore = rated.length >= 3 ? Math.max(0, Math.min((avgFeel - 1) / 2, 1)) : null;
  const rolls = mlRollStats(mlRecent(ml, 90));
  const rollScore = ml ? mlRollReadiness(rolls) : null;
  const liveScore = rollScore == null ? feelScore : feelScore == null ? rollScore : rollScore * 0.65 + feelScore * 0.35;

  const thisWeek = weekStartTs();
  const from12 = addWeeks(thisWeek, -(R.consistencyWeeks - 1));
  const recent12 = sessions.filter(s => s.date >= from12).length;
  const weeksElapsed = R.consistencyWeeks - 1 + Math.min(7, Math.floor((Date.now() - thisWeek) / DAY) + 1) / 7;
  const perWeek12 = recent12 / weeksElapsed;
  const consistencyScore = Math.min(perWeek12 / R.consistencyPerWeek, 1);

  const scores = { time: timeScore, skill: skillScore, live: liveScore, consistency: consistencyScore };
  let wSum = 0, total = 0;
  Object.entries(R.pillars).forEach(([k, p]) => {
    if (scores[k] == null) return;   // missing pillar: weight spreads over the rest
    wSum += p.weight; total += scores[k] * p.weight;
  });
  const pct = wSum ? Math.round((total / wSum) * 100) : 0;
  const stage = [...R.stages].reverse().find(s => pct >= s.min);

  // Projection for the mat-time benchmark, the slowest pillar to move.
  const hoursLeft = Math.max(0, hoursTarget - hours);
  const from8 = addWeeks(thisWeek, -7);
  const hours8 = sessions.filter(s => s.date >= from8).reduce((a, s) => a + s.minutes, 0) / 60;
  const recentHoursPerWeek = hours8 / (7 + Math.min(7, Math.floor((Date.now() - thisWeek) / DAY) + 1) / 7);
  const last10 = sessions.slice(0, 10);
  const avgSessionHours = last10.length ? last10.reduce((a, s) => a + s.minutes, 0) / 60 / last10.length : defMin / 60;
  const perWeekGoal = B.perWeek || 2, rampTo = Math.max(B.rampTo || 3, perWeekGoal);
  const projectAt = perWeekHours => perWeekHours > 0 ? Date.now() + Math.ceil((hoursLeft / perWeekHours) * 7) * DAY : null;
  const projection = {
    hoursLeft, recentHoursPerWeek, avgSessionHours, perWeekGoal, rampTo,
    atRecent: projectAt(recentHoursPerWeek),
    atTarget: projectAt(perWeekGoal * avgSessionHours),
    atRamp: projectAt(rampTo * avgSessionHours),
  };

  const checklist = ml
    ? mlChecklist(ml, { hours, perWeek12, avgFeel: rated.length >= 3 ? avgFeel : null, escapePlans: ml.escapePlans || 0, rolls })
    : [
      { group: 'Mat time', label: '150+ mat hours', status: hours >= 150 ? 2 : hours >= 75 ? 1 : 0 },
      { group: 'Mat time', label: 'Training 2+ times a week', status: perWeek12 >= 2 ? 2 : perWeek12 >= 1 ? 1 : 0 },
      { group: 'Live', label: 'Rolls going well lately', status: avgFeel == null ? 0 : avgFeel >= 2.8 ? 2 : avgFeel >= 2 ? 1 : 0 },
    ];

  return {
    pct, stage, predictedStripes: stage.stripes,
    pillars: Object.entries(R.pillars).map(([k, p]) => ({ id: k, label: p.label, weight: p.weight, score: scores[k] })),
    domains, checklist, projection, linked: !!ml,
    hours, hoursTarget, priorHours, prior, rounds, sessions: sessions.length, perWeek12, avgFeel, ratedCount: rated.length,
    estimatedMinutes: sessions.filter(s => s.estimated).length,
  };
}
