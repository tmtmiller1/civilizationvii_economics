// econ-view-treasury.js - Economics: the Treasury tab (DESIGN 9). The main column is the ledger: balance, income,
// what Economics moved last turn (open it for each kind), upkeep, what's owed and due, the inflation reserve, and the
// cycle's Gold before the World tab opens; then the 20-turn projection with and without your loans; then aid before
// the Trade tab opens; then what moved, and why. The side column holds the debt-service gauge, your loans and the
// guard until the Loans tab opens, and the buildings that set financial depth. Until the rule that opens the Loans tab
// is met, the loan figures are left out and the projection is the balance alone.

import { formatFactor, formatGold } from "./econ-format.js";
import { composeArgs, describeEvent, eventConcerns, flowBreakdown, phaseKey } from "./econ-notice-text.js";
import { loansView, treasuryView } from "./econ-view-model.js";
import { cycleGoldLine, inflationLines, worldView } from "./econ-view-macro.js";
import { amount, changeRow, columns, el, empty, expander, lineChart, note, pill, projectionChart, row, section }
  from "./econ-dom.js";
import { opensNext, rulesFor, turnLabels } from "./econ-view-common.js";
import { cycleDial, inflationMeter, serviceMeter } from "./econ-view-instruments.js";
import { guardSection, mineSection, pendingSection } from "./econ-view-loans.js";
import { aidSection } from "./econ-view-trade.js";
import { CREDIT } from "./econ-params.js";
import { emptyLedger } from "./econ-state.js";

/** @typedef {import("./econ-screen-api.js").ScreenApi} ScreenApi */

/** @param {number} cents */
const toneOf = (cents) => (cents > 0 ? 1 : cents < 0 ? -1 : 0);

/**
 * @param {ScreenApi} api
 * @param {number} cents
 * @param {{ signed?: boolean, tone?: boolean }} [options]
 */
export function goldAmount(api, cents, { signed = false, tone = false } = {}) {
  return amount(formatGold(cents, { signed }), { tone: tone ? toneOf(cents) : 0,
    tooltip: api.loc("LOC_ECONOMICS_GOLD_AMOUNT", formatGold(cents, { signed })) });
}

/**
 * @param {HTMLElement} host
 * @param {ScreenApi} api
 */
export function renderTreasury(host, api) {
  const input = api.input();
  const view = treasuryView(input, api.me);
  const { rules } = rulesFor(api);
  /** @type {HTMLElement[]} */
  const side = [];
  const loanFigures = rules.sections["treasury.loanFigures"];
  const instruments = instrumentSection(input, view, loanFigures, api);
  if (instruments) side.push(instruments);
  const since = sinceSection(input, api);
  if (since) side.push(since);
  // Before the Loans tab opens, the player's loans and the guard switch are here.
  if (rules.sections["treasury.loans"]) side.push(...earlyLoans(input, api));
  if (rules.sections["treasury.depth"]) side.push(depthSection(api));
  if (rules.sections["treasury.old"]) side.push(oldSection(api));
  const main = [nowSection(input, view, rules, api), projectionSection(view, loanFigures, api)];
  if (rules.sections["treasury.aid"]) main.push(aidSection(input, api));
  main.push(flowsSection(api));
  host.appendChild(columns(main, side));
  const next = opensNext(api, rules.next.treasury);
  if (next) host.appendChild(next);
}

/**
 * Conditions at a glance: the cycle's dial for the player's own index (the one dial on the screen), then the share
 * of income the loans take on a slim scale with the lenders' limit marked, and inflation on its own scale for a civ
 * it reaches. The loan scale waits for loans (`loanFigures`); with nothing to show there's no section.
 * @param {PlanInput} input
 * @param {ReturnType<typeof treasuryView>} view
 * @param {boolean} loanFigures
 * @param {ScreenApi} api
 */
function instrumentSection(input, view, loanFigures, api) {
  /** @type {HTMLElement[]} */
  const parts = [];
  const world = worldView(input, api.me);
  if (world.cycleOn) parts.push(cycleDial(world, api));
  if (loanFigures) parts.push(serviceMeter(view.servicePct, api));
  const inflation = inflationLines(input, api.me);
  if (inflation.member) parts.push(inflationMeter(world.inflation.piPpm, api));
  return parts.length ? section(api.loc("LOC_ECONOMICS_TREASURY_INSTRUMENTS"), parts, { variant: "minor" }) : null;
}

/**
 * The ledger: balance, income, the mod's net with its parts, upkeep, debt, what's due (once loans are open); the
 * inflation reserve for a member; this turn's cycle Gold before the World tab.
 * @param {PlanInput} input
 * @param {ReturnType<typeof treasuryView>} view
 * @param {import("./econ-view-tabs.js").TabRules} rules
 * @param {ScreenApi} api
 */
function nowSection(input, view, rules, api) {
  const now = section(api.loc("LOC_ECONOMICS_TREASURY_NOW"));
  if (view.insolvent) {
    now.appendChild(pill(api.loc("LOC_ECONOMICS_TREASURY_INSOLVENT_PILL"), true));
    now.appendChild(note(api.loc("LOC_ECONOMICS_TREASURY_INSOLVENT")));
  }
  now.appendChild(row(api.loc("LOC_ECONOMICS_TREASURY_BALANCE"), goldAmount(api, view.balanceCents)));
  now.appendChild(row(api.loc("LOC_ECONOMICS_TREASURY_INCOME"), goldAmount(api, view.incomeCents,
    { signed: true, tone: true })));
  now.appendChild(modNetRow(input, api));
  now.appendChild(row(api.loc("LOC_ECONOMICS_TREASURY_UPKEEP"), goldAmount(api, view.upkeepCents)));
  if (rules.sections["treasury.loanFigures"]) {
    now.appendChild(row(api.loc("LOC_ECONOMICS_TREASURY_OUTSTANDING"), goldAmount(api, view.outstandingCents)));
    now.appendChild(row(api.loc("LOC_ECONOMICS_TREASURY_DUE_NEXT"), goldAmount(api, view.dueNextCents)));
    // AI-PLAN 4.2: what's held outside the treasury for those payments; it comes back the turn they're made.
    now.appendChild(row(api.loc("LOC_ECONOMICS_TREASURY_ESCROW"), goldAmount(api, view.escrowCents)));
    now.appendChild(row(api.loc("LOC_ECONOMICS_TREASURY_SERVICE_SHARE"), `${Math.max(0, view.servicePct)}%`,
      view.servicePct > CREDIT.servicePct ? "econ-negative" : ""));
  }
  for (const line of macroLines(input, rules, api)) now.appendChild(line);
  return now;
}

/**
 * The inflation reserve and erosion for a member, and this turn's cycle Gold before the World tab opens.
 * @param {PlanInput} input
 * @param {import("./econ-view-tabs.js").TabRules} rules
 * @param {ScreenApi} api
 */
function macroLines(input, rules, api) {
  /** @type {HTMLElement[]} */
  const lines = [];
  const now = { appendChild: (/** @type {HTMLElement} */ node) => lines.push(node) };
  const inflation = inflationLines(input, api.me);
  if (inflation.member) {
    now.appendChild(row(api.loc("LOC_ECONOMICS_TREASURY_RESERVE"), goldAmount(api, inflation.reserveCents)));
    now.appendChild(row(api.loc("LOC_ECONOMICS_TREASURY_EROSION"), goldAmount(api, -inflation.erosionCents,
      { tone: true })));
  }
  const cycle = rules.sections["treasury.cycle"] ? cycleGoldLine(input, api.me) : null;
  if (cycle?.on) {
    now.appendChild(row(api.loc("LOC_ECONOMICS_TREASURY_CYCLE", api.loc(phaseKey(cycle.phase))),
      goldAmount(api, cycle.cents, { signed: true, tone: true })));
  }
  return lines;
}

/**
 * What Economics moved for the player in the last batch, opening to each kind of flow.
 * @param {PlanInput} input
 * @param {ScreenApi} api
 */
function modNetRow(input, api) {
  const ledger = input.ledger || emptyLedger();
  const net = ledger.lastBatch?.civs.find((civ) => civ.pid === api.me)?.net ?? 0;
  const head = row(api.loc("LOC_ECONOMICS_TREASURY_MOD_NET"), goldAmount(api, net, { signed: true, tone: true }));
  return expander("treasury-net", head, () => {
    const transfers = api.lastTransfers?.() ?? null;
    if (transfers === null) return [note(api.loc("LOC_ECONOMICS_TREASURY_MOD_NET_LATER"))];
    const parts = flowBreakdown(transfers, api.me);
    if (!parts.length) return [note(api.loc("LOC_ECONOMICS_TREASURY_MOD_NET_NONE"))];
    const name = (/** @type {{ key: string, args: string[] }} */ part) => api.loc(part.key,
      ...part.args.map((arg) => api.loc(arg)));
    return parts.map((part) => row(name(part), goldAmount(api, part.cents, { signed: true, tone: true })));
  }, api.rerender, { show: api.loc("LOC_ECONOMICS_SHOW_PARTS"), hide: api.loc("LOC_ECONOMICS_HIDE_PARTS") });
}

/**
 * What changed since last turn, from what the save keeps: income a turn (the markets envelope's income marks, one a
 * batch) and the world's index (the cycle's history). Nothing is shown that the save doesn't hold; with neither
 * there's no section.
 * @param {PlanInput} input
 * @param {ScreenApi} api
 */
function sinceSection(input, api) {
  /** @type {HTMLElement[]} */
  const lines = [];
  const incomes = input.markets?.incomes?.[String(api.me)] || [];
  if (incomes.length >= 2) {
    const [before, now] = incomes.slice(-2);
    lines.push(changeRow(api.loc("LOC_ECONOMICS_TREASURY_INCOME"), formatGold(before, { signed: true }),
      formatGold(now, { signed: true }), Math.sign(now - before)));
  }
  const history = worldView(input, api.me).history;
  if (history.length >= 2) {
    const [before, now] = history.slice(-2);
    lines.push(changeRow(api.loc("LOC_ECONOMICS_WORLD_INDEX"), (before / 10000).toFixed(2), (now / 10000).toFixed(2),
      Math.sign(now - before)));
  }
  return lines.length ? section(api.loc("LOC_ECONOMICS_SINCE_LAST_TURN"), lines, { variant: "minor" }) : null;
}

/**
 * The loans and guard blocks of the Loans tab, shown here until that tab opens.
 * @param {PlanInput} input
 * @param {ScreenApi} api
 */
function earlyLoans(input, api) {
  const loans = loansView(input, api.me);
  /** @type {HTMLElement[]} */
  const out = [];
  if (loans.mine.length) out.push(mineSection(input, loans, api));
  out.push(guardSection(loans, api));
  if (api.pending().length) out.push(pendingSection(api));
  return out;
}

/**
 * The player's buildings from earlier ages (DESIGN 4.16): each one's weight and what moves it.
 * @param {ScreenApi} api
 */
function oldSection(api) {
  const old = api.depth().buildings.filter((building) => building.old && building.weights);
  const block = section(api.loc("LOC_ECONOMICS_TREASURY_OLD"));
  if (!old.length) { block.appendChild(empty(api.loc("LOC_ECONOMICS_TREASURY_OLD_NONE"))); return block; }
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
 * The 20-turn projection: with and without the player's loans while it owes on one, the balance alone otherwise.
 * With nothing owed the two lines would differ only by the mod's other flows (the cycle's share, trade bills), and
 * a gap labelled "with your loans" would be wrong.
 * @param {ReturnType<typeof treasuryView>} view
 * @param {boolean} loanFigures
 * @param {ScreenApi} api
 */
function projectionSection(view, loanFigures, api) {
  const last = (/** @type {number[]} */ series) => series[series.length - 1] ?? 0;
  const series = view.projection.withLoans;
  if (!loanFigures || !(view.outstandingCents > 0)) return balanceProjection(series, last(series), api);
  const withEnd = last(view.projection.withLoans);
  const withoutEnd = last(view.projection.without);
  const turns = turnLabels(api, api.input().turn, view.projection.withLoans.length, { ahead: true });
  const block = section(api.loc("LOC_ECONOMICS_TREASURY_PROJECTION"), [
    projectionChart(view.projection.withLoans, view.projection.without, { format: (cents) => formatGold(cents), turns,
      withLabel: api.loc("LOC_ECONOMICS_CHART_WITH"), withoutLabel: api.loc("LOC_ECONOMICS_CHART_WITHOUT") }),
    row(api.loc("LOC_ECONOMICS_TREASURY_PROJECTION_WITH"), goldAmount(api, withEnd, { tone: withEnd < 0 })),
    row(api.loc("LOC_ECONOMICS_TREASURY_PROJECTION_WITHOUT"), goldAmount(api, withoutEnd, { tone: withoutEnd < 0 })),
  ]);
  block.appendChild(note(api.loc("LOC_ECONOMICS_TREASURY_PROJECTION_NOTE")));
  return block;
}

/**
 * The projected balance on its own, before loans are open: the model's own projection (the guard and the mod's
 * flows run in it), one line on the chart.
 * @param {number[]} series
 * @param {number} end
 * @param {ScreenApi} api
 */
function balanceProjection(series, end, api) {
  const turns = turnLabels(api, api.input().turn, series.length, { ahead: true });
  return section(api.loc("LOC_ECONOMICS_TREASURY_PROJECTION"), [
    lineChart([{ values: series, tone: "gilt" }], { format: (cents) => formatGold(cents), turns, reference: 0,
      height: "8rem" }),
    row(api.loc("LOC_ECONOMICS_TREASURY_PROJECTION_BALANCE"), goldAmount(api, end, { tone: end < 0 })),
    note(api.loc("LOC_ECONOMICS_TREASURY_PROJECTION_BALANCE_NOTE")),
  ]);
}

/**
 * One event as a history line: its turn, then what happened.
 * @param {LedgerEvent} event
 * @param {Ledger} ledger
 * @param {ScreenApi} api
 */
function historyLine(event, ledger, api) {
  const line = describeEvent(event, { ledger, nameOf: api.nameOf });
  if (!line) return null;
  const shown = api.turnLabel(event.turn);
  const item = el("div", "econ-history-line");
  item.appendChild(el("div", "econ-history-turn", shown === null ? api.loc("LOC_ECONOMICS_TURN_EARLIER_AGE")
    : api.loc("LOC_ECONOMICS_TURN_SHORT", shown)));
  item.appendChild(el("div", "econ-history-text econ-line", api.loc(line.key, ...composeArgs(line.args, api.loc))));
  return item;
}

/**
 * The last batch's events that concern the player, newest first, each with its cause and turn.
 * @param {ScreenApi} api
 */
function flowsSection(api) {
  const ledger = api.input().ledger;
  const turn = ledger?.lastTurn ?? null;
  const events = (ledger?.events || []).filter((event) => eventConcerns(event, api.me)).slice(-12).reverse();
  const block = section(api.loc("LOC_ECONOMICS_TREASURY_FLOWS"));
  let shown = 0;
  for (const event of events) {
    const item = historyLine(event, /** @type {Ledger} */ (ledger), api);
    if (item) { block.appendChild(item); shown += 1; }
  }
  if (!shown) block.appendChild(empty(api.loc("LOC_ECONOMICS_TREASURY_NO_FLOWS")));
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
