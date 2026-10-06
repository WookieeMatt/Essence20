import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate, unknownTags } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";
import { localize, marksOf, num, readPath, resolve } from "../shared/hit-rider-lookups.mjs";

/**
 * Vetoes (round 10, group B): a rule that refuses a change to its actor.
 *
 *   Veto {on: "create", items: [item tags]}     an item matching the tags can't be added (asked of the new item)
 *   Veto {on: "equip", items: [item tags]}      an item matching them can't be equipped
 *   Veto {on: "update", path, change?, clamp?}  the actor's value at `path` can't change that way - change: up (rise),
 *                                               down (fall) or any (default); clamp: true keeps the old value and lets
 *                                               the rest of the update through (else the whole update is refused)
 * `message` (text, {name} = the actor) is shown as a warning. `marked: <key>` - the veto lands on whoever carries that
 * mark (set by the rule's holder), not on the holder: "while cuffed, they can't...", "can't regain Health until
 * treated". `when` sees the actor as self: (holder: the rule's holder).
 *
 * ArmorPair {items, other}: two sets of armor matching these tags (one each, either way round) may be worn together
 * without the "two armors" warning (items/gear/support-upgrade-lending.mjs) - Bio-Tech Armor.
 */

registerRuleType('Veto', {
  params: {
    on: { kind: 'enum', required: true, options: ['create', 'equip', 'update', 'kitUse'] },
    items: { kind: 'object' },
    path: { kind: 'string' },
    change: { kind: 'enum', options: ['up', 'down', 'any'] },
    clamp: { kind: 'bool' },
    message: { kind: 'string' },
    marked: { kind: 'string' },
  },
  scopes: ['self'],
  validate: rule => [
    ...(['create', 'equip'].includes(rule.on) && !(Array.isArray(rule.items) && rule.items.length) ? [`${rule.on} needs items (a list of item: tags)`] : []),
    ...(Array.isArray(rule.items) ? unknownTags(rule.items).map(tag => `unknown tag "${tag}" in items`) : []),
    ...(rule.on == 'update' && !String(rule.path ?? '').startsWith('system.') ? ['update needs a path starting with system.'] : []),
    ...(rule.on != 'update' && (rule.path || rule.change || rule.clamp) ? ['path, change and clamp only go with on: update'] : []),
  ],
});

registerRuleType('ArmorPair', {
  params: { items: { kind: 'object', required: true }, other: { kind: 'object', required: true } },
  scopes: ['self'],
  validate: rule => ['items', 'other'].flatMap(key => (Array.isArray(rule[key]) ? unknownTags(rule[key]).map(tag => `unknown tag "${tag}" in ${key}`) : [`${key} must be a list of item: tags`])),
});

/** The Veto rules on an actor for one kind of change: its own, and those of whoever marked it. */
export function vetoesFor(actor, on) {
  const own = rulesOfType(actor, 'Veto').filter(({ rule }) => rule.on == on && !rule.marked).map(entry => ({ ...entry, holder: actor }));
  const marked = [];
  for (const { key, mark } of marksOf(actor)) {
    const setter = resolve(mark?.by);
    for (const entry of setter ? rulesOfType(setter, 'Veto') : []) {
      if (entry.rule.on == on && entry.rule.marked == key) {
        marked.push({ ...entry, holder: setter });
      }
    }
  }

  return [...own, ...marked];
}

function warn(rule, actor) {
  if (rule.message) {
    globalThis.ui?.notifications?.warn?.(localize(String(rule.message)).replace(/\{name\}/g, actor?.name ?? ''));
  }
}

const holds = (entry, actor, extra = {}) => evaluate(entry.rule.when, contextFor({ ...extra, self: actor, holder: entry.holder, ruleItem: entry.item })) === true;

/** The Veto that refuses this item on this actor (create / equip / kitUse), or null. */
export function itemVeto(actor, item, on) {
  return vetoesFor(actor, on).find(entry => holds(entry, actor, { item }) && evaluate(entry.rule.items, contextFor({ self: actor, holder: entry.holder, ruleItem: entry.item, item })) === true) ?? null;
}

/**
 * `on: "kitUse"` (round 15, items2): a kit's Use button (mechanics/resources/kits.mjs#runKitUse) is refused while the
 * Veto's `when` holds (`items` optional - item: tags asked of the kit), with its message as a warning ("You cannot use
 * kits while fighting with Reckless Abandon"). Returns true when refused.
 */
export function kitUseVetoed(actor, kit) {
  const entry = itemVeto(actor, kit, 'kitUse');
  if (entry) {
    warn(entry.rule, actor);
  }

  return !!entry;
}

/** Whether a value moved the way a Veto watches for. */
function moved(change, before, after) {
  if (change == 'up') {
    return num(after) > num(before);
  }

  if (change == 'down') {
    return num(after) < num(before);
  }

  return typeof after == 'boolean' || typeof before == 'boolean' ? !!after != !!before : after != before;
}

/**
 * An actor update against its Vetoes: false when it must be refused; clamped paths are put back in `changes`.
 * @returns {Boolean}
 */
export function checkActorUpdate(actor, changes) {
  for (const entry of vetoesFor(actor, 'update')) {
    const { rule } = entry;
    const next = readPath(changes, rule.path);
    if (next === undefined || !moved(rule.change ?? 'any', readPath(actor, rule.path), next) || !holds(entry, actor)) {
      continue;
    }

    warn(rule, actor);
    if (!rule.clamp) {
      return false;
    }

    globalThis.foundry?.utils?.setProperty?.(changes, rule.path, readPath(actor, rule.path));
  }

  return true;
}

globalThis.Hooks?.on?.('preUpdateActor', (actor, changes) => checkActorUpdate(actor, changes));

globalThis.Hooks?.on?.('preCreateItem', item => {
  const actor = item?.parent;
  if (actor?.documentName != 'Actor') {
    return true;
  }

  const veto = itemVeto(actor, item, 'create');
  if (veto) {
    warn(veto.rule, actor);
    return false;
  }

  return true;
});

globalThis.Hooks?.on?.('preUpdateItem', (item, changes) => {
  const actor = item?.parent;
  if (actor?.documentName != 'Actor' || readPath(changes, 'system.equipped') !== true || item.system?.equipped) {
    return true;
  }

  const veto = itemVeto(actor, item, 'equip');
  if (veto) {
    warn(veto.rule, actor);
    return false;
  }

  return true;
});

/** Whether the actor's ArmorPair rules let these two sets of armor be worn together. */
export function ruleAllowsArmorPair(actor, a, b) {
  const fits = (entry, item, key) => evaluate(entry.rule[key], contextFor({ self: actor, ruleItem: entry.item, item })) === true;
  return rulesOfType(actor, 'ArmorPair').some(entry => evaluate(entry.rule.when, contextFor({ self: actor, ruleItem: entry.item })) === true
    && ((fits(entry, a, 'items') && fits(entry, b, 'other')) || (fits(entry, b, 'items') && fits(entry, a, 'other'))));
}
