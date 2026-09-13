import { jest } from '@jest/globals';
import {
  activateMysteriousAura, deactivateMysteriousAura, getMysteriousAura, getMysteriousAuraImposingPenalty,
  getMysteriousAuraProtectiveBonus, hasNearbyResplendentAura, pickMysteriousAura,
} from './mysterious-aura.mjs';

global.game = {
  i18n: { localize: (key) => key, format: (key) => key },
};
global.ui = { notifications: { warn: jest.fn() } };
global.canvas = {
  tokens: { placeables: [] },
  grid: { measurePath: jest.fn(() => ({ distance: 0 })) },
};

function makeActor({ id = 'actor1', aura = null, power = 1 } = {}) {
  return {
    id,
    getFlag: jest.fn((scope, key) => (scope == 'essence20' && key == 'mysteriousAuraActive' ? aura : undefined)),
    setFlag: jest.fn(),
    unsetFlag: jest.fn(),
    update: jest.fn(),
    getActiveTokens: jest.fn(() => [{ document: { disposition: 1 }, center: { x: 0, y: 0 } }]),
    system: { powers: { personal: { value: power } } },
  };
}

describe("getMysteriousAura", () => {
  test("returns the stored aura", () => {
    const actor = makeActor({ aura: { type: 'imposing', defenseChoice: null } });
    expect(getMysteriousAura(actor)).toEqual({ type: 'imposing', defenseChoice: null });
  });

  test("null with nothing active", () => {
    expect(getMysteriousAura(makeActor())).toBeNull();
  });
});

describe("pickMysteriousAura", () => {
  test("returns the chosen type and Defense", async () => {
    global.foundry = {
      applications: {
        api: {
          DialogV2: {
            wait: jest.fn(async ({ buttons }) => buttons[0].callback(null, {
              form: { elements: { type: { value: 'protective' }, defenseChoice: { value: 'toughness' } } },
            })),
          },
        },
      },
    };

    const result = await pickMysteriousAura();
    expect(result).toEqual({ type: 'protective', defenseChoice: 'toughness' });
  });

  test("null when cancelled", async () => {
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn(async () => 'cancel') } } } };
    expect(await pickMysteriousAura()).toBeNull();
  });
});

describe("activateMysteriousAura", () => {
  beforeEach(() => {
    ui.notifications.warn.mockReset();
  });

  test("spends 1 Power and banks the chosen aura", async () => {
    const actor = makeActor({ power: 1 });
    global.foundry = {
      applications: {
        api: {
          DialogV2: {
            wait: jest.fn(async ({ buttons }) => buttons[0].callback(null, {
              form: { elements: { type: { value: 'imposing' }, defenseChoice: { value: 'toughness' } } },
            })),
          },
        },
      },
    };

    const result = await activateMysteriousAura(actor);

    expect(result).toBe(true);
    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'mysteriousAuraActive', { type: 'imposing', defenseChoice: 'toughness' });
  });

  test("warns and does nothing without Power to spend", async () => {
    const actor = makeActor({ power: 0 });
    const result = await activateMysteriousAura(actor);
    expect(result).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  test("does nothing when the picker is cancelled, without spending", async () => {
    const actor = makeActor({ power: 1 });
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn(async () => 'cancel') } } } };

    const result = await activateMysteriousAura(actor);

    expect(result).toBe(false);
    expect(actor.update).not.toHaveBeenCalled();
  });
});

describe("deactivateMysteriousAura", () => {
  test("clears the flag", async () => {
    const actor = makeActor({ aura: { type: 'imposing' } });
    await deactivateMysteriousAura(actor);
    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'mysteriousAuraActive');
  });
});

describe("getMysteriousAuraImposingPenalty", () => {
  function makeTargetAndEnemy({ enemyAura = null, targetDisposition = 1, enemyDisposition = -1 } = {}) {
    const targetToken = { document: { disposition: targetDisposition }, center: { x: 0, y: 0 } };
    const targetActor = { getActiveTokens: jest.fn(() => [targetToken]) };
    const enemyActor = enemyAura
      ? { getFlag: jest.fn(() => enemyAura) }
      : { getFlag: jest.fn(() => undefined) };
    const enemyToken = { document: { disposition: enemyDisposition }, center: { x: 0, y: 0 }, actor: enemyActor };
    canvas.tokens.placeables = [targetToken, enemyToken];

    return targetActor;
  }

  test("-2 to Willpower/Cleverness with a nearby Imposing enemy", () => {
    const targetActor = makeTargetAndEnemy({ enemyAura: { type: 'imposing' } });
    expect(getMysteriousAuraImposingPenalty(targetActor, 'willpower')).toBe(-2);
    expect(getMysteriousAuraImposingPenalty(targetActor, 'cleverness')).toBe(-2);
  });

  test("0 for a different Defense", () => {
    const targetActor = makeTargetAndEnemy({ enemyAura: { type: 'imposing' } });
    expect(getMysteriousAuraImposingPenalty(targetActor, 'toughness')).toBe(0);
  });

  test("0 without a nearby enemy holding Imposing", () => {
    const targetActor = makeTargetAndEnemy({ enemyAura: null });
    expect(getMysteriousAuraImposingPenalty(targetActor, 'willpower')).toBe(0);
  });

  test("0 when the nearby token is an ally, not an enemy", () => {
    const targetActor = makeTargetAndEnemy({ enemyAura: { type: 'imposing' }, enemyDisposition: 1 });
    expect(getMysteriousAuraImposingPenalty(targetActor, 'willpower')).toBe(0);
  });
});

describe("getMysteriousAuraProtectiveBonus", () => {
  beforeEach(() => {
    canvas.tokens.placeables = [];
  });

  test("+2 for the holder's own chosen Defense", () => {
    const targetActor = makeActor({ aura: { type: 'protective', defenseChoice: 'evasion' } });
    expect(getMysteriousAuraProtectiveBonus(targetActor, 'evasion')).toBe(2);
  });

  test("+2 for a nearby ally holder's chosen Defense", () => {
    const targetToken = { document: { disposition: 1 }, center: { x: 0, y: 0 } };
    const targetActor = { getFlag: jest.fn(() => undefined), getActiveTokens: jest.fn(() => [targetToken]) };
    const allyActor = { getFlag: jest.fn(() => ({ type: 'protective', defenseChoice: 'evasion' })) };
    const allyToken = { document: { disposition: 1 }, center: { x: 0, y: 0 }, actor: allyActor };
    canvas.tokens.placeables = [targetToken, allyToken];

    expect(getMysteriousAuraProtectiveBonus(targetActor, 'evasion')).toBe(2);
  });

  test("0 for a different Defense or with nothing active nearby", () => {
    const targetActor = makeActor({ aura: { type: 'protective', defenseChoice: 'evasion' } });
    expect(getMysteriousAuraProtectiveBonus(targetActor, 'toughness')).toBe(0);
    expect(getMysteriousAuraProtectiveBonus(makeActor(), 'evasion')).toBe(0);
  });
});

describe("hasNearbyResplendentAura", () => {
  beforeEach(() => {
    canvas.tokens.placeables = [];
  });

  test("true for the holder themselves", () => {
    const targetActor = makeActor({ aura: { type: 'resplendent' } });
    expect(hasNearbyResplendentAura(targetActor)).toBe(true);
  });

  test("true with a nearby ally holder", () => {
    const targetToken = { document: { disposition: 1 }, center: { x: 0, y: 0 } };
    const targetActor = { getFlag: jest.fn(() => undefined), getActiveTokens: jest.fn(() => [targetToken]) };
    const allyActor = { getFlag: jest.fn(() => ({ type: 'resplendent' })) };
    const allyToken = { document: { disposition: 1 }, center: { x: 0, y: 0 }, actor: allyActor };
    canvas.tokens.placeables = [targetToken, allyToken];

    expect(hasNearbyResplendentAura(targetActor)).toBe(true);
  });

  test("false with nothing active", () => {
    expect(hasNearbyResplendentAura(makeActor())).toBe(false);
  });
});
