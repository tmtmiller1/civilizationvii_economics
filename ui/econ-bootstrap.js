// econ-bootstrap.js - Economics: the game-scope entry script. Loads the session from the save, re-sends a batch a
// save caught in flight, runs the turn batch at TurnBegin (DESIGN 4.14; P3, P4), sends the turn notification at the
// local player's turn, wires the screen, the dock button and the pill, and exposes the harness global. In a
// multiplayer game it says once that it's off and does nothing. Every engine read is guarded in econ-engine.js.

import { logLine } from "./econ-log.js";
import { installRestore, noteSeatBeforeUpdate } from "./econ-restore.js";
import { readHeldMarkers } from "./econ-standing-read.js";
import { grantOf } from "./econ-batch.js";
import { aliveMajorIds, gameTurn, isMultiplayer, listen, loc, localId, readAtWar, readBalanceCents,
  safe } from "./econ-engine.js";
import { buildInput, displayTurn, dropRequest, economyOf, loadSession, markSeen, noteCycleEvent, noteLanded,
  noteOpened, placeLinesNow, queueRequest, readOptions, resendLostBatch, runTurn, setGuard,
  stageTurnsOf, turnNow } from "./econ-session.js";
import { captureEvent, disasterEvent, razeEvent, readPopulations } from "./econ-macro-read.js";
import { phaseKey, policyKey, responseKey } from "./econ-notice-text.js";
import { pillsFor } from "./econ-pills.js";
import { formatRate } from "./econ-format.js";
import { flushNotice, holdNotice, installClickHandler, nameOf } from "./econ-notify.js";
import { stageOpenerName } from "./econ-stage-read.js";
import { canSwap, readCards, readFiscal, swapTo } from "./econ-fiscal.js";
import { newTurnOnScreen, openScreen, rerenderScreen, setScreenApi, showTab } from "./econ-screen.js";
import { installDock, refreshDock, refreshPill } from "./econ-dock.js";
import { formatGold } from "./econ-format.js";
import { outstandingOf } from "./econ-credit.js";
import { readCityName, readPossibleRoutes, readTypeName, resourceLabel } from "./econ-commerce-read.js";
import { civHidden } from "./econ-spoil.js";

const VERSION = "1.0.0";
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
/**
 * The name keys of what the player is doing about a crisis: its crisis-paths card first, then its standing
 * responses, for the pill and the header.
 * @param {Session} session
 * @param {number} me
 */
function runningKeys(session, me) {
  return [...(session.ledger.policies || []).filter((row) => row.pid === me).map((row) => policyKey(row.card)),
    ...(session.ledger.responses || []).filter((row) => row.pid === me && !row.policy && row.id !== "bank-run")
      .map((row) => responseKey(row.id))];
}

function pillSource() {
  const session = state.session;
  const me = localId();
  if (!session || me < 0) return { pills: [], text: "", warning: false };
  const options = readOptions(session.glue);
  const pills = pillsFor({
    inDefault: session.ledger.loans.some((loan) => loan.borrower === me && loan.state === "default"),
    owedCents: outstandingOf(session.ledger, me), phase: session.macro.cycle.phases[String(me)] ?? null,
    cycleOn: options.cycle !== "off", inflationOn: options.inflation, piPpm: session.macro.inflation.piPpm,
    inCrisis: (session.ledger.crises || []).some((row) => row.pid === me),
    running: runningKeys(session, me),
    arrears: (session.ledger.policies || []).some((row) => row.pid === me && (row.arrearsRun || 0) > 0),
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
    hardship: () => Number(session.lastPlan?.hardship?.[String(localId())] ?? 0) || 0,
    hardTimes: () => hardTimesOf(session.lastPlan?.hardTimes?.[String(localId())]),
    partisans: () => !!G.__towerPartisans,
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
    resourceName: (type) => resourceLabel(type, loc),
    buildName: (type) => loc(readTypeName(type)),
    cityName: (cityId) => loc(readCityName(cityId)),
    possibleRoutes: () => readPossibleRoutes(localId(), aliveMajorIds()),
    turnLabel: (turn) => displayTurn(session, turn),
    stageTurns: () => stageTurnsOf(session, localId()),
    lastTransfers: () => session.lastPlan?.transfers ?? null,
    seenTab: (tab) => { if (markSeen(session, tab)) refreshDock(); },
    shutCount: () => readHeldMarkers(localId()).filter((m) => m.line === "SHUT").length,
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
  const before = readBalanceCents(localId());
  const plan = safe(() => runTurn(session, `TurnBegin ${gameTurn()}`), null);
  if (plan) watchLanded(session);
  // The seat's update comes right after this batch; what it holds then is its balance now plus the grant (DESIGN 4.18).
  const row = plan?.batch?.civs?.find((x) => x.pid === localId());
  if (plan && !plan.skipped) noteSeatBeforeUpdate(before, row ? grantOf(row) : 0);
  afterBatch(session, plan);
  refreshPill();
  newTurnOnScreen();
}

// The standing lines' markers go up a moment into the local player's turn, as Partisans' muster does.
const LINES_SETTLE_MS = 800;

/** @param {Session} session */
function placeLinesSoon(session) {
  const place = () => safe(() => placeLinesNow(session), 0);
  if (typeof setTimeout === "function") setTimeout(place, LINES_SETTLE_MS); else place();
}

/** @param {any} data */
function onPlayerTurnActivated(data) {
  const pid = data && (data.player ?? data.Player);
  if (pid !== localId()) return;
  if (state.session) placeLinesSoon(state.session);
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
    // Partisans reads this (its pt-economics.js): the Happiness points a civ's settlements count against misery in a
    // deep Depression, 0 to 6; 0 in multiplayer, with crises off, or before the first batch.
    hardship: (/** @type {number} */ pid) => (state.multiplayer ? 0
      : Number(state.session?.lastPlan?.hardship?.[String(pid)] ?? 0) || 0),
    // Partisans 1.2 reads this instead (hard-times plan v2): the Depression's points and age, Austerity's strain and
    // the running Programme's arrears points; all 0 or false in multiplayer, with crises off, or before the first
    // batch.
    hardTimes: (/** @type {number} */ pid) => hardTimesOf(state.multiplayer ? null
      : state.session?.lastPlan?.hardTimes?.[String(pid)]),
    // A civ whose treasury was below zero at the last batch (DESIGN 4.18), for other mods to read: how far, its
    // overdraft, the quarters used, whether it's past it, the Happiness a settlement, the price premium in basis points
    // and the units it disbands this turn; null when it isn't overdrawn, in multiplayer, or before the first batch.
    overdrawn: (/** @type {number} */ pid) => {
      const row = state.multiplayer ? null : state.session?.lastPlan?.overdrawn?.[String(pid)];
      return row ? { ...row } : null;
    },
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

/**
 * The batch a reload missed, and the standing lines' markers on a game that loads on the local player's own turn.
 * @param {Session} session
 */
function startOnLoad(session) {
  const active = safe(() => Players.get(localId()).isTurnActive === true, false);
  if (active) state.activeTurn = turnNow(session);
  catchUp(session);
  if (active) placeLinesSoon(session);
}

function boot() {
  state.multiplayer = isMultiplayer();
  installConsole();
  if (state.multiplayer) { logLine(`v${VERSION} loaded; multiplayer game, the mod is off`); return; }
  const session = loadSession();
  state.session = session;
  const lost = resend(session);
  // A loaded game opens on the local player's own turn, and no PlayerTurnActivated follows for it.
  startOnLoad(session);
  setScreenApi(screenApi(session));
  installDock(pillSource, () => markerSource(session));
  // The first look in a game notes what's open without telling, so only later openings make a notification line.
  if (session.glue.told === null) safe(() => noteOpened(session, buildInput(session), localId()), []);
  installClickHandler(() => openScreen());
  listen("TurnBegin", onTurnBegin);
  listen("PlayerTurnActivated", onPlayerTurnActivated);
  // A debt the game wipes at a civ's update is charged back when its turn opens (DESIGN 4.18, lab W12).
  // Right after a load no batch has run yet in this session, and the seat's turn can end before one does (lab W15: the
  // Ottomans' 7,300 of debt wiped after a reload), so the saved ledger's last batch stands in for it.
  installRestore(() => {
    const s = state.session;
    if (state.multiplayer || !s) return false;
    return s.lastPlan ? s.lastPlan.skipped !== "all-off" : !!s.ledger?.lastBatch;
  });
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

/**
 * A copy of one civ's hard times, zero when there's none.
 * @param {HardTimes | null | undefined} row
 * @returns {HardTimes}
 */
function hardTimesOf(row) {
  const n = (/** @type {unknown} */ v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return { depression: n(row?.depression), depressionTurns: n(row?.depressionTurns),
    austerityStrain: n(row?.austerityStrain), austerityRunning: row?.austerityRunning === true,
    arrearsPoints: n(row?.arrearsPoints) };
}
