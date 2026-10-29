// Dev-only ESLint flat config: the size and complexity limits on ui/, and correctness rules everywhere.
// Not shipped; release.sh leaves it out.

// @eslint/js ships with eslint itself, so it needs no entry of its own in package.json.
import js from "@eslint/js";

// Engine globals the shipped scripts read without importing them. Each is hand-typed in types/civ7-engine.d.ts.
const ENGINE_GLOBALS = {
  Game: "readonly",
  GameContext: "readonly",
  GameInfo: "readonly",
  Players: "readonly",
  Configuration: "readonly",
  Database: "readonly",
  Locale: "readonly",
  Network: "readonly",
  engine: "readonly",
  Controls: "readonly",
  ContextManager: "readonly",
  UI: "readonly",
  YieldTypes: "readonly",
  DiplomacyPlayerRelationships: "readonly",
  ProgressionTreeNodeState: "readonly"
};

const BROWSER_GLOBALS = {
  window: "readonly",
  document: "readonly",
  console: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  HTMLElement: "readonly",
  CustomEvent: "readonly",
  localStorage: "readonly",
  globalThis: "readonly"
};

const NODE_GLOBALS = {
  process: "readonly",
  console: "readonly",
  globalThis: "readonly",
  Buffer: "readonly",
  URL: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  structuredClone: "readonly"
};

// Test and tool code: correctness rules only. The size limits are for the shipped modules; a test file is a list
// of scenarios, and splitting one to satisfy a statement count hides the story.
const TOOL_RULES = {
  ...js.configs.recommended.rules,
  "max-len": ["error", { code: 120, ignoreUrls: true, ignoreStrings: true, ignoreTemplateLiterals: true,
    ignoreRegExpLiterals: true }],
  "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
  eqeqeq: ["error", "always", { null: "ignore" }]
};

export default [
  // Tower Settings Keeper, copied unchanged from its own repo; it is linted and tested there.
  { ignores: ["ui/settings-keeper.js", "node_modules/**", "dist/**", "coverage/**", ".stryker-tmp/**"] },
  {
    files: ["ui/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...ENGINE_GLOBALS, ...BROWSER_GLOBALS }
    },
    rules: {
      ...js.configs.recommended.rules,
      complexity: ["error", 10],
      "max-lines-per-function": ["error", { max: 50, skipBlankLines: true, skipComments: true, IIFEs: true }],
      "max-lines": ["error", { max: 500, skipBlankLines: true, skipComments: true }],
      // Strings, templates, regular expressions and URLs are exempt so data and copy are not penalised.
      "max-len": ["error", { code: 120, ignoreUrls: true, ignoreStrings: true, ignoreTemplateLiterals: true,
        ignoreRegExpLiterals: true }],
      "max-params": ["error", 5],
      "max-depth": ["error", 4],
      "max-statements": ["error", 18],
      "no-undef": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      // Match the engine's own `== null` idiom.
      eqeqeq: ["error", "always", { null: "ignore" }]
    }
  },
  {
    files: ["tests/**/*.mjs", "scripts/**/*.mjs", "devtools/**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      // Tests stand in for the browser and the engine, so they read and assign those globals too.
      globals: { ...NODE_GLOBALS, ...ENGINE_GLOBALS, ...BROWSER_GLOBALS }
    },
    rules: TOOL_RULES
  },
  {
    // A test's name is a sentence about the scenario; it isn't wrapped to fit a column.
    files: ["tests/**/*.mjs"],
    rules: { "max-len": "off" }
  },
  {
    // The Steam change-note script is the same file in every Tower mod; only the correctness rules apply to it here.
    files: ["scripts/steam-changelog.mjs"],
    rules: { "max-lines-per-function": "off", "max-statements": "off", complexity: "off" }
  }
];
