import { E20 } from "../../../helpers/config.mjs";
import { makeInt, makeStr, makeStrWithChoices } from "../../generic-makers.mjs";

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
      smarts: new fields.BooleanField({initial: false}),
      social: new fields.BooleanField({initial: false}),
      speed: new fields.BooleanField({initial: false}),
      strength: new fields.BooleanField({initial: false}),
    }),
    edge: new fields.BooleanField({initial: false}),
    isSpecialized: new fields.BooleanField({initial: false}),
    modifier: makeInt(0),
    shift: makeStrWithChoices('d20', E20.skillRollableShifts),
    shiftDown: makeInt(0),
    shiftUp: makeInt(0),
    snag: new fields.BooleanField({initial: false}),
  });
}

export const common = () => ({
  altModeName: makeStr(''),
  altModeSize: makeStrWithChoices('common', E20.actorSizes),
  canMorph: new fields.BooleanField({initial: false}),
  canSpellcast: new fields.BooleanField({initial: false}),
  canTransform: new fields.BooleanField({initial: false}),
  color: new fields.ColorField({initial: '#b5b1b1'}),
  conditioning: makeInt(0),
  description: makeStr(''), // Idt we need this
  energon: new fields.SchemaField({
    dark: new fields.SchemaField({
      value: makeInt(0),
    }),
    normal: new fields.SchemaField({
      max: makeInt(0),
      value: makeInt(0),
    }),
    primal: makeInt(0),
    red: makeInt(0),
    synthEn: makeInt(0),
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
  }),
  focusEssence: makeStr(''),
  health: new fields.SchemaField({
    bonus: makeInt(0),
    max: makeInt(0),
    origin: makeInt(0),
    value: makeInt(0),
  }),
  initiative: new fields.SchemaField({
    edge: new fields.BooleanField({initial: false}),
    formula: makeStr('2d20kl + 0'),
    modifier: makeInt(0),
    snag: new fields.BooleanField({initial: false}),
    shift: makeStrWithChoices('d20', E20.initiativeShiftList),
    shiftDown: makeInt(0),
    shiftUp: makeInt(0),
  }),
  isLocked: new fields.BooleanField({initial: false}),
  isMorphed: new fields.BooleanField({initial: false}),
  isTransformed: new fields.BooleanField({initial: false}),
  movement: new fields.SchemaField({
    aerial: makeMovementFields(),
    climb: makeMovementFields(),
    ground: makeMovementFields(),
    swim: makeMovementFields(),
  }),
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
  size: makeStrWithChoices('common', E20.actorSizes),
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
