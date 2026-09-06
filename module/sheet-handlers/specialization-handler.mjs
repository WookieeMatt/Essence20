import { checkIsLocked } from "../helpers/actor.mjs";
import { slugifySpecializationName, titleCaseSpecializationName } from "../helpers/utils.mjs";

/**
 * Adds a new Specialization to one of the actor's skills. The Skill Picker (module/apps/
 * skill-picker.mjs) is the only place a player adds one (see essence20-specialization-redesign)
 * - offering a dropdown of CONFIG.E20.standardSpecializations[version][skill] alongside a free-
 * text option, since every sourcebook is explicit that its own list is suggestions, not a fixed
 * catalog. Always written as player-bought (granted: false) - a Perk/Item automation that GRANTS
 * a specialization for free writes system.skills.<skill>.specializations directly instead of
 * going through this path, so it can set granted: true.
 * @param {Actor} actor The actor gaining the specialization.
 * @param {String} skill The skill (a key of CONFIG.E20.originSkills) to add it under.
 * @param {String} name The specialization's name - either one of the standard suggestions or a
 *   name the player typed themselves. Title-cased before saving either way (see
 *   titleCaseSpecializationName) so a free-typed "sniper rifle" reads the same as the catalog's
 *   own "Sniper Rifle" once it's on the sheet.
 * @returns {Promise|void}
 */
export async function addSpecialization(actor, skill, name) {
  if (checkIsLocked(actor)) {
    return;
  }

  const trimmedName = name?.trim();
  if (!trimmedName) {
    return;
  }

  // Title-cased so a custom, free-typed name (e.g. "sniper rifle") reads the same as the
  // standard-catalog picks next to it in the dropdown, which are already written this way - see
  // titleCaseSpecializationName. A standard pick passing back through this is a no-op, since it's
  // already in Title Case.
  const displayName = titleCaseSpecializationName(trimmedName);

  const skillData = actor.system.skills[skill];
  const existing = skillData.specializations || {};

  // Prevents the same Specialization being selected/added twice under one skill - a duplicate
  // name would otherwise still get its own distinct key (slugifySpecializationName's collision
  // suffix exists for two DIFFERENT names that happen to slugify the same, not for this), leaving
  // two entries that read identically on the sheet and double up the essence spend. Case/
  // whitespace-insensitive so "Medicine" and "medicine " are still caught as the same pick. The
  // Skill Picker's own dropdown (module/apps/skill-picker.mjs) already filters an already-added
  // standard name out before this is ever reached - this is what also catches the free-text path.
  const alreadyAdded = Object.values(existing)
    .some((specialization) => specialization.name?.trim().toLowerCase() === displayName.toLowerCase());
  if (alreadyAdded) {
    ui.notifications.warn(game.i18n.format('E20.SpecializationAlreadyAdded', { name: displayName }));
    return;
  }

  const key = slugifySpecializationName(displayName, existing);

  return actor.update({
    [`system.skills.${skill}.specializations.${key}`]: {
      name: displayName,
      shift: skillData.shift,
      isSpecialized: true,
      edge: false,
      shiftUp: 0,
      shiftDown: 0,
      snag: false,
      granted: false,
    },
  });
}

/**
 * Deletes one Specialization from a skill - the trash icon on essence-skills.hbs's
 * specialization row.
 * @param {Actor} actor The actor losing the specialization.
 * @param {String} skill The skill the specialization is under.
 * @param {String} key The specialization's key (see helpers/utils.mjs#slugifySpecializationName).
 * @returns {Promise|void}
 */
export async function deleteSpecialization(actor, skill, key) {
  if (checkIsLocked(actor)) {
    return;
  }

  // No "-=" prefix - that's the old (now-deprecated, logs a compatibility warning) deletion
  // syntax; ForcedDeletion as the value is what actually deletes a plain key now, same as item-
  // sheet.mjs's own _onObjectDelete for system.items.
  return actor.update({
    [`system.skills.${skill}.specializations.${key}`]: new foundry.data.operators.ForcedDeletion(),
  });
}

// A bought/normally-created Specialization always has every one of these fields (see
// addSpecialization above) - the defaults a Perk's granting Active Effect can skip setting.
const SPECIALIZATION_FIELD_DEFAULTS = {
  isSpecialized: true,
  edge: false,
  shiftUp: 0,
  shiftDown: 0,
  snag: false,
  granted: false,
};

/**
 * Fills in default values for any field a Specialization-granting Active Effect's OVERRIDE
 * changes didn't set. A Perk can grant a Specialization outright with an Active Effect whose
 * changes target system.skills.<skill>.specializations.<key>.<field> (see
 * essence20-specialization-redesign) - typically just .name and .granted (true), sometimes
 * .isSpecialized for an NPC-like actor. Because system.skills.<skill>.specializations is a plain
 * ObjectField (not a TypedObjectField with a real per-entry schema), a change like that creates
 * the new key by raw property assignment rather than through any schema initialization - so any
 * field the effect didn't explicitly set is simply undefined, not defaulted, unless this fills it
 * in. Called from Essence20Actor#prepareDerivedData, after Active Effects have already applied,
 * so both an effect-granted and a normally-bought Specialization end up the same fully-shaped
 * object by the time dice.mjs, essence-skills.hbs, and computeEssenceSpend read it.
 * @param {Actor} actor The actor whose Specializations to normalize.
 */
export function normalizeSpecializations(actor) {
  for (const skillData of Object.values(actor.system.skills || {})) {
    for (const specialization of Object.values(skillData.specializations || {})) {
      for (const [field, value] of Object.entries(SPECIALIZATION_FIELD_DEFAULTS)) {
        specialization[field] ??= value;
      }

      specialization.shift ??= skillData.shift;
    }
  }
}
