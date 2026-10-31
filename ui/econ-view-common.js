// econ-view-common.js - Economics: what every tab reads the same way: the tab rules for this player (which sections
// show, econ-view-tabs.js) and the "Opens next" line a tab ends on.

import { note } from "./econ-dom.js";
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
