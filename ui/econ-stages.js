// econ-stages.js - Economics: the stage gates loans run behind (DESIGN 4.15; TEST-PLAN 12.6). The glue records the
// turn each civ reached a stage and passes it in as `civ.stages = { moneylending, publicDebt }`; the model only asks
// whether a stage is open. With the Economic stages option Off every stage is open from the start. Resolving each
// stage's anchor node through ProgressionTreeNodeUnlocks is the glue's half (TEST-PLAN 12.1).

import { STAGES } from "./econ-params.js";

/**
 * Open when the civ reached the stage on this turn or earlier; an unknown or malformed entry reads closed.
 * @param {Civ | LenderView | undefined} civ
 * @param {string} stage
 * @param {number} turn
 * @param {Partial<PlanOptions>} [options]
 */
export function hasStage(civ, stage, turn, options = {}) {
  if (options.stages === false) return true;
  if (!STAGES.includes(stage)) return false;
  const stages = /** @type {Record<string, unknown> | undefined} */ (civ?.stages);
  const reached = stages?.[stage];
  return Number.isInteger(reached) && /** @type {number} */ (reached) <= turn;
}

/**
 * DESIGN 4.6: who an emergency loan can come from at this civ's stage.
 * @param {Civ | undefined} civ
 * @param {number} turn
 * @param {Partial<PlanOptions>} [options]
 */
export function emergencyLenderKinds(civ, turn, options = {}) {
  if (hasStage(civ, "publicDebt", turn, options)) return { civs: true, bond: true, temple: false };
  if (hasStage(civ, "moneylending", turn, options)) return { civs: true, bond: false, temple: true };
  return { civs: false, bond: false, temple: true };
}
