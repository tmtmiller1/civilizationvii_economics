// econ-macro-state.js - Economics: the macro envelope (DESIGN 9), saved beside the ledger and the markets: the
// business cycle's state (E and its last 30 turns, each civ's L and phase, last turn's wars and routes, the crisis
// stage, the income and credit series, the Panic turns, the cycle's recent events), each civ's economic system with
// the turn it changed, and the last inflation reading. Its own Configuration key keeps the markets envelope as 1.1
// left it. At most 32 KB; load refuses anything that isn't ours without throwing, and save(load(x)) is a fixed point.

import { CYCLE_K_PCT, CYCLE_RULES } from "./econ-params.js";
import { effectiveL, emptyCycle, phaseOf, spreadPct } from "./econ-cycle.js";
import { blendedTerms, isSystemId, termsOf } from "./econ-systems.js";
import { utf8Bytes } from "./econ-state.js";

export const MACRO_KEY = "tower-economics-macro";
export const MACRO_VERSION = 1;
export const MACRO_MAX_BYTES = 32768;

/**
 * @typedef {import("./econ-cycle.js").CycleState} CycleState
 * @typedef {import("./econ-systems.js").SystemRow} SystemRow
 * @typedef {{ piPpm: number, bondCents: number, moneyCents: number, top: number | null }} InflationRead
 * @typedef {{ lastTurn: number | null, cycle: CycleState, systems: Record<string, SystemRow>,
 *   inflation: InflationRead }} MacroState
 */

/** @returns {InflationRead} */
export function emptyInflation() {
  return { piPpm: 0, bondCents: 0, moneyCents: 0, top: null };
}

/** @returns {MacroState} */
export function emptyMacro() {
  return { lastTurn: null, cycle: emptyCycle(), systems: {}, inflation: emptyInflation() };
}

/** @param {unknown} x */
const isInt = (x) => Number.isInteger(x);
/** @param {unknown} x */
const isRecord = (x) => !!x && typeof x === "object" && !Array.isArray(x);
/** @param {string} key */
const isPidKey = (key) => /^\d{1,3}$/.test(key);
/** @param {unknown} x */
const isPair = (x) => typeof x === "string" && /^\d{1,3}:\d{1,3}$/.test(x);

/**
 * @param {unknown} raw
 * @param {(value: unknown) => boolean} ok
 */
function cleanByPid(raw, ok) {
  /** @type {Record<string, any>} */
  const out = {};
  if (!isRecord(raw)) return out;
  for (const [key, value] of Object.entries(/** @type {object} */ (raw))) {
    if (isPidKey(key) && ok(value)) out[key] = value;
  }
  return out;
}

/**
 * @param {unknown} raw
 * @param {number} keep
 */
const cleanInts = (raw, keep) => (Array.isArray(raw) ? raw.filter(isInt).slice(-keep) : []);

/** @param {unknown} raw */
function cleanEvents(raw) {
  /** @type {import("./econ-cycle.js").CycleEvent[]} */
  const out = [];
  for (const row of Array.isArray(raw) ? raw : []) {
    if (!row || !isInt(row.turn) || typeof row.kind !== "string" || row.kind.length > 32 || !isInt(row.w)) continue;
    const party = (/** @type {unknown} */ x) => (isInt(x) ? /** @type {number} */ (x) : null);
    out.push({ turn: row.turn, kind: row.kind, a: party(row.a), b: party(row.b), w: row.w });
  }
  return out.slice(-CYCLE_RULES.eventsKept);
}

/**
 * @param {unknown} input
 * @returns {CycleState}
 */
export function sanitizeCycle(input) {
  const out = emptyCycle();
  if (!isRecord(input)) return out;
  const raw = /** @type {Record<string, any>} */ (input);
  const inRange = (/** @type {unknown} */ x, /** @type {number} */ lo, /** @type {number} */ hi) => isInt(x)
    && /** @type {number} */ (x) >= lo && /** @type {number} */ (x) <= hi;
  if (inRange(raw.e, CYCLE_RULES.eMin, CYCLE_RULES.eMax)) out.e = raw.e;
  out.l = cleanByPid(raw.l, (v) => inRange(v, -CYCLE_RULES.lMax, CYCLE_RULES.lMax));
  out.history = cleanInts(raw.history, CYCLE_RULES.historyTurns);
  out.wars = Array.isArray(raw.wars) ? [...new Set(raw.wars.filter(isPair))].sort() : [];
  out.routes = Array.isArray(raw.routes) ? [...new Set(raw.routes.filter(isPair))].sort() : [];
  out.crisis = inRange(raw.crisis, -1, 9) ? raw.crisis : -1;
  out.credit = cleanInts(raw.credit, 11);
  out.income = cleanInts(raw.income, 11);
  out.panicUntil = isInt(raw.panicUntil) ? raw.panicUntil : null;
  out.lastPanic = isInt(raw.lastPanic) ? raw.lastPanic : null;
  out.atWar = cleanByPid(raw.atWar, (v) => typeof v === "boolean");
  out.events = cleanEvents(raw.events);
  out.phases = cleanByPid(raw.phases, (v) => typeof v === "string" && /^[a-z]{1,16}$/.test(/** @type {string} */ (v)));
  return out;
}

/** @param {unknown} raw */
function cleanSystems(raw) {
  return cleanByPid(raw, (v) => isRecord(v) && isSystemId(/** @type {any} */ (v).system)
    && isSystemId(/** @type {any} */ (v).from) && isInt(/** @type {any} */ (v).since));
}

/** @param {unknown} raw */
function cleanInflation(raw) {
  const out = emptyInflation();
  if (!isRecord(raw)) return out;
  const value = /** @type {Record<string, unknown>} */ (raw);
  const count = (/** @type {unknown} */ x) => (isInt(x) && /** @type {number} */ (x) >= 0
    ? /** @type {number} */ (x) : 0);
  out.piPpm = count(value.piPpm);
  out.bondCents = count(value.bondCents);
  out.moneyCents = count(value.moneyCents);
  out.top = isInt(value.top) && /** @type {number} */ (value.top) >= 0 ? /** @type {number} */ (value.top) : null;
  return out;
}

/**
 * @param {unknown} input
 * @returns {MacroState}
 */
export function sanitizeMacro(input) {
  const out = emptyMacro();
  if (!isRecord(input)) return out;
  const raw = /** @type {Record<string, unknown>} */ (input);
  out.lastTurn = isInt(raw.lastTurn) ? /** @type {number} */ (raw.lastTurn) : null;
  out.cycle = sanitizeCycle(raw.cycle);
  out.systems = cleanSystems(raw.systems);
  out.inflation = cleanInflation(raw.inflation);
  return out;
}

/** @param {MacroState} macro */
export function cloneMacro(macro) {
  return sanitizeMacro(JSON.parse(JSON.stringify(macro)));
}

/**
 * The envelope text; past 32 KB the cycle's events go first, then the oldest half of E's history.
 * @param {MacroState} macro
 */
export function saveMacro(macro) {
  const clean = sanitizeMacro(macro);
  const text = () => JSON.stringify({ mod: MACRO_KEY, v: MACRO_VERSION, macro: clean });
  let out = text();
  if (utf8Bytes(out) > MACRO_MAX_BYTES) { clean.cycle.events = []; out = text(); }
  while (utf8Bytes(out) > MACRO_MAX_BYTES && clean.cycle.history.length > 1) {
    clean.cycle.history = clean.cycle.history.slice(-Math.floor(clean.cycle.history.length / 2));
    out = text();
  }
  return out;
}

/**
 * Never throws; a refusal returns an empty state.
 * @param {unknown} raw
 * @returns {{ ok: boolean, reason: string, macro: MacroState }}
 */
export function loadMacro(raw) {
  if (raw === null || raw === undefined || raw === "") return { ok: true, reason: "empty", macro: emptyMacro() };
  const body = parseMacro(raw);
  const reason = body === undefined ? "unparseable" : macroRefusal(body);
  if (reason) return { ok: false, reason, macro: emptyMacro() };
  return { ok: true, reason: "loaded", macro: sanitizeMacro(/** @type {Record<string, any>} */ (body).macro) };
}

/**
 * The envelope as an object, or undefined when its text doesn't parse.
 * @param {unknown} raw
 */
function parseMacro(raw) {
  if (typeof raw !== "string") return raw;
  try { return JSON.parse(raw); } catch (_error) { return undefined; }
}

/** @param {unknown} obj */
function macroRefusal(obj) {
  const body = /** @type {Record<string, any> | null} */ (obj);
  if (!body || typeof body !== "object" || body.mod !== MACRO_KEY || !isInt(body.v)) return "foreign";
  return body.v > MACRO_VERSION ? "newer" : null;
}

/**
 * The Business cycle option's k, in percent; an unknown value reads Standard.
 * @param {string | undefined} option
 */
export function cycleKPct(option) {
  return option !== undefined && Object.hasOwn(CYCLE_K_PCT, option) ? CYCLE_K_PCT[option] : CYCLE_K_PCT.standard;
}

/**
 * @typedef {{ index: number, lEff: number, phase: string, spreadPct: number }} CivCycle
 * @typedef {{ terms: Map<number, import("./econ-systems.js").SystemTerms>, e: number, panic: boolean,
 *   civ: Map<number, CivCycle>, piPpm: number, kPct: number }} MacroReadings
 */

/**
 * What the rest of the turn reads from the macro state, without changing it: each civ's blended system terms, E,
 * whether a Panic runs, each civ's E + L (its negative L cut by warehouses and the legacy cushion), phase and bond
 * spread, and inflation's pi. With the cycle Off, or for a Planned civ (outside the world cycle), the index is 1.0,
 * the phase Steady or "outside", and the spread 1.0.
 * @param {MacroState} macro
 * @param {{ civs: Civ[], turn: number, options: Partial<PlanOptions> }} q
 * @returns {MacroReadings}
 */
export function macroReadings(macro, { civs, turn, options }) {
  const kPct = cycleKPct(options.cycle);
  const panic = kPct > 0 && macro.cycle.panicUntil !== null && turn < macro.cycle.panicUntil;
  const e = kPct > 0 ? macro.cycle.e : CYCLE_RULES.one;
  /** @type {Map<number, import("./econ-systems.js").SystemTerms>} */
  const terms = new Map();
  /** @type {Map<number, CivCycle>} */
  const civ = new Map();
  for (const row of civs) {
    const own = options.systems === false ? termsOf("mixed") : blendedTerms(macro.systems[String(row.id)], turn);
    terms.set(row.id, own);
    civ.set(row.id, civReading(row, own, { l: macro.cycle.l[String(row.id)] ?? 0, e, panic, on: kPct > 0 }));
  }
  return { terms, e, panic, civ, piPpm: options.inflation === true ? macro.inflation.piPpm : 0, kPct };
}

/**
 * One civ's E + L, phase and spread.
 * @param {Civ} row
 * @param {import("./econ-systems.js").SystemTerms} own
 * @param {{ l: number, e: number, panic: boolean, on: boolean }} q
 * @returns {CivCycle}
 */
function civReading(row, own, { l, e, panic, on }) {
  if (!on || own.outOfCycle) {
    return { index: CYCLE_RULES.one, lEff: 0, phase: own.outOfCycle ? "outside" : "steady", spreadPct: 100 };
  }
  const lEff = effectiveL(l, { warehouses: row.warehouses ?? 0, multPct: own.warehouseMultPct,
    cushionBp: row.cushionBp ?? 0 });
  const index = e + lEff;
  return { index, lEff, phase: panic ? "panic" : phaseOf(index), spreadPct: spreadPct(index, panic) };
}
