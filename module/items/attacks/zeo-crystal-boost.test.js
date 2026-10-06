import { jest } from '@jest/globals';
import {
  activateZeoCrystalBoost, canUseZeoCrystalBoost, consumeZeoCrystalBoostZordAttackDamage,
  getZeoCrystalBoostOption, isZeoCrystalBoostMegaformTeamActive, pickZeoCrystalBoostOption,
} from './zeo-crystal-boost.mjs';

global.game = { combat: { id: 'combat1' }, i18n: { localize: (k) => k, format: (k) => k } };

function makeActor({ used = false, option = null, consumed = false } = {}) {
  const flagStore = used ? { zeoCrystalBoostUsedThisEncounter: { epoch: 1, window: 'encounter', count: 1 } } : {};
  if (option) {
    flagStore.zeoCrystalBoostOption = option;
  }

  flagStore.zeoCrystalBoostZordAttackConsumed = consumed;

  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
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
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'zeoCrystalBoostUsedThisEncounter', { epoch: 1, window: 'encounter', count: 1 });
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

describe("activateZeoCrystalBoost resets the Zord Attack single-use flag", () => {
  test("clears zeoCrystalBoostZordAttackConsumed on every (re)activation", async () => {
    const actor = makeActor({ consumed: true });

    await activateZeoCrystalBoost(actor, 'zordAttackDamage');

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'zeoCrystalBoostZordAttackConsumed', false);
  });
});

describe("isZeoCrystalBoostMegaformTeamActive (team-wide Megaform clause, Across the Stars p.73)", () => {
  function makeZord(name, driver) {
    return {
      name,
      type: 'zord',
      system: { actors: driver ? { p: { uuid: `Actor.${name}-driver`, vehicleRole: 'driver' } } : {} },
    };
  }

  function makeMegaform(zords) {
    global.fromUuidSync.mockImplementation(uuid => {
      for (const zord of zords) {
        if (uuid === `Actor.${zord.name}`) {
          return zord;
        }

        if (uuid === `Actor.${zord.name}-driver`) {
          return zord.driver;
        }
      }

      return null;
    });

    return {
      type: 'megaform',
      system: {
        subtype: ['megaformZord'],
        actors: Object.fromEntries(zords.map((z, i) => [`z${i}`, { uuid: `Actor.${z.name}` }])),
      },
    };
  }

  beforeEach(() => {
    global.fromUuidSync = jest.fn();
  });

  test("true when every participant's driver has chosen megaformTeam", () => {
    const red = makeZord('Red', true);
    red.driver = makeActor({ option: 'megaformTeam' });
    const blue = makeZord('Blue', true);
    blue.driver = makeActor({ option: 'megaformTeam' });

    expect(isZeoCrystalBoostMegaformTeamActive(makeMegaform([red, blue]))).toBe(true);
  });

  test("false when only some participants have chosen it", () => {
    const red = makeZord('Red', true);
    red.driver = makeActor({ option: 'megaformTeam' });
    const blue = makeZord('Blue', true);
    blue.driver = makeActor({ option: 'zordDriving' });

    expect(isZeoCrystalBoostMegaformTeamActive(makeMegaform([red, blue]))).toBe(false);
  });

  test("false when a participant has no driver seated", () => {
    const red = makeZord('Red', false);

    expect(isZeoCrystalBoostMegaformTeamActive(makeMegaform([red]))).toBe(false);
  });

  test("false for a non-Megaform actor", () => {
    expect(isZeoCrystalBoostMegaformTeamActive({ type: 'zord' })).toBe(false);
  });

  test("false for a Combiner (not a Megazord) subtype", () => {
    const megaform = makeMegaform([]);
    megaform.system.subtype = ['megaformCombiner'];
    expect(isZeoCrystalBoostMegaformTeamActive(megaform)).toBe(false);
  });

  test("false with no linked Zords at all", () => {
    expect(isZeoCrystalBoostMegaformTeamActive(makeMegaform([]))).toBe(false);
  });
});

describe("consumeZeoCrystalBoostZordAttackDamage", () => {
  test("grants the bonus and marks it consumed the first time", () => {
    const actor = makeActor({ option: 'zordAttackDamage' });

    expect(consumeZeoCrystalBoostZordAttackDamage(actor)).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'zeoCrystalBoostZordAttackConsumed', true);
  });

  test("doesn't grant it again once already consumed", () => {
    const actor = makeActor({ option: 'zordAttackDamage', consumed: true });

    expect(consumeZeoCrystalBoostZordAttackDamage(actor)).toBe(false);
  });

  test("doesn't apply with a different option chosen", () => {
    const actor = makeActor({ option: 'zordDriving' });

    expect(consumeZeoCrystalBoostZordAttackDamage(actor)).toBe(false);
  });

  test("doesn't apply with no option chosen at all", () => {
    const actor = makeActor();

    expect(consumeZeoCrystalBoostZordAttackDamage(actor)).toBe(false);
  });
});
