// econ-escrow.js - Economics: the escrow account and the AI's preference rows (AI-PLAN 4.2). Each turn, after the
// payments, the mod holds back next turn's dues (two turns' for a civ that was in distress this turn) from the
// borrower's treasury into the world account `escrow`; at the start of the next turn the held Gold comes back into
// the civ's funds and the payment is made from it. The native AI's purchases read the balance, so the committed Gold
// is out of its reach; the human sees the same hold on the Treasury tab. Over a loan's life the account nets to
// zero (debt-8). The preference rows are plain data the glue sends through scaleAiPreference: a Gold yield bias
// scaled up with the AI's debt service while it's above a tenth of its income, and its army and expansion budgets
// scaled down while it's in distress, each set explicitly every turn so a factor never lingers. Nothing here reads
// the engine.

import { AI_PREFERENCE, ESCROW, ESCROW_RULES } from "./econ-params.js";
import { paymentDue } from "./econ-loan.js";
import { dividendDue } from "./econ-invest.js";
import { serviceOf } from "./econ-credit.js";
import { funds } from "./econ-batch.js";
import { emit, event, incomeOf, isAlive } from "./econ-turn.js";
import { loanGrowth } from "./econ-distress.js";
import { inDistress } from "./econ-shortfall.js";

/**
 * What a civ holds in escrow, from the ledger.
 * @param {Ledger} ledger
 * @param {number} pid
 */
export function escrowOf(ledger, pid) {
  return ledger.escrow.find((row) => row.pid === pid)?.cents || 0;
}

/**
 * @param {Ledger} ledger
 * @param {number} pid
 * @param {number} cents
 */
function setEscrow(ledger, pid, cents) {
  const row = ledger.escrow.find((x) => x.pid === pid);
  if (cents <= 0) { ledger.escrow = ledger.escrow.filter((x) => x.pid !== pid); return; }
  if (row) row.cents = cents; else ledger.escrow.push({ pid, cents });
}

/**
 * Next turn's dues as the ledger stands after this turn's payments: the scheduled payment on each active loan (a
 * loan opened this turn pays first next turn) and the dividend on each active investment the civ hosts.
 * @param {TurnContext} ctx
 * @param {number} pid
 */
export function nextDues(ctx, pid) {
  let sum = 0;
  for (const loan of ctx.ledger.loans) {
    if (loan.borrower === pid && loan.state === "active") sum += paymentDue(loan, loanGrowth(ctx, loan)).total;
  }
  for (const record of ctx.ledger.investments || []) {
    if (record.host === pid && record.state === "active") sum += dividendDue(record, incomeOf(ctx, pid));
  }
  return sum;
}

/**
 * The start of the turn: what each civ holds in escrow comes back into its funds, a world inflow. A civ that's gone
 * loses what it held: there's nobody to pay it to.
 * @param {TurnContext} ctx
 */
export function releaseEscrow(ctx) {
  for (const row of [...ctx.ledger.escrow]) {
    if (row.cents <= 0) continue;
    if (!isAlive(ctx, row.pid)) {
      event(ctx, { kind: "escrow-lost", pid: row.pid, cents: row.cents });
      setEscrow(ctx.ledger, row.pid, 0);
      continue;
    }
    emit(ctx, { id: `ER${row.pid}` }, { from: ESCROW, to: row.pid, cents: row.cents, reason: "escrow" });
    setEscrow(ctx.ledger, row.pid, 0);
  }
}

/**
 * After the payments: hold next turn's dues, two turns' for a civ in distress (short this turn or last; a civ short
 * this turn has nothing left to hold, so the second turn is where it bites), within what the civ has left. With Loans
 * off nothing is held (what a save held was released above).
 * @param {TurnContext} ctx
 * @param {Civ[]} live
 */
export function holdEscrow(ctx, live) {
  if (!ctx.options.loans) return;
  for (const civ of live) {
    const dues = nextDues(ctx, civ.id);
    const wanted = inDistress(ctx, civ.id) ? dues * ESCROW_RULES.distressTurns : dues;
    const cents = Math.max(0, Math.min(wanted, funds(ctx.batch, civ.id)));
    if (cents <= 0) continue;
    emit(ctx, { id: `EH${civ.id}` }, { from: civ.id, to: ESCROW, cents, reason: "escrow" });
    setEscrow(ctx.ledger, civ.id, cents);
  }
}

/** @param {number} value */
const round2 = (value) => Math.round(value * 100) / 100;

/**
 * The preference rows for each AI this turn (AI-PLAN 4.2): the Gold yield bias at 1 + 10 * service / income while
 * the service is above a tenth of income (at most 5), else 1; the army and expansion budgets at 1 / that while the
 * AI was in distress this turn (never below 0.25), else 1. Every row is sent every turn, so a factor is reset the
 * turn it isn't needed.
 * @param {TurnContext} ctx
 * @param {Civ[]} ai
 * @returns {AiPreferenceRow[]}
 */
export function aiPreferenceRows(ctx, ai) {
  /** @type {AiPreferenceRow[]} */
  const rows = [];
  const P = AI_PREFERENCE;
  for (const civ of ai) {
    const income = Math.max(0, civ.incomeCents);
    const service = serviceOf(ctx.ledger, civ.id);
    const bites = income > 0 && service * 100 > income * P.serviceSharePct;
    const gold = bites ? Math.min(P.goldMax, 1 + (P.goldPerShare * service) / income) : 1;
    const budget = inDistress(ctx, civ.id) ? Math.max(P.budgetMin, 1 / gold) : 1;
    rows.push({ pid: civ.id, system: P.goldSystem, item: P.goldItem, factor: round2(gold) });
    // Rearmament (DESIGN 4.11b) lifts the army budget while it runs.
    const army = ctx.crisis ? ctx.crisis.terms(civ.id).armyFactor : 1;
    for (const item of P.budgetItems) {
      const factor = item === "AI_BUDGET_STANDING_ARMY" ? budget * army : budget;
      rows.push({ pid: civ.id, system: P.budgetSystem, item, factor: round2(factor) });
    }
  }
  return rows;
}
