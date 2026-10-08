import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Rule type `AttackChoice {title?, prompt?, none?, options: [{label, shiftUp?, damage?, armorPiercing?, radiusMultiplier?}]}`
 * (round 15, items1) - one pick asked as an attack is rolled, before its area template is placed (documents/item.mjs), so
 * a bigger radius reaches the template: `shiftUp` ↑ on the attack, `damage` + damage, `armorPiercing` the attack
 * ignores armor against Toughness, `radiusMultiplier` its blast radius times that. `when` sees the rolled attack (item:,
 * attack: tags). `none` (an E20 key or text) is the "no effect" choice, which - like closing the dialog - leaves the
 * attack as it is. Labels are E20 keys or text. Bring It All Down.
 */

const EFFECTS = ['shiftUp', 'damage', 'armorPiercing', 'radiusMultiplier'];

registerRuleType('AttackChoice', {
  params: { title: { kind: 'string' }, prompt: { kind: 'string' }, none: { kind: 'string' }, options: { kind: 'object' } },
  scopes: ['self'],
  validate: rule => {
    if (!Array.isArray(rule.options) || !rule.options.length) {
      return ['needs options'];
    }

    return rule.options.flatMap((option, at) => [
      ...(option?.label ? [] : [`options[${at}] needs a label`]),
      ...(EFFECTS.some(key => option?.[key] !== undefined) ? [] : [`options[${at}] changes nothing (${EFFECTS.join(', ')})`]),
    ]);
  },
});

const text = key => {
  const value = String(key ?? '');
  return value.startsWith('E20.') ? globalThis.game?.i18n?.localize?.(value) ?? value : value;
};

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** No pick: the attack as it is. */
export const NO_CHOICE = { shiftUp: 0, damage: 0, armorPiercing: false, radiusMultiplier: 1 };

/**
 * The attack's pick, asked when an AttackChoice rule applies to it: {shiftUp, damage, armorPiercing, radiusMultiplier}
 * (NO_CHOICE when none applies, or "none" / a closed dialog).
 * @param {Actor} actor   The roller.
 * @param {Item} effect   The weaponEffect rolled.
 */
export async function ruleAttackChoice(actor, effect) {
  const facts = { item: effect, isAttack: effect?.type == 'weaponEffect', isMelee: effect?.system?.classification?.style == 'melee' };
  const offers = rulesOfType(actor, 'AttackChoice').filter(({ rule, item }) => Array.isArray(rule.options)
    && evaluate(rule.when, contextFor({ ...facts, self: actor, ruleItem: item })) === true);
  if (!offers.length) {
    return { ...NO_CHOICE };
  }

  const options = offers.flatMap(({ rule }) => rule.options);
  const [{ rule: first, item }] = offers;
  const chosen = await globalThis.foundry.applications.api.DialogV2.wait({
    window: { title: text(first.title) || item?.name || '' },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${escape(text(first.prompt))}</label><select name="effect">
      <option value="none">${escape(text(first.none ?? 'E20.None'))}</option>
      ${options.map((option, at) => `<option value="${at}">${escape(text(option.label))}</option>`).join('')}
    </select></div>`,
    modal: true,
    buttons: [
      { label: text('E20.DialogConfirmButton'), action: 'confirm', callback: (event, button) => button.form.elements.effect.value },
      { label: text('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });
  const option = chosen && chosen != 'cancel' && chosen != 'none' ? options[Number(chosen)] : null;
  if (!option) {
    return { ...NO_CHOICE };
  }

  return {
    shiftUp: Number(option.shiftUp) || 0,
    damage: Number(option.damage) || 0,
    armorPiercing: !!option.armorPiercing,
    radiusMultiplier: Number(option.radiusMultiplier) || 1,
  };
}
