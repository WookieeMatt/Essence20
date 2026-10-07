// Perk choice P1 (docs/PERK_CHOICE_MIGRATION_PLAN.md §2.2): option sources shared by the pick step and ChoiceSet.
import { registerPickSource } from "../../steps.mjs";

/**
 * Pick sources (`from:`) for a `pick` / `pickEach` step and a ChoiceSet rule (which offers exactly the pick step's lists -
 * rules/lifecycle.mjs#choiceOptions):
 *
 *  - `config {table: "<CONFIG.E20 key>"}` - a config table's keys, which are the exact strings the old Perk picker stored in
 *    system.choice: fightingStyle, airBornMovement, alwaysReadyOptions, powerAdaptationOptions, elementDamageTypes... An
 *    entry keyed "any" is left out. A list table (fieldSkills) offers its entries, labelled from `labels` (another table,
 *    "skills") when given.
 *  - `sense` (CONFIG.E20.senses), `environment` (CONFIG.E20.environments), `movement` (CONFIG.E20.movementTypes), `element`
 *    (CONFIG.E20.elementDamageTypes - an Element's damage types). `damageType` is a core source.
 *
 * What the actor already has: `notHeld: true` leaves it out, `held: true` offers only that. Held means an acute sense, a
 * known environment (system.environments), a movement with a base speed above 0 (the old Fast picker offered only those:
 * `held: true`). Both are skipped when the caller wants every option (ctx.allOptions - the Rules tab's label lookup, so a
 * pick the actor now holds still shows its name).
 */

const localize = key => globalThis.game?.i18n?.localize?.(key) ?? key;
const E20 = () => globalThis.CONFIG?.E20 ?? {};

/** A table's options: an object's keys (labels its values), or a list's entries (labelled from `labels`). */
export function tableOptions(table, labels = null) {
  if (Array.isArray(table)) {
    return table.map(value => ({ value: String(value), label: localize(labels?.[value] ?? String(value)) }));
  }

  return Object.entries(table ?? {}).filter(([value]) => value != 'any').map(([value, label]) => ({
    value,
    label: localize(typeof label == 'string' ? label : label?.label ?? label?.name ?? value),
  }));
}

/** Whether the actor already has this value of a source. */
const HELD = {
  sense: (actor, value) => !!actor?.system?.senses?.[value]?.acute,
  environment: (actor, value) => [actor?.system?.environments ?? []].flat().includes(value),
  movement: (actor, value) => (Number(actor?.system?.movement?.[value]?.base) || 0) > 0,
};

/** A source's options narrowed by notHeld / held (not when every option is wanted). */
function heldFilter(name, options, step, ctx) {
  const held = HELD[name];
  if (!held || ctx?.allOptions || !(step.notHeld || step.held) || !ctx?.actor) {
    return options;
  }

  return options.filter(option => (step.held ? held(ctx.actor, option.value) : !held(ctx.actor, option.value)));
}

registerPickSource('config', step => {
  const table = E20()[String(step.table ?? '')];
  const labels = step.labels ? E20()[String(step.labels)] : null;
  return table ? tableOptions(table, labels) : [];
});

registerPickSource('sense', (step, ctx) => heldFilter('sense', tableOptions(E20().senses), step, ctx));
registerPickSource('environment', (step, ctx) => heldFilter('environment', tableOptions(E20().environments), step, ctx));
registerPickSource('movement', (step, ctx) => heldFilter('movement', tableOptions(E20().movementTypes), step, ctx));
registerPickSource('element', () => tableOptions(E20().elementDamageTypes));
