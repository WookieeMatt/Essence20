/**
 * Power Rangers - Through the Shattered Grid's Guardian Blast (Eltarian Guardian).
 */
import { registerChatButton, registerUse } from "../../mechanics/item-hooks.mjs";
import { O3, rollSkillTotal } from "../shared/mlp-pr-tf-ids-and-skill-total.mjs";
import { T } from "../shared/item-lang.mjs";
import { escapeHtml as escape } from "../shared/chat-lines.mjs";
import { isItem } from "../shared/item-lookups.mjs";
import { sameSide, targetedActors, tokenOf } from "../shared/sides.mjs";
import { num } from "../shared/numbers.mjs";
import { worldActors } from "../../mechanics/companions/companion-link.mjs";

/*
 * Guardian Blast (Through the Shattered Grid, Eltarian Guardian, p.73): "You and your allies can
 * make a combined Attack. As a team, with you leading the effort, everyone must spend their full
 * action to move into the same area (within 5 feet of at least 2 other allies) and launch an Attack
 * fueled by Grid energy. You and each ally make a Group Targeting Skill Test. If you hit, the blast
 * deals 5 Energy damage."
 *
 * A Group Skill Test (half or more succeed) against the targeted enemy's Evasion. Each participant
 * rolls from the card on their own client and records the result on their own actor; Resolve tallies.
 */
const GUARDIAN_FLAG = 'o3GuardianBlast';

export function guardianTally(records, count) {
  const successes = records.filter(r => r?.success).length;
  return { successes, rolled: records.filter(Boolean).length, success: count > 0 && successes * 2 >= count };
}

function guardianCard(test) {
  const rows = test.participants.map(uuid => {
    const actor = worldActors().find(a => a.uuid == uuid);
    const record = actor?.flags?.essence20?.[GUARDIAN_FLAG];
    const state = record?.id == test.id ? (record.success ? T('O3Hit') : T('O3Miss')) : '';
    return `<li>${escape(actor?.name ?? uuid)} ${state}<button type="button" data-e20-ext="o3GuardianRoll" data-actor="${uuid}">${T('O3Roll')}</button></li>`;
  }).join('');
  return `<p>${T('O3GuardianBlastCard', { target: escape(test.targetName), dif: test.dif })}</p><ul>${rows}</ul>`
    + `<button type="button" data-e20-ext="o3GuardianResolve">${T('O3Resolve')}</button>`;
}

registerUse({
  id: 'o3GuardianBlast',
  matches: item => isItem(item, O3.guardianBlast),
  run: async (item, economy, pay) => {
    const actor = item.parent;
    const target = targetedActors()[0];
    if (!target) {
      ui.notifications.warn(T('O3NeedTarget'));
      return null;
    }

    const allies = worldActors().filter(a => a.uuid != actor.uuid && tokenOf(a) && sameSide(a, actor) && a.type != 'vehicle');
    const chosen = await foundry.applications.api.DialogV2.wait({
      window: { title: item.name },
      classes: ["window-app", "e20-window"],
      content: `<p>${T('O3GuardianBlastWho')}</p>${allies.map(a => `<label class="flexrow"><input type="checkbox" name="who" value="${a.uuid}" checked /> ${escape(a.name)}</label>`).join('')}`,
      buttons: [
        { action: 'ok', label: game.i18n.localize('E20.DialogConfirmButton'), default: true,
          callback: (event, button) => [...button.form.querySelectorAll('input[name="who"]:checked')].map(i => i.value) },
        { action: 'cancel', label: game.i18n.localize('E20.DialogCancelButton') },
      ],
      rejectClose: false,
    });
    if (!Array.isArray(chosen) || !(await pay('standard'))) {
      return null;
    }

    const test = {
      id: foundry.utils.randomID(), target: target.uuid, targetName: target.name,
      dif: num(target.system?.defenses?.evasion?.total), participants: [actor.uuid, ...chosen],
    };
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: guardianCard(test), flags: { essence20: { [GUARDIAN_FLAG]: test } } });
    return null;
  },
});

registerChatButton('o3GuardianRoll', async (message, button) => {
  const test = message?.flags?.essence20?.[GUARDIAN_FLAG];
  const actor = await fromUuid(button.dataset.actor);
  if (!test || !actor?.isOwner) {
    ui.notifications.warn(T('O3NotYours'));
    return;
  }

  if (actor.flags?.essence20?.[GUARDIAN_FLAG]?.id == test.id) {
    return;
  }

  if (game.combat && actor.uuid != test.participants[0]) {
    const { spend } = await import("../../mechanics/actions/action-economy.mjs");
    if ((await spend(actor, 'standard', { source: 'Guardian Blast' }))?.blocked) {
      return;
    }
  }

  const roll = await rollSkillTotal(actor, 'targeting', { dif: test.dif });
  if (roll) {
    await actor.setFlag('essence20', GUARDIAN_FLAG, { id: test.id, success: roll.success });
    if (message.isOwner) {
      await message.update({ content: guardianCard(test) });
    }
  }
});

registerChatButton('o3GuardianResolve', async (message) => {
  const test = message?.flags?.essence20?.[GUARDIAN_FLAG];
  if (!test || test.resolved) {
    return;
  }

  const records = test.participants.map(uuid => {
    const record = worldActors().find(a => a.uuid == uuid)?.flags?.essence20?.[GUARDIAN_FLAG];
    return record?.id == test.id ? record : null;
  });
  const tally = guardianTally(records, test.participants.length);
  const target = await fromUuid(test.target);
  if (!tally.success || !target) {
    await ChatMessage.create({ content: T('O3GuardianBlastMissed', { hits: tally.successes, count: test.participants.length }) });
    return;
  }

  if (target.isOwner) {
    const { applyDamage } = await import("../../mechanics/combat/combat.mjs");
    await applyDamage(target, 5, 'energy');
    await ChatMessage.create({ content: T('O3GuardianBlastHit', { target: escape(target.name) }) });
  } else {
    await ChatMessage.create({ content: `${T('O3GuardianBlastHit', { target: escape(target.name) })}<button type="button" data-e20-ext="o3GuardianDamage" data-target="${target.uuid}">${T('O3ApplyDamage')}</button>` });
  }

  if (message.isOwner) {
    await message.setFlag('essence20', GUARDIAN_FLAG, { ...test, resolved: true });
  }
});

registerChatButton('o3GuardianDamage', async (message, button) => {
  const target = await fromUuid(button.dataset.target);
  if (!target?.isOwner || button.dataset.done) {
    ui.notifications.warn(T('O3NotYours'));
    return;
  }

  button.dataset.done = '1';
  const { applyDamage } = await import("../../mechanics/combat/combat.mjs");
  await applyDamage(target, 5, 'energy');
});
