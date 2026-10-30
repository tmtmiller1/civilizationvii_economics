import test from "node:test";
import assert from "node:assert/strict";
import { installFakeEngine, removeFakeEngine } from "./_fake-engine.mjs";
import { composeLines, flushNotice, holdNotice, pendingNotice } from "../ui/econ-notify.js";
import { emptyLedger } from "../ui/econ-state.js";
import { makeLoan } from "../ui/econ-loan.js";

const plan = () => ({
  ledger: { ...emptyLedger(), lastTurn: 10, loans: [makeLoan({ id: "L1", lender: "bond", borrower: 0, principal: 10000,
    ratePpm: 40000, term: 10, turn: 10 })] },
  transfers: [{ loanId: "L1", turn: 10, from: "bond", to: 0, cents: 10000, reason: "principal", parts: {} }],
  influence: [], celebration: [], grievances: [], relationships: [], skipped: null,
  events: [{ turn: 10, kind: "refused", request: "lend", lender: 0, reason: "declined" },
    { turn: 10, kind: "refused", request: "borrow", borrower: 3, reason: "credit-cap" }],
  notices: [{ pid: 0, kind: "open", loanId: "L1", source: "borrow", emergency: false }, { pid: 3, kind: "miss", loanId: "L1" }],
  batch: { id: "B1", turn: 10, civs: [{ pid: 0, snapshot: 5000, net: 10000, influence: 0, celebration: 0 }] },
});

test("the lines are the human's own: its net, its notices and its refusals, in the game's language", () => {
  installFakeEngine({ civs: [{ id: 0, human: true }, { id: 3 }] });
  const lines = composeLines(plan(), 0);
  assert.deepEqual(lines, [
    "LOC_ECONOMICS_NOTICE_NET|+100|LOC_ECONOMICS_FLOW_LOANS",
    "LOC_ECONOMICS_NOTICE_OPEN|100|LOC_ECONOMICS_LENDER_BOND|4.0%|10",
    "LOC_ECONOMICS_NOTICE_REFUSED|LOC_ECONOMICS_REQUEST_LEND|LOC_ECONOMICS_REASON_DECLINED",
  ]);
  removeFakeEngine();
});

test("held at TurnBegin, sent once at the local turn, or at once when the turn is already active", () => {
  const world = installFakeEngine({ civs: [{ id: 0, human: true }, { id: 3 }] });
  const state = { activeTurn: -1 };
  holdNotice(plan(), state);
  assert.equal(pendingNotice()?.turn, 10);
  assert.equal(world.notifications.length, 0);
  assert.equal(flushNotice(), true);
  assert.equal(world.notifications.length, 1);
  assert.equal(world.notifications[0].Type, "#NOTIFICATION_ECONOMICS_TURN");
  assert.ok(world.notifications[0].Summary.includes("[N]"));
  assert.equal(flushNotice(), false, "nothing left to send");
  holdNotice(plan(), { activeTurn: 10 });
  assert.equal(world.notifications.length, 2, "the turn was already active: sent at once");
  const quiet = { ...plan(), notices: [], events: [], batch: { id: "B2", turn: 10, civs: [] } };
  holdNotice(quiet, state);
  assert.equal(pendingNotice(), null, "a turn with nothing to say sends nothing");
  removeFakeEngine();
});
