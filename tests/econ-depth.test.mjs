import test from "node:test";
import assert from "node:assert/strict";
import { computeDepth, rolesOf } from "../ui/econ-depth.js";

const market = { tags: ["GOLD"], goldYield: 3, isWonder: false, advisories: [] };
const bank = { tags: ["GOLD"], goldYield: 8, isWonder: false, advisories: [] };
const port = { tags: ["GOLD", "WATER"], goldYield: 8, isWonder: false, advisories: [] };
const colossus = { tags: [], goldYield: 3, isWonder: true, advisories: ["ADVISORY_CLASS_ECONOMIC"] };

test("roles (DESIGN 4.13): Commerce is the GOLD tag; Banking needs the Bank's Gold and none of the water tags", () => {
  assert.deepEqual(rolesOf(market, 8), { commerce: true, banking: false, economicWonder: false });
  assert.deepEqual(rolesOf(bank, 8), { commerce: true, banking: true, economicWonder: false });
  assert.deepEqual(rolesOf(port, 8), { commerce: true, banking: false, economicWonder: false });
  assert.deepEqual(rolesOf(colossus, 8), { commerce: false, banking: false, economicWonder: true });
  assert.equal(rolesOf({ tags: ["GOLD"], goldYield: 9, isWonder: false, advisories: [] }, 9).banking, true,
    "a unique bank with the Bank's yield counts");
});

test("depth = sum of Gold / 4; depth_turns = 2 per Banking building up to 12; factor cuts 2% per depth to 30%", () => {
  const rows = [{ roles: rolesOf(market, 8), goldYield: 3, weight: 1 }, { roles: rolesOf(bank, 8), goldYield: 8, weight: 1 }];
  const depth = computeDepth(rows);
  assert.equal(depth.depth, 2.75);
  assert.equal(depth.depthTurns, 2);
  assert.equal(depth.depthFactorPct, 95, "1 - 0.02 * 2.75 = 0.945, rounded");
  const many = computeDepth(Array.from({ length: 9 }, () => ({ roles: rolesOf(bank, 8), goldYield: 8, weight: 1 })));
  assert.equal(many.depthTurns, 12, "capped at 12");
  assert.equal(many.depthFactorPct, 70, "depth 18 cuts 36%, capped at 30%");
  const damaged = computeDepth([{ roles: rolesOf(bank, 8), goldYield: 8, weight: 0 }]);
  assert.deepEqual([damaged.depth, damaged.depthTurns], [0, 0], "a damaged building counts 0");
  const wonders = computeDepth(Array.from({ length: 4 }, () => ({ roles: rolesOf(colossus, 8), goldYield: 0, weight: 1 })));
  assert.equal(wonders.depthFactorPct, 85, "4 economic wonders cut 20%, capped at 15%");
});
