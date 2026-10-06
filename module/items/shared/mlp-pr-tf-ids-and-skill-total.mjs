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
  // My Little Pony CRB
  betrayal: `${C('mlp_crb')}fhne6x3suULZL040`,
  selfImprovement: `${C('mlp_crb')}COOAlcYNeoScFiAE`,
  // Power Rangers
  betterTogether: `${C('through_the_shattered_grid')}tOoyMHVtV6wjvlxd`,
  guardianBlast: `${C('through_the_shattered_grid')}GuardianBlast000`,
  megaDefender: `${C('through_the_shattered_grid')}rZjP9CN55D5qKW0s`,
  metallicArmor: `${C('through_the_shattered_grid')}LotTM0zOcCBLkki4`,
  // G.I. Joe
  // Transformers
  scrambleField: `${C('technorganic_secrets')}cIki3qTlr4gZed5f`,
  againAndAgain: `${C('enigma_of_combination')}EmL1IgnaX55NTMve`,
  perfectPlacement: `${C('enigma_of_combination')}wueeFv0eN8eh7RbS`,
  puissance: `${C('enigma_of_combination')}N8nkrj2hSrLv9NFP`,
  // Pop Out and Telltale Sign are their items' own rules (module/rules/ext/g/).
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
