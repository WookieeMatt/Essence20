import { jest } from '@jest/globals';
import { activateRoar, canUseRoar, getRoarDefenseBonus } from './roar.mjs';

global.game = {
  combat: null,
  i18n: { localize: jest.fn((key) => key) },
};

function makeActor() {
  const flagStore = {};
  return {
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

describe("canUseRoar", () => {
  afterEach(() => {
    game.combat = null;
  });

  test("true in combat, not yet used this encounter", () => {
    game.combat = { id: 'combat1' };
    expect(canUseRoar(makeActor())).toBe(true);
  });

  test("false outside combat", () => {
    game.combat = null;
    expect(canUseRoar(makeActor())).toBe(false);
  });

  test("false once already used this combat", () => {
    game.combat = { id: 'combat1' };
    const actor = makeActor();
    actor.getFlag = jest.fn((scope, key) => (key == 'roarUsedThisEncounter' ? { epoch: 1, window: 'encounter', count: 1 } : undefined));
    expect(canUseRoar(actor)).toBe(false);
  });
});

describe("activateRoar / getRoarDefenseBonus", () => {
  afterEach(() => {
    game.combat = null;
    delete global.foundry;
  });

  test("banks the chosen Defense and reads it back as a +1 bonus", async () => {
    game.combat = { id: 'combat1' };
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('toughness') } } } };
    const actor = makeActor();

    const result = await activateRoar(actor);

    expect(result).toBe(true);
    expect(getRoarDefenseBonus(actor, 'toughness')).toBe(1);
    expect(getRoarDefenseBonus(actor, 'evasion')).toBe(0);
  });

  test("returns false and doesn't use it up when the picker is cancelled", async () => {
    game.combat = { id: 'combat1' };
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('cancel') } } } };
    const actor = makeActor();

    const result = await activateRoar(actor);

    expect(result).toBe(false);
    expect(canUseRoar(actor)).toBe(true);
  });

  test("returns false outside combat without prompting", async () => {
    game.combat = null;
    const actor = makeActor();

    const result = await activateRoar(actor);

    expect(result).toBe(false);
  });

  test("getRoarDefenseBonus returns 0 for a stale prior combat", () => {
    game.combat = { id: 'combat2' };
    const actor = makeActor();
    actor.getFlag = jest.fn(() => ({ defenseType: 'toughness', combatId: 'combat1' }));

    expect(getRoarDefenseBonus(actor, 'toughness')).toBe(0);
  });

  test("getRoarDefenseBonus returns 0 with nothing banked", () => {
    expect(getRoarDefenseBonus(makeActor(), 'toughness')).toBe(0);
  });
});
