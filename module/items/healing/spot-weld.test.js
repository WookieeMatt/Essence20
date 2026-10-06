import { jest } from '@jest/globals';
import {
  activateSpotWeld, applySpotWeldHeal, canUseSpotWeld, hasHighTechnology, resolveSpotWeldTarget,
} from './spot-weld.mjs';

global.game = { user: { targets: { first: jest.fn() } }, combat: null };
global.canvas = { grid: { measurePath: jest.fn() } };

function makeActor({
  energon = 1, usedFlag = undefined, technologyShift = 'd20', hasToken = true,
} = {}) {
  const flagStore = { spotWeldUsedThisEncounter: usedFlag };
  return {
    system: {
      energon: { normal: { value: energon } },
      skills: { technology: { shift: technologyShift } },
      health: { value: 3, max: 5 },
    },
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn(async (scope, key, value) => {
      flagStore[key] = value;
    }),
    getActiveTokens: jest.fn(() => (hasToken ? [{ center: { x: 0, y: 0 } }] : [])),
    update: jest.fn(),
    _dice: { rollSkill: jest.fn() },
  };
}

beforeEach(() => {
  game.combat = { id: 'combat1', round: 1, turn: 0 };
  game.user.targets.first.mockReset();
});

afterEach(() => {
  game.combat = null;
});

describe("canUseSpotWeld", () => {
  test("true with an Energon Point available and not yet used this scene", () => {
    expect(canUseSpotWeld(makeActor({ energon: 1 }))).toBe(true);
  });

  test("false without an Energon Point", () => {
    expect(canUseSpotWeld(makeActor({ energon: 0 }))).toBe(false);
  });

  test("false once already used this scene", () => {
    const actor = makeActor({ usedFlag: { epoch: 1, window: 'encounter', count: 1 } });
    expect(canUseSpotWeld(actor)).toBe(false);
  });
});

describe("resolveSpotWeldTarget", () => {
  test("defaults to the actor themselves with no target selected", () => {
    game.user.targets.first.mockReturnValue(undefined);
    const actor = makeActor();
    expect(resolveSpotWeldTarget(actor)).toBe(actor);
  });

  test("an ally within reach resolves to that ally", () => {
    const actorToken = { center: { x: 0, y: 0 } };
    const allyActor = { name: 'Ally' };
    const allyToken = { center: { x: 5, y: 0 }, actor: allyActor };
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });
    game.user.targets.first.mockReturnValue(allyToken);
    const actor = makeActor();
    actor.getActiveTokens = jest.fn(() => [actorToken]);

    expect(resolveSpotWeldTarget(actor)).toBe(allyActor);
  });

  test("null for an ally out of reach", () => {
    const actorToken = { center: { x: 0, y: 0 } };
    const allyToken = { center: { x: 50, y: 0 }, actor: { name: 'Ally' } };
    canvas.grid.measurePath.mockReturnValue({ distance: 50 });
    game.user.targets.first.mockReturnValue(allyToken);
    const actor = makeActor();
    actor.getActiveTokens = jest.fn(() => [actorToken]);

    expect(resolveSpotWeldTarget(actor)).toBeNull();
  });

  test("targeting the actor's own token resolves to the actor", () => {
    const actorToken = { center: { x: 0, y: 0 } };
    const actor = makeActor();
    actor.getActiveTokens = jest.fn(() => [actorToken]);
    game.user.targets.first.mockReturnValue(actorToken);

    expect(resolveSpotWeldTarget(actor)).toBe(actor);
  });
});

describe("hasHighTechnology", () => {
  // E20.skillShiftList orders trainable shifts best-to-worst as d12, d10, d8, d6, d4, d2, d20
  // (untrained) - "at least +d6" means d6, d8, d10, or d12; d4/d2 are trained but below that
  // threshold, same ordering getSkillRanks (combat.mjs) already relies on.
  test("true at d6 or better", () => {
    expect(hasHighTechnology(makeActor({ technologyShift: 'd6' }))).toBe(true);
    expect(hasHighTechnology(makeActor({ technologyShift: 'd8' }))).toBe(true);
    expect(hasHighTechnology(makeActor({ technologyShift: 'd12' }))).toBe(true);
  });

  test("false below d6 (d4/d2) or untrained (d20)", () => {
    expect(hasHighTechnology(makeActor({ technologyShift: 'd4' }))).toBe(false);
    expect(hasHighTechnology(makeActor({ technologyShift: 'd2' }))).toBe(false);
    expect(hasHighTechnology(makeActor({ technologyShift: 'd20' }))).toBe(false);
  });
});

describe("activateSpotWeld", () => {
  test("spends an Energon Point, marks the scene used, and rolls DIF 12 for 1 Health without high Technology", async () => {
    game.user.targets.first.mockReturnValue(undefined);
    const actor = makeActor({ energon: 2, technologyShift: 'd20' });

    const target = await activateSpotWeld(actor);

    expect(target).toBe(actor);
    expect(actor.update).toHaveBeenCalledWith({ 'system.energon.normal.value': 1 });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'spotWeldUsedThisEncounter', expect.objectContaining({ epoch: 1, window: 'encounter', count: 1 }),
    );
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: 'technology', dif: '12', isSpotWeldAttempt: true, spotWeldHealAmount: 1,
        isSpotWeldSelfHeal: true,
      }),
      actor,
    );
  });

  test("rolls DIF 17 for 2 Health with at least +d6 in Technology", async () => {
    game.user.targets.first.mockReturnValue(undefined);
    const actor = makeActor({ energon: 1, technologyShift: 'd8' });

    await activateSpotWeld(actor);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ dif: '17', spotWeldHealAmount: 2 }),
      actor,
    );
  });

  test("targeting an ally doesn't set the self-heal Snag flag", async () => {
    const actorToken = { center: { x: 0, y: 0 } };
    const allyActor = { name: 'Ally', uuid: 'Actor.ally1' };
    const allyToken = { center: { x: 5, y: 0 }, actor: allyActor };
    canvas.grid.measurePath.mockReturnValue({ distance: 5 });
    game.user.targets.first.mockReturnValue(allyToken);
    const actor = makeActor();
    actor.getActiveTokens = jest.fn(() => [actorToken]);

    const target = await activateSpotWeld(actor);

    expect(target).toBe(allyActor);
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ spotWeldTargetUuid: 'Actor.ally1', isSpotWeldSelfHeal: false }),
      actor,
    );
  });

  test("spends and rolls nothing with no valid target in reach", async () => {
    const actorToken = { center: { x: 0, y: 0 } };
    const allyToken = { center: { x: 50, y: 0 }, actor: { name: 'Ally' } };
    canvas.grid.measurePath.mockReturnValue({ distance: 50 });
    game.user.targets.first.mockReturnValue(allyToken);
    const actor = makeActor();
    actor.getActiveTokens = jest.fn(() => [actorToken]);

    const target = await activateSpotWeld(actor);

    expect(target).toBeNull();
    expect(actor.update).not.toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("applySpotWeldHeal", () => {
  test("heals the target by the given amount", async () => {
    const target = { system: { health: { value: 3, max: 5 } }, update: jest.fn() };
    await applySpotWeldHeal(target, 1);
    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 4 });
  });

  test("doesn't heal past max Health", async () => {
    const target = { system: { health: { value: 4, max: 5 } }, update: jest.fn() };
    await applySpotWeldHeal(target, 2);
    expect(target.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
  });
});
