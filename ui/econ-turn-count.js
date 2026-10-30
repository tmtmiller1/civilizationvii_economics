// econ-turn-count.js - Economics: one turn count that keeps rising across the ages. The game's own turn restarts at 1
// in each new age (engine-closed), while the ledger, the stage turns and the 1.2 state carry over in the save, so the
// plan, its windows ("in the last 20 turns") and its "already planned" check need a count that doesn't go back. The
// glue keeps { age, base, last } in its envelope: the count is base + the game's turn, and when the age changes the
// base moves to the last count it saw. Nothing here reads the engine.

/**
 * @typedef {{ age: string | null, base: number, last: number }} TurnCount
 */

/** @returns {TurnCount} */
export function emptyTurnCount() {
  return { age: null, base: 0, last: 0 };
}

/**
 * The count read back from the save, with anything untrusted reset.
 * @param {unknown} raw
 * @returns {TurnCount}
 */
export function sanitizeTurnCount(raw) {
  const out = emptyTurnCount();
  if (!raw || typeof raw !== "object") return out;
  const value = /** @type {Record<string, unknown>} */ (raw);
  const count = (/** @type {unknown} */ x) => (Number.isInteger(x) && /** @type {number} */ (x) >= 0
    ? /** @type {number} */ (x) : 0);
  out.age = typeof value.age === "string" && value.age.length <= 64 ? value.age : null;
  out.base = count(value.base);
  out.last = count(value.last);
  return out;
}

/**
 * This turn's count, and the record to keep. A new age moves the base to the last count seen. The first read of a
 * save that has no record yet starts the base at the ledger's last planned turn when the game's turn is behind it (a
 * save from before the count existed, made after an age change), so the new age doesn't read as already planned.
 * @param {TurnCount} count
 * @param {string} age
 * @param {number} gameTurn
 * @param {number | null} [ledgerLastTurn]
 * @returns {{ count: TurnCount, turn: number }}
 */
export function countTurn(count, age, gameTurn, ledgerLastTurn = null) {
  const turnNow = Math.max(0, Math.floor(gameTurn) || 0);
  let base = count.base;
  if (count.age === null) {
    const planned = Number.isInteger(ledgerLastTurn) ? /** @type {number} */ (ledgerLastTurn) : 0;
    base = planned > turnNow ? planned : 0;
  } else if (count.age !== age) {
    base = Math.max(count.last, count.base);
  }
  const turn = base + turnNow;
  return { count: { age, base, last: Math.max(turn, count.age === age ? count.last : 0) }, turn };
}

/**
 * The game's own turn for a counted turn, for the screens: the turn within this age, or null for a turn of an
 * earlier age.
 * @param {TurnCount} count
 * @param {number} turn
 */
export function gameTurnOf(count, turn) {
  return turn > count.base ? turn - count.base : null;
}
