import { E20 } from "../../../helpers/config.mjs";

import { makeBool, makeInt, makeStr, makeStrWithChoices } from "../../generic-makers.mjs";

const fields = foundry.data.fields;

function makeEssenceShift() {
  return new fields.SchemaField({
    shiftUp: makeInt(0),
    shiftDown: makeInt(0),
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
    shift: makeStrWithChoices('d20', Object.keys(E20.skillShifts)),
    shiftDown: makeInt(0),
    shiftUp: makeInt(0),
    snag: makeBool(false),
  });
}

export const common = () => ({
  altModeName: makeStr(''),
  altModeSize: makeStrWithChoices('common', Object.keys(E20.actorSizes)),
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
    smarts: makeInt(0),
    social: makeInt(0),
    speed: makeInt(0),
    strength: makeInt(0),
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
    shift: makeStrWithChoices('d20', E20.initiativeShiftList),
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
  movementNotSet: makeBool(false),
  powers: new fields.SchemaField({
    personal: new fields.SchemaField({
      max: makeInt(0),
      value: makeInt(0),
    }),
    sorcerous: new fields.SchemaField({
      levelTaken: makeInt(0),
      max: makeInt(0),
      value: makeInt(0),
    }),
  }),
  size: makeStrWithChoices('common', Object.keys(E20.actorSizes)),
  skills: new fields.SchemaField({
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
    roleSkillDie: makeSkillFields(),
    spellcasting: makeSkillFields(),
    streetwise: makeSkillFields(),
    survival: makeSkillFields(),
    targeting: makeSkillFields(),
    technology: makeSkillFields(),
  }),
  stun: new fields.SchemaField({
    max: makeInt(0),
    min: makeInt(0),
    value: makeInt(0),
  }),
});
