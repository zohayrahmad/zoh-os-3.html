/* =========================================================
   Zoh OS: screens
   ========================================================= */

const ui = { tab: 'today', train: 'gym', money: 'overview', reviewKind: 'week', reviewAnchor: Date.now(), expand: {}, winFilter: 'all' };

function card(title, body, opts = {}) {
  const head = title != null ? '<div class="card-head"><div class="card-title">' + (opts.dot ? '<span class="pdot" style="--c:' + opts.dot + '"></span>' : '') + title + '</div>' + (opts.right || '') + '</div>' : '';
  return '<section class="card ' + (opts.cls || '') + '"' + (opts.id ? ' id="' + opts.id + '"' : '') + '>' + head + body + '</section>';
}
function pageHead(kicker, title) { return '<div class="page-head"><div class="page-kicker">' + esc(kicker) + '</div><div class="page-title">' + title + '</div></div>'; }
function seg(name, current, options) {
  return '<div class="seg" role="tablist">' + options.map(([id, label]) =>
    '<button class="' + (id === current ? 'on' : '') + '" data-act="seg" data-seg="' + name + '" data-val="' + id + '">' + esc(label) + '</button>').join('') + '</div>';
}
function stat(label, val, sub) { return '<div class="stat"><div class="label">' + label + '</div><div class="stat-val">' + val + '</div>' + (sub ? '<div class="stat-sub">' + sub + '</div>' : '') + '</div>'; }
function moreList(key, items, n, renderItem) {
  const open = ui.expand[key];
  const shown = open ? items : items.slice(0, n);
  return shown.map(renderItem).join('') + (items.length > n ? '<button class="more-btn" data-act="expand" data-key="' + key + '">' + (open ? 'Show less' : 'Show all ' + items.length) + '</button>' : '');
}
const BRAND_DEFS = '<defs><linearGradient id="gBrand" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8a4c"/><stop offset=".5" stop-color="#ef4f7a"/><stop offset="1" stop-color="#7c5cff"/></linearGradient></defs>';

/* ======================= TODAY ======================= */
function renderToday() {
  const el = document.getElementById('screen-today');
  const now = new Date();
  let h = pageHead(now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }), 'Today');
  if (isEmptyState()) {
    el.innerHTML = h + card(null, '<div class="welcome"><div class="brand-mark">Z</div><div class="mid-num">Welcome to Zoh OS 4</div>' +
      '<p class="note mt8">Restore your latest backup to bring your history across. You only need to do this once on this device.</p>' +
      '<div class="btn-row mt16"><button class="btn" data-act="restore">Restore backup</button></div>' +
      '<p class="note mt12 small">Or start fresh with the + button.</p></div>');
    return;
  }
  const ws = weekStartTs(), score = weekScore(ws), last = weekScore(addWeeks(ws, -1));
  const t = score.targets, c = score.counts;
  const g = gartnerNow();
  const proj = monthProjection();
  const nextMs = nextIncomeMilestone(incomeTrend().avg3 || proj.base);
  const moneyVal = proj.logged != null ? proj.logged : proj.projected;
  const ringTile = (p, pct, val, meta, act) => '<button class="ring-tile" data-act="' + act + '"><div class="ring-wrap">' + ring(pct, pm(p).color) + '<div class="ring-val">' + val + '</div></div>' +
    '<div class="ring-name"><span class="pdot" style="--c:' + pm(p).color + '"></span>' + pm(p).name + '</div><div class="ring-meta">' + meta + '</div></button>';
  const sz = 92, st = 9, r = (sz - st) / 2, circ = 2 * Math.PI * r;
  const scoreRing = '<div class="ring-wrap" style="width:' + sz + 'px;height:' + sz + 'px"><svg viewBox="0 0 ' + sz + ' ' + sz + '" width="' + sz + '" height="' + sz + '">' + BRAND_DEFS +
    '<circle cx="' + sz / 2 + '" cy="' + sz / 2 + '" r="' + r + '" fill="none" stroke="var(--card-3)" stroke-width="' + st + '"/>' +
    '<circle cx="' + sz / 2 + '" cy="' + sz / 2 + '" r="' + r + '" fill="none" stroke="url(#gBrand)" stroke-width="' + st + '" stroke-linecap="round" stroke-dasharray="' + (circ * score.score / 100).toFixed(1) + ' ' + circ.toFixed(1) + '" transform="rotate(-90 ' + sz / 2 + ' ' + sz / 2 + ')"/></svg>' +
    '<div class="ring-val" style="font-size:26px;font-weight:780">' + score.score + '</div></div>';
  h += card(null,
    '<div class="hero-grid">' + scoreRing + '<div><div class="label">Week score</div><div class="next-title mt8">' + (score.score >= 75 ? 'Firing on all pillars' : score.score >= 45 ? 'Some pillars carrying others' : 'Pick one pillar and move') + '</div>' +
    '<div class="note">' + deltaHtml(score.score, last.score, v => v + ' pts') + ' vs last week' + (t.fromReview ? ' · your targets' : '') + '</div></div></div>' +
    '<div class="rings">' +
    ringTile('gym', c.gym / (t.gym || 1), c.gym + '/' + t.gym, 'this week', 'goto:train:gym') +
    ringTile('bjj', c.bjj / (t.bjj || 1), c.bjj + '/' + t.bjj, 'this week', 'goto:train:bjj') +
    ringTile('career', g.monthCount / g.target, g.monthCount + '/' + g.target, MONTHS[now.getMonth()], 'goto:money:gartner') +
    ringTile('money', moneyVal / nextMs, '£' + (moneyVal >= 1000 ? (moneyVal / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : Math.round(moneyVal)), proj.logged != null ? 'logged' : 'projected', 'goto:money:overview') +
    '</div>', { cls: 'hero' });

  const bs = backupStatus();
  if (bs.overdue) h += '<div class="flag"><svg viewBox="0 0 24 24">' + ICONS.cloud + '</svg><div class="grow"><b>' + (bs.last ? 'Last backup ' + bs.age + ' days ago' : 'No backup yet') + '</b><small>Your data only lives on this phone. Save a copy to Files or iCloud.</small></div><button class="btn sm ghost" data-act="backup">Back up</button></div>';

  const acts = nextActions();
  const a0 = acts[0];
  h += card('Up next', '<div class="next"><div class="next-icon" style="--c:' + pm(a0.pillar).color + '">' + icon(pm(a0.pillar).icon) + '</div>' +
    '<div class="grow"><div class="next-title">' + esc(a0.title) + '</div><div class="next-why">' + esc(a0.why) + '</div></div>' +
    '<button class="btn sm" data-act="' + a0.act + '">' + (a0.act === 'review' ? 'Start' : a0.act === 'physique' ? 'Rate' : 'Log') + '</button></div>' +
    (acts.length > 1 ? '<div class="also">' + acts.slice(1, 3).map(a => '<div class="also-row"><span class="pdot" style="--c:' + pm(a.pillar).color + '"></span><div class="grow"><b>' + esc(a.title) + '</b> · ' + esc(a.why) + '</div></div>').join('') + '</div>' : ''));

  const plan = lastWeekPlanCheck();
  h += card('This week\'s targets', plan.rows.map(r => '<div class="target-row"><div class="target-top"><span>' + r.label + '</span><b>' + r.actual + ' / ' + r.target + '</b></div>' +
    bar(r.target ? r.actual / r.target : 1, pm(r.key === 'closes' ? 'sales' : r.key).color, 'thin') + '</div>').join('') +
    '<div class="target-row"><div class="target-top"><span>Gartner meetings, ' + MONTHS[now.getMonth()] + '</span><b>' + g.monthCount + ' / ' + g.target + '</b></div>' + bar(g.monthCount / g.target, 'var(--career)', 'thin') + '</div>' +
    (plan.focus ? '<div class="note mt12"><b>Focus:</b> ' + esc(plan.focus) + '</div>' : (plan.fromReview ? '' : '<div class="note mt12">Set your own targets in the weekly review.</div>')),
    { right: '<button class="card-link" data-act="goto:review">Review ›</button>' });

  const flags = driftFlags();
  h += flags.slice(0, 3).map(f => '<div class="flag ' + (f.severity === 'risk' ? 'risk' : '') + '"><svg viewBox="0 0 24 24">' + ICONS.alert + '</svg><div class="grow"><b>' + esc(f.name) + (f.key === 'injury' ? ' still flagged after ' + f.days + ' days' : ' quiet for ' + f.days + ' days') + '</b>' +
    '<small>' + (f.key === 'injury' ? 'Mark it cleared on the Gym page when it is.' : f.key === 'sales' ? 'If you\'re not selling right now, switch Sales off in settings.' : 'Tap + to log.') + '</small></div></div>').join('');

  const xp = totalXP(), lv = levelFromXP(xp), rank = rankFor(lv.level);
  h += card(null, '<button class="row" style="width:100%;text-align:left" data-act="goto:goals"><div class="grow"><div class="row between"><b>Level ' + lv.level + ' · ' + rank.name + '</b><span class="faint small">' + lv.xpInLevel + ' / ' + lv.xpNeeded + ' XP</span></div><div class="mt8">' + bar(lv.xpInLevel / lv.xpNeeded, 'var(--life)', 'thin') + '</div></div></button>');

  const act = recentActivity(6);
  h += card('Recent', act.map(a => '<div class="list-item">' + liIcon(a.pillar) + '<div class="li-main"><div class="li-title">' + esc(a.title) + '</div><div class="li-sub">' + esc(a.sub) + '</div></div><div class="li-side faint">' + fmtDay(a.date) + '</div></div>').join('') || '<div class="empty">Nothing logged yet</div>', { cls: 'flush' });
  el.innerHTML = h;
}

/* ======================= TRAIN ======================= */
function renderTrain() {
  const el = document.getElementById('screen-train');
  let h = pageHead('Train', ui.train === 'gym' ? 'Gym' : 'Jiu-jitsu') + seg('train', ui.train, [['gym', 'Gym'], ['bjj', 'BJJ']]);
  h += ui.train === 'gym' ? gymView() : bjjView();
  el.innerHTML = h;
}
function weeklyColumns(countFn, targetFn, color, n = 12) {
  const bars = [];
  for (let i = n - 1; i >= 0; i--) {
    const ws = addWeeks(weekStartTs(), -i), v = countFn(ws), t = targetFn(ws);
    const d = new Date(ws);
    bars.push({ label: i % 2 === 0 ? d.getDate() + '/' + (d.getMonth() + 1) : '', value: v, color, dim: i === 0, showValue: i === 0 || v === 0 ? false : false,
      tip: tipRows('Week of ' + d.getDate() + ' ' + MONTHS[d.getMonth()], [{ label: 'Sessions', value: v + ' / ' + t }]) });
  }
  return bars;
}
function gymView() {
  const G = state.gym, ws = weekStartTs(), t = targetsFor(ws);
  const thisWeek = gymIn(ws, addWeeks(ws, 1)).length, str = gymStreak();
  let h = '<div class="stats">' + stat('This week', thisWeek + '<small>/' + t.gym + '</small>', t.fromReview ? 'your target' : 'default target') +
    stat('4-wk rate', trailingRate(G.sessions).toFixed(1) + '<small>/wk</small>', 'target ' + G.target) +
    stat('On-target', str.current + '<small>wk</small>', 'best ' + str.best + ' wk') + '</div>';
  h += card('Sessions per week', columnChart(weeklyColumns(w => gymIn(w, addWeeks(w, 1)).length, w => targetsFor(w).gym, 'var(--gym)'),
    { target: G.target, targetLabel: 'target ' + G.target, aria: 'Gym sessions per week, last 12 weeks' }) + '<div class="note small faint">Last 12 weeks · current week faded</div>',
    { dot: 'var(--gym)', right: '<button class="btn sm ghost" data-act="log:gym">Log</button>' });

  const ps = physiqueScore(), cur = latestPhysiqueRating();
  const curVal = cur && cur.week === weekKey() ? cur.value : null;
  let chips = '';
  for (let i = 1; i <= 10; i++) chips += '<button class="chip' + (curVal === i ? ' on' : '') + '" style="--c:var(--gym);min-width:42px" data-act="rate-physique" data-v="' + i + '">' + i + '</button>';
  const ratings = state.physique.ratings.slice().sort((a, b) => a.date - b.date).slice(-10);
  h += card('Physique', '<div class="row between"><div><div class="mid-num">' + ps.score + '<small>/ 100</small></div><div class="note">Consistency ' + Math.round(ps.consistency * 100) + '% · coverage ' + Math.round(ps.balance * 100) + '%' + (ps.rating != null ? ' · rating ' + Math.round(ps.rating * 10) + '/10' : '') + '</div></div>' +
    '<span class="pill ' + (ps.score >= 75 ? 'good' : ps.score >= 50 ? 'warn' : 'bad') + '">' + (ps.score >= 75 ? 'On track' : ps.score >= 50 ? 'Drifting' : 'Behind') + '</span></div>' +
    (ratings.length > 2 ? '<div class="mt12">' + columnChart(ratings.map((r, i) => ({ label: '', value: r.value, color: 'var(--gym)', dim: i < ratings.length - 1, tip: tipRows(fmtDate(r.date), [{ label: 'Rating', value: r.value + '/10' }]) })), { height: 70, aria: 'Recent physique ratings' }) + '</div>' : '') +
    '<div class="flabel mt12">Rate this week' + (curVal ? ' · rated ' + curVal : '') + '</div><div class="chips">' + chips + '</div>');

  const cov = muscleCoverage();
  h += card('Muscle coverage · 4 weeks', '<div class="chips">' + MUSCLES.map(m => '<span class="chip ' + (cov.counts[m] ? 'on' : '') + '" style="--c:var(--gym)">' + cap(m) + ' · ' + cov.counts[m] + '</span>').join('') + '</div>' +
    (cov.missing.length ? '<div class="note mt12">Not trained in 4 weeks: <b>' + cov.missing.map(cap).join(', ') + '</b>.</div>' : '<div class="note mt12">Every group hit in the last 4 weeks.</div>'));

  const active = state.injuries.filter(i => !i.resolved);
  h += card('Injuries', (active.length ? active.map(i => '<div class="list-item">' + liIcon('gym', 'injury') + '<div class="li-main"><div class="li-title">' + esc(i.name) + '</div><div class="li-sub">Flagged ' + fmtDay(i.started) + ' · ' + daysAgo(i.started) + ' days</div></div><button class="btn sm ghost" data-act="resolve-injury" data-id="' + i.id + '">Cleared</button></div>').join('') : '<div class="empty">No active injuries</div>') +
    '<button class="more-btn" data-act="log:injury">+ Flag an injury</button>', { cls: 'flush' });

  const pbs = G.pbs.slice().sort((a, b) => b.date - a.date);
  h += card('Personal bests', (pbs.length ? moreList('pbs', pbs, 4, p => '<button class="list-item tap" style="width:100%;text-align:left" data-act="edit" data-kind="pb" data-id="' + p.id + '">' + liIcon('gym', 'pb') + '<div class="li-main"><div class="li-title">' + esc(p.name) + '</div></div><div class="li-side faint">' + fmtDay(p.date) + '</div></button>') : '<div class="empty">No PBs yet</div>') +
    '<button class="more-btn" data-act="log:pb">+ Add a PB</button>', { cls: 'flush' });

  const sess = G.sessions.slice().sort((a, b) => b.date - a.date);
  h += card('Session log', sess.length ? moreList('gymlog', sess, 8, s => '<button class="list-item tap" style="width:100%;text-align:left" data-act="edit" data-kind="gym" data-id="' + s.id + '">' +
    '<div class="li-main"><div class="li-title">' + (s.muscles.length ? s.muscles.map(cap).join(' · ') : 'Session') + '</div>' + (s.notes ? '<div class="li-sub">' + esc(s.notes) + '</div>' : '') + '</div>' +
    '<div class="li-side">' + fmtDay(s.date) + (s.quality ? '<div class="faint small">' + s.quality + '/5</div>' : '') + '</div></button>') : '<div class="empty">No sessions yet</div>', { cls: 'flush' });
  return h;
}

function bjjView() {
  const B = state.bjj, be = beltEstimate(), ws = weekStartTs(), t = targetsFor(ws);
  const thisWeek = bjjIn(ws, addWeeks(ws, 1)).length;
  const p = be.projection;
  const proj = (label, ts, sub) => '<div class="row between" style="padding:8px 0;border-top:1px solid var(--line)"><div><div style="font-size:14px;font-weight:600">' + label + '</div><div class="faint small">' + sub + '</div></div><b>' + (ts ? fmtMonthYear(ts) : '—') + '</b></div>';
  const stripes = [0, 1, 2, 3].map(i => '<i class="' + (i < be.predictedStripes ? '' : 'off') + '"></i>').join('');
  let h = card('Blue belt estimate',
    '<div class="row between"><div><div class="big-num">' + be.pct + '<small>%</small></div><div class="note mt8"><b>' + be.stage.label + '</b> · predicts ' + plural(be.predictedStripes, 'stripe') + '</div></div>' +
    '<div class="belt-vis" aria-label="White belt, ' + be.predictedStripes + ' stripes"><div class="bar-black">' + stripes + '</div></div></div>' +
    '<div class="mt16">' + be.pillars.map(pl => '<div class="target-row"><div class="target-top"><span>' + pl.label + ' <span class="faint small">' + Math.round(pl.weight * 100) + '%</span></span><b>' + (pl.score == null ? '<span class="faint">' + (pl.id === 'skill' ? 'from Mat Log' : 'needs data') + '</span>' : Math.round(pl.score * 100) + '%') + '</b></div>' + bar(pl.score || 0, 'var(--bjj)', 'thin') + '</div>').join('') + '</div>' +
    '<div class="mt16"><div class="row between"><span class="label">Mat time</span><span class="small muted">' + Math.round(be.hours) + ' / ' + be.hoursTarget + ' h</span></div><div class="mt8">' + bar(be.hours / be.hoursTarget, 'var(--bjj)') + '</div></div>' +
    '<div class="mt12">' + proj('At your recent pace', p.atRecent, p.recentHoursPerWeek.toFixed(1) + ' h/week over 8 weeks') +
    proj('At ' + p.perWeekGoal + ' sessions a week', p.atTarget, 'your weekly target') + proj('At ' + p.rampTo + ' sessions a week', p.atRamp, 'if you ramp up') + '</div>' +
    '<details class="more"><summary>Blue belt checklist (' + be.checklist.filter(c => c.status === 2).length + '/' + be.checklist.length + ')</summary><div class="mt8">' +
    be.checklist.map(c => '<div class="check"><div class="ci s' + c.status + '">' + (c.status ? icon('check') : '') + '</div><div>' + esc(c.label) + '<small>' + esc(c.group) + '</small></div></div>').join('') + '</div></details>' +
    '<div class="note mt12 small">' + (be.linked ? 'Skill and roll results come from Mat Log (synced ' + fmtDay(B.matlog.importedAt) + ').' : 'Same model as Mat Log. Link Mat Log to add technical skill and roll results.') +
    (be.prior ? ' Includes ' + be.prior + ' sessions before tracking (~' + Math.round(be.priorHours) + ' h).' : '') + (be.estimatedMinutes ? ' ' + be.estimatedMinutes + ' sessions use your typical length of ' + B.sessionMinutes + ' min.' : '') + '</div>' +
    '<button class="btn block line mt12" data-act="link-matlog">' + icon('link') + (be.linked ? 'Update from Mat Log backup' : 'Link Mat Log backup') + '</button>',
    { dot: 'var(--bjj)' });

  h += '<div class="stats">' + stat('This week', thisWeek + '<small>/' + t.bjj + '</small>', 'target') + stat('12-wk rate', be.perWeek12.toFixed(1) + '<small>/wk</small>', 'MatLog wants 2+') + stat('Sessions', be.sessions + be.prior, Math.round(be.hours) + ' h total') + '</div>';
  h += card('Sessions per week', columnChart(weeklyColumns(w => bjjIn(w, addWeeks(w, 1)).length, w => targetsFor(w).bjj, 'var(--bjj)'),
    { target: B.perWeek, targetLabel: 'target ' + B.perWeek, aria: 'BJJ sessions per week, last 12 weeks' }), { dot: 'var(--bjj)', right: '<button class="btn sm ghost" data-act="log:bjj">Log</button>' });

  if (B.compDate && dateInputToTs(B.compDate) > Date.now() - DAY) {
    const dd = Math.ceil((dateInputToTs(B.compDate) - Date.now()) / DAY);
    h += card('Competition', '<div class="mid-num">' + dd + '<small>days</small></div><div class="note">' + fmtDate(dateInputToTs(B.compDate)) + '</div>');
  }
  const insts = B.instructionals;
  h += card('Instructionals', (insts.length ? insts.map(i => '<div class="list-item"><button class="ci" data-act="toggle-inst" data-id="' + i.id + '" style="width:24px;height:24px;border-radius:50%;display:grid;place-items:center;' + (i.done ? 'background:var(--bjj)' : 'box-shadow:inset 0 0 0 1.5px var(--line-2)') + '">' + (i.done ? '<svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:#fff;stroke-width:3;fill:none">' + ICONS.check + '</svg>' : '') + '</button>' +
    '<div class="li-main"><div class="li-title" style="' + (i.done ? 'color:var(--text-3);text-decoration:line-through' : '') + '">' + esc(i.name) + '</div></div><button class="faint" data-act="delete-inst" data-id="' + i.id + '" aria-label="Remove">×</button></div>').join('') : '<div class="empty">Add your study queue</div>') +
    '<button class="more-btn" data-act="add-inst">+ Add instructional</button>', { cls: 'flush' });

  const sess = B.sessions.slice().sort((a, b) => b.date - a.date);
  h += card('Logged here', sess.length ? moreList('bjjlog', sess, 6, s => '<button class="list-item tap" style="width:100%;text-align:left" data-act="edit" data-kind="bjj" data-id="' + s.id + '">' +
    '<div class="li-main"><div class="li-title">' + (s.minutes || B.sessionMinutes) + ' min' + (s.rounds ? ' · ' + s.rounds + ' rounds' : '') + '</div>' + (s.notes ? '<div class="li-sub">' + esc(s.notes) + '</div>' : '') + '</div>' +
    '<div class="li-side">' + fmtDay(s.date) + (s.quality ? '<div class="faint small">' + s.quality + '/5</div>' : '') + '</div></button>') : '<div class="empty">No sessions logged in Zoh OS</div>', { cls: 'flush' });
  return h;
}

/* ======================= MONEY ======================= */
function renderMoney() {
  const el = document.getElementById('screen-money');
  const opts = [['overview', 'Path'], ['income', 'Income'], ['gartner', 'Gartner']];
  if (state.sales.active || state.sales.closes.length) opts.push(['sales', 'Sales']);
  if (!opts.find(o => o[0] === ui.money)) ui.money = 'overview';
  const titles = { overview: 'Path to ' + gbp(state.money.target), income: 'Income', gartner: 'Gartner bonus', sales: 'Sales' };
  let h = pageHead('Money', esc(titles[ui.money])) + seg('money', ui.money, opts);
  h += { overview: moneyOverview, income: incomeView, gartner: gartnerView, sales: salesView }[ui.money]();
  el.innerHTML = h;
}
function moneyOverview() {
  const M = state.money, mp = moneyPath(), tr = mp.trend, proj = monthProjection();
  let h = card(null,
    '<div class="label">3-month average</div><div class="big-num mt8">' + gbp(mp.ref, true) + '<small>/ mo</small></div>' +
    '<div class="mt12">' + bar(mp.ref / mp.target, 'var(--money)') + '</div>' +
    '<div class="row between mt8 small"><span class="muted">' + Math.round(mp.ref / mp.target * 100) + '% of ' + gbp(mp.target, true) + '</span><span class="faint">best ' + gbp(tr.best, true) + (tr.bestMk ? ' · ' + mkShort(tr.bestMk) : '') + '</span></div>' +
    '<div class="hr"></div><div class="note">' +
    (mp.deadline ? 'Target date <b>' + mkLabel(mp.deadline.mk) + '</b>: needs <b>+' + gbp(mp.deadline.growthPerMonth, true) + '/month</b> growth. ' + (mp.deadline.onPace ? 'Your trend is on pace.' : 'Your trend is ' + (tr.slope != null ? (tr.slope >= 0 ? '+' : '-') + gbp(Math.abs(tr.slope), true) + '/month.' : 'not set yet.')) :
      tr.slope == null ? 'Log 3+ months of income to see your trend.' :
        tr.slope > 10 ? 'Trend: <b>+' + gbp(tr.slope, true) + '/month</b> over the last ' + tr.months + ' months. At that rate you reach ' + gbp(mp.target, true) + ' around <b>' + mkLabel(mp.etaMk) + '</b>.' :
          'Trend is flat (' + (tr.slope >= 0 ? '+' : '-') + gbp(Math.abs(tr.slope), true) + '/month). The gap closes with a step change, not drift.') + '</div>',
    { cls: 'hero', right: '' });

  const logged = proj.logged != null;
  h += card('This month', '<div class="row between"><div><div class="mid-num">' + gbp(logged ? proj.logged : proj.projected, true) + '</div><div class="note">' + (logged ? 'logged for ' + mkLabel(proj.mk) : 'projected: ' + gbp(proj.base, true) + ' base' + (state.sales.active ? ' + ' + gbp(proj.projected - proj.base, true) + ' commission at this pace' : '')) + '</div></div>' +
    '<button class="btn sm ghost" data-act="log:income">' + (logged ? 'Edit' : 'Log') + '</button></div>', { dot: 'var(--money)' });

  const L = M.lanes;
  h += card('What ' + gbp(mp.target, true) + ' takes', '<div class="note">On top of ' + gbp(M.baseMonthly, true) + ' base and ~' + gbp(mp.bonusMonthly, true) + '/month of on-target Gartner bonus, you need <b>' + gbp(mp.commNeeded, true) + ' a month</b> from elsewhere.</div>' +
    '<div class="mt12">' +
    '<div class="score-row"><div><b>As a setter</b><div class="faint small">' + L.setter.rate + '% on ' + usd(L.setter.avgDeal) + ' deals</div></div><div class="li-side">' + usd(mp.setterCash) + '<div class="faint small">cash / month</div></div><div class="li-side">' + Math.ceil(mp.setterDeals || 0) + '<div class="faint small">deals</div></div></div>' +
    '<div class="score-row"><div><b>As a closer</b><div class="faint small">' + L.closer.rate + '% on ' + usd(L.closer.avgDeal) + ' deals</div></div><div class="li-side">' + usd(mp.closerCash) + '<div class="faint small">cash / month</div></div><div class="li-side">' + Math.ceil(mp.closerDeals || 0) + '<div class="faint small">deals</div></div></div>' +
    '</div><div class="note small faint mt8">Deal sizes and rates are in Settings → Money.</div>');

  const ms = incomeMilestones(), nextIdx = ms.findIndex(m => !m.hit);
  h += card('Income milestones', '<div class="milestones">' + ms.map((m, i) => '<div class="ms ' + (m.hit ? 'hit' : i === nextIdx ? 'next' : '') + '"><div class="ms-dot">' + (m.hit ? icon('check') : '') + '</div><div class="ms-amt">' + gbp(m.amount, true) + ' month</div><div class="ms-when">' + (m.hit ? mkLabel(m.mk) : i === nextIdx ? gbp(m.amount - mp.ref, true) + ' above avg' : '') + '</div></div>').join('') + '</div>');

  const pms = portfolioMilestones();
  h += card('Portfolio', '<div class="row between"><div class="mid-num">' + gbp(M.portfolio || 0, true) + '</div><button class="btn sm ghost" data-act="portfolio">Update</button></div>' +
    '<div class="milestones mt8">' + pms.map(m => '<div class="ms ' + (m.hit ? 'hit' : '') + '"><div class="ms-dot">' + (m.hit ? icon('check') : '') + '</div><div class="ms-amt">' + gbp(m.amount, true) + '</div><div class="ms-when">' + (m.hit ? 'hit' : '') + '</div></div>').join('') + '</div>');
  return h;
}
const SOURCE_COLORS = { base: 'var(--career)', commission: 'var(--gym)', bonus: 'var(--bjj)', other: 'var(--money)', unsplit: 'var(--unsplit)' };
function incomeSeries() { return [...INCOME_SOURCES.map(s => ({ key: s.id, label: s.label, color: SOURCE_COLORS[s.id] })), { key: 'unsplit', label: 'Total (no split)', color: SOURCE_COLORS.unsplit }]; }
function incomeView() {
  const inc = incomesSorted();
  const nowMk = monthKey(Date.now());
  const start = inc.length ? Math.max(mkIndex(inc[0].monthKey), mkIndex(nowMk) - 11) : mkIndex(nowMk) - 5;
  const cols = [];
  for (let i = start; i <= mkIndex(nowMk); i++) {
    const mk = indexToMk(i), e = incomeFor(mk);
    const segs = !e ? [] : e.sources ? INCOME_SOURCES.map(s => ({ key: s.id, value: e.sources[s.id] || 0 })) : [{ key: 'unsplit', value: e.amount }];
    const rows = segs.filter(s => s.value).map(s => ({ label: (incomeSeries().find(x => x.key === s.key) || {}).label, value: gbp(s.value, true), color: SOURCE_COLORS[s.key] }));
    cols.push({ label: mkShort(mk), segs, showValue: i === mkIndex(nowMk) || i === mkIndex(nowMk) - 1, tip: tipRows(mkLabel(mk), rows.length ? rows.concat([{ label: 'Total', value: gbp(e ? incomeTotal(e) : 0, true) }]) : [{ label: 'Not logged', value: '' }]) });
  }
  let h = card('Income by source', stackedChart(cols, incomeSeries(), { target: state.money.target <= 1.6 * Math.max(...cols.map(c => sum(c.segs, s => s.value)), 1) ? state.money.target : null, targetLabel: gbp(state.money.target), fmt: v => '£' + compact(v), aria: 'Monthly income by source' }),
    { right: '<button class="btn sm ghost" data-act="log:income">Log month</button>' });
  const withSplit = inc.filter(i => i.sources);
  if (withSplit.length) {
    const totals = INCOME_SOURCES.map(s => ({ s, v: sum(withSplit, i => i.sources[s.id] || 0) }));
    const all = sum(totals, x => x.v) || 1;
    h += card('Mix', totals.filter(x => x.v).map(x => '<div class="target-row"><div class="target-top"><span><span class="pdot" style="--c:' + SOURCE_COLORS[x.s.id] + ';display:inline-block;margin-right:6px"></span>' + x.s.label + '</span><b>' + Math.round(x.v / all * 100) + '%</b></div>' + bar(x.v / all, SOURCE_COLORS[x.s.id], 'thin') + '</div>').join('') + '<div class="note small faint mt8">Across ' + plural(withSplit.length, 'month') + ' logged with a split.</div>');
  }
  h += card('Months', inc.slice().reverse().map(i => '<button class="list-item tap" style="width:100%;text-align:left" data-act="edit" data-kind="income" data-id="' + i.id + '">' + liIcon('money', 'income') +
    '<div class="li-main"><div class="li-title">' + mkLabel(i.monthKey) + '</div><div class="li-sub">' + (i.sources ? INCOME_SOURCES.filter(s => i.sources[s.id]).map(s => s.label + ' ' + gbp(i.sources[s.id], true)).join(' · ') : 'No split · tap to add one') + '</div></div>' +
    '<div class="li-side">' + gbp(incomeTotal(i), true) + '</div></button>').join('') || '<div class="empty">No months logged</div>', { cls: 'flush' });
  return h;
}
function gartnerView() {
  const g = gartnerNow(), G = state.career.gartner;
  const pct = v => Math.min(100, v / 170 * 100).toFixed(1) + '%';
  let h = card(null,
    '<div class="row between"><div class="label">' + g.label + ' · bonus earned so far</div><span class="pill ' + (g.att >= 100 ? 'good' : g.paceRatio >= 0.9 ? 'warn' : 'bad') + '">' + Math.round(g.att) + '%</span></div>' +
    '<div class="big-num mt8">' + gbp2(g.amount) + '</div>' +
    '<div class="note">before tax · ≈ ' + gbp(g.takeHome, true) + ' take-home at ' + G.takeHome + '% · ' + Math.round(g.pay) + '% payout</div>' +
    '<div class="mt16"><div class="track" style="--c:var(--career)"><i style="width:' + pct(g.att) + '"></i><span class="mark" style="left:' + pct(100) + '"></span></div>' +
    '<div class="track-labels"><span style="left:0;transform:none">0</span><span style="left:' + pct(100) + '">100% · ' + g.qTarget + '</span><span style="left:100%">170% · ' + g.maxMeetings + '</span></div></div>' +
    '<div class="stats two mt12" style="margin-bottom:0">' + stat('Meetings', g.count + '<small>/' + g.qTarget + '</small>', g.toTarget ? g.toTarget + ' to 100%' : g.toMax + ' to the cap') +
    stat('On-target bonus', gbp(g.onTarget, true), 'max ' + gbp(g.max, true) + ' at 170%') + '</div>',
    { cls: 'hero' });
  h += card('This quarter', g.monthly.map(m => '<div class="target-row"><div class="target-top"><span>' + mkLabel(m.mk) + (m.mk === monthKey(Date.now()) ? ' <span class="faint small">now</span>' : '') + '</span><b>' + (m.future ? '<span class="faint">–</span>' : m.count + ' / ' + g.target) + '</b></div>' + bar(m.future ? 0 : m.count / g.target, 'var(--career)', 'thin') + '</div>').join('') +
    '<div class="note mt12">' + (g.catchUp > 0 ? '<b>' + g.catchUp + ' more</b> this month keeps you square with the quarter.' : 'Square with the quarter. Everything from here is extra.') +
    (g.projectedCount != null ? ' At this pace you finish on <b>' + g.projectedCount + ' meetings (' + Math.round(g.projAtt) + '%)</b>, worth about <b>' + gbp(g.projAmount, true) + '</b>.' : '') + '</div>',
    { dot: 'var(--career)', right: '<button class="btn sm ghost" data-act="log:meeting">Log</button>' });
  h += card('What a meeting is worth', '<div class="score-row"><div>Up to 100%</div><div></div><div class="li-side">' + gbp2(g.perMeetingBelow) + '</div></div>' +
    '<div class="score-row"><div>100% to 170%</div><div></div><div class="li-side">' + gbp2(g.perMeetingAbove) + '</div></div>' +
    '<div class="note small faint mt8">Level ' + G.level + ' on-target bonus: ' + gbp2(G.l1Bonus) + ' (level 1) + ' + G.uplift + '% = ' + gbp2(g.onTarget) + ' a quarter. 170% attainment pays the 150% cap. Adjust in Settings → Gartner.</div>');
  const hist = gartnerHistory();
  h += card('Quarter history', hist.map(q => '<div class="list-item"><div class="li-main"><div class="li-title">' + q.label + '</div><div class="li-sub">' + q.count + ' / ' + q.qTarget + ' meetings · ' + Math.round(q.pay) + '% payout</div></div><div class="li-side">' + gbp(q.amount, true) + '<div class="faint small">' + Math.round(q.att) + '%</div></div></div>').join('') || '<div class="empty">No meetings yet</div>', { cls: 'flush' });
  return h;
}
function salesView() {
  const S = state.sales, closes = S.closes.slice().sort((a, b) => b.date - a.date);
  const mk = monthKey(Date.now()), prev = addMonthsMk(mk, -1);
  let h = '<div class="stats">' + stat('This month', usd(cashInMonth(mk)), closesInMonth(mk).length + ' closes') + stat('Last month', usd(cashInMonth(prev)), closesInMonth(prev).length + ' closes') +
    stat('All time', usd(sum(S.closes, c => c.cash)), '≈ ' + gbp(usdToGbp(sum(S.closes, c => c.earnings))) + ' earned') + '</div>';
  const cols = [];
  for (let i = 11; i >= 0; i--) { const m = addMonthsMk(mk, -i), v = cashInMonth(m); cols.push({ label: mkShort(m), value: v, color: 'var(--money)', dim: i === 0, tip: tipRows(mkLabel(m), [{ label: 'Collected', value: usd(v, true) }, { label: 'Closes', value: String(closesInMonth(m).length) }]) }); }
  h += card('Cash collected', columnChart(cols, { axis: true, fmt: v => '$' + compact(v), aria: 'Cash collected per month' }), { dot: 'var(--money)', right: '<button class="btn sm ghost" data-act="log:close">Log close</button>' });
  h += card('Closes', closes.length ? moreList('closes', closes, 8, c => '<button class="list-item tap" style="width:100%;text-align:left" data-act="edit" data-kind="close" data-id="' + c.id + '">' +
    '<div class="li-main"><div class="li-title">' + usd(c.cash, true) + ' collected</div><div class="li-sub">' + cap(c.role) + ' · ' + c.rate + '% · ' + fmtDate(c.date) + '</div></div><div class="li-side">+' + usd(c.earnings, true) + '</div></button>') : '<div class="empty">No closes yet</div>', { cls: 'flush' });
  return h;
}

/* ======================= GOALS ======================= */
function renderGoals() {
  const el = document.getElementById('screen-goals');
  const xp = totalXP(), lv = levelFromXP(xp), rank = rankFor(lv.level), rows = xpBreakdown();
  let h = pageHead('Goals', 'Level ' + lv.level);
  h += card(null, '<div class="row between"><div><div class="label">' + rank.name + '</div><div class="mid-num">' + xp.toLocaleString('en-GB') + '<small>XP</small></div></div><div class="faint small">' + (lv.xpNeeded - lv.xpInLevel) + ' XP to level ' + (lv.level + 1) + '</div></div>' +
    '<div class="mt12">' + bar(lv.xpInLevel / lv.xpNeeded, 'var(--life)') + '</div>' +
    '<details class="more"><summary>Where your XP comes from</summary><div class="mt8">' + rows.map(r => '<div class="score-row"><div><span class="pdot" style="--c:' + pm(r.pillar).color + ';display:inline-block;margin-right:7px"></span><b>' + r.label + '</b><div class="faint small">' + esc(r.note) + '</div></div><div></div><div class="li-side">' + r.xp.toLocaleString('en-GB') + '</div></div>').join('') +
    '<div class="note small faint mt8">XP rewards hitting targets: weekly gym and BJJ targets, monthly and quarterly Gartner targets, income milestones and completed reviews.</div></div></details>', { cls: 'hero' });

  const wins = allWins();
  const filtered = ui.winFilter === 'auto' ? wins.filter(w => w.auto) : ui.winFilter === 'banked' ? wins.filter(w => !w.auto) : wins;
  h += card('Win vault <span class="faint" style="font-weight:600">' + wins.length + '</span>',
    '<div style="padding:0 18px">' + seg('wins', ui.winFilter, [['all', 'All'], ['auto', 'Automatic'], ['banked', 'Banked']]) + '</div>' +
    (filtered.length ? moreList('wins', filtered, 8, w => '<' + (w.auto ? 'div' : 'button data-act="edit" data-kind="win" data-id="' + w.id + '"') + ' class="list-item' + (w.auto ? '' : ' tap') + '" style="width:100%;text-align:left">' + liIcon(w.pillar === 'sales' ? 'sales' : w.pillar, 'win') +
      '<div class="li-main"><div class="li-title wrap">' + esc(w.title) + '</div><div class="li-sub">' + fmtDate(w.date) + (w.auto ? ' · automatic' : '') + '</div></div></' + (w.auto ? 'div' : 'button') + '>') : '<div class="empty">Nothing here yet</div>') +
    '<button class="more-btn" data-act="log:win">+ Bank a win</button>', { cls: 'flush', right: '' });

  const items = state.legacy.items;
  h += card('Legacy goals', items.map(l => '<div class="list-item"><button data-act="toggle-legacy" data-id="' + l.id + '" style="width:24px;height:24px;border-radius:50%;display:grid;place-items:center;flex:0 0 auto;' + (l.done ? 'background:var(--life)' : 'box-shadow:inset 0 0 0 1.5px var(--line-2)') + '">' + (l.done ? '<svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:#fff;stroke-width:3;fill:none">' + ICONS.check + '</svg>' : '') + '</button>' +
    '<div class="li-main"><div class="li-title" style="' + (l.done ? 'color:var(--text-3)' : '') + '">' + esc(l.name) + '</div>' + (l.done && l.hitDate ? '<div class="li-sub">Done ' + fmtDate(l.hitDate) + '</div>' : '') + '</div><button class="faint" data-act="delete-legacy" data-id="' + l.id + '" aria-label="Remove">×</button></div>').join('') +
    '<button class="more-btn" data-act="add-legacy">+ Add a goal</button>', { cls: 'flush' });
  el.innerHTML = h;
}

/* ======================= REVIEW ======================= */
function renderReview() {
  const el = document.getElementById('screen-review');
  const kind = ui.reviewKind, anchor = ui.reviewAnchor;
  const cur = periodStats(kind, anchor), prev = periodStats(kind, shiftAnchor(kind, anchor, -1));
  const isNow = periodRange(kind, Date.now()).start === cur.range.start;
  let h = pageHead('Review', 'The debrief') + seg('review', kind, [['week', 'Week'], ['month', 'Month'], ['quarter', 'Quarter']]);
  h += '<div class="period-nav"><button data-act="period" data-dir="-1" aria-label="Previous">' + icon('left') + '</button><div class="pl"><b>' + esc(cur.range.label) + '</b><span>' + (isNow ? 'so far' : 'vs ' + esc(prev.range.label)) + '</span></div>' +
    '<button data-act="period" data-dir="1" aria-label="Next" ' + (isNow ? 'disabled' : '') + '>' + icon('right') + '</button></div>';

  if (kind === 'week') {
    const due = reviewDue(), rv = reviewFor(cur.range.start), streak = reviewStreak();
    h += card(null, '<div class="next"><div class="next-icon" style="--c:var(--text)">' + icon('review') + '</div><div class="grow"><div class="next-title">' + (rv && rv.completedAt ? 'Review done' : 'Weekly review') + '</div>' +
      '<div class="next-why">' + (rv && rv.completedAt ? 'Completed ' + fmtDay(rv.completedAt) + '. Tap to edit.' : due ? 'Due for ' + due.label + '. 3 steps: numbers, reflect, next week.' : 'Opens from Friday. Reflect and set next week\'s targets.') + (streak ? ' · ' + streak + '-week streak' : '') + '</div></div>' +
      '<button class="btn sm ' + (rv && rv.completedAt ? 'ghost' : 'brand') + '" data-act="review" data-ws="' + (due && !(rv && rv.completedAt) && isNow ? due.ws : cur.range.start) + '">' + (rv && rv.completedAt ? 'Edit' : 'Start') + '</button></div>');
    const sc = weekScore(cur.range.start), scPrev = weekScore(prev.range.start);
    h += card('Week score', '<div class="row between"><div class="mid-num">' + sc.score + '<small>/ 100</small></div>' + deltaHtml(sc.score, scPrev.score, v => v + ' pts') + '</div>' +
      '<div class="mt12">' + columnChart(weekScoreSeries(12).map((w, i, a) => ({ label: i % 3 === 2 || i === a.length - 1 ? new Date(w.ws).getDate() + '/' + (new Date(w.ws).getMonth() + 1) : '', value: w.score, color: 'var(--text)', dim: w.ws !== cur.range.start, showValue: w.ws === cur.range.start,
        tip: tipRows('Week of ' + fmtDate(w.ws), Object.entries(w.parts).map(([k, v]) => ({ label: k === 'career' ? 'Gartner' : cap(k), value: Math.round(v * 100) + '%' })).concat([{ label: 'Score', value: String(w.score) }])) })), { height: 120, aria: 'Week score, last 12 weeks' }) + '</div>' +
      '<div class="note small faint">Gym 30 · BJJ 20 · Gartner pace 20 · Sales 15 · Review done 15. Tap a bar for the breakdown.</div>');
    if (!isNow) {
      const t = sc.targets;
      const rows = [['Gym', cur.gym, t.gym], ['BJJ', cur.bjj, t.bjj]];
      if (t.closes) rows.push(['Closes', cur.closes, t.closes]);
      h += card('Targets vs actual', rows.map(([l, a, tg]) => '<div class="score-row"><div>' + l + '</div><div class="faint small">' + a + ' / ' + tg + '</div>' + (a >= tg ? '<span class="pill good">' + icon('check') + 'Hit</span>' : '<span class="pill bad">Missed</span>') + '</div>').join('') + (t.focus ? '<div class="note mt12"><b>Focus was:</b> ' + esc(t.focus) + '</div>' : ''));
    }
  }

  // scorecard
  const rowsSC = [];
  rowsSC.push(['gym', 'Gym sessions', cur.gym, prev.gym, v => String(v), cur.gymQ ? 'avg ' + cur.gymQ.toFixed(1) + '/5' : '']);
  rowsSC.push(['bjj', 'BJJ sessions', cur.bjj, prev.bjj, v => String(v), cur.bjjHours ? cur.bjjHours.toFixed(1) + ' h' : '']);
  if (kind !== 'week') rowsSC.push(['career', 'Gartner meetings', cur.meetings, prev.meetings, v => String(v), 'target ' + (state.career.target * (kind === 'quarter' ? 3 : 1))]);
  if (state.sales.active || cur.closes || prev.closes) rowsSC.push(['sales', 'Cash collected', cur.cash, prev.cash, v => usd(v), plural(cur.closes, 'close')]);
  if (kind !== 'week') rowsSC.push(['money', 'Income logged', cur.incomeMonths ? cur.income : null, prev.incomeMonths ? prev.income : null, v => gbp(v, true), cur.incomeMonths ? plural(cur.incomeMonths, 'month') : 'not logged']);
  rowsSC.push(['life', 'Wins', cur.wins.length, prev.wins.length, v => String(v), cur.wins.filter(w => w.auto).length + ' automatic']);
  h += card('Scorecard', rowsSC.map(([p, label, v, pv, f, sub]) => '<div class="score-row"><div class="row"><span class="pdot" style="--c:' + pm(p).color + '"></span><div><div style="font-weight:600">' + label + '</div><div class="faint small">' + esc(sub) + '</div></div></div>' +
    '<div class="li-side" style="font-size:16px;color:var(--text)">' + (v == null ? '–' : f(v)) + '</div>' + deltaHtml(v, pv, f) + '</div>').join('') +
    '<div class="note small faint mt8">Deltas compare with ' + esc(prev.range.label) + (isNow ? ' (full period)' : '') + '.</div>');

  if (kind === 'month') {
    const rep = monthReport(cur.range.mk);
    h += card('Report card', '<div class="row between" style="margin-bottom:6px"><span class="muted">Overall</span>' + gradeBadge(rep.overall) + '</div>' + rep.grades.map(g => '<div class="score-row"><div><b>' + g.name + '</b><div class="faint small">' + esc(g.note) + '</div></div><div></div>' + gradeBadge(g.grade, true) + '</div>').join('') +
      (rep.isCurrent ? '<div class="note small faint mt8">Month in progress: graded on pace so far.</div>' : ''));
  }
  if (kind === 'quarter') {
    const qb = quarterBonus(quarterOf(cur.range.start).key);
    h += card('Gartner', '<div class="row between"><div><div class="mid-num">' + Math.round(qb.att) + '%</div><div class="note">' + qb.count + ' / ' + qb.qTarget + ' meetings</div></div><div class="li-side"><div class="mid-num">' + gbp(qb.amount, true) + '</div><div class="faint small">est. bonus</div></div></div>', { dot: 'var(--career)' });
    h += card('Months', cur.range.months.filter(m => mkIndex(m) <= mkIndex(monthKey(Date.now()))).map(m => { const r = monthReport(m); return '<div class="score-row"><div><b>' + mkLabel(m) + '</b><div class="faint small">' + r.grades.filter(g => g.grade).map(g => g.name + ' ' + g.grade).join(' · ') + '</div></div><div></div>' + gradeBadge(r.overall, true) + '</div>'; }).join(''));
  }

  if (cur.muscles.some(m => m.n) && kind !== 'week') h += card('Muscle groups', '<div class="chips">' + cur.muscles.map(m => '<span class="chip ' + (m.n ? 'on' : '') + '" style="--c:var(--gym)">' + cap(m.m) + ' · ' + m.n + '</span>').join('') + '</div>');

  // calendar
  const days = calendarDays(16), today = dayKey(Date.now());
  const monthsRow = []; for (let w = 0; w < 16; w++) { const d = new Date(days[w * 7].ts); monthsRow.push(d.getDate() <= 7 ? MONTHS[d.getMonth()] : ''); }
  h += card('Training calendar', '<div class="cal-months" style="grid-template-columns:repeat(16,1fr)">' + monthsRow.map(m => '<span>' + m + '</span>').join('') + '</div>' +
    '<div class="cal">' + days.map(d => '<i class="' + [(d.gym && d.bjj ? 'gj' : d.gym ? 'g' : d.bjj ? 'j' : ''), d.close ? 'c' : '', d.future ? 'f' : '', d.k === today ? 't' : ''].join(' ') + '" data-tip="' + esc(tipRows(fmtDate(d.ts), [{ label: 'Gym', value: String(d.gym), color: 'var(--gym)' }, { label: 'BJJ', value: String(d.bjj), color: 'var(--bjj)' }, { label: 'Closes', value: String(d.close), color: 'var(--money)' }])) + '"></i>').join('') + '</div>' +
    '<div class="legend"><span><i style="--c:var(--gym)"></i>Gym</span><span><i style="--c:var(--bjj)"></i>BJJ</span><span><i style="--c:transparent;box-shadow:inset 0 0 0 2px var(--money)"></i>Close</span></div>' +
    '<div class="note small faint mt8">16 weeks, Monday at the top. Gartner meetings are counted by month, so they are not on the calendar.</div>');

  h += card('Patterns', correlationInsights().map(i => '<div class="insight">' + i.text + '</div>').join(''));

  if (kind === 'week') {
    const hits = planHitHistory(8);
    if (hits.length) h += card('Target hit rate', '<div class="mid-num">' + Math.round(sum(hits, x => x.hit) / sum(hits, x => x.total) * 100) + '%</div><div class="note">of targets hit across ' + plural(hits.length, 'reviewed week') + '</div>');
    const past = Object.entries(state.reviews).filter(([, r]) => r.completedAt).sort((a, b) => b[0].localeCompare(a[0]));
    h += card('Past reviews', past.length ? moreList('reviews', past, 4, ([k, r]) => '<div class="review-entry"><div class="row between"><b>Week of ' + fmtDate(isoToTs(k)) + '</b>' + (r.rating ? '<span class="pill">' + r.rating + '/5</span>' : '') + '</div><dl>' +
      (r.win ? '<dt>Win</dt><dd>' + esc(r.win) + '</dd>' : '') + (r.lesson ? '<dt>Lesson</dt><dd>' + esc(r.lesson) + '</dd>' : '') + (r.next && r.next.focus ? '<dt>Focus</dt><dd>' + esc(r.next.focus) + '</dd>' : '') +
      (r.next ? '<dt>Targets</dt><dd>Gym ' + r.next.gym + ' · BJJ ' + r.next.bjj + (r.next.closes ? ' · closes ' + r.next.closes : '') + '</dd>' : '') + '</dl></div>') : '<div class="empty">Your reviews will collect here</div>', { cls: 'flush' });
  } else if (kind === 'month') {
    const reps = monthReports();
    h += card('All report cards', moreList('reports', reps, 6, r => '<button class="list-item tap" style="width:100%;text-align:left" data-act="goto-month" data-mk="' + r.mk + '"><div class="li-main"><div class="li-title">' + mkLabel(r.mk) + (r.isCurrent ? ' <span class="faint small">so far</span>' : '') + '</div><div class="li-sub">' + r.grades.filter(g => g.grade).map(g => g.name + ' ' + g.grade).join(' · ') + '</div></div>' + gradeBadge(r.overall, true) + '</button>'), { cls: 'flush' });
  }
  el.innerHTML = h;
}
