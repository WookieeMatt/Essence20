import { E20 } from "../../../helpers/config.mjs";

import { makeBool, makeInt, makeStrWithChoices } from "../../generic-makers.mjs";

const fields = foundry.data.fields;

function makeDefensesFields(usesDrivers, init) {
  return new fields.SchemaField({
    usesDrivers: makeBool(usesDrivers),
    value: makeInt(init),
  });
}

function makeEssencesFields(usesDrivers, init) {
  return new fields.SchemaField({
    usesDrivers: makeBool(usesDrivers),
    value: makeInt(init),
  });
}

function makeMovementFields(base=0) {
  return new fields.SchemaField({
    altMode: makeInt(0),
    base: makeInt(base),
    bonus: makeInt(0),
    morphed: makeInt(0),
    total: makeInt(base),
  });
}

function makeSkillFields(essence, canBeInitiative=false, base='d20') {
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
    shift: makeStrWithChoices(Object.keys(E20.skillShifts), base),
    shiftDown: makeInt(0),
    shiftUp: makeInt(0),
    snag: makeBool(false),
  });
}

export const zordBase = () => ({
  armor: makeInt(10),
  conditioning: makeInt(3),
  defenses: new fields.SchemaField({
    toughness: makeDefensesFields(false, 17),
    evasion: makeDefensesFields(false, 14),
    willpower: makeDefensesFields(true, null),
    cleverness: makeDefensesFields(true, null),
  }),
  essences: new fields.SchemaField({
    strength: makeEssencesFields(false, 6),
    speed: makeEssencesFields(false, 4),
    smarts: makeEssencesFields(true, null),
    social: makeEssencesFields(true, null),
  }),
  health: new fields.SchemaField({
    bonus: makeInt(0),
    max: makeInt(6),
    origin: makeInt(0),
    value: makeInt(6),
  }),
  movement: new fields.SchemaField({
    aerial: makeMovementFields(0),
    climb: makeMovementFields(0),
    ground: makeMovementFields(40),
    swim: makeMovementFields(0),
  }),
  size: makeStrWithChoices(Object.keys(E20.actorSizes), 'huge'),
  skills: new fields.SchemaField({
    acrobatics: makeSkillFields('speed', false),
    alertness: makeSkillFields('smarts', false),
    animalHandling: makeSkillFields('social', false),
    athletics: makeSkillFields('strength', false),
    brawn: makeSkillFields('strength', false),
    culture: makeSkillFields('smarts', false),
    deception: makeSkillFields('social', false),
    driving: makeSkillFields('speed', false, 'd2'),
    finesse: makeSkillFields('speed', false),
    infiltration: makeSkillFields('speed', false),
    initiative: makeSkillFields('speed', true),
    intimidation: makeSkillFields('strength', false),
    might: makeSkillFields('strength', false, 'd6'),
    performance: makeSkillFields('social', false),
    persuasion: makeSkillFields('social', false),
    science: makeSkillFields('smarts', false),
    spellcasting: makeSkillFields('any', false),
    streetwise: makeSkillFields('social', false),
    survival: makeSkillFields('smarts', false),
    targeting: makeSkillFields('speed', false, 'd6'),
    technology: makeSkillFields('smarts', false),
  }),
});
