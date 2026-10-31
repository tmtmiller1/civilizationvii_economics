// econ-view-treasury.js - Economics: the Treasury tab (DESIGN 9): balance, income, what's due next turn, the share of
// income the loans take, the 20-turn projection with and without them, this turn's flows with their cause, and the
// buildings that set financial depth.

import { el, note, projectionChart, row, section } from "./econ-dom.js";
import { formatFactor, formatGold, formatPct } from "./econ-format.js";
import { composeArgs, describeEvent, eventConcerns } from "./econ-notice-text.js";
import { loansView, treasuryView } from "./econ-view-model.js";
import { cycleGoldLine, inflationLines } from "./econ-view-macro.js";
import { opensNext, rulesFor } from "./econ-view-common.js";
import { guardSection, mineSection, pendingSection } from "./econ-view-loans.js";
import { phaseKey } from "./econ-notice-text.js";

/** @typedef {import("./econ-screen-api.js").ScreenApi} ScreenApi */

/**
 * @param {HTMLElement} host
 * @param {ScreenApi} api
 */
export function renderTreasury(host, api) {
  const input = api.input();
  const view = treasuryView(input, api.me);
  const { rules } = rulesFor(api);
  host.appendChild(nowSection(input, view, rules, api));
  host.appendChild(projectionSection(view, api));
  // Before the Loans tab opens, the player's loans and the guard switch are here.
  if (rules.sections["treasury.loans"]) earlyLoans(host, input, api);
  host.appendChild(flowsSection(api));
  if (rules.sections["treasury.depth"]) host.appendChild(depthSection(api));
  if (rules.sections["treasury.old"]) host.appendChild(oldSection(api));
  const next = opensNext(api, rules.next.treasury);
  if (next) host.appendChild(next);
}

/**
 * Balance, income, what's due; the inflation reserve for a member; this turn's cycle Gold before the World tab.
 * @param {PlanInput} input
 * @param {ReturnType<typeof treasuryView>} view
 * @param {import("./econ-view-tabs.js").TabRules} rules
 * @param {ScreenApi} api
 */
function nowSection(input, view, rules, api) {
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
  const inflation = inflationLines(input, api.me);
  if (inflation.member) {
    now.appendChild(row(api.loc("LOC_ECONOMICS_TREASURY_RESERVE"), gold(inflation.reserveCents)));
    now.appendChild(row(api.loc("LOC_ECONOMICS_TREASURY_EROSION"), gold(inflation.erosionCents),
      inflation.erosionCents > 0 ? "econ-negative" : ""));
  }
  const cycle = rules.sections["treasury.cycle"] ? cycleGoldLine(input, api.me) : null;
  if (cycle?.on) {
    now.appendChild(row(api.loc("LOC_ECONOMICS_TREASURY_CYCLE", api.loc(phaseKey(cycle.phase))), signed(cycle.cents),
      cycle.cents < 0 ? "econ-negative" : ""));
  }
  return now;
}

/**
 * The loans and guard blocks of the Loans tab, shown here until that tab opens.
 * @param {HTMLElement} host
 * @param {PlanInput} input
 * @param {ScreenApi} api
 */
function earlyLoans(host, input, api) {
  const loans = loansView(input, api.me);
  if (loans.mine.length) host.appendChild(mineSection(input, loans, api));
  host.appendChild(guardSection(loans, api));
  if (api.pending().length) host.appendChild(pendingSection(api));
}

/**
 * The player's buildings from earlier ages (DESIGN 4.16): each one's weight and what moves it.
 * @param {ScreenApi} api
 */
function oldSection(api) {
  const old = api.depth().buildings.filter((building) => building.old && building.weights);
  const block = section(api.loc("LOC_ECONOMICS_TREASURY_OLD"));
  if (!old.length) { block.appendChild(note(api.loc("LOC_ECONOMICS_TREASURY_OLD_NONE"))); return block; }
  for (const building of old.slice(0, 16)) {
    const weight = averageWeight(building);
    const name = `${api.buildName(building.type)}, ${api.cityName(building.city)}`;
    block.appendChild(row(api.loc("LOC_ECONOMICS_TREASURY_OLD_ROW", name, weight.toFixed(2)), triggerText(building,
      weight, api)));
  }
  block.appendChild(note(api.loc("LOC_ECONOMICS_TREASURY_OLD_NOTE")));
  return block;
}

/**
 * An old building's weight averaged over the fading roles it has.
 * @param {import("./econ-macro-read.js").EconomyBuilding} building
 */
function averageWeight(building) {
  const roles = ["commerce", "trade", "banking"].filter((role) => building.roles[/** @type {"trade"} */ (role)]);
  if (!roles.length || !building.weights) return 1;
  let sum = 0;
  for (const role of roles) sum += building.weights[role];
  return sum / roles.length;
}

/**
 * What holds or moves an old building's weight: a newer building of its role in the city, the stage it waits on, or
 * its fade.
 * @param {import("./econ-macro-read.js").EconomyBuilding} building
 * @param {number} weight
 * @param {ScreenApi} api
 */
function triggerText(building, weight, api) {
  if (building.replaced.length) return api.loc("LOC_ECONOMICS_TREASURY_OLD_REPLACED");
  if (building.fadingFrom.length && weight >= 1) {
    const stage = building.fadingFrom[0];
    const opener = api.stageOpener(stage);
    return api.loc("LOC_ECONOMICS_TREASURY_OLD_WAITING",
      api.loc(opener || `LOC_ECONOMICS_STAGE_NAME_${stage.replace(/([A-Z])/g, "_$1").toUpperCase()}`));
  }
  const floor = building.ages >= 2 ? 0.25 : 0.5;
  return api.loc(weight <= floor ? "LOC_ECONOMICS_TREASURY_OLD_FLOOR" : "LOC_ECONOMICS_TREASURY_OLD_FADING");
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
    const shown = api.turnLabel(event.turn);
    const when = shown === null ? api.loc("LOC_ECONOMICS_TURN_EARLIER_AGE") : String(shown);
    return line ? el("div", "econ-line", `${when}: ${api.loc(line.key, ...composeArgs(line.args, api.loc))}`) : null;
  }).filter((line) => line !== null);
  const block = section(api.loc("LOC_ECONOMICS_TREASURY_FLOWS"), /** @type {HTMLElement[]} */ (lines));
  if (!lines.length) block.appendChild(note(api.loc("LOC_ECONOMICS_TREASURY_NO_FLOWS")));
  else if (turn !== null) {
    block.appendChild(note(api.loc("LOC_ECONOMICS_TREASURY_FLOWS_NOTE", api.turnLabel(turn) ?? turn)));
  }
  return block;
}

/**
 * The player's buildings by role (DESIGN 4.13): Commerce and Banking set credit and rates, Trade moves the bills,
 * Industry raises Factory demand, Warehouse acts with the business cycle (1.2).
 * @param {ScreenApi} api
 */
function depthSection(api) {
  const depth = api.depth();
  const block = section(api.loc("LOC_ECONOMICS_TREASURY_BUILDINGS"), [
    row(api.loc("LOC_ECONOMICS_ROLE_COMMERCE"), String(depth.buildings.filter((b) => b.roles.commerce).length)),
    row(api.loc("LOC_ECONOMICS_ROLE_BANKING"), String(depth.buildings.filter((b) => b.roles.banking).length)),
    row(api.loc("LOC_ECONOMICS_ROLE_TRADE"), String(depth.buildings.filter((b) => b.roles.trade).length)),
    row(api.loc("LOC_ECONOMICS_ROLE_WAREHOUSE"), String(depth.buildings.filter((b) => b.roles.warehouse).length)),
    row(api.loc("LOC_ECONOMICS_ROLE_INDUSTRY"), String(depth.buildings.filter((b) => b.roles.industry).length)),
    row(api.loc("LOC_ECONOMICS_TREASURY_DEPTH_TURNS"), `+${depth.depthTurns}`),
    row(api.loc("LOC_ECONOMICS_TREASURY_DEPTH_FACTOR"), formatFactor(depth.depthFactorPct)),
  ]);
  return block;
}
