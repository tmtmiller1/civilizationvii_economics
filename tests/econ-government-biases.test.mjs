// The government biases (DESIGN 4.17, docs/government-biases.md): the SQL gives every civilization in the doc's table
// exactly one pick, the same one the table names, at one value; each age's picks spread as the spread table says, with
// every DLC and with the base game alone; every statement selects through Traits and Governments and touches only
// GovernmentBiases lists; and the modinfo loads the file behind Economic systems. With CIV7_GAMEPLAY_DB set to a copy
// of a compiled gameplay database, the SQL is applied to a copy, and to a copy with the DLC civilizations removed, and
// the touched tables pass a foreign-key check.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT } from "./_fs-helpers.mjs";

const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const doc = read("docs/government-biases.md");
const sql = read("data/econ-government-biases.sql");
const code = sql.split("\n").filter((line) => !line.startsWith("--")).join("\n");
const modinfo = read("economics.modinfo");
const VALUE = 75;

const typeOf = (prefix, name) => `${prefix}_${name.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/ /g, "_")}`;
const cells = (line) => line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
const tableAfter = (heading) => {
  const lines = doc.split(heading)[1].split("\n");
  const start = lines.findIndex((l) => l.startsWith("| "));
  const rows = [];
  for (const line of lines.slice(start + 2)) {
    if (!line.startsWith("| ")) break;
    rows.push(cells(line));
  }
  return rows;
};
const civs = tableAfter("## Every civilization").map(([name, age, dlc, game, pick, system]) =>
  ({ name, age, dlc, game, pick, system, trait: typeOf("TRAIT", name), gov: typeOf("GOVERNMENT", pick) }));
const governments = tableAfter("## Governments by age").map(([age, name, system, how]) => ({ age, name, system, how }));
const spread = tableAfter("## The spread").map(([age, content, count, govs, systems]) => ({ age, content, count: Number(count), govs, systems }));

const updates = [...sql.matchAll(/UPDATE OR IGNORE AiFavoredItems SET Item = '([A-Z_]+)', Value = (\d+)\s+WHERE Item(?: = '([A-Z_]+)'| IN \(([^)]*)\))\s+AND ListType IN \(SELECT ListType FROM AiLists WHERE LeaderType = '([A-Z_]+)' AND System = 'GovernmentBiases'\)\s+AND EXISTS \(SELECT 1 FROM Traits WHERE TraitType = '([A-Z_]+)'\)\s+AND EXISTS \(SELECT 1 FROM Governments WHERE GovernmentType = '([A-Z_]+)'\);/g)]
  .map((m) => ({ gov: m[1], value: Number(m[2]), base: m[3] ? [m[3]] : m[4].split(",").map((b) => b.trim().replace(/'/g, "")), trait: m[5], traitCheck: m[6], govCheck: m[7] }));
const inserts = sql.split(/;\s*\n/).filter((s) => /INSERT OR IGNORE INTO/.test(s));
const picksOf = (statement) => [...statement.matchAll(/SELECT '([A-Z_]+)' AS trait, '([A-Z_]+)' AS gov/g)].map((m) => `${m[1]} ${m[2]}`);

test("the doc table lists the 50 civilizations, each once, with a government its age offers", () => {
  assert.equal(civs.length, 50);
  assert.equal(new Set(civs.map((c) => c.trait)).size, 50, "each civilization once");
  for (const civ of civs) {
    const offered = governments.filter((g) => g.age === civ.age || g.age === "every age").map((g) => g.name);
    assert.ok(offered.includes(civ.pick), `${civ.name}: ${civ.pick} in ${civ.age}`);
    const gov = governments.find((g) => g.name === civ.pick);
    assert.equal(civ.system, gov.system.replace(/ until an ideology$/, ""), `${civ.name}'s system follows 4.17's table`);
    assert.ok(!/crisis event only/.test(gov.how), `${civ.name} isn't pointed at a crisis government`);
    if (civ.pick === "Revolución") assert.equal(civ.name, "Mexico", "Revolución is Mexico's own");
  }
});

test("every civilization has exactly one pick in the SQL, the table's, at one value", () => {
  const lists = inserts.map(picksOf);
  assert.equal(lists.length, 3, "list type, list, item");
  for (const list of lists) assert.deepEqual(list, civs.map((c) => `${c.trait} ${c.gov}`), "the insert picks follow the table, in its order");
  for (const civ of civs) {
    const mine = updates.filter((u) => u.trait === civ.trait);
    if (civ.game === "none") {
      assert.equal(mine.length, 0, `${civ.name} has no base row to rewrite`);
      continue;
    }
    assert.equal(mine.length, 1, `${civ.name}: one rewrite of its base row`);
    const [u] = mine;
    assert.equal(u.gov, civ.gov, civ.name);
    assert.equal(u.traitCheck, civ.trait);
    assert.equal(u.govCheck, civ.gov, `${civ.name} selects through its new government`);
    const baseName = civ.game.replace(/, misspelt$/, "").replace(/ \d+$/, "");
    assert.ok(u.base.includes(typeOf("GOVERNMENT", baseName)), `${civ.name} matches the base game's ${baseName}`);
  }
  assert.equal(updates.length, civs.filter((c) => c.game !== "none").length, "no rewrite for a civilization off the table");
  assert.deepEqual([...new Set(updates.map((u) => u.value))], [VALUE]);
  assert.match(sql, new RegExp(`SELECT l\\.ListType, g\\.GovernmentType, 1, ${VALUE}`));
  assert.ok(doc.includes(`Every row is at ${VALUE}.`));
});

test("each age's picks spread as the table says, with every DLC and with the base game alone", () => {
  for (const row of spread) {
    const here = civs.filter((c) => c.age === row.age && (row.content === "every DLC" || c.dlc === "base"));
    assert.equal(here.length, row.count, `${row.age}, ${row.content}`);
    const tally = (key) => {
      const out = new Map();
      for (const c of here) out.set(c[key], (out.get(c[key]) || 0) + 1);
      return out;
    };
    const parse = (text) => new Map(text.split(", ").map((part) => {
      const m = part.match(/^(.*) (\d+)$/);
      return [m[1], Number(m[2])];
    }));
    assert.deepEqual(tally("pick"), new Map([...parse(row.govs)].filter(([, n]) => n > 0)), `${row.age}, ${row.content}: governments`);
    assert.deepEqual(new Map([...tally("system")].sort()), new Map([...parse(row.systems)].sort()), `${row.age}, ${row.content}: systems`);
    // As even as the government count allows: the age's screen governments differ by one at most.
    const screen = governments.filter((g) => g.age === row.age && g.how === "the government screen").map((g) => g.name);
    const counts = screen.map((g) => tally("pick").get(g) || 0);
    assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `${row.age}, ${row.content}: ${counts.join(", ")}`);
  }
});

test("every statement selects through Traits and Governments and touches only GovernmentBiases rows", () => {
  assert.equal(/\bDELETE\b/i.test(code), false, "nothing deleted");
  assert.equal(/\bUPDATE\b(?! OR IGNORE AiFavoredItems)/.test(code), false, "only AiFavoredItems is updated");
  for (const statement of inserts) {
    assert.match(statement, /JOIN Traits t ON t\.TraitType = p\.trait/);
    assert.match(statement, /JOIN Governments g ON g\.GovernmentType = p\.gov/);
  }
  assert.match(inserts[0], /INSERT OR IGNORE INTO AiListTypes \(ListType\)/);
  assert.match(inserts[1], /INSERT OR IGNORE INTO AiLists \(ListType, LeaderType, System\)\s+SELECT a\.ListType, p\.trait, 'GovernmentBiases'/);
  assert.match(inserts[2], /INSERT OR IGNORE INTO AiFavoredItems \(ListType, Item, Favored, Value\)/);
  for (const statement of inserts.slice(0, 2)) {
    assert.match(statement, /WHERE NOT EXISTS \(SELECT 1 FROM AiLists l WHERE l\.LeaderType = p\.trait AND l\.System = 'GovernmentBiases'\)/,
      "a civilization that already has a list, the game's or another mod's, keeps it");
  }
  const systems = [...sql.matchAll(/System = '([A-Za-z]+)'/g)].map((m) => m[1]);
  assert.ok(systems.length > updates.length, "every list lookup names its system");
  assert.deepEqual([...new Set(systems)], ["GovernmentBiases"]);
});

test("the modinfo loads the file in every age behind Economic systems alone", () => {
  const group = (modinfo.match(/<ActionGroup id="economics-government-biases"[\s\S]*?<\/ActionGroup>/) || [""])[0];
  assert.match(group, /scope="game" criteria="systems-option-on"[\s\S]*<LoadOrder>113[\s\S]*data\/econ-government-biases\.sql/);
  const criteria = (modinfo.match(/<Criteria id="systems-option-on">[\s\S]*?<\/Criteria>/) || [""])[0];
  assert.match(criteria, /ECONOMICS_SYSTEMS_ON/);
  assert.equal(/ECONOMICS_TAXES|AgeInUse/.test(criteria), false, "every age, whatever Taxes is set to");
});

test("applied to a compiled database, and to one without the DLC civilizations: clean keys, the table's picks", (t) => {
  const source = process.env.CIV7_GAMEPLAY_DB;
  if (!source || !fs.existsSync(source)) { t.diagnostic("CIV7_GAMEPLAY_DB not set; the database check didn't run"); return; }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "econ-bias-"));
  const dlcTraits = civs.filter((c) => c.dlc !== "base").map((c) => `'${c.trait}'`).join(", ");
  for (const withDlc of [true, false]) {
    const copy = path.join(dir, withDlc ? "gameplay.sqlite" : "no-dlc.sqlite");
    fs.copyFileSync(source, copy);
    const run = (script) => execFileSync("sqlite3", [copy], { input: script, encoding: "utf8" });
    const age = run("SELECT AgeType FROM StartingGovernments LIMIT 1;").trim();
    const ageName = { AGE_ANTIQUITY: "Antiquity", AGE_EXPLORATION: "Exploration", AGE_MODERN: "Modern" }[age];
    assert.ok(ageName, `age of the database: ${age}`);
    // The base game's own CultureSlotAllowances key is malformed, so the removal runs with keys off; the tables'
    // delete triggers still take the child rows.
    if (!withDlc) run(`PRAGMA foreign_keys=OFF; DELETE FROM AiLists WHERE LeaderType IN (${dlcTraits});
      DELETE FROM Traits WHERE TraitType IN (${dlcTraits});`);
    const others = "SELECT COUNT(*) || ' ' || TOTAL(f.Value) FROM AiFavoredItems f JOIN AiLists l USING (ListType) WHERE l.System <> 'GovernmentBiases';";
    const before = run(others);
    run(`PRAGMA foreign_keys=ON;\n${sql}`);
    for (const table of ["AiListTypes", "AiLists", "AiFavoredItems"]) {
      assert.equal(run(`PRAGMA foreign_key_check(${table});`).trim(), "", `${ageName}, ${withDlc ? "every DLC" : "no DLC"}: ${table}`);
    }
    assert.equal(run(others), before, "other systems' items untouched");
    assert.equal(run("SELECT COUNT(*) FROM AiLists WHERE ListType LIKE 'Economics %' AND LeaderType NOT IN (SELECT TraitType FROM Traits);").trim(), "0");
    const present = new Set(run("SELECT TraitType FROM Traits;").trim().split("\n"));
    const mine = civs.filter((c) => c.age === ageName && present.has(c.trait));
    if (!withDlc) assert.equal(mine.filter((c) => c.dlc !== "base").length, 0, "the DLC civilizations are gone");
    for (const civ of mine) {
      const items = run(`SELECT f.Item || ' ' || f.Value FROM AiLists l JOIN AiFavoredItems f USING (ListType)
        WHERE l.LeaderType = '${civ.trait}' AND l.System = 'GovernmentBiases';`).trim().split("\n");
      assert.deepEqual(items, [`${civ.gov} ${VALUE}`], `${ageName}: ${civ.name}`);
    }
    t.diagnostic(`${ageName}, ${withDlc ? "every DLC" : "no DLC"}: ${mine.length} civilizations on the table's government`);
  }
});
