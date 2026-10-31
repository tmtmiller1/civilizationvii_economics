// econ-batch.js - Economics: the turn's Gold bookkeeping (DESIGN 4.14). Each payer is resolved on its own funds:
// its snapshot balance plus its income plus what world accounts put in this turn. Gold coming in from other civs
// counts from the next turn, which is what keeps one civ's result from depending on another's. The commit records
// each civ's snapshot balance and net, so a reload can tell a landed batch from a lost one.

import { isWorldAccount } from "./econ-params.js";

/**
 * @param {Civ[]} civs
 * @returns {Batch}
 */
export function createBatch(civs) {
  /** @type {Batch} */
  const batch = { snapshot: new Map(), income: new Map(), worldIn: new Map(), civIn: new Map(), out: new Map(),
    committed: new Map(), influence: new Map(), celebration: new Map() };
  for (const civ of civs) {
    batch.snapshot.set(civ.id, civ.balanceCents);
    batch.income.set(civ.id, civ.alive === true ? civ.incomeCents : 0);
  }
  return batch;
}

/**
 * @param {Map<number, number>} map
 * @param {number} key
 */
const get = (map, key) => map.get(key) || 0;
/**
 * @param {Map<number, number>} map
 * @param {number} key
 * @param {number} value
 */
const add = (map, key, value) => map.set(key, get(map, key) + value);

/**
 * What the payer can spend this turn: snapshot + income + world inflows - what it has already paid out.
 * @param {Batch} batch
 * @param {number} pid
 */
export function funds(batch, pid) {
  return get(batch.snapshot, pid) + get(batch.income, pid) + get(batch.worldIn, pid) - get(batch.out, pid);
}

/**
 * The projected end balance with every resolved flow in and out, which the guard and shortfall rules read.
 * @param {Batch} batch
 * @param {number} pid
 */
export function projected(batch, pid) {
  return funds(batch, pid) + get(batch.civIn, pid);
}

/**
 * A lender's balance for the 2 * P test: its snapshot less the principal it has committed this turn.
 * @param {Batch} batch
 * @param {number} pid
 */
export function lenderBalance(batch, pid) {
  return get(batch.snapshot, pid) - get(batch.committed, pid);
}

/**
 * @param {Batch} batch
 * @param {number} pid
 */
export function netOf(batch, pid) {
  return get(batch.worldIn, pid) + get(batch.civIn, pid) - get(batch.out, pid);
}

/**
 * Books one transfer's effect on both parties.
 * @param {Batch} batch
 * @param {Transfer} transfer
 */
export function record(batch, transfer) {
  const fromWorld = isWorldAccount(transfer.from);
  const toWorld = isWorldAccount(transfer.to);
  if (!fromWorld) add(batch.out, /** @type {number} */ (transfer.from), transfer.cents);
  if (toWorld) return;
  const to = /** @type {number} */ (transfer.to);
  if (fromWorld) add(batch.worldIn, to, transfer.cents);
  else add(batch.civIn, to, transfer.cents);
}

/**
 * @param {Batch} batch
 * @param {Transfer} transfer
 */
export function commit(batch, transfer) {
  add(batch.committed, /** @type {number} */ (transfer.from), transfer.cents);
}

/**
 * @param {Batch} batch
 * @param {number} pid
 * @param {number} amount
 */
export function addInfluence(batch, pid, amount) {
  add(batch.influence, pid, amount);
}

/**
 * @param {Batch} batch
 * @param {number} pid
 * @param {number} amount
 */
export function addCelebration(batch, pid, amount) {
  add(batch.celebration, pid, amount);
}

/**
 * What the game pays for an amount in cents. grantYield drops the part of a Gold (or a point of celebration) after
 * the whole number, toward zero: 10.37 lands as 10, -2.9 as -2, 0.6 as nothing (watched 2026-10-31, NOTES 119).
 * @param {number} cents
 */
export function wholeGold(cents) {
  return Math.trunc(cents / 100) * 100 || 0;
}

/**
 * The batch row the ledger keeps: one line per civ with its snapshot balance, its net Gold, Influence and
 * celebration, and what is paid this turn. Each civ is paid in whole Gold; the part left over carries to its next
 * batch, so a civ owed 0.4 Gold a turn gets 1 Gold every few turns instead of nothing.
 * @param {Batch} batch
 * @param {{ id: string, turn: number, civs: Civ[], prior?: BatchRecord | null }} q prior is the last batch, whose
 *   carries this one picks up
 * @returns {BatchRecord}
 */
export function commitBatch(batch, { id, turn, civs, prior = null }) {
  const before = new Map((prior?.civs || []).map((row) => [row.pid, row]));
  /** @type {BatchRow[]} */
  const rows = [];
  for (const civ of civs) {
    if (civ.alive !== true) continue;
    const last = before.get(civ.id);
    const net = netOf(batch, civ.id);
    const celebration = get(batch.celebration, civ.id);
    const goldDue = net + (last?.carry ?? 0);
    const celebrationDue = celebration + (last?.celebrationCarry ?? 0);
    const paid = wholeGold(goldDue);
    const celebrationPaid = wholeGold(celebrationDue);
    rows.push({ pid: civ.id, snapshot: get(batch.snapshot, civ.id), net, paid, carry: goldDue - paid,
      influence: get(batch.influence, civ.id), celebration, celebrationPaid,
      celebrationCarry: celebrationDue - celebrationPaid });
  }
  return { id, turn, civs: rows };
}

/**
 * The Gold a batch row pays; a row saved before 0.5.4 has no paid field, and the game paid its net in whole Gold.
 * @param {BatchRow} row
 */
export function paidOf(row) {
  return Number.isInteger(row.paid) ? /** @type {number} */ (row.paid) : wholeGold(row.net);
}

/**
 * The Gold a batch pays, as grants: what the game's treasuries move by, for the offline games.
 * @param {BatchRecord | null | undefined} batch
 * @returns {{ pid: number, cents: number }[]}
 */
export function paidGrants(batch) {
  return (batch?.civs || []).map((row) => ({ pid: row.pid, cents: paidOf(row) }));
}

/**
 * The celebration a batch row pays, as paidOf.
 * @param {BatchRow} row
 */
export function celebrationPaidOf(row) {
  return Number.isInteger(row.celebrationPaid) ? /** @type {number} */ (row.celebrationPaid)
    : wholeGold(row.celebration);
}

/**
 * On load: a civ's balance at snapshot + income + net means the batch landed; at snapshot + income it was lost in
 * the 3 s window and its grant is re-sent; anything else is unknown and left alone. `balances` and `incomes` are
 * Maps of pid to cents as read now.
 * @param {BatchRecord | null | undefined} batch
 * @param {Map<number, number>} balances
 * @param {Map<number, number>} [incomes]
 * @returns {{ pid: number, status: "landed" | "lost" | "unknown", cents: number }[]}
 */
export function batchStatus(batch, balances, incomes = new Map()) {
  /** @type {{ pid: number, status: "landed" | "lost" | "unknown", cents: number }[]} */
  const out = [];
  for (const row of batch?.civs || []) {
    const now = balances.get(row.pid);
    const earned = row.snapshot + get(incomes, row.pid);
    /** @type {"landed" | "lost" | "unknown"} */
    let status = "unknown";
    const paid = paidOf(row);
    if (now === earned + paid) status = "landed";
    else if (now === earned && paid !== 0) status = "lost";
    out.push({ pid: row.pid, status, cents: status === "lost" ? paid : 0 });
  }
  return out;
}
