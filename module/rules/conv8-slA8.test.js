import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Batch slA8 (docs/rules-batches/slA8.md): the zord1 / zord2 / pr1 / pr2 / pr3 slice items re-checked
 * against the round-8 engine pieces. Converted: Incineration Blast (a crit hit marks the target until the
 * end of its next turn; a watch Trigger on movedOnTurn burns it for 1 Fire) and Zord Mount (pick from
 * actors with actorType zord, legacy-read from the old flag; an afterRoll note on the first melee attack
 * each turn). Each is loaded from its pack source and must do what the removed slice code did.
 */

// The picker the pick steps ask (mechanics/resources/grants.mjs) and the damage step's applyDamage (mechanics/combat/combat.mjs).
// (Mocked paths resolve from module/jest.setup.js.)
const chooseSelect = jest.fn();
const applyDamage = jest.fn();
jest.unstable_mockModule('./mechanics/resources/grants.mjs', () => ({ chooseSelect, rollTest: jest.fn(), markIntegrated: jest.fn() }));
jest.unstable_mockModule('./mechanics/combat/combat.mjs', () => ({ applyDamage }));

const { rebuildIndex } = await import('./index.mjs');
const { fireTriggers, runUse } = await import('./triggers.mjs');
const { legacyChoiceUpdates } = await import('./legacy-choices.mjs');
const { validateRule } = await import('./types.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

const FILES = {
  incineration: 'fmmcitems/_source/Incineration_Blast_Effect_q415Hdvrl2rrCu9y.json',
  zordMount: 'ttsgitems/_source/Zord_Mount_5IKuaL41Ebd4ll8i.json',
};
const SMOLDER = 'pr2IncinerationSmolder';

let nextId = 1;

const getPath = (object, key) => key.split('.').reduce((o, k) => o?.[k], object);
function setPath(object, key, value) {
  const deletion = key.match(/^(.*)\.-=(.+)$/);
  if (deletion) {
    delete getPath(object, deletion[1])?.[deletion[2]];
    return;
  }

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

function makeActor(type = 'playerCharacter', name = 'Ranger', x = 0) {
  const items = [];
  const actor = {
    id: `a${nextId++}`, name, type, isOwner: true, statuses: new Set(), flags: { essence20: {} },
    system: { health: { value: 5, max: 10 } },
    update: jest.fn(async function (data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }
    }),
    async setFlag(scope, key, value) {
      setPath(this, `flags.${scope}.${key}`, value);
    },
    getFlag(scope, key) {
      return getPath(this.flags?.[scope], key);
    },
  };
  actor.uuid = `Actor.${actor.id}`;
  actor.token = { actor, center: { x, y: 0 }, document: { disposition: type == 'npc' ? -1 : 1 } };
  actor.getActiveTokens = () => [actor.token];
  actor.items = { contents: items, get: id => items.find(item => item.id == id), [Symbol.iterator]: () => items[Symbol.iterator]() };
  game.actors.contents.push(actor);
  return actor;
}

function addPackItem(actor, file, extra = {}) {
  const doc = fromPack(file);
  const item = asItem({
    name: doc.name, type: doc.type, system: { ...doc.system }, flags: extra.flags ?? {},
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

function onCanvas(...actors) {
  global.canvas = {
    tokens: { placeables: actors.map(actor => actor.token) },
    grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) },
  };
}

beforeEach(() => {
  const contents = [];
  global.game = {
    combat: null, user: { id: 'u', isGM: true, targets: new Set() }, users: { activeGM: null }, settings: { get: () => 1 },
    actors: { contents, get: id => contents.find(actor => actor.id == id), [Symbol.iterator]: () => contents[Symbol.iterator]() },
    i18n: { localize: k => k, format: k => k },
  };
  global.fromUuidSync = uuid => contents.find(actor => actor.uuid == uuid) ?? null;
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: { ...(global.foundry?.utils ?? {}), getProperty: getPath, setProperty: setPath },
  };
  chooseSelect.mockReset();
  applyDamage.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
  delete global.canvas;
  delete global.fromUuidSync;
});

const lines = () => ChatMessage.create.mock.calls.map(([data]) => data.content).join(' ');

test('every rule added in this batch is valid', () => {
  for (const file of Object.values(FILES)) {
    for (const rule of fromPack(file).system.rules) {
      expect(validateRule(rule)).toEqual([]);
    }
  }
});

/* -------------------------------------------- */
/*  Incineration Blast (pr2/finster.mjs)         */
/* -------------------------------------------- */

describe('Incineration Blast: a Critical Success burns the target for 1 Fire if it moves on its next turn', () => {
  function setup() {
    const monster = makeActor('npc', 'Monster', 0);
    const effect = addPackItem(monster, FILES.incineration);
    const ranger = makeActor('playerCharacter', 'Ranger', 30);
    const hit = (outcome, item = effect, target = ranger) => fireTriggers(monster, 'hit', {
      roll: { item, isAttack: true, isMelee: false }, outcome, targets: [target], facts: { results: [{ success: true }], isCrit: outcome == 'crit' },
    });
    onCanvas(monster, ranger);
    return { monster, effect, ranger, hit };
  }

  test('a crit marks the target (set by the attacker); a plain hit or another attack does not', async () => {
    const { monster, ranger, hit } = setup();
    await hit('success');
    expect(ranger.flags.essence20.ruleMarks?.[SMOLDER]).toBeUndefined();
    const other = addItem(monster, { name: 'Claw', type: 'weaponEffect', system: {} });
    await hit('crit', other);
    expect(ranger.flags.essence20.ruleMarks?.[SMOLDER]).toBeUndefined();
    await hit('crit');
    expect(ranger.flags.essence20.ruleMarks[SMOLDER].by).toBe(monster.uuid);
    expect(lines()).toContain('Ranger is smoldering');
  });

  test('the marked target moving on its turn takes 1 Fire damage, once', async () => {
    const { ranger, hit } = setup();
    await hit('crit');
    await fireTriggers(ranger, 'movedOnTurn');
    expect(applyDamage).toHaveBeenCalledTimes(1);
    expect(applyDamage).toHaveBeenCalledWith(ranger, 1, 'fire');
    expect(ranger.flags.essence20.ruleMarks?.[SMOLDER]).toBeUndefined();
    await fireTriggers(ranger, 'movedOnTurn');
    expect(applyDamage).toHaveBeenCalledTimes(1);
  });

  test('an unmarked creature moving takes nothing', async () => {
    const { monster } = setup();
    const bystander = makeActor('playerCharacter', 'Bystander', 10);
    onCanvas(monster, bystander);
    await fireTriggers(bystander, 'movedOnTurn');
    expect(applyDamage).not.toHaveBeenCalled();
  });

  test('two Incineration Blast holders: the target burns once (the last crit\'s mark)', async () => {
    const { monster, ranger, hit } = setup();
    const second = makeActor('npc', 'Second', 5);
    const secondEffect = addPackItem(second, FILES.incineration);
    onCanvas(monster, second, ranger);
    await hit('crit');
    await fireTriggers(second, 'hit', { roll: { item: secondEffect, isAttack: true }, outcome: 'crit', targets: [ranger], facts: { results: [{ success: true }], isCrit: true } });
    await fireTriggers(ranger, 'movedOnTurn');
    expect(applyDamage).toHaveBeenCalledTimes(1);
  });

  test('in combat the mark ends with the target\'s next turn (the old turn-end clean-up)', async () => {
    const { monster, ranger, hit } = setup();
    game.combat = { id: 'c', started: true, round: 1, turn: 0, turns: [{ actor: monster }, { actor: ranger }] };
    await hit('crit');
    // Still the target's own next turn: it burns.
    game.combat = { ...game.combat, turn: 1 };
    await fireTriggers(ranger, 'movedOnTurn');
    expect(applyDamage).toHaveBeenCalledTimes(1);
    // A fresh crit, then the target's turn passes without a move: gone by the next round.
    game.combat = { ...game.combat, turn: 0 };
    await hit('crit');
    game.combat = { ...game.combat, round: 2, turn: 0 };
    await fireTriggers(ranger, 'movedOnTurn');
    expect(applyDamage).toHaveBeenCalledTimes(1);
  });
});

/* -------------------------------------------- */
/*  Zord Mount (pr3/ttsg.mjs)                    */
/* -------------------------------------------- */

describe('Zord Mount: name the rider; the mount\'s first melee attack each turn announces its follow-up', () => {
  function setup(flags = {}) {
    const mount = makeActor('zord', 'Mount');
    const rider = makeActor('zord', 'Rider');
    makeActor('playerCharacter', 'Pilot');
    makeActor('vehicle', 'Bike');
    const feature = addPackItem(mount, FILES.zordMount, { flags });
    const enemy = makeActor('npc', 'Enemy');
    const melee = addItem(mount, { name: 'Stomp', type: 'weaponEffect', system: { classification: { style: 'melee' } } });
    const attack = (isMelee = true, targetCount = 1) => {
      game.user.targets = new Set(targetCount ? [enemy.token] : []);
      return fireTriggers(mount, 'afterRoll', {
        roll: { item: melee, isAttack: true, isMelee, targetCount }, outcome: 'success', facts: { results: [{ success: true }] },
      });
    };

    const followUps = () => ChatMessage.create.mock.calls.filter(([data]) => data.content.includes('may also make a melee Attack')).length;
    return { mount, rider, feature, enemy, attack, followUps };
  }

  const chooseOption = label => async (step, options) => options.findIndex(option => option.label == label);

  test('the pick offers every other Zord in the world and keeps the choice', async () => {
    const { rider, feature } = setup();
    chooseSelect.mockImplementation(async () => rider.uuid);
    await runUse(feature, async () => true, { ask: chooseOption('Pick the rider Zord') });
    expect(chooseSelect.mock.calls[0][2].map(o => o.label)).toEqual(['Rider']);
    expect(feature.flags.essence20.rules.choices.rider).toBe(rider.uuid);
  });

  test('"No rider" clears the pick (and the old flag)', async () => {
    const { rider, feature } = setup({ essence20: { pr3MountRider: 'Actor.old', rules: { choices: { rider: 'Actor.old' } } } });
    await runUse(feature, async () => true, { ask: chooseOption('No rider') });
    expect(feature.flags.essence20.rules.choices.rider).toBe('');
    expect(feature.flags.essence20.pr3MountRider).toBe('');
    expect(legacyChoiceUpdates(feature.parent)).toEqual([]);
    expect(rider).toBeDefined();
  });

  test('an old pick moves over through the linking pass', () => {
    const { mount, rider, feature } = setup({ essence20: { pr3MountRider: 'placeholder' } });
    feature.flags.essence20.pr3MountRider = rider.uuid;
    expect(legacyChoiceUpdates(mount)).toEqual([{ _id: feature.id, 'flags.essence20.rules.choices.rider': rider.uuid }]);
  });

  test('with a rider: a melee attack with a target posts the follow-up naming the rider and the target', async () => {
    const { rider, feature, attack, followUps } = setup();
    setPath(feature, "flags.essence20.rules.choices.rider", rider.uuid);
    await attack();
    expect(followUps()).toBe(1);
    expect(lines()).toContain(`@UUID[${rider.uuid}] may also make a melee Attack against Enemy.`);
  });

  test('nothing without a rider, for a ranged attack, or with no target', async () => {
    const { rider, feature, attack, followUps } = setup();
    await attack();
    expect(followUps()).toBe(0);
    setPath(feature, "flags.essence20.rules.choices.rider", rider.uuid);
    await attack(false);
    await attack(true, 0);
    expect(followUps()).toBe(0);
  });

  test('once per turn in combat; every time out of combat', async () => {
    const { rider, feature, attack, followUps } = setup();
    setPath(feature, "flags.essence20.rules.choices.rider", rider.uuid);
    await attack();
    await attack();
    expect(followUps()).toBe(2);
    game.combat = { id: 'c', started: true, round: 1, turn: 0 };
    await attack();
    await attack();
    expect(followUps()).toBe(3);
    game.combat = { ...game.combat, turn: 1 };
    await attack();
    expect(followUps()).toBe(4);
  });
});
