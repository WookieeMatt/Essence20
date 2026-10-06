import { jest } from '@jest/globals';

import {
  pickPrimary, defaultPartyName, carriedPoints, preventLastPartyDelete, preventPrimaryDeleteByPlayer,
  handlePartyDeleted, visibleToPlayers,
} from './party.mjs';

const party = (id, { sort = 0, storyPoints = 0, gmPoints = 0 } = {}) => ({
  id, type: 'party', name: `Party ${id}`, sort,
  system: { storyPoints, gmPoints },
  update: jest.fn(async () => {}),
});

describe("pickPrimary", () => {
  const parties = [party('a', { sort: 1 }), party('b', { sort: 2 }), party('c', { sort: 3 })];

  test("keeps the pinned one when it is still there", () => {
    expect(pickPrimary(parties, 'b')).toBe(parties[1]);
  });

  test("falls back to the first in sidebar order when nothing valid is pinned", () => {
    expect(pickPrimary(parties, '')).toBe(parties[0]);
    expect(pickPrimary(parties, 'gone')).toBe(parties[0]);
  });

  // The Party being deleted is still in the collection when the choice is made.
  test("never picks the one being deleted, even if it is the pinned one", () => {
    expect(pickPrimary(parties, 'a', 'a')).toBe(parties[1]);
  });

  test("null when none are left", () => {
    expect(pickPrimary([parties[0]], 'a', 'a')).toBeNull();
    expect(pickPrimary([], '')).toBeNull();
  });
});

describe("defaultPartyName", () => {
  test("the game line's own word for a squad", () => {
    expect(defaultPartyName('giJoe')).toBe('E20.PartyNameGiJoe');
    expect(defaultPartyName('myLittlePony')).toBe('E20.PartyNameMyLittlePony');
  });

  test("the plain type name when no line is set", () => {
    expect(defaultPartyName('')).toBe('TYPES.Actor.party');
  });
});

describe("carriedPoints", () => {
  test("adds the leaving Party's points onto the next one's own", () => {
    const from = party('a', { storyPoints: 3, gmPoints: 2 });
    const to = party('b', { storyPoints: 1, gmPoints: 0 });
    expect(carriedPoints(from, to)).toEqual({ 'system.storyPoints': 4, 'system.gmPoints': 2 });
  });

  test("nothing to carry when the pool is empty", () => {
    expect(carriedPoints(party('a'), party('b', { storyPoints: 5 }))).toBeNull();
  });

  // The legacy world settings arrive in the same shape, and may be undefined on a new world.
  test("tolerates missing fields", () => {
    expect(carriedPoints({ system: { storyPoints: 2 } }, { system: {} }))
      .toEqual({ 'system.storyPoints': 2, 'system.gmPoints': 0 });
    expect(carriedPoints(undefined, undefined)).toBeNull();
  });
});

describe("preventLastPartyDelete", () => {
  beforeEach(() => {
    global.ui.notifications.warn.mockClear();
  });

  test("refuses to delete the only Party, and says so", () => {
    const only = party('a');
    global.game.actors = { filter: fn => [only].filter(fn) };
    expect(preventLastPartyDelete(only)).toBe(true);
    expect(global.ui.notifications.warn).toHaveBeenCalledWith('E20.PartyCannotDeleteLast');
  });

  test("lets a Party go when another remains", () => {
    global.game.actors = { filter: fn => [party('a'), party('b')].filter(fn) };
    expect(preventLastPartyDelete(party('a'))).toBe(false);
    expect(global.ui.notifications.warn).not.toHaveBeenCalled();
  });

  test("has no opinion about other actor types", () => {
    global.game.actors = { filter: () => [] };
    expect(preventLastPartyDelete({ type: 'playerCharacter' })).toBe(false);
  });
});

describe("handlePartyDeleted", () => {
  let settings;

  beforeEach(() => {
    settings = { primaryParty: 'a' };
    global.game.user = { id: 'gm', isGM: true };
    global.game.users = { activeGM: { id: 'gm' } };
    global.game.settings.get = jest.fn((scope, key) => settings[key]);
    global.game.settings.set = jest.fn(async (scope, key, value) => {
      settings[key] = value;
    });
    global.ui.notifications.info.mockClear();
  });

  test("pins the next Party and carries the points over when the primary goes", async () => {
    const gone = party('a', { storyPoints: 3, gmPoints: 1 });
    const next = party('b', { sort: 5, storyPoints: 1 });
    global.game.actors = { filter: fn => [next].filter(fn) };

    await handlePartyDeleted(gone);

    expect(next.update).toHaveBeenCalledWith({ 'system.storyPoints': 4, 'system.gmPoints': 1 });
    expect(settings.primaryParty).toBe('b');
    expect(global.ui.notifications.info).toHaveBeenCalled();
  });

  test("does nothing when a non-primary Party goes", async () => {
    const next = party('b');
    global.game.actors = { filter: fn => [party('a'), next].filter(fn) };

    await handlePartyDeleted(party('c'));

    expect(next.update).not.toHaveBeenCalled();
    expect(settings.primaryParty).toBe('a');
  });

  // A player who owns a Party can delete it; the pin is a world setting only a GM can write.
  test("only the active GM acts", async () => {
    global.game.user = { id: 'player', isGM: false };
    const next = party('b');
    global.game.actors = { filter: fn => [next].filter(fn) };

    await handlePartyDeleted(party('a', { storyPoints: 3 }));

    expect(next.update).not.toHaveBeenCalled();
    expect(settings.primaryParty).toBe('a');
  });

  test("an empty pool is not written onto the next Party", async () => {
    const next = party('b');
    global.game.actors = { filter: fn => [next].filter(fn) };

    await handlePartyDeleted(party('a'));

    expect(next.update).not.toHaveBeenCalled();
    expect(settings.primaryParty).toBe('b');
  });
});

describe("visibleToPlayers", () => {
  beforeAll(() => {
    global.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { NONE: 0, LIMITED: 1, OBSERVER: 2, OWNER: 3 } };
  });

  // A document a player has no permission on is never sent to their client at all.
  test("raises None to Observer", () => {
    expect(visibleToPlayers({ ownership: { default: 0 } })).toEqual({ "ownership.default": 2 });
  });

  test("leaves anything the GM set higher alone", () => {
    expect(visibleToPlayers({ ownership: { default: 1 } })).toBeNull();
    expect(visibleToPlayers({ ownership: { default: 3 } })).toBeNull();
  });
});

describe("preventPrimaryDeleteByPlayer", () => {
  beforeEach(() => {
    global.game.settings.get = jest.fn((scope, key) => (key === 'primaryParty' ? 'a' : undefined));
    global.ui.notifications.warn.mockClear();
  });

  // The pin is a world setting only a GM can rewrite; a player deleting the primary with no GM
  // connected would leave the points nowhere.
  test("a player cannot delete the primary, and is told so", () => {
    global.game.user = { isGM: false };
    expect(preventPrimaryDeleteByPlayer(party('a'))).toBe(true);
    expect(global.ui.notifications.warn).toHaveBeenCalledWith('E20.PartyCannotDeletePrimary');
  });

  test("a player may delete a Party that is not the primary", () => {
    global.game.user = { isGM: false };
    expect(preventPrimaryDeleteByPlayer(party('b'))).toBe(false);
  });

  test("a GM may delete the primary", () => {
    global.game.user = { isGM: true };
    expect(preventPrimaryDeleteByPlayer(party('a'))).toBe(false);
  });

  test("has no opinion about other actor types", () => {
    global.game.user = { isGM: false };
    expect(preventPrimaryDeleteByPlayer({ id: 'a', type: 'playerCharacter' })).toBe(false);
  });
});
