import { isExpired } from "../../expiry.mjs";
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate, registerTag } from "../../predicate.mjs";
import { registerRecipient } from "../../steps.mjs";
import { RULE_TYPES } from "../../types.mjs";

/**
 * Round 16 (part a): marking a creature so that attacks against it ignore its armor - Exploit Weakness.
 *
 *   Defense {mode: noArmor, outgoing: true, scope: markedTarget, mark: <key>, defense?, when?}
 *       on the setter's item: an attack against a creature carrying the setter's <key> mark meets the creature's Defense
 *       worked out again without its armor (getDefenseValue ignoreArmor), at the point in dice.mjs where Exploit
 *       Weakness's recompute was - right after the attacker's own noArmor rules. `when` is asked with self = the attacker,
 *       holder = the setter, target = the marked creature (`self:sameSideAsHolder` - the setter and their teammates).
 *       It never applies to the setter's own attacks through its own noArmor reading (no-armor-defense.mjs leaves
 *       markedTarget rules out). A setter that is gone (deleted) or a mark that ran out counts for nothing.
 *   Tag `card:flag:<key>` - a CardOffer's card carries that flag (flags.essence20.<key> set, not false / empty):
 *       card:flag:isMelee, card:flag:targetUuid.
 *   Recipient `cardTarget` - in a CardOffer's steps, the creature the card names as its target (flags.essence20.targetUuid).
 */

const DEFENSE = RULE_TYPES.Defense;
if (!DEFENSE.scopes.includes('markedTarget')) {
  DEFENSE.scopes.push('markedTarget');
}

DEFENSE.params.mark ??= { kind: 'string' };

const lookup = uuid => {
  try {
    return uuid ? globalThis.fromUuidSync?.(uuid, { strict: false }) ?? null : null;
  } catch (error) {
    return null;
  }
};

/**
 * Whether an attack by `attacker` on `defender` ignores the defender's armor through a mark the defender carries.
 * @param {Actor} attacker
 * @param {Actor} defender
 * @param {String} defenseType   The Defense the attack is compared against.
 * @param {Object} [ctx]   {item, rolledSkill, rolledEssence, switches}
 * @returns {Boolean}
 */
export function ruleMarkedNoArmor(attacker, defender, defenseType, ctx = {}) {
  const marks = defender?.flags?.essence20?.ruleMarks ?? {};
  if (!attacker || !Object.keys(marks).length) {
    return false;
  }

  const isAttack = ctx.item?.type == 'weaponEffect';
  const facts = { ...ctx, isAttack, isMelee: isAttack && ctx.item?.system?.classification?.style == 'melee', defenseType };
  for (const [name, mark] of Object.entries(marks)) {
    if (!mark?.by || isExpired(mark)) {
      continue;
    }

    const setter = lookup(mark.by);
    if (!setter) {
      continue;
    }

    const key = name.split('--')[0];
    const applies = rulesOfType(setter, 'Defense', 'markedTarget').some(({ rule, item }) => rule.mode == 'noArmor' && rule.mark == key
      && (!rule.defense || rule.defense == 'any' || rule.defense == defenseType)
      && evaluate(rule.when, contextFor({ ...facts, self: attacker, holder: setter, ruleItem: item, other: defender })) === true);
    if (applies) {
      return true;
    }
  }

  return false;
}

registerTag('card:flag', (rest, ctx) => {
  const message = ctx.card;
  if (!message || !rest) {
    return message ? false : null;
  }

  const value = message.flags?.essence20?.[rest];
  return value !== undefined && value !== null && value !== false && value !== '';
});

registerRecipient('cardTarget', (match, ctx) => {
  const target = lookup(ctx.offerMessage?.flags?.essence20?.targetUuid);
  return target ? [target] : [];
});
