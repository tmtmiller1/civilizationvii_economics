// econ-crisis-rows.js - Economics: the crisis rows the ledger holds (DESIGN 4.11c) and the terms the standing
// responses and legacies set, which the other rules read through the turn context's crisis hooks. Nothing here moves
// Gold or reads the engine.

import { RESPONSE_RULES as RR } from "./econ-crisis-catalog.js";

/** @param {Ledger} ledger @param {number} pid */
export function openCrises(ledger, pid) {
  return (ledger.crises || []).filter((row) => row.pid === pid);
}

/** @param {Ledger} ledger @param {number} pid */
export function standingResponses(ledger, pid) {
  return (ledger.responses || []).filter((row) => row.pid === pid);
}

/** The legacies a civ carries, the world's (pid null) included. @param {Ledger} ledger @param {number} pid */
export function legaciesOf(ledger, pid) {
  return (ledger.legacies || []).filter((row) => row.pid === pid || row.pid === null);
}

/** @param {Ledger} ledger @param {number} pid @param {string} id */
export function hasLegacy(ledger, pid, id) {
  return legaciesOf(ledger, pid).some((row) => row.id === id);
}

/** @param {Ledger} ledger @param {number} pid @param {string} id */
export function isRunning(ledger, pid, id) {
  return standingResponses(ledger, pid).some((row) => row.id === id);
}

/** A civ's settlements for the per-settlement figures; 1 when the glue read none. @param {Civ} civ */
export const settlementsOf = (civ) => Math.max(1, (civ.cities || []).length || 1);

/** @param {TurnContext} ctx */
export const crisesOn = (ctx) => ctx.options.crises === true;

/**
 * @typedef {{ spreadFloor: boolean, noFreeze: boolean, panicPct: number, capTurns: number, capDepthPct: number,
 *   ownRatePct: number, bondPct: number, templePct: number, holiday: boolean, lendingClosed: boolean,
 *   piExtraPpm: number, erosionCapPct: number, billPct: number, tradeWarDouble: boolean, navigationActs: boolean,
 *   collapseHalf: boolean, pricePct: number, armyFactor: number, austerity: boolean, dole: boolean,
 *   billsToPct: Record<string, number> }} CrisisTerms
 */

/** @returns {CrisisTerms} */
function plainTerms() {
  return { spreadFloor: false, noFreeze: false, panicPct: 100, capTurns: 0, capDepthPct: 100, ownRatePct: 100,
    bondPct: 100, templePct: 100, holiday: false, lendingClosed: false, piExtraPpm: 0, erosionCapPct: 100,
    billPct: 100, tradeWarDouble: false, navigationActs: false, collapseHalf: false, pricePct: 0, armyFactor: 1,
    austerity: false, dole: false, billsToPct: {} };
}

/** @param {number} a @param {number} b */
const pct = (a, b) => Math.round((a * b) / 100);

/** What each standing response changes while it runs. @type {Record<string, (t: CrisisTerms) => void>} */
const RUNNING_TERMS = {
  "bank-holiday": (t) => { t.holiday = true; },
  suspend: (t) => { t.holiday = true; },
  debase: (t) => { t.pricePct += RR.debase.pricePctPerTurn; },
  bullion: (t) => { t.pricePct += RR.bullion.pricePctPerTurn; },
  "gold-standard": (t) => {
    t.pricePct += RR.goldStandard.pricePctPerTurn;
    t.piExtraPpm += RR.goldStandard.piExtraPpm;
  },
  charter: (t) => { t.capTurns += RR.charter.capTurns; t.billPct = pct(t.billPct, RR.charter.billPct); },
  "navigation-acts": (t) => { t.navigationActs = true; },
  rearmament: (t) => { t.armyFactor = RR.rearmament.armyFactor; },
  austerity: (t) => { t.austerity = true; },
  "bank-run": (t) => { t.lendingClosed = true; },
  relief: (t) => { t.dole = true; },
};

/** What each legacy changes while it lasts. @type {Record<string, (t: CrisisTerms) => void>} */
const LEGACY_TERMS = {
  "cancel-debts": (t) => { t.templePct = pct(t.templePct, RR.cancelDebts.templePct); },
  debase: (t) => { t.ownRatePct = pct(t.ownRatePct, RR.debase.ownRatePct); },
  "temple-lends": (t) => { t.templePct = pct(t.templePct, RR.templeLends.worldTemplePct); },
  suspend: (t) => { t.bondPct = pct(t.bondPct, RR.suspend.bondPct); },
  recoinage: (t) => { t.erosionCapPct = RR.recoinage.erosionCapPct; },
  "navigation-acts": (t) => { t.tradeWarDouble = true; },
  bullion: (t) => { t.piExtraPpm += RR.bullion.piExtraPpm; },
  "bullion-pirates": (t) => { t.collapseHalf = true; },
  "lend-crown": (t) => { t.capTurns += RR.lendCrown.capTurns; },
  "deposit-insurance": (t) => {
    t.spreadFloor = true;
    t.noFreeze = true;
    t.panicPct = RR.depositInsurance.panicPct;
    t.capDepthPct = RR.depositInsurance.capDepthPct;
  },
  "gold-standard": (t) => { t.piExtraPpm += RR.goldStandard.legacyPiExtraPpm; },
  "bank-failures": (t) => { t.capTurns -= RR.bankFailures.capTurnsLost; },
};

/**
 * A tribute levied is remembered by the civs that paid it: for the legacy's turns their trade bills to the levier
 * count at 200% (DESIGN 4.11c). The levier's row names them; the term is the payer's, keyed by the payee.
 * @param {Ledger} ledger
 * @param {number} pid
 * @param {CrisisTerms} terms
 */
function leviedTerms(ledger, pid, terms) {
  for (const row of ledger.legacies || []) {
    if (row.id === "tribute" && row.pid !== null && (row.civs || []).includes(pid)) {
      terms.billsToPct[String(row.pid)] = RR.tribute.billPct;
    }
  }
}

/**
 * The terms a civ's standing responses and legacies set this turn, read once per civ per turn.
 * @param {TurnContext} ctx
 * @param {number} pid
 * @returns {CrisisTerms}
 */
export function crisisTerms(ctx, pid) {
  const cache = ctx.crisisTerms || (ctx.crisisTerms = new Map());
  const cached = cache.get(pid);
  if (cached) return cached;
  const terms = plainTerms();
  if (crisesOn(ctx)) {
    for (const row of standingResponses(ctx.ledger, pid)) RUNNING_TERMS[row.id]?.(terms);
    for (const row of legaciesOf(ctx.ledger, pid)) LEGACY_TERMS[row.id]?.(terms);
    leviedTerms(ctx.ledger, pid, terms);
  }
  cache.set(pid, terms);
  return terms;
}

/**
 * Whether a civ's own payments and the payments owed to it are suspended this turn.
 * @param {TurnContext} ctx
 * @param {unknown} pid
 */
export function onHoliday(ctx, pid) {
  return typeof pid === "number" && crisisTerms(ctx, pid).holiday;
}

/** Forgets the cached terms after a change. @param {TurnContext} ctx */
export function forgetTerms(ctx) {
  ctx.crisisTerms = new Map();
}
