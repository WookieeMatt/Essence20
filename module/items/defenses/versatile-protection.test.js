import { jest } from '@jest/globals';
import { isVersatileProtectionActive, pickVersatileProtection, toggleVersatileProtection } from './versatile-protection.mjs';

global.game = { i18n: { localize: (k) => k } };
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };

function makeActor({ flag = undefined } = {}) {
  return {
    getFlag: jest.fn(() => flag),
    setFlag: jest.fn(),
    unsetFlag: jest.fn(),
    update: jest.fn(),
  };
}

beforeEach(() => {
  foundry.applications.api.DialogV2.wait.mockReset();
});

describe("isVersatileProtectionActive", () => {
  test("false with no grant flag", () => {
    expect(isVersatileProtectionActive(makeActor())).toBe(false);
  });

  test("true with a grant flag", () => {
    const actor = makeActor({ flag: { damageType: 'fire', tier: 'resistance' } });
    expect(isVersatileProtectionActive(actor)).toBe(true);
  });
});

describe("pickVersatileProtection", () => {
  test("returns the chosen damage type and tier", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue({ damageType: 'fire', tier: 'immunity' });
    expect(await pickVersatileProtection()).toEqual({ damageType: 'fire', tier: 'immunity' });
  });

  test("returns null when cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    expect(await pickVersatileProtection()).toBeNull();
  });
});

describe("toggleVersatileProtection", () => {
  test("switching ON prompts and sets the chosen Resistance field", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue({ damageType: 'fire', tier: 'resistance' });
    const actor = makeActor();

    const nowActive = await toggleVersatileProtection(actor);

    expect(nowActive).toBe(true);
    expect(actor.update).toHaveBeenCalledWith({ 'system.resistances.fire': true });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'versatileProtectionGrant', { damageType: 'fire', tier: 'resistance' });
  });

  test("switching ON with Immunity chosen sets the Immunity field instead", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue({ damageType: 'cold', tier: 'immunity' });
    const actor = makeActor();

    await toggleVersatileProtection(actor);

    expect(actor.update).toHaveBeenCalledWith({ 'system.immunities.cold': true });
  });

  test("returns null and sets nothing when cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeActor();

    const nowActive = await toggleVersatileProtection(actor);

    expect(nowActive).toBeNull();
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("switching OFF clears exactly the granted field", async () => {
    const actor = makeActor({ flag: { damageType: 'fire', tier: 'resistance' } });

    const nowActive = await toggleVersatileProtection(actor);

    expect(nowActive).toBe(false);
    expect(actor.update).toHaveBeenCalledWith({ 'system.resistances.fire': false });
    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'versatileProtectionGrant');
  });
});
