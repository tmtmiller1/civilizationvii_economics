// econ-view-trade.js - Economics: the Trade tab (DESIGN 4.10, 4.12, 5, 9). It opens on what's due: this turn's bill
// with each partner and the cap, beside the Trade Income the game pays you; then the AI offers waiting for an answer;
// then what you can do: a development loan on a city's current build, general investment or aid, each with what it
// would return and the relationship it buys; then the routes the game would let you make and what each would add to
// your bill; then your open investments.

import { button, el, goldStepper, note, row, section } from "./econ-dom.js";
import { formatGold } from "./econ-format.js";
import { reasonKey } from "./econ-notice-text.js";
import { investForecast, investTargets, investmentsView, routePreview, tradeView } from "./econ-view-commerce.js";

/** @typedef {import("./econ-screen-api.js").ScreenApi} ScreenApi */

const form = { cents: 30000 };

/**
 * @param {HTMLElement} host
 * @param {ScreenApi} api
 */
export function renderTrade(host, api) {
  const input = api.input();
  host.appendChild(settlementSection(input, api));
  host.appendChild(offersSection(input, api));
  host.appendChild(investSection(input, api));
  host.appendChild(previewSection(input, api));
  host.appendChild(holdingsSection(input, api));
}

/** @param {number} cents @param {ScreenApi} api */
const goldText = (cents, api) => api.loc("LOC_ECONOMICS_GOLD_AMOUNT", formatGold(cents));

/**
 * @param {PlanInput} input
 * @param {ScreenApi} api
 */
function settlementSection(input, api) {
  const view = tradeView(input, api.me);
  const block = section(api.loc("LOC_ECONOMICS_TRADE_SETTLEMENT"), [
    row(api.loc("LOC_ECONOMICS_TRADE_INCOME"), goldText(view.tradeIncomeCents, api)),
    row(api.loc("LOC_ECONOMICS_TRADE_CAP"), goldText(view.capCents, api)),
  ]);
  if (!view.on) { block.appendChild(note(api.loc("LOC_ECONOMICS_MARKETS_OFF"))); return block; }
  if (!view.stageOpen) block.appendChild(note(api.loc("LOC_ECONOMICS_TRADE_STAGE", api.loc(api.stageOpener("trade") || "LOC_ECONOMICS_STAGE_NEXT_AGE"))));
  if (!view.rows.length) block.appendChild(note(api.loc("LOC_ECONOMICS_TRADE_NONE")));
  for (const line of view.rows) block.appendChild(partnerRow(line, api));
  block.appendChild(note(api.loc("LOC_ECONOMICS_TRADE_NOTE")));
  return block;
}

/**
 * @param {ReturnType<typeof tradeView>["rows"][number]} line
 * @param {ScreenApi} api
 */
function partnerRow(line, api) {
  const box = el("div", "econ-card");
  box.appendChild(el("div", "econ-card-title", api.nameOf(line.partner)));
  box.appendChild(row(api.loc("LOC_ECONOMICS_TRADE_OWE"), goldText(line.youOweCents, api)));
  box.appendChild(row(api.loc("LOC_ECONOMICS_TRADE_OWED"), goldText(line.theyOweCents, api)));
  if (line.payCents > 0) box.appendChild(row(api.loc("LOC_ECONOMICS_TRADE_PAY"), goldText(line.payCents, api), "econ-negative"));
  if (line.receiveCents > 0) box.appendChild(row(api.loc("LOC_ECONOMICS_TRADE_RECEIVE"), goldText(line.receiveCents, api)));
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
  if (!offers.length) block.appendChild(note(api.loc("LOC_ECONOMICS_TRADE_NO_OFFERS")));
  for (const offer of offers) {
    const box = el("div", "econ-card");
    const kind = offer.kind === "general" ? "LOC_ECONOMICS_OFFER_GENERAL_ROW" : "LOC_ECONOMICS_OFFER_PROJECT_ROW";
    box.appendChild(el("div", "econ-card-title", api.loc(kind, api.nameOf(offer.investor), formatGold(offer.cents),
      offer.cityId ? api.cityName(offer.cityId) : "")));
    const actions = el("div", "econ-actions");
    actions.appendChild(button(api.loc("LOC_ECONOMICS_OFFER_ACCEPT"), () => ask(api, { kind: "accept-offer",
      offerId: offer.id })));
    actions.appendChild(button(api.loc("LOC_ECONOMICS_OFFER_DECLINE"), () => ask(api, { kind: "decline-offer",
      offerId: offer.id })));
    box.appendChild(actions);
    block.appendChild(box);
  }
  return block;
}

/**
 * @param {ScreenApi} api
 * @param {PlanRequest} request
 */
function ask(api, request) {
  api.request(request);
  api.rerender();
}

/**
 * @param {PlanInput} input
 * @param {ScreenApi} api
 */
function investSection(input, api) {
  const block = section(api.loc("LOC_ECONOMICS_INVEST"), [
    row(api.loc("LOC_ECONOMICS_INVEST_AMOUNT"), ""),
    goldStepper({ value: form.cents, min: 1000, max: 10000000, format: formatGold,
      onChange: (cents) => { form.cents = cents; api.rerender(); } }),
  ]);
  if (input.options?.investment === false) { block.appendChild(note(api.loc("LOC_ECONOMICS_INVEST_OFF"))); return block; }
  for (const target of investTargets(input, api.me, form.cents)) block.appendChild(targetCard(target, api));
  block.appendChild(note(api.loc("LOC_ECONOMICS_INVEST_NOTE")));
  return block;
}

/**
 * One civ the player could invest in: general investment and aid, and a development loan on each queued build.
 * @param {ReturnType<typeof investTargets>[number]} target
 * @param {ScreenApi} api
 */
function targetCard(target, api) {
  const box = el("div", "econ-card");
  box.appendChild(el("div", "econ-card-title", api.nameOf(target.pid)));
  const host = { host: target.pid, hostIncomeCents: target.incomeCents };
  box.appendChild(actionRow(api, { ...host, form: "general", asAid: false, refusal: target.general,
    caption: "LOC_ECONOMICS_INVEST_GENERAL" }));
  box.appendChild(actionRow(api, { ...host, form: "general", asAid: true, refusal: target.aid,
    caption: "LOC_ECONOMICS_INVEST_AID" }));
  for (const { city, refusal } of target.cities) {
    box.appendChild(actionRow(api, { ...host, form: "project", asAid: false, refusal, city,
      caption: "LOC_ECONOMICS_INVEST_PROJECT" }));
  }
  return box;
}

/**
 * A button with the forecast beside it, or the reason it can't go ahead.
 * @param {ScreenApi} api
 * @param {{ host: number, hostIncomeCents: number, form: InvestKind, asAid: boolean, refusal: string | null,
 *   caption: string, city?: CityRead }} q
 */
function actionRow(api, q) {
  const line = el("div", "econ-line");
  const forecast = investForecast({ form: q.form, cents: form.cents, asAid: q.asAid,
    hostIncomeCents: q.hostIncomeCents, city: q.city ?? null });
  const label = q.city ? api.loc(q.caption, api.buildName(q.city.build || ""), api.cityName(q.city.id))
    : api.loc(q.caption);
  line.appendChild(button(label, () => ask(api, { kind: "invest", investor: api.me, host: q.host, form: q.form,
    cents: form.cents, cityId: q.city?.id ?? null, asAid: q.asAid }), { disabled: q.refusal !== null }));
  if (q.refusal) line.appendChild(el("div", "econ-line econ-negative", api.loc(reasonKey(q.refusal))));
  else line.appendChild(note(forecastText(forecast, q, api)));
  return line;
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
  if (possible === null) { block.appendChild(note(api.loc("LOC_ECONOMICS_TRADE_PREVIEW_UNREAD"))); return block; }
  const rows = routePreview(possible, input.markets?.prices || {}).filter((r) => r.resources.length);
  if (!rows.length) block.appendChild(note(api.loc("LOC_ECONOMICS_TRADE_PREVIEW_NONE")));
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
    block.appendChild(el("div", "econ-line", api.loc(mine ? "LOC_ECONOMICS_HOLDING_OUT" : "LOC_ECONOMICS_HOLDING_IN",
      record.id, api.nameOf(mine ? record.host : record.investor), formatGold(record.outstanding),
      record.term - record.paid)));
  }
  return block;
}
