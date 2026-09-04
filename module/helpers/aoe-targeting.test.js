import { angleBetweenPoints, feetToPixels, getEffectiveRadiusFeet } from './aoe-targeting.mjs';

const BIGGER_BOOMS_ID = "Compendium.essence20.gi_joe_crb.Item.8oGpBcKAnhJaSqVD";

// placeAoeTemplate/getTokensInShape/pickCanvasPoint are live-canvas code (real pointer events,
// a real CONFIG.Region.documentClass, real Token placeables) with no meaningful Jest stand-in,
// consistent with every other Hooks/canvas-touching piece in this codebase - see this file's own
// doc comment. Only the pure math is unit-tested here; the rest needs live verification.

describe("feetToPixels", () => {
  beforeEach(() => {
    global.canvas = { dimensions: { distancePixels: 100 } };
  });

  test("converts feet to pixels using the scene's own grid scale", () => {
    expect(feetToPixels(10)).toBe(1000);
  });

  test("zero feet is zero pixels", () => {
    expect(feetToPixels(0)).toBe(0);
  });
});

describe("angleBetweenPoints", () => {
  test("directly east is 0 degrees", () => {
    expect(angleBetweenPoints({ x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(0);
  });

  test("directly south is 90 degrees (Foundry's clockwise-from-east, y-down convention)", () => {
    expect(angleBetweenPoints({ x: 0, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(90);
  });

  test("directly west is 180 degrees", () => {
    expect(angleBetweenPoints({ x: 0, y: 0 }, { x: -10, y: 0 })).toBeCloseTo(180);
  });

  test("directly north is -90 degrees", () => {
    expect(angleBetweenPoints({ x: 0, y: 0 }, { x: 0, y: -10 })).toBeCloseTo(-90);
  });

  test("works from a non-origin starting point", () => {
    expect(angleBetweenPoints({ x: 100, y: 100 }, { x: 110, y: 100 })).toBeCloseTo(0);
  });
});

describe("getEffectiveRadiusFeet", () => {
  function makeActor({ hasPerk = false } = {}) {
    const items = hasPerk
      ? [{ type: 'perk', flags: { core: { sourceId: BIGGER_BOOMS_ID } } }]
      : [];
    return { items };
  }

  function makeEffect({ radius = 15, style = 'explosive' } = {}) {
    return { system: { radius, classification: { style } } };
  }

  test("is just the base radius without the Perk", () => {
    expect(getEffectiveRadiusFeet(makeActor(), makeEffect())).toBe(15);
  });

  test("adds Bigger Booms' +10ft to an explosive attack when the actor has the Perk", () => {
    expect(getEffectiveRadiusFeet(makeActor({ hasPerk: true }), makeEffect())).toBe(25);
  });

  test("doesn't add the bonus to a non-explosive attack, even with the Perk", () => {
    const effect = makeEffect({ style: 'energy' });
    expect(getEffectiveRadiusFeet(makeActor({ hasPerk: true }), effect)).toBe(15);
  });

  test("treats a missing radius as 0", () => {
    const effect = makeEffect({ radius: null });
    expect(getEffectiveRadiusFeet(makeActor(), effect)).toBe(0);
  });
});
