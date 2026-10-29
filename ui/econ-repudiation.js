// econ-repudiation.js - Economics: what repudiating a lender does to the ledger and to reputation (DESIGN 4.5). No
// Gold moves. The grudge comes out as grievance rows { from, against, amount } for the glue to book on the
// repudiator, the witnesses as relationship rows { a, b, delta }; both are plain data, nothing here calls the engine.

import { REPUDIATION, isWorldAccount } from "./econ-params.js";
import { divRound } from "./econ-money.js";
import { isOpen } from "./econ-loan.js";
import { blockFor } from "./econ-lenders.js";
import { withBlock } from "./econ-payments.js";

/**
 * clamp(5 * loss_turns, 10, 40), loss_turns = written-off Gold / max(10 Gold, the lender's income).
 * @param {number} writtenOffCents
 * @param {number} lenderIncomeCents
 */
export function grudgeFor(writtenOffCents, lenderIncomeCents) {
  const perTurn = Math.max(REPUDIATION.minLenderIncomeCents, lenderIncomeCents);
  const raw = divRound(REPUDIATION.grudgePerTurn * writtenOffCents, perTurn);
  return Math.max(REPUDIATION.grudgeMin, Math.min(REPUDIATION.grudgeMax, raw));
}

/**
 * -3 with each witness; doubled when there's no lender to hold a grudge; halved against an enemy at war.
 * @param {{ worldLender: boolean, atWar: boolean }} q
 */
export function witnessDelta({ worldLender, atWar }) {
  const cost = REPUDIATION.witness * (worldLender ? REPUDIATION.worldWitnessMultiple : 1);
  return -(atWar ? divRound(cost, 2) : cost);
}

/**
 * Closes every open record between the pair as `repudiated` and sizes the reputation cost.
 * witnesses: the other major civs the repudiator has met (the lender is left out; it gets the grudge).
 * Returns null when nothing is owed.
 * @param {{ ledger: Ledger, turn: number, borrower: number, lender: Party, lenderIncomeCents?: number,
 *   atWar?: boolean, witnesses?: number[] }} q
 */
export function repudiate({ ledger, turn, borrower, lender, lenderIncomeCents = 0, atWar = false, witnesses = [] }) {
  const mine = ledger.loans.filter((loan) => loan.borrower === borrower && loan.lender === lender && isOpen(loan));
  if (!mine.length) return null;
  const ids = new Set(mine.map((loan) => loan.id));
  const writtenOff = mine.reduce((sum, loan) => sum + loan.outstanding, 0);
  /** @type {Loan[]} */
  const loans = ledger.loans.map((loan) => (ids.has(loan.id)
    ? { ...loan, state: "repudiated", closedTurn: turn, writtenOff: loan.outstanding, outstanding: 0 } : loan));
  const worldLender = isWorldAccount(lender);
  /** @type {RepudiationRow} */
  const record = { pid: borrower, lender, turn, cents: writtenOff, atWar: atWar === true };
  const delta = witnessDelta({ worldLender, atWar: record.atWar });
  /** @type {RelationshipRow[]} */
  const relationships = witnesses.filter((witness) => witness !== borrower && witness !== lender)
    .map((witness) => ({ a: borrower, b: witness, delta }));
  /** @type {GrievanceRow[]} */
  const grievances = worldLender ? [] : [{ from: borrower, against: lender,
    amount: grudgeFor(writtenOff, lenderIncomeCents) }];
  const blocks = withBlock(ledger.blocks, blockFor({ lender, borrower, reason: "repudiation", turn }));
  /** @type {Ledger} */
  const next = { ...ledger, loans, blocks, repudiations: [...ledger.repudiations, record] };
  return { ledger: next, writtenOff, loanIds: [...ids], grievances, relationships, record };
}
