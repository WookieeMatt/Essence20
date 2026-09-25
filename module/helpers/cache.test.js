import { jest } from '@jest/globals';
import { activateCache, canUseCache } from './cache.mjs';

const CACHE_I_ID = "Compendium.essence20.decepticon_directive.Item.EEGQqqgqZEJkJDHB";
const CACHE_II_ID = "Compendium.essence20.decepticon_directive.Item.iyfXCEAkkoC8vODL";
const CACHE_III_ID = "Compendium.essence20.decepticon_directive.Item.VMd10Qb4ByeCla5q";
const PRIVATE_BARTER_ID = "Compendium.essence20.decepticon_directive.Item.mzOtnEnXRhCM0v9O";

function makeActor(perkIds = [], usedFlags = {}) {
  const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
  return {
    name: 'Raider',
    items,
    getFlag: jest.fn((scope, key) => (scope == 'essence20' ? usedFlags[key] : undefined)),
    setFlag: jest.fn(async (scope, key, value) => {
      usedFlags[key] = value;
    }),
  };
}

describe("canUseCache / activateCache", () => {
  beforeEach(() => {
    global.game = { combat: { id: 'combat1' }, i18n: { format: (key, data) => `${key}:${JSON.stringify(data)}` } };
    global.ChatMessage = { create: jest.fn(), getSpeaker: jest.fn(() => ({})) };
  });

  test("false without any Cache Perk", () => {
    const actor = makeActor([]);
    expect(canUseCache(actor)).toBe(false);
  });

  test("Cache I alone allows exactly 1 use this encounter", async () => {
    const actor = makeActor([CACHE_I_ID]);
    expect(canUseCache(actor)).toBe(true);

    const activated = await activateCache(actor);
    expect(activated).toBe(true);
    expect(canUseCache(actor)).toBe(false);
  });

  test("Cache II widens the cap to 2 uses this encounter", async () => {
    const actor = makeActor([CACHE_I_ID, CACHE_II_ID]);

    expect(await activateCache(actor)).toBe(true);
    expect(canUseCache(actor)).toBe(true);
    expect(await activateCache(actor)).toBe(true);
    expect(canUseCache(actor)).toBe(false);
  });

  test("Cache III widens the cap to 3 uses this encounter", async () => {
    const actor = makeActor([CACHE_I_ID, CACHE_II_ID, CACHE_III_ID]);

    expect(await activateCache(actor)).toBe(true);
    expect(await activateCache(actor)).toBe(true);
    expect(canUseCache(actor)).toBe(true);
    expect(await activateCache(actor)).toBe(true);
    expect(canUseCache(actor)).toBe(false);
  });

  test("activateCache returns false once the cap is reached", async () => {
    const actor = makeActor([CACHE_I_ID]);
    await activateCache(actor);

    const secondActivation = await activateCache(actor);
    expect(secondActivation).toBe(false);
  });

  test("posts the plain notification without Private Barter", async () => {
    const actor = makeActor([CACHE_I_ID]);
    await activateCache(actor, 'Cache I');

    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('E20.PerkUsedNotification'),
    }));
  });

  test("Private Barter upgrades the first use and posts its own notification", async () => {
    const actor = makeActor([CACHE_I_ID, PRIVATE_BARTER_ID]);
    await activateCache(actor, 'Cache I');

    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('E20.CachePrivateBarterUsedNotification'),
    }));
  });

  test("Private Barter only upgrades one use per encounter, even with Cache II/III available", async () => {
    const actor = makeActor([CACHE_I_ID, CACHE_II_ID, PRIVATE_BARTER_ID]);
    await activateCache(actor, 'Cache I');
    ChatMessage.create.mockClear();

    await activateCache(actor, 'Cache I');

    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('E20.PerkUsedNotification'),
    }));
  });

  test("doesn't upgrade without Private Barter", async () => {
    const actor = makeActor([CACHE_I_ID]);
    await activateCache(actor, 'Cache I');

    expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('E20.PerkUsedNotification'),
    }));
    expect(ChatMessage.create).not.toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('CachePrivateBarter'),
    }));
  });
});
