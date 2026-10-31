// The markets envelope (DESIGN 9; TEST-PLAN 12.2 econ-5): load refuses what isn't ours without throwing, save(load(x))
// is a fixed point, histories stay at 30 turns and incomes at 10, and a 12-civ, 60-resource state fits in 32 KB.
// Also the ledger's version 3 records: investments and offers survive a round trip, and a version 2 ledger loads.
import test from "node:test";
import assert from "node:assert/strict";
import { MARKETS_MAX_BYTES, cloneMarkets, emptyMarkets, isIncomeGrowing, loadMarkets, sanitizeMarkets, saveMarkets,
  withIncomes } from "../ui/econ-markets.js";
import { emptyLedger, load, save, utf8Bytes } from "../ui/econ-state.js";
import { makeInvestment } from "../ui/econ-invest.js";
import { econ5 } from "../ui/econ-invariants.js";

const full = () => {
  const markets = emptyMarkets();
  for (let r = 0; r < 60; r += 1) {
    const type = `RESOURCE_TEST_${r}`;
    markets.prices[type] = 1234 + r;
    markets.history[type] = Array.from({ length: 30 }, (_, k) => 1000 + k * 37 + r);
  }
  for (let pid = 0; pid < 12; pid += 1) {
    markets.tariffs.push({ pid, level: "high", changedTurn: 400 });
    markets.incomes[String(pid)] = Array.from({ length: 10 }, (_, k) => 12345 + k);
    markets.aidAge[String(pid)] = "AGE_MODERN";
    markets.investTurn[String(pid)] = 480;
    for (let other = 0; other < 12; other += 1) {
      if (other === pid) continue;
      markets.tariffPeace[`${pid}-${other}`] = 480;
      markets.tariffEased[`${pid}-${other}`] = "high";
    }
  }
  markets.lastTurn = 500;
  return markets;
};

test("load: empty is fine, anything foreign, newer or broken is refused without throwing", () => {
  assert.deepEqual(loadMarkets(null), { ok: true, reason: "empty", markets: emptyMarkets() });
  assert.deepEqual(loadMarkets(""), { ok: true, reason: "empty", markets: emptyMarkets() });
  assert.equal(loadMarkets("{nope").reason, "unparseable");
  assert.equal(loadMarkets(JSON.stringify({ mod: "other", v: 1 })).reason, "foreign");
  assert.equal(loadMarkets(JSON.stringify({ mod: "tower-economics-markets", v: "1" })).reason, "foreign");
  assert.equal(loadMarkets(JSON.stringify({ mod: "tower-economics-markets", v: 9 })).reason, "newer");
  assert.equal(loadMarkets(7).reason, "foreign");
  const ok = loadMarkets({ mod: "tower-economics-markets", v: 1, markets: { prices: { RESOURCE_A: 5 } } });
  assert.deepEqual([ok.ok, ok.markets.prices], [true, { RESOURCE_A: 5 }]);
});

test("sanitize keeps only well-formed rows; save(load(x)) is a fixed point", () => {
  const raw = { lastTurn: 9, prices: { RESOURCE_A: 300, bad: 1, RESOURCE_B: -1, RESOURCE_C: 2.5 },
    history: { RESOURCE_A: [1, "x", 2], lower: [1] }, tariffs: [{ pid: 1, level: "high", changedTurn: 3 },
      { pid: 1, level: "low", changedTurn: 4 }, { pid: -1, level: "low", changedTurn: 1 },
      { pid: 2, level: "max", changedTurn: 1 }, null], incomes: { 3: [1, 2], x: [1] },
    aidAge: { 3: "AGE_EXPLORATION", 4: 7, y: "AGE_MODERN" }, investTurn: { 3: 40, 4: "x" },
    tariffPeace: { "3-5": 12, "3-x": 4, "4-6": 1.5, 5: 3 }, tariffEased: { "3-5": "low", "4-6": "max", "1234-5": "high" },
    aidTurns: { "3-5": 7, "x-5": 1 } };
  const clean = sanitizeMarkets(raw);
  assert.deepEqual(clean, { lastTurn: 9, prices: { RESOURCE_A: 300 }, history: { RESOURCE_A: [1, 2] },
    tariffs: [{ pid: 1, level: "high", changedTurn: 3 }], incomes: { 3: [1, 2] }, aidAge: { 3: "AGE_EXPLORATION" },
    investTurn: { 3: 40 }, tariffPeace: { "3-5": 12 }, tariffEased: { "3-5": "low" }, aidTurns: { "3-5": 7 },
    offerTurns: {} });
  const text = saveMarkets(clean);
  assert.equal(saveMarkets(loadMarkets(text).markets), text);
  assert.deepEqual(cloneMarkets(clean), clean);
  assert.notEqual(cloneMarkets(clean).prices, clean.prices);
  assert.deepEqual(sanitizeMarkets(null), emptyMarkets());
  assert.deepEqual(sanitizeMarkets([1]), emptyMarkets());
});

test("a save from before the tariff count loads with none, and keeps its tariffs", () => {
  const old = { mod: "tower-economics-markets", v: 1, markets: { lastTurn: 140, prices: {}, history: {},
    tariffs: [{ pid: 2, level: "high", changedTurn: 11 }], incomes: {}, aidAge: {}, investTurn: {} } };
  const loaded = loadMarkets(JSON.stringify(old));
  assert.equal(loaded.ok, true);
  assert.deepEqual([loaded.markets.tariffPeace, loaded.markets.tariffEased], [{}, {}]);
  assert.deepEqual(loaded.markets.tariffs, [{ pid: 2, level: "high", changedTurn: 11 }]);
});

test("econ-5: a 12-civ, 60-resource state with full histories fits in 32 KB, and an oversized one is cut to fit", () => {
  const text = saveMarkets(full());
  assert.ok(utf8Bytes(text) <= MARKETS_MAX_BYTES, `${utf8Bytes(text)} bytes`);
  assert.deepEqual(econ5(text), []);
  assert.equal(econ5("x".repeat(MARKETS_MAX_BYTES + 1))[0].id, "econ-5");
  const big = full();
  for (let r = 60; r < 200; r += 1) {
    big.history[`RESOURCE_MORE_${r}`] = Array.from({ length: 30 }, () => 123456789);
    big.prices[`RESOURCE_MORE_${r}`] = 123456789;
  }
  const cut = saveMarkets(big);
  assert.ok(utf8Bytes(cut) <= MARKETS_MAX_BYTES);
  assert.ok(loadMarkets(cut).markets.history.RESOURCE_TEST_0.length < 30, "the histories went first");
  assert.equal(loadMarkets(cut).markets.prices.RESOURCE_MORE_199, 123456789, "prices are kept");
});

test("income marks: ten turns per living civ, and growing means above where it was ten turns ago", () => {
  const civs = [{ id: 1, alive: true, incomeCents: 500 }, { id: 2, alive: false, incomeCents: 9 }];
  let incomes = {};
  for (let k = 0; k < 12; k += 1) incomes = withIncomes(incomes, civs.map((c) => ({ ...c, incomeCents: c.incomeCents + k })));
  assert.deepEqual(incomes[1], [502, 503, 504, 505, 506, 507, 508, 509, 510, 511]);
  assert.equal(incomes[2], undefined);
  assert.equal(isIncomeGrowing(incomes, 1), true);
  assert.equal(isIncomeGrowing({ 1: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5] }, 1), false);
  assert.equal(isIncomeGrowing({ 1: [1, 9] }, 1), false, "needs ten turns");
  assert.equal(isIncomeGrowing({}, 1), false);
});

test("the ledger's version 3 records round-trip, and a version 2 ledger loads with none", () => {
  const ledger = { ...emptyLedger(), nextInvestId: 4, investments: [
    makeInvestment({ id: "I1", kind: "project", investor: 1, host: 2, principal: 3000, turn: 5, cityId: "2:7" }),
    makeInvestment({ id: "I2", kind: "general", investor: 2, host: 1, principal: 3000, turn: 5, baseIncome: 900 }),
    { id: "I3", kind: "loan", investor: 1, host: 2 }, { id: "I1", kind: "project" }],
  offers: [{ id: "I3", investor: 2, host: 1, kind: "general", cents: 500, cityId: null, turn: 6 },
    { id: "I3", investor: 2, host: 1, kind: "general", cents: 500, cityId: null, turn: 6 },
    { id: "I4", investor: 2, host: 1, kind: "bond", cents: 500, turn: 6 }] };
  const back = load(save(ledger)).ledger;
  assert.deepEqual(back.investments.map((r) => r.id), ["I1", "I2"]);
  assert.deepEqual(back.investments[0], ledger.investments[0]);
  assert.deepEqual(back.offers.map((o) => o.id), ["I3"]);
  assert.equal(back.nextInvestId, 4);
  assert.equal(save(back), save(load(save(back)).ledger), "fixed point");
  const v2 = load(JSON.stringify({ mod: "tower-economics", v: 2, ledger: { loans: [] } }));
  assert.deepEqual([v2.ok, v2.ledger.investments, v2.ledger.offers, v2.ledger.nextInvestId], [true, [], [], 1]);
  const counted = load(JSON.stringify({ mod: "tower-economics", v: 3, ledger: { nextInvestId: 1,
    investments: [ledger.investments[1]] } })).ledger;
  assert.equal(counted.nextInvestId, 3, "the counter never falls behind the records");
});
