import { jest } from '@jest/globals';

import {
  hasSnortleableTarget,
  MIND_AFFECTING_STATUSES,
  onActivateSnortleAtTheSpooky,
  snortleAtTheSpooky,
} from './snortle-at-the-spooky.mjs';

const PLAY_TO_THE_CROWD_PERK_ID = "Compendium.essence20.mlp_crb.Item.2LZ9H8bmrMECGHjA";

function makeTargetToken(name, statuses = []) {
  return {
    actor: {
      name,
      statuses: new Set(statuses),
      toggleStatusEffect: jest.fn(async () => {}),
    },
  };
}

function makeActor({ cheerValue = 2, useUnlimitedResource = false, hasCheerPoints = true, hasPlayToTheCrowd = false } = {}) {
  const rolePoints = hasCheerPoints
    ? { name: 'Cheer Points', system: { resource: { value: cheerValue } }, update: jest.fn(async (changes) => changes) }
    : null;
  const perkItems = hasPlayToTheCrowd
    ? [{ type: 'perk', flags: {}, _stats: { compendiumSource: PLAY_TO_THE_CROWD_PERK_ID } }]
    : [];

  return {
    name: 'Pinkie Pie',
    system: { useUnlimitedResource },
    items: {
      documentsByType: { rolePoints: rolePoints ? [rolePoints] : [] },
      some: (predicate) => perkItems.some(predicate),
    },
    _rolePoints: rolePoints,
  };
}

beforeEach(() => {
  global.game.user = { targets: [] };
  global.CONFIG.statusEffects = [
    { id: 'frightened', name: 'E20.StatusFrightened' },
    { id: 'mesmerized', name: 'E20.StatusMesmerized' },
    { id: 'prone', name: 'E20.StatusProne' },
  ];
});

afterEach(() => {
  delete global.game.user;
  jest.clearAllMocks();
});

describe("MIND_AFFECTING_STATUSES", () => {
  test("includes Frightened and Mesmerized", () => {
    expect(MIND_AFFECTING_STATUSES).toEqual(expect.arrayContaining(['frightened', 'mesmerized']));
  });
});

describe("hasSnortleableTarget", () => {
  test("false when there's no target", () => {
    expect(hasSnortleableTarget()).toBe(false);
  });

  test("false when the target has no mind-affecting condition", () => {
    game.user.targets = [makeTargetToken('Applejack', ['prone'])];
    expect(hasSnortleableTarget()).toBe(false);
  });

  test("true when the target is Frightened", () => {
    game.user.targets = [makeTargetToken('Fluttershy', ['frightened'])];
    expect(hasSnortleableTarget()).toBe(true);
  });
});

describe("snortleAtTheSpooky", () => {
  test("fails with no target at all", async () => {
    const actor = makeActor();
    expect(await snortleAtTheSpooky(actor)).toBe(false);
    expect(ui.notifications.error).toHaveBeenCalledWith("E20.SnortleNoTarget");
  });

  test("fails when every target has nothing to cure", async () => {
    game.user.targets = [makeTargetToken('Applejack', ['prone'])];
    const actor = makeActor();
    expect(await snortleAtTheSpooky(actor)).toBe(false);
    expect(ui.notifications.error).toHaveBeenCalledWith("E20.SnortleNothingToCure");
  });

  test("fails when the actor has no Cheer Points pool at all", async () => {
    game.user.targets = [makeTargetToken('Fluttershy', ['frightened'])];
    const actor = makeActor({ hasCheerPoints: false });
    expect(await snortleAtTheSpooky(actor)).toBe(false);
    expect(ui.notifications.error).toHaveBeenCalledWith("E20.RolePointsOverSpent");
  });

  test("fails when the Cheer Points pool is too small for the cost", async () => {
    game.user.targets = [makeTargetToken('Fluttershy', ['frightened'])];
    const actor = makeActor({ cheerValue: 0 });
    expect(await snortleAtTheSpooky(actor)).toBe(false);
    expect(ui.notifications.error).toHaveBeenCalledWith("E20.RolePointsOverSpent");
  });

  test("spends 1 Cheer Point and cures a single target's condition", async () => {
    const fluttershy = makeTargetToken('Fluttershy', ['frightened']);
    game.user.targets = [fluttershy];
    const actor = makeActor({ cheerValue: 2 });

    expect(await snortleAtTheSpooky(actor)).toBe(true);
    expect(actor._rolePoints.update).toHaveBeenCalledWith({ "system.resource.value": 1 });
    expect(fluttershy.actor.toggleStatusEffect).toHaveBeenCalledWith('frightened', { active: false });
    expect(ui.notifications.info).toHaveBeenCalled();
  });

  test("an unlimited-resource actor cures the target without spending a point", async () => {
    const fluttershy = makeTargetToken('Fluttershy', ['mesmerized']);
    game.user.targets = [fluttershy];
    const actor = makeActor({ cheerValue: 0, useUnlimitedResource: true });

    expect(await snortleAtTheSpooky(actor)).toBe(true);
    expect(actor._rolePoints.update).not.toHaveBeenCalled();
    expect(fluttershy.actor.toggleStatusEffect).toHaveBeenCalledWith('mesmerized', { active: false });
  });

  describe("multiple targets", () => {
    test("without Play to the Crowd, only the first eligible target is cured for 1 Cheer", async () => {
      const fluttershy = makeTargetToken('Fluttershy', ['frightened']);
      const rarity = makeTargetToken('Rarity', ['mesmerized']);
      game.user.targets = [fluttershy, rarity];
      const actor = makeActor({ cheerValue: 3, hasPlayToTheCrowd: false });

      expect(await snortleAtTheSpooky(actor)).toBe(true);
      expect(actor._rolePoints.update).toHaveBeenCalledWith({ "system.resource.value": 2 });
      expect(fluttershy.actor.toggleStatusEffect).toHaveBeenCalled();
      expect(rarity.actor.toggleStatusEffect).not.toHaveBeenCalled();
    });

    test("with Play to the Crowd, every eligible target is cured for 1 Cheer each", async () => {
      const fluttershy = makeTargetToken('Fluttershy', ['frightened']);
      const rarity = makeTargetToken('Rarity', ['mesmerized']);
      game.user.targets = [fluttershy, rarity];
      const actor = makeActor({ cheerValue: 3, hasPlayToTheCrowd: true });

      expect(await snortleAtTheSpooky(actor)).toBe(true);
      expect(actor._rolePoints.update).toHaveBeenCalledWith({ "system.resource.value": 1 });
      expect(fluttershy.actor.toggleStatusEffect).toHaveBeenCalledWith('frightened', { active: false });
      expect(rarity.actor.toggleStatusEffect).toHaveBeenCalledWith('mesmerized', { active: false });
    });

    test("recognizes Play to the Crowd granted via a Role's items map (flags.core.sourceId), not just a manual drop (_stats.compendiumSource)", async () => {
      const fluttershy = makeTargetToken('Fluttershy', ['frightened']);
      const rarity = makeTargetToken('Rarity', ['mesmerized']);
      game.user.targets = [fluttershy, rarity];
      const actor = makeActor({ cheerValue: 3, hasPlayToTheCrowd: false });
      actor.items.some = (predicate) => [
        { type: 'perk', flags: { core: { sourceId: PLAY_TO_THE_CROWD_PERK_ID } }, _stats: {} },
      ].some(predicate);

      expect(await snortleAtTheSpooky(actor)).toBe(true);
      expect(actor._rolePoints.update).toHaveBeenCalledWith({ "system.resource.value": 1 });
      expect(fluttershy.actor.toggleStatusEffect).toHaveBeenCalled();
      expect(rarity.actor.toggleStatusEffect).toHaveBeenCalled();
    });

    test("with Play to the Crowd but too few Cheer Points for every target, nothing is cured", async () => {
      const fluttershy = makeTargetToken('Fluttershy', ['frightened']);
      const rarity = makeTargetToken('Rarity', ['mesmerized']);
      game.user.targets = [fluttershy, rarity];
      const actor = makeActor({ cheerValue: 1, hasPlayToTheCrowd: true });

      expect(await snortleAtTheSpooky(actor)).toBe(false);
      expect(fluttershy.actor.toggleStatusEffect).not.toHaveBeenCalled();
      expect(rarity.actor.toggleStatusEffect).not.toHaveBeenCalled();
    });
  });
});

describe("onActivateSnortleAtTheSpooky", () => {
  test("does nothing when the item has no owning actor", async () => {
    global.fromUuid.mockResolvedValue({ parent: null });
    await onActivateSnortleAtTheSpooky({ target: { dataset: { uuid: 'Actor.x.Item.y' } } });
    expect(ui.notifications.error).not.toHaveBeenCalled();
  });

  test("resolves the item's owning actor and performs the ability", async () => {
    const fluttershy = makeTargetToken('Fluttershy', ['frightened']);
    game.user.targets = [fluttershy];
    const actor = makeActor({ cheerValue: 1 });
    global.fromUuid.mockResolvedValue({ parent: actor });

    await onActivateSnortleAtTheSpooky({ target: { dataset: { uuid: 'Actor.x.Item.y' } } });
    expect(fluttershy.actor.toggleStatusEffect).toHaveBeenCalledWith('frightened', { active: false });
  });
});
