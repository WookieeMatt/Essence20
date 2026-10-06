import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rebuildIndex } from './index.mjs';
import { ruleDialogSwitches, ruleRollSources } from './adapter.mjs';
import { fireTriggers, runUse, useAvailable, useRulesOf } from './triggers.mjs';

/**
 * Slice round 4, part slB4 (tf1, tf2, tf3, fix3-tf, other2): items converted from hand-written code to
 * item rules with the round-4 engine pieces (combat:exists, until: combat, mark counters / @mark, open
 * roll steps, grant name / integrated / systemFormulas). Each item is loaded from its pack source and
 * must do what the removed code (and its tests) did.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

let nextId = 1;
let epoch = 1;

const setPath = (object, key, value) => {
  const keys = key.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
};

const deletePath = (object, key) => {
  const keys = key.split('.');
  const last = keys.pop().replace(/^-=/, '');
  delete keys.reduce((o, k) => o?.[k], object)?.[last];
};

async function applyUpdate(doc, data) {
  for (const [key, value] of Object.entries(data)) {
    if (key.split('.').pop().startsWith('-=')) {
      deletePath(doc, key);
    } else {
      setPath(doc, key, value);
    }
  }
}

/** An item object (a pack item's data, or a plain one). */
function makeItem(data) {
  return {
    flags: {}, system: {}, ...data,
    async update(changes) {
      await applyUpdate(this, changes);
    },
  };
}

/** An actor holding these pack items (and any extra item objects). */
function holder(files = [], { system = {}, extra = [], disposition = 1 } = {}) {
  const actor = {
    id: `a${nextId++}`, name: 'Hero', type: 'playerCharacter', isOwner: true, statuses: new Set(), flags: { essence20: {} },
    system: { level: 3, health: { value: 10, max: 10 }, ...system },
    async update(data) {
      await applyUpdate(this, data);
    },
    toggleStatusEffect: jest.fn(async function (status, { active }) {
      actor.statuses[active ? 'add' : 'delete'](status);
    }),
  };
  actor.uuid = `Actor.${actor.id}`;
  const token = { actor, document: { disposition }, center: { x: 0, y: 0 } };
  actor.getActiveTokens = () => [token];
  actor.token = token;
  const items = files.map(file => {
    const doc = fromPack(file);
    return makeItem({ id: `c${nextId++}`, name: doc.name, type: doc.type, system: doc.system });
  });
  items.push(...extra);
  actor.items = { contents: items, get: id => items.find(item => item.id == id), [Symbol.iterator]: () => items[Symbol.iterator]() };
  for (const item of items) {
    item.parent = actor;
  }

  rebuildIndex(actor);
  return actor;
}

/** Put these actors' tokens on the canvas. */
function onCanvas(...actors) {
  global.canvas = { tokens: { placeables: actors.map(actor => actor.token) }, grid: { measurePath: () => ({ distance: 10 }) } };
}

const pay = () => jest.fn(async () => true);
const roller = (result = { success: true, total: 15 }) => ({ rollSkill: jest.fn(async () => result) });

beforeEach(() => {
  epoch = 1;
  global.game = {
    combat: null, combats: null, user: { id: 'u', isGM: false, targets: new Set() }, i18n: { localize: k => k, format: k => k },
    settings: { get: () => epoch }, actors: { contents: [] },
  };
  global.CONFIG = { E20: { skillToEssence: { technology: 'smarts', deception: 'social', infiltration: 'speed', alertness: 'smarts', survival: 'smarts' } } };
  global.canvas = undefined;
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: {
      ...(global.foundry?.utils ?? {}),
      getProperty: (object, key) => key.split('.').reduce((o, k) => o?.[k], object),
      setProperty: setPath,
      deepClone: value => JSON.parse(JSON.stringify(value)),
      randomID: () => `r${nextId++}`,
    },
  };
});

/* -------------------------------------------- */
/*  Comms Probe / False Data                     */
/* -------------------------------------------- */

describe('Comms Probe and False Data', () => {
  const PROBE = 'dditems/_source/Comms_Probe_kcU17jzso2caxVJ1.json';
  const FALSE_DATA = 'dditems/_source/False_Data_Xo62YAhi8lULOZpR.json';

  test('Comms Probe: a Free action DIF 12 Technology test; a success lets False Data roll Deception this scene', async () => {
    const actor = holder([PROBE, FALSE_DATA]);
    const [probe, falseData] = actor.items.contents;
    const falseUse = useRulesOf(falseData)[0];
    actor._dice = roller({ success: false });
    expect(useAvailable(falseData, falseUse.rule, falseUse.index)).toBe(false);

    const paid = pay();
    await runUse(probe, paid);
    expect(paid).toHaveBeenCalledWith('free');
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'technology', dif: '12' }), actor);
    // A failed probe gives False Data nothing to work on.
    expect(useAvailable(falseData, falseUse.rule, falseUse.index)).toBe(false);

    actor._dice = roller({ success: true });
    await runUse(probe, pay());
    expect(useAvailable(falseData, falseUse.rule, falseUse.index)).toBe(true);

    // False Data: an ordinary Deception test (no DIF of its own), no action.
    actor._dice = roller({ success: true, total: 17 });
    const falsePaid = pay();
    expect(await runUse(falseData, falsePaid)).toBeTruthy();
    expect(falsePaid).not.toHaveBeenCalled();
    const [[dataset]] = actor._dice.rollSkill.mock.calls;
    expect(dataset).toMatchObject({ skill: 'deception', essence: 'social', shiftUp: 0, shiftDown: 0 });
    expect(dataset.dif).toBeUndefined();

    // The probe lasts the scene.
    epoch = 2;
    expect(useAvailable(falseData, falseUse.rule, falseUse.index)).toBe(false);
  });
});

/* -------------------------------------------- */
/*  Mine! / Picking Up the Trail                 */
/* -------------------------------------------- */

test('Mine!: a Free action grab, openly or with an Infiltration test; backing out of the choice costs nothing', async () => {
  const actor = holder(['dditems/_source/Mine__7NGQHft6V1wAfGPw.json']);
  const [perk] = actor.items.contents;
  actor._dice = roller();

  const cancelled = pay();
  expect(await runUse(perk, cancelled, { pick: async () => null })).toBeNull();
  expect(cancelled).not.toHaveBeenCalled();

  const open = pay();
  expect(await runUse(perk, open, { pick: async (item, available) => available[0] })).toBeTruthy();
  expect(open).toHaveBeenCalledWith('free');
  expect(actor._dice.rollSkill).not.toHaveBeenCalled();

  const sneak = pay();
  await runUse(perk, sneak, { pick: async (item, available) => available[1] });
  expect(sneak).toHaveBeenCalledWith('free');
  expect(actor._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill: 'infiltration', essence: 'speed' }), actor);
});

test('Picking Up the Trail: an Alertness or Survival test, no action', async () => {
  const actor = holder(['dditems/_source/Picking_Up_The_Trail_lE4u6aGvWm86L6hY.json']);
  const [perk] = actor.items.contents;
  for (const [index, skill] of [[0, 'alertness'], [1, 'survival']]) {
    actor._dice = roller();
    const paid = pay();
    await runUse(perk, paid, { pick: async (item, available) => available[index] });
    expect(paid).not.toHaveBeenCalled();
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(expect.objectContaining({ skill, essence: 'smarts' }), actor);
  }

  expect(await runUse(perk, pay(), { pick: async () => null })).toBeNull();
});

/* -------------------------------------------- */
/*  Easy In, Easy Out                            */
/* -------------------------------------------- */

describe('Easy In, Easy Out', () => {
  const FILE = 'dditems/_source/Easy_In__Easy_Out_N36G5U8c8HSX3e9c.json';
  const disappear = () => makeItem({ id: `d${nextId++}`, name: 'Disappear', type: 'perk', flags: { core: { sourceId: 'Compendium.essence20.tf_crb.Item.aD6N6hTvFhsQFZnB' } } });

  test('going invisible in a combat (started or not) lasts until the start of the next turn', async () => {
    const actor = holder([FILE], { extra: [disappear()] });
    game.combat = { id: 'c', started: false };
    actor.statuses.add('invisible');
    await fireTriggers(actor, 'conditionGained');

    await fireTriggers(actor, 'turnStart');
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('invisible', { active: false });
    expect(actor.statuses.has('invisible')).toBe(false);
    // Once only: the next turn start leaves a fresh invisibility alone.
    actor.toggleStatusEffect.mockClear();
    actor.statuses.add('invisible');
    await fireTriggers(actor, 'turnStart');
    expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
  });

  test('not outside a combat, and not without Disappear', async () => {
    const actor = holder([FILE], { extra: [disappear()] });
    actor.statuses.add('invisible');
    await fireTriggers(actor, 'conditionGained');
    game.combat = { id: 'c', started: true };
    await fireTriggers(actor, 'turnStart');
    expect(actor.toggleStatusEffect).not.toHaveBeenCalled();

    const without = holder([FILE]);
    without.statuses.add('invisible');
    await fireTriggers(without, 'conditionGained');
    await fireTriggers(without, 'turnStart');
    expect(without.toggleStatusEffect).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------- */
/*  Loaded Questions                             */
/* -------------------------------------------- */

test('Loaded Questions: cumulative ↑1 per earlier Deception / Persuasion test on the same target this scene', async () => {
  const actor = holder(['dditems/_source/Loaded_Questions_nkqk7AfXUJkigqbq.json']);
  const foe = holder([]);
  const other = holder([]);
  const shifts = (target, rolledSkill) => ruleRollSources(actor, target, { rolledSkill }).sources.reduce((sum, s) => sum + s.shiftUp, 0);

  expect(shifts(foe, 'deception')).toBe(0);
  await fireTriggers(actor, 'hit', { roll: { rolledSkill: 'deception' }, outcome: 'success', targets: [foe] });
  await fireTriggers(actor, 'miss', { roll: { rolledSkill: 'persuasion' }, targets: [foe] });
  expect(shifts(foe, 'persuasion')).toBe(2);
  expect(shifts(foe, 'deception')).toBe(2);
  // Not another Skill, not another target, not with no target.
  expect(shifts(foe, 'alertness')).toBe(0);
  expect(shifts(other, 'deception')).toBe(0);
  expect(shifts(null, 'deception')).toBe(0);
  // Another Skill doesn't count up.
  await fireTriggers(actor, 'hit', { roll: { rolledSkill: 'intimidation' }, outcome: 'success', targets: [foe] });
  expect(shifts(foe, 'deception')).toBe(2);
  // A new scene starts again.
  epoch = 2;
  expect(shifts(foe, 'deception')).toBe(0);
  await fireTriggers(actor, 'hit', { roll: { rolledSkill: 'deception' }, outcome: 'success', targets: [foe] });
  expect(shifts(foe, 'deception')).toBe(1);
});

/* -------------------------------------------- */
/*  Predacon                                     */
/* -------------------------------------------- */

describe("Predacon's Frightened", () => {
  const FILE = 'tsitems/_source/Predacon_jRD6G5Z6eblTvxeO.json';

  test('comes off at the end of the target\'s next turn', async () => {
    const predacon = holder([FILE]);
    const foe = holder([], { disposition: -1 });
    const bystander = holder([], { disposition: -1 });
    onCanvas(predacon, foe, bystander);
    game.combat = { id: 'c', started: true };
    foe.statuses.add('frightened');
    bystander.statuses.add('frightened');

    await fireTriggers(predacon, 'hit', { roll: { rolledSkill: 'intimidation' }, outcome: 'success', targets: [foe] });
    // Someone else's turn ending changes nothing.
    await fireTriggers(bystander, 'turnEnd');
    expect(bystander.toggleStatusEffect).not.toHaveBeenCalled();
    expect(foe.toggleStatusEffect).not.toHaveBeenCalledWith('frightened', { active: false });

    await fireTriggers(foe, 'turnEnd');
    expect(foe.toggleStatusEffect).toHaveBeenCalledWith('frightened', { active: false });
    expect(foe.flags.essence20.ruleMarks?.predaconFright).toBeUndefined();
  });

  test('only an Intimidation hit in a combat (started or not) is followed', async () => {
    const predacon = holder([FILE]);
    const foe = holder([], { disposition: -1 });
    onCanvas(predacon, foe);
    await fireTriggers(predacon, 'hit', { roll: { rolledSkill: 'intimidation' }, outcome: 'success', targets: [foe] });
    game.combat = { id: 'c', started: false };
    await fireTriggers(predacon, 'hit', { roll: { rolledSkill: 'persuasion' }, outcome: 'success', targets: [foe] });
    expect(foe.flags.essence20.ruleMarks).toBeUndefined();
    await fireTriggers(predacon, 'hit', { roll: { rolledSkill: 'intimidation' }, outcome: 'success', targets: [foe] });
    expect(foe.flags.essence20.ruleMarks.predaconFright).toBeTruthy();
  });
});

/* -------------------------------------------- */
/*  Holographic Doubles                          */
/* -------------------------------------------- */

describe('Holographic Doubles', () => {
  const FILE = 'tfcrbitems/_source/Holographic_Doubles_rWrU13LenH7mukyV.json';
  const attack = { type: 'weaponEffect', system: {} };
  const count = actor => actor.flags.essence20.ruleMarks?.holoDoubles?.count;

  test('a Standard action for the first, a Free action for each more, up to eight, this scene', async () => {
    const actor = holder([FILE]);
    const [perk] = actor.items.contents;
    const paid = pay();
    await runUse(perk, paid);
    await runUse(perk, paid);
    expect(paid.mock.calls.map(c => c[0])).toEqual(['standard', 'free']);
    expect(count(actor)).toBe(2);

    for (let i = 0; i < 6; i++) {
      await runUse(perk, pay());
    }

    expect(count(actor)).toBe(8);
    expect(useRulesOf(perk).some(({ rule, index }) => useAvailable(perk, rule, index))).toBe(false);
    // A new scene: they're gone, and the first is a Standard action again.
    epoch = 2;
    const again = pay();
    await runUse(perk, again);
    expect(again).toHaveBeenCalledWith('standard');
    expect(count(actor)).toBe(1);
  });

  test('↓1 per double on attacks against the holder, this scene only', async () => {
    const actor = holder([FILE]);
    const attacker = holder([]);
    await runUse(actor.items.contents[0], pay());
    await runUse(actor.items.contents[0], pay());
    await runUse(actor.items.contents[0], pay());
    const down = (roll, target = actor) => ruleRollSources(attacker, target, roll).sources.reduce((sum, s) => sum + s.shiftDown, 0);
    expect(down({ item: attack, isAttack: true })).toBe(3);
    expect(down({ rolledSkill: 'persuasion' })).toBe(0);
    expect(down({ item: attack, isAttack: true }, holder([]))).toBe(0);
    epoch = 2;
    expect(down({ item: attack, isAttack: true })).toBe(0);
  });

  test('one disappears when the holder rolls, and when an attack against them misses', async () => {
    const actor = holder([FILE]);
    const attacker = holder([]);
    await runUse(actor.items.contents[0], pay());
    await runUse(actor.items.contents[0], pay());
    await runUse(actor.items.contents[0], pay());

    await fireTriggers(actor, 'afterRoll', { roll: { rolledSkill: 'athletics' }, outcome: 'success' });
    expect(count(actor)).toBe(2);
    // A hit, or a miss with something other than an attack, takes none.
    await fireTriggers(actor, 'targeted', { roll: { item: attack, isAttack: true }, outcome: 'success', targets: [attacker] });
    await fireTriggers(actor, 'targeted', { roll: { rolledSkill: 'persuasion' }, outcome: 'failure', targets: [attacker] });
    expect(count(actor)).toBe(2);
    await fireTriggers(actor, 'targeted', { roll: { item: attack, isAttack: true }, outcome: 'failure', targets: [attacker] });
    expect(count(actor)).toBe(1);
    await fireTriggers(actor, 'afterRoll', { roll: {}, outcome: 'failure' });
    expect(count(actor)).toBe(0);
    // Never below none.
    await fireTriggers(actor, 'afterRoll', { roll: {}, outcome: 'failure' });
    expect(count(actor)).toBe(0);
    expect(ruleRollSources(attacker, actor, { item: attack, isAttack: true }).sources).toEqual([]);
  });
});

/* -------------------------------------------- */
/*  The Right Of All Sentient Beings             */
/* -------------------------------------------- */

describe('The Right Of All Sentient Beings', () => {
  const FILE = 'tfcrbitems/_source/The_Right_Of_All_Sentient_Beings_Ycrb7vHTOZ79nC9U.json';
  const edges = (actor, roll = { rolledSkill: 'athletics' }) => ruleRollSources(actor, null, roll).sources.filter(s => s.edge);
  const protect = actor => ruleDialogSwitches(actor, { rolledSkill: 'athletics' }).filter(s => /Protecting/.test(s.label));

  test('needs a combat (started or not); then Edge on Skill Tests for the rest of that combat', async () => {
    const actor = holder([FILE]);
    const [perk] = actor.items.contents;
    const [use] = useRulesOf(perk);
    expect(useAvailable(perk, use.rule, use.index)).toBe(false);
    expect(protect(actor)).toEqual([]);

    const combat = { id: 'c9', started: false };
    game.combat = combat;
    game.combats = { get: id => (id == combat.id ? combat : undefined) };
    // The "protecting a non-combatant" Edge is a switch until then, unticked.
    expect(protect(actor)).toEqual([expect.objectContaining({ value: false })]);
    expect(edges(actor)).toEqual([]);

    const paid = pay();
    expect(await runUse(perk, paid)).toBeTruthy();
    expect(paid).not.toHaveBeenCalled();
    expect(useAvailable(perk, use.rule, use.index)).toBe(false);
    expect(edges(actor)).toEqual([expect.objectContaining({ label: 'The Right Of All Sentient Beings', edge: true })]);
    expect(edges(actor, { item: { type: 'weaponEffect', system: {} }, isAttack: true })).toHaveLength(1);
    expect(protect(actor)).toEqual([]);
    // Not Initiative (the old roll source never reached it).
    expect(edges(actor, { rolledSkill: 'initiative', dataset: { isInitiative: true } })).toEqual([]);

    // The combat ends: so does the Edge.
    game.combat = null;
    game.combats = { get: () => undefined };
    expect(edges(actor)).toEqual([]);
  });
});

/* -------------------------------------------- */
/*  Alt Mode Gear weapons                        */
/* -------------------------------------------- */

describe('Alt Mode Gear: the Bot Mode weapon', () => {
  const GEAR = {
    'Rotor Blades': ['tfcrbitems/_source/Rotor_Blades_jkZQIpL661klm5sP.json', 'Compendium.essence20.tf_crb.Item.PFuzUrcYw14JRLf9', {}],
    'Tow Cable & Hook': ['tfcrbitems/_source/Tow_Cable___Hook_EVywnYUDjBfMcoWT.json', 'Compendium.essence20.tf_crb.Item.8NfDRYoPVQJPGiVj', {}],
    'Water Cannon': ['tfcrbitems/_source/Water_Cannon_FUOOqATSqU6habEt.json', 'Compendium.essence20.tf_crb.Item.jSjdGdieoUkT0nAf', { elementChoice: 'cold' }],
  };

  afterEach(() => {
    delete global.fromUuid;
  });

  for (const [name, [file, uuid, extra]] of Object.entries(GEAR)) {
    test(`${name}: made once from the compendium weapon, named for the gear, Integrated, requirements waived, equipped in Bot Mode`, async () => {
      const actor = holder([file], { system: { isTransformed: false } });
      const [gear] = actor.items.contents;
      gear.system.equipped = true;
      global.fromUuid = jest.fn(async () => ({
        toObject: () => ({ _id: 'x', name: 'Weapon', type: 'weapon', system: { classification: { size: 'heavy' }, requirements: { skill: 'technology', shift: 'd4', custom: 'x' }, equipped: false, items: {} } }),
      }));
      actor.createEmbeddedDocuments = jest.fn(async (type, datas) => {
        const docs = datas.map(data => makeItem({ ...data, id: `n${nextId++}` }));
        for (const doc of docs) {
          doc.parent = actor;
          actor.items.contents.push(doc);
        }

        rebuildIndex(actor);
        return docs;
      });
      actor.updateEmbeddedDocuments = jest.fn(async () => []);
      const [use] = useRulesOf(gear);
      expect(useAvailable(gear, use.rule, use.index)).toBe(true);

      const paid = pay();
      expect(await runUse(gear, paid)).toBeTruthy();
      expect(paid).not.toHaveBeenCalled();
      expect(global.fromUuid).toHaveBeenCalledWith(uuid);
      const [[, [data]]] = actor.createEmbeddedDocuments.mock.calls;
      expect(data).toMatchObject({
        name,
        system: { classification: { size: 'integrated' }, requirements: { skill: null, shift: null, custom: '' }, equipped: true, ...extra },
        flags: { essence20: { grantedBy: gear.id } },
        _stats: { compendiumSource: uuid },
      });
      // Hidden while the weapon exists.
      expect(useAvailable(gear, use.rule, use.index)).toBe(false);
    });
  }

  test('made in Alt Mode, it starts stowed', async () => {
    const [file, uuid] = GEAR['Rotor Blades'];
    const actor = holder([file], { system: { isTransformed: true } });
    const [gear] = actor.items.contents;
    gear.system.equipped = true;
    global.fromUuid = jest.fn(async () => ({ toObject: () => ({ name: 'Weapon', type: 'weapon', system: { items: {} } }) }));
    actor.createEmbeddedDocuments = jest.fn(async (type, datas) => datas.map(data => ({ ...data, id: `n${nextId++}` })));
    actor.updateEmbeddedDocuments = jest.fn(async () => []);
    await runUse(gear, pay());
    expect(global.fromUuid).toHaveBeenCalledWith(uuid);
    expect(actor.createEmbeddedDocuments.mock.calls[0][1][0].system.equipped).toBe(false);
  });
});
