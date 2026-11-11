// A debt the game wipes at a civ's update is charged back when its turn opens (DESIGN 4.18, lab W12): the update
// sets a balance still below 0 back to 0 when income is positive, and grantYield of the difference puts it back.
import test from "node:test";
import assert from "node:assert/strict";

import { chargeBackCents } from "../ui/econ-restore.js";

test("a wiped debt is charged back in whole Gold; an update that left the debt, or a civ above zero, is left alone", () => {
  assert.equal(chargeBackCents(-50000, 15000, 0), -35000, "W12: -500 with +150 read 0 after the update");
  assert.equal(chargeBackCents(-49920, 16930, 0), -33000, "whole Gold: -329.90 charges back 330");
  assert.equal(chargeBackCents(-6000, -4800, -10800), 0, "income below zero: the game left the debt");
  assert.equal(chargeBackCents(-6000, 9000, 3000), 0, "the update took it above zero");
  assert.equal(chargeBackCents(-6000, 6000, 0), 0, "exactly to zero");
  assert.equal(chargeBackCents(-6000, 1500, -4520), 0, "under half a Gold off is rounding, not a wipe");
});
