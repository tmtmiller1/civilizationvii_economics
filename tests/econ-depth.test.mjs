import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computeDepth, countRoles, isRoleBuilding, rolesOf } from "../ui/econ-depth.js";

const fixture = (age) => JSON.parse(readFileSync(new URL(`./fixtures/commerce-${age}-1.5.0.json`, import.meta.url), "utf8"));
const dataOf = (row) => ({ tags: row.tags, goldYield: row.gold ?? 0, isWonder: row.class === "WONDER",
  advisories: row.advisories });
const none = { trade: false, warehouse: false, industry: false };

const market = { tags: ["GOLD"], goldYield: 3, isWonder: false, advisories: [] };
const bank = { tags: ["GOLD"], goldYield: 8, isWonder: false, advisories: [] };
const port = { tags: ["GOLD", "WATER"], goldYield: 8, isWonder: false, advisories: [] };
const colossus = { tags: [], goldYield: 3, isWonder: true, advisories: ["ADVISORY_CLASS_ECONOMIC"] };

test("roles (DESIGN 4.13): Commerce is the GOLD tag; Banking needs the Bank's Gold and none of the water tags", () => {
  assert.deepEqual(rolesOf(market, 8), { commerce: true, banking: false, economicWonder: false, ...none });
  assert.deepEqual(rolesOf(bank, 8), { commerce: true, banking: true, economicWonder: false, ...none });
  assert.deepEqual(rolesOf(port, 8), { commerce: true, banking: false, economicWonder: false, ...none });
  assert.deepEqual(rolesOf(colossus, 8), { commerce: false, banking: false, economicWonder: true, ...none });
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

test("the 1.1 roles from the compiled 1.5.0 rows: Trade by tag or advisory, Warehouse by tag, Industry by both", () => {
  const ex = new Map(fixture("exploration").buildings.map((row) => [row.type, rolesOf(dataOf(row), 8)]));
  assert.equal(ex.get("BUILDING_BAZAAR").trade, true, "TRADE tag");
  assert.equal(ex.get("BUILDING_MARKET").trade, true, "ADVISORY_CLASS_TRADE");
  assert.equal(ex.get("BUILDING_BANK").trade, true);
  assert.equal(ex.get("BUILDING_GUILDHALL").trade, true);
  assert.equal(ex.get("BUILDING_GRANARY").warehouse, true);
  assert.equal(ex.get("BUILDING_GRANARY").trade, false);
  assert.equal(ex.get("WONDER_COLOSSUS").trade, false, "a wonder only takes the wonder role");
  assert.equal(ex.get("WONDER_COLOSSUS").economicWonder, true);
  const mo = new Map(fixture("modern").buildings.map((row) => [row.type, rolesOf(dataOf(row), 8)]));
  assert.equal(mo.get("BUILDING_FACTORY").industry, true);
  assert.equal(mo.get("BUILDING_RAIL_STATION").industry, true);
  assert.equal(mo.get("BUILDING_RAIL_STATION").banking, false, "excluded by its rail tag");
  assert.equal(mo.get("BUILDING_STOCK_EXCHANGE").banking, true);
  assert.equal(mo.get("BUILDING_PORT").industry, false);
  assert.equal(rolesOf({ tags: ["PRODUCTION"], goldYield: 0, isWonder: false, advisories: [] }, 8).industry, false,
    "Industry needs the economic advisory too");
  assert.equal(rolesOf({ tags: ["WAREHOUSE"], goldYield: 0, isWonder: true, advisories: [] }, 8).warehouse, false);
  assert.equal(rolesOf({ tags: ["PRODUCTION"], goldYield: 0, isWonder: true, advisories: ["ADVISORY_CLASS_ECONOMIC"] },
    8).industry, false);
  assert.deepEqual(rolesOf({}, 8), { commerce: false, banking: false, economicWonder: false, ...none });
});

test("a role building for a development loan's 6%, and the weighted counts the bills and demand read", () => {
  assert.equal(isRoleBuilding({ commerce: true, banking: false, trade: false, industry: false }), true);
  assert.equal(isRoleBuilding({ commerce: false, banking: true, trade: false, industry: false }), true);
  assert.equal(isRoleBuilding({ commerce: false, banking: false, trade: true, industry: false }), true);
  assert.equal(isRoleBuilding({ commerce: false, banking: false, trade: false, industry: true }), true);
  assert.equal(isRoleBuilding({ commerce: false, banking: false, trade: false, industry: false, warehouse: true }),
    false, "a warehouse doesn't pay the higher return");
  const roles = (over) => ({ commerce: false, banking: false, economicWonder: false, ...none, ...over });
  assert.deepEqual(countRoles([{ roles: roles({ trade: true }), weight: 1 }, { roles: roles({ trade: true, industry: true }),
    weight: 0 }, { roles: roles({ industry: true, warehouse: true }), weight: 1 }, { roles: roles({ trade: true }),
    weight: -1 }]), { trade: 1, industry: 1, warehouse: 1 }, "a damaged building counts 0");
});
