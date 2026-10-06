import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate, interpolate, registerTag } from "../../predicate.mjs";
import { itemsFor, registerStep, registerTextRef } from "../../steps.mjs";
import { registerRuleType } from "../../types.mjs";
import { write } from "../shared/chat-speaker-helpers.mjs";
import { sourceOf } from "../../../items/shared/item-lookups.mjs";

/**
 * Small pieces for the grant-style Use buttons (round 15, uses):
 *
 *   - Step `refreshMorphedToughness {}` - the Morphed Toughness bonus worked out again from the armors the actor is
 *     trained in (sheet-handlers/perk-handler.mjs#setMorphedToughnessBonus), after an updateActor that changed them.
 *   - Step `itemEffects {item, all?, disabled: true|false}` - switch the Active Effects of the items an item selector
 *     finds on and off (another item's - setEffects only reaches the rule's own).
 *   - Tags `item:heldBySelf` - the item asked about (a compendium entry) is already on the actor, by its book source;
 *     `item:entryOfOwned:<type>` - its book source is one of the entries (system.items) of an item of that type the actor
 *     holds (a Perk of the actor's Faction).
 *   - Text placeholder `{sourced.<16-char id>.<path>[|<default>]}` - a stored value on the actor's copy of that book
 *     item (the default when there's no copy or no value) - for chat, updateItem / updateActor text, names.
 *   - Rule type `EssenceRedirect {from, to, roleName?}` - a Role's Essence increase in `from` ({choice.<key>} reads a
 *     pick) goes to `to` instead, when the Role's name contains `roleName` (any Role without it); `when` sees the actor.
 *     Read by mechanics/resources/grants.mjs#essenceRedirect for sheet-handlers/role-handler.mjs#setRoleValues.
 */

const listOf = collection => collection?.contents ?? (collection ? [...collection] : []);

registerStep('refreshMorphedToughness', async (step, ctx) => {
  const { setMorphedToughnessBonus } = await import("../../../sheet-handlers/perk-handler.mjs");
  await setMorphedToughnessBonus(ctx.actor);
});

registerStep('itemEffects', async (step, ctx) => {
  const disabled = step.disabled !== false;
  for (const item of itemsFor(step, ctx.actor, ctx)) {
    const effects = listOf(item.effects);
    if (effects.length) {
      await write(item, 'updateEmbeddedDocuments', ['ActiveEffect', effects.map(effect => ({ _id: effect.id, disabled }))]);
    }
  }
}, { errors: (step, where) => (step.item ? [] : [`${where}: itemEffects needs an item selector`]) });

registerTag('item:heldBySelf', (rest, ctx) => {
  if (!ctx.item || !ctx.self) {
    return false;
  }

  const uuid = ctx.item.uuid ?? null;
  const source = sourceOf(ctx.item) ?? uuid;
  return listOf(ctx.self.items).some(item => item !== ctx.item && (sourceOf(item) == source || (uuid && sourceOf(item) == uuid)));
}, { phrase: ['you already have {who}', "you don't have {who} yet"] });

registerTag('item:entryOfOwned', (rest, ctx) => {
  const source = sourceOf(ctx.item) ?? ctx.item?.uuid;
  if (!source || !ctx.self) {
    return false;
  }

  return listOf(ctx.self.items).filter(item => item.type == rest)
    .some(holder => Object.values(holder.system?.items ?? {}).some(entry => entry?.uuid && entry.uuid == source));
}, { phrase: ['{who} {is} listed on one of your {arg} items', '{who} {isnt} listed on any of your {arg} items'] });

registerTextRef('sourced', (rest, ctx) => {
  const match = /^([A-Za-z0-9]{16})\.([^|]+)(?:\|(.*))?$/.exec(rest);
  if (!match) {
    return undefined;
  }

  const copy = listOf(ctx.actor?.items).find(item => String(sourceOf(item) ?? '').endsWith(`.${match[1]}`));
  const value = copy ? match[2].split('.').reduce((at, key) => (at === null || at === undefined ? at : at[key]), copy) : undefined;
  return value === undefined || value === null ? match[3] ?? '' : value;
});

registerRuleType('EssenceRedirect', {
  params: { from: { kind: 'string', required: true }, to: { kind: 'string', required: true }, roleName: { kind: 'string' } },
  scopes: ['self'],
});

/**
 * Where a Role's increase to `essence` goes: the first EssenceRedirect rule (item order) that applies, else the essence.
 * @returns {String|null}   The redirected Essence, or null when no rule applies.
 */
export function ruleEssenceRedirect(actor, role, essence) {
  for (const { rule, item } of rulesOfType(actor, 'EssenceRedirect')) {
    const from = interpolate(String(rule.from ?? ''), item);
    if (!from || from != essence || (rule.roleName && !String(role?.name ?? '').toLowerCase().includes(String(rule.roleName).toLowerCase()))) {
      continue;
    }

    if (evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) === true) {
      return rule.to;
    }
  }

  return null;
}

