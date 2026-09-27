import { jest } from '@jest/globals';
import { activateRapidMorph } from './rapid-morph.mjs';

// onMorph (sheet-handlers/power-ranger-handler.mjs) is run for real rather than module-mocked -
// see attachment-handler.test.js's own note on why unstable_mockModule isn't used in this project.
// Everything it touches for an un-Morphed actor with no Boosted Vigor/Growth Boost/art configured
// is reachable through a plain actor mock plus jest.setup.js's own game/ui globals.
function makeActor({ isMorphed = false } = {}) {
  return {
    name: 'Ranger',
    items: [],
    prototypeToken: { texture: { src: 'icons/ranger.webp' } },
    system: { isMorphed, image: {}, health: { bonus: 0 } },
    update: jest.fn(),
    getActiveTokens: jest.fn(() => []),
  };
}

describe("activateRapidMorph", () => {
  test("morphs the actor (flips isMorphed) when not already Morphed", async () => {
    const actor = makeActor({ isMorphed: false });

    const morphed = await activateRapidMorph(actor);

    expect(morphed).toBe(true);
    expect(actor.update).toHaveBeenCalledWith({ 'system.isMorphed': true });
  });

  test("does nothing when already Morphed", async () => {
    const actor = makeActor({ isMorphed: true });

    const morphed = await activateRapidMorph(actor);

    expect(morphed).toBe(false);
    expect(actor.update).not.toHaveBeenCalled();
  });
});
