// econ-invariants.js - Economics: the TEST-PLAN section 2 invariants as pure checks over a plan and a ledger. Each
// returns a list of violations ({ id, detail }); an empty list is a pass. The tests feed crafted bad states to each.

import { LIMITS, MISS, isWorldAccount } from "./econ-params.js";
import { grantsFor, netGrants, transferKey, unbalancedPairs, worldNet } from "./econ-conservation.js";
import { utf8Bytes } from "./econ-state.js";
import { MARKETS_MAX_BYTES } from "./econ-markets.js";
import { MACRO_MAX_BYTES } from "./econ-macro-state.js";

// TEST-PLAN 12.2 for 1.1: econ-1 (civ-to-civ flows sum to 0) is debt-1 over the bills and dividends too, econ-2 (the
// grants equal the world flows) is debt-7 with the progress account among them, and econ-4 (no grant to a non-major
// or a world account) is alive-target. econ-3, econ-5 and econ-6 are below.

/**
 * debt-1: every civ-to-civ transfer's grants sum to zero.
 * @param {Grant[]} grants
 * @param {Transfer[]} transfers
 * @returns {Violation[]}
 */
export function debt1(grants, transfers) {
  return unbalancedPairs(grants, transfers).map((key) => ({ id: "debt-1", detail: key }));
}

/**
 * debt-2: no loan has O < 0; an active loan has fewer misses than the default line (DESIGN 4.4).
 * @param {Ledger} ledger
 * @returns {Violation[]}
 */
export function debt2(ledger) {
  /** @type {Violation[]} */
  const violations = [];
  for (const loan of ledger.loans) {
    if (loan.outstanding < 0) violations.push({ id: "debt-2", detail: `${loan.id} outstanding ${loan.outstanding}` });
    if (loan.state === "active" && loan.missed >= MISS.defaultAt) {
      violations.push({ id: "debt-2", detail: `${loan.id} missed ${loan.missed}` });
    }
  }
  return violations;
}

/**
 * debt-3: at most one transfer per (loan, turn), within this plan and against `issued` (keys already sent).
 * @param {Transfer[]} transfers
 * @param {Set<string>} [issued]
 * @returns {Violation[]}
 */
export function debt3(transfers, issued = new Set()) {
  /** @type {Violation[]} */
  const violations = [];
  const seen = new Set();
  for (const transfer of transfers) {
    const key = transferKey(transfer);
    if (seen.has(key) || issued.has(key)) violations.push({ id: "debt-3", detail: key });
    seen.add(key);
  }
  return violations;
}

/**
 * debt-4: the guard fires at most once per civ per turn.
 * @param {LedgerEvent[]} events
 * @returns {Violation[]}
 */
export function debt4(events) {
  /** @type {Violation[]} */
  const violations = [];
  const seen = new Set();
  for (const event of events) {
    if (event.kind !== "guard") continue;
    const key = `${event.pid}:${event.turn}`;
    if (seen.has(key)) violations.push({ id: "debt-4", detail: key });
    seen.add(key);
  }
  return violations;
}

/**
 * debt-5: the saved envelope fits in 64 KB.
 * @param {string} envelopeText
 * @returns {Violation[]}
 */
export function debt5(envelopeText) {
  const bytes = utf8Bytes(envelopeText);
  return bytes <= LIMITS.envelopeBytes ? [] : [{ id: "debt-5", detail: `${bytes} bytes` }];
}

/**
 * debt-6 (DESIGN 4.14 commit check): no payer goes past its funds. What a civ paid out this turn is at most its
 * snapshot balance plus income plus what world accounts put in plus the principal of loans that landed this turn;
 * other Gold from civs counts next turn.
 * @param {Transfer[]} transfers
 * @param {Civ[]} civs
 * @returns {Violation[]}
 */
export function debt6(transfers, civs) {
  /** @type {Map<Party, number>} */
  const out = new Map();
  /** @type {Map<Party, number>} */
  const worldIn = new Map();
  for (const transfer of transfers) {
    const fromWorld = isWorldAccount(transfer.from);
    if (!fromWorld) out.set(transfer.from, (out.get(transfer.from) || 0) + transfer.cents);
    if (isWorldAccount(transfer.to) || (!fromWorld && transfer.reason !== "principal")) continue;
    worldIn.set(transfer.to, (worldIn.get(transfer.to) || 0) + transfer.cents);
  }
  return civs.flatMap((civ) => {
    const paid = out.get(civ.id) || 0;
    const had = Math.max(0, civ.balanceCents + civ.incomeCents + (worldIn.get(civ.id) || 0));
    return paid > had ? [{ id: "debt-6", detail: `${civ.id} paid ${paid} with ${had}` }] : [];
  });
}

/**
 * debt-7 (DESIGN 4.14 commit check): the sum of civ grants equals the net of the world accounts.
 * @param {Grant[]} grants
 * @param {Transfer[]} transfers
 * @returns {Violation[]}
 */
export function debt7(grants, transfers) {
  let sum = 0;
  for (const net of netGrants(grants).values()) sum += net;
  const world = worldNet(transfers);
  return sum === world ? [] : [{ id: "debt-7", detail: `grants ${sum} world ${world}` }];
}

/**
 * TEST-PLAN 6: no grant targets a player who is not alive; a world account is never a grant target.
 * @param {Grant[]} grants
 * @param {Civ[]} civs
 * @returns {Violation[]}
 */
export function aliveTargets(grants, civs) {
  const alive = new Set(civs.filter((civ) => civ.alive === true).map((civ) => civ.id));
  return grants.filter((grant) => isWorldAccount(grant.pid) || !alive.has(/** @type {number} */ (grant.pid)))
    .map((grant) => ({ id: "alive-target", detail: `${grant.key} -> ${grant.pid}` }));
}

/**
 * econ-3: one progress grant per city per turn, so the glue's addProgress lands once on each build.
 * @param {ProgressRow[]} progress
 * @returns {Violation[]}
 */
export function econ3(progress) {
  /** @type {Violation[]} */
  const violations = [];
  const seen = new Set();
  for (const row of progress || []) {
    if (seen.has(row.cityId)) violations.push({ id: "econ-3", detail: row.cityId });
    seen.add(row.cityId);
  }
  return violations;
}

/**
 * econ-5: the markets envelope fits in 32 KB.
 * @param {string} marketsText
 * @returns {Violation[]}
 */
export function econ5(marketsText) {
  const bytes = utf8Bytes(marketsText);
  return bytes <= MARKETS_MAX_BYTES ? [] : [{ id: "econ-5", detail: `${bytes} bytes` }];
}

/**
 * econ-6: the macro envelope fits in 32 KB.
 * @param {string} macroText
 * @returns {Violation[]}
 */
export function econ6(macroText) {
  const bytes = utf8Bytes(macroText);
  return bytes <= MACRO_MAX_BYTES ? [] : [{ id: "econ-6", detail: `${bytes} bytes` }];
}

/**
 * @param {{ plan: PlanOutput, civs: Civ[], envelopeText?: string, issued?: Set<string>, marketsText?: string,
 *   macroText?: string }} q
 * @returns {Violation[]}
 */
export function checkPlan({ plan, civs, envelopeText, issued, marketsText, macroText }) {
  const grants = grantsFor(plan.transfers);
  return [
    ...debt1(grants, plan.transfers),
    ...debt2(plan.ledger),
    ...debt3(plan.transfers, issued),
    ...debt4(plan.events),
    ...(envelopeText === undefined ? [] : debt5(envelopeText)),
    ...debt6(plan.transfers, civs),
    ...debt7(grants, plan.transfers),
    ...aliveTargets(grants, civs),
    ...econ3(plan.progress),
    ...(marketsText === undefined ? [] : econ5(marketsText)),
    ...(macroText === undefined ? [] : econ6(macroText)),
  ];
}
