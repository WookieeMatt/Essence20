import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Batch slA4 (docs/rules-batches/slA4.md): the zord1 / zord2 / pr1 / pr2 / pr3 slice items re-checked
 * against the round-4 engine pieces. Converted: Rotary Blade (weapon + shield) - its shield mode is a
 * Toggle rule with a `legacy` path (the old zord2ShieldMode flag), and the old zord2-gear-modes Use
 * branches are Use rules on the two items. Asserts what the removed slice code did.
 */

// A granted shield brings no attachments; keep the real attachment code (Foundry-heavy) out of the test.
jest.unstable_mockModule('./sheet-handlers/attachment-handler.mjs', () => ({
  ...Object.fromEntries(['onAttachableParentDrop', 'onEquipmentPackageDrop', 'grantItemEntry', 'onAttachmentDrop', '_attachSelectedItemOptionHandler',
    '_attachItem', 'grantLinkedWeaponEffect', 'createEntry', '_addItemIfUnique', 'deleteAttachmentsForItem'].map(name => [name, jest.fn()])),
  setEntryAndAddItem: jest.fn(async () => 'k1'),
  createItemCopies: jest.fn(async () => {}),
}));

const { rebuildIndex } = await import('./index.mjs');
const { runUse, useAvailable } = await import('./triggers.mjs');
const { legacyChoiceUpdates } = await import('./legacy-choices.mjs');
const { validateRule } = await import('./types.mjs');
const { zord2WeaponUnusable } = await import('../helpers/extensions/zord2/unusable.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

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

function makeActor(type = 'playerCharacter') {
  const items = [];
  const actor = {
    id: `a${nextId++}`, name: 'Razorclaw', type, isOwner: true, statuses: new Set(), flags: { essence20: {} },
    system: { health: { value: 5, max: 10 } },
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    },
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

function addPackItem(actor, file, uuid, extra = {}) {
  const doc = fromPack(file);
  const item = asItem({
    name: doc.name, type: doc.type, system: { ...doc.system, ...(extra.system ?? {}) }, flags: extra.flags ?? {},
    _stats: { compendiumSource: uuid },
  }, actor);
  actor.items.contents.push(item);
  rebuildIndex(actor);
  return item;
}

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
      deepClone: value => JSON.parse(JSON.stringify(value)),
    },
  };
});

afterEach(() => {
  jest.restoreAllMocks();
  delete global.fromUuid;
});

/* -------------------------------------------- */
/*  Rotary Blade (zord2/gear-modes.mjs)          */
/* -------------------------------------------- */

describe('Rotary Blade: Slasher Mode and Cyber Shield Mode are rules on the blade and its shield', () => {
  const WEAPON_FILE = 'tsitems/_source/Rotary_Blade_9OuJzchTaiJEMcff.json';
  const SHIELD_FILE = 'tsitems/_source/Rotary_Blade_ixzkIrq0X9k57754.json';
  const WEAPON = 'Compendium.essence20.technorganic_secrets.Item.9OuJzchTaiJEMcff';
  const SHIELD = 'Compendium.essence20.technorganic_secrets.Item.ixzkIrq0X9k57754';

  /** fromUuid for the shield grant: the pack's own shield. */
  function shieldSource() {
    const doc = fromPack(SHIELD_FILE);
    global.fromUuid = jest.fn(async uuid => (uuid == SHIELD ? { toObject: () => JSON.parse(JSON.stringify({ name: doc.name, type: doc.type, system: doc.system, flags: {} })) } : null));
  }

  const useOf = (item, label) => {
    const index = item.system.rules.findIndex(rule => rule.type == 'Use' && rule.label == label);
    return useAvailable(item, item.system.rules[index], index);
  };

  const shieldOf =actor => actor.items.contents.find(item => item.type == 'shield');

  test('the rules are valid', () => {
    for (const file of [WEAPON_FILE, SHIELD_FILE]) {
      for (const rule of fromPack(file).system.rules) {
        expect(validateRule(rule)).toEqual([]);
      }
    }
  });

  test('the blade (Move action) switches to Cyber Shield Mode: grants and equips the shield, the blade stops attacking', async () => {
    shieldSource();
    const bot = makeActor('playerCharacter');
    const blade = addPackItem(bot, WEAPON_FILE, WEAPON);
    expect(zord2WeaponUnusable(blade)).toBeNull();
    expect(useOf(blade, 'Switch to Cyber Shield Mode')).toBe(true);

    const pay = jest.fn(async () => true);
    expect(await runUse(blade, pay)).toBeTruthy();
    expect(pay).toHaveBeenCalledWith('move');
    const shield = shieldOf(bot);
    expect(shield).toBeTruthy();
    expect(shield.flags.essence20.grantedBy).toBe(blade.id);
    expect(shield.system).toMatchObject({ equipped: true, active: true });
    expect(zord2WeaponUnusable(blade)).toBe('E20.Zord2WeaponInShieldMode');
    // The old canUse: not again while in shield mode.
    expect(useOf(blade, 'Switch to Cyber Shield Mode')).toBe(false);
  });

  test('an existing shield is re-used, not granted again; a refused action changes nothing', async () => {
    shieldSource();
    const bot = makeActor('playerCharacter');
    const blade = addPackItem(bot, WEAPON_FILE, WEAPON);
    const shield = addPackItem(bot, SHIELD_FILE, SHIELD);
    expect(await runUse(blade, jest.fn(async () => false))).toBeNull();
    expect(zord2WeaponUnusable(blade)).toBeNull();
    expect(shield.system.active).toBe(false);

    await runUse(blade, jest.fn(async () => true));
    expect(global.fromUuid).not.toHaveBeenCalled();
    expect(bot.items.contents.filter(item => item.type == 'shield')).toHaveLength(1);
    expect(shield.system).toMatchObject({ equipped: true, active: true });
  });

  test('the active shield offers a controlled descent (Standard) or Slasher Mode (Move)', async () => {
    const bot = makeActor('playerCharacter');
    const blade = addPackItem(bot, WEAPON_FILE, WEAPON, { flags: { essence20: { rules: { toggles: { shieldMode: true } } } } });
    const shield = addPackItem(bot, SHIELD_FILE, SHIELD, { system: { equipped: true, active: true } });
    expect([useOf(shield, 'Controlled descent'), useOf(shield, 'Switch to Slasher Mode'), useOf(shield, 'Switch to Cyber Shield Mode')]).toEqual([true, true, false]);

    const descent = jest.fn(async () => true);
    const card = await runUse(shield, descent, { pick: async (item, available) => available.find(({ rule }) => rule.label == 'Controlled descent') });
    expect(descent).toHaveBeenCalledWith('standard');
    expect(card).toContain('controlled descent');
    expect(shield.system.active).toBe(true);

    const slasher = jest.fn(async () => true);
    await runUse(shield, slasher, { pick: async (item, available) => available.find(({ rule }) => rule.label == 'Switch to Slasher Mode') });
    expect(slasher).toHaveBeenCalledWith('move');
    expect(shield.system.active).toBe(false);
    expect(shield.system.equipped).toBe(true);
    expect(zord2WeaponUnusable(blade)).toBeNull();
    expect(useOf(blade, 'Switch to Cyber Shield Mode')).toBe(true);
  });

  test('the inactive shield switches back to Cyber Shield Mode itself', async () => {
    const bot = makeActor('playerCharacter');
    const blade = addPackItem(bot, WEAPON_FILE, WEAPON);
    const shield = addPackItem(bot, SHIELD_FILE, SHIELD, { system: { equipped: true, active: false } });
    expect([useOf(shield, 'Controlled descent'), useOf(shield, 'Switch to Slasher Mode'), useOf(shield, 'Switch to Cyber Shield Mode')]).toEqual([false, false, true]);
    const pay = jest.fn(async () => true);
    await runUse(shield, pay);
    expect(pay).toHaveBeenCalledWith('move');
    expect(shield.system.active).toBe(true);
    expect(zord2WeaponUnusable(blade)).toBe('E20.Zord2WeaponInShieldMode');
  });

  test('a blade switched the old way keeps its mode, and the linking pass moves the old flag', async () => {
    const bot = makeActor('playerCharacter');
    const blade = addPackItem(bot, WEAPON_FILE, WEAPON, { flags: { essence20: { zord2ShieldMode: true } } });
    const shield = addPackItem(bot, SHIELD_FILE, SHIELD, { system: { equipped: true, active: true } });
    expect(zord2WeaponUnusable(blade)).toBe('E20.Zord2WeaponInShieldMode');
    expect(useOf(blade, 'Switch to Cyber Shield Mode')).toBe(false);
    expect(legacyChoiceUpdates(bot)).toEqual([{ _id: blade.id, 'flags.essence20.rules.toggles.shieldMode': true }]);

    // Switching back clears both, so the blade attacks again.
    await runUse(shield, jest.fn(async () => true), { pick: async (item, available) => available.find(({ rule }) => rule.label == 'Switch to Slasher Mode') });
    expect(zord2WeaponUnusable(blade)).toBeNull();
    expect(useOf(blade, 'Switch to Cyber Shield Mode')).toBe(true);
  });
});
