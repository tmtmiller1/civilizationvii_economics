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
// A compiled database holds every age's trees but only its own age's governments, so the age is read from those.
const dbAge = (run) => run("SELECT AgeType FROM StartingGovernments LIMIT 1;").trim();
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

test("the effects file: flat yield modifiers on every settlement, War Levy's second pair behind a war requirement, the slot on its own", () => {
  assert.equal((effects.match(/effect="EFFECT_CITY_ADJUST_YIELD"/g) || []).length, 8);
  assert.equal((effects.match(/type="REQUIREMENT_PLAYER_HAS_X_WARS"/g) || []).length, 2);
  assert.equal(/name="Percent"/.test(effects), false, "the cards are flat amounts, never percentages");
  assert.match(effects, /id="MOD_ECONOMICS_TAX_SLOT" collection="COLLECTION_OWNER" effect="EFFECT_PLAYER_GRANT_TRADITION_SLOTS"/);
  // The yield's own Amount sits after any requirements block; a requirement's Amount is something else (War Levy's
  // is how many wars, and stays 1).
  const ownAmount = (id) => {
    const block = (effects.match(new RegExp(`<Modifier id="${id}"[\\s\\S]*?</Modifier>`)) || [""])[0];
    const body = block.replace(/<OwnerRequirements>[\s\S]*?<\/OwnerRequirements>/, "");
    return Number((body.match(/<Argument name="Amount">(-?\d+)<\/Argument>/) || [])[1]);
  };
  const gated = (id) => /REQUIREMENT_PLAYER_HAS_X_WARS/.test((effects.match(new RegExp(`<Modifier id="${id}"[\\s\\S]*?</Modifier>`)) || [""])[0]);
  for (const [level, card] of Object.entries(CARD_LEVELS)) {
    assert.equal(ownAmount(`MOD_ECONOMICS_${level}_GOLD`), card.gold, `${level} gold`);
    assert.equal(ownAmount(`MOD_ECONOMICS_${level}_HAPPINESS`), card.happiness, `${level} happiness`);
    assert.equal(gated(`MOD_ECONOMICS_${level}_GOLD`) || gated(`MOD_ECONOMICS_${level}_HAPPINESS`), false,
      `${level}'s first pair pays in peace`);
    if (!card.atWar) continue;
    assert.equal(ownAmount(`MOD_ECONOMICS_${level}_AT_WAR_GOLD`), card.atWar.gold, `${level} gold at war`);
    assert.equal(ownAmount(`MOD_ECONOMICS_${level}_AT_WAR_HAPPINESS`), card.atWar.happiness, `${level} happiness at war`);
    assert.ok(gated(`MOD_ECONOMICS_${level}_AT_WAR_GOLD`) && gated(`MOD_ECONOMICS_${level}_AT_WAR_HAPPINESS`),
      `${level}'s second pair needs a war`);
  }
  for (const [name, [, suffix]] of Object.entries(AGES)) {
    const xml = read(`data/econ-tax-cards-${name}.xml`);
    for (const id of ["GOLD", "HAPPINESS", "AT_WAR_GOLD", "AT_WAR_HAPPINESS"]) {
      assert.ok(xml.includes(`TraditionType="TRADITION_ECONOMICS_WAR_LEVY_${suffix}" ModifierId="MOD_ECONOMICS_WAR_LEVY_${id}"`),
        `${name}: War Levy carries ${id}`);
    }
  }
  for (const m of effects.matchAll(/type="REQUIREMENT_PLAYER_HAS_X_WARS">[\s\S]*?<Argument name="Amount">(-?\d+)</g)) {
    assert.equal(m[1], "1", "War Levy needs one war, whatever its yields are");
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
    assert.match(syncDescriptions('Tag="LOC_ECONOMICS_CARD_WAR_LEVY_DESCRIPTION"><Text>1 Gold and 1 Happiness. At war, 1 Gold and 1 Happiness.</Text>'),
      /<Text>\+2 Gold and -1 Happiness\. At war, \+8 Gold and -4 Happiness\.<\/Text>/,
      "War Levy's text names the peacetime part first and the at-war totals second");
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
  const age = dbAge(run);
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

test("Military Aid's initiator pays: the modifier pays what the target gets, behind Foreign investment, through parents", (t) => {
  const xml = read("data/econ-investment-gameeffects.xml");
  const invest = read("data/econ-investment-diplomacy.sql");
  assert.match(xml, /id="MOD_ECONOMICS_MILAID_PAY_GOLD"[\s\S]*?type="ScaleByGameAge" extra="100">-2</, "-2 a turn, scaled by age");
  assert.match(xml, /id="MOD_ECONOMICS_MILAID_INITIATOR_PAYS"[\s\S]*?InitialPlayerAccept">MOD_ECONOMICS_MILAID_PAY_GOLD</);
  assert.match(xml, /TargetPlayerAccept">MOD_ECONOMICS_MILAID_NO_EFFECT</, "the target keeps only the game's own +2");
  assert.match(invest, /INSERT OR IGNORE INTO EnterStageModifiers \(StageType, ModifierId\)\s+SELECT/);
  assert.match(invest, /FROM DiplomaticActionStages s, Modifiers m/);
  const group = (modinfo.match(/<ActionGroup id="economics-investment"[\s\S]*?<\/ActionGroup>/) || [""])[0];
  assert.match(group, /criteria="investment-on"[\s\S]*econ-investment-gameeffects\.xml[\s\S]*econ-investment-diplomacy\.sql/);
  assert.match((modinfo.match(/<Criteria id="investment-on">[\s\S]*?<\/Criteria>/) || [""])[0], /ECONOMICS_INVESTMENT_ON/);
  const source = process.env.CIV7_GAMEPLAY_DB;
  if (!source || !fs.existsSync(source)) { t.diagnostic("CIV7_GAMEPLAY_DB not set; the database check didn't run"); return; }
  const copy = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "econ-fk-")), "gameplay.sqlite");
  fs.copyFileSync(source, copy);
  const run = (script) => execFileSync("sqlite3", [copy], { input: script, encoding: "utf8" });
  run(`PRAGMA foreign_keys=OFF; DELETE FROM EnterStageModifiers WHERE ModifierId LIKE 'MOD_ECON%';
    INSERT INTO Modifiers (ModifierId, ModifierType) SELECT 'MOD_ECONOMICS_MILAID_INITIATOR_PAYS', ModifierType
      FROM Modifiers WHERE ModifierId = 'PLAYER_DIPLOMACY_MILITARY_AID_COMPLETE';
    ${invest}`);
  assert.equal(run("SELECT COUNT(*) FROM EnterStageModifiers WHERE ModifierId = 'MOD_ECONOMICS_MILAID_INITIATOR_PAYS';").trim(), "1");
  assert.equal(run("PRAGMA foreign_key_check(EnterStageModifiers);").trim(), "");
  const without = path.join(path.dirname(copy), "no-milaid.sqlite");
  fs.copyFileSync(source, without);
  const runWithout = (script) => execFileSync("sqlite3", [without], { input: script, encoding: "utf8" });
  runWithout(`PRAGMA foreign_keys=OFF; DELETE FROM EnterStageModifiers WHERE StageType = 'DIPLOMACY_MILITARY_AID_COMPLETE';
    DELETE FROM DiplomaticActionStages WHERE DiplomacyActionType = 'DIPLOMACY_ACTION_MILITARY_AID'; ${invest}`);
  assert.equal(runWithout("SELECT COUNT(*) FROM EnterStageModifiers WHERE ModifierId LIKE 'MOD_ECONOMICS%';").trim(), "0",
    "no stage, no row, no failure");
});

test("the systems' tax lines: flat yields on the tax cards, each attached through its parents, behind both options", (t) => {
  const xml = read("data/econ-systems-gameeffects.xml");
  const systems = read("data/econ-systems.sql");
  const ids = [...xml.matchAll(/<Modifier id="([A-Z_]+)"/g)].map((m) => m[1]);
  assert.equal(ids.length, 19);
  assert.equal(/name="Percent"/.test(xml), false, "flat amounts, which the AI's card pass reads (P17)");
  for (const id of ids) {
    const block = (xml.match(new RegExp(`<Modifier id="${id}"[\\s\\S]*?</Modifier>`)) || [""])[0];
    assert.match(block, /REQUIREMENT_PLAYER_HAS_ACTIVE_TRADITION/, `${id} needs its card slotted`);
    assert.match(block, /effect="EFFECT_CITY_ADJUST_YIELD"/);
    assert.ok(systems.includes(`'${id}'`), `${id} is attached`);
    const card = (block.match(/TRADITION_ECONOMICS_[A-Z_]+/) || [""])[0];
    assert.ok(/_(AQ|EX|MO)$/.test(card), `${id}: ${card}`);
  }
  assert.match(xml, /MOD_ECONOMICS_SYS_AUTHORITARIANISM_WAR_LEVY_GOLD[\s\S]*?HasAnyIdeology/,
    "a Modern government's rows stand aside once an ideology decides");
  assert.match(systems, /INSERT OR IGNORE INTO GovernmentModifiers \(GovernmentType, ModifierId\)\s+SELECT/);
  assert.match(systems, /JOIN Governments g[\s\S]*JOIN Traditions t[\s\S]*JOIN Modifiers m/);
  assert.match(systems, /WHERE u\.TargetType = 'TRADITION_DIRIGISME'/, "Fascism's root found by what it unlocks");
  const group = (modinfo.match(/<ActionGroup id="economics-systems"[\s\S]*?<\/ActionGroup>/) || [""])[0];
  assert.match(group, /criteria="systems-on"[\s\S]*<LoadOrder>112[\s\S]*econ-systems-gameeffects\.xml[\s\S]*econ-systems\.sql/);
  const criteria = (modinfo.match(/<Criteria id="systems-on">[\s\S]*?<\/Criteria>/) || [""])[0];
  assert.match(criteria, /ECONOMICS_SYSTEMS_ON[\s\S]*ECONOMICS_TAXES_ON/);
  const source = process.env.CIV7_GAMEPLAY_DB;
  if (!source || !fs.existsSync(source)) { t.diagnostic("CIV7_GAMEPLAY_DB not set; the database check didn't run"); return; }
  const copy = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "econ-sys-")), "gameplay.sqlite");
  fs.copyFileSync(source, copy);
  const run = (script) => execFileSync("sqlite3", [copy], { input: script, encoding: "utf8" });
  const age = dbAge(run);
  const suffix = { AGE_ANTIQUITY: "AQ", AGE_EXPLORATION: "EX", AGE_MODERN: "MO" }[age];
  run(`PRAGMA foreign_keys=OFF;
    ${ids.map((id) => `INSERT INTO Modifiers (ModifierId, ModifierType) SELECT '${id}', ModifierType FROM Modifiers LIMIT 1;`).join("\n")}
    ${["LIGHT", "HEAVY", "WAR_LEVY"].map((level) => `INSERT INTO Traditions (TraditionType, Name, Description, AgeType, CultureSlotType) VALUES ('TRADITION_ECONOMICS_${level}_${suffix}', 'LOC_X', 'LOC_X', '${age}', 'POLICY_CULTURE_SLOT');`).join("\n")}
    ${systems}`);
  const attached = run("SELECT COUNT(*) FROM GovernmentModifiers WHERE ModifierId LIKE 'MOD_ECONOMICS_SYS%';").trim();
  assert.ok(Number(attached) > 0, `${age}: ${attached}`);
  for (const table of ["GovernmentModifiers", "ProgressionTreeNodeUnlocks"]) {
    assert.equal(run(`PRAGMA foreign_key_check(${table});`).trim(), "", table);
  }
  t.diagnostic(`applied to a ${age} database copy: ${attached} government rows`);
});

test("1.2 follows the macro probes: biases only in their own file, no government-only cards, no price modifier", () => {
  // M2: the AI's government pick follows its GovernmentBiases lists and ignores government modifiers, so the systems'
  // modifiers change what a system pays, and the pick is steered only by the per-civ bias rows the owner chose on
  // 2026-10-30 (data/econ-government-biases.sql, tests/econ-government-biases.test.mjs).
  // M11: a government-only card (RequiredGovernmentType) was gated right but never slotted, so none ships. M10: a
  // negative purchase efficiency raises prices, but nothing native follows bond debt, so inflation stays script.
  const names = fs.readdirSync(path.join(ROOT, "data"));
  const files = names.map((f) => read(`data/${f}`)).join("\n");
  assert.deepEqual(names.filter((f) => /GovernmentBiases/.test(read(`data/${f}`))), ["econ-government-biases.sql"]);
  assert.equal(/RequiredGovernmentType/.test(files), false);
  assert.equal(/PURCHASE_EFFICIENCY/.test(files), false);
  assert.match(read("data/econ-systems.sql"), /INSERT OR IGNORE INTO GovernmentModifiers/);
});
