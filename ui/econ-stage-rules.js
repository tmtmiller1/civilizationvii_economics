// econ-stage-rules.js - Economics: when a stage opens for a civ (DESIGN 4.15), as plain data. The glue finds the
// nodes that unlock each anchor in this age's GameInfo and asks the engine whether a civ has them; this module turns
// those reads into the turn each stage opened, which the ledger's civs carry as `stages`. Nothing here reads the
// engine.

/** The anchor each stage opens on (DESIGN 4.15): the type a node unlocks, never a node. */
export const STAGE_ANCHORS = { moneylending: "TRADITION_COMMODITIES", publicDebt: "TRADITION_MARITIME_LAW",
  coinage: "BUILDING_MARKET", trade: "UNIT_MERCHANT", guildPatronage: "BUILDING_GUILDHALL",
  charteredCompanies: "TRADITION_CHARTERS", tariffs: "TRADITION_TARIFFS", banking: "BUILDING_BANK",
  capitalism: "TRADITION_LAISSEZ_FAIRE" };

// The age each anchor belongs to in 1.5.0 (DESIGN 4.15's table), as a chronology index. Read only when this age has
// no node that unlocks the anchor and the anchor's own row names no age: then a later age opens the stage at its
// start and an earlier one keeps it closed.
/** @type {Record<string, number>} */
export const STAGE_DESIGN_AGE_INDEX = { moneylending: 0, publicDebt: 1, coinage: 0, trade: 0, guildPatronage: 1,
  charteredCompanies: 1, tariffs: 1, banking: 1, capitalism: 2 };

export const STAGE_NAMES = Object.keys(STAGE_ANCHORS);
// Coinage gates only data (War Levy's unlock), so the model's civ record leaves it out.
const MODEL_STAGES = STAGE_NAMES.filter((stage) => stage !== "coinage");

/**
 * Whether a stage is open for a civ now. With nodes in this age the civ needs one of them (a mod that moves the
 * unlock moves the stage); with none, the stage of an earlier age is open from the age's start and a later or
 * current age's stays closed until the next age.
 * @param {{ nodes: string[], anchorAgeIndex: number | null }} anchor
 * @param {{ currentAgeIndex: number, unlocked: boolean }} q
 */
export function isStageOpenNow(anchor, { currentAgeIndex, unlocked }) {
  if (anchor.nodes.length > 0) return unlocked;
  if (anchor.anchorAgeIndex === null) return true;
  return currentAgeIndex > anchor.anchorAgeIndex;
}

/**
 * Carries each civ's recorded stage turns forward and records this turn for each stage that opened now.
 * `reads` is one row per living civ with the open flags the glue read; a civ with no row keeps its record.
 * @param {Record<string, StageTurns>} previous keyed by player id
 * @param {{ pid: number, open: Record<string, boolean> }[]} reads
 * @param {number} turn
 * @param {string[]} [stages]
 * @returns {Record<string, StageTurns>}
 */
export function nextStageTurns(previous, reads, turn, stages = STAGE_NAMES) {
  /** @type {Record<string, StageTurns>} */
  const out = {};
  for (const [pid, row] of Object.entries(previous || {})) out[pid] = { ...row };
  for (const read of reads) {
    const key = String(read.pid);
    const row = /** @type {Record<string, number | null>} */ ({ ...(out[key] || {}) });
    for (const stage of stages) {
      const reached = Number.isInteger(row[stage]) ? row[stage] : null;
      row[stage] = reached ?? (read.open[stage] === true ? turn : null);
    }
    out[key] = row;
  }
  return out;
}

/**
 * The stage turns as the model's civ record carries them: only the stages the model gates on.
 * @param {StageTurns | undefined} row
 * @returns {StageTurns}
 */
export function modelStages(row) {
  /** @type {Record<string, number | null>} */
  const out = {};
  const source = /** @type {Record<string, unknown>} */ (row || {});
  for (const stage of MODEL_STAGES) {
    out[stage] = Number.isInteger(source[stage]) ? /** @type {number} */ (source[stage]) : null;
  }
  return /** @type {StageTurns} */ (out);
}
