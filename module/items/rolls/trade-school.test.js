import { jest } from '@jest/globals';
import { activateTradeSchool, canUseTradeSchool, consumeTradeSchool } from './trade-school.mjs';

global.game = {
  combat: { id: 'combat1', round: 1 },
  actors: { get: jest.fn(() => undefined) },
};

const TECHNICAL_MASTERY_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.QKlXoVgNMq7Kv58L";

function makeActor({ id = 'actor1', flags = {} } = {}) {
  return {
    id,
    getFlag: jest.fn((scope, key) => flags[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flags[key] = value; 
    }),
    unsetFlag: jest.fn(async (scope, key) => {
      delete flags[key]; 
    }),
  };
}

describe("canUseTradeSchool", () => {
  test("true when not yet used this scene", () => {
    expect(canUseTradeSchool(makeActor())).toBe(true);
  });

  test("false once used this scene", () => {
    const actor = makeActor({ flags: { tradeSchoolUsedThisEncounter: { epoch: 1, window: 'encounter', count: 1 } } });
    expect(canUseTradeSchool(actor)).toBe(false);
  });
});

describe("activateTradeSchool", () => {
  test("banks the granter's id on the target ally and marks the scene used", async () => {
    const actor = makeActor({ id: 'officer1' });
    const targetActor = makeActor({ id: 'ally1' });

    await activateTradeSchool(actor, targetActor);

    expect(targetActor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingTradeSchool', expect.objectContaining({ granterId: 'officer1' }),
    );
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'tradeSchoolUsedThisEncounter', expect.any(Object),
    );
  });
});

describe("consumeTradeSchool", () => {
  test("returns isSpecialized and clears the flag when a grant is pending", async () => {
    const actor = makeActor({ flags: { pendingTradeSchool: { granterId: 'officer1', combatId: 'combat1', round: 1 } } });

    const result = await consumeTradeSchool(actor);

    expect(result).toEqual({ isSpecialized: true, canCritD2: false });
    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'pendingTradeSchool');
  });

  test("also returns canCritD2 when the original granter holds Technical Mastery", async () => {
    const actor = makeActor({ flags: { pendingTradeSchool: { granterId: 'officer1', combatId: 'combat1', round: 1 } } });
    const granter = { items: [{ type: 'perk', flags: { core: { sourceId: TECHNICAL_MASTERY_ID } } }] };
    game.actors.get.mockReturnValue(granter);

    const result = await consumeTradeSchool(actor);

    expect(result).toEqual({ isSpecialized: true, canCritD2: true });
    game.actors.get.mockReturnValue(undefined);
  });

  test("returns both false when nothing is pending", async () => {
    const actor = makeActor();

    const result = await consumeTradeSchool(actor);

    expect(result).toEqual({ isSpecialized: false, canCritD2: false });
    expect(actor.unsetFlag).not.toHaveBeenCalled();
  });
});
