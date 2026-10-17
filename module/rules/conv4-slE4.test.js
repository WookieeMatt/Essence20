import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * slE4: items of the qualify / data / MLP / Night Vale slices converted with the 2026-10-05 round-4 engine
 * pieces (wielding tags, granted attachments carrying grantedBy). Each is loaded from its pack source and
 * must do what the removed slice code did.
 */

// A granted weapon's attacks are copied by the sheet handler; here they land on the actor as plain children.
jest.unstable_mockModule('./sheet-handlers/attachment-handler.mjs', () => ({
  createItemCopies: jest.fn(async (entries, actor, type, host) => {
    for (const entry of Object.values(entries ?? {}).filter(e => e.type == type)) {
      actor.items.contents.push({ id: `k${nextId++}`, name: entry.name, type, flags: { essence20: { parentId: host.id } } });
    }
  }),
  setEntryAndAddItem: jest.fn(async () => 'k1'),
}));

const { rebuildIndex } = await import('./index.mjs');
const { applyRuleSwitches, ruleDialogSwitches } = await import('./adapter.mjs');
const { attachGrantedChildren, grantData, grantedBy } = await import('./lifecycle.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

let nextId = 1;

function setPath(object, key, value) {
  const keys = key.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
}

/** An actor holding the pack item plus `extra` items. */
function holder(file, extra = [], { flags = {} } = {}) {
  const doc = fromPack(file);
  const item = { id: `c${nextId++}`, name: doc.name, type: doc.type, flags: {}, system: doc.system };
  const list = [item, ...extra];
  const actor = {
    id: `a${nextId++}`, uuid: `Actor.h${nextId}`, name: 'Hero', type: 'playerCharacter', statuses: new Set(),
    flags: { essence20: { ...flags } }, system: { level: 9 },
    async createEmbeddedDocuments(kind, datas) {
      const made = datas.map(data => ({ ...data, id: `n${nextId++}`, parent: actor }));
      list.push(...made);
      return made;
    },
    async updateEmbeddedDocuments(kind, updates) {
      for (const { _id, ...changes } of updates) {
        const owned = list.find(i => i.id == _id);
        for (const [key, value] of Object.entries(changes)) {
          setPath(owned, key, value);
        }
      }
    },
  };
  actor.items = { contents: list, get: id => list.find(i => i.id == id), [Symbol.iterator]: () => list[Symbol.iterator]() };
  for (const owned of list) {
    owned.parent = actor;
  }

  rebuildIndex(actor);
  return { actor, item };
}

/** A weapon (equipped or not) with one attack of each given style. */
function weapon(styles, { equipped = true } = {}) {
  const host = { id: `w${nextId++}`, name: 'Weapon', type: 'weapon', flags: {}, system: { equipped } };
  const attacks = styles.map(style => ({
    id: `e${nextId++}`, name: `${style} attack`, type: 'weaponEffect', flags: { essence20: { parentId: host.id } }, system: { classification: { style } },
  }));
  return [host, ...attacks];
}

beforeEach(() => {
  global.game = { combat: null, user: { id: 'u', isGM: true, targets: new Set() }, i18n: { localize: k => k, format: k => k } };
  global.foundry = { ...(global.foundry ?? {}), utils: { ...(global.foundry?.utils ?? {}), setProperty: setPath } };
});

/* -------------------------------------------- */
/*  Far-Sighted (mlp1)                           */
/* -------------------------------------------- */

const FAR_SIGHTED = 'kocitems/_source/Far_Sighted_Sm7INWZQAIXlu5HC.json';

describe('Far-Sighted', () => {
  test('a Snag switch, ticked by default, on Alertness while an equipped weapon has a ranged attack', () => {
    const { actor } = holder(FAR_SIGHTED, weapon(['melee', 'projectile']));
    const switches = ruleDialogSwitches(actor, { rolledSkill: 'alertness' });
    expect(switches).toHaveLength(1);
    expect(switches[0].value).toBe(true);
    const options = { shiftUp: 0, shiftDown: 0, ext: { [switches[0].name]: true } };
    applyRuleSwitches(actor, options, { rolledSkill: 'alertness' });
    expect(options.snag).toBe(true);
  });

  test('not on other Skills', () => {
    const { actor } = holder(FAR_SIGHTED, weapon(['energy']));
    expect(ruleDialogSwitches(actor, { rolledSkill: 'might' })).toEqual([]);
  });

  test('not with only melee attacks, an unequipped weapon, or a loose (unarmed) attack', () => {
    expect(ruleDialogSwitches(holder(FAR_SIGHTED, weapon(['melee'])).actor, { rolledSkill: 'alertness' })).toEqual([]);
    expect(ruleDialogSwitches(holder(FAR_SIGHTED, weapon(['projectile'], { equipped: false })).actor, { rolledSkill: 'alertness' })).toEqual([]);
    const loose = { id: `e${nextId++}`, name: 'Spit', type: 'weaponEffect', flags: {}, system: { classification: { style: 'projectile' } } };
    expect(ruleDialogSwitches(holder(FAR_SIGHTED, [loose]).actor, { rolledSkill: 'alertness' })).toEqual([]);
  });

  test('an attack with no style counts as ranged (the old style != melee test)', () => {
    const [host, attack] = weapon(['x']);
    delete attack.system.classification.style;
    expect(ruleDialogSwitches(holder(FAR_SIGHTED, [host, attack]).actor, { rolledSkill: 'alertness' })).toHaveLength(1);
  });

  test('always starts ticked, whatever was left last time', () => {
    const { actor } = holder(FAR_SIGHTED, weapon(['projectile']));
    const [first] = ruleDialogSwitches(actor, { rolledSkill: 'alertness' });
    actor.flags.essence20.ruleSwitches = { [first.name]: false };
    expect(ruleDialogSwitches(actor, { rolledSkill: 'alertness' })[0].value).toBe(true);
  });
});

/* -------------------------------------------- */
/*  Stinger Spray (data21)                       */
/* -------------------------------------------- */

const STINGER_PERK = 'fmmcitems/_source/Stinger_Spray_90rddMq7sK1SrhBi.json';
const STINGER_WEAPON = 'Compendium.essence20.finster_s_monster_matic_cookbook.Item.iOq7mriMr4BCBl78';

describe('Stinger Spray (Perk)', () => {
  const load = async uuid => {
    expect(uuid).toBe(STINGER_WEAPON);
    const doc = fromPack('fmmcitems/_source/Stinger_Spray_iOq7mriMr4BCBl78.json');
    return { toObject: () => JSON.parse(JSON.stringify(doc)) };
  };

  test('grants the Stinger Spray weapon, marked as the Perk\'s', async () => {
    const { actor, item } = holder(STINGER_PERK);
    const [data, ...rest] = await grantData(item, actor, { load });
    expect(rest).toEqual([]);
    expect(data).toMatchObject({ name: 'Stinger Spray', type: 'weapon', flags: { essence20: { grantedBy: item.id } }, _stats: { compendiumSource: STINGER_WEAPON } });
  });

  test('not when the actor already has the weapon (only once)', async () => {
    const owned = { id: `w${nextId++}`, name: 'Stinger Spray', type: 'weapon', flags: { core: { sourceId: STINGER_WEAPON } }, system: {} };
    const { actor, item } = holder(STINGER_PERK, [owned]);
    expect(await grantData(item, actor, { load })).toEqual([]);
  });

  test('its attacks carry the grant too, so they go when the Perk does', async () => {
    const { actor, item } = holder(STINGER_PERK);
    const made = await actor.createEmbeddedDocuments('Item', await grantData(item, actor, { load }));
    await attachGrantedChildren(actor, made);
    const attacks = actor.items.contents.filter(other => other.type == 'weaponEffect');
    expect(attacks.length).toBeGreaterThan(0);
    expect(attacks.every(attack => attack.flags.essence20.parentId == made[0].id)).toBe(true);
    expect(grantedBy(actor, item).sort()).toEqual([made[0].id, ...attacks.map(attack => attack.id)].sort());
  });
});
