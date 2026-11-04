// econ-view-fiscal.js - Economics: the Fiscal tab (DESIGN 4.7, 9). The main column holds the tax cards of this age
// the player has unlocked: what each does in every settlement (Gold and Happiness with the game's icons), what it
// would change for this civ against now and when the next celebration would come, and one button that slots it
// through the game's own policy-change operation (econ-fiscal.js). The side column: the civ's Gold, Happiness and
// celebration now, its economic system, and the tariff once the stage opens. The policy menu shows the same cards.

import { amount, button, chips, columns, el, empty, facts, feedbackLine, note, pill, row, section, stat } from "./econ-dom.js";
import { canChangeTariff } from "./econ-trade.js";
import { formatGold } from "./econ-format.js";
import { CARD_LEVELS, ageOf, atWarAmounts, cardAmounts, cardForecast } from "./econ-tax-cards.js";
import { systemView } from "./econ-view-macro.js";
import { legaciesSection } from "./econ-view-crisis.js";
import { systemKey } from "./econ-notice-text.js";
import { opensNext, rulesFor, send } from "./econ-view-common.js";

/** @typedef {import("./econ-screen-api.js").ScreenApi} ScreenApi */
/** @typedef {import("./econ-tax-cards.js").FiscalRead} FiscalRead */

/** @type {string | null} */
let lastVerdict = null;

/** @param {number} cents */
const toneOf = (cents) => (cents > 0 ? 1 : cents < 0 ? -1 : 0);
/**
 * @param {number} cents
 * @param {"gold" | "happiness"} kind
 */
const signedYield = (cents, kind) => amount(formatGold(cents, { signed: true }), { kind, tone: toneOf(cents) });

/**
 * @param {HTMLElement} host
 * @param {ScreenApi} api
 */
export function renderFiscal(host, api) {
  const { rules } = rulesFor(api);
  const cards = api.cards();
  const read = api.fiscal();
  const { block, locked } = cardsSection(cards, read, api);
  /** @type {HTMLElement[]} */
  const side = [];
  if (cards.length) side.push(nowSection(read, cards, api));
  side.push(systemSection(api));
  const legacies = legaciesSection(api);
  if (legacies) side.push(legacies);
  if (rules.sections["fiscal.tariff"]) {
    const tariff = tariffSection(api);
    if (tariff) side.push(tariff);
  }
  host.appendChild(columns([block], side));
  // A card not unlocked yet comes before the tariffs: it opens in this age's early civics.
  const first = locked ? { text: api.loc("LOC_ECONOMICS_PART_CARD", api.loc(CARD_LEVELS[locked.level].nameKey)),
    nodeKey: locked.opener || null } : null;
  const next = opensNext(api, rules.next.fiscal, first);
  if (next) host.appendChild(next);
}

/**
 * The economic system (DESIGN 4.17): which one, where it comes from, what it changes, the blend after a change, and
 * the plan's take for a Planned civ.
 * @param {ScreenApi} api
 */
function systemSection(api) {
  const view = systemView(api.input(), api.me);
  const block = section(api.loc("LOC_ECONOMICS_FISCAL_SYSTEM"));
  if (!view.on) { block.appendChild(empty(api.loc("LOC_ECONOMICS_FISCAL_SYSTEMS_OFF"))); return block; }
  const head = el("div", "econ-card econ-card--active");
  head.appendChild(el("div", "econ-card-title", api.loc(systemKey(view.system))));
  head.appendChild(el("div", "econ-card-sub", api.loc(`LOC_ECONOMICS_FISCAL_SYSTEM_FROM_${view.source.toUpperCase()}`)));
  head.appendChild(note(api.loc(`${systemKey(view.system)}_LINE`)));
  block.appendChild(head);
  for (const line of systemLines(view, api)) block.appendChild(line);
  return block;
}

/**
 * Under the system: the blend after a change, the plan's take for a Planned civ, and where the tax changes show.
 * @param {ReturnType<typeof systemView>} view
 * @param {ScreenApi} api
 */
function systemLines(view, api) {
  /** @type {HTMLElement[]} */
  const out = [];
  const block = { appendChild: (/** @type {HTMLElement} */ node) => out.push(node) };
  if (view.from) {
    const blendKey = view.blendLeft === 1 ? "LOC_ECONOMICS_FISCAL_SYSTEM_BLEND_ONE" : "LOC_ECONOMICS_FISCAL_SYSTEM_BLEND";
    block.appendChild(note(api.loc(blendKey, api.loc(systemKey(view.from)), view.blendLeft)));
  }
  if (view.planTakeCents > 0) {
    block.appendChild(row(api.loc("LOC_ECONOMICS_FISCAL_PLAN"), amount(formatGold(view.planSpentCents))));
    block.appendChild(note(api.loc("LOC_ECONOMICS_FISCAL_PLAN_NOTE")));
  }
  block.appendChild(note(api.loc("LOC_ECONOMICS_FISCAL_SYSTEM_TAX_NOTE")));
  return out;
}

/**
 * The tax cards block: the cards the player has unlocked, the slotted one first, and the way to clear it. Returns the
 * first card still locked, for the tab's "Opens next" line.
 * @param {import("./econ-fiscal.js").CardRead[]} cards
 * @param {FiscalRead} read
 * @param {ScreenApi} api
 */
function cardsSection(cards, read, api) {
  const block = section(api.loc("LOC_ECONOMICS_FISCAL_CARDS"), [],
    { subtitle: api.loc("LOC_ECONOMICS_FISCAL_CARDS_SUB") });
  if (!cards.length) { block.appendChild(empty(api.loc("LOC_ECONOMICS_FISCAL_TAXES_OFF"))); return { block, locked: null }; }
  const canSwap = api.canSwap();
  const active = cards.find((card) => card.active) || null;
  // Every card the database holds is this age's, so any card's type names the age whose amounts apply.
  const age = ageOf(cards[0].type);
  if (lastVerdict) block.appendChild(el("div", "econ-feedback", api.loc(verdictKey(lastVerdict))));
  const shown = cards.filter((card) => card.unlocked || card.active)
    .sort((a, b) => Number(b.active) - Number(a.active));
  for (const card of shown) block.appendChild(cardBlock(card, active ? active.level : null, read, canSwap, api));
  if (!shown.length) block.appendChild(empty(api.loc("LOC_ECONOMICS_FISCAL_NONE_YET")));
  if (active) block.appendChild(clearBlock(active.level, read, canSwap, age, api));
  block.appendChild(note(api.loc("LOC_ECONOMICS_FISCAL_NOTE")));
  return { block, locked: cards.find((card) => !card.unlocked && !card.active) || null };
}

/**
 * Where the civ stands now, with the slotted card: its settlements' Gold and Happiness and the next celebration.
 * @param {FiscalRead} read
 * @param {import("./econ-fiscal.js").CardRead[]} cards
 * @param {ScreenApi} api
 */
function nowSection(read, cards, api) {
  const active = cards.find((card) => card.active) || null;
  const level = active ? active.level : null;
  const now = cardForecast(level, level, read, ageOf(cards[0].type));
  return section(api.loc("LOC_ECONOMICS_FISCAL_NOW"), [
    row(api.loc("LOC_ECONOMICS_FISCAL_GOLD_NOW"), amount(formatGold(read.goldCents), { kind: "gold" })),
    row(api.loc("LOC_ECONOMICS_FISCAL_HAPPINESS_NOW"), amount(formatGold(read.happinessCents), { kind: "happiness" })),
    row(api.loc("LOC_ECONOMICS_FISCAL_CELEBRATION"), celebrationText(now.turnsToCelebration, read, api)),
  ]);
}

/**
 * @param {number | null} turns
 * @param {FiscalRead} read
 * @param {ScreenApi} api
 */
function celebrationText(turns, read, api) {
  if (read.celebrating) return api.loc("LOC_ECONOMICS_FISCAL_CELEBRATING");
  return turns === null ? api.loc("LOC_ECONOMICS_FISCAL_CELEBRATION_NEVER")
    : api.loc(turns === 1 ? "LOC_ECONOMICS_FISCAL_CELEBRATION_TURN" : "LOC_ECONOMICS_FISCAL_CELEBRATION_TURNS", turns);
}

/**
 * One card: what it does in each settlement, at war too, and for a card not slotted what it would change and the
 * button that slots it.
 * @param {import("./econ-fiscal.js").CardRead} card
 * @param {string | null} activeLevel
 * @param {FiscalRead} read
 * @param {boolean} canSwap
 * @param {ScreenApi} api
 */
function cardBlock(card, activeLevel, read, canSwap, api) {
  const level = CARD_LEVELS[card.level];
  const age = ageOf(card.type);
  const amounts = cardAmounts(card.level, age);
  const box = el("div", `econ-card${card.active ? " econ-card--active" : ""}`);
  const head = el("div", "econ-card-head");
  head.appendChild(el("div", "econ-card-title", api.loc(level.nameKey)));
  if (card.active) head.appendChild(pill(api.loc("LOC_ECONOMICS_FISCAL_ACTIVE"), false));
  box.appendChild(head);
  /** @type {HTMLElement[]} */
  const each = [stat(api.loc("LOC_ECONOMICS_FISCAL_EFFECT"), effect(amounts, api))];
  if (level.atWar) each.push(stat(api.loc("LOC_ECONOMICS_FISCAL_EFFECT_AT_WAR"), effect(atWarAmounts(card.level, age), api)));
  box.appendChild(facts(each));
  if (!card.active) {
    box.appendChild(forecastFacts(card.level, activeLevel, read, age, api));
    box.appendChild(button(api.loc("LOC_ECONOMICS_FISCAL_SLOT"), () => swap(card.type, api),
      { disabled: !canSwap || !card.unlocked, reason: canSwap ? null : api.loc("LOC_ECONOMICS_FISCAL_NO_SWAP") }));
  }
  return box;
}

/**
 * A card's amounts in each settlement: Gold and Happiness with their icons; the text key carries the same figures
 * for a tooltip.
 * @param {{ gold: number, happiness: number }} amounts
 * @param {ScreenApi} api
 */
function effect(amounts, api) {
  const node = el("div", "econ-facts");
  node.appendChild(signedYield(amounts.gold * 100, "gold"));
  node.appendChild(signedYield(amounts.happiness * 100, "happiness"));
  node.setAttribute("data-tooltip-content", api.loc("LOC_ECONOMICS_FISCAL_EFFECT_ROW",
    formatGold(amounts.gold * 100, { signed: true }), formatGold(amounts.happiness * 100, { signed: true })));
  return node;
}

/**
 * What changes against now: Gold and Happiness a turn, and the next celebration.
 * @param {string | null} level
 * @param {string | null} activeLevel
 * @param {FiscalRead} read
 * @param {string | null} age
 * @param {ScreenApi} api
 */
function forecastFacts(level, activeLevel, read, age, api) {
  const forecast = cardForecast(level, activeLevel, read, age);
  return facts([
    stat(api.loc("LOC_ECONOMICS_FISCAL_FORECAST_GOLD"), signedYield(forecast.goldDeltaCents, "gold")),
    stat(api.loc("LOC_ECONOMICS_FISCAL_FORECAST_HAPPINESS"), signedYield(forecast.happinessDeltaCents, "happiness")),
    stat(api.loc("LOC_ECONOMICS_FISCAL_CELEBRATION"), celebrationText(forecast.turnsToCelebration, read, api)),
  ]);
}

/**
 * Clearing the slotted card, with what that would change.
 * @param {string} activeLevel
 * @param {FiscalRead} read
 * @param {boolean} canSwap
 * @param {string | null} age
 * @param {ScreenApi} api
 */
function clearBlock(activeLevel, read, canSwap, age, api) {
  const box = el("div", "econ-card econ-card--muted");
  box.appendChild(el("div", "econ-card-title", api.loc("LOC_ECONOMICS_FISCAL_NO_CARD")));
  box.appendChild(forecastFacts(null, activeLevel, read, age, api));
  box.appendChild(button(api.loc("LOC_ECONOMICS_FISCAL_CLEAR"), () => swap(null, api),
    { disabled: !canSwap, reason: canSwap ? null : api.loc("LOC_ECONOMICS_FISCAL_NO_SWAP"),
      className: "econ-button--quiet" }));
  return box;
}

/**
 * The tariff row (DESIGN 4.10): hidden with Markets or Tariffs off and until the Tariffs stage, one change per 5
 * turns, with what a tariff does in words.
 * @param {ScreenApi} api
 */
function tariffSection(api) {
  const input = api.input();
  if (input.options?.markets === false || input.options?.tariffs === false) return null;
  const block = section(api.loc("LOC_ECONOMICS_TARIFF"));
  for (const node of tariffRows(input, api)) block.appendChild(node);
  const said = feedbackLine("tariff");
  if (said) block.appendChild(said);
  block.appendChild(note(api.loc("LOC_ECONOMICS_TARIFF_NOTE")));
  return block;
}

/**
 * @param {PlanInput} input
 * @param {number} pid
 */
function tariffRowOf(input, pid) {
  return (input.markets ? input.markets.tariffs : []).find((tariff) => tariff.pid === pid) || null;
}

/**
 * The stage note, the level with the wait, or the choice.
 * @param {PlanInput} input
 * @param {ScreenApi} api
 * @returns {HTMLElement[]}
 */
function tariffRows(input, api) {
  const current = tariffRowOf(input, api.me);
  const level = current ? current.level : "none";
  const name = (/** @type {string} */ id) => api.loc(`LOC_ECONOMICS_TARIFF_${id.toUpperCase()}`);
  const pending = api.pending().some((request) => request.kind === "tariff");
  if (pending || !canChangeTariff(current ? current.changedTurn : undefined, input.turn)) {
    return [row(api.loc("LOC_ECONOMICS_TARIFF_NOW"), name(level)),
      note(api.loc(pending ? "LOC_ECONOMICS_TARIFF_PENDING" : "LOC_ECONOMICS_TARIFF_WAIT"))];
  }
  const pick = (/** @type {string} */ id) => {
    if (id === level) return;
    send(api, { kind: "tariff", pid: api.me, level: id }, "tariff");
  };
  return [row(api.loc("LOC_ECONOMICS_TARIFF_NOW"), name(level)),
    chips(["none", "low", "high"].map((id) => ({ id, label: name(id) })), level, pick)];
}

/** The LOC key for what a swap came back with. @param {string} verdict */
export function verdictKey(verdict) {
  return `LOC_ECONOMICS_FISCAL_VERDICT_${verdict.toUpperCase().replace(/-/g, "_")}`;
}

/**
 * @param {string | null} type
 * @param {ScreenApi} api
 */
function swap(type, api) {
  lastVerdict = null;
  api.swapTo(type).then((verdict) => { lastVerdict = verdict; api.rerender(); })
    .catch(() => { lastVerdict = "no-swap"; api.rerender(); });
}

/** Test hook. */
export function resetVerdictForTests() {
  lastVerdict = null;
}
