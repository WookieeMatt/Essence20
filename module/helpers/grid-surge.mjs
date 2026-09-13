import { bankPendingBonus, clearPendingBonus, getPendingBonus } from "./perks.mjs";
import { E20 } from "./config.mjs";

/**
 * Grid Surge (Across the Stars, Silver Ranger, 2nd level, p.57): "As a Standard action, spend one
 * use of Grid Surges to trigger one of the following options" (Table 2-13). Grid Surges itself is
 * the Role's own scaling per-day resource (a `rolePoints` sub-item, already correctly tracked by
 * the generic actor._getBaseRolePoints() lookup Heart of the Team's own spendsRolePoint already
 * uses) - spent here the same way.
 *
 * Of the catalog's four named options, two are buildable now:
 * - **Temporary Construct**: "grants Edge to [a chosen] Skill for 1 hour" - banked scoped to that
 *   one skill (picked in the same dialog), consumed on the actor's own next matching roll in
 *   dice.mjs#_getAutomaticCombatModifiers (same self-status section as Think On It/Inner Magic,
 *   just skill-scoped like Inner Magic's own Spellcasting gate).
 * - **Toughness Boost**: "+1 Toughness (while Morphed) for 1d6×10 minutes, stacking to +3" - banked
 *   as a running total (capped at 3), consumed against the very next incoming Toughness-compared
 *   attack via consumeGridSurgeToughness below, the same "read on someone ELSE's roll" shape
 *   consumeResilience/consumeHardTarget already use, re-checking isMorphed at consumption time
 *   (the actor could un-Morph between banking it and being hit).
 * Both approximate "for N minutes/hours" as "the very next matching roll" - this project's already-
 * established duration idiom (Vulnerability, Inner Magic, Hard Target, etc. all do the same).
 *
 * The other two are deliberately left OUT of the picker dialog itself (the same "don't offer a
 * choice with nothing behind it" idiom pickHobbleCondition/pickDefenseType already follow):
 * - **Reshape the Power Weapon** is purely cosmetic/flavor (nothing to compute).
 * - **Speed up an en-route Zord's arrival** needs new infrastructure (no "Zord en route to the
 *   scene" tracking exists anywhere in this codebase).
 */
export const GRID_SURGE_CONSTRUCT_FLAG = 'pendingGridSurgeConstruct';
const GRID_SURGE_TOUGHNESS_FLAG = 'pendingGridSurgeToughness';
const GRID_SURGE_TOUGHNESS_CAP = 3;

/**
 * Prompts for which Grid Surge option to trigger (and, for Temporary Construct, which Skill to
 * grant Edge on) - a single DialogV2, same shape as pickHobbleCondition/pickDefenseType. The Skill
 * dropdown is only meaningful when Temporary Construct is chosen; it's simply ignored otherwise.
 * @returns {Promise<{option: String, skill: String}|null>}   option is one of 'construct'/
 *   'toughness'/'reshape', or null if cancelled.
 */
export async function pickGridSurgeOption() {
  const skillOptions = Object.keys(E20.skills)
    .map(key => `<option value="${key}">${game.i18n.localize(E20.skills[key])}</option>`).join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.GridSurgePickOptionTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.GridSurgePickOptionLabel')
    }</label><select name="option">
      <option value="construct">${game.i18n.localize('E20.GridSurgeConstruct')}</option>
      <option value="toughness">${game.i18n.localize('E20.GridSurgeToughnessBoost')}</option>
      <option value="reshape">${game.i18n.localize('E20.GridSurgeReshape')}</option>
    </select></div><div class="form-group"><label>${
      game.i18n.localize('E20.GridSurgeConstructSkillLabel')
    }</label><select name="skill">${skillOptions}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => (
          { option: button.form.elements.option.value, skill: button.form.elements.skill.value }
        ),
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Banks whichever effect the chosen Grid Surge option grants - called once the resource spend
 * itself has already been confirmed/paid. A no-op for 'reshape' (nothing to bank - see this file's
 * own doc comment above).
 * @param {Actor} actor
 * @param {{option: String, skill: String}} choice   pickGridSurgeOption's own return value.
 */
export async function applyGridSurgeOption(actor, choice) {
  if (choice.option == 'construct') {
    await bankPendingBonus(actor, GRID_SURGE_CONSTRUCT_FLAG, { skill: choice.skill });
  } else if (choice.option == 'toughness') {
    const pending = getPendingBonus(actor, GRID_SURGE_TOUGHNESS_FLAG);
    const newBonus = Math.min(GRID_SURGE_TOUGHNESS_CAP, (pending?.bonus ?? 0) + 1);
    await bankPendingBonus(actor, GRID_SURGE_TOUGHNESS_FLAG, { bonus: newBonus });
  }
}

/**
 * Reads back a target's own pending Grid Surge Toughness Boost (see this file's own doc comment
 * above) and, if this attack is being compared against Toughness and the target is still Morphed,
 * returns the banked stacking bonus and consumes it - a sibling to consumeHardTarget/
 * consumeResilience, same "read on someone ELSE's roll" shape.
 * @param {Actor} targetActor   The actor being attacked (not the attacker).
 * @param {String} defenseType   The Defense this attack is actually being compared against.
 * @returns {Promise<Number>}   The banked bonus (0 if there's nothing to consume).
 */
export async function consumeGridSurgeToughness(targetActor, defenseType) {
  const pending = getPendingBonus(targetActor, GRID_SURGE_TOUGHNESS_FLAG);
  if (!pending || defenseType != 'toughness' || !targetActor.system.isMorphed) {
    return 0;
  }

  await clearPendingBonus(targetActor, GRID_SURGE_TOUGHNESS_FLAG);
  return pending.bonus;
}
