// econ-crisis-catalog.js - Economics: the crises a civ can be in and what it can do about them (DESIGN 4.11c), as
// plain data. A crisis is a kind with a condition the model reads each turn; a response is what a civ in it chooses,
// an immediate change plus a legacy, with the ages, crisis kinds, stages and systems it's open to; a legacy is what
// a response leaves behind, read by the rule it changes through crisisTerms (econ-crisis.js). The figures are the
// first numbers of DESIGN 4.11b and 4.11c. Nothing here reads the engine or moves Gold.

/** @typedef {"depression" | "credit-panic" | "price-shock" | "debt" | "inflation" | "trade-collapse"} CrisisKind */
/** @typedef {"AQ" | "EX" | "MO"} AgeKey */

/** The crisis kinds, with the ages each can come in. */
export const CRISIS_KINDS = /** @type {Record<CrisisKind, { ages: AgeKey[] }>} */ ({
  depression: { ages: ["AQ", "EX", "MO"] },
  "credit-panic": { ages: ["EX", "MO"] },
  "price-shock": { ages: ["AQ", "EX", "MO"] },
  debt: { ages: ["AQ", "EX", "MO"] },
  inflation: { ages: ["EX", "MO"] },
  "trade-collapse": { ages: ["EX", "MO"] },
});

/** The age key of an age type, Antiquity for anything unknown. @param {string | null | undefined} age */
export function ageKeyOf(age) {
  if (age === "AGE_EXPLORATION") return "EX";
  if (age === "AGE_MODERN") return "MO";
  return "AQ";
}

/**
 * One response. `runs` is how long it stands once taken: a turn count, or "crisis" (until the crisis ends, plus
 * `after` turns); a response that runs 0 turns is an act with no standing part. `legacy` is what it leaves: `turns`
 * from the day it's taken, or "age" (cleared at the age change; `nextAge` carries it one age on). `prefer` lists the
 * economic systems whose AI takes it first; `trap` marks the Hoover line, which the AI avoids unless it's the kind's
 * own (Mercantile civs raise tariffs).
 * @typedef {{ id: string, ages: AgeKey[], kinds: CrisisKind[], stage?: string, system?: string[] | null,
 *   notSystem?: string[], runs: number | "crisis", after?: number, oncePer: "crisis" | "age" | "game",
 *   costTurns?: number, legacy?: { turns?: number, age?: boolean, nextAge?: boolean, system?: string },
 *   prefer: string[], trap?: boolean, order: number, against?: string[] }} Response
 */

/** @type {Response[]} */
export const RESPONSES = [
  // Shared across the ages: the same three ideas with the age's own name and figures.
  { id: "public-works", against: ["tribute"], ages: ["AQ", "EX", "MO"], kinds: ["depression", "credit-panic", "debt", "trade-collapse"],
    runs: "crisis", after: 3, oncePer: "crisis", prefer: ["planned", "manorial", "market", "corporatist", "mixed"],
    order: 10 },
  // Relief leaves a mark only when it's ended early (relief-ended, econ-crisis-respond.js).
  { id: "relief", against: ["tribute", "corporatist"], ages: ["AQ", "EX", "MO"], kinds: ["depression", "price-shock", "trade-collapse"], runs: "crisis",
    after: 2, oncePer: "crisis", prefer: ["religious", "civicMarket", "mixed"], order: 20 },
  { id: "bank-holiday", against: ["market"], ages: ["AQ", "EX", "MO"], kinds: ["depression", "credit-panic", "debt"], runs: 3,
    oncePer: "age", legacy: { turns: 20 }, prefer: [], order: 30 },
  { id: "confidence", ages: ["AQ", "EX", "MO"], kinds: ["depression", "credit-panic", "price-shock", "debt",
    "inflation", "trade-collapse"], runs: 0, oncePer: "crisis", prefer: [], order: 90 },
  // Antiquity: the temple, the grain and the debt bondage.
  { id: "cancel-debts", against: ["merchantOligarchy", "mercantile"], ages: ["AQ"], kinds: ["debt", "depression"], runs: 5, oncePer: "age", legacy: { age: true },
    prefer: ["civicMarket"], order: 40 },
  { id: "debase", against: ["civicMarket", "merchantOligarchy"], ages: ["AQ"], kinds: ["debt", "depression", "price-shock"], runs: 5, oncePer: "age",
    legacy: { age: true }, prefer: ["palace", "tribute"], order: 50 },
  { id: "tribute", ages: ["AQ"], kinds: ["debt", "depression", "price-shock"], system: ["tribute"], runs: 0,
    oncePer: "crisis", legacy: { turns: 10 }, prefer: ["tribute"], order: 60 },
  { id: "temple-lends", against: ["merchantOligarchy"], ages: ["AQ"], kinds: ["debt", "depression"], runs: 0, oncePer: "age", legacy: { age: true },
    prefer: ["palace", "civicMarket", "mixed"], order: 70 },
  // Exploration: the bankers, the bullion and the companies.
  { id: "suspend", against: ["mercantile"], ages: ["EX"], kinds: ["debt", "credit-panic", "depression"], runs: 3, oncePer: "age",
    legacy: { turns: 20, age: true }, prefer: ["manorial"], order: 40 },
  { id: "recoinage", ages: ["EX", "MO"], kinds: ["inflation", "price-shock"], stage: "publicDebt", costTurns: 2,
    runs: 0, oncePer: "age", legacy: { age: true }, prefer: ["mercantile", "manorial", "religious", "mixed"],
    order: 50 },
  { id: "charter", against: ["manorial", "planned"], ages: ["EX"], kinds: ["trade-collapse", "depression", "debt"], stage: "charteredCompanies",
    runs: 20, oncePer: "age", legacy: { age: true }, prefer: ["mercantile"], order: 60 },
  { id: "navigation-acts", against: ["market"], ages: ["EX"], kinds: ["trade-collapse", "price-shock", "depression"], stage: "tariffs",
    runs: 10, oncePer: "age", legacy: { age: true }, prefer: ["mercantile"], trap: true, order: 70 },
  { id: "bullion", against: ["religious"], ages: ["EX"], kinds: ["debt", "depression", "credit-panic"], runs: 5, oncePer: "age",
    legacy: { turns: 20 }, prefer: ["manorial"], order: 80 },
  { id: "lend-crown", against: ["market"], ages: ["EX"], kinds: ["debt", "credit-panic", "depression"], runs: 0, oncePer: "age",
    legacy: { age: true }, prefer: ["manorial", "religious", "mixed"], order: 85 },
  // Modern: the New Deal and the Hoover trap.
  { id: "deposit-insurance", against: ["corporatist", "planned"], ages: ["MO"], kinds: ["credit-panic", "depression", "debt"], stage: "banking",
    costTurns: 2, runs: 0, oncePer: "game", legacy: { age: true, nextAge: true, system: "market" },
    prefer: ["market", "corporatist", "mixed"], order: 40 },
  { id: "gold-standard", ages: ["MO"], kinds: ["depression", "debt", "credit-panic"], stage: "publicDebt",
    notSystem: ["planned"], runs: 5, oncePer: "age", legacy: { age: true }, prefer: ["market", "corporatist"],
    order: 50 },
  { id: "price-supports", against: ["market"], ages: ["MO"], kinds: ["price-shock", "depression", "trade-collapse"], runs: "crisis",
    after: 0, oncePer: "crisis", legacy: { turns: 10 }, prefer: ["mercantile", "corporatist", "planned"], order: 60 },
  { id: "rearmament", against: ["religious", "market"], ages: ["MO"], kinds: ["depression", "trade-collapse", "credit-panic"], runs: 10,
    oncePer: "age", legacy: { turns: 20 }, prefer: ["corporatist", "planned"], order: 70 },
  { id: "austerity", against: ["civicMarket", "religious"], ages: ["AQ", "EX", "MO"], kinds: ["debt", "depression", "credit-panic", "inflation"],
    runs: "crisis", after: 0, oncePer: "crisis", prefer: ["tribute", "palace"], trap: true, order: 95 },
];

/**
 * How a civ's economic system meets a shared response (crisis paths phase 2): "advantage" when the response is one
 * its system prefers (a quarter less Gold), "opposition" when its system resists it (10 Influence more), else null.
 * @param {Response} spec
 * @param {string} system
 * @returns {"advantage" | "opposition" | null}
 */
export function affinityOf(spec, system) {
  // A mixed economy leans no way: the prefer lists name it only for the AI's fallback order.
  if (!system || system === "mixed") return null;
  if (spec.prefer.includes(system)) return "advantage";
  return (spec.against || []).includes(system) ? "opposition" : null;
}

/** The Influence a political opposition adds to a response, and the Gold factor an advantage takes off. */
export const AFFINITY = { oppositionInfluence: 10, advantageCostPct: 75 };

/** @param {string} id */
export function responseById(id) {
  return RESPONSES.find((row) => row.id === id) || null;
}

/**
 * The responses open to a civ for a crisis kind in an age, before the per-civ checks (stage, system, cost, once).
 * @param {CrisisKind} kind
 * @param {AgeKey} age
 */
export function responsesFor(kind, age) {
  return RESPONSES.filter((row) => row.ages.includes(age) && row.kinds.includes(kind))
    .sort((a, b) => a.order - b.order);
}

/**
 * The figures each response works with: Gold a settlement a turn, index weights in basis points, rate factors in
 * percent, turns. One place for the numbers (DESIGN 4.11b and 4.11c), by age where they scale.
 */
export const RESPONSE_RULES = {
  publicWorks: { goldPerSettlement: { AQ: 200, EX: 400, MO: 800 }, ownBp: 100, worldBp: 25, worldCapBp: 100,
    worldUnderBp: 9500 },
  relief: { goldPerSettlement: 100, celebrationPerSettlement: 400, earlyEndPenaltyPerSettlement: 200,
    earlyEndTurns: 10 },
  bankHoliday: { turns: 3, lenderLevel: -2, repPoints: -3, ownBp: 200 },
  confidence: { influence: 20, ownBp: 100, everyTurns: 5 },
  cancelDebts: { ownBp: 200, celebrationPerSettlement: 400, celebrationTurns: 5, repPoints: -20, templePct: 150,
    templeTurns: 20 },
  debase: { incomeTurns: 3, pricePctPerTurn: 2, turns: 5, ownRatePct: 125 },
  tribute: { incomeTurns: 2, grievance: 10, billPct: 200, turns: 10 },
  templeLends: { incomeTurns: 3, term: 20, worldTemplePct: 125 },
  suspend: { turns: 3, lenderLevel: -3, grievance: 10, bondPct: 150, bondTurns: 20 },
  recoinage: { costTurns: 2, erosionCapPct: 50 },
  charter: { capTurns: 2, billPct: 80, turns: 20, dividendPct: 20 },
  navigationActs: { turns: 10 },
  bullion: { incomeTurns: 3, pricePctPerTurn: 3, turns: 5, piExtraPpm: 2500, piTurns: 10, collapseHalfTurns: 20 },
  lendCrown: { capTurns: 4, level: 20 },
  depositInsurance: { costTurns: 2, panicPct: 50, capDepthPct: 75 },
  goldStandard: { pricePctPerTurn: 3, turns: 5, piExtraPpm: 5000, writeOffPct: 10, ownBp: 100, lenderLevel: -3,
    grievance: 10, repPoints: -10, legacyPiExtraPpm: 2500 },
  priceSupports: { floorPct: 90, lookbackTurns: 10, costIncomePct: 50, importerLevel: -1, everyTurns: 5 },
  rearmament: { turns: 10, ownBp: 50, armyFactor: 1.5, goldPerSettlement: 100, neighbourPlots: 20, neighbourLevel: -1 },
  austerity: { repPoints: 3, ownBp: -100 },
  tradeWar: { highHolders: 3, worldBp: -50 },
  bankRun: { defaults: 2, ownBp: -200, closedTurns: 5 },
  bankFailures: { defaultSharePct: 20, closedTurns: 5, capTurnsLost: 2 },
  bonusArmy: { turns: 5, ownBp: -100 },
  dustBowl: { factor: 2 },
  bubble: { creditTurns: 5, classPct: 40, burstBelowBp: 9500, withinTurns: 10 },
  cascade: { suspensions: 2, withinTurns: 5, closedTurns: 5 },
};

/** The crisis conditions' figures. */
export const CRISIS_RULES = { spacingTurns: 30, maxAtOnce: 2, priceShockPct: 40, priceLookback: 10, duesTurns: 3,
  hotTurns: 5, goldStandardTurns: 10, collapseSharePct: 33, collapseWithin: 5, keepTurns: 6 };
