import { jest } from '@jest/globals';
import {
  activatePoweredPlating, clearPoweredPlating, getPoweredPlatingBonus, pickPoweredPlatingAmount,
} from './powered-plating.mjs';

global.game = { i18n: { localize: (k) => k } };
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };

function makeActor({ power = 4, isMorphed = true, bonus = undefined } = {}) {
  return {
    system: { powers: { personal: { value: power } }, isMorphed },
    update: jest.fn(),
    setFlag: jest.fn(),
    unsetFlag: jest.fn(),
    getFlag: jest.fn(() => bonus),
  };
}

describe("pickPoweredPlatingAmount", () => {
  beforeEach(() => foundry.applications.api.DialogV2.wait.mockReset());

  test("returns the chosen amount", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue(3);
    expect(await pickPoweredPlatingAmount(4)).toBe(3);
  });

  test("caps at maxAmount even if the form somehow returns more", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue(99);
    expect(await pickPoweredPlatingAmount(4)).toBe(4);
  });

  test("returns null when cancelled (non-numeric result)", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    expect(await pickPoweredPlatingAmount(4)).toBeNull();
  });

  test("returns null for a zero or negative amount", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue(0);
    expect(await pickPoweredPlatingAmount(4)).toBeNull();
  });
});

describe("activatePoweredPlating", () => {
  beforeEach(() => foundry.applications.api.DialogV2.wait.mockReset());

  test("spends the chosen amount and banks it", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue(2);
    const actor = makeActor({ power: 4 });

    const activated = await activatePoweredPlating(actor);

    expect(activated).toBe(true);
    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 2 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'poweredPlatingBonus', 2);
  });

  test("caps the picker's own max at what's actually available, not the flat 4", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue(99);
    const actor = makeActor({ power: 2 });

    await activatePoweredPlating(actor);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'poweredPlatingBonus', 2);
  });

  test("does nothing with no Power to spend", async () => {
    const actor = makeActor({ power: 0 });

    const activated = await activatePoweredPlating(actor);

    expect(activated).toBe(false);
    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("spends nothing when the picker is cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeActor({ power: 4 });

    const activated = await activatePoweredPlating(actor);

    expect(activated).toBe(false);
    expect(actor.update).not.toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe("getPoweredPlatingBonus", () => {
  test("returns the banked amount while Morphed", () => {
    const actor = makeActor({ isMorphed: true, bonus: 3 });
    expect(getPoweredPlatingBonus(actor)).toBe(3);
  });

  test("returns 0 while not Morphed, even with a stale banked amount", () => {
    const actor = makeActor({ isMorphed: false, bonus: 3 });
    expect(getPoweredPlatingBonus(actor)).toBe(0);
  });

  test("returns 0 with nothing banked", () => {
    const actor = makeActor({ isMorphed: true, bonus: undefined });
    expect(getPoweredPlatingBonus(actor)).toBe(0);
  });
});

describe("clearPoweredPlating", () => {
  test("unsets the flag", async () => {
    const actor = makeActor();
    await clearPoweredPlating(actor);
    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'poweredPlatingBonus');
  });
});
