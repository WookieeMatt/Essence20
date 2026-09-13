import { jest } from '@jest/globals';
import { activateGridPowerStrike, PENDING_GRID_POWER_STRIKE_FLAG_KEY } from './grid-power-strike.mjs';

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

describe("activateGridPowerStrike", () => {
  test("banks the spent amount as a pending damage bonus", async () => {
    const actor = makeActor();

    await activateGridPowerStrike(actor, 3);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', PENDING_GRID_POWER_STRIKE_FLAG_KEY, expect.objectContaining({ damageBonus: 3 }));
  });

  test("does nothing when nothing was spent", async () => {
    const actor = makeActor();

    await activateGridPowerStrike(actor, 0);

    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});
