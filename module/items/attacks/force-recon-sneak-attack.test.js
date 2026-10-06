import { jest } from '@jest/globals';
import { checkForceReconSneakAttackEligibility, markForceReconSneakAttackUsed } from './force-recon-sneak-attack.mjs';

const VEILED_ATTACKER_ID = "Compendium.essence20.ferocious_fighters.Item.6OxGuWzQz0Fiivas";

global.game = {
  i18n: { localize: (key) => key },
  user: { targets: { first: jest.fn(() => undefined) } },
  combat: null,
};

global.canvas = {
  grid: { measurePath: jest.fn(() => ({ distance: 0 })) },
};

function makeActor({ perkIds = [] } = {}) {
  const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
  const attackerToken = { center: { x: 0, y: 0 } };
  return {
    items,
    getActiveTokens: jest.fn(() => [attackerToken]),
    getFlag: jest.fn(() => undefined),
    setFlag: jest.fn(),
  };
}

describe("checkForceReconSneakAttackEligibility", () => {
  beforeEach(() => {
    game.user.targets.first.mockReturnValue(undefined);
    game.combat = null;
    canvas.grid.measurePath.mockReturnValue({ distance: 0 });
  });

  test("not eligible outside combat", () => {
    const result = checkForceReconSneakAttackEligibility(makeActor());
    expect(result).toEqual({ eligible: false, reason: 'E20.SneakAttackReasonAlreadyUsed' });
  });

  test("not eligible without a target", () => {
    game.combat = { id: 'combat1' };
    const result = checkForceReconSneakAttackEligibility(makeActor());
    expect(result).toEqual({ eligible: false, reason: 'E20.SneakAttackReasonNoTarget' });
  });

  test("not eligible beyond 30ft", () => {
    game.combat = { id: 'combat1' };
    game.user.targets.first.mockReturnValue({ center: { x: 100, y: 0 } });
    canvas.grid.measurePath.mockReturnValue({ distance: 35 });

    const result = checkForceReconSneakAttackEligibility(makeActor());
    expect(result).toEqual({ eligible: false, reason: 'E20.SneakAttackReasonOutOfRange' });
  });

  test("not eligible once already used this combat (without Veiled Attacker)", () => {
    game.combat = { id: 'combat1' };
    game.user.targets.first.mockReturnValue({ center: { x: 0, y: 0 } });
    const actor = makeActor();
    actor.getFlag = jest.fn(() => ({ combatId: 'combat1', uses: 1 }));

    const result = checkForceReconSneakAttackEligibility(actor);
    expect(result).toEqual({ eligible: false, reason: 'E20.SneakAttackReasonAlreadyUsed' });
  });

  test("still has a second use remaining with Veiled Attacker after 1 use", () => {
    game.combat = { id: 'combat1' };
    game.user.targets.first.mockReturnValue({ center: { x: 0, y: 0 } });
    const actor = makeActor({ perkIds: [VEILED_ATTACKER_ID] });
    actor.getFlag = jest.fn(() => ({ combatId: 'combat1', uses: 1 }));

    const result = checkForceReconSneakAttackEligibility(actor);
    expect(result).toEqual({ eligible: false, reason: 'E20.PredatorSneakAttackReasonManual' });
  });

  test("exhausted even with Veiled Attacker after 2 uses", () => {
    game.combat = { id: 'combat1' };
    game.user.targets.first.mockReturnValue({ center: { x: 0, y: 0 } });
    const actor = makeActor({ perkIds: [VEILED_ATTACKER_ID] });
    actor.getFlag = jest.fn(() => ({ combatId: 'combat1', uses: 2 }));

    const result = checkForceReconSneakAttackEligibility(actor);
    expect(result).toEqual({ eligible: false, reason: 'E20.SneakAttackReasonAlreadyUsed' });
  });

  test("a stale prior combat's use count doesn't carry over", () => {
    game.combat = { id: 'combat2' };
    game.user.targets.first.mockReturnValue({ center: { x: 0, y: 0 } });
    const actor = makeActor();
    actor.getFlag = jest.fn(() => ({ combatId: 'combat1', uses: 1 }));

    const result = checkForceReconSneakAttackEligibility(actor);
    expect(result).toEqual({ eligible: false, reason: 'E20.PredatorSneakAttackReasonManual' });
  });

  test("never auto-eligible even when every checkable condition passes - awareness can't be detected", () => {
    game.combat = { id: 'combat1' };
    game.user.targets.first.mockReturnValue({ center: { x: 0, y: 0 } });
    const result = checkForceReconSneakAttackEligibility(makeActor());
    expect(result).toEqual({ eligible: false, reason: 'E20.PredatorSneakAttackReasonManual' });
  });
});

describe("markForceReconSneakAttackUsed", () => {
  test("banks the first use this combat", async () => {
    game.combat = { id: 'combat1' };
    const actor = makeActor();

    await markForceReconSneakAttackUsed(actor);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'forceReconSneakAttackUsesThisEncounter', {
      combatId: 'combat1', uses: 1,
    });
  });

  test("increments an existing use count this combat", async () => {
    game.combat = { id: 'combat1' };
    const actor = makeActor();
    actor.getFlag = jest.fn(() => ({ combatId: 'combat1', uses: 1 }));

    await markForceReconSneakAttackUsed(actor);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'forceReconSneakAttackUsesThisEncounter', {
      combatId: 'combat1', uses: 2,
    });
  });

  test("does nothing outside combat", async () => {
    game.combat = null;
    const actor = makeActor();

    await markForceReconSneakAttackUsed(actor);

    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});
