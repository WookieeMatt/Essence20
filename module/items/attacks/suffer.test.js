import { jest } from '@jest/globals';
import { activateSuffer, hasSuffer, pickSufferAmount } from './suffer.mjs';

const SUFFER_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.4wCGBUae2VvEDVs9";

global.game = { i18n: { localize: (k) => k } };
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };
global.fromUuid = jest.fn();

function makeActor({ hasPerk = true, power = 1 } = {}) {
  return {
    items: hasPerk ? [{ type: 'perk', flags: { core: { sourceId: SUFFER_ID } } }] : [],
    system: { powers: { personal: { value: power } } },
    update: jest.fn(),
  };
}

function makeTarget() {
  return { toggleStatusEffect: jest.fn() };
}

describe("hasSuffer", () => {
  test("true with the Perk", () => {
    expect(hasSuffer(makeActor({ hasPerk: true }))).toBe(true);
  });

  test("false without the Perk", () => {
    expect(hasSuffer(makeActor({ hasPerk: false }))).toBe(false);
  });
});

describe("pickSufferAmount", () => {
  beforeEach(() => foundry.applications.api.DialogV2.wait.mockReset());

  test("returns the chosen amount", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue(3);
    expect(await pickSufferAmount(5)).toBe(3);
  });

  test("caps at maxAmount even if the form somehow returns more", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue(99);
    expect(await pickSufferAmount(5)).toBe(5);
  });

  test("returns null when cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    expect(await pickSufferAmount(5)).toBeNull();
  });
});

describe("activateSuffer", () => {
  beforeEach(() => {
    foundry.applications.api.DialogV2.wait.mockReset();
    global.fromUuid.mockReset();
  });

  test("spends the chosen amount and Impairs the target", async () => {
    const actor = makeActor({ power: 3 });
    const target = makeTarget();
    global.fromUuid.mockResolvedValue(target);
    foundry.applications.api.DialogV2.wait.mockResolvedValue(2);

    const activated = await activateSuffer(actor, 'Actor.target1');

    expect(activated).toBe(true);
    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 1 });
    expect(target.toggleStatusEffect).toHaveBeenCalledWith('impaired', { active: true });
  });

  test("does nothing with no Power to spend", async () => {
    const actor = makeActor({ power: 0 });

    const activated = await activateSuffer(actor, 'Actor.target1');

    expect(activated).toBe(false);
    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("does nothing if the target can't be resolved", async () => {
    const actor = makeActor({ power: 3 });
    global.fromUuid.mockResolvedValue(null);

    const activated = await activateSuffer(actor, 'Actor.target1');

    expect(activated).toBe(false);
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("spends nothing when the picker is cancelled", async () => {
    const actor = makeActor({ power: 3 });
    const target = makeTarget();
    global.fromUuid.mockResolvedValue(target);
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');

    const activated = await activateSuffer(actor, 'Actor.target1');

    expect(activated).toBe(false);
    expect(actor.update).not.toHaveBeenCalled();
    expect(target.toggleStatusEffect).not.toHaveBeenCalled();
  });
});
