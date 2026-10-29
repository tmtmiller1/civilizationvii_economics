import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { describeBatchRow, describeEvent, describeNotice, describeRefusal, eventConcerns, reasonKey, requestKey,
  worldNameKey } from "../ui/econ-notice-text.js";
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
  assert.deepEqual(describeNotice({ pid: 2, kind: "guard-cap", cap: 10000, deficit: 3500, disbandLineCents: -1000 }, ctx),
    { key: "LOC_ECONOMICS_NOTICE_GUARD_CAP", args: ["100", "35", "-10"] });
  assert.deepEqual(describeNotice({ pid: 2, kind: "repudiated-by", borrower: 4, cents: 1234 }, ctx),
    { key: "LOC_ECONOMICS_NOTICE_REPUDIATED_BY", args: ["Civ 4", "12.3"] });
  assert.equal(describeNotice({ pid: 2, kind: "open", loanId: "L9" }, ctx), null, "an unknown loan says nothing");
  assert.equal(describeNotice({ pid: 2, kind: "something-new" }, ctx), null);
  for (const kind of ["open", "lent", "miss", "default", "defaulted-on", "guard", "guard-cap", "insolvent", "restructure",
    "restructure-ask", "repudiated", "repudiated-by"]) {
    const line = describeNotice({ pid: 2, kind, loanId: "L1", borrower: 4, lender: "bond", cents: 1, missed: 1, turns: 5,
      cap: 1, deficit: 1 }, ctx);
    assert.ok(line && english.has(line.key), `${kind} -> ${line && line.key}`);
  }
});

test("refusals name the request and the reason through keys the English text defines", () => {
  const line = describeRefusal({ turn: 1, kind: "refused", request: "borrow", reason: "credit-cap" });
  assert.deepEqual([line.requestKey, line.reasonKey], ["LOC_ECONOMICS_REQUEST_BORROW", "LOC_ECONOMICS_REASON_CREDIT_CAP"]);
  for (const reason of ["credit-cap", "service-cap", "terms", "loan-limit", "lender", "borrower", "no-offer", "term-stage",
    "term-banking", "term-repudiation", "parties", "ai-off", "balance", "declined", "not-overdue", "income",
    "nothing-owed", "taxes-native", "too-soon", undefined]) {
    assert.ok(english.has(reasonKey(reason)), String(reason));
  }
  for (const kind of ["borrow", "lend", "repay", "restructure", "repudiate", "tax", undefined]) assert.ok(english.has(requestKey(kind)), String(kind));
  for (const party of ["bond", "temple", "tax"]) assert.ok(english.has(worldNameKey(party)), party);
});

test("the batch row gives the net Gold, Influence and celebration lines, only where something moved", () => {
  assert.deepEqual(describeBatchRow(undefined), []);
  assert.deepEqual(describeBatchRow({ pid: 2, snapshot: 0, net: 0, influence: 0, celebration: 0 }), []);
  assert.deepEqual(describeBatchRow({ pid: 2, snapshot: 0, net: -1250, influence: -5, celebration: 300 }).map((l) => [l.key, l.args]),
    [["LOC_ECONOMICS_NOTICE_NET", ["-12.5"]], ["LOC_ECONOMICS_NOTICE_INFLUENCE", [-5]], ["LOC_ECONOMICS_NOTICE_CELEBRATION", ["+3"]]]);
});

test("ledger events give history lines for the kinds a player cares about, and name their parties", () => {
  const line = describeEvent({ turn: 3, kind: "repudiation", borrower: 2, lender: 4, cents: 5000, grievances: 12 }, ctx);
  assert.deepEqual(line, { key: "LOC_ECONOMICS_EVENT_REPUDIATION", args: ["Civ 2", "50", "Civ 4", 12] });
  assert.equal(describeEvent({ turn: 3, kind: "refused", request: "borrow" }, ctx), null);
  for (const kind of ["open", "miss", "default", "closed", "restructure", "repudiation", "writeoff", "guard", "guard-cap"]) {
    const row = describeEvent({ turn: 1, kind, loanId: "L1", cents: 1, lender: "bond", borrower: 2, cap: 1 }, ctx);
    assert.ok(row && english.has(row.key), kind);
  }
  assert.equal(eventConcerns({ turn: 1, kind: "open", lender: 4, borrower: 2 }, 2), true);
  assert.equal(eventConcerns({ turn: 1, kind: "open", lender: 4, borrower: 2 }, 9), false);
});
