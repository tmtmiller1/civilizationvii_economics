// The cycle's batch step at its edges (DESIGN 4.11): dead civs take no part, the World tab's event list leaves out
// what repeats every turn and keeps its caps, Corporatist's war boom and its fall at peace, only the last batch's
// defaults weigh, routes count once a pair, the phase notice's causes, bond debt for inflation.
import test from "node:test";
import assert from "node:assert/strict";

import { planTurn } from "../ui/econ-plan.js";
import { emptyLedger } from "../ui/econ-state.js";
import { emptyMarkets } from "../ui/econ-markets.js";
import { emptyMacro } from "../ui/econ-macro-state.js";
import { makeLoan } from "../ui/econ-loan.js";
import { OPEN_ALL, OPEN_MACRO, civ, input } from "./_fixtures.mjs";

const ME = 3;
const AI = 6;
const DEAD = 9;
const ON = { cycle: "standard", systems: true };
const me = (over = {}) => civ(ME, { human: true, incomeCents: 10000, balanceCents: 100000, stages: OPEN_ALL, ...over });
const ai = (id, over = {}) => civ(id, { incomeCents: 10000, balanceCents: 300000, stages: OPEN_ALL, ...over });
const dead = () => civ(DEAD, { alive: false, incomeCents: 900000, balanceCents: -9000000, stages: OPEN_MACRO });
const macroWith = (cycle = {}, over = {}) => ({ ...emptyMacro(), ...over, cycle: { ...emptyMacro().cycle, ...cycle } });
const plan = (over) => planTurn(input({ markets: emptyMarkets(), ...over, options: { ...ON, ...(over.options || {}) } }));

test("a dead civ takes no part: no L, no phase, no cycle Gold, nothing in the income or leverage it reads", () => {
  const out = plan({ civs: [me(), ai(AI), dead()], macro: macroWith({ e: 12000, income: Array(10).fill(20000) }) });
  assert.equal(out.macro.cycle.l[DEAD], undefined);
  assert.equal(out.macro.cycle.phases[DEAD], undefined);
  assert.equal(out.macro.cycle.atWar[DEAD], undefined);
  assert.equal(out.transfers.some((t) => t.to === DEAD || t.from === DEAD), false);
  assert.deepEqual(out.macro.cycle.income.at(-1), 20000, "the dead civ's income isn't counted");
  assert.deepEqual(out.macro.cycle.events, [], "income held level: nothing to weigh");
  const panicLedger = { ...emptyLedger(), nextId: 2, loans: [makeLoan({ id: "L1", lender: "bond", borrower: ME,
    principal: 400000, ratePpm: 40000, term: 30, turn: 40 })] };
  const panic = plan({ civs: [me({ stages: OPEN_MACRO, balanceCents: 100000 }), ai(AI, { balanceCents: 100000 }), dead()],
    ledger: panicLedger, macro: macroWith({ e: 12000 }) });
  assert.ok(panic.events.some((e) => e.kind === "panic"), "a dead civ's debt-free Gold doesn't hide the leverage");
});

test("the World tab's list leaves out what repeats every turn, and the list and E's history keep their caps", () => {
  const civs = [me({ atWar: true }), ai(AI, { atWar: true })];
  const relations = [{ a: ME, b: AI, level: "war" }];
  const out = plan({ civs, relations, crisisStage: 1, macro: macroWith({ crisis: 0, wars: [`${ME}:${AI}`],
    history: Array(30).fill(10000), events: Array.from({ length: 24 }, (_, i) => ({ turn: i, kind: "peace", a: 1, b: 2,
      w: 100 })) }) });
  assert.deepEqual(out.macro.cycle.events.filter((e) => e.turn === 50), [], "an ongoing war and crisis aren't listed");
  assert.equal(out.macro.cycle.events.length, 24);
  assert.equal(out.macro.cycle.history.length, 30);
  assert.equal(out.macro.cycle.history.at(-1), out.macro.cycle.e);
  const declared = plan({ civs, relations, macro: macroWith({ events: Array.from({ length: 24 }, (_, i) => ({ turn: i,
    kind: "peace", a: 1, b: 2, w: 100 })) }) });
  assert.equal(declared.macro.cycle.events.length, 24);
  assert.deepEqual(declared.macro.cycle.events.at(-1), { turn: 50, kind: "war-declared", a: ME, b: AI, w: -200 },
    "the newest kept, the oldest dropped");
  assert.equal(declared.macro.cycle.events[0].turn, 1);
});

test("overheating: a world in Boom counts its turns and pulls harder each one; the World tab lists it every 5th", () => {
  const civs = [me(), ai(AI)];
  const first = plan({ civs, macro: macroWith({ e: 11000 }) });
  assert.equal(first.macro.cycle.boomTurns, 1, "the turn's E is still in Boom");
  assert.equal(first.macro.cycle.e, 10900, "no pull before a turn in Boom");
  const later = plan({ civs, macro: macroWith({ e: 11000, boomTurns: 5 }) });
  assert.equal(later.macro.cycle.boomTurns, 6);
  assert.equal(later.macro.cycle.e, 10900 - 60, "5 turns at -0.002, at the Public debt stage scale of 0.6");
  assert.deepEqual(later.macro.cycle.events.map((e) => [e.kind, e.w]), [["overheating", -100]]);
  const quiet = plan({ civs, macro: macroWith({ e: 11000, boomTurns: 6 }) });
  assert.deepEqual(quiet.macro.cycle.events, [], "listed every 5th turn only");
  const over = plan({ civs, macro: macroWith({ e: 10400, boomTurns: 12 }) });
  assert.equal(over.macro.cycle.boomTurns, 0, "out of Boom it starts again");
});

test("the income trend: set by the first full read, then moved 4% of the way; growth on trend weighs nothing", () => {
  const civs = [me({ incomeCents: 10000 }), ai(AI, { incomeCents: 10000 })];
  const first = plan({ civs, macro: macroWith({ income: Array(10).fill(18000) }) });
  assert.equal(first.macro.cycle.trend, 1111, "20000 against 18000 ten turns ago");
  assert.deepEqual(first.macro.cycle.events, [], "no trend to read against yet");
  const onTrend = plan({ civs, macro: macroWith({ income: Array(10).fill(18000), trend: 1111 }) });
  assert.deepEqual(onTrend.macro.cycle.events, []);
  const slow = plan({ civs, macro: macroWith({ income: Array(10).fill(18000), trend: 2200 }) });
  assert.deepEqual(slow.macro.cycle.events.map((e) => [e.kind, e.w]), [["income-down", -100]]);
  assert.equal(slow.macro.cycle.trend, 2200 + Math.round((1111 - 2200) * 0.04));
});

test("Corporatist: +0.01 a turn on its own L at war, -0.03 once when peace comes, and the war state recorded", () => {
  const corporatist = { [AI]: { system: "corporatist", from: "corporatist", since: 0 } };
  const relations = [{ a: ME, b: AI, level: "war" }];
  const war = plan({ civs: [me({ atWar: true }), ai(AI, { atWar: true })], relations,
    macro: macroWith({ wars: [`${ME}:${AI}`], atWar: { [AI]: true } }, { systems: corporatist }) });
  assert.equal(war.macro.cycle.l[AI], 60, "-0.004 for the war, +0.01 for the boom");
  assert.equal(war.macro.cycle.l[ME], -40);
  assert.deepEqual(war.macro.cycle.atWar, { [ME]: true, [AI]: true });
  const peace = plan({ civs: [me(), ai(AI)], relations: [{ a: ME, b: AI, level: "neutral" }],
    macro: macroWith({ wars: [`${ME}:${AI}`], atWar: { [AI]: true } }, { systems: corporatist }) });
  assert.equal(peace.macro.cycle.l[AI], -200, "+0.01 for peace, -0.03 for the boom's end");
  assert.deepEqual(peace.macro.cycle.atWar, { [ME]: false, [AI]: false });
  const calm = plan({ civs: [me(), ai(AI)], macro: macroWith({}, { systems: corporatist }) });
  assert.equal(calm.macro.cycle.l[AI], undefined, "at peace both turns: nothing");
});

test("only the last batch's defaults weigh; older ones don't", () => {
  const events = [{ turn: 49, kind: "default", borrower: AI, lender: ME }, { turn: 40, kind: "default", borrower: ME,
    lender: AI }];
  const out = plan({ civs: [me(), ai(AI)], ledger: { ...emptyLedger(), lastTurn: 49, events } });
  assert.deepEqual(out.macro.cycle.events.map((e) => [e.kind, e.a, e.b]), [["default", AI, ME]]);
  assert.equal(out.macro.cycle.l[AI], -300);
});

test("routes: a pair counts once whichever way it runs; a self-route or a dead civ's doesn't count", () => {
  const routes = [{ importer: ME, exporter: AI, resources: [] }, { importer: AI, exporter: ME, resources: [] },
    { importer: ME, exporter: ME, resources: [] }, { importer: ME, exporter: DEAD, resources: [] }];
  const out = plan({ civs: [me(), ai(AI), dead()], routes });
  assert.deepEqual(out.macro.cycle.routes, [`${ME}:${AI}`]);
  assert.deepEqual(out.macro.cycle.events.map((e) => e.kind), ["route-new"]);
  const wars = plan({ civs: [me({ atWar: true }), ai(AI, { atWar: true }), dead()],
    relations: [{ a: AI, b: ME, level: "war" }, { a: ME, b: DEAD, level: "war" }] });
  assert.deepEqual(wars.macro.cycle.wars, [`${ME}:${AI}`]);
});

test("the phase notice names the heaviest of the player's own events first, else the world's", () => {
  const civs = [me(), ai(AI)];
  const own = plan({ civs, cycleEvents: [{ kind: "disaster", pid: ME }, { kind: "raze", pid: ME },
    { kind: "capture", pid: ME }, { kind: "disaster", pid: ME, populationLost: true }],
  macro: macroWith({ e: 9600, phases: { [ME]: "steady" } }) });
  assert.equal(own.notices.find((n) => n.kind === "phase").causes, "raze,capture,disaster");
  const world = plan({ civs, cycleEvents: [{ kind: "raze", pid: AI }], crisisStage: 0,
    macro: macroWith({ e: 9500, phases: { [ME]: "steady" } }) });
  const notice = world.notices.find((n) => n.kind === "phase");
  assert.deepEqual([notice.from, notice.to, notice.causes], ["steady", "slump", "raze,crisis-start"]);
  const same = plan({ civs, macro: macroWith({ e: 10000, phases: { [ME]: "steady" } }) });
  assert.equal(same.notices.some((n) => n.kind === "phase"), false);
});

test("inflation reads only open bond debt owed by members, and members' Gold floored at 0", () => {
  const loan = (id, over) => ({ ...makeLoan({ id, lender: "bond", borrower: AI, principal: 100000, ratePpm: 40000,
    term: 30, turn: 40 }), ...over });
  const ledger = { ...emptyLedger(), nextId: 9, loans: [loan("L1", {}), loan("L2", { state: "closed", outstanding: 0 }),
    loan("L3", { lender: ME }), loan("L4", { borrower: ME }), loan("L5", { borrower: 4 })] };
  const out = plan({ civs: [me({ stages: { ...OPEN_ALL, publicDebt: null } }), ai(AI, { balanceCents: 1000000 }),
    ai(8, { balanceCents: -500000 })], ledger, options: { inflation: true } });
  assert.deepEqual([out.macro.inflation.bondCents, out.macro.inflation.moneyCents, out.macro.inflation.top],
    [100000, 1000000, AI]);
  assert.equal(out.macro.inflation.piPpm, 2000);
});

test("a slump's charge is paid only from funds that hold it; a boom's Gold is a positive inflow only", () => {
  const slump = macroWith({ e: 9000 });
  const charged = plan({ civs: [me({ balanceCents: 0, incomeCents: 10000 })], macro: slump });
  assert.deepEqual(charged.transfers.map((t) => [t.loanId, t.from, t.to, t.cents]), [["CY3", ME, "cycle", 180]]);
  const broke = plan({ civs: [me({ balanceCents: -9900, incomeCents: 10000 })], macro: slump });
  assert.deepEqual(broke.transfers, [], "100 of funds can't hold a 180 charge");
  const exact = plan({ civs: [me({ balanceCents: -9820, incomeCents: 10000 })], macro: slump });
  assert.equal(exact.transfers.length, 1, "exactly the charge in funds pays it");
  const level = plan({ civs: [me()], macro: macroWith({ e: 10000 }) });
  assert.deepEqual(level.transfers, []);
});
