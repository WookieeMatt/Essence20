import { jest } from '@jest/globals';
import {
  activateExpandedMysticism, activateExpandedMysticismFortify, activateExpandedMysticismHeal,
  activateExpandedMysticismQuicken, canUseExpandedMysticism, canUseExpandedMysticismFortify,
  canUseExpandedMysticismHeal, canUseExpandedMysticismQuicken, deactivateExpandedMysticismQuickenAtTurnEnd,
  getExpandedMysticismFortifyBonus, isExpandedMysticismQuickenActive,
} from './expanded-mysticism.mjs';

global.game = { i18n: { localize: (k) => k }, scenes: { current: { id: 'scene1' } } };
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };
global.ui = { notifications: { warn: jest.fn() } };

function makeActor({ mysticalPoints = 3, health = 5, maxHealth = 10, usedFlags = {} } = {}) {
  const rolePoints = { system: { resource: { value: mysticalPoints } }, update: jest.fn(async (data) => {
    rolePoints.system.resource.value = data['system.resource.value'];
  }) };

  const actor = {
    system: { health: { value: health, max: maxHealth } },
    _getBaseRolePoints: jest.fn(() => rolePoints),
    getFlag: jest.fn((scope, key) => (scope == 'essence20' ? usedFlags[key] : undefined)),
    setFlag: jest.fn(async (scope, key, value) => {
      usedFlags[key] = value;
    }),
    update: jest.fn(async (data) => {
      actor.system.health.value = data['system.health.value'];
    }),
  };
  return actor;
}

describe("canUseExpandedMysticismHeal", () => {
  test("true with Mystical Points available and not yet used this scene", () => {
    const actor = makeActor({ mysticalPoints: 2 });
    expect(canUseExpandedMysticismHeal(actor)).toBe(true);
  });

  test("false with no Mystical Points", () => {
    const actor = makeActor({ mysticalPoints: 0 });
    expect(canUseExpandedMysticismHeal(actor)).toBe(false);
  });

  test("false once already used this scene", () => {
    const usedFlags = { expandedMysticismHealUsesThisScene: { epoch: 1, window: 'scene', count: 1 } };
    const actor = makeActor({ mysticalPoints: 2, usedFlags });
    expect(canUseExpandedMysticismHeal(actor)).toBe(false);
  });

  test("true again in a new scene, even with a stale used-this-scene flag", () => {
    const usedFlags = { expandedMysticismHealUsesThisScene: { epoch: 0, window: 'scene', count: 1 } };
    const actor = makeActor({ mysticalPoints: 2, usedFlags });
    expect(canUseExpandedMysticismHeal(actor)).toBe(true);
  });
});

describe("activateExpandedMysticismHeal", () => {
  beforeEach(() => foundry.applications.api.DialogV2.wait.mockReset());

  test("spends the chosen Mystical Points and heals that much Health", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue(2);
    const actor = makeActor({ mysticalPoints: 3, health: 5, maxHealth: 10 });

    await activateExpandedMysticismHeal(actor);

    expect(actor._getBaseRolePoints().update).toHaveBeenCalledWith({ 'system.resource.value': 1 });
    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 7 });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'expandedMysticismHealUsesThisScene', expect.objectContaining({ count: 1 }),
    );
  });

  test("caps healing at max Health even if more points are spent-able", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue(99);
    const actor = makeActor({ mysticalPoints: 5, health: 8, maxHealth: 10 });

    await activateExpandedMysticismHeal(actor);

    // capped at the missing 2 Health, not the 5 available points or the picker's 99
    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 10 });
    expect(actor._getBaseRolePoints().update).toHaveBeenCalledWith({ 'system.resource.value': 3 });
  });

  test("warns and does nothing already at full Health", async () => {
    const actor = makeActor({ mysticalPoints: 3, health: 10, maxHealth: 10 });

    await activateExpandedMysticismHeal(actor);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("does nothing without Mystical Points available", async () => {
    const actor = makeActor({ mysticalPoints: 0, health: 5, maxHealth: 10 });

    await activateExpandedMysticismHeal(actor);

    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("does nothing when the picker is cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeActor({ mysticalPoints: 3, health: 5, maxHealth: 10 });

    await activateExpandedMysticismHeal(actor);

    expect(actor.update).not.toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe("canUseExpandedMysticismFortify", () => {
  test("true with Mystical Points available and not yet used this scene", () => {
    expect(canUseExpandedMysticismFortify(makeActor({ mysticalPoints: 2 }))).toBe(true);
  });

  test("false once already used this scene", () => {
    const usedFlags = { expandedMysticismFortifyUsesThisScene: { epoch: 1, window: 'scene', count: 1 } };
    expect(canUseExpandedMysticismFortify(makeActor({ mysticalPoints: 2, usedFlags }))).toBe(false);
  });
});

describe("activateExpandedMysticismFortify / getExpandedMysticismFortifyBonus", () => {
  beforeEach(() => foundry.applications.api.DialogV2.wait.mockReset());

  test("spends 1 point and banks the chosen Defense", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('toughness');
    const actor = makeActor({ mysticalPoints: 2 });

    await activateExpandedMysticismFortify(actor);

    expect(actor._getBaseRolePoints().update).toHaveBeenCalledWith({ 'system.resource.value': 1 });
    expect(getExpandedMysticismFortifyBonus(actor, 'toughness')).toBe(1);
    expect(getExpandedMysticismFortifyBonus(actor, 'evasion')).toBe(0);
  });

  test("does nothing when the picker is cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeActor({ mysticalPoints: 2 });

    await activateExpandedMysticismFortify(actor);

    expect(actor._getBaseRolePoints().update).not.toHaveBeenCalled();
  });

  test("returns 0 with nothing banked", () => {
    expect(getExpandedMysticismFortifyBonus(makeActor(), 'toughness')).toBe(0);
  });
});

describe("canUseExpandedMysticismQuicken", () => {
  test("true with Mystical Points available and not yet used this scene", () => {
    expect(canUseExpandedMysticismQuicken(makeActor({ mysticalPoints: 2 }))).toBe(true);
  });

  test("false once already used this scene", () => {
    const usedFlags = { expandedMysticismQuickenUsesThisScene: { epoch: 1, window: 'scene', count: 1 } };
    expect(canUseExpandedMysticismQuicken(makeActor({ mysticalPoints: 2, usedFlags }))).toBe(false);
  });
});

describe("activateExpandedMysticismQuicken / isExpandedMysticismQuickenActive", () => {
  beforeEach(() => foundry.applications.api.DialogV2.wait.mockReset());

  test("spends 1 point and activates the chosen Movement type", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('aerial');
    const actor = makeActor({ mysticalPoints: 2 });

    await activateExpandedMysticismQuicken(actor);

    expect(actor._getBaseRolePoints().update).toHaveBeenCalledWith({ 'system.resource.value': 1 });
    expect(isExpandedMysticismQuickenActive(actor, 'aerial')).toBe(true);
    expect(isExpandedMysticismQuickenActive(actor, 'ground')).toBe(false);
  });

  test("does nothing when the picker is cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeActor({ mysticalPoints: 2 });

    await activateExpandedMysticismQuicken(actor);

    expect(actor._getBaseRolePoints().update).not.toHaveBeenCalled();
  });
});

describe("deactivateExpandedMysticismQuickenAtTurnEnd", () => {
  test("clears an active Quicken flag", async () => {
    const actor = makeActor({ usedFlags: {} });
    await actor.setFlag('essence20', 'expandedMysticismQuickenType', 'ground');

    await deactivateExpandedMysticismQuickenAtTurnEnd(actor);

    expect(isExpandedMysticismQuickenActive(actor, 'ground')).toBe(false);
  });

  test("no-ops without an active Quicken flag", async () => {
    const actor = makeActor();
    await deactivateExpandedMysticismQuickenAtTurnEnd(actor);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe("canUseExpandedMysticism", () => {
  test("true when any one of the 3 benefits is usable", () => {
    expect(canUseExpandedMysticism(makeActor({ mysticalPoints: 1 }))).toBe(true);
  });

  test("false with no Mystical Points at all", () => {
    expect(canUseExpandedMysticism(makeActor({ mysticalPoints: 0 }))).toBe(false);
  });

  test("false once all 3 benefits are used this scene", () => {
    const usedFlags = {
      expandedMysticismHealUsesThisScene: { epoch: 1, window: 'scene', count: 1 },
      expandedMysticismFortifyUsesThisScene: { epoch: 1, window: 'scene', count: 1 },
      expandedMysticismQuickenUsesThisScene: { epoch: 1, window: 'scene', count: 1 },
    };
    expect(canUseExpandedMysticism(makeActor({ mysticalPoints: 1, usedFlags }))).toBe(false);
  });
});

describe("activateExpandedMysticism", () => {
  beforeEach(() => foundry.applications.api.DialogV2.wait.mockReset());

  test("dispatches straight to Heal when it's the only benefit still usable, no benefit picker shown", async () => {
    const usedFlags = {
      expandedMysticismFortifyUsesThisScene: { epoch: 1, window: 'scene', count: 1 },
      expandedMysticismQuickenUsesThisScene: { epoch: 1, window: 'scene', count: 1 },
    };
    const actor = makeActor({ mysticalPoints: 2, health: 5, maxHealth: 10, usedFlags });
    foundry.applications.api.DialogV2.wait.mockResolvedValue(1);

    await activateExpandedMysticism(actor);

    // only 1 DialogV2.wait call (the Heal amount picker) - no benefit picker was shown
    expect(foundry.applications.api.DialogV2.wait).toHaveBeenCalledTimes(1);
    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 6 });
  });

  test("prompts for a benefit and dispatches to the chosen one when more than 1 is usable", async () => {
    const actor = makeActor({ mysticalPoints: 2 });
    foundry.applications.api.DialogV2.wait
      .mockResolvedValueOnce('quicken') // benefit picker
      .mockResolvedValueOnce('ground'); // Quicken's own movement-type picker

    await activateExpandedMysticism(actor);

    expect(isExpandedMysticismQuickenActive(actor, 'ground')).toBe(true);
  });
});
