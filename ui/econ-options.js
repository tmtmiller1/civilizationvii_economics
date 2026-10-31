// econ-options.js - Economics: its group on the Options screen's Mods tab, in the shell and in a game. It holds the
// Spoil Guard (econ-spoil.js). Kept apart from the game scripts so the turn never waits on the Options modules.

import { CategoryType, OptionType, Options } from "/core/ui/options/model-options.js";
import { CategoryData } from "/core/ui/options/options-helpers.js";
import { getSetting, setSetting } from "./econ-settings.js";
import { forgetPolicy } from "./econ-spoil.js";

// The shared Mods tab: whichever mod loads first makes it, the rest reuse it.
if (!CategoryType.Mods) CategoryType.Mods = "mods";
if (!CategoryData[CategoryType.Mods]) {
  CategoryData[CategoryType.Mods] = { title: "LOC_UI_CONTENT_MGR_SUBTITLE",
    description: "LOC_UI_CONTENT_MGR_SUBTITLE_DESCRIPTION" };
}

Options.addInitCallback(() => {
  Options.addOption({
    category: CategoryType.Mods,
    group: "economics",
    type: OptionType.Checkbox,
    id: "economics-spoil-guard",
    initListener: (/** @type {any} */ info) => { info.currentValue = getSetting("spoilGuard") !== false; },
    updateListener: (/** @type {any} */ _info, /** @type {any} */ value) => {
      setSetting("spoilGuard", !!value);
      forgetPolicy();
    },
    label: "LOC_ECONOMICS_OPTIONS_SPOIL_GUARD",
    description: "LOC_ECONOMICS_OPTIONS_SPOIL_GUARD_DESCRIPTION",
  });
});
