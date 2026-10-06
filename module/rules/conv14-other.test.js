import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Round 14, part Other (docs/rules-batches/slOther14.md): items whose hand-written code in mechanics/*, sheet-handlers,
 * documents and dice.mjs moved onto rules. Each item is loaded from its pack source and must do what the removed code
 * (and its removed test) did.
 */

global.Hooks = { on: () => 0, once: () => 0, callAll: () => {} };
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { ruleDerived, ruleFiresAsReinforced, ruleNoUntrainedSnag, ruleRollSources } = await import('./adapter.mjs');
const { costRulesFor } = await import('./actions.mjs');
const { runUse, useAvailable, fireItemAdded } = await import('./triggers.mjs');
const { setStoryPointHelpers } = await import('./steps.mjs');
const { grantData } = await import('./lifecycle.mjs');
const { validateRule } = await import('./types.mjs');
const { sizeDerived } = await import('./plugins/effects/size.mjs');
const { ruleHazardProtection } = await import('./plugins/combat/hazard-terrain-targets.mjs');
const { ENVIRONMENT_HAZARDS, ENVIRONMENT_PROTECTORS, getEnvironmentProtection } = await import('../mechanics/world/environment-hazards.mjs');
const { getDailyUsesMax } = await import('../mechanics/resources/nanomite-uses.mjs');
const { fixedPowerCost } = await import('../sheet-handlers/power-handler.mjs');
const { firesAsReinforced } = await import('../mechanics/combat/weapon-traits.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));
const FILES = {
  titanspark: 'eocitems/_source/Titanspark_ldnUTXw5w21toLIy.json',
  dodgy: [
    'mlpcrbitems/_source/Dodgy_jwhdtCaq0MBotupG.json', 'gijcrbitems/_source/Dodgy_GQwhr14X9yXkAuWH.json',
    'tfcrbitems/_source/Dodgy_smkYh73IkfzNuQUl.json', 'prcrbitems/_source/Dodgy_HdgGywFzuxezzVGy.json',
    'wtnvcgitems/_source/Dodgy_QAyXVlPBLs5yndGt.json',
  ],
  lightArmor: 'mlpcrbitems/_source/Light_Armor_4M1CnapdbRIBl3It.json',
  heavyArmor: 'mlpcrbitems/_source/Heavy_Armor_B8RcQxof4JmlbEHE.json',
  potentPoison: 'ccitems/_source/Potent_Poison_CrxBz7IEuI92WfTB.json',
  reinforced: 'tfcrbitems/_source/Reinforced_Hardpoint_YDOmBfuUnYFalIVY.json',
  boarder: 'iafav2items/_source/Boarder_BJpJWK7oDfw51Dxl.json',
  reprogrammable: 'qgtgitems/_source/Reprogrammable_EOG8PH8fIJAVpbGY.json',
  leadfoot: 'qgtgitems/_source/Leadfoot_zdXJzzqekwPAnCtT.json',
  sealed: 'prcrbitems/_source/Environmentally_Sealed_v5ZJXRVnMiRaI4AU.json',
  aegis: 'jttitems/_source/Environmental_Aegis_jw8ggFiT6xdr0uMc.json',
  masks: [
    'gijcrbitems/_source/Gas_Mask_d089BSbVVaXWWTx6.json', 'gijcrbitems/_source/Nuclear_Biological_Chemical_Protection_Suit_teDcExlkzRTGTChr.json',
    'kocitems/_source/Gasmask_m2LGzwoUL9LVbOp9.json',
  ],
  scuba: ['gijcrbitems/_source/Scuba_Gear_cZpeYK7VoLJKGKL6.json', 'mlpcrbitems/_source/Scuba_Gear_cZpeYK7VoLJKGKL6.json'],
  readTheLand: 'iafav2items/_source/Read_the_Land_j8wVLLK4XvVEuP6F.json',
  adaptation: 'gijcrbitems/_source/Adaptation_PmY8jGTiemnSdsHi.json',
  powerFist: 'qgtgitems/_source/Power_Fist_7gT8dddccGA6gbGa.json',
  zeoWielder: 'ttsgitems/_source/Team_Perk__Zeo_Crystal_Wielder__Zeo_Rangers__lNCrjjiiUhI6ROal.json',
  restrainingChains: 'ttsgitems/_source/Restraining_Chains_AVXOwNhDWQJewKAl.json',
};
const FLAG = 'environmentalExpertiseActive';
const CC_HEAVY_BLUDGEONING = 'Compendium.essence20.gi_joe_crb.Item.xthnRWfhbfXvpmZN';

let nextId = 1;
const getPath = (object, key) => String(key).split('.').reduce((o, k) => (o === null || o === undefined ? o : o[k]), object);
function setPath(object, key, value) {
  const keys = key.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
}

/** A pack item as an owned copy (its book source on flags.core.sourceId), or plain data. */
function itemFrom(entry, extra = {}) {
  const doc = typeof entry == 'string' ? fromPack(entry) : entry;
  const item = {
    id: `i${nextId++}`, name: doc.name, type: doc.type, effects: [],
    flags: { core: { sourceId: doc._id ? `Compendium.essence20.pack.Item.${doc._id}` : null }, ...(extra.flags ?? {}) },
    system: JSON.parse(JSON.stringify({ ...(doc.system ?? {}), ...(extra.system ?? {}) })),
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    },
  };
  return item;
}

function makeActor(entries = [], { system = {}, type = 'playerCharacter' } = {}) {
  const items = [];
  const actor = {
    id: `a${nextId++}`, name: 'Hero', type, isOwner: true, statuses: new Set(), flags: { essence20: {} },
    system: { level: 3, ...system },
    getFlag(scope, key) {
      return getPath(this.flags[scope] ?? {}, key);
    },
    async setFlag(scope, key, value) {
      setPath(this.flags[scope] ??= {}, key, value);
    },
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }

      rebuildIndex(this);
    },
    createEmbeddedDocuments: jest.fn(async (kind, datas) => datas.map(data => {
      const made = { id: `i${nextId++}`, parent: actor, effects: [], flags: {}, system: {}, ...data };
      items.push(made);
      return made;
    })),
  };
  actor.uuid = `Actor.${actor.id}`;
  actor.items = { contents: items, get: id => items.find(item => item.id == id), [Symbol.iterator]: () => items[Symbol.iterator]() };
  for (const entry of entries) {
    const item = entry?.id ? entry : itemFrom(entry);
    item.parent = actor;
    items.push(item);
  }

  rebuildIndex(actor);
  return actor;
}

const add = (actor, item) => {
  item.parent = actor;
  actor.items.contents.push(item);
  rebuildIndex(actor);
  return item;
};

const sources = (actor, roll) => ruleRollSources(actor, null, roll).sources;
const pay = () => jest.fn(async () => true);

beforeAll(() => {
  global.foundry.utils.setProperty = setPath;
  global.foundry.utils.getProperty = getPath;
});

beforeEach(() => {
  global.game = { ...(global.game ?? {}), combat: null, actors: [], user: { id: 'u', isGM: false, targets: new Set() } };
});

test('every rule this round added validates', () => {
  const files = Object.values(FILES).flat();
  for (const file of files) {
    for (const rule of fromPack(file).system.rules) {
      expect([file, validateRule(rule)]).toEqual([file, []]);
    }
  }
});

/* ---- Titanspark (was documents/actor.mjs#_prepareTitansparkSize) ---- */

describe('Titanspark: one Size Class up from whatever the Origin set', () => {
  test('bumps size one step up', () => {
    const actor = makeActor([FILES.titanspark], { system: { size: 'common' } });
    sizeDerived(actor);
    expect(actor.system.size).toBe('large');
  });

  test('caps at the top of the size list', () => {
    const actor = makeActor([FILES.titanspark], { system: { size: 'titanic' } });
    sizeDerived(actor);
    expect(actor.system.size).toBe('titanic');
  });

  test('does nothing without the Perk', () => {
    const actor = makeActor([], { system: { size: 'common' } });
    sizeDerived(actor);
    expect(actor.system.size).toBe('common');
  });
});

/* ---- Dodgy (was action-economy.mjs DODGY_IDS / getNamedActionType) ---- */

test.each(FILES.dodgy)('Dodgy (%s) turns Defend into a Free action, and nothing else', file => {
  const [rule, ...rest] = costRulesFor(makeActor([file]));
  expect(rest).toEqual([]);
  expect(rule.matches({ key: 'defend' })).toBe(true);
  expect(rule.to()).toBe('free');
  expect(rule.matches({ key: 'aim' })).toBe(false);
  expect(rule.limit).toBeUndefined();
});

/* ---- MLP Light / Heavy Armor (was weapon-traits.mjs#lightArmorPenalty + dice.mjs) ---- */

describe('MLP Light and Heavy Armor', () => {
  const worn = (file, equipped = true) => itemFrom(file, { system: { equipped } });

  test('Light Armor: ↓1 on Athletics, Acrobatics and Infiltration while worn', () => {
    const actor = makeActor([worn(FILES.lightArmor)]);
    for (const skill of ['athletics', 'acrobatics', 'infiltration']) {
      expect(sources(actor, { rolledSkill: skill })).toEqual([expect.objectContaining({ shiftDown: 1 })]);
    }

    expect(sources(actor, { rolledSkill: 'might' })).toEqual([]);
    // Initiative never reached the old penalty (it rolls through prepareInitiativeRoll, not this path).
    expect(sources(actor, { rolledSkill: 'initiative' })).toEqual([]);
    expect(sources(makeActor([worn(FILES.lightArmor, false)]), { rolledSkill: 'athletics' })).toEqual([]);
  });

  test('Heavy Armor: ↓2 on the same tests', () => {
    const actor = makeActor([worn(FILES.heavyArmor)]);
    expect(sources(actor, { rolledSkill: 'infiltration' })).toEqual([expect.objectContaining({ shiftDown: 2 })]);
    expect(sources(actor, { rolledSkill: 'acrobatics' })).toEqual([expect.objectContaining({ shiftDown: 2 })]);
  });

  test('both worn: the bigger penalty only, as the old max did', () => {
    const actor = makeActor([worn(FILES.lightArmor), worn(FILES.heavyArmor)]);
    expect(sources(actor, { rolledSkill: 'athletics' })).toEqual([expect.objectContaining({ shiftDown: 2 })]);
  });
});

/* ---- Potent Poison, Reinforced Hardpoint (attached upgrades - was weapon-traits.mjs / documents/item.mjs) ---- */

function weaponWithUpgrade(file, weaponSystem = {}) {
  const weapon = itemFrom({ name: 'Blowgun', type: 'weapon', system: { equipped: true, ongoingDuration: 1, ...weaponSystem } });
  const other = itemFrom({ name: 'Knife', type: 'weapon', system: { equipped: true, ongoingDuration: 1 } });
  const upgrade = itemFrom(file, { flags: { essence20: { parentId: weapon.id } } });
  const actor = makeActor([weapon, other, upgrade]);
  return { actor, weapon, other, upgrade };
}

test('Potent Poison: the poison weapon it is attached to lasts one more round', () => {
  const { actor, weapon, other } = weaponWithUpgrade(FILES.potentPoison);
  ruleDerived(actor);
  expect(weapon.system.ongoingDuration).toBe(2);
  expect(other.system.ongoingDuration).toBe(1);
});

test('Potent Poison: a copy on each of two weapons gives each its round', () => {
  const { actor, weapon, other } = weaponWithUpgrade(FILES.potentPoison);
  add(actor, itemFrom(FILES.potentPoison, { flags: { essence20: { parentId: other.id } } }));
  ruleDerived(actor);
  expect(weapon.system.ongoingDuration).toBe(2);
  expect(other.system.ongoingDuration).toBe(2);
});

test('Reinforced Hardpoint: the weapon it is attached to fires as Reinforced, no other', () => {
  const { actor, weapon, other } = weaponWithUpgrade(FILES.reinforced, { hardpoint: { type: 'integrated' } });
  expect(ruleFiresAsReinforced(actor, weapon)).toBe(true);
  expect(firesAsReinforced(actor, weapon)).toBe(true);
  expect(firesAsReinforced(actor, other)).toBe(false);
  add(actor, itemFrom(FILES.reinforced, { flags: { essence20: { parentId: other.id } } }));
  expect(firesAsReinforced(actor, other)).toBe(true);
});

/* ---- Boarder (was weapon-traits.mjs#hasBoarder + dice.mjs) ---- */

test('Boarder: Edge on Athletics and Acrobatics while on the sheet', () => {
  const actor = makeActor([FILES.boarder]);
  expect(sources(actor, { rolledSkill: 'athletics' })).toEqual([expect.objectContaining({ edge: true })]);
  expect(sources(actor, { rolledSkill: 'acrobatics' })).toEqual([expect.objectContaining({ edge: true })]);
  expect(sources(actor, { rolledSkill: 'driving' })).toEqual([]);
});

/* ---- Reprogrammable (was nanomite-uses.mjs#getDailyUsesMax) ---- */

test('Reprogrammable: each copy adds 2 daily uses to every nanomite power', () => {
  const power = (type = 'nanomite') => itemFrom({ name: 'Repair Machine', type: 'power', system: { type, usesPer: 2, usesInterval: 'perDay', usesSpent: 0 } });
  const nanomite = power();
  const grid = power('grid');
  const actor = makeActor([nanomite, grid, FILES.reprogrammable]);
  ruleDerived(actor);
  expect(getDailyUsesMax(actor, nanomite)).toBe(4);
  expect(getDailyUsesMax(actor, grid)).toBe(2);

  const twice = power();
  const two = makeActor([twice, FILES.reprogrammable, FILES.reprogrammable]);
  ruleDerived(two);
  expect(getDailyUsesMax(two, twice)).toBe(6);
});

/* ---- Leadfoot (was roll-dialog.mjs#_isUntrainedSnag) ---- */

test('Leadfoot: no untrained Snag on Alertness while driving', () => {
  const actor = makeActor([FILES.leadfoot]);
  expect(ruleNoUntrainedSnag(actor, 'alertness')).toBe(false);
  global.game.actors = [{ type: 'vehicle', system: { actors: { a: { uuid: actor.uuid, vehicleRole: 'driver' } } } }];
  expect(ruleNoUntrainedSnag(actor, 'alertness')).toBe(true);
  expect(ruleNoUntrainedSnag(actor, 'athletics')).toBe(false);
  global.game.actors = [{ type: 'vehicle', system: { actors: { a: { uuid: actor.uuid, vehicleRole: 'gunner' } } } }];
  expect(ruleNoUntrainedSnag(actor, 'alertness')).toBe(false);
});

/* ---- HazardProtection (was environment-hazards.mjs#getEnvironmentProtection) ---- */

describe('environment protections', () => {
  beforeAll(() => {
    if (!ENVIRONMENT_PROTECTORS.includes(ruleHazardProtection)) {
      ENVIRONMENT_PROTECTORS.push(ruleHazardProtection);
    }
  });

  const protects = (actor, environment) => ruleHazardProtection(actor, environment, ENVIRONMENT_HAZARDS[environment]);

  test('Environmentally Sealed covers the breathing hazards, only while Morphed', () => {
    const morphed = makeActor([FILES.sealed], { system: { isMorphed: true } });
    expect(protects(morphed, 'vacuum')).toBe('Environmentally Sealed');
    expect(protects(morphed, 'toxicAtmosphere')).toBe('Environmentally Sealed');
    expect(protects(morphed, 'extremeHeat')).toBeNull();
    expect(protects(makeActor([FILES.sealed]), 'vacuum')).toBeNull();
    expect(getEnvironmentProtection(morphed, 'vacuum')).toBe('Environmentally Sealed');
  });

  test('Environmental Aegis also covers temperature while Morphed', () => {
    const morphed = makeActor([FILES.aegis], { system: { isMorphed: true } });
    expect(protects(morphed, 'extremeCold')).toBe('Environmental Aegis');
    expect(protects(morphed, 'thickAtmosphere')).toBe('Environmental Aegis');
    expect(protects(morphed, 'corrosiveAtmosphere')).toBeNull();
    expect(protects(makeActor([FILES.aegis]), 'extremeCold')).toBeNull();
  });

  test.each(FILES.masks)('an equipped gas mask (%s) covers a Toxic Atmosphere only', file => {
    const mask = itemFrom(file, { system: { equipped: true } });
    const actor = makeActor([mask]);
    expect(protects(actor, 'toxicAtmosphere')).toBe(mask.name);
    expect(protects(actor, 'vacuum')).toBeNull();
    expect(protects(makeActor([itemFrom(file, { system: { equipped: false } })]), 'toxicAtmosphere')).toBeNull();
  });

  test.each(FILES.scuba)("Scuba Gear's breathing assistance (%s) covers Thick and Thin Atmosphere", file => {
    const actor = makeActor([itemFrom(file, { system: { equipped: true } })]);
    expect(protects(actor, 'thinAtmosphere')).toBe('Scuba Gear');
    expect(protects(actor, 'thickAtmosphere')).toBe('Scuba Gear');
    expect(protects(actor, 'vacuum')).toBeNull();
    expect(protects(makeActor([itemFrom(file, { system: { equipped: false } })]), 'thinAtmosphere')).toBeNull();
  });
});

/* ---- Read the Land / Adaptation (was banked-buffs.mjs canUsePerk / onPerkUse) ---- */

describe('Read the Land and Adaptation: a toggle on the Environmental Expertise flag', () => {
  let story;
  beforeEach(() => {
    story = { canSpendForActor: jest.fn(() => true), spendForActor: jest.fn(async () => {}), canWriteStoryPoints: () => true };
    setStoryPointHelpers(story);
  });

  afterAll(() => setStoryPointHelpers(null));

  const available = item => item.system.rules.map((rule, index) => ({ rule, index })).filter(({ rule, index }) => rule.type == 'Use' && useAvailable(item, rule, index));
  const holding = (file, { active = false, points = 1 } = {}) => {
    const rolePoints = itemFrom({ name: 'Adaptation Points', type: 'rolePoints', system: { resource: { value: points, max: 3 } } });
    const actor = makeActor([file, rolePoints]);
    actor._getBaseRolePoints = () => rolePoints;
    if (active) {
      actor.flags.essence20[FLAG] = true;
    }

    return { actor, item: actor.items.contents[0], rolePoints };
  };

  test('Read the Land: available to switch ON only when a Story Point can be spent', () => {
    const { item } = holding(FILES.readTheLand);
    expect(available(item).map(({ rule }) => rule.label)).toEqual(['Switch on']);
    story.canSpendForActor = jest.fn(() => false);
    expect(available(item)).toEqual([]);
  });

  test('Read the Land: free to switch back OFF, whatever the Story Points', () => {
    story.canSpendForActor = jest.fn(() => false);
    const { item } = holding(FILES.readTheLand, { active: true });
    expect(available(item).map(({ rule }) => rule.label)).toEqual(['Switch off']);
  });

  test('Read the Land: spends 1 Story Point and switches the flag on; switching off spends nothing', async () => {
    const { actor, item } = holding(FILES.readTheLand);
    const paid = pay();
    expect(await runUse(item, paid)).toContain('environment of expertise');
    expect(story.spendForActor).toHaveBeenCalledWith(actor, 1);
    expect(actor.flags.essence20[FLAG]).toBe(true);
    expect(paid).not.toHaveBeenCalled();

    story.spendForActor.mockClear();
    rebuildIndex(actor);
    expect(await runUse(item, paid)).toBeTruthy();
    expect(story.spendForActor).not.toHaveBeenCalled();
    expect(actor.flags.essence20[FLAG]).toBe(false);
  });

  test('Adaptation: available to switch ON only with an Adaptation Point, OFF always', () => {
    expect(available(holding(FILES.adaptation, { points: 1 }).item).map(({ rule }) => rule.label)).toEqual(['Switch on']);
    expect(available(holding(FILES.adaptation, { points: 0 }).item)).toEqual([]);
    expect(available(holding(FILES.adaptation, { points: 0, active: true }).item).map(({ rule }) => rule.label)).toEqual(['Switch off']);
  });

  test('Adaptation: spends 1 Adaptation Point to switch on (no action), nothing to switch off', async () => {
    const { actor, item, rolePoints } = holding(FILES.adaptation, { points: 2 });
    const paid = pay();
    expect(await runUse(item, paid)).toBeTruthy();
    expect(rolePoints.system.resource.value).toBe(1);
    expect(actor.flags.essence20[FLAG]).toBe(true);
    expect(paid).not.toHaveBeenCalled();

    expect(await runUse(item, paid)).toBeTruthy();
    expect(rolePoints.system.resource.value).toBe(1);
    expect(actor.flags.essence20[FLAG]).toBe(false);
  });
});

/* ---- Power Fist (was alteration-handler.mjs) ---- */

describe('Power Fist: grants Close Combat Heavy Bludgeoning', () => {
  const load = jest.fn(async uuid => ({ toObject: () => ({ _id: 'w', name: 'Close Combat Heavy Bludgeoning', type: 'weapon', system: { items: {} } }), uuid }));

  test('alongside the Alteration', async () => {
    const actor = makeActor([FILES.powerFist]);
    const [data, ...rest] = await grantData(actor.items.contents[0], actor, { load });
    expect(rest).toEqual([]);
    expect(load).toHaveBeenCalledWith(CC_HEAVY_BLUDGEONING);
    expect(data).toMatchObject({ type: 'weapon', _stats: { compendiumSource: CC_HEAVY_BLUDGEONING } });
  });

  test('not a second copy if the actor already has one', async () => {
    const owned = itemFrom({ name: 'Close Combat Heavy Bludgeoning', type: 'weapon', system: {} });
    owned.flags.core.sourceId = CC_HEAVY_BLUDGEONING;
    const actor = makeActor([FILES.powerFist, owned]);
    expect(await grantData(actor.items.contents[0], actor, { load })).toEqual([]);
  });
});

/* ---- Zeo Crystal Wielder (was power-handler.mjs#fixedPowerCost) ---- */

test('Zeo Crystal Wielder makes Zeo Crystal Boost cost 1 less', () => {
  const boost = itemFrom({ _id: 'NiEaLWcx8N48fvvN', name: 'Zeo Crystal Boost', type: 'power', system: { type: 'grid', powerCost: 2 } });
  const other = itemFrom({ _id: 'otherPower000000', name: 'Other', type: 'power', system: { type: 'grid', powerCost: 2 } });
  const actor = makeActor([boost, other, FILES.zeoWielder]);
  ruleDerived(actor);
  expect(fixedPowerCost(actor, boost)).toBe(1);
  expect(fixedPowerCost(actor, other)).toBe(2);

  const without = itemFrom({ _id: 'NiEaLWcx8N48fvvN', name: 'Zeo Crystal Boost', type: 'power', system: { type: 'grid', powerCost: 2 } });
  const plain = makeActor([without]);
  ruleDerived(plain);
  expect(fixedPowerCost(plain, without)).toBe(2);
});

/* ---- Restraining Chains (was zord-feature-handler.mjs#onRestrainingChainsDrop) ---- */

test('Restraining Chains: adding it makes a fixed Grapple ranged attack (30ft / 65ft, no dialog)', async () => {
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  const actor = makeActor([], { type: 'zord' });
  const feature = add(actor, itemFrom(FILES.restrainingChains));
  await fireItemAdded(actor, feature);

  const [[, [weapon]], [, [effect]]] = actor.createEmbeddedDocuments.mock.calls;
  expect(weapon).toMatchObject({ name: 'Restraining Chains', type: 'weapon', flags: { essence20: { grantedBy: feature.id } } });
  const made = actor.items.contents.find(item => item.type == 'weapon');
  expect(effect).toMatchObject({
    type: 'weaponEffect',
    flags: { essence20: { parentId: made.id } },
    system: {
      classification: { skill: 'targeting', style: 'projectile' }, damageType: 'grapple', damageValue: 0, defenseType: 'toughness',
      range: { min: null, reachMultiplier: 1, long: 65, value: 30 },
    },
  });
});
