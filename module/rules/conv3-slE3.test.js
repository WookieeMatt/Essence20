import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * slE3: items of the qualify / data / MLP / Night Vale slices converted with the 2026-10-05 engine
 * pieces (rule:granted, createItem children, legacy picks). Each is loaded from its pack source and
 * must do what the removed slice code did.
 */

// Attaching a created / granted weapon's children goes through the sheet handler; record the calls.
const attached = [];
jest.unstable_mockModule('./sheet-handlers/attachment-handler.mjs', () => ({
  setEntryAndAddItem: jest.fn(async (child, host) => {
    attached.push([child.name, host.name]);
    return 'k1';
  }),
  createItemCopies: jest.fn(async () => []),
}));

const { rebuildIndex } = await import('./index.mjs');
const { ruleDialogSwitches } = await import('./adapter.mjs');
const { fireItemAdded, runUse, useAvailable } = await import('./triggers.mjs');
const { legacyChoiceUpdates } = await import('./legacy-choices.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

let nextId = 1;

function setPath(object, key, value) {
  const keys = key.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
}

/** An actor of `type` holding the pack item (plus `extra` items); created items land on it. */
function holder(file, { type = 'playerCharacter', extra = [], flags = {} } = {}) {
  const doc = fromPack(file);
  const item = {
    id: `c${nextId++}`, name: doc.name, type: doc.type, flags: { essence20: { ...flags } }, system: doc.system,
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    },
  };
  const list = [item, ...extra];
  const actor = {
    id: `a${nextId++}`, uuid: `Actor.h${nextId}`, name: 'Hero', type, isOwner: true, statuses: new Set(),
    flags: { essence20: {} }, system: { level: 3 },
    async createEmbeddedDocuments(kind, datas) {
      const made = datas.map(data => ({ ...data, id: `n${nextId++}`, parent: actor, isOwner: true, setFlag: jest.fn() }));
      list.push(...made);
      rebuildIndex(actor);
      return made;
    },
  };
  actor.items = { contents: list, get: id => list.find(i => i.id == id), [Symbol.iterator]: () => list[Symbol.iterator]() };
  for (const owned of list) {
    owned.parent = actor;
  }

  rebuildIndex(actor);
  return { actor, item, list };
}

/** The single-select picker answers `answer`; returns what it offered. */
function picker(answer) {
  const offered = [];
  global.foundry.applications = {
    api: { DialogV2: { wait: jest.fn(async ({ content, window }) => (offered.push({ content, title: window.title }), answer)) } },
  };
  return offered;
}

const offeredValues = offer => [...offer.content.matchAll(/value="([^"]+)"/g)].map(match => match[1]);
const pay = () => jest.fn(async () => true);
const usable = item => item.system.rules.some((rule, index) => rule.type == 'Use' && useAvailable(item, rule, index));

beforeEach(() => {
  attached.length = 0;
  global.game = { combat: null, user: { id: 'u', isGM: false, targets: new Set() }, i18n: { localize: k => k, format: k => k }, settings: { get: () => 1 } };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: {
      ...(global.foundry?.utils ?? {}),
      getProperty: (object, key) => key.split('.').reduce((o, k) => o?.[k], object),
      setProperty: setPath,
      deepClone: value => JSON.parse(JSON.stringify(value)),
      escapeHTML: text => String(text),
      randomID: () => `r${nextId++}`,
    },
  };
});

afterEach(() => {
  delete global.foundry.applications;
  delete global.fromUuid;
});

/* -------------------------------------------- */
/*  Night Vale pet attacks (wtnv)                */
/* -------------------------------------------- */

describe('slE3 wtnv: the pet attack Animal Perks', () => {
  const PETS = [
    ['Delicate_Stomach_W04dEJSSgaWOeebQ', 'Hairball', { skill: 'targeting', style: 'projectile' }, 'acid', { value: 30, long: 60 }, []],
    ['Pincers_WwU4Ebk3IY6Yr2jy', 'Pincers', { skill: 'might', style: 'melee' }, 'blunt', { reachMultiplier: 1 }, []],
    ['Quills_m9rPGuVLv5cmfqkm', 'Quills', { skill: 'targeting', style: 'projectile' }, 'sharp', { value: 30, long: 60 }, []],
    ['Serrated_Tail_MZCPG1uZPRUMzz4N', 'Serrated Tail', { skill: 'might', style: 'melee' }, 'sharp', { reachMultiplier: 1 }, ['trip']],
  ];

  test.each(PETS)('%s: added to a pet, it brings the weapon + attack once', async (file, name, classification, damageType, range, traits) => {
    const { actor, item, list } = holder(`wtnvcgitems/_source/${file}.json`, { type: 'companion' });
    await fireItemAdded(actor, item);
    const weapon = list.find(i => i.type == 'weapon');
    const effect = list.find(i => i.type == 'weaponEffect');
    expect(weapon).toMatchObject({
      name, system: { classification: { size: 'sidearm' }, availability: 'standard', equipped: true, hardpoint: { type: 'none' }, traits },
      flags: { essence20: { natural: true, grantedBy: item.id } },
    });
    expect(effect).toMatchObject({
      name, system: { classification, damageType, damageValue: 1, numTargets: 1, numHands: '0', range },
      flags: { essence20: { parentId: weapon.id } },
    });
    expect(attached).toEqual([[name, name]]);
    // Already there: adding it again and the Use button do nothing.
    await fireItemAdded(actor, item);
    expect(list.filter(i => i.type == 'weapon')).toHaveLength(1);
    expect(usable(item)).toBe(false);
  });

  test.each(PETS)('%s: the Use adds the attack while it is missing, on a pet only', async (file, name) => {
    const { item, list } = holder(`wtnvcgitems/_source/${file}.json`, { type: 'companion' });
    expect(usable(item)).toBe(true);
    const paid = pay();
    expect(await runUse(item, paid)).toBeTruthy();
    expect(paid).not.toHaveBeenCalled();
    expect(list.filter(i => i.type == 'weapon').map(i => i.name)).toEqual([name]);
    expect(usable(item)).toBe(false);
    // The attack gone again: the button is back.
    list.splice(list.findIndex(i => i.type == 'weapon'), 1);
    expect(usable(item)).toBe(true);

    // Not on a pet: nothing on adding, no Use.
    const pc = holder(`wtnvcgitems/_source/${file}.json`);
    await fireItemAdded(pc.actor, pc.item);
    expect(pc.list).toHaveLength(1);
    expect(usable(pc.item)).toBe(false);
  });
});

/* -------------------------------------------- */
/*  Screech (mlp2)                               */
/* -------------------------------------------- */

describe('slE3 mlp2: Screech and Wheel Excited', () => {
  test('Screech: the Use adds a 1 Blunt Targeting attack once, on any actor, no action', async () => {
    const { item, list } = holder('sotsitems/_source/Screech_0OA0R7F3JejAQpkf.json');
    expect(usable(item)).toBe(true);
    const paid = pay();
    expect(await runUse(item, paid)).toBeTruthy();
    expect(paid).not.toHaveBeenCalled();
    const weapon = list.find(i => i.type == 'weapon');
    expect(weapon).toMatchObject({
      name: 'Screech', system: { classification: { size: 'sidearm' }, availability: 'standard', equipped: true, hardpoint: { type: 'none' } },
      flags: { essence20: { natural: true, grantedBy: item.id } },
    });
    expect(list.find(i => i.type == 'weaponEffect')).toMatchObject({
      name: 'Screech',
      system: { classification: { skill: 'targeting', style: 'energy' }, damageType: 'blunt', damageValue: 1, numTargets: 1, numHands: '0', range: { value: 30, long: 60 } },
      flags: { essence20: { parentId: weapon.id } },
    });
    expect(usable(item)).toBe(false);
  });

  const WHEEL = 'mlpcrbitems/_source/Wheel_Excited_nJP3Jv15O5MFTNcA.json';
  const switches = actor => ruleDialogSwitches(actor, { rolledSkill: 'driving' }).map(s => s.label);

  test('Wheel Excited: the Use picks Land, Sea or Air; only that switch is offered', async () => {
    const { actor, item } = holder(WHEEL);
    expect(switches(actor)).toEqual([]);
    const offered = picker('sea');
    expect(await runUse(item, pay())).toBeTruthy();
    expect(offered[0].title).toBe('Wheel Excited');
    expect(offered[0].content).toContain('Which type of vehicle?');
    expect(offeredValues(offered[0])).toEqual(['land', 'sea', 'air']);
    expect(item.flags.essence20.rules.choices.vehicleType).toBe('sea');
    expect(switches(actor)).toEqual(['Sea vehicle test (Wheel Excited: Edge)']);
    // Re-pickable.
    picker('air');
    await runUse(item, pay());
    expect(switches(actor)).toEqual(['Air vehicle test (Wheel Excited: Edge)']);
  });

  test('Wheel Excited: a cancelled pick changes nothing; an old pick moves over', async () => {
    const { item } = holder(WHEEL);
    picker(null);
    expect(await runUse(item, pay())).toBeNull();
    const old = holder(WHEEL, { flags: { vehicleType: 'land' } });
    expect(legacyChoiceUpdates(old.actor)).toEqual([{ _id: old.item.id, 'flags.essence20.rules.choices.vehicleType': 'land' }]);
    old.item.flags.essence20.rules = { choices: { vehicleType: 'land' } };
    rebuildIndex(old.actor);
    expect(switches(old.actor)).toEqual(['Land vehicle test (Wheel Excited: Edge)']);
  });
});

/* -------------------------------------------- */
/*  Psycho Morpher (data21)                      */
/* -------------------------------------------- */

describe('slE3 data21: Psycho Morpher', () => {
  const MORPHER = 'fmmcitems/_source/Psycho_Morpher_EkBMS8Ih24UYBQ4R.json';
  const fmmc = id => `Compendium.essence20.finster_s_monster_matic_cookbook.Item.${id}`;
  const PATH = {
    cruelty: fmmc('vWie8Dy4u54sf1hy'), flame: fmmc('4PbR4S3s83Coa0kL'), frost: fmmc('GQ5aQWbjmaO9y00w'),
    stone: fmmc('TEjkVjIEFEbRI736'), thorns: fmmc('0ICOTyVDXK1i6l1S'), venom: fmmc('rWoVOcNc3lXKDbhg'),
  };
  const WEAPON = {
    axe: 'J1c1RFPaz3ende3k', blade: 'G22NKq1Zcbeippwe', blaster: 'mXz4XbFVVAxAhXP7', bow: '5I2uX1zj3oC5e0TP', dagger: '6ciS2IDmQVD6GIk7',
    scythe: 'KIdCaJ7nlWDyANng', staff: 'fJUfCWJOoluPf5vm', slinger: 'NTy3KQc1Lcg4LlyX', sword: 'gZoFLl1P4qVeJ1xR', trident: 'yyg2pmTVJmxCiYFF',
  };
  const ALL = ['axe', 'blade', 'blaster', 'bow', 'dagger', 'scythe', 'staff', 'slinger', 'sword', 'trident'];
  const role = uuid => ({ id: `r${nextId++}`, name: 'Path', type: 'role', flags: { core: { sourceId: uuid } }, system: {} });

  /** Press the Morpher's Use with the picker answering `answer`: the weapons offered. */
  async function press(path, answer = null) {
    const { actor, item, list } = holder(MORPHER, { type: 'npc', extra: path ? [role(PATH[path])] : [] });
    global.fromUuid = async uuid => ({ name: 'Psycho Weapon', toObject: () => ({ name: 'Psycho Weapon', type: 'weapon', system: { items: {} }, flags: {} }), uuid });
    const offered = picker(answer);
    const out = await runUse(item, pay());
    return { actor, item, list, out, weapons: offeredValues(offered[0]).map(uuid => Object.keys(WEAPON).find(key => fmmc(WEAPON[key]) == uuid)) };
  }

  test.each([
    ['cruelty', ALL],
    [null, ALL],
    ['flame', ['scythe', 'sword', 'trident']],
    ['frost', ['axe', 'blade']],
    ['stone', ['axe', 'blade', 'bow', 'staff']],
    ['thorns', ['blaster', 'bow', 'slinger']],
    ['venom', ['bow', 'scythe', 'staff', 'slinger', 'sword', 'trident']],
  ])('Path %s offers its Psycho Weapons', async (path, expected) => {
    const { weapons, out } = await press(path);
    expect(weapons).toEqual(expected);
    // Cancelled: nothing granted, no card.
    expect(out).toBeNull();
  });

  test('the picked weapon is granted once; the Use is back only when it is gone', async () => {
    const { item, list, out } = await press('venom', fmmc(WEAPON.bow));
    expect(out).toBeTruthy();
    const weapon = list.find(i => i.type == 'weapon');
    expect(weapon.flags.essence20.grantedBy).toBe(item.id);
    expect(weapon._stats.compendiumSource).toBe(fmmc(WEAPON.bow));
    expect(usable(item)).toBe(false);
    list.splice(list.indexOf(weapon), 1);
    expect(usable(item)).toBe(true);
  });

  test('a weapon granted by the old Use (grantedBy the Morpher) also hides the Use', () => {
    const old = { id: 'w1', name: 'Psycho Bow', type: 'weapon', flags: { essence20: {} }, system: {} };
    const { item } = holder(MORPHER, { extra: [old] });
    expect(usable(item)).toBe(true);
    old.flags.essence20.grantedBy = item.id;
    expect(usable(item)).toBe(false);
  });
});
