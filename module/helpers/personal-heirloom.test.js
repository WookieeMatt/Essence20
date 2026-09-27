import { jest } from '@jest/globals';
import { activateDesignateHeirloom, canDesignateHeirloom, getPersonalHeirloomBonus } from './personal-heirloom.mjs';

global.game = { i18n: { localize: (k) => k } };
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };

function makeActor({ weapons = [{ id: 'sword1', name: 'Sword', type: 'weapon', system: { traits: [] } }], flagValue } = {}) {
  const flags = { personalHeirloomItemId: flagValue };
  return {
    items: weapons,
    getFlag: jest.fn((scope, key) => (scope == 'essence20' ? flags[key] : undefined)),
    setFlag: jest.fn(async (scope, key, value) => {
      flags[key] = value;
    }),
  };
}

describe("canDesignateHeirloom", () => {
  test("true with an eligible non-Power weapon", () => {
    expect(canDesignateHeirloom(makeActor())).toBe(true);
  });

  test("false with no owned weapons", () => {
    expect(canDesignateHeirloom(makeActor({ weapons: [] }))).toBe(false);
  });

  test("false when the only owned weapon is a Power Weapon", () => {
    const actor = makeActor({ weapons: [{ id: 'staff1', name: 'Power Staff', type: 'weapon', system: { traits: ['powerWeapon'] } }] });
    expect(canDesignateHeirloom(actor)).toBe(false);
  });
});

describe("activateDesignateHeirloom / getPersonalHeirloomBonus", () => {
  beforeEach(() => foundry.applications.api.DialogV2.wait.mockReset());

  test("banks the chosen weapon's own id", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('sword1');
    const actor = makeActor();

    await activateDesignateHeirloom(actor);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'personalHeirloomItemId', 'sword1');
    expect(getPersonalHeirloomBonus(actor, { id: 'sword1' })).toBe(1);
    expect(getPersonalHeirloomBonus(actor, { id: 'otherWeapon' })).toBe(0);
  });

  test("does nothing when the picker is cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeActor();

    await activateDesignateHeirloom(actor);

    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("does nothing without an eligible weapon", async () => {
    const actor = makeActor({ weapons: [] });

    await activateDesignateHeirloom(actor);

    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });

  test("getPersonalHeirloomBonus returns 0 with no weapon rolled, or nothing banked", () => {
    expect(getPersonalHeirloomBonus(makeActor(), null)).toBe(0);
    expect(getPersonalHeirloomBonus(makeActor(), { id: 'sword1' })).toBe(0);
  });

  test("getPersonalHeirloomBonus returns 0 for a weapon with no id, even with nothing banked (no false-positive undefined match)", () => {
    expect(getPersonalHeirloomBonus(makeActor(), {})).toBe(0);
  });
});
