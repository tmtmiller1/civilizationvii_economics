// econ-policy-catalog.js - Economics: the crisis paths' cards (docs/CRISIS-PATHS-PROPOSAL-v6.md and the drafts it
// builds on): each government's and ideology's own answers to a crisis, as data the engine in econ-policy.js reads.
// A card names its owner, its tier, when it can be taken, what it costs to take and to keep, what it does and what
// it leaves. Nothing here moves Gold or reads the engine.

/** @typedef {"measure" | "programme" | "gamble"} PolicyTier */
/**
 * @typedef {"citizens-republic" | "company-state" | "public-investment" | "financial-reform" | "war-economy"} PathId
 */

/**
 * The typed effects a card can carry (v3 section 3a). `loan`, `grant` and `writeOff` are transactions, applied once
 * the turn the card is taken; the rest stand while the card runs and are read each batch.
 * @typedef {{ type: "loan", lender: "citizens" | "bond", incomeTurns: number, rateFactorPct: number, term: number }
 *   | { type: "grant", from: "bond", incomeTurns: number }
 *   | { type: "writeOff", lender: "bond", pct: number }
 *   | { type: "support", perSettlement: number }
 *   | { type: "goldPerSettlement", cents: number }
 *   | { type: "routeProduction", points: number }
 *   | { type: "militaryProduction", points: number, atWarOnly: boolean }
 *   | { type: "borrowedUpkeep" }
 *   | { type: "responses", ids: string[], costPct: number }
 *   | { type: "terms", terms: Record<string, number | boolean> }
 *   | { type: "partnersResent", every: number, level: number }
 *   | { type: "grievancesMet", amount: number }
 *   | { type: "highTariff" }
 *   | { type: "aid", goodwillPct: number, bondHalf: boolean }
 *   | { type: "confidence", bp: number }} PolicyEffect
 */

/**
 * @typedef {{ id: string, owners: { government?: string[], ideology?: string[] }, tier: PolicyTier, ages: string[],
 *   kinds: string[], needs: string[], influence: number, perTurnInfluence?: number, adminPct?: number,
 *   rateFactorPct?: number, minTurns?: number, runs: number | "path", once: "crisis" | "age" | "game",
 *   path?: PathId, effects: PolicyEffect[], warWithin?: number, turns?: { when: string, after?: number, bp?: number },
 *   legacies: Record<string, { id: string, turns: number | null, nextAge?: boolean }>, order: number }} Policy
 */

/** The figures the tiers share (v6 sections 1 and 3; phase 0 for the rate factor). */
export const POLICY_RULES = {
  // A Programme's own rates while it runs: x1.25 (the drafts' "+0.5 on the bond rate", written before the rates
  // were known to be per turn; phase 0).
  programmeRateFactorPct: 125,
  minTurns: 5,
  // Institutional drift (v3 4a): 5% a step, three steps either way.
  driftStepPct: 5,
  driftMaxSteps: 3,
  // Hardship for Partisans: points a settlement under 0.80, capped.
  hardshipPerTenth: 2,
  hardshipCap: 6,
  austerityHardship: 3,
  // Programmes in arrears (hard-times plan v2, Part 2): three short turns of grace, a premium of 1.5 a lapse point,
  // and six points end the card. Three paid turns in a row clear a point; Influence is priced at a twentieth of the
  // income at Commit, a Gold a point at least.
  arrearsGrace: 3,
  arrearsPointsMax: 6,
  arrearsPremium: 1.5,
  arrearsClearTurns: 3,
  arrearsInfluenceDiv: 20,
  arrearsSupportMax: 2,
  // Austerity strain for Partisans: +1 a turn while it runs, -2 a turn after, never below 0.
  strainUp: 1,
  strainDown: 2,
  // The index a path is judged against (v4: an institution founded under 0.80 is at best Compromised).
  ruinsBp: 8000,
  // A Gamble's test (the assembly, debt into shares) and the war economy's numbers.
  gambleTestBp: 9000,
  warDebtIncomeTurns: 5,
  warHoldTurns: 10,
  offBookTurns: 10,
  offBookCaptureTurns: 10,
  claimPctOfIncome: 3,
};

/** @type {Policy[]} */
export const POLICIES = [
  // Classical Republic: the citizens' republic.
  { id: "liturgies", owners: { government: ["GOVERNMENT_CLASSICAL_REPUBLIC"] }, tier: "programme", ages: ["AQ"],
    kinds: ["depression", "debt", "price-shock"], needs: ["citizens"], influence: 40, perTurnInfluence: 4,
    adminPct: 5, runs: "path", once: "crisis", path: "citizens-republic", order: 10,
    effects: [{ type: "loan", lender: "citizens", incomeTurns: 3, rateFactorPct: 0, term: 10 },
      { type: "support", perSettlement: -100 }, { type: "terms", terms: { citizensCapPct: 50 } }],
    legacies: { earned: { id: "path-citizens-earned", turns: null }, compromised: { id: "path-citizens-compromised",
      turns: 20 }, abandoned: { id: "path-citizens-abandoned", turns: 20 } } },
  { id: "land-reform", owners: { government: ["GOVERNMENT_CLASSICAL_REPUBLIC"] }, tier: "measure", ages: ["AQ"],
    kinds: ["depression", "debt", "price-shock"], needs: [], influence: 10, runs: 10, once: "age", order: 20,
    effects: [{ type: "support", perSettlement: 400 }, { type: "goldPerSettlement", cents: 200 }],
    legacies: { end: { id: "land-reform", turns: 20 } } },
  { id: "assembly-speaks", owners: { government: ["GOVERNMENT_CLASSICAL_REPUBLIC"] }, tier: "gamble", ages: ["AQ"],
    kinds: ["depression", "debt", "price-shock"], needs: [], influence: 20, runs: 5, once: "crisis", order: 30,
    effects: [{ type: "confidence", bp: 200 }], turns: { when: "indexUnderAfter", after: 5 },
    legacies: { turned: { id: "assembly-turned", turns: 5 } } },
  // Plutocracy: the company state.
  { id: "merchant-charter", owners: { government: ["GOVERNMENT_PLUTOCRACY"] }, tier: "programme", ages: ["EX"],
    kinds: ["depression", "debt", "trade-collapse", "credit-panic"], needs: ["routes", "bond"], influence: 50,
    perTurnInfluence: 5, adminPct: 5, runs: "path", once: "crisis", path: "company-state", order: 10,
    effects: [{ type: "loan", lender: "bond", incomeTurns: 4, rateFactorPct: 100, term: 10 },
      { type: "routeProduction", points: 2 }],
    legacies: { earned: { id: "path-company-earned", turns: null }, compromised: { id: "path-company-compromised",
      turns: 20 }, abandoned: { id: "path-company-abandoned", turns: 20 } } },
  { id: "debt-into-shares", owners: { government: ["GOVERNMENT_PLUTOCRACY"] }, tier: "gamble", ages: ["EX"],
    kinds: ["depression", "debt", "credit-panic"], needs: ["bondDebt"], influence: 20, runs: 0, once: "game",
    order: 20, effects: [{ type: "writeOff", lender: "bond", pct: 20 }],
    turns: { when: "indexUnderAtCrisisEnd", after: 5, bp: 8500 },
    legacies: { end: { id: "shares-claim", turns: null }, turned: { id: "shares-turned", turns: null } } },
  { id: "lottery-loan", owners: { government: ["GOVERNMENT_PLUTOCRACY"] }, tier: "gamble", ages: ["EX"],
    kinds: ["depression", "debt", "credit-panic"], needs: ["bond"], influence: 20, runs: 5, once: "age", order: 30,
    effects: [{ type: "loan", lender: "bond", incomeTurns: 4, rateFactorPct: 50, term: 5 },
      { type: "support", perSettlement: 100 }], turns: { when: "missOnLoan" },
    legacies: {} },
  // Democracy: public investment and financial reform.
  { id: "new-deal", owners: { ideology: ["IDEOLOGY_DEMOCRACY"] }, tier: "programme", ages: ["MO"],
    kinds: ["depression", "debt", "credit-panic", "trade-collapse"], needs: ["build"], influence: 60,
    perTurnInfluence: 6, adminPct: 5, runs: "path", once: "crisis", path: "public-investment", order: 10,
    effects: [{ type: "responses", ids: ["public-works", "relief"], costPct: 50 }],
    legacies: { earned: { id: "path-newdeal-earned", turns: null, nextAge: true },
      compromised: { id: "path-newdeal-compromised", turns: 10 }, abandoned: { id: "path-newdeal-abandoned", turns: 20 } } },
  { id: "bank-regulation", owners: { ideology: ["IDEOLOGY_DEMOCRACY"] }, tier: "programme", ages: ["MO"],
    kinds: ["depression", "debt", "credit-panic"], needs: [], influence: 40, perTurnInfluence: 4, adminPct: 5,
    rateFactorPct: 80, runs: "path", once: "crisis", path: "financial-reform", order: 20,
    effects: [{ type: "terms", terms: { capTurns: -2 } }],
    legacies: { earned: { id: "path-bank-earned", turns: null }, compromised: { id: "path-bank-compromised", turns: 20 },
      abandoned: { id: "path-bank-abandoned", turns: 0 } } },
  { id: "lend-lease", owners: { ideology: ["IDEOLOGY_DEMOCRACY"] }, tier: "measure", ages: ["MO"],
    kinds: ["depression", "debt", "credit-panic", "trade-collapse"], needs: ["friendAtWar"], influence: 10, runs: 10,
    once: "crisis", order: 30, effects: [{ type: "aid", goodwillPct: 200, bondHalf: true }],
    legacies: { end: { id: "lend-lease", turns: 20 } } },
  // Fascism: the war economy.
  { id: "foreign-adventure", owners: { ideology: ["IDEOLOGY_FASCISM"] }, tier: "programme", ages: ["MO"],
    kinds: ["depression", "debt", "trade-collapse", "credit-panic"], needs: ["metMajor"], influence: 30,
    perTurnInfluence: 3, adminPct: 8, runs: "path", once: "crisis", path: "war-economy", order: 10, warWithin: 5,
    effects: [{ type: "militaryProduction", points: 2, atWarOnly: true }, { type: "borrowedUpkeep" },
      { type: "grievancesMet", amount: 10 }, { type: "partnersResent", every: 5, level: -1 },
      { type: "terms", terms: { tradeWarDouble: true } }],
    legacies: { earned: { id: "path-war-earned", turns: null }, compromised: { id: "path-war-compromised", turns: 20 },
      abandoned: { id: "path-war-abandoned", turns: 0 }, turned: { id: "war-unmet", turns: 0 } } },
  { id: "self-sufficiency", owners: { ideology: ["IDEOLOGY_FASCISM"] }, tier: "measure", ages: ["MO"],
    kinds: ["depression", "trade-collapse", "price-shock"], needs: ["routes"], influence: 10, runs: 20, once: "age",
    order: 20, effects: [{ type: "highTariff" }, { type: "terms", terms: { navigationActs: true, billPct: 50,
      tradeWarDouble: true } }, { type: "partnersResent", every: 5, level: -1 }],
    legacies: { end: { id: "self-sufficiency", turns: null } } },
  { id: "off-book-bills", owners: { ideology: ["IDEOLOGY_FASCISM"] }, tier: "gamble", ages: ["MO"],
    kinds: ["depression", "debt", "credit-panic"], needs: ["bond"], influence: 20, runs: 10, once: "age", order: 30,
    effects: [{ type: "grant", from: "bond", incomeTurns: 4 }], turns: { when: "offBookDue", after: 10 },
    legacies: { end: { id: "off-book", turns: null } } },
];

/** @param {string} id */
export function policyById(id) {
  return POLICIES.find((row) => row.id === id) || null;
}

/**
 * The legacy terms the crisis-paths legacies set while they last (read by econ-crisis-rows.js crisisTerms). A
 * factor is a percent on the matching term; `capTurns` adds.
 * @type {Record<string, Record<string, number | boolean>>}
 */
export const POLICY_LEGACY_TERMS = {
  "path-citizens-earned": { citizensCapPct: 150 },
  "path-citizens-compromised": { citizensRatePct: 125 },
  "land-reform": { citizensCapPct: 50 },
  "path-company-earned": { capTurns: 2, ownRatePct: 90 },
  "path-company-compromised": { ownRatePct: 125 },
  "path-company-abandoned": { bondPct: 125 },
  "shares-claim": { tariffCeilingLow: true },
  "shares-turned": { bondPct: 150 },
  "path-newdeal-abandoned": { ownRatePct: 125 },
  "path-bank-earned": { panicPct: 50 },
  "path-bank-compromised": { capTurns: -2 },
  "lend-lease": { bondPct: 125 },
  "path-war-compromised": { bondPct: 125 },
  "self-sufficiency": { tradeBuildingPctOf: 75 },
  "off-book": { piExtraPpm: 5000 },
};

/** The Public support (celebration meter) a legacy moves a settlement a turn, in hundredths of a Happiness point. */
export const POLICY_LEGACY_SUPPORT = {
  "path-newdeal-earned": 100,
  "path-newdeal-compromised": 0,
  "assembly-turned": -400,
};

/** The Gold a settlement a turn a legacy charges, in cents, paid to the cycle account. */
export const POLICY_LEGACY_CHARGE = {
  "path-newdeal-earned": 100,
  "path-newdeal-compromised": 100,
};
