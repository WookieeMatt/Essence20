import { jest } from '@jest/globals';
import {
  activateZeoCrystalBoost, canUseZeoCrystalBoost, getZeoCrystalBoostOption, pickZeoCrystalBoostOption,
} from './zeo-crystal-boost.mjs';

global.game = { combat: { id: 'combat1' }, i18n: { localize: (k) => k, format: (k) => k } };

function makeActor({ used = false } = {}) {
  const flagStore = used ? { zeoCrystalBoostUsedThisEncounter: { combatId: 'combat1' } } : {};
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => { flagStore[key] = value; }),
  };
}

describe("canUseZeoCrystalBoost", () => {
  test("true by default, false once already used this scene", () => {
    expect(canUseZeoCrystalBoost(makeActor())).toBe(true);
    expect(canUseZeoCrystalBoost(makeActor({ used: true }))).toBe(false);
  });
});

describe("activateZeoCrystalBoost / getZeoCrystalBoostOption", () => {
  test("sets the chosen option and marks the scene used", async () => {
    const actor = makeActor();

    await activateZeoCrystalBoost(actor, 'morpher');

    expect(getZeoCrystalBoostOption(actor)).toBe('morpher');
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'zeoCrystalBoostUsedThisEncounter', { combatId: 'combat1' });
  });

  test("getZeoCrystalBoostOption is null with nothing set", () => {
    expect(getZeoCrystalBoostOption(makeActor())).toBeNull();
  });
});

describe("pickZeoCrystalBoostOption", () => {
  test("returns the chosen option", async () => {
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('weapon') } } } };
    expect(await pickZeoCrystalBoostOption()).toBe('weapon');
  });

  test("returns null when cancelled", async () => {
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('cancel') } } } };
    expect(await pickZeoCrystalBoostOption()).toBeNull();
  });
});
