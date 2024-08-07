import { E20 } from "../../../helpers/config.mjs";

import { makeBool, makeInt, makeStr, makeStrWithChoices } from "../../generic-makers.mjs";

const fields = foundry.data.fields;

function makeEssenceShift() {
  return new fields.SchemaField({
    edge: makeBool(false),
    shiftUp: makeInt(0),
    shiftDown: makeInt(0),
    snag: makeBool(false),
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

function makeSkillFields() {
  return new fields.SchemaField({
    essences: new fields.SchemaField({
      smarts: makeBool(false),
      social: makeBool(false),
      speed: makeBool(false),
      strength: makeBool(false),
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
  altModeId: makeStr(''),
  altModeName: makeStr(''),
  altModesize: makeStrWithChoices(Object.keys(E20.actorSizes), 'common'),
  canMorph: makeBool(false),
  canSpellcast: makeBool(false),
  canTransform: makeBool(false),
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
  essenceRanks: new fields.SchemaField({
    smarts: makeStrWithChoices(E20.CombinedEssenceRankNames, null),
    social: makeStrWithChoices(E20.CombinedEssenceRankNames, null),
    speed: makeStrWithChoices(E20.CombinedEssenceRankNames, null),
    strength: makeStrWithChoices(E20.CombinedEssenceRankNames, null),
  }),
  essenceShifts: new fields.SchemaField({
    any: makeEssenceShift(),
    smarts: makeEssenceShift(),
    social: makeEssenceShift(),
    speed: makeEssenceShift(),
    strength: makeEssenceShift(),
  }),
  focusEssence: makeStr(''),
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
  isMorphed: makeBool(false),
  isTransformed: makeBool(false),
  movement: new fields.SchemaField({
    aerial: makeMovementFields(),
    climb: makeMovementFields(),
    ground: makeMovementFields(),
    swim: makeMovementFields(),
  }),
  movementIsReadOnly: makeBool(false),
  movementNotSet: makeBool(false),
  notes: new fields.HTMLField(),
  originEssencesIncrease: makeStr(),
  originSkillsIncrease: makeStr(),
  powers: new fields.SchemaField({
    personal: new fields.SchemaField({
      regeneration: makeInt(0),
      max: makeInt(0),
      value: makeInt(0),
    }),
    sorcerous: new fields.SchemaField({
      levelTaken: makeInt(0),
      max: makeInt(0),
      value: makeInt(0),
    }),
  }),
  size: makeStrWithChoices(Object.keys(E20.actorSizes), 'common'),
  skills: new fields.SchemaField({
    roleSkillDie: makeSkillFields(),
    acrobatics: makeSkillFields(),
    alertness: makeSkillFields(),
    animalHandling: makeSkillFields(),
    athletics: makeSkillFields(),
    brawn: makeSkillFields(),
    culture: makeSkillFields(),
    deception: makeSkillFields(),
    driving: makeSkillFields(),
    finesse: makeSkillFields(),
    infiltration: makeSkillFields(),
    intimidation: makeSkillFields(),
    might: makeSkillFields(),
    performance: makeSkillFields(),
    persuasion: makeSkillFields(),
    science: makeSkillFields(),
    spellcasting: makeSkillFields(),
    streetwise: makeSkillFields(),
    survival: makeSkillFields(),
    targeting: makeSkillFields(),
    technology: makeSkillFields(),
    wealth: makeSkillFields(),
  }),
  stun: new fields.SchemaField({
    max: makeInt(0),
    min: makeInt(0),
    value: makeInt(0),
  }),
});
