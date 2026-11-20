import { roleRule } from "./custom-game-lines.mjs";

/**
 * Keeping characters in step with their line's rules switches (line-profiles.mjs). A Role sets canMorph, canSpellcast,
 * canQualify and canTransform on its character when it's dropped (sheet-handlers/role-handler.mjs), so a later change -
 * the world's Game Line, or a homebrew line's switches in Game Lines - would leave existing characters as they were.
 *
 * Each client remembers what the switches gave every character (a snapshot at ready, kept current as Roles come and
 * go). When the line or its switches change, the active GM compares old and new per character and updates only the
 * flags whose switch actually changed - a Morph ticked by hand in Sheet Options stays ticked unless the switch it
 * would follow changed too.
 */

/** The actor flags a line's switches set, by the switch of the same name. */
export const SYNCED_SWITCHES = Object.freeze(['canMorph', 'canSpellcast', 'canQualify', 'canTransform']);

const itemsOf = actor => actor?.items?.contents ?? [...(actor?.items ?? [])];
const baseRoleOf = actor => {
  const roles = itemsOf(actor).filter(item => item?.type == 'role');
  return roles.find(role => !role.system?.isAdditive) ?? roles[0] ?? null;
};

/**
 * What the switches give this character now: {switch: Boolean}, only for flags its type has; null with no Role.
 * @param {Actor} actor
 * @param {String} [world]   The world's line (custom-game-lines.mjs#worldLineId) - read from the world when left out.
 * @returns {Object|null}
 */
export function switchesFor(actor, world) {
  const role = baseRoleOf(actor);
  if (!role) {
    return null;
  }

  const has = SYNCED_SWITCHES.filter(key => key in (actor.system ?? {}));
  return Object.fromEntries(has.map(key => [key, !!(world === undefined ? roleRule(role, key) : roleRule(role, key, world))]));
}

/**
 * The update that brings a character in line with changed switches: only flags whose switch changed between `before`
 * and `after`, and only where the actor doesn't already have the new value. Transforming switched off keeps a character
 * that holds an Alt Mode transforming.
 * @param {Actor} actor
 * @param {Object|null} before   switchesFor() under the old rules.
 * @param {Object|null} after   switchesFor() under the new.
 * @returns {Object}   Update data; empty when nothing changes.
 */
export function switchChanges(actor, before, after) {
  const changes = {};
  if (!before || !after) {
    return changes;
  }

  for (const key of SYNCED_SWITCHES) {
    if (!(key in after) || before[key] === after[key]) {
      continue;
    }

    const value = after[key] || (key == 'canTransform' && itemsOf(actor).some(item => item?.type == 'altMode'));
    if (!!actor.system?.[key] !== value) {
      changes[`system.${key}`] = value;
    }
  }

  return changes;
}

/** What the switches gave each character when last looked at, by actor id. */
let remembered = new Map();

/** Every world actor's switches now. */
function snapshot() {
  const out = new Map();
  for (const actor of game.actors ?? []) {
    const switches = switchesFor(actor);
    if (switches) {
      out.set(actor.id, switches);
    }
  }

  return out;
}

/**
 * The line or its switches changed (settings.js: the Game Line setting, Game Lines' lines): the active GM updates
 * every character whose flags follow a switch that changed. Every client takes the new snapshot.
 * @returns {Promise<Number>}   How many characters were updated (0 on other clients).
 */
export async function onLineRulesChanged() {
  const next = snapshot();
  const before = remembered;
  remembered = next;
  if (!game.users?.activeGM?.isSelf) {
    return 0;
  }

  let count = 0;
  for (const [id, after] of next) {
    const actor = game.actors.get(id);
    const changes = switchChanges(actor, before.get(id), after);
    if (Object.keys(changes).length) {
      await actor.update(changes);
      count++;
    }
  }

  return count;
}

/** Take the first snapshot at ready, and keep each character's entry current as Roles are added and removed. */
export function registerLineResync() {
  Hooks.once('ready', () => {
    remembered = snapshot();
  });

  const refresh = item => {
    const actor = item?.type == 'role' ? item.parent : null;
    if (!actor?.id || actor.isToken || !game.actors.has(actor.id)) {
      return;
    }

    const switches = switchesFor(actor);
    if (switches) {
      remembered.set(actor.id, switches);
    } else {
      remembered.delete(actor.id);
    }
  };

  Hooks.on('createItem', refresh);
  Hooks.on('deleteItem', refresh);
}
