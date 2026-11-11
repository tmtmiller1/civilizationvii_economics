// econ-standing.js - Economics: the standing Gold lines (AI-NATIVE-LEVERS "Marker rules"). After each batch the
// model says what each civ's lines should read at the next turn roll: what it will pay on its loans (DEBT), what its
// civ borrowers will pay it (LOAN), the trade bills it paid or was paid this turn (BILL, BILLIN), and the rest of
// what Economics takes from it or pays it every turn (WORLD, WORLDIN): the business cycle, a planned economy's take,
// tax, the running costs of crisis measures and paths, and a mobilisation's borrowed upkeep. The glue stands each
// line in the capital as marker buildings in powers of two, so the game charges it as a named line in the city's Gold
// and the AI's income read sees it. A charging line sits under Deductions and moves the treasury by its face value;
// a paying line sits in the city's Income, which the game scales by the city's whole Income percentage (the AI's
// difficulty handicap, Modern's +20% for every AI, Unhappiness, leader and card bonuses: engine-closed.md), so the
// glue stands face / (1 + percentage) and counts back what landed. At the next batch the glue reads what stood
// through the roll, counts it back into each civ's balance and income for the plan, and takes it off the civ's
// grant, so the treasury ends where the plan says.
// Two marker kinds that aren't Gold ride the same glue: PRICE raises every purchase price of the civ by its percent
// while it stands (inflation, DESIGN 4.8), and REPUDIATED books a named grievance from every other major once, when
// it lands (a repudiation's witnesses, DESIGN 4.5). GLOOM takes Happiness from a settlement while its owner's treasury
// is below zero and stands in every settlement, not only the capital (DESIGN 4.18); DISBAND isn't a marker at all but
// the number of units the glue disbands for an overdrawn civ on its next pass. Nothing here reads the engine.

import { isWorldAccount } from "./econ-params.js";
import { paymentDue } from "./econ-loan.js";
import { loanGrowth } from "./econ-distress.js";
import { payable } from "./econ-batch.js";
import { premiumBpOf } from "./econ-overdrawn.js";

/** The line kinds, and the sign each charges the civ that holds it. */
export const STANDING_LINES = { DEBT: -1, LOAN: 1, BILL: -1, BILLIN: 1, WORLD: -1, WORLDIN: 1 };
/**
 * What a stack of price markers really does to a civ's purchase prices, measured in the game (lab 2026-11-10, W8: 19
 * stacks, 48 prices each across six cities, every one back to its base when the markers came down): the stack's total
 * in percent, and the mean rise it gave, in basis points. Small stacks land under their percent (prices round down to
 * steps of 4 Gold), large ones over it. Between two rows the rise is read on the straight line.
 */
export const PRICE_CALIBRATION = [[0, 0], [1, 90], [2, 170], [3, 266], [4, 360], [6, 549], [8, 744], [12, 1166],
  [16, 1615], [20, 2083], [25, 2660], [31, 3342], [32, 3464], [40, 4382], [50, 5531], [63, 7033], [64, 7147],
  [80, 8990], [100, 11288], [127, 14402]];

/**
 * The rise a stack of price markers adding to `stood` percent gives, in basis points (PRICE_CALIBRATION).
 * @param {number} stood
 */
export function priceRiseBp(stood) {
  const s = Math.max(0, Math.min(127, Math.trunc(stood) || 0));
  for (let i = 1; i < PRICE_CALIBRATION.length; i += 1) {
    const [s1, r1] = PRICE_CALIBRATION[i];
    if (s <= s1) {
      const [s0, r0] = PRICE_CALIBRATION[i - 1];
      return Math.round(r0 + ((r1 - r0) * (s - s0)) / (s1 - s0));
    }
  }
  return PRICE_CALIBRATION[PRICE_CALIBRATION.length - 1][1];
}

/**
 * The stack (0 to 127 percent of markers) whose real rise is nearest a price level of `levelBp` basis points, the
 * smaller stack on a tie.
 * @param {number} levelBp
 */
export function priceStandFor(levelBp) {
  const target = Math.max(0, levelBp || 0);
  let best = 0;
  for (let s = 1; s <= 127; s += 1) {
    if (Math.abs(RISE_BY_STACK[s] - target) < Math.abs(RISE_BY_STACK[best] - target)) best = s;
  }
  return best;
}

/** priceRiseBp for every stack, worked out once: the plan asks for each civ every turn. */
const RISE_BY_STACK = Array.from({ length: 128 }, (_, s) => priceRiseBp(s));

/**
 * The stack to stand for a civ's price level. The same stack raises prices by different amounts for different civs (a
 * civ's own purchase modifiers combine with it: 25% of markers raised the seat's prices 24.95% and an AI's at Deity
 * 26.5% on the same turn, lab 2026-11-10 W9), so once the glue has measured what the civ's current stack really does
 * (`measured`: the stack and its price factor in ppm, 1,000,000 for none), the next stack is scaled from that civ's
 * own response; before any measurement, the lab's table.
 * @param {number} levelBp
 * @param {{ stack: number, factorPpm: number } | null | undefined} measured
 */
export function priceStackFor(levelBp, measured) {
  const target = Math.max(0, levelBp || 0);
  if (!measured || !(measured.stack > 0) || !(measured.factorPpm > 1000000)) return priceStandFor(target);
  const perStackBp = (measured.factorPpm - 1000000) / 100 / measured.stack;
  return Math.max(0, Math.min(127, Math.round(target / perStackBp)));
}

/**
 * The rise a civ pays now, in basis points: its measured factor when the glue has one for the stack that stands, or
 * the table's figure for that stack.
 * @param {number} stack
 * @param {{ stack: number, factorPpm: number } | null | undefined} measured
 */
export function priceRiseFor(stack, measured) {
  if (measured && measured.stack === stack && measured.factorPpm >= 1000000) {
    return Math.round((measured.factorPpm - 1000000) / 100);
  }
  if (measured && measured.stack > 0 && measured.factorPpm > 1000000) {
    return Math.round(((measured.factorPpm - 1000000) / 100 / measured.stack) * stack);
  }
  return priceRiseBp(stack);
}

/**
 * The marker kinds that aren't Gold, with their rungs: PRICE in percent, REPUDIATED and REPAID in grievance and favor
 * points, GLOOM in Happiness a settlement.
 */
export const OTHER_MARKERS = { PRICE: [1, 2, 4, 8, 16, 32, 64], REPUDIATED: [1, 2, 4, 8], REPAID: [1, 2, 4, 8],
  GLOOM: [1, 2, 4, 8], SHUT: [1] };
/**
 * Kinds whose amount is a number of settlements, each holding one marker, that the glue picks itself (SHUT: the
 * settlements with their buildings shut down, the costliest first); `placeLines` leaves these alone.
 */
export const PICKED_SETTLEMENTS = new Set(["SHUT"]);
/** Kinds whose rungs stand in every settlement the civ holds, not only the capital. */
export const EVERY_SETTLEMENT = new Set(["GLOOM"]);
/** Rows that aren't markers: what the glue does on its next pass (DISBAND: units to disband), taken out once done. */
export const ACTION_KINDS = new Set(["DISBAND"]);
/** @param {string} line */
export const isActionKind = (line) => ACTION_KINDS.has(line);
/** Kinds whose marker acts once when it lands, so the glue takes it down and puts a wanted one up anew. */
export const ONE_SHOT = new Set(["REPUDIATED", "REPAID"]);
/**
 * A paying line stands only while the city keeps at least this share of it: below, the batch pays the Gold as a
 * grant (an unhappy capital can lose up to 80% of its Income, an AI at Settler outside Modern 20% more).
 */
export const MIN_PAY_FACTOR_PCT = 25;
/**
 * The world-account charges that come round every turn while their cause holds, by transfer reason, so this turn's
 * amount stands as next turn's line. One-off charges and grants (a response's price, a path's lump sum) stay grants.
 * A reason that some paths use once and some every turn is listed by the transfer id's prefix instead.
 */
const WORLD_REASONS = new Set(["erosion", "cycle", "plan", "tax", "administration", "arrears", "rearmament",
  "price-supports", "relief", "company", "mobilisation", "overdraft"]);
/** Path transfers that recur: PLC is a path's Gold a settlement each turn. */
const WORLD_POLICY_IDS = ["PLC"];
/** Rungs 1 to 512: one line reads at most 1,023 Gold, and the rest of a larger amount goes as a grant. */
export const RUNGS = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];
export const MAX_LINE_GOLD = 1023;

/** @typedef {keyof typeof STANDING_LINES} GoldLine */
/** @typedef {GoldLine | keyof typeof OTHER_MARKERS | "DISBAND"} StandingLine */
/** @typedef {{ pid: number, line: StandingLine, gold: number }} StandingRow */

/** @param {string} line */
export const isGoldLine = (line) => Object.prototype.hasOwnProperty.call(STANDING_LINES, line);

/** @param {string} line */
export const isMarkerKind = (line) => isGoldLine(line) || Object.prototype.hasOwnProperty.call(OTHER_MARKERS, line);

/** The rungs of a kind's ladder. @param {string} line */
export function rungsFor(line) {
  if (isGoldLine(line)) return RUNGS;
  return /** @type {Record<string, number[]>} */ (OTHER_MARKERS)[line] || [];
}

/** @param {StandingLine} line @param {number} rung */
export function markerType(line, rung) {
  if (line === "PRICE" || line === "GLOOM" || line === "SHUT") return `BUILDING_ECON_${line}_${rung}`;
  if (line === "REPUDIATED" || line === "REPAID") return `BUILDING_ECON_NOTE_${line}_${rung}`;
  return `BUILDING_ECON_LINE_${line}_${rung}`;
}

const LINE_TYPE = new RegExp(`^BUILDING_ECON_LINE_(${Object.keys(STANDING_LINES).join("|")})_(\\d+)$`);
const OTHER_TYPE = /^BUILDING_ECON_(?:NOTE_)?(PRICE|GLOOM|SHUT|REPUDIATED|REPAID)_(\d+)$/;

/**
 * A marker type's line and rung, or null for any other type.
 * @param {string} type
 * @returns {{ line: StandingLine, rung: number } | null}
 */
export function parseMarkerType(type) {
  const text = String(type);
  const m = LINE_TYPE.exec(text) || OTHER_TYPE.exec(text);
  if (!m || !rungsFor(m[1]).includes(Number(m[2]))) return null;
  return { line: /** @type {StandingLine} */ (m[1]), rung: Number(m[2]) };
}

/**
 * The rungs that add up to a whole amount, largest first, capped at the ladder's sum (1,023 for a Gold line).
 * @param {number} gold
 * @param {number[]} [rungs]
 */
export function rungsOf(gold, rungs = RUNGS) {
  let left = Math.max(0, Math.min(rungs.reduce((a, b) => a + b, 0), Math.trunc(gold) || 0));
  /** @type {number[]} */
  const out = [];
  for (let i = rungs.length - 1; i >= 0; i -= 1) {
    if (left >= rungs[i]) { out.push(rungs[i]); left -= rungs[i]; }
  }
  return out;
}

/**
 * What a whole-Gold line should stand at so it moves the treasury by `gold`: a charging line at its face, a paying
 * line at face / (1 + the capital's Income percentage), and none when the city keeps under MIN_PAY_FACTOR_PCT of it.
 * Other kinds stand at their amount.
 * @param {string} line
 * @param {number} gold
 * @param {number} [incomePct]
 */
export function standAmount(line, gold, incomePct = 0) {
  if (!isGoldLine(line) || STANDING_LINES[/** @type {GoldLine} */ (line)] < 0) return gold;
  const factor = 100 + (Number.isFinite(incomePct) ? incomePct : 0);
  if (factor < MIN_PAY_FACTOR_PCT) return 0;
  return Math.min(MAX_LINE_GOLD, Math.round((gold * 100) / factor));
}

/**
 * The signed Gold the markers a civ holds moved its treasury by at one roll, in cents: charging lines at their face,
 * paying lines scaled by the capital's Income percentage. Markers that aren't Gold count nothing.
 * @param {{ line: StandingLine, rung: number }[]} markers
 * @param {number} [incomePct]
 */
export function chargeCents(markers, incomePct = 0) {
  const factor = 100 + (Number.isFinite(incomePct) ? incomePct : 0);
  let cents = 0;
  for (const m of markers) {
    if (!isGoldLine(m.line)) continue;
    const sign = STANDING_LINES[/** @type {GoldLine} */ (m.line)];
    cents += sign < 0 ? -m.rung * 100 : Math.round(m.rung * factor);
  }
  return cents;
}

/**
 * @param {Map<string, number>} sums
 * @param {number} pid
 * @param {StandingLine} line
 * @param {number} gold
 */
function add(sums, pid, line, gold) {
  if (gold <= 0) return;
  const key = `${pid}:${line}`;
  sums.set(key, (sums.get(key) || 0) + gold);
}

/**
 * Next roll's lines for every living civ, from the ledger after this turn: each active loan's next payment (one
 * opened this turn pays first next turn; a loan on a bank holiday this turn is left out), and this turn's trade bills
 * as the estimate for the next, and the same for the world-account Gold that recurs. Whole Gold per loan and per
 * bill, so a lender's line matches what its borrowers' lines carry for it. A civ's charges stop at what it can still
 * pay after the batch, its overdraft included (DESIGN 4.18), oldest loan first, then its bills, then the world's
 * charges. They can take its Gold a turn below 0, and the roll then takes its balance below 0 with them.
 * Whatever a line doesn't carry is settled by the batch as before.
 * @param {TurnContext} ctx
 * @param {Civ[]} live
 * @returns {StandingRow[]}
 */
export function standingRows(ctx, live) {
  const alive = new Set(live.map((civ) => civ.id));
  /** @type {Map<number, number>} */
  const room = new Map(live.map((civ) => [civ.id,
    ctx.batch ? Math.floor(Math.max(0, payable(ctx.batch, civ.id)) / 100) : Number.POSITIVE_INFINITY]));
  /** @type {Map<string, number>} */
  const sums = new Map();
  /** @param {number} pid @param {number} gold */
  const take = (pid, gold) => {
    const left = room.get(pid) || 0;
    const got = Math.min(left, gold);
    room.set(pid, left - got);
    return got;
  };
  loanLines(ctx, alive, take, sums);
  billLines(ctx, alive, take, sums);
  worldLines(ctx, alive, take, sums);
  otherRows(ctx, alive, sums);
  /** @type {StandingRow[]} */
  const out = [];
  for (const [key, gold] of sums) {
    const [pid, line] = key.split(":");
    // A count (units to disband, settlements to shut) isn't a ladder of rungs, so it's never capped.
    const counted = isActionKind(line) || PICKED_SETTLEMENTS.has(line);
    const cap = counted ? gold : rungsFor(line).reduce((a, b) => a + b, 0);
    out.push({ pid: Number(pid), line: /** @type {StandingLine} */ (line), gold: Math.min(cap, gold) });
  }
  return out.sort((a, b) => a.pid - b.pid || a.line.localeCompare(b.line));
}

/**
 * The rows that aren't Gold: this turn's one-shot notes; each civ's price stack for its inflation level plus the
 * premium an overdrawn treasury pays (the stack the game turns into that rise, priceStackFor), with Inflation off the
 * premium alone; and an overdrawn civ's gloom and the units it disbands (DESIGN 4.18).
 * @param {TurnContext} ctx
 * @param {Set<number>} alive
 * @param {Map<string, number>} sums
 */
function otherRows(ctx, alive, sums) {
  for (const row of ctx.out.notes || []) if (alive.has(row.pid)) add(sums, row.pid, row.line, row.amount);
  const levels = ctx.macro?.inflation?.levels || {};
  const pids = new Set([...Object.keys(levels), ...Object.keys(ctx.out.overdrawn || {})].map(Number));
  for (const pid of pids) if (alive.has(pid)) priceAndGloom(ctx, pid, levels, sums);
}

/**
 * One civ's price stack (its inflation level plus any overdraft premium) and, while it's overdrawn, its gloom, the
 * units it disbands and how many settlements have their buildings shut down.
 * @param {TurnContext} ctx
 * @param {number} pid
 * @param {Record<string, number>} levels
 * @param {Map<string, number>} sums
 */
function priceAndGloom(ctx, pid, levels, sums) {
  const key = String(pid);
  const levelBp = Math.round((levels[key] || 0) / 100) + premiumBpOf(ctx.out, pid);
  add(sums, pid, "PRICE", priceStackFor(levelBp, ctx.priceFactors?.[key]));
  const row = ctx.out.overdrawn?.[key];
  if (row) {
    add(sums, pid, "GLOOM", row.gloom);
    add(sums, pid, "DISBAND", row.disband);
    add(sums, pid, "SHUT", row.shut || 0);
  }
}

/**
 * @param {TurnContext} ctx
 * @param {Set<number>} alive
 * @param {(pid: number, gold: number) => number} take
 * @param {Map<string, number>} sums
 */
function loanLines(ctx, alive, take, sums) {
  const holiday = (/** @type {Loan} */ loan) => ctx.crisis?.holiday(loan.borrower) || ctx.crisis?.holiday(loan.lender);
  const loans = ctx.ledger.loans.filter((loan) => loan.state === "active" && alive.has(loan.borrower) && !holiday(loan))
    .sort((a, b) => a.opened - b.opened || Number(a.id.slice(1)) - Number(b.id.slice(1)));
  for (const loan of loans) {
    const gold = take(loan.borrower, Math.floor(paymentDue(loan, loanGrowth(ctx, loan)).total / 100));
    add(sums, loan.borrower, "DEBT", gold);
    if (!isWorldAccount(loan.lender) && alive.has(/** @type {number} */ (loan.lender))) {
      add(sums, /** @type {number} */ (loan.lender), "LOAN", gold);
    }
  }
}

/**
 * @param {TurnContext} ctx
 * @param {Set<number>} alive
 * @param {(pid: number, gold: number) => number} take
 * @param {Map<string, number>} sums
 */
function billLines(ctx, alive, take, sums) {
  for (const t of ctx.out.transfers) {
    if (t.reason !== "trade" || typeof t.from !== "number" || typeof t.to !== "number") continue;
    if (!alive.has(t.from) || !alive.has(t.to)) continue;
    const gold = take(t.from, Math.floor(t.cents / 100));
    add(sums, t.from, "BILL", gold);
    add(sums, t.to, "BILLIN", gold);
  }
}

/**
 * @param {Transfer} t
 */
function recurs(t) {
  if (WORLD_REASONS.has(t.reason)) return true;
  return t.reason === "policy" && WORLD_POLICY_IDS.some((prefix) => String(t.loanId).startsWith(prefix));
}

/**
 * This turn's recurring world-account charges as next turn's line, after the civ's loans and bills and under the
 * same cap, and what the world pays it in full. Whole Gold per transfer, as the bills.
 * @param {TurnContext} ctx
 * @param {Set<number>} alive
 * @param {(pid: number, gold: number) => number} take
 * @param {Map<string, number>} sums
 */
function worldLines(ctx, alive, take, sums) {
  for (const t of ctx.out.transfers) {
    if (!recurs(t)) continue;
    if (typeof t.from === "number" && isWorldAccount(t.to) && alive.has(t.from)) {
      add(sums, t.from, "WORLD", take(t.from, Math.floor(t.cents / 100)));
    } else if (typeof t.to === "number" && isWorldAccount(t.from) && alive.has(t.to)) {
      add(sums, t.to, "WORLDIN", Math.floor(t.cents / 100));
    }
  }
}
