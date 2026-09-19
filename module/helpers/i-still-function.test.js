import { jest } from '@jest/globals';
import { activateIStillFunction, canUseIStillFunction } from './i-still-function.mjs';

function makeActor({ defeated = true, usedFlag = undefined, conditioningShift = 'd8' } = {}) {
  const flagStore = { iStillFunctionUsedThisEncounter: usedFlag };
  return {
    statuses: new Set(defeated ? ['defeated'] : []),
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
    update: jest.fn(),
    toggleStatusEffect: jest.fn(),
    system: {
      skills: {
        conditioning: { shift: conditioningShift, isSpecialized: false },
      },
    },
  };
}

// getSkillRanks (helpers/combat.mjs) reads E20.skillShiftList.indexOf('d20') - indexOf(shift),
// floored at 0 - 'd8' sits 3 shifts below the untrained d20, matching the tests below.
function mockStoryPoints({ gmConnected = true, available = true } = {}) {
  global.game.users = gmConnected ? [{ isGM: true, active: true }] : [{ isGM: true, active: false }];
  global.game.settings.get = jest.fn((scope, key) => (key === 'sptStoryPoints' ? (available ? 3 : 0) : 0));
}

beforeEach(() => {
  global.game.combat = { id: 'combat1', round: 1, turn: 0 };
  global.game.socket = { emit: jest.fn() };
  mockStoryPoints();
});

describe("canUseIStillFunction", () => {
  test("true while Defeated, not yet used this combat, a GM is connected, and a Story Point is available", () => {
    expect(canUseIStillFunction(makeActor({ defeated: true }))).toBe(true);
  });

  test("false when not Defeated", () => {
    expect(canUseIStillFunction(makeActor({ defeated: false }))).toBe(false);
  });

  test("false once already used this combat", () => {
    const actor = makeActor({ defeated: true, usedFlag: { epoch: 1, window: 'encounter', count: 1 } });
    expect(canUseIStillFunction(actor)).toBe(false);
  });

  test("false when no GM is connected", () => {
    mockStoryPoints({ gmConnected: false });
    expect(canUseIStillFunction(makeActor({ defeated: true }))).toBe(false);
  });

  test("false when no Story Point is available", () => {
    mockStoryPoints({ available: false });
    expect(canUseIStillFunction(makeActor({ defeated: true }))).toBe(false);
  });
});

describe("activateIStillFunction", () => {
  function mockRoll(total) {
    global.Roll = jest.fn().mockImplementation(() => ({
      evaluate: jest.fn().mockResolvedValue({ total }),
    }));
  }

  test("on a roll <= Conditioning Skill Ranks, regains that much Health and clears Defeated", async () => {
    // conditioningShift 'd12' (the best a skill can be trained to) yields the maximum trainable
    // Skill Ranks, comfortably >= any 1d6 result, so this exercises the success path deterministically.
    mockRoll(4);
    const actor = makeActor({ defeated: true, conditioningShift: 'd12' });

    await activateIStillFunction(actor);

    expect(global.game.socket.emit).toHaveBeenCalledWith("system.essence20", expect.objectContaining({
      action: "spendStoryPoints", amount: 1,
    }));
    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 4 });
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('defeated', { active: false });
  });

  test("on a roll > Conditioning Skill Ranks, stays Defeated and doesn't heal", async () => {
    // conditioningShift 'd20' (untrained) yields 0 Skill Ranks - any positive 1d6 result fails.
    mockRoll(4);
    const actor = makeActor({ defeated: true, conditioningShift: 'd20' });

    await activateIStillFunction(actor);

    expect(actor.update).not.toHaveBeenCalled();
    expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
  });

  test("marks this combat used either way, since the once-per-scene cap is on the attempt", async () => {
    mockRoll(6);
    const actor = makeActor({ defeated: true, conditioningShift: 'd20' });

    await activateIStillFunction(actor);

    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'iStillFunctionUsedThisEncounter', expect.objectContaining({ epoch: 1, window: 'encounter', count: 1 }),
    );
  });

  test("spends the Story Point even if the roll ultimately fails", async () => {
    mockRoll(6);
    const actor = makeActor({ defeated: true, conditioningShift: 'd20' });

    await activateIStillFunction(actor);

    expect(global.game.socket.emit).toHaveBeenCalledWith("system.essence20", expect.objectContaining({
      action: "spendStoryPoints", amount: 1,
    }));
  });
});
