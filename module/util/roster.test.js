import { dropRemovedRosterEntries, rosterRemoval, rosterRemovalUpdate } from "./roster.mjs";

/** Removing a roster entry from an unlinked token's actor, which can't delete what its base actor has. */

test("a world actor deletes the entry; a token's actor nulls it", () => {
  expect(rosterRemoval({ isToken: false })).toBeInstanceOf(foundry.data.operators.ForcedDeletion);
  expect(rosterRemoval({ isToken: true })).toBeNull();
  expect(rosterRemovalUpdate({ isToken: true }, ['a', 'b'])).toEqual({ 'system.actors.a': null, 'system.actors.b': null });
});

test("prepared data drops the nulled entries and keeps the rest", () => {
  const system = { actors: { a: null, b: { uuid: 'Actor.x' }, c: undefined } };
  dropRemovedRosterEntries(system);
  expect(system.actors).toEqual({ b: { uuid: 'Actor.x' } });
  expect(() => dropRemovedRosterEntries({})).not.toThrow();
});
