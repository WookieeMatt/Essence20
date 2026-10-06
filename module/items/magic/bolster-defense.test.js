import { jest } from '@jest/globals';
import { activateBolsterDefense, applyBolsterDefense, getBolsterDefenseBonus, pickBolsterDefenseOption } from './bolster-defense.mjs';

global.game = { user: { targets: { first: () => undefined } }, i18n: { localize: jest.fn((key) => key) } };

function makeActor(uuid = 'Actor.self1') {
  return { uuid, _dice: { rollSkill: jest.fn() } };
}

describe("pickBolsterDefenseOption", () => {
  let waitMock;

  beforeEach(() => {
    waitMock = jest.fn();
    global.foundry = { applications: { api: { DialogV2: { wait: waitMock } } } };
  });

  test("returns the chosen mode/defenseType on confirm", async () => {
    waitMock.mockResolvedValue({ mode: 'single', defenseType: 'toughness' });
    expect(await pickBolsterDefenseOption()).toEqual({ mode: 'single', defenseType: 'toughness' });
  });

  test("returns null when cancelled", async () => {
    waitMock.mockResolvedValue('cancel');
    expect(await pickBolsterDefenseOption()).toBeNull();
  });
});

describe("activateBolsterDefense", () => {
  afterEach(() => {
    global.game.user.targets = { first: () => undefined };
  });

  test("rolls Culture (Arcane) vs DIF 12 against the currently-targeted actor", async () => {
    const actor = makeActor();
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue({ mode: 'all', defenseType: 'toughness' }) } } } };
    const targetActor = { uuid: 'Actor.target1' };
    global.game.user.targets = { first: () => ({ actor: targetActor }) };

    const result = await activateBolsterDefense(actor);

    expect(result).toBe(true);
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'culture', dif: '12', isBolsterDefenseAttempt: true,
        bolsterDefenseMode: 'all', bolsterDefenseType: 'toughness', bolsterDefenseTargetUuid: 'Actor.target1',
      }),
      actor,
    );
  });

  test("defaults the target to self with nothing targeted", async () => {
    const actor = makeActor('Actor.self1');
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue({ mode: 'single', defenseType: 'evasion' }) } } } };

    await activateBolsterDefense(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ bolsterDefenseTargetUuid: 'Actor.self1' }),
      actor,
    );
  });

  test("returns false and rolls nothing when the picker is cancelled", async () => {
    const actor = makeActor();
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('cancel') } } } };

    const result = await activateBolsterDefense(actor);

    expect(result).toBe(false);
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("applyBolsterDefense / getBolsterDefenseBonus", () => {
  function makeTargetActor() {
    const flagStore = {};
    return {
      getFlag: jest.fn((scope, key) => flagStore[key]),
      setFlag: jest.fn(async (scope, key, value) => {
        flagStore[key] = value;
      }),
    };
  }

  test("banks and reads back an 'all' bonus regardless of defenseType", async () => {
    const target = makeTargetActor();
    await applyBolsterDefense(target, 'all', null);

    expect(getBolsterDefenseBonus(target, 'toughness')).toBe(1);
    expect(getBolsterDefenseBonus(target, 'evasion')).toBe(1);
  });

  test("banks and reads back a 'single' bonus only for the matching defenseType", async () => {
    const target = makeTargetActor();
    await applyBolsterDefense(target, 'single', 'toughness');

    expect(getBolsterDefenseBonus(target, 'toughness')).toBe(2);
    expect(getBolsterDefenseBonus(target, 'evasion')).toBe(0);
  });

  test("returns 0 with nothing banked", () => {
    expect(getBolsterDefenseBonus(makeTargetActor(), 'toughness')).toBe(0);
  });
});
