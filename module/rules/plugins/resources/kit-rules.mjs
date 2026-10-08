import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate, registerTag } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Kit and carrying rules read by mechanics/resources/kits.mjs (round 15, uses) - kept light so kits.mjs can import it:
 *   - `CarryExemption {items: [item tags], max}` - up to `max` hands of carried items matching the tags don't count against
 *     the carrying limit (kits.mjs#extraCarriedHands). Bomber, Medicine Cabinet.
 *   - `KitModifier {scroungeDif?, upgradeRoll?, keepRoll?, respecialize?}` - the scrounge DIF changes by `scroungeDif`
 *     (the biggest change counts, never below 0 - kits.mjs#scroungeDif); using up a Standard / Limited kit first rolls to
 *     treat it one tier better (upgradeRoll - Handy Scrounger); after using one up, a roll to keep it (keepRoll -
 *     Stretching Resources); changing a set kit's Specialization (respecialize - Kitted Out). `when` sees the actor.
 *   - Tag `item:firstAttack:<tags joined by &>` - the weapon's first attack meets them (Bomber's "an explosive").
 */

const listOf = collection => collection?.contents ?? (collection ? [...collection] : []);

registerTag('item:firstAttack', (rest, ctx) => {
  const weapon = ctx.item;
  const owner = weapon?.parent ?? ctx.self;
  const first = listOf(owner?.items).find(item => item.type == 'weaponEffect' && item.flags?.essence20?.parentId == weapon?.id);
  return !!first && evaluate(String(rest).split('&'), contextFor({ self: ctx.self, ruleItem: ctx.ruleItem, item: first })) === true;
}, { phrase: (arg, w) => [`its first attack is one where ${w.items(arg.split('&'))}`, `its first attack isn't one where ${w.items(arg.split('&'))}`] });

registerRuleType('CarryExemption', {
  params: { items: { kind: 'strings', required: true }, max: { kind: 'number' } },
  scopes: ['self'],
});

/** Hands of carried items the actor's CarryExemption rules free: [{item, hands}] in, a number out. */
export function ruleCarryExemption(actor, carried) {
  let freed = 0;
  for (const { rule, item } of rulesOfType(actor, 'CarryExemption')) {
    if (evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) !== true) {
      continue;
    }

    const hands = carried.filter(c => evaluate(rule.items ?? [], contextFor({ self: actor, ruleItem: item, item: c.item })) === true)
      .reduce((sum, c) => sum + c.hands * Math.max(1, c.item.system?.quantity ?? 1), 0);
    freed += Math.min(Number(rule.max ?? Infinity), hands);
  }

  return freed;
}

registerRuleType('KitModifier', {
  params: { scroungeDif: { kind: 'number' }, upgradeRoll: { kind: 'bool' }, keepRoll: { kind: 'bool' }, respecialize: { kind: 'bool' } },
  scopes: ['self'],
  validate: rule => (['scroungeDif', 'upgradeRoll', 'keepRoll', 'respecialize'].some(key => rule[key]) ? [] : ['changes nothing']),
});

function liveKitModifiers(actor) {
  return rulesOfType(actor, 'KitModifier').filter(({ rule, item }) => evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) === true);
}

/** The biggest scrounge-DIF change the actor's KitModifier rules make (0 with none). */
export function ruleScroungeOffset(actor) {
  return Math.min(0, ...liveKitModifiers(actor).map(({ rule }) => Number(rule.scroungeDif) || 0));
}

/** Whether a KitModifier rule gives this kit roll / right: 'upgradeRoll' | 'keepRoll' | 'respecialize'. */
export function ruleKitModifier(actor, key) {
  return liveKitModifiers(actor).some(({ rule }) => !!rule[key]);
}
