import { jest } from '@jest/globals';
import { getJuryRigDefenseBonus, isJuryRigBenefitActive } from './jury-rig.mjs';

global.game = { user: { targets: { first: jest.fn() } }, i18n: { localize: jest.fn((key) => key) }, combat: null };

function makeVehicle() {
  const flagStore = {};
  return {
    type: 'vehicle',
    getFlag: jest.fn((scope, key) => flagStore[key]),
    flagStore,
  };
}

/** What the Jury Rig Use rule writes on a success (rules/conv15-banked.test.js): Free - this round + 1, Standard - 999999. */
function grant(vehicle, option, standardAction = false) {
  vehicle.flagStore.pendingJuryRigBenefit = { option, expiresRound: standardAction ? 999999 : (game.combat?.round ?? 0) + 1 };
}

describe("isJuryRigBenefitActive", () => {
  afterEach(() => {
    game.combat = null;
  });

  test("active for the matching option through the round after the one it was granted in", () => {
    game.combat = { round: 2 };
    const vehicle = makeVehicle();
    grant(vehicle, 'hardenArmor');

    expect(isJuryRigBenefitActive(vehicle, 'hardenArmor')).toBe(true);
    game.combat = { round: 3 };
    expect(isJuryRigBenefitActive(vehicle, 'hardenArmor')).toBe(true);
    game.combat = { round: 4 };
    expect(isJuryRigBenefitActive(vehicle, 'hardenArmor')).toBe(false);
  });

  test("false for a different option", () => {
    game.combat = { round: 1 };
    const vehicle = makeVehicle();
    grant(vehicle, 'hardenArmor');

    expect(isJuryRigBenefitActive(vehicle, 'alignSuspension')).toBe(false);
  });

  test("stays active outside of combat once granted outside of combat", () => {
    const vehicle = makeVehicle();
    grant(vehicle, 'cleanBarrels');

    expect(isJuryRigBenefitActive(vehicle, 'cleanBarrels')).toBe(true);
  });

  test("false with nothing banked", () => {
    expect(isJuryRigBenefitActive(makeVehicle(), 'hardenArmor')).toBe(false);
  });

  test("Standard-action mode stays active for the rest of the scene's combats", () => {
    game.combat = { round: 1 };
    const vehicle = makeVehicle();
    grant(vehicle, 'hardenArmor', true);

    expect(isJuryRigBenefitActive(vehicle, 'hardenArmor')).toBe(true);
    game.combat = { round: 50 };
    expect(isJuryRigBenefitActive(vehicle, 'hardenArmor')).toBe(true);
  });
});

describe("getJuryRigDefenseBonus", () => {
  afterEach(() => {
    game.combat = null;
  });

  test("+1 Evasion while Align Suspension is active", () => {
    game.combat = { round: 1 };
    const vehicle = makeVehicle();
    grant(vehicle, 'alignSuspension');

    expect(getJuryRigDefenseBonus(vehicle, 'evasion')).toBe(1);
    expect(getJuryRigDefenseBonus(vehicle, 'toughness')).toBe(0);
  });

  test("+1 Toughness while Harden Armor is active", () => {
    game.combat = { round: 1 };
    const vehicle = makeVehicle();
    grant(vehicle, 'hardenArmor');

    expect(getJuryRigDefenseBonus(vehicle, 'toughness')).toBe(1);
    expect(getJuryRigDefenseBonus(vehicle, 'evasion')).toBe(0);
  });

  test("0 with nothing banked", () => {
    expect(getJuryRigDefenseBonus(makeVehicle(), 'toughness')).toBe(0);
  });
});
