import { jest } from '@jest/globals';
import { landingPoint, withinRange } from './point-picker.mjs';

/** A 100px grid: a footprint's corner snaps to the nearest multiple of 100. */
const snapCorner = ({ x, y }) => ({ x: Math.round(x / 100) * 100, y: Math.round(y / 100) * 100 });

describe('landingPoint', () => {
  const token = { w: 100, h: 100, document: { getSnappedPosition: jest.fn(snapCorner) } };
  const large = { w: 200, h: 200, document: { getSnappedPosition: jest.fn(snapCorner) } };

  test("a ghost lands on the grid squares: the point is its snapped footprint's centre", () => {
    expect(landingPoint({ x: 237, y: 461 }, { token })).toEqual({ x: 250, y: 450 });
    // A 2x2 token's centre sits on a grid line.
    expect(landingPoint({ x: 237, y: 461 }, { token: large })).toEqual({ x: 200, y: 500 });
  });

  test('Shift holds the snap off', () => {
    expect(landingPoint({ x: 237, y: 461 }, { token, free: true })).toEqual({ x: 237, y: 461 });
  });

  test('a plain point: the nearest grid centre with snap, else the cursor', () => {
    const grid = { getSnappedPoint: jest.fn(() => ({ x: 250, y: 450 })) };
    expect(landingPoint({ x: 237, y: 461 }, { snap: true, grid })).toEqual({ x: 250, y: 450 });
    expect(landingPoint({ x: 237, y: 461 }, { grid })).toEqual({ x: 237, y: 461 });
    expect(landingPoint({ x: 1, y: 2 }, { snap: true, grid: null })).toEqual({ x: 1, y: 2 });
  });
});

describe('withinRange', () => {
  const measure = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) / 20;
  test('measured from the mover; no range or no mover is always in', () => {
    expect(withinRange({ x: 0, y: 0 }, { x: 1200, y: 0 }, 60, measure)).toBe(true);
    expect(withinRange({ x: 0, y: 0 }, { x: 1300, y: 0 }, 60, measure)).toBe(false);
    expect(withinRange(null, { x: 9999, y: 0 }, 60, measure)).toBe(true);
    expect(withinRange({ x: 0, y: 0 }, { x: 9999, y: 0 }, null, measure)).toBe(true);
  });
});
