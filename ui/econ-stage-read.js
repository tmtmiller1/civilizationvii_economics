// econ-stage-read.js - Economics: which stage each civ has reached (DESIGN 4.15), read from the engine. The anchor
// types are fixed (econ-stage-rules.js); the nodes that unlock them come from this age's ProgressionTreeNodeUnlocks
// with every mod applied, so a mod that moves a civic moves the stage. A civ has a node when Culture.isNodeUnlocked
// or Techs.isNodeUnlocked says so (P13, both read for any player from the UI context). The turn a stage opened is
// recorded in the glue's envelope, so a stage survives its age's tree going away.

import { STAGE_ANCHORS, STAGE_DESIGN_AGE_INDEX, STAGE_NAMES, isStageOpenNow, nextStageTurns }
  from "./econ-stage-rules.js";
import { ageIndex, ageIndexOf, safe } from "./econ-engine.js";

/**
 * @typedef {{ nodes: string[], anchorAgeIndex: number | null, anchor: string }} AnchorRead
 */

/** @type {Record<string, AnchorRead> | null} */
let anchorCache = null;

/**
 * The nodes of this age that unlock each anchor, and the anchor's own age where its row names one (a building's
 * `Age`); otherwise the 1.5.0 age from DESIGN 4.15. Read once per load.
 * @returns {Record<string, AnchorRead>}
 */
export function resolveAnchors() {
  if (anchorCache) return anchorCache;
  /** @type {Record<string, AnchorRead>} */
  const out = {};
  for (const stage of STAGE_NAMES) {
    const anchor = STAGE_ANCHORS[/** @type {keyof typeof STAGE_ANCHORS} */ (stage)];
    const nodes = nodesUnlocking(anchor);
    const ownAge = safe(() => GameInfo.Constructibles.lookup(anchor)?.Age,
      /** @type {string | undefined} */ (undefined));
    const anchorAgeIndex = (ownAge ? ageIndexOf(ownAge) : null) ?? STAGE_DESIGN_AGE_INDEX[stage] ?? null;
    out[stage] = { nodes, anchorAgeIndex, anchor };
  }
  anchorCache = out;
  return out;
}

/**
 * The node types of this age that unlock `target`, in table order. GameInfo tables have no `map` (engine-closed), so
 * the rows are walked with for...of.
 * @param {string} target
 * @returns {string[]}
 */
export function nodesUnlocking(target) {
  return safe(() => {
    /** @type {string[]} */
    const out = [];
    for (const row of GameInfo.ProgressionTreeNodeUnlocks) {
      if (row.TargetType === target) out.push(String(row.ProgressionTreeNodeType));
    }
    return out;
  }, /** @type {string[]} */ ([]));
}

/** Test hook: forget the resolved anchors. */
export function resetAnchorsForTests() {
  anchorCache = null;
}

/**
 * Whether a civ has unlocked any of the nodes, through either tree (P13).
 * @param {number} pid
 * @param {string[]} nodes
 */
export function hasAnyNode(pid, nodes) {
  const p = safe(() => Players.get(pid), null);
  if (!p) return false;
  for (const node of nodes) {
    if (safe(() => p.Culture.isNodeUnlocked(node) === true, false)) return true;
    if (safe(() => p.Techs.isNodeUnlocked(node) === true, false)) return true;
  }
  return false;
}

/**
 * The stage turns for every living major after this turn's reads, carried forward from `previous`.
 * @param {Record<string, StageTurns>} previous
 * @param {number[]} majors
 * @param {number} turn
 * @param {{ anchors?: Record<string, AnchorRead>, currentAgeIndex?: number | null }} [over] for tests
 */
export function readStageTurns(previous, majors, turn, over = {}) {
  const anchors = over.anchors || resolveAnchors();
  const currentAgeIndex = over.currentAgeIndex === undefined ? ageIndex() : over.currentAgeIndex;
  const reads = majors.map((pid) => {
    /** @type {Record<string, boolean>} */
    const open = {};
    for (const stage of STAGE_NAMES) {
      const anchor = anchors[stage];
      const already = Number.isInteger(previous?.[String(pid)]?.[/** @type {keyof StageTurns} */ (stage)]);
      open[stage] = already || isStageOpenNow(anchor, { currentAgeIndex: currentAgeIndex ?? 0,
        unlocked: anchor.nodes.length > 0 && hasAnyNode(pid, anchor.nodes) });
    }
    return { pid, open };
  });
  return nextStageTurns(previous, reads, turn);
}

/**
 * The name key of the node that opens a stage in this age (the first found), for the greyed-out parts (DESIGN
 * 4.15); null when no node of this age unlocks it.
 * @param {string} stage
 */
export function stageOpenerName(stage) {
  const anchor = resolveAnchors()[stage];
  const node = anchor?.nodes[0];
  if (!node) return null;
  return safe(() => String(GameInfo.ProgressionTreeNodes.lookup(node)?.Name), null) || node;
}
