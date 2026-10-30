// econ-turn.js - Economics: the turn context the plan's passes share: the ledger being built, the batch bookkeeping
// and the small verbs that write a transfer, an event or a notice. econ-plan.js builds it; econ-requests.js and
// econ-shortfall.js act on it. Nothing here reads the engine.

import { CITIZENS, isWorldAccount, ratesPct } from "./econ-params.js";
import { isOpen, loanId, makeLoan } from "./econ-loan.js";
import { standingPct } from "./econ-credit.js";
import { rateCapPpm } from "./econ-lenders.js";
import { createBatch, lenderBalance, record } from "./econ-batch.js";
import { aiWillLend } from "./econ-ai.js";
import { cloneMarkets, emptyMarkets } from "./econ-markets.js";
import { cloneMacro, emptyMacro, macroReadings } from "./econ-macro-state.js";
import { termsOf } from "./econ-systems.js";
import { citizenCapCents, citizenRatePpm } from "./econ-citizens.js";
import { premiumPct } from "./econ-inflation.js";

/**
 * @param {Civ} a
 * @param {Civ} b
 */
const byId = (a, b) => a.id - b.id;

/**
 * @param {PlanInput} input
 * @param {PlanOptions} options
 * @param {PlanOutput} out
 * @returns {TurnContext}
 */
export function turnContext(input, options, out) {
  const { turn, age, requests = [], params = {} } = input;
  // The glue sends unmet pairs as rows of their own; the rules read only the met ones, and nobody deals with a civ
  // it hasn't met.
  const relations = (input.relations || []).filter((row) => row.level !== "unmet");
  const unmet = new Set((input.relations || []).filter((row) => row.level === "unmet")
    .map((row) => (row.a < row.b ? `${row.a}:${row.b}` : `${row.b}:${row.a}`)));
  // Civs are held sorted by id so every pass runs in one order whatever order the glue listed them in.
  const civs = [...(input.civs || [])].sort(byId);
  const rates = ratesPct(options.rates);
  const macro = input.macro ? cloneMacro(input.macro) : emptyMacro();
  return { turn, age, civs, relations, requests, params, options, out, ledger: out.ledger, rates,
    capPpm: rateCapPpm(age, rates) ?? Infinity, civ: new Map(civs.map((civ) => [civ.id, civ])),
    batch: createBatch(civs), routes: Array.isArray(input.routes) ? input.routes : [],
    markets: input.markets ? cloneMarkets(input.markets) : emptyMarkets(), trade: [], owed: [], macro,
    readings: macroReadings(macro, { civs, turn, options }), basePrices: {}, unmet };
}

/**
 * Whether two civs haven't met (the glue's unmet rows).
 * @param {TurnContext} ctx
 * @param {Party} a
 * @param {Party} b
 */
export const haveNotMet = (ctx, a, b) => typeof a === "number" && typeof b === "number"
  && ctx.unmet.has(a < b ? `${a}:${b}` : `${b}:${a}`);

/**
 * A civ's system terms this turn (DESIGN 4.17); Mixed for a civ the readings don't hold.
 * @param {TurnContext} ctx
 * @param {Party} pid
 */
export const termsFor = (ctx, pid) => ctx.readings.terms.get(/** @type {number} */ (pid)) || termsOf("mixed");

/**
 * @param {TurnContext} ctx
 * @param {Party} pid
 */
export const isAlive = (ctx, pid) => isWorldAccount(pid) || ctx.civ.get(/** @type {number} */ (pid))?.alive === true;
/**
 * @param {TurnContext} ctx
 * @param {Party} pid
 */
export const isHuman = (ctx, pid) => ctx.civ.get(/** @type {number} */ (pid))?.human === true;
/**
 * @param {TurnContext} ctx
 * @param {number} pid
 */
export const standing = (ctx, pid) => standingPct(ctx.ledger, pid, ctx.turn);
/**
 * @param {TurnContext} ctx
 * @param {Party} pid
 */
export const incomeOf = (ctx, pid) => ctx.civ.get(/** @type {number} */ (pid))?.incomeCents || 0;

/**
 * @param {TurnContext} ctx
 * @param {Omit<LedgerEvent, "turn">} fields
 */
export function event(ctx, fields) {
  const row = /** @type {LedgerEvent} */ ({ turn: ctx.turn, ...fields });
  ctx.out.events.push(row);
  ctx.ledger.events.push(row);
}

/**
 * @param {TurnContext} ctx
 * @param {Party} pid
 * @param {Omit<Notice, "pid">} fields
 */
export function notice(ctx, pid, fields) {
  if (isHuman(ctx, pid)) ctx.out.notices.push(/** @type {Notice} */ ({ pid, ...fields }));
}

/**
 * One loan's movement of Gold this turn.
 * @param {TurnContext} ctx
 * @param {{ id: string }} loan
 * @param {{ from: Party, to: Party, cents: number, reason: string, parts?: Record<string, number> }} spec
 */
export function emit(ctx, loan, spec) {
  if (spec.cents <= 0) return;
  /** @type {Transfer} */
  const transfer = { loanId: loan.id, turn: ctx.turn, from: spec.from, to: spec.to, cents: spec.cents,
    reason: spec.reason, parts: spec.parts || {} };
  ctx.out.transfers.push(transfer);
  record(ctx.batch, transfer);
}

/**
 * @param {TurnContext} ctx
 * @param {{ lender: Party, borrower: number, principal: number, ratePpm: number, term: number,
 *   source: LoanSource, emergency?: boolean }} spec
 */
export function openLoan(ctx, spec) {
  const { ledger, turn } = ctx;
  const { lender, borrower, principal, ratePpm, term, source, emergency = false } = spec;
  const made = makeLoan({ id: loanId(ledger.nextId), lender, borrower, principal, ratePpm, term, turn, source,
    emergency });
  // A Religious lender lends as a partnership (DESIGN 4.17): its interest follows the borrower's income from here.
  const loan = !isWorldAccount(lender) && termsFor(ctx, lender).partnership
    ? { ...made, partnership: true, baseIncome: incomeOf(ctx, borrower) } : made;
  ledger.nextId += 1;
  ledger.loans.push(loan);
  emit(ctx, loan, { from: lender, to: borrower, cents: principal, reason: "principal" });
  if (!isWorldAccount(lender)) {
    const id = /** @type {number} */ (lender);
    ctx.batch.committed.set(id, (ctx.batch.committed.get(id) || 0) + principal);
  }
  event(ctx, { kind: "open", loanId: loan.id, lender, borrower, cents: principal, ratePpm, term, source,
    emergency: emergency ? 1 : 0 });
  notice(ctx, borrower, { kind: "open", loanId: loan.id, source, emergency });
  if (!isWorldAccount(lender)) notice(ctx, lender, { kind: "lent", loanId: loan.id });
  return loan;
}

/**
 * @param {TurnContext} ctx
 * @param {Loan} loan
 */
export function replaceLoan(ctx, loan) {
  ctx.ledger.loans[ctx.ledger.loans.findIndex((row) => row.id === loan.id)] = loan;
  return loan;
}

/**
 * @param {TurnContext} ctx
 * @param {Loan} loan
 */
export function closeLoan(ctx, loan) {
  replaceLoan(ctx, { ...loan, state: "closed", closedTurn: ctx.turn });
  event(ctx, { kind: "closed", loanId: loan.id });
}

/**
 * Live civs other than the borrower that pass `filter`, with the balance the 2 * P test reads.
 * @param {TurnContext} ctx
 * @param {number} borrower
 * @param {(civ: Civ) => boolean} filter
 * @returns {LenderView[]}
 */
export function lendersFor(ctx, borrower, filter) {
  return ctx.civs
    .filter((civ) => civ.alive === true && civ.id !== borrower && filter(civ))
    .map((civ) => ({ id: civ.id, balanceCents: lenderBalance(ctx.batch, civ.id), stages: civ.stages,
      depthTurns: civ.depthTurns }));
}

/**
 * AI civs willing to lend by DESIGN 6; the human never lends by rule (NOTES choice 13).
 * @param {TurnContext} ctx
 * @param {number} borrower
 */
export function aiLendersFor(ctx, borrower) {
  return lendersFor(ctx, borrower, (civ) => civ.human !== true
    && aiWillLend({ balanceCents: lenderBalance(ctx.batch, civ.id), incomeCents: civ.incomeCents }));
}

/**
 * The common arguments every offer query takes for this borrower.
 * @param {TurnContext} ctx
 * @param {number} borrower
 * @param {Partial<OfferQuery>} [extra]
 * @returns {OfferQuery}
 */
export function offerQuery(ctx, borrower, extra = {}) {
  const civ = ctx.civ.get(borrower);
  const own = termsFor(ctx, borrower);
  const spread = ctx.readings.civ.get(borrower)?.spreadPct ?? 100;
  const bondPct = Math.round((own.bondPct * own.borrowPct * spread * (100 + premiumPct(ctx.readings.piPpm)))
    / 1000000);
  return { ledger: ctx.ledger, borrower, borrowerCiv: civ, age: ctx.age, turn: ctx.turn, rates: ctx.rates,
    standing: standing(ctx, borrower), relations: ctx.relations, options: ctx.options,
    depthFactorPct: civ?.depthFactorPct ?? 100, bondPct,
    civPct: (lender) => Math.round((own.borrowPct * termsFor(ctx, lender).lendPct) / 100),
    civLendersClosed: ctx.readings.panic, noBond: own.civLendersOnly, citizens: citizensFor(ctx, borrower),
    unmet: (lender) => haveNotMet(ctx, lender, borrower),
    ...extra };
}

/**
 * What a civ owes one lender on its open loans.
 * @param {TurnContext} ctx
 * @param {number} pid
 * @param {Party} lender
 */
export function owedTo(ctx, pid, lender) {
  let sum = 0;
  for (const loan of ctx.ledger.loans) {
    if (loan.borrower === pid && loan.lender === lender && isOpen(loan)) sum += loan.outstanding;
  }
  return sum;
}

/**
 * What a Civic market civ's citizens would lend it this turn and at what rate (DESIGN 4.17); null for any other
 * system or with Loans off.
 * @param {TurnContext} ctx
 * @param {number} pid
 */
export function citizensFor(ctx, pid) {
  const civ = ctx.civ.get(pid);
  if (!civ || !ctx.options.loans || !termsFor(ctx, pid).citizens) return null;
  const owed = owedTo(ctx, pid, CITIZENS);
  const ratePpm = citizenRatePpm({ age: ctx.age, standing: standing(ctx, pid), rates: ctx.rates,
    depthFactorPct: civ.depthFactorPct ?? 100 });
  if (ratePpm === null) return null;
  return { ratePpm, roomCents: citizenCapCents({ incomeCents: civ.incomeCents,
    commerceSettlements: civ.commerceSettlements ?? 0, owedCents: owed }) };
}
