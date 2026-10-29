// econ-shortfall.js - Economics: the rules that open loans nobody asked for. The guard covers the human (DESIGN 4.6);
// the AI borrowing, restructuring and repudiation rules (section 6) cover AI civs. Both run on each civ's projected
// end balance after the resolve step, and an emergency loan stops at emergency_cap with one notice per spell.
// An AI's emergency loan is the human's guard loan: the same line, the same sizing (back to the line plus one turn of
// upkeep) and the same cap, through the one guardDecision. The AI differs only in trying a standard loan first while
// it is short but solvent (DESIGN 6), which the human does by asking.

import { SHORT_TERM, isWorldAccount } from "./econ-params.js";
import { isOpen } from "./econ-loan.js";
import { activeDefaults, emergencyOutstandingOf, outstandingOf } from "./econ-credit.js";
import { emergencyOffersFor, offersFor, relationLevel } from "./econ-lenders.js";
import { aiRepudiationTarget, aiRestructures, aiShortfall } from "./econ-ai.js";
import { emergencyCap, guardDecision, isInsolvent } from "./econ-guard.js";
import { projected } from "./econ-batch.js";
import { aiLendersFor, event, incomeOf, isHuman, notice, offerQuery, openLoan } from "./econ-turn.js";
import { isAtLoanLimit, limitRefusal, repudiateFor, restructureLoan } from "./econ-requests.js";

/**
 * @param {TurnContext} ctx
 * @param {number} pid
 */
const lowIncomeTurns = (ctx, pid) => ctx.ledger.lowIncome.find((row) => row.pid === pid)?.turns || 0;
/**
 * @param {TurnContext} ctx
 * @param {number} pid
 */
export const isInsolventCiv = (ctx, pid) => isInsolvent(lowIncomeTurns(ctx, pid));
/**
 * @param {TurnContext} ctx
 * @param {number} pid
 */
const lastCapHit = (ctx, pid) => ctx.ledger.capHits.find((row) => row.pid === pid)?.turn;

/**
 * DESIGN 6: an insolvent civ gets no civ lender; the AI rule never lends to one.
 * @param {TurnContext} ctx
 * @param {number} pid
 */
function emergencyLenders(ctx, pid) {
  return isInsolventCiv(ctx, pid) ? [] : aiLendersFor(ctx, pid);
}

/**
 * @param {TurnContext} ctx
 * @param {number} pid
 * @param {number} principal
 */
function noteCap(ctx, pid, principal) {
  const last = lastCapHit(ctx, pid);
  const row = ctx.ledger.capHits.find((hit) => hit.pid === pid);
  if (row) row.turn = ctx.turn; else ctx.ledger.capHits.push({ pid, turn: ctx.turn });
  if (last === ctx.turn - 1) return;
  const fields = { kind: "guard-cap", pid, cents: principal, deficit: Math.max(0, -projected(ctx.batch, pid)),
    cap: emergencyCap(incomeOf(ctx, pid)), insolvent: isInsolventCiv(ctx, pid) ? 1 : 0,
    disbandLineCents: ctx.params.disbandLineCents ?? null };
  event(ctx, fields);
  notice(ctx, pid, fields);
}

/**
 * Opens an emergency loan for `principal` from the cheapest lender the stage allows; false when none will.
 * @param {TurnContext} ctx
 * @param {number} pid
 * @param {number} principal
 * @param {LoanSource} source
 */
function openEmergency(ctx, pid, principal, source) {
  if (isAtLoanLimit(ctx, pid)) { event(ctx, { kind: "guard-limit", pid }); return false; }
  const offer = emergencyOffersFor(offerQuery(ctx, pid, { principal, lenders: emergencyLenders(ctx, pid) }))[0];
  if (!offer) { event(ctx, { kind: "guard-blocked", pid }); return false; }
  const loan = openLoan(ctx, { lender: offer.lender, borrower: pid, principal, ratePpm: offer.ratePpm,
    term: SHORT_TERM, source, emergency: true });
  const fields = { kind: "guard", pid, loanId: loan.id, cents: principal, lender: offer.lender,
    insolvent: isInsolventCiv(ctx, pid) ? 1 : 0 };
  event(ctx, fields);
  notice(ctx, pid, fields);
  return true;
}

/**
 * The human's guard: an emergency loan back to the guard line plus one turn of upkeep (DESIGN 4.6).
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
export function guardFor(ctx, civ) {
  const { ledger, turn } = ctx;
  const fired = ledger.guardTurns.find((row) => row.pid === civ.id);
  const decision = guardDecision({ enabled: ctx.options.guard, projectedCents: projected(ctx.batch, civ.id),
    upkeepCents: civ.upkeepCents || 0, lineCents: ctx.params.amenityLineCents, firedTurn: fired?.turn, turn,
    openEmergencyCents: emergencyOutstandingOf(ledger, civ.id), incomeCents: civ.incomeCents });
  if (decision.reason === "at-cap") { noteCap(ctx, civ.id, decision.principal); return; }
  if (!decision.fire || !openEmergency(ctx, civ.id, decision.principal, "guard")) return;
  if (fired) fired.turn = turn; else ledger.guardTurns.push({ pid: civ.id, turn });
}

/**
 * DESIGN 6 borrowing: short means a standard loan within the limits; insolvent or past them, an emergency loan.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
export function aiBorrow(ctx, civ) {
  const need = aiShortfall(projected(ctx.batch, civ.id), ctx.params.amenityLineCents);
  if (!need || isAtLoanLimit(ctx, civ.id)) return;
  if (!isInsolventCiv(ctx, civ.id) && civ.incomeCents > 0) {
    const query = offerQuery(ctx, civ.id, { principal: need, term: SHORT_TERM, lenders: aiLendersFor(ctx, civ.id) });
    const best = offersFor(query)[0];
    if (best && !limitRefusal(ctx, civ.id, { principal: need, ratePpm: best.ratePpm, term: SHORT_TERM })) {
      openLoan(ctx, { lender: best.lender, borrower: civ.id, principal: need, ratePpm: best.ratePpm,
        term: SHORT_TERM, source: "ai-shortfall" });
      return;
    }
  }
  // Past the limits or insolvent: the guard's own decision, so an AI's emergency loan is sized and capped exactly as
  // the human's (DESIGN 4.6, "AI civs get the same rule").
  const decision = guardDecision({ enabled: true, projectedCents: projected(ctx.batch, civ.id),
    upkeepCents: civ.upkeepCents || 0, lineCents: ctx.params.amenityLineCents, turn: ctx.turn,
    incomeCents: civ.incomeCents, openEmergencyCents: emergencyOutstandingOf(ctx.ledger, civ.id) });
  if (decision.reason === "at-cap") { noteCap(ctx, civ.id, decision.principal); return; }
  if (decision.fire) openEmergency(ctx, civ.id, decision.principal, "ai-shortfall");
}

/**
 * DESIGN 6: an AI restructures at m = 2 by rule; a human lender is asked instead.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
export function aiRestructure(ctx, civ) {
  for (const loan of ctx.ledger.loans) {
    if (loan.borrower !== civ.id || !aiRestructures({ loan, incomeCents: civ.incomeCents })) continue;
    if (isHuman(ctx, loan.lender)) {
      notice(ctx, loan.lender, { kind: "restructure-ask", loanId: loan.id, borrower: civ.id });
      continue;
    }
    restructureLoan(ctx, loan, civ.id);
  }
}

/**
 * @param {TurnContext} ctx
 * @param {number} pid
 * @returns {{ lender: Party, cents: number, level: RelationLevel | null }[]}
 */
function debtsOf(ctx, pid) {
  /** @type {Map<Party, number>} */
  const sums = new Map();
  for (const loan of ctx.ledger.loans) {
    if (loan.borrower === pid && isOpen(loan)) sums.set(loan.lender, (sums.get(loan.lender) || 0) + loan.outstanding);
  }
  return [...sums].map(([lender, cents]) => ({ lender, cents,
    level: isWorldAccount(lender) ? null : relationLevel(ctx.relations, pid, lender) }));
}

/**
 * DESIGN 6 repudiation, before any payment on the records it closes (DESIGN 4.14 step 2).
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
export function aiRepudiate(ctx, civ) {
  if (outstandingOf(ctx.ledger, civ.id) <= 0) return;
  const last = ctx.ledger.repudiations.filter((row) => row.pid === civ.id).map((row) => row.turn)
    .sort((a, b) => b - a)[0];
  const lender = aiRepudiationTarget({ debts: debtsOf(ctx, civ.id), insolvent: isInsolventCiv(ctx, civ.id),
    inDefault: activeDefaults(ctx.ledger, civ.id) > 0, incomeCents: civ.incomeCents,
    atCap: lastCapHit(ctx, civ.id) === ctx.turn - 1, lastRepudiationTurn: last, turn: ctx.turn });
  if (lender === null || lender === undefined) return;
  repudiateFor(ctx, civ.id, lender);
}
