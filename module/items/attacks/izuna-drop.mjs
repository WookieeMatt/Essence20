import { registerChatButton, registerUse } from "../../mechanics/item-hooks.mjs";
import { S1 } from "../shared/terrain-perk-ids-and-readers.mjs";
import { T } from "../shared/item-lang.mjs";
import { sourceOf } from "../shared/item-lookups.mjs";

/**
 * Izuna Drop (Intercontinental Adventures, General Perk, p.30): "If you are falling and an enemy is
 * within 10 feet of you, you can propel yourself towards them and attempt to Grapple them as a Free
 * action. On a success, you maneuver your target into a position beneath you, landing on top of them
 * at the end of your fall. Your target takes all the damage from the fall that you would have taken,
 * but if the fall damage exceeds their Health and renders them Defeated, you take the remaining
 * damage." Falling (GI Joe CRB p.222): "1 damage for every 10 feet it fell, to a maximum of 20
 * damage. The creature lands prone, unless it avoids taking damage from the fall."
 *
 * The Grapple is rolled as the better of Athletics/Acrobatics against the target's Toughness. On a
 * miss the faller simply lands. Damage to a target this user doesn't own goes to the GM as a button.
 */
export function fallDamage(feet) {
  return Math.min(20, Math.floor((Number(feet) || 0) / 10));
}

export function splitIzunaDamage(damage, targetHealth) {
  const absorbed = Math.min(damage, Math.max(0, Number(targetHealth) || 0));
  return { toTarget: damage, overflow: damage - absorbed };
}

async function izunaDrop(item, pay) {
  const actor = item.parent;
  const target = game.user?.targets?.first?.()?.actor;
  if (!target || target.id == actor.id) {
    ui.notifications.warn(T('S1IzunaNoTarget'));
    return null;
  }

  const feet = await foundry.applications.api.DialogV2.wait({
    window: { title: item.name },
    classes: ["window-app", "e20-window"],
    content: `<p>${T('S1IzunaPrompt')}</p><div class="form-group"><input type="number" name="feet" value="30" min="0" step="5"/></div>`,
    buttons: [
      { action: 'ok', label: T('DialogConfirmButton'), default: true, callback: (event, button) => Number(button.form.elements.feet.value) },
      { action: 'cancel', label: T('DialogCancelButton') },
    ],
    rejectClose: false,
  });
  if (typeof feet != 'number' || !(await pay('free'))) {
    return null;
  }

  const damage = fallDamage(feet);
  const skills = actor.system?.skills ?? {};
  const list = CONFIG.E20?.skillShiftList ?? [];
  const better = list.indexOf(skills.acrobatics?.shift) >= 0 && list.indexOf(skills.acrobatics?.shift) < list.indexOf(skills.athletics?.shift)
    ? 'acrobatics' : 'athletics';
  const { rollTest } = await import("../../mechanics/resources/grants.mjs");
  const dif = Number(target.system?.defenses?.toughness?.total) || 10;
  const { success } = await rollTest(actor, better, dif);
  const { applyDamage } = await import("../../mechanics/combat/combat.mjs");

  if (!success) {
    if (damage) {
      await applyDamage(actor, damage, 'blunt');
      await actor.toggleStatusEffect('prone', { active: true });
    }

    return T('S1IzunaMissed', { actor: actor.name, damage });
  }

  const { toTarget, overflow } = splitIzunaDamage(damage, target.system?.health?.value);
  if (target.isOwner) {
    await applyDamage(target, toTarget, 'blunt');
    if (toTarget) {
      await target.toggleStatusEffect('prone', { active: true });
    }
  } else {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p>${T('S1IzunaGmApply', { target: target.name, damage: toTarget })}</p>`
        + `<button type="button" data-e20-ext="s1IzunaDamage" data-target="${target.uuid}" data-damage="${toTarget}">${T('S1IzunaApplyButton')}</button>`,
    });
  }

  if (overflow) {
    await applyDamage(actor, overflow, 'blunt');
  }

  return T('S1IzunaHit', { actor: actor.name, target: target.name, damage: toTarget, overflow });
}

export async function onIzunaButton(message, button) {
  if (!game.user?.isGM) {
    ui.notifications.warn(T('S1GmOnly'));
    return;
  }

  const target = await fromUuid(button.dataset.target);
  const damage = Number(button.dataset.damage) || 0;
  if (!target) {
    return;
  }

  const { applyDamage } = await import("../../mechanics/combat/combat.mjs");
  await applyDamage(target, damage, 'blunt');
  if (damage) {
    await target.toggleStatusEffect('prone', { active: true });
  }

  button.disabled = true;
}

export const IZUNA_DROP_USE = {
  id: 's1-izunaDrop',
  matches: item => sourceOf(item) == S1.izunaDrop,
  run: async (item, economy, pay) => izunaDrop(item, pay),
};

registerChatButton('s1IzunaDamage', onIzunaButton);
registerUse(IZUNA_DROP_USE);
