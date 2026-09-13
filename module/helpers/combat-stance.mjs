import { actorHasPerk, hasUsedThisEncounter, markUsedThisEncounter } from "./perks.mjs";
import { getEffectiveLevel } from "./combat.mjs";

/**
 * Combat Stance (Through the Shattered Grid, Magna Defender, 1st level, p.23-24): "...you may
 * designate an enemy you can see and whose Threat Level is not below your level by more than
 * three levels. You prepare to fight your chosen foe by entering into Combat Stance. While in
 * Combat Stance, you gain ↑1 on Attack Skill Tests against your chosen foe. In addition, you may
 * spend 1 Personal Power before making your Attack Skill Test to deal additional damage equal to
 * the Combat Stance number (listed in the table above) if successful, once per Attack. Your
 * Combat Stance lasts until your foe leaves the scene, is Defeated, you return to your natural
 * form, or you end it as a Free action. You can only use this Role Perk once per scene."
 *
 * Same auto-detect-currently-targeted-token idiom as Mark Target/Fight Me! (marks whichever token
 * is currently targeted, rather than a picker dialog - RAW's "designate" is a plain declaration).
 * The level-gap check ("not below your level by more than three") reuses the same
 * getEffectiveLevel PC-Level/NPC-Threat-Level equivalence Just The Facts already established.
 *
 * Table 2-4's own "Combat Stance" column came through OCR extraction too garbled to trust
 * numerically, but Continuous Stance's own prose is unambiguous: "the dice shift you receive on
 * Attacks you make against your chosen foe increases to ↑2." Read literally, "the Combat Stance
 * number" the damage-spend clause references is the SAME number as that shift (both driven by the
 * one "Combat Stance" table value) - so getCombatStanceNumber() below returns a single number (1,
 * or 2 once Continuous Stance is held) used for BOTH the shiftUp grant and the damage bonus,
 * rather than inventing two independently-scaling numbers with no clear RAW source for how the
 * damage half would otherwise scale on its own.
 *
 * The shiftUp itself is consumed in dice.mjs's own per-target checkEntries construction (the same
 * "target-scoped bonus" shape checkMarkTarget already established, isAttack-gated since RAW says
 * "Attack Skill Tests" specifically, unlike Mark Target's own any-Skill-Test scope) - not built
 * here, since it needs no state beyond the marked-foe flag this file exposes. The damage spend is
 * a Roll Options Dialog checkbox, the same "spend 1 Power for +N damage if this hits" shape
 * Driving Strike/Piercing Shot already established - "once per Attack" just means it can be
 * checked on every qualifying Attack (not limited to once ever), unlike the once-per-scene limit
 * on DECLARING a stance in the first place.
 *
 * Ending conditions ("foe leaves the scene," "is Defeated," "you return to your natural form")
 * aren't actively enforced (no scene-boundary/unmorph hook clears the flag) - the same accepted
 * "grant, don't auto-revoke" idiom every other target-marking Perk in this project already uses;
 * "end it as a Free action" is available as simply re-marking a new foe. "Once per scene" gates
 * re-declaring a stance at all (hasUsedThisEncounter) - Continuous Stance (9th level) removes that
 * gate entirely, approximating "you may designate a new one [without using another use of the Role
 * Perk this scene] if your Combat Stance would end due to your enemy being Defeated or leaving the
 * scene" as an unconditional re-declare allowance, since this codebase has no scene-departure/
 * Defeated-transition hook to gate the exception more narrowly.
 */
const COMBAT_STANCE_ID = "Compendium.essence20.through_the_shattered_grid.Item.R2C760BXAI1XKVtm";
const CONTINUOUS_STANCE_ID = "Compendium.essence20.through_the_shattered_grid.Item.yNtX8ky7O8v50C5l";
const COMBAT_STANCE_FLAG = 'combatStanceTargetUuid';
const COMBAT_STANCE_ENCOUNTER_FLAG = 'combatStanceUsedThisEncounter';
const MAX_LEVEL_GAP = 3;

/**
 * The current "Combat Stance number" - see this file's own doc comment for why the shiftUp and
 * damage bonus share one number. 1 normally, 2 once Continuous Stance (9th level) is held.
 * @param {Actor} actor
 * @returns {Number}
 */
export function getCombatStanceNumber(actor) {
  return actorHasPerk(actor, CONTINUOUS_STANCE_ID) ? 2 : 1;
}

/**
 * Whether the actor may declare a (new) Combat Stance right now - always true with Continuous
 * Stance, otherwise gated to once per scene.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canDeclareCombatStance(actor) {
  return actorHasPerk(actor, CONTINUOUS_STANCE_ID) || !hasUsedThisEncounter(actor, COMBAT_STANCE_ENCOUNTER_FLAG);
}

/**
 * Declares Combat Stance against whichever token is currently targeted.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   False (nothing recorded) if there's no target, or the target is
 *   too far below the actor's own level.
 */
export async function declareCombatStance(actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    ui.notifications.warn(game.i18n.localize('E20.CombatStanceNoTarget'));
    return false;
  }

  if (getEffectiveLevel(targetActor) < getEffectiveLevel(actor) - MAX_LEVEL_GAP) {
    ui.notifications.warn(game.i18n.localize('E20.CombatStanceTooWeak'));
    return false;
  }

  await actor.setFlag('essence20', COMBAT_STANCE_FLAG, targetActor.uuid);
  if (!actorHasPerk(actor, CONTINUOUS_STANCE_ID)) {
    await markUsedThisEncounter(actor, COMBAT_STANCE_ENCOUNTER_FLAG);
  }

  return true;
}

/**
 * Whether the given target is the actor's own current Combat Stance foe.
 * @param {Actor} actor
 * @param {Actor} target
 * @returns {Boolean}
 */
export function checkCombatStance(actor, target) {
  const stanceUuid = actor.getFlag?.('essence20', COMBAT_STANCE_FLAG);
  return !!stanceUuid && !!target?.uuid && stanceUuid == target.uuid;
}

export { COMBAT_STANCE_ID };
