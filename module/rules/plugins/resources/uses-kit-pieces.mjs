import { registerRef } from "../../formula.mjs";
import { registerTag } from "../../predicate.mjs";
import { recipients, registerPickSource, registerStep } from "../../steps.mjs";
import { escape } from "../shared/chat-speaker-helpers.mjs";
import { takeMineMultiplier } from "../../../mechanics/resources/kits.mjs";

/**
 * Kits, consumables and carrying as rules (round 15, uses) - the pieces mechanics/resources/kits.mjs reads:
 *
 *   - Ref `@takeMine` - Take Mine's multiplier on the rule's item (kits.mjs#takeMineMultiplier: 2 while a friend with Take
 *     Mine handed it over this round, else 1).
 *   - Tag `self:specializationNamed:<skill>:<text>` - one of the actor's Specializations of that Skill has the text in
 *     its name (system.skills.<skill>.specializations).
 *   - Step `kitBoost {essence? | skill?, spec?, mode: shiftUp | edge | specialize, kind: scene | rounds | untilUsed,
 *     rounds?, times?}` - the lasting roll bonus a used-up kit leaves on the actor (kits.mjs's kitBoosts - read by
 *     kitSources whatever happens to the item); `times` (a formula, e.g. @takeMine) is the ↑ count.
 *   - Step `lendAssist {skill?, shiftUp?}` - Lend Assistance the system's way: with `skill`, a ↑ (default 1) banked on
 *     each recipient (default the actor) for that Skill as if an ally lent it (lend-assistance.mjs's pending
 *     shift); without, the actor lends assistance through the usual ally / Skill dialog
 *     (lend-assistance.mjs#lendAssistanceSkill). A cancelled dialog stops the run.
 *   - Pick source `specializations {skill}` - the standard Specializations of that Skill, every game line's merged and
 *     sorted (CONFIG.E20.standardSpecializations).
 *   (CarryExemption / KitModifier and the item:firstAttack tag: ./kit-rules.mjs, which kits.mjs reads.)
 */

registerRef('takeMine', (key, scope) => takeMineMultiplier(scope.actor, scope.item));

registerTag('self:specializationNamed', (rest, ctx) => {
  const [skill, ...text] = String(rest).split(':');
  const wanted = text.join(':').toLowerCase();
  return Object.values(ctx.self?.system?.skills?.[skill]?.specializations ?? {}).some(spec => String(spec?.name ?? '').toLowerCase().includes(wanted));
}, { phrase: (arg, w) => {
  const [skill, ...text] = arg.split(':');
  return [`{who} {has} a ${w.skillName(skill)} Specialization named like "${text.join(':')}"`, `{who} {has} no ${w.skillName(skill)} Specialization named like "${text.join(':')}"`];
} });

registerStep('kitBoost', async (step, ctx) => {
  const { addKitBoost } = await import("../../../mechanics/resources/kits.mjs");
  const { resolveValue } = await import("../../formula.mjs");
  const times = step.times === undefined ? undefined : Math.max(1, Math.round(resolveValue(step.times, { actor: ctx.actor, item: ctx.item, vars: ctx.vars }, 1)));
  for (const actor of recipients(step, ctx)) {
    await addKitBoost(actor, {
      essence: step.essence ?? null, skill: step.skill ?? null, ...(step.spec ? { spec: step.spec } : {}), mode: step.mode ?? 'shiftUp',
      kind: step.kind ?? 'scene', ...(step.rounds ? { rounds: Number(step.rounds) } : {}), label: ctx.item?.name ?? '', ...(times !== undefined ? { times } : {}),
    });
  }
}, { errors: (step, where) => (['shiftUp', 'edge', 'specialize', undefined].includes(step.mode) ? [] : [`${where}: kitBoost mode must be shiftUp, edge or specialize`]) });

registerStep('lendAssist', async (step, ctx) => {
  const assist = await import("../../../mechanics/actions/lend-assistance.mjs");
  if (!step.skill) {
    return (await assist.lendAssistanceSkill(ctx.actor)) ? undefined : false;
  }

  const { interpolate } = await import("../../predicate.mjs");
  const skill = interpolate(String(step.skill), ctx.item);
  if (!skill) {
    return false;
  }

  const { bankPendingBonus } = await import("../../../mechanics/characters/perks.mjs");
  for (const actor of recipients(step, ctx)) {
    await bankPendingBonus(actor, assist.LEND_ASSISTANCE_SHIFT_FLAG, { skill, shiftUp: Number(step.shiftUp) || 1, assisterUuid: ctx.actor.uuid });
    ctx.chat.push(escape(globalThis.game?.i18n?.format?.('E20.RulesExtUses.AssistBanked', { name: actor.name }) ?? actor.name));
  }
});

registerPickSource('specializations', step => {
  const lines = Object.values(globalThis.CONFIG?.E20?.standardSpecializations ?? {});
  const specs = [...new Set(lines.map(line => line?.[step.skill] ?? []).flat())].sort();
  return specs.map(spec => ({ value: spec, label: spec }));
});
