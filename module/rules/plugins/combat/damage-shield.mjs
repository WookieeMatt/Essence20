import { formulaError, resolveValue } from "../../formula.mjs";
import { isExpired, isValidUntil, stampFor } from "../../expiry.mjs";
import { recipients, registerStep } from "../../steps.mjs";

/**
 * Round 15 (items2): a one-shot damage shield - step `damageShield {amount, damageTypes?, to?, until?}` puts a shield on
 * each recipient (flags.essence20.ruleDamageShields): the next hit of one of those damage types (any type with none
 * listed) that the recipient actually takes is lowered by `amount` (worked out when the step runs, per recipient), never
 * below 0, and the shield is used up. mechanics/combat/combat.mjs#applyDamage asks consumeDamageShield right after
 * Immunity (a hit already brought to 0 doesn't spend it), where the hand-written Elemental Shield reduction sat. A
 * newer shield from the same item replaces the older one; `until` (any duration) ends it unused. Elemental Shield.
 */

const FLAG = 'ruleDamageShields';

/** The actor's shields that are still up. */
export function damageShieldsOf(actor) {
  const list = actor?.flags?.essence20?.[FLAG];
  return (Array.isArray(list) ? list : []).filter(entry => entry && !isExpired(entry));
}

async function write(doc, update) {
  const { needsGmRelay, relayToGm } = await import("../../../mechanics/world/gm-relay.mjs");
  return needsGmRelay(doc) ? relayToGm(doc, 'update', [update]) : doc.update(update);
}

registerStep('damageShield', async (step, ctx) => {
  const types = Array.isArray(step.damageTypes) ? step.damageTypes.map(String) : [];
  for (const actor of recipients(step, ctx)) {
    const amount = Math.max(0, Math.round(resolveValue(step.amount ?? 1, { actor: ctx.actor, item: ctx.item, vars: ctx.vars, recipient: actor }, 1)));
    const entry = {
      id: globalThis.foundry?.utils?.randomID?.() ?? Math.random().toString(36).slice(2, 12),
      label: ctx.item?.name ?? '', source: ctx.item?.id ?? null, amount, damageTypes: types,
      until: step.until ?? null, stamp: step.until ? stampFor(step.until, undefined, ctx.actor) : null,
    };
    const kept = damageShieldsOf(actor).filter(old => !entry.source || old.source != entry.source);
    await write(actor, { [`flags.essence20.${FLAG}`]: [...kept, entry] });
  }
}, {
  errors: (step, where) => [
    ...(formulaError(step.amount) ? [`${where}.amount: ${formulaError(step.amount)}`] : []),
    ...(step.damageTypes !== undefined && !Array.isArray(step.damageTypes) ? [`${where}: damageTypes must be a list`] : []),
    ...(step.until !== undefined && !isValidUntil(step.until) ? [`${where}: unknown until`] : []),
  ],
});

/**
 * The damage after the actor's first matching shield, which is used up. Untouched (and no shield spent) for a hit of
 * 0 or a type no shield covers.
 * @returns {Promise<Number>}
 */
export async function consumeDamageShield(actor, damageType, amount) {
  if (!(amount > 0)) {
    return amount;
  }

  const shields = damageShieldsOf(actor);
  const shield = shields.find(entry => !entry.damageTypes?.length || entry.damageTypes.includes(damageType));
  if (!shield) {
    return amount;
  }

  await write(actor, { [`flags.essence20.${FLAG}`]: shields.filter(entry => entry !== shield) });
  return Math.max(0, amount - (Number(shield.amount) || 0));
}
