// The 1.1 glue against a fake engine (DESIGN 4.9, 4.10, 4.12): imports grouped by the city they come from, majors
// only, with the Trade buildings at both ends; copies counted at the origin; the strategic units; each city's build
// and what it still needs; the progress landing on the city found again by its key; and the session carrying it all.
import test from "node:test";
import assert from "node:assert/strict";
import { installFakeEngine, removeFakeEngine } from "./_fake-engine.mjs";
import { cityKey, makeRolesFor, readCities, readHeldResources, readMarket, readRoutes, readTradeIncomeCents,
  sendProgress } from "../ui/econ-commerce-read.js";
import { buildInput, loadSession, runTurn, writeMarkets } from "../ui/econ-session.js";
import { bankGoldYield, buildingData, readCityBuildings, resetBuildingDataForTests } from "../ui/econ-engine.js";
import { resetAnchorsForTests } from "../ui/econ-stage-read.js";
import { MARKETS_KEY } from "../ui/econ-markets.js";

const resources = [{ ResourceType: "RESOURCE_IRON", ResourceClassType: "RESOURCECLASS_EMPIRE", $hash: 101 },
  { ResourceType: "RESOURCE_WINE", ResourceClassType: "RESOURCECLASS_CITY", $hash: 102 }];
const city = (owner, id) => ({ owner, id, type: 1 });
const civs = () => [
  { id: 0, human: true, income: 50, held: [{ type: 101, origin: city(0, 1) }, { type: 102, origin: city(4, 7) },
    { type: 101, origin: city(9, 2) }], routes: [{ targetCityId: city(0, 1), nearestCityId: city(4, 7) }],
  cityList: [{ id: 1, buildings: [1], build: "BUILDING_LIBRARY", progress: 30, percent: 25, trade: 6, purchase: 240, cost: 120 }] },
  { id: 4, income: 20, held: [{ type: 102, origin: city(4, 7) }, { type: 101, origin: city(0, 1) }],
    cityList: [{ id: 7, buildings: [0, 1] }] },
  { id: 9, major: false, held: [{ type: 101, origin: city(9, 2) }] },
];
function fresh(spec = {}) {
  removeFakeEngine();
  resetBuildingDataForTests();
  resetAnchorsForTests();
  return installFakeEngine({ civs: civs(), resources, units: [{ UnitType: "UNIT_KNIGHT", StrategicResource: "RESOURCE_IRON" },
    { UnitType: "UNIT_SCOUT" }], constructibles: [{ ConstructibleType: "BUILDING_LIBRARY", ConstructibleClass: "BUILDING",
    Cost: 120, $hash: "#BUILDING_LIBRARY" }], advisories: [{ ConstructibleType: "BUILDING_BANK",
    AdvisoryClassType: "ADVISORY_CLASS_TRADE" }], ...spec });
}

test("city keys and held resources with their origin", () => {
  fresh();
  assert.equal(cityKey({ owner: 3, id: 65536 }), "3:65536");
  assert.equal(cityKey(null), null);
  assert.equal(cityKey({ owner: "3", id: 1 }), null);
  assert.deepEqual(readHeldResources(0), [{ type: "RESOURCE_IRON", origin: "0:1", owner: 0 },
    { type: "RESOURCE_WINE", origin: "4:7", owner: 4 }, { type: "RESOURCE_IRON", origin: "9:2", owner: 9 }]);
  removeFakeEngine();
  assert.deepEqual(readHeldResources(0), [], "no engine: nothing held");
});

test("routes between majors: the importer's copies by origin city, with the Trade buildings at both ends", () => {
  fresh();
  const trade = new Map([["4:7", 2], ["0:1", 1]]);
  assert.deepEqual(readRoutes([0, 4], trade), [
    { importer: 0, exporter: 4, resources: ["RESOURCE_WINE"], exporterTradeBuildings: 2, importerTradeBuildings: 1 },
    { importer: 4, exporter: 0, resources: ["RESOURCE_IRON"], exporterTradeBuildings: 1, importerTradeBuildings: 0 },
  ], "the independent's copy is left out; with no route read, the importer's side counts none");
});

test("the market read: the resource rows, copies counted once at the origin, strategic units, Industry", () => {
  fresh();
  assert.deepEqual(readMarket([0, 4], 3), { resources: [{ type: "RESOURCE_IRON", class: "RESOURCECLASS_EMPIRE" },
    { type: "RESOURCE_WINE", class: "RESOURCECLASS_CITY" }], copies: { RESOURCE_IRON: 1, RESOURCE_WINE: 1 },
  strategic: ["RESOURCE_IRON"], industry: 3 });
});

test("cities: the build at the head of the queue, what it still needs, its price, the Trade buildings", () => {
  fresh();
  const rolesFor = makeRolesFor(buildingData(), bankGoldYield());
  const rows = readCities(0, rolesFor, (c) => readCityBuildings(c));
  assert.deepEqual(rows, [{ id: "0:1", build: "BUILDING_LIBRARY", neededProgress: 90, roleBuilding: false,
    tradeBuildings: 1, purchaseCents: 24000, population: 3, progressScalePct: 100, turnsLeft: 5, buildGoldYield: 0,
    military: false, pointCents: 200, loc: null, orig: null, goldCents: 0 }],
  "30 done at 25%: 90 to go; the Bank's trade advisory counts; 5 turns left; a Library yields no Gold; 240 Gold for"
  + " 120 production is 2 Gold a point");
  const empty = readCities(4, rolesFor, () => []);
  assert.deepEqual(empty, [{ id: "4:7", build: null, neededProgress: 0, roleBuilding: false, tradeBuildings: 0,
    purchaseCents: null, population: 3, progressScalePct: 100, loc: null, orig: null, goldCents: 0 }]);
  assert.equal(readTradeIncomeCents(0), 600);
  assert.deepEqual(readCities(77, rolesFor, () => []), []);
});

test("progress lands on the city found again by its key, and only on a queued build", () => {
  const world = fresh();
  assert.equal(sendProgress({ host: 0, cityId: "0:1", amount: 40, investmentId: "I1" }), true);
  assert.deepEqual(world.calls.filter((c) => c.startsWith("progress")), ["progress 0:1 40"]);
  assert.equal(sendProgress({ host: 4, cityId: "4:7", amount: 40, investmentId: "I1" }), false, "nothing queued");
  assert.equal(sendProgress({ host: 0, cityId: "0:9", amount: 40, investmentId: "I1" }), false, "not found");
  assert.equal(sendProgress({ host: 0, cityId: "0:1", amount: 0, investmentId: "I1" }), false);
});

test("the session reads 1.1 for every major, writes the markets envelope with the ledger, and lands progress", () => {
  const world = fresh();
  const session = loadSession();
  const input = buildInput(session);
  assert.deepEqual(input.civs.map((c) => [c.id, c.cities?.length, c.tradeIncomeCents]), [[0, 1, 600], [4, 1, 0]]);
  assert.equal(input.routes.length, 2);
  assert.deepEqual(input.market.strategic, ["RESOURCE_IRON"]);
  runTurn(session, "test");
  assert.ok(world.calls.includes(`write ${MARKETS_KEY}`));
  assert.ok(Object.keys(session.markets.prices).length === 2, "prices from the market read");
  assert.ok(writeMarkets(session));
  world.config.ECONOMICS_MARKETS = "ECONOMICS_MARKETS_OFF";
  world.config.ECONOMICS_INVESTMENT = "ECONOMICS_INVESTMENT_OFF";
  const off = buildInput(loadSession());
  assert.deepEqual([off.routes, off.market, off.civs[0].cities], [[], undefined, undefined], "both off: no 1.1 reads");
  removeFakeEngine();
});
