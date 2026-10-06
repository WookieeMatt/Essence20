import { registerNamedAction } from "../item-hooks.mjs";
import { ruleActionSkills, spendActionSkill } from "../../rules/plugins/rolls/action-skills.mjs";
import { GIJ, rollDif } from "../../items/shared/gm-relayed-item-writes.mjs";
import { T } from "../../items/shared/item-lang.mjs";
import { feetBetween, firstTargetedActor as firstTarget } from "../../items/shared/sides.mjs";
import { has } from "../../items/shared/item-lookups.mjs";

/**
 * The Heal action: the Core Rules' "restore Health with a Skill Test" as an action anyone can take (on the Actions
 * tab), with the GI Joe Medic Perks that change it - I've Got You / Up And At 'Em's bonuses on a Defeated ally and
 * Proper Protection's critical success on curing poison. (Hearty Meal's Skills are an ActionSkills rule on its
 * Perk; Peaceable's ↑1 on healing rolls and Proper Protection's immunities are rules on their pack items. The
 * medicine-kit reading is items/healing/medicine-kit.mjs; the Defibrillator is items/healing/defibrillator.mjs.)
 */
export const O2_MED = {
  iveGotYou: GIJ('6wbY17kDGkxeGBPp'),
  properProtection: GIJ('CUV2gVVGb7U7yU5J'),
};

export const HEAL_ACTION = 'o2Heal';

/** RAW's DIF to restore Health: "5 + (5 per Health you want to restore)" (GI Joe CRB p.210). */
export const restoreDif = amount => 5 + (5 * amount);

/**
 * GI Joe CRB p.210: "as a Standard action, Science Skill Tests can restore Health to living
 * creatures, and Technology Skill Tests can restore Health to machines (including robots) if they
 * are a target within your reach." The skills this actor may heal with right now.
 */
export function healSkills(actor, { inCombat = !!game.combat } = {}) {
  const skills = ['science', 'technology'];
  // ActionSkills rules (Hearty Meal's Culture / Performance out of combat, once per mission - rules/plugins/rolls/action-skills.mjs).
  const combat = inCombat ? (game.combat ?? { started: true }) : null;
  for (const { skills: more } of ruleActionSkills(actor, 'heal', { combat })) {
    skills.push(...more.filter(skill => !skills.includes(skill)));
  }

  return skills;
}

async function healDialog(actor, target) {
  const skillLabel = s => game.i18n.localize(CONFIG.E20?.skills?.[s] ?? s);
  const skills = healSkills(actor);
  const poisoned = !!target.statuses?.has?.('poisoned');
  const content = `
    <p>${T('O2HealWho', { name: target.name })}</p>
    <div class="form-group"><label>${T('O2HealMode')}</label><select name="mode">
      <option value="heal">${T('O2HealModeHealth')}</option>
      ${poisoned ? `<option value="poison">${T('O2HealModePoison')}</option>` : ''}
    </select></div>
    <div class="form-group"><label>${T('O2PickSkill')}</label><select name="skill">
      ${skills.map(s => `<option value="${s}">${skillLabel(s)}</option>`).join('')}
    </select></div>
    <div class="form-group"><label>${game.i18n.localize('E20.IveGotYouPickAmountLabel')}</label>
      <input type="number" name="amount" min="1" max="6" value="1"/></div>
    <div class="form-group"><label>${T('O2PoisonDif')}</label><input type="number" name="dif" min="0" value="15"/></div>`;
  return foundry.applications.api.DialogV2.wait({
    window: { title: T('O2ActionHeal') },
    classes: ["window-app", "e20-window"],
    content,
    buttons: [
      {
        action: 'ok', label: game.i18n.localize('E20.DialogConfirmButton'), default: true,
        callback: (event, button) => ({
          mode: button.form.elements.mode.value,
          skill: button.form.elements.skill.value,
          amount: Math.max(1, Math.min(6, parseInt(button.form.elements.amount.value) || 1)),
          dif: Math.max(0, parseInt(button.form.elements.dif.value) || 0),
        }),
      },
      { action: 'cancel', label: game.i18n.localize('E20.DialogCancelButton') },
    ],
    rejectClose: false,
  }).then(result => (result && result != 'cancel' ? result : null));
}

/** Heal a target by `amount` - I've Got You / Up And At 'Em add their bonuses on a Defeated ally. */
export async function restoreHealth(healer, target, amount) {
  if (has(healer, O2_MED.iveGotYou)) {
    const { applyIveGotYouHeal } = await import("../../items/healing/i-ve-got-you.mjs");
    return applyIveGotYouHeal(target, amount, healer);
  }

  const { applyHealSkillTestResult } = await import("../../items/healing/heal-skill-test.mjs");
  return applyHealSkillTestResult(target, amount);
}

export async function healAction(actor) {
  const target = firstTarget() ?? actor;
  const distance = target.id == actor.id ? 0 : feetBetween(actor, target);
  if (distance != null && distance > 5) {
    ui.notifications?.warn?.(T('O2NeedTouch'));
    return { cancelled: true };
  }

  const choice = await healDialog(actor, target);
  if (!choice) {
    return { cancelled: true };
  }

  await spendActionSkill(actor, 'heal', choice.skill);

  if (choice.mode == 'poison') {
    const { success } = await rollDif(actor, choice.skill, choice.dif, { o2Heal: true });
    if (!success) {
      return { message: T('O2HealFailed', { name: actor.name, target: target.name }) };
    }

    await target.toggleStatusEffect?.('poisoned', { active: false });
    // Proper Protection: "When you help an ally recover from disease or poison, a successful Skill
    // Test upgrades to a critical success."
    const crit = has(actor, O2_MED.properProtection) ? ` ${T('O2ProperProtectionCrit')}` : '';
    return { message: T('O2PoisonCured', { name: actor.name, target: target.name }) + crit };
  }

  const { success } = await rollDif(actor, choice.skill, restoreDif(choice.amount), { o2Heal: true });
  if (!success) {
    return { message: T('O2HealFailed', { name: actor.name, target: target.name }) };
  }

  await restoreHealth(actor, target, choice.amount);
  return { message: T('O2Healed', { name: actor.name, target: target.name, amount: choice.amount }) };
}

registerNamedAction(HEAL_ACTION, healAction);

// The action on the Actions tab (E20.namedActions is what the tab lists).
globalThis.Hooks?.once?.('i18nInit', () => {
  const actions = CONFIG.E20?.namedActions;
  if (actions && !actions[HEAL_ACTION]) {
    actions[HEAL_ACTION] = { label: T('O2ActionHeal'), type: 'standard' };
  }
});

// Stim Dart (GI Joe CRB, Medic, 15th level, p.82) is a Use rule on the Perk; its Defeated revive goes through
// restoreHealth above (the healAction step - rules/plugins/combat/combat-steps.mjs).
