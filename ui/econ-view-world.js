// econ-view-world.js - Economics: the World tab (DESIGN 4.8, 4.11, 4.16, 9): the world's economic index and phase
// beside the player's own, what moved it lately, its last 30 turns, inflation and its cause, world debt against the
// Gold the civilizations hold, and the player's legacy from old buildings with the slump cushion it gives.

import { note, pill, row, section } from "./econ-dom.js";
import { formatGold, formatRate } from "./econ-format.js";
import { cycleEventKey, phaseKey } from "./econ-notice-text.js";
import { sparkline } from "./econ-view-markets.js";
import { worldView } from "./econ-view-macro.js";

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
  host.appendChild(nowSection(view, api));
  if (view.cycleOn) {
    host.appendChild(eventsSection(view, api));
    if (view.history.length > 1) {
      host.appendChild(section(api.loc("LOC_ECONOMICS_WORLD_HISTORY", view.history.length),
        [sparkline(view.history, formatIndex)]));
    }
  }
  host.appendChild(inflationSection(view, api));
  host.appendChild(debtSection(view, api));
  host.appendChild(legacySection(api));
}

/**
 * @param {ReturnType<typeof worldView>} view
 * @param {ScreenApi} api
 */
function nowSection(view, api) {
  const block = section(api.loc("LOC_ECONOMICS_WORLD_NOW"));
  if (!view.cycleOn) { block.appendChild(note(api.loc("LOC_ECONOMICS_WORLD_CYCLE_OFF"))); return block; }
  block.appendChild(row(api.loc("LOC_ECONOMICS_WORLD_INDEX"), formatIndex(view.e)));
  block.appendChild(row(api.loc("LOC_ECONOMICS_WORLD_PHASE"), api.loc(phaseKey(view.worldPhase))));
  if (view.mine) {
    block.appendChild(row(api.loc("LOC_ECONOMICS_WORLD_YOURS"), api.loc("LOC_ECONOMICS_WORLD_YOURS_ROW",
      formatIndex(view.mine.index), api.loc(phaseKey(view.mine.phase)))));
  }
  if (view.panic) {
    const turn = view.panicUntil === null ? "" : api.turnLabel(view.panicUntil) ?? view.panicUntil;
    block.appendChild(pill(api.loc("LOC_ECONOMICS_WORLD_PANIC", turn), true));
  }
  block.appendChild(note(api.loc("LOC_ECONOMICS_WORLD_NOTE")));
  return block;
}

/**
 * @param {ReturnType<typeof worldView>} view
 * @param {ScreenApi} api
 */
function eventsSection(view, api) {
  const block = section(api.loc("LOC_ECONOMICS_WORLD_EVENTS"));
  if (!view.events.length) block.appendChild(note(api.loc("LOC_ECONOMICS_WORLD_EVENTS_NONE")));
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
  if (!inflation.on) { block.appendChild(note(api.loc("LOC_ECONOMICS_WORLD_INFLATION_OFF"))); return block; }
  if (!(inflation.bondCents > 0)) { block.appendChild(note(api.loc("LOC_ECONOMICS_WORLD_INFLATION_NONE"))); return block; }
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
    row(api.loc("LOC_ECONOMICS_WORLD_DEBT_LEVERAGE"), (view.debt.leverPct / 100).toFixed(2),
      view.debt.leverPct > 150 ? "econ-negative" : ""),
  ]);
  block.appendChild(note(api.loc("LOC_ECONOMICS_WORLD_DEBT_NOTE")));
  return block;
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
