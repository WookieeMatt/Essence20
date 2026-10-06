import { registerPreRoll, registerRollSources } from "../../../mechanics/item-hooks.mjs";
import { evaluateTag, registerTag } from "../../predicate.mjs";
import { registerItemSelector } from "../../steps.mjs";
import { listOf } from "../shared/chat-speaker-helpers.mjs";

/**
 * Item-carried rules (round 15, items1) - what a mark on an item (markItem, rules/plugins/marks/item-marks.mjs) does for
 * whoever owns or rolls that item, and the pieces to find the item again from a posted button.
 *
 *  - Mark effects (markItem `effects`):
 *    - `rollSnag: true`, `rollShiftDown: <n>`, `rollLabel: <text>` - every roll with the marked item (an attack's weapon
 *      counts), and every roll carrying `dataset.markedItemUuid` of it (a test to repair it), gets a Snag and / or ↓n,
 *      labelled "<rollLabel> (<item>)" in the Roll Options dialog.
 *    - `inoperable: true` - rolling the item's attack warns that it is disrupted (the roll still goes ahead).
 *  - Item selector `var:<key>` - the item whose uuid (or id) @var.<key> holds (markItem's @var.itemUuid), on the recipient.
 *  - Tag `itemVar:<key>:<item tag>` - that item meets the item tag (itemVar:itemUuid:item:marked:disrupted).
 *  Technical Glitch, Some Assembly Required, Complete System Failure (the Disruptor Focus).
 */

const MARKS = 'ruleItemMarks';
const marksOf = item => Object.values(item?.flags?.essence20?.[MARKS] ?? {}).filter(Boolean);
const lookup = uuid => {
  try {
    return uuid ? globalThis.fromUuidSync?.(uuid, { strict: false }) ?? null : null;
  } catch (error) {
    return null;
  }
};

const hostOf = (actor, item) => {
  const parentId = item?.type == 'weaponEffect' ? item.flags?.essence20?.parentId : null;
  return parentId ? actor?.items?.get?.(parentId) ?? listOf(actor?.items).find(other => other.id == parentId) ?? null : item ?? null;
};

/** The roll sources the marks on the rolled item (or the item a repair test names) give. */
export function itemMarkSources(actor, target, ctx = {}) {
  const items = [hostOf(actor, ctx.item), lookup(ctx.dataset?.markedItemUuid)].filter(Boolean);
  const sources = [];
  for (const item of items) {
    for (const mark of marksOf(item)) {
      const effects = mark.effects ?? {};
      const shiftDown = Number(effects.rollShiftDown) || 0;
      if (effects.rollSnag || shiftDown) {
        sources.push({
          id: `itemMark-${item.id}-${effects.rollLabel ?? ''}`.replace(/[^\w-]/g, '_'),
          label: effects.rollLabel ? `${effects.rollLabel} (${item.name})` : item.name,
          ...(effects.rollSnag ? { snag: true } : {}), ...(shiftDown ? { shiftDown } : {}),
        });
      }
    }
  }

  // One per item and label (an item rolled and repaired at once counts once).
  return { sources: sources.filter((source, at) => sources.findIndex(other => other.id == source.id) == at), consumes: [] };
}

registerRollSources(itemMarkSources);

/** Rolling an attack of an inoperable item: a warning. */
export function inoperableWarning(actor, item) {
  if (item?.type != 'weaponEffect') {
    return null;
  }

  const weapon = hostOf(actor, item);
  return weapon && weapon !== item && marksOf(weapon).some(mark => mark.effects?.inoperable)
    ? globalThis.game?.i18n?.format?.('E20.Gij3StillInoperable', { item: weapon.name }) ?? weapon.name
    : null;
}

registerPreRoll(async (actor, dataset, item) => {
  const text = inoperableWarning(actor, item);
  if (text) {
    globalThis.ui?.notifications?.warn?.(text);
  }
});

registerItemSelector('var:', (key, actor, ctx, items) => {
  const ref = String(ctx.vars?.[key] ?? '');
  return ref ? items.filter(item => item.uuid == ref || item.id == ref) : [];
});

registerTag('itemVar', (rest, ctx) => {
  const [key, ...tag] = String(rest).split(':');
  const item = lookup(ctx.vars?.[key]);
  return item ? evaluateTag(tag.join(':'), { ...ctx, item }) === true : false;
});
