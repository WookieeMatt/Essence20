import { E20 } from "./config.mjs";

/**
 * Bolster Defense (Finster's Monster-Matic Cookbook, Sorcerous Power, p.272): "DIF 12 Culture
 * (Arcane) Skill Test as a Standard action to increase one Defense by +2 or all Defenses by +1 of
 * a target within 20ft until end of scene."
 *
 * The option (which Defense, or all of them) is picked BEFORE the roll (same "don't spend
 * anything on a cast that will be wasted" idiom Elemental Storm's own pre-roll Condition picker
 * already established) and threaded through the synthetic dataset, alongside whichever token is
 * currently targeted (or the caster themselves if nothing is targeted - RAW allows self as a valid
 * "target within 20ft"). The roll itself is a flat DIF 12 Culture check via
 * actor._dice.rollSkill() (same "trigger a real dialog roll" shape as every other synthetic-roll
 * Power this project has built, but with a flat `dif` instead of a `defenseType`, the same
 * unscoped-DIF shape Watchful Eyes' own DIF 10 Alertness check already established). On success,
 * the chosen bonus is banked directly on the target (dice.mjs's own post-roll processing, gated on
 * `results[0]?.success`), then read live in the per-target checkEntries construction - can't touch
 * `_prepareDefenses`, so this is a live, non-consumed read, same shape as Lightshield Armor/
 * Zeo Crystal Boost's own Defense bonuses. "Until end of scene" has no active clearing hook (this
 * codebase has no scene-boundary event) - left in place until manually cleared, the same
 * "approximate an unenforceable duration, GM manages the edges" idiom this project uses everywhere
 * else for a duration it can't literally track.
 */
const BOLSTER_DEFENSE_FLAG = 'bolsterDefenseActive';

/**
 * @returns {Promise<{mode: String, defenseType: String}|null>}   mode is 'single' or 'all'; null
 *   if cancelled.
 */
export async function pickBolsterDefenseOption() {
  const defenseOptions = Object.keys(E20.defenses)
    .map(key => `<option value="${key}">${game.i18n.localize(E20.defenses[key])}</option>`).join('');
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.BolsterDefensePickOptionTitle') },
    classes: ["window-app"],
    content: `<div class="form-group"><label>${
      game.i18n.localize('E20.BolsterDefensePickOptionLabel')
    }</label><select name="mode">
      <option value="single">${game.i18n.localize('E20.BolsterDefenseSingle')}</option>
      <option value="all">${game.i18n.localize('E20.BolsterDefenseAll')}</option>
    </select></div><div class="form-group"><label>${
  game.i18n.localize('E20.BolsterDefenseSingleTypeLabel')
}</label><select name="defenseType">${defenseOptions}</select></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => (
          { mode: button.form.elements.mode.value, defenseType: button.form.elements.defenseType.value }
        ),
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Prompts for the option, resolves the target (currently targeted, or self), and triggers the
 * DIF 12 Culture (Arcane) roll. The actual bonus is only banked afterward, in dice.mjs's own
 * post-roll success handling.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   False if the picker was cancelled.
 */
export async function activateBolsterDefense(actor) {
  const choice = await pickBolsterDefenseOption();
  if (!choice) {
    return false;
  }

  const targetActor = game.user.targets.first()?.actor ?? actor;
  await actor._dice.rollSkill({
    skill: 'culture', essence: 'smarts', shiftUp: 0, shiftDown: 0, dif: '12',
    isBolsterDefenseAttempt: true, bolsterDefenseMode: choice.mode, bolsterDefenseType: choice.defenseType,
    bolsterDefenseTargetUuid: targetActor.uuid,
  }, actor);
  return true;
}

/**
 * Banks the successful cast's own chosen bonus on the target - called from dice.mjs's own
 * post-roll success handling.
 * @param {Actor} targetActor
 * @param {String} mode          'single' or 'all'.
 * @param {String} defenseType   Only meaningful for 'single'.
 */
export async function applyBolsterDefense(targetActor, mode, defenseType) {
  await targetActor.setFlag('essence20', BOLSTER_DEFENSE_FLAG, { mode, defenseType });
}

/**
 * The live, non-consumed Defense bonus Bolster Defense grants the given target against the given
 * Defense comparison (0 if nothing is banked or it doesn't apply to this Defense).
 * @param {Actor} targetActor
 * @param {String} defenseType
 * @returns {Number}
 */
export function getBolsterDefenseBonus(targetActor, defenseType) {
  const pending = targetActor.getFlag?.('essence20', BOLSTER_DEFENSE_FLAG);
  if (!pending) {
    return 0;
  }

  if (pending.mode == 'all') {
    return 1;
  }

  return pending.mode == 'single' && pending.defenseType == defenseType ? 2 : 0;
}
