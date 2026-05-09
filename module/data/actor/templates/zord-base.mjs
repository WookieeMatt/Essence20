import { E20 } from "../../../helpers/config.mjs";

import { makeInt, makeStrWithChoices } from "../../generic-makers.mjs";

import { makeDefensesFields, makeEssencesFields } from "./machine.mjs";

import { makeMovementFields, makeSkillFields } from "./common.mjs";

const fields = foundry.data.fields;

export const zordBase = () => ({
  armor: makeInt(1),
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
