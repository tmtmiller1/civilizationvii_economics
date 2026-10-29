// econ-plan.js - Economics: one turn of the ledger as plain data in, transfers out (DESIGN 4.14). The glue reads
// balances, income, relations and stages, calls planTurn once per turn, and sends each civ's net as grantYield calls
// (econ-conservation.js). The turn is one batch: snapshot, propose, resolve each payer on its own funds, commit.
// Civs are handled in id order whatever order they came in, so the result doesn't depend on the glue's listing.
// TEST-PLAN 12.1 extends this module with the 1.1 and 1.2 steps of 4.14 (bills, erosion, cycle Gold, dividends).

import { EMERGENCY, MISS, STANDING, TAX } from "./econ-params.js";
import { isOpen } from "./econ-loan.js";
import { addMiss } from "./econ-credit.js";
import { blockFor, blocksAfterAge } from "./econ-lenders.js";
import { settleActive, settleDefault, withBlock } from "./econ-payments.js";
import { aiShortfall } from "./econ-ai.js";
import { applyGrants, grantsFor } from "./econ-conservation.js";
import { addCelebration, addInfluence, commitBatch, funds, projected } from "./econ-batch.js";
import { aiTaxLevel, canChangeTax, taxFlow } from "./econ-tax.js";
import { cloneLedger, emptyLedger, prune } from "./econ-state.js";
import { alive, closeLoan, emit, event, notice, replaceLoan, turnContext } from "./econ-turn.js";
import { runRequests } from "./econ-requests.js";
import { aiBorrow, aiRepudiate, aiRestructure, guardFor, insolvent } from "./econ-shortfall.js";

/** @type {PlanOptions} */
export const DEFAULT_OPTIONS = { loans: true, guard: true, ai: true, rates: "standard", stages: true,
  taxFallback: false };

/**
 * @param {Loan} a
 * @param {Loan} b
 */
const byAge = (a, b) => a.opened - b.opened || Number(a.id.slice(1)) - Number(b.id.slice(1));

/**
 * One turn: the ledger after it, the transfers to send, and the Influence, celebration, grievance and relationship
 * rows the glue books (DESIGN 4.14).
 * @param {PlanInput} input
 * @returns {PlanOutput}
 */
export function planTurn(input) {
  const options = { ...DEFAULT_OPTIONS, ...(input.options || {}) };
  const ledger = cloneLedger(input.ledger || emptyLedger());
  /** @type {PlanOutput} */
  const out = { ledger, transfers: [], influence: [], celebration: [], grievances: [], relationships: [], events: [],
    notices: [], batch: null, skipped: null };
  const skipped = skipReason(input, options, ledger);
  if (skipped) return { ...out, skipped };
  const ctx = turnContext(input, options, out);
  snapshotStep(ctx);
  proposeStep(ctx);
  finishTurn(ctx);
  return out;
}

/**
 * DESIGN 4.14 step 1: the age change, the insolvency counters and the records whose party is gone.
 * @param {TurnContext} ctx
 */
function snapshotStep(ctx) {
  const { ledger } = ctx;
  if (ledger.age !== null && ledger.age !== ctx.age) ledger.blocks = blocksAfterAge(ledger.blocks);
  ledger.age = ctx.age;
  trackIncome(ctx);
  writeOffs(ctx);
}

/**
 * DESIGN 4.14 steps 2 to 10, each payer on its own funds, then the guard and shortfall rules on projections.
 * @param {TurnContext} ctx
 */
function proposeStep(ctx) {
  const live = ctx.civs.filter((civ) => civ.alive === true);
  const ai = ctx.options.ai ? live.filter((civ) => civ.human !== true) : [];
  for (const civ of ai) { aiRepudiate(ctx, civ); aiRestructure(ctx, civ); }
  const extras = runRequests(ctx);
  if (ctx.options.taxFallback) for (const civ of live) taxOne(ctx, civ);
  for (const civ of live) payerPass(ctx, civ.id, extras);
  for (const civ of live) if (civ.human === true) guardFor(ctx, civ);
  for (const civ of aiBorrowers(ctx, ai)) aiBorrow(ctx, civ);
}

/**
 * @param {PlanInput} input
 * @param {PlanOptions} options
 * @param {Ledger} ledger
 */
function skipReason(input, options, ledger) {
  if (!options.loans) return "loans-off";
  if (Number.isInteger(ledger.lastTurn) && input.turn <= /** @type {number} */ (ledger.lastTurn)) {
    return "already-planned";
  }
  return null;
}

/**
 * DESIGN 4.14 step 10: competing borrowers go largest shortfall first, ties by player id.
 * @param {TurnContext} ctx
 * @param {Civ[]} ai
 */
function aiBorrowers(ctx, ai) {
  return ai
    .map((civ) => ({ civ, need: aiShortfall(projected(ctx.batch, civ.id), ctx.params.amenityLineCents) }))
    .filter((row) => row.need > 0)
    .sort((x, y) => y.need - x.need || x.civ.id - y.civ.id)
    .map((row) => row.civ);
}

/**
 * Turns running with income at or below 0, per civ (DESIGN 4.6 insolvency).
 * @param {TurnContext} ctx
 */
function trackIncome(ctx) {
  const rows = ctx.ledger.lowIncome;
  for (const civ of ctx.civs) {
    if (civ.alive !== true) continue;
    const row = rows.find((x) => x.pid === civ.id);
    const turns = civ.incomeCents <= 0 ? (row?.turns || 0) + 1 : 0;
    if (row) row.turns = turns; else rows.push({ pid: civ.id, turns });
    if (turns === EMERGENCY.insolventTurns && civ.human === true) notice(ctx, civ.id, { kind: "insolvent", turns });
  }
  ctx.ledger.lowIncome = rows.filter((row) => alive(ctx, row.pid));
}

/**
 * Lifecycle: a dead lender or borrower ends the loan; nothing is ever sent to a player who is not alive.
 * @param {TurnContext} ctx
 */
function writeOffs(ctx) {
  for (const loan of ctx.ledger.loans) {
    if (!isOpen(loan)) continue;
    const gone = !alive(ctx, loan.lender) ? "lender" : !alive(ctx, loan.borrower) ? "borrower" : null;
    if (!gone) continue;
    replaceLoan(ctx, { ...loan, state: "closed", closedTurn: ctx.turn, writtenOff: loan.outstanding, outstanding: 0 });
    event(ctx, { kind: "writeoff", loanId: loan.id, gone, cents: loan.outstanding });
  }
}

/**
 * DESIGN 6 "balance falling": below the balance the last batch snapshotted; income below 0 before any batch.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
function balanceFalling(ctx, civ) {
  const last = ctx.ledger.lastBatch?.civs?.find((row) => row.pid === civ.id);
  return last && Number.isInteger(last.snapshot) ? civ.balanceCents < last.snapshot : civ.incomeCents < 0;
}

/**
 * The script fallback's level for an AI civ (DESIGN 6), re-read when a change is allowed.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
function aiTaxRow(ctx, civ) {
  const rows = ctx.ledger.taxes;
  let row = rows.find((tax) => tax.pid === civ.id);
  if (!canChangeTax(row?.changedTurn, ctx.turn)) return row;
  const level = aiTaxLevel({ balanceCents: civ.balanceCents, incomeCents: civ.incomeCents,
    falling: balanceFalling(ctx, civ), insolvent: insolvent(ctx, civ.id), atWar: civ.atWar === true });
  if (!row) { row = { pid: civ.id, level, changedTurn: ctx.turn }; rows.push(row); }
  else if (row.level !== level) Object.assign(row, { level, changedTurn: ctx.turn });
  return row;
}

/**
 * The script fallback's tax line (DESIGN 4.7): Gold against the tax account, the meter as a celebration row.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
function taxOne(ctx, civ) {
  const row = civ.human === true ? ctx.ledger.taxes.find((tax) => tax.pid === civ.id) : aiTaxRow(ctx, civ);
  const flow = taxFlow({ level: row?.level ?? "standard", incomeCents: civ.incomeCents,
    happinessCents: civ.happinessCents, atWar: civ.atWar === true });
  const id = { id: `T${civ.id}` };
  if (flow.goldCents > 0) emit(ctx, id, { from: TAX, to: civ.id, cents: flow.goldCents, reason: "tax" });
  // A remittance the funds can't cover is missed like any other charge (DESIGN 4.14), with nothing carried.
  if (flow.goldCents < 0 && funds(ctx.batch, civ.id) >= -flow.goldCents) {
    emit(ctx, id, { from: civ.id, to: TAX, cents: -flow.goldCents, reason: "tax" });
  }
  if (flow.celebrationCents === 0) return;
  addCelebration(ctx.batch, civ.id, flow.celebrationCents);
  ctx.out.celebration.push({ pid: civ.id, amount: flow.celebrationCents, reason: "tax" });
}

/**
 * One payer's turn: garnish on its defaulted loans, then its scheduled payments, oldest loan first.
 * @param {TurnContext} ctx
 * @param {number} pid
 * @param {Map<string, number>} extras
 */
function payerPass(ctx, pid, extras) {
  const mine = ctx.ledger.loans.filter((loan) => loan.borrower === pid);
  for (const loan of mine.filter((x) => x.state === "default").sort(byAge)) garnishOne(ctx, loan, extras);
  for (const loan of mine.filter((x) => x.state === "active" && x.opened < ctx.turn).sort(byAge)) {
    payOne(ctx, loan, extras);
  }
}

/**
 * @param {TurnContext} ctx
 * @param {Loan} loan
 * @param {Map<string, number>} extras
 */
function garnishOne(ctx, loan, extras) {
  const civ = /** @type {Civ} */ (ctx.civ.get(loan.borrower));
  const result = settleDefault(loan, { incomeCents: civ.incomeCents, balanceCents: civ.balanceCents,
    cashCents: funds(ctx.batch, loan.borrower) }, extras.get(loan.id) || 0);
  emit(ctx, loan, { from: loan.borrower, to: loan.lender, cents: result.cents, reason: "garnish",
    parts: { garnish: result.garnish, extra: result.extra } });
  replaceLoan(ctx, result.loan);
  if (result.closed) closeLoan(ctx, result.loan);
}

/**
 * @param {TurnContext} ctx
 * @param {Loan} loan
 * @param {Map<string, number>} extras
 */
function payOne(ctx, loan, extras) {
  const extra = extras.get(loan.id) || 0;
  const result = settleActive(loan, funds(ctx.batch, loan.borrower), { capPpm: ctx.capPpm, extra });
  replaceLoan(ctx, result.loan);
  if (result.missed) { recordMiss(ctx, loan, result); return; }
  emit(ctx, loan, { from: loan.borrower, to: loan.lender, cents: result.cents, reason: "payment",
    parts: { interest: result.interest, amortisation: result.amortisation, extra: result.extra } });
  if (result.closed) closeLoan(ctx, result.loan);
}

/**
 * @param {TurnContext} ctx
 * @param {Loan} loan
 * @param {ReturnType<typeof settleActive>} result
 */
function recordMiss(ctx, loan, result) {
  const { ledger, turn, out } = ctx;
  addMiss(ledger, loan.borrower, turn);
  addInfluence(ctx.batch, loan.borrower, MISS.influence);
  out.influence.push({ pid: loan.borrower, amount: MISS.influence, loanId: loan.id, reason: "miss" });
  event(ctx, { kind: "miss", loanId: loan.id, borrower: loan.borrower, missed: result.loan.missed,
    capitalised: result.capitalised });
  notice(ctx, loan.borrower, { kind: "miss", loanId: loan.id, missed: result.loan.missed });
  if (!result.defaulted) return;
  ledger.blocks = withBlock(ledger.blocks, blockFor({ lender: loan.lender, borrower: loan.borrower, reason: "default",
    turn }));
  event(ctx, { kind: "default", loanId: loan.id, lender: loan.lender, borrower: loan.borrower, chronicle: 1 });
  notice(ctx, loan.borrower, { kind: "default", loanId: loan.id });
  notice(ctx, loan.lender, { kind: "defaulted-on", loanId: loan.id, borrower: loan.borrower });
}

/** @param {TurnContext} ctx */
function finishTurn(ctx) {
  const { ledger, turn } = ctx;
  ledger.misses = ledger.misses.filter((row) => turn - row.turn < STANDING.windowTurns);
  ledger.repudiations = ledger.repudiations.filter((row) => turn - row.turn < STANDING.repudiationWindowTurns);
  ledger.blocks = ledger.blocks.filter((block) => block.untilTurn === null || turn < block.untilTurn);
  ledger.capHits = ledger.capHits.filter((row) => turn - row.turn <= 1 && alive(ctx, row.pid));
  ledger.lastTurn = turn;
  ledger.batchSeq += 1;
  ledger.lastBatch = commitBatch(ctx.batch, { id: `B${ledger.batchSeq}`, turn, civs: ctx.civs });
  ctx.out.batch = ledger.lastBatch;
  prune(ledger);
}

/**
 * The Treasury tab's projection: income held flat, no new player requests after this turn, the guard and AI
 * rules running as configured. Returns [{ id, balances: [cents after each turn] }] in the order civs were given.
 * @param {PlanInput} input
 * @param {number} [turns]
 */
export function projectBalances(input, turns = 20) {
  let ledger = input.ledger || emptyLedger();
  /** @type {Map<Party, number>} */
  let balances = new Map(input.civs.map((civ) => [civ.id, civ.balanceCents]));
  /** @type {{ id: number, balances: number[] }[]} */
  const series = input.civs.map((civ) => ({ id: civ.id, balances: [] }));
  for (let k = 0; k < turns; k += 1) {
    const civs = input.civs.map((civ) => ({ ...civ, balanceCents: balances.get(civ.id) || 0 }));
    const plan = planTurn({ ...input, turn: input.turn + k, civs, requests: k === 0 ? input.requests : [], ledger });
    const income = new Map(civs.map((civ) => [civ.id, civ.alive === true ? civ.incomeCents : 0]));
    const earned = new Map([...balances].map(([id, balance]) => [id, balance + (income.get(/** @type {number} */ (id))
      || 0)]));
    balances = applyGrants(earned, grantsFor(plan.transfers));
    for (const row of series) row.balances.push(balances.get(row.id) || 0);
    ledger = plan.ledger;
  }
  return series;
}
