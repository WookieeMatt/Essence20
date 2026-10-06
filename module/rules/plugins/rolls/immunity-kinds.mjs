import { rollRules } from "../../adapter.mjs";
import { RULE_TYPES } from "../../types.mjs";

/**
 * Round 15 (dice part): more RollModifier `immune` kinds, each lifting one of dice.mjs's automatic modifiers (read where
 * that modifier is added, through `ruleImmunities`):
 *
 *   reachDownshift        a ranged attack made inside the target's Reach takes no ↓1 (Menace with a shotgun / SMG, CQB
 *                         Training, Fighting Style: Close Quarters Battle)
 *   grappleSizeDownshift  a grapple against a bigger creature takes no Size ↓ (Jacket Wrestler)
 *   resistanceSnag        an attack against a target that resists its damage type takes no Snag (Maximize Flaws)
 *   longRangeSnagForEdge  in the long-range band: no Snag, and Edge instead when something else already ignores that
 *                         Snag (Nowhere to Run; plain `longRangeSnag` doesn't count it as "something else")
 *
 * Register another with `registerImmunityKind(name)`.
 */

export const IMMUNITY_KINDS = new Set();

export function registerImmunityKind(name) {
  IMMUNITY_KINDS.add(name);
}

for (const kind of ['reachDownshift', 'grappleSizeDownshift', 'resistanceSnag', 'longRangeSnagForEdge']) {
  registerImmunityKind(kind);
}

{
  const RM = RULE_TYPES.RollModifier;
  const inner = RM.validate;
  RM.validate = rule => {
    const kinds = Array.isArray(rule.immune) ? rule.immune : [];
    const ours = kinds.filter(kind => IMMUNITY_KINDS.has(kind));
    if (!ours.length) {
      return inner(rule);
    }

    const errors = inner({ ...rule, immune: kinds.filter(kind => !IMMUNITY_KINDS.has(kind)) });
    return errors.filter(error => error != 'changes nothing');
  };
}

/**
 * The roller's RollModifiers (their own, linked, incoming...) whose `when` holds and that lift this kind - [{rule, item,
 * owner}] (owner: the actor holding the rule's item; the first one's item names the source).
 * @param {Actor} actor
 * @param {Actor|null} target
 * @param {Object} roll   {item, rolledSkill, rolledEssence, isAttack, isMelee, dataset}
 * @param {String} kind
 */
export function ruleImmunities(actor, target, roll, kind) {
  if (!actor) {
    return [];
  }

  return rollRules(actor, target, roll).filter(({ rule, answer }) => answer === true && rule.type == 'RollModifier' && (rule.immune ?? []).includes(kind));
}
