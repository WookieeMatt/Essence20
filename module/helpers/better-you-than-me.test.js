import { jest } from '@jest/globals';
import { activateBetterYouThanMe } from './better-you-than-me.mjs';

function setGame(targetActor) {
  global.game = { user: { targets: { first: () => (targetActor ? { actor: targetActor } : undefined) } } };
}

function makeActor({ power = 1, health = 5, max = 10 } = {}) {
  return {
    system: { powers: { personal: { value: power } }, health: { value: health, max } },
    update: jest.fn(),
  };
}

describe("activateBetterYouThanMe", () => {
  test("spends 1 Power, heals self 1, and damages the ally 1 (unreducible)", async () => {
    const actor = makeActor({ power: 1, health: 5, max: 10 });
    const ally = makeActor({ health: 5, max: 10 });
    setGame(ally);

    const result = await activateBetterYouThanMe(actor);

    expect(result).toBe(true);
    expect(actor.update).toHaveBeenCalledWith({
      'system.powers.personal.value': 0,
      'system.health.value': 6,
    });
    expect(ally.update).toHaveBeenCalledWith({ 'system.health.value': 4 });
  });

  test("caps the self-heal at max Health", async () => {
    const actor = makeActor({ power: 1, health: 10, max: 10 });
    const ally = makeActor({ health: 5 });
    setGame(ally);

    await activateBetterYouThanMe(actor);

    expect(actor.update).toHaveBeenCalledWith({
      'system.powers.personal.value': 0,
      'system.health.value': 10,
    });
  });

  test("floors the ally's Health at 0", async () => {
    const actor = makeActor({ power: 1 });
    const ally = makeActor({ health: 0 });
    setGame(ally);

    await activateBetterYouThanMe(actor);

    expect(ally.update).toHaveBeenCalledWith({ 'system.health.value': 0 });
  });

  test("returns false with no ally targeted", async () => {
    const actor = makeActor({ power: 1 });
    setGame(null);

    const result = await activateBetterYouThanMe(actor);

    expect(result).toBe(false);
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("returns false when unaffordable", async () => {
    const actor = makeActor({ power: 0 });
    const ally = makeActor();
    setGame(ally);

    const result = await activateBetterYouThanMe(actor);

    expect(result).toBe(false);
    expect(actor.update).not.toHaveBeenCalled();
    expect(ally.update).not.toHaveBeenCalled();
  });
});
