import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Batch slA5 (docs/rules-batches/slA5.md): the zord1 / zord2 / pr1 / pr2 / pr3 slice items re-checked
 * against the round-5 engine pieces. Converted: Survivor (essenceChanged + table), Unique Weapon (Green
 * Ranger) (choose + a 1d4 table), Unique Weapon (Ranged) store / draw (updateItem, gainResource overMax,
 * {@formula} in chat), Power Wing (equipped / unequipped), Dino Gem Integration and Energem Infusion
 * (pick ownedItem with filter + auto), Lightspeed Boost's Movement / HAZMAT / Pyrotechnic, Advanced Dino
 * Gem Integration's Enhanced Stealth (Movement afterGravity) and Shinobi of the 63rd Hexagram's
 * motorcycle Driving (vehicle:name~). Each is loaded from its pack source and must do what the removed
 * slice code did.
 */

// The picker the pick steps ask (mechanics/resources/grants.mjs); attachment copying is Foundry-heavy and not needed.
// (Mocked paths resolve from module/jest.setup.js, hence ./helpers and ./sheet-handlers.)
const chooseSelect = jest.fn();
jest.unstable_mockModule('./mechanics/resources/grants.mjs', () => ({ chooseSelect, rollTest: jest.fn(), markIntegrated: jest.fn() }));
jest.unstable_mockModule('./sheet-handlers/attachment-handler.mjs', () => ({
  ...Object.fromEntries(['onAttachableParentDrop', 'onEquipmentPackageDrop', 'grantItemEntry', 'onAttachmentDrop', '_attachSelectedItemOptionHandler',
    '_attachItem', 'grantLinkedWeaponEffect', 'createEntry', '_addItemIfUnique', 'deleteAttachmentsForItem'].map(name => [name, jest.fn()])),
  setEntryAndAddItem: jest.fn(async () => 'k1'),
  createItemCopies: jest.fn(async () => {}),
}));

// Round-10 plug-ins: rule types some of these items now also carry (Advanced Dino Gem's SummonTime).
await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { ruleDerived, ruleMovementStages, ruleNoUntrainedSnag, ruleRollSources } = await import('./adapter.mjs');
const { fireItemAdded, fireTriggers, runUse, useAvailable } = await import('./triggers.mjs');
const { validateRule } = await import('./types.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

const FILES = {
  survivor: 'prcrbitems/_source/Survivor_YmSnQxVytktWfZTZ.json',
  uniqueWeapon: 'prcrbitems/_source/Unique_Weapon_TG2rarEjGgDeOsc5.json',
  uwRanged: 'prcrbitems/_source/Unique_Weapon_Ranged__Pr3UniqWpnRanged.json',
  powerWing: 'atsitems/_source/Power_Wing_aCPFmjY80u9671Hl.json',
  dinoGem: 'bthitems/_source/Dino_Gem_Integration_q9lciavy0Nfh0rR8.json',
  energem: 'bthitems/_source/Energem_Infusion_ZLQCeC2gGWHnYEBQ.json',
  lightspeed: 'atsitems/_source/Lightspeed_Boost_sap5gMPDrWvjLCCu.json',
  advancedDinoGem: 'bthitems/_source/Advanced_Dino_Gem_Integration_K4CUMFhAjXRFzGbA.json',
  shinobi: 'iafav2items/_source/Shinobi_of_the_63rd_Hexagram_JFfMXY6aMxhDbKa6.json',
};

let nextId = 1;

function setPath(object, key, value) {
  const keys = key.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
}

function asItem(data, actor) {
  const item = {
    id: `i${nextId++}`, flags: {}, system: {}, isOwner: true, ...data, parent: actor,
    async update(changes) {
      for (const [key, value] of Object.entries(changes)) {
        setPath(this, key, value);
      }
    },
    async setFlag(scope, key, value) {
      setPath(this, `flags.${scope}.${key}`, value);
    },
  };
  item.uuid = `${actor.uuid}.Item.${item.id}`;
  return item;
}

function makeActor(type = 'playerCharacter', system = {}) {
  const items = [];
  const actor = {
    id: `a${nextId++}`, name: 'Ranger', type, isOwner: true, statuses: new Set(), flags: { essence20: {} },
    system: { health: { value: 5, max: 10 }, powers: { personal: { value: 2, max: 2 } }, essences: { smarts: { value: 0, max: 3 } }, ...system },
    update: jest.fn(async function (data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    }),
    async createEmbeddedDocuments(kind, datas) {
      const made = datas.map(data => asItem({ ...data, flags: data.flags ?? {} }, this));
      items.push(...made);
      rebuildIndex(this);
      return made;
    },
    async updateEmbeddedDocuments() {},
  };
  actor.uuid = `Actor.${actor.id}`;
  actor.items = { contents: items, get: id => items.find(item => item.id == id), [Symbol.iterator]: () => items[Symbol.iterator]() };
  return actor;
}

function addPackItem(actor, file, extra = {}) {
  const doc = fromPack(file);
  const item = asItem({
    name: doc.name, type: doc.type, system: { ...doc.system, ...(extra.system ?? {}) }, flags: extra.flags ?? {},
    _stats: { compendiumSource: `Compendium.essence20.x.Item.${doc._id}` },
  }, actor);
  actor.items.contents.push(item);
  rebuildIndex(actor);
  return item;
}

function addItem(actor, data) {
  const item = asItem(data, actor);
  actor.items.contents.push(item);
  rebuildIndex(actor);
  return item;
}

const pickUse = label => async (item, available) => available.find(({ rule }) => rule.label == label) ?? null;
const usable = (item, label) => {
  const index = item.system.rules.findIndex(rule => rule.type == 'Use' && rule.label == label);
  return index >= 0 && useAvailable(item, item.system.rules[index], index);
};

beforeEach(() => {
  global.game = {
    combat: null, user: { id: 'u', isGM: true, targets: new Set() }, users: { activeGM: null }, actors: { contents: [] }, settings: { get: () => 1 },
    i18n: { localize: k => k, format: k => k },
  };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: {
      ...(global.foundry?.utils ?? {}),
      getProperty: (object, key) => key.split('.').reduce((o, k) => o?.[k], object),
      setProperty: setPath,
      hasProperty: (object, key) => key.split('.').reduce((o, k) => o?.[k], object) !== undefined,
      deepClone: value => JSON.parse(JSON.stringify(value)),
    },
  };
  chooseSelect.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
  delete global.fromUuid;
});

test('every rule added in this batch is valid', () => {
  for (const file of Object.values(FILES)) {
    for (const rule of fromPack(file).system.rules) {
      expect(validateRule(rule)).toEqual([]);
    }
  }
});

/* -------------------------------------------- */
/*  Survivor (pr3/pr-crb.mjs)                    */
/* -------------------------------------------- */

describe('Survivor: Smarts dropping to 0 rolls a d20, 10+ keeps it at 1', () => {
  test('a 10 or more sets Smarts back to 1', async () => {
    const ranger = makeActor();
    addPackItem(ranger, FILES.survivor);
    jest.spyOn(Math, 'random').mockReturnValue(0.5); // 1d20 -> 11
    await fireTriggers(ranger, 'essenceChanged', { vars: { essence: 'smarts', change: -1 } });
    expect(ranger.update).toHaveBeenCalledWith({ 'system.essences.smarts.value': 1 });
    expect(ranger.system.essences.smarts.value).toBe(1);
    expect(ChatMessage.create.mock.calls[0][0].content).toContain('Smarts stays at 1.');
  });

  test('a 9 or less leaves it at 0', async () => {
    const ranger = makeActor();
    addPackItem(ranger, FILES.survivor);
    jest.spyOn(Math, 'random').mockReturnValue(0.4); // 1d20 -> 9
    await fireTriggers(ranger, 'essenceChanged', { vars: { essence: 'smarts', change: -1 } });
    expect(ranger.update).not.toHaveBeenCalled();
    expect(ChatMessage.create.mock.calls[0][0].content).toContain('Smarts drops to 0.');
  });

  test('only Smarts, and only at 0', async () => {
    const ranger = makeActor('playerCharacter', { essences: { smarts: { value: 2, max: 3 }, strength: { value: 0, max: 3 } } });
    addPackItem(ranger, FILES.survivor);
    jest.spyOn(Math, 'random').mockReturnValue(0.9);
    await fireTriggers(ranger, 'essenceChanged', { vars: { essence: 'smarts', change: -1 } });
    await fireTriggers(ranger, 'essenceChanged', { vars: { essence: 'strength', change: -3 } });
    expect(ranger.update).not.toHaveBeenCalled();
    expect(ChatMessage.create).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------- */
/*  Unique Weapon (pr3/pr-crb.mjs)               */
/* -------------------------------------------- */

describe('Unique Weapon (Green Ranger): pick or roll one of the four weapons, once', () => {
  const UW = id => `Compendium.essence20.pr_crb.Item.${id}`;
  const NAMES = { Pr3UniqWpnRanged: 'Unique Weapon (Ranged)', Pr3UniqWpnSmallM: 'Unique Weapon (Small Melee)', Pr3UniqWpnVersat: 'Unique Weapon (Versatile)', Pr3UniqWpnTwoHnd: 'Unique Weapon (Two-Handed Melee)' };

  beforeEach(() => {
    global.fromUuid = jest.fn(async uuid => {
      const id = Object.keys(NAMES).find(key => UW(key) == uuid);
      return id ? { toObject: () => ({ name: NAMES[id], type: 'weapon', system: {}, flags: {} }) } : null;
    });
  });

  test('a chosen weapon is granted (by the Perk) and the button goes away', async () => {
    const ranger = makeActor();
    const perk = addPackItem(ranger, FILES.uniqueWeapon);
    expect(usable(perk, 'Unique Weapon')).toBe(true);
    const ask = jest.fn(async (step, options) => options.findIndex(option => option.label == 'Small Melee'));
    expect(await runUse(perk, async () => true, { ask })).toContain('Unique Weapon (Small Melee)');
    const weapon = ranger.items.contents.find(item => item.type == 'weapon');
    expect(weapon.name).toBe('Unique Weapon (Small Melee)');
    expect(weapon._stats.compendiumSource).toBe(UW('Pr3UniqWpnSmallM'));
    expect(weapon.flags.essence20.grantedBy).toBe(perk.id);
    expect(perk.flags.essence20.pr3Granted).toBe(true);
    expect(usable(perk, 'Unique Weapon')).toBe(false);
  });

  test('rolling: 1d4 picks the row (3 = Versatile)', async () => {
    const ranger = makeActor();
    const perk = addPackItem(ranger, FILES.uniqueWeapon);
    jest.spyOn(Math, 'random').mockReturnValue(0.5); // 1d4 -> 3
    const ask = jest.fn(async (step, options) => options.findIndex(option => option.label == 'Roll'));
    await runUse(perk, async () => true, { ask });
    expect(ranger.items.contents.filter(item => item.type == 'weapon').map(item => item.name)).toEqual(['Unique Weapon (Versatile)']);
    expect(perk.flags.essence20.pr3Granted).toBe(true);
  });

  test('a copy granted the old way (pr3Granted) has no button', () => {
    const ranger = makeActor();
    const perk = addPackItem(ranger, FILES.uniqueWeapon, { flags: { essence20: { pr3Granted: 'old' } } });
    expect(usable(perk, 'Unique Weapon')).toBe(false);
  });

  test('cancelling grants nothing', async () => {
    const ranger = makeActor();
    const perk = addPackItem(ranger, FILES.uniqueWeapon);
    await runUse(perk, async () => true, { ask: async () => null });
    expect(ranger.items.contents.filter(item => item.type == 'weapon')).toEqual([]);
    expect(perk.flags.essence20?.pr3Granted).toBeUndefined();
  });
});

describe('Unique Weapon (Ranged): store up to 3 Personal Power, draw it back (even over the maximum)', () => {
  test('store spends 1 Power into the weapon; draw gives it back past the maximum', async () => {
    const ranger = makeActor();
    const gun = addPackItem(ranger, FILES.uwRanged, { system: { equipped: true } });
    expect(usable(gun, 'Store 1 Personal Power')).toBe(true);
    expect(usable(gun, 'Draw 1 Personal Power')).toBe(false);

    expect(await runUse(gun, async () => true, { pick: pickUse('Store 1 Personal Power') })).toContain('Personal Power stored: 1');
    expect(ranger.system.powers.personal.value).toBe(1);
    expect(gun.flags.essence20.pr3StoredPower).toBe(1);
    await runUse(gun, async () => true, { pick: pickUse('Store 1 Personal Power') });
    expect(ranger.system.powers.personal.value).toBe(0);
    // No Power left to store.
    expect(usable(gun, 'Store 1 Personal Power')).toBe(false);

    ranger.system.powers.personal.value = 2;
    expect(await runUse(gun, async () => true, { pick: pickUse('Draw 1 Personal Power') })).toContain('Personal Power stored: 1');
    expect(ranger.system.powers.personal.value).toBe(3);
    expect(gun.flags.essence20.pr3StoredPower).toBe(1);
  });

  test('three stored is the most', () => {
    const ranger = makeActor();
    const gun = addPackItem(ranger, FILES.uwRanged, { system: { equipped: true }, flags: { essence20: { pr3StoredPower: 3 } } });
    expect(usable(gun, 'Store 1 Personal Power')).toBe(false);
    expect(usable(gun, 'Draw 1 Personal Power')).toBe(true);
  });
});

/* -------------------------------------------- */
/*  Power Wing (pr1/ats.mjs)                     */
/* -------------------------------------------- */

describe('Power Wing: bonding adds 2 current Personal Power, removing it takes 2 (not below 0)', () => {
  test('equipped / unequipped', async () => {
    const ranger = makeActor('playerCharacter', { powers: { personal: { value: 3, max: 6 } } });
    const wing = addPackItem(ranger, FILES.powerWing, { system: { equipped: true } });
    await fireItemAdded(ranger, wing, { event: 'equipped' });
    expect(ranger.system.powers.personal.value).toBe(5);
    await fireItemAdded(ranger, wing, { event: 'unequipped' });
    expect(ranger.system.powers.personal.value).toBe(3);
    ranger.system.powers.personal.value = 1;
    await fireItemAdded(ranger, wing, { event: 'unequipped' });
    expect(ranger.system.powers.personal.value).toBe(0);
  });

  test("another item being equipped doesn't touch the Power", async () => {
    const ranger = makeActor('playerCharacter', { powers: { personal: { value: 3, max: 6 } } });
    addPackItem(ranger, FILES.powerWing, { system: { equipped: true } });
    const sword = addItem(ranger, { name: 'Sword', type: 'weapon', system: { equipped: true } });
    await fireTriggers(ranger, 'equipped', { roll: { item: sword }, skipItem: sword });
    expect(ranger.system.powers.personal.value).toBe(3);
  });

  test('an actor without Personal Power is left alone', async () => {
    const ranger = makeActor();
    delete ranger.system.powers;
    const wing = addPackItem(ranger, FILES.powerWing, { system: { equipped: true } });
    await fireItemAdded(ranger, wing, { event: 'equipped' });
    expect(ranger.update).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------- */
/*  Dino Gem Integration / Energem (pr2/zords)   */
/* -------------------------------------------- */

describe('Dino Gem Integration / Energem Infusion: change one ranged energy attack when added', () => {
  function zordWithAttacks(extra = []) {
    const zord = makeActor('zord');
    const laser = addItem(zord, { name: 'Laser', type: 'weaponEffect', system: { damageValue: 2, damageType: 'laser', classification: { style: 'ranged' }, range: { value: 50, long: 120 } } });
    addItem(zord, { name: 'Bite', type: 'weaponEffect', system: { damageValue: 2, damageType: 'fire', classification: { style: 'melee' } } });
    addItem(zord, { name: 'Cannon', type: 'weaponEffect', system: { damageValue: 3, damageType: 'blunt', classification: { style: 'ranged' } } });
    for (const data of extra) {
      addItem(zord, data);
    }

    return { zord, laser };
  }

  test('Dino Gem: the lone ranged energy attack is taken; red makes it Fire; the ↑1 rides it', async () => {
    const { zord, laser } = zordWithAttacks();
    const gem = addPackItem(zord, FILES.dinoGem);
    chooseSelect.mockResolvedValueOnce('red');
    await fireItemAdded(zord, gem);
    expect(chooseSelect).toHaveBeenCalledTimes(1);
    expect(chooseSelect.mock.calls[0][2].map(option => option.value)).toEqual(['black', 'blue', 'green', 'pink', 'red', 'yellow']);
    expect(laser.system.damageType).toBe('fire');
    expect(laser.system.damageValue).toBe(2);
    expect(laser.flags.essence20.pr2GemBoost.dinoGem).toBe(true);

    const sources = ruleRollSources(zord, null, { isAttack: true, item: laser }).sources;
    expect(sources.find(source => source.label == 'Dino Gem Integration (↑1)')?.shiftUp).toBe(1);
    const cannon = zord.items.contents.find(item => item.name == 'Cannon');
    expect(ruleRollSources(zord, null, { isAttack: true, item: cannon }).sources.some(source => source.label == 'Dino Gem Integration (↑1)')).toBe(false);
  });

  test('Dino Gem: several energy attacks are asked; blue adds 50 ft range', async () => {
    const { zord, laser } = zordWithAttacks([{ name: 'Sonic Blast', type: 'weaponEffect', system: { damageValue: 1, damageType: 'sonic', classification: { style: 'ranged' } } }]);
    const gem = addPackItem(zord, FILES.dinoGem);
    chooseSelect.mockResolvedValueOnce(laser.id).mockResolvedValueOnce('blue');
    await fireItemAdded(zord, gem);
    expect(chooseSelect.mock.calls[0][2].map(option => option.label)).toEqual(['Laser', 'Sonic Blast']);
    expect(laser.system.range).toEqual({ value: 100, long: 170 });
    expect(laser.system.damageType).toBe('laser');
  });

  test('Energem: +1 damage, the colour optional (green is +1 more)', async () => {
    const { zord, laser } = zordWithAttacks();
    const energem = addPackItem(zord, FILES.energem);
    chooseSelect.mockResolvedValueOnce('none');
    await fireItemAdded(zord, energem);
    expect(chooseSelect.mock.calls[0][2][0].value).toBe('none');
    expect(laser.system.damageValue).toBe(3);
    expect(laser.system.damageType).toBe('laser');
    expect(laser.flags.essence20.pr2GemBoost.energem).toBe(true);

    const second = zordWithAttacks();
    const other = addPackItem(second.zord, FILES.energem);
    chooseSelect.mockResolvedValueOnce('green');
    await fireItemAdded(second.zord, other);
    expect(second.laser.system.damageValue).toBe(4);
    // Energem gives no ↑1.
    expect(ruleRollSources(second.zord, null, { isAttack: true, item: second.laser }).sources).toEqual([]);
  });

  test('a copy set up before (the old flag, or its own picks) is not changed again', async () => {
    const { zord, laser } = zordWithAttacks();
    const old = addPackItem(zord, FILES.dinoGem, { flags: { essence20: { pr2GemBoost: { effectId: laser.id, colour: 'red' } } } });
    await fireItemAdded(zord, old);
    const picked = addPackItem(zord, FILES.energem, { flags: { essence20: { rules: { choices: { attack: laser.id, colour: 'green' } } } } });
    await fireItemAdded(zord, picked);
    expect(chooseSelect).not.toHaveBeenCalled();
    expect(laser.system).toMatchObject({ damageValue: 2, damageType: 'laser' });
  });
});

/* -------------------------------------------- */
/*  Lightspeed Boost (pr1/ats.mjs)               */
/* -------------------------------------------- */

describe("Lightspeed Boost: the pick's Movement, Resistances and Fire Immunity", () => {
  const zordWith = (choice, movement = { ground: { total: 40 }, aerial: { total: 0 }, swim: { total: 0 }, climb: { total: 20 }, burrow: { total: 0 } }) => {
    const zord = makeActor('zord', { movement, resistances: { acid: false, cold: false, sonic: false }, immunities: { fire: false, poison: false } });
    const feature = addPackItem(zord, FILES.lightspeed, { flags: { essence20: { pr1LightspeedBoost: choice } } });
    return { zord, feature };
  };

  test('Aeronautic / Aquatic: at least 40 ft (after gravity)', () => {
    const { zord } = zordWith({ option: 'aeronautic' });
    const stage = ruleMovementStages(zord);
    expect(stage('afterGravity', 'aerial', 0)).toBe(40);
    expect(stage('afterGravity', 'aerial', 60)).toBe(60);
    expect(stage('final', 'aerial', 0)).toBeNull();
    expect(stage('afterGravity', 'swim', 0)).toBeNull();
    expect(ruleMovementStages(zordWith({ option: 'aquatic' }).zord)('afterGravity', 'swim', 10)).toBe(40);
  });

  test('Medical: +10 ft to every Movement it already has', () => {
    const { zord } = zordWith({ option: 'medical' });
    const stage = ruleMovementStages(zord);
    expect(stage('afterGravity', 'ground', 40)).toBe(50);
    expect(stage('afterGravity', 'climb', 20)).toBe(30);
    expect(stage('afterGravity', 'aerial', 0)).toBeNull();
    expect(stage('afterGravity', 'swim', 0)).toBeNull();
  });

  test('HAZMAT: two Resistances or one Immunity; Pyrotechnic: Fire Immunity', () => {
    const resist = zordWith({ option: 'hazmat', how: 'resist', types: ['acid', 'sonic'] }).zord;
    ruleDerived(resist);
    expect(resist.system.resistances).toEqual({ acid: true, cold: false, sonic: true });
    expect(resist.system.immunities).toEqual({ fire: false, poison: false });

    const immune = zordWith({ option: 'hazmat', how: 'immune', types: ['poison'] }).zord;
    ruleDerived(immune);
    expect(immune.system.immunities).toEqual({ fire: false, poison: true });
    expect(immune.system.resistances).toEqual({ acid: false, cold: false, sonic: false });

    const pyro = zordWith({ option: 'pyrotechnic' }).zord;
    ruleDerived(pyro);
    expect(pyro.system.immunities.fire).toBe(true);
  });

  test("Pyrotechnic's extinguish button costs a Standard action; nothing before the pick", async () => {
    const { feature } = zordWith({ option: 'pyrotechnic' });
    const label = 'Extinguish a 20 x 20 ft area (Pyrotechnic)';
    expect(usable(feature, label)).toBe(true);
    const pay = jest.fn(async () => true);
    expect(await runUse(feature, pay, { pick: pickUse(label) })).toContain('puts out the fire');
    expect(pay).toHaveBeenCalledWith('standard');
    expect(usable(zordWith({ option: 'medical' }).feature, label)).toBe(false);
    expect(usable(zordWith(undefined).feature, label)).toBe(false);
  });

  test('only on a Zord', () => {
    const ranger = makeActor('playerCharacter', { movement: { ground: { total: 30 } } });
    addPackItem(ranger, FILES.lightspeed, { flags: { essence20: { pr1LightspeedBoost: { option: 'medical' } } } });
    expect(ruleMovementStages(ranger)('afterGravity', 'ground', 30)).toBeNull();
  });
});

/* -------------------------------------------- */
/*  Advanced Dino Gem Integration (pr1/misc)     */
/* -------------------------------------------- */

describe('Advanced Dino Gem Integration: Enhanced Stealth adds 10 ft to each Movement the Zord has', () => {
  test.each([
    ['its own pick', { rules: { choices: { gem: 'stealth' } } }],
    ['the old flag', { pr1DinoGem: 'stealth' }],
  ])('%s', (name, flags) => {
    const zord = makeActor('zord', { movement: { ground: { total: 40 }, swim: { total: 0 } } });
    addPackItem(zord, FILES.advancedDinoGem, { flags: { essence20: flags } });
    const stage = ruleMovementStages(zord);
    expect(stage('afterGravity', 'ground', 40)).toBe(50);
    expect(stage('afterGravity', 'swim', 0)).toBeNull();
  });

  test('another pick adds nothing', () => {
    const zord = makeActor('zord', { movement: { ground: { total: 40 } } });
    addPackItem(zord, FILES.advancedDinoGem, { flags: { essence20: { pr1DinoGem: 'sense' } } });
    expect(ruleMovementStages(zord)('afterGravity', 'ground', 40)).toBeNull();
  });
});

/* -------------------------------------------- */
/*  Shinobi of the 63rd Hexagram (zord2/snag)    */
/* -------------------------------------------- */

describe('Shinobi of the 63rd Hexagram: no untrained Snag driving a motorcycle', () => {
  function ninjaOn(vehicleName, role = 'driver') {
    const ninja = makeActor();
    addPackItem(ninja, FILES.shinobi);
    const vehicle = { id: 'v', uuid: 'Actor.v', name: vehicleName, type: 'vehicle', system: { actors: { a: { uuid: ninja.uuid, vehicleRole: role } } }, items: { contents: [] } };
    game.actors.contents.push(vehicle);
    return ninja;
  }

  test('driving a cycle / bike / chopper', () => {
    expect(ruleNoUntrainedSnag(ninjaOn('Lightning Cycle'), 'driving')).toBe(true);
    game.actors.contents.length = 0;
    expect(ruleNoUntrainedSnag(ninjaOn('Motorbike'), 'driving')).toBe(true);
  });

  test('not another Skill, another vehicle, or riding as a passenger', () => {
    const ninja = ninjaOn('Lightning Cycle');
    expect(ruleNoUntrainedSnag(ninja, 'athletics')).toBe(false);
    game.actors.contents.length = 0;
    expect(ruleNoUntrainedSnag(ninjaOn('Tank'), 'driving')).toBe(false);
    game.actors.contents.length = 0;
    expect(ruleNoUntrainedSnag(ninjaOn('Lightning Cycle', 'passenger'), 'driving')).toBe(false);
  });
});
