import { jest } from '@jest/globals';
import { cleanGoneRosterEntries, goneKeys, isLocalActorUuid, removeFromRosters } from './roster-refs.mjs';

/** A deleted actor's card left on a roster (a Zord's crew, a Megaform's members) - taken off. */

test("only world and token actors are judged, never a compendium entry", () => {
  expect(isLocalActorUuid('Actor.abc123')).toBe(true);
  expect(isLocalActorUuid('Scene.s1.Token.t1.Actor.a1')).toBe(true);
  expect(isLocalActorUuid('Compendium.essence20.pr_crb.Actor.x')).toBe(false);
  expect(isLocalActorUuid(undefined)).toBe(false);
});

test("the keys whose actor is gone", () => {
  const zord = { system: { actors: { a: { uuid: 'Actor.here' }, b: { uuid: 'Actor.gone', vehicleRole: 'driver' }, c: { uuid: 'Compendium.x.y.Actor.z' } } } };
  expect(goneKeys(zord, uuid => uuid != 'Actor.here')).toEqual(['b']);
});

describe('on the world', () => {
  let zord;
  let megaform;
  beforeEach(() => {
    zord = { system: { actors: { k1: { uuid: 'Actor.ranger' } } }, update: jest.fn() };
    megaform = { system: { actors: { p0: { uuid: 'Actor.gone' }, p1: { uuid: 'Actor.zord' } } }, update: jest.fn() };
    const tokenCopy = { system: { actors: { t1: { uuid: 'Scene.s.Token.t.Actor.ranger' } } }, update: jest.fn() };
    global.game.actors = { contents: [zord, megaform] };
    global.game.scenes = { contents: [{ tokens: { contents: [{ actorLink: false, actor: tokenCopy }, { actorLink: true, actor: {} }] } }] };
  });

  test("a deleted actor comes off every roster listing it", async () => {
    await removeFromRosters(new Set(['Actor.ranger']));
    expect(zord.update).toHaveBeenCalledWith({ 'system.actors.k1': expect.any(foundry.data.operators.ForcedDeletion) });
    expect(megaform.update).not.toHaveBeenCalled();
  });

  test("on load, entries for actors already gone are cleaned up", async () => {
    global.fromUuidSync = jest.fn(uuid => (uuid == 'Actor.gone' ? null : {}));
    expect(await cleanGoneRosterEntries()).toBe(1);
    expect(megaform.update).toHaveBeenCalledWith({ 'system.actors.p0': expect.any(foundry.data.operators.ForcedDeletion) });
    expect(zord.update).not.toHaveBeenCalled();
  });
});
