import { jest } from '@jest/globals';
import { grantPrimalMovement } from './primal-movement.mjs';

function mockDialog(type) {
  global.foundry = {
    applications: {
      api: {
        DialogV2: {
          wait: jest.fn(async ({ buttons }) => buttons[0].callback(null, {
            form: { elements: { type: { value: type } } },
          })),
        },
      },
    },
    utils: { escapeHTML: (s) => s },
  };
}

function mockCancelledDialog() {
  global.foundry = {
    applications: { api: { DialogV2: { wait: jest.fn(async () => 'cancel') } } },
    utils: { escapeHTML: (s) => s },
  };
}

function makeActor(movement) {
  return {
    system: { movement },
    update: jest.fn(async function (data) {
      for (const [key, value] of Object.entries(data)) {
        const [, type] = key.split('.');
        this.system.movement[type] = { ...this.system.movement[type], bonus: value };
      }
    }),
  };
}

describe("grantPrimalMovement (Technorganic Secrets, General Perk, p.48)", () => {
  test("grants 20ft of a Movement type the actor doesn't already have", async () => {
    mockDialog('aerial');
    const actor = makeActor({ ground: { base: 40, bonus: 0 }, aerial: { base: 0, bonus: 0 } });

    const result = await grantPrimalMovement(actor);

    expect(result).toBe('aerial');
    expect(actor.update).toHaveBeenCalledWith({ 'system.movement.aerial.bonus': 20 });
  });

  test("adds onto an existing bonus for that type rather than overwriting it", async () => {
    mockDialog('swim');
    const actor = makeActor({ ground: { base: 40, bonus: 0 }, swim: { base: 0, bonus: 10 } });

    await grantPrimalMovement(actor);

    expect(actor.update).toHaveBeenCalledWith({ 'system.movement.swim.bonus': 30 });
  });

  test("warns and returns null when every Movement type is already possessed", async () => {
    const allTypes = { aerial: { base: 10 }, burrow: { base: 10 }, climb: { base: 10 }, ground: { base: 10 }, swim: { base: 10 } };
    const actor = makeActor(allTypes);
    global.ui = { notifications: { warn: jest.fn() } };

    const result = await grantPrimalMovement(actor);

    expect(result).toBeNull();
    expect(actor.update).not.toHaveBeenCalled();
    expect(global.ui.notifications.warn).toHaveBeenCalled();
  });

  test("returns null when the picker is cancelled", async () => {
    mockCancelledDialog();
    const actor = makeActor({ ground: { base: 40, bonus: 0 }, aerial: { base: 0, bonus: 0 } });

    const result = await grantPrimalMovement(actor);

    expect(result).toBeNull();
    expect(actor.update).not.toHaveBeenCalled();
  });
});
