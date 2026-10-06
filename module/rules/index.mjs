import { RULE_TYPES } from "./types.mjs";
import { rulesSourceOf } from "./inherit.mjs";

/**
 * Reading an actor's rules (docs/RULES_ENGINE_PLAN.md §6, §8).
 *
 * Every item may carry `system.rules`, a list of typed rule objects. collectRules() walks the
 * actor's items once and buckets their live rules by type. rules/adapter.mjs builds that index at
 * the end of derived data and every hook reads it from there, so a roll never walks the items.
 *
 * Plain Node safe.
 */

/** An item's own rules, as stored - [] for an item type without the field. */
export function rulesOf(item) {
  const rules = item?.system?.rules;
  return Array.isArray(rules) ? rules : [];
}

/**
 * Whether an item's rules are switched on. Equipment counts only while equipped (the same reading
 * documents/actor.mjs gives armor's Defense bonus), and an upgrade only while the item it's attached
 * to is. Power Armor is the Morphed form and never "equipped" in that sense, so it always counts.
 * @param {Item} item
 * @returns {Boolean}
 */
export function isItemActive(item) {
  if (!item) {
    return false;
  }

  // A Hang-Up the Matured Perk lets its holder ignore (helpers/matured.mjs).
  if (item.flags?.essence20?.maturedIgnored) {
    return false;
  }

  if (['armor', 'weapon', 'shield', 'gear'].includes(item.type) && !item.system?.isPowerArmor && item.system?.equipped === false) {
    return false;
  }

  const parentId = item.flags?.essence20?.parentId;
  if (item.type == 'upgrade' && parentId) {
    const host = item.parent?.items?.get?.(parentId);
    if (host && host.system?.equipped === false) {
      return false;
    }
  }

  return true;
}

/** The item an upgrade is attached to (its `host`), or null. */
export function hostOf(item) {
  const parentId = item?.flags?.essence20?.parentId;
  return parentId ? item.parent?.items?.get?.(parentId) ?? null : null;
}

function itemsOf(actor) {
  const items = actor?.items;
  if (Array.isArray(items?.contents)) {
    return items.contents;
  }

  return items && typeof items[Symbol.iterator] == 'function' ? [...items] : [];
}

/**
 * Whether a rule applies again for each copy of its item on the same actor. The rule's own `stacks`
 * decides when set; otherwise an item that can be taken more than once (a Perk's selectionLimit above
 * 1) stacks, and anything else counts once however many copies there are - the same item twice is
 * usually a duplicate, not a second benefit.
 * @param {Object} rule
 * @param {Item} item
 * @returns {Boolean}
 */
export function ruleStacks(rule, item) {
  if (typeof rule?.stacks == 'boolean') {
    return rule.stacks;
  }

  return Number(item?.system?.selectionLimit) > 1;
}

/** Two copies of one item share this key: where its rules come from, which rule, and its choices. */
function copyKey(item, index) {
  const source = rulesSourceOf(item);
  if (!source) {
    return null;
  }

  return `${source}#${index}#${JSON.stringify(item.flags?.essence20?.rules?.choices ?? {})}`;
}

/**
 * Every live rule on an actor, bucketed by type: {RollModifier: [{rule, item, index}], ...}.
 * A rule is live when its item is active, it isn't disabled, and its type is one this version knows.
 * @param {Actor} actor
 * @returns {Object<String, Array<{rule: Object, item: Item, index: Number}>>}
 */
export function collectRules(actor) {
  const buckets = {};
  const seen = new Set();
  for (const item of itemsOf(actor)) {
    const rules = rulesOf(item);
    if (!rules.length || !isItemActive(item)) {
      continue;
    }

    rules.forEach((rule, index) => {
      if (!rule || rule.disabled || !RULE_TYPES[rule.type]) {
        return;
      }

      // A second copy of an item whose rule doesn't stack adds nothing (ruleStacks).
      const key = ruleStacks(rule, item) ? null : copyKey(item, index);
      if (key && seen.has(key)) {
        return;
      }

      if (key) {
        seen.add(key);
      }

      (buckets[rule.type] ??= []).push({ rule, item, index });
    });
  }

  for (const list of Object.values(buckets)) {
    list.sort((a, b) => (Number(a.rule.priority) || 0) - (Number(b.rule.priority) || 0));
  }

  return buckets;
}

const INDEX = Symbol('essence20.rules');

/** Scopes that reach another actor (rules/links.mjs). */
const LINKED = ['crew', 'pilot', 'vehicle', 'driven', 'companion', 'owner', 'party', 'team', 'aura'];

/** A scope added by a plug-in (rules/links.mjs#registerLinkScope) reaches another actor too. */
export function addLinkedScope(name) {
  if (!LINKED.includes(name)) {
    LINKED.push(name);
  }
}

/**
 * Ids of actors holding a rule that reaches another actor - so rules/links.mjs can skip its world
 * scan entirely when no actor has one, which is the usual case.
 */
export const LINK_HOLDERS = new Set();

function noteLinkHolder(actor, buckets) {
  if (!actor?.id) {
    return;
  }

  const has = Object.values(buckets).some(list => list.some(entry => LINKED.includes(entry.rule.scope)));
  if (has) {
    LINK_HOLDERS.add(actor.id);
  } else {
    LINK_HOLDERS.delete(actor.id);
  }
}

/**
 * The actor's rule index, cached on the actor by the last derived-data pass (rules/adapter.mjs).
 * Built on demand when there isn't one yet (an actor no prepare has touched, a test double).
 */
export function rulesIndex(actor) {
  if (!actor) {
    return {};
  }

  if (!actor[INDEX]) {
    actor[INDEX] = collectRules(actor);
    noteLinkHolder(actor, actor[INDEX]);
  }

  return actor[INDEX];
}

/** Rebuild the cached index - called once per derived-data pass. */
export function rebuildIndex(actor) {
  if (actor) {
    actor[INDEX] = collectRules(actor);
    noteLinkHolder(actor, actor[INDEX]);
  }

  return actor?.[INDEX] ?? {};
}

/** Live rules of one type on an actor, optionally narrowed to a scope ('self' when unset). */
export function rulesOfType(actor, type, scope = null) {
  const list = rulesIndex(actor)[type] ?? [];
  return scope ? list.filter(entry => (entry.rule.scope ?? 'self') == scope) : list;
}

/** The rules' own per-item state: toggles, pools and choices (flags.essence20.rules). */
export function ruleState(item) {
  return item?.flags?.essence20?.rules ?? {};
}

/** A stable id for one rule, for dialog switch names and roll-source ids. */
export function ruleId(item, index) {
  return `rule-${item?.id ?? 'x'}-${index}`;
}

/** The label a rule shows in the roll dialog's sources and switches. */
export function ruleLabel(rule, item) {
  if (!rule.label) {
    return item?.name || rule.type;
  }

  // "Studying {choice.subject}" - filled from the item's ChoiceSet picks; "…" until one is made.
  return String(rule.label).replace(/\{(choice\.[\w-]+|item\.choice)\}/g, (match, ref) => {
    const value = ref == 'item.choice' ? item?.system?.choice : item?.flags?.essence20?.rules?.choices?.[ref.slice(7)];
    return value === undefined || value === null || value === '' ? '…' : String(value);
  });
}
