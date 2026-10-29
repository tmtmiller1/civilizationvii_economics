// econ-view-treasury.js - Economics: the Treasury tab (DESIGN 9): balance, income, what's due next turn, the share of
// income the loans take, the 20-turn projection with and without them, this turn's flows with their cause, and the
// buildings that set financial depth.

import { el, note, projectionChart, row, section } from "./econ-dom.js";
import { formatFactor, formatGold, formatPct } from "./econ-format.js";
import { describeEvent, eventConcerns } from "./econ-notice-text.js";
import { treasuryView } from "./econ-view-model.js";

/** @typedef {import("./econ-screen-api.js").ScreenApi} ScreenApi */

/**
 * @param {HTMLElement} host
 * @param {ScreenApi} api
 */
export function renderTreasury(host, api) {
  const input = api.input();
  const view = treasuryView(input, api.me);
  const gold = (/** @type {number} */ cents) => api.loc("LOC_ECONOMICS_GOLD_AMOUNT", formatGold(cents));
  const signed = (/** @type {number} */ cents) => api.loc("LOC_ECONOMICS_GOLD_AMOUNT", formatGold(cents, { signed: true }));
  const now = section(api.loc("LOC_ECONOMICS_TREASURY_NOW"), [
    row(api.loc("LOC_ECONOMICS_TREASURY_BALANCE"), gold(view.balanceCents)),
    row(api.loc("LOC_ECONOMICS_TREASURY_INCOME"), signed(view.incomeCents), view.incomeCents < 0 ? "econ-negative" : ""),
    row(api.loc("LOC_ECONOMICS_TREASURY_UPKEEP"), gold(view.upkeepCents)),
    row(api.loc("LOC_ECONOMICS_TREASURY_OUTSTANDING"), gold(view.outstandingCents)),
    row(api.loc("LOC_ECONOMICS_TREASURY_DUE_NEXT"), gold(view.dueNextCents)),
    row(api.loc("LOC_ECONOMICS_TREASURY_SERVICE_SHARE"), formatPct(view.servicePct).replace("+", "")),
  ]);
  if (view.insolvent) now.appendChild(note(api.loc("LOC_ECONOMICS_TREASURY_INSOLVENT")));
  host.appendChild(now);
  host.appendChild(projectionSection(view, api));
  host.appendChild(flowsSection(api));
  host.appendChild(depthSection(api));
}

/**
 * @param {ReturnType<typeof treasuryView>} view
 * @param {ScreenApi} api
 */
function projectionSection(view, api) {
  const last = (/** @type {number[]} */ series) => series[series.length - 1] ?? 0;
  const block = section(api.loc("LOC_ECONOMICS_TREASURY_PROJECTION"), [
    projectionChart(view.projection.withLoans, view.projection.without, (cents) => formatGold(cents)),
    row(api.loc("LOC_ECONOMICS_TREASURY_PROJECTION_WITH"), formatGold(last(view.projection.withLoans))),
    row(api.loc("LOC_ECONOMICS_TREASURY_PROJECTION_WITHOUT"), formatGold(last(view.projection.without))),
  ]);
  block.appendChild(note(api.loc("LOC_ECONOMICS_TREASURY_PROJECTION_NOTE")));
  return block;
}

/**
 * The last batch's events that concern the player, newest first, each with its cause.
 * @param {ScreenApi} api
 */
function flowsSection(api) {
  const ledger = api.input().ledger;
  const turn = ledger?.lastTurn ?? null;
  const events = (ledger?.events || []).filter((event) => eventConcerns(event, api.me)).slice(-12).reverse();
  const lines = events.map((event) => {
    const line = describeEvent(event, { ledger: /** @type {Ledger} */ (ledger), nameOf: api.nameOf });
    return line ? el("div", "econ-line", `${event.turn}: ${api.loc(line.key, ...line.args)}`) : null;
  }).filter((line) => line !== null);
  const block = section(api.loc("LOC_ECONOMICS_TREASURY_FLOWS"), /** @type {HTMLElement[]} */ (lines));
  if (!lines.length) block.appendChild(note(api.loc("LOC_ECONOMICS_TREASURY_NO_FLOWS")));
  else if (turn !== null) block.appendChild(note(api.loc("LOC_ECONOMICS_TREASURY_FLOWS_NOTE", turn)));
  return block;
}

/**
 * The player's Commerce and Banking buildings and what they do to credit and rates (DESIGN 4.13).
 * @param {ScreenApi} api
 */
function depthSection(api) {
  const depth = api.depth();
  const block = section(api.loc("LOC_ECONOMICS_TREASURY_BUILDINGS"), [
    row(api.loc("LOC_ECONOMICS_ROLE_COMMERCE"), String(depth.buildings.filter((b) => b.roles.commerce).length)),
    row(api.loc("LOC_ECONOMICS_ROLE_BANKING"), String(depth.buildings.filter((b) => b.roles.banking).length)),
    row(api.loc("LOC_ECONOMICS_TREASURY_DEPTH_TURNS"), `+${depth.depthTurns}`),
    row(api.loc("LOC_ECONOMICS_TREASURY_DEPTH_FACTOR"), formatFactor(depth.depthFactorPct)),
  ]);
  return block;
}
