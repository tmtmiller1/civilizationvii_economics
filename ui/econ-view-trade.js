// econ-view-trade.js - Economics: the Trade tab (DESIGN 4.10, 4.12, 5, 9). It opens on what's due: this turn's bill
// with each partner and the cap, beside the Trade Income the game pays you; then the AI offers waiting for an answer;
// then what you can do: a development loan on a city's current build, general investment or aid, each with what it
// would return and the relationship it buys; then the routes the game would let you make and what each would add to
// your bill; then your open investments.

import { amount, button, changeRow, columns, confirmCard, el, empty, facts, feedbackLine, goldStepper, isConfirming,
  note, row, section, setConfirming, stat } from "./econ-dom.js";
import { send } from "./econ-view-common.js";
import { formatGold } from "./econ-format.js";
import { reasonKey } from "./econ-notice-text.js";
import { investForecast, investTargets, investmentsView, routePreview, tradeView } from "./econ-view-commerce.js";
import { opensNext, rulesFor } from "./econ-view-common.js";

/** @typedef {import("./econ-screen-api.js").ScreenApi} ScreenApi */

const form = { cents: 30000, projectFor: /** @type {number | null} */ (null) };

/**
 * @param {HTMLElement} host
 * @param {ScreenApi} api
 */
export function renderTrade(host, api) {
  const input = api.input();
  const { rules } = rulesFor(api);
  const open = { project: rules.sections["trade.project"], general: rules.sections["trade.general"] };
  host.appendChild(columns([settlementSection(input, api), offersSection(input, api), investSection(input, api, open)],
    [holdingsSection(input, api), previewSection(input, api)]));
  const next = opensNext(api, rules.next.trade);
  if (next) host.appendChild(next);
}

/** @typedef {{ project: boolean, general: boolean }} InvestOpen the investment forms the player's stages open */

/** @param {number} cents @param {ScreenApi} api @param {number} [tone] */
const goldText = (cents, api, tone = 0) => amount(formatGold(cents), { tone,
  tooltip: api.loc("LOC_ECONOMICS_GOLD_AMOUNT", formatGold(cents)) });

/**
 * @param {PlanInput} input
 * @param {ScreenApi} api
 */
function settlementSection(input, api) {
  const view = tradeView(input, api.me);
  const block = section(api.loc("LOC_ECONOMICS_TRADE_SETTLEMENT"), [
    row(api.loc("LOC_ECONOMICS_TRADE_CAP"), goldText(view.capCents, api)),
  ]);
  // The game's own Trade Income read 0 in every route city in the 1.1 probes (2026-10-29), so the row only shows
  // when the read gives something.
  if (view.tradeIncomeCents > 0) {
    block.appendChild(row(api.loc("LOC_ECONOMICS_TRADE_INCOME"), goldText(view.tradeIncomeCents, api)));
  }
  if (!view.on) { block.appendChild(empty(api.loc("LOC_ECONOMICS_MARKETS_OFF"))); return block; }
  if (!view.rows.length) block.appendChild(empty(api.loc("LOC_ECONOMICS_TRADE_NONE")));
  for (const line of view.rows) block.appendChild(partnerRow(line, api));
  block.appendChild(note(api.loc("LOC_ECONOMICS_TRADE_NOTE")));
  return block;
}

/**
 * @param {ReturnType<typeof tradeView>["rows"][number]} line
 * @param {ScreenApi} api
 */
function partnerRow(line, api) {
  const box = el("div", `econ-card${line.payCents > 0 ? " econ-card--trouble" : ""}`);
  box.appendChild(el("div", "econ-card-title", api.nameOf(line.partner)));
  /** @type {HTMLElement[]} */
  const figures = [stat(api.loc("LOC_ECONOMICS_TRADE_OWE"), goldText(line.youOweCents, api)),
    stat(api.loc("LOC_ECONOMICS_TRADE_OWED"), goldText(line.theyOweCents, api))];
  if (line.payCents > 0) figures.push(stat(api.loc("LOC_ECONOMICS_TRADE_PAY"), goldText(line.payCents, api, -1)));
  if (line.receiveCents > 0) figures.push(stat(api.loc("LOC_ECONOMICS_TRADE_RECEIVE"), goldText(line.receiveCents, api, 1)));
  box.appendChild(facts(figures));
  if (line.waivedCents > 0) box.appendChild(note(api.loc("LOC_ECONOMICS_TRADE_WAIVED", formatGold(line.waivedCents))));
  return box;
}

/**
 * @param {PlanInput} input
 * @param {ScreenApi} api
 */
function offersSection(input, api) {
  const { offers } = investmentsView(input, api.me);
  const block = section(api.loc("LOC_ECONOMICS_TRADE_OFFERS"));
  const said = feedbackLine("offers");
  if (said) block.appendChild(said);
  if (!offers.length) block.appendChild(empty(api.loc("LOC_ECONOMICS_TRADE_NO_OFFERS")));
  for (const offer of offers) {
    const box = el("div", "econ-card");
    const kind = offer.kind === "general" ? "LOC_ECONOMICS_OFFER_GENERAL_ROW" : "LOC_ECONOMICS_OFFER_PROJECT_ROW";
    box.appendChild(el("div", "econ-card-title", api.loc(kind, api.nameOf(offer.investor), formatGold(offer.cents),
      offer.cityId ? api.cityName(offer.cityId) : "")));
    const actions = el("div", "econ-actions");
    actions.appendChild(button(api.loc("LOC_ECONOMICS_OFFER_ACCEPT"), () => ask(api, { kind: "accept-offer",
      offerId: offer.id }, "offers"), { className: "econ-button--primary" }));
    actions.appendChild(button(api.loc("LOC_ECONOMICS_OFFER_DECLINE"), () => ask(api, { kind: "decline-offer",
      offerId: offer.id }, "offers"), { className: "econ-button--quiet" }));
    box.appendChild(actions);
    block.appendChild(box);
  }
  return block;
}

/**
 * @param {ScreenApi} api
 * @param {PlanRequest} request
 * @param {string} at where the line saying so goes
 */
function ask(api, request, at) {
  send(api, request, at);
}

/**
 * @param {PlanInput} input
 * @param {ScreenApi} api
 * @param {InvestOpen} open
 */
function investSection(input, api, open) {
  const block = section(api.loc("LOC_ECONOMICS_INVEST"), [], { subtitle: api.loc("LOC_ECONOMICS_INVEST_SUB") });
  if (input.options?.investment === false) { block.appendChild(empty(api.loc("LOC_ECONOMICS_INVEST_OFF"))); return block; }
  const amountLine = el("div", "econ-field");
  amountLine.appendChild(el("div", "econ-field-label font-title uppercase", api.loc("LOC_ECONOMICS_INVEST_AMOUNT")));
  amountLine.appendChild(goldStepper({ value: form.cents, min: 1000, max: 10000000, format: formatGold,
    onChange: (cents) => { form.cents = cents; api.rerender(); } }));
  block.appendChild(amountLine);
  const said = feedbackLine("invest");
  if (said) block.appendChild(said);
  const targets = investTargets(input, api.me, form.cents).filter((target) => !api.hidden?.(target.pid));
  const chosen = open.project ? targets.find((target) => target.pid === form.projectFor) : undefined;
  if (chosen) block.appendChild(projectCard(chosen, api));
  for (const target of targets) block.appendChild(targetCard(target, api, open));
  block.appendChild(note(api.loc("LOC_ECONOMICS_INVEST_NOTE")));
  return block;
}

/**
 * The development loan the player asked to see after general investment was refused: the same Gold, each of the
 * host's current builds, and nothing sent until the player picks one.
 * @param {ReturnType<typeof investTargets>[number]} target
 * @param {ScreenApi} api
 */
function projectCard(target, api) {
  const box = el("div", "econ-card");
  box.appendChild(el("div", "econ-card-title", api.loc("LOC_ECONOMICS_INVEST_PROJECT_FOR", api.nameOf(target.pid),
    formatGold(form.cents))));
  const host = { host: target.pid, hostIncomeCents: target.incomeCents };
  for (const { city, refusal } of target.cities) {
    box.appendChild(actionRow(api, { ...host, form: "project", asAid: false, refusal, city,
      caption: "LOC_ECONOMICS_INVEST_PROJECT" }));
  }
  if (!target.cities.length) box.appendChild(note(api.loc("LOC_ECONOMICS_INVEST_PROJECT_NONE")));
  box.appendChild(button(api.loc("LOC_ECONOMICS_CLOSE"), () => { form.projectFor = null; api.rerender(); }));
  return box;
}

/**
 * One civ the player could invest in: general investment and aid, and a development loan on each queued build. A
 * host in default refuses general investment; its line says so and offers the development loan instead.
 * Forms the player's stages haven't opened are left out (econ-view-tabs.js); aid needs no stage.
 * @param {ReturnType<typeof investTargets>[number]} target
 * @param {ScreenApi} api
 * @param {InvestOpen} open
 */
function targetCard(target, api, open) {
  const box = el("div", "econ-card");
  box.appendChild(el("div", "econ-card-title", api.nameOf(target.pid)));
  const host = { host: target.pid, hostIncomeCents: target.incomeCents };
  if (open.general) {
    box.appendChild(actionRow(api, { ...host, form: "general", asAid: false, refusal: target.general,
      caption: "LOC_ECONOMICS_INVEST_GENERAL" }));
  }
  if (open.general && open.project && target.general === "host-default"
    && target.cities.some((row) => row.refusal === null)) {
    box.appendChild(button(api.loc("LOC_ECONOMICS_INVEST_PROJECT_INSTEAD"), () => {
      form.projectFor = target.pid;
      api.rerender();
    }));
  }
  box.appendChild(actionRow(api, { ...host, form: "general", asAid: true, refusal: target.aid,
    caption: "LOC_ECONOMICS_INVEST_AID" }));
  if (!open.project) return box;
  for (const { city, refusal } of target.cities) {
    box.appendChild(actionRow(api, { ...host, form: "project", asAid: false, refusal, city,
      caption: "LOC_ECONOMICS_INVEST_PROJECT" }));
  }
  return box;
}

/**
 * A button with the forecast beside it, or the reason it can't go ahead; the button opens a confirmation with what
 * the Gold buys.
 * @param {ScreenApi} api
 * @param {{ host: number, hostIncomeCents: number, form: InvestKind, asAid: boolean, refusal: string | null,
 *   caption: string, city?: CityRead }} q
 */
function actionRow(api, q) {
  const line = el("div", "econ-invest-line");
  const forecast = investForecast({ form: q.form, cents: form.cents, asAid: q.asAid,
    hostIncomeCents: q.hostIncomeCents, city: q.city ?? null });
  const label = q.city ? api.loc(q.caption, api.buildName(q.city.build || ""), api.cityName(q.city.id))
    : api.loc(q.caption);
  const id = `invest:${q.host}:${q.form}:${q.asAid ? 1 : 0}:${q.city?.id ?? ""}`;
  line.appendChild(button(label, () => { setConfirming(id); api.rerender(); },
    { disabled: q.refusal !== null, reason: q.refusal ? api.loc(reasonKey(q.refusal)) : null }));
  if (!q.refusal) line.appendChild(note(forecastText(forecast, q, api)));
  if (isConfirming(id)) line.appendChild(investConfirm(api, q, label, forecast));
  return line;
}

/**
 * The investment, confirmed: what goes out, the treasury now against after, and what it brings back.
 * @param {ScreenApi} api
 * @param {{ host: number, form: InvestKind, asAid: boolean, city?: CityRead }} q
 * @param {string} label
 * @param {ReturnType<typeof investForecast>} forecast
 */
function investConfirm(api, q, label, forecast) {
  const balance = api.input().civs.find((civ) => civ.id === api.me)?.balanceCents ?? 0;
  return confirmCard({ title: label, lines: [
      row(api.loc("LOC_ECONOMICS_INVEST_YOU_SEND"), goldText(forecast.spentCents, api)),
      changeRow(api.loc("LOC_ECONOMICS_CHANGE_TREASURY"), formatGold(balance),
        formatGold(balance - forecast.spentCents), -1),
      note(forecastText(forecast, q, api))],
    confirm: api.loc("LOC_ECONOMICS_CONFIRM"), cancel: api.loc("LOC_ECONOMICS_CANCEL"),
    onConfirm: () => ask(api, { kind: "invest", investor: api.me, host: q.host, form: q.form, cents: form.cents,
      cityId: q.city?.id ?? null, asAid: q.asAid }, "invest"), rerender: api.rerender });
}

/**
 * @param {ReturnType<typeof investForecast>} forecast
 * @param {{ form: InvestKind, asAid: boolean }} q
 * @param {ScreenApi} api
 */
function forecastText(forecast, q, api) {
  if (q.asAid) return api.loc("LOC_ECONOMICS_INVEST_AID_FORECAST", formatGold(forecast.spentCents), forecast.relationship);
  if (q.form === "general") {
    return api.loc("LOC_ECONOMICS_INVEST_GENERAL_FORECAST", formatGold(forecast.perTurnCents), forecast.relationship);
  }
  return api.loc("LOC_ECONOMICS_INVEST_PROJECT_FORECAST", forecast.progress, formatGold(forecast.spentCents),
    formatGold(forecast.perTurnCents), formatGold(forecast.totalCents), forecast.relationship);
}

/**
 * @param {PlanInput} input
 * @param {ScreenApi} api
 */
function previewSection(input, api) {
  const block = section(api.loc("LOC_ECONOMICS_TRADE_PREVIEW"));
  const possible = api.possibleRoutes();
  if (possible === null) { block.appendChild(empty(api.loc("LOC_ECONOMICS_TRADE_PREVIEW_UNREAD"))); return block; }
  const rows = routePreview(possible, input.markets?.prices || {}).filter((r) => r.resources.length);
  if (!rows.length) block.appendChild(empty(api.loc("LOC_ECONOMICS_TRADE_PREVIEW_NONE")));
  for (const route of rows.slice(0, 8)) {
    block.appendChild(row(api.loc("LOC_ECONOMICS_TRADE_PREVIEW_ROW", api.cityName(route.city), api.nameOf(route.owner),
      route.resources.length), goldText(route.billCents, api)));
  }
  return block;
}

/**
 * @param {PlanInput} input
 * @param {ScreenApi} api
 */
function holdingsSection(input, api) {
  const view = investmentsView(input, api.me);
  const block = section(api.loc("LOC_ECONOMICS_TRADE_HOLDINGS"), [
    row(api.loc("LOC_ECONOMICS_TRADE_INVESTED"), goldText(view.investedCents, api)),
    row(api.loc("LOC_ECONOMICS_TRADE_HOSTED"), goldText(view.owedCents, api)),
  ]);
  for (const record of view.open) {
    const mine = record.investor === api.me;
    block.appendChild(el("div", "econ-history-line econ-line", api.loc(mine ? "LOC_ECONOMICS_HOLDING_OUT"
      : "LOC_ECONOMICS_HOLDING_IN", record.id, api.nameOf(mine ? record.host : record.investor),
    formatGold(record.outstanding), record.term - record.paid)));
  }
  return block;
}
