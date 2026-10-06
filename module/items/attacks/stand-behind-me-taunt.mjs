/**
 * Stand Behind Me! (Across the Stars, Gold Ranger, p.53): "force all enemies within 60 feet to make you the target
 * of their attacks unless they succeed on a DIF 14 Alertness Skill Test." The Perk's Use rule spends the Power and
 * stamps the taunt (step stamp, flag standBehindMeActive - rules/plugins/tags/combat-stamps.mjs); here each enemy within 60ft gets a DIF 14 Alertness button at the start of
 * its turn, and one that failed can't attack anyone else.
 */
import { registerChatButton, registerPreRoll, registerTurnStart } from "../../mechanics/item-hooks.mjs";
import { worldActors } from "../../mechanics/companions/companion-link.mjs";
import { PR1 } from "../shared/pr-jtt-ats-item-ids.mjs";
import { TSafe as T } from "../shared/item-lang.mjs";
import { flagOf, hasAny as has } from "../shared/item-lookups.mjs";
import { feetBetweenOrEstimate as feetBetween, isEnemyOf } from "../shared/sides.mjs";
import { numLoose as num } from "../shared/numbers.mjs";
import { postLine } from "../shared/chat-lines.mjs";
import { writeDoc } from "../shared/relayed-writes.mjs";

const TAUNT_FLAG = 'standBehindMeActive';
const TAUNTED_FLAG = 'pr1Taunted';

export function tauntLive(record) {
  const combat = game.combat;
  return !!record && !!combat && record.combatId == combat.id && combat.round - num(record.round) <= 1;
}

export function tauntersNear(actor) {
  return worldActors().filter(other => other?.uuid != actor?.uuid && has(other, PR1.standBehindMe)
    && tauntLive(flagOf(other, TAUNT_FLAG)) && isEnemyOf(other, actor)
    && (feetBetween(other, actor) ?? Infinity) <= 60);
}

registerTurnStart(async (actor) => {
  const record = flagOf(actor, TAUNTED_FLAG);
  for (const taunter of tauntersNear(actor)) {
    if (record?.by == taunter.uuid && tauntLive(record)) {
      continue;
    }

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: taunter }),
      whisper: game.users?.filter?.(u => u.isGM).map(u => u.id) ?? [],
      content: `<p>${T('Pr1TauntCard', { name: actor.name, taunter: taunter.name })}</p>`
        + `<button type="button" class="e20-chat-action-button" data-e20-ext="pr1TauntTest" data-actor="${actor.uuid}" data-taunter="${taunter.uuid}">${T('Pr1TauntButton')}</button>`,
    });
  }
});

registerChatButton('pr1TauntTest', async (message, button) => {
  const actor = await fromUuid(button.dataset.actor);
  const taunter = await fromUuid(button.dataset.taunter);
  if (!actor || !taunter || button.dataset.done) {
    return;
  }

  button.dataset.done = '1';
  button.disabled = true;
  const { rollTest } = await import("../../mechanics/resources/grants.mjs");
  const { success } = await rollTest(actor, 'alertness', 14);
  const combat = game.combat;
  await writeDoc(actor, 'setFlag', ['essence20', TAUNTED_FLAG, {
    by: taunter.uuid, combatId: combat?.id ?? null, round: combat?.round ?? 0, resisted: success,
  }]);
  await postLine(actor, T(success ? 'Pr1TauntResisted' : 'Pr1TauntForced', { name: actor.name, taunter: taunter.name }));
});

/** An attack by a creature forced to target the taunter, at someone else. */
export function tauntBlocks(actor, item, targets) {
  const record = flagOf(actor, TAUNTED_FLAG);
  if (item?.type != 'weaponEffect' || !record || record.resisted || !tauntLive(record)) {
    return null;
  }

  const taunter = globalThis.fromUuidSync?.(record.by);
  if (!taunter || !tauntLive(flagOf(taunter, TAUNT_FLAG))) {
    return null;
  }

  return targets.length && targets.every(t => t?.uuid == taunter.uuid) ? null : taunter;
}

registerPreRoll((actor, dataset, item) => {
  const targets = [...(game.user?.targets ?? [])].map(token => token.actor).filter(Boolean);
  const taunter = tauntBlocks(actor, item, targets);
  if (taunter) {
    ui.notifications.warn(T('Pr1TauntBlocked', { name: actor.name, taunter: taunter.name }));
    dataset.cancelRoll = true;
  }
});
