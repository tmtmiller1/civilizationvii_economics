import test from "node:test";
import assert from "node:assert/strict";
import { STAGE_ANCHORS, isStageOpenNow, modelStages, nextStageTurns } from "../ui/econ-stage-rules.js";

test("the anchors are the DESIGN 4.15 types, never nodes", () => {
  assert.deepEqual(STAGE_ANCHORS, { moneylending: "TRADITION_COMMODITIES", publicDebt: "TRADITION_MARITIME_LAW",
    coinage: "BUILDING_MARKET" });
});

test("with nodes in this age the civ needs one; without, an earlier age's stage is open and a later one's closed", () => {
  const withNode = { nodes: ["NODE_X"], anchorAgeIndex: 0 };
  assert.equal(isStageOpenNow(withNode, { currentAgeIndex: 1, unlocked: false }), false, "a moved unlock moves the stage");
  assert.equal(isStageOpenNow(withNode, { currentAgeIndex: 0, unlocked: true }), true);
  const antiquityAnchor = { nodes: [], anchorAgeIndex: 0 };
  assert.equal(isStageOpenNow(antiquityAnchor, { currentAgeIndex: 1, unlocked: false }), true, "opens at the age's start");
  assert.equal(isStageOpenNow(antiquityAnchor, { currentAgeIndex: 0, unlocked: false }), false,
    "no node this age: it opens at the start of the next age");
  assert.equal(isStageOpenNow({ nodes: [], anchorAgeIndex: 1 }, { currentAgeIndex: 0, unlocked: false }), false);
  assert.equal(isStageOpenNow({ nodes: [], anchorAgeIndex: null }, { currentAgeIndex: 0, unlocked: false }), true,
    "nothing names an age: open");
});

test("stage turns are recorded once and carried forward; a civ with no read keeps its record", () => {
  const first = nextStageTurns({}, [{ pid: 4, open: { moneylending: true, publicDebt: false, coinage: false } }], 12);
  assert.deepEqual(first, { 4: { moneylending: 12, publicDebt: null, coinage: null } });
  const later = nextStageTurns(first, [{ pid: 4, open: { moneylending: false, publicDebt: true, coinage: true } }], 30);
  assert.deepEqual(later[4], { moneylending: 12, publicDebt: 30, coinage: 30 }, "a recorded turn never moves");
  const kept = nextStageTurns(later, [], 31);
  assert.deepEqual(kept, later);
  assert.notEqual(kept[4], later[4], "copies, not the same rows");
  assert.deepEqual(modelStages(later[4]), { moneylending: 12, publicDebt: 30 });
  assert.deepEqual(modelStages(undefined), { moneylending: null, publicDebt: null });
});
