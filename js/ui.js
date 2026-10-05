/* =========================================================
   Zoh OS: formatting, icons, toast/undo, sheets and charts
   ========================================================= */

function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
const esc = escapeHtml;
function compact(n) {
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (a >= 1e4) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  return Math.round(n).toLocaleString('en-GB');
}
function gbp(n, full) { return (n < 0 ? '-' : '') + '£' + (full ? Math.round(Math.abs(n)).toLocaleString('en-GB') : compact(Math.abs(n))); }
function gbp2(n) { return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function usd(n, full) { return (n < 0 ? '-' : '') + '$' + (full ? Math.round(Math.abs(n)).toLocaleString('en-GB') : compact(Math.abs(n))); }
function fmtDay(ts) {
  const d = new Date(ts), now = new Date();
  if (sameDay(d, now)) return 'Today';
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (sameDay(d, y)) return 'Yesterday';
  const diff = (now - d) / DAY;
  if (diff < 6 && diff > 0) return d.toLocaleDateString('en-GB', { weekday: 'long' });
  return d.getDate() + ' ' + MONTHS[d.getMonth()] + (d.getFullYear() !== now.getFullYear() ? ' ' + d.getFullYear() : '');
}
function fmtDate(ts) { const d = new Date(ts); return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
function fmtMonthYear(ts) { const d = new Date(ts); return MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }

/* ---------- icons ---------- */
const ICONS = {
  gym: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
  bjj: '<path d="M4 15h16"/><path d="M9 15l-2 5M15 15l2 5"/><path d="M5 15c0-5 3-10 7-10s7 5 7 10"/>',
  career: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7M3 12.5h18"/>',
  money: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  sales: '<circle cx="12" cy="12" r="9"/><path d="M14.8 8.6A3 3 0 0 0 12 7.2c-1.7 0-2.8 1-2.8 2.3 0 3.2 5.8 1.6 5.8 4.8 0 1.4-1.2 2.5-3 2.5a3.3 3.3 0 0 1-3-1.6M12 5.5v1.7m0 9.6v1.7"/>',
  income: '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h3"/>',
  win: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a2 2 0 0 0 2 4h1M16 6h3a2 2 0 0 1-2 4h-1M12 13v4M8.5 20h7"/>',
  life: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a2 2 0 0 0 2 4h1M16 6h3a2 2 0 0 1-2 4h-1M12 13v4M8.5 20h7"/>',
  injury: '<path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z"/><path d="M12 10v4M10 12h4"/>',
  pb: '<path d="M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.4 6.8 19.2l1-5.9L3.5 9.2l5.9-.8z"/>',
  review: '<path d="M4 19V10M10 19V5M16 19v-6M22 19H2"/>',
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  train: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
  goals: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.5v.01"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  cloud: '<path d="M7 18a4 4 0 0 1-.6-8A5.5 5.5 0 0 1 17 8.5a4.5 4.5 0 0 1 .5 9.5z"/><path d="M12 11v6M9.5 14.5L12 17l2.5-2.5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
};
function icon(name, cls = '') { return '<svg viewBox="0 0 24 24" class="' + cls + '" aria-hidden="true">' + (ICONS[name] || '') + '</svg>'; }
const PILLAR_META = {
  gym: { name: 'Gym', color: 'var(--gym)', icon: 'gym' },
  bjj: { name: 'BJJ', color: 'var(--bjj)', icon: 'bjj' },
  career: { name: 'Gartner', color: 'var(--career)', icon: 'career' },
  money: { name: 'Money', color: 'var(--money)', icon: 'money' },
  sales: { name: 'Sales', color: 'var(--money)', icon: 'sales' },
  review: { name: 'Review', color: 'var(--text)', icon: 'review' },
  life: { name: 'Life', color: 'var(--life)', icon: 'win' },
};
function pm(p) { return PILLAR_META[p] || PILLAR_META.life; }
function liIcon(p, name) { return '<div class="li-icon" style="--c:' + pm(p).color + '">' + icon(name || pm(p).icon) + '</div>'; }

/* ---------- toast with undo ---------- */
let toastTimer = null, undoFn = null;
function toast(msg, opts = {}) {
  const t = document.getElementById('toast');
  t.querySelector('.msg').textContent = msg;
  undoFn = opts.undo || null;
  t.classList.toggle('has-action', !!undoFn);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove('show'); undoFn = null; }, undoFn ? 6000 : 2200);
}
function runUndo() {
  if (!undoFn) return;
  const f = undoFn; undoFn = null;
  f();
  document.getElementById('toast').classList.remove('show');
}
// Snapshot the whole state; restoring it is the undo.
function withUndo(label, mutate) {
  const before = JSON.stringify(state);
  mutate();
  saveState();
  render();
  toast(label, { undo: () => { state = JSON.parse(before); saveState(); render(); toast('Undone'); } });
}

/* ---------- sheet ---------- */
let sheetOnClose = null;
function openSheet(html, onClose) {
  const bg = document.getElementById('sheetBg');
  document.getElementById('sheet').innerHTML = '<div class="grabber"></div>' + html;
  bg.classList.add('open');
  document.body.style.overflow = 'hidden';
  sheetOnClose = onClose || null;
  document.getElementById('sheet').scrollTop = 0;
}
function closeSheet() {
  document.getElementById('sheetBg').classList.remove('open');
  document.body.style.overflow = '';
  if (sheetOnClose) { const f = sheetOnClose; sheetOnClose = null; f(); }
}
function sheetHead(title, back) {
  return (back ? '<button class="back" data-act="' + back + '">' + '‹ Back</button>' : '') +
    '<div class="sheet-head"><div class="sheet-title">' + esc(title) + '</div>' +
    '<button class="sheet-close" data-act="sheet-close" aria-label="Close">' + icon('close') + '</button></div>';
}

/* ---------- tooltip (tap or hover on chart marks) ---------- */
function showTip(el, x, y) {
  const tip = document.getElementById('tip');
  tip.innerHTML = el.getAttribute('data-tip');
  tip.classList.add('show');
  const r = tip.getBoundingClientRect();
  let left = x - r.width / 2, top = y - r.height - 14;
  left = Math.max(8, Math.min(window.innerWidth - r.width - 8, left));
  if (top < 8) top = y + 18;
  tip.style.left = left + 'px'; tip.style.top = top + 'px';
}
function hideTip() { document.getElementById('tip').classList.remove('show'); }

/* ---------- charts ---------- */
function ring(pct, color, size = 62, stroke = 7) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct));
  return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '">' +
    '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-opacity=".16" stroke-width="' + stroke + '"/>' +
    '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + stroke + '" stroke-linecap="round" ' +
    'stroke-dasharray="' + (c * p).toFixed(2) + ' ' + c.toFixed(2) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/></svg>';
}
function niceMax(v) {
  if (v <= 0) return 1;
  const e = Math.pow(10, Math.floor(Math.log10(v))), f = v / e;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
}
/* Column chart. bars: [{ label, value, color?, tip, highlight? }] */
function columnChart(bars, opts = {}) {
  const W = 340, H = opts.height || 150, padT = 18, padB = 22, padL = opts.axis ? 30 : 4;
  const max = niceMax(Math.max(opts.target || 0, ...bars.map(b => b.value), 1));
  const n = bars.length, slot = (W - padL - 4) / n, bw = Math.min(24, slot * 0.62);
  const ih = H - padT - padB, y = v => padT + ih - (v / max) * ih;
  let s = '';
  if (opts.axis) [0, max / 2, max].forEach(v => {
    s += '<line class="grid" x1="' + padL + '" x2="' + W + '" y1="' + y(v) + '" y2="' + y(v) + '"/>';
    s += '<text class="axis" x="' + (padL - 6) + '" y="' + (y(v) + 3.5) + '" text-anchor="end">' + (opts.fmt ? opts.fmt(v) : compact(v)) + '</text>';
  });
  else s += '<line class="grid" x1="0" x2="' + W + '" y1="' + y(0) + '" y2="' + y(0) + '"/>';
  if (opts.target) s += '<line x1="' + padL + '" x2="' + W + '" y1="' + y(opts.target) + '" y2="' + y(opts.target) + '" stroke="var(--text-2)" stroke-width="1" stroke-dasharray="3 4"/>' +
    '<text class="axis" x="' + W + '" y="' + (y(opts.target) - 5) + '" text-anchor="end">' + esc(opts.targetLabel || '') + '</text>';
  bars.forEach((b, i) => {
    const cx = padL + slot * (i + 0.5), h = Math.max(0, y(0) - y(b.value)), top = y(b.value);
    const col = b.color || opts.color || 'var(--text)';
    if (h > 0) s += '<path d="' + roundTopRect(cx - bw / 2, top, bw, h, Math.min(4, h)) + '" fill="' + col + '"' + (b.dim ? ' fill-opacity=".38"' : '') + '/>';
    if (b.showValue) s += '<text class="val" x="' + cx + '" y="' + (top - 5) + '" text-anchor="middle">' + esc(b.valueLabel != null ? b.valueLabel : compact(b.value)) + '</text>';
    s += '<text class="axis" x="' + cx + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(b.label) + '</text>';
    s += '<rect class="hit" x="' + (cx - slot / 2) + '" y="0" width="' + slot + '" height="' + H + '" data-tip="' + esc(b.tip || '') + '"/>';
  });
  return '<div class="chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.aria || '') + '">' + s + '</svg></div>';
}
function roundTopRect(x, y, w, h, r) {
  return 'M' + x + ',' + (y + h) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h) + 'Z';
}
/* Stacked columns with a 2px surface gap between segments.
   cols: [{ label, segs: [{ key, value }], tip }], series: [{ key, label, color }] */
function stackedChart(cols, series, opts = {}) {
  const W = 340, H = opts.height || 170, padT = 18, padB = 22, padL = 34;
  const totals = cols.map(c => sum(c.segs, s => s.value));
  const max = niceMax(Math.max(opts.target || 0, ...totals, 1));
  const n = cols.length, slot = (W - padL - 4) / n, bw = Math.min(24, slot * 0.62);
  const ih = H - padT - padB, sc = v => (v / max) * ih, base = padT + ih;
  let s = '';
  [0, max / 2, max].forEach(v => {
    s += '<line class="grid" x1="' + padL + '" x2="' + W + '" y1="' + (base - sc(v)) + '" y2="' + (base - sc(v)) + '"/>';
    s += '<text class="axis" x="' + (padL - 6) + '" y="' + (base - sc(v) + 3.5) + '" text-anchor="end">' + (opts.fmt ? opts.fmt(v) : compact(v)) + '</text>';
  });
  if (opts.target) s += '<line x1="' + padL + '" x2="' + W + '" y1="' + (base - sc(opts.target)) + '" y2="' + (base - sc(opts.target)) + '" stroke="var(--text-2)" stroke-dasharray="3 4"/>' +
    '<text class="axis" x="' + W + '" y="' + (base - sc(opts.target) - 5) + '" text-anchor="end">' + esc(opts.targetLabel || '') + '</text>';
  cols.forEach((c, i) => {
    const cx = padL + slot * (i + 0.5);
    let yTop = base;
    const segs = c.segs.filter(sg => sg.value > 0);
    segs.forEach((sg, j) => {
      const h = sc(sg.value), last = j === segs.length - 1;
      const gap = j > 0 ? 2 : 0;
      const y0 = yTop - h, hh = Math.max(0, h - gap);
      const col = (series.find(x => x.key === sg.key) || {}).color || 'var(--text-3)';
      s += last ? '<path d="' + roundTopRect(cx - bw / 2, y0, bw, hh, Math.min(4, hh)) + '" fill="' + col + '"/>'
        : '<rect x="' + (cx - bw / 2) + '" y="' + y0 + '" width="' + bw + '" height="' + hh + '" fill="' + col + '"/>';
      yTop = y0;
    });
    if (c.showValue && totals[i] > 0) s += '<text class="val" x="' + cx + '" y="' + (yTop - 5) + '" text-anchor="middle">' + esc(c.valueLabel || compact(totals[i])) + '</text>';
    s += '<text class="axis" x="' + cx + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(c.label) + '</text>';
    s += '<rect class="hit" x="' + (cx - slot / 2) + '" y="0" width="' + slot + '" height="' + H + '" data-tip="' + esc(c.tip || '') + '"/>';
  });
  const legend = '<div class="legend">' + series.filter(se => cols.some(c => c.segs.some(sg => sg.key === se.key && sg.value > 0)))
    .map(se => '<span><i style="--c:' + se.color + '"></i>' + esc(se.label) + '</span>').join('') + '</div>';
  return '<div class="chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.aria || '') + '">' + s + '</svg></div>' + legend;
}
function tipRows(title, rows) {
  return '<b>' + esc(title) + '</b>' + rows.map(r => '<div class="tr"><span>' + (r.color ? '<i style="--c:' + r.color + '"></i>' : '') + esc(r.label) + '</span><span>' + esc(r.value) + '</span></div>').join('');
}
function bar(pct, color, cls = '') {
  return '<div class="bar ' + cls + '" style="--c:' + color + '"><i style="width:' + (Math.max(0, Math.min(1, pct)) * 100).toFixed(1) + '%"></i></div>';
}
function gradeBadge(g, small) { return '<div class="grade ' + (g ? 'g' + g : '') + (small ? ' sm' : '') + '">' + (g || '–') + '</div>'; }
function deltaHtml(cur, prev, fmt = v => String(v), higherIsGood = true) {
  if (prev == null || cur == null) return '<span class="delta flat">–</span>';
  const d = cur - prev;
  if (Math.abs(d) < 1e-9) return '<span class="delta flat">same</span>';
  const good = (d > 0) === higherIsGood;
  return '<span class="delta ' + (good ? 'up' : 'down') + '">' + (d > 0 ? '▲ ' : '▼ ') + fmt(Math.abs(d)) + '</span>';
}
