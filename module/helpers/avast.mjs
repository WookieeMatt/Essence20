/**
 * Avast! (Quartermaster's Guide to Gear, Freebooter Focus, 10th level, p.27): "Once per combat,
 * as a Move action, make an Intimidation or Performance Skill Test against the Willpower of a
 * living target who can see and hear you. On a success, your target must immediately roll a new
 * Initiative Skill Test and take the lower result. This does not allow the target to take a
 * second turn in the current round."
 *
 * The Skill-Test-vs-Willpower half reuses the same single-target Defense-vs-Defense shape Voice
 * of Primus/Martial Leadership already establish (actor._dice.rollSkill with defenseType:
 * 'willpower', a stamped isXAttempt flag dice.mjs reads post-roll). UNLIKE Voice of Primus (which
 * offers the identical "Intimidation or Performance" wording via a pre-roll picker dialog), this
 * fixes the skill to Intimidation rather than adding a second dialog - this codebase's overnight
 * code pass is restricted from touching lang/en.json this session (no new i18n strings to back a
 * picker), so the choice is collapsed to its more common combat-intimidation half rather than
 * left unbuilt entirely. Widening to a real skill picker (mirroring pickVoiceOfPrimusSkill) is a
 * follow-up once new dialog strings can be added.
 *
 * The Initiative-reroll half is a cross-actor Initiative write like Danger Sense's own
 * syncDangerSenseInitiative, just rerolling through Combat#rollInitiative instead of copying a
 * value, and only keeping the new result if it's WORSE (the target "takes the lower result").
 * "This does not allow the target to take a second turn in the current round" needs no code: this
 * project's Combat Tracker only rolls Initiative to seat a combatant, never to resume their turn.
 * "Living target" and "can see and hear you" are the same unenforced narrative qualifiers this
 * project already accepts elsewhere (see Frightening Display's own "can see you" note).
 */
export const AVAST_ID = "Compendium.essence20.quartermasters_guide_to_gear.Item.Dw5KmScLetUz6Ugg";
export const AVAST_ENCOUNTER_FLAG = 'avastUsedThisEncounter';

/**
 * Resolves the currently-targeted actor and triggers the Intimidation-vs-Willpower roll. The
 * Initiative-reroll only runs afterward, in dice.mjs's own post-roll success handling.
 * @param {Actor} actor
 * @returns {Promise<Actor|null>}   The target actor, or null if nothing was targeted.
 */
export async function activateAvast(actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    return null;
  }

  await actor._dice.rollSkill({
    skill: 'intimidation', shiftUp: 0, shiftDown: 0, defenseType: 'willpower',
    isAvastAttempt: true, avastTargetUuid: targetActor.uuid,
  }, actor);

  return targetActor;
}

/**
 * Rerolls the target's seated Combatant#initiative and keeps whichever result is LOWER - called
 * from dice.mjs's own post-roll success handling, mirroring helpers/danger-sense.mjs's own
 * cross-actor Initiative write.
 * @param {Actor} targetActor
 * @returns {Promise<Boolean>}   Whether the reroll actually happened.
 */
export async function applyAvastInitiativePenalty(targetActor) {
  const combat = game.combat;
  if (!combat) {
    return false;
  }

  const targetCombatant = combat.combatants.find(c => c.actor?.uuid == targetActor.uuid);
  if (!targetCombatant || targetCombatant.initiative == null) {
    return false;
  }

  const oldInitiative = targetCombatant.initiative;
  await combat.rollInitiative([targetCombatant.id]);

  const rerolledCombatant = combat.combatants.get(targetCombatant.id);
  const newInitiative = rerolledCombatant?.initiative;
  if (newInitiative != null && newInitiative > oldInitiative) {
    await rerolledCombatant.update({ initiative: oldInitiative });
  }

  return true;
}
