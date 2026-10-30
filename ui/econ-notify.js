// econ-notify.js - Economics: the one turn notification (DESIGN 9). The lines are composed from the plan at
// TurnBegin and sent at the local player's PlayerTurnActivated, in the game's language, as one notification of the
// mod's own type (data/econ-notifications.xml); the engine keeps one live notification per type and player, so every
// line of the turn goes into it. A click opens the Economics screen.

import { composeArgs, describeBatchRow, describeNotice, describeRefusal, describeRefusalMost, describeRefusalProject,
  flowKeys, worldNameKey } from "./econ-notice-text.js";
import { civName, gameTurn, loc, localId, safe } from "./econ-engine.js";
import { logDebug, logLine } from "./econ-log.js";

export const NOTIFICATION_TYPE = "NOTIFICATION_ECONOMICS_TURN";
const TITLE_KEY = "LOC_ECONOMICS_NOTIFY_TITLE";

/** @type {{ turn: number, lines: string[] } | null} */
let pending = null;
/** @type {(() => void) | null} */
let onActivate = null;

/**
 * A party's name in the game's language: civs by name, world accounts by their LOC key.
 * @param {Party} party
 */
export function nameOf(party) {
  return typeof party === "number" ? civName(party) : loc(worldNameKey(party));
}

/**
 * The lines of a plan that concern the local player, composed now so the text is in the turn's language.
 * @param {PlanOutput} plan
 * @param {number} pid
 */
export function composeLines(plan, pid) {
  const ctx = { ledger: plan.ledger, nameOf };
  /** @type {string[]} */
  const lines = [];
  for (const line of describeBatchRow(plan.batch?.civs.find((row) => row.pid === pid), flowKeys(plan.transfers, pid))) {
    lines.push(loc(line.key, ...composeArgs(line.args, (key) => loc(key))));
  }
  for (const notice of plan.notices) {
    if (notice.pid !== pid) continue;
    const line = describeNotice(notice, ctx);
    if (line) lines.push(loc(line.key, ...composeArgs(line.args, (key) => loc(key))));
  }
  for (const event of plan.events) {
    if (event.kind === "refused" && [event.pid, event.borrower, event.lender].includes(pid)) {
      lines.push(...refusalLines(event, ctx));
    }
  }
  return lines;
}

/**
 * A refusal's line, and the line after it naming what's still open (the most a lender would lend, or a
 * development loan where general investment was refused).
 * @param {LedgerEvent} event
 * @param {{ ledger: Ledger, nameOf: (party: Party) => string }} ctx
 */
function refusalLines(event, ctx) {
  const line = describeRefusal(event);
  const out = [loc(line.key, loc(line.requestKey), loc(line.reasonKey))];
  const next = describeRefusalMost(event, ctx) || describeRefusalProject(event, ctx);
  if (next) out.push(loc(next.key, ...composeArgs(next.args, (key) => loc(key))));
  return out;
}

/**
 * Keeps this turn's lines until the local player's turn is active; sends at once if it already is.
 * @param {PlanOutput} plan
 * @param {{ activeTurn: number }} state
 */
export function holdNotice(plan, state) {
  const me = localId();
  if (me < 0) return;
  const lines = composeLines(plan, me);
  if (!lines.length) { pending = null; return; }
  pending = { turn: plan.ledger.lastTurn ?? gameTurn(), lines };
  if (state.activeTurn === pending.turn) flushNotice();
}

/** Sends the held lines as the turn's notification, once. */
export function flushNotice() {
  if (!pending) return false;
  const me = localId();
  const { lines } = pending;
  pending = null;
  logLine(`notice: ${lines.join(" | ")}`);
  const sent = safe(() => {
    Game.Notifications.send({ Type: Game.getHash(NOTIFICATION_TYPE), Message: loc(TITLE_KEY),
      Summary: lines.join("[N]") }, me);
    return true;
  }, false);
  if (!sent) logDebug("notification not sent (no train)");
  return sent;
}

/** Test hook. */
export function pendingNotice() {
  return pending;
}

/**
 * A click on the mod's notification opens the screen; the train's model takes a handler per type (the same
 * registration Partisans uses). Without the model, the default handler stays.
 * @param {() => void} open
 */
export function installClickHandler(open) {
  if (onActivate) return;
  onActivate = open;
  import("/base-standard/ui/notification-train/model-notification-train.js").then((/** @type {any} */ mod) => {
    const manager = mod && mod.NotificationModel && mod.NotificationModel.manager;
    if (!manager || typeof manager.registerHandler !== "function" || typeof manager.add !== "function") return;
    const handler = {
      lookAt() { onActivate?.(); },
      activate() { onActivate?.(); return true; },
      add(/** @type {unknown} */ id) {
        const n = Game.Notifications.find(id);
        return !!n && manager.add(n.Type, n.GroupType, id) != null;
      },
      dismiss(/** @type {unknown} */ id) { if (typeof manager.onDismiss === "function") manager.onDismiss(id); },
    };
    manager.registerHandler(NOTIFICATION_TYPE, handler);
    logDebug("notification click handler registered");
  }).catch((error) => logDebug(`notification click handler not installed: ${error}`));
}
