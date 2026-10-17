import { jest } from '@jest/globals';
import { Essence20Actors } from './actors.mjs';

describe("Essence20Actors#party", () => {
  const realSettingsGet = global.game.settings.get;

  afterEach(() => {
    global.game.settings.get = realSettingsGet;
  });

  function makeCollection(actors, pinnedId) {
    global.game.settings.get = jest.fn((scope, key) => (key === 'primaryParty' ? pinnedId : undefined));
    return new Essence20Actors(actors);
  }

  test("returns the pinned actor when it exists and is a Party", () => {
    const party = { _id: 'p1', type: 'party' };
    const collection = makeCollection([party, { _id: 'a1', type: 'playerCharacter' }], 'p1');
    expect(collection.party).toBe(party);
  });

  test("returns null when nothing is pinned", () => {
    const collection = makeCollection([{ _id: 'p1', type: 'party' }], '');
    expect(collection.party).toBeNull();
  });

  test("returns null when the pinned id no longer resolves", () => {
    const collection = makeCollection([{ _id: 'p1', type: 'party' }], 'gone');
    expect(collection.party).toBeNull();
  });

  test("returns null when the pinned actor isn't a Party", () => {
    const collection = makeCollection([{ _id: 'a1', type: 'playerCharacter' }], 'a1');
    expect(collection.party).toBeNull();
  });
});
