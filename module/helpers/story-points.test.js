import { jest } from '@jest/globals';

import {
  handleStoryPointSpendRequest,
  hasStoryPointsAvailable,
  isGmConnected,
  requestStoryPointSpend,
} from './story-points.mjs';

function mockStoryPoints(value) {
  global.game.settings.get = jest.fn((scope, key) => {
    if (key === 'sptStoryPoints') return value;
    if (key === 'sptGmPoints') return 0;
    return 'roll';
  });
}

beforeEach(() => {
  global.game.socket = { emit: jest.fn() };
  global.game.users = [];
  global.game.user = { isGM: false, id: 'user1' };
  global.game.settings.set = jest.fn();
  global.game.StoryPointsTracker = null;
  global.ChatMessage = { create: jest.fn(), getSpeaker: jest.fn(() => ({})) };
  mockStoryPoints(3);
});

describe("isGmConnected", () => {
  test("true when at least one GM is currently active", () => {
    global.game.users = [{ isGM: true, active: true }, { isGM: false, active: true }];
    expect(isGmConnected()).toBe(true);
  });

  test("false when no active user is a GM", () => {
    global.game.users = [{ isGM: true, active: false }, { isGM: false, active: true }];
    expect(isGmConnected()).toBe(false);
  });
});

describe("hasStoryPointsAvailable", () => {
  test("compares the world pool against the requested amount", () => {
    mockStoryPoints(2);
    expect(hasStoryPointsAvailable(2)).toBe(true);
    expect(hasStoryPointsAvailable(3)).toBe(false);
  });

  test("defaults to requesting 1", () => {
    mockStoryPoints(0);
    expect(hasStoryPointsAvailable()).toBe(false);
  });
});

describe("requestStoryPointSpend", () => {
  test("emits a spend request over the socket - fire and forget", () => {
    requestStoryPointSpend({ name: "Duke" }, 2);
    expect(global.game.socket.emit).toHaveBeenCalledWith("system.essence20", {
      action: "spendStoryPoints",
      amount: 2,
      actorName: "Duke",
    });
  });
});

describe("handleStoryPointSpendRequest", () => {
  test("is a no-op on a client that isn't the GM", () => {
    global.game.user.isGM = false;

    handleStoryPointSpendRequest({ action: "spendStoryPoints", amount: 1, actorName: "Duke" });

    expect(global.game.settings.set).not.toHaveBeenCalled();
    expect(global.game.socket.emit).not.toHaveBeenCalled();
  });

  test("denies and warns when the shared pool can't afford it", () => {
    global.game.user.isGM = true;
    mockStoryPoints(0);

    handleStoryPointSpendRequest({ action: "spendStoryPoints", amount: 1, actorName: "Duke" });

    expect(global.game.settings.set).not.toHaveBeenCalled();
    expect(global.ui.notifications.warn).toHaveBeenCalled();
  });

  test("spends, broadcasts the new total, and announces when the GM can afford it", () => {
    global.game.user.isGM = true;
    mockStoryPoints(3);

    handleStoryPointSpendRequest({ action: "spendStoryPoints", amount: 1, actorName: "Duke" });

    expect(global.game.settings.set).toHaveBeenCalledWith("essence20", "sptStoryPoints", 2);
    expect(global.game.socket.emit).toHaveBeenCalledWith("system.essence20", { gmPoints: 0, storyPoints: 2 });
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("updates the GM's own open tracker window directly (the broadcast doesn't loop back)", () => {
    global.game.user.isGM = true;
    global.game.StoryPointsTracker = { _storyPoints: 3, render: jest.fn() };
    mockStoryPoints(3);

    handleStoryPointSpendRequest({ action: "spendStoryPoints", amount: 1, actorName: "Duke" });

    expect(global.game.StoryPointsTracker._storyPoints).toBe(2);
    expect(global.game.StoryPointsTracker.render).toHaveBeenCalledWith(false);
  });

  test("defaults to spending 1 when amount is missing", () => {
    global.game.user.isGM = true;
    mockStoryPoints(3);

    handleStoryPointSpendRequest({ action: "spendStoryPoints", actorName: "Duke" });

    expect(global.game.settings.set).toHaveBeenCalledWith("essence20", "sptStoryPoints", 2);
  });
});
