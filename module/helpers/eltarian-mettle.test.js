import { jest } from '@jest/globals';
import { applyEltarianMettle, pickEltarianMettleCondition } from './eltarian-mettle.mjs';

global.game = { i18n: { localize: (k) => k } };
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };

function makeActor(statuses = []) {
  return { statuses: new Set(statuses), toggleStatusEffect: jest.fn() };
}

describe("pickEltarianMettleCondition", () => {
  beforeEach(() => foundry.applications.api.DialogV2.wait.mockReset());

  test("returns null when the actor has no active Conditions at all", async () => {
    const actor = makeActor([]);
    expect(await pickEltarianMettleCondition(actor)).toBeNull();
    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });

  test("excludes Defeated from the offered options - no dialog if it's the only status", async () => {
    const actor = makeActor(['defeated']);
    expect(await pickEltarianMettleCondition(actor)).toBeNull();
    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });

  test("prompts and returns the chosen Condition when at least one is active", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('frightened');
    const actor = makeActor(['frightened', 'defeated']);

    expect(await pickEltarianMettleCondition(actor)).toBe('frightened');
    expect(foundry.applications.api.DialogV2.wait).toHaveBeenCalled();
  });

  test("returns null when cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeActor(['frightened']);
    expect(await pickEltarianMettleCondition(actor)).toBeNull();
  });
});

describe("applyEltarianMettle", () => {
  beforeEach(() => foundry.applications.api.DialogV2.wait.mockReset());

  test("removes the chosen Condition", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('frightened');
    const actor = makeActor(['frightened']);

    const removed = await applyEltarianMettle(actor);

    expect(removed).toBe('frightened');
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('frightened', { active: false });
  });

  test("returns null and removes nothing with no active Conditions", async () => {
    const actor = makeActor([]);
    const removed = await applyEltarianMettle(actor);
    expect(removed).toBeNull();
    expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
  });

  test("returns null and removes nothing when cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeActor(['frightened']);

    const removed = await applyEltarianMettle(actor);

    expect(removed).toBeNull();
    expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
  });
});
