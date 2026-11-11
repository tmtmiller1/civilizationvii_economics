// econ-bankruptcy.js - Economics: declaring bankruptcy (DESIGN 4.18). A civ below zero sets its treasury back to 0:
// the bond market pays what it's overdrawn, and the civ repudiates every loan it has, each with the usual cost. With
// no bond loan among them, the bankruptcy is booked as a repudiation of the bond market, so it costs the reputation
// points, the named note with every civ that knows it, and 30 turns without bond loans. The penalties for being below
// zero stop that turn. Once in 30 turns. An AI weighs it each turn it's below zero: what staying costs until it's
// back above zero (interest, Happiness, prices, credit, units and shut settlements on the ramp's schedule) against
// what bankruptcy costs (credit, grievances, its lenders' grudges, the bond market for 30 turns).

import { BANKRUPTCY, BOND, OVERDRAFT, OVERDRAWN, REPUTATION, heldCents, isWorldAccount, overdrawnRamp } from "./econ-params.js";
import { overdrawnState } from "./econ-overdrawn.js";
import { interestCapCents, overdraftInterest } from "./econ-overdraft.js";
import { bondRate } from "./econ-policy-read.js";
import { blockFor, relationLevel } from "./econ-lenders.js";
import { isOpen } from "./econ-loan.js";
import { withBlock } from "./econ-payments.js";
import { grudgeFor, witnessDelta } from "./econ-repudiation.js";
import { emit, event, notice, repChange } from "./econ-turn.js";

/** @typedef {(ctx: TurnContext, borrower: number, lender: Party) => string | null} RepudiateFor */

/**
 * The last turn the civ declared bankruptcy, or null.
 * @param {Ledger} ledger
 * @param {number} pid
 */
export function lastBankruptcy(ledger, pid) {
  const turns = (ledger.repudiations || []).filter((row) => row.pid === pid && row.bankrupt === 1)
    .map((row) => row.turn);
  return turns.length ? Math.max(...turns) : null;
}

/**
 * Why the civ can't declare bankruptcy now, or null when it can: it isn't below zero, or it declared within 30 turns.
 * @param {TurnContext} ctx
 * @param {number} pid
 */
export function bankruptcyRefusal(ctx, pid) {
  const civ = ctx.civ.get(pid);
  if (!civ || civ.alive !== true) return "parties";
  if (!(heldCents(civ) < 0)) return "not-overdrawn";
  const last = lastBankruptcy(ctx.ledger, pid);
  if (ctx.bankrupt?.has(pid) || (last !== null && ctx.turn - last < BANKRUPTCY.everyTurns)) {
    return "bankrupt-recently";
  }
  return null;
}

/**
 * The other living civs the bankrupt civ has met, who book the named note.
 * @param {TurnContext} ctx
 * @param {number} pid
 */
function witnesses(ctx, pid) {
  /** @type {Set<number>} */
  const met = new Set();
  for (const row of ctx.relations) {
    if (row.a === pid && ctx.civ.get(row.b)?.alive === true) met.add(row.b);
    if (row.b === pid && ctx.civ.get(row.a)?.alive === true) met.add(row.a);
  }
  return [...met];
}

/**
 * Books the write-off as a repudiation of the bond market: onto the record a repudiated bond loan made this turn, or
 * as a record of its own with that repudiation's reputation, note and block.
 * @param {TurnContext} ctx
 * @param {number} pid
 * @param {number} cents the overdraft written off
 */
function bookBond(ctx, pid, cents) {
  const made = ctx.ledger.repudiations.find((row) => row.pid === pid && row.lender === BOND && row.turn === ctx.turn);
  if (made) {
    Object.assign(made, { cents: made.cents + cents, bankrupt: 1 });
    return;
  }
  const seen = witnesses(ctx, pid);
  const note = seen.length ? -witnessDelta({ worldLender: true, atWar: false }) : 0;
  ctx.ledger.repudiations.push({ pid, lender: BOND, turn: ctx.turn, cents, atWar: false, grudge: 0, note,
    madeGood: null, bankrupt: 1 });
  ctx.ledger.blocks = withBlock(ctx.ledger.blocks, blockFor({ lender: BOND, borrower: pid, reason: "repudiation",
    turn: ctx.turn }));
  repChange(ctx, pid, -REPUTATION.repudiation, "bankruptcy");
  if (note > 0) (ctx.out.notes ||= []).push({ pid, line: "REPUDIATED", amount: note });
}

/**
 * Declares the civ bankrupt: repudiates every lender it owes, writes its treasury back to 0 from the bond market and
 * books it. Returns the refusal, or null when it went through.
 * @param {TurnContext} ctx
 * @param {number} pid
 * @param {RepudiateFor} repudiateFor econ-requests.js repudiateFor, passed in so the modules don't import each other
 */
export function declareBankruptcy(ctx, pid, repudiateFor) {
  const refusal = bankruptcyRefusal(ctx, pid);
  if (refusal) return refusal;
  const civ = /** @type {Civ} */ (ctx.civ.get(pid));
  const lenders = [...new Set(ctx.ledger.loans.filter((loan) => loan.borrower === pid && isOpen(loan))
    .map((loan) => loan.lender))];
  for (const lender of lenders) repudiateFor(ctx, pid, lender);
  const cents = -heldCents(civ);
  emit(ctx, { id: `BK${pid}` }, { from: BOND, to: pid, cents, reason: "bankruptcy" });
  bookBond(ctx, pid, cents);
  (ctx.bankrupt ||= new Set()).add(pid);
  event(ctx, { kind: "bankruptcy", pid, cents, loans: lenders.length, chronicle: 1 });
  notice(ctx, pid, { kind: "bankrupt", cents, loans: lenders.length });
  for (const other of witnesses(ctx, pid)) notice(ctx, other, { kind: "bankrupt-other", civ: pid, cents });
  return null;
}

/**
 * The AI's weighing (DESIGN 4.18), in cents: what staying below zero costs until it's back above zero, against what
 * bankruptcy costs. Pure, so the tests and the Treasury tab can read the same figures.
 * @param {{ debtCents: number, incomeCents: number, interestCents: number, turns: number, gloom: number,
 *   premiumBp: number, settlements: number, production: number, units: number,
 *   lenders: { grudge: number, level: RelationLevel | null, stronger: boolean }[], witnesses: number,
 *   noteEach: number, loansOpen: boolean }} q
 * @returns {{ stayCents: number, bankruptCents: number, turnsOut: number, declare: boolean }}
 */
export function bankruptcyWeighing(q) {
  const B = BANKRUPTCY;
  const scale = Math.max(OVERDRAFT.minCents / 10, q.incomeCents);
  const paydown = q.incomeCents - q.interestCents;
  const turnsOut = paydown > 0 ? Math.ceil(q.debtCents / paydown) : Infinity;
  const settlements = Math.max(1, q.settlements);
  const perSettlement = (Math.max(0, q.incomeCents) + Math.max(0, q.production) * 100) / settlements;
  const steady = q.interestCents + q.gloom * settlements * B.goldPerHappiness * 100
    + (Math.max(0, q.incomeCents) * B.purchaseSharePct * q.premiumBp) / 1e6
    + OVERDRAFT.repPerTurn * B.repPointIncomeTurns * scale;
  let stayCents = 0;
  let units = Math.max(0, q.units);
  for (let k = 0; k < Math.min(turnsOut, B.horizonTurns); k += 1) {
    const ramp = overdrawnRamp(q.turns + k);
    const lost = Math.min(ramp.disband, units);
    units -= lost;
    stayCents += steady + lost * B.unitIncomeTurns * scale
      + Math.min(ramp.shut, settlements) * perSettlement * B.shutOutputShare;
  }
  const bankruptCents = bankruptCost(q, scale);
  return { stayCents: Math.round(stayCents), bankruptCents: Math.round(bankruptCents), turnsOut,
    declare: stayCents > bankruptCents * B.prudence };
}

/**
 * What the civ owes each lender on its open loans, in cents.
 * @param {Ledger} ledger
 * @param {number} pid
 */
function owedByLender(ledger, pid) {
  /** @type {Map<Party, number>} */
  const owed = new Map();
  for (const loan of ledger.loans) {
    if (loan.borrower === pid && isOpen(loan)) owed.set(loan.lender, (owed.get(loan.lender) || 0) + loan.outstanding);
  }
  return owed;
}

/**
 * Each civ lender's grudge, the relationship and whether it's the stronger of the two.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {Map<Party, number>} owed
 */
function civLenders(ctx, civ, owed) {
  return [...owed].filter(([lender]) => !isWorldAccount(lender)).map(([lender, cents]) => {
    const other = ctx.civ.get(/** @type {number} */ (lender));
    const stronger = typeof other?.strength === "number" && typeof civ.strength === "number"
      && other.strength > civ.strength;
    return { grudge: grudgeFor(cents, other?.incomeCents ?? 0),
      level: relationLevel(ctx.relations, civ.id, /** @type {number} */ (lender)), stronger };
  });
}

/**
 * What bankruptcy costs, in cents: a repudiation's credit rating and witnesses' note for each lender (the bond market
 * when it owes no one), each civ lender's grudge weighted by the relationship and its strength, and the bond market.
 * @param {{ lenders: { grudge: number, level: RelationLevel | null, stronger: boolean }[], witnesses: number,
 *   noteEach: number, loansOpen: boolean }} q
 * @param {number} scale a turn of the civ's income, in cents
 */
function bankruptCost(q, scale) {
  const B = BANKRUPTCY;
  const marks = Math.max(1, q.lenders.length);
  const weight = (/** @type {RelationLevel | null} */ level) => /** @type {Record<string, number>} */
    (B.lenderWeight)[level ?? "neutral"] ?? 1;
  const grudges = q.lenders.reduce((sum, l) => sum + l.grudge * weight(l.level)
    * (l.stronger ? B.strongerLender : 1), 0);
  return REPUTATION.repudiation * marks * B.repPointIncomeTurns * scale
    + (q.noteEach * q.witnesses * marks + grudges) * B.grievanceIncomeTurns * scale
    + B.bondAccessIncomeTurns * scale * (q.loansOpen ? 1 : 0.5);
}

/**
 * The weighing's inputs for one civ, from the turn's context.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {number} turns turns below zero in a row, this one included
 */
export function weighingFor(ctx, civ, turns) {
  const held = heldCents(civ);
  const state = overdrawnState(civ, turns);
  const owed = owedByLender(ctx.ledger, civ.id);
  return bankruptcyWeighing({ debtCents: -held, incomeCents: civ.incomeCents,
    interestCents: Math.min(overdraftInterest(held, bondRate(ctx, civ.id)), interestCapCents(civ.incomeCents)),
    turns, gloom: state ? state.gloom : 0, premiumBp: state ? state.premiumBp : 0, settlements: civ.settlements || 1,
    production: civ.production || 0, units: civ.units || 0, lenders: civLenders(ctx, civ, owed),
    witnesses: witnesses(ctx, civ.id).length, noteEach: -witnessDelta({ worldLender: true, atWar: false }),
    loansOpen: owed.size > 0 });
}

/**
 * The AI declares bankruptcy when staying below zero would cost it more than bankruptcy (bankruptcyWeighing). It waits
 * out the warning turns first, as the player is warned, so its emergency loans and other rules get their turn.
 * @param {TurnContext} ctx
 * @param {Civ} civ
 * @param {number} turns turns below zero in a row, this one included
 * @param {RepudiateFor} repudiateFor
 */
export function aiBankruptcy(ctx, civ, turns, repudiateFor) {
  if (turns <= OVERDRAWN.warnTurns || bankruptcyRefusal(ctx, civ.id)) return;
  const weighed = weighingFor(ctx, civ, turns);
  if (!weighed.declare) return;
  event(ctx, { kind: "bankruptcy-weighed", pid: civ.id, stay: weighed.stayCents, bankrupt: weighed.bankruptCents });
  declareBankruptcy(ctx, civ.id, repudiateFor);
}
