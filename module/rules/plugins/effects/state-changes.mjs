// Round 15 (items1): events transforming / rolePointsActivating, steps fireEvent / grantResistance / hideTokens, tag
// damage:resisted. Mode Attachment, Shield Modulation, Mass Shift, Elemental Adaptation (Grid Power), Interspatial Pause.
import { registerEvent, TRIGGER_EVENTS } from "../../types.mjs";
import { ruleLabel, rulesOfType } from "../../index.mjs";
import { recordUse, usesLeft } from "../../limits.mjs";
import { contextFor, evaluate, registerTag } from "../../predicate.mjs";
import { recipients, registerStep, runSteps, stepContext } from "../../steps.mjs";

/**
 * Event `transforming` - a Transformer is about to change mode (sheet-handlers/transformer-handler.mjs, before the change
 * is written): `@var.mode` is `botMode` or the id of the Alt Mode it changes into.
 *
 * Event `rolePointsActivating` - a Role Points item is about to be switched on from the sheet (the Activate click,
 * sheets/base-actor-sheet.mjs, after its own checks): the Role Points item is the roll item (`item:id:<16-char id>`).
 * A Trigger whose run stops (a cancelled pick) cancels the activation - "when you activate your shield, choose...".
 */
registerEvent('transforming');
registerEvent('rolePointsActivating');

const post = async (actor, rule, item, ctx) => {
  if (ctx.chat.length && globalThis.ChatMessage?.create) {
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker?.({ actor }), content: [`<strong>${ruleLabel(rule, item)}</strong>`, ...ctx.chat].join('<br>') });
  }
};

/** Fire `transforming` (see above). */
export async function fireTransforming(actor, mode) {
  const { fireTriggers } = await import("../../triggers.mjs");
  await fireTriggers(actor, 'transforming', { vars: { mode: String(mode ?? '') } });
}

/**
 * Run the actor's rolePointsActivating Triggers for a Role Points item about to be switched on.
 * @returns {Promise<Boolean>}   false when one of them stopped - the activation is cancelled.
 */
export async function rolePointsActivating(actor, rolePoints) {
  for (const { rule, item, index } of rulesOfType(actor, 'Trigger')) {
    if (rule.event != 'rolePointsActivating' || rule.disabled
      || evaluate(rule.when, contextFor({ self: actor, holder: actor, ruleItem: item, item: rolePoints })) !== true || usesLeft(actor, rule, item, index) <= 0) {
      continue;
    }

    const ctx = stepContext({ actor, item, rule, targets: [] });
    const finished = await runSteps(rule.steps, ctx);
    await post(actor, rule, item, ctx);
    if (!finished) {
      return false;
    }

    await recordUse(actor, rule, item, index);
  }

  return true;
}

/**
 * `fireEvent {event, to?}` - run the recipients' Triggers for a named event, as a hand-written Use did when it fired it
 * (Mass Shift's `massShiftUsed`, which Hybridization counts). Any registered Trigger event.
 */
registerStep('fireEvent', async (step, ctx) => {
  const { fireTriggers } = await import("../../triggers.mjs");
  for (const actor of recipients(step, ctx)) {
    await fireTriggers(actor, step.event);
  }
}, { errors: (step, where) => (TRIGGER_EVENTS.includes(step.event) ? [] : [`${where}: fireEvent needs a Trigger event`]) });

/**
 * `grantResistance {damageType?, morphedOnly?, to?}` - Resistance to that damage type (default: the damage a takesDamage
 * Trigger answers) for the rest of the scene, through mechanics/world/scene-resistances.mjs#grantSceneResistance;
 * `morphedOnly` - only while Morphed. `{choice.x}` / `{var.x}` fill the type.
 */
registerStep('grantResistance', async (step, ctx) => {
  const named = step.damageType ? String(step.damageType).replace(/\{var\.([\w-]+)\}/g, (match, key) => String(ctx.vars?.[key] ?? '')) : '';
  const damageType = named || ctx.damage?.damageType || '';
  if (!damageType || damageType.includes('{')) {
    return false;
  }

  const { grantSceneResistance } = await import("../../../mechanics/world/scene-resistances.mjs");
  for (const actor of recipients(step, ctx)) {
    await grantSceneResistance(actor, damageType, { morphedOnly: !!step.morphedOnly });
  }
});

/** `hideTokens {to?, hidden?: true|false}` - the recipients' tokens on the canvas are hidden (or shown again). */
registerStep('hideTokens', async (step, ctx) => {
  const { updateRelayed } = await import("../../../items/shared/relayed-writes.mjs");
  for (const actor of recipients(step, ctx)) {
    for (const token of actor.getActiveTokens?.() ?? []) {
      await updateRelayed(token.document, { hidden: step.hidden !== false });
    }
  }
});

/** `damage:resisted` - the damage a takesDamage Trigger answers is of a type the actor already resists. */
registerTag('damage:resisted', (rest, ctx) => (ctx.damageType ? !!ctx.self?.system?.resistances?.[ctx.damageType] : null), { phrase: ['you already resist the damage', "you don't resist the damage"] });
