import { E20 } from "./config.mjs";
import { findVesselAboard, getVesselConditionStacks } from "./vessel-conditions.mjs";

/**
 * Physical scene/region environment (Across the Stars, "Exploring Infinite Environments,"
 * p.24-25) - see E20.sceneEnvironments' own doc comment in helpers/config.mjs for why this is a
 * separate concept from the pre-existing E20.environments terrain-of-expertise enum.
 *
 * A GM sets a Scene's own default environment (the `essence20.environment` Scene flag, exposed on
 * the Scene Config's "Basics" tab by injectEnvironmentSceneConfigField below), then overrides it
 * for part of the scene by drawing a Region and adding this file's own custom "Environment" Region
 * Behavior to it (e.g. a beach map: `normal` scene default, with a `underwater` Environment Region
 * drawn over just the water) - registered against CONFIG.RegionBehavior in essence20.mjs's own
 * init hook, the same "one dataModels/typeLabels/typeIcons entry per behavior type" idiom Foundry
 * core's own built-in Region Behaviors (client/data/region-behaviors/*.mjs) already use.
 *
 * getEnvironment() is the one thing dice.mjs's own trait checks (Inertial, Aquatic/Amphibious,
 * Enviro-Sealed - see its "Environment" block in _getAutomaticCombatModifiers) call to find out
 * what's actually around an actor's token right now.
 *
 * Alongside the physical environment, a scene and a Region can also each say what TERRAIN (biome,
 * an E20.environments key) they are - the `essence20.terrain` Scene flag and the same Region
 * Behavior's own `terrain` field, read by getTerrain(). That's what the GI Joe "environment of
 * expertise" Perks check (helpers/environmental-expertise.mjs). Both Region fields may be left
 * blank to inherit, so one Region can change just the terrain, just the environment, or both.
 */

export const DEFAULT_ENVIRONMENT = "normal";
const SCENE_ENVIRONMENT_FLAG = "environment";
// The Scene's own default environment severity (an E20.environmentLevels key) - see
// getEnvironmentLevel below.
const SCENE_ENVIRONMENT_LEVEL_FLAG = "environmentLevel";
// The terrain-effect name prefix an Environment Region contributes for its own environment, so the
// movement cost function (helpers/rough-terrain.mjs) can apply High Gravity/Thick Atmosphere.
export const ENVIRONMENT_EFFECT_PREFIX = "essence20Environment.";

/* How much worse one environment is than another, for choosing between a vessel's interior (see
   getVesselInteriorEnvironment below) and wherever the token itself stands. Only the environments
   a vessel interior can become need a rank above 0. */
const INTERIOR_SEVERITY = { thinAtmosphere: 1, toxicAtmosphere: 2, vacuum: 3 };
// Toxic Atmosphere concentrations, mildest first - the order Leaking raises it in.
export const TOXICITY_ORDER = ["harmful", "dangerous", "strong", "lethal"];
// The Scene's own default terrain (biome) - see getSceneTerrain below.
const SCENE_TERRAIN_FLAG = "terrain";
// The terrain-effect name an Environment Region with Rough Terrain contributes to v14's movement
// path (see EnvironmentRegionBehaviorType#_getTerrainEffects and helpers/rough-terrain.mjs).
export const ROUGH_TERRAIN_EFFECT = "essence20RoughTerrain";
// A system sub-type: declared under system.json documentTypes.RegionBehavior and registered by its
// plain name (only MODULE sub-types are prefixed with the package id) - otherwise Foundry rejects
// every Region that carries it as "not a valid type for the RegionBehavior Document class".
export const ENVIRONMENT_REGION_BEHAVIOR_TYPE = "environment";

/**
 * A Scene's own default environment - `normal` unless the GM set the flag on the Scene Config's
 * "Basics" tab.
 * @param {Scene} scene
 * @returns {String}
 */
export function getSceneEnvironment(scene) {
  return scene?.getFlag?.("essence20", SCENE_ENVIRONMENT_FLAG) || DEFAULT_ENVIRONMENT;
}

/**
 * Resolves whatever getEnvironment() was handed (an Actor, a canvas Token placeable, or a
 * TokenDocument) down to a single active TokenDocument, or null if none can be found (an
 * unlinked/unplaced Actor, or an Actor with no token on the current scene at all - Threats and
 * freshly-created Actors are commonly in this state, so this is expected, not an error).
 * @param {Actor|Token|TokenDocument} actorOrToken
 * @returns {TokenDocument|null}
 * @private
 */
/**
 * The scene being played: the rendered one, else the one this client is viewing or the active one.
 * @returns {?Scene}
 */
function _currentScene() {
  return canvas?.scene ?? game?.scenes?.viewed ?? game?.scenes?.active ?? null;
}

function _resolveTokenDocument(actorOrToken) {
  if (!actorOrToken) {
    return null;
  }

  if (actorOrToken.documentName == "Token") {
    return actorOrToken;
  }

  if (actorOrToken.document?.documentName == "Token") {
    return actorOrToken.document;
  }

  if (actorOrToken.documentName == "Actor") {
    // getActiveTokens(linked, document) - document:true returns TokenDocuments directly, so this
    // works even when no canvas is currently rendered (e.g. a GM-side automatic roll). linked:
    // false so an unlinked (per-scene) token's own actor still resolves.
    const active = actorOrToken.getActiveTokens?.(false, true)?.[0];
    if (active) {
      return active;
    }

    // getActiveTokens reads the rendered canvas, so with no canvas drawn it finds nothing even for
    // a token that is sitting on the scene - look the token up on the scene document instead.
    const scene = _currentScene();
    return scene?.tokens?.find?.((token) => token.actorId == actorOrToken.id || token.actor == actorOrToken) ?? null;
  }

  return null;
}

/**
 * The physical environment (an E20.sceneEnvironments key) currently surrounding an actor or
 * token: the innermost Environment Region containing their token, else the current scene's own
 * default, else `normal` (an Actor with no placed token at all also falls back to `normal` - there
 * is no scene to read a default from).
 *
 * Precedence when a token sits inside more than one overlapping Environment Region: the LATEST
 * Region on the scene's own `regions` collection wins (i.e. whichever one the GM drew/added the
 * Environment Behavior to most recently) - the same "last one drawn sits on top" idiom Foundry's
 * own canvas Regions layer already applies to overlapping Region highlighting, and simple for a
 * GM to reason about: draw the broad override first (e.g. a lake covering a whole beach map), then
 * draw a narrower correction on top of it (a dry sandbar in the middle of the lake) afterwards.
 * @param {Actor|Token|TokenDocument} actorOrToken
 * @param {Object} [options]   See getEnvironmentState.
 * @returns {String}
 */
export function getEnvironment(actorOrToken, options = {}) {
  return getEnvironmentState(actorOrToken, options).environment;
}

/**
 * The severity (an E20.environmentLevels key, or "" when none was set) of the environment
 * getEnvironment() returns - read from the same Region Behavior that set the environment, else the
 * scene's own `essence20.environmentLevel` flag, else the vessel interior's own level. Which levels
 * are meaningful for which environment is helpers/environment-hazards.mjs's business.
 * @param {Actor|Token|TokenDocument} actorOrToken
 * @param {Object} [options]   See getEnvironmentState.
 * @returns {String}
 */
export function getEnvironmentLevel(actorOrToken, options = {}) {
  return getEnvironmentState(actorOrToken, options).level;
}

/**
 * A Scene's own default environment severity - "" unless the GM set one on the Scene Config.
 * @param {Scene} scene
 * @returns {String}
 */
export function getSceneEnvironmentLevel(scene) {
  return scene?.getFlag?.("essence20", SCENE_ENVIRONMENT_LEVEL_FLAG) || "";
}

/**
 * getEnvironment()/getEnvironmentLevel() in one pass. An actor aboard a vessel (a Vehicle's crew,
 * system.actors) whose Space Vessel Conditions make its interior worse than where the actor's own
 * token stands gets the interior instead - Decompressed/Leaking (Across the Stars p.25-26), see
 * getVesselInteriorEnvironment.
 * @param {Actor|Token|TokenDocument} actorOrToken
 * @param {Object} [options]
 * @param {Boolean} [options.includeInterior=true]   False skips the vessel lookup (derived data,
 *   which only cares about gravity, calls it for every actor and shouldn't walk every other one).
 * @returns {{environment: String, level: String}}
 */
export function getEnvironmentState(actorOrToken, { includeInterior = true } = {}) {
  const { tokenDoc, scene } = _resolveTokenAndScene(actorOrToken);
  const behavior = _getRegionBehavior(tokenDoc, "environment");
  const state = behavior
    ? { environment: behavior.system.environment, level: behavior.system.environmentLevel || "" }
    : { environment: getSceneEnvironment(scene), level: getSceneEnvironmentLevel(scene) };

  if (!includeInterior) {
    return state;
  }

  const actor = actorOrToken?.documentName == "Actor" ? actorOrToken : (tokenDoc?.actor ?? actorOrToken?.actor);
  const interior = getVesselInteriorEnvironment(findVesselAboard(actor));
  return interior && isWorseInterior(interior, state) ? interior : state;
}

/**
 * The environment a Space Vessel's own Conditions turn its interior into (Across the Stars
 * p.25-26), or null when they don't: "Decompressed... their interior is treated as a
 * thin-atmosphere environment... a second time, the environment changes to a Vacuum or Void";
 * "Leaking... becomes a Toxic atmosphere with a toxicity rating of harmful... raised in lethality
 * by one level" per further Leaking. When both apply the worse one (INTERIOR_SEVERITY) wins.
 * @param {?Actor} vessel
 * @returns {?{environment: String, level: String}}
 */
export function getVesselInteriorEnvironment(vessel) {
  if (!vessel) {
    return null;
  }

  const decompressed = getVesselConditionStacks(vessel, "decompressed");
  const leaking = getVesselConditionStacks(vessel, "leaking");
  const candidates = [];
  if (decompressed) {
    candidates.push({ environment: decompressed >= 2 ? "vacuum" : "thinAtmosphere", level: "" });
  }

  if (leaking) {
    candidates.push({
      environment: "toxicAtmosphere",
      level: TOXICITY_ORDER[Math.min(leaking, TOXICITY_ORDER.length) - 1],
    });
  }

  candidates.sort((a, b) => INTERIOR_SEVERITY[b.environment] - INTERIOR_SEVERITY[a.environment]);
  return candidates[0] ?? null;
}

/**
 * Whether a vessel interior is worse than the actor's own surroundings. Two Toxic Atmospheres
 * compare by concentration; anything else by INTERIOR_SEVERITY (every other environment ranks 0,
 * so any hazardous interior beats standing in a normal or merely low-gravity spot).
 * @param {{environment: String, level: String}} interior
 * @param {{environment: String, level: String}} current
 * @returns {Boolean}
 * @private
 */
function isWorseInterior(interior, current) {
  if (interior.environment == current.environment) {
    return interior.environment == "toxicAtmosphere"
      && TOXICITY_ORDER.indexOf(interior.level) > TOXICITY_ORDER.indexOf(current.level);
  }

  return (INTERIOR_SEVERITY[interior.environment] ?? 0) > (INTERIOR_SEVERITY[current.environment] ?? 0);
}

/**
 * The token (if any) getEnvironment()/getTerrain() should read Regions from, and the scene whose
 * own default applies when no Region says otherwise. With no token to place them anywhere more
 * specific, the scene being played is still the best answer.
 * @param {Actor|Token|TokenDocument} actorOrToken
 * @returns {{tokenDoc: ?TokenDocument, scene: ?Scene}}
 * @private
 */
function _resolveTokenAndScene(actorOrToken) {
  const tokenDoc = _resolveTokenDocument(actorOrToken);
  if (tokenDoc) {
    return { tokenDoc, scene: tokenDoc.parent };
  }

  const scene = actorOrToken?.documentName == "Actor" ? _currentScene() : (actorOrToken?.parent ?? _currentScene());
  return { tokenDoc: null, scene };
}

/**
 * The value of one Environment Region Behavior field (`environment` or `terrain`) from the
 * latest-drawn Region containing the token whose enabled Environment Behavior actually sets that
 * field. A blank field means "inherit," so it's skipped rather than treated as an override: a
 * terrain-only Region drawn over an underwater one leaves the token underwater, and vice versa.
 * @param {?TokenDocument} tokenDoc
 * @param {String} field
 * @returns {String|undefined}
 * @private
 */
function _getRegionOverride(tokenDoc, field) {
  return _getRegionBehavior(tokenDoc, field)?.system[field];
}

/**
 * The Environment Region Behavior _getRegionOverride reads its value from - the whole Behavior, so
 * getEnvironmentState can take the level from the same Region that set the environment.
 * @param {?TokenDocument} tokenDoc
 * @param {String} field
 * @returns {Object|undefined}
 * @private
 */
function _getRegionBehavior(tokenDoc, field) {
  if (!tokenDoc) {
    return undefined;
  }

  const settingBehavior = (region) => region.behaviors?.find((b) =>
    b.type == ENVIRONMENT_REGION_BEHAVIOR_TYPE && !b.disabled && b.system?.[field]);
  const regions = [...(tokenDoc.regions ?? [])].filter(settingBehavior);
  if (!regions.length) {
    return undefined;
  }

  const sceneOrder = tokenDoc.parent?.regions ? [...tokenDoc.parent.regions] : [];
  regions.sort((a, b) => sceneOrder.indexOf(b) - sceneOrder.indexOf(a));
  return settingBehavior(regions[0]);
}

/**
 * A Scene's own default terrain (an E20.environments biome key - arctic/desert/.../woodlands, the
 * same enum the GI Joe "environment of expertise" Perks pick from), or null when the GM hasn't
 * set one on the Scene Config's "Basics" tab. Unlike the physical environment there's no
 * sensible default biome, so "not set" stays distinguishable from every real value - that's what
 * lets the expertise Perks fall back to their manual toggle (helpers/environmental-expertise.mjs).
 * @param {Scene} scene
 * @returns {String|null}
 */
export function getSceneTerrain(scene) {
  const terrain = scene?.getFlag?.("essence20", SCENE_TERRAIN_FLAG);
  return terrain && terrain in E20.environments ? terrain : null;
}

/**
 * The terrain (an E20.environments biome key) currently around an actor or token: the latest-drawn
 * Environment Region containing their token that sets a terrain, else the current scene's own
 * default terrain, else null when nothing anywhere says. Same token/scene resolution and Region
 * precedence as getEnvironment() above.
 * @param {Actor|Token|TokenDocument} actorOrToken
 * @returns {String|null}
 */
export function getTerrain(actorOrToken) {
  const { tokenDoc, scene } = _resolveTokenAndScene(actorOrToken);
  const regionTerrain = _getRegionOverride(tokenDoc, "terrain");
  return regionTerrain && regionTerrain in E20.environments ? regionTerrain : getSceneTerrain(scene);
}

/**
 * Whether an actor's or token's current position is Rough Terrain: inside any Region with an
 * enabled Environment Behavior that has Rough Terrain ticked. Unlike the environment and terrain
 * there's no scene-wide default - Foundry's movement measuring only reads terrain from Regions, so
 * a whole-map Rough Terrain scene is a Region drawn over the whole map, which keeps the ruler's cost
 * and this answer in step.
 * @param {Actor|Token|TokenDocument} actorOrToken
 * @returns {Boolean}
 */
export function isInRoughTerrain(actorOrToken) {
  const { tokenDoc } = _resolveTokenAndScene(actorOrToken);
  return !!_getRegionOverride(tokenDoc, "roughTerrain");
}

/**
 * Re-prepares an actor with environments of expertise when their token's Regions change (an
 * `updateToken` hook, registered in essence20.mjs), so derived data that depends on the terrain -
 * Prowl's Ground Movement (actor.mjs) and Taking Point's in-environment Active Effect
 * (helpers/environment-gated-effects.mjs) - catches up as soon as the token walks into or out of
 * a terrain Region, rather than on the actor's next unrelated update. Rolls need no refresh: they
 * read getTerrain() live.
 * @param {TokenDocument} tokenDoc
 * @param {Object} changes   The update's own differential changes.
 * @returns {Boolean}   Whether the actor was refreshed.
 */
export function refreshTerrainDependentActor(tokenDoc, changes) {
  if (!changes || !("_regions" in changes)) {
    return false;
  }

  // Low Gravity/Zero-G Movement (actor.mjs#_prepareMovement) is derived from the environment too,
  // which records what it last prepared against in _e20MovementEnvironment.
  const actor = tokenDoc?.actor;
  const movementEnvironmentChanged = actor?._e20MovementEnvironment !== undefined
    && getEnvironment(tokenDoc, { includeInterior: false }) != actor._e20MovementEnvironment;
  if (!actor?.system?.environments?.length && !movementEnvironmentChanged) {
    return false;
  }

  actor.reset?.();
  if (actor.sheet?.rendered) {
    actor.sheet.render();
  }

  return true;
}

/**
 * Enviro-Sealed (Across the Stars, Armor Traits, p.85): "grants immunity to most environmental
 * conditions and grants Edge on all Skill Tests made to resist adverse situations." The automatic
 * half this project CAN check for free - see dice.mjs's own "Enviro-Sealed" comment (next to
 * hasEnviroSealedEdge) for why this is scoped to "the current physical environment is non-normal"
 * rather than every possible adverse situation.
 * @param {Array<Item>} equippedArmor   The actor's own currently-equipped armor Items.
 * @param {String} environment          An E20.sceneEnvironments key (see getEnvironment above).
 * @returns {Boolean}
 */
export function isEnviroSealedEdgeActive(equippedArmor, environment) {
  return environment != DEFAULT_ENVIRONMENT && hasEquippedEnviroSealedArmor(equippedArmor);
}

/**
 * Whether the actor is wearing any Enviro-Sealed armor at all - shown as a Roll Options Dialog
 * checkbox (helpers/roll-dialog.mjs's own enviroSealedAdverseSituationAvailable) for adverse
 * situations OTHER than the physical environment, which isEnviroSealedEdgeActive above already
 * covers automatically.
 * @param {Array<Item>} equippedArmor
 * @returns {Boolean}
 */
export function hasEquippedEnviroSealedArmor(equippedArmor) {
  return equippedArmor.some((a) => a.system.traits?.includes("enviroSealed"));
}

/**
 * The data model for the custom "Environment" Region Behavior - sets a single E20.sceneEnvironments
 * value for anything inside the Region, overriding the scene's own default. Registered against
 * CONFIG.RegionBehavior in essence20.mjs's init hook.
 *
 * Purely declarative (no events map): unlike core's own ApplyActiveEffectRegionBehaviorType, this
 * doesn't need to react to a token entering/exiting - getEnvironment() above reads a token's
 * current `regions` Set directly, on demand, at roll time.
 */
export class EnvironmentRegionBehaviorType extends foundry.data.regionBehaviors.RegionBehaviorType {
  static LOCALIZATION_PREFIXES = ["E20.RegionBehaviorEnvironment"];

  /** @override */
  static defineSchema() {
    return {
      // Blank = inherit (the scene default, or an older Region underneath), so a GM can draw a
      // Region that only changes the terrain. Every value saved before blank was allowed is still
      // one of the choices, so existing Regions stay valid; new ones still start as Underwater.
      environment: new foundry.data.fields.StringField({
        required: true,
        blank: true,
        initial: "underwater",
        choices: () => E20.sceneEnvironments,
      }),
      // The terrain (biome) inside this Region - blank = inherit, same as above. Read by
      // getTerrain() for the GI Joe "environment of expertise" Perks.
      terrain: new foundry.data.fields.StringField({
        required: true,
        blank: true,
        initial: "",
        choices: () => E20.environments,
      }),
      // Rough Terrain (GI Joe CRB p.219 and every other line's core rulebook): moving through it
      // doubles Movement cost - see helpers/rough-terrain.mjs.
      roughTerrain: new foundry.data.fields.BooleanField({ initial: false }),
      // Severity of this Region's environment (ATS Tables 1-11/1-12/1-13) - blank uses that
      // environment's own default (helpers/environment-hazards.mjs). Added after the fields above,
      // so every existing Region simply reads blank.
      environmentLevel: new foundry.data.fields.StringField({
        required: true,
        blank: true,
        initial: "",
        choices: () => E20.environmentLevels,
      }),
    };
  }

  /**
   * Feeds Rough Terrain, and this Region's own environment, into Foundry v14's own terrain-aware
   * movement measuring (ruler, pathing and each token's measured movementHistory cost). Only marks
   * the segment - whether the moving token actually pays is decided in helpers/rough-terrain.mjs's
   * Essence20TerrainData, which knows the token and so can apply every "ignore Rough Terrain"
   * exemption and each environment's own cost without this file having to know about Perks.
   * @override
   */
  _getTerrainEffects(_token, _segment, _options) {
    const effects = this.roughTerrain ? [{ name: ROUGH_TERRAIN_EFFECT }] : [];
    if (this.environment) {
      effects.push({ name: `${ENVIRONMENT_EFFECT_PREFIX}${this.environment}` });
    }

    return effects;
  }
}

/**
 * Adds the scene-default-environment <select> to the Scene Config's "Basics" tab. Called from
 * essence20.mjs's own `Hooks.on("renderSceneConfig", ...)`.
 * @param {SceneConfig} app
 * @param {HTMLElement} html
 */
export function injectEnvironmentSceneConfigField(app, html) {
  const tab = html.querySelector('.tab[data-tab="basics"]');
  if (!tab || tab.querySelector('select[name="flags.essence20.environment"]')) {
    return;
  }

  const current = getSceneEnvironment(app.document);
  const options = Object.entries(E20.sceneEnvironments)
    .map(([key, labelKey]) =>
      `<option value="${key}" ${key == current ? "selected" : ""}>${game.i18n.localize(labelKey)}</option>`)
    .join("");

  const group = document.createElement("div");
  group.classList.add("form-group");
  group.innerHTML = `
    <label>${game.i18n.localize("E20.SceneEnvironmentDefault")}</label>
    <div class="form-fields">
      <select name="flags.essence20.environment">${options}</select>
    </div>
    <p class="hint">${game.i18n.localize("E20.SceneEnvironmentDefaultHint")}</p>
  `;
  tab.appendChild(group);

  // The default environment's severity, blank = that environment's own default - see
  // getSceneEnvironmentLevel above.
  const currentLevel = getSceneEnvironmentLevel(app.document);
  const levelOptions = [["", "E20.EnvironmentLevelDefault"], ...Object.entries(E20.environmentLevels)]
    .map(([key, labelKey]) =>
      `<option value="${key}" ${key == currentLevel ? "selected" : ""}>${game.i18n.localize(labelKey)}</option>`)
    .join("");

  const levelGroup = document.createElement("div");
  levelGroup.classList.add("form-group");
  levelGroup.innerHTML = `
    <label>${game.i18n.localize("E20.SceneEnvironmentLevel")}</label>
    <div class="form-fields">
      <select name="flags.essence20.environmentLevel">${levelOptions}</select>
    </div>
    <p class="hint">${game.i18n.localize("E20.SceneEnvironmentLevelHint")}</p>
  `;
  tab.appendChild(levelGroup);

  // The scene's default terrain (biome), blank = "Not set" - see getSceneTerrain above.
  const currentTerrain = getSceneTerrain(app.document) ?? "";
  const terrainOptions = [["", "E20.SceneTerrainNotSet"], ...Object.entries(E20.environments)]
    .map(([key, labelKey]) =>
      `<option value="${key}" ${key == currentTerrain ? "selected" : ""}>${game.i18n.localize(labelKey)}</option>`)
    .join("");

  const terrainGroup = document.createElement("div");
  terrainGroup.classList.add("form-group");
  terrainGroup.innerHTML = `
    <label>${game.i18n.localize("E20.SceneTerrainDefault")}</label>
    <div class="form-fields">
      <select name="flags.essence20.terrain">${terrainOptions}</select>
    </div>
    <p class="hint">${game.i18n.localize("E20.SceneTerrainDefaultHint")}</p>
  `;
  tab.appendChild(terrainGroup);
}
