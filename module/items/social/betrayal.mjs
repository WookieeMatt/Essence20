/**
 * My Little Pony CRB - Betrayal (Hang-Up). (Self Improvement is items/magic/self-improvement.mjs; Dabbler is an item
 * rule - rules/conv10-slE10.test.js.)
 */
import {
  registerChatButton, registerPostRoll,
} from "../../mechanics/item-hooks.mjs";
import { getSceneEpoch } from "../../mechanics/resources/scene-clock.mjs";
import { O3 } from "../shared/mlp-pr-tf-ids-and-skill-total.mjs";
import { T } from "../shared/item-lang.mjs";
import { escapeHtml as escape, say } from "../shared/chat-lines.mjs";
import { has } from "../shared/item-lookups.mjs";
import { myActor } from "../shared/sides.mjs";
import { worldActors } from "../../mechanics/companions/companion-link.mjs";

/*
 * Betrayal (MLP CRB, Hang-Up, p.59): "If you Lend Assistance to a creature and they fail their Skill
 * Test, you are no longer considered an ally for the purpose of using Perks and other abilities with
 * the rest of the PCs. This lasts for the rest of the scene/encounter, or until one of the other PCs
 * spends a Friendship Point to heal the breach of trust."
 *
 * Every write lands on an actor the writer owns: the pony who failed records who betrayed them on
 * their OWN actor (flags.essence20.o3Betrayal), and the pony who heals the breach records it on
 * theirs (o3BetrayalHealed). isBetrayed reads both across the world. The "not an ally" half is
 * mechanics/combat/nearby-allies.mjs#getNearbyAllyTokens (the one ally test Perks use), patched to skip a pair
 * split by betrayalSplits - see SCRATCH/integration/other3-patch.cjs.
 */
const BETRAYAL_FLAG = 'o3Betrayal';
const HEALED_FLAG = 'o3BetrayalHealed';

export function isBetrayed(actor) {
  if (!actor?.uuid) {
    return false;
  }

  const epoch = getSceneEpoch();
  const records = worldActors().map(other => other.flags?.essence20?.[BETRAYAL_FLAG])
    .filter(record => record?.assister == actor.uuid && record.epoch == epoch);
  if (!records.length) {
    return false;
  }

  const latest = Math.max(...records.map(record => record.at ?? 0));
  const healed = worldActors().some(other => {
    const heal = other.flags?.essence20?.[HEALED_FLAG];
    return heal?.assister == actor.uuid && heal.epoch == epoch && (heal.at ?? 0) >= latest;
  });
  return !healed;
}

/** Whether two PCs are kept from counting as allies by a Betrayal. */
export function betrayalSplits(actor, other) {
  if (!actor || !other || actor === other || actor.uuid == other.uuid) {
    return false;
  }

  if (actor.type != 'playerCharacter' || other.type != 'playerCharacter') {
    return false;
  }

  return isBetrayed(actor) || isBetrayed(other);
}

registerPostRoll(async (actor, results, checkContext) => {
  const assisterUuid = checkContext?.lendAssistanceAssisterUuid;
  if (!assisterUuid || results?.[0]?.success !== false || !actor?.isOwner) {
    return;
  }

  const assister = await fromUuid(assisterUuid);
  if (!assister || !has(assister, O3.betrayal)) {
    return;
  }

  await actor.setFlag('essence20', BETRAYAL_FLAG, { assister: assister.uuid, epoch: getSceneEpoch(), at: Date.now() });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: assister }),
    content: `<p>${T('O3BetrayalLine', { name: escape(assister.name), ally: escape(actor.name) })}</p>`
      + `<button type="button" data-e20-ext="o3BetrayalHeal" data-assister="${assister.uuid}">${T('O3BetrayalHeal')}</button>`,
  });
});

registerChatButton('o3BetrayalHeal', async (message, button) => {
  const assisterUuid = button.dataset.assister;
  const assister = assisterUuid ? await fromUuid(assisterUuid) : null;
  if (!assister || !isBetrayed(assister)) {
    ui.notifications.info(T('O3BetrayalNothing'));
    return;
  }

  const healer = myActor();
  if (!healer || healer.uuid == assisterUuid || !healer.isOwner) {
    ui.notifications.warn(T('O3BetrayalNeedPc'));
    return;
  }

  const { canSpendForActor, spendForActor } = await import("../../mechanics/resources/story-points.mjs");
  if (!canSpendForActor(healer, 1)) {
    ui.notifications.warn(T('O3NoFriendshipPoint'));
    return;
  }

  await spendForActor(healer, 1);
  await healer.setFlag('essence20', HEALED_FLAG, { assister: assisterUuid, epoch: getSceneEpoch(), at: Date.now() });
  await say(healer, T('O3BetrayalHealed', { name: escape(healer.name), other: escape(assister.name) }));
});
