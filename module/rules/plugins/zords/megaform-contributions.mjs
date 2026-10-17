import { resolveValue } from "../../formula.mjs";
import { rulesOf, rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Round 16 (part a): what a participant brings to the Megaform it is part of - rules on the participant's own items,
 * read where documents/actor.mjs works the Megaform out (_prepareMegaformZordData / _prepareMegaformCombinerData) and
 * where dice.mjs offers the Energon ↑1. `when` is asked of the participant (self:).
 *
 *   MegaformArmor {toughness?, evasion?, form?: megazord | combiner, replacesTrait?}
 *       adds to the Megaform's ARMOR part of that Defense (defenses.<d>.armor - what armor-ignoring attacks take
 *       away), beside the Megaform Traits' own Defender / Core Defenses bonuses. `form`: only in a Megazord (Zords) or
 *       a Combiner form; both when left out. `replacesTrait: true` on a Megaform Trait: the trait's own type
 *       (coreDefenses...) adds nothing by itself - the rule says what it adds (Armored Defense: its value to Toughness,
 *       none to Evasion). Formulas read the rule's item (@item.system.value). Hardened Chassis: +1 Toughness, megazord.
 *   MegaformHold {}
 *       a Combiner form the holder is merged with doesn't fall apart while the holder has Health above 0 (the
 *       majority-Defeated rule is set aside - Keep IT Together!).
 *   MegaformSpecializations {}
 *       the holder's Skill Specializations are also the Combiner form's, merged into the Skills it takes from whichever
 *       component has the best Essence (Better As One).
 *   EnergonDonor {}
 *       when a Combiner form the holder is part of rolls, the holder may pay the Roll Options Dialog's "1 Energon for
 *       ↑1" from its own Energon when the form has none (Better As One) - the first such component with Energon left.
 */

const FORMS = ['megazord', 'combiner'];

registerRuleType('MegaformArmor', {
  params: { toughness: { kind: 'formula' }, evasion: { kind: 'formula' }, form: { kind: 'enum', options: FORMS }, replacesTrait: { kind: 'bool' } },
  scopes: ['self'],
  validate: rule => (rule.toughness === undefined && rule.evasion === undefined && !rule.replacesTrait ? ['changes nothing'] : []),
});
registerRuleType('MegaformHold', { params: {}, scopes: ['self'] });
registerRuleType('MegaformSpecializations', { params: {}, scopes: ['self'] });
registerRuleType('EnergonDonor', { params: {}, scopes: ['self'] });

const holds = (rule, actor, item) => evaluate(rule.when, contextFor({ self: actor, holder: actor, ruleItem: item })) === true;

/**
 * The armor a participant adds to its Megaform's Defenses.
 * @param {Actor} participant
 * @param {String} form   megazord | combiner
 * @returns {{toughness: Number, evasion: Number}}
 */
export function megaformArmorOf(participant, form) {
  const out = { toughness: 0, evasion: 0 };
  for (const { rule, item } of participant ? rulesOfType(participant, 'MegaformArmor', 'self') : []) {
    if ((rule.form && rule.form != form) || !holds(rule, participant, item)) {
      continue;
    }

    for (const defense of ['toughness', 'evasion']) {
      if (rule[defense] !== undefined) {
        out[defense] += Math.round(resolveValue(rule[defense], { actor: participant, item }, 0));
      }
    }
  }

  return out;
}

/** Whether a Megaform Trait's own type adds nothing by itself (a MegaformArmor rule with replacesTrait says what it adds). */
export function traitReplaced(item) {
  return rulesOf(item).some(rule => rule?.type == 'MegaformArmor' && rule.replacesTrait && !rule.disabled);
}

const anyRule = (actor, type) => !!actor && rulesOfType(actor, type, 'self').some(({ rule, item }) => holds(rule, actor, item));

/** Whether this component keeps its Combiner form together (MegaformHold). */
export const holdsMegaformTogether = component => anyRule(component, 'MegaformHold');

/** Whether this component's Specializations are also the Combiner form's (MegaformSpecializations). */
export const sharesSpecializations = component => anyRule(component, 'MegaformSpecializations');

/**
 * The component that pays the dialog's Energon ↑1 for a rolling Combiner form, if any (EnergonDonor).
 * @param {Actor} actor   The rolling Megaform.
 * @returns {Actor|null}
 */
export function energonDonor(actor) {
  if (actor?.type != 'megaform') {
    return null;
  }

  for (const entry of Object.values(actor.system?.actors ?? {})) {
    let component = null;
    try {
      component = globalThis.fromUuidSync?.(entry?.uuid) ?? null;
    } catch (error) {
      component = null;
    }

    if (component && anyRule(component, 'EnergonDonor') && (Number(component.system?.energon?.normal?.value) || 0) > 0) {
      return component;
    }
  }

  return null;
}

/** Take the point from the donor. */
export async function payEnergonDonor(donor) {
  const value = Math.max(0, (Number(donor.system?.energon?.normal?.value) || 0) - 1);
  await donor.update({ 'system.energon.normal.value': value });
}
