import { jest } from '@jest/globals';
import {
  activateJuryRig, applyJuryRigBenefit, getJuryRigDefenseBonus, isJuryRigBenefitActive, pickJuryRigOption,
} from './jury-rig.mjs';

global.game = { user: { targets: { first: jest.fn() } }, i18n: { localize: jest.fn((key) => key) }, combat: null };

function makeVehicle({ uuid = 'Actor.vehicle1', threatLevel = 5 } = {}) {
  const flagStore = {};
  return {
    type: 'vehicle',
    uuid,
    system: { threatLevel },
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
  };
}

function makeActor({ pilotedVehicle = null } = {}) {
  return { _dice: { _getPilotedVehicle: jest.fn(() => pilotedVehicle), rollSkill: jest.fn() } };
}

describe("pickJuryRigOption", () => {
  let waitMock;

  beforeEach(() => {
    waitMock = jest.fn();
    global.foundry = { applications: { api: { DialogV2: { wait: waitMock } } } };
  });

  test("returns the chosen option and standardAction:false when the Standard-action field isn't offered", async () => {
    waitMock.mockImplementation(({ buttons }) => buttons[0].callback(null, {
      form: { elements: { option: { value: 'hardenArmor' } } },
    }));
    expect(await pickJuryRigOption(false)).toEqual({ option: 'hardenArmor', standardAction: false });
  });

  test("returns standardAction:true when offered and chosen", async () => {
    waitMock.mockImplementation(({ buttons }) => buttons[0].callback(null, {
      form: { elements: { option: { value: 'hardenArmor' }, actionType: { value: 'standard' } } },
    }));
    expect(await pickJuryRigOption(true)).toEqual({ option: 'hardenArmor', standardAction: true });
  });

  test("returns standardAction:false when offered but Free action is chosen", async () => {
    waitMock.mockImplementation(({ buttons }) => buttons[0].callback(null, {
      form: { elements: { option: { value: 'hardenArmor' }, actionType: { value: 'free' } } },
    }));
    expect(await pickJuryRigOption(true)).toEqual({ option: 'hardenArmor', standardAction: false });
  });

  test("returns null when cancelled", async () => {
    waitMock.mockResolvedValue('cancel');
    expect(await pickJuryRigOption(false)).toBeNull();
  });
});

describe("activateJuryRig", () => {
  afterEach(() => {
    game.user.targets.first.mockReset();
    game.combat = null;
  });

  function mockPicker({ option, standardAction = false }) {
    global.foundry = {
      applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue({ option, standardAction }) } } },
    };
  }

  test("rolls Technology against a flat DIF of 10 + the target vehicle's Threat Level", async () => {
    const pilotedVehicle = makeVehicle({ uuid: 'Actor.vehicle1', threatLevel: 6 });
    const actor = { ...makeActor({ pilotedVehicle }), setFlag: jest.fn(), getFlag: jest.fn() };
    mockPicker({ option: 'alignSuspension' });

    const result = await activateJuryRig(actor);

    expect(result).toBe(true);
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'technology', dif: '16', isJuryRigAttempt: true,
        juryRigOption: 'alignSuspension', juryRigTargetUuid: 'Actor.vehicle1', juryRigStandardAction: false,
      }),
      actor,
    );
  });

  test("falls back to the currently-targeted vehicle when not piloting one", async () => {
    const targetedVehicle = makeVehicle({ uuid: 'Actor.vehicle2', threatLevel: 0 });
    const actor = { ...makeActor(), setFlag: jest.fn(), getFlag: jest.fn() };
    game.user.targets.first.mockReturnValue({ actor: targetedVehicle });
    mockPicker({ option: 'cleanBarrels' });

    await activateJuryRig(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ dif: '10', juryRigTargetUuid: 'Actor.vehicle2' }),
      actor,
    );
  });

  test("returns false and rolls nothing when the picker is cancelled", async () => {
    const actor = { ...makeActor({ pilotedVehicle: makeVehicle() }), setFlag: jest.fn(), getFlag: jest.fn() };
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('cancel') } } } };

    const result = await activateJuryRig(actor);

    expect(result).toBe(false);
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("returns null with no valid vehicle to target", async () => {
    const actor = { ...makeActor(), setFlag: jest.fn(), getFlag: jest.fn() };
    game.user.targets.first.mockReturnValue(undefined);
    mockPicker({ option: 'hardenArmor' });

    const result = await activateJuryRig(actor);

    expect(result).toBeNull();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("marks the once-per-scene flag used when the Standard-action escalation is chosen", async () => {
    game.combat = { id: 'combat1', round: 1 };
    const pilotedVehicle = makeVehicle();
    const actor = { ...makeActor({ pilotedVehicle }), setFlag: jest.fn(), getFlag: jest.fn(() => undefined) };
    mockPicker({ option: 'hardenArmor', standardAction: true });

    await activateJuryRig(actor);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'juryRigUsedThisSceneAsStandardAction', { combatId: 'combat1' });
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ juryRigStandardAction: true }), actor,
    );
  });

  test("doesn't mark the once-per-scene flag for the ordinary Free-action mode", async () => {
    game.combat = { id: 'combat1', round: 1 };
    const pilotedVehicle = makeVehicle();
    const actor = { ...makeActor({ pilotedVehicle }), setFlag: jest.fn(), getFlag: jest.fn(() => undefined) };
    mockPicker({ option: 'hardenArmor', standardAction: false });

    await activateJuryRig(actor);

    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe("applyJuryRigBenefit / isJuryRigBenefitActive", () => {
  afterEach(() => {
    game.combat = null;
  });

  test("active for the matching option through the round after the one it was granted in", async () => {
    game.combat = { round: 2 };
    const vehicle = makeVehicle();
    await applyJuryRigBenefit(vehicle, 'hardenArmor');

    expect(isJuryRigBenefitActive(vehicle, 'hardenArmor')).toBe(true);
    game.combat = { round: 3 };
    expect(isJuryRigBenefitActive(vehicle, 'hardenArmor')).toBe(true);
    game.combat = { round: 4 };
    expect(isJuryRigBenefitActive(vehicle, 'hardenArmor')).toBe(false);
  });

  test("false for a different option", async () => {
    game.combat = { round: 1 };
    const vehicle = makeVehicle();
    await applyJuryRigBenefit(vehicle, 'hardenArmor');

    expect(isJuryRigBenefitActive(vehicle, 'alignSuspension')).toBe(false);
  });

  test("stays active outside of combat once granted outside of combat", async () => {
    game.combat = null;
    const vehicle = makeVehicle();
    await applyJuryRigBenefit(vehicle, 'cleanBarrels');

    expect(isJuryRigBenefitActive(vehicle, 'cleanBarrels')).toBe(true);
  });

  test("false with nothing banked", () => {
    expect(isJuryRigBenefitActive(makeVehicle(), 'hardenArmor')).toBe(false);
  });

  test("Standard-action mode stays active with no round-based expiry at all", async () => {
    game.combat = { round: 1 };
    const vehicle = makeVehicle();
    await applyJuryRigBenefit(vehicle, 'hardenArmor', true);

    expect(isJuryRigBenefitActive(vehicle, 'hardenArmor')).toBe(true);
    game.combat = { round: 50 };
    expect(isJuryRigBenefitActive(vehicle, 'hardenArmor')).toBe(true);
  });
});

describe("getJuryRigDefenseBonus", () => {
  afterEach(() => {
    game.combat = null;
  });

  test("+1 Evasion while Align Suspension is active", async () => {
    game.combat = { round: 1 };
    const vehicle = makeVehicle();
    await applyJuryRigBenefit(vehicle, 'alignSuspension');

    expect(getJuryRigDefenseBonus(vehicle, 'evasion')).toBe(1);
    expect(getJuryRigDefenseBonus(vehicle, 'toughness')).toBe(0);
  });

  test("+1 Toughness while Harden Armor is active", async () => {
    game.combat = { round: 1 };
    const vehicle = makeVehicle();
    await applyJuryRigBenefit(vehicle, 'hardenArmor');

    expect(getJuryRigDefenseBonus(vehicle, 'toughness')).toBe(1);
    expect(getJuryRigDefenseBonus(vehicle, 'evasion')).toBe(0);
  });

  test("0 with nothing banked", () => {
    expect(getJuryRigDefenseBonus(makeVehicle(), 'toughness')).toBe(0);
  });
});
