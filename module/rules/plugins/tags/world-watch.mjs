import { registerApplyDialog, registerPostRoll } from "../../../mechanics/item-hooks.mjs";
import { rulesOfType } from "../../index.mjs";
import { registerTag } from "../../predicate.mjs";
import { registerPickSource } from "../../steps.mjs";
import { registerEvent } from "../../types.mjs";
import { resolve, sideAlly, sideEnemy, worldActors } from "../shared/side-and-copy-helpers.mjs";

/**
 * Group F: events heard anywhere in the world, not only on the canvas. A Trigger's `watch` reaches tokens in the viewed
 * scene; these reach every world actor holding a Trigger for the event (and the actor it happened to, token or not), so a
 * character off the map still hears an ally's Critical Success. The steps act as the holder; `target` is the actor it
 * happened to (`target:self` - it happened to the holder).
 *
 *   rollSeen       a check was rolled (any actor, posted on this client): @var.crit, @var.fumble (1 / 0), @var.failed
 *                  (it had rows and every one failed), @var.upshifted (the dialog closed with a net ↑1 or better),
 *                  @var.assisted (a Lend Assistance Edge / ↑ was waiting for the roll), @var.total
 *   conditionSeen  an Active Effect with status ids landed on an actor (this user's change): @var.statuses (comma-joined
 *                  ids - var:includes:statuses:<id>), @var.condition (1 when one is a listed Condition)
 *   rollMessage    this user posted a chat message whose first roll has a d20 - on the speaker's actor only: @var.total
 *
 * Tags: target:sideAlly / target:sideEnemy (same / opposite non-neutral side by disposition - the active token's, else
 * the prototype token's; never itself), self:emotion[:<option>] (that Emotional Mastery option is active for the actor -
 * its own, or one Team Spirit lent while the lender still has it active; bare: any). Pick source activeEmotions.
 */

for (const event of ['rollSeen', 'conditionSeen', 'rollMessage']) {
  registerEvent(event);
}

/* -------------------------------------------- */
/*  Tags                                         */
/* -------------------------------------------- */

registerTag('target:sideAlly', (rest, ctx) => (ctx.other ? sideAlly(ctx.self, ctx.other) : false));
registerTag('target:sideEnemy', (rest, ctx) => (ctx.other ? sideEnemy(ctx.self, ctx.other) : false));

/** The Emotional Mastery options active for an actor: its own, plus a Team Spirit grant the lender still has active. */
export function activeEmotions(actor) {
  const own = actor?.flags?.essence20?.activeEmotionalMastery;
  const list = Array.isArray(own) ? [...own] : [];
  const lent = actor?.flags?.essence20?.teamSpiritOption;
  if (lent?.option) {
    const casterActive = resolve(lent.casterUuid)?.flags?.essence20?.activeEmotionalMastery;
    if (Array.isArray(casterActive) && casterActive.includes(lent.option)) {
      list.push(lent.option);
    }
  }

  return list;
}

registerTag('self:emotion', (rest, ctx) => {
  const active = activeEmotions(ctx.self);
  return rest ? active.includes(rest) : active.length > 0;
});

registerPickSource('activeEmotions', (step, ctx) => [...new Set(activeEmotions(ctx.actor))].map(value => ({
  value,
  label: globalThis.game?.i18n?.localize?.(`E20.EmotionalMastery${value.charAt(0).toUpperCase()}${value.slice(1)}`) ?? value,
})));

/* -------------------------------------------- */
/*  Firing                                       */
/* -------------------------------------------- */

const holdsTrigger = (actor, event) => rulesOfType(actor, 'Trigger').some(({ rule }) => rule.event == event && !rule.watch);

/** The actors that hear an event about `subject`: the subject itself, then every other world actor listening. */
export function listeners(event, subject) {
  const out = subject && holdsTrigger(subject, event) ? [subject] : [];
  for (const actor of worldActors()) {
    if (actor && actor !== subject && (!subject?.uuid || actor.uuid != subject.uuid) && holdsTrigger(actor, event)) {
      out.push(actor);
    }
  }

  return out;
}

/** Fire `event` about `subject` on everyone listening. */
export async function fireSeen(event, subject, vars) {
  const heard = listeners(event, subject);
  if (!heard.length) {
    return;
  }

  const { fireTriggers } = await import("../../triggers.mjs");
  for (const actor of heard) {
    await fireTriggers(actor, event, { targets: subject ? [subject] : [], vars: { ...vars } });
  }
}

// What each roll had going for it, noted as its dialog closes (this client) and read after the roll.
const dialogNotes = new Map();

export function noteDialog(actor, options) {
  if (!actor?.uuid) {
    return;
  }

  const flags = actor.flags?.essence20 ?? {};
  dialogNotes.set(actor.uuid, {
    upshifted: (Number(options?.shiftUp) || 0) - (Number(options?.shiftDown) || 0) >= 1 ? 1 : 0,
    assisted: flags.pendingLendAssistanceEdge || flags.pendingLendAssistanceShift ? 1 : 0,
  });
}

export async function rollSeen(actor, results, checkContext, { isCrit, isFumble, total } = {}) {
  const note = actor?.uuid ? dialogNotes.get(actor.uuid) : null;
  if (actor?.uuid) {
    dialogNotes.delete(actor.uuid);
  }

  if (!actor) {
    return;
  }

  const rows = Array.isArray(results) ? results : [];
  const rolled = Number(rows[0]?.total ?? total);
  await fireSeen('rollSeen', actor, {
    crit: isCrit ? 1 : 0,
    fumble: isFumble ? 1 : 0,
    failed: rows.length > 0 && rows.every(result => result?.success === false) ? 1 : 0,
    upshifted: note?.upshifted ?? 0,
    assisted: note?.assisted ?? 0,
    ...(Number.isFinite(rolled) ? { total: rolled } : {}),
  });
}

export async function conditionSeen(actor, statuses) {
  if (!actor || !statuses?.length) {
    return;
  }

  const conditions = new Set((globalThis.CONFIG?.statusEffects ?? []).map(effect => effect.id));
  await fireSeen('conditionSeen', actor, { statuses: statuses.join(','), condition: statuses.some(status => conditions.has(status)) ? 1 : 0 });
}

/** A chat message with a d20 roll: rollMessage on its speaker's (world) actor. */
export async function rollMessage(message) {
  const roll = message?.rolls?.[0];
  if (!roll || !(roll.dice ?? []).some(die => die.faces == 20)) {
    return;
  }

  const actor = message.speaker?.actor ? globalThis.game?.actors?.get?.(message.speaker.actor) : null;
  if (!actor || !holdsTrigger(actor, 'rollMessage')) {
    return;
  }

  const { fireTriggers } = await import("../../triggers.mjs");
  await fireTriggers(actor, 'rollMessage', { vars: { total: Number(roll.total) } });
}

registerApplyDialog(noteDialog);
registerPostRoll(rollSeen);

globalThis.Hooks?.on?.('createChatMessage', (message, options, userId) => {
  if (userId == globalThis.game?.user?.id) {
    rollMessage(message);
  }
});

globalThis.Hooks?.on?.('createActiveEffect', (effect, options, userId) => {
  const actor = effect?.parent;
  if (userId != globalThis.game?.user?.id || actor?.documentName != 'Actor') {
    return;
  }

  conditionSeen(actor, [...(effect.statuses ?? [])]);
});
