import { jest } from '@jest/globals';
import { disembarkZord, seatOf } from './zord-arrival.mjs';

/** Getting out of a Zord without a recall (PR CRB p.176-177). */

const ranger = { uuid: 'Actor.r', id: 'r', name: 'Red' };
const zordWith = (actors) => ({ name: 'Tyranno', uuid: 'Actor.z', isToken: false, getActiveTokens: () => [], system: { actors }, update: jest.fn() });

beforeEach(() => {
  global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
  global.ChatMessage = { create: jest.fn(), getSpeaker: () => ({}) };
  global.canvas = { scene: null };
  game.combat = null;
});

test("the Ranger's seat, or none", () => {
  const zord = zordWith({ k1: { uuid: 'Actor.r', vehicleRole: 'driver' }, k2: { uuid: 'Actor.x' } });
  expect(seatOf(zord, ranger)?.[0]).toBe('k1');
  expect(seatOf(zordWith({ k2: { uuid: 'Actor.r' } }), ranger)).toBeNull();
});

test("outside a fight they just get out: the seat is cleared and it's said in chat", async () => {
  const zord = zordWith({ k1: { uuid: 'Actor.r', vehicleRole: 'driver' } });
  expect(await disembarkZord(zord, ranger)).toBe(true);
  expect(zord.update).toHaveBeenCalledWith({ 'system.actors.k1': expect.any(foundry.data.operators.ForcedDeletion) });
  expect(ChatMessage.create).toHaveBeenCalled();
});

test("someone not aboard is told so, and nothing changes", async () => {
  const zord = zordWith({});
  expect(await disembarkZord(zord, ranger)).toBe(false);
  expect(ui.notifications.warn).toHaveBeenCalledWith('E20.ZordDisembarkNotAboard');
  expect(zord.update).not.toHaveBeenCalled();
});
