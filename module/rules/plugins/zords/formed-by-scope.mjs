// Rules-engine plug-ins, round 17 (split1 - docs/rules-batches/slSplit117.md): the `formedBy` link scope.
// Registered on import; see module/rules/plugins/index.mjs. Plain Node safe.
import { registerLinkScope } from "../../links.mjs";
import { RULE_TYPES, SCOPES } from "../../types.mjs";

/**
 * Scope `formedBy`: a rule on a character's item reaches the Megaform that character formed - the one whose
 * flags.essence20.<flag> names the character's uuid. The flags read are FORMED_BY_FLAGS: zord2DefenderTorozord (Magna
 * Defender's Defender Torozord - items/zords/zord-feature-picks.mjs DT_FLAG). Ultimate Magna Defender: a scaled
 * DamageModifier with scope formedBy gives the Torozord's melee attacks its +1.
 */
export const FORMED_BY_FLAGS = ['zord2DefenderTorozord'];

function resolve(uuid) {
  try {
    return uuid ? globalThis.fromUuidSync?.(uuid) ?? null : null;
  } catch (error) {
    return null;
  }
}

/** The characters a Megaform was formed by (through FORMED_BY_FLAGS). */
export function formersOf(actor) {
  if (actor?.type != 'megaform') {
    return [];
  }

  return FORMED_BY_FLAGS.map(flag => resolve(actor.flags?.essence20?.[flag])).filter(Boolean);
}

registerLinkScope('formedBy', formersOf);
if (!SCOPES.includes('formedBy')) {
  SCOPES.push('formedBy');
}

// Every rule type a linked scope can carry today (those taking `vehicle`) takes this one too.
for (const definition of Object.values(RULE_TYPES)) {
  if (definition.scopes?.includes('vehicle') && !definition.scopes.includes('formedBy')) {
    definition.scopes.push('formedBy');
  }
}
