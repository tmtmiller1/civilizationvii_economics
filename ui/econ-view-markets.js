// econ-view-markets.js - Economics: the Markets tab (DESIGN 4.9, 9; Part 6 of the hard-times plan): a price board,
// dearest first. An opening line says the prices are Economics' own, what sets them and what they change. Each
// resource has its world price, how many copies the civilizations hold, the change over its history and a line of its
// last 30 turns; pressed, it opens to the target's factors (from the same numbers the batch used), what it adds to
// your bills with each partner, what moves it, and a chart of the price beside its target with the turns a cause moved
// it marked.

import { amount, el, empty, expander, lineChart, note, section, sourceTag } from "./econ-dom.js";
import { formatGold } from "./econ-format.js";
import { marketView, resourceBills } from "./econ-view-commerce.js";
import { opensNext, rulesFor, turnLabels } from "./econ-view-common.js";
import { priceFactors } from "./econ-prices.js";
import { phaseOf } from "./econ-cycle.js";
import { standingResponses } from "./econ-crisis-rows.js";
import { PRICES } from "./econ-params.js";
import { cycleKPct } from "./econ-macro-state.js";

/** @typedef {import("./econ-screen-api.js").ScreenApi} ScreenApi */

/** The crisis responses that lift prices while they run, by the response id the ledger keeps. */
const PRICE_RESPONSES = { debase: "DEBASE", bullion: "BULLION", "gold-standard": "GOLD_STANDARD" };

/**
 * @param {HTMLElement} host
 * @param {ScreenApi} api
 */
export function renderMarkets(host, api) {
  const input = api.input();
  if (input.options?.markets === false) {
    host.appendChild(section(api.loc("LOC_ECONOMICS_MARKETS_PRICES"), [empty(api.loc("LOC_ECONOMICS_MARKETS_OFF"))]));
    return;
  }
  const rows = marketView(input);
  const block = section(api.loc("LOC_ECONOMICS_MARKETS_PRICES"), [], { subtitle: api.loc("LOC_ECONOMICS_MARKETS_SUB") });
  block.appendChild(note(api.loc("LOC_ECONOMICS_MARKETS_INTRO")));
  if (!rows.length) block.appendChild(empty(api.loc("LOC_ECONOMICS_MARKETS_NONE")));
  else block.appendChild(tableHead(api));
  const lastTurn = input.markets?.lastTurn ?? input.turn;
  for (const item of rows) {
    block.appendChild(expander(`market:${item.type}`, priceRow(item, lastTurn, api),
      () => priceDetail(item, input, lastTurn, api), api.rerender));
  }
  host.appendChild(block);
  const next = opensNext(api, rulesFor(api).rules.next.markets);
  if (next) host.appendChild(next);
}

/** @param {ScreenApi} api */
function tableHead(api) {
  const head = el("div", "econ-table-head font-title uppercase");
  for (const [key, cls] of [["LOC_ECONOMICS_MARKETS_COL_RESOURCE", "econ-price-name"],
    ["LOC_ECONOMICS_MARKETS_COL_PRICE", "econ-price-cell"], ["LOC_ECONOMICS_MARKETS_COL_HELD", "econ-price-cell"],
    ["LOC_ECONOMICS_MARKETS_COL_CHANGE", "econ-price-cell"], ["LOC_ECONOMICS_MARKETS_COL_HISTORY", "econ-price-spark"]]) {
    const cell = el("div", cls, api.loc(key));
    // The game has no resource prices: every price here is Economics' own.
    if (key === "LOC_ECONOMICS_MARKETS_COL_PRICE") cell.appendChild(sourceTag(api.loc("LOC_ECONOMICS_SOURCE_ECON"), "econ"));
    head.appendChild(cell);
  }
  return head;
}

/**
 * One resource: its name, price, holders, change and its history.
 * @param {ReturnType<typeof marketView>[number]} item
 * @param {number} lastTurn the counted turn the history ends on
 * @param {ScreenApi} api
 */
function priceRow(item, lastTurn, api) {
  const line = el("div", "econ-price");
  line.appendChild(el("div", "econ-price-name", api.resourceName(item.type)));
  const price = el("div", "econ-price-cell");
  price.appendChild(amount(formatGold(item.priceCents), { tooltip: api.loc("LOC_ECONOMICS_GOLD_AMOUNT",
    formatGold(item.priceCents)) }));
  line.appendChild(price);
  line.appendChild(el("div", "econ-price-cell", String(item.holders)));
  const tone = item.changeCents > 0 ? " econ-positive" : item.changeCents < 0 ? " econ-negative" : "";
  const change = el("div", `econ-price-cell${tone}`, formatGold(item.changeCents, { signed: true }));
  change.setAttribute("data-tooltip-content", api.loc("LOC_ECONOMICS_MARKETS_ROW", item.holders,
    formatGold(item.changeCents, { signed: true }), item.history.length));
  line.appendChild(change);
  const spark = el("div", "econ-price-spark");
  if (item.history.length > 1) {
    spark.appendChild(sparkline(item.history, (cents) => formatGold(cents),
      { turns: turnLabels(api, lastTurn, item.history.length) }));
  }
  line.appendChild(spark);
  return line;
}

/**
 * The opened row: the breakdown, what it changes for you, what moves it and the chart.
 * @param {ReturnType<typeof marketView>[number]} item
 * @param {PlanInput} input
 * @param {number} lastTurn
 * @param {ScreenApi} api
 */
function priceDetail(item, input, lastTurn, api) {
  const basis = input.markets?.basis ?? null;
  const parts = [];
  const breakdown = basis ? breakdownText(item, input, basis, api) : [api.loc("LOC_ECONOMICS_MARKETS_NO_BASIS")];
  for (const text of breakdown) parts.push(el("div", "econ-market-line", text));
  parts.push(el("div", "econ-market-head font-title uppercase", api.loc("LOC_ECONOMICS_MARKETS_YOU_HEAD")));
  for (const text of youLines(item.type, input, api)) parts.push(el("div", "econ-market-line", text));
  parts.push(el("div", "econ-market-head font-title uppercase", api.loc("LOC_ECONOMICS_MARKETS_LEVERS_HEAD")));
  for (const text of leverLines(item, input, basis, api)) parts.push(el("div", "econ-market-line econ-market-lever", text));
  if (item.history.length > 1) parts.push(priceChart(item, input, lastTurn, api));
  return parts;
}

/** A factor in percent as "1.30"; the terms are joined with " × ". @param {number} pct */
const times = (pct) => (pct / 100).toFixed(2);

/**
 * The price, the target with each factor and its cause, the pace it moves at, and any crisis lift or floor on top.
 * @param {ReturnType<typeof marketView>[number]} item
 * @param {PlanInput} input
 * @param {MarketBasis} basis
 * @param {ScreenApi} api
 */
export function breakdownText(item, input, basis, api) {
  const cls = (input.market?.resources || []).find((row) => row.type === item.type)?.class ?? "";
  const f = priceFactors({ type: item.type, class: cls }, { civs: basis.civs, copies: basis.copies[item.type] ?? 0,
    strategic: basis.strategic.includes(item.type), war: basis.war, industry: basis.industry, eBp: basis.eBp });
  const target = (input.markets?.targets?.[item.type] || []).at(-1) ?? f.targetCents;
  const lines = [api.loc("LOC_ECONOMICS_MARKETS_TARGET", formatGold(target), factorTerms(f, cls, api).join(" × ")),
    api.loc("LOC_ECONOMICS_MARKETS_PACE", formatGold(item.priceCents), 100 - basis.smoothingPct)];
  return [...lines, ...onTopLines(item, input, basis, api)];
}

/**
 * What lifts the price on top of the target: running crisis measures, and price supports holding a farm price up.
 * @param {ReturnType<typeof marketView>[number]} item
 * @param {PlanInput} input
 * @param {MarketBasis} basis
 * @param {ScreenApi} api
 */
function onTopLines(item, input, basis, api) {
  const lines = [];
  if (basis.pricePct > 0) {
    lines.push(api.loc("LOC_ECONOMICS_MARKETS_CRISIS", basis.pricePct, priceResponses(input, api).join(", ")));
  }
  if (basis.floored.includes(item.type)) lines.push(api.loc("LOC_ECONOMICS_MARKETS_FLOOR"));
  return lines;
}

/**
 * Each factor of the target with its cause; demand and the world economy only where they move it.
 * @param {ReturnType<typeof priceFactors>} f
 * @param {string} cls
 * @param {ScreenApi} api
 */
function factorTerms(f, cls, api) {
  const terms = [api.loc("LOC_ECONOMICS_MARKETS_F_BASE", formatGold(f.baseCents), api.loc(classKey(cls)))];
  const scarceKey = f.scarcityPct > 100 ? "SCARCE" : f.scarcityPct < 100 ? "PLENTY" : "EVEN";
  terms.push(api.loc(`LOC_ECONOMICS_MARKETS_F_${scarceKey}`, times(f.scarcityPct), f.civs, f.copies));
  if (f.demandPct !== 100) terms.push(api.loc("LOC_ECONOMICS_MARKETS_F_DEMAND", times(f.demandPct), demandCauses(f, api)));
  if (f.eBp !== 10000) {
    terms.push(api.loc("LOC_ECONOMICS_MARKETS_F_WORLD", times(f.eBp / 100), phaseName(phaseOf(f.eBp), api)));
  }
  return terms;
}

/** @param {string} cls */
function classKey(cls) {
  const known = ["BONUS", "CITY", "EMPIRE", "TREASURE", "FACTORY"];
  const name = cls.replace(/^RESOURCECLASS_/, "");
  return `LOC_ECONOMICS_MARKETS_CLASS_${known.includes(name) ? name : "OTHER"}`;
}

/**
 * @param {ReturnType<typeof priceFactors>} f
 * @param {ScreenApi} api
 */
function demandCauses(f, api) {
  const causes = [];
  if (f.strategic) causes.push(api.loc("LOC_ECONOMICS_MARKETS_CAUSE_UNITS"));
  if (f.war) causes.push(api.loc("LOC_ECONOMICS_MARKETS_CAUSE_WAR"));
  if (f.factory && f.industry > 0) causes.push(api.loc("LOC_ECONOMICS_MARKETS_CAUSE_INDUSTRY", f.industry));
  return causes.join(", ");
}

/** @param {string} phase @param {ScreenApi} api */
const phaseName = (phase, api) => api.loc(`LOC_ECONOMICS_PHASE_${phase.toUpperCase()}`);

/**
 * The running responses that lift prices, as "Debase the coin (Persia)".
 * @param {PlanInput} input
 * @param {ScreenApi} api
 */
function priceResponses(input, api) {
  const out = [];
  for (const civ of input.civs) {
    if (civ.alive !== true || api.hidden?.(civ.id)) continue;
    for (const row of input.ledger ? standingResponses(input.ledger, civ.id) : []) {
      const key = /** @type {Record<string, string>} */ (PRICE_RESPONSES)[row.id];
      if (key) out.push(api.loc("LOC_ECONOMICS_MARKETS_CRISIS_BY", api.loc(`LOC_ECONOMICS_RESPONSE_${key}_NAME`),
        api.nameOf(civ.id)));
    }
  }
  return out;
}

/**
 * What the resource adds to each of your bills, or what a partner owes you for it, or that you don't trade it.
 * @param {string} type
 * @param {PlanInput} input
 * @param {ScreenApi} api
 */
function youLines(type, input, api) {
  const gold = (/** @type {number} */ cents) => (cents > 0 && cents < 5 ? api.loc("LOC_ECONOMICS_MARKETS_LESS")
    : formatGold(cents));
  const lines = [];
  for (const row of resourceBills(input, api.me, type)) {
    if (api.hidden?.(row.partner)) continue;
    const name = api.nameOf(row.partner);
    if (row.youOweCents > 0) lines.push(api.loc("LOC_ECONOMICS_MARKETS_YOU_PAY", gold(row.youOweCents), name));
    if (row.theyOweCents > 0) lines.push(api.loc("LOC_ECONOMICS_MARKETS_YOU_GET", gold(row.theyOweCents), name));
  }
  if (!lines.length) return [api.loc("LOC_ECONOMICS_MARKETS_YOU_NONE")];
  lines.push(api.loc("LOC_ECONOMICS_MARKETS_YOU_NET"));
  return lines;
}

/**
 * The levers that move this resource's price or its bill, only those that apply to it.
 * @param {ReturnType<typeof marketView>[number]} item
 * @param {PlanInput} input
 * @param {MarketBasis | null} basis
 * @param {ScreenApi} api
 */
function leverLines(item, input, basis, api) {
  const strategic = (basis?.strategic ?? input.market?.strategic ?? []).includes(item.type);
  const capitalism = (basis?.smoothingPct ?? PRICES.smoothingPct) === PRICES.capitalismSmoothingPct;
  /** @type {[string, boolean][]} */
  const levers = [["COPIES", true], ["WAR", strategic], ["INDUSTRY", item.class === "RESOURCECLASS_FACTORY"],
    ["WORLD", cycleKPct(input.options?.cycle) !== 0], ["TRADE", true], ["TARIFF", input.options?.tariffs !== false],
    ["CAPITALISM", !capitalism]];
  return levers.filter(([, applies]) => applies).map(([key]) => api.loc(`LOC_ECONOMICS_MARKETS_LEVER_${key}`));
}

/**
 * The price and its target over the history's turns, with a mark on each turn a cause moved it.
 * @param {ReturnType<typeof marketView>[number]} item
 * @param {PlanInput} input
 * @param {number} lastTurn
 * @param {ScreenApi} api
 */
function priceChart(item, input, lastTurn, api) {
  const count = item.history.length;
  const targets = (input.markets?.targets?.[item.type] || []).slice(-count);
  const padded = [...Array(count - targets.length).fill(null), ...targets];
  const marks = marksFor(item, input, lastTurn, count, api);
  return lineChart([{ values: item.history, tone: "gilt", label: api.loc("LOC_ECONOMICS_MARKETS_LINE_PRICE") },
    { values: padded, tone: "ivory", label: api.loc("LOC_ECONOMICS_MARKETS_LINE_TARGET") }],
  { format: (cents) => formatGold(cents), turns: turnLabels(api, lastTurn, count), marks });
}

/**
 * The marks that bear on this resource, on the chart's turns: copies of it gained or lost, wars for a resource units
 * use, Industry buildings for a Factory resource, and the world economy's phase for all.
 * @param {ReturnType<typeof marketView>[number]} item
 * @param {PlanInput} input
 * @param {number} lastTurn
 * @param {number} count
 * @param {ScreenApi} api
 */
export function marksFor(item, input, lastTurn, count, api) {
  const strategic = (input.markets?.basis?.strategic ?? []).includes(item.type);
  const out = [];
  for (const m of input.markets?.marks || []) {
    const index = count - 1 - (lastTurn - m.t);
    if (index < 0 || index >= count) continue;
    const label = markLabel(m, item, strategic, api);
    if (label) out.push({ index, label });
  }
  return out;
}

/**
 * @param {MarketMark} m
 * @param {ReturnType<typeof marketView>[number]} item
 * @param {boolean} strategic
 * @param {ScreenApi} api
 */
function markLabel(m, item, strategic, api) {
  const d = Math.abs(m.d ?? 0);
  /** @type {Record<string, () => string | null>} */
  const labels = {
    gain: () => (m.r === item.type ? api.loc("LOC_ECONOMICS_MARKETS_MARK_GAIN", d) : null),
    loss: () => (m.r === item.type ? api.loc("LOC_ECONOMICS_MARKETS_MARK_LOSS", d) : null),
    war: () => (strategic ? api.loc("LOC_ECONOMICS_MARKETS_MARK_WAR") : null),
    peace: () => (strategic ? api.loc("LOC_ECONOMICS_MARKETS_MARK_PEACE") : null),
    industry: () => (item.class !== "RESOURCECLASS_FACTORY" ? null
      : api.loc((m.d ?? 0) > 0 ? "LOC_ECONOMICS_MARKETS_MARK_INDUSTRY_UP" : "LOC_ECONOMICS_MARKETS_MARK_INDUSTRY_DOWN", d)),
    phase: () => (m.p ? api.loc("LOC_ECONOMICS_MARKETS_MARK_PHASE", phaseName(m.p, api)) : null),
  };
  return labels[m.k]?.() ?? null;
}

/**
 * A history as a small line chart scaled between its own low and high; each turn's tooltip is `label` of its value.
 * The World tab draws the index's history with it too.
 * @param {number[]} history
 * @param {(value: number) => string} label
 * @param {{ turns: string[], reference?: number | null, height?: string }} options
 */
export function sparkline(history, label, { turns, reference = null, height = "2.2rem" }) {
  const node = lineChart([{ values: history, tone: "gilt" }], { format: label, turns, reference, height });
  node.classList.add("econ-spark");
  return node;
}
