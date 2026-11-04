// econ-view-crisis.js - Economics: the Crisis section of the World tab and the legacy list of the Fiscal tab
// (DESIGN 4.11b, 4.11c). The crisis comes first: its name, one line on what it is, when it began and what brought
// it. Then what the player is doing about it, each with its end button, or a line on what happens if they do
// nothing. Then the choices open to them, each a card with the age's history line and three facts (what it does
// now, its price, what it leaves) and a button that opens a confirmation restating the price and the legacy. A
// price that costs a relationship, grievances or reputation reads in the loss colour; a trap in the caution colour.
// The Fiscal list: each legacy with its line and a pill for how long it lasts.

import { amount, button, confirmCard, el, isConfirming, note, pill, section, setConfirming } from "./econ-dom.js";
import { formatGold } from "./econ-format.js";
import { crisisKey, cycleEventKey, joinList, legacyKey, pathKey, policyKey, reasonKey, responseKey } from "./econ-notice-text.js";
import { crisisPanel } from "./econ-view-model.js";
import { RESPONSE_RULES, affinityOf, responseById } from "./econ-crisis-catalog.js";
import { POLICY_RULES, policyById } from "./econ-policy-catalog.js";
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
  if (!view.on || (!view.crises.length && !view.standing.length && !view.paths.running.length)) return null;
  const block = section(api.loc("LOC_ECONOMICS_CRISIS_SECTION"), [], { className: "econ-crisis" });
  for (const crisis of view.crises) block.appendChild(crisisCard(crisis, api));
  for (const line of hardTimesLines(api)) block.appendChild(note(line));
  pathsParts(block, view, api);
  standingParts(block, view, api);
  choiceParts(block, view, api);
  return block;
}

/**
 * The player's hard times for Partisans: that the least happy settlements are turning toward a rising, and the
 * Austerity strain while there is any. None without Partisans or while times are good.
 * @param {ScreenApi} api
 */
function hardTimesLines(api) {
  const ht = api.partisans?.() ? api.hardTimes?.() : null;
  if (!ht || !(ht.depression > 0 || ht.austerityStrain > 0 || ht.arrearsPoints > 0)) return [];
  const lines = [api.loc("LOC_ECONOMICS_PATHS_HARD_TIMES")];
  if (ht.austerityStrain > 0) lines.push(api.loc("LOC_ECONOMICS_PATHS_HARD_TIMES_STRAIN", ht.austerityStrain));
  return lines;
}

/**
 * The crisis paths: the running card first, then the government's own cards while a crisis is open.
 * @param {HTMLElement} block
 * @param {CrisisView} view
 * @param {ScreenApi} api
 */
function pathsParts(block, view, api) {
  const paths = view.paths;
  if (paths.running.length) {
    block.appendChild(subtitle(api.loc("LOC_ECONOMICS_PATHS_DOING")));
    for (const row of paths.running) block.appendChild(runningPolicyCard(row, api));
  }
  const own = view.crises.length ? paths.cards.filter((card) => card.refusal !== "running") : [];
  if (!own.length) return;
  block.appendChild(subtitle(api.loc("LOC_ECONOMICS_PATHS_OWN")));
  const owner = api.loc(`LOC_ECONOMICS_PATHS_OWNER_${own[0].owner}`);
  block.appendChild(note(api.loc("LOC_ECONOMICS_PATHS_OWN_SUB", owner)));
  const list = el("div", "econ-choices");
  for (const card of own) list.appendChild(policyCard(card, paths, api));
  block.appendChild(list);
}

/**
 * What the player is doing with the shared responses, or what doing nothing means.
 * @param {HTMLElement} block
 * @param {CrisisView} view
 * @param {ScreenApi} api
 */
function standingParts(block, view, api) {
  if (view.standing.length) {
    block.appendChild(subtitle(api.loc("LOC_ECONOMICS_CRISIS_DOING")));
    for (const standing of view.standing) block.appendChild(standingCard(standing, view, api));
  } else if (!view.paths.running.length) {
    for (const crisis of view.crises) block.appendChild(note(api.loc(aloneKey(crisis.kind))));
  }
}

/**
 * The shared choices, each with its affinity tag for the player's system.
 * @param {HTMLElement} block
 * @param {CrisisView} view
 * @param {ScreenApi} api
 */
function choiceParts(block, view, api) {
  const choices = view.crises.length ? view.responses.filter((response) => response.refusal !== "running") : [];
  if (!choices.length) return;
  block.appendChild(subtitle(api.loc("LOC_ECONOMICS_CRISIS_CAN_DO")));
  const list = el("div", "econ-choices");
  const input = api.input();
  const system = input.options?.systems === false ? "mixed" : String(input.macro?.systems?.[String(api.me)]?.system ?? "mixed");
  for (const response of choices) list.appendChild(responseCard(response, view, api, system));
  block.appendChild(list);
}

/** @param {string} text */
const subtitle = (text) => el("div", "econ-section-subtitle font-body", text);

/** @typedef {CrisisView["paths"]} PathsView */
/** @typedef {PathsView["cards"][number]} PolicyCardRow */
/** @typedef {PathsView["running"][number]} RunningRow */

/** A card's key stem: its _NAME key without the suffix. @param {string} id */
const policyBase = (id) => policyKey(id).replace(/_NAME$/, "");

/** The tier pill, with its tooltip. @param {string} tier @param {ScreenApi} api */
function tierPill(tier, api) {
  const key = `LOC_ECONOMICS_PATHS_TIER_${tier.toUpperCase()}`;
  const node = pill(api.loc(key), tier === "gamble" ? "caution" : false);
  const arrears = tier === "programme" ? ` ${api.loc("LOC_ECONOMICS_PATHS_TIER_PROGRAMME_ARREARS")}` : "";
  node.setAttribute("data-tooltip-content", `${api.loc(`${key}_TIP`)}${arrears}`);
  return node;
}

/**
 * A card of the player's own government or ideology: tier, history line, what it does now, its price in Influence,
 * Gold and words, and for a Programme its goal and the three ways it can end; then the Take button with its
 * reason, or the confirmation.
 * @param {PolicyCardRow} card
 * @param {PathsView} paths
 * @param {ScreenApi} api
 */
function policyCard(card, paths, api) {
  const base = policyBase(card.id);
  const box = el("div", `econ-card econ-choice econ-policy econ-policy--${card.tier}`);
  const head = el("div", "econ-card-head");
  head.appendChild(el("div", "econ-card-title", api.loc(policyKey(card.id))));
  head.appendChild(tierPill(card.tier, api));
  box.appendChild(head);
  box.appendChild(el("div", "econ-card-sub", api.loc(`${base}_HISTORY`)));
  box.appendChild(strip(policyFacts(card, api)));
  const steps = card.path ? paths.drift[card.path] ?? 0 : 0;
  if (steps !== 0) {
    box.appendChild(note(api.loc(steps < 0 ? "LOC_ECONOMICS_PATHS_DRIFT_CHEAPER" : "LOC_ECONOMICS_PATHS_DRIFT_DEARER",
      Math.abs(steps) * 5)));
  }
  if (card.id === "foreign-adventure") box.appendChild(note(api.loc("LOC_ECONOMICS_POLICY_FOREIGN_ADVENTURE_WAR")));
  box.appendChild(policyTakeControl(card, api));
  return box;
}

/** @param {PolicyCardRow} card @param {ScreenApi} api */
function policyFacts(card, api) {
  const base = policyBase(card.id);
  const price = el("div", "econ-fact-text");
  price.appendChild(el("div", "", api.loc("LOC_ECONOMICS_PATHS_PRICE_INFLUENCE", card.price)));
  if (card.tier === "programme") {
    price.appendChild(el("div", "", api.loc("LOC_ECONOMICS_PATHS_PRICE_UPKEEP", card.perTurn, formatGold(card.adminCents))));
    if (card.id !== "bank-regulation") price.appendChild(el("div", "", api.loc("LOC_ECONOMICS_PATHS_PRICE_RATE")));
  }
  price.appendChild(el("div", "econ-negative", api.loc(`${base}_PRICE`)));
  const facts = [fact(api.loc("LOC_ECONOMICS_RESPONSE_NOW"), api.loc(`${base}_NOW`)),
    fact(api.loc("LOC_ECONOMICS_RESPONSE_PRICE"), price)];
  if (card.tier !== "programme") {
    facts.push(fact(api.loc("LOC_ECONOMICS_RESPONSE_LEAVES"), api.loc(`${base}_LEAVES`)));
    return facts;
  }
  facts.push(fact(api.loc("LOC_ECONOMICS_PATHS_GOAL"), api.loc(`${base}_GOAL`)),
    fact(api.loc("LOC_ECONOMICS_PATHS_IF_MET"), api.loc(`${base}_EARNED`)),
    fact(api.loc("LOC_ECONOMICS_PATHS_IF_MISSED"), api.loc(`${base}_COMPROMISED`)),
    fact(api.loc("LOC_ECONOMICS_PATHS_IF_ENDED"), api.loc(abandonedKey(card.id))));
  return facts;
}

/**
 * Why a card can't be taken; a shortfall of Influence names both figures.
 * @param {PolicyCardRow} card @param {ScreenApi} api
 */
function refusalText(card, api) {
  if (!card.refusal) return null;
  if (card.refusal === "influence" && card.stock !== null) {
    return api.loc("LOC_ECONOMICS_REASON_INFLUENCE_NEED", card.price, Math.max(0, Math.floor(card.stock)));
  }
  return api.loc(reasonKey(card.refusal));
}

/** @param {PolicyCardRow} card @param {ScreenApi} api */
function policyTakeControl(card, api) {
  const id = `policy:${card.id}`;
  if (!isConfirming(id)) {
    return button(api.loc("LOC_ECONOMICS_PATHS_TAKE"), () => { setConfirming(id); api.rerender(); },
      { disabled: card.refusal !== null, reason: refusalText(card, api),
        className: card.tier === "gamble" ? "econ-button--warning" : "econ-button--primary" });
  }
  return confirmCard({ title: api.loc("LOC_ECONOMICS_PATHS_TAKE_TITLE", api.loc(policyKey(card.id))),
    lines: [strip(policyFacts(card, api))], confirm: api.loc("LOC_ECONOMICS_CONFIRM"),
    cancel: api.loc("LOC_ECONOMICS_CANCEL"), warning: card.tier === "gamble",
    onConfirm: () => send(api, { kind: "policy", pid: api.me, policy: card.id }), rerender: api.rerender });
}

/** The "if ended early" line's key; Diversionary war's also says its war goes on. @param {string} id */
const abandonedKey = (id) => `${policyBase(id)}_ABANDONED${id === "foreign-adventure" ? "_WAR" : ""}`;

/**
 * A running Programme's arrears, read from its ledger row: the turn it's on, what this turn cost, the next turn's
 * charge, the lapses, and the Influence it needs to pay again. Null while it's paid up.
 * @param {RunningRow} row
 * @param {ScreenApi} api
 */
function arrearsOf(row, api) {
  const ledger = api.input()?.ledger;
  const found = (ledger?.policies || []).find((r) => r.pid === api.me && r.card === row.id);
  if (!found || !((found.arrearsRun || 0) > 0)) return null;
  const c = found.c || {};
  const n = (/** @type {unknown} */ v) => Number(v) || 0;
  return { run: found.arrearsRun, points: n(found.arrearsPoints), cents: n(c.lastArrearsCents),
    support: n(c.lastArrearsSupport), nextCents: n(c.nextArrearsCents),
    influence: n(policyById(row.id)?.perTurnInfluence) };
}

/** @param {NonNullable<ReturnType<typeof arrearsOf>>} behind @param {ScreenApi} api */
function arrearsLines(behind, api) {
  const lines = [note(api.loc("LOC_ECONOMICS_PATHS_ARREARS_NOW", behind.run, POLICY_RULES.arrearsGrace,
    formatGold(behind.cents), behind.support, formatGold(behind.nextCents), behind.points,
    POLICY_RULES.arrearsPointsMax))];
  if (behind.influence > 0) lines.push(note(api.loc("LOC_ECONOMICS_PATHS_ARREARS_INFLUENCE", behind.influence)));
  return lines;
}

/**
 * The running card: tier and state, the turns until it can settle or "settles when the crisis ends", for a
 * Programme the three milestones and its goal's parts, the war it owes or the upkeep it has borrowed, and End it.
 * @param {RunningRow} row
 * @param {ScreenApi} api
 */
function runningPolicyCard(row, api) {
  const box = el("div", "econ-card econ-card--active econ-policy-running");
  const head = el("div", "econ-card-head");
  head.appendChild(el("div", "econ-card-title", api.loc(policyKey(row.id))));
  head.appendChild(tierPill(row.tier, api));
  const state = row.tier === "programme" ? (row.state === "sustained" && !row.crisisOpen ? "RESOLVING"
    : row.state.toUpperCase()) : "ACTIVE";
  head.appendChild(pill(api.loc(`LOC_ECONOMICS_PATHS_STATE_${state}`), false));
  box.appendChild(head);
  box.appendChild(el("div", "econ-card-sub", api.loc(`${policyBase(row.id)}_NOW`)));
  if (row.tier === "programme") programmeLines(box, row, api);
  else if (row.left !== null) box.appendChild(note(api.loc("LOC_ECONOMICS_CRISIS_TURNS_LEFT", row.left)));
  box.appendChild(policyEndControl(row, api));
  return box;
}

/** @param {HTMLElement} box @param {RunningRow} row @param {ScreenApi} api */
function programmeLines(box, row, api) {
  const pips = el("div", "econ-path-pips");
  const lit = [true, row.state === "sustained", row.met];
  ["COMMIT", "SUSTAIN", "OBJECTIVE"].forEach((pip, i) => {
    pips.appendChild(pill(api.loc(`LOC_ECONOMICS_PATHS_PIP_${pip}`), lit[i] ? false : "muted"));
  });
  box.appendChild(pips);
  if (row.path) box.appendChild(el("div", "econ-card-sub", api.loc(pathKey(row.path))));
  box.appendChild(note(row.minLeft > 0 ? api.loc("LOC_ECONOMICS_PATHS_MIN_LEFT", row.minLeft)
    : api.loc("LOC_ECONOMICS_PATHS_WAITS_CRISIS")));
  const parts = el("div", "econ-path-parts");
  for (const part of row.parts) {
    parts.appendChild(el("div", part.done ? "econ-positive" : "econ-muted", api.loc(part.done
      ? "LOC_ECONOMICS_PATHS_PART_DONE" : "LOC_ECONOMICS_PATHS_PART_OPEN",
    api.loc(`LOC_ECONOMICS_PART_${part.id.toUpperCase().replace(/-/g, "_")}`))));
  }
  box.appendChild(parts);
  const behind = arrearsOf(row, api);
  if (behind) for (const line of arrearsLines(behind, api)) box.appendChild(line);
  for (const line of programmeNotes(row, api)) box.appendChild(note(line));
}

/**
 * The notes under a running Programme: the war it owes, the war it missed, the upkeep it has borrowed, the
 * production it has added, and that the outcome is provisional.
 * @param {RunningRow} row
 * @param {ScreenApi} api
 */
function programmeNotes(row, api) {
  const lines = [];
  const warDone = row.parts.some((p) => p.id === "war-in-time" && p.done);
  if (row.warBy !== null && row.warBy > 0 && !warDone) lines.push(api.loc("LOC_ECONOMICS_PATHS_WAR_DUE", row.warBy));
  if (row.unmet) lines.push(api.loc("LOC_ECONOMICS_PATHS_WAR_MISSED"));
  if (row.debtCents > 0) lines.push(api.loc("LOC_ECONOMICS_PATHS_DEBT", formatGold(row.debtCents)));
  if (row.added > 0) lines.push(api.loc("LOC_ECONOMICS_PATHS_ADDED", Math.round(row.added)));
  lines.push(api.loc("LOC_ECONOMICS_PATHS_PROVISIONAL"));
  return lines;
}

/** @param {RunningRow} row @param {ScreenApi} api */
function policyEndControl(row, api) {
  const id = `policy-end:${row.id}`;
  if (!isConfirming(id)) {
    return button(api.loc("LOC_ECONOMICS_CRISIS_END_BUTTON"), () => { setConfirming(id); api.rerender(); },
      { className: "econ-button--quiet econ-button--small" });
  }
  const programme = row.tier === "programme";
  const behind = programme ? arrearsOf(row, api) : null;
  const next = behind ? [note(api.loc("LOC_ECONOMICS_PATHS_ARREARS_END_NEXT", formatGold(behind.nextCents)))] : [];
  return confirmCard({ title: api.loc("LOC_ECONOMICS_PATHS_END_TITLE", api.loc(policyKey(row.id))),
    lines: [...next, note(api.loc(programme ? abandonedKey(row.id) : "LOC_ECONOMICS_CRISIS_END_NOTE"))],
    confirm: api.loc("LOC_ECONOMICS_CONFIRM"), cancel: api.loc("LOC_ECONOMICS_CANCEL"), warning: programme,
    onConfirm: () => send(api, { kind: "policy", pid: api.me, policy: row.id, cancel: true }), rerender: api.rerender });
}

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
  if (standing.id === "austerity" && api.partisans?.()) box.appendChild(note(api.loc("LOC_ECONOMICS_RESPONSE_AUSTERITY_PARTISANS")));
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
 * @param {string} [system] the player's economic system, for the affinity tag
 */
function responseCard(response, view, api, system = "mixed") {
  const base = responseBase(response.id);
  const box = el("div", `econ-card econ-choice${response.trap ? " econ-card--muted econ-choice--trap" : ""}`);
  const head = el("div", "econ-card-head");
  head.appendChild(el("div", "econ-card-title", api.loc(responseKey(response.id))));
  head.appendChild(pill(runsLabel(response, api), response.trap ? "caution" : false));
  box.appendChild(head);
  // The affinity tag sits on its own line under the title, so a long name and two pills don't crowd the head.
  const tag = affinityTag(response.id, system, api);
  if (tag) box.appendChild(el("div", "econ-tag-line")).appendChild(tag);
  box.appendChild(el("div", "econ-card-sub", api.loc(`${base}_HISTORY`)));
  box.appendChild(strip([
    fact(api.loc("LOC_ECONOMICS_RESPONSE_NOW"), api.loc(`${base}_NOW`, ...responseArgs(response.id, view))),
    priceFact(response, api),
    fact(api.loc("LOC_ECONOMICS_RESPONSE_LEAVES"), api.loc(`${base}_LEGACY`)),
  ]));
  if (response.trap) box.appendChild(note(api.loc("LOC_ECONOMICS_RESPONSE_TRAP_NOTE")));
  if (response.id === "austerity" && api.partisans?.()) box.appendChild(note(api.loc("LOC_ECONOMICS_RESPONSE_AUSTERITY_PARTISANS")));
  box.appendChild(takeControl(response, api));
  return box;
}

/**
 * The "Institutional advantage" or "Political opposition" pill for a shared response and the player's system, or null.
 * @param {string} id
 * @param {string} system
 * @param {ScreenApi} api
 */
function affinityTag(id, system, api) {
  const spec = responseById(id);
  const tag = spec ? affinityOf(spec, system) : null;
  if (!tag) return null;
  const key = `LOC_ECONOMICS_PATHS_TAG_${tag.toUpperCase()}`;
  const node = pill(api.loc(key), tag === "opposition" ? "caution" : false);
  node.classList.add("econ-tag");
  node.setAttribute("data-tooltip-content", api.loc(`${key}_TIP`));
  return node;
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
  const shaped = Object.entries(view.paths.drift).filter(([, steps]) => steps !== 0);
  if (!view.on || (!view.legacies.length && !shaped.length)) return null;
  const block = section(api.loc("LOC_ECONOMICS_FISCAL_LEGACIES"), [],
    { subtitle: api.loc("LOC_ECONOMICS_FISCAL_LEGACIES_SUB") });
  const list = el("div", "econ-legacies");
  for (const legacy of view.legacies) list.appendChild(legacyRow(legacy, api));
  block.appendChild(list);
  if (shaped.length) block.appendChild(shapedPart(shaped, api));
  return block;
}

/**
 * How the player's crises have shaped it (institutional drift): each path's price against the start, cheaper where
 * it built that institution, dearer where it didn't.
 * @param {[string, number][]} shaped
 * @param {ScreenApi} api
 */
function shapedPart(shaped, api) {
  const box = el("div", "econ-shaped");
  box.appendChild(subtitle(api.loc("LOC_ECONOMICS_PATHS_SHAPED")));
  box.appendChild(note(api.loc("LOC_ECONOMICS_PATHS_SHAPED_SUB")));
  const built = shaped.filter(([, steps]) => steps < 0);
  const others = shaped.filter(([, steps]) => steps > 0);
  for (const [path, steps] of built) box.appendChild(shapedLine(api.loc(pathKey(path)), steps * 5));
  // The paths the civ didn't build all drift the same way, so they share one line.
  if (others.length) {
    const most = Math.max(...others.map(([, steps]) => steps));
    box.appendChild(shapedLine(api.loc("LOC_ECONOMICS_PATHS_SHAPED_OTHERS"), most * 5));
  }
  return box;
}

/** @param {string} name @param {number} pct */
function shapedLine(name, pct) {
  const line = el("div", "econ-legacy");
  line.appendChild(el("div", "econ-legacy-name", name));
  line.appendChild(pill(`${pct > 0 ? "+" : ""}${pct}%`, pct > 0 ? "caution" : false));
  return line;
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
