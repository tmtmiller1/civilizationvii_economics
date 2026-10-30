// The level 1 data (DESIGN 4.7, 9): the card files are well-formed and agree with the modifiers and the unlock SQL,
// each age's file carries its age, every row the SQL writes selects through a parent table, and the modinfo loads
// each file in a group gated by the Taxes option. With CIV7_GAMEPLAY_DB set to a copy of the compiled gameplay
// database, the SQL is applied to a copy and the touched tables pass a foreign-key check.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT } from "./_fs-helpers.mjs";
import { CARD_LEVELS } from "../ui/econ-tax-cards.js";
import { outOfStep, syncDescriptions, syncEffects } from "../scripts/sync-tax-cards.mjs";

const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const AGES = { antiquity: ["AGE_ANTIQUITY", "AQ"], exploration: ["AGE_EXPLORATION", "EX"], modern: ["AGE_MODERN", "MO"] };
const effects = read("data/econ-tax-gameeffects.xml");
const sql = read("data/econ-tax-cards.sql");
const modinfo = read("economics.modinfo");

test("each age's card file holds the three cards of its age, pointing at modifiers the effects file defines", () => {
  const modifierIds = new Set([...effects.matchAll(/<Modifier id="([A-Z_]+)"/g)].map((m) => m[1]));
  for (const [name, [age, suffix]] of Object.entries(AGES)) {
    const xml = read(`data/econ-tax-cards-${name}.xml`);
    const types = [...xml.matchAll(/TraditionType="(TRADITION_ECONOMICS_[A-Z_]+)" Name/g)].map((m) => m[1]);
    assert.deepEqual(types, ["LIGHT", "HEAVY", "WAR_LEVY"].map((level) => `TRADITION_ECONOMICS_${level}_${suffix}`), name);
    assert.equal((xml.match(new RegExp(`AgeType="${age}"`, "g")) || []).length, 3, `${name} AgeType`);
    assert.equal(/CultureSlotType="POLICY_CULTURE_SLOT"/.test(xml), true, "the game's own slot, never one of ours");
    for (const m of xml.matchAll(/ModifierId="([A-Z_]+)"/g)) assert.ok(modifierIds.has(m[1]), `${name}: ${m[1]}`);
    assert.equal(/EFFECT_PLAYER_GRANT_TRADITION_SLOTS/.test(xml), false, "a card never grants a slot");
  }
});

test("the effects file: flat yield modifiers on every settlement, War Levy behind a war requirement, the slot on its own", () => {
  assert.equal((effects.match(/effect="EFFECT_CITY_ADJUST_YIELD"/g) || []).length, 6);
  assert.equal((effects.match(/type="REQUIREMENT_PLAYER_HAS_X_WARS"/g) || []).length, 2);
  assert.equal(/name="Percent"/.test(effects), false, "the cards are flat amounts, never percentages");
  assert.match(effects, /id="MOD_ECONOMICS_TAX_SLOT" collection="COLLECTION_OWNER" effect="EFFECT_PLAYER_GRANT_TRADITION_SLOTS"/);
  for (const [level, card] of Object.entries(CARD_LEVELS)) {
    const block = effects.slice(effects.indexOf(`MOD_ECONOMICS_${level}_GOLD`), effects.indexOf(`MOD_ECONOMICS_${level}_HAPPINESS`) + 900);
    assert.ok(block.includes(`<Argument name="Amount">${card.gold}</Argument>`), `${level} gold`);
    assert.ok(block.includes(`<Argument name="Amount">${card.happiness}</Argument>`), `${level} happiness`);
  }
});

test("the card numbers live in CARD_LEVELS: the modifiers and every description row are in step with it", () => {
  assert.deepEqual(outOfStep().map((row) => row.file), [], "run node scripts/sync-tax-cards.mjs");
  const light = CARD_LEVELS.LIGHT;
  const saved = { ...light };
  try {
    Object.assign(light, { gold: -3, happiness: 5 });
    const moved = syncEffects(effects);
    assert.match(moved, /id="MOD_ECONOMICS_LIGHT_GOLD"[\s\S]*?<Argument name="Amount">-3<\/Argument>/);
    assert.match(moved, /id="MOD_ECONOMICS_LIGHT_HAPPINESS"[\s\S]*?<Argument name="Amount">5<\/Argument>/);
    assert.match(moved, /<!-- Light Taxation: Gold -3, Happiness \+5 in each settlement -->/);
    assert.match(moved, /id="MOD_ECONOMICS_HEAVY_GOLD"[\s\S]*?<Argument name="Amount">4<\/Argument>/, "others untouched");
    assert.match(syncDescriptions(read("text/en_us/ModText.xml")),
      /LOC_ECONOMICS_CARD_LIGHT_DESCRIPTION"><Text>-3 Gold and \+5 Happiness in each settlement\./);
    assert.match(syncDescriptions('Tag="LOC_ECONOMICS_CARD_LIGHT_DESCRIPTION"><Text>-15% Gold and +20% Happiness.</Text>'),
      /<Text>-3 Gold and \+5 Happiness\.<\/Text>/, "the old percentage text moves to the flat form");
  } finally {
    Object.assign(light, saved);
  }
});

test("the SQL selects every row through a parent table and names only the cards the XML defines", () => {
  const statements = sql.split(";").map((s) => s.replace(/--[^\n]*/g, "").trim()).filter(Boolean);
  for (const statement of statements) {
    if (/INSERT OR IGNORE INTO (AiListTypes|Strategies) /.test(statement)) continue;
    assert.match(statement, /INSERT OR IGNORE INTO [A-Za-z_]+ \([^)]*\)\s+SELECT/, statement.slice(0, 60));
  }
  const named = new Set([...sql.matchAll(/TRADITION_ECONOMICS_[A-Z_]+/g)].map((m) => m[0]));
  const defined = new Set(Object.keys(AGES).flatMap((name) => [...read(`data/econ-tax-cards-${name}.xml`)
    .matchAll(/TraditionType="(TRADITION_ECONOMICS_[A-Z_]+)" Name/g)].map((m) => m[1])));
  assert.deepEqual([...named].filter((t) => !defined.has(t)), []);
  assert.match(sql, /NOT IN \(SELECT Node FROM ProgressionTreePrereqs\)/, "root civics are found, not named");
  assert.match(sql, /TargetType = 'BUILDING_MARKET'/, "War Levy follows the Coinage anchor's node");
  assert.match(sql, /'YIELD_GOLD', 1, 300 FROM/, "the Short of Gold bias at the size the P17 arms point to");
});

test("the modinfo loads the effects behind the Taxes option, each age's cards behind the option and its age, in order", () => {
  const group = (id) => (modinfo.match(new RegExp(`<ActionGroup id="${id}"[\\s\\S]*?</ActionGroup>`)) || [""])[0];
  assert.match(group("economics-tax-effects"), /criteria="taxes-on"[\s\S]*econ-tax-gameeffects\.xml/);
  for (const name of Object.keys(AGES)) {
    const g = group(`economics-tax-cards-${name}`);
    assert.match(g, new RegExp(`criteria="taxes-on-${name}"`));
    assert.ok(g.indexOf(`econ-tax-cards-${name}.xml`) < g.indexOf("econ-tax-cards.sql"), `${name}: cards before unlocks`);
    const criteria = (modinfo.match(new RegExp(`<Criteria id="taxes-on-${name}">[\\s\\S]*?</Criteria>`)) || [""])[0];
    assert.match(criteria, /ECONOMICS_TAXES_ON/);
    assert.match(criteria, new RegExp(`<AgeInUse>${AGES[name][0]}</AgeInUse>`));
  }
  assert.match(group("economics-game"), /econ-notifications\.xml/);
});

test("against a compiled gameplay database copy, the SQL applies and the touched tables keep their foreign keys", (t) => {
  const source = process.env.CIV7_GAMEPLAY_DB;
  if (!source || !fs.existsSync(source)) { t.diagnostic("CIV7_GAMEPLAY_DB not set; the database check didn't run"); return; }
  const copy = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "econ-fk-")), "gameplay.sqlite");
  fs.copyFileSync(source, copy);
  const run = (script) => execFileSync("sqlite3", [copy], { input: script, encoding: "utf8" });
  const age = run("SELECT AgeType FROM Ages WHERE ChronologyIndex = (SELECT MAX(ChronologyIndex) FROM ProgressionTrees pt JOIN Ages a ON a.AgeType = pt.AgeType WHERE pt.SystemType = 'SYSTEM_CULTURE');").trim();
  const suffix = { AGE_ANTIQUITY: "AQ", AGE_EXPLORATION: "EX", AGE_MODERN: "MO" }[age];
  assert.ok(suffix, `age of the database: ${age}`);
  // The card rows as the XML would compile them (the XML itself needs the game's compiler), then the SQL.
  run(`PRAGMA foreign_keys=OFF;
    INSERT INTO Modifiers (ModifierId, ModifierType) VALUES ('MOD_ECONOMICS_TAX_SLOT', 'MOD_TOT_TRADITION_SLOT_TYPE');
    ${["LIGHT", "HEAVY", "WAR_LEVY"].map((level) => `INSERT INTO Traditions (TraditionType, Name, Description, AgeType, CultureSlotType) VALUES ('TRADITION_ECONOMICS_${level}_${suffix}', 'LOC_X', 'LOC_X', '${age}', 'POLICY_CULTURE_SLOT');`).join("\n")}
    ${sql}`);
  const unlocks = run("SELECT ProgressionTreeNodeType || ' ' || TargetType FROM ProgressionTreeNodeUnlocks WHERE TargetType LIKE '%ECONOMICS%' ORDER BY 1;").trim().split("\n");
  assert.ok(unlocks.length >= 4, unlocks.join(", "));
  assert.equal(unlocks.filter((row) => row.endsWith("MOD_ECONOMICS_TAX_SLOT")).length, 1, "the slot once per age");
  const strategies = run("SELECT COUNT(*) FROM Strategy_Priorities WHERE StrategyType LIKE 'STRATEGY_ECONOMICS%';").trim();
  assert.equal(strategies, "2");
  for (const table of ["ProgressionTreeNodeUnlocks", "Strategies", "StrategyConditions", "Strategy_Priorities", "AiLists",
    "AiFavoredItems", "Modifiers"]) {
    assert.equal(run(`PRAGMA foreign_key_check(${table});`).trim(), "", table);
  }
  t.diagnostic(`applied to a ${age} database copy: ${unlocks.length} unlock rows`);
});
