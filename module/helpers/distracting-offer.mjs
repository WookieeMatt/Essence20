import { E20 } from "./config.mjs";
import { bankPendingBonus } from "./perks.mjs";

/**
 * Distracting Offer (Cobra Codex, Corrupt Origin benefit, p.42): "As a Standard action, you can
 * make a Skill Test of your Origin skill against a target's Cleverness. On a failure, you can't
 * use this ability again this scene. On a success, your target suffers -1 on Skill Tests until
 * the beginning of your next turn (doubled on a Critical Success), and you can use this ability
 * again this scene, but only against the same target."
 *
 * Same single-target "trigger a real dialog roll via actor._dice.rollSkill()" shape as Duty Of
 * The Graphite/Menace. The scene-gate itself is genuinely stateful (unlike a plain once-per-scene
 * counter): a failure locks the ability out for the rest of the scene, while a success re-opens
 * it but narrows it to that same target only - tracked via a small {sceneId, failed,
 * succeededTargetUuid} flag rather than the getUsesThisScene/markUsedThisScene counter every other
 * once-per-scene Perk in this project uses, since this needs to remember WHICH outcome happened,
 * not just how many times. "-1 on Skill Tests until the beginning of your next turn" is banked as
 * an unscoped shiftDown consumed on the target's own next roll, the same "next matching roll"
 * duration idiom this project already applies to every other "until X" clause.
 */

const FLAG_KEY = 'distractingOfferState';

function getState(actor) {
  const state = actor.getFlag('essence20', FLAG_KEY);
  const sceneId = game.scenes?.current?.id ?? null;
  return state && state.sceneId === sceneId ? state : null;
}

/**
 * Whether the actor can currently attempt Distracting Offer against the given target.
 * @param {Actor} actor
 * @param {Actor|null} targetActor
 * @returns {Boolean}
 */
export function canUseDistractingOffer(actor, targetActor) {
  const state = getState(actor);
  if (!state) {
    return true;
  }

  if (state.failed) {
    return false;
  }

  return !state.succeededTargetUuid || targetActor?.uuid === state.succeededTargetUuid;
}

export async function activateDistractingOffer(actor) {
  const targetActor = game.user.targets.first()?.actor;
  if (!targetActor) {
    ui.notifications.warn(game.i18n.localize('E20.DistractingOfferNoTarget'));
    return;
  }

  if (!canUseDistractingOffer(actor, targetActor)) {
    ui.notifications.warn(game.i18n.localize('E20.DistractingOfferUnavailable'));
    return;
  }

  const originSkill = actor.system.originSkillsIncrease;
  if (!originSkill) {
    return;
  }

  await actor._dice.rollSkill({
    skill: originSkill,
    essence: E20.skillToEssence[originSkill],
    shiftUp: 0,
    shiftDown: 0,
    defenseType: 'cleverness',
    isDistractingOffer: true,
  }, actor);
}

/**
 * Records the outcome of a Distracting Offer attempt and, on a success, banks the target's own
 * shiftDown penalty (doubled on a Critical Success, this system's own multiplier >= 2 definition).
 * @param {Actor} actor
 * @param {Actor} targetActor
 * @param {Boolean} success
 * @param {Boolean} isCrit
 */
export async function recordDistractingOfferResult(actor, targetActor, success, isCrit) {
  const sceneId = game.scenes?.current?.id ?? null;
  if (!success) {
    await actor.setFlag('essence20', FLAG_KEY, { sceneId, failed: true });
    return;
  }

  await actor.setFlag('essence20', FLAG_KEY, { sceneId, failed: false, succeededTargetUuid: targetActor.uuid });
  await bankPendingBonus(targetActor, 'pendingDistractingOfferShiftDown', { amount: isCrit ? 2 : 1 });
}
