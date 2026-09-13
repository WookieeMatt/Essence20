import { jest } from '@jest/globals';
import { activateRevYourEngines, PENDING_REV_YOUR_ENGINES_FLAG_KEY } from './rev-your-engines.mjs';

global.game = { combat: null };

function makeActor() {
  const flagStore = {};
  return {
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value; 
    }),
    getFlag: jest.fn((scope, key) => flagStore[key]),
  };
}

describe("activateRevYourEngines", () => {
  test("banks a shiftUp equal to the amount spent", async () => {
    const actor = makeActor();

    await activateRevYourEngines(actor, 3);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', PENDING_REV_YOUR_ENGINES_FLAG_KEY, expect.objectContaining({ shiftUp: 3 }));
  });

  test("does nothing when nothing was spent", async () => {
    const actor = makeActor();

    await activateRevYourEngines(actor, 0);

    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});
