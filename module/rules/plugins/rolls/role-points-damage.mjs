import { contextFor, evaluate, registerTag } from "../../predicate.mjs";
import { rolePointsOf } from "../../steps.mjs";
import { RULE_TYPES } from "../../types.mjs";

/**
 * Round 15 (dice part): the damage Role Points box (Sneak Attack Damage, Power Strike, Hard Hitter - a `damageBonus`
 * Role Points item's "+N damage on this attack" in the Roll Options Dialog) as rules see it.
 *
 *  - `self:activeRolePoints:<item tags joined by &>` - the actor's base Role Points item, while it counts (active, or
 *    not activatable at all), meets the tags (`item:id:<16-char id>` - Sneak Attack Damage).
 *  - `roll:rolePointsDamage` - the box was ticked for this roll; `roll:rolePointsDamage:own` - ticked, and the Role Points
 *    item is the rule's own item (Hard Hitter's Edge). Read by late RollModifiers (the dialog's choices,
 *    rules/adapter.mjs#applyRuleImmunity hands them over as `dialog`); unknown before the dialog closes.
 *  - DialogSwitch `sneakAttackMultiplier: N` - ticked, when this roll's Sneak Attack Damage applies, the attack's whole
 *    damage bonus is multiplied by N (dice.mjs, where the hand-written Quiet as the Grave doubled it); the switch's
 *    label joins the damage-bonus sources. (options.ruleSneakAttackMultiplier from rules/adapter.mjs#applyRuleSwitches.)
 */

/** The actor's base Role Points item when it counts as active, else null. */
export function activeRolePoints(actor) {
  const points = actor ? rolePointsOf(actor) : null;
  return points && (points.system?.isActive || !points.system?.isActivatable) ? points : null;
}

registerTag('self:activeRolePoints', (rest, ctx) => {
  if (!ctx.self) {
    return null;
  }

  const points = activeRolePoints(ctx.self);
  const tags = String(rest ?? '').split('&').filter(Boolean);
  return !!points && (!tags.length || evaluate(tags, contextFor({ ...ctx, item: points })) === true);
}, { phrase: (arg, w) => (arg ? [`{poss} Role Points are active and ${w.items(arg.split('&'))}`, `{poss} Role Points aren't active or don't match`] : ['{poss} Role Points are active', "{poss} Role Points aren't active"]) });

registerTag('roll:rolePointsDamage', (rest, ctx) => {
  if (!ctx.dialog) {
    return null;
  }

  if (!ctx.dialog.applyRolePointsDamage) {
    return false;
  }

  return rest == 'own' ? !!ctx.ruleItem && rolePointsOf(ctx.self)?.id == ctx.ruleItem.id : true;
}, { phrase: arg => (arg == 'own' ? ["the roll spends this item's Role Points for damage", "the roll doesn't spend this item's Role Points for damage"] : ['the roll spends Role Points for damage', "the roll doesn't spend Role Points for damage"]) });

const SWITCH = RULE_TYPES.DialogSwitch;
SWITCH.params.sneakAttackMultiplier ??= { kind: 'formula' };
{
  const inner = SWITCH.validate;
  SWITCH.validate = rule => inner(rule).filter(error => !(rule.sneakAttackMultiplier && error == 'changes nothing'));
}
