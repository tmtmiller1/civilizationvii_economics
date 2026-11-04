// The crisis paths (econ-policy.js, docs/CRISIS-PATHS-PROPOSAL-v6.md): who can take a card and why not, what taking
// it charges and opens, the obligations each turn and a breach, the lifecycle to an outcome, each path's objective,
// drift, the persistence rules (ids, a settled turn never settled twice, a gap settled turn by turn, the rows across
// a save), the AI's choice and war, hardship for Partisans, and the terms the cards set.
import test from "node:test";
import assert from "node:assert/strict";

import { planTurn } from "../ui/econ-plan.js";
import { emptyLedger, load, save } from "../ui/econ-state.js";
import { emptyMacro } from "../ui/econ-macro-state.js";
import { viewContext } from "../ui/econ-view-model.js";
import { hardshipPoints, objectiveOf, policyRefusal, policyView, priceOf, utilityOf } from "../ui/econ-policy.js";
import { POLICIES, policyById } from "../ui/econ-policy-catalog.js";
import { crisisTerms } from "../ui/econ-crisis-rows.js";
import { OPEN_MACRO, civ, input } from "./_fixtures.mjs";

const ME = 3;
const AI = 6;
const FOE = 9;
// The AI's Influence grew 20 a turn for five turns, so its forecast passes for any per-turn price.
const GROWING = [{ pid: AI, turn: 49, stocks: [100, 120, 140, 160, 180, 200] }];
const ON = { crises: true, cycle: "standard", systems: false, inflation: false, swings: "gentle" };
const DEPRESSION = () => ({ ...emptyMacro(), cycle: { ...emptyMacro().cycle, e: 7500 } });
const city = (id, over = {}) => ({ id, build: "BUILDING_LIBRARY", neededProgress: 500, population: 3,
  loc: `${id}`, orig: Number(id.split(":")[0]), ...over });
const democrat = (id, over = {}) => civ(id, { incomeCents: 10000, balanceCents: 200000, stages: OPEN_MACRO,
  ideology: "IDEOLOGY_DEMOCRACY", government: "GOVERNMENT_ELECTIVE_REPUBLIC", influence: 500, production: 40,
  cities: [city(`${id}:1`), city(`${id}:2`)], upkeepCents: 1500, strength: 10, ...over });
const MODERN = { age: "AGE_MODERN" };
const plan = (over = {}) => planTurn(input({ ...MODERN, ...over, options: { ...ON, ...(over.options || {}) } }));
const take = (policy, extra = {}) => ({ kind: "policy", pid: ME, policy, ...extra });
const refused = (out) => out.events.filter((e) => e.kind === "refused").map((e) => e.reason);
const ctxFor = (over = {}) => viewContext(input({ ...MODERN, ...over, options: { ...ON, ...(over.options || {}) } }));

/** Runs a plan, then `turns` more with the ledger and macro carried, the same civs and requests only on the first. */
function run(over, turns, each = () => ({})) {
  let out = plan(over);
  const outs = [out];
  for (let i = 1; i <= turns; i += 1) {
    out = plan({ ...over, requests: [], turn: (over.turn ?? 50) + i, ledger: out.ledger, macro: over.macroEach
      ? over.macroEach(i) : out.macro, markets: out.markets, ...each(i, out) });
    outs.push(out);
  }
  return outs;
}

// --- Who can take a card ----------------------------------------------------------------------------------------

test("a card is the owner's: refused to another ideology, in another age, outside a crisis, without Influence", () => {
  const spec = /** @type {any} */ (policyById("new-deal"));
  const ctx = ctxFor({ civs: [democrat(ME)], macro: DEPRESSION(), ledger: { ...emptyLedger(),
    crises: [{ pid: ME, kind: "depression", since: 48 }] } });
  assert.equal(policyRefusal(ctx, ctx.civ.get(ME), spec), null);
  const fascist = ctxFor({ civs: [democrat(ME, { ideology: "IDEOLOGY_FASCISM" })], ledger: { ...emptyLedger(),
    crises: [{ pid: ME, kind: "depression", since: 48 }] } });
  assert.equal(policyRefusal(fascist, fascist.civ.get(ME), spec), "not-yours");
  const calm = ctxFor({ civs: [democrat(ME)] });
  assert.equal(policyRefusal(calm, calm.civ.get(ME), spec), "no-crisis");
  const poor = ctxFor({ civs: [democrat(ME, { influence: 59 })], ledger: { ...emptyLedger(),
    crises: [{ pid: ME, kind: "depression", since: 48 }] } });
  assert.equal(policyRefusal(poor, poor.civ.get(ME), spec), "influence", "60 Influence asked, 59 held");
  const unread = ctxFor({ civs: [democrat(ME, { influence: null })], ledger: { ...emptyLedger(),
    crises: [{ pid: ME, kind: "depression", since: 48 }] } });
  assert.equal(policyRefusal(unread, unread.civ.get(ME), spec), "influence-unread");
  const antiquity = viewContext(input({ age: "AGE_ANTIQUITY", civs: [democrat(ME)], options: ON,
    ledger: { ...emptyLedger(), crises: [{ pid: ME, kind: "depression", since: 48 }] } }));
  assert.equal(policyRefusal(antiquity, antiquity.civ.get(ME), spec), "age");
});

test("every card names an owner, an age, a tier and the legacies its tier needs", () => {
  for (const spec of POLICIES) {
    assert.ok((spec.owners.government || spec.owners.ideology || []).length > 0, spec.id);
    assert.ok(["measure", "programme", "gamble"].includes(spec.tier), spec.id);
    if (spec.tier === "programme") {
      assert.ok(spec.path && spec.legacies.earned && spec.legacies.compromised && spec.legacies.abandoned, spec.id);
      assert.ok(spec.perTurnInfluence && spec.adminPct, `${spec.id}: a Programme has its upkeep`);
    }
  }
});

// --- Taking a card ------------------------------------------------------------------------------------------------

test("taking a Programme charges its Influence, opens its activation with a unique id and runs its responses", () => {
  const crises = [{ pid: ME, kind: "depression", since: 48 }];
  const out = plan({ civs: [democrat(ME, { human: true })], macro: DEPRESSION(), requests: [take("new-deal")],
    ledger: { ...emptyLedger(), crises } });
  assert.deepEqual(refused(out), []);
  assert.deepEqual(out.influence.filter((r) => r.reason === "policy").map((r) => r.amount), [-60, -6],
    "the price, then the first turn's 6");
  const row = out.ledger.policies[0];
  assert.deepEqual([row.card, row.pid, row.state, row.crisis], ["new-deal", ME, "active", "depression"]);
  assert.match(row.rid, /^3-\d+-1$/);
  assert.deepEqual(out.ledger.responses.filter((r) => r.pid === ME).map((r) => [r.id, r.costPct]),
    [["public-works", 50], ["relief", 50]]);
  assert.ok(out.transfers.some((t) => t.reason === "administration" && t.cents === 500), "5% of 100 Gold income");
  const again = plan({ civs: [democrat(ME, { human: true })], macro: DEPRESSION(), requests: [take("bank-regulation")],
    ledger: out.ledger, turn: 51 });
  assert.deepEqual(refused(again), ["programme-running"], "one Programme at a time");
});

test("a card taken again in a later crisis is a new activation with its own id", () => {
  const first = plan({ civs: [democrat(ME, { human: true })], requests: [take("lend-lease")],
    relations: [{ a: ME, b: FOE, level: "war" }, { a: AI, b: FOE, level: "war" }, { a: ME, b: AI, level: "friendly" }],
    ledger: { ...emptyLedger(), crises: [{ pid: ME, kind: "depression", since: 48 }] } });
  const civs = [democrat(ME, { human: true }), democrat(AI), democrat(FOE)];
  assert.equal(first.ledger.policies.length, 0, "no friend at war: refused");
  const withFriend = plan({ civs, requests: [take("lend-lease")], macro: DEPRESSION(),
    relations: [{ a: ME, b: FOE, level: "war" }, { a: AI, b: FOE, level: "war" }, { a: ME, b: AI, level: "friendly" }],
    ledger: { ...emptyLedger(), crises: [{ pid: ME, kind: "depression", since: 48 }] } });
  const rid1 = withFriend.ledger.policies[0].rid;
  const later = { ...withFriend.ledger, policies: [], crises: [{ pid: ME, kind: "depression", since: 90 }] };
  const second = plan({ civs, requests: [take("lend-lease")], turn: 91, ledger: later, macro: DEPRESSION(),
    relations: [{ a: ME, b: FOE, level: "war" }, { a: AI, b: FOE, level: "war" }, { a: ME, b: AI, level: "friendly" }] });
  assert.notEqual(second.ledger.policies[0].rid, rid1);
});

// --- Obligations, the lifecycle and the outcome --------------------------------------------------------------------

test("a Programme is Sustained after five turns and judged when its crisis ends: Earned on its objective", () => {
  const crises = [{ pid: ME, kind: "depression", since: 48 }];
  const outs = run({ civs: [democrat(ME, { human: true })], macro: DEPRESSION(), requests: [take("bank-regulation")],
    ledger: { ...emptyLedger(), crises } }, 6, (i) => (i < 6 ? { macro: DEPRESSION() } : { macro: { ...emptyMacro() } }));
  const states = outs.map((o) => o.ledger.policies[0]?.state ?? "-");
  assert.deepEqual(states.slice(0, 6), ["active", "active", "active", "active", "active", "sustained"]);
  const last = outs[6];
  const outcome = last.events.find((e) => e.kind === "policy-outcome");
  assert.ok(outcome, "judged once the crisis has ended");
  assert.equal(outcome.outcome, "earned", "no debt, no default, no new loans: the objective held");
  assert.ok(last.ledger.legacies.some((l) => l.pid === ME && l.id === "path-bank-earned"));
  assert.deepEqual(last.ledger.pathResults.map((r) => [r.path, r.outcome]), [["financial-reform", "earned"]]);
  assert.equal(last.ledger.affinity[0].steps["financial-reform"], -1, "drift: the earned path a step cheaper");
});

test("an obligation the civ can't meet puts the Programme in arrears; the fourth turn short abandons it", () => {
  const crises = [{ pid: ME, kind: "depression", since: 48 }];
  let broke = plan({ civs: [democrat(ME, { human: true })], macro: DEPRESSION(), requests: [take("bank-regulation")],
    ledger: { ...emptyLedger(), crises } });
  for (let turn = 51; turn <= 53; turn += 1) {
    broke = plan({ civs: [democrat(ME, { human: true, influence: 2 })], macro: DEPRESSION(), turn,
      ledger: broke.ledger });
    assert.equal(broke.ledger.policies.length, 1);
  }
  broke = plan({ civs: [democrat(ME, { human: true, influence: 2 })], macro: DEPRESSION(), turn: 54,
    ledger: broke.ledger });
  assert.equal(broke.ledger.policies.length, 0);
  assert.equal(broke.events.find((e) => e.kind === "policy-outcome")?.outcome, "abandoned");
});

test("the player ends a Programme early: Abandoned; a Measure ended early just ends", () => {
  const crises = [{ pid: ME, kind: "depression", since: 48 }];
  const first = plan({ civs: [democrat(ME, { human: true })], macro: DEPRESSION(), requests: [take("new-deal")],
    ledger: { ...emptyLedger(), crises } });
  const ended = plan({ civs: [democrat(ME, { human: true })], macro: DEPRESSION(), turn: 51, ledger: first.ledger,
    requests: [take("new-deal", { cancel: true })] });
  assert.equal(ended.events.find((e) => e.kind === "policy-outcome")?.outcome, "abandoned");
  assert.ok(ended.ledger.legacies.some((l) => l.id === "path-newdeal-abandoned"));
});

test("one awarded path per crisis: a second Programme is refused once the first is judged in the same crisis", () => {
  const ctx = ctxFor({ civs: [democrat(ME)], ledger: { ...emptyLedger(),
    crises: [{ pid: ME, kind: "depression", since: 48 }],
    pathResults: [{ pid: ME, path: "financial-reform", card: "bank-regulation", outcome: "earned", turn: 49,
      crisis: "depression", crisisSince: 48 }] } });
  assert.equal(policyRefusal(ctx, ctx.civ.get(ME), /** @type {any} */ (policyById("new-deal"))), "path-awarded");
});

// --- Objectives -------------------------------------------------------------------------------------------------

test("the objectives read the Programme's own record: public investment, the war economy, the company state", () => {
  const ctx = ctxFor({ civs: [democrat(ME)] });
  const civ3 = ctx.civ.get(ME);
  const newDeal = /** @type {any} */ (policyById("new-deal"));
  const row = { card: "new-deal", c: { prod: 40, added: 20, cut: false, reliefEnded: false } };
  assert.equal(objectiveOf(ctx, civ3, newDeal, /** @type {any} */ (row)).met, true, "20 points against half of 40");
  assert.equal(objectiveOf(ctx, civ3, newDeal, /** @type {any} */ ({ ...row, c: { ...row.c, added: 19 } })).met, false);
  assert.equal(objectiveOf(ctx, civ3, newDeal, /** @type {any} */ ({ ...row, c: { ...row.c, cut: true } })).met, false);
  const war = /** @type {any} */ (policyById("foreign-adventure"));
  const base = { c: { inc: 10000, everWar: true, warTurns: 3, lost: false, locs: ["3:1", "3:2"], str: 10 }, debt: 0 };
  assert.equal(objectiveOf(ctx, civ3, war, /** @type {any} */ (base)).met, true, "war over, nothing lost, strength held");
  assert.equal(objectiveOf(ctx, civ3, war, /** @type {any} */ ({ ...base, debt: 60000 })).met, false, "debt past 5 turns");
  assert.equal(objectiveOf(ctx, civ3, war, /** @type {any} */ ({ ...base, c: { ...base.c, everWar: false } })).met, false);
  const taken = ctxFor({ civs: [democrat(ME, { atWar: true, cities: [city("3:1"), city("3:2"), city("3:9",
    { loc: "9,9", orig: FOE })] })] });
  assert.equal(objectiveOf(taken, taken.civ.get(ME), war, /** @type {any} */ (base)).met, true, "a settlement taken");
  const charter = /** @type {any} */ (policyById("merchant-charter"));
  const routes = ctxFor({ civs: [democrat(ME)], routes: [{ importer: ME, exporter: AI, resources: [] },
    { importer: AI, exporter: ME, resources: [] }] });
  const crow = { c: { routes: 1, prod: 40, added: 10, maxStreak: 3 } };
  assert.equal(objectiveOf(routes, routes.civ.get(ME), charter, /** @type {any} */ (crow)).met, true,
    "two of three: a route more and a quarter turn's production");
  assert.equal(objectiveOf(routes, routes.civ.get(ME), charter, /** @type {any} */ ({ c: { ...crow.c, added: 9 } })).met,
    false, "one of three");
});

test("a hold part asks for the turns the Programme ran, up to ten: a five-turn crisis can meet it", () => {
  const charter = /** @type {any} */ (policyById("merchant-charter"));
  const one = ctxFor({ turn: 50, civs: [democrat(ME)], routes: [{ importer: ME, exporter: AI, resources: [] }] });
  const held = { since: 45, c: { routes: 1, prod: 40, added: 10, maxStreak: 5 } };
  assert.equal(objectiveOf(one, one.civ.get(ME), charter, /** @type {any} */ (held)).met, true, "five of five turns");
  assert.equal(objectiveOf(one, one.civ.get(ME), charter, /** @type {any} */ ({ ...held, c: { ...held.c, maxStreak: 4 } }))
    .met, false, "a route lost for a turn");
  const long = { since: 30, c: { ...held.c, maxStreak: 10 } };
  assert.equal(objectiveOf(one, one.civ.get(ME), charter, /** @type {any} */ (long)).met, true, "ten is the most it asks");
  const war = /** @type {any} */ (policyById("foreign-adventure"));
  const fight = ctxFor({ turn: 50, civs: [democrat(ME, { atWar: true, strength: 2 })] });
  const row = { since: 45, debt: 0, c: { inc: 10000, everWar: true, warTurns: 5, lost: false, locs: ["3:1", "3:2"], str: 10 } };
  assert.equal(objectiveOf(fight, fight.civ.get(ME), war, /** @type {any} */ (row)).met, true, "at war the whole run");
  assert.equal(objectiveOf(fight, fight.civ.get(ME), war, /** @type {any} */ ({ ...row, c: { ...row.c, lost: true } })).met,
    false, "a settlement lost");
});

test("Debt into shares is tested five turns after its crisis ends, against 0.85", () => {
  const plutocrat = civ(ME, { human: true, incomeCents: 10000, balanceCents: 200000, stages: OPEN_MACRO,
    government: "GOVERNMENT_PLUTOCRACY", influence: 500, production: 40, cities: [city("3:1")] });
  const loans = [{ id: "L1", kind: "loan", lender: "bond", borrower: ME, principal: 150000, outstanding: 150000,
    ratePpm: 15000, term: 20, missed: 0, state: "active", source: "bond", since: 40 }];
  const at = (e) => run({ age: "AGE_EXPLORATION", civs: [plutocrat], requests: [take("debt-into-shares")],
    macro: { ...emptyMacro(), cycle: { ...emptyMacro().cycle, e: 7500 } }, macroEach: (i) => ({ ...emptyMacro(),
      cycle: { ...emptyMacro().cycle, e: i < 2 ? 7500 : e } }),
    ledger: { ...emptyLedger(), loans, crises: [{ pid: ME, kind: "debt", since: 48 }] } }, 9,
  (i, out) => (i >= 2 ? { ledger: { ...out.ledger, crises: out.ledger.crises.filter((c) => c.pid !== ME) } } : {}));
  const turned = (outs) => outs.findIndex((o) => o.events.some((ev) => ev.kind === "policy-turned"));
  const ended = (outs) => outs.findIndex((o) => o.events.some((ev) => ev.kind === "policy-ended"
    && ev.policy === "debt-into-shares"));
  const weak = at(8200);
  assert.ok(weak[0].ledger.policies.some((r) => r.card === "debt-into-shares"), "taken");
  assert.equal(turned(weak), 7, "the crisis closes at the second turn, the test comes five turns on");
  const strong = at(9500);
  assert.equal(turned(strong), -1, "a clean recovery keeps the write-off");
  assert.equal(ended(strong), 7);
});

test("Lend-lease needs only a civilization you know at war, and the panel names an Influence shortfall", () => {
  const crises = [{ pid: ME, kind: "depression", since: 48 }];
  const out = plan({ civs: [democrat(ME, { human: true }), democrat(AI), democrat(FOE)], requests: [take("lend-lease")],
    relations: [{ a: AI, b: FOE, level: "war" }, { a: ME, b: AI, level: "friendly" }], macro: DEPRESSION(),
    ledger: { ...emptyLedger(), crises } });
  assert.ok(out.ledger.policies.some((r) => r.card === "lend-lease"), "taken while at peace");
  const ctx = ctxFor({ civs: [democrat(ME, { influence: 17 })], macro: DEPRESSION(), ledger: { ...emptyLedger(), crises } });
  const card = policyView(ctx, ME)?.cards.find((c) => c.id === "new-deal");
  assert.equal(card?.refusal, "influence");
  assert.equal(card?.stock, 17);
});

test("an institution founded under 0.80 is at best Compromised", () => {
  const crises = [{ pid: ME, kind: "debt", since: 48 }];
  const deep = { ...emptyMacro(), cycle: { ...emptyMacro().cycle, e: 7000 } };
  const outs = run({ civs: [democrat(ME, { human: true })], macro: deep, requests: [take("bank-regulation")],
    ledger: { ...emptyLedger(), crises } }, 6, () => ({ macro: deep }), );
  const lastRow = outs[5].ledger;
  const ended = plan({ civs: [democrat(ME, { human: true })], macro: deep, turn: 57,
    ledger: { ...lastRow, crises: [] } });
  assert.equal(ended.events.find((e) => e.kind === "policy-outcome")?.outcome, "compromised");
});

// --- Persistence -------------------------------------------------------------------------------------------------

test("a turn already settled isn't settled again; a three-turn gap settles each missed turn once", () => {
  const crises = [{ pid: ME, kind: "depression", since: 48 }];
  const first = plan({ civs: [democrat(ME, { human: true })], macro: DEPRESSION(), requests: [take("bank-regulation")],
    ledger: { ...emptyLedger(), crises } });
  const same = plan({ civs: [democrat(ME, { human: true })], macro: DEPRESSION(), turn: 50, ledger: first.ledger });
  assert.deepEqual(same.influence.filter((r) => r.reason === "policy"), [], "turn 50 was settled the turn it was taken");
  const gap = plan({ civs: [democrat(ME, { human: true })], macro: DEPRESSION(), turn: 53, ledger: first.ledger });
  assert.deepEqual(gap.influence.filter((r) => r.reason === "policy").map((r) => r.amount), [-4, -4, -4],
    "turns 51, 52 and 53, once each");
});

test("the paths' rows survive a save and a load, and a junk row is dropped", () => {
  const crises = [{ pid: ME, kind: "depression", since: 48 }];
  const out = plan({ civs: [democrat(ME, { human: true })], macro: DEPRESSION(), requests: [take("new-deal")],
    ledger: { ...emptyLedger(), crises } });
  const loaded = load(save(out.ledger)).ledger;
  assert.deepEqual(loaded.policies.map((r) => [r.rid, r.card, r.state, r.settled]),
    out.ledger.policies.map((r) => [r.rid, r.card, r.state, r.settled]));
  assert.deepEqual(loaded.policies[0].c.locs, out.ledger.policies[0].c.locs);
  assert.equal(loaded.policySeq, out.ledger.policySeq);
  assert.deepEqual(loaded.responses.filter((r) => r.pid === ME).map((r) => r.costPct), [50, 50]);
  assert.ok(loaded.crisisTurns.some((r) => r.id === "policy:new-deal"), "the once-per-crisis record keeps");
  const junk = load(JSON.stringify({ mod: "tower-economics", v: 1, ledger: { ...out.ledger,
    policies: [{ rid: 5 }, ...out.ledger.policies] } })).ledger;
  assert.equal(junk.policies.length, 1);
});

// --- The AI -------------------------------------------------------------------------------------------------------

test("the AI takes its best card with the means for it, never a Programme without the reserve", () => {
  const crises = [{ pid: AI, kind: "depression", since: 48 }];
  const out = plan({ civs: [democrat(AI)], macro: DEPRESSION(), ledger: { ...emptyLedger(), crises, influenceLog: GROWING } });
  const taken = out.events.filter((e) => e.kind === "policy");
  assert.equal(taken.length, 1);
  assert.equal(taken[0].source, "ai");
  const thin = plan({ civs: [democrat(AI, { influence: 30 })], macro: DEPRESSION(), ledger: { ...emptyLedger(), crises, influenceLog: GROWING } });
  assert.equal(thin.events.filter((e) => e.kind === "policy" && policyById(e.policy)?.tier === "programme").length, 0);
});

test("an AI that commits to Foreign adventure at peace declares on the weakest met major it isn't friendly with", () => {
  const fascist = (id, over = {}) => democrat(id, { ideology: "IDEOLOGY_FASCISM", government: "GOVERNMENT_AUTHORITARIANISM",
    ...over });
  const crises = [{ pid: AI, kind: "depression", since: 48 }];
  const ctx = ctxFor({ civs: [fascist(AI, { strength: 30 }), democrat(FOE, { strength: 4 })],
    relations: [{ a: AI, b: FOE, level: "neutral" }], macro: DEPRESSION(), ledger: { ...emptyLedger(), crises, influenceLog: GROWING } });
  const u = utilityOf(ctx, ctx.civ.get(AI), /** @type {any} */ (policyById("foreign-adventure")));
  assert.ok(Number.isFinite(u));
  const out = plan({ civs: [fascist(AI, { strength: 30, influence: 900, balanceCents: 900000 }), democrat(FOE, { strength: 4 })],
    relations: [{ a: AI, b: FOE, level: "neutral" }], macro: DEPRESSION(), ledger: { ...emptyLedger(), crises, influenceLog: GROWING } });
  const took = out.events.find((e) => e.kind === "policy" && e.pid === AI)?.policy;
  if (took === "foreign-adventure") assert.deepEqual(out.wars, [{ a: AI, b: FOE }]);
  else assert.deepEqual(out.wars, []);
});

test("a strong Fascist state at peace weighs a war as cheap; an even match doesn't", () => {
  const fascist = (id, over = {}) => democrat(id, { ideology: "IDEOLOGY_FASCISM", government: "GOVERNMENT_AUTHORITARIANISM",
    ...over });
  const crises = [{ pid: AI, kind: "depression", since: 48 }];
  const at = (strength) => {
    const ctx = ctxFor({ civs: [fascist(AI, { strength, influence: 900, balanceCents: 900000 }), democrat(FOE, { strength: 10 })],
      relations: [{ a: AI, b: FOE, level: "neutral" }], macro: DEPRESSION(), ledger: { ...emptyLedger(), crises, influenceLog: GROWING } });
    return utilityOf(ctx, ctx.civ.get(AI), /** @type {any} */ (policyById("foreign-adventure")));
  };
  assert.ok(at(15) > at(14), "half again as strong: the war costs a turn of income, not four");
  const out = plan({ civs: [fascist(AI, { strength: 30, influence: 900, balanceCents: 900000 }), democrat(FOE, { strength: 4 })],
    relations: [{ a: AI, b: FOE, level: "neutral" }], macro: DEPRESSION(), ledger: { ...emptyLedger(), crises, influenceLog: GROWING } });
  assert.equal(out.events.find((e) => e.kind === "policy" && e.pid === AI)?.policy, "foreign-adventure");
  assert.deepEqual(out.wars, [{ a: AI, b: FOE }]);
});

test("a reload decides the same: the AI's jitter is seeded by the civ, its crisis and the card", () => {
  const crises = [{ pid: AI, kind: "depression", since: 48 }];
  const once = plan({ civs: [democrat(AI)], macro: DEPRESSION(), ledger: { ...emptyLedger(), crises, influenceLog: GROWING } });
  const twice = plan({ civs: [democrat(AI)], macro: DEPRESSION(), ledger: { ...emptyLedger(), crises, influenceLog: GROWING } });
  assert.deepEqual(once.events.filter((e) => e.kind === "policy").map((e) => e.policy),
    twice.events.filter((e) => e.kind === "policy").map((e) => e.policy));
});

// --- Terms, hardship, the view ------------------------------------------------------------------------------------

test("a running Programme raises its own rates a quarter; Bank regulation lowers them and cuts the credit limit", () => {
  const ctx = ctxFor({ civs: [democrat(ME)], ledger: { ...emptyLedger(),
    policies: [{ rid: "x", card: "bank-regulation", pid: ME, crisis: "depression", crisisSince: 48, since: 49,
      until: null, state: "active", settled: 49, c: { locs: [] } }] } });
  const t = crisisTerms(ctx, ME);
  assert.equal(t.ownRatePct, 80);
  assert.equal(t.capTurns, -2);
  const nd = ctxFor({ civs: [democrat(ME)], ledger: { ...emptyLedger(),
    policies: [{ rid: "y", card: "new-deal", pid: ME, crisis: "depression", crisisSince: 48, since: 49,
      until: null, state: "active", settled: 49, c: { locs: [] } }] } });
  assert.equal(crisisTerms(nd, ME).ownRatePct, 125);
});

test("hardship for Partisans: 2 a tenth under 0.80 up to 6, halved under relief, +3 under austerity at any index", () => {
  assert.equal(hardshipPoints({ index: 8000, relief: false, austerity: false }), 0);
  assert.equal(hardshipPoints({ index: 7000, relief: false, austerity: false }), 2);
  assert.equal(hardshipPoints({ index: 5000, relief: false, austerity: false }), 6);
  assert.equal(hardshipPoints({ index: 4000, relief: false, austerity: false }), 6, "capped");
  assert.equal(hardshipPoints({ index: 6000, relief: true, austerity: false }), 2);
  assert.equal(hardshipPoints({ index: 7000, relief: false, austerity: true }), 5);
  assert.equal(hardshipPoints({ index: 9000, relief: false, austerity: true }), 3, "a debt crisis under Austerity");
  assert.equal(hardshipPoints({ index: 4000, relief: false, austerity: true }), 9, "the most there is");
  assert.equal(hardshipPoints({ index: 6000, relief: true, austerity: true }), 5, "Relief halves the Depression's share only");
  const debt = plan({ civs: [democrat(ME, { human: true })], ledger: { ...emptyLedger(),
    crises: [{ pid: ME, kind: "debt", since: 48 }],
    responses: [{ pid: ME, id: "austerity", crisis: "debt", since: 48, until: null }] } });
  assert.equal(debt.hardship[String(ME)], 3, "Austerity in a debt crisis with the index at Steady");
  const out = plan({ civs: [democrat(ME, { human: true })], macro: { ...emptyMacro(), cycle: { ...emptyMacro().cycle, e: 6000 } } });
  assert.ok(out.hardship[String(ME)] >= 2 && out.hardship[String(ME)] <= 6, "a deep Depression shows in the plan's rows");
  const calm = plan({ civs: [democrat(ME, { human: true })] });
  assert.deepEqual(calm.hardship, {});
});

test("the view: the civ's own cards with prices, a running card with its state, minimum and objective parts", () => {
  const crises = [{ pid: ME, kind: "depression", since: 48 }];
  const out = plan({ civs: [democrat(ME, { human: true })], macro: DEPRESSION(), requests: [take("new-deal")],
    ledger: { ...emptyLedger(), crises } });
  const ctx = ctxFor({ civs: [democrat(ME)], ledger: out.ledger, turn: 52, macro: DEPRESSION() });
  const view = policyView(ctx, ME);
  assert.deepEqual(view.cards.map((c) => c.id), ["new-deal", "bank-regulation", "lend-lease"]);
  assert.equal(view.cards[0].refusal, "running");
  assert.equal(view.cards[1].refusal, "programme-running");
  assert.deepEqual([view.running[0].id, view.running[0].state, view.running[0].minLeft], ["new-deal", "active", 3]);
  assert.deepEqual(view.running[0].parts.map((p) => p.id), ["grants-landed", "production", "relief-held"]);
  assert.equal(priceOf(ctx, ctx.civ.get(ME), /** @type {any} */ (policyById("new-deal"))), 60);
});

test("the shared cards by affinity: a quarter off the Gold for an advantage, 10 Influence for an opposition", () => {
  const civs = [democrat(ME, { human: true })];
  const crises = [{ pid: ME, kind: "credit-panic", since: 48 }];
  const market = (sys) => ({ ...DEPRESSION(), systems: { [String(ME)]: { system: sys, from: "mixed", since: 1 } } });
  const insured = plan({ civs, requests: [{ kind: "respond", pid: ME, response: "deposit-insurance" }],
    macro: market("market"), options: { systems: true }, ledger: { ...emptyLedger(), crises } });
  const paid = insured.transfers.find((t) => t.reason === "response");
  assert.equal(paid?.cents, Math.round(2 * 10000 * 0.75), "deposit insurance is a market's: 2 turns of income less a quarter");
  const holiday = plan({ civs, requests: [{ kind: "respond", pid: ME, response: "bank-holiday" }],
    macro: market("market"), options: { systems: true }, ledger: { ...emptyLedger(), crises } });
  assert.deepEqual(holiday.influence.filter((r) => r.reason === "opposition").map((r) => r.amount), [-10],
    "a market resists a bank holiday");
});

test("the AI weighs a Gamble by where its test will stand: deep in a Depression, the assembly isn't worth it", () => {
  const republic = (over = {}) => civ(ME, { incomeCents: 10000, balanceCents: 200000, stages: OPEN_MACRO,
    government: "GOVERNMENT_CLASSICAL_REPUBLIC", influence: 500, production: 40, cities: [], ...over });
  const ctxAt = (e, kind = "depression") => {
    const ctx = viewContext(input({ age: "AGE_ANTIQUITY", civs: [republic()], options: ON,
      macro: { ...emptyMacro(), cycle: { ...emptyMacro().cycle, e } },
      ledger: { ...emptyLedger(), crises: [{ pid: ME, kind, since: 48 }] } }));
    ctx.readings = { ...(ctx.readings || {}), civ: new Map([[ME, { index: e, phase: "depression" }]]) };
    return ctx;
  };
  const spec = /** @type {any} */ (policyById("assembly-speaks"));
  const deep = ctxAt(7000);
  const mild = ctxAt(8600, "debt");
  assert.ok(utilityOf(deep, deep.civ.get(ME), spec) <= 0, "at 0.70 the test will fail: not worth taking");
  assert.ok(utilityOf(mild, mild.civ.get(ME), spec) > utilityOf(deep, deep.civ.get(ME), spec),
    "a debt crisis at 0.86 passes the test: worth more");
});
