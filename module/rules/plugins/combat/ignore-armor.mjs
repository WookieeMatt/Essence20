import { registerDefenseAdjust, registerDerived } from "../../../mechanics/item-hooks.mjs";
import { isExpired } from "../../expiry.mjs";
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { RULE_TYPES, registerRuleType } from "../../types.mjs";
import { T, itemsOf, num } from "../shared/hit-rider-lookups.mjs";

/**
 * Armor rules (round 10, group B).
 *
 * Defense `mode: "ignoreArmor"` (outgoing only): the attack ignores armor - the target's Defense loses its armor
 * share for this attack. `armor` says which share:
 *   - "defense" (default): the attacked Defense's own armor value (its Morphed value while Morphed); nothing when the
 *     target is already Armor Stripped (Flames of Hate);
 *   - "worn": Toughness' armor value plus every equipped armor's Toughness bonus (Comms Assault).
 * It's added beside the other per-attack Defense changes (mechanics/item-hooks.mjs registerDefenseAdjust), the same
 * plain subtraction the hand-written armor-ignoring code made.
 *
 * Armor shred: the `shredArmor` step (ext/b/steps.mjs) leaves a counted `armorShred` mark; while it lasts the
 * carrier's Toughness loses that much, never more than its armor share (Morphed Toughness while Morphed, else
 * Toughness' armor value plus equipped armor) - Anti-Armor's Critical Effect.
 */

const defense = RULE_TYPES.Defense;
registerRuleType('Defense', {
  ...defense,
  params: {
    ...defense.params,
    mode: { ...defense.params.mode, options: [...new Set([...defense.params.mode.options, 'ignoreArmor'])] },
    armor: { kind: 'enum', options: ['defense', 'worn'] },
  },
  validate: rule => [
    ...(defense.validate?.(rule) ?? []),
    ...(rule.mode == 'ignoreArmor' && !rule.outgoing ? ['ignoreArmor needs outgoing: true (it changes the target\'s Defense)'] : []),
    ...(rule.armor !== undefined && rule.mode != 'ignoreArmor' ? ['armor only goes with mode ignoreArmor'] : []),
  ],
});

/** Toughness' armor value plus the Toughness bonus of every equipped armor. */
export function wornArmor(actor) {
  const base = num(actor?.system?.defenses?.toughness?.armor);
  return base + itemsOf(actor).filter(item => item.type == 'armor' && item.system?.equipped)
    .reduce((sum, armor) => sum + (parseInt(armor.system?.totalBonusToughness) || 0), 0);
}

function armorShare(defender, defenseType, kind) {
  if (kind == 'worn') {
    return wornArmor(defender);
  }

  if (defender?.statuses?.has?.('armorStripped')) {
    return 0;
  }

  const value = defender?.system?.defenses?.[defenseType];
  return num(defender?.system?.isMorphed ? value?.morphed : value?.armor);
}

/** What the attacker's ignoreArmor rules take off the defender's Defense for this attack. */
export function ignoreArmorAdjust(attacker, defender, defenseType, ctx = {}) {
  let total = 0;
  for (const { rule, item } of rulesOfType(attacker, 'Defense')) {
    if (rule.mode != 'ignoreArmor' || !rule.outgoing || (rule.defense != 'any' && rule.defense != defenseType)) {
      continue;
    }

    const facts = { ...ctx, isAttack: ctx.isAttack ?? ctx.item?.type == 'weaponEffect', isMelee: ctx.isMelee ?? ctx.item?.system?.classification?.style == 'melee' };
    if (evaluate(rule.when, contextFor({ ...facts, defenseType, self: attacker, holder: attacker, ruleItem: item, other: defender })) !== true) {
      continue;
    }

    total -= armorShare(defender, defenseType, rule.armor ?? 'defense');
  }

  return total;
}

registerDefenseAdjust(ignoreArmorAdjust);

/** The armor a shred can take: Morphed Toughness while Morphed, else Toughness' armor value plus equipped armor. */
function shreddableArmor(actor) {
  const toughness = actor?.system?.defenses?.toughness;
  if (!toughness) {
    return 0;
  }

  return actor.system?.isMorphed ? num(toughness.morphed) : wornArmor(actor);
}

/** An armorShred mark's count on this actor (0 when it has run out). */
export function armorShredOf(actor) {
  const mark = actor?.flags?.essence20?.ruleMarks?.armorShred;
  return mark && !isExpired(mark) ? num(mark.count) : 0;
}

export function armorShredDerived(actor) {
  const toughness = actor?.system?.defenses?.toughness;
  const shred = armorShredOf(actor);
  if (!toughness || !shred) {
    return;
  }

  const cut = Math.min(shred, shreddableArmor(actor));
  if (cut > 0) {
    toughness.total = num(toughness.total) - cut;
    toughness.string = `${toughness.string ?? ''} - ${cut} (${T('ArmorShred')})`;
  }
}

registerDerived(armorShredDerived);
