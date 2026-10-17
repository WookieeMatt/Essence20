import { jest } from '@jest/globals';
import { existsSync, readdirSync, readFileSync } from 'fs';
import {
  defenderSources,
  getCrewedVehicle, isSealedAboard, spendDefenderSources,
  usesVehicleTargeting,
} from './vehicle-upgrades.mjs';
import {
  computerizedArmorEvasion, firesAsReinforced, hardpointBonus, ignoresDefend, integratedHardpointsPerWeapon, isGrownThreat,
  noisyArmorPenalty, perkGrantedTraits, TRAIT_PERK,
} from '../combat/weapon-traits.mjs';
import { combineCandidates, fireCombinedWeapon, isCombinedWeapon } from '../actions/combined-weapons.mjs';

// The pack items these tests load rules from (weapon-traits.mjs's old HARDPOINT_PERK table and TRAIT_PERK's
// Demolisher / Fireball entries went - nothing in the module read them; audit fix 2026-10-07).
const ITEM = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;
const RULED_PERK = {
  demolisher: ITEM('cobra_codex', 'hn7emvM7M9GoSLAI'),
  fireball: ITEM('cobra_codex', '20lv1ecNs4ORVwWu'),
  weaponCustomizer: ITEM('intercontinental_adventures', 'UWEU7hfmtRxlkWJB'),
};
const HARDPOINT_PERK = {
  armament: ITEM('tf_crb', 't5EC1a4cbtfwewd6'),
  inCaseOfEmergency: ITEM('tf_crb', '4l9Oa6LLVheEdnFO'),
  quickDraw: ITEM('tf_crb', 'p8DTLro2sc2kPYQl'),
  gunRunner: ITEM('tf_crb', 'evgNyOBK1uA5qUVl'),
  titanHardpointUpgrades: ITEM('enigma_of_combination', 'v8nLHZhmFTtsJ1zs'),
};

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
  data: { operators: { ForcedDeletion: globalThis.foundry?.data?.operators?.ForcedDeletion ?? class ForcedDeletion {} } }, utils: {
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

// Energy Resistant, Nitrogen-Enhanced Rocket Fuel, ECM, Afterburners, Double-Barrel, Spiked, the jammers and the other
// switched-on upgrades are item rules now (rules/conv14-systems.test.js).
describe("the vehicle's own numbers", () => {
  // (Optimized Seating's, Camo Netting's, the Biotech Performance Enhancer's and the Anti-Matter Reactor's Movement, and Treads'
  // Edge, are item rules - rules/conv17-split3.test.js.)
  // (Robust Ram's Sharp rider is an ItemModifier stage item rule - rules/conv15-systems.test.js.)
  test("a weapon with the Targeting System trait fires with the vehicle's Targeting", () => {
    const vehicle = makeVehicle([]);
    expect(usesVehicleTargeting(vehicle, { system: { traits: ['targetingSystem'] } })).toBe(true);
  });
});

describe("crew and defenders", () => {
  // (Kill Counter's Driving for Intimidation is a crew DieSubstitution rule - rules/conv15-systems.test.js.)
  test("a driver crews the vehicle", () => {
    const vehicle = makeVehicle([], {
      actors: { a: { uuid: 'Actor.d', vehicleRole: 'driver' } },
    });
    game.actors = [vehicle];
    const driver = { uuid: 'Actor.d' };

    expect(getCrewedVehicle(driver).role).toBe('driver');
  });

  test("Shielded counting", async () => {
    const vehicle = makeVehicle([], { shieldedRating: 1 });
    const shot = { type: 'weaponEffect', system: { damageType: 'sharp', classification: { style: 'projectile' } } };
    const sources = defenderSources({}, shot, vehicle, { weaponTraits: ['computerized'] });
    expect(sources.map(s => s.id)).toEqual(['shielded']);

    await spendDefenderSources(vehicle, sources);
    expect(defenderSources({}, shot, vehicle, { weaponTraits: ['computerized'] })).toEqual([]);
  });

  test("a sealed (pressurized) cabin keeps its crew from poison", () => {
    const vehicle = makeVehicle([], { actors: { a: { uuid: 'Actor.p' } }, pressurized: 1 });
    game.actors = [vehicle, makeVehicle([], { actors: { b: { uuid: 'Actor.q' } } })];
    expect(isSealedAboard({ uuid: 'Actor.p' })).toBe(true);
    expect(isSealedAboard({ uuid: 'Actor.q' })).toBe(false);
  });
});

// (Nameplate is a Use rule + crew RollModifier - rules/conv15-systems.test.js.)

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
    const actor = { items: [perkItem(RULED_PERK.demolisher), perkItem(RULED_PERK.fireball), perkItem(RULED_PERK.weaponCustomizer)] };
    const weapon = { parent: actor, name: 'Flamer', flags: { essence20: { customized: true } } };
    expect(perkGrantedTraits(weapon, ['fire'])).toEqual(['wrecker', 'antiTank', 'temperamental']);
    // Bug fix 2026-10-06: the customized flag only counts while the holder has Weapon Customizer.
    const noPerk = { items: [] };
    expect(perkGrantedTraits({ parent: noPerk, name: 'Flamer', flags: { essence20: { customized: true } } }, ['fire'])).toEqual([]);
  });

  test("noisy armor, computerized armor, MLP Light and Heavy Armor", () => {
    const armor = (traits, t, e, source = '') => ({ type: 'armor', system: { equipped: true, traits, totalBonusToughness: t, totalBonusEvasion: e }, flags: { core: { sourceId: source } } });
    const actor = { items: [armor(['deflective'], 2, 0), armor(['silent', 'computerized'], 0, 1), armor([], 1, 0, TRAIT_PERK.mlpLightArmor)] };
    // MLP armor carries its own printed penalty instead of the noisy-battledress one.
    expect(noisyArmorPenalty(actor)).toBe(2);
    expect(computerizedArmorEvasion(actor)).toBe(1);

    // Their own ↓1 / ↓2 are RollModifier rules on the armor (rules/conv14-other.test.js).
    const heavy = { items: [armor([], 3, 0, TRAIT_PERK.mlpHeavyArmor)] };
    expect(noisyArmorPenalty(heavy)).toBe(0);
  });

  // (Ram Cone is item rules now - rules/conv15-other.test.js.)
  test("Ignores Defend and Grown targets", () => {
    expect(ignoresDefend({ flags: { core: { sourceId: 'Compendium.essence20.jump_through_time.Item.fp55vEQbwH92XrgI' } } })).toBe(true);
    expect(isGrownThreat({ getFlag: (s, k) => (k == 'normalFormId' ? 'x' : undefined) })).toBe(true);
  });

  // (Augur's Armor Piercing - only Armor Piercing - is an AttackTraits rule now: rules/conv15-uses.test.js.)

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
