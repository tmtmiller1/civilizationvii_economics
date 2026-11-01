// econ-view-world.js - Economics: the World tab (DESIGN 4.8, 4.11, 4.16, 9): the world's economic index and phase
// beside the player's own, what moved it lately, its last 30 turns, inflation and its cause, world debt against the
// Gold the civilizations hold, and the player's legacy from old buildings with the slump cushion it gives.

import { button, columns, confirmCard, el, empty, isConfirming, lineChart, note, pill, row, section,
  setConfirming } from "./econ-dom.js";
import { formatGold, formatRate } from "./econ-format.js";
import { crisisKey, cycleEventKey, joinList, reasonKey, responseKey } from "./econ-notice-text.js";
import { worldView } from "./econ-view-macro.js";
import { crisisPanel } from "./econ-view-model.js";
import { RESPONSE_RULES } from "./econ-crisis-catalog.js";
import { opensNext, rulesFor, send, turnLabels } from "./econ-view-common.js";
import { cycleDial, inflationMeter } from "./econ-view-instruments.js";

/** @typedef {import("./econ-screen-api.js").ScreenApi} ScreenApi */

/**
 * An index in basis points as the tab shows it: 9800 is "0.98".
 * @param {number} bp
 */
export function formatIndex(bp) {
  return (Math.round(Number(bp) || 0) / 10000).toFixed(2);
}

/**
 * An event's weight as a signed index change: -200 is "-0.020".
 * @param {number} bp
 */
export function formatWeight(bp) {
  const value = (Math.round(Number(bp) || 0) / 10000).toFixed(3);
  return bp > 0 ? `+${value}` : value;
}

/**
 * @param {HTMLElement} host
 * @param {ScreenApi} api
 */
export function renderWorld(host, api) {
  const view = worldView(api.input(), api.me);
  const { rules } = rulesFor(api);
  /** @type {HTMLElement[]} */
  const main = [];
  if (rules.sections["world.crisis"]) {
    const crisis = crisisSection(api);
    if (crisis) main.push(crisis);
  }
  main.push(nowSection(view, rules.sections["world.inflation"], api));
  if (view.cycleOn) {
    if (view.history.length > 1) main.push(historySection(view, api));
    main.push(eventsSection(view, api));
  }
  /** @type {HTMLElement[]} */
  const side = [];
  if (rules.sections["world.inflation"]) side.push(inflationSection(view, api));
  side.push(debtSection(view, api));
  if (rules.sections["world.legacy"]) side.push(legacySection(api));
  host.appendChild(columns(main, side));
  const next = opensNext(api, rules.next.world);
  if (next) host.appendChild(next);
}

/**
 * The instruments: the world's index and the player's own on the cycle gauge, and inflation on its own when it's on.
 * @param {ReturnType<typeof worldView>} view
 * @param {boolean} inflationShown
 * @param {ScreenApi} api
 */
function nowSection(view, inflationShown, api) {
  const block = section(api.loc("LOC_ECONOMICS_WORLD_NOW"));
  if (!view.cycleOn) { block.appendChild(empty(api.loc("LOC_ECONOMICS_WORLD_CYCLE_OFF"))); return block; }
  block.appendChild(cycleDial(view, api));
  if (inflationShown && view.inflation.on) block.appendChild(inflationMeter(view.inflation.piPpm, api));
  if (view.panic) {
    const turn = view.panicUntil === null ? "" : api.turnLabel(view.panicUntil) ?? view.panicUntil;
    block.appendChild(pill(api.loc("LOC_ECONOMICS_WORLD_PANIC", turn), true));
  }
  block.appendChild(note(api.loc("LOC_ECONOMICS_WORLD_NOTE")));
  return block;
}

/**
 * The world index over its last 30 turns, with 1.00 marked.
 * @param {ReturnType<typeof worldView>} view
 * @param {ScreenApi} api
 */
function historySection(view, api) {
  const turns = turnLabels(api, api.input().ledger?.lastTurn ?? api.input().turn, view.history.length);
  const chart = lineChart([{ values: view.history, tone: "gilt" }], { format: formatIndex, turns, reference: 10000,
    height: "8rem" });
  return section(api.loc("LOC_ECONOMICS_WORLD_HISTORY", view.history.length), [chart,
    note(api.loc("LOC_ECONOMICS_WORLD_HISTORY_NOTE"))]);
}

/**
 * @param {ReturnType<typeof worldView>} view
 * @param {ScreenApi} api
 */
function eventsSection(view, api) {
  const block = section(api.loc("LOC_ECONOMICS_WORLD_EVENTS"));
  if (!view.events.length) block.appendChild(empty(api.loc("LOC_ECONOMICS_WORLD_EVENTS_NONE")));
  for (const event of view.events) {
    const who = [event.a, event.b].filter((x) => x !== null).map((pid) => api.nameOf(/** @type {number} */ (pid)));
    const label = api.loc("LOC_ECONOMICS_WORLD_EVENT_ROW", api.loc(cycleEventKey(event.kind)),
      who.length ? `(${who.join(", ")})` : "");
    const shown = api.turnLabel(event.turn);
    const when = shown === null ? api.loc("LOC_ECONOMICS_TURN_EARLIER_AGE") : String(shown);
    block.appendChild(row(`${when}: ${label}`, formatWeight(event.w), event.w < 0 ? "econ-negative" : ""));
  }
  return block;
}

/**
 * @param {ReturnType<typeof worldView>} view
 * @param {ScreenApi} api
 */
function inflationSection(view, api) {
  const block = section(api.loc("LOC_ECONOMICS_WORLD_INFLATION"));
  const { inflation } = view;
  if (!inflation.on) { block.appendChild(empty(api.loc("LOC_ECONOMICS_WORLD_INFLATION_OFF"))); return block; }
  if (!(inflation.bondCents > 0)) { block.appendChild(empty(api.loc("LOC_ECONOMICS_WORLD_INFLATION_NONE"))); return block; }
  block.appendChild(row(api.loc("LOC_ECONOMICS_WORLD_INFLATION_RATE"), formatRate(inflation.piPpm)));
  block.appendChild(row(api.loc("LOC_ECONOMICS_WORLD_INFLATION_BOND"), formatGold(inflation.bondCents)));
  block.appendChild(row(api.loc("LOC_ECONOMICS_WORLD_INFLATION_MONEY"), formatGold(inflation.moneyCents)));
  if (inflation.top !== null) {
    block.appendChild(note(api.loc("LOC_ECONOMICS_WORLD_INFLATION_CAUSE", (inflation.ratioPct / 100).toFixed(1),
      api.nameOf(inflation.top))));
  }
  block.appendChild(note(api.loc("LOC_ECONOMICS_WORLD_INFLATION_NOTE")));
  return block;
}

/**
 * @param {ReturnType<typeof worldView>} view
 * @param {ScreenApi} api
 */
function debtSection(view, api) {
  const block = section(api.loc("LOC_ECONOMICS_WORLD_DEBT"), [
    row(api.loc("LOC_ECONOMICS_WORLD_DEBT_OUTSTANDING"), formatGold(view.debt.outstandingCents)),
    row(api.loc("LOC_ECONOMICS_WORLD_DEBT_LEVERAGE"), (view.debt.leverPct / 100).toFixed(1),
      view.debt.leverPct > view.debt.panicLeverPct ? "econ-negative" : ""),
  ]);
  block.appendChild(note(api.loc("LOC_ECONOMICS_WORLD_DEBT_NOTE", (view.debt.panicLeverPct / 100).toFixed(1))));
  return block;
}

/**
 * The Crisis section (DESIGN 4.11b, 4.11c): each open crisis with its causes, what the player is doing about it, and
 * what it can do, each response a card with its history, what it does now, its price and what it leaves. Null when
 * nothing is open and nothing stands.
 * @param {ScreenApi} api
 */
function crisisSection(api) {
  const view = crisisPanel(api.input(), api.me);
  if (!view.on || (!view.crises.length && !view.standing.length)) return null;
  const block = section(api.loc("LOC_ECONOMICS_CRISIS_SECTION"), [], { className: "econ-crisis" });
  for (const crisis of view.crises) block.appendChild(crisisCard(crisis, api));
  if (view.standing.length) {
    block.appendChild(el("div", "econ-section-subtitle font-body", api.loc("LOC_ECONOMICS_CRISIS_DOING")));
    for (const standing of view.standing) block.appendChild(standingCard(standing, view, api));
  } else if (view.crises.length) {
    block.appendChild(note(api.loc("LOC_ECONOMICS_CRISIS_NOTHING_NOTE")));
  }
  if (view.responses.length) {
    block.appendChild(el("div", "econ-section-subtitle font-body", api.loc("LOC_ECONOMICS_CRISIS_CAN_DO")));
    for (const response of view.responses) block.appendChild(responseCard(response, view, api));
  }
  return block;
}

/**
 * @param {{ kind: string, since: number, turns: number, causes: string[] }} crisis
 * @param {ScreenApi} api
 */
function crisisCard(crisis, api) {
  const box = el("div", "econ-card econ-card--trouble");
  const head = el("div", "econ-card-head");
  head.appendChild(el("div", "econ-card-title", api.loc(crisisKey(crisis.kind))));
  head.appendChild(pill(api.loc("LOC_ECONOMICS_CRISIS_TURNS", crisis.turns), true));
  box.appendChild(head);
  box.appendChild(el("div", "econ-card-sub", api.loc(`${crisisKey(crisis.kind).replace(/_NAME$/, "")}_LINE`)));
  const since = api.turnLabel(crisis.since) ?? crisis.since;
  const causes = joinList(crisis.causes.map((kind) => api.loc(cycleEventKey(kind))), api.loc("LOC_ECONOMICS_LIST_AND"));
  box.appendChild(note(causes ? api.loc("LOC_ECONOMICS_CRISIS_SINCE", since, causes)
    : api.loc("LOC_ECONOMICS_CRISIS_SINCE_QUIET", since)));
  return box;
}

/**
 * @param {{ id: string, since: number, left: number | null, crisis: string }} standing
 * @param {ReturnType<typeof crisisPanel>} view
 * @param {ScreenApi} api
 */
function standingCard(standing, view, api) {
  const box = el("div", "econ-card econ-card--active");
  const head = el("div", "econ-card-head");
  head.appendChild(el("div", "econ-card-title", api.loc(responseKey(standing.id))));
  head.appendChild(pill(standing.left === null ? api.loc("LOC_ECONOMICS_CRISIS_UNTIL_END")
    : api.loc("LOC_ECONOMICS_CRISIS_TURNS_LEFT", standing.left), false));
  box.appendChild(head);
  box.appendChild(el("div", "econ-card-sub", api.loc(responseNowKey(standing.id), ...responseArgs(standing.id, view))));
  if (standing.id === "bank-run") return box;
  const id = `respond-end:${standing.id}`;
  if (isConfirming(id)) {
    box.appendChild(confirmCard({ title: api.loc("LOC_ECONOMICS_CRISIS_END_TITLE", api.loc(responseKey(standing.id))),
      lines: [note(api.loc(standing.id === "relief" ? "LOC_ECONOMICS_CRISIS_END_RELIEF" : "LOC_ECONOMICS_CRISIS_END_NOTE"))],
      confirm: api.loc("LOC_ECONOMICS_CONFIRM"), cancel: api.loc("LOC_ECONOMICS_CANCEL"), warning: standing.id === "relief",
      onConfirm: () => send(api, { kind: "respond", pid: api.me, response: standing.id, cancel: true }),
      rerender: api.rerender }));
  } else {
    box.appendChild(button(api.loc("LOC_ECONOMICS_CRISIS_END_BUTTON"), () => { setConfirming(id); api.rerender(); },
      { className: "econ-button--quiet econ-button--small" }));
  }
  return box;
}

/** The key of a response's "now" line, and the others beside it. @param {string} id */
const responseNowKey = (id) => `${responseKey(id).replace(/_NAME$/, "")}_NOW`;

/**
 * The figures a response's lines compose: public works' Gold a settlement in this age.
 * @param {string} id
 * @param {ReturnType<typeof crisisPanel>} view
 */
function responseArgs(id, view) {
  if (id !== "public-works") return [];
  const perSettlement = RESPONSE_RULES.publicWorks.goldPerSettlement;
  return [formatGold(perSettlement[/** @type {"AQ" | "EX" | "MO"} */ (view.age)] ?? perSettlement.AQ)];
}

/**
 * @param {{ id: string, trap: boolean, costCents: number, refusal: string | null }} response
 * @param {ReturnType<typeof crisisPanel>} view
 * @param {ScreenApi} api
 */
function responseCard(response, view, api) {
  const base = responseKey(response.id).replace(/_NAME$/, "");
  const box = el("div", `econ-card${response.trap ? " econ-card--muted" : ""}`);
  box.appendChild(el("div", "econ-card-title", api.loc(responseKey(response.id))));
  box.appendChild(el("div", "econ-card-sub", api.loc(`${base}_HISTORY`)));
  const lines = [
    row(api.loc("LOC_ECONOMICS_RESPONSE_NOW"), api.loc(`${base}_NOW`, ...responseArgs(response.id, view))),
    row(api.loc("LOC_ECONOMICS_RESPONSE_PRICE"), response.costCents > 0
      ? api.loc("LOC_ECONOMICS_RESPONSE_COST", formatGold(response.costCents), api.loc(`${base}_PRICE`))
      : api.loc(`${base}_PRICE`)),
    row(api.loc("LOC_ECONOMICS_RESPONSE_LEAVES"), api.loc(`${base}_LEGACY`)),
  ];
  for (const line of lines) box.appendChild(line);
  if (response.trap) box.appendChild(note(api.loc("LOC_ECONOMICS_RESPONSE_TRAP_NOTE")));
  const id = `respond:${response.id}`;
  if (isConfirming(id)) {
    box.appendChild(confirmCard({ title: api.loc(responseKey(response.id)),
      lines: [note(api.loc(`${base}_NOW`, ...responseArgs(response.id, view))), note(api.loc(`${base}_PRICE`)),
        note(api.loc(`${base}_LEGACY`))],
      confirm: api.loc("LOC_ECONOMICS_CONFIRM"), cancel: api.loc("LOC_ECONOMICS_CANCEL"), warning: response.trap,
      onConfirm: () => send(api, { kind: "respond", pid: api.me, response: response.id }), rerender: api.rerender }));
  } else {
    box.appendChild(button(api.loc("LOC_ECONOMICS_RESPONSE_TAKE"), () => { setConfirming(id); api.rerender(); },
      { disabled: response.refusal !== null, reason: response.refusal ? api.loc(reasonKey(response.refusal)) : null,
        className: response.trap ? "econ-button--warning" : "econ-button--primary" }));
  }
  return box;
}

/** @param {ScreenApi} api */
function legacySection(api) {
  const depth = api.depth();
  const block = section(api.loc("LOC_ECONOMICS_WORLD_LEGACY"), [
    row(api.loc("LOC_ECONOMICS_WORLD_LEGACY_POINTS"), ((depth.legacyBp || 0) / 10000).toFixed(2)),
    row(api.loc("LOC_ECONOMICS_WORLD_LEGACY_CUSHION"), `${((depth.cushionBp || 0) / 100).toFixed(1)}%`),
  ]);
  block.appendChild(note(api.loc("LOC_ECONOMICS_WORLD_LEGACY_NOTE")));
  return block;
}
