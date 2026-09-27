import { computeRestoreHealthDif, pickHealSkillTestAmount } from "./heal-skill-test.mjs";
import { getNearbyAllyTokens } from "./allies.mjs";
import { pickAllyTargets } from "./banked-buffs.mjs";

/**
 * Preventative Measures (Transformers CRB, Focus: Medic, 6th level, p.82): "At 6th level, you can
 * treat a healthy ally. As long as the target doesn't have any Damage or Temporary Health, and you
 * haven't used Preventative Measures on them yet today, you can make a Science or Technology Test
 * as though you were Healing or Repairing them. They gain the amount of Temporary Health equal to
 * the amount you would have Healed or Repaired."
 *
 * Same helpers/heal-skill-test.mjs primitive as Patch Up (pick a Skill and an amount, roll against
 * RAW's own DIF = 5 + 5*amount, see that module's own doc comment), but converted into Temp Health
 * (isTempHealth) instead of real Health - the same system.health.bonus grant You Got This!'s own
 * IMMEDIATE_ALLY_PERKS entry already uses. The per-TARGET "haven't used it on them yet today" gate
 * is new - every existing onceEncounterFlag in this codebase gates the GRANTER, never a specific
 * target, so this tracks a per-target id list keyed to the calendar day (the same "X/day approximated
 * by a calendar-day bucket" idiom Consummate Performer's own comment already established, since a
 * Rest-boundary hook doesn't exist either).
 */
export const PREVENTATIVE_MEASURES_ID = "Compendium.essence20.tf_crb.Item.vFuXVVp6vIDFNbci";
const PREVENTATIVE_MEASURES_FLAG = 'preventativeMeasuresTargetsToday';
const MAX_AMOUNT = 6;

function todayBucket() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Whether the given target is still eligible for Preventative Measures - no Damage, no existing
 * Temp Health, and not already treated by this actor today.
 * @param {Actor} actor
 * @param {Actor} targetActor
 * @returns {Boolean}
 */
function isEligibleTarget(actor, targetActor) {
  if (targetActor.system.health.value < targetActor.system.health.max || targetActor.system.health.bonus > 0) {
    return false;
  }

  const usage = actor.getFlag('essence20', PREVENTATIVE_MEASURES_FLAG);
  const treatedToday = usage?.bucket === todayBucket() ? usage.targetIds : [];
  return !treatedToday.includes(targetActor.id);
}

async function markTargetTreatedToday(actor, targetActor) {
  const usage = actor.getFlag('essence20', PREVENTATIVE_MEASURES_FLAG);
  const treatedToday = usage?.bucket === todayBucket() ? usage.targetIds : [];
  await actor.setFlag('essence20', PREVENTATIVE_MEASURES_FLAG, {
    bucket: todayBucket(),
    targetIds: [...treatedToday, targetActor.id],
  });
}

async function pickPreventativeMeasuresSkill() {
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
 * Prompts for a target (a healthy, not-yet-treated-today ally), a Skill, and an amount, then
 * triggers a real Skill Test against RAW's own DIF formula.
 * @param {Actor} actor
 */
export async function activatePreventativeMeasures(actor) {
  const candidateAllies = getNearbyAllyTokens(actor, Infinity)
    .map(token => token.actor)
    .filter(a => a && isEligibleTarget(actor, a));
  const [targetActor] = await pickAllyTargets(actor, candidateAllies, game.i18n.localize('E20.PreventativeMeasuresName'));
  if (!targetActor || !isEligibleTarget(actor, targetActor)) {
    ui.notifications.warn(game.i18n.localize('E20.PreventativeMeasuresNoEligibleTarget'));
    return;
  }

  const skill = await pickPreventativeMeasuresSkill();
  if (!skill) {
    return;
  }

  const amount = await pickHealSkillTestAmount(MAX_AMOUNT);
  if (!amount) {
    return;
  }

  await markTargetTreatedToday(actor, targetActor);

  const dif = computeRestoreHealthDif(amount);
  await actor._dice.rollSkill({
    skill, essence: 'smarts', dif: String(dif), isPreventativeMeasures: true,
    preventativeMeasuresAmount: amount, preventativeMeasuresTargetUuid: targetActor.uuid,
  }, actor);
}
