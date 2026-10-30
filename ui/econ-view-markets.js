// econ-view-markets.js - Economics: the Markets tab (DESIGN 4.9, 9): each resource's world price, how many copies the
// civilizations hold, and where the price has gone over the last 30 turns. Prices only set the trade bills (Trade
// tab), and the tab says so, since holding a resource pays nothing by itself.

import { el, note, row, section } from "./econ-dom.js";
import { formatGold } from "./econ-format.js";
import { marketView } from "./econ-view-commerce.js";

/** @typedef {import("./econ-screen-api.js").ScreenApi} ScreenApi */

/**
 * @param {HTMLElement} host
 * @param {ScreenApi} api
 */
export function renderMarkets(host, api) {
  const input = api.input();
  if (input.options?.markets === false) {
    host.appendChild(section(api.loc("LOC_ECONOMICS_MARKETS_PRICES"), [note(api.loc("LOC_ECONOMICS_MARKETS_OFF"))]));
    return;
  }
  const rows = marketView(input);
  const block = section(api.loc("LOC_ECONOMICS_MARKETS_PRICES"));
  if (!rows.length) block.appendChild(note(api.loc("LOC_ECONOMICS_MARKETS_NONE")));
  for (const item of rows) block.appendChild(priceRow(item, api));
  block.appendChild(note(api.loc("LOC_ECONOMICS_MARKETS_NOTE")));
  host.appendChild(block);
}

/**
 * One resource: its name, price and holders, and a small bar per turn of its history.
 * @param {ReturnType<typeof marketView>[number]} item
 * @param {ScreenApi} api
 */
function priceRow(item, api) {
  const box = el("div", "econ-card");
  box.appendChild(row(api.resourceName(item.type), api.loc("LOC_ECONOMICS_GOLD_AMOUNT", formatGold(item.priceCents))));
  const change = formatGold(item.changeCents, { signed: true });
  box.appendChild(note(api.loc("LOC_ECONOMICS_MARKETS_ROW", item.holders, change, item.history.length)));
  if (item.history.length > 1) box.appendChild(sparkline(item.history, (cents) => formatGold(cents)));
  return box;
}

/**
 * A history as flex bars (no SVG), scaled between its own low and high; each bar's tooltip is `label` of its value.
 * The World tab draws E's history with it too.
 * @param {number[]} history
 * @param {(value: number) => string} label
 */
export function sparkline(history, label) {
  const node = el("div", "econ-spark");
  const low = Math.min(...history);
  const span = Math.max(1, Math.max(...history) - low);
  for (const cents of history) {
    const bar = el("div", "econ-spark-bar");
    bar.style.height = `${Math.max(8, Math.round((100 * (cents - low)) / span))}%`;
    bar.setAttribute("data-tooltip-content", label(cents));
    node.appendChild(bar);
  }
  return node;
}
