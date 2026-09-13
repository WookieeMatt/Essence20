import { hasUsedThisEncounter, markUsedThisEncounter } from "./perks.mjs";

/**
 * Two Heads Are Better Than One (Technorganic Secrets, General Perk, p.46, prereq "one of your
 * configurations has two heads"): "You gain ↑1 to Alertness Skill Tests, and you can Lend
 * Assistance to yourself as a Free action once per scene."
 *
 * The ↑1 Alertness half is a plain compendium ActiveEffect. "Lend Assistance to yourself" reuses
 * the real Lend Assistance rule this project already extracted for Spot's own damage-type clause
 * (GI Joe CRB Combat Actions, p.197): "designate a specific target... the first attack against
 * that target gains an Edge" - here the designator and the beneficiary are the same actor, so this
 * is the same "mark a target, consume on the very next matching attack" shape Mark Target/Eye for
 * Appraisal already establish, just granting Edge (not a flat shift) and one-shot (not scene-long
 * or multi-use). The once-per-scene cap gates the DECLARATION (marking a target), not how long the
 * mark can sit unused before being spent - matching this project's own "once per scene to attempt,
 * consumed later" idiom already used elsewhere (e.g. Grid Surge).
 */
const MARK_FLAG = 'twoHeadsAssistanceTargetUuid';
const ENCOUNTER_FLAG = 'twoHeadsAssistanceUsedThisEncounter';

/**
 * Whether the actor can still designate a target this scene.
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function canUseTwoHeadsAreBetterThanOne(actor) {
  return !hasUsedThisEncounter(actor, ENCOUNTER_FLAG);
}

/**
 * Marks the actor's currently-targeted token as their own Lend-Assistance-to-self designee, and
 * marks the scene used.
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   False (nothing marked, nothing spent) if nothing is targeted.
 */
export async function activateTwoHeadsAreBetterThanOne(actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    return false;
  }

  await actor.setFlag('essence20', MARK_FLAG, targetActor.uuid);
  await markUsedThisEncounter(actor, ENCOUNTER_FLAG);
  return true;
}

/**
 * Whether the given target is the actor's own current Two Heads Are Better Than One designee.
 * @param {Actor} actor
 * @param {Actor} target
 * @returns {Boolean}
 */
export function checkTwoHeadsAssistance(actor, target) {
  const markedUuid = actor.getFlag?.('essence20', MARK_FLAG);
  return !!markedUuid && !!target?.uuid && markedUuid == target.uuid;
}

/**
 * Clears the actor's own mark once consumed by a matching attack.
 * @param {Actor} actor
 */
export async function consumeTwoHeadsAssistance(actor) {
  await actor.unsetFlag('essence20', MARK_FLAG);
}
