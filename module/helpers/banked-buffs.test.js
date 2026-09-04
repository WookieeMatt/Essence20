import { jest } from '@jest/globals';
import { canUsePerk, consumeRollWithThePunches, onPerkUse } from './banked-buffs.mjs';

const THINK_ON_IT_ID = "Compendium.essence20.gi_joe_crb.Item.M7HNdhqViy0xbUkz";
const PLAN_OF_ACTION_ID = "Compendium.essence20.gi_joe_crb.Item.7wsu99k8v620IB2N";
const INSPIRATION_ID = "Compendium.essence20.gi_joe_crb.Item.j05tN97KZNzl5jTF";
const ROLL_WITH_THE_PUNCHES_ID = "Compendium.essence20.gi_joe_crb.Item.5hBral7hiCPv3GqF";

global.canvas = {
  tokens: { placeables: [] },
  grid: { measurePath: jest.fn(() => ({ distance: 0 })) },
};
global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
global.game = { combat: null, i18n: { localize: (k) => k, format: (k) => k }, user: { targets: new Set() } };
global.foundry = { applications: { api: { DialogV2: { wait: jest.fn() } } } };

function makeActor({ id = 'actor1', name = 'Actor' } = {}) {
  return {
    id, name, items: [], getFlag: jest.fn(() => undefined), setFlag: jest.fn(), unsetFlag: jest.fn(),
    getActiveTokens: jest.fn(() => []),
  };
}

function makePerkItem({ sourceId, actor, currentValue = null }) {
  return {
    type: 'perk',
    name: 'Test Perk',
    parent: actor,
    flags: { core: { sourceId } },
    system: { advances: { currentValue } },
  };
}

describe("canUsePerk", () => {
  test("true for a bankable Perk with no pending bonus yet", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: THINK_ON_IT_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("false for a self-target Perk that already has a pending bonus", () => {
    const actor = makeActor();
    actor.getFlag = jest.fn(() => ({ edge: true, combatId: null, round: null }));
    const item = makePerkItem({ sourceId: THINK_ON_IT_ID, actor });
    expect(canUsePerk(item)).toBe(false);
  });

  test("false for a Perk not in the bankable table", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: "Compendium.essence20.gi_joe_crb.Item.other", actor });
    expect(canUsePerk(item)).toBe(false);
  });

  test("false for a non-perk item", () => {
    const actor = makeActor();
    const item = { type: 'weapon', parent: actor, flags: { core: { sourceId: THINK_ON_IT_ID } } };
    expect(canUsePerk(item)).toBe(false);
  });

  test("false when the item has no parent actor", () => {
    const item = makePerkItem({ sourceId: THINK_ON_IT_ID, actor: null });
    expect(canUsePerk(item)).toBe(false);
  });
});

describe("onPerkUse", () => {
  beforeEach(() => {
    game.user.targets = new Set();
    canvas.tokens.placeables = [];
    foundry.applications.api.DialogV2.wait.mockReset();
    ui.notifications.warn.mockReset();
  });

  test("Think On It (self) banks an Edge directly on the actor", async () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: THINK_ON_IT_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingThinkOnIt', expect.objectContaining({ edge: true }),
    );
  });

  test("Plan of Action (ally) banks a shiftUp on the single already-targeted ally", async () => {
    const actor = makeActor({ id: 'officer' });
    const ally = makeActor({ id: 'ally1', name: 'Duke' });
    game.user.targets = new Set([{ actor: ally }]);
    const item = makePerkItem({ sourceId: PLAN_OF_ACTION_ID, actor, currentValue: 2 });

    await onPerkUse(item);

    expect(ally.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingPlanOfAction', expect.objectContaining({ shiftUp: 2 }),
    );
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("Plan of Action defaults to a shiftUp of 1 with no advance recorded yet", async () => {
    const actor = makeActor({ id: 'officer' });
    const ally = makeActor({ id: 'ally1', name: 'Duke' });
    game.user.targets = new Set([{ actor: ally }]);
    const item = makePerkItem({ sourceId: PLAN_OF_ACTION_ID, actor, currentValue: null });

    await onPerkUse(item);

    expect(ally.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingPlanOfAction', expect.objectContaining({ shiftUp: 1 }),
    );
  });

  test("Plan of Action falls back to a picker dialog with no single target", async () => {
    const actor = makeActor({ id: 'officer' });
    const allyToken = { actor: makeActor({ id: 'ally1', name: 'Duke' }), document: { disposition: 1 } };
    actor.getActiveTokens = jest.fn(() => [{ document: { disposition: 1 }, center: {} }]);
    canvas.tokens.placeables = [{ document: { disposition: 1 }, center: {}, actor: null }, allyToken];
    const item = makePerkItem({ sourceId: PLAN_OF_ACTION_ID, actor, currentValue: 1 });
    foundry.applications.api.DialogV2.wait.mockResolvedValue('ally1');

    await onPerkUse(item);

    expect(foundry.applications.api.DialogV2.wait).toHaveBeenCalled();
    expect(allyToken.actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingPlanOfAction', expect.objectContaining({ shiftUp: 1 }),
    );
  });

  test("Plan of Action does nothing when the picker is cancelled", async () => {
    const actor = makeActor({ id: 'officer' });
    const allyToken = { actor: makeActor({ id: 'ally1', name: 'Duke' }), document: { disposition: 1 } };
    actor.getActiveTokens = jest.fn(() => [{ document: { disposition: 1 }, center: {} }]);
    canvas.tokens.placeables = [allyToken];
    const item = makePerkItem({ sourceId: PLAN_OF_ACTION_ID, actor, currentValue: 1 });
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');

    await onPerkUse(item);

    expect(allyToken.actor.setFlag).not.toHaveBeenCalled();
  });

  test("Plan of Action warns and does nothing with no allies to pick from at all", async () => {
    const actor = makeActor({ id: 'officer' });
    actor.getActiveTokens = jest.fn(() => [{ document: { disposition: 1 }, center: {} }]);
    canvas.tokens.placeables = [];
    const item = makePerkItem({ sourceId: PLAN_OF_ACTION_ID, actor, currentValue: 1 });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });

  test("Inspiration: grants 1 more than normal and affects 2 already-targeted allies", async () => {
    const actor = makeActor({ id: 'officer' });
    actor.items = [{ type: 'perk', flags: { core: { sourceId: INSPIRATION_ID } } }];
    const ally1 = makeActor({ id: 'ally1', name: 'Duke' });
    const ally2 = makeActor({ id: 'ally2', name: 'Scarlett' });
    game.user.targets = new Set([{ actor: ally1 }, { actor: ally2 }]);
    const item = makePerkItem({ sourceId: PLAN_OF_ACTION_ID, actor, currentValue: 2 });

    await onPerkUse(item);

    expect(ally1.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingPlanOfAction', expect.objectContaining({ shiftUp: 3 }),
    );
    expect(ally2.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingPlanOfAction', expect.objectContaining({ shiftUp: 3 }),
    );
  });

  test("Inspiration: without it, targeting 2 allies falls back to the single-ally picker dialog instead", async () => {
    const actor = makeActor({ id: 'officer' });
    const ally1 = makeActor({ id: 'ally1', name: 'Duke' });
    const ally2 = makeActor({ id: 'ally2', name: 'Scarlett' });
    game.user.targets = new Set([{ actor: ally1 }, { actor: ally2 }]);
    actor.getActiveTokens = jest.fn(() => [{ document: { disposition: 1 }, center: {} }]);
    const allyToken = { actor: makeActor({ id: 'ally3', name: 'Flint' }), document: { disposition: 1 } };
    canvas.tokens.placeables = [allyToken];
    const item = makePerkItem({ sourceId: PLAN_OF_ACTION_ID, actor, currentValue: 2 });
    foundry.applications.api.DialogV2.wait.mockResolvedValue('ally3');

    await onPerkUse(item);

    expect(foundry.applications.api.DialogV2.wait).toHaveBeenCalled();
    expect(allyToken.actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingPlanOfAction', expect.objectContaining({ shiftUp: 2 }),
    );
    expect(ally1.setFlag).not.toHaveBeenCalled();
    expect(ally2.setFlag).not.toHaveBeenCalled();
  });

  test("Inspiration doesn't affect Think On It (self-only, no ally upgrade)", async () => {
    const actor = makeActor();
    actor.items = [{ type: 'perk', flags: { core: { sourceId: INSPIRATION_ID } } }];
    const item = makePerkItem({ sourceId: THINK_ON_IT_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingThinkOnIt', expect.objectContaining({ edge: true }),
    );
  });

  test("does nothing for a Perk not in the bankable table", async () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: "Compendium.essence20.gi_joe_crb.Item.other", actor });

    await onPerkUse(item);

    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("Roll With the Punches: prompts for a Defense, banks it, and marks the encounter used", async () => {
    game.combat = { id: 'combat1', round: 1 };
    const actor = makeActor();
    foundry.applications.api.DialogV2.wait.mockResolvedValue('willpower');
    const item = makePerkItem({ sourceId: ROLL_WITH_THE_PUNCHES_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingRollWithThePunches', expect.objectContaining({ defenseType: 'willpower' }),
    );
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'rollWithThePunchesUsedThisEncounter', expect.anything(),
    );
    game.combat = null;
  });

  test("Roll With the Punches: does nothing when the Defense picker is cancelled", async () => {
    const actor = makeActor();
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const item = makePerkItem({ sourceId: ROLL_WITH_THE_PUNCHES_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe("Roll With the Punches: canUsePerk's once-per-encounter gate", () => {
  afterEach(() => {
    game.combat = null;
  });

  test("true with the Perk, no pending bank, and not yet used this encounter", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: ROLL_WITH_THE_PUNCHES_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("false once already used this encounter, even with no pending bank", () => {
    game.combat = { id: 'combat1', round: 1 };
    const actor = makeActor();
    actor.getFlag = jest.fn((scope, key) => (
      key == 'rollWithThePunchesUsedThisEncounter' ? { combatId: 'combat1' } : undefined
    ));
    const item = makePerkItem({ sourceId: ROLL_WITH_THE_PUNCHES_ID, actor });
    expect(canUsePerk(item)).toBe(false);
  });

  test("true again in a new encounter", () => {
    game.combat = { id: 'combat2', round: 1 };
    const actor = makeActor();
    actor.getFlag = jest.fn((scope, key) => (
      key == 'rollWithThePunchesUsedThisEncounter' ? { combatId: 'combat1' } : undefined
    ));
    const item = makePerkItem({ sourceId: ROLL_WITH_THE_PUNCHES_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });
});

describe("consumeRollWithThePunches", () => {
  afterEach(() => {
    game.combat = null;
  });

  test("consumes and returns true when the banked Defense matches", async () => {
    const actor = makeActor();
    actor.getFlag = jest.fn((scope, key) => (
      key == 'pendingRollWithThePunches' ? { defenseType: 'toughness', combatId: null, round: null } : undefined
    ));

    const result = await consumeRollWithThePunches(actor, 'toughness');

    expect(result).toBe(true);
    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'pendingRollWithThePunches');
  });

  test("doesn't consume, and returns false, when the banked Defense doesn't match", async () => {
    const actor = makeActor();
    actor.getFlag = jest.fn((scope, key) => (
      key == 'pendingRollWithThePunches' ? { defenseType: 'toughness', combatId: null, round: null } : undefined
    ));

    const result = await consumeRollWithThePunches(actor, 'evasion');

    expect(result).toBe(false);
    expect(actor.unsetFlag).not.toHaveBeenCalled();
  });

  test("returns false with nothing banked", async () => {
    const actor = makeActor();

    const result = await consumeRollWithThePunches(actor, 'toughness');

    expect(result).toBe(false);
    expect(actor.unsetFlag).not.toHaveBeenCalled();
  });
});
