// Loads the app's plain scripts into a sandbox with a fake localStorage.
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export const SCRIPTS = ['js/store.js', 'js/belt.js', 'js/model.js'];

export function loadApp(initialStorage = {}, now) {
  const store = { ...initialStorage };
  const ctx = {
    console,
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
    },
  };
  vm.createContext(ctx);
  if (now) {
    vm.runInContext(`(() => { const R = Date, T = ${now};
      globalThis.Date = class extends R { constructor(...a) { if (a.length) super(...a); else super(T); } static now() { return T; } };
    })();`, ctx);
  }
  for (const f of SCRIPTS) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  // JSON round-trip so results are plain objects from this realm (deepStrictEqual-friendly)
  const run = code => { const v = vm.runInContext(code, ctx); return v === undefined ? v : JSON.parse(JSON.stringify(v)); };
  return { ctx, store, run };
}
