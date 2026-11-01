// econ-view-crisis.js - Economics: the Crisis section of the World tab and the legacy list of the Fiscal tab
// (DESIGN 4.11b, 4.11c). The crisis comes first: its name, one line on what it is, when it began and what brought
// it. Then what the player is doing about it, each with its end button, or a line on what happens if they do
// nothing. Then the choices open to them, each a card with the age's history line and three facts (what it does
// now, its price, what it leaves) and a button that opens a confirmation restating the price and the legacy. A
// price that costs a relationship, grievances or reputation reads in the loss colour; a trap in the caution colour.
// The Fiscal list: each legacy with its line and a pill for how long it lasts.

import { amount, button, confirmCard, el, isConfirming, note, pill, section, setConfirming } from "./econ-dom.js";
import { formatGold } from "./econ-format.js";
import { crisisKey, cycleEventKey, joinList, legacyKey, reasonKey, responseKey } from "./econ-notice-text.js";
import { crisisPanel } from "./econ-view-model.js";
import { RESPONSE_RULES } from "./econ-crisis-catalog.js";
import { send } from "./econ-view-common.js";

/** @typedef {import("./econ-screen-api.js").ScreenApi} ScreenApi */
/** @typedef {ReturnType<typeof crisisPanel>} CrisisView */
/** @typedef {CrisisView["crises"][number]} CrisisRow */
/** @typedef {CrisisView["responses"][number]} ResponseRow */
/** @typedef {CrisisView["standing"][number]} StandingRow */
/** @typedef {CrisisView["legacies"][number]} LegacyRow */

/** A response's key stem: its _NAME key without the suffix. @param {string} id */
const responseBase = (id) => responseKey(id).replace(/_NAME$/, "");

/**
 * The Crisis section: each open crisis, what stands against it or what doing nothing means, and the choices. Null
 * when nothing is open and nothing stands.
 * @param {ScreenApi} api
 */
export function crisisSection(api) {
  const view = crisisPanel(api.input(), api.me);
  if (!view.on || (!view.crises.length && !view.standing.length)) return null;
  const block = section(api.loc("LOC_ECONOMICS_CRISIS_SECTION"), [], { className: "econ-crisis" });
  for (const crisis of view.crises) block.appendChild(crisisCard(crisis, api));
  if (view.standing.length) {
    block.appendChild(subtitle(api.loc("LOC_ECONOMICS_CRISIS_DOING")));
    for (const standing of view.standing) block.appendChild(standingCard(standing, view, api));
  } else {
    for (const crisis of view.crises) block.appendChild(note(api.loc(aloneKey(crisis.kind))));
  }
  const choices = view.responses.filter((response) => response.refusal !== "running");
  if (choices.length) {
    block.appendChild(subtitle(api.loc("LOC_ECONOMICS_CRISIS_CAN_DO")));
    const list = el("div", "econ-choices");
    for (const response of choices) list.appendChild(responseCard(response, view, api));
    block.appendChild(list);
  }
  return block;
}

/** @param {string} text */
const subtitle = (text) => el("div", "econ-section-subtitle font-body", text);

/**
 * What a crisis does when nothing is taken against it: the Depression's own note, or the kind's line on when it
 * ends by itself.
 * @param {string} kind
 */
function aloneKey(kind) {
  return kind === "depression" ? "LOC_ECONOMICS_CRISIS_NOTHING_NOTE"
    : `${crisisKey(kind).replace(/_NAME$/, "")}_ALONE`;
}

/**
 * @param {CrisisRow} crisis
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
 * A standing response: its name, how long it has left, what it's doing, what it will leave, and the end button. A
 * bank run stands on its own and can't be ended.
 * @param {StandingRow} standing
 * @param {CrisisView} view
 * @param {ScreenApi} api
 */
function standingCard(standing, view, api) {
  const base = responseBase(standing.id);
  const box = el("div", "econ-card econ-card--active");
  const head = el("div", "econ-card-head");
  head.appendChild(el("div", "econ-card-title", api.loc(responseKey(standing.id))));
  head.appendChild(pill(standing.left === null ? api.loc("LOC_ECONOMICS_CRISIS_UNTIL_END")
    : api.loc("LOC_ECONOMICS_CRISIS_TURNS_LEFT", standing.left), false));
  box.appendChild(head);
  box.appendChild(el("div", "econ-card-sub", api.loc(`${base}_NOW`, ...responseArgs(standing.id, view))));
  if (standing.id === "bank-run") return box;
  box.appendChild(strip([fact(api.loc("LOC_ECONOMICS_RESPONSE_LEAVES"), api.loc(`${base}_LEGACY`))]));
  box.appendChild(endControl(standing, api));
  return box;
}

/**
 * The end button, or the confirmation it opens: relief ended early is remembered, so its confirmation warns.
 * @param {StandingRow} standing
 * @param {ScreenApi} api
 */
function endControl(standing, api) {
  const id = `respond-end:${standing.id}`;
  if (!isConfirming(id)) {
    return button(api.loc("LOC_ECONOMICS_CRISIS_END_BUTTON"), () => { setConfirming(id); api.rerender(); },
      { className: "econ-button--quiet econ-button--small" });
  }
  const relief = standing.id === "relief";
  return confirmCard({ title: api.loc("LOC_ECONOMICS_CRISIS_END_TITLE", api.loc(responseKey(standing.id))),
    lines: [note(api.loc(relief ? "LOC_ECONOMICS_CRISIS_END_RELIEF" : "LOC_ECONOMICS_CRISIS_END_NOTE"))],
    confirm: api.loc("LOC_ECONOMICS_CONFIRM"), cancel: api.loc("LOC_ECONOMICS_CANCEL"), warning: relief,
    onConfirm: () => send(api, { kind: "respond", pid: api.me, response: standing.id, cancel: true }),
    rerender: api.rerender });
}

/**
 * The figures a response's lines compose: public works' Gold a settlement in this age.
 * @param {string} id
 * @param {CrisisView} view
 */
function responseArgs(id, view) {
  if (id !== "public-works") return [];
  const perSettlement = RESPONSE_RULES.publicWorks.goldPerSettlement;
  return [formatGold(perSettlement[/** @type {"AQ" | "EX" | "MO"} */ (view.age)] ?? perSettlement.AQ)];
}

/**
 * A choice: its name and how long it runs, the age's history line, the three facts, the trap note where it's one,
 * and the button or the confirmation it opened.
 * @param {ResponseRow} response
 * @param {CrisisView} view
 * @param {ScreenApi} api
 */
function responseCard(response, view, api) {
  const base = responseBase(response.id);
  const box = el("div", `econ-card econ-choice${response.trap ? " econ-card--muted econ-choice--trap" : ""}`);
  const head = el("div", "econ-card-head");
  head.appendChild(el("div", "econ-card-title", api.loc(responseKey(response.id))));
  head.appendChild(pill(runsLabel(response, api), response.trap ? "caution" : false));
  box.appendChild(head);
  box.appendChild(el("div", "econ-card-sub", api.loc(`${base}_HISTORY`)));
  box.appendChild(strip([
    fact(api.loc("LOC_ECONOMICS_RESPONSE_NOW"), api.loc(`${base}_NOW`, ...responseArgs(response.id, view))),
    priceFact(response, api),
    fact(api.loc("LOC_ECONOMICS_RESPONSE_LEAVES"), api.loc(`${base}_LEGACY`)),
  ]));
  if (response.trap) box.appendChild(note(api.loc("LOC_ECONOMICS_RESPONSE_TRAP_NOTE")));
  box.appendChild(takeControl(response, api));
  return box;
}

/**
 * How long a response runs once taken, for its pill: until the crisis ends, a number of turns, or a one-off act.
 * @param {ResponseRow} response
 * @param {ScreenApi} api
 */
function runsLabel(response, api) {
  if (response.runs === "crisis") return api.loc("LOC_ECONOMICS_RESPONSE_RUNS_CRISIS");
  if (typeof response.runs === "number" && response.runs > 0) {
    return api.loc("LOC_ECONOMICS_RESPONSE_RUNS_TURNS", response.runs);
  }
  return api.loc("LOC_ECONOMICS_RESPONSE_RUNS_ONCE");
}

/**
 * The Choose button, disabled with its reason where the response can't be taken, or the confirmation it opened,
 * which restates the price and the legacy.
 * @param {ResponseRow} response
 * @param {ScreenApi} api
 */
function takeControl(response, api) {
  const id = `respond:${response.id}`;
  if (!isConfirming(id)) {
    return button(api.loc("LOC_ECONOMICS_RESPONSE_TAKE"), () => { setConfirming(id); api.rerender(); },
      { disabled: response.refusal !== null, reason: response.refusal ? api.loc(reasonKey(response.refusal)) : null,
        className: response.trap ? "econ-button--warning" : "econ-button--primary" });
  }
  const base = responseBase(response.id);
  return confirmCard({ title: api.loc("LOC_ECONOMICS_RESPONSE_TAKE_TITLE", api.loc(responseKey(response.id))),
    lines: [strip([priceFact(response, api),
      fact(api.loc("LOC_ECONOMICS_RESPONSE_LEAVES"), api.loc(`${base}_LEGACY`))])],
    confirm: api.loc("LOC_ECONOMICS_CONFIRM"), cancel: api.loc("LOC_ECONOMICS_CANCEL"), warning: response.trap,
    onConfirm: () => send(api, { kind: "respond", pid: api.me, response: response.id }), rerender: api.rerender });
}

/**
 * The price line: the Gold it takes now as an amount, then the rest of the price in words. A price that costs a
 * relationship, grievances or reputation reads in the loss colour; a trap's in the caution colour.
 * @param {ResponseRow} response
 * @param {ScreenApi} api
 */
function priceFact(response, api) {
  const tone = response.trap ? "econ-caution" : priceBites(response.id) ? "econ-negative" : "";
  const cell = el("div", "econ-fact-text");
  if (response.costCents > 0) {
    cell.appendChild(amount(formatGold(response.costCents), { unit: api.loc("LOC_ECONOMICS_RESPONSE_PAID_NOW") }));
  }
  cell.appendChild(el("span", tone, api.loc(`${responseBase(response.id)}_PRICE`)));
  return fact(api.loc("LOC_ECONOMICS_RESPONSE_PRICE"), cell);
}

/**
 * Whether a response's price touches a relationship, grievances or the credit reputation, read from its figures in
 * the catalog.
 * @param {string} id
 */
function priceBites(id) {
  const key = id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  const rules = /** @type {Record<string, Partial<Record<string, number>>>} */ (
    /** @type {unknown} */ (RESPONSE_RULES))[key] || {};
  return (rules.lenderLevel ?? 0) < 0 || (rules.repPoints ?? 0) < 0 || (rules.grievance ?? 0) > 0
    || (rules.importerLevel ?? 0) < 0;
}

/** A card's fact strip: one line per fact. @param {HTMLElement[]} lines */
function strip(lines) {
  const node = el("div", "econ-strip");
  for (const line of lines) node.appendChild(line);
  return node;
}

/**
 * One fact: a quiet label in its own column, the fact beside it.
 * @param {string} label
 * @param {string | HTMLElement} text
 */
function fact(label, text) {
  const line = el("div", "econ-fact");
  line.appendChild(el("div", "econ-fact-label", label));
  line.appendChild(typeof text === "string" ? el("div", "econ-fact-text", text) : text);
  return line;
}

/**
 * What the player's crisis responses left (DESIGN 4.11c): each legacy with what it does and how long it lasts;
 * null while there's none.
 * @param {ScreenApi} api
 */
export function legaciesSection(api) {
  const view = crisisPanel(api.input(), api.me);
  if (!view.on || !view.legacies.length) return null;
  const block = section(api.loc("LOC_ECONOMICS_FISCAL_LEGACIES"), [],
    { subtitle: api.loc("LOC_ECONOMICS_FISCAL_LEGACIES_SUB") });
  const list = el("div", "econ-legacies");
  for (const legacy of view.legacies) list.appendChild(legacyRow(legacy, api));
  block.appendChild(list);
  return block;
}

/**
 * @param {LegacyRow} legacy
 * @param {ScreenApi} api
 */
function legacyRow(legacy, api) {
  const base = legacyKey(legacy.id).replace(/_NAME$/, "");
  const line = el("div", "econ-legacy");
  const text = el("div", "econ-legacy-text");
  text.appendChild(el("div", "econ-legacy-name", api.loc(legacyKey(legacy.id))));
  text.appendChild(el("div", "econ-legacy-line", api.loc(`${base}_LINE`)));
  if (legacy.world) text.appendChild(el("div", "econ-legacy-world", api.loc("LOC_ECONOMICS_LEGACY_EVERYONE")));
  line.appendChild(text);
  const lasts = legacy.left !== null ? api.loc("LOC_ECONOMICS_CRISIS_TURNS_LEFT", legacy.left)
    : legacy.nextAge ? api.loc("LOC_ECONOMICS_LEGACY_NEXT_AGE") : api.loc("LOC_ECONOMICS_LEGACY_FOR_AGE");
  line.appendChild(pill(lasts, false));
  return line;
}
