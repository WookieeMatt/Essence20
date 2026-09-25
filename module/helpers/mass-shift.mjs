import { bankPendingBonus, getUsesThisScene, markUsedThisScene } from "./perks.mjs";
import { E20 } from "./config.mjs";

/**
 * Mass Shift (Transformers CRB, Modemaster, base grant, p.73): "Once per scene as a Move action,
 * you can change the composition of your body parts and gain one of the following benefits for
 * the remainder of the scene: +1 to a Defense of your choice; up 1 on Skill Tests of a Skill of
 * your choice; Double your Reach; Gain 1 Temporary Health."
 *
 * Same picker + bank shape as Grid Surge's own catalog (helpers/grid-surge.mjs) - one dialog
 * picking BOTH which benefit and, for the two that need one, which Defense/Skill it applies to.
 * "Two times per day at 1st level, scaling with level (Table 5-10)" has no per-level use-count
 * tracked anywhere on this bare Role Perk item (no system.advances field, unlike e.g. Precision
 * Aim's own currentValue), so this approximates to a flat once/scene, this project's own standard
 * "X/day" idiom (see helpers/trade-school.mjs's own doc comment) simplified further since the
 * scaling table itself isn't represented.
 *
 * - **Defense**: banked via the shared consumeBankedDefenseBonus primitive
 *   (helpers/banked-buffs.mjs), same as Force Field/Stalwart Defense.
 * - **Skill**: banked scoped to one Skill, consumed on the actor's own next matching roll in
 *   dice.mjs (same shape as Grid Surge's own Temporary Construct).
 * - **Reach**: a plain on/off flag read directly by data/item/weapon-effect.mjs#prepareDerivedData
 *   - the same range.reachMultiplier -> totalReach pipeline Extended Attack already established
 *   (helpers/extended-attack.mjs), just its own separate flag since the two Perks are independent
 *   and shouldn't clear each other.
 * - **Temporary Health**: applied immediately (a flat, non-reactive +1 Temp Health, same shape as
 *   Resourceful/Force Field's own temphealth option) rather than banked - nothing to consume later.
 */
export const MASS_SHIFT_ID = "Compendium.essence20.tf_crb.Item.0JiAkBjJzsuezfaI";
const MASS_SHIFT_SCENE_FLAG = 'massShiftUsedThisScene';
export const MASS_SHIFT_DEFENSE_FLAG = 'pendingMassShiftDefense';
export const MASS_SHIFT_SKILL_FLAG = 'pendingMassShiftSkill';
const MASS_SHIFT_REACH_FLAG = 'massShiftReachActive';

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUseMassShift(actor) {
  return getUsesThisScene(actor, MASS_SHIFT_SCENE_FLAG) < 1;
}

/**
 * Whether Mass Shift's own Reach doubling is currently active on this actor.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function isMassShiftReachActive(actor) {
  return !!actor?.getFlag?.('essence20', MASS_SHIFT_REACH_FLAG);
}

/**
 * Prompts for which of the 4 benefits to gain (and, for Defense/Skill, which one) - same combined
 * single-dialog shape as Grid Surge's own pickGridSurgeOption.
 * @returns {Promise<{benefit: String, defenseType: String, skill: String}|null>}
 */
export async function pickMassShiftBenefit() {
  const defenseOptions = ['toughness', 'evasion', 'willpower', 'cleverness']
    .map(key => `<option value="${key}">${game.i18n.localize(E20.defenses[key])}</option>`).join('');
  const skillOptions = Object.keys(E20.skills)
    .map(key => `<option value="${key}">${game.i18n.localize(E20.skills[key])}</option>`).join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.MassShiftPickBenefitTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.MassShiftPickBenefitLabel')
    }</label><select name="benefit">
      <option value="defense">${game.i18n.localize('E20.MassShiftBenefitDefense')}</option>
      <option value="skill">${game.i18n.localize('E20.MassShiftBenefitSkill')}</option>
      <option value="reach">${game.i18n.localize('E20.MassShiftBenefitReach')}</option>
      <option value="temphealth">${game.i18n.localize('E20.MassShiftBenefitTempHealth')}</option>
    </select></div><div class="form-group"><label>${
  game.i18n.localize('E20.MassShiftDefenseLabel')
}</label><select name="defenseType">${defenseOptions}</select></div><div class="form-group"><label>${
  game.i18n.localize('E20.MassShiftSkillLabel')
}</label><select name="skill">${skillOptions}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => ({
          benefit: button.form.elements.benefit.value,
          defenseType: button.form.elements.defenseType.value,
          skill: button.form.elements.skill.value,
        }),
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Marks the scene used and applies whichever benefit was chosen.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   Whether a benefit was actually chosen and applied.
 */
export async function activateMassShift(actor) {
  if (!canUseMassShift(actor)) {
    return false;
  }

  const choice = await pickMassShiftBenefit();
  if (!choice) {
    return false;
  }

  await markUsedThisScene(actor, MASS_SHIFT_SCENE_FLAG);

  if (choice.benefit == 'defense') {
    await bankPendingBonus(actor, MASS_SHIFT_DEFENSE_FLAG, { defenseAmounts: { [choice.defenseType]: 1 } });
  } else if (choice.benefit == 'skill') {
    await bankPendingBonus(actor, MASS_SHIFT_SKILL_FLAG, { skill: choice.skill, shiftUp: 1 });
  } else if (choice.benefit == 'reach') {
    await actor.setFlag('essence20', MASS_SHIFT_REACH_FLAG, true);
  } else if (choice.benefit == 'temphealth') {
    await actor.update({ 'system.health.bonus': (actor.system.health.bonus ?? 0) + 1 });
  }

  return true;
}
