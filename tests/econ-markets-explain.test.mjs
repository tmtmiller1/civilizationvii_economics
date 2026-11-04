// The Markets tab explains itself (Part 6 of the hard-times plan): each target's factors multiply to the target the
// batch used, the markets envelope keeps targets and the turns a cause moved them (and still loads a save from before),
// a pressed row opens to the breakdown, what it means for you and what moves it, and the chart marks the turns.
import test from "node:test";
import assert from "node:assert/strict";
import { byClass, installFakeDom, textOf } from "./_fake-dom.mjs";
import { civ, input, OPEN_ALL } from "./_fixtures.mjs";
import { nextPrices, priceFactors, targetPriceCents } from "../ui/econ-prices.js";
import { emptyMarkets, loadMarkets, MAX_MARKS, MARKETS_MAX_BYTES, recordBasis, saveMarkets }
  from "../ui/econ-markets.js";
import { resourceBills } from "../ui/econ-view-commerce.js";
import { emptyLedger } from "../ui/econ-state.js";
import { utf8Bytes } from "../ui/econ-state.js";

installFakeDom();
const { renderMarkets, breakdownText } = await import("../ui/econ-view-markets.js");

const IRON = { type: "RESOURCE_IRON", class: "RESOURCECLASS_EMPIRE" };
const OIL = { type: "RESOURCE_OIL", class: "RESOURCECLASS_FACTORY" };

test("the factors multiply to the batch's target, with the inputs each was read from", () => {
  for (const [res, q] of [[IRON, { civs: 6, copies: 4, strategic: true, war: true, industry: 0, eBp: 9500 }],
    [OIL, { civs: 8, copies: 20, strategic: false, war: true, industry: 17.6, eBp: 10700 }],
    [{ type: "X", class: "RESOURCECLASS_ODD" }, { civs: 3, copies: 0, strategic: false, war: false, industry: 0 }]]) {
    const f = priceFactors(res, q);
    assert.equal(f.targetCents, targetPriceCents(res, q));
    assert.equal(f.targetCents, Math.round((f.baseCents * f.scarcityPct * f.demandPct * f.eBp) / 1e8));
  }
  const f = priceFactors(OIL, { civs: 8, copies: 20, strategic: false, war: true, industry: 17.6, eBp: 10000 });
  assert.equal(f.war, false, "a war only counts for a resource units use");
  assert.equal(f.industry, 17, "the Industry count the demand used");
  const next = nextPrices({ market: { resources: [IRON], copies: { RESOURCE_IRON: 4 }, strategic: [], industry: 0 },
    previous: emptyMarkets(), civs: 6, war: false });
  assert.equal(next.targets.RESOURCE_IRON, next.prices.RESOURCE_IRON, "a first price starts at its target");
});

/** One batch's record, as marketStep makes it. */
function step(markets, turn, { copies = 4, war = false, eBp = 10000, industry = 0, pricePct = 0 } = {}) {
  const market = { resources: [IRON, OIL], copies: { RESOURCE_IRON: copies, RESOURCE_OIL: 3 },
    strategic: ["RESOURCE_IRON"], industry };
  const next = nextPrices({ market, previous: markets, civs: 6, war, eBp });
  markets.prices = Object.fromEntries(Object.entries(next.prices).map(([k, v]) => [k, Math.round(v * (100 + pricePct)
    / 100)]));
  markets.history = next.history;
  markets.lastTurn = turn;
  recordBasis(markets, { turn, market, civs: 6, war, eBp, smoothingPct: 80, pricePct, raw: next.prices,
    targets: next.targets });
  return markets;
}

test("the envelope keeps targets beside the prices, marks each cause once, and loads a save from before", () => {
  const m = emptyMarkets();
  step(m, 10);
  assert.deepEqual(m.marks, [], "the first batch has nothing to compare with");
  step(m, 11, { copies: 6, war: true, eBp: 11000, industry: 3 });
  assert.deepEqual(m.marks.map((x) => x.k).sort(), ["gain", "industry", "phase", "war"]);
  assert.deepEqual(m.marks.find((x) => x.k === "gain"), { t: 11, k: "gain", r: "RESOURCE_IRON", d: 2 });
  assert.equal(m.marks.find((x) => x.k === "phase")?.p, "boom");
  step(m, 12, { copies: 6, war: true, eBp: 11000, industry: 3 });
  assert.equal(m.marks.length, 4, "a turn with no change adds no mark");
  assert.equal(m.targets.RESOURCE_IRON.length, m.history.RESOURCE_IRON.length, "one target per price");
  const back = loadMarkets(saveMarkets(m)).markets;
  assert.equal(saveMarkets(back), saveMarkets(m), "save(load(x)) is a fixed point");
  assert.deepEqual(back.basis, m.basis);
  // A save from before Part 6: no targets, no basis, no marks.
  const old = loadMarkets(JSON.stringify({ mod: "tower-economics-markets", v: 1, markets: { prices: { A: 5 },
    history: { A: [5] } } })).markets;
  assert.deepEqual([old.targets, old.basis, old.marks], [{}, null, []]);
  step(old, 20);
  assert.ok(old.basis && old.marks.length === 0, "it fills in from its next batch");
  // Marks older than the history's turns go, and there's a ceiling.
  for (let t = 13; t < 13 + 40; t += 1) step(m, t, { copies: t % 2 ? 6 : 7 });
  assert.ok(m.marks.every((x) => x.t > 52 - 30) && m.marks.length <= MAX_MARKS);
});

test("a large market stays inside the envelope with its targets and marks", () => {
  const m = emptyMarkets();
  const resources = Array.from({ length: 60 }, (_, k) => ({ type: `RESOURCE_TEST_${k}`, class: "RESOURCECLASS_CITY" }));
  for (let t = 1; t <= 40; t += 1) {
    const market = { resources, copies: Object.fromEntries(resources.map((r, k) => [r.type, (k + t) % 9])),
      strategic: [], industry: t };
    const next = nextPrices({ market, previous: m, civs: 10, war: t % 3 === 0, eBp: 9000 + t * 50 });
    Object.assign(m, { prices: next.prices, history: next.history, lastTurn: t });
    recordBasis(m, { turn: t, market, civs: 10, war: t % 3 === 0, eBp: 9000 + t * 50, smoothingPct: 80, pricePct: 0,
      raw: next.prices, targets: next.targets });
  }
  const text = saveMarkets(m);
  const bytes = utf8Bytes(text);
  assert.ok(bytes <= MARKETS_MAX_BYTES, `${bytes} bytes`);
  const targetsBytes = utf8Bytes(JSON.stringify(m.targets)) + utf8Bytes(JSON.stringify(m.basis))
    + utf8Bytes(JSON.stringify(m.marks));
  const part = (x) => utf8Bytes(JSON.stringify(x));
  console.log(`markets envelope, 60 resources over 40 turns: ${bytes} bytes, of which Part 6 ${targetsBytes} `
    + `(targets ${part(m.targets)}, basis ${part(m.basis)}, ${m.marks.length} marks ${part(m.marks)})`);
});

const ME = 2;
/** The player imports iron from 6 and sells iron to 8; a basis from the last batch. */
function world(over = {}) {
  const markets = step(step(emptyMarkets(), 48), 49, { copies: 6, war: true });
  const civs = [civ(ME, { human: true, incomeCents: 10000, stages: OPEN_ALL }),
    civ(6, { incomeCents: 2000, stages: OPEN_ALL }), civ(8, { incomeCents: 2000, stages: OPEN_ALL })];
  return input({ civs, markets, ledger: { ...emptyLedger(), lastTurn: 49 },
    relations: [{ a: ME, b: 6, level: "war" }],
    routes: [{ importer: ME, exporter: 6, resources: ["RESOURCE_IRON"] },
      { importer: 8, exporter: ME, resources: ["RESOURCE_IRON", "RESOURCE_IRON"] }],
    market: { resources: [IRON, OIL], copies: { RESOURCE_IRON: 6, RESOURCE_OIL: 3 }, strategic: ["RESOURCE_IRON"],
      industry: 0 }, options: { markets: true, tariffs: true }, ...over });
}

function api(planInput) {
  return { me: ME, input: () => planInput, loc: (key, ...args) => [key, ...args].join("|"),
    nameOf: (p) => `Civ ${p}`, rerender: () => {}, resourceName: (t) => `name:${t}`,
    turnLabel: (t) => t, stageOpener: () => null, stageTurns: () => ({}) };
}

test("what one resource adds to each bill: owed to a partner, owed by one, or not traded", () => {
  const w = world();
  const bills = resourceBills(w, ME, "RESOURCE_IRON");
  assert.deepEqual(bills.map((b) => b.partner), [6, 8]);
  assert.ok(bills[0].youOweCents > 0 && bills[0].theyOweCents === 0, "imports from 6");
  assert.ok(bills[1].theyOweCents > bills[0].youOweCents, "8 imports two copies");
  assert.deepEqual(resourceBills(w, ME, "RESOURCE_OIL"), []);
});

test("a pressed row opens to the breakdown, what it means for you, what moves it and a marked chart", () => {
  const w = world();
  const a = api(w);
  const host = document.createElement("div");
  renderMarkets(host, a);
  assert.ok(textOf(host).includes("LOC_ECONOMICS_MARKETS_INTRO"), "the opening line");
  assert.ok(textOf(host).includes("LOC_ECONOMICS_SOURCE_ECON"), "the prices are labelled Economics'");
  assert.equal(byClass(host, "econ-market-line").length, 0, "rows start closed");
  const heads = byClass(host, "econ-expand-head");
  assert.equal(heads.length, 2, "every resource opens on press");
  heads.find((h) => textOf(h).includes("name:RESOURCE_IRON")).click();
  const open = document.createElement("div");
  renderMarkets(open, a);
  const lines = byClass(open, "econ-market-line").map((n) => n._text);
  console.log(`opened row:\n  ${lines.join("\n  ")}`);
  const target = w.markets.targets.RESOURCE_IRON.at(-1);
  assert.ok(lines[0].startsWith(`LOC_ECONOMICS_MARKETS_TARGET|${target / 100}|`), lines[0]);
  assert.ok(lines[0].includes("LOC_ECONOMICS_MARKETS_F_SCARCE|1.00") === false);
  assert.ok(lines[0].includes("LOC_ECONOMICS_MARKETS_F_DEMAND|1.50|LOC_ECONOMICS_MARKETS_CAUSE_UNITS, "
    + "LOC_ECONOMICS_MARKETS_CAUSE_WAR"), "demand names units and the war");
  assert.ok(lines.some((l) => l.startsWith("LOC_ECONOMICS_MARKETS_YOU_PAY|") && l.endsWith("|Civ 6")));
  assert.ok(lines.some((l) => l.startsWith("LOC_ECONOMICS_MARKETS_YOU_GET|") && l.endsWith("|Civ 8")));
  assert.ok(lines.includes("LOC_ECONOMICS_MARKETS_LEVER_WAR"), "iron is strategic: the war lever shows");
  assert.ok(!lines.includes("LOC_ECONOMICS_MARKETS_LEVER_INDUSTRY"), "iron isn't a Factory resource");
  const readouts = byClass(open, "econ-chart-hit").map((n) => n.getAttribute("data-tooltip-content"));
  assert.ok(readouts.some((t) => t.includes("LOC_ECONOMICS_MARKETS_MARK_GAIN|2")
    && t.includes("LOC_ECONOMICS_MARKETS_MARK_WAR")), "the marked turn names its causes");
  assert.ok(open.all().some((n) => n.getAttribute?.("class") === "econ-chart-mark"), "a mark is drawn");
});

test("the breakdown names crisis lifts and floors, and waits for a batch on an old save", () => {
  const w = world();
  w.markets.basis = { ...w.markets.basis, pricePct: 6, floored: ["RESOURCE_IRON"] };
  w.ledger = { ...w.ledger, crisis: undefined };
  const item = { type: "RESOURCE_IRON", class: "RESOURCECLASS_EMPIRE", priceCents: 500, holders: 6, history: [],
    changeCents: 0 };
  const lines = breakdownText(item, w, w.markets.basis, api(w));
  assert.ok(lines.some((l) => l.startsWith("LOC_ECONOMICS_MARKETS_CRISIS|6|")));
  assert.ok(lines.includes("LOC_ECONOMICS_MARKETS_FLOOR"));
  const old = world();
  old.markets.basis = null;
  const host = document.createElement("div");
  renderMarkets(host, api(old));
  assert.ok(textOf(host).includes("LOC_ECONOMICS_MARKETS_NO_BASIS"), "the opened iron row from the last test");
});
