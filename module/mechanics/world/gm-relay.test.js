import { jest } from "@jest/globals";
import {
  blockedWithoutGm, handleGmRelayDone, handleGmRelayRequest, isRelayAllowed, needsGmRelay, relayToGm, reviveOperators,
} from "./gm-relay.mjs";

const saved = {};
beforeEach(() => {
  saved.user = game.user;
  saved.users = game.users;
  saved.socket = game.socket;
  game.socket = { emit: jest.fn() };
});

afterEach(() => {
  game.user = saved.user;
  game.users = saved.users;
  game.socket = saved.socket;
  fromUuid.mockReset();
});

const npc = (canModify = false) => ({ documentName: 'Actor', uuid: 'Scene.s.Token.t.Actor.a', canUserModify: () => canModify, setFlag: jest.fn(async () => {}) });

describe("needsGmRelay", () => {
  test("a player who can't modify the actor, with a GM online, relays", () => {
    game.user = { id: 'p1', isGM: false };
    game.users = { activeGM: { id: 'gm' } };
    expect(needsGmRelay(npc(false))).toBe(true);
  });

  test("owners, GMs, and a table with no GM online write directly", () => {
    game.users = { activeGM: { id: 'gm' } };
    game.user = { id: 'p1', isGM: false };
    expect(needsGmRelay(npc(true))).toBe(false);

    game.user = { id: 'gm', isGM: true };
    expect(needsGmRelay(npc(false))).toBe(false);

    game.user = { id: 'p1', isGM: false };
    game.users = { activeGM: null };
    expect(needsGmRelay(npc(false))).toBe(false);
  });
});

describe("relaying a write", () => {
  test("sends the call and resolves when the GM confirms it", async () => {
    game.user = { id: 'p1', isGM: false };
    const done = relayToGm(npc(), 'setFlag', ['essence20', 'spotted', true]);
    const sent = game.socket.emit.mock.calls[0][1];
    expect(sent).toMatchObject({ action: 'gmRelay', userId: 'p1', uuid: 'Scene.s.Token.t.Actor.a', method: 'setFlag', args: ['essence20', 'spotted', true] });

    handleGmRelayDone({ requestId: 'someone-elses', userId: 'p2', ok: true });
    handleGmRelayDone({ requestId: sent.requestId, userId: 'p1', ok: true });
    await expect(done).resolves.toBe(true);
  });
});

describe("handleGmRelayRequest (GM side)", () => {
  function gmWithPlayerTargeting(targetUuid) {
    const player = { id: 'p1', name: 'Jeremy', targets: new Set(targetUuid ? [{ actor: { uuid: targetUuid } }] : []) };
    game.users = { activeGM: { isSelf: true }, get: (id) => (id == 'p1' ? player : null) };
    return player;
  }

  test("carries out a write on the actor the player is targeting", async () => {
    const target = npc();
    fromUuid.mockResolvedValue(target);
    gmWithPlayerTargeting(target.uuid);

    const ok = await handleGmRelayRequest({ requestId: 'r1', userId: 'p1', uuid: target.uuid, method: 'setFlag', args: ['essence20', 'spotted', true] });

    expect(ok).toBe(true);
    expect(target.setFlag).toHaveBeenCalledWith('essence20', 'spotted', true);
    expect(game.socket.emit).toHaveBeenCalledWith('system.essence20', { action: 'gmRelayDone', requestId: 'r1', userId: 'p1', ok: true });
  });

  test("refuses an actor the player isn't targeting, or a method outside the list", async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const target = npc();
    fromUuid.mockResolvedValue(target);

    gmWithPlayerTargeting('Actor.somebody-else');
    expect(await handleGmRelayRequest({ requestId: 'r2', userId: 'p1', uuid: target.uuid, method: 'setFlag', args: [] })).toBe(false);

    gmWithPlayerTargeting(target.uuid);
    target.delete = jest.fn();
    expect(await handleGmRelayRequest({ requestId: 'r3', userId: 'p1', uuid: target.uuid, method: 'delete', args: [] })).toBe(false);
    expect(target.delete).not.toHaveBeenCalled();
    expect(target.setFlag).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  test("only the active GM acts", async () => {
    game.users = { activeGM: { isSelf: false } };
    expect(await handleGmRelayRequest({ requestId: 'r4', userId: 'p1', uuid: 'x', method: 'setFlag', args: [] })).toBe(false);
    expect(fromUuid).not.toHaveBeenCalled();
  });

  test("isRelayAllowed matches the targeted token's actor", () => {
    const target = npc();
    expect(isRelayAllowed(target, { targets: new Set([{ document: { actor: { uuid: target.uuid } } }]) })).toBe(true);
    expect(isRelayAllowed(target, { targets: new Set() })).toBe(false);
    expect(isRelayAllowed(target, null)).toBe(false);
  });
});

describe('the wider relay (2026-10-10): items and effects on a target', () => {
  test('an item on the targeted actor can be updated or deleted for the player; the actor itself never deleted', async () => {
    const actor = npc();
    const item = { documentName: 'Item', uuid: actor.uuid + '.Item.i', parent: actor, update: jest.fn(async () => {}), delete: jest.fn(async () => {}) };
    fromUuid.mockResolvedValue(item);
    const player = { id: 'p1', targets: new Set([{ actor }]) };
    game.users = { activeGM: { isSelf: true }, get: () => player };
    game.socket = { emit: jest.fn() };
    expect(await handleGmRelayRequest({ requestId: 'a', userId: 'p1', uuid: item.uuid, method: 'update', args: [{ 'system.x': { '__$OPERATOR$__': 'ForcedDeletion' } }] })).toBe(true);
    expect(item.update.mock.calls[0][0]['system.x']).toBeInstanceOf(foundry.data.operators.ForcedDeletion);
    expect(await handleGmRelayRequest({ requestId: 'b', userId: 'p1', uuid: item.uuid, method: 'delete', args: [] })).toBe(true);
  });
});

test('reviveOperators rebuilds tagged operators anywhere in a value', () => {
  const revived = reviveOperators([{ a: { b: { '__$OPERATOR$__': 'ForcedDeletion' } }, c: [1, 'x'] }]);
  expect(revived[0].a.b).toBeInstanceOf(foundry.data.operators.ForcedDeletion);
  expect(revived[0].c).toEqual([1, 'x']);
});

test('with no GM online, a write the player may not make is skipped - warned once per target', () => {
  const warn = jest.fn();
  global.ui = { notifications: { warn } };
  game.user = { id: 'p1', isGM: false };
  game.users = { activeGM: null };
  const target = npc(false);
  target.name = 'Goon';
  expect(blockedWithoutGm(target)).toBe(true);
  expect(blockedWithoutGm(target)).toBe(true);
  expect(warn).toHaveBeenCalledTimes(1);
  // Something the player owns, or a GM online (the relay then), is never blocked.
  expect(blockedWithoutGm(npc(true))).toBe(false);
  game.users = { activeGM: { id: 'gm' } };
  expect(blockedWithoutGm(target)).toBe(false);
  game.user = { id: 'gm', isGM: true };
  expect(blockedWithoutGm(target)).toBe(false);
});
