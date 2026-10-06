import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Slice round 8, part slB8 (tf1, tf2, tf3, fix3-tf, other2): items converted from hand-written code to
 * item rules with the round-8 engine pieces (itemAdded / movedOnTurn events, marks per setter), and
 * the two round-7 conversions whose shared mark is now kept per setter (Steady Firepower, Duke It Out).
 * Each item is loaded from its pack source and must do what the removed code did.
 */

// The engine's createItem / updateToken hooks are registered at import time.
const hooks = {};
global.Hooks = { on: (name, fn) => (hooks[name] = [...(hooks[name] ?? []), fn]), once: () => {}, callAll: () => {} };

const { rebuildIndex } = await import('./index.mjs');
const { ruleDefenseAdjust, ruleRollSources } = await import('./adapter.mjs');
const { registerCheck, setWorldLookups } = await import('./predicate.mjs');
const { fireTriggers, runUse } = await import('./triggers.mjs');
const { favoriteWeaponOf, TF1 } = await import('../helpers/extensions/tf1/common.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromPack = file => JSON.parse(readFileSync(join(ROOT, 'packs', file), 'utf8'));

let nextId = 1;
let epoch = 1;

const getPath = (object, key) => key.split('.').reduce((o, k) => o?.[k], object);

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

function makeItem(data) {
  return {
    flags: {}, system: {}, ...data,
    async update(changes) {
      await applyUpdate(this, changes);
    },
  };
}

/** An actor holding these pack items (and these plain items). */
function holder(files = [], { system = {}, disposition = 1, name = 'Hero', type = 'playerCharacter', items: extra = [] } = {}) {
  const actor = {
    id: `a${nextId++}`, name, type, documentName: 'Actor', isOwner: true, statuses: new Set(), flags: { essence20: {} },
    system: { level: 3, health: { value: 10, max: 10 }, ...system },
    async update(data) {
      await applyUpdate(this, data);
    },
    toggleStatusEffect: jest.fn(async (id, { active } = {}) => (active ? actor.statuses.add(id) : actor.statuses.delete(id))),
  };
  actor.uuid = `Actor.${actor.id}`;
  const token = { id: `t${actor.id}`, actor, document: { disposition }, center: { x: 0, y: 0 } };
  actor.getActiveTokens = () => [token];
  actor.token = token;
  const items = [
    ...files.map(file => {
      const doc = fromPack(file);
      return makeItem({ id: `c${nextId++}`, name: doc.name, type: doc.type, system: doc.system });
    }),
    ...extra.map(data => makeItem(data)),
  ];
  actor.items = { contents: items, get: id => items.find(item => item.id == id), [Symbol.iterator]: () => items[Symbol.iterator]() };
  for (const item of items) {
    item.parent = actor;
  }

  rebuildIndex(actor);
  game.actors.contents.push(actor);
  return actor;
}

/** An item arriving on the actor, as Foundry's createItem hook reports it. */
function addItem(actor, data) {
  const item = makeItem({ id: `n${nextId++}`, ...data });
  item.parent = actor;
  actor.items.contents.push(item);
  rebuildIndex(actor);
  hooks.createItem.forEach(fn => fn(item, {}, game.user.id));
  return item;
}

function target(...actors) {
  game.user.targets = new Set(actors.map(actor => actor.token));
}

const flush = () => new Promise(resolve => setTimeout(resolve, 20));
const posted = () => ChatMessage.create.mock.calls.map(([data]) => data.content).join(' ');
const sourcesOf = (actor, other, ctx = {}) => ruleRollSources(actor, other, { rolledSkill: 'athletics', ...ctx }).sources;

beforeEach(() => {
  epoch = 1;
  global.game = {
    combat: null, combats: null, user: { id: 'u', isGM: false, targets: new Set() }, users: { activeGM: null },
    i18n: { localize: k => k, format: k => k, has: () => false }, settings: { get: () => epoch }, actors: { contents: [] },
  };
  global.CONFIG = { E20: { skillToEssence: { might: 'strength', targeting: 'speed', athletics: 'strength' } } };
  global.canvas = undefined;
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.fromUuid = undefined;
  global.fromUuidSync = undefined;
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: {
      ...(global.foundry?.utils ?? {}),
      getProperty: getPath,
      setProperty: setPath,
      hasProperty: (object, key) => getPath(object, key) !== undefined,
      deepClone: value => JSON.parse(JSON.stringify(value)),
      escapeHTML: text => String(text),
      randomID: () => `r${nextId++}`,
    },
    applications: {
      ...(global.foundry?.applications ?? {}),
      api: {
        ApplicationV2: class {}, HandlebarsApplicationMixin: Base => class extends Base {},
        DialogV2: { wait: jest.fn(async () => null) },
      },
    },
  };
  setWorldLookups({});
});

afterEach(() => {
  jest.restoreAllMocks();
});

/* -------------------------------------------- */
/*  Lingering Side Effects                       */
/* -------------------------------------------- */

describe('Lingering Side Effects', () => {
  const FILE = 'tsitems/_source/Lingering_Side_Effects_jDRfmpsy1ElT2Kkn.json';
  const altMode = name => ({ name, type: 'altMode', system: {} });

  test('a third Alt Mode arriving posts the warning; a first or second one, or another item, does not', async () => {
    const beast = holder([FILE]);
    addItem(beast, altMode('Wolf'));
    addItem(beast, altMode('Hawk'));
    addItem(beast, { name: 'Blaster', type: 'weapon', system: {} });
    await flush();
    expect(posted()).not.toContain('third Alt Mode');

    addItem(beast, altMode('Shark'));
    await flush();
    expect(posted()).toContain('Hero has Lingering Side Effects');
    expect(ChatMessage.create).toHaveBeenCalledTimes(1);
  });

  test('without the Hang-Up, three Alt Modes are fine', async () => {
    const bot = holder([], { items: [altMode('Car'), altMode('Jet')] });
    addItem(bot, altMode('Tank'));
    await flush();
    expect(ChatMessage.create).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------- */
/*  Dust Up                                      */
/* -------------------------------------------- */

describe('Dust Up', () => {
  const FILE = 'tfcrbitems/_source/Dust_Up_7aKjiqEZ3LYuvwmu.json';

  function setup() {
    const racer = holder([FILE]);
    game.combat = { id: 'c1', started: true, round: 1, turn: 0, combatant: { tokenId: racer.token.id, actor: racer } };
    const move = actor => hooks.updateToken.forEach(fn => fn({ id: actor.token.id, actor }, { x: 100 }, {}, game.user.id));
    return { racer, move };
  }

  test('moving on its own turn gives Cover once; it comes off when its next turn starts', async () => {
    const { racer, move } = setup();
    move(racer);
    await flush();
    expect(racer.statuses.has('cover')).toBe(true);
    expect(racer.toggleStatusEffect).toHaveBeenCalledTimes(1);
    // A second move the same turn changes nothing (Cover removed by hand stays off).
    racer.statuses.delete('cover');
    move(racer);
    await flush();
    expect(racer.toggleStatusEffect).toHaveBeenCalledTimes(1);
    racer.statuses.add('cover');

    await fireTriggers(racer, 'turnStart');
    expect(racer.statuses.has('cover')).toBe(false);
    // Moving again on the new turn gives it again.
    move(racer);
    await flush();
    expect(racer.statuses.has('cover')).toBe(true);
  });

  test('Cover it already had is left alone at the next turn', async () => {
    const { racer, move } = setup();
    racer.statuses.add('cover');
    move(racer);
    await flush();
    expect(racer.toggleStatusEffect).not.toHaveBeenCalled();
    await fireTriggers(racer, 'turnStart');
    expect(racer.statuses.has('cover')).toBe(true);
    expect(racer.flags.essence20.ruleMarks).toEqual({});
  });

  test('not on someone else\'s turn, not out of a started combat, not without the Perk', async () => {
    const { racer, move } = setup();
    const other = holder([]);
    game.combat.combatant = { tokenId: other.token.id, actor: other };
    move(racer);
    game.combat = { id: 'c1', started: false, combatant: { tokenId: racer.token.id, actor: racer } };
    move(racer);
    await flush();
    expect(racer.statuses.has('cover')).toBe(false);

    game.combat = { id: 'c1', started: true, combatant: { tokenId: other.token.id, actor: other } };
    move(other);
    await flush();
    expect(other.statuses.has('cover')).toBe(false);
    // A turn start with no move made does nothing.
    await fireTriggers(racer, 'turnStart');
    expect(racer.toggleStatusEffect).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------- */
/*  Steady Firepower: one count per holder        */
/* -------------------------------------------- */

describe('Steady Firepower (per holder)', () => {
  const FILE = 'dditems/_source/Steady_Firepower_svqVyP2tyYzSUtn6.json';

  beforeEach(() => {
    registerCheck('favoriteWeaponRolled', (actor, option, ctx) => {
      const weapon = favoriteWeaponOf(actor);
      return !!weapon && !!ctx?.item && (ctx.item.id == weapon.id || ctx.item.flags?.essence20?.parentId == weapon.id);
    });
  });

  function shooter(name) {
    const actor = holder([FILE], { name, items: [
      { id: 'w1', name: 'Favorite Rifle', type: 'weapon', system: {} },
      { id: 'e1', name: 'Shot', type: 'weaponEffect', system: { classification: { style: 'ranged' } }, flags: { essence20: { parentId: 'w1' } } },
      { id: 'w2', name: 'Pistol', type: 'weapon', system: {} },
      { id: 'e2', name: 'Pistol Shot', type: 'weaponEffect', system: { classification: { style: 'ranged' } }, flags: { essence20: { parentId: 'w2' } } },
      { id: 'fw', name: 'Favorite Weapon', type: 'perk', system: { choice: 'w1' }, flags: { core: { sourceId: TF1.favoriteWeapon } } },
    ] });
    const attack = async (id, targets) => {
      target(...targets);
      await fireTriggers(actor, 'afterRoll', {
        roll: { item: actor.items.get(id), isAttack: true, isMelee: false, targetCount: targets.length },
        outcome: 'success', facts: { results: [{ success: true }] }, vars: { targets: targets.length },
      });
    };

    const defense = (defender, id = 'e1') => ruleDefenseAdjust(actor, defender, 'evasion', { item: actor.items.get(id) });
    return { actor, attack, defense };
  }

  test('two holders on one creature keep their own counts', async () => {
    const one = shooter('One');
    const two = shooter('Two');
    const foe = holder([], { name: 'Foe', disposition: -1 });
    const other = holder([], { name: 'Other', disposition: -1 });
    await one.attack('e1', [foe]);
    await one.attack('e1', [foe]);
    await two.attack('e1', [foe]);
    expect(one.defense(foe)).toBe(-2);
    expect(two.defense(foe)).toBe(-1);
    // One holder switching weapon / target resets only its own count.
    await two.attack('e2', [foe]);
    expect(two.defense(foe)).toBe(0);
    expect(one.defense(foe)).toBe(-2);
    await one.attack('e1', [other]);
    expect(one.defense(foe)).toBe(0);
    expect(one.defense(other)).toBe(-1);
    // Still scene-long.
    epoch = 2;
    expect(one.defense(other)).toBe(0);
  });
});

/* -------------------------------------------- */
/*  Duke It Out: one refusal per challenger       */
/* -------------------------------------------- */

describe('Duke It Out (per challenger)', () => {
  const FILE = 'tfcrbitems/_source/Duke_It_Out_jkuNDvRt4D9jyDsn.json';

  test('two challengers refused by one creature each keep their Edge', async () => {
    foundry.applications.api.DialogV2.wait.mockImplementation(async () => 'refuse');
    const a = holder([FILE], { name: 'A' });
    const b = holder([FILE], { name: 'B' });
    const foe = holder([], { name: 'Foe', disposition: -1, system: { level: 3 } });
    target(foe);
    await runUse(a.items.contents[0], jest.fn(async () => true));
    expect(sourcesOf(a, foe)).toEqual([expect.objectContaining({ label: 'Duke It Out', edge: true })]);
    expect(sourcesOf(b, foe)).toEqual([]);
    await runUse(b.items.contents[0], jest.fn(async () => true));
    expect(sourcesOf(a, foe)).toEqual([expect.objectContaining({ edge: true })]);
    expect(sourcesOf(b, foe)).toEqual([expect.objectContaining({ edge: true })]);
    epoch = 2;
    expect(sourcesOf(a, foe)).toEqual([]);
    expect(sourcesOf(b, foe)).toEqual([]);
  });
});
