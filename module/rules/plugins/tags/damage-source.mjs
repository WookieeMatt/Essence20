import * as react from "../../../mechanics/combat/reaction-engine.mjs";
import { registerTag } from "../../predicate.mjs";

/**
 * Damage-source tags (round 15, systems - docs/rules-batches/slSystems15.md), for DamageReduction / takesDamage rules:
 * what the attack card the GM is applying damage from says about the attack.
 * - damage:style:<style> - the attack's style (explosive, melee, projectile, ...) - the card's attackStyle.
 * - damage:elementOrEnergy - an Element / Energy hit: the damage type is acid, cold, electric, emp, fire, laser or sonic,
 *   or the attack carries one of those traits (or electromagnetic / element / energy). (The vehicle armors' old reading.)
 * Both are unknown (null) outside a damage check, and false when no card was applied to this actor.
 */

const ELEMENT_TYPES = ['acid', 'cold', 'electric', 'emp', 'fire', 'laser', 'sonic'];
const ELEMENT_TRAITS = ['acid', 'cold', 'electric', 'electromagnetic', 'fire', 'laser', 'sonic', 'element', 'energy'];

const inDamageCheck = ctx => ctx.damageAmount !== undefined || ctx.damageType !== undefined;

/** The flags of the attack card the GM last applied to this actor (no target recorded counts too). */
function appliedCard(actor) {
  const applied = react.lastApplyContext?.() ?? null;
  if (!applied || (applied.targetUuid && actor?.uuid && applied.targetUuid != actor.uuid)) {
    return null;
  }

  return globalThis.game?.messages?.get?.(applied.messageId)?.flags?.essence20 ?? null;
}

registerTag('damage:style', (rest, ctx) => (inDamageCheck(ctx) ? !!rest && String(appliedCard(ctx.self)?.attackStyle ?? '') == rest : null), { phrase: ['the damage came from an attack with the {arg} style', "the damage didn't come from an attack with the {arg} style"] });

registerTag('damage:elementOrEnergy', (rest, ctx) => {
  if (!inDamageCheck(ctx)) {
    return null;
  }

  const traits = appliedCard(ctx.self)?.attackTraits;
  return ELEMENT_TYPES.includes(ctx.damageType) || (Array.isArray(traits) ? traits : []).some(trait => ELEMENT_TRAITS.includes(trait));
}, { phrase: ['the damage is elemental or energy', "the damage isn't elemental or energy"] });
