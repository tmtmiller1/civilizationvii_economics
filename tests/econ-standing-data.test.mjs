// The standing Gold lines' marker data (docs/AI-NATIVE-LEVERS.md "Marker rules"): the SQL is what the generator
// writes, every rung has its English name, the always-on game group loads the file, and with CIV7_GAMEPLAY_DB set to a
// copy of the compiled gameplay database the SQL lands 40 markers and 40 modifiers that pass a foreign-key check.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ROOT } from "./_fs-helpers.mjs";
import { LINES, RUNGS, markerTypes, standingSql } from "../scripts/gen-standing-lines.mjs";

const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const sql = read("data/econ-standing-lines.sql");

test("the SQL is the generator's output", () => {
  assert.equal(sql, standingSql(), "run node scripts/gen-standing-lines.mjs");
});

test("four lines of ten rungs, the paying lines negative", () => {
  const rows = markerTypes();
  assert.equal(rows.length, 40);
  assert.deepEqual(RUNGS, [1, 2, 4, 8, 16, 32, 64, 128, 256, 512]);
  assert.deepEqual(Object.keys(LINES), ["DEBT", "LOAN", "BILL", "BILLIN"]);
  assert.equal(rows.find((r) => r.type === "BUILDING_ECON_LINE_DEBT_16").amount, -16);
  assert.equal(rows.find((r) => r.type === "BUILDING_ECON_LINE_BILL_512").amount, -512);
  assert.equal(rows.find((r) => r.type === "BUILDING_ECON_LINE_LOAN_1").amount, 1);
  assert.equal(rows.find((r) => r.type === "BUILDING_ECON_LINE_BILLIN_64").amount, 64);
});

test("every rung's name says its line and its Gold; every line has a description", () => {
  const text = read("text/en_us/ModText.xml");
  const label = { DEBT: "Debt service", LOAN: "Loan repayments", BILL: "Trade bills", BILLIN: "Trade bills paid to you" };
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

test("compiled database: 40 markers, 40 modifiers, no foreign-key failures", async (t) => {
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
  assert.equal(count("SELECT COUNT(*) FROM Buildings WHERE ConstructibleType LIKE 'BUILDING_ECON_LINE_%'"), 40);
  assert.equal(count("SELECT COUNT(*) FROM GameModifiers WHERE ModifierId LIKE 'ECON_LINE_%'"), 40);
  assert.equal(count("SELECT COUNT(*) FROM TypeTags WHERE Type LIKE 'BUILDING_ECON_LINE_%'"), 120);
  for (const table of ["Types", "Traits", "Constructibles", "Buildings", "Constructible_ValidDistricts", "TypeTags",
    "DynamicModifiers", "Requirements", "RequirementArguments", "RequirementSets", "RequirementSetRequirements",
    "Modifiers", "ModifierArguments", "GameModifiers"]) {
    assert.deepEqual(db.prepare(`PRAGMA foreign_key_check(${table})`).all(), [], table);
  }
  db.close();
});
