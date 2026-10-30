// Trade settlement and tariffs (DESIGN 4.10; TEST-PLAN 12.1): the bill with its Trade-building terms, owed per pair
// with the tariff held back, netted, capped at 10% of positive income with several partners scaled evenly, the rest
// waived; the 5-turn tariff limit, the High tariff's relationship step, and the AI's matching rule.
import test from "node:test";
import assert from "node:assert/strict";
import { aiTariffWanted, canChangeTariff, capPayments, highTariffCosts, isTariffLevel, netPairs, owedByPair,
  routeBillCents, settlementCap, tariffOf, tradeBuildingPct, withTariff } from "../ui/econ-trade.js";

const prices = { RESOURCE_IRON: 1000, RESOURCE_WINE: 600, RESOURCE_SALT: 400 };
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

test("the AI matches a High tariff on its exports 2 turns after it's set, and drops back with it", () => {
  const high = [{ pid: 1, level: "high", changedTurn: 10 }];
  assert.equal(aiTariffWanted({ pid: 5, tariffs: high, importers: [1], turn: 11 }), null, "not yet");
  assert.equal(aiTariffWanted({ pid: 5, tariffs: high, importers: [1], turn: 12 }), "high");
  assert.equal(aiTariffWanted({ pid: 5, tariffs: high, importers: [2], turn: 12 }), null, "only those who import from it");
  const both = [...high, { pid: 5, level: "high", changedTurn: 12 }];
  assert.equal(aiTariffWanted({ pid: 5, tariffs: both, importers: [1], turn: 20 }), null, "already matched");
  const dropped = [{ pid: 1, level: "none", changedTurn: 18 }, { pid: 5, level: "high", changedTurn: 12 }];
  assert.equal(aiTariffWanted({ pid: 5, tariffs: dropped, importers: [1], turn: 19 }), "none");
  const low = [{ pid: 1, level: "low", changedTurn: 0 }];
  assert.equal(aiTariffWanted({ pid: 5, tariffs: low, importers: [1], turn: 30 }), null, "a Low tariff isn't matched");
  assert.equal(aiTariffWanted({ pid: 5, tariffs: [], importers: [], turn: 30 }), null);
});
