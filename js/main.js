/* =========================================================
   Zoh OS: actions, input binding, startup
   ========================================================= */

function render() {
  clearCaches();
  applyTheme();
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + ui.tab));
  document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === ui.tab));
  ({ today: renderToday, train: renderTrain, money: renderMoney, goals: renderGoals, review: renderReview })[ui.tab]();
  document.getElementById('backupDot').hidden = !backupStatus().overdue || isEmptyState();
  rememberUi();
}
function goTo(tab, sub) {
  ui.tab = tab;
  if (sub && tab === 'train') ui.train = sub;
  if (sub && tab === 'money') ui.money = sub;
  if (tab === 'review') ui.reviewAnchor = defaultReviewAnchor();
  closeSheet();
  render();
  window.scrollTo(0, 0);
}
function applyTheme() {
  const t = state.settings.theme || 'dark';
  const dark = t === 'dark' || (t === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = dark ? '#08090c' : '#f2f3f6';
}
function rememberUi() {
  try { localStorage.setItem('zoh-os-ui', JSON.stringify({ tab: ui.tab, train: ui.train, money: ui.money, reviewKind: ui.reviewKind })); } catch (_) {}
}
function restoreUi() {
  try { Object.assign(ui, JSON.parse(localStorage.getItem('zoh-os-ui') || '{}')); } catch (_) {}
  ui.reviewAnchor = defaultReviewAnchor();
}
// Early in the week the current week is nearly empty, so open on last week.
function defaultReviewAnchor(kind = ui.reviewKind) {
  const dow = new Date().getDay() || 7;
  return kind === 'week' && dow <= 2 ? addWeeks(weekStartTs(), -1) : Date.now();
}

/* ---------- actions ---------- */
function commit(label, mutate) { withUndo(label, mutate); }
const ACTIONS = {
  'tab': el => goTo(el.dataset.tab),
  'seg': el => {
    const k = el.dataset.seg, v = el.dataset.val;
    if (k === 'train') ui.train = v;
    if (k === 'money') ui.money = v;
    if (k === 'review') { ui.reviewKind = v; ui.reviewAnchor = defaultReviewAnchor(v); }
    if (k === 'wins') ui.winFilter = v;
    render();
  },
  'expand': el => { ui.expand[el.dataset.key] = !ui.expand[el.dataset.key]; render(); },
  'period': el => {
    const next = shiftAnchor(ui.reviewKind, ui.reviewAnchor, Number(el.dataset.dir));
    if (next > Date.now() && periodRange(ui.reviewKind, next).start > Date.now()) return;
    ui.reviewAnchor = Math.min(next, Date.now()); render();
  },
  'goto-month': el => { ui.reviewAnchor = monthBounds(el.dataset.mk).start + DAY; render(); window.scrollTo(0, 0); },
  'log-menu': () => openDraft({ kind: 'menu' }),
  'settings': () => openDraft({ kind: 'settings' }),
  'sheet-close': () => closeSheet(),

  /* quick logging */
  'quick-gym': el => {
    const m = gymTemplates()[Number(el.dataset.i)];
    closeSheet();
    commit('Gym logged · ' + m.map(cap).join(' + '), () => state.gym.sessions.push({ id: uid('gym'), date: Date.now(), muscles: m.slice(), notes: '', quality: null }));
  },
  'quick-meeting': () => {
    closeSheet();
    commit('Meeting added · ' + (meetingsInMonth(monthKey(Date.now())) + 1) + ' this month', () => state.career.meetings.push({ id: uid('mtg'), date: Date.now(), notes: '' }));
  },
  'remove-meeting': () => {
    const mk = draft.month;
    const list = state.career.meetings.filter(m => monthKey(m.date) === mk).sort((a, b) => b.date - a.date);
    if (!list.length) return;
    const id = list[0].id;
    commit('Removed one meeting from ' + mkLabel(mk), () => { state.career.meetings = state.career.meetings.filter(m => m.id !== id); });
    rerenderSheet();
  },
  'edit': el => {
    const rec = findRec(el.dataset.kind, el.dataset.id);
    if (rec) openDraft(newDraft(el.dataset.kind, rec));
  },
  'review': el => {
    const due = reviewDue();
    const ws = el && el.dataset.ws ? Number(el.dataset.ws) : (due ? due.ws : weekStartTs());
    openDraft(reviewDraft(ws));
  },
  'physique': () => goTo('train', 'gym'),
  'portfolio': () => openDraft(newDraft('portfolio')),
  'add-inst': () => openDraft(newDraft('inst')),
  'add-legacy': () => openDraft(newDraft('legacy')),

  /* draft editing */
  'd-set': el => { draft[el.dataset.k] = el.dataset.num ? Number(el.dataset.v) : el.dataset.v; if (draft.kind === 'income' && el.dataset.k === 'month') Object.assign(draft, incomeDraft(draft.month)); rerenderSheet(); },
  'd-toggle': el => { const a = draft[el.dataset.k], i = a.indexOf(el.dataset.v); if (i >= 0) a.splice(i, 1); else a.push(el.dataset.v); rerenderSheet(); },
  'd-step': el => {
    const k = el.dataset.k, min = el.dataset.min != null ? Number(el.dataset.min) : 0, max = el.dataset.max != null ? Number(el.dataset.max) : 99;
    draft[k] = Math.min(max, Math.max(min, (Number(draft[k]) || 0) + Number(el.dataset.d)));
    rerenderSheet();
  },
  'd-flip': el => { draft[el.dataset.k] = !draft[el.dataset.k]; if (draft.kind === 'income' && el.dataset.k === 'split' && !draft.split) draft.total = sum(Object.values(draft.sources), v => Number(v) || 0) || draft.total; rerenderSheet(); },
  'd-tpl': el => { draft.muscles = gymTemplates()[Number(el.dataset.i)].slice(); rerenderSheet(); },
  'd-role': el => { draft.role = el.dataset.v; draft.rate = defaultRate(el.dataset.v); rerenderSheet(); },
  'd-save': () => {
    const before = JSON.stringify(state);
    const label = saveDraft();
    if (!label) return;
    saveState(); closeSheet(); render();
    toast(label, { undo: () => { state = JSON.parse(before); saveState(); render(); toast('Undone'); } });
  },
  'd-delete': () => {
    const d = draft, list = listFor(d.kind);
    if (!list) return;
    closeSheet();
    commit('Deleted', () => {
      const i = list.findIndex(x => x.id === d.id);
      if (i >= 0) list.splice(i, 1);
      if (d.kind === 'income') state.money.incomes = state.money.incomes.filter(x => x.id !== d.id);
    });
  },
  'rv-step': el => { draft.step = Math.max(1, Math.min(3, draft.step + Number(el.dataset.d))); rerenderSheet(); document.getElementById('sheet').scrollTop = 0; },
  'rv-save': () => {
    const before = JSON.stringify(state);
    saveReview(); saveState(); closeSheet(); render();
    toast('Review saved · targets set', { undo: () => { state = JSON.parse(before); saveState(); render(); toast('Undone'); } });
  },

  /* inline actions */
  'rate-physique': el => {
    const v = Number(el.dataset.v), wk = weekKey();
    commit('Physique rated ' + v + '/10', () => {
      state.physique.ratings = state.physique.ratings.filter(r => r.week !== wk);
      state.physique.ratings.push({ week: wk, value: v, date: Date.now() });
    });
  },
  'resolve-injury': el => commit('Injury cleared', () => { const i = state.injuries.find(x => x.id === el.dataset.id); if (i) i.resolved = Date.now(); }),
  'toggle-inst': el => commit('Updated', () => { const i = state.bjj.instructionals.find(x => x.id === el.dataset.id); if (i) { i.done = !i.done; i.completed = i.done ? Date.now() : null; } }),
  'delete-inst': el => commit('Removed', () => { state.bjj.instructionals = state.bjj.instructionals.filter(x => x.id !== el.dataset.id); }),
  'toggle-legacy': el => commit('Updated', () => { const l = state.legacy.items.find(x => String(x.id) === el.dataset.id); if (l) { l.done = !l.done; l.hitDate = l.done ? Date.now() : null; } }),
  'delete-legacy': el => commit('Removed', () => { state.legacy.items = state.legacy.items.filter(x => String(x.id) !== el.dataset.id); }),
  'toggle-sales': () => { state.sales.active = !state.sales.active; saveState(); render(); rerenderSheet(); },

  /* data */
  'backup': () => exportData(),
  'restore': () => pickFile(handleRestore),
  'link-matlog': () => pickFile(handleMatlog),
  'reset': () => {
    if (!confirm('Erase everything in Zoh OS on this device? Back up first if unsure.')) return;
    try { localStorage.setItem(STORAGE_KEY + '_before_reset_' + Date.now(), JSON.stringify(state)); } catch (_) {}
    state = defaultState(); saveState(); closeSheet(); render(); toast('Reset. A copy was kept on this device.');
  },
  'undo': () => runUndo(),
};

function act(name, el) {
  if (name.startsWith('log:')) {
    const kind = name.slice(4);
    if (kind === 'menu') return openDraft({ kind: 'menu' });
    return openDraft(newDraft(kind));
  }
  if (name.startsWith('goto:')) { const [, tab, sub] = name.split(':'); return goTo(tab, sub); }
  const f = ACTIONS[name];
  if (f) f(el);
}

/* ---------- backup / restore ---------- */
async function exportData() {
  const name = 'zoh-os-backup-v4-' + todayIso() + '.json';
  const json = backupJSON();
  const markDone = () => { state.settings.lastBackupAt = Date.now(); saveState(); render(); if (draft && draft.kind === 'settings') rerenderSheet(); toast('Backed up'); };
  try {
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Zoh OS backup' });
      markDone();
      return;
    }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  markDone();
}
function pickFile(onData) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json,application/json';
  input.onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      let parsed;
      try { parsed = JSON.parse(ev.target.result); } catch (_) { toast('That file isn\'t a valid backup'); return; }
      onData(parsed);
    };
    reader.readAsText(f);
  };
  input.click();
}
function handleRestore(data) {
  const c = classifyBackup(data);
  if (c.kind === 'matlog') return handleMatlog(data);
  if (c.kind !== 'zoh') { toast('That file isn\'t a Zoh OS backup'); return; }
  const next = migrate(data);
  const msg = 'Restore this backup? ' + next.gym.sessions.length + ' gym, ' + next.bjj.sessions.length + ' BJJ, ' + next.career.meetings.length + ' meetings, ' + next.sales.closes.length + ' closes, ' + next.money.incomes.length + ' income months. It replaces what\'s on this device (a copy is kept).';
  if (!isEmptyState() && !confirm(msg)) return;
  try { localStorage.setItem(STORAGE_KEY + '_before_restore', JSON.stringify(state)); } catch (_) {}
  const keepTheme = state.settings.theme;
  state = next;
  if (!data.settings) state.settings.theme = keepTheme;
  saveState(); closeSheet(); render();
  toast('Restored · ' + next.gym.sessions.length + ' gym, ' + next.career.meetings.length + ' meetings');
}
function handleMatlog(data) {
  if (classifyBackup(data).kind !== 'matlog') { toast('That isn\'t a Mat Log backup'); return; }
  state.bjj.matlog = matlogSnapshot(data, 'backup');
  saveState(); render(); if (draft && draft.kind === 'settings') rerenderSheet();
  toast('Mat Log linked · ' + state.bjj.matlog.sessions.length + ' sessions');
}

/* ---------- events ---------- */
function bind() {
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (el) { e.preventDefault(); act(el.dataset.act, el); return; }
    const tipEl = e.target.closest('[data-tip]');
    if (tipEl && tipEl.getAttribute('data-tip')) { showTip(tipEl, e.clientX, e.clientY); return; }
    hideTip();
  });
  document.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse') return;
    const tipEl = e.target.closest('[data-tip]');
    if (tipEl && tipEl.getAttribute('data-tip')) { const r = tipEl.getBoundingClientRect(); showTip(tipEl, r.left + r.width / 2, r.top + 10); } else hideTip();
  });
  document.getElementById('sheetBg').addEventListener('click', e => { if (e.target.id === 'sheetBg') closeSheet(); });
  const sheet = document.getElementById('sheet');
  const onInput = e => {
    const t = e.target;
    if (t.dataset.f && draft) {
      const path = t.dataset.f.split('.');
      if (path.length === 2) draft[path[0]][path[1]] = t.value; else draft[path[0]] = t.value;
      if (t.dataset.rerender === 'income-month') { Object.assign(draft, incomeDraft(t.value)); rerenderSheet(); return; }
      liveUpdate();
    }
    if (t.dataset.set && e.type === 'change') {
      applySetting(t.dataset.set, t.value, t.dataset.type);
      saveState(); render();
      if (t.dataset.set === 'career.gartner.l1Bonus' || t.dataset.set === 'career.gartner.uplift' || t.dataset.set === 'career.gartner.promotedFrom') rerenderSheet();
    }
  };
  sheet.addEventListener('input', onInput);
  sheet.addEventListener('change', onInput);
  window.addEventListener('scroll', () => { hideTip(); document.getElementById('header').classList.toggle('scrolled', window.scrollY > 4); }, { passive: true });
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { if (refreshMatlogFromLocal()) saveState(); render(); } });
}
// Update computed text in a sheet without re-rendering (keeps the keyboard open).
function liveUpdate() {
  const d = draft, sheet = document.getElementById('sheet');
  if (d.kind === 'income') {
    const total = d.split ? sum(Object.values(d.sources), v => Number(v) || 0) : Number(d.total) || 0;
    const el = sheet.querySelector('[data-live="total"]'); if (el) el.textContent = gbp(total, true);
  }
  if (d.kind === 'close') {
    const earn = (Number(d.cash) || 0) * (Number(d.rate) || 0) / 100;
    const el = sheet.querySelector('[data-live="earn"]'); if (el) el.innerHTML = 'Earns <b>' + usd(earn, true) + '</b> ≈ ' + gbp(usdToGbp(earn), true);
  }
}

/* ---------- start ---------- */
function init() {
  restoreUi();
  if (refreshMatlogFromLocal()) saveState();
  // write the migrated shape back once, so the upgrade is stored
  if (!isEmptyState()) saveState();
  bind();
  render();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
init();
