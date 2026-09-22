import { jest } from '@jest/globals';
import { chooseDefenderDefense, hasSceneDefenseBoost, promptDefenseChoice } from './defense-choice.mjs';
import { handleRemoteChoiceResponse } from './remote-request.mjs';

global.foundry.applications.api.DialogV2 = { wait: jest.fn() };
global.foundry.utils.randomID = () => `id${Math.random()}`;
global.CONFIG = {
  E20: {
    defenses: {
      toughness: 'E20.DefenseToughness', evasion: 'E20.DefenseEvasion',
      willpower: 'E20.DefenseWillpower', cleverness: 'E20.DefenseCleverness',
    },
  },
};

function makeTargetActor({ ownerId = null } = {}) {
  return {
    name: 'Target',
    system: { defenses: { toughness: { value: 15 }, evasion: { value: 12 }, willpower: { value: 10 }, cleverness: { value: 8 } } },
    testUserPermission: (user) => !!ownerId && user.id == ownerId,
  };
}

describe("promptDefenseChoice", () => {
  beforeEach(() => {
    global.foundry.applications.api.DialogV2.wait.mockReset();
  });

  test("returns the chosen Defense", async () => {
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue('evasion');
    const answer = await promptDefenseChoice({
      actorName: 'Target', attackerName: 'Foe', suggestedDefenseType: 'toughness',
      defenses: { toughness: 15, evasion: 12, willpower: 10, cleverness: 8 },
    });

    expect(answer.defenseType).toBe('evasion');
  });

  test("falls back to the suggested Defense if the dialog is dismissed with no choice", async () => {
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue(null);
    const answer = await promptDefenseChoice({
      actorName: 'Target', attackerName: 'Foe', suggestedDefenseType: 'toughness',
      defenses: { toughness: 15, evasion: 12, willpower: 10, cleverness: 8 },
    });

    expect(answer.defenseType).toBe('toughness');
  });

  test("builds one button per Defense, marking the suggested one default", async () => {
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue('toughness');
    await promptDefenseChoice({
      actorName: 'Target', attackerName: 'Foe', suggestedDefenseType: 'evasion',
      defenses: { toughness: 15, evasion: 12, willpower: 10, cleverness: 8 },
    });

    const { buttons } = global.foundry.applications.api.DialogV2.wait.mock.calls[0][0];
    expect(buttons).toHaveLength(4);
    expect(buttons.find(b => b.action == 'evasion').default).toBe(true);
    expect(buttons.find(b => b.action == 'toughness').default).toBe(false);
  });
});

describe("chooseDefenderDefense", () => {
  let originalGame;
  beforeEach(() => {
    originalGame = global.game;
    global.foundry.applications.api.DialogV2.wait.mockReset();
    global.game = { ...originalGame, socket: { emit: jest.fn() } };
  });
  afterEach(() => {
    global.game = originalGame;
  });

  test("decides locally (no socket round-trip) when the current user IS the target's own owner", async () => {
    global.game.user = { id: 'player1', isGM: false };
    global.game.users = [{ id: 'player1', isGM: false, active: true }];
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue('evasion');
    const target = makeTargetActor({ ownerId: 'player1' });

    const answer = await chooseDefenderDefense(target, { attackerName: 'Foe', suggestedDefenseType: 'toughness' });

    expect(answer.defenseType).toBe('evasion');
    expect(global.game.socket.emit).not.toHaveBeenCalled();
  });

  test("sends a remote request to a different connected owner and returns their answer", async () => {
    global.game.user = { id: 'gm1', isGM: true };
    global.game.users = [
      { id: 'gm1', isGM: true, active: true },
      { id: 'player1', isGM: false, active: true },
    ];
    const target = makeTargetActor({ ownerId: 'player1' });

    const promise = chooseDefenderDefense(target, { attackerName: 'Foe', suggestedDefenseType: 'toughness' });
    const { requestId, targetUserId } = global.game.socket.emit.mock.calls[0][1];
    expect(targetUserId).toBe('player1');
    handleRemoteChoiceResponse({ requestId, answer: 'willpower' });

    expect((await promise).defenseType).toBe('willpower');
  });

  test("falls back to the local GM dialog when the remote owner never answers", async () => {
    jest.useFakeTimers();
    global.game.user = { id: 'gm1', isGM: true };
    global.game.users = [
      { id: 'gm1', isGM: true, active: true },
      { id: 'player1', isGM: false, active: true },
    ];
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue('cleverness');
    const target = makeTargetActor({ ownerId: 'player1' });

    const promise = chooseDefenderDefense(target, { attackerName: 'Foe', suggestedDefenseType: 'toughness' });
    jest.advanceTimersByTime(60000);
    // Flushes the microtask queue so the timeout's own Promise resolution (and everything
    // chained after it inside chooseDefenderDefense) actually runs before this test reads it -
    // jest.advanceTimersByTimeAsync isn't available in this project's jest version.
    await Promise.resolve();
    await Promise.resolve();

    expect((await promise).defenseType).toBe('cleverness');
    jest.useRealTimers();
  });

  test("decides locally when there's no player owner and the current user is the GM", async () => {
    global.game.user = { id: 'gm1', isGM: true };
    global.game.users = [{ id: 'gm1', isGM: true, active: true }];
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue('toughness');
    const target = makeTargetActor(); // no owner at all - a plain NPC

    const answer = await chooseDefenderDefense(target, { attackerName: 'Foe', suggestedDefenseType: 'toughness' });

    expect(answer.defenseType).toBe('toughness');
    expect(global.game.socket.emit).not.toHaveBeenCalled();
  });

  test("sends a remote request to a connected GM when there's no owner and the current user isn't a GM", async () => {
    global.game.user = { id: 'player1', isGM: false };
    global.game.users = [
      { id: 'player1', isGM: false, active: true },
      { id: 'gm1', isGM: true, active: true },
    ];
    const target = makeTargetActor(); // no owner - an NPC the player is attacking

    const promise = chooseDefenderDefense(target, { attackerName: 'Player1Char', suggestedDefenseType: 'toughness' });
    const { requestId, targetUserId } = global.game.socket.emit.mock.calls[0][1];
    expect(targetUserId).toBe('gm1');
    handleRemoteChoiceResponse({ requestId, answer: 'evasion' });

    expect((await promise).defenseType).toBe('evasion');
  });

  test("falls back to the suggested Defense when nobody at all is available to decide", async () => {
    global.game.user = { id: 'player1', isGM: false };
    global.game.users = [{ id: 'player1', isGM: false, active: true }];
    const target = makeTargetActor(); // no owner, no GM connected

    const answer = await chooseDefenderDefense(target, { attackerName: 'Foe', suggestedDefenseType: 'willpower' });

    expect(answer.defenseType).toBe('willpower');
    expect(global.game.socket.emit).not.toHaveBeenCalled();
  });
});

describe("the Story Point Defense boost", () => {
  const originalSettingsGet = global.game.settings.get;
  const originalFromUuid = global.fromUuid;

  afterEach(() => {
    global.game.settings.get = originalSettingsGet;
    global.fromUuid = originalFromUuid;
  });

  // My Little Pony's "+5 to any single Defense for the scene" outlives the attack it was bought
  // against, so it is recorded with the scene it was bought in.
  test("hasSceneDefenseBoost: only the boosted Defense, only in the scene it was bought", () => {
    global.game.settings.get = jest.fn(() => 7);
    const actor = { getFlag: jest.fn(() => ({ defenseType: 'evasion', epoch: 7 })) };
    expect(hasSceneDefenseBoost(actor, 'evasion')).toBe(true);
    expect(hasSceneDefenseBoost(actor, 'toughness')).toBe(false);
    global.game.settings.get = jest.fn(() => 8);
    expect(hasSceneDefenseBoost(actor, 'evasion')).toBe(false);
    expect(hasSceneDefenseBoost({ getFlag: () => undefined }, 'evasion')).toBe(false);
  });

  test("a boosted answer spends the point and, in My Little Pony, records the scene flag", async () => {
    global.game.settings.get = jest.fn(() => 'myLittlePony');
    global.game.users = [];
    global.game.user = { id: 'p1', isGM: false };
    global.game.socket = { emit: jest.fn() };
    global.ChatMessage = { create: jest.fn(), getSpeaker: jest.fn(() => ({})) };
    const party = { isOwner: true, system: { storyPoints: 2, gmPoints: 0 }, update: jest.fn(async () => {}) };
    global.game.actors = { party };
    const defender = { type: 'playerCharacter', name: 'Rarity', setFlag: jest.fn(async () => {}) };
    global.fromUuid = jest.fn(async () => defender);
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue({ defenseType: 'evasion', storyPointBoost: true });

    const answer = await promptDefenseChoice({ actorUuid: 'Actor.r', actorName: 'Rarity', attackerName: 'Foe', suggestedDefenseType: 'toughness', defenses: { toughness: 15, evasion: 12, willpower: 10, cleverness: 8 } });

    expect(answer).toEqual({ defenseType: 'evasion', storyPointBoost: true });
    expect(party.update).toHaveBeenCalledWith({ 'system.storyPoints': 1 });
    expect(defender.setFlag).toHaveBeenCalledWith('essence20', 'storyPointDefenseBoost', expect.objectContaining({ defenseType: 'evasion' }));
  });

  test("outside My Little Pony the boost is spent but not remembered", async () => {
    global.game.settings.get = jest.fn(() => 'giJoe');
    global.game.users = [];
    global.game.user = { id: 'p1', isGM: false };
    global.ChatMessage = { create: jest.fn(), getSpeaker: jest.fn(() => ({})) };
    const party = { isOwner: true, system: { storyPoints: 2, gmPoints: 0 }, update: jest.fn(async () => {}) };
    global.game.actors = { party };
    const defender = { type: 'playerCharacter', name: 'Duke', setFlag: jest.fn(async () => {}) };
    global.fromUuid = jest.fn(async () => defender);
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue({ defenseType: 'toughness', storyPointBoost: true });

    await promptDefenseChoice({ actorUuid: 'Actor.d', actorName: 'Duke', attackerName: 'Foe', suggestedDefenseType: 'toughness', defenses: { toughness: 15, evasion: 12, willpower: 10, cleverness: 8 } });

    expect(party.update).toHaveBeenCalled();
    expect(defender.setFlag).not.toHaveBeenCalled();
  });
});
