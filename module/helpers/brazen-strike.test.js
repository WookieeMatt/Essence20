import { jest } from '@jest/globals';
import { applyBrazenStrike } from './brazen-strike.mjs';

function makeActor(statuses = []) {
  return {
    statuses: new Set(statuses),
    toggleStatusEffect: jest.fn(async (condition) => {
      actor.statuses.delete(condition);
    }),
  };
}
let actor;

describe("applyBrazenStrike", () => {
  test("removes both Frightened and Mesmerized when present", async () => {
    actor = makeActor(['frightened', 'mesmerized']);

    await applyBrazenStrike(actor);

    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('frightened', { active: false });
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('mesmerized', { active: false });
  });

  test("only removes whichever of the two is actually present", async () => {
    actor = makeActor(['frightened']);

    await applyBrazenStrike(actor);

    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('frightened', { active: false });
    expect(actor.toggleStatusEffect).not.toHaveBeenCalledWith('mesmerized', expect.anything());
  });

  test("does nothing with neither condition present", async () => {
    actor = makeActor([]);

    await applyBrazenStrike(actor);

    expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
  });

  test("doesn't touch an unrelated condition", async () => {
    actor = makeActor(['prone']);

    await applyBrazenStrike(actor);

    expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
  });
});
