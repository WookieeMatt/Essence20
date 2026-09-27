import { jest } from '@jest/globals';

import {
  canWriteStoryPoints,
  getGmPoints,
  getStoryPoints,
  handleStoryPointGrantRequest,
  handleStoryPointSpendRequest,
  hasStoryPointsAvailable,
  isGmConnected,
  ownsStoryPoints,
  requestStoryPointGrant,
  requestStoryPointSpend,
  setGmPoints,
  setStoryPoints,
  hasGmPool,
  sessionResetUpdate,
  poolFor,
  canSpendForActor,
  defenseBoostAfterRoll,
  defenseBoostLastsScene,
  hasGridPowerBloom,
  gridPowerBloomResults,
} from './story-points.mjs';
import { BATTLE_HARDENED_ID } from './battle-hardened.mjs';

/** The primary Party as the pool sees it. `update` writes through so a second read sees it. */
function mockParty({ storyPoints = 3, gmPoints = 0, isOwner = false } = {}) {
  const party = {
    name: 'Strike Team',
    isOwner,
    system: { storyPoints, gmPoints },
    update: jest.fn(async (changes) => {
      if ('system.storyPoints' in changes) party.system.storyPoints = changes['system.storyPoints'];
      if ('system.gmPoints' in changes) party.system.gmPoints = changes['system.gmPoints'];
    }),
  };
  global.game.actors = { party };
  return party;
}

beforeEach(() => {
  global.game.socket = { emit: jest.fn() };
  global.game.users = [];
  global.game.users.activeGM = null;
  global.game.user = { isGM: false, id: 'user1' };
  global.ChatMessage = { create: jest.fn(), getSpeaker: jest.fn(() => ({})) };
  global.ui.notifications.warn.mockClear();
  mockParty();
});

describe("reading the pool", () => {
  test("comes from the primary Party", () => {
    mockParty({ storyPoints: 4, gmPoints: 2 });
    expect(getStoryPoints()).toBe(4);
    expect(getGmPoints()).toBe(2);
  });

  test("is empty when there is no primary Party yet", () => {
    global.game.actors = { party: null };
    expect(getStoryPoints()).toBe(0);
    expect(hasStoryPointsAvailable()).toBe(false);
  });

  test("hasStoryPointsAvailable compares against the requested amount, defaulting to 1", () => {
    mockParty({ storyPoints: 2 });
    expect(hasStoryPointsAvailable(2)).toBe(true);
    expect(hasStoryPointsAvailable(3)).toBe(false);
    mockParty({ storyPoints: 0 });
    expect(hasStoryPointsAvailable()).toBe(false);
  });
});

describe("who can write", () => {
  test("isGmConnected: at least one GM is currently active", () => {
    global.game.users = [{ isGM: true, active: true }, { isGM: false, active: true }];
    expect(isGmConnected()).toBe(true);
    global.game.users = [{ isGM: true, active: false }];
    expect(isGmConnected()).toBe(false);
  });

  test("ownsStoryPoints: this client owns the primary Party", () => {
    mockParty({ isOwner: true });
    expect(ownsStoryPoints()).toBe(true);
    mockParty({ isOwner: false });
    expect(ownsStoryPoints()).toBe(false);
  });

  // The whole reason the pool moved: an owner needs no GM present.
  test("canWriteStoryPoints: an owner with no GM connected", () => {
    mockParty({ isOwner: true });
    global.game.users = [];
    expect(canWriteStoryPoints()).toBe(true);
  });

  test("canWriteStoryPoints: a non-owner with a GM connected", () => {
    mockParty({ isOwner: false });
    global.game.users = [{ isGM: true, active: true }];
    expect(canWriteStoryPoints()).toBe(true);
  });

  test("canWriteStoryPoints: a non-owner with nobody to ask", () => {
    mockParty({ isOwner: false });
    global.game.users = [{ isGM: true, active: false }];
    expect(canWriteStoryPoints()).toBe(false);
  });
});

describe("setStoryPoints / setGmPoints", () => {
  test("an owner writes the Party, floored at zero", async () => {
    const party = mockParty({ isOwner: true });
    expect(await setStoryPoints(-2)).toBe(true);
    expect(party.update).toHaveBeenCalledWith({ 'system.storyPoints': 0 });
  });

  test("a non-owner cannot", async () => {
    const party = mockParty({ isOwner: false });
    expect(await setStoryPoints(5)).toBe(false);
    expect(party.update).not.toHaveBeenCalled();
  });

  // Ownership of the Party is not enough for the GM's own points.
  test("GM points are the GM's, whoever owns the Party", async () => {
    const party = mockParty({ isOwner: true });
    expect(await setGmPoints(2)).toBe(false);
    global.game.user.isGM = true;
    expect(await setGmPoints(2)).toBe(true);
    expect(party.update).toHaveBeenCalledWith({ 'system.gmPoints': 2 });
  });
});

describe("requestStoryPointSpend", () => {
  test("an owner spends directly and announces it", async () => {
    const party = mockParty({ storyPoints: 3, isOwner: true });

    await requestStoryPointSpend({ name: 'Duke' }, 2);

    expect(party.update).toHaveBeenCalledWith({ 'system.storyPoints': 1 });
    expect(global.ChatMessage.create).toHaveBeenCalled();
    expect(global.game.socket.emit).not.toHaveBeenCalled();
  });

  test("an owner is refused when the pool cannot afford it", async () => {
    const party = mockParty({ storyPoints: 1, isOwner: true });

    await requestStoryPointSpend({ name: 'Duke' }, 2);

    expect(party.update).not.toHaveBeenCalled();
    expect(global.ui.notifications.warn).toHaveBeenCalled();
  });

  test("a non-owner asks the GM over the socket - fire and forget", async () => {
    const party = mockParty({ isOwner: false });

    await requestStoryPointSpend({ name: 'Duke' }, 2);

    expect(party.update).not.toHaveBeenCalled();
    expect(global.game.socket.emit).toHaveBeenCalledWith("system.essence20", {
      action: "spendStoryPoints",
      amount: 2,
      actorName: "Duke",
    });
  });

  test("includes the actor's own uuid, for Battle Hardened's own post-spend check", () => {
    requestStoryPointSpend({ name: "Duke", uuid: "Actor.duke1" }, 1);
    expect(global.game.socket.emit).toHaveBeenCalledWith("system.essence20", {
      action: "spendStoryPoints",
      amount: 1,
      actorName: "Duke",
      actorUuid: "Actor.duke1",
    });
  });
});

describe("announce: false", () => {
  // A caller that says what the point bought posts its own line; the generic one would double it.
  test("an owner's spend can be made quietly", async () => {
    const party = mockParty({ storyPoints: 3, isOwner: true });
    await requestStoryPointSpend({ name: 'Duke' }, 1, { announce: false });
    expect(party.update).toHaveBeenCalledWith({ 'system.storyPoints': 2 });
    expect(global.ChatMessage.create).not.toHaveBeenCalled();
  });

  test("the relay carries it, so the GM's client keeps quiet too", async () => {
    mockParty({ isOwner: false });
    await requestStoryPointSpend({ name: 'Duke' }, 1, { announce: false });
    expect(global.game.socket.emit).toHaveBeenCalledWith("system.essence20", expect.objectContaining({ announce: false }));

    global.game.user = { isGM: true, id: 'gm1' };
    global.game.users.activeGM = { id: 'gm1' };
    const party = mockParty({ storyPoints: 3, isOwner: true });
    await handleStoryPointSpendRequest({ action: "spendStoryPoints", amount: 1, actorName: "Duke", announce: false });
    expect(party.update).toHaveBeenCalled();
    expect(global.ChatMessage.create).not.toHaveBeenCalled();
  });
});

describe("Battle Hardened (GI Joe CRB, General Perk, p.130)", () => {
  class FakeRoll {
    constructor() {
      this._total = FakeRoll.nextTotal;
    }
    async evaluate() {
      return this;
    }
    get total() {
      return this._total;
    }
  }

  let originalRoll;
  beforeAll(() => {
    originalRoll = global.Roll;
    global.Roll = FakeRoll;
  });
  afterAll(() => {
    global.Roll = originalRoll;
  });

  function makeHolder() {
    return { items: [{ type: 'perk', flags: { core: { sourceId: BATTLE_HARDENED_ID } } }] };
  }

  /** The answering GM, owning the Party, handling a relayed spend. */
  function asGm() {
    global.game.user = { isGM: true, id: 'gm1' };
    global.game.users.activeGM = { id: 'gm1' };
    return mockParty({ storyPoints: 3, isOwner: true });
  }

  test("refunds the spent point on a rolled 4", async () => {
    const party = asGm();
    global.fromUuid = jest.fn().mockResolvedValue(makeHolder());
    FakeRoll.nextTotal = 4;

    await handleStoryPointSpendRequest({
      action: "spendStoryPoints", amount: 1, actorName: "Duke", actorUuid: "Actor.duke1",
    });

    expect(party.update).toHaveBeenNthCalledWith(1, { 'system.storyPoints': 2 });
    expect(party.update).toHaveBeenNthCalledWith(2, { 'system.storyPoints': 3 });
    expect(global.ChatMessage.create).toHaveBeenCalledTimes(2);
  });

  test("doesn't refund on anything but a 4", async () => {
    const party = asGm();
    global.fromUuid = jest.fn().mockResolvedValue(makeHolder());
    FakeRoll.nextTotal = 1;

    await handleStoryPointSpendRequest({
      action: "spendStoryPoints", amount: 1, actorName: "Duke", actorUuid: "Actor.duke1",
    });

    expect(party.update).toHaveBeenCalledTimes(1);
    expect(global.ChatMessage.create).toHaveBeenCalledTimes(1);
  });

  test("doesn't roll at all without the Perk", async () => {
    const party = asGm();
    global.fromUuid = jest.fn().mockResolvedValue({ items: [] });
    FakeRoll.nextTotal = 4;

    await handleStoryPointSpendRequest({
      action: "spendStoryPoints", amount: 1, actorName: "Duke", actorUuid: "Actor.duke1",
    });

    expect(party.update).toHaveBeenCalledTimes(1);
  });

  test("doesn't crash without an actorUuid (an older/unrelated caller)", async () => {
    const party = asGm();
    global.fromUuid = jest.fn();

    await handleStoryPointSpendRequest({ action: "spendStoryPoints", amount: 1, actorName: "Duke" });

    expect(global.fromUuid).not.toHaveBeenCalled();
    expect(party.update).toHaveBeenCalledTimes(1);
  });

  // The refund lives in spend() itself, so a player who owns the Party - and spends without any
  // relay - gets the same chance.
  test("also refunds a Party owner's own direct spend", async () => {
    const party = mockParty({ storyPoints: 3, isOwner: true });
    global.fromUuid = jest.fn().mockResolvedValue(makeHolder());
    FakeRoll.nextTotal = 4;

    await requestStoryPointSpend({ name: 'Duke', uuid: 'Actor.duke1' }, 1);

    expect(global.fromUuid).toHaveBeenCalledWith('Actor.duke1');
    expect(party.update).toHaveBeenNthCalledWith(2, { 'system.storyPoints': 3 });
  });
});

describe("requestStoryPointGrant", () => {
  test("an owner grants directly", async () => {
    const party = mockParty({ storyPoints: 3, isOwner: true });
    await requestStoryPointGrant({ name: 'Rarity' });
    expect(party.update).toHaveBeenCalledWith({ 'system.storyPoints': 4 });
  });

  test("a non-owner asks the GM, defaulting to 1", async () => {
    mockParty({ isOwner: false });
    await requestStoryPointGrant({ name: 'Rarity' });
    expect(global.game.socket.emit).toHaveBeenCalledWith("system.essence20", {
      action: "grantStoryPoints",
      amount: 1,
      actorName: "Rarity",
    });
  });

  // "If an NPC Critically Succeeds on a Skill Test" - the GM pool's own gain.
  test("a GM grants the GM pool directly, and says so", async () => {
    global.game.settings.get = jest.fn(() => 'giJoe');
    global.game.user = { isGM: true, id: 'gm1' };
    const party = mockParty({ gmPoints: 2, isOwner: true });
    await requestStoryPointGrant({ type: 'npc', name: 'Viper' }, 1, { pool: 'gm' });
    expect(party.update).toHaveBeenCalledWith({ 'system.gmPoints': 3 });
    expect(global.ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining("SptGmGrantGranted") }));
    expect(global.game.socket.emit).not.toHaveBeenCalled();
  });

  test("a player rolling their own NPC asks the GM for the GM pool, even as a Party owner", async () => {
    global.game.settings.get = jest.fn(() => 'giJoe');
    const party = mockParty({ gmPoints: 2, isOwner: true });
    await requestStoryPointGrant({ type: 'npc', name: 'Viper' }, 1, { pool: 'gm' });
    expect(party.update).not.toHaveBeenCalled();
    expect(global.game.socket.emit).toHaveBeenCalledWith("system.essence20", {
      action: "grantStoryPoints", amount: 1, actorName: "Viper", pool: "gm",
    });

    global.game.user = { isGM: true, id: 'gm1' };
    global.game.users.activeGM = { id: 'gm1' };
    await handleStoryPointGrantRequest({ action: "grantStoryPoints", amount: 1, actorName: "Viper", pool: "gm" });
    expect(party.update).toHaveBeenCalledWith({ 'system.gmPoints': 3 });
  });

  test("a Friend Group has no GM pool to gain", async () => {
    global.game.settings.get = jest.fn(() => 'myLittlePony');
    global.game.user = { isGM: true, id: 'gm1' };
    const party = mockParty({ gmPoints: 0, isOwner: true });
    await requestStoryPointGrant({ type: 'npc', name: 'Chrysalis' }, 1, { pool: 'gm' });
    expect(party.update).not.toHaveBeenCalled();
  });
});

describe("the GM-side handlers", () => {
  beforeEach(() => {
    global.game.user = { isGM: true, id: 'gm1' };
    global.game.users.activeGM = { id: 'gm1' };
  });

  test("a client that isn't the GM does nothing", async () => {
    global.game.user = { isGM: false, id: 'user1' };
    const party = mockParty({ isOwner: false });

    await handleStoryPointSpendRequest({ action: "spendStoryPoints", amount: 1, actorName: "Duke" });

    expect(party.update).not.toHaveBeenCalled();
  });

  // Two GMs connected would otherwise each perform the same spend.
  test("only the active GM answers", async () => {
    global.game.users.activeGM = { id: 'gm2' };
    const party = mockParty({ isOwner: true });

    await handleStoryPointSpendRequest({ action: "spendStoryPoints", amount: 1, actorName: "Duke" });

    expect(party.update).not.toHaveBeenCalled();
  });

  test("spends and announces, defaulting to 1", async () => {
    const party = mockParty({ storyPoints: 3, isOwner: true });

    await handleStoryPointSpendRequest({ action: "spendStoryPoints", actorName: "Duke" });

    expect(party.update).toHaveBeenCalledWith({ 'system.storyPoints': 2 });
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("denies and warns when the pool can't afford it", async () => {
    const party = mockParty({ storyPoints: 0, isOwner: true });

    await handleStoryPointSpendRequest({ action: "spendStoryPoints", amount: 1, actorName: "Duke" });

    expect(party.update).not.toHaveBeenCalled();
    expect(global.ui.notifications.warn).toHaveBeenCalled();
  });

  test("grants, never denied for affordability", async () => {
    const party = mockParty({ storyPoints: 0, isOwner: true });

    await handleStoryPointGrantRequest({ action: "grantStoryPoints", amount: 2, actorName: "Rarity" });

    expect(party.update).toHaveBeenCalledWith({ 'system.storyPoints': 2 });
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });
});

describe("what the books say", () => {
  // GI Joe p.127, PR p.91, TF p.105 give the GM a pool; the MLP CRB has none.
  test("every line but My Little Pony has a GM pool", () => {
    expect(hasGmPool('giJoe')).toBe(true);
    expect(hasGmPool('powerRangers')).toBe(true);
    expect(hasGmPool('transformers')).toBe(true);
    expect(hasGmPool('')).toBe(true);
    expect(hasGmPool('myLittlePony')).toBe(false);
  });

  test("a session starts with one point per Player Character, in both pools", () => {
    expect(sessionResetUpdate(4, 'giJoe')).toEqual({ 'system.storyPoints': 4, 'system.gmPoints': 4 });
  });

  test("a Friend Group gets no GM pool at the reset either", () => {
    expect(sessionResetUpdate(3, 'myLittlePony')).toEqual({ 'system.storyPoints': 3, 'system.gmPoints': 0 });
  });

  test("an empty roster resets to nothing rather than to garbage", () => {
    expect(sessionResetUpdate(undefined, 'giJoe')).toEqual({ 'system.storyPoints': 0, 'system.gmPoints': 0 });
  });
});

describe("which pool an actor spends from", () => {
  // "Both the players and the GM may always choose to spend their Story Points" - theirs.
  test("player-side actors draw on the shared pool, everything else on the GM's", () => {
    expect(poolFor({ type: 'playerCharacter' })).toBe('story');
    expect(poolFor({ type: 'companion' })).toBe('story');
    expect(poolFor({ type: 'npc' })).toBe('gm');
    expect(poolFor({ type: 'vehicle' })).toBe('gm');
  });

  test("an actor with no type is taken to be a player's", () => {
    expect(poolFor({ name: 'Duke' })).toBe('story');
    expect(poolFor(null)).toBe('story');
  });

  test("canSpendForActor: a player-side actor needs the shared pool and someone to write it", () => {
    mockParty({ storyPoints: 1, isOwner: true });
    expect(canSpendForActor({ type: 'playerCharacter' })).toBe(true);
    mockParty({ storyPoints: 0, isOwner: true });
    expect(canSpendForActor({ type: 'playerCharacter' })).toBe(false);
  });

  test("canSpendForActor: an NPC needs the GM, the GM pool, and a line that has one", () => {
    global.game.settings.get = jest.fn(() => 'giJoe');
    mockParty({ gmPoints: 2 });
    expect(canSpendForActor({ type: 'npc' })).toBe(false);
    global.game.user = { isGM: true, id: 'gm1' };
    expect(canSpendForActor({ type: 'npc' })).toBe(true);
    expect(canSpendForActor({ type: 'npc' }, 3)).toBe(false);
    global.game.settings.get = jest.fn(() => 'myLittlePony');
    expect(canSpendForActor({ type: 'npc' })).toBe(false);
  });

  test("requestStoryPointSpend on the GM pool writes GM Points, GM only", async () => {
    global.game.settings.get = jest.fn(() => 'giJoe');
    const party = mockParty({ gmPoints: 2, isOwner: true });
    await requestStoryPointSpend({ type: 'npc', name: 'Viper' }, 1, { pool: 'gm' });
    expect(party.update).not.toHaveBeenCalled();
    global.game.user = { isGM: true, id: 'gm1' };
    await requestStoryPointSpend({ type: 'npc', name: 'Viper' }, 1, { pool: 'gm' });
    expect(party.update).toHaveBeenCalledWith({ 'system.gmPoints': 1 });
    expect(global.game.socket.emit).not.toHaveBeenCalled();
  });
});

describe("what each line lets a Story Point buy", () => {
  // GI Joe p.127 / TF p.105: "+5 before dice are rolled, or +1 after". PR p.91: before only.
  test("+1 after the roll: GI Joe and Transformers, not Power Rangers or My Little Pony", () => {
    expect(defenseBoostAfterRoll('giJoe')).toBe(true);
    expect(defenseBoostAfterRoll('transformers')).toBe(true);
    expect(defenseBoostAfterRoll('')).toBe(true);
    expect(defenseBoostAfterRoll('powerRangers')).toBe(false);
    expect(defenseBoostAfterRoll('myLittlePony')).toBe(false);
  });

  test("the +5 lasts the scene only in My Little Pony", () => {
    expect(defenseBoostLastsScene('myLittlePony')).toBe(true);
    expect(defenseBoostLastsScene('giJoe')).toBe(false);
  });

  test("the Grid Power bloom is Power Rangers' alone", () => {
    expect(hasGridPowerBloom('powerRangers')).toBe(true);
    expect(hasGridPowerBloom('giJoe')).toBe(false);
  });

  test("a bloom adds each member's own 1d2, capped at their maximum", () => {
    const member = (value, max) => ({ system: { powers: { personal: { value, max } } } });
    const results = gridPowerBloomResults([member(1, 5), member(5, 5), member(4, 5)], [2, 2, 2]);
    expect(results.map(r => [r.value, r.gained])).toEqual([[3, 2], [5, 0], [5, 1]]);
  });
});
