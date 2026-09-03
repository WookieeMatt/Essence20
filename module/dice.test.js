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
  user: {
    targets: {
      first: jest.fn(() => undefined),
    },
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
});

/* rollSkill */
describe("rollSkill", () => {
  const dataset = {
    aimBonus: null,
    canCritD2: false,
    defenseType: "none",
    energonAvailable: false,
    essence: 'strength',
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
    expect(dice._rollSkillHelper).toHaveBeenCalledWith('d20 + 0', mockActor, "E20.RollRollingFor E20.SkillAthletics", false, null, { skill: 'athletics', essence: 'strength', snag: false, isPowerWeaponAttack: false, consummatePerformer: false }, false);
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
    expect(dice._rollSkillHelper).toHaveBeenCalledWith('d20 + 0', mockActor, "E20.RollRollingFor E20.SkillAthletics", false, null, { skill: 'athletics', essence: 'strength', snag: false, isPowerWeaponAttack: false, consummatePerformer: false }, false);
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
    expect(dice._rollSkillHelper).toHaveBeenCalledWith('d20 + 0', mockActor, "E20.RollRepeatText<br>E20.RollRollingFor E20.SkillAthletics", false, null, { skill: 'athletics', essence: 'strength', snag: false, isPowerWeaponAttack: false, consummatePerformer: false }, false);
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
    expect(dice._rollSkillHelper).toHaveBeenCalledWith('d20 + 3d6 + 0', mockActor, "E20.RollRollingFor E20.SkillAthletics", false, null, { skill: 'athletics', essence: 'strength', snag: false, isPowerWeaponAttack: false, consummatePerformer: false }, false);
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
    expect(dice._rollSkillHelper).toHaveBeenCalledWith('d20 + 0', mockActor, "E20.RollRollingFor Foo Specialization", false, null, { skill: 'athletics', essence: 'strength', snag: false, isPowerWeaponAttack: false, consummatePerformer: false }, false);
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
    expect(dice._rollSkillHelper).toHaveBeenCalledWith('d20 + 0', mockActor, "E20.RollRollingFor E20.SkillAthletics", false, null, { skill: 'athletics', essence: 'strength', snag: false, isPowerWeaponAttack: false, consummatePerformer: false }, false);
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
      drivingStrikeAvailable: false,
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
    expect(dice._rollSkillHelper).toHaveBeenCalledWith('d20 + 0', mockActor, "E20.RollRollingFor Foo Specialization", false, null, { skill: 'athletics', essence: 'strength', snag: false, isPowerWeaponAttack: false, consummatePerformer: false }, false);
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
      { skill: 'athletics', essence: 'strength', snag: false, isPowerWeaponAttack: false, consummatePerformer: false },
      false,
    );
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
    const powerWeaponActor = {
      ...mockActor,
      items: { get: id => (id === 'weapon1' ? powerWeapon : undefined), some: () => false },
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
      { skill: 'athletics', essence: 'strength', snag: false, isPowerWeaponAttack: true, consummatePerformer: false },
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
    const actor = {
      ...mockActor,
      items: { get: id => (id === 'weapon1' ? mundaneWeapon : undefined), some: () => false },
      getRollData: jest.fn(() => ({
        skills: { athletics: { modifier: '0', shift: 'd20' } },
      })),
    };
    dice._rollSkillHelper = jest.fn();

    await dice.rollSkill(dataset, actor, weaponEffect);
    const rollContext = dice._rollSkillHelper.mock.calls[0][5];
    expect(rollContext.isPowerWeaponAttack).toBe(false);
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
    expect(dice._rollSkillHelper).toHaveBeenCalledWith('d20 + 0', mockActor, "<b>E20.RollTypeSpell</b> - Barreling Beam (E20.SkillSpellcasting)<br><b>E20.ItemDescription</b> - Some description<br>", false, null, { skill: 'spellcasting', essence: 'any', snag: false, isPowerWeaponAttack: false, consummatePerformer: false }, false);
  });

  test("Expertise cancels one point of downshift on its scoped skill", async () => {
    const rollDialog = createMockRollDialog();
    rollDialog.getSkillRollOptions.mockReturnValue({
      canCritD2: false,
      edge: false,
      snag: false,
      shiftUp: 0,
      shiftDown: 0,
      timesToRoll: 1,
    });
    const expertiseActor = {
      ...mockActor,
      // Impaired (helpers via _getAutomaticCombatModifiers) applies to any roll and imposes a
      // downshift regardless of item/target - used here purely as a convenient downshift
      // source, unrelated to Expertise itself, so essenceShifts (mutated by a later test in
      // this describe block via a shallow actor copy) doesn't need to be touched.
      statuses: new Set(['impaired']),
      items: [{
        type: 'perk',
        _stats: { compendiumSource: 'Compendium.essence20.mlp_crb.Item.06cSi4Q1ztUPXWtw' },
        system: { choice: 'athletics' },
      }],
      getRollData: jest.fn(() => ({
        skills: {
          athletics: {
            modifier: '0',
            shift: 'd20',
          },
        },
      })),
    };
    dice._rollSkillHelper = jest.fn();

    const expectedDataset = {
      ...dataset,
      isSpecialized: false,
      shiftUp: 0,
      shiftDown: 0, // would be 1 from Impaired alone - Expertise cancels it back to 0
      drivingStrikeAvailable: false,
    };

    await dice.rollSkill(dataset, expertiseActor, null);
    expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(
      expectedDataset,
      expect.any(Object),
      expertiseActor,
    );
  });

  function makeDrivingStrikeWeaponEffect() {
    return {
      name: 'Psycho Blade',
      type: 'weaponEffect',
      flags: {},
      system: {
        classification: { skill: 'athletics', style: 'melee' },
        damageType: 'blunt',
        damageValue: 1,
        defenseType: 'none',
      },
    };
  }

  function makeDrivingStrikeActor({ hasPerk = true, personalPower = 1, perkViaFlags = false } = {}) {
    return {
      ...mockActor,
      items: hasPerk
        ? [{
          type: 'perk',
          flags: perkViaFlags ? { core: { sourceId: 'Compendium.essence20.finster_s_monster_matic_cookbook.Item.bP55ciUhiMJzyTGC' } } : {},
          _stats: perkViaFlags ? {} : { compendiumSource: 'Compendium.essence20.finster_s_monster_matic_cookbook.Item.bP55ciUhiMJzyTGC' },
        }]
        : [],
      system: { ...mockActor.system, powers: { personal: { value: personalPower } } },
      update: jest.fn(),
      getRollData: jest.fn(() => ({
        skills: { athletics: { modifier: '0', shift: 'd20' } },
      })),
    };
  }

  test("Driving Strike is offered on a melee attack when the actor has it and can afford it", async () => {
    const rollDialog = createMockRollDialog();
    const actor = makeDrivingStrikeActor();
    dice._rollSkillHelper = jest.fn();

    await dice.rollSkill(dataset, actor, makeDrivingStrikeWeaponEffect());
    expect(rollDialog.getSkillRollOptions.mock.calls[0][0]).toMatchObject({ drivingStrikeAvailable: true });
  });

  test("Driving Strike is offered when the Perk was granted via a Role's items map (flags.core.sourceId) - e.g. Path of Flame's own grant, not just a manual drop", async () => {
    const rollDialog = createMockRollDialog();
    const actor = makeDrivingStrikeActor({ perkViaFlags: true });
    dice._rollSkillHelper = jest.fn();

    await dice.rollSkill(dataset, actor, makeDrivingStrikeWeaponEffect());
    expect(rollDialog.getSkillRollOptions.mock.calls[0][0]).toMatchObject({ drivingStrikeAvailable: true });
  });

  test("Driving Strike is not offered without the Perk, without Personal Power, or off a non-melee roll", async () => {
    const rollDialog = createMockRollDialog();
    dice._rollSkillHelper = jest.fn();

    await dice.rollSkill(dataset, makeDrivingStrikeActor({ hasPerk: false }), makeDrivingStrikeWeaponEffect());
    expect(rollDialog.getSkillRollOptions.mock.calls[0][0]).toMatchObject({ drivingStrikeAvailable: false });

    await dice.rollSkill(dataset, makeDrivingStrikeActor({ personalPower: 0 }), makeDrivingStrikeWeaponEffect());
    expect(rollDialog.getSkillRollOptions.mock.calls[1][0]).toMatchObject({ drivingStrikeAvailable: false });

    await dice.rollSkill(dataset, makeDrivingStrikeActor(), null);
    expect(rollDialog.getSkillRollOptions.mock.calls[2][0]).toMatchObject({ drivingStrikeAvailable: false });
  });

  test("choosing Driving Strike's reroll option spends 1 Personal Power and flags the reroll", async () => {
    const rollDialog = createMockRollDialog();
    rollDialog.getSkillRollOptions.mockReturnValue({
      canCritD2: false,
      edge: false,
      snag: false,
      shiftUp: 0,
      shiftDown: 0,
      timesToRoll: 1,
      drivingStrike: 'reroll',
    });
    const actor = makeDrivingStrikeActor();
    dice._rollSkillHelper = jest.fn();

    await dice.rollSkill(dataset, actor, makeDrivingStrikeWeaponEffect());

    expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
    expect(dice._rollSkillHelper.mock.calls[0][6]).toBe(true); // drivingStrikeReroll
  });

  test("choosing Driving Strike's ignore-armor option reduces the target's Defense by its armor component", async () => {
    const rollDialog = createMockRollDialog();
    rollDialog.getSkillRollOptions.mockReturnValue({
      canCritD2: false,
      edge: false,
      snag: false,
      shiftUp: 0,
      shiftDown: 0,
      timesToRoll: 1,
      drivingStrike: 'ignoreArmor',
      defenseType: 'toughness',
    });
    const actor = makeDrivingStrikeActor();
    const targetActor = {
      isMorphed: false,
      system: {
        isMorphed: false,
        defenses: { toughness: { total: 15, armor: 4 } },
      },
      name: 'Target',
      uuid: 'Actor.target1',
    };
    const targetsList = [{ actor: targetActor }];
    targetsList.first = () => undefined; // _getAutomaticCombatModifiers's own unrelated lookup
    global.game.user.targets = targetsList;
    dice._rollSkillHelper = jest.fn();

    try {
      await dice.rollSkill(dataset, actor, makeDrivingStrikeWeaponEffect());

      expect(actor.update).toHaveBeenCalledWith({ 'system.powers.personal.value': 0 });
      const checkContext = dice._rollSkillHelper.mock.calls[0][4];
      expect(checkContext.entries[0].difficulty).toBe(11); // 15 total - 4 armor
    } finally {
      global.game.user.targets = { first: jest.fn(() => undefined) };
    }
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
    const mockShiftedActor = {
      ...mockActor,
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
      drivingStrikeAvailable: false,
    };
    const expectedSkillDataset = {
      edge: true,
      shift: "d20",
      snag: false,
    };

    await dice.rollSkill(dataset, mockShiftedActor, null);
    expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(expectedDataset, expectedSkillDataset, mockShiftedActor);
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

/* _getAutomaticCombatModifiers */
describe("_getAutomaticCombatModifiers", () => {
  function makeActor(size, statuses = []) {
    return {
      system: { size },
      statuses: new Set(statuses),
    };
  }

  const meleeWeaponEffect = {
    type: 'weaponEffect',
    system: { classification: { style: 'melee' } },
  };
  const rangedWeaponEffect = {
    type: 'weaponEffect',
    system: { classification: { style: 'projectile' } },
  };

  beforeEach(() => {
    game.user.targets.first.mockReturnValue(undefined);
  });

  test("non-attack roll ignores target and size", () => {
    game.user.targets.first.mockReturnValue({ actor: makeActor('titanic') });
    const actor = makeActor('small');

    expect(dice._getAutomaticCombatModifiers(actor, null))
      .toEqual({ shiftUp: 0, shiftDown: 0, edge: false, snag: false });
  });

  test("Impaired applies to any roll, including non-attacks", () => {
    const actor = makeActor('common', ['impaired']);

    expect(dice._getAutomaticCombatModifiers(actor, null))
      .toEqual({ shiftUp: 0, shiftDown: 1, edge: false, snag: false });
  });

  test("attack with no target only applies self Conditions", () => {
    const actor = makeActor('common', ['blinded']);

    expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect))
      .toEqual({ shiftUp: 0, shiftDown: 0, edge: false, snag: true });
  });

  test("attack applies Size Class shift from the targeted actor", () => {
    game.user.targets.first.mockReturnValue({ actor: makeActor('titanic') });
    const actor = makeActor('small');

    expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect))
      .toEqual({ shiftUp: 5, shiftDown: 0, edge: false, snag: false });
  });

  test("Prone target grants Edge to a melee attacker", () => {
    game.user.targets.first.mockReturnValue({ actor: makeActor('common', ['prone']) });
    const actor = makeActor('common');

    expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect))
      .toEqual({ shiftUp: 0, shiftDown: 0, edge: true, snag: false });
  });

  test("Prone target grants Snag to a ranged attacker", () => {
    game.user.targets.first.mockReturnValue({ actor: makeActor('common', ['prone']) });
    const actor = makeActor('common');

    expect(dice._getAutomaticCombatModifiers(actor, rangedWeaponEffect))
      .toEqual({ shiftUp: 0, shiftDown: 0, edge: false, snag: true });
  });

  test("Immobilized target grants a shift up", () => {
    game.user.targets.first.mockReturnValue({ actor: makeActor('common', ['immobilized']) });
    const actor = makeActor('common');

    expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect))
      .toEqual({ shiftUp: 1, shiftDown: 0, edge: false, snag: false });
  });

  test("Invisible target grants a Snag", () => {
    game.user.targets.first.mockReturnValue({ actor: makeActor('common', ['invisible']) });
    const actor = makeActor('common');

    expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect))
      .toEqual({ shiftUp: 0, shiftDown: 0, edge: false, snag: true });
  });

  test("attacker's own Prone Condition penalizes only melee attacks", () => {
    const actor = makeActor('common', ['prone']);

    expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect))
      .toEqual({ shiftUp: 0, shiftDown: 1, edge: false, snag: false });
    expect(dice._getAutomaticCombatModifiers(actor, rangedWeaponEffect))
      .toEqual({ shiftUp: 0, shiftDown: 0, edge: false, snag: false });
  });

  test("Edge and Snag from separate sources both surface, left to cancel out downstream", () => {
    game.user.targets.first.mockReturnValue({ actor: makeActor('common', ['invisible', 'stunned']) });
    const actor = makeActor('common');

    expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect))
      .toEqual({ shiftUp: 0, shiftDown: 0, edge: true, snag: true });
  });
});

/* _hasExpertiseDownshiftImmunity */
describe("_hasExpertiseDownshiftImmunity", () => {
  function makeExpertisePerk(compendiumSource, choice) {
    return {
      type: 'perk',
      _stats: { compendiumSource },
      system: { choice },
    };
  }

  test("false with no skill to check", () => {
    const actor = { items: [] };
    expect(dice._hasExpertiseDownshiftImmunity(actor, null)).toBe(false);
  });

  test("false for an actor with no Expertise at all", () => {
    const actor = { items: [] };
    expect(dice._hasExpertiseDownshiftImmunity(actor, 'athletics')).toBe(false);
  });

  test("true when the actor has Expertise (either printing) scoped to the rolled skill", () => {
    const mlpActor = {
      items: [makeExpertisePerk('Compendium.essence20.mlp_crb.Item.06cSi4Q1ztUPXWtw', 'athletics')],
    };
    expect(dice._hasExpertiseDownshiftImmunity(mlpActor, 'athletics')).toBe(true);

    const prActor = {
      items: [makeExpertisePerk('Compendium.essence20.pr_crb.Item.uoCQgYOCeIQNzF0q', 'targeting')],
    };
    expect(dice._hasExpertiseDownshiftImmunity(prActor, 'targeting')).toBe(true);
  });

  test("false when Expertise is scoped to a different skill", () => {
    const actor = {
      items: [makeExpertisePerk('Compendium.essence20.mlp_crb.Item.06cSi4Q1ztUPXWtw', 'athletics')],
    };
    expect(dice._hasExpertiseDownshiftImmunity(actor, 'targeting')).toBe(false);
  });

  test("false for an unrelated perk, even one scoped to the right skill by coincidence", () => {
    const actor = {
      items: [makeExpertisePerk('Compendium.essence20.pr_crb.Item.zEXsqbXfA6hADBuh', 'athletics')],
    };
    expect(dice._hasExpertiseDownshiftImmunity(actor, 'athletics')).toBe(false);
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
});
