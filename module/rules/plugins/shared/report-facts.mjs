// Rules-engine plug-ins, round 17 (perm - docs/rules-batches/slPerm17.md). Registered on import; see
// module/rules/plugins/index.mjs. Plain Node safe.
import { registerStep, registerTextRef } from "../../steps.mjs";
import { itemsOf } from "../../../items/shared/item-lookups.mjs";

/**
 * Reports about a creature (Chrono-File Access):
 *
 * - Step `attackFacts {of?: target | self}` - the first target's (or the actor's) most damaging attack: of its weapon
 *   effects, the one with the biggest printed `system.damageValue` (the first on a tie). `{var.attackName}` (its name, or
 *   "none known" - E20.ChronoFileAccessNoAttacks) and `@var.attackDamage` (its damage value, 0 with none). No target: stops
 *   with a "needs a target" line.
 * - Text `{lang.<Key>}` - `E20.<Key>` localized, formatted with the run's vars plus `{name}` (the actor) and `{target}`
 *   (the first target): a whole localized report in a `chat` step ("{lang.ChronoFileAccessResult}").
 * - defenseFacts (rules/plugins/combat/defense-facts.mjs) also keeps `{var.highestDefenseName}` / `@var.highestDefenseValue`.
 */

function localize(key, data = null) {
  const i18n = globalThis.game?.i18n;
  const text = data ? i18n?.format?.(key, data) : i18n?.localize?.(key);
  return text ?? key;
}

registerStep('attackFacts', async (step, ctx) => {
  const actor = step.of == 'self' ? ctx.actor : ctx.targets?.[0];
  if (!actor) {
    ctx.chat.push(localize('E20.Rules.Step.NeedsTarget', { item: ctx.item?.name ?? '' }));
    return false;
  }

  const best = itemsOf(actor).filter(item => item.type == 'weaponEffect')
    .reduce((top, current) => (!top || (current.system?.damageValue ?? 0) > (top.system?.damageValue ?? 0) ? current : top), null);
  Object.assign(ctx.vars, {
    attackName: best?.name ?? localize('E20.ChronoFileAccessNoAttacks'),
    attackDamage: best?.system?.damageValue ?? 0,
  });
}, { errors: (step, where) => (step.of && !['self', 'target'].includes(step.of) ? [`${where}: attackFacts of must be self or target`] : []) });

registerTextRef('lang', (key, ctx) => {
  if (!/^[\w.]+$/.test(key)) {
    return undefined;
  }

  return localize(`E20.${key}`, { ...(ctx.vars ?? {}), name: ctx.actor?.name ?? '', target: ctx.targets?.[0]?.name ?? '' });
});
