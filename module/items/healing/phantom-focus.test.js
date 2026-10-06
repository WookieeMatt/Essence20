import { jest } from '@jest/globals';
import { applyBoostedVigor, hasPhantomFocusOption } from './phantom-focus.mjs';

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

describe("applyBoostedVigor", () => {
  test("adds +3 health.bonus when about to Morph, with the Perk", async () => {
    const actor = makeActor({ choices: ['boostedVigor'] });
    await applyBoostedVigor(actor, true);
    expect(actor.update).toHaveBeenCalledWith({ 'system.health.bonus': 3 });
  });

  test("removes 3 health.bonus when about to un-Morph, with the Perk", async () => {
    const actor = makeActor({ choices: ['boostedVigor'], health: { value: 5, max: 10, bonus: 3 } });
    await applyBoostedVigor(actor, false);
    expect(actor.update).toHaveBeenCalledWith({ 'system.health.bonus': 0 });
  });

  test("does nothing without the Perk", async () => {
    const actor = makeActor();
    await applyBoostedVigor(actor, true);
    expect(actor.update).not.toHaveBeenCalled();
  });
});
