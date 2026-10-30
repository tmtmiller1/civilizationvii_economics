// dump-commerce-fixture.mjs - Economics: copy the rows the 1.1 rules read out of a compiled gameplay DB into a test
// fixture: resources and their classes, the engine's own Trade Income per route (TradeYields), game speeds, the Gold
// purchase multiplier, the buildings with an economic role's tags, advisories, Gold yield and cost, the units that
// name a strategic resource, and the nodes that unlock the stage anchors. The tests and the balance run read the
// game's numbers from it instead of literals. Read-only: sqlite3 is opened with -readonly.
// Usage: node scripts/dump-commerce-fixture.mjs <db> <age label> [gameVersion]
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const [db, label, game = "1.5.0"] = process.argv.slice(2);
if (!db || !label) {
  console.error("usage: node scripts/dump-commerce-fixture.mjs <db> <age label> [gameVersion]");
  process.exit(1);
}

/** @param {string} sql */
const rows = (sql) => JSON.parse(execFileSync("sqlite3", ["-readonly", "-json", db, sql], { encoding: "utf8" }) || "[]");

const roleTags = "'GOLD','TRADE','WAREHOUSE','PRODUCTION','WATER','BRIDGE','RAIL_CONNECTION','AGELESS'";
const fixture = {
  source: "gameplay-copy.sqlite", age: label, game,
  resources: rows("SELECT ResourceType AS type, ResourceClassType AS class FROM Resources ORDER BY ResourceType"),
  tradeYields: rows("SELECT Domain, ResourceCount, Amount, YieldType FROM TradeYields ORDER BY Domain, ResourceCount"),
  gameSpeeds: rows("SELECT GameSpeedType, CostMultiplier FROM GameSpeeds ORDER BY CostMultiplier"),
  goldPurchaseMultiplier: rows("SELECT Value FROM GlobalParameters WHERE Name = 'GOLD_PURCHASE_MULTIPLIER'")[0]?.Value,
  buildings: rows(`SELECT c.ConstructibleType AS type, c.ConstructibleClass AS class, c.Age AS age, c.Cost AS cost,
      (SELECT group_concat(Tag) FROM TypeTags t WHERE t.Type = c.ConstructibleType AND Tag IN (${roleTags})) AS tags,
      (SELECT group_concat(AdvisoryClassType) FROM Constructible_Advisories a
        WHERE a.ConstructibleType = c.ConstructibleType) AS advisories,
      (SELECT YieldChange FROM Constructible_YieldChanges y
        WHERE y.ConstructibleType = c.ConstructibleType AND YieldType = 'YIELD_GOLD') AS gold
    FROM Constructibles c WHERE c.ConstructibleClass IN ('BUILDING', 'WONDER')
      AND (EXISTS (SELECT 1 FROM TypeTags t WHERE t.Type = c.ConstructibleType
          AND Tag IN ('GOLD', 'TRADE', 'WAREHOUSE', 'PRODUCTION'))
        OR EXISTS (SELECT 1 FROM Constructible_Advisories a WHERE a.ConstructibleType = c.ConstructibleType
          AND AdvisoryClassType IN ('ADVISORY_CLASS_TRADE', 'ADVISORY_CLASS_ECONOMIC')))
    ORDER BY c.ConstructibleType`).map((row) => ({ ...row, tags: row.tags ? String(row.tags).split(",").sort() : [],
    advisories: row.advisories ? String(row.advisories).split(",").sort() : [] })),
  strategicUnits: rows("SELECT UnitType, StrategicResource FROM Units WHERE StrategicResource IS NOT NULL ORDER BY 1"),
  anchorNodes: rows(`SELECT ProgressionTreeNodeType AS node, TargetType AS anchor FROM ProgressionTreeNodeUnlocks
    WHERE TargetType IN ('UNIT_MERCHANT', 'BUILDING_MARKET', 'TRADITION_COMMODITIES', 'BUILDING_GUILDHALL',
      'TRADITION_MARITIME_LAW', 'TRADITION_CHARTERS', 'TRADITION_TARIFFS', 'BUILDING_BANK') ORDER BY 2, 1`),
};
const target = join(here, "..", "tests", "fixtures", `commerce-${label}-${game}.json`);
writeFileSync(target, JSON.stringify(fixture, null, 1) + "\n");
console.log(`wrote ${fixture.resources.length} resources and ${fixture.buildings.length} buildings to ${target}`);
