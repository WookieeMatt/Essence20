import { jest } from '@jest/globals';
import {
  canUsePerk, consumeHardTarget, consumeMomentaryBlur, consumeResilience, consumeRollWithThePunches, onPerkUse,
} from './banked-buffs.mjs';

const THINK_ON_IT_ID = "Compendium.essence20.gi_joe_crb.Item.M7HNdhqViy0xbUkz";
const BATTLE_COMMANDER_ID = "Compendium.essence20.gi_joe_crb.Item.PIWYZyWFw9EYZeom";
const PLAN_OF_ACTION_ID = "Compendium.essence20.gi_joe_crb.Item.7wsu99k8v620IB2N";
const INSPIRATION_ID = "Compendium.essence20.gi_joe_crb.Item.j05tN97KZNzl5jTF";
const INSPIRATION_PR_ID = "Compendium.essence20.pr_crb.Item.FJSNzVRulj20M0B1";
const ROLL_WITH_THE_PUNCHES_ID = "Compendium.essence20.gi_joe_crb.Item.5hBral7hiCPv3GqF";
const SLAMMER_ROLL_WITH_THE_PUNCHES_ID = "Compendium.essence20.sgt_slaughter_sourcebook.Item.b1MNR5CPCitDTj4n";
const HEART_OF_THE_TEAM_ID = "Compendium.essence20.pr_crb.Item.7EyU0Hf6T3YVels4";
const HARD_TARGET_ID = "Compendium.essence20.pr_crb.Item.9oFOf0qSLJCwCGmZ";
const RESILIENCE_ID = "Compendium.essence20.pr_crb.Item.TomU7e31oHoRsIrT";
const MOMENTARY_BLUR_ID = "Compendium.essence20.jump_through_time.Item.MB1UsageEvasion1";
const MARK_TARGET_ID = "Compendium.essence20.tf_crb.Item.T2mm6VmvcUxagsjc";
const AUGMENT_POWER_ID = "Compendium.essence20.tf_crb.Item.tByP34McuTkaTQWZ";
const VULNERABILITY_ID = "Compendium.essence20.mlp_crb.Item.LOLY9yLoljdn9319";
const INNER_MAGIC_ID = "Compendium.essence20.mlp_crb.Item.E6GWRHzP9tOAxQP6";
const GENEROSITY_OF_SPIRIT_ID = "Compendium.essence20.mlp_crb.Item.hufRaDWtFbAszTmq";
const PERSONAL_SACRIFICE_ID = "Compendium.essence20.mlp_crb.Item.PHzAgfYygOH67l1P";
const I_GOT_YOU_ID = "Compendium.essence20.enigma_of_combination.Item.h8DuSX4N1buJb6uN";
const CURB_YOUR_ENTHUSIASM_ID = "Compendium.essence20.mlp_crb.Item.nWb2wRNaQBrP5z0p";
const DIG_IN_ID = "Compendium.essence20.decepticon_directive.Item.9tIkV50YiO3xqxvi";
const EYE_FOR_APPRAISAL_ID = "Compendium.essence20.decepticon_directive.Item.JlwxiwZDpq7UkYXn";
const WEAPON_CONVERSION_ID = "Compendium.essence20.decepticon_directive.Item.WbXurpieXjFkmS8h";
const PLAN_OF_ACTION_WTNV_ID = "Compendium.essence20.wtnv_citizens_guide.Item.D3uXlXL7jNn0eD8T";
const DEEP_BREATHING_ID = "Compendium.essence20.wtnv_citizens_guide.Item.SIR01xUOHbtLwNa2";
const REAL_ANGELS_ID = "Compendium.essence20.wtnv_citizens_guide.Item.i5hL9SSARFDMf6UH";
const DIG_DEEP_ID = "Compendium.essence20.wtnv_citizens_guide.Item.A2Xay6rHrBK9l8eo";
const TIMELINE_ANOMALY_ID = "Compendium.essence20.wtnv_citizens_guide.Item.NQXcQL05DLCs75xb";
const QUICK_STUDY_ID = "Compendium.essence20.wtnv_citizens_guide.Item.adJm4dpjD04TICkd";
const HIDDEN_WHISPERS_ID = "Compendium.essence20.wtnv_citizens_guide.Item.ihphiMNUuj710MzH";
const GUIDANCE_ID = "Compendium.essence20.gi_joe_crb.Item.yVxdYbSfMWfaDQZR";
const INSPIRING_WORDS_ID = "Compendium.essence20.gi_joe_crb.Item.0cGhuapOhkdwYC9G";
const STAY_IN_FORMATION_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.pU3dKGNWYAhgRY6B";
const I_KNOW_A_GUY_ID = "Compendium.essence20.pr_crb.Item.anfEVX8bI2eQh40E";

global.canvas = {
  tokens: { placeables: [], setTargets: jest.fn() },
  grid: { measurePath: jest.fn(() => ({ distance: 0 })) },
};
global.ui = { notifications: { warn: jest.fn(), info: jest.fn() } };
global.game = {
  combat: null, i18n: { localize: (k) => k, format: (k) => k }, user: { targets: new Set() },
  users: [{ isGM: true, active: true }], socket: { emit: jest.fn() },
};
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

  describe("Battle Commander (Officer base, 1st level, p.85)", () => {
    afterEach(() => {
      game.combat = null;
    });

    test("true in round 1 of combat", () => {
      game.combat = { round: 1 };
      const item = makePerkItem({ sourceId: BATTLE_COMMANDER_ID, actor: makeActor() });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false outside round 1, or outside combat entirely", () => {
      game.combat = { round: 2 };
      expect(canUsePerk(makePerkItem({ sourceId: BATTLE_COMMANDER_ID, actor: makeActor() }))).toBe(false);

      game.combat = null;
      expect(canUsePerk(makePerkItem({ sourceId: BATTLE_COMMANDER_ID, actor: makeActor() }))).toBe(false);
    });
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

  test("Battle Commander (ally) banks an Edge on the single already-targeted ally, in round 1", async () => {
    game.combat = { round: 1 };
    const actor = makeActor({ id: 'officer' });
    const ally = makeActor({ id: 'ally1', name: 'Duke' });
    game.user.targets = new Set([{ actor: ally }]);
    const item = makePerkItem({ sourceId: BATTLE_COMMANDER_ID, actor });

    await onPerkUse(item);

    expect(ally.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingBattleCommander', expect.objectContaining({ edge: true }),
    );
    expect(actor.setFlag).not.toHaveBeenCalled();
    game.combat = null;
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

  test("Plan of Action (Welcome to Night Vale: Citizens' Guide) shares the exact same mechanic under a different compendium item", async () => {
    const actor = makeActor({ id: 'citizen' });
    const ally = makeActor({ id: 'ally1', name: 'Cecil' });
    game.user.targets = new Set([{ actor: ally }]);
    const item = makePerkItem({ sourceId: PLAN_OF_ACTION_WTNV_ID, actor, currentValue: null });

    await onPerkUse(item);

    expect(ally.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingPlanOfAction', expect.objectContaining({ shiftUp: 1 }),
    );
  });

  test("Inspiration (Power Ranger White Ranger, ally) banks a bonusDie on the single already-targeted ally", async () => {
    const actor = makeActor({ id: 'ranger' });
    const ally = makeActor({ id: 'ally1', name: 'Kimberly' });
    game.user.targets = new Set([{ actor: ally }]);
    const item = makePerkItem({ sourceId: INSPIRATION_PR_ID, actor, currentValue: 6 });

    await onPerkUse(item);

    expect(ally.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingInspiration', expect.objectContaining({ bonusDie: '1d6' }),
    );
    expect(actor.setFlag).not.toHaveBeenCalled();
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

describe("Roll with the Punches (Slammer Focus): canUsePerk's per-combat cap widens at 6th level", () => {
  afterEach(() => {
    game.combat = null;
  });

  test("true below 6th level with no uses yet", () => {
    game.combat = { id: 'combat1', round: 1 };
    const actor = makeActor();
    actor.system = { level: 3 };
    const item = makePerkItem({ sourceId: SLAMMER_ROLL_WITH_THE_PUNCHES_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("false below 6th level after a single use", () => {
    game.combat = { id: 'combat1', round: 1 };
    const actor = makeActor();
    actor.system = { level: 3 };
    actor.getFlag = jest.fn((scope, key) => (
      key == 'slammerRollWithThePunchesUsesThisEncounter' ? { combatId: 'combat1', count: 1 } : undefined
    ));
    const item = makePerkItem({ sourceId: SLAMMER_ROLL_WITH_THE_PUNCHES_ID, actor });
    expect(canUsePerk(item)).toBe(false);
  });

  test("true at 6th level after a single use (cap of 2)", () => {
    game.combat = { id: 'combat1', round: 1 };
    const actor = makeActor();
    actor.system = { level: 6 };
    actor.getFlag = jest.fn((scope, key) => (
      key == 'slammerRollWithThePunchesUsesThisEncounter' ? { combatId: 'combat1', count: 1 } : undefined
    ));
    const item = makePerkItem({ sourceId: SLAMMER_ROLL_WITH_THE_PUNCHES_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("false at 6th level after two uses", () => {
    game.combat = { id: 'combat1', round: 1 };
    const actor = makeActor();
    actor.system = { level: 6 };
    actor.getFlag = jest.fn((scope, key) => (
      key == 'slammerRollWithThePunchesUsesThisEncounter' ? { combatId: 'combat1', count: 2 } : undefined
    ));
    const item = makePerkItem({ sourceId: SLAMMER_ROLL_WITH_THE_PUNCHES_ID, actor });
    expect(canUsePerk(item)).toBe(false);
  });

  test("true again in a new encounter", () => {
    game.combat = { id: 'combat2', round: 1 };
    const actor = makeActor();
    actor.system = { level: 3 };
    actor.getFlag = jest.fn((scope, key) => (
      key == 'slammerRollWithThePunchesUsesThisEncounter' ? { combatId: 'combat1', count: 1 } : undefined
    ));
    const item = makePerkItem({ sourceId: SLAMMER_ROLL_WITH_THE_PUNCHES_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });
});

describe("Roll with the Punches (Slammer Focus): onPerkUse increments the per-combat counter", () => {
  beforeEach(() => {
    game.combat = { id: 'combat1', round: 1 };
    foundry.applications.api.DialogV2.wait.mockResolvedValue('toughness');
  });

  afterEach(() => {
    game.combat = null;
  });

  test("banks the chosen Defense and increments the counting flag, not the boolean one", async () => {
    const actor = makeActor();
    actor.system = { level: 3 };
    const item = makePerkItem({ sourceId: SLAMMER_ROLL_WITH_THE_PUNCHES_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingRollWithThePunches', expect.objectContaining({ defenseType: 'toughness' }),
    );
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'slammerRollWithThePunchesUsesThisEncounter', { combatId: 'combat1', count: 1 },
    );
    expect(actor.setFlag).not.toHaveBeenCalledWith('essence20', 'rollWithThePunchesUsedThisEncounter', expect.anything());
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

describe("Helping Hand (Blue Ranger, 2nd level, p.38)", () => {
  const HELPING_HAND_ID = "Compendium.essence20.pr_crb.Item.U5xY4e0Wro9XyooS";

  function makeHelpingHandActor({ id, name, power = 1, isMorphed = true, health = 5, healthMax = 10 } = {}) {
    return {
      ...makeActor({ id, name }),
      system: {
        powers: { personal: { value: power } },
        isMorphed,
        health: { value: health, max: healthMax },
      },
      update: jest.fn(),
    };
  }

  beforeEach(() => {
    game.user.targets = new Set();
    canvas.tokens.placeables = [];
    foundry.applications.api.DialogV2.wait.mockReset();
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
  });

  describe("canUsePerk", () => {
    test("true when the actor can afford the Power cost", () => {
      const actor = makeHelpingHandActor({ power: 1 });
      const item = makePerkItem({ sourceId: HELPING_HAND_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false when the actor can't afford the Power cost", () => {
      const actor = makeHelpingHandActor({ power: 0 });
      const item = makePerkItem({ sourceId: HELPING_HAND_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("heals the single already-targeted ally and spends 1 Personal Power", async () => {
    const actor = makeHelpingHandActor({ id: 'medic', power: 1 });
    const ally = makeHelpingHandActor({ id: 'ally1', name: 'Billy', health: 4 });
    game.user.targets = new Set([{ actor: ally }]);
    const item = makePerkItem({ sourceId: HELPING_HAND_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(ally.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
  });

  test("doesn't heal past the ally's own max Health", async () => {
    const actor = makeHelpingHandActor({ id: 'medic', power: 1 });
    const ally = makeHelpingHandActor({ id: 'ally1', name: 'Billy', health: 10, healthMax: 10 });
    game.user.targets = new Set([{ actor: ally }]);
    const item = makePerkItem({ sourceId: HELPING_HAND_ID, actor });

    await onPerkUse(item);

    expect(ally.update).toHaveBeenCalledWith({ 'system.health.value': 10 });
  });

  test("only offers Morphed allies in the picker fallback", async () => {
    const actor = makeHelpingHandActor({ id: 'medic', power: 1 });
    actor.getActiveTokens = jest.fn(() => [{ document: { disposition: 1 }, center: {} }]);
    const morphedAlly = makeHelpingHandActor({ id: 'ally1', name: 'Morphed Ally', isMorphed: true });
    const unmorphedAlly = makeHelpingHandActor({ id: 'ally2', name: 'Unmorphed Ally', isMorphed: false });
    canvas.tokens.placeables = [
      { actor: morphedAlly, document: { disposition: 1 }, center: {} },
      { actor: unmorphedAlly, document: { disposition: 1 }, center: {} },
    ];
    foundry.applications.api.DialogV2.wait.mockImplementation(({ content }) => {
      expect(content).toContain('ally1');
      expect(content).not.toContain('ally2');
      return 'cancel';
    });
    const item = makePerkItem({ sourceId: HELPING_HAND_ID, actor });

    await onPerkUse(item);

    expect(foundry.applications.api.DialogV2.wait).toHaveBeenCalled();
    expect(morphedAlly.update).not.toHaveBeenCalled();
  });

  test("warns and does nothing when the actor can't afford it", async () => {
    const actor = makeHelpingHandActor({ id: 'medic', power: 0 });
    const item = makePerkItem({ sourceId: HELPING_HAND_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("warns and does nothing with no eligible allies to pick from", async () => {
    const actor = makeHelpingHandActor({ id: 'medic', power: 1 });
    actor.getActiveTokens = jest.fn(() => [{ document: { disposition: 1 }, center: {} }]);
    canvas.tokens.placeables = [];
    const item = makePerkItem({ sourceId: HELPING_HAND_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });
});

describe("Lightspeed Response (Form) (Across the Stars, General Perk, p.69)", () => {
  const LIGHTSPEED_RESPONSE_ID = "Compendium.essence20.across_the_stars.Item.E3WLZpN7iKL9uzeB";

  function makeLightspeedActor({ id, name, power = 2, isMorphed = true, health = 5, healthMax = 10 } = {}) {
    return {
      ...makeActor({ id, name }),
      system: {
        powers: { personal: { value: power } },
        isMorphed,
        health: { value: health, max: healthMax },
      },
      update: jest.fn(),
    };
  }

  beforeEach(() => {
    game.user.targets = new Set();
    canvas.tokens.placeables = [];
    foundry.applications.api.DialogV2.wait.mockReset();
    ui.notifications.warn.mockReset();
  });

  describe("canUsePerk", () => {
    test("true when the actor can afford the 2-Power cost", () => {
      const actor = makeLightspeedActor({ power: 2 });
      const item = makePerkItem({ sourceId: LIGHTSPEED_RESPONSE_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false when the actor can't afford the 2-Power cost", () => {
      const actor = makeLightspeedActor({ power: 1 });
      const item = makePerkItem({ sourceId: LIGHTSPEED_RESPONSE_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("heals the single already-targeted ally by 1 and spends 2 Personal Power", async () => {
    const actor = makeLightspeedActor({ id: 'ranger', power: 2 });
    const ally = makeLightspeedActor({ id: 'ally1', name: 'Ally', health: 4 });
    game.user.targets = new Set([{ actor: ally }]);
    const item = makePerkItem({ sourceId: LIGHTSPEED_RESPONSE_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(ally.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
  });

  test("doesn't heal past the ally's own max Health", async () => {
    const actor = makeLightspeedActor({ id: 'ranger', power: 2 });
    const ally = makeLightspeedActor({ id: 'ally1', name: 'Ally', health: 10, healthMax: 10 });
    game.user.targets = new Set([{ actor: ally }]);
    const item = makePerkItem({ sourceId: LIGHTSPEED_RESPONSE_ID, actor });

    await onPerkUse(item);

    expect(ally.update).toHaveBeenCalledWith({ 'system.health.value': 10 });
  });

  test("warns and does nothing when the actor can't afford it", async () => {
    const actor = makeLightspeedActor({ id: 'ranger', power: 1 });
    const item = makePerkItem({ sourceId: LIGHTSPEED_RESPONSE_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });
});

describe("MacGyver (GI Joe CRB, Engineer Origin Benefit, p.65)", () => {
  const MACGYVER_ID = "Compendium.essence20.gi_joe_crb.Item.EIENttpS41hxvvzn";

  function makeMacGyverActor({ id, name, health = 5, healthMax = 10, type = 'playerCharacter' } = {}) {
    return {
      ...makeActor({ id, name }),
      type,
      system: { health: { value: health, max: healthMax } },
      update: jest.fn(),
    };
  }

  beforeEach(() => {
    game.user.targets = new Set();
    canvas.tokens.placeables = [];
    foundry.applications.api.DialogV2.wait.mockReset();
    ui.notifications.warn.mockReset();
  });

  test("canUsePerk is always true - no cost beyond the action itself", () => {
    const actor = makeMacGyverActor();
    const item = makePerkItem({ sourceId: MACGYVER_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("heals the single already-targeted vehicle by 1", async () => {
    const actor = makeMacGyverActor({ id: 'engineer' });
    const vehicle = makeMacGyverActor({ id: 'vehicle1', name: 'Jeep', health: 4, type: 'vehicle' });
    game.user.targets = new Set([{ actor: vehicle }]);
    const item = makePerkItem({ sourceId: MACGYVER_ID, actor });

    await onPerkUse(item);

    expect(vehicle.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
  });

  test("doesn't heal past the vehicle's own max Health", async () => {
    const actor = makeMacGyverActor({ id: 'engineer' });
    const vehicle = makeMacGyverActor({ id: 'vehicle1', name: 'Jeep', health: 10, healthMax: 10, type: 'vehicle' });
    game.user.targets = new Set([{ actor: vehicle }]);
    const item = makePerkItem({ sourceId: MACGYVER_ID, actor });

    await onPerkUse(item);

    expect(vehicle.update).toHaveBeenCalledWith({ 'system.health.value': 10 });
  });

  test("only offers vehicle actors in the picker fallback, not character allies", async () => {
    const actor = makeMacGyverActor({ id: 'engineer' });
    actor.getActiveTokens = jest.fn(() => [{ document: { disposition: 1 }, center: {} }]);
    const vehicle = makeMacGyverActor({ id: 'vehicle1', name: 'Jeep', type: 'vehicle' });
    const ally = makeMacGyverActor({ id: 'ally1', name: 'Ally', type: 'playerCharacter' });
    canvas.tokens.placeables = [
      { actor: vehicle, document: { disposition: 1 }, center: {} },
      { actor: ally, document: { disposition: 1 }, center: {} },
    ];
    foundry.applications.api.DialogV2.wait.mockImplementation(({ content }) => {
      expect(content).toContain('vehicle1');
      expect(content).not.toContain('ally1');
      return 'cancel';
    });
    const item = makePerkItem({ sourceId: MACGYVER_ID, actor });

    await onPerkUse(item);

    expect(foundry.applications.api.DialogV2.wait).toHaveBeenCalled();
    expect(vehicle.update).not.toHaveBeenCalled();
  });
});

describe("Failure Isn't an Option (Factions in Action Vol. 2, Officer Focus, p.68)", () => {
  const FAILURE_ISNT_AN_OPTION_ID = "Compendium.essence20.intercontinental_adventures.Item.EtIdcWWazTDKo3fH";

  function makeOfficerActor({ id, name } = {}) {
    return { ...makeActor({ id, name }), update: jest.fn() };
  }

  function makeAllyActor({ id, name, health = 0, healthMax = 10 } = {}) {
    return {
      ...makeActor({ id, name }),
      type: 'playerCharacter',
      system: { health: { value: health, max: healthMax, bonus: 0 } },
      update: jest.fn(),
    };
  }

  beforeEach(() => {
    game.user.targets = new Set();
    canvas.tokens.placeables = [];
    game.users = [{ isGM: true, active: true }];
    game.settings = { get: jest.fn(() => 1) };
    game.socket.emit.mockReset();
    ui.notifications.warn.mockReset();
  });

  afterEach(() => {
    delete game.settings;
  });

  test("canUsePerk true with a GM connected and a Story Point available", () => {
    const actor = makeOfficerActor();
    const item = makePerkItem({ sourceId: FAILURE_ISNT_AN_OPTION_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("canUsePerk false with no Story Points or no GM", () => {
    const actor = makeOfficerActor();
    const item = makePerkItem({ sourceId: FAILURE_ISNT_AN_OPTION_ID, actor });

    game.settings.get = jest.fn(() => 0);
    expect(canUsePerk(item)).toBe(false);

    game.settings.get = jest.fn(() => 1);
    game.users = [{ isGM: false, active: true }];
    expect(canUsePerk(item)).toBe(false);
  });

  test("spends 1 Story Point and grants the targeted 0-Health ally 1 temporary Health", async () => {
    const actor = makeOfficerActor({ id: 'officer1' });
    const downedAlly = makeAllyActor({ id: 'ally1', name: 'Downed Ally', health: 0 });
    game.user.targets = new Set([{ actor: downedAlly }]);
    const item = makePerkItem({ sourceId: FAILURE_ISNT_AN_OPTION_ID, actor });

    await onPerkUse(item);

    expect(game.socket.emit).toHaveBeenCalledWith('system.essence20', {
      action: 'spendStoryPoints', amount: 1, actorName: 'Actor',
    });
    expect(downedAlly.update).toHaveBeenCalledWith({ 'system.health.bonus': 1 });
  });

  test("only offers allies actually at 0 Health in the picker fallback", async () => {
    const actor = makeOfficerActor({ id: 'officer1' });
    actor.getActiveTokens = jest.fn(() => [{ document: { disposition: 1 }, center: {} }]);
    const downedAlly = makeAllyActor({ id: 'ally1', name: 'Downed', health: 0 });
    const healthyAlly = makeAllyActor({ id: 'ally2', name: 'Healthy', health: 5 });
    canvas.tokens.placeables = [
      { actor: downedAlly, document: { disposition: 1 }, center: {} },
      { actor: healthyAlly, document: { disposition: 1 }, center: {} },
    ];
    foundry.applications.api.DialogV2.wait.mockImplementation(({ content }) => {
      expect(content).toContain('ally1');
      expect(content).not.toContain('ally2');
      return 'cancel';
    });
    const item = makePerkItem({ sourceId: FAILURE_ISNT_AN_OPTION_ID, actor });

    await onPerkUse(item);

    expect(foundry.applications.api.DialogV2.wait).toHaveBeenCalled();
    expect(downedAlly.update).not.toHaveBeenCalled();
    expect(game.socket.emit).not.toHaveBeenCalled();
  });

  test("warns and does nothing without a Story Point to spend", async () => {
    game.settings.get = jest.fn(() => 0);
    const actor = makeOfficerActor();
    const downedAlly = makeAllyActor({ id: 'ally1', health: 0 });
    game.user.targets = new Set([{ actor: downedAlly }]);
    const item = makePerkItem({ sourceId: FAILURE_ISNT_AN_OPTION_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(game.socket.emit).not.toHaveBeenCalled();
    expect(downedAlly.update).not.toHaveBeenCalled();
  });
});

describe("Remove & Rebuild (Transformers CRB, General Perk, p.111)", () => {
  const REMOVE_AND_REBUILD_ID = "Compendium.essence20.tf_crb.Item.q63dZJjGuZHcE2gH";

  function makeAllyActor({ id, name, health = 0, healthMax = 10 } = {}) {
    return {
      ...makeActor({ id, name }),
      type: 'playerCharacter',
      system: { health: { value: health, max: healthMax, bonus: 0 } },
      update: jest.fn(),
    };
  }

  beforeEach(() => {
    game.user.targets = new Set();
    canvas.tokens.placeables = [];
  });

  test("revives a targeted 0-Health ally to 1 real Health", async () => {
    const actor = makeActor({ id: 'gunner1' });
    const downedAlly = makeAllyActor({ id: 'ally1', health: 0 });
    game.user.targets = new Set([{ actor: downedAlly }]);
    const item = makePerkItem({ sourceId: REMOVE_AND_REBUILD_ID, actor });

    expect(canUsePerk(item)).toBe(true);

    await onPerkUse(item);

    expect(downedAlly.update).toHaveBeenCalledWith({ 'system.health.value': 1 });
  });
});

describe("Field Repair (Transformers CRB, General Perk, p.109)", () => {
  const FIELD_REPAIR_ID = "Compendium.essence20.tf_crb.Item.a8aIMf7h41eg8wCN";

  function makeGunnerActor({ id = 'gunner1', name = 'Gunner', usedThisEncounter = false } = {}) {
    return {
      ...makeActor({ id, name }),
      getFlag: jest.fn((scope, key) => (
        key == 'fieldRepairUsedThisEncounter' && usedThisEncounter ? { combatId: 'combat1' } : undefined
      )),
      system: { health: { value: 5, max: 10, bonus: 0 } },
      update: jest.fn(),
    };
  }

  beforeEach(() => {
    game.combat = { id: 'combat1' };
    game.user.targets = new Set();
    canvas.tokens.placeables = [];
    foundry.applications.api.DialogV2.wait.mockReset();
  });

  afterEach(() => {
    game.combat = null;
  });

  test("canUsePerk is true, and false once already used this scene", () => {
    const actor = makeGunnerActor();
    expect(canUsePerk(makePerkItem({ sourceId: FIELD_REPAIR_ID, actor }))).toBe(true);

    const usedActor = makeGunnerActor({ usedThisEncounter: true });
    expect(canUsePerk(makePerkItem({ sourceId: FIELD_REPAIR_ID, actor: usedActor }))).toBe(false);
  });

  test("heals the actor themselves when chosen in the picker fallback", async () => {
    const actor = makeGunnerActor();
    foundry.applications.api.DialogV2.wait.mockImplementation(() => 'gunner1');
    const item = makePerkItem({ sourceId: FIELD_REPAIR_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 6 });
  });
});

describe("Squad Guardian (General Hawk's Personnel Files, Old Hand Role Perk, 9th level, p.166)", () => {
  const SQUAD_GUARDIAN_ID = "Compendium.essence20.general_hawk_s_personel_files.Item.Li2y6KqFu2OGRkrX";

  function makeOldHandActor({ id = 'oldhand1', name = 'Old Hand', moxie = 3 } = {}) {
    const moxieItem = { name: 'Moxie', system: { resource: { value: moxie } }, update: jest.fn() };
    const items = [];
    items.documentsByType = { rolePoints: [moxieItem] };
    return { ...makeActor({ id, name }), items };
  }

  function makeAllyActor({ id, name, health = 0, defeated = true } = {}) {
    return {
      ...makeActor({ id, name }),
      type: 'playerCharacter',
      system: { health: { value: health, max: 10, bonus: 0 } },
      statuses: defeated ? new Set(['defeated']) : new Set(),
      update: jest.fn(),
      toggleStatusEffect: jest.fn(),
    };
  }

  beforeEach(() => {
    game.user.targets = new Set();
    canvas.tokens.placeables = [];
  });

  test("canUsePerk true with Moxie available, false without any", () => {
    const actor = makeOldHandActor({ moxie: 1 });
    expect(canUsePerk(makePerkItem({ sourceId: SQUAD_GUARDIAN_ID, actor }))).toBe(true);

    const brokeActor = makeOldHandActor({ moxie: 0 });
    expect(canUsePerk(makePerkItem({ sourceId: SQUAD_GUARDIAN_ID, actor: brokeActor }))).toBe(false);
  });

  test("gives the targeted Defeated ally 1 Health, removes Defeated, and spends 1 Moxie", async () => {
    const actor = makeOldHandActor({ moxie: 2 });
    const downedAlly = makeAllyActor({ id: 'ally1', health: 0 });
    game.user.targets = new Set([{ actor: downedAlly }]);
    const item = makePerkItem({ sourceId: SQUAD_GUARDIAN_ID, actor });

    await onPerkUse(item);

    expect(downedAlly.update).toHaveBeenCalledWith({ 'system.health.value': 1 });
    expect(downedAlly.toggleStatusEffect).toHaveBeenCalledWith('defeated', { active: false });
    const moxie = actor.items.documentsByType.rolePoints[0];
    expect(moxie.update).toHaveBeenCalledWith({ 'system.resource.value': 1 });
  });

  test("only offers actually-Defeated allies in the picker fallback, not merely low-Health ones", async () => {
    const actor = makeOldHandActor({ moxie: 2 });
    actor.getActiveTokens = jest.fn(() => [{ document: { disposition: 1 }, center: {} }]);
    const defeatedAlly = makeAllyActor({ id: 'ally1', name: 'Defeated', health: 0, defeated: true });
    const woundedAlly = makeAllyActor({ id: 'ally2', name: 'Wounded', health: 1, defeated: false });
    canvas.tokens.placeables = [
      { actor: defeatedAlly, document: { disposition: 1 }, center: {} },
      { actor: woundedAlly, document: { disposition: 1 }, center: {} },
    ];
    foundry.applications.api.DialogV2.wait.mockImplementation(({ content }) => {
      expect(content).toContain('ally1');
      expect(content).not.toContain('ally2');
      return 'cancel';
    });
    const item = makePerkItem({ sourceId: SQUAD_GUARDIAN_ID, actor });

    await onPerkUse(item);

    expect(foundry.applications.api.DialogV2.wait).toHaveBeenCalled();
    expect(defeatedAlly.update).not.toHaveBeenCalled();
  });

  test("warns and does nothing without a Moxie Point to spend", async () => {
    const actor = makeOldHandActor({ moxie: 0 });
    const downedAlly = makeAllyActor({ id: 'ally1', health: 0 });
    game.user.targets = new Set([{ actor: downedAlly }]);
    const item = makePerkItem({ sourceId: SQUAD_GUARDIAN_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(downedAlly.update).not.toHaveBeenCalled();
    expect(downedAlly.toggleStatusEffect).not.toHaveBeenCalled();
  });
});

describe("Forward Observation (General Hawk's Personnel Files, General Perk, p.175)", () => {
  const FORWARD_OBSERVATION_ID = "Compendium.essence20.general_hawk_s_personel_files.Item.wOxrMAMHJWFs1DBN";

  test("canUsePerk is always true - RAW states no cost or frequency cap", () => {
    const actor = { ...makeActor(), _dice: { rollSkill: jest.fn() } };
    expect(canUsePerk(makePerkItem({ sourceId: FORWARD_OBSERVATION_ID, actor }))).toBe(true);
  });

  test("triggers the flat-DIF Alertness roll", async () => {
    const actor = { ...makeActor(), _dice: { rollSkill: jest.fn() } };
    const item = makePerkItem({ sourceId: FORWARD_OBSERVATION_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'alertness', essence: 'smarts', dif: 15, isForwardObservation: true }),
      actor,
    );
  });
});

describe("Hearty Meal (General Hawk's Personnel Files, General Perk, p.174)", () => {
  const HEARTY_MEAL_ID = "Compendium.essence20.general_hawk_s_personel_files.Item.NULhQcWctFcXXdDH";

  beforeEach(() => {
    foundry.applications.api.DialogV2.wait.mockReset();
  });

  test("canUsePerk is always true - RAW states no cost or frequency cap", () => {
    const actor = { ...makeActor(), _dice: { rollSkill: jest.fn() } };
    expect(canUsePerk(makePerkItem({ sourceId: HEARTY_MEAL_ID, actor }))).toBe(true);
  });

  test("prompts for a skill and triggers the flat-DIF check", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('performance');
    const actor = { ...makeActor(), _dice: { rollSkill: jest.fn() } };
    const item = makePerkItem({ sourceId: HEARTY_MEAL_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'performance', essence: 'social', dif: 15, isHeartyMeal: true }), actor,
    );
  });
});

describe("EMT Crash Course (GI Joe CRB, General Perk, p.132)", () => {
  const EMT_CRASH_COURSE_ID = "Compendium.essence20.gi_joe_crb.Item.jDAu1zaZpv1IylJ8";

  function makeEmtActor({ id, name, health = 5, healthMax = 10, essences } = {}) {
    return {
      ...makeActor({ id, name }),
      system: {
        health: { value: health, max: healthMax },
        essences: essences ?? {
          strength: { value: 3, max: 3 }, speed: { value: 3, max: 3 },
          smarts: { value: 3, max: 3 }, social: { value: 3, max: 3 },
        },
      },
      update: jest.fn(async function (data) {
        for (const [path, value] of Object.entries(data)) {
          const parts = path.split('.');
          if (parts[1] == 'health') {
            this.system.health.value = value;
          } else if (parts[1] == 'essences') {
            this.system.essences[parts[2]].value = value;
          }
        }
      }),
    };
  }

  beforeEach(() => {
    game.combat = null;
    game.user.targets = new Set();
    canvas.tokens.placeables = [];
    foundry.applications.api.DialogV2.wait.mockReset();
    ui.notifications.warn.mockReset();
  });

  test("canUsePerk is always true - the picker itself gates each half", () => {
    const actor = makeEmtActor();
    const item = makePerkItem({ sourceId: EMT_CRASH_COURSE_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("also dispatches for PR CRB's own identically-worded reprint (built 2026-09-12)", () => {
    const actor = makeEmtActor();
    const item = makePerkItem({ sourceId: "Compendium.essence20.pr_crb.Item.cBezxXDBMpsRwYbP", actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("does nothing when the action picker is cancelled", async () => {
    const actor = makeEmtActor();
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const item = makePerkItem({ sourceId: EMT_CRASH_COURSE_ID, actor });

    await onPerkUse(item);

    expect(actor.update).not.toHaveBeenCalled();
  });

  test("heal: heals the already-targeted ally by 1 and marks the encounter flag", async () => {
    game.combat = { id: 'combat1' };
    const actor = makeEmtActor({ id: 'medic' });
    const ally = makeEmtActor({ id: 'ally1', name: 'Ally', health: 5 });
    game.user.targets = new Set([{ actor: ally }]);
    foundry.applications.api.DialogV2.wait.mockResolvedValue('heal');
    const item = makePerkItem({ sourceId: EMT_CRASH_COURSE_ID, actor });

    await onPerkUse(item);

    expect(ally.update).toHaveBeenCalledWith({ 'system.health.value': 6 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'emtCrashCourseHealUsedThisEncounter', { combatId: 'combat1' });
  });

  test("heal option is dropped from the picker once already used this encounter", async () => {
    game.combat = { id: 'combat1' };
    const actor = makeEmtActor();
    actor.getFlag = jest.fn(() => ({ combatId: 'combat1' }));
    const ally = makeEmtActor({ id: 'ally1', name: 'Ally' });
    game.user.targets = new Set([{ actor: ally }]);
    foundry.applications.api.DialogV2.wait.mockImplementation(({ content }) => {
      expect(content).not.toContain('EmtCrashCourseHealOption');
      return 'restoreEssence';
    });
    const item = makePerkItem({ sourceId: EMT_CRASH_COURSE_ID, actor });

    await onPerkUse(item);

    expect(foundry.applications.api.DialogV2.wait).toHaveBeenCalled();
  });

  test("restoreEssence: restores the chosen Essence on the already-targeted ally", async () => {
    const actor = makeEmtActor({ id: 'medic' });
    const ally = makeEmtActor({
      id: 'ally1', name: 'Ally', essences: { strength: { value: 2, max: 3 }, speed: { value: 3, max: 3 }, smarts: { value: 3, max: 3 }, social: { value: 3, max: 3 } },
    });
    game.user.targets = new Set([{ actor: ally }]);
    foundry.applications.api.DialogV2.wait
      .mockResolvedValueOnce('restoreEssence')
      .mockResolvedValueOnce('strength');
    const item = makePerkItem({ sourceId: EMT_CRASH_COURSE_ID, actor });

    await onPerkUse(item);

    expect(ally.update).toHaveBeenCalledWith({ 'system.essences.strength.value': 3 });
  });

  test("restoreEssence: warns and restores nothing when the target has no damaged Essence", async () => {
    const actor = makeEmtActor({ id: 'medic' });
    const ally = makeEmtActor({ id: 'ally1', name: 'Ally' });
    game.user.targets = new Set([{ actor: ally }]);
    foundry.applications.api.DialogV2.wait.mockResolvedValue('restoreEssence');
    const item = makePerkItem({ sourceId: EMT_CRASH_COURSE_ID, actor });

    await onPerkUse(item);

    expect(ally.update).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });
});

describe("Whatever Helps (MLP Generosity, 14th level, p.75)", () => {
  const WHATEVER_HELPS_ID = "Compendium.essence20.mlp_crb.Item.NyZxFpc8Aop7PDDa";

  function makeSelfHealActor({ id, name, health = 5, healthMax = 10 } = {}) {
    return {
      ...makeActor({ id, name }),
      system: { health: { value: health, max: healthMax } },
      update: jest.fn(),
    };
  }

  beforeEach(() => {
    game.user.targets = new Set();
    canvas.tokens.placeables = [];
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
  });

  describe("canUsePerk", () => {
    test("true when the actor can afford the Health cost", () => {
      const actor = makeSelfHealActor({ health: 5 });
      const item = makePerkItem({ sourceId: WHATEVER_HELPS_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false when the actor can't afford the Health cost", () => {
      const actor = makeSelfHealActor({ health: 0 });
      const item = makePerkItem({ sourceId: WHATEVER_HELPS_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("heals the targeted ally 2 and costs the granter 1 Health (not Personal Power)", async () => {
    const actor = makeSelfHealActor({ id: 'pony5', health: 5 });
    const ally = makeSelfHealActor({ id: 'ally4', name: 'Scootaloo', health: 4 });
    game.user.targets = new Set([{ actor: ally }]);
    const item = makePerkItem({ sourceId: WHATEVER_HELPS_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 4 });
    expect(ally.update).toHaveBeenCalledWith({ 'system.health.value': 6 });
  });

  test("doesn't heal the ally past their own max Health", async () => {
    const actor = makeSelfHealActor({ id: 'pony5', health: 5 });
    const ally = makeSelfHealActor({ id: 'ally4', name: 'Scootaloo', health: 10, healthMax: 10 });
    game.user.targets = new Set([{ actor: ally }]);
    const item = makePerkItem({ sourceId: WHATEVER_HELPS_ID, actor });

    await onPerkUse(item);

    expect(ally.update).toHaveBeenCalledWith({ 'system.health.value': 10 });
  });

  test("warns and does nothing when the actor can't afford the Health cost", async () => {
    const actor = makeSelfHealActor({ id: 'pony5', health: 0 });
    const item = makePerkItem({ sourceId: WHATEVER_HELPS_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });
});

describe("Power Heal (Across the Stars, Silver Ranger, 1st/7th/13th level, p.55)", () => {
  const POWER_HEAL_ID = "Compendium.essence20.across_the_stars.Item.2mStsiWlvvv14YQz";

  function makePowerHealActor({ id, name, power = 1, health = 5, healthMax = 10 } = {}) {
    return {
      ...makeActor({ id, name }),
      system: { powers: { personal: { value: power } }, health: { value: health, max: healthMax } },
      update: jest.fn(),
    };
  }

  beforeEach(() => {
    game.user.targets = new Set();
    canvas.tokens.placeables = [];
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
  });

  describe("canUsePerk", () => {
    test("true when the actor can afford 1 Personal Power", () => {
      const actor = makePowerHealActor({ power: 1 });
      const item = makePerkItem({ sourceId: POWER_HEAL_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false when the actor can't afford it", () => {
      const actor = makePowerHealActor({ power: 0 });
      const item = makePerkItem({ sourceId: POWER_HEAL_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("heals the actor themselves (no ally picker) by the Perk's own current advances value, and spends 1 Power", async () => {
    const actor = makePowerHealActor({ id: 'ranger', power: 1, health: 4 });
    const item = makePerkItem({ sourceId: POWER_HEAL_ID, actor, currentValue: 2 });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 6 });
  });

  test("doesn't heal past the actor's own max Health", async () => {
    const actor = makePowerHealActor({ id: 'ranger', power: 1, health: 10, healthMax: 10 });
    const item = makePerkItem({ sourceId: POWER_HEAL_ID, actor, currentValue: 1 });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 10 });
  });

  test("defaults to healing 1 if the Perk item has no advances.currentValue set", async () => {
    const actor = makePowerHealActor({ id: 'ranger', power: 1, health: 4 });
    const item = makePerkItem({ sourceId: POWER_HEAL_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
  });

  test("warns and does nothing when the actor can't afford it", async () => {
    const actor = makePowerHealActor({ id: 'ranger', power: 0 });
    const item = makePerkItem({ sourceId: POWER_HEAL_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });
});

describe("Heart of the Team (Black Ranger, 1st/5th/10th/15th level, p.33)", () => {
  function makeQuipsActor({ id = 'leader', quipsValue = 2 } = {}) {
    const rolePointsItem = { system: { resource: { value: quipsValue } }, update: jest.fn() };
    return {
      ...makeActor({ id }),
      _getBaseRolePoints: jest.fn(() => rolePointsItem),
    };
  }

  beforeEach(() => {
    game.user.targets = new Set();
    canvas.tokens.placeables = [];
    foundry.applications.api.DialogV2.wait.mockReset();
    ui.notifications.warn.mockReset();
  });

  describe("canUsePerk", () => {
    test("true with at least 1 Quips & Speeches remaining", () => {
      const actor = makeQuipsActor({ quipsValue: 1 });
      const item = makePerkItem({ sourceId: HEART_OF_THE_TEAM_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false with 0 Quips & Speeches remaining", () => {
      const actor = makeQuipsActor({ quipsValue: 0 });
      const item = makePerkItem({ sourceId: HEART_OF_THE_TEAM_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("banks a shiftUp on the single already-targeted ally and spends a Quips & Speeches point", async () => {
    const actor = makeQuipsActor({ quipsValue: 2 });
    const ally = makeActor({ id: 'ally1', name: 'Zack' });
    game.user.targets = new Set([{ actor: ally }]);
    const item = makePerkItem({ sourceId: HEART_OF_THE_TEAM_ID, actor, currentValue: 2 });

    await onPerkUse(item);

    expect(ally.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingHeartOfTheTeam', expect.objectContaining({ shiftUp: 2 }),
    );
    expect(actor._getBaseRolePoints().update).toHaveBeenCalledWith({ 'system.resource.value': 1 });
  });

  test("warns and does nothing when there are no Quips & Speeches left", async () => {
    const actor = makeQuipsActor({ quipsValue: 0 });
    const ally = makeActor({ id: 'ally1', name: 'Zack' });
    game.user.targets = new Set([{ actor: ally }]);
    const item = makePerkItem({ sourceId: HEART_OF_THE_TEAM_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(ally.setFlag).not.toHaveBeenCalled();
  });
});

describe("Guidance (GI Joe CRB, Focus: Scout, 10th level, p.94)", () => {
  function makeAdaptationActor({ id = 'ranger', pointsValue = 2 } = {}) {
    const rolePointsItem = { system: { resource: { value: pointsValue } }, update: jest.fn() };
    return {
      ...makeActor({ id }),
      _getBaseRolePoints: jest.fn(() => rolePointsItem),
    };
  }

  beforeEach(() => {
    game.user.targets = new Set();
    canvas.tokens.placeables = [];
    foundry.applications.api.DialogV2.wait.mockReset();
    ui.notifications.warn.mockReset();
  });

  describe("canUsePerk", () => {
    test("true with at least 1 Adaptation Point remaining", () => {
      const actor = makeAdaptationActor({ pointsValue: 1 });
      const item = makePerkItem({ sourceId: GUIDANCE_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false with 0 Adaptation Points remaining", () => {
      const actor = makeAdaptationActor({ pointsValue: 0 });
      const item = makePerkItem({ sourceId: GUIDANCE_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("banks a bare marker flag on the single already-targeted ally and spends an Adaptation Point", async () => {
    const actor = makeAdaptationActor({ pointsValue: 2 });
    const ally = makeActor({ id: 'ally1', name: 'Scout Buddy' });
    game.user.targets = new Set([{ actor: ally }]);
    const item = makePerkItem({ sourceId: GUIDANCE_ID, actor });

    await onPerkUse(item);

    expect(ally.setFlag).toHaveBeenCalledWith('essence20', 'pendingGuidance', expect.any(Object));
    expect(actor._getBaseRolePoints().update).toHaveBeenCalledWith({ 'system.resource.value': 1 });
  });

  test("warns and does nothing when there are no Adaptation Points left", async () => {
    const actor = makeAdaptationActor({ pointsValue: 0 });
    const ally = makeActor({ id: 'ally1', name: 'Scout Buddy' });
    game.user.targets = new Set([{ actor: ally }]);
    const item = makePerkItem({ sourceId: GUIDANCE_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(ally.setFlag).not.toHaveBeenCalled();
  });
});

describe("Inspiring Words (GI Joe CRB, Vanguard base, 2nd level, p.109)", () => {
  function makeInspiringActor({ id = 'vanguard1', name = 'Actor' } = {}) {
    return { ...makeActor({ id, name }), toggleStatusEffect: jest.fn() };
  }

  function makeTargetActor({ id = 'ally1', name = 'Ally', bonus = 0, statuses = [] } = {}) {
    return {
      ...makeActor({ id, name }),
      system: { health: { bonus } },
      statuses: new Set(statuses),
      toggleStatusEffect: jest.fn(),
      update: jest.fn(),
    };
  }

  beforeEach(() => {
    game.combat = { id: 'combat1', round: 1, turn: 0 };
    game.user.targets = new Set();
    canvas.tokens.placeables = [];
    foundry.applications.api.DialogV2.wait.mockReset();
    ui.notifications.warn.mockReset();
  });

  afterEach(() => {
    game.combat = null;
  });

  describe("canUsePerk", () => {
    test("true with a fresh combat and no prior uses", () => {
      const actor = makeInspiringActor();
      const item = makePerkItem({ sourceId: INSPIRING_WORDS_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false once both uses are spent this encounter", () => {
      const actor = makeInspiringActor();
      actor.getFlag = jest.fn((scope, key) => (
        key == 'inspiringWordsUsesRemaining' ? { combatId: 'combat1', usesRemaining: 0 } : undefined
      ));
      const item = makePerkItem({ sourceId: INSPIRING_WORDS_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });

    test("false a second time on the same turn", () => {
      const actor = makeInspiringActor();
      actor.getFlag = jest.fn((scope, key) => (
        key == 'inspiringWordsUsedThisTurn' ? { combatId: 'combat1', round: 1, turn: 0 } : undefined
      ));
      const item = makePerkItem({ sourceId: INSPIRING_WORDS_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("grants +1 Temporary Health to the targeted ally and marks a use spent", async () => {
    const actor = makeInspiringActor();
    const ally = makeTargetActor({ bonus: 0 });
    game.user.targets = new Set([{ actor: ally }]);
    foundry.applications.api.DialogV2.wait.mockResolvedValue('tempHealth');
    const item = makePerkItem({ sourceId: INSPIRING_WORDS_ID, actor });

    await onPerkUse(item);

    expect(ally.update).toHaveBeenCalledWith({ 'system.health.bonus': 1 });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'inspiringWordsUsesRemaining', { combatId: 'combat1', usesRemaining: 1 },
    );
  });

  test("removes the chosen Condition from the targeted ally", async () => {
    const actor = makeInspiringActor();
    const ally = makeTargetActor({ statuses: ['frightened'] });
    game.user.targets = new Set([{ actor: ally }]);
    foundry.applications.api.DialogV2.wait
      .mockResolvedValueOnce('removeCondition')
      .mockResolvedValueOnce('frightened');
    const item = makePerkItem({ sourceId: INSPIRING_WORDS_ID, actor });

    await onPerkUse(item);

    expect(ally.toggleStatusEffect).toHaveBeenCalledWith('frightened', { active: false });
  });

  test("banks a +2 shiftUp on the targeted ally's next Skill Test", async () => {
    const actor = makeInspiringActor();
    const ally = makeTargetActor();
    game.user.targets = new Set([{ actor: ally }]);
    foundry.applications.api.DialogV2.wait.mockResolvedValue('shiftUp');
    const item = makePerkItem({ sourceId: INSPIRING_WORDS_ID, actor });

    await onPerkUse(item);

    expect(ally.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingInspiringWords', expect.objectContaining({ shiftUp: 2 }),
    );
  });

  test("does nothing when the effect picker is cancelled", async () => {
    const actor = makeInspiringActor();
    const ally = makeTargetActor();
    game.user.targets = new Set([{ actor: ally }]);
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const item = makePerkItem({ sourceId: INSPIRING_WORDS_ID, actor });

    await onPerkUse(item);

    expect(ally.update).not.toHaveBeenCalled();
    expect(ally.setFlag).not.toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("warns and does nothing with no ally targeted or nearby", async () => {
    const actor = makeInspiringActor();
    const item = makePerkItem({ sourceId: INSPIRING_WORDS_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });

  test("does nothing when already used twice this encounter, even with an ally targeted", async () => {
    const actor = makeInspiringActor();
    actor.getFlag = jest.fn((scope, key) => (
      key == 'inspiringWordsUsesRemaining' ? { combatId: 'combat1', usesRemaining: 0 } : undefined
    ));
    const ally = makeTargetActor();
    game.user.targets = new Set([{ actor: ally }]);
    const item = makePerkItem({ sourceId: INSPIRING_WORDS_ID, actor });

    await onPerkUse(item);

    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
    expect(ally.update).not.toHaveBeenCalled();
  });
});

describe("Trade School (Quartermaster's Guide to Gear, Tech Officer Focus, Officer, 10th level, p.22)", () => {
  const TRADE_SCHOOL_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.yR5QrBHWNUnbuiG7";

  beforeEach(() => {
    game.combat = { id: 'combat1', round: 1 };
    game.user.targets = new Set();
    canvas.tokens.placeables = [];
  });

  afterEach(() => {
    game.combat = null;
  });

  describe("canUsePerk", () => {
    test("true with a fresh combat and no prior use", () => {
      const actor = makeActor();
      const item = makePerkItem({ sourceId: TRADE_SCHOOL_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false once already used this encounter", () => {
      const actor = makeActor();
      actor.getFlag = jest.fn((scope, key) => (
        key == 'tradeSchoolUsedThisEncounter' ? { combatId: 'combat1' } : undefined
      ));
      const item = makePerkItem({ sourceId: TRADE_SCHOOL_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("banks the grant on the targeted ally and marks the scene used", async () => {
    const actor = makeActor({ id: 'officer1' });
    const ally = makeActor({ id: 'ally1' });
    game.user.targets = new Set([{ actor: ally }]);
    const item = makePerkItem({ sourceId: TRADE_SCHOOL_ID, actor });

    await onPerkUse(item);

    expect(ally.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingTradeSchool', expect.objectContaining({ granterId: 'officer1' }),
    );
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'tradeSchoolUsedThisEncounter', expect.any(Object));
  });

  test("does nothing when already used this encounter, even with an ally targeted", async () => {
    const actor = makeActor();
    actor.getFlag = jest.fn((scope, key) => (
      key == 'tradeSchoolUsedThisEncounter' ? { combatId: 'combat1' } : undefined
    ));
    const ally = makeActor({ id: 'ally1' });
    game.user.targets = new Set([{ actor: ally }]);
    const item = makePerkItem({ sourceId: TRADE_SCHOOL_ID, actor });

    await onPerkUse(item);

    expect(ally.setFlag).not.toHaveBeenCalled();
  });

  test("warns and does nothing when there's no ally to pick", async () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: TRADE_SCHOOL_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalledWith('essence20', 'tradeSchoolUsedThisEncounter', expect.any(Object));
  });
});

describe("Tech Specs (Quartermaster's Guide to Gear, Tech Officer Focus, Officer, 10th level, p.22)", () => {
  const TECH_SPECS_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.Ii4gXQePcG8xg0hB";

  test("canUsePerk is always true", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: TECH_SPECS_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  function setFirstTarget(targetActor) {
    const targets = targetActor ? new Set([{ actor: targetActor }]) : new Set();
    targets.first = () => [...targets][0];
    game.user.targets = targets;
  }

  test("triggers a Technology roll against the currently-targeted actor", async () => {
    const actor = { ...makeActor(), _dice: { rollSkill: jest.fn() } };
    const target = {
      ...makeActor({ id: 'target1' }),
      system: {
        defenses: {
          toughness: { total: 8 }, evasion: { total: 15 }, willpower: { total: 10 }, cleverness: { total: 12 },
        },
      },
    };
    setFirstTarget(target);
    const item = makePerkItem({ sourceId: TECH_SPECS_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'technology', defenseType: 'evasion', isTechSpecs: true }), actor,
    );
  });

  test("warns and does nothing without a target", async () => {
    const actor = { ...makeActor(), _dice: { rollSkill: jest.fn() } };
    setFirstTarget(null);
    const item = makePerkItem({ sourceId: TECH_SPECS_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });
});

describe("Breaking Point (Quartermaster's Guide to Gear, Disruptor Focus, Ranger, 1st level, p.23)", () => {
  const BREAKING_POINT_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.KYgAj14jx4BkjCfl";

  function setFirstTarget(targetActor) {
    const targets = targetActor ? new Set([{ actor: targetActor }]) : new Set();
    targets.first = () => [...targets][0];
    game.user.targets = targets;
  }

  test("canUsePerk is always true", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: BREAKING_POINT_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("triggers a Technology roll against DIF 10 + the targeted vehicle's Threat Level", async () => {
    const actor = { ...makeActor(), _dice: { rollSkill: jest.fn() } };
    const target = { type: 'vehicle', uuid: 'Actor.tank1', system: { threatLevel: 5 } };
    setFirstTarget(target);
    const item = makePerkItem({ sourceId: BREAKING_POINT_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'technology', dif: 15, isBreakingPoint: true }), actor,
    );
  });

  test("warns and does nothing without a targeted vehicle", async () => {
    const actor = { ...makeActor(), _dice: { rollSkill: jest.fn() } };
    setFirstTarget(null);
    const item = makePerkItem({ sourceId: BREAKING_POINT_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });
});

describe("Deadstick (Quartermaster's Guide to Gear, Neutralizer Focus, Technician, 10th level, p.26)", () => {
  const DEADSTICK_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.SDwpvAzQX0pYSHyc";

  function setFirstTarget(targetActor) {
    const targets = targetActor ? new Set([{ actor: targetActor }]) : new Set();
    targets.first = () => [...targets][0];
    game.user.targets = targets;
  }

  beforeEach(() => {
    foundry.applications.api.DialogV2.wait.mockReset();
  });

  test("canUsePerk is always true", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: DEADSTICK_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("triggers a Technology roll against the chosen Defense", async () => {
    const actor = { ...makeActor(), _dice: { rollSkill: jest.fn() } };
    setFirstTarget({ uuid: 'Actor.robot1' });
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cleverness');
    const item = makePerkItem({ sourceId: DEADSTICK_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'technology', defenseType: 'cleverness', isDeadstick: true }), actor,
    );
  });

  test("warns and does nothing without a target", async () => {
    const actor = { ...makeActor(), _dice: { rollSkill: jest.fn() } };
    setFirstTarget(null);
    const item = makePerkItem({ sourceId: DEADSTICK_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });
});

describe("Ground Suppression (Quartermaster's Guide to Gear, Strafer Focus, Vanguard, 3rd level, p.28)", () => {
  const GROUND_SUPPRESSION_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.nCjrhYaUuN4omhDm";

  beforeEach(() => {
    foundry.applications.api.DialogV2.wait.mockReset();
    global.canvas = {
      tokens: { placeables: [], setTargets: jest.fn() },
      grid: { measurePath: jest.fn(() => ({ distance: 0 })) },
    };
  });

  test("canUsePerk is always true", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: GROUND_SUPPRESSION_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("triggers a Driving roll against the chosen Defense", async () => {
    const actor = { ...makeActor(), _dice: { rollSkill: jest.fn() } };
    foundry.applications.api.DialogV2.wait.mockResolvedValue('evasion');
    const item = makePerkItem({ sourceId: GROUND_SUPPRESSION_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'driving', defenseType: 'evasion', isGroundSuppression: true }), actor,
    );
  });

  test("triggers nothing when the picker is cancelled", async () => {
    const actor = { ...makeActor(), _dice: { rollSkill: jest.fn() } };
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const item = makePerkItem({ sourceId: GROUND_SUPPRESSION_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("Hard Target (Pink Ranger, 2nd level, p.50)", () => {
  class FakeRoll {
    constructor() {
      this._total = FakeRoll.nextTotal ?? 5;
    }
    async evaluate() {
      return this;
    }
    get total() {
      return this._total;
    }
  }

  let originalRoll;
  beforeAll(() => {
    originalRoll = global.Roll;
    global.Roll = FakeRoll;
  });
  afterAll(() => {
    global.Roll = originalRoll;
  });

  function makeAcrobatActor({ id = 'ranger' } = {}) {
    return {
      ...makeActor({ id }),
      system: { skills: { acrobatics: { shift: 'd8' } } },
      getRollData: jest.fn(() => ({})),
    };
  }

  beforeEach(() => {
    game.user.targets = new Set();
    FakeRoll.nextTotal = 5;
  });

  test("rolls the Acrobatics die and banks the result as a defenseBonus on the actor", async () => {
    const actor = makeAcrobatActor();
    FakeRoll.nextTotal = 6;
    const item = makePerkItem({ sourceId: HARD_TARGET_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingHardTarget', expect.objectContaining({ defenseBonus: 6 }),
    );
  });
});

describe("Resilience (Across the Stars, Gold Ranger, 11th level, p.53)", () => {
  class FakeRoll {
    constructor() {
      this._total = FakeRoll.nextTotal ?? 5;
    }
    async evaluate() {
      return this;
    }
    get total() {
      return this._total;
    }
  }

  let originalRoll;
  beforeAll(() => {
    originalRoll = global.Roll;
    global.Roll = FakeRoll;
  });
  afterAll(() => {
    global.Roll = originalRoll;
  });

  function makeAthleteActor({ id = 'ranger', power = 1 } = {}) {
    return {
      ...makeActor({ id }),
      system: { skills: { athletics: { shift: 'd8' } }, powers: { personal: { value: power } } },
      getRollData: jest.fn(() => ({})),
      update: jest.fn(),
    };
  }

  beforeEach(() => {
    game.user.targets = new Set();
    FakeRoll.nextTotal = 5;
  });

  describe("canUsePerk", () => {
    test("true when the actor can afford 1 Personal Power", () => {
      const actor = makeAthleteActor({ power: 1 });
      const item = makePerkItem({ sourceId: RESILIENCE_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false when the actor can't afford it", () => {
      const actor = makeAthleteActor({ power: 0 });
      const item = makePerkItem({ sourceId: RESILIENCE_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("rolls the Athletics die, banks the result, and spends 1 Personal Power", async () => {
    const actor = makeAthleteActor({ power: 1 });
    FakeRoll.nextTotal = 7;
    const item = makePerkItem({ sourceId: RESILIENCE_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingResilience', expect.objectContaining({ defenseBonus: 7 }),
    );
    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
  });
});

describe("consumeResilience", () => {
  test("returns and consumes the banked bonus against any Defense type", async () => {
    const actor = makeActor();
    actor.getFlag = jest.fn((scope, key) => (
      key == 'pendingResilience' ? { defenseBonus: 4, combatId: null, round: null } : undefined
    ));

    const result = await consumeResilience(actor, 'willpower');

    expect(result).toBe(4);
    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'pendingResilience');
  });

  test("returns 0 with nothing banked", async () => {
    const actor = makeActor();
    expect(await consumeResilience(actor, 'toughness')).toBe(0);
  });

  test("doesn't consume, and returns 0, without a real defenseType", async () => {
    const actor = makeActor();
    actor.getFlag = jest.fn((scope, key) => (
      key == 'pendingResilience' ? { defenseBonus: 4, combatId: null, round: null } : undefined
    ));

    expect(await consumeResilience(actor, 'none')).toBe(0);
    expect(actor.unsetFlag).not.toHaveBeenCalled();
  });
});

describe("Momentary Blur (A Jump Through Time, Quantum Ranger, Quantum Power option, p.45)", () => {
  function makeActorWithPower({ id = 'ranger', power = 1 } = {}) {
    return {
      ...makeActor({ id }),
      system: { powers: { personal: { value: power } } },
      update: jest.fn(),
    };
  }

  describe("canUsePerk", () => {
    test("true when the actor can afford 1 Personal Power", () => {
      const actor = makeActorWithPower({ power: 1 });
      const item = makePerkItem({ sourceId: MOMENTARY_BLUR_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false when the actor can't afford it", () => {
      const actor = makeActorWithPower({ power: 0 });
      const item = makePerkItem({ sourceId: MOMENTARY_BLUR_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });

    test("false while a bank is already pending", () => {
      const actor = makeActorWithPower({ power: 1 });
      actor.getFlag = jest.fn(() => ({ defenseBonus: 3, combatId: null, round: null }));
      const item = makePerkItem({ sourceId: MOMENTARY_BLUR_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("banks a flat +3 Evasion bonus and spends 1 Personal Power", async () => {
    const actor = makeActorWithPower({ power: 1 });
    const item = makePerkItem({ sourceId: MOMENTARY_BLUR_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingMomentaryBlur', expect.objectContaining({ defenseBonus: 3 }),
    );
    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
  });
});

describe("consumeMomentaryBlur", () => {
  test("returns and consumes the banked bonus against an Evasion attack", async () => {
    const actor = makeActor();
    actor.getFlag = jest.fn((scope, key) => (
      key == 'pendingMomentaryBlur' ? { defenseBonus: 3, combatId: null, round: null } : undefined
    ));

    const result = await consumeMomentaryBlur(actor, 'evasion');

    expect(result).toBe(3);
    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'pendingMomentaryBlur');
  });

  test("doesn't consume, and returns 0, against a non-Evasion Defense", async () => {
    const actor = makeActor();
    actor.getFlag = jest.fn((scope, key) => (
      key == 'pendingMomentaryBlur' ? { defenseBonus: 3, combatId: null, round: null } : undefined
    ));

    expect(await consumeMomentaryBlur(actor, 'toughness')).toBe(0);
    expect(actor.unsetFlag).not.toHaveBeenCalled();
  });

  test("returns 0 with nothing banked", async () => {
    const actor = makeActor();
    expect(await consumeMomentaryBlur(actor, 'evasion')).toBe(0);
  });
});

describe("Mark Target (Scout, 2nd level, p.84)", () => {
  function makeTargetsSet(targetActor) {
    const token = { actor: targetActor };
    const set = new Set([token]);
    set.first = () => token;

    return set;
  }

  beforeEach(() => {
    game.user.targets = new Set();
    ui.notifications.warn.mockReset();
    global.ChatMessage.create?.mockReset();
  });

  describe("canUsePerk", () => {
    test("always true, regardless of any pending state", () => {
      const actor = makeActor();
      const item = makePerkItem({ sourceId: MARK_TARGET_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });
  });

  test("marks the currently-targeted token's actor and notifies", async () => {
    const actor = makeActor({ id: 'scout' });
    const targetActor = { uuid: 'Actor.target1' };
    game.user.targets = makeTargetsSet(targetActor);
    const item = makePerkItem({ sourceId: MARK_TARGET_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'markedTargetUuid', 'Actor.target1');
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("warns and sets no flag when nothing is targeted", async () => {
    const actor = makeActor({ id: 'scout' });
    game.user.targets = makeTargetsSet(undefined);
    game.user.targets.first = () => undefined;
    const item = makePerkItem({ sourceId: MARK_TARGET_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });
});

describe("Relic Key (PR CRB, Zord Feature, p.140) - Edge on any one roll in the scene", () => {
  const RELIC_KEY_ID = "Compendium.essence20.pr_crb.Item.uSlClAv3oJjf54pa";

  function makeFeatureItem(sourceId) {
    return { type: 'feature', name: 'Test Feature', flags: { core: { sourceId } } };
  }

  // actorHasZordFeature (helpers/zord-features.mjs) looks the Feature up via actor.items, unlike
  // actorHasPerk's callers elsewhere in this file which only need item.parent - so the item has
  // to actually be IN the actor's own items array here, not just point back at it.
  function makeZordActor(item) {
    const actor = { ...makeActor(), type: 'zord', items: [item] };
    item.parent = actor;
    return actor;
  }

  describe("canUsePerk", () => {
    test("true for a Zord holding Relic Key, not yet declared - the Use button works for a Feature item, not just Perks", () => {
      const item = makeFeatureItem(RELIC_KEY_ID);
      makeZordActor(item);
      expect(canUsePerk(item)).toBe(true);
    });

    test("false for an ordinary non-Relic-Key Feature item", () => {
      const item = makeFeatureItem('Compendium.essence20.pr_crb.Item.someOtherFeature');
      makeZordActor(item);
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("onPerkUse declares the Edge grant", async () => {
    const item = makeFeatureItem(RELIC_KEY_ID);
    const actor = makeZordActor(item);

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'relicKeyEdgeActive', true);
  });
});

describe("Timely Teammate (Ferocious Fighters, Tiger Force General Perk, p.39)", () => {
  const TIMELY_TEAMMATE_ID = "Compendium.essence20.ferocious_fighters.Item.yrhhCOXpS8Mx1R0C";

  function makeCombatant(actor, initiative) {
    return { actor, initiative, update: jest.fn(async function (data) {
      this.initiative = data.initiative; 
    }) };
  }

  function makeTargetsSet(targetActor) {
    const token = { actor: targetActor };
    const set = new Set([token]);
    set.first = () => token;

    return set;
  }

  beforeEach(() => {
    game.user.targets = new Set();
    game.combat = null;
    ui.notifications.warn.mockReset();
    global.ChatMessage.create?.mockReset();
  });

  describe("canUsePerk", () => {
    test("true in combat, not yet used this encounter", () => {
      game.combat = { id: 'combat1' };
      const actor = makeActor();
      const item = makePerkItem({ sourceId: TIMELY_TEAMMATE_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false outside combat", () => {
      const actor = makeActor();
      const item = makePerkItem({ sourceId: TIMELY_TEAMMATE_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("swaps the actor's and the targeted ally's Initiative and notifies", async () => {
    const actor = makeActor({ id: 'actor1' });
    const targetActor = { id: 'actor2' };
    const actorCombatant = makeCombatant(actor, 10);
    const targetCombatant = makeCombatant(targetActor, 18);
    game.combat = { id: 'combat1', combatants: [actorCombatant, targetCombatant] };
    game.user.targets = makeTargetsSet(targetActor);
    const item = makePerkItem({ sourceId: TIMELY_TEAMMATE_ID, actor });

    await onPerkUse(item);

    expect(actorCombatant.update).toHaveBeenCalledWith({ initiative: 18 });
    expect(targetCombatant.update).toHaveBeenCalledWith({ initiative: 10 });
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("warns and swaps nothing when no ally is targeted", async () => {
    const actor = makeActor({ id: 'actor1' });
    game.combat = { id: 'combat1', combatants: [makeCombatant(actor, 10)] };
    game.user.targets = makeTargetsSet(undefined);
    game.user.targets.first = () => undefined;
    const item = makePerkItem({ sourceId: TIMELY_TEAMMATE_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
  });
});

describe("Roar! (Ferocious Fighters, Tiger Force Faction Perk)", () => {
  const ROAR_ID = "Compendium.essence20.ferocious_fighters.Item.AaI58jYka8MfhIbc";

  beforeEach(() => {
    game.combat = null;
    ui.notifications.warn.mockReset();
    global.ChatMessage.create?.mockReset();
    global.foundry = { applications: { api: { DialogV2: { wait: jest.fn().mockResolvedValue('toughness') } } } };
  });

  afterEach(() => {
    game.combat = null;
  });

  describe("canUsePerk", () => {
    test("true in combat, not yet used this encounter", () => {
      game.combat = { id: 'combat1' };
      const actor = makeActor();
      const item = makePerkItem({ sourceId: ROAR_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false outside combat", () => {
      const actor = makeActor();
      const item = makePerkItem({ sourceId: ROAR_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("banks the chosen Defense and notifies", async () => {
    game.combat = { id: 'combat1' };
    const actor = makeActor();
    const item = makePerkItem({ sourceId: ROAR_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'roarActive', { defenseType: 'toughness', combatId: 'combat1' });
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("does nothing outside combat", async () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: ROAR_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe("Protected Target (GI Joe CRB, Bodyguard Focus, 1st level, p.110)", () => {
  const PROTECTED_TARGET_ID = "Compendium.essence20.gi_joe_crb.Item.llnU5dWqYlfgLA5V";

  function makeTargetsSet(targetActor) {
    const token = { actor: targetActor };
    const set = new Set([token]);
    set.first = () => token;

    return set;
  }

  function makeTargetActor(uuid) {
    return { uuid, system: { health: { bonus: 0 } }, update: jest.fn(async function (data) {
      this.system.health.bonus = data['system.health.bonus'];
    }) };
  }

  beforeEach(() => {
    game.combat = { id: 'combat1' };
    game.user.targets = new Set();
    ui.notifications.warn.mockReset();
    global.ChatMessage.create?.mockReset();
  });

  afterEach(() => {
    game.combat = null;
  });

  describe("canUsePerk", () => {
    test("true when not yet used this encounter", () => {
      const actor = makeActor();
      const item = makePerkItem({ sourceId: PROTECTED_TARGET_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false once already used this encounter", () => {
      const actor = makeActor();
      actor.getFlag = jest.fn((scope, key) => (
        key == 'protectedTargetUsedThisEncounter' ? { combatId: 'combat1' } : undefined
      ));
      const item = makePerkItem({ sourceId: PROTECTED_TARGET_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("designates the currently-targeted actor, grants +1 Temporary Health, and notifies", async () => {
    const actor = makeActor({ id: 'bodyguard' });
    const targetActor = makeTargetActor('Actor.target1');
    game.user.targets = makeTargetsSet(targetActor);
    const item = makePerkItem({ sourceId: PROTECTED_TARGET_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'protectedTargetUuid', 'Actor.target1');
    expect(targetActor.system.health.bonus).toBe(1);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("warns and sets no flag when nothing is targeted", async () => {
    const actor = makeActor({ id: 'bodyguard' });
    game.user.targets = makeTargetsSet(undefined);
    game.user.targets.first = () => undefined;
    const item = makePerkItem({ sourceId: PROTECTED_TARGET_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });
});

describe("Eye for Appraisal (Decepticon Directive Raider, 1st level, p.61)", () => {
  function makeTargetsSet(targetActor) {
    const token = { actor: targetActor };
    const set = new Set([token]);
    set.first = () => token;

    return set;
  }

  beforeEach(() => {
    game.user.targets = new Set();
    ui.notifications.warn.mockReset();
    global.ChatMessage.create?.mockReset();
  });

  describe("canUsePerk", () => {
    test("always true, regardless of any pending state", () => {
      const actor = makeActor();
      const item = makePerkItem({ sourceId: EYE_FOR_APPRAISAL_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });
  });

  test("marks the currently-targeted token with a 2-use flag and notifies", async () => {
    const actor = makeActor({ id: 'raider1' });
    const targetActor = makeActor({ id: 'target1' });
    game.user.targets = makeTargetsSet(targetActor);
    const item = makePerkItem({ sourceId: EYE_FOR_APPRAISAL_ID, actor });

    await onPerkUse(item);

    expect(targetActor.setFlag).toHaveBeenCalledWith(
      'essence20', 'eyeForAppraisalMark', { attackerId: 'raider1', usesRemaining: 2 },
    );
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("warns and sets no flag when nothing is targeted", async () => {
    const actor = makeActor({ id: 'raider1' });
    game.user.targets = makeTargetsSet(undefined);
    game.user.targets.first = () => undefined;
    const item = makePerkItem({ sourceId: EYE_FOR_APPRAISAL_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
  });
});

describe("Weapon Conversion (Decepticon Directive Raider, Acquisitions Expert Focus, 10th level, p.63)", () => {
  function makeWeaponConversionActor({ hasEligibleWeapon = true } = {}) {
    const effect = {
      id: 'effect1',
      type: 'weaponEffect',
      flags: { essence20: { parentId: 'weapon1' } },
      system: { numHands: 2, classification: { style: 'projectile' }, shiftDown: 0, range: { value: 60, long: 120 } },
      update: jest.fn(),
    };
    const weapon = { id: 'weapon1', system: { traits: [] }, update: jest.fn() };
    const items = hasEligibleWeapon ? [effect, weapon] : [];
    items.get = jest.fn(id => items.find(i => i.id == id));
    items.filter = Array.prototype.filter.bind(items);

    return { ...makeActor(), items, __effect: effect, __weapon: weapon };
  }

  beforeEach(() => {
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
  });

  test("canUsePerk reflects whether an eligible weapon exists", () => {
    expect(canUsePerk(makePerkItem({
      sourceId: WEAPON_CONVERSION_ID, actor: makeWeaponConversionActor({ hasEligibleWeapon: true }),
    }))).toBe(true);
    expect(canUsePerk(makePerkItem({
      sourceId: WEAPON_CONVERSION_ID, actor: makeWeaponConversionActor({ hasEligibleWeapon: false }),
    }))).toBe(false);
  });

  test("converts the actor's only eligible weapon and notifies", async () => {
    const actor = makeWeaponConversionActor();
    const item = makePerkItem({ sourceId: WEAPON_CONVERSION_ID, actor });

    await onPerkUse(item);

    expect(actor.__effect.update).toHaveBeenCalledWith(expect.objectContaining({ 'system.numHands': 1 }));
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("warns and does nothing with no eligible weapon", async () => {
    const actor = makeWeaponConversionActor({ hasEligibleWeapon: false });
    const item = makePerkItem({ sourceId: WEAPON_CONVERSION_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(global.ChatMessage.create).not.toHaveBeenCalled();
  });
});

describe("Dig In (Decepticon Directive Raider, Siegemaster Focus, 10th level, p.64)", () => {
  test("always true - no cost or gate beyond the Move action itself", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: DIG_IN_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("toggles from off to on and notifies", async () => {
    const actor = makeActor({ id: 'raider1', name: 'Blot' });
    actor.getFlag = jest.fn(() => false);
    const item = makePerkItem({ sourceId: DIG_IN_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'digInActive', true);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("toggles from on to off", async () => {
    const actor = makeActor({ id: 'raider1', name: 'Blot' });
    actor.getFlag = jest.fn(() => true);
    const item = makePerkItem({ sourceId: DIG_IN_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'digInActive', false);
  });
});

describe("Meat Shield (Sgt Slaughter Sourcebook, Alternate Vanguard Role Perk, p.14)", () => {
  const MEAT_SHIELD_ID = "Compendium.essence20.sgt_slaughter_sourcebook.Item.hYwFDsC7azfYB5fO";

  test("always true - no cost or gate beyond the Free action itself", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: MEAT_SHIELD_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("toggles from off to on and notifies", async () => {
    const actor = makeActor({ id: 'vanguard1', name: 'Grunt' });
    actor.getFlag = jest.fn(() => false);
    const item = makePerkItem({ sourceId: MEAT_SHIELD_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'meatShieldActive', true);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("toggles from on to off", async () => {
    const actor = makeActor({ id: 'vanguard1', name: 'Grunt' });
    actor.getFlag = jest.fn(() => true);
    const item = makePerkItem({ sourceId: MEAT_SHIELD_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'meatShieldActive', false);
  });
});

describe("Metallikato (Decepticon Directive, General Perk, p.66)", () => {
  const METALLIKATO_ID = "Compendium.essence20.decepticon_directive.Item.ouLZnb7j0kAfCrLx";

  test("always true - no cost or gate beyond the Free action itself", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: METALLIKATO_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("toggles from off to on and notifies", async () => {
    const actor = makeActor({ id: 'raider1', name: 'Bludgeon' });
    actor.getFlag = jest.fn(() => false);
    const item = makePerkItem({ sourceId: METALLIKATO_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'metallikatoMultipleTargetsActive', true);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("toggles from on to off", async () => {
    const actor = makeActor({ id: 'raider1', name: 'Bludgeon' });
    actor.getFlag = jest.fn(() => true);
    const item = makePerkItem({ sourceId: METALLIKATO_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'metallikatoMultipleTargetsActive', false);
  });
});

describe("Box Shot (Quartermaster's Guide to Gear, General Perk, p.28)", () => {
  const BOX_SHOT_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.N8E3QTLUKX6DOoEc";

  beforeEach(() => {
    game.combat = { id: 'combat1', round: 1, turn: 0 };
    global.ChatMessage.create?.mockReset();
  });

  afterEach(() => {
    game.combat = null;
  });

  test("true to activate, not yet used this scene", () => {
    const actor = makeActor();
    actor.getFlag = jest.fn(() => undefined);
    const item = makePerkItem({ sourceId: BOX_SHOT_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("false to activate once already used this scene, while inactive", () => {
    const actor = makeActor();
    actor.getFlag = jest.fn((scope, key) => (key == 'boxShotUsedThisEncounter' ? { combatId: 'combat1' } : undefined));
    const item = makePerkItem({ sourceId: BOX_SHOT_ID, actor });
    expect(canUsePerk(item)).toBe(false);
  });

  test("toggles from off to on, marks the scene used, and notifies", async () => {
    const actor = makeActor({ id: 'gunner1', name: 'Recoil' });
    actor.getFlag = jest.fn(() => undefined);
    const item = makePerkItem({ sourceId: BOX_SHOT_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'boxShotActive', true);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("toggles from on to off", async () => {
    const actor = makeActor({ id: 'gunner1', name: 'Recoil' });
    actor.getFlag = jest.fn((scope, key) => (key == 'boxShotActive' ? true : undefined));
    const item = makePerkItem({ sourceId: BOX_SHOT_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'boxShotActive', false);
  });

  test("does nothing when trying to activate once already used this scene", async () => {
    const actor = makeActor({ id: 'gunner1', name: 'Recoil' });
    actor.getFlag = jest.fn((scope, key) => (key == 'boxShotUsedThisEncounter' ? { combatId: 'combat1' } : undefined));
    const item = makePerkItem({ sourceId: BOX_SHOT_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe("Dig In (Enigma of Combination, Cannoneer Focus, 17th level, p.32)", () => {
  const CANNONEER_DIG_IN_ID = "Compendium.essence20.enigma_of_combination.Item.RQjNiRZxDFwTPHN8";

  test("always true - no cost or gate beyond the Move action itself", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: CANNONEER_DIG_IN_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("toggles from off to on and notifies", async () => {
    const actor = makeActor({ id: 'cannoneer1', name: 'Pyra Magna' });
    actor.getFlag = jest.fn(() => false);
    const item = makePerkItem({ sourceId: CANNONEER_DIG_IN_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'cannoneerDugIn', true);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("toggles from on to off", async () => {
    const actor = makeActor({ id: 'cannoneer1', name: 'Pyra Magna' });
    actor.getFlag = jest.fn(() => true);
    const item = makePerkItem({ sourceId: CANNONEER_DIG_IN_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'cannoneerDugIn', false);
  });
});

describe("Skier (General Hawk's Personnel Files, General Perk, p.175)", () => {
  const SKIER_ID = "Compendium.essence20.general_hawk_s_personel_files.Item.dvmY7UiuKejOPY4N";

  test("always true - no cost or gate beyond the narrative activity itself", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: SKIER_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("toggles from off to on and notifies", async () => {
    const actor = makeActor({ id: 'skier1', name: 'Snow Job' });
    actor.getFlag = jest.fn(() => false);
    const item = makePerkItem({ sourceId: SKIER_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'isSkiingActive', true);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("toggles from on to off", async () => {
    const actor = makeActor({ id: 'skier1', name: 'Snow Job' });
    actor.getFlag = jest.fn(() => true);
    const item = makePerkItem({ sourceId: SKIER_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'isSkiingActive', false);
  });
});

describe("It's Time (Field Guide to Action and Adventure, General Perk, p.70)", () => {
  const ITS_TIME_ID = "Compendium.essence20.field_guide_action_adventure.Item.HT4iCNp5WIWXR5bJ";

  test("always true - no cost or gate beyond the narrative action itself", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: ITS_TIME_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("toggles isMorphed from false to true and notifies", async () => {
    const actor = makeActor({ id: 'itstime1', name: 'Roadblock' });
    actor.system = { isMorphed: false };
    actor.update = jest.fn(async (data) => {
      actor.system.isMorphed = data["system.isMorphed"]; 
    });
    const item = makePerkItem({ sourceId: ITS_TIME_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ "system.isMorphed": true });
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("toggles isMorphed from true to false", async () => {
    const actor = makeActor({ id: 'itstime1', name: 'Roadblock' });
    actor.system = { isMorphed: true };
    actor.update = jest.fn(async (data) => {
      actor.system.isMorphed = data["system.isMorphed"]; 
    });
    const item = makePerkItem({ sourceId: ITS_TIME_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ "system.isMorphed": false });
  });
});

describe("Bulwark (GI Joe CRB, Tank Focus, 17th level, p.99)", () => {
  const BULWARK_ID = "Compendium.essence20.gi_joe_crb.Item.7758n3XWOzhSjdOk";

  test("always true - free to toggle either way", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: BULWARK_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("toggles from off to on and notifies", async () => {
    const actor = makeActor({ id: 'tank1', name: 'Roadblock' });
    actor.getFlag = jest.fn(() => false);
    const item = makePerkItem({ sourceId: BULWARK_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'bulwarkActive', true);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("toggles from on to off", async () => {
    const actor = makeActor({ id: 'tank1', name: 'Roadblock' });
    actor.getFlag = jest.fn(() => true);
    const item = makePerkItem({ sourceId: BULWARK_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'bulwarkActive', false);
  });
});

describe("Honest Assessment (MLP CRB, Spirit of Honesty, 14th level, p.79)", () => {
  const HONEST_ASSESSMENT_ID = "Compendium.essence20.mlp_crb.Item.eIDYxShici5rRpg3";

  test("always true - free to toggle either way", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: HONEST_ASSESSMENT_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("toggles from off to on and notifies", async () => {
    const actor = makeActor({ id: 'pony1', name: 'Applejack' });
    actor.getFlag = jest.fn(() => false);
    const item = makePerkItem({ sourceId: HONEST_ASSESSMENT_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'honestAssessmentActive', true);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("toggles from on to off", async () => {
    const actor = makeActor({ id: 'pony1', name: 'Applejack' });
    actor.getFlag = jest.fn(() => true);
    const item = makePerkItem({ sourceId: HONEST_ASSESSMENT_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'honestAssessmentActive', false);
  });
});

describe("Pointy (Dark Skies Over Equestria, General Perk, p.21)", () => {
  const POINTY_ID = "Compendium.essence20.dark_skies_over_equestria.Item.kwkUWzNVdSKDx0jt";

  test("always true - no cost or gate beyond the Free action itself", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: POINTY_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("toggles from off to on and notifies", async () => {
    const actor = makeActor({ id: 'pony1', name: 'Ocellus' });
    actor.getFlag = jest.fn(() => false);
    const item = makePerkItem({ sourceId: POINTY_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'pointyActive', true);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("toggles from on to off", async () => {
    const actor = makeActor({ id: 'pony1', name: 'Ocellus' });
    actor.getFlag = jest.fn(() => true);
    const item = makePerkItem({ sourceId: POINTY_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'pointyActive', false);
  });
});

describe("Calm Hearted (Dark Skies Over Equestria, General Perk, p.43)", () => {
  const CALM_HEARTED_ID = "Compendium.essence20.dark_skies_over_equestria.Item.uZX4nbGjbQ0b6u2i";

  beforeEach(() => {
    game.combat = null;
  });

  test("canUsePerk is true with no cost, as long as it hasn't been used this scene", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: CALM_HEARTED_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("canUsePerk is false once already used this scene", () => {
    game.combat = { id: 'combat1' };
    const actor = makeActor();
    actor.getFlag = jest.fn((scope, key) => (
      key == 'calmHeartedUsedThisEncounter' ? { combatId: 'combat1' } : undefined
    ));
    const item = makePerkItem({ sourceId: CALM_HEARTED_ID, actor });
    expect(canUsePerk(item)).toBe(false);
  });

  test("banks an Edge on the actor and marks the scene used", async () => {
    game.combat = { id: 'combat1' };
    const actor = makeActor();
    const item = makePerkItem({ sourceId: CALM_HEARTED_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingCalmHearted', expect.objectContaining({ edge: true }),
    );
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'calmHeartedUsedThisEncounter', { combatId: 'combat1' },
    );
  });
});

describe("The Nine Hand Seals (Factions in Action Vol. 2, Arashikage Apprentice Origin Perk, p.10)", () => {
  const NINE_HAND_SEALS_ID = "Compendium.essence20.intercontinental_adventures.Item.2qjDEWrhBYFjkYDs";

  beforeEach(() => {
    game.combat = null;
  });

  test("canUsePerk is true with no cost, as long as it hasn't been used this combat", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: NINE_HAND_SEALS_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("canUsePerk is false once already used this combat", () => {
    game.combat = { id: 'combat1' };
    const actor = makeActor();
    actor.getFlag = jest.fn((scope, key) => (
      key == 'nineHandSealsUsedThisEncounter' ? { combatId: 'combat1' } : undefined
    ));
    const item = makePerkItem({ sourceId: NINE_HAND_SEALS_ID, actor });
    expect(canUsePerk(item)).toBe(false);
  });

  test("banks an Edge on the actor and marks the combat used", async () => {
    game.combat = { id: 'combat1' };
    const actor = makeActor();
    const item = makePerkItem({ sourceId: NINE_HAND_SEALS_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingNineHandSeals', expect.objectContaining({ edge: true }),
    );
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'nineHandSealsUsedThisEncounter', { combatId: 'combat1' },
    );
  });
});

describe("Stand Behind Me! (Across the Stars, Gold Ranger, 7th level, p.53)", () => {
  const STAND_BEHIND_ME_ID = "Compendium.essence20.across_the_stars.Item.PcezfGdjUtNUZHYH";

  function makeStandBehindMeActor({ id, name, power = 1 } = {}) {
    return {
      ...makeActor({ id, name }),
      system: { powers: { personal: { value: power } } },
      update: jest.fn(),
    };
  }

  beforeEach(() => {
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
  });

  afterEach(() => {
    game.combat = null;
  });

  describe("canUsePerk", () => {
    test("true when the actor can afford 1 Personal Power", () => {
      const actor = makeStandBehindMeActor({ power: 1 });
      const item = makePerkItem({ sourceId: STAND_BEHIND_ME_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false when the actor can't afford it", () => {
      const actor = makeStandBehindMeActor({ power: 0 });
      const item = makePerkItem({ sourceId: STAND_BEHIND_ME_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("spends 1 Power and marks the round-scoped taunting flag", async () => {
    game.combat = { id: 'combat1', round: 2 };
    const actor = makeStandBehindMeActor({ id: 'ranger', name: 'Trey', power: 1 });
    const item = makePerkItem({ sourceId: STAND_BEHIND_ME_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'standBehindMeActive', { combatId: 'combat1', round: 2 });
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("still works outside of combat, with a null combatId/round", async () => {
    game.combat = null;
    const actor = makeStandBehindMeActor({ id: 'ranger', power: 1 });
    const item = makePerkItem({ sourceId: STAND_BEHIND_ME_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'standBehindMeActive', { combatId: null, round: null });
  });

  test("warns and does nothing when the actor can't afford it", async () => {
    const actor = makeStandBehindMeActor({ id: 'ranger', power: 0 });
    const item = makePerkItem({ sourceId: STAND_BEHIND_ME_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe("Whirlwind Strike (PR CRB, Yellow Ranger, 9th level, p.57)", () => {
  const WHIRLWIND_STRIKE_ID = "Compendium.essence20.pr_crb.Item.SV8nqua9koRB3lvm";

  function makeWhirlwindStrikeActor({ id, power = 1, isMorphed = true } = {}) {
    return {
      ...makeActor({ id }),
      system: { powers: { personal: { value: power } }, isMorphed },
      update: jest.fn(),
    };
  }

  beforeEach(() => {
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
    canvas.tokens.setTargets.mockReset();
    canvas.tokens.placeables = [];
  });

  describe("canUsePerk", () => {
    test("true while Morphed and able to afford it", () => {
      const actor = makeWhirlwindStrikeActor({ power: 1, isMorphed: true });
      const item = makePerkItem({ sourceId: WHIRLWIND_STRIKE_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false without enough Power, or not Morphed", () => {
      expect(canUsePerk(makePerkItem({
        sourceId: WHIRLWIND_STRIKE_ID, actor: makeWhirlwindStrikeActor({ power: 0, isMorphed: true }),
      }))).toBe(false);
      expect(canUsePerk(makePerkItem({
        sourceId: WHIRLWIND_STRIKE_ID, actor: makeWhirlwindStrikeActor({ power: 1, isMorphed: false }),
      }))).toBe(false);
    });
  });

  test("spends 1 Power and auto-targets nearby enemies", async () => {
    const selfToken = { id: 'self', actor: {}, document: { disposition: 1 }, center: {} };
    const enemyToken = { id: 'e1', actor: { id: 'enemy1' }, document: { disposition: -1 }, center: {} };
    canvas.tokens.placeables = [selfToken, enemyToken];
    const actor = makeWhirlwindStrikeActor({ id: 'ranger', power: 1 });
    actor.getActiveTokens = jest.fn(() => [selfToken]);
    const item = makePerkItem({ sourceId: WHIRLWIND_STRIKE_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(canvas.tokens.setTargets).toHaveBeenCalledWith(['e1']);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("warns and does nothing when the actor can't afford it or isn't Morphed", async () => {
    const actor = makeWhirlwindStrikeActor({ id: 'ranger', power: 0 });
    const item = makePerkItem({ sourceId: WHIRLWIND_STRIKE_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
    expect(canvas.tokens.setTargets).not.toHaveBeenCalled();
  });
});

describe("Lightning Fast (PR CRB, Yellow Ranger, 13th level, p.57)", () => {
  const LIGHTNING_FAST_ID = "Compendium.essence20.pr_crb.Item.Aws6Y5RODeyDhOxD";

  function makeLightningFastActor({ id, power = 1, isMorphed = true } = {}) {
    return {
      ...makeActor({ id }),
      system: { powers: { personal: { value: power } }, isMorphed },
      update: jest.fn(),
    };
  }

  beforeEach(() => {
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
  });

  describe("canUsePerk", () => {
    test("true while Morphed and able to afford it", () => {
      const actor = makeLightningFastActor({ power: 1, isMorphed: true });
      const item = makePerkItem({ sourceId: LIGHTNING_FAST_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false without enough Power, or not Morphed", () => {
      expect(canUsePerk(makePerkItem({
        sourceId: LIGHTNING_FAST_ID, actor: makeLightningFastActor({ power: 0, isMorphed: true }),
      }))).toBe(false);
      expect(canUsePerk(makePerkItem({
        sourceId: LIGHTNING_FAST_ID, actor: makeLightningFastActor({ power: 1, isMorphed: false }),
      }))).toBe(false);
    });
  });

  test("spends 1 Power and posts a notification", async () => {
    const actor = makeLightningFastActor({ id: 'ranger', power: 1 });
    const item = makePerkItem({ sourceId: LIGHTNING_FAST_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("warns and does nothing when the actor can't afford it or isn't Morphed", async () => {
    const actor = makeLightningFastActor({ id: 'ranger', power: 0 });
    const item = makePerkItem({ sourceId: LIGHTNING_FAST_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });
});

describe("Whatever We Need (PR CRB, Black Ranger, 2nd level, p.33)", () => {
  const WHATEVER_WE_NEED_ID = "Compendium.essence20.pr_crb.Item.1DphEJt2hPswKDzI";

  function makeQuipsActor({ id = 'leader', quipsValue = 2 } = {}) {
    const rolePointsItem = { system: { resource: { value: quipsValue } }, update: jest.fn() };
    return {
      ...makeActor({ id }),
      _getBaseRolePoints: jest.fn(() => rolePointsItem),
    };
  }

  beforeEach(() => {
    game.user.targets = new Set();
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
  });

  describe("canUsePerk", () => {
    test("true with at least 1 Quips & Speeches remaining", () => {
      const actor = makeQuipsActor({ quipsValue: 1 });
      const item = makePerkItem({ sourceId: WHATEVER_WE_NEED_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false with 0 Quips & Speeches remaining", () => {
      const actor = makeQuipsActor({ quipsValue: 0 });
      const item = makePerkItem({ sourceId: WHATEVER_WE_NEED_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("marks the currently-targeted actor and spends a Quips & Speeches point", async () => {
    const actor = makeQuipsActor({ quipsValue: 2 });
    const target = { id: 'npc1' };
    game.user.targets = { first: () => ({ actor: target }) };
    const item = makePerkItem({ sourceId: WHATEVER_WE_NEED_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'pendingWhateverWeNeedEdge', 'npc1');
    expect(actor._getBaseRolePoints().update).toHaveBeenCalledWith({ 'system.resource.value': 1 });
  });

  test("warns and does nothing when there are no Quips & Speeches left", async () => {
    const actor = makeQuipsActor({ quipsValue: 0 });
    const target = { id: 'npc1' };
    game.user.targets = { first: () => ({ actor: target }) };
    const item = makePerkItem({ sourceId: WHATEVER_WE_NEED_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe("You Got This! (PR CRB, Black Ranger, 2nd/7th/12th/17th level, p.33)", () => {
  const YOU_GOT_THIS_ID = "Compendium.essence20.pr_crb.Item.FDQFMkT2fUjxVxZY";

  function makeQuipsActor({ id = 'leader', quipsValue = 2 } = {}) {
    const rolePointsItem = { system: { resource: { value: quipsValue } }, update: jest.fn() };
    return {
      ...makeActor({ id }),
      _getBaseRolePoints: jest.fn(() => rolePointsItem),
      system: { health: { value: 5, max: 10, bonus: 0 } },
      update: jest.fn(),
    };
  }

  beforeEach(() => {
    game.user.targets = new Set();
    canvas.tokens.placeables = [];
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
  });

  describe("canUsePerk", () => {
    test("true with at least 1 Quips & Speeches remaining", () => {
      const actor = makeQuipsActor({ quipsValue: 1 });
      const item = makePerkItem({ sourceId: YOU_GOT_THIS_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false with 0 Quips & Speeches remaining", () => {
      const actor = makeQuipsActor({ quipsValue: 0 });
      const item = makePerkItem({ sourceId: YOU_GOT_THIS_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("grants the already-targeted ally temporary Health per the Perk's own advances value, and spends a Quips & Speeches point", async () => {
    const actor = makeQuipsActor({ quipsValue: 2 });
    const ally = { system: { health: { value: 5, max: 10, bonus: 0 } }, update: jest.fn() };
    game.user.targets = new Set([{ actor: ally }]);
    const item = makePerkItem({ sourceId: YOU_GOT_THIS_ID, actor, currentValue: 3 });

    await onPerkUse(item);

    expect(ally.update).toHaveBeenCalledWith({ 'system.health.bonus': 3 });
    expect(actor._getBaseRolePoints().update).toHaveBeenCalledWith({ 'system.resource.value': 1 });
  });

  test("warns and does nothing when there are no Quips & Speeches left", async () => {
    const actor = makeQuipsActor({ quipsValue: 0 });
    const ally = { system: { health: { value: 5, max: 10, bonus: 0 } }, update: jest.fn() };
    game.user.targets = new Set([{ actor: ally }]);
    const item = makePerkItem({ sourceId: YOU_GOT_THIS_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(ally.update).not.toHaveBeenCalled();
  });
});

describe("Ninja Power (PR CRB, General Perk, p.97)", () => {
  const NINJA_POWER_ID = "Compendium.essence20.pr_crb.Item.wN5rjEQIJH68rWCd";

  function makeNinjaPowerActor({ power = 1, active = false } = {}) {
    const flagStore = { ninjaPowerActive: active };
    return {
      ...makeActor(),
      system: { powers: { personal: { value: power } } },
      getFlag: jest.fn((scope, key) => flagStore[key]),
      setFlag: jest.fn(async (scope, key, value) => {
        flagStore[key] = value; 
      }),
      update: jest.fn(),
    };
  }

  beforeEach(() => {
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
  });

  describe("canUsePerk", () => {
    test("true to switch on while affording it, or to switch back off regardless", () => {
      expect(canUsePerk(makePerkItem({ sourceId: NINJA_POWER_ID, actor: makeNinjaPowerActor({ power: 1 }) }))).toBe(true);
      expect(canUsePerk(makePerkItem({ sourceId: NINJA_POWER_ID, actor: makeNinjaPowerActor({ power: 0, active: true }) }))).toBe(true);
    });

    test("false to switch on without enough Power", () => {
      expect(canUsePerk(makePerkItem({ sourceId: NINJA_POWER_ID, actor: makeNinjaPowerActor({ power: 0 }) }))).toBe(false);
    });
  });

  test("switches on, spending 1 Power", async () => {
    const actor = makeNinjaPowerActor({ power: 1 });
    const item = makePerkItem({ sourceId: NINJA_POWER_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'ninjaPowerActive', true);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("switches back off for free", async () => {
    const actor = makeNinjaPowerActor({ active: true });
    const item = makePerkItem({ sourceId: NINJA_POWER_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'ninjaPowerActive', false);
  });

  test("warns and does nothing without enough Power", async () => {
    const actor = makeNinjaPowerActor({ power: 0 });
    const item = makePerkItem({ sourceId: NINJA_POWER_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe("Volley (PR CRB, Pink Ranger, 1st level, p.48)", () => {
  const VOLLEY_ID = "Compendium.essence20.pr_crb.Item.Xi2sHKmBi21c3wbu";

  function makeVolleyActor({ power = 1, active = false } = {}) {
    const flagStore = { volleyActive: active };
    return {
      ...makeActor(),
      system: { powers: { personal: { value: power } } },
      getFlag: jest.fn((scope, key) => flagStore[key]),
      setFlag: jest.fn(async (scope, key, value) => {
        flagStore[key] = value; 
      }),
      unsetFlag: jest.fn(async (scope, key) => {
        delete flagStore[key]; 
      }),
      update: jest.fn(),
    };
  }

  beforeEach(() => {
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
  });

  describe("canUsePerk", () => {
    test("true to switch on while affording it, or to switch back off regardless", () => {
      expect(canUsePerk(makePerkItem({ sourceId: VOLLEY_ID, actor: makeVolleyActor({ power: 1 }) }))).toBe(true);
      expect(canUsePerk(makePerkItem({ sourceId: VOLLEY_ID, actor: makeVolleyActor({ power: 0, active: true }) }))).toBe(true);
    });

    test("false to switch on without enough Power", () => {
      expect(canUsePerk(makePerkItem({ sourceId: VOLLEY_ID, actor: makeVolleyActor({ power: 0 }) }))).toBe(false);
    });
  });

  test("switches on, spending 1 Power", async () => {
    const actor = makeVolleyActor({ power: 1 });
    const item = makePerkItem({ sourceId: VOLLEY_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'volleyActive', true);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("switches back off for free", async () => {
    const actor = makeVolleyActor({ active: true });
    const item = makePerkItem({ sourceId: VOLLEY_ID, actor });

    await onPerkUse(item);

    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'volleyActive');
  });

  test("warns and does nothing without enough Power", async () => {
    const actor = makeVolleyActor({ power: 0 });
    const item = makePerkItem({ sourceId: VOLLEY_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe("Group Strike (PR CRB, Pink Ranger, 5th/10th/15th level, p.49)", () => {
  const GROUP_STRIKE_ID = "Compendium.essence20.pr_crb.Item.coGMtK50t3Ojeklx";

  function makeGroupStrikeActor({ power = 1 } = {}) {
    return {
      ...makeActor(),
      system: { powers: { personal: { value: power } } },
      update: jest.fn(),
    };
  }

  beforeEach(() => {
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
    canvas.tokens.setTargets.mockReset();
    canvas.tokens.placeables = [];
  });

  describe("canUsePerk", () => {
    test("true when the actor can afford 1 Personal Power", () => {
      expect(canUsePerk(makePerkItem({ sourceId: GROUP_STRIKE_ID, actor: makeGroupStrikeActor({ power: 1 }) }))).toBe(true);
    });

    test("false when the actor can't afford it", () => {
      expect(canUsePerk(makePerkItem({ sourceId: GROUP_STRIKE_ID, actor: makeGroupStrikeActor({ power: 0 }) }))).toBe(false);
    });
  });

  test("spends 1 Power and auto-targets nearby enemies within the Perk's own current area", async () => {
    const selfToken = { id: 'self', actor: {}, document: { disposition: 1 }, center: {} };
    const enemyToken = { id: 'e1', actor: { id: 'enemy1' }, document: { disposition: -1 }, center: {} };
    canvas.tokens.placeables = [selfToken, enemyToken];
    const actor = makeGroupStrikeActor({ power: 1 });
    actor.getActiveTokens = jest.fn(() => [selfToken]);
    const item = makePerkItem({ sourceId: GROUP_STRIKE_ID, actor, currentValue: 15 });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(canvas.tokens.setTargets).toHaveBeenCalledWith(['e1']);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("warns and does nothing when the actor can't afford it", async () => {
    const actor = makeGroupStrikeActor({ power: 0 });
    const item = makePerkItem({ sourceId: GROUP_STRIKE_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
    expect(canvas.tokens.setTargets).not.toHaveBeenCalled();
  });
});

describe("Power Boost (Across the Stars, Silver Ranger, 3rd/10th/17th level, p.57)", () => {
  const POWER_BOOST_ID = "Compendium.essence20.across_the_stars.Item.m3Kh8PqGf3O1oMmc";

  function makePowerBoostActor({ power = 2, active = false } = {}) {
    const flagStore = { powerBoostActive: active };
    return {
      ...makeActor(),
      system: { powers: { personal: { value: power } } },
      getFlag: jest.fn((scope, key) => flagStore[key]),
      setFlag: jest.fn(async (scope, key, value) => {
        flagStore[key] = value;
      }),
      update: jest.fn(),
    };
  }

  beforeEach(() => {
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
  });

  describe("canUsePerk", () => {
    test("true when inactive and the actor can afford 2 Power", () => {
      const actor = makePowerBoostActor({ power: 2, active: false });
      const item = makePerkItem({ sourceId: POWER_BOOST_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false when inactive and the actor can't afford it", () => {
      const actor = makePowerBoostActor({ power: 1, active: false });
      const item = makePerkItem({ sourceId: POWER_BOOST_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });

    test("true when already active, regardless of Power (switching off is free)", () => {
      const actor = makePowerBoostActor({ power: 0, active: true });
      const item = makePerkItem({ sourceId: POWER_BOOST_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });
  });

  test("activates and spends 2 Power", async () => {
    const actor = makePowerBoostActor({ power: 2, active: false });
    const item = makePerkItem({ sourceId: POWER_BOOST_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'powerBoostActive', true);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("deactivates for free", async () => {
    const actor = makePowerBoostActor({ power: 0, active: true });
    const item = makePerkItem({ sourceId: POWER_BOOST_ID, actor });

    await onPerkUse(item);

    expect(actor.update).not.toHaveBeenCalled();
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'powerBoostActive', false);
  });

  test("warns and does nothing when activation can't be afforded", async () => {
    const actor = makePowerBoostActor({ power: 0, active: false });
    const item = makePerkItem({ sourceId: POWER_BOOST_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe("Lance of Light (A Jump Through Time, General Perk, p.55)", () => {
  const LANCE_OF_LIGHT_ID = "Compendium.essence20.jump_through_time.Item.HUdL1MryICmRmWnP";

  function makeLanceOfLightActor({ power = 2, active = false } = {}) {
    const flagStore = { lanceOfLightActive: active };
    return {
      ...makeActor(),
      system: { powers: { personal: { value: power } } },
      getFlag: jest.fn((scope, key) => flagStore[key]),
      setFlag: jest.fn(async (scope, key, value) => {
        flagStore[key] = value;
      }),
      update: jest.fn(),
    };
  }

  beforeEach(() => {
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
  });

  describe("canUsePerk", () => {
    test("true when inactive and the actor can afford 2 Power", () => {
      const actor = makeLanceOfLightActor({ power: 2, active: false });
      const item = makePerkItem({ sourceId: LANCE_OF_LIGHT_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false when inactive and the actor can't afford it", () => {
      const actor = makeLanceOfLightActor({ power: 1, active: false });
      const item = makePerkItem({ sourceId: LANCE_OF_LIGHT_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });

    test("true when already active, regardless of Power (switching off is free)", () => {
      const actor = makeLanceOfLightActor({ power: 0, active: true });
      const item = makePerkItem({ sourceId: LANCE_OF_LIGHT_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });
  });

  test("activates and spends 2 Power", async () => {
    const actor = makeLanceOfLightActor({ power: 2, active: false });
    const item = makePerkItem({ sourceId: LANCE_OF_LIGHT_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'lanceOfLightActive', true);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("deactivates for free", async () => {
    const actor = makeLanceOfLightActor({ power: 0, active: true });
    const item = makePerkItem({ sourceId: LANCE_OF_LIGHT_ID, actor });

    await onPerkUse(item);

    expect(actor.update).not.toHaveBeenCalled();
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'lanceOfLightActive', false);
  });

  test("warns and does nothing when activation can't be afforded", async () => {
    const actor = makeLanceOfLightActor({ power: 0, active: false });
    const item = makePerkItem({ sourceId: LANCE_OF_LIGHT_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe("Time Traveler (A Jump Through Time, Influence Perk, p.24)", () => {
  const TIME_TRAVELER_PERK_ID = "Compendium.essence20.jump_through_time.Item.bXkXXr0VMXpoAiv0";

  function makeTimeTravelerActor({ activeSkill = null } = {}) {
    const flagStore = { timeTravelerSnagImmuneSkill: activeSkill };
    return {
      ...makeActor(),
      getFlag: jest.fn((scope, key) => flagStore[key]),
      setFlag: jest.fn(async (scope, key, value) => {
        flagStore[key] = value;
      }),
      unsetFlag: jest.fn(async (scope, key) => {
        delete flagStore[key];
      }),
    };
  }

  beforeEach(() => {
    game.users = [{ isGM: true, active: true }];
    game.settings = { get: jest.fn(() => 1) };
    game.socket.emit.mockReset();
    ui.notifications.warn.mockReset();
    global.ChatMessage.create?.mockReset();
    foundry.applications.api.DialogV2.wait.mockReset();
  });

  afterEach(() => {
    delete game.settings;
  });

  describe("canUsePerk", () => {
    test("true when inactive, a GM is connected, and a Story Point is available", () => {
      const actor = makeTimeTravelerActor();
      const item = makePerkItem({ sourceId: TIME_TRAVELER_PERK_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false with no Story Points available", () => {
      game.settings.get = jest.fn(() => 0);
      const actor = makeTimeTravelerActor();
      const item = makePerkItem({ sourceId: TIME_TRAVELER_PERK_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });

    test("false with no GM connected", () => {
      game.users = [{ isGM: false, active: true }];
      const actor = makeTimeTravelerActor();
      const item = makePerkItem({ sourceId: TIME_TRAVELER_PERK_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });

    test("true when already active, regardless of Story Points (switching off is free)", () => {
      game.settings.get = jest.fn(() => 0);
      const actor = makeTimeTravelerActor({ activeSkill: 'technology' });
      const item = makePerkItem({ sourceId: TIME_TRAVELER_PERK_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });
  });

  test("prompts for a skill, spends 1 Story Point, and activates on confirm", async () => {
    const actor = makeTimeTravelerActor();
    foundry.applications.api.DialogV2.wait.mockResolvedValue('technology');
    const item = makePerkItem({ sourceId: TIME_TRAVELER_PERK_ID, actor });

    await onPerkUse(item);

    expect(game.socket.emit).toHaveBeenCalledWith('system.essence20', expect.objectContaining({
      action: 'spendStoryPoints', amount: 1,
    }));
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'timeTravelerSnagImmuneSkill', 'technology');
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("does nothing when the picker is cancelled", async () => {
    const actor = makeTimeTravelerActor();
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const item = makePerkItem({ sourceId: TIME_TRAVELER_PERK_ID, actor });

    await onPerkUse(item);

    expect(game.socket.emit).not.toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(global.ChatMessage.create).not.toHaveBeenCalled();
  });

  test("deactivates for free, without opening the picker", async () => {
    const actor = makeTimeTravelerActor({ activeSkill: 'technology' });
    const item = makePerkItem({ sourceId: TIME_TRAVELER_PERK_ID, actor });

    await onPerkUse(item);

    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'timeTravelerSnagImmuneSkill');
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("warns and does nothing when no GM is connected", async () => {
    game.users = [{ isGM: false, active: true }];
    const actor = makeTimeTravelerActor();
    const item = makePerkItem({ sourceId: TIME_TRAVELER_PERK_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe("Monster Morph (Finster's Monster-Matic Cookbook, all 6 Psycho Paths, 3rd level)", () => {
  const MONSTER_MORPH_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.iDbMl3SS6XnyADN2";
  const PATH_CRUELTY_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.vWie8Dy4u54sf1hy";

  function makeMonsterMorphActor({ power = 3, active = false, pathId = PATH_CRUELTY_ID } = {}) {
    const flagStore = { monsterFormActive: active };
    if (active) {
      flagStore.monsterFormPreviousSize = 'common';
    }

    const items = pathId ? [{ type: 'role', flags: { core: { sourceId: pathId } } }] : [];

    return {
      ...makeActor(),
      items,
      system: { powers: { personal: { value: power } }, size: active ? 'large' : 'common', health: { bonus: active ? 2 : 0 } },
      getFlag: jest.fn((scope, key) => flagStore[key]),
      setFlag: jest.fn(async (scope, key, value) => {
        flagStore[key] = value;
      }),
      unsetFlag: jest.fn(async (scope, key) => {
        delete flagStore[key];
      }),
      update: jest.fn(),
    };
  }

  beforeEach(() => {
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
  });

  describe("canUsePerk", () => {
    test("true when inactive and the actor can afford 3 Power", () => {
      const actor = makeMonsterMorphActor({ power: 3, active: false });
      const item = makePerkItem({ sourceId: MONSTER_MORPH_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false when inactive and the actor can't afford it", () => {
      const actor = makeMonsterMorphActor({ power: 2, active: false });
      const item = makePerkItem({ sourceId: MONSTER_MORPH_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });

    test("true when already active, regardless of Power (switching off is free)", () => {
      const actor = makeMonsterMorphActor({ power: 0, active: true });
      const item = makePerkItem({ sourceId: MONSTER_MORPH_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });
  });

  test("activates, spends 3 Power, and grows to Large", async () => {
    const actor = makeMonsterMorphActor({ power: 3, active: false });
    const item = makePerkItem({ sourceId: MONSTER_MORPH_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({
      'system.powers.personal.value': 0,
      'system.size': 'large',
      'system.health.bonus': 2,
    });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'monsterFormActive', true);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("deactivates for free, restoring the original Size", async () => {
    const actor = makeMonsterMorphActor({ power: 0, active: true });
    const item = makePerkItem({ sourceId: MONSTER_MORPH_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({
      'system.size': 'common',
      'system.health.bonus': 0,
    });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'monsterFormActive', false);
  });

  test("warns and does nothing when activation can't be afforded", async () => {
    const actor = makeMonsterMorphActor({ power: 0, active: false });
    const item = makePerkItem({ sourceId: MONSTER_MORPH_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe("Psycho Assault (Finster's Monster-Matic Cookbook, all 6 Psycho Paths, 5th level)", () => {
  const PSYCHO_ASSAULT_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.yZ3rXt8z1jlCHlu7";

  function makePsychoAssaultActor({ isMorphed = true, monsterForm = false, power = 1 } = {}) {
    const flagStore = {};
    if (monsterForm) {
      flagStore.monsterFormActive = true;
    }

    return {
      ...makeActor(),
      items: [],
      system: { isMorphed, powers: { personal: { value: power } } },
      getFlag: jest.fn((scope, key) => flagStore[key]),
      setFlag: jest.fn(async (scope, key, value) => {
        flagStore[key] = value;
      }),
      update: jest.fn(),
    };
  }

  beforeEach(() => {
    game.combat = { id: 'combat1', round: 1, turn: 0 };
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
  });
  afterEach(() => {
    game.combat = null;
  });

  describe("canUsePerk", () => {
    test("true when Morphed, not in Monster Form, and affordable", () => {
      const actor = makePsychoAssaultActor({ isMorphed: true, monsterForm: false, power: 1 });
      const item = makePerkItem({ sourceId: PSYCHO_ASSAULT_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false while in Monster Form", () => {
      const actor = makePsychoAssaultActor({ isMorphed: true, monsterForm: true, power: 1 });
      const item = makePerkItem({ sourceId: PSYCHO_ASSAULT_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });

    test("false without enough Power", () => {
      const actor = makePsychoAssaultActor({ isMorphed: true, monsterForm: false, power: 0 });
      const item = makePerkItem({ sourceId: PSYCHO_ASSAULT_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("activates and spends 1 Power", async () => {
    const actor = makePsychoAssaultActor({ isMorphed: true, monsterForm: false, power: 1 });
    const item = makePerkItem({ sourceId: PSYCHO_ASSAULT_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'psychoAssaultActiveThisTurn', expect.anything());
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("warns and does nothing when it can't activate", async () => {
    const actor = makePsychoAssaultActor({ isMorphed: true, monsterForm: false, power: 0 });
    const item = makePerkItem({ sourceId: PSYCHO_ASSAULT_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });
});

describe("Distraction (Finster's Monster-Matic Cookbook, Path of Venom, 5th level)", () => {
  const DISTRACTION_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.mJu5IxoVrPjp8dVU";

  function makeVenomRangerActor({ isMorphed = true, monsterForm = false, active = false } = {}) {
    const flagStore = { distractionActive: active };
    if (monsterForm) {
      flagStore.monsterFormActive = true;
    }

    return {
      ...makeActor(),
      system: { isMorphed },
      getFlag: jest.fn((scope, key) => flagStore[key]),
      setFlag: jest.fn(async (scope, key, value) => {
        flagStore[key] = value;
      }),
    };
  }

  beforeEach(() => {
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
  });

  describe("canUsePerk", () => {
    test("true when Morphed and not in Monster Form", () => {
      const actor = makeVenomRangerActor({ isMorphed: true, monsterForm: false });
      const item = makePerkItem({ sourceId: DISTRACTION_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("true when already active, regardless of Morphed state (switching off is free)", () => {
      const actor = makeVenomRangerActor({ isMorphed: false, active: true });
      const item = makePerkItem({ sourceId: DISTRACTION_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false while in Monster Form", () => {
      const actor = makeVenomRangerActor({ isMorphed: true, monsterForm: true });
      const item = makePerkItem({ sourceId: DISTRACTION_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("activates while Morphed and not in Monster Form", async () => {
    const actor = makeVenomRangerActor({ isMorphed: true, monsterForm: false });
    const item = makePerkItem({ sourceId: DISTRACTION_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'distractionActive', true);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("warns and does nothing when it can't activate", async () => {
    const actor = makeVenomRangerActor({ isMorphed: false });
    const item = makePerkItem({ sourceId: DISTRACTION_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe("Power Bleed (Finster's Monster-Matic Cookbook, Path of Frost, 5th level)", () => {
  const POWER_BLEED_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.2nI6ckZdiIKwtRqr";

  function makeFrostRangerActor({ power = 1 } = {}) {
    return { ...makeActor(), system: { powers: { personal: { value: power } } }, update: jest.fn() };
  }

  beforeEach(() => {
    game.combat = { id: 'combat1', round: 1, turn: 0 };
    ui.notifications.warn.mockReset();
  });
  afterEach(() => {
    game.combat = null;
  });

  describe("canUsePerk", () => {
    test("true when affording 1 Power", () => {
      const actor = makeFrostRangerActor({ power: 1 });
      const item = makePerkItem({ sourceId: POWER_BLEED_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false without enough Power", () => {
      const actor = makeFrostRangerActor({ power: 0 });
      const item = makePerkItem({ sourceId: POWER_BLEED_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("spends 1 Power and stamps the current turn", async () => {
    const actor = makeFrostRangerActor({ power: 1 });
    const item = makePerkItem({ sourceId: POWER_BLEED_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'powerBleedActiveThisTurn', expect.anything());
  });

  test("warns and does nothing when unaffordable", async () => {
    const actor = makeFrostRangerActor({ power: 0 });
    const item = makePerkItem({ sourceId: POWER_BLEED_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });
});

describe("Maximize Flaws (Finster's Monster-Matic Cookbook, Path of Thorns, 7th level)", () => {
  const MAXIMIZE_FLAWS_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.jGa15CyuKXhq3IV2";

  function makeThornsActor({ power = 1 } = {}) {
    return { ...makeActor(), system: { powers: { personal: { value: power } } }, update: jest.fn() };
  }

  beforeEach(() => {
    game.combat = { id: 'combat1', round: 1, turn: 0 };
    game.user.targets = { first: jest.fn(() => undefined) };
    ui.notifications.warn.mockReset();
  });
  afterEach(() => {
    game.combat = null;
  });

  describe("canUsePerk", () => {
    test("true when affording 1 Power", () => {
      const actor = makeThornsActor({ power: 1 });
      const item = makePerkItem({ sourceId: MAXIMIZE_FLAWS_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false without enough Power", () => {
      const actor = makeThornsActor({ power: 0 });
      const item = makePerkItem({ sourceId: MAXIMIZE_FLAWS_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("spends 1 Power and banks the targeted enemy", async () => {
    game.user.targets = { first: jest.fn(() => ({ actor: { uuid: 'Actor.enemy1' } })) };
    const actor = makeThornsActor({ power: 1 });
    const item = makePerkItem({ sourceId: MAXIMIZE_FLAWS_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'maximizeFlawsTarget', expect.objectContaining({ targetUuid: 'Actor.enemy1' }));
  });

  test("warns and does nothing with no target selected", async () => {
    const actor = makeThornsActor({ power: 1 });
    const item = makePerkItem({ sourceId: MAXIMIZE_FLAWS_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });
});

describe("Growing Smolder (Finster's Monster-Matic Cookbook, Path of Flame, 13th level)", () => {
  const GROWING_SMOLDER_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.4XblFV97cS63ueDM";

  beforeEach(() => {
    game.combat = { id: 'combat1' };
    global.ChatMessage.create.mockReset();
  });
  afterEach(() => {
    game.combat = null;
  });

  test("canUsePerk is always true (no cost)", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: GROWING_SMOLDER_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("banks a stack and posts a chat card", async () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: GROWING_SMOLDER_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'growingSmolderBank', expect.objectContaining({ stacks: 1 }));
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });
});

describe("Toxic Terror (Finster's Monster-Matic Cookbook, Path of Venom, 13th level)", () => {
  const TOXIC_TERROR_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.kh7Wk5zalucm9I7p";

  function makeVenomActor({ power = 1, active = false } = {}) {
    const flagStore = { toxicTerrorActive: active };
    return {
      ...makeActor(),
      system: { powers: { personal: { value: power } } },
      getFlag: jest.fn((scope, key) => flagStore[key]),
      setFlag: jest.fn(async (scope, key, value) => {
        flagStore[key] = value;
      }),
      update: jest.fn(),
    };
  }

  beforeEach(() => {
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
  });

  describe("canUsePerk", () => {
    test("true when affording 1 Power", () => {
      const actor = makeVenomActor({ power: 1, active: false });
      const item = makePerkItem({ sourceId: TOXIC_TERROR_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("true when already active, regardless of Power", () => {
      const actor = makeVenomActor({ power: 0, active: true });
      const item = makePerkItem({ sourceId: TOXIC_TERROR_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false when inactive and unaffordable", () => {
      const actor = makeVenomActor({ power: 0, active: false });
      const item = makePerkItem({ sourceId: TOXIC_TERROR_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("activates and spends 1 Power", async () => {
    const actor = makeVenomActor({ power: 1, active: false });
    const item = makePerkItem({ sourceId: TOXIC_TERROR_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'toxicTerrorActive', true);
  });

  test("deactivates for free", async () => {
    const actor = makeVenomActor({ power: 0, active: true });
    const item = makePerkItem({ sourceId: TOXIC_TERROR_ID, actor });

    await onPerkUse(item);

    expect(actor.update).not.toHaveBeenCalled();
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'toxicTerrorActive', false);
  });
});

describe("Grow! (Finster's Monster-Matic Cookbook, all 6 Psycho Paths, 10th level)", () => {
  const GROW_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.ZqE7kDEMylFQK6Oa";

  function makeGrowActor({ monsterFormActive = true, growActive = false, size = 'large' } = {}) {
    const flagStore = { monsterFormActive };
    if (growActive) {
      flagStore.monsterGrowSelfActive = true;
      flagStore.monsterGrowSelfPreviousSize = 'large';
    }

    return {
      ...makeActor(),
      items: [],
      system: { powers: { personal: { value: 0 } }, size, health: { bonus: 0 } },
      getFlag: jest.fn((scope, key) => flagStore[key]),
      setFlag: jest.fn(async (scope, key, value) => {
        flagStore[key] = value;
      }),
      unsetFlag: jest.fn(async (scope, key) => {
        delete flagStore[key];
      }),
      update: jest.fn(),
    };
  }

  beforeEach(() => {
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
  });

  describe("canUsePerk", () => {
    test("true while in Monster Form", () => {
      const actor = makeGrowActor({ monsterFormActive: true });
      const item = makePerkItem({ sourceId: GROW_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false outside Monster Form", () => {
      const actor = makeGrowActor({ monsterFormActive: false });
      const item = makePerkItem({ sourceId: GROW_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("activates and grows to Towering, at no Power cost", async () => {
    const actor = makeGrowActor({ monsterFormActive: true, growActive: false });
    const item = makePerkItem({ sourceId: GROW_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.size': 'towering' });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'monsterGrowSelfActive', true);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("warns and does nothing outside Monster Form", async () => {
    const actor = makeGrowActor({ monsterFormActive: false });
    const item = makePerkItem({ sourceId: GROW_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });
});

describe("Grid Surge (Across the Stars, Silver Ranger, 2nd level, p.57)", () => {
  const GRID_SURGE_ID = "Compendium.essence20.across_the_stars.Item.PEDHPJkoGvvJed5u";

  function makeGridSurgeActor({ resourceValue = 1 } = {}) {
    return {
      ...makeActor(),
      _getBaseRolePoints: jest.fn(() => ({
        system: { resource: { value: resourceValue } },
        update: jest.fn(),
      })),
    };
  }

  beforeEach(() => {
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
    foundry.applications.api.DialogV2.wait.mockReset();
  });

  describe("canUsePerk", () => {
    test("true when a Grid Surge use remains", () => {
      const actor = makeGridSurgeActor({ resourceValue: 1 });
      const item = makePerkItem({ sourceId: GRID_SURGE_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false with no uses left", () => {
      const actor = makeGridSurgeActor({ resourceValue: 0 });
      const item = makePerkItem({ sourceId: GRID_SURGE_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("spends a use and banks the chosen option", async () => {
    const actor = makeGridSurgeActor({ resourceValue: 2 });
    const rolePoints = actor._getBaseRolePoints();
    actor._getBaseRolePoints = jest.fn(() => rolePoints);
    foundry.applications.api.DialogV2.wait.mockResolvedValue({ option: 'construct', skill: 'alertness' });
    const item = makePerkItem({ sourceId: GRID_SURGE_ID, actor });

    await onPerkUse(item);

    expect(rolePoints.update).toHaveBeenCalledWith({ 'system.resource.value': 1 });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingGridSurgeConstruct', expect.objectContaining({ skill: 'alertness' }),
    );
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("spends nothing and bank nothing if the picker is cancelled", async () => {
    const actor = makeGridSurgeActor({ resourceValue: 2 });
    const rolePoints = actor._getBaseRolePoints();
    actor._getBaseRolePoints = jest.fn(() => rolePoints);
    foundry.applications.api.DialogV2.wait.mockResolvedValue(null);
    const item = makePerkItem({ sourceId: GRID_SURGE_ID, actor });

    await onPerkUse(item);

    expect(rolePoints.update).not.toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("warns and does nothing with no uses left", async () => {
    const actor = makeGridSurgeActor({ resourceValue: 0 });
    const item = makePerkItem({ sourceId: GRID_SURGE_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });
});

describe("Power Adaptation (Across the Stars, Silver Ranger, 9th/18th level, p.57)", () => {
  const POWER_ADAPTATION_ID = "Compendium.essence20.across_the_stars.Item.S7Qs6bJOVkVFxlFu";

  function makePowerAdaptationActor({ power = 2, active = {} } = {}) {
    const flagStore = { powerAdaptationActive: active };
    return {
      ...makeActor(),
      system: { powers: { personal: { value: power } } },
      getFlag: jest.fn((scope, key) => flagStore[key]),
      setFlag: jest.fn(async (scope, key, value) => {
        flagStore[key] = value;
      }),
      update: jest.fn(),
    };
  }

  function makeItem({ actor, choice = 'boostOfSpeed' }) {
    return { ...makePerkItem({ sourceId: POWER_ADAPTATION_ID, actor }), system: { choice } };
  }

  beforeEach(() => {
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
  });

  describe("canUsePerk", () => {
    test("true for a 1-Power option when affordable", () => {
      const actor = makePowerAdaptationActor({ power: 1 });
      expect(canUsePerk(makeItem({ actor, choice: 'boostOfSpeed' }))).toBe(true);
    });

    test("false for a 2-Power option when only 1 Power remains", () => {
      const actor = makePowerAdaptationActor({ power: 1 });
      expect(canUsePerk(makeItem({ actor, choice: 'fastTrigger' }))).toBe(false);
    });

    test("true when already active, regardless of Power (switching off is free)", () => {
      const actor = makePowerAdaptationActor({ power: 0, active: { boostOfSpeed: true } });
      expect(canUsePerk(makeItem({ actor, choice: 'boostOfSpeed' }))).toBe(true);
    });

    test("false with no choice recorded yet", () => {
      const actor = makePowerAdaptationActor({ power: 2 });
      expect(canUsePerk(makeItem({ actor, choice: null }))).toBe(false);
    });
  });

  test("activates the Perk's own chosen option and spends its Power cost", async () => {
    const actor = makePowerAdaptationActor({ power: 1 });
    const item = makeItem({ actor, choice: 'strikingHands' });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'powerAdaptationActive', expect.objectContaining({ strikingHands: true }),
    );
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("deactivates for free", async () => {
    const actor = makePowerAdaptationActor({ power: 0, active: { boostOfSpeed: true } });
    const item = makeItem({ actor, choice: 'boostOfSpeed' });

    await onPerkUse(item);

    expect(actor.update).not.toHaveBeenCalled();
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'powerAdaptationActive', expect.objectContaining({ boostOfSpeed: false }),
    );
  });

  test("warns and does nothing when activation can't be afforded", async () => {
    const actor = makePowerAdaptationActor({ power: 0 });
    const item = makeItem({ actor, choice: 'boostOfSpeed' });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("does nothing with no choice recorded yet", async () => {
    const actor = makePowerAdaptationActor({ power: 2 });
    const item = makeItem({ actor, choice: null });

    await onPerkUse(item);

    expect(actor.update).not.toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe("Phantom Suite (Across the Stars, Phantom Ranger, 1st/7th/12th/17th level, p.60)", () => {
  const PHANTOM_SUITE_ID = "Compendium.essence20.across_the_stars.Item.fQgxo5c7tNOD2Q5K";

  function makePhantomSuiteActor({ power = 1, active = false } = {}) {
    const flagStore = { phantomSuiteActive: active };
    return {
      ...makeActor(),
      system: { powers: { personal: { value: power } } },
      getFlag: jest.fn((scope, key) => flagStore[key]),
      setFlag: jest.fn(async (scope, key, value) => {
        flagStore[key] = value;
      }),
      update: jest.fn(),
    };
  }

  beforeEach(() => {
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
  });

  describe("canUsePerk", () => {
    test("true when inactive and the actor can afford 1 Power", () => {
      const actor = makePhantomSuiteActor({ power: 1, active: false });
      const item = makePerkItem({ sourceId: PHANTOM_SUITE_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false when inactive and unaffordable", () => {
      const actor = makePhantomSuiteActor({ power: 0, active: false });
      const item = makePerkItem({ sourceId: PHANTOM_SUITE_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });

    test("true when already active, regardless of Power", () => {
      const actor = makePhantomSuiteActor({ power: 0, active: true });
      const item = makePerkItem({ sourceId: PHANTOM_SUITE_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });
  });

  test("activates and spends 1 Power", async () => {
    const actor = makePhantomSuiteActor({ power: 1, active: false });
    const item = makePerkItem({ sourceId: PHANTOM_SUITE_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'phantomSuiteActive', true);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("deactivates for free", async () => {
    const actor = makePhantomSuiteActor({ power: 0, active: true });
    const item = makePerkItem({ sourceId: PHANTOM_SUITE_ID, actor });

    await onPerkUse(item);

    expect(actor.update).not.toHaveBeenCalled();
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'phantomSuiteActive', false);
  });

  test("warns and does nothing when activation can't be afforded", async () => {
    const actor = makePhantomSuiteActor({ power: 0, active: false });
    const item = makePerkItem({ sourceId: PHANTOM_SUITE_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe("Phantom Focus - Healing Light (Across the Stars, Phantom Ranger, 10th/15th level, p.62)", () => {
  const PHANTOM_FOCUS_ID = "Compendium.essence20.across_the_stars.Item.aXGMEoVsYSttOSHn";

  class FakeRoll {
    constructor() {
      this._total = FakeRoll.nextTotal ?? 3;
    }
    async evaluate() {
      return this;
    }
    get total() {
      return this._total;
    }
  }

  let originalRoll;
  beforeAll(() => {
    originalRoll = global.Roll;
    global.Roll = FakeRoll;
  });
  afterAll(() => {
    global.Roll = originalRoll;
  });

  function makeHealingLightActor({ power = 1, health = 5, choice = 'healingLight' } = {}) {
    return {
      ...makeActor(),
      system: { powers: { personal: { value: power } }, health: { value: health, max: 10 } },
      update: jest.fn(),
      getRollData: jest.fn(() => ({})),
      __choice: choice,
    };
  }

  function makeItem({ actor, choice }) {
    return { ...makePerkItem({ sourceId: PHANTOM_FOCUS_ID, actor }), system: { choice } };
  }

  beforeEach(() => {
    game.user.targets = new Set();
    FakeRoll.nextTotal = 3;
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
  });

  describe("canUsePerk", () => {
    test("true when this instance's choice is healingLight and both costs are affordable", () => {
      const actor = makeHealingLightActor({ power: 1, health: 5 });
      expect(canUsePerk(makeItem({ actor, choice: 'healingLight' }))).toBe(true);
    });

    test("false for any other choice (nothing to click)", () => {
      const actor = makeHealingLightActor({ power: 1, health: 5 });
      expect(canUsePerk(makeItem({ actor, choice: 'boostedVigor' }))).toBe(false);
      expect(canUsePerk(makeItem({ actor, choice: 'phaseDefense' }))).toBe(false);
    });

    test("false without enough Power or Health", () => {
      expect(canUsePerk(makeItem({ actor: makeHealingLightActor({ power: 0, health: 5 }), choice: 'healingLight' }))).toBe(false);
      expect(canUsePerk(makeItem({ actor: makeHealingLightActor({ power: 1, health: 0 }), choice: 'healingLight' }))).toBe(false);
    });
  });

  test("rolls 2d2, heals the chosen ally, and spends both Power and Health", async () => {
    const actor = makeHealingLightActor({ power: 1, health: 5 });
    const ally = { ...makeActor({ id: 'ally1', name: 'Ally' }), system: { health: { value: 4, max: 10 } }, update: jest.fn() };
    game.user.targets = new Set([{ actor: ally }]);
    FakeRoll.nextTotal = 3;
    const item = makeItem({ actor, choice: 'healingLight' });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 4 });
    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(ally.update).toHaveBeenCalledWith({ 'system.health.value': 7 });
  });

  test("does nothing for any other choice", async () => {
    const actor = makeHealingLightActor();
    const item = makeItem({ actor, choice: 'boostedVigor' });

    await onPerkUse(item);

    expect(actor.update).not.toHaveBeenCalled();
  });
});

describe("Through the Arches (Across the Stars, Phantom Ranger, 18th level, p.63)", () => {
  const THROUGH_THE_ARCHES_ID = "Compendium.essence20.across_the_stars.Item.f372LpDqqiO2XoEi";

  function makeThroughTheArchesActor({ power = 2 } = {}) {
    return {
      ...makeActor(),
      system: { powers: { personal: { value: power } } },
      update: jest.fn(),
    };
  }

  beforeEach(() => {
    game.user.targets = new Set();
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
  });

  describe("canUsePerk", () => {
    test("true when the actor can afford 2 Power", () => {
      const actor = makeThroughTheArchesActor({ power: 2 });
      const item = makePerkItem({ sourceId: THROUGH_THE_ARCHES_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false when unaffordable", () => {
      const actor = makeThroughTheArchesActor({ power: 1 });
      const item = makePerkItem({ sourceId: THROUGH_THE_ARCHES_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("spends 2 Power and marks targeted companions", async () => {
    const actor = makeThroughTheArchesActor({ power: 2 });
    const companion = {
      id: 'c1', items: [], getFlag: jest.fn(() => undefined), setFlag: jest.fn(),
    };
    game.user.targets = new Set([{ actor: companion }]);
    const item = makePerkItem({ sourceId: THROUGH_THE_ARCHES_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(companion.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingThroughTheArchesSnag', expect.objectContaining({ snag: true }),
    );
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("warns and does nothing when unaffordable", async () => {
    const actor = makeThroughTheArchesActor({ power: 0 });
    const item = makePerkItem({ sourceId: THROUGH_THE_ARCHES_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });
});

describe("Menacing Laugh (Beneath the Helmet, Dark Ranger, 7th level, p.40)", () => {
  const MENACING_LAUGH_ID = "Compendium.essence20.beneath_the_helmet.Item.RzQ4LahiaHPl6ZzU";
  const TERROR_ID = "Compendium.essence20.beneath_the_helmet.Item.yBBB0Mi6fr84YcSd";

  function makeDarkRangerActor({ power = 1, terror = 1 } = {}) {
    const rolePoints = { system: { resource: { value: terror, max: 3 } }, update: jest.fn() };
    return {
      ...makeActor(),
      items: [{ type: 'perk', flags: { core: { sourceId: TERROR_ID } } }],
      system: { powers: { personal: { value: power } } },
      update: jest.fn(),
      _getBaseRolePoints: jest.fn(() => rolePoints),
      __rolePoints: rolePoints,
      getFlag: jest.fn(() => undefined),
    };
  }

  beforeEach(() => {
    game.combat = null;
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
  });

  describe("canUsePerk", () => {
    test("true with Terror available and not yet used this turn", () => {
      const actor = makeDarkRangerActor({ terror: 1 });
      const item = makePerkItem({ sourceId: MENACING_LAUGH_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false with no Terror to spend", () => {
      const actor = makeDarkRangerActor({ terror: 0 });
      const item = makePerkItem({ sourceId: MENACING_LAUGH_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("spends 1 Terror and gains 1 Power", async () => {
    const actor = makeDarkRangerActor({ power: 1, terror: 2 });
    const item = makePerkItem({ sourceId: MENACING_LAUGH_ID, actor });

    await onPerkUse(item);

    expect(actor.__rolePoints.update).toHaveBeenCalledWith({ 'system.resource.value': 1 });
    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 2 });
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("warns and does nothing without Terror to spend", async () => {
    const actor = makeDarkRangerActor({ terror: 0 });
    const item = makePerkItem({ sourceId: MENACING_LAUGH_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });
});

describe("Rush the Line (Factions in Action Vol. 2, Renegade Focus, p.68)", () => {
  const RUSH_THE_LINE_ID = "Compendium.essence20.intercontinental_adventures.Item.va1HF5CudO4WsguB";

  beforeEach(() => {
    game.users = [{ isGM: true, active: true }];
    game.settings = { get: jest.fn(() => 1) };
    game.socket.emit.mockReset();
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
  });

  afterEach(() => {
    delete game.settings;
  });

  describe("canUsePerk", () => {
    test("true with a GM connected, a Story Point available, and not yet used this turn", () => {
      const actor = makeActor();
      const item = makePerkItem({ sourceId: RUSH_THE_LINE_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false with no Story Points, no GM, or already used this turn", () => {
      const actor = makeActor();
      const item = makePerkItem({ sourceId: RUSH_THE_LINE_ID, actor });

      game.settings.get = jest.fn(() => 0);
      expect(canUsePerk(item)).toBe(false);

      game.settings.get = jest.fn(() => 1);
      game.users = [{ isGM: false, active: true }];
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("spends 1 Story Point, marks the turn used, and activates the Movement double/Edge bank", async () => {
    const actor = makeActor({ id: 'renegade1', name: 'Zarana' });
    const item = makePerkItem({ sourceId: RUSH_THE_LINE_ID, actor });

    await onPerkUse(item);

    expect(game.socket.emit).toHaveBeenCalledWith('system.essence20', {
      action: 'spendStoryPoints', amount: 1, actorName: 'Zarana',
    });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'rushTheLineActive', true);
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingRushTheLineEdge', expect.objectContaining({ edge: true }),
    );
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("warns and does nothing without a Story Point to spend", async () => {
    game.settings.get = jest.fn(() => 0);
    const actor = makeActor();
    const item = makePerkItem({ sourceId: RUSH_THE_LINE_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(game.socket.emit).not.toHaveBeenCalled();
  });
});

describe("Absolute Menace (Beneath the Helmet, Dark Ranger, 18th level, p.40)", () => {
  const ABSOLUTE_MENACE_ID = "Compendium.essence20.beneath_the_helmet.Item.YsoS30FKigTm19CH";

  function makeDarkRangerActor({ power = 2 } = {}) {
    return {
      ...makeActor(),
      system: { powers: { personal: { value: power } } },
      update: jest.fn(),
      getActiveTokens: jest.fn(() => []),
      _dice: { rollSkill: jest.fn() },
    };
  }

  beforeEach(() => {
    game.combat = null;
    ui.notifications.warn.mockReset();
  });

  describe("canUsePerk", () => {
    test("true when affording 2 Power and not yet used this turn", () => {
      const actor = makeDarkRangerActor({ power: 2 });
      const item = makePerkItem({ sourceId: ABSOLUTE_MENACE_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false when unaffordable", () => {
      const actor = makeDarkRangerActor({ power: 1 });
      const item = makePerkItem({ sourceId: ABSOLUTE_MENACE_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("spends 2 Power and triggers the roll", async () => {
    const actor = makeDarkRangerActor({ power: 2 });
    const item = makePerkItem({ sourceId: ABSOLUTE_MENACE_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(actor._dice.rollSkill).toHaveBeenCalled();
  });

  test("warns and does nothing when unaffordable", async () => {
    const actor = makeDarkRangerActor({ power: 0 });
    const item = makePerkItem({ sourceId: ABSOLUTE_MENACE_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("Frightening Display (Enigma of Combination, Cannoneer Focus, 10th level, p.32)", () => {
  const FRIGHTENING_DISPLAY_ID = "Compendium.essence20.enigma_of_combination.Item.8NJtMXvcK3YDnwY4";

  function makeCannoneerActor() {
    return {
      ...makeActor(),
      getActiveTokens: jest.fn(() => []),
      _dice: { rollSkill: jest.fn() },
    };
  }

  test("canUsePerk is always true - no cost/gate, just the Standard action", () => {
    const actor = makeCannoneerActor();
    const item = makePerkItem({ sourceId: FRIGHTENING_DISPLAY_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("triggers the AoE Intimidation-vs-Willpower roll", async () => {
    const actor = makeCannoneerActor();
    const item = makePerkItem({ sourceId: FRIGHTENING_DISPLAY_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'intimidation', essence: 'social', defenseType: 'willpower', isFrighteningDisplay: true }),
      actor,
    );
  });
});

describe("Fight Me! (Beneath the Helmet, Graphite Ranger, 2nd level, p.46)", () => {
  const FIGHT_ME_ID = "Compendium.essence20.beneath_the_helmet.Item.7ovAtv0r6UaAsmHE";

  function makeTargetsSet(targetActor) {
    const token = { actor: targetActor };
    const set = new Set(targetActor ? [token] : []);
    set.first = () => (targetActor ? token : undefined);
    return set;
  }

  beforeEach(() => {
    game.user.targets = new Set();
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
  });

  test("canUsePerk is always true", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: FIGHT_ME_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("marks the currently-targeted Threat with this actor's own id", async () => {
    const actor = makeActor({ id: 'ranger1' });
    const targetActor = { setFlag: jest.fn() };
    game.user.targets = makeTargetsSet(targetActor);
    const item = makePerkItem({ sourceId: FIGHT_ME_ID, actor });

    await onPerkUse(item);

    expect(targetActor.setFlag).toHaveBeenCalledWith('essence20', 'fightMeMarkedBy', 'ranger1');
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("does nothing with no target selected", async () => {
    const actor = makeActor({ id: 'ranger1' });
    game.user.targets = makeTargetsSet(null);
    const item = makePerkItem({ sourceId: FIGHT_ME_ID, actor });

    await onPerkUse(item);

    expect(global.ChatMessage.create).not.toHaveBeenCalled();
  });
});

describe("Duty Of The Graphite (Beneath the Helmet, Graphite Ranger, 7th level, p.47)", () => {
  const DUTY_OF_THE_GRAPHITE_ID = "Compendium.essence20.beneath_the_helmet.Item.Rr7ucZahtHI9yXwA";

  function makeGraphiteRangerActor({ power = 2, gridSurges = 1 } = {}) {
    const rolePoints = { system: { resource: { value: gridSurges } }, update: jest.fn() };
    return {
      ...makeActor(),
      system: { powers: { personal: { value: power } } },
      update: jest.fn(),
      _getBaseRolePoints: jest.fn(() => rolePoints),
      __rolePoints: rolePoints,
      _dice: { rollSkill: jest.fn() },
    };
  }

  beforeEach(() => {
    ui.notifications.warn.mockReset();
  });

  describe("canUsePerk", () => {
    test("true when affording both a Grid Surge and 2 Power", () => {
      const actor = makeGraphiteRangerActor({ power: 2, gridSurges: 1 });
      const item = makePerkItem({ sourceId: DUTY_OF_THE_GRAPHITE_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false with no Grid Surges left", () => {
      const actor = makeGraphiteRangerActor({ power: 2, gridSurges: 0 });
      const item = makePerkItem({ sourceId: DUTY_OF_THE_GRAPHITE_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });

    test("false without enough Power", () => {
      const actor = makeGraphiteRangerActor({ power: 1, gridSurges: 1 });
      const item = makePerkItem({ sourceId: DUTY_OF_THE_GRAPHITE_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("spends 1 Grid Surge and 2 Power, then triggers the roll", async () => {
    const actor = makeGraphiteRangerActor({ power: 2, gridSurges: 1 });
    const item = makePerkItem({ sourceId: DUTY_OF_THE_GRAPHITE_ID, actor });

    await onPerkUse(item);

    expect(actor.__rolePoints.update).toHaveBeenCalledWith({ 'system.resource.value': 0 });
    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(actor._dice.rollSkill).toHaveBeenCalled();
  });

  test("warns and does nothing when unaffordable", async () => {
    const actor = makeGraphiteRangerActor({ power: 0, gridSurges: 1 });
    const item = makePerkItem({ sourceId: DUTY_OF_THE_GRAPHITE_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("Extra Rough Training (Sgt Slaughter Sourcebook, Drill Instructor Focus, Officer, 3rd level, p.10)", () => {
  const EXTRA_ROUGH_TRAINING_ID = "Compendium.essence20.sgt_slaughter_sourcebook.Item.pqrUN5jaAbWJmgLf";

  let originalTargets;
  beforeEach(() => {
    ui.notifications.warn.mockReset();
    foundry.applications.api.DialogV2.wait.mockReset();
    game.combat = null;
    originalTargets = game.user.targets;
  });
  afterEach(() => {
    game.user.targets = originalTargets;
  });

  function setTarget(actor) {
    const token = { actor };
    const targetsSet = new Set([token]);
    targetsSet.first = () => token;
    game.user.targets = targetsSet;
  }

  describe("canUsePerk", () => {
    test("true outside of combat", () => {
      const actor = makeActor();
      const item = makePerkItem({ sourceId: EXTRA_ROUGH_TRAINING_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false during combat", () => {
      game.combat = { id: 'combat1' };
      const actor = makeActor();
      const item = makePerkItem({ sourceId: EXTRA_ROUGH_TRAINING_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("triggers the targeted ally's own roll", async () => {
    const officer = makeActor();
    const ally = { ...makeActor(), _dice: { rollSkill: jest.fn() } };
    setTarget(ally);
    foundry.applications.api.DialogV2.wait.mockResolvedValue('might');
    const item = makePerkItem({ sourceId: EXTRA_ROUGH_TRAINING_ID, actor: officer });

    await onPerkUse(item);

    expect(ally._dice.rollSkill).toHaveBeenCalled();
  });

  test("warns when there's no valid ally to target", async () => {
    const officer = makeActor();
    game.user.targets = new Set();
    game.user.targets.first = () => undefined;
    const item = makePerkItem({ sourceId: EXTRA_ROUGH_TRAINING_ID, actor: officer });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
  });
});

describe("Hup! Hup! Hup! Hup! Hup! (Sgt Slaughter Sourcebook, Drill Instructor Focus, Officer, 6th level, p.10)", () => {
  const HUP_HUP_HUP_HUP_HUP_ID = "Compendium.essence20.sgt_slaughter_sourcebook.Item.xsIHUoZaFoadsmma";

  test("always true - no cost or gate beyond the Standard action itself", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: HUP_HUP_HUP_HUP_HUP_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("triggers the roll", async () => {
    const actor = { ...makeActor(), _dice: { rollSkill: jest.fn() } };
    const item = makePerkItem({ sourceId: HUP_HUP_HUP_HUP_HUP_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).toHaveBeenCalled();
  });
});

describe("Humanitarian (PR CRB, General Perk, p.96)", () => {
  const HUMANITARIAN_ID = "Compendium.essence20.pr_crb.Item.hxWJxlMLbkBbx73w";

  test("always true - no cost or gate beyond the DIF 12 roll itself", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: HUMANITARIAN_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("triggers the roll", async () => {
    const actor = { ...makeActor(), _dice: { rollSkill: jest.fn() } };
    const item = makePerkItem({ sourceId: HUMANITARIAN_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'survival', essence: 'smarts', dif: '12', isHumanitarianAttempt: true }),
      actor,
    );
  });
});

describe("Menace (Cobra Codex, Bully Origin benefit, p.41)", () => {
  const MENACE_ID = "Compendium.essence20.cobra_codex.Item.t0QDESiNz7GEDYHL";

  function makeBullyActor({ usedThisScene = false } = {}) {
    return {
      ...makeActor(),
      system: { originSkillsIncrease: 'brawn' },
      getFlag: jest.fn(() => (usedThisScene ? { sceneId: null, count: 1 } : undefined)),
      _dice: { rollSkill: jest.fn() },
    };
  }

  describe("canUsePerk", () => {
    test("true when not yet used this scene", () => {
      const actor = makeBullyActor();
      const item = makePerkItem({ sourceId: MENACE_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false once already used this scene", () => {
      const actor = makeBullyActor({ usedThisScene: true });
      const item = makePerkItem({ sourceId: MENACE_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("triggers the roll", async () => {
    const actor = makeBullyActor();
    const item = makePerkItem({ sourceId: MENACE_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).toHaveBeenCalled();
  });
});

describe("Distracting Offer (Cobra Codex, Corrupt Origin benefit, p.42)", () => {
  const DISTRACTING_OFFER_ID = "Compendium.essence20.cobra_codex.Item.fUSF6fxRyTniN2wT";

  function makeTargetsSet(targetActor) {
    const token = { actor: targetActor };
    const set = new Set(targetActor ? [token] : []);
    set.first = () => (targetActor ? token : undefined);
    return set;
  }

  function makeCorruptActor({ state = undefined } = {}) {
    return {
      ...makeActor(),
      system: { originSkillsIncrease: 'deception' },
      getFlag: jest.fn(() => state),
      _dice: { rollSkill: jest.fn() },
    };
  }

  beforeEach(() => {
    game.user.targets = new Set();
    ui.notifications.warn.mockReset();
  });

  describe("canUsePerk", () => {
    test("true against any target with no prior state this scene", () => {
      const actor = makeCorruptActor();
      game.user.targets = makeTargetsSet({ uuid: 'Actor.target1' });
      const item = makePerkItem({ sourceId: DISTRACTING_OFFER_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false once a prior attempt this scene failed", () => {
      const actor = makeCorruptActor({ state: { sceneId: null, failed: true } });
      game.user.targets = makeTargetsSet({ uuid: 'Actor.target1' });
      const item = makePerkItem({ sourceId: DISTRACTING_OFFER_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("triggers the roll against the currently-targeted actor", async () => {
    const actor = makeCorruptActor();
    game.user.targets = makeTargetsSet({ uuid: 'Actor.target1' });
    const item = makePerkItem({ sourceId: DISTRACTING_OFFER_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).toHaveBeenCalled();
  });

  test("warns and does nothing with no target selected", async () => {
    const actor = makeCorruptActor();
    game.user.targets = makeTargetsSet(null);
    const item = makePerkItem({ sourceId: DISTRACTING_OFFER_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("Matured (Cobra Codex, General Perk, p.176)", () => {
  const MATURED_ID = "Compendium.essence20.cobra_codex.Item.bf4nxa6WKKhuQcEH";

  function makeHangUpItem({ id = 'hangup1', name = 'Angry' } = {}) {
    return {
      id, name, type: 'hangUp',
      getFlag: jest.fn(() => undefined),
      setFlag: jest.fn(),
      unsetFlag: jest.fn(),
      effects: { size: 0, [Symbol.iterator]: () => [][Symbol.iterator]() },
    };
  }

  describe("canUsePerk", () => {
    test("true with at least one Hang-Up", () => {
      const actor = { ...makeActor(), items: [makeHangUpItem()] };
      const item = makePerkItem({ sourceId: MATURED_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false with no Hang-Up at all", () => {
      const actor = { ...makeActor(), items: [] };
      const item = makePerkItem({ sourceId: MATURED_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("flags the chosen Hang-Up as ignored and posts a chat card", async () => {
    const hangUp = makeHangUpItem({ id: 'hangup1', name: 'Angry' });
    const actor = { ...makeActor(), items: [hangUp] };
    foundry.applications.api.DialogV2.wait.mockResolvedValue('hangup1');
    const item = makePerkItem({ sourceId: MATURED_ID, actor });

    await onPerkUse(item);

    expect(hangUp.setFlag).toHaveBeenCalledWith('essence20', 'maturedIgnored', true);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("does nothing when the picker is cancelled", async () => {
    const hangUp = makeHangUpItem({ id: 'hangup1', name: 'Angry' });
    const actor = { ...makeActor(), items: [hangUp] };
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const item = makePerkItem({ sourceId: MATURED_ID, actor });

    await onPerkUse(item);

    expect(hangUp.setFlag).not.toHaveBeenCalled();
  });
});

describe("Growl (Cobra Codex, Vanguard Warthog Focus, 1st level, p.69)", () => {
  const GROWL_ID = "Compendium.essence20.cobra_codex.Item.OSVtPXBdRmZ2C4PD";

  function makeTargetsSet(targetActor) {
    const token = { actor: targetActor };
    const set = new Set(targetActor ? [token] : []);
    set.first = () => (targetActor ? token : undefined);
    return set;
  }

  function makeWarthogActor() {
    return { ...makeActor(), _dice: { rollSkill: jest.fn() } };
  }

  beforeEach(() => {
    game.combat = { id: 'combat1', round: 1, turn: 0 };
    game.user.targets = new Set();
    ui.notifications.warn.mockReset();
  });

  afterEach(() => {
    game.combat = null;
  });

  describe("canUsePerk", () => {
    test("true against a fresh target this turn", () => {
      const actor = makeWarthogActor();
      game.user.targets = makeTargetsSet({ id: 'enemy1' });
      const item = makePerkItem({ sourceId: GROWL_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false against a target already Growled this turn", () => {
      const actor = { ...makeWarthogActor(), getFlag: jest.fn(() => ({
        combatId: 'combat1', round: 1, turn: 0, targetIds: ['enemy1'],
      })) };
      game.user.targets = makeTargetsSet({ id: 'enemy1' });
      const item = makePerkItem({ sourceId: GROWL_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("triggers the roll against the currently-targeted actor", async () => {
    const actor = makeWarthogActor();
    game.user.targets = makeTargetsSet({ id: 'enemy1' });
    const item = makePerkItem({ sourceId: GROWL_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).toHaveBeenCalled();
  });

  test("warns and does nothing with no target selected", async () => {
    const actor = makeWarthogActor();
    game.user.targets = makeTargetsSet(null);
    const item = makePerkItem({ sourceId: GROWL_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("Beast Mode (Cobra Codex, Ranger Guerilla Focus, 1st level, p.61)", () => {
  const BEAST_MODE_ID = "Compendium.essence20.cobra_codex.Item.o4lqILvsxyU3LhBS";

  function makeRangerActor({ resourceValue = 1, active = false } = {}) {
    const rolePoints = { system: { resource: { value: resourceValue } }, update: jest.fn() };
    const grantedId = active ? 'granted1' : undefined;
    return {
      ...makeActor(),
      items: { get: jest.fn((id) => (active && id === grantedId ? { id: grantedId, delete: jest.fn() } : undefined)) },
      getFlag: jest.fn(() => grantedId),
      setFlag: jest.fn(),
      unsetFlag: jest.fn(),
      createEmbeddedDocuments: jest.fn(async () => [{ id: 'granted1' }]),
      _getBaseRolePoints: jest.fn(() => rolePoints),
      __rolePoints: rolePoints,
    };
  }

  beforeEach(() => {
    global.fromUuid = jest.fn().mockResolvedValue({ toObject: () => ({ name: 'Engrafted Mutation' }) });
  });

  describe("canUsePerk", () => {
    test("true with an Adaptation Point available", () => {
      const actor = makeRangerActor({ resourceValue: 1 });
      const item = makePerkItem({ sourceId: BEAST_MODE_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false without an Adaptation Point, unless already active", () => {
      const actor = makeRangerActor({ resourceValue: 0 });
      const item = makePerkItem({ sourceId: BEAST_MODE_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });

    test("true to switch back off even with 0 Adaptation Points", () => {
      const actor = makeRangerActor({ resourceValue: 0, active: true });
      const item = makePerkItem({ sourceId: BEAST_MODE_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });
  });

  test("switching on spends 1 Adaptation Point and grants Engrafted Mutation", async () => {
    const actor = makeRangerActor({ resourceValue: 1 });
    const item = makePerkItem({ sourceId: BEAST_MODE_ID, actor });

    await onPerkUse(item);

    expect(actor.__rolePoints.update).toHaveBeenCalledWith({ 'system.resource.value': 0 });
    expect(actor.createEmbeddedDocuments).toHaveBeenCalled();
  });

  test("warns when unaffordable", async () => {
    const actor = makeRangerActor({ resourceValue: 0 });
    const item = makePerkItem({ sourceId: BEAST_MODE_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
  });
});

describe("Harass (Cobra Codex, Renegade Troublemaker Focus, 10th level, p.63)", () => {
  const HARASS_ID = "Compendium.essence20.cobra_codex.Item.91TqKfAnyL1VijZH";

  beforeEach(() => {
    game.combat = { id: 'combat1', round: 1, turn: 0 };
  });

  afterEach(() => {
    game.combat = null;
  });

  describe("canUsePerk", () => {
    test("true when not yet used this turn", () => {
      const actor = makeActor();
      const item = makePerkItem({ sourceId: HARASS_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false once already used this turn", () => {
      const actor = { ...makeActor(), getFlag: jest.fn(() => ({ combatId: 'combat1', round: 1, turn: 0 })) };
      const item = makePerkItem({ sourceId: HARASS_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("marks the turn used and banks an Edge", async () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: HARASS_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'harassUsedThisTurn', expect.any(Object));
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'pendingHarassEdge', expect.objectContaining({ edge: true }));
  });
});

describe("Antagonistic (Cobra Codex, Renegade Troublemaker Focus, 17th level, p.63)", () => {
  const ANTAGONISTIC_ID = "Compendium.essence20.cobra_codex.Item.04lrt1b9aCN4ts2N";

  function makeTargetsSet(targetActor) {
    const token = { actor: targetActor };
    const set = new Set(targetActor ? [token] : []);
    set.first = () => (targetActor ? token : undefined);
    return set;
  }

  beforeEach(() => {
    game.user.targets = new Set();
    ui.notifications.warn.mockReset();
  });

  test("canUsePerk is always true", () => {
    const item = makePerkItem({ sourceId: ANTAGONISTIC_ID, actor: makeActor() });
    expect(canUsePerk(item)).toBe(true);
  });

  test("triggers the roll against the currently-targeted actor", async () => {
    const actor = { ...makeActor(), _dice: { rollSkill: jest.fn() } };
    game.user.targets = makeTargetsSet({ id: 'enemy1' });
    const item = makePerkItem({ sourceId: ANTAGONISTIC_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).toHaveBeenCalled();
  });

  test("warns and does nothing with no target selected", async () => {
    const actor = { ...makeActor(), _dice: { rollSkill: jest.fn() } };
    game.user.targets = makeTargetsSet(null);
    const item = makePerkItem({ sourceId: ANTAGONISTIC_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("Versatile Protection (Cobra Codex, Vanguard Citystriker Focus, 17th level, p.68)", () => {
  const VERSATILE_PROTECTION_ID = "Compendium.essence20.cobra_codex.Item.FZQlUV1KkyQxUi7s";

  test("canUsePerk is always true", () => {
    const item = makePerkItem({ sourceId: VERSATILE_PROTECTION_ID, actor: makeActor() });
    expect(canUsePerk(item)).toBe(true);
  });

  test("switching on prompts and sets the chosen Resistance/Immunity field", async () => {
    const actor = { ...makeActor(), update: jest.fn() };
    foundry.applications.api.DialogV2.wait.mockResolvedValue({ damageType: 'fire', tier: 'resistance' });
    const item = makePerkItem({ sourceId: VERSATILE_PROTECTION_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.resistances.fire': true });
  });
});

describe("Pack Attack (Cobra Codex, Vanguard Warthog Focus, 17th level, p.69)", () => {
  const PACK_ATTACK_ID = "Compendium.essence20.cobra_codex.Item.spxYtWFQPj7bBt0g";

  function makeWarthogActor({ growlBank = undefined } = {}) {
    return {
      ...makeActor(),
      getFlag: jest.fn((scope, key) => (key == 'pendingGrowlShiftUp' ? growlBank : undefined)),
    };
  }

  describe("canUsePerk", () => {
    test("true with a live Growl bank", () => {
      const actor = makeWarthogActor({ growlBank: { targetId: 'enemy1' } });
      const item = makePerkItem({ sourceId: PACK_ATTACK_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false without one", () => {
      const item = makePerkItem({ sourceId: PACK_ATTACK_ID, actor: makeWarthogActor() });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("warns with no nearby allies", async () => {
    const actor = makeWarthogActor({ growlBank: { targetId: 'enemy1' } });
    const item = makePerkItem({ sourceId: PACK_ATTACK_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
  });
});

describe("Animal Gait (Cobra Codex, Ranger Guerilla Focus, 6th level, p.61)", () => {
  const ANIMAL_GAIT_ID = "Compendium.essence20.cobra_codex.Item.gWjcSPeqNe1h8rwZ";

  test("canUsePerk is always true", () => {
    const item = makePerkItem({ sourceId: ANIMAL_GAIT_ID, actor: makeActor() });
    expect(canUsePerk(item)).toBe(true);
  });

  test("switching on prompts and sets the chosen movement type", async () => {
    const actor = makeActor();
    foundry.applications.api.DialogV2.wait.mockResolvedValue('climb');
    const item = makePerkItem({ sourceId: ANIMAL_GAIT_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'animalGaitMovementType', 'climb');
  });

  test("switching off clears the flag without posting an activation card", async () => {
    const actor = { ...makeActor(), getFlag: jest.fn(() => 'climb') };
    const item = makePerkItem({ sourceId: ANIMAL_GAIT_ID, actor });

    await onPerkUse(item);

    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'animalGaitMovementType');
  });
});

describe("Human Bullet (Cobra Codex, Technician Rocketeer Focus, 17th level, p.66)", () => {
  const HUMAN_BULLET_ID = "Compendium.essence20.cobra_codex.Item.KGdGal1EWQ3m4HTw";

  test("canUsePerk is always true", () => {
    const item = makePerkItem({ sourceId: HUMAN_BULLET_ID, actor: makeActor() });
    expect(canUsePerk(item)).toBe(true);
  });

  test("triggers the roll once a radius is chosen", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('30');
    const actor = { ...makeActor(), _dice: { rollSkill: jest.fn() }, getActiveTokens: jest.fn(() => []) };
    const item = makePerkItem({ sourceId: HUMAN_BULLET_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).toHaveBeenCalled();
  });
});

describe("Calculated Attack (Transformers CRB, Gunner base, Sharpshooter Focus, 3rd level, p.70)", () => {
  const CALCULATED_ATTACK_ID = "Compendium.essence20.tf_crb.Item.hYWoZnrFKaVTZFuG";

  function makeSharpshooterActor() {
    return { ...makeActor(), _dice: { rollSkill: jest.fn() } };
  }

  test("canUsePerk is always true - no cost or frequency cap in RAW", () => {
    const actor = makeSharpshooterActor();
    const item = makePerkItem({ sourceId: CALCULATED_ATTACK_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("triggers a Science roll", async () => {
    const actor = makeSharpshooterActor();
    const item = makePerkItem({ sourceId: CALCULATED_ATTACK_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'science', essence: 'smarts', isCalculatedAttack: true }),
      actor,
    );
  });
});

describe("Tender (MLP CRB, Spirit of Kindness, 6th level, p.85)", () => {
  const TENDER_ID = "Compendium.essence20.mlp_crb.Item.xR4z6mV7Ab72TyVs";
  const EMPATHY_MLP_ID = "Compendium.essence20.mlp_crb.Item.7k1UXzSKyoV8EtXZ";

  function makeKindActor({ empathyChoice = 'survival' } = {}) {
    const items = [];
    if (empathyChoice) {
      items.push({
        type: 'perk', flags: { core: { sourceId: EMPATHY_MLP_ID } }, system: { choice: empathyChoice },
      });
    }

    return { items, _dice: { rollSkill: jest.fn() } };
  }

  test("canUsePerk is true with an Empathy choice made", () => {
    const actor = makeKindActor({ empathyChoice: 'survival' });
    const item = makePerkItem({ sourceId: TENDER_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("canUsePerk is false without an Empathy choice", () => {
    const actor = makeKindActor({ empathyChoice: null });
    const item = makePerkItem({ sourceId: TENDER_ID, actor });
    expect(canUsePerk(item)).toBe(false);
  });

  test("triggers the roll", async () => {
    const actor = makeKindActor({ empathyChoice: 'survival' });
    const item = makePerkItem({ sourceId: TENDER_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'survival', defenseType: 'willpower', isTender: true }),
      actor,
    );
  });
});

describe("Takedown (GI Joe CRB, Commando base, 5th level, p.72)", () => {
  const TAKEDOWN_ID = "Compendium.essence20.gi_joe_crb.Item.Yev7VrgEKtsTGdrx";

  function makeCommandoActor() {
    return { ...makeActor(), _dice: { rollSkill: jest.fn() } };
  }

  beforeEach(() => {
    foundry.applications.api.DialogV2.wait.mockReset();
  });

  test("canUsePerk is always true - no cost, no action-economy gate", () => {
    const actor = makeCommandoActor();
    const item = makePerkItem({ sourceId: TAKEDOWN_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("prompts for Might/Finesse and triggers the roll", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('might');
    const actor = makeCommandoActor();
    const item = makePerkItem({ sourceId: TAKEDOWN_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'might', essence: 'strength', defenseType: 'toughness', isTakedown: true }),
      actor,
    );
  });

  test("triggers nothing when the picker is cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeCommandoActor();
    const item = makePerkItem({ sourceId: TAKEDOWN_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("Self-Revive (GI Joe CRB, Focus: Medic, 10th level, p.82)", () => {
  const SELF_REVIVE_ID = "Compendium.essence20.gi_joe_crb.Item.ulES8RippJVrGbhj";

  function makeMedicActor({ defeated = true } = {}) {
    const actor = { ...makeActor(), statuses: new Set(defeated ? ['defeated'] : []) };
    actor.update = jest.fn();
    actor.toggleStatusEffect = jest.fn();
    return actor;
  }

  beforeEach(() => {
    game.combat = { id: 'combat1', round: 1, turn: 0 };
  });

  afterEach(() => {
    game.combat = null;
  });

  test("canUsePerk is true while Defeated", () => {
    const actor = makeMedicActor({ defeated: true });
    const item = makePerkItem({ sourceId: SELF_REVIVE_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("canUsePerk is false while not Defeated", () => {
    const actor = makeMedicActor({ defeated: false });
    const item = makePerkItem({ sourceId: SELF_REVIVE_ID, actor });
    expect(canUsePerk(item)).toBe(false);
  });

  test("regains 1 Health and clears Defeated", async () => {
    const actor = makeMedicActor({ defeated: true });
    const item = makePerkItem({ sourceId: SELF_REVIVE_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 1 });
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('defeated', { active: false });
  });

  test("does nothing while not Defeated", async () => {
    const actor = makeMedicActor({ defeated: false });
    const item = makePerkItem({ sourceId: SELF_REVIVE_ID, actor });

    await onPerkUse(item);

    expect(actor.update).not.toHaveBeenCalled();
  });
});

describe("Outwit (GI Joe CRB, Focus: Battlefield Psychologist, 3rd level, p.86)", () => {
  const OUTWIT_ID = "Compendium.essence20.gi_joe_crb.Item.DVBrtxa9iiXXhDoS";

  function makePsychologistActor() {
    return { ...makeActor(), _dice: { rollSkill: jest.fn() } };
  }

  beforeEach(() => {
    foundry.applications.api.DialogV2.wait.mockReset();
  });

  test("canUsePerk is always true - no cost, no action-economy gate", () => {
    const actor = makePsychologistActor();
    const item = makePerkItem({ sourceId: OUTWIT_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("prompts for Deception/Intimidation and triggers the roll", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('deception');
    const actor = makePsychologistActor();
    const item = makePerkItem({ sourceId: OUTWIT_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'deception', defenseType: 'cleverness', isOutwit: true, outwitCondition: 'stunned' }),
      actor,
    );
  });

  test("triggers nothing when the picker is cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makePsychologistActor();
    const item = makePerkItem({ sourceId: OUTWIT_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("Dirty Trick (GI Joe CRB, Ranger Environmental Exposure choice, p.91)", () => {
  const DIRTY_TRICK_ID = "Compendium.essence20.gi_joe_crb.Item.e5nMmMPpV3WU9P92";

  function makeRangerActor() {
    return { ...makeActor(), _dice: { rollSkill: jest.fn() } };
  }

  test("canUsePerk is always true - no cost, no cap", () => {
    const actor = makeRangerActor();
    expect(canUsePerk(makePerkItem({ sourceId: DIRTY_TRICK_ID, actor }))).toBe(true);
  });

  test("triggers a Survival vs Willpower roll", async () => {
    const actor = makeRangerActor();
    const item = makePerkItem({ sourceId: DIRTY_TRICK_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'survival', essence: 'smarts', defenseType: 'willpower', isDirtyTrick: true }),
      actor,
    );
  });
});

describe("Shoulder To Shoulder (GI Joe CRB, Focus: Frontline Leader, 3rd level, p.87)", () => {
  const SHOULDER_TO_SHOULDER_ID = "Compendium.essence20.gi_joe_crb.Item.vZNQBGwiv1hREbyr";

  let originalTargets;
  beforeEach(() => {
    originalTargets = game.user.targets;
    foundry.applications.api.DialogV2.wait.mockReset();
  });
  afterEach(() => {
    game.user.targets = originalTargets;
  });

  test("canUsePerk is always true - no cost, no action-economy gate", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: SHOULDER_TO_SHOULDER_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("prompts for a Skill and banks the upshift on the currently-targeted ally", async () => {
    const targetActor = { setFlag: jest.fn() };
    game.user.targets = { first: jest.fn(() => ({ actor: targetActor })) };
    foundry.applications.api.DialogV2.wait.mockResolvedValue('persuasion');
    const actor = makeActor();
    const item = makePerkItem({ sourceId: SHOULDER_TO_SHOULDER_ID, actor });

    await onPerkUse(item);

    expect(targetActor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingShoulderToShoulder', expect.objectContaining({ skill: 'persuasion', shiftUp: 1 }),
    );
  });

  test("banks nothing without a target", async () => {
    game.user.targets = { first: jest.fn(() => undefined) };
    const actor = makeActor();
    const item = makePerkItem({ sourceId: SHOULDER_TO_SHOULDER_ID, actor });

    await onPerkUse(item);

    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });
});

describe("Fearsome Presence (GI Joe CRB, Renegade base, 14th level, p.97)", () => {
  const FEARSOME_PRESENCE_ID = "Compendium.essence20.gi_joe_crb.Item.Jbx3ei70ZsoabVuL";
  const RECKLESS_ABANDON_ID = "Compendium.essence20.gi_joe_crb.Item.84d0XTJwKCYMJUgY";

  function makeRenegadeActor({ recklessAbandonActive = true } = {}) {
    const rolePoints = { flags: { core: { sourceId: RECKLESS_ABANDON_ID } }, system: { isActive: recklessAbandonActive } };
    return { ...makeActor(), _getBaseRolePoints: jest.fn(() => rolePoints), _dice: { rollSkill: jest.fn() } };
  }

  beforeEach(() => {
    ui.notifications.warn.mockReset();
  });

  test("canUsePerk is true while Reckless Abandon is active", () => {
    const actor = makeRenegadeActor({ recklessAbandonActive: true });
    const item = makePerkItem({ sourceId: FEARSOME_PRESENCE_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("canUsePerk is false while Reckless Abandon isn't active", () => {
    const actor = makeRenegadeActor({ recklessAbandonActive: false });
    const item = makePerkItem({ sourceId: FEARSOME_PRESENCE_ID, actor });
    expect(canUsePerk(item)).toBe(false);
  });

  test("rolls Intimidation vs. Willpower while active", async () => {
    const actor = makeRenegadeActor({ recklessAbandonActive: true });
    const item = makePerkItem({ sourceId: FEARSOME_PRESENCE_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'intimidation', defenseType: 'willpower', isFearsomePresence: true }),
      actor,
    );
  });

  test("warns and does nothing while Reckless Abandon isn't active", async () => {
    const actor = makeRenegadeActor({ recklessAbandonActive: false });
    const item = makePerkItem({ sourceId: FEARSOME_PRESENCE_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("Natural Movement (GI Joe CRB, Focus: Predator, 6th level, p.93)", () => {
  const NATURAL_MOVEMENT_ID = "Compendium.essence20.gi_joe_crb.Item.TLI74oM0tbDtQ298";

  beforeEach(() => {
    foundry.applications.api.DialogV2.wait.mockReset();
    global.ChatMessage.create.mockReset();
  });

  test("canUsePerk is always true - no cost, no action-economy gate", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: NATURAL_MOVEMENT_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("prompts for Climb/Swim and activates it", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('climb');
    const actor = makeActor();
    const item = makePerkItem({ sourceId: NATURAL_MOVEMENT_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'naturalMovementType', 'climb');
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("deactivates when already active, without prompting", async () => {
    const actor = makeActor();
    actor.getFlag = jest.fn(() => 'swim');
    const item = makePerkItem({ sourceId: NATURAL_MOVEMENT_ID, actor });

    await onPerkUse(item);

    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'naturalMovementType');
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("does nothing when the picker is cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeActor();
    const item = makePerkItem({ sourceId: NATURAL_MOVEMENT_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(global.ChatMessage.create).not.toHaveBeenCalled();
  });
});

describe("Environmental Expertise (GI Joe CRB, Ranger base, 1st/9th/18th level, p.90)", () => {
  const ENVIRONMENTAL_EXPERTISE_ID = "Compendium.essence20.gi_joe_crb.Item.EbbSUA2vSHyv3MjQ";

  beforeEach(() => {
    global.ChatMessage.create.mockReset();
  });

  test("canUsePerk is always true - no cost, no action-economy gate", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: ENVIRONMENTAL_EXPERTISE_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("toggles the flag on from inactive", async () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: ENVIRONMENTAL_EXPERTISE_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'environmentalExpertiseActive', true);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("toggles the flag off from active", async () => {
    const actor = makeActor();
    actor.getFlag = jest.fn(() => true);
    const item = makePerkItem({ sourceId: ENVIRONMENTAL_EXPERTISE_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'environmentalExpertiseActive', false);
  });
});

describe("Read The Land (Factions in Action Vol. 2, Ranger Focus, p.68)", () => {
  const READ_THE_LAND_ID = "Compendium.essence20.intercontinental_adventures.Item.j8wVLLK4XvVEuP6F";

  beforeEach(() => {
    game.users = [{ isGM: true, active: true }];
    game.settings = { get: jest.fn(() => 1) };
    game.socket.emit.mockReset();
    global.ChatMessage.create.mockReset();
  });

  afterEach(() => {
    delete game.settings;
  });

  describe("canUsePerk", () => {
    test("true to switch ON with a GM connected and a Story Point available", () => {
      const actor = makeActor();
      const item = makePerkItem({ sourceId: READ_THE_LAND_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false to switch ON without a GM or without a Story Point", () => {
      game.users = [{ isGM: false, active: true }];
      const actor = makeActor();
      const item = makePerkItem({ sourceId: READ_THE_LAND_ID, actor });
      expect(canUsePerk(item)).toBe(false);

      game.users = [{ isGM: true, active: true }];
      game.settings.get = jest.fn(() => 0);
      expect(canUsePerk(item)).toBe(false);
    });

    test("true to switch back OFF even without a GM or a Story Point - free either way", () => {
      game.users = [{ isGM: false, active: true }];
      game.settings.get = jest.fn(() => 0);
      const actor = makeActor();
      actor.getFlag = jest.fn(() => true);
      const item = makePerkItem({ sourceId: READ_THE_LAND_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });
  });

  test("spends 1 Story Point and toggles the flag on from inactive", async () => {
    const actor = makeActor({ id: 'ranger1', name: 'Scout' });
    const item = makePerkItem({ sourceId: READ_THE_LAND_ID, actor });

    await onPerkUse(item);

    expect(game.socket.emit).toHaveBeenCalledWith('system.essence20', {
      action: 'spendStoryPoints', amount: 1, actorName: 'Scout',
    });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'environmentalExpertiseActive', true);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("toggles the flag off from active without spending anything", async () => {
    const actor = makeActor({ id: 'ranger1', name: 'Scout' });
    actor.getFlag = jest.fn(() => true);
    const item = makePerkItem({ sourceId: READ_THE_LAND_ID, actor });

    await onPerkUse(item);

    expect(game.socket.emit).not.toHaveBeenCalled();
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'environmentalExpertiseActive', false);
  });
});

describe("Rouse (GI Joe CRB, Officer base, 1st level, p.85)", () => {
  const ROUSE_ID = "Compendium.essence20.gi_joe_crb.Item.AVhNGB1h4e4eeNPD";

  function makeOfficerActor() {
    return { ...makeActor(), _dice: { rollSkill: jest.fn() } };
  }

  afterEach(() => {
    game.combat = null;
  });

  describe("canUsePerk", () => {
    test("true in an active combat", () => {
      game.combat = { round: 1 };
      const item = makePerkItem({ sourceId: ROUSE_ID, actor: makeOfficerActor() });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false outside combat", () => {
      game.combat = null;
      const item = makePerkItem({ sourceId: ROUSE_ID, actor: makeOfficerActor() });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("triggers a flat DIF 15 Persuasion Skill Test", async () => {
    game.combat = { round: 1 };
    const actor = makeOfficerActor();
    const item = makePerkItem({ sourceId: ROUSE_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'persuasion', essence: 'social', dif: '15', isRouseAttempt: true }),
      actor,
    );
  });
});

describe("Rousing Comeback (GI Joe CRB, Officer base, 11th level, p.86)", () => {
  const ROUSING_COMEBACK_ID = "Compendium.essence20.gi_joe_crb.Item.I8yAnOEoaut76wlf";

  function makeOfficerActor() {
    return { ...makeActor(), _dice: { rollSkill: jest.fn() } };
  }

  afterEach(() => {
    game.combat = null;
  });

  describe("canUsePerk", () => {
    test("true in an active combat, false outside one", () => {
      game.combat = { round: 1 };
      expect(canUsePerk(makePerkItem({ sourceId: ROUSING_COMEBACK_ID, actor: makeOfficerActor() }))).toBe(true);

      game.combat = null;
      expect(canUsePerk(makePerkItem({ sourceId: ROUSING_COMEBACK_ID, actor: makeOfficerActor() }))).toBe(false);
    });
  });

  test("triggers a flat DIF 20 Brawn Skill Test", async () => {
    game.combat = { round: 1 };
    const actor = makeOfficerActor();
    const item = makePerkItem({ sourceId: ROUSING_COMEBACK_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'brawn', essence: 'strength', dif: '20', isRousingComebackAttempt: true }),
      actor,
    );
  });
});

describe("Knight's Jump (GI Joe CRB, Grandmaster Focus, 1st level, p.87)", () => {
  const KNIGHTS_JUMP_ID = "Compendium.essence20.gi_joe_crb.Item.CG0aeZtKsPVmvUF5";

  function makeCombatant(actorId, initiative) {
    return { actor: { id: actorId }, initiative, update: jest.fn(function (data) {
      this.initiative = data.initiative; 
    }) };
  }

  beforeEach(() => {
    ui.notifications.warn.mockReset();
    global.ChatMessage.create?.mockReset();
  });

  afterEach(() => {
    game.combat = null;
    game.user.targets = new Set();
  });

  describe("canUsePerk", () => {
    test("true in combat, not yet used this turn", () => {
      game.combat = { id: 'combat1', round: 1, turn: 0, combatants: [] };
      const actor = makeActor();
      expect(canUsePerk(makePerkItem({ sourceId: KNIGHTS_JUMP_ID, actor }))).toBe(true);
    });

    test("false outside combat", () => {
      game.combat = null;
      const actor = makeActor();
      expect(canUsePerk(makePerkItem({ sourceId: KNIGHTS_JUMP_ID, actor }))).toBe(false);
    });
  });

  test("swaps the initiative of exactly 2 targeted allies", async () => {
    const combatantA = makeCombatant('ally1', 10);
    const combatantB = makeCombatant('ally2', 5);
    game.combat = { id: 'combat1', round: 1, turn: 0, combatants: [combatantA, combatantB] };
    game.user.targets = new Set([{ actor: { id: 'ally1' } }, { actor: { id: 'ally2' } }]);
    const actor = makeActor();
    const item = makePerkItem({ sourceId: KNIGHTS_JUMP_ID, actor });

    await onPerkUse(item);

    expect(combatantA.initiative).toBe(5);
    expect(combatantB.initiative).toBe(10);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("warns and does nothing without exactly 2 targeted allies", async () => {
    game.combat = { id: 'combat1', round: 1, turn: 0, combatants: [] };
    game.user.targets = new Set([{ actor: { id: 'ally1' } }]);
    const actor = makeActor();
    const item = makePerkItem({ sourceId: KNIGHTS_JUMP_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(global.ChatMessage.create).not.toHaveBeenCalled();
  });
});

describe("A Logical Explanation (WTNV Citizen's Guide, Scientist Role, p.46)", () => {
  const A_LOGICAL_EXPLANATION_ID = "Compendium.essence20.wtnv_citizens_guide.Item.CiDQxCxgnnosvBDo";

  function makeScientistActor() {
    return { ...makeActor(), _dice: { rollSkill: jest.fn() } };
  }

  test("canUsePerk is always true - no cost or gate", () => {
    const actor = makeScientistActor();
    const item = makePerkItem({ sourceId: A_LOGICAL_EXPLANATION_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("triggers the roll", async () => {
    const actor = makeScientistActor();
    const item = makePerkItem({ sourceId: A_LOGICAL_EXPLANATION_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'science', essence: 'smarts', defenseType: 'willpower' }),
      actor,
    );
  });
});

describe("Soothe (General Hawk's Personnel Files, General Perk, p.175)", () => {
  const SOOTHE_ID = "Compendium.essence20.general_hawk_s_personel_files.Item.vzTeGdjO3v2oeR19";

  function makeSootheActor() {
    return { ...makeActor(), _dice: { rollSkill: jest.fn() } };
  }

  test("canUsePerk is always true - no cost or gate", () => {
    const actor = makeSootheActor();
    const item = makePerkItem({ sourceId: SOOTHE_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("triggers the roll", async () => {
    const actor = makeSootheActor();
    const item = makePerkItem({ sourceId: SOOTHE_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'animalHandling', essence: 'social', defenseType: 'willpower' }),
      actor,
    );
  });
});

describe("Bumper Crop (WTNV Citizen's Guide, Farmer Role, Tiller Focus, p.37)", () => {
  const BUMPER_CROP_ID = "Compendium.essence20.wtnv_citizens_guide.Item.5GDpvzG3x2ZgrrQj";

  function makeFarmerActor() {
    return { ...makeActor(), _dice: { rollSkill: jest.fn() } };
  }

  test("canUsePerk is always true - no cost or gate beyond the Standard action itself", () => {
    const actor = makeFarmerActor();
    const item = makePerkItem({ sourceId: BUMPER_CROP_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("triggers the roll", async () => {
    const actor = makeFarmerActor();
    const item = makePerkItem({ sourceId: BUMPER_CROP_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'intimidation', essence: 'strength', dif: '10' }),
      actor,
    );
  });
});

describe("\"Pseudo\"-Science (WTNV Citizen's Guide, Scientist Role, Night Vale Community College Focus, p.44)", () => {
  const PSEUDO_SCIENCE_ID = "Compendium.essence20.wtnv_citizens_guide.Item.MTo42tKWWtZ15Ist";

  test("canUsePerk is true as long as it hasn't already been activated", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: PSEUDO_SCIENCE_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("canUsePerk is false once already activated", () => {
    const actor = makeActor();
    actor.getFlag = jest.fn((scope, key) => (key == 'pseudoScienceActive' ? true : undefined));
    const item = makePerkItem({ sourceId: PSEUDO_SCIENCE_ID, actor });
    expect(canUsePerk(item)).toBe(false);
  });

  test("activates the substitution", async () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: PSEUDO_SCIENCE_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'pseudoScienceActive', true);
  });

  test("does nothing once already activated", async () => {
    const actor = makeActor();
    actor.getFlag = jest.fn((scope, key) => (key == 'pseudoScienceActive' ? true : undefined));
    const item = makePerkItem({ sourceId: PSEUDO_SCIENCE_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).not.toHaveBeenCalledWith('essence20', 'pseudoScienceActive', expect.anything());
  });
});

describe("Nemesis Drain (Finster's Monster-Matic Cookbook, all 6 Psycho Paths, 7th level)", () => {
  const NEMESIS_DRAIN_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.WQYSawSpefEKLaG0";

  function makeNemesisDrainActor({ power = 2 } = {}) {
    return {
      ...makeActor(),
      system: { powers: { personal: { value: power } } },
      update: jest.fn(),
      getActiveTokens: jest.fn(() => []),
      _dice: { rollSkill: jest.fn() },
    };
  }

  beforeEach(() => {
    game.combat = null;
    ui.notifications.warn.mockReset();
  });

  describe("canUsePerk", () => {
    test("true when affording 2 Power and not yet used this scene", () => {
      const actor = makeNemesisDrainActor({ power: 2 });
      const item = makePerkItem({ sourceId: NEMESIS_DRAIN_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false when unaffordable", () => {
      const actor = makeNemesisDrainActor({ power: 1 });
      const item = makePerkItem({ sourceId: NEMESIS_DRAIN_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });

    test("false once already used this scene", () => {
      game.combat = { id: 'combat1' };
      const actor = makeNemesisDrainActor({ power: 2 });
      actor.getFlag = jest.fn((scope, key) => (
        key == 'nemesisDrainUsedThisEncounter' ? { combatId: 'combat1' } : undefined
      ));
      const item = makePerkItem({ sourceId: NEMESIS_DRAIN_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("spends 2 Power, marks used this scene, and triggers the roll", async () => {
    game.combat = { id: 'combat1' };
    const actor = makeNemesisDrainActor({ power: 2 });
    const item = makePerkItem({ sourceId: NEMESIS_DRAIN_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'nemesisDrainUsedThisEncounter', { combatId: 'combat1' },
    );
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ isNemesisDrain: true }), actor,
    );
  });

  test("warns and does nothing when unaffordable", async () => {
    const actor = makeNemesisDrainActor({ power: 0 });
    const item = makePerkItem({ sourceId: NEMESIS_DRAIN_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("Right Behind You (Finster's Monster-Matic Cookbook, Path of Flame, 5th level)", () => {
  const RIGHT_BEHIND_YOU_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.7jwgzzygZymRkndW";

  function makeCombatant(actorId, initiative) {
    return { actor: { id: actorId }, initiative, update: jest.fn() };
  }

  function makeFlameRangerActor({ power = 1, id = 'self' } = {}) {
    return { ...makeActor({ id }), system: { powers: { personal: { value: power } } }, update: jest.fn() };
  }

  beforeEach(() => {
    game.combat = null;
    game.user.targets = { first: jest.fn(() => undefined) };
    ui.notifications.warn.mockReset();
  });

  describe("canUsePerk", () => {
    test("true in round 1 with 1 Power available", () => {
      game.combat = { round: 1 };
      const actor = makeFlameRangerActor({ power: 1 });
      const item = makePerkItem({ sourceId: RIGHT_BEHIND_YOU_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false outside round 1", () => {
      game.combat = { round: 2 };
      const actor = makeFlameRangerActor({ power: 1 });
      const item = makePerkItem({ sourceId: RIGHT_BEHIND_YOU_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });

    test("false without enough Power", () => {
      game.combat = { round: 1 };
      const actor = makeFlameRangerActor({ power: 0 });
      const item = makePerkItem({ sourceId: RIGHT_BEHIND_YOU_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("spends 1 Power and adjusts Initiative once the ally lookup succeeds", async () => {
    const selfCombatant = makeCombatant('self', 5);
    const allyCombatant = makeCombatant('ally', 15);
    game.combat = { round: 1, combatants: [selfCombatant, allyCombatant] };
    game.user.targets = { first: jest.fn(() => ({ actor: { id: 'ally' } })) };
    const actor = makeFlameRangerActor({ power: 1, id: 'self' });
    const item = makePerkItem({ sourceId: RIGHT_BEHIND_YOU_ID, actor });

    await onPerkUse(item);

    expect(selfCombatant.update).toHaveBeenCalledWith({ initiative: 14.99 });
    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
  });

  test("spends nothing when no ally is targeted", async () => {
    game.combat = { round: 1, combatants: [] };
    const actor = makeFlameRangerActor({ power: 1 });
    const item = makePerkItem({ sourceId: RIGHT_BEHIND_YOU_ID, actor });

    await onPerkUse(item);

    expect(actor.update).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });
});

describe("Better You Than Me (Finster's Monster-Matic Cookbook, Path of Frost, 2nd level)", () => {
  const BETTER_YOU_THAN_ME_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.u0vF75YLcwdyY8pv";

  function makeFrostRangerActor({ power = 1, health = 5, max = 10 } = {}) {
    return { ...makeActor(), system: { powers: { personal: { value: power } }, health: { value: health, max } }, update: jest.fn() };
  }

  function makeAllyActor({ health = 5, max = 10 } = {}) {
    return { system: { health: { value: health, max } }, update: jest.fn() };
  }

  beforeEach(() => {
    game.user.targets = { first: jest.fn(() => undefined) };
    ui.notifications.warn.mockReset();
  });

  describe("canUsePerk", () => {
    test("true when affording 1 Power", () => {
      const actor = makeFrostRangerActor({ power: 1 });
      const item = makePerkItem({ sourceId: BETTER_YOU_THAN_ME_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false without enough Power", () => {
      const actor = makeFrostRangerActor({ power: 0 });
      const item = makePerkItem({ sourceId: BETTER_YOU_THAN_ME_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("spends 1 Power, heals self, and damages the touched ally", async () => {
    const ally = makeAllyActor({ health: 5 });
    game.user.targets = { first: jest.fn(() => ({ actor: ally })) };
    const actor = makeFrostRangerActor({ power: 1, health: 5 });
    const item = makePerkItem({ sourceId: BETTER_YOU_THAN_ME_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({
      'system.powers.personal.value': 0,
      'system.health.value': 6,
    });
    expect(ally.update).toHaveBeenCalledWith({ 'system.health.value': 4 });
  });

  test("warns and does nothing with no ally targeted", async () => {
    const actor = makeFrostRangerActor({ power: 1 });
    const item = makePerkItem({ sourceId: BETTER_YOU_THAN_ME_ID, actor });

    await onPerkUse(item);

    expect(actor.update).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });
});

describe("Elemental Storm (Beneath the Helmet, Aqua Ranger, 10th level, p.42)", () => {
  const ELEMENTAL_STORM_ID = "Compendium.essence20.beneath_the_helmet.Item.6IoMpj8pWmP8IpH4";

  function makeAquaRangerActor({ power = 1 } = {}) {
    return {
      ...makeActor(),
      system: { powers: { personal: { value: power } } },
      update: jest.fn(),
      getActiveTokens: jest.fn(() => []),
      _dice: { rollSkill: jest.fn() },
    };
  }

  beforeEach(() => {
    game.combat = null;
    ui.notifications.warn.mockReset();
    foundry.applications.api.DialogV2.wait.mockReset();
  });

  describe("canUsePerk", () => {
    test("true when affording 1 Power and not yet used this scene", () => {
      const actor = makeAquaRangerActor({ power: 1 });
      const item = makePerkItem({ sourceId: ELEMENTAL_STORM_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false when unaffordable", () => {
      const actor = makeAquaRangerActor({ power: 0 });
      const item = makePerkItem({ sourceId: ELEMENTAL_STORM_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });

    test("false once already used this scene", () => {
      game.combat = { id: 'combat1' };
      const actor = makeAquaRangerActor({ power: 1 });
      actor.getFlag = jest.fn((scope, key) => (
        key == 'elementalStormUsedThisEncounter' ? { combatId: 'combat1' } : undefined
      ));
      const item = makePerkItem({ sourceId: ELEMENTAL_STORM_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("spends 1 Power, marks used this scene, and triggers the roll once a Condition is chosen", async () => {
    game.combat = { id: 'combat1' };
    foundry.applications.api.DialogV2.wait.mockResolvedValue('prone');
    const actor = makeAquaRangerActor({ power: 1 });
    const item = makePerkItem({ sourceId: ELEMENTAL_STORM_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'elementalStormUsedThisEncounter', { combatId: 'combat1' },
    );
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ elementalStormCondition: 'prone' }), actor,
    );
  });

  test("spends nothing and doesn't mark the once-per-scene flag when the Condition picker is cancelled", async () => {
    game.combat = { id: 'combat1' };
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeAquaRangerActor({ power: 1 });
    const item = makePerkItem({ sourceId: ELEMENTAL_STORM_ID, actor });

    await onPerkUse(item);

    expect(actor.update).not.toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("warns and does nothing when unaffordable", async () => {
    const actor = makeAquaRangerActor({ power: 0 });
    const item = makePerkItem({ sourceId: ELEMENTAL_STORM_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("Orange Ranger Prime (A Jump Through Time, 20th level, p.34)", () => {
  const ORANGE_RANGER_PRIME_ID = "Compendium.essence20.jump_through_time.Item.8s9HHpmk633e6PLM";

  function makeOrangeRangerActor({ power = 0 } = {}) {
    return {
      ...makeActor(),
      system: { powers: { personal: { value: power } } },
      update: jest.fn(),
      getRollData: jest.fn(() => ({})),
    };
  }

  beforeEach(() => {
    game.combat = null;
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
  });

  test("canUsePerk is true with no cost, as long as it hasn't been used this scene", () => {
    const actor = makeOrangeRangerActor();
    const item = makePerkItem({ sourceId: ORANGE_RANGER_PRIME_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("canUsePerk is false once already used this scene", () => {
    game.combat = { id: 'combat1' };
    const actor = makeOrangeRangerActor();
    actor.getFlag = jest.fn((scope, key) => (
      key == 'orangeRangerPrimeUsedThisEncounter' ? { combatId: 'combat1' } : undefined
    ));
    const item = makePerkItem({ sourceId: ORANGE_RANGER_PRIME_ID, actor });
    expect(canUsePerk(item)).toBe(false);
  });

  test("regains a rolled 2d2 Power and marks the scene used", async () => {
    game.combat = { id: 'combat1' };
    global.Roll = class {
      constructor() {
        this.total = 3; 
      }
      async evaluate() {
        return this; 
      }
    };
    const actor = makeOrangeRangerActor({ power: 1 });
    const item = makePerkItem({ sourceId: ORANGE_RANGER_PRIME_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 4 });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'orangeRangerPrimeUsedThisEncounter', { combatId: 'combat1' },
    );
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("warns and does nothing once already used this scene", async () => {
    game.combat = { id: 'combat1' };
    const actor = makeOrangeRangerActor();
    actor.getFlag = jest.fn((scope, key) => (
      key == 'orangeRangerPrimeUsedThisEncounter' ? { combatId: 'combat1' } : undefined
    ));
    const item = makePerkItem({ sourceId: ORANGE_RANGER_PRIME_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });
});

describe("Purple Ranger Prime (A Jump Through Time, 20th level, p.39)", () => {
  const PURPLE_RANGER_PRIME_ID = "Compendium.essence20.jump_through_time.Item.EfkIx0B3AN0HipH8";

  function makePurpleRangerActor({ statuses = [] } = {}) {
    return { ...makeActor(), statuses: new Set(statuses), toggleStatusEffect: jest.fn() };
  }

  beforeEach(() => {
    global.ChatMessage.create.mockReset();
  });

  test("canUsePerk is true when the actor has at least one of the 3 named Conditions", () => {
    const actor = makePurpleRangerActor({ statuses: ['stunned'] });
    const item = makePerkItem({ sourceId: PURPLE_RANGER_PRIME_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("canUsePerk is false with none of the 3 named Conditions active", () => {
    const actor = makePurpleRangerActor({ statuses: ['prone'] });
    const item = makePerkItem({ sourceId: PURPLE_RANGER_PRIME_ID, actor });
    expect(canUsePerk(item)).toBe(false);
  });

  test("removes only the named Conditions the actor actually has, leaving others alone", async () => {
    const actor = makePurpleRangerActor({ statuses: ['frightened', 'stunned', 'prone'] });
    const item = makePerkItem({ sourceId: PURPLE_RANGER_PRIME_ID, actor });

    await onPerkUse(item);

    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('frightened', { active: false });
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('stunned', { active: false });
    expect(actor.toggleStatusEffect).not.toHaveBeenCalledWith('mesmerized', expect.anything());
    expect(actor.toggleStatusEffect).not.toHaveBeenCalledWith('prone', expect.anything());
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("does nothing and doesn't notify when none of the 3 named Conditions are active", async () => {
    const actor = makePurpleRangerActor({ statuses: ['prone'] });
    const item = makePerkItem({ sourceId: PURPLE_RANGER_PRIME_ID, actor });

    await onPerkUse(item);

    expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
    expect(global.ChatMessage.create).not.toHaveBeenCalled();
  });
});

describe("Comic Flair (A Jump Through Time, Orange Ranger, Modified Shell I option, p.32)", () => {
  const COMIC_FLAIR_ID = "Compendium.essence20.jump_through_time.Item.Ux2eueBLxKgzD2Kd";

  function makeToken({ disposition = 1, statuses = [] } = {}) {
    return {
      document: { disposition },
      center: {},
      actor: { statuses: new Set(statuses), toggleStatusEffect: jest.fn() },
    };
  }

  beforeEach(() => {
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
  });

  test("canUsePerk is always true", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: COMIC_FLAIR_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("removes a Condition from a valid target and notifies", async () => {
    const actorToken = makeToken();
    const actor = { ...makeActor(), getActiveTokens: jest.fn(() => [actorToken]) };
    const targetToken = makeToken({ statuses: ['frightened'] });
    game.user.targets.first = jest.fn(() => targetToken);
    canvas.grid.measurePath = jest.fn(() => ({ distance: 5 }));
    const item = makePerkItem({ sourceId: COMIC_FLAIR_ID, actor });

    await onPerkUse(item);

    expect(targetToken.actor.toggleStatusEffect).toHaveBeenCalledWith('frightened', { active: false });
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("warns with no valid target", async () => {
    const actorToken = makeToken();
    const actor = { ...makeActor(), getActiveTokens: jest.fn(() => [actorToken]) };
    game.user.targets.first = jest.fn(() => undefined);
    const item = makePerkItem({ sourceId: COMIC_FLAIR_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
  });
});

describe("Grid Soldier (A Jump Through Time, General Perk, p.54) - Impaired-removal half", () => {
  const GRID_SOLDIER_ID = "Compendium.essence20.jump_through_time.Item.y9F6PkCIw7g6tiqL";

  function makeToken({ disposition = 1, statuses = [] } = {}) {
    return {
      document: { disposition },
      center: {},
      actor: { statuses: new Set(statuses), toggleStatusEffect: jest.fn() },
    };
  }

  function makeGridSoldierActor({ power = 1, actorToken } = {}) {
    return {
      ...makeActor(),
      system: { powers: { personal: { value: power } } },
      update: jest.fn(),
      getActiveTokens: jest.fn(() => [actorToken]),
    };
  }

  beforeEach(() => {
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
    canvas.grid.measurePath = jest.fn(() => ({ distance: 5 }));
  });

  test("canUsePerk is true only with Power to spend", () => {
    const actorToken = makeToken();
    expect(canUsePerk(makePerkItem({
      sourceId: GRID_SOLDIER_ID, actor: makeGridSoldierActor({ power: 1, actorToken }),
    }))).toBe(true);
    expect(canUsePerk(makePerkItem({
      sourceId: GRID_SOLDIER_ID, actor: makeGridSoldierActor({ power: 0, actorToken }),
    }))).toBe(false);
  });

  test("removes Impaired from an Impaired ally within 5ft and spends 1 Power", async () => {
    const actorToken = makeToken();
    const targetToken = makeToken({ statuses: ['impaired'] });
    game.user.targets.first = jest.fn(() => targetToken);
    const actor = makeGridSoldierActor({ power: 1, actorToken });
    const item = makePerkItem({ sourceId: GRID_SOLDIER_ID, actor });

    await onPerkUse(item);

    expect(targetToken.actor.toggleStatusEffect).toHaveBeenCalledWith('impaired', { active: false });
    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("removes Impaired from the actor themselves when no target is set", async () => {
    const actorToken = makeToken({ statuses: ['impaired'] });
    game.user.targets.first = jest.fn(() => undefined);
    const actor = makeGridSoldierActor({ power: 1, actorToken });
    const item = makePerkItem({ sourceId: GRID_SOLDIER_ID, actor });

    await onPerkUse(item);

    expect(actorToken.actor.toggleStatusEffect).toHaveBeenCalledWith('impaired', { active: false });
    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
  });

  test("warns and spends nothing when the target isn't actually Impaired", async () => {
    const actorToken = makeToken();
    const targetToken = makeToken({ statuses: [] });
    game.user.targets.first = jest.fn(() => targetToken);
    const actor = makeGridSoldierActor({ power: 1, actorToken });
    const item = makePerkItem({ sourceId: GRID_SOLDIER_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("warns and spends nothing when the target is out of range or an enemy", async () => {
    const actorToken = makeToken({ disposition: 1 });
    const targetToken = makeToken({ disposition: -1, statuses: ['impaired'] });
    game.user.targets.first = jest.fn(() => targetToken);
    const actor = makeGridSoldierActor({ power: 1, actorToken });
    const item = makePerkItem({ sourceId: GRID_SOLDIER_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });
});

describe("Engine Override (Factions in Action Vol. 2, Engineer Troop Focus, 3rd level, p.72)", () => {
  const ENGINE_OVERRIDE_ID = "Compendium.essence20.intercontinental_adventures.Item.rouaWvDWhwCB5XEO";

  function makeVehicle() {
    const flagStore = {};
    return {
      type: 'vehicle',
      getFlag: jest.fn((scope, key) => flagStore[key]),
      setFlag: jest.fn(async (scope, key, value) => {
        flagStore[key] = value;
      }),
    };
  }

  beforeEach(() => {
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
    delete game.user.targets.first;
  });

  test("canUsePerk is always true", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: ENGINE_OVERRIDE_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("boosts the actor's own piloted vehicle and notifies", async () => {
    const pilotedVehicle = makeVehicle();
    const actor = { ...makeActor(), _dice: { _getPilotedVehicle: jest.fn(() => pilotedVehicle) } };
    const item = makePerkItem({ sourceId: ENGINE_OVERRIDE_ID, actor });

    await onPerkUse(item);

    expect(pilotedVehicle.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingEngineOverrideBoost', { round: null },
    );
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("falls back to the currently-targeted vehicle when not piloting one", async () => {
    const targetedVehicle = makeVehicle();
    const actor = { ...makeActor(), _dice: { _getPilotedVehicle: jest.fn(() => null) } };
    game.user.targets.first = jest.fn(() => ({ actor: targetedVehicle }));
    const item = makePerkItem({ sourceId: ENGINE_OVERRIDE_ID, actor });

    await onPerkUse(item);

    expect(targetedVehicle.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingEngineOverrideBoost', expect.anything(),
    );
  });

  test("warns with no piloted or targeted vehicle", async () => {
    const actor = { ...makeActor(), _dice: { _getPilotedVehicle: jest.fn(() => null) } };
    game.user.targets.first = jest.fn(() => undefined);
    const item = makePerkItem({ sourceId: ENGINE_OVERRIDE_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
  });
});

describe("Jury Rig (Factions in Action Vol. 2, Engineer Troop Focus, 17th level, p.73)", () => {
  const JURY_RIG_ID = "Compendium.essence20.intercontinental_adventures.Item.PV4QvqJgT1orMm1D";

  function makeVehicle() {
    return { type: 'vehicle', uuid: 'Actor.vehicle1', system: { threatLevel: 3 }, setFlag: jest.fn() };
  }

  beforeEach(() => {
    ui.notifications.warn.mockReset();
    delete game.user.targets.first;
  });

  test("canUsePerk is always true", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: JURY_RIG_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("picks a benefit and rolls Technology against the piloted vehicle", async () => {
    const pilotedVehicle = makeVehicle();
    const actor = { ...makeActor(), _dice: { _getPilotedVehicle: jest.fn(() => pilotedVehicle), rollSkill: jest.fn() } };
    foundry.applications.api.DialogV2.wait.mockResolvedValue({ option: 'hardenArmor', standardAction: false });
    const item = makePerkItem({ sourceId: JURY_RIG_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'technology', dif: '13', juryRigOption: 'hardenArmor' }),
      actor,
    );
  });

  test("warns with no piloted or targeted vehicle", async () => {
    const actor = { ...makeActor(), _dice: { _getPilotedVehicle: jest.fn(() => null), rollSkill: jest.fn() } };
    game.user.targets.first = jest.fn(() => undefined);
    foundry.applications.api.DialogV2.wait.mockResolvedValue({ option: 'hardenArmor', standardAction: false });
    const item = makePerkItem({ sourceId: JURY_RIG_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("silently does nothing when the picker is cancelled", async () => {
    const pilotedVehicle = makeVehicle();
    const actor = { ...makeActor(), _dice: { _getPilotedVehicle: jest.fn(() => pilotedVehicle), rollSkill: jest.fn() } };
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const item = makePerkItem({ sourceId: JURY_RIG_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).not.toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("Omega Enhancement [Form] (Across the Stars, General Perk, p.70)", () => {
  const OMEGA_ENHANCEMENT_ID = "Compendium.essence20.across_the_stars.Item.8GtRpU81iPJUCBEw";

  function makeOmegaActor({ power = 1 } = {}) {
    const flagStore = {};
    const actorToken = { document: { disposition: 1 }, center: {} };
    return {
      ...makeActor(),
      system: { powers: { personal: { value: power } } },
      update: jest.fn(async (data) => {
        actor.system.powers.personal.value = data['system.powers.personal.value'];
      }),
      getFlag: jest.fn((scope, key) => flagStore[key]),
      setFlag: jest.fn(async (scope, key, value) => {
        flagStore[key] = value; 
      }),
      getActiveTokens: jest.fn(() => [actorToken]),
      _dice: { rollSkill: jest.fn() },
    };
  }

  let actor;

  beforeEach(() => {
    canvas.tokens.placeables = [];
  });

  test("canUsePerk is true only with Power to spend", () => {
    actor = makeOmegaActor({ power: 1 });
    expect(canUsePerk(makePerkItem({ sourceId: OMEGA_ENHANCEMENT_ID, actor }))).toBe(true);

    actor = makeOmegaActor({ power: 0 });
    expect(canUsePerk(makePerkItem({ sourceId: OMEGA_ENHANCEMENT_ID, actor }))).toBe(false);
  });

  test("spends 1 Power and stamps Muscle Mode's own flag, then notifies", async () => {
    actor = makeOmegaActor({ power: 1 });
    foundry.applications.api.DialogV2.wait.mockResolvedValue({ option: 'muscle', essence: null });
    const item = makePerkItem({ sourceId: OMEGA_ENHANCEMENT_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'omegaEnhancementMuscleThisTurn', expect.anything());
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("doesn't notify when the picker is cancelled or Power is unaffordable", async () => {
    actor = makeOmegaActor({ power: 1 });
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    global.ChatMessage.create.mockReset();

    await onPerkUse(makePerkItem({ sourceId: OMEGA_ENHANCEMENT_ID, actor }));

    expect(global.ChatMessage.create).not.toHaveBeenCalled();
  });
});

describe("Improvise Armor (Factions in Action Vol. 2, Engineer Troop Focus, 3rd level, p.73)", () => {
  const IMPROVISE_ARMOR_ID = "Compendium.essence20.intercontinental_adventures.Item.P9JXwQ2991e1Bw1G";

  function makeVehicle() {
    return { type: 'vehicle', uuid: 'Actor.vehicle1', system: { health: { bonus: 0 } }, update: jest.fn() };
  }

  beforeEach(() => {
    ui.notifications.warn.mockReset();
  });

  test("canUsePerk is true before use this scene", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: IMPROVISE_ARMOR_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("rolls Technology against the piloted vehicle and marks used this scene", async () => {
    const pilotedVehicle = makeVehicle();
    const actor = { ...makeActor(), _dice: { _getPilotedVehicle: jest.fn(() => pilotedVehicle), rollSkill: jest.fn() } };
    const item = makePerkItem({ sourceId: IMPROVISE_ARMOR_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'technology', isImproviseArmorAttempt: true }),
      actor,
    );
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'improviseArmorUsedThisEncounter', expect.anything());
  });

  test("warns with no piloted or targeted vehicle, without spending the once-per-scene use", async () => {
    const actor = { ...makeActor(), _dice: { _getPilotedVehicle: jest.fn(() => null), rollSkill: jest.fn() } };
    game.user.targets.first = jest.fn(() => undefined);
    const item = makePerkItem({ sourceId: IMPROVISE_ARMOR_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalledWith('essence20', 'improviseArmorUsedThisEncounter', expect.anything());
  });
});

describe("Like Water (Factions in Action Vol. 2, General Perk, p.30)", () => {
  const LIKE_WATER_ID = "Compendium.essence20.intercontinental_adventures.Item.HSjShnVmoDdzEDT1";

  beforeEach(() => {
    global.ChatMessage.create.mockReset();
  });

  test("canUsePerk is true with both options available", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: LIKE_WATER_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("canUsePerk is false once both options are used", () => {
    const actor = makeActor();
    actor.getFlag = jest.fn(() => true);
    const item = makePerkItem({ sourceId: LIKE_WATER_ID, actor });
    expect(canUsePerk(item)).toBe(false);
  });

  test("activates the chosen option and posts a chat card", async () => {
    const actor = makeActor();
    foundry.applications.api.DialogV2.wait.mockResolvedValue('toughness');
    const item = makePerkItem({ sourceId: LIKE_WATER_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'likeWaterToughnessActive', true);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("does nothing when the picker is cancelled", async () => {
    const actor = makeActor();
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const item = makePerkItem({ sourceId: LIKE_WATER_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(global.ChatMessage.create).not.toHaveBeenCalled();
  });
});

describe("Martial Leadership (Enigma of Combination, General Perk, p.41)", () => {
  const MARTIAL_LEADERSHIP_ID = "Compendium.essence20.enigma_of_combination.Item.6dRdxCRjWqjrt8Wc";

  beforeEach(() => {
    ui.notifications.warn.mockReset();
    delete game.user.targets.first;
  });

  test("canUsePerk is always true", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: MARTIAL_LEADERSHIP_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("rolls Persuasion against the currently-targeted actor", async () => {
    const actor = { ...makeActor(), _dice: { rollSkill: jest.fn() } };
    const targetActor = { uuid: 'Actor.target1' };
    game.user.targets.first = jest.fn(() => ({ actor: targetActor }));
    const item = makePerkItem({ sourceId: MARTIAL_LEADERSHIP_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'persuasion', defenseType: 'cleverness' }),
      actor,
    );
  });

  test("warns with no target selected", async () => {
    const actor = { ...makeActor(), _dice: { rollSkill: jest.fn() } };
    game.user.targets.first = jest.fn(() => undefined);
    const item = makePerkItem({ sourceId: MARTIAL_LEADERSHIP_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("Voice of Primus (Enigma of Combination, General Perk, p.41)", () => {
  const VOICE_OF_PRIMUS_ID = "Compendium.essence20.enigma_of_combination.Item.m8oHzT4BUB79NiVw";

  beforeEach(() => {
    ui.notifications.warn.mockReset();
    delete game.user.targets.first;
  });

  test("canUsePerk is always true", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: VOICE_OF_PRIMUS_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("rolls the chosen skill against the currently-targeted actor", async () => {
    const actor = { ...makeActor(), _dice: { rollSkill: jest.fn() } };
    const targetActor = { uuid: 'Actor.target1' };
    game.user.targets.first = jest.fn(() => ({ actor: targetActor }));
    foundry.applications.api.DialogV2.wait.mockResolvedValue('intimidation');
    const item = makePerkItem({ sourceId: VOICE_OF_PRIMUS_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'intimidation', defenseType: 'willpower' }),
      actor,
    );
  });

  test("warns with no target selected", async () => {
    const actor = { ...makeActor(), _dice: { rollSkill: jest.fn() } };
    game.user.targets.first = jest.fn(() => undefined);
    foundry.applications.api.DialogV2.wait.mockResolvedValue('intimidation');
    const item = makePerkItem({ sourceId: VOICE_OF_PRIMUS_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("does nothing when the skill picker is cancelled", async () => {
    const actor = { ...makeActor(), _dice: { rollSkill: jest.fn() } };
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const item = makePerkItem({ sourceId: VOICE_OF_PRIMUS_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).not.toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("Words Can Hurt! (Enigma of Combination, Counselor Focus, 6th level, p.34)", () => {
  const WORDS_CAN_HURT_ID = "Compendium.essence20.enigma_of_combination.Item.SBoujesTRdI7IpmM";

  beforeEach(() => {
    ui.notifications.warn.mockReset();
    delete game.user.targets.first;
  });

  test("canUsePerk is always true", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: WORDS_CAN_HURT_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("rolls the chosen skill/Defense against the currently-targeted actor", async () => {
    const actor = { ...makeActor(), _dice: { rollSkill: jest.fn() } };
    const targetActor = { uuid: 'Actor.target1', getFlag: jest.fn(() => undefined) };
    game.user.targets.first = jest.fn(() => ({ actor: targetActor }));
    foundry.applications.api.DialogV2.wait.mockResolvedValue({ skill: 'persuasion', defenseType: 'cleverness' });
    const item = makePerkItem({ sourceId: WORDS_CAN_HURT_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'persuasion', defenseType: 'cleverness' }),
      actor,
    );
  });

  test("warns with no target selected", async () => {
    const actor = { ...makeActor(), _dice: { rollSkill: jest.fn() } };
    game.user.targets.first = jest.fn(() => undefined);
    const item = makePerkItem({ sourceId: WORDS_CAN_HURT_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("warns and rolls nothing against an already-immune target", async () => {
    const actor = { ...makeActor(), _dice: { rollSkill: jest.fn() } };
    const targetActor = { uuid: 'Actor.target1', getFlag: jest.fn(() => true) };
    game.user.targets.first = jest.fn(() => ({ actor: targetActor }));
    const item = makePerkItem({ sourceId: WORDS_CAN_HURT_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("does nothing when the options picker is cancelled", async () => {
    const actor = { ...makeActor(), _dice: { rollSkill: jest.fn() } };
    const targetActor = { uuid: 'Actor.target1', getFlag: jest.fn(() => undefined) };
    game.user.targets.first = jest.fn(() => ({ actor: targetActor }));
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const item = makePerkItem({ sourceId: WORDS_CAN_HURT_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).not.toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("Calming Words (Enigma of Combination, Counselor Focus, 3rd level, p.34)", () => {
  const CALMING_WORDS_ID = "Compendium.essence20.enigma_of_combination.Item.r3slLsGwSfXUiD94";

  function makeCalmingWordsActor({ energon = 1 } = {}) {
    return {
      ...makeActor(), _dice: { rollSkill: jest.fn() },
      system: { energon: { normal: { value: energon } } }, update: jest.fn(),
    };
  }

  beforeEach(() => {
    ui.notifications.warn.mockReset();
    delete game.user.targets.first;
  });

  test("canUsePerk is always true", () => {
    const actor = makeCalmingWordsActor();
    const item = makePerkItem({ sourceId: CALMING_WORDS_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("rolls Persuasion against the currently-targeted actor", async () => {
    const actor = makeCalmingWordsActor();
    const targetActor = { uuid: 'Actor.target1' };
    game.user.targets.first = jest.fn(() => ({ actor: targetActor }));
    foundry.applications.api.DialogV2.wait.mockResolvedValue({ action: 'soothe', defenseType: 'willpower' });
    const item = makePerkItem({ sourceId: CALMING_WORDS_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'persuasion', defenseType: 'willpower', calmingWordsAction: 'soothe' }),
      actor,
    );
  });

  test("warns with no target selected", async () => {
    const actor = makeCalmingWordsActor();
    game.user.targets.first = jest.fn(() => undefined);
    const item = makePerkItem({ sourceId: CALMING_WORDS_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("warns and rolls nothing for a cure attempt without Energon", async () => {
    const actor = makeCalmingWordsActor({ energon: 0 });
    const targetActor = { uuid: 'Actor.target1' };
    game.user.targets.first = jest.fn(() => ({ actor: targetActor }));
    foundry.applications.api.DialogV2.wait.mockResolvedValue({ action: 'cure', defenseType: 'willpower' });
    const item = makePerkItem({ sourceId: CALMING_WORDS_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("does nothing when the options picker is cancelled", async () => {
    const actor = makeCalmingWordsActor();
    const targetActor = { uuid: 'Actor.target1' };
    game.user.targets.first = jest.fn(() => ({ actor: targetActor }));
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const item = makePerkItem({ sourceId: CALMING_WORDS_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).not.toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("Powerful Suggestions (Enigma of Combination, Counselor Focus, 17th level, p.34)", () => {
  const POWERFUL_SUGGESTIONS_ID = "Compendium.essence20.enigma_of_combination.Item.QRGflsYQcDN16l10";

  beforeEach(() => {
    ui.notifications.warn.mockReset();
    delete game.user.targets.first;
  });

  test("canUsePerk is always true", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: POWERFUL_SUGGESTIONS_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("banks the chosen skill/effect on the currently-targeted actor", async () => {
    const actor = makeActor();
    const targetActor = { getFlag: jest.fn(() => undefined), setFlag: jest.fn() };
    game.user.targets.first = jest.fn(() => ({ actor: targetActor }));
    foundry.applications.api.DialogV2.wait.mockResolvedValue({ skill: 'athletics', effect: 'excel' });
    const item = makePerkItem({ sourceId: POWERFUL_SUGGESTIONS_ID, actor });

    await onPerkUse(item);

    expect(targetActor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingPowerfulSuggestion', expect.objectContaining({ skill: 'athletics', effect: 'excel' }),
    );
  });

  test("warns with no target selected", async () => {
    const actor = makeActor();
    game.user.targets.first = jest.fn(() => undefined);
    const item = makePerkItem({ sourceId: POWERFUL_SUGGESTIONS_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
  });
});

describe("Data Bridge (Enigma of Combination, Hub Focus, Analyst, 1st level, p.29)", () => {
  const DATA_BRIDGE_ID = "Compendium.essence20.enigma_of_combination.Item.uLtZ0zbfx0K4jcSK";

  const realCanvas = global.canvas;

  beforeEach(() => {
    ui.notifications.warn.mockReset();
    global.canvas = { tokens: { placeables: [] }, grid: { measurePath: jest.fn(() => ({ distance: 0 })) } };
  });

  afterEach(() => {
    global.canvas = realCanvas;
  });

  function makeAllyToken(_actorToken) {
    return {
      document: { disposition: 1 },
      center: {},
      actor: {
        name: 'Perceptor', system: { skills: { culture: { specializations: { arcane: { name: 'Arcane Lore' } } } } },
        getFlag: jest.fn(() => undefined), setFlag: jest.fn(),
      },
    };
  }

  test("canUsePerk is false with no Specialization available on the scene", () => {
    const actor = makeActor();
    actor.getActiveTokens = jest.fn(() => [{ document: { disposition: 1 }, center: {} }]);
    canvas.tokens.placeables = [...actor.getActiveTokens()];
    const item = makePerkItem({ sourceId: DATA_BRIDGE_ID, actor });
    expect(canUsePerk(item)).toBe(false);
  });

  test("canUsePerk is true with a Specialization available and not yet used this turn", () => {
    const actor = makeActor();
    const actorToken = { document: { disposition: 1 }, center: {} };
    actor.getActiveTokens = jest.fn(() => [actorToken]);
    canvas.tokens.placeables = [actorToken, makeAllyToken(actorToken)];
    const item = makePerkItem({ sourceId: DATA_BRIDGE_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("borrows the chosen Specialization and posts a chat card", async () => {
    const actor = makeActor();
    const actorToken = { document: { disposition: 1 }, center: {} };
    actor.getActiveTokens = jest.fn(() => [actorToken]);
    canvas.tokens.placeables = [actorToken, makeAllyToken(actorToken)];
    foundry.applications.api.DialogV2.wait.mockResolvedValue('0');
    const item = makePerkItem({ sourceId: DATA_BRIDGE_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'pendingDataBridgeSpecialization', expect.objectContaining({ skill: 'culture', name: 'Arcane Lore' }));
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });
});

describe("Misery Loves Company (Enigma of Combination, Hub Focus, Analyst, 17th level, p.29)", () => {
  const MISERY_LOVES_COMPANY_ID = "Compendium.essence20.enigma_of_combination.Item.JJ8ffuxjYeXJ9KJ2";

  const realCanvas = global.canvas;

  beforeEach(() => {
    ui.notifications.warn.mockReset();
    global.canvas = { tokens: { placeables: [] }, grid: { measurePath: jest.fn(() => ({ distance: 0 })) } };
  });

  afterEach(() => {
    global.canvas = realCanvas;
  });

  function makeMiseryActor({ energon = 1, statuses = [] } = {}) {
    const actor = { ...makeActor(), system: { energon: { normal: { value: energon } } }, statuses: new Set(statuses), update: jest.fn(), toggleStatusEffect: jest.fn() };
    const actorToken = { document: { disposition: 1 }, center: {}, actor };
    actor.getActiveTokens = jest.fn(() => [actorToken]);
    canvas.tokens.placeables = [actorToken];
    return actor;
  }

  test("canUsePerk is false with no Energon to spend", () => {
    const actor = makeMiseryActor({ energon: 0, statuses: ['frightened'] });
    const item = makePerkItem({ sourceId: MISERY_LOVES_COMPANY_ID, actor });
    expect(canUsePerk(item)).toBe(false);
  });

  test("canUsePerk is false with nothing eligible even with Energon to spend", () => {
    const actor = makeMiseryActor({ energon: 1 });
    const item = makePerkItem({ sourceId: MISERY_LOVES_COMPANY_ID, actor });
    expect(canUsePerk(item)).toBe(false);
  });

  test("canUsePerk is true with Energon, an afflicted ally, and a Data-Bridged recipient", () => {
    const actor = makeMiseryActor({ energon: 1, statuses: ['frightened'] });
    actor.getFlag = jest.fn((scope, key) => (key == 'pendingDataBridgeSpecialization' ? { skill: 'culture' } : undefined));
    const item = makePerkItem({ sourceId: MISERY_LOVES_COMPANY_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("transfers the Condition and spends 1 Energon", async () => {
    const actor = makeMiseryActor({ energon: 2, statuses: ['frightened'] });
    const allyActor = { name: 'Ally', getFlag: jest.fn(() => ({ skill: 'culture' })), toggleStatusEffect: jest.fn() };
    const allyToken = { document: { disposition: 1 }, center: {}, actor: allyActor };
    canvas.tokens.placeables.push(allyToken);
    foundry.applications.api.DialogV2.wait.mockResolvedValue({ affected: '0', bridged: '0' });
    const item = makePerkItem({ sourceId: MISERY_LOVES_COMPANY_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.energon.normal.value': 1 });
    expect(allyActor.toggleStatusEffect).toHaveBeenCalledWith('frightened', { active: true });
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });
});

describe("Powered Plating (A Jump Through Time, Orange Ranger, Modified Shell I option, p.32)", () => {
  const POWERED_PLATING_ID = "Compendium.essence20.jump_through_time.Item.45WHjwO125zTvuGR";

  function makePoweredPlatingActor({ isMorphed = true, power = 4 } = {}) {
    return {
      ...makeActor(),
      system: { isMorphed, powers: { personal: { value: power } } },
      update: jest.fn(),
    };
  }

  beforeEach(() => {
    global.ChatMessage.create.mockReset();
    foundry.applications.api.DialogV2.wait.mockReset();
  });

  test("canUsePerk is true only while Morphed with Power to spend", () => {
    expect(canUsePerk(makePerkItem({
      sourceId: POWERED_PLATING_ID, actor: makePoweredPlatingActor({ isMorphed: true, power: 1 }),
    }))).toBe(true);
    expect(canUsePerk(makePerkItem({
      sourceId: POWERED_PLATING_ID, actor: makePoweredPlatingActor({ isMorphed: false, power: 1 }),
    }))).toBe(false);
    expect(canUsePerk(makePerkItem({
      sourceId: POWERED_PLATING_ID, actor: makePoweredPlatingActor({ isMorphed: true, power: 0 }),
    }))).toBe(false);
  });

  test("spends the chosen amount, banks it, and notifies", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue(3);
    const actor = makePoweredPlatingActor({ power: 4 });
    const item = makePerkItem({ sourceId: POWERED_PLATING_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 1 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'poweredPlatingBonus', 3);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("doesn't notify when the picker is cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makePoweredPlatingActor({ power: 4 });
    const item = makePerkItem({ sourceId: POWERED_PLATING_ID, actor });

    await onPerkUse(item);

    expect(actor.update).not.toHaveBeenCalled();
    expect(global.ChatMessage.create).not.toHaveBeenCalled();
  });
});

describe("Explosive Morph (A Jump Through Time, Quantum Ranger, Quantum Power option, p.45)", () => {
  const EXPLOSIVE_MORPH_ID = "Compendium.essence20.jump_through_time.Item.ExplosiveMorphJT";

  function makeExplosiveMorphActor({ isMorphed = true, power = 1 } = {}) {
    return {
      ...makeActor(),
      system: { isMorphed, powers: { personal: { value: power } } },
      update: jest.fn(),
      getActiveTokens: jest.fn(() => []),
      _dice: { rollSkill: jest.fn() },
    };
  }

  beforeEach(() => {
    ui.notifications.warn.mockReset();
  });

  test("canUsePerk is true only while Morphed with Power to spend", () => {
    expect(canUsePerk(makePerkItem({
      sourceId: EXPLOSIVE_MORPH_ID, actor: makeExplosiveMorphActor({ isMorphed: true, power: 1 }),
    }))).toBe(true);
    expect(canUsePerk(makePerkItem({
      sourceId: EXPLOSIVE_MORPH_ID, actor: makeExplosiveMorphActor({ isMorphed: false, power: 1 }),
    }))).toBe(false);
    expect(canUsePerk(makePerkItem({
      sourceId: EXPLOSIVE_MORPH_ID, actor: makeExplosiveMorphActor({ isMorphed: true, power: 0 }),
    }))).toBe(false);
  });

  test("spends 1 Power and triggers the roll", async () => {
    const actor = makeExplosiveMorphActor({ power: 1 });
    const item = makePerkItem({ sourceId: EXPLOSIVE_MORPH_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(actor._dice.rollSkill).toHaveBeenCalled();
  });

  test("warns and does nothing when not Morphed or unaffordable", async () => {
    const actor = makeExplosiveMorphActor({ isMorphed: false, power: 1 });
    const item = makePerkItem({ sourceId: EXPLOSIVE_MORPH_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("Eltarian Mettle (Through the Shattered Grid, Guardian of Eltar, 7th level, p.72)", () => {
  const ELTARIAN_METTLE_ID = "Compendium.essence20.through_the_shattered_grid.Item.bDgQ7jyTgisY42kt";

  function makeEltarianMettleActor({ power = 1, statuses = ['frightened'] } = {}) {
    return {
      ...makeActor(),
      system: { powers: { personal: { value: power } } },
      update: jest.fn(),
      statuses: new Set(statuses),
      toggleStatusEffect: jest.fn(),
    };
  }

  beforeEach(() => {
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
    foundry.applications.api.DialogV2.wait.mockReset();
  });

  test("canUsePerk is true only with Power to spend", () => {
    expect(canUsePerk(makePerkItem({
      sourceId: ELTARIAN_METTLE_ID, actor: makeEltarianMettleActor({ power: 1 }),
    }))).toBe(true);
    expect(canUsePerk(makePerkItem({
      sourceId: ELTARIAN_METTLE_ID, actor: makeEltarianMettleActor({ power: 0 }),
    }))).toBe(false);
  });

  test("removes the chosen Condition and spends 1 Power", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('frightened');
    const actor = makeEltarianMettleActor({ power: 1, statuses: ['frightened'] });
    const item = makePerkItem({ sourceId: ELTARIAN_METTLE_ID, actor });

    await onPerkUse(item);

    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('frightened', { active: false });
    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("spends nothing when the picker is cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeEltarianMettleActor({ power: 1, statuses: ['frightened'] });
    const item = makePerkItem({ sourceId: ELTARIAN_METTLE_ID, actor });

    await onPerkUse(item);

    expect(actor.update).not.toHaveBeenCalled();
    expect(global.ChatMessage.create).not.toHaveBeenCalled();
  });

  test("warns and does nothing when unaffordable", async () => {
    const actor = makeEltarianMettleActor({ power: 0 });
    const item = makePerkItem({ sourceId: ELTARIAN_METTLE_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });
});

describe("Balance and Harmony (Factions in Action Vol. 2, Arashikage Faction Perk, p.9)", () => {
  const BALANCE_AND_HARMONY_ID = "Compendium.essence20.intercontinental_adventures.Item.YydXnrEdfZpl6DU6";

  function makeBalanceAndHarmonyActor({ statuses = ['frightened'] } = {}) {
    const flagStore = {};
    return {
      ...makeActor(),
      statuses: new Set(statuses),
      toggleStatusEffect: jest.fn(),
      getFlag: jest.fn((scope, key) => flagStore[key]),
      setFlag: jest.fn(async (scope, key, value) => {
        flagStore[key] = value;
      }),
    };
  }

  beforeEach(() => {
    global.ChatMessage.create.mockReset();
    foundry.applications.api.DialogV2.wait.mockReset();
  });

  test("canUsePerk is true when not yet used this scene", () => {
    expect(canUsePerk(makePerkItem({
      sourceId: BALANCE_AND_HARMONY_ID, actor: makeBalanceAndHarmonyActor(),
    }))).toBe(true);
  });

  test("removes the chosen Condition and notifies", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('frightened');
    const actor = makeBalanceAndHarmonyActor({ statuses: ['frightened'] });
    const item = makePerkItem({ sourceId: BALANCE_AND_HARMONY_ID, actor });

    await onPerkUse(item);

    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('frightened', { active: false });
    expect(global.ChatMessage.create).toHaveBeenCalled();
    expect(canUsePerk(item)).toBe(false);
  });

  test("does nothing when the picker is cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeBalanceAndHarmonyActor({ statuses: ['frightened'] });
    const item = makePerkItem({ sourceId: BALANCE_AND_HARMONY_ID, actor });

    await onPerkUse(item);

    expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
    expect(global.ChatMessage.create).not.toHaveBeenCalled();
  });
});

describe("Nu, Pogodi!'s own condition-removal clause (Factions in Action Vol. 2, Oktober Guard Faction Perk, p.68)", () => {
  const NU_POGODI_ID = "Compendium.essence20.intercontinental_adventures.Item.sItc8nD7ockbQ1mn";

  function makeNuPogodiActor({ statuses = ['frightened'] } = {}) {
    const flagStore = {};
    return {
      ...makeActor(),
      statuses: new Set(statuses),
      toggleStatusEffect: jest.fn(),
      getFlag: jest.fn((scope, key) => flagStore[key]),
      setFlag: jest.fn(async (scope, key, value) => {
        flagStore[key] = value;
      }),
    };
  }

  beforeEach(() => {
    global.ChatMessage.create.mockReset();
    foundry.applications.api.DialogV2.wait.mockReset();
    game.combat = { id: 'combat1' };
  });

  afterEach(() => {
    game.combat = null;
  });

  test("canUsePerk is true when not yet used this encounter", () => {
    expect(canUsePerk(makePerkItem({
      sourceId: NU_POGODI_ID, actor: makeNuPogodiActor(),
    }))).toBe(true);
  });

  test("removes the chosen Condition and notifies", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('frightened');
    const actor = makeNuPogodiActor({ statuses: ['frightened'] });
    const item = makePerkItem({ sourceId: NU_POGODI_ID, actor });

    await onPerkUse(item);

    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('frightened', { active: false });
    expect(global.ChatMessage.create).toHaveBeenCalled();
    expect(canUsePerk(item)).toBe(false);
  });
});

describe("The Quiet One (Factions in Action Vol. 2, Dreadnok General Perk, p.63)", () => {
  const THE_QUIET_ONE_ID = "Compendium.essence20.intercontinental_adventures.Item.eKmiGE7NChwZ2E96";

  function makeQuietOneActor(id) {
    const flagStore = {};
    const token = { document: { disposition: 1 } };
    return {
      ...makeActor({ id }),
      getActiveTokens: jest.fn(() => [token]),
      getFlag: jest.fn((scope, key) => flagStore[key]),
      setFlag: jest.fn(async (scope, key, value) => {
        flagStore[key] = value;
      }),
    };
  }

  beforeEach(() => {
    global.ChatMessage.create.mockReset();
    game.combat = { id: 'combat1', round: 1, turn: 0, combatants: [] };
  });

  afterEach(() => {
    game.combat = null;
  });

  test("canUsePerk is true only with a noisy ally this round", async () => {
    const holder = makeQuietOneActor('holder1');
    const ally = makeQuietOneActor('ally1');
    game.combat.combatants = [{ actor: holder, token: { disposition: 1 } }, { actor: ally, token: { disposition: 1 } }];

    expect(canUsePerk(makePerkItem({ sourceId: THE_QUIET_ONE_ID, actor: holder }))).toBe(false);

    ally.setFlag('essence20', 'quietOneNoisyActionThisRound', { combatId: 'combat1', round: 1 });
    expect(canUsePerk(makePerkItem({ sourceId: THE_QUIET_ONE_ID, actor: holder }))).toBe(true);
  });

  test("banks the Edge and notifies", async () => {
    const holder = makeQuietOneActor('holder1');
    const ally = makeQuietOneActor('ally1');
    game.combat.combatants = [{ actor: holder, token: { disposition: 1 } }, { actor: ally, token: { disposition: 1 } }];
    await ally.setFlag('essence20', 'quietOneNoisyActionThisRound', { combatId: 'combat1', round: 1 });
    const item = makePerkItem({ sourceId: THE_QUIET_ONE_ID, actor: holder });

    await onPerkUse(item);

    expect(holder.setFlag).toHaveBeenCalledWith('essence20', 'quietOneEdgeActive', { combatId: 'combat1', round: 1, turn: 0 });
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("does nothing without a noisy ally", async () => {
    const holder = makeQuietOneActor('holder1');
    game.combat.combatants = [{ actor: holder, token: { disposition: 1 } }];
    const item = makePerkItem({ sourceId: THE_QUIET_ONE_ID, actor: holder });

    await onPerkUse(item);

    expect(global.ChatMessage.create).not.toHaveBeenCalled();
  });
});

describe("Venom Warlord (Finster's Monster-Matic Cookbook, 20th level, p.300) - Condition removal", () => {
  const VENOM_WARLORD_ID = "Compendium.essence20.finster_s_monster_matic_cookbook.Item.9tU5tDmpOhChLfdv";

  function makeVenomWarlordActor({ power = 1, statuses = ['frightened'] } = {}) {
    return {
      ...makeActor(),
      system: { powers: { personal: { value: power } } },
      update: jest.fn(),
      statuses: new Set(statuses),
      toggleStatusEffect: jest.fn(),
    };
  }

  beforeEach(() => {
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
    foundry.applications.api.DialogV2.wait.mockReset();
  });

  test("canUsePerk is true only with Power to spend", () => {
    expect(canUsePerk(makePerkItem({
      sourceId: VENOM_WARLORD_ID, actor: makeVenomWarlordActor({ power: 1 }),
    }))).toBe(true);
    expect(canUsePerk(makePerkItem({
      sourceId: VENOM_WARLORD_ID, actor: makeVenomWarlordActor({ power: 0 }),
    }))).toBe(false);
  });

  test("removes the chosen Condition and spends 1 Power", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('frightened');
    const actor = makeVenomWarlordActor({ power: 1, statuses: ['frightened'] });
    const item = makePerkItem({ sourceId: VENOM_WARLORD_ID, actor });

    await onPerkUse(item);

    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('frightened', { active: false });
    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("warns and does nothing when unaffordable", async () => {
    const actor = makeVenomWarlordActor({ power: 0 });
    const item = makePerkItem({ sourceId: VENOM_WARLORD_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });
});

describe("Wisdom of the Elders (Through the Shattered Grid, Guardian of Eltar, 9th/18th level, p.72)", () => {
  const WISDOM_OF_THE_ELDERS_ID = "Compendium.essence20.through_the_shattered_grid.Item.SB6FAYA0qIqV9F3G";

  function makeWisdomActor({ power = 2, eltarianTech = 2, active = {} } = {}) {
    const rolePoints = { system: { resource: { value: eltarianTech } }, update: jest.fn() };
    return {
      ...makeActor(),
      system: { powers: { personal: { value: power } } },
      update: jest.fn(),
      getFlag: jest.fn(() => active),
      _getBaseRolePoints: jest.fn(() => rolePoints),
      __rolePoints: rolePoints,
    };
  }

  beforeEach(() => {
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
  });

  test("canUsePerk is false with no choice recorded yet", () => {
    const actor = makeWisdomActor();
    const item = makePerkItem({ sourceId: WISDOM_OF_THE_ELDERS_ID, actor });
    item.system.choice = null;
    expect(canUsePerk(item)).toBe(false);
  });

  test("canUsePerk reflects the chosen option's own affordability", () => {
    const item = makePerkItem({ sourceId: WISDOM_OF_THE_ELDERS_ID, actor: makeWisdomActor({ power: 1 }) });
    item.system.choice = 'lightshieldArmor';
    expect(canUsePerk(item)).toBe(true);

    const poorItem = makePerkItem({ sourceId: WISDOM_OF_THE_ELDERS_ID, actor: makeWisdomActor({ power: 0 }) });
    poorItem.system.choice = 'lightshieldArmor';
    expect(canUsePerk(poorItem)).toBe(false);
  });

  test("toggles the chosen non-Teleportation option on and notifies", async () => {
    const actor = makeWisdomActor({ power: 2 });
    const item = makePerkItem({ sourceId: WISDOM_OF_THE_ELDERS_ID, actor });
    item.system.choice = 'lightshieldArmor';

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 1 });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'wisdomOfTheEldersActive', { lightshieldArmor: true },
    );
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("Teleportation spends the cost and notifies without setting any flag", async () => {
    const actor = makeWisdomActor({ eltarianTech: 1 });
    const item = makePerkItem({ sourceId: WISDOM_OF_THE_ELDERS_ID, actor });
    item.system.choice = 'teleportation';

    await onPerkUse(item);

    expect(actor.__rolePoints.update).toHaveBeenCalledWith({ 'system.resource.value': 0 });
    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("warns and does nothing when unaffordable", async () => {
    const actor = makeWisdomActor({ power: 0 });
    const item = makePerkItem({ sourceId: WISDOM_OF_THE_ELDERS_ID, actor });
    item.system.choice = 'lightshieldArmor';

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });
});

describe("Observer (Through the Shattered Grid, Guardian of Eltar, 10th level, p.72)", () => {
  const OBSERVER_ID = "Compendium.essence20.through_the_shattered_grid.Item.PTkqeQ8D4x9cstlZ";

  function makeObserverActor({ power = 1, active = false } = {}) {
    const flagStore = { observerDisguiseActive: active };
    return {
      ...makeActor(),
      system: { powers: { personal: { value: power } } },
      update: jest.fn(),
      getFlag: jest.fn((scope, key) => flagStore[key]),
      setFlag: jest.fn((scope, key, value) => {
        flagStore[key] = value; 
      }),
    };
  }

  beforeEach(() => {
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
  });

  test("canUsePerk is always usable to switch back OFF, only needs Power to switch ON", () => {
    expect(canUsePerk(makePerkItem({ sourceId: OBSERVER_ID, actor: makeObserverActor({ power: 0, active: true }) }))).toBe(true);
    expect(canUsePerk(makePerkItem({ sourceId: OBSERVER_ID, actor: makeObserverActor({ power: 1, active: false }) }))).toBe(true);
    expect(canUsePerk(makePerkItem({ sourceId: OBSERVER_ID, actor: makeObserverActor({ power: 0, active: false }) }))).toBe(false);
  });

  test("switching ON spends 1 Power and notifies", async () => {
    const actor = makeObserverActor({ power: 1, active: false });
    const item = makePerkItem({ sourceId: OBSERVER_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("warns and does nothing when unaffordable", async () => {
    const actor = makeObserverActor({ power: 0, active: false });
    const item = makePerkItem({ sourceId: OBSERVER_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });
});

describe("Perfect Disguise (GI Joe CRB, Spy Focus, 10th level, p.76)", () => {
  const PERFECT_DISGUISE_ID = "Compendium.essence20.gi_joe_crb.Item.ELktMVNYsiBPTX2c";

  function makePerfectDisguiseActor({ active = false, usedThisEncounter = false } = {}) {
    const flagStore = {
      perfectDisguiseActive: active,
      perfectDisguiseUsedThisEncounter: usedThisEncounter ? { combatId: 'combat1' } : undefined,
    };
    return {
      ...makeActor(),
      getFlag: jest.fn((scope, key) => flagStore[key]),
      setFlag: jest.fn((scope, key, value) => {
        flagStore[key] = value; 
      }),
    };
  }

  beforeEach(() => {
    game.combat = { id: 'combat1' };
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
  });

  afterEach(() => {
    game.combat = null;
  });

  test("canUsePerk is always usable to switch back OFF, only blocked switching ON once used this encounter", () => {
    expect(canUsePerk(makePerkItem({
      sourceId: PERFECT_DISGUISE_ID, actor: makePerfectDisguiseActor({ active: true, usedThisEncounter: true }),
    }))).toBe(true);
    expect(canUsePerk(makePerkItem({
      sourceId: PERFECT_DISGUISE_ID, actor: makePerfectDisguiseActor({ active: false, usedThisEncounter: false }),
    }))).toBe(true);
    expect(canUsePerk(makePerkItem({
      sourceId: PERFECT_DISGUISE_ID, actor: makePerfectDisguiseActor({ active: false, usedThisEncounter: true }),
    }))).toBe(false);
  });

  test("switching ON marks the encounter used and notifies", async () => {
    const actor = makePerfectDisguiseActor({ active: false });
    const item = makePerkItem({ sourceId: PERFECT_DISGUISE_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'perfectDisguiseActive', true);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("warns and does nothing once already used this encounter", async () => {
    const actor = makePerfectDisguiseActor({ active: false, usedThisEncounter: true });
    const item = makePerkItem({ sourceId: PERFECT_DISGUISE_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(global.ChatMessage.create).not.toHaveBeenCalled();
  });
});

describe("Supreme Guardian (Through the Shattered Grid, Guardian of Eltar, 20th level, p.73)", () => {
  const SUPREME_GUARDIAN_ID = "Compendium.essence20.through_the_shattered_grid.Item.wrBndkBQoKkn3dLy";

  function makeSupremeGuardianActor({ isMorphed = true } = {}) {
    return {
      ...makeActor(),
      system: { isMorphed },
      getActiveTokens: jest.fn(() => []),
      _dice: { rollSkill: jest.fn() },
    };
  }

  test("canUsePerk is true only while Morphed", () => {
    expect(canUsePerk(makePerkItem({
      sourceId: SUPREME_GUARDIAN_ID, actor: makeSupremeGuardianActor({ isMorphed: true }),
    }))).toBe(true);
    expect(canUsePerk(makePerkItem({
      sourceId: SUPREME_GUARDIAN_ID, actor: makeSupremeGuardianActor({ isMorphed: false }),
    }))).toBe(false);
  });

  test("triggers the AoE roll, no Power cost", async () => {
    const actor = makeSupremeGuardianActor();
    const item = makePerkItem({ sourceId: SUPREME_GUARDIAN_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'technology', essence: 'smarts', defenseType: 'toughness', isSupremeGuardianBlind: true }),
      actor,
    );
  });
});

describe("Combat Stance (Through the Shattered Grid, Magna Defender, 1st level, p.23-24)", () => {
  const COMBAT_STANCE_ID = "Compendium.essence20.through_the_shattered_grid.Item.R2C760BXAI1XKVtm";

  function makeTargetsSet(targetActor) {
    const token = { actor: targetActor };
    const set = new Set([token]);
    set.first = () => token;

    return set;
  }

  function makeCombatStanceActor({ level = 5, usedThisEncounter = false } = {}) {
    const flagStore = { combatStanceUsedThisEncounter: usedThisEncounter ? { combatId: 'combat1' } : undefined };
    return {
      ...makeActor(),
      system: { level },
      getFlag: jest.fn((scope, key) => flagStore[key]),
      setFlag: jest.fn((scope, key, value) => {
        flagStore[key] = value; 
      }),
    };
  }

  beforeEach(() => {
    game.user.targets = new Set();
    game.combat = { id: 'combat1' };
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
  });
  afterEach(() => {
    game.combat = null;
  });

  test("canUsePerk is true when not yet used this scene", () => {
    const actor = makeCombatStanceActor({ usedThisEncounter: false });
    const item = makePerkItem({ sourceId: COMBAT_STANCE_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("canUsePerk is false once already used this scene", () => {
    const actor = makeCombatStanceActor({ usedThisEncounter: true });
    const item = makePerkItem({ sourceId: COMBAT_STANCE_ID, actor });
    expect(canUsePerk(item)).toBe(false);
  });

  test("declares the stance against the currently-targeted enemy and notifies", async () => {
    const actor = makeCombatStanceActor({ level: 5 });
    const target = { uuid: 'Actor.target1', system: { threatLevel: 5 } };
    game.user.targets = makeTargetsSet(target);
    const item = makePerkItem({ sourceId: COMBAT_STANCE_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'combatStanceTargetUuid', 'Actor.target1');
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("warns and does nothing without a target", async () => {
    const actor = makeCombatStanceActor();
    game.user.targets = makeTargetsSet(undefined);
    const item = makePerkItem({ sourceId: COMBAT_STANCE_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(global.ChatMessage.create).not.toHaveBeenCalled();
  });
});

describe("At All Cost (Through the Shattered Grid, Magna Defender, 18th level, p.25)", () => {
  function makeAtAllCostActor({ isMorphed = true, active = false, usedThisEncounter = false } = {}) {
    const flagStore = {
      atAllCostActive: active,
      atAllCostUsedThisEncounter: usedThisEncounter ? { combatId: 'combat1' } : undefined,
    };
    return {
      ...makeActor(),
      system: { isMorphed },
      getFlag: jest.fn((scope, key) => flagStore[key]),
      setFlag: jest.fn((scope, key, value) => {
        flagStore[key] = value; 
      }),
      unsetFlag: jest.fn((scope, key) => {
        flagStore[key] = undefined; 
      }),
    };
  }

  beforeEach(() => {
    game.combat = { id: 'combat1' };
    global.ChatMessage.create.mockReset();
  });
  afterEach(() => {
    game.combat = null;
  });

  const AT_ALL_COST_ID = "Compendium.essence20.through_the_shattered_grid.Item.TGnqQAWWi1hBGqeh";

  test("canUsePerk is true while Morphed and not yet used this scene", () => {
    expect(canUsePerk(makePerkItem({ sourceId: AT_ALL_COST_ID, actor: makeAtAllCostActor() }))).toBe(true);
  });

  test("canUsePerk is false when not Morphed", () => {
    expect(canUsePerk(makePerkItem({
      sourceId: AT_ALL_COST_ID, actor: makeAtAllCostActor({ isMorphed: false }),
    }))).toBe(false);
  });

  test("canUsePerk is always true to switch back off, even if already used this scene", () => {
    expect(canUsePerk(makePerkItem({
      sourceId: AT_ALL_COST_ID, actor: makeAtAllCostActor({ active: true, usedThisEncounter: true }),
    }))).toBe(true);
  });

  test("switches on and notifies", async () => {
    const actor = makeAtAllCostActor({ active: false });
    await onPerkUse(makePerkItem({ sourceId: AT_ALL_COST_ID, actor }));

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'atAllCostActive', true);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("switches back off when already active", async () => {
    const actor = makeAtAllCostActor({ active: true });
    await onPerkUse(makePerkItem({ sourceId: AT_ALL_COST_ID, actor }));

    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'atAllCostActive');
  });

  // At All Costs (PR CRB, Green/White Ranger, 18th level, p.34/63) - a single shared compendium
  // item dispatching to this exact same toggle - see PR_CRB_AT_ALL_COSTS_ID's own comment.
  const PR_CRB_AT_ALL_COSTS_ID = "Compendium.essence20.pr_crb.Item.UFwnD2CsWCWXlUyf";

  test("PR CRB's own shared At All Costs item dispatches to the same toggle", async () => {
    const actor = makeAtAllCostActor({ active: false });
    await onPerkUse(makePerkItem({ sourceId: PR_CRB_AT_ALL_COSTS_ID, actor }));

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'atAllCostActive', true);
    expect(canUsePerk(makePerkItem({ sourceId: PR_CRB_AT_ALL_COSTS_ID, actor: makeAtAllCostActor() }))).toBe(true);
  });
});

describe("Brute Force (Beneath the Helmet, Graphite Ranger, 3rd/10th/17th level, p.47)", () => {
  const BRUTE_FORCE_ID = "Compendium.essence20.beneath_the_helmet.Item.3XP5RgmeyQwE5HH9";

  function makeGraphiteRangerActor({ power = 2, active = false } = {}) {
    const flagStore = { powerBoostActive: active };
    return {
      ...makeActor(),
      system: { powers: { personal: { value: power } } },
      getFlag: jest.fn((scope, key) => flagStore[key]),
      setFlag: jest.fn(async (scope, key, value) => {
        flagStore[key] = value;
      }),
      update: jest.fn(),
    };
  }

  test("activates using the shared Power Boost toggle", async () => {
    const actor = makeGraphiteRangerActor({ power: 2, active: false });
    const item = makePerkItem({ sourceId: BRUTE_FORCE_ID, actor });

    expect(canUsePerk(item)).toBe(true);
    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'powerBoostActive', true);
  });
});

describe("Ageless Knowledge (Across the Stars, Phantom Ranger, 6th level, p.61)", () => {
  const AGELESS_KNOWLEDGE_ID = "Compendium.essence20.across_the_stars.Item.peGPrJKYlx79ybbu";

  function makeAgelessKnowledgeActor({ power = 1 } = {}) {
    return {
      ...makeActor(),
      system: { powers: { personal: { value: power } } },
      update: jest.fn(),
    };
  }

  beforeEach(() => {
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
    foundry.applications.api.DialogV2.wait.mockReset();
  });

  describe("canUsePerk", () => {
    test("true when the actor can afford 1 Power", () => {
      const actor = makeAgelessKnowledgeActor({ power: 1 });
      const item = makePerkItem({ sourceId: AGELESS_KNOWLEDGE_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false when unaffordable", () => {
      const actor = makeAgelessKnowledgeActor({ power: 0 });
      const item = makePerkItem({ sourceId: AGELESS_KNOWLEDGE_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("spends 1 Power and banks the chosen Skill", async () => {
    const actor = makeAgelessKnowledgeActor({ power: 1 });
    foundry.applications.api.DialogV2.wait.mockResolvedValue('science');
    const item = makePerkItem({ sourceId: AGELESS_KNOWLEDGE_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingAgelessKnowledge', expect.objectContaining({ skill: 'science' }),
    );
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("spends nothing if the picker is cancelled", async () => {
    const actor = makeAgelessKnowledgeActor({ power: 1 });
    foundry.applications.api.DialogV2.wait.mockResolvedValue(null);
    const item = makePerkItem({ sourceId: AGELESS_KNOWLEDGE_ID, actor });

    await onPerkUse(item);

    expect(actor.update).not.toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("warns and does nothing when unaffordable", async () => {
    const actor = makeAgelessKnowledgeActor({ power: 0 });
    const item = makePerkItem({ sourceId: AGELESS_KNOWLEDGE_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
  });
});

describe("Paradox (A Jump Through Time, Influence Perk, p.21)", () => {
  const PARADOX_ID = "Compendium.essence20.jump_through_time.Item.TYebczV8RvTTbWnL";

  beforeEach(() => {
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
    foundry.applications.api.DialogV2.wait.mockReset();
  });

  describe("canUsePerk", () => {
    test("true when not yet used this encounter", () => {
      const actor = makeActor();
      const item = makePerkItem({ sourceId: PARADOX_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false once already used this encounter", () => {
      const actor = makeActor();
      actor.getFlag = jest.fn((scope, key) => (
        key == 'paradoxUsedThisEncounter' ? { combatId: 'combat1' } : undefined
      ));
      game.combat = { id: 'combat1' };
      const item = makePerkItem({ sourceId: PARADOX_ID, actor });
      expect(canUsePerk(item)).toBe(false);
      game.combat = null;
    });
  });

  test("banks the chosen Skill and marks the encounter used", async () => {
    game.combat = { id: 'combat1' };
    const actor = makeActor();
    foundry.applications.api.DialogV2.wait.mockResolvedValue('science');
    const item = makePerkItem({ sourceId: PARADOX_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingParadox', expect.objectContaining({ skill: 'science' }),
    );
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'paradoxUsedThisEncounter', expect.anything(),
    );
    expect(global.ChatMessage.create).toHaveBeenCalled();
    game.combat = null;
  });

  test("banks nothing if the picker is cancelled", async () => {
    const actor = makeActor();
    foundry.applications.api.DialogV2.wait.mockResolvedValue(null);
    const item = makePerkItem({ sourceId: PARADOX_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).not.toHaveBeenCalledWith('essence20', 'pendingParadox', expect.anything());
    expect(global.ChatMessage.create).not.toHaveBeenCalled();
  });

  test("warns and does nothing once already used this encounter", async () => {
    const actor = makeActor();
    actor.getFlag = jest.fn((scope, key) => (
      key == 'paradoxUsedThisEncounter' ? { combatId: 'combat1' } : undefined
    ));
    game.combat = { id: 'combat1' };
    const item = makePerkItem({ sourceId: PARADOX_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(foundry.applications.api.DialogV2.wait).not.toHaveBeenCalled();
    game.combat = null;
  });
});

describe("Curb Your Enthusiasm (MLP Loyalty, 5th/15th level, p.90)", () => {
  beforeEach(() => {
    game.combat = { id: 'combat1' };
    game.users = [{ isGM: true, active: true }];
    game.socket.emit.mockReset();
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
  });

  afterEach(() => {
    game.combat = null;
  });

  describe("canUsePerk", () => {
    test("true when not yet used this encounter", () => {
      const actor = makeActor();
      const item = makePerkItem({ sourceId: CURB_YOUR_ENTHUSIASM_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false once already used this encounter", () => {
      const actor = makeActor();
      actor.getFlag = jest.fn((scope, key) => (
        key == 'curbYourEnthusiasmUsedThisEncounter' ? { combatId: 'combat1' } : undefined
      ));
      const item = makePerkItem({ sourceId: CURB_YOUR_ENTHUSIASM_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });

    test("true outside of combat entirely (the once-per-scene gate only applies mid-combat)", () => {
      game.combat = null;
      const actor = makeActor();
      actor.getFlag = jest.fn((scope, key) => (
        key == 'curbYourEnthusiasmUsedThisEncounter' ? { combatId: 'someOldCombat' } : undefined
      ));
      const item = makePerkItem({ sourceId: CURB_YOUR_ENTHUSIASM_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });
  });

  test("requests a Story Point grant over the socket and marks the encounter used", async () => {
    const actor = makeActor({ id: 'pony6', name: 'Rainbow Dash' });
    const item = makePerkItem({ sourceId: CURB_YOUR_ENTHUSIASM_ID, actor });

    await onPerkUse(item);

    expect(game.socket.emit).toHaveBeenCalledWith('system.essence20', {
      action: 'grantStoryPoints', amount: 1, actorName: 'Rainbow Dash',
    });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'curbYourEnthusiasmUsedThisEncounter', expect.objectContaining({ combatId: 'combat1' }),
    );
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("warns and does nothing when no GM is connected", async () => {
    game.users = [{ isGM: false, active: true }];
    const actor = makeActor({ id: 'pony6' });
    const item = makePerkItem({ sourceId: CURB_YOUR_ENTHUSIASM_ID, actor });

    await onPerkUse(item);

    expect(game.socket.emit).not.toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });
});

describe("\"I Know A Guy\" (PR CRB, Kind Origin benefit, p.26)", () => {
  beforeEach(() => {
    game.combat = { id: 'combat1' };
  });

  afterEach(() => {
    game.combat = null;
  });

  describe("canUsePerk", () => {
    test("true when not yet used this encounter", () => {
      const actor = makeActor();
      const item = makePerkItem({ sourceId: I_KNOW_A_GUY_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false once already used this encounter", () => {
      const actor = makeActor();
      actor.getFlag = jest.fn((scope, key) => (
        key == 'iKnowAGuyUsedThisEncounter' ? { combatId: 'combat1' } : undefined
      ));
      const item = makePerkItem({ sourceId: I_KNOW_A_GUY_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("triggers the roll and marks the encounter used", async () => {
    const actor = { ...makeActor(), _dice: { rollSkill: jest.fn() } };
    const item = makePerkItem({ sourceId: I_KNOW_A_GUY_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'persuasion', essence: 'social', dif: '12' }),
      actor,
    );
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'iKnowAGuyUsedThisEncounter', expect.objectContaining({ combatId: 'combat1' }),
    );
  });
});

describe("Educated (PR CRB, General Perk, p.94)", () => {
  const EDUCATED_ID = "Compendium.essence20.pr_crb.Item.Jq0jnOgj6oPkMlse";

  beforeEach(() => {
    game.combat = { id: 'combat1' };
    game.users = [{ isGM: true, active: true }];
    game.socket.emit.mockReset();
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
  });

  afterEach(() => {
    game.combat = null;
  });

  describe("canUsePerk", () => {
    test("true when not yet used this encounter", () => {
      const actor = makeActor();
      const item = makePerkItem({ sourceId: EDUCATED_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false once already used this encounter", () => {
      const actor = makeActor();
      actor.getFlag = jest.fn((scope, key) => (
        key == 'educatedUsedThisEncounter' ? { combatId: 'combat1' } : undefined
      ));
      const item = makePerkItem({ sourceId: EDUCATED_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("requests a Story Point grant over the socket and marks the encounter used", async () => {
    const actor = makeActor({ id: 'ranger1', name: 'Trini' });
    const item = makePerkItem({ sourceId: EDUCATED_ID, actor });

    await onPerkUse(item);

    expect(game.socket.emit).toHaveBeenCalledWith('system.essence20', {
      action: 'grantStoryPoints', amount: 1, actorName: 'Trini',
    });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'educatedUsedThisEncounter', expect.objectContaining({ combatId: 'combat1' }),
    );
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("warns and does nothing when no GM is connected", async () => {
    game.users = [{ isGM: false, active: true }];
    const actor = makeActor({ id: 'ranger1' });
    const item = makePerkItem({ sourceId: EDUCATED_ID, actor });

    await onPerkUse(item);

    expect(game.socket.emit).not.toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });
});

describe("Heroic Intervention (PR CRB, General Perk, p.96) - Story Point grant half", () => {
  const HEROIC_INTERVENTION_ID = "Compendium.essence20.pr_crb.Item.T95n2lwh3F5OHjnB";

  beforeEach(() => {
    game.combat = { id: 'combat1' };
    game.users = [{ isGM: true, active: true }];
    game.socket.emit.mockReset();
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
  });

  afterEach(() => {
    game.combat = null;
  });

  describe("canUsePerk", () => {
    test("true when not yet used this encounter", () => {
      const actor = makeActor();
      const item = makePerkItem({ sourceId: HEROIC_INTERVENTION_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false once already used this encounter", () => {
      const actor = makeActor();
      actor.getFlag = jest.fn((scope, key) => (
        key == 'heroicInterventionUsedThisEncounter' ? { combatId: 'combat1' } : undefined
      ));
      const item = makePerkItem({ sourceId: HEROIC_INTERVENTION_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("requests a Story Point grant over the socket and marks the encounter used", async () => {
    const actor = makeActor({ id: 'ranger1', name: 'Trini' });
    const item = makePerkItem({ sourceId: HEROIC_INTERVENTION_ID, actor });

    await onPerkUse(item);

    expect(game.socket.emit).toHaveBeenCalledWith('system.essence20', {
      action: 'grantStoryPoints', amount: 1, actorName: 'Trini',
    });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'heroicInterventionUsedThisEncounter', expect.objectContaining({ combatId: 'combat1' }),
    );
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("warns and does nothing when no GM is connected", async () => {
    game.users = [{ isGM: false, active: true }];
    const actor = makeActor({ id: 'ranger1' });
    const item = makePerkItem({ sourceId: HEROIC_INTERVENTION_ID, actor });

    await onPerkUse(item);

    expect(game.socket.emit).not.toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });
});

describe("Legacy (General Hawk's Personnel Files, Influence Perk, p.169) - Story Point grant half", () => {
  const LEGACY_ID = "Compendium.essence20.general_hawk_s_personel_files.Item.j8OsGvCyIstjGyKZ";

  beforeEach(() => {
    game.combat = { id: 'combat1' };
    game.users = [{ isGM: true, active: true }];
    game.socket.emit.mockReset();
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
  });

  afterEach(() => {
    game.combat = null;
  });

  test("canUsePerk true when not yet used this encounter, false once it has been", () => {
    const actor = makeActor();
    expect(canUsePerk(makePerkItem({ sourceId: LEGACY_ID, actor }))).toBe(true);

    actor.getFlag = jest.fn((scope, key) => (key == 'legacyUsedThisEncounter' ? { combatId: 'combat1' } : undefined));
    expect(canUsePerk(makePerkItem({ sourceId: LEGACY_ID, actor }))).toBe(false);
  });

  test("requests a Story Point grant over the socket and marks the encounter used", async () => {
    const actor = makeActor({ id: 'joe1', name: 'Billy' });
    const item = makePerkItem({ sourceId: LEGACY_ID, actor });

    await onPerkUse(item);

    expect(game.socket.emit).toHaveBeenCalledWith('system.essence20', {
      action: 'grantStoryPoints', amount: 1, actorName: 'Billy',
    });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'legacyUsedThisEncounter', expect.objectContaining({ combatId: 'combat1' }),
    );
  });

  test("warns and does nothing when no GM is connected", async () => {
    game.users = [{ isGM: false, active: true }];
    const actor = makeActor();
    await onPerkUse(makePerkItem({ sourceId: LEGACY_ID, actor }));

    expect(game.socket.emit).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });
});

describe("Done the Impossible (General Hawk's Personnel Files, General Perk, p.174) - Story Point grant half", () => {
  const DONE_THE_IMPOSSIBLE_ID = "Compendium.essence20.general_hawk_s_personel_files.Item.wWwI0ngCDCGWN0uB";

  beforeEach(() => {
    game.combat = { id: 'combat1' };
    game.users = [{ isGM: true, active: true }];
    game.socket.emit.mockReset();
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
  });

  afterEach(() => {
    game.combat = null;
  });

  test("canUsePerk true when not yet used this encounter, false once it has been", () => {
    const actor = makeActor();
    expect(canUsePerk(makePerkItem({ sourceId: DONE_THE_IMPOSSIBLE_ID, actor }))).toBe(true);

    actor.getFlag = jest.fn((scope, key) => (
      key == 'doneTheImpossibleUsedThisEncounter' ? { combatId: 'combat1' } : undefined
    ));
    expect(canUsePerk(makePerkItem({ sourceId: DONE_THE_IMPOSSIBLE_ID, actor }))).toBe(false);
  });

  test("requests a Story Point grant over the socket and marks the encounter used", async () => {
    const actor = makeActor({ id: 'joe1', name: 'Stalker' });
    const item = makePerkItem({ sourceId: DONE_THE_IMPOSSIBLE_ID, actor });

    await onPerkUse(item);

    expect(game.socket.emit).toHaveBeenCalledWith('system.essence20', {
      action: 'grantStoryPoints', amount: 1, actorName: 'Stalker',
    });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'doneTheImpossibleUsedThisEncounter', expect.objectContaining({ combatId: 'combat1' }),
    );
  });

  test("warns and does nothing when no GM is connected", async () => {
    game.users = [{ isGM: false, active: true }];
    const actor = makeActor();
    await onPerkUse(makePerkItem({ sourceId: DONE_THE_IMPOSSIBLE_ID, actor }));

    expect(game.socket.emit).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });
});

describe("Keep 'Em Laughing (PR CRB, Comedic Origin Benefit, p.23)", () => {
  const KEEP_EM_LAUGHING_ID = "Compendium.essence20.pr_crb.Item.xrwFNj0NDRcWXvXN";

  beforeEach(() => {
    game.users = [{ isGM: true, active: true }];
    game.socket.emit.mockReset();
    ui.notifications.warn.mockReset();
    global.ChatMessage.create.mockReset();
  });

  test("canUsePerk is always true, no frequency cap", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: KEEP_EM_LAUGHING_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("requests a Story Point grant over the socket, with no encounter flag set", async () => {
    const actor = makeActor({ id: 'ranger1', name: 'Trini' });
    const item = makePerkItem({ sourceId: KEEP_EM_LAUGHING_ID, actor });

    await onPerkUse(item);

    expect(game.socket.emit).toHaveBeenCalledWith('system.essence20', {
      action: 'grantStoryPoints', amount: 1, actorName: 'Trini',
    });
    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("warns and does nothing when no GM is connected", async () => {
    game.users = [{ isGM: false, active: true }];
    const actor = makeActor({ id: 'ranger1' });
    const item = makePerkItem({ sourceId: KEEP_EM_LAUGHING_ID, actor });

    await onPerkUse(item);

    expect(game.socket.emit).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalled();
  });
});

describe("Wild Tales (MLP Adventurer Influence, p.42)", () => {
  const WILD_TALES_ID = "Compendium.essence20.mlp_crb.Item.FkBnUmwiOQgNnmLs";

  beforeEach(() => {
    game.combat = null;
    foundry.applications.api.DialogV2.wait.mockReset();
    global.ChatMessage.create.mockReset();
  });

  test("canUsePerk is true with no cost, as long as it hasn't been used this scene", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: WILD_TALES_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("canUsePerk is false once already used this scene", () => {
    game.combat = { id: 'combat1' };
    const actor = makeActor();
    actor.getFlag = jest.fn((scope, key) => (
      key == 'wildTalesUsedThisEncounter' ? { combatId: 'combat1' } : undefined
    ));
    const item = makePerkItem({ sourceId: WILD_TALES_ID, actor });
    expect(canUsePerk(item)).toBe(false);
  });

  test("banks an Edge scoped to the chosen Essence and marks the scene used", async () => {
    game.combat = { id: 'combat1' };
    foundry.applications.api.DialogV2.wait.mockResolvedValue('social');
    const actor = makeActor();
    const item = makePerkItem({ sourceId: WILD_TALES_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingWildTales', expect.objectContaining({ essence: 'social' }),
    );
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'wildTalesUsedThisEncounter', { combatId: 'combat1' },
    );
  });

  test("doesn't bank anything or mark the scene used when the picker is cancelled", async () => {
    game.combat = { id: 'combat1' };
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeActor();
    const item = makePerkItem({ sourceId: WILD_TALES_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe("Bait and Switch (MLP Tricky Influence, p.63)", () => {
  const BAIT_AND_SWITCH_ID = "Compendium.essence20.mlp_crb.Item.E6QEmhG9S1skhLLs";

  beforeEach(() => {
    game.users = [{ isGM: true, active: true }];
    game.socket.emit.mockReset();
    game.settings = { get: jest.fn(() => 1) };
  });

  afterEach(() => {
    delete game.settings;
  });

  describe("canUsePerk", () => {
    test("true with a GM connected and at least 1 Story Point available", () => {
      const actor = makeActor();
      const item = makePerkItem({ sourceId: BAIT_AND_SWITCH_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false with no Story Points available", () => {
      game.settings.get = jest.fn(() => 0);
      const actor = makeActor();
      const item = makePerkItem({ sourceId: BAIT_AND_SWITCH_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });

    test("false with no GM connected", () => {
      game.users = [{ isGM: false, active: true }];
      const actor = makeActor();
      const item = makePerkItem({ sourceId: BAIT_AND_SWITCH_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("spends 1 Story Point over the socket and banks an Edge on the actor", async () => {
    const actor = makeActor({ id: 'pony7', name: 'Applejack' });
    const item = makePerkItem({ sourceId: BAIT_AND_SWITCH_ID, actor });

    await onPerkUse(item);

    expect(game.socket.emit).toHaveBeenCalledWith('system.essence20', {
      action: 'spendStoryPoints', amount: 1, actorName: 'Applejack',
    });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingBaitAndSwitch', expect.objectContaining({ edge: true }),
    );
  });
});

describe("Concentrate Fire (GI Joe CRB, Vanguard base, 15th level, p.109)", () => {
  const CONCENTRATE_FIRE_ID = "Compendium.essence20.gi_joe_crb.Item.LccKe9ZdDPvS5YbD";

  function makeTargetsSet(targetActor) {
    const token = { actor: targetActor };
    const set = new Set([token]);
    set.first = () => token;

    return set;
  }

  beforeEach(() => {
    game.combat = { id: 'combat1' };
    game.user.targets = new Set();
    game.users = [{ isGM: true, active: true }];
    game.settings = { get: jest.fn(() => 1) };
    game.socket.emit.mockReset();
    ui.notifications.warn.mockReset();
    global.ChatMessage.create?.mockReset();
  });

  afterEach(() => {
    game.combat = null;
    delete game.settings;
  });

  describe("canUsePerk", () => {
    test("true when not yet used this encounter, a GM is connected, and a Story Point is available", () => {
      const actor = makeActor();
      const item = makePerkItem({ sourceId: CONCENTRATE_FIRE_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false once already used this encounter", () => {
      const actor = makeActor();
      actor.getFlag = jest.fn((scope, key) => (
        key == 'concentrateFireUsedThisEncounter' ? { combatId: 'combat1' } : undefined
      ));
      const item = makePerkItem({ sourceId: CONCENTRATE_FIRE_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });

    test("false with no Story Points available", () => {
      game.settings.get = jest.fn(() => 0);
      const actor = makeActor();
      const item = makePerkItem({ sourceId: CONCENTRATE_FIRE_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });

    test("false with no GM connected", () => {
      game.users = [{ isGM: false, active: true }];
      const actor = makeActor();
      const item = makePerkItem({ sourceId: CONCENTRATE_FIRE_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("marks the currently-targeted token's actor, spends 1 Story Point, and marks the encounter used", async () => {
    const actor = makeActor({ id: 'vanguard1', name: 'Roadblock' });
    const targetActor = makeActor({ id: 'target1' });
    game.user.targets = makeTargetsSet(targetActor);
    const item = makePerkItem({ sourceId: CONCENTRATE_FIRE_ID, actor });

    await onPerkUse(item);

    expect(targetActor.setFlag).toHaveBeenCalledWith('essence20', 'concentrateFireTargetMark', true);
    expect(game.socket.emit).toHaveBeenCalledWith('system.essence20', {
      action: 'spendStoryPoints', amount: 1, actorName: 'Roadblock',
    });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'concentrateFireUsedThisEncounter', expect.objectContaining({ combatId: 'combat1' }),
    );
  });

  test("warns and does nothing when nothing is targeted", async () => {
    const actor = makeActor({ id: 'vanguard1' });
    game.user.targets = makeTargetsSet(undefined);
    game.user.targets.first = () => undefined;
    const item = makePerkItem({ sourceId: CONCENTRATE_FIRE_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(game.socket.emit).not.toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("warns and does nothing when no GM is connected", async () => {
    game.users = [{ isGM: false, active: true }];
    const actor = makeActor({ id: 'vanguard1' });
    const targetActor = makeActor({ id: 'target1' });
    game.user.targets = makeTargetsSet(targetActor);
    const item = makePerkItem({ sourceId: CONCENTRATE_FIRE_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(game.socket.emit).not.toHaveBeenCalled();
    expect(targetActor.setFlag).not.toHaveBeenCalled();
  });
});

describe("Clued In (GI Joe CRB, Intelligence Origin Benefit, p.64)", () => {
  const CLUED_IN_ID = "Compendium.essence20.gi_joe_crb.Item.QPKjeNGLdT1QqNOY";

  beforeEach(() => {
    game.users = [{ isGM: true, active: true }];
    game.settings = { get: jest.fn(() => 1) };
    game.socket.emit.mockReset();
    ui.notifications.warn.mockReset();
    global.ChatMessage.create?.mockReset();
  });

  afterEach(() => {
    delete game.settings;
  });

  describe("canUsePerk", () => {
    test("true when a GM is connected and a Story Point is available", () => {
      const actor = makeActor();
      const item = makePerkItem({ sourceId: CLUED_IN_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false with no Story Points available", () => {
      game.settings.get = jest.fn(() => 0);
      const actor = makeActor();
      const item = makePerkItem({ sourceId: CLUED_IN_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });

    test("false with no GM connected", () => {
      game.users = [{ isGM: false, active: true }];
      const actor = makeActor();
      const item = makePerkItem({ sourceId: CLUED_IN_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("spends 1 Story Point and announces on the sheet", async () => {
    const actor = makeActor({ name: 'Scarlett' });
    const item = makePerkItem({ sourceId: CLUED_IN_ID, actor });

    await onPerkUse(item);

    expect(game.socket.emit).toHaveBeenCalledWith('system.essence20', {
      action: 'spendStoryPoints', amount: 1, actorName: 'Scarlett',
    });
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("warns and does nothing when no GM is connected", async () => {
    game.users = [{ isGM: false, active: true }];
    const actor = makeActor();
    const item = makePerkItem({ sourceId: CLUED_IN_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(game.socket.emit).not.toHaveBeenCalled();
  });
});

describe("Phantom (GI Joe CRB, Infiltrator Focus, 17th level, p.74)", () => {
  const PHANTOM_GIJ_ID = "Compendium.essence20.gi_joe_crb.Item.Z92UggPHdmt47A7Q";

  test("canUsePerk is always true", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: PHANTOM_GIJ_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("toggles invisible on", async () => {
    const actor = { ...makeActor(), toggleStatusEffect: jest.fn() };
    const item = makePerkItem({ sourceId: PHANTOM_GIJ_ID, actor });

    await onPerkUse(item);

    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('invisible', { active: true });
  });
});

describe("Surface Read (GI Joe CRB, Spy Focus, 10th level, p.76)", () => {
  const SURFACE_READ_ID = "Compendium.essence20.gi_joe_crb.Item.5YfAL40M8FlZvBVb";

  beforeEach(() => {
    game.users = [{ isGM: true, active: true }];
    game.settings = { get: jest.fn(() => 1) };
    game.socket.emit.mockReset();
    ui.notifications.warn.mockReset();
    global.ChatMessage.create?.mockReset();
    global.Roll = class {
      constructor() {}
      async evaluate() {
        this.total = 3;
        return this;
      }
    };
  });

  afterEach(() => {
    delete game.settings;
  });

  test("spends 1 Story Point and rolls the actor's own Alertness die", async () => {
    const actor = {
      ...makeActor(), system: { skills: { alertness: { shift: 'd8' } } }, getRollData: jest.fn(() => ({})),
    };
    const item = makePerkItem({ sourceId: SURFACE_READ_ID, actor });

    await onPerkUse(item);

    expect(game.socket.emit).toHaveBeenCalledWith('system.essence20', expect.objectContaining({
      action: 'spendStoryPoints', amount: 1,
    }));
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("warns and does nothing when no GM is connected", async () => {
    game.users = [{ isGM: false, active: true }];
    const actor = {
      ...makeActor(), system: { skills: { alertness: { shift: 'd8' } } }, getRollData: jest.fn(() => ({})),
    };
    const item = makePerkItem({ sourceId: SURFACE_READ_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(game.socket.emit).not.toHaveBeenCalled();
  });
});

describe("Suggestion (GI Joe CRB, Spy Focus, 20th level, p.76)", () => {
  const SUGGESTION_ID = "Compendium.essence20.gi_joe_crb.Item.q2YLQLdssomYU4Za";
  const PERFECT_DISGUISE_FLAG = 'perfectDisguiseActive';

  function makeDisguisedActor({ disguised = true } = {}) {
    const flags = { [PERFECT_DISGUISE_FLAG]: disguised };
    return {
      ...makeActor(),
      getFlag: jest.fn((scope, key) => flags[key]),
      _dice: { rollSkill: jest.fn() },
    };
  }

  beforeEach(() => {
    game.combat = { id: 'combat1' };
  });

  afterEach(() => {
    game.combat = null;
  });

  test("canUsePerk requires the disguise active and not yet used this encounter", () => {
    const disguised = makeDisguisedActor({ disguised: true });
    expect(canUsePerk(makePerkItem({ sourceId: SUGGESTION_ID, actor: disguised }))).toBe(true);

    const notDisguised = makeDisguisedActor({ disguised: false });
    expect(canUsePerk(makePerkItem({ sourceId: SUGGESTION_ID, actor: notDisguised }))).toBe(false);
  });

  test("triggers a Persuasion vs Willpower roll and marks the encounter used", async () => {
    const actor = makeDisguisedActor();
    const item = makePerkItem({ sourceId: SUGGESTION_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'persuasion', defenseType: 'willpower' }), actor,
    );
  });
});

describe("Talk Them Down (GI Joe CRB, Spy Focus, 17th level, p.76)", () => {
  const TALK_THEM_DOWN_ID = "Compendium.essence20.gi_joe_crb.Item.Y8PlCnqD5txZKJWh";

  test("canUsePerk is always true", () => {
    const actor = { ...makeActor(), _dice: { rollSkill: jest.fn() } };
    expect(canUsePerk(makePerkItem({ sourceId: TALK_THEM_DOWN_ID, actor }))).toBe(true);
  });

  test("triggers a Persuasion vs Willpower roll flagged for Frightened application", async () => {
    const actor = { ...makeActor(), _dice: { rollSkill: jest.fn() } };
    const item = makePerkItem({ sourceId: TALK_THEM_DOWN_ID, actor });

    await onPerkUse(item);

    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'persuasion', defenseType: 'willpower', isTalkThemDown: true }), actor,
    );
  });
});

describe("If I Recall Correctly (Knights of Canterlot, Spell Scribe Influence, p.34)", () => {
  const IF_I_RECALL_CORRECTLY_ID = "Compendium.essence20.knights_of_canterlot.Item.IHwRuoKUDhYAjTqa";

  beforeEach(() => {
    game.combat = null;
  });

  test("canUsePerk is true with no cost, as long as it hasn't been used this scene", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: IF_I_RECALL_CORRECTLY_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("canUsePerk is false once already used this scene", () => {
    game.combat = { id: 'combat1' };
    const actor = makeActor();
    actor.getFlag = jest.fn((scope, key) => (
      key == 'ifIRecallCorrectlyUsedThisEncounter' ? { combatId: 'combat1' } : undefined
    ));
    const item = makePerkItem({ sourceId: IF_I_RECALL_CORRECTLY_ID, actor });
    expect(canUsePerk(item)).toBe(false);
  });

  test("banks an Edge on the actor and marks the scene used", async () => {
    game.combat = { id: 'combat1' };
    const actor = makeActor();
    const item = makePerkItem({ sourceId: IF_I_RECALL_CORRECTLY_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingIfIRecallCorrectly', expect.objectContaining({ edge: true }),
    );
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'ifIRecallCorrectlyUsedThisEncounter', { combatId: 'combat1' },
    );
  });
});

describe("Trick Shot (Knights of Canterlot, Archer, p.14)", () => {
  const TRICK_SHOT_ID = "Compendium.essence20.knights_of_canterlot.Item.sZDDuJOzRq9vg1sP";

  beforeEach(() => {
    game.combat = null;
  });

  test("canUsePerk is true with no cost, as long as it hasn't been used this scene", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: TRICK_SHOT_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("canUsePerk is false once already used this scene", () => {
    game.combat = { id: 'combat1' };
    const actor = makeActor();
    actor.getFlag = jest.fn((scope, key) => (
      key == 'trickShotUsedThisEncounter' ? { combatId: 'combat1' } : undefined
    ));
    const item = makePerkItem({ sourceId: TRICK_SHOT_ID, actor });
    expect(canUsePerk(item)).toBe(false);
  });

  test("banks an Edge on the actor and marks the scene used", async () => {
    game.combat = { id: 'combat1' };
    const actor = makeActor();
    const item = makePerkItem({ sourceId: TRICK_SHOT_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingTrickShot', expect.objectContaining({ edge: true }),
    );
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'trickShotUsedThisEncounter', { combatId: 'combat1' },
    );
  });
});

describe("Augment Power (Transformers CRB Scientist, 7th level, p.80)", () => {
  beforeEach(() => {
    game.user.targets = new Set();
    canvas.tokens.placeables = [];
    foundry.applications.api.DialogV2.wait.mockReset();
    ui.notifications.warn.mockReset();
    game.combat = null;
  });

  describe("canUsePerk - once-per-turn gate", () => {
    test("true with the Perk, not yet used this turn", () => {
      game.combat = { id: 'combat1', round: 1, turn: 0 };
      const actor = makeActor();
      const item = makePerkItem({ sourceId: AUGMENT_POWER_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false once already used this turn", () => {
      game.combat = { id: 'combat1', round: 1, turn: 0 };
      const actor = makeActor();
      actor.getFlag = jest.fn((scope, key) => (
        key == 'augmentPowerUsedThisTurn' ? { combatId: 'combat1', round: 1, turn: 0 } : undefined
      ));
      const item = makePerkItem({ sourceId: AUGMENT_POWER_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });

    test("true again once it's a new turn", () => {
      game.combat = { id: 'combat1', round: 1, turn: 1 };
      const actor = makeActor();
      actor.getFlag = jest.fn((scope, key) => (
        key == 'augmentPowerUsedThisTurn' ? { combatId: 'combat1', round: 1, turn: 0 } : undefined
      ));
      const item = makePerkItem({ sourceId: AUGMENT_POWER_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("true outside of combat entirely (the once-per-turn gate only applies mid-combat)", () => {
      const actor = makeActor();
      const item = makePerkItem({ sourceId: AUGMENT_POWER_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });
  });

  test("banks a flat +1 shiftUp on the single already-targeted ally and marks the turn used", async () => {
    game.combat = { id: 'combat1', round: 1, turn: 0 };
    const actor = makeActor({ id: 'scientist' });
    const ally = makeActor({ id: 'ally1', name: 'Wheeljack' });
    game.user.targets = new Set([{ actor: ally }]);
    const item = makePerkItem({ sourceId: AUGMENT_POWER_ID, actor, currentValue: 99 });

    await onPerkUse(item);

    // Fixed +1, ignoring the Perk item's own advances.currentValue (unlike Plan of Action/Heart
    // of the Team, whose grantValue scales off it).
    expect(ally.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingAugmentPower', expect.objectContaining({ shiftUp: 1 }),
    );
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'augmentPowerUsedThisTurn', expect.anything(),
    );
  });
});

describe("Vulnerability (MLP Kindness, 3rd level, p.82)", () => {
  test("true for the Perk with no pending bonus yet, no cost/gate", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: VULNERABILITY_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("false once a bonus is already banked", () => {
    const actor = makeActor();
    actor.getFlag = jest.fn(() => ({ shiftUp: 1, combatId: null, round: null }));
    const item = makePerkItem({ sourceId: VULNERABILITY_ID, actor });
    expect(canUsePerk(item)).toBe(false);
  });

  test("banks a flat +1 shiftUp on the actor themselves (self-target)", async () => {
    const actor = makeActor({ id: 'pony1', name: 'Fluttershy' });
    const item = makePerkItem({ sourceId: VULNERABILITY_ID, actor, currentValue: 99 });

    await onPerkUse(item);

    // Fixed +1, ignoring the Perk item's own advances.currentValue (unscaled by level, unlike
    // Plan of Action/Heart of the Team).
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingVulnerability', expect.objectContaining({ shiftUp: 1 }),
    );
  });
});

describe("Inner Magic (MLP Magic, 2nd level, p.94)", () => {
  test("true for the Perk with no pending bonus yet, no cost/gate", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: INNER_MAGIC_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("banks a flat +1 shiftUp on the actor themselves (self-target)", async () => {
    const actor = makeActor({ id: 'pony2', name: 'Twilight Sparkle' });
    const item = makePerkItem({ sourceId: INNER_MAGIC_ID, actor, currentValue: 99 });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingInnerMagic', expect.objectContaining({ shiftUp: 1 }),
    );
  });
});

describe("Personal Sacrifice (MLP Generosity, 7th level, p.74)", () => {
  test("true for the Perk with no pending bonus yet", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: PERSONAL_SACRIFICE_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("banks a flat +1 shiftUp on the single already-targeted ally", async () => {
    const actor = makeActor({ id: 'pony4', name: 'Applejack' });
    const ally = makeActor({ id: 'ally3', name: 'Apple Bloom' });
    game.user.targets = new Set([{ actor: ally }]);
    const item = makePerkItem({ sourceId: PERSONAL_SACRIFICE_ID, actor, currentValue: 99 });

    await onPerkUse(item);

    expect(ally.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingPersonalSacrifice', expect.objectContaining({ shiftUp: 1 }),
    );
  });
});

describe("Bird's Eye View (Technorganic Secrets, Origin Perk, p.39)", () => {
  const BIRD_EYE_VIEW_ID = "Compendium.essence20.technorganic_secrets.Item.tXFkcJfvuZ1LEUAX";

  function makeTransformedActor({ isTransformed = true } = {}) {
    return { ...makeActor(), system: { ...makeActor().system, isTransformed } };
  }

  beforeEach(() => {
    game.combat = { id: 'combat1' };
  });

  afterEach(() => {
    game.combat = null;
  });

  test("true while in Alt Mode, not yet used this scene", () => {
    const actor = makeTransformedActor({ isTransformed: true });
    const item = makePerkItem({ sourceId: BIRD_EYE_VIEW_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("false while in Bot Mode, or once already used this scene", () => {
    const botModeActor = makeTransformedActor({ isTransformed: false });
    expect(canUsePerk(makePerkItem({ sourceId: BIRD_EYE_VIEW_ID, actor: botModeActor }))).toBe(false);

    const usedActor = makeTransformedActor({ isTransformed: true });
    usedActor.getFlag = jest.fn((scope, key) => (
      key == 'birdEyeViewUsedThisEncounter' ? { combatId: 'combat1' } : undefined
    ));
    expect(canUsePerk(makePerkItem({ sourceId: BIRD_EYE_VIEW_ID, actor: usedActor }))).toBe(false);
  });

  test("banks a flat +2 shiftUp on the single already-targeted ally and marks the scene used", async () => {
    const actor = makeTransformedActor({ isTransformed: true });
    const ally = makeActor({ id: 'ally5', name: 'Cheetor' });
    game.user.targets = new Set([{ actor: ally }]);
    const item = makePerkItem({ sourceId: BIRD_EYE_VIEW_ID, actor });

    await onPerkUse(item);

    expect(ally.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingBirdEyeView', expect.objectContaining({ shiftUp: 2 }),
    );
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'birdEyeViewUsedThisEncounter', expect.objectContaining({ combatId: 'combat1' }),
    );
    game.user.targets = new Set();
  });
});

describe("I Got You (Enigma of Combination, Team Leader Focus, 3rd level, p.30)", () => {
  function makeEnergonActor({ id = 'leader', energon = 1 } = {}) {
    return { ...makeActor({ id }), system: { energon: { normal: { value: energon } } }, update: jest.fn() };
  }

  beforeEach(() => {
    game.user.targets = new Set();
    game.combat = null;
  });

  test("true with 1+ Energon, not yet used this round", () => {
    const actor = makeEnergonActor({ energon: 1 });
    const item = makePerkItem({ sourceId: I_GOT_YOU_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("false with no Energon", () => {
    const actor = makeEnergonActor({ energon: 0 });
    const item = makePerkItem({ sourceId: I_GOT_YOU_ID, actor });
    expect(canUsePerk(item)).toBe(false);
  });

  test("false once already used this round", () => {
    game.combat = { id: 'combat1', round: 1 };
    const actor = makeEnergonActor({ energon: 1 });
    actor.getFlag = jest.fn((scope, key) => (
      key == 'iGotYouUsedThisRound' ? { combatId: 'combat1', round: 1 } : undefined
    ));
    const item = makePerkItem({ sourceId: I_GOT_YOU_ID, actor });
    expect(canUsePerk(item)).toBe(false);
  });

  test("true again once it's a new round", () => {
    game.combat = { id: 'combat1', round: 2 };
    const actor = makeEnergonActor({ energon: 1 });
    actor.getFlag = jest.fn((scope, key) => (
      key == 'iGotYouUsedThisRound' ? { combatId: 'combat1', round: 1 } : undefined
    ));
    const item = makePerkItem({ sourceId: I_GOT_YOU_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("banks a flat +1 shiftUp on the ally, spends 1 Energon, and marks the round used", async () => {
    game.combat = { id: 'combat1', round: 1 };
    const actor = makeEnergonActor({ id: 'leader1', energon: 2 });
    const ally = makeActor({ id: 'ally1', name: 'Teammate' });
    game.user.targets = new Set([{ actor: ally }]);
    const item = makePerkItem({ sourceId: I_GOT_YOU_ID, actor });

    await onPerkUse(item);

    expect(ally.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingIGotYou', expect.objectContaining({ shiftUp: 1 }),
    );
    expect(actor.update).toHaveBeenCalledWith({ 'system.energon.normal.value': 1 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'iGotYouUsedThisRound', expect.anything());
  });
});

describe("Generosity of Spirit (MLP Generosity, 1st level, p.74)", () => {
  test("true for the Perk with no self-penalty pending yet", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: GENEROSITY_OF_SPIRIT_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("false while the self-penalty from a prior use is still unconsumed", () => {
    const actor = makeActor();
    actor.getFlag = jest.fn((scope, key) => (
      key == 'pendingGenerosityOfSpiritPenalty' ? { shiftDown: 1, combatId: null, round: null } : undefined
    ));
    const item = makePerkItem({ sourceId: GENEROSITY_OF_SPIRIT_ID, actor });
    expect(canUsePerk(item)).toBe(false);
  });

  test("banks a flat +1 shiftUp on the chosen ally AND a -1 shiftDown on the granter", async () => {
    const actor = makeActor({ id: 'pony3', name: 'Rarity' });
    const ally = makeActor({ id: 'ally2', name: 'Sweetie Belle' });
    game.user.targets = new Set([{ actor: ally }]);
    const item = makePerkItem({ sourceId: GENEROSITY_OF_SPIRIT_ID, actor, currentValue: 99 });

    await onPerkUse(item);

    expect(ally.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingGenerosityOfSpirit', expect.objectContaining({ shiftUp: 1 }),
    );
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingGenerosityOfSpiritPenalty', expect.objectContaining({ shiftDown: 1 }),
    );
  });
});

describe("consumeHardTarget", () => {
  test("returns and consumes the banked bonus against an Evasion attack", async () => {
    const actor = makeActor();
    actor.getFlag = jest.fn((scope, key) => (
      key == 'pendingHardTarget' ? { defenseBonus: 4, combatId: null, round: null } : undefined
    ));

    const result = await consumeHardTarget(actor, 'evasion');

    expect(result).toBe(4);
    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'pendingHardTarget');
  });

  test("doesn't consume, and returns 0, against a non-Evasion Defense", async () => {
    const actor = makeActor();
    actor.getFlag = jest.fn((scope, key) => (
      key == 'pendingHardTarget' ? { defenseBonus: 4, combatId: null, round: null } : undefined
    ));

    const result = await consumeHardTarget(actor, 'toughness');

    expect(result).toBe(0);
    expect(actor.unsetFlag).not.toHaveBeenCalled();
  });

  test("returns 0 with nothing banked", async () => {
    const actor = makeActor();

    const result = await consumeHardTarget(actor, 'evasion');

    expect(result).toBe(0);
    expect(actor.unsetFlag).not.toHaveBeenCalled();
  });
});

describe("Deep Breathing (Welcome to Night Vale: Citizens' Guide, General Perk, p.47)", () => {
  function makeDeepBreathingActor({ id, name, health = 5, healthMax = 10 } = {}) {
    return { ...makeActor({ id, name }), system: { health: { value: health, max: healthMax } }, update: jest.fn() };
  }

  beforeEach(() => {
    game.combat = { id: 'combat1' };
  });

  test("canUsePerk is true with no cost, as long as it hasn't been used this scene", () => {
    const actor = makeDeepBreathingActor();
    const item = makePerkItem({ sourceId: DEEP_BREATHING_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("canUsePerk is false once already used this scene", () => {
    const actor = makeDeepBreathingActor();
    actor.getFlag = jest.fn((scope, key) => (key == 'deepBreathingUsedThisEncounter' ? { combatId: 'combat1' } : undefined));
    const item = makePerkItem({ sourceId: DEEP_BREATHING_ID, actor });
    expect(canUsePerk(item)).toBe(false);
  });

  test("heals the actor themselves (no ally picker) by 1 Health and marks the scene used", async () => {
    const actor = makeDeepBreathingActor({ id: 'citizen', health: 4 });
    const item = makePerkItem({ sourceId: DEEP_BREATHING_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'deepBreathingUsedThisEncounter', { combatId: 'combat1' });
  });

  test("doesn't heal past the actor's own max Health", async () => {
    const actor = makeDeepBreathingActor({ id: 'citizen', health: 10, healthMax: 10 });
    const item = makePerkItem({ sourceId: DEEP_BREATHING_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 10 });
  });

  test("does nothing once already used this scene", async () => {
    const actor = makeDeepBreathingActor({ id: 'citizen', health: 4 });
    actor.getFlag = jest.fn((scope, key) => (key == 'deepBreathingUsedThisEncounter' ? { combatId: 'combat1' } : undefined));
    const item = makePerkItem({ sourceId: DEEP_BREATHING_ID, actor });

    await onPerkUse(item);

    expect(actor.update).not.toHaveBeenCalled();
  });
});

describe("Therapeutic Nanotechnology (Technorganic Secrets, Technorganic Influence choice, p.35/47)", () => {
  const THERAPEUTIC_NANOTECHNOLOGY_ID = "Compendium.essence20.technorganic_secrets.Item.SwXglwZwj64m3zFF";

  function makeTherapeuticNanotechnologyActor({ id, name, health = 5, healthMax = 10, isTransformed = true } = {}) {
    return {
      ...makeActor({ id, name }),
      system: { health: { value: health, max: healthMax }, isTransformed },
      update: jest.fn(),
    };
  }

  beforeEach(() => {
    game.combat = { id: 'combat1' };
  });

  test("canUsePerk is true in Alt Mode, as long as it hasn't been used this scene", () => {
    const actor = makeTherapeuticNanotechnologyActor();
    const item = makePerkItem({ sourceId: THERAPEUTIC_NANOTECHNOLOGY_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("canUsePerk is false outside Alt Mode, or once already used this scene", () => {
    const botModeActor = makeTherapeuticNanotechnologyActor({ isTransformed: false });
    expect(canUsePerk(makePerkItem({ sourceId: THERAPEUTIC_NANOTECHNOLOGY_ID, actor: botModeActor }))).toBe(false);

    const usedActor = makeTherapeuticNanotechnologyActor();
    usedActor.getFlag = jest.fn((scope, key) => (
      key == 'therapeuticNanotechnologyUsedThisEncounter' ? { combatId: 'combat1' } : undefined
    ));
    expect(canUsePerk(makePerkItem({ sourceId: THERAPEUTIC_NANOTECHNOLOGY_ID, actor: usedActor }))).toBe(false);
  });

  test("heals the actor themselves by 1 Health and marks the scene used", async () => {
    const actor = makeTherapeuticNanotechnologyActor({ id: 'bot', health: 4 });
    const item = makePerkItem({ sourceId: THERAPEUTIC_NANOTECHNOLOGY_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'therapeuticNanotechnologyUsedThisEncounter', { combatId: 'combat1' });
  });

  test("does nothing outside Alt Mode, or once already used this scene", async () => {
    const botModeActor = makeTherapeuticNanotechnologyActor({ id: 'bot', health: 4, isTransformed: false });
    await onPerkUse(makePerkItem({ sourceId: THERAPEUTIC_NANOTECHNOLOGY_ID, actor: botModeActor }));
    expect(botModeActor.update).not.toHaveBeenCalled();

    const usedActor = makeTherapeuticNanotechnologyActor({ id: 'bot', health: 4 });
    usedActor.getFlag = jest.fn((scope, key) => (
      key == 'therapeuticNanotechnologyUsedThisEncounter' ? { combatId: 'combat1' } : undefined
    ));
    await onPerkUse(makePerkItem({ sourceId: THERAPEUTIC_NANOTECHNOLOGY_ID, actor: usedActor }));
    expect(usedActor.update).not.toHaveBeenCalled();
  });
});

describe("Dig Deep (PR CRB, General Perk, p.94)", () => {
  const DIG_DEEP_PR_CRB_ID = "Compendium.essence20.pr_crb.Item.eC0iByyLbSHQKY2G";

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

  let originalRoll;
  beforeAll(() => {
    originalRoll = global.Roll;
    global.Roll = FakeRoll;
  });
  afterAll(() => {
    global.Roll = originalRoll;
  });

  function makeDigDeepActor({ id, name, health = 5, healthMax = 10 } = {}) {
    return {
      ...makeActor({ id, name }),
      system: { health: { value: health, max: healthMax } },
      update: jest.fn(),
      getRollData: jest.fn(() => ({})),
    };
  }

  beforeEach(() => {
    game.combat = { id: 'combat1' };
    FakeRoll.nextTotal = 2;
  });

  test("canUsePerk is true with no cost, as long as it hasn't been used this scene", () => {
    const actor = makeDigDeepActor();
    const item = makePerkItem({ sourceId: DIG_DEEP_PR_CRB_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("canUsePerk is false once already used this scene", () => {
    const actor = makeDigDeepActor();
    actor.getFlag = jest.fn((scope, key) => (key == 'digDeepPrCrbUsedThisEncounter' ? { combatId: 'combat1' } : undefined));
    const item = makePerkItem({ sourceId: DIG_DEEP_PR_CRB_ID, actor });
    expect(canUsePerk(item)).toBe(false);
  });

  test("heals the actor themselves (no ally picker) by the rolled 1d2 amount and marks the scene used", async () => {
    const actor = makeDigDeepActor({ id: 'ranger', health: 4 });
    const item = makePerkItem({ sourceId: DIG_DEEP_PR_CRB_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 6 }); // 4 + 2 (rolled)
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'digDeepPrCrbUsedThisEncounter', { combatId: 'combat1' });
  });

  test("doesn't heal past the actor's own max Health", async () => {
    const actor = makeDigDeepActor({ id: 'ranger', health: 9, healthMax: 10 });
    const item = makePerkItem({ sourceId: DIG_DEEP_PR_CRB_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 10 });
  });

  test("does nothing once already used this scene", async () => {
    const actor = makeDigDeepActor({ id: 'ranger', health: 4 });
    actor.getFlag = jest.fn((scope, key) => (key == 'digDeepPrCrbUsedThisEncounter' ? { combatId: 'combat1' } : undefined));
    const item = makePerkItem({ sourceId: DIG_DEEP_PR_CRB_ID, actor });

    await onPerkUse(item);

    expect(actor.update).not.toHaveBeenCalled();
  });
});

describe("Tourniquet Line Chef (Welcome to Night Vale: Citizens' Guide, General Perk, p.51)", () => {
  const TOURNIQUET_LINE_CHEF_ID = "Compendium.essence20.wtnv_citizens_guide.Item.fxH2GPkDGvJEpI8s";

  function makeChefActor({ id, name, health = 5, healthMax = 10 } = {}) {
    return { ...makeActor({ id, name }), system: { health: { value: health, max: healthMax } }, update: jest.fn() };
  }

  beforeEach(() => {
    game.user.targets = new Set();
    canvas.tokens.placeables = [];
    foundry.applications.api.DialogV2.wait.mockReset();
    ui.notifications.warn.mockReset();
  });

  test("canUsePerk is always true - no cost or gate beyond the Standard action itself", () => {
    const actor = makeChefActor();
    const item = makePerkItem({ sourceId: TOURNIQUET_LINE_CHEF_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("heals the single already-targeted ally by 1, no cost", async () => {
    const actor = makeChefActor({ id: 'chef' });
    const ally = makeChefActor({ id: 'ally1', name: 'Cecil', health: 4 });
    game.user.targets = new Set([{ actor: ally }]);
    const item = makePerkItem({ sourceId: TOURNIQUET_LINE_CHEF_ID, actor });

    await onPerkUse(item);

    expect(ally.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("offers the granter themselves in the picker fallback, unlike every other ally-only entry", async () => {
    const actor = makeChefActor({ id: 'chef', health: 4 });
    foundry.applications.api.DialogV2.wait.mockImplementation(({ content }) => {
      expect(content).toContain('chef');
      return 'chef';
    });
    const item = makePerkItem({ sourceId: TOURNIQUET_LINE_CHEF_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 5 });
  });

  test("doesn't heal past the target's own max Health", async () => {
    const actor = makeChefActor({ id: 'chef' });
    const ally = makeChefActor({ id: 'ally1', name: 'Cecil', health: 10, healthMax: 10 });
    game.user.targets = new Set([{ actor: ally }]);
    const item = makePerkItem({ sourceId: TOURNIQUET_LINE_CHEF_ID, actor });

    await onPerkUse(item);

    expect(ally.update).toHaveBeenCalledWith({ 'system.health.value': 10 });
  });
});

describe("Real Angels (Welcome to Night Vale: Citizens' Guide, General Perk, p.51)", () => {
  function makeRealAngelsActor({ id, name } = {}) {
    return { ...makeActor({ id, name }), toggleStatusEffect: jest.fn() };
  }

  beforeEach(() => {
    game.combat = { id: 'combat1' };
  });

  test("canUsePerk is true with no cost, as long as it hasn't been used this session", () => {
    const actor = makeRealAngelsActor();
    const item = makePerkItem({ sourceId: REAL_ANGELS_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("canUsePerk is false once already used this session", () => {
    const actor = makeRealAngelsActor();
    actor.getFlag = jest.fn((scope, key) => (key == 'realAngelsUsedThisEncounter' ? { combatId: 'combat1' } : undefined));
    const item = makePerkItem({ sourceId: REAL_ANGELS_ID, actor });
    expect(canUsePerk(item)).toBe(false);
  });

  test("grants Cover to the actor and marks the session used", async () => {
    const actor = makeRealAngelsActor({ id: 'citizen', name: 'Cecil' });
    const item = makePerkItem({ sourceId: REAL_ANGELS_ID, actor });

    await onPerkUse(item);

    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('cover', { active: true });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'realAngelsUsedThisEncounter', { combatId: 'combat1' });
  });

  test("does nothing once already used this session", async () => {
    const actor = makeRealAngelsActor({ id: 'citizen' });
    actor.getFlag = jest.fn((scope, key) => (key == 'realAngelsUsedThisEncounter' ? { combatId: 'combat1' } : undefined));
    const item = makePerkItem({ sourceId: REAL_ANGELS_ID, actor });

    await onPerkUse(item);

    expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
  });
});

describe("Dig Deep (Welcome to Night Vale: Citizens' Guide, General Perk, p.47)", () => {
  beforeEach(() => {
    game.combat = { id: 'combat1' };
  });

  test("canUsePerk is true with no cost, as long as it hasn't been used this scene", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: DIG_DEEP_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("canUsePerk is false once already used this scene", () => {
    const actor = makeActor();
    actor.getFlag = jest.fn((scope, key) => (key == 'digDeepUsedThisEncounter' ? { combatId: 'combat1' } : undefined));
    const item = makePerkItem({ sourceId: DIG_DEEP_ID, actor });
    expect(canUsePerk(item)).toBe(false);
  });

  test("banks both the damage reduction and the self Snag, and marks the scene used", async () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: DIG_DEEP_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingDigDeep', expect.objectContaining({ amount: 1 }),
    );
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingDigDeepSnag', expect.objectContaining({ snag: true }),
    );
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'digDeepUsedThisEncounter', { combatId: 'combat1' });
  });

  test("does nothing once already used this scene", async () => {
    const actor = makeActor();
    actor.getFlag = jest.fn((scope, key) => (key == 'digDeepUsedThisEncounter' ? { combatId: 'combat1' } : undefined));
    const item = makePerkItem({ sourceId: DIG_DEEP_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).not.toHaveBeenCalledWith('essence20', 'pendingDigDeep', expect.anything());
  });
});

describe("Dig Deep (Transformers CRB, General Perk, p.108)", () => {
  const DIG_DEEP_TF_ID = "Compendium.essence20.tf_crb.Item.uPxkVrCLuBdx9kty";

  beforeEach(() => {
    game.combat = { id: 'combat1' };
  });

  test("shares the WTNV item's own damage-reduction-and-Snag dispatch", async () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: DIG_DEEP_TF_ID, actor });

    expect(canUsePerk(item)).toBe(true);

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingDigDeep', expect.objectContaining({ amount: 1 }),
    );
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingDigDeepSnag', expect.objectContaining({ snag: true }),
    );
  });
});

describe("Educated (Transformers CRB, General Perk, p.109)", () => {
  const EDUCATED_TF_ID = "Compendium.essence20.tf_crb.Item.hXBK58yrv1s8IdA4";

  beforeEach(() => {
    game.combat = { id: 'combat1' };
    game.users = [{ isGM: true, active: true }];
    game.socket.emit.mockReset();
  });

  afterEach(() => {
    game.combat = null;
  });

  test("shares the PR CRB/GI Joe CRB Story Point grant dispatch", async () => {
    const actor = makeActor({ id: 'gunner1', name: 'Longarm' });
    const item = makePerkItem({ sourceId: EDUCATED_TF_ID, actor });

    expect(canUsePerk(item)).toBe(true);

    await onPerkUse(item);

    expect(game.socket.emit).toHaveBeenCalledWith('system.essence20', {
      action: 'grantStoryPoints', amount: 1, actorName: 'Longarm',
    });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'educatedUsedThisEncounter', expect.objectContaining({ combatId: 'combat1' }),
    );
  });
});

describe("Timeline Anomaly (Welcome to Night Vale: Citizens' Guide, General Perk, p.47)", () => {
  const realTargets = game.user.targets;

  function makeCombatant(actorId, initiative) {
    return { actor: { id: actorId }, initiative, update: jest.fn() };
  }

  beforeEach(() => {
    game.combat = { id: 'combat1' };
    game.user.targets = { first: jest.fn(() => undefined) };
  });

  afterEach(() => {
    game.user.targets = realTargets;
  });

  test("canUsePerk is true with no cost, as long as it hasn't been used this session", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: TIMELINE_ANOMALY_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("canUsePerk is false once already used this session", () => {
    const actor = makeActor();
    actor.getFlag = jest.fn((scope, key) => (key == 'timelineAnomalyUsedThisEncounter' ? { combatId: 'combat1' } : undefined));
    const item = makePerkItem({ sourceId: TIMELINE_ANOMALY_ID, actor });
    expect(canUsePerk(item)).toBe(false);
  });

  test("swaps Initiative with the targeted Combatant and marks the session used", async () => {
    const actor = makeActor({ id: 'actor1' });
    const actorCombatant = makeCombatant('actor1', 5);
    const targetCombatant = makeCombatant('target1', 15);
    game.combat.combatants = [actorCombatant, targetCombatant];
    game.user.targets.first.mockReturnValue({ actor: { id: 'target1' } });
    const item = makePerkItem({ sourceId: TIMELINE_ANOMALY_ID, actor });

    await onPerkUse(item);

    expect(actorCombatant.update).toHaveBeenCalledWith({ initiative: 15 });
    expect(targetCombatant.update).toHaveBeenCalledWith({ initiative: 5 });
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'timelineAnomalyUsedThisEncounter', { combatId: 'combat1' });
  });

  test("doesn't mark used when there's no valid target to swap with", async () => {
    const actor = makeActor({ id: 'actor1' });
    game.combat.combatants = [makeCombatant('actor1', 5)];
    game.user.targets.first.mockReturnValue(undefined);
    const item = makePerkItem({ sourceId: TIMELINE_ANOMALY_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).not.toHaveBeenCalledWith('essence20', 'timelineAnomalyUsedThisEncounter', expect.anything());
  });

  test("does nothing once already used this session", async () => {
    const actor = makeActor({ id: 'actor1' });
    actor.getFlag = jest.fn((scope, key) => (key == 'timelineAnomalyUsedThisEncounter' ? { combatId: 'combat1' } : undefined));
    const actorCombatant = makeCombatant('actor1', 5);
    game.combat.combatants = [actorCombatant];
    const item = makePerkItem({ sourceId: TIMELINE_ANOMALY_ID, actor });

    await onPerkUse(item);

    expect(actorCombatant.update).not.toHaveBeenCalled();
  });
});

describe("After You (MLP CRB, Spirit of Generosity, 6th level, p.76)", () => {
  const AFTER_YOU_ID = "Compendium.essence20.mlp_crb.Item.CjNQHWxMjTQfcLTZ";
  const realTargets = game.user.targets;

  function makeCombatant(actorId, initiative) {
    return { actor: { id: actorId }, initiative, update: jest.fn() };
  }

  beforeEach(() => {
    game.combat = { id: 'combat1' };
    game.user.targets = { first: jest.fn(() => undefined) };
  });

  afterEach(() => {
    game.user.targets = realTargets;
  });

  test("canUsePerk is always true - RAW states no frequency cap", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: AFTER_YOU_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("swaps Initiative with a target who rolled lower", async () => {
    const actor = makeActor({ id: 'actor1' });
    const actorCombatant = makeCombatant('actor1', 15);
    const targetCombatant = makeCombatant('target1', 5);
    game.combat.combatants = [actorCombatant, targetCombatant];
    game.user.targets.first.mockReturnValue({ actor: { id: 'target1' } });
    const item = makePerkItem({ sourceId: AFTER_YOU_ID, actor });

    await onPerkUse(item);

    expect(actorCombatant.update).toHaveBeenCalledWith({ initiative: 5 });
    expect(targetCombatant.update).toHaveBeenCalledWith({ initiative: 15 });
  });

  test("doesn't swap with a target who rolled higher", async () => {
    const actor = makeActor({ id: 'actor1' });
    const actorCombatant = makeCombatant('actor1', 5);
    const targetCombatant = makeCombatant('target1', 15);
    game.combat.combatants = [actorCombatant, targetCombatant];
    game.user.targets.first.mockReturnValue({ actor: { id: 'target1' } });
    const item = makePerkItem({ sourceId: AFTER_YOU_ID, actor });

    await onPerkUse(item);

    expect(actorCombatant.update).not.toHaveBeenCalled();
    expect(targetCombatant.update).not.toHaveBeenCalled();
  });
});

describe("Hidden Whispers (Welcome to Night Vale: Citizens' Guide, Politician Role, Mayoral Candidate Focus, p.41)", () => {
  beforeEach(() => {
    game.combat = { id: 'combat1' };
  });

  test("canUsePerk is true with no cost, as long as it hasn't been used this scene", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: HIDDEN_WHISPERS_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("canUsePerk is false once already used this scene", () => {
    const actor = makeActor();
    actor.getFlag = jest.fn((scope, key) => (key == 'hiddenWhispersUsedThisEncounter' ? { combatId: 'combat1' } : undefined));
    const item = makePerkItem({ sourceId: HIDDEN_WHISPERS_ID, actor });
    expect(canUsePerk(item)).toBe(false);
  });

  test("banks a flat +3 shiftUp on the actor themselves and marks the scene used", async () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: HIDDEN_WHISPERS_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingHiddenWhispers', expect.objectContaining({ shiftUp: 3 }),
    );
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'hiddenWhispersUsedThisEncounter', { combatId: 'combat1' });
  });
});

describe("Quick Study (Welcome to Night Vale: Citizens' Guide, General Perk, p.50)", () => {
  const realTargets = game.user.targets;

  beforeEach(() => {
    game.combat = { id: 'combat1' };
    game.user.targets = { first: jest.fn(() => undefined) };
    global.ChatMessage.create.mockReset();
  });

  afterEach(() => {
    game.user.targets = realTargets;
  });

  test("canUsePerk is true with no cost, as long as it hasn't been used this scene", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: QUICK_STUDY_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("canUsePerk is false once already used this scene", () => {
    const actor = makeActor();
    actor.getFlag = jest.fn((scope, key) => (key == 'quickStudyUsedThisEncounter' ? { combatId: 'combat1' } : undefined));
    const item = makePerkItem({ sourceId: QUICK_STUDY_ID, actor });
    expect(canUsePerk(item)).toBe(false);
  });

  test("posts the target's Defenses to chat and marks the scene used", async () => {
    const actor = makeActor();
    const targetActor = {
      name: 'Cecil',
      system: {
        defenses: {
          toughness: { total: 12 }, evasion: { total: 10 }, willpower: { total: 14 }, cleverness: { total: 8 },
        },
      },
    };
    game.user.targets.first.mockReturnValue({ actor: targetActor });
    const item = makePerkItem({ sourceId: QUICK_STUDY_ID, actor });

    await onPerkUse(item);

    expect(global.ChatMessage.create).toHaveBeenCalled();
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'quickStudyUsedThisEncounter', { combatId: 'combat1' });
  });

  test("doesn't mark used with no target selected", async () => {
    const actor = makeActor();
    game.user.targets.first.mockReturnValue(undefined);
    const item = makePerkItem({ sourceId: QUICK_STUDY_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).not.toHaveBeenCalledWith('essence20', 'quickStudyUsedThisEncounter', expect.anything());
  });

  test("does nothing once already used this scene", async () => {
    const actor = makeActor();
    actor.getFlag = jest.fn((scope, key) => (key == 'quickStudyUsedThisEncounter' ? { combatId: 'combat1' } : undefined));
    const item = makePerkItem({ sourceId: QUICK_STUDY_ID, actor });

    await onPerkUse(item);

    expect(global.ChatMessage.create).not.toHaveBeenCalled();
  });
});

describe("Quick Study (GI Joe CRB, Technician, 1st level, p.102)", () => {
  const GIJ_QUICK_STUDY_ID = "Compendium.essence20.gi_joe_crb.Item.IoOFcSJK3sHLAbgR";
  const realTargets = game.user.targets;

  beforeEach(() => {
    game.combat = { id: 'combat1' };
    game.user.targets = { first: jest.fn(() => undefined) };
    global.ChatMessage.create.mockReset();
  });

  afterEach(() => {
    game.user.targets = realTargets;
  });

  test("reuses the same once-per-scene Defense reveal as WTNV's Quick Study", async () => {
    const actor = makeActor();
    const targetActor = {
      name: 'Duke',
      system: {
        defenses: {
          toughness: { total: 14 }, evasion: { total: 11 }, willpower: { total: 12 }, cleverness: { total: 9 },
        },
      },
    };
    game.user.targets.first.mockReturnValue({ actor: targetActor });
    const item = makePerkItem({ sourceId: GIJ_QUICK_STUDY_ID, actor });

    expect(canUsePerk(item)).toBe(true);

    await onPerkUse(item);

    expect(global.ChatMessage.create).toHaveBeenCalled();
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'quickStudyUsedThisEncounter', { combatId: 'combat1' });
  });

  test("canUsePerk is false once already used this scene", () => {
    const actor = makeActor();
    actor.getFlag = jest.fn((scope, key) => (key == 'quickStudyUsedThisEncounter' ? { combatId: 'combat1' } : undefined));
    const item = makePerkItem({ sourceId: GIJ_QUICK_STUDY_ID, actor });
    expect(canUsePerk(item)).toBe(false);
  });
});

describe("Auxiliary Brain (GI Joe CRB, Technician/Expert Focus, 6th level, p.104)", () => {
  const AUXILIARY_BRAIN_ID = "Compendium.essence20.gi_joe_crb.Item.wddBU7QaDgEe9FhR";

  beforeEach(() => {
    game.combat = { id: 'combat1', round: 1, turn: 0 };
  });

  test("true with the Perk, not yet used this turn", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: AUXILIARY_BRAIN_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("false once already used this turn", () => {
    const actor = makeActor();
    actor.getFlag = jest.fn((scope, key) => (
      key == 'auxiliaryBrainUsedThisTurn' ? { combatId: 'combat1', round: 1, turn: 0 } : undefined
    ));
    const item = makePerkItem({ sourceId: AUXILIARY_BRAIN_ID, actor });
    expect(canUsePerk(item)).toBe(false);
  });

  test("banks a self Edge and marks the turn used", async () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: AUXILIARY_BRAIN_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'pendingAuxiliaryBrain', expect.objectContaining({ edge: true }),
    );
    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'auxiliaryBrainUsedThisTurn', expect.anything());
  });
});

describe("Fast Learner (GI Joe CRB, Technician/Tinkerer Focus, 1st level, p.106)", () => {
  const FAST_LEARNER_ID = "Compendium.essence20.gi_joe_crb.Item.u3KK0V30GXDdRPAY";

  beforeEach(() => {
    foundry.applications.api.DialogV2.wait.mockReset();
  });

  test("canUsePerk is always true", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: FAST_LEARNER_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("prompts and stores the chosen allocation, posting a chat card", async () => {
    const actor = { ...makeActor(), getRollData: jest.fn(() => ({ skills: { science: { shift: 'd8' } } })) };
    foundry.applications.api.DialogV2.wait.mockImplementation(async ({ buttons }) => buttons[0].callback(null, {
      form: { elements: { decreaseSkill: { value: 'science' }, increaseSkill: { value: 'technology' } } },
    }));
    const item = makePerkItem({ sourceId: FAST_LEARNER_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'fastLearnerAllocation', {
      decreaseSkill: 'science', increaseSkill: 'technology',
    });
  });

  test("cancelling the picker sets no allocation", async () => {
    const actor = { ...makeActor(), getRollData: jest.fn(() => ({ skills: { science: { shift: 'd8' } } })) };
    foundry.applications.api.DialogV2.wait.mockImplementation(async () => 'cancel');
    const item = makePerkItem({ sourceId: FAST_LEARNER_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).not.toHaveBeenCalledWith('essence20', 'fastLearnerAllocation', expect.anything());
  });
});

describe("Castling (GI Joe CRB, Grandmaster Focus, 10th level, p.87)", () => {
  const CASTLING_ID = "Compendium.essence20.gi_joe_crb.Item.eB7jbgbevLVPxW4e";

  function makeCastlingAllyActor({ id, health = 3, healthMax = 10 } = {}) {
    return {
      id, name: id, system: { health: { value: health, max: healthMax, bonus: 0 } }, update: jest.fn(),
    };
  }

  const realTargets = game.user.targets;

  afterEach(() => {
    game.user.targets = realTargets;
  });

  test("canUsePerk is always true", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: CASTLING_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("grants 1 Temporary Health to each of the 2 targeted allies", async () => {
    const actor = makeActor();
    const ally1 = makeCastlingAllyActor({ id: 'ally1', health: 3 });
    const ally2 = makeCastlingAllyActor({ id: 'ally2', health: 5 });
    game.user.targets = new Set([{ actor: ally1 }, { actor: ally2 }]);
    const item = makePerkItem({ sourceId: CASTLING_ID, actor });

    await onPerkUse(item);

    expect(ally1.update).toHaveBeenCalledWith({ 'system.health.bonus': 1, 'system.health.value': 4 });
    expect(ally2.update).toHaveBeenCalledWith({ 'system.health.bonus': 1, 'system.health.value': 6 });
  });

  test("does nothing when no allies are targeted and none are on the scene", async () => {
    const actor = makeActor();
    game.user.targets = new Set();
    canvas.tokens.placeables = [];
    const item = makePerkItem({ sourceId: CASTLING_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
  });
});

describe("Danger Sense (GI Joe CRB, Bodyguard Focus, 6th level, p.110) - Initiative sync dispatch", () => {
  const DANGER_SENSE_ID = "Compendium.essence20.gi_joe_crb.Item.2hwFRZ67xIGt1XTm";

  afterEach(() => {
    game.combat = null;
  });

  test("canUsePerk is always true", () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: DANGER_SENSE_ID, actor });
    expect(canUsePerk(item)).toBe(true);
  });

  test("syncs the Protected Target's Initiative and posts a chat card", async () => {
    const actor = { ...makeActor(), getFlag: jest.fn(() => 'Actor.target1') };
    const myCombatant = { actor: { id: actor.id }, initiative: 15, update: jest.fn() };
    const targetCombatant = { actor: { id: 'target1' }, initiative: 5, update: jest.fn() };
    game.combat = { combatants: [myCombatant, targetCombatant] };
    fromUuid.mockResolvedValue({ id: 'target1' });
    const item = makePerkItem({ sourceId: DANGER_SENSE_ID, actor });

    await onPerkUse(item);

    expect(targetCombatant.update).toHaveBeenCalledWith({ initiative: 15 });
  });

  test("does nothing outside combat", async () => {
    game.combat = null;
    const actor = makeActor();
    const item = makePerkItem({ sourceId: DANGER_SENSE_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
  });
});

describe("Stay In Formation (Quartermaster's Guide to Gear, General Perk, p.31)", () => {
  class FakeD4Roll {
    constructor() {
      this._total = FakeD4Roll.nextTotal;
    }
    async evaluate() {
      return this;
    }
    get total() {
      return this._total;
    }
  }

  beforeEach(() => {
    game.combat = { id: 'combat1', combatants: [] };
    canvas.tokens.placeables = [];
    global.Roll = FakeD4Roll;
    FakeD4Roll.nextTotal = 2;
  });

  afterEach(() => {
    game.combat = null;
  });

  describe("canUsePerk", () => {
    test("true when not yet used this encounter", () => {
      const actor = makeActor();
      const item = makePerkItem({ sourceId: STAY_IN_FORMATION_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false once already used this encounter", () => {
      const actor = makeActor();
      actor.getFlag = jest.fn((scope, key) => (
        key == 'stayInFormationUsedThisEncounter' ? { combatId: 'combat1' } : undefined
      ));
      const item = makePerkItem({ sourceId: STAY_IN_FORMATION_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("sets every nearby ally's Initiative and marks the encounter used", async () => {
    const actor = {
      ...makeActor({ id: 'leader1', name: 'Duke' }),
      getActiveTokens: jest.fn(() => [{ document: { disposition: 1 }, center: { x: 0, y: 0 } }]),
    };
    const allyActor = { id: 'ally1' };
    canvas.tokens.placeables = [{ actor: allyActor, document: { disposition: 1 }, center: { x: 0, y: 0 } }];
    const myCombatant = { actor: { id: 'leader1' }, initiative: 15, update: jest.fn() };
    const allyCombatant = { actor: { id: 'ally1' }, initiative: 5, update: jest.fn() };
    game.combat.combatants = [myCombatant, allyCombatant];
    const item = makePerkItem({ sourceId: STAY_IN_FORMATION_ID, actor });

    await onPerkUse(item);

    expect(allyCombatant.update).toHaveBeenCalledWith({ initiative: 13 });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'stayInFormationUsedThisEncounter', expect.objectContaining({ combatId: 'combat1' }),
    );
  });

  test("does nothing outside combat", async () => {
    game.combat = null;
    const actor = makeActor();
    const item = makePerkItem({ sourceId: STAY_IN_FORMATION_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe("Mysterious Aura (A Jump Through Time, White Spectrum Modification, replaces Follow Me!, p.45)", () => {
  const MYSTERIOUS_AURA_ID = "Compendium.essence20.pr_crb.Item.hSu10Kgj9g1LSmyv";

  function makeAuraActor({ power = 1 } = {}) {
    return { ...makeActor(), system: { powers: { personal: { value: power } } }, update: jest.fn() };
  }

  beforeEach(() => {
    foundry.applications.api.DialogV2.wait.mockReset();
  });

  test("canUsePerk true with Power available, false without", () => {
    const item1 = makePerkItem({ sourceId: MYSTERIOUS_AURA_ID, actor: makeAuraActor({ power: 1 }) });
    expect(canUsePerk(item1)).toBe(true);

    const item0 = makePerkItem({ sourceId: MYSTERIOUS_AURA_ID, actor: makeAuraActor({ power: 0 }) });
    expect(canUsePerk(item0)).toBe(false);
  });

  test("spends 1 Power and banks the chosen aura, posting a chat card", async () => {
    const actor = makeAuraActor({ power: 1 });
    foundry.applications.api.DialogV2.wait.mockImplementation(async ({ buttons }) => buttons[0].callback(null, {
      form: { elements: { type: { value: 'protective' }, defenseChoice: { value: 'evasion' } } },
    }));
    const item = makePerkItem({ sourceId: MYSTERIOUS_AURA_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(actor.setFlag).toHaveBeenCalledWith(
      'essence20', 'mysteriousAuraActive', { type: 'protective', defenseChoice: 'evasion' },
    );
  });

  test("cancelling the picker spends nothing", async () => {
    const actor = makeAuraActor({ power: 1 });
    foundry.applications.api.DialogV2.wait.mockImplementation(async () => 'cancel');
    const item = makePerkItem({ sourceId: MYSTERIOUS_AURA_ID, actor });

    await onPerkUse(item);

    expect(actor.update).not.toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe("Electromagnetic Disruption (Technorganic Secrets, Technorganic Influence Perks, p.47)", () => {
  const ELECTROMAGNETIC_DISRUPTION_ID = "Compendium.essence20.technorganic_secrets.Item.EmJaaHzoEYtWhchj";

  function makePulseActor({ choice = 'pulse' } = {}) {
    const actor = {
      ...makeActor(),
      getActiveTokens: jest.fn(() => [{ document: { disposition: 1 }, center: { x: 0, y: 0 } }]),
      system: { health: { value: 5 }, stun: { value: 0 }, immunities: {} },
      update: jest.fn(),
      toggleStatusEffect: jest.fn(),
    };
    return {
      ...makePerkItem({ sourceId: ELECTROMAGNETIC_DISRUPTION_ID, actor }),
      system: { choice },
    };
  }

  beforeEach(() => {
    canvas.tokens.placeables = [];
    game.combat = { id: 'combat1' };
  });

  afterEach(() => {
    game.combat = null;
  });

  test("canUsePerk true when the choice is 'pulse' and not yet used, false otherwise", () => {
    const pulseItem = makePulseActor({ choice: 'pulse' });
    expect(canUsePerk(pulseItem)).toBe(true);

    const weaponTraitItem = makePulseActor({ choice: 'weaponTrait' });
    expect(canUsePerk(weaponTraitItem)).toBe(false);
  });

  test("deals damage to nearby enemies and posts a chat card", async () => {
    const item = makePulseActor({ choice: 'pulse' });
    const enemyActor = { ...makeActor({ id: 'enemy1' }), system: { health: { value: 5 }, stun: { value: 0 }, immunities: {} }, update: jest.fn(), toggleStatusEffect: jest.fn() };
    canvas.tokens.placeables = [
      { actor: item.parent, document: { disposition: 1 }, center: { x: 0, y: 0 } },
      { actor: enemyActor, document: { disposition: -1 }, center: { x: 0, y: 0 } },
    ];

    await onPerkUse(item);

    expect(enemyActor.update).toHaveBeenCalledWith({ 'system.health.value': 4 });
  });

  test("does nothing when the choice isn't 'pulse'", async () => {
    const item = makePulseActor({ choice: 'weaponTrait' });
    const enemyActor = { ...makeActor({ id: 'enemy1' }), system: { health: { value: 5 }, stun: { value: 0 }, immunities: {} }, update: jest.fn() };
    canvas.tokens.placeables = [
      { actor: item.parent, document: { disposition: 1 }, center: { x: 0, y: 0 } },
      { actor: enemyActor, document: { disposition: -1 }, center: { x: 0, y: 0 } },
    ];

    await onPerkUse(item);

    expect(enemyActor.update).not.toHaveBeenCalled();
  });
});

describe("I Still Function! (Decepticon Directive, General Perk, p.66)", () => {
  const I_STILL_FUNCTION_ID = "Compendium.essence20.decepticon_directive.Item.o4HgDxoKWVtieWZJ";

  function makeDefeatedActor({ defeated = true, conditioningShift = 'd12' } = {}) {
    const actor = { ...makeActor(), statuses: new Set(defeated ? ['defeated'] : []) };
    actor.update = jest.fn();
    actor.toggleStatusEffect = jest.fn();
    actor.system = { skills: { conditioning: { shift: conditioningShift, isSpecialized: false } } };
    return actor;
  }

  beforeEach(() => {
    game.combat = { id: 'combat1', round: 1, turn: 0 };
    game.settings = { get: jest.fn(() => 1) };
    game.socket.emit.mockReset();
  });

  afterEach(() => {
    game.combat = null;
    delete game.settings;
  });

  describe("canUsePerk", () => {
    test("true while Defeated, a GM is connected, and a Story Point is available", () => {
      const actor = makeDefeatedActor({ defeated: true });
      const item = makePerkItem({ sourceId: I_STILL_FUNCTION_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false while not Defeated", () => {
      const actor = makeDefeatedActor({ defeated: false });
      const item = makePerkItem({ sourceId: I_STILL_FUNCTION_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });

    test("false without a Story Point available", () => {
      game.settings.get = jest.fn(() => 0);
      const actor = makeDefeatedActor({ defeated: true });
      const item = makePerkItem({ sourceId: I_STILL_FUNCTION_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("on a successful Conditioning check, spends a Story Point, regains Health, and clears Defeated", async () => {
    global.Roll = jest.fn().mockImplementation(() => ({
      evaluate: jest.fn().mockResolvedValue({ total: 3 }),
    }));
    const actor = makeDefeatedActor({ defeated: true, conditioningShift: 'd12' });
    const item = makePerkItem({ sourceId: I_STILL_FUNCTION_ID, actor });

    await onPerkUse(item);

    expect(game.socket.emit).toHaveBeenCalledWith('system.essence20', expect.objectContaining({
      action: 'spendStoryPoints', amount: 1,
    }));
    expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 3 });
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('defeated', { active: false });
  });

  test("on a failed Conditioning check, still spends the Story Point but doesn't heal", async () => {
    global.Roll = jest.fn().mockImplementation(() => ({
      evaluate: jest.fn().mockResolvedValue({ total: 6 }),
    }));
    const actor = makeDefeatedActor({ defeated: true, conditioningShift: 'd20' });
    const item = makePerkItem({ sourceId: I_STILL_FUNCTION_ID, actor });

    await onPerkUse(item);

    expect(game.socket.emit).toHaveBeenCalledWith('system.essence20', expect.objectContaining({
      action: 'spendStoryPoints', amount: 1,
    }));
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("does nothing while not Defeated", async () => {
    const actor = makeDefeatedActor({ defeated: false });
    const item = makePerkItem({ sourceId: I_STILL_FUNCTION_ID, actor });

    await onPerkUse(item);

    expect(game.socket.emit).not.toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
  });
});

describe("Spot Weld (Decepticon Directive, General Perk, p.67)", () => {
  const SPOT_WELD_ID = "Compendium.essence20.decepticon_directive.Item.4GYOdopDcXS8lgGI";

  function makeTargetsSet(targetActor) {
    const token = { actor: targetActor, center: { x: 0, y: 0 } };
    const set = new Set(targetActor ? [token] : []);
    set.first = () => (targetActor ? token : undefined);
    return set;
  }

  function makeSpotWeldActor({ id = 'actor1', energon = 1, usedFlag = undefined } = {}) {
    const flagStore = { spotWeldUsedThisEncounter: usedFlag };
    return {
      ...makeActor({ id }),
      system: { energon: { normal: { value: energon } }, skills: { technology: { shift: 'd20' } } },
      getFlag: jest.fn((scope, key) => flagStore[key]),
      setFlag: jest.fn(async (scope, key, value) => {
        flagStore[key] = value; 
      }),
      getActiveTokens: jest.fn(() => [{ center: { x: 0, y: 0 } }]),
      update: jest.fn(),
      _dice: { rollSkill: jest.fn() },
    };
  }

  beforeEach(() => {
    game.combat = { id: 'combat1', round: 1, turn: 0 };
    game.user.targets = makeTargetsSet(undefined);
    ui.notifications.warn.mockReset();
  });

  afterEach(() => {
    game.combat = null;
  });

  describe("canUsePerk", () => {
    test("true with an Energon Point available and not yet used this scene", () => {
      const item = makePerkItem({ sourceId: SPOT_WELD_ID, actor: makeSpotWeldActor({ energon: 1 }) });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false without an Energon Point", () => {
      const item = makePerkItem({ sourceId: SPOT_WELD_ID, actor: makeSpotWeldActor({ energon: 0 }) });
      expect(canUsePerk(item)).toBe(false);
    });

    test("false once already used this scene", () => {
      const actor = makeSpotWeldActor({ usedFlag: { combatId: 'combat1' } });
      const item = makePerkItem({ sourceId: SPOT_WELD_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("spends an Energon Point, marks the scene used, and triggers the roll on the actor themselves with no target", async () => {
    const actor = makeSpotWeldActor({ energon: 1 });
    const item = makePerkItem({ sourceId: SPOT_WELD_ID, actor });

    await onPerkUse(item);

    expect(actor.update).toHaveBeenCalledWith({ 'system.energon.normal.value': 0 });
    expect(actor._dice.rollSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skill: 'technology', dif: '12', isSpotWeldSelfHeal: true }),
      actor,
    );
  });

  test("does nothing when canUsePerk is false", async () => {
    const actor = makeSpotWeldActor({ energon: 0 });
    const item = makePerkItem({ sourceId: SPOT_WELD_ID, actor });

    await onPerkUse(item);

    expect(actor.update).not.toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });

  test("warns and spends nothing with a targeted ally out of reach", async () => {
    const targetActor = { name: 'Ally' };
    game.user.targets = makeTargetsSet(targetActor);
    canvas.grid.measurePath.mockReturnValue({ distance: 50 });
    const actor = makeSpotWeldActor({ energon: 1 });
    const item = makePerkItem({ sourceId: SPOT_WELD_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
    expect(actor._dice.rollSkill).not.toHaveBeenCalled();
  });
});

describe("Invisibility (Technorganic Secrets, Mutant Beast Influence Perk, p.47)", () => {
  const INVISIBILITY_ID = "Compendium.essence20.technorganic_secrets.Item.Ec3PMcI8WsCu2ivp";

  function makeInvisibilityActor({ active = false, usedFlag = undefined } = {}) {
    const flagStore = { invisibilityActive: active, invisibilityUsedThisEncounter: usedFlag };
    return {
      ...makeActor(),
      getFlag: jest.fn((scope, key) => flagStore[key]),
      setFlag: jest.fn(async (scope, key, value) => {
        flagStore[key] = value; 
      }),
      toggleStatusEffect: jest.fn(),
    };
  }

  beforeEach(() => {
    game.combat = { id: 'combat1', round: 1, turn: 0 };
    global.ChatMessage.create?.mockReset();
  });

  afterEach(() => {
    game.combat = null;
  });

  describe("canUsePerk", () => {
    test("true, not yet used this scene", () => {
      const item = makePerkItem({ sourceId: INVISIBILITY_ID, actor: makeInvisibilityActor() });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false once already used, unless already active", () => {
      const usedActor = makeInvisibilityActor({ usedFlag: { combatId: 'combat1' } });
      expect(canUsePerk(makePerkItem({ sourceId: INVISIBILITY_ID, actor: usedActor }))).toBe(false);

      const activeActor = makeInvisibilityActor({ active: true, usedFlag: { combatId: 'combat1' } });
      expect(canUsePerk(makePerkItem({ sourceId: INVISIBILITY_ID, actor: activeActor }))).toBe(true);
    });
  });

  test("toggles on, applies the status, and marks the scene used", async () => {
    const actor = makeInvisibilityActor();
    const item = makePerkItem({ sourceId: INVISIBILITY_ID, actor });

    await onPerkUse(item);

    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('invisible', { active: true });
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("toggles off freely", async () => {
    const actor = makeInvisibilityActor({ active: true, usedFlag: { combatId: 'combat1' } });
    const item = makePerkItem({ sourceId: INVISIBILITY_ID, actor });

    await onPerkUse(item);

    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('invisible', { active: false });
  });
});

describe("Frictionless Movement (Technorganic Secrets, Mutant Beast Influence Perk, p.47)", () => {
  const FRICTIONLESS_MOVEMENT_ID = "Compendium.essence20.technorganic_secrets.Item.9fOrSAd3brtSBk9C";

  beforeEach(() => {
    game.combat = { id: 'combat1', round: 1, turn: 0 };
    global.ChatMessage.create?.mockReset();
  });

  afterEach(() => {
    game.combat = null;
  });

  describe("canUsePerk", () => {
    test("true, not yet used this scene", () => {
      const item = makePerkItem({ sourceId: FRICTIONLESS_MOVEMENT_ID, actor: makeActor() });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false once already used this scene", () => {
      const actor = makeActor();
      actor.getFlag = jest.fn(() => ({ combatId: 'combat1' }));
      const item = makePerkItem({ sourceId: FRICTIONLESS_MOVEMENT_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("activates and marks the scene used", async () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: FRICTIONLESS_MOVEMENT_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'frictionlessMovementActive', true);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("does nothing once already used this scene", async () => {
    const actor = makeActor();
    actor.getFlag = jest.fn(() => ({ combatId: 'combat1' }));
    const item = makePerkItem({ sourceId: FRICTIONLESS_MOVEMENT_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe("Sprinter (Technorganic Secrets, Hunter's Prowess Quadruped Origin choice, p.44)", () => {
  const SPRINTER_ID = "Compendium.essence20.technorganic_secrets.Item.L5P54Ismw81Lhrbe";

  beforeEach(() => {
    game.combat = { id: 'combat1', round: 1, turn: 0 };
    global.ChatMessage.create?.mockReset();
  });

  afterEach(() => {
    game.combat = null;
  });

  describe("canUsePerk", () => {
    test("true, not yet used this scene", () => {
      const item = makePerkItem({ sourceId: SPRINTER_ID, actor: makeActor() });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false once already used this scene", () => {
      const actor = makeActor();
      actor.getFlag = jest.fn(() => ({ combatId: 'combat1' }));
      const item = makePerkItem({ sourceId: SPRINTER_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("activates and marks the scene used", async () => {
    const actor = makeActor();
    const item = makePerkItem({ sourceId: SPRINTER_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'sprinterBoostActive', true);
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("does nothing once already used this scene", async () => {
    const actor = makeActor();
    actor.getFlag = jest.fn(() => ({ combatId: 'combat1' }));
    const item = makePerkItem({ sourceId: SPRINTER_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe("Two Heads Are Better Than One (Technorganic Secrets, General Perk, p.46)", () => {
  const TWO_HEADS_ARE_BETTER_THAN_ONE_ID = "Compendium.essence20.technorganic_secrets.Item.2SGJ4ezuiZgb7JqX";

  function makeTargetsSet(targetActor) {
    const token = { actor: targetActor };
    const set = new Set(targetActor ? [token] : []);
    set.first = () => (targetActor ? token : undefined);
    return set;
  }

  beforeEach(() => {
    game.combat = { id: 'combat1', round: 1, turn: 0 };
    game.user.targets = makeTargetsSet(undefined);
    ui.notifications.warn.mockReset();
    global.ChatMessage.create?.mockReset();
  });

  afterEach(() => {
    game.combat = null;
  });

  describe("canUsePerk", () => {
    test("true, not yet used this scene", () => {
      const actor = makeActor();
      const item = makePerkItem({ sourceId: TWO_HEADS_ARE_BETTER_THAN_ONE_ID, actor });
      expect(canUsePerk(item)).toBe(true);
    });

    test("false once already used this scene", () => {
      const actor = makeActor();
      actor.getFlag = jest.fn(() => ({ combatId: 'combat1' }));
      const item = makePerkItem({ sourceId: TWO_HEADS_ARE_BETTER_THAN_ONE_ID, actor });
      expect(canUsePerk(item)).toBe(false);
    });
  });

  test("marks the currently-targeted token's actor and notifies", async () => {
    const actor = makeActor({ id: 'ts1' });
    const targetActor = { uuid: 'Actor.target1' };
    game.user.targets = makeTargetsSet(targetActor);
    const item = makePerkItem({ sourceId: TWO_HEADS_ARE_BETTER_THAN_ONE_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'twoHeadsAssistanceTargetUuid', 'Actor.target1');
    expect(global.ChatMessage.create).toHaveBeenCalled();
  });

  test("warns and sets no flag when nothing is targeted", async () => {
    const actor = makeActor({ id: 'ts1' });
    game.user.targets = makeTargetsSet(undefined);
    const item = makePerkItem({ sourceId: TWO_HEADS_ARE_BETTER_THAN_ONE_ID, actor });

    await onPerkUse(item);

    expect(ui.notifications.warn).toHaveBeenCalled();
    expect(actor.setFlag).not.toHaveBeenCalled();
  });

  test("does nothing once already used this scene", async () => {
    const actor = makeActor({ id: 'ts1' });
    actor.getFlag = jest.fn(() => ({ combatId: 'combat1' }));
    const targetActor = { uuid: 'Actor.target1' };
    game.user.targets = makeTargetsSet(targetActor);
    const item = makePerkItem({ sourceId: TWO_HEADS_ARE_BETTER_THAN_ONE_ID, actor });

    await onPerkUse(item);

    expect(actor.setFlag).not.toHaveBeenCalled();
    expect(global.ChatMessage.create).not.toHaveBeenCalled();
  });
});
