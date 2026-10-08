import { registerNamedAction } from "../item-hooks.mjs";
import { ruleActionSkills, spendActionSkill } from "../../rules/plugins/rolls/action-skills.mjs";
import { rollDif } from "../../items/shared/gm-relayed-item-writes.mjs";
import { T } from "../../items/shared/item-lang.mjs";
import { feetBetween, firstTargetedActor as firstTarget } from "../../items/shared/sides.mjs";
import { ruleCureNotes } from "../../rules/plugins/combat/subsystem-readers.mjs";
import { healBonuses, runHealBonusSteps } from "../../rules/plugins/resources/heal-bonus.mjs";

/**
 * The Heal action: the Core Rules' "restore Health with a Skill Test" as an action anyone can take (on the Actions
 * tab), with the GI Joe Medic Perks that change it - the healer's HealBonus rules (I've Got You / Up And At 'Em's
 * bonuses on a Defeated ally - rules/plugins/resources/heal-bonus.mjs) and the healer's CureNote rules on curing poison
 * (Proper Protection's critical success). (Hearty Meal's Skills are an ActionSkills rule on its
 * Perk; Peaceable's ↑1 on healing rolls and Proper Protection's immunities are rules on their pack items. The
 * medicine-kit reading is items/healing/medicine-kit.mjs; the Defibrillator is its item's own rules.)
 */
export const HEAL_ACTION = 'o2Heal';

/** RAW's DIF to restore Health: "5 + (5 per Health you want to restore)" (GI Joe CRB p.210). */
export const restoreDif = amount => 5 + (5 * amount);

/**
 * GI Joe CRB p.210: a Standard action heals a target within reach - Science for living creatures,
 * Technology for machines and robots. The skills this actor may heal with right now.
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

/** Heal a target by `amount` - the healer's HealBonus rules (I've Got You / Up And At 'Em on a Defeated ally) add theirs. */
export async function restoreHealth(healer, target, amount) {
  const bonuses = healBonuses(healer, target);
  const { applyHealSkillTestResult } = await import("../../items/healing/heal-skill-test.mjs");
  await applyHealSkillTestResult(target, amount + bonuses.reduce((sum, bonus) => sum + bonus.amount, 0));
  await runHealBonusSteps(healer, target, bonuses);
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
    // CureNote rules - Proper Protection: helping an ally past disease or poison, a success counts as a Critical.
    const notes = ruleCureNotes(actor);
    const crit = notes ? ` ${notes}` : '';
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
