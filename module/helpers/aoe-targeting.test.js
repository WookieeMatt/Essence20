import {
  DEFAULT_CONE_ANGLE_DEGREES,
  angleBetweenPoints,
  buildAoeBehaviors,
  buildAoeRegionData,
  buildAoeShapeData,
  feetToPixels,
  getEffectiveRadiusFeet,
} from './aoe-targeting.mjs';

const BIGGER_BOOMS_ID = "Compendium.essence20.gi_joe_crb.Item.8oGpBcKAnhJaSqVD";

// placeAoeTemplate/getTokensInShape/getTokensInRegion are live-canvas code (canvas.regions
// .placeRegion's real placement gesture, a real CONFIG.Region.documentClass, real Token
// placeables) with no meaningful Jest stand-in, consistent with every other Hooks/canvas-touching
// piece in this codebase - see that file's own doc comment. Only the pure math and the pure
// shape-data assembly are unit-tested here; the rest needs live verification.

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

  // Bring It All Down (Decepticon Directive, Demolitionist Focus, 20th level, p.57) - "Double the
  // blast area of effect radius." See helpers/bring-it-all-down.mjs's own doc comment.
  test("defaults radiusMultiplier to 1 (no change) when omitted", () => {
    expect(getEffectiveRadiusFeet(makeActor(), makeEffect())).toBe(15);
  });

  test("doubles the total radius (base + Bigger Booms) when radiusMultiplier is 2", () => {
    expect(getEffectiveRadiusFeet(makeActor({ hasPerk: true }), makeEffect(), 2)).toBe(50);
  });
});

describe("buildAoeShapeData", () => {
  const TOKEN = { x: 100, y: 200, width: 2, height: 2, shape: 0 };
  const CENTER = { x: 150, y: 250 };

  test("builds a circle at the origin, since placeRegion's cursor tracking positions it", () => {
    expect(buildAoeShapeData('circle', 120)).toEqual({
      type: 'circle', x: 0, y: 0, radius: 120, gridBased: false,
    });
  });

  test("falls back to a circle for an unrecognised shape", () => {
    expect(buildAoeShapeData(undefined, 60).type).toBe('circle');
  });

  test("pins a cone's apex to the attacker's token centre", () => {
    const shape = buildAoeShapeData('cone', 180, { token: TOKEN, center: CENTER });
    expect(shape).toEqual({
      type: 'cone',
      x: CENTER.x,
      y: CENTER.y,
      radius: 180,
      angle: DEFAULT_CONE_ANGLE_DEGREES,
      rotation: 0,
      gridBased: false,
    });
  });

  test("starts a cone unrotated, since onMove aims it from the cursor", () => {
    expect(buildAoeShapeData('cone', 90, { token: TOKEN, center: CENTER }).rotation).toBe(0);
  });

  test('builds a line from the attacker, using the radius as its length', () => {
    const shape = buildAoeShapeData('line', 240, { token: TOKEN, center: CENTER, lineWidthPixels: 20 });
    expect(shape).toEqual({
      type: 'line', x: CENTER.x, y: CENTER.y, length: 240, width: 20, rotation: 0, gridBased: false,
    });
  });

  test("anchors an emanation to the attacker's own token via a token base shape", () => {
    expect(buildAoeShapeData('emanation', 60, { token: TOKEN, center: CENTER })).toEqual({
      type: 'emanation',
      base: { type: 'token', x: 100, y: 200, width: 2, height: 2, shape: 0 },
      radius: 60,
      gridBased: true,
    });
  });

  test("measures an emanation on the grid, unlike a freely-drawn circle", () => {
    // "every square within X feet", not a smooth circle - see buildAoeShapeData's own comment.
    expect(buildAoeShapeData('emanation', 60, { token: TOKEN }).gridBased).toBe(true);
    expect(buildAoeShapeData('circle', 60).gridBased).toBe(false);
  });
});

describe("buildAoeBehaviors", () => {
  function makeItem(effects) {
    return { name: 'Lingering Field', effects: { contents: effects } };
  }

  test("points core's applyActiveEffect behavior at the item's own effects", () => {
    const behaviors = buildAoeBehaviors(makeItem([
      { uuid: 'Item.abc.ActiveEffect.def' },
      { uuid: 'Item.abc.ActiveEffect.ghi' },
    ]));

    expect(behaviors).toEqual([{
      name: 'Lingering Field',
      type: 'applyActiveEffect',
      system: { effects: ['Item.abc.ActiveEffect.def', 'Item.abc.ActiveEffect.ghi'] },
    }]);
  });

  test("carries no behavior for an item with no effects, leaving a purely visual area", () => {
    expect(buildAoeBehaviors(makeItem([]))).toEqual([]);
  });

  test("survives an item with no effects collection at all", () => {
    expect(buildAoeBehaviors({ name: 'x' })).toEqual([]);
    expect(buildAoeBehaviors(undefined)).toEqual([]);
  });

  test("skips an effect with no resolvable uuid", () => {
    expect(buildAoeBehaviors(makeItem([{ uuid: null }]))).toEqual([]);
  });
});

describe("buildAoeRegionData", () => {
  const SHAPE = { type: 'circle', x: 0, y: 0, radius: 100, gridBased: false };
  const ACTOR = { uuid: 'Actor.abc' };

  function makeItem(duration) {
    return { name: 'Field', uuid: 'Item.def', effects: { contents: [] }, system: { duration } };
  }

  function makeToken({ level = 'lvl1', hidden = false } = {}) {
    return { id: 'tok1', document: { level, hidden } };
  }

  beforeEach(() => {
    global.game = {
      ...(global.game ?? {}),
      user: { id: 'user1', color: '#fff' },
      combat: { round: 4 },
      time: { worldTime: 900 },
    };
    global.CONST = {
      REGION_VISIBILITY: { ALWAYS: 0 },
      DOCUMENT_OWNERSHIP_LEVELS: { OWNER: 3 },
    };
    global.canvas = { level: { id: 'viewedLevel' } };
  });

  test("an instantaneous area carries no provenance, because it never reaches the scene", () => {
    const data = buildAoeRegionData(ACTOR, makeItem({ units: 'instant', value: null }), SHAPE,
      { lingering: false });

    expect(data.flags).toBeUndefined();
    expect(data.ownership).toBeUndefined();
    expect(data.behaviors).toBeUndefined();
    expect(data.shapes).toEqual([SHAPE]);
  });

  test("a lingering area records who made it, what made it, and when it started", () => {
    const data = buildAoeRegionData(ACTOR, makeItem({ units: 'rounds', value: 3 }), SHAPE,
      { lingering: true });

    expect(data.flags.essence20.aoe).toEqual({
      actorUuid: 'Actor.abc',
      itemUuid: 'Item.def',
      duration: { units: 'rounds', value: 3 },
      placedAtRound: 4,
      placedAtWorldTime: 900,
    });
    expect(data.ownership).toEqual({ user1: 3 });
  });

  test("an unattached area is scoped to the level being viewed", () => {
    const data = buildAoeRegionData(ACTOR, makeItem({ units: 'rounds', value: 1 }), SHAPE,
      { lingering: true });

    expect(data.levels).toEqual(['viewedLevel']);
    expect(data.attachment).toBeUndefined();
  });

  test("a lingering emanation is attached to its caster, so the aura travels with them", () => {
    // This is the case that used to be lost entirely: the emanation path returned before any
    // region was created, so a 3-round aura silently behaved as instantaneous.
    const data = buildAoeRegionData(ACTOR, makeItem({ units: 'rounds', value: 3 }), SHAPE,
      { lingering: true, attachedToken: makeToken() });

    expect(data.attachment).toEqual({ token: 'tok1' });
    // Core requires an attached Region to sit in its token's level and match its hidden state.
    expect(data.levels).toEqual(['lvl1']);
    expect(data.hidden).toBe(false);
  });

  test("an attached area inherits a hidden caster's hidden state", () => {
    const data = buildAoeRegionData(ACTOR, makeItem({ units: 'scenes', value: 1 }), SHAPE,
      { lingering: true, attachedToken: makeToken({ hidden: true }) });

    expect(data.hidden).toBe(true);
  });

  test("falls back to every level when the scene has none", () => {
    global.canvas = { level: null };
    const data = buildAoeRegionData(ACTOR, makeItem({ units: 'rounds', value: 1 }), SHAPE,
      { lingering: true });

    expect(data.levels).toEqual([]);
  });
});
