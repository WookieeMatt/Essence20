import { healStoredDescriptions, importedDescription, invalidateImportedDescriptions, liveCount } from "./book-descriptions-store.mjs";

/** Imported book descriptions that outlive an update which moves or replaces their items. */

const uuid = (pack, id) => `Compendium.essence20.${pack}.Item.${id}`;
const MOVED = uuid('pr_crb', 'iVpoqL7ZY4SK4iLc');

test("an entry whose item moved or was replaced is re-keyed to where it is now; one with no trace stays and is counted", () => {
  const stored = {
    'A Book': {
      purchaser: 'Someone',
      descriptions: {
        [uuid('book', 'aaaaaaaaaaaaaaaa')]: 'still there',
        [MOVED]: 'moved by the map',
        [uuid('old', 'bbbbbbbbbbbbbbbb')]: 'same id, other pack',
        [uuid('book', 'cccccccccccccccc')]: 'replaced, found by name',
        [uuid('book', 'dddddddddddddddd')]: 'gone',
      },
      items: { [uuid('book', 'cccccccccccccccc')]: { name: 'Sharp Eye', type: 'perk' } },
    },
  };
  const live = new Set([
    uuid('book', 'aaaaaaaaaaaaaaaa'), uuid('jump_through_time', 'iVpoqL7ZY4SK4iLc'),
    uuid('new', 'bbbbbbbbbbbbbbbb'), uuid('book', 'eeeeeeeeeeeeeeee'),
  ]);
  const result = healStoredDescriptions(stored, {
    exists: id => live.has(id),
    moved: id => (id == MOVED ? uuid('jump_through_time', 'iVpoqL7ZY4SK4iLc') : null),
    byId: id => (id == 'bbbbbbbbbbbbbbbb' ? uuid('new', 'bbbbbbbbbbbbbbbb') : null),
    byName: (book, name, type) => (book == 'A Book' && name == 'Sharp Eye' && type == 'perk' ? uuid('book', 'eeeeeeeeeeeeeeee') : null),
  });

  expect(result.healed).toBe(3);
  expect(result.dead).toBe(1);
  const book = result.stored['A Book'];
  expect(book.purchaser).toBe('Someone');
  expect(book.descriptions).toEqual({
    [uuid('book', 'aaaaaaaaaaaaaaaa')]: 'still there',
    [uuid('jump_through_time', 'iVpoqL7ZY4SK4iLc')]: 'moved by the map',
    [uuid('new', 'bbbbbbbbbbbbbbbb')]: 'same id, other pack',
    [uuid('book', 'eeeeeeeeeeeeeeee')]: 'replaced, found by name',
    [uuid('book', 'dddddddddddddddd')]: 'gone',
  });
  expect(book.items).toEqual({ [uuid('book', 'eeeeeeeeeeeeeeee')]: { name: 'Sharp Eye', type: 'perk' } });
  expect(liveCount(book, id => live.has(id))).toBe(4);
});

test("nothing to heal leaves it as it was", () => {
  const stored = { B: { descriptions: { [uuid('b', 'x')]: 't' } } };
  expect(healStoredDescriptions(stored, { exists: () => true })).toEqual({ stored, healed: 0, dead: 0 });
});

test("an empty store read before the world is ready isn't kept: the real one is read once it is", () => {
  const settings = { value: {} };
  const previous = { ready: game.ready, settings: game.settings };
  game.settings = { get: () => settings.value };
  game.ready = false;
  invalidateImportedDescriptions();
  expect(importedDescription(uuid('b', 'x'))).toBeNull();

  settings.value = { B: { descriptions: { [uuid('b', 'x')]: 'text' } } };
  game.ready = true;
  expect(importedDescription(uuid('b', 'x'))).toBe('text');
  // A copy still naming a moved item's old uuid finds it under the new one.
  settings.value = { B: { descriptions: { [uuid('jump_through_time', 'iVpoqL7ZY4SK4iLc')]: 'moved text' } } };
  invalidateImportedDescriptions();
  expect(importedDescription(MOVED)).toBe('moved text');

  Object.assign(game, previous);
  invalidateImportedDescriptions();
});
