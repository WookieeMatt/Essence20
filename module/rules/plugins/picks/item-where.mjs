import { registerRef } from "../../formula.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerItemSelector } from "../../steps.mjs";

/**
 * Item selectors and a count (round 15, uses), for the item steps (deleteItem, updateItem, spendQuantity, takeItem...):
 *   - `item: "where:<tag>&<tag>..."` - the actor's items meeting every tag, asked of each item as `item:`
 *     (item:type:weapon, item:data:flags.essence20.foraged, item:trait:sniper...); `self:` is the actor. First match, or
 *     every one with `all: true`.
 *   - `item: "withAttached:<tag>&<tag>..."` - the same, plus the items attached to them (a weapon's attacks and upgrades:
 *     flags.essence20.parentId) - "remove the old weapon and its attacks".
 *   - `item: "firstWithAttached:<tags>"` - the first match and what is attached to it (with `all: true`).
 *   - `item: "justGranted"` - the item this run's last grant / createItem made.
 *   - `item: "host"` - the item the rule's item is attached to (an upgrade's weapon / armor).
 *   - Ref `@flagged.<flag>` - how many of the actor's items carry a truthy flags.essence20.<flag> (Brainstorm's "no more
 *     than three made").
 */

const listOf = collection => collection?.contents ?? (collection ? [...collection] : []);

function matching(rest, actor, ctx, items) {
  const tags = String(rest).split('&').filter(Boolean);
  return items.filter(item => evaluate(tags, contextFor({ self: actor, ruleItem: ctx.item, item, other: ctx.targets?.[0] ?? null, vars: ctx.vars })) === true);
}

registerItemSelector('where:', matching);

registerItemSelector('withAttached:', (rest, actor, ctx, items) => {
  const found = matching(rest, actor, ctx, items);
  const ids = new Set(found.map(item => item.id));
  return [...found, ...items.filter(item => !ids.has(item.id) && ids.has(item.flags?.essence20?.parentId))];
});

// firstWithAttached:<tags> - the first match and what is attached to it (give the step all: true).
registerItemSelector('firstWithAttached:', (rest, actor, ctx, items) => {
  const [first] = matching(rest, actor, ctx, items);
  return first ? [first, ...items.filter(item => item !== first && item.flags?.essence20?.parentId == first.id)] : [];
});

// justGranted - the item this run's last grant / createItem made (@var.granted).
registerItemSelector('justGranted', (rest, actor, ctx, items) => items.filter(item => ctx.vars?.granted && (item === ctx.vars.granted || item.id == ctx.vars.granted.id)));

registerItemSelector('host', (rest, actor, ctx, items) => {
  const parentId = ctx.item?.flags?.essence20?.parentId;
  return parentId ? items.filter(item => item.id == parentId) : [];
});

registerRef('flagged', (key, scope) => listOf(scope.actor?.items).filter(item => !!item?.flags?.essence20?.[key]).length);
