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
  },
  user: {
    targets: {
      first: jest.fn(() => undefined),
    },
  },
  combat: null,
};

// Only Enemy Number One (helpers/enemy-number-one.mjs) actually reaches into canvas from this
// file's own tests - every other canvas-touching helper (e.g. getShieldUpgradeBonus) short-
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
});

/* rollSkill */
describe("rollSkill", () => {
  const dataset = {
    aimBonus: null,
    akimboAvailable: false,
    alphaStrikeAvailable: false,
    emptyTheMagAvailable: false,
    canCritD2: false,
    damageRolePoints: null,
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

  describe("damageBonus Role Points (e.g. Sneak Attack Damage)", () => {
    // dataset.dif drives the flat-Difficulty checkContext path (helpers/enrichers.mjs's
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

  describe("Piercing Shot (Sniper Focus, 6th level)", () => {
    const PIERCING_SHOT_ID = "Compendium.essence20.gi_joe_crb.Item.W4PmkxBW7m3j88oF";
    const targetingDataset = { ...dataset, skill: 'targeting', essence: 'speed' };
    const sniperWeaponEffect = {
      name: 'Sniper Rifle Effect',
      type: 'weaponEffect',
      flags: { essence20: { parentId: 'weapon1' } },
      system: { classification: { skill: "targeting" }, damageType: "ballistic", damageValue: 1 },
    };

    function makeActor({ perkIds = [], traits = ['sniper'] } = {}) {
      const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
      items.get = jest.fn(id => (id == 'weapon1' ? { system: { traits } } : null));

      return {
        ...mockActor,
        items,
        getRollData: jest.fn(() => ({ skills: { targeting: { modifier: '0', shift: 'd20', edge: true } } })),
      };
    }

    test("auto-checks canCritD2 with a sniper weapon and Edge", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: true, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(targetingDataset, makeActor({ perkIds: [PIERCING_SHOT_ID] }), sniperWeaponEffect);

      expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(
        expect.objectContaining({ canCritD2: true }), expect.anything(), expect.anything(),
      );
    });

    test("doesn't apply without Edge", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();
      const actor = makeActor({ perkIds: [PIERCING_SHOT_ID] });
      actor.getRollData = jest.fn(() => ({ skills: { targeting: { modifier: '0', shift: 'd20', edge: false } } }));

      await dice.rollSkill(targetingDataset, actor, sniperWeaponEffect);

      expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(
        expect.objectContaining({ canCritD2: false }), expect.anything(), expect.anything(),
      );
    });

    test("doesn't apply to a non-sniper weapon", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: true, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(targetingDataset, makeActor({ perkIds: [PIERCING_SHOT_ID], traits: ['ballistic'] }), sniperWeaponEffect);

      expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(
        expect.objectContaining({ canCritD2: false }), expect.anything(), expect.anything(),
      );
    });
  });

  describe("Silent Weapon Expertise (Ranger's Environmental Exposure choice, p.91)", () => {
    const SILENT_WEAPON_EXPERTISE_ID = "Compendium.essence20.gi_joe_crb.Item.JKn8mFG98ZzmiFSd";
    const silentWeaponEffect = {
      name: 'Silenced Pistol Effect',
      type: 'weaponEffect',
      flags: { essence20: { parentId: 'weapon1' } },
      system: { classification: { skill: "athletics" }, damageType: "blunt", damageValue: 1 },
    };

    // A fresh, isolated essenceShifts rather than the shared mockActor.system reference - other
    // describe blocks in this file mutate mockActor.system.essenceShifts.strength in place (a
    // pre-existing shallow-copy quirk of `{...mockActor}`), which would otherwise leak into these
    // shiftUp assertions depending on test execution order.
    function makeActor({ perkIds = [], traits = ['silent'] } = {}) {
      const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
      items.get = jest.fn(id => (id == 'weapon1' ? { system: { traits } } : null));

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
        getRollData: jest.fn(() => ({ skills: { athletics: { modifier: '0', shift: 'd20' } } })),
      };
    }

    test("adds a shiftUp of 1 against a silent-trait weapon", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(dataset, makeActor({ perkIds: [SILENT_WEAPON_EXPERTISE_ID] }), silentWeaponEffect);

      expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(
        expect.objectContaining({ shiftUp: 1 }), expect.anything(), expect.anything(),
      );
    });

    test("doesn't apply to a non-silent weapon", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(
        dataset, makeActor({ perkIds: [SILENT_WEAPON_EXPERTISE_ID], traits: ['ballistic'] }), silentWeaponEffect,
      );

      expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(
        expect.objectContaining({ shiftUp: 0 }), expect.anything(), expect.anything(),
      );
    });

    test("doesn't apply without the Perk", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(dataset, makeActor(), silentWeaponEffect);

      expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(
        expect.objectContaining({ shiftUp: 0 }), expect.anything(), expect.anything(),
      );
    });
  });

  describe("Warfighter (Infantry base, 17th level)", () => {
    const WARFIGHTER_ID = "Compendium.essence20.gi_joe_crb.Item.P0ZTAlcenVw2p4P1";
    const difDataset = { ...dataset, skill: 'targeting', essence: 'speed', dif: '10' };
    const targetingWeaponEffect = {
      name: 'Rifle Effect',
      type: 'weaponEffect',
      flags: {},
      system: { classification: { skill: "targeting" }, damageType: "ballistic", damageValue: 1 },
    };
    const meleeWeaponEffect = {
      ...targetingWeaponEffect,
      system: { classification: { skill: "finesse" }, damageType: "sharp", damageValue: 1 },
    };

    function makeActor(perkIds = []) {
      const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
      items.get = jest.fn(() => null);

      return {
        ...mockActor,
        items,
        getRollData: jest.fn(() => ({ skills: { targeting: { modifier: '0', shift: 'd20' } } })),
      };
    }

    test("pre-fills isSpecialized for a Targeting weapon attack", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(difDataset, makeActor([WARFIGHTER_ID]), targetingWeaponEffect);

      expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(
        expect.objectContaining({ isSpecialized: true }), expect.anything(), expect.anything(),
      );
    });

    test("adds +2 to checkContext.damageValue for a Targeting weapon attack", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(difDataset, makeActor([WARFIGHTER_ID]), targetingWeaponEffect);

      const checkContext = dice._rollSkillHelper.mock.calls[0][4];
      expect(checkContext.damageValue).toBe(3); // 1 (weapon) + 2 (Warfighter)
    });

    test("doesn't apply to a non-Targeting weapon", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();
      const meleeDataset = { ...difDataset, skill: 'finesse' };
      const actor = makeActor([WARFIGHTER_ID]);
      actor.getRollData = jest.fn(() => ({ skills: { finesse: { modifier: '0', shift: 'd20' } } }));

      await dice.rollSkill(meleeDataset, actor, meleeWeaponEffect);

      expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(
        expect.objectContaining({ isSpecialized: false }), expect.anything(), expect.anything(),
      );
      const checkContext = dice._rollSkillHelper.mock.calls[0][4];
      expect(checkContext.damageValue).toBe(1);
    });

    test("doesn't apply without the Perk", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(difDataset, makeActor(), targetingWeaponEffect);

      expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(
        expect.objectContaining({ isSpecialized: false }), expect.anything(), expect.anything(),
      );
      const checkContext = dice._rollSkillHelper.mock.calls[0][4];
      expect(checkContext.damageValue).toBe(1);
    });
  });

  describe("Assault Precision (Door-Kicker Focus, 17th level)", () => {
    const ASSAULT_PRECISION_ID = "Compendium.essence20.gi_joe_crb.Item.KZAmBNsIW03H6xQh";
    const SHOTGUN_ID = "Compendium.essence20.gi_joe_crb.Item.2qW1YLopvjKyezNQ";
    const targetingDataset = { ...dataset, skill: 'targeting', essence: 'speed' };
    const shotgunWeaponEffect = {
      name: 'Shotgun Effect',
      type: 'weaponEffect',
      flags: { essence20: { parentId: 'weapon1' } },
      system: { classification: { skill: "targeting" }, damageType: "blunt", damageValue: 1 },
    };

    function makeActor({ perkIds = [], weaponSourceId = SHOTGUN_ID } = {}) {
      const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
      items.get = jest.fn(id => (id == 'weapon1'
        ? { flags: { core: { sourceId: weaponSourceId } }, system: {} }
        : null));

      return {
        ...mockActor,
        items,
        getRollData: jest.fn(() => ({ skills: { targeting: { modifier: '0', shift: 'd20', edge: false } } })),
      };
    }

    test("auto-checks canCritD2 with a Shotgun, no Edge required", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(targetingDataset, makeActor({ perkIds: [ASSAULT_PRECISION_ID] }), shotgunWeaponEffect);

      expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(
        expect.objectContaining({ canCritD2: true }), expect.anything(), expect.anything(),
      );
    });

    test("also applies to a Submachine Gun", async () => {
      const SUBMACHINE_GUN_ID = "Compendium.essence20.gi_joe_crb.Item.oJInlAgdYZzjH7bk";
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();
      const actor = makeActor({ perkIds: [ASSAULT_PRECISION_ID], weaponSourceId: SUBMACHINE_GUN_ID });

      await dice.rollSkill(targetingDataset, actor, shotgunWeaponEffect);

      expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(
        expect.objectContaining({ canCritD2: true }), expect.anything(), expect.anything(),
      );
    });

    test("doesn't apply to an unrelated weapon", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();
      const actor = makeActor({
        perkIds: [ASSAULT_PRECISION_ID], weaponSourceId: "Compendium.essence20.gi_joe_crb.Item.otherWeapon",
      });

      await dice.rollSkill(targetingDataset, actor, shotgunWeaponEffect);

      expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(
        expect.objectContaining({ canCritD2: false }), expect.anything(), expect.anything(),
      );
    });

    test("doesn't apply without the Perk", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(targetingDataset, makeActor(), shotgunWeaponEffect);

      expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(
        expect.objectContaining({ canCritD2: false }), expect.anything(), expect.anything(),
      );
    });
  });

  describe("Eureka / Expert in Your Field / Influential (Technician/Expert Focus, p.104)", () => {
    const FIELD_ID = "Compendium.essence20.gi_joe_crb.Item.qHLeKSMin2F19O3C";
    const EUREKA_ID = "Compendium.essence20.gi_joe_crb.Item.I8gudNc8gLD63ziL";
    const EXPERT_IN_YOUR_FIELD_ID = "Compendium.essence20.gi_joe_crb.Item.mnLXHQ2TwR3A42fS";
    const INFLUENTIAL_ID = "Compendium.essence20.gi_joe_crb.Item.TyQoZb2RTZWUwbpu";
    const scienceDataset = { ...dataset, skill: 'science', essence: 'smarts' };

    function makeActor({ perkIds = [], field = 'science', edge = false } = {}) {
      const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
      if (field) {
        items.push({
          type: 'perk', flags: { core: { sourceId: FIELD_ID } }, system: { choice: field },
        });
      }

      items.get = jest.fn(() => null);

      return {
        ...mockActor,
        items,
        getRollData: jest.fn(() => ({ skills: { science: { modifier: '0', shift: 'd20', edge } } })),
      };
    }

    test("Eureka auto-checks canCritD2 for a Field Skill Test", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(scienceDataset, makeActor({ perkIds: [EUREKA_ID] }), null);

      expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(
        expect.objectContaining({ canCritD2: true }), expect.anything(), expect.anything(),
      );
    });

    test("Eureka doesn't apply to a skill other than the actor's Field", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(scienceDataset, makeActor({ perkIds: [EUREKA_ID], field: 'technology' }), null);

      expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(
        expect.objectContaining({ canCritD2: false }), expect.anything(), expect.anything(),
      );
    });

    test("Eureka doesn't apply without a Field chosen at all", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(scienceDataset, makeActor({ perkIds: [EUREKA_ID], field: null }), null);

      expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(
        expect.objectContaining({ canCritD2: false }), expect.anything(), expect.anything(),
      );
    });

    test("Eureka doesn't apply without the Perk itself", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(scienceDataset, makeActor(), null);

      expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(
        expect.objectContaining({ canCritD2: false }), expect.anything(), expect.anything(),
      );
    });

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

    function makeToken({ actor, disposition = 1 } = {}) {
      return { actor, document: { disposition }, center: {} };
    }

    function makeAllyWithInfluential({ field = 'science', hasPerk = true } = {}) {
      const items = [];
      if (hasPerk) {
        items.push({ type: 'perk', flags: { core: { sourceId: INFLUENTIAL_ID } } });
      }

      if (field) {
        items.push({ type: 'perk', flags: { core: { sourceId: FIELD_ID } }, system: { choice: field } });
      }

      return { id: 'influentialAlly', items };
    }

    let rollerActor;
    beforeEach(() => {
      canvas.tokens.placeables = [];
      canvas.grid.measurePath.mockReset();
      canvas.grid.measurePath.mockReturnValue({ distance: 5 });
      rollerActor = makeActor({ field: null });
      const rollerToken = makeToken({ actor: rollerActor });
      rollerActor.getActiveTokens = jest.fn(() => [rollerToken]);
      canvas.tokens.placeables = [rollerToken];
    });

    test("Influential grants +1 from a nearby ally whose Field matches the rolled skill", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 1, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();
      canvas.tokens.placeables.push(makeToken({ actor: makeAllyWithInfluential({ field: 'science' }) }));

      await dice.rollSkill(scienceDataset, rollerActor, null);

      expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(
        expect.objectContaining({ shiftUp: 1 }), expect.anything(), expect.anything(),
      );
    });

    test("Influential doesn't apply when the ally's Field doesn't match the rolled skill", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();
      canvas.tokens.placeables.push(makeToken({ actor: makeAllyWithInfluential({ field: 'technology' }) }));

      await dice.rollSkill(scienceDataset, rollerActor, null);

      expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(
        expect.objectContaining({ shiftUp: 0 }), expect.anything(), expect.anything(),
      );
    });

    test("Influential doesn't apply without the Perk, even with a matching Field", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();
      canvas.tokens.placeables.push(
        makeToken({ actor: makeAllyWithInfluential({ field: 'science', hasPerk: false }) }),
      );

      await dice.rollSkill(scienceDataset, rollerActor, null);

      expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(
        expect.objectContaining({ shiftUp: 0 }), expect.anything(), expect.anything(),
      );
    });
  });

  describe("Penetrating Rounds (Door-Kicker Focus, 20th level, p.100) - deflective armor half", () => {
    // The "ignores cover" half lives in _getAutomaticCombatModifiers - see its own describe block
    // nested under "Cover (p.202)" above. This half is target Defense math instead, so it's only
    // reachable through the full rollSkill() Defense-comparison step (checkContext.entries),
    // not through _getAutomaticCombatModifiers at all.
    const PENETRATING_ROUNDS_ID = "Compendium.essence20.gi_joe_crb.Item.JLwbWSlHn5q3rqnH";
    const SHOTGUN_ID = "Compendium.essence20.gi_joe_crb.Item.2qW1YLopvjKyezNQ";
    const targetingDataset = { ...dataset, skill: 'targeting', essence: 'speed' };
    const shotgunWeaponEffect = {
      name: 'Shotgun Effect',
      type: 'weaponEffect',
      flags: { essence20: { parentId: 'weapon1' } },
      system: { classification: { skill: "targeting" }, damageType: "blunt", damageValue: 1 },
    };

    function makeActor({ perkIds = [], weaponSourceId = SHOTGUN_ID } = {}) {
      const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
      items.get = jest.fn(id => (id == 'weapon1'
        ? { flags: { core: { sourceId: weaponSourceId } }, system: {} }
        : null));

      return {
        ...mockActor,
        items,
        getRollData: jest.fn(() => ({ skills: { targeting: { modifier: '0', shift: 'd20' } } })),
      };
    }

    function makeTargetActor({ toughness = 12, deflectiveBonus = 0, otherArmorBonus = 0 } = {}) {
      const armorItems = [];
      if (deflectiveBonus) {
        armorItems.push({
          type: 'armor',
          system: { equipped: true, traits: ['deflective'], totalBonusToughness: deflectiveBonus },
        });
      }

      if (otherArmorBonus) {
        armorItems.push({
          type: 'armor',
          system: { equipped: true, traits: ['padded'], totalBonusToughness: otherArmorBonus },
        });
      }

      // items needs to behave like a real Foundry EmbeddedCollection - array-like (.find()/.some(),
      // used by helpers/perks.mjs#actorHasPerk against the target inside _getAutomaticCombatModifiers)
      // AND carry .documentsByType (used by this describe block's own armor scan).
      const items = [];
      items.documentsByType = { armor: armorItems };

      return {
        name: 'Target',
        uuid: 'Actor.target1',
        system: { defenses: { toughness: { total: toughness } }, immunities: {}, size: 'common' },
        statuses: new Set(),
        items,
      };
    }

    // game.user.targets is a real Foundry UserTargets - a Set with an extra .first() convenience
    // method - and both shapes get read here: rollSkill()'s own checkEntries step iterates it
    // (Array.from), while _getAutomaticCombatModifiers (called first, from inside rollSkill) only
    // ever calls .first().
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

    test("subtracts the target's deflective armor bonus from the Toughness difficulty", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'toughness',
      });
      dice._rollSkillHelper = jest.fn();
      game.user.targets = makeTargetsSet(makeTargetActor({ toughness: 12, deflectiveBonus: 4 }));

      await dice.rollSkill(targetingDataset, makeActor({ perkIds: [PENETRATING_ROUNDS_ID] }), shotgunWeaponEffect);

      expect(dice._rollSkillHelper).toHaveBeenCalledWith(
        expect.anything(), expect.anything(), expect.anything(), expect.anything(),
        expect.objectContaining({
          entries: expect.arrayContaining([expect.objectContaining({ difficulty: 8 })]),
        }),
        expect.anything(), expect.anything(),
      );
    });

    test("doesn't touch a non-deflective armor bonus", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'toughness',
      });
      dice._rollSkillHelper = jest.fn();
      game.user.targets = makeTargetsSet(makeTargetActor({ toughness: 12, otherArmorBonus: 4 }));

      await dice.rollSkill(targetingDataset, makeActor({ perkIds: [PENETRATING_ROUNDS_ID] }), shotgunWeaponEffect);

      expect(dice._rollSkillHelper).toHaveBeenCalledWith(
        expect.anything(), expect.anything(), expect.anything(), expect.anything(),
        expect.objectContaining({
          entries: expect.arrayContaining([expect.objectContaining({ difficulty: 12 })]),
        }),
        expect.anything(), expect.anything(),
      );
    });

    test("doesn't apply without the Perk", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'toughness',
      });
      dice._rollSkillHelper = jest.fn();
      game.user.targets = makeTargetsSet(makeTargetActor({ toughness: 12, deflectiveBonus: 4 }));

      await dice.rollSkill(targetingDataset, makeActor(), shotgunWeaponEffect);

      expect(dice._rollSkillHelper).toHaveBeenCalledWith(
        expect.anything(), expect.anything(), expect.anything(), expect.anything(),
        expect.objectContaining({
          entries: expect.arrayContaining([expect.objectContaining({ difficulty: 12 })]),
        }),
        expect.anything(), expect.anything(),
      );
    });

    test("doesn't apply with an unrelated weapon", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'toughness',
      });
      dice._rollSkillHelper = jest.fn();
      game.user.targets = makeTargetsSet(makeTargetActor({ toughness: 12, deflectiveBonus: 4 }));

      await dice.rollSkill(
        targetingDataset,
        makeActor({ perkIds: [PENETRATING_ROUNDS_ID], weaponSourceId: "Compendium.essence20.gi_joe_crb.Item.other" }),
        shotgunWeaponEffect,
      );

      expect(dice._rollSkillHelper).toHaveBeenCalledWith(
        expect.anything(), expect.anything(), expect.anything(), expect.anything(),
        expect.objectContaining({
          entries: expect.arrayContaining([expect.objectContaining({ difficulty: 12 })]),
        }),
        expect.anything(), expect.anything(),
      );
    });

    test("doesn't apply to a non-Toughness Defense comparison", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'evasion',
      });
      dice._rollSkillHelper = jest.fn();
      const targetActor = makeTargetActor({ toughness: 12, deflectiveBonus: 4 });
      targetActor.system.defenses.evasion = { total: 10 };
      game.user.targets = makeTargetsSet(targetActor);

      await dice.rollSkill(targetingDataset, makeActor({ perkIds: [PENETRATING_ROUNDS_ID] }), shotgunWeaponEffect);

      expect(dice._rollSkillHelper).toHaveBeenCalledWith(
        expect.anything(), expect.anything(), expect.anything(), expect.anything(),
        expect.objectContaining({
          entries: expect.arrayContaining([expect.objectContaining({ difficulty: 10 })]),
        }),
        expect.anything(), expect.anything(),
      );
    });
  });

  describe("Roll With the Punches (Renegade/Tank Focus, 6th level, p.97)", () => {
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
        getFlag: jest.fn((scope, key) => (
          key == 'pendingRollWithThePunches' && pendingDefenseType
            ? { defenseType: pendingDefenseType, combatId: null, round: null }
            : undefined
        )),
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
      expect(target.unsetFlag).toHaveBeenCalledWith('essence20', 'pendingRollWithThePunches');
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
      expect(target.unsetFlag).not.toHaveBeenCalled();
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

  describe("Silver Tongue (Spy Focus, 6th level)", () => {
    const SILVER_TONGUE_ID = "Compendium.essence20.gi_joe_crb.Item.69ijP0SuQ4demwd9";
    const socialDataset = { ...dataset, skill: 'persuasion', essence: 'social' };

    function makeActor(perkIds = []) {
      const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
      items.get = jest.fn(() => null);

      return {
        ...mockActor,
        items,
        getRollData: jest.fn(() => ({
          skills: {
            persuasion: { modifier: '0', shift: 'd20' },
            athletics: { modifier: '0', shift: 'd20' },
          },
        })),
      };
    }

    test("floors the d20 term at 10 on a Social roll", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(socialDataset, makeActor([SILVER_TONGUE_ID]), null);

      expect(dice._rollSkillHelper.mock.calls[0][0]).toContain('min10');
    });

    test("doesn't apply to a non-Social roll", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(dataset, makeActor([SILVER_TONGUE_ID]), null);

      expect(dice._rollSkillHelper.mock.calls[0][0]).not.toContain('min10');
    });
  });

  describe("Reckless Abandon (Renegade base, p.94)", () => {
    const RECKLESS_ABANDON_ID = "Compendium.essence20.gi_joe_crb.Item.84d0XTJwKCYMJUgY";
    const HARDENED_ID = "Compendium.essence20.gi_joe_crb.Item.f7d5bkyxVpbR4dAe";
    const strengthDataset = { ...dataset, skill: 'athletics', essence: 'strength' };

    // A fresh, isolated essenceShifts rather than the shared mockActor.system reference - see the
    // identical comment on Silent Weapon Expertise's own makeActor() below for why.
    function makeActor({ isActive = true, armor = [], perkIds = [] } = {}) {
      const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
      items.get = jest.fn(() => null);
      items.documentsByType = { armor };

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
        getRollData: jest.fn(() => ({ skills: { athletics: { modifier: '0', shift: 'd20' } } })),
        _getBaseRolePoints: jest.fn(() => ({
          name: 'Reckless Adandon',
          flags: { core: { sourceId: RECKLESS_ABANDON_ID } },
          system: { bonus: { type: 'healthBonus' }, isActivatable: true, isActive },
        })),
      };
    }

    // The bonus is a shiftUp pre-fill, same shape as Silent Weapon Expertise/Warfighter above -
    // checked via what gets passed into the Roll Options Dialog, not the final formula string
    // (createMockRollDialog's own mock return doesn't echo the input shiftUp back).
    test("pre-fills a shiftUp of 2 on a Strength roll while active and unarmored", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(strengthDataset, makeActor(), null);

      expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(
        expect.objectContaining({ shiftUp: 2 }), expect.anything(), expect.anything(),
      );
    });

    test("doesn't apply when Reckless Abandon isn't Active", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(strengthDataset, makeActor({ isActive: false }), null);

      expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(
        expect.objectContaining({ shiftUp: 0 }), expect.anything(), expect.anything(),
      );
    });

    test("doesn't apply to a non-Strength roll", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();
      const socialDataset = { ...dataset, skill: 'persuasion', essence: 'social' };
      const actor = makeActor();
      actor.getRollData = jest.fn(() => ({ skills: { persuasion: { modifier: '0', shift: 'd20' } } }));

      await dice.rollSkill(socialDataset, actor, null);

      expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(
        expect.objectContaining({ shiftUp: 0 }), expect.anything(), expect.anything(),
      );
    });

    test("doesn't apply while wearing Medium armor without Hardened", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();
      const actor = makeActor({ armor: [{ system: { classification: 'medium', equipped: true } }] });

      await dice.rollSkill(strengthDataset, actor, null);

      expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(
        expect.objectContaining({ shiftUp: 0 }), expect.anything(), expect.anything(),
      );
    });

    test("applies while wearing Medium armor with Hardened", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();
      const actor = makeActor({
        armor: [{ system: { classification: 'medium', equipped: true } }], perkIds: [HARDENED_ID],
      });

      await dice.rollSkill(strengthDataset, actor, null);

      expect(rollDialog.getSkillRollOptions).toHaveBeenCalledWith(
        expect.objectContaining({ shiftUp: 2 }), expect.anything(), expect.anything(),
      );
    });
  });

  describe("Quiet as the Grave (Infiltrator Focus, 20th level)", () => {
    const QUIET_AS_THE_GRAVE_ID = "Compendium.essence20.gi_joe_crb.Item.UJTt3hP5OwQHBcpf";
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

    test("doubles the damage bonus when checked and eligible", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        applyRolePointsDamage: true, applyDamageDouble: true,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(difDataset, makeSneakAttackActor([QUIET_AS_THE_GRAVE_ID]), weaponEffect);

      const checkContext = dice._rollSkillHelper.mock.calls[0][4];
      expect(checkContext.damageValue).toBe(7); // 1 (weapon) + 3*2 (doubled Sneak Attack bonus)
    });

    test("isn't offered without the Perk", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        applyRolePointsDamage: true, applyDamageDouble: true, // even if somehow checked
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(difDataset, makeSneakAttackActor(), weaponEffect);

      const checkContext = dice._rollSkillHelper.mock.calls[0][4];
      expect(checkContext.damageValue).toBe(4); // not doubled
    });
  });

  describe("Debilitating Strike (16th level) - flagged onto checkContext", () => {
    const DEBILITATING_STRIKE_ID = "Compendium.essence20.gi_joe_crb.Item.dYaTU9IYI3vB5eHs";
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

    test("is flagged true when the roller has the Perk and Sneak Attack Damage lands", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        applyRolePointsDamage: true,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(difDataset, makeSneakAttackActor([DEBILITATING_STRIKE_ID]), weaponEffect);

      const checkContext = dice._rollSkillHelper.mock.calls[0][4];
      expect(checkContext.debilitatingStrike).toBe(true);
    });

    test("is false without the Perk", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        applyRolePointsDamage: true,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(difDataset, makeSneakAttackActor(), weaponEffect);

      const checkContext = dice._rollSkillHelper.mock.calls[0][4];
      expect(checkContext.debilitatingStrike).toBe(false);
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

  describe("Shock and Awe (Artillery Focus, 10th level) - flagged onto checkContext", () => {
    const SHOCK_AND_AWE_ID = "Compendium.essence20.gi_joe_crb.Item.a5HptfB7nYFLVHkc";
    const difDataset = { ...dataset, dif: '10' };
    const explosiveWeaponEffect = {
      name: 'Artillery Lobber Effect',
      type: 'weaponEffect',
      flags: {},
      system: { classification: { skill: "targeting", style: "explosive" }, damageType: "blunt", damageValue: 1 },
    };
    const projectileWeaponEffect = {
      ...explosiveWeaponEffect,
      system: { classification: { skill: "targeting", style: "projectile" }, damageType: "blunt", damageValue: 1 },
    };

    function makeActor(perkIds = []) {
      const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
      items.get = jest.fn(() => null);

      return {
        ...mockActor,
        items,
        getRollData: jest.fn(() => ({ skills: { athletics: { modifier: '0', shift: 'd20' } } })),
      };
    }

    test("is flagged true with the Perk and an explosive-style weapon", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(difDataset, makeActor([SHOCK_AND_AWE_ID]), explosiveWeaponEffect);

      const checkContext = dice._rollSkillHelper.mock.calls[0][4];
      expect(checkContext.shockAndAwe).toBe(true);
    });

    test("is false without the Perk", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(difDataset, makeActor(), explosiveWeaponEffect);

      const checkContext = dice._rollSkillHelper.mock.calls[0][4];
      expect(checkContext.shockAndAwe).toBe(false);
    });

    test("is false for a non-explosive-style weapon even with the Perk", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(difDataset, makeActor([SHOCK_AND_AWE_ID]), projectileWeaponEffect);

      const checkContext = dice._rollSkillHelper.mock.calls[0][4];
      expect(checkContext.shockAndAwe).toBe(false);
    });

    test("doesn't depend on Sneak Attack Damage being applied", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        applyRolePointsDamage: false,
      });
      dice._rollSkillHelper = jest.fn();
      const actor = makeActor([SHOCK_AND_AWE_ID]);
      actor._getBaseRolePoints = jest.fn(() => null);

      await dice.rollSkill(difDataset, actor, explosiveWeaponEffect);

      const checkContext = dice._rollSkillHelper.mock.calls[0][4];
      expect(checkContext.shockAndAwe).toBe(true);
    });
  });

  describe("Akimbo (Fighting Style option, p.79/108)", () => {
    const FIGHTING_STYLE_ID = "Compendium.essence20.gi_joe_crb.Item.2LtDCHxgg9bMvWQK";
    const akimboDataset = { ...dataset, skill: 'targeting' };
    const rangedWeaponEffect = {
      name: 'Pistol Effect',
      type: 'weaponEffect',
      flags: {},
      system: { classification: { skill: "targeting", style: "projectile" }, damageType: "ballistic", damageValue: 1 },
    };

    function makeAkimboActor() {
      return {
        ...mockActor,
        items: [
          { type: 'perk', flags: { core: { sourceId: FIGHTING_STYLE_ID } }, system: { choice: 'akimbo' } },
        ],
        getRollData: jest.fn(() => ({ skills: { targeting: { modifier: '0', shift: 'd20', edge: false, snag: false } } })),
      };
    }

    test("akimboAvailable is true for a ranged attack with the Fighting Style choice", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(akimboDataset, makeAkimboActor(), rangedWeaponEffect);

      expect(rollDialog.getSkillRollOptions.mock.calls[0][0]).toMatchObject({ akimboAvailable: true });
    });

    test("akimboAvailable is false without the Fighting Style choice", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();
      const actorWithoutFightingStyle = {
        ...mockActor,
        getRollData: jest.fn(() => ({ skills: { targeting: { modifier: '0', shift: 'd20', edge: false, snag: false } } })),
      };

      await dice.rollSkill(akimboDataset, actorWithoutFightingStyle, rangedWeaponEffect);

      expect(rollDialog.getSkillRollOptions.mock.calls[0][0]).toMatchObject({ akimboAvailable: false });
    });

    test("checking the Akimbo toggle upshifts the roll", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, akimbo: true,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(akimboDataset, makeAkimboActor(), rangedWeaponEffect);

      expect(dice._rollSkillHelper.mock.calls[0][0]).toBe('d20 + d2 + 0');
    });
  });

  describe("Trigger Happy (Fighting Style option, p.79/108)", () => {
    const FIGHTING_STYLE_ID = "Compendium.essence20.gi_joe_crb.Item.2LtDCHxgg9bMvWQK";
    const multipleTargetsWeaponEffect = {
      name: 'LMG Effect',
      type: 'weaponEffect',
      flags: { essence20: { parentId: 'weapon1' } },
      system: { classification: { skill: "targeting", style: "projectile" }, damageType: "ballistic", damageValue: 1 },
    };
    const targetingDataset = { ...dataset, defenseType: 'toughness', skill: 'targeting' };

    function makeTriggerHappyActor(weapon) {
      const items = [
        { type: 'perk', flags: { core: { sourceId: FIGHTING_STYLE_ID } }, system: { choice: 'triggerHappy' } },
      ];
      items.get = jest.fn(() => weapon);

      return {
        ...mockActor,
        items,
        getRollData: jest.fn(() => ({ skills: { targeting: { modifier: '0', shift: 'd20', edge: false, snag: false } } })),
      };
    }

    function makeTargetsSet(targetActor) {
      const token = { actor: targetActor, center: { x: 0, y: 0 } };
      const set = new Set([token]);
      set.first = () => token;

      return set;
    }

    function makeTargetActor(willpower = 14) {
      return {
        name: 'Target',
        uuid: 'Actor.target1',
        system: { defenses: { toughness: { total: 10 }, willpower: { total: willpower } }, immunities: {}, size: 'common' },
        statuses: new Set(),
        items: [],
      };
    }

    let originalTargets;
    beforeEach(() => {
      originalTargets = game.user.targets;
    });
    afterEach(() => {
      game.user.targets = originalTargets;
    });

    test("flags triggerHappy true and threads a Willpower difficulty per target, with the Perk and a Multiple Targets weapon", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'toughness',
      });
      dice._rollSkillHelper = jest.fn();
      const weapon = { system: { itemAndUpgradeTraits: ['multipleTargets'] } };
      game.user.targets = makeTargetsSet(makeTargetActor(14));

      await dice.rollSkill(targetingDataset, makeTriggerHappyActor(weapon), multipleTargetsWeaponEffect);

      const checkContext = dice._rollSkillHelper.mock.calls[0][4];
      expect(checkContext.triggerHappy).toBe(true);
      expect(checkContext.entries[0].willpowerDifficulty).toBe(14);
    });

    test("is false without the Fighting Style choice", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'toughness',
      });
      dice._rollSkillHelper = jest.fn();
      const weapon = { system: { itemAndUpgradeTraits: ['multipleTargets'] } };
      game.user.targets = makeTargetsSet(makeTargetActor());

      const actorWithoutFightingStyle = {
        ...mockActor,
        items: Object.assign([], { get: () => weapon }),
        getRollData: jest.fn(() => ({ skills: { targeting: { modifier: '0', shift: 'd20', edge: false, snag: false } } })),
      };

      await dice.rollSkill(targetingDataset, actorWithoutFightingStyle, multipleTargetsWeaponEffect);

      const checkContext = dice._rollSkillHelper.mock.calls[0][4];
      expect(checkContext.triggerHappy).toBe(false);
      expect(checkContext.entries[0].willpowerDifficulty).toBe(null);
    });

    test("is false for a weapon without the Multiple Targets trait, even with the Fighting Style choice", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, defenseType: 'toughness',
      });
      dice._rollSkillHelper = jest.fn();
      const weapon = { system: { itemAndUpgradeTraits: [] } };
      game.user.targets = makeTargetsSet(makeTargetActor());

      await dice.rollSkill(targetingDataset, makeTriggerHappyActor(weapon), multipleTargetsWeaponEffect);

      const checkContext = dice._rollSkillHelper.mock.calls[0][4];
      expect(checkContext.triggerHappy).toBe(false);
      expect(checkContext.entries[0].willpowerDifficulty).toBe(null);
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
      expect(firstContext.entries).toEqual([{ name: 'Alpha', targetUuid: 'Actor.Alpha', difficulty: 10, willpowerDifficulty: null }]);
      expect(secondContext.entries).toEqual([{ name: 'Bravo', targetUuid: 'Actor.Bravo', difficulty: 15, willpowerDifficulty: null }]);
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
      // checkContext.isMultipleTargetsWeapon (Nowhere Is Safe/No Need to Aim's own read of this)
      // is a fact about the weapon itself, not about whether THIS roll actually dispatched
      // independently.
      expect(dice._rollSkillHelper.mock.calls[0][4].isMultipleTargetsWeapon).toBe(false);
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
      // Still true even with just 1 target - the weapon carries the trait regardless of how many
      // targets this particular roll happens to have (unlike the independent-roll dispatch
      // itself, which does need 2+ to mean anything).
      expect(dice._rollSkillHelper.mock.calls[0][4].isMultipleTargetsWeapon).toBe(true);
    });
  });

  describe("Alpha Strike (Door-Kicker Focus, 3rd level, p.98)", () => {
    const ALPHA_STRIKE_ID = "Compendium.essence20.gi_joe_crb.Item.9EWv3qQJgj7WFQ9A";
    const SHOTGUN_ID = "Compendium.essence20.gi_joe_crb.Item.2qW1YLopvjKyezNQ";
    const mightMeleeWeaponEffect = {
      name: 'Fists',
      type: 'weaponEffect',
      flags: {},
      system: { classification: { skill: "might", style: "melee" }, damageType: "blunt", damageValue: 1 },
    };
    const shotgunTargetingWeaponEffect = {
      name: 'Shotgun Effect',
      type: 'weaponEffect',
      flags: { essence20: { parentId: 'weapon1' } },
      system: { classification: { skill: "targeting", style: "projectile" }, damageType: "ballistic", damageValue: 1 },
    };
    const rifleTargetingWeaponEffect = {
      name: 'Rifle Effect',
      type: 'weaponEffect',
      flags: { essence20: { parentId: 'weapon1' } },
      system: { classification: { skill: "targeting", style: "projectile" }, damageType: "ballistic", damageValue: 1 },
    };
    const mightDataset = { ...dataset, skill: 'might' };
    const targetingDataset = { ...dataset, skill: 'targeting' };

    function makeAlphaStrikeActor(weapon = null) {
      const items = [
        { type: 'perk', flags: { core: { sourceId: ALPHA_STRIKE_ID } } },
      ];
      items.get = jest.fn(() => weapon);

      return {
        ...mockActor,
        items,
        getRollData: jest.fn(() => ({
          skills: {
            might: { modifier: '0', shift: 'd20', edge: false, snag: false },
            targeting: { modifier: '0', shift: 'd20', edge: false, snag: false },
          },
        })),
      };
    }

    test("alphaStrikeAvailable is true for a Might attack with the Perk", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      await dice.rollSkill(mightDataset, makeAlphaStrikeActor(), mightMeleeWeaponEffect);

      expect(rollDialog.getSkillRollOptions.mock.calls[0][0]).toMatchObject({ alphaStrikeAvailable: true });
    });

    test("alphaStrikeAvailable is true for a Targeting attack with a shotgun", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();
      const weapon = { flags: { core: { sourceId: SHOTGUN_ID } }, system: {} };

      await dice.rollSkill(targetingDataset, makeAlphaStrikeActor(weapon), shotgunTargetingWeaponEffect);

      expect(rollDialog.getSkillRollOptions.mock.calls[0][0]).toMatchObject({ alphaStrikeAvailable: true });
    });

    test("alphaStrikeAvailable is false for a Targeting attack with a non-shotgun/SMG weapon", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();
      const weapon = { flags: { core: { sourceId: 'some-other-weapon' } }, system: {} };

      await dice.rollSkill(targetingDataset, makeAlphaStrikeActor(weapon), rifleTargetingWeaponEffect);

      expect(rollDialog.getSkillRollOptions.mock.calls[0][0]).toMatchObject({ alphaStrikeAvailable: false });
    });

    test("alphaStrikeAvailable is false without the Perk", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();
      const actorWithoutPerk = {
        ...mockActor,
        getRollData: jest.fn(() => ({ skills: { might: { modifier: '0', shift: 'd20', edge: false, snag: false } } })),
      };

      await dice.rollSkill(mightDataset, actorWithoutPerk, mightMeleeWeaponEffect);

      expect(rollDialog.getSkillRollOptions.mock.calls[0][0]).toMatchObject({ alphaStrikeAvailable: false });
    });

    test("checking the Alpha Strike toggle grants Edge and marks the round", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1, alphaStrike: true,
      });
      dice._rollSkillHelper = jest.fn();
      const actor = makeAlphaStrikeActor();
      actor.setFlag = jest.fn();
      game.combat = { id: 'combat1', round: 2 };

      await dice.rollSkill(mightDataset, actor, mightMeleeWeaponEffect);

      const formula = dice._rollSkillHelper.mock.calls[0][0];
      expect(formula).toBe('2d20kh + 0');
      expect(actor.setFlag).toHaveBeenCalledWith('essence20', 'alphaStrikeLastRound', { combatId: 'combat1', round: 2 });

      game.combat = null;
    });
  });

  describe("Empty the Mag (Vanguard base, 7th level, p.109)", () => {
    const EMPTY_THE_MAG_ID = "Compendium.essence20.gi_joe_crb.Item.zbrr3W30rFTDTayX";
    const targetingDataset = { ...dataset, skill: 'targeting' };
    const ballisticRangedWeaponEffect = {
      name: 'Rifle Effect',
      type: 'weaponEffect',
      flags: { essence20: { parentId: 'weapon1' } },
      system: { classification: { skill: "targeting", style: "projectile" }, damageType: "sharp", damageValue: 1 },
    };
    const meleeWeaponEffect = {
      name: 'Knife Effect',
      type: 'weaponEffect',
      flags: { essence20: { parentId: 'weapon1' } },
      system: { classification: { skill: "targeting", style: "melee" }, damageType: "sharp", damageValue: 1 },
    };

    function makeActor(weapon) {
      const items = [
        { type: 'perk', flags: { core: { sourceId: EMPTY_THE_MAG_ID } } },
      ];
      items.get = jest.fn(() => weapon);

      return {
        ...mockActor,
        items,
        getRollData: jest.fn(() => ({ skills: { targeting: { modifier: '0', shift: 'd20', edge: false, snag: false } } })),
      };
    }

    test("emptyTheMagAvailable is true for a ranged attack with a ballistic weapon and the Perk", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();
      const weapon = { system: { itemAndUpgradeTraits: ['ballistic'] } };

      await dice.rollSkill(targetingDataset, makeActor(weapon), ballisticRangedWeaponEffect);

      expect(rollDialog.getSkillRollOptions.mock.calls[0][0]).toMatchObject({ emptyTheMagAvailable: true });
    });

    test("emptyTheMagAvailable is false for a non-ballistic weapon", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();
      const weapon = { system: { itemAndUpgradeTraits: [] } };

      await dice.rollSkill(targetingDataset, makeActor(weapon), ballisticRangedWeaponEffect);

      expect(rollDialog.getSkillRollOptions.mock.calls[0][0]).toMatchObject({ emptyTheMagAvailable: false });
    });

    test("emptyTheMagAvailable is false for a melee attack, even with a ballistic weapon", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();
      const weapon = { system: { itemAndUpgradeTraits: ['ballistic'] } };

      await dice.rollSkill(targetingDataset, makeActor(weapon), meleeWeaponEffect);

      expect(rollDialog.getSkillRollOptions.mock.calls[0][0]).toMatchObject({ emptyTheMagAvailable: false });
    });

    test("emptyTheMagAvailable is false without the Perk", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();
      const weapon = { system: { itemAndUpgradeTraits: ['ballistic'] } };
      const actorWithoutPerk = {
        ...mockActor,
        items: Object.assign([], { get: () => weapon }),
        getRollData: jest.fn(() => ({ skills: { targeting: { modifier: '0', shift: 'd20', edge: false, snag: false } } })),
      };

      await dice.rollSkill(targetingDataset, actorWithoutPerk, ballisticRangedWeaponEffect);

      expect(rollDialog.getSkillRollOptions.mock.calls[0][0]).toMatchObject({ emptyTheMagAvailable: false });
    });

    test("checking the toggle threads emptyTheMag through to checkContext", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
        defenseType: 'toughness', emptyTheMag: true,
      });
      dice._rollSkillHelper = jest.fn();
      const weapon = { system: { itemAndUpgradeTraits: ['ballistic'] } };
      const targetActor = { name: 'Target', uuid: 'Actor.target1', system: { defenses: { toughness: { total: 10 } }, immunities: {}, size: 'common' }, statuses: new Set(), items: [] };
      const token = { actor: targetActor, center: { x: 0, y: 0 } };
      const targetsSet = new Set([token]);
      targetsSet.first = () => token;
      const originalTargets = game.user.targets;
      game.user.targets = targetsSet;

      await dice.rollSkill(targetingDataset, makeActor(weapon), ballisticRangedWeaponEffect);

      const checkContext = dice._rollSkillHelper.mock.calls[0][4];
      expect(checkContext.emptyTheMag).toBe(true);

      game.user.targets = originalTargets;
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

  describe("debilitatedConsumed clearing", () => {
    test("clears the actor's debilitated flag once consumed by this roll", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();
      const actor = {
        ...mockActor,
        // Only 'debilitated' is set - a realistic getFlag, unlike returning true unconditionally,
        // which would also (incorrectly, for this test's own purpose) look like a pending banked
        // bonus to the newer Think On It/Plan of Action check right next to this one.
        getFlag: jest.fn((scope, key) => (scope == 'essence20' && key == 'debilitated' ? true : undefined)),
        unsetFlag: jest.fn(),
        getRollData: jest.fn(() => ({ skills: { athletics: { modifier: '0', shift: 'd20' } } })),
      };

      await dice.rollSkill(dataset, actor, null);

      expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'debilitated');
      expect(actor.unsetFlag).toHaveBeenCalledTimes(1);
    });
  });

  describe("pending banked bonus clearing (Think On It / Plan of Action)", () => {
    test("clears every pending bonus consumed by this roll", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();
      const pendingFlags = {
        pendingThinkOnIt: { edge: true, combatId: null, round: null },
        pendingPlanOfAction: { shiftUp: 1, combatId: null, round: null },
      };
      const actor = {
        ...mockActor,
        getFlag: jest.fn((scope, key) => (scope == 'essence20' ? pendingFlags[key] : undefined)),
        unsetFlag: jest.fn(),
        getRollData: jest.fn(() => ({ skills: { athletics: { modifier: '0', shift: 'd20' } } })),
      };

      await dice.rollSkill(dataset, actor, null);

      expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'pendingThinkOnIt');
      expect(actor.unsetFlag).toHaveBeenCalledWith('essence20', 'pendingPlanOfAction');
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

  describe("Enemy Number One's attackedTankId marking", () => {
    const meleeWeaponEffect = {
      type: 'weaponEffect',
      flags: {},
      system: { classification: { style: 'melee' }, defenseType: 'toughness' },
    };

    test("sets the actor's flag when this roll's target is a nearby Enemy Number One Tank", async () => {
      const rollDialog = createMockRollDialog();
      rollDialog.getSkillRollOptions.mockReturnValue({
        canCritD2: false, edge: false, snag: false, shiftUp: 0, shiftDown: 0, timesToRoll: 1,
      });
      dice._rollSkillHelper = jest.fn();

      const attackerToken = { actor: null, center: { x: 0, y: 0 }, document: { disposition: 1 } };
      const tank = {
        id: 'tank1', system: { size: 'common' }, statuses: new Set(),
        items: [{
          type: 'perk',
          flags: { core: { sourceId: "Compendium.essence20.gi_joe_crb.Item.zvzta73A3ROyxv0J" } },
        }],
      };
      const tankToken = { actor: tank, center: { x: 0, y: 0 }, document: { disposition: -1 } };
      canvas.tokens.placeables = [attackerToken, tankToken];
      canvas.grid.measurePath.mockReturnValue({ distance: 10 });
      game.combat = { id: 'combat1', round: 1, turn: 0 };
      game.user.targets.first.mockReturnValue({ actor: tank });

      const actor = {
        ...mockActor,
        getActiveTokens: jest.fn(() => [attackerToken]),
        getFlag: jest.fn(() => undefined),
        setFlag: jest.fn(),
        getRollData: jest.fn(() => ({ skills: { athletics: { modifier: '0', shift: 'd20' } } })),
      };

      await dice.rollSkill(dataset, actor, meleeWeaponEffect);

      expect(actor.setFlag).toHaveBeenCalledWith(
        'essence20', 'attackedEnemyNumberOneThisTurn', { combatId: 'combat1', round: 1, turn: 0, tankId: 'tank1' },
      );

      game.combat = null;
      game.user.targets.first.mockReturnValue(undefined);
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

  test("floorAt10 (Silver Tongue) adds min10 before kh/kl", () => {
    expect(dice._getd20Operand(false, false, true)).toEqual('d20min10');
    expect(dice._getd20Operand(true, false, true)).toEqual('2d20min10kh');
    expect(dice._getd20Operand(false, true, true)).toEqual('2d20min10kl');
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

/* _applyImmovableObjectImmunity */
describe("_applyImmovableObjectImmunity (Juggernaut Focus, 20th level)", () => {
  const IMMOVABLE_OBJECT_ID = "Compendium.essence20.gi_joe_crb.Item.QSHsA1peMncG196r";

  function makeTargetActor(perkIds = []) {
    const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
    return { items };
  }

  function makeResult({ targetUuid = 'Actor.target1', criticalOptions = [{ key: 'double' }] } = {}) {
    return { targetUuid, criticalOptions };
  }

  beforeEach(() => {
    fromUuid.mockReset();
  });

  test("clears criticalOptions for a target with the Perk", async () => {
    fromUuid.mockResolvedValue(makeTargetActor([IMMOVABLE_OBJECT_ID]));
    const results = [makeResult()];

    await dice._applyImmovableObjectImmunity(results);

    expect(results[0].criticalOptions).toEqual([]);
  });

  test("leaves criticalOptions alone for a target without the Perk", async () => {
    fromUuid.mockResolvedValue(makeTargetActor());
    const results = [makeResult()];

    await dice._applyImmovableObjectImmunity(results);

    expect(results[0].criticalOptions).toEqual([{ key: 'double' }]);
  });

  test("doesn't look up a target when this result has no critical options at all", async () => {
    const results = [makeResult({ criticalOptions: [] })];

    await dice._applyImmovableObjectImmunity(results);

    expect(fromUuid).not.toHaveBeenCalled();
  });

  test("doesn't crash on a flat @Check[dif=...] result with no targetUuid", async () => {
    const results = [makeResult({ targetUuid: null })];

    await dice._applyImmovableObjectImmunity(results);

    expect(fromUuid).not.toHaveBeenCalled();
    expect(results[0].criticalOptions).toEqual([{ key: 'double' }]);
  });

  test("only clears the immune target's own row when multiple targets are compared", async () => {
    fromUuid.mockImplementation(uuid => Promise.resolve(
      uuid == 'Actor.immune' ? makeTargetActor([IMMOVABLE_OBJECT_ID]) : makeTargetActor(),
    ));
    const results = [
      makeResult({ targetUuid: 'Actor.immune' }),
      makeResult({ targetUuid: 'Actor.normal' }),
    ];

    await dice._applyImmovableObjectImmunity(results);

    expect(results[0].criticalOptions).toEqual([]);
    expect(results[1].criticalOptions).toEqual([{ key: 'double' }]);
  });
});

/* _applyPlatePiercingVehicleDamage */
describe("_applyPlatePiercingVehicleDamage (Artillery Focus, 10th level)", () => {
  const PLATE_PIERCING_ID = "Compendium.essence20.gi_joe_crb.Item.II5giKn7vCDeB2nk";

  function makeActor(perkIds = []) {
    const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
    return { items };
  }

  const explosiveContext = { isExplosiveAttack: true };
  const meleeContext = { isExplosiveAttack: false };

  function makeResult({ targetUuid = 'Actor.target1', damageValue = 5 } = {}) {
    return { targetUuid, damageValue };
  }

  beforeEach(() => {
    fromUuid.mockReset();
  });

  test("doubles damage against a vehicle target", async () => {
    fromUuid.mockResolvedValue({ type: 'vehicle' });
    const results = [makeResult({ damageValue: 5 })];

    await dice._applyPlatePiercingVehicleDamage(makeActor([PLATE_PIERCING_ID]), results, explosiveContext);

    expect(results[0].damageValue).toBe(10);
  });

  test("leaves damage alone against a non-vehicle target", async () => {
    fromUuid.mockResolvedValue({ type: 'character' });
    const results = [makeResult({ damageValue: 5 })];

    await dice._applyPlatePiercingVehicleDamage(makeActor([PLATE_PIERCING_ID]), results, explosiveContext);

    expect(results[0].damageValue).toBe(5);
  });

  test("doesn't apply without the Perk", async () => {
    fromUuid.mockResolvedValue({ type: 'vehicle' });
    const results = [makeResult({ damageValue: 5 })];

    await dice._applyPlatePiercingVehicleDamage(makeActor(), results, explosiveContext);

    expect(results[0].damageValue).toBe(5);
    expect(fromUuid).not.toHaveBeenCalled();
  });

  test("doesn't apply to a non-explosive attack", async () => {
    fromUuid.mockResolvedValue({ type: 'vehicle' });
    const results = [makeResult({ damageValue: 5 })];

    await dice._applyPlatePiercingVehicleDamage(makeActor([PLATE_PIERCING_ID]), results, meleeContext);

    expect(results[0].damageValue).toBe(5);
    expect(fromUuid).not.toHaveBeenCalled();
  });

  test("doesn't look up a target when this result has no damage at all (a miss)", async () => {
    const results = [makeResult({ damageValue: null })];

    await dice._applyPlatePiercingVehicleDamage(makeActor([PLATE_PIERCING_ID]), results, explosiveContext);

    expect(fromUuid).not.toHaveBeenCalled();
  });

  test("only doubles the vehicle target's own row when multiple targets are compared", async () => {
    fromUuid.mockImplementation(uuid => Promise.resolve(
      { type: uuid == 'Actor.vehicle' ? 'vehicle' : 'character' },
    ));
    const results = [
      makeResult({ targetUuid: 'Actor.vehicle', damageValue: 5 }),
      makeResult({ targetUuid: 'Actor.character', damageValue: 5 }),
    ];

    await dice._applyPlatePiercingVehicleDamage(makeActor([PLATE_PIERCING_ID]), results, explosiveContext);

    expect(results[0].damageValue).toBe(10);
    expect(results[1].damageValue).toBe(5);
  });
});

/* _applyEmptyTheMag */
describe("_applyEmptyTheMag (Vanguard base, 7th level)", () => {
  function makeResult({ damageValue = 5 } = {}) {
    return { targetUuid: 'Actor.target1', damageValue };
  }

  test("doubles damage against every hit target when checked", () => {
    const results = [makeResult({ damageValue: 5 }), makeResult({ damageValue: 8 })];

    dice._applyEmptyTheMag(results, { emptyTheMag: true });

    expect(results[0].damageValue).toBe(10);
    expect(results[1].damageValue).toBe(16);
  });

  test("leaves damage alone when not checked", () => {
    const results = [makeResult({ damageValue: 5 })];

    dice._applyEmptyTheMag(results, { emptyTheMag: false });

    expect(results[0].damageValue).toBe(5);
  });

  test("doesn't touch a result with no damage at all (a miss)", () => {
    const results = [makeResult({ damageValue: null })];

    dice._applyEmptyTheMag(results, { emptyTheMag: true });

    expect(results[0].damageValue).toBe(null);
  });
});

/* _applyNowhereIsSafe */
describe("_applyNowhereIsSafe (Vanguard base, 17th level)", () => {
  const NOWHERE_IS_SAFE_ID = "Compendium.essence20.gi_joe_crb.Item.oUAeJZ7K1P7Fu8Bc";

  function makeActor(perkIds = []) {
    const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
    return { items };
  }

  function makeResult({ targetUuid = 'Actor.target1', damageValue = 5, success = true } = {}) {
    return { targetUuid, damageValue, success };
  }

  function makeTargetActor(statuses = []) {
    return {
      statuses: new Set(statuses),
      toggleStatusEffect: jest.fn(),
    };
  }

  beforeEach(() => {
    fromUuid.mockReset();
  });

  test("reduces Total Cover to Cover, with no damage bonus", async () => {
    const targetActor = makeTargetActor(['totalCover']);
    fromUuid.mockResolvedValue(targetActor);
    const results = [makeResult({ damageValue: 5 })];

    await dice._applyNowhereIsSafe(
      makeActor([NOWHERE_IS_SAFE_ID]), results, { isMultipleTargetsWeapon: true },
    );

    expect(targetActor.toggleStatusEffect).toHaveBeenCalledWith('totalCover', { active: false });
    expect(targetActor.toggleStatusEffect).toHaveBeenCalledWith('cover', { active: true });
    expect(results[0].damageValue).toBe(5);
  });

  test("reduces Cover to none and adds +1 damage", async () => {
    const targetActor = makeTargetActor(['cover']);
    fromUuid.mockResolvedValue(targetActor);
    const results = [makeResult({ damageValue: 5 })];

    await dice._applyNowhereIsSafe(
      makeActor([NOWHERE_IS_SAFE_ID]), results, { isMultipleTargetsWeapon: true },
    );

    expect(targetActor.toggleStatusEffect).toHaveBeenCalledWith('cover', { active: false });
    expect(results[0].damageValue).toBe(6);
  });

  test("adds +1 damage against a target with no cover at all, with no status to toggle", async () => {
    const targetActor = makeTargetActor([]);
    fromUuid.mockResolvedValue(targetActor);
    const results = [makeResult({ damageValue: 5 })];

    await dice._applyNowhereIsSafe(
      makeActor([NOWHERE_IS_SAFE_ID]), results, { isMultipleTargetsWeapon: true },
    );

    expect(targetActor.toggleStatusEffect).not.toHaveBeenCalled();
    expect(results[0].damageValue).toBe(6);
  });

  test("doesn't apply without the Perk", async () => {
    const targetActor = makeTargetActor(['cover']);
    fromUuid.mockResolvedValue(targetActor);
    const results = [makeResult({ damageValue: 5 })];

    await dice._applyNowhereIsSafe(makeActor(), results, { isMultipleTargetsWeapon: true });

    expect(targetActor.toggleStatusEffect).not.toHaveBeenCalled();
    expect(results[0].damageValue).toBe(5);
    expect(fromUuid).not.toHaveBeenCalled();
  });

  test("doesn't apply to a non-Multiple-Targets attack, even with the Perk", async () => {
    const targetActor = makeTargetActor(['cover']);
    fromUuid.mockResolvedValue(targetActor);
    const results = [makeResult({ damageValue: 5 })];

    await dice._applyNowhereIsSafe(makeActor([NOWHERE_IS_SAFE_ID]), results, { isMultipleTargetsWeapon: false });

    expect(fromUuid).not.toHaveBeenCalled();
    expect(results[0].damageValue).toBe(5);
  });

  test("doesn't apply to a missed result", async () => {
    const targetActor = makeTargetActor(['cover']);
    fromUuid.mockResolvedValue(targetActor);
    const results = [makeResult({ damageValue: null, success: false })];

    await dice._applyNowhereIsSafe(
      makeActor([NOWHERE_IS_SAFE_ID]), results, { isMultipleTargetsWeapon: true },
    );

    expect(fromUuid).not.toHaveBeenCalled();
  });

  test("no damage bonus if the result had no damage to begin with", async () => {
    const targetActor = makeTargetActor([]);
    fromUuid.mockResolvedValue(targetActor);
    const results = [makeResult({ damageValue: null })];

    await dice._applyNowhereIsSafe(
      makeActor([NOWHERE_IS_SAFE_ID]), results, { isMultipleTargetsWeapon: true },
    );

    expect(results[0].damageValue).toBe(null);
  });

  test("only reduces the successfully-hit target's own row when multiple targets are compared", async () => {
    fromUuid.mockImplementation(uuid => Promise.resolve(
      uuid == 'Actor.hit' ? makeTargetActor(['cover']) : makeTargetActor(['cover']),
    ));
    const results = [
      makeResult({ targetUuid: 'Actor.hit', damageValue: 5, success: true }),
      makeResult({ targetUuid: 'Actor.miss', damageValue: null, success: false }),
    ];

    await dice._applyNowhereIsSafe(
      makeActor([NOWHERE_IS_SAFE_ID]), results, { isMultipleTargetsWeapon: true },
    );

    expect(results[0].damageValue).toBe(6);
    expect(results[1].damageValue).toBe(null);
    expect(fromUuid).toHaveBeenCalledTimes(1);
  });
});

/* _getAutomaticCombatModifiers */
describe("_getAutomaticCombatModifiers", () => {
  const GI_JOE_CRB = "Compendium.essence20.gi_joe_crb.Item.";
  const PARANOIA_ID = `${GI_JOE_CRB}HG32BCzrF6Hsz7yR`;
  const FIRST_STRIKE_ID = `${GI_JOE_CRB}qxqtfBobduwSkfRM`;
  const SECONDS_BETWEEN_CLICK_AND_BOOM_ID = `${GI_JOE_CRB}ofiG5IwlURUwORYV`;
  const WHO_DARES_WINS_ID = `${GI_JOE_CRB}zfyTLiJDNKPHETlv`;

  // actor.items needs to behave like a real Foundry EmbeddedCollection - array-like (.some(),
  // used by helpers/perks.mjs#actorHasPerk) AND .get()-able (used for weapon lookups) - a plain
  // array with a .get() method attached satisfies both.
  function makeActor(size, statuses = [], { perkIds = [], weapon = null, debilitated = false } = {}) {
    const items = perkIds.map(perkId => ({ type: 'perk', flags: { core: { sourceId: perkId } } }));
    items.get = jest.fn(() => weapon);

    return {
      system: { size },
      statuses: new Set(statuses),
      items,
      getFlag: jest.fn((scope, key) => (scope == 'essence20' && key == 'debilitated' ? debilitated : undefined)),
      unsetFlag: jest.fn(),
    };
  }

  const defaultModifiers = {
    shiftUp: 0, shiftDown: 0, edge: false, snag: false, debilitatedConsumed: false, enemyNumberOneTankId: null,
    tooCloseForMinimumRange: false, pendingBonusesToClear: [],
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
      .toEqual({ ...defaultModifiers, shiftDown: 1 });
  });

  test("attack with no target only applies self Conditions", () => {
    const actor = makeActor('common', ['blinded']);

    expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect))
      .toEqual({ ...defaultModifiers, snag: true });
  });

  test("attack applies Size Class shift from the targeted actor", () => {
    game.user.targets.first.mockReturnValue({ actor: makeActor('titanic') });
    const actor = makeActor('small');

    expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect))
      .toEqual({ ...defaultModifiers, shiftUp: 5 });
  });

  test("Prone target grants Edge to a melee attacker", () => {
    game.user.targets.first.mockReturnValue({ actor: makeActor('common', ['prone']) });
    const actor = makeActor('common');

    expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect))
      .toEqual({ ...defaultModifiers, edge: true });
  });

  test("Prone target grants Snag to a ranged attacker", () => {
    game.user.targets.first.mockReturnValue({ actor: makeActor('common', ['prone']) });
    const actor = makeActor('common');

    expect(dice._getAutomaticCombatModifiers(actor, rangedWeaponEffect))
      .toEqual({ ...defaultModifiers, snag: true });
  });

  test("Immobilized target grants a shift up", () => {
    game.user.targets.first.mockReturnValue({ actor: makeActor('common', ['immobilized']) });
    const actor = makeActor('common');

    expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect))
      .toEqual({ ...defaultModifiers, shiftUp: 1 });
  });

  test("Invisible target grants a Snag", () => {
    game.user.targets.first.mockReturnValue({ actor: makeActor('common', ['invisible']) });
    const actor = makeActor('common');

    expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect))
      .toEqual({ ...defaultModifiers, snag: true });
  });

  describe("Duck & Cover (Infantry/Renegade base, shared Perk)", () => {
    const DUCK_AND_COVER_ID = `${GI_JOE_CRB}2R3saLtDCI1q2QBz`;
    const explosiveWeaponEffect = {
      type: 'weaponEffect',
      system: { classification: { style: 'explosive' }, defenseType: 'toughness' },
    };

    test("suffers a Snag attacking a Duck & Cover target with an explosive-style weapon", () => {
      game.user.targets.first.mockReturnValue({ actor: makeActor('common', [], { perkIds: [DUCK_AND_COVER_ID] }) });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, explosiveWeaponEffect))
        .toEqual({ ...defaultModifiers, snag: true });
    });

    test("suffers a Snag with an area-trait weapon, even if not explosive-style", () => {
      game.user.targets.first.mockReturnValue({ actor: makeActor('common', [], { perkIds: [DUCK_AND_COVER_ID] }) });
      const actor = makeActor('common', [], { weapon: { system: { traits: ['area'] } } });
      const rangedWeaponEffectWithParent = { ...rangedWeaponEffect, flags: { essence20: { parentId: 'weapon1' } } };

      expect(dice._getAutomaticCombatModifiers(actor, rangedWeaponEffectWithParent))
        .toEqual({ ...defaultModifiers, snag: true });
    });

    test("doesn't apply to a non-explosive, non-area attack", () => {
      game.user.targets.first.mockReturnValue({ actor: makeActor('common', [], { perkIds: [DUCK_AND_COVER_ID] }) });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect)).toEqual(defaultModifiers);
    });

    test("doesn't apply to a target without the Perk", () => {
      game.user.targets.first.mockReturnValue({ actor: makeActor('common') });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, explosiveWeaponEffect)).toEqual(defaultModifiers);
    });
  });

  describe("Cover (p.202)", () => {
    test("imposes -2 shift on a ranged attack against a target with Cover", () => {
      game.user.targets.first.mockReturnValue({ actor: makeActor('common', ['cover']) });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, rangedWeaponEffect))
        .toEqual({ ...defaultModifiers, shiftDown: 2 });
    });

    test("imposes the same -2 shift against a target with Total Cover", () => {
      game.user.targets.first.mockReturnValue({ actor: makeActor('common', ['totalCover']) });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, rangedWeaponEffect))
        .toEqual({ ...defaultModifiers, shiftDown: 2 });
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

    describe("Penetrating Rounds (Door-Kicker Focus, 20th level, p.100) ignores it", () => {
      const PENETRATING_ROUNDS_ID = `${GI_JOE_CRB}JLwbWSlHn5q3rqnH`;
      const SHOTGUN_ID = `${GI_JOE_CRB}2qW1YLopvjKyezNQ`;
      const rangedWeaponEffectWithParent = {
        ...rangedWeaponEffect, flags: { essence20: { parentId: 'weapon1' } },
      };
      const shotgunWeapon = { flags: { core: { sourceId: SHOTGUN_ID } }, system: {} };

      test("no -2 shift attacking a Cover target with a shotgun", () => {
        game.user.targets.first.mockReturnValue({ actor: makeActor('common', ['cover']) });
        const actor = makeActor('common', [], { perkIds: [PENETRATING_ROUNDS_ID], weapon: shotgunWeapon });

        expect(dice._getAutomaticCombatModifiers(actor, rangedWeaponEffectWithParent)).toEqual(defaultModifiers);
      });

      test("still applies without the Perk, even with a shotgun", () => {
        game.user.targets.first.mockReturnValue({ actor: makeActor('common', ['cover']) });
        const actor = makeActor('common', [], { weapon: shotgunWeapon });

        expect(dice._getAutomaticCombatModifiers(actor, rangedWeaponEffectWithParent))
          .toEqual({ ...defaultModifiers, shiftDown: 2 });
      });

      test("still applies with the Perk but an unrelated weapon", () => {
        game.user.targets.first.mockReturnValue({ actor: makeActor('common', ['cover']) });
        const actor = makeActor('common', [], {
          perkIds: [PENETRATING_ROUNDS_ID], weapon: { flags: { core: { sourceId: 'other' } }, system: {} },
        });

        expect(dice._getAutomaticCombatModifiers(actor, rangedWeaponEffectWithParent))
          .toEqual({ ...defaultModifiers, shiftDown: 2 });
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
        .toEqual({ ...defaultModifiers, snag: true });
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
        .toEqual({ ...defaultModifiers, shiftDown: 1 });
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
        .toEqual({ ...defaultModifiers, tooCloseForMinimumRange: true, shiftDown: 1 });
    });

    test("doesn't apply without a resolved attacker token", () => {
      canvas.grid.measurePath.mockReturnValue({ distance: 3 });
      game.user.targets.first.mockReturnValue(makeToken(makeActor('common')));
      const actor = makeRangedActor();
      actor.getActiveTokens = jest.fn(() => []);

      expect(dice._getAutomaticCombatModifiers(actor, rangedEffect({ min: 10, value: 20, long: 80 })))
        .toEqual(defaultModifiers);
    });
  });

  test("attacker's own Prone Condition penalizes only melee attacks", () => {
    const actor = makeActor('common', ['prone']);

    expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect))
      .toEqual({ ...defaultModifiers, shiftDown: 1 });
    expect(dice._getAutomaticCombatModifiers(actor, rangedWeaponEffect))
      .toEqual(defaultModifiers);
  });

  test("Edge and Snag from separate sources both surface, left to cancel out downstream", () => {
    game.user.targets.first.mockReturnValue({ actor: makeActor('common', ['invisible', 'stunned']) });
    const actor = makeActor('common');

    expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect))
      .toEqual({ ...defaultModifiers, edge: true, snag: true });
  });

  describe("Paranoia (18th level)", () => {
    test("attacks against a target with Paranoia always suffer a Snag", () => {
      game.user.targets.first.mockReturnValue({ actor: makeActor('common', [], { perkIds: [PARANOIA_ID] }) });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect))
        .toEqual({ ...defaultModifiers, snag: true });
    });

    test("doesn't affect a target without the Perk", () => {
      game.user.targets.first.mockReturnValue({ actor: makeActor('common') });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect)).toEqual(defaultModifiers);
    });
  });

  describe("Gallantry (Infantry base, 2nd level)", () => {
    const GALLANTRY_ID = `${GI_JOE_CRB}UIMocxFcGeJUm3D4`;
    const FIGHTING_STYLE_ID = `${GI_JOE_CRB}2LtDCHxgg9bMvWQK`;
    const multipleTargetsWeapon = { system: { itemAndUpgradeTraits: ['multipleTargets'] } };
    const triggerHappyWeaponEffect = {
      ...meleeWeaponEffect,
      flags: { essence20: { parentId: 'weapon1' } },
    };

    function makeTriggerHappyActor(weapon = multipleTargetsWeapon) {
      const items = [
        { type: 'perk', flags: { core: { sourceId: FIGHTING_STYLE_ID } }, system: { choice: 'triggerHappy' } },
      ];
      items.get = jest.fn(() => weapon);

      return { system: { size: 'common' }, statuses: new Set(), items, getFlag: jest.fn(), unsetFlag: jest.fn() };
    }

    test("Snags the whole attack roll against a Gallantry target when the attacker has Trigger Happy and a Multiple Targets weapon", () => {
      game.user.targets.first.mockReturnValue({ actor: makeActor('common', [], { perkIds: [GALLANTRY_ID] }) });
      const actor = makeTriggerHappyActor();

      expect(dice._getAutomaticCombatModifiers(actor, triggerHappyWeaponEffect))
        .toEqual({ ...defaultModifiers, snag: true });
    });

    test("doesn't affect a target without Gallantry", () => {
      game.user.targets.first.mockReturnValue({ actor: makeActor('common') });
      const actor = makeTriggerHappyActor();

      expect(dice._getAutomaticCombatModifiers(actor, triggerHappyWeaponEffect)).toEqual(defaultModifiers);
    });

    test("doesn't Snag if the attacker doesn't have Trigger Happy", () => {
      game.user.targets.first.mockReturnValue({ actor: makeActor('common', [], { perkIds: [GALLANTRY_ID] }) });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, triggerHappyWeaponEffect)).toEqual(defaultModifiers);
    });

    test("doesn't Snag against a non-Multiple-Targets weapon even with Trigger Happy", () => {
      game.user.targets.first.mockReturnValue({ actor: makeActor('common', [], { perkIds: [GALLANTRY_ID] }) });
      const actor = makeTriggerHappyActor({ system: { itemAndUpgradeTraits: [] } });

      expect(dice._getAutomaticCombatModifiers(actor, triggerHappyWeaponEffect)).toEqual(defaultModifiers);
    });
  });

  describe("Alpha Strike (Door-Kicker Focus, 3rd level) - reciprocal Edge half", () => {
    function makeAlphaStrikeTarget({ combatId = 'combat1', round = 1 } = {}) {
      const target = makeActor('common');
      target.getFlag = jest.fn((scope, key) =>
        (scope == 'essence20' && key == 'alphaStrikeLastRound' ? { combatId, round } : undefined));

      return target;
    }

    test("attacks against a target who used Alpha Strike this round gain an Edge", () => {
      game.combat = { id: 'combat1', round: 1 };
      game.user.targets.first.mockReturnValue({ actor: makeAlphaStrikeTarget() });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect))
        .toEqual({ ...defaultModifiers, edge: true });
    });

    test("doesn't apply once the round has moved on", () => {
      game.combat = { id: 'combat1', round: 2 };
      game.user.targets.first.mockReturnValue({ actor: makeAlphaStrikeTarget({ round: 1 }) });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect)).toEqual(defaultModifiers);
    });

    test("doesn't apply outside of combat", () => {
      game.combat = null;
      game.user.targets.first.mockReturnValue({ actor: makeAlphaStrikeTarget() });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect)).toEqual(defaultModifiers);
    });

    test("doesn't apply to a target who hasn't used Alpha Strike", () => {
      game.combat = { id: 'combat1', round: 1 };
      game.user.targets.first.mockReturnValue({ actor: makeActor('common') });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect)).toEqual(defaultModifiers);
    });
  });

  describe("Impenetrable Shield (Vanguard base, 18th level) - resistance-via-Snag half", () => {
    const IMPENETRABLE_SHIELD_ID = `${GI_JOE_CRB}eEUl7OA9yWAk0QD3`;
    const PERSONAL_SHIELD_ROLE_POINTS_ID = `${GI_JOE_CRB}84JYgd6kZgY41wge`;
    const fireWeaponEffect = { ...meleeWeaponEffect, system: { ...meleeWeaponEffect.system, damageType: 'fire' } };
    const empWeaponEffect = { ...meleeWeaponEffect, system: { ...meleeWeaponEffect.system, damageType: 'emp' } };

    function makeShieldedTarget({ perkIds = [], shieldActive = true } = {}) {
      const target = makeActor('common', [], { perkIds });
      target._getBaseRolePoints = jest.fn(() => ({
        flags: { core: { sourceId: PERSONAL_SHIELD_ROLE_POINTS_ID } },
        system: {
          isActive: shieldActive, isActivatable: true,
          bonus: { type: 'defenseBonus', defenseBonus: { toughness: true, evasion: true } },
        },
      }));

      return target;
    }

    test("Snags a non-EMP attack against an active shield", () => {
      game.user.targets.first.mockReturnValue({ actor: makeShieldedTarget({ perkIds: [IMPENETRABLE_SHIELD_ID] }) });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, fireWeaponEffect))
        .toEqual({ ...defaultModifiers, snag: true });
    });

    test("doesn't Snag an EMP attack (immunity handles that instead, not a Snag)", () => {
      game.user.targets.first.mockReturnValue({ actor: makeShieldedTarget({ perkIds: [IMPENETRABLE_SHIELD_ID] }) });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, empWeaponEffect)).toEqual(defaultModifiers);
    });

    test("doesn't apply without the shield active", () => {
      game.user.targets.first.mockReturnValue({
        actor: makeShieldedTarget({ perkIds: [IMPENETRABLE_SHIELD_ID], shieldActive: false }),
      });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, fireWeaponEffect)).toEqual(defaultModifiers);
    });

    test("doesn't apply without the Perk", () => {
      game.user.targets.first.mockReturnValue({ actor: makeShieldedTarget() });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, fireWeaponEffect)).toEqual(defaultModifiers);
    });
  });

  describe("Shield Modulation (Vanguard base, 13th level, p.109)", () => {
    const SHIELD_MODULATION_ID = `${GI_JOE_CRB}16ul4Ev6b9gO5CIN`;
    const PERSONAL_SHIELD_ROLE_POINTS_ID = `${GI_JOE_CRB}84JYgd6kZgY41wge`;
    const fireWeaponEffect = { ...meleeWeaponEffect, system: { ...meleeWeaponEffect.system, damageType: 'fire' } };
    const poisonWeaponEffect = { ...meleeWeaponEffect, system: { ...meleeWeaponEffect.system, damageType: 'poison' } };

    function makeShieldedTarget({ perkIds = [], shieldActive = true, modulatedType = null } = {}) {
      const target = makeActor('common', [], { perkIds });
      target._getBaseRolePoints = jest.fn(() => ({
        flags: { core: { sourceId: PERSONAL_SHIELD_ROLE_POINTS_ID } },
        system: {
          isActive: shieldActive, isActivatable: true,
          bonus: { type: 'defenseBonus', defenseBonus: { toughness: true, evasion: true } },
        },
      }));
      target.getFlag = jest.fn((scope, key) => {
        if (scope != 'essence20') return undefined;
        if (key == 'shieldModulationDamageType') return modulatedType;
        return undefined;
      });

      return target;
    }

    test("Snags an attack matching the chosen damage type", () => {
      game.user.targets.first.mockReturnValue({
        actor: makeShieldedTarget({ perkIds: [SHIELD_MODULATION_ID], modulatedType: 'fire' }),
      });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, fireWeaponEffect))
        .toEqual({ ...defaultModifiers, snag: true });
    });

    test("doesn't apply to a different damage type than the one chosen", () => {
      game.user.targets.first.mockReturnValue({
        actor: makeShieldedTarget({ perkIds: [SHIELD_MODULATION_ID], modulatedType: 'poison' }),
      });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, fireWeaponEffect)).toEqual(defaultModifiers);
    });

    test("doesn't apply without the shield active", () => {
      game.user.targets.first.mockReturnValue({
        actor: makeShieldedTarget({ perkIds: [SHIELD_MODULATION_ID], modulatedType: 'fire', shieldActive: false }),
      });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, fireWeaponEffect)).toEqual(defaultModifiers);
    });

    test("doesn't apply without the Perk, even with a stored damage type", () => {
      game.user.targets.first.mockReturnValue({ actor: makeShieldedTarget({ modulatedType: 'fire' }) });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, fireWeaponEffect)).toEqual(defaultModifiers);
    });

    test("doesn't apply without a damage type ever chosen", () => {
      game.user.targets.first.mockReturnValue({ actor: makeShieldedTarget({ perkIds: [SHIELD_MODULATION_ID] }) });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, poisonWeaponEffect)).toEqual(defaultModifiers);
    });
  });

  describe("Enemy Number One (Tank Focus, 3rd level)", () => {
    const ENEMY_NUMBER_ONE_ID = "Compendium.essence20.gi_joe_crb.Item.zvzta73A3ROyxv0J";

    function makeToken(actor, disposition) {
      return { actor, center: { x: 0, y: 0 }, document: { disposition } };
    }

    function makeTank(id) {
      return {
        id,
        system: { size: 'common' },
        statuses: new Set(),
        items: [{ type: 'perk', flags: { core: { sourceId: ENEMY_NUMBER_ONE_ID } } }],
      };
    }

    // attackedFlag simulates actor.getFlag('essence20', 'attackedEnemyNumberOneThisTurn')'s
    // stored value - undefined unless a test explicitly provides one. Keyed on `key` so it
    // doesn't also answer the unrelated getFlag('essence20', 'debilitated') check this same
    // function makes for every roll.
    function makeAttacker(token, attackedFlag = undefined) {
      return {
        system: { size: 'common' },
        statuses: new Set(),
        items: [],
        getActiveTokens: jest.fn(() => [token]),
        getFlag: jest.fn((scope, key) => (
          scope == 'essence20' && key == 'attackedEnemyNumberOneThisTurn' ? attackedFlag : undefined
        )),
        unsetFlag: jest.fn(),
      };
    }

    beforeEach(() => {
      canvas.tokens.placeables = [];
      canvas.grid.measurePath.mockReturnValue({ distance: 10 });
      game.combat = { id: 'combat1', round: 1, turn: 0 };
    });

    afterEach(() => {
      game.combat = null;
    });

    test("suffers a Snag attacking someone else near an enemy Tank", () => {
      const attackerToken = makeToken(null, 1);
      const tank = makeTank('tank1');
      canvas.tokens.placeables = [attackerToken, makeToken(tank, -1)];
      game.user.targets.first.mockReturnValue({ actor: makeActor('common') });

      expect(dice._getAutomaticCombatModifiers(makeAttacker(attackerToken), meleeWeaponEffect))
        .toEqual({ ...defaultModifiers, snag: true });
    });

    test("doesn't Snag an attack against the Tank itself, and flags that Tank for later", () => {
      const attackerToken = makeToken(null, 1);
      const tank = makeTank('tank1');
      canvas.tokens.placeables = [attackerToken, makeToken(tank, -1)];
      game.user.targets.first.mockReturnValue({ actor: tank });

      expect(dice._getAutomaticCombatModifiers(makeAttacker(attackerToken), meleeWeaponEffect))
        .toEqual({ ...defaultModifiers, enemyNumberOneTankId: 'tank1' });
    });

    test("doesn't apply once the attacker already attacked that Tank this turn", () => {
      const attackerToken = makeToken(null, 1);
      const tank = makeTank('tank1');
      canvas.tokens.placeables = [attackerToken, makeToken(tank, -1)];
      game.user.targets.first.mockReturnValue({ actor: makeActor('common') });
      const attacker = makeAttacker(attackerToken, { combatId: 'combat1', round: 1, turn: 0, tankId: 'tank1' });

      expect(dice._getAutomaticCombatModifiers(attacker, meleeWeaponEffect)).toEqual(defaultModifiers);
    });

    test("applies again once it's a new turn, despite a stale flag from an earlier turn", () => {
      const attackerToken = makeToken(null, 1);
      const tank = makeTank('tank1');
      canvas.tokens.placeables = [attackerToken, makeToken(tank, -1)];
      game.user.targets.first.mockReturnValue({ actor: makeActor('common') });
      const attacker = makeAttacker(attackerToken, { combatId: 'combat1', round: 1, turn: 0, tankId: 'tank1' });
      game.combat = { id: 'combat1', round: 1, turn: 2 };

      expect(dice._getAutomaticCombatModifiers(attacker, meleeWeaponEffect))
        .toEqual({ ...defaultModifiers, snag: true });
    });

    test("doesn't apply outside of combat", () => {
      const attackerToken = makeToken(null, 1);
      const tank = makeTank('tank1');
      canvas.tokens.placeables = [attackerToken, makeToken(tank, -1)];
      game.user.targets.first.mockReturnValue({ actor: makeActor('common') });
      game.combat = null;

      expect(dice._getAutomaticCombatModifiers(makeAttacker(attackerToken), meleeWeaponEffect))
        .toEqual(defaultModifiers);
    });

    test("doesn't apply beyond 30 feet", () => {
      const attackerToken = makeToken(null, 1);
      const tank = makeTank('tank1');
      canvas.tokens.placeables = [attackerToken, makeToken(tank, -1)];
      canvas.grid.measurePath.mockReturnValue({ distance: 35 });
      game.user.targets.first.mockReturnValue({ actor: makeActor('common') });

      expect(dice._getAutomaticCombatModifiers(makeAttacker(attackerToken), meleeWeaponEffect))
        .toEqual(defaultModifiers);
    });

    test("doesn't apply to an allied Tank (same disposition as the attacker)", () => {
      const attackerToken = makeToken(null, 1);
      const tank = makeTank('tank1');
      canvas.tokens.placeables = [attackerToken, makeToken(tank, 1)];
      game.user.targets.first.mockReturnValue({ actor: makeActor('common') });

      expect(dice._getAutomaticCombatModifiers(makeAttacker(attackerToken), meleeWeaponEffect))
        .toEqual(defaultModifiers);
    });

    test("doesn't apply without any nearby Tank", () => {
      const attackerToken = makeToken(null, 1);
      canvas.tokens.placeables = [attackerToken];
      game.user.targets.first.mockReturnValue({ actor: makeActor('common') });

      expect(dice._getAutomaticCombatModifiers(makeAttacker(attackerToken), meleeWeaponEffect))
        .toEqual(defaultModifiers);
    });
  });

  describe("First Strike (7th level)", () => {
    function makeCombat({ turn, combatantIndex }) {
      const combatant = { actor: { uuid: 'target-uuid' } };
      const turns = [];
      turns[combatantIndex] = combatant;

      return {
        turn,
        turns,
        combatants: { find: jest.fn(finder => (finder(combatant) ? combatant : undefined)) },
      };
    }

    test("grants an Edge against a target who hasn't acted yet this round", () => {
      const target = makeActor('common');
      target.uuid = 'target-uuid';
      game.user.targets.first.mockReturnValue({ actor: target });
      game.combat = makeCombat({ turn: 0, combatantIndex: 2 });
      const actor = makeActor('common', [], { perkIds: [FIRST_STRIKE_ID] });

      expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect))
        .toEqual({ ...defaultModifiers, edge: true });
    });

    test("doesn't apply to a target who already had their turn", () => {
      const target = makeActor('common');
      target.uuid = 'target-uuid';
      game.user.targets.first.mockReturnValue({ actor: target });
      game.combat = makeCombat({ turn: 2, combatantIndex: 0 });
      const actor = makeActor('common', [], { perkIds: [FIRST_STRIKE_ID] });

      expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect)).toEqual(defaultModifiers);
    });

    test("doesn't apply outside of combat", () => {
      const target = makeActor('common');
      target.uuid = 'target-uuid';
      game.user.targets.first.mockReturnValue({ actor: target });
      game.combat = null;
      const actor = makeActor('common', [], { perkIds: [FIRST_STRIKE_ID] });

      expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect)).toEqual(defaultModifiers);
    });

    test("doesn't apply without the Perk", () => {
      const target = makeActor('common');
      target.uuid = 'target-uuid';
      game.user.targets.first.mockReturnValue({ actor: target });
      game.combat = makeCombat({ turn: 0, combatantIndex: 2 });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect)).toEqual(defaultModifiers);
    });
  });

  describe("Heavy Ordnance (Infantry/Mechanized Infantry Focus, 15th level, p.82)", () => {
    const HEAVY_ORDNANCE_ID = `${GI_JOE_CRB}b2viBBrNk08Kc9ts`;

    function makeDriverActor({ size = 'common', hasPerk = true } = {}) {
      const items = hasPerk ? [{ type: 'perk', flags: { core: { sourceId: HEAVY_ORDNANCE_ID } } }] : [];
      return { uuid: 'Actor.driver1', type: 'character', system: { size }, items };
    }

    function makeVehicleActor({ size = 'huge', crew = { crew1: { vehicleRole: 'driver', uuid: 'Actor.driver1' } } } = {}) {
      return { type: 'vehicle', system: { size, actors: crew }, statuses: new Set(), getFlag: jest.fn() };
    }

    afterEach(() => {
      global.fromUuidSync.mockReset();
    });

    test("grants an Edge attacking another vehicle, regardless of the driver's own size", () => {
      global.fromUuidSync.mockReturnValue(makeDriverActor({ size: 'small' }));
      const target = makeActor('huge');
      target.type = 'vehicle';
      game.user.targets.first.mockReturnValue({ actor: target });
      const vehicle = makeVehicleActor({ size: 'huge' });

      expect(dice._getAutomaticCombatModifiers(vehicle, meleeWeaponEffect))
        .toEqual({ ...defaultModifiers, edge: true });
    });

    test("grants an Edge attacking an enemy the driver's size or greater", () => {
      global.fromUuidSync.mockReturnValue(makeDriverActor({ size: 'common' }));
      const target = makeActor('huge');
      game.user.targets.first.mockReturnValue({ actor: target });
      const vehicle = makeVehicleActor({ size: 'huge' });

      expect(dice._getAutomaticCombatModifiers(vehicle, meleeWeaponEffect))
        .toEqual({ ...defaultModifiers, edge: true });
    });

    test("doesn't apply against an enemy smaller than the driver", () => {
      global.fromUuidSync.mockReturnValue(makeDriverActor({ size: 'large' }));
      const target = makeActor('common');
      game.user.targets.first.mockReturnValue({ actor: target });
      const vehicle = makeVehicleActor({ size: 'common' });

      expect(dice._getAutomaticCombatModifiers(vehicle, meleeWeaponEffect)).toEqual(defaultModifiers);
    });

    test("doesn't apply without a driver assigned", () => {
      const target = makeActor('huge');
      game.user.targets.first.mockReturnValue({ actor: target });
      const vehicle = makeVehicleActor({ size: 'huge', crew: {} });

      expect(dice._getAutomaticCombatModifiers(vehicle, meleeWeaponEffect)).toEqual(defaultModifiers);
    });

    test("doesn't apply when the driver doesn't have the Perk", () => {
      global.fromUuidSync.mockReturnValue(makeDriverActor({ size: 'common', hasPerk: false }));
      const target = makeActor('huge');
      game.user.targets.first.mockReturnValue({ actor: target });
      const vehicle = makeVehicleActor({ size: 'huge' });

      expect(dice._getAutomaticCombatModifiers(vehicle, meleeWeaponEffect)).toEqual(defaultModifiers);
    });

    test("doesn't apply when the roller isn't a vehicle", () => {
      global.fromUuidSync.mockReturnValue(makeDriverActor({ size: 'common' }));
      const target = makeActor('huge');
      game.user.targets.first.mockReturnValue({ actor: target });
      const actor = makeActor('huge', [], { perkIds: [HEAVY_ORDNANCE_ID] });

      expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect)).toEqual(defaultModifiers);
    });
  });

  describe("Who Dares, Wins (Door-Kicker Focus, 6th level)", () => {
    test("grants an Edge on any roll during round 1 of combat", () => {
      game.combat = { round: 1 };
      const actor = makeActor('common', [], { perkIds: [WHO_DARES_WINS_ID] });

      expect(dice._getAutomaticCombatModifiers(actor, null)).toEqual({ ...defaultModifiers, edge: true });
    });

    test("applies to weaponEffect attacks too", () => {
      game.combat = { round: 1 };
      const actor = makeActor('common', [], { perkIds: [WHO_DARES_WINS_ID] });

      expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect))
        .toEqual({ ...defaultModifiers, edge: true });
    });

    test("doesn't apply in round 2 or later", () => {
      game.combat = { round: 2 };
      const actor = makeActor('common', [], { perkIds: [WHO_DARES_WINS_ID] });

      expect(dice._getAutomaticCombatModifiers(actor, null)).toEqual(defaultModifiers);
    });

    test("doesn't apply outside of combat", () => {
      game.combat = null;
      const actor = makeActor('common', [], { perkIds: [WHO_DARES_WINS_ID] });

      expect(dice._getAutomaticCombatModifiers(actor, null)).toEqual(defaultModifiers);
    });

    test("doesn't apply without the Perk", () => {
      game.combat = { round: 1 };
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, null)).toEqual(defaultModifiers);
    });
  });

  describe("Seconds Between Click & Boom (9th level)", () => {
    const evasionWeaponEffect = {
      type: 'weaponEffect',
      system: { classification: { style: 'melee' }, defenseType: 'evasion' },
    };

    test("attacks against Evasion suffer a Snag when the target has the Perk", () => {
      game.user.targets.first.mockReturnValue({
        actor: makeActor('common', [], { perkIds: [SECONDS_BETWEEN_CLICK_AND_BOOM_ID] }),
      });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, evasionWeaponEffect))
        .toEqual({ ...defaultModifiers, snag: true });
    });

    test("doesn't apply to attacks against a different Defense", () => {
      game.user.targets.first.mockReturnValue({
        actor: makeActor('common', [], { perkIds: [SECONDS_BETWEEN_CLICK_AND_BOOM_ID] }),
      });
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, meleeWeaponEffect)).toEqual(defaultModifiers);
    });
  });

  describe("Debilitating Strike (16th level, consuming a pending Snag)", () => {
    test("a debilitated actor's next roll (any type) suffers a Snag", () => {
      const actor = makeActor('common', [], { debilitated: true });

      expect(dice._getAutomaticCombatModifiers(actor, null))
        .toEqual({ ...defaultModifiers, snag: true, debilitatedConsumed: true });
    });

    test("an actor without the flag is unaffected", () => {
      const actor = makeActor('common');

      expect(dice._getAutomaticCombatModifiers(actor, null)).toEqual(defaultModifiers);
    });
  });

  describe("Think On It / Plan of Action, consuming a pending banked bonus", () => {
    function makeActorWithPending(flags = {}) {
      const actor = makeActor('common');
      actor.getFlag = jest.fn((scope, key) => (scope == 'essence20' ? flags[key] : undefined));
      return actor;
    }

    test("Think On It grants an Edge and reports the flag to clear", () => {
      const actor = makeActorWithPending({ pendingThinkOnIt: { edge: true, combatId: null, round: null } });

      expect(dice._getAutomaticCombatModifiers(actor, null))
        .toEqual({ ...defaultModifiers, edge: true, pendingBonusesToClear: ['pendingThinkOnIt'] });
    });

    test("Plan of Action grants its own banked shiftUp and reports the flag to clear", () => {
      const actor = makeActorWithPending({ pendingPlanOfAction: { shiftUp: 2, combatId: null, round: null } });

      expect(dice._getAutomaticCombatModifiers(actor, null))
        .toEqual({ ...defaultModifiers, shiftUp: 2, pendingBonusesToClear: ['pendingPlanOfAction'] });
    });

    test("both can be pending on the same roll at once", () => {
      const actor = makeActorWithPending({
        pendingThinkOnIt: { edge: true, combatId: null, round: null },
        pendingPlanOfAction: { shiftUp: 1, combatId: null, round: null },
      });

      expect(dice._getAutomaticCombatModifiers(actor, null)).toEqual({
        ...defaultModifiers, edge: true, shiftUp: 1,
        pendingBonusesToClear: ['pendingThinkOnIt', 'pendingPlanOfAction'],
      });
    });

    test("a stale bonus from a finished combat doesn't apply", () => {
      game.combat = { id: 'newCombat', round: 1 };
      const actor = makeActorWithPending({ pendingThinkOnIt: { edge: true, combatId: 'oldCombat', round: 3 } });

      expect(dice._getAutomaticCombatModifiers(actor, null)).toEqual(defaultModifiers);
      game.combat = null;
    });

    test("an actor with no pending bonus at all is unaffected", () => {
      const actor = makeActor('common');
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
        .toEqual({ ...defaultModifiers, shiftDown: 2 });
    });

    test("downshifts a Zord's attack even without a Power Weapon", () => {
      const target = makeTargetWithRolePoints({ value: 1 });
      game.user.targets.first.mockReturnValue({ actor: target });
      const actor = makeAttackingActor({ type: 'zord', weaponTraits: ['sharp'] });

      expect(dice._getAutomaticCombatModifiers(actor, weaponEffectWithParent))
        .toEqual({ ...defaultModifiers, shiftDown: 1 });
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
        .toEqual({ ...defaultModifiers, shiftDown: 2 });
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
