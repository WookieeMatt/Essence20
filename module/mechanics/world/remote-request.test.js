import { jest } from '@jest/globals';
import {
  handleRemoteChoiceRequest, handleRemoteChoiceResponse, registerRemotePrompt, requestChoiceFromUser,
} from './remote-request.mjs';

let nextId = 0;
global.foundry.utils.randomID = () => `id${nextId++}`;

function makeSocket() {
  return { emit: jest.fn() };
}

describe("requestChoiceFromUser / handleRemoteChoiceResponse", () => {
  let originalGame;
  beforeEach(() => {
    originalGame = global.game;
    global.game = { ...originalGame, socket: makeSocket(), user: { id: 'me' } };
    jest.useFakeTimers();
  });
  afterEach(() => {
    global.game = originalGame;
    jest.useRealTimers();
  });

  test("emits a remoteChoiceRequest with a unique requestId and the given targetUserId/promptType/payload", () => {
    requestChoiceFromUser('user2', 'chooseDefense', { foo: 'bar' });

    expect(game.socket.emit).toHaveBeenCalledWith('system.essence20', expect.objectContaining({
      action: 'remoteChoiceRequest',
      targetUserId: 'user2',
      promptType: 'chooseDefense',
      payload: { foo: 'bar' },
      requestId: expect.any(String),
    }));
  });

  test("resolves with the answer once a matching response arrives", async () => {
    const promise = requestChoiceFromUser('user2', 'chooseDefense', {});
    const { requestId } = game.socket.emit.mock.calls[0][1];

    handleRemoteChoiceResponse({ requestId, answer: 'toughness' });

    expect(await promise).toBe('toughness');
  });

  test("ignores a response for a different, unrelated requestId", async () => {
    const promise = requestChoiceFromUser('user2', 'chooseDefense', {});
    const { requestId } = game.socket.emit.mock.calls[0][1];

    handleRemoteChoiceResponse({ requestId: 'some-other-id', answer: 'evasion' });
    handleRemoteChoiceResponse({ requestId, answer: 'toughness' });

    expect(await promise).toBe('toughness');
  });

  test("resolves null on timeout when nobody ever responds", async () => {
    const promise = requestChoiceFromUser('user2', 'chooseDefense', {}, 1000);

    jest.advanceTimersByTime(1000);

    expect(await promise).toBeNull();
  });

  test("a late response after timeout is safely ignored (no crash, no double-resolve)", async () => {
    const promise = requestChoiceFromUser('user2', 'chooseDefense', {}, 1000);
    const { requestId } = game.socket.emit.mock.calls[0][1];

    jest.advanceTimersByTime(1000);
    expect(await promise).toBeNull();

    expect(() => handleRemoteChoiceResponse({ requestId, answer: 'toughness' })).not.toThrow();
  });
});

describe("handleRemoteChoiceRequest", () => {
  let originalGame;
  beforeEach(() => {
    originalGame = global.game;
    global.game = { ...originalGame, socket: makeSocket(), user: { id: 'me' } };
  });
  afterEach(() => {
    global.game = originalGame;
  });

  test("ignores a request addressed to a different user", async () => {
    const handler = jest.fn();
    registerRemotePrompt('testPromptIgnored', handler);

    await handleRemoteChoiceRequest({ requestId: 'r1', targetUserId: 'someoneElse', promptType: 'testPromptIgnored', payload: {} });

    expect(handler).not.toHaveBeenCalled();
    expect(game.socket.emit).not.toHaveBeenCalled();
  });

  test("calls the registered handler and emits its answer back as a remoteChoiceResponse", async () => {
    const handler = jest.fn(async (payload) => `answered:${payload.value}`);
    registerRemotePrompt('testPromptAnswered', handler);

    await handleRemoteChoiceRequest({
      requestId: 'r2', targetUserId: 'me', promptType: 'testPromptAnswered', payload: { value: 42 },
    });

    expect(handler).toHaveBeenCalledWith({ value: 42 });
    expect(game.socket.emit).toHaveBeenCalledWith('system.essence20', {
      action: 'remoteChoiceResponse', requestId: 'r2', answer: 'answered:42',
    });
  });

  test("answers null for an unregistered promptType rather than throwing", async () => {
    await handleRemoteChoiceRequest({
      requestId: 'r3', targetUserId: 'me', promptType: 'noSuchPrompt', payload: {},
    });

    expect(game.socket.emit).toHaveBeenCalledWith('system.essence20', {
      action: 'remoteChoiceResponse', requestId: 'r3', answer: null,
    });
  });
});
