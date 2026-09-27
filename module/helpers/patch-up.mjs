import { hasUsedThisTurn, markUsedThisTurn } from "./perks.mjs";
import { computeRestoreHealthDif, pickHealSkillTestAmount } from "./heal-skill-test.mjs";

/**
 * Patch Up (Transformers CRB, Focus: Medic, 1st level, p.82): "Once per turn, you can spend an
 * Energon Point to make a Skill Test to Repair a Cybertronian or vehicle, or Heal an organic
 * lifeform as a Free action. You always count as having a Standard Medicine Kit and a Standard
 * Repair Kit on you."
 *
 * The Skill Test itself is the generic "restore Health via a Skill Test" mechanic (Core Rules
 * Combat chapter, p.209-210, DIF = 5 + 5 per Health) - see helpers/heal-skill-test.mjs's own doc
 * comment, built as a reusable primitive rather than a fourth bespoke copy of I've Got You/
 * Regeneration/Mind Over Matter. Patch Up's own twist is which Skill applies (Science for an
 * organic target, Technology for a Cybertronian/vehicle one - the player's own call, the same
 * "trust the player to pick the narratively-correct skill" idiom Mind Over Matter's own dropdown
 * already uses) and the Free-action/once-per-turn/1-Energon gate around it. The "always count as
 * having a kit" clause is left unenforced, matching this codebase's own established idiom for
 * kit-possession clauses (see Remove & Rebuild's own comment in helpers/banked-buffs.mjs - "no
 * inventory-item-gating concept exists").
 */
export const PATCH_UP_ID = "Compendium.essence20.tf_crb.Item.Jlfb8iPvT7JFvcxv";
const PATCH_UP_TURN_FLAG = 'patchUpUsedThisTurn';
const MAX_AMOUNT = 6;

/**
 * Prompts for which Skill this Repair/Heal uses - Science for an organic target, Technology for a
 * Cybertronian or vehicle, per RAW's own split.
 * @returns {Promise<String|null>}
 */
async function pickPatchUpSkill() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.PatchUpPickSkillTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${game.i18n.localize('E20.PatchUpPickSkillLabel')}</label>
      <select name="skill">
        <option value="science">${game.i18n.localize('E20.SkillScience')}</option>
        <option value="technology">${game.i18n.localize('E20.SkillTechnology')}</option>
      </select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.skill.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Whether Patch Up is still available this turn - a plain once-per-turn gate (see
 * helpers/perks.mjs's own hasUsedThisTurn doc comment), same as Growl's own per-turn cap.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUsePatchUp(actor) {
  return !hasUsedThisTurn(actor, PATCH_UP_TURN_FLAG) && actor.system.energon?.normal?.value >= 1;
}

/**
 * Prompts for a Skill and a Health amount, spends the Energon Point, marks the turn used, and
 * triggers a real Skill Test against RAW's own DIF formula, targeting whichever ally is currently
 * targeted (or the actor themselves with nothing targeted, the same "aid another character, or
 * yourself" resolution Regeneration already established).
 * @param {Actor} actor
 */
export async function activatePatchUp(actor) {
  if (!canUsePatchUp(actor)) {
    ui.notifications.warn(game.i18n.localize('E20.PatchUpUnavailable'));
    return;
  }

  const skill = await pickPatchUpSkill();
  if (!skill) {
    return;
  }

  const amount = await pickHealSkillTestAmount(MAX_AMOUNT);
  if (!amount) {
    return;
  }

  await actor.update({ 'system.energon.normal.value': actor.system.energon.normal.value - 1 });
  await markUsedThisTurn(actor, PATCH_UP_TURN_FLAG);

  const dif = computeRestoreHealthDif(amount);
  await actor._dice.rollSkill({
    skill, essence: 'smarts', dif: String(dif), isPatchUp: true, patchUpAmount: amount,
  }, actor);
}
