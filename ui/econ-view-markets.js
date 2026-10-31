// econ-view-markets.js - Economics: the Markets tab (DESIGN 4.9, 9): a price board, dearest first. Each resource has
// its world price, how many copies the civilizations hold, the change over its history and a line of its last 30
// turns. Prices set the trade bills (Trade tab), and the tab says so, since holding a resource pays nothing by itself.

import { amount, el, empty, lineChart, note, section } from "./econ-dom.js";
import { formatGold } from "./econ-format.js";
import { marketView } from "./econ-view-commerce.js";
import { opensNext, rulesFor, turnLabels } from "./econ-view-common.js";

/** @typedef {import("./econ-screen-api.js").ScreenApi} ScreenApi */

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
  if (!rows.length) block.appendChild(empty(api.loc("LOC_ECONOMICS_MARKETS_NONE")));
  else block.appendChild(tableHead(api));
  for (const item of rows) block.appendChild(priceRow(item, input.markets?.lastTurn ?? input.turn, api));
  block.appendChild(note(api.loc("LOC_ECONOMICS_MARKETS_NOTE")));
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
    head.appendChild(el("div", cls, api.loc(key)));
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
