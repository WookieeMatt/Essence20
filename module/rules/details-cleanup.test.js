import { jest } from '@jest/globals';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The Details-tab cleanup (docs/rules-batches/details-cleanup.md, 2026-10-07): item fields the item
 * sheet no longer shows, replaced by rules on the pack items. Each test loads the shipped pack item and
 * checks its rules give what the removed code gave. (Rerolls: mechanics/rolls/reroll.test.js; the
 * world migration: migration.test.js.)
 */

global.Hooks = global.Hooks ?? { on: () => 0, once: () => 0, callAll: () => {} };
jest.unstable_mockModule('./mechanics/world/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn(), createViaGm: jest.fn() }));
jest.unstable_mockModule('./sheet-handlers/power-ranger-handler.mjs', () => ({ onMorph: jest.fn(async () => {}) }));

await import('./plugins/index.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { ruleAimBonus, ruleDerived } = await import('./adapter.mjs');
const { validateRule } = await import('./types.mjs');
const { fireItemAdded } = await import('./triggers.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));
const getPath = (object, key) => String(key).split('.').reduce((o, k) => (o === null || o === undefined ? o : o[k]), object);
function setPath(object, key, value) {
  const keys = String(key).split('.');
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
}

const FILES = {
  fastMlp: 'mlpcrbitems/_source/Fast_NU7KqcXvQbOFbU0C.json',
  fastPr: 'prcrbitems/_source/Fast_DM3png00SY9CgkMN.json',
  expertiseGij: 'gijcrbitems/_source/Expertise_F9kOLys1Iu4UOg22.json',
  laserSightGij: 'gijcrbitems/_source/Laser_Sight_Yo1la1g1Mc3fNBbH.json',
  laserSightTf: 'tfcrbitems/_source/Laser_Sight_Yo1la1g1Mc3fNBbH.json',
  morphinTime: 'prcrbitems/_source/It_s_Morphin_Time__UFMTHB90lA9ZEvso.json',
  quantumMorph: 'jttitems/_source/Quantum_Morph_E0XzDTQLQZ9Pcplj.json',
  guardian: 'ttsgitems/_source/A_Guardian_of_Eltar__d4OdAdU048WsK2kh.json',
  magnaPower: 'ttsgitems/_source/Magna_Power__VsTXT0C5RR5amWW3.json',
};

let nextId = 1;

function makeActor(system = {}) {
  const items = [];
  items.get = id => items.find(item => item.id == id);
  Object.defineProperty(items, 'contents', { get: () => items });
  const actor = {
    id: `a${nextId++}`, name: 'Tester', type: 'playerCharacter', isOwner: true, statuses: new Set(), flags: {}, items,
    system: { level: 1, skills: { athletics: { shiftUp: 1 }, might: { shiftUp: 0 } }, defenses: { toughness: { morphed: 0 } }, ...system },
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    },
    getFlag(scope, key) {
      return getPath(this.flags?.[scope], key);
    },
  };
  actor.uuid = `Actor.${actor.id}`;
  return actor;
}

function addItem(actor, data) {
  const item = { id: `i${nextId++}`, flags: {}, effects: [], ...data, system: data.system ?? {}, parent: actor };
  item.uuid = `${actor.uuid}.Item.${item.id}`;
  actor.items.push(item);
  rebuildIndex(actor);
  return item;
}

function addPack(actor, key, { system = {}, flags = {} } = {}) {
  const doc = fromPack(FILES[key]);
  return addItem(actor, { name: doc.name, type: doc.type, system: { ...clone(doc.system), ...system }, flags });
}

beforeEach(() => {
  global.game = { user: { id: 'u', isGM: true }, users: { activeGM: null }, i18n: { localize: k => k, format: k => k }, settings: { get: () => null } };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.CONFIG = { ...(global.CONFIG ?? {}), E20: { ...(global.CONFIG?.E20 ?? {}), morphedToughness: { light: 1, medium: 2, heavy: 4, ultraHeavy: 6 } } };
  global.foundry = { ...(global.foundry ?? {}), utils: { ...(global.foundry?.utils ?? {}), getProperty: getPath, setProperty: setPath, deepClone: clone } };
});

test('every changed pack item\'s rules validate', () => {
  for (const file of Object.values(FILES)) {
    for (const rule of fromPack(file).system.rules ?? []) {
      expect([file, validateRule(rule)]).toEqual([file, []]);
    }
  }
});

/* None of the packs still authors the fields the Details tab stopped showing. */
test('no pack item still carries the old fields', () => {
  const left = [];
  for (const pack of readdirSync(join(ROOT, 'packs'))) {
    let files = [];
    try {
      files = readdirSync(join(ROOT, 'packs', pack, '_source')).filter(name => name.endsWith('.json'));
    } catch (error) {
      continue;
    }

    for (const file of files) {
      const doc = JSON.parse(readFileSync(join(ROOT, 'packs', pack, '_source', file), 'utf8'));
      const system = doc.system ?? {};
      if (['perk', 'power'].includes(doc.type) && system.reroll?.enabled) {
        left.push(`${file}: reroll`);
      }

      if (doc.type == 'perk' && (system.canActivate || system.hasMorphedToughnessBonus || system.reroll)) {
        left.push(`${file}: perk field`);
      }

      if (doc.type == 'perk' && system.value && ['movement', 'skills'].includes(system.choiceType)) {
        left.push(`${file}: value`);
      }

      if (doc.type == 'upgrade' && system.aimShiftBonus) {
        left.push(`${file}: aimShiftBonus`);
      }
    }
  }

  expect(left).toEqual([]);
});

/* Fast: the drop used to add 10 to the picked Movement's stored bonus. Now its Movement rule (stage bonus)
   adds it while the copy is flagged perkValueRule - through the real _prepareMovement, the same totals. */
describe('Fast (MLP / PR): +10 ft to the picked Movement', () => {
  beforeAll(() => {
    if (!('canvas' in global)) {
      global.canvas = undefined;
    }
  });

  async function movementOf(items, bonus = {}) {
    const { Essence20Actor } = await import('../documents/actor.mjs');
    const actor = new Essence20Actor();
    actor.id = `a${nextId++}`;
    actor.type = 'playerCharacter';
    const move = (base, extra = 0) => ({ base, bonus: extra, morphed: 0, altMode: 0 });
    actor.system = {
      isMorphed: false, isTransformed: false, level: 1,
      movement: { aerial: move(0, bonus.aerial), ground: move(30, bonus.ground), burrow: move(0), climb: move(0, bonus.climb), swim: move(0, bonus.swim) },
    };
    actor.flags = { essence20: {} };
    actor.statuses = new Set();
    actor.getFlag = (scope, key) => actor.flags?.[scope]?.[key];
    const list = items.map(item => ({ id: `c${nextId++}`, parent: actor, ...item }));
    actor.items = { contents: list, get: id => list.find(item => item.id == id), find: fn => list.find(fn) };
    actor._prepareMovement();
    return actor.system.movement;
  }

  // Perk choice P2: the pack copy picks through its ChoiceSet; an old copy's system.choice reads through its legacy setting.
  // A copy whose drop baked the +10 still stores system.value (migratePerkValue takes it off and resets it).
  const fast = (key, choice, unbaked = true) => {
    const doc = fromPack(FILES[key]);
    return { name: doc.name, type: doc.type, flags: unbaked ? { essence20: { perkValueRule: true } } : {}, system: { ...clone(doc.system), choice, value: unbaked ? 0 : 10 } };
  };

  test.each(['fastMlp', 'fastPr'])('%s: a flagged copy gives what the old written-in bonus gave', async key => {
    for (const choice of ['ground', 'climb', 'swim', 'aerial']) {
      const now = await movementOf([fast(key, choice)]);
      const before = await movementOf([], { [choice]: 10 });
      expect([choice, now[choice].total, now.ground.total, now.climb.total, now.swim.total])
        .toEqual([choice, before[choice].total, before.ground.total, before.climb.total, before.swim.total]);
      // In the bonus itself, as before - Jury Rig / Lightfoil Wings read ground's base + bonus.
      expect(now[choice].bonus).toBe(10);
    }
  });

  test('an older copy still holding its value adds nothing (its +10 is already in the stored bonus)', async () => {
    const now = await movementOf([fast('fastPr', 'ground', false)], { ground: 10 });
    expect(now.ground.total).toBe(40);
    expect(now.ground.bonus).toBe(10);
  });

  test('no pick, no bonus', async () => {
    expect((await movementOf([fast('fastMlp', null)])).ground.total).toBe(30);
  });
});

/* GI Joe Expertise: the drop used to add 2 to the picked Skill's shiftUp. */
test('Expertise (GI Joe): up 2 on the picked Skill, except on a copy still holding its baked value', () => {
  const actor = makeActor();
  addPack(actor, 'expertiseGij', { system: { choice: 'athletics' }, flags: { essence20: { perkValueRule: true } } });
  addPack(actor, 'expertiseGij', { system: { choice: 'might', value: 2 } });
  addPack(actor, 'expertiseGij', { system: { choice: null }, flags: { essence20: { perkValueRule: true } } });
  rebuildIndex(actor);
  ruleDerived(actor);
  expect(actor.system.skills.athletics.shiftUp).toBe(3);
  expect(actor.system.skills.might.shiftUp).toBe(0);
});

/* Laser Sight: the weapon used to sum the upgrade's aimShiftBonus (1) into the Aim bonus. */
test.each(['laserSightGij', 'laserSightTf'])('%s: Aim +1 on its own weapon\'s attacks only', key => {
  const actor = makeActor();
  const rifle = addItem(actor, { name: 'Rifle', type: 'weapon', system: { equipped: true } });
  const pistol = addItem(actor, { name: 'Pistol', type: 'weapon', system: { equipped: true } });
  const shot = addItem(actor, { name: 'Shot', type: 'weaponEffect', flags: { essence20: { parentId: rifle.id } }, system: {} });
  const other = addItem(actor, { name: 'Other', type: 'weaponEffect', flags: { essence20: { parentId: pistol.id } }, system: {} });
  addPack(actor, key, { flags: { essence20: { parentId: rifle.id } } });
  expect(ruleAimBonus(actor, null, { item: shot }).extra).toBe(1);
  expect(ruleAimBonus(actor, null, { item: other }).extra).toBe(0);
  rifle.system.equipped = false;
  rebuildIndex(actor);
  expect(ruleAimBonus(actor, null, { item: shot }).extra).toBe(0);
});

/* hasMorphedToughnessBonus: the drop set the Morphed Toughness bonus from the Armor Training
   (setMorphedToughnessBonus), the delete switched it off and zeroed it. */
describe('the Morphed Toughness Faction Perks', () => {
  test.each(['morphinTime', 'quantumMorph', 'guardian', 'magnaPower'])('%s: added sets it from the training, removed clears it', async key => {
    const actor = makeActor({ trained: { armors: { light: true, medium: true, heavy: true } }, canSetToughnessBonus: false });
    const perk = addPack(actor, key);
    await fireItemAdded(actor, perk);
    expect([actor.system.canSetToughnessBonus, actor.system.defenses.toughness.morphed]).toEqual([true, 4]);

    actor.items.splice(actor.items.indexOf(perk), 1);
    rebuildIndex(actor);
    await fireItemAdded(actor, perk, { event: 'removed' });
    expect([actor.system.canSetToughnessBonus, actor.system.defenses.toughness.morphed]).toEqual([false, 0]);
  });
});
