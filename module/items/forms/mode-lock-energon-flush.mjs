/**
 * Mode Lock (Enigma of Combination, p.49): "the character can remove the Condition by performing an
 * Energon flush, which requires spending 1 Energon and succeeding at a DIF 12 Technology Skill Test
 * as a Standard action." Conversion itself is already refused (sheet-handlers/transformer-handler.mjs);
 * the flush is a button on the chat card posted when the Condition lands.
 *
 * (The Alt Modes' printed special attacks, which shared this file, are their items' own rules now -
 * rules/conversions.test.js and rules/conversions-uses.test.js. Roll Out (For The Allspark!) is the Perk's own initiativeRolled
 * Trigger - a pick of the Alt Mode, transformInto.)
 */
import { registerChatButton } from "../../mechanics/item-hooks.mjs";
import { T } from "../shared/item-lang.mjs";
import { say } from "../shared/chat-lines.mjs";
import { buttonCard, payAction, resolveSync } from "../shared/button-cards-and-action-pay.mjs";

const energonOf = actor => Number(actor?.system?.energon?.normal?.value) || 0;

registerChatButton('tf2EnergonFlush', async (message, button) => {
  const actor = resolveSync(button.dataset.actorUuid);
  if (!actor?.isOwner) {
    return;
  }

  if (!actor.statuses?.has?.('modeLock')) {
    ui.notifications.warn(T('Tf2NotModeLocked', { name: actor.name }));
    return;
  }

  if (energonOf(actor) < 1) {
    ui.notifications.warn(T('Tf2NoEnergon', { name: actor.name }));
    return;
  }

  if (!(await payAction(actor, 'standard', T('Tf2EnergonFlush')))) {
    return;
  }

  await actor.update({ 'system.energon.normal.value': energonOf(actor) - 1 });
  const { rollTest } = await import("../../mechanics/resources/grants.mjs");
  const { success } = await rollTest(actor, 'technology', 12);
  if (success) {
    await actor.toggleStatusEffect('modeLock', { active: false });
  }

  await say(actor, T(success ? 'Tf2EnergonFlushDone' : 'Tf2EnergonFlushFailed', { name: actor.name }));
});

const H = globalThis.Hooks;

// Mode Lock lands: offer the Energon flush.
H?.on?.('createActiveEffect', async (effect, options, userId) => {
  const actor = effect?.parent;
  if (userId != globalThis.game?.user?.id || actor?.documentName != 'Actor' || !effect.statuses?.has?.('modeLock')) {
    return;
  }

  await buttonCard(actor, T('Tf2ModeLocked', { name: actor.name }), {
    key: 'tf2EnergonFlush', label: T('Tf2EnergonFlush'), data: { 'actor-uuid': actor.uuid },
  });
});
