// Rules-engine plug-in, round 15 (banked - docs/rules-batches/slBanked15.md). Registered on import; see
// module/rules/plugins/index.mjs.
import { registerPickSource } from "../../steps.mjs";

const localize = key => globalThis.game?.i18n?.localize?.(key) ?? key;

/**
 * pick from: conditions {of?: self | target, exclude?: [status ids], all?: true} - one of the Conditions the actor (of: target -
 * the run's first target) has on now, by status id; then `removeCondition {condition: "{choice.<key>}"}` takes it off.
 *   - by default the system's Conditions (CONFIG.E20.statusEffects, in that order, labelled by their names) the actor has -
 *     Eltarian Mettle's, Balance and Harmony's and Inspiring Words' pickers;
 *   - `all: true` - every status the actor has, listed or not (Talk Them Up's picker), labelled by its Condition name when
 *     it has one.
 * With nothing to pick the step stops the run ("nothing to pick").
 */
export function conditionOptions(step, ctx) {
  const actor = step.of == 'target' ? ctx.targets?.[0] ?? null : ctx.actor;
  const statuses = actor?.statuses;
  if (!statuses) {
    return [];
  }

  const exclude = new Set(Array.isArray(step.exclude) ? step.exclude : []);
  const listed = Array.isArray(globalThis.CONFIG?.E20?.statusEffects) ? globalThis.CONFIG.E20.statusEffects : [];
  if (step.all) {
    return [...statuses].filter(status => !exclude.has(status))
      .map(status => ({ value: status, label: localize(listed.find(entry => entry.id == status)?.name ?? status) }));
  }

  return listed.filter(entry => !exclude.has(entry.id) && statuses.has?.(entry.id)).map(entry => ({ value: entry.id, label: localize(entry.name) }));
}

registerPickSource('conditions', conditionOptions);
