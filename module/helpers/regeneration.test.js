import { jest } from '@jest/globals';
import { activateRegeneration } from './regeneration.mjs';

function makeActor({ health = 5, max = 10 } = {}) {
  return {
    system: { health: { value: health, max } },
    update: jest.fn(),
  };
}

describe("activateRegeneration", () => {
  test("heals 1 Health", async () => {
    const actor = makeActor({ health: 5, max: 10 });
    await activateRegeneration(actor);

    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 6 });
  });

  test("doesn't heal past max Health", async () => {
    const actor = makeActor({ health: 10, max: 10 });
    await activateRegeneration(actor);

    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 10 });
  });
});
