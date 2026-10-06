import { jest } from '@jest/globals';
import { activateEnergonParasite, canUseEnergonParasite, getEnergonParasiteDrainAmount } from './energon-parasite.mjs';

function makeActor({ essences = { strength: 4, speed: 4, smarts: 4, social: 4 }, energon = { max: 4, value: 0 } } = {}) {
  return {
    system: {
      essences: {
        strength: { value: essences.strength },
        speed: { value: essences.speed },
        smarts: { value: essences.smarts },
        social: { value: essences.social },
      },
      energon: { normal: { max: energon.max, value: energon.value } },
    },
    update: jest.fn(async function (data) {
      this.system.energon.normal.value = data['system.energon.normal.value'];
    }),
  };
}

function makeTarget({ energonValue = 4, defeated = true } = {}) {
  return {
    statuses: defeated ? new Set(['defeated']) : new Set(),
    system: { energon: { normal: { value: energonValue } } },
    update: jest.fn(async function (data) {
      this.system.energon.normal.value = data['system.energon.normal.value'];
    }),
  };
}

beforeEach(() => {
  global.ui.notifications.warn.mockClear();
  global.game.user = { targets: { first: jest.fn() } };
});

describe("getEnergonParasiteDrainAmount", () => {
  test("caps at the target's own stored amount", () => {
    const actor = makeActor({ essences: { strength: 4, speed: 6, smarts: 8, social: 8 }, energon: { max: 4, value: 0 } });
    const target = makeTarget({ energonValue: 2 });
    expect(getEnergonParasiteDrainAmount(actor, target)).toBe(2);
  });

  test("caps at the actor's own lowest Essence Score", () => {
    const actor = makeActor({ essences: { strength: 2, speed: 6, smarts: 8, social: 8 }, energon: { max: 4, value: 0 } });
    const target = makeTarget({ energonValue: 10 });
    expect(getEnergonParasiteDrainAmount(actor, target)).toBe(2);
  });

  test("caps at the actor's own remaining Energon capacity", () => {
    const actor = makeActor({ essences: { strength: 6, speed: 6, smarts: 6, social: 6 }, energon: { max: 4, value: 3 } });
    const target = makeTarget({ energonValue: 10 });
    expect(getEnergonParasiteDrainAmount(actor, target)).toBe(1);
  });

  test("never goes negative when already at capacity", () => {
    const actor = makeActor({ energon: { max: 4, value: 4 } });
    const target = makeTarget({ energonValue: 10 });
    expect(getEnergonParasiteDrainAmount(actor, target)).toBe(0);
  });
});

describe("canUseEnergonParasite", () => {
  test("true against a Defeated target with Energon to drain and room to receive it", () => {
    const actor = makeActor();
    global.game.user.targets.first.mockReturnValue({ actor: makeTarget() });
    expect(canUseEnergonParasite(actor)).toBe(true);
  });

  test("false without any target", () => {
    const actor = makeActor();
    global.game.user.targets.first.mockReturnValue(undefined);
    expect(canUseEnergonParasite(actor)).toBe(false);
  });

  test("false against a target that isn't Defeated", () => {
    const actor = makeActor();
    global.game.user.targets.first.mockReturnValue({ actor: makeTarget({ defeated: false }) });
    expect(canUseEnergonParasite(actor)).toBe(false);
  });

  test("false when there's nothing left to drain", () => {
    const actor = makeActor();
    global.game.user.targets.first.mockReturnValue({ actor: makeTarget({ energonValue: 0 }) });
    expect(canUseEnergonParasite(actor)).toBe(false);
  });
});

describe("activateEnergonParasite", () => {
  test("transfers the drained amount from target to actor", async () => {
    const actor = makeActor({ energon: { max: 4, value: 0 } });
    const target = makeTarget({ energonValue: 3 });
    global.game.user.targets.first.mockReturnValue({ actor: target });

    const drained = await activateEnergonParasite(actor);

    expect(drained).toBe(3);
    expect(actor.system.energon.normal.value).toBe(3);
    expect(target.system.energon.normal.value).toBe(0);
  });

  test("warns and does nothing without a Defeated target", async () => {
    const actor = makeActor();
    global.game.user.targets.first.mockReturnValue(undefined);

    const drained = await activateEnergonParasite(actor);

    expect(drained).toBe(0);
    expect(global.ui.notifications.warn).toHaveBeenCalledWith('E20.EnergonParasiteNoTarget');
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("does nothing (no warning) when there's simply nothing to drain", async () => {
    const actor = makeActor({ energon: { max: 4, value: 4 } });
    const target = makeTarget({ energonValue: 3 });
    global.game.user.targets.first.mockReturnValue({ actor: target });

    const drained = await activateEnergonParasite(actor);

    expect(drained).toBe(0);
    expect(actor.update).not.toHaveBeenCalled();
    expect(target.update).not.toHaveBeenCalled();
  });
});
