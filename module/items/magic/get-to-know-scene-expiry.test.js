import { jest } from '@jest/globals';
import { getToKnowSceneAdvanced } from './get-to-know-scene-expiry.mjs';

function makeActor({ id = 'a1', flags = {} } = {}) {
  const actor = {
    id, uuid: `Actor.${id}`, type: 'playerCharacter', items: [], system: {}, flags: { essence20: { ...flags } },
    unsetFlag: jest.fn(async (scope, key) => {
      delete actor.flags.essence20[key];
    }),
  };
  return actor;
}

beforeEach(() => {
  global.game = { actors: [], user: { targets: new Set() }, combat: null, i18n: { has: () => false } };
});

describe("Get To Know", () => {
  test("an unspent Edge goes when a new scene starts", async () => {
    const caster = makeActor({ flags: { pendingGetToKnowEdge: { skill: 'insight', targetId: 'x' } } });
    game.actors = [caster, makeActor({ id: 'other' })];
    await getToKnowSceneAdvanced();
    expect(caster.unsetFlag).toHaveBeenCalledWith('essence20', 'pendingGetToKnowEdge');
    expect(caster.flags.essence20.pendingGetToKnowEdge).toBeUndefined();
  });
});
