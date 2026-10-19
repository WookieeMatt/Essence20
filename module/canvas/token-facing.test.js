import { ART_FACINGS, artFacingOf, artFacingOffset, facesMovementItself, facingGrid, facingOf, facingSwap, facingWheelStep, isOblong, isSideways, movementFacing, naturalMeshSize, orientedSize, travelOffset, wouldAutoRotate } from './token-facing.mjs';

/** Facing for non-square tokens (token-facing.mjs): the footprint follows the picture to the nearest of four facings. */

const SQUARE = { type: 1, size: 100 };

describe('facings', () => {
  test('the nearest of 0/90/180/270, any angle', () => {
    expect([0, 44, 46, 90, 134, 136, 180, 225, 226, 270, 314, 316, 360, -90, 450].map(facingOf)).toEqual([0, 0, 1, 1, 1, 2, 2, 3, 3, 3, 3, 0, 0, 3, 1]);
    expect([0, 46, 180, 269, 314].map(isSideways)).toEqual([false, true, false, true, true]);
  });

  test('non-square tokens, on square or gridless scenes', () => {
    expect(isOblong({ width: 2, height: 1 })).toBe(true);
    expect(isOblong({ width: 2, height: 2 })).toBe(false);
    expect(isOblong({})).toBe(false);
    expect([0, 1, 2, 3, 4, 5].map(type => facingGrid({ type }))).toEqual([true, true, false, false, false, false]);
  });
});

describe('the footprint follows a turn', () => {
  const car = { x: 300, y: 400, width: 2, height: 1, rotation: 0, lockRotation: false };

  test('a 2x1 turned to 90°: 1x2 around the same centre, back on the grid', () => {
    // Centre (400, 450): a 1x2 box around it, snapped onto the grid (down, turning onto its side).
    expect(facingSwap(car, { rotation: 90 }, SQUARE)).toEqual({ width: 1, height: 2, x: 300, y: 300 });
    // Gridless: the exact centre is kept.
    expect(facingSwap(car, { rotation: 90 }, { type: 0, size: 100 })).toEqual({ width: 1, height: 2, x: 350, y: 350 });
  });

  test('a full turn ends where it started - no half-square creep', () => {
    let token = { ...car };
    for (const rotation of [90, 180, 270, 0, 90, 180]) {
      token = { ...token, ...facingSwap(token, { rotation }, SQUARE), rotation };
    }

    expect(token).toMatchObject({ x: 300, y: 400, width: 2, height: 1, rotation: 180 });
    const turned = { ...car, ...facingSwap(car, { rotation: 90 }, SQUARE), rotation: 90 };
    expect({ ...turned, ...facingSwap(turned, { rotation: 0 }, SQUARE) }).toMatchObject({ x: 300, y: 400, width: 2, height: 1 });
  });

  test('free rotation: the swap happens crossing 45°, not before', () => {
    expect(facingSwap(car, { rotation: 30 }, SQUARE)).toBeNull();
    expect(facingSwap(car, { rotation: 60 }, SQUARE)).toMatchObject({ width: 1, height: 2 });
    expect(facingSwap({ ...car, width: 1, height: 2, rotation: 90 }, { rotation: 180 }, SQUARE)).toMatchObject({ width: 2, height: 1 });
    expect(facingSwap({ ...car, rotation: 90, width: 1, height: 2 }, { rotation: 270 }, SQUARE)).toBeNull();
  });

  test('nothing for a square token, Lock Rotation, a hex grid or an update without a rotation', () => {
    expect(facingSwap({ ...car, width: 2, height: 2 }, { rotation: 90 }, SQUARE)).toBeNull();
    expect(facingSwap({ ...car, lockRotation: true }, { rotation: 90 }, SQUARE)).toBeNull();
    expect(facingSwap(car, { rotation: 90, lockRotation: true }, SQUARE)).toBeNull();
    expect(facingSwap(car, { rotation: 90 }, { type: 2, size: 100 })).toBeNull();
    expect(facingSwap(car, { x: 500 }, SQUARE)).toBeNull();
  });

  test('a size and a turn in one update: the new size is the one turned', () => {
    expect(facingSwap(car, { rotation: 90, width: 3, height: 1 }, SQUARE)).toMatchObject({ width: 1, height: 3 });
  });
});

describe('the picture and a Size change', () => {
  test("the picture's box is the natural (unturned) size while sideways", () => {
    const size = { width: 100, height: 200 };
    expect(naturalMeshSize(size, { width: 1, height: 2, rotation: 90 }, SQUARE)).toEqual({ width: 200, height: 100 });
    expect(naturalMeshSize(size, { width: 1, height: 2, rotation: 0 }, SQUARE)).toBe(size);
    expect(naturalMeshSize(size, { width: 1, height: 2, rotation: 90, lockRotation: true }, SQUARE)).toBe(size);
    expect(naturalMeshSize(size, { width: 1, height: 2, rotation: 90 }, { type: 2 })).toBe(size);
  });

  test('a turned token keeps standing turned when its Size changes', () => {
    expect(orientedSize(2, 1, 90)).toEqual({ width: 1, height: 2 });
    expect(orientedSize(2, 1, 0)).toEqual({ width: 2, height: 1 });
    expect(orientedSize(2, 2, 90)).toEqual({ width: 2, height: 2 });
    expect(orientedSize(2, 1, 90, { lockRotation: true })).toEqual({ width: 2, height: 1 });
  });
});

describe('the wheel', () => {
  test('a whole facing at a time for a non-square token; Alt, the setting off, a set angle or a square token: Foundry\'s own', () => {
    expect(facingWheelStep({ delta: 15 }, { oblong: true, enabled: true, free: false, rotation: 90 })).toEqual({ angle: 180, snap: 90 });
    expect(facingWheelStep({ delta: -45 }, { oblong: true, enabled: true, free: false })).toEqual({ angle: -90, snap: 90 });
    expect(facingWheelStep({ delta: 15 }, { oblong: true, enabled: true, free: true })).toBeNull();
    expect(facingWheelStep({ delta: 15 }, { oblong: true, enabled: false, free: false })).toBeNull();
    expect(facingWheelStep({ delta: 15 }, { oblong: false, enabled: true, free: false })).toBeNull();
    expect(facingWheelStep({ angle: 45 }, { oblong: true, enabled: true, free: false })).toBeNull();
  });
});

describe('Automatic Token Rotation', () => {
  test("Foundry's own resolution: the move's choice, the update's, else core's setting for a drag or a keyboard move; never an undo", () => {
    expect(wouldAutoRotate({ method: 'dragging' }, {}, true)).toBe(true);
    expect(wouldAutoRotate({ method: 'dragging' }, {}, false)).toBe(false);
    expect(wouldAutoRotate({ method: 'keyboard', autoRotate: false }, {}, true)).toBe(false);
    expect(wouldAutoRotate(undefined, { autoRotate: true }, false)).toBe(true);
    expect(wouldAutoRotate(undefined, {}, true)).toBe(false);
    expect(wouldAutoRotate({ method: 'undo', autoRotate: true }, {}, true)).toBe(false);
  });

  const car = { x: 300, y: 400, width: 2, height: 1 };
  test('faces the last segment as core does (down 0°, left 90°, up 180°, right 270°); nowhere: null', () => {
    expect(movementFacing(car, [{ x: 300, y: 600 }], SQUARE)).toBe(0);
    expect(movementFacing(car, [{ x: 100, y: 400 }], SQUARE)).toBe(90);
    expect(movementFacing(car, [{ x: 300, y: 200 }], SQUARE)).toBe(180);
    expect(movementFacing(car, [{ x: 600, y: 400 }], SQUARE)).toBe(270);
    expect(movementFacing(car, [{ x: 300, y: 400 }], SQUARE)).toBeNull();
    // The last segment that goes anywhere.
    expect(movementFacing(car, [{ x: 600, y: 400 }, { x: 600, y: 700 }, { x: 600, y: 700 }], SQUARE)).toBe(0);
  });

  test('a long token travels along its long side: a wide one faces right at 0°, a tall one down (core)', () => {
    expect(travelOffset({ width: 2, height: 1, rotation: 0 })).toBe(90);
    // Turned on its side (stored 1x2): still naturally wide.
    expect(travelOffset({ width: 1, height: 2, rotation: 90 })).toBe(90);
    expect(travelOffset({ width: 1, height: 2, rotation: 0 })).toBe(0);
    const wide = { offset: 90 };
    expect(movementFacing(car, [{ x: 600, y: 400 }], SQUARE, wide)).toBe(0);
    expect(movementFacing(car, [{ x: 300, y: 600 }], SQUARE, wide)).toBe(90);
    expect(movementFacing(car, [{ x: 100, y: 400 }], SQUARE, wide)).toBe(180);
    expect(movementFacing(car, [{ x: 300, y: 200 }], SQUARE, wide)).toBe(270);
  });

  test('a diagonal: 45° free, snapped to the facing on the side it already stands', () => {
    expect(movementFacing(car, [{ x: 500, y: 600 }], SQUARE)).toBe(315);
    expect(movementFacing(car, [{ x: 500, y: 600 }], SQUARE, { snap: true, rotation: 0 })).toBe(0);
    expect(movementFacing(car, [{ x: 500, y: 600 }], SQUARE, { snap: true, rotation: 270 })).toBe(270);
    // Mostly sideways: the nearer facing.
    expect(movementFacing(car, [{ x: 800, y: 500 }], SQUARE, { snap: true })).toBe(270);
  });
});

describe('Art Faces', () => {
  const flagged = (facing, extra = {}) => ({ width: 1, height: 1, rotation: 0, flags: { essence20: { artFacing: facing } }, ...extra });

  test('a set direction is its offset from core (art facing down); auto or junk is the shape guess', () => {
    expect(Object.keys(ART_FACINGS)).toEqual(['down', 'right', 'up', 'left']);
    expect(['down', 'right', 'up', 'left'].map(facing => artFacingOffset(flagged(facing)))).toEqual([0, 90, 180, 270]);
    expect(artFacingOf(flagged('sideways'))).toBe('auto');
    expect(artFacingOffset({ width: 2, height: 1, rotation: 0 })).toBe(90);
    // A wide token whose art faces left: it drives left at 0°.
    expect(artFacingOffset(flagged('left', { width: 2, height: 1 }))).toBe(270);
  });

  test('handled here: every long token, and a square one only when its Art Faces is set', () => {
    expect(facesMovementItself({ width: 2, height: 1 })).toBe(true);
    expect(facesMovementItself({ width: 1, height: 1 })).toBe(false);
    expect(facesMovementItself(flagged('right'))).toBe(true);
    expect(facesMovementItself(flagged('auto'))).toBe(false);
  });

  test('a square token whose art faces right, moving right: 0°; moving up: 270°', () => {
    const offset = artFacingOffset(flagged('right'));
    const token = { x: 300, y: 300, width: 1, height: 1 };
    expect(movementFacing(token, [{ x: 600, y: 300 }], SQUARE, { offset })).toBe(0);
    expect(movementFacing(token, [{ x: 300, y: 0 }], SQUARE, { offset })).toBe(270);
  });
});
