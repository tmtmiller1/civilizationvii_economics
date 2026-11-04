// econ-screen-api.js - Economics: what the tabs are given to read and act on, built once by the bootstrap from
// the session and the engine. The views never import the session, so they can be rendered against a fake api in
// tests; the bootstrap is the only place that knows both sides.

/**
 * @typedef {object} ScreenApi
 * @property {number} me the local player's id
 * @property {() => PlanInput} input the plan input as the next batch would read it
 * @property {(key: string, ...args: (string | number)[]) => string} loc
 * @property {(party: Party) => string} nameOf a civ the Spoil Guard hides reads "an unmet civilization"
 * @property {(pid: number) => boolean} [hidden] whether the Spoil Guard keeps this civ off the screen (econ-spoil.js)
 * @property {() => number} [hardship] the player's hardship for Partisans this turn (econ-policy.js), 0 to 6
 * @property {() => HardTimes} [hardTimes] the player's hard times for Partisans this turn (econ-arrears.js)
 * @property {() => boolean} [partisans] whether Partisans is running in this game
 * @property {(request: PlanRequest) => boolean} request queue one of the player's requests for the next batch
 * @property {(index: number) => boolean} dropRequest
 * @property {() => PlanRequest[]} pending
 * @property {(on: boolean | null) => boolean} setGuard
 * @property {() => boolean} guardOn
 * @property {(stage: string) => string | null} stageOpener the name key of the node that opens a stage, or null
 * @property {() => { buildings: import("./econ-macro-read.js").EconomyBuilding[], depthTurns: number,
 *   depthFactorPct: number, legacyBp: number, cushionBp: number }} depth the player's buildings by role, old ones with
 *   their weights (DESIGN 4.13, 4.16)
 * @property {() => import("./econ-fiscal.js").CardRead[]} cards
 * @property {() => import("./econ-tax-cards.js").FiscalRead} fiscal the yields and celebration meter the Fiscal
 *   tab's forecast starts from
 * @property {(type: string | null) => Promise<string>} swapTo
 * @property {() => boolean} canSwap
 * @property {() => void} rerender
 * @property {(type: string) => string} resourceName a resource's name in the game's language
 * @property {(type: string) => string} buildName a building's, unit's or project's name
 * @property {(cityId: string) => string} cityName a city's name by its component id key
 * @property {() => { owner: number, city: string, resources: string[] }[] | null} possibleRoutes the routes the game
 *   would let the player make now, or null when that read doesn't answer
 * @property {(turn: number) => number | null} turnLabel the game's own turn for a counted one (econ-turn-count.js),
 *   null for a turn of an earlier age
 * @property {() => Record<string, number | null | undefined>} [stageTurns] the turn the player reached each stage,
 *   coinage included, for the tab rules (econ-view-tabs.js)
 * @property {(tab: string) => void} [seenTab] the player opened a tab: clears its unseen marker
 * @property {() => Transfer[] | null} [lastTransfers] the last batch's transfers this session, for the breakdown of
 *   what the mod moved; null after a load, until the next batch
 */

export {};
