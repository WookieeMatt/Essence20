import { registerDefenseAdjust } from "../../../mechanics/item-hooks.mjs";
import { ruleId, rulesOfType } from "../../index.mjs";
import { contextFor, evaluate, registerTag } from "../../predicate.mjs";
import { registerRuleType, RULE_TYPES } from "../../types.mjs";
import { marksOf, resolve } from "../shared/hit-rider-lookups.mjs";

/**
 * Armor Upgrades in rules (round 15, uses):
 *   - Tags `self:hasArmorUpgrade:<defense>` / `target:hasArmorUpgrade:<defense>` - an Armor Upgrade on the actor's worn armor
 *     (or a loose one, for an actor that can transform) adds to that Defense.
 *   - DialogSwitch `ignoreArmorUpgrades: true` with `spend: {max: N}` - the number chosen is how many of the target's Armor
 *     Upgrades the attack ignores on the attacked Defense, the biggest first (Pinpoint).
 *   - Rule type `ArmorUpgradePenalty {mark, amount}` - a creature carrying the holder's mark `<mark>` has its Armor Upgrades'
 *     bonus lowered by `amount` (never below +0): on Toughness when it has a Toughness upgrade, else on Evasion - against any
 *     roll (Make an Opening). A creature carrying several such marks takes the biggest.
 * Both are per-roll Defense changes (registerDefenseAdjust), beside the hand-written ones in target-riders.mjs#riderDefenseAdjust.
 */

const listOf = collection => collection?.contents ?? (collection ? [...collection] : []);

/** The Defense each of the actor's Armor Upgrades adds to one Defense (worn armor's, or loose ones on a transformer). */
export function armorUpgradeBonuses(actor, defenseType) {
  const items = listOf(actor?.items);
  const equipped = new Set(items.filter(item => item.type == 'armor' && item.system?.equipped).map(item => item.id));
  return items.filter(item => item.type == 'upgrade' && item.system?.type == 'armor' && item.system?.armorBonus?.defense == defenseType
    && (equipped.has(item.flags?.essence20?.parentId) || (!item.flags?.essence20?.parentId && actor.system?.canTransform)))
    .map(item => Number(item.system.armorBonus.value) || 0)
    .filter(value => value > 0);
}

registerTag('self:hasArmorUpgrade', (rest, ctx) => armorUpgradeBonuses(ctx.self, rest).length > 0);
registerTag('target:hasArmorUpgrade', (rest, ctx) => (ctx.other ? armorUpgradeBonuses(ctx.other, rest).length > 0 : false));

if (RULE_TYPES.DialogSwitch) {
  RULE_TYPES.DialogSwitch.params.ignoreArmorUpgrades ??= { kind: 'bool' };
}

registerRuleType('ArmorUpgradePenalty', {
  params: { mark: { kind: 'string', required: true }, amount: { kind: 'number', required: true } },
  scopes: ['self'],
});

/** The per-roll change: Pinpoint's ignored upgrades (the attacker's switch) and Make an Opening's penalty (a mark). */
export function armorUpgradeAdjust(attacker, defender, defenseType, ctx = {}) {
  if (!defender || !['toughness', 'evasion', 'willpower', 'cleverness'].includes(defenseType)) {
    return 0;
  }

  let adjust = 0;
  // Pinpoint: how many the dialog's number box said (its value lives in the dialog's ext fields, by the switch's name).
  if (attacker && ctx.isAttack) {
    for (const { rule, item, index } of rulesOfType(attacker, 'DialogSwitch')) {
      const count = rule.ignoreArmorUpgrades ? Math.max(0, Math.round(Number(ctx.ext?.[ruleId(item, index)]) || 0)) : 0;
      if (count > 0) {
        adjust -= armorUpgradeBonuses(defender, defenseType).sort((a, b) => b - a).slice(0, count).reduce((a, b) => a + b, 0);
      }
    }
  }

  // Make an Opening: the penalty a mark on the defender carries.
  let penalty = 0;
  for (const { key, mark } of marksOf(defender)) {
    const setter = resolve(mark?.by);
    for (const { rule, item } of setter ? rulesOfType(setter, 'ArmorUpgradePenalty') : []) {
      if (rule.mark == key && evaluate(rule.when, contextFor({ self: setter, ruleItem: item, other: defender })) === true) {
        penalty = Math.max(penalty, Number(rule.amount) || 0);
      }
    }
  }

  if (penalty > 0) {
    const defense = armorUpgradeBonuses(defender, 'toughness').length ? 'toughness' : 'evasion';
    if (defense == defenseType) {
      adjust -= Math.min(penalty, armorUpgradeBonuses(defender, defenseType).reduce((a, b) => a + b, 0));
    }
  }

  return adjust;
}

registerDefenseAdjust(armorUpgradeAdjust);
