import { rulesOfType } from "../../index.mjs";
import { linkedEntries } from "../../links.mjs";
import { contextFor, evaluate, registerTag } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Round 15 (dice part): immunity to Critical hits, per target (dice.mjs#_applyImmovableObjectImmunity clears a hit
 * row's Critical options when its target is immune).
 *
 *   CritImmune                 the holder can't be critically hit (Immovable Object); scope `aura` + radius for the
 *                              actors around the holder (Protector's Shield: everyone within 10 ft, `affects: all`,
 *                              when [holder:protects, holder:check:personalShield]). `when` sees self = the target,
 *                              holder = whoever holds the rule, other = the attacker, the roll's item.
 *   holder:check:<name>        a registered check (CHECK_NAMES) asked of the holder rather than self.
 */

registerRuleType('CritImmune', {
  params: {},
  scopes: ['self', 'aura'],
});

registerTag('holder:check', (rest, ctx) => {
  const holder = ctx.holder ?? ctx.self;
  return holder ? evaluate([`check:${rest}`], { ...ctx, self: holder }) : null;
});

/**
 * Whether `target` is immune to Critical hits from this attack under its own or a nearby holder's CritImmune rules.
 * @param {Actor} target
 * @param {?Actor} attacker
 * @param {Object} [roll]   {item, rolledSkill...}
 */
export function ruleCritImmune(target, attacker = null, roll = {}) {
  if (!target) {
    return false;
  }

  const entries = [...rulesOfType(target, 'CritImmune', 'self').map(entry => ({ ...entry, holder: target })), ...linkedEntries(target, 'CritImmune')];
  const isAttack = roll.item?.type == 'weaponEffect';
  const facts = { isAttack, isMelee: isAttack && roll.item.system?.classification?.style == 'melee', ...roll };
  return entries.some(({ rule, item, holder }) => evaluate(rule.when, contextFor({ ...facts, self: target, holder, ruleItem: item, other: attacker })) === true);
}
