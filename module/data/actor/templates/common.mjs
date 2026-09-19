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
    // Separate from shiftUp - some Perks (Supercharged Essence, PR CRB p.98) only grant their
    // bonus "while Morphed", unlike a plain shiftUp Active Effect which always applies. Added
    // to shiftUp in dice.mjs#rollSkill only when system.isMorphed is true, the same way
    // movement/defenses already have their own separate .morphed field alongside .bonus
    // (templates/common.mjs's makeMovementFields, actor.mjs's _prepareDefenses).
    morphed: makeInt(0),
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

export function makeSkillFields(essence, canBeInitiative=false, init='d20', isChosen=false) {
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
    isChosen: makeBool(isChosen),
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

/* One per-turn action budget. `bonus` exists purely as an Active Effect target - "you gain an
   additional Standard action each turn" (GI Joe CRB p.81) is then a one-line AE change
   (system.actions.standard.bonus, ADD 1) rather than another bespoke helper file, the same way
   movement/defenses already split .base from .bonus.

   `base` is NOT stored: the rules derive it from the Speed Essence (GI Joe CRB p.192-193), so it's
   computed in documents/actor.mjs#_prepareActions along with `max`, which also applies the
   Condition clamps. Storing it would just let it drift out of sync with Speed. */
function makeActionBudget() {
  return new fields.SchemaField({
    base: makeInt(0),
    bonus: makeInt(0),
    max: makeInt(0),
  });
}

export const common = () => ({
  actors: new fields.ObjectField({}),
  /* Per-turn action budgets, on the shared common template so every actor type inherits them -
     playerCharacter, npc, companion, vehicle, zord, megaform. Only the BUDGET lives here; what an
     actor has actually spent this turn is a per-encounter ledger on the Combatant instead (see
     helpers/action-economy.mjs), so it can never go stale on the actor, and two unlinked tokens of
     the same actor get separate ledgers.

     There is no `reaction` budget, because Essence20 has no reactions. The readied-action
     mechanism is the Contingency action (GI Joe CRB p.196), which is a STANDARD action you set on
     your turn to resolve later - see E20.actionTypeCosts, where 'contingency' costs a Standard.
     Perks that change that (Vigilance p.110, Not Getting Away That Easy p.98 - "take a Contingency
     action as a Free action") are per-Perk overrides, not a separate resource.

     `enabled` is a per-actor opt-out for an actor the GM doesn't want tracked at all (a narrative
     NPC, a set-piece vehicle). `shared` is derived, not authored - see _prepareActions. */
  actions: new fields.SchemaField({
    enabled: makeBool(true),
    // Speed 1: "Move OR Standard action... then ends their turn" (CRB p.193). Spending either one
    // consumes the other, which getRemaining honours - see helpers/action-economy.mjs.
    shared: makeBool(false),
    free: makeActionBudget(),
    move: makeActionBudget(),
    standard: makeActionBudget(),
  }),
  color: new fields.ColorField({initial: '#b5b1b1'}),
  conditioning: makeInt(0),
  // Whether Conditioning shows on the sheet, ticked in the Skill Picker beside its value - the
  // same isChosen shape every skill there uses. On by default: unlike a skill, Conditioning always
  // carries a real value (3 on a Zord, per its baseline stat block), so there's something worth
  // showing from the moment the actor exists. PCs ignore this - pc-skills.hbs always shows theirs.
  showConditioning: makeBool(true),
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
    // _prepareHealth builds a "20 (Origin) + 0 (Role Points) + ..." breakdown here for the Health
    // readout's hover tooltip (sidebar-health.hbs), the same way makeDefensesFields declares one
    // for each defense. Without the field the DataModel drops that assignment before the template
    // sees it, which is why hovering Health showed an empty tooltip.
    string: makeStr(''),
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
    burrow: makeMovementFields(),
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
