// econ-view-common.js - Economics: what every tab reads the same way: the tab rules for this player (which sections
// show, econ-view-tabs.js) and the "Opens next" line a tab ends on.

import { note, say } from "./econ-dom.js";
import { requestKey } from "./econ-notice-text.js";
import { viewRules } from "./econ-view-model.js";

/** @typedef {import("./econ-screen-api.js").ScreenApi} ScreenApi */

/**
 * The facts and rules for the screen's player.
 * @param {ScreenApi} api
 */
export function rulesFor(api) {
  return viewRules(api.input(), api.me, api.stageTurns?.() ?? null);
}

/**
 * Whether a section shows for this player.
 * @param {ScreenApi} api
 * @param {keyof ReturnType<typeof import("./econ-view-tabs.js").tabRules>["sections"]} id
 */
export function sectionShown(api, id) {
  return rulesFor(api).rules.sections[id] === true;
}

/**
 * The line a tab ends on: the next part and the civic or tech that opens it, read through GameInfo by the glue
 * (`stageOpener`); a stage with no node in this age opens in the next one. Null when nothing is left to open.
 * @param {ScreenApi} api
 * @param {{ stage: string, part: string } | null} next
 * @param {{ text: string, nodeKey: string | null } | null} [first] a part that comes before the stage's, already in
 *   the game's language, such as a tax card that isn't unlocked yet
 */
export function opensNext(api, next, first = null) {
  const item = first || (next ? { text: api.loc(next.part), nodeKey: api.stageOpener(next.stage) } : null);
  if (!item) return null;
  const line = item.nodeKey ? note(api.loc("LOC_ECONOMICS_OPENS_NEXT", item.text, api.loc(item.nodeKey)))
    : note(api.loc("LOC_ECONOMICS_OPENS_NEXT_AGE", item.text));
  line.classList.add("econ-opens-next");
  return line;
}

/**
 * Queues one of the player's requests for the next batch and says so beside the control that sent it (`at`, the
 * place's id). The request goes through at the start of next turn, so the line says it was sent, not that it's done;
 * a request the queue won't take says that instead.
 * @param {ScreenApi} api
 * @param {PlanRequest} request
 * @param {string} [at]
 */
export function send(api, request, at = "top") {
  const ok = api.request(request);
  say(api.loc(ok ? "LOC_ECONOMICS_SENT" : "LOC_ECONOMICS_SENT_FAILED", api.loc(requestKey(request.kind))), { at, ok });
  api.rerender();
}

/**
 * The turn labels for a series of `count` turns that ends on the counted turn `end` (a history), or starts the turn
 * after it (`ahead`, a projection), in the game's own turn numbers. A turn of an earlier age has no number of its own
 * in this age, so the labels count back from the last one shown.
 * @param {ScreenApi} api
 * @param {number | null | undefined} end the counted turn
 * @param {number} count
 * @param {{ ahead?: boolean }} [options]
 */
export function turnLabels(api, end, count, { ahead = false } = {}) {
  const base = Number.isInteger(end) ? /** @type {number} */ (end) : 0;
  const shown = api.turnLabel(base) ?? base;
  return Array.from({ length: count }, (_, k) => {
    const offset = ahead ? k + 1 : k - (count - 1);
    return api.loc("LOC_ECONOMICS_TURN_SHORT", shown + offset);
  });
}
