import { jest } from '@jest/globals';
import { LINK_HOLDERS } from './index.mjs';
import { linkedEntries } from './links.mjs';

/**
 * An unlinked token builds its actor lazily on the first read of token.actor (Foundry v14), and building it prepares the
 * actor, which looks for aura holders on the canvas again. While that build runs the token still reads as unbuilt, so
 * every token.actor read started another build: "Maximum call stack size exceeded" on scene load (2026-10-07).
 */

const placeables = [];

beforeEach(() => {
  placeables.length = 0;
  LINK_HOLDERS.clear();
  global.canvas = { tokens: { placeables } };
});

afterAll(() => {
  LINK_HOLDERS.clear();
  delete global.canvas;
});

const actorOf = id => ({ id, type: 'npc', items: [], system: {}, flags: {} });

test("a token whose actor can't hold an aura is never built just to check", () => {
  LINK_HOLDERS.add('holder');
  const read = jest.fn(() => actorOf('other'));
  placeables.push({
    document: { actorId: 'other' },
    get actor() {
      return read();
    },
  });
  linkedEntries(actorOf('me'), 'RollModifier');
  expect(read).not.toHaveBeenCalled();
});

test('a token actor built while the holders are being gathered does not gather them again (no endless rebuild)', () => {
  LINK_HOLDERS.add('vehicle');
  let builds = 0;
  const token = {
    document: { actorId: 'vehicle' },
    get actor() {
      builds++;
      if (builds > 50) {
        throw new RangeError('Maximum call stack size exceeded');
      }

      // Building this actor prepares it, and preparing asks for linked rules again.
      linkedEntries(actorOf('vehicle'), 'Senses');
      return actorOf('vehicle');
    },
  };
  placeables.push(token);
  expect(() => linkedEntries(actorOf('me'), 'Senses')).not.toThrow();
  expect(builds).toBeLessThan(5);
});
