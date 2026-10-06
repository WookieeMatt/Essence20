import { jest } from '@jest/globals';

/**
 * Round 13, group J (docs/rules-batches/slJ13.md): world sweeps reaching unlinked tokens' actors
 * (rules/triggers.mjs#sweepActors - sceneStart / missionStart / sessionStart Triggers, scene / mission Pool resets and
 * the timed-item sweep), and the roll:skillSpecialized tag (rules/ext/j.mjs).
 */

const hooks = {};
const onHook = (name, fn) => (hooks[name] ??= []).push(fn);
global.Hooks = { on: onHook, once: () => 0, callAll: () => {} };
jest.unstable_mockModule('./helpers/gm-relay.mjs', () => ({ needsGmRelay: () => false, relayToGm: jest.fn() }));

await import('./ext/index.mjs');
await import('./adapter.mjs');
const { rebuildIndex } = await import('./index.mjs');
const { sweepActors, fireTriggers } = await import('./triggers.mjs');
const { contextFor, evaluate } = await import('./predicate.mjs');
const { validateRule } = await import('./types.mjs');
const { runMissionAdvanced, runSceneAdvanced, runTurnStart } = await import('../helpers/extensions.mjs');

let nextId = 1;
const clock = { sceneClockScene: 3, sceneClockEncounter: 3, sceneClockMission: 7 };
const getPath = (object, key) => String(key).split('.').reduce((o, k) => (o === null || o === undefined ? o : o[k]), object);
function setPath(object, key, value) {
  const keys = key.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), object)[last] = value;
}

const worldActors = [];

/** An actor double; `world: false` makes it a synthetic (unlinked token) actor - not in game.actors. */
function makeActor(name, { world = true, uuid = null, rules = [], system = {}, itemFlags = {} } = {}) {
  const items = [];
  const actor = {
    id: `a${nextId++}`, name, type: 'npc', isOwner: true, statuses: new Set(), flags: { essence20: {} }, effects: [],
    system: { count: 0, health: { value: 5, max: 10 }, skills: {}, ...system },
    getActiveTokens: () => [],
    async update(data) {
      for (const [key, value] of Object.entries(data)) {
        setPath(this, key, value);
      }

      rebuildIndex(this);
    },
    async setFlag(scope, key, value) {
      setPath(this, `flags.${scope}.${key}`, value);
    },
    getFlag(scope, key) {
      return getPath(this.flags?.[scope], key);
    },
    updateEmbeddedDocuments: jest.fn(async (kind, updates) => {
      for (const { _id, ...changes } of updates) {
        const item = items.find(entry => entry.id == _id);
        for (const [key, value] of Object.entries(changes)) {
          setPath(item, key, value);
        }
      }

      rebuildIndex(actor);
    }),
    deleteEmbeddedDocuments: jest.fn(async (kind, ids) => {
      const list = kind == 'ActiveEffect' ? actor.effects : items;
      for (const id of ids) {
        const at = list.findIndex(entry => entry.id == id);
        if (at >= 0) {
          list.splice(at, 1);
        }
      }

      rebuildIndex(actor);
    }),
  };
  actor.uuid = uuid ?? (world ? `Actor.${actor.id}` : `Scene.s1.Token.t${nextId++}.Actor.${actor.id}`);
  actor.items = { contents: items, get: id => items.find(item => item.id == id), [Symbol.iterator]: () => items[Symbol.iterator]() };
  if (rules.length) {
    const item = { id: `i${nextId++}`, name: `${name}'s perk`, type: 'perk', system: { rules }, flags: { essence20: itemFlags }, effects: [], parent: actor };
    item.uuid = `${actor.uuid}.Item.${item.id}`;
    items.push(item);
  }

  if (world) {
    worldActors.push(actor);
  }

  rebuildIndex(actor);
  return actor;
}

const COUNT = event => ({ type: 'Trigger', event, steps: [{ do: 'updateActor', add: { 'system.count': 1 } }] });
const token = (actor, actorLink) => ({ actorLink, actor });
const placeable = (actor, actorLink) => ({ actor, document: { actorLink } });

beforeEach(() => {
  worldActors.length = 0;
  global.game = {
    combat: null, user: { id: 'u', isGM: true, isActiveGM: true, targets: new Set() }, users: { activeGM: null, contents: [] },
    settings: { get: (scope, key) => clock[key] ?? 1, set: async () => {} },
    actors: { contents: worldActors, get: id => worldActors.find(actor => actor.id == id), [Symbol.iterator]: () => worldActors[Symbol.iterator]() },
    scenes: { active: null },
    i18n: { localize: k => k, format: k => k, has: () => false },
    messages: { get: () => null },
  };
  global.canvas = undefined;
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.foundry = {
    ...(global.foundry ?? {}),
    utils: { ...(global.foundry?.utils ?? {}), getProperty: getPath, setProperty: setPath, deepClone: value => JSON.parse(JSON.stringify(value)) },
  };
});

describe('sweepActors', () => {
  test('the world\'s actors, plus unlinked tokens\' actors on the viewed and the active scene - each once', () => {
    const hero = makeActor('Hero');
    const base = makeActor('Putty');
    const viewedPutty = makeActor('Putty (token)', { world: false });
    const activePutty = makeActor('Putty (other scene)', { world: false });
    const placedOnly = makeActor('Putty (placeable)', { world: false });
    // The hero's linked token - its actor IS the world actor; a stand-in object with the same uuid doesn't count either.
    const heroAgain = { ...hero };
    const viewed = { tokens: [token(hero, true), token(heroAgain, true), token(viewedPutty, false), token(viewedPutty, false)] };
    global.canvas = { scene: viewed, tokens: { placeables: [placeable(viewedPutty, false), placeable(placedOnly, false), placeable(hero, true)] } };
    global.game.scenes.active = { tokens: [token(activePutty, false), token(base, true)] };

    expect(sweepActors()).toEqual([hero, base, viewedPutty, activePutty, placedOnly]);

    // The viewed scene being the active one: its tokens count once.
    global.game.scenes.active = viewed;
    expect(sweepActors()).toEqual([hero, base, viewedPutty, placedOnly]);
  });

  test('no canvas and no scenes: just the world\'s actors; a token without an actor is skipped', () => {
    const hero = makeActor('Hero');
    expect(sweepActors()).toEqual([hero]);
    global.game.scenes.active = { tokens: [token(null, false)] };
    expect(sweepActors()).toEqual([hero]);
  });
});

describe('world-sweep events reach unlinked tokens\' actors', () => {
  function sceneWith(...actors) {
    global.canvas = { scene: { tokens: actors.map(([actor, linked]) => token(actor, linked)) }, tokens: { placeables: actors.map(([actor, linked]) => placeable(actor, linked)) } };
  }

  test('sceneStart: a linked token\'s actor fires once, an unlinked token\'s synthetic actor fires too', async () => {
    const hero = makeActor('Hero', { rules: [COUNT('sceneStart')] });
    const base = makeActor('Zord', { rules: [COUNT('sceneStart')] });
    const synthetic = makeActor('Zord (token)', { world: false, rules: [COUNT('sceneStart')] });
    sceneWith([hero, true], [synthetic, false]);
    await runSceneAdvanced(4);
    expect([hero.system.count, base.system.count, synthetic.system.count]).toEqual([1, 1, 1]);
  });

  test('missionStart and sessionStart reach them the same way', async () => {
    const hero = makeActor('Hero', { rules: [COUNT('missionStart'), COUNT('sessionStart')] });
    const synthetic = makeActor('Putty (token)', { world: false, rules: [COUNT('missionStart'), COUNT('sessionStart')] });
    sceneWith([hero, true], [synthetic, false]);
    await runMissionAdvanced(8);
    expect([hero.system.count, synthetic.system.count]).toEqual([1, 1]);

    for (const fn of hooks.updateSetting ?? []) {
      await fn({ key: 'essence20.q2SessionEpoch' });
    }

    expect([hero.system.count, synthetic.system.count]).toEqual([2, 2]);
    // Another setting, or not the active GM: nothing.
    for (const fn of hooks.updateSetting ?? []) {
      await fn({ key: 'essence20.other' });
    }

    global.game.user.isActiveGM = false;
    for (const fn of hooks.updateSetting ?? []) {
      await fn({ key: 'essence20.q2SessionEpoch' });
    }

    expect([hero.system.count, synthetic.system.count]).toEqual([2, 2]);
  });

  test('turnStart stays the combatant\'s own (one actor, once)', async () => {
    const hero = makeActor('Hero', { rules: [COUNT('turnStart')] });
    const synthetic = makeActor('Putty (token)', { world: false, rules: [COUNT('turnStart')] });
    sceneWith([hero, true], [synthetic, false]);
    await runTurnStart(synthetic, null, {});
    expect([hero.system.count, synthetic.system.count]).toEqual([0, 1]);
  });

  test('scene Pools refill on an unlinked token\'s actor', async () => {
    const pool = { type: 'Pool', key: 'grit', max: 2, reset: 'scene' };
    expect(validateRule(pool)).toEqual([]);
    const synthetic = makeActor('Putty (token)', { world: false, rules: [pool], itemFlags: { rules: { pools: { grit: { value: 0 } } } } });
    sceneWith([synthetic, false]);
    await runSceneAdvanced(4);
    expect(synthetic.items.contents[0].flags.essence20.rules.pools.grit.value).toBe(2);
  });

  test('timed items run out on an unlinked token\'s actor', async () => {
    const synthetic = makeActor('Putty (token)', { world: false });
    synthetic.items.contents.push({ id: 'timed', name: 'Borrowed', type: 'gear', system: {}, flags: { essence20: { rulesExpiry: { until: 'scene', stamp: { epoch: 2 } } } } });
    sceneWith([synthetic, false]);
    await runSceneAdvanced(4);
    expect(synthetic.deleteEmbeddedDocuments).toHaveBeenCalledWith('Item', ['timed']);
    expect(synthetic.items.contents).toEqual([]);
  });

  test('fireTriggers on the synthetic actor itself still works (a combatant\'s turn)', async () => {
    const synthetic = makeActor('Putty (token)', { world: false, rules: [COUNT('sceneStart')] });
    await fireTriggers(synthetic, 'sceneStart');
    expect(synthetic.system.count).toBe(1);
  });
});

describe('roll:skillSpecialized', () => {
  const ask = (actor, rolledSkill) => evaluate(['roll:skillSpecialized'], contextFor({ self: actor, rolledSkill }));

  test('the rolled Skill\'s own isSpecialized flag on the roller', () => {
    const actor = makeActor('Twilight', { system: { skills: { spellcasting: { shift: 'd6', isSpecialized: true }, athletics: { shift: 'd6' } } } });
    expect(ask(actor, 'spellcasting')).toBe(true);
    expect(ask(actor, 'athletics')).toBe(false);
    expect(ask(actor, 'stealth')).toBe(false);
    expect(evaluate(['roll:skillSpecialized'], contextFor({ self: actor }))).toBe(null);
    expect(evaluate(['not:roll:skillSpecialized'], contextFor({ self: actor, rolledSkill: 'athletics' }))).toBe(true);
  });

  test('validates in a rule', () => {
    expect(validateRule({ type: 'RollModifier', upshift: 1, when: ['not:roll:skillSpecialized'] })).toEqual([]);
  });
});
