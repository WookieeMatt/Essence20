import { jest } from '@jest/globals';
import { packAttackSources } from './gij-fixes.mjs';

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

describe("Pack Attack", () => {
  test("↑1 on every attack against the Growled target while the grant runs", () => {
    const ally = makeActor({ flags: { packAttackGrowl: { targetId: 'enemy1', label: 'Pack Attack', sceneEpoch: 1 } } });
    expect(packAttackSources(ally, { id: 'enemy1' }, { isAttack: true }))
      .toEqual([{ id: 'fix3PackAttack', label: 'Pack Attack', shiftUp: 1 }]);
    expect(packAttackSources(ally, { id: 'enemy1' }, { isAttack: false })).toEqual([]);
    expect(packAttackSources(ally, { id: 'other' }, { isAttack: true })).toEqual([]);
  });
});
