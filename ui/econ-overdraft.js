// econ-overdraft.js - Economics: the overdraft's interest (DESIGN 4.18). A civ whose treasury is below 0 at the batch
// pays interest on what it's overdrawn each turn, at twice the bond market's rate to it, to the bond market. It's a
// due like a loan payment, so it's paid from the civ's funds and overdraft (econ-batch.js payable) and can take the
// treasury deeper. Past the overdraft's limit it's still charged in full, as a bank adds unpaid interest to the debt
// (lab W11: waived there, a civ past its limit paid nothing while one inside it paid). A civ a rule gave no overdraft
// (econ-params.js overdraftOf at 0) pays none. While the civ's income is above 0 the interest is capped at half of
// it, so income always pays the debt down; a civ that declared bankruptcy this turn pays none (econ-bankruptcy.js).

import { payable } from "./econ-batch.js";
import { BOND, OVERDRAFT, heldCents, overdraftOf } from "./econ-params.js";
import { bondRate } from "./econ-policy-read.js";
import { emit, event } from "./econ-turn.js";

/**
 * The interest on an overdrawn balance for one turn, in cents, rounded up; 0 at or above 0.
 * @param {number} balanceCents
 * @param {number} bondRatePpm
 */
export function overdraftInterest(balanceCents, bondRatePpm) {
  if (!(balanceCents < 0) || !(bondRatePpm > 0)) return 0;
  return Math.ceil((-balanceCents * bondRatePpm * OVERDRAFT.bondRateMultiple) / 1e6);
}

/**
 * The most a turn's overdraft interest can be: half the civ's income while it's above 0, no cap otherwise.
 * @param {number} incomeCents
 */
export function interestCapCents(incomeCents) {
  return incomeCents > 0 ? Math.floor((incomeCents * OVERDRAFT.interestIncomePct) / 100) : Infinity;
}

/**
 * Whether the civ pays overdraft interest this turn: alive, below zero, with an overdraft, and not bankrupt this turn.
 * @param {TurnContext} ctx
 * @param {Civ | undefined} civ
 */
function pays(ctx, civ) {
  if (!civ || civ.alive !== true || overdraftOf(civ) === 0 || ctx.bankrupt?.has(civ.id)) return false;
  return heldCents(civ) < 0;
}

/**
 * Charges one payer's overdraft interest, first among its dues (DESIGN 4.14 step 3).
 * @param {TurnContext} ctx
 * @param {number} pid
 */
export function chargeOverdraft(ctx, pid) {
  const civ = ctx.civ.get(pid);
  if (!pays(ctx, civ)) return;
  const held = heldCents(/** @type {Civ} */ (civ));
  const ratePpm = bondRate(ctx, pid);
  const full = overdraftInterest(held, ratePpm);
  const cents = Math.min(full, interestCapCents(/** @type {Civ} */ (civ).incomeCents));
  if (cents <= 0) return;
  const past = payable(ctx.batch, pid) < cents ? 1 : 0;
  emit(ctx, { id: `OD${pid}` }, { from: pid, to: BOND, cents, reason: "overdraft",
    parts: { overdrawn: -held, ratePpm: ratePpm * OVERDRAFT.bondRateMultiple, past, capped: cents < full ? 1 : 0 } });
  event(ctx, { kind: "overdraft", pid, cents, overdrawn: -held, ratePpm: ratePpm * OVERDRAFT.bondRateMultiple });
}
