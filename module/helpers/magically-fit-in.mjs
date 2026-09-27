import { E20 } from "./config.mjs";

/**
 * Mystical Understanding - Magically Fit In (MLP CRB, Spirit of Magic, 1st level, p.93): "You
 * gain ranks in a skill related to where you are or who you're with. For example, if you are at
 * a gym, you could spend Mystical Points to gain ranks in Athletics. The number of ranks you gain
 * is equal to the amount of Mystical Points you spend. These ranks last for the rest of the
 * scene."
 *
 * RE-CATEGORIZED - the ledger's blanket "Spellcasting mastery/rank tracking" tag was only ever
 * true for 3 of Mystical Understanding's 5 benefits (Refocus/Spellcosting/Essential Research -
 * see Spellcialize's own doc comment in dice.mjs). Magically Fit In needs none of that - "ranks"
 * here just means a shiftUp on a chosen Skill, the same currency Awesome/Spared No Expense's own
 * permanent shiftUp already uses, just player-picked at USE time (not build time) and scoped to
 * the rest of the current scene instead of forever. "Related to where you are or who you're with"
 * is the same unenforceable narrative-scoping qualifier this project already drops for Bits To
 * Spare/Truthseeker - the player picks any skill, self-policing the fictional trigger.
 *
 * Only the MOST RECENT activation is tracked (a single {skill, amount} flag, overwritten by a
 * later use) rather than stacking multiple simultaneously-boosted skills - the same "closest
 * deterministic approximation, not a full ledger" idiom Fortify's own single-Defense-choice flag
 * already established, and "for the rest of the scene" has no active clear hook, the same
 * accepted gap Fortify/Hardened Armor's own scene-long grants already live with.
 */
export const MYSTICAL_UNDERSTANDING_ID = "Compendium.essence20.mlp_crb.Item.23NeoRDRxlo0LpyQ";
const MAGICALLY_FIT_IN_FLAG = 'magicallyFitInBonus';

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUseMagicallyFitIn(actor) {
  return !!actor._getBaseRolePoints?.()?.system.resource.value;
}

/**
 * Prompts for which Skill to boost and by how many Mystical Points (ranks), capped at what's
 * actually available.
 * @param {Number} maxAmount
 * @returns {Promise<{skill: String, amount: Number}|null>}
 */
async function pickMagicallyFitInSkillAndAmount(maxAmount) {
  const skillOptions = Object.keys(E20.skills)
    .map(key => `<option value="${key}">${game.i18n.localize(E20.skills[key])}</option>`).join('');
  const skillLabel = game.i18n.localize('E20.MagicallyFitInPickSkillLabel');
  const amountLabel = game.i18n.localize('E20.MagicallyFitInPickAmountLabel');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.MagicallyFitInPickTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${skillLabel}</label><select name="skill">${skillOptions}</select></div>
    <div class="form-group"><label>${amountLabel}</label><input type="number" name="amount" min="1" max="${maxAmount}" value="1" /></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => ({
          skill: button.form.elements.skill.value,
          amount: parseInt(button.form.elements.amount.value),
        }),
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' && Number.isInteger(chosen.amount) && chosen.amount > 0
    ? { skill: chosen.skill, amount: Math.min(chosen.amount, maxAmount) }
    : null;
}

/**
 * Spends the chosen number of Mystical Points and banks that many ranks on the chosen Skill for
 * the rest of the scene.
 * @param {Actor} actor
 */
export async function activateMagicallyFitIn(actor) {
  if (!canUseMagicallyFitIn(actor)) {
    return;
  }

  const mysticalPoints = actor._getBaseRolePoints();
  const chosen = await pickMagicallyFitInSkillAndAmount(mysticalPoints.system.resource.value);
  if (!chosen) {
    return;
  }

  await mysticalPoints.update({ 'system.resource.value': mysticalPoints.system.resource.value - chosen.amount });
  await actor.setFlag('essence20', MAGICALLY_FIT_IN_FLAG, chosen);
}

/**
 * Live, non-consumed read for dice.mjs's own self-status shiftUp computation - see this file's
 * own doc comment for why this has no active end-of-scene clear.
 * @param {Actor} actor
 * @param {String} rolledSkill
 * @returns {Number}
 */
export function getMagicallyFitInBonus(actor, rolledSkill) {
  const bonus = actor?.getFlag?.('essence20', MAGICALLY_FIT_IN_FLAG);
  return bonus?.skill == rolledSkill ? bonus.amount : 0;
}
