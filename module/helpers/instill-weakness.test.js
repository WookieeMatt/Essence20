import { jest } from '@jest/globals';
import { applyInstillWeakness, getInstillWeaknessDamageType } from './instill-weakness.mjs';

global.game = {
  scenes: { current: { id: 'scene1' } },
  i18n: { localize: (key) => key, format: (key) => key },
};

global.foundry = {
  applications: {
    api: {
      DialogV2: {
        wait: jest.fn(),
      },
    },
  },
};

function makeActor(energon = 1) {
  return {
    system: { energon: { normal: { value: energon } } },
    update: jest.fn(),
  };
}

function makeTarget() {
  return { getFlag: jest.fn(() => undefined), setFlag: jest.fn() };
}

describe("getInstillWeaknessDamageType", () => {
  test("returns the marked damage type when set in the current scene", () => {
    const target = makeTarget();
    target.getFlag.mockReturnValue({ sceneId: 'scene1', damageType: 'fire' });
    expect(getInstillWeaknessDamageType(target)).toBe('fire');
  });

  test("returns null when the mark is from a different scene", () => {
    const target = makeTarget();
    target.getFlag.mockReturnValue({ sceneId: 'scene2', damageType: 'fire' });
    expect(getInstillWeaknessDamageType(target)).toBeNull();
  });

  test("returns null when nothing is marked", () => {
    expect(getInstillWeaknessDamageType(makeTarget())).toBeNull();
  });
});

describe("applyInstillWeakness", () => {
  beforeEach(() => {
    global.foundry.applications.api.DialogV2.wait.mockReset();
  });

  test("spends 1 Energon and marks the target with the chosen damage type", async () => {
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue('fire');
    const actor = makeActor(2);
    const target = makeTarget();

    await applyInstillWeakness(actor, target);

    expect(actor.update).toHaveBeenCalledWith({ 'system.energon.normal.value': 1 });
    expect(target.setFlag).toHaveBeenCalledWith(
      'essence20', 'instillWeaknessState', { sceneId: 'scene1', damageType: 'fire' },
    );
  });

  test("does nothing without enough Energon", async () => {
    const actor = makeActor(0);
    const target = makeTarget();

    await applyInstillWeakness(actor, target);

    expect(global.foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
    expect(target.setFlag).not.toHaveBeenCalled();
  });

  test("does nothing if the damage type picker is cancelled", async () => {
    global.foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeActor(1);
    const target = makeTarget();

    await applyInstillWeakness(actor, target);

    expect(actor.update).not.toHaveBeenCalled();
    expect(target.setFlag).not.toHaveBeenCalled();
  });
});
