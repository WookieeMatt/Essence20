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
    // Specializations under this skill, keyed by a slug of their own name (see
    // helpers/utils.mjs#slugifySpecializationName) rather than an opaque random id, so a Perk's
    // Active Effect can target one directly - e.g. system.skills.science.specializations.
    // medicine.shiftUp (ADD) or .edge (OVERRIDE true), or even grant the entry itself outright
    // via one OVERRIDE change per field (.name, .granted, etc. - see
    // specialization-handler.mjs#normalizeSpecializations for how a partially-set grant like
    // that gets its other fields defaulted). Safe to key by name now specifically because a
    // Specialization can no longer be renamed once added. Plain ObjectField (not a schema-
    // validated TypedObjectField) to match the established system.items map convention (data/
    // item/templates/parent-item.mjs) for this same shape of "id -> record" actor data. Each
    // entry: {name, shift, isSpecialized, edge, shiftUp, shiftDown, snag, granted}. `granted`
    // distinguishes a specialization a Perk/Item gave the actor for free from one the player
    // bought with a skill point - see helpers/skill-picker.mjs#computeEssenceSpend, which only
    // tallies the latter. See essence20-specialization-redesign for the full design this
    // replaces (a standalone `specialization` Item type, still readable via a Release N
    // migration - see migration.mjs).
    specializations: new fields.ObjectField({}),
  };

  // A skill can draw its invested points from more than one real Essence at once - either one of
  // the two built-in "any"-Essence skills (Spellcasting, Weird - all four essences true above),
  // or a normal skill a Perk has extended to a second Essence via its own Active Effect (e.g. GI
  // Joe CRB's Terrifying Presence: system.skills.intimidation.essences.social = true, on top of
  // Intimidation's default strength: true). Always present (not gated on essence === 'any' the
  // way it used to be) since any skill could become multi-Essence this way - see
  // helpers/skill-picker.mjs#computeEssenceSpend, which only actually reads this once a skill's
  // own `essences` has more than one flag true; it's a no-op default the rest of the time. The
  // Skill Picker (module/apps/skill-picker.mjs) is where this gets split, mirroring how
  // character-sheet.mjs#_prepareSkillRankAllocation already tallies ordinary skills.
  schema.essenceAttribution = new fields.SchemaField({
    smarts: makeInt(0),
    social: makeInt(0),
    speed: makeInt(0),
    strength: makeInt(0),
  });

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
