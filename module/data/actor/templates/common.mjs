import { E20 } from "../../../helpers/config.mjs";
import { makeInt } from "../../generic-makers.mjs";

const fields = foundry.data.fields;

function makeEssenceShift() {
  return new fields.SchemaField({
    shiftUp: makeInt(),
    shiftDown: makeInt(),
  });
}

function makeMovementFields() {
  return new fields.SchemaField({
    altMode: makeInt(),
    base: makeInt(),
    bonus: makeInt(),
    morphed: makeInt(),
    total: makeInt(),
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
    modifier: makeInt(),
    shift: new fields.StringField({initial: 'd20'}),
    shiftDown: makeInt(),
    shiftUp: makeInt(),
    snag: new fields.BooleanField({initial: false}),
  });
}

export const common = () => ({
  altModeName: new fields.StringField({initial: ''}),
  altModeSize: new fields.StringField({
    initial: E20.actorSizes.common,
    choices: Object.values(E20.actorSizes),
  }),
  canMorph: new fields.BooleanField({initial: false}),
  canSpellcast: new fields.BooleanField({initial: false}),
  canTransform: new fields.BooleanField({initial: false}),
  color: new fields.StringField({initial: '#b5b1b1'}),
  conditioning: makeInt(),
  description: new fields.StringField({initial: ''}), // Idt we need this
  energon: new fields.SchemaField({
    dark: new fields.SchemaField({
      value: makeInt(),
    }),
    normal: new fields.SchemaField({
      max: makeInt(),
      value: makeInt(),
    }),
    primal: makeInt(),
    red: makeInt(),
    synthEn: makeInt(),
    essenceRanks: new fields.SchemaField({
      smarts: makeInt(),
      social: makeInt(),
      speed: makeInt(),
      strength: makeInt(),
    }),
    essenceShifts: new fields.SchemaField({
      any: makeEssenceShift(),
      smarts: makeEssenceShift(),
      social: makeEssenceShift(),
      speed: makeEssenceShift(),
      strength: makeEssenceShift(),
    }),
  }),
  focusEssence: new fields.StringField({initial: ''}),
  health: new fields.SchemaField({
    bonus: makeInt(),
    max: makeInt(),
    origin: makeInt(),
    value: makeInt(),
  }),
  initiative: new fields.SchemaField({
    edge: new fields.BooleanField({initial: false}),
    formula: new fields.StringField({initial: '2d20kl + 0'}),
    modifier: makeInt(),
    snag: new fields.BooleanField({initial: false}),
    shift: new fields.StringField({initial: 'd20'}),
    shiftDown: makeInt(),
    shiftUp: makeInt(),
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
      max: makeInt(),
      value: makeInt(),
    }),
    sorcerous: new fields.SchemaField({
      levelTaken: makeInt(),
      max: makeInt(),
      value: makeInt(),
    }),
  }),
  size: new fields.StringField({
    initial: E20.actorSizes.common,
    choices: Object.values(E20.actorSizes),
  }),
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
    max: makeInt(),
    min: makeInt(),
    value: makeInt(),
  }),
});
