// econ-view-model.js - Economics: the numbers the three tabs show (DESIGN 5, 9), computed from the same plan input
// the turn batch gets, so what the player sees is what the next batch will do. Plain data in, plain data out; the
// screen draws it and the glue supplies names and the engine's reads. Nothing here reads the engine.

import { MID_TERM, SHORT_TERM, TERMS } from "./econ-params.js";
import { firstPayment, isOpen, paymentDue, restructure, totalInterest } from "./econ-loan.js";
import { emergencyOutstandingOf, outstandingOf, repTurnsLost, serviceCap, serviceOf, standingPct }
  from "./econ-credit.js";
import { maxTerm, offersFor, relationLevel } from "./econ-lenders.js";
import { emergencyCap, isInsolvent } from "./econ-guard.js";
import { grudgeFor, lenderHit, witnessDelta } from "./econ-repudiation.js";
import { aiWillLend, repudiationThreshold } from "./econ-ai.js";
import { hasStage } from "./econ-stages.js";
import { DEFAULT_OPTIONS, projectBalances } from "./econ-plan.js";
import { citizensFor, lendersFor, offerQuery, turnContext } from "./econ-turn.js";
import { tabFacts, tabRules } from "./econ-view-tabs.js";
import { creditRoom, limitRefusal, mostBorrowCents } from "./econ-requests.js";
import { REPUDIATION, REPUTATION, STANDING } from "./econ-params.js";
import { emptyLedger } from "./econ-state.js";
import { emptyMarkets } from "./econ-markets.js";
import { emptyMacro } from "./econ-macro-state.js";
import { escrowOf } from "./econ-escrow.js";
import { reserveOf } from "./econ-distress.js";

/**
 * A turn context for reading offers and limits without planning anything.
 * @param {PlanInput} input
 */
export function viewContext(input) {
  const options = { ...DEFAULT_OPTIONS, ...(input.options || {}) };
  /** @type {PlanOutput} */
  const out = { ledger: input.ledger || emptyLedger(), transfers: [], influence: [], celebration: [], grievances: [],
    relationships: [], events: [], notices: [], batch: null, skipped: null, markets: emptyMarkets(), progress: [],
    trade: [], macro: input.macro || emptyMacro(), aiPreferences: [], favors: [], stakes: {} };
  return turnContext(input, options, out);
}

/**
 * Next turn's scheduled payments over a civ's active loans, and what the garnish on its defaults would take at most.
 * @param {Ledger} ledger
 * @param {number} pid
 */
export function dueNext(ledger, pid) {
  let scheduled = 0;
  for (const loan of ledger.loans) {
    if (loan.borrower === pid && loan.state === "active") scheduled += paymentDue(loan).total;
  }
  return scheduled;
}

/**
 * The share of income the scheduled payments take, as a whole percentage; 100 when there's no income to pay from.
 * @param {number} serviceCents
 * @param {number} incomeCents
 */
export function servicePct(serviceCents, incomeCents) {
  if (incomeCents > 0) return Math.round((100 * serviceCents) / incomeCents);
  return serviceCents > 0 ? 100 : 0;
}

/**
 * The Treasury tab: balance, income, what's due, the service share and the 20-turn projection with and without
 * the civ's loans (income held flat).
 * @param {PlanInput} input
 * @param {number} pid
 */
export function treasuryView(input, pid) {
  const ledger = input.ledger || emptyLedger();
  const civ = input.civs.find((row) => row.id === pid) || { id: pid, balanceCents: 0, incomeCents: 0, upkeepCents: 0 };
  const { balanceCents, incomeCents } = civ;
  const service = serviceOf(ledger, pid);
  const withLoans = projectBalances(input, 20).find((row) => row.id === pid)?.balances || [];
  const without = Array.from({ length: 20 }, (_, k) => balanceCents + incomeCents * (k + 1));
  const lowTurns = ledger.lowIncome.find((row) => row.pid === pid)?.turns || 0;
  return { balanceCents, incomeCents, upkeepCents: civ.upkeepCents || 0, dueNextCents: dueNext(ledger, pid),
    serviceCents: service, servicePct: servicePct(service, incomeCents), outstandingCents: outstandingOf(ledger, pid),
    projection: { withLoans, without }, insolvent: isInsolvent(lowTurns), escrowCents: escrowOf(ledger, pid) };
}

/**
 * Every standard offer open to the player for `principal` over `term`, with the payment it would charge, the share of
 * income the civ's payments would take with it (DESIGN 5), and why it would be refused, if it would. Lenders are
 * every other living civ; the model decides who offers.
 * @param {PlanInput} input
 * @param {number} pid
 * @param {number} principal
 * @param {number} term
 */
export function loanOffers(input, pid, principal, term) {
  const ctx = viewContext(input);
  if (!ctx.civ.get(pid)) return [];
  const lenders = lendersFor(ctx, pid, () => true);
  const offers = offersFor(offerQuery(ctx, pid, { principal, term, lenders }));
  const serviceNow = serviceOf(ctx.ledger, pid);
  const income = ctx.civ.get(pid)?.incomeCents || 0;
  return offers.map((offer) => {
    const paymentCents = firstPayment(principal, offer.ratePpm, term);
    const refusal = limitRefusal(ctx, pid, { principal, ratePpm: offer.ratePpm, term });
    return { lender: offer.lender, ratePpm: offer.ratePpm, paymentCents,
      interestCents: totalInterest(principal, offer.ratePpm, term),
      servicePctAfter: servicePct(serviceNow + paymentCents, income), refusal,
      mostCents: refusal ? mostBorrowCents(ctx, pid, { lender: offer.lender, ratePpm: offer.ratePpm, term }) : null };
  });
}

/**
 * The terms a borrower may take today: 10 always, 20 from Moneylending, 30 from Public debt, and only 10 while a
 * repudiation counts.
 * @param {PlanInput} input
 * @param {number} pid
 */
export function termsOpen(input, pid) {
  const ledger = input.ledger || emptyLedger();
  const civ = input.civs.find((row) => row.id === pid);
  const staged = hasStage(civ, "publicDebt", input.turn, input.options) ? Infinity
    : hasStage(civ, "moneylending", input.turn, input.options) ? MID_TERM : SHORT_TERM;
  const longest = Math.min(maxTerm(ledger, pid, input.turn), staged);
  return TERMS.filter((term) => term <= longest);
}

/**
 * @param {Loan} loan
 * @param {number} turn
 */
function loanRow(loan, turn) {
  const due = loan.state === "active" ? paymentDue(loan) : { interest: 0, amortisation: 0, total: 0 };
  return { id: loan.id, lender: loan.lender, borrower: loan.borrower, principal: loan.principal,
    outstanding: loan.outstanding, ratePpm: loan.ratePpm, term: loan.term, paid: loan.paid, missed: loan.missed,
    state: loan.state, emergency: loan.emergency, restructured: loan.restructured, opened: loan.opened,
    turnsLeft: Math.max(0, loan.term - loan.paid), paymentCents: due.total, age: turn - loan.opened,
    overdue: loan.state === "active" && loan.missed >= 1 };
}

/**
 * The Loans tab: the player's loans (overdue first), what it has lent, its limits, standing and the guard allowance.
 * @param {PlanInput} input
 * @param {number} pid
 */
export function loansView(input, pid) {
  const ctx = viewContext(input);
  const ledger = ctx.ledger;
  const civ = ctx.civ.get(pid);
  const rows = (/** @type {(loan: Loan) => boolean} */ filter) => ledger.loans
    .filter((loan) => isOpen(loan) && filter(loan)).map((loan) => loanRow(loan, input.turn));
  const troubled = (/** @type {ReturnType<typeof loanRow>} */ row) => Number(row.overdue || row.state === "default");
  const mine = rows((loan) => loan.borrower === pid).sort((a, b) => troubled(b) - troubled(a) || a.opened - b.opened);
  const lent = rows((loan) => loan.lender === pid);
  const income = civ?.incomeCents || 0;
  const reserve = civ ? reserveOf(ctx, pid) : { reserveCents: 0, aboveCents: 0, ahead: [] };
  return { mine, lent, creditRoomCents: civ ? creditRoom(ctx, pid) : 0, serviceCapCents: serviceCap(income),
    reserveCents: reserve.reserveCents, aboveReserveCents: reserve.aboveCents, ahead: reserve.ahead,
    serviceCents: serviceOf(ledger, pid), standingPct: standingPct(ledger, pid, input.turn),
    emergencyOpenCents: emergencyOutstandingOf(ledger, pid), emergencyCapCents: emergencyCap(income),
    stages: { moneylending: hasStage(civ, "moneylending", input.turn, input.options),
      publicDebt: hasStage(civ, "publicDebt", input.turn, input.options) },
    blocks: ledger.blocks.filter((block) => block.borrower === pid) };
}

/**
 * What a repudiation of `lender` would do, for the confirmation (DESIGN 4.5, 5): the Gold kept, the grudge, who
 * loses relationship and by how much, the standing afterwards, and how long the lender closes.
 * @param {PlanInput} input
 * @param {number} pid
 * @param {Party} lender
 */
export function repudiationPreview(input, pid, lender) {
  const ctx = viewContext(input);
  const owed = ctx.ledger.loans.filter((loan) => loan.borrower === pid && loan.lender === lender && isOpen(loan));
  const keptCents = owed.reduce((sum, loan) => sum + loan.outstanding, 0);
  const worldLender = typeof lender === "string";
  const atWar = !worldLender && relationLevel(ctx.relations, pid, lender) === "war";
  const witnesses = ctx.civs.filter((civ) => civ.alive && civ.id !== pid && civ.id !== lender
    && ctx.relations.some((row) => (row.a === pid && row.b === civ.id) || (row.b === pid && row.a === civ.id)));
  const lenderIncome = worldLender ? 0 : ctx.civ.get(/** @type {number} */ (lender))?.incomeCents || 0;
  const now = standingPct(ctx.ledger, pid, input.turn);
  const cost = atWar ? REPUTATION.repudiationAtWar : REPUTATION.repudiation;
  const after = Math.max(STANDING.floor, now - cost);
  const grudge = worldLender ? 0 : grudgeFor(keptCents, lenderIncome);
  return { keptCents, loans: owed.length, grudge, lenderDelta: worldLender ? 0 : lenderHit(grudge),
    witnesses: witnesses.map((civ) => civ.id), witnessDelta: witnessDelta({ worldLender, atWar }),
    standingNow: now, standingAfter: after,
    closedTurns: worldLender ? REPUDIATION.worldBlockTurns : null, closedAges: worldLender ? 0 : 1,
    creditTurnsLost: repTurnsLost(after) - repTurnsLost(now), atWar };
}

/**
 * The new schedule a restructure would set (DESIGN 4.4), for the confirmation.
 * @param {Ledger} ledger
 * @param {string} loanId
 */
export function restructurePreview(ledger, loanId) {
  const loan = ledger.loans.find((row) => row.id === loanId);
  if (!loan) return null;
  const after = restructure(loan);
  return { outstanding: loan.outstanding, ratePpm: loan.ratePpm, term: after.term,
    paymentCents: paymentDue(after).total, allowed: loan.state === "active" && !loan.restructured };
}

/**
 * How close an AI borrower is to the repudiation rule (DESIGN 5, 6), for the Lend form.
 * @param {PlanInput} input
 * @param {number} lender
 * @param {number} borrower
 */
export function borrowerRisk(input, lender, borrower) {
  const ledger = input.ledger || emptyLedger();
  const civ = input.civs.find((row) => row.id === borrower);
  const level = relationLevel(input.relations, lender, borrower);
  const lowTurns = ledger.lowIncome.find((row) => row.pid === borrower)?.turns || 0;
  const owed = ledger.loans.filter((loan) => loan.borrower === borrower && loan.lender === lender && isOpen(loan))
    .reduce((sum, loan) => sum + loan.outstanding, 0);
  return { level, atWar: level === "war", lowIncomeTurns: lowTurns, insolvent: isInsolvent(lowTurns),
    inDefault: ledger.loans.some((loan) => loan.borrower === borrower && loan.state === "default"),
    thresholdCents: repudiationThreshold(civ?.incomeCents || 0), owedCents: owed,
    incomeCents: civ?.incomeCents || 0, wouldLendByRule: civ ? aiWillLend(civ) : false };
}

/**
 * Whether the player's citizens would lend to it now (a Civic market civ with a Commerce building and room left).
 * @param {PlanInput} input
 * @param {number} pid
 */
export function citizenOfferOpen(input, pid) {
  const offer = citizensFor(viewContext(input), pid);
  return !!offer && offer.roomCents > 0;
}

/**
 * The facts and the tab rules (econ-view-tabs.js) for this player, from the plan input and its stage turns.
 * @param {PlanInput} input
 * @param {number} pid
 * @param {Record<string, number | null | undefined> | null | undefined} stageTurns
 */
export function viewRules(input, pid, stageTurns) {
  const facts = tabFacts(input, pid, stageTurns, { citizenOffer: citizenOfferOpen(input, pid) });
  return { facts, rules: tabRules(facts) };
}
