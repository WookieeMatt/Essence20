import { jest } from '@jest/globals';

/** Disembarking in a fight (PR CRB p.176-177): not once the Zord has moved this turn; it takes the Move action. */

const moved = { feet: 0 };
const economy = { remaining: { move: 1 }, spend: jest.fn(async () => ({ blocked: false })) };
jest.unstable_mockModule('./items/vehicles/armored-cabin.mjs', () => ({ feetMovedThisTurn: () => moved.feet }));
jest.unstable_mockModule('./mechanics/actions/action-economy.mjs', () => ({ getRemaining: () => economy.remaining, spend: economy.spend }));
const { disembarkZord } = await import('./zord-arrival.mjs');

const ranger = { uuid: 'Actor.r', id: 'r', name: 'Red' };
const zord = () => ({ name: 'Tyranno', uuid: 'Actor.z', isToken: false, getActiveTokens: () => [], system: { actors: { k1: { uuid: 'Actor.r', vehicleRole: 'driver' } } }, update: jest.fn() });

beforeEach(() => {
  global.ui = { notifications: { warn: jest.fn() } };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.canvas = { scene: null };
  game.combat = { started: true };
  economy.spend.mockClear();
  economy.remaining = { move: 1 };
  moved.feet = 0;
});

test("a Zord that moved this turn can't be got out of", async () => {
  moved.feet = 20;
  const z = zord();
  expect(await disembarkZord(z, ranger)).toBe(false);
  expect(ui.notifications.warn).toHaveBeenCalledWith('E20.ZordDisembarkMoved');
  expect(z.update).not.toHaveBeenCalled();
});

test("a still Zord: the Move action is taken, then they're out", async () => {
  const z = zord();
  expect(await disembarkZord(z, ranger)).toBe(true);
  expect(economy.spend).toHaveBeenCalledWith(ranger, 'move', expect.objectContaining({ context: { kind: 'disembark' } }));
  expect(z.update).toHaveBeenCalled();
});

test("Move already spent (they're mid-move): no second charge; a refused spend stops it", async () => {
  economy.remaining = { move: 0 };
  expect(await disembarkZord(zord(), ranger)).toBe(true);
  expect(economy.spend).not.toHaveBeenCalled();

  economy.remaining = { move: 1 };
  economy.spend.mockResolvedValueOnce({ blocked: true });
  const z = zord();
  expect(await disembarkZord(z, ranger)).toBe(false);
  expect(z.update).not.toHaveBeenCalled();
});
