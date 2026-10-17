import { jest } from '@jest/globals';
import { arrivingZords, boardZord, edgePosition, hasArrived, tokensTouch } from './zord-arrival.mjs';

/** Call to Action's arrival (PR CRB p.135): the notice, Place at the scene's edge, Board once in contact. */

const combat = { id: 'c1', round: 4 };
const zord = (flags = {}) => ({ type: 'zord', name: 'Tyranno', uuid: 'Actor.z', flags: { essence20: flags } });

test('a Zord arrives on the round its timer names (or later), once per combat', () => {
  const due = zord({ zordSummonReadyRound: 4 });
  const late = zord({ zordSummonReadyRound: 2 });
  const early = zord({ zordSummonReadyRound: 6 });
  const done = zord({ zordSummonReadyRound: 3, zordArrived: { combatId: 'c1', round: 3 } });
  const uncalled = zord();
  expect(arrivingZords([due, late, early, done, uncalled, { type: 'npc', flags: {} }], combat)).toEqual([due, late]);
  expect(hasArrived(done, combat)).toBe(true);
  expect(hasArrived(done, { id: 'c2' })).toBe(false);
});

describe('placing it at the edge of the scene nearest its Ranger', () => {
  const rect = { x: 0, y: 0, width: 2000, height: 1000 };

  test('the nearest edge, level with the Ranger, inside the scene', () => {
    expect(edgePosition(rect, { x: 1900, y: 500 }, 300, 300, 100)).toEqual({ x: 1700, y: 400 });
    expect(edgePosition(rect, { x: 150, y: 450 }, 300, 300, 100)).toEqual({ x: 0, y: 300 });
    expect(edgePosition(rect, { x: 1000, y: 950 }, 300, 300, 100)).toEqual({ x: 900, y: 700 });
  });

  test('no Ranger on the map: the middle of the nearest edge', () => {
    expect(edgePosition(rect, null, 100, 100, 100)).toEqual({ x: 1000, y: 0 });
  });
});

test('boarding needs the tokens to touch (diagonals count)', () => {
  const token = (x, y, w = 100, h = 100) => ({ center: { x: x + w / 2, y: y + h / 2 }, w, h });
  const grid = { size: 100 };
  expect(tokensTouch(token(0, 0), token(100, 0), grid)).toBe(true);
  expect(tokensTouch(token(0, 0), token(100, 100), grid)).toBe(true);
  expect(tokensTouch(token(0, 0, 300, 300), token(300, 100), grid)).toBe(true);
  expect(tokensTouch(token(0, 0), token(200, 0), grid)).toBe(false);
});

describe('boarding', () => {
  beforeEach(() => {
    global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
    global.canvas = { scene: null };
    global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  });

  test('a Ranger already listed becomes the driver', async () => {
    const ranger = { uuid: 'Actor.r', name: 'Red' };
    const z = { ...zord(), system: { crew: { numDrivers: 1 }, actors: { k1: { uuid: 'Actor.r', vehicleRole: 'passenger' } } }, update: jest.fn() };
    expect(await boardZord(z, ranger)).toBe(true);
    expect(z.update).toHaveBeenCalledWith({ 'system.actors.k1.vehicleRole': 'driver' });
  });

  test('a Ranger still in the driver seat from an earlier fight climbs back in: the token leaves the map', async () => {
    const tokenDoc = { isOwner: true, parent: 'scene', delete: jest.fn() };
    const ranger = { uuid: 'Actor.r', name: 'Red', getActiveTokens: () => [{ document: tokenDoc }] };
    global.canvas = { scene: 'scene' };
    const z = { ...zord(), getActiveTokens: () => [], system: { crew: { numDrivers: 1 }, actors: { k1: { uuid: 'Actor.r', vehicleRole: 'driver' } } }, update: jest.fn() };
    expect(await boardZord(z, ranger)).toBe(true);
    expect(z.update).not.toHaveBeenCalled();
    expect(global.ui.notifications.warn).not.toHaveBeenCalled();
    expect(tokenDoc.delete).toHaveBeenCalled();
  });

  test('a taken driver seat refuses', async () => {
    const ranger = { uuid: 'Actor.r', name: 'Red' };
    const z = { ...zord(), system: { crew: { numDrivers: 1 }, actors: { k1: { uuid: 'Actor.b', vehicleRole: 'driver' } } }, update: jest.fn() };
    expect(await boardZord(z, ranger)).toBe(false);
    expect(global.ui.notifications.warn).toHaveBeenCalledWith('E20.ZordBoardSeatTaken');
  });
});

test('when the combat ends, a Zord forgets its summon: timer, arrival and caller', async () => {
  const { clearSummonUpdate } = await import('./zord-arrival.mjs');
  expect(clearSummonUpdate({ zordSummonReadyRound: 3, zordArrived: { combatId: 'c1' }, zordSummoner: 'Actor.r', other: 1 })).toEqual({
    'flags.essence20.zordSummonReadyRound': expect.any(foundry.data.operators.ForcedDeletion), 'flags.essence20.zordArrived': expect.any(foundry.data.operators.ForcedDeletion), 'flags.essence20.zordSummoner': expect.any(foundry.data.operators.ForcedDeletion),
  });
  expect(clearSummonUpdate({ zordSummonReadyRound: 3 })).toEqual({ 'flags.essence20.zordSummonReadyRound': expect.any(foundry.data.operators.ForcedDeletion) });
});
