/**
 * Outwit (GI Joe CRB, Focus: Battlefield Psychologist, 3rd level, p.86): "As a Standard action,
 * you can target an enemy who can see or hear you with a Deception Skill Test to stun them for
 * one turn, or an Intimidation Skill Test to make them flee for 1 round. The duration multiplies
 * on a critical success. This is treated as a Condition."
 *
 * "Can see or hear you" is unenforceable (no line-of-sight/hearing tracking anywhere in this
 * system) - same "player self-polices the fictional trigger" idiom this project already uses
 * elsewhere. "Stun" and "make them flee" are both explicitly "treated as a Condition" by RAW's own
 * text - read as the real Stunned and Frightened statuses respectively (Frightened being this
 * system's own existing mechanical translation of "fleeing in fear," the same reading Menacing
 * Glare/Absolute Menace's own "Frightened" grants already use), not the separate Stun DAMAGE type.
 * "The duration multiplies on a critical success" has no hook to express - Conditions in this
 * system are a plain on/off toggle with no duration counter to multiply (the same "approximate,
 * don't hard-enforce a duration" idiom this project already accepts everywhere else) - applied
 * unconditionally on any success, not gated on the roll's own Degrees-of-Success multiplier.
 *
 * The player picks Deception or Intimidation up front (RAW offers either, each with its own
 * Condition and compared Defense - Deception vs Cleverness, matching Trustworthy's own
 * Deception-vs-Cleverness convention; Intimidation vs Willpower, matching Indomitable/Menacing
 * Glare's own Intimidation-vs-Willpower convention), same single-choice DialogV2 shape as
 * helpers/takedown.mjs#pickTakedownSkill, then this triggers a real interactive roll via
 * actor._dice.rollSkill() against the currently-targeted enemy's Defense - single-target, no
 * auto-targeting, the same "aimed at the player's own existing target" shape
 * helpers/duty-of-the-graphite.mjs already establishes. The outcome (which Condition to apply) is
 * decided up front and threaded through the roll's own dataset/checkContext, the same shape
 * Elemental Storm's own up-front Condition choice already uses - see isOutwitAttempt's own
 * comment in dice.mjs for the post-hit application.
 */

const OUTWIT_OPTIONS = {
  deception: { defenseType: 'cleverness', condition: 'stunned' },
  intimidation: { defenseType: 'willpower', condition: 'frightened' },
};

/**
 * Prompts for whether this attempt uses Deception (Stun) or Intimidation (Frighten/flee).
 * @returns {Promise<String|null>}   'deception'/'intimidation', or null if cancelled.
 */
export async function pickOutwitSkill() {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.OutwitPickSkillTitle') },
    classes: ["window-app", "e20-window"],
    content: `<p>${game.i18n.localize('E20.OutwitPickSkillLabel')}</p>`,
    modal: true,
    buttons: [
      { label: game.i18n.localize('E20.OutwitDeceptionButton'), action: 'deception' },
      { label: game.i18n.localize('E20.OutwitIntimidationButton'), action: 'intimidation' },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  return chosen && chosen != 'cancel' ? chosen : null;
}

/**
 * Kicks off the Deception-or-Intimidation-vs-Defense attempt against the currently-targeted
 * enemy, once a skill has actually been chosen. Returns false (having triggered nothing) if the
 * player cancels the picker.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}
 */
export async function activateOutwit(actor) {
  const skill = await pickOutwitSkill();
  if (!skill) {
    return false;
  }

  const { defenseType, condition } = OUTWIT_OPTIONS[skill];
  await actor._dice.rollSkill({
    skill,
    essence: 'social',
    shiftUp: 0,
    shiftDown: 0,
    defenseType,
    isOutwit: true,
    outwitCondition: condition,
  }, actor);

  return true;
}
