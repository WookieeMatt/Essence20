import { jest } from '@jest/globals';
import {
  activateOmegaEnhancement, getChargedUpEssence, isMuscleModeActive, isPowerModeActive, pickOmegaEnhancementOption,
} from './omega-enhancement.mjs';

global.game = { i18n: { localize: (k) => k, format: (k) => k }, combat: null };
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };
global.canvas = {
  tokens: { placeables: [], setTargets: jest.fn() },
  grid: { measurePath: jest.fn(() => ({ distance: 5 })) },
};

function makeToken({ id, disposition = -1 } = {}) {
  return { id, actor: { id: `actor-${id}` }, document: { disposition }, center: {} };
}

describe("pickOmegaEnhancementOption", () => {
  beforeEach(() => {
    foundry.applications.api.DialogV2.wait.mockReset();
  });

  test("returns the chosen option/essence", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue({ option: 'muscle', essence: 'strength' });
    expect(await pickOmegaEnhancementOption()).toEqual({ option: 'muscle', essence: 'strength' });
  });

  test("returns null when cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    expect(await pickOmegaEnhancementOption()).toBeNull();
  });
});

describe("getChargedUpEssence / isMuscleModeActive / isPowerModeActive", () => {
  function makeFlaggedActor(flags = {}) {
    return { getFlag: jest.fn((scope, key) => flags[key]) };
  }

  test("read their own turn-scoped flag when set with no active Combat", () => {
    const actor = makeFlaggedActor({
      omegaEnhancementChargedUpThisTurn: { combatId: null, round: null, turn: null, essence: 'smarts' },
      omegaEnhancementMuscleThisTurn: { combatId: null, round: null, turn: null },
      omegaEnhancementPowerThisTurn: { combatId: null, round: null, turn: null },
    });
    game.combat = null;

    expect(getChargedUpEssence(actor)).toBe('smarts');
    expect(isMuscleModeActive(actor)).toBe(true);
    expect(isPowerModeActive(actor)).toBe(true);
  });

  test("return null/false with nothing flagged", () => {
    const actor = makeFlaggedActor();
    expect(getChargedUpEssence(actor)).toBeNull();
    expect(isMuscleModeActive(actor)).toBe(false);
    expect(isPowerModeActive(actor)).toBe(false);
  });

  test("read false once a new Combat turn has passed", () => {
    const actor = makeFlaggedActor({
      omegaEnhancementMuscleThisTurn: { combatId: 'combat1', round: 1, turn: 0 },
    });
    game.combat = { id: 'combat1', round: 1, turn: 1 };

    expect(isMuscleModeActive(actor)).toBe(false);
    game.combat = null;
  });
});

describe("activateOmegaEnhancement", () => {
  function makeActor({ power = 1 } = {}) {
    const flagStore = {};
    const actor = {
      system: { powers: { personal: { value: power } } },
      update: jest.fn(async (data) => {
        actor.system.powers.personal.value = data['system.powers.personal.value'];
      }),
      getFlag: jest.fn((scope, key) => flagStore[key]),
      setFlag: jest.fn(async (scope, key, value) => { flagStore[key] = value; }),
      getActiveTokens: jest.fn(() => [makeToken({ id: 'self', disposition: 1 })]),
      _dice: { rollSkill: jest.fn() },
    };
    return actor;
  }

  beforeEach(() => {
    foundry.applications.api.DialogV2.wait.mockReset();
    canvas.tokens.setTargets.mockReset();
    canvas.tokens.placeables = [];
  });

  test("returns false without enough Power, never prompting", async () => {
    const actor = makeActor({ power: 0 });
    expect(await activateOmegaEnhancement(actor)).toBe(false);
    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });

  test("returns false when the picker is cancelled, spending nothing", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeActor({ power: 1 });

    expect(await activateOmegaEnhancement(actor)).toBe(false);
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("Charged-Up Mode spends 1 Power and stamps the chosen Essence", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue({ option: 'chargedUp', essence: 'strength' });
    const actor = makeActor({ power: 1 });

    expect(await activateOmegaEnhancement(actor)).toBe(true);

    expect(actor.system.powers.personal.value).toBe(0);
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'omegaEnhancementChargedUpThisTurn', expect.objectContaining({ essence: 'strength' }),
    );
  });

  test("Muscle Mode spends 1 Power and stamps its own flag", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue({ option: 'muscle', essence: null });
    const actor = makeActor({ power: 1 });

    expect(await activateOmegaEnhancement(actor)).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'omegaEnhancementMuscleThisTurn', expect.anything());
  });

  test("Power Mode spends 1 Power and stamps its own flag", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue({ option: 'power', essence: null });
    const actor = makeActor({ power: 1 });

    expect(await activateOmegaEnhancement(actor)).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'omegaEnhancementPowerThisTurn', expect.anything());
  });

  test("Blast Mode auto-targets nearby enemies and rolls Targeting vs. Evasion", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue({ option: 'blast', essence: null });
    const selfToken = makeToken({ id: 'self', disposition: 1 });
    const enemy1 = makeToken({ id: 'e1', disposition: -1 });
    canvas.tokens.placeables = [selfToken, enemy1];
    const actor = makeActor({ power: 1 });
    actor.getActiveTokens = jest.fn(() => [selfToken]);

    expect(await activateOmegaEnhancement(actor)).toBe(true);

    expect(canvas.tokens.setTargets).toHaveBeenCalledWith(['e1']);
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'targeting', essence: 'speed', defenseType: 'evasion', omegaEnhancementMode: 'blast',
      }),
      actor,
    );
  });

  test("Electro Mode and Light Beam Mode roll without auto-targeting", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue({ option: 'electro', essence: null });
    const actor = makeActor({ power: 1 });

    expect(await activateOmegaEnhancement(actor)).toBe(true);
    expect(canvas.tokens.setTargets).not.toHaveBeenCalled();
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ omegaEnhancementMode: 'electro' }), actor,
    );
  });
});
