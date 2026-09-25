import { jest } from '@jest/globals';
import { activateChargeItUp, consumeChargeItUp, hasPendingChargeItUp, PENDING_CHARGE_IT_UP_FLAG } from './charge-it-up.mjs';

function makeActor({ isMorphed = true, pending = null } = {}) {
  const flags = { pending };
  return {
    system: { isMorphed },
    setFlag: jest.fn((scope, key, data) => {
      flags[key] = data; 
    }),
    unsetFlag: jest.fn((scope, key) => {
      flags[key] = null; 
    }),
    getFlag: jest.fn((scope, key) => flags[key]),
  };
}

describe("activateChargeItUp", () => {
  test("banks the pending flag while Morphed", async () => {
    const actor = makeActor({ isMorphed: true });

    const banked = await activateChargeItUp(actor);

    expect(banked).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', PENDING_CHARGE_IT_UP_FLAG, expect.any(Object));
  });

  test("warns and does nothing when not Morphed", async () => {
    const actor = makeActor({ isMorphed: false });

    const banked = await activateChargeItUp(actor);

    expect(banked).toBe(false);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe("hasPendingChargeItUp / consumeChargeItUp", () => {
  test("reports the banked flag, then clears it on consume", async () => {
    const actor = makeActor({ isMorphed: true });
    await activateChargeItUp(actor);

    expect(hasPendingChargeItUp(actor)).toBe(true);

    await consumeChargeItUp(actor);

    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', PENDING_CHARGE_IT_UP_FLAG);
  });

  test("reports false with nothing banked", () => {
    const actor = makeActor();
    expect(hasPendingChargeItUp(actor)).toBe(false);
  });
});
