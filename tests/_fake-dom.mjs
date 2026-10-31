// _fake-dom.mjs - the little of the DOM the tab views use (createElement, appendChild, classList, style, listeners),
// so the views render under Node and a test can count what they drew and click what they offered.

class FakeElement {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.parentElement = null;
    this._text = "";
    this.style = {};
    this.attributes = {};
    this.listeners = {};
    this._classes = new Set();
    const self = this;
    this.classList = {
      add: (...names) => names.forEach((n) => self._classes.add(n)),
      remove: (...names) => names.forEach((n) => self._classes.delete(n)),
      toggle: (name, force) => { if (force === undefined ? !self._classes.has(name) : force) self._classes.add(name); else self._classes.delete(name); },
      contains: (name) => self._classes.has(name),
    };
  }
  // As in a page: an element's text is its own, or its children's run together.
  get textContent() { return this._text || this.children.map((c) => c.textContent).join(""); }
  set textContent(value) { this._text = String(value); this.children = []; }
  get className() { return [...this._classes].join(" "); }
  set className(value) { this._classes = new Set(String(value).split(/\s+/).filter(Boolean)); }
  get firstChild() { return this.children[0] ?? null; }
  appendChild(child) { child.parentElement = this; child.parentNode = this; this.children.push(child); return child; }
  removeChild(child) { this.children = this.children.filter((c) => c !== child); return child; }
  // The game's page has no replaceWith; parents swap children with replaceChild.
  replaceChild(next, old) { const i = this.children.indexOf(old); if (i < 0) throw new Error('not a child'); this.children[i] = next; next.parentElement = this; next.parentNode = this; old.parentElement = null; old.parentNode = null; return old; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
  click() { for (const fn of this.listeners.click || []) fn({}); }
  querySelector(selector) { return this.all().find((node) => matches(node, selector)) ?? null; }
  all() { return this.children.flatMap((c) => [c, ...c.all()]); }
}

function matches(node, selector) {
  if (selector.startsWith(".")) return node.classList.contains(selector.slice(1));
  return node.tagName === selector.toUpperCase();
}

export function installFakeDom() {
  const head = new FakeElement("head");
  globalThis.document = {
    createElement: (tag) => new FakeElement(tag),
    createElementNS: (_ns, tag) => new FakeElement(tag),
    getElementById: () => null,
    head,
  };
  globalThis.localStorage = { store: {}, getItem(k) { return this.store[k] ?? null; }, setItem(k, v) { this.store[k] = v; } };
  return { FakeElement, head };
}

export function removeFakeDom() {
  delete globalThis.document;
  delete globalThis.localStorage;
}

/** Every element under `root` (itself included) whose class list holds `name`. */
export function byClass(root, name) {
  return [root, ...root.all()].filter((node) => node.classList.contains(name));
}

/** The text of every element under `root`, joined, for "does it say" checks. */
export function textOf(root) {
  return [root, ...root.all()].map((node) => node._text).filter(Boolean).join(" | ");
}
