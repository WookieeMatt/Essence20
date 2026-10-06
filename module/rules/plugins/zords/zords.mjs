import { registerLinkScope } from "../../links.mjs";
import { markOf, registerTag } from "../../predicate.mjs";
import { registerRef } from "../../formula.mjs";
import { changeResource, registerPickSource, registerRecipient, registerStep } from "../../steps.mjs";
import { RULE_TYPES, registerRuleType } from "../../types.mjs";
import { getSceneEpoch } from "../../../mechanics/resources/scene-clock.mjs";
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import {
  T, crewing, driverOf, holderOf, itemsOf, listsZord, ownedZords, resolve, sourceOf, worldActors, write,
} from "../shared/zord-crew-lookups.mjs";

/**
 * Group A: a Ranger and their Zords.
 *
 * - Scope `zordOwner` - on a Zord's item: the characters listing that Zord on their sheet (Power Matrix's refill when
 *   the pilot rests).
 * - Tags: `item:heldBy:picked:<key>` (the item asked about - a compendium entry in a pickGrant - is already on the
 *   actor a pick stored under that key: "a Feature the Zord doesn't have yet"), `target:userOwns` (this user may act
 *   for the other party - its owner, or the GM), `self:hasDriver`, `self:drivenByHolder` (this vehicle's driver is the
 *   rule's holder), `self:markedByHolder:<key>` (carries mark <key> set by the rule's holder), `vehicle:markedByMe:<key>`
 *   (the vehicle being crewed carries mark <key> set by this actor), `self:specializedAtLeast:<skill>:<die>` (a
 *   Specialization of that Skill at that die or better), `movement:<type>` / `movement:has` (in a Movement rule: the type
 *   being worked out / it already has some speed).
 * - Recipient `drivenVehicle` - the vehicle or Zord the actor is driving.
 * - Step `spendFrom` {to, resource, amount} - each recipient pays the cost from its own resource (the pilot or a crew
 *   member paying for the Zord's Feature); stops when one can't.
 * - Ref `@sourced.<16-char id>.<path>` - a number on the actor's copy of that compendium item (the Phantom Suite's
 *   advances).
 * - Rule type `SummonLimit` {} - only one of the holder's Zords may be summoned in a scene (mechanics/vehicles/zord-summon.mjs's
 *   summon, refused in preUpdateActor).
 */

/* -------------------------------------------- */
/*  Scope                                        */
/* -------------------------------------------- */

registerLinkScope('zordOwner', actor => ownedZords(actor));
for (const definition of Object.values(RULE_TYPES)) {
  if (definition.scopes?.includes('vehicle') && !definition.scopes.includes('zordOwner')) {
    definition.scopes.push('zordOwner');
  }
}

/* -------------------------------------------- */
/*  Tags                                         */
/* -------------------------------------------- */

/** The actor a pick step stored under `key` on the rule's item. */
function pickedActor(ruleItem, key) {
  const stored = ruleItem?.flags?.essence20?.rules?.choices?.[key];
  return stored ? resolve(stored) ?? globalThis.game?.actors?.get?.(stored) ?? null : null;
}

// item:heldBy:picked:<key> - the item (or compendium entry) is already on the picked actor (by its book source).
registerTag('item:heldBy', (rest, ctx) => {
  const match = /^picked:([\w-]+)$/.exec(rest);
  const actor = match ? pickedActor(ctx.ruleItem, match[1]) : null;
  if (!actor || !ctx.item) {
    return false;
  }

  const uuid = ctx.item.uuid ?? null;
  const source = sourceOf(ctx.item) ?? uuid;
  return itemsOf(actor).some(item => sourceOf(item) == source || sourceOf(item) == uuid);
}, { phrase: (arg, w) => [`the ${w.humanize(arg.replace(/^picked:/, '')).toLowerCase()} you picked already has {who}`, `the ${w.humanize(arg.replace(/^picked:/, '')).toLowerCase()} you picked doesn't have {who}`] });

registerTag('target:userOwns', (rest, ctx) => {
  const user = globalThis.game?.user;
  return !!ctx.other && (!!user?.isGM || !!ctx.other.isOwner || !!ctx.other.testUserPermission?.(user, 'OWNER'));
}, { phrase: ['you own {who}', "you don't own {who}"] });

registerTag('self:hasDriver', (rest, ctx) => !!driverOf(ctx.self), { phrase: ['{who} {has} a driver', '{who} {has} no driver'] });

const holderFor = ctx => (ctx.holder && ctx.holder !== ctx.self ? ctx.holder : holderOf(ctx.ruleItem));

registerTag('self:drivenByHolder', (rest, ctx) => {
  const holder = holderFor(ctx);
  const driver = driverOf(ctx.self);
  return !!holder && !!driver && (driver === holder || driver.uuid == holder.uuid);
}, { phrase: ['its owner drives {who}', "its owner doesn't drive {who}"] });

/** Whether `actor` carries mark `key` set by `setter` (a shared or a per-setter mark). */
export function markedBy(actor, key, setter) {
  if (!actor || !setter?.uuid || !markOf(actor, key)) {
    return false;
  }

  const marks = actor.flags?.essence20?.ruleMarks ?? {};
  const mark = marks[`${key}--${setter.id}`] ?? marks[key];
  return mark?.by == setter.uuid && markOf(actor, key);
}

registerTag('self:markedByHolder', (rest, ctx) => markedBy(ctx.self, rest, holderFor(ctx)), { phrase: ['its owner put the {arg} mark on {who}', "its owner didn't put the {arg} mark on {who}"] });
registerTag('vehicle:markedByMe', (rest, ctx) => {
  const crewed = crewing(ctx.self);
  return !!crewed && markedBy(crewed.vehicle, rest, ctx.self);
}, { phrase: ['you put the {arg} mark on the vehicle you crew', "you didn't put the {arg} mark on the vehicle you crew"] });

registerTag('self:specializedAtLeast', (rest, ctx) => {
  const [skill, die] = rest.split(':');
  const list = globalThis.CONFIG?.E20?.skillShiftList ?? [];
  const need = list.indexOf(die);
  if (need < 0) {
    return null;
  }

  return Object.values(ctx.self?.system?.skills?.[skill]?.specializations ?? {})
    .some(spec => list.indexOf(spec?.shift) >= 0 && list.indexOf(spec.shift) <= need);
}, { phrase: (arg, w) => {
  const [skill, die] = arg.split(':');
  return [`{who} {has} a ${w.skillName(skill)} Specialization at ${die} or better`, `{who} {has} no ${w.skillName(skill)} Specialization at ${die} or better`];
} });

registerTag('movement', (rest, ctx) => {
  if (ctx.movementType === undefined) {
    return null;
  }

  if (rest == 'has') {
    return (Number(ctx.self?.system?.movement?.[ctx.movementType]?.total) || 0) > 0;
  }

  return ctx.movementType == rest;
}, { family: 'situation', param: 'movementTag', phrase: (arg, w) => (arg == 'has' ? ['you have that Movement', "you don't have that Movement"] : [`for ${w.humanize(arg)} Movement`, `except for ${w.humanize(arg)} Movement`]) });

/* -------------------------------------------- */
/*  Recipients, steps, refs                      */
/* -------------------------------------------- */

// pick from: remaining - a list (`options`, as `from: list` takes them) less the values other picks on the item already
// hold (`exclude`: their keys) - several distinct picks from one list (Mesh Zord's three Megaform Traits).
registerPickSource('remaining', (step, ctx) => {
  const taken = new Set((Array.isArray(step.exclude) ? step.exclude : []).map(key => ctx.item?.flags?.essence20?.rules?.choices?.[key]).filter(Boolean));
  const localize = text => globalThis.game?.i18n?.localize?.(text) ?? text;
  return (Array.isArray(step.options) ? step.options : [])
    .map(option => (Array.isArray(option) ? { value: option[0], label: localize(option[1] ?? option[0]) } : { value: option, label: localize(option) }))
    .filter(option => !taken.has(option.value));
});

registerRecipient('drivenVehicle', (match, ctx) => {
  const crewed = crewing(ctx.actor);
  return crewed?.role == 'driver' ? [crewed.vehicle] : [];
});

registerStep('spendFrom', async (step, ctx) => {
  const { recipients } = await import("../../steps.mjs");
  const { resolveValue } = await import("../../formula.mjs");
  const amount = Math.round(resolveValue(step.amount ?? 1, { actor: ctx.actor, item: ctx.item, vars: ctx.vars }, 1));
  for (const payer of recipients(step, ctx)) {
    if (!(await changeResource(step.resource, -amount, { ...ctx, actor: payer }))) {
      ctx.chat.push(T('NotEnough', { name: payer.name }));
      return false;
    }

    ctx.vars.paidBy = payer.name;
  }
}, { errors: (step, where) => (step.resource ? [] : [`${where}: spendFrom needs a resource`]) });

registerRef('sourced', (key, scope, parts) => {
  const [id, ...path] = parts;
  const item = itemsOf(scope.actor).find(other => String(sourceOf(other) ?? '').split('.').pop() == id);
  return item ? Number(path.reduce((at, part) => at?.[part], item)) || 0 : 0;
});

/* -------------------------------------------- */
/*  One Zord per scene                           */
/* -------------------------------------------- */

registerRuleType('SummonLimit', { params: {}, scopes: ['self'] });

/** The characters whose sheet lists this Zord. */
export function zordOwners(zord) {
  return zord?.type == 'zord' ? worldActors().filter(actor => listsZord(actor, zord)) : [];
}

/**
 * Only one of a Ranger's Zords may be active in a scene. Checked as a Zord is summoned (zord-summon.mjs
 * writes zordSummonReadyRound): a second Zord of the same owner in the same scene is refused. The owner's
 * zord1ActiveZord flag remembers which Zord this scene's is.
 * @returns {Boolean} false to cancel the summon.
 */
export function checkSummonLimit(zord, changes, epoch = null) {
  const ready = changes?.flags?.essence20?.zordSummonReadyRound;
  if (zord?.type != 'zord' || ready === undefined || ready === null) {
    return true;
  }

  const owner = zordOwners(zord).find(actor => rulesOfType(actor, 'SummonLimit')
    .some(({ rule, item }) => evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) === true));
  if (!owner) {
    return true;
  }

  const now = epoch ?? getSceneEpoch();
  const active = owner.flags?.essence20?.zord1ActiveZord;
  if (active?.epoch == now && active.uuid && active.uuid != zord.uuid) {
    globalThis.ui?.notifications?.warn?.(T('OneZordPerScene', { name: owner.name, zord: resolve(active.uuid)?.name ?? '' }));
    return false;
  }

  write(owner, 'setFlag', ['essence20', 'zord1ActiveZord', { epoch: now, uuid: zord.uuid }]);
  return true;
}

globalThis.Hooks?.on?.('preUpdateActor', (actor, changes) => (actor?.type == 'zord' ? checkSummonLimit(actor, changes) : true));
