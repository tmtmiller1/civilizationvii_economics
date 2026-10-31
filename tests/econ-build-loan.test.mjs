// The AI's build loan (DESIGN 6, NOTES finding Q): what an AI asks for when it wants capital, as against the
// emergency loan it takes when it needs it. While its credit is cheap it borrows for a build that pays for itself or
// is slow on the city's own production, with the service within its income and no build loan already open, and puts
// the Gold straight into the build through the progress account a development loan uses. Sized by the same limits
// the player's refusal names, at the game's purchase rate. No timer.
import test from "node:test";
import assert from "node:assert/strict";

import { planTurn } from "../ui/econ-plan.js";
import { aiBuildBorrowStanding, aiBuildBorrowWanted, buildPays } from "../ui/econ-ai.js";
import { emptyLedger } from "../ui/econ-state.js";
import { emptyMacro } from "../ui/econ-macro-state.js";
import { makeLoan } from "../ui/econ-loan.js";
import { checkPlan } from "../ui/econ-invariants.js";
import { OPEN, civ, input } from "./_fixtures.mjs";

const ME = 3;
const AI = 6;
const LENDER = 8;
const city = (id, over = {}) => ({ id, build: "BUILDING_LIBRARY", neededProgress: 500, population: 3, turnsLeft: 12,
  buildGoldYield: 0, ...over });
const ai = (over = {}) => civ(AI, { incomeCents: 4000, balanceCents: 20000, stages: OPEN,
  cities: [city("6:1"), city("6:2", { roleBuilding: true })], ...over });
const plan = (over) => {
  const out = planTurn(input(over));
  assert.deepEqual(checkPlan({ plan: out, civs: over.civs }), [], "commit checks");
  return out;
};
const built = (out) => out.ledger.loans.filter((loan) => loan.source === "ai-build");

test("the standing: income of 10 Gold or more, solvent, no default, no distress, a build, none open, cheap credit", () => {
  const base = { incomeCents: 1000, phase: "steady", insolvent: false, inDefault: false, distressed: false,
    hasBuild: true, openBuildLoan: false };
  assert.equal(aiBuildBorrowStanding(base), true);
  assert.equal(aiBuildBorrowStanding({ ...base, phase: "boom" }), true);
  assert.equal(aiBuildBorrowStanding({ ...base, phase: "outside" }), true, "a Planned civ's spread is 1.0");
  for (const phase of ["slump", "depression", "panic", ""]) {
    assert.equal(aiBuildBorrowStanding({ ...base, phase }), false, phase);
  }
  assert.equal(aiBuildBorrowStanding({ ...base, incomeCents: 999 }), false);
  assert.equal(aiBuildBorrowStanding({ ...base, insolvent: true }), false);
  assert.equal(aiBuildBorrowStanding({ ...base, inDefault: true }), false);
  assert.equal(aiBuildBorrowStanding({ ...base, distressed: true }), false, "a civ short on its dues needs, it doesn't want");
  assert.equal(aiBuildBorrowStanding({ ...base, hasBuild: false }), false);
  assert.equal(aiBuildBorrowStanding({ ...base, openBuildLoan: true }), false, "one at a time, not one per 10 turns");
});

test("the want: the build pays for the loan or is slow on the city's own production", () => {
  const base = { pays: false, turnsLeft: 8 };
  assert.equal(aiBuildBorrowWanted(base), true, "8 turns left: slow");
  assert.equal(aiBuildBorrowWanted({ ...base, turnsLeft: 7 }), false, "7 turns: the city gets there on its own");
  assert.equal(aiBuildBorrowWanted({ ...base, turnsLeft: null }), false, "unread: no reason");
  assert.equal(aiBuildBorrowWanted({ ...base, turnsLeft: 3, pays: true }), true, "quick, but the build pays");
  // A Market's +3 Gold over 10 turns (30) against the interest on 164 Gold at 2% on a declining balance (18.04).
  assert.equal(buildPays({ goldYieldCents: 300, principal: 16400, ratePpm: 20000, term: 10 }), true);
  assert.equal(buildPays({ goldYieldCents: 100, principal: 16400, ratePpm: 20000, term: 10 }), false, "+1 Gold: 10 under 18");
  assert.equal(buildPays({ goldYieldCents: 0, principal: 16400, ratePpm: 20000, term: 10 }), false, "a Granary");
});

test("an AI borrows from the bond market and the Gold lands on its role building as progress", () => {
  const out = plan({ civs: [civ(ME, { human: true }), ai()] });
  const [loan] = built(out);
  assert.deepEqual([loan.lender, loan.borrower, loan.term, loan.ratePpm], ["bond", AI, 10, 20000]);
  assert.equal(loan.principal, 9600, "the most whose first payment (9.60 and 1.92) fits 30% of 40 Gold, in 4 Gold points");
  assert.deepEqual(out.transfers.map((t) => [t.loanId, t.from, t.to, t.cents, t.reason]),
    [[loan.id, "bond", "progress", 9600, "principal"], [`EH${AI}`, AI, "escrow", 1152, "escrow"]],
    "the borrower never holds the Gold; it puts next turn's payment into escrow");
  assert.deepEqual(out.progress, [{ host: AI, cityId: "6:2", amount: 24, investmentId: loan.id }]);
  assert.deepEqual(out.ledger.buildTurns, [], "no timer row");
  const soon = plan({ civs: [civ(ME, { human: true }), ai()], turn: 59, ledger: out.ledger });
  assert.deepEqual(built(soon).length, 1, "not again while the first is open");
  const closed = { ...soon.ledger, loans: soon.ledger.loans.map((l) => ({ ...l, state: "closed", closedTurn: 60 })) };
  const later = plan({ civs: [civ(ME, { human: true }), ai()], turn: 61, ledger: closed });
  assert.equal(built(later).length, 2, "once it's closed, the slow build is a reason again");
});

test("the city with a reason: a quick build in the first city doesn't hide a slow one in the next", () => {
  const quickFirst = ai({ cities: [city("6:1", { turnsLeft: 2, roleBuilding: true }), city("6:2", { turnsLeft: 12 })] });
  const out = plan({ civs: [quickFirst] });
  assert.deepEqual(out.progress.map((row) => row.cityId), ["6:2"], "the slow build, not the quick role building");
  const allQuick = ai({ cities: [city("6:1", { turnsLeft: 2 }), city("6:2", { turnsLeft: 3 })] });
  assert.equal(built(plan({ civs: [allQuick] })).length, 0, "no city gives a reason");
});

test("a want, not a need: a quick build that pays for itself gets a loan, a quick Granary doesn't, nor a short civ", () => {
  const market = (over = {}) => ai({ cities: [city("6:1", { build: "BUILDING_MARKET", turnsLeft: 3, buildGoldYield: 3,
    roleBuilding: true, ...over })] });
  assert.equal(built(plan({ civs: [market()] })).length, 1, "+3 Gold over 10 turns covers the interest");
  assert.equal(built(plan({ civs: [market({ build: "BUILDING_GRANARY", buildGoldYield: 0, roleBuilding: false })] })).length,
    0, "3 turns out and no Gold in it");
  const heavy = { ...emptyLedger(), nextId: 2, loans: [makeLoan({ id: "L1", lender: "bond", borrower: AI,
    principal: 40000, ratePpm: 20000, term: 10, turn: 45 })] };
  assert.equal(built(plan({ civs: [ai()], ledger: heavy })).length, 0,
    "48 a turn on 40 of income is already past 30%: it can't afford to want");
  const due = { ...emptyLedger(), nextId: 2, loans: [makeLoan({ id: "L1", lender: "bond", borrower: AI,
    principal: 10000, ratePpm: 20000, term: 10, turn: 45 })] };
  const short = plan({ civs: [ai({ balanceCents: 0, incomeCents: 1000 }), civ(LENDER, { balanceCents: 300000,
    incomeCents: 1000, stages: OPEN })], ledger: due });
  assert.equal(built(short).length, 0, "short on its dues: the emergency rule, not this one");
  assert.equal(short.events.some((e) => e.kind === "refinance" && e.pid === AI), true);
});

test("sized by the build: no more than its points at the purchase rate, or 5 turns of income", () => {
  const small = plan({ civs: [ai({ incomeCents: 100000, cities: [city("6:1", { neededProgress: 30 })] })] });
  assert.equal(built(small)[0].principal, 30 * 400);
  assert.deepEqual(small.progress.map((row) => row.amount), [30]);
  const rich = plan({ civs: [ai({ incomeCents: 100000, cities: [city("6:1", { neededProgress: 100000 })] })] });
  assert.ok(built(rich)[0].principal <= 5 * 100000, `${built(rich)[0].principal}`);
  const scaled = plan({ civs: [ai({ incomeCents: 100000, cities: [city("6:1", { neededProgress: 30,
    progressScalePct: 200 })] })] });
  assert.deepEqual([built(scaled)[0].principal, scaled.progress[0].amount], [30 * 800, 30],
    "a city where a point lands double pays double a point");
});

test("a civ lender lends cheaper than the bond market, and its Gold goes straight to the build too", () => {
  const civs = [ai(), civ(LENDER, { incomeCents: 1000, balanceCents: 1e7, stages: OPEN })];
  const out = plan({ civs, relations: [{ a: AI, b: LENDER, level: "friendly" }] });
  const [loan] = built(out);
  assert.deepEqual([loan.lender, loan.ratePpm], [LENDER, 8000]);
  assert.deepEqual(out.transfers.find((t) => t.loanId === loan.id).to, "progress");
  assert.equal(out.batch.civs.find((row) => row.pid === LENDER).net, -loan.principal);
  assert.equal(out.batch.civs.find((row) => row.pid === AI).net, -1166,
    "the borrower's Gold moves only into escrow, for next turn's payment (10.80 and 0.86 on 108 Gold at 0.8%)");
});

test("none in a Slump, a Panic, a default, insolvency, at the open-loan limit, for the player, or with Loans off", () => {
  const civs = (over = {}) => [civ(ME, { human: true, cities: [city("3:1")] }), ai(over)];
  const slump = { ...emptyMacro(), cycle: { ...emptyMacro().cycle, e: 9000 } };
  assert.equal(built(plan({ civs: civs(), macro: slump, options: { cycle: "standard" } })).length, 0);
  const panic = { ...emptyMacro(), cycle: { ...emptyMacro().cycle, panicUntil: 55 } };
  assert.equal(built(plan({ civs: civs(), macro: panic, options: { cycle: "standard" } })).length, 0);
  const inDefault = { ...emptyLedger(), nextId: 2, loans: [{ ...makeLoan({ id: "L1", lender: "bond", borrower: AI,
    principal: 100, ratePpm: 20000, term: 10, turn: 1 }), state: "default", missed: 3 }] };
  assert.equal(built(plan({ civs: civs(), ledger: inDefault })).length, 0);
  const insolvent = { ...emptyLedger(), lowIncome: [{ pid: AI, turns: 9 }] };
  assert.equal(built(plan({ civs: civs({ incomeCents: -100 }), ledger: insolvent })).length, 0);
  const full = { ...emptyLedger(), nextId: 7, loans: Array.from({ length: 6 }, (_, i) => makeLoan({ id: `L${i + 1}`,
    lender: "bond", borrower: AI, principal: 100, ratePpm: 20000, term: 10, turn: 40 })) };
  assert.equal(built(plan({ civs: civs(), ledger: full })).length, 0);
  assert.equal(plan({ civs: civs() }).ledger.loans.some((l) => l.borrower === ME), false, "the player buys for itself");
  assert.equal(built(plan({ civs: civs(), options: { loans: false } })).length, 0);
  assert.equal(built(plan({ civs: civs(), options: { ai: false } })).length, 0);
  assert.equal(built(plan({ civs: [ai({ cities: [city("6:1", { build: null })] })] })).length, 0, "nothing to build");
  assert.equal(built(plan({ civs: [ai({ incomeCents: 1000, cities: [city("6:1", { neededProgress: 1 })] })] })).length,
    0, "under 10 Gold isn't worth a loan");
});

test("a development loan on the same city this turn leaves the build loan only what the build still needs", () => {
  const civs = [civ(ME, { human: true, balanceCents: 1e6, stages: { ...OPEN, guildPatronage: 0 } }),
    ai({ stages: { ...OPEN, guildPatronage: 0 }, cities: [city("6:1", { neededProgress: 60, roleBuilding: true })] })];
  const out = plan({ civs, requests: [{ kind: "invest", investor: ME, host: AI, form: "project", cents: 15000,
    cityId: "6:1" }] });
  assert.deepEqual(out.progress, [{ host: AI, cityId: "6:1", amount: 60, investmentId: "I1" }],
    "50 points of the loan and 10 of the AI's own, one row for the city");
  assert.equal(built(out)[0].principal, 10 * 400);
});

test("leverage is debt in turns of the world's income: a player borrowing heavily in a boom can tip a Panic", () => {
  const OPEN_BANKING = { ...OPEN, banking: 0 };
  const civs = [civ(ME, { human: true, incomeCents: 10000, balanceCents: 1e6, stages: OPEN_BANKING, depthTurns: 12 }),
    civ(AI, { incomeCents: 10000, stages: OPEN_BANKING })];
  const boom = { ...emptyMacro(), cycle: { ...emptyMacro().cycle, e: 11500 } };
  const owed = { ...emptyLedger(), nextId: 2, loans: [makeLoan({ id: "L1", lender: "bond", borrower: AI,
    principal: 30000, ratePpm: 20000, term: 30, turn: 40 })] };
  const options = { cycle: "standard" };
  const calm = plan({ civs, ledger: owed, macro: boom, options });
  assert.equal(calm.events.some((e) => e.kind === "panic"), false, "1.5 turns of the world's 200 Gold");
  const borrowed = plan({ civs, ledger: owed, macro: boom, options, requests: [{ kind: "borrow", borrower: ME,
    lender: "bond", principal: 90000, term: 30 }] });
  assert.ok(borrowed.ledger.loans.some((loan) => loan.borrower === ME), "the player's 900 Gold");
  const next = plan({ civs, turn: 51, ledger: borrowed.ledger, macro: { ...borrowed.macro,
    cycle: { ...borrowed.macro.cycle, e: 11500 } }, options });
  assert.ok(next.events.some((e) => e.kind === "panic"), "6 turns of the world's income");
});
