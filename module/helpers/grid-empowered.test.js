import { jest } from '@jest/globals';
import { activateGridEmpowered } from './grid-empowered.mjs';

global.game = { user: { targets: { first: () => undefined } } };

function makeActor() {
  return {
    system: { health: { value: 5 }, stun: { value: 0 } },
    update: jest.fn(),
    toggleStatusEffect: jest.fn(),
  };
}

describe("activateGridEmpowered", () => {
  afterEach(() => {
    global.game.user.targets = { first: () => undefined };
  });

  test("deals 1 Electric damage to the currently-targeted actor", async () => {
    const targetActor = makeActor();
    global.game.user.targets = { first: () => ({ actor: targetActor }) };

    const result = await activateGridEmpowered({});

    expect(result).toBe(true);
    expect(targetActor.update).toHaveBeenCalledWith({ 'system.health.value': 4 });
  });

  test("returns false and does nothing without a target", async () => {
    global.game.user.targets = { first: () => undefined };

    const result = await activateGridEmpowered({});

    expect(result).toBe(false);
  });
});
