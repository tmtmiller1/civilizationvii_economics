// The standing Gold lines' marker data (docs/AI-NATIVE-LEVERS.md "Marker rules"): the SQL is what the generator
// writes, every rung has its English name, the always-on game group loads the file, and with CIV7_GAMEPLAY_DB set to a
// copy of the compiled gameplay database the SQL lands 80 markers (4 GLOOM, 1 SHUT) and 75 modifiers that pass a
// foreign-key check.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ROOT } from "./_fs-helpers.mjs";
import { GLOOM_RUNGS, LINES, NOTE_RUNGS, PRICE_RUNGS, RUNGS, markerTypes, otherMarkerTypes, standingSql }
  from "../scripts/gen-standing-lines.mjs";

const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const sql = read("data/econ-standing-lines.sql");

test("the SQL is the generator's output", () => {
  assert.equal(sql, standingSql(), "run node scripts/gen-standing-lines.mjs");
});

test("six lines of ten rungs, the paying lines negative", () => {
  const rows = markerTypes();
  assert.equal(rows.length, 60);
  assert.deepEqual(RUNGS, [1, 2, 4, 8, 16, 32, 64, 128, 256, 512]);
  assert.deepEqual(Object.keys(LINES), ["DEBT", "LOAN", "BILL", "BILLIN", "WORLD", "WORLDIN"]);
  assert.equal(rows.find((r) => r.type === "BUILDING_ECON_LINE_DEBT_16").amount, -16);
  assert.equal(rows.find((r) => r.type === "BUILDING_ECON_LINE_BILL_512").amount, -512);
  assert.equal(rows.find((r) => r.type === "BUILDING_ECON_LINE_LOAN_1").amount, 1);
  assert.equal(rows.find((r) => r.type === "BUILDING_ECON_LINE_BILLIN_64").amount, 64);
  assert.equal(rows.find((r) => r.type === "BUILDING_ECON_LINE_WORLD_8").amount, -8);
  assert.equal(rows.find((r) => r.type === "BUILDING_ECON_LINE_WORLDIN_256").amount, 256);
});

test("every rung's name says its line and its Gold; every line has a description", () => {
  const text = read("text/en_us/ModText.xml");
  const label = { DEBT: "Debt service", LOAN: "Loan repayments", BILL: "Trade bills", BILLIN: "Trade bills paid to you",
    WORLD: "Economy costs",
    WORLDIN: "Economy receipts" };
  for (const r of markerTypes()) {
    const sign = r.amount < 0 ? "-" : "+";
    assert.ok(text.includes(`<Row Tag="${r.name}"><Text>${label[r.line]}: ${sign}${r.n} Gold</Text></Row>`),
      r.type);
  }
  for (const line of Object.keys(LINES)) assert.ok(text.includes(`Tag="LOC_ECONOMICS_LINE_${line}_DESCRIPTION"`), line);
});

test("the always-on game group loads the file", () => {
  const modinfo = read("economics.modinfo");
  const group = modinfo.slice(modinfo.indexOf('<ActionGroup id="economics-game"'));
  const body = group.slice(0, group.indexOf("</ActionGroup>"));
  assert.ok(body.includes('criteria="always"'));
  assert.ok(body.includes("<Item>data/econ-standing-lines.sql</Item>"));
});

test("every row selects through a parent table", () => {
  for (const stmt of sql.split(";").map((s) => s.trim()).filter((s) => /^INSERT OR IGNORE INTO/.test(s.replace(/^--.*\n/gm, "")))) {
    const body = stmt.replace(/^--.*\n/gm, "");
    // Types and Tags are the parents themselves.
    if (/^INSERT OR IGNORE INTO (Types|Tags) /.test(body)) continue;
    assert.ok(/SELECT/.test(body) && /WHERE/.test(body), body.slice(0, 80));
  }
});

test("compiled database: 80 markers, the line and shutdown modifiers, the gloom yields, no foreign-key failures",
  async (t) => {
  const source = process.env.CIV7_GAMEPLAY_DB;
  if (!source || !fs.existsSync(source)) { t.diagnostic("CIV7_GAMEPLAY_DB not set; the database check didn't run"); return; }
  const copy = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "econ-lines-")), "gameplay.sqlite");
  fs.copyFileSync(source, copy);
  // node:sqlite, since the game's hash triggers call its own Make_Hash, which the sqlite3 shell lacks.
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(copy);
  db.function("Make_Hash", (text) => {
    let h = 0;
    for (const ch of String(text)) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
    return h;
  });
  db.exec(`PRAGMA foreign_keys=ON;\n${sql}`);
  const count = (q) => Object.values(db.prepare(q).get())[0];
  assert.equal(count("SELECT COUNT(*) FROM Buildings WHERE ConstructibleType LIKE 'BUILDING_ECON_%'"), 80);
  assert.equal(count("SELECT COUNT(*) FROM GameModifiers WHERE ModifierId LIKE 'ECON_SHUT_1_%'"),
    1 + count("SELECT COUNT(*) FROM Yields"), "the Gold upkeep and one output cut a yield");
  assert.equal(count("SELECT COUNT(*) FROM GameModifiers WHERE ModifierId LIKE 'ECON_LINE_%'"), 60);
  assert.equal(count("SELECT COUNT(*) FROM TypeTags WHERE Type LIKE 'BUILDING_ECON_%'"), 240);
  assert.deepEqual(db.prepare("SELECT ConstructibleType AS t, YieldChange AS n FROM Constructible_YieldChanges "
    + "WHERE ConstructibleType LIKE 'BUILDING_ECON_GLOOM_%' AND YieldType = 'YIELD_HAPPINESS' ORDER BY YieldChange DESC")
    .all().map((r) => [r.t, r.n]), GLOOM_RUNGS.map((n) => [`BUILDING_ECON_GLOOM_${n}`, -n]));
  for (const table of ["Types", "Traits", "Constructibles", "Buildings", "Constructible_ValidDistricts", "TypeTags",
    "DynamicModifiers", "Requirements", "RequirementArguments", "RequirementSets", "RequirementSetRequirements",
    "Modifiers", "ModifierArguments", "GameModifiers", "Constructible_YieldChanges"]) {
    assert.deepEqual(db.prepare(`PRAGMA foreign_key_check(${table})`).all(), [], table);
  }
  db.close();
});

test("the price and repudiation markers: their ladders, names, the event row and the routes the lab watched", () => {
  const text = read("text/en_us/ModText.xml");
  const other = otherMarkerTypes();
  assert.deepEqual(other.map((r) => r.type), [...PRICE_RUNGS.map((n) => `BUILDING_ECON_PRICE_${n}`),
    ...NOTE_RUNGS.map((n) => `BUILDING_ECON_NOTE_REPUDIATED_${n}`), ...NOTE_RUNGS.map((n) => `BUILDING_ECON_NOTE_REPAID_${n}`), ...GLOOM_RUNGS.map((n) => `BUILDING_ECON_GLOOM_${n}`),
    "BUILDING_ECON_SHUT_1"]);
  for (const r of other) assert.ok(text.includes(`Tag="${r.name}"`), r.name);
  for (const tag of ["LOC_ECONOMICS_PRICE_DESCRIPTION", "LOC_ECONOMICS_NOTE_REPUDIATED_DESCRIPTION",
    "LOC_ECONOMICS_GRIEVANCE_REPUDIATION", "LOC_ECONOMICS_GRIEVANCE_REPUDIATION_ALT", "LOC_ECONOMICS_FAVOR_REPAID",
    "LOC_ECONOMICS_FAVOR_REPAID_ALT", "LOC_ECONOMICS_NOTE_REPAID_DESCRIPTION", "LOC_ECONOMICS_GLOOM_DESCRIPTION",
    "LOC_ECONOMICS_SHUT_DESCRIPTION"]) {
    assert.ok(text.includes(`Tag="${tag}"`), tag);
  }
  assert.match(sql, /'ECON_PRICE_TYPE', 'COLLECTION_ALL_CITIES', 'EFFECT_ADJUST_PLAYER_OR_CITY_ALL_PURCHASE_EFFICIENCY'/);
  assert.match(sql, /SELECT M, 'Percent' N, CAST\(-N AS TEXT\)/);
  assert.match(sql, /'GrievancesEventType', 'GRIEVANCE_FROM_ECON_REPUDIATION'/);
  assert.match(sql, /'FavorsEventType', 'FAVOR_FROM_ECON_LOAN_REPAID'/);
  assert.match(sql, /INSERT OR IGNORE INTO ConstructibleModifiers/);
  assert.match(sql, /SELECT B, 'YIELD_HAPPINESS', -N FROM econ_mark_s\nWHERE K = 'GLOOM'/);
  // SHUT (W13): Gold upkeep only, since a Happiness upkeep cut in the same row stayed after the marker went.
  assert.match(sql, /'ECON_SHUT_UPKEEP_TYPE', 'COLLECTION_ALL_CITIES', 'EFFECT_CITY_ADJUST_SPECIFIC_CONSTRUCTIBLE_MAINTENANCE'/);
  assert.match(sql, /SELECT M \|\| '_UPKEEP', 'YieldType', 'YIELD_GOLD'/);
  assert.match(sql, /'ECON_SHUT_OUTPUT_TYPE', 'COLLECTION_ALL_CITIES', 'EFFECT_CITY_ADJUST_CONSTRUCTIBLE_YIELD'/);
});
