// econ-settings.js - Economics: the player's own preferences, kept across games in the `economics` slice of the
// shared "modSettings" localStorage key (the Tower Settings Keeper owns the key; this reads and writes one slice).
// A read costs a few milliseconds, so the slice is read once and cached. Game state (the ledger, the guard switch)
// never lives here: it belongs to the save (econ-session.js).

const ROOT_KEY = "modSettings";
const SLICE = "economics";
/** @type {Record<string, string | number | boolean>} */
export const DEFAULTS = Object.freeze({ lastTab: "treasury", dockButton: true });

/** @type {Record<string, string | number | boolean> | null} */
let memory = null;
/** @type {Record<string, string | number | boolean>} */
let changed = {};

/**
 * @template T
 * @param {() => T} fn
 * @param {T} fallback
 */
function safe(fn, fallback) {
  try { return fn(); } catch (_error) { return fallback; }
}

/** @returns {{ root: Record<string, any> | null, ok: boolean }} */
function readRoot() {
  const raw = safe(() => localStorage.getItem(ROOT_KEY), /** @type {string | null | undefined} */ (undefined));
  if (raw === undefined) return { root: null, ok: false };
  if (!raw) return { root: {}, ok: true };
  const root = safe(() => JSON.parse(raw), null);
  const shaped = !!root && typeof root === "object" && !Array.isArray(root);
  return shaped ? { root, ok: true } : { root: null, ok: false };
}

/** The cached settings, defaults laid under what is stored and what changed this session. */
export function settings() {
  if (memory) return memory;
  const { root } = readRoot();
  const slice = root && root[SLICE];
  const merged = { ...DEFAULTS, ...(slice && typeof slice === "object" ? slice : {}), ...changed };
  memory = merged;
  return merged;
}

function persist() {
  const { root, ok } = readRoot();
  if (!ok || !root) return false;
  root[SLICE] = { ...(root[SLICE] && typeof root[SLICE] === "object" ? root[SLICE] : {}), ...changed };
  return safe(() => { localStorage.setItem(ROOT_KEY, JSON.stringify(root)); return true; }, false);
}

/**
 * @param {string} key
 * @param {string | number | boolean} value
 */
export function setSetting(key, value) {
  if (!Object.hasOwn(DEFAULTS, key)) return false;
  settings()[key] = value;
  changed[key] = value;
  return persist();
}

/** @param {string} key */
export function getSetting(key) {
  const value = settings()[key];
  return value === undefined ? DEFAULTS[key] : value;
}

/** Test hook: forget the cache. */
export function resetSettingsForTests() {
  memory = null;
  changed = {};
}
