import { jest } from '@jest/globals';
import { activateStandTogether, applyStandTogetherHeal, canUseStandTogether } from './stand-together.mjs';

global.ui = { notifications: { warn: jest.fn() } };

function setEpochs({ scene = 1 } = {}) {
  global.game.settings = {
    get: (scope, key) => (key === "sceneClockScene" ? scene : undefined),
  };
}

function makeActor(flags = {}) {
  const store = { ...flags };
  return {
    getFlag: jest.fn((scope, key) => store[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      store[key] = value; 
    }),
    _dice: { rollSkill: jest.fn() },
  };
}

beforeEach(() => {
  global.game = { combat: null, scenes: { current: null }, i18n: { localize: (k) => k } };
  setEpochs();
  ui.notifications.warn.mockReset();
});

describe("canUseStandTogether / activateStandTogether", () => {
  test("usable once per scene, then not again", async () => {
    const actor = makeActor();
    expect(canUseStandTogether(actor)).toBe(true);

    await activateStandTogether(actor);
    expect(canUseStandTogether(actor)).toBe(false);
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'persuasion', essence: 'social', dif: '15', isStandTogether: true }),
      actor,
    );
  });

  test("warns and does not roll a second time this scene", async () => {
    const actor = makeActor();
    await activateStandTogether(actor);
    actor._dice.rollSkill.mockClear();

    await activateStandTogether(actor);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("applyStandTogetherHeal", () => {
  test("heals every nearby ally by REPAIR_AMOUNT * multiplier", async () => {
    const ally1 = { system: { health: { value: 2, max: 5 } }, statuses: new Set(), update: jest.fn() };
    const ally2 = { system: { health: { value: 4, max: 5 } }, statuses: new Set(), update: jest.fn() };
    global.canvas = {
      tokens: { placeables: [{ actor: ally1, document: { disposition: 1 }, center: { x: 0, y: 0 } }, { actor: ally2, document: { disposition: 1 }, center: { x: 0, y: 0 } }] },
      grid: { measurePath: () => ({ distance: 0 }) },
    };
    const actor = { getActiveTokens: () => [{ document: { disposition: 1 }, center: { x: 0, y: 0 } }], items: [] };

    await applyStandTogetherHeal(actor, 3);

    expect(ally1.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
    expect(ally2.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
  });
});
