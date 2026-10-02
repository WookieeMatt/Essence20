/**
 * Code rules' helpers (docs/RULES_ENGINE_PLAN.md §4.19). A `{type: "Code", helper: "name"}` rule runs
 * the helper registered under that name - from this system, a module, or a world script - so a GM
 * can automate anything the rule types can't express yet, and still author the item in the system.
 *
 * There is deliberately no allow-list: any registered helper can be named by any item.
 *
 * A helper is an object of optional hook functions. Each receives the hook's own arguments followed
 * by `{rule, item}` - the Code rule (with any settings the item gave it) and the item carrying it:
 *   rollSources(actor, target, ctx, ref)        => {sources: [{id, label, shiftUp, shiftDown, edge, snag}]}
 *   derived(actor, ref)                          - mutate actor.system, like a DerivedStat
 *   defenseAdjust(attacker, defender, type, ctx, ref) => Number added to the defender's Defense
 *   damageTaken(actor, amount, damageType, ref) => new amount
 *   hitRider(actor, target, result, rider, tools, ref)
 *
 *   game.essence20.registerRuleHelper('myTable.bonusVsDragons', {
 *     rollSources: (actor, target, ctx, { item }) => ({
 *       sources: target?.name?.includes('Dragon') ? [{ id: 'dragons', label: item.name, shiftUp: 1 }] : [],
 *     }),
 *   });
 */

const HELPERS = new Map();

export function registerRuleHelper(name, hooks) {
  if (!name || typeof name != 'string' || !hooks || typeof hooks != 'object') {
    throw new Error('registerRuleHelper(name, hooks): a name and an object of hook functions');
  }

  HELPERS.set(name, hooks);
}

export function ruleHelper(name) {
  return HELPERS.get(name) ?? null;
}

export function ruleHelperNames() {
  return [...HELPERS.keys()].sort();
}
