import { jest } from '@jest/globals';
import { hasNearbyTacticalMeditation } from './tactical-meditation.mjs';

const TACTICAL_MEDITATION_ID = "Compendium.essence20.through_the_shattered_grid.Item.TacticalMedit8ns";

function makePerkItem(sourceId) {
  return { type: 'perk', flags: { core: { sourceId } } };
}

function makeActor({ id, hasPerk = false, disposition = 1 } = {}) {
  return {
    id,
    items: hasPerk ? [makePerkItem(TACTICAL_MEDITATION_ID)] : [],
    getActiveTokens: jest.fn(() => [{ document: { disposition }, center: {} }]),
  };
}

describe("hasNearbyTacticalMeditation", () => {
  beforeEach(() => {
    global.canvas = {
      tokens: { placeables: [] },
      grid: { measurePath: jest.fn(() => ({ distance: 5 })) },
    };
  });

  test("true when the actor holds the Perk themselves", () => {
    const actor = makeActor({ id: 'self', hasPerk: true });
    expect(hasNearbyTacticalMeditation(actor)).toBe(true);
  });

  test("true when a nearby ally holds the Perk", () => {
    const actor = makeActor({ id: 'self', hasPerk: false });
    const allyActor = makeActor({ id: 'ally', hasPerk: true });
    canvas.tokens.placeables = [
      { actor, document: { disposition: 1 }, center: {} },
      { actor: allyActor, document: { disposition: 1 }, center: {} },
    ];

    expect(hasNearbyTacticalMeditation(actor)).toBe(true);
  });

  test("false when the nearby holder is an enemy, not an ally", () => {
    const actor = makeActor({ id: 'self', hasPerk: false });
    const enemyActor = makeActor({ id: 'enemy', hasPerk: true });
    canvas.tokens.placeables = [
      { actor, document: { disposition: 1 }, center: {} },
      { actor: enemyActor, document: { disposition: -1 }, center: {} },
    ];

    expect(hasNearbyTacticalMeditation(actor)).toBe(false);
  });

  test("false when nobody nearby holds the Perk", () => {
    const actor = makeActor({ id: 'self', hasPerk: false });
    canvas.tokens.placeables = [{ actor, document: { disposition: 1 }, center: {} }];

    expect(hasNearbyTacticalMeditation(actor)).toBe(false);
  });

  test("false out of range", () => {
    canvas.grid.measurePath.mockReturnValue({ distance: 20 });
    const actor = makeActor({ id: 'self', hasPerk: false });
    const allyActor = makeActor({ id: 'ally', hasPerk: true });
    canvas.tokens.placeables = [
      { actor, document: { disposition: 1 }, center: {} },
      { actor: allyActor, document: { disposition: 1 }, center: {} },
    ];

    expect(hasNearbyTacticalMeditation(actor)).toBe(false);
  });
});
