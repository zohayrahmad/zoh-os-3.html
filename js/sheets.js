/* =========================================================
   Zoh OS: sheets. Quick log, edit, weekly review, settings.
   A sheet renders from `draft`; inputs with data-f write into it.
   ========================================================= */

let draft = null;
function todayIso() { return tsToDateInput(Date.now()); }
function rerenderSheet() { if (draft) document.getElementById('sheet').innerHTML = '<div class="grabber"></div>' + SHEETS[draft.kind](); }
function openDraft(d) { draft = d; openSheet(SHEETS[d.kind](), () => { draft = null; }); }

function fInput(field, value, attrs = '') { return '<input class="input" data-f="' + field + '" value="' + esc(value == null ? '' : value) + '" ' + attrs + '>'; }
function fNum(field, value, attrs = '') { return fInput(field, value, 'type="number" inputmode="decimal" ' + attrs); }
function fText(field, value, ph) { return '<textarea class="textarea" data-f="' + field + '" placeholder="' + esc(ph || '') + '">' + esc(value || '') + '</textarea>'; }
function fDate(field, value) { return fInput(field, value, 'type="date"'); }
function field(label, inner) { return '<div class="field"><label>' + label + '</label>' + inner + '</div>'; }
function quality(key, val, color) {
  return '<div class="dots5" style="--c:' + color + '">' + [1, 2, 3, 4, 5].map(i => '<button class="' + (val === i ? 'on' : '') + '" data-act="d-set" data-k="' + key + '" data-v="' + i + '" data-num="1">' + i + '</button>').join('') + '</div>';
}
function foot(saveLabel, del) {
  return '<div class="sheet-foot"><button class="btn block" data-act="d-save">' + saveLabel + '</button>' + (del ? '<button class="btn block danger mt8" data-act="d-delete">Delete</button>' : '') + '</div>';
}
function findRec(kind, id) {
  const lists = { gym: state.gym.sessions, bjj: state.bjj.sessions, close: state.sales.closes, income: state.money.incomes, win: state.wins, pb: state.gym.pbs };
  return (lists[kind] || []).find(x => x.id === id);
}
function listFor(kind) { return { gym: state.gym.sessions, bjj: state.bjj.sessions, close: state.sales.closes, income: state.money.incomes, win: state.wins, pb: state.gym.pbs }[kind]; }
function defaultRate(role) { return role === 'closer' ? state.money.lanes.closer.rate : state.money.lanes.setter.rate; }

/* ---------- drafts ---------- */
function newDraft(kind, rec) {
  switch (kind) {
    case 'gym': return rec ? { kind, id: rec.id, muscles: rec.muscles.slice(), quality: rec.quality, date: tsToDateInput(rec.date), notes: rec.notes }
      : { kind, muscles: [], quality: null, date: todayIso(), notes: '' };
    case 'bjj': return rec ? { kind, id: rec.id, minutes: rec.minutes || state.bjj.sessionMinutes, quality: rec.quality, rounds: rec.rounds || '', date: tsToDateInput(rec.date), notes: rec.notes }
      : { kind, minutes: state.bjj.sessionMinutes || 75, quality: null, rounds: '', date: todayIso(), notes: '' };
    case 'meeting': return { kind, count: 1, month: monthKey(Date.now()) };
    case 'close': return rec ? { kind, id: rec.id, cash: rec.cash, rate: rec.rate, role: rec.role, date: tsToDateInput(rec.date) }
      : { kind, cash: '', rate: defaultRate(state.sales.role), role: state.sales.role, date: todayIso() };
    case 'income': {
      const mk = rec ? rec.monthKey : monthKey(Date.now());
      return incomeDraft(mk, rec ? rec.id : null);
    }
    case 'win': return rec ? { kind, id: rec.id, title: rec.title, pillar: rec.pillar, date: tsToDateInput(rec.date) } : { kind, title: '', pillar: 'life', date: todayIso() };
    case 'pb': return rec ? { kind, id: rec.id, name: rec.name, date: tsToDateInput(rec.date) } : { kind, name: '', date: todayIso() };
    case 'injury': return { kind, name: '' };
    case 'portfolio': return { kind, value: state.money.portfolio || '' };
    case 'inst': return { kind, name: '' };
    case 'legacy': return { kind, name: '' };
    default: return { kind };
  }
}
function incomeDraft(mk, id) {
  const e = incomeFor(mk);
  const sug = suggestedSources(mk);
  return {
    kind: 'income', id: e ? e.id : id, month: mk, existing: e ? incomeTotal(e) : null,
    split: e ? !!e.sources || true : true,
    sources: e && e.sources ? Object.assign({ base: 0, commission: 0, bonus: 0, other: 0 }, e.sources) : sug,
    total: e ? incomeTotal(e) : '', hadSplit: !!(e && e.sources),
  };
}

/* ---------- sheet views ---------- */
const LOG_TYPES = [
  ['gym', 'Gym', 'gym', 'gym'], ['bjj', 'BJJ', 'bjj', 'bjj'], ['meeting', 'Meetings', 'career', 'career'], ['income', 'Income', 'money', 'income'],
  ['close', 'Close', 'sales', 'sales'], ['win', 'Win', 'life', 'win'], ['pb', 'PB', 'gym', 'pb'], ['injury', 'Injury', 'gym', 'injury'],
];
const SHEETS = {
  menu() {
    const tpls = gymTemplates();
    const types = LOG_TYPES.filter(t => t[0] !== 'close' || state.sales.active);
    return sheetHead('Log') +
      (tpls.length ? '<div class="flabel mt8">One tap</div><div class="quick-row">' + tpls.map((m, i) => '<button class="chip tpl" style="--c:var(--gym)" data-act="quick-gym" data-i="' + i + '"><span class="pdot" style="--c:var(--gym)"></span>' + m.map(cap).join(' + ') + '</button>').join('') +
        '<button class="chip tpl" data-act="quick-meeting"><span class="pdot" style="--c:var(--career)"></span>+1 meeting</button></div>' : '') +
      '<div class="log-grid">' + types.map(([k, label, p, ic]) => '<button class="log-tile" data-act="log:' + k + '">' + liIcon(p, ic) + label + '</button>').join('') + '</div>' +
      '<button class="btn block line mt16" data-act="review">' + icon('review') + 'Weekly review</button>';
  },
  gym() {
    const d = draft, tpls = gymTemplates();
    return sheetHead(d.id ? 'Edit gym session' : 'Gym session', d.id ? null : 'log-menu') +
      (tpls.length && !d.id ? '<div class="flabel mt8">Your usual splits</div><div class="chips">' + tpls.map((m, i) => '<button class="chip" data-act="d-tpl" data-i="' + i + '">' + m.map(cap).join(' + ') + '</button>').join('') + '</div>' : '') +
      field('Muscles', '<div class="chips">' + MUSCLES.map(m => '<button class="chip ' + (d.muscles.includes(m) ? 'on' : '') + '" style="--c:var(--gym)" data-act="d-toggle" data-k="muscles" data-v="' + m + '">' + cap(m) + '</button>').join('') + '</div>') +
      field('How did it go?', quality('quality', d.quality, 'var(--gym)')) +
      field('Date', fDate('date', d.date)) + field('Notes', fText('notes', d.notes, 'Optional')) + foot(d.id ? 'Save' : 'Log session', d.id);
  },
  bjj() {
    const d = draft;
    return sheetHead(d.id ? 'Edit BJJ session' : 'BJJ session', d.id ? null : 'log-menu') +
      field('Length', '<div class="chips">' + [60, 75, 90, 120].map(m => '<button class="chip ' + (Number(d.minutes) === m ? 'on' : '') + '" style="--c:var(--bjj)" data-act="d-set" data-k="minutes" data-v="' + m + '" data-num="1">' + m + ' min</button>').join('') + '</div>') +
      field('How did the rolls go?', quality('quality', d.quality, 'var(--bjj)')) +
      '<div class="grid2 field">' + field('Date', fDate('date', d.date)) + field('Live rounds', fNum('rounds', d.rounds, 'placeholder="Optional"')) + '</div>' +
      field('Notes', fText('notes', d.notes, 'Optional. Detail lives in Mat Log.')) + foot(d.id ? 'Save' : 'Log session', d.id);
  },
  meeting() {
    const d = draft, cur = monthKey(Date.now());
    const opts = [0, -1, -2].map(i => addMonthsMk(cur, i));
    const logged = meetingsInMonth(d.month);
    return sheetHead('Gartner meetings', 'log-menu') +
      '<div class="note mt8">Counted by month, so the exact day doesn\'t matter.</div>' +
      field('Month', '<div class="chips">' + opts.map(mk => '<button class="chip ' + (d.month === mk ? 'on' : '') + '" style="--c:var(--career)" data-act="d-set" data-k="month" data-v="' + mk + '">' + mkLabel(mk) + '</button>').join('') + '</div>') +
      field('Meetings to add', '<div class="stepper"><button data-act="d-step" data-k="count" data-d="-1" data-min="1">−</button><div class="sv">' + d.count + '</div><button data-act="d-step" data-k="count" data-d="1" data-min="1" data-max="50">+</button></div>') +
      '<div class="note mt12">' + mkLabel(d.month) + ': <b>' + logged + '</b> logged → <b>' + (logged + d.count) + '</b> of ' + state.career.target + '.' +
      (logged ? ' <button class="card-link" style="display:inline;padding:0;text-decoration:underline" data-act="remove-meeting">Remove one</button>' : '') + '</div>' +
      foot('Add ' + plural(d.count, 'meeting'));
  },
  close() {
    const d = draft, earn = (Number(d.cash) || 0) * (Number(d.rate) || 0) / 100;
    return sheetHead(d.id ? 'Edit close' : 'Close', d.id ? null : 'log-menu') +
      field('Role', '<div class="chips">' + ['setter', 'closer'].map(r => '<button class="chip ' + (d.role === r ? 'on' : '') + '" style="--c:var(--money)" data-act="d-role" data-v="' + r + '">' + cap(r) + '</button>').join('') + '</div>') +
      '<div class="grid2 field">' + field('Cash collected', '<div class="prefix"><span>$</span>' + fNum('cash', d.cash, 'placeholder="2500"') + '</div>') + field('Commission %', fNum('rate', d.rate, 'step="0.5"')) + '</div>' +
      field('Date', fDate('date', d.date)) +
      '<div class="note mt12" data-live="earn">Earns <b>' + usd(earn, true) + '</b> ≈ ' + gbp(usdToGbp(earn), true) + '</div>' + foot(d.id ? 'Save' : 'Log close', d.id);
  },
  income() {
    const d = draft;
    const total = d.split ? sum(Object.values(d.sources), v => Number(v) || 0) : Number(d.total) || 0;
    const cur = monthKey(Date.now());
    const months = []; for (let i = 0; i < 6; i++) months.push(addMonthsMk(cur, -i));
    if (!months.includes(d.month)) months.push(d.month);
    return sheetHead('Income', d.id ? null : 'log-menu') +
      field('Month', '<select class="select" data-f="month" data-rerender="income-month">' + months.map(mk => '<option value="' + mk + '"' + (mk === d.month ? ' selected' : '') + '>' + mkLabel(mk) + (incomeFor(mk) ? ' · logged' : '') + '</option>').join('') + '</select>') +
      '<div class="toggle"><span>Split by source</span><button class="switch ' + (d.split ? 'on' : '') + '" data-act="d-flip" data-k="split" aria-label="Split by source"></button></div>' +
      (d.split ? '<div class="grid2">' + INCOME_SOURCES.map(s => field('<span class="pdot" style="--c:' + SOURCE_COLORS[s.id] + ';display:inline-block;margin-right:6px"></span>' + s.label, '<div class="prefix"><span>£</span>' + fNum('sources.' + s.id, d.sources[s.id] || '', 'placeholder="0"') + '</div>')).join('') + '</div>' +
        '<div class="note mt8 small faint">Base comes from settings; commission from closes logged that month. Edit anything.</div>'
        : field('Total for the month', '<div class="prefix"><span>£</span>' + fNum('total', d.total, 'placeholder="0"') + '</div>')) +
      '<div class="row between mt16"><span class="muted">Total</span><span class="mid-num" data-live="total">' + gbp(total, true) + '</span></div>' +
      (d.existing != null && Math.round(d.existing) !== Math.round(total) ? '<div class="note small mt8" data-live="was">Currently logged: ' + gbp(d.existing, true) + (d.hadSplit ? '' : ' (no split)') + '</div>' : '') +
      foot(d.existing != null ? 'Update ' + mkLabel(d.month) : 'Save ' + mkLabel(d.month), d.id && d.existing != null);
  },
  win() {
    const d = draft;
    const opts = [['life', 'Life'], ['gym', 'Gym'], ['bjj', 'BJJ'], ['career', 'Gartner'], ['money', 'Money'], ['sales', 'Sales']];
    return sheetHead(d.id ? 'Edit win' : 'Bank a win', d.id ? null : 'log-menu') + field('What did you win?', fInput('title', d.title, 'placeholder="e.g. Closed a $3k deal"')) +
      field('Pillar', '<div class="chips">' + opts.map(([k, l]) => '<button class="chip ' + (d.pillar === k ? 'on' : '') + '" style="--c:' + pm(k).color + '" data-act="d-set" data-k="pillar" data-v="' + k + '">' + l + '</button>').join('') + '</div>') +
      field('Date', fDate('date', d.date)) + foot(d.id ? 'Save' : 'Bank it', d.id);
  },
  pb() { const d = draft; return sheetHead(d.id ? 'Edit PB' : 'Personal best', d.id ? null : 'log-menu') + field('What was it?', fInput('name', d.name, 'placeholder="e.g. Bench 80kg x5"')) + field('Date', fDate('date', d.date)) + foot(d.id ? 'Save' : 'Add PB', d.id); },
  injury() { return sheetHead('Flag an injury', 'log-menu') + field('Where?', fInput('name', draft.name, 'placeholder="e.g. Right elbow"')) + foot('Flag it'); },
  portfolio() { return sheetHead('Portfolio value') + field('Current value', '<div class="prefix"><span>£</span>' + fNum('value', draft.value) + '</div>') + foot('Update'); },
  inst() { return sheetHead('Add instructional') + field('Name', fInput('name', draft.name, 'placeholder="e.g. Pin Escapes Vol 2 - John Danaher"')) + foot('Add'); },
  legacy() { return sheetHead('Add a legacy goal') + field('Goal', fInput('name', draft.name, 'placeholder="e.g. Run a half marathon"')) + foot('Add'); },
  review: reviewSheet,
  settings: settingsSheet,
};

/* ---------- save / delete ---------- */
function saveDraft() {
  const d = draft;
  const ts = v => {
    const t = dateInputToTs(v);
    // keep "today" entries at the real time so ordering within a day is right
    return sameDay(t, Date.now()) ? Date.now() : t;
  };
  let label = 'Saved';
  const ok = (() => {
    switch (d.kind) {
      case 'gym': {
        if (!d.muscles.length && !d.notes) { toast('Pick at least one muscle group'); return false; }
        const rec = { muscles: d.muscles, quality: d.quality, notes: (d.notes || '').trim(), date: ts(d.date) };
        upsert(state.gym.sessions, d.id, rec, 'gym'); label = d.id ? 'Session updated' : 'Gym session logged'; return true;
      }
      case 'bjj': {
        const rec = { minutes: Number(d.minutes) || null, quality: d.quality, rounds: Number(d.rounds) || null, notes: (d.notes || '').trim(), date: ts(d.date) };
        upsert(state.bjj.sessions, d.id, rec, 'bjj'); label = d.id ? 'Session updated' : 'BJJ session logged'; return true;
      }
      case 'meeting': {
        const cur = monthKey(Date.now());
        const date = d.month === cur ? Date.now() : monthBounds(d.month).end - DAY / 2;
        for (let i = 0; i < d.count; i++) state.career.meetings.push({ id: uid('mtg'), date, notes: '' });
        label = plural(d.count, 'meeting') + ' added to ' + MONTHS[Number(d.month.slice(5)) - 1]; return true;
      }
      case 'close': {
        const cash = Number(d.cash) || 0, rate = Number(d.rate) || 0;
        if (!cash) { toast('Enter the cash collected'); return false; }
        upsert(state.sales.closes, d.id, { cash, rate, role: d.role, earnings: Math.round(cash * rate) / 100, date: ts(d.date) }, 'close');
        label = d.id ? 'Close updated' : 'Close logged · ' + usd(cash * rate / 100, true) + ' earned'; return true;
      }
      case 'income': {
        const sources = d.split ? Object.fromEntries(INCOME_SOURCES.map(s => [s.id, Number(d.sources[s.id]) || 0])) : null;
        const amount = d.split ? sum(Object.values(sources)) : Number(d.total) || 0;
        if (!amount) { toast('Enter an amount'); return false; }
        const e = incomeFor(d.month);
        if (e) Object.assign(e, { amount, sources, updated: Date.now() });
        else state.money.incomes.push({ id: uid('inc'), monthKey: d.month, amount, sources, updated: Date.now() });
        label = mkLabel(d.month) + ' saved · ' + gbp(amount, true); return true;
      }
      case 'win': {
        if (!d.title.trim()) { toast('Describe the win'); return false; }
        upsert(state.wins, d.id, { title: d.title.trim(), pillar: d.pillar, date: ts(d.date) }, 'win'); label = 'Win banked'; return true;
      }
      case 'pb': {
        if (!d.name.trim()) { toast('Describe the PB'); return false; }
        upsert(state.gym.pbs, d.id, { name: d.name.trim(), date: ts(d.date) }, 'pb'); label = 'PB added'; return true;
      }
      case 'injury': {
        if (!d.name.trim()) return false;
        state.injuries.push({ id: uid('inj'), name: d.name.trim(), started: Date.now(), resolved: null, notes: '' }); label = 'Injury flagged'; return true;
      }
      case 'portfolio': {
        const v = Number(d.value) || 0;
        state.money.portfolio = v; state.money.portfolioHistory.push({ date: Date.now(), value: v }); label = 'Portfolio updated'; return true;
      }
      case 'inst': { if (!d.name.trim()) return false; state.bjj.instructionals.push({ id: uid('inst'), name: d.name.trim(), done: false, added: Date.now(), completed: null }); label = 'Added'; return true; }
      case 'legacy': { if (!d.name.trim()) return false; state.legacy.items.push({ id: Date.now(), name: d.name.trim(), done: false, hitDate: null, locked: false }); label = 'Goal added'; return true; }
    }
    return false;
  })();
  return ok ? label : null;
}
function upsert(list, id, rec, prefix) {
  if (id) { const x = list.find(r => r.id === id); if (x) Object.assign(x, rec); }
  else list.push(Object.assign({ id: uid(prefix) }, rec));
}

/* ======================= WEEKLY REVIEW ======================= */
function reviewDraft(ws) {
  const key = reviewKey(ws), ex = state.reviews[key] || {};
  const t = targetsFor(ws), c = weekCounts(ws);
  // suggestion: keep a target you hit, hold one you missed
  const nextGym = ex.next ? ex.next.gym : t.gym;
  const nextBjj = ex.next ? ex.next.bjj : t.bjj;
  return {
    kind: 'review', ws, key, step: 1, rating: ex.rating || null, win: ex.win || '', bankWin: ex.winId ? true : !ex.completedAt, lesson: ex.lesson || '',
    gym: nextGym, bjj: nextBjj, closes: ex.next ? (ex.next.closes || 0) : (t.closes || (state.sales.active && c.closes ? 1 : 0)), focus: ex.next ? ex.next.focus || '' : '',
    winId: ex.winId || null,
  };
}
function reviewSheet() {
  const d = draft, ws = d.ws, t = targetsFor(ws), c = weekCounts(ws), sc = weekScore(ws);
  const steps = '<div class="steps">' + [1, 2, 3].map(i => '<i class="' + (i <= d.step ? 'on' : '') + '"></i>').join('') + '</div>';
  const head = sheetHead('Week of ' + weekLabel(ws)) + steps;
  if (d.step === 1) {
    const rows = [['gym', 'Gym', c.gym, t.gym], ['bjj', 'BJJ', c.bjj, t.bjj]];
    if (state.sales.active) rows.push(['sales', 'Closes', c.closes, t.closes || '–']);
    const mk = monthKey(Math.min(addWeeks(ws, 1) - 1, Date.now()));
    const wins = allWins().filter(w => w.date >= ws && w.date < addWeeks(ws, 1));
    return head + '<div class="label">1 · The numbers</div>' +
      '<div class="row between mt12"><div class="mid-num">' + sc.score + '<small>/ 100 week score</small></div>' + deltaHtml(sc.score, weekScore(addWeeks(ws, -1)).score, v => v + ' pts') + '</div>' +
      '<div class="mt12">' + rows.map(([p, l, a, tg]) => '<div class="score-row"><div class="row"><span class="pdot" style="--c:' + pm(p).color + '"></span>' + l + '</div><div class="faint small">' + a + ' / ' + tg + '</div>' +
        (typeof tg === 'number' ? (a >= tg ? '<span class="pill good">' + icon('check') + 'Hit</span>' : '<span class="pill bad">Missed</span>') : '<span></span>') + '</div>').join('') +
      '<div class="score-row"><div class="row"><span class="pdot" style="--c:var(--career)"></span>Gartner, ' + mkLabel(mk) + '</div><div class="faint small">' + meetingsInMonth(mk) + ' / ' + state.career.target + '</div><span></span></div></div>' +
      (t.focus ? '<div class="note mt12"><b>Your focus was:</b> ' + esc(t.focus) + '</div>' : '') +
      (wins.length ? '<div class="note mt12"><b>Wins this week:</b> ' + wins.map(w => esc(w.title)).join(' · ') + '</div>' : '') +
      '<div class="sheet-foot"><button class="btn block" data-act="rv-step" data-d="1">Next</button></div>';
  }
  if (d.step === 2) {
    return head + '<div class="label">2 · Reflect</div>' +
      field('How was the week overall?', quality('rating', d.rating, 'var(--life)')) +
      field('Biggest win', fInput('win', d.win, 'placeholder="What went well?"')) +
      '<div class="toggle"><span>Bank it in the Win Vault</span><button class="switch ' + (d.bankWin ? 'on' : '') + '" data-act="d-flip" data-k="bankWin" aria-label="Bank in vault"></button></div>' +
      field('What got in the way / lesson', fText('lesson', d.lesson, 'Be honest. One or two lines.')) +
      '<div class="sheet-foot btn-row"><button class="btn ghost" data-act="rv-step" data-d="-1">Back</button><button class="btn" data-act="rv-step" data-d="1">Next</button></div>';
  }
  const stepper = (k, label, color) => field(label, '<div class="stepper small" style="--c:' + color + '"><button data-act="d-step" data-k="' + k + '" data-d="-1" data-min="0">−</button><div class="sv">' + d[k] + '</div><button data-act="d-step" data-k="' + k + '" data-d="1" data-max="14">+</button></div>');
  const res = (a, tg) => a + '/' + tg + (a >= tg ? ' ✓' : '');
  return head + '<div class="label">3 · Next week</div>' +
    '<div class="note mt8">That week: gym ' + res(c.gym, t.gym) + ', BJJ ' + res(c.bjj, t.bjj) + '. Set targets you\'ll actually hit; these become next week\'s score.</div>' +
    '<div class="grid2 mt12">' + stepper('gym', 'Gym sessions', 'var(--gym)') + stepper('bjj', 'BJJ sessions', 'var(--bjj)') + '</div>' +
    (state.sales.active ? stepper('closes', 'Closes', 'var(--money)') : '') +
    field('One focus for the week', fInput('focus', d.focus, 'placeholder="e.g. Legs twice, book 3 meetings by Wednesday"')) +
    '<div class="sheet-foot btn-row"><button class="btn ghost" data-act="rv-step" data-d="-1">Back</button><button class="btn brand" data-act="rv-save">Finish review</button></div>';
}
function saveReview() {
  const d = draft;
  const ex = state.reviews[d.key] || {};
  let winId = ex.winId || null;
  const winDate = Math.min(addWeeks(d.ws, 1) - DAY / 2, Date.now());
  if (d.bankWin && d.win.trim()) {
    if (winId && state.wins.find(w => w.id === winId)) Object.assign(state.wins.find(w => w.id === winId), { title: d.win.trim() });
    else { winId = uid('win'); state.wins.push({ id: winId, title: d.win.trim(), pillar: 'life', date: winDate }); }
  } else if (winId) { state.wins = state.wins.filter(w => w.id !== winId); winId = null; }
  state.reviews[d.key] = {
    completedAt: ex.completedAt || Date.now(), editedAt: Date.now(), rating: d.rating, win: d.win.trim(), lesson: d.lesson.trim(), winId,
    next: { gym: d.gym, bjj: d.bjj, closes: state.sales.active ? d.closes : 0, focus: d.focus.trim() },
  };
}

/* ======================= SETTINGS ======================= */
function setRow(label, path, value, opts = {}) {
  const type = opts.type || 'number';
  const input = opts.select
    ? '<select class="select" data-set="' + path + '" data-type="' + (opts.kind || 'str') + '">' + opts.select.map(([v, l]) => '<option value="' + v + '"' + (String(v) === String(value) ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>'
    : '<input class="input" type="' + type + '" ' + (type === 'number' ? 'inputmode="decimal" step="any"' : '') + ' data-set="' + path + '" data-type="' + (opts.kind || (type === 'number' ? 'num' : 'str')) + '" value="' + esc(value == null ? '' : value) + '"' + (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '') + '>';
  return '<div class="set-row"><div>' + label + (opts.hint ? '<span class="hint">' + opts.hint + '</span>' : '') + '</div>' + input + '</div>';
}
function setGroup(title, rows) { return '<div class="set-group"><h3>' + title + '</h3><div class="set-card">' + rows.join('') + '</div></div>'; }
function settingsSheet() {
  const S = state, G = S.career.gartner, M = S.money, B = S.bjj;
  const quarters = []; for (let i = -4; i <= 4; i++) { const k = addQuarters(quarterOf().key, i); quarters.push([k, quarterBounds(k).label]); }
  const bs = backupStatus();
  return sheetHead('Settings') +
    setGroup('Data', [
      '<div class="set-row"><div>Back up<span class="hint">' + (bs.last ? 'Last ' + fmtDay(bs.last) : 'Never backed up') + '</span></div><button class="btn sm" data-act="backup">Back up now</button></div>',
      '<div class="set-row"><div>Restore a backup<span class="hint">Zoh OS v2, v3 or v4 file. Replaces what\'s here.</span></div><button class="btn sm ghost" data-act="restore">Restore</button></div>',
      '<div class="set-row"><div>Mat Log<span class="hint">' + (B.matlog ? 'Linked · ' + B.matlog.sessions.length + ' sessions · ' + fmtDay(B.matlog.importedAt) : 'Not linked') + '</span></div><button class="btn sm ghost" data-act="link-matlog">' + (B.matlog ? 'Update' : 'Link') + '</button></div>',
      setRow('Backup reminder', 'settings.backupEveryDays', S.settings.backupEveryDays, { hint: 'days between nudges' }),
    ]) +
    setGroup('Targets', [
      setRow('Gym sessions / week', 'gym.target', S.gym.target, { hint: 'default when a review hasn\'t set one' }),
      setRow('BJJ sessions / week', 'bjj.perWeek', B.perWeek),
      setRow('Gartner meetings / month', 'career.target', S.career.target),
      setRow('Monthly income target', 'money.target', M.target, { hint: '£, the milestone you\'re chasing' }),
      setRow('Target date', 'money.targetDate', M.targetDate || '', { type: 'month', kind: 'mk', hint: 'optional; leave empty for none' }),
    ]) +
    setGroup('Gartner bonus', [
      setRow('Level', 'career.gartner.level', G.level),
      setRow('Level 1 on-target bonus', 'career.gartner.l1Bonus', G.l1Bonus, { hint: '£ per quarter at 100%' }),
      setRow('Promotion uplift', 'career.gartner.uplift', G.uplift, { hint: '% on top of level 1' }),
      setRow('Promoted from', 'career.gartner.promotedFrom', G.promotedFrom, { select: quarters, hint: 'earlier quarters use level 1' }),
      setRow('Take-home', 'career.gartner.takeHome', G.takeHome, { hint: '% kept after tax & NI (basic rate ≈ 72)' }),
      '<div class="set-row"><div class="small muted">On-target now: <b>' + gbp2(onTargetBonus(quarterOf().key)) + '</b> a quarter · max ' + gbp2(onTargetBonus(quarterOf().key) * 1.5) + '</div></div>',
    ]) +
    setGroup('BJJ', [
      setRow('Sessions before tracking', 'bjj.priorSessions', B.priorSessions),
      setRow('Typical session length', 'bjj.sessionMinutes', B.sessionMinutes, { hint: 'minutes' }),
      setRow('Mat hours for blue', 'bjj.hoursTarget', B.hoursTarget, { hint: 'Mat Log uses 225' }),
      setRow('Ramp-up target', 'bjj.rampTo', B.rampTo, { hint: 'sessions/week for the faster projection' }),
      setRow('Competition date', 'bjj.compDate', B.compDate || '', { type: 'date', kind: 'str' }),
    ]) +
    setGroup('Money & sales', [
      setRow('Gartner base / month', 'money.baseMonthly', M.baseMonthly, { hint: '£, used for projections' }),
      '<div class="toggle set-row"><div>Sales active<span class="hint">Off hides sales from targets and scores</span></div><button class="switch ' + (S.sales.active ? 'on' : '') + '" data-act="toggle-sales"></button></div>',
      setRow('USD → GBP', 'money.usdToGbp', M.usdToGbp),
      setRow('Setter rate', 'money.lanes.setter.rate', M.lanes.setter.rate, { hint: '%' }),
      setRow('Setter avg deal', 'money.lanes.setter.avgDeal', M.lanes.setter.avgDeal, { hint: '$ cash collected' }),
      setRow('Closer rate', 'money.lanes.closer.rate', M.lanes.closer.rate, { hint: '%' }),
      setRow('Closer avg deal', 'money.lanes.closer.avgDeal', M.lanes.closer.avgDeal, { hint: '$ cash collected' }),
      setRow('Income milestones', 'money.milestonesIncome', M.milestonesIncome.map(m => m.amount).join(', '), { type: 'text', kind: 'list', hint: '£, comma separated' }),
    ]) +
    setGroup('Appearance', [setRow('Theme', 'settings.theme', S.settings.theme, { select: [['dark', 'Dark'], ['light', 'Light'], ['auto', 'Match iPhone']] })]) +
    '<button class="btn block danger" data-act="reset">Reset all data</button>' +
    '<div class="note small faint mt12" style="text-align:center">Zoh OS 4 · data stays on this device</div>';
}
function applySetting(path, raw, type) {
  let v = raw;
  if (type === 'num') { v = Number(raw); if (!isFinite(v)) return; }
  if (type === 'mk') v = raw || null;
  if (type === 'list') v = raw.split(/[,\s]+/).map(Number).filter(n => n > 0).sort((a, b) => a - b).map(amount => ({ amount }));
  if (path === 'bjj.compDate' && !raw) v = null;
  const keys = path.split('.');
  let o = state;
  keys.slice(0, -1).forEach(k => { o = o[k]; });
  o[keys[keys.length - 1]] = v;
}
