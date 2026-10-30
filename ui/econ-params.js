// econ-params.js - Economics: the DESIGN's constants, and the engine's own negative-balance lines read from its
// GlobalParameters rows (the glue passes the rows in; tests pass the fixture dumped from the compiled gameplay DB).

// World accounts (DESIGN 4.14): a transfer touching one of these is a single grant, the only kind that creates or
// destroys Gold. Temple treasuries stand in for the bond market before Public debt (4.6).
export const BOND = "bond";
export const TEMPLE = "temple";
export const TAX = "tax";
// DESIGN 4.12: a development loan's Gold becomes build progress (addProgress), so it leaves the treasuries for good.
export const PROGRESS = "progress";
/** @type {Party[]} */
export const WORLD_ACCOUNTS = [BOND, TEMPLE, TAX, PROGRESS];

export const AGE = { ANTIQUITY: "AGE_ANTIQUITY", EXPLORATION: "AGE_EXPLORATION", MODERN: "AGE_MODERN" };

// DESIGN 4.3: 0.03 per turn before Exploration, 0.02 in Exploration, 0.015 in Modern.
/** @type {Record<string, number>} */
export const BASE_RATE_PPM = { AGE_ANTIQUITY: 30000, AGE_EXPLORATION: 20000, AGE_MODERN: 15000 };
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
// DESIGN 4.2: credit_cap = (12 + depth_turns - 4 * repudiations) * income - outstanding; service_cap = 0.35 * income.
export const CREDIT = { baseTurns: 12, perRepudiationTurns: 4, maxDepthTurns: 12, servicePct: 35 };
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
export const AI = { lendIncomeMultiple: 20, acceptRatePct: 120, restructureAt: 2, repudiateEveryTurns: 20,
  repudiateDebtMultiple: 10, minIncomeCents: 1000 };
// openPerBorrower and closedLoans are not in DESIGN: they bound the saved envelope (debt-5) with the event log DESIGN
// 9 asks for; see docs/NOTES.md choice 25.
export const LIMITS = { events: 100, closedLoans: 32, envelopeBytes: 65536, openPerBorrower: 6 };

export const STAGES = ["moneylending", "publicDebt", "trade", "guildPatronage", "charteredCompanies", "tariffs"];

// DESIGN 4.9: base price by resource class, in cents; an unknown class is priced as Bonus. Scarcity is
// sqrt(civs / copies) clamped 0.5 to 3; demand adds 0.25 for a strategic resource this age's units use, 0.25 more
// while two civs are at war, and 0.02 per Industry building for Factory resources, at most 1.0.
/** @type {Record<string, number>} */
export const BASE_PRICE_CENTS = { RESOURCECLASS_BONUS: 200, RESOURCECLASS_CITY: 300, RESOURCECLASS_EMPIRE: 400,
  RESOURCECLASS_TREASURE: 500, RESOURCECLASS_FACTORY: 600 };
export const PRICES = { otherCents: 200, scarcityMinPct: 50, scarcityMaxPct: 300, strategicPct: 25, warPct: 25,
  industryPct: 2, industryMaxPct: 100, smoothingPct: 80, historyTurns: 30 };
// DESIGN 4.10: the bill is half the summed prices, +10% per Trade building in the exporting city and -10% per one in
// the importing city (30% at most each side); tariffs hold back 10% or 25%; a payer pays at most 10% of its positive
// income in all; a tariff changes at most once per 5 turns, and a High one costs 1 relationship with each exporter
// it bills every 5 turns. The AI matches a High tariff 2 turns after it's set (DESIGN 6).
/** @type {Record<string, number>} */
export const TARIFF_PCT = { none: 0, low: 10, high: 25 };
export const TRADE = { billPct: 50, tradeBuildingPct: 10, tradeBuildingMaxPct: 30, capPct: 10, tariffEveryTurns: 5,
  highRelationship: -1, aiMatchTurns: 2 };
// DESIGN 4.12. Development loan: G / 3 Gold per point of progress, ceil(G * 5%) a turn for 25 turns (6% on a role
// building). General: ceil(G * 4.5% * growth) with growth clamped 0.5 to 2.0. Relationship +1 per 5, 7.5 and 2.5 turns
// of the host's income (at least 10 Gold a turn) for the development loan, general and aid. The cap of 10 on one
// gift's relationship gain is ours (NOTES choice 36), so Gold can't buy a whole relationship at once.
export const INVEST = { goldPerProgress: 3, term: 25, projectMille: 50, roleProjectMille: 60, generalMille: 45,
  growthMinMille: 500, growthMaxMille: 2000, minHostIncomeCents: 1000, projectTenthsPerPoint: 50,
  generalTenthsPerPoint: 75, aidTenthsPerPoint: 25, maxRelationship: 10, aiEveryTurns: 10, aiSizeTurns: 5,
  offerTurns: 3, incomeHistoryTurns: 10 };

/** @param {string | undefined} option */
export function ratesPct(option) {
  return (option !== undefined && RATES_PCT[option]) || RATES_PCT.standard;
}

/** @param {unknown} party */
export function isWorldAccount(party) {
  return WORLD_ACCOUNTS.includes(/** @type {Party} */ (party));
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
