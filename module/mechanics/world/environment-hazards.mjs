import { applyDamage } from "../combat/combat.mjs";
import { DEFAULT_ENVIRONMENT, getEnvironmentState, hasEquippedEnviroSealedArmor } from "./environment.mjs";
import { essenceWouldEmpty } from "../../rules/plugins/combat/defeat-stage.mjs";

/**
 * Environmental damage over time and the protection against it (Across the Stars, "Exploring
 * Infinite Environments," p.23-25). What each environment does:
 *
 * - Corrosive Atmosphere: "Anything unprotected suffers 1 Acid damage at the end of the specified
 *   passage of time" (Table 1-11) - objects too, so Vehicles and Zords take it.
 * - Extreme Temperature: "imposing the Impaired Condition... will inflict 1 Fire or Cold damage after
 *   a determined amount of time passes" (Table 1-12). Impaired is dice.mjs's own automatic ↓1.
 * - Irradiated: "For each cumulative scene... inflict 1 Strength and Speed Essence damage."
 * - Thick/Thin Atmosphere: Impaired "unless a creature takes a Free action... or is wearing gear with
 *   breathing assistance" - dice.mjs's ↓1, which the player unticks on a turn they spent the Free
 *   action. Thick Atmosphere's Rough Terrain is mechanics/world/rough-terrain.mjs.
 * - Toxic Atmosphere: "1 Poison damage at the end of the specified unit of time" (Table 1-13).
 * - Vacuum or Void: "1 Strength, Speed, and Smarts Essence damage at the end of each turn."
 *
 * Round-based damage is dealt at the end of the exposed creature's own turn (Essence20Combat
 * #_onEndTurn, which v14 runs once, on the active GM): an exposure counter on the actor counts the
 * turns spent in the same environment and level, and damage lands every Nth turn. Per-scene damage
 * (Irradiated, Harmful toxicity) lands when the GM starts a new scene (the Scene Clock), for every
 * token on the scene being played. Per-hour damage (Dangerous temperature) has no clock to hang on
 * and is left to the GM, as is Uncomfortable's 0 damage (its Impaired still applies).
 *
 * "Beings that live naturally in such environments are not affected" has nothing on an actor to
 * read; the GM leaves such a creature's Region/scene out, or removes the damage.
 */

// Rounds between each point of damage; 'scene'/'hour' are longer clocks, 0 is no damage.
export const ENVIRONMENT_HAZARDS = {
  corrosiveAtmosphere: {
    damageType: 'acid', affectsObjects: true, defaultLevel: 'mild',
    levels: { intense: 1, concentrated: 3, strong: 5, mild: 10 },
  },
  extremeCold: {
    damageType: 'cold', impaired: true, category: 'temperature', defaultLevel: 'uncomfortable',
    levels: { lethal: 10, dangerous: 'hour', uncomfortable: 0 },
  },
  extremeHeat: {
    damageType: 'fire', impaired: true, category: 'temperature', defaultLevel: 'uncomfortable',
    levels: { lethal: 10, dangerous: 'hour', uncomfortable: 0 },
  },
  irradiated: { essences: ['strength', 'speed'], category: 'radiation', interval: 'scene' },
  thickAtmosphere: { impaired: true, category: 'breathing' },
  thinAtmosphere: { impaired: true, category: 'breathing' },
  toxicAtmosphere: {
    damageType: 'poison', category: 'breathing', defaultLevel: 'harmful',
    levels: { lethal: 1, strong: 5, dangerous: 10, harmful: 'scene' },
  },
  vacuum: { essences: ['strength', 'speed', 'smarts'], category: 'breathing', interval: 1 },
};

const EXPOSURE_FLAG = 'environmentExposure';
// Extension-added protections, fn(actor, environment, hazard) => label or null
// (helpers/extensions/situational1 - Weather Gear, Acclimating). Read by getEnvironmentProtection.
export const ENVIRONMENT_PROTECTORS = [];
// Actor types that are machines, not "living creatures" - only a Corrosive Atmosphere harms them.
const OBJECT_ACTOR_TYPES = ['vehicle', 'zord', 'megaform', 'party'];

// Environmentally Sealed, Environmental Aegis (while Morphed), the gas masks and Scuba Gear are HazardProtection
// item rules (rules/plugins/combat/hazard-terrain-targets.mjs), read through ENVIRONMENT_PROTECTORS above.

/**
 * The environment's hazard, with its level resolved: a level that doesn't belong to this
 * environment (or none at all) falls back to its default level.
 * @param {String} environment
 * @param {String} [level]
 * @returns {?{hazard: Object, level: String, interval: (Number|String|null)}}
 */
export function resolveHazard(environment, level) {
  const hazard = ENVIRONMENT_HAZARDS[environment];
  if (!hazard) {
    return null;
  }

  if (!hazard.levels) {
    return { hazard, level: '', interval: hazard.interval ?? null };
  }

  const resolvedLevel = level in hazard.levels ? level : hazard.defaultLevel;
  return { hazard, level: resolvedLevel, interval: hazard.levels[resolvedLevel] };
}

/**
 * What protects this actor from an environment, or null when nothing does. Enviro-Sealed armor
 * (Across the Stars p.85, "immunity to most environmental conditions") protects from every hazard
 * here; a Morphed Environmentally Sealed or Environmental Aegis holder from the breathing ones (and
 * Aegis from temperature too); a gas mask from a Toxic Atmosphere; Scuba Gear's breathing
 * assistance from Thick/Thin Atmosphere. A vehicle, Zord or Megaform isn't a living creature, so
 * only a Corrosive Atmosphere touches it.
 * @param {Actor} actor
 * @param {String} environment
 * @returns {?String}   A label for the protection (for the chat line), or null.
 */
export function getEnvironmentProtection(actor, environment) {
  const hazard = ENVIRONMENT_HAZARDS[environment];
  if (!hazard || !actor) {
    return null;
  }

  for (const protector of ENVIRONMENT_PROTECTORS) {
    try {
      const label = protector(actor, environment, hazard);
      if (label) {
        return label;
      }
    } catch (error) {
      console.error('Essence20 | environment protector failed', error);
    }
  }

  if (OBJECT_ACTOR_TYPES.includes(actor.type) && !hazard.affectsObjects) {
    return game.i18n.localize('E20.EnvironmentProtectionNotLiving');
  }

  const equippedArmor = actor.items?.filter?.(item => item.type == 'armor' && item.system?.equipped) ?? [];
  if (hasEquippedEnviroSealedArmor(equippedArmor)) {
    return game.i18n.localize('E20.ArmorTraitEnviroSealed');
  }

  return null;
}

/**
 * Whether the environment currently imposes Impaired on this actor (Extreme Temperature, Thick or
 * Thin Atmosphere, unprotected). Read by dice.mjs's "Environment" block.
 * @param {Actor} actor
 * @param {String} environment
 * @returns {Boolean}
 */
export function isImpairedByEnvironment(actor, environment) {
  return !!ENVIRONMENT_HAZARDS[environment]?.impaired && !getEnvironmentProtection(actor, environment);
}

/**
 * The damage due at the end of an exposed actor's turn, given how many consecutive turns it has now
 * spent in the environment: Vacuum's Essence damage every turn, and a round-counted level's 1
 * damage on every Nth turn. Pure - applyEnvironmentAtTurnEnd does the applying.
 * @param {String} environment
 * @param {String} level
 * @param {Number} turns   Consecutive turns in this environment and level, this one included.
 * @returns {?{damageType: ?String, essences: Array<String>}}
 */
export function getTurnEndHazard(environment, level, turns) {
  const resolved = resolveHazard(environment, level);
  if (!resolved || typeof resolved.interval != 'number' || resolved.interval <= 0 || turns % resolved.interval) {
    return null;
  }

  return { damageType: resolved.hazard.damageType ?? null, essences: resolved.hazard.essences ?? [] };
}

/**
 * The damage a scene's end deals ("per scene" - Irradiated, Harmful toxicity).
 * @param {String} environment
 * @param {String} level
 * @returns {?{damageType: ?String, essences: Array<String>}}
 */
export function getSceneEndHazard(environment, level) {
  const resolved = resolveHazard(environment, level);
  if (resolved?.interval != 'scene') {
    return null;
  }

  return { damageType: resolved.hazard.damageType ?? null, essences: resolved.hazard.essences ?? [] };
}

/**
 * The next exposure counter: one more turn if the actor is still in the same combat, environment
 * and level, otherwise a fresh count of 1.
 * @param {?Object} previous   {combatId, environment, level, turns}
 * @param {Object} current     {combatId, environment, level}
 * @returns {Object}
 */
export function nextExposure(previous, current) {
  const same = previous && previous.combatId == current.combatId
    && previous.environment == current.environment && previous.level == current.level;
  return { ...current, turns: same ? previous.turns + 1 : 1 };
}

/**
 * 1 Essence damage to each listed Essence - the same `system.essences.<x>.value` a Rest restores.
 * Actors without per-Essence values (most machines) are skipped.
 * @param {Actor} actor
 * @param {Array<String>} essences
 * @returns {Promise<Array<String>>}   The Essences actually damaged.
 */
export async function applyEssenceDamage(actor, essences) {
  const update = {};
  const damaged = [];
  for (const essence of essences) {
    const value = actor.system?.essences?.[essence]?.value;
    if (typeof value == 'number' && value > 0) {
      // essenceWouldEmpty Triggers (rules/plugins/combat/defeat-stage.mjs) may keep the last point - Immortal Rebel
      // Soul's Essence half, sharing its Health half's use.
      if (value == 1 && await essenceWouldEmpty(actor, essence)) {
        continue;
      }

      update[`system.essences.${essence}.value`] = value - 1;
      damaged.push(essence);
    }
  }

  if (damaged.length) {
    await actor.update(update);
  }

  return damaged;
}

/**
 * Applies one hazard tick and posts its chat line.
 * @param {Actor} actor
 * @param {String} environment
 * @param {{damageType: ?String, essences: Array<String>}} tick
 * @returns {Promise<void>}
 * @private
 */
async function _applyTick(actor, environment, tick) {
  const parts = [];
  if (tick.damageType) {
    const applied = await applyDamage(actor, 1, tick.damageType);
    parts.push(game.i18n.format('E20.EnvironmentHazardDamage', {
      amount: applied ?? 1, type: game.i18n.localize(CONFIG.E20.damageTypes[tick.damageType] ?? tick.damageType),
    }));
  }

  if (tick.essences.length) {
    const damaged = await applyEssenceDamage(actor, tick.essences);
    if (damaged.length) {
      parts.push(game.i18n.format('E20.EnvironmentHazardEssenceDamage', {
        essences: damaged.map(e => game.i18n.localize(CONFIG.E20.essences[e] ?? e)).join(', '),
      }));
    }
  }

  if (!parts.length) {
    return;
  }

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: game.i18n.format('E20.EnvironmentHazardChat', {
      name: actor.name,
      environment: game.i18n.localize(CONFIG.E20.sceneEnvironments[environment] ?? environment),
      effects: parts.join('; '),
    }),
  });
}

/**
 * End-of-turn environmental damage for whoever's turn just ended. Called from
 * Essence20Combat#_onEndTurn (active GM only).
 * @param {Actor} actor
 * @param {Combat} combat
 * @param {?TokenDocument} [tokenDoc]   The combatant's own token. Read in preference to the actor:
 *   only the active GM runs this, and resolving through the actor falls back to whatever scene
 *   that GM's client is looking at, which need not be the scene the fight is on.
 * @returns {Promise<?{damageType: ?String, essences: Array<String>}>}   The tick applied, if any.
 */
export async function applyEnvironmentAtTurnEnd(actor, combat, tokenDoc = null) {
  if (!actor) {
    return null;
  }

  const { environment, level } = getEnvironmentState(tokenDoc ?? actor);
  const previous = actor.getFlag?.('essence20', EXPOSURE_FLAG) ?? null;
  if (environment == DEFAULT_ENVIRONMENT || !ENVIRONMENT_HAZARDS[environment]
    || getEnvironmentProtection(actor, environment)) {
    if (previous) {
      await actor.unsetFlag('essence20', EXPOSURE_FLAG);
    }

    return null;
  }

  const resolvedLevel = resolveHazard(environment, level).level;
  const exposure = nextExposure(previous, { combatId: combat?.id ?? null, environment, level: resolvedLevel });
  await actor.setFlag('essence20', EXPOSURE_FLAG, exposure);

  const tick = getTurnEndHazard(environment, resolvedLevel, exposure.turns);
  if (tick) {
    await _applyTick(actor, environment, tick);
  }

  return tick;
}

/**
 * Per-scene environmental damage, when the GM starts a new scene (an `essence20.sceneAdvanced`
 * hook from mechanics/resources/scene-clock.mjs#advanceScene): every unprotected actor with a token on the
 * scene being played takes its environment's "per scene" damage.
 * @param {?Scene} scene
 * @returns {Promise<Number>}   How many actors took damage.
 */
export async function applyEnvironmentAtSceneEnd(scene) {
  if (!game.user?.isActiveGM || !scene) {
    return 0;
  }

  const seen = new Set();
  let damaged = 0;
  for (const tokenDoc of scene.tokens ?? []) {
    const actor = tokenDoc.actor;
    if (!actor || seen.has(actor.uuid)) {
      continue;
    }

    seen.add(actor.uuid);
    const { environment, level } = getEnvironmentState(tokenDoc);
    const tick = getSceneEndHazard(environment, level);
    if (tick && !getEnvironmentProtection(actor, environment)) {
      await _applyTick(actor, environment, tick);
      damaged++;
    }
  }

  return damaged;
}
