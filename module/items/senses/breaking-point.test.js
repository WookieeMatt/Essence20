import { jest } from '@jest/globals';
import { activateBreakingPoint, buildBreakingPointResult, pickBreakingPointDetail } from './breaking-point.mjs';

global.game = {
  i18n: {
    localize: (key) => key,
    format: (key, vars) => `${key}:${JSON.stringify(vars)}`,
  },
  user: { targets: { first: jest.fn(() => undefined) } },
};

global.ui = { notifications: { warn: jest.fn() } };

global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };

function makeVehicleActor({ threatLevel = 5, defenses = {}, health = { value: 10, max: 20 }, items = [] } = {}) {
  const defaults = { toughness: 10, evasion: 10, willpower: 10, cleverness: 10 };
  const merged = { ...defaults, ...defenses };
  return {
    type: 'vehicle',
    name: 'Enemy Tank',
    uuid: 'Actor.tank1',
    system: {
      threatLevel,
      defenses: Object.fromEntries(Object.entries(merged).map(([type, value]) => [type, { total: value }])),
      health,
    },
    items,
  };
}

function makeActor() {
  return { _dice: { rollSkill: jest.fn() } };
}

describe("activateBreakingPoint", () => {
  beforeEach(() => {
    ui.notifications.warn.mockClear();
  });

  test("triggers a Technology roll against DIF 10 + the target's Threat Level", async () => {
    const actor = makeActor();
    const target = makeVehicleActor({ threatLevel: 5 });
    game.user.targets.first.mockReturnValue({ actor: target });

    await activateBreakingPoint(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'technology', dif: 15, isBreakingPoint: true, breakingPointTargetUuid: 'Actor.tank1',
      }),
      actor,
    );
  });

  test("warns and does nothing without a targeted vehicle", async () => {
    const actor = makeActor();
    game.user.targets.first.mockReturnValue(undefined);

    await activateBreakingPoint(actor);
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();

    game.user.targets.first.mockReturnValue({ actor: { type: 'playerCharacter' } });
    await activateBreakingPoint(actor);
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("pickBreakingPointDetail", () => {
  test("returns the chosen detail", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('health');
    expect(await pickBreakingPointDetail()).toBe('health');
  });

  test("returns null when cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    expect(await pickBreakingPointDetail()).toBeNull();
  });
});

describe("buildBreakingPointResult", () => {
  test("'defenses' reveals all 4 Defense scores", () => {
    const target = makeVehicleActor({ defenses: { toughness: 8, evasion: 15, willpower: 10, cleverness: 12 } });
    const result = buildBreakingPointResult(target, 'defenses');
    expect(result).toContain('E20.BreakingPointResultDefenses');
    expect(result).toContain('Evasion 15');
  });

  test("'health' reveals current/max Health", () => {
    const target = makeVehicleActor({ health: { value: 3, max: 20 } });
    const result = buildBreakingPointResult(target, 'health');
    expect(result).toContain('"value":3');
    expect(result).toContain('"max":20');
  });

  test("'perk'/'power'/'hangUp' lists every matching item, or 'none known'", () => {
    const target = makeVehicleActor({
      items: [{ type: 'perk', name: 'Reinforced Hull' }, { type: 'power', name: 'Overdrive' }],
    });

    expect(buildBreakingPointResult(target, 'perk')).toContain('Reinforced Hull');
    expect(buildBreakingPointResult(target, 'power')).toContain('Overdrive');
    expect(buildBreakingPointResult(target, 'hangUp')).toContain('E20.BreakingPointResultNoneKnown');
  });
});
