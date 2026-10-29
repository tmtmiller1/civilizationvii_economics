// econ-screen-api.js - Economics: what the three tabs are given to read and act on, built once by the bootstrap from
// the session and the engine. The views never import the session, so they can be rendered against a fake api in
// tests; the bootstrap is the only place that knows both sides.

/**
 * @typedef {object} ScreenApi
 * @property {number} me the local player's id
 * @property {() => PlanInput} input the plan input as the next batch would read it
 * @property {(key: string, ...args: (string | number)[]) => string} loc
 * @property {(party: Party) => string} nameOf
 * @property {(request: PlanRequest) => boolean} request queue one of the player's requests for the next batch
 * @property {(index: number) => boolean} dropRequest
 * @property {() => PlanRequest[]} pending
 * @property {(on: boolean | null) => boolean} setGuard
 * @property {() => boolean} guardOn
 * @property {(stage: string) => string | null} stageOpener the name key of the node that opens a stage, or null
 * @property {() => { buildings: { type: string, roles: import("./econ-depth.js").BuildingRoles, goldYield: number,
 *   weight: number }[], depthTurns: number, depthFactorPct: number }} depth
 * @property {() => import("./econ-fiscal.js").CardRead[]} cards
 * @property {() => import("./econ-tax-cards.js").FiscalRead} fiscal the yields and celebration meter the Fiscal
 *   tab's forecast starts from
 * @property {(type: string | null) => Promise<string>} swapTo
 * @property {() => boolean} canSwap
 * @property {() => void} rerender
 */

export {};
