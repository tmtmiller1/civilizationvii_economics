// _fixtures.mjs - shared inputs for the Economics tests: the purchase rate from the dumped GlobalParameters, and small
// builders for civs and plan inputs. Player ids are deliberately sparse so nothing can lean on id arithmetic. A test
// civ has every stage open from turn 0 unless it says otherwise, so a test about one rule isn't gated by another.

import { readFileSync } from "node:fs";
import { purchasePointCents } from "../ui/econ-params.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/global-parameters-1.5.0.json", import.meta.url), "utf8"));
export const PARAMS = { goldPerPointCents: purchasePointCents(fixture.rows) };

export const OPEN = { moneylending: 0, publicDebt: 0 };
export const CLOSED = { moneylending: null, publicDebt: null };
/** Every stage open, the 1.1 ones included. */
export const OPEN_ALL = { ...OPEN, trade: 0, guildPatronage: 0, charteredCompanies: 0, tariffs: 0 };
/** Every stage open, the 1.2 ones (Banking, Capitalism) too. */
export const OPEN_MACRO = { ...OPEN_ALL, banking: 0, capitalism: 0 };

// A test civ has no overdraft unless it says so (`overdraftCents`), so a test about a miss sees its funds exactly;
// the overdraft's own tests (econ-overdraft.test.mjs) and the property economies use the real limit.
export const civ = (id, over = {}) => ({ id, alive: true, human: false, balanceCents: 50000, incomeCents: 1000,
  upkeepCents: 500, stages: OPEN, depthTurns: 0, depthFactorPct: 100, overdraftCents: 0, ...over });

/** The 1.2 parts off, so a test about a 1.0 or 1.1 rule sees no cycle Gold or system terms unless it asks. */
export const MACRO_OFF = { cycle: "off", systems: false, inflation: false };

export const input = (over = {}) => ({ turn: 50, age: "AGE_EXPLORATION", civs: [], relations: [], requests: [],
  params: PARAMS, ...over, options: { ...MACRO_OFF, ...(over.options || {}) } });
