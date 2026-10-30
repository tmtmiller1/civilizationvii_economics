// econ-params.js - Economics: the DESIGN's constants, and the engine's own negative-balance lines read from its
// GlobalParameters rows (the glue passes the rows in; tests pass the fixture dumped from the compiled gameplay DB).

// World accounts (DESIGN 4.14): a transfer touching one of these is a single grant, the only kind that creates or
// destroys Gold. Temple treasuries stand in for the bond market before Public debt (4.6).
export const BOND = "bond";
export const TEMPLE = "temple";
export const TAX = "tax";
// DESIGN 4.12: a development loan's Gold becomes build progress (addProgress), so it leaves the treasuries for good.
export const PROGRESS = "progress";
// DESIGN 4.17, 4.8, 4.11: a Civic market civ's citizens lend from outside the treasuries and their interest leaves
// them; inflation's erosion is a sink; cycle Gold is a source in a boom and a sink in a slump; the plan's Gold becomes
// build progress.
export const CITIZENS = "citizens";
export const INFLATION = "inflation";
export const CYCLE = "cycle";
export const PLAN = "plan";
/** @type {Party[]} */
export const WORLD_ACCOUNTS = [BOND, TEMPLE, TAX, PROGRESS, CITIZENS, INFLATION, CYCLE, PLAN];

export const AGE = { ANTIQUITY: "AGE_ANTIQUITY", EXPLORATION: "AGE_EXPLORATION", MODERN: "AGE_MODERN" };

// DESIGN 4.3: 0.015 per turn before Exploration, 0.01 in Exploration, 0.0075 in Modern (the owner's decision of
// 2026-10-30: the level at which a Market, Bazaar and Bank pay their own interest within the term).
/** @type {Record<string, number>} */
export const BASE_RATE_PPM = { AGE_ANTIQUITY: 15000, AGE_EXPLORATION: 10000, AGE_MODERN: 7500 };
export const BOND_FACTOR = 2;
export const RATE_CAP_MULTIPLE = 4;
/** @type {Record<string, number>} */
export const RELATION_PCT = { friendly: 80, neutral: 100, unfriendly: 130 };
// DESIGN 8: Low, Standard, High scale every rate.
/** @type {Record<string, number>} */
export const RATES_PCT = { low: 75, standard: 100, high: 125 };

// Standing in hundredths (DESIGN 4.2): 1.0 less 0.2 per active default, 0.1 per miss in the last 20 turns and 0.3
// per repudiation in the last 40 turns (half for a debt to an enemy at war), floored at 0.1.
export const STANDING = { full: 100, perDefault: 20, perMiss: 10, perRepudiation: 30, perRepudiationAtWar: 15,
  windowTurns: 20, repudiationWindowTurns: 40, floor: 10 };
// DESIGN 4.2: credit_cap = (12 + depth_turns - 4 * repudiations) * income - outstanding; service_cap = 0.5 * income.
export const CREDIT = { baseTurns: 12, perRepudiationTurns: 4, maxDepthTurns: 12, servicePct: 50 };
export const LENDER_BALANCE_MULTIPLE = 2;
export const MISS = { rateNum: 5, rateDen: 4, influence: -5, defaultAt: 3 };
export const RESTRUCTURE = { turns: 10 };
// DESIGN 4.5: garnish with income > 0, and the branch for income at or below 0 (NOTES finding C).
export const GARNISH = { outstandingPct: 10, incomePct: 50, lowOutstandingPct: 5, lowBalancePct: 10 };
// DESIGN 4.5: the grudge is 5 grievances per turn of the lender's income lost, 10 to 40; witnesses lose 3
// relationship, doubled for the bond market and temple treasuries, halved against an enemy at war.
export const REPUDIATION = { grudgePerTurn: 5, grudgeMin: 10, grudgeMax: 40, witness: 3, worldWitnessMultiple: 2,
  worldBlockTurns: 30, lenderBlockAges: 1, minLenderIncomeCents: 1000, maxTermWhileCounting: 10 };
// DESIGN 4.6: emergency_cap = max(100 Gold, 10 * |income|); insolvent after 5 turns at or below 0 income.
export const EMERGENCY = { minCapCents: 10000, incomeMultiple: 10, term: 10, insolventTurns: 5 };
export const TERMS = [10, 20, 30];
export const SHORT_TERM = 10;
// DESIGN 4.3: 20-turn terms open with Moneylending, 30-turn terms with Public debt.
export const MID_TERM = 20;
// The build loan (DESIGN 6): an AI with positive income borrows to put progress on its own current build while its
// credit is cheap (Boom or Steady), at most once per 10 turns, up to 5 turns of income over 10 turns and within the
// 4.2 limits.
export const AI = { lendIncomeMultiple: 20, acceptRatePct: 120, restructureAt: 2, repudiateEveryTurns: 20,
  repudiateDebtMultiple: 10, minIncomeCents: 1000, buildEveryTurns: 10, buildSizeTurns: 5, buildTerm: 10 };
// openPerBorrower and closedLoans are not in DESIGN: they bound the saved envelope (debt-5) with the event log DESIGN
// 9 asks for; see docs/NOTES.md choice 25.
export const LIMITS = { events: 100, closedLoans: 32, envelopeBytes: 65536, openPerBorrower: 6 };

export const STAGES = ["moneylending", "publicDebt", "trade", "guildPatronage", "charteredCompanies", "tariffs",
  "banking", "capitalism"];

// DESIGN 4.9: base price by resource class, in cents; an unknown class is priced as Bonus. Scarcity is
// sqrt(civs / copies) clamped 0.5 to 3; demand adds 0.25 for a strategic resource this age's units use, 0.25 more
// while two civs are at war, and 0.02 per Industry building for Factory resources, at most 1.0.
/** @type {Record<string, number>} */
export const BASE_PRICE_CENTS = { RESOURCECLASS_BONUS: 200, RESOURCECLASS_CITY: 300, RESOURCECLASS_EMPIRE: 400,
  RESOURCECLASS_TREASURE: 500, RESOURCECLASS_FACTORY: 600 };
export const PRICES = { otherCents: 200, scarcityMinPct: 50, scarcityMaxPct: 300, strategicPct: 25, warPct: 25,
  industryPct: 2, industryMaxPct: 100, smoothingPct: 80, capitalismSmoothingPct: 50, historyTurns: 30 };
// DESIGN 4.10: the bill is 2.5% of the summed prices (permille), +10% per Trade building in the exporting city and
// -10% per one in the importing city (30% at most each side); tariffs hold back 10% or 25%; a payer pays at most 10% of
// its positive income in all; a tariff changes at most once per 5 turns, and a High one costs 1 relationship with each
// exporter it bills every 5 turns. The AI answers a tariff in kind 2 turns after it's set, and stops counting a civ
// as a reason for its tariff after 20 turns in a row at peace with it while tariffed, or at once when Friendly
// (DESIGN 6).
/** @type {Record<string, number>} */
export const TARIFF_PCT = { none: 0, low: 10, high: 25 };
export const TRADE = { billPermille: 25, tradeBuildingPct: 10, tradeBuildingMaxPct: 30, capPct: 10,
  tariffEveryTurns: 5, highRelationship: -1, aiMatchTurns: 2, aiPartnerSharePct: 34, aiPeaceTurns: 20 };
// DESIGN 4.12. Development loan: G / 3 Gold per point of progress, ceil(G * 5%) a turn for 25 turns (6% on a role
// building). General: ceil(G * 4.5% * growth) with growth clamped 0.5 to 2.0. Relationship +1 per 5, 7.5 and 2.5 turns
// of the host's income (at least 10 Gold a turn) for the development loan, general and aid. The cap of 10 on one
// gift's relationship gain is ours (NOTES choice 36), so Gold can't buy a whole relationship at once.
export const INVEST = { goldPerProgress: 3, term: 25, projectMille: 50, roleProjectMille: 60, generalMille: 45,
  growthMinMille: 500, growthMaxMille: 2000, equityMinMille: 250, equityMaxMille: 3000,
  minHostIncomeCents: 1000, projectTenthsPerPoint: 50,
  generalTenthsPerPoint: 75, aidTenthsPerPoint: 25, maxRelationship: 10, aiEveryTurns: 10, aiSizeTurns: 5,
  offerTurns: 3, incomeHistoryTurns: 10 };

// DESIGN 4.11, in basis points (1/10000) so every weight is an integer: E starts at 10000 (1.0) and L at 0, and
// war declared, -0.02, is -200. k is the Business cycle option; s the world stage scale (DESIGN 4.15). Leverage is
// all outstanding loans in hundredths of a turn of the world's positive income: panicLeverPct 170 is 1.7 turns.
/** @type {Record<string, number>} */
export const CYCLE_K_PCT = { off: 0, mild: 50, standard: 100, strong: 150 };
export const CYCLE_RULES = { one: 10000, reversionPct: 10, worldClamp: 1000, eMin: 7000, eMax: 13000, lMax: 2000,
  lDecayPct: 80, depression: 8000, slump: 9500, boom: 10500, panicLeverPct: 170, panicDrop: 2000, panicTurns: 5,
  panicEveryTurns: 60, panicSpreadPct: 50, goldPct: 20, historyTurns: 30, eventsKept: 24, warehouseBp: 300,
  warehouseMaxBp: 3000, cushionMaxBp: 1000, cutMaxBp: 3500, scaleEarlyPct: 25, scalePublicDebtPct: 60,
  scaleCapitalismPct: 100, minLeverIncomeCents: 1000 };
// Event weights in basis points (DESIGN 4.11's table). The caps bound a sum of one kind in a turn. World income is
// read against its own trend, an average of its 10-turn growth that moves 4% of the way to each new read (about 50
// turns); each turn the world has spent in Boom pulls E down by 0.002 more, up to the cap.
export const CYCLE_WEIGHTS = { warDeclared: -200, warOngoing: -40, warOngoingCap: -200, capture: -100, raze: -200,
  disaster: -50, disasterPopulation: -100, crisisStart: -200, crisisOngoing: -50, default: -300, repudiation: -300,
  peace: 100, routeNew: 50, routeEnded: -50, incomePer5Pct: 50, incomeCap: 100, trendPct: 4, overheatPerTurn: -20,
  overheatCap: -300, creditGrowth: 150, creditGrowthPct: 10, reform: -300, corporatistWar: 100,
  corporatistPeace: -300 };
// DESIGN 4.8: pi = min(0.005, 0.02 * B / max(M, 1000)) a turn in ppm; reserve 20 turns of max(income, 10); bond rate
// up 50 * pi, at most 25%.
export const INFLATION_RULES = { capPpm: 5000, factorPpm: 20000, minMoneyCents: 100000, reserveTurns: 20,
  minIncomeCents: 1000, premiumPerPpm: 50, premiumCapPct: 25 };
// DESIGN 4.17: citizen loans and the plan. Citizens: 5 turns of max(10, income) per settlement with a Commerce
// building, 0.75 of the base rate, 10 turns, celebration at 6 times the interest paid (Light Taxation's 6 Happiness
// for each Gold it costs, so the two buy celebration at the same price); a miss costs 5 turns of the
// meter's gain, a repudiation 10, the citizens close for 30 turns. The plan: 20% of positive income at the game's
// purchase rate a point.
export const CITIZEN = { capTurns: 5, minIncomeCents: 1000, ratePct: 75, term: 10, celebrationMultiple: 6,
  missTurns: 5, repudiationTurns: 10, aiBalanceTurns: 10, aiSizeTurns: 5 };
// The plan buys progress at the game's own purchase rate, GOLD_PURCHASE_MULTIPLIER Gold a point (read at runtime;
// 4 when the read fails).
export const PLANNED = { takePct: 20, fallbackGoldPerPoint: 4 };
// DESIGN 4.17: a change of system blends each number evenly over 10 turns.
export const SYSTEM_BLEND_TURNS = 10;

/** @param {string | undefined} option */
export function ratesPct(option) {
  return (option !== undefined && RATES_PCT[option]) || RATES_PCT.standard;
}

/** @param {unknown} party */
export function isWorldAccount(party) {
  return WORLD_ACCOUNTS.includes(/** @type {Party} */ (party));
}

/**
 * The game's Gold price of a point of production, in cents, from GlobalParameters' GOLD_PURCHASE_MULTIPLIER (rows as
 * { Name: Value } or [{ Name, Value }]); null when it's missing or not a positive number, and the caller falls back.
 * Game speed scales a build's cost and its purchase price alike, and the glue reads a build's points at the game's
 * speed, so the price per point is the multiplier alone.
 * @param {unknown} rows
 * @returns {number | null}
 */
export function purchasePointCents(rows) {
  let value;
  if (Array.isArray(rows)) value = rows.find((row) => row && row.Name === "GOLD_PURCHASE_MULTIPLIER")?.Value;
  else if (rows && typeof rows === "object") value = /** @type {Record<string, unknown>} */ (rows).GOLD_PURCHASE_MULTIPLIER;
  const n = Number(value);
  return value !== undefined && value !== null && Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

/**
 * The negative-balance lines in cents from GlobalParameters rows, given as { Name: Value } or [{ Name, Value }].
 * A missing or unreadable line is null, and the guard then stays off rather than guess.
 * @param {unknown} rows
 * @returns {{ disbandLineCents: number | null, amenityLineCents: number | null }}
 */
export function engineLines(rows) {
  /** @type {Map<string, unknown>} */
  const byName = new Map();
  if (Array.isArray(rows)) {
    for (const row of rows) if (row && typeof row.Name === "string") byName.set(row.Name, row.Value);
  } else if (rows && typeof rows === "object") {
    for (const [name, value] of Object.entries(rows)) byName.set(name, value);
  }
  /** @param {string} name */
  const line = (name) => {
    if (!byName.has(name)) return null;
    const value = Number(byName.get(name));
    return Number.isFinite(value) ? Math.round(value * 100) : null;
  };
  return {
    disbandLineCents: line("GOLD_NEGATIVE_BALANCE_DISBAND_UNIT_LINE"),
    amenityLineCents: line("GOLD_NEGATIVE_BALANCE_AMENITY_LOSS_LINE"),
  };
}
