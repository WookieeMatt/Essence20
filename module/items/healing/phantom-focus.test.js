import { jest } from '@jest/globals';
import { hasPhantomFocusOption } from './phantom-focus.mjs';

const PHANTOM_FOCUS_ID = "Compendium.essence20.across_the_stars.Item.aXGMEoVsYSttOSHn";

function makeActor({ choices = [], health = { value: 5, max: 10, bonus: 0 } } = {}) {
  return {
    items: choices.map(choice => ({ flags: { core: { sourceId: PHANTOM_FOCUS_ID } }, system: { choice } })),
    system: { health },
    update: jest.fn(),
  };
}

describe("hasPhantomFocusOption", () => {
  test("false with no Phantom Focus at all", () => {
    expect(hasPhantomFocusOption(makeActor(), 'boostedVigor')).toBe(false);
  });

  test("true when one of the actor's (possibly several) instances matches", () => {
    const actor = makeActor({ choices: ['phaseDefense', 'boostedVigor'] });
    expect(hasPhantomFocusOption(actor, 'boostedVigor')).toBe(true);
    expect(hasPhantomFocusOption(actor, 'phaseDefense')).toBe(true);
    expect(hasPhantomFocusOption(actor, 'healingLight')).toBe(false);
  });

  test("false for a null/undefined actor", () => {
    expect(hasPhantomFocusOption(null, 'boostedVigor')).toBe(false);
    expect(hasPhantomFocusOption(undefined, 'boostedVigor')).toBe(false);
  });
});

