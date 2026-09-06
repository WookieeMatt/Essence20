import { E20 } from "./config.mjs";

// Which per-skill schema fields (module/data/actor/templates/common.mjs#makeSkillFields) a
// toggleable effect's change can target - anything else on the actor (Health, a Defense,
// Movement, ...) isn't roll-scoped in a way that makes sense as a one-roll toggle here.
const SKILL_FIELDS = new Set([
  "edge", "snag", "shift", "shiftUp", "shiftDown", "modifier", "isSpecialized", "canCritD2",
]);

// Which fields on an Essence-wide shift (common.mjs#makeEssenceShift) apply to EVERY skill under
// that Essence (or, for "any", every skill at all) rather than one specific skill - e.g. a
// disabled "system.essenceShifts.speed.edge" effect would grant Edge on any Speed skill, Targeting
// included, if it were on. untrainedBonus is the one field with no direct skillRollOptions
// counterpart of its own - see applySkillEffectBonus's own handling of it below.
const ESSENCE_SHIFT_FIELDS = new Set(["edge", "snag", "shiftUp", "shiftDown", "untrainedBonus"]);

/**
 * Resolves an ActiveEffect change's key to the {scope, field} it targets, if any - `scope` is
 * "skill" for a change scoped to the exact skill being rolled, or "essence" for one scoped to
 * that skill's own Essence (or "any", which affects every skill) - or null if the key doesn't
 * target a roll-relevant field on either.
 * @param {String} key
 * @param {String} skillKey
 * @param {String} essence
 * @returns {{scope: String, field: String}|null}
 */
function parseChangeTarget(key, skillKey, essence) {
  if (typeof key !== "string") {
    return null;
  }

  const skillPrefix = `system.skills.${skillKey}.`;
  if (key.startsWith(skillPrefix)) {
    const field = key.slice(skillPrefix.length);
    return SKILL_FIELDS.has(field) ? { scope: "skill", field } : null;
  }

  for (const essenceKey of essence === "any" ? ["any"] : [essence, "any"]) {
    const essencePrefix = `system.essenceShifts.${essenceKey}.`;
    if (key.startsWith(essencePrefix)) {
      const field = key.slice(essencePrefix.length);
      return ESSENCE_SHIFT_FIELDS.has(field) ? { scope: "essence", field } : null;
    }
  }

  return null;
}

/**
 * Every currently-disabled effect on the actor (its own, or transferred from an owned Item like a
 * Perk - see Actor#allApplicableEffects) that would change something about the given skill, or
 * its Essence (which reaches every skill under that Essence, "any" reaching every skill at all -
 * see parseChangeTarget), if it were turned on. Surfaced in the Roll Options Dialog as an
 * optional, roll-scoped toggle (see applySkillEffectBonus below) - the same "off by default, opt
 * in for just this roll" shape Aiming already has, but sourced from real Active Effects instead
 * of a hardcoded bonus. A disabled effect otherwise never applies at all (Foundry's own default
 * behavior), so without this a player would have to go enable it permanently on the Effects tab,
 * make the roll, then remember to disable it again - this lets a situational bonus stay off by
 * default and still be reachable from the one place it actually matters.
 *
 * Only changes resolving to a roll-relevant field (see parseChangeTarget) are considered - an
 * effect that also changes something else (a different skill/Essence, Health, a Defense, ...)
 * still shows, but only its relevant changes are returned, so toggling it on here can't silently
 * also grant whatever else it does.
 * @param {Actor} actor
 * @param {String} skillKey
 * @param {String} essence   The Essence the skill being rolled belongs to (E20.originSkills'
 *   grouping) - "any" for a skill like Weird/Spellcasting that isn't tied to one Essence.
 * @returns {Array<{id: String, name: String, changes: Array<Object>}>}
 */
export function getToggleableSkillEffects(actor, skillKey, essence) {
  const effects = actor.allApplicableEffects ? [...actor.allApplicableEffects()] : (actor.effects ?? []);
  const results = [];
  for (const effect of effects) {
    if (!effect.disabled) {
      continue;
    }

    const changes = (effect.changes ?? [])
      .map(change => ({ ...change, ...parseChangeTarget(change.key, skillKey, essence) }))
      .filter(change => change.field);
    if (changes.length) {
      results.push({ id: effect.id, name: effect.name, changes });
    }
  }

  return results;
}

/**
 * Folds one toggled-on effect's changes into this one roll's skillRollOptions - computed via
 * Foundry's own ActiveEffect.applyChange (modifyTarget: false), so whatever mode the change
 * actually uses (OVERRIDE, ADD, ...) is honored correctly without reimplementing that logic here,
 * and nothing is written back to the actor or the effect's own disabled flag (see
 * getToggleableSkillEffects's own doc comment on why this is one-roll-only).
 *
 * Boolean fields (edge/snag/isSpecialized/canCritD2) are OR'd into whatever the dialog already
 * resolved - a manual toggle only ever adds a bonus here, never removes one the roller already
 * has from elsewhere. Edge and Snag together cancel out (p.169), same as when both apply
 * automatically. shift/shiftUp/shiftDown all fold into skillRollOptions.shiftUp as a net delta -
 * a `shift` change's absolute override has no separate field of its own on skillRollOptions (see
 * dice.mjs#_getFinalShift, which only ever reads shiftUp/shiftDown), so it's converted to the
 * equivalent number of shift steps from wherever this roll's own initialShift already sits.
 * modifier accumulates onto skillRollOptions.skillEffectModifierBonus, a new field dice.mjs adds
 * into the roll's flat modifier alongside the skill's own persisted one. untrainedBonus (Essence-
 * scoped only) mirrors dice.mjs#rollSkill's own "an untrained (d20) skill rolls d2 instead"
 * substitution - the same shift-index conversion as an absolute `shift` override, just only
 * meaningful when this roll's own initialShift is still the untrained d20.
 * @param {Actor} actor
 * @param {Array<Object>} changes   One effect's changes, already filtered to this skill/Essence by
 *   getToggleableSkillEffects().
 * @param {Object} skillRollOptions   Mutated in place - the object getSkillRollOptions() resolved.
 * @param {String} initialShift   The skill's own shift before this roll's dialog choices.
 */
export function applySkillEffectBonus(actor, changes, skillRollOptions, initialShift) {
  for (const change of changes) {
    // ActiveEffect.applyChange returns the field's fully-resolved NEW value, not a delta - for an
    // ADD-mode change that's current + delta (DataField#_applyChangeAdd, common/data/fields.mjs:
    // "return value + delta"), so it already has this skill's/Essence's current (pre-toggle)
    // value baked in. skillRollOptions' own shiftUp/shiftDown/modifier baseline was built from
    // that exact same current value earlier in dice.mjs#rollSkill - adding the resolved value on
    // top of that baseline double-counted it (fixed here by subtracting current back out first,
    // so only the toggle's own net contribution gets added, the same fix an OVERRIDE mode change
    // also needs since its "new value" is likewise not a delta).
    const currentValue = foundry.utils.getProperty(actor, change.key);
    const newValue = ActiveEffect.applyChange(actor, change, { modifyTarget: false })[change.key];

    if (change.field === "untrainedBonus") {
      if (initialShift === "d20" && newValue && !currentValue) {
        const currentIndex = E20.skillShiftList.indexOf("d20");
        const newIndex = E20.skillShiftList.indexOf("d2");
        skillRollOptions.shiftUp += currentIndex - newIndex;
      }

      continue;
    }

    switch (change.field) {
    case "edge":
    case "snag":
    case "isSpecialized":
    case "canCritD2":
      skillRollOptions[change.field] = skillRollOptions[change.field] || !!newValue;
      break;
    case "modifier":
      skillRollOptions.skillEffectModifierBonus =
        (skillRollOptions.skillEffectModifierBonus ?? 0) + (Number(newValue) - Number(currentValue));
      break;
    case "shiftUp":
      skillRollOptions.shiftUp += Number(newValue) - Number(currentValue);
      break;
    case "shiftDown":
      skillRollOptions.shiftDown += Number(newValue) - Number(currentValue);
      break;
    case "shift": {
      const currentIndex = E20.skillShiftList.indexOf(initialShift);
      const newIndex = E20.skillShiftList.indexOf(newValue);
      if (currentIndex >= 0 && newIndex >= 0) {
        skillRollOptions.shiftUp += currentIndex - newIndex;
      }

      break;
    }
    }
  }

  if (skillRollOptions.edge && skillRollOptions.snag) {
    skillRollOptions.edge = false;
    skillRollOptions.snag = false;
  }
}
