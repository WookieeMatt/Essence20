import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * slE9 (docs/rules-batches/slE9.md): the chosen-item Qualification Perks of the qualify1 / qualify2 / data21 slices,
 * converted with the round-9 `pickGrant {record}` + Qualification `item:pickedSource:<key>` - Service, Trade Goods,
 * For The Syndicate, Good To Go (its pick), Nu, Pogodi! (its weapon pick), Upgrade Training and Alternate Officer
 * Equipment Training. Each is loaded from its pack source and must do what the removed slice code did.
 *
 * The block at the end needs the three small engine edits the write-up lists (pickGrant `legacy`, a lone recorded
 * pick read by pickedSource, `{var.picked}` in a grant's uuid).
 */

// The compendium browser (mechanics/resources/grants.mjs) over a small catalog; the pick is named by the test.
// (Mocked paths resolve from module/jest.setup.js.)
let picks = [];
let offered = [];
const findItems = jest.fn(async ({ type, availabilities, matches }) => CATALOG.filter(entry => entry.type == type
  && (!availabilities || availabilities.includes(entry.system.availability)) && (!matches || matches(entry))));
const pickOne = jest.fn(async (title, rows) => {
  offered.push(rows.map(row => row.name));
  const name = picks.shift();
  return rows.find(row => row.name == name)?.uuid ?? null;
});
const chooseButtons = jest.fn(async () => null);
jest.unstable_mockModule('./mechanics/resources/grants.mjs', () => ({
  findItems, pickOne, chooseButtons, chooseSelect: jest.fn(), grantCopy: jest.fn(), markIntegrated: jest.fn(), rollTest: jest.fn(),
}));
jest.unstable_mockModule('./items/healing/nu-pogodi.mjs', () => ({
  canUseNuPogodiCondition: jest.fn(() => false), applyNuPogodiCondition: jest.fn(),
}));
jest.unstable_mockModule('./sheet-handlers/attachment-handler.mjs', () => ({
  createItemCopies: jest.fn(async () => {}),
  setEntryAndAddItem: jest.fn(async () => 'k1'),
}));

const { rebuildIndex } = await import('./index.mjs');
const { ruleQualifiedUpgrade, ruleRequisitionAccess } = await import('./adapter.mjs');
const { runUse, useAvailable } = await import('./triggers.mjs');
const { legacyChoiceUpdates } = await import('./legacy-choices.mjs');
const { NU_POGODI_USE: QUALIFY_USE } = await import('../items/vehicles/nu-pogodi-seat-swap.mjs');
const { effectiveAvailability, isQualifiedUpgrade } = await import('../items/gear/qualification-perks.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

const FILES = {
  service: 'fgtaaitems/_source/Service_T7oYyl70KYmFT1lt.json',
  tradeGoods: 'fffav1items/_source/Trade_Goods_DZGQX1B8UwJEBrwg.json',
  syndicate: 'iafav2items/_source/For_The_Syndicate_opygNwRWgeIyU1mE.json',
  goodToGo: 'iafav2items/_source/Good_To_Go_Yt3muowN1aALcqOj.json',
  nuPogodi: 'iafav2items/_source/Nu__Pogodi__sItc8nD7ockbQ1mn.json',
  upgradeTraining: 'iafav2items/_source/Upgrade_Training_zhwJbYTopQB2RuuM.json',
  officer: 'sssitems/_source/Alternate_Officer_Equipment_Training_5iH3ztH4sjqboZK5.json',
};

const attack = (style, extra = {}) => ({ type: 'weaponEffect', classification: { style }, numHands: extra.numHands ?? '1', range: extra.range ?? {} });
const entry = (name, type, availability, system = {}) => ({
  uuid: `Compendium.essence20.cat.Item.${name.replace(/\W/g, '')}`, name, type, system: { availability, traits: [], items: {}, ...system },
});
const CATALOG = [
  entry('Pistol', 'weapon', 'standard', { items: { a: attack('projectile') } }),
  entry('Sniper Rifle', 'weapon', 'limited', { items: { a: attack('projectile', { numHands: '2' }) } }),
  entry('Machete', 'weapon', 'limited', { items: { a: attack('melee') } }),
  entry('Whip', 'weapon', 'limited', { items: { a: attack('projectile', { range: { reachMultiplier: 2 } }) } }),
  entry('Rocket Launcher', 'weapon', 'restricted', { items: { a: attack('projectile', { numHands: '2' }) } }),
  entry('Flak Vest', 'armor', 'limited'),
  entry('Power Armor', 'armor', 'restricted'),
  entry('Scope', 'upgrade', 'limited', { type: 'weapon' }),
  entry('Bayonet', 'upgrade', 'limited', { type: 'weapon' }),
  entry('Suppressor', 'upgrade', 'limited', { type: 'weapon' }),
  entry('Plating', 'upgrade', 'limited', { type: 'armor' }),
  entry('Railgun Coil', 'upgrade', 'restricted', { type: 'weapon' }),
];
const uuidOf = name => CATALOG.find(e => e.name == name).uuid;

let nextId = 1;

function setPath(object, key, value) {
  const keys = key.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
}

function makeActor(items = []) {
  const list = [...items];
  const actor = {
    id: `a${nextId++}`, name: 'Hero', type: 'playerCharacter', isOwner: true, flags: { essence20: {} },
    system: { trained: { armors: { light: false, medium: true }, weapons: { ballistic: true } }, skills: {} },
    update: jest.fn(async function (data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    }),
    createEmbeddedDocuments: jest.fn(async (type, data) => data.map(d => {
      const made = { ...d, id: `c${nextId++}`, parent: actor };
      list.push(made);
      return made;
    })),
  };
  actor.uuid = `Actor.${actor.id}`;
  actor.items = { contents: list, get: id => list.find(i => i.id == id), filter: fn => list.filter(fn), [Symbol.iterator]: () => list[Symbol.iterator]() };
  for (const item of list) {
    item.parent = actor;
  }

  rebuildIndex(actor);
  return actor;
}

function packItem(file, flags = {}) {
  const doc = fromPack(file);
  const item = {
    id: `i${nextId++}`, name: doc.name, type: doc.type,
    flags: { core: { sourceId: `Compendium.essence20.x.Item.${doc._id}` }, essence20: { ...flags } },
    system: { ...doc.system },
  };
  item.update = jest.fn(async data => {
    for (const [key, value] of Object.entries(data)) {
      setPath(item, key, value);
    }
  });
  return item;
}

/** An item being requisitioned: a printing of a catalog entry (another book's printing with `other`). */
const requisitioned = (name, other = false) => {
  const source = CATALOG.find(e => e.name == name);
  return { name, type: source.type, system: { availability: source.system.availability }, flags: { core: { sourceId: other ? 'Compendium.essence20.other.Item.reprint' : source.uuid } } };
};

/** Run the item's Use, answering a `choose` with the option index given. */
const use = (item, option = 0) => runUse(item, async () => true, { ask: async () => option });
const useOf = item => item.system.rules.findIndex(rule => rule.type == 'Use');
const available = item => useAvailable(item, item.system.rules[useOf(item)], useOf(item));

beforeEach(() => {
  picks = [];
  offered = [];
  global.game = {
    combat: null, user: { id: 'u', isGM: true, targets: new Set() }, users: { activeGM: null }, settings: { get: () => 1 },
    actors: { contents: [] }, i18n: { localize: k => k, format: k => k },
  };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.fromUuid = jest.fn(async uuid => {
    const found = CATALOG.find(e => e.uuid == uuid);
    return found ? { toObject: () => ({ _id: 'x', name: found.name, type: found.type, system: { ...found.system }, flags: {} }) } : null;
  });
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath, getProperty: (o, k) => k.split('.').reduce((at, key) => at?.[key], o) },
  };
  global.CONFIG.E20.upgradeAvailabilityMatrix = {
    standard: { standard: 'standard', limited: 'limited', restricted: 'restricted' },
    limited: { standard: 'limited', limited: 'restricted', restricted: 'restricted' },
    restricted: { standard: 'restricted', limited: 'restricted', restricted: 'prototype' },
  };
});

/* -------------------------------------------- */
/*  Service, Trade Goods (qualify1)              */
/* -------------------------------------------- */

describe('Service and Trade Goods', () => {
  test('Service: a Limited weapon of your choice is Trained; a new pick replaces it', async () => {
    const perk = packItem(FILES.service);
    const actor = makeActor([perk]);
    expect(ruleRequisitionAccess(actor, requisitioned('Sniper Rifle'))).toBeNull();

    picks = ['Sniper Rifle'];
    await use(perk);
    expect(offered[0]).toEqual(['Sniper Rifle', 'Machete', 'Whip']);
    expect(ruleRequisitionAccess(actor, requisitioned('Sniper Rifle'))).toBe('trained');
    expect(ruleRequisitionAccess(actor, requisitioned('Sniper Rifle', true))).toBe('trained');
    expect(ruleRequisitionAccess(actor, requisitioned('Machete'))).toBeNull();
    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();

    picks = ['Machete'];
    await use(perk);
    expect(ruleRequisitionAccess(actor, requisitioned('Machete'))).toBe('trained');
    expect(ruleRequisitionAccess(actor, requisitioned('Sniper Rifle'))).toBeNull();
    // A cancelled pick keeps the old one.
    picks = [];
    await use(perk);
    expect(ruleRequisitionAccess(actor, requisitioned('Machete'))).toBe('trained');
  });

  test('Trade Goods: a Limited or Restricted weapon is Qualified, and access only widens', async () => {
    const perk = packItem(FILES.tradeGoods);
    const actor = makeActor([perk]);
    picks = ['Rocket Launcher'];
    await use(perk);
    expect(offered[0]).toEqual(['Sniper Rifle', 'Machete', 'Whip', 'Rocket Launcher']);
    expect(ruleRequisitionAccess(actor, requisitioned('Rocket Launcher'))).toBe('qualified');
    expect(ruleRequisitionAccess(actor, requisitioned('Pistol'))).toBeNull();
  });
});

/* -------------------------------------------- */
/*  For The Syndicate, Good To Go (qualify1)     */
/* -------------------------------------------- */

describe.each([['For The Syndicate', FILES.syndicate], ['Good To Go', FILES.goodToGo]])('%s', (name, file) => {
  test('a Limited weapon and battledress, or one Restricted weapon or battledress', async () => {
    const perk = packItem(file);
    const actor = makeActor([perk]);
    picks = ['Machete', 'Flak Vest'];
    await use(perk, 0);
    expect(offered).toEqual([['Sniper Rifle', 'Machete', 'Whip'], ['Flak Vest']]);
    expect(ruleRequisitionAccess(actor, requisitioned('Machete'))).toBe('qualified');
    expect(ruleRequisitionAccess(actor, requisitioned('Flak Vest'))).toBe('qualified');

    // A new plan replaces the whole earlier choice.
    offered = [];
    picks = ['Power Armor'];
    await use(perk, 2);
    expect(offered).toEqual([['Power Armor']]);
    expect(ruleRequisitionAccess(actor, requisitioned('Power Armor'))).toBe('qualified');
    expect(ruleRequisitionAccess(actor, requisitioned('Machete'))).toBeNull();
    expect(ruleRequisitionAccess(actor, requisitioned('Flak Vest'))).toBeNull();

    offered = [];
    picks = ['Rocket Launcher'];
    await use(perk, 1);
    expect(offered).toEqual([['Rocket Launcher']]);
    expect(ruleRequisitionAccess(actor, requisitioned('Rocket Launcher'))).toBe('qualified');
    expect(ruleRequisitionAccess(actor, requisitioned('Power Armor'))).toBeNull();
  });

  test('closing the choice changes nothing', async () => {
    const perk = packItem(file);
    const actor = makeActor([perk]);
    picks = ['Rocket Launcher'];
    await use(perk, 1);
    await runUse(perk, async () => true, { ask: async () => null });
    expect(ruleRequisitionAccess(actor, requisitioned('Rocket Launcher'))).toBe('qualified');
  });
});

/* -------------------------------------------- */
/*  Nu, Pogodi! (qualify1)                       */
/* -------------------------------------------- */

describe('Nu, Pogodi!', () => {
  test('its weapon pick offers Limited two-handed weapons and Qualifies the one chosen', async () => {
    const perk = packItem(FILES.nuPogodi);
    const actor = makeActor([perk]);
    picks = ['Sniper Rifle'];
    await use(perk);
    expect(offered[0]).toEqual(['Sniper Rifle']);
    expect(ruleRequisitionAccess(actor, requisitioned('Sniper Rifle'))).toBe('qualified');
    // Its Standard-weapon Qualification is untouched.
    expect(ruleRequisitionAccess(actor, requisitioned('Pistol'))).toBe('qualified');
    expect(ruleRequisitionAccess(actor, requisitioned('Machete'))).toBeNull();
  });

  test('the slice Use keeps the seat swap and Condition removal only; the moved Perks are no longer its', async () => {
    const nu = packItem(FILES.nuPogodi);
    nu.flags.core.sourceId = 'Compendium.essence20.intercontinental_adventures.Item.sItc8nD7ockbQ1mn';
    const service = packItem(FILES.service);
    service.flags.core.sourceId = 'Compendium.essence20.field_guide_action_adventure.Item.T7oYyl70KYmFT1lt';
    makeActor([nu, service]);
    expect(QUALIFY_USE.matches(nu)).toBe(true);
    expect(QUALIFY_USE.matches(service)).toBe(false);
    expect(await QUALIFY_USE.run(nu, null, async () => true)).toBeNull();
    expect(chooseButtons.mock.calls.at(-1)[2].map(([key]) => key)).toEqual(['swap']);
  });
});

/* -------------------------------------------- */
/*  Upgrade Training (qualify2)                  */
/* -------------------------------------------- */

describe('Upgrade Training', () => {
  test('three Limited weapon upgrades, none twice; Qualified upgrades leave the Availability stacking; once only', async () => {
    const perk = packItem(FILES.upgradeTraining);
    const actor = makeActor([perk]);
    picks = ['Scope', 'Bayonet', 'Suppressor'];
    await use(perk, 0);
    expect(offered).toEqual([['Scope', 'Bayonet', 'Suppressor'], ['Bayonet', 'Suppressor'], ['Suppressor']]);
    expect(ruleQualifiedUpgrade(actor, { uuid: uuidOf('Scope'), name: 'Scope' })).toBe(true);
    expect(ruleQualifiedUpgrade(actor, { uuid: uuidOf('Railgun Coil'), name: 'Railgun Coil' })).toBe(false);
    expect(available(perk)).toBe(false);

    const gun = { type: 'weapon', name: 'Gun', system: { availability: 'standard', totalAvailability: 'limited', items: { u: { type: 'upgrade', uuid: uuidOf('Scope'), availability: 'limited' } } } };
    expect(isQualifiedUpgrade(actor, { uuid: uuidOf('Scope') })).toBe(true);
    expect(effectiveAvailability(actor, gun)).toBe('standard');
  });

  test('one Restricted weapon upgrade; a cancelled later pick keeps the earlier ones', async () => {
    const restricted = packItem(FILES.upgradeTraining);
    const one = makeActor([restricted]);
    picks = ['Railgun Coil'];
    await use(restricted, 1);
    expect(offered).toEqual([['Railgun Coil']]);
    expect(ruleQualifiedUpgrade(one, { uuid: uuidOf('Railgun Coil'), name: 'Railgun Coil' })).toBe(true);

    const partial = packItem(FILES.upgradeTraining);
    const two = makeActor([partial]);
    picks = ['Bayonet'];
    await use(partial, 0);
    expect(ruleQualifiedUpgrade(two, { uuid: uuidOf('Bayonet'), name: 'Bayonet' })).toBe(true);
    expect(available(partial)).toBe(false);
  });
});

/* -------------------------------------------- */
/*  Alternate Officer (data21)                   */
/* -------------------------------------------- */

describe('Alternate Officer Equipment Training', () => {
  test('rewrites the training, then the chosen Limited melee weapon is Qualified', async () => {
    const perk = packItem(FILES.officer);
    const actor = makeActor([perk]);
    picks = ['Machete'];
    await use(perk);
    expect(actor.system.trained.armors).toEqual({ light: true, medium: false });
    expect(actor.system.trained.weapons).toEqual({ ballistic: false, blunt: true, closeCombatHeavyBlade: true, explosives: true, finesse: true, mightMelee: true });
    expect(perk.flags.essence20.d21OfficerApplied).toBe(true);
    expect(offered[0]).toEqual(['Machete', 'Whip']);
    expect(ruleRequisitionAccess(actor, requisitioned('Machete'))).toBe('qualified');
    expect(ruleRequisitionAccess(actor, requisitioned('Whip'))).toBeNull();
    expect(available(perk)).toBe(false);
  });

  test('a cancelled weapon pick leaves the Use for the pick alone', async () => {
    const perk = packItem(FILES.officer);
    const actor = makeActor([perk]);
    await use(perk);
    expect(actor.update).toHaveBeenCalledTimes(1);
    expect(available(perk)).toBe(true);
    picks = ['Whip'];
    await use(perk);
    expect(actor.update).toHaveBeenCalledTimes(1);
    expect(ruleRequisitionAccess(actor, requisitioned('Whip'))).toBe('qualified');
    expect(available(perk)).toBe(false);
  });
});

/* -------------------------------------------- */
/*  With the engine edits (slE9.md)              */
/* -------------------------------------------- */

describe('needs the engine edits listed in slE9.md', () => {
  test('the picked upgrades and the officer weapon are granted, marked qualified', async () => {
    const training = packItem(FILES.upgradeTraining);
    const actor = makeActor([training]);
    picks = ['Scope', 'Bayonet', 'Suppressor'];
    await use(training, 0);
    const granted = actor.items.contents.filter(item => item.type == 'upgrade');
    expect(granted.map(item => item.name)).toEqual(['Scope', 'Bayonet', 'Suppressor']);
    expect(granted.every(item => item.flags.essence20.qualified && item.flags.essence20.grantedBy == training.id)).toBe(true);

    const officer = packItem(FILES.officer);
    const joe = makeActor([officer]);
    picks = ['Machete'];
    await use(officer);
    expect(joe.items.contents.find(item => item.name == 'Machete')?.flags.essence20.qualified).toBe(true);
  });

  test('old picks move into the recorded lists, and a lone old officer pick still counts', async () => {
    const chosen = [{ uuid: uuidOf('Sniper Rifle'), name: 'Sniper Rifle', type: 'weapon' }];
    const service = packItem(FILES.service, { q1Chosen: chosen });
    const syndicate = packItem(FILES.syndicate, { q1Chosen: chosen });
    const training = packItem(FILES.upgradeTraining, { q2Chosen: [{ uuid: uuidOf('Scope'), name: 'Scope' }] });
    const officer = packItem(FILES.officer, { d21OfficerApplied: true, d21OfficerWeapon: { uuid: uuidOf('Machete'), name: 'Machete' } });
    const actor = makeActor([service, syndicate, training, officer]);
    const updates = legacyChoiceUpdates(actor);
    for (const item of [service, syndicate, training, officer]) {
      const update = updates.find(u => u._id == item.id);
      expect(update).toBeTruthy();
      for (const [key, value] of Object.entries(update)) {
        if (key != '_id') {
          setPath(item, key, value);
        }
      }
    }

    rebuildIndex(actor);
    expect(ruleRequisitionAccess(actor, requisitioned('Sniper Rifle'))).toBe('qualified');
    expect(ruleQualifiedUpgrade(actor, { uuid: uuidOf('Scope'), name: 'Scope' })).toBe(true);
    expect(available(training)).toBe(false);
    expect(ruleRequisitionAccess(actor, requisitioned('Machete'))).toBe('qualified');
    expect(available(officer)).toBe(false);
    expect(legacyChoiceUpdates(actor)).toEqual([]);
  });
});
