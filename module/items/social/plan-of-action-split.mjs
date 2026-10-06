import { registerChatButton, registerChatDecorator } from "../../mechanics/item-hooks.mjs";
import { G2, perkUseCard } from "../shared/gij-crb-item-lookups.mjs";
import { TFull as T } from "../shared/item-lang.mjs";
import { escapeHtml as escape, say as post } from "../shared/chat-lines.mjs";
import { has as hasItem } from "../shared/item-lookups.mjs";
import { writeDocResult } from "../shared/relayed-writes.mjs";

/**
 * Plan of Action (GI JOE CRB, Officer, p.85): "At 5th level, you can grant a total of ↑2 to allies, either as ↑1
 * each to two allies or ↑2 to one ally" (↑3 at 9th, ↑4 at 13th, ↑5 at 18th) - mechanics/resources/banked-buffs.mjs
 * gives the whole total to one ally; the use card gets a Split button that moves part of it to a second ally.
 */

/** Write a flag on someone else's actor through the GM when this user can't. */
const setFlagOn = (doc, key, value) => writeDocResult(doc, 'setFlag', ['essence20', key, value]);

export function planSplitDecorator(message, element) {
  if (!element?.querySelector || element.querySelector('.gij2-note')) {
    return;
  }

  const content = element.querySelector('.message-content') ?? element;
  const plan = perkUseCard(message, G2.planOfAction);
  if (plan && (plan.item.system?.advances?.currentValue ?? 1) >= 2 && !hasItem(plan.actor, G2.inspiration)
    && (message.isAuthor || game.user?.isGM)) {
    content.insertAdjacentHTML('beforeend', `<p class="gij2-note"><button type="button" data-e20-ext="gij2PlanSplit" data-actor="${plan.actor.uuid}">${T('E20.Gij2PlanSplit')}</button></p>`);
  }
}

registerChatDecorator(planSplitDecorator);

registerChatButton('gij2PlanSplit', async (message, button) => {
  const officer = await fromUuid(button.dataset.actor);
  const { getPendingBonus, bankPendingBonus } = await import("../../mechanics/characters/perks.mjs");
  const { getNearbyAllyTokens } = await import("../../mechanics/combat/nearby-allies.mjs");
  const allies = getNearbyAllyTokens(officer, Infinity).map(t => t.actor).filter(Boolean);
  const first = allies.find(ally => (getPendingBonus(ally, 'pendingPlanOfAction')?.shiftUp ?? 0) >= 2);
  if (!first) {
    ui.notifications.warn(T('E20.Gij2PlanSplitNothing'));
    return;
  }

  const pending = getPendingBonus(first, 'pendingPlanOfAction');
  const { chooseSelect } = await import("../../mechanics/resources/grants.mjs");
  const secondUuid = await chooseSelect(T('E20.Gij2PlanSplit'), T('E20.Gij2PlanSplitWho', { name: first.name }),
    allies.filter(a => a != first).map(a => ({ value: a.uuid, label: a.name })));
  const second = secondUuid ? await fromUuid(secondUuid) : null;
  if (!second) {
    return;
  }

  const amounts = Array.from({ length: pending.shiftUp - 1 }, (_, i) => i + 1);
  const moved = Number(await chooseSelect(T('E20.Gij2PlanSplit'), T('E20.Gij2PlanSplitHowMany', { name: second.name }),
    amounts.map(n => ({ value: String(n), label: `↑${n}` }))));
  if (!moved) {
    return;
  }

  await setFlagOn(first, 'pendingPlanOfAction', { ...pending, shiftUp: pending.shiftUp - moved });
  const theirs = getPendingBonus(second, 'pendingPlanOfAction');
  if (theirs) {
    await setFlagOn(second, 'pendingPlanOfAction', { ...theirs, shiftUp: (theirs.shiftUp ?? 0) + moved });
  } else if (second.isOwner) {
    await bankPendingBonus(second, 'pendingPlanOfAction', { shiftUp: moved });
  } else {
    await setFlagOn(second, 'pendingPlanOfAction', { shiftUp: moved, combatId: game.combat?.id ?? null, round: game.combat?.round ?? null });
  }

  await post(officer, T('E20.Gij2PlanSplitDone', { first: escape(first.name), a: pending.shiftUp - moved, second: escape(second.name), b: moved }));
});
