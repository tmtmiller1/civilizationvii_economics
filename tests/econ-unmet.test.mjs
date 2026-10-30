// Civs that haven't met don't deal (the lab's build check 2.1 saw unmet AIs offering the player loans): the glue sends
// an unmet pair as a row of its own; no offer, loan, lending or investment crosses it, and it isn't a witness.
import test from "node:test";
import assert from "node:assert/strict";
import { planTurn } from "../ui/econ-plan.js";
import { loanOffers, repudiationPreview } from "../ui/econ-view-model.js";
import { installFakeEngine, removeFakeEngine } from "./_fake-engine.mjs";
import { readRelations } from "../ui/econ-engine.js";
import { OPEN_ALL, civ, input } from "./_fixtures.mjs";

const ME = 3;
const me = (over = {}) => civ(ME, { human: true, incomeCents: 10000, balanceCents: 100000, stages: OPEN_ALL, ...over });
const rich = (id) => civ(id, { incomeCents: 10000, balanceCents: 10000000, stages: OPEN_ALL });

test("an AI the player hasn't met offers no loan; one it has met does", () => {
  const planInput = input({ civs: [me(), rich(6), rich(8)], relations: [{ a: ME, b: 6, level: "neutral" },
    { a: ME, b: 8, level: "unmet" }] });
  assert.deepEqual(loanOffers(planInput, ME, 1000, 10).map((o) => o.lender), [6, "bond"]);
  const out = planTurn(input({ ...planInput, requests: [{ kind: "borrow", borrower: ME, lender: 8, principal: 1000,
    term: 10 }, { kind: "lend", lender: ME, borrower: 8, principal: 1000, ratePpm: 30000, term: 10 },
  { kind: "invest", investor: ME, host: 8, form: "general", cents: 1000, asAid: true }] }));
  assert.deepEqual(out.events.filter((e) => e.kind === "refused").map((e) => [e.request, e.reason]),
    [["borrow", "no-offer"], ["lend", "unmet"], ["invest", "unmet"]]);
  assert.deepEqual(repudiationPreview(planInput, ME, "bond").witnesses, [6], "an unmet civ isn't a witness");
});

test("the glue reads an unmet pair as an unmet row", () => {
  removeFakeEngine();
  installFakeEngine({ civs: [{ id: 0 }, { id: 3 }], met: false });
  assert.deepEqual(readRelations([0, 3]), [{ a: 0, b: 3, level: "unmet" }]);
  removeFakeEngine();
});
