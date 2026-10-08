import { registerCostRuleProvider } from "../../../mechanics/item-hooks.mjs";
import { epochFor } from "../../../mechanics/resources/scene-clock.mjs";
import { costRuleFor, registerActionKind } from "../../actions.mjs";
import { registerUntil } from "../../expiry.mjs";
import { ACTION_KEYS, RULE_TYPES } from "../../types.mjs";
import { carriedRules } from "../marks/rule-marks.mjs";

/**
 * ActionCost extras (round 15, systems - docs/rules-batches/slSystems15.md):
 *
 *   action: "any"        every action that costs something - with `ask`, the player says whether this one is the kind
 *                        the item means ("an action related to <Spirit>", "related to your Cutie Mark")
 *   to: "downgrade"      one step cheaper: Standard -> Move, Move -> Free, Free -> no action at all
 *   limit.freeIsUnlimited  a Free action made free doesn't count against the limit (the Talents: once a round,
 *                        Free actions tied to the Spirit cost nothing)
 *   scope: "marked" + mark  the rule acts for whoever carries the holder's mark <key> (rules/plugins/marks/rule-marks.mjs),
 *                        not for the holder - Harmony Unleashed on the pony it targets. On the caster itself (a mark
 *                        it set on itself), a self rule with `self:markedByHolder:<key>` does it.
 *
 * Cost kinds `personalShield` (the sheet's Personal Shield switch), `rouse` (a Use whose cost.kind is rouse),
 * `analyzeTarget` (dice.mjs's Analyze Target) and `vehicleRepair` (vessel-conditions.mjs's Repair) - the contexts those
 * spends already pass - may be an ActionCost's `action` (Quick Shield, Rousing Presence, Quick / Swift Study, Quick Fix).
 *
 * Duration `roundsThrough:<n>` (n = 1..10): through the end of the round n - 1 rounds after this one - "for 3 rounds"
 * counted as this round and the next two (action-perks.mjs's untilRound = round + 2). Needs a combat (set up or
 * started); with none, the scene.
 */

for (const kind of ['personalShield', 'rouse', 'analyzeTarget', 'vehicleRepair']) {
  registerActionKind(kind);
}

if (!ACTION_KEYS.includes('any')) {
  ACTION_KEYS.push('any');
}

{
  const definition = RULE_TYPES.ActionCost;
  if (!definition.params.to.options.includes('downgrade')) {
    definition.params.to.options.push('downgrade');
  }

  if (!definition.scopes.includes('marked')) {
    definition.scopes.push('marked');
  }

  definition.params.mark ??= { kind: 'string' };
  const inner = definition.validate;
  definition.validate = rule => [
    ...(inner?.(rule) ?? []),
    ...(rule.scope == 'marked' && !rule.mark ? ['scope marked needs mark (the mark\'s key)'] : []),
    ...(rule.limit?.freeIsUnlimited !== undefined && typeof rule.limit.freeIsUnlimited != 'boolean' ? ['limit.freeIsUnlimited must be true or false'] : []),
  ];
}

// The marked creature's own cost options: the ActionCost rules its marks carry.
registerCostRuleProvider(actor => carriedRules(actor, 'ActionCost').map(entry => costRuleFor(actor, entry)));

for (let n = 1; n <= 10; n++) {
  registerUntil(`roundsThrough:${n}`, {
    stamp: combat => (combat ? { combatId: combat.id, round: Number(combat.round) || 0, rounds: n } : { epoch: epochFor('scene') }),
    expired: (stamp, combat) => {
      if (stamp.epoch !== undefined) {
        return stamp.epoch != epochFor('scene');
      }

      return !combat || combat.id != stamp.combatId || (Number(combat.round) || 0) > stamp.round + stamp.rounds - 1;
    },
  });
}
