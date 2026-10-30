// _balance-commerce.mjs - the 1.1 rows of DESIGN 10's balance ladder, in the Node simulation. The game's own numbers
// come from the compiled 1.5.0 database (tests/fixtures/commerce-*.json): resource classes, the Trade Income the
// engine pays an exporter per route (TradeYields), building costs, game speeds and the Gold purchase multiplier.
// A seeded 12-civ game with exogenous incomes and routes is run with Markets and trade bills On and Off from the same
// seed. Nothing here is a tuned number; the constants are DESIGN's starting points.

import { readFileSync } from "node:fs";
import { planTurn } from "../ui/econ-plan.js";
import { applyGrants, grantsFor } from "../ui/econ-conservation.js";
import { emptyMarkets, saveMarkets } from "../ui/econ-markets.js";
import { utf8Bytes } from "../ui/econ-state.js";
import { computeDepth, rolesOf } from "../ui/econ-depth.js";
import { creditCap } from "../ui/econ-credit.js";
import { civRatePpm } from "../ui/econ-lenders.js";
import { INVEST } from "../ui/econ-params.js";
import { gen } from "./_prng.mjs";
import { OPEN_ALL, PARAMS } from "./_fixtures.mjs";

export const fixture = (age) => JSON.parse(readFileSync(new URL(`./fixtures/commerce-${age}-1.5.0.json`,
  import.meta.url), "utf8"));

/** The Trade Income the engine pays an exporter for one route carrying `copies`, by domain. */
export function nativeIncome(tradeYields, domain, copies) {
  const row = tradeYields.find((r) => r.Domain === domain && r.ResourceCount === Math.min(3, copies));
  return row ? row.Amount * 100 : 0;
}

/**
 * Trade profit (DESIGN 10): one route's bill against the Trade Income the engine already pays the exporter, by class
 * and copies, at the scarcity a resource has when every civ holds a copy (1.0) and when it's scarce (2.0).
 */
export function routeProfitRows(age) {
  const data = fixture(age);
  const base = { RESOURCECLASS_BONUS: 200, RESOURCECLASS_CITY: 300, RESOURCECLASS_EMPIRE: 400,
    RESOURCECLASS_TREASURE: 500, RESOURCECLASS_FACTORY: 600 };
  const classes = [...new Set(data.resources.map((r) => r.class))].filter((c) => base[c]);
  const rows = [];
  for (const cls of classes) {
    for (const copies of [1, 2, 3]) {
      for (const scarcity of [100, 200]) {
        const bill = Math.round((base[cls] * scarcity / 100) * copies * 0.5);
        rows.push({ class: cls, copies, scarcityPct: scarcity, billCents: bill,
          exporterNativeLandCents: nativeIncome(data.tradeYields, "DOMAIN_LAND", copies),
          exporterNativeSeaCents: nativeIncome(data.tradeYields, "DOMAIN_SEA", copies) });
      }
    }
  }
  return rows;
}

/**
 * The development-loan ratio (DESIGN 10): for each role and ordinary building, what a host repays for a build fully
 * backed by a development loan (125%, or 150% on a role building, of the Gold its progress used) against the Gold
 * the game charges to buy it, at each game speed. addProgress is scaled up by the city's production bonuses, which
 * this leaves out, so the host's real cost per point is lower than shown.
 */
export function devLoanRatioRows() {
  const data = fixture("modern");
  const multiplier = Number(data.goldPurchaseMultiplier) || 4;
  const pick = ["BUILDING_MARKET", "BUILDING_GRANARY", "BUILDING_BAZAAR", "BUILDING_BANK", "BUILDING_FACTORY",
    "BUILDING_STOCK_EXCHANGE"];
  const rows = [];
  for (const type of pick) {
    const b = data.buildings.find((row) => row.type === type);
    if (!b) continue;
    const roles = rolesOf({ tags: b.tags, goldYield: b.gold ?? 0, isWonder: false, advisories: b.advisories }, 8);
    const role = roles.commerce || roles.banking || roles.trade || roles.industry;
    for (const speed of data.gameSpeeds) {
      const production = Math.round((b.cost * speed.CostMultiplier) / 100);
      const purchase = production * multiplier;
      const used = production * INVEST.goldPerProgress;
      const mille = role ? INVEST.roleProjectMille : INVEST.projectMille;
      const repaid = (INVEST.term * Math.ceil((used * 100 * mille) / 1000)) / 100;
      rows.push({ building: type, age: b.age, speed: speed.GameSpeedType, production, purchaseGold: purchase,
        loanGold: used, repaidGold: repaid, repaidOverPurchase: Math.round((repaid / purchase) * 1000) / 1000,
        roleBuilding: role });
    }
  }
  return rows;
}

/**
 * Wide and tall (DESIGN 10): a 4-city and a 12-city civ with the same Exploration buildings in every city (a Bazaar
 * and a Bank) and income in proportion to its cities: depth, credit and the civ rate.
 */
export function wideTallRows() {
  const data = fixture("exploration");
  const of = (type) => data.buildings.find((row) => row.type === type);
  const perCity = ["BUILDING_BAZAAR", "BUILDING_BANK"].map(of).filter(Boolean);
  return [4, 12].map((cities) => {
    const buildings = [];
    for (let c = 0; c < cities; c += 1) {
      for (const b of perCity) {
        buildings.push({ roles: rolesOf({ tags: b.tags, goldYield: b.gold ?? 0, isWonder: false,
          advisories: b.advisories }, 8), goldYield: b.gold ?? 0, weight: 1 });
      }
    }
    const depth = computeDepth(buildings);
    const income = 500 * cities;
    return { cities, incomeCents: income, depth: depth.depth, depthTurns: depth.depthTurns,
      depthFactorPct: depth.depthFactorPct, creditCapCents: creditCap({ incomeCents: income, outstandingCents: 0,
        depthTurns: depth.depthTurns }), civRatePpm: civRatePpm({ age: "AGE_EXPLORATION", standing: 100,
        level: "neutral", depthFactorPct: depth.depthFactorPct }) };
  });
}

/** A seeded 12-civ game of `turns` Exploration turns with 40 routes between majors and 60 settlements. */
export function makeTradeGame(seed, civCount = 12) {
  const g = gen(seed);
  const data = fixture("exploration");
  const ids = Array.from({ length: civCount }, (_, i) => 2 * i + 1);
  const civs = ids.map((id, i) => ({ id, human: i === 0, factor: 0.6 + g.next() * 0.9, startCents: g.int(5000, 40000),
    cities: 5 }));
  const resources = data.resources.map((r) => ({ type: r.type, class: r.class }));
  const owned = new Map(ids.map((id) => [id, Array.from({ length: 4 }, () => g.pick(resources).type)]));
  const routes = [];
  while (routes.length < 40) {
    const importer = g.pick(ids);
    const exporter = g.pick(ids);
    if (importer === exporter) continue;
    const take = owned.get(exporter).slice(0, g.int(1, 3));
    routes.push({ importer, exporter, resources: take, importerTradeBuildings: g.int(0, 2),
      exporterTradeBuildings: g.int(0, 2) });
  }
  const copies = {};
  for (const list of owned.values()) for (const type of list) copies[type] = (copies[type] || 0) + 1;
  return { seed, civs, routes, market: { resources, copies, strategic: [], industry: 0 } };
}

/** Runs one trade game On (Markets and trade bills) or Off; returns per-civ net settlement and the caps hit. */
export function runTradeGame(game, { on, turns = 200 }) {
  let balances = new Map(game.civs.map((c) => [c.id, c.startCents]));
  let markets = emptyMarkets();
  let ledger;
  const facts = { netByCiv: new Map(game.civs.map((c) => [c.id, 0])), paidShare: [], waived: 0, capped: 0, rows: 0,
    maxMarketsBytes: 0, planMs: [] };
  for (let turn = 1; turn <= turns; turn += 1) {
    const civs = game.civs.map((c) => ({ id: c.id, alive: true, human: c.human, balanceCents: balances.get(c.id),
      incomeCents: Math.round((1500 + 10 * turn) * c.factor), upkeepCents: 0, stages: OPEN_ALL,
      cities: Array.from({ length: c.cities }, (_, k) => ({ id: `${c.id}:${k}`, build: null, neededProgress: 0 })) }));
    const t0 = process.hrtime.bigint();
    const plan = planTurn({ turn, age: "AGE_EXPLORATION", civs, relations: [], requests: [], params: PARAMS,
      options: { loans: false, investment: false, markets: on, ai: false, cycle: "off", systems: false }, ledger, markets, routes: game.routes,
      market: game.market });
    facts.planMs.push(Number(process.hrtime.bigint() - t0) / 1e6);
    for (const row of plan.trade) {
      facts.netByCiv.set(row.payer, facts.netByCiv.get(row.payer) - row.paid);
      facts.netByCiv.set(row.payee, facts.netByCiv.get(row.payee) + row.paid);
      const payer = civs.find((c) => c.id === row.payer);
      facts.paidShare.push(row.paid / Math.max(1, payer.incomeCents));
      facts.waived += row.waived;
      facts.rows += 1;
      if (row.waived > 0) facts.capped += 1;
    }
    facts.maxMarketsBytes = Math.max(facts.maxMarketsBytes, utf8Bytes(saveMarkets(plan.markets)));
    const earned = new Map([...balances].map(([id, b]) => [id, b + civs.find((c) => c.id === id).incomeCents]));
    balances = applyGrants(earned, grantsFor(plan.transfers));
    ledger = plan.ledger;
    markets = plan.markets;
  }
  facts.finalBalances = balances;
  return facts;
}
