// Book check, effects group (docs/rules-batches/book-effects.md): pieces the rulebook readings needed.
import { feetBetween, registerTag } from "../../predicate.mjs";
import { meleeReach } from "../tags/checks-and-refs.mjs";
import { recipients, registerStep, runSteps } from "../../steps.mjs";
import { resolveValue } from "../../formula.mjs";
import { registerEvent } from "../../types.mjs";
import { itemsOf, sourceOf } from "../../../items/shared/item-lookups.mjs";

/**
 * - Tag `rule:firstOnHost` - the rule's item is the first copy of its book item attached to its host (the weapon or
 *   vehicle it is on), in the host's item order. True for an item that isn't attached to anything. A weapon upgrade the
 *   book doesn't say may be taken more than once (GI JOE CRB p.150: only Compact says so) counts once per weapon:
 *   Deadly, Lingering, Chrono-Trigger.
 * - Tag `roll:noEdge` - the roll had no Edge (unknown: none). Menacing Glare.
 * - Tag `target:withinReach` - the other party is within this actor's melee Reach (off the canvas: yes). Growl.
 * - Step `unreducibleDamage {amount?, damageType?, to?}` - damage no Resistance, Immunity, damage reduction or damage
 *   shield lowers (mechanics/combat/combat.mjs#applyDamage's `unreducible`); the Defeat-save chain still runs. Better You
 *   Than Me's Void damage.
 * - Nanomite gear (gearPowerRules / gearHolding): the linked Power's lasting rules run as the gear's, and its powerUsed
 *   steps act on the gear - a gear-held Protection / Augmented Combat / Swiftness counts for its holder.
 * - Trigger event `defeatedByStun` - fired on an actor Defeated by Stun reaching its remaining Health (combat.mjs's Stun
 *   branch, a genuine new Defeat only); `watch` Triggers of other actors hear it (Not On My Watch).
 */

/** Whether `item` is the first item of its book entry on its host (by the actor's item order). */
export function firstOnHost(item) {
  const hostId = item?.flags?.essence20?.parentId;
  const source = sourceOf(item);
  if (!item || !hostId || !source) {
    return true;
  }

  const first = itemsOf(item.parent).find(other => other?.flags?.essence20?.parentId == hostId && sourceOf(other) == source);
  return !first || first === item || (!!first.id && first.id == item.id);
}

registerTag('rule:firstOnHost', (rest, ctx) => (ctx?.ruleItem ? firstOnHost(ctx.ruleItem) : null), { phrase: ['this is the first copy on its item', "this isn't the first copy on its item"] });

// roll:noEdge - the roll wasn't made with Edge (unknown counts as no Edge; roll:edge answers null then). Menacing Glare's
// plain Trigger beside its roll:edge one (Terror's Terror for an Edge roll that Frightens).
registerTag('roll:noEdge', (rest, ctx) => ctx?.edge !== true, { phrase: ['without an Edge', 'with an Edge'] });

// target:withinReach -the other party is no farther than this actor's melee Reach (@reach.melee); off the canvas counts
// as near enough (as target:notBeyond does). Growl's "a creature within reach".
registerTag('target:withinReach', (rest, ctx) => {
  if (!ctx?.other) {
    return false;
  }

  const feet = feetBetween(ctx.self, ctx.other);
  return feet === null || !Number.isFinite(feet) || feet <= meleeReach(ctx.self) + 0.5;
}, { phrase: ['{who} {is} within your reach', '{who} {isnt} within your reach'] });

const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function say(key, data) {
  const i18n = globalThis.game?.i18n;
  const full = `E20.Rules.Step.${key}`;
  const text = i18n?.format?.(full, data);
  return text && text != full ? text : `${key} ${JSON.stringify(data)}`;
}

registerStep('unreducibleDamage', async (step, ctx) => {
  const amount = Math.max(0, Math.round(resolveValue(step.amount ?? 1, { actor: ctx.actor, item: ctx.item, vars: ctx.vars, other: ctx.targets?.[0] ?? null }, 1)));
  const type = String(step.damageType ?? 'blunt') || 'blunt';
  const { applyDamage } = await import("../../../mechanics/combat/combat.mjs");
  for (const actor of recipients(step, ctx)) {
    if (actor.isOwner) {
      await applyDamage(actor, amount, type, false, { unreducible: true });
      ctx.chat.push(say('Damaged', { name: escape(actor.name), amount, type }));
    } else {
      // Someone else's character (book check follow-ups): a GM button that runs this same step, so the GM's Apply stays
      // unreducible (a plain damage line would be applied as a normal, reducible hit).
      const label = globalThis.game?.i18n?.format?.('E20.ReactApplyDamage', { amount, type, name: actor.name }) ?? `${amount} ${type}: ${actor.name}`;
      await runSteps([{ do: 'button', who: 'gm', label, intro: say('DamageForGm', { name: actor.name, amount, type }),
        steps: [{ do: 'unreducibleDamage', amount, damageType: type, to: 'target' }] }], { ...ctx, targets: [actor] });
    }
  }
});

/**
 * Nanomite equipment (QGtG p.92: the equipment grants the nanomite Power, used up after its uses): the linked Power's
 * lasting rules (everything but its powerUsed Triggers and FreeUse) run as the gear's own, so what using it switches on
 * (a toggle the Power's powerUsed steps set - on the gear, see power-used.mjs) counts for the holder. Called from
 * documents/item.mjs#prepareDerivedData.
 * @param {Item} gear
 * @param {Function} [lookup]   uuid => document or index entry.
 * @returns {Array<Object>}   The rules to add (none for anything but nanomite gear).
 */
export function gearPowerRules(gear, lookup = uuid => globalThis.fromUuidSync?.(uuid, { strict: false })) {
  const uuid = gear?.type == 'gear' ? gear.system?.nanomite?.powerUuid : null;
  if (!uuid) {
    return [];
  }

  let power = null;
  try {
    power = lookup(uuid);
  } catch (error) {
    power = null;
  }

  const rules = Array.isArray(power?.system?.rules) ? power.system.rules : [];
  return rules.filter(rule => rule && rule.type != 'FreeUse' && !(rule.type == 'Trigger' && rule.event == 'powerUsed'));
}

/** The holder's gear item that carries this (compendium) nanomite Power, or null. */
export function gearHolding(actor, power) {
  const uuid = power?.uuid;
  return uuid ? itemsOf(actor).find(item => item?.type == 'gear' && item.system?.nanomite?.powerUuid == uuid) ?? null : null;
}

registerEvent('defeatedByStun');

/**
 * Called by combat.mjs#applyDamage when a Stun hit newly Defeats `actor`.
 * @param {Actor} actor
 */
export async function defeatedByStun(actor) {
  if (!actor) {
    return;
  }

  const { fireTriggers } = await import("../../triggers.mjs");
  await fireTriggers(actor, 'defeatedByStun');
}
