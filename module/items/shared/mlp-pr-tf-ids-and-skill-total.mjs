/**
 * Shared bits for the "other3" extension slice (Item Review 2026-09-28): the compendium uuids this
 * slice keys on, the parent-weapon reader and a Skill Test that reports its total. Imports nothing
 * heavy (mechanics/item-hooks.mjs's import-cycle note) - dice/target-riders/combat are always pulled
 * in lazily by the callers. The generic lookups, lang, chat, side, stamp and relayed-write helpers
 * live in item-lookups.mjs, item-lang.mjs, chat-lines.mjs, sides.mjs, turn-stamps.mjs and
 * relayed-writes.mjs.
 */
import { itemsOf } from "./item-lookups.mjs";

const C = pack => `Compendium.essence20.${pack}.Item.`;

export const O3 = {
  // My Little Pony CRB (Betrayal is its Hang-Up's own rules - round 17, perm)
  // Power Rangers
  megaDefender: `${C('through_the_shattered_grid')}rZjP9CN55D5qKW0s`,
  // G.I. Joe
  // Transformers
  // Again and Again and Again is its Perk's own rules (round 14). Pop Out and Telltale Sign are their items' own rules (module/rules/ext/g/).
};

/** The weapon a weaponEffect belongs to, if any. */
export function parentWeaponOf(actor, effect) {
  const id = effect?.flags?.essence20?.parentId;
  const parent = id ? (actor?.items?.get?.(id) ?? itemsOf(actor).find(item => item.id == id)) : null;
  return parent?.type == 'weapon' ? parent : null;
}

/**
 * Roll a Skill Test the ordinary way and hand back its total (and success, when a DIF is given).
 * @returns {Promise<{total: Number|null, success: Boolean, crit: Boolean}|null>}
 */
export async function rollSkillTotal(actor, skill, { dif = null, extra = {} } = {}) {
  const essence = CONFIG.E20?.skillToEssence?.[skill] ?? 'smarts';
  const fields = actor?.system?.skills?.[skill] ?? {};
  const result = await actor?._dice?.rollSkill({
    rollType: 'skill', skill, essence: essence == 'any' ? 'smarts' : essence, shift: fields.shift,
    shiftUp: fields.shiftUp ?? 0, shiftDown: fields.shiftDown ?? 0, isSpecialized: fields.isSpecialized,
    ...(dif != null ? { dif: String(dif) } : {}), ...extra,
  }, actor);
  if (!result) {
    return null;
  }

  const outcome = result.outcomes?.[0];
  const total = outcome?.roll?.total ?? outcome?.total ?? null;
  const first = outcome?.results?.[0];
  return { total, success: !!result.success, crit: !!first && first.multiplier >= 2 };
}
