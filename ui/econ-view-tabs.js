// econ-view-tabs.js - Economics: which tabs and sections of the Economics screen a player sees (DESIGN 4.15, 9). A
// tab appears when its stage makes it matter, a section of a stage the player hasn't reached is left out, and each
// tab ends on one "Opens next" line. The same rules name the parts that opened since the last turn, for the turn
// notification and the dock button's unseen marker. Plain data in, plain data out; nothing here reads the engine.

import { isOpen } from "./econ-loan.js";
import { emptyLedger } from "./econ-state.js";

export const TAB_KEYS = /** @type {const} */ (["treasury", "loans", "fiscal", "markets", "trade", "world"]);
/** @typedef {typeof TAB_KEYS[number]} TabKey */

/** The stages in the order a civ usually reaches them (DESIGN 4.15's table). */
export const STAGE_ORDER = ["trade", "coinage", "moneylending", "guildPatronage", "publicDebt", "charteredCompanies",
  "tariffs", "banking", "capitalism"];

/**
 * @typedef {{ stagesOn: boolean, reached: Record<string, boolean>, openLoan: boolean, citizenOffer: boolean,
 *   firstAge: boolean, marketsOn: boolean, tariffsOn: boolean, investmentOn: boolean, inflationOn: boolean,
 *   cycleOn: boolean }} TabFacts
 */

/**
 * The facts the rules read, from the plan input, the player's stage turns (coinage included, which the model's civ
 * record leaves out) and whether the player's citizens would lend to it now.
 * @param {PlanInput} input
 * @param {number} me
 * @param {Record<string, number | null | undefined> | null | undefined} stageTurns
 * @param {{ citizenOffer?: boolean }} [extra]
 * @returns {TabFacts}
 */
export function tabFacts(input, me, stageTurns, extra = {}) {
  const options = /** @type {Record<string, unknown>} */ (input.options || {});
  const stagesOn = options.stages !== false;
  const civ = input.civs.find((row) => row.id === me);
  /** @type {Record<string, unknown>} */
  const turns = { ...(civ?.stages || {}), ...(stageTurns || {}) };
  const reached = reachedStages(turns, input.turn, stagesOn);
  const ledger = input.ledger || emptyLedger();
  const openLoan = ledger.loans.some((loan) => isOpen(loan) && (loan.borrower === me || loan.lender === me));
  return { stagesOn, reached, openLoan, citizenOffer: extra.citizenOffer === true,
    firstAge: /ANTIQUITY/.test(String(input.age || "")), ...optionFlags(options) };
}

/**
 * Each stage reached by this turn; every stage with the Economic stages option Off.
 * @param {Record<string, unknown>} turns
 * @param {number} turn
 * @param {boolean} stagesOn
 */
function reachedStages(turns, turn, stagesOn) {
  /** @type {Record<string, boolean>} */
  const reached = {};
  for (const stage of STAGE_ORDER) {
    const at = turns[stage];
    reached[stage] = !stagesOn || (Number.isInteger(at) && /** @type {number} */ (at) <= turn);
  }
  return reached;
}

/**
 * The setup options that turn a part off.
 * @param {Record<string, unknown>} options
 */
function optionFlags(options) {
  const marketsOn = options.markets !== false;
  return { marketsOn, tariffsOn: marketsOn && options.tariffs !== false, investmentOn: options.investment !== false,
    inflationOn: options.inflation === true, cycleOn: options.cycle !== "off" };
}

/**
 * What a part is called in an "Opens next" line, by stage, for each tab; a tab's line names its first stage not yet
 * reached. Options that turn a part off leave it out.
 * @param {TabFacts} f
 * @param {Record<TabKey, boolean>} shown
 * @returns {Record<TabKey, { stage: string, part: string }[]>}
 */
function upcoming(f, shown) {
  return {
    treasury: [
      { stage: "trade", part: shown.markets ? "LOC_ECONOMICS_PART_TAB_TRADE_ONLY" : "LOC_ECONOMICS_PART_TAB_TRADE" },
      { stage: "coinage", part: shown.markets ? "LOC_ECONOMICS_PART_TAB_WORLD" : "LOC_ECONOMICS_PART_TAB_WORLD_MARKETS" },
      { stage: "moneylending", part: "LOC_ECONOMICS_PART_CIV_LOANS" },
    ],
    loans: [
      { stage: "moneylending", part: "LOC_ECONOMICS_PART_CIV_LOANS" },
      { stage: "publicDebt", part: "LOC_ECONOMICS_PART_BOND" },
    ],
    fiscal: f.tariffsOn ? [{ stage: "tariffs", part: "LOC_ECONOMICS_PART_TARIFFS" }] : [],
    markets: f.marketsOn ? [{ stage: "trade", part: "LOC_ECONOMICS_PART_TRADE_BILLS" }] : [],
    trade: f.investmentOn ? [
      { stage: "guildPatronage", part: "LOC_ECONOMICS_PART_DEV_LOANS" },
      { stage: "charteredCompanies", part: "LOC_ECONOMICS_PART_GENERAL" },
    ] : [],
    world: [
      ...(f.inflationOn ? [{ stage: "publicDebt", part: "LOC_ECONOMICS_PART_INFLATION" }] : []),
      ...(f.cycleOn ? [{ stage: "banking", part: "LOC_ECONOMICS_PART_PANICS" }] : []),
    ],
  };
}

/**
 * The screen as this player sees it: the tabs in order, the sections shown, and each tab's "Opens next" part.
 * @param {TabFacts} f
 */
export function tabRules(f) {
  const r = f.reached;
  const shown = {
    treasury: true,
    loans: r.moneylending || f.openLoan || f.citizenOffer,
    fiscal: true,
    // Markets opens with Coinage (the Market building's tech) or Trade, whichever comes first.
    markets: r.trade || r.coinage,
    trade: r.trade,
    world: r.coinage,
  };
  const tabs = TAB_KEYS.filter((key) => shown[key]);
  return { tabs, shown, sections: sectionsFor(f, shown), next: nextParts(f, shown) };
}

/**
 * The sections shown inside the tabs.
 * @param {TabFacts} f
 * @param {Record<TabKey, boolean>} shown
 */
function sectionsFor(f, shown) {
  const r = f.reached;
  return {
    // Before the Loans tab, the guard switch and any loan line live on the Treasury tab.
    "treasury.loans": !shown.loans,
    // Before the World tab, this turn's cycle Gold shows on the Treasury tab.
    "treasury.cycle": !shown.world && f.cycleOn,
    "treasury.depth": r.coinage,
    "treasury.old": !f.firstAge,
    "loans.borrow": r.moneylending || r.publicDebt || f.citizenOffer,
    "loans.civLoans": r.moneylending,
    "loans.bond": r.publicDebt,
    "loans.lend": r.publicDebt,
    "fiscal.tariff": f.tariffsOn && r.tariffs,
    "trade.project": f.investmentOn && r.guildPatronage,
    "trade.general": f.investmentOn && r.charteredCompanies,
    "world.inflation": !f.inflationOn || r.publicDebt,
    "world.legacy": !f.firstAge,
  };
}

/**
 * Each tab's first part not yet reached, for its "Opens next" line.
 * @param {TabFacts} f
 * @param {Record<TabKey, boolean>} shown
 */
function nextParts(f, shown) {
  const lists = upcoming(f, shown);
  /** @type {Record<string, { stage: string, part: string } | null>} */
  const next = {};
  for (const key of TAB_KEYS) {
    next[key] = lists[key].filter((item) => !f.reached[item.stage])
      .sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage))[0] || null;
  }
  return next;
}

/** @typedef {ReturnType<typeof tabRules>} TabRules */

/**
 * The tab a remembered choice opens on: the remembered tab when it's shown, else Treasury.
 * @param {{ tabs: TabKey[] }} rules
 * @param {unknown} remembered a tab key, or the index older versions stored
 */
export function startTab(rules, remembered) {
  const key = typeof remembered === "number" ? TAB_KEYS[remembered] : remembered;
  return rules.tabs.includes(/** @type {TabKey} */ (key)) ? /** @type {TabKey} */ (key) : "treasury";
}

/**
 * The parts a player can be told about, each with the tab it opens on and the notification line that says so. A tab
 * line covers the sections that open with it.
 */
export const PARTS = {
  "tab:loans": { tab: "loans", key: "LOC_ECONOMICS_OPENED_LOANS" },
  "tab:markets": { tab: "markets", key: "LOC_ECONOMICS_OPENED_MARKETS" },
  "tab:trade": { tab: "trade", key: "LOC_ECONOMICS_OPENED_TRADE" },
  "tab:world": { tab: "world", key: "LOC_ECONOMICS_OPENED_WORLD" },
  "loans.civLoans": { tab: "loans", key: "LOC_ECONOMICS_OPENED_CIV_LOANS" },
  "loans.bond": { tab: "loans", key: "LOC_ECONOMICS_OPENED_BOND" },
  "fiscal.tariff": { tab: "fiscal", key: "LOC_ECONOMICS_OPENED_TARIFFS" },
  "trade.project": { tab: "trade", key: "LOC_ECONOMICS_OPENED_DEV_LOANS" },
  "trade.general": { tab: "trade", key: "LOC_ECONOMICS_OPENED_GENERAL" },
  "world.inflation": { tab: "world", key: "LOC_ECONOMICS_OPENED_INFLATION" },
};

/**
 * The parts open now, by their PARTS ids.
 * @param {TabRules} rules
 * @param {TabFacts} f
 */
export function openParts(rules, f) {
  /** @type {string[]} */
  const out = [];
  for (const tab of ["loans", "markets", "trade", "world"]) if (rules.tabs.includes(/** @type {TabKey} */ (tab))) out.push(`tab:${tab}`);
  const s = /** @type {Record<string, boolean>} */ (rules.sections);
  for (const id of ["loans.civLoans", "loans.bond", "fiscal.tariff", "trade.project", "trade.general"]) {
    if (s[id]) out.push(id);
  }
  if (f.inflationOn && f.reached.publicDebt) out.push("world.inflation");
  return out;
}

/**
 * What opened since the parts already told: the notification keys (one per new tab, sections that opened with their
 * tab folded into its line) and the tabs to mark unseen. The Loans tab's line says why it opened.
 * @param {string[]} told the parts already told
 * @param {string[]} now openParts now
 * @param {TabFacts} f
 */
export function newlyOpened(told, now, f) {
  const known = new Set(told);
  const fresh = now.filter((id) => !known.has(id));
  const newTabs = new Set(fresh.filter((id) => id.startsWith("tab:")).map((id) => id.slice(4)));
  /** @type {string[]} */
  const keys = [];
  /** @type {Set<string>} */
  const tabs = new Set();
  for (const id of fresh) {
    const part = PARTS[/** @type {keyof typeof PARTS} */ (id)];
    if (!part) continue;
    tabs.add(part.tab);
    const key = lineFor(id, part.key, newTabs, f);
    if (key) keys.push(key);
  }
  return { keys, tabs: [...tabs], told: [...known, ...fresh] };
}

/**
 * One opened part's notification key, or null when another line covers it: a section that opened with its tab, and
 * Trade when Markets opened with it. The Loans tab's line says whether other civilizations lend now.
 * @param {string} id
 * @param {string} key
 * @param {Set<string>} newTabs
 * @param {TabFacts} f
 */
function lineFor(id, key, newTabs, f) {
  if (!id.startsWith("tab:")) return newTabs.has(PARTS[/** @type {keyof typeof PARTS} */ (id)].tab) ? null : key;
  if (id === "tab:loans") return f.reached.moneylending ? "LOC_ECONOMICS_OPENED_LOANS_LENDERS" : key;
  if (newTabs.has("markets")) return pairedLine(id, key, newTabs);
  return key;
}

/**
 * Markets opens with Trade or with World (Coinage): one line names both, on the Markets part.
 * @param {string} id
 * @param {string} key
 * @param {Set<string>} newTabs
 */
function pairedLine(id, key, newTabs) {
  if (id === "tab:trade") return null;
  if (id === "tab:world") return newTabs.has("trade") ? key : null;
  if (id !== "tab:markets") return key;
  if (newTabs.has("trade")) return "LOC_ECONOMICS_OPENED_MARKETS_TRADE";
  return newTabs.has("world") ? "LOC_ECONOMICS_OPENED_MARKETS_WORLD" : key;
}
