import { actorMidBuild, whilePreparing } from "./token-actor.mjs";

/** Reading an unlinked token's actor from inside that actor's own data preparation (Foundry v14's lazy ActorDelta). */

// A token the way v14 makes one: token.delta starts as a getter that builds the delta and its synthetic actor -
// preparing it on the way - and only replaces itself with the result once that has returned. Its actor getter is
// Essence20TokenDocument#actor's.
function fakeToken(prepare) {
  const token = {
    actorLink: false,
    builds: 0,
    get actor() {
      return actorMidBuild(this) ? null : this.delta.syntheticActor;
    },
  };
  Object.defineProperty(token, 'delta', {
    configurable: true,
    get() {
      token.builds++;
      const actor = { token };
      whilePreparing(token, () => prepare(actor));
      const delta = { syntheticActor: actor };
      Object.defineProperty(token, 'delta', { value: delta, configurable: true, writable: true });
      return delta;
    },
  });
  return token;
}

test("an actor scanning its own token while it is built gets null, once, instead of building itself again", () => {
  const seen = [];
  const token = fakeToken(() => seen.push(token.actor));
  const actor = token.actor;
  expect(token.builds).toBe(1);
  expect(seen).toEqual([null]);
  expect(actor.token).toBe(token);
});

test("another token built inside the scan prepares normally and can't loop back on either", () => {
  const order = [];
  const other = fakeToken(() => order.push(['other sees first', first.actor, other.actor]));
  const first = fakeToken(() => order.push(['first sees other', other.actor?.token ?? null]));
  first.actor;
  expect(order).toEqual([['other sees first', null, null], ['first sees other', other]]);
  expect(first.builds).toBe(1);
  expect(other.builds).toBe(1);
});

test("once built - a later re-prepare - the token reads its actor as usual", () => {
  let reads = 0;
  const token = fakeToken(() => {});
  const actor = token.actor;
  whilePreparing(token, () => {
    reads++;
    expect(actorMidBuild(token)).toBe(false);
    expect(token.actor).toBe(actor);
  });
  expect(reads).toBe(1);
});

test("linked tokens, unmarked tokens and actors with no token are left alone", () => {
  const linked = { actorLink: true };
  Object.defineProperty(linked, 'delta', { get: () => null });
  whilePreparing(linked, () => expect(actorMidBuild(linked)).toBe(false));
  expect(actorMidBuild(fakeToken(() => {}))).toBe(false);
  expect(whilePreparing(null, () => 'ran')).toBe('ran');
});

test("the mark comes off even when preparation throws, and nesting keeps the outer mark", () => {
  const token = fakeToken(() => {});
  expect(() => whilePreparing(token, () => {
    throw new Error('boom');
  })).toThrow('boom');
  expect(actorMidBuild(token)).toBe(false);
  whilePreparing(token, () => {
    whilePreparing(token, () => {});
    expect(actorMidBuild(token)).toBe(true);
  });
});
