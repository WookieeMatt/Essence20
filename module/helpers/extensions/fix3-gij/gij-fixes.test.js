import { jest } from '@jest/globals';
import { angrySources, packAttackSources } from './gij-fixes.mjs';

const ANGRY = 'Compendium.essence20.cobra_codex.Item.wGMyGbySdNSgPs8B';

const item = (type, uuid, name, useStats = false) => ({
  type, name, flags: useStats ? {} : { core: { sourceId: uuid } }, _stats: useStats ? { compendiumSource: uuid } : {},
});

function makeActor({ id = 'a1', items = [], flags = {} } = {}) {
  return {
    id, uuid: `Actor.${id}`, items,
    getFlag: jest.fn((scope, key) => flags[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flags[key] = value;
    }),
  };
}

beforeEach(() => {
  // No settings registered, so the scene clock reads its default epoch of 1.
  global.game = { i18n: { has: () => false, localize: key => key }, combat: null };
});

describe("Angry", () => {
  const snagOn = skill => ({ angryHangUpSnag: { epoch: 1, window: 'scene', count: 1, skill } });

  test("Snags every roll of the chosen Skill this scene, labelled with the Hang-Up", () => {
    const actor = makeActor({ items: [item('hangUp', ANGRY, 'Angry')], flags: snagOn('deception') });
    expect(angrySources(actor, { rolledSkill: 'deception' })).toEqual([{ id: 'fix3Angry', label: 'Angry', snag: true }]);
    // Not used up - the second roll gets it too.
    expect(angrySources(actor, { rolledSkill: 'deception' })).toHaveLength(1);
  });

  test("not on another Skill, after the scene changed, or without the Hang-Up", () => {
    expect(angrySources(makeActor({ items: [item('hangUp', ANGRY, 'Angry')], flags: snagOn('deception') }), { rolledSkill: 'culture' })).toEqual([]);
    const stale = { angryHangUpSnag: { epoch: 0, window: 'scene', count: 1, skill: 'deception' } };
    expect(angrySources(makeActor({ items: [item('hangUp', ANGRY, 'Angry')], flags: stale }), { rolledSkill: 'deception' })).toEqual([]);
    expect(angrySources(makeActor({ flags: snagOn('deception') }), { rolledSkill: 'deception' })).toEqual([]);
  });
});

describe("Pack Attack", () => {
  test("↑1 on every attack against the Growled target while the grant runs", () => {
    const ally = makeActor({ flags: { packAttackGrowl: { targetId: 'enemy1', label: 'Pack Attack', sceneEpoch: 1 } } });
    expect(packAttackSources(ally, { id: 'enemy1' }, { isAttack: true }))
      .toEqual([{ id: 'fix3PackAttack', label: 'Pack Attack', shiftUp: 1 }]);
    expect(packAttackSources(ally, { id: 'enemy1' }, { isAttack: false })).toEqual([]);
    expect(packAttackSources(ally, { id: 'other' }, { isAttack: true })).toEqual([]);
  });
});
