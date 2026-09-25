import { jest } from '@jest/globals';
import { getStandByMeDefenseBonus, STAND_BY_ME_ID } from './stand-by-me.mjs';

function makeActor({ id, disposition = 1, perkIds = [] } = {}) {
  const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
  const token = { document: { disposition }, center: { distance: 0 } };
  return {
    id, name: id, items,
    getActiveTokens: jest.fn(() => [token]),
  };
}

function setScene(targetActor, allyActors, { targetDistance = {} } = {}) {
  const targetToken = targetActor.getActiveTokens()[0];
  targetToken.actor = targetActor;
  const allyTokens = allyActors.map(actor => {
    const token = actor.getActiveTokens()[0];
    const distance = targetDistance[actor.id] ?? 0;
    token.center = { distance };
    token.actor = actor;
    targetToken.center = { distance };
    return token;
  });

  global.canvas = {
    tokens: { placeables: [targetToken, ...allyTokens] },
    grid: { measurePath: jest.fn(([otherCenter]) => ({ distance: otherCenter.distance ?? 0 })) },
  };
}

describe("getStandByMeDefenseBonus", () => {
  test("+1 with an adjacent ally holding the Perk", () => {
    const target = makeActor({ id: 'target' });
    const ally = makeActor({ id: 'ally', perkIds: [STAND_BY_ME_ID] });
    setScene(target, [ally], { targetDistance: { ally: 5 } });

    expect(getStandByMeDefenseBonus(target)).toBe(1);
  });

  test("0 without an adjacent ally holding the Perk", () => {
    const target = makeActor({ id: 'target' });
    const ally = makeActor({ id: 'ally' });
    setScene(target, [ally], { targetDistance: { ally: 5 } });

    expect(getStandByMeDefenseBonus(target)).toBe(0);
  });

  test("0 when the Perk holder isn't adjacent", () => {
    const target = makeActor({ id: 'target' });
    const ally = makeActor({ id: 'ally', perkIds: [STAND_BY_ME_ID] });
    setScene(target, [ally], { targetDistance: { ally: 15 } });

    expect(getStandByMeDefenseBonus(target)).toBe(0);
  });
});
