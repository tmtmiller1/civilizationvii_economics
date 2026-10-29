import test from "node:test";
import assert from "node:assert/strict";

import { aiTaxLevel, canChangeTax, effectiveTaxLevel, isTaxLevel, taxFlow } from "../ui/econ-tax.js";
import { planTurn } from "../ui/econ-plan.js";
import { civ, input } from "./_fixtures.mjs";

test("the four levels: Gold and the meter as shares of max(0, income) and max(0, happiness); Standard moves nothing", () => {
  const q = { incomeCents: 10000, happinessCents: 2000 };
  assert.deepEqual(taxFlow({ level: "light", ...q }), { goldCents: -1500, celebrationCents: 400 });
  assert.deepEqual(taxFlow({ level: "standard", ...q }), { goldCents: 0, celebrationCents: 0 });
  assert.deepEqual(taxFlow({ level: "heavy", ...q }), { goldCents: 1500, celebrationCents: -400 });
  assert.deepEqual(taxFlow({ level: "warLevy", ...q, atWar: true }), { goldCents: 3000, celebrationCents: -800 });
  assert.deepEqual(taxFlow({ level: "heavy", incomeCents: -500, happinessCents: -5 }), { goldCents: 0, celebrationCents: 0 });
  assert.equal(isTaxLevel("heavy"), true);
  assert.equal(isTaxLevel("ruinous"), false);
});

test("War Levy outside a war reads as Standard; an unknown level reads as Standard", () => {
  assert.equal(effectiveTaxLevel("warLevy", false), "standard");
  assert.equal(effectiveTaxLevel("warLevy", true), "warLevy");
  assert.equal(effectiveTaxLevel("ruinous", true), "standard");
});

test("one change per 5 turns", () => {
  assert.equal(canChangeTax(undefined, 3), true);
  assert.equal(canChangeTax(10, 14), false);
  assert.equal(canChangeTax(10, 15), true);
});

test("the fallback's AI rule (DESIGN 6): Heavy when short and falling or insolvent, Light when flush, else Standard", () => {
  assert.equal(aiTaxLevel({ balanceCents: 4000, incomeCents: -1000, falling: true }), "heavy");
  assert.equal(aiTaxLevel({ balanceCents: 4000, incomeCents: -1000, falling: true, atWar: true }), "warLevy");
  assert.equal(aiTaxLevel({ balanceCents: 4000, incomeCents: 1000, falling: false }), "standard");
  assert.equal(aiTaxLevel({ balanceCents: 1e6, incomeCents: 0, insolvent: true }), "heavy");
  assert.equal(aiTaxLevel({ balanceCents: 30001, incomeCents: 1000 }), "light");
  assert.equal(aiTaxLevel({ balanceCents: 30000, incomeCents: 1000 }), "standard");
});

test("the plan runs taxes only with the fallback flag on; a tax request is refused without it", () => {
  const civs = [civ(3, { human: true, incomeCents: 10000, happinessCents: 1000 }),
    civ(5, { balanceCents: 1e6, incomeCents: 1000 })];
  const off = planTurn(input({ civs, requests: [{ kind: "tax", pid: 3, level: "heavy" }] }));
  assert.deepEqual(off.transfers, []);
  assert.equal(off.events[0].reason, "taxes-native");
  const on = planTurn(input({ civs, options: { taxFallback: true }, requests: [{ kind: "tax", pid: 3, level: "heavy" }] }));
  assert.deepEqual(on.transfers.map((t) => [t.from, t.to, t.cents, t.reason]),
    [["tax", 3, 1500, "tax"], [5, "tax", 150, "tax"]], "the flush AI runs Light and pays the tax account");
  assert.deepEqual(on.celebration, [{ pid: 3, amount: -200, reason: "tax" }]);
  assert.deepEqual(on.ledger.taxes, [{ pid: 3, level: "heavy", changedTurn: 50 }, { pid: 5, level: "light",
    changedTurn: 50 }]);
  const soon = planTurn(input({ turn: 52, ledger: on.ledger, civs, options: { taxFallback: true },
    requests: [{ kind: "tax", pid: 3, level: "light" }] }));
  assert.equal(soon.events.find((e) => e.kind === "refused").reason, "too-soon");
  assert.equal(soon.batch.civs[0].celebration, -200, "the batch carries the meter grant too");
  const broke = planTurn(input({ ledger: on.ledger, turn: 53, civs: [civs[0], civ(5, { balanceCents: -5000,
    incomeCents: 1000 })], options: { taxFallback: true } }));
  assert.deepEqual(broke.transfers.filter((t) => t.from === 5), [], "a Light remittance the funds can't cover is missed");
});
