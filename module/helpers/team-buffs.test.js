import { jest } from '@jest/globals';
import { legacyPoolParty } from '../jest.legacy-pool-party.js';
import {
  canUseTeamBuffPerk, isTeamBuffPerk, onTeamBuffPerkUse, ONE_FOR_ALL_ID, POWER_BURST_ID,
  SHINING_LEADER_ID, SHINING_LEADER_EDGE_FLAG, ENVIRONMENTAL_ASSIST_ID,
  PENDING_ENVIRONMENTAL_ASSIST_FLAG_KEY, ELEMENTAL_SHIELD_ID, PENDING_ELEMENTAL_SHIELD_FLAG_KEY,
  RALLYING_CRY_ID, RALLYING_CRY_EDGE_FLAG, HEART_OF_THE_TEAM_GIJ_ID, NANO_MED_MASTERY_ID, NANO_MED_MASTERY_EDGE_FLAG,
} from './team-buffs.mjs';

global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
global.game = {
  combat: { id: 'combat1', round: 3 }, i18n: { localize: (k) => k, format: (k) => k },
  users: [{ isGM: true, active: true }], settings: { get: jest.fn(() => 1) }, socket: { emit: jest.fn() },
  actors: { party: legacyPoolParty() },
};

class FakeRoll {
  constructor() {
    this._total = FakeRoll.nextTotal ?? 2;
  }
  async evaluate() {
    return this;
  }
  get total() {
    return this._total;
  }
}
global.Roll = FakeRoll;

function makeActor({ id, name = 'Actor', power = 5, isMorphed = true, disposition = 1 } = {}) {
  return {
    id, name,
    system: { powers: { personal: { value: power } }, isMorphed, health: { bonus: 0 } },
    getActiveTokens: jest.fn(() => [{ document: { disposition } }]),
    getFlag: jest.fn(() => undefined),
    setFlag: jest.fn(),
    update: jest.fn(),
    getRollData: jest.fn(() => ({})),
  };
}

function makeItem(sourceId, { advancesCurrentValue = null } = {}) {
  return {
    name: 'Test Perk',
    flags: { core: { sourceId } },
    system: { advances: { currentValue: advancesCurrentValue } },
  };
}

describe("isTeamBuffPerk", () => {
  test("true for One For All / Power Burst / Shining Leader / Rallying Cry", () => {
    expect(isTeamBuffPerk(makeItem(ONE_FOR_ALL_ID))).toBe(true);
    expect(isTeamBuffPerk(makeItem(POWER_BURST_ID))).toBe(true);
    expect(isTeamBuffPerk(makeItem(SHINING_LEADER_ID))).toBe(true);
    expect(isTeamBuffPerk(makeItem(RALLYING_CRY_ID))).toBe(true);
    expect(isTeamBuffPerk(makeItem(HEART_OF_THE_TEAM_GIJ_ID))).toBe(true);
  });

  test("false for an unrelated Perk", () => {
    expect(isTeamBuffPerk(makeItem("Compendium.essence20.gi_joe_crb.Item.other"))).toBe(false);
  });
});

describe("canUseTeamBuffPerk", () => {
  test("true when affordable and not yet used this encounter", () => {
    const actor = makeActor({ power: 3 });
    expect(canUseTeamBuffPerk(makeItem(ONE_FOR_ALL_ID), actor)).toBe(true);
  });

  test("false when it can't be afforded", () => {
    const actor = makeActor({ power: 2 });
    expect(canUseTeamBuffPerk(makeItem(ONE_FOR_ALL_ID), actor)).toBe(false);
  });

  test("false once already used this encounter", () => {
    const actor = makeActor({ power: 3 });
    actor.getFlag = jest.fn((scope, key) => (
      key == 'oneForAllUsedThisEncounter' ? { epoch: 1, window: 'encounter', count: 1 } : undefined
    ));
    expect(canUseTeamBuffPerk(makeItem(ONE_FOR_ALL_ID), actor)).toBe(false);
  });

  test("Power Burst has no Power cost", () => {
    const actor = makeActor({ power: 0 });
    expect(canUseTeamBuffPerk(makeItem(POWER_BURST_ID), actor)).toBe(true);
  });

  test("Environmental Assist has no onceEncounterFlag - affordable and reusable in the same encounter", () => {
    const actor = makeActor({ power: 1 });
    // A stray "used this encounter" flag under some unrelated key shouldn't matter - there's no
    // onceEncounterFlag on this entry at all, so canUseTeamBuffPerk must never even ask
    // hasUsedThisEncounter about it (an undefined flagKey would otherwise look up game.actor's own
    // undefined-keyed flag, an existing bug this guard specifically prevents).
    actor.getFlag = jest.fn(() => ({ epoch: 1, window: 'encounter', count: 1 }));
    expect(canUseTeamBuffPerk(makeItem(ENVIRONMENTAL_ASSIST_ID), actor)).toBe(true);
  });

  test("Environmental Assist false when it can't be afforded", () => {
    const actor = makeActor({ power: 0 });
    expect(canUseTeamBuffPerk(makeItem(ENVIRONMENTAL_ASSIST_ID), actor)).toBe(false);
  });

  test("Elemental Shield true when affordable and not yet used this encounter", () => {
    const actor = makeActor({ power: 1 });
    expect(canUseTeamBuffPerk(makeItem(ELEMENTAL_SHIELD_ID), actor)).toBe(true);
  });

  test("Elemental Shield false once already used this encounter - unlike Environmental Assist, RAW does gate this to once per scene", () => {
    const actor = makeActor({ power: 1 });
    actor.getFlag = jest.fn((scope, key) => (
      key == 'elementalShieldUsedThisEncounter' ? { epoch: 1, window: 'encounter', count: 1 } : undefined
    ));
    expect(canUseTeamBuffPerk(makeItem(ELEMENTAL_SHIELD_ID), actor)).toBe(false);
  });

  test("Heart Of The Team true with a GM connected and a Story Point available", () => {
    const actor = makeActor({ power: 0 });
    expect(canUseTeamBuffPerk(makeItem(HEART_OF_THE_TEAM_GIJ_ID), actor)).toBe(true);
  });

  test("Heart Of The Team false with no Story Points available", () => {
    game.settings.get = jest.fn(() => 0);
    const actor = makeActor({ power: 0 });
    expect(canUseTeamBuffPerk(makeItem(HEART_OF_THE_TEAM_GIJ_ID), actor)).toBe(false);
    game.settings.get = jest.fn(() => 1);
  });

  test("Heart Of The Team false with no GM connected", () => {
    game.users = [{ isGM: false, active: true }];
    const actor = makeActor({ power: 0 });
    expect(canUseTeamBuffPerk(makeItem(HEART_OF_THE_TEAM_GIJ_ID), actor)).toBe(false);
    game.users = [{ isGM: true, active: true }];
  });

  test("Heart Of The Team false once already used this encounter", () => {
    const actor = makeActor({ power: 0 });
    actor.getFlag = jest.fn((scope, key) => (
      key == 'heartOfTheTeamGijUsedThisEncounter' ? { epoch: 1, window: 'encounter', count: 1 } : undefined
    ));
    expect(canUseTeamBuffPerk(makeItem(HEART_OF_THE_TEAM_GIJ_ID), actor)).toBe(false);
  });
});

describe("onTeamBuffPerkUse", () => {
  let originalTokens;
  beforeEach(() => {
    ui.notifications.warn.mockClear();
    global.ChatMessage.create.mockClear();
    game.socket.emit.mockClear();
    originalTokens = global.canvas;
  });
  afterEach(() => {
    global.canvas = originalTokens;
  });

  function setAllies(allies, actorToken) {
    global.canvas = {
      tokens: {
        placeables: [
          actorToken,
          ...allies.map(a => ({ actor: a, document: { disposition: 1 }, center: {} })),
        ],
      },
      grid: { measurePath: jest.fn(() => ({ distance: 0 })) },
    };
  }

  test("One For All spends 3 Power and grants 1d2 Power to each nearby Morphed ally", async () => {
    const actor = makeActor({ id: 'leader', power: 3 });
    const ally1 = makeActor({ id: 'ally1', power: 1 });
    const ally2 = makeActor({ id: 'ally2', power: 0, isMorphed: false });
    setAllies([ally1, ally2], { document: { disposition: 1 }, center: {} });
    FakeRoll.nextTotal = 2;

    await onTeamBuffPerkUse(makeItem(ONE_FOR_ALL_ID), actor);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(ally1.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 3 });
    expect(ally2.update).not.toHaveBeenCalled(); // not Morphed
  });

  test("Power Burst has no Power cost and uses the Perk's own advances.currentValue as the die's faces", async () => {
    const actor = makeActor({ id: 'leader', power: 5 });
    const ally1 = makeActor({ id: 'ally1', power: 1 });
    setAllies([ally1], { document: { disposition: 1 }, center: {} });
    FakeRoll.nextTotal = 4;

    await onTeamBuffPerkUse(makeItem(POWER_BURST_ID, { advancesCurrentValue: 4 }), actor);

    expect(actor.update).not.toHaveBeenCalled();
    expect(ally1.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 5 });
  });

  test("Shining Leader spends 1 Power and flags each nearby Morphed ally for the current round", async () => {
    const actor = makeActor({ id: 'leader', power: 1 });
    const ally1 = makeActor({ id: 'ally1' });
    setAllies([ally1], { document: { disposition: 1 }, center: {} });

    await onTeamBuffPerkUse(makeItem(SHINING_LEADER_ID), actor);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(ally1.setFlag).toHaveBeenCalledWith(
      'essence20', SHINING_LEADER_EDGE_FLAG, { combatId: 'combat1', round: 3 },
    );
  });

  test("warns and does nothing when Power can't be afforded", async () => {
    const actor = makeActor({ id: 'leader', power: 0 });
    setAllies([], { document: { disposition: 1 }, center: {} });

    await onTeamBuffPerkUse(makeItem(ONE_FOR_ALL_ID), actor);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("Rallying Cry has no Power cost and flags nearby allies regardless of Morph state", async () => {
    const actor = makeActor({ id: 'leader', power: 5 });
    const ally1 = makeActor({ id: 'ally1', isMorphed: true });
    const ally2 = makeActor({ id: 'ally2', isMorphed: false });
    setAllies([ally1, ally2], { document: { disposition: 1 }, center: {} });

    await onTeamBuffPerkUse(makeItem(RALLYING_CRY_ID), actor);

    expect(actor.update).not.toHaveBeenCalled();
    expect(ally1.setFlag).toHaveBeenCalledWith(
      'essence20', RALLYING_CRY_EDGE_FLAG, { combatId: 'combat1', round: 3 },
    );
    expect(ally2.setFlag).toHaveBeenCalledWith(
      'essence20', RALLYING_CRY_EDGE_FLAG, { combatId: 'combat1', round: 3 },
    );
  });

  test("Environmental Assist spends 1 Power and banks the damage bonus on the granter too, not just allies", async () => {
    const actor = makeActor({ id: 'leader', power: 1 });
    const ally1 = makeActor({ id: 'ally1' });
    setAllies([ally1], { document: { disposition: 1 }, center: {} });

    await onTeamBuffPerkUse(makeItem(ENVIRONMENTAL_ASSIST_ID), actor);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', PENDING_ENVIRONMENTAL_ASSIST_FLAG_KEY, { combatId: 'combat1', round: 3 },
    );
    expect(ally1.setFlag).toHaveBeenCalledWith(
      'essence20', PENDING_ENVIRONMENTAL_ASSIST_FLAG_KEY, { combatId: 'combat1', round: 3 },
    );
  });

  test("Environmental Assist doesn't gate reuse on hasUsedThisEncounter - no onceEncounterFlag exists to mark", async () => {
    const actor = makeActor({ id: 'leader', power: 2 });
    setAllies([], { document: { disposition: 1 }, center: {} });

    await onTeamBuffPerkUse(makeItem(ENVIRONMENTAL_ASSIST_ID), actor);
    await onTeamBuffPerkUse(makeItem(ENVIRONMENTAL_ASSIST_ID), actor);

    // actor.update is mocked (doesn't actually mutate system.powers.personal.value), so both
    // calls independently compute a spend from the same starting value - the point being tested
    // is just that a SECOND use isn't silently blocked, unlike One For All/Power Burst/Shining
    // Leader's own once-per-encounter gate.
    expect(actor.update).toHaveBeenCalledTimes(2);
    expect(actor.update).toHaveBeenLastCalledWith({ 'system.powers.personal.value': 1 });
  });

  test("Elemental Shield spends 1 Power and banks a scaling damage-reduction flag on the granter and each ally", async () => {
    const actor = makeActor({ id: 'leader', power: 1 });
    const ally1 = makeActor({ id: 'ally1' });
    setAllies([ally1], { document: { disposition: 1 }, center: {} });

    await onTeamBuffPerkUse(makeItem(ELEMENTAL_SHIELD_ID, { advancesCurrentValue: 2 }), actor);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', PENDING_ELEMENTAL_SHIELD_FLAG_KEY, { amount: 2, combatId: 'combat1', round: 3 },
    );
    expect(ally1.setFlag).toHaveBeenCalledWith(
      'essence20', PENDING_ELEMENTAL_SHIELD_FLAG_KEY, { amount: 2, combatId: 'combat1', round: 3 },
    );
  });

  test("Heart Of The Team spends 1 Story Point and grants +1 Temporary Health to each nearby ally regardless of Morph state", async () => {
    const actor = makeActor({ id: 'leader', name: 'Roadblock', power: 5 });
    const ally1 = makeActor({ id: 'ally1', isMorphed: false });
    setAllies([ally1], { document: { disposition: 1 }, center: {} });

    await onTeamBuffPerkUse(makeItem(HEART_OF_THE_TEAM_GIJ_ID), actor);

    expect(actor.update).not.toHaveBeenCalled();
    expect(game.socket.emit).toHaveBeenCalledWith('system.essence20', {
      action: 'spendStoryPoints', amount: 1, actorName: 'Roadblock',
    });
    expect(ally1.update).toHaveBeenCalledWith({ 'system.health.bonus': 1 });
  });

  test("Heart Of The Team warns and does nothing when no GM is connected", async () => {
    game.users = [{ isGM: false, active: true }];
    const actor = makeActor({ id: 'leader', power: 5 });
    const ally1 = makeActor({ id: 'ally1' });
    setAllies([ally1], { document: { disposition: 1 }, center: {} });

    await onTeamBuffPerkUse(makeItem(HEART_OF_THE_TEAM_GIJ_ID), actor);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(ally1.update).not.toHaveBeenCalled();
    expect(game.socket.emit).not.toHaveBeenCalled();
    game.users = [{ isGM: true, active: true }];
  });

  test("Nano-Med Mastery heals 2 (capped at max) and banks an Edge window for every nearby ally, including the granter", async () => {
    const actor = makeActor({ id: 'medic', power: 5 });
    actor.system.health = { value: 3, max: 5, bonus: 0 };
    const ally1 = makeActor({ id: 'ally1' });
    ally1.system.health = { value: 8, max: 8, bonus: 0 }; // already full
    setAllies([ally1], { document: { disposition: 1 }, center: {} });

    await onTeamBuffPerkUse(makeItem(NANO_MED_MASTERY_ID), actor);

    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 5 }); // 3 + 2, clamped at max
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', NANO_MED_MASTERY_EDGE_FLAG, { combatId: 'combat1', round: 3 },
    );
    expect(ally1.update).toHaveBeenCalledWith({ 'system.health.value': 8 }); // clamped, not 10
    expect(ally1.setFlag).toHaveBeenCalledWith(
      'essence20', NANO_MED_MASTERY_EDGE_FLAG, { combatId: 'combat1', round: 3 },
    );
  });
});
