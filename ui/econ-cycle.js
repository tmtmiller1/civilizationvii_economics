// econ-cycle.js - Economics: the business cycle (DESIGN 4.11), as plain data. No randomness: the turn's events move
// the world index E and each civ's own L, and both drift back between them. E and L are in basis points (10000 is
// 1.0). The glue passes what only the engine sees (captures, razes, disasters, the crisis stage); wars, peace and
// routes are read here from the relations and routes the plan already gets, against last turn's; defaults and
// repudiations come from the ledger's own events. Nothing pushes the index every turn by itself: income counts only
// against its own trend, and a long Boom pulls itself down (overheating), so a growing world still turns over. The
// cycle is the mod's own state (level 3): only these rules act on it, and they act on every civ alike, felt through
// cycle Gold and the bond spread. Nothing here reads the engine.

import { CYCLE_RULES as R, CYCLE_WEIGHTS as W } from "./econ-params.js";

/**
 * @typedef {{ turn: number, kind: string, a: number | null, b: number | null, w: number }} CycleEvent
 * @typedef {{ e: number, l: Record<string, number>, history: number[], wars: string[], routes: string[],
 *   crisis: number, credit: number[], income: number[], trend: number | null, boomTurns: number,
 *   panicUntil: number | null, lastPanic: number | null, atWar: Record<string, boolean>, events: CycleEvent[],
 *   phases: Record<string, string> }} CycleState
 * @typedef {{ kind: string, a: number | null, b: number | null, w: number, world: boolean }} Weighted
 */

/** @returns {CycleState} */
export function emptyCycle() {
  return { e: R.one, l: {}, history: [], wars: [], routes: [], crisis: -1, credit: [], income: [], trend: null,
    boomTurns: 0, panicUntil: null, lastPanic: null, atWar: {}, events: [], phases: {} };
}

/**
 * @param {number} value
 * @param {number} low
 * @param {number} high
 */
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

/**
 * The phase for an index: Depression below 0.8, Slump to 0.95, Steady to 1.05, Boom above.
 * @param {number} index
 */
export function phaseOf(index) {
  if (index < R.depression) return "depression";
  if (index < R.slump) return "slump";
  return index > R.boom ? "boom" : "steady";
}

/**
 * The world stage scale s (DESIGN 4.15): 0.25 before Public debt, 0.6 from it, 1.0 from Capitalism, in percent.
 * @param {{ publicDebt: boolean, capitalism: boolean }} world
 */
export function stageScalePct({ publicDebt, capitalism }) {
  if (capitalism) return R.scaleCapitalismPct;
  return publicDebt ? R.scalePublicDebtPct : R.scaleEarlyPct;
}

/** @param {number} a @param {number} b */
export const pairKey = (a, b) => (a < b ? `${a}:${b}` : `${b}:${a}`);

/** @param {string} key */
const pairOf = (key) => key.split(":").map(Number);

/**
 * Wars between civs this turn against last turn's: declared, ended (peace) and ongoing, as weighted events.
 * @param {string[]} before
 * @param {string[]} now
 * @returns {Weighted[]}
 */
export function warEvents(before, now) {
  const was = new Set(before);
  const is = new Set(now);
  /** @type {Weighted[]} */
  const out = [];
  for (const key of now) {
    const [a, b] = pairOf(key);
    out.push(was.has(key) ? { kind: "war-ongoing", a, b, w: W.warOngoing, world: true }
      : { kind: "war-declared", a, b, w: W.warDeclared, world: true });
  }
  for (const key of before) {
    if (is.has(key)) continue;
    const [a, b] = pairOf(key);
    out.push({ kind: "peace", a, b, w: W.peace, world: true });
  }
  return out;
}

/**
 * Routes between civs this turn against last turn's: new and ended. A route that stands weighs nothing, so a world
 * with many routes doesn't lean to Boom.
 * @param {string[]} before
 * @param {string[]} now
 * @returns {Weighted[]}
 */
export function routeEvents(before, now) {
  const was = new Set(before);
  const is = new Set(now);
  /** @type {Weighted[]} */
  const out = [];
  for (const key of now) {
    if (was.has(key)) continue;
    const [a, b] = pairOf(key);
    out.push({ kind: "route-new", a, b, w: W.routeNew, world: true });
  }
  for (const key of before) {
    if (is.has(key)) continue;
    const [a, b] = pairOf(key);
    out.push({ kind: "route-ended", a, b, w: W.routeEnded, world: true });
  }
  return out;
}

/**
 * The glue's events: a capture weighs on the civ that lost the settlement, a raze on its owner, a disaster on the
 * civ whose land was hit, double with population lost, half in a city with a food warehouse.
 * @param {{ kind: string, pid: number, populationLost?: boolean, foodWarehouse?: boolean }[]} events
 * @returns {Weighted[]}
 */
export function engineEvents(events) {
  /** @type {Weighted[]} */
  const out = [];
  for (const row of events || []) {
    if (!row || !Number.isInteger(row.pid)) continue;
    if (row.kind === "capture") out.push({ kind: "capture", a: row.pid, b: null, w: W.capture, world: true });
    if (row.kind === "raze") out.push({ kind: "raze", a: row.pid, b: null, w: W.raze, world: true });
    if (row.kind !== "disaster") continue;
    const full = row.populationLost === true ? W.disasterPopulation : W.disaster;
    out.push({ kind: "disaster", a: row.pid, b: null, w: row.foodWarehouse === true ? Math.trunc(full / 2) : full,
      world: true });
  }
  return out;
}

/**
 * The age crisis: -0.02 the turn a stage starts from none, then -0.005 a turn while one runs (stages 0 to 2).
 * @param {number} before
 * @param {number} now
 * @returns {Weighted[]}
 */
export function crisisEvents(before, now) {
  const active = (/** @type {number} */ stage) => stage >= 0 && stage <= 2;
  if (!active(now)) return [];
  const kind = active(before) ? "crisis" : "crisis-start";
  return [{ kind, a: null, b: null, w: active(before) ? W.crisisOngoing : W.crisisStart, world: true }];
}

/**
 * Defaults and repudiations from the ledger's last batch: a default weighs on both its parties, a repudiation on
 * the lender only (the repudiator keeps the Gold).
 * @param {LedgerEvent[]} events
 * @returns {Weighted[]}
 */
export function ledgerEvents(events) {
  /** @type {Weighted[]} */
  const out = [];
  const civ = (/** @type {unknown} */ x) => (Number.isInteger(x) ? /** @type {number} */ (x) : null);
  for (const row of events || []) {
    if (row.kind === "default") {
      out.push({ kind: "default", a: civ(row.borrower), b: civ(row.lender), w: W.default, world: true });
    }
    if (row.kind === "repudiation") {
      out.push({ kind: "repudiation", a: civ(row.lender), b: null, w: W.repudiation, world: true });
    }
  }
  return out;
}

/**
 * Growth over the series (the last value against the first, 10 turns before it) in basis points; null while the
 * series is short or the first value isn't positive.
 * @param {number[]} series
 */
export function growthBp(series) {
  if (series.length <= 10 || !(series[0] > 0)) return null;
  return Math.trunc(((series[series.length - 1] - series[0]) * R.one) / series[0]);
}

/**
 * The income trend: the first growth read sets it, then it moves 4% of the way to each new read (about 50 turns).
 * @param {number | null} trend
 * @param {number | null} growth
 */
export function nextTrendBp(trend, growth) {
  if (growth === null) return trend;
  if (trend === null) return growth;
  return trend + Math.round(((growth - trend) * W.trendPct) / 100);
}

/**
 * World income against its own trend: ±0.005 per 5 points of 10-turn growth above or below the trend, at most ±0.01 a
 * turn, so only growth faster or slower than usual moves the cycle; and credit up more than 10% on 10 turns ago:
 * +0.005. Each series holds the last values, oldest first; a short series, or no trend yet, weighs nothing.
 * @param {number[]} income
 * @param {number[]} credit
 * @param {number | null} trend
 * @returns {Weighted[]}
 */
export function trendEvents(income, credit, trend) {
  /** @type {Weighted[]} */
  const out = [];
  const growth = growthBp(income);
  if (growth !== null && trend !== null) {
    const steps = Math.trunc((growth - trend) / 500);
    const w = clamp(steps * W.incomePer5Pct, -W.incomeCap, W.incomeCap);
    if (w !== 0) out.push({ kind: w > 0 ? "income-up" : "income-down", a: null, b: null, w, world: true });
  }
  const full = credit.length > 10;
  if (full && credit[credit.length - 1] * 100 > credit[0] * (100 + W.creditGrowthPct) && credit[0] > 0) {
    out.push({ kind: "credit-growth", a: null, b: null, w: W.creditGrowth, world: true });
  }
  return out;
}

/**
 * Overheating: each turn the world has spent in Boom so far pulls E down by 0.002 more, up to the cap.
 * @param {number} boomTurns
 * @returns {Weighted[]}
 */
export function overheatEvents(boomTurns) {
  if (!(boomTurns > 0)) return [];
  return [{ kind: "overheating", a: null, b: null, w: Math.max(W.overheatCap, W.overheatPerTurn * boomTurns),
    world: true }];
}

/**
 * Turns in Boom in a row, counted after the index moves; any other phase resets it.
 * @param {number} boomTurns
 * @param {number} index
 */
export function nextBoomTurns(boomTurns, index) {
  return phaseOf(index) === "boom" ? boomTurns + 1 : 0;
}

/**
 * The world's sum for the turn, with the cap on ongoing wars, clamped to ±0.1.
 * @param {Weighted[]} events
 */
export function worldSum(events) {
  let wars = 0;
  let rest = 0;
  for (const row of events) {
    if (!row.world) continue;
    if (row.kind === "war-ongoing") wars += row.w;
    else rest += row.w;
  }
  return clamp(rest + Math.max(W.warOngoingCap, wars), -R.worldClamp, R.worldClamp);
}

/**
 * One civ's sum: the events it took part in (both sides of a war, peace or route, the civ that lost the settlement
 * or whose land was hit, a defaulter and its lender, a repudiated lender), the same caps per civ.
 * @param {Weighted[]} events
 * @param {number} pid
 */
export function civSum(events, pid) {
  return worldSum(events.filter((row) => row.a === pid || row.b === pid).map((row) => ({ ...row, world: true })));
}

/**
 * E_next = E + 0.1 * (1 - E) + k * s * sum, clamped to 0.7 to 1.3.
 * @param {number} e
 * @param {number} sum
 * @param {number} kPct
 * @param {number} scalePct
 */
export function nextE(e, sum, kPct, scalePct) {
  const reverted = e + Math.round(((R.one - e) * R.reversionPct) / 100);
  return clamp(reverted + Math.round((sum * kPct * scalePct) / 10000), R.eMin, R.eMax);
}

/**
 * L_next = decay * L + k * mult * sum, clamped to ±0.2.
 * @param {number} l
 * @param {number} sum
 * @param {{ kPct: number, decayPct: number, multPct: number }} q
 */
export function nextL(l, sum, { kPct, decayPct, multPct }) {
  return clamp(Math.round((l * decayPct) / 100) + Math.round((sum * kPct * multPct) / 10000), -R.lMax, R.lMax);
}

/**
 * A negative L is cut by the Warehouse share (3% each, at most 30%) plus the legacy cushion (at most 10%), together
 * at most 35%. `warehouses` is the civ's weighted count, `multPct` Manorial's 2x, `cushionBp` from econ-legacy.js.
 * @param {number} l
 * @param {{ warehouses: number, multPct: number, cushionBp: number }} q
 */
export function effectiveL(l, { warehouses, multPct, cushionBp }) {
  if (l >= 0) return l;
  const warehouse = Math.min(R.warehouseMaxBp, Math.round((Math.max(0, warehouses) * R.warehouseBp * multPct) / 100));
  const cut = Math.min(R.cutMaxBp, warehouse + Math.min(R.cushionMaxBp, Math.max(0, cushionBp)));
  return Math.round((l * (R.one - cut)) / R.one);
}

/**
 * cycle_spread = 2 - (E + L), + 0.5 during a Panic, in percent of the bond rate.
 * @param {number} index E + L
 * @param {boolean} panic
 */
export function spreadPct(index, panic) {
  return 200 - Math.round(index / 100) + (panic ? R.panicSpreadPct : 0);
}

/**
 * cycle Gold = round((E + L - 1) * 0.2 * max(0, income)) a turn, in cents: Gold in a boom, a charge in a slump.
 * @param {number} index E + L
 * @param {number} incomeCents
 */
export function cycleGoldCents(index, incomeCents) {
  return Math.round(((index - R.one) * R.goldPct * Math.max(0, incomeCents)) / (100 * R.one)) || 0;
}

/**
 * Whether a Panic starts this turn (DESIGN 4.11): open from the Banking stage, leverage above 1.5, E above 1.05, and
 * none in the last 20 turns.
 * @param {{ allowed: boolean, leverPct: number, e: number, lastPanic: number | null, turn: number }} q
 */
export function panicStarts({ allowed, leverPct, e, lastPanic, turn }) {
  if (!allowed || leverPct <= R.panicLeverPct || e <= R.boom) return false;
  return lastPanic === null || turn - lastPanic >= R.panicEveryTurns;
}

/**
 * Leverage: all outstanding loans over the Gold the civs hold (each balance floored at 0, at least 1000), in percent.
 * @param {number} outstandingCents
 * @param {number[]} balancesCents
 */
export function leverPct(outstandingCents, balancesCents) {
  let money = 0;
  for (const cents of balancesCents) money += Math.max(0, cents);
  return Math.floor((Math.max(0, outstandingCents) * 100) / Math.max(R.minLeverCents, money));
}
