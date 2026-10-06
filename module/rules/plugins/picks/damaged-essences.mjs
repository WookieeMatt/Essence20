// Rules-engine plug-ins, round 17 (split3 - docs/rules-batches/slSplit317.md): a damaged-Essence pick and a count of
// items by kind. Registered on import; see module/rules/plugins/index.mjs.
import { registerRef } from "../../formula.mjs";
import { registerPickSource } from "../../steps.mjs";

const ESSENCES = ['strength', 'speed', 'smarts', 'social'];
const localize = key => globalThis.game?.i18n?.localize?.(key) ?? key;
const listOf = collection => collection?.contents ?? (collection ? [...collection] : []);

/**
 * pick from: `damagedEssences {of?: target | self}` - the Essences the run's first target (default) or the actor has below
 * their maximum, in strength, speed, smarts, social order, labelled by their names. Follow it with
 * `healEssence {essence: "{choice.<key>}"}`. None damaged - the pick stops the run ("nothing to pick"). EMT Crash Course.
 */
export function damagedEssenceOptions(step, ctx) {
  const actor = step.of == 'self' ? ctx.actor : ctx.targets?.[0] ?? null;
  const essences = actor?.system?.essences ?? {};
  return ESSENCES.filter(key => essences[key] && Number(essences[key].value) < Number(essences[key].max))
    .map(key => ({ value: key, label: localize(globalThis.CONFIG?.E20?.essences?.[key] ?? key) }));
}

registerPickSource('damagedEssences', damagedEssenceOptions);

/**
 * Ref `@countSubtype.<item type>.<subtype>` - how many of the actor's items of that type have that `system.type`
 * (`@countSubtype.power.grid` - its Grid Powers). Personal Power Supply: no more Grid Powers than Personal Power.
 */
registerRef('countSubtype', (key, scope, parts) => {
  const [type, subtype] = parts;
  return listOf(scope.actor?.items).filter(item => item?.type == type && item.system?.type == subtype).length;
});
