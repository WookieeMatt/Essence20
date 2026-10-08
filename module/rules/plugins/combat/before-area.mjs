import { resolveValue } from "../../formula.mjs";
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Rule type `BeforeArea {options?, dataset?, exclude?}` (round 15, uses) - asked as an attack with an area (or several
 * targets) is rolled, before / right after its template is placed (documents/item.mjs):
 *   - `options` - choices offered in one dialog before the template goes down, beside "as normal":
 *       `bigger` / `smaller` (the radius 5 ft more / less; smaller only above 5 ft), `shape` (each other shape - circle,
 *       cone, line) - only for an attack with an area (system.shape); `single` (one target instead: the first targeted
 *       token; the template isn't placed) - for an area or Multiple Targets attack. Concentrated Explosion / Fire.
 *   - `dataset` - with `single` picked: that dataset key is set on the roll (Concentrated Fire's `concentratedFire`, read
 *     by the d2 Critical, the fire-immunity Snag and the fire-immunity damage option in target-riders.mjs).
 *   - `exclude` - after the template catches tokens: roll this many (a formula, or `skillDie` - the attack Skill's own
 *     die, d2 ... 3d6; nothing when it isn't a die) and let the attacker untick up to that many of the caught tokens,
 *     the rest re-targeted. Shaped Charges.
 * `when` sees the rolled attack (item:, weapon:, attack:...). Several rules' options share one dialog.
 */

const OPTIONS = ['bigger', 'smaller', 'shape', 'single'];
const AREA_SHAPES = ['circle', 'cone', 'line'];

registerRuleType('BeforeArea', {
  params: { options: { kind: 'strings' }, dataset: { kind: 'string' }, exclude: { kind: 'string' } },
  scopes: ['self'],
  validate: rule => [
    ...(rule.options ?? []).filter(option => !OPTIONS.includes(option)).map(option => `unknown option "${option}" (${OPTIONS.join(', ')})`),
    ...(!(rule.options ?? []).length && !rule.exclude ? ['needs options or exclude'] : []),
  ],
});

const localize = (key, data) => (data ? globalThis.game?.i18n?.format?.(key, data) : globalThis.game?.i18n?.localize?.(key)) ?? key;

function holding(actor, effect, filter) {
  const facts = { item: effect, isAttack: effect?.type == 'weaponEffect', isMelee: effect?.system?.classification?.style == 'melee' };
  return rulesOfType(actor, 'BeforeArea').filter(({ rule, item }) => filter(rule)
    && evaluate(rule.when, contextFor({ ...facts, self: actor, ruleItem: item })) === true);
}

/**
 * The pre-template choice: null when no rule offers one (or the dialog was closed); else
 * {radiusDeltaFeet, shape, single, dataset}.
 */
export async function ruleBeforeArea(actor, effect) {
  const hasArea = !!effect?.system?.shape;
  const multiple = hasArea || (effect?.system?.numTargets ?? 1) > 1;
  const offers = holding(actor, effect, rule => (rule.options ?? []).length > 0).map(entry => ({
    ...entry,
    options: entry.rule.options.filter(option => (option == 'single' ? multiple : hasArea)),
  })).filter(entry => entry.options.length);
  if (!offers.length) {
    return null;
  }

  const has = option => offers.some(entry => entry.options.includes(option));
  const buttons = [{ action: 'normal', label: localize('E20.ConcentratedNormal'), default: true }];
  if (has('bigger')) {
    buttons.push({ action: 'bigger', label: localize('E20.ConcentratedBigger') });
  }

  if (has('smaller') && (effect.system.radius ?? 0) > 5) {
    buttons.push({ action: 'smaller', label: localize('E20.ConcentratedSmaller') });
  }

  if (has('shape')) {
    for (const shape of AREA_SHAPES.filter(one => one != effect.system.shape)) {
      buttons.push({ action: `shape-${shape}`, label: localize('E20.ConcentratedShape', { shape: localize(globalThis.CONFIG?.E20?.aoeShapes?.[shape] ?? shape) }) });
    }
  }

  const single = offers.find(entry => entry.options.includes('single'));
  if (single) {
    buttons.push({ action: 'single', label: localize('E20.ConcentratedSingle') });
  }

  // The title: the item offering the area changes, else the single-target one.
  const titled = offers.find(entry => entry.options.some(option => option != 'single')) ?? offers[0];
  const choice = await globalThis.foundry.applications.api.DialogV2.wait({
    window: { title: titled.item?.name ?? '' },
    classes: ["window-app", "e20-window"],
    content: `<p>${localize('E20.ConcentratedPrompt')}</p>`,
    buttons,
    rejectClose: false,
  });
  if (!choice) {
    return null;
  }

  return {
    radiusDeltaFeet: choice == 'bigger' ? 5 : choice == 'smaller' ? -5 : 0,
    shape: choice.startsWith('shape-') ? choice.slice(6) : null,
    single: choice == 'single',
    dataset: choice == 'single' && single.rule.dataset ? { [single.rule.dataset]: true } : {},
  };
}

/** How many caught tokens a rule's `exclude` lets go: the attack Skill's die rolled, or a formula. */
async function excludeCount(actor, effect, rule, item) {
  if (rule.exclude == 'skillDie') {
    const shift = actor?.system?.skills?.[effect?.system?.classification?.skill]?.shift;
    if (!shift || !/^\d*d\d+$/.test(shift)) {
      return 0;
    }

    const roll = await new globalThis.Roll(shift).evaluate();
    return Number(roll.total) || 0;
  }

  return Math.max(0, Math.round(Number(resolveValue(rule.exclude, { actor, item }, 0)) || 0));
}

/** After the template caught `tokens`: the ones left once each `exclude` rule's untick dialog is answered. */
export async function ruleAreaExclusions(actor, effect, tokens) {
  let remaining = tokens;
  for (const { rule, item } of holding(actor, effect, one => !!one.exclude)) {
    if (!remaining.length) {
      break;
    }

    const count = await excludeCount(actor, effect, rule, item);
    if (count <= 0) {
      continue;
    }

    const checkboxes = remaining.map(token => `<div class="form-group"><label><input type="checkbox" name="${token.id}"> ${token.name}</label></div>`).join('');
    const current = remaining;
    const chosen = await globalThis.foundry.applications.api.DialogV2.wait({
      window: { title: localize('E20.ShapedChargesPickTitle') },
      classes: ["window-app", "e20-window"],
      content: `<p>${localize('E20.ShapedChargesPickLabel', { count })}</p>${checkboxes}`,
      modal: true,
      buttons: [
        { label: localize('E20.DialogConfirmButton'), action: 'confirm', callback: (event, button) => current.filter(token => button.form.elements[token.id]?.checked).map(token => token.id) },
        { label: localize('E20.DialogCancelButton'), action: 'cancel', callback: () => [] },
      ],
    });
    const excluded = new Set(Array.isArray(chosen) ? chosen : []);
    if (excluded.size) {
      remaining = remaining.filter(token => !excluded.has(token.id));
      globalThis.canvas?.tokens?.setTargets?.(remaining.map(token => token.id));
    }
  }

  return remaining;
}
