import { registerDerived, registerPreRoll } from "../../../mechanics/item-hooks.mjs";
import { registerRef } from "../../formula.mjs";
import { feetBetween, interpolate, registerTag } from "../../predicate.mjs";
import { recipients, registerRecipient, registerStep } from "../../steps.mjs";
import { escape, listOf, T, write } from "../shared/chat-speaker-helpers.mjs";

/**
 * Marks on items, and the contested-test pieces around them (round 10, group D):
 *
 *  - Steps `markItem {item, key, effects: {blockRolls?, noArmorDefense?}, to?}` and `unmarkItem {item, key, to?}` - a
 *    named state on one of the recipient's items (flags.essence20.ruleItemMarks.<key>). `item` is `choice:<key>` (a
 *    pick's stored item), `{var.x}` (an item uuid kept in the run) or any item-step selector. While marked, an item with
 *    `blockRolls` can't be rolled (its attacks neither), and armor with `noArmorDefense` adds nothing to Toughness or
 *    Evasion.
 *  - Tag `item:marked:<key>` - the item (or its weapon) carries that mark.
 *  - Recipient `operator` - whoever works the first target: a vehicle's or Zord's driver (none without one), else the
 *    target itself.
 *  - Step `rollPlain {skill, to, var, flavor?}` - the recipient's Skill die as plain dice (1d20 + the die; an automatic
 *    success 99, an automatic failure 0), posted, its total kept in @var.<var>. Nothing when there's no recipient.
 *  - Step `spendActionFor {action, to}` - each recipient spends that action (in combat); stops when one can't.
 *  - Formula ref `@availabilityDif.<choiceKey>` - the DIF of the Availability of the item a pick stored under the key.
 *  - Tag `target:withinOrUnknown:<ft>` - the other party is within that range, or the distance can't be measured.
 */

const MARKS = 'ruleItemMarks';
const LEGACY_JAMMED = 'o2Jammed';

/** An item's live marks: {key: {effects, by, label}} - a legacy jammed list on its actor counts as a jam. */
export function itemMarks(item) {
  const own = item?.flags?.essence20?.[MARKS] ?? {};
  const legacy = item?.parent?.flags?.essence20?.[LEGACY_JAMMED];
  if (Array.isArray(legacy) && item?.id && legacy.includes(item.id) && !own.jammed) {
    return { ...own, jammed: { effects: { blockRolls: true, noArmorDefense: true }, legacy: true } };
  }

  return own;
}

const parentOf = item => {
  const id = item?.flags?.essence20?.parentId;
  return id ? item.parent?.items?.get?.(id) ?? listOf(item.parent?.items).find(other => other.id == id) ?? null : null;
};

/** Whether an item (or its weapon) carries a mark with that effect. */
export function markedWith(item, effect) {
  return [item, parentOf(item)].some(one => one && Object.values(itemMarks(one)).some(mark => mark?.effects?.[effect]));
}

registerTag('item:marked', (rest, ctx) => {
  const item = ctx.item;
  if (!item) {
    return false;
  }

  return [item, parentOf(item)].some(one => one && !!itemMarks(one)[rest]);
});

/** The items an item-mark step means, on one actor. */
async function itemsMeant(step, actor, ctx) {
  const ref = String(step.item ?? '');
  const choice = /^choice:([\w-]+)$/.exec(ref);
  const uuid = choice ? ctx.item?.flags?.essence20?.rules?.choices?.[choice[1]]
    : /\{var\./.test(ref) ? ref.replace(/\{var\.([\w-]+)\}/g, (m, key) => String(ctx.vars?.[key] ?? '')) : null;
  if (uuid) {
    const found = globalThis.fromUuidSync?.(uuid, { strict: false }) ?? listOf(actor?.items).find(item => item.id == uuid) ?? null;
    return found && (!actor || found.parent === actor || found.parent?.uuid == actor.uuid) ? [found] : [];
  }

  const { itemsFor } = await import("../../steps.mjs");
  return itemsFor({ ...step, item: interpolate(ref, ctx.item) ?? ref }, actor, ctx);
}

registerStep('markItem', async (step, ctx) => {
  let marked = 0;
  for (const actor of recipients({ ...step, to: step.to ?? 'target' }, ctx)) {
    for (const item of await itemsMeant(step, actor, ctx)) {
      await write(item, 'update', [{ [`flags.essence20.${MARKS}.${step.key}`]: { effects: step.effects ?? {}, by: ctx.actor?.uuid ?? null, label: ctx.item?.name ?? '' } }]);
      ctx.vars.itemName = item.name;
      ctx.vars.itemUuid = item.uuid ?? '';
      ctx.chat.push(escape(T('ItemMarked', { name: actor.name, item: item.name })));
      marked++;
    }
  }

  return marked ? undefined : false;
}, { errors: (step, where) => (step.key && step.item ? [] : [`${where}: markItem needs an item and a key`]) });

registerStep('unmarkItem', async (step, ctx) => {
  for (const actor of recipients({ ...step, to: step.to ?? 'target' }, ctx)) {
    for (const item of await itemsMeant(step, actor, ctx)) {
      await write(item, 'update', [{ [`flags.essence20.${MARKS}.-=${step.key}`]: null }]);
      const legacy = actor.flags?.essence20?.[LEGACY_JAMMED];
      if (step.key == 'jammed' && Array.isArray(legacy) && legacy.includes(item.id)) {
        await write(actor, 'update', [{ [`flags.essence20.${LEGACY_JAMMED}`]: legacy.filter(id => id != item.id) }]);
      }
    }
  }
}, { errors: (step, where) => (step.key && step.item ? [] : [`${where}: unmarkItem needs an item and a key`]) });

/** A marked item can't be rolled (its attacks neither): the roll is held, with the reason shown. */
export function blockMarkedRoll(actor, dataset, item) {
  if (item && markedWith(item, 'blockRolls')) {
    globalThis.ui?.notifications?.warn?.(T('ItemCannotRoll', { item: (parentOf(item) ?? item).name }));
    dataset.cancelRoll = true;
  }
}

registerPreRoll((actor, dataset, item) => blockMarkedRoll(actor, dataset, item));

/** Marked armor adds nothing to Toughness or Evasion. */
export function markedArmorDerived(actor) {
  if (!actor?.system?.defenses) {
    return;
  }

  for (const armor of listOf(actor.items).filter(item => item.type == 'armor' && item.system?.equipped && markedWith(item, 'noArmorDefense'))) {
    for (const [defense, field] of [['toughness', 'totalBonusToughness'], ['evasion', 'totalBonusEvasion']]) {
      const amount = Number(armor.system?.[field]) || 0;
      const target = actor.system.defenses[defense];
      if (amount && target) {
        target.total = (Number(target.total) || 0) - amount;
        if (typeof target.string == 'string') {
          target.string += ` - ${amount} (${armor.name})`;
        }
      }
    }
  }
}

registerDerived(markedArmorDerived);

/* -------------------------------------------- */
/*  Contested pieces                             */
/* -------------------------------------------- */

/** Who works an actor: a vehicle's or Zord's driver (null without one), else the actor. */
export function operatorOf(target) {
  if (target?.type == 'vehicle' || target?.type == 'zord') {
    const driver = Object.values(target.system?.actors ?? {}).find(crew => crew?.vehicleRole == 'driver');
    return driver ? globalThis.fromUuidSync?.(driver.uuid, { strict: false }) ?? null : null;
  }

  return target ?? null;
}

registerRecipient('operator', (match, ctx) => {
  const operator = operatorOf(ctx.targets[0]);
  return operator ? [operator] : [];
});

/** A Skill die as plain dice: "d8" -> "1d20 + 1d8"; an automatic success 99, an automatic failure 0. */
export function skillDieFormula(shift) {
  if (!shift || shift == 'd20') {
    return '1d20';
  }

  if (['autoSuccess', 'criticalSuccess'].includes(shift)) {
    return '99';
  }

  if (['autoFail', 'fumble'].includes(shift)) {
    return '0';
  }

  return `1d20 + ${/^\d/.test(shift) ? shift : `1${shift}`}`;
}

registerStep('rollPlain', async (step, ctx) => {
  for (const actor of recipients(step, ctx).slice(0, 1)) {
    const roll = await new globalThis.Roll(skillDieFormula(actor.system?.skills?.[step.skill]?.shift)).evaluate();
    await roll.toMessage?.({ speaker: globalThis.ChatMessage?.getSpeaker?.({ actor }), flavor: escape(T('PlainRoll', { name: actor.name, item: ctx.item?.name ?? '' })) });
    ctx.vars[step.var || 'rolled'] = Number(roll.total) || 0;
  }
}, { errors: (step, where) => (step.skill ? [] : [`${where}: rollPlain needs a skill`]) });

registerStep('spendActionFor', async (step, ctx) => {
  if (!globalThis.game?.combat) {
    return;
  }

  const { spend } = await import("../../../mechanics/actions/action-economy.mjs");
  for (const actor of recipients(step, ctx)) {
    const paid = await spend(actor, step.action ?? 'move', { source: ctx.item?.name ?? null });
    if (paid?.blocked) {
      return false;
    }
  }
}, { errors: (step, where) => (step.action && !['free', 'move', 'standard'].includes(step.action) ? [`${where}: action must be free, move or standard`] : []) });

registerRef('availabilityDif', (key, scope) => {
  const uuid = scope.item?.flags?.essence20?.rules?.choices?.[key];
  const item = uuid ? globalThis.fromUuidSync?.(uuid, { strict: false }) ?? null : null;
  return Number(globalThis.CONFIG?.E20?.availabilityDifficulties?.[item?.system?.availability]) || 0;
});

registerTag('target:withinOrUnknown', (rest, ctx) => {
  if (!ctx.other) {
    return false;
  }

  const feet = feetBetween(ctx.self, ctx.other);
  return feet === null || feet <= Number(rest);
});
