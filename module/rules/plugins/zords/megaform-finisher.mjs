import { registerHitRider } from "../../../mechanics/item-hooks.mjs";
import { ruleDamageDealt } from "../../adapter.mjs";
import { formulaError, resolveValue } from "../../formula.mjs";
import { ruleLabel, rulesOfType } from "../../index.mjs";
import { linkedEntries } from "../../links.mjs";
import { contextFor, evaluate, interpolate, registerTag } from "../../predicate.mjs";
import { recipients, registerRecipient, registerStep, runSteps } from "../../steps.mjs";
import { registerRuleType } from "../../types.mjs";
import { T, copyOf, escape, localized, resolve, sourceOf } from "../shared/side-and-copy-helpers.mjs";

/**
 * Group F: hit-time damage multipliers and the pieces a Megaform's finishing move needs.
 *
 * - Rule type `HitMultiplier {multiply, damageType?, choiceFrom?}` (scopes self, megaform): a landed hit of a weapon attack
 *   deals `multiply` times its damage - noted on the hit as "+N (label)", the hit's own damage times (multiply - 1) - and,
 *   with `damageType` (a type, or {choice.<key>}), deals that type instead. `choiceFrom: <16-character id>`: {choice.*}
 *   the rule's own item hasn't picked is read from its holder's copy of that book item. `when` sees the hit as a HitRider's
 *   does (roll:switch:<key>, item:, attack:melee, target:...; self: the one who hit, holder: the rule's holder). One book
 *   item's rule counts once per hit, however many holders carry it (scope megaform: every participant).
 * - Tags `item:styleChoice:<key>[:<id>]` (the rolled attack's style - melee, or anything else counting as ranged - is the
 *   one picked under <key> on the rule's item, or on its holder's copy of book item <id> when the item has none; no pick:
 *   any style) and `target:resistsChoice:<key>[:<id>]` (the other party has Resistance to the type picked under <key>, the
 *   same lookup, else to the rolled attack's own damage type).
 * - Step `rollEach {to, skills, dif, prompt?, onAllSucceeded?, onAnyFailed?}`: each recipient picks one of the Skills (a
 *   cancelled pick is a failure) and rolls it against the DIF; then one branch. `@var.failures`, `{var.failedNames}`.
 *   `prompt` may be an E20. key ({name} = the roller).
 * - Recipient `participantPilots`: the Zord participants of the first target (a Megaform) - each one's driver, else the
 *   Zord itself.
 */

/* -------------------------------------------- */
/*  HitMultiplier                                */
/* -------------------------------------------- */

registerRuleType('HitMultiplier', {
  params: {
    multiply: { kind: 'formula', required: true },
    damageType: { kind: 'string' },
    choiceFrom: { kind: 'string' },
  },
  scopes: ['self', 'megaform'],
  validate: rule => [
    ...(rule.choiceFrom !== undefined && !/^[\w-]{16}$/.test(String(rule.choiceFrom)) ? ['choiceFrom must be a 16-character compendium id'] : []),
    ...(rule.multiply !== undefined && formulaError(rule.multiply) ? [`multiply: ${formulaError(rule.multiply)}`] : []),
  ],
});

/** The item whose pick a rule reads: its own when it has made it, else (choiceFrom) its holder's copy of that book item. */
function choiceText(text, ruleItem, holder, choiceFrom) {
  const own = interpolate(String(text), ruleItem);
  if (own !== null || !choiceFrom) {
    return own;
  }

  const sibling = copyOf(holder ?? ruleItem?.parent, choiceFrom);
  return sibling ? interpolate(String(text), sibling) : null;
}

const damageLabel = type => globalThis.game?.i18n?.localize?.(globalThis.CONFIG?.E20?.damageTypes?.[type] ?? type) ?? type;

/** The HitMultiplier rules bearing on a hit by `attacker`: its own and (scope megaform) its participants'. */
export function multiplierEntries(attacker) {
  const own = rulesOfType(attacker, 'HitMultiplier', 'self').map(entry => ({ ...entry, holder: attacker }));
  const linked = linkedEntries(attacker, 'HitMultiplier').filter(entry => entry.rule.scope == 'megaform');
  return [...own, ...linked];
}

/** A weapon attack's hit (target-riders.mjs#attackRiders, through registerHitRider). */
export function hitMultiplierOnAttack(attacker, target, result, rider = {}, tools = {}) {
  if (!result?.damageValue || !tools.damageBonusNote) {
    return;
  }

  const rolled = resolve(rider.itemUuid);
  const facts = {
    item: rolled, rolledSkill: rider.skill, isAttack: true, isMelee: rider.style == 'melee', switches: rider.switches ?? [],
    dataset: rider.dataset, damageType: rider.damageType ?? result.damageType, isCrit: !!tools.isCrit,
  };
  const seen = new Set();
  for (const { rule, item, index, holder } of multiplierEntries(attacker)) {
    const key = `${sourceOf(item) ?? item?.id}#${index}`;
    if (seen.has(key) || evaluate(rule.when, contextFor({ ...facts, self: attacker, holder, ruleItem: item, other: target })) !== true) {
      continue;
    }

    seen.add(key);
    const times = Number(resolveValue(rule.multiply, { actor: holder, item }, 1));
    const damage = Number(result.damageValue) || 0;
    if (times > 1 && damage) {
      tools.damageBonusNote(result, Math.round(damage * (times - 1)), ruleLabel(rule, item));
    }

    const type = rule.damageType ? choiceText(rule.damageType, item, holder, rule.choiceFrom) : null;
    if (type) {
      result.damageType = type;
      result.damageTypeLabel = damageLabel(type);
    }
  }
}

// Ahead of the rules' flat damage bonuses (DamageModifier, HitRider notes) and after the slices' own riders - where the
// hand-written finisher multiplied.
registerHitRider(hitMultiplierOnAttack, { before: ruleDamageDealt });

/* -------------------------------------------- */
/*  Tags                                         */
/* -------------------------------------------- */

/** "<key>[:<id>]" - the pick under key on the rule's item, else on its holder's copy of book item id. */
function pickedChoice(rest, ctx) {
  const [key, id] = String(rest ?? '').split(':');
  const own = ctx.ruleItem?.flags?.essence20?.rules?.choices?.[key];
  if (own !== undefined && own !== null && own !== '') {
    return own;
  }

  const sibling = id ? copyOf(ctx.ruleItem?.parent ?? ctx.holder, id) : null;
  const theirs = sibling?.flags?.essence20?.rules?.choices?.[key];
  return theirs === undefined || theirs === '' ? null : theirs;
}

registerTag('item:styleChoice', (rest, ctx) => {
  if (!ctx.item) {
    return null;
  }

  const style = pickedChoice(rest, ctx);
  return !style || style == (ctx.item.system?.classification?.style == 'melee' ? 'melee' : 'ranged');
});

registerTag('target:resistsChoice', (rest, ctx) => {
  const type = pickedChoice(rest, ctx) ?? ctx.item?.system?.damageType;
  return !!ctx.other && !!type && !!ctx.other.system?.resistances?.[type];
});

/* -------------------------------------------- */
/*  rollEach, participantPilots                  */
/* -------------------------------------------- */

registerRecipient('participantPilots', (match, ctx) => {
  const megaform = ctx.targets?.[0];
  if (megaform?.type != 'megaform') {
    return [];
  }

  return Object.values(megaform.system?.actors ?? {}).map(entry => resolve(entry?.uuid)).filter(actor => actor?.type == 'zord').map(zord => {
    const pilot = Object.values(zord.system?.actors ?? {}).find(crew => crew?.vehicleRole == 'driver');
    return (pilot && resolve(pilot.uuid)) || zord;
  });
});

registerStep('rollEach', async (step, ctx) => {
  const { chooseSelect, rollTest } = await import("../../../mechanics/resources/grants.mjs");
  const skills = Array.isArray(step.skills) ? step.skills : [];
  const dif = Math.round(resolveValue(step.dif ?? 10, { actor: ctx.actor, item: ctx.item, vars: ctx.vars }, 10));
  const options = skills.map(value => ({ value, label: globalThis.game?.i18n?.localize?.(globalThis.CONFIG?.E20?.skills?.[value] ?? value) ?? value }));
  const failed = [];
  for (const roller of recipients(step, ctx)) {
    const prompt = step.prompt ? localized(step.prompt, { name: roller.name }).replace(/\{name\}/g, roller.name) : T('RollEachPrompt', { name: roller.name });
    const skill = options.length == 1 ? options[0].value : await chooseSelect(ctx.item?.name ?? '', escape(prompt), options);
    const { success } = skill ? await rollTest(roller, skill, dif) : { success: false };
    if (!success) {
      failed.push(roller.name);
    }
  }

  ctx.vars.failures = failed.length;
  ctx.vars.failedNames = failed.join(', ');
  const branch = failed.length ? step.onAnyFailed : step.onAllSucceeded;
  return Array.isArray(branch) ? runSteps(branch, ctx) : undefined;
}, {
  errors: (step, where) => (Array.isArray(step.skills) && step.skills.length ? [] : [`${where}: rollEach needs a list of skills`]),
  branches: ['onAllSucceeded', 'onAnyFailed'],
});
