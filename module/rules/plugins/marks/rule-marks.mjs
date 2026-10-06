import { registerHitRider, registerRollSources } from "../../../mechanics/item-hooks.mjs";
import { LINK_SCOPES, LINK_SOURCES, linkedEntries } from "../../links.mjs";
import { RULE_TYPES, SCOPES } from "../../types.mjs";
import { rulesOf, rulesOfType, ruleId, ruleLabel } from "../../index.mjs";
import { contextFor, evaluate, registerTag } from "../../predicate.mjs";
import { isExpired } from "../../expiry.mjs";
import { registerRef } from "../../formula.mjs";
import { registerStep } from "../../steps.mjs";
import { usesLeft } from "../../limits.mjs";
import { shiftsOf } from "../../adapter.mjs";
import { itemsOf, resolveUuid, T } from "../shared/lazy-helpers-and-targets.mjs";

/**
 * Marks that carry rules (round 10, group C).
 *
 * A mark (the `mark` step, flags.essence20.ruleMarks.<key>) remembers who set it (`by`). Two new scopes let the
 * setter's item put rules on the marked creature while the mark lasts:
 *
 *   marked        `mark: "<key>"` - the rule reaches every actor carrying the setter's <key> mark: its own rolls,
 *                 Defenses, numbers, damage and Triggers, exactly as if it held the rule (self: = the marked
 *                 creature, holder: = the setter, the formulas read the setter and its item). The setter's item
 *                 needn't be equipped: the mark carries the rule.
 *   markedTarget  RollModifier only - rolls made AGAINST the marked creature, by anyone but the creature itself
 *                 (self: = the roller, target: = the marked creature, holder: = the setter).
 *
 * consumeMark + consumeFrom: "roller" (the marked creature's own roll uses the mark up) or "target" (a roll against
 * it does) - "used up by one roll".
 */

for (const scope of ['marked', 'markedTarget']) {
  if (!SCOPES.includes(scope)) {
    SCOPES.push(scope);
  }
}

if (!LINK_SCOPES.includes('marked')) {
  LINK_SCOPES.push('marked');
}

// Which rule types a mark can carry.
const CARRIED = ['RollModifier', 'DialogSwitch', 'Defense', 'DerivedStat', 'DamageModifier', 'Trigger', 'SkillSubstitution', 'ConditionImmunity', 'Movement', 'MovementAction'];
for (const type of CARRIED) {
  const definition = RULE_TYPES[type];
  if (!definition) {
    continue;
  }

  if (!definition.scopes.includes('marked')) {
    definition.scopes.push('marked');
  }

  definition.params.mark ??= { kind: 'string' };
}

RULE_TYPES.RollModifier.scopes.push('markedTarget');
if (!RULE_TYPES.RollModifier.params.consumeFrom.options.includes('roller')) {
  RULE_TYPES.RollModifier.params.consumeFrom.options.push('roller');
}

/** A marked / markedTarget rule needs the mark it rides on. */
for (const type of CARRIED) {
  const definition = RULE_TYPES[type];
  const inner = definition?.validate;
  if (!definition) {
    continue;
  }

  definition.validate = rule => [
    ...(inner?.(rule) ?? []),
    ...(['marked', 'markedTarget'].includes(rule.scope) && !rule.mark ? [`scope ${rule.scope} needs mark (the mark's key)`] : []),
    ...(rule.mark !== undefined && !['marked', 'markedTarget'].includes(rule.scope) ? ['mark only goes with scope marked or markedTarget'] : []),
  ];
}

/* -------------------------------------------- */
/*  Reading marks                                */
/* -------------------------------------------- */

/** The live marks on an actor: [{name, key, by}] (perSetter marks are kept as <key>--<setter id>). */
export function liveMarks(actor) {
  const marks = actor?.flags?.essence20?.ruleMarks ?? {};
  return Object.entries(marks).filter(([, mark]) => !!mark && !isExpired(mark))
    .map(([name, mark]) => ({ name, key: name.split('--')[0], by: mark.by ?? null, mark }));
}

/**
 * The rules of one type a mark on this actor carries from its setter: [{rule, item, index, holder}]. Read from
 * all the setter's items (equipped or not, so the mark keeps its rule), never the actor's own.
 */
export function carriedRules(actor, type, scope = 'marked') {
  const out = [];
  const seen = new Set();
  for (const { key, by } of liveMarks(actor)) {
    const setter = resolveUuid(by);
    if (!setter || setter === actor || (setter.uuid && setter.uuid == actor?.uuid)) {
      continue;
    }

    for (const item of itemsOf(setter)) {
      rulesOf(item).forEach((rule, index) => {
        const id = `${setter.uuid}#${item.id}#${index}`;
        if (rule?.type == type && !rule.disabled && rule.scope == scope && rule.mark == key && !seen.has(id)) {
          seen.add(id);
          out.push({ rule, item, index, holder: setter });
        }
      });
    }
  }

  return out;
}

// The marked creature's own rolls, Defenses, numbers and Triggers (rules/links.mjs#linkedEntries).
LINK_SOURCES.push((actor, type) => (CARRIED.includes(type) ? carriedRules(actor, type) : []));

/* -------------------------------------------- */
/*  Rolls against a marked creature              */
/* -------------------------------------------- */

/** RollModifiers on whoever marked the target that reach rolls made against it. */
export function markedTargetSources(actor, target, ctx = {}) {
  const sources = [];
  const consumes = [];
  if (!actor || !target || target === actor || (target.uuid && target.uuid == actor.uuid)) {
    return { sources, consumes };
  }

  const isAttack = ctx.isAttack ?? ctx.item?.type == 'weaponEffect';
  const facts = { ...ctx, isAttack, isMelee: ctx.isMelee ?? (isAttack && ctx.item?.system?.classification?.style == 'melee') };
  for (const { rule, item, index, holder } of carriedRules(target, 'RollModifier', 'markedTarget')) {
    if (rule.late || (rule.limit?.per && usesLeft(holder, rule, item, index) <= 0)) {
      continue;
    }

    if (evaluate(rule.when, contextFor({ ...facts, self: actor, holder, other: target, ruleItem: item })) !== true) {
      continue;
    }

    const shifts = shiftsOf(rule, holder, item, undefined, target, ctx.item);
    if (!shifts.shiftUp && !shifts.shiftDown && !shifts.edge && !shifts.snag) {
      continue;
    }

    if (rule.limit?.per) {
      consumes.push({ ext: 'rulesLimit', actorUuid: holder.uuid, itemId: item.id, index });
    }

    // consumeMark: the roll uses the mark up - on the marked target (default), or consumeFrom roller.
    const from = rule.consumeFrom == 'roller' || rule.consumeFrom == 'self' ? actor : target;
    if (rule.consumeMark && from?.uuid) {
      consumes.push({ ext: 'rulesMark', actorUuid: from.uuid, key: rule.consumeMark });
    }

    sources.push({ id: `${ruleId(item, index)}-mt`, label: ruleLabel(rule, item), ...shifts });
  }

  return { sources, consumes };
}

registerRollSources(markedTargetSources);

/* -------------------------------------------- */
/*  Dealing no damage (DamageModifier negate)    */
/* -------------------------------------------- */

RULE_TYPES.DamageModifier.params.negate = { kind: 'bool' };
{
  const inner = RULE_TYPES.DamageModifier.validate;
  // negate: the holder's hits deal nothing ("can deal no damage") - nothing else is needed.
  RULE_TYPES.DamageModifier.validate = rule => (rule.negate
    ? [...(rule.direction != 'dealt' ? ['negate only applies to damage dealt'] : []), ...(rule.scaled ? ['negate can\'t be scaled'] : [])]
    : inner(rule));
}

/**
 * DamageModifier {direction: dealt, negate: true}: each hit's damage is taken back to 0 on the card (after every
 * other bonus). Its own rules or one a mark carries onto it (Softenblows).
 */
export function negateRider(actor, target, result, rider = {}, tools = {}) {
  if (!result?.damageValue || !tools.damageBonusNote) {
    return;
  }

  const own = rulesOfType(actor, 'DamageModifier', 'self').map(entry => ({ ...entry, holder: actor }));
  for (const { rule, item, holder } of [...own, ...linkedEntries(actor, 'DamageModifier')]) {
    if (!rule.negate || rule.direction != 'dealt') {
      continue;
    }

    const ctx = contextFor({ self: actor, holder, other: target, ruleItem: item, isAttack: true, isMelee: rider.style == 'melee' });
    if (evaluate(rule.when, ctx) === true) {
      tools.damageBonusNote(result, -result.damageValue, ruleLabel(rule, item));
      return;
    }
  }
}

registerHitRider(negateRider);

/* -------------------------------------------- */
/*  Tags, refs and steps                         */
/* -------------------------------------------- */

// target:ruleHolder - the other party is the actor whose item the rule is on (a marked creature rolling at the
// one who marked it: Diversion's Snag).
registerTag('target:ruleHolder', (rest, ctx) => {
  const holder = ctx.holder ?? ctx.ruleItem?.parent ?? null;
  return !!ctx.other && !!holder && (ctx.other === holder || (!!holder.uuid && ctx.other.uuid == holder.uuid));
});

// self:allyOfHolder - this actor is on the same side as the rule's holder (token dispositions), and isn't it.
registerTag('self:allyOfHolder', (rest, ctx) => {
  const holder = ctx.holder ?? ctx.ruleItem?.parent ?? null;
  if (!holder || !ctx.self || holder === ctx.self || (holder.uuid && holder.uuid == ctx.self.uuid)) {
    return false;
  }

  const disposition = actor => actor?.getActiveTokens?.()?.[0]?.document?.disposition ?? actor?.prototypeToken?.disposition ?? null;
  const mine = disposition(ctx.self);
  const theirs = disposition(holder);
  return mine !== null && theirs !== null && mine == theirs;
});

/** The actors (world, and unlinked tokens on the canvas) carrying `setter`'s mark under `key` (any copy). */
export function markedBy(setter, key) {
  const found = new Set();
  const consider = actor => {
    if (actor && liveMarks(actor).some(mark => mark.key == key && mark.by == setter?.uuid)) {
      found.add(actor);
    }
  };

  const actors = globalThis.game?.actors;
  (actors?.contents ?? (actors ? [...actors] : [])).forEach(consider);
  (globalThis.canvas?.tokens?.placeables ?? []).forEach(token => consider(token.actor));
  return [...found];
}

// @marking.<key> - how many creatures carry this actor's <key> mark (Cage's prisoners); self:marking:<key> - some do.
registerRef('marking', (key, scope) => (scope.actor ? markedBy(scope.actor, key).length : 0));
registerTag('self:marking', (rest, ctx) => !!ctx.self && markedBy(ctx.self, rest).length > 0);

/**
 * pickMarked {key, prompt?} - choose one of the creatures carrying this actor's <key> mark (a lone one is taken).
 * It becomes the run's target (`to: target`, {target} in chat); the user's own targets are left alone.
 */
async function pickMarked(step, ctx) {
  const marked = markedBy(ctx.actor, step.key);
  if (!marked.length) {
    return false;
  }

  let chosen = marked[0];
  if (marked.length > 1) {
    const ask = ctx.askPick ?? (async (s, options) => {
      const { chooseSelect } = await import("../../../mechanics/resources/grants.mjs");
      return chooseSelect(ctx.item?.name ?? '', s.prompt ?? T('PickMarked', null, 'Which one?'), options);
    });
    const value = await ask(step, marked.map(actor => ({ value: actor.uuid, label: actor.name })), ctx);
    chosen = marked.find(actor => actor.uuid == value);
  }

  if (!chosen) {
    return false;
  }

  ctx.targets = [chosen];
}

registerStep('pickMarked', pickMarked, { errors: (step, where) => (step.key ? [] : [`${where}: pickMarked needs a key`]) });

/**
 * markHere {key, until?} - a mark on the actor itself that also remembers where its token stands (Bump & Run's
 * "move 10 ft from that spot"); `self:movedSince:<key><op><ft>` measures from there.
 */
async function markHere(step, ctx) {
  const { stampFor } = await import("../../expiry.mjs");
  const token = ctx.actor?.getActiveTokens?.()?.[0];
  const mark = {
    by: ctx.actor?.uuid ?? null, until: step.until ?? null, stamp: step.until ? stampFor(step.until, undefined, ctx.actor) : null,
    x: token?.center?.x ?? null, y: token?.center?.y ?? null,
  };
  if (ctx.actor?.update) {
    await ctx.actor.update({ [`flags.essence20.ruleMarks.${step.key}`]: mark });
  }
}

registerStep('markHere', markHere, { errors: (step, where) => (step.key ? [] : [`${where}: markHere needs a key`]) });

/** Feet the actor's token has moved from the spot a markHere mark remembers (Infinity when it can't tell). */
export function movedSince(actor, key) {
  const mark = actor?.flags?.essence20?.ruleMarks?.[key];
  const to = actor?.getActiveTokens?.()?.[0]?.center;
  if (!mark || mark.x === null || mark.x === undefined || !to) {
    return Infinity;
  }

  const from = { x: mark.x, y: mark.y };
  return globalThis.canvas?.grid?.measurePath ? globalThis.canvas.grid.measurePath([from, to]).distance : Math.hypot(to.x - from.x, to.y - from.y);
}

// self:movedSince:<key><op><ft> - e.g. self:movedSince:bumpRun<10.
registerTag('self:movedSince', (rest, ctx) => {
  const match = /^([\w-]+)(>=|<=|>|<|=)(\d+)$/.exec(rest);
  if (!match || !ctx.self) {
    return null;
  }

  const feet = movedSince(ctx.self, match[1]);
  const want = Number(match[3]);
  return { '>=': feet >= want, '<=': feet <= want, '>': feet > want, '<': feet < want, '=': feet == want }[match[2]];
});
