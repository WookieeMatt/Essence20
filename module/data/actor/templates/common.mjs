import { E20 } from "../../../helpers/config.mjs";

import { makeBool, makeInt, makeStr, makeStrWithChoices } from "../../generic-makers.mjs";

const fields = foundry.data.fields;

function makeEssenceShift() {
  return new fields.SchemaField({
    edge: makeBool(false),
    shiftUp: makeInt(0),
    shiftDown: makeInt(0),
    snag: makeBool(false),
    untrainedBonus: makeBool(false),
  });
}

function makeMovementFields() {
  return new fields.SchemaField({
    altMode: makeInt(0),
    base: makeInt(0),
    bonus: makeInt(0),
    morphed: makeInt(0),
    total: makeInt(0),
  });
}

function makeSkillFields(essence) {
  return new fields.SchemaField({
    canCritD2: makeBool(false),
    essences: new fields.SchemaField({
      smarts: makeBool(['smarts', 'any'].includes(essence)),
      social: makeBool(['social', 'any'].includes(essence)),
      speed: makeBool(['speed', 'any'].includes(essence)),
      strength: makeBool(['strength', 'any'].includes(essence)),
    }),
    edge: makeBool(false),
    isSpecialized: makeBool(false),
    modifier: makeInt(0),
    shift: makeStrWithChoices(Object.keys(E20.skillShifts), 'd20'),
    shiftDown: makeInt(0),
    shiftUp: makeInt(0),
    snag: makeBool(false),
  });
}

export const common = () => ({
  actors: new fields.ObjectField({}),
  color: new fields.ColorField({initial: '#b5b1b1'}),
  conditioning: makeInt(0),
  energon: new fields.SchemaField({
    dark: new fields.SchemaField({
      value: makeInt(0),
    }),
    normal: new fields.SchemaField({
      max: makeInt(0),
      value: makeInt(0),
    }),
    primal: new fields.SchemaField({
      value: makeInt(0),
    }),
    red: new fields.SchemaField({
      value: makeInt(0),
    }),
    synthEn: new fields.SchemaField({
      value: makeInt(0),
    }),
  }),
  essenceShifts: new fields.SchemaField({
    any: makeEssenceShift(),
    smarts: makeEssenceShift(),
    social: makeEssenceShift(),
    speed: makeEssenceShift(),
    strength: makeEssenceShift(),
  }),
  health: new fields.SchemaField({
    bonus: makeInt(0),
    max: makeInt(0),
    origin: makeInt(0),
    value: makeInt(0),
  }),
  initiative: new fields.SchemaField({
    edge: makeBool(false),
    formula: makeStr('2d20kl + 0'),
    modifier: makeInt(0),
    snag: makeBool(false),
    shift: makeStrWithChoices(E20.initiativeShiftList, 'd20'),
    shiftDown: makeInt(0),
    shiftUp: makeInt(0),
  }),
  isLocked: makeBool(false),
  movement: new fields.SchemaField({
    aerial: makeMovementFields(),
    climb: makeMovementFields(),
    ground: makeMovementFields(),
    swim: makeMovementFields(),
  }),
  movementIsReadOnly: makeBool(false),
  movementNotSet: makeBool(false),
  notes: new fields.HTMLField(),
  size: makeStrWithChoices(Object.keys(E20.actorSizes), 'common'),
  skills: new fields.SchemaField({
    roleSkillDie: makeSkillFields(),
    acrobatics: makeSkillFields('speed'),
    alertness: makeSkillFields('smarts'),
    animalHandling: makeSkillFields('social'),
    athletics: makeSkillFields('strength'),
    brawn: makeSkillFields('strength'),
    culture: makeSkillFields('smarts'),
    deception: makeSkillFields('social'),
    driving: makeSkillFields('speed'),
    finesse: makeSkillFields('speed'),
    infiltration: makeSkillFields('speed'),
    intimidation: makeSkillFields('strength'),
    might: makeSkillFields('strength'),
    performance: makeSkillFields('social'),
    persuasion: makeSkillFields('social'),
    science: makeSkillFields('smarts'),
    spellcasting: makeSkillFields('any'),
    streetwise: makeSkillFields('social'),
    survival: makeSkillFields('smarts'),
    targeting: makeSkillFields('speed'),
    technology: makeSkillFields('smarts'),
    wealth: makeSkillFields(),
  }),
  stun: new fields.SchemaField({
    max: makeInt(0),
    min: makeInt(0),
    value: makeInt(0),
  }),
});
