// econ-view-fiscal.js - Economics: the Fiscal tab (DESIGN 4.7, 9): the three tax cards of this age with what each
// would change in this civ's Gold and Happiness and when the next celebration would come, which one is slotted, and
// the door that slots or clears one through the game's own policy-change operation (econ-fiscal.js). The policy menu
// shows the same cards and works as before.

import { button, chips, el, note, pill, row, section } from "./econ-dom.js";
import { canChangeTariff } from "./econ-trade.js";
import { hasStage } from "./econ-stages.js";
import { formatGold } from "./econ-format.js";
import { CARD_LEVELS, ageOf, atWarAmounts, cardAmounts, cardForecast } from "./econ-tax-cards.js";
import { systemView } from "./econ-view-macro.js";
import { systemKey } from "./econ-notice-text.js";

/** @typedef {import("./econ-screen-api.js").ScreenApi} ScreenApi */
/** @typedef {import("./econ-tax-cards.js").FiscalRead} FiscalRead */

/** @type {string | null} */
let lastVerdict = null;

/**
 * @param {HTMLElement} host
 * @param {ScreenApi} api
 */
export function renderFiscal(host, api) {
  host.appendChild(systemSection(api));
  renderCards(host, api);
  const tariff = tariffSection(api);
  if (tariff) host.appendChild(tariff);
}

/**
 * The economic system (DESIGN 4.17): which one, where it comes from, what it changes, the blend after a change, and
 * the plan's take for a Planned civ.
 * @param {ScreenApi} api
 */
function systemSection(api) {
  const view = systemView(api.input(), api.me);
  const block = section(api.loc("LOC_ECONOMICS_FISCAL_SYSTEM"));
  if (!view.on) { block.appendChild(note(api.loc("LOC_ECONOMICS_FISCAL_SYSTEMS_OFF"))); return block; }
  block.appendChild(el("div", "econ-card-title", api.loc(systemKey(view.system))));
  block.appendChild(note(api.loc(`LOC_ECONOMICS_FISCAL_SYSTEM_FROM_${view.source.toUpperCase()}`)));
  block.appendChild(note(api.loc(`${systemKey(view.system)}_LINE`)));
  if (view.from) {
    const blendKey = view.blendLeft === 1 ? "LOC_ECONOMICS_FISCAL_SYSTEM_BLEND_ONE" : "LOC_ECONOMICS_FISCAL_SYSTEM_BLEND";
    block.appendChild(note(api.loc(blendKey, api.loc(systemKey(view.from)), view.blendLeft)));
  }
  if (view.planTakeCents > 0) {
    block.appendChild(row(api.loc("LOC_ECONOMICS_FISCAL_PLAN"), formatGold(view.planTakeCents)));
    block.appendChild(note(api.loc("LOC_ECONOMICS_FISCAL_PLAN_NOTE")));
  }
  block.appendChild(note(api.loc("LOC_ECONOMICS_FISCAL_SYSTEM_TAX_NOTE")));
  return block;
}

/**
 * The tax cards block.
 * @param {HTMLElement} host
 * @param {ScreenApi} api
 */
function renderCards(host, api) {
  const cards = api.cards();
  const block = section(api.loc("LOC_ECONOMICS_FISCAL_CARDS"));
  if (!cards.length) { block.appendChild(note(api.loc("LOC_ECONOMICS_FISCAL_TAXES_OFF"))); host.appendChild(block); return; }
  const read = api.fiscal();
  const canSwap = api.canSwap();
  const active = cards.find((card) => card.active) || null;
  // Every card the database holds is this age's, so any card's type names the age whose amounts apply.
  const age = ageOf(cards[0].type);
  host.appendChild(nowSection(read, active ? active.level : null, age, api));
  for (const card of cards) block.appendChild(cardBlock(card, active ? active.level : null, read, canSwap, api));
  if (active) block.appendChild(clearBlock(active.level, read, canSwap, age, api));
  if (!canSwap) block.appendChild(note(api.loc("LOC_ECONOMICS_FISCAL_NO_SWAP")));
  if (lastVerdict) block.appendChild(note(api.loc(verdictKey(lastVerdict))));
  block.appendChild(note(api.loc("LOC_ECONOMICS_FISCAL_NOTE")));
  host.appendChild(block);
}

/**
 * Where the civ stands now: its settlements' Gold and Happiness and the next celebration.
 * @param {FiscalRead} read
 * @param {string | null} activeLevel
 * @param {string | null} age
 * @param {ScreenApi} api
 */
function nowSection(read, activeLevel, age, api) {
  const now = cardForecast(activeLevel, activeLevel, read, age);
  return section(api.loc("LOC_ECONOMICS_FISCAL_NOW"), [
    row(api.loc("LOC_ECONOMICS_FISCAL_GOLD_NOW"), formatGold(read.goldCents)),
    row(api.loc("LOC_ECONOMICS_FISCAL_HAPPINESS_NOW"), formatGold(read.happinessCents)),
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
  const box = el("div", "econ-card");
  const head = el("div", "econ-card-head");
  head.appendChild(el("div", "econ-card-title", api.loc(level.nameKey)));
  if (card.active) head.appendChild(pill(api.loc("LOC_ECONOMICS_FISCAL_ACTIVE"), false));
  else if (!card.unlocked) head.appendChild(pill(lockedText(card, api), false));
  box.appendChild(head);
  box.appendChild(row(api.loc("LOC_ECONOMICS_FISCAL_EFFECT"), api.loc("LOC_ECONOMICS_FISCAL_EFFECT_ROW",
    formatGold(amounts.gold * 100, { signed: true }), formatGold(amounts.happiness * 100, { signed: true }))));
  if (level.atWar) {
    const war = atWarAmounts(card.level, age);
    box.appendChild(row(api.loc("LOC_ECONOMICS_FISCAL_EFFECT_AT_WAR"), api.loc("LOC_ECONOMICS_FISCAL_EFFECT_ROW",
      formatGold(war.gold * 100, { signed: true }), formatGold(war.happiness * 100, { signed: true }))));
  }
  if (!card.active) {
    for (const line of forecastRows(card.level, activeLevel, read, age, api)) box.appendChild(line);
    box.appendChild(button(api.loc("LOC_ECONOMICS_FISCAL_SLOT"), () => swap(card.type, api),
      { disabled: !canSwap || !card.unlocked }));
  }
  return box;
}

/**
 * "Not unlocked yet", with the civic or tech that opens the card when this age has one (DESIGN 4.15).
 * @param {import("./econ-fiscal.js").CardRead} card
 * @param {ScreenApi} api
 */
function lockedText(card, api) {
  return card.opener ? api.loc("LOC_ECONOMICS_FISCAL_LOCKED_BY", api.loc(card.opener))
    : api.loc("LOC_ECONOMICS_FISCAL_LOCKED");
}

/**
 * What changes against now: Gold and Happiness a turn, and the next celebration.
 * @param {string | null} level
 * @param {string | null} activeLevel
 * @param {FiscalRead} read
 * @param {string | null} age
 * @param {ScreenApi} api
 */
function forecastRows(level, activeLevel, read, age, api) {
  const forecast = cardForecast(level, activeLevel, read, age);
  const label = api.loc("LOC_ECONOMICS_FISCAL_FORECAST");
  const gold = formatGold(forecast.goldDeltaCents, { signed: true });
  const happiness = formatGold(forecast.happinessDeltaCents, { signed: true });
  return [
    row(label, api.loc("LOC_ECONOMICS_FISCAL_FORECAST_ROW", gold, happiness)),
    row(api.loc("LOC_ECONOMICS_FISCAL_CELEBRATION"), celebrationText(forecast.turnsToCelebration, read, api)),
  ];
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
  const box = el("div", "econ-card");
  box.appendChild(el("div", "econ-card-title", api.loc("LOC_ECONOMICS_FISCAL_NO_CARD")));
  for (const line of forecastRows(null, activeLevel, read, age, api)) box.appendChild(line);
  box.appendChild(button(api.loc("LOC_ECONOMICS_FISCAL_CLEAR"), () => swap(null, api), { disabled: !canSwap }));
  return box;
}

/**
 * The tariff row (DESIGN 4.10): hidden with Markets or Tariffs off, greyed until the Tariffs stage, one change per 5
 * turns, with what a tariff does in words.
 * @param {ScreenApi} api
 */
function tariffSection(api) {
  const input = api.input();
  if (input.options?.markets === false || input.options?.tariffs === false) return null;
  const block = section(api.loc("LOC_ECONOMICS_TARIFF"));
  for (const node of tariffRows(input, api)) block.appendChild(node);
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
  const me = input.civs.find((civ) => civ.id === api.me);
  if (!hasStage(me, "tariffs", input.turn, input.options)) {
    return [note(api.loc("LOC_ECONOMICS_TARIFF_STAGE",
      api.loc(api.stageOpener("tariffs") || "LOC_ECONOMICS_STAGE_NEXT_AGE")))];
  }
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
    api.request({ kind: "tariff", pid: api.me, level: id });
    api.rerender();
  };
  return [chips(["none", "low", "high"].map((id) => ({ id, label: name(id) })), level, pick)];
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
