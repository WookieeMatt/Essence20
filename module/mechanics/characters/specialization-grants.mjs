/**
 * Specializations a rule step gives (rules/plugins/picks/pre-cast.mjs#grantSpecialization), and taking them back.
 *
 * - until "scene" (Bestow Expertise): listed in flags.essence20.bestowedExpertise; the scene-advance sweep
 *   (items/magic/bestow-expertise-scene-expiry.mjs) removes them.
 * - until "item": lasts while the granting item is on its actor. Listed in flags.essence20.grantedSpecializations as
 *   {skill, key, item: <the item's uuid>}; deleting that item (or a removeSpecialization step) takes it back. Two items
 *   giving the same one share it - it goes when the last of them does.
 *
 * Either way a Skill that already has a Specialization of that name gets no second copy. One the character has of their
 * own is never taken back: it isn't listed, so nothing removes it.
 *
 * Pure: plain Node (specialization-grants.test.js).
 */

export const ITEM_GRANTS_FLAG = 'grantedSpecializations';
export const SCENE_GRANTS_FLAG = 'bestowedExpertise';

const lower = text => String(text ?? '').trim().toLowerCase();

/** The key of the Skill's Specialization with this name (any case), or null. */
export function existingSpecialization(specializations, name) {
  const wanted = lower(name);
  if (!wanted) {
    return null;
  }

  return Object.entries(specializations ?? {}).find(([, spec]) => spec && lower(spec.name) == wanted)?.[0] ?? null;
}

/**
 * The actor update that grants a Specialization, or null when there is nothing to do.
 * @param {Object} params
 * @param {Object} params.fields   The Skill's own fields (system.skills.<skill>): shift, specializations.
 * @param {Object} [params.flags]   The recipient's flags.essence20.
 * @param {String} params.skill
 * @param {String} params.name   The display name (already title-cased).
 * @param {'scene'|'item'} [params.until]
 * @param {?String} [params.source]   The granting item's uuid (until "item").
 * @param {Function} params.slug   (name, specializations) => a free key for a new one.
 * @returns {?Object}
 */
export function grantSpecializationUpdate({ fields, flags = {}, skill, name, until = 'scene', source = null, slug }) {
  const specializations = fields?.specializations ?? {};
  const scene = Array.isArray(flags[SCENE_GRANTS_FLAG]) ? flags[SCENE_GRANTS_FLAG] : [];
  const items = Array.isArray(flags[ITEM_GRANTS_FLAG]) ? flags[ITEM_GRANTS_FLAG] : [];
  const existing = existingSpecialization(specializations, name);
  const sameSpec = key => entry => entry?.skill == skill && entry.key == key;

  if (until == 'item') {
    if (!source) {
      return null;
    }

    if (existing) {
      const fromScene = scene.some(sameSpec(existing));
      // The character's own: nothing to add, and nothing this item should ever take away.
      if (!fromScene && !items.some(sameSpec(existing))) {
        return null;
      }

      if (items.some(entry => sameSpec(existing)(entry) && entry.item == source)) {
        return null;
      }

      // Another grant's: this item shares it. A scene grant's becomes this item's, so the scene's end leaves it.
      return {
        [`flags.essence20.${ITEM_GRANTS_FLAG}`]: [...items, { skill, key: existing, item: source }],
        ...(fromScene ? { [`flags.essence20.${SCENE_GRANTS_FLAG}`]: scene.filter(entry => !sameSpec(existing)(entry)) } : {}),
      };
    }

    const key = slug(name, specializations);
    return {
      [`flags.essence20.${ITEM_GRANTS_FLAG}`]: [...items, { skill, key, item: source }],
      [`system.skills.${skill}.specializations.${key}`]: newSpecialization(name, fields),
    };
  }

  if (existing) {
    return null;
  }

  const key = slug(name, specializations);
  return {
    [`flags.essence20.${SCENE_GRANTS_FLAG}`]: [...scene, { skill, key }],
    [`system.skills.${skill}.specializations.${key}`]: newSpecialization(name, fields),
  };
}

function newSpecialization(name, fields) {
  return { name, shift: fields?.shift, isSpecialized: true, edge: false, shiftUp: 0, shiftDown: 0, snag: false, granted: true };
}

/**
 * The actor update that takes back what one item granted (all of it, or only `skill` / `key`), or null when it granted
 * nothing here. A Specialization another item still gives stays.
 * @param {Object} flags   The actor's flags.essence20.
 * @param {String} source   The item's uuid.
 * @param {Object} [options]
 * @param {?String} [options.skill]
 * @param {?String} [options.key]
 * @param {*} [options.deletion]   What removes a key in an update (foundry.data.operators.ForcedDeletion in Foundry).
 * @returns {?Object}
 */
export function releaseSpecializationsUpdate(flags, source, { skill = null, key = null, deletion = null } = {}) {
  const items = Array.isArray(flags?.[ITEM_GRANTS_FLAG]) ? flags[ITEM_GRANTS_FLAG] : [];
  const released = entry => entry?.item == source && (!skill || entry.skill == skill) && (!key || entry.key == key);
  const going = items.filter(released);
  if (!source || !going.length) {
    return null;
  }

  const kept = items.filter(entry => !released(entry));
  const update = { [`flags.essence20.${ITEM_GRANTS_FLAG}`]: kept };
  for (const entry of going) {
    if (!kept.some(other => other.skill == entry.skill && other.key == entry.key)) {
      update[`system.skills.${entry.skill}.specializations.${entry.key}`] = deletion;
    }
  }

  return update;
}
