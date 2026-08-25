import { jest } from '@jest/globals';
import {
  onRest,
  onRecharge,
  onRecoverSpellcastingDownshift,
  onSufferForSpellcastingDownshift,
  spendRolePoint,
} from './listener-misc-handler.mjs';

/**
 * Builds a bare actor fixture covering everything _applyRestBenefits reads/writes, plus a
 * fake ActorSheet wrapping it (onRest/onRecharge/the spellcasting recovery actions all take
 * the sheet, not the actor, mirroring how they're actually invoked from base-actor-sheet.mjs).
 */
function makeActorSheet({ system, ...overrides } = {}) {
  const actor = {
    system: {
      canTransform: false,
      health: { value: 2, max: 10 },
      stun: { value: 3 },
      energon: {
        normal: { value: 0, max: 4 },
        dark: { value: 0 }, primal: { value: 0 }, red: { value: 0 }, synthEn: { value: 0 },
      },
      powers: { personal: { value: 0, max: 0, regeneration: 0 } },
      essences: {
        strength: { value: 3, max: 3 },
        speed: { value: 3, max: 3 },
        smarts: { value: 3, max: 3 },
        social: { value: 3, max: 3 },
      },
      skills: { spellcasting: { shiftDown: 0 } },
      ...system,
    },
    items: { documentsByType: { rolePoints: [] } },
    update: jest.fn(),
    ...overrides,
  };

  return { actor, render: jest.fn() };
}

describe("onRest / onRecharge (_applyRestBenefits)", () => {
  test("restores health to max and stun to 0", async () => {
    const sheet = makeActorSheet();
    await onRest(sheet);
    expect(sheet.actor.update).toHaveBeenCalledWith(expect.objectContaining({
      "system.health.value": 10,
      "system.stun.value": 0,
    }));
  });

  test("restores half of Energon max (rounded up), capped at max", async () => {
    const sheet = makeActorSheet({ system: { energon: {
      normal: { value: 1, max: 5 },
      dark: { value: 0 }, primal: { value: 0 }, red: { value: 0 }, synthEn: { value: 0 },
    } } });
    await onRest(sheet);
    // ceil(5/2) = 3 restored, 1 + 3 = 4, under max 5
    expect(sheet.actor.update).toHaveBeenCalledWith(expect.objectContaining({
      "system.energon.normal.value": 4,
    }));
  });

  test("Energon restore never exceeds max even when already close to it", async () => {
    const sheet = makeActorSheet({ system: { energon: {
      normal: { value: 4, max: 5 },
      dark: { value: 0 }, primal: { value: 0 }, red: { value: 0 }, synthEn: { value: 0 },
    } } });
    await onRest(sheet);
    // ceil(5/2) = 3 restored, 4 + 3 = 7, clamped to max 5
    expect(sheet.actor.update).toHaveBeenCalledWith(expect.objectContaining({
      "system.energon.normal.value": 5,
    }));
  });

  test("resets every non-normal Energon type to 0", async () => {
    const sheet = makeActorSheet({ system: { energon: {
      normal: { value: 0, max: 4 },
      dark: { value: 2 }, primal: { value: 1 }, red: { value: 3 }, synthEn: { value: 1 },
    } } });
    await onRest(sheet);
    expect(sheet.actor.update).toHaveBeenCalledWith(expect.objectContaining({
      "system.energon.dark.value": 0,
      "system.energon.primal.value": 0,
      "system.energon.red.value": 0,
      "system.energon.synthEn.value": 0,
    }));
  });

  test("regenerates Personal Power up to max, capped at max", async () => {
    const sheet = makeActorSheet({ system: {
      powers: { personal: { value: 3, max: 5, regeneration: 4 } },
    } });
    await onRest(sheet);
    expect(sheet.actor.update).toHaveBeenCalledWith(expect.objectContaining({
      "system.powers.personal.value": 5,
    }));
  });

  test("recovers each damaged Essence by 1, capped at its own max", async () => {
    const sheet = makeActorSheet({ system: {
      essences: {
        strength: { value: 1, max: 3 },
        speed: { value: 3, max: 3 },
        smarts: { value: 0, max: 3 },
        social: { value: 3, max: 3 },
      },
    } });
    await onRest(sheet);
    expect(sheet.actor.update).toHaveBeenCalledWith({ "system.essences.strength.value": 2 });
    expect(sheet.actor.update).toHaveBeenCalledWith({ "system.essences.smarts.value": 1 });
    // Already at max - no update call for these.
    expect(sheet.actor.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ "system.essences.speed.value": expect.anything() }),
    );
  });

  test("resets every Role Points item's resource.value to its own max", async () => {
    const rolePoints = { name: "Test Role Points", system: { resource: { max: 3 } }, update: jest.fn() };
    const sheet = makeActorSheet({ items: { documentsByType: { rolePoints: [rolePoints] } } });
    await onRest(sheet);
    expect(rolePoints.update).toHaveBeenCalledWith({ "system.resource.value": 3 });
  });

  test("re-renders the sheet afterward", async () => {
    const sheet = makeActorSheet();
    await onRest(sheet);
    expect(sheet.render).toHaveBeenCalledWith(false);
  });

  test("onRest and onRecharge apply the same restorative benefits", async () => {
    const restSheet = makeActorSheet({ system: { energon: {
      normal: { value: 1, max: 5 },
      dark: { value: 0 }, primal: { value: 0 }, red: { value: 0 }, synthEn: { value: 0 },
    } } });
    const rechargeSheet = makeActorSheet({ system: { energon: {
      normal: { value: 1, max: 5 },
      dark: { value: 0 }, primal: { value: 0 }, red: { value: 0 }, synthEn: { value: 0 },
    } } });

    await onRest(restSheet);
    await onRecharge(rechargeSheet);

    expect(rechargeSheet.actor.update).toHaveBeenCalledWith(
      restSheet.actor.update.mock.calls.find(call => "system.health.value" in call[0])[0],
    );
  });
});

describe("onRecoverSpellcastingDownshift", () => {
  test("decrements shiftDown by 1", async () => {
    const sheet = makeActorSheet({ system: { skills: { spellcasting: { shiftDown: 2 } } } });
    await onRecoverSpellcastingDownshift(sheet);
    expect(sheet.actor.update).toHaveBeenCalledWith({ "system.skills.spellcasting.shiftDown": 1 });
    expect(sheet.render).toHaveBeenCalledWith(false);
  });

  test("does nothing when there's no downshift to recover", async () => {
    const sheet = makeActorSheet({ system: { skills: { spellcasting: { shiftDown: 0 } } } });
    await onRecoverSpellcastingDownshift(sheet);
    expect(sheet.actor.update).not.toHaveBeenCalled();
    expect(sheet.render).not.toHaveBeenCalled();
  });
});

describe("onSufferForSpellcastingDownshift", () => {
  test("decrements shiftDown by 1 and deals 1 Health damage", async () => {
    const sheet = makeActorSheet({ system: {
      skills: { spellcasting: { shiftDown: 2 } },
      health: { value: 5, max: 10 },
    } });
    await onSufferForSpellcastingDownshift(sheet);
    expect(sheet.actor.update).toHaveBeenCalledWith({
      "system.skills.spellcasting.shiftDown": 1,
      "system.health.value": 4,
    });
  });

  test("Health damage never drops below 0", async () => {
    const sheet = makeActorSheet({ system: {
      skills: { spellcasting: { shiftDown: 1 } },
      health: { value: 0, max: 10 },
    } });
    await onSufferForSpellcastingDownshift(sheet);
    expect(sheet.actor.update).toHaveBeenCalledWith(expect.objectContaining({
      "system.health.value": 0,
    }));
  });

  test("does nothing when there's no downshift to recover", async () => {
    const sheet = makeActorSheet({ system: { skills: { spellcasting: { shiftDown: 0 } } } });
    await onSufferForSpellcastingDownshift(sheet);
    expect(sheet.actor.update).not.toHaveBeenCalled();
  });
});

describe("spendRolePoint", () => {
  // jest.config.js doesn't auto-clear mocks between tests, and global.ui.notifications is a
  // single shared jest.fn() across this whole file (every describe block above also calls it) -
  // without this, an assertion here would see leftover call history from earlier tests.
  beforeEach(() => {
    global.ui.notifications.error.mockClear();
    global.ui.notifications.info.mockClear();
  });

  function makeActor(overrides = {}) {
    return {
      system: {
        useUnlimitedResource: false,
        powers: { personal: { value: 5 } },
        ...overrides,
      },
      update: jest.fn(),
    };
  }

  function makeItem(overrides = {}) {
    return {
      name: "Test Role Points",
      system: {
        resource: { max: 3, value: 2 },
        powerCost: null,
        ...overrides,
      },
      update: jest.fn(),
    };
  }

  test("decrements the resource pool by 1", async () => {
    const actor = makeActor();
    const item = makeItem();
    await spendRolePoint(actor, item);
    expect(item.update).toHaveBeenCalledWith({ "system.resource.value": 1 });
  });

  test("errors and does nothing when the pool is already empty", async () => {
    const actor = makeActor();
    const item = makeItem({ resource: { max: 3, value: 0 } });
    await spendRolePoint(actor, item);
    expect(item.update).not.toHaveBeenCalled();
    expect(global.ui.notifications.error).toHaveBeenCalledWith("E20.RolePointsOverSpent");
  });

  test("an unlimited-resource actor can spend even at 0 without decrementing", async () => {
    const actor = makeActor({ useUnlimitedResource: true });
    const item = makeItem({ resource: { max: 3, value: 0 } });
    await spendRolePoint(actor, item);
    expect(item.update).not.toHaveBeenCalled();
    expect(global.ui.notifications.error).not.toHaveBeenCalled();
  });

  test("also spends Personal Power when the item has a powerCost", async () => {
    const actor = makeActor();
    const item = makeItem({ powerCost: 2 });
    await spendRolePoint(actor, item);
    expect(actor.update).toHaveBeenCalledWith({ "system.powers.personal.value": 3 });
    expect(item.update).toHaveBeenCalledWith({ "system.resource.value": 1 });
  });

  test("errors and spends nothing when there's not enough Personal Power", async () => {
    const actor = makeActor({ powers: { personal: { value: 1 } } });
    const item = makeItem({ powerCost: 2 });
    await spendRolePoint(actor, item);
    expect(actor.update).not.toHaveBeenCalled();
    expect(item.update).not.toHaveBeenCalled();
    expect(global.ui.notifications.error).toHaveBeenCalledWith("E20.PowerOverSpent");
  });

  test("posts a spent-notification naming what was spent", async () => {
    const actor = makeActor();
    const item = makeItem({ powerCost: 2 });
    await spendRolePoint(actor, item);
    // jest.setup.js's game.i18n.format stub just echoes the key, ignoring the data object, so
    // this only confirms the notification key/call itself, not the interpolated wording -
    // the actual "2 Power, 1 point" spentString construction is exercised for real by the two
    // tests above (resource-only vs resource+power spends).
    expect(global.ui.notifications.info).toHaveBeenCalledWith("E20.RolePointsSpent");
  });
});
