import { Dice } from "./dice.mjs";
import { jest } from '@jest/globals';

/* Setup Mocks */

const chatMessage = jest.mock();
chatMessage.getSpeaker = jest.fn();
chatMessage.getSpeaker.mockReturnValue({});
chatMessage.create = jest.fn();

class Mocki18n {
  localize(text) {
    return text;
  }
  /* eslint-disable no-unused-vars */
  format(text, _) {
    return text;
  }
}

global.game = {
  i18n: {
    localize: (key) => key,
    format: (key, vars) => `${key}:${JSON.stringify(vars)}`,
  },
  user: {
    targets: {
      first: jest.fn(() => undefined),
    },
  },
  // Empty by default so mechanics/combat/defense-choice.mjs#chooseDefenderDefense (called for every
  // attack roll with a real target, as of dice.mjs's own per-target resolvedDefenseType) finds no
  // player owner and no GM to ask, falling straight through to its own "return the suggested
  // Defense" fallback - preserving every one of this file's existing tests' own assumption that
  // whatever Defense the weapon/dataset already specifies is exactly what gets used, with no
  // dialog or socket call involved. Tests that actually exercise the defender-choice mechanic
  // itself override this locally.
  users: [],
  combat: null,
};

// Only Enemy Number One (items/social/enemy-number-one.mjs) actually reaches into canvas from this
// file's own tests - every other canvas-touching helper (e.g. ruleDefenseAura) short-
// circuits first on a falsy actor.getActiveTokens?.()?.[0], which none of this file's other mock
// actors define.
global.canvas = {
  tokens: {
    placeables: [],
  },
  grid: {
    measurePath: jest.fn(() => ({ distance: 0 })),
  },
};

const mockActor = {
  items: [],
  statuses: new Set(),
  system: {
    size: 'common',
    initiative: {
      formula: "",
      skill: "initiative",
    },
    essenceShifts: {
      any: {
        shiftDown: 0,
        shiftUp: 0,
      },
      strength: {
        shiftDown: 0,
        shiftUp: 0,
      },
      speed: {
        shiftDown: 0,
        shiftUp: 0,
      },
      smarts: {
        shiftDown: 0,
        shiftUp: 0,
      },
      social: {
        shiftDown: 0,
        shiftUp: 0,
      },
    },
    skills: {
      initiative: {
        modifier: 0,
        shift: "d20",
        shiftDown: 0,
        shiftUp: 0,
      },
    },
  },
};

function createMockRollDialog() {
  const rollDialog = jest.mock();
  rollDialog.getSkillRollOptions = jest.fn();
  rollDialog.getSkillRollOptions.mockReturnValue({
    canCritD2: false,
    edge: false,
    shiftDown: 0,
    shiftUp: 0,
    snag: false,
    isSpecialized: false,
    timesToRoll: 1,
  });

  return rollDialog;
}

const dice = new Dice(chatMessage, createMockRollDialog(), new Mocki18n());

/* Begin Tests */

/* prepareInitiativeRoll */
describe("prepareInitiativeRoll", () => {
  test("normal initiative roll", async () => {
    const rollDialog = createMockRollDialog();
    rollDialog.getSkillRollOptions.mockReturnValue({
      canCritD2: false,
      edge: false,
      shiftDown: 0,
      shiftUp: 0,
      snag: true, // Because d20 shift
      isSpecialized: false,
      timesToRoll: 1,
    });
    const mockInitActor = {...mockActor};
    mockInitActor.update = jest.fn();

    await dice.prepareInitiativeRoll(mockInitActor);
    expect(mockInitActor.update).toHaveBeenCalledWith({
      "system.initiative.formula": "2d20kl + 0",
    });
  });

  test("item rules: roll:initiative RollModifiers add their shifts and Edge; DialogSwitches are offered", async () => {
    const rules = [
      { type: 'RollModifier', label: 'Quick', upshift: 1, edge: true, when: ['roll:initiative'] },
      { type: 'RollModifier', label: 'Not here', upshift: 3, when: ['skill:athletics'] },
      { type: 'DialogSwitch', label: 'Fast talk', useSkill: 'deception' },
    ];
    const actor = {
      ...mockActor,
      system: { ...mockActor.system, skills: { ...mockActor.system.skills, deception: { shift: 'd6' } } },
      items: [{ id: 'ruled', type: 'perk', name: 'Ruled', flags: {}, system: { rules } }],
      update: jest.fn(),
    };
    await dice.prepareInitiativeRoll(actor);
    const [dataset, skillDataset] = dice._rollDialog.getSkillRollOptions.mock.calls.at(-1);
    expect(dataset.shiftUp).toBe(1);
    expect(skillDataset.edge).toBe(true);
    expect(dataset.combatModifierSources.map(source => source.label)).toEqual(['Quick']);
    expect(dataset.extToggles.map(toggle => toggle.label)).toEqual(['Fast talk']);
  });

  test("item rules: a roll:initiative RollModifier with specialize makes Initiative Specialized", async () => {
    const actor = {
      ...mockActor,
      items: [{ id: 'springy', type: 'perk', name: 'Springy', flags: {}, system: { rules: [{ type: 'RollModifier', specialize: true, when: ['roll:initiative'] }] } }],
      update: jest.fn(),
    };
    await dice.prepareInitiativeRoll(actor);
    const [dataset] = dice._rollDialog.getSkillRollOptions.mock.calls.at(-1);
    expect(dataset.isSpecialized).toBe(true);
  });

  describe("Enhanced Initiative (Transformers Combiner Feature, Enigma of Combination, p.42)", () => {
    function makeInitActor({ type = 'megaform', hasEnhancedInitiative = false } = {}) {
      return {
        ...mockActor, type, system: { ...mockActor.system, hasEnhancedInitiative }, update: jest.fn(),
      };
    }

    test("grants Edge on a Combiner form's own Initiative roll", async () => {
      await dice.prepareInitiativeRoll(makeInitActor({ hasEnhancedInitiative: true }));
      const [, skillDataset] = dice._rollDialog.getSkillRollOptions.mock.calls.at(-1);
      expect(skillDataset.edge).toBe(true);
    });

    test("doesn't apply without the flag", async () => {
      await dice.prepareInitiativeRoll(makeInitActor({ hasEnhancedInitiative: false }));
      const [, skillDataset] = dice._rollDialog.getSkillRollOptions.mock.calls.at(-1);
      expect(skillDataset.edge).toBeFalsy();
    });

    test("doesn't apply to a non-megaform actor even if the field is somehow set", async () => {
      await dice.prepareInitiativeRoll(makeInitActor({ type: 'playerCharacter', hasEnhancedInitiative: true }));
      const [, skillDataset] = dice._rollDialog.getSkillRollOptions.mock.calls.at(-1);
      expect(skillDataset.edge).toBeFalsy();
    });
  });

  // Relic Key's one-roll Edge is a banked Edge from its Feature's Use rule (rules/conv15-items2.test.js).

  describe("Warrior Mode (PR CRB, Zord Feature, p.140) - Initiative half", () => {
    function makeInitActor({ active = false } = {}) {
      const flagStore = { warriorModeActive: active };
      return {
        ...mockActor,
        update: jest.fn(),
        getFlag: jest.fn((scope, key) => flagStore[key]),
      };
    }

    test("grants ↑2 on the Initiative roll while active", async () => {
      await dice.prepareInitiativeRoll(makeInitActor({ active: true }));
      const [dataset] = dice._rollDialog.getSkillRollOptions.mock.calls.at(-1);
      expect(dataset.shiftUp).toBe(2);
    });

    test("doesn't apply while inactive", async () => {
      await dice.prepareInitiativeRoll(makeInitActor({ active: false }));
      const [dataset] = dice._rollDialog.getSkillRollOptions.mock.calls.at(-1);
      expect(dataset.shiftUp).toBe(0);
    });
  });

});

/* rollSkill */
describe("rollSkill", () => {
  const dataset = {
    aimBonus: null,

    aimedByAction: false,
    canCritD2: false,
    damageRolePoints: null,
    defenseType: "none",
    energonAvailable: false,

    storyPointSpecializedAvailable: false,
    essence: 'strength',
    hardpointMovement: null,
    isSpecialized: false,

    rolePoints: null,
    shift: 'd20',
    shiftDown: '0',
    shiftUp: '0',
    skill: 'athletics',
  };

  test("normal skill roll", async () => {
    const rollDialog = createMockRollDialog();
    rollDialog.getSkillRollOptions.mockReturnValue({
      canCritD2: false,
      edge: false,
      snag: false,
      shiftUp: 0,
      shiftDown: 0,
      timesToRoll: 1,
    });
    mockActor.getRollData = jest.fn(() => ({
      skills: {
        'athletics': {
          modifier: '0',
          shift: 'd20',
        },
      },
    }));
    dice._rollSkillHelper = jest.fn();

    await dice.rollSkill(dataset, mockActor, null);
    expect(dice._rollSkillHelper).toHaveBeenCalledWith('d20 + 0', mockActor, "E20.RollRollingFor E20.SkillAthletics", false, null, { skill: 'athletics', essence: 'strength', finalShift: 'd20', snag: false, isPowerWeaponAttack: false, isUnarmedAttack: false, isMeleeAttack: false, isConsumableOrWreckerRangedAttack: false, consummatePerformer: false, isMelee: false, isAttack: false, itemUuid: null, targetUuid: null, defenseType: null, smallerTarget: false }, false);
  });

  // Enviro-Sealed (Across the Stars p.85): in a hostile environment the dialog's checkbox starts
  // ticked and grants the Edge from there, instead of an Edge forced on ahead of the dialog that
  // the (unticked) checkbox couldn't explain or take back.
  test("Enviro-Sealed in a hostile environment starts its checkbox ticked, with no pre-set Edge", async () => {
    const rollDialog = createMockRollDialog();
    rollDialog.getSkillRollOptions.mockReturnValue({
      canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
    });
    dice._rollSkillHelper = jest.fn();
    const items = [{ type: 'armor', system: { equipped: true, traits: ['enviroSealed'] } }];
    items.documentsByType = { armor: items };
    const vacuumToken = {
      documentName: 'Token', regions: [],
      parent: { getFlag: (scope, key) => (key == 'environment' ? 'vacuum' : undefined) },
    };
    const sealed = { ...mockActor, documentName: 'Actor', items, getActiveTokens: () => [vacuumToken] };
    sealed.getRollData = jest.fn(() => ({ skills: { athletics: { modifier: '0', shift: 'd20' } } }));

    await dice.rollSkill(dataset, sealed, null);
    const [dialogDataset, skillDataset] = rollDialog.getSkillRollOptions.mock.calls[0];
    expect(dialogDataset.enviroSealedAdverseSituationAvailable).toBe(true);
    expect(dialogDataset.enviroSealedAdverseSituationChecked).toBe(true);
    expect(skillDataset.edge).toBeFalsy();
  });

  test("a specialization's own shiftUp/edge merge into the roll (see essence20-specialization-redesign)", async () => {
    mockActor.getRollData = jest.fn(() => ({
      skills: {
        'athletics': {
          modifier: '0',
          shift: 'd8',
        },
      },
    }));
    mockActor.system.skills.athletics = {
      shift: 'd8',
      specializations: {
        climbing: { name: 'Climbing', shiftUp: 2, shiftDown: 0, edge: true, snag: false },
      },
    };
    dice._rollSkillHelper = jest.fn();

    const datasetWithSpecialization = { ...dataset, shift: 'd8', specializationKey: 'climbing' };
    await dice.rollSkill(datasetWithSpecialization, mockActor, null);

    const [updatedShiftDataset, skillDataset] = dice._rollDialog.getSkillRollOptions.mock.calls.at(-1);
    expect(updatedShiftDataset.shiftUp).toBe(2);
    expect(skillDataset.edge).toBe(true);

    delete mockActor.system.skills.athletics;
  });

  describe("Beastly (Factions in Action Vol. 1, Influence Perk, p.75)", () => {
    // The waiver lives only in documents/item.mjs (zeroes the effect's own shiftDown before it
    // reaches the roller). dice.mjs used to add a second cancelling ↑1, netting ↑1 overall.
    const BEASTLY_ID = "Compendium.essence20.ferocious_fighters.Item.3Y0ETFpJUwdUqgUQ";

    test.each([
      ['GI Joe CRB', "Compendium.essence20.gi_joe_crb.Item.gA0rOFD3lmwzkZq4"],
      ['Transformers CRB', "Compendium.essence20.tf_crb.Item.gA0rOFD3lmwzkZq4"],
    ])("the roller adds no extra ↑1 on top of the item-level waiver (%s printing)", async (_n, sourceId) => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();
      const actor = {
        ...mockActor,
        items: [{ type: 'perk', flags: { core: { sourceId: BEASTLY_ID } } }],
        system: { ...mockActor.system, essenceShifts: { ...mockActor.system.essenceShifts } },
        getRollData: jest.fn(() => ({ skills: { finesse: { modifier: '0', shift: 'd8' } } })),
      };
      const effect = {
        type: 'weaponEffect',
        name: 'Unarmed Combat Alternate Effect 1',
        flags: { core: { sourceId } },
        system: { damageValue: 1, damageType: 'blunt', shiftDown: 0, classification: { skill: 'finesse' } },
      };

      await dice.rollSkill({ ...dataset, skill: 'finesse', shift: 'd8' }, actor, effect);

      expect(rollDialog.getSkillRollOptions.mock.calls[0][0].shiftUp).toBe(0);
    });
  });

  test("normal skill roll works with isSpecialized as false string", async () => {
    const datasetCopy = {
      ...dataset,
      isSpecialized: 'false',
    };
    const rollDialog = createMockRollDialog();
    rollDialog.getSkillRollOptions.mockReturnValue({
      canCritD2: false,
      edge: false,
      snag: false,
      shiftUp: 0,
      shiftDown: 0,
      timesToRoll: 1,
    });
    mockActor.getRollData = jest.fn(() => ({
      skills: {
        'athletics': {
          modifier: '0',
          shift: 'd20',
        },
      },
    }));
    dice._rollSkillHelper = jest.fn();

    await dice.rollSkill(dataset, mockActor, null);
    expect(dice._rollSkillHelper).toHaveBeenCalledWith('d20 + 0', mockActor, "E20.RollRollingFor E20.SkillAthletics", false, null, { skill: 'athletics', essence: 'strength', finalShift: 'd20', snag: false, isPowerWeaponAttack: false, isUnarmedAttack: false, isMeleeAttack: false, isConsumableOrWreckerRangedAttack: false, consummatePerformer: false, isMelee: false, isAttack: false, itemUuid: null, targetUuid: null, defenseType: null, smallerTarget: false }, false);
  });

  test("repeated normal skill roll", async () => {
    const rollDialog = createMockRollDialog();
    rollDialog.getSkillRollOptions.mockReturnValue({
      canCritD2: false,
      edge: false,
      snag: false,
      shiftUp: 0,
      shiftDown: 0,
      timesToRoll: 2,
    });
    mockActor.getRollData = jest.fn(() => ({
      skills: {
        'athletics': {
          modifier: '0',
          shift: 'd20',
        },
      },
    }));
    dice._rollSkillHelper = jest.fn();

    await dice.rollSkill(dataset, mockActor, null);
    expect(dice._rollSkillHelper).toHaveBeenCalledWith('d20 + 0', mockActor, "E20.RollRepeatText<br>E20.RollRollingFor E20.SkillAthletics", false, null, { skill: 'athletics', essence: 'strength', finalShift: 'd20', snag: false, isPowerWeaponAttack: false, isUnarmedAttack: false, isMeleeAttack: false, isConsumableOrWreckerRangedAttack: false, consummatePerformer: false, isMelee: false, isAttack: false, itemUuid: null, targetUuid: null, defenseType: null, smallerTarget: false }, false);
    expect(dice._rollSkillHelper.mock.calls.length).toBe(2);
  });

  test("auto success", async () => {
    const datasetCopy = {
      ...dataset,
      shift: 'autoSuccess',
    };
    const rollDialog = createMockRollDialog();
    rollDialog.getSkillRollOptions.mockReturnValue({
      canCritD2: false,
      edge: false,
      snag: false,
      shiftUp: 0,
      shiftDown: 0,
      timesToRoll: 1,
    });
    mockActor.getRollData = jest.fn(() => ({
      skills: {
        'athletics': {
          modifier: '0',
          shift: 'autoSuccess',
        },
      },
    }));
    dice._rollSkillHelper = jest.fn();

    await dice.rollSkill(datasetCopy, mockActor, null);
    expect(dice._rollSkillHelper).toHaveBeenCalledWith('d20 + 3d6 + 0', mockActor, "E20.RollRollingFor E20.SkillAthletics", false, null, { skill: 'athletics', essence: 'strength', finalShift: '3d6', snag: false, isPowerWeaponAttack: false, isUnarmedAttack: false, isMeleeAttack: false, isConsumableOrWreckerRangedAttack: false, consummatePerformer: false, isMelee: false, isAttack: false, itemUuid: null, targetUuid: null, defenseType: null, smallerTarget: false }, false);
  });

  test("specialized skill roll", async () => {
    const datasetCopy = {
      ...dataset,
      isSpecialized: true,
      specializationName: 'Foo Specialization',
    };
    const rollDialog = createMockRollDialog();
    rollDialog.getSkillRollOptions.mockReturnValue({
      canCritD2: false,
      edge: false,
      snag: false,
      shiftUp: 0,
      shiftDown: 0,
      timesToRoll: 1,
    });
    mockActor.getRollData = jest.fn(() => ({
      skills: {
        'athletics': {
          modifier: '0',
          shift: 'd20',
        },
      },
    }));
    dice._rollSkillHelper = jest.fn();

    await dice.rollSkill(datasetCopy, mockActor, null);
    expect(dice._rollSkillHelper).toHaveBeenCalledWith('d20 + 0', mockActor, "E20.RollRollingFor Foo Specialization", false, null, { skill: 'athletics', essence: 'strength', finalShift: 'd20', snag: false, isPowerWeaponAttack: false, isUnarmedAttack: false, isMeleeAttack: false, isConsumableOrWreckerRangedAttack: false, consummatePerformer: false, isMelee: false, isAttack: false, itemUuid: null, targetUuid: null, defenseType: null, smallerTarget: false }, false);
  });

  test("specialized standard skill roll", async () => {
    const datasetCopy = {
      ...dataset,
      isSpecialized: true,
    };
    const rollDialog = createMockRollDialog();
    rollDialog.getSkillRollOptions.mockReturnValue({
      canCritD2: false,
      edge: false,
      snag: false,
      shiftUp: 0,
      shiftDown: 0,
      timesToRoll: 1,
    });
    mockActor.getRollData = jest.fn(() => ({
      skills: {
        'athletics': {
          modifier: '0',
          shift: 'd20',
        },
      },
    }));
    dice._rollSkillHelper = jest.fn();

    await dice.rollSkill(datasetCopy, mockActor, null);
    expect(dice._rollSkillHelper).toHaveBeenCalledWith('d20 + 0', mockActor, "E20.RollRollingFor E20.SkillAthletics", false, null, { skill: 'athletics', essence: 'strength', finalShift: 'd20', snag: false, isPowerWeaponAttack: false, isUnarmedAttack: false, isMeleeAttack: false, isConsumableOrWreckerRangedAttack: false, consummatePerformer: false, isMelee: false, isAttack: false, itemUuid: null, targetUuid: null, defenseType: null, smallerTarget: false }, false);
  });

  test("specialized skill roll via weapon effect", async () => {
    const datasetCopy = {
      ...dataset,
      isSpecialized: false,
    };
    const rollDialog = createMockRollDialog();
    rollDialog.getSkillRollOptions.mockReturnValue({
      canCritD2: false,
      edge: false,
      snag: false,
      shiftUp: 0,
      shiftDown: 0,
      timesToRoll: 1,
    });
    mockActor.getRollData = jest.fn(() => ({
      skills: {
        'athletics': {
          modifier: '0',
          shift: 'd20',
        },
      },
    }));
    const weaponEffect = {
      name: 'Zeo Power Clubs Effect',
      type: 'weaponEffect',
      system: {
        classification: {
          skill: "athletics",
          style: "melee",
        },
        damageType: "blunt",
        damageValue: 1,
        defenseType: "none",
        isSpecialized: true,
      },
    };
    dice._rollSkillHelper = jest.fn();

    const expectedDataset = {
      ...dataset,
      isSpecialized: true,
      shiftUp: 0,
      shiftDown: 0,

      targetVesselSystemAvailable: false,
      wildAnimalKit: null,
      intimidatingWeaponSkill: null,
      observerSnagSubstitutionAvailable: false,
      availableSkillEffects: [],
      combatModifierSources: [],
      enviroSealedAdverseSituationAvailable: false,
      enviroSealedAdverseSituationChecked: false,
      fanningMaxShots: 0,
      retrogenAvailable: false,
    };
    const expectedSkillDataset = {
      edge: false,
      shift: "d20",
      snag: false,
    };

    await dice.rollSkill(datasetCopy, mockActor, weaponEffect);
    expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(expectedDataset, expectedSkillDataset, mockActor);
  });

  test("specialized skill roll works with isSpecialized as true string", async () => {
    const datasetCopy = {
      ...dataset,
      isSpecialized: 'true',
      specializationName: 'Foo Specialization',
    };
    const rollDialog = createMockRollDialog();
    rollDialog.getSkillRollOptions.mockReturnValue({
      canCritD2: false,
      edge: false,
      snag: false,
      shiftUp: 0,
      shiftDown: 0,
      timesToRoll: 1,
    });
    mockActor.getRollData = jest.fn(() => ({
      skills: {
        'athletics': {
          modifier: '0',
          shift: 'd20',
        },
      },
    }));
    dice._rollSkillHelper = jest.fn();

    await dice.rollSkill(datasetCopy, mockActor, null);
    expect(dice._rollSkillHelper).toHaveBeenCalledWith('d20 + 0', mockActor, "E20.RollRollingFor Foo Specialization", false, null, { skill: 'athletics', essence: 'strength', finalShift: 'd20', snag: false, isPowerWeaponAttack: false, isUnarmedAttack: false, isMeleeAttack: false, isConsumableOrWreckerRangedAttack: false, consummatePerformer: false, isMelee: false, isAttack: false, itemUuid: null, targetUuid: null, defenseType: null, smallerTarget: false }, false);
  });

  test("normal weapon effect skill roll", async () => {
    const rollDialog = createMockRollDialog();
    rollDialog.getSkillRollOptions.mockReturnValue({
      canCritD2: false,
      edge: false,
      snag: false,
      shiftUp: 0,
      shiftDown: 0,
      timesToRoll: 1,
    });
    const weaponEffect = {
      name: 'Zeo Power Clubs Effect',
      type: 'weaponEffect',
      system: {
        classification: {
          skill: "athletics",
        },
        damageType: "blunt",
        damageValue: 1,
      },
    };
    mockActor.getRollData = jest.fn(() => ({
      skills: {
        'athletics': {
          modifier: '0',
          shift: 'd20',
        },
      },
    }));
    dice._rollSkillHelper = jest.fn();

    await dice.rollSkill(dataset, mockActor, weaponEffect);
    expect(dice._rollSkillHelper).toHaveBeenCalledWith(
      'd20 + 0',
      mockActor,
      "<b>E20.RollTypeAttack</b> - Zeo Power Clubs Effect (E20.SkillAthletics)<br><b>E20.WeaponEffect</b> - 1 E20.DamageBlunt<br><b>E20.ItemDescription</b>:<br>",
      false,
      null,
      { skill: 'athletics', essence: 'strength', finalShift: 'd20', snag: false, isPowerWeaponAttack: false, isUnarmedAttack: true, isMeleeAttack: false, isConsumableOrWreckerRangedAttack: false, consummatePerformer: false, isMelee: false, isAttack: true, itemUuid: null, targetUuid: null, defenseType: null, smallerTarget: false },
      false,
    );
  });

  // Frenzied Attack (Decepticon Directive, Shredder Focus, 10th level, p.58) - see
  // items/attacks/frenzied-attack.mjs's own doc comment. chat.mjs#addFrenziedAttackButton needs the
  // rolled weaponEffect's own uuid to roll it again, so rollSkill's checkContext has to carry it
  // through whenever the item actually has one (an embedded Item does; the plain object literals
  // the other tests in this file use as their "item" don't, hence itemUuid: null above).
  test("weapon effect attack stamps the item's own uuid for Frenzied Attack's chat button", async () => {
    const rollDialog = createMockRollDialog();
    rollDialog.getSkillRollOptions.mockReturnValue({
      canCritD2: false,
      edge: false,
      snag: false,
      shiftUp: 0,
      shiftDown: 0,
      timesToRoll: 1,
    });
    const weaponEffect = {
      name: 'Zeo Power Clubs Effect',
      type: 'weaponEffect',
      uuid: 'Actor.actor1.Item.effect1',
      system: {
        classification: {
          skill: "athletics",
        },
        damageType: "blunt",
        damageValue: 1,
      },
    };
    mockActor.getRollData = jest.fn(() => ({
      skills: {
        'athletics': {
          modifier: '0',
          shift: 'd20',
        },
      },
    }));
    dice._rollSkillHelper = jest.fn();

    await dice.rollSkill(dataset, mockActor, weaponEffect);
    expect(dice._rollSkillHelper).toHaveBeenCalledWith(
      expect.anything(),
      mockActor,
      expect.anything(),
      false,
      null,
      expect.objectContaining({ itemUuid: 'Actor.actor1.Item.effect1' }),
      false,
    );
  });

  describe("attack-pipeline weapon traits (Fanning / High-Density / Retrogen)", () => {
    const d8Dataset = { ...dataset, shift: 'd8' };

    function makeTraitWeaponRoll(traits, weaponSystem = {}) {
      const weapon = { system: { traits, ...weaponSystem } };
      const weaponEffect = {
        name: 'Six-Shooter Effect',
        type: 'weaponEffect',
        flags: { essence20: { parentId: 'weapon1' } },
        system: { classification: { skill: 'athletics', style: 'projectile' }, damageType: 'sharp', damageValue: 1 },
      };
      const items = [];
      items.get = id => (id === 'weapon1' ? weapon : undefined);
      const actor = {
        ...mockActor,
        items,
        getRollData: jest.fn(() => ({ skills: { athletics: { modifier: '0', shift: 'd8' } } })),
      };
      return { actor, weaponEffect };
    }

    function mockOptions(rollDialog, extra = {}) {
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, ...extra,
      });
    }

    test("Fanning offers up to X shots and rolls each at its own escalating ↓", async () => {
      const rollDialog = createMockRollDialog();
      mockOptions(rollDialog, { fanningShots: 2 });
      const { actor, weaponEffect } = makeTraitWeaponRoll(['fanning'], { fanningMagnitude: 2 });
      dice._rollSkillHelper = jest.fn(async () => ({ results: [], isFumble: false }));

      const result = await dice.rollSkill(d8Dataset, actor, weaponEffect);

      expect(rollDialog.getSkillRollOptions.mock.calls[0][0].fanningMaxShots).toBe(2);
      expect(dice._rollSkillHelper).toHaveBeenCalledTimes(2);
      const [firstShot, secondShot] = dice._rollSkillHelper.mock.calls;
      expect(firstShot[5].finalShift).toBe('d6');
      expect(secondShot[5].finalShift).toBe('d4');
      expect(firstShot[0]).not.toEqual(secondShot[0]);
      expect(firstShot[2]).toContain('E20.RollFanningShotText');
      expect(result.fanned).toBe(true);
    });

    test("a Fumble ends the Fanning volley early", async () => {
      const rollDialog = createMockRollDialog();
      mockOptions(rollDialog, { fanningShots: 2 });
      const { actor, weaponEffect } = makeTraitWeaponRoll(['fanning'], { fanningMagnitude: 2 });
      dice._rollSkillHelper = jest.fn(async () => ({ results: [], isFumble: true }));

      await dice.rollSkill(d8Dataset, actor, weaponEffect);

      expect(dice._rollSkillHelper).toHaveBeenCalledTimes(1);
    });

    test("0 Fanning shots is an ordinary attack - no ↓, not fanned", async () => {
      const rollDialog = createMockRollDialog();
      mockOptions(rollDialog, { fanningShots: 0 });
      const { actor, weaponEffect } = makeTraitWeaponRoll(['fanning'], { fanningMagnitude: 2 });
      dice._rollSkillHelper = jest.fn(async () => ({ results: [], isFumble: false }));

      const result = await dice.rollSkill(d8Dataset, actor, weaponEffect);

      expect(dice._rollSkillHelper).toHaveBeenCalledTimes(1);
      expect(dice._rollSkillHelper.mock.calls[0][5].finalShift).toBe('d8');
      expect(result.fanned).toBe(false);
    });

    test("a non-Fanning weapon offers no shots", async () => {
      const rollDialog = createMockRollDialog();
      mockOptions(rollDialog);
      const { actor, weaponEffect } = makeTraitWeaponRoll(['ballistic']);
      dice._rollSkillHelper = jest.fn(async () => ({ results: [], isFumble: false }));

      await dice.rollSkill(d8Dataset, actor, weaponEffect);

      expect(rollDialog.getSkillRollOptions.mock.calls[0][0].fanningMaxShots).toBe(0);
      expect(rollDialog.getSkillRollOptions.mock.calls[0][0].retrogenAvailable).toBe(false);
    });

    test("a High-Density follow-up carries a labelled ↓1 and is flagged so it can't chain", async () => {
      const rollDialog = createMockRollDialog();
      mockOptions(rollDialog);
      const { actor, weaponEffect } = makeTraitWeaponRoll(['highDensity']);
      dice._rollSkillHelper = jest.fn(async () => ({ results: [], isFumble: false }));

      await dice.rollSkill({ ...d8Dataset, highDensityFollowUp: true }, actor, weaponEffect);

      const dialogDataset = rollDialog.getSkillRollOptions.mock.calls[0][0];
      expect(dialogDataset.shiftDown).toBe(1);
      expect(dialogDataset.combatModifierSources).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'highDensityFollowUp', shiftDown: 1 }),
      ]));
      expect(dice._rollSkillHelper.mock.calls[0][5])
        .toEqual(expect.objectContaining({ isHighDensityAttack: true, highDensityFollowUp: true }));
    });

    test("a High-Density first attack is flagged for the chat button, with no ↓", async () => {
      const rollDialog = createMockRollDialog();
      mockOptions(rollDialog);
      const { actor, weaponEffect } = makeTraitWeaponRoll(['highDensity']);
      dice._rollSkillHelper = jest.fn(async () => ({ results: [], isFumble: false }));

      await dice.rollSkill(d8Dataset, actor, weaponEffect);

      expect(rollDialog.getSkillRollOptions.mock.calls[0][0].shiftDown).toBe(0);
      const rollContext = dice._rollSkillHelper.mock.calls[0][5];
      expect(rollContext.isHighDensityAttack).toBe(true);
      expect(rollContext.highDensityFollowUp).toBeUndefined();
    });

    test("Retrogen offers its toggle with no marked target, and the toggle grants ↑1", async () => {
      const rollDialog = createMockRollDialog();
      mockOptions(rollDialog, { applyRetrogen: true });
      const { actor, weaponEffect } = makeTraitWeaponRoll(['retrogen']);
      dice._rollSkillHelper = jest.fn(async () => ({ results: [], isFumble: false }));

      await dice.rollSkill(d8Dataset, actor, weaponEffect);

      expect(rollDialog.getSkillRollOptions.mock.calls[0][0].retrogenAvailable).toBe(true);
      expect(dice._rollSkillHelper.mock.calls[0][5].finalShift).toBe('d10');
    });
  });

  test("weapon effect attack with a Power Weapon parent flags isPowerWeaponAttack", async () => {
    const rollDialog = createMockRollDialog();
    rollDialog.getSkillRollOptions.mockReturnValue({
      canCritD2: false,
      edge: false,
      snag: false,
      shiftUp: 0,
      shiftDown: 0,
      timesToRoll: 1,
    });
    const powerWeapon = { system: { itemAndUpgradeTraits: ['powerWeapon'] } };
    const weaponEffect = {
      name: 'Zeo Power Clubs Effect',
      type: 'weaponEffect',
      flags: { essence20: { parentId: 'weapon1' } },
      system: {
        classification: { skill: "athletics" },
        damageType: "blunt",
        damageValue: 1,
      },
    };
    const powerWeaponItems = [];
    powerWeaponItems.get = id => (id === 'weapon1' ? powerWeapon : undefined);
    const powerWeaponActor = {
      ...mockActor,
      items: powerWeaponItems,
      getRollData: jest.fn(() => ({
        skills: { athletics: { modifier: '0', shift: 'd20' } },
      })),
    };
    dice._rollSkillHelper = jest.fn();

    await dice.rollSkill(dataset, powerWeaponActor, weaponEffect);
    expect(dice._rollSkillHelper).toHaveBeenCalledWith(
      'd20 + 0',
      powerWeaponActor,
      "<b>E20.RollTypeAttack</b> - Zeo Power Clubs Effect (E20.SkillAthletics)<br><b>E20.WeaponEffect</b> - 1 E20.DamageBlunt<br><b>E20.ItemDescription</b>:<br>",
      false,
      null,
      { skill: 'athletics', essence: 'strength', finalShift: 'd20', snag: false, isPowerWeaponAttack: true, isUnarmedAttack: false, isMeleeAttack: false, isConsumableOrWreckerRangedAttack: false, consummatePerformer: false, isMelee: false, isAttack: true, itemUuid: null, targetUuid: null, defenseType: null, smallerTarget: false },
      false,
    );
  });

  test("weapon effect attack with a parent that has other traits, but not Power Weapon, doesn't flag isPowerWeaponAttack", async () => {
    const rollDialog = createMockRollDialog();
    rollDialog.getSkillRollOptions.mockReturnValue({
      canCritD2: false,
      edge: false,
      snag: false,
      shiftUp: 0,
      shiftDown: 0,
      timesToRoll: 1,
    });
    const mundaneWeapon = { system: { itemAndUpgradeTraits: ['blunt', 'accurate'] } };
    const weaponEffect = {
      name: 'Standard Club',
      type: 'weaponEffect',
      flags: { essence20: { parentId: 'weapon1' } },
      system: {
        classification: { skill: "athletics" },
        damageType: "blunt",
        damageValue: 1,
      },
    };
    const mundaneWeaponItems = [];
    mundaneWeaponItems.get = id => (id === 'weapon1' ? mundaneWeapon : undefined);
    const actor = {
      ...mockActor,
      items: mundaneWeaponItems,
      getRollData: jest.fn(() => ({
        skills: { athletics: { modifier: '0', shift: 'd20' } },
      })),
    };
    dice._rollSkillHelper = jest.fn();

    await dice.rollSkill(dataset, actor, weaponEffect);
    const rollContext = dice._rollSkillHelper.mock.calls[0][5];
    expect(rollContext.isPowerWeaponAttack).toBe(false);
  });

  test("ranged weapon effect with a Consumable or Wrecker parent flags isConsumableOrWreckerRangedAttack", async () => {
    const rollDialog = createMockRollDialog();
    rollDialog.getSkillRollOptions.mockReturnValue({
      canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
    });
    const consumableWeapon = { system: { traits: ['consumable'] } };
    const rangedWeaponEffect = {
      name: 'Missile Pod',
      type: 'weaponEffect',
      flags: { essence20: { parentId: 'weapon1' } },
      system: {
        classification: { skill: "targeting", style: "projectile" },
        damageType: "energy",
        damageValue: 2,
      },
    };
    const items = [];
    items.get = id => (id === 'weapon1' ? consumableWeapon : undefined);
    const actor = {
      ...mockActor,
      items,
      getRollData: jest.fn(() => ({
        skills: { targeting: { modifier: '0', shift: 'd20' } },
      })),
    };
    dice._rollSkillHelper = jest.fn();

    await dice.rollSkill({ ...dataset, skill: 'targeting' }, actor, rangedWeaponEffect);
    const rollContext = dice._rollSkillHelper.mock.calls[0][5];
    expect(rollContext.isConsumableOrWreckerRangedAttack).toBe(true);
  });

  test("melee weapon effect with a Consumable parent doesn't flag isConsumableOrWreckerRangedAttack", async () => {
    const rollDialog = createMockRollDialog();
    rollDialog.getSkillRollOptions.mockReturnValue({
      canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
    });
    const consumableWeapon = { system: { traits: ['consumable'] } };
    const meleeWeaponEffectLocal = {
      name: 'Spike Bomb',
      type: 'weaponEffect',
      flags: { essence20: { parentId: 'weapon1' } },
      system: {
        classification: { skill: "athletics", style: "melee" },
        damageType: "blunt",
        damageValue: 2,
      },
    };
    const items = [];
    items.get = id => (id === 'weapon1' ? consumableWeapon : undefined);
    const actor = {
      ...mockActor,
      items,
      getRollData: jest.fn(() => ({
        skills: { athletics: { modifier: '0', shift: 'd20' } },
      })),
    };
    dice._rollSkillHelper = jest.fn();

    await dice.rollSkill(dataset, actor, meleeWeaponEffectLocal);
    const rollContext = dice._rollSkillHelper.mock.calls[0][5];
    expect(rollContext.isConsumableOrWreckerRangedAttack).toBe(false);
  });

  test("normal spell skill roll", async () => {
    const dataset = {
      isSpecialized: false,
      shift: 'd20',
      skill: 'spellcasting',
      essence: 'any',
    };
    const rollDialog = createMockRollDialog();
    rollDialog.getSkillRollOptions.mockReturnValue({
      canCritD2: false,
      edge: false,
      snag: false,
      shiftUp: 0,
      shiftDown: 0,
      timesToRoll: 1,
    });
    const spell = {
      name: 'Barreling Beam',
      type: 'spell',
      system: {
        description: "Some description",
      },
    };
    mockActor.getRollData = jest.fn(() => ({
      skills: {
        'spellcasting': {
          cost: '0',
          modifier: '0',
          shift: 'd20',
        },
      },
    }));
    dice._rollSkillHelper = jest.fn();

    await dice.rollSkill(dataset, mockActor, spell);
    expect(dice._rollSkillHelper).toHaveBeenCalledWith('d20 + 0', mockActor, "<b>E20.RollTypeSpell</b> - Barreling Beam (E20.SkillSpellcasting)<br><b>E20.ItemDescription</b> - Some description<br>", false, null, { skill: 'spellcasting', essence: 'any', finalShift: 'd20', snag: false, isPowerWeaponAttack: false, isUnarmedAttack: false, isMeleeAttack: false, isConsumableOrWreckerRangedAttack: false, consummatePerformer: false, isMelee: false, isAttack: false, itemUuid: null, targetUuid: null, defenseType: null, smallerTarget: false }, false);
  });

  describe("Bypassing trait (Cobra Codex Screwball/Arched Weapon Upgrades, p.96-97)", () => {
    const bypassingWeaponEffect = {
      name: 'Screwball Blaster',
      type: 'weaponEffect',
      flags: { essence20: { parentId: 'weapon1' } },
      system: {
        classification: { skill: 'targeting', style: 'projectile' },
        damageType: 'sharp',
        damageValue: 1,
        defenseType: 'toughness',
      },
    };

    function makeBypassingActor(traits) {
      const items = [];
      items.get = jest.fn(() => ({ id: 'weapon1', system: { traits } }));
      return {
        ...mockActor,
        items,
        system: { ...mockActor.system },
        update: jest.fn(),
        getRollData: jest.fn(() => ({
          skills: { targeting: { modifier: '0', shift: 'd20' } },
        })),
      };
    }

    test("ignores the target's shield bonus to Defense", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        defenseType: 'toughness',
      });
      const actor = makeBypassingActor(['bypassing']);
      const targetActor = {
        isMorphed: false,
        system: { isMorphed: false, defenses: { toughness: { total: 15, shield: 2 } } },
        name: 'Target',
        uuid: 'Actor.target1',
      };
      const targetsList = [{ actor: targetActor }];
      targetsList.first = () => undefined;
      global.game.user.targets = targetsList;
      dice._rollSkillHelper = jest.fn();

      try {
        await dice.rollSkill({ ...dataset, skill: 'targeting', essence: 'speed' }, actor, bypassingWeaponEffect);

        const checkContext = dice._rollSkillHelper.mock.calls[0][4];
        expect(checkContext.entries[0].difficulty).toBe(13); // 15 total - 2 shield
      } finally {
        global.game.user.targets = { first: jest.fn(() => undefined) };
      }
    });

    test("doesn't affect a non-Bypassing weapon", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        defenseType: 'toughness',
      });
      const actor = makeBypassingActor(['ballistic']);
      const targetActor = {
        isMorphed: false,
        system: { isMorphed: false, defenses: { toughness: { total: 15, shield: 2 } } },
        name: 'Target',
        uuid: 'Actor.target1',
      };
      const targetsList = [{ actor: targetActor }];
      targetsList.first = () => undefined;
      global.game.user.targets = targetsList;
      dice._rollSkillHelper = jest.fn();

      try {
        await dice.rollSkill({ ...dataset, skill: 'targeting', essence: 'speed' }, actor, bypassingWeaponEffect);

        const checkContext = dice._rollSkillHelper.mock.calls[0][4];
        expect(checkContext.entries[0].difficulty).toBe(15);
      } finally {
        global.game.user.targets = { first: jest.fn(() => undefined) };
      }
    });
  });

  describe("Careful / Defense (Fighting Style options, GI Joe CRB p.79)", () => {
    const FIGHTING_STYLE_ID = "Compendium.essence20.gi_joe_crb.Item.2LtDCHxgg9bMvWQK";
    const plainWeaponEffect = {
      name: 'Sidearm',
      type: 'weaponEffect',
      flags: { essence20: { parentId: 'weapon1' } },
      system: {
        classification: { skill: 'targeting', style: 'projectile' },
        damageType: 'sharp',
        damageValue: 1,
        defenseType: 'toughness',
      },
    };

    function makeAttacker() {
      const items = [];
      items.get = jest.fn(() => ({ id: 'weapon1', system: { traits: [] } }));
      return {
        ...mockActor,
        items,
        system: { ...mockActor.system },
        update: jest.fn(),
        getRollData: jest.fn(() => ({ skills: { targeting: { modifier: '0', shift: 'd20' } } })),
      };
    }

    function makeTargetActor({ choice, inCover = false, wearingArmor = false } = {}) {
      return {
        isMorphed: false,
        system: { isMorphed: false, defenses: { toughness: { total: 15, shield: 0 } } },
        name: 'Target',
        uuid: 'Actor.target1',
        statuses: { has: jest.fn(status => status == 'cover' && inCover) },
        items: [
          { type: 'perk', flags: { core: { sourceId: FIGHTING_STYLE_ID } }, system: { choice } },
          ...(wearingArmor ? [{ type: 'armor', system: { equipped: true } }] : []),
        ],
      };
    }

    async function rollAgainst(targetActor) {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        defenseType: 'toughness',
      });
      const targetsList = [{ actor: targetActor }];
      targetsList.first = () => undefined;
      global.game.user.targets = targetsList;
      dice._rollSkillHelper = jest.fn();

      try {
        await dice.rollSkill({ ...dataset, skill: 'targeting', essence: 'speed' }, makeAttacker(), plainWeaponEffect);
        return dice._rollSkillHelper.mock.calls[0][4].entries[0].difficulty;
      } finally {
        global.game.user.targets = { first: jest.fn(() => undefined) };
      }
    }

    // Bug fix 2026-10-06: both bonuses are already in the Defense total (documents/actor.mjs#_prepareDefenses,
    // module/documents/actor.test.js), so the attack's difficulty is that total - they used to be added a second time.
    test("Careful in cover isn't added on top of the target's Defense total", async () => {
      expect(await rollAgainst(makeTargetActor({ choice: 'careful', inCover: true }))).toBe(15);
    });

    test("Defense in armor isn't added on top of the target's Defense total", async () => {
      expect(await rollAgainst(makeTargetActor({ choice: 'defense', wearingArmor: true }))).toBe(15);
    });

    test("no Fighting Style change without the option either", async () => {
      expect(await rollAgainst(makeTargetActor({ choice: 'careful', inCover: false }))).toBe(15);
      expect(await rollAgainst(makeTargetActor({ choice: 'defense', wearingArmor: false }))).toBe(15);
    });
  });

  test("essence-shifted skill roll with edge", async () => {
    const rollDialog = createMockRollDialog();
    rollDialog.getSkillRollOptions.mockReturnValue({
      canCritD2: false,
      edge: false,
      snag: false,
      shiftUp: 0,
      shiftDown: 0,
      timesToRoll: 1,
    });
    // A fresh, isolated essenceShifts object, not the shared mockActor.system reference - a plain
    // `{...mockActor}` spread is shallow, so mutating mockActor.system.essenceShifts in place here
    // would otherwise permanently leak strength.edge=true onto every later test in this file that
    // spreads mockActor without its own essenceShifts override (the same "shared object between
    // makeActor() calls" pollution pattern documented several times elsewhere this project).
    const mockShiftedActor = {
      ...mockActor,
      system: {
        ...mockActor.system,
        essenceShifts: {
          ...mockActor.system.essenceShifts,
          strength: { ...mockActor.system.essenceShifts.strength },
          any: { ...mockActor.system.essenceShifts.any },
        },
      },
      getRollData: jest.fn().mockReturnValue({
        skills: {
          athletics: {
            edge: false,
            snag: false,
          },
        },
      }),
    };
    mockShiftedActor.system.essenceShifts.strength.shiftDown = 1;
    mockShiftedActor.system.essenceShifts.strength.shiftUp = 1;
    mockShiftedActor.system.essenceShifts.strength.edge = true;
    mockShiftedActor.system.essenceShifts.strength.snag = false;
    mockShiftedActor.system.essenceShifts.any.shiftDown = 1;
    dice._rollSkillHelper = jest.fn();

    const expectedDataset = {
      ...dataset,
      isSpecialized: false,
      shiftUp: 1,
      shiftDown: 2,

      targetVesselSystemAvailable: false,
      wildAnimalKit: null,
      intimidatingWeaponSkill: null,
      observerSnagSubstitutionAvailable: false,
      availableSkillEffects: [],
      combatModifierSources: [],
      enviroSealedAdverseSituationAvailable: false,
      enviroSealedAdverseSituationChecked: false,
      fanningMaxShots: 0,
      retrogenAvailable: false,
    };
    const expectedSkillDataset = {
      edge: true,
      shift: "d20",
      snag: false,
    };

    await dice.rollSkill(dataset, mockShiftedActor, null);
    expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(expectedDataset, expectedSkillDataset, mockShiftedActor);
  });

  test("morphed-only essence shift only applies while morphed", async () => {
    const rollDialog = createMockRollDialog();
    rollDialog.getSkillRollOptions.mockReturnValue({
      canCritD2: false,
      edge: false,
      snag: false,
      shiftUp: 0,
      shiftDown: 0,
      timesToRoll: 1,
    });
    const mockMorphedActor = {
      ...mockActor,
      system: {
        ...mockActor.system,
        isMorphed: true,
        // Built from scratch rather than spread from mockActor.system.essenceShifts - other
        // tests in this file mutate mockActor's nested essenceShifts objects directly (they're
        // shared references, not copies), so spreading them here would leak whatever the
        // previously-run test left behind instead of a clean baseline.
        essenceShifts: {
          any: { shiftDown: 0, shiftUp: 0 },
          strength: { shiftDown: 0, shiftUp: 0, edge: false, snag: false, morphed: 1 },
          speed: { shiftDown: 0, shiftUp: 0 },
          smarts: { shiftDown: 0, shiftUp: 0 },
          social: { shiftDown: 0, shiftUp: 0 },
        },
      },
      getRollData: jest.fn().mockReturnValue({
        skills: {
          athletics: {
            edge: false,
            snag: false,
          },
        },
      }),
    };
    dice._rollSkillHelper = jest.fn();

    const expectedDataset = {
      ...dataset,
      isSpecialized: false,
      shiftUp: 1,
      shiftDown: 0,

      targetVesselSystemAvailable: false,
      wildAnimalKit: null,
      intimidatingWeaponSkill: null,
      observerSnagSubstitutionAvailable: false,
      availableSkillEffects: [],
      combatModifierSources: [],
      enviroSealedAdverseSituationAvailable: false,
      enviroSealedAdverseSituationChecked: false,
      fanningMaxShots: 0,
      retrogenAvailable: false,
    };
    const expectedSkillDataset = {
      edge: false,
      shift: "d20",
      snag: false,
    };

    await dice.rollSkill(dataset, mockMorphedActor, null);
    expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(expectedDataset, expectedSkillDataset, mockMorphedActor);
  });

  test("morphed-only essence shift does not apply while unmorphed", async () => {
    const rollDialog = createMockRollDialog();
    rollDialog.getSkillRollOptions.mockReturnValue({
      canCritD2: false,
      edge: false,
      snag: false,
      shiftUp: 0,
      shiftDown: 0,
      timesToRoll: 1,
    });
    const mockUnmorphedActor = {
      ...mockActor,
      system: {
        ...mockActor.system,
        isMorphed: false,
        // Same reasoning as the morphed test above - built from scratch, not spread from
        // mockActor's shared/mutated essenceShifts objects.
        essenceShifts: {
          any: { shiftDown: 0, shiftUp: 0 },
          strength: { shiftDown: 0, shiftUp: 0, edge: false, snag: false, morphed: 1 },
          speed: { shiftDown: 0, shiftUp: 0 },
          smarts: { shiftDown: 0, shiftUp: 0 },
          social: { shiftDown: 0, shiftUp: 0 },
        },
      },
      getRollData: jest.fn().mockReturnValue({
        skills: {
          athletics: {
            edge: false,
            snag: false,
          },
        },
      }),
    };
    dice._rollSkillHelper = jest.fn();

    const expectedDataset = {
      ...dataset,
      isSpecialized: false,
      shiftUp: 0,
      shiftDown: 0,

      targetVesselSystemAvailable: false,
      wildAnimalKit: null,
      intimidatingWeaponSkill: null,
      observerSnagSubstitutionAvailable: false,
      availableSkillEffects: [],
      combatModifierSources: [],
      enviroSealedAdverseSituationAvailable: false,
      enviroSealedAdverseSituationChecked: false,
      fanningMaxShots: 0,
      retrogenAvailable: false,
    };
    const expectedSkillDataset = {
      edge: false,
      shift: "d20",
      snag: false,
    };

    await dice.rollSkill(dataset, mockUnmorphedActor, null);
    expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(expectedDataset, expectedSkillDataset, mockUnmorphedActor);
  });

  describe("damageBonus Role Points (e.g. Sneak Attack Damage)", () => {
    // dataset.dif drives the flat-Difficulty checkContext path (util/enrichers.mjs's
    // @Check[dif=...] links use it too) - avoids needing to mock game.user.targets/canvas as a
    // real targeted-token scene just to get a non-null checkContext out of rollSkill().
    const difDataset = { ...dataset, dif: '10' };
    const weaponEffect = {
      name: 'Silenced Pistol Effect',
      type: 'weaponEffect',
      flags: {},
      system: {
        classification: { skill: "athletics" },
        damageType: "blunt",
        damageValue: 1,
      },
    };

    function makeDamageBonusActor(overrides = {}) {
      return {
        ...mockActor,
        getRollData: jest.fn(() => ({
          skills: { athletics: { modifier: '0', shift: 'd20' } },
        })),
        _getBaseRolePoints: jest.fn(() => ({
          name: 'Power Strike',
          flags: {},
          system: {
            bonus: { type: 'damageBonus', value: 3 },
            isActivatable: false,
            isActive: false,
          },
          ...overrides,
        })),
      };
    }

    test("is added to checkContext.damageValue when the dialog checkbox is checked", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        applyRolePointsDamage: true,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(difDataset, makeDamageBonusActor(), weaponEffect);

      const checkContext = dice._rollSkillHelper.mock.calls[0][4];
      expect(checkContext.damageValue).toBe(4); // 1 (weaponEffect) + 3 (Power Strike)
    });

    test("is left out of checkContext.damageValue when the checkbox is unchecked", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        applyRolePointsDamage: false,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(difDataset, makeDamageBonusActor(), weaponEffect);

      const checkContext = dice._rollSkillHelper.mock.calls[0][4];
      expect(checkContext.damageValue).toBe(1);
    });

    test("isn't offered at all when the Role Points item is Activatable but not Active", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        applyRolePointsDamage: true, // even if somehow checked, there's nothing to apply
      });
      dice._rollSkillHelper = jest.fn();
      const actor = makeDamageBonusActor({
        system: { bonus: { type: 'damageBonus', value: 3 }, isActivatable: true, isActive: false },
      });

      await dice.rollSkill(difDataset, actor, weaponEffect);

      expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(
        expect.objectContaining({ damageRolePoints: null }), expect.anything(), actor,
      );
      const checkContext = dice._rollSkillHelper.mock.calls[0][4];
      expect(checkContext.damageValue).toBe(1);
    });
  });

  describe("item rules' RollDice (Silver Tongue, Kill Shot, Super Specialized) reach the formula", () => {
    const sniperEffect = {
      name: 'Sniper Rifle Effect', type: 'weaponEffect', flags: { essence20: { parentId: 'weapon1' } },
      system: { classification: { skill: 'targeting' }, damageType: 'ballistic', damageValue: 1 },
    };

    function makeActor(rules, skills) {
      const items = [
        { id: 'perk1', type: 'perk', name: 'Perk', flags: {}, system: { rules, choice: 'alertness' } },
        { id: 'weapon1', type: 'weapon', name: 'Rifle', flags: {}, system: { traits: ['sniper'] } },
      ];
      items.get = jest.fn(id => items.find(item => item.id == id) ?? null);
      // mockActor's own fields only - not a rule index cached on it by an earlier test.
      const actor = { ...Object.fromEntries(Object.entries(mockActor)), items, getRollData: jest.fn(() => ({ skills })) };
      items.forEach(item => (item.parent = actor));
      sniperEffect.parent = actor;
      return actor;
    }

    async function formulaFor(rules, rolled, options = {}, item = null) {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, ...options,
      });
      dice._rollSkillHelper = jest.fn();
      await dice.rollSkill({ ...dataset, ...rolled }, makeActor(rules, { [rolled.skill]: { modifier: '0', shift: rolled.shift ?? 'd20' } }), item);
      return dice._rollSkillHelper.mock.calls[0][0];
    }

    test("a d20 floor of 10 (min10), only when its condition holds", async () => {
      const rules = [{ type: 'RollDice', d20Floor: 10, when: ['essence:social'] }];
      expect(await formulaFor(rules, { skill: 'persuasion', essence: 'social' })).toContain('min10');
      expect(await formulaFor(rules, { skill: 'athletics', essence: 'strength' })).not.toContain('min10');
    });

    test("a third d20 with an Edge (3d20kh)", async () => {
      const rules = [{ type: 'RollDice', thirdD20: true, when: ['attack:ranged', 'roll:edge', 'weapon:trait:sniper'] }];
      expect(await formulaFor(rules, { skill: 'targeting', essence: 'speed' }, { edge: true }, sniperEffect)).toContain('3d20kh');
      expect(await formulaFor(rules, { skill: 'targeting', essence: 'speed' }, { edge: false }, sniperEffect)).not.toContain('3d20');
    });

    test("a step up once the final die is known (d6 to d8 when Specialized)", async () => {
      const rules = [{ type: 'RollDice', stepUp: 1, when: ['roll:dataset:isSpecialized', 'skill:{item.choice}'] }];
      expect(await formulaFor(rules, { skill: 'alertness', essence: 'smarts', shift: 'd6' }, { isSpecialized: true })).toContain('d8');
      const plainRoll = await formulaFor(rules, { skill: 'alertness', essence: 'smarts', shift: 'd6' }, { isSpecialized: false });
      expect(plainRoll).toContain('d6');
      expect(plainRoll).not.toContain('d8');
    });
  });

  describe("Jury Rig - Jacket Ammunition (Factions in Action Vol. 2, Engineer Troop Focus, 17th level, p.73)", () => {
    const weaponEffect = {
      name: 'Vehicle Cannon',
      type: 'weaponEffect',
      flags: {},
      system: { classification: { skill: "targeting" }, damageType: "blunt", damageValue: 1 },
    };
    const difDataset = { ...dataset, skill: 'targeting', essence: 'strength', dif: '10' };

    function makeActor(benefitActive) {
      return {
        ...mockActor,
        getFlag: jest.fn((scope, key) => (
          key == 'pendingJuryRigBenefit' && benefitActive ? { option: 'jacketAmmunition', expiresRound: 99 } : undefined
        )),
        getRollData: jest.fn(() => ({ skills: { targeting: { modifier: '0', shift: 'd20' } } })),
      };
    }

    test("adds 1 damage while active", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(difDataset, makeActor(true), weaponEffect);

      const checkContext = dice._rollSkillHelper.mock.calls[0][4];
      expect(checkContext.damageValue).toBe(2); // 1 (base) + 1 (Jacket Ammunition)
    });

    test("doesn't apply without an active benefit", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(difDataset, makeActor(false), weaponEffect);

      const checkContext = dice._rollSkillHelper.mock.calls[0][4];
      expect(checkContext.damageValue).toBe(1);
    });
  });

  describe("Damage-type override toggles (Blazing Strikes / Void Warrior / Cryogenic Touch)", () => {
    const unarmedWeaponEffect = {
      type: 'weaponEffect',
      flags: {},
      system: { classification: { skill: 'brawn', style: 'melee' }, damageType: 'blunt', damageValue: 1 },
    };
    const armedWeaponEffect = {
      type: 'weaponEffect',
      flags: { essence20: { parentId: 'weapon1' } },
      system: { classification: { skill: 'brawn', style: 'melee' }, damageType: 'blunt', damageValue: 1 },
    };

    function makeActor({ flags = {}, weaponTraits = [] } = {}) {
      const items = [];
      items.get = jest.fn(id => (id == 'weapon1' ? { system: { traits: weaponTraits } } : null));

      return {
        ...mockActor,
        items,
        getFlag: jest.fn((scope, key) => flags[key]),
        getRollData: jest.fn(() => ({ skills: { brawn: { modifier: '0', shift: 'd20' } } })),
      };
    }

    test("Void Warrior doesn't apply without the flag", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill({ ...dataset, dif: '10', skill: 'brawn', essence: 'strength' }, makeActor(), unarmedWeaponEffect);

      expect(dice._rollSkillHelper.mock.calls[0][4].damageType).toBe('blunt');
    });

    test("Illuminate doesn't apply to a non-Martial-Arts weapon, an unarmed attack, or without the flag", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      const noTraitActor = makeActor({ flags: { illuminateActive: { epoch: 1, window: 'encounter', count: 1 } }, weaponTraits: [] });
      await dice.rollSkill({ ...dataset, dif: '10', skill: 'brawn', essence: 'strength' }, noTraitActor, armedWeaponEffect);
      expect(dice._rollSkillHelper.mock.calls[0][4].damageType).toBe('blunt');

      const unarmedActor = makeActor({ flags: { illuminateActive: { epoch: 1, window: 'encounter', count: 1 } } });
      await dice.rollSkill({ ...dataset, dif: '10', skill: 'brawn', essence: 'strength' }, unarmedActor, unarmedWeaponEffect);
      expect(dice._rollSkillHelper.mock.calls[1][4].damageType).toBe('blunt');

      const noFlagActor = makeActor({ weaponTraits: ['martialArts'] });
      await dice.rollSkill({ ...dataset, dif: '10', skill: 'brawn', essence: 'strength' }, noFlagActor, armedWeaponEffect);
      expect(dice._rollSkillHelper.mock.calls[2][4].damageType).toBe('blunt');
    });
  });

  describe("Energy Affinity (Decepticon Directive, Elementalist Focus, p.53-54) - damage-type override", () => {
    const ENERGY_AFFINITY_ID = "Compendium.essence20.decepticon_directive.Item.DgFY0ZmAtClAobiA";
    const meleeWeaponEffect = {
      type: 'weaponEffect', flags: {},
      system: { classification: { skill: 'brawn', style: 'melee' }, damageType: 'blunt', damageValue: 1 },
    };
    const rangedWeaponEffect = {
      type: 'weaponEffect', flags: {},
      system: { classification: { skill: 'targeting', style: 'ranged' }, damageType: 'ballistic', damageValue: 1 },
    };

    function makeActor({ hasPerk = true, choice = 'fire', alteredStyle = 'melee' } = {}) {
      // The override is the Perk's own DamageType rule (the same as its pack source).
      const rules = [{ type: 'DamageType', to: 'choice', priority: 1, when: ['check:energyAffinityAttack'] }];
      const items = hasPerk ? [{ type: 'perk', flags: { core: { sourceId: ENERGY_AFFINITY_ID } }, system: { choice, rules } }] : [];
      items.get = jest.fn(() => null);
      return {
        // mockActor's own fields only - not a rule index cached on it by an earlier test.
        ...Object.fromEntries(Object.entries(mockActor)),
        items,
        getFlag: jest.fn((scope, key) => (key == 'energyAffinityAltered' && alteredStyle ? { epoch: 1, style: alteredStyle } : undefined)),
        getRollData: jest.fn(() => ({
          skills: { brawn: { modifier: '0', shift: 'd20' }, targeting: { modifier: '0', shift: 'd20' } },
        })),
      };
    }

    beforeAll(async () => {
      const { registerCheck } = await import('./rules/predicate.mjs');
      const { isEnergyAffinityElementAttack } = await import('./items/attacks/energy-affinity.mjs');
      registerCheck('energyAffinityAttack', (actor, option, ctx) => isEnergyAffinityElementAttack(actor, ctx?.item));
    });

    test("overrides a melee attack's damage type to the chosen Element while melee is activated", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill({ ...dataset, dif: '10', skill: 'brawn', essence: 'strength' }, makeActor({ alteredStyle: 'melee' }), meleeWeaponEffect);

      expect(dice._rollSkillHelper.mock.calls[0][4].damageType).toBe('fire');
    });

    test("doesn't override a ranged attack while only melee is activated, without the Perk, or with no activation", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(
        { ...dataset, dif: '10', skill: 'targeting', essence: 'speed' }, makeActor({ alteredStyle: 'melee' }), rangedWeaponEffect,
      );
      expect(dice._rollSkillHelper.mock.calls[0][4].damageType).toBe('ballistic');

      await dice.rollSkill(
        { ...dataset, dif: '10', skill: 'brawn', essence: 'strength' }, makeActor({ hasPerk: false, alteredStyle: 'melee' }), meleeWeaponEffect,
      );
      expect(dice._rollSkillHelper.mock.calls[1][4].damageType).toBe('blunt');

      await dice.rollSkill(
        { ...dataset, dif: '10', skill: 'brawn', essence: 'strength' }, makeActor({ alteredStyle: null }), meleeWeaponEffect,
      );
      expect(dice._rollSkillHelper.mock.calls[2][4].damageType).toBe('blunt');
    });

    test("overrides a ranged attack instead, when ranged is what was activated", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(
        { ...dataset, dif: '10', skill: 'targeting', essence: 'speed' }, makeActor({ alteredStyle: 'ranged', choice: 'sonic' }), rangedWeaponEffect,
      );

      expect(dice._rollSkillHelper.mock.calls[0][4].damageType).toBe('sonic');
    });
  });

  describe("Tooth And Claw - damage-type half (Decepticon Directive reprint, p.36)", () => {
    const TOOTH_AND_CLAW_DD_ID = "Compendium.essence20.decepticon_directive.Item.bHQGteFX7pdnslOx";
    // The override is each printing's own DamageType rules (the same as their pack sources).
    const unarmed = ['self:transformed', { any: ['attack:unarmed', 'weapon:source:Compendium.essence20.tf_crb.Item.OU9rXvoKfXtcpvFy'] }];
    const rules = [
      { type: 'DamageType', to: 'choice', priority: -1, when: unarmed },
      { type: 'DamageType', to: 'sharp', priority: -1, when: unarmed },
    ];

    function makeActor({ hasPerk = true, isTransformed = true, choice = 'blunt' } = {}) {
      return {
        // mockActor's own fields only - not a rule index cached on it by an earlier test.
        ...Object.fromEntries(Object.entries(mockActor)),
        items: hasPerk ? [{ type: 'perk', flags: { core: { sourceId: TOOTH_AND_CLAW_DD_ID } }, system: { choice, rules } }] : [],
        system: { ...mockActor.system, isTransformed },
        getRollData: jest.fn(() => ({ skills: { athletics: { modifier: '0', shift: 'd20' } } })),
      };
    }

    const unarmedWeaponEffect = {
      type: 'weaponEffect',
      flags: {},
      system: { classification: { skill: 'athletics', style: 'melee' }, damageType: 'stun', damageValue: 1 },
    };

    test("overrides an unarmed Alt Mode attack's damage type to the chosen Sharp/Blunt", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(
        { ...dataset, dif: '10', skill: 'athletics', essence: 'strength' }, makeActor({ choice: 'sharp' }), unarmedWeaponEffect,
      );

      expect(dice._rollSkillHelper.mock.calls[0][4].damageType).toBe('sharp');
    });

    test("reads the Technorganic Secrets printing's own Sharp/Blunt choice too", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();
      const actor = {
        ...makeActor({ hasPerk: false }),
        items: [{ type: 'perk', flags: { core: { sourceId: "Compendium.essence20.technorganic_secrets.Item.Z4lShGtDBa2zQ5ov" } }, system: { choice: 'blunt', rules } }],
      };

      await dice.rollSkill({ ...dataset, dif: '10', skill: 'athletics', essence: 'strength' }, actor, unarmedWeaponEffect);

      expect(dice._rollSkillHelper.mock.calls[0][4].damageType).toBe('blunt');
    });

    test("doesn't apply in Bot Mode, without the Perk, or on an armed attack", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(
        { ...dataset, dif: '10', skill: 'athletics', essence: 'strength' }, makeActor({ isTransformed: false }), unarmedWeaponEffect,
      );
      expect(dice._rollSkillHelper.mock.calls[0][4].damageType).toBe('stun');

      await dice.rollSkill(
        { ...dataset, dif: '10', skill: 'athletics', essence: 'strength' }, makeActor({ hasPerk: false }), unarmedWeaponEffect,
      );
      expect(dice._rollSkillHelper.mock.calls[1][4].damageType).toBe('stun');
    });
  });

  // (Relic Key on a Skill Test - the same banked Edge.)

  describe("Favorite Weapon (Decepticon Directive, Triggerbot Focus, p.49)", () => {
    const FAVORITE_WEAPON_ID = "Compendium.essence20.decepticon_directive.Item.emaXxo2XzoHMoNCe";

    function makeActor({ perkIds = [], favoriteWeaponId = 'w1', weaponEquipped = true } = {}) {
      const weapon = { id: 'w1', type: 'weapon', system: { equipped: weaponEquipped } };
      const items = perkIds.map(perkId => ({
        type: 'perk', flags: { core: { sourceId: perkId } }, system: { choice: favoriteWeaponId },
      }));
      items.get = jest.fn((id) => (id == 'w1' ? weapon : null));
      items.find = Array.prototype.find.bind(items);

      return {
        ...mockActor,
        items,
        getRollData: jest.fn(() => ({
          skills: {
            intimidation: { modifier: '0', shift: 'd20' },
            persuasion: { modifier: '0', shift: 'd20' },
            targeting: { modifier: '0', shift: 'd20' },
            science: { modifier: '0', shift: 'd20' },
          },
        })),
      };
    }

    function weaponEffect(parentId = 'w1') {
      return { type: 'weaponEffect', flags: { essence20: { parentId } }, system: { classification: { skill: 'targeting' } } };
    }
  });

  describe("Linked (GI Joe CRB, Vehicle Trait, p.173)", () => {
    function makeLinkedActor({ hasLinkedTrait = true } = {}) {
      const items = [];
      items.get = jest.fn(id => (id == 'weapon1'
        ? { flags: { core: { sourceId: 'linkedWeapon1' } }, system: { traits: hasLinkedTrait ? ['linked'] : [] } }
        : null));
      return {
        ...mockActor,
        items,
        getRollData: jest.fn(() => ({
          skills: { targeting: { modifier: '0', shift: 'd20' } },
        })),
      };
    }

    function weaponEffect() {
      return {
        type: 'weaponEffect',
        flags: { essence20: { parentId: 'weapon1' } },
        system: { classification: { skill: 'targeting', style: 'ranged' } },
      };
    }

    test("grants Edge on an attack with a Linked weapon", async () => {
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill({ ...dataset, dif: '10', skill: 'targeting' }, makeLinkedActor(), weaponEffect());

      const [, skillDataset] = dice._rollDialog.getSkillRollOptions.mock.calls.at(-1);
      expect(skillDataset.edge).toBe(true);
    });

    test("doesn't apply without the trait", async () => {
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(
        { ...dataset, dif: '10', skill: 'targeting' }, makeLinkedActor({ hasLinkedTrait: false }), weaponEffect(),
      );

      const [, skillDataset] = dice._rollDialog.getSkillRollOptions.mock.calls.at(-1);
      expect(skillDataset.edge).toBeFalsy();
    });

    test("doesn't apply to a non-weaponEffect roll", async () => {
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill({ ...dataset, dif: '10', skill: 'targeting' }, makeLinkedActor(), null);

      const [, skillDataset] = dice._rollDialog.getSkillRollOptions.mock.calls.at(-1);
      expect(skillDataset.edge).toBeFalsy();
    });
  });

  describe("Power Adaptation (Across the Stars, Silver Ranger, 9th/18th level, p.57)", () => {
    // A fresh, isolated essenceShifts rather than the shared mockActor.system reference - see the
    // identical comment on Reckless Abandon/Across the Stars Ranger Prime's own makeActor()
    // elsewhere in this file for why a shallow `{...mockActor, ...}` spread alone isn't enough
    // (essenceShifts is a nested object another test could have mutated in place).
    function makeActor({ active = {}, weaponTraits = null } = {}) {
      const items = [];
      items.get = jest.fn(id => (id == 'weapon1' ? { system: { traits: weaponTraits ?? [] } } : null));

      return {
        ...mockActor,
        items,
        system: {
          ...mockActor.system,
          essenceShifts: {
            any: { shiftUp: 0, shiftDown: 0 },
            strength: { shiftUp: 0, shiftDown: 0 },
            speed: { shiftUp: 0, shiftDown: 0 },
            smarts: { shiftUp: 0, shiftDown: 0 },
            social: { shiftUp: 0, shiftDown: 0 },
          },
        },
        getFlag: jest.fn((scope, key) => (key == 'powerAdaptationActive' ? active : undefined)),
        getRollData: jest.fn(() => ({
          skills: {
            athletics: { modifier: '0', shift: 'd20' },
            brawn: { modifier: '0', shift: 'd20' },
            targeting: { modifier: '0', shift: 'd20' },
          },
        })),
      };
    }

    const unarmedWeaponEffect = {
      type: 'weaponEffect',
      flags: {},
      system: { classification: { skill: 'targeting' }, damageType: 'blunt', damageValue: 1 },
    };
    const armedWeaponEffect = {
      type: 'weaponEffect',
      flags: { essence20: { parentId: 'weapon1' } },
      system: { classification: { skill: 'targeting' }, damageType: 'blunt', damageValue: 1 },
    };

    describe("Crushing Strength", () => {
      test("upshifts Athletics and Brawn by 2 while active", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();
        const actor = makeActor({ active: { crushingStrength: true } });

        await dice.rollSkill({ ...dataset, skill: 'athletics' }, actor, null);
        expect(rollDialog.getSkillRollOptions.mock.calls[0][0].shiftUp).toBe(2);

        await dice.rollSkill({ ...dataset, skill: 'brawn' }, actor, null);
        expect(rollDialog.getSkillRollOptions.mock.calls[1][0].shiftUp).toBe(2);
      });

      test("doesn't apply to a different Skill, or while inactive", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();

        await dice.rollSkill({ ...dataset, skill: 'targeting' }, makeActor({ active: { crushingStrength: true } }), null);
        expect(rollDialog.getSkillRollOptions.mock.calls[0][0].shiftUp).toBe(0);

        await dice.rollSkill({ ...dataset, skill: 'athletics' }, makeActor(), null);
        expect(rollDialog.getSkillRollOptions.mock.calls[1][0].shiftUp).toBe(0);
      });
    });

    describe("Striking Hands", () => {
      test("upshifts an unarmed Attack by 1 while active", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();

        await dice.rollSkill(
          { ...dataset, skill: 'targeting' }, makeActor({ active: { strikingHands: true } }), unarmedWeaponEffect,
        );

        expect(rollDialog.getSkillRollOptions.mock.calls[0][0].shiftUp).toBe(1);
      });

      test("doesn't apply to an armed attack, or while inactive", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();

        await dice.rollSkill(
          { ...dataset, skill: 'targeting' }, makeActor({ active: { strikingHands: true } }), armedWeaponEffect,
        );
        expect(rollDialog.getSkillRollOptions.mock.calls[0][0].shiftUp).toBe(0);

        await dice.rollSkill({ ...dataset, skill: 'targeting' }, makeActor(), unarmedWeaponEffect);
        expect(rollDialog.getSkillRollOptions.mock.calls[1][0].shiftUp).toBe(0);
      });
    });
  });

  describe("Greased Lightning (Knights of Canterlot, Elementary Enchantment spell, p.43) - shift consumption", () => {
    function makeActor({ active = false } = {}) {
      return {
        ...mockActor,
        system: {
          ...mockActor.system,
          essenceShifts: {
            any: { shiftUp: 0, shiftDown: 0 },
            strength: { shiftUp: 0, shiftDown: 0 },
            speed: { shiftUp: 0, shiftDown: 0 },
            smarts: { shiftUp: 0, shiftDown: 0 },
            social: { shiftUp: 0, shiftDown: 0 },
          },
        },
        getFlag: jest.fn((scope, key) => (key == 'greasedLightningActive' ? (active ? { epoch: 1, window: 'scene', count: 1 } : undefined) : undefined)),
        getRollData: jest.fn(() => ({
          skills: { driving: { modifier: '0', shift: 'd20' }, athletics: { modifier: '0', shift: 'd20' } },
        })),
      };
    }

    test("upshifts a Speed Skill Test while active", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();
      const actor = makeActor({ active: true });

      await dice.rollSkill({ ...dataset, skill: 'driving', essence: 'speed' }, actor, null);

      expect(rollDialog.getSkillRollOptions.mock.calls[0][0].shiftUp).toBe(1);
    });

    test("doesn't apply to a different Essence, or while inactive", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill({ ...dataset, skill: 'athletics', essence: 'strength' }, makeActor({ active: true }), null);
      expect(rollDialog.getSkillRollOptions.mock.calls[0][0].shiftUp).toBe(0);

      await dice.rollSkill({ ...dataset, skill: 'driving', essence: 'speed' }, makeActor({ active: false }), null);
      expect(rollDialog.getSkillRollOptions.mock.calls[1][0].shiftUp).toBe(0);
    });
  });

  describe("Mystery Sense (Knights of Canterlot, Superior Enchantment spell, p.47) - shift consumption", () => {
    function makeActor({ active = false } = {}) {
      return {
        ...mockActor,
        system: {
          ...mockActor.system,
          essenceShifts: {
            any: { shiftUp: 0, shiftDown: 0 },
            strength: { shiftUp: 0, shiftDown: 0 },
            speed: { shiftUp: 0, shiftDown: 0 },
            smarts: { shiftUp: 0, shiftDown: 0 },
            social: { shiftUp: 0, shiftDown: 0 },
          },
        },
        getFlag: jest.fn((scope, key) => (key == 'mysterySenseActive' ? (active ? { epoch: 1, window: 'scene', count: 1 } : undefined) : undefined)),
        getRollData: jest.fn(() => ({
          skills: {
            alertness: { modifier: '0', shift: 'd20' },
            infiltration: { modifier: '0', shift: 'd20' },
            streetwise: { modifier: '0', shift: 'd20' },
            targeting: { modifier: '0', shift: 'd20' },
          },
        })),
      };
    }

    test.each(['alertness', 'infiltration', 'streetwise'])("upshifts %s by 3 while active", async (skill) => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill({ ...dataset, skill }, makeActor({ active: true }), null);

      expect(rollDialog.getSkillRollOptions.mock.calls[0][0].shiftUp).toBe(3);
    });

    test("doesn't apply to a different Skill, or while inactive", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill({ ...dataset, skill: 'targeting' }, makeActor({ active: true }), null);
      expect(rollDialog.getSkillRollOptions.mock.calls[0][0].shiftUp).toBe(0);

      await dice.rollSkill({ ...dataset, skill: 'alertness' }, makeActor({ active: false }), null);
      expect(rollDialog.getSkillRollOptions.mock.calls[1][0].shiftUp).toBe(0);
    });
  });

  describe("Foolscarrot (Knights of Canterlot, Elementary Enchantment spell, p.42) - shift consumption", () => {
    // A fresh, isolated essenceShifts - see the Power Adaptation makeActor()'s own comment
    // elsewhere in this file for why a shallow `{...mockActor}` spread alone isn't enough.
    function makeActor({ active = false } = {}) {
      return {
        ...mockActor,
        system: {
          ...mockActor.system,
          essenceShifts: {
            any: { shiftUp: 0, shiftDown: 0 },
            strength: { shiftUp: 0, shiftDown: 0 },
            speed: { shiftUp: 0, shiftDown: 0 },
            smarts: { shiftUp: 0, shiftDown: 0 },
            social: { shiftUp: 0, shiftDown: 0 },
          },
        },
        getFlag: jest.fn((scope, key) => (key == 'foolscarrotActive' ? (active ? { epoch: 1, window: 'scene', count: 1 } : undefined) : undefined)),
        getRollData: jest.fn(() => ({ skills: { targeting: { modifier: '0', shift: 'd20' } } })),
      };
    }

    test("downshifts any Skill Test by 3 while active", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill({ ...dataset, skill: 'targeting' }, makeActor({ active: true }), null);

      expect(rollDialog.getSkillRollOptions.mock.calls[0][0].shiftDown).toBe(3);
    });

    test("doesn't apply while inactive", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill({ ...dataset, skill: 'targeting' }, makeActor({ active: false }), null);

      expect(rollDialog.getSkillRollOptions.mock.calls[0][0].shiftDown).toBe(0);
    });
  });

  describe("Ookie Spookies (Knights of Canterlot, Virtuoso Enchantment spell, p.50) - Edge consumption", () => {
    // A fresh, isolated essenceShifts - see the Power Adaptation makeActor()'s own comment
    // elsewhere in this file for why a shallow `{...mockActor}` spread alone isn't enough
    // (essenceShifts is a nested object another test could have mutated in place).
    function makeActor({ active = false } = {}) {
      return {
        ...mockActor,
        system: {
          ...mockActor.system,
          essenceShifts: {
            any: { shiftUp: 0, shiftDown: 0 },
            strength: { shiftUp: 0, shiftDown: 0 },
            speed: { shiftUp: 0, shiftDown: 0 },
            smarts: { shiftUp: 0, shiftDown: 0 },
            social: { shiftUp: 0, shiftDown: 0 },
          },
        },
        getFlag: jest.fn((scope, key) => (key == 'ookieSpookiesActive' ? (active ? { epoch: 1, window: 'scene', count: 1 } : undefined) : undefined)),
        getRollData: jest.fn(() => ({
          skills: {
            infiltration: { modifier: '0', shift: 'd20' },
            targeting: { modifier: '0', shift: 'd20' },
          },
        })),
      };
    }

    test("grants Edge on Infiltration while active", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill({ ...dataset, skill: 'infiltration' }, makeActor({ active: true }), null);

      expect(rollDialog.getSkillRollOptions.mock.calls[0][1].edge).toBe(true);
    });

    test("doesn't apply to a different Skill, or while inactive", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill({ ...dataset, skill: 'targeting' }, makeActor({ active: true }), null);
      expect(rollDialog.getSkillRollOptions.mock.calls[0][1].edge).toBe(false);

      await dice.rollSkill({ ...dataset, skill: 'infiltration' }, makeActor({ active: false }), null);
      expect(rollDialog.getSkillRollOptions.mock.calls[1][1].edge).toBe(false);
    });
  });

  describe("Phantom Suite (Across the Stars, Phantom Ranger, 1st level, p.60)", () => {
    // A fresh, isolated essenceShifts - see the Power Adaptation makeActor()'s own comment above
    // for why this project's shared mockActor.system needs its own copy per describe block.
    function makeActor({ active = false } = {}) {
      return {
        ...mockActor,
        system: {
          ...mockActor.system,
          essenceShifts: {
            any: { shiftUp: 0, shiftDown: 0 },
            strength: { shiftUp: 0, shiftDown: 0 },
            speed: { shiftUp: 0, shiftDown: 0 },
            smarts: { shiftUp: 0, shiftDown: 0 },
            social: { shiftUp: 0, shiftDown: 0 },
          },
        },
        getFlag: jest.fn((scope, key) => (key == 'phantomSuiteActive' ? active : undefined)),
        getRollData: jest.fn(() => ({
          skills: {
            infiltration: { modifier: '0', shift: 'd20' },
            athletics: { modifier: '0', shift: 'd20' },
          },
        })),
      };
    }

    test("upshifts and grants Edge on Infiltration while active", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill({ ...dataset, skill: 'infiltration' }, makeActor({ active: true }), null);

      expect(rollDialog.getSkillRollOptions.mock.calls[0][0].shiftUp).toBe(1);
      expect(rollDialog.getSkillRollOptions.mock.calls[0][1].edge).toBe(true);
    });

    test("doesn't apply to a different Skill, or while inactive", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill({ ...dataset, skill: 'athletics' }, makeActor({ active: true }), null);
      expect(rollDialog.getSkillRollOptions.mock.calls[0][0].shiftUp).toBe(0);
      expect(rollDialog.getSkillRollOptions.mock.calls[0][1].edge).toBe(false);

      await dice.rollSkill({ ...dataset, skill: 'infiltration' }, makeActor(), null);
      expect(rollDialog.getSkillRollOptions.mock.calls[1][0].shiftUp).toBe(0);
      expect(rollDialog.getSkillRollOptions.mock.calls[1][1].edge).toBe(false);
    });
  });

  describe("Phase Defense (Across the Stars, Phantom Ranger, Phantom Focus choice, p.62)", () => {
    const PHANTOM_FOCUS_ID = "Compendium.essence20.across_the_stars.Item.aXGMEoVsYSttOSHn";
    const PHANTOM_SUITE_ID = "Compendium.essence20.across_the_stars.Item.fQgxo5c7tNOD2Q5K";

    function makeActor() {
      return { ...mockActor, items: [], getRollData: jest.fn(() => ({ skills: { might: { modifier: '0', shift: 'd20' } } })) };
    }

    function makeTargetActor({ suiteActive = true, hasPhaseDefense = true, defenseType = 'toughness' } = {}) {
      const items = [
        { type: 'perk', flags: { core: { sourceId: PHANTOM_SUITE_ID } }, system: { advances: { currentValue: 2 } } },
      ];
      if (hasPhaseDefense) {
        items.push({ flags: { core: { sourceId: PHANTOM_FOCUS_ID } }, system: { choice: 'phaseDefense' } });
      }

      return {
        name: 'Target',
        uuid: 'Actor.target1',
        system: { defenses: { [defenseType]: { total: 10 } }, immunities: {}, size: 'common' },
        statuses: new Set(),
        items,
        getFlag: jest.fn((scope, key) => (key == 'phantomSuiteActive' ? suiteActive : undefined)),
        setFlag: jest.fn(),
        unsetFlag: jest.fn(),
      };
    }

    function makeTargetsSet(targetActor) {
      const token = { actor: targetActor, center: { x: 0, y: 0 } };
      const set = new Set([token]);
      set.first = () => token;

      return set;
    }

    const meleeWeaponEffect = {
      type: 'weaponEffect',
      flags: {},
      system: { classification: { skill: 'might', style: 'melee' }, damageType: 'blunt', damageValue: 1 },
    };

    let originalTargets;
    beforeEach(() => {
      originalTargets = game.user.targets;
    });
    afterEach(() => {
      game.user.targets = originalTargets;
    });

    test("applies Phantom Suite's Evasion bonus to Toughness too, with both", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'toughness',
      });
      dice._rollSkillHelper = jest.fn();
      game.user.targets = makeTargetsSet(makeTargetActor());

      await dice.rollSkill({ ...dataset, skill: 'might', essence: 'strength' }, makeActor(), meleeWeaponEffect);

      expect(dice._rollSkillHelper.mock.calls[0][4].entries[0].difficulty).toBe(12); // 10 + 2 (Phantom Suite's own baseValue)
    });

    test("doesn't apply without Phantom Suite active, without the Phase Defense choice, or against Cleverness/Willpower", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'toughness',
      });
      dice._rollSkillHelper = jest.fn();

      game.user.targets = makeTargetsSet(makeTargetActor({ suiteActive: false }));
      await dice.rollSkill({ ...dataset, skill: 'might', essence: 'strength' }, makeActor(), meleeWeaponEffect);
      expect(dice._rollSkillHelper.mock.calls[0][4].entries[0].difficulty).toBe(10);

      game.user.targets = makeTargetsSet(makeTargetActor({ hasPhaseDefense: false }));
      await dice.rollSkill({ ...dataset, skill: 'might', essence: 'strength' }, makeActor(), meleeWeaponEffect);
      expect(dice._rollSkillHelper.mock.calls[1][4].entries[0].difficulty).toBe(10);

      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'willpower',
      });
      game.user.targets = makeTargetsSet(makeTargetActor({ defenseType: 'willpower' }));
      await dice.rollSkill({ ...dataset, skill: 'might', essence: 'strength' }, makeActor(), meleeWeaponEffect);
      expect(dice._rollSkillHelper.mock.calls[2][4].entries[0].difficulty).toBe(10);
    });
  });

  describe("Powered Plating (A Jump Through Time, Orange Ranger, Modified Shell I option, p.32)", () => {
    function makeActor() {
      return { ...mockActor, items: [], getRollData: jest.fn(() => ({ skills: { might: { modifier: '0', shift: 'd20' } } })) };
    }

    function makeTargetActor({ bonus = 3, isMorphed = true, defenseType = 'toughness' } = {}) {
      return {
        name: 'Target',
        uuid: 'Actor.target1',
        system: { defenses: { [defenseType]: { total: 10 } }, immunities: {}, size: 'common', isMorphed },
        statuses: new Set(),
        items: [],
        getFlag: jest.fn((scope, key) => (key == 'poweredPlatingBonus' ? bonus : undefined)),
        setFlag: jest.fn(),
        unsetFlag: jest.fn(),
      };
    }

    function makeTargetsSet(targetActor) {
      const token = { actor: targetActor, center: { x: 0, y: 0 } };
      const set = new Set([token]);
      set.first = () => token;
      return set;
    }

    const meleeWeaponEffect = {
      type: 'weaponEffect',
      flags: {},
      system: { classification: { skill: 'might', style: 'melee' }, damageType: 'blunt', damageValue: 1 },
    };

    let originalTargets;
    beforeEach(() => {
      originalTargets = game.user.targets;
    });
    afterEach(() => {
      game.user.targets = originalTargets;
    });

    test("adds the banked bonus to Toughness difficulty, without consuming it", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'toughness',
      });
      dice._rollSkillHelper = jest.fn();
      const targetActor = makeTargetActor({ bonus: 3 });
      game.user.targets = makeTargetsSet(targetActor);

      await dice.rollSkill({ ...dataset, skill: 'might', essence: 'strength' }, makeActor(), meleeWeaponEffect);

      expect(dice._rollSkillHelper.mock.calls[0][4].entries[0].difficulty).toBe(13); // 10 + 3
      expect(targetActor.unsetFlag).not.toHaveBeenCalled();
    });

    test("doesn't apply against a different Defense, or once the target has un-Morphed (stale flag)", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'evasion',
      });
      dice._rollSkillHelper = jest.fn();
      game.user.targets = makeTargetsSet(makeTargetActor({ defenseType: 'evasion' }));
      await dice.rollSkill({ ...dataset, skill: 'might', essence: 'strength' }, makeActor(), meleeWeaponEffect);
      expect(dice._rollSkillHelper.mock.calls[0][4].entries[0].difficulty).toBe(10);

      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'toughness',
      });
      game.user.targets = makeTargetsSet(makeTargetActor({ isMorphed: false }));
      await dice.rollSkill({ ...dataset, skill: 'might', essence: 'strength' }, makeActor(), meleeWeaponEffect);
      expect(dice._rollSkillHelper.mock.calls[1][4].entries[0].difficulty).toBe(10);
    });
  });

  describe("Summon Armor / Summon Shield - Defense bonus (MLP CRB spells)", () => {
    function makeActor() {
      return { ...mockActor, items: [], getRollData: jest.fn(() => ({ skills: { might: { modifier: '0', shift: 'd20' } } })) };
    }

    function makeTargetActor({ active = true, defenseType = 'toughness' } = {}) {
      return {
        name: 'Target',
        uuid: 'Actor.target1',
        system: { defenses: { [defenseType]: { total: 10 } }, immunities: {}, size: 'common', isMorphed: true },
        statuses: new Set(),
        items: [],
        getFlag: jest.fn((scope, key) => (key == 'summonArmorActive' ? active : undefined)),
        // Summon Armor / Shield's rules mark the target (items/magic/summon-armor.mjs reads the mark).
        flags: { essence20: active ? { ruleMarks: { summonArmor: { by: 'Actor.caster', until: null, stamp: null } } } : {} },
        setFlag: jest.fn(),
        unsetFlag: jest.fn(),
      };
    }

    function makeTargetsSet(targetActor) {
      const token = { actor: targetActor, center: { x: 0, y: 0 } };
      const set = new Set([token]);
      set.first = () => token;
      return set;
    }

    const meleeWeaponEffect = {
      type: 'weaponEffect',
      flags: {},
      system: { classification: { skill: 'might', style: 'melee' }, damageType: 'blunt', damageValue: 1 },
    };

    let originalTargets;
    beforeEach(() => {
      originalTargets = game.user.targets;
    });
    afterEach(() => {
      game.user.targets = originalTargets;
    });

    test.each(['toughness', 'evasion'])("adds +2 to %s difficulty while active, without consuming it", async (defenseType) => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType,
      });
      dice._rollSkillHelper = jest.fn();
      const targetActor = makeTargetActor({ defenseType });
      game.user.targets = makeTargetsSet(targetActor);

      await dice.rollSkill({ ...dataset, skill: 'might', essence: 'strength' }, makeActor(), meleeWeaponEffect);

      expect(dice._rollSkillHelper.mock.calls[0][4].entries[0].difficulty).toBe(12); // 10 + 2
      expect(targetActor.unsetFlag).not.toHaveBeenCalled();
    });

    test("doesn't apply against an unrelated Defense, or without the flag", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'willpower',
      });
      dice._rollSkillHelper = jest.fn();
      game.user.targets = makeTargetsSet(makeTargetActor({ defenseType: 'willpower' }));
      await dice.rollSkill({ ...dataset, skill: 'might', essence: 'strength' }, makeActor(), meleeWeaponEffect);
      expect(dice._rollSkillHelper.mock.calls[0][4].entries[0].difficulty).toBe(10);

      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'toughness',
      });
      game.user.targets = makeTargetsSet(makeTargetActor({ active: false }));
      await dice.rollSkill({ ...dataset, skill: 'might', essence: 'strength' }, makeActor(), meleeWeaponEffect);
      expect(dice._rollSkillHelper.mock.calls[1][4].entries[0].difficulty).toBe(10);
    });
  });

  describe("Elemental Adaptation (Beneath the Helmet, Aqua Ranger, p.42) - Acid/Fire suppression", () => {
    function makeActor() {
      return {
        ...mockActor,
        items: [],
        getRollData: jest.fn(() => ({ skills: { might: { modifier: '0', shift: 'd20' } } })),
      };
    }

    function makeTargetsSet(targetActor) {
      const token = { actor: targetActor, center: { x: 0, y: 0 } };
      const set = new Set([token]);
      set.first = () => token;
      return set;
    }

    function makeTargetActor(adaptations = null) {
      return {
        name: 'Target', uuid: 'Actor.target1',
        system: { defenses: { toughness: { total: 10 }, evasion: { total: 10 } }, immunities: {}, size: 'common' },
        statuses: new Set(), items: [],
        getFlag: jest.fn((scope, key) => (key == 'aquaElementalAdaptations' ? adaptations : undefined)),
      };
    }

    const acidWeaponEffect = {
      type: 'weaponEffect', flags: {},
      system: { classification: { skill: 'might', style: 'melee' }, damageType: 'acid', damageValue: 1 },
    };
    const fireWeaponEffect = {
      type: 'weaponEffect', flags: {},
      system: { classification: { skill: 'might', style: 'melee' }, damageType: 'fire', damageValue: 1 },
    };

    let originalTargets;
    beforeEach(() => {
      originalTargets = game.user.targets;
    });
    afterEach(() => {
      game.user.targets = originalTargets;
    });

    test("suppresses Acid's own +1 damage vs. Toughness when the target has adapted to Acid", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'toughness',
      });
      dice._rollSkillHelper = jest.fn();
      game.user.targets = makeTargetsSet(makeTargetActor(['acid']));

      await dice.rollSkill({ ...dataset, skill: 'might', essence: 'strength' }, makeActor(), acidWeaponEffect);

      expect(dice._rollSkillHelper.mock.calls[0][4].damageValue).toBe(1); // no +1 Acid bonus
    });

    test("still applies Acid's own bonus without a matching adaptation", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'toughness',
      });
      dice._rollSkillHelper = jest.fn();
      game.user.targets = makeTargetsSet(makeTargetActor(['fire']));

      await dice.rollSkill({ ...dataset, skill: 'might', essence: 'strength' }, makeActor(), acidWeaponEffect);

      expect(dice._rollSkillHelper.mock.calls[0][4].damageValue).toBe(2); // 1 + 1 Acid bonus
    });

    test("suppresses Fire's own +1 damage vs. Evasion when the target has adapted to Fire", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'evasion',
      });
      dice._rollSkillHelper = jest.fn();
      game.user.targets = makeTargetsSet(makeTargetActor(['fire']));

      await dice.rollSkill({ ...dataset, skill: 'might', essence: 'strength' }, makeActor(), fireWeaponEffect);

      expect(dice._rollSkillHelper.mock.calls[0][4].damageValue).toBe(1); // no +1 Fire bonus
    });

    test("still applies Fire's own bonus with no target at all", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'evasion',
      });
      dice._rollSkillHelper = jest.fn();
      game.user.targets = { first: () => undefined };

      await dice.rollSkill({ ...dataset, skill: 'might', essence: 'strength', dif: '10' }, makeActor(), fireWeaponEffect);

      expect(dice._rollSkillHelper.mock.calls[0][4].damageValue).toBe(2); // 1 + 1 Fire bonus
    });
  });

  // (Zeo Crystal Boost's bonuses are rules on the Power - rules/conv18-convB.test.js.)

  describe("Wisdom of the Elders - Lightshield Armor (Through the Shattered Grid, Guardian of Eltar, 9th/18th level, p.72)", () => {
    function makeActor() {
      return { ...mockActor, items: [], getRollData: jest.fn(() => ({ skills: { might: { modifier: '0', shift: 'd20' } } })) };
    }

    function makeTargetActor({ active = true, defenseType = 'toughness' } = {}) {
      return {
        name: 'Target',
        uuid: 'Actor.target1',
        system: { defenses: { [defenseType]: { total: 10 } }, immunities: {}, size: 'common' },
        statuses: new Set(),
        items: [],
        getFlag: jest.fn((scope, key) => (key == 'wisdomOfTheEldersActive' ? { lightshieldArmor: active } : undefined)),
      };
    }

    function makeTargetsSet(targetActor) {
      const token = { actor: targetActor, center: { x: 0, y: 0 } };
      const set = new Set([token]);
      set.first = () => token;
      return set;
    }

    const meleeWeaponEffect = {
      type: 'weaponEffect',
      flags: {},
      system: { classification: { skill: 'might', style: 'melee' }, damageType: 'blunt', damageValue: 1 },
    };

    let originalTargets;
    beforeEach(() => {
      originalTargets = game.user.targets;
    });
    afterEach(() => {
      game.user.targets = originalTargets;
    });

    test("adds +2 to Toughness difficulty while active, without consuming it", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'toughness',
      });
      dice._rollSkillHelper = jest.fn();
      game.user.targets = makeTargetsSet(makeTargetActor({ active: true }));

      await dice.rollSkill({ ...dataset, skill: 'might', essence: 'strength' }, makeActor(), meleeWeaponEffect);

      expect(dice._rollSkillHelper.mock.calls[0][4].entries[0].difficulty).toBe(12); // 10 + 2
    });

    test("doesn't apply when inactive, or against a different Defense", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'toughness',
      });
      dice._rollSkillHelper = jest.fn();
      game.user.targets = makeTargetsSet(makeTargetActor({ active: false }));
      await dice.rollSkill({ ...dataset, skill: 'might', essence: 'strength' }, makeActor(), meleeWeaponEffect);
      expect(dice._rollSkillHelper.mock.calls[0][4].entries[0].difficulty).toBe(10);

      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'evasion',
      });
      game.user.targets = makeTargetsSet(makeTargetActor({ active: true, defenseType: 'evasion' }));
      await dice.rollSkill({ ...dataset, skill: 'might', essence: 'strength' }, makeActor(), meleeWeaponEffect);
      expect(dice._rollSkillHelper.mock.calls[1][4].entries[0].difficulty).toBe(10);
    });
  });

  describe("Disguise (Dark Skies Over Equestria, Elementary Aid spell, p.21)", () => {
    function makeDsoeDisguiseActor({ active = true } = {}) {
      return {
        ...mockActor,
        system: {
          ...mockActor.system,
          essenceShifts: {
            any: { shiftUp: 0, shiftDown: 0 },
            speed: { shiftUp: 0, shiftDown: 0 },
            social: { shiftUp: 0, shiftDown: 0 },
          },
        },
        getFlag: jest.fn((scope, key) => (key == 'dsoeDisguiseActive' ? (active ? { epoch: 1, window: 'scene', count: 1 } : undefined) : undefined)),
        getRollData: jest.fn(() => ({
          skills: {
            infiltration: { modifier: '0', shift: 'd20' },
            deception: { modifier: '0', shift: 'd20' },
          },
        })),
      };
    }

    test("grants Edge on Infiltration and Deception while active", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill({ ...dataset, skill: 'infiltration', essence: 'speed' }, makeDsoeDisguiseActor(), null);
      expect(rollDialog.getSkillRollOptions.mock.calls[0][1].edge).toBe(true);

      await dice.rollSkill({ ...dataset, skill: 'deception', essence: 'social' }, makeDsoeDisguiseActor(), null);
      expect(rollDialog.getSkillRollOptions.mock.calls[1][1].edge).toBe(true);
    });

    test("doesn't apply while inactive", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill({ ...dataset, skill: 'deception', essence: 'social' }, makeDsoeDisguiseActor({ active: false }), null);
      expect(rollDialog.getSkillRollOptions.mock.calls[0][1].edge).toBe(false);
    });
  });

  describe("Infiltration armor penalties - Silent battledress rule vs. My Little Pony's Light Armor", () => {
    function armor(sourceId, toughness) {
      return {
        type: 'armor', flags: { core: { sourceId } },
        system: { equipped: true, traits: [], totalBonusToughness: toughness, totalBonusEvasion: 0 },
      };
    }

    function makeActor(items) {
      return { statuses: new Set(), getFlag: jest.fn(() => undefined), items };
    }

    // Its own ↓1 is a RollModifier rule on the armor now (rules/conv14-other.test.js).
    test("MLP Light Armor takes no 'not Silent' penalty", () => {
      const actor = makeActor([armor("Compendium.essence20.mlp_crb.Item.4M1CnapdbRIBl3It", 1)]);
      expect(dice._getAutomaticCombatModifiers(actor, null, 'speed', 'infiltration').shiftDown).toBe(0);
    });

    test("other armor without Silent still takes a penalty equal to its bonus", () => {
      const actor = makeActor([armor("Compendium.essence20.gi_joe_crb.Item.someBattledress", 2)]);
      expect(dice._getAutomaticCombatModifiers(actor, null, 'speed', 'infiltration').shiftDown).toBe(2);
    });
  });

  describe("Wisdom of the Elders - Enhanced Reflexes (Through the Shattered Grid, Guardian of Eltar, 9th/18th level, p.72)", () => {
    // A fresh, isolated essenceShifts rather than the shared mockActor.system reference - see the
    // identical comment on Reckless Abandon/Silent Weapon Expertise's own makeActor() elsewhere in
    // this file (an earlier test mutates mockActor.system.essenceShifts in place without resetting
    // it, which would otherwise silently pollute this describe's own exact shiftUp assertions).
    function makeActor({ active = true } = {}) {
      return {
        ...mockActor,
        items: [],
        system: {
          ...mockActor.system,
          essenceShifts: {
            any: { shiftUp: 0, shiftDown: 0 },
            strength: { shiftUp: 0, shiftDown: 0 },
            speed: { shiftUp: 0, shiftDown: 0 },
            smarts: { shiftUp: 0, shiftDown: 0 },
            social: { shiftUp: 0, shiftDown: 0 },
          },
        },
        getFlag: jest.fn((scope, key) => (key == 'wisdomOfTheEldersActive' ? { enhancedReflexes: active } : undefined)),
        getRollData: jest.fn(() => ({
          skills: { acrobatics: { modifier: '0', shift: 'd20' }, athletics: { modifier: '0', shift: 'd20' } },
        })),
      };
    }

    test("adds ↑2 on Acrobatics while active", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill({ ...dataset, skill: 'acrobatics', essence: 'speed' }, makeActor(), null);

      expect(rollDialog.getSkillRollOptions.mock.calls[0][0].shiftUp).toBe(2);
    });

    test("doesn't apply while inactive, or on an unrelated skill", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill({ ...dataset, skill: 'acrobatics', essence: 'speed' }, makeActor({ active: false }), null);
      expect(rollDialog.getSkillRollOptions.mock.calls[0][0].shiftUp).toBe(0);

      await dice.rollSkill({ ...dataset, skill: 'athletics', essence: 'strength' }, makeActor(), null);
      expect(rollDialog.getSkillRollOptions.mock.calls[1][0].shiftUp).toBe(0);
    });
  });

  describe("Observer (Through the Shattered Grid, Guardian of Eltar, 10th level, p.72)", () => {
    function makeActor({ active = true } = {}) {
      return {
        ...mockActor,
        items: [],
        system: {
          ...mockActor.system,
          essenceShifts: {
            any: { shiftUp: 0, shiftDown: 0 },
            strength: { shiftUp: 0, shiftDown: 0 },
            speed: { shiftUp: 0, shiftDown: 0 },
            smarts: { shiftUp: 0, shiftDown: 0 },
            social: { shiftUp: 0, shiftDown: 0 },
          },
        },
        getFlag: jest.fn((scope, key) => (key == 'observerDisguiseActive' ? active : undefined)),
        getRollData: jest.fn(() => ({
          skills: { deception: { modifier: '0', shift: 'd20' } },
        })),
      };
    }

    test("adds ↑2 on Deception while the disguise is active", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill({ ...dataset, skill: 'deception', essence: 'social' }, makeActor(), null);

      expect(rollDialog.getSkillRollOptions.mock.calls[0][0].shiftUp).toBe(2);
    });

    test("doesn't apply while inactive", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill({ ...dataset, skill: 'deception', essence: 'social' }, makeActor({ active: false }), null);

      expect(rollDialog.getSkillRollOptions.mock.calls[0][0].shiftUp).toBe(0);
    });

    function makeSnaggedActor({ active = true } = {}) {
      return {
        ...makeActor({ active }),
        getRollData: jest.fn(() => ({
          skills: { deception: { modifier: '0', shift: 'd20', snag: true } },
        })),
      };
    }

    test("offers the Snag substitution only when disguised, on a Social roll, already carrying a Snag", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: true, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill({ ...dataset, skill: 'deception', essence: 'social' }, makeSnaggedActor(), null);

      expect(rollDialog.getSkillRollOptions.mock.calls[0][0].observerSnagSubstitutionAvailable).toBe(true);
    });

    test("not offered while inactive, even with a Snag already present", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: true, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(
        { ...dataset, skill: 'deception', essence: 'social' }, makeSnaggedActor({ active: false }), null,
      );

      expect(rollDialog.getSkillRollOptions.mock.calls[0][0].observerSnagSubstitutionAvailable).toBe(false);
    });

    test("applying the substitution clears the Snag and adds ↓2 instead", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: true, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        applyObserverSnagSubstitution: true,
      });
      dice._rollSkillHelper = jest.fn();
      // shift: 'd8' (not the shared dataset fixture's own hardcoded 'd20') - an untrained d20
      // skill downshifted by 2 more would fall into the auto-fail zone and never reach
      // _rollSkillHelper at all, the same fixture gotcha already documented elsewhere in this file
      // (Hobble's own downshift test).
      await dice.rollSkill(
        { ...dataset, skill: 'deception', essence: 'social', shift: 'd8' }, makeSnaggedActor(), null,
      );

      expect(dice._rollSkillHelper.mock.calls[0][0]).not.toContain('2d20kl');
    });
  });

  describe("Ram (TF CRB, p.49) - Size Class damage bonus", () => {
    function makeRamVehicleActor(size) {
      return {
        type: 'vehicle',
        items: [],
        statuses: new Set(),
        getFlag: jest.fn(),
        system: {
          size,
          actors: {},
          essenceShifts: {
            any: { shiftUp: 0, shiftDown: 0 },
            strength: { shiftUp: 0, shiftDown: 0 },
            speed: { shiftUp: 0, shiftDown: 0 },
            smarts: { shiftUp: 0, shiftDown: 0 },
            social: { shiftUp: 0, shiftDown: 0 },
          },
        },
        getRollData: jest.fn(() => ({
          skills: { might: { modifier: '0', shift: 'd20' } },
        })),
      };
    }

    const ramWeaponEffect = {
      name: 'Ram',
      type: 'weaponEffect',
      flags: {},
      system: {
        classification: { skill: 'might', style: 'melee' }, damageType: 'blunt', damageValue: 1, isRam: true,
      },
    };

    async function rollRam(size) {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill({ ...dataset, dif: '10', skill: 'might' }, makeRamVehicleActor(size), ramWeaponEffect);

      return dice._rollSkillHelper.mock.calls[0][4];
    }

    test("adds no bonus at exactly Large", async () => {
      expect((await rollRam('large')).damageValue).toBe(1); // just the base 1 Blunt
    });

    test("adds no bonus at the half-step Long (not a full Size Class)", async () => {
      expect((await rollRam('long')).damageValue).toBe(1);
    });

    test("adds +1 at Huge (one full Size Class above Large)", async () => {
      expect((await rollRam('huge')).damageValue).toBe(2);
    });

    test("stays at +1 through the half-step Extended (not yet a second full Size Class)", async () => {
      expect((await rollRam('extended')).damageValue).toBe(2);
    });

    test("adds +2 at Gigantic (two full Size Classes above Large, e.g. Monolith)", async () => {
      expect((await rollRam('gigantic')).damageValue).toBe(3);
    });

    test("adds +4 at Titanic (four full Size Classes above Large)", async () => {
      expect((await rollRam('titanic')).damageValue).toBe(5);
    });

    test("adds no bonus below Large", async () => {
      expect((await rollRam('common')).damageValue).toBe(1);
    });

    test("doesn't apply to a non-Ram attack, even at a large Size", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();
      const notRam = { ...ramWeaponEffect, system: { ...ramWeaponEffect.system, isRam: false } };

      await dice.rollSkill({ ...dataset, dif: '10', skill: 'might' }, makeRamVehicleActor('titanic'), notRam);

      expect(dice._rollSkillHelper.mock.calls[0][4].damageValue).toBe(1);
    });
  });

  describe("Automatic combat modifier sources - interactive toggle (see _getAutomaticCombatModifiers's own addSource doc comment)", () => {
    const meleeWeaponEffect = {
      type: 'weaponEffect',
      flags: {},
      system: { classification: { skill: 'athletics', style: 'melee' }, damageType: 'blunt', damageValue: 1, defenseType: 'toughness' },
    };

    function makeActor() {
      return {
        ...mockActor,
        id: 'scout1',
        uuid: 'Actor.scout1',
        getFlag: jest.fn(() => undefined),
        getRollData: jest.fn(() => ({ skills: { athletics: { modifier: '0', shift: 'd8' } } })),
      };
    }

    // Mark Target's designation is a rule mark on the target (rules/conv15-banked.test.js).
    function makeTarget() {
      return {
        uuid: 'Actor.target1', system: { size: 'common' }, statuses: new Set(),
        flags: { essence20: { ruleMarks: { 'markTarget--scout1': { by: 'Actor.scout1', until: null, stamp: null } } } },
      };
    }

    afterEach(() => {
      game.user.targets.first.mockReturnValue(undefined);
    });

    test("Mark Target's own +1 shiftUp is folded into the roll by default (shifts d8 up to d10)", async () => {
      game.user.targets.first.mockReturnValue({ actor: makeTarget() });
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 1, shiftDown: 0, timesToRoll: 1, dif: '10',
      });
      dice._rollSkillHelper = jest.fn();

      // dataset.shift overridden to undefined here (rather than the shared fixture's own 'd20')
      // so the actor's own real 'd8' athletics shift is what actually starts the shift chain -
      // dataset.shift, when set, wins over actorSkillData.shift (see rollSkill's own
      // initialShift computation) - the same "shared dataset fixture hardcodes shift: 'd20'"
      // gotcha this project has already documented and hit before (Hobble/Observer's own tests).
      await dice.rollSkill({ ...dataset, dif: '10', shift: undefined }, makeActor(), meleeWeaponEffect);

      expect(dice._rollSkillHelper.mock.calls[0][0]).toContain('d10');
    });

    test("unchecking the source's own switch excludes its shiftUp, leaving the roll at d8", async () => {
      game.user.targets.first.mockReturnValue({ actor: makeTarget() });
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 1, shiftDown: 0, timesToRoll: 1, dif: '10',
        disabledModifierSourceIds: ['markTarget'],
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill({ ...dataset, dif: '10', shift: undefined }, makeActor(), meleeWeaponEffect);

      expect(dice._rollSkillHelper.mock.calls[0][0]).toContain('d8');
    });

    test("an unrelated disabled id (not present in this roll's own sources) has no effect", async () => {
      game.user.targets.first.mockReturnValue({ actor: makeTarget() });
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 1, shiftDown: 0, timesToRoll: 1, dif: '10',
        disabledModifierSourceIds: ['someOtherSourceNotOnThisRoll'],
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill({ ...dataset, dif: '10', shift: undefined }, makeActor(), meleeWeaponEffect);

      expect(dice._rollSkillHelper.mock.calls[0][0]).toContain('d10');
    });
  });

  describe("Over the Candlestick - Agile Reflexes (Technorganic Secrets, Climber/Nimble Origin Benefit, p.38)", () => {
    const OVER_THE_CANDLESTICK_ID = "Compendium.essence20.technorganic_secrets.Item.zKngKkwDyNv2nnH5";
    const meleeWeaponEffectHere = {
      type: 'weaponEffect',
      flags: {},
      system: { classification: { skill: 'might', style: 'melee' }, damageType: 'sharp', damageValue: 1 },
    };

    function makeAgileReflexesAttacker() {
      return {
        ...mockActor,
        items: [],
        getRollData: jest.fn(() => ({ skills: { might: { modifier: '0', shift: 'd20' } } })),
      };
    }

    function makeAgileReflexesTarget({ hasPerk = true, choice = 'agileReflexes', usedThisEncounter = false } = {}) {
      return {
        name: 'Target',
        statuses: new Set(),
        system: {
          defenses: { toughness: { total: 10, armor: 3 }, evasion: { total: 6 } },
          isMorphed: false, size: 'common',
        },
        items: hasPerk
          ? [{ type: 'perk', flags: { core: { sourceId: OVER_THE_CANDLESTICK_ID } }, system: { choice } }]
          : [],
        getFlag: jest.fn((scope, key) => (
          key == 'agileReflexesUsedThisEncounter' && usedThisEncounter ? { epoch: 1, window: 'encounter', count: 1 } : undefined
        )),
        setFlag: jest.fn(),
      };
    }

    let originalCombat;
    let originalTargets;
    beforeEach(() => {
      originalCombat = game.combat;
      game.combat = { id: 'combat1' };
      originalTargets = game.user.targets;
    });
    afterEach(() => {
      game.combat = originalCombat;
      game.user.targets = originalTargets;
    });

    test("swaps in Evasion Defense instead of Toughness once per scene", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        defenseType: 'toughness',
      });
      dice._rollSkillHelper = jest.fn();
      const actor = makeAgileReflexesAttacker();
      const targetActor = makeAgileReflexesTarget();
      const targetToken = { actor: targetActor, center: {} };
      game.user.targets = new Set([targetToken]);
      game.user.targets.first = () => targetToken;

      await dice.rollSkill({ ...dataset, skill: 'might', essence: 'strength' }, actor, meleeWeaponEffectHere);

      expect(dice._rollSkillHelper.mock.calls[0][4].entries[0].difficulty).toBe(6); // Evasion, not 10-3 Toughness
      expect(targetActor.setFlag).toHaveBeenCalledWith('essence20', 'agileReflexesUsedThisEncounter', { epoch: 1, window: 'encounter', count: 1 });
    });

    test("doesn't apply against a different Defense, without the Perk, with Innate Climber chosen instead, or once already used this scene", async () => {
      const rollDialog = createMockRollDialog();
      dice._rollSkillHelper = jest.fn();
      const actor = makeAgileReflexesAttacker();

      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        defenseType: 'evasion',
      });
      let targetActor = makeAgileReflexesTarget();
      let targetToken = { actor: targetActor, center: {} };
      game.user.targets = new Set([targetToken]);
      game.user.targets.first = () => targetToken;
      await dice.rollSkill({ ...dataset, skill: 'might', essence: 'strength' }, actor, meleeWeaponEffectHere);
      expect(dice._rollSkillHelper.mock.calls[0][4].entries[0].difficulty).toBe(6); // its own Evasion, untouched

      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        defenseType: 'toughness',
      });
      targetActor = makeAgileReflexesTarget({ hasPerk: false });
      targetToken = { actor: targetActor, center: {} };
      game.user.targets = new Set([targetToken]);
      game.user.targets.first = () => targetToken;
      await dice.rollSkill({ ...dataset, skill: 'might', essence: 'strength' }, actor, meleeWeaponEffectHere);
      expect(dice._rollSkillHelper.mock.calls[1][4].entries[0].difficulty).toBe(10); // its own Toughness, untouched

      targetActor = makeAgileReflexesTarget({ choice: 'innateClimber' });
      targetToken = { actor: targetActor, center: {} };
      game.user.targets = new Set([targetToken]);
      game.user.targets.first = () => targetToken;
      await dice.rollSkill({ ...dataset, skill: 'might', essence: 'strength' }, actor, meleeWeaponEffectHere);
      expect(dice._rollSkillHelper.mock.calls[2][4].entries[0].difficulty).toBe(10); // its own Toughness, untouched

      targetActor = makeAgileReflexesTarget({ usedThisEncounter: true });
      targetToken = { actor: targetActor, center: {} };
      game.user.targets = new Set([targetToken]);
      game.user.targets.first = () => targetToken;
      await dice.rollSkill({ ...dataset, skill: 'might', essence: 'strength' }, actor, meleeWeaponEffectHere);
      expect(dice._rollSkillHelper.mock.calls[3][4].entries[0].difficulty).toBe(10); // its own Toughness, untouched
    });
  });

  describe("Eureka / Expert in Your Field / Influential (Technician/Expert Focus, p.104)", () => {
    const FIELD_ID = "Compendium.essence20.gi_joe_crb.Item.qHLeKSMin2F19O3C";
    const EUREKA_ID = "Compendium.essence20.gi_joe_crb.Item.I8gudNc8gLD63ziL";
    const EXPERT_IN_YOUR_FIELD_ID = "Compendium.essence20.gi_joe_crb.Item.mnLXHQ2TwR3A42fS";
    const scienceDataset = { ...dataset, skill: 'science', essence: 'smarts' };

    // Expert in Your Field's EdgeOrShift rule (rules/plugins/rolls/edge-or-shift.mjs).
    const EXPERT_RULES = [{ type: 'EdgeOrShift', upshift: 3, when: [`skill:choiceOf:${FIELD_ID}`] }];

    function makeActor({ perkIds = [], field = 'science', edge = false } = {}) {
      const items = perkIds.map(perkId => ({
        id: perkId.slice(-16), type: 'perk', flags: { core: { sourceId: perkId } }, system: perkId == EXPERT_IN_YOUR_FIELD_ID ? { rules: EXPERT_RULES } : {},
      }));
      if (field) {
        items.push({
          type: 'perk', flags: { core: { sourceId: FIELD_ID } }, system: { choice: field },
        });
      }

      items.get = jest.fn(() => null);

      // A fresh rules index: the spread would copy whatever index another test left cached on mockActor.
      const { ...plain } = mockActor;
      for (const key of Object.getOwnPropertySymbols(plain)) {
        delete plain[key];
      }

      return {
        ...plain,
        items,
        getRollData: jest.fn(() => ({ skills: { science: { modifier: '0', shift: 'd20', edge } } })),
      };
    }

    test("Expert in Your Field grants Edge on a Field Skill Test with no other Edge source", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: true, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(
        scienceDataset, makeActor({ perkIds: [EXPERT_IN_YOUR_FIELD_ID], edge: false }), null,
      );

      expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(
        expect.anything(), expect.objectContaining({ edge: true }), expect.anything(),
      );
    });

    test("Expert in Your Field upgrades to a shiftUp of 3 when Edge already came from elsewhere", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: true, snag: false, shiftUp: 3, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(
        scienceDataset, makeActor({ perkIds: [EXPERT_IN_YOUR_FIELD_ID], edge: true }), null,
      );

      expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(
        expect.objectContaining({ shiftUp: 3 }), expect.objectContaining({ edge: true }), expect.anything(),
      );
    });

    test("Expert in Your Field doesn't apply to a skill other than the actor's Field", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(
        scienceDataset, makeActor({ perkIds: [EXPERT_IN_YOUR_FIELD_ID], field: 'culture' }), null,
      );

      expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(
        expect.objectContaining({ shiftUp: 0 }), expect.objectContaining({ edge: false }), expect.anything(),
      );
    });

    // Influential is an ally-aura RollModifier on the Perk (holder:choiceOf - rules/conv15-items2.test.js).
  });

  describe("Anti-Tank (Weapon Effects and Traits, p.106) - a core weapon trait, not a Perk", () => {
    const antiTankDataset = { ...dataset, skill: 'targeting', essence: 'speed' };
    const antiTankEffect = {
      name: 'Cannon Effect',
      type: 'weaponEffect',
      flags: { essence20: { parentId: 'weapon1' } },
      system: { classification: { skill: "targeting" }, damageType: "blunt", damageValue: 1 },
    };

    function makeAttacker({ traits = ['antiTank'] } = {}) {
      const items = [];
      items.get = jest.fn(id => (id == 'weapon1' ? { flags: {}, system: { traits } } : null));

      return {
        ...mockActor,
        items,
        getRollData: jest.fn(() => ({ skills: { targeting: { modifier: '0', shift: 'd20' } } })),
      };
    }

    function makeTargetActor({ toughness = 12, platingBonus = 0, otherArmorBonus = 0 } = {}) {
      const armorItems = [];
      if (platingBonus) {
        armorItems.push({
          type: 'armor',
          system: { equipped: true, traits: ['plating'], totalBonusToughness: platingBonus },
        });
      }

      if (otherArmorBonus) {
        armorItems.push({
          type: 'armor',
          system: { equipped: true, traits: ['deflective'], totalBonusToughness: otherArmorBonus },
        });
      }

      const items = [];
      items.documentsByType = { armor: armorItems };

      return {
        name: 'Target',
        uuid: 'Actor.target1',
        system: { defenses: { toughness: { total: toughness }, evasion: { total: 12 } }, immunities: {}, size: 'common' },
        statuses: new Set(),
        items,
      };
    }

    function makeTargetsSet(targetActor) {
      const token = { actor: targetActor, center: { x: 0, y: 0 } };
      const set = new Set([token]);
      set.first = () => token;
      return set;
    }

    let originalTargets;
    beforeEach(() => {
      originalTargets = game.user.targets;
    });
    afterEach(() => {
      game.user.targets = originalTargets;
    });

    async function difficultyFor(attacker, target, defenseType = 'toughness') {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType,
      });
      dice._rollSkillHelper = jest.fn();
      game.user.targets = makeTargetsSet(target);

      await dice.rollSkill(antiTankDataset, attacker, antiTankEffect);

      return dice._rollSkillHelper.mock.calls[0][4].entries[0].difficulty;
    }

    test("subtracts the target's plating armor bonus from the Toughness difficulty", async () => {
      const difficulty = await difficultyFor(makeAttacker(), makeTargetActor({ toughness: 12, platingBonus: 4 }));
      expect(difficulty).toBe(8);
    });

    // RAW ignores PLATING specifically - deflective is Armor Piercing's business, not this.
    test("leaves a deflective bonus alone", async () => {
      const difficulty = await difficultyFor(makeAttacker(), makeTargetActor({ toughness: 12, otherArmorBonus: 4 }));
      expect(difficulty).toBe(12);
    });

    test("does nothing without the trait", async () => {
      const attacker = makeAttacker({ traits: [] });
      const difficulty = await difficultyFor(attacker, makeTargetActor({ toughness: 12, platingBonus: 4 }));
      expect(difficulty).toBe(12);
    });

    // RAW scopes it to Toughness, which is the only Defense armor plating contributes to.
    test("does nothing when the attack is compared against another Defense", async () => {
      const difficulty = await difficultyFor(
        makeAttacker(), makeTargetActor({ toughness: 12, platingBonus: 4 }), 'evasion',
      );
      expect(difficulty).toBe(12);
    });
  });

  describe("Titan-Class (The Enigma of Combination, Weapon Traits, p.49) - a core weapon trait, not a Perk", () => {
    const titanClassDataset = { ...dataset, skill: 'targeting', essence: 'speed' };
    const titanClassEffect = {
      name: 'Fusion Cannon Effect',
      type: 'weaponEffect',
      flags: { essence20: { parentId: 'weapon1' } },
      system: { classification: { skill: "targeting", style: "ranged" }, damageType: "energy", damageValue: 1 },
    };

    function makeAttacker({ traits = ['titanClass'], size = 'towering' } = {}) {
      const items = [];
      items.get = jest.fn(id => (id == 'weapon1' ? { flags: {}, system: { traits } } : null));

      return {
        ...mockActor,
        items,
        system: { ...mockActor.system, size },
        getRollData: jest.fn(() => ({ skills: { targeting: { modifier: '0', shift: 'd20' } } })),
      };
    }

    function makeTargetActor({ toughness = 12, baseBonus = 0, upgradeBonus = 0, size = 'common' } = {}) {
      const armorItems = [{
        type: 'armor',
        system: {
          equipped: true, traits: [],
          bonusToughness: baseBonus, totalBonusToughness: baseBonus + upgradeBonus,
        },
      }];

      const items = [];
      items.documentsByType = { armor: armorItems };

      return {
        name: 'Target',
        uuid: 'Actor.target1',
        system: { defenses: { toughness: { total: toughness }, evasion: { total: 12 } }, immunities: {}, size },
        statuses: new Set(),
        items,
      };
    }

    function makeTargetsSet(targetActor) {
      const token = { actor: targetActor, center: { x: 0, y: 0 } };
      const set = new Set([token]);
      set.first = () => token;
      return set;
    }

    let originalTargets;
    beforeEach(() => {
      originalTargets = game.user.targets;
    });
    afterEach(() => {
      game.user.targets = originalTargets;
    });

    async function difficultyFor(attacker, target, defenseType = 'toughness') {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType,
      });
      dice._rollSkillHelper = jest.fn();
      game.user.targets = makeTargetsSet(target);

      await dice.rollSkill(titanClassDataset, attacker, titanClassEffect);

      return dice._rollSkillHelper.mock.calls[0][4].entries[0].difficulty;
    }

    test("subtracts only the target's armor UPGRADE Toughness bonus, against a smaller target", async () => {
      const difficulty = await difficultyFor(
        makeAttacker({ size: 'towering' }),
        makeTargetActor({ toughness: 12, baseBonus: 3, upgradeBonus: 4, size: 'common' }),
      );
      expect(difficulty).toBe(8);
    });

    test("leaves the armor's own base bonus alone", async () => {
      const difficulty = await difficultyFor(
        makeAttacker({ size: 'towering' }),
        makeTargetActor({ toughness: 12, baseBonus: 3, upgradeBonus: 0, size: 'common' }),
      );
      expect(difficulty).toBe(12);
    });

    test("does nothing against a target of the wielder's own Size Class or larger", async () => {
      const difficulty = await difficultyFor(
        makeAttacker({ size: 'towering' }),
        makeTargetActor({ toughness: 12, upgradeBonus: 4, size: 'towering' }),
      );
      expect(difficulty).toBe(12);
    });

    test("does nothing without the trait", async () => {
      const difficulty = await difficultyFor(
        makeAttacker({ traits: [], size: 'towering' }),
        makeTargetActor({ toughness: 12, upgradeBonus: 4, size: 'common' }),
      );
      expect(difficulty).toBe(12);
    });
  });

  describe("Defend (Across the Stars, Weapon Traits, p.79) - a core weapon trait, not a Perk", () => {
    const meleeDataset = { ...dataset, skill: 'might', essence: 'strength' };
    const meleeEffect = {
      name: 'Sword Effect',
      type: 'weaponEffect',
      flags: { essence20: { parentId: 'weapon1' } },
      system: { classification: { skill: "might", style: "melee" }, damageType: "sharp", damageValue: 1 },
    };
    const rangedEffect = {
      ...meleeEffect,
      name: 'Bow Effect',
      system: { classification: { skill: "might", style: "ranged" }, damageType: "sharp", damageValue: 1 },
    };

    function makeAttacker() {
      const items = [];
      items.get = jest.fn(id => (id == 'weapon1' ? { flags: {}, system: { traits: [] } } : null));

      return {
        ...mockActor,
        items,
        getRollData: jest.fn(() => ({ skills: { might: { modifier: '0', shift: 'd20' } } })),
      };
    }

    function makeTargetActor({ toughness = 12, evasion = 12, defendMagnitude = 1, defendRangedMagnitude = null } = {}) {
      const weaponItems = [{
        type: 'weapon',
        system: { equipped: true, traits: ['defend'], defendMagnitude, defendRangedMagnitude },
      }];

      const items = [];
      items.documentsByType = { armor: [], weapon: weaponItems };

      return {
        name: 'Target',
        uuid: 'Actor.target1',
        system: {
          defenses: { toughness: { total: toughness }, evasion: { total: evasion } },
          immunities: {}, size: 'common',
        },
        statuses: new Set(),
        items,
      };
    }

    function makeTargetsSet(targetActor) {
      const token = { actor: targetActor, center: { x: 0, y: 0 } };
      const set = new Set([token]);
      set.first = () => token;
      return set;
    }

    let originalTargets;
    beforeEach(() => {
      originalTargets = game.user.targets;
    });
    afterEach(() => {
      game.user.targets = originalTargets;
    });

    async function difficultyFor(target, { defenseType = 'toughness', ranged = false } = {}) {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType,
      });
      dice._rollSkillHelper = jest.fn();
      game.user.targets = makeTargetsSet(target);

      await dice.rollSkill(meleeDataset, makeAttacker(), ranged ? rangedEffect : meleeEffect);

      return dice._rollSkillHelper.mock.calls[0][4].entries[0].difficulty;
    }

    test("adds the defender's own Defend bonus to Toughness against a melee attack", async () => {
      const difficulty = await difficultyFor(makeTargetActor({ toughness: 12, defendMagnitude: 1 }));
      expect(difficulty).toBe(13);
    });

    test("adds it to Evasion too", async () => {
      const difficulty = await difficultyFor(
        makeTargetActor({ toughness: 12, evasion: 12, defendMagnitude: 1 }), { defenseType: 'evasion' },
      );
      expect(difficulty).toBe(13);
    });

    test("does nothing against a ranged attack when no defendRangedMagnitude is set", async () => {
      const difficulty = await difficultyFor(makeTargetActor({ toughness: 12, defendMagnitude: 2 }), { ranged: true });
      expect(difficulty).toBe(12);
    });

    test("uses defendRangedMagnitude against a ranged attack when the weapon prints one", async () => {
      const difficulty = await difficultyFor(
        makeTargetActor({ toughness: 12, defendMagnitude: 2, defendRangedMagnitude: 1 }), { ranged: true },
      );
      expect(difficulty).toBe(13);
    });
  });

  // Roll With The Punches banks its doubling as a rule bank (bank {defense, defenseMultiply: 2}) - rules/bank.mjs#bankedDefenseMultiplier.
  describe("A banked Defense multiplier (Roll With The Punches)", () => {
    const targetingDataset = { ...dataset, skill: 'targeting', essence: 'speed' };
    const weaponEffect = {
      name: 'Rifle Effect',
      type: 'weaponEffect',
      flags: {},
      system: { classification: { skill: "targeting" }, damageType: "blunt", damageValue: 1 },
    };

    function makeActor() {
      return {
        ...mockActor,
        items: [],
        getRollData: jest.fn(() => ({ skills: { targeting: { modifier: '0', shift: 'd20' } } })),
      };
    }

    function makeTargetActor({ toughness = 12, pendingDefenseType = null } = {}) {
      return {
        name: 'Target',
        uuid: 'Actor.target1',
        system: { defenses: { toughness: { total: toughness } }, immunities: {}, size: 'common' },
        statuses: new Set(),
        items: [],
        flags: { essence20: { ruleBank: pendingDefenseType ? [{ id: 'b1', label: 'Roll With The Punches', defense: pendingDefenseType, defenseBonus: 0, defenseMultiply: 2, uses: 1, when: [], until: null }] : [] } },
        getFlag: jest.fn(() => undefined),
        update: jest.fn(),
        unsetFlag: jest.fn(),
      };
    }

    function makeTargetsSet(targetActor) {
      const token = { actor: targetActor, center: { x: 0, y: 0 } };
      const set = new Set([token]);
      set.first = () => token;

      return set;
    }

    let originalTargets;
    beforeEach(() => {
      originalTargets = game.user.targets;
    });
    afterEach(() => {
      game.user.targets = originalTargets;
    });

    test("doubles the Toughness difficulty and clears the flag when the banked Defense matches", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'toughness',
      });
      dice._rollSkillHelper = jest.fn();
      const target = makeTargetActor({ toughness: 12, pendingDefenseType: 'toughness' });
      game.user.targets = makeTargetsSet(target);

      await dice.rollSkill(targetingDataset, makeActor(), weaponEffect);

      expect(dice._rollSkillHelper).toHaveBeenCalledWith(
        expect.anything(), expect.anything(), expect.anything(), expect.anything(),
        expect.objectContaining({
          entries: expect.arrayContaining([expect.objectContaining({ difficulty: 24 })]),
        }),
        expect.anything(), expect.anything(),
      );
      expect(target.update).toHaveBeenCalledWith({ 'flags.essence20.ruleBank': [] });
    });

    test("doesn't double, and doesn't clear the flag, when the banked Defense doesn't match", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'toughness',
      });
      dice._rollSkillHelper = jest.fn();
      const target = makeTargetActor({ toughness: 12, pendingDefenseType: 'willpower' });
      game.user.targets = makeTargetsSet(target);

      await dice.rollSkill(targetingDataset, makeActor(), weaponEffect);

      expect(dice._rollSkillHelper).toHaveBeenCalledWith(
        expect.anything(), expect.anything(), expect.anything(), expect.anything(),
        expect.objectContaining({
          entries: expect.arrayContaining([expect.objectContaining({ difficulty: 12 })]),
        }),
        expect.anything(), expect.anything(),
      );
      expect(target.update).not.toHaveBeenCalled();
    });

    test("doesn't double with nothing banked", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'toughness',
      });
      dice._rollSkillHelper = jest.fn();
      game.user.targets = makeTargetsSet(makeTargetActor({ toughness: 12 }));

      await dice.rollSkill(targetingDataset, makeActor(), weaponEffect);

      expect(dice._rollSkillHelper).toHaveBeenCalledWith(
        expect.anything(), expect.anything(), expect.anything(), expect.anything(),
        expect.objectContaining({
          entries: expect.arrayContaining([expect.objectContaining({ difficulty: 12 })]),
        }),
        expect.anything(), expect.anything(),
      );
    });
  });

  describe("Move Like a Song (Green Ranger, Survival Boon choice, p.44) - forced-miss half (the Snag half lives in _getAutomaticCombatModifiers, tested separately)", () => {
    const MOVE_LIKE_A_SONG_ID = "Compendium.essence20.pr_crb.Item.3ax1l5TpluxcSp4o";
    // Seconds Between Click & Boom's Snag is an incoming item rule on the Perk.
    const SECONDS_BETWEEN_CLICK_AND_BOOM = {
      type: 'perk', name: 'Seconds Between Click & Boom', flags: {},
      system: { rules: [{ type: 'RollModifier', scope: 'incoming', snag: true, when: ['attack', 'defense:evasion'] }] },
    };

    function makeActor() {
      return {
        ...mockActor,
        items: [],
        getRollData: jest.fn(() => ({ skills: { might: { modifier: '0', shift: 'd20' } } })),
      };
    }

    // Move Like a Song's SnagOrMiss rule (rules/plugins/combat/snag-or-miss.mjs).
    const SONG_RULES = [{ type: 'SnagOrMiss', limit: { per: 'round' }, when: ['combat:exists'] }];

    function makeTargetActor(perkIds) {
      const items = perkIds.map(perkId => ({
        id: perkId.slice(-16), type: 'perk', flags: { core: { sourceId: perkId } }, system: perkId == MOVE_LIKE_A_SONG_ID ? { rules: SONG_RULES } : {},
      }));

      return {
        name: 'Target',
        uuid: 'Actor.target1',
        system: { defenses: { evasion: { total: 10 } }, immunities: {}, size: 'common' },
        statuses: new Set(),
        items,
        getFlag: jest.fn(),
        setFlag: jest.fn(),
        unsetFlag: jest.fn(),
      };
    }

    function makeTargetsSet(targetActor) {
      const token = { actor: targetActor, center: { x: 0, y: 0 } };
      const set = new Set([token]);
      set.first = () => token;

      return set;
    }

    const meleeEvasionWeaponEffect = {
      type: 'weaponEffect',
      flags: {},
      system: {
        classification: { skill: 'might', style: 'melee' }, damageType: 'blunt', damageValue: 1,
        defenseType: 'evasion',
      },
    };

    let originalTargets;
    beforeEach(() => {
      originalTargets = game.user.targets;
      game.combat = { id: 'combat1', round: 1, turn: 0 };
    });
    afterEach(() => {
      game.user.targets = originalTargets;
      game.combat = null;
    });

    test("forces an unbeatable difficulty when the first attack this round is already Snagged", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'evasion',
      });
      dice._rollSkillHelper = jest.fn();
      const target = makeTargetActor([MOVE_LIKE_A_SONG_ID]);
      target.items.push(SECONDS_BETWEEN_CLICK_AND_BOOM);
      game.user.targets = makeTargetsSet(target);

      await dice.rollSkill({ ...dataset, skill: 'might', essence: 'strength' }, makeActor(), meleeEvasionWeaponEffect);

      expect(dice._rollSkillHelper).toHaveBeenCalledWith(
        expect.anything(), expect.anything(), expect.anything(), expect.anything(),
        expect.objectContaining({
          entries: expect.arrayContaining([expect.objectContaining({ difficulty: Infinity })]),
        }),
        expect.anything(), expect.anything(),
      );
    });

    test("doesn't force a miss on a plain first attack (just the Snag, computed elsewhere)", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'evasion',
      });
      dice._rollSkillHelper = jest.fn();
      game.user.targets = makeTargetsSet(makeTargetActor([MOVE_LIKE_A_SONG_ID]));

      await dice.rollSkill({ ...dataset, skill: 'might', essence: 'strength' }, makeActor(), meleeEvasionWeaponEffect);

      expect(dice._rollSkillHelper).toHaveBeenCalledWith(
        expect.anything(), expect.anything(), expect.anything(), expect.anything(),
        expect.objectContaining({
          entries: expect.arrayContaining([expect.objectContaining({ difficulty: 10 })]),
        }),
        expect.anything(), expect.anything(),
      );
    });
  });

  describe("Power Ranger Tier 1 Perks", () => {
    const meleeWeaponEffect = { type: 'weaponEffect', system: { classification: { style: 'melee' } } };

    function makeActor({ perks = [], personalPower = 1, ideaPoints = null, roleSkillDieShift = null } = {}) {
      const items = perks.map(perk => ({
        type: 'perk',
        flags: { core: { sourceId: perk.id } },
        system: { advances: { currentValue: perk.currentValue } },
      }));
      items.get = jest.fn(() => null);

      // A single fixed object (not a fresh one per call) - _getBaseRolePoints() is called more
      // than once per roll (once to compute ideaPointAvailable, again to actually spend it), and
      // both calls - plus anything a test itself reads back - need to see the same instance for
      // its own update() mock to be observable.
      const ideaPointsItem = ideaPoints != null
        ? { system: { bonus: { type: 'none' }, resource: { value: ideaPoints } }, update: jest.fn() }
        : undefined;

      return {
        ...mockActor,
        items,
        system: {
          ...mockActor.system,
          powers: { personal: { value: personalPower } },
        },
        getRollData: jest.fn(() => ({
          skills: {
            athletics: { modifier: '0', shift: 'd20' },
            culture: { modifier: '0', shift: 'd20' },
            technology: { modifier: '0', shift: 'd20' },
            // Cunning Plan (A Jump Through Time, Orange Ranger, 1st level) - see its own describe
            // block below. Only present when a test actually needs a Cunning die to substitute.
            ...(roleSkillDieShift ? { roleSkillDie: { modifier: '0', shift: roleSkillDieShift } } : {}),
          },
        })),
        _getBaseRolePoints: jest.fn(() => ideaPointsItem),
      };
    }

    describe("A ticked capDie switch (Programmable's d12)", () => {
      test("never lets the final shift exceed d12, even stacked with other upshifts", async () => {
        const rollDialog = createMockRollDialog();
        const resolvedOptions = {
          canCritD2: false, edge: false, snag: false, shiftUp: 10, shiftDown: 0, timesToRoll: 1,
          ruleCapDie: 'd12',
        };
        rollDialog.getSkillRollOptions.mockReturnValue(resolvedOptions);
        dice._rollSkillHelper = jest.fn();
        const actor = makeActor({});

        await dice.rollSkill({ ...dataset, skill: 'athletics', shift: 'd20' }, actor, null);

        const rollFormula = dice._rollSkillHelper.mock.calls[0][0];
        expect(rollFormula).toContain('d12');
        expect(rollFormula).not.toContain('3d6');
        expect(rollFormula).not.toContain('2d8');
      });
    });

  });

  describe("Space Vessel Conditions (Across the Stars p.25-26)", () => {
    const vesselWeaponEffect = (system = {}) => ({
      type: 'weaponEffect',
      flags: {},
      system: { classification: { skill: 'targeting', style: 'projectile' }, damageType: 'laser', damageValue: 2, numTargets: 1, ...system },
    });

    function makeShooter({ shift = 'd6', type = 'playerCharacter', statuses = {} } = {}) {
      const items = [];
      items.get = jest.fn(() => null);
      return {
        ...mockActor,
        type,
        items,
        statuses: new Set(Object.keys(statuses)),
        effects: Object.entries(statuses).map(([id, stacks]) => ({ statuses: new Set([id]), flags: { essence20: { stacks } } })),
        getRollData: jest.fn(() => ({ skills: { targeting: { modifier: '0', shift } } })),
      };
    }

    const bigShip = {
      type: 'vehicle', statuses: new Set(), items: [], effects: [], getFlag: () => undefined,
      system: { size: 'gigantic', traits: { zeroG: true }, movement: { aerial: { base: 0 } } },
    };
    const originalTargets = game.user.targets;
    afterEach(() => {
      game.user.targets = originalTargets;
    });

    function targetOnly(actor) {
      game.user.targets = { size: 1, first: () => ({ actor }) };
    }

    test("offers the targeted-system toggle only when its requirements hold", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      targetOnly(bigShip);
      await dice.rollSkill({ ...dataset, skill: 'targeting' }, makeShooter(), vesselWeaponEffect());
      expect(rollDialog.getSkillRollOptions.mock.calls[0][0].targetVesselSystemAvailable).toBe(true);

      await dice.rollSkill({ ...dataset, skill: 'targeting' }, makeShooter({ shift: 'd2' }), vesselWeaponEffect());
      expect(rollDialog.getSkillRollOptions.mock.calls[1][0].targetVesselSystemAvailable).toBe(false);

      await dice.rollSkill({ ...dataset, skill: 'targeting' }, makeShooter(), vesselWeaponEffect({ damageValue: 1 }));
      expect(rollDialog.getSkillRollOptions.mock.calls[2][0].targetVesselSystemAvailable).toBe(false);

      targetOnly({ ...bigShip, type: 'zord' });
      await dice.rollSkill({ ...dataset, skill: 'targeting' }, makeShooter(), vesselWeaponEffect());
      expect(rollDialog.getSkillRollOptions.mock.calls[3][0].targetVesselSystemAvailable).toBe(false);
    });

    test("checking it downshifts 2 and carries the attempt to the Critical Effect", async () => {
      const rollDialog = createMockRollDialog();
      const skillRollOptions = {
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        applyTargetVesselSystem: true,
      };
      rollDialog.getSkillRollOptions.mockReturnValue(skillRollOptions);
      dice._rollSkillHelper = jest.fn();
      targetOnly(bigShip);

      await dice.rollSkill({ ...dataset, shift: '3d6', skill: 'targeting', dif: '10' }, makeShooter(), vesselWeaponEffect());
      expect(skillRollOptions.shiftDown).toBe(2);
      expect(dice._rollSkillHelper.mock.calls[0][4].targetVesselSystemAttempt).toBe(true);
    });

    test("a checked box without the requirements does nothing", async () => {
      const rollDialog = createMockRollDialog();
      const skillRollOptions = {
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        applyTargetVesselSystem: true,
      };
      rollDialog.getSkillRollOptions.mockReturnValue(skillRollOptions);
      dice._rollSkillHelper = jest.fn();
      game.user.targets = { size: 0, first: () => undefined };

      await dice.rollSkill({ ...dataset, skill: 'targeting', dif: '10' }, makeShooter(), vesselWeaponEffect());
      expect(skillRollOptions.shiftDown).toBe(0);
      expect(dice._rollSkillHelper.mock.calls[0][4].targetVesselSystemAttempt).toBe(false);
    });

    test("a repair roll carries the vessel and Condition through to the post-roll processing", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill({
        ...dataset, skill: 'targeting', dif: '12', repairVesselUuid: 'Actor.ship', repairVesselCondition: 'leaking',
      }, makeShooter());
      expect(dice._rollSkillHelper.mock.calls[0][4]).toMatchObject({ repairVesselUuid: 'Actor.ship', repairVesselCondition: 'leaking' });
    });

    test("a vehicle Unstable three times over can't attack with its hardpoint weapons", async () => {
      const rollDialog = createMockRollDialog();
      dice._rollSkillHelper = jest.fn();
      ui.notifications.warn.mockClear();

      await dice.rollSkill({ ...dataset, skill: 'targeting' }, makeShooter({ type: 'vehicle', statuses: { unstable: 3 } }), vesselWeaponEffect());
      expect(ui.notifications.warn).toHaveBeenCalledWith('E20.VesselConditionUnstableInoperable');
      expect(rollDialog.getSkillRollOptions).not.toHaveBeenCalled();
    });
  });

  describe("Restricted Wild Animal Survival Kit (Operation Cold Iron p.39)", () => {
    const KIT_ID = "Compendium.essence20.operation_cold_iron.Item.EI7uvXnVEv0eK1C7";
    const originalTargets = global.game.user.targets;

    function makeKitActor({ hasKit = true } = {}) {
      const items = hasKit ? [{
        id: 'kit1', type: 'gear', name: 'Restricted Wild Animal Survival Kit', system: { gearType: 'kits' },
        flags: { core: { sourceId: KIT_ID }, essence20: {} },
      }] : [];
      items.get = jest.fn(() => null);
      return {
        ...mockActor,
        items,
        getRollData: jest.fn(() => ({
          skills: {
            persuasion: { modifier: '0', shift: 'd6' }, animalHandling: { modifier: '0', shift: 'd10' },
            survival: { modifier: '0', shift: 'd8' },
            deception: { modifier: '0', shift: 'd6' },
          },
        })),
      };
    }

    function setTargets(actors) {
      const list = actors.map(actor => ({ actor }));
      list.first = () => list[0];
      global.game.user.targets = list;
    }

    afterEach(() => {
      global.game.user.targets = originalTargets;
    });

    function mockOptions(extra = {}) {
      const rollDialog = createMockRollDialog();
      const options = { canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, ...extra };
      rollDialog.getSkillRollOptions.mockReturnValue(options);
      dice._rollSkillHelper = jest.fn();
      return { rollDialog, options };
    }

    const persuasion = { ...dataset, skill: 'persuasion', essence: 'social', shift: 'd6' };

    test("offered on Persuasion against an animal, and substitutes the chosen Skill's die", async () => {
      setTargets([{ ...mockActor, items: [], system: { creatureTags: 'Animal, predator' } }]);
      const { rollDialog, options } = mockOptions({ wildAnimalKitSkill: 'animalHandling' });

      await dice.rollSkill(persuasion, makeKitActor(), null);

      const offered = rollDialog.getSkillRollOptions.mock.calls[0][0].wildAnimalKit;
      expect(offered.skills.map(s => s.value)).toEqual(['animalHandling', 'survival']);
      expect(options.shiftUp).toBe(2);
    });

    test("offered with no target, but not against a non-animal, on another Skill, or without the kit", async () => {
      global.game.user.targets = { first: jest.fn(() => undefined) };
      let { rollDialog } = mockOptions();
      await dice.rollSkill(persuasion, makeKitActor(), null);
      expect(rollDialog.getSkillRollOptions.mock.calls[0][0].wildAnimalKit).toBeTruthy();

      setTargets([{ ...mockActor, items: [], system: { creatureTags: 'human' } }]);
      ({ rollDialog } = mockOptions({ wildAnimalKitSkill: 'survival' }));
      await dice.rollSkill(persuasion, makeKitActor(), null);
      expect(rollDialog.getSkillRollOptions.mock.calls[0][0].wildAnimalKit).toBeNull();

      ({ rollDialog } = mockOptions());
      await dice.rollSkill({ ...persuasion, skill: 'deception' }, makeKitActor(), null);
      expect(rollDialog.getSkillRollOptions.mock.calls[0][0].wildAnimalKit).toBeNull();

      ({ rollDialog } = mockOptions());
      await dice.rollSkill(persuasion, makeKitActor({ hasKit: false }), null);
      expect(rollDialog.getSkillRollOptions.mock.calls[0][0].wildAnimalKit).toBeNull();
    });

    test("ignores a stale Skill choice when the switch wasn't offered", async () => {
      setTargets([{ ...mockActor, items: [], system: { creatureTags: 'human' } }]);
      const { options } = mockOptions({ wildAnimalKitSkill: 'animalHandling' });

      await dice.rollSkill(persuasion, makeKitActor(), null);

      expect(options.shiftUp).toBe(0);
    });
  });

  describe("Intimidating (GI Joe CRB/TF CRB, Weapon Effects and Traits, p.148 etc)", () => {
    function makeIntimidatingActor({ hasWeapon = true } = {}) {
      const weapon = {
        id: 'weapon1', type: 'weapon',
        system: { equipped: true, itemAndUpgradeTraits: ['intimidating'] },
      };
      const weaponEffect = {
        type: 'weaponEffect', flags: { essence20: { parentId: 'weapon1' } },
        system: { classification: { skill: 'might' } },
      };
      const items = hasWeapon ? [weapon, weaponEffect] : [];
      items.get = jest.fn(() => null);
      return {
        ...mockActor,
        items,
        getRollData: jest.fn(() => ({
          skills: {
            intimidation: { modifier: '0', shift: 'd6' }, might: { modifier: '0', shift: 'd10' },
            deception: { modifier: '0', shift: 'd6' },
          },
        })),
      };
    }

    test("substitutes the weapon's own better skill die as a shiftUp when checked", async () => {
      const rollDialog = createMockRollDialog();
      const returnedOptions = {
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        applyIntimidatingWeapon: true,
      };
      rollDialog.getSkillRollOptions.mockReturnValue(returnedOptions);
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill({ ...dataset, skill: 'intimidation', essence: 'social', shift: 'd6' }, makeIntimidatingActor(), null);

      expect(returnedOptions.shiftUp).toBe(2);
      expect(rollDialog.getSkillRollOptions.mock.calls[0][0].intimidatingWeaponSkill).toBe('might');
    });

    test("not offered on a different skill or without an equipped Intimidating weapon", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill({ ...dataset, skill: 'deception', essence: 'social' }, makeIntimidatingActor(), null);
      expect(rollDialog.getSkillRollOptions.mock.calls[0][0].intimidatingWeaponSkill).toBeNull();

      await dice.rollSkill(
        { ...dataset, skill: 'intimidation', essence: 'social' }, makeIntimidatingActor({ hasWeapon: false }), null,
      );
      expect(rollDialog.getSkillRollOptions.mock.calls[1][0].intimidatingWeaponSkill).toBeNull();
    });
  });

  describe("A rule switch's sneakAttackMultiplier (Quiet as the Grave)", () => {
    const difDataset = { ...dataset, dif: '10' };
    const weaponEffect = {
      name: 'Silenced Pistol Effect',
      type: 'weaponEffect',
      flags: {},
      system: { classification: { skill: "athletics" }, damageType: "blunt", damageValue: 1 },
    };

    function makeSneakAttackActor(perkIds = []) {
      const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
      items.get = jest.fn(() => null);

      return {
        ...mockActor,
        items,
        getActiveTokens: jest.fn(() => []), // no token -> checkSneakAttackEligibility reads NoTarget, autoEligible false
        getRollData: jest.fn(() => ({ skills: { athletics: { modifier: '0', shift: 'd20' } } })),
        _getBaseRolePoints: jest.fn(() => ({
          name: 'Sneak Attack Damage',
          flags: { core: { sourceId: "Compendium.essence20.gi_joe_crb.Item.Mrmbqza0XxVpKj6U" } },
          system: { bonus: { type: 'damageBonus', value: 3 }, isActivatable: false, isActive: false },
        })),
      };
    }

    test("doubles the damage bonus when Sneak Attack Damage applies", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        applyRolePointsDamage: true, ruleSneakAttackMultiplier: 2, ruleSneakAttackSource: 'Quiet as the Grave',
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(difDataset, makeSneakAttackActor(), weaponEffect);

      const checkContext = dice._rollSkillHelper.mock.calls[0][4];
      expect(checkContext.damageValue).toBe(7); // 1 (weapon) + 3*2 (doubled Sneak Attack bonus)
    });

    test("no multiplier, no doubling", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        applyRolePointsDamage: true,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(difDataset, makeSneakAttackActor(), weaponEffect);

      const checkContext = dice._rollSkillHelper.mock.calls[0][4];
      expect(checkContext.damageValue).toBe(4); // not doubled
    });
  });

  describe("Sneak Attack Damage applied - roll:dataset:sneakAttackDamage for hit Triggers (Debilitating Strike)", () => {
    const difDataset = { ...dataset, dif: '10' };
    const weaponEffect = {
      name: 'Silenced Pistol Effect',
      type: 'weaponEffect',
      flags: {},
      system: { classification: { skill: "athletics" }, damageType: "blunt", damageValue: 1 },
    };

    function makeSneakAttackActor(perkIds = []) {
      const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
      items.get = jest.fn(() => null);

      return {
        ...mockActor,
        items,
        getActiveTokens: jest.fn(() => []),
        getRollData: jest.fn(() => ({ skills: { athletics: { modifier: '0', shift: 'd20' } } })),
        _getBaseRolePoints: jest.fn(() => ({
          name: 'Sneak Attack Damage',
          flags: { core: { sourceId: "Compendium.essence20.gi_joe_crb.Item.Mrmbqza0XxVpKj6U" } },
          system: { bonus: { type: 'damageBonus', value: 3 }, isActivatable: false, isActive: false },
        })),
      };
    }

    test("is set when Sneak Attack Damage lands", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        applyRolePointsDamage: true,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(difDataset, makeSneakAttackActor(), weaponEffect);

      const checkContext = dice._rollSkillHelper.mock.calls[0][4];
      expect(checkContext.riderContext.dataset.sneakAttackDamage).toBe(true);
    });

    test("is not set when the box isn't ticked", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(difDataset, makeSneakAttackActor(), weaponEffect);

      const checkContext = dice._rollSkillHelper.mock.calls[0][4];
      expect(checkContext.riderContext.dataset.sneakAttackDamage).toBeUndefined();
    });
  });

  describe("Sudden Death's isMightMelee - flagged onto checkContext (Blitzer Focus, 20th level)", () => {
    // isMightMelee itself is just a fact about the attack, not the Perk - chat.mjs#onApplyDamage
    // does the actual Perk/Threat Level/once-per-combat checks once the target is known, so this
    // only needs to confirm dice.mjs correctly identifies a Might melee weaponEffect.
    const difDataset = { ...dataset, dif: '10' };

    function makeActor(skill) {
      const items = [];
      items.get = jest.fn(() => null);

      return {
        ...mockActor,
        items,
        getActiveTokens: jest.fn(() => []),
        getRollData: jest.fn(() => ({ skills: { [skill]: { modifier: '0', shift: 'd20' } } })),
      };
    }

    test("true for a Might melee weaponEffect", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();
      const weaponEffect = {
        name: 'Sword Effect', type: 'weaponEffect', flags: {},
        system: { classification: { skill: 'might', style: 'melee' }, damageType: 'sharp', damageValue: 1 },
      };

      await dice.rollSkill({ ...difDataset, skill: 'might' }, makeActor('might'), weaponEffect);

      const checkContext = dice._rollSkillHelper.mock.calls[0][4];
      expect(checkContext.isMightMelee).toBe(true);
    });

    test("false for a ranged Targeting weaponEffect", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();
      const weaponEffect = {
        name: 'Rifle Effect', type: 'weaponEffect', flags: {},
        system: { classification: { skill: 'targeting', style: 'projectile' }, damageType: 'ballistic', damageValue: 1 },
      };

      await dice.rollSkill({ ...difDataset, skill: 'targeting' }, makeActor('targeting'), weaponEffect);

      const checkContext = dice._rollSkillHelper.mock.calls[0][4];
      expect(checkContext.isMightMelee).toBe(false);
    });

    test("false for a Finesse melee weaponEffect (melee, but not Might)", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();
      const weaponEffect = {
        name: 'Knife Effect', type: 'weaponEffect', flags: {},
        system: { classification: { skill: 'finesse', style: 'melee' }, damageType: 'sharp', damageValue: 1 },
      };

      await dice.rollSkill({ ...difDataset, skill: 'finesse' }, makeActor('finesse'), weaponEffect);

      const checkContext = dice._rollSkillHelper.mock.calls[0][4];
      expect(checkContext.isMightMelee).toBe(false);
    });

    test("false for a non-attack roll (no item)", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill({ ...difDataset, skill: 'might' }, makeActor('might'), null);

      // dataset.dif still produces a checkContext (a flat Difficulty entry with no target) - just
      // never a Might melee one, since there's no weaponEffect item at all to be one.
      const checkContext = dice._rollSkillHelper.mock.calls[0][4];
      expect(checkContext.isMightMelee).toBe(false);
    });
  });

  describe("Multiple Targets (X, range/area) (p.198)", () => {
    const multipleTargetsWeaponEffect = {
      name: 'LMG Effect',
      type: 'weaponEffect',
      flags: { essence20: { parentId: 'weapon1' } },
      system: { classification: { skill: "targeting", style: "projectile" }, damageType: "ballistic", damageValue: 1 },
    };
    const targetingDataset = { ...dataset, defenseType: 'toughness', skill: 'targeting' };

    function makeActorWithWeapon(weapon) {
      const items = Object.assign([], { get: () => weapon });
      return {
        ...mockActor,
        items,
        getRollData: jest.fn(() => ({ skills: { targeting: { modifier: '0', shift: 'd20', edge: false, snag: false } } })),
      };
    }

    function makeTargetActor(name, toughness) {
      return {
        name,
        uuid: `Actor.${name}`,
        system: { defenses: { toughness: { total: toughness } }, immunities: {}, size: 'common' },
        statuses: new Set(),
        items: [],
      };
    }

    function makeTargetsSet(...targetActors) {
      const tokens = targetActors.map(targetActor => ({ actor: targetActor, center: { x: 0, y: 0 } }));
      const set = new Set(tokens);
      set.first = () => tokens[0];

      return set;
    }

    let originalTargets;
    beforeEach(() => {
      originalTargets = game.user.targets;
    });
    afterEach(() => {
      game.user.targets = originalTargets;
    });

    test("rolls independently per target - one _rollSkillHelper call per target, each its own single-entry checkContext", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'toughness',
      });
      dice._rollSkillHelper = jest.fn();
      const weapon = { system: { itemAndUpgradeTraits: ['multipleTargets'] } };
      game.user.targets = makeTargetsSet(makeTargetActor('Alpha', 10), makeTargetActor('Bravo', 15));

      await dice.rollSkill(targetingDataset, makeActorWithWeapon(weapon), multipleTargetsWeaponEffect);

      expect(dice._rollSkillHelper.mock.calls.length).toBe(2);
      const [firstContext, secondContext] = dice._rollSkillHelper.mock.calls.map(call => call[4]);
      expect(firstContext.entries).toEqual([
        { name: 'Alpha', targetUuid: 'Actor.Alpha', difficulty: 10, defenseType: 'toughness', defenderStepBonus: 0, defenderStepReactorUuid: null, targetUnconscious: false },
      ]);
      expect(secondContext.entries).toEqual([
        { name: 'Bravo', targetUuid: 'Actor.Bravo', difficulty: 15, defenseType: 'toughness', defenderStepBonus: 0, defenderStepReactorUuid: null, targetUnconscious: false },
      ]);
      // Every other checkContext field (damageValue, damageType, ...) still carries through
      // unchanged to each per-target call, same as a normal shared roll.
      expect(firstContext.damageValue).toBe(1);
      expect(secondContext.damageValue).toBe(1);
    });

    test("each per-target flavor text is built via the per-target label key (Mocki18n doesn't interpolate {name})", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'toughness',
      });
      dice._rollSkillHelper = jest.fn();
      const weapon = { system: { itemAndUpgradeTraits: ['multipleTargets'] } };
      game.user.targets = makeTargetsSet(makeTargetActor('Alpha', 10), makeTargetActor('Bravo', 15));

      await dice.rollSkill(targetingDataset, makeActorWithWeapon(weapon), multipleTargetsWeaponEffect);

      const [firstFlavor, secondFlavor] = dice._rollSkillHelper.mock.calls.map(call => call[2]);
      expect(firstFlavor).toContain('E20.RollMultipleTargetsText');
      expect(secondFlavor).toContain('E20.RollMultipleTargetsText');
    });

    test("stays a single shared roll for a weapon without the Multiple Targets trait, even with 2+ targets", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'toughness',
      });
      dice._rollSkillHelper = jest.fn();
      const weapon = { system: { itemAndUpgradeTraits: [] } };
      game.user.targets = makeTargetsSet(makeTargetActor('Alpha', 10), makeTargetActor('Bravo', 15));

      await dice.rollSkill(targetingDataset, makeActorWithWeapon(weapon), multipleTargetsWeaponEffect);

      expect(dice._rollSkillHelper.mock.calls.length).toBe(1);
      expect(dice._rollSkillHelper.mock.calls[0][4].entries.length).toBe(2);
    });

    test("stays a single roll with only one target, even with the Multiple Targets trait", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'toughness',
      });
      dice._rollSkillHelper = jest.fn();
      const weapon = { system: { itemAndUpgradeTraits: ['multipleTargets'] } };
      game.user.targets = makeTargetsSet(makeTargetActor('Alpha', 10));

      await dice.rollSkill(targetingDataset, makeActorWithWeapon(weapon), multipleTargetsWeaponEffect);

      expect(dice._rollSkillHelper.mock.calls.length).toBe(1);
      expect(dice._rollSkillHelper.mock.calls[0][4].entries.length).toBe(1);
    });
  });

  describe("Ranger/Predator's Sneak Attack (Predator Focus, 3rd level)", () => {
    const PREDATOR_FOCUS_ID = "Compendium.essence20.gi_joe_crb.Item.CCUJG5H6eEYRzdBQ";
    const SNEAK_ATTACK_PERK_ID = "Compendium.essence20.gi_joe_crb.Item.vyOjiJFMtryduiFO";
    const difDataset = { ...dataset, dif: '10' };
    const weaponEffect = {
      name: 'Silenced Pistol Effect',
      type: 'weaponEffect',
      flags: { essence20: { parentId: 'weapon1' } },
      system: { classification: { skill: "athletics" }, damageType: "blunt", damageValue: 1 },
    };

    // Same shared-compendium-Item wrinkle covered in sneak-attack.test.js's own
    // hasPredatorSneakAttack tests: only granting the Perk via a parent whose own sourceId is the
    // Predator Focus (not just having a copy of the Perk at all) counts.
    function makePredatorActor({ granted = true, traits = ['silent'], level = 3 } = {}) {
      const items = [];
      if (granted) {
        items.push({
          type: 'perk',
          flags: { core: { sourceId: SNEAK_ATTACK_PERK_ID }, essence20: { parentId: 'parent1' } },
        });
        items.push({ _id: 'parent1', flags: { core: { sourceId: PREDATOR_FOCUS_ID } } });
      }

      items.get = jest.fn(id => (id == 'weapon1' ? { system: { traits } } : items.find(i => i._id == id)));

      return {
        ...mockActor,
        items,
        system: { ...mockActor.system, level },
        getRollData: jest.fn(() => ({ skills: { athletics: { modifier: '0', shift: 'd20' } } })),
      };
    }

    beforeEach(() => {
      game.user.targets.first.mockReturnValue(undefined);
      game.combat = null;
    });

    test("is added to checkContext.damageValue when the dialog checkbox is checked", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        applyRolePointsDamage: true,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(difDataset, makePredatorActor({ level: 4 }), weaponEffect);

      const checkContext = dice._rollSkillHelper.mock.calls[0][4];
      expect(checkContext.damageValue).toBe(3); // 1 (weapon) + 2 (Predator Sneak Attack @ level 4)
    });

    test("is left out of checkContext.damageValue when the checkbox is unchecked", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        applyRolePointsDamage: false,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(difDataset, makePredatorActor(), weaponEffect);

      const checkContext = dice._rollSkillHelper.mock.calls[0][4];
      expect(checkContext.damageValue).toBe(1);
    });

    test("isn't offered at all without the Predator Focus's own grant (e.g. a Commando's own copy of the shared Perk)", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        applyRolePointsDamage: true, // even if somehow checked, there's nothing to apply
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(difDataset, makePredatorActor({ granted: false }), weaponEffect);

      expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(
        expect.objectContaining({ damageRolePoints: null }), expect.anything(), expect.anything(),
      );
      const checkContext = dice._rollSkillHelper.mock.calls[0][4];
      expect(checkContext.damageValue).toBe(1);
    });

    test("marks its own once-per-round flag used when applied", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        applyRolePointsDamage: true,
      });
      dice._rollSkillHelper = jest.fn();
      const actor = makePredatorActor();
      actor.getFlag = jest.fn(() => undefined);
      actor.setFlag = jest.fn();
      game.combat = { id: 'combat1', round: 1 };

      await dice.rollSkill(difDataset, actor, weaponEffect);

      expect(actor.setFlag).toHaveBeenCalledWith(
        'essence20', 'predatorSneakAttackLastRound', { combatId: 'combat1', round: 1 },
      );
    });
  });

  describe("pending banked bonus clearing (Time To Think / Plan of Action)", () => {
    test("clears every pending bonus consumed by this roll", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();
      const pendingFlags = {
        pendingImpulsive: { shiftDown: 1, combatId: null, round: null },
      };
      const actor = {
        ...mockActor,
        getFlag: jest.fn((scope, key) => (scope == 'essence20' ? pendingFlags[key] : undefined)),
        unsetFlag: jest.fn(),
        getRollData: jest.fn(() => ({ skills: { athletics: { modifier: '0', shift: 'd20' } } })),
      };

      await dice.rollSkill(dataset, actor, null);

      expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'pendingImpulsive');
    });

    test("doesn't clear anything when there's no pending bonus", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();
      const actor = {
        ...mockActor,
        getFlag: jest.fn(() => undefined),
        unsetFlag: jest.fn(),
        getRollData: jest.fn(() => ({ skills: { athletics: { modifier: '0', shift: 'd20' } } })),
      };

      await dice.rollSkill(dataset, actor, null);

      expect(actor.unsetFlag).not.toHaveBeenCalled();
    });
  });

  describe("tooCloseForMinimumRange - a real hard block", () => {
    const rangedWeaponEffect = {
      type: 'weaponEffect',
      flags: { essence20: { parentId: 'weapon1' } },
      system: {
        classification: { style: 'projectile' }, defenseType: 'toughness', range: { min: 10, value: 20, long: 80 },
      },
    };

    function makeActor(attackerToken) {
      const items = [];
      items.get = jest.fn(() => null);

      return {
        ...mockActor,
        items,
        getActiveTokens: jest.fn(() => [attackerToken]),
        getFlag: jest.fn(() => undefined),
        getRollData: jest.fn(() => ({ skills: { athletics: { modifier: '0', shift: 'd20' } } })),
      };
    }

    beforeEach(() => {
      canvas.tokens.placeables = [];
      chatMessage.create.mockClear();
      chatMessage.getSpeaker.mockClear();
    });

    afterEach(() => {
      chatMessage.create.mockClear();
      chatMessage.getSpeaker.mockClear();
    });

    test("refuses the roll and posts a chat message, without ever opening the dialog", async () => {
      const rollDialog = createMockRollDialog();
      dice._rollSkillHelper = jest.fn();

      const attackerToken = { center: { x: 0, y: 0 } };
      const targetActor = { system: { size: 'common' }, statuses: new Set(), items: [] };
      game.user.targets.first.mockReturnValue({ actor: targetActor, center: { x: 0, y: 0 } });
      canvas.grid.measurePath.mockReturnValue({ distance: 5 }); // closer than this weapon's own min range of 10

      await dice.rollSkill(dataset, makeActor(attackerToken), rangedWeaponEffect);

      expect(rollDialog.getSkillRollOptions).not.toHaveBeenCalled();
      expect(dice._rollSkillHelper).not.toHaveBeenCalled();
      expect(chatMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'E20.RollTooCloseMinimumRange' }),
      );

      game.user.targets.first.mockReturnValue(undefined);
    });

    test("doesn't block a roll at or beyond the minimum range", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      const attackerToken = { center: { x: 0, y: 0 } };
      const targetActor = { system: { size: 'common' }, statuses: new Set(), items: [] };
      game.user.targets.first.mockReturnValue({ actor: targetActor, center: { x: 0, y: 0 } });
      canvas.grid.measurePath.mockReturnValue({ distance: 15 });

      await dice.rollSkill(dataset, makeActor(attackerToken), rangedWeaponEffect);

      expect(rollDialog.getSkillRollOptions).toHaveBeenCalled();
      expect(dice._rollSkillHelper).toHaveBeenCalled();
      expect(chatMessage.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ content: 'E20.RollTooCloseMinimumRange' }),
      );

      game.user.targets.first.mockReturnValue(undefined);
    });
  });

  describe("Limited Articulation (TF CRB, several Alt Mode Chassis, e.g. Champion p.51)", () => {
    beforeEach(() => {
      ui.notifications.error.mockClear();
    });

    afterEach(() => {
      chatMessage.create.mockClear();
      chatMessage.getSpeaker.mockClear();
    });

    function makeActor(altModeId, altMode) {
      const items = [];
      items.get = jest.fn((id) => (id == altModeId ? altMode : null));

      return {
        ...mockActor,
        items,
        system: { ...mockActor.system, altModeId },
        getRollData: jest.fn(() => ({
          skills: {
            athletics: { modifier: '0', shift: 'd20' },
            persuasion: { modifier: '0', shift: 'd20' },
          },
        })),
      };
    }

    test("refuses an Athletics roll while converted into a Limited Articulation Alt Mode", async () => {
      const rollDialog = createMockRollDialog();
      dice._rollSkillHelper = jest.fn();
      const altMode = { system: { limitedArticulation: true } };
      const actor = makeActor('altMode1', altMode);

      await dice.rollSkill({ ...dataset, skill: 'athletics' }, actor, null);

      expect(rollDialog.getSkillRollOptions).not.toHaveBeenCalled();
      expect(dice._rollSkillHelper).not.toHaveBeenCalled();
      expect(ui.notifications.error).toHaveBeenCalled();
    });

    test("refuses a Finesse roll the same way", async () => {
      const rollDialog = createMockRollDialog();
      dice._rollSkillHelper = jest.fn();
      const altMode = { system: { limitedArticulation: true } };
      const actor = makeActor('altMode1', altMode);

      await dice.rollSkill({ ...dataset, skill: 'finesse' }, actor, null);

      expect(dice._rollSkillHelper).not.toHaveBeenCalled();
      expect(ui.notifications.error).toHaveBeenCalled();
    });

    test("doesn't block an unrelated Skill in the same Alt Mode", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();
      const altMode = { system: { limitedArticulation: true } };
      const actor = makeActor('altMode1', altMode);

      await dice.rollSkill({ ...dataset, skill: 'persuasion', essence: 'social' }, actor, null);

      expect(ui.notifications.error).not.toHaveBeenCalled();
      expect(rollDialog.getSkillRollOptions).toHaveBeenCalled();
    });

    test("doesn't block Athletics in Bot Mode (no active Alt Mode)", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();
      const actor = makeActor(null, null);

      await dice.rollSkill({ ...dataset, skill: 'athletics' }, actor, null);

      expect(ui.notifications.error).not.toHaveBeenCalled();
      expect(rollDialog.getSkillRollOptions).toHaveBeenCalled();
    });

    test("doesn't block Athletics in an Alt Mode without Limited Articulation", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();
      const altMode = { system: { limitedArticulation: false } };
      const actor = makeActor('altMode1', altMode);

      await dice.rollSkill({ ...dataset, skill: 'athletics' }, actor, null);

      expect(ui.notifications.error).not.toHaveBeenCalled();
      expect(rollDialog.getSkillRollOptions).toHaveBeenCalled();
    });
  });

  describe("Transformers Tier 2 Perks", () => {
    const ANALYZE_TARGET_ID = "Compendium.essence20.tf_crb.Item.UjzBPz4iUBoi8Kyk";

    function makeActor({ perkIds = [], health = null } = {}) {
      const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
      items.get = jest.fn(() => null);

      // A fresh, isolated essenceShifts rather than the shared mockActor.system reference - see
      // the identical comment on Reckless Abandon/Silent Weapon Expertise's own makeActor() above
      // (some earlier tests mutate mockActor.system.essenceShifts in place without resetting it).
      return {
        ...mockActor,
        items,
        system: {
          ...mockActor.system,
          essenceShifts: {
            any: { shiftUp: 0, shiftDown: 0 },
            strength: { shiftUp: 0, shiftDown: 0 },
            speed: { shiftUp: 0, shiftDown: 0 },
            smarts: { shiftUp: 0, shiftDown: 0 },
            social: { shiftUp: 0, shiftDown: 0 },
          },
          ...(health ? { health } : {}),
        },
        getRollData: jest.fn(() => ({
          skills: {
            athletics: { modifier: '0', shift: 'd20' },
            intimidation: { modifier: '0', shift: 'd20' },
            alertness: { modifier: '0', shift: 'd20' },
            science: { modifier: '0', shift: 'd20' },
            might: { modifier: '0', shift: 'd20' },
            targeting: { modifier: '0', shift: 'd20' },
          },
        })),
      };
    }

    const meleeMightWeaponEffect = {
      type: 'weaponEffect',
      flags: {},
      system: { classification: { skill: 'might', style: 'melee' }, damageType: 'blunt', damageValue: 1 },
    };
    const maneuverWeaponEffect = {
      type: 'weaponEffect',
      flags: {},
      system: { classification: { skill: 'might', style: 'melee' }, damageType: 'maneuver', damageValue: 1 },
    };

    describe("A rule switch's syntheticDamage (Psychoanalyst, Coax Surrender, Grinder, Deceptive Warfare)", () => {
      const scienceDataset = { ...dataset, skill: 'science', essence: 'smarts' };

      test("a ticked switch's Stun 2 feeds the checkContext's damage pipeline", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
          defenseType: 'willpower', ruleSyntheticDamage: { value: 2, type: 'stun' },
        });
        dice._rollSkillHelper = jest.fn();
        const targetActor = {
          name: 'Target', uuid: 'Actor.target1',
          system: { defenses: { willpower: { total: 10 } }, immunities: {}, size: 'common' },
          statuses: new Set(), items: [],
        };
        const token = { actor: targetActor, center: { x: 0, y: 0 } };
        const set = new Set([token]);
        set.first = () => token;
        game.user.targets = set;

        await dice.rollSkill(scienceDataset, makeActor(), null);

        const checkContext = dice._rollSkillHelper.mock.calls[0][4];
        expect(checkContext.damageValue).toBe(2);
        expect(checkContext.damageType).toBe('stun');

        game.user.targets = { first: jest.fn(() => undefined) };
      });

      test("no switch ticked, no damage", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
          defenseType: 'willpower',
        });
        dice._rollSkillHelper = jest.fn();
        const targetActor = {
          name: 'Target', uuid: 'Actor.target1',
          system: { defenses: { willpower: { total: 10 } }, immunities: {}, size: 'common' },
          statuses: new Set(), items: [],
        };
        const token = { actor: targetActor, center: { x: 0, y: 0 } };
        const set = new Set([token]);
        set.first = () => token;
        game.user.targets = set;

        await dice.rollSkill(scienceDataset, makeActor(), null);

        const checkContext = dice._rollSkillHelper.mock.calls[0][4];
        expect(checkContext.damageValue).toBe(null);

        game.user.targets = { first: jest.fn(() => undefined) };
      });
    });

    // Explosive Morph, Menace and Human Bullet: a rules step's damage (rollVsEach `damage` -> dataset.stepDamage).
    describe("A rules step's own damage (dataset.stepDamage)", () => {
      test("dataset.stepDamage feeds its damage into the checkContext", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
          defenseType: 'evasion',
        });
        dice._rollSkillHelper = jest.fn();
        const targetActor = {
          name: 'Target', uuid: 'Actor.target1',
          system: { defenses: { evasion: { total: 10 } }, immunities: {}, size: 'common' },
          statuses: new Set(), items: [],
        };
        const token = { actor: targetActor, center: { x: 0, y: 0 } };
        const set = new Set([token]);
        set.first = () => token;
        game.user.targets = set;

        await dice.rollSkill(
          { ...dataset, skill: 'science', essence: 'smarts', stepDamage: { value: 2, type: 'fire' } }, makeActor(), null,
        );

        const checkContext = dice._rollSkillHelper.mock.calls[0][4];
        expect(checkContext.damageValue).toBe(2);
        expect(checkContext.damageType).toBe('fire');

        game.user.targets = { first: jest.fn(() => undefined) };
      });

      test("doesn't feed a synthetic damage pipeline without the flag", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
          defenseType: 'evasion',
        });
        dice._rollSkillHelper = jest.fn();
        const targetActor = {
          name: 'Target', uuid: 'Actor.target1',
          system: { defenses: { evasion: { total: 10 } }, immunities: {}, size: 'common' },
          statuses: new Set(), items: [],
        };
        const token = { actor: targetActor, center: { x: 0, y: 0 } };
        const set = new Set([token]);
        set.first = () => token;
        game.user.targets = set;

        await dice.rollSkill({ ...dataset, skill: 'science', essence: 'smarts' }, makeActor(), null);

        const checkContext = dice._rollSkillHelper.mock.calls[0][4];
        expect(checkContext.damageValue).toBe(null);

        game.user.targets = { first: jest.fn(() => undefined) };
      });
    });

    describe("Energy Beam / Lancing Beam (MLP CRB, Elementary Beam spells, p.136)", () => {
      const ENERGY_BEAM_ID = "Compendium.essence20.mlp_crb.Item.tQHr5bWsrkrm1ZHZ";
      const LANCING_BEAM_ID = "Compendium.essence20.mlp_crb.Item.MaHixiXm7JuS1tCq";

      function makeSpellcasterActor() {
        return {
          ...mockActor,
          system: { ...mockActor.system, essenceShifts: { any: { shiftUp: 0, shiftDown: 0 } } },
          getRollData: jest.fn(() => ({ skills: { spellcasting: { modifier: '0', shift: 'd20' } } })),
        };
      }

      function makeTargetsSet() {
        const targetActor = {
          name: 'Target', uuid: 'Actor.target1',
          system: { defenses: { evasion: { total: 10 } }, immunities: {}, size: 'common' },
          statuses: new Set(), items: [],
        };
        const token = { actor: targetActor, center: { x: 0, y: 0 } };
        const set = new Set([token]);
        set.first = () => token;
        return set;
      }

      const EXPLOSIVE_BEAM_ID = "Compendium.essence20.mlp_crb.Item.VLdz7YvUq2AaUFNz";

      const KOC_FIREBALL_ID = "Compendium.essence20.knights_of_canterlot.Item.zlERIywyKQNBQzs6";

      test("Fireball deals 2 Fire damage on a successful cast", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
          defenseType: 'evasion',
        });
        dice._rollSkillHelper = jest.fn();
        game.user.targets = makeTargetsSet();
        const spellItem = { type: 'spell', name: 'Fireball', system: { description: '' }, flags: { core: { sourceId: KOC_FIREBALL_ID } } };

        await dice.rollSkill({ ...dataset, skill: 'spellcasting', essence: 'any' }, makeSpellcasterActor(), spellItem);

        const checkContext = dice._rollSkillHelper.mock.calls[0][4];
        expect(checkContext.damageValue).toBe(2);
        expect(checkContext.damageType).toBe('fire');

        game.user.targets = { first: jest.fn(() => undefined) };
      });

      test.each([['Energy Beam', ENERGY_BEAM_ID], ['Lancing Beam', LANCING_BEAM_ID], ['Explosive Beam', EXPLOSIVE_BEAM_ID]])(
        "%s deals 1 Element damage on a successful cast", async (name, sourceId) => {
          const rollDialog = createMockRollDialog();
          rollDialog.getSkillRollOptions.mockReturnValue({
            canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
            defenseType: 'evasion',
          });
          dice._rollSkillHelper = jest.fn();
          game.user.targets = makeTargetsSet();
          const spellItem = { type: 'spell', name, system: { description: '' }, flags: { core: { sourceId } } };

          await dice.rollSkill({ ...dataset, skill: 'spellcasting', essence: 'any' }, makeSpellcasterActor(), spellItem);

          const checkContext = dice._rollSkillHelper.mock.calls[0][4];
          expect(checkContext.damageValue).toBe(1);
          expect(checkContext.damageType).toBe('element');

          game.user.targets = { first: jest.fn(() => undefined) };
        },
      );

      test("doesn't feed a synthetic damage pipeline for an unrelated spell", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
          defenseType: 'evasion',
        });
        dice._rollSkillHelper = jest.fn();
        game.user.targets = makeTargetsSet();
        const spellItem = { type: 'spell', name: 'Unrelated Spell', system: { description: '' }, flags: { core: { sourceId: 'Compendium.essence20.mlp_crb.Item.unrelated' } } };

        await dice.rollSkill({ ...dataset, skill: 'spellcasting', essence: 'any' }, makeSpellcasterActor(), spellItem);

        const checkContext = dice._rollSkillHelper.mock.calls[0][4];
        expect(checkContext.damageValue).toBe(null);

        game.user.targets = { first: jest.fn(() => undefined) };
      });

      // A spell's own authored system.damageValue/damageType, rather than a per-compendium-id
      // entry in this file - so a homebrew attack spell (or any printed one nobody has hardcoded)
      // can deal damage at all. See spell.mjs's own comment on those fields.
      test("an authored damageValue is used for a spell with no hardcoded entry", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
          defenseType: 'evasion',
        });
        dice._rollSkillHelper = jest.fn();
        game.user.targets = makeTargetsSet();
        const spellItem = {
          type: 'spell',
          name: 'Homebrew Blast',
          system: { description: '', damageValue: 4, damageType: 'fire' },
          flags: { core: { sourceId: 'Compendium.essence20.mlp_crb.Item.homebrew' } },
        };

        await dice.rollSkill({ ...dataset, skill: 'spellcasting', essence: 'any' }, makeSpellcasterActor(), spellItem);

        const checkContext = dice._rollSkillHelper.mock.calls[0][4];
        expect(checkContext.damageValue).toBe(4);
        expect(checkContext.damageType).toBe('fire');

        game.user.targets = { first: jest.fn(() => undefined) };
      });

      test("an authored damageValue takes precedence over the legacy per-id table", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
          defenseType: 'evasion',
        });
        dice._rollSkillHelper = jest.fn();
        game.user.targets = makeTargetsSet();
        // Explosive Beam is hardcoded to 1 Element damage above; authoring a value overrides it,
        // which is how those legacy entries eventually migrate onto the schema.
        const spellItem = {
          type: 'spell',
          name: 'Explosive Beam',
          system: { description: '', damageValue: 3, damageType: 'fire' },
          flags: { core: { sourceId: EXPLOSIVE_BEAM_ID } },
        };

        await dice.rollSkill({ ...dataset, skill: 'spellcasting', essence: 'any' }, makeSpellcasterActor(), spellItem);

        const checkContext = dice._rollSkillHelper.mock.calls[0][4];
        expect(checkContext.damageValue).toBe(3);

        game.user.targets = { first: jest.fn(() => undefined) };
      });

      test("a damageValue of 0 falls through, leaving a non-attack spell undamaging", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
          defenseType: 'evasion',
        });
        dice._rollSkillHelper = jest.fn();
        game.user.targets = makeTargetsSet();
        const spellItem = {
          type: 'spell',
          name: 'Utility Spell',
          system: { description: '', damageValue: 0, damageType: null },
          flags: { core: { sourceId: 'Compendium.essence20.mlp_crb.Item.utility' } },
        };

        await dice.rollSkill({ ...dataset, skill: 'spellcasting', essence: 'any' }, makeSpellcasterActor(), spellItem);

        const checkContext = dice._rollSkillHelper.mock.calls[0][4];
        expect(checkContext.damageValue).toBe(null);

        game.user.targets = { first: jest.fn(() => undefined) };
      });

      // The Roll Options Dialog's Defense dropdown used to be pre-selected only for a
      // weaponEffect; it now keys on the item declaring a Defense at all, so an attack spell
      // pre-selects it the same way.
      test("an attack spell's own defenseType pre-selects the Defense dropdown", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();
        const spellItem = {
          type: 'spell',
          name: 'Homebrew Blast',
          system: { description: '', defenseType: 'evasion' },
          flags: { core: {} },
        };

        await dice.rollSkill({ ...dataset, skill: 'spellcasting', essence: 'any' }, makeSpellcasterActor(), spellItem);

        expect(rollDialog.getSkillRollOptions.mock.calls[0][0].defenseType).toBe('evasion');
      });

      test("a spell with no defenseType still defaults to none", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();
        const spellItem = {
          type: 'spell',
          name: 'Utility Spell',
          system: { description: '', defenseType: null },
          flags: { core: {} },
        };

        await dice.rollSkill({ ...dataset, skill: 'spellcasting', essence: 'any' }, makeSpellcasterActor(), spellItem);

        expect(rollDialog.getSkillRollOptions.mock.calls[0][0].defenseType).toBe('none');
      });
    });

    // Time Traveler's chosen Skill is a SnagImmunity rule on its Perk (rules/plugins/rolls/snag-immunity.mjs).
    describe("SnagImmunity rules (Time Traveler)", () => {
      function makeTimeTravelerActor({ activeSkill = null } = {}) {
        const actor = {
          ...mockActor,
          items: activeSkill ? [{ id: 'timeTraveler', type: 'perk', flags: {}, system: { rules: [{ type: 'SnagImmunity', when: [`skill:${activeSkill}`] }] } }] : [],
          getRollData: jest.fn(() => ({
            skills: {
              technology: { modifier: '0', shift: 'd8' }, culture: { modifier: '0', shift: 'd8' },
            },
          })),
        };
        // The spread copies mockActor's cached rules index (a Symbol key) along with everything else - drop it.
        for (const key of Object.getOwnPropertySymbols(actor)) {
          delete actor[key];
        }

        return actor;
      }

      test("forces off a Snag on the actively-immune skill, regardless of the dialog's own choice", async () => {
        const rollDialog = createMockRollDialog();
        const returnedOptions = { canCritD2: false, edge: false, snag: true, shiftUp: 0, shiftDown: 0, timesToRoll: 1 };
        rollDialog.getSkillRollOptions.mockReturnValue(returnedOptions);
        dice._rollSkillHelper = jest.fn();

        await dice.rollSkill(
          { ...dataset, skill: 'technology', essence: 'smarts' }, makeTimeTravelerActor({ activeSkill: 'technology' }), null,
        );

        expect(returnedOptions.snag).toBe(false);
      });

      test("doesn't affect a different skill, or without the toggle active", async () => {
        const rollDialog = createMockRollDialog();
        const returnedOptions = { canCritD2: false, edge: false, snag: true, shiftUp: 0, shiftDown: 0, timesToRoll: 1 };
        rollDialog.getSkillRollOptions.mockReturnValue(returnedOptions);
        dice._rollSkillHelper = jest.fn();

        await dice.rollSkill(
          { ...dataset, skill: 'culture', essence: 'smarts' }, makeTimeTravelerActor({ activeSkill: 'technology' }), null,
        );
        expect(returnedOptions.snag).toBe(true);

        const otherOptions = { canCritD2: false, edge: false, snag: true, shiftUp: 0, shiftDown: 0, timesToRoll: 1 };
        rollDialog.getSkillRollOptions.mockReturnValue(otherOptions);
        await dice.rollSkill(
          { ...dataset, skill: 'technology', essence: 'smarts' }, makeTimeTravelerActor({ activeSkill: null }), null,
        );
        expect(otherOptions.snag).toBe(true);
      });
    });

    describe("Lend Assistance (general action, GI Joe CRB p.197) - skill-half consumption", () => {
      function makeActor({ pending = null } = {}) {
        const flags = pending ? { pendingLendAssistanceShift: pending } : {};
        return {
          ...mockActor,
          items: [],
          system: {
            ...mockActor.system,
            essenceShifts: {
              any: { shiftUp: 0, shiftDown: 0 },
              strength: { shiftUp: 0, shiftDown: 0 },
              speed: { shiftUp: 0, shiftDown: 0 },
              smarts: { shiftUp: 0, shiftDown: 0 },
              social: { shiftUp: 0, shiftDown: 0 },
            },
          },
          getFlag: jest.fn((scope, key) => flags[key]),
          unsetFlag: jest.fn(async (scope, key) => {
            delete flags[key];
          }),
          getRollData: jest.fn(() => ({ skills: { athletics: { modifier: '0', shift: 'd8' } } })),
        };
      }

      test("adds a +1 shiftUp on the assisted skill and clears the bank", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();
        const actor = makeActor({ pending: { skill: 'athletics' } });

        await dice.rollSkill({ ...dataset, skill: 'athletics', essence: 'strength', shift: 'd8' }, actor, null);

        expect(rollDialog.getSkillRollOptions.mock.calls[0][0].shiftUp).toBe(1);
        expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'pendingLendAssistanceShift');
      });

      test("Bureaucrat's banked Edge is applied alongside the upshift", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();
        const actor = makeActor({ pending: { skill: 'athletics', edge: true } });

        await dice.rollSkill({ ...dataset, skill: 'athletics', essence: 'strength', shift: 'd8' }, actor, null);

        expect(rollDialog.getSkillRollOptions.mock.calls[0][0].shiftUp).toBe(1);
        expect(rollDialog.getSkillRollOptions.mock.calls[0][1].edge).toBe(true);
      });

      test("a banked upshift of 2 (Putting Others Before Yourself) applies in full", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();
        const actor = makeActor({ pending: { skill: 'athletics', shiftUp: 2 } });

        await dice.rollSkill({ ...dataset, skill: 'athletics', essence: 'strength', shift: 'd8' }, actor, null);

        expect(rollDialog.getSkillRollOptions.mock.calls[0][0].shiftUp).toBe(2);
      });

      test("a flag banked without a shiftUp field still applies the default 1", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();
        const actor = makeActor({ pending: { skill: 'athletics' } });

        await dice.rollSkill({ ...dataset, skill: 'athletics', essence: 'strength', shift: 'd8' }, actor, null);

        expect(rollDialog.getSkillRollOptions.mock.calls[0][0].shiftUp).toBe(1);
      });

      test("an ordinary assist (no Bureaucrat) grants no Edge", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();
        const actor = makeActor({ pending: { skill: 'athletics', edge: false } });

        await dice.rollSkill({ ...dataset, skill: 'athletics', essence: 'strength', shift: 'd8' }, actor, null);

        expect(rollDialog.getSkillRollOptions.mock.calls[0][0].shiftUp).toBe(1);
        expect(rollDialog.getSkillRollOptions.mock.calls[0][1].edge).toBe(false);
      });

      test("Those Who Know, Teach's persistent grant is NOT cleared after it applies", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();
        const actor = makeActor({ pending: { skill: 'athletics', persistent: true } });

        await dice.rollSkill({ ...dataset, skill: 'athletics', essence: 'strength', shift: 'd8' }, actor, null);

        expect(rollDialog.getSkillRollOptions.mock.calls[0][0].shiftUp).toBe(1);
        expect(actor.unsetFlag).not.toHaveBeenCalledWith('essence20', 'pendingLendAssistanceShift');
      });

      test("an ordinary (non-persistent) grant is still cleared as usual", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();
        const actor = makeActor({ pending: { skill: 'athletics', persistent: false } });

        await dice.rollSkill({ ...dataset, skill: 'athletics', essence: 'strength', shift: 'd8' }, actor, null);

        expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'pendingLendAssistanceShift');
      });

      test("doesn't apply to a different skill, or with nothing banked", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();

        const wrongSkillActor = makeActor({ pending: { skill: 'culture' } });
        await dice.rollSkill({ ...dataset, skill: 'athletics', essence: 'strength', shift: 'd8' }, wrongSkillActor, null);
        expect(rollDialog.getSkillRollOptions.mock.calls[0][0].shiftUp).toBe(0);

        const noBankActor = makeActor();
        await dice.rollSkill({ ...dataset, skill: 'athletics', essence: 'strength', shift: 'd8' }, noBankActor, null);
        expect(rollDialog.getSkillRollOptions.mock.calls[1][0].shiftUp).toBe(0);
      });
    });

    describe("Prototype / Theoretical Kits (Quartermaster's Guide p.41)", () => {
      function makeKitActor(tier) {
        const kit = {
          id: 'kit1', type: 'gear', name: `${tier} Kit`, system: { gearType: 'kits' },
          flags: { essence20: { kit: { tier, skill: 'athletics', spec: null } } },
        };
        return {
          ...mockActor,
          items: [kit],
          getRollData: jest.fn(() => ({ skills: { athletics: { modifier: '0', shift: 'd12' } } })),
        };
      }

      const specialized = { ...dataset, shift: 'd12', isSpecialized: true };

      test("a Prototype Kit's Edge ignores a Snag, but doesn't limit downshifts", async () => {
        const rollDialog = createMockRollDialog();
        const options = { canCritD2: false, edge: true, snag: true, shiftUp: 0, shiftDown: 3, timesToRoll: 1 };
        rollDialog.getSkillRollOptions.mockReturnValue(options);
        dice._rollSkillHelper = jest.fn();

        await dice.rollSkill(specialized, makeKitActor('prototype'), null);

        expect(rollDialog.getSkillRollOptions.mock.calls[0][1]).toMatchObject({ edge: true, snag: false });
        expect(options.snag).toBe(false);
        expect(options.shiftDown).toBe(3);
      });

      test("a Theoretical Kit also caps downshifts at one step", async () => {
        const rollDialog = createMockRollDialog();
        const options = { canCritD2: false, edge: false, snag: true, shiftUp: 0, shiftDown: 3, timesToRoll: 1 };
        rollDialog.getSkillRollOptions.mockReturnValue(options);
        dice._rollSkillHelper = jest.fn();

        await dice.rollSkill(specialized, makeKitActor('theoretical'), null);

        // The player chose Normal in the dialog, so there's no kit Edge to protect.
        expect(options.snag).toBe(true);
        expect(options.shiftDown).toBe(1);
      });

      test("a Restricted Kit does neither", async () => {
        const rollDialog = createMockRollDialog();
        const options = { canCritD2: false, edge: true, snag: true, shiftUp: 0, shiftDown: 3, timesToRoll: 1 };
        rollDialog.getSkillRollOptions.mockReturnValue(options);
        dice._rollSkillHelper = jest.fn();

        await dice.rollSkill(specialized, makeKitActor('restricted'), null);

        expect(options.snag).toBe(true);
        expect(options.shiftDown).toBe(3);
      });
    });

    describe("Armor Piercing (Weapon Effects and Traits, p.106) - weaponEffect-level hasArmorPiercing", () => {
      const targetingDataset = { ...dataset, skill: 'targeting', essence: 'speed', defenseType: 'toughness' };

      function makeTargetsSet(targetActor) {
        const token = { actor: targetActor, center: { x: 0, y: 0 } };
        const set = new Set([token]);
        set.first = () => token;

        return set;
      }

      function makeShooterActor() {
        const items = [];
        items.get = jest.fn(() => null);

        return { ...mockActor, items, getRollData: jest.fn(() => ({ skills: { targeting: { modifier: '0', shift: 'd20' } } })) };
      }

      let originalTargets;
      beforeEach(() => {
        originalTargets = game.user.targets;
      });
      afterEach(() => {
        game.user.targets = originalTargets;
      });

      test("ignores the target's own armor bonus to Toughness when the weaponEffect has it", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'toughness',
        });
        dice._rollSkillHelper = jest.fn();
        const targetActor = {
          name: 'Target', uuid: 'Actor.target1',
          system: { defenses: { toughness: { total: 20, armor: 5 } }, immunities: {}, size: 'common' },
          statuses: new Set(), items: [],
        };
        game.user.targets = makeTargetsSet(targetActor);
        const piercingWeaponEffect = {
          type: 'weaponEffect', flags: {},
          system: { classification: { skill: 'targeting', style: 'ranged' }, damageType: 'sharp', damageValue: 3, hasArmorPiercing: true },
        };

        await dice.rollSkill(targetingDataset, makeShooterActor(), piercingWeaponEffect);

        const checkContext = dice._rollSkillHelper.mock.calls[0][4];
        expect(checkContext.entries[0].difficulty).toBe(15); // 20 total - 5 armor
      });

      test("doesn't apply without hasArmorPiercing set", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'toughness',
        });
        dice._rollSkillHelper = jest.fn();
        const targetActor = {
          name: 'Target', uuid: 'Actor.target1',
          system: { defenses: { toughness: { total: 20, armor: 5 } }, immunities: {}, size: 'common' },
          statuses: new Set(), items: [],
        };
        game.user.targets = makeTargetsSet(targetActor);
        const plainWeaponEffect = {
          type: 'weaponEffect', flags: {},
          system: { classification: { skill: 'targeting', style: 'ranged' }, damageType: 'sharp', damageValue: 3 },
        };

        await dice.rollSkill(targetingDataset, makeShooterActor(), plainWeaponEffect);

        const checkContext = dice._rollSkillHelper.mock.calls[0][4];
        expect(checkContext.entries[0].difficulty).toBe(20); // unaffected
      });

      test("doesn't apply against a different Defense (RAW: Toughness's own armor bonus only)", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'evasion',
        });
        dice._rollSkillHelper = jest.fn();
        const targetActor = {
          name: 'Target', uuid: 'Actor.target1',
          system: { defenses: { evasion: { total: 20, armor: 5 } }, immunities: {}, size: 'common' },
          statuses: new Set(), items: [],
        };
        game.user.targets = makeTargetsSet(targetActor);
        const piercingWeaponEffect = {
          type: 'weaponEffect', flags: {},
          system: { classification: { skill: 'targeting', style: 'ranged' }, damageType: 'sharp', damageValue: 3, hasArmorPiercing: true },
        };

        await dice.rollSkill({ ...targetingDataset, defenseType: 'evasion' }, makeShooterActor(), piercingWeaponEffect);

        const checkContext = dice._rollSkillHelper.mock.calls[0][4];
        expect(checkContext.entries[0].difficulty).toBe(20); // unaffected
      });
    });

    describe("an AttackChoice pick (Bring It All Down) - armorPiercing", () => {
      const targetingDataset = { ...dataset, skill: 'targeting', essence: 'speed', defenseType: 'toughness', attackChoiceArmorPiercing: true };

      function makeTargetsSet(targetActor) {
        const token = { actor: targetActor, center: { x: 0, y: 0 } };
        const set = new Set([token]);
        set.first = () => token;

        return set;
      }

      function makeShooterActor() {
        const items = [];
        items.get = jest.fn(() => null);

        return { ...mockActor, items, getRollData: jest.fn(() => ({ skills: { targeting: { modifier: '0', shift: 'd20' } } })) };
      }

      let originalTargets;
      beforeEach(() => {
        originalTargets = game.user.targets;
      });
      afterEach(() => {
        game.user.targets = originalTargets;
      });

      test("ignores the target's own armor bonus to Toughness when 'armorPiercing' was chosen", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'toughness',
        });
        dice._rollSkillHelper = jest.fn();
        const targetActor = {
          name: 'Target', uuid: 'Actor.target1',
          system: { defenses: { toughness: { total: 20, armor: 5 } }, immunities: {}, size: 'common' },
          statuses: new Set(), items: [],
        };
        game.user.targets = makeTargetsSet(targetActor);
        const explosiveWeaponEffect = {
          type: 'weaponEffect', flags: {},
          system: { classification: { skill: 'targeting', style: 'explosive' }, damageType: 'sharp', damageValue: 3 },
        };

        await dice.rollSkill(targetingDataset, makeShooterActor(), explosiveWeaponEffect);

        const checkContext = dice._rollSkillHelper.mock.calls[0][4];
        expect(checkContext.entries[0].difficulty).toBe(15); // 20 total - 5 armor
      });

      test("doesn't apply when a different option was chosen", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'toughness',
        });
        dice._rollSkillHelper = jest.fn();
        const targetActor = {
          name: 'Target', uuid: 'Actor.target1',
          system: { defenses: { toughness: { total: 20, armor: 5 } }, immunities: {}, size: 'common' },
          statuses: new Set(), items: [],
        };
        game.user.targets = makeTargetsSet(targetActor);
        const explosiveWeaponEffect = {
          type: 'weaponEffect', flags: {},
          system: { classification: { skill: 'targeting', style: 'explosive' }, damageType: 'sharp', damageValue: 3 },
        };

        await dice.rollSkill({ ...targetingDataset, attackChoiceArmorPiercing: false, attackChoiceDamage: 2 }, makeShooterActor(), explosiveWeaponEffect);

        const checkContext = dice._rollSkillHelper.mock.calls[0][4];
        expect(checkContext.entries[0].difficulty).toBe(20); // unaffected
      });
    });

    describe("an AttackChoice pick (Bring It All Down) - shiftUp and damage", () => {
      const explosiveWeaponEffect = {
        type: 'weaponEffect', flags: {},
        system: { classification: { skill: 'technology', style: 'explosive' }, damageType: 'fire', damageValue: 3 },
      };

      function makeAttackerActor() {
        const items = [];
        items.get = jest.fn(() => null);

        return { ...mockActor, items, getRollData: jest.fn(() => ({ skills: { technology: { modifier: '0', shift: 'd20' } } })) };
      }

      test("'shiftUp' adds ↑2 to the shift dataset", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();

        await dice.rollSkill(
          { ...dataset, skill: 'technology', essence: 'smarts', attackChoiceShiftUp: 2 },
          makeAttackerActor(), explosiveWeaponEffect,
        );

        expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(
          expect.objectContaining({ shiftUp: 2 }), expect.anything(), expect.anything(),
        );
      });

      function makeTargetsSet() {
        const targetActor = {
          name: 'Target', uuid: 'Actor.target1',
          system: { defenses: { toughness: { total: 10, armor: 0 } }, immunities: {}, size: 'common' },
          statuses: new Set(), items: [],
        };
        const token = { actor: targetActor, center: { x: 0, y: 0 } };
        const set = new Set([token]);
        set.first = () => token;

        return set;
      }

      let originalTargets;
      beforeEach(() => {
        originalTargets = game.user.targets;
      });
      afterEach(() => {
        game.user.targets = originalTargets;
      });

      test("'damage' adds +2 to damageBonusValue", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'toughness',
        });
        dice._rollSkillHelper = jest.fn();
        game.user.targets = makeTargetsSet();

        await dice.rollSkill(
          { ...dataset, skill: 'technology', essence: 'smarts', defenseType: 'toughness', attackChoiceDamage: 2 },
          makeAttackerActor(), explosiveWeaponEffect,
        );

        const checkContext = dice._rollSkillHelper.mock.calls[0][4];
        expect(checkContext.damageBonusValue).toBe(2);
      });

      test("neither applies with no chosen effect", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'toughness',
        });
        dice._rollSkillHelper = jest.fn();
        game.user.targets = makeTargetsSet();

        await dice.rollSkill(
          { ...dataset, skill: 'technology', essence: 'smarts', defenseType: 'toughness' },
          makeAttackerActor(), explosiveWeaponEffect,
        );

        expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(
          expect.objectContaining({ shiftUp: 0 }), expect.anything(), expect.anything(),
        );
        const checkContext = dice._rollSkillHelper.mock.calls[0][4];
        expect(checkContext.damageBonusValue).toBe(0);
      });
    });

    describe("Stronger Together (Strategist Focus, 20th level, p.68)", () => {
      const targetingDataset = { ...dataset, skill: 'targeting', essence: 'speed', defenseType: 'toughness' };
      const rangedWeaponEffect = {
        type: 'weaponEffect', flags: {},
        system: { classification: { skill: 'targeting', style: 'ranged' }, damageType: 'ballistic', damageValue: 3 },
      };

      function makeAttackerActor() {
        const items = [];
        items.get = jest.fn(() => null);

        return { ...mockActor, items, getRollData: jest.fn(() => ({ skills: { targeting: { modifier: '0', shift: 'd20' } } })) };
      }

      // The per-ally bonus is a Defense rule on the Perk now (rules/conversions.test.js); this checks the
      // banked self-reduction its Use leaves behind.
      function makeTargetActor() {
        const token = { document: { disposition: -1 }, center: { x: 0, y: 0 } };

        return {
          name: 'Target', uuid: 'Actor.target1',
          system: { defenses: { toughness: { total: 10 } }, immunities: {}, size: 'common' },
          statuses: new Set(), items: [],
          getActiveTokens: jest.fn(() => [token]),
        };
      }

      function makeTargetsSet(targetActor) {
        const token = { actor: targetActor, center: { x: 0, y: 0 } };
        const set = new Set([token]);
        set.first = () => token;

        return set;
      }

      let originalTargets;
      beforeEach(() => {
        originalTargets = game.user.targets;
        canvas.tokens.placeables = [];
        canvas.grid.measurePath.mockReturnValue({ distance: 0 });
      });
      afterEach(() => {
        game.user.targets = originalTargets;
        canvas.tokens.placeables = [];
      });

      test("subtracts a banked -1 self-reduction from the Free-action ally transfer", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'toughness',
        });
        dice._rollSkillHelper = jest.fn();
        const targetActor = makeTargetActor();
        targetActor.flags = { essence20: { ruleBank: [{ id: 'b1', label: 'Stronger Together', defense: 'any', defenseBonus: -1, persist: false, when: [], uses: 1 }] } };
        targetActor.update = jest.fn();
        canvas.tokens.placeables = [targetActor.getActiveTokens()[0]];
        game.user.targets = makeTargetsSet(targetActor);

        await dice.rollSkill(targetingDataset, makeAttackerActor(), rangedWeaponEffect);

        const checkContext = dice._rollSkillHelper.mock.calls[0][4];
        expect(checkContext.entries[0].difficulty).toBe(9); // 10 base - 1 banked reduction
        expect(targetActor.update).toHaveBeenCalledWith({ 'flags.essence20.ruleBank': [] });
      });
    });
  });

  describe("Damage Types (core combat rules, not Perk-gated)", () => {
    // A fresh, isolated essenceShifts rather than the shared mockActor.system reference - see the
    // identical comment on Reckless Abandon/Silent Weapon Expertise's own makeActor() above (an
    // earlier test in this file mutates mockActor.system.essenceShifts in place without resetting
    // it, which would otherwise silently pollute this describe's own exact shiftUp assertions).
    function makeActor() {
      return {
        ...mockActor,
        items: [],
        system: {
          ...mockActor.system,
          essenceShifts: {
            any: { shiftUp: 0, shiftDown: 0 },
            strength: { shiftUp: 0, shiftDown: 0 },
            speed: { shiftUp: 0, shiftDown: 0 },
            smarts: { shiftUp: 0, shiftDown: 0 },
            social: { shiftUp: 0, shiftDown: 0 },
          },
        },
        getRollData: jest.fn(() => ({
          skills: {
            might: { modifier: '0', shift: 'd20' },
            targeting: { modifier: '0', shift: 'd20' },
            athletics: { modifier: '0', shift: 'd20' },
          },
        })),
      };
    }

    describe("Electric - unconditional upshift on attacks", () => {
      const electricWeaponEffect = {
        type: 'weaponEffect', flags: {},
        system: { classification: { skill: 'might', style: 'melee' }, damageType: 'electric', damageValue: 1 },
      };

      test("upshifts an attack made with an Electric weapon", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();

        await dice.rollSkill({ ...dataset, skill: 'might', essence: 'strength' }, makeActor(), electricWeaponEffect);

        expect(rollDialog.getSkillRollOptions.mock.calls[0][0].shiftUp).toBe(1);
      });

      test("doesn't apply to a non-Electric attack, or a non-attack roll", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();
        const bluntWeaponEffect = { ...electricWeaponEffect, system: { ...electricWeaponEffect.system, damageType: 'blunt' } };

        await dice.rollSkill({ ...dataset, skill: 'might', essence: 'strength' }, makeActor(), bluntWeaponEffect);
        expect(rollDialog.getSkillRollOptions.mock.calls[0][0].shiftUp).toBe(0);

        await dice.rollSkill({ ...dataset, skill: 'might', essence: 'strength' }, makeActor(), null);
        expect(rollDialog.getSkillRollOptions.mock.calls[1][0].shiftUp).toBe(0);
      });

      test("also upshifts when the weapon only has the Electric trait via an upgrade (Tasing/Voltage Tank, PR CRB p.117-118)", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();
        const bluntWeaponEffect = {
          ...electricWeaponEffect,
          flags: { essence20: { parentId: 'weapon1' } },
          system: { ...electricWeaponEffect.system, damageType: 'blunt' },
        };
        const actor = makeActor();
        actor.items = [];
        actor.items.get = jest.fn(id => (
          id == 'weapon1' ? { system: { itemAndUpgradeTraits: ['electric'] } } : null
        ));

        await dice.rollSkill({ ...dataset, skill: 'might', essence: 'strength' }, actor, bluntWeaponEffect);

        expect(rollDialog.getSkillRollOptions.mock.calls[0][0].shiftUp).toBe(1);
      });
    });

    describe("Acid / Fire - +1 damage against the Defense each specifically calls out", () => {
      const acidWeaponEffect = {
        type: 'weaponEffect', flags: {},
        system: { classification: { skill: 'might', style: 'melee' }, damageType: 'acid', damageValue: 3 },
      };
      const fireWeaponEffect = {
        ...acidWeaponEffect, system: { ...acidWeaponEffect.system, damageType: 'fire' },
      };
      const meleeDataset = { ...dataset, skill: 'might', essence: 'strength', dif: '10' };

      test("Acid adds 1 damage when the attack is rolled against Toughness", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
          defenseType: 'toughness',
        });
        dice._rollSkillHelper = jest.fn();

        await dice.rollSkill(meleeDataset, makeActor(), acidWeaponEffect);

        const checkContext = dice._rollSkillHelper.mock.calls[0][4];
        expect(checkContext.damageBonusValue).toBe(1);
        expect(checkContext.damageBonusSources).toContain('E20.DamageAcid');
      });

      test("Acid doesn't add damage against a different Defense", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
          defenseType: 'evasion',
        });
        dice._rollSkillHelper = jest.fn();

        await dice.rollSkill(meleeDataset, makeActor(), acidWeaponEffect);

        const checkContext = dice._rollSkillHelper.mock.calls[0][4];
        expect(checkContext.damageBonusValue).toBe(0);
      });

      test("Fire adds 1 damage when the attack is rolled against Evasion", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
          defenseType: 'evasion',
        });
        dice._rollSkillHelper = jest.fn();

        await dice.rollSkill(meleeDataset, makeActor(), fireWeaponEffect);

        const checkContext = dice._rollSkillHelper.mock.calls[0][4];
        expect(checkContext.damageBonusValue).toBe(1);
        expect(checkContext.damageBonusSources).toContain('E20.DamageFire');
      });

      test("Fire doesn't add damage against a different Defense", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
          defenseType: 'toughness',
        });
        dice._rollSkillHelper = jest.fn();

        await dice.rollSkill(meleeDataset, makeActor(), fireWeaponEffect);

        const checkContext = dice._rollSkillHelper.mock.calls[0][4];
        expect(checkContext.damageBonusValue).toBe(0);
      });

      test("doesn't apply to an unrelated damage type against either Defense", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
          defenseType: 'toughness',
        });
        dice._rollSkillHelper = jest.fn();
        const sharpWeaponEffect = { ...acidWeaponEffect, system: { ...acidWeaponEffect.system, damageType: 'sharp' } };

        await dice.rollSkill(meleeDataset, makeActor(), sharpWeaponEffect);

        const checkContext = dice._rollSkillHelper.mock.calls[0][4];
        expect(checkContext.damageBonusValue).toBe(0);
      });

      test("Acid still adds 1 damage when the trait only comes from an upgrade (Corrosive Tip, PR CRB p.116)", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
          defenseType: 'toughness',
        });
        dice._rollSkillHelper = jest.fn();
        const upgradedWeaponEffect = {
          ...acidWeaponEffect,
          flags: { essence20: { parentId: 'weapon1' } },
          system: { ...acidWeaponEffect.system, damageType: 'blunt' },
        };
        const actor = makeActor();
        actor.items = [];
        actor.items.get = jest.fn(id => (
          id == 'weapon1' ? { system: { itemAndUpgradeTraits: ['acid'] } } : null
        ));

        await dice.rollSkill(meleeDataset, actor, upgradedWeaponEffect);

        const checkContext = dice._rollSkillHelper.mock.calls[0][4];
        expect(checkContext.damageBonusValue).toBe(1);
        expect(checkContext.damageBonusSources).toContain('E20.DamageAcid');
      });

      test("Fire still adds 1 damage when the trait only comes from an upgrade (Blazing/Ignition Tank, PR CRB p.116/118)", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
          defenseType: 'evasion',
        });
        dice._rollSkillHelper = jest.fn();
        const upgradedWeaponEffect = {
          ...fireWeaponEffect,
          flags: { essence20: { parentId: 'weapon1' } },
          system: { ...fireWeaponEffect.system, damageType: 'blunt' },
        };
        const actor = makeActor();
        actor.items = [];
        actor.items.get = jest.fn(id => (
          id == 'weapon1' ? { system: { itemAndUpgradeTraits: ['fire'] } } : null
        ));

        await dice.rollSkill(meleeDataset, actor, upgradedWeaponEffect);

        const checkContext = dice._rollSkillHelper.mock.calls[0][4];
        expect(checkContext.damageBonusValue).toBe(1);
        expect(checkContext.damageBonusSources).toContain('E20.DamageFire');
      });
    });

    describe("Spot - flags isSpotAttempt on a weaponEffect using the Spot damage type", () => {
      const spotWeaponEffect = {
        type: 'weaponEffect', flags: {},
        system: { classification: { skill: 'targeting', style: 'ranged' }, damageType: 'spot', damageValue: 0 },
      };

      test("flags isSpotAttempt on a Spot-damageType weaponEffect", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, dif: '10',
        });
        dice._rollSkillHelper = jest.fn();

        await dice.rollSkill({ ...dataset, skill: 'targeting', essence: 'speed', dif: '10' }, makeActor(), spotWeaponEffect);

        expect(dice._rollSkillHelper.mock.calls[0][4].isSpotAttempt).toBe(true);
      });

      test("doesn't flag a normal attack, or a non-attack roll", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, dif: '10',
        });
        dice._rollSkillHelper = jest.fn();
        const laserWeaponEffect = { ...spotWeaponEffect, system: { ...spotWeaponEffect.system, damageType: 'laser' } };

        await dice.rollSkill({ ...dataset, skill: 'targeting', essence: 'speed', dif: '10' }, makeActor(), laserWeaponEffect);
        expect(dice._rollSkillHelper.mock.calls[0][4].isSpotAttempt).toBe(false);

        await dice.rollSkill({ ...dataset, dif: '10' }, makeActor(), null);
        expect(dice._rollSkillHelper.mock.calls[1][4].isSpotAttempt).toBe(false);
      });
    });
  });

  describe("My Little Pony Roles", () => {
    function makeActor({ perkIds = [], choice = null } = {}) {
      const items = perkIds.map(perkId => ({
        type: 'perk', flags: { core: { sourceId: perkId } }, system: { choice },
      }));
      items.get = jest.fn(() => null);

      return {
        ...mockActor,
        items,
        system: {
          ...mockActor.system,
          essenceShifts: {
            any: { shiftUp: 0, shiftDown: 0 },
            strength: { shiftUp: 0, shiftDown: 0 },
            speed: { shiftUp: 0, shiftDown: 0 },
            smarts: { shiftUp: 0, shiftDown: 0 },
            social: { shiftUp: 0, shiftDown: 0 },
          },
        },
        getRollData: jest.fn(() => ({
          skills: {
            persuasion: { modifier: '0', shift: 'd20' },
            wealth: { modifier: '0', shift: 'd20' },
            alertness: { modifier: '0', shift: 'd20' },
            deception: { modifier: '0', shift: 'd20' },
            intimidation: { modifier: '0', shift: 'd6' },
            brawn: { modifier: '0', shift: 'd6' },
            technology: { modifier: '0', shift: 'd6' },
            infiltration: { modifier: '0', shift: 'd20' },
            science: { modifier: '0', shift: 'd20' },
          },
        })),
      };
    }

    // Magically Fit In given by Friendship Is Mystical is a rule on that Perk (rules/conv15-items2.test.js).

    describe("Surgical Operators (Ferocious Fighters, Anti-Venom Task Force Faction Perk, p.72)", () => {
      const SURGICAL_OPERATORS_ID = "Compendium.essence20.ferocious_fighters.Item.JtRCN6ppDatZVmav";

      test("no longer preselects Edge on every Science test (it's a dialog switch now, fix3-gij)", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();
        const actor = makeActor({ perkIds: [SURGICAL_OPERATORS_ID] });

        await dice.rollSkill({ ...dataset, skill: 'science', essence: 'smarts' }, actor, null);

        expect(rollDialog.getSkillRollOptions.mock.calls[0][1].edge).toBe(false);
      });

      test("doesn't apply without the Perk, or on an unrelated skill", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();

        await dice.rollSkill({ ...dataset, skill: 'science', essence: 'smarts' }, makeActor(), null);
        expect(rollDialog.getSkillRollOptions.mock.calls[0][1].edge).toBe(false);

        const actor = makeActor({ perkIds: [SURGICAL_OPERATORS_ID] });
        await dice.rollSkill({ ...dataset, skill: 'wealth', essence: 'smarts' }, actor, null);
        expect(rollDialog.getSkillRollOptions.mock.calls[1][1].edge).toBe(false);
      });
    });

    describe("Indoctrinated / Unscrupulous Influences (Cobra Codex, p.31/36)", () => {
      const INDOCTRINATED_ID = "Compendium.essence20.cobra_codex.Item.BctKHzpCC1XXoJPg";
      const UNSCRUPULOUS_ID = "Compendium.essence20.cobra_codex.Item.QJ1Uw4VZxy3zrxa1";

      // DIRECTION CORRECTED 2026-09-15. Two tests here previously asserted that Indoctrinated
      // Snagged its own HOLDER's Intimidation/Persuasion rolls. That inverts RAW ("any attempt to
      // change YOUR mind... suffers Snag" - the Snag lands on whoever is trying to sway the
      // holder), and it also made the Influence/Hang-Up pairing nonsensical: the Perk penalized its
      // own holder while the Hang-Up handed opponents an Edge, so the holder got two penalties and
      // no benefit. The corrected reciprocal behavior is covered by the "Indoctrinated (Cobra
      // Codex, Influence Perk, p.31) - reciprocal Snag" describe block under
      // _getAutomaticCombatModifiers instead. The one assertion worth keeping from the old pair is
      // the negative: the holder's OWN social rolls must no longer be Snagged.
      test("does NOT Snag the holder's own Intimidation or Persuasion rolls", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();
        const actor = makeActor({ perkIds: [INDOCTRINATED_ID] });

        await dice.rollSkill({ ...dataset, skill: 'intimidation', essence: 'strength' }, actor, null);
        expect(rollDialog.getSkillRollOptions.mock.calls[0][1].snag).toBe(false);

        await dice.rollSkill({ ...dataset, skill: 'persuasion', essence: 'social' }, actor, null);
        expect(rollDialog.getSkillRollOptions.mock.calls[1][1].snag).toBe(false);
      });

      // DIRECTION CORRECTED 2026-09-15, same bug as Indoctrinated above. This previously asserted
      // that Unscrupulous Snagged its own HOLDER's Deception/Intimidation/Persuasion rolls. RAW's
      // PERK is "pleas that appeal to your moral core fall on deaf ears" - attempts made ON the
      // holder - so its Snag is reciprocal, covered by the "Unscrupulous ... reciprocal Snag"
      // describe block under _getAutomaticCombatModifiers. The self-side Snag belongs to the
      // separate HANG-UP, which is gated on "if the target is particularly empathetic or ethical"
      // and stays unbuilt (nothing tracks such a trait, and auto-applying a narrative-gated PENALTY
      // would make the holder strictly worse than RAW says).
      test("does NOT Snag the holder's own Deception, Intimidation, or Persuasion rolls", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();
        const actor = makeActor({ perkIds: [UNSCRUPULOUS_ID] });

        for (const [i, [skill, essence]] of [
          ['deception', 'social'], ['intimidation', 'strength'], ['persuasion', 'social'],
        ].entries()) {
          await dice.rollSkill({ ...dataset, skill, essence }, actor, null);
          expect(rollDialog.getSkillRollOptions.mock.calls[i][1].snag).toBe(false);
        }
      });

      test("Unscrupulous doesn't apply without the Perk, or on an unrelated skill", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();

        const actor = makeActor({ perkIds: [UNSCRUPULOUS_ID] });
        await dice.rollSkill({ ...dataset, skill: 'wealth', essence: 'smarts' }, actor, null);
        expect(rollDialog.getSkillRollOptions.mock.calls[0][1].snag).toBe(false);

        await dice.rollSkill({ ...dataset, skill: 'deception', essence: 'social' }, makeActor(), null);
        expect(rollDialog.getSkillRollOptions.mock.calls[1][1].snag).toBe(false);
      });
    });

    describe("Enhance Skill / Xenotech / Regal (Across the Stars, Armor Traits, p.82-85) - core armor traits, not Perks", () => {
      function makeArmorActor({ armorItems = [] } = {}) {
        const items = [];
        items.get = jest.fn(() => null);
        items.documentsByType = { armor: armorItems };

        return {
          ...mockActor,
          items,
          system: {
            ...mockActor.system,
            essenceShifts: {
              any: { shiftUp: 0, shiftDown: 0 },
              strength: { shiftUp: 0, shiftDown: 0 },
              speed: { shiftUp: 0, shiftDown: 0 },
              smarts: { shiftUp: 0, shiftDown: 0 },
              social: { shiftUp: 0, shiftDown: 0 },
            },
          },
          getRollData: jest.fn(() => ({
            skills: {
              athletics: { modifier: '0', shift: 'd20' },
              acrobatics: { modifier: '0', shift: 'd20' },
              persuasion: { modifier: '0', shift: 'd20' },
              intimidation: { modifier: '0', shift: 'd20' },
              technology: { modifier: '0', shift: 'd20' },
            },
          })),
        };
      }

      async function shiftFor(skill, essence, actor) {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();

        await dice.rollSkill({ ...dataset, skill, essence }, actor, null);

        return rollDialog.getSkillRollOptions.mock.calls[0][0];
      }

      test("Enhance Skill upshifts the configured Skill by 1", async () => {
        const actor = makeArmorActor({
          armorItems: [{ system: { equipped: true, traits: ['enhanceSkill'], enhanceSkillTarget: 'technology' } }],
        });
        const options = await shiftFor('technology', 'smarts', actor);
        expect(options.shiftUp).toBe(1);
      });

      test("Enhance Skill doesn't apply to an unconfigured Skill, or while unequipped", async () => {
        const actor = makeArmorActor({
          armorItems: [{ system: { equipped: false, traits: ['enhanceSkill'], enhanceSkillTarget: 'technology' } }],
        });
        expect((await shiftFor('technology', 'smarts', actor)).shiftUp).toBe(0);

        const wrongSkillActor = makeArmorActor({
          armorItems: [{ system: { equipped: true, traits: ['enhanceSkill'], enhanceSkillTarget: 'persuasion' } }],
        });
        expect((await shiftFor('technology', 'smarts', wrongSkillActor)).shiftUp).toBe(0);
      });

      test("Enhance Skill doesn't double up when the armor's own Active Effect already shifts that Skill", async () => {
        const actor = makeArmorActor({
          armorItems: [{
            system: { equipped: true, traits: ['enhanceSkill'], enhanceSkillTarget: 'technology' },
            effects: [{ disabled: false, system: { changes: [{ key: 'system.skills.technology.shiftUp', value: '1' }] } }],
          }],
        });
        expect((await shiftFor('technology', 'smarts', actor)).shiftUp).toBe(0);
      });

      test("Xenotech downshifts Athletics and Acrobatics by 1 while worn", async () => {
        const actor = makeArmorActor({
          armorItems: [{ system: { equipped: true, traits: ['xenotech'] } }],
        });
        expect((await shiftFor('athletics', 'strength', actor)).shiftDown).toBe(1);
        expect((await shiftFor('acrobatics', 'speed', actor)).shiftDown).toBe(1);
      });

      test("Xenotech doesn't apply to an unrelated Skill, or while unequipped", async () => {
        const actor = makeArmorActor({
          armorItems: [{ system: { equipped: true, traits: ['xenotech'] } }],
        });
        expect((await shiftFor('technology', 'smarts', actor)).shiftDown).toBe(0);

        const unequippedActor = makeArmorActor({
          armorItems: [{ system: { equipped: false, traits: ['xenotech'] } }],
        });
        expect((await shiftFor('athletics', 'strength', unequippedActor)).shiftDown).toBe(0);
      });

      describe("Regal", () => {
        function makeToken(disposition) {
          return { document: { disposition } };
        }

        let originalTargets;
        beforeEach(() => {
          originalTargets = game.user.targets;
        });
        afterEach(() => {
          game.user.targets = originalTargets;
        });

        test("upshifts Persuasion by 1 against an ally (matching disposition)", async () => {
          const actor = makeArmorActor({ armorItems: [{ system: { equipped: true, traits: ['regal'] } }] });
          const actorToken = makeToken(1);
          actor.getActiveTokens = jest.fn(() => [actorToken]);
          game.user.targets = { first: () => makeToken(1) };

          expect((await shiftFor('persuasion', 'social', actor)).shiftUp).toBe(1);
        });

        test("upshifts Intimidation by 1 against an enemy (opposing disposition)", async () => {
          const actor = makeArmorActor({ armorItems: [{ system: { equipped: true, traits: ['regal'] } }] });
          const actorToken = makeToken(1);
          actor.getActiveTokens = jest.fn(() => [actorToken]);
          game.user.targets = { first: () => makeToken(-1) };

          expect((await shiftFor('intimidation', 'social', actor)).shiftUp).toBe(1);
        });

        test("doesn't upshift Persuasion against an enemy, Intimidation against an ally, or without a target", async () => {
          const actor = makeArmorActor({ armorItems: [{ system: { equipped: true, traits: ['regal'] } }] });
          const actorToken = makeToken(1);
          actor.getActiveTokens = jest.fn(() => [actorToken]);

          game.user.targets = { first: () => makeToken(-1) };
          expect((await shiftFor('persuasion', 'social', actor)).shiftUp).toBe(0);

          game.user.targets = { first: () => makeToken(1) };
          expect((await shiftFor('intimidation', 'social', actor)).shiftUp).toBe(0);

          game.user.targets = { first: () => null };
          expect((await shiftFor('persuasion', 'social', actor)).shiftUp).toBe(0);
        });

        test("doesn't apply without the trait", async () => {
          const actor = makeArmorActor({ armorItems: [] });
          actor.getActiveTokens = jest.fn(() => [makeToken(1)]);
          game.user.targets = { first: () => makeToken(-1) };

          expect((await shiftFor('intimidation', 'social', actor)).shiftUp).toBe(0);
        });
      });
    });

    describe("The Quiet One (Factions in Action Vol. 2, Dreadnok General Perk, p.63) - noisy-action marking", () => {
      function makeMarkedActor() {
        const flagStore = {};
        return {
          ...mockActor,
          items: [],
          getRollData: jest.fn(() => ({
            skills: { driving: { modifier: '0', shift: 'd10' }, finesse: { modifier: '0', shift: 'd10' }, persuasion: { modifier: '0', shift: 'd10' } },
          })),
          getFlag: jest.fn((scope, key) => flagStore[key]),
          setFlag: jest.fn(async (scope, key, value) => {
            flagStore[key] = value;
          }),
        };
      }

      const nonSilentWeaponEffect = {
        type: 'weaponEffect', flags: {},
        system: { classification: { skill: 'finesse', style: 'melee' }, damageType: 'blunt', damageValue: 1 },
      };

      let originalCombat;
      beforeEach(() => {
        originalCombat = game.combat;
        game.combat = { id: 'combat1', round: 1 };
      });
      afterEach(() => {
        game.combat = originalCombat;
      });

      test("marks a Driving roll", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();
        const actor = makeMarkedActor();

        await dice.rollSkill({ ...dataset, skill: 'driving', essence: 'speed' }, actor, null);

        expect(actor.setFlag).toHaveBeenCalledWith(
          'essence20', 'quietOneNoisyActionThisRound', { combatId: 'combat1', round: 1 },
        );
      });

      test("marks a non-Silent weapon attack, but not a Skill Test with no item at all", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();
        const actor = makeMarkedActor();

        await dice.rollSkill({ ...dataset, skill: 'finesse', essence: 'strength' }, actor, nonSilentWeaponEffect);
        expect(actor.setFlag).toHaveBeenCalledWith(
          'essence20', 'quietOneNoisyActionThisRound', { combatId: 'combat1', round: 1 },
        );

        const otherActor = makeMarkedActor();
        await dice.rollSkill({ ...dataset, skill: 'persuasion', essence: 'social' }, otherActor, null);
        expect(otherActor.setFlag).not.toHaveBeenCalled();
      });
    });

    describe("Honest Assessment (Spirit of Honesty, 14th level, p.79)", () => {
      const HONEST_ASSESSMENT_ID = "Compendium.essence20.mlp_crb.Item.eIDYxShici5rRpg3";

      function makeHonestAssessmentActor({ active = true, choice = 'wealth' } = {}) {
        const actor = makeActor({ perkIds: [HONEST_ASSESSMENT_ID], choice });
        actor.getFlag = jest.fn((scope, key) => (key == 'honestAssessmentActive' ? active : undefined));
        return actor;
      }

      test("downshifts Deception and Persuasion by 2 while active, regardless of the chosen skill", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();
        const actor = makeHonestAssessmentActor({ choice: 'wealth' });

        await dice.rollSkill({ ...dataset, skill: 'deception', essence: 'social' }, actor, null);
        expect(rollDialog.getSkillRollOptions.mock.calls[0][0].shiftDown).toBe(2);

        await dice.rollSkill({ ...dataset, skill: 'persuasion', essence: 'social' }, actor, null);
        expect(rollDialog.getSkillRollOptions.mock.calls[1][0].shiftDown).toBe(2);
      });

      test("does nothing while inactive, or without the Perk", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();

        const inactiveActor = makeHonestAssessmentActor({ active: false, choice: 'wealth' });
        await dice.rollSkill({ ...dataset, skill: 'wealth', essence: 'smarts' }, inactiveActor, null);
        expect(rollDialog.getSkillRollOptions.mock.calls[0][0].shiftUp).toBe(0);
        expect(rollDialog.getSkillRollOptions.mock.calls[0][0].shiftDown).toBe(0);

        await dice.rollSkill({ ...dataset, skill: 'wealth', essence: 'smarts' }, makeActor(), null);
        expect(rollDialog.getSkillRollOptions.mock.calls[1][0].shiftUp).toBe(0);
      });
    });
  });

  describe("Purple Ranger - Emotional Mastery (A Jump Through Time, p.37)", () => {
    const EMOTIONAL_MASTERY_ID = "Compendium.essence20.jump_through_time.Item.bWAncoQxwfCLtn2v";

    function makeEmActor({ active = [], numHands = null } = {}) {
      const items = [{
        type: 'perk', flags: { core: { sourceId: EMOTIONAL_MASTERY_ID } }, system: { reroll: { enabled: false } },
      }];
      items.get = jest.fn(() => null);
      const flags = { activeEmotionalMastery: active };

      return {
        ...mockActor,
        items,
        system: {
          ...mockActor.system,
          essenceShifts: {
            any: { shiftUp: 0, shiftDown: 0 },
            strength: { shiftUp: 0, shiftDown: 0 },
            speed: { shiftUp: 0, shiftDown: 0 },
            smarts: { shiftUp: 0, shiftDown: 0 },
            social: { shiftUp: 0, shiftDown: 0 },
          },
        },
        getFlag: jest.fn((scope, key) => (scope == 'essence20' ? flags[key] : undefined)),
        setFlag: jest.fn(async (scope, key, value) => {
          if (scope == 'essence20') {
            flags[key] = value;
          }
        }),
        getRollData: jest.fn(() => ({
          skills: {
            alertness: { modifier: '0', shift: 'd20' }, culture: { modifier: '0', shift: 'd20' },
            wealth: { modifier: '0', shift: 'd20' }, brawn: { modifier: '0', shift: 'd6' },
          },
        })),
        _getParentWeapon: numHands == null ? undefined : jest.fn(() => ({ system: { numHands } })),
      };
    }

    describe("Fear / Sadness - live Defense bonus while active", () => {
      const targetingDataset = { ...dataset, skill: 'targeting', essence: 'speed' };
      const rangedWeaponEffect = {
        type: 'weaponEffect', flags: {},
        system: { classification: { skill: 'targeting', style: 'ranged' }, damageType: 'ballistic', damageValue: 3 },
      };

      function makeAttackerActor() {
        const items = [];
        items.get = jest.fn(() => null);

        return { ...mockActor, items, getRollData: jest.fn(() => ({ skills: { targeting: { modifier: '0', shift: 'd20' } } })) };
      }

      function makeTargetActor({ active = [] } = {}) {
        const flags = { activeEmotionalMastery: active };
        const token = { document: { disposition: -1 }, center: { x: 0, y: 0 } };

        return {
          name: 'Target', uuid: 'Actor.target1',
          system: { defenses: { toughness: { total: 10 }, willpower: { total: 8 } }, immunities: {}, size: 'common' },
          statuses: new Set(), items: [],
          getFlag: jest.fn((scope, key) => (scope == 'essence20' ? flags[key] : undefined)),
          getActiveTokens: jest.fn(() => [token]),
        };
      }

      function makeTargetsSet(targetActor) {
        const token = { actor: targetActor, center: { x: 0, y: 0 } };
        const set = new Set([token]);
        set.first = () => token;

        return set;
      }

      let originalTargets;
      beforeEach(() => {
        originalTargets = game.user.targets;
        canvas.tokens.placeables = [];
        canvas.grid.measurePath.mockReturnValue({ distance: 0 });
      });
      afterEach(() => {
        game.user.targets = originalTargets;
        canvas.tokens.placeables = [];
      });

      test("Fear adds 3 to Willpower/Cleverness Defense while active", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'willpower',
        });
        dice._rollSkillHelper = jest.fn();
        const targetActor = makeTargetActor({ active: ['fear'] });
        game.user.targets = makeTargetsSet(targetActor);

        await dice.rollSkill({ ...targetingDataset, defenseType: 'willpower' }, makeAttackerActor(), rangedWeaponEffect);

        expect(dice._rollSkillHelper.mock.calls[0][4].entries[0].difficulty).toBe(11); // 8 + 3
      });

      test("Sadness adds 2 to Toughness/Evasion Defense while active", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'toughness',
        });
        dice._rollSkillHelper = jest.fn();
        const targetActor = makeTargetActor({ active: ['sadness'] });
        game.user.targets = makeTargetsSet(targetActor);

        await dice.rollSkill({ ...targetingDataset, defenseType: 'toughness' }, makeAttackerActor(), rangedWeaponEffect);

        expect(dice._rollSkillHelper.mock.calls[0][4].entries[0].difficulty).toBe(12); // 10 + 2
      });

      test("neither applies without the matching option active", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'toughness',
        });
        dice._rollSkillHelper = jest.fn();
        const targetActor = makeTargetActor({ active: [] });
        game.user.targets = makeTargetsSet(targetActor);

        await dice.rollSkill({ ...targetingDataset, defenseType: 'toughness' }, makeAttackerActor(), rangedWeaponEffect);

        expect(dice._rollSkillHelper.mock.calls[0][4].entries[0].difficulty).toBe(10);
      });
    });

    describe("Interest - Edge on Alertness/Culture while active", () => {
      test("grants Edge on Alertness", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();
        const actor = makeEmActor({ active: ['interest'] });

        await dice.rollSkill({ ...dataset, skill: 'alertness', essence: 'smarts' }, actor, null);

        expect(rollDialog.getSkillRollOptions.mock.calls[0][1].edge).toBe(true);
      });

      test("doesn't apply on an unrelated skill, or without Interest active", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();
        const actor = makeEmActor({ active: ['interest'] });

        await dice.rollSkill({ ...dataset, skill: 'wealth', essence: 'smarts' }, actor, null);
        expect(rollDialog.getSkillRollOptions.mock.calls[0][1].edge).toBe(false);

        await dice.rollSkill({ ...dataset, skill: 'alertness', essence: 'smarts' }, makeEmActor({ active: [] }), null);
        expect(rollDialog.getSkillRollOptions.mock.calls[1][1].edge).toBe(false);
      });
    });

    describe("Joy - ↑1 on the first Skill Test each turn while near an ally", () => {
      let originalCanvas;
      beforeEach(() => {
        originalCanvas = global.canvas;
        game.combat = { id: 'combat1', round: 1, turn: 0 };
      });
      afterEach(() => {
        global.canvas = originalCanvas;
        game.combat = null;
      });

      function setNearbyAlly(actor, distance) {
        const actorToken = { document: { disposition: 1 }, center: { distance: 0 } };
        const allyToken = { document: { disposition: 1 }, center: { distance }, actor: {} };
        actor.getActiveTokens = jest.fn(() => [actorToken]);
        global.canvas = {
          tokens: { placeables: [actorToken, allyToken] },
          grid: { measurePath: jest.fn(([otherCenter]) => ({ distance: otherCenter.distance ?? 0 })) },
        };
      }

      test("grants ↑1 on the first Skill Test this turn while within 5ft of an ally", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();
        const actor = makeEmActor({ active: ['joy'] });
        actor.getFlag = jest.fn((scope, key) => (key == 'activeEmotionalMastery' ? ['joy'] : undefined));
        setNearbyAlly(actor, 3);

        await dice.rollSkill({ ...dataset, skill: 'alertness', essence: 'smarts' }, actor, null);

        expect(rollDialog.getSkillRollOptions.mock.calls[0][0].shiftUp).toBe(1);
      });

      test("doesn't apply with no ally within 5ft", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();
        const actor = makeEmActor({ active: ['joy'] });
        actor.getFlag = jest.fn((scope, key) => (key == 'activeEmotionalMastery' ? ['joy'] : undefined));
        setNearbyAlly(actor, 20);

        await dice.rollSkill({ ...dataset, skill: 'alertness', essence: 'smarts' }, actor, null);

        expect(rollDialog.getSkillRollOptions.mock.calls[0][0].shiftUp).toBe(0);
      });

      test("doesn't apply without Joy active", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();
        const actor = makeEmActor({ active: [] });
        setNearbyAlly(actor, 3);

        await dice.rollSkill({ ...dataset, skill: 'alertness', essence: 'smarts' }, actor, null);

        expect(rollDialog.getSkillRollOptions.mock.calls[0][0].shiftUp).toBe(0);
      });
    });

    describe("Anger - damage bonus on Unarmed/One-Handed Attacks while active", () => {
      const unarmedWeaponEffect = {
        type: 'weaponEffect', flags: {},
        system: { classification: { skill: 'brawn', style: 'melee' }, damageType: 'blunt', damageValue: 2 },
      };

      test("adds 1 damage on an unarmed Attack while active", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'toughness',
        });
        dice._rollSkillHelper = jest.fn();
        const actor = makeEmActor({ active: ['anger'], numHands: null });

        await dice.rollSkill({ ...dataset, skill: 'brawn', essence: 'strength', dif: '10' }, actor, unarmedWeaponEffect);

        expect(dice._rollSkillHelper.mock.calls[0][4].damageBonusValue).toBeGreaterThanOrEqual(1);
      });

      test("doesn't apply without Anger active", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'toughness',
        });
        dice._rollSkillHelper = jest.fn();
        const actor = makeEmActor({ active: [], numHands: null });

        await dice.rollSkill({ ...dataset, skill: 'brawn', essence: 'strength', dif: '10' }, actor, unarmedWeaponEffect);

        expect(dice._rollSkillHelper.mock.calls[0][4].damageBonusValue).toBe(0);
      });
    });
  });

  describe("MLP General/Origin/Influence Perks (2026-09-09)", () => {
    const POINTY_ID = "Compendium.essence20.dark_skies_over_equestria.Item.kwkUWzNVdSKDx0jt";
    const DIFFERENT_PERSPECTIVE_ID = "Compendium.essence20.dark_skies_over_equestria.Item.Q4npyOz8iYHHy2LV";

    function makeActor({ perkIds = [], choice = null, flags = {}, health = { max: 10, value: 10 } } = {}) {
      const items = perkIds.map(perkId => ({
        type: 'perk', flags: { core: { sourceId: perkId } }, system: { choice },
      }));
      items.get = jest.fn(() => null);

      return {
        ...mockActor,
        items,
        system: {
          ...mockActor.system,
          health,
          essenceShifts: {
            any: { shiftUp: 0, shiftDown: 0 },
            strength: { shiftUp: 0, shiftDown: 0 },
            speed: { shiftUp: 0, shiftDown: 0 },
            smarts: { shiftUp: 0, shiftDown: 0 },
            social: { shiftUp: 0, shiftDown: 0 },
          },
        },
        getRollData: jest.fn(() => ({
          skills: {
            animalHandling: { modifier: '0', shift: 'd20' },
            alertness: { modifier: '0', shift: 'd20' },
            might: { modifier: '0', shift: 'd20' },
            persuasion: { modifier: '0', shift: 'd20' },
            survival: { modifier: '0', shift: 'd20' },
            science: { modifier: '0', shift: 'd20' },
            infiltration: { modifier: '0', shift: 'd20' },
            culture: { modifier: '0', shift: 'd20' },
          },
        })),
        getFlag: jest.fn((scope, key) => (scope == 'essence20' ? flags[key] : undefined)),
        setFlag: jest.fn(async (scope, key, value) => {
          flags[key] = value; 
        }),
        unsetFlag: jest.fn(async (scope, key) => {
          delete flags[key]; 
        }),
      };
    }

    afterEach(() => {
      game.combat = null;
    });

    describe("Environmental Expertise (GI Joe CRB, Ranger base, 1st/9th/18th level, p.90)", () => {
      const ENVIRONMENTAL_EXPERTISE_ID = "Compendium.essence20.gi_joe_crb.Item.EbbSUA2vSHyv3MjQ";
      // The Perk's EnvironmentalExpertise rule (its pack rule - rules/plugins/effects/environmental-expertise-rule.mjs).
      const EE_RULES = [{ type: 'EnvironmentalExpertise', label: 'Environmental Expertise', when: [{ any: ['self:inExpertiseTerrain', 'self:data:flags.essence20.environmentalExpertiseActive'] }] }];
      let rebuildIndex;
      beforeAll(async () => {
        ({ rebuildIndex } = await import('./rules/index.mjs'));
      });

      /** An actor holding the Perk (with its rule), its toggle on or off. */
      function expertiseActor(active) {
        const actor = makeActor({ perkIds: [ENVIRONMENTAL_EXPERTISE_ID] });
        actor.items[0].id = 'ee';
        actor.items[0].system = { ...actor.items[0].system, rules: EE_RULES };
        actor.flags = { essence20: { environmentalExpertiseActive: active } };
        actor.getFlag = jest.fn((scope, key) => (key == 'environmentalExpertiseActive' ? active : undefined));
        rebuildIndex(actor);
        return actor;
      }

      function makeActiveActor() {
        return expertiseActor(true);
      }

      const weaponEffect = {
        type: 'weaponEffect', flags: {},
        system: { classification: { skill: 'might', style: 'melee' }, damageType: 'blunt', damageValue: 1 },
      };

      test("marks a weaponEffect attack Specialized while active", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();

        await dice.rollSkill({ ...dataset, skill: 'might', essence: 'strength' }, makeActiveActor(), weaponEffect);

        expect(rollDialog.getSkillRollOptions.mock.calls[0][0].isSpecialized).toBe(true);
      });

      test("grants Edge on a non-Attack Skill Test while active", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();

        await dice.rollSkill({ ...dataset, skill: 'alertness', essence: 'smarts' }, makeActiveActor(), null);

        expect(rollDialog.getSkillRollOptions.mock.calls[0][1].edge).toBe(true);
      });

      test("doesn't apply without the toggle active, or without the Perk", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();
        const inactiveActor = expertiseActor(false);

        await dice.rollSkill({ ...dataset, skill: 'alertness', essence: 'smarts' }, inactiveActor, null);
        expect(rollDialog.getSkillRollOptions.mock.calls[0][1].edge).toBeFalsy();

        await dice.rollSkill({ ...dataset, skill: 'alertness', essence: 'smarts' }, makeActor(), null);
        expect(rollDialog.getSkillRollOptions.mock.calls[1][1].edge).toBeFalsy();
      });

      // The scene's terrain (mechanics/world/environment.mjs#getTerrain) decides it without the toggle.
      function makeActorOnTerrain(terrain) {
        const actor = expertiseActor(false);
        const scene = { getFlag: (scope, key) => (key == 'terrain' ? terrain : undefined) };
        actor.documentName = 'Actor';
        actor.getActiveTokens = () => [{ regions: [], parent: scene }];
        actor.system = { ...actor.system, environments: ['desert'] };
        return actor;
      }

      test("grants Edge with no toggle when the scene's terrain is an environment of expertise, labelled with it", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();

        await dice.rollSkill({ ...dataset, skill: 'alertness', essence: 'smarts' }, makeActorOnTerrain('desert'), null);

        expect(rollDialog.getSkillRollOptions.mock.calls[0][1].edge).toBe(true);
        expect(rollDialog.getSkillRollOptions.mock.calls[0][0].combatModifierSources).toContainEqual(
          expect.objectContaining({ id: 'environmentalExpertise', edge: true, label: expect.stringContaining('E20.EnvironmentDesert') }),
        );
      });

      test("no Edge when the scene's terrain isn't an environment of expertise", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();

        await dice.rollSkill({ ...dataset, skill: 'alertness', essence: 'smarts' }, makeActorOnTerrain('urban'), null);

        expect(rollDialog.getSkillRollOptions.mock.calls[0][1].edge).toBeFalsy();
      });
    });

    // Guidance's one-roll grant is a pair of marked RollModifiers on the Perk (rules/conv15-items2.test.js).

    // Trade School (and Technical Mastery's crit for the coached ally) is item rules carried by marks (rules/conv17-perm.test.js).

    // Sensitive's Snag is a banked rule bonus now (rules/conv10-slE10.test.js).

    // One-Upping's banked ↑1 is a rule bank (rules/conv15-items2.test.js).
  });

  describe("Welcome to Night Vale Citizen's Guide (2026-09-10)", () => {
    beforeEach(() => {
      game.user.targets.first.mockReturnValue(undefined);
    });

    const UNIVERSITY_DAYS_ID = "Compendium.essence20.wtnv_citizens_guide.Item.5T3DHQjLjyM9J5tS";
    const STATIC_ELECTRICITY_ID = "Compendium.essence20.wtnv_citizens_guide.Item.mF6zMzGIfxQgJF9B";

    function makeActor({ perkIds = [] } = {}) {
      const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
      items.get = jest.fn(() => null);

      return {
        ...mockActor,
        items,
        system: {
          ...mockActor.system,
          essenceShifts: {
            any: { shiftUp: 0, shiftDown: 0 },
            strength: { shiftUp: 0, shiftDown: 0 },
            speed: { shiftUp: 0, shiftDown: 0 },
            smarts: { shiftUp: 0, shiftDown: 0 },
            social: { shiftUp: 0, shiftDown: 0 },
          },
        },
        getRollData: jest.fn(() => ({
          skills: {
            finesse: { modifier: '0', shift: 'd20' },
            targeting: { modifier: '0', shift: 'd20' },
          },
        })),
      };
    }

    // Moved to items/resources/energon-strains.mjs (every Energon spend, not just this one).
    describe("Don't-Notice-Me-Field (MLP CRB, Superior Enchantment spell, p.137)", () => {
      function makeFieldActor(active) {
        return {
          statuses: new Set(), items: [],
          getFlag: jest.fn((scope, key) => (key == 'dontNoticeMeFieldActive' ? (active ? { epoch: 1, window: 'scene', count: 1 } : undefined) : undefined)),
        };
      }

      test("grants the holder's own Infiltration Test Edge while active", () => {
        const actor = makeFieldActor(true);
        game.user.targets.first.mockReturnValue(undefined);

        expect(dice._getAutomaticCombatModifiers(actor, null, 'any', 'infiltration').edge).toBe(true);
      });

      test("doesn't grant self Edge on an unrelated Skill, or while inactive", () => {
        const activeActor = makeFieldActor(true);
        game.user.targets.first.mockReturnValue(undefined);
        expect(dice._getAutomaticCombatModifiers(activeActor, null, 'any', 'alertness').edge).toBe(false);

        const inactiveActor = makeFieldActor(false);
        expect(dice._getAutomaticCombatModifiers(inactiveActor, null, 'any', 'infiltration').edge).toBe(false);
      });

      test("imposes Snag rolling Alertness against an active target", () => {
        const target = { uuid: 'Actor.target1', type: 'playerCharacter', statuses: new Set(), items: [], ...makeFieldActor(true) };
        const actor = { statuses: new Set(), getFlag: jest.fn(), items: [] };
        game.user.targets.first.mockReturnValue({ actor: target });

        expect(dice._getAutomaticCombatModifiers(actor, null, 'any', 'alertness').snag).toBe(true);
      });

      test("doesn't impose reciprocal Snag on a different Skill, or while inactive", () => {
        const target = { uuid: 'Actor.target1', type: 'playerCharacter', statuses: new Set(), items: [], ...makeFieldActor(true) };
        const actor = { statuses: new Set(), getFlag: jest.fn(), items: [] };
        game.user.targets.first.mockReturnValue({ actor: target });
        expect(dice._getAutomaticCombatModifiers(actor, null, 'any', 'persuasion').snag).toBe(false);

        const inactiveTarget = { uuid: 'Actor.target1', type: 'playerCharacter', statuses: new Set(), items: [], ...makeFieldActor(false) };
        game.user.targets.first.mockReturnValue({ actor: inactiveTarget });
        expect(dice._getAutomaticCombatModifiers(actor, null, 'any', 'alertness').snag).toBe(false);
      });
    });

    describe("Glittermane (Knights of Canterlot, Superior Utility spell, p.46)", () => {
      test("downshifts (not Snags) attacking a Glittermane-active target", () => {
        const target = {
          uuid: 'Actor.target1', type: 'playerCharacter', statuses: new Set(), items: [],
          getFlag: jest.fn((scope, key) => (key == 'glittermaneActive' ? { epoch: 1, window: 'scene', count: 1 } : undefined)),
          system: { size: 'common' },
        };
        const actor = { statuses: new Set(), getFlag: jest.fn(), items: [], system: { size: 'common' } };
        game.user.targets.first.mockReturnValue({ actor: target });
        const weaponEffect = { type: 'weaponEffect', flags: {}, system: { classification: { skill: 'finesse' } } };

        const result = dice._getAutomaticCombatModifiers(actor, weaponEffect, 'speed', 'finesse');

        expect(result.shiftDown).toBe(1);
        expect(result.snag).toBe(false);
      });

      test("doesn't apply to a plain Skill Test, or while inactive", () => {
        const target = {
          uuid: 'Actor.target1', type: 'playerCharacter', statuses: new Set(), items: [],
          getFlag: jest.fn((scope, key) => (key == 'glittermaneActive' ? { epoch: 1, window: 'scene', count: 1 } : undefined)),
          system: { size: 'common' },
        };
        const actor = { statuses: new Set(), getFlag: jest.fn(), items: [], system: { size: 'common' } };
        game.user.targets.first.mockReturnValue({ actor: target });

        expect(dice._getAutomaticCombatModifiers(actor, null, 'any', 'alertness').shiftDown).toBe(0);

        const inactiveTarget = {
          uuid: 'Actor.target1', type: 'playerCharacter', statuses: new Set(), items: [],
          getFlag: jest.fn(), system: { size: 'common' },
        };
        game.user.targets.first.mockReturnValue({ actor: inactiveTarget });
        const weaponEffect = { type: 'weaponEffect', flags: {}, system: { classification: { skill: 'finesse' } } };

        expect(dice._getAutomaticCombatModifiers(actor, weaponEffect, 'speed', 'finesse').shiftDown).toBe(0);
      });
    });

    describe("More Heads are Better than One (Dragon Origin, p.30)", () => {
      const MORE_HEADS_ID = "Compendium.essence20.wtnv_citizens_guide.Item.jsaByB9ui8k1VUfG";

      test("appends the banked bonusDie to the roll formula", async () => {
        const rollDialog = createMockRollDialog();
        rollDialog.getSkillRollOptions.mockReturnValue({
          canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        });
        dice._rollSkillHelper = jest.fn();
        const actor = { statuses: new Set(), getFlag: jest.fn(), items: [] };
        actor.getFlag = jest.fn((scope, key) => (key == 'pendingMoreHeads' ? { bonusDie: '2d2' } : undefined));

        const result = dice._getAutomaticCombatModifiers(actor, null, 'smarts', 'science');

        expect(result.bonusDie).toBe('2d2');
        expect(result.pendingBonusesToClear).toContain('pendingMoreHeads');
      });

      test("doesn't apply anything without a pending bank", () => {
        const actor = { statuses: new Set(), getFlag: jest.fn(), items: [] };

        const result = dice._getAutomaticCombatModifiers(actor, null, 'smarts', 'science');

        expect(result.bonusDie).toBe(null);
      });
    });
  });

  test("weaponEffect on an integrated-Hardpoint weapon offers the movement-penalty control and applies the pick as a downshift", async () => {
    const rollDialog = createMockRollDialog();
    const dialogResult = {
      canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0,
      timesToRoll: 1, hardpointMovePenalty: 2,
    };
    rollDialog.getSkillRollOptions.mockReturnValue(dialogResult);
    const integratedWeapon = { system: { hardpoint: { type: 'integrated', reinforced: false } } };
    const hardpointActor = {
      ...mockActor,
      items: Object.assign([], { get: jest.fn(() => integratedWeapon) }),
      getRollData: jest.fn(() => ({ skills: { athletics: { modifier: '0', shift: 'd20' } } })),
    };
    const weaponEffect = {
      name: 'Arm Cannon',
      type: 'weaponEffect',
      flags: { essence20: { parentId: 'weapon-1' } },
      system: { classification: { skill: 'athletics', style: 'energy' }, damageType: 'energy', damageValue: 1, defenseType: 'none' },
    };
    dice._rollSkillHelper = jest.fn();
    const realHandleAutoFail = dice._handleAutoFail;
    dice._handleAutoFail = jest.fn(() => false);

    try {
      await dice.rollSkill({ ...dataset }, hardpointActor, weaponEffect);
    } finally {
      dice._handleAutoFail = realHandleAutoFail;
    }

    expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(
      expect.objectContaining({ hardpointMovement: { reinforced: false } }),
      expect.anything(),
      hardpointActor,
    );
    // the ↓2 dialog pick was folded into the roll's shiftDown
    expect(dialogResult.shiftDown).toBe(2);
  });

  test("weaponEffect on an external-Hardpoint weapon gets no movement-penalty control", async () => {
    const rollDialog = createMockRollDialog();
    rollDialog.getSkillRollOptions.mockReturnValue({ cancelled: true });
    const externalWeapon = { system: { hardpoint: { type: 'external' } } };
    const hardpointActor = {
      ...mockActor,
      items: Object.assign([], { get: jest.fn(() => externalWeapon) }),
      getRollData: jest.fn(() => ({ skills: { athletics: { modifier: '0', shift: 'd20' } } })),
    };
    const weaponEffect = {
      name: 'Blaster',
      type: 'weaponEffect',
      flags: { essence20: { parentId: 'weapon-2' } },
      system: { classification: { skill: 'athletics', style: 'energy' }, damageType: 'energy', damageValue: 1, defenseType: 'none' },
    };

    await dice.rollSkill({ ...dataset }, hardpointActor, weaponEffect);

    expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(
      expect.objectContaining({ hardpointMovement: null }),
      expect.anything(),
      hardpointActor,
    );
  });


  // rollSkill used to be fire-and-forget. It now hands its outcome back so a caller can act on
  // it - Requisition grants the item on a success. See _rollSkillHelper's own return.
  describe("reported outcome", () => {
    const difDataset = { ...dataset, dif: '10' };

    beforeEach(() => {
      mockActor.getRollData = jest.fn(() => ({ skills: { athletics: { modifier: '0', shift: 'd20' } } }));
    });

    test("reports success when a roll landed", async () => {
      const rollDialog = createMockRollDialog();
      const dice = new Dice(chatMessage, rollDialog, new Mocki18n());
      dice._rollSkillHelper = jest.fn(() => ({ results: [{ success: true }], rollFailed: false }));

      const outcome = await dice.rollSkill(difDataset, mockActor, null);
      expect(outcome.success).toBe(true);
      expect(outcome.outcomes).toHaveLength(1);
    });

    test("reports failure when nothing landed", async () => {
      const rollDialog = createMockRollDialog();
      const dice = new Dice(chatMessage, rollDialog, new Mocki18n());
      dice._rollSkillHelper = jest.fn(() => ({ results: [{ success: false }], rollFailed: true }));

      const outcome = await dice.rollSkill(difDataset, mockActor, null);
      expect(outcome.success).toBe(false);
    });

    // The one value rollSkill returned before this change, and the one documents/item.mjs
    // reads to refund an action - it has to keep coming back unchanged.
    test("still reports a cancelled dialog", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({ cancelled: true });
      const dice = new Dice(chatMessage, rollDialog, new Mocki18n());
      dice._rollSkillHelper = jest.fn();

      expect(await dice.rollSkill(difDataset, mockActor, null)).toEqual({ cancelled: true });
      expect(dice._rollSkillHelper).not.toHaveBeenCalled();
    });
  });
});

/* _getSkillRollLabel */
describe("_getSkillRollLabel", () => {
  test("skill roll", () => {
    const dataset = {
      skill: 'athletics',
    };
    const skillRollOptions = {
      edge: false,
      snag: false,
    };
    const expected = "E20.RollRollingFor E20.SkillAthletics";

    expect(dice._getSkillRollLabel(dataset, skillRollOptions)).toEqual(expected);
  });

  test("a requisition roll gets its own flavor instead of the plain skill label", () => {
    const dataset = { skill: 'targeting', requisitionItemName: 'Rocket Launcher' };
    const skillRollOptions = { edge: false, snag: false };

    expect(dice._getSkillRollLabel(dataset, skillRollOptions))
      .toEqual("<b>E20.RequisitionRollFlavor</b> - Rocket Launcher");
  });

  test("skill roll with Edge", () => {
    const dataset = {
      skill: 'athletics',
    };
    const skillRollOptions = {
      edge: true,
      snag: false,
    };
    const expected = "E20.RollRollingFor E20.SkillAthletics E20.RollWithAnEdge";

    expect(dice._getSkillRollLabel(dataset, skillRollOptions)).toEqual(expected);
  });

  test("skill roll with Snag", () => {
    const dataset = {
      skill: 'athletics',
    };
    const skillRollOptions = {
      edge: false,
      snag: true,
    };
    const expected = "E20.RollRollingFor E20.SkillAthletics E20.RollWithASnag";

    expect(dice._getSkillRollLabel(dataset, skillRollOptions)).toEqual(expected);
  });

  test("specialized skill roll", () => {
    const dataset = {
      skill: 'athletics',
      isSpecialized: true,
      specializationName: 'Foo Specialization',
    };
    const skillRollOptions = {
      edge: false,
      snag: false,
    };
    const expected = "E20.RollRollingFor Foo Specialization";

    expect(dice._getSkillRollLabel(dataset, skillRollOptions)).toEqual(expected);
  });
});

/* _getWeaponRollLabel */
describe("_getWeaponRollLabel", () => {
  test("shows a weaponEffect's second damage on the Effect line", () => {
    const twoDamage = {
      name: 'Acid Mace Effect',
      system: { damageType: 'blunt', damageValue: 1, secondaryDamage: { type: 'acid', value: 1 } },
    };
    expect(dice._getWeaponRollLabel({ skill: 'athletics' }, { edge: false, snag: false }, twoDamage))
      .toContain('<b>E20.WeaponEffect</b> - 1 E20.DamageBlunt + 1 E20.DamageAcid<br>');
  });

  const weaponEffect = {
    name: 'Zeo Power Clubs Effect',
    type: 'weaponEffect',
    system: {
      classification: {
        skill: "athletics",
      },
      damageType: "blunt",
      damageValue: 1,
    },
  };

  test("weapon roll", () => {
    const dataset = {
      skill: 'athletics',
    };
    const skillRollOptions = {
      edge: false,
      snag: false,
    };

    const expected =
      "<b>E20.RollTypeAttack</b> - Zeo Power Clubs Effect (E20.SkillAthletics)<br>" +
      "<b>E20.WeaponEffect</b> - 1 E20.DamageBlunt<br><b>E20.ItemDescription</b>:<br>";

    expect(dice._getWeaponRollLabel(dataset, skillRollOptions, weaponEffect)).toEqual(expected);
  });

  test("weapon roll with Edge", () => {
    const dataset = {
      skill: 'athletics',
    };
    const skillRollOptions = {
      edge: true,
      snag: false,
    };

    const expected =
      "<b>E20.RollTypeAttack</b> - Zeo Power Clubs Effect (E20.SkillAthletics) E20.RollWithAnEdge<br>" +
      "<b>E20.WeaponEffect</b> - 1 E20.DamageBlunt<br><b>E20.ItemDescription</b>:<br>";

    expect(dice._getWeaponRollLabel(dataset, skillRollOptions, weaponEffect)).toEqual(expected);
  });

  test("weapon roll with Snag", () => {
    const dataset = {
      skill: 'athletics',
    };
    const skillRollOptions = {
      edge: false,
      snag: true,
    };

    const expected =
      "<b>E20.RollTypeAttack</b> - Zeo Power Clubs Effect (E20.SkillAthletics) E20.RollWithASnag<br>" +
      "<b>E20.WeaponEffect</b> - 1 E20.DamageBlunt<br><b>E20.ItemDescription</b>:<br>";

    expect(dice._getWeaponRollLabel(dataset, skillRollOptions, weaponEffect)).toEqual(expected);
  });

  test("weapon roll with role skill die", () => {
    const dataset = {
      skill: 'roleSkillDie',
    };
    const skillRollOptions = {
      edge: false,
      snag: false,
    };

    const expected =
      "<b>E20.RollTypeAttack</b> - Zeo Power Clubs Effect (Foo Role Skill)<br>" +
      "<b>E20.WeaponEffect</b> - 1 E20.DamageBlunt<br><b>E20.ItemDescription</b>:<br>";

    expect(dice._getWeaponRollLabel(dataset, skillRollOptions, weaponEffect, 'Foo Role Skill')).toEqual(expected);
  });
});

/* _getSpellRollLabel */
describe("_getSpellRollLabel", () => {
  test("spell roll", () => {
    const skillRollOptions = {
      edge: false,
      snag: false,
    };
    const spell = {
      name: 'Barreling Beam',
      type: 'spell',
      system: {
        description: "Some description",
      },
    };
    const expected = "<b>E20.RollTypeSpell</b> - Barreling Beam (E20.SkillSpellcasting)<br><b>E20.ItemDescription</b> - Some description<br>";

    expect(dice._getSpellRollLabel(skillRollOptions, spell)).toEqual(expected);
  });
});

/* _getMagicBaubleRollLabel */
describe("_getMagicBaubleRollLabel", () => {
  test("magic bauble roll", () => {
    const skillRollOptions = {
      edge: false,
      snag: false,
    };
    const magicBauble = {
      name: "Healer's Salve",
      type: 'magic bauble',
      system: {
        description: "Some description",
      },
    };
    const expected = "<b>E20.RollTypeMagicBauble</b> - Healer's Salve (E20.SkillSpellcasting)<br><b>E20.ItemDescription</b> - Some description<br>";

    expect(dice._getMagicBaubleRollLabel(skillRollOptions, magicBauble)).toEqual(expected);
  });
});

/* _getFinalShift */
describe("_getFinalShift", () => {
  const initialShift = 'd20';

  test("no shift", () => {
    const skillRollOptions = {
      shiftUp: 0,
      shiftDown: 0,
    };
    const expected = 'd20';

    expect(dice._getFinalShift(skillRollOptions, initialShift)).toEqual(expected);
  });

  test("normal shift up", () => {
    const skillRollOptions = {
      shiftUp: 1,
      shiftDown: 0,
    };
    const expected = 'd2';

    expect(dice._getFinalShift(skillRollOptions, initialShift)).toEqual(expected);
  });

  test("normal shift down", () => {
    const skillRollOptions = {
      shiftUp: 0,
      shiftDown: 1,
    };
    const expected = 'autoFail';

    expect(dice._getFinalShift(skillRollOptions, initialShift)).toEqual(expected);
  });

  test("shifting down the lowest shift", () => {
    const skillRollOptions = {
      shiftUp: 0,
      shiftDown: 1,
    };
    const expected = 'd20';
    const shiftList = ['d2', 'd20'];
    expect(dice._getFinalShift(skillRollOptions, initialShift, shiftList)).toEqual(expected);
  });

  test("shifting up the highest shift", () => {
    const skillRollOptions = {
      shiftUp: 1,
      shiftDown: 0,
    };
    const initialShift = 'd2';
    const expected = 'd2';
    const shiftList = ['d2', 'd20'];
    expect(dice._getFinalShift(skillRollOptions, initialShift, shiftList)).toEqual(expected);
  });

  test("equal shifts cancelling", () => {
    const skillRollOptions = {
      shiftUp: 1,
      shiftDown: 1,
    };
    const expected = 'd20';

    expect(dice._getFinalShift(skillRollOptions, initialShift)).toEqual(expected);
  });

  test("normal shift arithmetic", () => {
    const skillRollOptions = {
      shiftUp: 2,
      shiftDown: 1,
    };
    const expected = 'd2';

    expect(dice._getFinalShift(skillRollOptions, initialShift)).toEqual(expected);
  });
});

/* _handleAutoFail */
describe("_handleAutoFail", () => {
  test("non-auto fail", () => {
    const skillShift = 'd20';
    const label = '';
    const actor = jest.mock();

    expect(dice._handleAutoFail(skillShift, label, actor)).toBe(false);
    expect(chatMessage.getSpeaker).not.toHaveBeenCalled();
    expect(chatMessage.create).not.toHaveBeenCalled();
  });

  test("auto fail", () => {
    const skillShift = 'autoFail';
    const label = '';
    const actor = jest.mock();

    expect(dice._handleAutoFail(skillShift, label, actor)).toBe(true);
    expect(chatMessage.getSpeaker).toHaveBeenCalled();
    expect(chatMessage.create).toHaveBeenCalledWith({ content: " E20.RollAutoFail", speaker: {} });
  });

  test("auto fail", () => {
    const skillShift = 'fumble';
    const label = '';
    const actor = jest.mock();

    expect(dice._handleAutoFail(skillShift, label, actor)).toBe(true);
    expect(chatMessage.getSpeaker).toHaveBeenCalled();
    expect(chatMessage.create).toHaveBeenCalledWith({ content: " E20.RollAutoFailFumble", speaker: {} });
  });
});

/* _getd20Operand */
describe("_getd20Operand", () => {
  test("both true", () => {
    const edge = false;
    const snag = false;
    const expected = 'd20';

    expect(dice._getd20Operand(edge, snag)).toEqual(expected);
  });

  test("both true", () => {
    const edge = true;
    const snag = true;
    const expected = 'd20';

    expect(dice._getd20Operand(edge, snag)).toEqual(expected);
  });

  test("snag true", () => {
    const edge = false;
    const snag = true;
    const expected = '2d20kl';

    expect(dice._getd20Operand(edge, snag)).toEqual(expected);
  });

  test("edge true", () => {
    const edge = true;
    const snag = false;
    const expected = '2d20kh';

    expect(dice._getd20Operand(edge, snag)).toEqual(expected);
  });

  test("floorAt10 (Silver Tongue) adds min10 before kh/kl", () => {
    expect(dice._getd20Operand(false, false, true)).toEqual('d20min10');
    expect(dice._getd20Operand(true, false, true)).toEqual('2d20min10kh');
    expect(dice._getd20Operand(false, true, true)).toEqual('2d20min10kl');
  });

  test("rollsThreeD20 (Kill Shot) rolls 3d20kh, but only together with edge", () => {
    expect(dice._getd20Operand(true, false, false, true)).toEqual('3d20kh');
    expect(dice._getd20Operand(false, true, false, true)).toEqual('2d20kl'); // Snag, not Edge
    expect(dice._getd20Operand(false, false, false, true)).toEqual('d20'); // no Edge/Snag at all
  });

  test("rollsThreeD20 combines with floorAt10", () => {
    expect(dice._getd20Operand(true, false, true, true)).toEqual('3d20min10kh');
  });

  test("flatD20Value (Dependable/Old Reliable) substitutes the flat value when there's no Edge/Snag", () => {
    expect(dice._getd20Operand(false, false, false, false, 10)).toEqual('10');
    expect(dice._getd20Operand(true, true, false, false, 15)).toEqual('15'); // Edge/Snag cancel out
  });

  test("flatD20Value with an active Edge/Snag leaves one side a real rolled d20 by default", () => {
    expect(dice._getd20Operand(true, false, false, false, 10)).toEqual('{10,d20}kh');
    expect(dice._getd20Operand(false, true, false, false, 10)).toEqual('{10,d20}kl');
  });

  test("flatD20Value combines with floorAt10's own min10 modifier on the still-rolled side", () => {
    expect(dice._getd20Operand(true, false, true, false, 10)).toEqual('{10,d20min10}kh');
  });

  test("flatBothD20s (Old Reliable) replaces the whole Edge/Snag pair with the flat value outright", () => {
    expect(dice._getd20Operand(true, false, false, false, 10, true)).toEqual('10');
    expect(dice._getd20Operand(false, true, false, false, 15, true)).toEqual('15');
  });

  test("flatBothD20s is meaningless (and harmless) without an active Edge/Snag", () => {
    expect(dice._getd20Operand(false, false, false, false, 10, true)).toEqual('10');
  });
});

/* _getEdgeSnagText */
describe("_getEdgeSnagText", () => {
  test("both true", () => {
    const edge = false;
    const snag = false;
    const expected = "";

    expect(dice._getEdgeSnagText(edge, snag)).toEqual(expected);
  });

  test("both true", () => {
    const edge = true;
    const snag = true;
    const expected = "";

    expect(dice._getEdgeSnagText(edge, snag)).toEqual(expected);
  });

  test("snag true", () => {
    const edge = false;
    const snag = true;
    const expected = " E20.RollWithASnag";

    expect(dice._getEdgeSnagText(edge, snag)).toEqual(expected);
  });

  test("edge true", () => {
    const edge = true;
    const snag = false;
    const expected = " E20.RollWithAnEdge";

    expect(dice._getEdgeSnagText(edge, snag)).toEqual(expected);
  });
});

/* _arrayToFormula */
describe("_arrayToFormula", () => {
  test("no operands", () => {
    const operands = [];
    const expected = '';

    expect(dice._arrayToFormula(operands)).toEqual(expected);
  });

  test("one operand", () => {
    const operands = ['1'];
    const expected = '1';

    expect(dice._arrayToFormula(operands)).toEqual(expected);
  });

  test("two operands", () => {
    const operands = ['1', '2'];
    const expected = '1,2';

    expect(dice._arrayToFormula(operands)).toEqual(expected);
  });

  test("three operands", () => {
    const operands = ['1', '2', '3'];
    const expected = '1,2,3';

    expect(dice._arrayToFormula(operands)).toEqual(expected);
  });
});

/* _getFormula */
describe("_getFormula - Rumble in the Jungle's bonus pool die (Sgt Slaughter Sourcebook, p.14)", () => {
  const plainOptions = { edge: false, snag: false };

  test("turns an unspecialized single die into a two-die kept-highest pool", () => {
    expect(dice._getFormula(false, plainOptions, 'd6', 0, false, false, 0, false, 'd8'))
      .toEqual('d20 + {d6,d8}kh + 0');
  });

  test("appends onto the Specialization staircase rather than replacing it", () => {
    // RAW: "you gain this bonus Skill Die in addition to your Specialization Dice."
    expect(dice._getFormula(true, plainOptions, 'd6', 0, false, false, 0, false, 'd8'))
      .toEqual('d20 + {d2,d4,d6,d8}kh + 0');
  });

  test("stands alone when the attacking skill is untrained (d20 contributes no Skill Die)", () => {
    expect(dice._getFormula(false, plainOptions, 'd20', 0, false, false, 0, false, 'd8'))
      .toEqual('d20 + d8 + 0');
  });

  test("changes nothing when no bonus die applies", () => {
    expect(dice._getFormula(false, plainOptions, 'd6', 0)).toEqual('d20 + d6 + 0');
    expect(dice._getFormula(true, plainOptions, 'd6', 0)).toEqual('d20 + {d2,d4,d6}kh + 0');
  });
});

describe("_getFormula", () => {
  test("non-specialized, default options, d20, no modifier", () => {
    const isSpecialized = false;
    const skillRollOptions = {
      edge: false,
      snag: false,
    };
    const finalShift = 'd20';
    const modifier = 0;
    const expected = 'd20 + 0';

    expect(dice._getFormula(isSpecialized, skillRollOptions, finalShift, modifier)).toEqual(expected);
  });

  test("non-specialized, default options, d6, no modifier", () => {
    const isSpecialized = false;
    const skillRollOptions = {
      edge: false,
      snag: false,
    };
    const finalShift = 'd6';
    const modifier = 0;
    const expected = 'd20 + d6 + 0';

    expect(dice._getFormula(isSpecialized, skillRollOptions, finalShift, modifier)).toEqual(expected);
  });

  test("specialized, default options, d6, no modifier", () => {
    const isSpecialized = true;
    const skillRollOptions = {
      edge: false,
      snag: false,
    };
    const finalShift = 'd6';
    const modifier = 0;
    const expected = 'd20 + {d2,d4,d6}kh + 0';

    expect(dice._getFormula(isSpecialized, skillRollOptions, finalShift, modifier)).toEqual(expected);
  });

  test("non-specialized, default options, d20, +1 modifier", () => {
    const isSpecialized = false;
    const skillRollOptions = {
      edge: false,
      snag: false,
    };
    const finalShift = 'd20';
    const modifier = 1;
    const expected = 'd20 + 1';

    expect(dice._getFormula(isSpecialized, skillRollOptions, finalShift, modifier)).toEqual(expected);
  });

  test("non-specialized, edge, d20, no modifier", () => {
    const isSpecialized = false;
    const skillRollOptions = {
      edge: true,
      snag: false,
    };
    const finalShift = 'd20';
    const modifier = 0;
    const expected = '2d20kh + 0';

    expect(dice._getFormula(isSpecialized, skillRollOptions, finalShift, modifier)).toEqual(expected);
  });

  test("non-specialized, snag, d20, no modifier", () => {
    const isSpecialized = false;
    const skillRollOptions = {
      edge: false,
      snag: true,
    };
    const finalShift = 'd20';
    const modifier = 0;
    const expected = '2d20kl + 0';

    expect(dice._getFormula(isSpecialized, skillRollOptions, finalShift, modifier)).toEqual(expected);
  });

  test("flatD20Value (Dependable/Old Reliable) threads through to the d20 portion, rest unaffected", () => {
    const isSpecialized = false;
    const skillRollOptions = {
      edge: true,
      snag: false,
    };
    const finalShift = 'd6';
    const modifier = 2;
    const expected = '{10,d20}kh + d6 + 2';

    expect(dice._getFormula(isSpecialized, skillRollOptions, finalShift, modifier, false, false, 10)).toEqual(expected);
  });
});

/* _getSizeShift */
describe("_getSizeShift", () => {
  test("same size", () => {
    expect(dice._getSizeShift('common', 'common')).toBe(0);
  });

  test("adjacent size", () => {
    expect(dice._getSizeShift('common', 'large')).toBe(0);
  });

  test("two steps apart", () => {
    expect(dice._getSizeShift('common', 'long')).toBe(1);
  });

  test("far apart, larger target", () => {
    expect(dice._getSizeShift('small', 'titanic')).toBe(5);
  });

  test("far apart, larger attacker", () => {
    expect(dice._getSizeShift('titanic', 'small')).toBe(5);
  });

  test("unrecognized size returns 0", () => {
    expect(dice._getSizeShift('common', 'unknown')).toBe(0);
  });
});

/* _applyTripKnockdown */
describe("_applyTripKnockdown (GI Joe CRB, Weapon Effects and Traits, p.148)", () => {
  function makeResult({ targetUuid = 'Actor.target1', success = true } = {}) {
    return { targetUuid, success };
  }

  beforeEach(() => {
    fromUuid.mockReset();
  });

  test("knocks a successfully-hit target Prone on a Trip effect", async () => {
    const targetActor = { toggleStatusEffect: jest.fn() };
    fromUuid.mockResolvedValue(targetActor);
    const results = [makeResult()];

    await dice._applyTripKnockdown(results, { damageType: 'knocProne' });

    expect(targetActor.toggleStatusEffect).toHaveBeenCalledWith('prone', { active: true });
  });

  test("doesn't apply for a non-Trip effect", async () => {
    const results = [makeResult()];

    await dice._applyTripKnockdown(results, { damageType: 'sharp' });

    expect(fromUuid).not.toHaveBeenCalled();
  });

  test("doesn't apply on a miss", async () => {
    const results = [makeResult({ success: false })];

    await dice._applyTripKnockdown(results, { damageType: 'knocProne' });

    expect(fromUuid).not.toHaveBeenCalled();
  });
});

describe("_applyBlindingBlast (Quartermaster's Guide to Gear p.33)", () => {
  function makeResult({ targetUuid = 'Actor.target1', success = true } = {}) {
    return { targetUuid, success };
  }

  beforeEach(() => {
    fromUuid.mockReset();
    game.combat = null;
  });

  test("blinds a successfully-hit target on a Blinding effect", async () => {
    const targetActor = { toggleStatusEffect: jest.fn(), effects: [] };
    fromUuid.mockResolvedValue(targetActor);
    const results = [makeResult()];

    await dice._applyBlindingBlast(results, { damageType: 'blindingBlast' });

    expect(targetActor.toggleStatusEffect).toHaveBeenCalledWith('blinded', { active: true });
  });

  // Book check 2026-10-06 (follow-ups 2): "blind until the end of their next turn" - in a running combat the
  // effect ends as the TARGET's next turn ends; the Crowd Dispersal Energy Cannon's "Blinded 1" (Condition trait)
  // is 1 round.
  function blindable() {
    const effects = [];
    return {
      id: 'target1', effects,
      toggleStatusEffect: jest.fn(async status => effects.push({ statuses: new Set([status]), update: jest.fn() })),
    };
  }

  test("in combat: blinded until the end of the target's own next turn", async () => {
    const targetActor = blindable();
    fromUuid.mockResolvedValue(targetActor);
    game.combat = { id: 'c1', started: true, round: 2, turn: 0, turns: [{ id: 'cb0', actor: { id: 'shooter' } }, { id: 'cb1', actor: targetActor }] };

    await dice._applyBlindingBlast([makeResult()], { damageType: 'blindingBlast', weaponTraits: [] });

    expect(targetActor.effects[0].update).toHaveBeenCalledWith(expect.objectContaining({
      'duration.value': 0, 'duration.expiry': 'turnEnd', 'start.combatant': 'cb1',
    }));
  });

  test("a Condition-trait weapon (Crowd Dispersal's Blinded 1): 1 round", async () => {
    const targetActor = blindable();
    fromUuid.mockResolvedValue(targetActor);
    game.combat = { id: 'c1', started: true, round: 2, turn: 0, turns: [{ id: 'cb0', actor: { id: 'shooter' } }, { id: 'cb1', actor: targetActor }] };

    await dice._applyBlindingBlast([makeResult()], { damageType: 'blindingBlast', weaponTraits: ['computerized', 'condition'] });

    expect(targetActor.effects[0].update).toHaveBeenCalledWith({ 'duration.rounds': 1, 'duration.startRound': 2, 'duration.startTurn': 0 });
  });

  test("doesn't apply for a non-Blinding effect", async () => {
    const results = [makeResult()];

    await dice._applyBlindingBlast(results, { damageType: 'sharp' });

    expect(fromUuid).not.toHaveBeenCalled();
  });

  test("doesn't apply on a miss", async () => {
    const results = [makeResult({ success: false })];

    await dice._applyBlindingBlast(results, { damageType: 'blindingBlast' });

    expect(fromUuid).not.toHaveBeenCalled();
  });
});

describe("_applyDeafeningEffect (Crowd Dispersal Energy Cannon, Intercontinental Adventures p.92)", () => {
  beforeEach(() => {
    fromUuid.mockReset();
    game.combat = null;
  });

  test("deafens a successfully-hit target on a Deafened effect", async () => {
    const targetActor = { toggleStatusEffect: jest.fn(), effects: [] };
    fromUuid.mockResolvedValue(targetActor);

    await dice._applyDeafeningEffect([{ targetUuid: 'Actor.target1', success: true }], { damageType: 'deafened' });

    expect(targetActor.toggleStatusEffect).toHaveBeenCalledWith('deafened', { active: true });
  });

  test("in combat: Deafened 1 lasts 1 round (book check follow-ups 2)", async () => {
    const effects = [];
    const targetActor = { id: 'target1', effects, toggleStatusEffect: jest.fn(async status => effects.push({ statuses: new Set([status]), update: jest.fn() })) };
    fromUuid.mockResolvedValue(targetActor);
    game.combat = { id: 'c1', started: true, round: 3, turn: 1, turns: [] };

    await dice._applyDeafeningEffect([{ targetUuid: 'Actor.target1', success: true }], { damageType: 'deafened' });

    expect(effects[0].update).toHaveBeenCalledWith({ 'duration.rounds': 1, 'duration.startRound': 3, 'duration.startTurn': 1 });
  });

  test("doesn't apply on a miss or for another effect", async () => {
    await dice._applyDeafeningEffect([{ targetUuid: 'Actor.target1', success: false }], { damageType: 'deafened' });
    await dice._applyDeafeningEffect([{ targetUuid: 'Actor.target1', success: true }], { damageType: 'blindingBlast' });

    expect(fromUuid).not.toHaveBeenCalled();
  });
});

describe("_applyTraitRiders - Blinding trait vs. Strobe's alternate effect", () => {
  beforeEach(() => {
    fromUuid.mockReset();
    game.combat = null;
  });

  test("a Blinding weapon with no Blinding alternate blinds on every hit", async () => {
    const targetActor = { toggleStatusEffect: jest.fn(), effects: [] };
    fromUuid.mockResolvedValue(targetActor);

    await dice._applyTraitRiders({}, [{ targetUuid: 'Actor.target1', success: true }], {
      weaponTraits: ['blinding'], damageType: 'laser', weaponHasBlindingEffect: false,
    });

    expect(targetActor.toggleStatusEffect).toHaveBeenCalledWith('blinded', { active: true });
  });

  test("the Blinding trait in combat: until the end of the target's next turn (book check follow-ups 2)", async () => {
    const effects = [];
    const targetActor = { id: 'target1', effects, toggleStatusEffect: jest.fn(async status => effects.push({ statuses: new Set([status]), update: jest.fn() })) };
    fromUuid.mockResolvedValue(targetActor);
    // The target has already acted this round: its next turn is next round's.
    game.combat = { id: 'c1', started: true, round: 1, turn: 1, turns: [{ id: 'cb0', actor: targetActor }, { id: 'cb1', actor: { id: 'shooter' } }] };

    await dice._applyTraitRiders({}, [{ targetUuid: 'Actor.target1', success: true }], {
      weaponTraits: ['blinding'], damageType: 'laser', weaponHasBlindingEffect: false,
    });

    expect(effects[0].update).toHaveBeenCalledWith(expect.objectContaining({ 'duration.value': 1, 'duration.expiry': 'turnEnd', 'start.combatant': 'cb0' }));
  });

  test("once the weapon has its Blinding alternate effect, its normal effect doesn't blind", async () => {
    const targetActor = { toggleStatusEffect: jest.fn(), effects: [] };
    fromUuid.mockResolvedValue(targetActor);

    await dice._applyTraitRiders({}, [{ targetUuid: 'Actor.target1', success: true }], {
      weaponTraits: ['blinding'], damageType: 'blunt', weaponHasBlindingEffect: true,
    });

    expect(targetActor.toggleStatusEffect).not.toHaveBeenCalledWith('blinded', expect.anything());
  });
});

describe("_applyModeLock (Enigma of Combination, Weapon Traits/Conditions, p.49)", () => {
  function makeResult({ targetUuid = 'Actor.target1', success = true } = {}) {
    return { targetUuid, success };
  }

  beforeEach(() => {
    fromUuid.mockReset();
  });

  test("applies Mode Lock to a successfully-hit target", async () => {
    const targetActor = { toggleStatusEffect: jest.fn() };
    fromUuid.mockResolvedValue(targetActor);
    const results = [makeResult()];

    await dice._applyModeLock(results, { damageType: 'modelock' });

    expect(targetActor.toggleStatusEffect).toHaveBeenCalledWith('modeLock', { active: true });
  });

  test("doesn't apply for a non-Mode Lock effect", async () => {
    const results = [makeResult()];

    await dice._applyModeLock(results, { damageType: 'sharp' });

    expect(fromUuid).not.toHaveBeenCalled();
  });

  test("doesn't apply on a miss", async () => {
    const results = [makeResult({ success: false })];

    await dice._applyModeLock(results, { damageType: 'modelock' });

    expect(fromUuid).not.toHaveBeenCalled();
  });
});

/* _applyCritMultiplier */
describe("_applyCritMultiplier (Energy Sword Time Strike, A Jump Through Time p.69)", () => {
  test("a Critical Success triples the damage instead of doubling it", () => {
    const results = [
      { multiplier: 2, damageValue: 10 },
      { multiplier: 1, damageValue: 5 },
      { multiplier: 0, damageValue: null },
    ];

    dice._applyCritMultiplier(results, { critMultiplier: 3, damageValue: 5 });

    expect(results.map(r => r.damageValue)).toEqual([15, 5, null]);
  });

  test("does nothing without the effect's multiplier", () => {
    const results = [{ multiplier: 2, damageValue: 10 }];

    dice._applyCritMultiplier(results, { critMultiplier: null, damageValue: 5 });

    expect(results[0].damageValue).toBe(10);
  });
});

describe("1/scene Battlizer attacks (mechanics/companions/summons.mjs)", () => {
  test("a used-up Energy Sword Time Strike can't be rolled again this scene", async () => {
    const weapon = {
      id: 'w1', type: 'weapon', name: 'Energy Sword Time Strike',
      system: { usesPerScene: 1 }, flags: { essence20: { battlizerOf: 'armor1' } },
    };
    const items = [weapon];
    items.get = jest.fn(id => items.find(i => i.id == id));
    const actor = {
      ...mockActor,
      items,
      getFlag: jest.fn((scope, key) => (key == 'battlizerAttack.w1' ? { epoch: 1, window: 'scene', count: 1 } : undefined)),
    };
    const effect = { type: 'weaponEffect', flags: { essence20: { parentId: 'w1' } }, system: { classification: { style: 'melee' } } };
    const rollDialog = createMockRollDialog();
    const originalNotifications = ui.notifications;
    const warn = jest.fn();
    ui.notifications = { ...originalNotifications, warn };

    await dice.rollSkill({ skill: 'might', essence: 'strength', shift: 'd8', shiftUp: '0', shiftDown: '0', isSpecialized: false }, actor, effect);
    ui.notifications = originalNotifications;

    expect(rollDialog.getSkillRollOptions).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });
});

/* _applyPerTwoHits */
describe("_applyPerTwoHits (Psycho Slinger, Finster's Monster-Matic Cookbook p.302)", () => {
  function makeAttacker() {
    const flags = {};
    return {
      getFlag: jest.fn((scope, key) => flags[key]),
      setFlag: jest.fn(async (scope, key, value) => {
        flags[key] = value;
      }),
    };
  }

  function hit(targetUuid = 'Actor.t1') {
    return {
      success: true, targetUuid, damageValue: 1, damageBonusLabel: null,
      secondaryDamage: null, criticalOptions: [{ key: 'x' }],
    };
  }

  beforeEach(() => {
    game.combat = { id: 'combat1', round: 1, turn: 0 };
  });

  afterEach(() => {
    game.combat = null;
  });

  test("only every second hit on the same target keeps its damage, across separate rolls", async () => {
    const actor = makeAttacker();
    const ctx = { perTwoHitsEffectId: 'effect1' };

    const first = [hit('Actor.t1'), hit('Actor.t2')];
    await dice._applyPerTwoHits(actor, first, ctx);
    expect(first[0].damageValue).toBe(null);
    expect(first[0].criticalOptions).toEqual([]);
    expect(first[1].damageValue).toBe(null);

    const second = [hit('Actor.t1'), { success: false, targetUuid: 'Actor.t2', damageValue: null }];
    await dice._applyPerTwoHits(actor, second, ctx);
    expect(second[0].damageValue).toBe(1);
    expect(second[0].riderNote).toContain('E20.PerTwoHitsNote');
    // A miss doesn't count toward the tally.
    expect(second[1].riderNote).toBeUndefined();

    const third = [hit('Actor.t2')];
    await dice._applyPerTwoHits(actor, third, ctx);
    expect(third[0].damageValue).toBe(1);
  });

  test("the tally starts over on a new turn", async () => {
    const actor = makeAttacker();
    const ctx = { perTwoHitsEffectId: 'effect1' };
    await dice._applyPerTwoHits(actor, [hit()], ctx);

    game.combat = { id: 'combat1', round: 1, turn: 1 };
    const next = [hit()];
    await dice._applyPerTwoHits(actor, next, ctx);

    expect(next[0].damageValue).toBe(null);
  });

  test("does nothing for any other weapon effect", async () => {
    const actor = makeAttacker();
    const results = [hit()];

    await dice._applyPerTwoHits(actor, results, {});

    expect(results[0].damageValue).toBe(1);
    expect(actor.setFlag).not.toHaveBeenCalled();
  });
});

/* _getAutomaticCombatModifiers */
describe("_getAutomaticCombatModifiers", () => {
  const GI_JOE_CRB = "Compendium.essence20.gi_joe_crb.Item.";
  const DECEPTICON_DIRECTIVE = "Compendium.essence20.decepticon_directive.Item.";
  const TF_CRB = "Compendium.essence20.tf_crb.Item.";

  // actor.items needs to behave like a real Foundry EmbeddedCollection - array-like (.some(),
  // used by mechanics/characters/perks.mjs#actorHasPerk) AND .get()-able (used for weapon lookups) - a plain
  // array with a .get() method attached satisfies both.
  function makeActor(size, statuses = [], { perkIds = [], weapon = null, debilitated = false, level } = {}) {
    const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
    items.get = jest.fn(() => weapon);

    return {
      system: { size, level },
      statuses: new Set(statuses),
      items,
      getFlag: jest.fn((scope, key) => (scope == 'essence20' && key == 'debilitated' ? debilitated : undefined)),
      unsetFlag: jest.fn(),
    };
  }

  const defaultModifiers = {
    shiftUp: 0, shiftDown: 0, edge: false, snag: false,
    tooCloseForMinimumRange: false, pendingBonusesToClear: [], bonusDie: null, forcedMiss: false,
    snagOrMissSpend: null, spottedTarget: null,
    sources: [],
    exterminatorEligible: false,
    disgustTriggered: false,
  };

  const meleeWeaponEffect = {
    type: 'weaponEffect',
    system: { classification: { style: 'melee' }, defenseType: 'toughness' },
  };
  const rangedWeaponEffect = {
    type: 'weaponEffect',
    system: { classification: { style: 'projectile' }, defenseType: 'toughness' },
  };

  beforeEach(() => {
    game.user.targets.first.mockReturnValue(undefined);
    game.combat = null;
  });

  test("non-attack roll ignores target and size", () => {
    game.user.targets.first.mockReturnValue({ actor: makeActor('titanic') });
    const actor = makeActor('small');

    expect(dice._getAutomaticCombatModifiers(actor, null)).toEqual(defaultModifiers);
  });

  test("Impaired applies to any roll, including non-attacks", () => {
    const actor = makeActor('common', ['impaired']);

    expect(dice._getAutomaticCombatModifiers(actor, null))
      .toEqual({ ...defaultModifiers, shiftDown: 1, sources: [
        {
          "edge": false,
          "id": "impaired",
          "label": "E20.StatusImpaired",
          "shiftDown": 1,
          "shiftUp": 0,
          "snag": false,
        },
      ] });
  });

  test("Frightened downshifts any roll by 2, as its own toggleable source", () => {
    const actor = makeActor('common', ['frightened']);

    expect(dice._getAutomaticCombatModifiers(actor, null))
      .toEqual({ ...defaultModifiers, shiftDown: 2, sources: [
        {
          "edge": false,
          "id": "selfFrightened",
          "label": "E20.StatusFrightened",
          "shiftDown": 2,
          "shiftUp": 0,
          "snag": false,
        },
      ] });
  });

  test("attack with no target only applies self Conditions", () => {
    const actor = makeActor('common', ['blinded']);

    expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect))
      .toEqual({ ...defaultModifiers, snag: true, sources: [
        {
          "edge": false,
          "id": "selfBlinded",
          "label": "E20.StatusBlinded",
          "shiftDown": 0,
          "shiftUp": 0,
          "snag": true,
        },
      ] });
  });

  test("attack applies Size Class shift from the targeted actor", () => {
    game.user.targets.first.mockReturnValue({ actor: makeActor('titanic') });
    const actor = makeActor('small');

    expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect))
      .toEqual({ ...defaultModifiers, shiftUp: 5, sources: [
        {
          "edge": false,
          "id": "size",
          "label": "E20.CombatModifierSize",
          "shiftDown": 0,
          "shiftUp": 5,
          "snag": false,
        },
      ] });
  });

  test("Prone target grants Edge to a melee attacker", () => {
    game.user.targets.first.mockReturnValue({ actor: makeActor('common', ['prone']) });
    const actor = makeActor('common');

    expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect))
      .toEqual({ ...defaultModifiers, edge: true, sources: [
        {
          "edge": true,
          "id": "targetProne",
          "label": "E20.StatusProne",
          "shiftDown": 0,
          "shiftUp": 0,
          "snag": false,
        },
      ] });
  });

  test("Prone target grants Snag to a ranged attacker", () => {
    game.user.targets.first.mockReturnValue({ actor: makeActor('common', ['prone']) });
    const actor = makeActor('common');

    expect(dice._getAutomaticCombatModifiers(actor, rangedWeaponEffect))
      .toEqual({ ...defaultModifiers, snag: true, sources: [
        {
          "edge": false,
          "id": "targetProneRanged",
          "label": "E20.StatusProne",
          "shiftDown": 0,
          "shiftUp": 0,
          "snag": true,
        },
      ] });
  });

  test("Asleep target (Prone and Unconscious) grants Edge to a melee attacker via the implied Prone", () => {
    game.user.targets.first.mockReturnValue({ actor: makeActor('common', ['asleep']) });
    const actor = makeActor('common');

    // Asleep implies BOTH Prone and Unconscious (GI Joe CRB, Conditions, p.225), so both the
    // melee-Prone Edge and the unconscious Edge fire off a single 'asleep' status.
    expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect))
      .toEqual({ ...defaultModifiers, edge: true, sources: [
        {
          "edge": true,
          "id": "targetUnconscious",
          "label": "E20.StatusUnconscious",
          "shiftDown": 0,
          "shiftUp": 0,
          "snag": false,
        },
        {
          "edge": true,
          "id": "targetProne",
          "label": "E20.StatusProne",
          "shiftDown": 0,
          "shiftUp": 0,
          "snag": false,
        },
      ] });
  });

  test("Asleep target grants Snag to a ranged attacker via the implied Prone", () => {
    game.user.targets.first.mockReturnValue({ actor: makeActor('common', ['asleep']) });
    const actor = makeActor('common');

    const result = dice._getAutomaticCombatModifiers(actor, rangedWeaponEffect);
    expect(result.edge).toBe(true);
    expect(result.snag).toBe(true);
    expect(result.sources.some(s => s.id == 'targetProneRanged')).toBe(true);
  });

  test("Defeated target grants Edge to a melee attacker via the implied Prone, but not to a ranged one", () => {
    game.user.targets.first.mockReturnValue({ actor: makeActor('common', ['defeated']) });
    const actor = makeActor('common');

    // Defeated implies Prone only (not Unconscious) - GI Joe CRB, Conditions, p.225.
    expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect))
      .toEqual({ ...defaultModifiers, edge: true, sources: [
        {
          "edge": true,
          "id": "targetProne",
          "label": "E20.StatusProne",
          "shiftDown": 0,
          "shiftUp": 0,
          "snag": false,
        },
      ] });

    expect(dice._getAutomaticCombatModifiers(actor, rangedWeaponEffect))
      .toEqual({ ...defaultModifiers, snag: true, sources: [
        {
          "edge": false,
          "id": "targetProneRanged",
          "label": "E20.StatusProne",
          "shiftDown": 0,
          "shiftUp": 0,
          "snag": true,
        },
      ] });
  });

  test("Immobilized target grants a shift up", () => {
    game.user.targets.first.mockReturnValue({ actor: makeActor('common', ['immobilized']) });
    const actor = makeActor('common');

    expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect))
      .toEqual({ ...defaultModifiers, shiftUp: 1, sources: [
        {
          "edge": false,
          "id": "targetImmobilized",
          "label": "E20.StatusImmobilized",
          "shiftDown": 0,
          "shiftUp": 1,
          "snag": false,
        },
      ] });
  });

  test("Invisible target grants a Snag", () => {
    game.user.targets.first.mockReturnValue({ actor: makeActor('common', ['invisible']) });
    const actor = makeActor('common');

    expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect))
      .toEqual({ ...defaultModifiers, snag: true, sources: [
        {
          "edge": false,
          "id": "targetInvisible",
          "label": "E20.StatusInvisible",
          "shiftDown": 0,
          "shiftUp": 0,
          "snag": true,
        },
      ] });
  });

  describe("Indirect (Weapon Effects and Traits, p.147) - a core weapon trait, not a Perk", () => {
    const indirectEffect = {
      name: 'Mortar Shell',
      type: 'weaponEffect',
      flags: { essence20: { parentId: 'weapon1' } },
      system: { classification: { skill: 'targeting', style: 'ranged' }, damageType: 'blunt', damageValue: 1 },
    };

    function makeIndirectAttacker(traits = ['indirect']) {
      const actor = makeActor('common');
      actor.items.get = jest.fn(id => (id == 'weapon1' ? { flags: {}, system: { traits } } : null));
      return actor;
    }

    test("ignores ordinary Cover", () => {
      game.user.targets.first.mockReturnValue({ actor: makeActor('common', ['cover']) });

      expect(dice._getAutomaticCombatModifiers(makeIndirectAttacker(), indirectEffect))
        .toEqual(defaultModifiers);
    });

    // RAW exempts a target with total cover overhead - totalCover is exactly that case.
    test("does NOT ignore Total Cover", () => {
      game.user.targets.first.mockReturnValue({ actor: makeActor('common', ['totalCover']) });

      expect(dice._getAutomaticCombatModifiers(makeIndirectAttacker(), indirectEffect))
        .toEqual({ ...defaultModifiers, shiftDown: 2, sources: [
          { id: 'cover', label: 'E20.StatusCover', edge: false, shiftDown: 2, shiftUp: 0, snag: false },
        ] });
    });

    test("a weapon without the trait still suffers the Cover penalty", () => {
      game.user.targets.first.mockReturnValue({ actor: makeActor('common', ['cover']) });

      expect(dice._getAutomaticCombatModifiers(makeIndirectAttacker([]), indirectEffect))
        .toEqual({ ...defaultModifiers, shiftDown: 2, sources: [
          { id: 'cover', label: 'E20.StatusCover', edge: false, shiftDown: 2, shiftUp: 0, snag: false },
        ] });
    });
  });

  describe("Cover (p.202)", () => {
    test("imposes -2 shift on a ranged attack against a target with Cover", () => {
      game.user.targets.first.mockReturnValue({ actor: makeActor('common', ['cover']) });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, rangedWeaponEffect))
        .toEqual({ ...defaultModifiers, shiftDown: 2, sources: [
          {
            "edge": false,
            "id": "cover",
            "label": "E20.StatusCover",
            "shiftDown": 2,
            "shiftUp": 0,
            "snag": false,
          },
        ] });
    });

    test("imposes the same -2 shift against a target with Total Cover", () => {
      game.user.targets.first.mockReturnValue({ actor: makeActor('common', ['totalCover']) });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, rangedWeaponEffect))
        .toEqual({ ...defaultModifiers, shiftDown: 2, sources: [
          {
            "edge": false,
            "id": "cover",
            "label": "E20.StatusCover",
            "shiftDown": 2,
            "shiftUp": 0,
            "snag": false,
          },
        ] });
    });

    test("doesn't apply to a melee attack - cover doesn't stop a reach past it", () => {
      game.user.targets.first.mockReturnValue({ actor: makeActor('common', ['cover']) });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect)).toEqual(defaultModifiers);
    });

    test("doesn't apply to a target without either Cover status", () => {
      game.user.targets.first.mockReturnValue({ actor: makeActor('common') });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, rangedWeaponEffect)).toEqual(defaultModifiers);
    });

    describe("Take Point (Transformers CRB, Outrider Origin Benefit, p.52) - Cover in Rough Terrain", () => {
      const TAKE_POINT_ID = "Compendium.essence20.tf_crb.Item.efPOy3Owf2XIAykS";

      function makeTargetToken(target, rough) {
        const region = { behaviors: [{ type: 'environment', disabled: false, system: { roughTerrain: true } }] };
        const scene = { getFlag: () => undefined, regions: [region] };
        return { actor: target, document: { documentName: 'Token', regions: rough ? [region] : [], parent: scene } };
      }

      // Cover in Rough Terrain is Take Point's item rule now (rules/conv15-other.test.js); the hand-written path
      // must no longer give it.
      test("no Cover outside Rough Terrain, or without the Perk", () => {
        const target = makeActor('common', [], { perkIds: [TAKE_POINT_ID] });
        game.user.targets.first.mockReturnValue(makeTargetToken(target, false));
        expect(dice._getAutomaticCombatModifiers(makeActor('common'), rangedWeaponEffect)).toEqual(defaultModifiers);

        game.user.targets.first.mockReturnValue(makeTargetToken(makeActor('common'), true));
        expect(dice._getAutomaticCombatModifiers(makeActor('common'), rangedWeaponEffect)).toEqual(defaultModifiers);
      });
    });

    describe("Trip (GI Joe CRB, Weapon Effects and Traits, p.148)", () => {
      const tripWeaponEffect = {
        type: 'weaponEffect',
        system: { classification: { style: 'melee' }, defenseType: 'toughness', damageType: 'knocProne' },
      };

      function withRollData(actor, { brawn = 'd8', finesse = 'd8' } = {}) {
        actor.getRollData = jest.fn(() => ({ skills: { brawn: { shift: brawn }, finesse: { shift: finesse } } }));
        return actor;
      }

      test("shifts the attacker down when their better of Brawn/Finesse is worse than the target's", () => {
        game.user.targets.first.mockReturnValue({ actor: withRollData(makeActor('common'), { brawn: 'd6', finesse: 'd12' }) });
        const actor = withRollData(makeActor('common'), { brawn: 'd20', finesse: 'd10' });

        expect(dice._getAutomaticCombatModifiers(actor, tripWeaponEffect))
          .toEqual({ ...defaultModifiers, shiftDown: 1, sources: [
            {
              "edge": false,
              "id": "trip",
              "label": "E20.CombatModifierTrip",
              "shiftDown": 1,
              "shiftUp": 0,
              "snag": false,
            },
          ] });
      });

      test("doesn't apply when the attacker's better Skill is equal or higher, or to a non-Trip attack", () => {
        game.user.targets.first.mockReturnValue({ actor: withRollData(makeActor('common'), { brawn: 'd8', finesse: 'd8' }) });
        let actor = withRollData(makeActor('common'), { brawn: 'd8', finesse: 'd8' });
        expect(dice._getAutomaticCombatModifiers(actor, tripWeaponEffect)).toEqual(defaultModifiers);

        game.user.targets.first.mockReturnValue({ actor: withRollData(makeActor('common'), { brawn: 'd20', finesse: 'd20' }) });
        actor = withRollData(makeActor('common'), { brawn: 'd4', finesse: 'd4' });
        expect(dice._getAutomaticCombatModifiers(actor, tripWeaponEffect)).toEqual(defaultModifiers);

        game.user.targets.first.mockReturnValue({ actor: withRollData(makeActor('common'), { brawn: 'd6', finesse: 'd12' }) });
        actor = withRollData(makeActor('common'), { brawn: 'd20', finesse: 'd10' });
        expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect)).toEqual(defaultModifiers);
      });
    });

    describe("Xenotech (Across the Stars, Weapon Traits, p.79) - Snag until a Critical Success", () => {
      const weaponEffectWithParent = { ...meleeWeaponEffect, flags: { essence20: { parentId: 'weapon1' } } };

      function makeXenotechWeapon({ critted = false } = {}) {
        return { system: { traits: ['xenotech'] }, getFlag: jest.fn(() => critted) };
      }

      test("imposes Snag on attacks with an un-critted Xenotech weapon", () => {
        const actor = makeActor('common', [], { weapon: makeXenotechWeapon() });

        expect(dice._getAutomaticCombatModifiers(actor, weaponEffectWithParent))
          .toEqual({ ...defaultModifiers, snag: true, sources: [
            {
              "edge": false,
              "id": "xenotech",
              "label": "E20.WeaponTraitXenotech",
              "shiftDown": 0,
              "shiftUp": 0,
              "snag": true,
            },
          ] });
      });

      test("doesn't apply once the weapon's own flag says it's already critted, or without the trait", () => {
        const crittedActor = makeActor('common', [], { weapon: makeXenotechWeapon({ critted: true }) });
        expect(dice._getAutomaticCombatModifiers(crittedActor, weaponEffectWithParent)).toEqual(defaultModifiers);

        const otherWeaponActor = makeActor('common', [], { weapon: { system: { traits: [] }, getFlag: jest.fn(() => false) } });
        expect(dice._getAutomaticCombatModifiers(otherWeaponActor, weaponEffectWithParent)).toEqual(defaultModifiers);
      });
    });

    describe("Xenotech Components (Across the Stars, Tools of the Trade, p.79)", () => {
      const weaponEffectWithParent = { ...meleeWeaponEffect, flags: { essence20: { parentId: 'weapon1' } } };

      test("imposes ↓1 before the Component has ever succeeded", () => {
        const weapon = { system: { traits: ['components'] }, getFlag: jest.fn(() => false) };
        const actor = makeActor('common', [], { weapon });

        expect(dice._getAutomaticCombatModifiers(actor, weaponEffectWithParent))
          .toEqual({ ...defaultModifiers, shiftDown: 1, sources: [
            {
              "edge": false,
              "id": "components",
              "label": "E20.WeaponTraitComponents",
              "shiftDown": 1,
              "shiftUp": 0,
              "snag": false,
            },
          ] });
      });

      test("grants ↑1 once the Component's own flag says it has succeeded", () => {
        const weapon = { system: { traits: ['components'] }, getFlag: jest.fn(() => true) };
        const actor = makeActor('common', [], { weapon });

        expect(dice._getAutomaticCombatModifiers(actor, weaponEffectWithParent))
          .toEqual({ ...defaultModifiers, shiftUp: 1, sources: [
            {
              "edge": false,
              "id": "components",
              "label": "E20.WeaponTraitComponents",
              "shiftDown": 0,
              "shiftUp": 1,
              "snag": false,
            },
          ] });
      });

      test("doesn't apply without the trait", () => {
        const weapon = { system: { traits: [] }, getFlag: jest.fn(() => false) };
        const actor = makeActor('common', [], { weapon });

        expect(dice._getAutomaticCombatModifiers(actor, weaponEffectWithParent)).toEqual(defaultModifiers);
      });
    });

    describe("Retrogen (Cobra Codex, New Weapon Effects and Traits, p.92)", () => {
      const ENGRAFTED_MUTATION_ID = "Compendium.essence20.cobra_codex.Item.zuR9YJ2Wy956VGGy";
      const weaponEffectWithParent = { ...rangedWeaponEffect, flags: { essence20: { parentId: 'weapon1' } } };
      const retrogenWeapon = { system: { traits: ['retrogen'] }, getFlag: jest.fn(() => false) };

      test("grants ↑1 against a target that plainly has Genetic Alterations", () => {
        game.user.targets.first.mockReturnValue({ actor: makeActor('common', [], { perkIds: [ENGRAFTED_MUTATION_ID] }) });
        const actor = makeActor('common', [], { weapon: retrogenWeapon });

        expect(dice._getAutomaticCombatModifiers(actor, weaponEffectWithParent))
          .toEqual({ ...defaultModifiers, shiftUp: 1, sources: [
            { edge: false, id: 'retrogen', label: 'E20.WeaponTraitRetrogen', shiftDown: 0, shiftUp: 1, snag: false },
          ] });
      });

      test("doesn't apply against an unmarked target, or without the trait", () => {
        game.user.targets.first.mockReturnValue({ actor: makeActor('common') });
        expect(dice._getAutomaticCombatModifiers(makeActor('common', [], { weapon: retrogenWeapon }), weaponEffectWithParent))
          .toEqual(defaultModifiers);

        game.user.targets.first.mockReturnValue({ actor: makeActor('common', [], { perkIds: [ENGRAFTED_MUTATION_ID] }) });
        const plainWeapon = { system: { traits: [] }, getFlag: jest.fn(() => false) };
        expect(dice._getAutomaticCombatModifiers(makeActor('common', [], { weapon: plainWeapon }), weaponEffectWithParent))
          .toEqual(defaultModifiers);
      });
    });

    // Contingency Shot's cover-ignore half is a Cover item rule (module/rules/conversions.test.js).
    describe("Cover with and without Contingency Shot (A Jump Through Time, Pink Spectrum Modification, p.47)", () => {
      const CONTINGENCY_SHOT_ID = "Compendium.essence20.jump_through_time.Item.DAqOZsEq03rJWWQo";
      const rangedWeaponEffectWithParent = {
        ...rangedWeaponEffect, flags: { essence20: { parentId: 'weapon1' } },
      };

      test("still applies without the Perk", () => {
        game.user.targets.first.mockReturnValue({ actor: makeActor('common', ['cover']) });
        const actor = makeActor('common', []);

        expect(dice._getAutomaticCombatModifiers(actor, rangedWeaponEffectWithParent))
          .toEqual({ ...defaultModifiers, shiftDown: 2, sources: [
            {
              "edge": false,
              "id": "cover",
              "label": "E20.StatusCover",
              "shiftDown": 2,
              "shiftUp": 0,
              "snag": false,
            },
          ] });
      });

      test("doesn't apply to a melee attack, even with the Perk (melee never gets a Cover shift at all)", () => {
        game.user.targets.first.mockReturnValue({ actor: makeActor('common', ['cover']) });
        const actor = makeActor('common', [], { perkIds: [CONTINGENCY_SHOT_ID] });

        expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect)).toEqual(defaultModifiers);
      });
    });
  });

  describe("Range for Ranged Attacks / Ranged Attacks in Close Combat (p.201)", () => {
    function makeToken(actor) {
      return { actor, center: { x: 0, y: 0 } };
    }

    // Needs its own actor factory - the shared makeActor() above doesn't define getActiveTokens.
    function makeRangedActor(size = 'common') {
      return {
        system: { size },
        statuses: new Set(),
        items: [],
        getActiveTokens: jest.fn(() => [makeToken(null)]),
        getFlag: jest.fn(() => undefined),
        unsetFlag: jest.fn(),
      };
    }

    function rangedEffect(range) {
      return {
        type: 'weaponEffect',
        system: { classification: { style: 'projectile' }, defenseType: 'toughness', range },
      };
    }

    beforeEach(() => {
      canvas.grid.measurePath.mockReturnValue({ distance: 0 });
      // Enemy Number One's own check (dice.mjs, later in this same method) also runs for every
      // roll with a resolved target, and scans canvas.tokens.placeables independently - reset it
      // so a token left over from another describe block's own tests can't reach it.
      canvas.tokens.placeables = [];
    });

    test("no penalty within normal range", () => {
      canvas.grid.measurePath.mockReturnValue({ distance: 20 });
      game.user.targets.first.mockReturnValue(makeToken(makeActor('common')));

      expect(dice._getAutomaticCombatModifiers(makeRangedActor(), rangedEffect({ value: 20, long: 80 })))
        .toEqual(defaultModifiers);
    });

    test("suffers a Snag between normal and max range", () => {
      canvas.grid.measurePath.mockReturnValue({ distance: 50 });
      game.user.targets.first.mockReturnValue(makeToken(makeActor('common')));

      expect(dice._getAutomaticCombatModifiers(makeRangedActor(), rangedEffect({ value: 20, long: 80 })))
        .toEqual({ ...defaultModifiers, snag: true, sources: [
          {
            "edge": false,
            "id": "longRange",
            "label": "E20.CombatModifierLongRange",
            "shiftDown": 0,
            "shiftUp": 0,
            "snag": true,
          },
        ] });
    });

    describe("Nowhere to Run (Decepticon Directive, Gunner Replacement Perk, 9th level, p.45) - its immune: [longRangeSnagForEdge] rule", () => {
      const NOWHERE_TO_RUN = {
        id: 'ntr', name: 'Nowhere to Run', type: 'perk', flags: { core: { sourceId: "Compendium.essence20.decepticon_directive.Item.SyYuTRXeaZy4De3B" } },
        system: { rules: [{ type: 'RollModifier', immune: ['longRangeSnagForEdge'], when: ['attack:ranged'] }] },
      };

      test("suppresses the long-range Snag on its own", () => {
        canvas.grid.measurePath.mockReturnValue({ distance: 50 });
        game.user.targets.first.mockReturnValue(makeToken(makeActor('common')));
        const actor = makeRangedActor();
        actor.items = [NOWHERE_TO_RUN];

        expect(dice._getAutomaticCombatModifiers(actor, rangedEffect({ value: 20, long: 80 })))
          .toEqual(defaultModifiers);
      });

      test("grants Edge instead when the Snag was already being ignored some other way", () => {
        canvas.grid.measurePath.mockReturnValue({ distance: 50 });
        game.user.targets.first.mockReturnValue(makeToken(makeActor('common')));
        const actor = makeRangedActor();
        actor.items = [
          NOWHERE_TO_RUN,
          // Long Shot: its item rule lifts the long-range Snag.
          {
            id: 'longShot', type: 'perk', flags: { core: { sourceId: "Compendium.essence20.tf_crb.Item.Q3KK4HYhwjk52kle" } },
            system: { rules: [{ type: 'RollModifier', immune: ['longRangeSnag'], when: ['attack', 'not:attack:melee'] }] },
          },
        ];

        expect(dice._getAutomaticCombatModifiers(actor, rangedEffect({ value: 20, long: 80 })))
          .toEqual({ ...defaultModifiers, edge: true, sources: [
            {
              "edge": true,
              "id": "nowhereToRun",
              "label": "Nowhere to Run",
              "shiftDown": 0,
              "shiftUp": 0,
              "snag": false,
            },
          ] });
      });
    });

    test("doesn't apply anything further beyond max range", () => {
      canvas.grid.measurePath.mockReturnValue({ distance: 100 });
      game.user.targets.first.mockReturnValue(makeToken(makeActor('common')));

      expect(dice._getAutomaticCombatModifiers(makeRangedActor(), rangedEffect({ value: 20, long: 80 })))
        .toEqual(defaultModifiers);
    });

    test("flags tooCloseForMinimumRange closer than minimum range (e.g. a Rocket Launcher)", () => {
      // Between common's own reach (5) and the weapon's minimum range (10), so only the min-range
      // flag is in play here - the close-combat downshift below covers the reach case on its own.
      // This is a hard block, not a Snag - rollSkill() refuses the roll outright when it's set,
      // see its own describe block below.
      canvas.grid.measurePath.mockReturnValue({ distance: 7 });
      game.user.targets.first.mockReturnValue(makeToken(makeActor('common')));

      expect(dice._getAutomaticCombatModifiers(makeRangedActor(), rangedEffect({ min: 10, value: 20, long: 80 })))
        .toEqual({ ...defaultModifiers, tooCloseForMinimumRange: true });
    });

    test("doesn't apply to a melee attack", () => {
      canvas.grid.measurePath.mockReturnValue({ distance: 100 });
      game.user.targets.first.mockReturnValue(makeToken(makeActor('common')));

      expect(dice._getAutomaticCombatModifiers(makeRangedActor(), meleeWeaponEffect)).toEqual(defaultModifiers);
    });

    test("suffers a downshift when within the target's own natural Reach", () => {
      canvas.grid.measurePath.mockReturnValue({ distance: 3 }); // common reach = 5
      game.user.targets.first.mockReturnValue(makeToken(makeActor('common')));

      expect(dice._getAutomaticCombatModifiers(makeRangedActor(), rangedEffect({ value: 20, long: 80 })))
        .toEqual({ ...defaultModifiers, shiftDown: 1, sources: [
          {
            "edge": false,
            "id": "reach",
            "label": "E20.CombatModifierReach",
            "shiftDown": 1,
            "shiftUp": 0,
            "snag": false,
          },
        ] });
    });

    test("uses the target's own Reach, not the attacker's", () => {
      // Same size ('common') on both sides so _getSizeShift never enters into it - if this used
      // the ATTACKER's own reach (common = 5) instead of the target's, distance 3 would trigger
      // the downshift; using the target's own (small = 2) instead, it doesn't.
      canvas.grid.measurePath.mockReturnValue({ distance: 3 });
      game.user.targets.first.mockReturnValue(makeToken(makeActor('small')));

      expect(dice._getAutomaticCombatModifiers(makeRangedActor('common'), rangedEffect({ value: 20, long: 80 })))
        .toEqual(defaultModifiers);
    });

    test("tooCloseForMinimumRange and the close-combat downshift can both apply on the same roll", () => {
      canvas.grid.measurePath.mockReturnValue({ distance: 3 });
      game.user.targets.first.mockReturnValue(makeToken(makeActor('common')));

      expect(dice._getAutomaticCombatModifiers(makeRangedActor(), rangedEffect({ min: 10, value: 20, long: 80 })))
        .toEqual({ ...defaultModifiers, tooCloseForMinimumRange: true, shiftDown: 1, sources: [
          {
            "edge": false,
            "id": "reach",
            "label": "E20.CombatModifierReach",
            "shiftDown": 1,
            "shiftUp": 0,
            "snag": false,
          },
        ] });
    });

    test("doesn't apply without a resolved attacker token", () => {
      canvas.grid.measurePath.mockReturnValue({ distance: 3 });
      game.user.targets.first.mockReturnValue(makeToken(makeActor('common')));
      const actor = makeRangedActor();
      actor.getActiveTokens = jest.fn(() => []);

      expect(dice._getAutomaticCombatModifiers(actor, rangedEffect({ min: 10, value: 20, long: 80 })))
        .toEqual(defaultModifiers);
    });

    describe("Injection (Ferocious Fighters: Factions in Action Vol. 1, New Weapon Traits, p.93)", () => {
      function makeInjectionActor({ hasTrait = true } = {}) {
        const actor = makeRangedActor();
        actor.items.get = jest.fn(() => ({ system: { traits: hasTrait ? ['injection'] : [] } }));
        return actor;
      }

      function injectionEffect(range) {
        return { ...rangedEffect(range), flags: { essence20: { parentId: 'weapon1' } } };
      }

      test("suppresses the Reach downshift for an Injection weapon", () => {
        canvas.grid.measurePath.mockReturnValue({ distance: 3 }); // common reach = 5
        game.user.targets.first.mockReturnValue(makeToken(makeActor('common')));

        expect(dice._getAutomaticCombatModifiers(makeInjectionActor(), injectionEffect({ value: 20, long: 80 })))
          .toEqual(defaultModifiers);
      });

      test("still applies without the trait", () => {
        canvas.grid.measurePath.mockReturnValue({ distance: 3 });
        game.user.targets.first.mockReturnValue(makeToken(makeActor('common')));

        expect(dice._getAutomaticCombatModifiers(
          makeInjectionActor({ hasTrait: false }), injectionEffect({ value: 20, long: 80 }),
        )).toEqual({ ...defaultModifiers, shiftDown: 1, sources: [
          {
            "edge": false,
            "id": "reach",
            "label": "E20.CombatModifierReach",
            "shiftDown": 1,
            "shiftUp": 0,
            "snag": false,
          },
        ] });
      });
    });

    describe("CQB Training (Quartermaster's Guide to Gear, General Perk, p.28) - its immune: [reachDownshift] rule", () => {
      function makeCqbActor({ hasPerk = true } = {}) {
        const actor = makeRangedActor();
        actor.items = hasPerk ? [{
          id: 'cqb', name: 'CQB Training', type: 'perk', flags: { core: { sourceId: "Compendium.essence20.quartermasters_guide_to_gear.Item.HBwUVB3ur8WV9fsF" } },
          system: { rules: [{ type: 'RollModifier', immune: ['reachDownshift'], when: ['attack:ranged'] }] },
        }] : [];
        return actor;
      }

      test("suppresses the Reach downshift with any weapon, with the Perk", () => {
        canvas.grid.measurePath.mockReturnValue({ distance: 3 }); // common reach = 5
        game.user.targets.first.mockReturnValue(makeToken(makeActor('common')));

        expect(dice._getAutomaticCombatModifiers(makeCqbActor(), rangedEffect({ value: 20, long: 80 })))
          .toEqual(defaultModifiers);
      });

      test("still applies without the Perk", () => {
        canvas.grid.measurePath.mockReturnValue({ distance: 3 });
        game.user.targets.first.mockReturnValue(makeToken(makeActor('common')));

        expect(dice._getAutomaticCombatModifiers(makeCqbActor({ hasPerk: false }), rangedEffect({ value: 20, long: 80 })))
          .toEqual({ ...defaultModifiers, shiftDown: 1, sources: [
            {
              "edge": false,
              "id": "reach",
              "label": "E20.CombatModifierReach",
              "shiftDown": 1,
              "shiftUp": 0,
              "snag": false,
            },
          ] });
      });
    });

    describe("As Above / So Below (Quartermaster's Guide to Gear, Strafer Focus, Vanguard, 6th level, p.28) - rules on roll:elevationAbove:", () => {
      const AS_ABOVE_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.QAOI7O3yVmmMpFEu";
      const SO_BELOW_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.MlEYEVW4YXT4P0sP";
      const RULES = {
        [AS_ABOVE_ID]: [{ type: 'RollModifier', label: 'As Above', edge: true, when: ['attack:ranged', 'roll:elevationAbove:>0'] }],
        [SO_BELOW_ID]: [{ type: 'RollModifier', label: 'So Below', scope: 'incoming', downshift: 1, when: ['attack:ranged', 'roll:elevationAbove:>0'] }],
      };
      const perk = perkId => ({ id: perkId.slice(-16), name: 'Perk', type: 'perk', flags: { core: { sourceId: perkId } }, system: { rules: RULES[perkId] } });

      function makeElevatedActor(perkId, elevation) {
        const actor = makeRangedActor();
        actor.items = perkId ? [perk(perkId)] : [];
        actor.getActiveTokens = jest.fn(() => [{ actor: null, center: { x: 0, y: 0 }, document: { elevation } }]);
        return actor;
      }

      beforeEach(() => {
        canvas.grid.measurePath.mockReturnValue({ distance: 20 });
      });

      test("As Above grants Edge on any elevation advantage, no 30ft floor", () => {
        game.user.targets.first.mockReturnValue(
          { actor: makeActor('common'), center: { x: 0, y: 0 }, document: { elevation: 0 } },
        );

        expect(dice._getAutomaticCombatModifiers(makeElevatedActor(AS_ABOVE_ID, 5), rangedEffect({ value: 20, long: 80 })).edge)
          .toBe(true);
      });

      test("As Above doesn't apply at equal or lower elevation, or without the Perk", () => {
        game.user.targets.first.mockReturnValue(
          { actor: makeActor('common'), center: { x: 0, y: 0 }, document: { elevation: 0 } },
        );

        expect(dice._getAutomaticCombatModifiers(makeElevatedActor(AS_ABOVE_ID, 0), rangedEffect({ value: 20, long: 80 })).edge)
          .toBe(false);
        expect(dice._getAutomaticCombatModifiers(makeElevatedActor(null, 5), rangedEffect({ value: 20, long: 80 })).edge)
          .toBe(false);
      });

      test("So Below grants downshift 1 to an attacker firing down at the holder", () => {
        const holder = makeActor('common');
        holder.items = [perk(SO_BELOW_ID)];
        game.user.targets.first.mockReturnValue({ actor: holder, center: { x: 0, y: 0 }, document: { elevation: 0 } });

        expect(dice._getAutomaticCombatModifiers(makeElevatedActor(null, 5), rangedEffect({ value: 20, long: 80 })).shiftDown)
          .toBe(1);
      });

      test("So Below doesn't apply without the Perk on the target, or from equal/lower elevation", () => {
        const nonHolder = makeActor('common');
        game.user.targets.first.mockReturnValue({ actor: nonHolder, center: { x: 0, y: 0 }, document: { elevation: 0 } });
        expect(dice._getAutomaticCombatModifiers(makeElevatedActor(null, 5), rangedEffect({ value: 20, long: 80 })).shiftDown)
          .toBe(0);

        const holder = makeActor('common');
        holder.items = [perk(SO_BELOW_ID)];
        game.user.targets.first.mockReturnValue({ actor: holder, center: { x: 0, y: 0 }, document: { elevation: 5 } });
        expect(dice._getAutomaticCombatModifiers(makeElevatedActor(null, 5), rangedEffect({ value: 20, long: 80 })).shiftDown)
          .toBe(0);
      });
    });
  });

  describe("Tactical Triangulation (Enigma of Combination, Hub Focus, Analyst, 6th level, p.29) - its DataBridgeBonus rule", () => {
    const TACTICAL_TRIANGULATION = {
      id: 'tt', name: 'Tactical Triangulation', type: 'perk', flags: { core: { sourceId: "Compendium.essence20.enigma_of_combination.Item.weK6qeL2EmoNQk04" } },
      system: { rules: [{ type: 'DataBridgeBonus', max: 3 }] },
    };

    function makeToken(actor) {
      return { actor, center: { x: 0, y: 0 }, document: { disposition: 1 } };
    }

    function makeTriangulationActor({ hasPerk = true, bridged = true } = {}) {
      const items = hasPerk ? [TACTICAL_TRIANGULATION] : [];
      // Data Bridged: a live bank under key dataBridge (Data Bridge's Use rule - rules/conv16-b.test.js).
      const ruleBank = bridged ? [{ id: 'bridge', key: 'dataBridge', specialize: true, uses: 1, when: ['skill:in:culture'] }] : [];
      const actorToken = { document: { disposition: 1 }, center: { x: 0, y: 0 } };
      return {
        system: { size: 'common' },
        statuses: new Set(),
        items,
        flags: { essence20: { ruleBank } },
        getActiveTokens: jest.fn(() => [actorToken]),
        getFlag: jest.fn(() => undefined),
        unsetFlag: jest.fn(),
      };
    }

    function triangulationEffect(range) {
      return {
        type: 'weaponEffect',
        flags: {},
        system: { classification: { style: 'projectile' }, defenseType: 'toughness', range },
      };
    }

    beforeEach(() => {
      canvas.grid.measurePath.mockReturnValue({ distance: 0 });
      canvas.tokens.placeables = [];
    });

    test("adds ↑1 for a lone Data-Bridged attacker with the Perk", () => {
      canvas.grid.measurePath.mockReturnValue({ distance: 20 });
      const actor = makeTriangulationActor();
      canvas.tokens.placeables = [...actor.getActiveTokens()];
      game.user.targets.first.mockReturnValue(makeToken(makeActor('common')));

      expect(dice._getAutomaticCombatModifiers(actor, triangulationEffect({ value: 20, long: 80 })))
        .toEqual({ ...defaultModifiers, shiftUp: 1, sources: [
          {
            "edge": false,
            "id": "tacticalTriangulation",
            "label": "Tactical Triangulation",
            "shiftDown": 0,
            "shiftUp": 1,
            "snag": false,
          },
        ] });
    });

    test("adds ↑1 per Data-Bridged ally, capped at ↑3", () => {
      canvas.grid.measurePath.mockReturnValue({ distance: 20 });
      const actor = makeTriangulationActor();
      const actorToken = actor.getActiveTokens()[0];
      const bridgedAlly = () => {
        const token = { document: { disposition: 1 }, center: {} };
        token.actor = { flags: { essence20: { ruleBank: [{ id: 'bridge', key: 'dataBridge', uses: 1, when: [] }] } }, getActiveTokens: () => [token] };
        return token;
      };

      const [bridgedAlly1, bridgedAlly2, bridgedAlly3] = [bridgedAlly(), bridgedAlly(), bridgedAlly()];
      canvas.tokens.placeables = [actorToken, bridgedAlly1, bridgedAlly2, bridgedAlly3];
      game.user.targets.first.mockReturnValue(makeToken(makeActor('common')));

      expect(dice._getAutomaticCombatModifiers(actor, triangulationEffect({ value: 20, long: 80 })).shiftUp).toBe(3);
    });

    test("doesn't apply without the Perk anywhere nearby", () => {
      canvas.grid.measurePath.mockReturnValue({ distance: 20 });
      const actor = makeTriangulationActor({ hasPerk: false });
      canvas.tokens.placeables = [...actor.getActiveTokens()];
      game.user.targets.first.mockReturnValue(makeToken(makeActor('common')));

      expect(dice._getAutomaticCombatModifiers(actor, triangulationEffect({ value: 20, long: 80 })))
        .toEqual(defaultModifiers);
    });

    test("doesn't apply without being Data Bridged", () => {
      canvas.grid.measurePath.mockReturnValue({ distance: 20 });
      const actor = makeTriangulationActor({ bridged: false });
      canvas.tokens.placeables = [...actor.getActiveTokens()];
      game.user.targets.first.mockReturnValue(makeToken(makeActor('common')));

      expect(dice._getAutomaticCombatModifiers(actor, triangulationEffect({ value: 20, long: 80 })))
        .toEqual(defaultModifiers);
    });
  });

  test("attacker's own Prone Condition penalizes only melee attacks", () => {
    const actor = makeActor('common', ['prone']);

    expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect))
      .toEqual({ ...defaultModifiers, shiftDown: 1, sources: [
        {
          "edge": false,
          "id": "selfProne",
          "label": "E20.StatusProne",
          "shiftDown": 1,
          "shiftUp": 0,
          "snag": false,
        },
      ] });
    expect(dice._getAutomaticCombatModifiers(actor, rangedWeaponEffect))
      .toEqual(defaultModifiers);
  });

  test("Edge and Snag from separate sources both surface, left to cancel out downstream", () => {
    game.user.targets.first.mockReturnValue({ actor: makeActor('common', ['invisible', 'stunned']) });
    const actor = makeActor('common');

    expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect))
      .toEqual({ ...defaultModifiers, edge: true, snag: true, sources: [
        {
          "edge": true,
          "id": "targetStunned",
          "label": "E20.StatusStunned",
          "shiftDown": 0,
          "shiftUp": 0,
          "snag": false,
        },
        {
          "edge": false,
          "id": "targetInvisible",
          "label": "E20.StatusInvisible",
          "shiftDown": 0,
          "shiftUp": 0,
          "snag": true,
        },
      ] });
  });

  describe("Exterminator (Decepticon Directive, General Perk, p.65)", () => {
    const EXTERMINATOR_ID = "Compendium.essence20.decepticon_directive.Item.B5HgQeurLyvio1t7";

    function makeSizedActor(size, perkIds = []) {
      return makeActor(size, [], { perkIds });
    }

    // Sizes below are all deliberately ADJACENT on E20.actorSizes' own ladder (common/small,
    // common/large) so the pre-existing generic Size Class Combat Adjustment (_getSizeShift,
    // Math.floor(distance/2)) is always 0 and doesn't confound Exterminator's own +1 - a real
    // gotcha caught while writing this: the first draft used non-adjacent sizes (large vs. small,
    // huge vs. large) and got tripped up by that unrelated generic modifier also firing.
    test("marks the roll (smallerTarget reroll) against a smaller Common/Small target - the ↑1 is an item rule", () => {
      game.user.targets.first.mockReturnValue({ actor: makeSizedActor('small') });
      const actor = makeSizedActor('common', [EXTERMINATOR_ID]);

      const result = dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect);

      expect(result.shiftUp).toBe(0);
      expect(result.exterminatorEligible).toBe(true);
    });

    test("doesn't apply against a same-size Small target (not actually smaller)", () => {
      game.user.targets.first.mockReturnValue({ actor: makeSizedActor('small') });
      const actor = makeSizedActor('small', [EXTERMINATOR_ID]);

      expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect)).toEqual(defaultModifiers);
    });

    test("doesn't apply against a Large target, even if smaller than the actor", () => {
      game.user.targets.first.mockReturnValue({ actor: makeSizedActor('large') });
      const actor = makeSizedActor('common', [EXTERMINATOR_ID]);

      expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect)).toEqual(defaultModifiers);
    });

    test("doesn't apply without the Perk", () => {
      game.user.targets.first.mockReturnValue({ actor: makeSizedActor('small') });
      const actor = makeSizedActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect)).toEqual(defaultModifiers);
    });
  });

  describe("Mysterious Aura - Resplendent (A Jump Through Time, White Spectrum Modification, replaces Follow Me!, p.45)", () => {
    const rangedWeaponEffectHere = {
      type: 'weaponEffect',
      system: { classification: { style: 'ranged' }, defenseType: 'toughness' },
    };

    function makeResplendentTarget(aura) {
      return { ...makeActor('common'), getFlag: jest.fn((scope, key) => (key == 'mysteriousAuraActive' ? aura : undefined)) };
    }

    test("downshifts a ranged Attack against a target with Resplendent active", () => {
      game.user.targets.first.mockReturnValue({ actor: makeResplendentTarget({ type: 'resplendent' }) });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, rangedWeaponEffectHere)).toEqual({
        ...defaultModifiers, shiftDown: 1, sources: [
          {
            "edge": false,
            "id": "mysteriousAuraResplendent",
            "label": "Mysterious Aura (Resplendent)",
            "shiftDown": 1,
            "shiftUp": 0,
            "snag": false,
          },
        ],
      });
    });

    test("doesn't apply to a melee Attack, a different aura, or with nothing active", () => {
      game.user.targets.first.mockReturnValue({ actor: makeResplendentTarget({ type: 'resplendent' }) });
      const actor = makeActor('common');
      expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect)).toEqual(defaultModifiers);

      game.user.targets.first.mockReturnValue({ actor: makeResplendentTarget({ type: 'imposing' }) });
      expect(dice._getAutomaticCombatModifiers(actor, rangedWeaponEffectHere)).toEqual(defaultModifiers);

      game.user.targets.first.mockReturnValue({ actor: makeResplendentTarget(null) });
      expect(dice._getAutomaticCombatModifiers(actor, rangedWeaponEffectHere)).toEqual(defaultModifiers);
    });
  });

  describe("Lance of Light (A Jump Through Time, General Perk, p.55) - Resistance to Energy", () => {
    const fireWeaponEffect = {
      type: 'weaponEffect',
      system: { classification: { style: 'melee' }, defenseType: 'toughness', damageType: 'fire' },
    };

    function makeLanceOfLightTarget({ active = false } = {}) {
      return {
        ...makeActor('common'),
        getFlag: jest.fn((scope, key) => (key == 'lanceOfLightActive' ? active : undefined)),
      };
    }

    test("imposes the ordinary Resistance Snag on an Energy attack while active", () => {
      game.user.targets.first.mockReturnValue({ actor: makeLanceOfLightTarget({ active: true }) });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, fireWeaponEffect)).toEqual({
        ...defaultModifiers, snag: true, sources: [
          {
            "edge": false,
            "id": "resistance",
            "label": "E20.CombatModifierResistance",
            "shiftDown": 0,
            "shiftUp": 0,
            "snag": true,
          },
        ],
      });
    });

    test("doesn't apply without the toggle active, or on a non-Energy damage type", () => {
      game.user.targets.first.mockReturnValue({ actor: makeLanceOfLightTarget({ active: false }) });
      const actor = makeActor('common');
      expect(dice._getAutomaticCombatModifiers(actor, fireWeaponEffect)).toEqual(defaultModifiers);

      const sharpWeaponEffect = {
        type: 'weaponEffect',
        system: { classification: { style: 'melee' }, defenseType: 'toughness', damageType: 'sharp' },
      };
      game.user.targets.first.mockReturnValue({ actor: makeLanceOfLightTarget({ active: true }) });
      expect(dice._getAutomaticCombatModifiers(actor, sharpWeaponEffect)).toEqual(defaultModifiers);
    });
  });

  describe("Electromagnetic vs. Computerized (GI Joe CRB, Damage Types p.207 + Computerized Vehicle Trait p.173)", () => {
    const empWeaponEffect = { ...meleeWeaponEffect, system: { ...meleeWeaponEffect.system, damageType: 'emp' } };
    const fireWeaponEffect = { ...meleeWeaponEffect, system: { ...meleeWeaponEffect.system, damageType: 'fire' } };

    function makeComputerizedTarget() {
      const target = makeActor('vehicle');
      target.system = { ...target.system, traits: { computerized: true } };
      return target;
    }

    test("grants ↑3 against a Computerized target", () => {
      game.user.targets.first.mockReturnValue({ actor: makeComputerizedTarget() });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, empWeaponEffect))
        .toEqual({ ...defaultModifiers, shiftUp: 3, sources: [
          {
            "edge": false,
            "id": "electromagneticVsComputerized",
            "label": "E20.DamageEmp",
            "shiftDown": 0,
            "shiftUp": 3,
            "snag": false,
          },
        ] });
    });

    test("imposes ↓3 against a non-Computerized target", () => {
      game.user.targets.first.mockReturnValue({ actor: makeActor('common') });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, empWeaponEffect))
        .toEqual({ ...defaultModifiers, shiftDown: 3, sources: [
          {
            "edge": false,
            "id": "electromagneticVsComputerized",
            "label": "E20.DamageEmp",
            "shiftDown": 3,
            "shiftUp": 0,
            "snag": false,
          },
        ] });
    });

    test("doesn't apply to a non-EMP attack", () => {
      game.user.targets.first.mockReturnValue({ actor: makeComputerizedTarget() });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, fireWeaponEffect)).toEqual(defaultModifiers);
    });
  });

  describe("Fragile (GI Joe CRB, Vehicle Trait, p.301) - Ram vs. Fragile ↑1", () => {
    const ramWeaponEffect = { ...meleeWeaponEffect, system: { ...meleeWeaponEffect.system, isRam: true } };

    function makeFragileTarget() {
      const target = makeActor('vehicle');
      target.system = { ...target.system, traits: { fragile: true } };
      return target;
    }

    test("grants ↑1 when ramming a Fragile target", () => {
      game.user.targets.first.mockReturnValue({ actor: makeFragileTarget() });
      const actor = makeActor('vehicle');

      expect(dice._getAutomaticCombatModifiers(actor, ramWeaponEffect))
        .toEqual({ ...defaultModifiers, shiftUp: 1, sources: [
          {
            "edge": false,
            "id": "rammingFragileVehicle",
            "label": "E20.VehicleTraitFragile",
            "shiftDown": 0,
            "shiftUp": 1,
            "snag": false,
          },
        ] });
    });

    test("doesn't apply against a non-Fragile target", () => {
      game.user.targets.first.mockReturnValue({ actor: makeActor('vehicle') });
      const actor = makeActor('vehicle');

      expect(dice._getAutomaticCombatModifiers(actor, ramWeaponEffect)).toEqual(defaultModifiers);
    });

    test("doesn't apply from a non-Ram attack", () => {
      game.user.targets.first.mockReturnValue({ actor: makeFragileTarget() });
      const actor = makeActor('vehicle');

      expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect)).toEqual(defaultModifiers);
    });
  });

  describe("Accurate / Inaccurate (standard weapon traits, all game lines)", () => {
    // _getParentWeapon resolves the parent via this flag, so an attack fixture needs one to have
    // any parent weapon at all.
    const attack = { ...meleeWeaponEffect, flags: { essence20: { parentId: 'weapon1' } } };

    function source(id, label, shift) {
      return { edge: false, id, label, shiftDown: 0, shiftUp: 0, snag: false, ...shift };
    }

    function makeWielder(traits) {
      return makeActor('common', [], { weapon: { system: { traits } } });
    }

    test("an Accurate weapon grants ↑1", () => {
      expect(dice._getAutomaticCombatModifiers(makeWielder(['accurate']), attack))
        .toEqual({ ...defaultModifiers, shiftUp: 1, sources: [
          source('accurateWeapon', 'E20.WeaponTraitAccurate', { shiftUp: 1 }),
        ] });
    });

    test("an Inaccurate weapon imposes ↓1", () => {
      expect(dice._getAutomaticCombatModifiers(makeWielder(['inaccurate']), attack))
        .toEqual({ ...defaultModifiers, shiftDown: 1, sources: [
          source('inaccurateWeapon', 'E20.WeaponTraitInaccurate', { shiftDown: 1 }),
        ] });
    });

    test("a weapon carrying both nets to zero, listing each as its own source", () => {
      // Horseman's Lance (A Jump Through Time) genuinely ships with both traits.
      expect(dice._getAutomaticCombatModifiers(makeWielder(['accurate', 'inaccurate']), attack))
        .toEqual({ ...defaultModifiers, shiftUp: 1, shiftDown: 1, sources: [
          source('accurateWeapon', 'E20.WeaponTraitAccurate', { shiftUp: 1 }),
          source('inaccurateWeapon', 'E20.WeaponTraitInaccurate', { shiftDown: 1 }),
        ] });
    });

    test("a weapon with neither trait is unaffected", () => {
      expect(dice._getAutomaticCombatModifiers(makeWielder(['ballistic']), attack))
        .toEqual(defaultModifiers);
    });

    test("doesn't apply to an attack with no parent weapon", () => {
      expect(dice._getAutomaticCombatModifiers(makeWielder(['accurate']), meleeWeaponEffect))
        .toEqual(defaultModifiers);
    });

    test("doesn't apply to a non-attack roll", () => {
      expect(dice._getAutomaticCombatModifiers(makeWielder(['accurate']), null))
        .toEqual(defaultModifiers);
    });

    function makeWielderWithMagnitude(traits, magnitudes) {
      return makeActor('common', [], { weapon: { system: { traits, ...magnitudes } } });
    }

    test("Inaccurate honours a higher printed magnitude (Cannonade/Catapult's ↓2)", () => {
      const wielder = makeWielderWithMagnitude(['inaccurate'], { inaccurateMagnitude: 2 });
      expect(dice._getAutomaticCombatModifiers(wielder, attack))
        .toEqual({ ...defaultModifiers, shiftDown: 2, sources: [
          source('inaccurateWeapon', 'E20.WeaponTraitInaccurate', { shiftDown: 2 }),
        ] });
    });

    test("Inaccurate honours an even higher magnitude (Transdagger Star Formation's ↓3)", () => {
      const wielder = makeWielderWithMagnitude(['inaccurate'], { inaccurateMagnitude: 3 });
      expect(dice._getAutomaticCombatModifiers(wielder, attack))
        .toEqual({ ...defaultModifiers, shiftDown: 3, sources: [
          source('inaccurateWeapon', 'E20.WeaponTraitInaccurate', { shiftDown: 3 }),
        ] });
    });

    test("Accurate likewise honours a non-default magnitude", () => {
      const wielder = makeWielderWithMagnitude(['accurate'], { accurateMagnitude: 2 });
      expect(dice._getAutomaticCombatModifiers(wielder, attack))
        .toEqual({ ...defaultModifiers, shiftUp: 2, sources: [
          source('accurateWeapon', 'E20.WeaponTraitAccurate', { shiftUp: 2 }),
        ] });
    });

    test("falls back to 1 when the magnitude field is unset (existing compendium weapons)", () => {
      const wielder = makeWielderWithMagnitude(['inaccurate'], {});
      expect(dice._getAutomaticCombatModifiers(wielder, attack))
        .toEqual({ ...defaultModifiers, shiftDown: 1, sources: [
          source('inaccurateWeapon', 'E20.WeaponTraitInaccurate', { shiftDown: 1 }),
        ] });
    });
  });

  describe("Martial Artist (PR CRB p.70 / GI Joe CRB p.50, Hang-Up)", () => {
    test.each([
      "Compendium.essence20.pr_crb.Item.hXKy7kWGic6wSge9",
      "Compendium.essence20.gi_joe_crb.Item.rIIL4yvym7KUCUyH",
    ])("no automatic Edge on Social tests at the holder - it's a Roll Options Dialog switch (%s)", (id) => {
      const target = makeActor('common');
      target.items.push({ type: 'hangUp', flags: { core: { sourceId: id } } });
      game.user.targets.first.mockReturnValue({ actor: target });

      expect(dice._getAutomaticCombatModifiers(makeActor('common'), null, 'social', 'persuasion')).toEqual(defaultModifiers);
    });
  });

  describe("Shadow (GI Joe CRB, Infiltrator Focus, p.75) - reciprocal Infiltrating check", () => {
    const SHADOW_ID = "Compendium.essence20.gi_joe_crb.Item.PDiRwnTcNCtzJbDn";

    test("Shadow: no automatic ↓2 - it's an incoming Roll Options Dialog switch (an item rule)", () => {
      const target = makeActor('common');
      target.items.push({ type: 'perk', flags: { core: { sourceId: SHADOW_ID } } });
      target.getFlag = jest.fn((scope, key) => (key == 'infiltratingActive' ? true : undefined));
      game.user.targets.first.mockReturnValue({ actor: target });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, null, null, 'perception')).toEqual(defaultModifiers);
    });
  });

  describe("Grappling's own Size downshift (GI Joe CRB, Chapter 9: Combat, p.200) / Jacket Wrestler (Factions in Action Vol. 2, Arashikage General Perk, p.32)", () => {
    // Jacket Wrestler's rule: immune: ["grappleSizeDownshift"] (rules/plugins/rolls/immunity-kinds.mjs).
    const JACKET_WRESTLER = {
      id: 'jw', name: 'Jacket Wrestler', type: 'perk', flags: { core: { sourceId: "Compendium.essence20.intercontinental_adventures.Item.59masYwRaPC1AuhQ" } },
      system: { rules: [{ type: 'RollModifier', immune: ['grappleSizeDownshift'], when: ['item:damageType:grapple'] }] },
    };
    const grappleWeaponEffect = {
      type: 'weaponEffect',
      system: { classification: { style: 'melee' }, defenseType: 'evasion', damageType: 'grapple' },
    };

    test("downshifts a Grapple attack against a larger target, capped at 2", () => {
      // common(1) vs long(3), diff 2 - right at the cap.
      game.user.targets.first.mockReturnValue({ actor: makeActor('long') });
      const actor = makeActor('common');

      const result = dice._getAutomaticCombatModifiers(actor, grappleWeaponEffect);
      expect(result.shiftDown).toBe(2);
      expect(result.sources.some(s => s.id == 'grappleSize')).toBe(true);
    });

    test("caps the downshift at 2 even when the target is more than 2 Size Classes larger", () => {
      game.user.targets.first.mockReturnValue({ actor: makeActor('titanic') }); // small(0) -> titanic(10)
      const actor = makeActor('small');

      expect(dice._getAutomaticCombatModifiers(actor, grappleWeaponEffect).shiftDown).toBe(2);
    });

    test("doesn't downshift against a same-size or smaller target, or a non-Grapple attack", () => {
      game.user.targets.first.mockReturnValue({ actor: makeActor('common') });
      expect(dice._getAutomaticCombatModifiers(makeActor('common'), grappleWeaponEffect).shiftDown).toBe(0);

      game.user.targets.first.mockReturnValue({ actor: makeActor('small') });
      expect(dice._getAutomaticCombatModifiers(makeActor('common'), grappleWeaponEffect).shiftDown).toBe(0);

      game.user.targets.first.mockReturnValue({ actor: makeActor('long') });
      expect(dice._getAutomaticCombatModifiers(makeActor('common'), meleeWeaponEffect).shiftDown).toBe(0);
    });

    test("Jacket Wrestler suppresses the downshift entirely", () => {
      game.user.targets.first.mockReturnValue({ actor: makeActor('long') });
      const actor = makeActor('common');
      actor.items = Object.assign([JACKET_WRESTLER], { get: () => null });

      const result = dice._getAutomaticCombatModifiers(actor, grappleWeaponEffect);
      expect(result.shiftDown).toBe(0);
      expect(result.sources.some(s => s.id == 'grappleSize')).toBe(false);
    });
  });

  describe("Covering Fire's own Snag consumption (Transformers CRB, Gunner base, 2nd level, p.68)", () => {
    test("applies a Snag on the banked actor's own next Attack", () => {
      const actor = makeActor('common');
      actor.getFlag = jest.fn((scope, key) => (key == 'pendingCoveringFireSnag' ? { snag: true } : undefined));

      expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect))
        .toEqual({ ...defaultModifiers, snag: true, pendingBonusesToClear: ['pendingCoveringFireSnag'], sources: [
          {
            "edge": false,
            "id": "coveringFireSnag",
            "label": "Covering Fire",
            "shiftDown": 0,
            "shiftUp": 0,
            "snag": true,
          },
        ] });
    });

    test("doesn't apply to a plain Skill Test - Attack-gated, per RAW's own \"if they attack\"", () => {
      const actor = makeActor('common');
      actor.getFlag = jest.fn((scope, key) => (key == 'pendingCoveringFireSnag' ? { snag: true } : undefined));

      expect(dice._getAutomaticCombatModifiers(actor, null)).toEqual(defaultModifiers);
    });

    test("doesn't apply with no pending bank at all", () => {
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect)).toEqual(defaultModifiers);
    });
  });

  describe("Invisible (GI Joe CRB Conditions, p.226) - the attacker-side half of a core rule", () => {
    function makeInvisibleAttacker() {
      return makeActor('common', ['invisible']);
    }

    // RAW: "all attack tests made by an Invisible character gain Edge" - the counterpart Snag
    // against them was already implemented; this half was not.
    test("an Invisible character's own attack gains Edge", () => {
      game.user.targets.first.mockReturnValue(undefined);

      expect(dice._getAutomaticCombatModifiers(makeInvisibleAttacker(), meleeWeaponEffect))
        .toEqual({ ...defaultModifiers, edge: true, sources: [
          { id: 'selfInvisible', label: 'E20.StatusInvisible', edge: true, shiftUp: 0, shiftDown: 0, snag: false },
        ] });
    });

    // RAW says "attack tests" - being unseen is not a general bonus.
    test("no Edge on an ordinary Skill Test", () => {
      game.user.targets.first.mockReturnValue(undefined);

      expect(dice._getAutomaticCombatModifiers(makeInvisibleAttacker(), null, 'social'))
        .toEqual(defaultModifiers);
    });

    test("a visible attacker gets nothing", () => {
      game.user.targets.first.mockReturnValue(undefined);

      expect(dice._getAutomaticCombatModifiers(makeActor('common'), meleeWeaponEffect))
        .toEqual(defaultModifiers);
    });
  });

  describe("Emotional Mastery: Disgust (A Jump Through Time, Purple Ranger, p.37)", () => {
    function makeDisgustTarget({ active = ['disgust'], usedThisTurn = false } = {}) {
      const target = makeActor('common');
      target.getFlag = jest.fn((scope, key) => {
        if (key == 'activeEmotionalMastery') {
          return active;
        }

        if (key == 'disgustUsedThisTurn' && usedThisTurn) {
          return { combatId: 'combat1', round: 1, turn: 0 };
        }

        return undefined;
      });
      return target;
    }

    beforeEach(() => {
      game.combat = { id: 'combat1', round: 1, turn: 0 };
    });

    afterEach(() => {
      game.combat = null;
    });

    test("downshifts the first Skill Test to target the holder each turn, even a plain (non-Attack) roll", () => {
      const target = makeDisgustTarget();
      game.user.targets.first.mockReturnValue({ actor: target });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, null))
        .toEqual({ ...defaultModifiers, shiftDown: 1, disgustTriggered: true, sources: [
          { id: 'disgust', label: 'Disgust (Emotional Mastery)', edge: false, shiftUp: 0, shiftDown: 1, snag: false },
        ] });
    });

    test("doesn't apply again the same turn once already triggered", () => {
      const target = makeDisgustTarget({ usedThisTurn: true });
      game.user.targets.first.mockReturnValue({ actor: target });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, null)).toEqual(defaultModifiers);
    });

    test("doesn't apply without Disgust active", () => {
      const target = makeDisgustTarget({ active: ['fear'] });
      game.user.targets.first.mockReturnValue({ actor: target });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, null)).toEqual(defaultModifiers);
    });

    test("doesn't apply outside of combat", () => {
      game.combat = null;
      const target = makeDisgustTarget();
      game.user.targets.first.mockReturnValue({ actor: target });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, null)).toEqual(defaultModifiers);
    });
  });

  describe("Emotional Mastery: Contempt - Resistance-Snag check (A Jump Through Time, Purple Ranger, p.37)", () => {
    function makeContemptTarget({ active = ['contempt'], damageType = 'fire' } = {}) {
      const target = makeActor('common');
      target.getFlag = jest.fn((scope, key) => {
        if (key == 'activeEmotionalMastery') {
          return active;
        }

        if (key == 'contemptDamageType') {
          return damageType;
        }

        return undefined;
      });
      return target;
    }

    test("imposes a Snag on an attack of the chosen damage type while active", () => {
      const target = makeContemptTarget();
      game.user.targets.first.mockReturnValue({ actor: target });
      const actor = makeActor('common');
      const fireWeaponEffect = { ...meleeWeaponEffect, system: { ...meleeWeaponEffect.system, damageType: 'fire' } };

      expect(dice._getAutomaticCombatModifiers(actor, fireWeaponEffect))
        .toEqual({ ...defaultModifiers, snag: true, sources: [
          { id: 'resistance', label: 'E20.CombatModifierResistance', edge: false, shiftUp: 0, shiftDown: 0, snag: true },
        ] });
    });

    test("doesn't apply to a different damage type", () => {
      const target = makeContemptTarget({ damageType: 'fire' });
      game.user.targets.first.mockReturnValue({ actor: target });
      const actor = makeActor('common');
      const coldWeaponEffect = { ...meleeWeaponEffect, system: { ...meleeWeaponEffect.system, damageType: 'cold' } };

      expect(dice._getAutomaticCombatModifiers(actor, coldWeaponEffect)).toEqual(defaultModifiers);
    });

    test("doesn't apply without Contempt active", () => {
      const target = makeContemptTarget({ active: ['fear'] });
      game.user.targets.first.mockReturnValue({ actor: target });
      const actor = makeActor('common');
      const fireWeaponEffect = { ...meleeWeaponEffect, system: { ...meleeWeaponEffect.system, damageType: 'fire' } };

      expect(dice._getAutomaticCombatModifiers(actor, fireWeaponEffect)).toEqual(defaultModifiers);
    });
  });

  describe("Emotional Mastery: Shame - consuming the banked shiftUp on the holder's own next roll", () => {
    function makeActorWithPendingShame(pending) {
      const actor = makeActor('common');
      actor.getFlag = jest.fn((scope, key) => (
        scope == 'essence20' && key == 'pendingEmotionalMasteryShame' ? pending : undefined
      ));
      return actor;
    }

    test("grants the banked shiftUp and reports the flag to clear", () => {
      const actor = makeActorWithPendingShame({ shiftUp: 2, combatId: null, round: null });

      expect(dice._getAutomaticCombatModifiers(actor, null))
        .toEqual({ ...defaultModifiers, shiftUp: 2, pendingBonusesToClear: ['pendingEmotionalMasteryShame'], sources: [
          {
            "edge": false,
            "id": "emotionalMasteryShame",
            "label": "Shame (Emotional Mastery)",
            "shiftDown": 0,
            "shiftUp": 2,
            "snag": false,
          },
        ] });
    });

    test("an actor without the flag is unaffected", () => {
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, null)).toEqual(defaultModifiers);
    });
  });

  describe("Time To Think / Plan of Action, consuming a pending banked bonus", () => {
    function makeActorWithPending(flags = {}) {
      const actor = makeActor('common');
      actor.getFlag = jest.fn((scope, key) => (scope == 'essence20' ? flags[key] : undefined));
      return actor;
    }

    test("a stale bonus from a finished combat doesn't apply", () => {
      game.combat = { id: 'newCombat', round: 1 };
      const actor = makeActorWithPending({ pendingImpulsive: { shiftDown: 1, combatId: 'oldCombat', round: 3 } });

      expect(dice._getAutomaticCombatModifiers(actor, null)).toEqual(defaultModifiers);
      game.combat = null;
    });

    test("an actor with no pending bonus at all is unaffected", () => {
      const actor = makeActor('common');
      expect(dice._getAutomaticCombatModifiers(actor, null)).toEqual(defaultModifiers);
    });

    // (Rush the Line's melee Edge is a rule bank now - rules/conv17-split3.test.js.)

    test("Impulsive (Transformers CRB, Hang-Up, p.42) applies its own banked shiftDown on any Skill Test and reports the flag to clear", () => {
      const actor = makeActorWithPending({ pendingImpulsive: { shiftDown: 1, combatId: null, round: null } });

      expect(dice._getAutomaticCombatModifiers(actor, null, null, 'athletics')).toEqual({
        ...defaultModifiers, shiftDown: 1, pendingBonusesToClear: ['pendingImpulsive'],
        sources: [{ id: 'impulsive', label: 'Impulsive', shiftUp: 0, shiftDown: 1, edge: false, snag: false }],
      });
    });

    // Dead-code removal 2026-10-06: nothing ever banked pendingAngrySnag - the Angry Hang-Up's Snag is a rule on it
    // (the Perk's pick, kept as the angrySnag mark).
    test("the never-banked pendingAngrySnag flag isn't read", () => {
      const actor = makeActorWithPending({
        pendingAngrySnag: { skill: 'deception', combatId: null, round: null },
      });

      expect(dice._getAutomaticCombatModifiers(actor, null, null, 'deception')).toEqual(defaultModifiers);
    });

    // Harass is a roll source now (items/attacks/harass.mjs: Edge on every attack until the start of the
    // holder's next turn), so a leftover banked flag no longer does anything here.
    test("a leftover Harass bank is ignored on an Attack", () => {
      const weaponEffect = {
        type: 'weaponEffect', flags: {},
        system: { classification: { skill: 'might', style: 'melee' }, damageType: 'blunt', damageValue: 1 },
      };
      const actor = makeActorWithPending({ pendingHarassEdge: { edge: true, combatId: null, round: null } });

      expect(dice._getAutomaticCombatModifiers(actor, weaponEffect)).toEqual(defaultModifiers);
    });

    test("Harass does NOT apply to a plain Skill Test (not a weaponEffect Attack), and leaves the bank untouched", () => {
      const actor = makeActorWithPending({ pendingHarassEdge: { edge: true, combatId: null, round: null } });
      expect(dice._getAutomaticCombatModifiers(actor, null)).toEqual(defaultModifiers);
    });

  });

  describe("enemyDownshift Role Points on the target (e.g. Interfering Static)", () => {
    function makeTargetWithRolePoints({ type = 'enemyDownshift', value = 0, isActivatable = false, isActive = false } = {}) {
      const target = makeActor('common');
      target._getBaseRolePoints = jest.fn(() => ({
        system: { bonus: { type, value }, isActivatable, isActive },
      }));

      return target;
    }

    function makeAttackingActor({ type = 'playerCharacter', weaponTraits = null } = {}) {
      const weapon = weaponTraits ? { system: { traits: weaponTraits } } : null;

      return { ...makeActor('common', [], { weapon }), type };
    }

    const weaponEffectWithParent = {
      type: 'weaponEffect',
      flags: { essence20: { parentId: 'weapon1' } },
      system: { classification: { style: 'ranged' }, defenseType: 'toughness' },
    };

    test("downshifts an attack made with a Power Weapon", () => {
      const target = makeTargetWithRolePoints({ value: 2 });
      game.user.targets.first.mockReturnValue({ actor: target });
      const actor = makeAttackingActor({ weaponTraits: ['powerWeapon'] });

      expect(dice._getAutomaticCombatModifiers(actor, weaponEffectWithParent))
        .toEqual({ ...defaultModifiers, shiftDown: 2, sources: [
          {
            "edge": false,
            "id": "enemyDownshift",
            "label": undefined,
            "shiftDown": 2,
            "shiftUp": 0,
            "snag": false,
          },
        ] });
    });

    test("downshifts a Zord's attack even without a Power Weapon", () => {
      const target = makeTargetWithRolePoints({ value: 1 });
      game.user.targets.first.mockReturnValue({ actor: target });
      const actor = makeAttackingActor({ type: 'zord', weaponTraits: ['sharp'] });

      expect(dice._getAutomaticCombatModifiers(actor, weaponEffectWithParent))
        .toEqual({ ...defaultModifiers, shiftDown: 1, sources: [
          {
            "edge": false,
            "id": "enemyDownshift",
            "label": undefined,
            "shiftDown": 1,
            "shiftUp": 0,
            "snag": false,
          },
        ] });
    });

    test("doesn't apply to a non-Power Weapon attack from a non-Zord", () => {
      const target = makeTargetWithRolePoints({ value: 2 });
      game.user.targets.first.mockReturnValue({ actor: target });
      const actor = makeAttackingActor({ weaponTraits: ['sharp'] });

      expect(dice._getAutomaticCombatModifiers(actor, weaponEffectWithParent)).toEqual(defaultModifiers);
    });

    test("doesn't apply when the target's Role Points are Activatable but not Active", () => {
      const target = makeTargetWithRolePoints({ value: 2, isActivatable: true, isActive: false });
      game.user.targets.first.mockReturnValue({ actor: target });
      const actor = makeAttackingActor({ weaponTraits: ['powerWeapon'] });

      expect(dice._getAutomaticCombatModifiers(actor, weaponEffectWithParent)).toEqual(defaultModifiers);
    });

    test("applies when the target's Role Points are Activatable AND Active", () => {
      const target = makeTargetWithRolePoints({ value: 2, isActivatable: true, isActive: true });
      game.user.targets.first.mockReturnValue({ actor: target });
      const actor = makeAttackingActor({ weaponTraits: ['powerWeapon'] });

      expect(dice._getAutomaticCombatModifiers(actor, weaponEffectWithParent))
        .toEqual({ ...defaultModifiers, shiftDown: 2, sources: [
          {
            "edge": false,
            "id": "enemyDownshift",
            "label": undefined,
            "shiftDown": 2,
            "shiftUp": 0,
            "snag": false,
          },
        ] });
    });

    test("doesn't apply for any other Role Points bonus type (e.g. defenseBonus)", () => {
      const target = makeTargetWithRolePoints({ type: 'defenseBonus', value: 2 });
      game.user.targets.first.mockReturnValue({ actor: target });
      const actor = makeAttackingActor({ weaponTraits: ['powerWeapon'] });

      expect(dice._getAutomaticCombatModifiers(actor, weaponEffectWithParent)).toEqual(defaultModifiers);
    });

    test("no-ops when the target has no Role Points at all (e.g. an NPC/Vehicle)", () => {
      const target = makeActor('common'); // no _getBaseRolePoints method, like a plain actor mock
      game.user.targets.first.mockReturnValue({ actor: target });
      const actor = makeAttackingActor({ weaponTraits: ['powerWeapon'] });

      expect(dice._getAutomaticCombatModifiers(actor, weaponEffectWithParent)).toEqual(defaultModifiers);
    });
  });

  describe("Mark Target (Scout, 2nd level, p.84)", () => {
    // The designation is a rule mark on the target (rules/conv15-banked.test.js); the roll reads it via checkMarkTarget.
    function makeMarkingActor() {
      return { ...makeActor('common'), id: 'scout1', uuid: 'Actor.scout1' };
    }

    function markTarget(target) {
      target.flags = { essence20: { ruleMarks: { 'markTarget--scout1': { by: 'Actor.scout1', until: null, stamp: null } } } };
      return target;
    }

    test("grants +1 shiftUp on any Skill Test against the marked target", () => {
      const target = markTarget(makeActor('common'));
      target.uuid = 'Actor.target1';
      game.user.targets.first.mockReturnValue({ actor: target });
      const actor = makeMarkingActor();

      expect(dice._getAutomaticCombatModifiers(actor, null, null, 'athletics'))
        .toEqual({ ...defaultModifiers, shiftUp: 1, sources: [
          {
            "edge": false,
            "id": "markTarget",
            "label": "Mark Target",
            "shiftDown": 0,
            "shiftUp": 1,
            "snag": false,
          },
        ] });
    });

    test("doesn't apply against a target marked by someone else", () => {
      const target = makeActor('common');
      target.uuid = 'Actor.target2';
      target.flags = { essence20: { ruleMarks: { 'markTarget--other': { by: 'Actor.other', until: null, stamp: null } } } };
      game.user.targets.first.mockReturnValue({ actor: target });
      const actor = makeMarkingActor();

      expect(dice._getAutomaticCombatModifiers(actor, null, null, 'athletics')).toEqual(defaultModifiers);
    });

    test("doesn't apply with nothing marked", () => {
      const target = makeActor('common');
      target.uuid = 'Actor.target1';
      game.user.targets.first.mockReturnValue({ actor: target });
      const actor = makeMarkingActor();

      expect(dice._getAutomaticCombatModifiers(actor, null, null, 'athletics')).toEqual(defaultModifiers);
    });
  });

  describe("Primary Quarry (Decepticon Directive, Tracker Focus, 1st level, p.55)", () => {
    function makeQuarryActor(quarryUuid) {
      const actor = makeActor('common');
      actor.getFlag = jest.fn((scope, key) => (
        scope == 'essence20' && key == 'primaryQuarryUuid' ? quarryUuid : undefined
      ));

      return actor;
    }

    test("grants +1 shiftUp on any Skill Test against the designated Primary Quarry", () => {
      const target = makeActor('common');
      target.uuid = 'Actor.target1';
      game.user.targets.first.mockReturnValue({ actor: target });
      const actor = makeQuarryActor('Actor.target1');

      expect(dice._getAutomaticCombatModifiers(actor, null, null, 'athletics'))
        .toEqual({ ...defaultModifiers, shiftUp: 1, sources: [
          {
            "edge": false,
            "id": "primaryQuarry",
            "label": "Primary Quarry",
            "shiftDown": 0,
            "shiftUp": 1,
            "snag": false,
          },
        ] });
    });

    test("doesn't apply against a different target", () => {
      const target = makeActor('common');
      target.uuid = 'Actor.target2';
      game.user.targets.first.mockReturnValue({ actor: target });
      const actor = makeQuarryActor('Actor.target1');

      expect(dice._getAutomaticCombatModifiers(actor, null, null, 'athletics')).toEqual(defaultModifiers);
    });

    test("doesn't apply with nothing designated", () => {
      const target = makeActor('common');
      target.uuid = 'Actor.target1';
      game.user.targets.first.mockReturnValue({ actor: target });
      const actor = makeQuarryActor(undefined);

      expect(dice._getAutomaticCombatModifiers(actor, null, null, 'athletics')).toEqual(defaultModifiers);
    });

    test("stacks with Mark Target on the same target", () => {
      const target = makeActor('common');
      target.uuid = 'Actor.target1';
      game.user.targets.first.mockReturnValue({ actor: target });
      const actor = { ...makeQuarryActor('Actor.target1'), id: 'scout1', uuid: 'Actor.scout1' };
      target.flags = { essence20: { ruleMarks: { 'markTarget--scout1': { by: 'Actor.scout1', until: null, stamp: null } } } };

      expect(dice._getAutomaticCombatModifiers(actor, null, null, 'athletics').shiftUp).toBe(2);
    });
  });

  // Revengeful's ↑1 against whoever hurt you is a RollModifier rule on its Perk (rules/conv10-slE10.test.js).

  describe("Spot (Weapon Effects and Traits) - Edge grant against a spotted target", () => {
    function makeSpottedTarget(spotted) {
      const target = makeActor('common');
      target.getFlag = jest.fn((scope, key) => (
        scope == 'essence20' && key == 'spotted' ? spotted : undefined
      ));

      return target;
    }

    test("grants an Edge on an attack against a spotted target, and reports it for consumption", () => {
      const target = makeSpottedTarget(true);
      game.user.targets.first.mockReturnValue({ actor: target });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect))
        .toEqual({ ...defaultModifiers, edge: true, spottedTarget: target, sources: [
          {
            "edge": true,
            "id": "spot",
            "label": "E20.DamageSpot",
            "shiftDown": 0,
            "shiftUp": 0,
            "snag": false,
          },
        ] });
    });

    test("doesn't apply to a target that hasn't been spotted", () => {
      const target = makeSpottedTarget(false);
      game.user.targets.first.mockReturnValue({ actor: target });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect)).toEqual(defaultModifiers);
    });

    test("doesn't apply to a plain Skill Test (Spot is attack-only)", () => {
      const target = makeSpottedTarget(true);
      game.user.targets.first.mockReturnValue({ actor: target });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, null)).toEqual(defaultModifiers);
    });
  });

});

/* _rollSkillHelper - Power Infusion banked reroll consumption */
describe("_rollSkillHelper banked reroll (Power Infusion)", () => {
  class FakeDie {
    constructor(faces, results) {
      this.faces = faces;
      this.results = results.map(r => ({ ...r }));
      this.reroll = jest.fn(async () => {});
    }
    get values() {
      return this.results.filter(r => r.active).map(r => r.result);
    }
  }

  class FakeRoll {
    constructor() {
      this.dice = [new FakeDie(8, [{ result: 1, active: true }])];
      this._total = FakeRoll.nextTotal ?? 10;
    }
    async evaluate() {}
    get total() {
      return this._total;
    }
    _evaluateTotal() {
      return this._total;
    }
    async render() {
      return '<div></div>';
    }
  }

  let originalRoll;
  let originalFoundry;
  let originalGameSettings;
  // A fresh instance, not the shared `dice` above - many earlier tests in this file do
  // `dice._rollSkillHelper = jest.fn()`, which permanently shadows the real method on that one
  // shared instance for the rest of the file's run. These tests need the real implementation.
  let freshDice;

  beforeAll(() => {
    originalRoll = global.Roll;
    originalFoundry = global.foundry;
    originalGameSettings = global.game.settings;
    global.foundry = {
      ...global.foundry,
      applications: { handlebars: { renderTemplate: jest.fn(async () => '') } },
    };
    global.game.settings = { get: jest.fn(() => 'roll') };
    freshDice = new Dice(chatMessage, createMockRollDialog(), new Mocki18n());
  });

  afterAll(() => {
    global.Roll = originalRoll;
    global.foundry = originalFoundry;
    global.game.settings = originalGameSettings;
  });

  function makeBankedActor(hasBankedReroll = true) {
    const flags = hasBankedReroll ? { bankedReroll: { values: [1], source: 'Power Infusion' } } : {};
    return {
      getRollData: () => ({}),
      getFlag: jest.fn((scope, key) => flags[key]),
      unsetFlag: jest.fn(async (scope, key) => {
        delete flags[key];
      }),
      _flags: flags,
    };
  }

  const attackCheckContext = {
    entries: [{ name: 'Target', targetUuid: 'Actor.t1', difficulty: 15, showDifficulty: true }],
    damageValue: null,
    damageType: null,
    effectName: 'Zeo Power Clubs Effect', // only set for a real weaponEffect attack
    alternateEffects: [],
  };

  test("no banked charge: reroll is never touched", async () => {
    global.Roll = FakeRoll;
    FakeRoll.nextTotal = 5; // miss
    const actor = makeBankedActor(false);

    await freshDice._rollSkillHelper('d20 + 0', actor, 'flavor', false, attackCheckContext, {});

    expect(actor.getFlag).toHaveBeenCalledWith('essence20', 'bankedReroll');
    expect(actor.unsetFlag).not.toHaveBeenCalled();
  });

  test("banked charge, attack still misses after the reroll: stays banked", async () => {
    global.Roll = FakeRoll;
    FakeRoll.nextTotal = 5; // below difficulty 15
    const actor = makeBankedActor(true);

    await freshDice._rollSkillHelper('d20 + 0', actor, 'flavor', false, attackCheckContext, {});

    expect(actor.unsetFlag).not.toHaveBeenCalled();
  });

  test("banked charge, attack succeeds: reroll applied and charge consumed", async () => {
    global.Roll = FakeRoll;
    FakeRoll.nextTotal = 20; // above difficulty 15
    const actor = makeBankedActor(true);

    await freshDice._rollSkillHelper('d20 + 0', actor, 'flavor', false, attackCheckContext, {});

    expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'bankedReroll');
  });

  test("banked charge is ignored on a non-attack (flat Difficulty) check", async () => {
    global.Roll = FakeRoll;
    FakeRoll.nextTotal = 20;
    const actor = makeBankedActor(true);
    const flatCheckContext = { ...attackCheckContext, effectName: null };

    await freshDice._rollSkillHelper('d20 + 0', actor, 'flavor', false, flatCheckContext, {});

    expect(actor.getFlag).not.toHaveBeenCalled();
    expect(actor.unsetFlag).not.toHaveBeenCalled();
  });

  test("stashes rollFailed on the posted message's flags, for MLP 'Cheer' to key off", async () => {
    global.Roll = FakeRoll;
    chatMessage.create.mockClear();

    FakeRoll.nextTotal = 20; // succeeds
    await freshDice._rollSkillHelper('d20 + 0', makeBankedActor(false), 'flavor', false, attackCheckContext, {});
    expect(chatMessage.create.mock.calls[0][0].flags.essence20.rollFailed).toBe(false);

    FakeRoll.nextTotal = 5; // fails (difficulty 15)
    await freshDice._rollSkillHelper('d20 + 0', makeBankedActor(false), 'flavor', false, attackCheckContext, {});
    expect(chatMessage.create.mock.calls[1][0].flags.essence20.rollFailed).toBe(true);
  });

  test("stashes dealtDamage on the posted message's flags, for Suffer! to key off", async () => {
    global.Roll = FakeRoll;
    chatMessage.create.mockClear();
    const damagingCheckContext = { ...attackCheckContext, damageValue: 3, damageType: 'blunt' };

    FakeRoll.nextTotal = 20; // succeeds, and this fixture carries a real damageValue
    await freshDice._rollSkillHelper('d20 + 0', makeBankedActor(false), 'flavor', false, damagingCheckContext, {});
    expect(chatMessage.create.mock.calls[0][0].flags.essence20.dealtDamage).toBe(true);

    FakeRoll.nextTotal = 5; // fails - no damage dealt despite a nonzero damageValue on the entry
    await freshDice._rollSkillHelper('d20 + 0', makeBankedActor(false), 'flavor', false, damagingCheckContext, {});
    expect(chatMessage.create.mock.calls[1][0].flags.essence20.dealtDamage).toBe(false);

    FakeRoll.nextTotal = 20; // succeeds, but this fixture's own damageValue is null (no damage)
    await freshDice._rollSkillHelper('d20 + 0', makeBankedActor(false), 'flavor', false, attackCheckContext, {});
    expect(chatMessage.create.mock.calls[2][0].flags.essence20.dealtDamage).toBe(false);
  });

  describe("Temperamental (Quartermaster's Guide to Gear p.35) - Fumble self-hit", () => {
    class FumbleRoll {
      constructor() {
        this.dice = [new FakeDie(20, [{ result: 1, active: true }])];
        this._total = 1;
      }
      async evaluate() {}
      get total() {
        return this._total;
      }
      async render() {
        return '<div></div>';
      }
    }

    function makeTemperamentalActor() {
      return {
        getRollData: () => ({}),
        getFlag: jest.fn(() => undefined),
        unsetFlag: jest.fn(),
        setFlag: jest.fn(),
        statuses: { has: jest.fn(() => false) },
        items: [],
        system: { health: { value: 10 }, immunities: {} },
        update: jest.fn(),
        toggleStatusEffect: jest.fn(),
      };
    }

    afterEach(() => {
      global.Roll = FakeRoll;
      game.combat = null;
    });

    test("applies the weapon's own effect to the attacker on a Fumble", async () => {
      global.Roll = FumbleRoll;
      const actor = makeTemperamentalActor();
      const checkContext = {
        entries: [{ name: 'Target', targetUuid: 'Actor.t1', difficulty: 10, showDifficulty: true }],
        damageValue: 2, damageType: 'sharp', effectName: 'Kinked Rifle Effect', alternateEffects: [],
        temperamentalWeaponName: 'Kinked Rifle',
      };

      await freshDice._rollSkillHelper('d20 + 0', actor, 'flavor', false, checkContext, {});

      expect(actor.update).toHaveBeenCalledWith({ 'system.health.value': 8 });
      expect(chatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
        content: expect.stringContaining('E20.TemperamentalSelfHit'),
      }));
    });

    test("doesn't apply on a non-Fumble, or without the weapon/upgrade trait", async () => {
      global.Roll = FumbleRoll;
      const actor = makeTemperamentalActor();
      const checkContext = {
        entries: [{ name: 'Target', targetUuid: 'Actor.t1', difficulty: 10, showDifficulty: true }],
        damageValue: 2, damageType: 'sharp', effectName: 'Rifle Effect', alternateEffects: [],
        temperamentalWeaponName: null,
      };

      await freshDice._rollSkillHelper('d20 + 0', actor, 'flavor', false, checkContext, {});

      expect(actor.update).not.toHaveBeenCalled();

      global.Roll = FakeRoll;
      FakeRoll.nextTotal = 20;
      const noFumbleActor = makeTemperamentalActor();
      await freshDice._rollSkillHelper('d20 + 0', noFumbleActor, 'flavor', false, {
        ...checkContext, temperamentalWeaponName: 'Kinked Rifle',
      }, {});
      expect(noFumbleActor.update).not.toHaveBeenCalled();
    });
  });

  describe("Xenotech (Across the Stars, Weapon Traits, p.79) - Critical Success flag", () => {
    class CritRoll {
      constructor() {
        this.dice = [{ faces: 20, values: [15] }, { faces: 8, values: [8] }];
        this._total = 23;
      }
      async evaluate() {}
      get total() {
        return this._total;
      }
      _evaluateTotal() {
        return this._total;
      }
      async render() {
        return '<div></div>';
      }
    }
    class NonCritRoll extends CritRoll {
      constructor() {
        super();
        this.dice = [{ faces: 20, values: [15] }, { faces: 8, values: [3] }];
        this._total = 18;
      }
    }

    function makeActor() {
      return {
        getRollData: () => ({}),
        getFlag: jest.fn(() => undefined),
        unsetFlag: jest.fn(),
      };
    }

    afterEach(() => {
      global.Roll = FakeRoll;
    });

    test("flags the weapon Item on a genuine Critical Success", async () => {
      global.Roll = CritRoll;
      const xenotechWeapon = { setFlag: jest.fn() };
      const checkContext = {
        entries: [{ name: 'Target', targetUuid: 'Actor.t1', difficulty: 10, showDifficulty: true }],
        damageValue: 1, damageType: 'sharp', effectName: 'Xenotech Blade Effect', alternateEffects: [],
        xenotechWeaponToMark: xenotechWeapon,
      };

      await freshDice._rollSkillHelper('d20 + 0', makeActor(), 'flavor', false, checkContext, {});

      expect(xenotechWeapon.setFlag).toHaveBeenCalledWith('essence20', 'xenotechCritted', true);
    });

    test("doesn't flag on a non-Critical hit, or without a weapon to mark", async () => {
      global.Roll = NonCritRoll;
      const xenotechWeapon = { setFlag: jest.fn() };
      const checkContext = {
        entries: [{ name: 'Target', targetUuid: 'Actor.t1', difficulty: 10, showDifficulty: true }],
        damageValue: 1, damageType: 'sharp', effectName: 'Xenotech Blade Effect', alternateEffects: [],
        xenotechWeaponToMark: xenotechWeapon,
      };

      await freshDice._rollSkillHelper('d20 + 0', makeActor(), 'flavor', false, checkContext, {});
      expect(xenotechWeapon.setFlag).not.toHaveBeenCalled();

      global.Roll = CritRoll;
      await freshDice._rollSkillHelper('d20 + 0', makeActor(), 'flavor', false, {
        ...checkContext, xenotechWeaponToMark: null,
      }, {});
      expect(xenotechWeapon.setFlag).not.toHaveBeenCalled();
    });
  });

  describe("Xenotech Components (Across the Stars, Tools of the Trade, p.79) - success flag", () => {
    function makeActor() {
      return { getRollData: () => ({}), getFlag: jest.fn(() => undefined), unsetFlag: jest.fn() };
    }

    test("flags the weapon on a plain success", async () => {
      global.Roll = FakeRoll;
      FakeRoll.nextTotal = 20;
      const componentsWeapon = { getFlag: jest.fn(() => false), setFlag: jest.fn() };
      const checkContext = {
        entries: [{ name: 'Target', targetUuid: 'Actor.t1', difficulty: 10, showDifficulty: true }],
        damageValue: 1, damageType: 'sharp', effectName: 'Rail Blaster Effect', alternateEffects: [],
        componentsWeaponToMark: componentsWeapon,
      };

      await freshDice._rollSkillHelper('d20 + 0', makeActor(), 'flavor', false, checkContext, {});

      expect(componentsWeapon.setFlag).toHaveBeenCalledWith('essence20', 'componentsSucceeded', true);
    });

    test("doesn't flag again once already succeeded, on a miss, or without a weapon to mark", async () => {
      global.Roll = FakeRoll;
      FakeRoll.nextTotal = 20;
      const alreadySucceeded = { getFlag: jest.fn(() => true), setFlag: jest.fn() };
      await freshDice._rollSkillHelper('d20 + 0', makeActor(), 'flavor', false, {
        entries: [{ name: 'Target', targetUuid: 'Actor.t1', difficulty: 10, showDifficulty: true }],
        damageValue: 1, damageType: 'sharp', effectName: 'Rail Blaster Effect', alternateEffects: [],
        componentsWeaponToMark: alreadySucceeded,
      }, {});
      expect(alreadySucceeded.setFlag).not.toHaveBeenCalled();

      FakeRoll.nextTotal = 5;
      const missWeapon = { getFlag: jest.fn(() => false), setFlag: jest.fn() };
      await freshDice._rollSkillHelper('d20 + 0', makeActor(), 'flavor', false, {
        entries: [{ name: 'Target', targetUuid: 'Actor.t1', difficulty: 10, showDifficulty: true }],
        damageValue: 1, damageType: 'sharp', effectName: 'Rail Blaster Effect', alternateEffects: [],
        componentsWeaponToMark: missWeapon,
      }, {});
      expect(missWeapon.setFlag).not.toHaveBeenCalled();
    });
  });

  // Revengeful's "who hurt me" mark is a targeted Trigger rule on its Perk (rules/conv10-slE10.test.js).

  describe("Phantom Suite (Across the Stars, Phantom Ranger, 1st level, p.60) - auto-deactivation", () => {
    function makePhantomSuiteTargetActor({ active = true } = {}) {
      const flagStore = { phantomSuiteActive: active };
      return {
        name: 'Target',
        system: { stun: { value: 0 }, health: { value: 5, max: 5 }, immunities: {} },
        getFlag: jest.fn((scope, key) => flagStore[key]),
        setFlag: jest.fn(async (scope, key, value) => {
          flagStore[key] = value;
        }),
      };
    }

    beforeEach(() => {
      fromUuid.mockReset();
    });

    test("switches off on a successful hit compared against Evasion", async () => {
      global.Roll = FakeRoll;
      FakeRoll.nextTotal = 20;
      const targetActor = makePhantomSuiteTargetActor({ active: true });
      fromUuid.mockResolvedValue(targetActor);
      const checkContext = {
        entries: [{ name: 'Target', targetUuid: 'Actor.target1', difficulty: 10, showDifficulty: true }],
        damageValue: null, damageType: null, effectName: 'Test Weapon', alternateEffects: [],
        defenseType: 'evasion',
      };

      await freshDice._rollSkillHelper('d20 + 0', makeBankedActor(false), 'flavor', false, checkContext, {});

      expect(targetActor.setFlag).toHaveBeenCalledWith('essence20', 'phantomSuiteActive', false);
    });

    test("doesn't apply on a miss, without being active, or against a non-Evasion Defense", async () => {
      global.Roll = FakeRoll;
      const evasionContext = {
        entries: [{ name: 'Target', targetUuid: 'Actor.target1', difficulty: 10, showDifficulty: true }],
        damageValue: null, damageType: null, effectName: 'Test Weapon', alternateEffects: [],
        defenseType: 'evasion',
      };

      FakeRoll.nextTotal = 5; // below difficulty 10 - a miss
      const missedTarget = makePhantomSuiteTargetActor({ active: true });
      fromUuid.mockResolvedValue(missedTarget);
      await freshDice._rollSkillHelper('d20 + 0', makeBankedActor(false), 'flavor', false, evasionContext, {});
      expect(missedTarget.setFlag).not.toHaveBeenCalled();

      FakeRoll.nextTotal = 20;
      const inactiveTarget = makePhantomSuiteTargetActor({ active: false });
      fromUuid.mockResolvedValue(inactiveTarget);
      await freshDice._rollSkillHelper('d20 + 0', makeBankedActor(false), 'flavor', false, evasionContext, {});
      expect(inactiveTarget.setFlag).not.toHaveBeenCalled();

      const toughnessTarget = makePhantomSuiteTargetActor({ active: true });
      fromUuid.mockResolvedValue(toughnessTarget);
      const toughnessContext = { ...evasionContext, defenseType: 'toughness' };
      await freshDice._rollSkillHelper('d20 + 0', makeBankedActor(false), 'flavor', false, toughnessContext, {});
      expect(toughnessTarget.setFlag).not.toHaveBeenCalled();
    });
  });

  // Terror's accrual is a hit Trigger on the Perk (rules/conv15-items2.test.js).

  describe("Toxic Terror (Finster's Monster-Matic Cookbook, Path of Venom, 13th level) - downshift consumption", () => {
    // A fresh, isolated essenceShifts - see the Power Adaptation makeActor()'s own comment
    // elsewhere in this file for why a shallow {...mockActor, ...} spread alone isn't enough.
    function makeActor({ stacks = 0 } = {}) {
      const flags = { toxicTerrorStacks: stacks ? { epoch: 1, window: 'scene', count: stacks } : undefined };
      return {
        ...mockActor,
        items: [],
        system: {
          ...mockActor.system,
          essenceShifts: {
            any: { shiftUp: 0, shiftDown: 0 },
            strength: { shiftUp: 0, shiftDown: 0 },
            speed: { shiftUp: 0, shiftDown: 0 },
            smarts: { shiftUp: 0, shiftDown: 0 },
            social: { shiftUp: 0, shiftDown: 0 },
          },
        },
        getFlag: jest.fn((scope, key) => flags[key]),
        getRollData: jest.fn(() => ({ skills: { athletics: { modifier: '0', shift: 'd20' } } })),
      };
    }

    const baseDataset = { shift: 'd20', shiftDown: '0', shiftUp: '0' };

    test("downshifts Strength/Speed Skill Tests by the stacked amount", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();
      const actor = makeActor({ stacks: 2 });

      await dice.rollSkill({ ...baseDataset, skill: 'athletics', essence: 'strength' }, actor, null);
      expect(rollDialog.getSkillRollOptions.mock.calls[0][0].shiftDown).toBe(2);
    });

    test("doesn't apply to a non-Strength/Speed essence, or with no stacks", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill({ ...baseDataset, skill: 'athletics', essence: 'smarts' }, makeActor({ stacks: 2 }), null);
      expect(rollDialog.getSkillRollOptions.mock.calls[0][0].shiftDown).toBe(0);

      await dice.rollSkill({ ...baseDataset, skill: 'athletics', essence: 'strength' }, makeActor({ stacks: 0 }), null);
      expect(rollDialog.getSkillRollOptions.mock.calls[1][0].shiftDown).toBe(0);
    });
  });

  describe("Emotional Mastery: Shame (A Jump Through Time, Purple Ranger, p.37) - banking on being successfully targeted", () => {
    function makeShameAttacker() {
      return {
        ...makeBankedActor(false),
        id: 'attacker1',
        items: [],
        getFlag: jest.fn(() => undefined),
        setFlag: jest.fn(),
      };
    }

    function makeShameTarget({ active = ['shame'] } = {}) {
      return {
        id: 'target1',
        name: 'Target',
        items: [],
        statuses: new Set(),
        system: { stun: { value: 0 }, health: { value: 5, max: 5 }, immunities: {} },
        getFlag: jest.fn((scope, key) => (key == 'activeEmotionalMastery' ? active : undefined)),
        setFlag: jest.fn(),
      };
    }

    beforeEach(() => {
      fromUuid.mockReset();
      game.combat = { id: 'combat1' };
    });

    afterEach(() => {
      game.combat = null;
    });

    test("banks ↑1 on a plain successful hit (not a Critical Success)", async () => {
      global.Roll = FakeRoll;
      FakeRoll.nextTotal = 15; // exactly meets difficulty 10 - a success, not a x2+ crit
      const targetActor = makeShameTarget();
      fromUuid.mockResolvedValue(targetActor);
      const checkContext = {
        entries: [{ name: 'Target', targetUuid: 'Actor.target1', difficulty: 10, showDifficulty: true }],
        damageValue: 3, damageType: 'blunt', effectName: 'Test Weapon', alternateEffects: [],
        isAttack: true,
      };

      await freshDice._rollSkillHelper('d20 + 0', makeShameAttacker(), 'flavor', false, checkContext, {});

      expect(targetActor.setFlag).toHaveBeenCalledWith(
        'essence20', 'pendingEmotionalMasteryShame', expect.objectContaining({ shiftUp: 1 }),
      );
    });

    test("banks ↑2 on a Critical Success (double the Difficulty or more)", async () => {
      global.Roll = FakeRoll;
      FakeRoll.nextTotal = 20; // double difficulty 10 - a Critical Success
      const targetActor = makeShameTarget();
      fromUuid.mockResolvedValue(targetActor);
      const checkContext = {
        entries: [{ name: 'Target', targetUuid: 'Actor.target1', difficulty: 10, showDifficulty: true }],
        damageValue: 3, damageType: 'blunt', effectName: 'Test Weapon', alternateEffects: [],
        isAttack: true,
      };

      await freshDice._rollSkillHelper('d20 + 0', makeShameAttacker(), 'flavor', false, checkContext, {});

      expect(targetActor.setFlag).toHaveBeenCalledWith(
        'essence20', 'pendingEmotionalMasteryShame', expect.objectContaining({ shiftUp: 2 }),
      );
    });

    test("applies even on a plain (non-Attack) Skill Test", async () => {
      global.Roll = FakeRoll;
      FakeRoll.nextTotal = 15;
      const targetActor = makeShameTarget();
      fromUuid.mockResolvedValue(targetActor);
      const checkContext = {
        entries: [{ name: 'Target', targetUuid: 'Actor.target1', difficulty: 10, showDifficulty: true }],
        isAttack: false,
      };

      await freshDice._rollSkillHelper('d20 + 0', makeShameAttacker(), 'flavor', false, checkContext, {});

      expect(targetActor.setFlag).toHaveBeenCalledWith(
        'essence20', 'pendingEmotionalMasteryShame', expect.objectContaining({ shiftUp: 1 }),
      );
    });

    test("doesn't bank anything on a miss, or without Shame active", async () => {
      global.Roll = FakeRoll;
      const checkContext = {
        entries: [{ name: 'Target', targetUuid: 'Actor.target1', difficulty: 10, showDifficulty: true }],
        isAttack: true,
      };

      FakeRoll.nextTotal = 5; // below difficulty - a miss
      const missTarget = makeShameTarget();
      fromUuid.mockResolvedValue(missTarget);
      await freshDice._rollSkillHelper('d20 + 0', makeShameAttacker(), 'flavor', false, checkContext, {});
      expect(missTarget.setFlag).not.toHaveBeenCalled();

      FakeRoll.nextTotal = 15;
      const noOptionTarget = makeShameTarget({ active: ['fear'] });
      fromUuid.mockResolvedValue(noOptionTarget);
      await freshDice._rollSkillHelper('d20 + 0', makeShameAttacker(), 'flavor', false, checkContext, {});
      expect(noOptionTarget.setFlag).not.toHaveBeenCalled();
    });
  });

  describe("Space Vessel Conditions (Across the Stars p.25-26) - post-roll", () => {
    // A vessel whose statuses toggle for real, enough for mechanics/vehicles/vessel-conditions.mjs to count.
    function makeShip(statuses = []) {
      const ship = {
        uuid: 'Actor.ship', name: 'Ship', isOwner: true, statuses: new Set(statuses), effects: [], system: { health: { max: 10 } },
        getActiveTokens: () => [],
      };
      ship.effects = statuses.map(id => ({ statuses: new Set([id]), flags: {} }));
      ship.toggleStatusEffect = jest.fn(async (id, { active }) => {
        if (active) {
          ship.statuses.add(id);
          ship.effects.push({ statuses: new Set([id]), flags: {} });
        } else {
          ship.statuses.delete(id);
          ship.effects = ship.effects.filter(effect => !effect.statuses.has(id));
        }
      });
      return ship;
    }

    const critContext = {
      entries: [{ name: 'Ship', targetUuid: 'Actor.ship', difficulty: 10, showDifficulty: true }],
      damageValue: 2, damageType: 'laser', effectName: null, alternateEffects: [],
      targetVesselSystemAttempt: true,
    };
    const originalApplications = foundry.applications;

    beforeEach(() => {
      fromUuid.mockReset();
      foundry.applications = {
        ...originalApplications,
        api: { ...(originalApplications?.api ?? {}), DialogV2: { wait: jest.fn(async () => 'sputtering') } },
      };
    });

    afterEach(() => {
      foundry.applications = originalApplications;
    });

    test("a Critical Success on a declared targeted-system attack imposes the chosen Condition", async () => {
      global.Roll = FakeRoll;
      FakeRoll.nextTotal = 20;
      const ship = makeShip();
      fromUuid.mockResolvedValue(ship);

      await freshDice._rollSkillHelper('d20 + 0', makeBankedActor(false), 'flavor', false, critContext, {});
      expect(ship.statuses.has('sputtering')).toBe(true);
    });

    test("an ordinary hit imposes nothing", async () => {
      global.Roll = FakeRoll;
      FakeRoll.nextTotal = 15;
      const ship = makeShip();
      fromUuid.mockResolvedValue(ship);

      await freshDice._rollSkillHelper('d20 + 0', makeBankedActor(false), 'flavor', false, critContext, {});
      expect(ship.toggleStatusEffect).not.toHaveBeenCalled();
    });

    test("a successful repair roll clears the chosen Condition", async () => {
      global.Roll = FakeRoll;
      FakeRoll.nextTotal = 13;
      const ship = makeShip(['leaking']);
      fromUuid.mockResolvedValue(ship);

      await freshDice._rollSkillHelper('d20 + 0', makeBankedActor(false), 'flavor', false, {
        entries: [{ name: 'Repair', targetUuid: null, difficulty: 12, showDifficulty: true }],
        damageValue: null, damageType: null, effectName: null, alternateEffects: [],
        repairVesselUuid: 'Actor.ship', repairVesselCondition: 'leaking',
      }, {});
      expect(ship.statuses.has('leaking')).toBe(false);
    });
  });

  describe("Spot (Weapon Effects and Traits) - marking on a successful hit", () => {
    function makeSpotTargetActor() {
      return {
        name: 'Target',
        setFlag: jest.fn(),
        system: { stun: { value: 0 }, health: { value: 5, max: 5 }, immunities: {} },
      };
    }

    beforeEach(() => {
      fromUuid.mockReset();
    });

    test("marks the target 'spotted' on a successful hit", async () => {
      global.Roll = FakeRoll;
      FakeRoll.nextTotal = 20;
      const targetActor = makeSpotTargetActor();
      fromUuid.mockResolvedValue(targetActor);
      const checkContext = {
        entries: [{ name: 'Target', targetUuid: 'Actor.target1', difficulty: 10, showDifficulty: true }],
        damageValue: null, damageType: null, effectName: 'Spot Effect', alternateEffects: [],
        isSpotAttempt: true,
      };

      await freshDice._rollSkillHelper('d20 + 0', makeBankedActor(false), 'flavor', false, checkContext, {});

      expect(targetActor.setFlag).toHaveBeenCalledWith('essence20', 'spotted', true);
    });

    test("doesn't mark the target on a miss", async () => {
      global.Roll = FakeRoll;
      FakeRoll.nextTotal = 5; // below difficulty 10
      const targetActor = makeSpotTargetActor();
      fromUuid.mockResolvedValue(targetActor);
      const checkContext = {
        entries: [{ name: 'Target', targetUuid: 'Actor.target1', difficulty: 10, showDifficulty: true }],
        damageValue: null, damageType: null, effectName: 'Spot Effect', alternateEffects: [],
        isSpotAttempt: true,
      };

      await freshDice._rollSkillHelper('d20 + 0', makeBankedActor(false), 'flavor', false, checkContext, {});

      expect(targetActor.setFlag).not.toHaveBeenCalled();
    });

    test("doesn't mark anyone when isSpotAttempt isn't flagged", async () => {
      global.Roll = FakeRoll;
      FakeRoll.nextTotal = 20;
      const targetActor = makeSpotTargetActor();
      fromUuid.mockResolvedValue(targetActor);
      const checkContext = {
        entries: [{ name: 'Target', targetUuid: 'Actor.target1', difficulty: 10, showDifficulty: true }],
        damageValue: null, damageType: null, effectName: 'Test Weapon', alternateEffects: [],
      };

      await freshDice._rollSkillHelper('d20 + 0', makeBankedActor(false), 'flavor', false, checkContext, {});

      expect(targetActor.setFlag).not.toHaveBeenCalled();
    });
  });

  describe("an NPC's Critical Success - GM Point grant (GI Joe CRB p.128)", () => {
    // A skill die showing its max face - what combat.mjs#_isCritIsFumble calls a Critical Success.
    class NpcCritRoll {
      constructor() {
        this.dice = [{ faces: 20, values: [12] }, { faces: 6, values: [6] }];
        this._total = 18;
      }
      async evaluate() {}
      get total() {
        return this._total;
      }
      _evaluateTotal() {
        return this._total;
      }
      async render() {
        return '<div></div>';
      }
    }

    const versus = (difficulty) => ({
      entries: [{ name: 'Target', targetUuid: null, difficulty, showDifficulty: true }],
      damageValue: null, damageType: null, effectName: null, alternateEffects: [],
    });

    beforeEach(() => {
      game.users = [{ isGM: true, active: true }];
      game.socket = { emit: jest.fn() };
      global.Roll = NpcCritRoll;
    });

    afterEach(() => {
      delete game.users;
      delete game.socket;
    });

    test("an NPC that Critically Succeeds gains the GM a GM Point", async () => {
      const actor = { ...makeBankedActor(false), type: 'npc', name: 'Cobra Viper' };

      await freshDice._rollSkillHelper('d20 + d6', actor, 'flavor', false, versus(10), {});

      expect(game.socket.emit).toHaveBeenCalledWith('system.essence20', {
        action: 'grantStoryPoints', amount: 1, actorName: 'Cobra Viper', pool: 'gm',
      });
    });

    test("a max die on a Test that still failed is not a Critical Success", async () => {
      const actor = { ...makeBankedActor(false), type: 'npc', name: 'Cobra Viper' };

      await freshDice._rollSkillHelper('d20 + d6', actor, 'flavor', false, versus(25), {});

      expect(game.socket.emit).not.toHaveBeenCalled();
    });

    test("a bare roll against nothing succeeded at nothing", async () => {
      const actor = { ...makeBankedActor(false), type: 'npc', name: 'Cobra Viper' };

      await freshDice._rollSkillHelper('d20 + d6', actor, 'flavor', false, { entries: [], damageValue: null, damageType: null, effectName: null, alternateEffects: [] }, {});

      expect(game.socket.emit).not.toHaveBeenCalled();
    });

    test("a player character's Critical Success feeds nobody's pool", async () => {
      const actor = { ...makeBankedActor(false), type: 'playerCharacter', name: 'Duke' };

      await freshDice._rollSkillHelper('d20 + d6', actor, 'flavor', false, versus(10), {});

      expect(game.socket.emit).not.toHaveBeenCalled();
    });
  });

  describe("Time Traveler's own Hang-Up (A Jump Through Time, p.24) - Fumble widening", () => {
    const TIME_TRAVELER_HANGUP_ID = "Compendium.essence20.jump_through_time.Item.4OGaAf7j1W8ZaGSs";

    afterEach(() => {
      chatMessage.create.mockClear();
      chatMessage.getSpeaker.mockClear();
    });

    class FakeD20Roll {
      constructor() {
        this.dice = [new FakeDie(20, [{ result: FakeD20Roll.d20Value ?? 10, active: true }]), new FakeDie(8, [{ result: 5, active: true }])];
        this._total = 15;
      }
      async evaluate() {}
      get total() {
        return this._total;
      }
      async render() {
        return '<div></div>';
      }
    }

    // The Hang-Up's FumbleRange rule (rules/plugins/rolls/die-facts.mjs).
    function makeActor({ hasHangUp = true } = {}) {
      const items = hasHangUp ? [{
        id: 'tt', name: 'Time Traveler', type: 'hangUp', flags: { core: { sourceId: TIME_TRAVELER_HANGUP_ID } },
        system: { rules: [{ type: 'FumbleRange', upTo: 2, when: ['roll:finalDie:<=d4'] }] },
      }] : [];
      return { ...makeBankedActor(false), items };
    }

    const checkContext = {
      entries: [{ name: 'Target', targetUuid: null, difficulty: 10, showDifficulty: true }],
      damageValue: null, damageType: null, effectName: null, alternateEffects: [],
    };

    test("a natural 2 on a d4-or-lower skill roll is a Fumble with the Hang-Up", async () => {
      FakeD20Roll.d20Value = 2;
      global.Roll = FakeD20Roll;

      await freshDice._rollSkillHelper('d20 + d8', makeActor(), 'flavor', false, checkContext, { finalShift: 'd4' });

      expect(freshDice._chatMessage.create).toHaveBeenCalled();
      const chatData = freshDice._chatMessage.create.mock.calls.at(-1)[0];
      expect(chatData.flags.essence20.isFumble).toBe(true);
    });

    test("a natural 2 does NOT Fumble on a higher skill die, without the Hang-Up, or on a normal 1-only check", async () => {
      FakeD20Roll.d20Value = 2;
      global.Roll = FakeD20Roll;

      await freshDice._rollSkillHelper('d20 + d8', makeActor(), 'flavor', false, checkContext, { finalShift: 'd8' });
      let chatData = freshDice._chatMessage.create.mock.calls.at(-1)[0];
      expect(chatData.flags.essence20.isFumble).toBe(false);

      await freshDice._rollSkillHelper('d20 + d8', makeActor({ hasHangUp: false }), 'flavor', false, checkContext, { finalShift: 'd4' });
      chatData = freshDice._chatMessage.create.mock.calls.at(-1)[0];
      expect(chatData.flags.essence20.isFumble).toBe(false);

      FakeD20Roll.d20Value = 10;
      await freshDice._rollSkillHelper('d20 + d8', makeActor(), 'flavor', false, checkContext, { finalShift: 'd4' });
      chatData = freshDice._chatMessage.create.mock.calls.at(-1)[0];
      expect(chatData.flags.essence20.isFumble).toBe(false);
    });
  });

  describe("Fumble Story Point grant", () => {

    class FakeFumbleRoll {
      constructor() {
        this.dice = [new FakeDie(20, [{ result: 1, active: true }])];
        this._total = 1;
      }
      async evaluate() {}
      get total() {
        return this._total;
      }
      async render() {
        return '<div></div>';
      }
    }

    beforeEach(() => {
      game.users = [{ isGM: true, active: true }];
      game.socket = { emit: jest.fn() };
    });

    afterEach(() => {
      delete game.users;
      delete game.socket;
    });

    const checkContext = {
      entries: [{ name: 'Target', targetUuid: null, difficulty: 10, showDifficulty: true }],
      damageValue: null, damageType: null, effectName: null, alternateEffects: [],
    };

    test("grants the base 1 Story Point without it", async () => {
      global.Roll = FakeFumbleRoll;
      const actor = { ...makeBankedActor(false), name: 'Wanderer', items: [] };

      await freshDice._rollSkillHelper('d20 + 0', actor, 'flavor', false, checkContext, {});

      expect(game.socket.emit).toHaveBeenCalledWith('system.essence20', {
        action: 'grantStoryPoints', amount: 1, actorName: 'Wanderer',
      });
    });
  });

  describe("Unconscious target (GI Joe CRB, Conditions, p.226) - critical hit on a successful attack", () => {
    function makeFlatActor() {
      return { getRollData: () => ({}), getFlag: jest.fn(), unsetFlag: jest.fn() };
    }

    function lastRenderedResults() {
      const renderCall = global.foundry.applications.handlebars.renderTemplate.mock.calls.slice(-1)[0];
      return renderCall[1].results;
    }

    test("bumps a marginal Success (multiplier 1) to a Critical Success (multiplier 2)", async () => {
      global.Roll = FakeRoll;
      FakeRoll.nextTotal = 10; // floor(10/8) = 1, a marginal success
      const checkContext = {
        entries: [{ name: 'Target', targetUuid: 'Actor.target1', difficulty: 8, showDifficulty: true, targetUnconscious: true }],
        damageValue: null, damageType: null, effectName: null, alternateEffects: [],
      };

      await freshDice._rollSkillHelper('d20 + 0', makeFlatActor(), 'flavor', false, checkContext, {});

      expect(lastRenderedResults()[0].multiplier).toBe(2);
    });

    test("leaves an already-Critical roll alone, and doesn't upgrade a miss", async () => {
      global.Roll = FakeRoll;
      FakeRoll.nextTotal = 20; // floor(20/8) = 2, already a Critical Success
      const critContext = {
        entries: [{ name: 'Target', targetUuid: 'Actor.target1', difficulty: 8, showDifficulty: true, targetUnconscious: true }],
        damageValue: null, damageType: null, effectName: null, alternateEffects: [],
      };
      await freshDice._rollSkillHelper('d20 + 0', makeFlatActor(), 'flavor', false, critContext, {});
      expect(lastRenderedResults()[0].multiplier).toBe(2);

      FakeRoll.nextTotal = 1; // a miss
      const missContext = {
        entries: [{ name: 'Target', targetUuid: 'Actor.target1', difficulty: 8, showDifficulty: true, targetUnconscious: true }],
        damageValue: null, damageType: null, effectName: null, alternateEffects: [],
      };
      await freshDice._rollSkillHelper('d20 + 0', makeFlatActor(), 'flavor', false, missContext, {});
      expect(lastRenderedResults()[0].multiplier).toBe(0);
    });

    test("doesn't bump a non-Unconscious target's marginal Success", async () => {
      global.Roll = FakeRoll;
      FakeRoll.nextTotal = 10;
      const checkContext = {
        entries: [{ name: 'Target', targetUuid: 'Actor.target1', difficulty: 8, showDifficulty: true, targetUnconscious: false }],
        damageValue: null, damageType: null, effectName: null, alternateEffects: [],
      };

      await freshDice._rollSkillHelper('d20 + 0', makeFlatActor(), 'flavor', false, checkContext, {});

      expect(lastRenderedResults()[0].multiplier).toBe(1);
    });
  });

  // Rallying Cry (WTNV) is its item's own afterRoll Trigger (rules/conv15-items1.test.js); the old hand-written
  // dice.mjs sweep applied Surprised a second time (audit fix 2026-10-07) and is gone.
  describe("Rallying Cry (WTNV Citizens' Guide, Journalist Role Perk, p.37) - no hand-written path", () => {
    let originalTargets;
    beforeEach(() => {
      originalTargets = game.user.targets;
    });
    afterEach(() => {
      game.user.targets = originalTargets;
    });

    function makeCrier(disposition = 1) {
      return {
        ...makeBankedActor(false),
        getActiveTokens: jest.fn(() => [{ document: { disposition } }]),
      };
    }

    function makeEnemy() {
      return { actor: { toggleStatusEffect: jest.fn() }, document: { disposition: -1 } };
    }

    const rallyingCryContext = {
      entries: [{ name: 'Crier', targetUuid: null, difficulty: 10, showDifficulty: true }],
      damageValue: null, damageType: null, effectName: null, alternateEffects: [],
      isWtnvRallyingCryAttempt: true,
    };

    test("a successful roll carrying the old isWtnvRallyingCryAttempt flag Surprises nobody from dice.mjs", async () => {
      global.Roll = FakeRoll;
      FakeRoll.nextTotal = 15;
      const first = makeEnemy();
      const second = makeEnemy();
      game.user.targets = [first, second];

      await freshDice._rollSkillHelper('d20 + 0', makeCrier(1), 'flavor', false, rallyingCryContext, {});

      expect(first.actor.toggleStatusEffect).not.toHaveBeenCalled();
      expect(second.actor.toggleStatusEffect).not.toHaveBeenCalled();
    });
  });

  describe("Mind Beam (MLP CRB, Virtuoso Beam spell, p.139) - effect application", () => {
    const MIND_BEAM_ID = "Compendium.essence20.mlp_crb.Item.gF8otV8Ag9axRp2Z";

    test("applies the chosen Condition to a successfully-hit target", async () => {
      const targetActor = { toggleStatusEffect: jest.fn() };
      fromUuid.mockResolvedValue(targetActor);
      const checkContext = {
        entries: [{ name: 'Target', targetUuid: 'Actor.target1', difficulty: 10, showDifficulty: true }],
        damageValue: null, damageType: null, effectName: null, alternateEffects: [],
        spellSourceId: MIND_BEAM_ID, mindBeamEffect: 'stunned',
      };
      global.Roll = FakeRoll;
      FakeRoll.nextTotal = 20;

      await freshDice._rollSkillHelper('d20 + 0', makeBankedActor(false), 'flavor', false, checkContext, {});

      expect(targetActor.toggleStatusEffect).toHaveBeenCalledWith('stunned', { active: true });
    });

    test("doesn't apply anything on a miss", async () => {
      const targetActor = { toggleStatusEffect: jest.fn() };
      fromUuid.mockResolvedValue(targetActor);
      const checkContext = {
        entries: [{ name: 'Target', targetUuid: 'Actor.target1', difficulty: 10, showDifficulty: true }],
        damageValue: null, damageType: null, effectName: null, alternateEffects: [],
        spellSourceId: MIND_BEAM_ID, mindBeamEffect: 'stunned',
      };
      global.Roll = FakeRoll;
      FakeRoll.nextTotal = 1;

      await freshDice._rollSkillHelper('d20 + 0', makeBankedActor(false), 'flavor', false, checkContext, {});

      expect(targetActor.toggleStatusEffect).not.toHaveBeenCalled();
    });

    test("doesn't apply anything for an unrelated spell", async () => {
      const targetActor = { toggleStatusEffect: jest.fn() };
      fromUuid.mockResolvedValue(targetActor);
      const checkContext = {
        entries: [{ name: 'Target', targetUuid: 'Actor.target1', difficulty: 10, showDifficulty: true }],
        damageValue: null, damageType: null, effectName: null, alternateEffects: [],
        spellSourceId: 'Compendium.essence20.mlp_crb.Item.unrelated', mindBeamEffect: 'stunned',
      };
      global.Roll = FakeRoll;
      FakeRoll.nextTotal = 20;

      await freshDice._rollSkillHelper('d20 + 0', makeBankedActor(false), 'flavor', false, checkContext, {});

      expect(targetActor.toggleStatusEffect).not.toHaveBeenCalled();
    });
  });

});

/* Trait rules pass B - environment subsystem + Inertial/Aquatic/Amphibious/Enviro-Sealed. See
   mechanics/world/environment.mjs for getEnvironment()/getSceneEnvironment()'s own unit tests - these
   exercise dice.mjs's own _getAutomaticCombatModifiers wiring on top of that. */
describe("Environment-reading weapon/armor traits (Across the Stars p.24-25/79/85, GI Joe CRB p.147/212)", () => {
  // Several unrelated target-gated checks elsewhere in _getAutomaticCombatModifiers read
  // game.user.targets.first() unconditionally; other describe blocks in this file leave it
  // mocked to return a real target without restoring it afterward, so this insulates these
  // tests from that ambient state regardless of run order.
  beforeEach(() => {
    game.user.targets.first = jest.fn(() => undefined);
  });

  function makeEnvironmentActor({ environment = 'normal', swimTotal = 0 } = {}) {
    return {
      statuses: new Set(),
      items: [],
      getFlag: jest.fn(() => undefined),
      system: {
        movement: { swim: { total: swimTotal } },
      },
      documentName: 'Actor',
      getActiveTokens: () => [{
        parent: { getFlag: (scope, key) => (scope == 'essence20' && key == 'environment' ? environment : undefined) },
        regions: [],
      }],
    };
  }

  function makeWeaponEffect({ traits = [], style = 'ranged', damageType = 'blunt' } = {}) {
    return {
      type: 'weaponEffect',
      flags: { essence20: { parentId: 'weapon1' } },
      system: { classification: { style }, damageType },
      _weaponTraits: traits,
    };
  }

  function attachWeapon(actor, item) {
    const items = [];
    items.get = (id) => (id == 'weapon1' ? { system: { traits: item._weaponTraits } } : null);
    actor.items = items;
    return item;
  }

  describe("Inertial (weapon trait, p.79)", () => {
    test("ignores the Low Gravity Snag on a Ballistic weapon", () => {
      const actor = makeEnvironmentActor({ environment: 'lowGravity' });
      const item = attachWeapon(actor, makeWeaponEffect({ traits: ['inertial', 'ballistic'] }));
      expect(dice._getAutomaticCombatModifiers(actor, item, 'strength', 'targeting').snag).toBe(false);
    });

    test("ignores the Zero-G Snag", () => {
      const actor = makeEnvironmentActor({ environment: 'zeroGravity' });
      const item = attachWeapon(actor, makeWeaponEffect({ traits: ['inertial'] }));
      expect(dice._getAutomaticCombatModifiers(actor, item, 'strength', 'targeting').snag).toBe(false);
    });

    test("ignores the Vacuum Snag", () => {
      const actor = makeEnvironmentActor({ environment: 'vacuum' });
      const item = attachWeapon(actor, makeWeaponEffect({ traits: ['inertial'] }));
      expect(dice._getAutomaticCombatModifiers(actor, item, 'strength', 'targeting').snag).toBe(false);
    });
  });

  describe("Low Gravity / Zero-G / Vacuum penalties (p.24-25) on a non-Inertial weapon", () => {
    test("Low Gravity Snags a Ballistic ranged attack", () => {
      const actor = makeEnvironmentActor({ environment: 'lowGravity' });
      const item = attachWeapon(actor, makeWeaponEffect({ traits: ['ballistic'] }));
      expect(dice._getAutomaticCombatModifiers(actor, item, 'strength', 'targeting').snag).toBe(true);
    });

    test("Low Gravity does nothing to a non-Ballistic ranged attack", () => {
      const actor = makeEnvironmentActor({ environment: 'lowGravity' });
      const item = attachWeapon(actor, makeWeaponEffect({ traits: [] }));
      expect(dice._getAutomaticCombatModifiers(actor, item, 'strength', 'targeting').snag).toBe(false);
    });

    test("Zero-G Snags a ranged attack that isn't Energy or Laser", () => {
      const actor = makeEnvironmentActor({ environment: 'zeroGravity' });
      const item = attachWeapon(actor, makeWeaponEffect({ traits: [] }));
      expect(dice._getAutomaticCombatModifiers(actor, item, 'strength', 'targeting').snag).toBe(true);
    });

    test("Zero-G leaves an Energy-trait weapon alone", () => {
      const actor = makeEnvironmentActor({ environment: 'zeroGravity' });
      const item = attachWeapon(actor, makeWeaponEffect({ traits: ['energy'] }));
      expect(dice._getAutomaticCombatModifiers(actor, item, 'strength', 'targeting').snag).toBe(false);
    });

    test("Zero-G leaves a Laser damageType weapon alone", () => {
      const actor = makeEnvironmentActor({ environment: 'zeroGravity' });
      const item = attachWeapon(actor, makeWeaponEffect({ traits: [], damageType: 'laser' }));
      expect(dice._getAutomaticCombatModifiers(actor, item, 'strength', 'targeting').snag).toBe(false);
    });

    test("Vacuum Snags any ranged attack", () => {
      const actor = makeEnvironmentActor({ environment: 'vacuum' });
      const item = attachWeapon(actor, makeWeaponEffect({ traits: [] }));
      expect(dice._getAutomaticCombatModifiers(actor, item, 'strength', 'targeting').snag).toBe(true);
    });

    test("none of these apply to a melee attack", () => {
      const actor = makeEnvironmentActor({ environment: 'vacuum' });
      const item = attachWeapon(actor, makeWeaponEffect({ traits: [], style: 'melee' }));
      expect(dice._getAutomaticCombatModifiers(actor, item, 'strength', 'might').snag).toBe(false);
    });

    test("none of these apply in a normal environment", () => {
      const actor = makeEnvironmentActor({ environment: 'normal' });
      const item = attachWeapon(actor, makeWeaponEffect({ traits: [] }));
      expect(dice._getAutomaticCombatModifiers(actor, item, 'strength', 'targeting').snag).toBe(false);
    });
  });

  describe("Gravity, Impaired environments and Unstable (Across the Stars p.23-26)", () => {
    test("High Gravity ↓2, Low Gravity ↑1 and Zero-G ↑2 on Athletics and Brawn only", () => {
      const high = dice._getAutomaticCombatModifiers(makeEnvironmentActor({ environment: 'highGravity' }), null, 'strength', 'athletics');
      expect(high.shiftDown).toBe(2);
      expect(high.sources).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'gravitySkill', shiftDown: 2 })]));
      expect(dice._getAutomaticCombatModifiers(makeEnvironmentActor({ environment: 'lowGravity' }), null, 'strength', 'brawn').shiftUp).toBe(1);
      expect(dice._getAutomaticCombatModifiers(makeEnvironmentActor({ environment: 'zeroGravity' }), null, 'strength', 'athletics').shiftUp).toBe(2);
      expect(dice._getAutomaticCombatModifiers(makeEnvironmentActor({ environment: 'zeroGravity' }), null, 'strength', 'might').shiftUp).toBe(0);
    });

    test("Extreme Temperature and Thick/Thin Atmosphere impose Impaired's ↓1 as their own source", () => {
      for (const environment of ['extremeHeat', 'extremeCold', 'thickAtmosphere', 'thinAtmosphere']) {
        const mods = dice._getAutomaticCombatModifiers(makeEnvironmentActor({ environment }), null, 'smarts', 'alertness');
        expect(mods.shiftDown).toBe(1);
        expect(mods.sources).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'environmentImpaired' })]));
      }

      expect(dice._getAutomaticCombatModifiers(makeEnvironmentActor({ environment: 'vacuum' }), null, 'smarts', 'alertness').shiftDown).toBe(0);
    });

    test("no second ↓1 when the actor already has the Impaired status, and none when protected", () => {
      const impaired = makeEnvironmentActor({ environment: 'thinAtmosphere' });
      impaired.statuses = new Set(['impaired']);
      expect(dice._getAutomaticCombatModifiers(impaired, null, 'smarts', 'alertness').shiftDown).toBe(1);

      const sealed = makeEnvironmentActor({ environment: 'thinAtmosphere' });
      sealed.items = [{ type: 'armor', system: { equipped: true, traits: ['enviroSealed'] } }];
      expect(dice._getAutomaticCombatModifiers(sealed, null, 'smarts', 'alertness').shiftDown).toBe(0);
    });

    test("Unstable: ↓1, then ↓2, on a vehicle's weapon attacks only", () => {
      function unstableVehicle(stacks) {
        const actor = makeEnvironmentActor();
        actor.type = 'vehicle';
        actor.statuses = new Set(['unstable']);
        actor.effects = [{ statuses: new Set(['unstable']), flags: { essence20: { stacks } } }];
        return actor;
      }

      const one = unstableVehicle(1);
      const item = attachWeapon(one, makeWeaponEffect({ traits: ['energy'], damageType: 'laser' }));
      expect(dice._getAutomaticCombatModifiers(one, item, 'speed', 'targeting').shiftDown).toBe(1);

      const two = unstableVehicle(2);
      expect(dice._getAutomaticCombatModifiers(two, attachWeapon(two, makeWeaponEffect({ traits: ['energy'] })), 'speed', 'targeting').shiftDown).toBe(2);
      expect(dice._getAutomaticCombatModifiers(two, null, 'speed', 'driving').shiftDown).toBe(0);
    });
  });

  describe("Underwater Combat (GI Joe CRB p.212) and Aquatic/Amphibious (p.147)", () => {
    test("Snags a melee attack without Aquatic Movement, on an ordinary weapon", () => {
      const actor = makeEnvironmentActor({ environment: 'underwater', swimTotal: 0 });
      const item = attachWeapon(actor, makeWeaponEffect({ traits: [], style: 'melee' }));
      expect(dice._getAutomaticCombatModifiers(actor, item, 'strength', 'might').snag).toBe(true);
    });

    test("doesn't Snag a melee attack once the actor has Aquatic Movement", () => {
      const actor = makeEnvironmentActor({ environment: 'underwater', swimTotal: 30 });
      const item = attachWeapon(actor, makeWeaponEffect({ traits: [], style: 'melee' }));
      expect(dice._getAutomaticCombatModifiers(actor, item, 'strength', 'might').snag).toBe(false);
    });

    test("Snags a ranged attack with an ordinary weapon regardless of Aquatic Movement", () => {
      const actor = makeEnvironmentActor({ environment: 'underwater', swimTotal: 30 });
      const item = attachWeapon(actor, makeWeaponEffect({ traits: [] }));
      expect(dice._getAutomaticCombatModifiers(actor, item, 'strength', 'targeting').snag).toBe(true);
    });

    test("Amphibious waives both the melee and ranged underwater Snag", () => {
      const actor = makeEnvironmentActor({ environment: 'underwater', swimTotal: 0 });
      const meleeItem = attachWeapon(actor, makeWeaponEffect({ traits: ['amphibious'], style: 'melee' }));
      expect(dice._getAutomaticCombatModifiers(actor, meleeItem, 'strength', 'might').snag).toBe(false);

      const rangedItem = attachWeapon(actor, makeWeaponEffect({ traits: ['amphibious'], style: 'ranged' }));
      expect(dice._getAutomaticCombatModifiers(actor, rangedItem, 'strength', 'targeting').snag).toBe(false);
    });

    test("Aquatic waives the underwater Snag too", () => {
      const actor = makeEnvironmentActor({ environment: 'underwater', swimTotal: 0 });
      const item = attachWeapon(actor, makeWeaponEffect({ traits: ['aquatic'], style: 'melee' }));
      expect(dice._getAutomaticCombatModifiers(actor, item, 'strength', 'might').snag).toBe(false);
    });

    test("Aquatic instead costs ↓3 on land", () => {
      const actor = makeEnvironmentActor({ environment: 'normal' });
      const item = attachWeapon(actor, makeWeaponEffect({ traits: ['aquatic'], style: 'melee' }));
      expect(dice._getAutomaticCombatModifiers(actor, item, 'strength', 'might').shiftDown).toBe(3);
    });

    test("Amphibious never suffers the on-land ↓3", () => {
      const actor = makeEnvironmentActor({ environment: 'normal' });
      const item = attachWeapon(actor, makeWeaponEffect({ traits: ['amphibious'], style: 'melee' }));
      expect(dice._getAutomaticCombatModifiers(actor, item, 'strength', 'might').shiftDown).toBe(0);
    });

    test("Fire damage underwater suffers an automatic ↓2", () => {
      const actor = makeEnvironmentActor({ environment: 'underwater', swimTotal: 30 });
      const item = attachWeapon(actor, makeWeaponEffect({ traits: ['amphibious'], damageType: 'fire' }));
      expect(dice._getAutomaticCombatModifiers(actor, item, 'strength', 'targeting').shiftDown).toBe(2);
    });
  });
});

// A plain Skill Test against someone used to return before the per-target riders ran, so item rules,
// incoming rules and banked bonuses never applied to it (the early `if (!isAttack)` return).
describe("non-attack rolls with a target still get the per-target riders", () => {
  test("a registered roll source applies to a targeted Skill Test", async () => {
    const { registerRollSources } = await import("./mechanics/item-hooks.mjs");
    registerRollSources((actor, target, ctx) => (ctx.rolledSkill == 'zzRiderCheck' && target?.name == 'Rider Target'
      ? { sources: [{ id: 'zzRider', label: 'Rider check', shiftUp: 1 }] }
      : null));
    const targetActor = { name: 'Rider Target', uuid: 'Actor.riderTarget', statuses: new Set(), items: [], system: {}, getFlag: jest.fn() };
    const previous = global.game.user.targets;
    global.game.user.targets = { first: jest.fn(() => ({ actor: targetActor })), size: 1, [Symbol.iterator]: function* () {
      yield { actor: targetActor }; 
    } };
    try {
      const actor = { statuses: new Set(), items: [], system: {}, getFlag: jest.fn() };
      const result = dice._getAutomaticCombatModifiers(actor, null, 'social', 'zzRiderCheck');
      expect(result.sources.map(source => source.id)).toContain('ext-zzRider');
      expect(result.shiftUp).toBeGreaterThanOrEqual(1);
    } finally {
      global.game.user.targets = previous;
    }
  });
});
