import { E20 } from "../../../helpers/config.mjs";

import { makeBool, makeInt, makeStr, makeStrWithChoices } from "../../generic-makers.mjs";

const fields = foundry.data.fields;

function makeDamageSchema(damageTypes) {
  const itemSchema = {};
  for (const damageType of Object.keys(damageTypes)) {
    itemSchema[damageType] = makeBool(false);
  }

  return new fields.SchemaField(itemSchema);
}

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

function makeSkillFields(essence, canBeInitiative=false) {
  return new fields.SchemaField({
    canBeInitiative: makeBool(canBeInitiative),
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
  immunities: makeDamageSchema(E20.damageTypes),
  initiative: new fields.SchemaField({
    formula: makeStr('2d20kl + 0'),
    // TODO: Only keeping modifier and shift around for migration. Remove in v6.
    modifier: makeInt(0),
    shift: makeStrWithChoices(Object.keys(E20.skillShifts), 'd20'),
    skill: makeStrWithChoices(Object.keys(E20.skills), 'initiative'),
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
  resistances: makeDamageSchema(E20.damageTypes),
  size: makeStrWithChoices(Object.keys(E20.actorSizes), 'common'),
  skills: new fields.SchemaField({
    roleSkillDie: makeSkillFields(),
    acrobatics: makeSkillFields('speed', false),
    alertness: makeSkillFields('smarts', false),
    animalHandling: makeSkillFields('social', false),
    athletics: makeSkillFields('strength', false),
    brawn: makeSkillFields('strength', false),
    culture: makeSkillFields('smarts', false),
    deception: makeSkillFields('social', false),
    driving: makeSkillFields('speed', false),
    finesse: makeSkillFields('speed', false),
    infiltration: makeSkillFields('speed', false),
    initiative: makeSkillFields('speed', true),
    intimidation: makeSkillFields('strength', false),
    might: makeSkillFields('strength', false),
    performance: makeSkillFields('social', false),
    persuasion: makeSkillFields('social', false),
    science: makeSkillFields('smarts', false),
    spellcasting: makeSkillFields('any', false),
    streetwise: makeSkillFields('social', false),
    survival: makeSkillFields('smarts', false),
    targeting: makeSkillFields('speed', false),
    technology: makeSkillFields('smarts', false),
    wealth: makeSkillFields(),
  }),
  stun: new fields.SchemaField({
    max: makeInt(0),
    min: makeInt(0),
    value: makeInt(0),
  }),
});
