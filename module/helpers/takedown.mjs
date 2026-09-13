import { E20 } from "./config.mjs";

/**
 * Takedown (GI Joe CRB, Commando base, 5th level, p.72): "you can make a special attack to
 * incapacitate enemies as a Standard action. Using both hands to make an unarmed Might or Finesse
 * attack against the Toughness of a living target who is surprised or not in combat, and unaware
 * of your presence. If you are successful and the target's threat level is no higher than your
 * level, you deal no damage but inflict the Restrained condition on them and knock them
 * Unconscious for 1d4 minutes (the enemy is awakened if they take damage or if an ally uses an
 * action to wake them). If you miss, or if you succeed but the target's threat level is higher
 * than your level, you instead Grapple your target. If you miss and the target's threat level is
 * higher than your level, your attack has no effect."
 *
 * "Surprised or not in combat, and unaware of your presence" is unenforceable - no Surprised
 * status or target-awareness tracking exists anywhere in this system - the same "player
 * self-polices the fictional trigger" idiom Aiming/Stunning Surprise/Fear My Name already use.
 * "Using both hands" and "unarmed" are narrative flavor with nothing to check against (Takedown
 * deals no damage at all, so this system's own "no parent weapon" unarmed proxy isn't needed
 * here the way it is for a damage-bonus check elsewhere).
 *
 * The player picks Might or Finesse up front (RAW offers either), same single-choice DialogV2
 * shape as elemental-storm.mjs#pickElementalStormCondition, then this triggers a real interactive
 * roll via actor._dice.rollSkill() against the currently-targeted enemy's Toughness - a genuine
 * single-target attack roll, so unlike Absolute Menace/Elemental Storm this doesn't auto-target;
 * it uses whichever one enemy the player already has targeted, the same "aimed at the player's
 * own existing target" shape helpers/duty-of-the-graphite.mjs already establishes. The outcome
 * matrix (hit/miss x threat-level comparison) is applied in dice.mjs's own post-hit processing -
 * see isTakedownAttempt's own comment there. "1d4 minutes" of Unconscious isn't actively expired
 * (no such hook exists anywhere in this codebase) - the same "grant, don't auto-revoke" idiom
 * every other Perk-applied status duration in this project already uses.
 */

/**
 * Prompts for whether this attempt uses Might or Finesse.
 * @returns {Promise<String|null>}   'might'/'finesse', or null if cancelled.
 */
export async function pickTakedownSkill() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.TakedownPickSkillTitle') },
    classes: ["window-app"],
    content: `<p>${game.i18n.localize('E20.TakedownPickSkillLabel')}</p>`,
    modal: true,
    buttons: [
      { label: game.i18n.localize(E20.skills.might), action: 'might' },
      { label: game.i18n.localize(E20.skills.finesse), action: 'finesse' },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Kicks off the Might-or-Finesse-vs-Toughness attempt against the currently-targeted enemy, once
 * a skill has actually been chosen. Returns false (having triggered nothing) if the player
 * cancels the picker.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}
 */
export async function activateTakedown(actor) {
  const skill = await pickTakedownSkill();
  if (!skill) {
    return false;
  }

  await actor._dice.rollSkill({
    skill,
    essence: E20.skillToEssence[skill],
    shiftUp: 0,
    shiftDown: 0,
    defenseType: 'toughness',
    isTakedown: true,
  }, actor);

  return true;
}
