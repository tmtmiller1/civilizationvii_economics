// econ-bootstrap.js - Economics: the game-scope entry script. Loads the session from the save, re-sends a batch a
// save caught in flight, runs the turn batch at TurnBegin (DESIGN 4.14; P3, P4), sends the turn notification at the
// local player's turn, wires the screen, the dock button and the pill, and exposes the harness global. In a
// multiplayer game it says once that it's off and does nothing. Every engine read is guarded in econ-engine.js.

import { logLine } from "./econ-log.js";
import { aliveMajorIds, gameTurn, isMultiplayer, listen, loc, localId, readAtWar, safe } from "./econ-engine.js";
import { buildInput, displayTurn, dropRequest, economyOf, loadSession, markSeen, noteCycleEvent, noteLanded,
  noteOpened, queueRequest, readOptions, resendLostBatch, runTurn, setGuard, stageTurnsOf, turnNow } from "./econ-session.js";
import { captureEvent, disasterEvent, razeEvent, readPopulations } from "./econ-macro-read.js";
import { phaseKey } from "./econ-notice-text.js";
import { pillsFor } from "./econ-pills.js";
import { formatRate } from "./econ-format.js";
import { flushNotice, holdNotice, installClickHandler, nameOf } from "./econ-notify.js";
import { stageOpenerName } from "./econ-stage-read.js";
import { canSwap, readCards, readFiscal, swapTo } from "./econ-fiscal.js";
import { newTurnOnScreen, openScreen, rerenderScreen, setScreenApi, showTab } from "./econ-screen.js";
import { installDock, refreshDock, refreshPill } from "./econ-dock.js";
import { formatGold } from "./econ-format.js";
import { outstandingOf } from "./econ-credit.js";
import { readCityName, readPossibleRoutes, readTypeName } from "./econ-commerce-read.js";
import { civHidden } from "./econ-spoil.js";

const VERSION = "0.5.4";
const KEY = "__towerEconomics";
/** @type {Record<string, any>} */
const G = globalThis;

/** @typedef {import("./econ-session.js").Session} Session */

/** @type {{ session: Session | null, activeTurn: number, multiplayer: boolean }} */
const state = { session: null, activeTurn: -1, multiplayer: false };

/**
 * The pill: the player's outstanding debt, red while any loan of theirs is in default, with the cycle's phase and
 * inflation beside it when those options are on (DESIGN 9), as separate pills, each coloured on its own.
 */
function pillSource() {
  const session = state.session;
  const me = localId();
  if (!session || me < 0) return { pills: [], text: "", warning: false };
  const options = readOptions(session.glue);
  const pills = pillsFor({
    inDefault: session.ledger.loans.some((loan) => loan.borrower === me && loan.state === "default"),
    owedCents: outstandingOf(session.ledger, me), phase: session.macro.cycle.phases[String(me)] ?? null,
    cycleOn: options.cycle !== "off", inflationOn: options.inflation, piPpm: session.macro.inflation.piPpm,
  }, { loc, gold: formatGold, rate: formatRate, phaseKey });
  return { pills, text: pills.map((p) => p.text).join(" · "), warning: pills.some((p) => p.tone === "warning") };
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
    nameOf: (party) => (typeof party === "number" && civHidden(party, localId()) ? loc("LOC_ECONOMICS_UNMET_CIV")
      : nameOf(party)),
    hidden: (pid) => civHidden(pid, localId()),
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
    stageTurns: () => stageTurnsOf(session, localId()),
    lastTransfers: () => session.lastPlan?.transfers ?? null,
    seenTab: (tab) => { if (markSeen(session, tab)) refreshDock(); },
  };
}

/**
 * The dock button's unseen marker: the tabs with a part the player hasn't opened yet, by name.
 * @param {Session} session
 */
function markerSource(session) {
  return session.glue.fresh.map((tab) => loc(`LOC_ECONOMICS_TAB_${tab.toUpperCase()}`));
}

/**
 * After a batch (or a skipped one): the parts of the screen that opened this turn lead the notification, and the
 * dock button's marker follows them.
 * @param {Session} session
 * @param {PlanOutput | null} plan
 */
function afterBatch(session, plan) {
  const me = localId();
  const opened = me < 0 ? [] : safe(() => noteOpened(session, buildInput(session), me), /** @type {string[]} */ ([]));
  if (plan || opened.length) holdNotice(plan, state, opened.map((key) => loc(key)), turnNow(session));
  refreshDock();
}

// Grants land about a second after they're sent, and the turn's autosave is asked for about 4.7 s after (P15), so
// the payments are looked at twice in between and the ones seen to land are noted before that save.
const LANDED_CHECKS_MS = [1500, 3500];

/**
 * After grants go out: note the payments that landed, so a later reload can't re-send them.
 * @param {Session} session
 */
function watchLanded(session) {
  if (typeof setTimeout !== "function") return;
  for (const ms of LANDED_CHECKS_MS) setTimeout(() => safe(() => noteLanded(session), 0), ms);
}

/**
 * A save that fell between the ledger write and the grants landing: re-send what didn't land, then watch it land.
 * @param {Session} session
 */
function resend(session) {
  const lost = resendLostBatch(session);
  if (lost.length) watchLanded(session);
  return lost;
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
  if (plan) watchLanded(session);
  afterBatch(session, plan);
}

function onTurnBegin() {
  const session = state.session;
  if (!session) return;
  const plan = safe(() => runTurn(session, `TurnBegin ${gameTurn()}`), null);
  if (plan) watchLanded(session);
  afterBatch(session, plan);
  refreshPill();
  newTurnOnScreen();
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
    tab: (/** @type {string} */ key) => showTab(key),
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
  const lost = resend(session);
  // A loaded game opens on the local player's own turn, and no PlayerTurnActivated follows for it.
  if (safe(() => Players.get(localId()).isTurnActive === true, false)) state.activeTurn = turnNow(session);
  catchUp(session);
  setScreenApi(screenApi(session));
  installDock(pillSource, () => markerSource(session));
  // The first look in a game notes what's open without telling, so only later openings make a notification line.
  if (session.glue.told === null) safe(() => noteOpened(session, buildInput(session), localId()), []);
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
