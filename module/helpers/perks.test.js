import { jest } from '@jest/globals';
import {
  actorHasHangUp, actorHasPerk, bankPendingBonus, clearPendingBonus, findHangUp, findPerk, getPendingBonus,
  getUsesThisEncounter, getUsesThisScene, hasUsedThisEncounter, hasUsedThisRound, hasUsedThisTurn,
  markUsedThisEncounter, markUsedThisEncounterCount, markUsedThisRound, markUsedThisScene, markUsedThisTurn,
} from './perks.mjs';

global.game = { combat: null, scenes: { current: null } };

/**
 * A stand-in actor with its own flag store, plus helpers for driving the Scene Clock counters,
 * which the three windows below now read instead of the current combat id.
 */
function makeFlagActor(flags = {}) {
  const store = { ...flags };
  return {
    getFlag: (scope, key) => store[key],
    setFlag: async (scope, key, value) => {
      store[key] = value;
    },
  };
}

function setEpochs({ scene = 1, encounter = 1 } = {}) {
  global.game.settings = {
    get: (scope, key) => {
      if (key === "sceneClockScene") return scene;
      if (key === "sceneClockEncounter") return encounter;
      return undefined;
    },
  };
}

beforeEach(() => {
  global.game = { combat: { id: "combat1", round: 1, turn: 0 }, scenes: { current: null }, user: { isGM: true } };
  setEpochs();
});

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
// These three windows moved off the current combat's id and onto the Scene Clock
// (helpers/scene-clock.mjs). The behavioural change worth testing is that they now work OUT OF
// COMBAT: the old versions began `if (!game.combat) return`, so a once-per-scene ability used in a
// roleplay scene was never recorded and was effectively unlimited.
describe("hasUsedThisEncounter / markUsedThisEncounter", () => {
  test("is false for an actor that has never used the ability", () => {
    expect(hasUsedThisEncounter(makeFlagActor(), 'didntEvenFeelIt')).toBe(false);
  });

  test("is true once marked, and stays true across rounds and turns", async () => {
    const actor = makeFlagActor();
    await markUsedThisEncounter(actor, 'didntEvenFeelIt');

    expect(hasUsedThisEncounter(actor, 'didntEvenFeelIt')).toBe(true);

    game.combat.round = 7;
    game.combat.turn = 3;
    expect(hasUsedThisEncounter(actor, 'didntEvenFeelIt')).toBe(true);
  });

  test("records and reads OUT of combat - the bug this replaced", async () => {
    game.combat = null;
    const actor = makeFlagActor();

    await markUsedThisEncounter(actor, 'dependable');

    expect(hasUsedThisEncounter(actor, 'dependable')).toBe(true);
  });

  test("clears when the encounter counter advances", async () => {
    const actor = makeFlagActor();
    await markUsedThisEncounter(actor, 'didntEvenFeelIt');

    setEpochs({ encounter: 2 });

    expect(hasUsedThisEncounter(actor, 'didntEvenFeelIt')).toBe(false);
  });

  test("keeps separate flag keys apart", async () => {
    const actor = makeFlagActor();
    await markUsedThisEncounter(actor, 'abilityOne');

    expect(hasUsedThisEncounter(actor, 'abilityTwo')).toBe(false);
  });

  test("a flag written before the Scene Clock existed reads as unused", () => {
    const actor = makeFlagActor({ oldStyle: { combatId: 'combat1' } });
    expect(hasUsedThisEncounter(actor, 'oldStyle')).toBe(false);
  });
});

describe("getUsesThisEncounter / markUsedThisEncounterCount", () => {
  test("counts from zero", () => {
    expect(getUsesThisEncounter(makeFlagActor(), 'rollWithThePunches')).toBe(0);
  });

  test("increments rather than overwriting", async () => {
    const actor = makeFlagActor();
    await markUsedThisEncounterCount(actor, 'rollWithThePunches');
    await markUsedThisEncounterCount(actor, 'rollWithThePunches');

    expect(getUsesThisEncounter(actor, 'rollWithThePunches')).toBe(2);
  });

  test("resets when the encounter counter advances", async () => {
    const actor = makeFlagActor();
    await markUsedThisEncounterCount(actor, 'rollWithThePunches');

    setEpochs({ encounter: 5 });

    expect(getUsesThisEncounter(actor, 'rollWithThePunches')).toBe(0);
  });

  test("counts out of combat too", async () => {
    game.combat = null;
    const actor = makeFlagActor();

    await markUsedThisEncounterCount(actor, 'rollWithThePunches');

    expect(getUsesThisEncounter(actor, 'rollWithThePunches')).toBe(1);
  });
});

describe("getUsesThisScene / markUsedThisScene", () => {
  test("counts from zero", () => {
    expect(getUsesThisScene(makeFlagActor(), 'dependable')).toBe(0);
  });

  test("records a multi-charge use in one call", async () => {
    const actor = makeFlagActor();
    await markUsedThisScene(actor, 'oldReliable', 2);

    expect(getUsesThisScene(actor, 'oldReliable')).toBe(2);
  });

  // The whole reason the scene and encounter counters are separate: a combat ending refreshes
  // once-per-encounter abilities, but must NOT refresh once-per-scene ones.
  test("survives the encounter counter advancing", async () => {
    const actor = makeFlagActor();
    await markUsedThisScene(actor, 'dependable');

    setEpochs({ encounter: 9 });

    expect(getUsesThisScene(actor, 'dependable')).toBe(1);
  });

  test("clears when the scene counter advances", async () => {
    const actor = makeFlagActor();
    await markUsedThisScene(actor, 'dependable');

    setEpochs({ scene: 2 });

    expect(getUsesThisScene(actor, 'dependable')).toBe(0);
  });

  test("is independent of the encounter window for the same flag key", async () => {
    const actor = makeFlagActor();
    await markUsedThisScene(actor, 'shared');

    // The scene mark stamps the scene epoch, so an encounter-window read of the same key does not
    // see it unless the two counters happen to coincide.
    setEpochs({ scene: 1, encounter: 4 });
    expect(hasUsedThisEncounter(actor, 'shared')).toBe(false);
    expect(getUsesThisScene(actor, 'shared')).toBe(1);
  });
});
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
