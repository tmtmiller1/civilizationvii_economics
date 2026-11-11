import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { causeItems, composeArgs, describeBatchRow, describeEvent, describeNotice, describeRefusal, describeRefusalMost, describeRefusalProject,
  eventConcerns, flowKeys, joinList, reasonKey, requestKey, worldNameKey } from "../ui/econ-notice-text.js";
import { emptyLedger } from "../ui/econ-state.js";
import { makeLoan } from "../ui/econ-loan.js";

const english = new Set([...fs.readFileSync(new URL("../text/en_us/ModText.xml", import.meta.url), "utf8")
  .matchAll(/Tag="(LOC_ECONOMICS_[A-Z0-9_]+)"/g)].map((m) => m[1]));
const ctx = { ledger: { ...emptyLedger(), loans: [makeLoan({ id: "L1", lender: "bond", borrower: 2, principal: 30000,
  ratePpm: 40000, term: 10, turn: 5 })] }, nameOf: (party) => (typeof party === "number" ? `Civ ${party}` : `the ${party}`) };

test("every notice kind the plan emits has a line, with the loan's figures looked up", () => {
  assert.deepEqual(describeNotice({ pid: 2, kind: "open", loanId: "L1", source: "borrow", emergency: false }, ctx),
    { key: "LOC_ECONOMICS_NOTICE_OPEN", args: ["300", "the bond", "4.0%", 10] });
  assert.deepEqual(describeNotice({ pid: 2, kind: "guard", cents: 2500, lender: "temple", insolvent: 1 }, ctx),
    { key: "LOC_ECONOMICS_NOTICE_GUARD_INSOLVENT", args: ["25", "the temple"] });
  assert.deepEqual(describeNotice({ pid: 2, kind: "guard-cap", cap: 10000, deficit: 3500, overdraftCents: 20000 }, ctx),
    { key: "LOC_ECONOMICS_NOTICE_GUARD_CAP", args: ["100", "35", "200"] });
  assert.deepEqual(describeNotice({ pid: 2, kind: "repudiated-by", borrower: 4, cents: 1234 }, ctx),
    { key: "LOC_ECONOMICS_NOTICE_REPUDIATED_BY", args: ["Civ 4", "12.3"] });
  assert.deepEqual(describeNotice({ pid: 2, kind: "amends-ask", borrower: 4, cents: 6000, term: 10 }, ctx),
    { key: "LOC_ECONOMICS_NOTICE_AMENDS_ASK", args: ["Civ 4", "60", 10] });
  assert.deepEqual(describeNotice({ pid: 2, kind: "made-good", lender: 4 }, ctx),
    { key: "LOC_ECONOMICS_NOTICE_MADE_GOOD", args: ["Civ 4"] });
  assert.equal(describeNotice({ pid: 2, kind: "open", loanId: "L9" }, ctx), null, "an unknown loan says nothing");
  assert.equal(describeNotice({ pid: 2, kind: "something-new" }, ctx), null);
  for (const kind of ["open", "lent", "miss", "default", "defaulted-on", "guard", "guard-cap", "insolvent", "restructure",
    "restructure-ask", "repudiated", "repudiated-by", "trade", "tariff-cost", "invested", "invested-in", "invest-miss",
    "invest-default", "invest-defaulted-on", "invest-writeoff", "offer", "refinance", "made-good", "made-good-by",
    "amends-ask"]) {
    for (const form of [{ form: "project" }, { form: "general" }, { form: "general", aid: 1 }, { waived: 3 },
      { form: "general", aid: 1, cleared: 5 }, { paid: 0 }]) {
      const line = describeNotice({ pid: 2, kind, loanId: "L1", borrower: 4, lender: "bond", cents: 1, missed: 1, turns: 5,
        cap: 1, deficit: 1, investor: 4, paid: 100, received: 100, ...form }, ctx);
      assert.ok(line && english.has(line.key), `${kind} -> ${line && line.key}`);
    }
  }
  assert.deepEqual(describeNotice({ pid: 2, kind: "invested-in", lender: 4, cents: 30000, form: "project", progress: 100 },
    ctx), { key: "LOC_ECONOMICS_NOTICE_INVESTED_IN_PROJECT", args: ["Civ 4", "300", 100, "0"] });
  assert.deepEqual(describeNotice({ pid: 2, kind: "trade", paid: 500, received: 0, waived: 0 }, ctx),
    { key: "LOC_ECONOMICS_NOTICE_TRADE", args: ["5", "0", "0"] });
  assert.deepEqual(describeNotice({ pid: 2, kind: "miss", loanId: "L1", missed: 1, paid: 8000, due: 10000, short: 2000 },
    ctx), { key: "LOC_ECONOMICS_NOTICE_MISS_PART", args: ["L1", 1, "80", "100", "20"] }, "Paid 80 of 100, 20 added");
  assert.equal(describeNotice({ pid: 2, kind: "miss", loanId: "L1", missed: 2, paid: 0, due: 10000, short: 10000 },
    ctx).key, "LOC_ECONOMICS_NOTICE_MISS", "nothing paid: the plain miss");
  assert.deepEqual(describeNotice({ pid: 2, kind: "invested", borrower: 4, cents: 30000, form: "general", aid: 1,
    cleared: 12000 }, ctx), { key: "LOC_ECONOMICS_NOTICE_INVESTED_AID_CLEARED", args: ["300", "Civ 4", 0, "120"] });
});

test("a borrow over a limit adds the most that lender would lend over the term; anything else adds nothing", () => {
  const ctx = { ledger: emptyLedger(), nameOf: (p) => (p === "bond" ? "the bond market" : `Civ ${p}`) };
  const event = { turn: 1, kind: "refused", request: "borrow", reason: "service-cap", lender: "bond", term: 20,
    most: 15300 };
  assert.deepEqual(describeRefusalMost(event, ctx), { key: "LOC_ECONOMICS_NOTICE_REFUSED_MOST",
    args: ["the bond market", 20, "153"] });
  assert.deepEqual(describeRefusalMost({ ...event, lender: 6, most: 0 }, ctx), { key: "LOC_ECONOMICS_NOTICE_REFUSED_NONE",
    args: ["Civ 6", 20, "0"] });
  assert.equal(describeRefusalMost({ ...event, most: undefined }, ctx), null);
  assert.equal(describeRefusalMost({ ...event, request: "lend" }, ctx), null);
  assert.equal(describeRefusalMost({ ...event, lender: undefined }, ctx), null);
  for (const key of ["LOC_ECONOMICS_NOTICE_REFUSED_MOST", "LOC_ECONOMICS_NOTICE_REFUSED_NONE", "LOC_ECONOMICS_BORROW_MOST",
    "LOC_ECONOMICS_BORROW_MOST_NONE", "LOC_ECONOMICS_BORROW_THAT"]) assert.ok(english.has(key), key);
});

test("refusals name the request and the reason through keys the English text defines", () => {
  const line = describeRefusal({ turn: 1, kind: "refused", request: "borrow", reason: "credit-cap" });
  assert.deepEqual([line.requestKey, line.reasonKey], ["LOC_ECONOMICS_REQUEST_BORROW", "LOC_ECONOMICS_REASON_CREDIT_CAP"]);
  for (const reason of ["credit-cap", "service-cap", "terms", "loan-limit", "lender", "borrower", "no-offer", "term-stage",
    "term-banking", "term-repudiation", "parties", "ai-off", "balance", "declined", "not-active", "restructured", "income",
    "nothing-owed", "taxes-native", "too-soon", "loans-off", "tariffs-off", "tariff-stage", "investment-off",
    "invest-stage", "blocked", "build", "same-turn", "relation", "host-default", "offer-gone", undefined]) {
    assert.ok(english.has(reasonKey(reason)), String(reason));
  }
  for (const kind of ["borrow", "lend", "repay", "restructure", "repudiate", "tax", "tariff", "invest", "accept-offer",
    "decline-offer", undefined]) assert.ok(english.has(requestKey(kind)), String(kind));
  for (const party of ["bond", "temple", "tax", "progress"]) assert.ok(english.has(worldNameKey(party)), party);
});

test("the batch row gives the net Gold, Influence and celebration lines, only where something moved", () => {
  assert.deepEqual(describeBatchRow(undefined), []);
  assert.deepEqual(describeBatchRow({ pid: 2, snapshot: 0, net: 0, influence: 0, celebration: 0 }), []);
  assert.deepEqual(describeBatchRow({ pid: 2, snapshot: 0, net: -1250, influence: -5, celebration: 300 }).map((l) => [l.key, l.args]),
    [["LOC_ECONOMICS_NOTICE_NET_PLAIN", ["-13"]], ["LOC_ECONOMICS_NOTICE_INFLUENCE", [-5]], ["LOC_ECONOMICS_NOTICE_CELEBRATION", ["+3"]]]);
  assert.deepEqual(describeBatchRow({ pid: 2, snapshot: 0, net: 501, influence: 0, celebration: 0 },
    ["LOC_ECONOMICS_FLOW_TRADE"]), [{ key: "LOC_ECONOMICS_NOTICE_NET", args: ["+5", ["LOC_ECONOMICS_FLOW_TRADE"]] }],
  "a trade bill alone is named as a trade bill, not a loan");
  assert.deepEqual(describeBatchRow({ pid: 2, snapshot: 0, net: -3, influence: 0, celebration: 0 }), [],
    "a net that rounds to 0 Gold says nothing (it read -0.0 in the lab's Antiquity game)");
  assert.deepEqual(describeBatchRow({ pid: 2, snapshot: 0, net: 4, influence: 0, celebration: 0 }), []);
  assert.deepEqual(describeBatchRow({ pid: 2, snapshot: 0, net: -190, influence: 0, celebration: 40 }), [],
    "a net under 2 Gold and a celebration that rounds to 0 say nothing (the top bar shows whole Gold)");
  assert.deepEqual(describeBatchRow({ pid: 2, snapshot: 0, net: 200, influence: 0, celebration: 0 }).map((l) => l.args),
    [["+2"]], "2 Gold shows");
  const transfers = [{ loanId: "B2-4", turn: 1, from: 4, to: 2, cents: 500, reason: "trade", parts: {} },
    { loanId: "L1", turn: 1, from: 2, to: "bond", cents: 300, reason: "payment", parts: {} },
    { loanId: "CY9", turn: 1, from: "cycle", to: 9, cents: 300, reason: "cycle", parts: {} }];
  assert.deepEqual(flowKeys(transfers, 2), ["LOC_ECONOMICS_FLOW_LOANS", "LOC_ECONOMICS_FLOW_TRADE"]);
  assert.deepEqual(flowKeys(transfers, 4), ["LOC_ECONOMICS_FLOW_TRADE"]);
  assert.deepEqual(flowKeys(undefined, 4), []);
});

test("ledger events give history lines for the kinds a player cares about, and name their parties", () => {
  const line = describeEvent({ turn: 3, kind: "repudiation", borrower: 2, lender: 4, cents: 5000, grievances: 12 }, ctx);
  assert.deepEqual(line, { key: "LOC_ECONOMICS_EVENT_REPUDIATION", args: ["Civ 2", "50", "Civ 4", 12] });
  assert.equal(describeEvent({ turn: 3, kind: "refused", request: "borrow" }, ctx), null);
  for (const kind of ["open", "miss", "default", "closed", "restructure", "repudiation", "writeoff", "guard", "guard-cap",
    "invest", "invest-miss", "invest-default", "invest-closed", "invest-writeoff", "offer", "offer-declined", "tariff",
    "made-good"]) {
    for (const extra of [{ level: "high", form: "project" }, { level: "low", form: "general" }, { level: "none", aid: 1 }]) {
      const row = describeEvent({ turn: 1, kind, loanId: "L1", cents: 1, lender: "bond", borrower: 2, cap: 1, pid: 2,
        ...extra }, ctx);
      assert.ok(row && english.has(row.key), `${kind} -> ${row && row.key}`);
    }
  }
  assert.equal(eventConcerns({ turn: 1, kind: "open", lender: 4, borrower: 2 }, 2), true);
  assert.equal(eventConcerns({ turn: 1, kind: "open", lender: 4, borrower: 2 }, 9), false);
});

test("a list reads as a sentence: the last two joined by the language's 'and'", () => {
  assert.equal(joinList([], "and"), "");
  assert.equal(joinList(["trade bills"], "and"), "trade bills");
  assert.equal(joinList(["trade bills", "the business cycle"], "and"), "trade bills and the business cycle");
  assert.equal(joinList(["loans", "trade bills", "the plan"], "und"), "loans, trade bills und the plan");
  const loc = (key, ...args) => ({ LOC_ECONOMICS_LIST_AND: "and", LOC_ECONOMICS_FLOW_TRADE: "trade bills",
    LOC_ECONOMICS_FLOW_CYCLE: "the business cycle" })[key] ?? [key, ...args].join("|");
  const [line] = describeBatchRow({ pid: 2, snapshot: 0, net: -310, influence: 0, celebration: 0 },
    ["LOC_ECONOMICS_FLOW_TRADE", "LOC_ECONOMICS_FLOW_CYCLE"]);
  assert.deepEqual(composeArgs(line.args, loc), ["-3", "trade bills and the business cycle"]);
  assert.ok(english.has("LOC_ECONOMICS_LIST_AND"));
});

test("a phase change names a repeated cause once with its count, not twice", () => {
  assert.deepEqual(causeItems(["war-declared", "war-declared", "disaster"]),
    [{ key: "LOC_ECONOMICS_CYCLE_EVENT_WAR_DECLARED_MANY", args: [2] }, "LOC_ECONOMICS_CYCLE_EVENT_DISASTER"]);
  assert.deepEqual(causeItems(["income-up", "income-up"]), ["LOC_ECONOMICS_CYCLE_EVENT_INCOME_UP"],
    "a kind with no counted text is named once");
  const line = describeNotice({ pid: 2, kind: "phase", from: "steady", to: "slump",
    causes: "war-declared,war-declared" }, ctx);
  const loc = (key, ...args) => (key === "LOC_ECONOMICS_LIST_AND" ? "and" : [key, ...args].join("|"));
  assert.deepEqual(composeArgs(line.args, loc), ["LOC_ECONOMICS_PHASE_SLUMP", "LOC_ECONOMICS_CYCLE_EVENT_WAR_DECLARED_MANY|2"]);
  for (const kind of ["war-declared", "peace", "capture", "raze", "disaster", "default", "repudiation", "route-new",
    "route-ended"]) {
    const [item] = causeItems([kind, kind]);
    assert.ok(english.has(item.key), item.key);
  }
});

test("the age change's Gold cut: a notice for the player and a line in the history", () => {
  assert.deepEqual(describeNotice({ pid: 2, kind: "age-gold", before: 1143200, after: 600000 }, ctx),
    { key: "LOC_ECONOMICS_NOTICE_AGE_GOLD", args: ["6000", "11432"] });
  assert.deepEqual(describeEvent({ turn: 1, kind: "age-gold", pid: 4, before: 1143200, after: 600000 }, ctx),
    { key: "LOC_ECONOMICS_EVENT_AGE_GOLD", args: ["Civ 4", "6000", "11432"] });
  assert.ok(english.has("LOC_ECONOMICS_NOTICE_AGE_GOLD") && english.has("LOC_ECONOMICS_EVENT_AGE_GOLD"));
});

test("general investment refused for default names the development loan still open, and nothing otherwise", () => {
  const event = { turn: 1, kind: "refused", request: "invest", reason: "host-default", host: 4, cents: 20000,
    project: 1 };
  assert.deepEqual(describeRefusalProject(event, ctx), { key: "LOC_ECONOMICS_NOTICE_REFUSED_PROJECT",
    args: ["Civ 4", "200"] });
  assert.equal(describeRefusalProject({ ...event, project: 0 }, ctx), null);
  assert.equal(describeRefusalProject({ ...event, reason: "relation" }, ctx), null);
  assert.equal(describeRefusalProject({ ...event, request: "borrow" }, ctx), null);
  assert.ok(english.has("LOC_ECONOMICS_NOTICE_REFUSED_PROJECT"));
});

test("a closed loan's event names both sides, so the Treasury history lists \"paid off\" for them", async () => {
  const { planTurn } = await import("../ui/econ-plan.js");
  const { makeLoan } = await import("../ui/econ-loan.js");
  const { emptyLedger } = await import("../ui/econ-state.js");
  const { civ, input } = await import("./_fixtures.mjs");
  const loan = { ...makeLoan({ id: "L1", lender: 6, borrower: 3, principal: 1000, ratePpm: 10000, term: 10, turn: 1 }),
    outstanding: 100, paid: 9 };
  const out = planTurn(input({ ledger: { ...emptyLedger(), loans: [loan], nextId: 2 }, civs: [civ(3, { balanceCents: 5000 }),
    civ(6, { balanceCents: 5000 })] }));
  const closed = out.events.find((e) => e.kind === "closed");
  assert.deepEqual([closed.loanId, closed.borrower, closed.lender], ["L1", 3, 6]);
  assert.equal(eventConcerns(closed, 3) && eventConcerns(closed, 6) && !eventConcerns(closed, 4), true);
});

test("a crisis that ends after Confidence was taken twice names Confidence once", () => {
  const line = describeNotice({ pid: 2, kind: "crisis-end", crisis: "depression", turns: 8,
    by: "confidence,public-works,confidence" }, ctx);
  assert.deepEqual(line, { key: "LOC_ECONOMICS_NOTICE_CRISIS_END", args: ["LOC_ECONOMICS_CRISIS_DEPRESSION_NAME", 8,
    ["LOC_ECONOMICS_RESPONSE_CONFIDENCE_NAME", "LOC_ECONOMICS_RESPONSE_PUBLIC_WORKS_NAME"]] });
});

test("the trade bill line reads in whole Gold, the way the game lands it, and a bill under a Gold each way says nothing", () => {
  const ctx2 = { ledger: emptyLedger(), nameOf: () => "x" };
  assert.equal(describeNotice({ pid: 2, kind: "trade", paid: 0, received: 60, waived: 0 }, ctx2), null, "received 0.6: no line");
  assert.equal(describeNotice({ pid: 2, kind: "trade", paid: 99, received: 99, waived: 0 }, ctx2), null);
  assert.deepEqual(describeNotice({ pid: 2, kind: "trade", paid: 0, received: 120, waived: 0 }, ctx2),
    { key: "LOC_ECONOMICS_NOTICE_TRADE", args: ["0", "1", "0"] }, "1.2 lands as 1");
  assert.deepEqual(describeNotice({ pid: 2, kind: "trade", paid: 1290, received: 0, waived: 250 }, ctx2),
    { key: "LOC_ECONOMICS_NOTICE_TRADE_WAIVED", args: ["12", "0", "2"] });
});
