// econ-fiscal.js - Economics: the player's door to the tax cards (DESIGN 4.7). The cards are the game's own policy
// cards (data/econ-tax-cards-*.xml); this module reads which ones this age holds and which is active, and sends the
// game's own policy-change operation for the local player, only when canSwapCultureSlot allows. With every slot full
// the engine refuses Activate even then, so a change is Deactivate of the active tax card, a wait for
// TraditionChanged, then Activate (P17). The AI's door is its own policy pass; nothing here touches an AI.

import { listen, localId, safe, unlisten } from "./econ-engine.js";
import { logDebug, logLine } from "./econ-log.js";
import { toCents } from "./econ-money.js";
import { levelOf } from "./econ-tax-cards.js";
import { nodesUnlocking } from "./econ-stage-read.js";

const SWAP_WAIT_MS = 3000;

/**
 * @typedef {{ type: string, level: string, hash: unknown, index: unknown, active: boolean,
 *   unlocked: boolean, opener: string | null }} CardRead
 *   `opener` is the name key of the first node of this age that unlocks the card, for a card not yet unlocked
 */

function policySlot() {
  return safe(() => CultureSlotTypes.POLICY_CULTURE_SLOT, /** @type {number | null} */ (null));
}

/** The tax cards this age's database holds, and whether the civ has each unlocked and active. @param {number} pid */
export function readCards(pid) {
  const culture = safe(() => Players.get(pid).Culture, null);
  const unlocked = new Set(safe(() => culture?.getUnlockedTraditions(policySlot()),
    /** @type {unknown[]} */ ([])) || []);
  /** @type {CardRead[]} */
  const out = [];
  safe(() => {
    for (const row of GameInfo.Traditions) {
      const level = typeof row.TraditionType === "string" ? levelOf(row.TraditionType) : null;
      if (!level) continue;
      out.push({ type: row.TraditionType, level, hash: row.$hash, index: row.$index,
        active: !!culture && safe(() => culture.isTraditionActive(row.$hash) === true, false),
        unlocked: unlocked.has(row.$hash) || unlocked.has(row.$index), opener: openerName(row.TraditionType) });
    }
    return true;
  }, false);
  return out;
}

/**
 * The name key of the node that unlocks a card in this age, found through the unlock rows with every mod applied.
 * @param {string} type
 */
function openerName(type) {
  const node = nodesUnlocking(type)[0];
  if (!node) return null;
  return safe(() => String(GameInfo.ProgressionTreeNodes.lookup(node)?.Name), null) || node;
}

/**
 * What the Fiscal tab's forecast needs for one civ (econ-tax-cards.js cardForecast): its settlements' Gold and
 * Happiness yields summed, how many settlements it has, its net Happiness a turn, and the celebration meter, read
 * the way the game's own policies button reads it (threshold less the lifetime Happiness). Screen-only: the turn
 * batch never reads it.
 * @param {number} pid
 * @param {boolean} atWar
 * @returns {import("./econ-tax-cards.js").FiscalRead}
 */
export function readFiscal(pid, atWar) {
  const p = safe(() => Players.get(pid), null);
  const cityYield = (/** @type {number} */ yieldType) => safe(() => {
    let sum = 0;
    for (const city of p.Cities.getCities() || []) sum += Number(city.Yields.getYield(yieldType)) || 0;
    return sum;
  }, 0);
  const gold = safe(() => YieldTypes.YIELD_GOLD, -1);
  const happiness = safe(() => YieldTypes.YIELD_HAPPINESS, -1);
  const threshold = safe(() => Number(p.Happiness.nextGoldenAgeThreshold), NaN);
  const lifetime = safe(() => Math.ceil(Number(p.Stats.getLifetimeYield(happiness))), NaN);
  const settlements = safe(() => (p.Cities.getCities() || []).length, 0);
  const left = Number.isFinite(threshold) && Number.isFinite(lifetime) ? toCents(threshold - lifetime) : null;
  return { goldCents: toCents(cityYield(gold)), happinessCents: toCents(cityYield(happiness)),
    netHappinessCents: toCents(safe(() => p.Stats.getNetYield(happiness), 0)), settlements,
    celebrationLeftCents: left,
    celebrating: safe(() => p.Happiness.isInGoldenAge() === true, false), atWar };
}

/** @param {number} pid */
export function canSwap(pid) {
  return safe(() => Players.get(pid).Culture.canSwapCultureSlot(policySlot()) === true, false);
}

/**
 * @param {number} pid
 * @param {CardRead} card
 * @param {boolean} on
 */
function sendChange(pid, card, on) {
  const args = { TraditionType: card.index, Action: on ? PlayerOperationParameters.Activate
    : PlayerOperationParameters.Deactivate };
  const can = safe(() => Game.PlayerOperations.canStart(pid, PlayerOperationTypes.CHANGE_TRADITION, args, false),
    /** @type {{ Success?: boolean } | null} */ (null));
  if (!can || can.Success !== true) return false;
  return safe(() => {
    Game.PlayerOperations.sendRequest(pid, PlayerOperationTypes.CHANGE_TRADITION, args);
    return true;
  }, false);
}

/**
 * Resolves after the next TraditionChanged, or after the wait, whichever is first.
 * @returns {Promise<boolean>}
 */
function afterTraditionChanged() {
  return new Promise((resolve) => {
    let done = false;
    const finish = (/** @type {boolean} */ changed) => {
      if (done) return;
      done = true;
      unlisten("TraditionChanged", handler);
      resolve(changed);
    };
    const handler = () => finish(true);
    if (!listen("TraditionChanged", handler)) { finish(false); return; }
    setTimeout(() => finish(false), SWAP_WAIT_MS);
  });
}

/**
 * Deactivates the active tax card and waits for the engine to say so.
 * @param {number} pid
 * @param {CardRead} active
 */
async function clearActive(pid, active) {
  if (!sendChange(pid, active, false)) return false;
  await afterTraditionChanged();
  logLine(`tax card cleared: ${active.type}`);
  return true;
}

/**
 * Puts the local player on `type`, or clears the active tax card when `type` is null (DESIGN 4.7's player door).
 * Resolves with what happened: "sent", "cleared", "no-swap", "no-slot", "unknown" or "same".
 * @param {string | null} type
 */
export async function swapTo(type) {
  const me = localId();
  const pick = pickCards(readCards(me), type);
  if (pick.verdict) return pick.verdict;
  if (!canSwap(me)) return "no-swap";
  const cleared = pick.active ? await clearActive(me, pick.active) : true;
  if (!cleared) return "no-swap";
  return pick.target ? activate(me, pick.target) : "cleared";
}

/**
 * The card to leave and the card to take, or the verdict that ends the swap before anything is sent.
 * @param {CardRead[]} cards
 * @param {string | null} type
 * @returns {{ target: CardRead | null, active: CardRead | null, verdict: string | null }}
 */
export function pickCards(cards, type) {
  const target = cards.find((card) => card.type === type) || null;
  const active = cards.find((card) => card.active) || null;
  if (type && !target) return { target, active, verdict: "unknown" };
  const sameCard = (active ? active.type : null) === (target ? target.type : null);
  return { target, active, verdict: sameCard ? "same" : null };
}

/**
 * @param {number} pid
 * @param {CardRead} target
 */
function activate(pid, target) {
  if (!sendChange(pid, target, true)) { logDebug(`activate refused for ${target.type}`); return "no-slot"; }
  logLine(`tax card set: ${target.type}`);
  return "sent";
}
