// econ-tax-cards.js - Economics: the tax cards' numbers (DESIGN 4.7) and the Fiscal tab's forecast, as plain data.
// CARD_LEVELS is the one place the percentages are set: scripts/sync-tax-cards.mjs writes them into the cards'
// modifiers (data/econ-tax-gameeffects.xml) and the cards' description text, and tests/econ-data.test.mjs fails
// while the two disagree. The forecast reads the civ's settlement yields as they stand, takes the active card's
// share back out, and puts each card's share in, so the tab shows what a swap would change. Nothing here reads the
// engine.

export const CARD_PREFIX = "TRADITION_ECONOMICS_";

/**
 * Each card's change to every settlement's Gold and Happiness yield, in whole percent. War Levy's apply only while
 * its owner has a formal war (the modifiers' requirement).
 * @type {Record<string, { goldPct: number, happinessPct: number, needsWar: boolean, nameKey: string }>}
 */
export const CARD_LEVELS = {
  LIGHT: { goldPct: -15, happinessPct: 20, needsWar: false, nameKey: "LOC_ECONOMICS_CARD_LIGHT_NAME" },
  HEAVY: { goldPct: 15, happinessPct: -20, needsWar: false, nameKey: "LOC_ECONOMICS_CARD_HEAVY_NAME" },
  WAR_LEVY: { goldPct: 30, happinessPct: -40, needsWar: true, nameKey: "LOC_ECONOMICS_CARD_WAR_LEVY_NAME" },
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
 * The percentages a level applies right now: War Levy's are 0 in peace, no card is 0.
 * @param {string | null} level
 * @param {boolean} atWar
 */
export function appliedPct(level, atWar) {
  const card = level ? CARD_LEVELS[level] : undefined;
  if (!card || (card.needsWar && !atWar)) return { goldPct: 0, happinessPct: 0 };
  return { goldPct: card.goldPct, happinessPct: card.happinessPct };
}

/**
 * A yield with a percentage change taken back out, then another put in: `current` was raised by `fromPct`, and the
 * result is what it would read under `toPct`. A change of -100% leaves nothing to scale back, so it reads as 0.
 * @param {number} current
 * @param {number} fromPct
 * @param {number} toPct
 */
export function rescale(current, fromPct, toPct) {
  if (fromPct <= -100) return 0;
  return Math.round((current * (100 + toPct)) / (100 + fromPct));
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
 * @typedef {{ goldCents: number, happinessCents: number, netHappinessCents: number,
 *   celebrationLeftCents: number | null, celebrating: boolean, atWar: boolean }} FiscalRead
 *   the settlements' summed Gold and Happiness yields, the civ's net Happiness a turn, what the celebration meter
 *   still needs, whether a celebration is running, and whether the civ has a formal war
 */

/**
 * What `level` would do against the card active now (`activeLevel`, or null): the change in Gold and Happiness a
 * turn, the turns to the next celebration under it, and whether it pays at all today.
 * @param {string | null} level the card to forecast, or null for no tax card
 * @param {string | null} activeLevel
 * @param {FiscalRead} read
 */
export function cardForecast(level, activeLevel, read) {
  const now = appliedPct(activeLevel, read.atWar);
  const then = appliedPct(level, read.atWar);
  const goldDeltaCents = rescale(read.goldCents, now.goldPct, then.goldPct) - read.goldCents;
  const happinessDeltaCents = rescale(read.happinessCents, now.happinessPct, then.happinessPct) - read.happinessCents;
  const card = level ? CARD_LEVELS[level] : undefined;
  return { goldDeltaCents, happinessDeltaCents, paysNow: !card || !card.needsWar || read.atWar,
    turnsToCelebration: read.celebrating ? null
      : turnsToCelebration(read.celebrationLeftCents, read.netHappinessCents + happinessDeltaCents) };
}
