/**
 * Hiding (Transformers CRB) - Now You Don't's +5, Pop Out, Telltale Sign, and Hidden In Plain Sight.
 *
 * The Hide action (GI Joe CRB p.196, helpers/named-actions.mjs#hide) is an Infiltration Skill Test
 * and nothing more - no "Hidden" state existed. This file adds a light one: an Infiltration roll the
 * player declares as the Hide action (prechecked when the action economy's last spend was Hide)
 * marks the actor Hidden for the scene (flags.essence20.o3Hidden); attacking ends it ("your Hide
 * benefit ends if you attack"), unless Pop Out keeps it.
 */
import {
  registerApplyDialog, registerChatButton, registerDialogToggles, registerPostRoll,
} from "../../extensions.mjs";
import { getSceneEpoch } from "../../scene-clock.mjs";
import {
  O3, T, escape, has, num, rollSkillTotal, say, writeActor,
} from "./shared.mjs";

const HIDDEN_FLAG = 'o3Hidden';

export function isHidden(actor) {
  const record = actor?.flags?.essence20?.[HIDDEN_FLAG];
  return !!record && record.epoch == getSceneEpoch();
}

async function setHidden(actor, hidden) {
  if (!actor?.isOwner) {
    return;
  }

  if (hidden) {
    await actor.setFlag('essence20', HIDDEN_FLAG, { epoch: getSceneEpoch(), at: Date.now() });
  } else if (actor.flags?.essence20?.[HIDDEN_FLAG]) {
    await actor.unsetFlag('essence20', HIDDEN_FLAG);
  }
}

/** Whether the action economy's most recent spend this turn was the Hide action. */
export function justTookHide(actor) {
  const combat = game?.combat;
  const combatant = combat?.getCombatantsByActor?.(actor)?.[0];
  const log = combatant?.getFlag?.('essence20', 'actions')?.log ?? [];
  return log.length ? log[log.length - 1]?.namedKey == 'hide' : false;
}

registerDialogToggles((actor, ctx) => (ctx?.rolledSkill == 'infiltration'
  ? [{ name: 'o3Hide', label: T('O3HideToggle'), type: 'checkbox', value: justTookHide(actor) }]
  : []));

/*
 * Now You Don't (Transformers CRB, General Perk, p.110): "While in Alt Mode, when taking the Hide
 * action, add 5 to your Skill Test result." (The Cover half is dice.mjs's own hasNowYouDontCover.)
 */
export function nowYouDontBonus(actor) {
  return has(actor, O3.nowYouDont) && actor.system?.isTransformed ? 5 : 0;
}

registerApplyDialog(async (actor, options) => {
  if (!options.ext?.o3Hide) {
    return;
  }

  const bonus = nowYouDontBonus(actor);
  if (bonus) {
    options.skillEffectModifierBonus = num(options.skillEffectModifierBonus) + bonus;
  }

  await setHidden(actor, true);
});

/*
 * Hidden In Plain Sight (Transformers CRB, Infiltrator Focus, 5th level, p.85): "you can Hide, even
 * if you do not have cover, darkness, or another effect that limits the vision of observers." The
 * Hide action above never checks for cover, so this is always satisfied; nothing to gate.
 *
 * Pop Out (p.86): "when you attack while Hidden, you can make an immediate Infiltration Skill Test
 * against the Willpower or Cleverness of the enemies who could have seen you. On a success, you
 * continue to gain the benefits of Hide after your attack." Read as the higher of the two Defenses
 * of every creature attacked; Hidden ends with the attack and is restored on a success.
 */
export function observerDefense(target) {
  const d = target?.system?.defenses ?? {};
  return Math.max(num(d.willpower?.total), num(d.cleverness?.total));
}

registerPostRoll(async (actor, results, checkContext, extra) => {
  if (!checkContext?.isAttack || !isHidden(actor) || !actor.isOwner) {
    return;
  }

  await setHidden(actor, false);
  const targets = (extra?.hits ?? []).map(hit => hit.target).filter(Boolean);
  if (!has(actor, O3.popOut) || !targets.length) {
    return;
  }

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p>${T('O3PopOutPrompt', { name: escape(actor.name) })}</p>`
      + `<button type="button" data-e20-ext="o3PopOut" data-actor="${actor.uuid}" data-targets="${targets.map(t => t.uuid).join(',')}">${T('O3PopOutRoll')}</button>`,
  });
});

registerChatButton('o3PopOut', async (message, button) => {
  const actor = await fromUuid(button.dataset.actor);
  if (!actor?.isOwner || button.dataset.done) {
    return;
  }

  button.dataset.done = '1';
  const targets = (await Promise.all(String(button.dataset.targets ?? '').split(',').filter(Boolean).map(uuid => fromUuid(uuid)))).filter(Boolean);
  const roll = await rollSkillTotal(actor, 'infiltration');
  if (roll?.total == null) {
    return;
  }

  const unseenBy = targets.filter(target => roll.total >= observerDefense(target));
  if (unseenBy.length < targets.length) {
    await say(actor, T('O3PopOutFailed', { name: escape(actor.name) }));
    return;
  }

  await setHidden(actor, true);
  let content = `<p>${T('O3PopOutSuccess', { name: escape(actor.name) })}</p>`;
  // Telltale Sign (p.86): "when you successfully Pop Out, you can use your stealth to Frighten one
  // creature who failed to notice you. Make an Infiltration Skill Test as a Free action, against
  // your target's Willpower or Cleverness. On a success, they are Frightened 1. You can use multiple
  // Free actions to target other creatures, or target the same creature up to three times,
  // increasing the number of rounds they're Frightened by 1 on a successful Skill Test for each Free
  // action you use."
  if (has(actor, O3.telltaleSign)) {
    content += unseenBy.map(target => `<button type="button" data-e20-ext="o3Telltale" data-actor="${actor.uuid}" data-target="${target.uuid}">${T('O3TelltaleFrighten', { target: escape(target.name) })}</button>`).join('');
  }

  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
});

registerChatButton('o3Telltale', async (message, button) => {
  const actor = await fromUuid(button.dataset.actor);
  const target = await fromUuid(button.dataset.target);
  if (!actor?.isOwner || !target) {
    return;
  }

  const count = num(button.dataset.count);
  if (count >= 3) {
    ui.notifications.warn(T('O3TelltaleMax'));
    return;
  }

  if (game.combat) {
    const { spend } = await import("../../action-economy.mjs");
    const paid = await spend(actor, 'free', { source: 'Telltale Sign' });
    if (paid?.blocked) {
      return;
    }
  }

  button.dataset.count = String(count + 1);
  const roll = await rollSkillTotal(actor, 'infiltration');
  if (roll?.total == null || roll.total < observerDefense(target)) {
    await say(actor, T('O3TelltaleMissed', { name: escape(actor.name), target: escape(target.name) }));
    return;
  }

  const rounds = num(button.dataset.rounds) + 1;
  button.dataset.rounds = String(rounds);
  const token = target.getActiveTokens?.()?.[0];
  token?.setTarget?.(true, { releaseOthers: false, groupSelection: true });
  if (target.isOwner) {
    const { applyTimedCondition } = await import("../../timed-status.mjs");
    await applyTimedCondition(target, 'frightened', rounds);
  } else {
    await writeActor(target, 'toggleStatusEffect', ['frightened', { active: true }]);
  }

  await say(actor, T('O3TelltaleFrightened', { name: escape(actor.name), target: escape(target.name), rounds }));
});
