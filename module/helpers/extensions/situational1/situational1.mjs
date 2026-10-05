import {
  registerAfterDamage, registerApplyDialog, registerChatButton, registerDerived, registerDialogToggles, registerRest,
  registerRollSources, registerSpecializes, registerTurnStart, registerUse,
} from "../../extensions.mjs";
import { getSceneEpoch, getUses, markUsed } from "../../scene-clock.mjs";
import { hasUsedThisEncounter, markUsedThisEncounter } from "../../perks.mjs";
import { worldActors } from "../../companion-link.mjs";
import { getNearbyAllyTokens } from "../../allies.mjs";
import { getProtectedTargetUuid } from "../../protected-target.mjs";
import { getFavoriteWeaponItem } from "../../favorite-weapon.mjs";

/**
 * Item Review, "situational" group, slice 1: Perks and upgrades that only work in a particular
 * environment, terrain, stealth state or scene type. Everything here reads the physical environment
 * (helpers/environment.mjs#getEnvironment - underwater, zero-G...) or the terrain/biome
 * (getTerrain - arctic, urban, woodlands...) the GM set on the Scene or on an Environment Region, and
 * falls back to a player toggle when the GM hasn't tagged the scene - the same split
 * helpers/environmental-expertise.mjs already uses.
 *
 * Three things need a hook the extension registry doesn't have; SCRATCH/integration/situational1-
 * patch.cjs adds them as plain exported arrays that this file pushes onto at setup:
 *   - rough-terrain.mjs ROUGH_TERRAIN_IGNORERS (Jungle Fighter, Urban Adaptation, Adapted Vehicle)
 *   - rough-terrain.mjs ROUGH_TERRAIN_IMPOSERS (Misguide)
 *   - environment-hazards.mjs ENVIRONMENT_PROTECTORS (Weather Gear, Acclimating)
 * Heavy modules (environment, environmental-expertise, action-economy, grants, combat...) are loaded
 * with dynamic import - see `deps` below - so this file never joins an import cycle.
 */

const uuid = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;
export const S1 = {
  layeredArmor: uuid('jump_through_time', 'GUppwd5R2bSVaKVO'),
  spacewalker: uuid('across_the_stars', 'OasmncqkxGO3QCXv'),
  environmentalWarrior: uuid('beneath_the_helmet', 'bxnYVraaRNaXRy9Y'),
  misguide: uuid('cobra_codex', 'IaxNOucyCcF6QDU1'),
  urbanAdaptation: uuid('cobra_codex', 'zdCIZOr6JOPGKUmL'),
  urbanJungle: uuid('cobra_codex', 'wIesQd7U5W2azAWY'),
  fastTracking: uuid('decepticon_directive', '9DMDz10v4IJ75MZQ'),
  earthDefenseCommand: uuid('field_guide_action_adventure', 'uQQbRbwADVtVwsym'),
  acclimating: uuid('gi_joe_crb', 'HSmtPttbJvaNy5Tf'),
  adaptedVehicle: uuid('gi_joe_crb', 'ht26M90320SgdhMK'),
  ambushMaster: uuid('gi_joe_crb', 'UYaPTaAQH5SDXxnz'),
  dangerSense: uuid('gi_joe_crb', '2hwFRZ67xIGt1XTm'),
  ghost: uuid('gi_joe_crb', 'MKK6kj54yVmCliPd'),
  weatherGear: uuid('gi_joe_crb', 'toav8R7TF92WnQ8G'),
  weatherproof: uuid('gi_joe_crb', 'Vo0m83m6fHo4BHOY'),
  environmentalExpertise: uuid('gi_joe_crb', 'EbbSUA2vSHyv3MjQ'),
  shotgun: uuid('gi_joe_crb', '2qW1YLopvjKyezNQ'),
  submachineGun: uuid('gi_joe_crb', 'oJInlAgdYZzjH7bk'),
  scubaGear: uuid('gi_joe_crb', 'cZpeYK7VoLJKGKL6'),
  environmentalCamouflage: uuid('ferocious_fighters', 'SyHx2pheoELFpvTF'),
  arashikageShozoku: uuid('intercontinental_adventures', 'TBpflYvZ0lWQ65Cp'),
  izunaDrop: uuid('intercontinental_adventures', 'jaUwQUvv1rXlXQUA'),
  contort: uuid('general_hawk_s_personel_files', 'PPMvpsNSpvUMFwMs'),
  diver: uuid('general_hawk_s_personel_files', 'erZl8Udy03P7vHTe'),
  environmentalEnforcer: uuid('general_hawk_s_personel_files', 'eZuijWvAUzOXD8DR'),
  jungleFighter: uuid('sgt_slaughter_sourcebook', 'RWgIeFdT0c1vIcS1'),
  outOfTheJungle: uuid('sgt_slaughter_sourcebook', '5jc5fjieruLuWQm1'),
};

const FLAG = {
  urbanAdaptation: 's1UrbanAdaptation',
  urbanAdaptationPoints: 's1UrbanAdaptationSpent',
  misguide: 's1Misguided',
  hiding: 's1GhostHiding',
  shozoku: 's1ShozokuInvisible',
  contort: 's1ContortReach',
  inJungle: 's1InJungle',
  environments: 's1Environments',
  environment: 's1Environment',
  inEnvironment: 's1InEnvironmentNow',
  ambushMaster: 's1AmbushMasterUsed',
  diverKit: 's1DiverKit',
  spaceKit: 's1SpaceKit',
};

/* -------------------------------------------- */
/*  Small helpers                                */
/* -------------------------------------------- */

const cap = key => String(key).charAt(0).toUpperCase() + String(key).slice(1);
const T = (key, data) => (data ? game.i18n.format(`E20.${key}`, data) : game.i18n.localize(`E20.${key}`));

export function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource;
}

function listOf(collection) {
  if (Array.isArray(collection?.contents)) {
    return collection.contents;
  }

  if (Array.isArray(collection)) {
    return collection;
  }

  return collection && typeof collection[Symbol.iterator] == 'function' ? [...collection] : [];
}

const itemsOf = actor => listOf(actor?.items);

export function findSourced(actor, id) {
  return id ? itemsOf(actor).find(item => sourceOf(item) == id) ?? null : null;
}

const has = (actor, id) => !!findSourced(actor, id);

function itemById(actor, id) {
  return id ? (actor?.items?.get?.(id) ?? itemsOf(actor).find(item => item.id == id) ?? null) : null;
}

/** The weapon a weaponEffect belongs to. */
function parentWeaponOf(actor, item) {
  return item?.type == 'weaponEffect' ? itemById(actor, item.flags?.essence20?.parentId) : null;
}

/** Upgrades of a given compendium entry attached to a weapon/armor Item. */
function upgradesOn(actor, parent, id) {
  if (!parent) {
    return [];
  }

  const sameId = item => sourceOf(item) == id || (id == S1.weatherproof && String(sourceOf(item) ?? '').endsWith('.Item.Vo0m83m6fHo4BHOY'));
  return itemsOf(actor).filter(item => item.type == 'upgrade' && item.flags?.essence20?.parentId == parent.id && sameId(item));
}

/** The upgrades of a given entry sitting on armor the actor is wearing, with their armor. */
function wornArmorUpgrades(actor, id) {
  return itemsOf(actor).filter(item => item.type == 'upgrade' && sourceOf(item) == id)
    .map(upgrade => ({ upgrade, armor: itemById(actor, upgrade.flags?.essence20?.parentId) }))
    .filter(({ armor }) => armor?.type == 'armor' && armor.system?.equipped);
}

const isAttackItem = item => item?.type == 'weaponEffect';

/**
 * Environment readers, filled in at setup by loadDeps() from the heavy modules. The defaults mean
 * "nothing known" so a roll made before they load, or in a unit test, simply gets no bonus.
 */
export const deps = {
  getEnvironment: () => 'normal',
  getTerrain: () => null,
  isInEnvironmentOfExpertise: () => null,
  isEnvironmentalExpertiseActive: () => false,
  getLedger: () => null,
};

function environmentOf(actor, options) {
  try {
    return deps.getEnvironment(actor, options) || 'normal';
  } catch (error) {
    return 'normal';
  }
}

function terrainOf(actor) {
  try {
    return deps.getTerrain(actor) || null;
  } catch (error) {
    return null;
  }
}

function combatStamp() {
  const combat = game.combat;
  return combat ? { combatId: combat.id, round: combat.round, turn: combat.turn } : null;
}

function isStampNow(stamp) {
  const combat = game.combat;
  return !!stamp && !!combat && stamp.combatId == combat.id && stamp.round == combat.round && stamp.turn == combat.turn;
}

/** Writes a flag on an actor this user may not own, through the GM relay when needed. */
async function writeFlag(doc, key, value) {
  const { needsGmRelay, relayToGm } = await import("../../gm-relay.mjs");
  if (needsGmRelay(doc)) {
    return relayToGm(doc, value === null ? 'unsetFlag' : 'setFlag', value === null ? ['essence20', key] : ['essence20', key, value]);
  }

  return value === null ? doc.unsetFlag('essence20', key) : doc.setFlag('essence20', key, value);
}

/** The vehicle this actor is crewing, and in what role (vehicle-upgrades.mjs#getCrewedVehicle). */
function crewedVehicleOf(actor) {
  if (!actor?.uuid) {
    return null;
  }

  for (const vehicle of worldActors()) {
    if (vehicle?.type != 'vehicle') {
      continue;
    }

    const entry = Object.values(vehicle.system?.actors ?? {}).find(crew => crew?.uuid == actor.uuid);
    if (entry) {
      return { vehicle, role: entry.vehicleRole ?? 'passenger' };
    }
  }

  return null;
}

/* -------------------------------------------- */
/*  Where are we?                                */
/* -------------------------------------------- */

/**
 * Jungle Fighter (Sgt Slaughter Sourcebook, Marauder, 3rd level, p.14): "when in a jungle, you
 * gain the following benefits: You ignore the penalties for moving through Rough Terrain. You gain
 * an Edge on non-Attack Skill Tests, and all your Attacks are considered Specialized. Additionally,
 * in the jungle, treat Light Armor as if it had the silent battledress upgrade."
 * Out of the Jungle (p.14, 20th level): "you gain the benefits of Jungle Fighter even outside of the
 * jungle." Its Edge, Specialized attacks and Rough Terrain are item rules; only the light-armor
 * noise below still reads it.
 *
 * A jungle is the GI Joe CRB's own "Forest or Jungle" biome (p.239) - the `woodlands` terrain. On a
 * scene with no terrain set, the Perk's Use button toggles "in the jungle" by hand.
 */
export function isInJungle(actor) {
  if (!has(actor, S1.jungleFighter)) {
    return false;
  }

  const terrain = terrainOf(actor);
  return terrain ? terrain == 'woodlands' : !!actor.getFlag?.('essence20', FLAG.inJungle);
}

/**
 * Urban Adaptation (Cobra Codex, Citystriker, 10th level, p.68): "you gain a pool of Adaptation
 * Points equal to a Ranger of half your level (rounded up). As a Free action, you can spend an
 * Adaptation Point to use one of your Urban Jungle abilities outside of a city for the remainder of
 * the scene. Adaptation Points replenish after a night's rest."
 *
 * The Ranger's pool (GI Joe CRB p.91, the Adaptation Points role-points item) starts at 0 and gains
 * 1 at levels 2, 4, 7, 10, 13, 16 and 19.
 */
const RANGER_ADAPTATION_LEVELS = [2, 4, 7, 10, 13, 16, 19];
export function urbanAdaptationMax(actor) {
  const level = Math.ceil((Number(actor?.system?.level) || 0) / 2);
  return RANGER_ADAPTATION_LEVELS.filter(at => at <= level).length;
}

export function urbanAdaptationLeft(actor) {
  return Math.max(0, urbanAdaptationMax(actor) - (Number(actor?.getFlag?.('essence20', FLAG.urbanAdaptationPoints)) || 0));
}

/** The Urban Jungle abilities bought outside a city this scene: 'edge' | 'specialized' | 'roughTerrain'. */
export function urbanAdaptationAbilities(actor) {
  if (!has(actor, S1.urbanAdaptation) || terrainOf(actor) == 'urban') {
    return [];
  }

  const record = actor.getFlag?.('essence20', FLAG.urbanAdaptation);
  return record && record.epoch == getSceneEpoch() ? (record.abilities ?? []) : [];
}

/**
 * Adapted Vehicles (GI Joe CRB, Ranger Environmental Exposure, p.91): "Vehicles you drive in your
 * environments of expertise gain the benefits of Environment Expertise." The vehicle's driver (its
 * crew entry with the driver role) must hold this Perk and Environmental Expertise, and the terrain
 * under the VEHICLE's token must be one of the driver's environments of expertise (or, on an
 * untagged scene, the driver's own Environmental Expertise toggle is on).
 */
export function adaptedVehicleDriver(vehicle) {
  if (vehicle?.type != 'vehicle') {
    return null;
  }

  for (const entry of Object.values(vehicle.system?.actors ?? {})) {
    if (entry?.vehicleRole != 'driver' || !entry.uuid) {
      continue;
    }

    const driver = (typeof fromUuidSync == 'function' ? fromUuidSync(entry.uuid) : null)
      ?? worldActors().find(a => a.uuid == entry.uuid);
    if (driver && has(driver, S1.adaptedVehicle) && has(driver, S1.environmentalExpertise)) {
      return driver;
    }
  }

  return null;
}

export function isAdaptedVehicleActive(vehicle) {
  const driver = adaptedVehicleDriver(vehicle);
  if (!driver) {
    return false;
  }

  const terrain = terrainOf(vehicle);
  const inside = terrain ? deps.isInEnvironmentOfExpertise(driver, terrain) : null;
  return inside === true || (inside !== false && !!deps.isEnvironmentalExpertiseActive(driver));
}

/**
 * Environmental Warrior (Beneath the Helmet, Grid Science, p.41): "Whenever you fight in an
 * environment where you have a Survival Specialization, you get ↑1 on all Attack rolls you make."
 * Survival Specializations are free text ("Deserts", "Forests", "Arctic", "Specific Environment"),
 * so each terrain/physical environment is matched by keyword against the actor's own Survival
 * Specialization names. Returns true/false, or null when the scene says nothing at all.
 */
const TERRAIN_WORDS = {
  arctic: ['arctic', 'snow', 'tundra', 'polar', 'ice', 'cold'],
  desert: ['desert', 'sand', 'dune'],
  grasslands: ['grass', 'plain', 'prairie', 'savanna', 'steppe'],
  mountains: ['mountain', 'alpine', 'cliff', 'climb'],
  sea: ['sea', 'ocean', 'aquatic', 'water', 'marine', 'naval', 'coast'],
  urban: ['urban', 'city', 'street'],
  wetlands: ['wetland', 'swamp', 'marsh', 'bog'],
  woodlands: ['wood', 'forest', 'jungle'],
};
const ENVIRONMENT_WORDS = {
  underwater: ['underwater', 'aquatic', 'ocean', 'sea', 'water', 'diving'],
  zeroGravity: ['space', 'zero', 'gravity', 'orbit'],
  lowGravity: ['space', 'gravity', 'lunar', 'moon'],
  vacuum: ['space', 'vacuum', 'void'],
  extremeCold: ['arctic', 'cold', 'snow', 'tundra', 'polar'],
  extremeHeat: ['desert', 'heat', 'volcan'],
};

export function survivalSpecializationMatches(actor) {
  const names = Object.values(actor?.system?.skills?.survival?.specializations ?? {})
    .map(spec => String(spec?.name ?? '').toLowerCase()).filter(Boolean);
  const environment = environmentOf(actor);
  const terrain = terrainOf(actor);
  const words = [...(TERRAIN_WORDS[terrain] ?? []), ...(ENVIRONMENT_WORDS[environment] ?? [])];
  if (!words.length) {
    return null;
  }

  return names.some(name => words.some(word => name.includes(word)));
}

/* -------------------------------------------- */
/*  Roll sources                                 */
/* -------------------------------------------- */

const WEATHERPROOF_ENVIRONMENTS = ['underwater', 'lowGravity', 'zeroGravity', 'vacuum', 'normal'];

/**
 * Weatherproof (GI Joe CRB, weapon upgrade, p.149): "The weapon ignores the penalties for use in a
 * chosen environment." Each environment penalty dice.mjs's own "Environment" block gives a weapon is
 * handed back as its own source: a Snag is cancelled by an Edge (Edge and Snag cancel in this
 * system), a ↓ by an equal ↑.
 */
export function weatherproofSources(actor, item) {
  const weapon = parentWeaponOf(actor, item);
  const upgrade = upgradesOn(actor, weapon, S1.weatherproof)[0];
  const chosen = upgrade?.getFlag?.('essence20', FLAG.environment) ?? upgrade?.flags?.essence20?.[FLAG.environment];
  if (!upgrade || !chosen) {
    return [];
  }

  const environment = environmentOf(actor);
  if (environment != chosen) {
    return [];
  }

  const traits = weapon.system?.traits ?? [];
  const ranged = item.system?.classification?.style != 'melee';
  const label = `${upgrade.name} (${T(`S1Env${cap(chosen)}`)})`;
  const out = [];
  if (ranged && !traits.includes('inertial')) {
    if (environment == 'lowGravity' && traits.includes('ballistic')) {
      out.push({ id: 'weatherproofLowG', label, edge: true });
    }

    if (environment == 'zeroGravity' && !traits.includes('energy') && item.system?.damageType != 'laser') {
      out.push({ id: 'weatherproofZeroG', label, edge: true });
    }

    if (environment == 'vacuum') {
      out.push({ id: 'weatherproofVacuum', label, edge: true });
    }
  }

  if (environment == 'underwater') {
    const waterproof = traits.includes('amphibious') || traits.includes('aquatic');
    if (!waterproof && (ranged || !(actor.system?.movement?.swim?.total > 0))) {
      out.push({ id: 'weatherproofUnderwater', label, edge: true });
    }

    if (item.system?.damageType == 'fire') {
      out.push({ id: 'weatherproofUnderwaterFire', label, shiftUp: 2 });
    }
  }

  if (environment == 'normal' && traits.includes('aquatic') && !traits.includes('amphibious')) {
    out.push({ id: 'weatherproofAquaticOnLand', label, shiftUp: 3 });
  }

  return out;
}

/**
 * Silent battledress (GI Joe CRB, Battledress Traits): "Anyone making an Infiltration Skill Test
 * while wearing battledress without the Silent trait does so with a penalty equal to its total
 * bonus" (weapon-traits.mjs#noisyArmorPenalty). Jungle Fighter treats Light Armor as Silent in the
 * jungle, so the penalty the light armor added is handed back.
 */
export function lightArmorNoise(actor) {
  return itemsOf(actor).filter(item => item.type == 'armor' && item.system?.equipped && !item.system?.isPowerArmor
    && item.system?.classification == 'light' && !(item.system?.traits ?? []).includes('silent'))
    .reduce((sum, armor) => sum + (Number(armor.system.totalBonusToughness) || 0) + (Number(armor.system.totalBonusEvasion) || 0), 0);
}

export function situationalRollSources(actor, target, ctx = {}) {
  const { item, rolledSkill } = ctx;
  const isAttack = ctx.isAttack ?? isAttackItem(item);
  const sources = [];
  const add = (id, perk, mods) => sources.push({ id: `s1-${id}`, label: findSourced(actor, perk)?.name ?? perk, ...mods });
  if (!actor) {
    return { sources, consumes: [] };
  }

  // Environmental Warrior - see survivalSpecializationMatches. Untagged scenes get a dialog toggle.
  if (isAttack && has(actor, S1.environmentalWarrior) && survivalSpecializationMatches(actor) === true) {
    add('environmentalWarrior', S1.environmentalWarrior, { shiftUp: 1 });
  }

  // Urban Adaptation - the Urban Jungle Edge bought for this scene outside a city.
  if (!isAttack && urbanAdaptationAbilities(actor).includes('edge')) {
    add('urbanAdaptation', S1.urbanAdaptation, { edge: true });
  }

  // Earth Defense Command Benefits (Field Guide to Action and Adventure, p.69), Space Force: ↑2 on
  // Driving tests piloting a vehicle with Aerial Movement. (The zero-G attack ↑2 is an item rule.)
  if (has(actor, S1.earthDefenseCommand)) {
    const crewed = rolledSkill == 'driving' ? crewedVehicleOf(actor) : null;
    const piloting = actor.type == 'vehicle' ? actor : (crewed?.role == 'driver' ? crewed.vehicle : null);
    const aerial = piloting?.system?.movement?.aerial;
    if (rolledSkill == 'driving' && piloting && ((aerial?.total ?? aerial?.base ?? 0) > 0)) {
      add('spaceForceDriving', S1.earthDefenseCommand, { shiftUp: 2 });
    }
  }

  // Adapted Vehicles: the vehicle gets Environmental Expertise's "Edge on non-combat Skill Tests".
  if (!isAttack && actor.type == 'vehicle' && isAdaptedVehicleActive(actor)) {
    sources.push({ id: 's1-adaptedVehicle', label: findSourced(adaptedVehicleDriver(actor), S1.adaptedVehicle)?.name ?? 'Adapted Vehicles', edge: true });
  }

  // Jungle Fighter - Edge on non-Attack tests (Out of the Jungle's is an item rule); light armor
  // counts as Silent, in the jungle or with Out of the Jungle.
  const inJungle = isInJungle(actor);
  if (inJungle || has(actor, S1.outOfTheJungle)) {
    const perk = has(actor, S1.jungleFighter) ? S1.jungleFighter : S1.outOfTheJungle;
    if (inJungle && !isAttack) {
      add('jungleFighter', perk, { edge: true });
    }

    const noise = rolledSkill == 'infiltration' ? lightArmorNoise(actor) : 0;
    if (noise) {
      add('jungleFighterSilent', perk, { shiftUp: noise });
    }
  }

  // Weatherproof - see weatherproofSources.
  if (isAttack) {
    sources.push(...weatherproofSources(actor, item).map(s => ({ ...s, id: `s1-${s.id}` })));
  }

  // Environmental Enforcer (Hawk's Personnel Files, General Perk, p.174): "You gain an Edge on
  // Attack Skill Tests when taking the Maneuver effect in [a chosen] environment."
  const enforcer = findSourced(actor, S1.environmentalEnforcer);
  if (enforcer && isAttack && (item?.system?.damageType == 'maneuver' || ctx.isShove)) {
    const terrain = terrainOf(actor);
    const chosen = enforcer.flags?.essence20?.[FLAG.environments] ?? [];
    if (terrain && chosen.includes(terrain)) {
      add('environmentalEnforcer', S1.environmentalEnforcer, { edge: true });
    }
  }

  return { sources: sources.map(s => ({ shiftUp: 0, shiftDown: 0, edge: false, snag: false, ...s })), consumes: [] };
}

/* -------------------------------------------- */
/*  Dialog toggles                               */
/* -------------------------------------------- */

/**
 * Fast Tracking (Decepticon Directive, Quake, 10th level, p.47): "any attack action you make with
 * your favorite weapon as part of a Contingency action is made with Edge." Pre-ticked when it looks
 * like one: in combat, not on your own turn, and your last turn set a Contingency (action-economy's
 * ledger log).
 */
export function looksLikeContingency(actor) {
  const combat = game.combat;
  if (!combat || combat.combatant?.actor?.id == actor?.id) {
    return false;
  }

  const ledger = deps.getLedger(actor);
  return !!(ledger?.log ?? []).some(entry => entry?.namedKey == 'contingency');
}

export function situationalToggles(actor, ctx = {}) {
  const { item } = ctx;
  const isAttack = isAttackItem(item);
  const toggles = [];

  if (isAttack && has(actor, S1.fastTracking)) {
    const favorite = getFavoriteWeaponItem(actor);
    if (favorite && parentWeaponOf(actor, item)?.id == favorite.id) {
      toggles.push({ name: 's1FastTracking', label: T('S1FastTrackingToggle'), type: 'checkbox', value: looksLikeContingency(actor) });
    }
  }

  // Environmental Warrior on a scene with no terrain or environment to match against.
  if (isAttack && has(actor, S1.environmentalWarrior) && survivalSpecializationMatches(actor) === null) {
    toggles.push({ name: 's1EnvironmentalWarrior', label: T('S1EnvironmentalWarriorToggle'), type: 'checkbox' });
  }

  // Environmental Enforcer on a scene with no terrain set.
  const enforcer = findSourced(actor, S1.environmentalEnforcer);
  if (enforcer && isAttack && item?.system?.damageType == 'maneuver' && !terrainOf(actor)) {
    toggles.push({ name: 's1EnvironmentalEnforcer', label: T('S1EnvironmentalEnforcerToggle'), type: 'checkbox' });
  }

  // City Slicker's Streetwise switch is a rule on the Perk (terrain:urban, pre-ticked when urban).

  return toggles;
}

/** The ↑/↓ that moves a roll from one skill's die to another's (the Urban Jungle substitution). */
export function skillSwapDelta(actor, fromSkill, toSkill) {
  const list = CONFIG.E20?.skillShiftList ?? [];
  const from = list.indexOf(actor?.system?.skills?.[fromSkill]?.shift);
  const to = list.indexOf(actor?.system?.skills?.[toSkill]?.shift);
  return from >= 0 && to >= 0 ? from - to : 0;
}

export async function situationalApplyDialog(actor, options, ctx = {}) {
  const ext = options.ext ?? {};
  const { rolledSkill, dataset } = ctx;
  if (ext.s1FastTracking || ext.s1EnvironmentalEnforcer) {
    options.edge = true;
  }

  if (ext.s1EnvironmentalWarrior) {
    options.shiftUp = (options.shiftUp ?? 0) + 1;
  }

  // Layered Armor (A Jump Through Time, p.67): "adding a +1 bonus to Persuasion (Leadership) Skill
  // Tests while worn" - a flat +1, the same skillEffectModifierBonus a Skill Effect adds.
  const specKey = String(dataset?.specializationKey ?? '').toLowerCase();
  const specName = String(dataset?.specializationName ?? '').toLowerCase();
  if (rolledSkill == 'persuasion' && (specKey.includes('leadership') || specName.includes('leadership'))
    && itemsOf(actor).some(item => item.type == 'armor' && item.system?.equipped && sourceOf(item) == S1.layeredArmor)) {
    options.skillEffectModifierBonus = Number(options.skillEffectModifierBonus || 0) + 1;
  }
}

/* -------------------------------------------- */
/*  Specialized attacks                          */
/* -------------------------------------------- */

export function situationalSpecializes(actor, skill, item) {
  if (!isAttackItem(item)) {
    return false;
  }

  return isInJungle(actor)
    || urbanAdaptationAbilities(actor).includes('specialized')
    || (actor?.type == 'vehicle' && isAdaptedVehicleActive(actor));
}

/* -------------------------------------------- */
/*  Derived data                                 */
/* -------------------------------------------- */

function addDefense(actor, defense, amount, label) {
  const entry = actor.system?.defenses?.[defense];
  if (!entry || !amount) {
    return;
  }

  entry.total = (Number(entry.total) || 0) + amount;
  entry.string = `${entry.string ?? ''} ${amount < 0 ? '-' : '+'} ${Math.abs(amount)} (${label})`;
}

export function isContortActive(actor) {
  const stamp = actor?.flags?.essence20?.[FLAG.contort];
  return !!stamp && (stamp.manual ? !game.combat : isStampNow(stamp));
}

export function situationalDerived(actor) {
  if (!actor?.system) {
    return;
  }

  // Spacewalker: "While operating as an individual in a low- or zero-gravity environment, you gain
  // +5 to your Evasion Defense."
  const spacewalker = findSourced(actor, S1.spacewalker);
  if (spacewalker && ['lowGravity', 'zeroGravity'].includes(environmentOf(actor, { includeInterior: false }))) {
    addDefense(actor, 'evasion', 5, spacewalker.name);
  }

  // Environmental Camouflage (Ferocious Fighters, battledress upgrade, p.36): "Choose an environment
  // from those listed in the Ranger's Environmental Expertise Role Perk... In this environment, apply
  // your Battledress's armor effect to Evasion and Toughness." Mirrors actor.mjs's own itemArmorBonus
  // (player characters, not while Morphed, Power Armor excluded).
  if (actor.type == 'playerCharacter' && !actor.system.isMorphed) {
    for (const { upgrade, armor } of wornArmorUpgrades(actor, S1.environmentalCamouflage)) {
      const chosen = upgrade.flags?.essence20?.[FLAG.environment];
      const terrain = chosen ? terrainOf(actor) : null;
      const inside = terrain ? terrain == chosen : !!upgrade.flags?.essence20?.[FLAG.inEnvironment];
      if (!chosen || !inside || armor.system?.isPowerArmor) {
        continue;
      }

      addDefense(actor, 'evasion', Number(armor.system.totalBonusToughness) || 0, upgrade.name);
      addDefense(actor, 'toughness', Number(armor.system.totalBonusEvasion) || 0, upgrade.name);
    }
  }

  // Contort (Hawk's Personnel Files, General Perk, p.174): "As a Move action or 2 Free actions, you
  // can double your Reach until the end of your turn." Same totalReach pipeline Extended Attack uses,
  // not stacking past a single doubling.
  if (isContortActive(actor)) {
    const reach = CONFIG.E20?.actorReach?.[actor.system.size] ?? 5;
    for (const effect of itemsOf(actor)) {
      if (effect.type != 'weaponEffect' || effect.system?.classification?.style != 'melee') {
        continue;
      }

      const multiplier = effect.system.range?.reachMultiplier > 1 ? effect.system.range.reachMultiplier : 1;
      effect.system.totalReach = Math.max(Number(effect.system.totalReach) || 0, reach * multiplier * 2);
    }
  }
}

/* -------------------------------------------- */
/*  Movement and environment hooks (patched)     */
/* -------------------------------------------- */

/** ROUGH_TERRAIN_IGNORERS entry. */
export function ignoresRoughTerrainS1(actor) {
  return isInJungle(actor)
    || urbanAdaptationAbilities(actor).includes('roughTerrain')
    || (actor?.type == 'vehicle' && isAdaptedVehicleActive(actor));
}

/**
 * Misguide (Cobra Codex, Ranger Be Ruthless Perk, p.57): "You can spend a Story Point on another
 * creature's turn in your environment of expertise to penalize their movement as though they were
 * moving through Rough Terrain for that turn." ROUGH_TERRAIN_IMPOSERS entry.
 */
export function isMisguided(actor) {
  const stamp = actor?.flags?.essence20?.[FLAG.misguide];
  return isStampNow(stamp);
}

export function imposesRoughTerrainS1(tokenDoc) {
  return isMisguided(tokenDoc?.actor);
}

/**
 * ENVIRONMENT_PROTECTORS entry - Weather Gear (GI Joe CRB, battledress upgrade, p.156): "Choose an
 * environment. Ignore the penalties for wearing inappropriate attire in the chosen environment."
 * Acclimating (p.156): "Ignore the penalties for wearing inappropriate attire in your current
 * environment." Attire is what you wear against the weather, so these cover the temperature hazards
 * (Extreme Cold/Heat's Impaired and damage - helpers/environment-hazards.mjs), and only while the
 * battledress carrying them is worn.
 */
export function attireProtection(actor, environment, hazard) {
  if (hazard?.category != 'temperature') {
    return null;
  }

  const acclimating = wornArmorUpgrades(actor, S1.acclimating)[0];
  if (acclimating) {
    return acclimating.upgrade.name;
  }

  const gear = wornArmorUpgrades(actor, S1.weatherGear).find(({ upgrade }) => upgrade.flags?.essence20?.[FLAG.environment] == environment);
  return gear?.upgrade.name ?? null;
}

/* -------------------------------------------- */
/*  Surprise                                     */
/* -------------------------------------------- */

/**
 * Danger Sense (GI Joe CRB, Bodyguard, 6th level, p.110): "You can't be Surprised, and your
 * Protected Target is also immune to surprise as long as they are within 10 feet of you."
 * The holder's own immunity is a ConditionImmunity item rule; this is the Protected Target half.
 */
export function surpriseImmunitySource(actor) {
  let near = [];
  try {
    near = getNearbyAllyTokens(actor, 10) ?? [];
  } catch (error) {
    near = [];
  }

  for (const token of near) {
    const bodyguard = token.actor;
    if (bodyguard && has(bodyguard, S1.dangerSense) && actor?.uuid && getProtectedTargetUuid(bodyguard) == actor.uuid) {
      return `${findSourced(bodyguard, S1.dangerSense)?.name} (${bodyguard.name})`;
    }
  }

  return null;
}

export function onPreCreateEffect(effect) {
  const actor = effect?.parent;
  if (!actor || actor.documentName != 'Actor' || ![...(effect.statuses ?? [])].includes('surprised')) {
    return true;
  }

  const source = surpriseImmunitySource(actor);
  if (!source) {
    return true;
  }

  ui.notifications?.warn(T('S1SurpriseImmune', { actor: actor.name, source }));
  return false;
}

/* -------------------------------------------- */
/*  Use buttons                                  */
/* -------------------------------------------- */

async function grants() {
  return import("../../grants.mjs");
}

/** Environment choosers stored on the item itself. */
async function chooseTerrains(item, max) {
  const env = CONFIG.E20?.environments ?? {};
  const current = item.flags?.essence20?.[FLAG.environments] ?? [];
  const boxes = Object.entries(env).map(([key, label]) => `<label class="checkbox"><input type="checkbox" name="${key}" ${current.includes(key) ? 'checked' : ''}/> ${game.i18n.localize(label)}</label>`).join('<br>');
  const picked = await foundry.applications.api.DialogV2.wait({
    window: { title: item.name },
    classes: ["window-app", "e20-window"],
    content: `<p>${T('S1ChooseEnvironments', { max })}</p><div class="form-group">${boxes}</div>`,
    buttons: [
      { action: 'ok', label: T('DialogConfirmButton'), default: true,
        callback: (event, button) => Object.keys(env).filter(key => button.form.elements[key]?.checked) },
      { action: 'cancel', label: T('DialogCancelButton') },
    ],
    rejectClose: false,
  });
  if (!Array.isArray(picked)) {
    return null;
  }

  const chosen = picked.slice(0, max);
  await item.setFlag('essence20', FLAG.environments, chosen);
  return chosen;
}

async function chooseOne(item, keys, labelOf) {
  const { chooseSelect } = await grants();
  const value = await chooseSelect(item.name, T('S1ChooseEnvironment'), keys.map(key => ({ value: key, label: labelOf(key) })));
  if (value) {
    await item.setFlag('essence20', FLAG.environment, value);
  }

  return value;
}

const terrainLabel = key => game.i18n.localize(CONFIG.E20?.environments?.[key] ?? key);

export function survivalRanks(actor) {
  const list = CONFIG.E20?.skillShiftList ?? [];
  const index = list.indexOf(actor?.system?.skills?.survival?.shift);
  const untrained = list.indexOf('d20');
  return index >= 0 && untrained >= 0 ? Math.max(0, untrained - index) : 0;
}

function enemySurprised(actor) {
  const combat = game.combat;
  if (!combat) {
    return false;
  }

  const mine = listOf(combat.combatants).find(c => c.actor?.id == actor.id)?.token?.disposition;
  return listOf(combat.combatants).some(c => c.actor && c.actor.id != actor.id && c.actor.statuses?.has?.('surprised')
    && (mine === undefined || c.token?.disposition !== mine));
}

const USES = [
  {
    // Misguide - see isMisguided. Target the creature whose turn it is (or target a token).
    id: 's1-misguide',
    matches: item => sourceOf(item) == S1.misguide,
    canUse: () => !!game.combat,
    run: async (item) => {
      const actor = item.parent;
      if (deps.isInEnvironmentOfExpertise(actor) === false && !deps.isEnvironmentalExpertiseActive(actor)) {
        ui.notifications.warn(T('S1NotInEnvironmentOfExpertise'));
        return null;
      }

      const target = game.user?.targets?.first?.()?.actor ?? game.combat?.combatant?.actor;
      if (!target || target.id == actor.id) {
        ui.notifications.warn(T('S1MisguideNoTarget'));
        return null;
      }

      const { canSpendForActor, spendForActor } = await import("../../story-points.mjs");
      if (!canSpendForActor(actor)) {
        ui.notifications.warn(T('S1NoStoryPoint'));
        return null;
      }

      await spendForActor(actor, 1, { announce: false });
      const onTheirTurn = game.combat.combatant?.actor?.id == target.id;
      await writeFlag(target, FLAG.misguide, onTheirTurn ? combatStamp() : { combatId: game.combat.id, pending: true });
      return T('S1MisguideUsed', { actor: actor.name, target: target.name });
    },
  },
  {
    // Urban Adaptation - spend a point (Free action), pick which Urban Jungle ability to take out of
    // the city for the rest of the scene.
    id: 's1-urbanAdaptation',
    matches: item => sourceOf(item) == S1.urbanAdaptation,
    canUse: item => urbanAdaptationLeft(item.parent) > 0,
    run: async (item, economy, pay) => {
      const actor = item.parent;
      const { chooseButtons } = await grants();
      const record = actor.getFlag('essence20', FLAG.urbanAdaptation);
      const owned = record?.epoch == getSceneEpoch() ? (record.abilities ?? []) : [];
      const choices = ['edge', 'specialized', 'roughTerrain'].filter(key => !owned.includes(key))
        .map(key => [key, T(`S1UrbanAbility${cap(key)}`)]);
      const ability = choices.length ? await chooseButtons(item.name, T('S1UrbanAdaptationPrompt'), choices) : null;
      if (!ability || !(await pay('free'))) {
        return null;
      }

      await actor.setFlag('essence20', FLAG.urbanAdaptation, { epoch: getSceneEpoch(), abilities: [...owned, ability] });
      await actor.setFlag('essence20', FLAG.urbanAdaptationPoints, (Number(actor.getFlag('essence20', FLAG.urbanAdaptationPoints)) || 0) + 1);
      return T('S1UrbanAdaptationUsed', { actor: actor.name, ability: T(`S1UrbanAbility${cap(ability)}`), left: urbanAdaptationLeft(actor) });
    },
  },
  {
    // Ambush Master (GI Joe CRB, Door-Kicker, 10th level, p.99): "when you surprise an enemy, you
    // gain one extra attack with a shotgun or submachine gun." Once per combat, while an enemy is
    // Surprised; the extra attack is action-economy's bonus attack (costs no action).
    id: 's1-ambushMaster',
    matches: item => sourceOf(item) == S1.ambushMaster,
    canUse: item => {
      const actor = item.parent;
      return !!game.combat && !hasUsedThisEncounter(actor, FLAG.ambushMaster) && enemySurprised(actor)
        && itemsOf(actor).some(weapon => weapon.type == 'weapon' && [S1.shotgun, S1.submachineGun].includes(sourceOf(weapon)));
    },
    run: async (item) => {
      const actor = item.parent;
      const { grantBonusAttack } = await import("../../action-economy.mjs");
      await grantBonusAttack(actor, { source: item.name, cost: 'none' });
      await markUsedThisEncounter(actor, FLAG.ambushMaster);
      return T('S1AmbushMasterUsed', { actor: actor.name });
    },
  },
  {
    // Ghost (GI Joe CRB, Commando, 9th level, p.73): "when you are hiding, you are considered
    // invisible to natural senses." The Use button is "I'm hiding" / "I'm not": while hiding the
    // actor carries the Invisible Condition (Edge on its attacks, Snag on attacks against it).
    id: 's1-ghost',
    matches: item => sourceOf(item) == S1.ghost,
    run: async (item) => {
      const actor = item.parent;
      const hiding = !actor.getFlag('essence20', FLAG.hiding);
      await actor.setFlag('essence20', FLAG.hiding, hiding);
      await actor.toggleStatusEffect('invisible', { active: hiding });
      return T(hiding ? 'S1GhostHiding' : 'S1GhostRevealed', { actor: actor.name });
    },
  },
  {
    // Arashikage Shozoku (Intercontinental Adventures, battledress upgrade, p.29): "When in dim light
    // or darkness, the wearer can spend a Free action to make a DIF 20 Infiltration Skill Test,
    // becoming invisible to natural eyesight until the beginning of their next turn on a success.
    // This effect ends if you take damage or are exposed to bright light." The light level is the
    // player's call; the turn start and damage endings are automatic (below).
    id: 's1-arashikage',
    matches: item => sourceOf(item) == S1.arashikageShozoku,
    canUse: item => wornArmorUpgrades(item.parent, S1.arashikageShozoku).length > 0,
    run: async (item, economy, pay) => {
      const actor = item.parent;
      if (!(await pay('free'))) {
        return null;
      }

      const { rollTest } = await grants();
      const { success } = await rollTest(actor, 'infiltration', 20);
      if (!success) {
        return T('S1ShozokuFailed', { actor: actor.name });
      }

      await actor.setFlag('essence20', FLAG.shozoku, combatStamp() ?? { manual: true });
      await actor.toggleStatusEffect('invisible', { active: true });
      return T('S1ShozokuInvisible', { actor: actor.name });
    },
  },
  {
    // Contort - pay a Move action or 2 Free actions, doubled Reach for the rest of the turn.
    id: 's1-contort',
    matches: item => sourceOf(item) == S1.contort,
    run: async (item, economy, pay) => {
      const actor = item.parent;
      if (isContortActive(actor)) {
        await actor.unsetFlag('essence20', FLAG.contort);
        return T('S1ContortEnded', { actor: actor.name });
      }

      if (game.combat) {
        const { chooseButtons } = await grants();
        const how = await chooseButtons(item.name, T('S1ContortPrompt'), [['move', T('S1ContortMove')], ['free', T('S1ContortFree')]]);
        if (!how) {
          return null;
        }

        const paid = how == 'move' ? await pay('move') : (await pay('free')) && (await pay('free'));
        if (!paid) {
          return null;
        }
      }

      await actor.setFlag('essence20', FLAG.contort, combatStamp() ?? { manual: true });
      return T('S1ContortUsed', { actor: actor.name });
    },
  },
  {
    // Izuna Drop - see izunaDrop below.
    id: 's1-izunaDrop',
    matches: item => sourceOf(item) == S1.izunaDrop,
    run: async (item, economy, pay) => izunaDrop(item, pay),
  },
  {
    // Diver: "You gain a Limited Athletics (Swimming) kit and scuba gear during the Equipment
    // Assignment and Requisition phase" - once per mission.
    id: 's1-diver',
    matches: item => sourceOf(item) == S1.diver,
    canUse: item => getUses(item.parent, FLAG.diverKit, 'mission') < 1,
    run: async (item) => {
      const actor = item.parent;
      const { makeKit } = await import("../../kits.mjs");
      const { grantCopy } = await grants();
      await makeKit(actor, item, 'limited', 'athletics', 'Swimming');
      await grantCopy(actor, S1.scubaGear, { grantedBy: item.id });
      await markUsed(actor, FLAG.diverKit, { window: 'mission' });
      return T('S1DiverKit', { actor: actor.name });
    },
  },
  {
    // Earth Defense Command, Space Kit: "During Equipment Requisition, you receive a free Limited Kit
    // tied to a Driving, Culture, Science, or Technology Specialization." Once per mission.
    id: 's1-spaceKit',
    matches: item => sourceOf(item) == S1.earthDefenseCommand,
    canUse: item => getUses(item.parent, FLAG.spaceKit, 'mission') < 1,
    run: async (item) => {
      const actor = item.parent;
      const { chooseSelect } = await grants();
      const specs = [];
      for (const skill of ['driving', 'culture', 'science', 'technology']) {
        for (const spec of Object.values(actor.system?.skills?.[skill]?.specializations ?? {})) {
          if (spec?.name) {
            specs.push({ value: `${skill}|${spec.name}`, label: `${game.i18n.localize(CONFIG.E20?.skills?.[skill] ?? skill)} (${spec.name})` });
          }
        }
      }

      if (!specs.length) {
        ui.notifications.warn(T('S1SpaceKitNoSpec'));
        return null;
      }

      const picked = await chooseSelect(item.name, T('S1SpaceKitPrompt'), specs);
      if (!picked) {
        return null;
      }

      const [skill, spec] = picked.split('|');
      const { makeKit } = await import("../../kits.mjs");
      await makeKit(actor, item, 'limited', skill, spec);
      await markUsed(actor, FLAG.spaceKit, { window: 'mission' });
      return T('S1SpaceKit', { actor: actor.name, spec: `${skill} (${spec})` });
    },
  },
  {
    // Environmental Enforcer: "For each Skill Rank you have in Survival, choose an environment."
    id: 's1-environmentalEnforcer',
    matches: item => sourceOf(item) == S1.environmentalEnforcer,
    run: async (item) => {
      const chosen = await chooseTerrains(item, Math.max(1, survivalRanks(item.parent)));
      return chosen ? T('S1EnvironmentsChosen', { item: item.name, list: chosen.map(terrainLabel).join(', ') || '-' }) : null;
    },
  },
  {
    // Environmental Camouflage - choose the environment; on an untagged scene, say you're in it.
    id: 's1-environmentalCamouflage',
    matches: item => sourceOf(item) == S1.environmentalCamouflage,
    run: async (item) => {
      const chosen = item.flags?.essence20?.[FLAG.environment];
      if (chosen && !terrainOf(item.parent)) {
        const { chooseButtons } = await grants();
        const what = await chooseButtons(item.name, T('S1CamouflagePrompt'), [['toggle', T('S1CamouflageToggle')], ['choose', T('S1ChooseEnvironment')]]);
        if (what == 'toggle') {
          const now = !item.flags?.essence20?.[FLAG.inEnvironment];
          await item.setFlag('essence20', FLAG.inEnvironment, now);
          return T(now ? 'S1CamouflageOn' : 'S1CamouflageOff', { item: item.name, environment: terrainLabel(chosen) });
        }

        if (what != 'choose') {
          return null;
        }
      }

      const value = await chooseOne(item, Object.keys(CONFIG.E20?.environments ?? {}), terrainLabel);
      return value ? T('S1EnvironmentsChosen', { item: item.name, list: terrainLabel(value) }) : null;
    },
  },
  {
    // Weather Gear - the temperature environment the gear is made for.
    id: 's1-weatherGear',
    matches: item => sourceOf(item) == S1.weatherGear,
    run: async (item) => {
      const value = await chooseOne(item, ['extremeCold', 'extremeHeat'], key => T(`S1Env${cap(key)}`));
      return value ? T('S1EnvironmentsChosen', { item: item.name, list: T(`S1Env${cap(value)}`) }) : null;
    },
  },
  {
    // Weatherproof - the environment the weapon is modified for.
    id: 's1-weatherproof',
    matches: item => String(sourceOf(item) ?? '').endsWith('.Item.Vo0m83m6fHo4BHOY'),
    run: async (item) => {
      const value = await chooseOne(item, WEATHERPROOF_ENVIRONMENTS, key => T(`S1Env${cap(key)}`));
      return value ? T('S1EnvironmentsChosen', { item: item.name, list: T(`S1Env${cap(value)}`) }) : null;
    },
  },
  {
    // Jungle Fighter on a scene with no terrain set - "I'm in the jungle".
    id: 's1-jungleFighter',
    matches: item => sourceOf(item) == S1.jungleFighter,
    canUse: item => !terrainOf(item.parent),
    run: async (item) => {
      const actor = item.parent;
      const now = !actor.getFlag('essence20', FLAG.inJungle);
      await actor.setFlag('essence20', FLAG.inJungle, now);
      return T(now ? 'S1JungleOn' : 'S1JungleOff', { actor: actor.name });
    },
  },
];

/**
 * Izuna Drop (Intercontinental Adventures, General Perk, p.30): "If you are falling and an enemy is
 * within 10 feet of you, you can propel yourself towards them and attempt to Grapple them as a Free
 * action. On a success, you maneuver your target into a position beneath you, landing on top of them
 * at the end of your fall. Your target takes all the damage from the fall that you would have taken,
 * but if the fall damage exceeds their Health and renders them Defeated, you take the remaining
 * damage." Falling (GI Joe CRB p.222): "1 damage for every 10 feet it fell, to a maximum of 20
 * damage. The creature lands prone, unless it avoids taking damage from the fall."
 *
 * The Grapple is rolled as the better of Athletics/Acrobatics against the target's Toughness. On a
 * miss the faller simply lands. Damage to a target this user doesn't own goes to the GM as a button.
 */
export function fallDamage(feet) {
  return Math.min(20, Math.floor((Number(feet) || 0) / 10));
}

export function splitIzunaDamage(damage, targetHealth) {
  const absorbed = Math.min(damage, Math.max(0, Number(targetHealth) || 0));
  return { toTarget: damage, overflow: damage - absorbed };
}

async function izunaDrop(item, pay) {
  const actor = item.parent;
  const target = game.user?.targets?.first?.()?.actor;
  if (!target || target.id == actor.id) {
    ui.notifications.warn(T('S1IzunaNoTarget'));
    return null;
  }

  const feet = await foundry.applications.api.DialogV2.wait({
    window: { title: item.name },
    classes: ["window-app", "e20-window"],
    content: `<p>${T('S1IzunaPrompt')}</p><div class="form-group"><input type="number" name="feet" value="30" min="0" step="5"/></div>`,
    buttons: [
      { action: 'ok', label: T('DialogConfirmButton'), default: true, callback: (event, button) => Number(button.form.elements.feet.value) },
      { action: 'cancel', label: T('DialogCancelButton') },
    ],
    rejectClose: false,
  });
  if (typeof feet != 'number' || !(await pay('free'))) {
    return null;
  }

  const damage = fallDamage(feet);
  const skills = actor.system?.skills ?? {};
  const list = CONFIG.E20?.skillShiftList ?? [];
  const better = list.indexOf(skills.acrobatics?.shift) >= 0 && list.indexOf(skills.acrobatics?.shift) < list.indexOf(skills.athletics?.shift)
    ? 'acrobatics' : 'athletics';
  const { rollTest } = await grants();
  const dif = Number(target.system?.defenses?.toughness?.total) || 10;
  const { success } = await rollTest(actor, better, dif);
  const { applyDamage } = await import("../../combat.mjs");

  if (!success) {
    if (damage) {
      await applyDamage(actor, damage, 'blunt');
      await actor.toggleStatusEffect('prone', { active: true });
    }

    return T('S1IzunaMissed', { actor: actor.name, damage });
  }

  const { toTarget, overflow } = splitIzunaDamage(damage, target.system?.health?.value);
  if (target.isOwner) {
    await applyDamage(target, toTarget, 'blunt');
    if (toTarget) {
      await target.toggleStatusEffect('prone', { active: true });
    }
  } else {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p>${T('S1IzunaGmApply', { target: target.name, damage: toTarget })}</p>`
        + `<button type="button" data-e20-ext="s1IzunaDamage" data-target="${target.uuid}" data-damage="${toTarget}">${T('S1IzunaApplyButton')}</button>`,
    });
  }

  if (overflow) {
    await applyDamage(actor, overflow, 'blunt');
  }

  return T('S1IzunaHit', { actor: actor.name, target: target.name, damage: toTarget, overflow });
}

export async function onIzunaButton(message, button) {
  if (!game.user?.isGM) {
    ui.notifications.warn(T('S1GmOnly'));
    return;
  }

  const target = await fromUuid(button.dataset.target);
  const damage = Number(button.dataset.damage) || 0;
  if (!target) {
    return;
  }

  const { applyDamage } = await import("../../combat.mjs");
  await applyDamage(target, damage, 'blunt');
  if (damage) {
    await target.toggleStatusEffect('prone', { active: true });
  }

  button.disabled = true;
}

/* -------------------------------------------- */
/*  Turn, damage and rest housekeeping           */
/* -------------------------------------------- */

export async function situationalTurnStart(actor) {
  // Arashikage Shozoku: "until the beginning of their next turn".
  const shozoku = actor?.flags?.essence20?.[FLAG.shozoku];
  if (shozoku && !isStampNow(shozoku)) {
    await endShozoku(actor);
  }

  // A Misguide set before the creature's turn came up applies to that turn.
  const stamp = actor?.flags?.essence20?.[FLAG.misguide];
  if (stamp?.pending && stamp.combatId == game.combat?.id) {
    await actor.setFlag('essence20', FLAG.misguide, combatStamp());
  }
}

async function endShozoku(actor) {
  await actor.unsetFlag('essence20', FLAG.shozoku);
  if (actor.statuses?.has?.('invisible') && !actor.flags?.essence20?.[FLAG.hiding]) {
    await actor.toggleStatusEffect('invisible', { active: false });
  }
}

export async function situationalAfterDamage(actor, dealt) {
  if (dealt > 0 && actor?.flags?.essence20?.[FLAG.shozoku] && actor.isOwner) {
    await endShozoku(actor);
  }
}

export async function situationalRest(actor) {
  if (actor?.flags?.essence20?.[FLAG.urbanAdaptationPoints]) {
    await actor.unsetFlag('essence20', FLAG.urbanAdaptationPoints);
  }
}

/* -------------------------------------------- */
/*  Registration                                 */
/* -------------------------------------------- */

export async function loadDeps() {
  const environment = await import("../../environment.mjs");
  deps.getEnvironment = (actor, options) => environment.getEnvironment(actor, options);
  deps.getTerrain = actor => environment.getTerrain(actor);
  const expertise = await import("../../environmental-expertise.mjs");
  deps.isInEnvironmentOfExpertise = (actor, terrain) => expertise.isInEnvironmentOfExpertise(actor, ...(terrain === undefined ? [] : [terrain]));
  deps.isEnvironmentalExpertiseActive = expertise.isEnvironmentalExpertiseActive;
  const economy = await import("../../action-economy.mjs");
  deps.getLedger = economy.getLedger;

  // Patched-in hook arrays (SCRATCH/integration/situational1-patch.cjs). Absent until the patch runs.
  const rough = await import("../../rough-terrain.mjs");
  rough.ROUGH_TERRAIN_IGNORERS?.push({ checkFn: ignoresRoughTerrainS1 });
  rough.ROUGH_TERRAIN_IMPOSERS?.push(imposesRoughTerrainS1);
  const hazards = await import("../../environment-hazards.mjs");
  hazards.ENVIRONMENT_PROTECTORS?.push(attireProtection);
}

const TERRAIN_ITEMS = [S1.spacewalker, S1.environmentalCamouflage];

registerRollSources(situationalRollSources);
registerDialogToggles(situationalToggles);
registerApplyDialog(situationalApplyDialog);
registerSpecializes(situationalSpecializes);
registerDerived(situationalDerived);
registerTurnStart(situationalTurnStart);
registerAfterDamage(situationalAfterDamage);
registerRest(situationalRest);
registerChatButton('s1IzunaDamage', onIzunaButton);
USES.forEach(use => registerUse(use));

if (typeof Hooks != 'undefined') {
  Hooks.once('setup', () => {
    loadDeps().catch(error => console.error('Essence20 | situational1 deps failed', error));
  });
  Hooks.on('preCreateActiveEffect', effect => onPreCreateEffect(effect));
  // Spacewalker's Evasion and Environmental Camouflage follow the token into and out of Regions.
  Hooks.on('updateToken', (tokenDoc, changes) => {
    const actor = tokenDoc?.actor;
    if (!changes || !('_regions' in changes) || !TERRAIN_ITEMS.some(id => has(actor, id))) {
      return;
    }

    actor.reset?.();
    if (actor.sheet?.rendered) {
      actor.sheet.render();
    }
  });
}
