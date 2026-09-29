import { jest } from '@jest/globals';
import { dataLinkEvasion, dataLinkTurnEnd, dataLinkTurnStart, GEAR22, transmetalMovement } from './gear.mjs';

function makeActor(uuids = [], extra = {}) {
  const actor = {
    uuid: extra.uuid ?? 'Actor.o', type: extra.type ?? 'character', flags: { essence20: { ...(extra.flags ?? {}) } },
    system: extra.system ?? {},
    items: { contents: uuids.map(u => ({ flags: { core: { sourceId: u } }, system: extra.itemSystem ?? {} })) },
  };
  actor.setFlag = jest.fn(async (scope, key, value) => {
    actor.flags[scope][key] = value;
  });
  actor.unsetFlag = jest.fn(async (scope, key) => {
    delete actor.flags[scope][key];
  });
  return actor;
}

beforeEach(() => {
  global.game = { i18n: { localize: k => k, format: k => k }, actors: [], combat: { id: 'c1', round: 2 } };
});

test('Data-Link: an idle drone gives the owner +1 Evasion until their next turn', async () => {
  const owner = makeActor();
  const drone = makeActor([GEAR22.dataLink], { uuid: 'Actor.d', type: 'companion', system: { type: 'drone' }, flags: { companionOf: 'Actor.o' } });
  game.actors = [owner, drone];
  await dataLinkTurnEnd(owner, game.combat);
  expect(dataLinkEvasion(owner, 'evasion')).toBe(1);
  expect(dataLinkEvasion(owner, 'toughness')).toBe(0);
  await dataLinkTurnStart(owner);
  expect(dataLinkEvasion(owner, 'evasion')).toBe(0);

  // Commanded this round: no warning.
  drone.flags.essence20.petCommand = { combatId: 'c1', round: 2 };
  owner.setFlag.mockClear();
  await dataLinkTurnEnd(owner, game.combat);
  expect(owner.setFlag).not.toHaveBeenCalled();
  await dataLinkTurnEnd(owner, null);
});

test('no Data-Link, no bonus', async () => {
  const owner = makeActor();
  game.actors = [owner, makeActor([], { uuid: 'Actor.d', type: 'companion', system: { type: 'drone' }, flags: { companionOf: 'Actor.o' } })];
  await dataLinkTurnEnd(owner, game.combat);
  expect(owner.setFlag).not.toHaveBeenCalled();
});

test('Transmetal: a new Alt Mode movement of 40 feet, or +20 to one of several', () => {
  const movement = () => ({ ground: { altMode: 30, total: 30 }, aerial: { altMode: 0, total: 0 }, swim: { altMode: 0, total: 0 } });
  const bot = makeActor([GEAR22.transmetal], { system: { isTransformed: true, movement: movement() }, itemSystem: { choice: 'aerial' } });
  expect(transmetalMovement(bot)).toBe(40);
  expect(bot.system.movement.aerial.total).toBe(40);

  const multi = makeActor([GEAR22.transmetal], { system: { isTransformed: true, movement: { ...movement(), aerial: { altMode: 20, total: 20 } } }, itemSystem: { choice: 'aerial' } });
  expect(transmetalMovement(multi)).toBe(20);
  expect(multi.system.movement.aerial.total).toBe(40);

  const botMode = makeActor([GEAR22.transmetal], { system: { isTransformed: false, movement: movement() }, itemSystem: { choice: 'aerial' } });
  expect(transmetalMovement(botMode)).toBe(0);
  expect(transmetalMovement(makeActor([], { system: { isTransformed: true, movement: movement() } }))).toBe(0);
});
