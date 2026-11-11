// econ-restore.js - Economics: a debt the game wipes stays on the books (DESIGN 4.18). At each civ's end-of-turn
// update the game adds its income and, when the civ has positive income, sets a balance still below 0 back to 0
// (engine-closed.md, 2026-10-29; no data value stops it, W11). So the glue notes each civ's balance just before its
// update and, when its turn opens, charges back what the game wiped: grantYield of the difference landed exactly every
// turn in lab W12. The human seat's update comes right after the TurnBegin batch, so its balance is the one read
// before the batch plus the batch's grant; the AIs' come after the seat ends its turn, so theirs are read then.

import { aliveMajorIds, isMultiplayer, listen, localId, readBalanceCents, readIncomeCents, safe,
  sendGold } from "./econ-engine.js";
import { logLine } from "./econ-log.js";

/**
 * What to charge back when a civ's turn opens, in whole-Gold cents (0 or below 0): the part of the debt its update
 * should have left that the game wiped. Nothing when the update left the civ at or above what it should have.
 * @param {number} preCents the balance just before the update
 * @param {number} netCents the civ's net Gold a turn, read after the update
 * @param {number} nowCents the balance after the update
 */
export function chargeBackCents(preCents, netCents, nowCents) {
  const expected = preCents + netCents;
  if (!(expected < 0) || !(nowCents > expected + 50)) return 0;
  return Math.round((expected - nowCents) / 100) * 100;
}

/** @type {Map<number, number>} the balance each civ had just before its update, cents */
const pre = new Map();
let on = () => false;

/**
 * The seat's balance before its update: what it held before the batch plus the batch's grant to it.
 * @param {number} beforeBatchCents
 * @param {number} grantCents
 */
export function noteSeatBeforeUpdate(beforeBatchCents, grantCents) {
  if (!on()) return;
  pre.set(localId(), beforeBatchCents + grantCents);
}

/** @param {any} data */
function onDeactivated(data) {
  const pid = data && (data.player ?? data.Player);
  if (!on() || pid !== localId()) return;
  for (const id of aliveMajorIds()) if (id !== pid) pre.set(id, readBalanceCents(id));
}

/** @param {any} data */
function onActivated(data) {
  const pid = data && (data.player ?? data.Player);
  if (!Number.isInteger(pid) || !pre.has(pid)) return;
  const before = /** @type {number} */ (pre.get(pid));
  pre.delete(pid);
  if (!on()) return;
  const cents = chargeBackCents(before, readIncomeCents(pid), readBalanceCents(pid));
  if (cents === 0) return;
  if (sendGold(pid, cents)) logLine(`restore: ${pid} had ${before / 100}, the update wiped it; charged back ${cents / 100}`);
}

/**
 * Starts the listeners. `active` says whether Economics is running this game (single player, a batch that isn't
 * skipped); with it off the game's own handling stands.
 * @param {() => boolean} active
 */
export function installRestore(active) {
  on = () => !safe(() => isMultiplayer(), true) && safe(active, false);
  listen("PlayerTurnDeactivated", onDeactivated);
  listen("PlayerTurnActivated", onActivated);
}
