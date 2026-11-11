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
// AI-PLAN 4.2: next turn's dues are held outside the treasury between the payments, so the native AI can't spend
// them; the account nets to zero over a loan's life.
export const ESCROW = "escrow";
/** @type {Party[]} */
export const WORLD_ACCOUNTS = [BOND, TEMPLE, TAX, PROGRESS, CITIZENS, INFLATION, CYCLE, PLAN, ESCROW];

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

// The standing of DESIGN 4.2 as it was before credit reputation (AI-PLAN 4.4): 1.0 less 0.2 per active default, 0.1
// per miss in the last 20 turns and 0.3 per repudiation in the last 40 turns (half for a debt to an enemy at war),
// floored at 0.1. The floor still bounds the rate's divisor; the rest converts an older save's rows into its
// opening reputation (NOTES 129). The windows still bound the rows the ledger keeps.
export const STANDING = { full: 100, perDefault: 20, perMiss: 10, perRepudiation: 30, perRepudiationAtWar: 15,
  windowTurns: 20, repudiationWindowTurns: 40, floor: 10 };
// AI-PLAN 4.4: credit reputation, 0 to 100 per civ, the standing every rate and the credit cap read. A repudiation
// costs 30 (15 against an enemy at war), a default 20, a miss 5; a loan repaid in full earns 5, ten payments on
// time 2, a loan made or aid given 3, never above 100; what's lost mends by half every 50 turns. A loan repaid in
// full also books favors on the lender; a repudiation hits the lender's relationship by 10 to 30, sized like the
// grudge.
export const REPUTATION = { full: 100, repudiation: 30, repudiationAtWar: 15, default: 20, miss: 5, repaid: 5,
  onTime: 2, onTimeEvery: 10, lent: 3, halfLifeTurns: 50, favorsOnRepayment: 5 };
// DESIGN 4.2: credit_cap = (12 + depth_turns - lost turns) * income - outstanding, with 4 turns lost for every 30
// points of reputation gone (a fresh repudiation's worth, AI-PLAN 4.4); service_cap = 0.5 * income.
export const CREDIT = { baseTurns: 12, perRepudiationTurns: 4, maxDepthTurns: 12, servicePct: 50 };
export const LENDER_BALANCE_MULTIPLE = 2;
export const MISS = { rateNum: 5, rateDen: 4, influence: -5, defaultAt: 3 };
export const RESTRUCTURE = { turns: 10 };
// DESIGN 4.5: garnish with income > 0, and the branch for income at or below 0 (NOTES finding C). The share of the
// outstanding is never under 1 Gold (minCents), and a defaulted loan closes once under 1 Gold is left
// (closeUnderCents), so the last few Gold don't take dozens of turns (AI-PLAN section 2).
export const GARNISH = { outstandingPct: 10, incomePct: 50, lowOutstandingPct: 5, lowBalancePct: 10, minCents: 100,
  closeUnderCents: 100 };
// AI-PLAN 4.1: a civ whose dues this turn pass its funds, with income above 0, gets a refinancing loan for the gap
// over 10 turns, judged by the credit cap alone.
export const REFINANCE = { term: 10 };
// AI-PLAN 4.3: the look-ahead reads three turns of dues; a civ's reserve is 10 turns of income or the next three
// turns' dues plus a turn of upkeep, whichever is more; an AI above it puts half the surplus into its dearest loan.
export const RESERVE = { aheadTurns: 3, incomeTurns: 10, repaySharePct: 50 };
// AI-PLAN 4.2: a civ in distress this turn has two turns' dues held.
export const ESCROW_RULES = { distressTurns: 2 };
// AI-PLAN 4.2 (watched 4.7): while an AI's debt service is above a tenth of its income, its Gold yield bias is scaled
// by 1 + 10 * service / income, at most 5; while it's in distress its army and expansion budgets are scaled by the
// inverse, never below 0.25. Each factor is sent every turn, 1 when not needed.
export const AI_PREFERENCE = { serviceSharePct: 10, goldPerShare: 10, goldMax: 5, budgetMin: 0.25,
  goldSystem: "YieldBiases", goldItem: "YIELD_GOLD", budgetSystem: "AiBudgetBiases",
  budgetItems: ["AI_BUDGET_STANDING_ARMY", "AI_BUDGET_EXPANSION"] };
// DESIGN 4.5: the grudge is 5 grievances per turn of the lender's income lost, 10 to 40; witnesses lose 3
// relationship, doubled for the bond market and temple treasuries, halved against an enemy at war.
// Making amends (DESIGN 4.5): the wronged civ lender is closed for 10 turns, then lends again at 1.5 times its rate
// for 10 turns at most; repaying such a loan in full books favors worth half the grudge and a named favor from every
// other major, and the repudiation stops counting against the borrower's credit. An AI asks for about 3 turns of its
// income.
export const REPUDIATION = { grudgePerTurn: 5, grudgeMin: 10, grudgeMax: 40, witness: 3, worldWitnessMultiple: 2,
  worldBlockTurns: 30, lenderBlockAges: 1, minLenderIncomeCents: 1000, maxTermWhileCounting: 10, lenderHitMin: 10,
  lenderHitMax: 30, amendsCoolTurns: 10, amendsRatePct: 150, amendsTerm: 10, amendsFavorPct: 50,
  amendsIncomeTurns: 3 };
// DESIGN 4.6: emergency_cap = max(100 Gold, 10 * |income|); insolvent after 5 turns at or below 0 income.
export const EMERGENCY = { minCapCents: 10000, incomeMultiple: 10, term: 10, insolventTurns: 5 };
export const TERMS = [10, 20, 30];
export const SHORT_TERM = 10;
// DESIGN 4.3: 20-turn terms open with Moneylending, 30-turn terms with Public debt.
export const MID_TERM = 20;
// The build loan (DESIGN 6): what an AI asks for when it wants capital, as against the emergency loan it takes when
// it needs it. It borrows for its own current build when the build pays for itself (its Gold yield over the term
// covers the interest) or is slow (8 turns or more left on the city's own production), its credit is cheap (Boom or
// Steady), it isn't in distress and it has no build loan open; sized to what it can carry as a want (its loan service
// with the new loan within 30% of income), up to 5 turns of income over 10 turns and within the 4.2 limits. No
// timer: the reasons decide.
// AI-PLAN 4.4: an AI weighs a repudiation when the Gold it would keep is above 4 turns of income (10 Gold at the
// least) and the lender is at war with it, or Unfriendly and weaker, or it's insolvent and the lender isn't Friendly.
export const AI = { lendIncomeMultiple: 20, amendsLendIncomeMultiple: 5, acceptRatePct: 120, repudiateEveryTurns: 20,
  repudiateKeepTurns: 4, minIncomeCents: 1000, buildSizeTurns: 5, buildTerm: 10, buildSlowTurns: 8,
  buildServiceMaxPct: 30 };
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
// building). General: ceil(G * 4.5% * growth) with growth clamped 0.5 to 2.0. Relationship +1 per 1, 1.5 and 0.5
// turns of the host's income (at least 10 Gold a turn) for the development loan, general and aid, so the default
// 300 Gold shows a gain against a mid-game host (NOTES choice 63). The cap of 20 on one gift is ours, under the
// game's 30-point band, so Gold can't buy a whole relationship step at once.
export const INVEST = { goldPerProgress: 3, term: 25, projectMille: 50, roleProjectMille: 60, generalMille: 45,
  growthMinMille: 500, growthMaxMille: 2000, equityMinMille: 250, equityMaxMille: 3000,
  minHostIncomeCents: 1000, projectTenthsPerPoint: 10,
  generalTenthsPerPoint: 15, aidTenthsPerPoint: 5, maxRelationship: 20, aiSizeTurns: 5,
  offerTurns: 3, incomeHistoryTurns: 10 };
// AI-PLAN 4.5: the stake score (the terms of stakeOf in econ-stake.js) and the rules on it. An AI invests from what
// it holds above its reserve in the host with the best stake of 8 or more, 3 to 8 turns of income rising with the
// stake, one open investment per host; aids a host with a stake of 10 or more that's in default, in Depression, or
// at war with the AI's enemy and short, sized to buy it back past the Friendly line within 5 turns of income, once per
// 15 turns per host; lends to a civ with a reputation of 50 or more and a stake of 0 or more. The Friendly line and
// the top of Hostile come from the game's DiplomacyPlayerRelationships rows times its relationship scale (30 and -60
// in 1.5.0: relationshipBands), read once a session; friendlyLevel and hostileLevel here stand in when that read
// fails. Lab readings (the ninth run) had Neutral up to 30 and Friendly from 31.
export const STAKE = { levelDiv: 3, perRoute: 3, routesMax: 9, allied: 6, sharedEnemy: 4, neighbourPlots: 20,
  neighbour: 3, agendaDiv: 2, growing: 3, hostile: -6, hostileLevel: -60, repDiv: 10, investMin: 8,
  investTurnsMin: 3, investTurnsMax: 8, investTurnsPerStake: 0.5, aidMin: 10, aidEveryTurns: 15, aidIncomeTurns: 5,
  friendlyLevel: 30, lendRepMin: 50, lendStakeMin: 0, offerEveryTurns: 10 };

/**
 * The relationship bands the stake reads (AI-PLAN 4.5): the Friendly line is PLAYER_RELATIONSHIP_FRIENDLY's
 * MinRelationship and the top of Hostile is PLAYER_RELATIONSHIP_HOSTILE's MaxRelationship, both times the game's
 * DIPLOMACY_RELATIONSHIP_CHARACTERISTIC_SCALE (30 in 1.5.0, so 30 and -60; the ninth run read Neutral up to 30 and
 * Friendly from 31). A row another mod changed is read as it stands; a missing row or scale leaves STAKE's number.
 * @param {unknown} rows GlobalParameters as { Name: Value } or [{ Name, Value }]
 * @param {unknown} bands DiplomacyPlayerRelationships rows, each with its type, MinRelationship and MaxRelationship
 * @returns {{ friendlyLevel: number, hostileLevel: number }}
 */
export function relationshipBands(rows, bands) {
  /** @type {unknown} */
  let scaleValue;
  const name = "DIPLOMACY_RELATIONSHIP_CHARACTERISTIC_SCALE";
  if (Array.isArray(rows)) scaleValue = rows.find((row) => row && row.Name === name)?.Value;
  else if (rows && typeof rows === "object") scaleValue = /** @type {Record<string, unknown>} */ (rows)[name];
  const scale = Number(scaleValue);
  /** @param {string} type @param {string} field @param {number} fallback */
  const edge = (type, field, fallback) => {
    if (!Number.isFinite(scale) || scale <= 0 || !Array.isArray(bands)) return fallback;
    const row = bands.find((b) => b && b.DiplomacyPlayerRelationshipType === type);
    const value = Number(row?.[field]);
    return Number.isFinite(value) ? value * scale : fallback;
  };
  return { friendlyLevel: edge("PLAYER_RELATIONSHIP_FRIENDLY", "MinRelationship", STAKE.friendlyLevel),
    hostileLevel: edge("PLAYER_RELATIONSHIP_HOSTILE", "MaxRelationship", STAKE.hostileLevel) };
}

// DESIGN 4.11, in basis points (1/10000) so every weight is an integer: E starts at 10000 (1.0) and L at 0, and
// war declared, -0.02, is -200. k is the Business cycle option; s the world stage scale (DESIGN 4.15). Leverage is
// all outstanding loans in hundredths of a turn of the world's positive income: panicLeverPct 170 is 1.7 turns.
/** @type {Record<string, number>} */
export const CYCLE_K_PCT = { off: 0, mild: 50, standard: 100, strong: 150 };
export const CYCLE_RULES = { one: 10000, reversionPct: 10, worldClamp: 1000, lMax: 2000,
  lDecayPct: 80, depression: 8000, slump: 9500, boom: 10500, panicLeverPct: 170, panicDrop: 2000, panicTurns: 5,
  panicSpreadPct: 50, historyTurns: 30, eventsKept: 24, warehouseBp: 300,
  warehouseMaxBp: 3000, cushionMaxBp: 1000, cutMaxBp: 3500, scalePublicDebtPct: 60,
  scaleCapitalismPct: 100, minLeverIncomeCents: 1000 };
// The Swings setup option: how far the cycle runs. Momentum carries that share of last turn's move into this one, so
// a fall feeds on itself and a boom overshoots when it turns; goldPct is the share of E + L - 1 paid or charged on
// income; E stays within eMin to eMax; scaleEarlyPct is s before Public debt; Panics come at most once in
// panicEveryTurns. Gentle is the cycle before 0.5.3. Volatile's worst turns cost about half a civ's income in the
// Node simulation, about what an age's crisis takes (NOTES 118).
/** @type {Record<string, { momentumPct: number, goldPct: number, eMin: number, eMax: number, scaleEarlyPct: number,
 *   panicEveryTurns: number }>} */
export const CYCLE_SWINGS = {
  gentle: { momentumPct: 0, goldPct: 20, eMin: 7000, eMax: 13000, scaleEarlyPct: 25, panicEveryTurns: 60 },
  volatile: { momentumPct: 80, goldPct: 100, eMin: 5000, eMax: 15000, scaleEarlyPct: 40, panicEveryTurns: 80 },
  extreme: { momentumPct: 90, goldPct: 100, eMin: 5000, eMax: 15000, scaleEarlyPct: 40, panicEveryTurns: 80 } };
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
 * The guard's line (DESIGN 4.6): 0 Gold, where the penalties of a treasury below zero start (DESIGN 4.18). The game's
 * GOLD_NEGATIVE_BALANCE_* lines were read here once; lab W10 (2026-11-10) found the game never acts on them.
 */
export const GUARD_LINE_CENTS = 0;

// DESIGN 4.18, below zero (the owner's call 2026-11-10: the game's own handling of a negative treasury is thin).
// Obligations (loan payments, garnish, bills, dividends, taxes, the plan's take, cycle charges, standing lines) are
// paid into an overdraft down to max(100 Gold, 10 turns of |income|); past it they miss as before. Discretionary
// spending (lending, aid, investing, crisis responses, escrow) still needs Gold in hand. A balance below zero at the
// batch pays interest at twice the bond rate and loses reputation each turn.
// The interest never takes more than half the civ's income while that income is above 0, so a civ earning Gold always
// pays its debt down (lab W15: the Ottomans at -6,000 with +190 a turn sank 2,000 deeper in 22 turns).
export const OVERDRAFT = { minCents: 10000, incomeTurns: 10, bondRateMultiple: 2, repPerTurn: 2,
  interestIncomePct: 50 };
// Bankruptcy (DESIGN 4.18): a civ below zero writes its treasury back to 0 and repudiates every loan it has, at most
// once in `everyTurns`. An AI weighs it each turn it's below zero (econ-bankruptcy.js bankruptcyWeighing), in Gold:
// staying costs every turn until it's back above zero, at most `horizonTurns`, of interest, Happiness in every
// settlement (`goldPerHappiness` a point), the price premium on the share of its income it spends on purchases,
// credit rating, units disbanded (`unitIncomeTurns` of income each) and the output of shut settlements (their share
// of income and production, times `shutOutputShare` since the costliest shuts first); bankruptcy costs the credit
// rating (`repPointIncomeTurns` of income a point), the witnesses' note and each civ lender's grudge
// (`grievanceIncomeTurns` a point, the lender's weighted by `lenderWeight` and by `strongerLender` when it's stronger),
// and the bond market for 30 turns (`bondAccessIncomeTurns`, half without a loan open). It declares when staying
// costs more than `prudence` times bankruptcy: a last resort, so with the Ottomans' and Persia's numbers (lab W18) a
// debt of up to 7 turns of income is carried and paid off, 9 or more declared at the first weighing.
export const BANKRUPTCY = { everyTurns: 30, horizonTurns: 30, goldPerHappiness: 1, purchaseSharePct: 50,
  unitIncomeTurns: 1, shutOutputShare: 1.5, repPointIncomeTurns: 0.1, grievanceIncomeTurns: 0.25,
  lenderWeight: { friendly: 2, neutral: 1, unfriendly: 0.5, war: 0 }, strongerLender: 1.5, bondAccessIncomeTurns: 3,
  prudence: 2 };
// What a treasury below zero at the batch costs, by depth (the share of the overdraft used, in quarters): Happiness
// in every settlement, a premium on purchase prices, and one unit disbanded a turn until it's back above zero,
// the highest upkeep first (the Civilopedia's rule).
// The harsher steps ramp up after warnings, by turns spent below zero in a row (owner 2026-11-10: units first, then
// buildings, slowly, after warnings): two turns of warning, then a unit every other turn, a unit every turn from turn
// 7, and from turn 8 the buildings of one more settlement shut down every other turn, the costliest first.
export const OVERDRAWN = { gloomBase: 2, gloomPerQuarter: 2, gloomPastLimit: 15, priceBaseBp: 500,
  pricePerQuarterBp: 500, pricePastLimitBp: 3000, disbandPerTurn: 1, warnTurns: 2, everyTurnFrom: 7, shutFrom: 8,
  shutEvery: 2 };

/**
 * The ramp for a civ `turns` turns below zero in a row: units to disband this turn and settlements shut down.
 * @param {number} turns 1 on the first turn below zero
 */
export function overdrawnRamp(turns) {
  const t = Math.max(0, Math.floor(turns || 0));
  const unitsFrom = OVERDRAWN.warnTurns + 1;
  const disband = t < unitsFrom ? 0 : t >= OVERDRAWN.everyTurnFrom || (t - unitsFrom) % 2 === 0
    ? OVERDRAWN.disbandPerTurn : 0;
  const shut = t < OVERDRAWN.shutFrom ? 0 : 1 + Math.floor((t - OVERDRAWN.shutFrom) / OVERDRAWN.shutEvery);
  return { disband, shut };
}

/**
 * How far below zero a civ's obligations can take it this turn, in cents.
 * @param {number} incomeCents the civ's net Gold a turn
 */
export function overdraftLimitCents(incomeCents) {
  return Math.max(OVERDRAFT.minCents, OVERDRAFT.incomeTurns * Math.abs(Math.round(incomeCents || 0)));
}

/**
 * A living civ's overdraft this turn: the limit a rule set on it, else overdraftLimitCents; 0 for a dead civ.
 * @param {{ alive?: boolean, incomeCents: number, overdraftCents?: number }} civ
 */
export function overdraftOf(civ) {
  if (civ.alive !== true) return 0;
  return Number.isInteger(civ.overdraftCents) ? Math.max(0, /** @type {number} */ (civ.overdraftCents))
    : overdraftLimitCents(civ.incomeCents);
}

/**
 * The treasury a civ actually holds at the batch: its snapshot less the standing lines' Gold the snapshot counts back
 * (`engineCents`, what the lines moved at the update). Below zero is judged on this (lab W14: an AI at -130 with 160 of
 * debt lines read +30 on the snapshot and paid no penalty).
 * @param {{ balanceCents: number, engineCents?: number }} civ
 */
export function heldCents(civ) {
  const atUpdate = Number.isInteger(civ.engineCents) ? /** @type {number} */ (civ.engineCents) : 0;
  return Math.round(Number(civ.balanceCents) || 0) + atUpdate;
}

/**
 * The same for a batch row: its snapshot plus what the lines moved (`engine`).
 * @param {{ snapshot: number, engine?: number }} row
 */
export function rowHeldCents(row) {
  return row.snapshot + (Number.isInteger(row.engine) ? /** @type {number} */ (row.engine) : 0);
}
