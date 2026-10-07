import {
  registerApplyDialog, registerConsumer, registerDamageModifier, registerDefenseAdjust, registerDerived, registerDialogToggles, registerHitRider,
  registerMissionAdvanced, registerPreRoll, registerRerollGrant, registerRest, registerRollSources, registerSceneAdvanced,
  registerSpecializes,
} from "../mechanics/item-hooks.mjs";
import { bankedSources, bankedSpecializes, consumeBanked } from "./bank.mjs";
import { recordUse, usesLeft } from "./limits.mjs";
import { ruleHelper } from "./code.mjs";
import { resolveValue } from "./formula.mjs";
import { hostOf, rebuildIndex, ruleId, ruleLabel, rulesOf, rulesOfType } from "./index.mjs";
import { contextFor, evaluate, interpolate, isStatic } from "./predicate.mjs";
import { canAfford, readResource } from "./steps.mjs";
import { linkedEntries } from "./links.mjs";
import { chosenList, chosenOf } from "./choice-read.mjs";

/**
 * The rules of a type that change this actor: its own (in the given scopes) and any reaching it from
 * a linked actor (rules/links.mjs). Each carries `holder` - the actor whose item it is - which is what
 * its formulas read.
 */
function affecting(actor, type, scopes = ['self']) {
  const own = scopes.flatMap(scope => rulesOfType(actor, type, scope)).map(entry => ({ ...entry, holder: actor }));
  return [...own, ...linkedEntries(actor, type)];
}

/**
 * The rules engine's one connection to the rest of the system (docs/RULES_ENGINE_PLAN.md §6).
 *
 * Item rules don't get hook sites of their own. This file registers once into the same extension
 * registry the hand-written Perk slices use (mechanics/item-hooks.mjs), and each registration reads
 * the actor's rule index (rules/index.mjs) instead of checking compendium ids. The roll pipeline
 * doesn't know rules exist.
 *
 * Scopes:
 *  - self      the rule changes its own actor's rolls, Defenses, damage and numbers;
 *  - incoming  the rule sits on a defender and changes rolls made against them;
 *  - host      the rule sits on an upgrade and applies to rolls made with the item it's attached to
 *              (or that item's own weapon effects), and to that item's numbers.
 *
 * A rule whose condition can't be known (an `ask:` tag, an unrecognised tag) is never applied
 * automatically - it becomes a Roll Options Dialog switch, off by default.
 */

/* -------------------------------------------- */
/*  Shared                                       */
/* -------------------------------------------- */

function firstTarget() {
  const targets = globalThis.game?.user?.targets;
  const first = targets?.first?.() ?? (typeof targets?.[Symbol.iterator] == 'function' ? [...targets][0] : null);
  return first?.actor ?? null;
}

/** The roll facts the dialog hooks aren't handed - derived the way dice.mjs derives them. */
function rollFacts(item, ctx = {}) {
  const isAttack = ctx.isAttack ?? item?.type == 'weaponEffect';
  return {
    isAttack,
    isMelee: ctx.isMelee ?? (isAttack && item?.system?.classification?.style == 'melee'),
  };
}

/** Whether a host-scoped rule's upgrade is attached to the item rolled (or that item's weapon). */
export function hostMatches(ruleItem, item) {
  const host = hostOf(ruleItem);
  if (!host || !item) {
    return false;
  }

  return item.id == host.id || item.flags?.essence20?.parentId == host.id;
}

/**
 * Every roll-changing rule that bears on this roll, with its condition's answer.
 * @param {Actor} actor    The roller.
 * @param {Actor} target   The roll's target, if any.
 * @param {Object} roll    {item, rolledSkill, rolledEssence, isAttack, isMelee, dataset}
 * @param {Array<String>} types   Rule types to gather.
 * @returns {Array<{rule, item, index, answer, owner}>}
 */
export function rollRules(actor, target, roll, types = ['RollModifier']) {
  const out = [];
  // roll:targets reads how many tokens the user has targeted for this roll (afterRoll Triggers count the hits instead).
  const facts = { targetCount: globalThis.game?.user?.targets?.size, ...roll, ...rollFacts(roll.item, roll) };
  for (const type of types) {
    for (const entry of affecting(actor, type, ['self', 'host'])) {
      if ((entry.rule.scope ?? 'self') == 'host' && !hostMatches(entry.item, roll.item)) {
        continue;
      }

      // holder: the actor whose item it is (another actor for a linked rule - holder: tags).
      const ctx = contextFor({ ...facts, self: actor, holder: entry.holder, ruleItem: entry.item, other: target });
      // A modifier with a limit stops applying once its uses are spent (spent when a roll takes it).
      const spent = entry.rule.limit?.per && usesLeft(entry.holder, entry.rule, entry.item, entry.index) <= 0;
      out.push({ ...entry, owner: entry.holder, answer: spent ? false : evaluate(entry.rule.when, ctx) });
    }

    if (target && type == 'RollModifier') {
      for (const entry of rulesOfType(target, type, 'incoming')) {
        const ctx = contextFor({ ...facts, self: target, ruleItem: entry.item, other: actor });
        // The same limit check as the roller's own rules - counted on the defender who holds it.
        const spent = entry.rule.limit?.per && usesLeft(target, entry.rule, entry.item, entry.index) <= 0;
        out.push({ ...entry, owner: target, answer: spent ? false : evaluate(entry.rule.when, ctx) });
      }
    }
  }

  return out;
}

/** A RollModifier/DialogSwitch's shifts, resolved against its own actor and item. */
export function shiftsOf(rule, owner, item, vars = undefined, other = null, rolled = null) {
  // vars: {spent} for a switch that spends an amount (@spent); other: the roll's target (@target.*); rolled: the
  // item the roll is made with (@rolled.*).
  const scope = { actor: owner, item, vars, other, rolled };
  return {
    shiftUp: Math.max(0, Math.round(resolveValue(rule.upshift, scope))),
    shiftDown: Math.max(0, Math.round(resolveValue(rule.downshift, scope))),
    edge: !!rule.edge,
    snag: !!rule.snag,
    specialize: !!rule.specialize,
  };
}

/**
 * Call one hook on every Code rule's helper (rules/code.mjs). A rule whose condition is known false
 * is skipped; a helper that isn't registered (yet) does nothing. One failing helper can't stop a roll.
 * @returns {Array<*>}   What each helper returned.
 */
export function callCodeHelpers(actor, hook, ...args) {
  const out = [];
  for (const { rule, item } of rulesOfType(actor, 'Code')) {
    const fn = ruleHelper(rule.helper)?.[hook];
    if (typeof fn != 'function' || evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) === false) {
      continue;
    }

    try {
      out.push(fn(...args, { rule, item }));
    } catch (error) {
      console.error(`Essence20 | rule helper "${rule.helper}" failed in ${hook}`, error);
    }
  }

  return out;
}

/* -------------------------------------------- */
/*  Rolls                                        */
/* -------------------------------------------- */

/**
 * Only the strongest rule of each stacking group counts (`stack: "armor"`) - the sum of its shifts,
 * with Edge worth one. Rules with no group all count.
 */
export function strongestPerGroup(entries, strength) {
  const best = new Map();
  const out = [];
  for (const entry of entries) {
    const group = entry.rule.stack;
    if (!group) {
      out.push(entry);
      continue;
    }

    const current = best.get(group);
    if (!current || strength(entry) > strength(current)) {
      best.set(group, entry);
    }
  }

  return [...out, ...best.values()];
}

const shiftStrength = ({ rule, owner, item, other }) => {
  const s = shiftsOf(rule, owner, item, undefined, other);
  return s.shiftUp - s.shiftDown + (s.edge ? 1 : 0) - (s.snag ? 1 : 0);
};

/** Automatic modifiers, listed with their source in the Roll Options Dialog. */
export function ruleRollSources(actor, target, ctx = {}) {
  const sources = [];
  const live = rollRules(actor, target, ctx).filter(entry => entry.answer === true && !entry.rule.late);
  const consumes = [];
  for (const { rule, item, index, owner } of strongestPerGroup(live.map(entry => ({ ...entry, other: target })), shiftStrength)) {
    if (rule.limit?.per) {
      consumes.push({ ext: 'rulesLimit', actorUuid: owner.uuid, itemId: item.id, index });
    }

    // consumeMark: the mark this modifier reads is used up by the roll (on the roller, or consumeFrom: target).
    // consumeFrom roller: the actor rolling (a rule a mark carried onto it - rules/plugins/marks/rule-marks.mjs).
    const marked = rule.consumeMark ? (rule.consumeFrom == 'target' ? target : rule.consumeFrom == 'roller' ? actor : owner) : null;
    if (marked?.uuid) {
      // consumeCount (round 16, part b - rules/plugins/marks/counted-marks.mjs): one off the mark's count instead.
      // consumeOwn (round 16, part a - rules/plugins/rolls/once-per-roll.mjs): only the copy this rule's holder set (a perSetter mark).
      consumes.push({ ext: rule.consumeCount ? 'rulesMarkOne' : rule.consumeOwn ? 'rulesMarkOwn' : 'rulesMark', actorUuid: marked.uuid, key: rule.consumeMark,
        ...(rule.consumeOwn ? { setterId: owner?.id ?? null } : {}) });
    }

    const shifts = shiftsOf(rule, owner, item, undefined, target, ctx.item);
    if (!shifts.shiftUp && !shifts.shiftDown && !shifts.edge && !shifts.snag) {
      continue;
    }

    // key (round 16, part a): a listed modifier's key travels with the roll (roll:switch:<key> - dice.mjs adds it).
    sources.push({ id: ruleId(item, index), label: ruleLabel(rule, item), ...shifts, ...(rule.key ? { key: rule.key } : {}) });
  }

  for (const result of callCodeHelpers(actor, 'rollSources', actor, target, ctx)) {
    sources.push(...(result?.sources ?? []));
  }

  // Bonuses a Use or Trigger banked for a later roll (rules/bank.mjs), used up when the roll is made.
  const banked = bankedSources(actor, target, { ...ctx, ...rollFacts(ctx.item, ctx) });
  sources.push(...banked.sources);
  return { sources, consumes: [...consumes, ...banked.consumes] };
}

/**
 * Immunity (`immune: ["snag", "downshift"]`): once the dialog closes, a RollModifier whose condition
 * holds clears the Snag or the downshifts from the roll - after everything else has added them.
 */
export function applyRuleImmunity(actor, options, ctx = {}) {
  // Late RollModifiers first: decided now, against the Defense the dialog settled on.
  const target = firstTarget();
  // dialog: what the dialog closed with (roll:rolePointsDamage - rules/plugins/rolls/role-points-damage.mjs).
  const late = { ...ctx, dialog: options ?? null, defenseType: options?.defenseType ?? ctx.dataset?.defenseType ?? ctx.defenseType };
  for (const { rule, answer, owner, item, index } of rollRules(actor, target, late)) {
    if (!rule.late || answer !== true) {
      continue;
    }

    const shifts = shiftsOf(rule, owner, item, undefined, target);
    options.shiftUp = (Number(options.shiftUp) || 0) + shifts.shiftUp;
    options.shiftDown = (Number(options.shiftDown) || 0) + shifts.shiftDown;
    options.edge ||= shifts.edge;
    options.snag ||= shifts.snag;
    options.isSpecialized ||= shifts.specialize;
    if (rule.limit?.per) {
      recordUse(owner, rule, item, index);
    }
  }

  const kinds = new Set();
  let ignore = 0;
  for (const { rule, answer, owner, item } of rollRules(actor, target, late)) {
    if (answer === true) {
      ignore += Math.max(0, Math.round(resolveValue(rule.ignoreDownshift ?? 0, { actor: owner, item })));
      for (const kind of rule.immune ?? []) {
        kinds.add(kind);
      }
    }
  }

  if (kinds.has('snag')) {
    options.snag = false;
  }

  if (kinds.has('downshift')) {
    options.shiftDown = 0;
  }

  // "Ignore the first ↓1" - a set number of downshifts off, never below none.
  if (ignore > 0) {
    options.shiftDown = Math.max(0, (Number(options.shiftDown) || 0) - ignore);
  }
}

/**
 * Whether a rule lifts the automatic untrained Snag on this Skill (immune: ["untrainedSnag"]) -
 * asked by mechanics/rolls/roll-dialog.mjs#_isUntrainedSnag, before the dialog opens.
 */
/**
 * Whether a rule lifts the automatic long-range Snag on this ranged attack (immune: ["longRangeSnag"]) -
 * read where dice.mjs adds that Snag, so Nowhere to Run can still see that it is already ignored.
 */
export function ruleNoLongRangeSnag(actor, target, roll = {}) {
  return rollRules(actor, target, roll).some(({ rule, answer }) => answer === true && (rule.immune ?? []).includes('longRangeSnag'));
}

export function ruleNoUntrainedSnag(actor, skill) {
  return rollRules(actor, null, { rolledSkill: skill }).some(({ rule, answer }) => answer === true && (rule.immune ?? []).includes('untrainedSnag'));
}

/** A roll took a limited modifier: count the use against its rule's limit. */
export async function consumeLimited(consume, load = uuid => globalThis.fromUuid?.(uuid)) {
  const actor = await load(consume?.actorUuid);
  const item = actor?.items?.get?.(consume.itemId);
  const rule = item?.system?.rules?.[consume.index];
  if (rule) {
    await recordUse(actor, rule, item, consume.index);
  }
}

/** A RollModifier with `specialize` makes the roll count as Specialized. */
export function ruleSpecializes(actor, skill, item, dataset) {
  // dice.mjs hands over the Essence it settled on (Academic Studies and friends included) as
  // dataset.rolledEssence; otherwise fall back to the dataset's own or the Skill's usual one.
  const rolledEssence = dataset?.rolledEssence ?? dataset?.essence ?? globalThis.CONFIG?.E20?.skillToEssence?.[skill];
  const roll = { item, rolledSkill: skill, rolledEssence, dataset };
  const target = firstTarget();
  return rollRules(actor, target, roll).some(({ rule, answer }) => rule.specialize && answer === true) || bankedSpecializes(actor, target, roll);
}

/** The state this actor last left a rule switch in (flags.essence20.ruleSwitches), or undefined. */
export function rememberedSwitch(actor, name) {
  const value = actor?.flags?.essence20?.ruleSwitches?.[name];
  return typeof value == 'boolean' ? value : undefined;
}

/**
 * The switches: every DialogSwitch whose condition isn't false, and every rule that has to ask. Each
 * starts where this actor last left it, else at its default (a DialogSwitch's own, off for the rest).
 */
export function ruleDialogSwitches(actor, ctx = {}) {
  const switches = [];
  for (const entry of rollRules(actor, firstTarget(), ctx, ['DialogSwitch', 'RollModifier'])) {
    const { rule, item, index, answer, owner } = entry;
    if (answer === false || (rule.type == 'RollModifier' && (answer === true || rule.late))) {
      continue;
    }

    // "Roll <Skill> instead" only for a Skill the actor has, and not on that Skill's own roll.
    if (rule.useSkill && (!actor?.system?.skills?.[useSkillOf(rule, actor)] || useSkillOf(rule, actor) == ctx.rolledSkill)) {
      continue;
    }

    // A switch that spends an amount (spend: {resource, max}): a number box, 0 up to what can be paid.
    // With no resource it's a plain 0..max box (nothing is paid).
    if (rule.type == 'DialogSwitch' && (rule.spend?.resource || rule.spend?.max !== undefined)) {
      const have = rule.spend.resource ? readResource(rule.spend.resource, { actor: owner, item }) : Infinity;
      const max = Math.min(have, rule.spend.max === undefined ? Infinity : Math.round(resolveValue(rule.spend.max, { actor: owner, item }, 0)));
      if (max > 0) {
        switches.push({ name: ruleId(item, index), label: ruleLabel(rule, item), type: 'number', value: 0, max, entry: { rule, item, owner, index, max } });
      }

      continue;
    }

    // A switch that costs something is offered only when it can be paid, and never starts ticked.
    const cost = rule.type == 'DialogSwitch' ? rule.cost : null;
    if (cost?.resource && !canAfford(cost.resource, Math.round(resolveValue(cost.amount ?? 1, { actor: owner, item }, 1)), { actor: owner, item })) {
      continue;
    }

    switches.push({
      name: ruleId(item, index),
      // {holder}: the name of the actor holding a linked switch (an ally's Ladder - scope alliesAnywhere).
      label: ruleLabel(rule, item).replace(/\{holder\}/g, owner?.name ?? ''),
      type: 'checkbox',
      // A DialogSwitch starts at its own default; a RollModifier that has to ask starts off unless it
      // says `default: true`.
      // forget (or a limit): always starts at its default, like a plain one-roll checkbox. defaultWhen:
      // starts ticked when those tags are known true (City Slicker in an urban scene).
      value: cost?.resource ? false : rule.forget || rule.limit
        ? !!rule.default || switchDefaultHolds(rule, actor, item, ctx)
        : rememberedSwitch(actor, ruleId(item, index)) ?? (!!rule.default || switchDefaultHolds(rule, actor, item, ctx)),
      entry: { rule, item, owner, index },
    });
  }

  return switches;
}

/** Whether a DialogSwitch's defaultWhen tags are known true for this roll. */
function switchDefaultHolds(rule, actor, item, ctx = {}) {
  if (!Array.isArray(rule.defaultWhen) || !rule.defaultWhen.length) {
    return false;
  }

  return evaluate(rule.defaultWhen, contextFor({ ...ctx, ...rollFacts(ctx.item, ctx), self: actor, ruleItem: item, other: firstTarget() })) === true;
}

/**
 * What the ticked switches do, once the dialog closes - and remember each switch's state for the
 * next roll. The options change before the first await, so a caller that doesn't wait still sees them.
 */
export async function applyRuleSwitches(actor, options, ctx = {}) {
  const ticked = options?.ext ?? {};
  const remember = {};
  const on = [];
  for (const { name, value, entry } of ruleDialogSwitches(actor, ctx)) {
    // An amount to spend: on when above 0, never remembered.
    if (entry.rule.spend?.resource || entry.rule.spend?.max !== undefined) {
      const spent = Math.max(0, Math.min(entry.max, Math.round(Number(ticked[name]) || 0)));
      if (spent > 0) {
        on.push({ ...entry, spent });
      }

      continue;
    }

    if (!!ticked[name] != value) {
      remember[`flags.essence20.ruleSwitches.${name}`] = !!ticked[name];
    }

    if (ticked[name]) {
      on.push(entry);
      // "Instead of the normal benefits of Aim": the Aiming switch's bonus is not added (dice.mjs).
      if (entry.rule.replacesAim) {
        options.isAiming = false;
      }
    }
  }

  // Switches sharing a `stack` group are alternatives ("↑2 or ↑1"): of those ticked, only the
  // biggest change counts.
  for (const entry of strongestPerGroup(on, e => Math.abs(shiftStrength(e)))) {
    const shifts = shiftsOf(entry.rule, entry.owner, entry.item, entry.spent ? { spent: entry.spent } : undefined, firstTarget());
    options.shiftUp = (Number(options.shiftUp) || 0) + shifts.shiftUp;
    options.shiftDown = (Number(options.shiftDown) || 0) + shifts.shiftDown;
    options.edge ||= shifts.edge;
    options.snag ||= shifts.snag;
    options.isSpecialized ||= shifts.specialize;
    // clearSnag: the switch's Edge wins outright - the Snag goes, rather than the two cancelling.
    if (entry.rule.clearSnag) {
      options.snag = false;
    }
  }

  // "Roll <Skill> instead": the difference between the two Skills' dice, as shifts (the first ticked one).
  const swap = on.find(entry => entry.rule.useSkill);
  const rolledShift = ctx.baseShift ?? actor?.system?.skills?.[ctx.rolledSkill]?.shift;
  if (swap && rolledShift) {
    const list = globalThis.CONFIG?.E20?.skillShiftList ?? [];
    const from = list.indexOf(rolledShift);
    const to = list.indexOf(actor.system.skills[useSkillOf(swap.rule, actor)]?.shift);
    if (from >= 0 && to >= 0 && from != to) {
      options[from > to ? 'shiftUp' : 'shiftDown'] = (Number(options[from > to ? 'shiftUp' : 'shiftDown']) || 0) + Math.abs(from - to);
    }
  }

  // A ticked switch's key travels with the roll (riderContext.switches) for hit / miss / afterRoll
  // Triggers to ask about: roll:switch:<key> - the "declare it, then something happens on a hit" checkboxes.
  for (const entry of on) {
    if (entry.rule.key) {
      options.ruleKeys = [...new Set([...(options.ruleKeys ?? []), entry.rule.key])];
    }

    // noDamage: the attack forgoes its damage (dice.mjs: no damage, secondary damage or Critical damage options).
    if (entry.rule.noDamage) {
      options.ruleNoDamage = true;
    }

    // syntheticDamage {value, type}: a Skill Test (not an attack) deals this on its card (rules/plugins/dialog/switch-synthetic-damage.mjs).
    if (entry.rule.syntheticDamage && !options.ruleSyntheticDamage) {
      options.ruleSyntheticDamage = { value: Number(entry.rule.syntheticDamage.value) || 0, type: entry.rule.syntheticDamage.type };
    }

    // noCrit: the roll can't crit (dice.mjs suppressCrit); capDie: the final die stops there (rules/plugins/rolls/die-facts.mjs).
    if (entry.rule.noCrit) {
      options.suppressCrit = true;
    }

    if (entry.rule.capDie) {
      options.ruleCapDie = entry.rule.capDie;
    }

    // sneakAttackMultiplier: the damage bonus x N when Sneak Attack Damage applies (rules/plugins/rolls/role-points-damage.mjs).
    if (entry.rule.sneakAttackMultiplier) {
      const times = Math.round(resolveValue(entry.rule.sneakAttackMultiplier, { actor: entry.owner, item: entry.item }, 1));
      if (times > (Number(options.ruleSneakAttackMultiplier) || 1)) {
        options.ruleSneakAttackMultiplier = times;
        options.ruleSneakAttackSource = ruleLabel(entry.rule, entry.item);
      }
    }
  }

  // Ticked switches' damage joins the attack's own damage bonus (dice.mjs damageBonusValue). @rolled.<path> reads the
  // item the roll is made with (Penetrating Shot: the weapon's damage once more per extra Volley shot).
  for (const entry of on) {
    const damage = entry.rule.type == 'DialogSwitch' && entry.rule.damage
      ? Math.round(resolveValue(entry.rule.damage, { actor: entry.owner, item: entry.item, vars: { spent: entry.spent ?? 0 }, rolled: ctx.item ?? null }, 0)) : 0;
    if (damage) {
      options.ruleDamage = (Number(options.ruleDamage) || 0) + damage;
      options.ruleDamageSources = [...(options.ruleDamageSources ?? []), ruleLabel(entry.rule, entry.item)];
    }
  }

  if (Object.keys(remember).length && actor?.isOwner && typeof actor.update == 'function') {
    await actor.update(remember);
  }

  // A ticked switch with a limit (once per round...) uses one up.
  for (const { rule, item, owner, index } of on) {
    if (rule.limit?.per && index !== undefined) {
      await recordUse(owner ?? actor, rule, item, index);
    }
  }

  // Amounts spent are paid now.
  for (const entry of on.filter(e => e.spent && e.rule.spend.resource)) {
    const { changeResource } = await import("./steps.mjs");
    await changeResource(entry.rule.spend.resource, -entry.spent, { actor: entry.owner ?? actor, item: entry.item, chat: [] });
  }

  // Ticked switches' own steps run now, as the roll is made (a Hang-Up triggered, a bank...).
  for (const entry of on.filter(e => e.rule.steps?.length)) {
    const { runSteps, stepContext } = await import("./steps.mjs");
    const targets = [...(globalThis.game?.user?.targets ?? [])].map(token => token.actor).filter(Boolean);
    const stepCtx = stepContext({ actor: entry.owner ?? actor, item: entry.item, rule: entry.rule, targets });
    // A switch that spent an amount hands it to its steps as @spent / @var.spent (Caution To The Wind's banked -N).
    if (entry.spent !== undefined) {
      stepCtx.vars.spent = entry.spent;
    }

    await runSteps(entry.rule.steps, stepCtx);
    if (stepCtx.chat.length) {
      await globalThis.ChatMessage?.create?.({ speaker: globalThis.ChatMessage.getSpeaker?.({ actor: entry.owner ?? actor }), content: stepCtx.chat.join('<br>') });
    }
  }

  // Ticked switches that cost something are paid now.
  for (const entry of on) {
    const cost = entry.rule.type == 'DialogSwitch' ? entry.rule.cost : null;
    if (cost?.resource) {
      const { changeResource } = await import("./steps.mjs");
      const amount = Math.round(resolveValue(cost.amount ?? 1, { actor: entry.owner, item: entry.item }, 1));
      await changeResource(cost.resource, -amount, { actor: entry.owner ?? actor, item: entry.item, chat: [] });
    }
  }
}

/**
 * A DialogSwitch's useSkill: a Skill key, or "choiceOf:<uuid>" - the Skill chosen (rules/choice-read.mjs) on the actor's copy of
 * that item (Kind, But Firm's Empathy Skill); null when there's no such choice.
 */
function useSkillOf(rule, actor) {
  const want = String(rule?.useSkill ?? '');
  if (!want.startsWith('choiceOf:')) {
    return want;
  }

  const uuid = want.slice(9);
  const items = actor?.items?.contents ?? (actor?.items ? [...actor.items] : []);
  const source = item => item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource;
  return chosenOf(items.find(item => source(item) == uuid || item.uuid == uuid)) || null;
}

/** Lower index in skillShiftList = better. */
function shiftRank(actor, skill) {
  const list = globalThis.CONFIG?.E20?.skillShiftList ?? [];
  const index = list.indexOf(actor?.system?.skills?.[skill]?.shift);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

/** SkillSubstitution: use one Skill in place of another, or the better of the two. Mutates dataset. */
export function applySkillSubstitution(actor, dataset, item) {
  if (!dataset?.skill) {
    return null;
  }

  // The roller's own rules, then (scope item) the rolled item's own - whoever rolls it.
  const onItem = rulesOf(item).filter(rule => rule?.type == 'SkillSubstitution' && rule.scope == 'item' && !rule.disabled)
    .map(rule => ({ rule, item }));
  for (const { rule, item: ruleItem } of [...affecting(actor, 'SkillSubstitution', ['self', 'host']), ...onItem]) {
    // stage: attack - swapped earlier, as the attack's dataset is built (rules/plugins/rolls/attack-skill-substitution.mjs).
    if (((rule.scope ?? 'self') == 'host' && !hostMatches(ruleItem, item)) || rule.stage == 'attack') {
      continue;
    }

    const from = interpolate(String(rule.from ?? ''), ruleItem);
    const to = interpolate(String(rule.to ?? ''), ruleItem);
    if (!from || !to || (from != '*' && from != dataset.skill) || to == dataset.skill) {
      continue;
    }

    const ctx = contextFor({ ...rollFacts(item), item, rolledSkill: dataset.skill, dataset, self: actor, ruleItem, other: firstTarget() });
    if (evaluate(rule.when, ctx) !== true) {
      continue;
    }

    if (rule.mode == 'bestOf' && shiftRank(actor, to) >= shiftRank(actor, dataset.skill)) {
      continue;
    }

    dataset.skill = to;
    dataset.essence = globalThis.CONFIG?.E20?.skillToEssence?.[to] ?? dataset.essence;
    if (dataset.shift && actor.system?.skills?.[to]) {
      dataset.shift = actor.system.skills[to].shift;
    }

    return to;
  }

  return null;
}

/* -------------------------------------------- */
/*  Defenses, numbers and damage                 */
/* -------------------------------------------- */

const DEFENSES = ['toughness', 'evasion', 'willpower', 'cleverness'];

function addToDefense(defense, amount, label) {
  if (!defense || !amount) {
    return;
  }

  defense.total = (Number(defense.total) || 0) + amount;
  if (typeof defense.string == 'string') {
    defense.string += ` ${amount < 0 ? '-' : '+'} ${Math.abs(amount)} (${label})`;
  }
}

/** A conditional Defense rule on the defender: what it adds against this roll. */
/** Whether a Defense rule is decided per attack rather than added to the sheet. */
export function isRollTimeDefense(rule) {
  // early: decided in dice.mjs's per-attack loop (rules/plugins/combat/early-defense.mjs), never on the sheet.
  return !isStatic(rule.when) || (rule.mode ?? 'add') != 'add' || !!rule.outgoing || !!rule.limit || !!rule.early;
}

export function ruleDefenseAdjust(attacker, defender, defenseType, ctx = {}) {
  let total = 0;
  const current = Number(ctx.difficulty) || 0;
  const reshape = [];
  // The defender's own rules, then the attacker's outgoing ones (self = the attacker, other = the target).
  const entries = [
    ...affecting(defender, 'Defense').filter(({ rule }) => !rule.outgoing).map(entry => ({ ...entry, self: defender, other: attacker })),
    ...(attacker ? affecting(attacker, 'Defense').filter(({ rule }) => rule.outgoing).map(entry => ({ ...entry, self: attacker, other: defender })) : []),
  ];
  for (const { rule, item, holder, index, self, other } of entries) {
    if (!isRollTimeDefense(rule) || rule.early || (rule.defense != 'any' && rule.defense != defenseType)) {
      continue;
    }

    if (rule.limit?.per && usesLeft(holder, rule, item, index) <= 0) {
      continue;
    }

    // holder: the actor whose item it is - another actor for an aura / party rule (holder: tags).
    const answer = evaluate(rule.when, contextFor({ ...ctx, ...rollFacts(ctx.item, ctx), defenseType, self, holder, ruleItem: item, other }));
    if (answer !== true) {
      continue;
    }

    if (rule.limit?.per) {
      recordUse(holder, rule, item, index);
    }

    if ((rule.mode ?? 'add') == 'add') {
      total += Math.round(resolveValue(rule.amount, { actor: holder, item, other }));
    } else {
      reshape.push(rule);
    }
  }

  for (const value of callCodeHelpers(defender, 'defenseAdjust', attacker, defender, defenseType, ctx)) {
    total += Number(value) || 0;
  }

  // best / halve / fail act on the Defense as it stands with the additions: best first, then halve, then fail.
  let value = current + total;
  for (const rule of reshape.filter(r => r.mode == 'best')) {
    for (const key of rule.from) {
      value = Math.max(value, Number(defender?.system?.defenses?.[key]?.total) || 0);
    }
  }

  if (reshape.some(r => r.mode == 'halve')) {
    value = Math.ceil(value / 2);
  }

  if (reshape.some(r => r.mode == 'fail')) {
    return Infinity;
  }

  return value - current;
}

function applyOp(current, op, value) {
  const base = Number(current) || 0;
  switch (op) {
  case 'set': return value;
  case 'multiply': return base * value;
  case 'max': return Math.max(base, value);
  case 'min': return Math.min(base, value);
  }

  return base + value;
}

/** Set a number at a path, and note an addition on a sibling `.string` breakdown when there is one. */
function writeNumber(target, path, op, value, label) {
  const getProperty = globalThis.foundry?.utils?.getProperty ?? ((object, key) => key.split('.').reduce((o, k) => o?.[k], object));
  const setProperty = globalThis.foundry?.utils?.setProperty ?? ((object, key, v) => {
    const keys = key.split('.');
    const last = keys.pop();
    const parent = keys.reduce((o, k) => (o[k] ??= {}), object);
    parent[last] = v;
  });
  const current = getProperty(target, path);
  if (current !== undefined && typeof current != 'number' && !Number.isFinite(Number(current))) {
    return;
  }

  setProperty(target, path, applyOp(current, op, value));
  const stringPath = path.replace(/\.(max|total|value)$/, '.string');
  if ((op ?? 'add') == 'add') {
    const breakdown = stringPath != path ? getProperty(target, stringPath) : undefined;
    if (typeof breakdown == 'string' && value) {
      setProperty(target, stringPath, `${breakdown} ${value < 0 ? '-' : '+'} ${Math.abs(value)} (${label})`);
    }
  }
}

/**
 * Critical Effects from CriticalOption rules (mechanics/combat/target-riders.mjs#critRiders): the options to
 * add, and how many steps to improve the damage ones by (the strongest per `stack` group).
 * @param {Actor} actor     The attacker.
 * @param {Actor} target
 * @param {Item} item       The weapon effect that scored the Critical Success.
 * @returns {{options: Object[], improve: Number, improvedBy: String[]}}
 */
export function ruleCriticalOptions(actor, target, item) {
  const facts = { item, isAttack: true, isMelee: item?.system?.classification?.style == 'melee' };
  const holding = rulesOfType(actor, 'CriticalOption', 'self')
    .filter(({ rule, item: ruleItem }) => evaluate(rule.when, contextFor({ ...facts, self: actor, other: target, ruleItem })) === true);
  const options = [];
  const improvers = [];
  for (const entry of holding) {
    const { rule, item: ruleItem } = entry;
    if (rule.improve !== undefined) {
      improvers.push(entry);
      continue;
    }

    options.push({
      key: `rule-${ruleItem.id}-${entry.index}`,
      label: ruleLabel(rule, ruleItem),
      damageValue: Math.max(0, Math.round(resolveValue(rule.damageValue ?? 1, { actor, item: ruleItem }, 1))),
      damageType: rule.essence || rule.defense || rule.status || rule.effect ? 'special' : rule.damageType,
      ...(rule.essence ? { essence: rule.essence } : {}),
      // defense: 1 damage to that Defense (rules/plugins/combat/crit-defense-option.mjs).
      ...(rule.defense ? { defense: rule.defense } : {}),
      ...(rule.status ? { status: rule.status } : {}),
      ...(rule.effect ? { rider: rule.effect } : {}),
    });
  }

  const chosen = strongestPerGroup(improvers, e => resolveValue(e.rule.improve, { actor, item: e.item }, 0));
  return {
    options,
    improve: chosen.reduce((sum, e) => sum + Math.max(0, Math.round(resolveValue(e.rule.improve, { actor, item: e.item }, 0))), 0),
    improvedBy: chosen.map(e => ruleLabel(e.rule, e.item)),
  };
}

/** The rules of a type on this actor whose own condition holds (self tags only). */
function heldRules(actor, type) {
  return rulesOfType(actor, type, 'self').filter(({ rule, item }) => evaluate(rule.when, contextFor({ self: actor, ruleItem: item, combat: null })) === true);
}

/**
 * Traits WeaponTrait rules give this weapon (mechanics/combat/weapon-traits.mjs#perkGrantedTraits).
 * @param {Actor} actor
 * @param {Item} weapon
 * @param {String[]} traits   Its traits so far - `items` tags see these.
 * @returns {String[]}
 */
export function ruleWeaponTraits(actor, weapon, traits) {
  const seen = { ...weapon, id: weapon?.id, uuid: weapon?.uuid, name: weapon?.name, flags: weapon?.flags, parent: weapon?.parent, system: { ...(weapon?.system ?? {}), traits } };
  const out = [];
  for (const { rule, item } of heldRules(actor, 'WeaponTrait')) {
    if (!Array.isArray(rule.items) || !rule.items.length || evaluate(rule.items, contextFor({ self: actor, item: seen, ruleItem: item, combat: null })) === true) {
      out.push(...(rule.traits ?? []));
    }
  }

  return out;
}

/**
 * Hardpoints rules: {external, integrated, nonWeapon, perWeapon} to add. Read while the actor's
 * loadout is prepared, before the derived pass - so the index is rebuilt first.
 */
export function ruleHardpoints(actor) {
  rebuildIndex(actor);
  const out = { external: 0, integrated: 0, nonWeapon: 0, perWeapon: 0 };
  for (const { rule, item } of heldRules(actor, 'Hardpoints')) {
    for (const key of Object.keys(out)) {
      out[key] += Math.round(resolveValue(rule[key] ?? 0, { actor, item }, 0));
    }
  }

  return out;
}

/** Whether a Hardpoints rule makes this Integrated weapon fire as Reinforced. */
export function ruleFiresAsReinforced(actor, weapon) {
  return heldRules(actor, 'Hardpoints').some(({ rule, item }) => rule.reinforced
    && (!Array.isArray(rule.items) || !rule.items.length || evaluate(rule.items, contextFor({ self: actor, item: weapon, ruleItem: item, combat: null })) === true));
}

/**
 * AttackCount rules that apply to this attack: [{count?, additional?, label}] (mechanics/actions/action-perks.mjs
 * #getAttacksPerAction picks the best count and adds the additional ones).
 * @param {Actor} actor
 * @param {Item} item   The weapon effect being attacked with.
 */
export function ruleAttackCounts(actor, item) {
  const facts = { item, isAttack: true, isMelee: item?.system?.classification?.style == 'melee' };
  return affecting(actor, 'AttackCount')
    .filter(({ rule, item: ruleItem }) => evaluate(rule.when, contextFor({ ...facts, self: actor, ruleItem })) === true)
    .map(({ rule, item: ruleItem, holder }) => {
      const scope = { actor: holder, item: ruleItem };
      const when = Array.isArray(rule.when) && rule.when.length ? rule.when : null;
      return rule.additional !== undefined
        ? { additional: Math.max(0, Math.round(resolveValue(rule.additional, scope, 0))), label: ruleLabel(rule, ruleItem), when }
        : { count: Math.max(1, Math.round(resolveValue(rule.count, scope, 1))), label: ruleLabel(rule, ruleItem), when };
    });
}

/** Whether a CritOnD2 rule lets this roll critically succeed on the d2. */
export function ruleCritD2(actor, target, roll = {}) {
  return affecting(actor, 'CritOnD2', ['self', 'host']).some(({ rule, item }) => ((rule.scope ?? 'self') != 'host' || hostMatches(item, roll.item))
    && evaluate(rule.when, contextFor({ ...roll, ...rollFacts(roll.item, roll), self: actor, other: target, ruleItem: item })) === true);
}

/** A DamageType rule's damage type for this attack (the first whose condition holds), or null. */
export function ruleDamageType(actor, target, roll = {}) {
  for (const { rule, item } of affecting(actor, 'DamageType', ['self', 'host'])) {
    if ((rule.scope ?? 'self') == 'host' && !hostMatches(item, roll.item)) {
      continue;
    }

    if (evaluate(rule.when, contextFor({ ...roll, ...rollFacts(roll.item, roll), self: actor, other: target, ruleItem: item })) === true) {
      const type = rule.to == 'choice' ? chosenOf(item) : rule.to;
      if (type) {
        return type;
      }
    }
  }

  return null;
}

/**
 * RollDice rules, once the final die is known: a d20 floor, a third d20, a die cap and steps up.
 * @returns {{d20Floor: Number, thirdD20: Boolean, maxDie: ?String, stepUp: Number}}
 */
export function ruleRollDice(actor, target, roll = {}) {
  const list = globalThis.CONFIG?.E20?.skillShiftList ?? [];
  const out = { d20Floor: 0, thirdD20: false, maxDie: null, stepUp: 0 };
  for (const { rule, item, holder } of affecting(actor, 'RollDice', ['self', 'host'])) {
    if ((rule.scope ?? 'self') == 'host' && !hostMatches(item, roll.item)) {
      continue;
    }

    if (evaluate(rule.when, contextFor({ ...roll, ...rollFacts(roll.item, roll), self: actor, other: target, ruleItem: item })) !== true) {
      continue;
    }

    out.d20Floor = Math.max(out.d20Floor, Number(rule.d20Floor) || 0);
    out.thirdD20 ||= !!rule.thirdD20;
    // The tightest cap wins (a worse die sits further down the list).
    if (rule.maxDie && list.indexOf(rule.maxDie) >= 0 && (!out.maxDie || list.indexOf(rule.maxDie) > list.indexOf(out.maxDie))) {
      out.maxDie = rule.maxDie;
    }

    out.stepUp += Math.max(0, Math.round(resolveValue(rule.stepUp ?? 0, { actor: holder, item }, 0)));
  }

  return out;
}

/**
 * DieSubstitution rules: the die this roll starts from (dice.mjs initialShift), applied in item order
 * after the hand-written substitutions. A rule applies when it changes the die - or, for a floor,
 * when the die is at or below it. Returns the die, whether to Specialize / clear the Snag, and
 * `spend` to record limits once the roll is made.
 */
export function ruleDieSubstitution(actor, target, roll = {}, startShift) {
  const list = globalThis.CONFIG?.E20?.skillShiftList ?? [];
  const skills = actor?.getRollData?.()?.skills ?? actor?.system?.skills ?? {};
  const rank = shift => list.indexOf(shift);
  let shift = startShift;
  let specialize = false;
  let clearSnag = false;
  const used = [];
  for (const entry of affecting(actor, 'DieSubstitution', ['self', 'host'])) {
    const { rule, item, index, holder } = entry;
    if ((rule.scope ?? 'self') == 'host' && !hostMatches(item, roll.item)) {
      continue;
    }

    if (usesLeft(holder, rule, item, index) <= 0
      || evaluate(rule.when, contextFor({ ...roll, ...rollFacts(roll.item, roll), self: actor, other: target, ruleItem: item })) !== true) {
      continue;
    }

    // from: only when the die it starts at is one of these (Ageless Knowledge: a d2 only).
    if (Array.isArray(rule.from) && rule.from.length && !rule.from.includes(shift)) {
      continue;
    }

    // dieOf: holder (round 17, perm - rules/plugins/marks/carried-die-and-crit.mjs): the holder's dice, not the roller's.
    const pool = rule.dieOf == 'holder' && holder && holder !== actor ? holder.getRollData?.()?.skills ?? holder.system?.skills ?? {} : skills;
    const dieOf = name => pool[name == 'choice' ? chosenOf(item) : name]?.shift;
    let next = shift;
    let applies = false;
    if (rule.mode == 'use') {
      next = dieOf(rule.skills[0]) ?? shift;
      applies = next != shift;
    } else if (rule.mode == 'best') {
      for (const name of rule.skills) {
        const die = dieOf(name);
        if (die && rank(die) >= 0 && (rank(next) < 0 || rank(die) < rank(next))) {
          next = die;
        }
      }

      applies = next != shift;
    } else if (rule.mode == 'floor' && rank(rule.die) >= 0) {
      applies = rank(shift) < 0 || rank(shift) >= rank(rule.die);
      next = applies ? rule.die : shift;
    }

    if (!applies) {
      continue;
    }

    shift = next;
    specialize ||= !!rule.specialize;
    clearSnag ||= !!rule.clearSnag;
    used.push(entry);
  }

  const spend = async () => {
    for (const { rule, item, index, holder } of used) {
      if (rule.limit?.per) {
        await recordUse(holder, rule, item, index);
      }

      // consumeMark: the roll it applied to uses up the roller's own mark (a banked one-roll floor).
      if (rule.consumeMark && actor?.flags?.essence20?.ruleMarks?.[rule.consumeMark]) {
        await actor.update?.({ [`flags.essence20.ruleMarks.-=${rule.consumeMark}`]: null });
      }
    }
  };

  return { shift, specialize, clearSnag, spend };
}

/**
 * Cover rules on a ranged attack: the attacker's (ignore / reduce) and the target's (against: grant /
 * base / add). `when` sees the roll, with other = the other party.
 * @returns {{ignore: Boolean, reduce: Number, grant: Boolean, base: Number, add: Number}}
 */
export function ruleCover(actor, target, roll = {}) {
  const out = { ignore: false, reduce: 0, grant: false, base: 0, add: 0 };
  const facts = { ...roll, ...rollFacts(roll.item, roll) };
  for (const [holder, other, against] of [[actor, target, false], [target, actor, true]]) {
    if (!holder) {
      continue;
    }

    for (const { rule, item, holder: owner } of affecting(holder, 'Cover', ['self', 'host'])) {
      if (!!rule.against != against || ((rule.scope ?? 'self') == 'host' && (against || !hostMatches(item, roll.item)))) {
        continue;
      }

      // holder: the actor whose item it is (differs from self only for an aura - Bulwark's planted stance).
      if (evaluate(rule.when, contextFor({ ...facts, self: holder, holder: owner, other, ruleItem: item })) !== true) {
        continue;
      }

      const amount = Math.max(0, Math.round(resolveValue(rule.amount ?? 0, { actor: owner, item }, 0)));
      switch (rule.mode) {
      case 'ignore': out.ignore = true; break;
      case 'reduce': out.reduce = Math.max(out.reduce, amount); break;
      case 'grant': out.grant = true; break;
      case 'base': out.base = Math.max(out.base, amount); break;
      case 'add': out.add += amount; break;
      // giveBack: the Cover penalty handed back as an untickable source (rules/plugins/combat/cover-give-back.mjs).
      case 'giveBack': out.giveBack = true; break;
      }
    }
  }

  return out;
}

/**
 * AimBonus rules on this ranged attack: the base Aim bonus is raised to atLeast and extra added; `spend`
 * is what to record (limits, toggles) once the shot is fired aimed.
 * @returns {{atLeast: Number, extra: Number, spend: Function}}
 */
export function ruleAimBonus(actor, target, roll = {}) {
  let atLeast = 0;
  let extra = 0;
  const used = [];
  for (const entry of affecting(actor, 'AimBonus', ['self', 'host'])) {
    const { rule, item, index, holder } = entry;
    if ((rule.scope ?? 'self') == 'host' && !hostMatches(item, roll.item)) {
      continue;
    }

    if (usesLeft(holder, rule, item, index) <= 0
      || evaluate(rule.when, contextFor({ ...roll, ...rollFacts(roll.item, roll), self: actor, other: target, ruleItem: item })) !== true) {
      continue;
    }

    const scope = { actor: holder, item };
    atLeast = Math.max(atLeast, Math.round(resolveValue(rule.atLeast ?? 0, scope, 0)));
    extra += Math.round(resolveValue(rule.extra ?? 0, scope, 0));
    used.push(entry);
  }

  const spend = async () => {
    for (const { rule, item, index, holder } of used) {
      if (rule.limit) {
        await recordUse(holder, rule, item, index);
      }

      if (rule.clearToggle) {
        await item.update?.({ [`flags.essence20.rules.toggles.${rule.clearToggle}`]: false });
      }
    }
  };

  return { atLeast, extra, spend };
}

/**
 * Assist rules between a helper and the ally they would Lend Assistance to, on one Skill: any refusal
 * (from either side), whether either side lifts the Skill-rank requirement, and the boosts to the help.
 * @returns {{refused: Boolean, anyRank: Boolean, anyRange: Boolean, self: Boolean, atLeast: Number, extra: Number, edge: Boolean}}
 */
export function ruleAssist(helper, ally, skill, essence = null) {
  const result = { refused: false, anyRank: false, anyRange: false, self: false, atLeast: 0, extra: 0, edge: false };
  const check = (holder, other, side) => {
    for (const { rule, item } of affecting(holder, 'Assist')) {
      if ((rule.side ?? 'give') != side
        || evaluate(rule.when, contextFor({ self: holder, other, ruleItem: item, rolledSkill: skill, rolledEssence: essence })) !== true) {
        continue;
      }

      result.refused ||= rule.effect == 'refuse';
      // message: what the refusal tells the helper (round 15 - Fun Exhaustion); the first refusing rule's.
      if (rule.effect == 'refuse' && rule.message && !result.message) {
        result.message = rule.message;
      }

      result.anyRank ||= rule.effect == 'anyRank';
      result.anyRange ||= rule.effect == 'anyRange';
      result.self ||= rule.effect == 'self';
      if (rule.effect == 'boost') {
        const scope = { actor: holder, item };
        result.atLeast = Math.max(result.atLeast, Math.round(resolveValue(rule.atLeast ?? 0, scope, 0)));
        result.extra += Math.round(resolveValue(rule.extra ?? 0, scope, 0));
        result.edge ||= !!rule.edge;
      }
    }
  };

  check(helper, ally, 'give');
  check(ally, helper, 'receive');
  return result;
}

/** Whether a ConditionImmunity rule keeps this Condition off the actor right now. */
export function ruleConditionImmune(actor, statusId) {
  // holder: the actor whose item it is (an aura's holder - holder:protects, Danger Sense's Protected Target).
  return affecting(actor, 'ConditionImmunity').some(({ rule, item, holder }) => (rule.conditions ?? []).includes(statusId)
    && evaluate(rule.when, contextFor({ self: actor, holder: holder ?? actor, ruleItem: item })) === true);
}

const ACCESS_ORDER = ['unknown', 'none', 'trained', 'qualified'];

/**
 * Requisition access from Qualification rules: 'qualified', 'trained' or null for this item.
 * @param {Actor} actor
 * @param {Item} item   The item being requisitioned.
 */
export function ruleRequisitionAccess(actor, item) {
  let best = null;
  const effectiveAvailability = requisitionTier(actor, item);
  for (const { rule, item: ruleItem } of affecting(actor, 'Qualification')) {
    if (!Array.isArray(rule.items) || !rule.items.length || evaluate(rule.when, contextFor({ self: actor, ruleItem })) !== true) {
      continue;
    }

    if (evaluate(rule.items, contextFor({ self: actor, item, ruleItem, effectiveAvailability })) === true) {
      const access = rule.access ?? 'qualified';
      if (!best || ACCESS_ORDER.indexOf(access) > ACCESS_ORDER.indexOf(best)) {
        best = access;
      }
    }
  }

  return best;
}

/**
 * The Availability tier this actor requisitions the item at: its combined total, lowered by every
 * listener that leaves Qualified upgrades out (mechanics/resources/requisition.mjs#requisitionDif asks the same).
 */
export function requisitionTier(actor, item) {
  const out = { availability: item?.system?.totalAvailability ?? item?.system?.availability ?? 'standard' };
  globalThis.Hooks?.call?.('essence20.requisitionAvailability', actor, item, out);
  return out.availability;
}

/**
 * Whether a Qualification rule's `upgrades` covers this upgrade - an upgrade Item, or a weapon's
 * attached entry {uuid, name, availability}.
 */
export function ruleQualifiedUpgrade(actor, upgrade) {
  const probe = upgrade?.system ? upgrade : {
    name: upgrade?.name, uuid: upgrade?.uuid, type: 'upgrade', flags: { core: { sourceId: upgrade?.uuid } },
    system: { availability: upgrade?.availability },
  };
  return affecting(actor, 'Qualification').some(({ rule, item: ruleItem }) => Array.isArray(rule.upgrades) && rule.upgrades.length
    && evaluate(rule.when, contextFor({ self: actor, ruleItem })) === true
    && evaluate(rule.upgrades, contextFor({ self: actor, item: probe, ruleItem })) === true);
}

// mechanics/resources/requisition.mjs asks every listener, and keeps the widest answer.
globalThis.Hooks?.on?.('essence20.requisitionAccess', (actor, item, out) => {
  const access = ruleRequisitionAccess(actor, item);
  if (access && ACCESS_ORDER.indexOf(access) > ACCESS_ORDER.indexOf(out.access ?? 'unknown')) {
    out.access = access;
  }
});

/**
 * What MovementAction rules allow this actor right now: {ignoreRoughTerrain, pushFeet, pushUnlimited, countSinceTypeChange}.
 * Read when a token moves (mechanics/world/rough-terrain.mjs, mechanics/combat/token-movement.mjs) - the index is
 * already current by then.
 */
export function ruleMovement(actor) {
  const out = { ignoreRoughTerrain: false, pushFeet: 0, pushUnlimited: false };
  for (const { rule, item, holder } of affecting(actor, 'MovementAction')) {
    if (evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) !== true) {
      continue;
    }

    out.ignoreRoughTerrain ||= !!rule.ignoreRoughTerrain;
    out.pushUnlimited ||= !!rule.pushUnlimited;
    // countSinceTypeChange only shows up when some rule asks for it (rules/plugins/combat/since-type-change.mjs).
    if (rule.countSinceTypeChange) {
      out.countSinceTypeChange = true;
    }

    out.pushFeet = Math.max(out.pushFeet, Math.round(resolveValue(rule.pushFeet ?? 0, { actor: holder, item })));
  }

  return out;
}

/**
 * Movement rules for documents/actor.mjs#_prepareMovement: a function (stage, type, value) => the
 * new value, or null when no rule applies - so the hand-written path is untouched without rules.
 * The index is rebuilt here (movement is prepared before the derived-data pass), and each rule's
 * condition is asked when it's applied, so it can read speeds set earlier.
 */
const MOVEMENT_OPS = ['set', 'multiply', 'add', 'max', 'min'];
export function ruleMovementStages(actor) {
  rebuildIndex(actor);
  const entries = affecting(actor, 'Movement', ['self', 'host']).filter(({ rule, item }) => (rule.scope ?? 'self') != 'host' || hostOf(item));
  if (!entries.length) {
    return () => null;
  }

  return (stage, type, value) => {
    let result = value;
    let changed = false;
    // round: floor / ceil on any applied rule (Ship Shape's x1.5 rounded down); nearest otherwise.
    let rounding = 'nearest';
    const live = entries.filter(({ rule }) => (rule.stage ?? 'final') == stage && (rule.movement == 'all' || rule.movement == type));
    for (const op of MOVEMENT_OPS) {
      for (const { rule, item, holder } of live) {
        if (rule.op != op || evaluate(rule.when, contextFor({ self: actor, ruleItem: item, movementType: type })) !== true) {
          continue;
        }

        // @recipient.<path>: the actor whose Movement it is (a marked rule's carrier - Hup!'s count on its mark).
        const amount = resolveValue(rule.value, { actor: holder, item, recipient: actor }, 0);
        result = { set: amount, multiply: result * amount, add: result + amount, max: Math.max(result, amount), min: Math.min(result, amount) }[op];
        changed = true;
        rounding = rule.round ?? rounding;
      }
    }

    const round = { floor: Math.floor, ceil: Math.ceil }[rounding] ?? Math.round;
    return changed ? Math.max(0, round(result)) : null;
  };
}

/**
 * Vision from Sense rules (mechanics/characters/vision-grant.mjs#getBestVisionGrant): [{mode, range}] for every
 * one whose condition holds. Vision is prepared before the derived-data pass, so the index is
 * rebuilt here too - but only when some item on the actor (or a linked one) has rules.
 */
export function ruleSenses(actor) {
  rebuildIndex(actor);
  return affecting(actor, 'Sense')
    .filter(({ rule, item }) => evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) === true)
    .map(({ rule, item, holder }) => ({ mode: rule.mode ?? 'darkvision', range: Math.max(0, Math.round(resolveValue(rule.range, { actor: holder, item }))) }))
    .filter(grant => grant.range > 0);
}

/**
 * How rules let a Surprised actor act (documents/actor.mjs#_prepareActions): the set of modes -
 * "normal", "move", "speedAsLevel" - whose conditions hold. Actions are prepared before the
 * derived-data pass rebuilds the index, so this rebuilds it - only asked while Surprised.
 */
export function ruleSurpriseModes(actor) {
  rebuildIndex(actor);
  const modes = new Set();
  for (const { rule, item, holder } of affecting(actor, 'SurpriseExemption')) {
    // holder: tags read the actor whose item it is (an aura's holder - Cartography Suite's survey).
    if (evaluate(rule.when, contextFor({ self: actor, holder, ruleItem: item })) === true) {
      modes.add(rule.mode ?? 'normal');
    }
  }

  return modes;
}

/**
 * The derived-data pass: rebuild the rule index, then always-on Defenses and DerivedStat rules.
 * A DerivedStat or Defense whose condition depends on a roll doesn't belong here - a DerivedStat
 * with one is skipped (the validator says so), a Defense with one is applied per attack instead
 * (ruleDefenseAdjust).
 */
export function ruleDerived(actor) {
  rebuildIndex(actor);
  const staticCtx = item => contextFor({ self: actor, ruleItem: item });

  // A linked rule's `holder:` tags read its holder (round 16, part b - In The Right Hands' "while the Cybertronian is in
  // Alt Mode" on the wearer's Defense); an own rule's holder is the actor itself, as before.
  const defenses = affecting(actor, 'Defense').filter(({ rule, item, holder }) => !isRollTimeDefense(rule)
    && evaluate(rule.when, contextFor({ self: actor, ruleItem: item, holder })) === true);
  for (const { rule, item, holder } of strongestPerGroup(defenses, e => resolveValue(e.rule.amount, { actor: e.holder, item: e.item }))) {
    const amount = Math.round(resolveValue(rule.amount, { actor: holder, item }));
    for (const key of rule.defense == 'any' ? DEFENSES : [rule.defense]) {
      addToDefense(actor.system?.defenses?.[key], amount, ruleLabel(rule, item));
    }
  }

  for (const { rule, item, holder } of affecting(actor, 'DerivedStat', ['self', 'host'])) {
    // {choice.<key>} in the path reads a pick (Mentor's Skill); with no pick yet the rule does nothing.
    const path = interpolate(String(rule.path ?? ''), item);
    // stage early: applied before the poison training is worked out (rules/plugins/effects/derived-stages.mjs), not here.
    if (rule.stage == 'early' || !isStatic(rule.when) || evaluate(rule.when, staticCtx(item)) !== true || !path?.startsWith('system.')) {
      continue;
    }

    const target = (rule.scope ?? 'self') == 'host' ? hostOf(item) : actor;
    if (!target) {
      continue;
    }

    // true / false: a switch on the actor (resistances, "is Qualified"), set as it is.
    if (typeof rule.value == 'boolean') {
      globalThis.foundry?.utils?.setProperty?.(target, path, rule.value);
      continue;
    }

    writeNumber(target, path, rule.op, resolveValue(rule.value, { actor: holder, item }), ruleLabel(rule, item));
  }

  // ItemModifier: numbers on the actor's other items. Items prepare before their actor, so these
  // stand until the item is next prepared from its source.
  for (const { rule, item } of rulesOfType(actor, 'ItemModifier', 'self')) {
    // stage item: made in the changed item's own prepareDerivedData (rules/plugins/effects/item-modifier-stage.mjs), not here.
    if (rule.stage == 'item' || !isStatic(rule.when) || evaluate(rule.when, staticCtx(item)) !== true || !Array.isArray(rule.items)) {
      continue;
    }

    for (const other of actor.items?.contents ?? [...(actor.items ?? [])]) {
      if (other !== item && evaluate(rule.items, contextFor({ self: actor, item: other, ruleItem: item })) === true) {
        // @other.<path>: the item being changed (its own reach multiplier...).
        const value = resolveValue(rule.value, { actor, item, otherItem: other });
        writeNumber(other, rule.path, rule.op, value, ruleLabel(rule, item));
        // Derived only - listed like an upgrade's own changes (items/attacks/weapon-upgrades.mjs), so the
        // item sheet keeps editing the stored value rather than saving the changed one back.
        if (other.system && typeof other.system == 'object') {
          other.system.upgradeTouched = [...new Set([...(other.system.upgradeTouched ?? []), rule.path.slice(7)])];
        }
      }
    }
  }

  callCodeHelpers(actor, 'derived', actor);
}

/** Damage about to land on this actor: its own `taken` DamageModifiers. */
export function ruleDamageTaken(actor, amount, damageType) {
  let value = amount;
  for (const { rule, item, holder } of affecting(actor, 'DamageModifier')) {
    // exceptTypes (rules/plugins/combat/damage-except-types.mjs): every type but those.
    if (rule.direction != 'taken' || (rule.damageType && rule.damageType != damageType) || rule.exceptTypes?.includes?.(damageType)) {
      continue;
    }

    if (evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) !== true) {
      continue;
    }

    if (rule.immune) {
      return 0;
    }

    value += Math.round(resolveValue(rule.amount, { actor: holder, item }));
  }

  for (const { rule, item } of rulesOfType(actor, 'Code')) {
    const fn = ruleHelper(rule.helper)?.damageTaken;
    if (typeof fn == 'function') {
      try {
        const next = fn(actor, value, damageType, { rule, item });
        value = Number.isFinite(next) ? next : value;
      } catch (error) {
        console.error(`Essence20 | rule helper "${rule.helper}" failed in damageTaken`, error);
      }
    }
  }

  return Math.max(0, value);
}

/** A hit: the attacker's `dealt` DamageModifiers add to the damage, labelled on the card. */
export function ruleDamageDealt(actor, target, result, rider = {}, tools = {}) {
  callCodeHelpers(actor, 'hitRider', actor, target, result, rider, tools);
  if (!result?.damageValue || !tools.damageBonusNote) {
    return;
  }

  const item = rider.itemUuid ? globalThis.fromUuidSync?.(rider.itemUuid) ?? null : null;
  const damageType = result.damageType ?? rider.damageType;
  const roll = { item, rolledSkill: rider.skill, isAttack: true, isMelee: rider.style == 'melee' };
  for (const { rule, item: ruleItem, holder } of affecting(actor, 'DamageModifier', ['self', 'host'])) {
    if (rule.direction != 'dealt' || rule.scaled || (rule.damageType && rule.damageType != damageType)) {
      continue;
    }

    if ((rule.scope ?? 'self') == 'host' && !hostMatches(ruleItem, item)) {
      continue;
    }

    if (evaluate(rule.when, contextFor({ ...roll, self: actor, ruleItem, other: target })) !== true) {
      continue;
    }

    const amount = Math.round(resolveValue(rule.amount, { actor: holder, item: ruleItem }));
    if (amount) {
      tools.damageBonusNote(result, amount, ruleLabel(rule, ruleItem));
    }
  }
}

/**
 * The attacker's `scaled` dealt DamageModifiers, decided when the attack is rolled: they join the
 * attack's own damage bonus, so Degrees of Success multiply them like any other bonus damage.
 * @returns {{amount: Number, sources: String[]}}
 */
export function ruleScaledDamage(actor, target, roll = {}) {
  let amount = 0;
  const sources = [];
  const damageType = roll.item?.system?.damageType ?? null;
  const used = [];
  for (const entry of affecting(actor, 'DamageModifier', ['self', 'host'])) {
    const { rule, item: ruleItem, holder, index } = entry;
    if (rule.direction != 'dealt' || !rule.scaled || (rule.damageType && rule.damageType != damageType)) {
      continue;
    }

    if (rule.limit?.per && usesLeft(holder, rule, ruleItem, index) <= 0) {
      continue;
    }

    if ((rule.scope ?? 'self') == 'host' && !hostMatches(ruleItem, roll.item)) {
      continue;
    }

    if (evaluate(rule.when, contextFor({ ...roll, ...rollFacts(roll.item, roll), self: actor, holder, other: target, ruleItem })) !== true) {
      continue;
    }

    const value = Math.round(resolveValue(rule.amount, { actor: holder, item: ruleItem }));
    if (value) {
      amount += value;
      sources.push(ruleLabel(rule, ruleItem));
      used.push(entry);
    }
  }

  // Limits are used up, and side-effect steps run (Force's banked ↓1), once the bonus is applied.
  const spend = async () => {
    for (const { rule, item, holder, index } of used) {
      if (rule.limit?.per) {
        await recordUse(holder, rule, item, index);
      }

      if (rule.steps?.length) {
        const { runSteps, stepContext } = await import("./steps.mjs");
        await runSteps(rule.steps, stepContext({ actor: holder, item, rule, targets: target ? [target] : [] }));
      }
    }
  };

  return { amount, sources, spend };
}

/* -------------------------------------------- */
/*  Rerolls and pools                            */
/* -------------------------------------------- */

/** Reroll rules as reroll configs (mechanics/rolls/reroll.mjs#getRerollConfigs). */
const RULE_KEYS = ['type', 'label', 'when', 'scope', 'priority', 'disabled', 'stacks'];

export function ruleRerollGrants(actor) {
  const configs = [];
  const entries = rulesOfType(actor, 'Reroll', 'self');
  // An item's first Reroll rule counts its uses under the item itself (`item:<uuid>`) - the key a Perk's own
  // system.reroll used before it moved into this rule (2026-10-07), and the one a rerollLimit step shares (Power
  // Infusion). Any later Reroll rule on the same item keeps a count of its own.
  const firstIndex = new Map();
  for (const { item, index } of entries) {
    firstIndex.set(item, Math.min(firstIndex.get(item) ?? Infinity, index));
  }

  for (const { rule, item, index } of entries) {
    if (!isStatic(rule.when) || evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) !== true) {
      continue;
    }

    // The rule's own keys aren't reroll settings.
    const { upTo, ...settings } = Object.fromEntries(Object.entries(rule).filter(([key]) => !RULE_KEYS.includes(key)));
    // upTo: N - every result from 1 to N (Power Infusion: 1s, then 1s and 2s from 18th level).
    if (upTo !== undefined) {
      const top = Math.round(resolveValue(upTo, { actor, item }, 1));
      settings.values = top > 0 ? Array.from({ length: top }, (_, i) => i + 1) : [1];
    }

    // A Perk whose Skill is picked when it's taken (choiceType skills: Expertise, Trade Experience, Aptitude
    // Augmenter) and whose rule names no Skills covers only the picked one(s) (rules/choice-read.mjs; a list pick, all of them).
    const picked = item.system?.choiceType == 'skills' ? chosenList(item) : [];
    if (!settings.skills?.length && !settings.scopeToOriginSkill && picked.length) {
      settings.skills = picked;
    }

    const first = firstIndex.get(item) == index;
    configs.push({
      ...settings,
      maxUses: settings.maxUses === undefined ? undefined : resolveValue(settings.maxUses, { actor, item }, 1),
      source: first ? item.uuid ?? item.id : `${item.uuid ?? item.id}#rule${index}`,
      ...(first ? { sourceType: 'item' } : {}),
      name: ruleLabel(rule, item),
    });
  }

  return configs;
}

/** A pool's maximum. */
export function poolMax(rule, actor, item) {
  return Math.max(0, Math.round(resolveValue(rule.max, { actor, item })));
}

/** The flag update that fills every Pool on these items whose reset matches. */
export function poolResets(actor, reset) {
  const updates = new Map();
  for (const { rule, item } of rulesOfType(actor, 'Pool', 'self')) {
    if (rule.reset != reset) {
      continue;
    }

    const update = updates.get(item.id) ?? { _id: item.id };
    update[`flags.essence20.rules.pools.${rule.key}.value`] = poolMax(rule, actor, item);
    updates.set(item.id, update);
  }

  return [...updates.values()];
}

async function resetPools(actor, reset) {
  const updates = poolResets(actor, reset);
  if (updates.length) {
    await actor.updateEmbeddedDocuments('Item', updates);
  }
}

// The world's actors and the unlinked tokens' on the viewed / active scene (rules/triggers.mjs#sweepActors).
async function resetAllPools(reset) {
  const { sweepActors } = await import("./triggers.mjs");
  for (const actor of sweepActors()) {
    await resetPools(actor, reset);
  }
}

/* -------------------------------------------- */
/*  Registration                                 */
/* -------------------------------------------- */

registerRollSources(ruleRollSources);
registerConsumer('rulesBank', consume => consumeBanked(consume));
registerConsumer('rulesLimit', consume => consumeLimited(consume));
registerConsumer('rulesMark', async consume => {
  const actor = await globalThis.fromUuid?.(consume.actorUuid);
  // The key's own mark and every setter's copy of it.
  const keys = Object.keys(actor?.flags?.essence20?.ruleMarks ?? {}).filter(name => name == consume.key || name.startsWith(`${consume.key}--`));
  if (keys.length) {
    const { needsGmRelay, relayToGm } = await import("../mechanics/world/gm-relay.mjs");
    const update = [Object.fromEntries(keys.map(name => [`flags.essence20.ruleMarks.-=${name}`, null]))];
    await (needsGmRelay(actor) ? relayToGm(actor, 'update', update) : actor.update(...update));
  }
});
registerSpecializes(ruleSpecializes);
registerDialogToggles((actor, ctx) => ruleDialogSwitches(actor, ctx).map(({ entry: _entry, ...toggle }) => toggle));
registerApplyDialog(applyRuleSwitches);
registerApplyDialog(applyRuleImmunity);
registerPreRoll(async (actor, dataset, item) => {
  applySkillSubstitution(actor, dataset, item);
});
registerDefenseAdjust(ruleDefenseAdjust);
registerDerived(ruleDerived);
registerDamageModifier((actor, amount, damageType) => ruleDamageTaken(actor, amount, damageType));
registerHitRider(ruleDamageDealt);
registerRerollGrant(ruleRerollGrants);
registerSceneAdvanced(() => resetAllPools('scene'));
registerMissionAdvanced(() => resetAllPools('mission'));
registerRest(actor => resetPools(actor, 'rest'));
