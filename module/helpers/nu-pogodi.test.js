import { jest } from '@jest/globals';
import { applyNuPogodiCondition, canUseNuPogodiCondition } from './nu-pogodi.mjs';

global.game = { i18n: { localize: (k) => k }, combat: null };
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };

function makeActor(statuses = []) {
  const flagStore = {};
  return {
    statuses: new Set(statuses),
    toggleStatusEffect: jest.fn(),
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("canUseNuPogodiCondition", () => {
  test("true when not yet used this encounter", () => {
    game.combat = { id: 'combat1' };
    expect(canUseNuPogodiCondition(makeActor())).toBe(true);
    game.combat = null;
  });

  test("false once already used this encounter", async () => {
    game.combat = { id: 'combat1' };
    const actor = makeActor();
    await actor.setFlag('essence20', 'nuPogodiConditionUsedThisEncounter', { combatId: 'combat1' });
    expect(canUseNuPogodiCondition(actor)).toBe(false);
    game.combat = null;
  });
});

describe("applyNuPogodiCondition", () => {
  beforeEach(() => {
    foundry.applications.api.DialogV2.wait.mockReset();
    game.combat = { id: 'combat1' };
  });

  afterEach(() => {
    game.combat = null;
  });

  test("removes the chosen Condition (excluding Defeated) and marks the encounter used", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('frightened');
    const actor = makeActor(['frightened', 'defeated']);

    const removed = await applyNuPogodiCondition(actor);

    expect(removed).toBe('frightened');
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('frightened', { active: false });
    expect(canUseNuPogodiCondition(actor)).toBe(false);
  });

  test("does nothing once already used this encounter", async () => {
    const actor = makeActor(['frightened']);
    await actor.setFlag('essence20', 'nuPogodiConditionUsedThisEncounter', { combatId: 'combat1' });

    const removed = await applyNuPogodiCondition(actor);

    expect(removed).toBeNull();
    expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
  });

  test("returns null and removes nothing when cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeActor(['frightened']);

    const removed = await applyNuPogodiCondition(actor);

    expect(removed).toBeNull();
    expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
  });
});
