// econ-shortfall.js - Economics: the rules that open loans nobody asked for. Before the payments run, the distress
// read (econ-distress.js, AI-PLAN 4.1) finds each civ whose dues pass its funds; with income above 0 it gets a
// refinancing loan for the gap, judged by the credit cap alone, through the guard for the human and by rule for an
// AI. After the payments, the guard covers the human below the engine's line (DESIGN 4.6) and the AI gets the same
// emergency loan: the same line, the same sizing (back to the line plus one turn of upkeep) and the same cap,
// through the one guardDecision, each stopping at emergency_cap with one notice per spell. The AI's restructuring and
// repudiation rules (section 6) are here too, and its build loan, its door to "borrow to build", which the player has
// through the Gold it spends: cheap credit puts progress on its own current build.

import { AI, CITIZENS, PROGRESS, REFINANCE, RESERVE, SHORT_TERM, isWorldAccount } from "./econ-params.js";
import { isOpen } from "./econ-loan.js";
import { activeDefaults, emergencyOutstandingOf, outstandingOf, serviceOf } from "./econ-credit.js";
import { servicePrincipalCents } from "./econ-citizens.js";
import { emergencyOffersFor, offersFor, relationLevel } from "./econ-lenders.js";
import { distressOf, lookAhead, reserveOf } from "./econ-distress.js";
import { paymentDue } from "./econ-loan.js";
import { aiBuildBorrowStanding, aiBuildBorrowWanted, aiChoice, aiRepudiationTarget, aiShortfall, buildPays,
  loanToRestructure } from "./econ-ai.js";
import { emergencyCap, guardDecision, isInsolvent } from "./econ-guard.js";
import { projected } from "./econ-batch.js";
import { aiLendersFor, event, incomeOf, isHuman, notice, offerQuery, openLoan } from "./econ-turn.js";
import { creditRoom, isAtLoanLimit, mostBorrowCents, repudiateFor, restructureLoan } from "./econ-requests.js";
import { pointPriceCents } from "./econ-planned.js";

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
 * AI-PLAN 4.1: a civ whose dues pass its funds, with income above 0 and solvent, borrows the gap over 10 turns from
 * the cheapest lender that offers, within its credit cap alone; the debt-service limit is for voluntary loans, and
 * this one meets payments already inside the service figure. Returns the read, with the loan when one opened. A
 * short civ that gets no loan is noted (`short`) and pays what it has at the payment step.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
export function refinanceFor(ctx, civ) {
  const read = distressOf(ctx, civ.id);
  if (!read.short) return { read, loan: null, reason: null };
  noteDistress(ctx, civ.id);
  const why = () => {
    if (!(civ.incomeCents > 0) || isInsolventCiv(ctx, civ.id)) return "income";
    if (isAtLoanLimit(ctx, civ.id)) return "loan-limit";
    if (read.gap > creditRoom(ctx, civ.id)) return "credit-cap";
    return null;
  };
  const refused = why();
  const best = refused ? null : offersFor(offerQuery(ctx, civ.id, { principal: read.gap, term: REFINANCE.term,
    lenders: aiLendersFor(ctx, civ.id) }))[0];
  const reason = refused || (best ? null : "no-offer");
  if (reason) {
    const fields = { kind: "short", pid: civ.id, dues: read.dues, funds: read.funds, cents: read.gap, reason };
    event(ctx, fields);
    notice(ctx, civ.id, fields);
    return { read, loan: null, reason };
  }
  const offer = /** @type {Offer} */ (best);
  const loan = openLoan(ctx, { lender: offer.lender, borrower: civ.id, principal: read.gap, ratePpm: offer.ratePpm,
    term: REFINANCE.term, source: "refinance" });
  const fields = { kind: "refinance", pid: civ.id, loanId: loan.id, cents: read.gap, lender: offer.lender,
    dues: read.dues, funds: read.funds };
  event(ctx, fields);
  notice(ctx, civ.id, fields);
  return { read, loan, reason: null };
}

/**
 * A civ whose dues passed its funds is in distress this turn and the next (the escrow's two-turn hold and the AI's
 * budget scaling read it, AI-PLAN 4.2); the ledger keeps the turn so a reload agrees.
 * @param {TurnContext} ctx
 * @param {number} pid
 */
function noteDistress(ctx, pid) {
  ctx.distressed.add(pid);
  const row = ctx.ledger.distress.find((x) => x.pid === pid);
  if (row) row.turn = ctx.turn; else ctx.ledger.distress.push({ pid, turn: ctx.turn });
}

/**
 * Whether a civ is in distress: short this turn, or last turn (AI-PLAN 4.2).
 * @param {TurnContext} ctx
 * @param {number} pid
 */
export function inDistress(ctx, pid) {
  if (ctx.distressed.has(pid)) return true;
  const row = ctx.ledger.distress.find((x) => x.pid === pid);
  return !!row && ctx.turn - row.turn <= 1;
}

/**
 * The human's side of the refinancing rule: the guard takes the loan (DESIGN 4.6 names it as the guard's work).
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
export function guardRefinance(ctx, civ) {
  if (!ctx.options.guard) {
    const read = distressOf(ctx, civ.id);
    if (!read.short) return;
    noteDistress(ctx, civ.id);
    notice(ctx, civ.id, { kind: "short", pid: civ.id, dues: read.dues, funds: read.funds, cents: read.gap,
      reason: "guard-off" });
    return;
  }
  refinanceFor(ctx, civ);
}

/**
 * DESIGN 6 borrowing after the payments: below the engine's line with income at or below 0, the emergency loan;
 * the short-but-solvent case is refinanceFor's, before the payments.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
export function aiBorrow(ctx, civ) {
  const need = aiShortfall(projected(ctx.batch, civ.id), ctx.params.amenityLineCents);
  if (!need || isAtLoanLimit(ctx, civ.id)) return;
  // The guard's own decision, so an AI's emergency loan is sized and capped exactly as the human's (DESIGN 4.6, "AI
  // civs get the same rule").
  const decision = guardDecision({ enabled: true, projectedCents: projected(ctx.batch, civ.id),
    upkeepCents: civ.upkeepCents || 0, lineCents: ctx.params.amenityLineCents, turn: ctx.turn,
    incomeCents: civ.incomeCents, openEmergencyCents: emergencyOutstandingOf(ctx.ledger, civ.id) });
  if (decision.reason === "at-cap") { noteCap(ctx, civ.id, decision.principal); return; }
  if (decision.fire) openEmergency(ctx, civ.id, decision.principal, "ai-shortfall");
}

/**
 * Whether a refinancing loan for `gap` would be offered to the civ now, without taking it (AI-PLAN 4.3: the
 * refinancing step comes before the payments; this is the decision step's dry run of it).
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {number} gap
 */
function refinanceOpen(ctx, civ, gap) {
  if (!(gap > 0) || !(civ.incomeCents > 0) || isInsolventCiv(ctx, civ.id) || isAtLoanLimit(ctx, civ.id)) return false;
  if (gap > creditRoom(ctx, civ.id)) return false;
  return offersFor(offerQuery(ctx, civ.id, { principal: gap, term: REFINANCE.term,
    lenders: aiLendersFor(ctx, civ.id) })).length > 0;
}

/**
 * AI-PLAN 4.3: the AI's ordered choice on the look-ahead. Pay when this turn and the next fit; a refinancing loan
 * when short and one's on offer (the refinancing step takes it); otherwise, with income above 0, restructure the
 * loan whose payment doesn't fit, one loan a turn and once per loan (the stage C watch run restructured six in one
 * turn on a civ with nothing in hand, which no schedule could fix); a human lender is asked instead. What's still
 * short after that is a miss, paid as far as the funds go. Returns the choice made.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
export function aiDecide(ctx, civ) {
  const mine = ctx.ledger.loans.filter((loan) => loan.borrower === civ.id && loan.state === "active");
  const ahead = lookAhead(ctx, civ.id, 1);
  const gapNow = ahead[0].gap;
  const choice = aiChoice({ gapNow, gapAhead: ahead[1].gap, refinanceOpen: refinanceOpen(ctx, civ, gapNow),
    incomeCents: civ.incomeCents, restructurable: mine.some((loan) => !loan.restructured) });
  if (choice !== "restructure") return choice;
  const loan = loanToRestructure(mine, (row) => paymentDue(row).total);
  if (!loan) return "miss";
  if (isHuman(ctx, loan.lender)) {
    notice(ctx, loan.lender, { kind: "restructure-ask", loanId: loan.id, borrower: civ.id });
    return choice;
  }
  restructureLoan(ctx, loan, civ.id);
  return choice;
}

/**
 * AI-PLAN 4.3: an AI with no distress and funds above its reserve (10 turns of income, or the next three turns'
 * dues plus a turn of upkeep, whichever is more) puts half the surplus into its dearest loan, the same way the
 * player's early repayment rides on the turn's payment. A loan opened this turn, or one the civ is about to
 * repudiate (closed by the repudiation step before this), is never chosen.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {Map<string, number>} extras
 */
export function aiRepayEarly(ctx, civ, extras) {
  const reserve = reserveOf(ctx, civ.id);
  if (reserve.aboveCents <= 0 || reserve.ahead.some((row) => row.gap > 0)) return;
  const open = ctx.ledger.loans.filter((loan) => loan.borrower === civ.id && loan.state === "active"
    && loan.opened < ctx.turn);
  open.sort((a, b) => b.ratePpm - a.ratePpm || a.id.localeCompare(b.id));
  const dearest = open[0];
  if (!dearest) return;
  const cents = Math.floor((reserve.aboveCents * RESERVE.repaySharePct) / 100 / 100) * 100;
  if (cents <= 0) return;
  extras.set(dearest.id, (extras.get(dearest.id) || 0) + Math.min(cents, dearest.outstanding));
  event(ctx, { kind: "repay-early", pid: civ.id, loanId: dearest.id, cents: Math.min(cents, dearest.outstanding),
    reserve: reserve.reserveCents });
}

/**
 * AI-PLAN 4.3, the human's side of the same read: a notice when next turn's payments won't fit what the player is
 * on course to have, with the three choices (restructure, borrow, or let it miss) on the Loans tab.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
export function lookAheadNotice(ctx, civ) {
  const ahead = lookAhead(ctx, civ.id, 1);
  if (ahead[1].gap <= 0) return;
  notice(ctx, civ.id, { kind: "short-ahead", dues: ahead[1].dues, funds: ahead[1].funds, gap: ahead[1].gap });
}

/**
 * What a civ owes each lender, with the relationship and the lender's strength (AI-PLAN 4.4).
 * @param {TurnContext} ctx
 * @param {number} pid
 * @returns {{ lender: Party, cents: number, level: RelationLevel | null, lenderStrength: number | null }[]}
 */
function debtsOf(ctx, pid) {
  /** @type {Map<Party, number>} */
  const sums = new Map();
  for (const loan of ctx.ledger.loans) {
    if (loan.borrower === pid && isOpen(loan)) sums.set(loan.lender, (sums.get(loan.lender) || 0) + loan.outstanding);
  }
  return [...sums].map(([lender, cents]) => ({ lender, cents,
    level: isWorldAccount(lender) ? null : relationLevel(ctx.relations, pid, lender),
    lenderStrength: isWorldAccount(lender) ? null : ctx.civ.get(/** @type {number} */ (lender))?.strength ?? null }));
}

/**
 * AI-PLAN 4.4 repudiation, before any payment on the records it closes (DESIGN 4.14 step 2).
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
export function aiRepudiate(ctx, civ) {
  if (outstandingOf(ctx.ledger, civ.id) <= 0) return;
  const last = ctx.ledger.repudiations.filter((row) => row.pid === civ.id).map((row) => row.turn)
    .sort((a, b) => b - a)[0];
  const lender = aiRepudiationTarget({ debts: debtsOf(ctx, civ.id), insolvent: isInsolventCiv(ctx, civ.id),
    incomeCents: civ.incomeCents, strength: civ.strength ?? null, lastRepudiationTurn: last, turn: ctx.turn });
  if (lender === null || lender === undefined) return;
  repudiateFor(ctx, civ.id, lender);
}

/**
 * The city an AI's build loan backs: a city whose build gives a reason to want one (slow on its own production, or
 * a Gold building that could pay for the loan) and still needs progress, role buildings first (DESIGN 4.13), with
 * what this turn's other progress rows already send it taken off. The first run of 2026-10-31 showed the first
 * city's quick build hiding a slow one in the next.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
function buildCity(ctx, civ) {
  const left = (/** @type {CityRead} */ city) => city.neededProgress
    - (ctx.out.progress.find((row) => row.cityId === city.id)?.amount ?? 0);
  const reason = (/** @type {CityRead} */ city) => (Number.isFinite(city.turnsLeft)
    && /** @type {number} */ (city.turnsLeft) >= AI.buildSlowTurns) || (city.buildGoldYield ?? 0) > 0;
  const open = (civ.cities || []).filter((city) => city && city.build && left(city) > 0 && reason(city));
  const city = open.find((row) => row.roleBuilding === true) || open[0];
  return city ? { city, need: left(city) } : null;
}

/**
 * The cheapest bond or civ offer over the build loan's term, so an AI has about one open at a time; its citizens have
 * their own rule.
 * @param {TurnContext} ctx
 * @param {number} pid
 * @param {number} principal
 */
function buildOffer(ctx, pid, principal) {
  const term = AI.buildTerm;
  const offer = offersFor(offerQuery(ctx, pid, { principal, term, lenders: aiLendersFor(ctx, pid) }))
    .find((row) => row.lender !== CITIZENS);
  return offer ? { ...offer, term } : null;
}

/**
 * The city an AI's build loan would back this turn, or null when it isn't in standing for one (aiBuildBorrowStanding)
 * or its loans are at the limit.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
function buildTarget(ctx, civ) {
  const target = buildCity(ctx, civ);
  const openBuildLoan = ctx.ledger.loans.some((loan) => loan.borrower === civ.id && loan.source === "ai-build"
    && isOpen(loan));
  const standing = aiBuildBorrowStanding({ incomeCents: civ.incomeCents,
    phase: ctx.readings.civ.get(civ.id)?.phase ?? "", insolvent: isInsolventCiv(ctx, civ.id),
    inDefault: activeDefaults(ctx.ledger, civ.id) > 0, distressed: inDistress(ctx, civ.id), hasBuild: !!target,
    openBuildLoan });
  return standing && !isAtLoanLimit(ctx, civ.id) ? target : null;
}

/**
 * DESIGN 6 build loan: what an AI asks for when it wants capital. In standing, it sizes the loan (up to 5 turns of
 * income, within the 4.2 limits by the same sizing the player's refusal names, in whole points at the game's
 * purchase rate), takes the cheapest offer, and borrows when the build pays for the loan or is slow and the service
 * stays within its income (aiBuildBorrowWanted). The Gold goes straight into the build as addProgress, beside any
 * development loan's or the plan's row for the same city.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 */
export function aiBuildBorrow(ctx, civ) {
  const target = buildTarget(ctx, civ);
  if (!target) return;
  const price = pointPriceCents(ctx.params.goldPerPointCents, target.city.progressScalePct,
    target.city.pointCents);
  const want = Math.min(AI.buildSizeTurns * civ.incomeCents, target.need * price);
  const offer = buildOffer(ctx, civ.id, want);
  if (!offer) return;
  // What it can carry as a want: its loan service with this loan's first payment within buildServiceMaxPct of
  // income (the 4.2 limit, at 50%, is the most anyone may borrow; a want stops well short of it).
  const room = Math.floor((civ.incomeCents * AI.buildServiceMaxPct) / 100) - serviceOf(ctx.ledger, civ.id);
  const carry = Math.max(0, servicePrincipalCents({ roomCents: room, ratePpm: offer.ratePpm, term: offer.term }));
  const most = Math.min(want, mostBorrowCents(ctx, civ.id, offer), carry);
  const points = Math.floor(most / price);
  if (points * price < AI.minIncomeCents) return;
  const principal = points * price;
  const yieldCents = Math.round((target.city.buildGoldYield ?? 0) * 100);
  const wanted = aiBuildBorrowWanted({
    pays: buildPays({ goldYieldCents: yieldCents, principal, ratePpm: offer.ratePpm, term: offer.term }),
    turnsLeft: Number.isFinite(target.city.turnsLeft) ? /** @type {number} */ (target.city.turnsLeft) : null });
  if (!wanted) return;
  // The principal goes from the lender straight to the progress account: Gold from a civ counts in the borrower's
  // funds only next turn (DESIGN 4.14), and the borrower never holds it.
  const loan = openLoan(ctx, { lender: offer.lender, borrower: civ.id, principal: points * price,
    ratePpm: offer.ratePpm, term: offer.term, source: "ai-build", payee: PROGRESS });
  const same = ctx.out.progress.find((row) => row.cityId === target.city.id);
  if (same) same.amount += points;
  else ctx.out.progress.push({ host: civ.id, cityId: target.city.id, amount: points, investmentId: loan.id });
}
