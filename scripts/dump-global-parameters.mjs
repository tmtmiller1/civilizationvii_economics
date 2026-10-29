// dump-global-parameters.mjs - Economics: copy the Gold-related GlobalParameters out of the compiled gameplay DB into
// a test fixture, so the guard's disband line and the amenity line come from the game's data and not from a literal.
// Read-only: sqlite3 is opened with -readonly.
// Usage: node scripts/dump-global-parameters.mjs [path/to/db] [gameVersion]
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const defaultDb = join(homedir(), "Library/Application Support/Civilization VII/Debug/gameplay-copy.sqlite");
const db = process.argv[2] || defaultDb;
const game = process.argv[3] || "1.5.0";
const sql = "SELECT Name, Value FROM GlobalParameters WHERE Name GLOB 'GOLD_*' ORDER BY Name";
const out = execFileSync("sqlite3", ["-readonly", "-json", db, sql], { encoding: "utf8" });
const rows = {};
for (const { Name, Value } of JSON.parse(out || "[]")) rows[Name] = Value;
if (!("GOLD_NEGATIVE_BALANCE_DISBAND_UNIT_LINE" in rows)) {
  // An empty Debug copy (no game loaded since boot) has no rows; refuse rather than write a fixture without the line.
  console.error("GlobalParameters has no GOLD_NEGATIVE_BALANCE_DISBAND_UNIT_LINE; load a game first");
  process.exit(1);
}
const fixture = { source: "Debug/gameplay-copy.sqlite", table: "GlobalParameters", game, rows };
const target = join(here, "..", "tests", "fixtures", `global-parameters-${game}.json`);
writeFileSync(target, JSON.stringify(fixture, null, 2) + "\n");
console.log(`wrote ${Object.keys(rows).length} rows to ${target}`);
