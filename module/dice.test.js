import { Dice } from "./dice.mjs";
import { jest } from '@jest/globals';

/* Setup Mocks */

const chatMessage = jest.mock();
chatMessage.getSpeaker = jest.fn();
chatMessage.getSpeaker.mockReturnValue({});
chatMessage.create = jest.fn();

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

class Mocki18n {
  localize(text) {
    return text;
  }
  /* eslint-disable no-unused-vars */
  format(text, _) {
    return text;
  }
}

const mockActor = {
  items: [],
  system: {
    initiative: {
      formula: "",
      modifier: 0,
      shift: "d20",
      shiftDown: 0,
      shiftUp: 0,
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
  },
};

const dice = new Dice(chatMessage, rollDialog, new Mocki18n());

/* Begin Tests */

/* prepareInitiativeRoll */
describe("prepareInitiativeRoll", () => {
  test("normal initiative roll", async () => {
    rollDialog.getSkillRollOptions.mockReturnValue({
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
    canCritD2: false,
    essence: 'strength',
    isSpecialized: false,
    rolePoints: null,
    shift: 'd20',
    shiftDown: '0',
    shiftUp: '0',
    skill: 'athletics',
  };

  test("normal skill roll", async () => {
    rollDialog.getSkillRollOptions.mockReturnValue({
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
    expect(dice._rollSkillHelper).toHaveBeenCalledWith('d20 + 0', mockActor, "E20.RollRollingFor E20.SkillAthletics");
  });

  test("normal skill roll works with isSpecialized as false string", async () => {
    const datasetCopy = {
      ...dataset,
      isSpecialized: 'false',
    };
    rollDialog.getSkillRollOptions.mockReturnValue({
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
    expect(dice._rollSkillHelper).toHaveBeenCalledWith('d20 + 0', mockActor, "E20.RollRollingFor E20.SkillAthletics");
  });

  test("repeated normal skill roll", async () => {
    rollDialog.getSkillRollOptions.mockReturnValue({
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
    expect(dice._rollSkillHelper).toHaveBeenCalledWith('d20 + 0', mockActor, "E20.RollRepeatText<br>E20.RollRollingFor E20.SkillAthletics");
    expect(dice._rollSkillHelper.mock.calls.length).toBe(2);
  });

  test("auto success", async () => {
    const datasetCopy = {
      ...dataset,
      shift: 'autoSuccess',
    };
    rollDialog.getSkillRollOptions.mockReturnValue({
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
    expect(dice._rollSkillHelper).toHaveBeenCalledWith('d20 + 3d6 + 0', mockActor, "E20.RollRollingFor E20.SkillAthletics");
  });

  test("specialized skill roll", async () => {
    const datasetCopy = {
      ...dataset,
      isSpecialized: true,
      specializationName: 'Foo Specialization',
    };
    rollDialog.getSkillRollOptions.mockReturnValue({
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
    expect(dice._rollSkillHelper).toHaveBeenCalledWith('d20 + 0', mockActor, "E20.RollRollingFor Foo Specialization");
  });

  test("specialized skill roll works with isSpecialized as true string", async () => {
    const datasetCopy = {
      ...dataset,
      isSpecialized: 'true',
      specializationName: 'Foo Specialization',
    };
    rollDialog.getSkillRollOptions.mockReturnValue({
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
    expect(dice._rollSkillHelper).toHaveBeenCalledWith('d20 + 0', mockActor, "E20.RollRollingFor Foo Specialization");
  });

  test("normal weapon effect skill roll", async () => {
    rollDialog.getSkillRollOptions.mockReturnValue({
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
      "<b>E20.RollTypeAttack</b> - Zeo Power Clubs Effect (E20.SkillAthletics)<br><b>E20.WeaponEffect</b> - 1 E20.DamageBlunt<br>",
    );
  });

  test("normal spell skill roll", async () => {
    const dataset = {
      isSpecialized: false,
      shift: 'd20',
      skill: 'spellcasting',
      essence: 'any',
    };
    rollDialog.getSkillRollOptions.mockReturnValue({
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
    expect(dice._rollSkillHelper).toHaveBeenCalledWith('d20 + 0', mockActor, "<b>E20.RollTypeSpell</b> - Barreling Beam (E20.SkillSpellcasting)<br><b>E20.ItemDescription</b> - Some description<br>");
  });

  test("essence-shifted skill roll with edge", async () => {
    rollDialog.getSkillRollOptions.mockReturnValue({
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
    const expectedDataset = {
      ...dataset,
      isSpecialized: false,
      shiftUp: 1,
      shiftDown: 2,
    };
    const expectedSkillDataset = {
      edge: true,
      snag: false,
    };
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
      "<b>E20.WeaponEffect</b> - 1 E20.DamageBlunt<br>";

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
      "<b>E20.WeaponEffect</b> - 1 E20.DamageBlunt<br>";

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
      "<b>E20.WeaponEffect</b> - 1 E20.DamageBlunt<br>";

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
      "<b>E20.WeaponEffect</b> - 1 E20.DamageBlunt<br>";

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
