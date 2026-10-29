import test from "node:test";
import assert from "node:assert/strict";
import { installFakeEngine, removeFakeEngine } from "./_fake-engine.mjs";
import { pickCards, readCards, readFiscal, swapTo } from "../ui/econ-fiscal.js";
import { levelOf } from "../ui/econ-tax-cards.js";

const traditions = [
  { TraditionType: "TRADITION_ECONOMICS_LIGHT_EX", $hash: 101, $index: 1 },
  { TraditionType: "TRADITION_ECONOMICS_HEAVY_EX", $hash: 102, $index: 2 },
  { TraditionType: "TRADITION_ECONOMICS_WAR_LEVY_EX", $hash: 103, $index: 3 },
  { TraditionType: "TRADITION_MARITIME_LAW", $hash: 9, $index: 9 },
];

test("the card level comes from the type name; other traditions are not cards", () => {
  assert.equal(levelOf("TRADITION_ECONOMICS_WAR_LEVY_MO"), "WAR_LEVY");
  assert.equal(levelOf("TRADITION_ECONOMICS_LIGHT_AQ"), "LIGHT");
  assert.equal(levelOf("TRADITION_MARITIME_LAW"), null);
  assert.equal(levelOf("TRADITION_ECONOMICS_ODD_EX"), null);
});

test("the cards are read from this age's Traditions with active and unlocked flags", () => {
  installFakeEngine({ traditions, civs: [{ id: 0, human: true, active: [102], unlocked: [101, 102] }] });
  const cards = readCards(0);
  assert.deepEqual(cards.map((c) => [c.level, c.active, c.unlocked]), [["LIGHT", false, true], ["HEAVY", true, true],
    ["WAR_LEVY", false, false]]);
  removeFakeEngine();
});

test("pickCards: unknown, same, or the pair to leave and take", () => {
  const cards = readCards(0);
  assert.equal(pickCards([], "TRADITION_ECONOMICS_LIGHT_EX").verdict, "unknown");
  installFakeEngine({ traditions, civs: [{ id: 0, human: true, active: [102], unlocked: [101, 102] }] });
  const read = readCards(0);
  assert.equal(pickCards(read, "TRADITION_ECONOMICS_HEAVY_EX").verdict, "same");
  const pick = pickCards(read, "TRADITION_ECONOMICS_LIGHT_EX");
  assert.deepEqual([pick.active?.type, pick.target?.type, pick.verdict], ["TRADITION_ECONOMICS_HEAVY_EX",
    "TRADITION_ECONOMICS_LIGHT_EX", null]);
  assert.equal(pickCards(read, null).verdict, null, "clearing the active card");
  assert.equal(pickCards(cards, null).verdict, "same", "nothing active, nothing to clear");
  removeFakeEngine();
});

test("a swap with a card active is Deactivate, then after TraditionChanged, Activate; refused when the game won't swap", async () => {
  const world = installFakeEngine({ traditions, civs: [{ id: 0, human: true, active: [102], unlocked: [101, 102] }] });
  assert.equal(await swapTo("TRADITION_ECONOMICS_LIGHT_EX"), "sent");
  assert.deepEqual(world.operations.map((o) => [o.args.TraditionType, o.args.Action]), [[2, 0], [1, 1]]);
  world.operations.length = 0;
  assert.equal(await swapTo(null), "cleared");
  assert.deepEqual(world.operations.map((o) => [o.args.TraditionType, o.args.Action]), [[2, 0]]);
  world.swapAllowed = false;
  assert.equal(await swapTo("TRADITION_ECONOMICS_LIGHT_EX"), "no-swap");
  assert.equal(await swapTo("TRADITION_ECONOMICS_NOPE_EX"), "unknown");
  removeFakeEngine();
});

test("the forecast read sums the settlements' yields and reads the meter the way the policies button does", () => {
  installFakeEngine({ civs: [{ id: 0, human: true, cityYields: { gold: 23, happiness: 8 }, threshold: 150, lifetime: 109.4 }] });
  assert.deepEqual(readFiscal(0, true), { goldCents: 2300, happinessCents: 800, netHappinessCents: 200,
    celebrationLeftCents: 4000, celebrating: false, atWar: true });
  removeFakeEngine();
  installFakeEngine({ civs: [{ id: 0, human: true, celebrating: true }] });
  assert.deepEqual(readFiscal(0, false), { goldCents: 0, happinessCents: 0, netHappinessCents: 200,
    celebrationLeftCents: 10000, celebrating: true, atWar: false });
  removeFakeEngine();
  assert.equal(readFiscal(0, false).celebrationLeftCents, null, "no engine: nothing to count from");
});
