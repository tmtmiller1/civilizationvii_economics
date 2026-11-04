// econ-standing.js - Economics: the standing Gold lines (AI-NATIVE-LEVERS "Marker rules"). After each batch the
// model says what each civ's lines should read at the next turn roll: what it will pay on its loans (DEBT), what its
// civ borrowers will pay it (LOAN), and the trade bills it paid or was paid this turn (BILL, BILLIN). The glue stands
// each line in the capital as marker buildings in powers of two, so the game charges it as a named line in the
// city's Gold and the AI's income read sees it. At the next batch the glue reads what stood through the roll, counts
// it back into each civ's balance and income for the plan, and takes it off the civ's grant, so the treasury ends
// where the plan says. Nothing here reads the engine.

import { isWorldAccount } from "./econ-params.js";
import { paymentDue } from "./econ-loan.js";
import { loanGrowth } from "./econ-distress.js";

/** The line kinds, and the sign each charges the civ that holds it. */
export const STANDING_LINES = { DEBT: -1, LOAN: 1, BILL: -1, BILLIN: 1 };
/** Rungs 1 to 512: one line reads at most 1,023 Gold, and the rest of a larger amount goes as a grant. */
export const RUNGS = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];
export const MAX_LINE_GOLD = 1023;
/** The charging lines together stay under this share of a civ's income, so a roll never takes its income below 0. */
export const CHARGE_CAP_PCT = 90;

/** @typedef {keyof typeof STANDING_LINES} StandingLine */
/** @typedef {{ pid: number, line: StandingLine, gold: number }} StandingRow */

/** @param {StandingLine} line @param {number} rung */
export const markerType = (line, rung) => `BUILDING_ECON_LINE_${line}_${rung}`;

/**
 * A marker type's line and rung, or null for any other type.
 * @param {string} type
 * @returns {{ line: StandingLine, rung: number } | null}
 */
export function parseMarkerType(type) {
  const m = /^BUILDING_ECON_LINE_(DEBT|LOAN|BILL|BILLIN)_(\d+)$/.exec(String(type));
  if (!m || !RUNGS.includes(Number(m[2]))) return null;
  return { line: /** @type {StandingLine} */ (m[1]), rung: Number(m[2]) };
}

/**
 * The rungs that add up to a whole amount, largest first, capped at MAX_LINE_GOLD.
 * @param {number} gold
 */
export function rungsOf(gold) {
  let left = Math.max(0, Math.min(MAX_LINE_GOLD, Math.trunc(gold) || 0));
  /** @type {number[]} */
  const out = [];
  for (let i = RUNGS.length - 1; i >= 0; i -= 1) {
    if (left >= RUNGS[i]) { out.push(RUNGS[i]); left -= RUNGS[i]; }
  }
  return out;
}

/**
 * The signed Gold the markers a civ holds charge it each roll, in cents.
 * @param {{ line: StandingLine, rung: number }[]} markers
 */
export function chargeCents(markers) {
  let cents = 0;
  for (const m of markers) cents += STANDING_LINES[m.line] * m.rung * 100;
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
 * as the estimate for the next. Whole Gold per loan and per bill, so a lender's line matches what its borrowers'
 * lines carry for it. A borrower's charges stop at CHARGE_CAP_PCT of its income, oldest loan first, then its bills.
 * Whatever a line doesn't carry is settled by the batch as before.
 * @param {TurnContext} ctx
 * @param {Civ[]} live
 * @returns {StandingRow[]}
 */
export function standingRows(ctx, live) {
  const alive = new Set(live.map((civ) => civ.id));
  /** @type {Map<number, number>} */
  const room = new Map(live.map((civ) => [civ.id,
    Math.floor((Math.max(0, civ.incomeCents) * CHARGE_CAP_PCT) / 100 / 100)]));
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
  /** @type {StandingRow[]} */
  const out = [];
  for (const [key, gold] of sums) {
    const [pid, line] = key.split(":");
    out.push({ pid: Number(pid), line: /** @type {StandingLine} */ (line), gold: Math.min(MAX_LINE_GOLD, gold) });
  }
  return out.sort((a, b) => a.pid - b.pid || a.line.localeCompare(b.line));
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
