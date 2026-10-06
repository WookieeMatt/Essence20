import { ENVIRONMENT_HAZARDS } from "./environment-hazards.mjs";

/**
 * The Severity <select> next to an Environment <select> (Scene Config's Basics tab, and the
 * Environment Region Behavior's own sheet). Each environment has its own severity table (Across the
 * Stars Tables 1-11/1-12/1-13) and the same word means different things in each - Lethal is 1
 * damage/round for a Toxic Atmosphere but 1 damage/10 rounds for Extreme Temperature, and Intense
 * exists only for a Corrosive Atmosphere. A level from another environment's table silently falls
 * back to the mildest one (environment-hazards.mjs#resolveHazard), so offering every level for
 * every environment made it easy to pick one that does nothing. This lists only the chosen
 * environment's own levels, each labelled with its real timing, and rebuilds the list whenever the
 * environment changes.
 */

// The form field names of each Environment/Severity pair this system renders.
const SELECT_PAIRS = [
  ["flags.essence20.environment", "flags.essence20.environmentLevel"],
  ["system.environment", "system.environmentLevel"],
];

/**
 * How often a level deals its damage, e.g. "1 damage/round" or "no damage".
 * @param {Number|String} interval   Rounds between each point of damage, 'scene', 'hour' or 0.
 * @returns {String}
 */
export function describeInterval(interval) {
  if (interval == 'scene') {
    return game.i18n.localize("E20.EnvironmentTimingScene");
  }

  if (interval == 'hour') {
    return game.i18n.localize("E20.EnvironmentTimingHour");
  }

  if (!interval) {
    return game.i18n.localize("E20.EnvironmentTimingNone");
  }

  return interval == 1
    ? game.i18n.localize("E20.EnvironmentTimingRound")
    : game.i18n.format("E20.EnvironmentTimingRounds", { rounds: interval });
}

/**
 * The Severity choices for one environment: "Default" (naming the level it uses) first, then that
 * environment's own levels, harshest first. An environment with no severity table gets "Default"
 * alone.
 * @param {String} environment   An E20.sceneEnvironments key ("" for a Region that inherits).
 * @returns {Array<{value: String, label: String}>}
 */
export function getEnvironmentLevelOptions(environment) {
  const hazard = ENVIRONMENT_HAZARDS[environment];
  const label = (level) => `${game.i18n.localize(CONFIG.E20.environmentLevels[level])} (${describeInterval(hazard.levels[level])})`;
  if (!hazard?.levels) {
    return [{ value: "", label: game.i18n.localize("E20.EnvironmentLevelDefault") }];
  }

  return [
    { value: "", label: game.i18n.format("E20.EnvironmentLevelDefaultOf", { level: label(hazard.defaultLevel) }) },
    ...Object.keys(hazard.levels).map(level => ({ value: level, label: label(level) })),
  ];
}

/**
 * Rebuilds a Severity <select> for the environment currently chosen, keeping its value when that
 * environment still has it (otherwise Default). Disabled when the environment has no levels.
 * @param {HTMLSelectElement} environmentSelect
 * @param {HTMLSelectElement} levelSelect
 */
export function syncEnvironmentLevelSelect(environmentSelect, levelSelect) {
  const options = getEnvironmentLevelOptions(environmentSelect.value);
  const current = levelSelect.value;
  levelSelect.replaceChildren(...options.map(({ value, label }) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    return option;
  }));
  levelSelect.value = options.some(option => option.value == current) ? current : "";
  levelSelect.disabled = options.length == 1;
}

/**
 * Wires every Environment/Severity pair in a rendered sheet. Called from the renderSceneConfig and
 * renderRegionBehaviorConfig hooks in essence20.mjs.
 * @param {HTMLElement} html
 */
export function wireEnvironmentLevelSelects(html) {
  for (const [environmentName, levelName] of SELECT_PAIRS) {
    const environmentSelect = html?.querySelector?.(`select[name="${environmentName}"]`);
    const levelSelect = html?.querySelector?.(`select[name="${levelName}"]`);
    if (!environmentSelect || !levelSelect) {
      continue;
    }

    syncEnvironmentLevelSelect(environmentSelect, levelSelect);
    environmentSelect.addEventListener("change", () => syncEnvironmentLevelSelect(environmentSelect, levelSelect));
  }
}
