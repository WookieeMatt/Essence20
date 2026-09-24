import { jest } from '@jest/globals';
import { applyBalanceAndHarmony, canUseBalanceAndHarmony, pickBalanceAndHarmonyCondition } from './balance-and-harmony.mjs';

global.game = { i18n: { localize: (k) => k }, scenes: { current: { id: 'scene1' } } };
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

describe("canUseBalanceAndHarmony", () => {
  test("true when not yet used this scene", () => {
    expect(canUseBalanceAndHarmony(makeActor())).toBe(true);
  });

  test("false once already used this scene", async () => {
    const actor = makeActor();
    await actor.setFlag('essence20', 'balanceAndHarmonyUsesThisScene', { epoch: 1, window: 'scene', count: 1 });
    expect(canUseBalanceAndHarmony(actor)).toBe(false);
  });
});

describe("pickBalanceAndHarmonyCondition", () => {
  beforeEach(() => foundry.applications.api.DialogV2.wait.mockReset());

  test("returns null when the actor has no active Conditions at all", async () => {
    expect(await pickBalanceAndHarmonyCondition(makeActor([]))).toBeNull();
    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });

  test("excludes Defeated and Unconscious from the offered options", async () => {
    expect(await pickBalanceAndHarmonyCondition(makeActor(['defeated', 'unconscious']))).toBeNull();
    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });

  test("prompts and returns the chosen Condition when at least one qualifies", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('frightened');
    const actor = makeActor(['frightened', 'defeated', 'unconscious']);

    expect(await pickBalanceAndHarmonyCondition(actor)).toBe('frightened');
  });
});

describe("applyBalanceAndHarmony", () => {
  beforeEach(() => foundry.applications.api.DialogV2.wait.mockReset());

  test("removes the chosen Condition and marks the scene used", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('frightened');
    const actor = makeActor(['frightened']);

    const removed = await applyBalanceAndHarmony(actor);

    expect(removed).toBe('frightened');
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('frightened', { active: false });
    expect(canUseBalanceAndHarmony(actor)).toBe(false);
  });

  test("does nothing once already used this scene", async () => {
    const actor = makeActor(['frightened']);
    await actor.setFlag('essence20', 'balanceAndHarmonyUsesThisScene', { epoch: 1, window: 'scene', count: 1 });

    const removed = await applyBalanceAndHarmony(actor);

    expect(removed).toBeNull();
    expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
  });

  test("returns null and removes nothing when cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeActor(['frightened']);

    const removed = await applyBalanceAndHarmony(actor);

    expect(removed).toBeNull();
    expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
  });
});
