// The 1.2 steps inside the turn batch (DESIGN 4.8, 4.11, 4.14, 4.17, 6): the cycle from wars, peace and routes, its
// Gold and a reload that replays it; Panic; inflation's erosion; each system's terms in rates, credit, bills and
// investment; citizen loans and their celebration; the plan; Religious partnerships; the AI's citizen, aid and
// equity rules. Every plan here passes the commit checks.
import test from "node:test";
import assert from "node:assert/strict";

import { planTurn } from "../ui/econ-plan.js";
import { checkPlan } from "../ui/econ-invariants.js";
import { emptyLedger } from "../ui/econ-state.js";
import { emptyMarkets } from "../ui/econ-markets.js";
import { emptyMacro, loadMacro, saveMacro } from "../ui/econ-macro-state.js";
import { makeLoan } from "../ui/econ-loan.js";
import { viewContext } from "../ui/econ-view-model.js";
import { creditRoom } from "../ui/econ-requests.js";
import { offerQuery } from "../ui/econ-turn.js";
import { offersFor } from "../ui/econ-lenders.js";
import { OPEN_ALL, OPEN_MACRO, civ, input } from "./_fixtures.mjs";

const ME = 3;
const AI = 6;
const OTHER = 9;
const ON = { cycle: "standard", systems: true };
const me = (over = {}) => civ(ME, { human: true, incomeCents: 10000, balanceCents: 100000, stages: OPEN_ALL, ...over });
const ai = (id, over = {}) => civ(id, { incomeCents: 10000, balanceCents: 300000, stages: OPEN_ALL, ...over });
const macroWith = (cycle = {}, over = {}) => ({ ...emptyMacro(), ...over, cycle: { ...emptyMacro().cycle, ...cycle } });
const refusal = (plan, request) => plan.events.find((e) => e.kind === "refused" && e.request === request)?.reason;

/** A plan with the 1.2 parts on that must pass the commit checks. */
function plan(over) {
  const out = planTurn(input({ markets: emptyMarkets(), ...over, options: { ...ON, ...(over.options || {}) } }));
  assert.deepEqual(checkPlan({ plan: out, civs: over.civs }), [], "commit checks");
  return out;
}

test("a war moves E and both sides' L down the turn it starts; the cycle charges Gold in proportion to income", () => {
  const civs = [me(), ai(AI, { atWar: true }), ai(OTHER, { atWar: true })];
  const relations = [{ a: AI, b: OTHER, level: "war" }];
  const out = plan({ civs, relations });
  assert.equal(out.macro.cycle.e, 9880, "-0.02 at k 1.0 and s 0.6");
  assert.deepEqual(out.macro.cycle.l, { [AI]: -200, [OTHER]: -200 }, "only the two at war");
  assert.deepEqual(out.macro.cycle.wars, [`${AI}:${OTHER}`]);
  assert.deepEqual(out.macro.cycle.events.map((e) => [e.kind, e.a, e.b, e.w]), [["war-declared", AI, OTHER, -200]]);
  const charges = out.transfers.filter((t) => t.reason === "cycle").map((t) => [t.from, t.to, t.cents]);
  assert.deepEqual(charges, [[ME, "cycle", 24], [AI, "cycle", 64], [OTHER, "cycle", 64]]);
  const next = plan({ civs, relations, turn: 51, ledger: out.ledger, macro: out.macro });
  assert.equal(next.macro.cycle.e, 9868, "reverting a tenth, -0.004 for the war that goes on");
  assert.deepEqual(next.macro.cycle.l, { [AI]: -200, [OTHER]: -200 });
  const peace = plan({ civs: [me(), ai(AI), ai(OTHER)], relations: [{ a: AI, b: OTHER, level: "neutral" }], turn: 52,
    ledger: next.ledger, macro: next.macro });
  assert.equal(peace.macro.cycle.e, 9941, "+0.01 for peace");
  assert.deepEqual(peace.macro.cycle.l, { [AI]: -60, [OTHER]: -60 });
  assert.deepEqual(peace.macro.cycle.wars, []);
});

test("a reload replays the same cycle: the saved macro envelope gives the same next turn", () => {
  const civs = [me(), ai(AI, { atWar: true }), ai(OTHER, { atWar: true })];
  const relations = [{ a: AI, b: OTHER, level: "war" }];
  const first = plan({ civs, relations });
  const straight = plan({ civs, relations, turn: 51, ledger: first.ledger, macro: first.macro });
  const reloaded = plan({ civs, relations, turn: 51, ledger: first.ledger,
    macro: loadMacro(saveMacro(first.macro)).macro });
  assert.deepEqual(reloaded.macro, straight.macro);
  assert.deepEqual(reloaded.transfers, straight.transfers);
});

test("a boom pays cycle Gold as a world inflow the payer can spend this turn; the cycle Off moves nothing", () => {
  const civs = [me({ balanceCents: 0 }), ai(AI)];
  const boom = plan({ civs, macro: macroWith({ e: 12000 }) });
  const gold = boom.transfers.find((t) => t.to === ME && t.reason === "cycle");
  assert.deepEqual([gold.from, gold.cents], ["cycle", 360], "E 1.18 after reverting: 0.18 * 0.2 of income");
  const off = plan({ civs, macro: macroWith({ e: 12000 }), options: { cycle: "off" } });
  assert.deepEqual(off.transfers, []);
  assert.equal(off.macro.cycle.e, 10000, "Off rests the cycle");
  assert.equal(planTurn(input({ civs, options: { loans: false, markets: false, investment: false, cycle: "off",
    systems: false } })).skipped, "all-off");
});

test("routes between civs are events: a new one lifts both ends' L, one that ends weighs on them", () => {
  const civs = [me(), ai(AI)];
  const routes = [{ importer: ME, exporter: AI, resources: [] }];
  const opened = plan({ civs, routes });
  assert.deepEqual(opened.macro.cycle.routes, [`${ME}:${AI}`]);
  assert.deepEqual(opened.macro.cycle.l, { [ME]: 50, [AI]: 50 });
  const ended = plan({ civs, routes: [], turn: 51, ledger: opened.ledger, macro: opened.macro });
  assert.deepEqual(ended.macro.cycle.l, { [ME]: -10, [AI]: -10 }, "0.8 * 50 - 50");
});

test("the engine's events and the crisis reach E, and a phase change tells the player what was behind it", () => {
  const civs = [me(), ai(AI)];
  const out = plan({ civs, cycleEvents: [{ kind: "capture", pid: ME }, { kind: "disaster", pid: ME, populationLost: true }],
    crisisStage: 0, macro: macroWith({ e: 9600, phases: { [ME]: "steady", [AI]: "steady" } }) });
  assert.deepEqual(out.macro.cycle.events.map((e) => e.kind), ["capture", "disaster", "crisis-start"]);
  assert.equal(out.macro.cycle.crisis, 0);
  assert.equal(out.macro.cycle.l[ME], -200);
  const phase = out.notices.find((n) => n.kind === "phase");
  assert.deepEqual([phase.pid, phase.from, phase.to, phase.causes], [ME, "steady", "slump", "capture,disaster"]);
  assert.equal(out.macro.cycle.phases[ME], "slump");
});

test("Panic: from Banking, leverage above 1.5 in a boom; E drops 0.2, civ lenders stop, bond spread +0.5", () => {
  const civs = [me({ stages: OPEN_MACRO }), ai(AI, { stages: OPEN_MACRO, balanceCents: 100000 })];
  const ledger = { ...emptyLedger(), nextId: 2, loans: [makeLoan({ id: "L1", lender: "bond", borrower: AI,
    principal: 400000, ratePpm: 30000, term: 30, turn: 40 })] };
  const out = plan({ civs, ledger, macro: macroWith({ e: 12000 }),
    requests: [{ kind: "borrow", borrower: ME, lender: AI, principal: 1000, term: 10 }] });
  assert.equal(out.macro.cycle.e, 9800);
  assert.deepEqual([out.macro.cycle.panicUntil, out.macro.cycle.lastPanic], [55, 50]);
  assert.ok(out.events.some((e) => e.kind === "panic" && e.chronicle === 1));
  assert.ok(out.notices.some((n) => n.kind === "panic" && n.pid === ME));
  assert.equal(refusal(out, "borrow"), "no-offer", "civ lenders stop offering");
  const ctx = viewContext(input({ civs, ledger: out.ledger, macro: out.macro, turn: 51, options: ON }));
  assert.equal(ctx.readings.civ.get(ME).phase, "panic");
  assert.equal(ctx.readings.civ.get(ME).spreadPct, 152, "2 - 0.98 + 0.5");
  const bond = offersFor(offerQuery(ctx, ME, { principal: 1000, term: 10 })).find((o) => o.lender === "bond");
  assert.ok(bond.ratePpm > 20000 * 1.4, `${bond.ratePpm}`);
  const calm = plan({ civs: [me(), ai(AI, { balanceCents: 100000 })], ledger, macro: macroWith({ e: 12000 }) });
  assert.equal(calm.macro.cycle.panicUntil, null, "no Panic before the Banking stage");
});

test("inflation On: bond debt beside idle Gold erodes the Gold above the reserve; Off erodes nothing", () => {
  const rich = ai(AI, { balanceCents: 1000000 });
  const ledger = { ...emptyLedger(), nextId: 2, loans: [makeLoan({ id: "L1", lender: "bond", borrower: AI,
    principal: 100000, ratePpm: 40000, term: 30, turn: 49 })] };
  const on = plan({ civs: [me(), rich], ledger, options: { inflation: true } });
  assert.equal(on.macro.inflation.piPpm, 1818, "0.02 * 1000 / (1000 + 10000 the two members hold)");
  const erosion = on.transfers.find((t) => t.reason === "erosion");
  assert.deepEqual([erosion.from, erosion.to, erosion.cents], [AI, "inflation", 1454]);
  assert.equal(on.macro.inflation.top, AI);
  const off = plan({ civs: [me(), rich], ledger });
  assert.equal(off.transfers.some((t) => t.reason === "erosion"), false);
  assert.equal(off.macro.inflation.piPpm, 0);
  const ctx = viewContext(input({ civs: [me(), rich], ledger, macro: on.macro, options: { ...ON, inflation: true } }));
  const bond = offersFor(offerQuery(ctx, ME, { principal: 1000, term: 10 })).find((o) => o.lender === "bond");
  assert.equal(bond.ratePpm, 21800, "the premium: 50 * pi, 9%");
});

test("systems come from the government; a change is an event, a notice and a -0.03 shock on L", () => {
  const civs = [me({ government: "GOVERNMENT_DESPOTISM" }), ai(AI, { government: "GOVERNMENT_THEOCRACY" })];
  const first = plan({ civs });
  assert.deepEqual(first.macro.systems[ME], { system: "tribute", from: "tribute", since: 50 });
  assert.equal(first.events.some((e) => e.kind === "system"), false, "the first system isn't a change");
  const changed = plan({ civs: [me({ government: "GOVERNMENT_OLIGARCHY" }), civs[1]], turn: 51, ledger: first.ledger,
    macro: first.macro });
  assert.deepEqual(changed.macro.systems[ME], { system: "merchantOligarchy", from: "tribute", since: 51 });
  assert.ok(changed.events.some((e) => e.kind === "system" && e.pid === ME && e.to === "merchantOligarchy"));
  assert.ok(changed.notices.some((n) => n.kind === "system" && n.from === "tribute"));
  assert.equal(changed.macro.cycle.l[ME], -300, "-0.03, at the old system's swing on the turn of the change");
  const off = plan({ civs: [me({ government: "GOVERNMENT_OLIGARCHY" })], options: { systems: false } });
  assert.equal(off.macro.systems[ME].system, "mixed");
});

test("system terms in the rates and credit: Market's bond, Tribute's civ lenders only, Merchant oligarchy's limit", () => {
  const ctxFor = (government, extra = {}) => viewContext(input({ civs: [me({ government, ...extra }), ai(AI)],
    macro: { ...emptyMacro(), systems: { [ME]: { system: government ? systemOf(government) : "mixed", from: "mixed",
      since: 0 } } }, options: ON }));
  const systemOf = (g) => ({ GOVERNMENT_ELECTIVE_REPUBLIC: "market", GOVERNMENT_DESPOTISM: "tribute",
    GOVERNMENT_OLIGARCHY: "merchantOligarchy", GOVERNMENT_AUTHORITARIANISM: "corporatist" })[g];
  const bondOf = (ctx) => offersFor(offerQuery(ctx, ME, { principal: 1000, term: 10 })).find((o) => o.lender === "bond");
  assert.equal(bondOf(ctxFor(null)).ratePpm, 20000);
  assert.equal(bondOf(ctxFor("GOVERNMENT_ELECTIVE_REPUBLIC")).ratePpm, 18000);
  assert.equal(bondOf(ctxFor("GOVERNMENT_AUTHORITARIANISM")).ratePpm, 15000);
  assert.equal(bondOf(ctxFor("GOVERNMENT_DESPOTISM")), undefined, "Tribute borrows from civs only");
  assert.equal(creditRoom(ctxFor(null), ME), 120000);
  assert.equal(creditRoom(ctxFor("GOVERNMENT_OLIGARCHY"), ME), 160000, "+4 turns");
  assert.equal(creditRoom(ctxFor("GOVERNMENT_AUTHORITARIANISM"), ME), 180000, "1.5x");
  const civRate = (government) => offersFor(offerQuery(ctxFor(government), ME, { principal: 1000, term: 10,
    lenders: [{ id: AI, balanceCents: 300000, stages: OPEN_ALL }] })).find((o) => o.lender === AI).ratePpm;
  assert.equal(civRate(null), 10000);
  assert.equal(civRate("GOVERNMENT_DESPOTISM"), 12000);
  assert.equal(civRate("GOVERNMENT_OLIGARCHY"), 8000);
});

test("bills between systems: a Manorial importer pays 20% less, a Mercantile exporter is owed 10% more", () => {
  const prices = { RESOURCE_IRON: 1000 };
  const civs = [me({ government: "GOVERNMENT_FEUDAL_MONARCHY", incomeCents: 100000 }),
    ai(AI, { government: "GOVERNMENT_PLUTOCRACY" })];
  const routes = [{ importer: ME, exporter: AI, resources: ["RESOURCE_IRON"] }];
  const out = plan({ civs, routes, markets: { ...emptyMarkets(), prices } });
  assert.equal(out.trade[0].cents, 440, "500 * 0.8 * 1.1");
  const mixed = plan({ civs: [me({ incomeCents: 100000 }), ai(AI)], routes, markets: { ...emptyMarkets(), prices } });
  assert.equal(mixed.trade[0].cents, 500);
});

test("a Planned importer pays the class price; the plan turns 20% of income into its cities' builds", () => {
  const market = { resources: [{ type: "RESOURCE_IRON", class: "RESOURCECLASS_EMPIRE" }], copies: { RESOURCE_IRON: 1 },
    strategic: [], industry: 0 };
  const cities = [{ id: "6:1", build: "B", neededProgress: 100, population: 3 },
    { id: "6:2", build: "U", neededProgress: 100, population: 1 }];
  const civs = [me({ incomeCents: 100000 }), ai(AI, { ideology: "IDEOLOGY_COMMUNISM", cities, stages: OPEN_ALL })];
  const routes = [{ importer: AI, exporter: ME, resources: ["RESOURCE_IRON"] }];
  const out = plan({ civs, routes, market, markets: { ...emptyMarkets(), prices: { RESOURCE_IRON: 5000 } } });
  assert.equal(out.macro.systems[AI].system, "planned");
  assert.equal(out.trade.find((row) => row.payer === AI).owed, 200, "half of the Empire class price, 400");
  const take = out.transfers.find((t) => t.reason === "plan");
  assert.deepEqual([take.from, take.to, take.cents], [AI, "plan", 2000], "4 Gold a point, the game's purchase rate");
  assert.deepEqual(out.progress, [{ host: AI, cityId: "6:1", amount: 4, investmentId: `PL${AI}` },
    { host: AI, cityId: "6:2", amount: 1, investmentId: `PL${AI}` }]);
  assert.equal(out.macro.cycle.l[AI], undefined, "outside the world cycle");
  assert.ok(out.notices.length === 0 || out.notices.every((n) => n.pid === ME));
});

test("citizen loans: offered to a Civic market civ within citizen_cap; the interest comes back doubled as celebration", () => {
  const cr = (over = {}) => me({ government: "GOVERNMENT_CLASSICAL_REPUBLIC", incomeCents: 30000,
    commerceSettlements: 2, happinessCents: 600, ...over });
  const borrow = { kind: "borrow", borrower: ME, lender: "citizens", principal: 50000, term: 10 };
  const opened = plan({ civs: [cr(), ai(AI)], requests: [borrow] });
  const loan = opened.ledger.loans.find((l) => l.lender === "citizens");
  assert.deepEqual([loan.principal, loan.ratePpm, loan.term], [50000, 7500, 10], "0.75 of Exploration's base rate");
  assert.deepEqual(opened.transfers.find((t) => t.reason === "principal").from, "citizens");
  const paid = plan({ civs: [cr(), ai(AI)], turn: 51, ledger: opened.ledger, macro: opened.macro });
  assert.deepEqual(paid.celebration.map((r) => [r.pid, r.amount, r.reason]), [[ME, 750, "citizens"]]);
  const missed = plan({ civs: [cr({ balanceCents: -100000 }), ai(AI)], turn: 51, ledger: opened.ledger,
    macro: opened.macro });
  assert.deepEqual(missed.celebration.map((r) => [r.amount, r.reason]), [[-3000, "citizens-miss"]]);
  assert.deepEqual(missed.influence, [], "a miss at home costs celebration, not Influence");
  const tooBig = plan({ civs: [cr(), ai(AI)], requests: [{ ...borrow, principal: 400000 }] });
  assert.equal(refusal(tooBig, "borrow"), "no-offer", "past citizen_cap");
  const mixed = plan({ civs: [me({ incomeCents: 30000, commerceSettlements: 2 }), ai(AI)], requests: [borrow] });
  assert.equal(refusal(mixed, "borrow"), "no-offer", "only a Civic market civ has citizens to borrow from");
});

test("repudiating the citizens: the cost is at home, the citizens close for 30 turns, standing loses 0.15", () => {
  const cr = me({ government: "GOVERNMENT_CLASSICAL_REPUBLIC", incomeCents: 30000, commerceSettlements: 2,
    happinessCents: 600 });
  const opened = plan({ civs: [cr, ai(AI)], requests: [{ kind: "borrow", borrower: ME, lender: "citizens",
    principal: 50000, term: 10 }] });
  const out = plan({ civs: [cr, ai(AI)], turn: 51, ledger: opened.ledger, macro: opened.macro,
    relations: [{ a: ME, b: AI, level: "neutral" }], requests: [{ kind: "repudiate", borrower: ME, lender: "citizens" }] });
  assert.deepEqual(out.celebration.map((r) => [r.amount, r.reason]), [[-6000, "citizens-repudiated"]]);
  assert.deepEqual(out.grievances, []);
  assert.deepEqual(out.relationships, [], "no witnesses care");
  assert.deepEqual(out.ledger.blocks, [{ lender: "citizens", borrower: ME, reason: "repudiation", agesLeft: null,
    untilTurn: 81 }]);
  assert.equal(out.ledger.repudiations[0].atWar, true, "counted at half, 0.15");
});

test("a Religious lender's loan is a partnership: its interest follows the borrower's income since it opened", () => {
  const civs = [me(), ai(AI, { government: "GOVERNMENT_THEOCRACY" })];
  const relations = [{ a: ME, b: AI, level: "neutral" }];
  const opened = plan({ civs, relations, requests: [{ kind: "borrow", borrower: ME, lender: AI, principal: 10000,
    term: 10 }] });
  const loan = opened.ledger.loans[0];
  assert.deepEqual([loan.partnership, loan.baseIncome], [true, 10000]);
  const flat = plan({ civs, relations, turn: 51, ledger: opened.ledger, macro: opened.macro });
  const grown = plan({ civs: [me({ incomeCents: 20000 }), civs[1]], relations, turn: 51, ledger: opened.ledger,
    macro: opened.macro });
  const interest = (p) => p.transfers.find((t) => t.reason === "payment").parts.interest;
  assert.equal(interest(grown), 2 * interest(flat));
  const plain = plan({ civs: [me(), ai(AI)], relations, requests: [{ kind: "borrow", borrower: ME, lender: AI,
    principal: 10000, term: 10 }] });
  assert.equal(plain.ledger.loans[0].partnership, undefined);
});

test("the AI's citizen rule: a Civic market AI short of 10 turns of income borrows from its citizens", () => {
  const civs = [me(), ai(AI, { government: "GOVERNMENT_CLASSICAL_REPUBLIC", balanceCents: 5000, commerceSettlements: 1 })];
  const out = plan({ civs });
  const loan = out.ledger.loans.find((l) => l.lender === "citizens");
  assert.ok(loan && loan.borrower === AI && loan.source === "ai-citizens", "opened by the rule");
  assert.equal(loan.principal, 46411, "the most whose first payment fits half of income");
  assert.ok(out.transfers.some((t) => t.from === "citizens" && t.to === AI && t.cents === 46411));
  const again = plan({ civs, turn: 51, ledger: out.ledger, macro: out.macro });
  assert.equal(again.ledger.loans.filter((l) => l.lender === "citizens").length, 1, "one at a time");
  const flush = plan({ civs: [me(), ai(AI, { government: "GOVERNMENT_CLASSICAL_REPUBLIC", commerceSettlements: 1 })] });
  assert.equal(flush.ledger.loans.length, 0, "a civ holding 10 turns of income doesn't");
});

test("the AI aids a Friendly civ in its own Depression; from Capitalism it invests in Neutral equity hosts", () => {
  const relations = [{ a: AI, b: OTHER, level: "friendly" }];
  const civs = [ai(AI), ai(OTHER, { balanceCents: 0 })];
  const aid = plan({ civs, relations, macro: macroWith({ e: 7500 }) });
  assert.ok(aid.events.some((e) => e.kind === "invest" && e.aid === 1 && e.borrower === OTHER));
  const calm = plan({ civs, relations });
  assert.equal(calm.events.some((e) => e.kind === "invest" && e.aid === 1), false);
  const city = { id: "9:1", build: "BUILDING_LIBRARY", neededProgress: 200 };
  const equity = [ai(AI, { stages: OPEN_MACRO }), ai(OTHER, { stages: OPEN_MACRO, balanceCents: 0, cities: [city] })];
  const neutral = plan({ civs: equity, relations: [{ a: AI, b: OTHER, level: "neutral" }] });
  assert.ok(neutral.events.some((e) => e.kind === "invest" && e.aid === 0 && e.borrower === OTHER));
  const early = plan({ civs: [ai(AI), ai(OTHER, { balanceCents: 0, cities: [city] })],
    relations: [{ a: AI, b: OTHER, level: "neutral" }] });
  assert.equal(early.events.some((e) => e.kind === "invest"), false, "before Capitalism, Friendly hosts only");
});

test("a Corporatist host takes development loans only; Mercantile investors earn a point more", () => {
  const relations = [{ a: ME, b: AI, level: "neutral" }];
  const host = ai(AI, { government: "GOVERNMENT_AUTHORITARIANISM", cities: [{ id: "6:1", build: "B", neededProgress: 50 }] });
  const general = plan({ civs: [me(), host], relations, requests: [{ kind: "invest", investor: ME, host: AI,
    form: "general", cents: 10000 }] });
  assert.equal(refusal(general, "invest"), "host-system");
  const project = plan({ civs: [me(), host], relations, requests: [{ kind: "invest", investor: ME, host: AI,
    form: "project", cents: 3000, cityId: "6:1" }] });
  assert.equal(refusal(project, "invest"), undefined);
  const mercantile = plan({ civs: [me({ government: "GOVERNMENT_PLUTOCRACY" }), ai(AI)], relations,
    requests: [{ kind: "invest", investor: ME, host: AI, form: "general", cents: 10000 }] });
  assert.equal(mercantile.ledger.investments[0].mille, 55);
});
