/**
 * House rules: rules a world switches on for every actor, without an item to carry them.
 *
 * A module (or world script) registers one with `game.essence20.rules.registerHouseRule({...})`, best from its own `init`
 * hook. The GM turns each on or off under Configure Settings > House Rules (apps/house-rules-config.mjs); the choices are
 * kept in the world setting `essence20.houseRules` ({id: true | false}, a missing id taking the rule's `default`).
 *
 * A house rule may carry `rules` - ordinary item rules (docs/RULES_ENGINE_PLAN.md), RollModifier, DamageModifier,
 * DefenseModifier and the rest. Every actor runs them as if it held an item with those rules: rules/index.mjs#collectRules
 * adds them to the actor's rule index, held by a stand-in item (houseRuleHolder) named after the house rule, so a roll
 * lists its source as the house rule's label. A house rule with no `rules` is a switch for the module's own code (a
 * Hooks listener checking houseRuleEnabled(id)).
 *
 * A world can also make its own, with no module: the House Rules page's New House Rule (apps/house-rule-editor.mjs) keeps
 * them in the world setting `essence20.worldHouseRules` ([{id, label, hint, rules}]); syncWorldHouseRules registers them
 * like any other, marked `world: true` and grouped under "This World".
 *
 * Plain Node safe: no Foundry globals at import.
 */

export const HOUSE_RULES_SETTING = 'houseRules';
export const WORLD_HOUSE_RULES_SETTING = 'worldHouseRules';

const REGISTRY = new Map();

/** Check and store one definition (no refresh). */
function store(definition, { world = false } = {}) {
  const id = String(definition?.id ?? '');
  if (!/^[\w-]+$/.test(id)) {
    throw new Error(`Essence20 | registerHouseRule: id "${id}" must be letters, digits, - or _`);
  }

  if (!definition.label) {
    throw new Error(`Essence20 | registerHouseRule: "${id}" needs a label`);
  }

  if (definition.rules !== undefined && !Array.isArray(definition.rules)) {
    throw new Error(`Essence20 | registerHouseRule: "${id}" rules must be an array`);
  }

  const stored = {
    id, label: String(definition.label), hint: definition.hint ? String(definition.hint) : '',
    module: world ? '' : (definition.module ? String(definition.module) : ''), rules: definition.rules ?? [],
    default: !!definition.default, world,
  };
  REGISTRY.set(id, stored);
  return stored;
}

/**
 * Register a house rule. A second registration with the same id replaces the first.
 * @param {Object} definition
 * @param {String} definition.id          Unique, letters/digits/-/_ (prefix it with your module's id).
 * @param {String} definition.label       Shown in House Rules and as the source of its roll modifiers (localized).
 * @param {String} [definition.hint]      One or two sentences under the label (localized).
 * @param {String} [definition.module]    The registering module's id - House Rules groups by it.
 * @param {Array<Object>} [definition.rules]   Item rules every actor runs while it's on.
 * @param {Boolean} [definition.default]  On in a world that hasn't chosen yet (default false).
 * @returns {Object}   The stored definition.
 */
export function registerHouseRule(definition) {
  const stored = store(definition);
  // Registered once the world is running (a macro): actors pick it up now.
  if (globalThis.game?.ready) {
    refreshHouseRuleActors();
  }

  return stored;
}

/** Every registered house rule, in registration order. */
export const houseRules = () => [...REGISTRY.values()];

/** One registered house rule, or null. */
export const houseRule = id => REGISTRY.get(id) ?? null;

/** Remove a house rule (a module's own clean-up). Returns whether there was one. */
export function unregisterHouseRule(id) {
  const had = REGISTRY.delete(id);
  if (had && globalThis.game?.ready) {
    refreshHouseRuleActors();
  }

  return had;
}

/** The world's own house rules, as stored ([{id, label, hint, rules}]); [] before settings exist. */
export function worldHouseRules() {
  try {
    const list = globalThis.game?.settings?.get?.('essence20', WORLD_HOUSE_RULES_SETTING);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * Bring the registry in line with the world's own house rules: each registered (world: true), any deleted since removed.
 * One that won't load (a bad id) is skipped with an error. Refreshes the actors once the world is running.
 * @param {Array<Object>} [list]   Defaults to the stored setting.
 */
export function syncWorldHouseRules(list = worldHouseRules()) {
  const ids = new Set(list.map(entry => entry?.id));
  for (const definition of [...REGISTRY.values()]) {
    if (definition.world && !ids.has(definition.id)) {
      REGISTRY.delete(definition.id);
    }
  }

  for (const entry of list) {
    try {
      store(entry, { world: true });
    } catch (error) {
      console.error('Essence20 | a world house rule could not be loaded', error);
    }
  }

  if (globalThis.game?.ready) {
    refreshHouseRuleActors();
  }
}

/**
 * Register the house rules active modules ship in module.json (flags.essence20.houseRules: [{id, label, hint, rules}]) -
 * a module made by Export Homebrew carries the world's own this way, with no code. Run before syncWorldHouseRules, so a
 * world rule with the same id wins. One that won't load is skipped with an error.
 * @param {Iterable<Object>} modules   game.modules.
 */
export function syncModuleHouseRules(modules = []) {
  for (const module of modules) {
    const list = module?.active ? module.flags?.essence20?.houseRules : null;
    for (const entry of Array.isArray(list) ? list : []) {
      try {
        store({ ...entry, module: module.id });
      } catch (error) {
        console.error(`Essence20 | a house rule from ${module.id} could not be loaded`, error);
      }
    }
  }
}

/** The world's choices ({id: Boolean}); {} before settings exist. */
function choices() {
  try {
    return globalThis.game?.settings?.get?.('essence20', HOUSE_RULES_SETTING) ?? {};
  } catch {
    return {};
  }
}

/** Whether a house rule is on in this world (an unregistered id: false). */
export function houseRuleEnabled(id) {
  const definition = REGISTRY.get(id);
  if (!definition) {
    return false;
  }

  const chosen = choices()[id];
  return typeof chosen == 'boolean' ? chosen : definition.default;
}

// One stand-in item per actor and house rule, so a rule's state (a use limit's count, a toggle) stays put between rolls.
const HOLDERS = new WeakMap();

/**
 * The stand-in item an actor holds a house rule's rules on: enough of an Item for the rules engine (id, name, type,
 * parent, flags, system.rules, getFlag / setFlag). Its flags live in memory only - a house rule's rules shouldn't keep
 * state that must survive a reload (a per-rest limit resets with the page).
 */
export function houseRuleHolder(actor, definition) {
  let held = HOLDERS.get(actor);
  if (!held) {
    held = new Map();
    HOLDERS.set(actor, held);
  }

  let holder = held.get(definition.id);
  if (!holder) {
    const path = (object, key) => String(key).split('.').reduce((at, part) => at?.[part], object);
    holder = {
      id: `house-${definition.id}`, name: definition.label, type: 'houseRule', img: 'icons/svg/book.svg', isHouseRule: true,
      parent: actor, actor, isOwner: true, flags: { essence20: {} }, system: { rules: definition.rules },
      uuid: `${actor?.uuid ?? 'Actor'}.HouseRule.${definition.id}`,
      getFlag(scope, key) {
        return path(this.flags[scope], key);
      },
      async setFlag(scope, key, value) {
        const keys = String(key).split('.');
        const last = keys.pop();
        keys.reduce((at, part) => (at[part] ??= {}), this.flags[scope] ??= {})[last] = value;
        return this;
      },
      async unsetFlag(scope, key) {
        const keys = String(key).split('.');
        const last = keys.pop();
        delete keys.reduce((at, part) => at?.[part], this.flags[scope] ?? {})?.[last];
        return this;
      },
      async update() {
        return this;
      },
    };
    held.set(definition.id, holder);
  }

  // A re-registration may have changed the label or rules.
  holder.name = definition.label;
  holder.system.rules = definition.rules;
  return holder;
}

/** The rule entries ({rule, item, index}) every enabled house rule adds to an actor's index. */
export function houseRuleEntries(actor) {
  if (!actor || !REGISTRY.size) {
    return [];
  }

  const entries = [];
  for (const definition of REGISTRY.values()) {
    if (!definition.rules.length || !houseRuleEnabled(definition.id)) {
      continue;
    }

    const holder = houseRuleHolder(actor, definition);
    definition.rules.forEach((rule, index) => entries.push({ rule, item: holder, index }));
  }

  return entries;
}

/** Re-prepare every actor (world and unlinked tokens) and redraw open sheets, after a house rule is switched. */
export function refreshHouseRuleActors() {
  const game = globalThis.game;
  const actors = new Set(game?.actors ?? []);
  for (const scene of game?.scenes ?? []) {
    for (const token of scene.tokens ?? []) {
      if (!token.actorLink && token.actor) {
        actors.add(token.actor);
      }
    }
  }

  for (const actor of actors) {
    try {
      actor.reset?.();
      if (actor.sheet?.rendered) {
        actor.sheet.render();
      }
    } catch (error) {
      console.error(`Essence20 | refreshing house rules for ${actor?.name}`, error);
    }
  }

  // What's kept rather than derived follows on its own (mechanics/characters/level-picks.mjs: LevelPick picks).
  globalThis.Hooks?.callAll?.('essence20.houseRulesRefreshed');
}
