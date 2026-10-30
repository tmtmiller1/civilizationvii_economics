// econ-bootstrap.js - Economics: the game-scope entry script. Loads the session from the save, re-sends a batch a
// save caught in flight, runs the turn batch at TurnBegin (DESIGN 4.14; P3, P4), sends the turn notification at the
// local player's turn, wires the screen, the dock button and the pill, and exposes the harness global. In a
// multiplayer game it says once that it's off and does nothing. Every engine read is guarded in econ-engine.js.

import { logLine } from "./econ-log.js";
import { aliveMajorIds, gameTurn, isMultiplayer, listen, loc, localId, readAtWar, safe } from "./econ-engine.js";
import { buildInput, displayTurn, dropRequest, economyOf, loadSession, noteCycleEvent, queueRequest, readOptions,
  resendLostBatch, runTurn, setGuard, turnNow } from "./econ-session.js";
import { captureEvent, disasterEvent, razeEvent, readPopulations } from "./econ-macro-read.js";
import { phaseKey } from "./econ-notice-text.js";
import { formatRate } from "./econ-format.js";
import { flushNotice, holdNotice, installClickHandler, nameOf } from "./econ-notify.js";
import { stageOpenerName } from "./econ-stage-read.js";
import { canSwap, readCards, readFiscal, swapTo } from "./econ-fiscal.js";
import { openScreen, rerenderScreen, setScreenApi } from "./econ-screen.js";
import { installDock, refreshPill } from "./econ-dock.js";
import { formatGold } from "./econ-format.js";
import { outstandingOf } from "./econ-credit.js";
import { readCityName, readPossibleRoutes, readTypeName } from "./econ-commerce-read.js";

const VERSION = "0.5.1";
const KEY = "__towerEconomics";
/** @type {Record<string, any>} */
const G = globalThis;

/** @typedef {import("./econ-session.js").Session} Session */

/** @type {{ session: Session | null, activeTurn: number, multiplayer: boolean }} */
const state = { session: null, activeTurn: -1, multiplayer: false };

/**
 * The pill: the player's outstanding debt, red while any loan of theirs is in default, with the cycle's phase and
 * inflation beside it when those options are on (DESIGN 9).
 */
function pillSource() {
  const session = state.session;
  const me = localId();
  if (!session || me < 0) return { text: loc("LOC_ECONOMICS_PILL_NONE"), warning: false };
  const inDefault = session.ledger.loans.some((loan) => loan.borrower === me && loan.state === "default");
  const owed = outstandingOf(session.ledger, me);
  const debt = inDefault ? loc("LOC_ECONOMICS_PILL_DEFAULT")
    : owed > 0 ? loc("LOC_ECONOMICS_PILL", formatGold(owed)) : loc("LOC_ECONOMICS_PILL_NONE");
  const options = readOptions(session.glue);
  const phase = session.macro.cycle.phases[String(me)];
  if (options.cycle === "off" || !phase) return { text: debt, warning: inDefault };
  const pi = options.inflation ? session.macro.inflation.piPpm : 0;
  const text = pi > 0 ? loc("LOC_ECONOMICS_PILL_MACRO_INFLATION", debt, loc(phaseKey(phase)), formatRate(pi))
    : loc("LOC_ECONOMICS_PILL_MACRO", debt, loc(phaseKey(phase)));
  return { text, warning: inDefault };
}

/**
 * @param {Session} session
 * @returns {import("./econ-screen-api.js").ScreenApi}
 */
function screenApi(session) {
  return {
    me: localId(),
    input: () => buildInput(session),
    loc,
    nameOf,
    request: (request) => queueRequest(session, request),
    dropRequest: (index) => dropRequest(session, index),
    pending: () => session.glue.requests,
    setGuard: (on) => setGuard(session, on),
    guardOn: () => readOptions(session.glue).guard,
    stageOpener: stageOpenerName,
    depth: () => economyOf(session, localId(), turnNow(session), readOptions(session.glue)),
    cards: () => readCards(localId()),
    fiscal: () => readFiscal(localId(), readAtWar(localId(), aliveMajorIds())),
    swapTo,
    canSwap: () => canSwap(localId()),
    rerender: () => { rerenderScreen(); refreshPill(); },
    resourceName: (type) => loc(readTypeName(type)),
    buildName: (type) => loc(readTypeName(type)),
    cityName: (cityId) => loc(readCityName(cityId)),
    possibleRoutes: () => readPossibleRoutes(localId(), aliveMajorIds()),
    turnLabel: (turn) => displayTurn(session, turn),
  };
}

/**
 * A save requested before this turn's batch ran reloads into a turn whose TurnBegin has already fired, so the batch
 * runs once at load instead (the plan skips a turn it has already planned, so a later TurnBegin can't repeat it).
 * @param {Session} session
 */
function catchUp(session) {
  const last = session.ledger.lastTurn;
  if (!Number.isInteger(last) || /** @type {number} */ (last) >= turnNow(session)) return;
  const plan = safe(() => runTurn(session, `load catch-up from turn ${last}`), null);
  if (plan) holdNotice(plan, state);
}

function onTurnBegin() {
  const session = state.session;
  if (!session) return;
  const plan = safe(() => runTurn(session, `TurnBegin ${gameTurn()}`), null);
  if (plan) holdNotice(plan, state);
  refreshPill();
  rerenderScreen();
}

/** @param {any} data */
function onPlayerTurnActivated(data) {
  const pid = data && (data.player ?? data.Player);
  if (pid !== localId()) return;
  state.activeTurn = state.session ? turnNow(state.session) : gameTurn();
  flushNotice();
}

function installConsole() {
  G[KEY] = {
    version: VERSION,
    get multiplayer() { return state.multiplayer; },
    session: () => state.session,
    ledger: () => state.session?.ledger,
    input: () => (state.session ? buildInput(state.session) : null),
    runNow: () => (state.session ? runTurn(state.session, "console") : null),
    request: (/** @type {PlanRequest} */ request) => (state.session ? queueRequest(state.session, request) : false),
    guard: (/** @type {boolean | null} */ on) => (state.session ? setGuard(state.session, on) : null),
    cards: () => readCards(localId()),
    swapTo,
    open: () => openScreen(),
    pill: pillSource,
  };
}

/**
 * The cycle's engine events (DESIGN 4.11), kept in the glue envelope until the next batch weighs them.
 * @param {Session} session
 */
function listenCycle(session) {
  session.pops = readPopulations(aliveMajorIds());
  listen("CityTransfered", (/** @type {any} */ data) => safe(() => noteCycleEvent(session, captureEvent(data)), false));
  listen("CityRazingStarted", (/** @type {any} */ data) => safe(() => noteCycleEvent(session, razeEvent(data)), false));
  listen("RandomEventOccurred", (/** @type {any} */ data) => safe(() => noteCycleEvent(session,
    disasterEvent(data, session.pops)), false));
}

function boot() {
  state.multiplayer = isMultiplayer();
  installConsole();
  if (state.multiplayer) { logLine(`v${VERSION} loaded; multiplayer game, the mod is off`); return; }
  const session = loadSession();
  state.session = session;
  const lost = resendLostBatch(session);
  // A loaded game opens on the local player's own turn, and no PlayerTurnActivated follows for it.
  if (safe(() => Players.get(localId()).isTurnActive === true, false)) state.activeTurn = turnNow(session);
  catchUp(session);
  setScreenApi(screenApi(session));
  installDock(pillSource);
  installClickHandler(() => openScreen());
  listen("TurnBegin", onTurnBegin);
  listen("PlayerTurnActivated", onPlayerTurnActivated);
  listenCycle(session);
  logLine(`v${VERSION} loaded; turn ${gameTurn()}, ${session.ledger.loans.length} loan record(s), `
    + `${lost.length} re-sent, options ${JSON.stringify(readOptions(session.glue))}`);
}

try {
  if (!G[KEY]) {
    if (typeof engine !== "undefined" && engine.whenReady) engine.whenReady.then(boot);
    else boot();
  }
} catch (error) {
  logLine(`boot failed: ${error instanceof Error ? error.message : String(error)}`);
}
