import { registerAfterDamage, registerChatButton } from "../../mechanics/item-hooks.mjs";
import { getUses, markUsed } from "../../mechanics/resources/scene-clock.mjs";
import { G2 } from "../shared/gij-crb-item-lookups.mjs";
import { TFull as T } from "../shared/item-lang.mjs";
import { escapeHtml as escape, say as post } from "../shared/chat-lines.mjs";
import { findSourced } from "../shared/item-lookups.mjs";
import { dispositionOf } from "../shared/sides.mjs";

/**
 * Queen's Gambit (GI JOE CRB, Grandmaster Focus, 17th level, p.87): "once per combat, when an ally takes damage,
 * an ally you designate moves in the initiative order to right after the effect that caused the damage. This can
 * mean that ally takes two turns this round." Offered on a card whenever an ally of a holder in the combat takes
 * damage; the holder's player picks the ally.
 */

export const QUEENS_FLAG = 'gij2QueensGambit';

async function grantsApi() {
  return import("../../mechanics/resources/grants.mjs");
}

function combatActors(combat) {
  return [...(combat?.combatants ?? [])].map(c => c.actor).filter(Boolean);
}

/**
 * The initiative that sorts a combatant straight after the one acting now: halfway to the next
 * one, or 1 below the current one when it's last.
 */
export function initiativeAfterCurrent(combat) {
  const turns = combat?.turns ?? [];
  const current = turns[combat?.turn ?? 0];
  if (current?.initiative == null) {
    return null;
  }

  const next = turns[(combat.turn ?? 0) + 1];
  return next?.initiative != null ? (current.initiative + next.initiative) / 2 : current.initiative - 1;
}

export async function queensGambitOffer(damaged, dealt) {
  const combat = game.combat;
  if (!(dealt > 0) || !combat?.started || !damaged) {
    return;
  }

  for (const holder of combatActors(combat)) {
    const perk = findSourced(holder, G2.queensGambit);
    if (!perk || getUses(holder, QUEENS_FLAG, 'encounter') > 0 || dispositionOf(holder) != dispositionOf(damaged)) {
      continue;
    }

    const owners = (game.users?.filter?.(u => u.isGM || holder.testUserPermission?.(u, 'OWNER')) ?? []).map(u => u.id);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: holder }),
      whisper: owners,
      content: `<p>${T('E20.Gij2QueensGambitOffer', { name: holder.name, ally: escape(damaged.name), perk: perk.name })}</p>`
        + `<button type="button" data-e20-ext="gij2QueensGambit" data-holder="${holder.uuid}">${escape(perk.name)}</button>`,
    });
  }
}

registerAfterDamage(queensGambitOffer);

registerChatButton('gij2QueensGambit', async (message, button) => {
  const holder = await fromUuid(button.dataset.holder);
  const combat = game.combat;
  if (!holder || !combat) {
    return;
  }

  if (getUses(holder, QUEENS_FLAG, 'encounter') > 0) {
    ui.notifications.warn(T('E20.Gij2AlreadyUsed', { perk: findSourced(holder, G2.queensGambit)?.name ?? "Queen's Gambit" }));
    return;
  }

  let allyUuid = button.dataset.ally;
  if (!allyUuid) {
    const { chooseSelect } = await grantsApi();
    const allies = [...combat.combatants].filter(c => c.actor && dispositionOf(c.actor) == dispositionOf(holder));
    allyUuid = await chooseSelect(findSourced(holder, G2.queensGambit)?.name ?? '', T('E20.Gij2QueensGambitPick'),
      allies.map(c => ({ value: c.actor.uuid, label: c.name })));
  }

  const combatant = [...combat.combatants].find(c => c.actor?.uuid == allyUuid);
  if (!combatant) {
    return;
  }

  if (!game.user.isGM && !combatant.canUserModify?.(game.user, 'update')) {
    // Only the GM can reorder someone else's combatant - hand the GM the finished choice.
    const gms = (game.users?.filter?.(u => u.isGM) ?? []).map(u => u.id);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: holder }),
      whisper: gms,
      content: `<p>${T('E20.Gij2QueensGambitGm', { name: holder.name, ally: escape(combatant.name) })}</p>`
        + `<button type="button" data-e20-ext="gij2QueensGambit" data-holder="${holder.uuid}" data-ally="${allyUuid}">${T('E20.Gij2Apply')}</button>`,
    });
    return;
  }

  const initiative = initiativeAfterCurrent(combat);
  if (initiative == null) {
    return;
  }

  await combatant.update({ initiative });
  await markUsed(holder, QUEENS_FLAG, { window: 'encounter' });
  await post(holder, T('E20.Gij2QueensGambitDone', { name: holder.name, ally: escape(combatant.name) }));
});
