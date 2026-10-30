// econ-tax-cards.js - Economics: the tax cards' numbers (DESIGN 4.7) and the Fiscal tab's forecast, as plain data.
// CARD_LEVELS is the one place the amounts are set: scripts/sync-tax-cards.mjs writes them into the cards'
// modifiers (data/econ-tax-gameeffects.xml) and the cards' description text, and tests/econ-data.test.mjs fails
// while the two disagree. Each card adds a flat amount to every settlement's Gold and Happiness, the shape of the
// base game's Priesthood, because the AI's card pass rates a card by its face value and passed over percentages of
// small Antiquity yields (P17 arms, DESIGN 10). War Levy pays a small part in peace and the rest only at war. The
// forecast multiplies the difference between the active card and the one forecast by the civ's settlements. Nothing
// here reads the engine.

export const CARD_PREFIX = "TRADITION_ECONOMICS_";

/**
 * Each card's change to every settlement's Gold and Happiness yield, a flat amount a turn, and what it adds on top
 * while its owner has a formal war (`atWar`, the war-gated modifiers' requirement), or null.
 * Light at -1 / +6 is the Light arms' arm 10 (2026-10-30): the first shape that three of five AIs took, each once grown
 * and short of Happiness, while Heavy and War Levy kept the others (DESIGN 4.7).
 * @type {Record<string, { gold: number, happiness: number, atWar: { gold: number, happiness: number } | null,
 *   nameKey: string }>}
 */
export const CARD_LEVELS = {
  LIGHT: { gold: -1, happiness: 6, atWar: null, nameKey: "LOC_ECONOMICS_CARD_LIGHT_NAME" },
  HEAVY: { gold: 4, happiness: -2, atWar: null, nameKey: "LOC_ECONOMICS_CARD_HEAVY_NAME" },
  WAR_LEVY: { gold: 2, happiness: -1, atWar: { gold: 6, happiness: -3 }, nameKey: "LOC_ECONOMICS_CARD_WAR_LEVY_NAME" },
};

/**
 * The level a card type carries, from its name: TRADITION_ECONOMICS_WAR_LEVY_EX is WAR_LEVY.
 * @param {string} type
 */
export function levelOf(type) {
  const match = /^TRADITION_ECONOMICS_([A-Z_]+)_[A-Z]{2}$/.exec(type);
  return match && Object.hasOwn(CARD_LEVELS, match[1]) ? match[1] : null;
}

/**
 * The amounts a level adds to each settlement right now: War Levy's peacetime part in peace and both parts at war,
 * no card 0.
 * @param {string | null} level
 * @param {boolean} atWar
 */
export function appliedAmounts(level, atWar) {
  const card = level ? CARD_LEVELS[level] : undefined;
  if (!card) return { gold: 0, happiness: 0 };
  const extra = atWar && card.atWar ? card.atWar : { gold: 0, happiness: 0 };
  return { gold: card.gold + extra.gold, happiness: card.happiness + extra.happiness };
}

/**
 * What a level adds to each settlement while its owner is at war, both parts together: Light and Heavy the same as in
 * peace, War Levy +8 / -4.
 * @param {string} level
 */
export function atWarAmounts(level) {
  return appliedAmounts(level, true);
}

/**
 * Turns until the next celebration at `perTurn` a turn with `left` still to fill, the way the game's own tooltip
 * counts them (at least 1); null when the meter isn't filling.
 * @param {number | null} left
 * @param {number} perTurn
 */
export function turnsToCelebration(left, perTurn) {
  if (left === null || !Number.isFinite(left)) return null;
  if (left <= 0) return 1;
  if (!(perTurn > 0)) return null;
  return Math.max(1, Math.ceil(left / perTurn));
}

/**
 * @typedef {{ goldCents: number, happinessCents: number, netHappinessCents: number, settlements: number,
 *   celebrationLeftCents: number | null, celebrating: boolean, atWar: boolean }} FiscalRead
 *   the civ's net Gold and Happiness a turn (the second twice, as the shown figure and the meter's gain), how many
 *   settlements it has,
 *   what the celebration meter still needs, whether a celebration is running, and whether the civ has a formal war
 */

/**
 * What `level` would do against the card active now (`activeLevel`, or null): the change in Gold and Happiness a
 * turn, and the turns to the next celebration under it. Every card pays in peace, War Levy only its smaller part.
 * @param {string | null} level the card to forecast, or null for no tax card
 * @param {string | null} activeLevel
 * @param {FiscalRead} read
 */
export function cardForecast(level, activeLevel, read) {
  const now = appliedAmounts(activeLevel, read.atWar);
  const then = appliedAmounts(level, read.atWar);
  const settlements = Math.max(0, Math.trunc(read.settlements) || 0);
  // `|| 0` keeps a change of nothing at 0 rather than -0.
  const goldDeltaCents = (then.gold - now.gold) * settlements * 100 || 0;
  const happinessDeltaCents = (then.happiness - now.happiness) * settlements * 100 || 0;
  return { goldDeltaCents, happinessDeltaCents,
    turnsToCelebration: read.celebrating ? null
      : turnsToCelebration(read.celebrationLeftCents, read.netHappinessCents + happinessDeltaCents) };
}
