import { jest } from '@jest/globals';
import { getNotOnMyWatchDefenseBonus, grantNotOnMyWatchReaction, hasDefeatedAllyInReach } from './not-on-my-watch.mjs';

const NOT_ON_MY_WATCH_ID = "Compendium.essence20.intercontinental_adventures.Item.xH3iQ0NcXp1eFO35";

global.canvas = {
  tokens: { placeables: [] },
  grid: { measurePath: jest.fn(() => ({ distance: 0 })) },
};

function makeActorToken(disposition = 1) {
  return { document: { disposition }, center: {} };
}

function makeAllyToken({ defeated = false, disposition = 1 } = {}) {
  return {
    actor: { statuses: new Set(defeated ? ['defeated'] : []) },
    document: { disposition },
    center: {},
  };
}

describe("hasDefeatedAllyInReach", () => {
  beforeEach(() => {
    canvas.tokens.placeables = [];
    canvas.grid.measurePath.mockReturnValue({ distance: 0 });
  });

  test("true when a Defeated ally is within 5ft", () => {
    const actorToken = makeActorToken();
    const actor = { getActiveTokens: jest.fn(() => [actorToken]) };
    canvas.tokens.placeables = [actorToken, makeAllyToken({ defeated: true })];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(hasDefeatedAllyInReach(actor)).toBe(true);
  });

  test("false when the Defeated ally is beyond 5ft", () => {
    const actorToken = makeActorToken();
    const actor = { getActiveTokens: jest.fn(() => [actorToken]) };
    canvas.tokens.placeables = [actorToken, makeAllyToken({ defeated: true })];
    canvas.grid.measurePath.mockReturnValue({ distance: 10 });

    expect(hasDefeatedAllyInReach(actor)).toBe(false);
  });

  test("false when no nearby ally is Defeated", () => {
    const actorToken = makeActorToken();
    const actor = { getActiveTokens: jest.fn(() => [actorToken]) };
    canvas.tokens.placeables = [actorToken, makeAllyToken({ defeated: false })];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(hasDefeatedAllyInReach(actor)).toBe(false);
  });

  test("false when the only Defeated token is an enemy, not an ally", () => {
    const actorToken = makeActorToken(1);
    const actor = { getActiveTokens: jest.fn(() => [actorToken]) };
    canvas.tokens.placeables = [actorToken, makeAllyToken({ defeated: true, disposition: -1 })];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(hasDefeatedAllyInReach(actor)).toBe(false);
  });

  test("false with no token on the scene at all", () => {
    const actor = { getActiveTokens: jest.fn(() => []) };
    expect(hasDefeatedAllyInReach(actor)).toBe(false);
  });
});

describe("getNotOnMyWatchDefenseBonus", () => {
  beforeEach(() => {
    canvas.tokens.placeables = [];
  });

  test("+1 for Toughness and Evasion while a Defeated ally is in Reach", () => {
    const actorToken = makeActorToken();
    const actor = { getActiveTokens: jest.fn(() => [actorToken]) };
    canvas.tokens.placeables = [actorToken, makeAllyToken({ defeated: true })];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(getNotOnMyWatchDefenseBonus(actor, 'toughness')).toBe(1);
    expect(getNotOnMyWatchDefenseBonus(actor, 'evasion')).toBe(1);
  });

  test("0 for a different Defense type", () => {
    const actorToken = makeActorToken();
    const actor = { getActiveTokens: jest.fn(() => [actorToken]) };
    canvas.tokens.placeables = [actorToken, makeAllyToken({ defeated: true })];
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });

    expect(getNotOnMyWatchDefenseBonus(actor, 'willpower')).toBe(0);
  });

  test("0 with no Defeated ally in Reach", () => {
    const actorToken = makeActorToken();
    const actor = { getActiveTokens: jest.fn(() => [actorToken]) };
    canvas.tokens.placeables = [actorToken];
    canvas.grid.measurePath.mockReturnValue({ distance: 0 });

    expect(getNotOnMyWatchDefenseBonus(actor, 'toughness')).toBe(0);
  });
});

describe("grantNotOnMyWatchReaction", () => {
  function makeHolderToken({ hasPerk = true, disposition = 1, distance = 5 } = {}) {
    const holderActor = {
      name: 'Reactor',
      items: hasPerk ? [{ type: 'perk', flags: { core: { sourceId: NOT_ON_MY_WATCH_ID } } }] : [],
    };
    canvas.grid.measurePath.mockReturnValueOnce({ distance });
    return { actor: holderActor, document: { disposition }, center: {}, holderActor };
  }

  beforeEach(() => {
    canvas.tokens.placeables = [];
    ChatMessage.create.mockClear();
  });

  test("posts a chat prompt for a nearby ally holding Not On My Watch", async () => {
    const defeatedToken = makeActorToken();
    const defeatedActor = { name: 'Fallen Ally', getActiveTokens: jest.fn(() => [defeatedToken]) };
    const holderToken = makeHolderToken();
    canvas.tokens.placeables = [defeatedToken, holderToken];

    await grantNotOnMyWatchReaction(defeatedActor);

    expect(ChatMessage.create).toHaveBeenCalledTimes(1);
    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      content: 'E20.NotOnMyWatchReactionPrompt',
    }));
  });

  test("doesn't prompt a nearby ally without the Perk", async () => {
    const defeatedToken = makeActorToken();
    const defeatedActor = { name: 'Fallen Ally', getActiveTokens: jest.fn(() => [defeatedToken]) };
    const holderToken = makeHolderToken({ hasPerk: false });
    canvas.tokens.placeables = [defeatedToken, holderToken];

    await grantNotOnMyWatchReaction(defeatedActor);

    expect(ChatMessage.create).not.toHaveBeenCalled();
  });

  test("doesn't prompt an enemy even if it happens to hold the Perk", async () => {
    const defeatedToken = makeActorToken(1);
    const defeatedActor = { name: 'Fallen Ally', getActiveTokens: jest.fn(() => [defeatedToken]) };
    const holderToken = makeHolderToken({ disposition: -1 });
    canvas.tokens.placeables = [defeatedToken, holderToken];

    await grantNotOnMyWatchReaction(defeatedActor);

    expect(ChatMessage.create).not.toHaveBeenCalled();
  });

  test("prompts every eligible ally when more than one holds the Perk", async () => {
    const defeatedToken = makeActorToken();
    const defeatedActor = { name: 'Fallen Ally', getActiveTokens: jest.fn(() => [defeatedToken]) };
    const holderToken1 = makeHolderToken();
    const holderToken2 = makeHolderToken();
    canvas.tokens.placeables = [defeatedToken, holderToken1, holderToken2];

    await grantNotOnMyWatchReaction(defeatedActor);

    expect(ChatMessage.create).toHaveBeenCalledTimes(2);
  });

  test("does nothing when the actor has no token on the scene", async () => {
    const defeatedActor = { name: 'Fallen Ally', getActiveTokens: jest.fn(() => []) };

    await grantNotOnMyWatchReaction(defeatedActor);

    expect(ChatMessage.create).not.toHaveBeenCalled();
  });
});
