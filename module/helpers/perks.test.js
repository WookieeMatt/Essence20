import { jest } from '@jest/globals';
import {
  actorHasHangUp, actorHasPerk, bankPendingBonus, clearPendingBonus, findHangUp, findPerk, getPendingBonus,
  getUsesThisEncounter, getUsesThisScene, hasUsedThisEncounter, hasUsedThisRound, hasUsedThisTurn,
  markUsedThisEncounter, markUsedThisEncounterCount, markUsedThisRound, markUsedThisScene, markUsedThisTurn,
} from './perks.mjs';

global.game = { combat: null, scenes: { current: null } };

/* findPerk */
describe("findPerk", () => {
  const PERK_ID = "Compendium.essence20.gi_joe_crb.Item.2LtDCHxgg9bMvWQK";

  function makeActor(items) {
    return { items };
  }

  test("returns the matching Perk item", () => {
    const perkItem = { type: 'perk', flags: { core: { sourceId: PERK_ID } }, system: { choice: 'defense' } };
    const actor = makeActor([perkItem]);
    expect(findPerk(actor, PERK_ID)).toBe(perkItem);
  });

  test("returns undefined when there's no match", () => {
    const actor = makeActor([{ type: 'perk', flags: { core: { sourceId: "Compendium.essence20.gi_joe_crb.Item.other" } } }]);
    expect(findPerk(actor, PERK_ID)).toBeUndefined();
  });

  test("actorHasPerk is true exactly when findPerk finds something", () => {
    const perkItem = { type: 'perk', flags: { core: { sourceId: PERK_ID } } };
    const actor = makeActor([perkItem]);
    expect(actorHasPerk(actor, PERK_ID)).toBe(true);
    expect(actorHasPerk(makeActor([]), PERK_ID)).toBe(false);
  });
});

/* findHangUp / actorHasHangUp */
describe("findHangUp", () => {
  const HANGUP_ID = "Compendium.essence20.field_guide_action_adventure.Item.gUrBCm0G8ntInUar";

  function makeActor(items) {
    return { items };
  }

  test("returns the matching Hang-Up item", () => {
    const hangUpItem = { type: 'hangUp', flags: { core: { sourceId: HANGUP_ID } } };
    const actor = makeActor([hangUpItem]);
    expect(findHangUp(actor, HANGUP_ID)).toBe(hangUpItem);
  });

  test("returns undefined when there's no match", () => {
    const actor = makeActor([{ type: 'hangUp', flags: { core: { sourceId: "Compendium.essence20.field_guide_action_adventure.Item.other" } } }]);
    expect(findHangUp(actor, HANGUP_ID)).toBeUndefined();
  });

  test("ignores a perk-type item that happens to share the sourceId - findPerk()'s own blind spot this exists to cover", () => {
    const actor = makeActor([{ type: 'perk', flags: { core: { sourceId: HANGUP_ID } } }]);
    expect(findHangUp(actor, HANGUP_ID)).toBeUndefined();
  });

  test("actorHasHangUp is true exactly when findHangUp finds something", () => {
    const hangUpItem = { type: 'hangUp', flags: { core: { sourceId: HANGUP_ID } } };
    expect(actorHasHangUp(makeActor([hangUpItem]), HANGUP_ID)).toBe(true);
    expect(actorHasHangUp(makeActor([]), HANGUP_ID)).toBe(false);
  });

  test("Matured (Cobra Codex, General Perk, p.176): skips a Hang-Up flagged maturedIgnored", () => {
    const hangUpItem = {
      type: 'hangUp', flags: { core: { sourceId: HANGUP_ID } },
      getFlag: jest.fn((scope, key) => (key == 'maturedIgnored' ? true : undefined)),
    };
    const actor = makeActor([hangUpItem]);
    expect(findHangUp(actor, HANGUP_ID)).toBeUndefined();
    expect(actorHasHangUp(actor, HANGUP_ID)).toBe(false);
  });
});

/* actorHasPerk */
describe("actorHasPerk", () => {
  const PERK_ID = "Compendium.essence20.gi_joe_crb.Item.hx4KzTl8iQ8Z22eq";

  function makeActor(items) {
    return { items };
  }

  test("true when a Perk's flags.core.sourceId matches", () => {
    const actor = makeActor([{ type: 'perk', flags: { core: { sourceId: PERK_ID } } }]);
    expect(actorHasPerk(actor, PERK_ID)).toBe(true);
  });

  test("true when only _stats.compendiumSource matches (no flags.core.sourceId set)", () => {
    const actor = makeActor([{ type: 'perk', flags: {}, _stats: { compendiumSource: PERK_ID } }]);
    expect(actorHasPerk(actor, PERK_ID)).toBe(true);
  });

  test("false when the actor has no matching Perk", () => {
    const actor = makeActor([{ type: 'perk', flags: { core: { sourceId: "Compendium.essence20.gi_joe_crb.Item.other" } } }]);
    expect(actorHasPerk(actor, PERK_ID)).toBe(false);
  });

  test("false when the actor has no items at all", () => {
    const actor = makeActor([]);
    expect(actorHasPerk(actor, PERK_ID)).toBe(false);
  });

  test("ignores a non-Perk item that happens to share the sourceId", () => {
    const actor = makeActor([{ type: 'weapon', flags: { core: { sourceId: PERK_ID } } }]);
    expect(actorHasPerk(actor, PERK_ID)).toBe(false);
  });
});

/* hasUsedThisRound / markUsedThisRound */
describe("hasUsedThisRound / markUsedThisRound", () => {
  beforeEach(() => {
    game.combat = null;
  });

  test("hasUsedThisRound is false outside of combat regardless of any stored flag", () => {
    const actor = { getFlag: jest.fn(() => ({ combatId: 'combat1', round: 1 })) };
    expect(hasUsedThisRound(actor, 'someFlag')).toBe(false);
  });

  test("hasUsedThisRound is true when the flag matches the current combat and round", () => {
    game.combat = { id: 'combat1', round: 2 };
    const actor = { getFlag: jest.fn(() => ({ combatId: 'combat1', round: 2 })) };
    expect(hasUsedThisRound(actor, 'someFlag')).toBe(true);
  });

  test("hasUsedThisRound is false once the round advances", () => {
    game.combat = { id: 'combat1', round: 3 };
    const actor = { getFlag: jest.fn(() => ({ combatId: 'combat1', round: 2 })) };
    expect(hasUsedThisRound(actor, 'someFlag')).toBe(false);
  });

  test("hasUsedThisRound is false for a stale flag from a different combat", () => {
    game.combat = { id: 'newCombat', round: 1 };
    const actor = { getFlag: jest.fn(() => ({ combatId: 'oldCombat', round: 5 })) };
    expect(hasUsedThisRound(actor, 'someFlag')).toBe(false);
  });

  test("markUsedThisRound records the current combat's id and round under the given flag key", async () => {
    game.combat = { id: 'combat1', round: 4 };
    const actor = { setFlag: jest.fn() };
    await markUsedThisRound(actor, 'someFlag');
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'someFlag', { combatId: 'combat1', round: 4 });
  });

  test("markUsedThisRound no-ops outside of combat", async () => {
    const actor = { setFlag: jest.fn() };
    await markUsedThisRound(actor, 'someFlag');
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

/* hasUsedThisTurn / markUsedThisTurn */
describe("hasUsedThisTurn / markUsedThisTurn", () => {
  beforeEach(() => {
    game.combat = null;
  });

  test("hasUsedThisTurn is false outside of combat regardless of any stored flag", () => {
    const actor = { getFlag: jest.fn(() => ({ combatId: 'combat1', round: 1, turn: 0 })) };
    expect(hasUsedThisTurn(actor, 'someFlag')).toBe(false);
  });

  test("hasUsedThisTurn is true when the flag matches the current combat, round, and turn", () => {
    game.combat = { id: 'combat1', round: 2, turn: 1 };
    const actor = { getFlag: jest.fn(() => ({ combatId: 'combat1', round: 2, turn: 1 })) };
    expect(hasUsedThisTurn(actor, 'someFlag')).toBe(true);
  });

  test("hasUsedThisTurn is false once it becomes a different combatant's turn, same round", () => {
    game.combat = { id: 'combat1', round: 2, turn: 2 };
    const actor = { getFlag: jest.fn(() => ({ combatId: 'combat1', round: 2, turn: 1 })) };
    expect(hasUsedThisTurn(actor, 'someFlag')).toBe(false);
  });

  test("hasUsedThisTurn is false once the round advances", () => {
    game.combat = { id: 'combat1', round: 3, turn: 1 };
    const actor = { getFlag: jest.fn(() => ({ combatId: 'combat1', round: 2, turn: 1 })) };
    expect(hasUsedThisTurn(actor, 'someFlag')).toBe(false);
  });

  test("hasUsedThisTurn is false for a stale flag from a different combat", () => {
    game.combat = { id: 'newCombat', round: 1, turn: 0 };
    const actor = { getFlag: jest.fn(() => ({ combatId: 'oldCombat', round: 1, turn: 0 })) };
    expect(hasUsedThisTurn(actor, 'someFlag')).toBe(false);
  });

  test("markUsedThisTurn records the current combat's id, round, and turn under the given flag key", async () => {
    game.combat = { id: 'combat1', round: 4, turn: 3 };
    const actor = { setFlag: jest.fn() };
    await markUsedThisTurn(actor, 'someFlag');
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'someFlag', { combatId: 'combat1', round: 4, turn: 3 });
  });

  test("markUsedThisTurn no-ops outside of combat", async () => {
    const actor = { setFlag: jest.fn() };
    await markUsedThisTurn(actor, 'someFlag');
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

/* hasUsedThisEncounter / markUsedThisEncounter */
describe("hasUsedThisEncounter / markUsedThisEncounter", () => {
  beforeEach(() => {
    game.combat = null;
  });

  test("hasUsedThisEncounter is false outside of combat regardless of any stored flag", () => {
    const actor = { getFlag: jest.fn(() => ({ combatId: 'combat1' })) };
    expect(hasUsedThisEncounter(actor, 'someFlag')).toBe(false);
  });

  test("hasUsedThisEncounter is true when the flag matches the current combat, any round/turn", () => {
    game.combat = { id: 'combat1', round: 5, turn: 3 };
    const actor = { getFlag: jest.fn(() => ({ combatId: 'combat1' })) };
    expect(hasUsedThisEncounter(actor, 'someFlag')).toBe(true);
  });

  test("hasUsedThisEncounter is false for a stale flag from a different combat", () => {
    game.combat = { id: 'newCombat', round: 1, turn: 0 };
    const actor = { getFlag: jest.fn(() => ({ combatId: 'oldCombat' })) };
    expect(hasUsedThisEncounter(actor, 'someFlag')).toBe(false);
  });

  test("markUsedThisEncounter records only the current combat's id under the given flag key", async () => {
    game.combat = { id: 'combat1', round: 4, turn: 2 };
    const actor = { setFlag: jest.fn() };
    await markUsedThisEncounter(actor, 'someFlag');
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'someFlag', { combatId: 'combat1' });
  });

  test("markUsedThisEncounter no-ops outside of combat", async () => {
    const actor = { setFlag: jest.fn() };
    await markUsedThisEncounter(actor, 'someFlag');
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

/* getUsesThisEncounter / markUsedThisEncounterCount */
describe("getUsesThisEncounter / markUsedThisEncounterCount", () => {
  beforeEach(() => {
    game.combat = { id: 'combat1', round: 1, turn: 0 };
  });

  test("getUsesThisEncounter is 0 outside of combat regardless of any stored flag", () => {
    game.combat = null;
    const actor = { getFlag: jest.fn(() => ({ combatId: 'combat1', count: 2 })) };
    expect(getUsesThisEncounter(actor, 'someFlag')).toBe(0);
  });

  test("getUsesThisEncounter is 0 with no stored flag at all", () => {
    const actor = { getFlag: jest.fn(() => undefined) };
    expect(getUsesThisEncounter(actor, 'someFlag')).toBe(0);
  });

  test("getUsesThisEncounter returns the stored count when the flag matches the current combat", () => {
    const actor = { getFlag: jest.fn(() => ({ combatId: 'combat1', count: 1 })) };
    expect(getUsesThisEncounter(actor, 'someFlag')).toBe(1);
  });

  test("getUsesThisEncounter is 0 for a stale flag from a different combat", () => {
    const actor = { getFlag: jest.fn(() => ({ combatId: 'oldCombat', count: 2 })) };
    expect(getUsesThisEncounter(actor, 'someFlag')).toBe(0);
  });

  test("markUsedThisEncounterCount records the current combat's id with a count of 1 by default", async () => {
    const actor = { getFlag: jest.fn(() => undefined), setFlag: jest.fn() };
    await markUsedThisEncounterCount(actor, 'someFlag');
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'someFlag', { combatId: 'combat1', count: 1 });
  });

  test("markUsedThisEncounterCount increments an existing count rather than overwriting it", async () => {
    const actor = { getFlag: jest.fn(() => ({ combatId: 'combat1', count: 1 })), setFlag: jest.fn() };
    await markUsedThisEncounterCount(actor, 'someFlag');
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'someFlag', { combatId: 'combat1', count: 2 });
  });

  test("markUsedThisEncounterCount resets the count when the stored flag is from a stale combat", async () => {
    const actor = { getFlag: jest.fn(() => ({ combatId: 'oldCombat', count: 5 })), setFlag: jest.fn() };
    await markUsedThisEncounterCount(actor, 'someFlag');
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'someFlag', { combatId: 'combat1', count: 1 });
  });

  test("markUsedThisEncounterCount no-ops outside of combat", async () => {
    game.combat = null;
    const actor = { setFlag: jest.fn() };
    await markUsedThisEncounterCount(actor, 'someFlag');
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

/* getUsesThisScene / markUsedThisScene */
describe("getUsesThisScene / markUsedThisScene", () => {
  beforeEach(() => {
    game.scenes = { current: { id: 'scene1' } };
  });

  test("getUsesThisScene is 0 with no stored flag at all", () => {
    const actor = { getFlag: jest.fn(() => undefined) };
    expect(getUsesThisScene(actor, 'someFlag')).toBe(0);
  });

  test("getUsesThisScene returns the stored count when the flag matches the current scene", () => {
    const actor = { getFlag: jest.fn(() => ({ sceneId: 'scene1', count: 1 })) };
    expect(getUsesThisScene(actor, 'someFlag')).toBe(1);
  });

  test("getUsesThisScene is 0 for a stale flag from a different scene", () => {
    const actor = { getFlag: jest.fn(() => ({ sceneId: 'oldScene', count: 3 })) };
    expect(getUsesThisScene(actor, 'someFlag')).toBe(0);
  });

  test("getUsesThisScene works with no active scene at all (both stamped null)", () => {
    game.scenes = { current: null };
    const actor = { getFlag: jest.fn(() => ({ sceneId: null, count: 1 })) };
    expect(getUsesThisScene(actor, 'someFlag')).toBe(1);
  });

  test("markUsedThisScene records the current scene's id with a count of 1 by default", async () => {
    const actor = { getFlag: jest.fn(() => undefined), setFlag: jest.fn() };
    await markUsedThisScene(actor, 'someFlag');
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'someFlag', { sceneId: 'scene1', count: 1 });
  });

  test("markUsedThisScene increments an existing count rather than overwriting it", async () => {
    const actor = { getFlag: jest.fn(() => ({ sceneId: 'scene1', count: 1 })), setFlag: jest.fn() };
    await markUsedThisScene(actor, 'someFlag');
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'someFlag', { sceneId: 'scene1', count: 2 });
  });

  test("markUsedThisScene accepts a larger count in one call (Old Reliable's own 'both d20s' spend)", async () => {
    const actor = { getFlag: jest.fn(() => undefined), setFlag: jest.fn() };
    await markUsedThisScene(actor, 'someFlag', 2);
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'someFlag', { sceneId: 'scene1', count: 2 });
  });

  test("markUsedThisScene resets the count when the stored flag is from a stale scene", async () => {
    const actor = { getFlag: jest.fn(() => ({ sceneId: 'oldScene', count: 5 })), setFlag: jest.fn() };
    await markUsedThisScene(actor, 'someFlag');
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'someFlag', { sceneId: 'scene1', count: 1 });
  });
});

/* bankPendingBonus / getPendingBonus / clearPendingBonus */
describe("bankPendingBonus / getPendingBonus / clearPendingBonus", () => {
  beforeEach(() => {
    game.combat = null;
  });

  test("bankPendingBonus stamps the data with the current combat's id and round", async () => {
    game.combat = { id: 'combat1', round: 3 };
    const actor = { setFlag: jest.fn() };
    await bankPendingBonus(actor, 'pendingThinkOnIt', { edge: true });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingThinkOnIt', { edge: true, combatId: 'combat1', round: 3 },
    );
  });

  test("bankPendingBonus stamps null combatId/round outside of combat", async () => {
    const actor = { setFlag: jest.fn() };
    await bankPendingBonus(actor, 'pendingThinkOnIt', { edge: true });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingThinkOnIt', { edge: true, combatId: null, round: null },
    );
  });

  test("getPendingBonus returns null when nothing was ever banked", () => {
    const actor = { getFlag: jest.fn(() => undefined) };
    expect(getPendingBonus(actor, 'pendingThinkOnIt')).toBeNull();
  });

  test("getPendingBonus returns the banked data when the combat still matches", () => {
    game.combat = { id: 'combat1', round: 3 };
    const actor = { getFlag: jest.fn(() => ({ edge: true, combatId: 'combat1', round: 1 })) };
    expect(getPendingBonus(actor, 'pendingThinkOnIt')).toEqual({ edge: true, combatId: 'combat1', round: 1 });
  });

  test("getPendingBonus returns null for a stale flag from a finished combat", () => {
    game.combat = { id: 'newCombat', round: 1 };
    const actor = { getFlag: jest.fn(() => ({ edge: true, combatId: 'oldCombat', round: 5 })) };
    expect(getPendingBonus(actor, 'pendingThinkOnIt')).toBeNull();
  });

  test("getPendingBonus returns null once combat ends entirely, for a flag banked during it", () => {
    const actor = { getFlag: jest.fn(() => ({ edge: true, combatId: 'combat1', round: 1 })) };
    expect(getPendingBonus(actor, 'pendingThinkOnIt')).toBeNull();
  });

  test("getPendingBonus stays valid outside of combat when banked outside of combat", () => {
    const actor = { getFlag: jest.fn(() => ({ edge: true, combatId: null, round: null })) };
    expect(getPendingBonus(actor, 'pendingThinkOnIt')).toEqual({ edge: true, combatId: null, round: null });
  });

  test("clearPendingBonus unsets the flag", async () => {
    const actor = { unsetFlag: jest.fn() };
    await clearPendingBonus(actor, 'pendingThinkOnIt');
    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'pendingThinkOnIt');
  });
});
