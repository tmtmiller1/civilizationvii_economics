import test from "node:test";
import assert from "node:assert/strict";

import { planTurn, projectBalances } from "../ui/econ-plan.js";
import { grantsFor } from "../ui/econ-conservation.js";
import { makeLoan } from "../ui/econ-loan.js";
import { emptyLedger } from "../ui/econ-state.js";
import { CLOSED, PARAMS, civ, input } from "./_fixtures.mjs";
import { step, world } from "./_sim.mjs";

const ME = 3;
const borrow = (over = {}) => ({ kind: "borrow", borrower: ME, lender: "bond", principal: 30000, term: 20, ...over });
const ledgerWith = (loans, over = {}) => ({ ...emptyLedger(), loans, nextId: loans.length + 1, ...over });
const loan = (id, over = {}) => ({ ...makeLoan({ id, lender: "bond", borrower: ME, principal: 30000, ratePpm: 20000,
  term: 20, turn: 1 }), ...over });
const me = (over = {}) => civ(ME, { human: true, incomeCents: 10000, ...over });
const refusal = (plan) => plan.events.find((e) => e.kind === "refused")?.reason;

test("borrow from the bond market: principal arrives this turn, the first payment is next turn", () => {
  const plan = planTurn(input({ civs: [me()], requests: [borrow()] }));
  assert.deepEqual(plan.transfers.map((t) => [t.from, t.to, t.cents, t.reason]), [["bond", ME, 30000, "principal"]]);
  assert.equal(plan.ledger.loans[0].ratePpm, 20000);
  assert.equal(plan.ledger.loans[0].source, "borrow");
  assert.equal(plan.ledger.loans[0].emergency, false);
  const next = planTurn(input({ turn: 51, ledger: plan.ledger, civs: [me()] }));
  assert.deepEqual(next.transfers.map((t) => [t.reason, t.cents]), [["payment", 600 + 1500]]);
});

test("borrow from a civ: the principal is a civ pair, at that civ's relation rate", () => {
  const civs = [me(), civ(6, { balanceCents: 60000, depthTurns: 2 })];
  const relations = [{ a: 6, b: ME, level: "friendly" }];
  const plan = planTurn(input({ civs, relations, requests: [borrow({ lender: 6 })] }));
  assert.deepEqual(grantsFor(plan.transfers).map((g) => [g.pid, g.cents]), [[6, -30000], [ME, 30000]]);
  assert.equal(plan.ledger.loans[0].ratePpm, 8000);
  assert.equal(plan.batch.civs.find((c) => c.pid === 6).net, -30000);
});

test("borrow refusals: the credit cap, the debt-service limit, bad terms, a lender at war or short, a dead party", () => {
  const civs = [me({ incomeCents: 1000 }), civ(6, { balanceCents: 20000 }), civ(7, { alive: false })];
  const rel = [{ a: 6, b: ME, level: "war" }];
  const reason = (r, rr = rel, extra = {}) => refusal(planTurn(input({ civs, relations: rr, requests: [r], ...extra })));
  assert.equal(reason(borrow({ principal: 12001 })), "credit-cap");
  assert.equal(reason(borrow({ principal: 12000 })), "service-cap", "first payment 480 + 600 > 350");
  assert.equal(reason(borrow({ principal: 3500, term: 20 })), undefined, "140 + 175 fits 350");
  assert.equal(reason(borrow({ principal: 1000, term: 15 })), "terms");
  assert.equal(reason(borrow({ principal: 1000, lender: 6 })), "no-offer");
  assert.equal(reason(borrow({ principal: 12000, lender: 6 }), []), "no-offer", "20000 < 2 * 12000");
  assert.equal(reason(borrow({ principal: 1000, lender: 7 })), "lender");
  assert.equal(reason(borrow({ principal: 1000, borrower: 7 })), "borrower");
});

test("term refusals name the gate: Moneylending for 20, Public debt and a lender's Bank for 30, a repudiation", () => {
  const noPd = { moneylending: 0, publicDebt: null };
  const civs = [me({ stages: noPd }), civ(6, { balanceCents: 1e6 })];
  assert.equal(refusal(planTurn(input({ civs, requests: [borrow({ lender: 6, principal: 1000, term: 30 })] }))),
    "term-stage");
  assert.equal(refusal(planTurn(input({ civs, requests: [borrow({ lender: 6, principal: 1000, term: 20 })] }))),
    undefined, "Moneylending opens 20-turn terms from a civ");
  const pd = [me(), civ(6, { balanceCents: 1e6 }), civ(8, { balanceCents: 1e6, depthTurns: 2 })];
  assert.equal(refusal(planTurn(input({ civs: pd, requests: [borrow({ lender: 6, principal: 1000, term: 30 })] }))),
    "term-banking");
  assert.equal(refusal(planTurn(input({ civs: pd, requests: [borrow({ lender: 8, principal: 1000, term: 30 })] }))),
    undefined);
  const rep = ledgerWith([], { repudiations: [{ pid: ME, lender: 9, turn: 40, cents: 1, atWar: false }] });
  assert.equal(refusal(planTurn(input({ ledger: rep, civs: pd, requests: [borrow({ principal: 1000, term: 20 })] }))),
    "term-repudiation");
});

test("a miss: -5 Influence, the rate rises, the interest joins O, a notice for the player; no Gold moves", () => {
  const plan = planTurn(input({ ledger: ledgerWith([loan("L1")]), civs: [me({ balanceCents: 0, incomeCents: 2099 })] }));
  assert.deepEqual(plan.transfers, []);
  assert.deepEqual(plan.influence, [{ pid: ME, amount: -5, loanId: "L1", reason: "miss" }]);
  assert.equal(plan.ledger.loans[0].ratePpm, 25000);
  assert.equal(plan.ledger.loans[0].outstanding, 30600);
  assert.equal(plan.notices[0].kind, "miss");
  assert.deepEqual(plan.ledger.misses, [{ pid: ME, turn: 50, n: 1 }]);
  assert.equal(plan.batch.civs[0].influence, -5);
});

test("funds for the turn: balance + income - payment >= 0 pays; a paid turn resets the run of misses", () => {
  const pays = planTurn(input({ ledger: ledgerWith([loan("L1", { missed: 2 })]),
    civs: [me({ balanceCents: -100, incomeCents: 2200 })] }));
  assert.equal(pays.transfers[0].cents, 2100);
  assert.deepEqual(pays.influence, []);
  assert.equal(pays.ledger.loans[0].missed, 0);
});

test("payments run oldest loan first, each all or nothing; a later small one can still be paid", () => {
  const big = loan("L1", { opened: 1 });
  const small = loan("L2", { opened: 2, principal: 1000, outstanding: 1000, term: 10 });
  const plan = planTurn(input({ ledger: ledgerWith([small, big]), civs: [me({ balanceCents: 0, incomeCents: 2000 })] }));
  assert.deepEqual(plan.transfers.map((t) => t.loanId), ["L2"]);
  assert.deepEqual(plan.influence.map((i) => i.loanId), ["L1"]);
});

test("the third miss in a row defaults: chronicle event, the lender blocked for the age, garnish from next turn", () => {
  const civs = [me({ balanceCents: 0, incomeCents: 0 }), civ(6, { balanceCents: 1e6 })];
  const plan = planTurn(input({ ledger: ledgerWith([loan("L1", { lender: 6, missed: 2 })]), civs }));
  assert.equal(plan.events.find((e) => e.kind === "default").chronicle, 1);
  assert.deepEqual(plan.ledger.blocks, [{ lender: 6, borrower: ME, reason: "default", agesLeft: 0, untilTurn: null }]);
  assert.equal(plan.ledger.loans[0].state, "default");
  assert.equal(plan.ledger.loans[0].outstanding, 30600);
  assert.equal(plan.notices.some((n) => n.kind === "default"), true);
  const again = planTurn(input({ turn: 51, ledger: plan.ledger, requests: [borrow({ principal: 100, lender: 6 })],
    civs: [me({ balanceCents: 0, incomeCents: 4000 }), civ(6, { balanceCents: 1e6 })] }));
  assert.equal(refusal(again), "no-offer");
  const g = again.transfers.find((t) => t.reason === "garnish");
  assert.deepEqual([g.from, g.to, g.cents], [ME, 6, 2000], "min(ceil(30600 * 0.1), 0.5 * 4000, cash 4000)");
});

test("garnish is bound by cash, and a civ with income at or below 0 pays from its balance (finding C)", () => {
  const d = loan("L1", { lender: 6, state: "default", missed: 3, outstanding: 10000 });
  const civs = (over) => [me(over), civ(6, { balanceCents: 1e6 })];
  const tight = planTurn(input({ ledger: ledgerWith([d]), civs: civs({ balanceCents: -3500, incomeCents: 4000 }) }));
  assert.equal(tight.transfers[0].cents, 500, "only the 500 the turn leaves");
  const low = planTurn(input({ ledger: ledgerWith([d]), civs: civs({ balanceCents: 8000, incomeCents: 0 }) }));
  assert.equal(low.transfers[0].cents, 500, "min(ceil(10000 * 0.05), floor(0.1 * 8000))");
  const broke = planTurn(input({ ledger: ledgerWith([d]), civs: civs({ balanceCents: -10, incomeCents: -5 }),
    options: { guard: false } }));
  assert.deepEqual(broke.transfers, []);
});

test("garnish is taken before scheduled payments", () => {
  const d = loan("L1", { state: "default", missed: 3, opened: 5, outstanding: 10000 });
  const a = loan("L2", { opened: 1, principal: 10000, outstanding: 10000, term: 10, ratePpm: 10000 });
  const plan = planTurn(input({ ledger: ledgerWith([a, d]), civs: [me({ balanceCents: 0, incomeCents: 1200 })] }));
  assert.deepEqual(plan.transfers.map((t) => [t.loanId, t.reason, t.cents]), [["L1", "garnish", 600]]);
  assert.equal(plan.influence[0].loanId, "L2", "1100 due, 600 left after the garnish; paid first it would fit");
});

test("restructuring (DESIGN 4.4): the player's overdue loan gets a new 10-turn schedule, standing takes a miss", () => {
  const overdue = loan("L1", { missed: 2, outstanding: 30600, ratePpm: 31250, paid: 4 });
  const req = { kind: "restructure", loanId: "L1", pid: ME };
  const plan = planTurn(input({ ledger: ledgerWith([overdue]), civs: [me({ balanceCents: 1e6 })], requests: [req] }));
  const l = plan.ledger.loans[0];
  assert.deepEqual([l.principal, l.term, l.missed, l.restructured, l.ratePpm], [30600, 10, 0, true, 31250]);
  assert.equal(plan.transfers[0].parts.amortisation, 3060, "this turn's payment is already on the new schedule");
  assert.deepEqual(plan.ledger.misses, [{ pid: ME, turn: 50, n: 1 }]);
  assert.equal(plan.events[0].kind, "restructure");
  const why = (ledger, over = {}) => refusal(planTurn(input({ ledger, civs: [me(over)], requests: [req] })));
  assert.equal(why(ledgerWith([loan("L1")])), "not-overdue");
  assert.equal(why(ledgerWith([loan("L1", { missed: 1, restructured: true })])), "not-overdue", "once per loan");
  assert.equal(why(ledgerWith([loan("L1", { missed: 1 })]), { incomeCents: 0 }), "income");
  assert.equal(refusal(planTurn(input({ ledger: ledgerWith([loan("L1", { missed: 1 })]), civs: [me(), civ(9)],
    requests: [{ ...req, pid: 9 }] }))), "parties");
});

test("restructuring by the AI rule: at m = 2 by itself with a bond or AI lender; a human lender is asked", () => {
  const ai = civ(4, { balanceCents: 0, incomeCents: 500 });
  const byRule = planTurn(input({ ledger: ledgerWith([loan("L1", { borrower: 4, missed: 2 })]), civs: [me(), ai] }));
  assert.equal(byRule.ledger.loans[0].restructured, true);
  const owedToMe = ledgerWith([loan("L1", { borrower: 4, lender: ME, missed: 2 })]);
  const asked = planTurn(input({ ledger: owedToMe, civs: [me(), ai] }));
  assert.equal(asked.ledger.loans[0].restructured, false);
  assert.deepEqual(asked.notices.filter((n) => n.kind === "restructure-ask"), [{ pid: ME, kind: "restructure-ask",
    loanId: "L1", borrower: 4 }]);
  const agreed = planTurn(input({ ledger: owedToMe, civs: [me(), ai],
    requests: [{ kind: "restructure", loanId: "L1", pid: ME }] }));
  assert.equal(agreed.ledger.loans[0].restructured, true);
  assert.equal(agreed.notices.some((n) => n.kind === "restructure"), true);
});

test("repudiating a civ (DESIGN 4.5): records close, grievances and witness rows come out, credit worsens", () => {
  const loans = [loan("L1", { lender: 6 }), loan("L2", { lender: 6, state: "default", missed: 3, outstanding: 5000 }),
    loan("L3", { lender: 8 })];
  const civs = [me({ balanceCents: 1e6 }), civ(6, { incomeCents: 2000 }), civ(8), civ(9), civ(11, { alive: false })];
  const relations = [{ a: ME, b: 6, level: "unfriendly" }, { a: 8, b: ME, level: "friendly" },
    { a: ME, b: 9, level: "neutral" }, { a: ME, b: 11, level: "neutral" }];
  const plan = planTurn(input({ ledger: ledgerWith(loans), civs, relations,
    requests: [{ kind: "repudiate", borrower: ME, lender: 6 }] }));
  assert.deepEqual(plan.ledger.loans.map((l) => [l.id, l.state, l.writtenOff]),
    [["L1", "repudiated", 30000], ["L2", "repudiated", 5000], ["L3", "active", 0]]);
  assert.deepEqual(plan.transfers.map((t) => t.loanId), ["L3"], "the stiffed lender gets nothing, now or later");
  assert.deepEqual(plan.grievances, [{ from: ME, against: 6, amount: 40 }], "35000 / 2000 = 17.5 turns, capped");
  assert.deepEqual(plan.relationships, [{ a: ME, b: 8, delta: -3 }, { a: ME, b: 9, delta: -3 }],
    "met and alive civs other than the lender");
  assert.deepEqual(plan.ledger.blocks, [{ lender: 6, borrower: ME, reason: "repudiation", agesLeft: 1, untilTurn: null }]);
  assert.equal(plan.events.find((e) => e.kind === "repudiation").chronicle, 1);
  assert.equal(plan.notices.some((n) => n.kind === "repudiated"), true);
  const later = planTurn(input({ turn: 51, ledger: plan.ledger, civs, relations, requests: [borrow({ principal: 1000,
    term: 10 })] }));
  assert.equal(later.ledger.loans.at(-1).ratePpm, 28571, "standing 0.7: 20000 / 0.7");
  const capped = planTurn(input({ turn: 51, ledger: plan.ledger, civs, relations,
    requests: [borrow({ principal: 8 * 10000 - 28500 + 1, term: 10 })] }));
  assert.equal(refusal(capped), "credit-cap", "(12 - 4) turns of income less what's outstanding on L3");
  const toLender = planTurn(input({ turn: 51, ledger: plan.ledger, civs, relations,
    requests: [borrow({ principal: 100, term: 10, lender: 6 })] }));
  assert.equal(refusal(toLender), "no-offer");
});

test("repudiating the bond market: no grudge, doubled witness cost, the market and the guard closed 30 turns", () => {
  const civs = [me({ balanceCents: 1e6 }), civ(8)];
  const relations = [{ a: 8, b: ME, level: "neutral" }];
  const plan = planTurn(input({ ledger: ledgerWith([loan("L1")]), civs, relations,
    requests: [{ kind: "repudiate", borrower: ME, lender: "bond" }] }));
  assert.deepEqual(plan.grievances, []);
  assert.deepEqual(plan.relationships, [{ a: ME, b: 8, delta: -6 }]);
  assert.equal(plan.ledger.blocks[0].untilTurn, 80);
  const broke = planTurn(input({ turn: 60, ledger: plan.ledger, civs: [me({ balanceCents: -5000, incomeCents: -100 }),
    civ(8, { balanceCents: 100 })], relations }));
  assert.deepEqual(broke.transfers, []);
  assert.equal(broke.events.some((e) => e.kind === "guard-blocked"), true);
  const open = planTurn(input({ turn: 80, ledger: plan.ledger, civs: [me({ balanceCents: -5000, incomeCents: -100 })],
    relations }));
  assert.equal(open.transfers[0].from, "bond");
});

test("repudiation requests: only the human borrower, a lender it owes, nothing twice", () => {
  const civs = [me(), civ(6)];
  const why = (r, ledger = ledgerWith([loan("L1", { lender: 6 })])) => refusal(planTurn(input({ ledger, civs,
    requests: [r] })));
  assert.equal(why({ kind: "repudiate", borrower: 6, lender: ME }), "parties");
  assert.equal(why({ kind: "repudiate", borrower: ME, lender: 9 }), "lender");
  assert.equal(why({ kind: "repudiate", borrower: ME, lender: "bond" }), "nothing-owed");
});

test("the AI repudiates an enemy at war (DESIGN 6), before any payment on the records", () => {
  const civs = [me(), civ(4, { balanceCents: 1e6, incomeCents: 1000 }), civ(6, { incomeCents: 1000 })];
  const relations = [{ a: 4, b: 6, level: "war" }, { a: 4, b: ME, level: "neutral" }];
  const plan = planTurn(input({ ledger: ledgerWith([loan("L1", { borrower: 4, lender: 6 })]), civs, relations }));
  assert.equal(plan.ledger.loans[0].state, "repudiated");
  assert.deepEqual(plan.transfers, []);
  assert.deepEqual(plan.grievances, [{ from: 4, against: 6, amount: 40 }]);
  assert.deepEqual(plan.relationships, [{ a: 4, b: ME, delta: -2 }], "halved: the world expects it");
  assert.equal(plan.ledger.repudiations[0].atWar, true);
  const calm = planTurn(input({ ledger: ledgerWith([loan("L1", { borrower: 4, lender: 6 })]), civs,
    relations: [{ a: 4, b: 6, level: "unfriendly" }] }));
  assert.equal(calm.ledger.loans[0].state, "active", "solvent and paying: no repudiation");
  assert.equal(planTurn(input({ ledger: ledgerWith([loan("L1", { borrower: 4, lender: 6 })]), civs, relations,
    options: { ai: false } })).ledger.loans[0].state, "active");
});

test("guard (DESIGN 4.6): a human below 0 gets one emergency loan for the shortfall plus upkeep, and a notice", () => {
  const civs = [me({ balanceCents: -3000, incomeCents: -500, upkeepCents: 800 })];
  const plan = planTurn(input({ civs }));
  assert.deepEqual(plan.transfers.map((t) => [t.from, t.to, t.cents]), [["bond", ME, 3500 + 800]]);
  assert.deepEqual(planTurn(input({ civs: [me({ balanceCents: -3000, incomeCents: 500 })] })).transfers, [],
    "a dip with positive income costs nothing: the engine wipes it at the roll (P4), so no loan");
  assert.equal(plan.ledger.loans[0].source, "guard");
  assert.equal(plan.ledger.loans[0].emergency, true);
  assert.equal(plan.ledger.loans[0].term, 10);
  assert.equal(plan.notices.filter((n) => n.kind === "guard").length, 1);
  assert.equal(planTurn(input({ civs, options: { guard: false } })).transfers.length, 0);
  assert.equal(planTurn(input({ civs, params: {} })).transfers.length, 0, "no line, no guard");
  assert.equal(planTurn(input({ civs: [me({ balanceCents: -1, incomeCents: 0 })] })).transfers[0].cents, 1 + 500,
    "between 0 and the disband line is covered (finding B)");
});

test("guard lenders by stage: temple treasuries first, a civ from Moneylending, bond or civ from Public debt", () => {
  const short = { balanceCents: -3000, incomeCents: -500, upkeepCents: 0 };
  const lender = civ(6, { balanceCents: 1e6, incomeCents: 1000 });
  const early = planTurn(input({ civs: [me({ ...short, stages: CLOSED }), lender] }));
  assert.deepEqual(early.transfers.map((t) => [t.from, t.cents]), [["temple", 3500]], "back to 0 after income");
  assert.equal(early.ledger.loans[0].ratePpm, 20000);
  const ml = planTurn(input({ civs: [me({ ...short, stages: { moneylending: 1, publicDebt: null } }), lender] }));
  assert.deepEqual(ml.transfers.map((t) => [t.from, t.cents]), [[6, 3500]]);
  assert.equal(ml.ledger.loans[0].emergency, true);
  const mlAlone = planTurn(input({ civs: [me({ ...short, stages: { moneylending: 1, publicDebt: null } })] }));
  assert.equal(mlAlone.transfers[0].from, "temple");
  const pd = planTurn(input({ civs: [me(short), lender], relations: [{ a: 6, b: ME, level: "unfriendly" }] }));
  assert.equal(pd.transfers[0].from, 6, "0.013 beats the bond market's 0.02");
  const pdAlone = planTurn(input({ civs: [me(short)] }));
  assert.equal(pdAlone.transfers[0].from, "bond", "temple treasuries close at Public debt");
});

test("guard cap: at emergency_cap the guard stops with one notice per spell naming the game's penalties", () => {
  const open = loan("L1", { emergency: true, outstanding: 8000, principal: 8000, term: 10, source: "guard" });
  const civs = [me({ balanceCents: -3000, incomeCents: -500, upkeepCents: 0 })];
  const plan = planTurn(input({ ledger: ledgerWith([open]), civs }));
  assert.deepEqual(plan.transfers, [], "8000 + 3500 passes max(100 Gold, 10 * 5 Gold)");
  const told = plan.notices.filter((n) => n.kind === "guard-cap");
  assert.equal(told.length, 1);
  assert.deepEqual([told[0].deficit, told[0].cap, told[0].disbandLineCents], [3500, 10000, -1000]);
  const again = planTurn(input({ turn: 51, ledger: plan.ledger, civs }));
  assert.equal(again.notices.filter((n) => n.kind === "guard-cap").length, 0, "told once");
  const later = planTurn(input({ turn: 53, ledger: again.ledger, civs }));
  assert.equal(later.notices.filter((n) => n.kind === "guard-cap").length, 1, "a new spell is told again");
  const paidDown = planTurn(input({ ledger: ledgerWith([{ ...open, outstanding: 6000 }]), civs }));
  assert.equal(paidDown.transfers[0].cents, 3500, "paying emergency loans down frees the allowance");
});

test("insolvency: five turns running at or below 0 income tells the player once; the guard notice carries it", () => {
  let w = world({ civs: [me({ balanceCents: 1e6, incomeCents: 0 })], params: PARAMS });
  const kinds = [];
  for (let k = 0; k < 7; k += 1) {
    const { plan, next } = step(w);
    kinds.push(...plan.notices.map((n) => n.kind));
    w = next;
  }
  assert.deepEqual(kinds, ["insolvent"]);
  assert.deepEqual(w.ledger.lowIncome, [{ pid: ME, turns: 7 }]);
  const broke = planTurn(input({ turn: w.turn, ledger: w.ledger, civs: [me({ balanceCents: -100, incomeCents: 0 })] }));
  assert.equal(broke.notices.find((n) => n.kind === "guard").insolvent, 1);
});

test("the open-loan limit: a seventh open loan for one borrower is refused, the guard logs it", () => {
  const six = Array.from({ length: 6 }, (_, i) => loan(`L${i + 1}`, { principal: 100, outstanding: 100 }));
  const civs = [me({ balanceCents: -5000, incomeCents: -100 })];
  const plan = planTurn(input({ turn: 1, ledger: ledgerWith(six), civs, requests: [borrow({ principal: 100 })] }));
  assert.equal(refusal(plan), "loan-limit");
  assert.equal(plan.events.some((e) => e.kind === "guard-limit"), true);
});

test("AI borrowing (DESIGN 6): a short AI takes a standard 10-turn loan within its limits, cheapest lender first", () => {
  const civs = [me({ balanceCents: 1e7 }), civ(4, { balanceCents: -4000, incomeCents: 2000 }),
    civ(6, { balanceCents: 300000, incomeCents: 1000 }), civ(8, { balanceCents: 30000, incomeCents: 2000 })];
  const plan = planTurn(input({ civs, relations: [{ a: 6, b: 4, level: "unfriendly" }] }));
  const t = plan.transfers[0];
  assert.deepEqual([t.from, t.to, t.cents], [6, 4, 2000], "8 fails 20 * income; the human never lends by rule");
  assert.deepEqual([plan.ledger.loans[0].term, plan.ledger.loans[0].emergency, plan.ledger.loans[0].source],
    [10, false, "ai-shortfall"]);
});

test("AI borrowing: past the 4.2 limits or insolvent it takes an emergency loan sized as the guard's; at the cap none", () => {
  const dip = [me(), civ(4, { balanceCents: -4000, incomeCents: 100 })];
  assert.deepEqual(planTurn(input({ civs: dip })).transfers, [],
    "past the limits with positive income: no loan, the engine wipes the dip at the roll for free (P4)");
  const civs = [me(), civ(4, { balanceCents: -4000, incomeCents: -100 })];
  const plan = planTurn(input({ civs }));
  assert.deepEqual(plan.transfers.map((t) => [t.from, t.to, t.cents]), [["bond", 4, 4600]],
    "4100 short of the line plus one turn of upkeep (500), as the human's guard borrows");
  assert.equal(plan.ledger.loans[0].emergency, true, "income at or below 0: no standard loan");
  assert.deepEqual(planTurn(input({ civs, options: { ai: false } })).transfers, []);
  const insolvent = ledgerWith([], { lowIncome: [{ pid: 4, turns: 4 }] });
  const ins = planTurn(input({ ledger: insolvent, civs: [me(), civ(4, { balanceCents: -40, incomeCents: 0 })] }));
  assert.equal(ins.ledger.loans[0].emergency, true);
  assert.equal(ins.events.find((e) => e.kind === "guard").insolvent, 1);
  const open = loan("L1", { borrower: 4, emergency: true, outstanding: 9000, principal: 9000, term: 10 });
  const capped = planTurn(input({ ledger: ledgerWith([open]), civs: [me(), civ(4, { balanceCents: -2000,
    incomeCents: 0 })] }));
  assert.deepEqual(capped.transfers, []);
  assert.equal(capped.events.some((e) => e.kind === "guard-cap" && e.pid === 4), true);
});

test("an AI's emergency loan is the human's guard loan: same line, same sizing, same cap, same lender order", () => {
  const numbers = { balanceCents: -3000, incomeCents: -200, upkeepCents: 800 };
  const human = planTurn(input({ civs: [me(numbers)] }));
  const robot = planTurn(input({ civs: [me({ balanceCents: 5000, incomeCents: 100 }), civ(4, numbers)] }));
  const pick = (p) => p.transfers.map((t) => [t.from, t.cents]);
  assert.deepEqual(pick(human), [["bond", 4000]], "-3000 - 200 below the line, plus one turn of upkeep (800)");
  assert.deepEqual(pick(robot), pick(human), "the AI's loan is the human's loan to the cent, same lender");
  assert.deepEqual([human.ledger.loans[0].emergency, robot.ledger.loans[0].emergency], [true, true]);
  const capped = { balanceCents: -20000, incomeCents: -100, upkeepCents: 800 };
  const h2 = planTurn(input({ civs: [me(capped)] }));
  const r2 = planTurn(input({ civs: [me({ balanceCents: 5000, incomeCents: 100 }), civ(4, capped)] }));
  assert.deepEqual([h2.transfers, r2.transfers], [[], []], "both stop at emergency_cap");
  assert.deepEqual([h2.events.some((e) => e.kind === "guard-cap"), r2.events.some((e) => e.kind === "guard-cap")],
    [true, true]);
});

test("AI borrowing: competing borrowers go largest shortfall first, ties by id; committed principal counts", () => {
  const civs = [me(), civ(4, { balanceCents: -550, incomeCents: 200 }), civ(5, { balanceCents: -600,
    incomeCents: 200 }), civ(6, { balanceCents: 1001, incomeCents: 50 })];
  const plan = planTurn(input({ civs }));
  assert.deepEqual(plan.transfers.map((t) => [t.from, t.to, t.cents]), [[6, 5, 400], ["bond", 4, 350]],
    "6 can cover 2 * 400 once, then 1001 - 400 < 2 * 350 and 4 goes to the bond market");
  assert.deepEqual(plan.ledger.loans.map((l) => l.emergency), [false, false]);
});

test("player lends: an AI in shortfall accepts at r <= 1.2 * its bond rate when it can pay; refusals by reason", () => {
  const civs = [me({ balanceCents: 50000 }), civ(4, { balanceCents: -6000, incomeCents: 5000 })];
  const lend = (ratePpm, over = {}) => ({ kind: "lend", lender: ME, borrower: 4, principal: 10000, ratePpm, term: 10,
    ...over });
  const ok = planTurn(input({ civs, requests: [lend(24000)] }));
  assert.deepEqual(ok.transfers[0], { loanId: "L1", turn: 50, from: ME, to: 4, cents: 10000, reason: "principal",
    parts: {} });
  assert.equal(ok.transfers.length, 1, "the loan covered the shortfall, so the AI borrows nothing more");
  assert.equal(ok.ledger.loans[0].source, "lend");
  const why = (r, extra = {}) => refusal(planTurn(input({ civs, requests: [r], ...extra })));
  assert.equal(why(lend(24001)), "declined");
  assert.equal(why(lend(24000, { principal: 70000 })), "balance", "funds for the turn are 60000");
  assert.equal(why(lend(24000, { borrower: ME })), "parties");
  assert.equal(why(lend(24000), { options: { ai: false } }), "ai-off");
  assert.equal(why(lend(24000), { relations: [{ a: ME, b: 4, level: "war" }] }), "war");
  assert.equal(why(lend(0)), "terms");
  assert.equal(why(lend(24000, { term: 30 })), "term-banking", "the player needs a Bank for 30 turns too");
  assert.equal(why(lend(24000), { civs: [civs[0], civ(4, { balanceCents: 4000 })] }), "declined", "no shortfall");
  assert.equal(why(lend(24000), { civs: [civs[0], civ(4, { balanceCents: -4000, incomeCents: 0 })] }), "declined",
    "finding E: an AI that can't pay doesn't borrow from the player");
  assert.equal(why(lend(24000, { principal: 40000 }), { civs: [civs[0], civ(4, { balanceCents: -4000,
    incomeCents: 3000 })] }), "declined", "over its credit cap");
});

test("stage gates (TEST-PLAN 12.6): no civ loans before Moneylending, no bond market before Public debt", () => {
  const closed = [me({ stages: CLOSED }), civ(6, { balanceCents: 1e6, stages: CLOSED })];
  const bond = planTurn(input({ age: "AGE_ANTIQUITY", civs: closed, requests: [borrow({ principal: 1000, term: 10 })] }));
  assert.equal(refusal(bond), "no-offer");
  const civLoan = planTurn(input({ age: "AGE_ANTIQUITY", civs: closed, requests: [borrow({ principal: 1000, term: 10,
    lender: 6 })] }));
  assert.equal(refusal(civLoan), "no-offer");
  const ml = { moneylending: 20, publicDebt: null };
  const opened = [me({ stages: ml }), civ(6, { balanceCents: 1e6, stages: ml })];
  const ok = planTurn(input({ age: "AGE_ANTIQUITY", civs: opened, requests: [borrow({ principal: 1000, term: 10,
    lender: 6 })] }));
  assert.equal(ok.ledger.loans[0].ratePpm, 15000, "Antiquity's base rate");
  assert.equal(refusal(planTurn(input({ age: "AGE_ANTIQUITY", civs: opened, requests: [borrow({ principal: 1000,
    term: 10 })] }))), "no-offer", "the bond market waits for Public debt");
  const off = planTurn(input({ age: "AGE_ANTIQUITY", civs: closed, options: { stages: false },
    requests: [borrow({ principal: 1000, term: 10 })] }));
  assert.equal(off.ledger.loans[0].ratePpm, 30000, "Economic stages Off opens everything");
});

test("the turn is order-free (DESIGN 4.14): the same turn with the civs reversed gives the same transfers", () => {
  const loans = [loan("L1", { borrower: 4, lender: 6 }), loan("L2", { borrower: 6, lender: 4, opened: 2 }),
    loan("L3", { borrower: 8, lender: ME, opened: 3 }), loan("L4", { borrower: 9, lender: "bond", opened: 4 })];
  const civs = [me({ balanceCents: 2000 }), civ(4, { balanceCents: 2000, incomeCents: 500 }),
    civ(6, { balanceCents: 1500, incomeCents: 800 }), civ(8, { balanceCents: -2000, incomeCents: 5000 }),
    civ(9, { balanceCents: 0, incomeCents: -200 }), civ(11, { balanceCents: 1e6, incomeCents: 2000 })];
  const base = input({ ledger: ledgerWith(loans), civs, relations: [{ a: 4, b: 6, level: "friendly" }] });
  const a = planTurn(base);
  const b = planTurn({ ...base, civs: [...civs].reverse() });
  assert.ok(a.transfers.length >= 3);
  assert.deepEqual(a.transfers, b.transfers);
  assert.deepEqual(a.ledger, b.ledger);
  assert.deepEqual(a.batch, b.batch);
  const pay = a.transfers.find((t) => t.loanId === "L1");
  assert.ok(pay, "4 pays 6 from its own funds although 6's payment to 4 arrives this turn too");
});

test("Gold from another civ counts next turn: a payment received this turn can't fund this turn's payment", () => {
  const loans = [loan("L1", { borrower: 4, lender: 6, opened: 1 }), loan("L2", { borrower: 6, lender: 4, opened: 2 })];
  const civs = [me(), civ(4, { balanceCents: 0, incomeCents: 2100 }), civ(6, { balanceCents: 0, incomeCents: 2099 })];
  const plan = planTurn(input({ ledger: ledgerWith(loans), civs, options: { ai: false } }));
  assert.deepEqual(plan.transfers.map((t) => [t.from, t.to, t.cents]), [[4, 6, 2100]]);
  assert.deepEqual(plan.influence.map((i) => i.pid), [6]);
});

test("the batch (DESIGN 4.14): a batch id, each civ's snapshot balance and net, kept in the ledger", () => {
  const civs = [me({ balanceCents: 12345 }), civ(6, { balanceCents: 60000 })];
  const plan = planTurn(input({ civs, requests: [borrow({ lender: 6, principal: 20000, term: 10 })] }));
  assert.deepEqual(plan.batch, { id: "B1", turn: 50, civs: [{ pid: ME, snapshot: 12345, net: 20000, influence: 0,
    celebration: 0 }, { pid: 6, snapshot: 60000, net: -20000, influence: 0, celebration: 0 }] });
  assert.deepEqual(plan.ledger.lastBatch, plan.batch);
  const next = planTurn(input({ turn: 51, ledger: plan.ledger, civs }));
  assert.equal(next.batch.id, "B2");
});

test("a loan run to term through the planner closes on its last turn with O exactly 0", () => {
  let w = world({ civs: [me({ balanceCents: 0, incomeCents: 5000 })], params: PARAMS });
  ({ next: w } = step(w, { requests: [borrow({ principal: 12345, term: 10 })] }));
  let paid = 0;
  for (let k = 0; k < 10; k += 1) {
    const { plan, next } = step(w);
    paid += plan.transfers.reduce((s, t) => s + t.parts.amortisation, 0);
    w = next;
  }
  assert.equal(paid, 12345);
  assert.equal(w.ledger.loans[0].outstanding, 0);
  assert.equal(w.ledger.loans[0].state, "closed");
  assert.equal(w.ledger.loans[0].closedTurn, 20);
});

test("early repayment request: applied on top of the payment, and a loan repaid in full closes", () => {
  const requests = [{ kind: "repay", loanId: "L1", cents: 1e9 }];
  const plan = planTurn(input({ ledger: ledgerWith([loan("L1")]), requests, civs: [me({ balanceCents: 1e6 })] }));
  assert.equal(plan.transfers[0].cents, 600 + 30000);
  assert.equal(plan.ledger.loans[0].state, "closed");
  assert.equal(plan.events.at(-1).kind, "closed");
});

test("repay requests for unknown, closed or same-turn loans are ignored", () => {
  const ledger = ledgerWith([loan("L1", { state: "closed", outstanding: 0 }), loan("L2", { opened: 50 })]);
  const plan = planTurn(input({ ledger, civs: [me()],
    requests: [{ kind: "repay", loanId: "L1", cents: 5 }, { kind: "repay", loanId: "L2", cents: 5 },
      { kind: "repay", loanId: "L9", cents: 5 }, { kind: "repay", loanId: "L2", cents: -5 }, null, { kind: "odd" }] }));
  assert.deepEqual(plan.transfers, []);
});

test("lender eliminated mid-loan: the loan is written off, nothing is sent to the dead lender", () => {
  const civs = [me(), civ(6, { alive: false })];
  const plan = planTurn(input({ ledger: ledgerWith([loan("L1", { lender: 6, outstanding: 9000 })]), civs }));
  assert.deepEqual(plan.transfers, []);
  assert.equal(plan.ledger.loans[0].state, "closed");
  assert.equal(plan.ledger.loans[0].writtenOff, 9000);
  assert.deepEqual(plan.events[0], { turn: 50, kind: "writeoff", loanId: "L1", gone: "lender", cents: 9000 });
  assert.equal(planTurn(input({ ledger: ledgerWith([loan("L1", { borrower: 9, lender: ME })]),
    civs: [me(), civ(9, { alive: false })] })).events[0].gone, "borrower");
});

test("lender eliminated mid-loan, mid-simulation: payments stop the turn it dies", () => {
  const civs = [me({ incomeCents: 5000 }), civ(6, { balanceCents: 1e6, incomeCents: 0 })];
  let w = world({ civs, params: PARAMS });
  ({ next: w } = step(w, { requests: [borrow({ lender: 6, principal: 10000, term: 10 })] }));
  ({ next: w } = step(w));
  const before = w.balances.get(6);
  w = { ...w, civs: [civs[0], { ...civs[1], alive: false }] };
  const { plan, next } = step(w);
  assert.deepEqual(plan.transfers, []);
  assert.equal(next.balances.get(6), before);
});

test("every part Off: no write of any kind; Loans Off alone: no loan rule runs", () => {
  const off = { loans: false, markets: false, investment: false };
  const plan = planTurn(input({ options: off, ledger: ledgerWith([loan("L1")]), civs: [me({ balanceCents: -1e6 })] }));
  assert.equal(plan.skipped, "all-off");
  assert.deepEqual(plan.transfers, []);
  const loansOff = planTurn(input({ options: { loans: false }, ledger: ledgerWith([loan("L1")]),
    civs: [me({ balanceCents: -1e6, incomeCents: -500 })] }));
  assert.equal(loansOff.skipped, null);
  assert.deepEqual(loansOff.transfers, [], "no payment, no guard loan");
  const refused = planTurn(input({ options: { loans: false }, civs: [me()],
    requests: [{ kind: "borrow", borrower: ME, lender: "bond", principal: 100, term: 10 }] }));
  assert.equal(refused.events.find((e) => e.kind === "refused")?.reason, "loans-off");
});

test("a turn already planned is not planned again (no double charge on a stale re-run or a reload)", () => {
  const civs = [me()];
  const first = planTurn(input({ ledger: ledgerWith([loan("L1")]), civs }));
  assert.equal(first.transfers.length, 1);
  const again = planTurn(input({ ledger: first.ledger, civs }));
  assert.equal(again.skipped, "already-planned");
  assert.deepEqual(again.transfers, []);
});

test("a new age: default blocks end, a repudiation block lasts one more age, loans carry over", () => {
  const blocks = [{ lender: 6, borrower: ME, reason: "default", agesLeft: 0, untilTurn: null },
    { lender: 8, borrower: ME, reason: "repudiation", agesLeft: 1, untilTurn: null }];
  const ledger = ledgerWith([loan("L1")], { age: "AGE_EXPLORATION", blocks });
  const plan = planTurn(input({ age: "AGE_MODERN", ledger, civs: [me()] }));
  assert.deepEqual(plan.ledger.blocks, [{ lender: 8, borrower: ME, reason: "repudiation", agesLeft: 0, untilTurn: null }]);
  assert.equal(plan.ledger.age, "AGE_MODERN");
  assert.equal(plan.ledger.loans.length, 1);
  const fresh = planTurn(input({ age: "AGE_MODERN", ledger: ledgerWith([], { blocks }), civs: [me()] }));
  assert.equal(fresh.ledger.blocks.length, 2, "a ledger with no age yet isn't an age change");
});

test("planTurn does not mutate its input ledger", () => {
  const ledger = ledgerWith([loan("L1")]);
  const copy = JSON.parse(JSON.stringify(ledger));
  planTurn(input({ ledger, civs: [me()] }));
  assert.deepEqual(ledger, copy);
});

test("projection: 20 balances per civ, moving by income less each payment", () => {
  const civs = [me({ balanceCents: 10000, incomeCents: 3000 })];
  const s = projectBalances(input({ ledger: ledgerWith([loan("L1", { term: 20 })]), civs }), 20);
  assert.equal(s.length, 1);
  assert.equal(s[0].balances.length, 20);
  assert.equal(s[0].balances[0], 10000 + 3000 - 2100);
  assert.equal(s[0].balances[19] > s[0].balances[0], true);
  assert.equal(projectBalances(input({ civs }), 3)[0].balances.at(-1), 19000);
});
