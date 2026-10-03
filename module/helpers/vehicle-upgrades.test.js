import { jest } from '@jest/globals';
import { existsSync, readdirSync, readFileSync } from 'fs';
import {
  applyToVehicle, applyToVehicleEffect, canUseDrivingForIntimidation, canUseVehicleUpgrade, crewSources, defenderSources,
  getCrewedVehicle, isSealedAboard, jammingRadiusFeet, reduceVehicleDamage, spendDefenderSources,
  useVehicleUpgrade, usesVehicleTargeting, vehicleWeaponTraits, VU,
} from './vehicle-upgrades.mjs';
import {
  computerizedArmorEvasion, firesAsReinforced, hardpointBonus, ignoresDefend, integratedHardpointsPerWeapon, isGrownThreat,
  lightArmorPenalty, noisyArmorPenalty, perkGrantedTraits, ramConeAltAttack, ramConeBotUnarmed, HARDPOINT_PERK, TRAIT_PERK,
} from './weapon-traits.mjs';
import { combineCandidates, fireCombinedWeapon, isCombinedWeapon } from './combined-weapons.mjs';

function flagged(obj) {
  obj.flags ??= {};
  obj.getFlag = (scope, key) => foundry.utils.getProperty(obj.flags?.[scope] ?? {}, key);
  obj.setFlag = jest.fn(async (scope, key, value) => {
    obj.flags[scope] ??= {};
    foundry.utils.setProperty(obj.flags[scope], key, value);
  });
  obj.unsetFlag = jest.fn(async (scope, key) => {
    delete obj.flags?.[scope]?.[key];
  });
  return obj;
}

global.foundry = {
  utils: {
    getProperty: (obj, path) => path.split('.').reduce((o, p) => o?.[p], obj),
    setProperty: (obj, path, value) => {
      const parts = path.split('.');
      let o = obj;
      for (const part of parts.slice(0, -1)) {
        o[part] ??= {};
        o = o[part];
      }

      o[parts.at(-1)] = value;
    },
    escapeHTML: s => s,
  },
  applications: { api: { DialogV2: { wait: jest.fn() } } },
};

const vUpgrade = (id, extra = {}) => ({ type: 'upgrade', name: id, system: { type: 'vehicle' }, flags: { core: { sourceId: `Compendium.essence20.quartermasters_guide_to_gear.Item.${id}` }, ...extra.flags } });

function makeVehicle(items = [], system = {}) {
  return flagged({
    id: 'v1', uuid: 'Actor.v1', type: 'vehicle', name: 'VAMP', items,
    system: {
      defenses: { toughness: { total: 10 }, evasion: { total: 10 } },
      movement: { ground: { total: 60, base: 60 }, aerial: { total: 0, base: 0 }, swim: { total: 0, base: 0 } },
      traits: { computerized: false, ai: false, sensors: false, vtol: false, autopilot: false, targetingSystem: false },
      resistances: { fire: false, cold: false },
      crew: { numPassengers: 2 },
      health: { max: 5 },
      actors: {},
      ...system,
    },
    update: jest.fn(),
  });
}

let sceneEpoch = 1;
beforeEach(() => {
  global.game = {
    i18n: { localize: k => k, format: k => k },
    settings: { get: () => sceneEpoch },
    combat: { id: 'c1', round: 1, turn: 0 },
    actors: [],
    user: { isActiveGM: true },
  };
  global.CONFIG = { E20: { skillToEssence: { driving: 'speed', might: 'strength' }, damageTypes: {} } };
});

describe("the vehicle's own numbers", () => {
  test("a chosen resistance", () => {
    const vehicle = makeVehicle([vUpgrade(VU.energyResistant, { flags: { essence20: { elementChoice: 'fire' } } })]);
    applyToVehicle(vehicle);
    expect(vehicle.system.resistances.fire).toBe(true);
  });

  test("Movement: rocket fuel doubles, Optimized Seating takes 10ft", () => {
    const vehicle = makeVehicle([vUpgrade(VU.nitroFuel), vUpgrade(VU.optimizedSeating)]);
    applyToVehicle(vehicle);
    expect(vehicle.system.movement.ground.total).toBe(110);
  });

  test("ECM and Afterburners while switched on", async () => {
    const vehicle = makeVehicle([vUpgrade(VU.ecm), vUpgrade(VU.afterburners)]);
    vehicle.flags.essence20 = { ecmUntil: { combatId: 'c1', round: 2, turn: 0 }, afterburners: { combatId: 'c1', round: 1, turn: 0, type: 'ground' } };
    applyToVehicle(vehicle);
    expect(vehicle.system.defenses.toughness.total).toBe(15);
    expect(vehicle.system.movement.ground.total).toBe(120);
  });

  test("Robust Ram adds a Sharp rider to the Ram; Double-Barrel makes a weapon Linked", () => {
    const vehicle = makeVehicle([vUpgrade(VU.robustRam), vUpgrade(VU.doubleBarrel, { flags: { essence20: { weaponId: 'w1' } } })]);
    const system = { isRam: true, damageType: 'blunt', damageValue: 2, secondaryDamage: { type: null, value: 0 } };
    applyToVehicleEffect(system, vehicle, (path, value) => foundry.utils.setProperty(system, path, value));
    expect(system.secondaryDamage).toEqual({ type: 'sharp', value: 1 });
    expect(vehicleWeaponTraits({ id: 'w1', parent: vehicle })).toEqual(['linked']);
    expect(usesVehicleTargeting(vehicle, { system: { traits: ['targetingSystem'] } })).toBe(true);
  });
});

describe("crew and defenders", () => {
  test("a driver crews the vehicle; Kill Counter lends Driving", () => {
    const vehicle = makeVehicle([vUpgrade(VU.killCounter)], {
      actors: { a: { uuid: 'Actor.d', vehicleRole: 'driver' } },
    });
    game.actors = [vehicle];
    const driver = { uuid: 'Actor.d' };

    expect(getCrewedVehicle(driver).role).toBe('driver');
    expect(canUseDrivingForIntimidation(driver)).toBe(true);
  });

  test("Treads give Edge on Driving in Rough Terrain only", () => {
    const vehicle = makeVehicle([vUpgrade(VU.treads)]);
    expect(crewSources(vehicle, 'driving', null, { inRoughTerrain: true }).map(s => s.edge)).toEqual([true]);
    expect(crewSources(vehicle, 'driving', null)).toEqual([]);
  });

  test("Shielded counting", async () => {
    const vehicle = makeVehicle([], { shieldedRating: 1 });
    const shot = { type: 'weaponEffect', system: { damageType: 'sharp', classification: { style: 'projectile' } } };
    const sources = defenderSources({}, shot, vehicle, { weaponTraits: ['computerized'] });
    expect(sources.map(s => s.id)).toEqual(['shielded']);

    await spendDefenderSources(vehicle, sources);
    expect(defenderSources({}, shot, vehicle, { weaponTraits: ['computerized'] })).toEqual([]);
  });

  test("Spiked costs a melee attacker ↓1 - or 1 Sharp if they turn it down", () => {
    const vehicle = makeVehicle([vUpgrade(VU.spiked)]);
    const [spiked] = defenderSources({}, { type: 'weaponEffect', system: { damageType: 'blunt', classification: { skill: 'might' } } }, vehicle, { melee: true });
    expect(spiked).toMatchObject({ shiftDown: 1, declinedDamage: { value: 1, type: 'sharp' } });
  });

  test("a sealed (pressurized) cabin keeps its crew from poison", () => {
    const vehicle = makeVehicle([], { actors: { a: { uuid: 'Actor.p' } }, pressurized: 1 });
    game.actors = [vehicle, makeVehicle([], { actors: { b: { uuid: 'Actor.q' } } })];
    expect(isSealedAboard({ uuid: 'Actor.p' })).toBe(true);
    expect(isSealedAboard({ uuid: 'Actor.q' })).toBe(false);
  });
});

describe("damage and Defeat", () => {
  test("APS zeroes an Explosive hit once; Slat and Reactive take 1", async () => {
    const vehicle = makeVehicle([vUpgrade(VU.activeProtection), vUpgrade(VU.slatArmor), vUpgrade(VU.reactiveArmor)]);
    vehicle.getFlag = (s, k) => vehicle.flags?.[s]?.[k];
    expect((await reduceVehicleDamage(vehicle, 3, { style: 'explosive' })).amount).toBe(0);
    expect((await reduceVehicleDamage(vehicle, 3, { style: 'explosive' })).amount).toBe(1);
    expect((await reduceVehicleDamage(vehicle, 3, { style: 'projectile', damageType: 'sharp' })).amount).toBe(3);
  });
});

describe("Use buttons", () => {
  test("Electronic Countermeasures spends a Move action and is once per encounter", async () => {
    const vehicle = makeVehicle();
    const ecm = { ...vUpgrade(VU.ecm), parent: vehicle };
    vehicle.items.push(ecm);
    vehicle.getFlag = (s, k) => foundry.utils.getProperty(vehicle.flags?.[s] ?? {}, k);
    const spend = jest.fn(async () => ({ blocked: false }));

    expect(canUseVehicleUpgrade(ecm)).toBe(true);
    expect(await useVehicleUpgrade(ecm, { spend })).toBe('E20.VehicleUseEcm');
    expect(spend).toHaveBeenCalledWith(vehicle, 'move', expect.anything());
    expect(canUseVehicleUpgrade(ecm)).toBe(false);
  });

  test("Camo Netting switched on takes 10ft off Movement; Biotech adds 20ft Ground", () => {
    const on = key => ({ flags: { essence20: { rules: { toggles: { [key]: true } } } } });
    const vehicle = makeVehicle([vUpgrade(VU.camoNetting, on('camo'))]);
    applyToVehicle(vehicle);
    expect(vehicle.system.movement.ground.total).toBe(50);
    const boosted = makeVehicle([vUpgrade(VU.biotechEnhancer, on('boost'))]);
    applyToVehicle(boosted);
    expect(boosted.system.movement.ground.total).toBe(80);
  });
});

describe("jamming", () => {
  test("a switched-on jammer reaches 50ft, Enhanced Radar Jamming a mile; off reaches nothing", () => {
    expect(jammingRadiusFeet({ flags: { essence20: { jamming: 50 } } })).toBe(50);
    expect(jammingRadiusFeet({ flags: { essence20: { jamming: 100 } } })).toBe(5280);
    expect(jammingRadiusFeet({ flags: { essence20: { jamming: false } } })).toBe(0);
    expect(jammingRadiusFeet(null)).toBe(0);
  });
});

describe("weapon and armor traits", () => {
  // A Perk built from its id carries that pack item's rules (WeaponTrait / Hardpoints), as a real copy inherits them.
  let nextPerk = 1;
  const perkItem = uuid => {
    const id = String(uuid).split('.').pop();
    let rules = [];
    for (const dir of readdirSync('packs')) {
      const src = `packs/${dir}/_source`;
      const file = existsSync(src) ? readdirSync(src).find(name => name.endsWith(`_${id}.json`)) : null;
      if (file) {
        rules = JSON.parse(readFileSync(`${src}/${file}`, 'utf8')).system?.rules ?? [];
      }
    }

    return { id: `perk${nextPerk++}`, type: 'perk', flags: { core: { sourceId: uuid } }, system: { rules } };
  };

  test("Demolisher gives Wrecker, Fireball gives fire weapons Anti-Tank, a customized weapon is Temperamental", () => {
    const actor = { items: [perkItem(TRAIT_PERK.demolisher), perkItem(TRAIT_PERK.fireball)] };
    const weapon = { parent: actor, name: 'Flamer', flags: { essence20: { customized: true } } };
    expect(perkGrantedTraits(weapon, ['fire'])).toEqual(['wrecker', 'antiTank', 'temperamental']);
  });

  test("noisy armor, computerized armor, MLP Light and Heavy Armor", () => {
    const armor = (traits, t, e, source = '') => ({ type: 'armor', system: { equipped: true, traits, totalBonusToughness: t, totalBonusEvasion: e }, flags: { core: { sourceId: source } } });
    const actor = { items: [armor(['deflective'], 2, 0), armor(['silent', 'computerized'], 0, 1), armor([], 1, 0, TRAIT_PERK.mlpLightArmor)] };
    // MLP armor carries its own printed penalty instead of the noisy-battledress one.
    expect(noisyArmorPenalty(actor)).toBe(2);
    expect(computerizedArmorEvasion(actor)).toBe(1);
    expect(lightArmorPenalty(actor, 'initiative')).toBe(1);
    expect(lightArmorPenalty(actor, 'might')).toBe(0);

    const heavy = { items: [armor([], 3, 0, TRAIT_PERK.mlpHeavyArmor)] };
    expect(noisyArmorPenalty(heavy)).toBe(0);
    expect(lightArmorPenalty(heavy, 'infiltration')).toBe(2);
    expect(lightArmorPenalty(heavy, 'acrobatics')).toBe(2);
  });

  test("Ram Cone, Ignores Defend and Grown targets", () => {
    const actor = { items: [perkItem(TRAIT_PERK.ramCone)], system: { isTransformed: true } };
    expect(ramConeAltAttack(actor, { system: { isRam: true } })).toBe(true);
    expect(ramConeBotUnarmed({ ...actor, system: { isTransformed: false } }, { type: 'weaponEffect', system: { damageType: 'blunt', shiftDown: 1 } }, null)).toBe(true);
    expect(ignoresDefend({ flags: { core: { sourceId: 'Compendium.essence20.jump_through_time.Item.fp55vEQbwH92XrgI' } } })).toBe(true);
    expect(isGrownThreat({ getFlag: (s, k) => (k == 'normalFormId' ? 'x' : undefined) })).toBe(true);
  });

  test("hardpoint Perks add slots, Titan Hardpoint Upgrades cost one more, Gun Runner reinforces ballistic weapons", () => {
    const actor = { items: [perkItem(HARDPOINT_PERK.armament), perkItem(HARDPOINT_PERK.quickDraw), perkItem(HARDPOINT_PERK.gunRunner), perkItem(HARDPOINT_PERK.titanHardpointUpgrades)] };
    expect(hardpointBonus(actor)).toEqual({ external: 2, integrated: 1, nonWeapon: 0 });
    // In Case of Emergency's two slots are Non-Weapon only - they don't let two more weapons in.
    expect(hardpointBonus({ items: [perkItem(HARDPOINT_PERK.inCaseOfEmergency)] })).toEqual({ external: 0, integrated: 0, nonWeapon: 2 });
    expect(integratedHardpointsPerWeapon(actor)).toBe(1);
    expect(firesAsReinforced(actor, { system: { traits: ['ballistic'] } })).toBe(true);
    expect(firesAsReinforced({ items: [] }, { system: { traits: [] } })).toBe(false);
  });
});

describe("combined weapons", () => {
  test("a Combined weapon is recognised; firing with too few successes misses", async () => {
    expect(isCombinedWeapon({ type: 'weapon', system: { traits: ['combined'] } })).toBe(true);
    global.canvas = { tokens: { placeables: [] } };
    expect(combineCandidates({ id: 'a', getActiveTokens: () => [] })).toEqual([]);

    const member = (success) => ({
      items: [{ id: 'w', type: 'weapon', system: { traits: ['combined'] } }, { type: 'weaponEffect', flags: { essence20: { parentId: 'w' } }, system: { classification: { skill: 'targeting' } } }],
      _dice: { rollSkill: jest.fn(async () => ({ success })) },
    });
    const members = [member(true), member(false), member(false)];
    global.fromUuid = jest.fn(async uuid => members[Number(uuid)]);
    global.ChatMessage = { create: jest.fn() };
    game.user.targets = new Set([{ name: 'Rita', actor: { uuid: 'Actor.r' }, document: { uuid: 't' } }]);
    const message = { speaker: {}, getFlag: () => ({ members: ['0', '1', '2'], weaponName: 'Power Blaster', damageType: 'blunt', attacks: 1 }) };

    expect(await fireCombinedWeapon(message)).toBe(false);
    members[1] = member(true);
    expect(await fireCombinedWeapon(message)).toBe(true);
  });
});
