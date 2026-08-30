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

export function makeMovementFields(init=0) {
  return new fields.SchemaField({
    altMode: makeInt(0),
    base: makeInt(init),
    bonus: makeInt(0),
    morphed: makeInt(0),
    total: makeInt(init),
  });
}

export function makeSkillFields(essence, canBeInitiative=false, init='d20') {
  const schema = {
    canBeInitiative: makeBool(canBeInitiative),
    canCritD2: makeBool(false),
    essences: new fields.SchemaField({
      smarts: makeBool(['smarts', 'any'].includes(essence)),
      social: makeBool(['social', 'any'].includes(essence)),
      speed: makeBool(['speed', 'any'].includes(essence)),
      strength: makeBool(['strength', 'any'].includes(essence)),
    }),
    edge: makeBool(false),
    // Whether the NPC Skill Picker app (module/apps/skill-picker.mjs) has this skill selected
    // to show on NPC-like sheets - replaces the old auto-detected "does this deviate from
    // default" heuristic entirely, see base-actor-sheet.mjs#_prepareChosenNpcSkills. Unused by
    // PCs (always shown), same as `essences` above being unused by non-Zord/MFZ types.
    isChosen: makeBool(false),
    isSpecialized: makeBool(false),
    modifier: makeInt(0),
    shift: makeStrWithChoices(Object.keys(E20.skillShifts), init),
    shiftDown: makeInt(0),
    shiftUp: makeInt(0),
    snag: makeBool(false),
  };

  // "Any"-essence skills (Spellcasting, Weird) can draw their invested points from more than
  // one real Essence at once (e.g. a Weird check built from a Strength point and a Speed
  // point) - the Skill Picker tracks how an NPC's spend on this skill is split across the four
  // real Essences so it can be added into each Essence's own spent-total, mirroring how
  // character-sheet.mjs#_prepareSkillRankAllocation already tallies ordinary skills.
  if (essence === 'any') {
    schema.essenceAttribution = new fields.SchemaField({
      smarts: makeInt(0),
      social: makeInt(0),
      speed: makeInt(0),
      strength: makeInt(0),
    });
  }

  return new fields.SchemaField(schema);
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
    weird: makeSkillFields('any', false),
  }),
  stun: new fields.SchemaField({
    max: makeInt(0),
    min: makeInt(0),
    value: makeInt(0),
  }),
});
