// Trade settlement and tariffs (DESIGN 4.10; TEST-PLAN 12.1): the bill with its Trade-building terms, owed per pair
// with the tariff held back, netted, capped at 10% of positive income with several partners scaled evenly, the rest
// waived; the 5-turn tariff limit, the High tariff's relationship step, the AI's matching rule, and the AI coming back
// down after 20 turns at peace or at once when Friendly.
import test from "node:test";
import assert from "node:assert/strict";
import { aiOwnTariff, aiTariffStep, aiTariffWanted, canChangeTariff, easeTariffs, capPayments, highTariffCosts, isTariffLevel, netPairs, owedByPair,
  routeBillCents, settlementCap, tariffOf, tradeBuildingPct, withTariff } from "../ui/econ-trade.js";

// Prices 20 times a real copy's, so the bills read as round figures at the 2.5% share (DESIGN 4.10).
const prices = { RESOURCE_IRON: 20000, RESOURCE_WINE: 12000, RESOURCE_SALT: 8000 };
const route = (importer, exporter, resources, over = {}) => ({ importer, exporter, resources, ...over });

test("tariff levels and every civ starting at None", () => {
  assert.equal(isTariffLevel("none"), true);
  assert.equal(isTariffLevel("low"), true);
  assert.equal(isTariffLevel("high"), true);
  assert.equal(isTariffLevel("max"), false);
  assert.equal(isTariffLevel(undefined), false);
  assert.equal(tariffOf([], 3), "none");
  assert.equal(tariffOf([{ pid: 3, level: "low", changedTurn: 1 }], 3), "low");
  assert.equal(tariffOf([{ pid: 4, level: "low", changedTurn: 1 }], 3), "none");
});

test("Trade buildings move the bill 10% each, 30% at most per side", () => {
  assert.equal(tradeBuildingPct(0), 0);
  assert.equal(tradeBuildingPct(1), 10);
  assert.equal(tradeBuildingPct(3), 30);
  assert.equal(tradeBuildingPct(7), 30);
  assert.equal(tradeBuildingPct(undefined), 0);
  assert.equal(tradeBuildingPct(-2), 0);
  assert.equal(tradeBuildingPct(1.8), 10);
});

test("the bill is half the summed prices, up for the exporter's Trade buildings, down for the importer's", () => {
  assert.equal(routeBillCents(route(1, 2, ["RESOURCE_IRON", "RESOURCE_WINE"]), prices), 800);
  assert.equal(routeBillCents(route(1, 2, ["RESOURCE_IRON"], { exporterTradeBuildings: 2 }), prices), 600);
  assert.equal(routeBillCents(route(1, 2, ["RESOURCE_IRON"], { importerTradeBuildings: 1 }), prices), 450);
  assert.equal(routeBillCents(route(1, 2, ["RESOURCE_IRON"], { exporterTradeBuildings: 1, importerTradeBuildings: 1 }),
    prices), 495);
  assert.equal(routeBillCents(route(1, 2, ["RESOURCE_GONE"]), prices), 0, "an unpriced resource is worth nothing");
  assert.equal(routeBillCents(route(1, 2, []), prices), 0);
  assert.equal(routeBillCents({ importer: 1, exporter: 2 }, prices), 0);
});

test("owed per ordered pair, the importer's tariff held back, routes to self or outsiders skipped", () => {
  const civIds = new Set([1, 2, 3]);
  const routes = [route(1, 2, ["RESOURCE_IRON"]), route(1, 2, ["RESOURCE_WINE"]), route(2, 1, ["RESOURCE_SALT"]),
    route(1, 1, ["RESOURCE_IRON"]), route(3, 9, ["RESOURCE_IRON"]), route(9, 3, ["RESOURCE_IRON"])];
  const tariffs = [{ pid: 1, level: "high", changedTurn: 0 }, { pid: 2, level: "low", changedTurn: 0 }];
  const owed = owedByPair({ routes, prices, tariffs, civIds, tariffsOn: true });
  assert.deepEqual(owed, [{ importer: 1, exporter: 2, gross: 800, owed: 600 },
    { importer: 2, exporter: 1, gross: 200, owed: 180 }]);
  const off = owedByPair({ routes, prices, tariffs, civIds, tariffsOn: false });
  assert.deepEqual(off.map((row) => row.owed), [800, 200], "Tariffs Off: the full bill");
});

test("netting: the side with the positive figure pays the difference; a pair that nets to 0 drops out", () => {
  assert.deepEqual(netPairs([{ importer: 1, exporter: 2, owed: 600 }, { importer: 2, exporter: 1, owed: 180 }]),
    [{ payer: 1, payee: 2, cents: 420 }]);
  assert.deepEqual(netPairs([{ importer: 5, exporter: 2, owed: 100 }, { importer: 2, exporter: 5, owed: 300 }]),
    [{ payer: 2, payee: 5, cents: 200 }]);
  assert.deepEqual(netPairs([{ importer: 1, exporter: 2, owed: 300 }, { importer: 2, exporter: 1, owed: 300 }]), []);
  assert.deepEqual(netPairs([{ importer: 3, exporter: 1, owed: 50 }, { importer: 1, exporter: 2, owed: 70 }]),
    [{ payer: 1, payee: 2, cents: 70 }, { payer: 3, payee: 1, cents: 50 }], "sorted by payer, then payee");
  assert.deepEqual(netPairs([]), []);
});

test("the cap: 10% of positive income, several partners scaled down evenly, the rest waived", () => {
  assert.equal(settlementCap(10000), 1000);
  assert.equal(settlementCap(0), 0);
  assert.equal(settlementCap(-500), 0);
  assert.equal(settlementCap(999), 99);
  const income = (pid) => ({ 1: 10000, 2: 0, 3: 5000 })[pid] ?? 0;
  const paid = capPayments([{ payer: 1, payee: 2, cents: 900 }, { payer: 1, payee: 3, cents: 600 },
    { payer: 2, payee: 3, cents: 50 }, { payer: 3, payee: 4, cents: 400 }], income);
  assert.deepEqual(paid, [
    { payer: 1, payee: 2, owed: 900, cents: 600, waived: 300 },
    { payer: 1, payee: 3, owed: 600, cents: 400, waived: 200 },
    { payer: 2, payee: 3, owed: 50, cents: 0, waived: 50 },
    { payer: 3, payee: 4, owed: 400, cents: 400, waived: 0 },
  ]);
  const exact = capPayments([{ payer: 1, payee: 2, cents: 1000 }], income);
  assert.equal(exact[0].cents, 1000, "exactly at the cap pays in full");
});

test("one tariff change per 5 turns; setting one keeps the rows sorted, one per civ", () => {
  assert.equal(canChangeTariff(undefined, 3), true);
  assert.equal(canChangeTariff(10, 14), false);
  assert.equal(canChangeTariff(10, 15), true);
  const rows = withTariff([{ pid: 5, level: "low", changedTurn: 1 }], 2, "high", 9);
  assert.deepEqual(rows, [{ pid: 2, level: "high", changedTurn: 9 }, { pid: 5, level: "low", changedTurn: 1 }]);
  assert.deepEqual(withTariff(rows, 2, "none", 15), [{ pid: 2, level: "none", changedTurn: 15 },
    { pid: 5, level: "low", changedTurn: 1 }]);
});

test("a High tariff costs 1 relationship with each exporter it bills, every 5 turns it stands", () => {
  const tariffs = [{ pid: 1, level: "high", changedTurn: 10 }, { pid: 2, level: "low", changedTurn: 10 }];
  const owed = [{ importer: 1, exporter: 2, gross: 500 }, { importer: 1, exporter: 3, gross: 0 },
    { importer: 1, exporter: 4, gross: 20 }, { importer: 2, exporter: 1, gross: 500 }];
  assert.deepEqual(highTariffCosts({ tariffs, owed, turn: 10 }), [], "not on the turn it's set");
  assert.deepEqual(highTariffCosts({ tariffs, owed, turn: 13 }), []);
  assert.deepEqual(highTariffCosts({ tariffs, owed, turn: 15 }), [{ a: 1, b: 2, delta: -1 }, { a: 1, b: 4, delta: -1 }]);
  assert.deepEqual(highTariffCosts({ tariffs, owed, turn: 20 }).length, 2);
  assert.deepEqual(highTariffCosts({ tariffs, owed, turn: 21 }), []);
});

test("the AI answers a tariff on its exports in kind 2 turns after it's set, and drops back with it", () => {
  const high = [{ pid: 1, level: "high", changedTurn: 10 }];
  assert.equal(aiTariffWanted({ pid: 5, tariffs: high, importers: [1], turn: 11 }), null, "not yet");
  assert.equal(aiTariffWanted({ pid: 5, tariffs: high, importers: [1], turn: 12 }), "high");
  assert.equal(aiTariffWanted({ pid: 5, tariffs: high, importers: [2], turn: 12 }), null, "only those who import from it");
  const both = [...high, { pid: 5, level: "high", changedTurn: 12 }];
  assert.equal(aiTariffWanted({ pid: 5, tariffs: both, importers: [1], turn: 20 }), null, "already matched");
  const dropped = [{ pid: 1, level: "none", changedTurn: 18 }, { pid: 5, level: "high", changedTurn: 12 }];
  assert.equal(aiTariffWanted({ pid: 5, tariffs: dropped, importers: [1], turn: 19 }), "none");
  const low = [{ pid: 1, level: "low", changedTurn: 0 }];
  assert.equal(aiTariffWanted({ pid: 5, tariffs: low, importers: [1], turn: 30 }), "low", "Low is answered with Low");
  const eased = [{ pid: 1, level: "low", changedTurn: 29 }, { pid: 5, level: "high", changedTurn: 12 }];
  assert.equal(aiTariffWanted({ pid: 5, tariffs: eased, importers: [1], turn: 30 }), "low",
    "from High to Low at once when the other side eases");
  const raised = [{ pid: 1, level: "high", changedTurn: 29 }, { pid: 5, level: "low", changedTurn: 12 }];
  assert.equal(aiTariffWanted({ pid: 5, tariffs: raised, importers: [1], turn: 30 }), null, "a raise waits 2 turns");
  assert.equal(aiTariffWanted({ pid: 5, tariffs: [], importers: [], turn: 30 }), null);
});

test("the AI's own tariff: Low against a partner it pays and isn't Friendly with, High against an Unfriendly one", () => {
  const q = { pid: 5, tariffs: [], importers: [], turn: 30 };
  assert.equal(aiTariffWanted({ ...q, partners: [{ level: "neutral", netPayer: true }] }), "low");
  assert.equal(aiTariffWanted({ ...q, partners: [{ level: "neutral", netPayer: false }] }), null, "it's paid more");
  assert.equal(aiTariffWanted({ ...q, partners: [{ level: "friendly", netPayer: true }] }), null);
  assert.equal(aiTariffWanted({ ...q, partners: [{ level: "unfriendly", netPayer: false }] }), "high");
  assert.equal(aiTariffWanted({ ...q, partners: [{ level: "war", netPayer: false }] }), "high");
  assert.equal(aiTariffWanted({ ...q, partners: [{ level: "neutral", netPayer: true }], cheapHigh: true }), "high",
    "a Mercantile AI goes to High where another goes to Low");
  assert.equal(aiTariffWanted({ ...q, partners: [{ level: "friendly", netPayer: true }], cheapHigh: true }), null);
  assert.equal(aiTariffWanted({ ...q, tariffs: [{ pid: 1, level: "low", changedTurn: 0 }], importers: [1],
    partners: [{ level: "unfriendly", netPayer: false }] }), "high", "the higher of the answer and its own");
  const set = [{ pid: 5, level: "low", changedTurn: 20 }];
  assert.equal(aiTariffWanted({ ...q, tariffs: set, partners: [{ level: "friendly", netPayer: true }] }), "none",
    "drops back once no reason holds");
  assert.equal(aiOwnTariff([], false), "none");
});

test("a tariff falls on all its imports, so the AI weighs only partners worth a third of its trade or more", () => {
  const q = { pid: 5, tariffs: [], importers: [], turn: 30 };
  assert.equal(aiTariffWanted({ ...q, partners: [{ level: "unfriendly", netPayer: true, sharePct: 33 }] }), null);
  assert.equal(aiTariffWanted({ ...q, partners: [{ level: "unfriendly", netPayer: true, sharePct: 34 }] }), "high");
  const low = [{ pid: 1, level: "low", changedTurn: 0 }];
  assert.equal(aiTariffWanted({ ...q, tariffs: low, importers: [1], importerSharePct: () => 20 }), null,
    "a small buyer's tariff goes unanswered");
  assert.equal(aiTariffWanted({ ...q, tariffs: low, importers: [1], importerSharePct: () => 60 }), "low");
});

/**
 * One AI's tariff turn as econ-commerce.js runs it: the step, then the change when the 5-turn limit allows.
 * @param {{ tariffs: object[], easing: object }} world
 */
function aiTurn(world, pid, turn, { relation = () => "neutral", importers = [], partners = [], alive } = {}) {
  const step = aiTariffStep({ pid, tariffs: world.tariffs, importers, turn, partners, easing: world.easing,
    relationOf: relation, alive });
  world.easing = step.easing;
  const row = world.tariffs.find((r) => r.pid === pid);
  if (step.wanted && canChangeTariff(row?.changedTurn, turn)) world.tariffs = withTariff(world.tariffs, pid, step.wanted, turn);
  return step;
}
const levelIn = (world, pid) => tariffOf(world.tariffs, pid);
const fresh = (tariffs) => ({ tariffs, easing: { peace: {}, eased: {} } });

test("an AI answering a High tariff eases off after 20 turns in a row at peace, and doesn't raise again in kind", () => {
  const world = fresh([{ pid: 1, level: "high", changedTurn: 10 }]);
  const seen = {};
  for (let turn = 11; turn <= 60; turn += 1) {
    const step = aiTurn(world, 5, turn, { importers: [1] });
    seen[turn] = levelIn(world, 5);
    if (step.eased.length) seen.easedAt = turn;
  }
  assert.equal(seen[12], "high", "answered in kind 2 turns after");
  assert.equal(world.easing.peace["5-1"], undefined, "the count ends with the easing");
  assert.equal(seen.easedAt, 33, "counted from turn 13, the first turn it held the tariff");
  assert.equal(seen[32], "high");
  assert.equal(seen[33], "none", "drops back the turn it eases off");
  assert.ok(Object.keys(seen).filter((t) => Number(t) > 33).every((t) => seen[t] === "none"),
    "the other side still at High is no reason to raise again");
  assert.deepEqual(world.easing.eased, { "5-1": "high" });
});

test("war resets the count; Friendly eases off at once", () => {
  const war = fresh([{ pid: 1, level: "high", changedTurn: 10 }]);
  let eased = null;
  for (let turn = 11; turn <= 80 && eased === null; turn += 1) {
    const step = aiTurn(war, 5, turn, { importers: [1], relation: () => (turn === 25 ? "war" : "neutral") });
    if (step.eased.length) eased = turn;
  }
  assert.equal(eased, 46, "the count starts over the turn after the war");
  const friends = fresh([{ pid: 1, level: "high", changedTurn: 10 }]);
  for (let turn = 11; turn <= 19; turn += 1) aiTurn(friends, 5, turn, { importers: [1] });
  assert.equal(levelIn(friends, 5), "high");
  const step = aiTurn(friends, 5, 20, { importers: [1], relation: () => "friendly" });
  assert.deepEqual([step.eased, levelIn(friends, 5)], [[1], "none"]);
  aiTurn(friends, 5, 21, { importers: [1], relation: () => "neutral" });
  assert.equal(levelIn(friends, 5), "none", "back to Neutral, the old tariff still goes unanswered");
  const atWar = fresh([{ pid: 1, level: "high", changedTurn: 10 }, { pid: 5, level: "high", changedTurn: 12 }]);
  atWar.easing.eased["5-1"] = "high";
  aiTurn(atWar, 5, 40, { importers: [1], relation: () => "war" });
  assert.deepEqual(atWar.easing.eased, {}, "a war ends the easing");
});

test("after easing off, a new raise is answered; a lowering and the old level aren't", () => {
  const world = fresh([{ pid: 1, level: "high", changedTurn: 10 }, { pid: 5, level: "none", changedTurn: 33 }]);
  world.easing.eased["5-1"] = "high";
  world.tariffs = withTariff(world.tariffs, 1, "low", 40);
  aiTurn(world, 5, 45, { importers: [1] });
  assert.deepEqual([levelIn(world, 5), world.easing.eased["5-1"]], ["none", "low"], "Low after High isn't a raise");
  world.tariffs = withTariff(world.tariffs, 1, "high", 50);
  aiTurn(world, 5, 51, { importers: [1] });
  assert.equal(levelIn(world, 5), "none", "a raise waits 2 turns as before");
  assert.equal(world.easing.eased["5-1"], undefined, "but it ends the easing");
  aiTurn(world, 5, 52, { importers: [1] });
  assert.equal(levelIn(world, 5), "high");
});

test("two AIs in a trade war both come back down and stay down", () => {
  // Unfriendly both ways and each buying from the other: each sets High against the other and answers it in kind.
  const world = fresh([]);
  const opts = (other) => ({ importers: [other], partners: [{ pid: other, level: "unfriendly", netPayer: true }],
    relation: () => "unfriendly" });
  const both = [];
  for (let turn = 1; turn <= 120; turn += 1) {
    aiTurn(world, 1, turn, opts(5));
    aiTurn(world, 5, turn, opts(1));
    both.push([levelIn(world, 1), levelIn(world, 5)]);
  }
  assert.deepEqual(both[0], ["high", "high"]);
  assert.deepEqual(both[19], ["high", "high"], "20 turns of High first");
  const down = both.findIndex(([a, b]) => a === "none" && b === "none");
  assert.ok(down > 0 && down <= 25, `both at None by turn ${down + 1}`);
  assert.ok(both.slice(down).every(([a, b]) => a === "none" && b === "none"), "and they stay there");
  // Without the easing the same pair stays High to the end: the standoff the merged watch saw.
  let stuck = [];
  for (let turn = 1; turn <= 120; turn += 1) {
    for (const [pid, other] of [[1, 5], [5, 1]]) {
      const wanted = aiTariffWanted({ pid, tariffs: stuck, turn, ...opts(other) });
      const row = stuck.find((r) => r.pid === pid);
      if (wanted && canChangeTariff(row?.changedTurn, turn)) stuck = withTariff(stuck, pid, wanted, turn);
    }
  }
  assert.deepEqual([tariffOf(stuck, 1), tariffOf(stuck, 5)], ["high", "high"]);
});

test("easing off one civ leaves the others' reasons; a gone civ's entries go; an old save starts its count", () => {
  const world = fresh([{ pid: 1, level: "high", changedTurn: 10 }, { pid: 5, level: "high", changedTurn: 12 }]);
  world.easing.eased["5-1"] = "high";
  aiTurn(world, 5, 40, { importers: [1], partners: [{ pid: 2, level: "war", netPayer: false }],
    relation: (other) => (other === 2 ? "war" : "neutral") });
  assert.equal(levelIn(world, 5), "high", "still at war with 2");
  const gone = easeTariffs({ pid: 5, mine: "high", turn: 41, reasons: new Map(), tariffs: [],
    relationOf: () => "neutral", alive: () => false, easing: { peace: { "5-3": 30, "6-3": 30 }, eased: { "5-1": "low" } } });
  assert.deepEqual(gone.easing, { peace: { "6-3": 30 }, eased: {} }, "only this AI's entries, and only the gone civs'");
  // A ledger with a standing High from turn 11 and no count. The count starts at the first turn after loading.
  const old = fresh([{ pid: 2, level: "high", changedTurn: 11 }, { pid: 5, level: "high", changedTurn: 13 }]);
  let dropped = null;
  for (let turn = 140; turn <= 200 && dropped === null; turn += 1) {
    aiTurn(old, 5, turn, { importers: [2] });
    if (levelIn(old, 5) === "none") dropped = turn;
  }
  assert.equal(dropped, 160);
  const anon = easeTariffs({ pid: 5, mine: "low", turn: 9, reasons: new Map([["partner-0", "low"]]), tariffs: [],
    relationOf: () => "friendly", easing: { peace: {}, eased: {} } });
  assert.equal(anon.counted.get("partner-0"), "low", "a partner given without an id is never eased");
});
