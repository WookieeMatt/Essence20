import { registerDerived } from "../../../mechanics/item-hooks.mjs";
import { resolveValue } from "../../formula.mjs";
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";
import { listOf } from "../shared/chat-speaker-helpers.mjs";

/**
 * The HardpointUse rule type (round 10, group D - docs/rules-batches/slD10.md), worked into the actor's hardpoints as
 * derived data.
 */

// HardpointUse {items: [item tags asked of each equipped weapon], slots}: those weapons take `slots` hardpoints (in
// their hardpoint type) instead of one per hand.
registerRuleType('HardpointUse', {
  params: { items: { kind: 'object', required: true }, slots: { kind: 'formula', required: true } },
  scopes: ['self'],
  validate: rule => (Array.isArray(rule.items) ? [] : ['items must be a list of item tags']),
});

export function hardpointUseDerived(actor) {
  const system = actor?.system;
  const entries = rulesOfType(actor, 'HardpointUse');
  if (!entries.length || !system?.hardpoints) {
    return;
  }

  for (const weapon of listOf(actor.items)) {
    if (weapon.type != 'weapon' || !weapon.system?.equipped) {
      continue;
    }

    const entry = entries.find(({ rule, item }) => evaluate(rule.items, contextFor({ self: actor, ruleItem: item, item: weapon })) === true);
    if (!entry) {
      continue;
    }

    const slot = system.hardpoints[weapon.system.hardpoint?.type ?? 'external'];
    const hands = Math.max(1, Number(weapon.system.derivedHands ?? weapon.system.hands ?? 1) || 1);
    const slots = Math.max(0, Math.round(resolveValue(entry.rule.slots, { actor, item: entry.item }, 1)));
    const extra = hands - slots;
    if (slot && extra > 0) {
      slot.used = Math.max(0, (Number(slot.used) || 0) - extra);
      slot.over = slot.used > (Number(slot.max) || 0);
    }
  }
}

registerDerived(hardpointUseDerived);
