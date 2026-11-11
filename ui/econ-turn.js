// econ-turn.js - Economics: the turn context the plan's passes share: the ledger being built, the batch bookkeeping
// and the small verbs that write a transfer, an event or a notice. econ-plan.js builds it; econ-requests.js and
// econ-shortfall.js act on it. Nothing here reads the engine.

import { CITIZENS, heldCents, isWorldAccount, overdraftLimitCents, ratesPct } from "./econ-params.js";
import { isOpen, loanId, makeLoan } from "./econ-loan.js";
import { changeCreditRep, standingPct } from "./econ-credit.js";
import { REPUTATION } from "./econ-params.js";
import { amendsRecord, rateCapPpm } from "./econ-lenders.js";
import { createBatch, lenderBalance, record } from "./econ-batch.js";
import { aiWillLend } from "./econ-ai.js";
import { cloneMarkets, emptyMarkets } from "./econ-markets.js";
import { cloneMacro, emptyMacro, macroReadings } from "./econ-macro-state.js";
import { termsOf } from "./econ-systems.js";
import { citizenCapCents, citizenRatePpm } from "./econ-citizens.js";
import { premiumPct } from "./econ-inflation.js";
import { lenderGate } from "./econ-stake.js";

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
  const civs = holdOverdrafts([...(input.civs || [])].sort(byId), out.ledger);
  const rates = ratesPct(options.rates);
  const macro = input.macro ? cloneMacro(input.macro) : emptyMacro();
  return { turn, age, civs, relations, requests, params, options, out, ledger: out.ledger, rates,
    capPpm: rateCapPpm(age, rates) ?? Infinity, civ: new Map(civs.map((civ) => [civ.id, civ])),
    batch: createBatch(civs), routes: Array.isArray(input.routes) ? input.routes : [],
    markets: input.markets ? cloneMarkets(input.markets) : emptyMarkets(), trade: [], owed: [], macro,
    readings: macroReadings(macro, { civs, turn, options }), basePrices: {}, unmet, distressed: new Set(),
    stakes: new Map(), market: marketOf(input), crisisTerms: new Map(), crisis: null };
}

/**
 * A civ still below zero keeps the largest overdraft it has had since it went under (DESIGN 4.18): sized from its
 * net income alone, the limit shrank as disbanding and cuts closed the deficit, and a civ climbing out was pushed past
 * it (lab W11, 2026-11-10: 480 Gold at -48 a turn, 100 at +12, so -164 read as past the overdraft). Back at 0 or
 * above, the limit follows its income again. A civ a rule already gave an overdraft keeps that one.
 * @param {Civ[]} civs
 * @param {Ledger} ledger
 * @returns {Civ[]}
 */
function holdOverdrafts(civs, ledger) {
  const before = new Map((ledger.lastBatch?.civs || []).map((row) => [row.pid, row.overdraft]));
  return civs.map((civ) => {
    const held = before.get(civ.id);
    if (Number.isInteger(civ.overdraftCents) || !(heldCents(civ) < 0) || !Number.isInteger(held)) return civ;
    return { ...civ, overdraftCents: Math.max(overdraftLimitCents(civ.incomeCents), /** @type {number} */ (held)) };
  });
}

/** This turn's market read, or null without one. @param {PlanInput} input */
const marketOf = (input) => input.market ?? null;

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
 * AI-PLAN 4.4: moves a civ's credit reputation and logs it; a world account has none.
 * @param {TurnContext} ctx
 * @param {Party} pid
 * @param {number} points
 * @param {string} why
 * @param {string} [loanId]
 */
export function repChange(ctx, pid, points, why, loanId) {
  if (isWorldAccount(pid) || !isAlive(ctx, pid)) return;
  const after = changeCreditRep(ctx.ledger, /** @type {number} */ (pid), ctx.turn, points);
  event(ctx, { kind: "credit-rep", pid: /** @type {number} */ (pid), points, why, after, ...(loanId ? { loanId } : {}) });
}
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
 * @param {{ from: Party, to: Party, cents: number, reason: string, parts?: Record<string, number>, label?: string,
 *   labelArgs?: string[] }} spec
 */
export function emit(ctx, loan, spec) {
  if (spec.cents <= 0) return;
  /** @type {Transfer} */
  const transfer = { loanId: loan.id, turn: ctx.turn, from: spec.from, to: spec.to, cents: spec.cents,
    reason: spec.reason, parts: spec.parts || {} };
  if (spec.label) { transfer.label = spec.label; transfer.labelArgs = spec.labelArgs || []; }
  ctx.out.transfers.push(transfer);
  record(ctx.batch, transfer);
}

/**
 * Opens a loan and sends its principal to the borrower, or straight to `payee` when the borrowed Gold is spent the
 * turn it's lent (an AI build loan pays the progress account, as a development loan does).
 * @param {TurnContext} ctx
 * @param {{ lender: Party, borrower: number, principal: number, ratePpm: number, term: number,
 *   source: LoanSource, emergency?: boolean, payee?: Party }} spec
 */
export function openLoan(ctx, spec) {
  const { ledger, turn } = ctx;
  const { lender, borrower, principal, ratePpm, term, source, emergency = false, payee = borrower } = spec;
  const base = makeLoan({ id: loanId(ledger.nextId), lender, borrower, principal, ratePpm, term, turn, source,
    emergency });
  // Any loan from a civ the borrower repudiated, before it's made good, is an amends loan (DESIGN 4.5).
  const wronged = amendsRecord(ledger, borrower, lender, turn);
  const made = wronged ? { ...base, amends: wronged.turn } : base;
  // A Religious lender lends as a partnership (DESIGN 4.17): its interest follows the borrower's income from here.
  const loan = !isWorldAccount(lender) && termsFor(ctx, lender).partnership
    ? { ...made, partnership: true, baseIncome: incomeOf(ctx, borrower) } : made;
  ledger.nextId += 1;
  ledger.loans.push(loan);
  emit(ctx, loan, { from: lender, to: payee, cents: principal, reason: "principal" });
  if (!isWorldAccount(lender)) {
    const id = /** @type {number} */ (lender);
    ctx.batch.committed.set(id, (ctx.batch.committed.get(id) || 0) + principal);
  }
  event(ctx, { kind: "open", loanId: loan.id, lender, borrower, cents: principal, ratePpm, term, source,
    emergency: emergency ? 1 : 0 });
  notice(ctx, borrower, { kind: "open", loanId: loan.id, source, emergency });
  if (!isWorldAccount(lender)) {
    notice(ctx, lender, { kind: "lent", loanId: loan.id });
    repChange(ctx, lender, REPUTATION.lent, "lent", loan.id);
  }
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
  event(ctx, { kind: "closed", loanId: loan.id, borrower: loan.borrower, lender: loan.lender });
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
  const crisis = crisisPcts(ctx, borrower);
  const bondPct = Math.round((own.bondPct * own.borrowPct * crisis.spread * (100 + premiumPct(ctx.readings.piPpm))
    * crisis.bondPct) / 100000000);
  return { ledger: ctx.ledger, borrower, borrowerCiv: civ, age: ctx.age, turn: ctx.turn, rates: ctx.rates,
    standing: standing(ctx, borrower), relations: ctx.relations, options: ctx.options,
    depthFactorPct: civ?.depthFactorPct ?? 100, bondPct,
    civPct: (lender) => Math.round((own.borrowPct * termsFor(ctx, lender).lendPct * crisis.ownRatePct) / 10000),
    civLendersClosed: ctx.readings.panic && !crisis.noFreeze, noBond: own.civLendersOnly,
    citizens: citizensFor(ctx, borrower), unmet: (lender) => haveNotMet(ctx, lender, borrower),
    // AI-PLAN 4.5: an AI lender wants a reputation of 50 and a stake of 0 or more; the human lends as it likes. A
    // lender in a bank run (DESIGN 4.11b) lends to nobody for five turns.
    refuses: (lender) => (ctx.crisis ? ctx.crisis.terms(lender).lendingClosed : false)
      || (ctx.options.ai !== false && ctx.civ.get(lender)?.human !== true && !lenderGate(ctx, lender, borrower)),
    ...extra };
}

/**
 * The crisis terms an offer query folds in (DESIGN 4.11b, 4.11c): deposit insurance floors the civ's spread at 1.0
 * and lifts the Panic freeze; a debased coin, a suspension and the temple's legacy move its rates.
 * @param {TurnContext} ctx
 * @param {number} borrower
 */
function crisisPcts(ctx, borrower) {
  const terms = ctx.crisis ? ctx.crisis.terms(borrower) : null;
  const spreadRead = ctx.readings.civ.get(borrower)?.spreadPct ?? 100;
  if (!terms) return { spread: spreadRead, bondPct: 100, ownRatePct: 100, noFreeze: false };
  return { spread: terms.spreadFloor ? Math.min(100, spreadRead) : spreadRead,
    bondPct: Math.round((terms.ownRatePct * terms.bondPct) / 100), ownRatePct: terms.ownRatePct,
    noFreeze: terms.noFreeze };
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
  return citizensTerms(ctx, civ, { ratePpm, owed });
}

/**
 * The crisis paths (econ-policy.js) move the citizens' cap and rate: Liturgies and Land reform halve the cap, the
 * citizens' republic earned raises it, compromised dears their rate.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {{ ratePpm: number, owed: number }} q
 */
function citizensTerms(ctx, civ, { ratePpm, owed }) {
  const terms = ctx.crisis ? ctx.crisis.terms(civ.id) : null;
  const cap = citizenCapCents({ incomeCents: civ.incomeCents, commerceSettlements: civ.commerceSettlements ?? 0,
    owedCents: 0 });
  const scaled = Math.round((cap * (terms?.citizensCapPct ?? 100)) / 100);
  return { ratePpm: Math.round((ratePpm * (terms?.citizensRatePct ?? 100)) / 100),
    roomCents: Math.max(0, scaled - owed) };
}
