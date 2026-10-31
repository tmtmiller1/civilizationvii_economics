// econ-spoil.js - Economics: the Spoil Guard. On by default, it keeps civilizations the player hasn't met off the
// screen: the Trade and lending lists leave them out, and a line that would name one says "an unmet civilization".
// It works with the Demographics and Emigration guards the way they work with each other: Demographics' published
// policy and a host's ceiling are read from GameConfiguration, Demographics' own setting from its slice of the shared
// settings store, and the strictest of those and ours wins. The model never reads this; it only changes what's shown.

import { getSetting } from "./econ-settings.js";

const POLICY_DISABLED = "disabled";
const POLICY_OWN = "own-civ-only";
const POLICY_MET = "met-civs-only";
const POLICY_FULL = "full";
/** @type {Record<string, number>} */
const RANK = { [POLICY_DISABLED]: 0, [POLICY_OWN]: 1, [POLICY_MET]: 2, [POLICY_FULL]: 3 };

// The keys Demographics writes (its host ceiling, and the policy it publishes, per seat from 2.7.3).
const HOST_POLICY_KEY = "DemographicsAnalyticsPolicy_v1";
const EFFECTIVE_POLICY_KEY = "DemographicsAnalyticsPolicyEffective_v1";

// A read of the shared store parses the whole thing (several milliseconds), and a redraw asks about every civ, so the
// combined policy is kept for a second. A change on the Options page shows on the next redraw after that.
const KEEP_MS = 1000;
/** @type {{ policy: string, at: number } | null} */
let kept = null;

/** @param {unknown} v */
function asPolicy(v) {
  return typeof v === "string" && Object.hasOwn(RANK, v) ? v : null;
}

/** @param {string} key */
function configPolicy(key) {
  try {
    const game = typeof Configuration !== "undefined" ? Configuration.getGame?.() : null;
    return asPolicy(game && typeof game.getValue === "function" ? game.getValue(key) : null);
  } catch (_error) {
    return null;
  }
}

/** @param {number} me */
function publishedPolicy(me) {
  return (me >= 0 ? configPolicy(`${EFFECTIVE_POLICY_KEY}_P${me}`) : null) || configPolicy(EFFECTIVE_POLICY_KEY);
}

/** Demographics' own choice from its slice of the shared store, or null when it hasn't written one. */
function demographicsPolicy() {
  try {
    const slice = JSON.parse(localStorage.getItem("modSettings") || "{}")?.demographics;
    if (!slice || typeof slice !== "object") return null;
    const explicit = asPolicy(slice.analyticsPolicy);
    if (explicit) return explicit;
    if (slice.hideUnmetStats === false) return POLICY_FULL;
    return slice.hideUnmetStats === true ? POLICY_MET : null;
  } catch (_error) {
    return null;
  }
}

/**
 * The strictest of the policies given; a missing one counts as no limit.
 * @param {{ own: boolean, published?: string | null, demographics?: string | null, host?: string | null }} q
 *   own is our checkbox (true = guard on)
 */
export function combinedPolicy({ own, published = null, demographics = null, host = null }) {
  let out = own ? POLICY_MET : POLICY_FULL;
  for (const p of [published || demographics, host]) if (p && RANK[p] < RANK[out]) out = p;
  return out;
}

/**
 * Whether a civ is hidden under a policy. The player's own civ never is; anything that goes wrong reads as hidden.
 * @param {number} pid
 * @param {{ me: number, policy: string, met: (pid: number) => boolean }} q
 */
export function hiddenUnder(pid, { me, policy, met }) {
  if (pid === me) return false;
  if (RANK[policy] <= RANK[POLICY_OWN]) return true;
  if (policy === POLICY_FULL) return false;
  try { return !met(pid); } catch (_error) { return true; }
}

/** @param {number} me */
export function currentPolicy(me) {
  const now = Date.now();
  if (kept && now >= kept.at && now - kept.at < KEEP_MS) return kept.policy;
  const published = publishedPolicy(me);
  const policy = combinedPolicy({ own: getSetting("spoilGuard") !== false, published,
    demographics: published ? null : demographicsPolicy(), host: configPolicy(HOST_POLICY_KEY) });
  kept = { policy, at: now };
  return policy;
}

/** Forget the kept policy, so a change made on the Options page shows on the next redraw. */
export function forgetPolicy() {
  kept = null;
}

/**
 * @param {number} pid
 * @param {number} me
 */
function metInGame(pid, me) {
  return Players.get(me)?.Diplomacy?.hasMet?.(pid) === true;
}

/**
 * Whether the screen hides this civ now.
 * @param {number} pid
 * @param {number} me
 */
export function civHidden(pid, me) {
  return hiddenUnder(pid, { me, policy: currentPolicy(me), met: (other) => metInGame(other, me) });
}
