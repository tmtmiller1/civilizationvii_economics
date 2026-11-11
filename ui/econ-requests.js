// econ-requests.js - Economics: the player's requests for the turn (DESIGN 5): borrow, repay, lend, restructure,
// repudiate, the tax level when the script fallback is on, and from 1.1 the tariff, investments and aid, and the
// answer to an AI's investment offer. Each runs in step 2 of the batch (DESIGN 4.14) and a
// refusal is an event with its reason, never a throw.

import { BOND, CITIZENS, LIMITS, SHORT_TERM, TERMS, isWorldAccount } from "./econ-params.js";
import { citizenRepudiation, servicePrincipalCents } from "./econ-citizens.js";
import { firstPayment, isOpen, restructure } from "./econ-loan.js";
import { addMiss, creditCap, fitsService, outstandingOf, repTurnsLost, serviceCap, serviceOf }
  from "./econ-credit.js";
import { REPUTATION } from "./econ-params.js";
import { bondRatePpm, civLenderRefusal, offersFor, relationLevel, termRefusal } from "./econ-lenders.js";
import { aiAccepts } from "./econ-ai.js";
import { funds, lenderBalance } from "./econ-batch.js";
import { distressOf } from "./econ-distress.js";
import { repudiate } from "./econ-repudiation.js";
import { declareBankruptcy } from "./econ-bankruptcy.js";
import { respondRequest } from "./econ-crisis-respond.js";
import { policyRequest } from "./econ-policy.js";
import { canChangeTax, isTaxLevel } from "./econ-tax.js";
import { canChangeTariff, isTariffLevel, withTariff } from "./econ-trade.js";
import { hasStage } from "./econ-stages.js";
import { investRequestRefusal, offerAnswerRefusal } from "./econ-invest-open.js";
import { haveNotMet, isAlive, event, incomeOf, isHuman, lendersFor, notice, offerQuery, openLoan, repChange,
  replaceLoan, standing, termsFor } from "./econ-turn.js";

// A request as the glue hands it over: the fields each kind carries are read where the kind is handled.
/** @typedef {Record<string, any>} Request */

/**
 * @param {TurnContext} ctx
 * @param {number} pid
 */
export function isAtLoanLimit(ctx, pid) {
  return ctx.ledger.loans.filter((loan) => loan.borrower === pid && isOpen(loan)).length >= LIMITS.openPerBorrower;
}

/**
 * @param {TurnContext} ctx
 * @param {number} pid
 */
export function creditRoom(ctx, pid) {
  const civ = /** @type {Civ} */ (ctx.civ.get(pid));
  const terms = termsFor(ctx, pid);
  // A chartered company and lending to the crown add turns; deposit insurance and bank failures take them
  // (DESIGN 4.11c).
  const crisis = ctx.crisis ? ctx.crisis.terms(pid) : null;
  return creditCap({ incomeCents: civ.incomeCents, outstandingCents: outstandingOf(ctx.ledger, pid),
    depthTurns: Math.floor(((civ.depthTurns ?? 0) * (crisis?.capDepthPct ?? 100)) / 100),
    lostTurns: repTurnsLost(standing(ctx, pid)), systemTurns: terms.creditTurns + (crisis?.capTurns ?? 0),
    systemPct: terms.creditPct });
}

/**
 * DESIGN 4.2: both tests for a standard loan of P over `term` at `ratePpm`, or null when it fits.
 * @param {TurnContext} ctx
 * @param {number} pid
 * @param {{ principal: number, ratePpm: number, term: number }} q
 */
export function limitRefusal(ctx, pid, { principal, ratePpm, term }) {
  if (principal > creditRoom(ctx, pid)) return "credit-cap";
  const ok = fitsService({ serviceCents: serviceOf(ctx.ledger, pid), incomeCents: incomeOf(ctx, pid),
    firstPaymentCents: firstPayment(principal, ratePpm, term) });
  return ok ? null : "service-cap";
}

/**
 * The most a civ may borrow from one lender over `term` at `ratePpm` (DESIGN 4.2), in whole Gold: within its credit
 * limit, with the first payment inside the debt-service limit, and from a civ lender no more than half what it holds.
 * The player's refusal names it, and the AI's build loans are sized by it.
 * @param {TurnContext} ctx
 * @param {number} pid
 * @param {{ lender: Party, ratePpm: number, term: number }} q
 */
export function mostBorrowCents(ctx, pid, { lender, ratePpm, term }) {
  let cap = creditRoom(ctx, pid);
  if (!isWorldAccount(lender)) {
    cap = Math.min(cap, Math.floor(lenderBalance(ctx.batch, /** @type {number} */ (lender)) / 2));
  }
  const room = serviceCap(incomeOf(ctx, pid)) - serviceOf(ctx.ledger, pid);
  // The service estimate is a little short of the limit; whole Gold steps find the exact most either way.
  const fits = (/** @type {number} */ cents) => cents <= cap && !limitRefusal(ctx, pid, { principal: cents, ratePpm,
    term });
  let most = Math.floor(Math.max(0, Math.min(cap, servicePrincipalCents({ roomCents: room, ratePpm, term }))) / 100)
    * 100;
  while (most > 0 && !fits(most)) most -= 100;
  for (let step = 0; step < 20 && fits(most + 100); step += 1) most += 100;
  return most;
}

/**
 * @param {unknown} term
 * @param {unknown} principal
 */
const hasBadTerms = (term, principal) => !TERMS.includes(/** @type {number} */ (term)) || !Number.isInteger(principal)
  || /** @type {number} */ (principal) <= 0;

/**
 * @param {TurnContext} ctx
 * @param {string} request
 * @param {Record<string, string | number | undefined>} who
 * @param {string | null | { reason: string, fields: Record<string, string | number> }} refusal
 */
function refuse(ctx, request, who, refusal) {
  if (!refusal) return;
  if (typeof refusal === "string") event(ctx, { kind: "refused", request, ...who, reason: refusal });
  else event(ctx, { kind: "refused", request, ...who, reason: refusal.reason, ...refusal.fields });
}

/**
 * Early repayments ride on the turn's payment; a repay for an unknown, closed or same-turn loan is ignored.
 * @param {TurnContext} ctx
 * @param {Map<string, number>} extras
 * @param {Request} request
 */
function addExtra(ctx, extras, request) {
  const loan = ctx.ledger.loans.find((row) => row.id === request.loanId);
  if (!loan || !isOpen(loan) || loan.opened === ctx.turn || !(request.cents > 0)) return;
  extras.set(loan.id, (extras.get(loan.id) || 0) + Math.floor(request.cents));
}

/**
 * A repudiation's rows on the game's ledgers: the lender's grudge and hit, and the named note every other major books.
 * @param {TurnContext} ctx
 * @param {number} borrower
 * @param {{ grievances: GrievanceRow[], relationships: RelationshipRow[], note: number }} result
 */
function bookRepudiation(ctx, borrower, result) {
  ctx.out.grievances.push(...result.grievances.filter((row) => row.amount > 0));
  ctx.out.relationships.push(...result.relationships);
  if (result.note > 0) (ctx.out.notes ||= []).push({ pid: borrower, line: "REPUDIATED", amount: result.note });
}

/**
 * @param {TurnContext} ctx
 * @param {Request} request
 */
function borrowRefusal(ctx, { borrower, lender, principal, term }) {
  if (!ctx.options.loans) return "loans-off";
  if (!isAlive(ctx, borrower) || isWorldAccount(borrower)) return "borrower";
  if (hasBadTerms(term, principal)) return "terms";
  if (isAtLoanLimit(ctx, borrower)) return "loan-limit";
  if (lender !== BOND && !isAlive(ctx, lender)) return "lender";
  const lenders = lendersFor(ctx, borrower, (civ) => civ.id === lender);
  const query = offerQuery(ctx, borrower, { principal, term, lenders });
  const offer = offersFor(query).find((row) => row.lender === lender);
  if (!offer) return noOfferReason(ctx, query, lender);
  const limit = limitRefusal(ctx, borrower, { principal, ratePpm: offer.ratePpm, term });
  // Over a limit: the refusal says the most this lender would lend over this term, for "Borrow that instead".
  if (limit) {
    return { reason: limit, fields: { lender, term, most: mostBorrowCents(ctx, borrower, { lender,
      ratePpm: offer.ratePpm, term }) } };
  }
  openLoan(ctx, { lender, borrower, principal, ratePpm: offer.ratePpm, term, source: "borrow" });
  return null;
}

/**
 * Names the term gate only where the lender would lend at 10 turns; otherwise it's the lender that says no.
 * @param {TurnContext} ctx
 * @param {OfferQuery} query
 * @param {Party} lender
 */
function noOfferReason(ctx, query, lender) {
  const atShort = offersFor({ ...query, term: SHORT_TERM }).some((offer) => offer.lender === lender);
  if (!atShort) return "no-offer";
  return termRefusal({ ledger: ctx.ledger, borrower: query.borrower, borrowerCiv: query.borrowerCiv,
    lenderCiv: query.lenders?.[0], term: /** @type {number} */ (query.term), turn: ctx.turn,
    options: ctx.options }) || "no-offer";
}

/**
 * @param {TurnContext} ctx
 * @param {Request} request
 */
function lendPartiesRefusal(ctx, { lender, borrower }) {
  if (!isHuman(ctx, lender) || !isAlive(ctx, lender) || !isAlive(ctx, borrower) || isHuman(ctx, borrower)) {
    return "parties";
  }
  if (haveNotMet(ctx, lender, borrower)) return "unmet";
  return ctx.options.ai ? null : "ai-off";
}

/**
 * @param {TurnContext} ctx
 * @param {Request} request
 */
function lendTermsRefusal(ctx, { lender, borrower, principal, ratePpm, term }) {
  if (hasBadTerms(term, principal) || !Number.isInteger(ratePpm) || ratePpm <= 0) return "terms";
  if (funds(ctx.batch, lender) < principal) return "balance";
  if (isAtLoanLimit(ctx, borrower)) return "loan-limit";
  const level = relationLevel(ctx.relations, lender, borrower);
  const base = { ledger: ctx.ledger, lender, borrower, principal: 0, balanceCents: 0, level, turn: ctx.turn };
  return civLenderRefusal(base) || termRefusal({ ledger: ctx.ledger, borrower, borrowerCiv: ctx.civ.get(borrower),
    lenderCiv: ctx.civ.get(lender), term, turn: ctx.turn, options: ctx.options });
}

/**
 * DESIGN 5, AI-PLAN 4.1: the AI accepts a cheap enough loan when its dues pass its funds (the distress read), its
 * income is positive and the loan fits its credit cap; a loan no bigger than the gap meets payments already inside
 * the service figure, so it skips the debt-service limit, as the refinancing rule does.
 * @param {TurnContext} ctx
 * @param {Request} request
 */
function lendRefusal(ctx, request) {
  if (!ctx.options.loans) return "loans-off";
  const refused = lendPartiesRefusal(ctx, request) || lendTermsRefusal(ctx, request);
  if (refused) return refused;
  const borrower = /** @type {Civ} */ (ctx.civ.get(request.borrower));
  const bond = bondRatePpm({ age: ctx.age, standing: standing(ctx, request.borrower), rates: ctx.rates,
    depthFactorPct: borrower.depthFactorPct ?? 100 });
  const read = distressOf(ctx, request.borrower);
  const limit = limitRefusal(ctx, request.borrower, { principal: request.principal, ratePpm: request.ratePpm,
    term: request.term });
  const accepts = aiAccepts({ offerRatePpm: request.ratePpm, bondRatePpm: bond,
    incomeCents: incomeOf(ctx, request.borrower), shortfallCents: read.gap,
    fitsCredit: limit !== "credit-cap", fitsService: request.principal <= read.gap || limit !== "service-cap" });
  if (!accepts) return "declined";
  openLoan(ctx, { lender: request.lender, borrower: request.borrower, principal: request.principal,
    ratePpm: request.ratePpm, term: request.term, source: "lend" });
  return null;
}

/**
 * DESIGN 4.4, AI-PLAN 4.3: once per loan, any active loan (from no misses on), borrower income above 0; the borrower
 * or a human lender can ask.
 * @param {TurnContext} ctx
 * @param {Loan | undefined} loan
 * @param {unknown} by
 */
export function restructureLoan(ctx, loan, by) {
  if (!loan || loan.state !== "active") return "not-active";
  if (loan.restructured) return "restructured";
  if (!(incomeOf(ctx, loan.borrower) > 0)) return "income";
  if (by !== loan.borrower && by !== loan.lender) return "parties";
  replaceLoan(ctx, restructure(loan));
  addMiss(ctx.ledger, loan.borrower, ctx.turn);
  event(ctx, { kind: "restructure", loanId: loan.id, borrower: loan.borrower, lender: loan.lender,
    cents: loan.outstanding });
  repChange(ctx, loan.borrower, -REPUTATION.miss, "restructure", loan.id);
  notice(ctx, loan.borrower, { kind: "restructure", loanId: loan.id });
  if (!isWorldAccount(loan.lender)) notice(ctx, loan.lender, { kind: "restructure", loanId: loan.id });
  return null;
}

/**
 * The other living civs a repudiator has met (NOTES choice 29).
 * @param {TurnContext} ctx
 * @param {number} borrower
 */
function witnessesOf(ctx, borrower) {
  /** @type {Set<number>} */
  const met = new Set();
  for (const row of ctx.relations) {
    if (row.a === borrower && isAlive(ctx, row.b)) met.add(row.b);
    if (row.b === borrower && isAlive(ctx, row.a)) met.add(row.a);
  }
  return [...met];
}

/**
 * DESIGN 4.5: the player repudiates what it owes one lender; AI lenders' income sizes the grudge. Repudiating the
 * citizens (DESIGN 4.17) has no lender abroad and no witnesses who care: its cost is at home, the meter's 10 turns,
 * and standing at the 0.15 of a repudiation abroad lenders read lightly.
 * @param {TurnContext} ctx
 * @param {number} borrower
 * @param {Party} lender
 */
export function repudiateFor(ctx, borrower, lender) {
  const level = relationLevel(ctx.relations, borrower, lender);
  const home = lender === CITIZENS;
  const result = repudiate({ ledger: ctx.ledger, turn: ctx.turn, borrower, lender,
    lenderIncomeCents: incomeOf(ctx, lender), atWar: home || level === "war",
    witnesses: home ? [] : witnessesOf(ctx, borrower) });
  if (!result) return "nothing-owed";
  if (home) citizenRepudiation(ctx, borrower);
  Object.assign(ctx.ledger, { loans: result.ledger.loans, blocks: result.ledger.blocks,
    repudiations: result.ledger.repudiations, investments: result.ledger.investments });
  repChange(ctx, borrower, -(result.record.atWar ? REPUTATION.repudiationAtWar : REPUTATION.repudiation),
    "repudiation");
  bookRepudiation(ctx, borrower, result);
  event(ctx, { kind: "repudiation", borrower, lender, cents: result.writtenOff, loans: result.loanIds.length,
    grievances: (result.grievances[0]?.amount ?? 0) + result.note, chronicle: 1 });
  notice(ctx, borrower, { kind: "repudiated", lender, cents: result.writtenOff });
  if (!isWorldAccount(lender)) notice(ctx, lender, { kind: "repudiated-by", borrower, cents: result.writtenOff });
  return null;
}

/**
 * @param {TurnContext} ctx
 * @param {Request} request
 */
function repudiateRefusal(ctx, { borrower, lender }) {
  if (!isHuman(ctx, borrower) || !isAlive(ctx, borrower)) return "parties";
  if (!isWorldAccount(lender) && !isAlive(ctx, lender)) return "lender";
  return repudiateFor(ctx, borrower, lender);
}

/**
 * The script fallback's tax level, one change per 5 turns (DESIGN 4.7).
 * @param {TurnContext} ctx
 * @param {Request} request
 */
function taxRefusal(ctx, { pid, level }) {
  if (!ctx.options.taxFallback) return "taxes-native";
  if (!isHuman(ctx, pid) || !isTaxLevel(level)) return "parties";
  const row = ctx.ledger.taxes.find((tax) => tax.pid === pid);
  if (!canChangeTax(row?.changedTurn, ctx.turn)) return "too-soon";
  if (row) Object.assign(row, { level, changedTurn: ctx.turn });
  else ctx.ledger.taxes.push({ pid, level, changedTurn: ctx.turn });
  return null;
}

/**
 * The player's tariff (DESIGN 4.10): option on, past the Tariffs stage, one change per 5 turns.
 * @param {TurnContext} ctx
 * @param {Request} request
 */
function tariffRefusal(ctx, { pid, level }) {
  if (!ctx.options.markets || !ctx.options.tariffs) return "tariffs-off";
  if (!isHuman(ctx, pid) || !isTariffLevel(level)) return "parties";
  if (!hasStage(ctx.civ.get(pid), "tariffs", ctx.turn, ctx.options)) return "tariff-stage";
  const late = tariffTiming(ctx, pid, level);
  if (late) return late;
  ctx.markets.tariffs = withTariff(ctx.markets.tariffs, pid, level, ctx.turn);
  event(ctx, { kind: "tariff", pid, level });
  return null;
}

/**
 * One change per 5 turns, and Debt into shares' claim (econ-policy.js): no tariff above Low while the company holds
 * it.
 * @param {TurnContext} ctx
 * @param {unknown} pid
 * @param {unknown} level
 */
function tariffTiming(ctx, pid, level) {
  const row = ctx.markets.tariffs.find((tariff) => tariff.pid === pid);
  if (!canChangeTariff(row?.changedTurn, ctx.turn)) return "too-soon";
  if (level === "high" && ctx.crisis?.terms(/** @type {number} */ (pid)).tariffCeilingLow) return "tariff-ceiling";
  return null;
}

/** @type {Record<string, (ctx: TurnContext, request: Request) => void>} */
const HANDLERS = {
  borrow: (ctx, request) => refuse(ctx, "borrow", { borrower: request.borrower }, borrowRefusal(ctx, request)),
  lend: (ctx, request) => refuse(ctx, "lend", { lender: request.lender }, lendRefusal(ctx, request)),
  restructure: (ctx, request) => refuse(ctx, "restructure", { loanId: request.loanId },
    restructureLoan(ctx, ctx.ledger.loans.find((loan) => loan.id === request.loanId), request.pid)),
  repudiate: (ctx, request) => refuse(ctx, "repudiate", { borrower: request.borrower }, repudiateRefusal(ctx, request)),
  bankrupt: (ctx, request) => refuse(ctx, "bankrupt", { pid: request.pid },
    isHuman(ctx, request.pid) ? declareBankruptcy(ctx, request.pid, repudiateFor) : "parties"),
  tax: (ctx, request) => refuse(ctx, "tax", { pid: request.pid }, taxRefusal(ctx, request)),
  tariff: (ctx, request) => refuse(ctx, "tariff", { pid: request.pid }, tariffRefusal(ctx, request)),
  invest: (ctx, request) => refuse(ctx, "invest", { lender: request.investor }, investRequestRefusal(ctx, request)),
  "accept-offer": (ctx, request) => refuse(ctx, "accept-offer", { offerId: request.offerId },
    offerAnswerRefusal(ctx, request, true)),
  "decline-offer": (ctx, request) => refuse(ctx, "decline-offer", { offerId: request.offerId },
    offerAnswerRefusal(ctx, request, false)),
  respond: (ctx, request) => refuse(ctx, "respond", { pid: request.pid },
    respondRequest(ctx, /** @type {PlanRequest} */ (request))),
  policy: (ctx, request) => refuse(ctx, "policy", { pid: request.pid },
    policyRequest(ctx, /** @type {PlanRequest} */ (request))),
};

/**
 * Runs the turn's requests in the order given; returns the early repayments keyed by loan id.
 * @param {TurnContext} ctx
 */
export function runRequests(ctx) {
  /** @type {Map<string, number>} */
  const extras = new Map();
  for (const request of ctx.requests) {
    if (!request || typeof request !== "object") continue;
    if (request.kind === "repay") addExtra(ctx, extras, request);
    else if (Object.hasOwn(HANDLERS, request.kind)) HANDLERS[request.kind](ctx, request);
  }
  return extras;
}
