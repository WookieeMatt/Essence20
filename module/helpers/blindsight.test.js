import {
  BLINDSIGHT_DETECTION_MODE_ID, buildDetectionModes, getBlindsightRange,
  registerBlindsightDetectionMode,
} from "./blindsight.mjs";

function makeActor(items) {
  return { items };
}

describe("getBlindsightRange", () => {
  test("returns 0 for an actor with nothing granting it", () => {
    expect(getBlindsightRange(makeActor([{ type: 'perk', system: {} }]))).toBe(0);
    expect(getBlindsightRange(makeActor([]))).toBe(0);
    expect(getBlindsightRange(undefined)).toBe(0);
  });

  test("reads the range off an enabled Perk grant — Visionless Sight's own 10ft", () => {
    const actor = makeActor([{ type: 'perk', system: { blindsight: { enabled: true, range: 10 } } }]);

    expect(getBlindsightRange(actor)).toBe(10);
  });

  test("ignores a grant that is present but disabled", () => {
    const actor = makeActor([{ type: 'perk', system: { blindsight: { enabled: false, range: 10 } } }]);

    expect(getBlindsightRange(actor)).toBe(0);
  });

  test("takes the largest range when more than one grant applies, matching visionGrant's rule", () => {
    const actor = makeActor([
      { type: 'perk', system: { blindsight: { enabled: true, range: 10 } } },
      { type: 'perk', system: { blindsight: { enabled: true, range: 30 } } },
    ]);

    expect(getBlindsightRange(actor)).toBe(30);
  });

  test("gear only counts while equipped; a Perk is always on", () => {
    const unequipped = makeActor([
      { type: 'gear', system: { equipped: false, blindsight: { enabled: true, range: 15 } } },
    ]);
    const equipped = makeActor([
      { type: 'gear', system: { equipped: true, blindsight: { enabled: true, range: 15 } } },
    ]);

    expect(getBlindsightRange(unequipped)).toBe(0);
    expect(getBlindsightRange(equipped)).toBe(15);
  });
});

describe("buildDetectionModes", () => {
  test("adds this system's own entry when a range is granted", () => {
    expect(buildDetectionModes([], 10)).toEqual([
      { id: BLINDSIGHT_DETECTION_MODE_ID, enabled: true, range: 10 },
    ]);
  });

  test("leaves other modes alone — a GM's or another module's entries survive", () => {
    const existing = [{ id: 'feelTremor', enabled: true, range: 30 }];

    expect(buildDetectionModes(existing, 10)).toEqual([
      { id: 'feelTremor', enabled: true, range: 30 },
      { id: BLINDSIGHT_DETECTION_MODE_ID, enabled: true, range: 10 },
    ]);
  });

  test("replaces a stale entry of its own rather than stacking a second", () => {
    const existing = [{ id: BLINDSIGHT_DETECTION_MODE_ID, enabled: true, range: 5 }];

    expect(buildDetectionModes(existing, 10)).toEqual([
      { id: BLINDSIGHT_DETECTION_MODE_ID, enabled: true, range: 10 },
    ]);
  });

  test("removes its entry entirely once the grant is gone", () => {
    const existing = [
      { id: 'feelTremor', enabled: true, range: 30 },
      { id: BLINDSIGHT_DETECTION_MODE_ID, enabled: true, range: 10 },
    ];

    expect(buildDetectionModes(existing, 0)).toEqual([{ id: 'feelTremor', enabled: true, range: 30 }]);
  });

  test("tolerates a token with no detectionModes at all", () => {
    expect(buildDetectionModes(undefined, 0)).toEqual([]);
  });
});

describe("registerBlindsightDetectionMode", () => {
  class FakeDetectionMode {
    constructor(config) {
      Object.assign(this, config);
    }
  }

  beforeEach(() => {
    global.CONFIG = { Canvas: { detectionModes: { senseAll: new FakeDetectionMode({ id: 'senseAll' }) } } };
    global.foundry = { canvas: { perception: { DetectionMode: { DETECTION_TYPES: { MOVE: 'move', SIGHT: 'sight' } } } } };
  });

  afterEach(() => {
    global.CONFIG = undefined;
    global.foundry = undefined;
  });

  // The three settings that make this work at all: walls so the LOS polygon is still tested,
  // angle false for 360 degrees, and a non-SIGHT type so CONFIG.specialStatusEffects.BLIND
  // doesn't switch it off - see the module's own doc comment.
  test("registers a wall-respecting, 360-degree, non-sight mode", () => {
    registerBlindsightDetectionMode();

    const mode = CONFIG.Canvas.detectionModes[BLINDSIGHT_DETECTION_MODE_ID];
    expect(mode.walls).toBe(true);
    expect(mode.angle).toBe(false);
    expect(mode.type).toBe('move');
    expect(mode.type).not.toBe('sight');
  });

  test("is idempotent - a second call doesn't replace the registered mode", () => {
    registerBlindsightDetectionMode();
    const first = CONFIG.Canvas.detectionModes[BLINDSIGHT_DETECTION_MODE_ID];
    registerBlindsightDetectionMode();

    expect(CONFIG.Canvas.detectionModes[BLINDSIGHT_DETECTION_MODE_ID]).toBe(first);
  });

  test("no-ops rather than throwing when the canvas config isn't available", () => {
    global.CONFIG = {};
    expect(() => registerBlindsightDetectionMode()).not.toThrow();
  });
});
