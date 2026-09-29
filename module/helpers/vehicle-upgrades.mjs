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
 * - crewSources(): the ↑/↓/Edge a crew member (or the vehicle itself) gets on a roll - Racing
 *   Stripes, LIDAR, Onboard GPS, NOD Viewscreens...
 * - defenderSources(): what an attacker suffers against the vehicle or its occupants - Ablative
 *   Armor, Spiked, JAFF, Shielded...
 * - reduceVehicleDamage(): the once-per damage cuts (Active Protection System, Slat and Reactive
 *   Armor), read by chat.mjs#onApplyDamage.
 *
 * Upgrades that are switched on (Afterburners, Electronic Countermeasures, Smokescreen...) are Use
 * buttons - helpers/action-perks.mjs dispatches them to useVehicleUpgrade() below.
 */

import { getSceneEpoch, getUses, markUsed } from "./scene-clock.mjs";

export const VU = {
  ablativeArmor: 'udbXWIic0wOLDXZk',
  activeProtection: 'EGDb07CgIhbgdQHY',
  advancedAutopilot: 'cpoT15OyAncmJzEz',
  afterburners: 'ICqafFtaZbexsl5e',
  allTerrainWheels: 'fX7YCfnYcXSpWGhG',
  antiMatterReactor: 'kOsm7efSfPh531Hm',
  armorPlating: 'zgetOeeka0vBkImO',
  artificialIntelligence: '0E1i8G35dacjogud',
  autopilot: 'iOmrgWu6h9qvP89n',
  camoNetting: 'S3qPHlomgES5iUNi',
  cowcatcher: 'QrrpYF2M89jDng82',
  digitalCamouflage: 'cBMvfhRA1YV3RF4S',
  doubleBarrel: '6xtWfYIm3TE4ArtK',
  earlyWarningAlarm: 'ct0eW3BmVFX9iYTx',
  ecm: 'oTPW1JHgRPwmZtr8',
  emergencySupplies: '7Tn4DVpFisYkXERO',
  energizedPlating: 'ACEcaBK7pFHqq4RU',
  energyResistant: 'iBB7lV76sz9UpDLx',
  enhancedRadarJamming: '2TuY6npYY0UzYdOm',
  enhancedShocks: 'Qw2aKbgTU8Xh3ahV',
  environmentalInsulation: 'SoEnxu66xHXgCJ3y',
  evasiveHandling: 'MRoi8QxW568uiCir',
  flightConversion: 'psJCjvdROy5gEVGS',
  focusModule: '6tjR3T26seuNkDLi',
  hydraulicBounce: '0yRAH39SEINP3CGT',
  integratedComputer: '7XGaJUtxW3NCe8c7',
  interchangeableParts: '1j1vpae13QKgPZGp',
  jaff: 'uGSFdauOqFAjyanF',
  killCounter: 'Uie11vx8RiWMoj4X',
  leadLining: '2twrOiG1nytIYdoj',
  lidar: 'oejdA1Iw5UJB5tVT',
  mhdDrive: '6Drlcw6qu216sTuN',
  nameplate: '8VWSF76KXdk2qGpb',
  nitroFuel: '3ZJ8Pqbfhc0JqBPt',
  nodViewscreens: 'PrQVSgFWjjtZgCH1',
  onboardGps: '2JsjyEOtWTNHpxDl',
  optimizedSeating: '5LrQ4TGjgWKsomL7',
  pressurizedCabin: 'Wlcf4Dm1VXchUvk3',
  racingStripes: 'fFWlwBeGb6aYYtGP',
  radarJammer: 'yVw1WzUd0rGgLab7',
  rapidDeploymentRamps: 'LJFMCkvGlT8q5KtQ',
  reactiveArmor: 'LPjz7QL1SVYYFaT1',
  reactiveShocks: 'xG1l9dETqLG3gQsF',
  redundantBackups: 'MR1ltodbf0bqAVkr',
  reinforcedFirepoints: '4UX6jvtiroLJefr9',
  robustRam: 'c3vKS59Bynt41oTk',
  rollCage: 'XfqPvQDlP1eD3Cmh',
  secondGear: 'iMAUhU8J2rQtLmgC',
  selfDestruct: '0xonF9tJvSOcn6Ow',
  sensorSuite: 'YJfkZpXX5dtsEFKE',
  shallowDraft: 'Ftm5iA7PG6J3M4aN',
  slashingWings: 'nAiUe1uZs6VzqtQY',
  slatArmor: 'oNhv37mjkiWdKhu2',
  smokescreen: '94NUwERfVYs0Tgmh',
  spiked: 'KVwQulJAxVwEcpBw',
  stealthy: 'fsQc0eTmSHzHBFdG',
  submarineMode: 'ErSK3LwBT1Wg8rKF',
  targetingSystem: 'TMNBoHPbIxrqzBfG',
  thrustVectoring: 'KbBCyzCUqPeZUkJJ',
  tintedCanopy: 'pmYFN0fUHFIg8u48',
  titaniumChassis: 'VwPJAu8rlGMw9lBM',
  treads: 'dXx85BLf1RKjn8xg',
  trickedOutHydraulics: 'BwgnU1Nb1NXFNlsx',
  universalComponents: 'tbjQne2zURN6eOtb',
  biotechEnhancer: 'wDMGtOqx1jpltxG9',
};

// Upgrades that grant vehicle traits outright.
const TRAIT_GRANTS = {
  [VU.advancedAutopilot]: ['autopilotAdvanced'],
  [VU.artificialIntelligence]: ['ai', 'computerized'],
  [VU.autopilot]: ['autopilot'],
  [VU.integratedComputer]: ['computerized'],
  [VU.sensorSuite]: ['sensors'],
  [VU.thrustVectoring]: ['vtol'],
  [VU.shallowDraft]: ['amphibious'],
  [VU.rapidDeploymentRamps]: ['rapidDeploymentRamps'],
  [VU.rollCage]: ['rollCage'],
  [VU.treads]: ['treads'],
};

const MOVEMENT_TYPES = ['ground', 'aerial', 'swim'];
const ELEMENTS = ['acid', 'cold', 'electric', 'emp', 'fire', 'laser', 'sonic'];

function sourceOf(item) {
  return item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? '';
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

  // Armor Plating: "+1 Toughness." Enhanced Shocks: "+1 to the vehicle's Evasion."
  defense('toughness', has(VU.armorPlating) ? 1 : 0);
  defense('evasion', has(VU.enhancedShocks) ? 1 : 0);

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

  // Biotech Performance Enhancer (A Jump Through Time p.73): "+2 Evasion Defense" for the scene.
  const biotech = isBiotechActive(vehicle);
  if (biotech) {
    defense('evasion', 2);
  }

  // Granted traits; Lead Lining takes Computerized away ("can no longer be targeted as if it were
  // Computerized").
  if (system.traits) {
    for (const [id, traits] of Object.entries(TRAIT_GRANTS)) {
      if (has(id)) {
        for (const trait of traits) {
          if (trait in system.traits) {
            system.traits[trait] = true;
          }
        }
      }
    }

    if (has(VU.submarineMode) || has(VU.pressurizedCabin)) {
      system.pressurized = true;
    }

    if (isFlightConverted(vehicle) && 'vtol' in system.traits) {
      system.traits.vtol = true;
    }

    if (has(VU.leadLining)) {
      system.traits.computerized = false;
    }
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

  // Optimized Seating: "Doubles the vehicle's non-driver, non-gunner passenger capacity, but
  // decreases every Movement type by 10ft." Camo Netting left on: "-10ft Movement".
  if (has(VU.optimizedSeating)) {
    each(total => (total > 0 ? total - 10 : total));
    if (system.crew) {
      system.crew.numPassengers = (system.crew.numPassengers ?? 0) * 2;
    }
  }

  if (vehicle.getFlag?.('essence20', 'camoNetting')) {
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
  const biotech = vehicle?.getFlag?.('essence20', 'biotechEnhancer');
  return !!biotech && biotech.scene == getSceneEpoch();
}

/**
 * The Robust Ram / Slashing Wings rider on a vehicle's own Ram or Flyby (1 extra Sharp), and the
 * Biotech Performance Enhancer's "+1 Energy" on its hardpoint weapons. Called from
 * helpers/weapon-upgrades.mjs#applyToEffect.
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

  const { vehicle, role } = crewed;
  const upgrades = vehicleUpgrades(vehicle);
  const label = id => upgrades.get(id)?.name ?? id;
  const add = (id, mods) => upgrades.has(id) && sources.push({ id, label: label(id), shiftUp: 0, shiftDown: 0, edge: false, snag: false, ...mods });
  const driving = role == 'driver' || role == 'self';

  // Racing Stripes: "+2 to Initiative Skill Tests."
  if (skill == 'initiative' && driving) {
    add(VU.racingStripes, { shiftUp: 2 });
  }

  // LIDAR Targeting Unit: "+1 to every vehicle weapon system and hardpoint weapon attack."
  if (item?.type == 'weaponEffect' && item.parent?.id == vehicle.id) {
    add(VU.lidar, { shiftUp: 1 });
  }

  // Cowcatcher: "Edge on Ram attacks."
  if (item?.system?.isRam) {
    add(VU.cowcatcher, { edge: true });
  }

  // Hydraulic Bounce / Treads: "Edge on Driving Skill Tests ... in Rough Terrain."
  if (skill == 'driving' && context.inRoughTerrain) {
    add(VU.hydraulicBounce, { edge: true });
    add(VU.treads, { edge: true });
  }

  // Onboard GPS: "Edge on Survival Skill Tests to navigate while the vehicle is moving." Emergency
  // Supplies: "Edge on Science (Medicine) Skill Tests to treat wounds." Both offered on their skill;
  // untick when the test isn't navigation / treating wounds.
  if (skill == 'survival') {
    add(VU.onboardGps, { edge: true });
  }

  if (skill == 'science' || skill == 'medicine') {
    add(VU.emergencySupplies, { edge: true });
  }

  // Interchangeable Parts: "+2 on Skill Tests made to repair or adjust the vehicle."
  if (skill == 'technology') {
    add(VU.interchangeableParts, { shiftUp: 2 });
  }

  // NOD Viewscreens: "-2 on Alertness and -2 on Initiative Skill Tests from the limited field of view."
  if (skill == 'alertness' || skill == 'initiative') {
    add(VU.nodViewscreens, { shiftDown: 2 });
  }

  // Stealthy: ↑1 on Infiltration while moving, ↑2 stationary - the ↑1 always, the second one to
  // untick when moving. The Magnetohydrodynamic Drive doubles both.
  if (skill == 'infiltration') {
    const mhd = upgrades.has(VU.mhdDrive);
    if (upgrades.has(VU.stealthy) || mhd) {
      const factor = mhd ? 2 : 1;
      const id = mhd ? VU.mhdDrive : VU.stealthy;
      sources.push({ id, label: label(id), shiftUp: factor, shiftDown: 0, edge: false, snag: false });
      sources.push({ id: `${id}-stationary`, label: `${label(id)} (${game.i18n.localize('E20.VehicleStationary')})`, shiftUp: factor, shiftDown: 0, edge: false, snag: false });
    }

    // Camo Netting: "Edge on Infiltration Skill Tests to hide the stationary vehicle."
    if (vehicle.getFlag?.('essence20', 'camoNetting')) {
      add(VU.camoNetting, { edge: true });
    }
  }

  // Camo Netting left on while driving: "-2 on Speed Skill Tests".
  if (vehicle.getFlag?.('essence20', 'camoNetting') && CONFIG?.E20?.skillToEssence?.[skill] == 'speed') {
    add(VU.camoNetting, { shiftDown: 2 });
  }

  // Titanium Chassis: "+2 on Might Skill Tests to shove." Second Gear: "Edge on Skill Tests to
  // push, pull, or tow." The vehicle's own tests.
  if (role == 'self' && skill == 'might') {
    add(VU.titaniumChassis, { shiftUp: 2 });
  }

  if (role == 'self' && (skill == 'brawn' || skill == 'might')) {
    add(VU.secondGear, { edge: true });
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
 * Early-Warning Alarm / Focus Module: "+1 to the driver's Willpower [Cleverness] while operating the
 * vehicle." Called from the driver's own Defenses.
 * @returns {{willpower: Number, cleverness: Number}}
 */
export function driverDefenseBonus(actor) {
  const crewed = getCrewedVehicle(actor);
  if (!crewed || crewed.role != 'driver') {
    return { willpower: 0, cleverness: 0 };
  }

  return {
    willpower: hasVehicleUpgrade(crewed.vehicle, VU.earlyWarningAlarm) ? 1 : 0,
    cleverness: hasVehicleUpgrade(crewed.vehicle, VU.focusModule) ? 1 : 0,
  };
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

  // Ablative Armor: "An attacker dealing Blunt or Sharp damage to the vehicle suffers -1."
  if (upgrades.has(VU.ablativeArmor) && ['blunt', 'sharp'].includes(damageType)) {
    sources.push({ id: 'ablativeArmor', label: label(VU.ablativeArmor), shiftDown: 1 });
  }

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

  // JAFF: "Once per combat, an incoming attack with a Computerized weapon suffers Snag." Tricked-Out
  // Hydraulics: the same, for a Ballistic weapon.
  if (upgrades.has(VU.jaff) && traits.includes('computerized') && getUses(target, 'vehicleJaff') < 1) {
    sources.push({ id: 'jaff', label: label(VU.jaff), snag: true, once: 'vehicleJaff' });
  }

  if (upgrades.has(VU.trickedOutHydraulics) && traits.includes('ballistic') && getUses(target, 'vehicleHydraulics') < 1) {
    sources.push({ id: 'trickedOutHydraulics', label: label(VU.trickedOutHydraulics), snag: true, once: 'vehicleHydraulics' });
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
 * Redundant Backups: "Once per mission, if the vehicle would be Defeated, it drops to 1 Health
 * instead." Called before a vehicle's Defeat is resolved (vehicle-defeat.mjs).
 * @returns {Promise<Boolean>}   Whether it saved the vehicle.
 */
export async function tryRedundantBackups(vehicle) {
  if (!hasVehicleUpgrade(vehicle, VU.redundantBackups) || getUses(vehicle, 'vehicleBackups', 'mission') > 0) {
    return false;
  }

  await markUsed(vehicle, 'vehicleBackups', { window: 'mission' });
  await vehicle.update({ 'system.health.value': 1 });
  return true;
}

/**
 * Pressurized Cabin (and Submarine Mode): "The sealed compartment grants immunity to Poison and
 * Disease" - to everyone aboard.
 */
export function isSealedAboard(actor) {
  const crewed = getCrewedVehicle(actor);
  return !!crewed && (hasVehicleUpgrade(crewed.vehicle, VU.pressurizedCabin) || hasVehicleUpgrade(crewed.vehicle, VU.submarineMode));
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
  [VU.camoNetting]: {},
  [VU.radarJammer]: { cost: 'free' },
  [VU.enhancedRadarJamming]: {},
  [VU.biotechEnhancer]: { limit: 'scene' },
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
 * its action cost is spent by the vehicle (helpers/action-perks.mjs passes {spend}).
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
    const { applyTimedCondition } = await import("./timed-status.mjs");
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
    const { EVASIVE_MANEUVERS_FLAG } = await import("./evasive-maneuvers.mjs");
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

  case VU.camoNetting: {
    const on = !vehicle.getFlag('essence20', 'camoNetting');
    await vehicle.setFlag('essence20', 'camoNetting', on);
    message = i18n(on ? 'E20.VehicleUseCamoOn' : 'E20.VehicleUseCamoOff');
    break;
  }

  case VU.radarJammer:
  case VU.enhancedRadarJamming: {
    const on = !vehicle.getFlag('essence20', 'jamming');
    await vehicle.setFlag('essence20', 'jamming', on ? (id == VU.enhancedRadarJamming ? 100 : 50) : false);
    message = i18n(on ? 'E20.VehicleUseJammingOn' : 'E20.VehicleUseJammingOff');
    break;
  }

  case VU.biotechEnhancer:
    await vehicle.setFlag('essence20', 'biotechEnhancer', { scene: getSceneEpoch() });
    message = i18n('E20.VehicleUseBiotech');
    break;

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
