import { registerChatButton } from "../../../helpers/extensions.mjs";
import { registerStep, recipients } from "../../steps.mjs";

/**
 * Steps (round 10, group C):
 *
 * - blindRoll {formula, flavor?, rows?: [{min, text}]} - roll dice only the GM sees (a blind roll). `flavor` (text or
 *   an i18n key) may hold {formula} and {band} - the `text` of the last row whose `min` the total reaches.
 *   @var.rolled is the total.
 * - endExpiring {offer?, to?} - end now what would end at the end of the recipient's current turn: marks other
 *   creatures put on it that run out this turn (target-riders.mjs's riderMarks) and timed Conditions in their last
 *   round. `offer: true` whispers its owners a card listing them, with a button that ends them (nothing listed:
 *   no card).
 */

const esc = text => String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

function localize(text, data = {}) {
  const value = String(text ?? '');
  const i18n = globalThis.game?.i18n;
  const known = /^E20\./.test(value) && i18n?.has?.(value);
  const filled = known ? (Object.keys(data).length ? i18n.format(value, data) : i18n.localize(value)) : value;
  return filled.replace(/\{(\w+)\}/g, (match, key) => (data[key] === undefined ? match : String(data[key])));
}

/* -------------------------------------------- */
/*  blindRoll                                    */
/* -------------------------------------------- */

registerStep('blindRoll', async (step, ctx) => {
  const Roll = globalThis.Roll;
  if (!Roll) {
    return false;
  }

  const roll = await new Roll(String(step.formula)).evaluate();
  ctx.vars.rolled = roll.total;
  const rows = Array.isArray(step.rows) ? [...step.rows].sort((a, b) => (Number(a.min) || 0) - (Number(b.min) || 0)) : [];
  const row = rows.filter(entry => roll.total >= (Number(entry.min) || 0)).pop();
  const band = row ? localize(row.text) : '';
  await roll.toMessage?.({
    speaker: globalThis.ChatMessage?.getSpeaker?.({ actor: ctx.actor }),
    flavor: localize(step.flavor ?? '', { formula: step.formula, band }),
  }, { rollMode: 'blindroll' });
}, { errors: (step, where) => (step.formula ? [] : [`${where}: blindRoll needs a formula`]) });

/* -------------------------------------------- */
/*  endExpiring                                  */
/* -------------------------------------------- */

/** What on this actor ends at the end of its current turn: others' rider marks, timed Conditions in their last round. */
export function endingThisTurn(actor, combat = globalThis.game?.combat) {
  if (!combat) {
    return { marks: [], effects: [] };
  }

  const marks = (actor?.flags?.essence20?.riderMarks ?? []).filter(mark => mark?.combatId == combat.id
    && mark.untilRound == combat.round && mark.untilTurn == combat.turn && mark.by != actor.uuid);
  const effects = (actor?.effects?.filter ? actor.effects.filter(() => true) : []).filter(effect => {
    const rounds = effect.duration?.rounds;
    const start = effect.duration?.startRound;
    return rounds && start != null && start + rounds - 1 <= combat.round && effect.statuses?.size;
  });
  return { marks, effects };
}

/** End them now. */
export async function endNow(actor, combat = globalThis.game?.combat) {
  const { marks, effects } = endingThisTurn(actor, combat);
  if (marks.length) {
    const kept = (actor.flags.essence20.riderMarks ?? []).filter(mark => !marks.includes(mark));
    await actor.setFlag('essence20', 'riderMarks', kept);
  }

  if (effects.length) {
    await actor.deleteEmbeddedDocuments('ActiveEffect', effects.map(effect => effect.id));
  }

  return marks.length + effects.length;
}

registerStep('endExpiring', async (step, ctx) => {
  for (const actor of recipients(step, ctx)) {
    const { marks, effects } = endingThisTurn(actor);
    if (!marks.length && !effects.length) {
      continue;
    }

    if (!step.offer) {
      await endNow(actor);
      continue;
    }

    const names = [...marks.map(mark => mark.label ?? mark.kind), ...effects.map(effect => effect.name)];
    const users = globalThis.game?.users;
    await globalThis.ChatMessage?.create?.({
      speaker: globalThis.ChatMessage.getSpeaker?.({ actor }),
      whisper: (users?.filter?.(user => actor.testUserPermission?.(user, 'OWNER')) ?? []).map(user => user.id),
      content: `<p><strong>${esc(ctx.item?.name ?? '')}</strong> - ${esc(localize('E20.Q1TenacityPrompt', { effects: names.join(', ') }))}</p>
        <button type="button" class="e20-chat-action-button" data-e20-ext="rulesEndExpiring" data-actor-uuid="${actor.uuid}">${esc(localize('E20.Q1TenacityEnd'))}</button>`,
    });
  }
});

registerChatButton('rulesEndExpiring', async (message, button) => {
  const actor = await globalThis.fromUuid?.(button.dataset.actorUuid);
  if (!actor || !(actor.isOwner || globalThis.game?.user?.isGM)) {
    return;
  }

  await endNow(actor);
  button.disabled = true;
});
