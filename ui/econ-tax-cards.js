// econ-tax-cards.js - Economics: the tax cards' numbers (DESIGN 4.7) and the Fiscal tab's forecast, as plain data.
// CARD_LEVELS is the one place the amounts are set: scripts/sync-tax-cards.mjs writes them into the cards'
// modifiers (data/econ-tax-gameeffects.xml) and the cards' description text, and tests/econ-data.test.mjs fails
// while the two disagree. Each card adds a flat amount to every settlement's Gold and Happiness, the shape of the
// base game's Priesthood, because the AI's card pass rates a card by its face value and passed over percentages of
// small Antiquity yields (P17 arms, DESIGN 10). An amount can differ by age: it's then a record by age suffix, and
// that yield gets one modifier per age (MOD_ECONOMICS_LIGHT_HAPPINESS_EX) and the card one description per age, which
// each age's card file points at. War Levy pays a small part in peace and the rest only at war. The forecast
// multiplies the difference between the active card and the one forecast by the civ's settlements. Nothing here reads
// the engine.

export const CARD_PREFIX = "TRADITION_ECONOMICS_";

/** The age suffixes of the card types, in age order: TRADITION_ECONOMICS_LIGHT_EX is Exploration's Light. */
export const AGE_SUFFIXES = /** @type {const} */ (["AQ", "EX", "MO"]);

/** @typedef {typeof AGE_SUFFIXES[number]} AgeSuffix */
/** @typedef {number | Record<AgeSuffix, number>} CardAmount the same in every age, or one figure per age */

/**
 * Each card's change to every settlement's Gold and Happiness yield, a flat amount a turn, and what it adds on top
 * while its owner has a formal war (`atWar`, the war-gated modifiers' requirement), or null.
 * Light at -1 / +6 is the Light arms' arm 10 (2026-10-30): the first shape that three of five AIs took, each once grown
 * and short of Happiness, while Heavy and War Levy kept the others (DESIGN 4.7). Its Happiness falls to +4 in
 * Exploration and +3 in Modern (2026-10-30, owner's call): in the merged watch all five AIs held the +6 card through
 * both later ages at 35 to 266 Happiness a turn.
 * @type {Record<string, { gold: CardAmount, happiness: CardAmount,
 *   atWar: { gold: number, happiness: number } | null, nameKey: string }>}
 */
export const CARD_LEVELS = {
  LIGHT: { gold: -1, happiness: { AQ: 6, EX: 4, MO: 3 }, atWar: null, nameKey: "LOC_ECONOMICS_CARD_LIGHT_NAME" },
  HEAVY: { gold: 4, happiness: -2, atWar: null, nameKey: "LOC_ECONOMICS_CARD_HEAVY_NAME" },
  WAR_LEVY: { gold: 2, happiness: -1, atWar: { gold: 6, happiness: -3 }, nameKey: "LOC_ECONOMICS_CARD_WAR_LEVY_NAME" },
};

/**
 * An amount in one age; a per-age amount read for an age it doesn't name gives its Antiquity figure.
 * @param {CardAmount} amount
 * @param {string | null | undefined} age an age suffix
 */
export function amountIn(amount, age) {
  if (typeof amount === "number") return amount;
  return Object.hasOwn(amount, String(age)) ? amount[/** @type {AgeSuffix} */ (age)] : amount.AQ;
}

/**
 * Whether a level's amounts differ by age, so it has a modifier and a description per age.
 * @param {string} level
 */
export function variesByAge(level) {
  const card = CARD_LEVELS[level];
  return !!card && (typeof card.gold !== "number" || typeof card.happiness !== "number");
}

/**
 * The modifiers a card of `level` in `age` carries, in the order its card file lists them: Gold, Happiness, then any
 * at-war pair. A yield that differs by age has the age's suffix.
 * @param {string} level
 * @param {AgeSuffix} age
 */
export function modifierIds(level, age) {
  const card = CARD_LEVELS[level];
  if (!card) return [];
  const id = (/** @type {string} */ yieldName, /** @type {CardAmount} */ amount) =>
    `MOD_ECONOMICS_${level}_${yieldName}${typeof amount === "number" ? "" : `_${age}`}`;
  const ids = [id("GOLD", card.gold), id("HAPPINESS", card.happiness)];
  if (card.atWar) ids.push(`MOD_ECONOMICS_${level}_AT_WAR_GOLD`, `MOD_ECONOMICS_${level}_AT_WAR_HAPPINESS`);
  return ids;
}

/**
 * The description key of a card of `level` in `age`: one per age when its amounts differ by age.
 * @param {string} level
 * @param {AgeSuffix} age
 */
export function descriptionKey(level, age) {
  return `LOC_ECONOMICS_CARD_${level}_DESCRIPTION${variesByAge(level) ? `_${age}` : ""}`;
}

/**
 * The age suffix of a card type: TRADITION_ECONOMICS_LIGHT_EX is EX; null for anything else.
 * @param {string} type
 * @returns {AgeSuffix | null}
 */
export function ageOf(type) {
  const match = /^TRADITION_ECONOMICS_[A-Z_]+_([A-Z]{2})$/.exec(type);
  return match && AGE_SUFFIXES.includes(/** @type {AgeSuffix} */ (match[1])) ? /** @type {AgeSuffix} */ (match[1])
    : null;
}

/**
 * A level's peacetime amounts in an age.
 * @param {string} level
 * @param {string | null | undefined} age an age suffix
 */
export function cardAmounts(level, age) {
  const card = CARD_LEVELS[level];
  if (!card) return { gold: 0, happiness: 0 };
  return { gold: amountIn(card.gold, age), happiness: amountIn(card.happiness, age) };
}

/**
 * The level a card type carries, from its name: TRADITION_ECONOMICS_WAR_LEVY_EX is WAR_LEVY.
 * @param {string} type
 */
export function levelOf(type) {
  const match = /^TRADITION_ECONOMICS_([A-Z_]+)_[A-Z]{2}$/.exec(type);
  return match && Object.hasOwn(CARD_LEVELS, match[1]) ? match[1] : null;
}

/**
 * The amounts a level adds to each settlement right now in an age: War Levy's peacetime part in peace and both parts
 * at war, no card 0.
 * @param {string | null} level
 * @param {boolean} atWar
 * @param {string | null | undefined} age an age suffix
 */
export function appliedAmounts(level, atWar, age) {
  const card = level ? CARD_LEVELS[level] : undefined;
  if (!card || !level) return { gold: 0, happiness: 0 };
  const base = cardAmounts(level, age);
  const extra = atWar && card.atWar ? card.atWar : { gold: 0, happiness: 0 };
  return { gold: base.gold + extra.gold, happiness: base.happiness + extra.happiness };
}

/**
 * What a level adds to each settlement while its owner is at war, both parts together: Light and Heavy the same as in
 * peace, War Levy +8 / -4.
 * @param {string} level
 * @param {string | null | undefined} age an age suffix
 */
export function atWarAmounts(level, age) {
  return appliedAmounts(level, true, age);
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
 * turn, and the turns to the next celebration under it, at the amounts of the cards of `age`. Every card pays in peace,
 * War Levy only its smaller part.
 * @param {string | null} level the card to forecast, or null for no tax card
 * @param {string | null} activeLevel
 * @param {FiscalRead} read
 * @param {string | null | undefined} age the age suffix of this age's cards
 */
export function cardForecast(level, activeLevel, read, age) {
  const now = appliedAmounts(activeLevel, read.atWar, age);
  const then = appliedAmounts(level, read.atWar, age);
  const settlements = Math.max(0, Math.trunc(read.settlements) || 0);
  // `|| 0` keeps a change of nothing at 0 rather than -0.
  const goldDeltaCents = (then.gold - now.gold) * settlements * 100 || 0;
  const happinessDeltaCents = (then.happiness - now.happiness) * settlements * 100 || 0;
  return { goldDeltaCents, happinessDeltaCents,
    turnsToCelebration: read.celebrating ? null
      : turnsToCelebration(read.celebrationLeftCents, read.netHappinessCents + happinessDeltaCents) };
}
