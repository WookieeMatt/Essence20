import { jest } from '@jest/globals';
import { canDeclareCombatStance, checkCombatStance, declareCombatStance, getCombatStanceNumber } from './combat-stance.mjs';

global.game = {
  i18n: { localize: (key) => key, format: (key) => key },
  user: { targets: { first: jest.fn(() => undefined) } },
  combat: null,
};

global.ui = {
  notifications: { warn: jest.fn(), info: jest.fn() },
};

const CONTINUOUS_STANCE_ID = "Compendium.essence20.through_the_shattered_grid.Item.yNtX8ky7O8v50C5l";

function makePerkItem(sourceId) {
  return { type: 'perk', flags: { core: { sourceId } } };
}

function makeActor({ hasContinuousStance = false, level = 5, usedThisEncounter = false } = {}) {
  const flagStore = { combatStanceUsedThisEncounter: usedThisEncounter ? { combatId: 'combat1' } : undefined };
  return {
    items: hasContinuousStance ? [makePerkItem(CONTINUOUS_STANCE_ID)] : [],
    system: { level },
    getFlag: jest.fn((scope, key) => flagStore[key]),
    setFlag: jest.fn((scope, key, value) => {
      flagStore[key] = value; 
    }),
  };
}

function makeTargetActor({ threatLevel = 5 } = {}) {
  return { uuid: 'Actor.target1', system: { threatLevel } };
}

describe("getCombatStanceNumber", () => {
  test("1 without Continuous Stance", () => {
    expect(getCombatStanceNumber(makeActor({ hasContinuousStance: false }))).toBe(1);
  });

  test("2 with Continuous Stance", () => {
    expect(getCombatStanceNumber(makeActor({ hasContinuousStance: true }))).toBe(2);
  });
});

describe("canDeclareCombatStance", () => {
  test("true when not yet used this scene", () => {
    expect(canDeclareCombatStance(makeActor({ usedThisEncounter: false }))).toBe(true);
  });

  test("false once already used this scene, without Continuous Stance", () => {
    game.combat = { id: 'combat1' };
    expect(canDeclareCombatStance(makeActor({ usedThisEncounter: true }))).toBe(false);
    game.combat = null;
  });

  test("always true with Continuous Stance, even if already used this scene", () => {
    game.combat = { id: 'combat1' };
    expect(canDeclareCombatStance(makeActor({ hasContinuousStance: true, usedThisEncounter: true }))).toBe(true);
    game.combat = null;
  });
});

describe("declareCombatStance", () => {
  let originalTargets;
  beforeEach(() => {
    originalTargets = game.user.targets;
    game.combat = { id: 'combat1' };
  });
  afterEach(() => {
    game.user.targets = originalTargets;
    game.combat = null;
  });

  test("marks the currently-targeted enemy and marks the scene used", async () => {
    const actor = makeActor({ level: 5 });
    const target = makeTargetActor({ threatLevel: 5 });
    game.user.targets = { first: () => ({ actor: target }) };

    const declared = await declareCombatStance(actor);

    expect(declared).toBe(true);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'combatStanceTargetUuid', target.uuid);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'combatStanceUsedThisEncounter', expect.anything());
  });

  test("doesn't mark the scene used with Continuous Stance", async () => {
    const actor = makeActor({ level: 5, hasContinuousStance: true });
    const target = makeTargetActor({ threatLevel: 5 });
    game.user.targets = { first: () => ({ actor: target }) };

    await declareCombatStance(actor);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'combatStanceTargetUuid', target.uuid);
    expect(actor.setFlag).not.toHaveBeenCalledWith('essence20', 'combatStanceUsedThisEncounter', expect.anything());
  });

  test("fails with no target", async () => {
    const actor = makeActor();
    game.user.targets = { first: () => undefined };

    const declared = await declareCombatStance(actor);

    expect(declared).toBe(false);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("fails when the target's Threat Level is too far below the actor's own level", async () => {
    const actor = makeActor({ level: 10 });
    const target = makeTargetActor({ threatLevel: 6 }); // 10 - 6 = 4, more than the 3-level gap
    game.user.targets = { first: () => ({ actor: target }) };

    const declared = await declareCombatStance(actor);

    expect(declared).toBe(false);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("succeeds at exactly the 3-level gap", async () => {
    const actor = makeActor({ level: 10 });
    const target = makeTargetActor({ threatLevel: 7 }); // 10 - 7 = 3, exactly the limit
    game.user.targets = { first: () => ({ actor: target }) };

    const declared = await declareCombatStance(actor);

    expect(declared).toBe(true);
  });
});

describe("checkCombatStance", () => {
  test("true when the target matches the actor's own stored foe", () => {
    const actor = { getFlag: jest.fn(() => 'Actor.target1') };
    expect(checkCombatStance(actor, { uuid: 'Actor.target1' })).toBe(true);
  });

  test("false when the target doesn't match", () => {
    const actor = { getFlag: jest.fn(() => 'Actor.target1') };
    expect(checkCombatStance(actor, { uuid: 'Actor.other' })).toBe(false);
  });

  test("false when nothing is marked", () => {
    const actor = { getFlag: jest.fn(() => undefined) };
    expect(checkCombatStance(actor, { uuid: 'Actor.target1' })).toBe(false);
  });

  test("false when the target has no uuid (avoids an undefined == undefined false positive)", () => {
    const actor = { getFlag: jest.fn(() => undefined) };
    expect(checkCombatStance(actor, {})).toBe(false);
  });
});
