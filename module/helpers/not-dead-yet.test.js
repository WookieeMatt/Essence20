import { jest } from '@jest/globals';
import { activateNotDeadYet, canUseNotDeadYet } from './not-dead-yet.mjs';

const CSTO_PERSONNEL_ID = "Compendium.essence20.intercontinental_adventures.Item.3u2UV58RvzyoId4Q";

function makeActor({ id, disposition = 1, health = 5, healthBonus = 0, originIds = [], usedFlags = {} } = {}) {
  const items = originIds.map(originId => ({ type: 'origin', flags: { core: { sourceId: originId } } }));
  const token = { document: { disposition }, center: { distance: 0 } };

  return {
    id,
    system: { health: { value: health, bonus: healthBonus } },
    items,
    getActiveTokens: jest.fn(() => [token]),
    getFlag: jest.fn((scope, key) => (scope == 'essence20' ? usedFlags[key] : undefined)),
    setFlag: jest.fn(async (scope, key, value) => {
      usedFlags[key] = value;
    }),
    update: jest.fn(),
  };
}

function setScene(actor, allies, { distances = {} } = {}) {
  const actorToken = actor.getActiveTokens()[0];
  actorToken.actor = actor;
  const allyTokens = allies.map(ally => {
    const token = ally.getActiveTokens()[0];
    const distance = distances[ally.id] ?? 0;
    token.center = { distance };
    token.actor = ally;
    actorToken.center = { distance };
    return token;
  });

  global.canvas = {
    tokens: { placeables: [actorToken, ...allyTokens] },
    grid: { measurePath: jest.fn(([otherCenter]) => ({ distance: otherCenter.distance ?? 0 })) },
  };
}

describe("canUseNotDeadYet / activateNotDeadYet", () => {
  beforeEach(() => {
    global.game = { scenes: { current: { id: 'scene1' } }, combat: null };
  });

  test("grants 1 temporary Health with no nearby CSTO Personnel ally", async () => {
    const actor = makeActor({ id: 'actor1', health: 5, healthBonus: 0 });
    setScene(actor, []);

    expect(canUseNotDeadYet(actor)).toBe(true);
    const activated = await activateNotDeadYet(actor);

    expect(activated).toBe(true);
    expect(actor.update).toHaveBeenCalledWith({ 'system.health.bonus': 1, 'system.health.value': 6 });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'notDeadYetUsedThisScene', expect.objectContaining({ epoch: 1, count: 1 }),
    );
  });

  test("grants 2 temporary Health with a nearby CSTO Personnel ally, and marks the encounter use", async () => {
    global.game.combat = { id: 'combat1' };
    const actor = makeActor({ id: 'actor1', health: 5, healthBonus: 0 });
    const ally = makeActor({ id: 'ally1', originIds: [CSTO_PERSONNEL_ID] });
    setScene(actor, [ally], { distances: { ally1: 30 } });

    const activated = await activateNotDeadYet(actor);

    expect(activated).toBe(true);
    expect(actor.update).toHaveBeenCalledWith({ 'system.health.bonus': 2, 'system.health.value': 7 });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'notDeadYetEnhancedUsedThisEncounter', expect.anything(),
    );
  });

  test("grants only 1 Health when the enhanced upgrade was already used this encounter, even with a nearby ally", async () => {
    global.game.combat = { id: 'combat1' };
    const usedFlags = { notDeadYetEnhancedUsedThisEncounter: { epoch: 1, window: 'encounter', count: 1 } };
    const actor = makeActor({ id: 'actor1', health: 5, usedFlags });
    const ally = makeActor({ id: 'ally1', originIds: [CSTO_PERSONNEL_ID] });
    setScene(actor, [ally], { distances: { ally1: 30 } });

    const activated = await activateNotDeadYet(actor);

    expect(activated).toBe(true);
    expect(actor.update).toHaveBeenCalledWith({ 'system.health.bonus': 1, 'system.health.value': 6 });
  });

  test("ignores an ally without the CSTO Personnel Origin", async () => {
    const actor = makeActor({ id: 'actor1', health: 5 });
    const ally = makeActor({ id: 'ally1', originIds: ['Compendium.essence20.gi_joe_crb.Item.someOtherOrigin'] });
    setScene(actor, [ally], { distances: { ally1: 30 } });

    await activateNotDeadYet(actor);

    expect(actor.update).toHaveBeenCalledWith({ 'system.health.bonus': 1, 'system.health.value': 6 });
  });

  test("returns false and grants nothing once already used this scene", async () => {
    const usedFlags = { notDeadYetUsedThisScene: { epoch: 1, window: 'scene', count: 1 } };
    const actor = makeActor({ id: 'actor1', usedFlags });
    setScene(actor, []);

    expect(canUseNotDeadYet(actor)).toBe(false);
    const activated = await activateNotDeadYet(actor);

    expect(activated).toBe(false);
    expect(actor.update).not.toHaveBeenCalled();
  });
});
