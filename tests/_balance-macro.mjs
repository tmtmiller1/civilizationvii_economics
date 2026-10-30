// _balance-macro.mjs - the 1.2 rows of DESIGN 10's balance ladder, in the Node simulation. A seeded 12-civ, 300-turn
// game across the three ages, with each age's governments and Modern ideologies, wars, routes that open and close,
// disasters, captures in war and each age's crisis, run with every 1.2 part on; then controlled runs for system
// diversity, citizen loans and the plan. Incomes are exogenous, and each civ spends what it holds above its own
// number of turns of income, as the game's own spending would. Nothing here is a tuned number; the constants are
// DESIGN's starting points.

import { planTurn } from "../ui/econ-plan.js";
import { applyGrants, grantsFor } from "../ui/econ-conservation.js";
import { emptyMarkets } from "../ui/econ-markets.js";
import { emptyMacro, saveMacro } from "../ui/econ-macro-state.js";
import { utf8Bytes } from "../ui/econ-state.js";
import { creditRoom } from "../ui/econ-requests.js";
import { viewContext } from "../ui/econ-view-model.js";
import { leverPct } from "../ui/econ-cycle.js";
import { CARD_LEVELS } from "../ui/econ-tax-cards.js";
import { gen } from "./_prng.mjs";
import { PARAMS } from "./_fixtures.mjs";

export const MACRO_TURNS = 300;
export const MACRO_AGES = [[1, "AGE_ANTIQUITY"], [101, "AGE_EXPLORATION"], [201, "AGE_MODERN"]];
const GOVERNMENTS = { AGE_ANTIQUITY: ["GOVERNMENT_DESPOTISM", "GOVERNMENT_CLASSICAL_REPUBLIC", "GOVERNMENT_OLIGARCHY"],
  AGE_EXPLORATION: ["GOVERNMENT_FEUDAL_MONARCHY", "GOVERNMENT_THEOCRACY", "GOVERNMENT_PLUTOCRACY"],
  AGE_MODERN: ["GOVERNMENT_AUTHORITARIANISM", "GOVERNMENT_BUREAUCRATIC_MONARCHY", "GOVERNMENT_ELECTIVE_REPUBLIC"] };
const IDEOLOGIES = ["IDEOLOGY_DEMOCRACY", "IDEOLOGY_FASCISM", "IDEOLOGY_COMMUNISM"];
export const ALL_ON = { loans: true, guard: true, ai: true, markets: true, tariffs: true, investment: true,
  inflation: true, cycle: "standard", systems: true };

/** @param {number} turn */
export function macroAgeAt(turn) {
  let age = MACRO_AGES[0][1];
  for (const [from, a] of MACRO_AGES) if (turn >= from) age = a;
  return age;
}

/** @param {number} turn */
const ageStart = (turn) => MACRO_AGES.filter(([from]) => turn >= from).at(-1)[0];

/** The market the price step reads: a handful of resources, a copy or two each. */
const MARKET = { resources: [{ type: "RESOURCE_IRON", class: "RESOURCECLASS_EMPIRE" },
  { type: "RESOURCE_WINE", class: "RESOURCECLASS_CITY" }, { type: "RESOURCE_SILK", class: "RESOURCECLASS_CITY" },
  { type: "RESOURCE_HORSES", class: "RESOURCECLASS_EMPIRE" }], copies: { RESOURCE_IRON: 2, RESOURCE_WINE: 3,
  RESOURCE_SILK: 1, RESOURCE_HORSES: 2 }, strategic: ["RESOURCE_IRON", "RESOURCE_HORSES"], industry: 0 };

/**
 * One seeded game: civs with an income path, a government per age and an ideology in Modern, stage turns, how many
 * turns of income each keeps, wars (none when `peaceful`), routes and disasters.
 * @param {number} seed
 * @param {{ peaceful?: boolean, civCount?: number }} [q]
 */
export function makeMacroGame(seed, { peaceful = false, civCount = 12 } = {}) {
  const g = gen(seed);
  const ids = Array.from({ length: civCount }, (_, i) => 2 * i + 1);
  const civs = ids.map((id, i) => ({ id, human: i === 0, factor: 0.6 + g.next() * 0.9,
    keepTurns: g.pick([5, 8, 12, 25, 40]), noise: Array.from({ length: MACRO_TURNS + 1 }, () => 1 + (g.next() - 0.5) * 0.3),
    governments: Object.fromEntries(Object.entries(GOVERNMENTS).map(([age, list]) => [age, g.pick(list)])),
    pickTurn: g.int(1, 3), ideology: g.pick(IDEOLOGIES), ideologyTurn: g.int(240, 275),
    stages: { moneylending: g.int(20, 60), publicDebt: g.int(110, 150), trade: g.int(10, 40), guildPatronage: g.int(105, 130),
      charteredCompanies: g.int(120, 170), tariffs: g.int(140, 190), banking: g.int(140, 190), capitalism: g.int(215, 260) },
    warehouses: g.int(0, 4), commerceSettlements: g.int(1, 3) }));
  const wars = [];
  for (let k = 0; !peaceful && k < 10; k += 1) {
    const a = g.pick(ids); const b = g.pick(ids);
    if (a !== b) wars.push({ a, b, from: g.int(10, MACRO_TURNS - 20), length: g.int(8, 25) });
  }
  const routes = [];
  for (let k = 0; k < 40; k += 1) {
    const importer = g.pick(ids); const exporter = g.pick(ids);
    if (importer !== exporter) {
      routes.push({ importer, exporter, resources: [g.pick(MARKET.resources).type], from: g.int(10, 200),
        length: g.int(30, 150) });
    }
  }
  const disasters = Array.from({ length: MACRO_TURNS + 1 }, () => (g.chance(0.15)
    ? { pid: g.pick(ids), populationLost: g.chance(0.4), foodWarehouse: g.chance(0.3) } : null));
  return { seed, g, ids, civs, wars, routes, disasters };
}

/** @param {ReturnType<typeof makeMacroGame>} game @param {number} turn */
function warsAt(game, turn) {
  return game.wars.filter((w) => turn >= w.from && turn < w.from + w.length);
}

/** @param {ReturnType<typeof makeMacroGame>} game @param {number} turn */
function relationsAt(game, turn) {
  const wars = warsAt(game, turn);
  const out = [];
  for (let i = 0; i < game.ids.length; i += 1) {
    for (let j = i + 1; j < game.ids.length; j += 1) {
      const [a, b] = [game.ids[i], game.ids[j]];
      const war = wars.some((w) => (w.a === a && w.b === b) || (w.a === b && w.b === a));
      out.push({ a, b, level: war ? "war" : "neutral" });
    }
  }
  return out;
}

/** The crisis stage at an age's turn: none before 84, then 0, 1 and 2 a week apart. */
function crisisAt(turn) {
  const inAge = turn - ageStart(turn) + 1;
  if (inAge < 84) return -1;
  return Math.min(2, Math.floor((inAge - 84) / 7));
}

/** One civ as the glue would read it this turn. */
function civAt(game, c, turn, balance) {
  const age = macroAgeAt(turn);
  const inAge = turn - ageStart(turn) + 1;
  const atWar = warsAt(game, turn).some((w) => w.a === c.id || w.b === c.id);
  const incomeCents = Math.round((800 + 25 * turn) * c.factor * c.noise[turn] * (atWar ? 0.7 : 1));
  const cities = Array.from({ length: 5 }, (_, k) => ({ id: `${c.id}:${k}`, build: "BUILDING_LIBRARY",
    neededProgress: 150, population: 3 + k, roleBuilding: k === 0 }));
  return { id: c.id, alive: true, human: c.human, balanceCents: balance, incomeCents, upkeepCents: 500, stages: c.stages,
    atWar, happinessCents: 600, depthTurns: turn >= c.stages.banking ? 2 : 0, depthFactorPct: 100,
    government: inAge >= c.pickTurn ? c.governments[age] : null,
    ideology: age === "AGE_MODERN" && turn >= c.ideologyTurn ? c.ideology : null, warehouses: c.warehouses,
    cushionBp: age === "AGE_ANTIQUITY" ? 0 : 200, commerceSettlements: c.commerceSettlements, cities };
}

/** The engine events the glue would have seen: a disaster, and captures on the losing side of a war. */
function eventsAt(game, turn) {
  const out = [];
  const disaster = game.disasters[turn];
  if (disaster) out.push({ kind: "disaster", ...disaster });
  for (const w of warsAt(game, turn)) if (game.g.chance(0.05)) out.push({ kind: "capture", pid: w.b });
  return out;
}

/**
 * The human borrows 4 turns of income from the bond market over 30 turns every 15 turns from Public debt, as a
 * player building with bonds would; 4 turns is about what the 35% debt-service limit lets through at the bond rate.
 */
function humanRequests(civs, turn) {
  const me = civs.find((c) => c.human);
  if (turn % 15 !== 0 || !(me.incomeCents > 0) || turn < me.stages.publicDebt) return [];
  return [{ kind: "borrow", borrower: me.id, lender: "bond", principal: 4 * me.incomeCents, term: 30 }];
}

/** What a turn's plan says about each civ's Gold from the 1.2 parts, by reason. */
function macroGold(plan) {
  const out = new Map();
  for (const t of plan.transfers) {
    if (!["cycle", "erosion", "plan"].includes(t.reason)) continue;
    for (const [pid, sign] of [[t.from, -1], [t.to, 1]]) {
      if (typeof pid !== "number") continue;
      const row = out.get(pid) || { cycle: 0, erosion: 0, plan: 0 };
      row[t.reason] += sign * t.cents;
      out.set(pid, row);
    }
  }
  return out;
}

/**
 * Runs one game with `options`; returns what the 1.2 rows read: E and each civ's phase per turn, Panics, pi, the
 * Gold the parts moved per civ, the macro envelope's size and the plan's time.
 * @param {ReturnType<typeof makeMacroGame>} game
 * @param {Partial<PlanOptions>} [options]
 */
export function runMacroGame(game, options = ALL_ON) {
  let balances = new Map(game.civs.map((c) => [c.id, 20000]));
  let ledger;
  let markets = emptyMarkets();
  let macro = emptyMacro();
  const facts = { e: [], phases: [], panics: 0, pi: [], gold: new Map(), systems: new Map(), maxMacroBytes: 0,
    planMs: [], lever: [] };
  for (let turn = 1; turn <= MACRO_TURNS; turn += 1) {
    const civs = game.civs.map((c) => civAt(game, c, turn, balances.get(c.id)));
    const routes = game.routes.filter((r) => turn >= r.from && turn < r.from + r.length);
    const t0 = process.hrtime.bigint();
    const plan = planTurn({ turn, age: macroAgeAt(turn), civs, relations: relationsAt(game, turn), routes,
      requests: humanRequests(civs, turn), params: PARAMS, options, ledger, markets, macro, market: MARKET,
      cycleEvents: eventsAt(game, turn), crisisStage: crisisAt(turn) });
    facts.planMs.push(Number(process.hrtime.bigint() - t0) / 1e6);
    record(facts, plan, civs);
    const earned = new Map([...balances].map(([id, b]) => [id, b + civs.find((c) => c.id === id).incomeCents]));
    balances = spend(game, applyGrants(earned, grantsFor(plan.transfers)), civs);
    ({ ledger, markets, macro } = plan);
  }
  return facts;
}

/** @param {any} facts @param {PlanOutput} plan @param {Civ[]} civs */
function record(facts, plan, civs) {
  facts.e.push(plan.macro.cycle.e);
  facts.phases.push({ ...plan.macro.cycle.phases });
  if (plan.events.some((e) => e.kind === "panic")) facts.panics += 1;
  facts.pi.push(plan.macro.inflation.piPpm);
  facts.maxMacroBytes = Math.max(facts.maxMacroBytes, utf8Bytes(saveMacro(plan.macro)));
  for (const [pid, row] of macroGold(plan)) {
    const sum = facts.gold.get(pid) || { cycle: 0, erosion: 0, plan: 0 };
    for (const key of Object.keys(row)) sum[key] += row[key];
    facts.gold.set(pid, sum);
  }
  for (const c of civs) facts.systems.set(c.id, plan.macro.systems[String(c.id)]?.system);
  let outstanding = 0;
  for (const loan of plan.ledger.loans) if (loan.state === "active" || loan.state === "default") outstanding += loan.outstanding;
  facts.lever.push(leverPct(outstanding, civs.map((c) => c.balanceCents)));
  facts.bondLoans = plan.ledger.loans.filter((loan) => loan.lender === "bond").length;
}

/** Each civ keeps its own number of turns of income and spends the rest, as the game's AI spends its Gold. */
function spend(game, balances, civs) {
  const out = new Map();
  for (const [id, cents] of balances) {
    const c = game.civs.find((x) => x.id === id);
    const income = civs.find((x) => x.id === id).incomeCents;
    out.set(id, Math.min(cents, c.keepTurns * Math.max(1000, income)));
  }
  return out;
}

/**
 * System diversity (DESIGN 10): ten civs, one per system, the same income path and the same world (a war against an
 * outside civ from turn 30 to 45, routes to it, a crisis), 100 Exploration turns. Per system: the Gold the 1.2 parts
 * moved, the credit limit at the end, the plan's production and the swing of E + L.
 */
export function systemDiversityRows() {
  const systems = [["mixed", { government: null }], ["market", { government: "GOVERNMENT_ELECTIVE_REPUBLIC" }],
    ["tribute", { government: "GOVERNMENT_DESPOTISM" }], ["civicMarket", { government: "GOVERNMENT_CLASSICAL_REPUBLIC" }],
    ["merchantOligarchy", { government: "GOVERNMENT_OLIGARCHY" }], ["manorial", { government: "GOVERNMENT_FEUDAL_MONARCHY" }],
    ["mercantile", { government: "GOVERNMENT_PLUTOCRACY" }], ["religious", { government: "GOVERNMENT_THEOCRACY" }],
    ["corporatist", { government: "GOVERNMENT_AUTHORITARIANISM" }], ["planned", { ideology: "IDEOLOGY_COMMUNISM" }]];
  const ids = systems.map((_, i) => 2 * i + 1);
  const OUT = 99;
  const stages = { moneylending: 0, publicDebt: 0, trade: 0, guildPatronage: 0, charteredCompanies: 0, tariffs: 0,
    banking: 0, capitalism: null };
  let macro = emptyMacro();
  let ledger;
  let markets = emptyMarkets();
  const swing = new Map(ids.map((id) => [id, []]));
  const gold = new Map(ids.map((id) => [id, 0]));
  const production = new Map(ids.map((id) => [id, 0]));
  let civs = [];
  for (let turn = 1; turn <= 100; turn += 1) {
    const atWar = turn >= 30 && turn < 45;
    civs = [...systems.map(([, s], i) => ({ id: ids[i], alive: true, human: false, balanceCents: 40000,
      incomeCents: 3000, upkeepCents: 500, stages, atWar, happinessCents: 600, depthTurns: 2, depthFactorPct: 90,
      government: s.government ?? null, ideology: s.ideology ?? null, warehouses: 2, cushionBp: 200,
      commerceSettlements: 2, cities: [{ id: `${ids[i]}:1`, build: "B", neededProgress: 500, population: 4 },
        { id: `${ids[i]}:2`, build: "B", neededProgress: 500, population: 2 }] })),
    { id: OUT, alive: true, human: false, balanceCents: 40000, incomeCents: 3000, stages, atWar }];
    const relations = ids.map((id) => ({ a: id, b: OUT, level: atWar ? "war" : "neutral" }));
    const routes = turn >= 20 && turn < 70 ? ids.map((id) => ({ importer: OUT, exporter: id, resources: ["RESOURCE_WINE"] }))
      : [];
    const plan = planTurn({ turn, age: "AGE_EXPLORATION", civs, relations, routes, params: PARAMS,
      options: { ...ALL_ON, ai: false, inflation: false }, ledger, markets, macro, market: MARKET,
      crisisStage: turn >= 84 ? 0 : -1 });
    for (const [pid, row] of macroGold(plan)) if (gold.has(pid)) gold.set(pid, gold.get(pid) + row.cycle + row.plan);
    for (const p of plan.progress) if (production.has(p.host)) production.set(p.host, production.get(p.host) + p.amount);
    // A Planned civ is outside the world cycle (DESIGN 4.17), so its own index holds at 1.0.
    for (const id of ids) {
      const outside = plan.macro.systems[String(id)]?.system === "planned";
      swing.get(id).push(outside ? 1 : (plan.macro.cycle.e + (plan.macro.cycle.l[String(id)] ?? 0)) / 10000);
    }
    ({ ledger, markets, macro } = plan);
  }
  const ctx = viewContext({ turn: 101, age: "AGE_EXPLORATION", civs, relations: [], options: ALL_ON, ledger, macro });
  return systems.map(([name], i) => {
    const series = swing.get(ids[i]);
    const mean = series.reduce((s, x) => s + x, 0) / series.length;
    const sd = Math.sqrt(series.reduce((s, x) => s + (x - mean) ** 2, 0) / series.length);
    return { system: name, cycleAndPlanGold: gold.get(ids[i]) / 100, creditCapGold: creditRoom(ctx, ids[i]) / 100,
      planProduction: production.get(ids[i]), swingSd: Math.round(sd * 10000) / 10000 };
  });
}

/**
 * Citizen loans against Light tax (DESIGN 10): a Classical Republic AI that keeps 5 turns of income borrows from its
 * citizens by the rule for 100 Antiquity turns. Interest paid, the celebration it bought, defaults, and what the
 * same Gold buys under Light Taxation (CARD_LEVELS: +6 Happiness for -1 Gold a settlement, 6 a Gold).
 */
export function citizenLoanRow() {
  const id = 3;
  const other = 5;
  let balance = 5000;
  let ledger;
  let macro = emptyMacro();
  let interest = 0;
  let celebration = 0;
  let borrowed = 0;
  let defaults = 0;
  for (let turn = 1; turn <= 100; turn += 1) {
    const income = 1500 + 10 * turn;
    const civs = [{ id, alive: true, human: false, balanceCents: balance, incomeCents: income, upkeepCents: 300,
      stages: { moneylending: 0, publicDebt: null }, happinessCents: 500, government: "GOVERNMENT_CLASSICAL_REPUBLIC",
      commerceSettlements: 2 }, { id: other, alive: true, human: false, balanceCents: 5000, incomeCents: income,
      stages: { moneylending: 0, publicDebt: null }, government: "GOVERNMENT_DESPOTISM" }];
    const plan = planTurn({ turn, age: "AGE_ANTIQUITY", civs, params: PARAMS, ledger, macro,
      options: { ...ALL_ON, markets: false, investment: false, inflation: false, cycle: "off" } });
    for (const t of plan.transfers) {
      if (t.from === "citizens") borrowed += t.cents;
      if (t.to === "citizens") interest += t.parts.interest || 0;
    }
    for (const row of plan.celebration) if (row.reason === "citizens") celebration += row.amount;
    defaults += plan.events.filter((e) => e.kind === "default").length;
    const net = new Map(grantsFor(plan.transfers).map((g) => [g.pid, 0]));
    for (const g of grantsFor(plan.transfers)) net.set(g.pid, net.get(g.pid) + g.cents);
    balance = Math.min(balance + income + (net.get(id) || 0), 5 * income);
    ({ ledger, macro } = plan);
  }
  const otherBorrowed = 0;
  return { borrowedGold: borrowed / 100, interestGold: interest / 100, celebration: celebration / 100,
    celebrationPerInterestGold: interest ? Math.round((celebration / interest) * 100) / 100 : 0,
    lightTaxHappinessPerGold: CARD_LEVELS.LIGHT.happiness / -CARD_LEVELS.LIGHT.gold, defaults, otherAntiquityBorrowedGold: otherBorrowed };
}

/**
 * The plan against Mixed (DESIGN 10): a Planned civ's production over 50 turns against the Gold it took, valued at
 * the game's purchase price (GOLD_PURCHASE_MULTIPLIER 4 Gold a point, tests/fixtures/commerce-modern-1.5.0.json)
 * before the city's production bonuses scale addProgress up.
 */
export function planRow() {
  const id = 3;
  let ledger;
  let macro = emptyMacro();
  let taken = 0;
  let points = 0;
  for (let turn = 1; turn <= 50; turn += 1) {
    const civs = [{ id, alive: true, human: false, balanceCents: 50000, incomeCents: 5000, stages: { moneylending: 0,
      publicDebt: 0 }, ideology: "IDEOLOGY_COMMUNISM", cities: [{ id: "3:1", build: "B", neededProgress: 10000,
      population: 6 }, { id: "3:2", build: "B", neededProgress: 10000, population: 3 }] }];
    const plan = planTurn({ turn, age: "AGE_MODERN", civs, params: PARAMS, ledger, macro,
      options: { ...ALL_ON, markets: false, investment: false, cycle: "off" } });
    for (const t of plan.transfers) if (t.reason === "plan") taken += t.cents;
    for (const p of plan.progress) points += p.amount;
    ({ ledger, macro } = plan);
  }
  return { goldTaken: taken / 100, production: points, purchaseValueGold: points * 4,
    valueOverGold: Math.round((points * 4 * 100) / taken * 100) / 100 };
}
