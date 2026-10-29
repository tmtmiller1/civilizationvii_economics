// _fake-engine.mjs - a stand-in for the game's globals, so the glue (econ-engine.js, econ-session.js, econ-notify.js,
// econ-fiscal.js) runs under Node. Only the surface the glue touches is modelled; every call that writes is recorded
// in `calls` so a test can read the order of the ledger write against the grants. installFakeEngine() sets the
// globals and returns the world; removeFakeEngine() takes them down again.

const GLOBALS = ["Players", "Game", "GameContext", "GameInfo", "Configuration", "YieldTypes", "engine", "Locale",
  "DiplomacyPlayerRelationships", "Units", "Constructibles", "PlayerOperationTypes", "PlayerOperationParameters",
  "CultureSlotTypes", "document", "localStorage"];

function table(rows) {
  const list = [...rows];
  return {
    [Symbol.iterator]: () => list[Symbol.iterator](),
    lookup: (key) => list.find((row) => Object.values(row).includes(key)) ?? null,
    find: (fn) => list.find(fn),
    filter: (fn) => list.filter(fn),
    forEach: (fn) => list.forEach(fn),
  };
}

/**
 * @param {{ turn?: number, local?: number, age?: string, civs?: object[], config?: Record<string, unknown>,
 *   multiplayer?: boolean, unlocks?: object[], nodesOf?: Record<number, string[]>, met?: boolean }} [spec]
 */
export function installFakeEngine(spec = {}) {
  const world = {
    turn: spec.turn ?? 10, local: spec.local ?? 0, age: spec.age ?? "AGE_EXPLORATION",
    config: { ...(spec.config || {}) }, calls: /** @type {string[]} */ ([]), handlers: new Map(),
    notifications: /** @type {object[]} */ ([]), operations: /** @type {object[]} */ ([]), swapAllowed: true,
    civs: new Map((spec.civs || []).map((civ) => [civ.id, { balance: 100, income: 5, human: civ.id === (spec.local ?? 0),
      alive: true, major: true, war: [], relation: {}, nodes: [], active: [], unlocked: [], buildings: [], ...civ }])),
  };
  const civ = (pid) => world.civs.get(pid);
  const record = (line) => world.calls.push(line);
  const players = {
    get(pid) {
      const c = civ(pid);
      if (!c) throw new Error(`no player ${pid}`);
      return {
        id: pid, isAlive: c.alive, isMajor: c.major, isHuman: c.human, civilizationName: c.name || `Civ ${pid}`,
        Treasury: { goldBalance: c.balance, getMaintenanceForAllUnitsOfType: () => 1 },
        Stats: { getNetYield: (yieldType) => (yieldType === 1 ? c.income : 2), getLifetimeYield: () => c.lifetime ?? 0 },
        Happiness: { nextGoldenAgeThreshold: c.threshold ?? 100, isInGoldenAge: () => c.celebrating === true },
        Diplomacy: {
          isAtWarWith: (other) => c.war.includes(other),
          getRelationshipEnum: (other) => c.relation[other] ?? "neutral",
          hasMet: () => spec.met !== false,
          changeNumGrievances: (other, amount) => record(`grievance ${pid}>${other} ${amount}`),
          changeRelationshipLevel: (other, delta) => record(`relationship ${pid}~${other} ${delta}`),
        },
        Culture: {
          isNodeUnlocked: (node) => c.nodes.includes(node),
          isTraditionActive: (hash) => c.active.includes(hash),
          getUnlockedTraditions: () => c.unlocked,
          canSwapCultureSlot: () => world.swapAllowed,
        },
        Techs: { isNodeUnlocked: (node) => c.nodes.includes(node) },
        Cities: { getCities: () => c.buildings.length || c.cityYields ? [{
          Constructibles: { getIds: () => c.buildings },
          Yields: { getYield: (yieldType) => ({ 1: c.cityYields?.gold, 3: c.cityYields?.happiness })[yieldType] ?? 0 },
          // Keyed by the Constructibles row's $index, as the engine's getter is (P2); a type hash reads 0.
          Gold: { getSpecificBuildingMaintenance: (index) => ({ value: Number.isInteger(index) ? 1 : 0 }) },
        }] : [] },
        Units: { getUnitIds: () => [1] },
      };
    },
    getAliveMajorIds: () => [...world.civs.values()].filter((c) => c.alive && c.major).map((c) => c.id),
    grantYield: (pid, yieldType, amount) => record(`grant ${pid} ${yieldType} ${amount}`),
  };
  const fake = {
    Players: players,
    Game: {
      get turn() { return world.turn; }, age: 7, getHash: (s) => `#${s}`,
      Notifications: { send: (n, pid) => world.notifications.push({ ...n, pid }) },
      PlayerOperations: {
        canStart: () => ({ Success: world.swapAllowed }),
        sendRequest: (pid, op, args) => {
          world.operations.push({ pid, op, args });
          setTimeout(() => world.handlers.get("TraditionChanged")?.forEach((fn) => fn()), 0);
        },
      },
    },
    GameContext: { localPlayerID: world.local, localObserverID: -1 },
    GameInfo: {
      Ages: table([{ AgeType: "AGE_ANTIQUITY", ChronologyIndex: 0, $hash: 5 }, { AgeType: "AGE_EXPLORATION",
        ChronologyIndex: 1, $hash: 7 }, { AgeType: "AGE_MODERN", ChronologyIndex: 2, $hash: 9 }]),
      GlobalParameters: table([{ Name: "GOLD_NEGATIVE_BALANCE_AMENITY_LOSS_LINE", Value: "0" },
        { Name: "GOLD_NEGATIVE_BALANCE_DISBAND_UNIT_LINE", Value: "-10" }]),
      ProgressionTreeNodeUnlocks: table(spec.unlocks || [{ ProgressionTreeNodeType: "NODE_CIVIC_EX_MAIN_ECONOMICS",
        TargetType: "TRADITION_MARITIME_LAW" }]),
      ProgressionTreeNodes: table([{ ProgressionTreeNodeType: "NODE_CIVIC_EX_MAIN_ECONOMICS", Name: "LOC_CIVIC_ECONOMICS_NAME" }]),
      Constructibles: table([{ ConstructibleType: "BUILDING_MARKET", Age: "AGE_ANTIQUITY", ConstructibleClass: "BUILDING", $index: 0, $hash: "#0" },
        { ConstructibleType: "BUILDING_BANK", Age: "AGE_EXPLORATION", ConstructibleClass: "BUILDING", $index: 1, $hash: "#1" }]),
      TypeTags: table([{ Type: "BUILDING_MARKET", Tag: "GOLD" }, { Type: "BUILDING_BANK", Tag: "GOLD" }]),
      Constructible_YieldChanges: table([{ ConstructibleType: "BUILDING_MARKET", YieldType: "YIELD_GOLD", YieldChange: 3 },
        { ConstructibleType: "BUILDING_BANK", YieldType: "YIELD_GOLD", YieldChange: 8 }]),
      Constructible_Advisories: table([]),
      Traditions: table(spec.traditions || []),
    },
    Configuration: {
      getGame: () => ({ isAnyMultiplayer: spec.multiplayer === true, getValue: (key) => world.config[key] ?? null }),
      editGame: () => ({ setValue: (key, value) => { world.config[key] = value; record(`write ${key}`); } }),
    },
    YieldTypes: { YIELD_GOLD: 1, YIELD_DIPLOMACY: 2, YIELD_HAPPINESS: 3 },
    engine: {
      on: (name, fn) => { if (!world.handlers.has(name)) world.handlers.set(name, []); world.handlers.get(name).push(fn); },
      off: (name, fn) => { world.handlers.set(name, (world.handlers.get(name) || []).filter((h) => h !== fn)); },
    },
    Locale: { compose: (key, ...args) => [key, ...args].join("|") },
    DiplomacyPlayerRelationships: { PLAYER_RELATIONSHIP_HOSTILE: "hostile", PLAYER_RELATIONSHIP_UNFRIENDLY: "unfriendly",
      PLAYER_RELATIONSHIP_NEUTRAL: "neutral", PLAYER_RELATIONSHIP_FRIENDLY: "friendly",
      PLAYER_RELATIONSHIP_HELPFUL: "helpful", PLAYER_RELATIONSHIP_ALLIANCE: "alliance" },
    Units: { get: () => ({ type: 3 }) },
    // An instance's type is the row's hash, as in the engine.
    Constructibles: { getByComponentID: (id) => ({ type: `#${id}`, complete: true, damaged: false }) },
    PlayerOperationTypes: { CHANGE_TRADITION: 42 },
    PlayerOperationParameters: { Activate: 1, Deactivate: 0 },
    CultureSlotTypes: { POLICY_CULTURE_SLOT: 1 },
  };
  for (const [name, value] of Object.entries(fake)) globalThis[name] = value;
  return world;
}

export function removeFakeEngine() {
  for (const name of GLOBALS) delete globalThis[name];
}

/** Fires every handler of an engine event. @param {ReturnType<typeof installFakeEngine>} world */
export function fire(world, name, data) {
  for (const fn of world.handlers.get(name) || []) fn(data);
}
