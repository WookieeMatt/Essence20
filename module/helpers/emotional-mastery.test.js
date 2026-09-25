import { jest } from '@jest/globals';
import {
  activateEmotionalMastery, activateEmotionalMasterySurprise, activateTeamSpirit,
  checkEmotionalStrengthAngerTrigger, clearEmotionalMasteryOnMorphOff, deactivateEmotionalMastery,
  deactivateShynessOnAttack, deactivateShynessOnDamage, EMOTIONAL_MASTERY_ID, EMOTIONAL_STRENGTH_ID,
  getActiveEmotionalMasteryOptions, getDistressMovementBonus, getMaxActiveEmotionalMastery,
  hasContemptResistance, isEmotionalMasteryOptionActive, pickHeartsCallingOption,
} from './emotional-mastery.mjs';

const ADAPTION_1_ID = "Compendium.essence20.jump_through_time.Item.diexsL5zyTuJsSPu";
const ADAPTION_2_ID = "Compendium.essence20.jump_through_time.Item.0bw6c3XfIYcQeGgN";

global.ui = { notifications: { warn: jest.fn(), error: jest.fn() } };
global.game = {
  i18n: { localize: (k) => k, format: (k) => k },
  combat: null,
  user: { targets: { first: jest.fn(() => null) } },
};
global.fromUuidSync = jest.fn();

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

function makeActor({
  id = 'actor1', perkIds = [], isMorphed = true, power = 3, powerMax = 10,
  flags = {}, name = 'Actor',
} = {}) {
  const items = perkIds.map(perkId => ({
    type: 'perk',
    flags: { core: { sourceId: perkId } },
    system: { reroll: { enabled: false } },
    update: jest.fn(),
  }));

  const flagStore = { ...flags };
  const statuses = new Set();
  return {
    id,
    name,
    uuid: `Actor.${id}`,
    items,
    statuses,
    system: { isMorphed, powers: { personal: { value: power, max: powerMax } } },
    getFlag: jest.fn((scope, key) => (scope == 'essence20' ? flagStore[key] : undefined)),
    setFlag: jest.fn(async (scope, key, value) => {
      if (scope == 'essence20') {
        flagStore[key] = value;
      }
    }),
    toggleStatusEffect: jest.fn(async (status, { active }) => {
      if (active) {
        statuses.add(status);
      } else {
        statuses.delete(status);
      }
    }),
    getActiveTokens: jest.fn(() => [{ document: { disposition: 1 }, center: { distance: 0 } }]),
    update: jest.fn(async function (data) {
      for (const [path, value] of Object.entries(data)) {
        const keys = path.replace(/^system\./, '').split('.');
        let target = this.system;
        for (let i = 0; i < keys.length - 1; i++) {
          target = target[keys[i]];
        }

        target[keys[keys.length - 1]] = value;
      }
    }),
  };
}

function emotionalMasteryItem(actor) {
  return actor.items.find(i => i.flags.core.sourceId == EMOTIONAL_MASTERY_ID);
}

beforeEach(() => {
  ui.notifications.warn.mockClear();
  ui.notifications.error.mockClear();
  foundry.applications.api.DialogV2 = { wait: jest.fn() };
});

describe("getMaxActiveEmotionalMastery", () => {
  test("1 with neither Adaption Perk", () => {
    expect(getMaxActiveEmotionalMastery(makeActor())).toBe(1);
  });

  test("2 with Adaption 1", () => {
    expect(getMaxActiveEmotionalMastery(makeActor({ perkIds: [ADAPTION_1_ID] }))).toBe(2);
  });

  test("3 with Adaption 2 (takes priority over Adaption 1)", () => {
    expect(getMaxActiveEmotionalMastery(makeActor({ perkIds: [ADAPTION_1_ID, ADAPTION_2_ID] }))).toBe(3);
  });
});

describe("getActiveEmotionalMasteryOptions / isEmotionalMasteryOptionActive", () => {
  test("empty by default", () => {
    expect(getActiveEmotionalMasteryOptions(makeActor())).toEqual([]);
    expect(isEmotionalMasteryOptionActive(makeActor(), 'fear')).toBe(false);
  });

  test("true once activated directly", () => {
    const actor = makeActor({ flags: { activeEmotionalMastery: ['fear'] } });
    expect(isEmotionalMasteryOptionActive(actor, 'fear')).toBe(true);
    expect(isEmotionalMasteryOptionActive(actor, 'sadness')).toBe(false);
  });

  test("true via a live Team Spirit grant from a caster who's still active", () => {
    const caster = makeActor({ id: 'caster', flags: { activeEmotionalMastery: ['fear'] } });
    global.fromUuidSync.mockReturnValue(caster);
    const ally = makeActor({ id: 'ally', flags: { teamSpiritOption: { option: 'fear', casterUuid: caster.uuid } } });

    expect(isEmotionalMasteryOptionActive(ally, 'fear')).toBe(true);
  });

  test("false once the caster has switched away from the granted option", () => {
    const caster = makeActor({ id: 'caster', flags: { activeEmotionalMastery: ['sadness'] } });
    global.fromUuidSync.mockReturnValue(caster);
    const ally = makeActor({ id: 'ally', flags: { teamSpiritOption: { option: 'fear', casterUuid: caster.uuid } } });

    expect(isEmotionalMasteryOptionActive(ally, 'fear')).toBe(false);
  });
});

describe("activateEmotionalMastery", () => {
  test("does nothing when the picker is cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeActor({ perkIds: [EMOTIONAL_MASTERY_ID] });

    expect(await activateEmotionalMastery(actor)).toBe(false);
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("activates the chosen option and spends 1 Power while Morphed", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('fear');
    const actor = makeActor({ perkIds: [EMOTIONAL_MASTERY_ID], power: 3 });

    expect(await activateEmotionalMastery(actor)).toBe(true);
    expect(actor.system.powers.personal.value).toBe(2);
    expect(getActiveEmotionalMasteryOptions(actor)).toEqual(['fear']);
  });

  test("refuses while not Morphed and not the actor's Heart's Calling option", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('fear');
    const actor = makeActor({ perkIds: [EMOTIONAL_MASTERY_ID], isMorphed: false });

    expect(await activateEmotionalMastery(actor)).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.EmotionalMasteryNotMorphed');
  });

  test("allows the Heart's Calling option unmorphed, for free", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('fear');
    const actor = makeActor({
      perkIds: [EMOTIONAL_MASTERY_ID], isMorphed: false, power: 3,
      flags: { heartsCallingOption: 'fear' },
    });

    expect(await activateEmotionalMastery(actor)).toBe(true);
    expect(actor.system.powers.personal.value).toBe(3); // unspent
    expect(getActiveEmotionalMasteryOptions(actor)).toEqual(['fear']);
  });

  test("refuses when the actor can't afford the Power cost", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('fear');
    const actor = makeActor({ perkIds: [EMOTIONAL_MASTERY_ID], power: 0 });

    expect(await activateEmotionalMastery(actor)).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.EmotionalMasteryCannotAfford');
  });

  test("replaces the current option by default when at capacity", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('sadness');
    const actor = makeActor({ perkIds: [EMOTIONAL_MASTERY_ID], flags: { activeEmotionalMastery: ['fear'] } });

    await activateEmotionalMastery(actor);
    expect(getActiveEmotionalMasteryOptions(actor)).toEqual(['sadness']);
  });

  test("with Adaption 1 and room to spare, offers to add an additional option instead of replacing", async () => {
    foundry.applications.api.DialogV2.wait
      .mockResolvedValueOnce('sadness')
      .mockResolvedValueOnce('add');
    const actor = makeActor({
      perkIds: [EMOTIONAL_MASTERY_ID, ADAPTION_1_ID], power: 5,
      flags: { activeEmotionalMastery: ['fear'] },
    });

    await activateEmotionalMastery(actor);
    expect(getActiveEmotionalMasteryOptions(actor)).toEqual(['fear', 'sadness']);
    expect(actor.system.powers.personal.value).toBe(4);
  });

  test("choosing 'replace' in that same dialog still overwrites instead of adding", async () => {
    foundry.applications.api.DialogV2.wait
      .mockResolvedValueOnce('sadness')
      .mockResolvedValueOnce('replace');
    const actor = makeActor({
      perkIds: [EMOTIONAL_MASTERY_ID, ADAPTION_1_ID],
      flags: { activeEmotionalMastery: ['fear'] },
    });

    await activateEmotionalMastery(actor);
    expect(getActiveEmotionalMasteryOptions(actor)).toEqual(['sadness']);
  });

  test("activating Guilt enables the Emotional Mastery item's own reroll config", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('guilt');
    const actor = makeActor({ perkIds: [EMOTIONAL_MASTERY_ID] });

    await activateEmotionalMastery(actor);
    expect(emotionalMasteryItem(actor).update).toHaveBeenCalledWith({
      'system.reroll': expect.objectContaining({ enabled: true, target: 'd20', mode: 'ones' }),
    });
  });

  test("switching away from Guilt disables the reroll config again", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('fear');
    const actor = makeActor({ perkIds: [EMOTIONAL_MASTERY_ID], flags: { activeEmotionalMastery: ['guilt'] } });
    emotionalMasteryItem(actor).system.reroll.enabled = true;

    await activateEmotionalMastery(actor);
    expect(emotionalMasteryItem(actor).update).toHaveBeenCalledWith({ 'system.reroll': { enabled: false } });
  });

  test("activating Surprise in combat also places the actor in the Initiative order", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('surprise');
    const actor = makeActor({ perkIds: [EMOTIONAL_MASTERY_ID], id: 'me' });
    const targetActor = makeActor({ id: 'target' });
    game.user.targets.first.mockReturnValue({ actor: targetActor });
    const combatant = { actor: { id: 'me' }, update: jest.fn() };
    const targetCombatant = { actor: { id: 'target' }, initiative: 10 };
    game.combat = { combatants: [combatant, targetCombatant] };

    await activateEmotionalMastery(actor);
    expect(combatant.update).toHaveBeenCalledWith({ initiative: 9.99 });
    game.combat = null;
  });
});

describe("deactivateEmotionalMastery", () => {
  test("removes just the given option", async () => {
    const actor = makeActor({ perkIds: [EMOTIONAL_MASTERY_ID], flags: { activeEmotionalMastery: ['fear', 'sadness'] } });
    await deactivateEmotionalMastery(actor, 'fear');
    expect(getActiveEmotionalMasteryOptions(actor)).toEqual(['sadness']);
  });
});

describe("clearEmotionalMasteryOnMorphOff", () => {
  test("clears every active option", async () => {
    const actor = makeActor({ perkIds: [EMOTIONAL_MASTERY_ID], flags: { activeEmotionalMastery: ['fear'] } });
    await clearEmotionalMasteryOnMorphOff(actor);
    expect(getActiveEmotionalMasteryOptions(actor)).toEqual([]);
  });

  test("keeps the actor's own Heart's Calling option active", async () => {
    const actor = makeActor({
      perkIds: [EMOTIONAL_MASTERY_ID],
      flags: { activeEmotionalMastery: ['fear', 'sadness'], heartsCallingOption: 'fear' },
    });
    await clearEmotionalMasteryOnMorphOff(actor);
    expect(getActiveEmotionalMasteryOptions(actor)).toEqual(['fear']);
  });
});

describe("pickHeartsCallingOption", () => {
  test("stores the chosen option", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('joy');
    const actor = makeActor();
    await pickHeartsCallingOption(actor);
    expect(actor.getFlag('essence20', 'heartsCallingOption')).toBe('joy');
  });

  test("does nothing when cancelled", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('cancel');
    const actor = makeActor();
    await pickHeartsCallingOption(actor);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

describe("activateTeamSpirit", () => {
  test("warns with no active option", async () => {
    const actor = makeActor();
    expect(await activateTeamSpirit(actor)).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.TeamSpiritNoActiveOption');
  });

  test("warns with no target", async () => {
    const actor = makeActor({ flags: { activeEmotionalMastery: ['fear'] } });
    game.user.targets.first.mockReturnValue(null);
    expect(await activateTeamSpirit(actor)).toBe(false);
    expect(ui.notifications.warn).toHaveBeenCalledWith('E20.MarkTargetNoTarget');
  });

  test("spends 1 Power and grants the ally the caster's sole active option", async () => {
    const actor = makeActor({ id: 'caster', flags: { activeEmotionalMastery: ['fear'] }, power: 2 });
    const ally = makeActor({ id: 'ally' });
    game.user.targets.first.mockReturnValue({ actor: ally });

    expect(await activateTeamSpirit(actor)).toBe(true);
    expect(actor.system.powers.personal.value).toBe(1);
    expect(ally.getFlag('essence20', 'teamSpiritOption')).toEqual({ option: 'fear', casterUuid: actor.uuid });
  });

  test("prompts which active option to share when more than one is active", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('sadness');
    const actor = makeActor({ id: 'caster', flags: { activeEmotionalMastery: ['fear', 'sadness'] } });
    const ally = makeActor({ id: 'ally' });
    game.user.targets.first.mockReturnValue({ actor: ally });

    await activateTeamSpirit(actor);
    expect(ally.getFlag('essence20', 'teamSpiritOption')).toEqual({ option: 'sadness', casterUuid: actor.uuid });
  });
});

describe("activateEmotionalMasterySurprise", () => {
  test("false when Surprise isn't active", async () => {
    const actor = makeActor({ flags: { activeEmotionalMastery: ['fear'] } });
    game.combat = { combatants: [] };
    expect(await activateEmotionalMasterySurprise(actor)).toBe(false);
    game.combat = null;
  });

  test("false outside combat", async () => {
    const actor = makeActor({ flags: { activeEmotionalMastery: ['surprise'] } });
    expect(await activateEmotionalMasterySurprise(actor)).toBe(false);
  });

  test("sets the actor's own Combatant#initiative just below the target's", async () => {
    const actor = makeActor({ id: 'me', flags: { activeEmotionalMastery: ['surprise'] } });
    const targetActor = makeActor({ id: 'target' });
    game.user.targets.first.mockReturnValue({ actor: targetActor });
    const combatant = { actor: { id: 'me' }, update: jest.fn() };
    const targetCombatant = { actor: { id: 'target' }, initiative: 15 };
    game.combat = { combatants: [combatant, targetCombatant] };

    expect(await activateEmotionalMasterySurprise(actor)).toBe(true);
    expect(combatant.update).toHaveBeenCalledWith({ initiative: 14.99 });
    game.combat = null;
  });
});

describe("checkEmotionalStrengthAngerTrigger", () => {
  let originalCombat;
  beforeEach(() => {
    originalCombat = global.game.combat;
    global.game.combat = { id: 'combat1', round: 1, turn: 0 };
  });
  afterEach(() => {
    global.game.combat = originalCombat;
  });

  test("no-op without Emotional Strength", async () => {
    const actor = makeActor({ flags: { activeEmotionalMastery: ['anger'] } });
    await checkEmotionalStrengthAngerTrigger(actor);
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("no-op without Anger active", async () => {
    const actor = makeActor({ perkIds: [EMOTIONAL_STRENGTH_ID], flags: { activeEmotionalMastery: ['fear'] } });
    await checkEmotionalStrengthAngerTrigger(actor);
    expect(actor.update).not.toHaveBeenCalled();
  });

  test("regains 1d2 Power once per scene", async () => {
    FakeRoll.nextTotal = 2;
    const actor = makeActor({
      perkIds: [EMOTIONAL_STRENGTH_ID], flags: { activeEmotionalMastery: ['anger'] }, power: 3, powerMax: 10,
    });

    await checkEmotionalStrengthAngerTrigger(actor);
    expect(actor.system.powers.personal.value).toBe(5);
    expect(actor.getFlag('essence20', 'emotionalStrengthUsedThisEncounter')).toBeTruthy();
  });

  test("doesn't exceed the actor's own Power max", async () => {
    FakeRoll.nextTotal = 2;
    const actor = makeActor({
      perkIds: [EMOTIONAL_STRENGTH_ID], flags: { activeEmotionalMastery: ['anger'] }, power: 9, powerMax: 10,
    });

    await checkEmotionalStrengthAngerTrigger(actor);
    expect(actor.system.powers.personal.value).toBe(10);
  });

  test("doesn't trigger again once already used this encounter", async () => {
    const actor = makeActor({
      perkIds: [EMOTIONAL_STRENGTH_ID], power: 3,
      flags: {
        activeEmotionalMastery: ['anger'],
        emotionalStrengthUsedThisEncounter: { epoch: 1, window: 'encounter', count: 1 },
      },
    });

    await checkEmotionalStrengthAngerTrigger(actor);
    expect(actor.update).not.toHaveBeenCalled();
  });
});

describe("hasContemptResistance", () => {
  test("true only for the matching damage type while Contempt is active", () => {
    const actor = makeActor({ flags: { activeEmotionalMastery: ['contempt'], contemptDamageType: 'fire' } });
    expect(hasContemptResistance(actor, 'fire')).toBe(true);
    expect(hasContemptResistance(actor, 'cold')).toBe(false);
  });

  test("false without Contempt active, even with a stored damage type", () => {
    const actor = makeActor({ flags: { activeEmotionalMastery: ['fear'], contemptDamageType: 'fire' } });
    expect(hasContemptResistance(actor, 'fire')).toBe(false);
  });
});

describe("activateEmotionalMastery - Contempt's damage-type sub-picker", () => {
  test("prompts for a damage type and stores it", async () => {
    foundry.applications.api.DialogV2.wait
      .mockResolvedValueOnce('contempt')
      .mockResolvedValueOnce('acid');
    const actor = makeActor();

    expect(await activateEmotionalMastery(actor)).toBe(true);
    expect(actor.getFlag('essence20', 'contemptDamageType')).toBe('acid');
    expect(getActiveEmotionalMasteryOptions(actor)).toEqual(['contempt']);
  });

  test("cancelling the damage-type picker aborts the whole activation", async () => {
    foundry.applications.api.DialogV2.wait
      .mockResolvedValueOnce('contempt')
      .mockResolvedValueOnce('cancel');
    const actor = makeActor();

    expect(await activateEmotionalMastery(actor)).toBe(false);
    expect(actor.update).not.toHaveBeenCalled();
    expect(getActiveEmotionalMasteryOptions(actor)).toEqual([]);
  });
});

describe("Shyness - status toggle on activate/deactivate", () => {
  test("activating Shyness turns on the real invisible status", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('shyness');
    const actor = makeActor();

    await activateEmotionalMastery(actor);
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('invisible', { active: true });
    expect(actor.statuses.has('invisible')).toBe(true);
  });

  test("switching away from Shyness turns the status back off", async () => {
    foundry.applications.api.DialogV2.wait.mockResolvedValue('fear');
    const actor = makeActor({ flags: { activeEmotionalMastery: ['shyness'] } });
    actor.statuses.add('invisible');

    await activateEmotionalMastery(actor);
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith('invisible', { active: false });
    expect(actor.statuses.has('invisible')).toBe(false);
  });

  test("manually deactivating Shyness also clears the status", async () => {
    const actor = makeActor({ flags: { activeEmotionalMastery: ['shyness'] } });
    actor.statuses.add('invisible');

    await deactivateEmotionalMastery(actor, 'shyness');
    expect(actor.statuses.has('invisible')).toBe(false);
  });

  test("de-Morphing clears Shyness's own status too", async () => {
    const actor = makeActor({ flags: { activeEmotionalMastery: ['shyness'] } });
    actor.statuses.add('invisible');

    await clearEmotionalMasteryOnMorphOff(actor);
    expect(actor.statuses.has('invisible')).toBe(false);
  });
});

describe("deactivateShynessOnAttack / deactivateShynessOnDamage", () => {
  test("deactivateShynessOnAttack clears Shyness when active", async () => {
    const actor = makeActor({ flags: { activeEmotionalMastery: ['shyness'] } });
    actor.statuses.add('invisible');

    await deactivateShynessOnAttack(actor);
    expect(getActiveEmotionalMasteryOptions(actor)).toEqual([]);
    expect(actor.statuses.has('invisible')).toBe(false);
  });

  test("deactivateShynessOnDamage clears Shyness when active", async () => {
    const actor = makeActor({ flags: { activeEmotionalMastery: ['shyness'] } });
    actor.statuses.add('invisible');

    await deactivateShynessOnDamage(actor);
    expect(getActiveEmotionalMasteryOptions(actor)).toEqual([]);
  });

  test("both no-op without Shyness active", async () => {
    const actor = makeActor({ flags: { activeEmotionalMastery: ['fear'] } });

    await deactivateShynessOnAttack(actor);
    await deactivateShynessOnDamage(actor);
    expect(actor.setFlag).not.toHaveBeenCalledWith('essence20', 'activeEmotionalMastery', expect.anything());
  });
});

describe("getDistressMovementBonus", () => {
  let originalCanvas;
  beforeEach(() => {
    originalCanvas = global.canvas;
  });
  afterEach(() => {
    global.canvas = originalCanvas;
  });

  function setNearbyEnemy(actor, enemyDistance) {
    const actorToken = actor.getActiveTokens()[0];
    const enemyToken = { document: { disposition: -1 }, center: { distance: enemyDistance }, actor: {} };
    global.canvas = {
      tokens: { placeables: [actorToken, enemyToken] },
      grid: { measurePath: jest.fn(([otherCenter]) => ({ distance: otherCenter.distance ?? 0 })) },
    };
  }

  test("returns 10 with an enemy within 10ft while Distress is active", () => {
    const actor = makeActor({ flags: { activeEmotionalMastery: ['distress'] } });
    setNearbyEnemy(actor, 5);
    expect(getDistressMovementBonus(actor)).toBe(10);
  });

  test("returns 0 with no nearby enemy", () => {
    const actor = makeActor({ flags: { activeEmotionalMastery: ['distress'] } });
    setNearbyEnemy(actor, 20);
    expect(getDistressMovementBonus(actor)).toBe(0);
  });

  test("returns 0 without Distress active, even with a nearby enemy", () => {
    const actor = makeActor({ flags: { activeEmotionalMastery: ['fear'] } });
    setNearbyEnemy(actor, 5);
    expect(getDistressMovementBonus(actor)).toBe(0);
  });
});
