/**
 * The `essence20.preRollOptions` hook: called just before the Roll Options Dialog opens for a Skill roll, an attack or an
 * Initiative roll, so a module (a house rule - rules/house-rules.mjs) can still change it. Listeners get:
 *
 *   { actor, item, skill, isInitiative, dataset, skillDataset, sources, addSource }
 *
 * - `dataset.shiftUp` / `dataset.shiftDown`: the roll's ↑ / ↓ so far (numbers).
 * - `skillDataset.edge` / `skillDataset.snag`: whether it has an Edge / a Snag so far. Several sources of either still
 *   make one, as the books say; an Edge and a Snag cancel.
 * - `sources`: the automatic modifiers listed in the dialog ({id, label, shiftUp, shiftDown, edge, snag}).
 * - `addSource({id?, label, shiftUp?, shiftDown?, edge?, snag?})`: adds a modifier AND lists it, the way an item rule's
 *   would be - the player can switch its ↑ / ↓ off for the roll in the dialog. Use it rather than changing the numbers
 *   yourself, unless the change shouldn't be listed or switchable.
 *
 * The hook is called with Hooks.callAll (no listener can stop the roll); listeners must be synchronous.
 */

export const PRE_ROLL_HOOK = 'essence20.preRollOptions';

let nextId = 1;

/**
 * Build the payload and call the hook.
 * @param {Object} roll   {actor, item, skill, isInitiative, dataset, skillDataset}; dataset.combatModifierSources is
 *                        the dialog's source list (made if missing).
 * @param {Object} [hooks]   Foundry's Hooks (tests pass their own).
 * @returns {Object}   The payload, as the listeners left it.
 */
export function callPreRollHook({ actor, item = null, skill = null, isInitiative = false, dataset, skillDataset }, hooks = globalThis.Hooks) {
  dataset.combatModifierSources ??= [];
  const sources = dataset.combatModifierSources;
  const payload = {
    actor, item, skill, isInitiative, dataset, skillDataset, sources,
    addSource(source = {}) {
      const entry = {
        id: source.id ?? `preRoll-${nextId++}`, label: String(source.label ?? ''),
        shiftUp: Math.max(0, Number(source.shiftUp) || 0), shiftDown: Math.max(0, Number(source.shiftDown) || 0),
        edge: !!source.edge, snag: !!source.snag,
      };
      dataset.shiftUp = (Number(dataset.shiftUp) || 0) + entry.shiftUp;
      dataset.shiftDown = (Number(dataset.shiftDown) || 0) + entry.shiftDown;
      if (entry.edge) {
        skillDataset.edge = true;
      }

      if (entry.snag) {
        skillDataset.snag = true;
      }

      sources.push(entry);
      return entry;
    },
  };

  try {
    hooks?.callAll?.(PRE_ROLL_HOOK, payload);
  } catch (error) {
    console.error('Essence20 | a preRollOptions listener failed', error);
  }

  return payload;
}
