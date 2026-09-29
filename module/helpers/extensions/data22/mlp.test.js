import { jest } from '@jest/globals';
import { MLP22, mlpPostRoll, mlpRollSources, setOffSmokeScreen, tokensWithin } from './mlp.mjs';
import { findExtUse } from '../../extensions.mjs';

let scene = 1;

function makeActor(uuids = [], flags = {}) {
  const actor = {
    id: 'a1', uuid: 'Actor.a1', name: 'Rarity',
    flags: { essence20: { ...flags } },
    items: { contents: uuids.map((u, i) => ({ id: `i${i}`, name: `Item ${i}`, flags: { core: { sourceId: u } } })) },
  };
  actor.setFlag = jest.fn(async (scope, key, value) => {
    actor.flags[scope][key] = value;
  });
  return actor;
}

const creature = id => ({ id, token: null, name: id });

beforeEach(() => {
  scene = 1;
  global.game = {
    i18n: { localize: k => k, format: k => k },
    settings: { get: () => scene },
    user: { targets: new Set() },
  };
  global.CONFIG = { E20: { skillToEssence: { deception: 'social', persuasion: 'social', might: 'strength' } } };
});

test('Fresh Mark: Edge on the first Deception against a creature, not after', async () => {
  const actor = makeActor([MLP22.freshMark]);
  const target = creature('t1');
  expect(mlpRollSources(actor, target, { rolledSkill: 'deception' }).sources[0]).toMatchObject({ id: 'd22FreshMark', edge: true });
  expect(mlpRollSources(actor, target, { rolledSkill: 'persuasion' }).sources).toEqual([]);

  await mlpPostRoll(actor, [], { riderContext: { skill: 'deception' } }, { hits: [{ target }] });
  expect(actor.flags.essence20.d22Deceived).toEqual(['t1']);
  expect(mlpRollSources(actor, target, { rolledSkill: 'deception' }).sources).toEqual([]);
  expect(mlpRollSources(actor, creature('t2'), { rolledSkill: 'deception' }).sources).toHaveLength(1);
  expect(mlpRollSources(actor, null, { rolledSkill: 'deception' }).sources).toEqual([]);
});

test('Natural Style: ↑1 on social tests with a new acquaintance for that scene only', async () => {
  const actor = makeActor([MLP22.naturalStyle]);
  const target = creature('t1');
  expect(mlpRollSources(actor, target, { rolledSkill: 'persuasion' }).sources[0]).toMatchObject({ shiftUp: 1 });
  expect(mlpRollSources(actor, target, { rolledSkill: 'might' }).sources).toEqual([]);

  await mlpPostRoll(actor, [], { riderContext: { skill: 'persuasion' } }, { hits: [{ target }] });
  expect(actor.flags.essence20.d22Met).toEqual({ t1: 1 });
  // Still the same scene: still ↑1.
  expect(mlpRollSources(actor, target, { rolledSkill: 'deception' }).sources[0].shiftUp).toBe(1);
  scene = 2;
  expect(mlpRollSources(actor, target, { rolledSkill: 'persuasion' }).sources).toEqual([]);
  // A second roll in a later scene doesn't restamp the first meeting.
  await mlpPostRoll(actor, [], { riderContext: { skill: 'persuasion' } }, { hits: [{ target }] });
  expect(actor.flags.essence20.d22Met).toEqual({ t1: 1 });
});

test('perks not held do nothing, and postRoll ignores rolls with no targets', async () => {
  const actor = makeActor([]);
  expect(mlpRollSources(actor, creature('t'), { rolledSkill: 'deception' }).sources).toEqual([]);
  await mlpPostRoll(actor, [], { riderContext: { skill: 'deception' } }, { hits: [] });
  await mlpPostRoll(makeActor([MLP22.freshMark]), [], {}, { hits: [{ target: creature('t') }] });
  expect(actor.setFlag).not.toHaveBeenCalled();
});

test('Smoke Screen blinds everyone within 20 feet and is used up', async () => {
  const near = { name: 'Near', center: { x: 10 }, actor: { name: 'Near' }, setTarget: jest.fn() };
  const far = { name: 'Far', center: { x: 50 }, actor: { name: 'Far' }, setTarget: jest.fn() };
  global.canvas = {
    tokens: { placeables: [near, far] },
    grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) },
    stage: null,
  };
  expect(tokensWithin({ x: 0 }, 20)).toEqual([near]);

  const item = { name: 'Smoke Screen', parent: makeActor(), system: { quantity: 1 }, flags: { core: { sourceId: MLP22.smokeScreen } }, update: jest.fn() };
  expect(findExtUse(item)?.id).toBe('d22SmokeScreen');
  expect(findExtUse(item).canUse(item)).toBe(true);
  expect(findExtUse({ ...item, system: { quantity: 0 } }).canUse({ system: { quantity: 0 } })).toBe(false);

  // Blocked action: nothing happens.
  expect(await setOffSmokeScreen(item, null, async () => false)).toBeNull();
  // No canvas stage: the point pick resolves null and nothing is spent.
  expect(await setOffSmokeScreen(item, null, async () => true)).toBeNull();
  expect(item.update).not.toHaveBeenCalled();
});

test('Smoke Screen, set off at a clicked point', async () => {
  const near = { name: 'Near', center: { x: 10 }, actor: { name: 'Near', toggleStatusEffect: jest.fn(), effects: [] }, setTarget: jest.fn() };
  global.ui = { notifications: { info: jest.fn() } };
  global.document = { addEventListener: jest.fn(), removeEventListener: jest.fn() };
  global.canvas = {
    tokens: { placeables: [near] },
    grid: { measurePath: ([a, b]) => ({ distance: Math.abs(a.x - b.x) }) },
    stage: { on: (event, fn) => fn({ getLocalPosition: () => ({ x: 0 }) }), off: jest.fn() },
  };
  game.combat = null;
  const item = { name: 'Smoke Screen', parent: makeActor(), system: { quantity: 2 }, update: jest.fn() };
  const message = await setOffSmokeScreen(item, null, async () => true);
  expect(message).toBe('E20.D22SmokeScreenUsed');
  expect(near.actor.toggleStatusEffect).toHaveBeenCalledWith('blinded', { active: true });
  expect(near.setTarget).toHaveBeenCalled();
  expect(item.update).toHaveBeenCalledWith({ 'system.quantity': 1 });
});
