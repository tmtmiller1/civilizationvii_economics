// _fixtures.mjs - shared inputs for the Economics tests: the engine lines from the dumped GlobalParameters, and small
// builders for civs and plan inputs. Player ids are deliberately sparse so nothing can lean on id arithmetic. A test
// civ has every stage open from turn 0 unless it says otherwise, so a test about one rule isn't gated by another.

import { readFileSync } from "node:fs";
import { engineLines } from "../ui/econ-params.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/global-parameters-1.5.0.json", import.meta.url), "utf8"));
export const ENGINE = engineLines(fixture.rows);
export const PARAMS = { amenityLineCents: ENGINE.amenityLineCents, disbandLineCents: ENGINE.disbandLineCents };

export const OPEN = { moneylending: 0, publicDebt: 0 };
export const CLOSED = { moneylending: null, publicDebt: null };
/** Every stage open, the 1.1 ones included. */
export const OPEN_ALL = { ...OPEN, trade: 0, guildPatronage: 0, charteredCompanies: 0, tariffs: 0 };

export const civ = (id, over = {}) => ({ id, alive: true, human: false, balanceCents: 50000, incomeCents: 1000,
  upkeepCents: 500, stages: OPEN, depthTurns: 0, depthFactorPct: 100, ...over });

export const input = (over = {}) => ({ turn: 50, age: "AGE_EXPLORATION", civs: [], relations: [], requests: [],
  params: PARAMS, options: {}, ...over });
