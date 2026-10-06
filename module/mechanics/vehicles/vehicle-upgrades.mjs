/**
 * Vehicle Upgrades (Quartermaster's Guide to Gear, p.55-61, and A Jump Through Time p.73) and the
 * vehicle traits that had no rule.
 *
 * A vehicle Upgrade is embedded straight on the Vehicle actor (sheet-handlers/drop-handler.mjs).
 * Until now that is all it did. This file gives each one its effect, in four places:
 *
 * - applyToVehicle(): the vehicle's own derived numbers - Defenses, Movement, passengers, granted
 *   traits. Derived only; the trait selector edits the stored traits (apps/trait-selector.mjs
 *   reads _source), so a granted trait is never saved as a chosen one.
 * - crewSources(): the ↑/↓/Edge a crew member (or the vehicle itself) gets on a roll - Hydraulic
 *   Bounce and Treads in Rough Terrain, Nameplate...
 * - defenderSources(): what an attacker suffers against the vehicle or its occupants - Spiked,
 *   Shielded...
 * - reduceVehicleDamage(): the once-per damage cuts (Active Protection System, Slat and Reactive
 *   Armor), read by chat.mjs#onApplyDamage.
 *
 * Upgrades that are switched on (Afterburners, Electronic Countermeasures, Smokescreen...) are Use
 * buttons - mechanics/actions/action-perks.mjs dispatches them to useVehicleUpgrade() below.
 *
 * Many upgrades are item rules instead (system.rules - granted traits, Armor Plating, Racing Stripes,
 * Stealthy, Ablative Armor, JAFF, Tricked-Out Hydraulics, Camo Netting's switch...), run by module/rules/.
 */

import { getUses, markUsed } from "../resources/scene-clock.mjs";
import { toggleOf } from "../../rules/predicate.mjs";

export const VU = {
  activeProtection: 'EGDb07CgIhbgdQHY',
  afterburners: 'ICqafFtaZbexsl5e',
  antiMatterReactor: 'kOsm7efSfPh531Hm',
  camoNetting: 'S3qPHlomgES5iUNi',
  digitalCamouflage: 'cBMvfhRA1YV3RF4S',
  doubleBarrel: '6xtWfYIm3TE4ArtK',
  ecm: 'oTPW1JHgRPwmZtr8',
  energizedPlating: 'ACEcaBK7pFHqq4RU',
  energyResistant: 'iBB7lV76sz9UpDLx',
  enhancedRadarJamming: '2TuY6npYY0UzYdOm',
  environmentalInsulation: 'SoEnxu66xHXgCJ3y',
  evasiveHandling: 'MRoi8QxW568uiCir',
  flightConversion: 'psJCjvdROy5gEVGS',
  hydraulicBounce: '0yRAH39SEINP3CGT',
  killCounter: 'Uie11vx8RiWMoj4X',
  nameplate: '8VWSF76KXdk2qGpb',
  nitroFuel: '3ZJ8Pqbfhc0JqBPt',
  optimizedSeating: '5LrQ4TGjgWKsomL7',
  radarJammer: 'yVw1WzUd0rGgLab7',
  reactiveArmor: 'LPjz7QL1SVYYFaT1',
  reinforcedFirepoints: '4UX6jvtiroLJefr9',
  robustRam: 'c3vKS59Bynt41oTk',
  selfDestruct: '0xonF9tJvSOcn6Ow',
  shallowDraft: 'Ftm5iA7PG6J3M4aN',
  slashingWings: 'nAiUe1uZs6VzqtQY',
  slatArmor: 'oNhv37mjkiWdKhu2',
  smokescreen: '94NUwERfVYs0Tgmh',
  spiked: 'KVwQulJAxVwEcpBw',
  submarineMode: 'ErSK3LwBT1Wg8rKF',
  targetingSystem: 'TMNBoHPbIxrqzBfG',
  tintedCanopy: 'pmYFN0fUHFIg8u48',
  treads: 'dXx85BLf1RKjn8xg',
  universalComponents: 'tbjQne2zURN6eOtb',
  biotechEnhancer: 'wDMGtOqx1jpltxG9',
};

const MOVEMENT_TYPES = ['ground', 'aerial', 'swim'];
const ELEMENTS = ['acid', 'cold', 'electric', 'emp', 'fire', 'laser', 'sonic'];

function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource ?? '';
}

const idOf = uuid => String(uuid ?? '').split('.').pop();

/**
 * The vehicle upgrades on a vehicle, by id.
 * @param {Actor} vehicle
 * @returns {Map<String, Item>}
 */
export function vehicleUpgrades(vehicle) {
  const map = new Map();
  for (const item of vehicle?.items ?? []) {
    if (item.type == 'upgrade' && item.system?.type == 'vehicle') {
      map.set(idOf(sourceOf(item)), item);
    }
  }

  return map;
}

export function hasVehicleUpgrade(vehicle, id) {
  return vehicleUpgrades(vehicle).has(id);
}

/**
 * The vehicle an actor is crewing, and in what seat.
 * @param {Actor} actor
 * @returns {?{vehicle: Actor, role: String}}
 */
export function getCrewedVehicle(actor) {
  if (!actor?.uuid || !game?.actors) {
    return null;
  }

  const actors = game.actors.contents ?? (typeof game.actors[Symbol.iterator] == 'function' ? [...game.actors] : []);
  for (const vehicle of actors) {
    if (vehicle.type != 'vehicle') {
      continue;
    }

    const entry = Object.values(vehicle.system?.actors ?? {}).find(crew => crew?.uuid == actor.uuid);
    if (entry) {
      return { vehicle, role: entry.vehicleRole ?? 'passenger' };
    }
  }

  return null;
}

function isStampCurrent(stamp) {
  const combat = game?.combat;
  return !!stamp && !!combat && stamp.combatId == combat.id && stamp.round == combat.round && stamp.turn == combat.turn;
}

function isUntilActive(until) {
  const combat = game?.combat;
  return !!until && !!combat && until.combatId == combat.id
    && (combat.round < until.round || (combat.round == until.round && combat.turn < until.turn));
}

/* -------------------------------------------- */
/*  The vehicle's own numbers                   */
/* -------------------------------------------- */

/**
 * Derived Defenses, Movement, passengers and traits for a vehicle's upgrades and switched-on
 * effects. Called from documents/actor.mjs after its Defenses and Movement are prepared.
 * @param {Actor} vehicle
 */
export function applyToVehicle(vehicle) {
  if (vehicle?.type != 'vehicle') {
    return;
  }

  const system = vehicle.system;
  const upgrades = vehicleUpgrades(vehicle);
  const has = id => upgrades.has(id);
  const defense = (key, amount) => {
    if (system.defenses?.[key] && amount) {
      system.defenses[key].total = (system.defenses[key].total ?? 0) + amount;
    }
  };

  // Aerial Interface (Quartermaster's Guide p.27): "You can connect your personal shield generator
  // to an air vehicle you drive. While driving, your personal shield provides its benefits to the
  // entire vehicle."
  const pilotShield = aerialInterfaceShield(vehicle);
  defense('toughness', pilotShield.toughness ?? 0);
  defense('evasion', pilotShield.evasion ?? 0);

  // Electronic Countermeasures: "+5 Toughness and Evasion until the start of their next turn."
  if (isUntilActive(vehicle.getFlag?.('essence20', 'ecmUntil'))) {
    defense('toughness', 5);
    defense('evasion', 5);
  }

  // Biotech Performance Enhancer (A Jump Through Time p.73), switched on for the scene by its Use
  // rule - its "+2 Evasion Defense" is a rule too; the Movement stays below.
  const biotech = isBiotechActive(vehicle);

  // Flight Conversion grants VTOL while it lasts. Upgrades that grant or take away traits outright,
  // and the sealed cabin (system.pressurized), are item rules.
  if (system.traits && isFlightConverted(vehicle) && 'vtol' in system.traits) {
    system.traits.vtol = true;
  }

  // Energy Resistant: "Choose an Element; the vehicle gains Resistance to that damage type."
  const resisted = upgrades.get(VU.energyResistant)?.flags?.essence20?.elementChoice;
  if (resisted && system.resistances && resisted in system.resistances) {
    system.resistances[resisted] = true;
  }

  // Movement.
  const movement = system.movement ?? {};
  const each = fn => {
    for (const type of MOVEMENT_TYPES) {
      const m = movement[type];
      if (m && typeof m.total == 'number') {
        m.total = Math.max(0, fn(m.total, type));
      }
    }
  };

  // Shallow Draft: "Ground Movement equal to its Aquatic Movement." Submarine Mode: "Aquatic
  // Movement (equal to its Ground Movement, or half its Aerial Movement)."
  if (has(VU.shallowDraft) && movement.ground && movement.swim?.total > (movement.ground.total ?? 0)) {
    movement.ground.total = movement.swim.total;
  }

  if (has(VU.submarineMode) && movement.swim && !(movement.swim.total > 0)) {
    movement.swim.total = movement.ground?.total > 0 ? movement.ground.total : Math.floor((movement.aerial?.total ?? 0) / 2);
  }

  // Flight Conversion: "Aerial Movement equal to its Ground or Aquatic Movement" for 3 turns.
  if (isFlightConverted(vehicle) && movement.aerial) {
    movement.aerial.total = Math.max(movement.aerial.total ?? 0, movement.ground?.total ?? 0, movement.swim?.total ?? 0);
  }

  // Nitrogen-Enhanced Rocket Fuel doubles, the Anti-Matter Reactor triples, every Movement rate.
  if (has(VU.nitroFuel)) {
    each(total => total * 2);
  }

  if (has(VU.antiMatterReactor)) {
    each(total => total * 3);
  }

  // Afterburners: "double one of the vehicle's Movement rates" for the turn it's lit.
  const burn = vehicle.getFlag?.('essence20', 'afterburners');
  if (burn && isStampCurrent(burn) && movement[burn.type]) {
    movement[burn.type].total *= 2;
  }

  // Biotech Performance Enhancer: "+20ft Ground Movement. All other Movement type values are
  // increased by 10 feet."
  if (biotech) {
    each((total, type) => (total > 0 ? total + (type == 'ground' ? 20 : 10) : total));
  }

  // Optimized Seating: "decreases every Movement type by 10ft" (the doubled passengers are an item
  // rule). Camo Netting left on (its rule toggle): "-10ft Movement".
  if (has(VU.optimizedSeating)) {
    each(total => (total > 0 ? total - 10 : total));
  }

  if (toggleOf(upgrades.get(VU.camoNetting), 'camo')) {
    each(total => (total > 0 ? total - 10 : total));
  }

  // Evasive Handling: "halve the vehicle's Speed (round down)".
  if (vehicle.getFlag?.('essence20', 'evasiveHandling')) {
    each(total => Math.floor(total / 2));
  }
}

const AERIAL_INTERFACE = 'Compendium.essence20.quartermasters_guide_to_gear.Item.Etogut0TJjvuKC9J';

function aerialInterfaceShield(vehicle) {
  if (!(vehicle.system?.movement?.aerial?.base > 0) && !vehicle.system?.traits?.air) {
    return {};
  }

  for (const entry of Object.values(vehicle.system?.actors ?? {})) {
    if (entry?.vehicleRole != 'driver') {
      continue;
    }

    const driver = globalThis.fromUuidSync?.(entry.uuid);
    if (driver?.items?.some?.(item => sourceOf(item) == AERIAL_INTERFACE)) {
      return driver.system?.activeShieldDefense ?? {};
    }
  }

  return {};
}

function isFlightConverted(vehicle) {
  const flight = vehicle?.getFlag?.('essence20', 'flightConversion');
  const combat = game?.combat;
  return !!flight && (!combat || combat.id != flight.combatId || combat.round < flight.round + 3);
}

function isBiotechActive(vehicle) {
  // Switched on for the scene by its Use rule (setToggle "boost" until the scene ends).
  return !!toggleOf(vehicleUpgrades(vehicle).get(VU.biotechEnhancer), 'boost');
}

/**
 * The Robust Ram / Slashing Wings rider on a vehicle's own Ram or Flyby (1 extra Sharp), and the
 * Biotech Performance Enhancer's "+1 Energy" on its hardpoint weapons. Called from
 * items/attacks/weapon-upgrades.mjs#applyToEffect.
 * @param {Object} system   The effect's derived system data.
 * @param {Actor} vehicle
 * @param {Function} set   Records a derived change.
 */
export function applyToVehicleEffect(system, vehicle, set) {
  if (vehicle?.type != 'vehicle') {
    return;
  }

  const upgrades = vehicleUpgrades(vehicle);
  const extraSharp = (system.isRam && upgrades.has(VU.robustRam)) || (system.isFlyby && upgrades.has(VU.slashingWings));
  if (extraSharp) {
    if (system.damageType == 'sharp') {
      set('damageValue', (system.damageValue ?? 0) + 1);
    } else if (!system.secondaryDamage?.type) {
      set('secondaryDamage.type', 'sharp');
      set('secondaryDamage.value', 1);
    } else if (system.secondaryDamage.type == 'sharp') {
      set('secondaryDamage.value', (system.secondaryDamage.value ?? 0) + 1);
    }
  }

  if (isBiotechActive(vehicle) && !system.isRam && !system.isFlyby && !['stun', 'cover', 'spot'].includes(system.damageType)) {
    set('damageValue', (system.damageValue ?? 0) + 1);
  }
}

/**
 * Traits a vehicle upgrade gives one of the vehicle's weapons: Double-Barrel ("One of the vehicle's
 * weapons gains the Linked trait") and Targeting System ("One of the vehicle's hardpoint weapons
 * gains the Targeting System trait"). The weapon is chosen when the upgrade is attached.
 * @param {Item} weapon
 * @returns {String[]}
 */
export function vehicleWeaponTraits(weapon) {
  const vehicle = weapon?.parent;
  if (vehicle?.type != 'vehicle') {
    return [];
  }

  const add = [];
  const upgrades = vehicleUpgrades(vehicle);
  if (upgrades.get(VU.doubleBarrel)?.flags?.essence20?.weaponId == weapon.id) {
    add.push('linked');
  }

  if (upgrades.get(VU.targetingSystem)?.flags?.essence20?.weaponId == weapon.id) {
    add.push('targetingSystem');
  }

  return add;
}

/**
 * Whether a vehicle weapon is fired with the vehicle's own Targeting rather than its crew member's:
 * "a driver can use this weapon as a Standard action, using the vehicle's Targeting for the Skill
 * Test" (GI Joe CRB p.172, Targeting System).
 */
export function usesVehicleTargeting(vehicle, weapon) {
  return vehicle?.type == 'vehicle' && (!!vehicle.system?.traits?.targetingSystem
    || (weapon?.system?.traits ?? []).includes('targetingSystem'));
}

/* -------------------------------------------- */
/*  Rolls                                       */
/* -------------------------------------------- */

/**
 * The ↑/↓/Edge sources a roll gets from the vehicle its roller is crewing (or is). Each source:
 * {id, label, shiftUp, shiftDown, edge, snag}.
 * @param {Actor} actor       Who is rolling.
 * @param {String} skill      The skill rolled.
 * @param {?Item} item        The weaponEffect or other item rolled, if any.
 * @param {Object} [context]  {inRoughTerrain: Boolean}
 * @returns {Array<Object>}
 */
export function crewSources(actor, skill, item, context = {}) {
  const sources = [];
  const crewed = actor?.type == 'vehicle' ? { vehicle: actor, role: 'self' } : getCrewedVehicle(actor);
  if (!crewed) {
    return sources;
  }

  const { vehicle } = crewed;
  const upgrades = vehicleUpgrades(vehicle);
  const label = id => upgrades.get(id)?.name ?? id;
  const add = (id, mods) => upgrades.has(id) && sources.push({ id, label: label(id), shiftUp: 0, shiftDown: 0, edge: false, snag: false, ...mods });

  // Hydraulic Bounce / Treads: "Edge on Driving Skill Tests ... in Rough Terrain."
  if (skill == 'driving' && context.inRoughTerrain) {
    add(VU.hydraulicBounce, { edge: true });
    add(VU.treads, { edge: true });
  }

  // Nameplate: "Once per day, crew members gain +1 on a single Skill Test made while aboard" - once
  // switched on by its Use button, the next roll aboard takes it.
  if (vehicle.getFlag?.('essence20', 'nameplateReady')) {
    add(VU.nameplate, { shiftUp: 1, consume: 'nameplateReady' });
  }

  // Instrument Array (Across the Stars p.87): "If at least one member of the vehicle's crew dedicates
  // a Free action to scanning the instrument array every turn, the vehicle gains Edge on all
  // Alertness Skill Tests."
  if (skill == 'alertness' && vehicle.system?.traits?.instrumentArray) {
    sources.push({ id: 'instrumentArray', label: game.i18n.localize('E20.VehicleTraitInstrumentArray'), shiftUp: 0, shiftDown: 0, edge: true, snag: false });
  }

  return sources;
}

/**
 * Kill Counter: "Crew can use Driving in place of Intimidation against intelligent creatures who can
 * see the vehicle."
 */
export function canUseDrivingForIntimidation(actor) {
  const crewed = getCrewedVehicle(actor);
  return !!crewed && hasVehicleUpgrade(crewed.vehicle, VU.killCounter);
}

/**
 * What an attacker suffers against a vehicle - or against someone inside one. Each source is the
 * same shape as crewSources'; `once` names a once-per-combat use to spend when the roll is made.
 * @param {Actor} attacker
 * @param {Item} item        The weaponEffect.
 * @param {Actor} target
 * @param {Object} context   {weaponTraits: String[], melee: Boolean, adjacent: Boolean}
 */
export function defenderSources(attacker, item, target, context = {}) {
  const sources = [];
  if (item?.type != 'weaponEffect') {
    return sources;
  }

  const damageType = item.system?.damageType;
  const traits = context.weaponTraits ?? [];

  // An occupant behind a Tinted Canopy: "attacks with the Laser trait against them suffer Snag."
  const aboard = target?.type == 'vehicle' ? null : getCrewedVehicle(target);
  if (aboard && hasVehicleUpgrade(aboard.vehicle, VU.tintedCanopy) && (traits.includes('laser') || damageType == 'laser')) {
    sources.push({ id: 'tintedCanopy', label: vehicleUpgrades(aboard.vehicle).get(VU.tintedCanopy).name, snag: true });
  }

  if (!['vehicle', 'zord'].includes(target?.type)) {
    return sources;
  }

  const upgrades = vehicleUpgrades(target);
  const label = id => upgrades.get(id)?.name ?? id;

  // Spiked: "A melee attacker using Might or Finesse against the vehicle must suffer -1 on the
  // attack or take 1 Sharp damage." The ↓1 is offered; unticked, the attacker takes the Sharp.
  if (upgrades.has(VU.spiked) && context.melee && ['might', 'finesse'].includes(item.system?.classification?.skill)) {
    sources.push({ id: 'spiked', label: label(VU.spiked), shiftDown: 1, declinedDamage: { value: 1, type: 'sharp' } });
  }

  // Energized Plating: "an adjacent attacker must suffer -2 on their attack or take 1 damage of that
  // Element."
  const plating = upgrades.get(VU.energizedPlating);
  if (plating && context.adjacent) {
    sources.push({ id: 'energizedPlating', label: plating.name, shiftDown: 2, declinedDamage: { value: 1, type: plating.flags?.essence20?.elementChoice ?? 'electric' } });
  }

  // Shielded (Across the Stars p.87): "Each turn, the first listed number of Attacks or damaging
  // effects against this vessel suffer a Snag." The number is the vehicle's shieldedRating.
  // Shield Matrix (Across the Stars, Ship Feature, p.104) grants a Zord Shielded - 2, rising with the
  // Feature's own advances.
  const matrix = target.items?.find?.(item => sourceOf(item) == SHIELD_MATRIX);
  const rating = Number(target.system?.shieldedRating) || (target.system?.traits?.shielded ? 1 : 0)
    || (matrix ? Math.max(2, Number(matrix.system?.advances?.currentValue) || 0) : 0);
  if (rating && shieldedHitsThisTurn(target) < rating) {
    sources.push({ id: 'shielded', label: game.i18n.localize('E20.VehicleTraitShielded'), snag: true, countShielded: true });
  }

  return sources;
}

const SHIELD_MATRIX = 'Compendium.essence20.across_the_stars.Item.e200PVV1q6a0Us9n';

function shieldedHitsThisTurn(vehicle) {
  const record = vehicle?.getFlag?.('essence20', 'shieldedHits');
  return record && isStampCurrent(record) ? record.count : 0;
}

/**
 * Spend the once-per-combat sources a roll used, and count a Shielded hit.
 */
export async function spendDefenderSources(target, sources) {
  for (const source of sources) {
    if (source.once) {
      await markUsed(target, source.once);
    }

    if (source.countShielded) {
      const combat = game.combat;
      await target.setFlag('essence20', 'shieldedHits', {
        combatId: combat?.id, round: combat?.round, turn: combat?.turn, count: shieldedHitsThisTurn(target) + 1,
      });
    }
  }
}

/* -------------------------------------------- */
/*  Damage                                      */
/* -------------------------------------------- */

/**
 * Reduce damage the vehicle is about to take: Active Protection System ("Once per mission, reduce
 * damage the vehicle takes from an Explosive weapon to 0"), Slat Armor ("Once per encounter,
 * reduce damage ... from an Explosive weapon by 1"), Reactive Armor ("Once per combat, reduce
 * damage ... from a non-Element weapon by 1"). "Once per mission" uses the Scene Clock's mission
 * window, which refreshes when the GM starts a new mission.
 * @param {Actor} vehicle
 * @param {Number} amount
 * @param {Object} attack   {style, traits, damageType} from the attack's chat card.
 * @returns {Promise<{amount: Number, notes: String[]}>}
 */
export async function reduceVehicleDamage(vehicle, amount, attack = {}) {
  const notes = [];
  if (vehicle?.type != 'vehicle' || !(amount > 0)) {
    return { amount, notes };
  }

  const upgrades = vehicleUpgrades(vehicle);
  const explosive = attack.style == 'explosive';
  const element = ELEMENTS.includes(attack.damageType) || (attack.traits ?? []).some(t => ['acid', 'cold', 'electric', 'electromagnetic', 'fire', 'laser', 'sonic', 'element', 'energy'].includes(t));

  if (explosive && upgrades.has(VU.activeProtection) && getUses(vehicle, 'vehicleAps', 'mission') < 1) {
    await markUsed(vehicle, 'vehicleAps', { window: 'mission' });
    notes.push(upgrades.get(VU.activeProtection).name);
    return { amount: 0, notes };
  }

  if (explosive && upgrades.has(VU.slatArmor) && getUses(vehicle, 'vehicleSlat') < 1) {
    await markUsed(vehicle, 'vehicleSlat');
    amount = Math.max(0, amount - 1);
    notes.push(upgrades.get(VU.slatArmor).name);
  }

  if (!element && upgrades.has(VU.reactiveArmor) && getUses(vehicle, 'vehicleReactive') < 1 && amount > 0) {
    await markUsed(vehicle, 'vehicleReactive');
    amount = Math.max(0, amount - 1);
    notes.push(upgrades.get(VU.reactiveArmor).name);
  }

  return { amount, notes };
}

/**
 * Pressurized Cabin (and Submarine Mode): "The sealed compartment grants immunity to Poison and
 * Disease" - to everyone aboard. Their item rules seal the cabin (system.pressurized).
 */
export function isSealedAboard(actor) {
  const crewed = getCrewedVehicle(actor);
  return !!crewed && !!crewed.vehicle.system?.pressurized;
}

/* -------------------------------------------- */
/*  Use buttons                                 */
/* -------------------------------------------- */

export const VEHICLE_UPGRADE_USES = {
  [VU.afterburners]: { limit: 'encounter' },
  [VU.ecm]: { limit: 'encounter', cost: 'move' },
  [VU.smokescreen]: { limit: 'encounter', cost: 'standard' },
  [VU.evasiveHandling]: { cost: 'free' },
  [VU.flightConversion]: { limit: 'scene' },
  [VU.selfDestruct]: { cost: 'free' },
  [VU.nameplate]: { limit: 'day' },
  [VU.radarJammer]: { cost: 'free' },
  [VU.enhancedRadarJamming]: {},
};

/**
 * How far a vehicle's switched-on jammer reaches, in feet: Radar Jammer (Quartermaster's Guide p.58)
 * "wireless and radio operations within 50ft of the vehicle suffer Snag"; Enhanced Radar Jamming
 * (p.60) "automatically blocks all signals within 100ft, and imposes Snag on signals within 1 mile".
 * target-riders.mjs gives a Technology test inside it a Snag, the same as a carried Jammer.
 * @param {Actor} vehicle
 * @returns {Number}   0 while off.
 */
export function jammingRadiusFeet(vehicle) {
  const jamming = vehicle?.flags?.essence20?.jamming;
  if (!jamming) {
    return 0;
  }

  return jamming >= 100 ? 5280 : Number(jamming) || 0;
}

export function vehicleUpgradeUse(item) {
  return item?.type == 'upgrade' && item.system?.type == 'vehicle' && item.parent?.type == 'vehicle'
    ? VEHICLE_UPGRADE_USES[idOf(sourceOf(item))] ?? null : null;
}

export function canUseVehicleUpgrade(item) {
  const use = vehicleUpgradeUse(item);
  if (!use) {
    return false;
  }

  const vehicle = item.parent;
  const id = idOf(sourceOf(item));
  if (use.limit == 'day') {
    return !vehicle.getFlag?.('essence20', `vehicleUseDay.${id}`);
  }

  return !use.limit || getUses(vehicle, `vehicleUse.${id}`, use.limit) < 1;
}

/**
 * Run a vehicle upgrade's Use button. The one pressing it is the crew member it's for (or the GM);
 * its action cost is spent by the vehicle (mechanics/actions/action-perks.mjs passes {spend}).
 * @returns {Promise<?String>}   The chat line.
 */
export async function useVehicleUpgrade(item, economy) {
  const use = vehicleUpgradeUse(item);
  const vehicle = item?.parent;
  if (!use || !vehicle) {
    return null;
  }

  const id = idOf(sourceOf(item));
  const combat = game.combat;
  const stamp = { combatId: combat?.id ?? null, round: combat?.round ?? 0, turn: combat?.turn ?? 0 };
  const i18n = (key, data) => game.i18n.format(key, { name: vehicle.name, upgrade: item.name, ...data });

  if (use.cost) {
    const paid = await economy.spend(vehicle, use.cost, { source: item.name });
    if (paid.blocked) {
      return null;
    }
  }

  let message;
  switch (id) {
  case VU.afterburners: {
    const types = MOVEMENT_TYPES.filter(type => vehicle.system?.movement?.[type]?.total > 0);
    const type = types.length > 1 ? await pickMovement(item, types) : types[0];
    if (!type) {
      return null;
    }

    await vehicle.setFlag('essence20', 'afterburners', { ...stamp, type });
    message = i18n('E20.VehicleUseAfterburners', { movement: game.i18n.localize(`E20.Movement${type[0].toUpperCase()}${type.slice(1)}`) });
    break;
  }

  case VU.ecm:
    // "until the start of their next turn" - the next time this combatant's turn comes round.
    await vehicle.setFlag('essence20', 'ecmUntil', { combatId: stamp.combatId, round: stamp.round + 1, turn: stamp.turn });
    message = i18n('E20.VehicleUseEcm');
    break;

  case VU.smokescreen: {
    // "surround the vehicle in a 30ft radius of smoke" - Cover for everyone inside it for a turn.
    const { applyTimedCondition } = await import("../combat/timed-status.mjs");
    const token = vehicle.getActiveTokens?.()?.[0];
    const inside = token && canvas?.grid ? canvas.tokens.placeables.filter(other => other.actor
      && canvas.grid.measurePath([token.center, other.center]).distance <= 30) : [];
    for (const other of inside) {
      await applyTimedCondition(other.actor, 'cover', 1);
    }

    message = i18n('E20.VehicleUseSmokescreen', { count: inside.length });
    break;
  }

  case VU.evasiveHandling: {
    // "halve the vehicle's Speed (round down) to force incoming attacks to target its Evasion until
    // the start of the driver's next turn" - the same flag Fly In The Future's evasive maneuvers use.
    const { EVASIVE_MANEUVERS_FLAG } = await import("../../items/vehicles/evasive-maneuvers.mjs");
    const on = !vehicle.getFlag('essence20', 'evasiveHandling');
    await vehicle.setFlag('essence20', 'evasiveHandling', on);
    await vehicle.setFlag('essence20', EVASIVE_MANEUVERS_FLAG, on);
    message = i18n(on ? 'E20.VehicleUseEvasiveOn' : 'E20.VehicleUseEvasiveOff');
    break;
  }

  case VU.flightConversion:
    await vehicle.setFlag('essence20', 'flightConversion', stamp);
    message = i18n('E20.VehicleUseFlight');
    break;

  case VU.selfDestruct:
    // "on their next turn the vehicle is immediately Defeated and explodes" - documents/combat.mjs
    // checks this at every turn start.
    await vehicle.setFlag('essence20', 'selfDestruct', { ...stamp, armedBy: game.user?.character?.uuid ?? null });
    message = i18n('E20.VehicleUseSelfDestruct');
    break;

  case VU.nameplate:
    await vehicle.setFlag('essence20', 'nameplateReady', true);
    await vehicle.setFlag('essence20', `vehicleUseDay.${id}`, true);
    message = i18n('E20.VehicleUseNameplate');
    break;

  case VU.radarJammer:
  case VU.enhancedRadarJamming: {
    const on = !vehicle.getFlag('essence20', 'jamming');
    await vehicle.setFlag('essence20', 'jamming', on ? (id == VU.enhancedRadarJamming ? 100 : 50) : false);
    message = i18n(on ? 'E20.VehicleUseJammingOn' : 'E20.VehicleUseJammingOff');
    break;
  }

  default:
    return null;
  }

  if (use.limit && use.limit != 'day') {
    await markUsed(vehicle, `vehicleUse.${id}`, { window: use.limit });
  }

  return message;
}

async function pickMovement(item, types) {
  return foundry.applications.api.DialogV2.wait({
    window: { title: item.name },
    classes: ["window-app", "e20-window"],
    content: `<p>${game.i18n.localize('E20.VehicleUsePickMovement')}</p>`,
    buttons: types.map(type => ({ action: type, label: game.i18n.localize(`E20.Movement${type[0].toUpperCase()}${type.slice(1)}`) })),
    rejectClose: false,
  });
}

/**
 * A Rest is the new day: Nameplate is available again.
 */
export async function resetDailyVehicleUses(vehicle) {
  if (vehicle?.getFlag?.('essence20', `vehicleUseDay.${VU.nameplate}`)) {
    await vehicle.unsetFlag('essence20', `vehicleUseDay.${VU.nameplate}`);
  }
}

/**
 * At each turn start: an armed Self-Destruct goes off on the arming crew member's next turn - read
 * as the first turn start a round after it was armed.
 * @param {Combat} combat
 */
export async function checkSelfDestruct(combat) {
  if (!game.user?.isActiveGM || !combat) {
    return;
  }

  for (const vehicle of game.actors?.contents ?? []) {
    const armed = vehicle.type == 'vehicle' && vehicle.getFlag?.('essence20', 'selfDestruct');
    if (!armed || armed.combatId != combat.id) {
      continue;
    }

    if (combat.round > armed.round && combat.turn >= armed.turn || combat.round > armed.round + 1) {
      await vehicle.unsetFlag('essence20', 'selfDestruct');
      await vehicle.toggleStatusEffect('defeated', { active: true });
      const { explodeVehicle } = await import("./vehicle-defeat.mjs");
      await explodeVehicle(vehicle);
    }
  }
}

/**
 * The choices a vehicle upgrade asks for when it goes on: the Element for Energy Resistant and
 * Energized Plating, the weapon for Double-Barrel and Targeting System. Stored on its own flags.
 * @param {Item} upgrade
 */
export async function promptVehicleUpgradeChoice(upgrade) {
  const id = idOf(sourceOf(upgrade));
  const vehicle = upgrade.parent;
  let options = null;
  let flag = null;
  if ([VU.energyResistant, VU.energizedPlating].includes(id)) {
    options = ELEMENTS.map(key => ({ value: key, label: game.i18n.localize(CONFIG.E20.damageTypes[key]) }));
    flag = 'elementChoice';
  } else if ([VU.doubleBarrel, VU.targetingSystem].includes(id)) {
    options = (vehicle?.items ?? []).filter(i => i.type == 'weapon').map(i => ({ value: i.id, label: i.name }));
    flag = 'weaponId';
  }

  if (!options?.length) {
    return false;
  }

  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: upgrade.name },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><select name="choice">${options.map(o => `<option value="${o.value}">${foundry.utils.escapeHTML(o.label)}</option>`).join('')}</select></div>`,
    buttons: [
      { action: 'ok', label: game.i18n.localize('E20.DialogConfirmButton'), default: true, callback: (event, button) => button.form.elements.choice.value },
      { action: 'cancel', label: game.i18n.localize('E20.DialogCancelButton') },
    ],
    rejectClose: false,
  });
  if (!choice || choice == 'cancel') {
    return false;
  }

  await upgrade.setFlag('essence20', flag, choice);
  return true;
}
