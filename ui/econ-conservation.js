// econ-conservation.js - Economics: transfers as grantYield calls. A civ-to-civ transfer becomes two grants that sum
// to zero; a transfer with a world account (bond market, temple treasuries, tax) is one grant, the only kind that
// creates or destroys Gold (DESIGN 4.14).

import { isWorldAccount } from "./econ-params.js";

/** @param {Transfer} transfer */
export function transferKey(transfer) {
  return `${transfer.loanId}:${transfer.turn}`;
}

/**
 * [{ pid, cents, key }] in issue order; the glue runs these through Players.grantYield after an isAlive check.
 * @param {Transfer[]} transfers
 * @returns {Grant[]}
 */
export function grantsFor(transfers) {
  /** @type {Grant[]} */
  const out = [];
  for (const transfer of transfers) {
    const key = transferKey(transfer);
    if (!isWorldAccount(transfer.from)) out.push({ pid: transfer.from, cents: -transfer.cents, key });
    if (!isWorldAccount(transfer.to)) out.push({ pid: transfer.to, cents: transfer.cents, key });
  }
  return out;
}

/**
 * Net Gold each world account put into civ treasuries (negative when civs paid it), as a Map.
 * @param {Transfer[]} transfers
 * @returns {Map<Party, number>}
 */
export function worldNetByAccount(transfers) {
  /** @type {Map<Party, number>} */
  const out = new Map();
  for (const transfer of transfers) {
    const fromWorld = isWorldAccount(transfer.from);
    const toWorld = isWorldAccount(transfer.to);
    if (fromWorld && !toWorld) out.set(transfer.from, (out.get(transfer.from) || 0) + transfer.cents);
    else if (toWorld && !fromWorld) out.set(transfer.to, (out.get(transfer.to) || 0) - transfer.cents);
  }
  return out;
}

/**
 * Net Gold the world accounts together put into civ treasuries.
 * @param {Transfer[]} transfers
 */
export function worldNet(transfers) {
  let net = 0;
  for (const value of worldNetByAccount(transfers).values()) net += value;
  return net;
}

/**
 * Keys whose civ-to-civ grants do not sum to zero.
 * @param {Grant[]} grants
 * @param {Transfer[]} transfers
 */
export function unbalancedPairs(grants, transfers) {
  const civToCiv = new Set(transfers
    .filter((transfer) => !isWorldAccount(transfer.from) && !isWorldAccount(transfer.to)).map(transferKey));
  /** @type {Map<string, number>} */
  const sums = new Map();
  for (const grant of grants) {
    if (civToCiv.has(grant.key)) sums.set(grant.key, (sums.get(grant.key) || 0) + grant.cents);
  }
  return [...sums].filter(([, sum]) => sum !== 0).map(([key]) => key);
}

/**
 * Net grant per civ: one Gold grant per civ per turn is what the commit step sends (DESIGN 4.14).
 * @param {Grant[]} grants
 * @returns {Map<Party, number>}
 */
export function netGrants(grants) {
  /** @type {Map<Party, number>} */
  const out = new Map();
  for (const grant of grants) out.set(grant.pid, (out.get(grant.pid) || 0) + grant.cents);
  return out;
}

/**
 * Applies grants to a Map of pid to cents, returning a new Map.
 * @param {Map<Party, number>} balances
 * @param {Grant[]} grants
 */
export function applyGrants(balances, grants) {
  const next = new Map(balances);
  for (const grant of grants) next.set(grant.pid, (next.get(grant.pid) || 0) + grant.cents);
  return next;
}

/** @param {Map<Party, number>} balances */
export function sumOf(balances) {
  let sum = 0;
  for (const value of balances.values()) sum += value;
  return sum;
}

/**
 * Unexplained change in the civ total: 0 when only income and world-account flows moved Gold.
 * @param {{ before: Map<Party, number>, after: Map<Party, number>, incomeTotal: number, transfers: Transfer[] }} q
 */
export function conservationGap({ before, after, incomeTotal, transfers }) {
  return sumOf(after) - sumOf(before) - incomeTotal - worldNet(transfers);
}
