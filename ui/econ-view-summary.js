// econ-view-summary.js - Economics: what sits above the tabs on every tab (DESIGN 9): under the title, the civ's
// economic system and the cycle's phase; then a strip of the figures that matter at a glance: the treasury, income a
// turn, what Economics moved last turn, the debt with this turn's payments (once loans are open, by the Loans tab's
// rule), the cycle's phase, and the requests waiting for the next turn. Each figure is on the face; its tooltip only
// explains it.

import { amount, el, pill, stat } from "./econ-dom.js";
import { formatGold } from "./econ-format.js";
import { outstandingOf } from "./econ-credit.js";
import { phaseKey, systemKey } from "./econ-notice-text.js";
import { dueNext } from "./econ-view-model.js";
import { systemView, worldView } from "./econ-view-macro.js";
import { emptyLedger } from "./econ-state.js";
import { rulesFor } from "./econ-view-common.js";

/** @typedef {import("./econ-screen-api.js").ScreenApi} ScreenApi */

/** @param {number} cents */
const tone = (cents) => (cents > 0 ? 1 : cents < 0 ? -1 : 0);

/**
 * The line under the title: "Civic market · Steady", with a pill when the Spoil Guard is hiding civilizations.
 * @param {HTMLElement} host
 * @param {ScreenApi} api
 */
export function renderSubtitle(host, api) {
  const input = api.input();
  const system = systemView(input, api.me);
  const world = worldView(input, api.me);
  /** @type {string[]} */
  const parts = [];
  if (system.on) parts.push(api.loc("LOC_ECONOMICS_SUMMARY_SYSTEM", api.loc(systemKey(system.system))));
  if (world.cycleOn) parts.push(api.loc(phaseKey(world.mine?.phase ?? world.worldPhase)));
  parts.forEach((text, index) => {
    if (index > 0) host.appendChild(el("div", "econ-subtitle-dot", "·"));
    host.appendChild(el("div", "font-title uppercase", text));
  });
  const hidden = input.civs.filter((civ) => civ.alive === true && civ.id !== api.me && api.hidden?.(civ.id)).length;
  if (hidden > 0) {
    const note = pill(api.loc("LOC_ECONOMICS_SPOIL_PILL", hidden), false);
    note.setAttribute("data-tooltip-content", api.loc("LOC_ECONOMICS_SPOIL_PILL_TIP"));
    host.appendChild(note);
  }
}

/**
 * The summary strip.
 * @param {HTMLElement} host
 * @param {ScreenApi} api
 */
export function renderSummary(host, api) {
  const input = api.input();
  const strip = el("div", "econ-summary");
  const debt = rulesFor(api).rules.sections["treasury.loanFigures"] ? debtTile(input, api) : null;
  for (const tile of [...moneyTiles(input, api), debt, phaseTile(input, api), waitingTile(api)]) {
    if (tile) strip.appendChild(tile);
  }
  host.appendChild(strip);
}

/**
 * The treasury, income a turn, and what Economics moved last turn.
 * @param {PlanInput} input
 * @param {ScreenApi} api
 */
function moneyTiles(input, api) {
  const me = input.civs.find((civ) => civ.id === api.me);
  const balance = me?.balanceCents ?? 0;
  const income = me?.incomeCents ?? 0;
  const net = (input.ledger || emptyLedger()).lastBatch?.civs.find((civ) => civ.pid === api.me)?.net ?? null;
  return [
    stat(api.loc("LOC_ECONOMICS_SUMMARY_TREASURY"), amount(formatGold(balance), { big: true }),
      { tooltip: api.loc("LOC_ECONOMICS_SUMMARY_TREASURY_TIP") }),
    stat(api.loc("LOC_ECONOMICS_SUMMARY_INCOME"),
      amount(formatGold(income, { signed: true }), { big: true, tone: tone(income) }),
      { sub: api.loc("LOC_ECONOMICS_SUMMARY_PER_TURN"), tooltip: api.loc("LOC_ECONOMICS_SUMMARY_INCOME_TIP") }),
    stat(api.loc("LOC_ECONOMICS_SUMMARY_MOD"), net === null ? el("div", "econ-stat-value", "–")
      : amount(formatGold(net, { signed: true }), { big: true, tone: tone(net) }),
    { sub: api.loc("LOC_ECONOMICS_SUMMARY_LAST_TURN"), tooltip: api.loc("LOC_ECONOMICS_SUMMARY_MOD_TIP") }),
  ];
}

/**
 * What the player owes, red in default, with this turn's payments.
 * @param {PlanInput} input
 * @param {ScreenApi} api
 */
function debtTile(input, api) {
  const ledger = input.ledger || emptyLedger();
  const owed = outstandingOf(ledger, api.me);
  const inDefault = ledger.loans.some((loan) => loan.borrower === api.me && loan.state === "default");
  const sub = owed > 0 ? api.loc("LOC_ECONOMICS_SUMMARY_DUE", formatGold(dueNext(ledger, api.me)))
    : api.loc("LOC_ECONOMICS_SUMMARY_NO_DEBT");
  return stat(api.loc("LOC_ECONOMICS_SUMMARY_DEBT"), amount(formatGold(owed), { big: true, tone: inDefault ? -1 : 0 }),
    { sub, tooltip: api.loc("LOC_ECONOMICS_SUMMARY_DEBT_TIP") });
}

/**
 * The cycle's phase for the player, with its index; none with the cycle off.
 * @param {PlanInput} input
 * @param {ScreenApi} api
 */
function phaseTile(input, api) {
  const world = worldView(input, api.me);
  if (!world.cycleOn) return null;
  const phase = world.mine?.phase ?? world.worldPhase;
  const index = ((world.mine?.index ?? world.e) / 10000).toFixed(2);
  const look = ["slump", "depression", "panic"].includes(phase) ? " econ-negative" : phase === "boom" ? " econ-positive" : "";
  return stat(api.loc("LOC_ECONOMICS_SUMMARY_PHASE"), el("div", `econ-stat-value${look}`, api.loc(phaseKey(phase))),
    { sub: api.loc("LOC_ECONOMICS_SUMMARY_INDEX", index), tooltip: api.loc("LOC_ECONOMICS_SUMMARY_PHASE_TIP") });
}

/** The requests waiting for the next turn, when there are any. @param {ScreenApi} api */
function waitingTile(api) {
  const waiting = api.pending().length;
  if (!waiting) return null;
  return stat(api.loc("LOC_ECONOMICS_SUMMARY_WAITING"), el("div", "econ-stat-value", String(waiting)),
    { sub: api.loc("LOC_ECONOMICS_SUMMARY_WAITING_SUB") });
}
