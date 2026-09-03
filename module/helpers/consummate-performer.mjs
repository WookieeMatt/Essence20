import { findRolePointsItem } from "./reroll.mjs";

/**
 * MLP CRB "Consummate Performer" (Laugh Tactic, p.86): "Roll a Performance Skill Test as a
 * Standard action to regain 1 Cheer. The first time you use Consummate Performer, the DIF of the
 * Performance Skill Test is 5. Every time you use Consummate Performer again on the same day, the
 * DIF goes up by 5."
 *
 * Two halves, split the same way as every other Cheer-spending ability this session touches: the
 * roll itself reuses the existing generic flat-Difficulty Skill Test pipeline (the same minimal
 * {skill, dif} dataset shape as a @Check[...] enricher link, see helpers/enrichers.mjs's own
 * onCheckLinkClick - dice.mjs#rollSkill already fills in everything else from the actor's own
 * Performance skill data), stamped with a consummatePerformer flag so chat.mjs's
 * addConsummatePerformerButton can recognize the resulting message; the "regain 1 Cheer on
 * success" half is a chat-message button, exactly like every reroll grant's own button, since
 * (like rollFailed) success is only known once the roll has actually posted.
 */
const CHEER_POINTS_NAME = "Cheer Points";
const DIF_STEP = 5;

function todayBucket() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The DIF this actor's next Consummate Performer attempt would roll against - 5 the first time
 * today, +5 for every use already made today, reset by the calendar day rather than by Rest (RAW
 * says "on the same day," not "since your last Rest").
 * @param {Actor} actor
 * @returns {Number}
 */
export function getConsummatePerformerDif(actor) {
  const usage = actor.getFlag("essence20", "consummatePerformerUsage");
  const usesToday = usage?.bucket === todayBucket() ? usage.count : 0;
  return DIF_STEP * (usesToday + 1);
}

/**
 * Kicks off the Performance Skill Test at today's current escalating DIF, and records the
 * attempt (win or lose - RAW escalates on use, not on success) against today's bucket. The
 * regain-1-Cheer half happens later, from the resulting chat message's own button (see
 * chat.mjs#addConsummatePerformerButton) once the roll's outcome is actually known.
 * @param {Actor} actor
 */
export async function activateConsummatePerformer(actor) {
  const dif = getConsummatePerformerDif(actor);
  const usage = actor.getFlag("essence20", "consummatePerformerUsage");
  const usesToday = usage?.bucket === todayBucket() ? usage.count : 0;
  await actor.setFlag("essence20", "consummatePerformerUsage", { bucket: todayBucket(), count: usesToday + 1 });

  await actor._dice.rollSkill({
    skill: "performance",
    shiftUp: 0,
    shiftDown: 0,
    dif: String(dif),
    consummatePerformer: true,
  }, actor);
}

/**
 * Sheet-button event wrapper for activateConsummatePerformer() - mirrors sheet-handlers/power-
 * ranger-handler.mjs#onActivatePowerInfusion's own shape.
 * @param {Event} event
 */
export async function onActivateConsummatePerformer(event) {
  const item = await fromUuid(event.target.dataset.uuid);
  if (!item?.parent) {
    return;
  }

  await activateConsummatePerformer(item.parent);
}

/**
 * Grants 1 Cheer (capped at the pool's own max) to the actor who made a successful Consummate
 * Performer attempt, called from the resulting chat message's "Regain 1 Cheer" button. No-ops if
 * the actor's Cheer Points pool can't be found (e.g. the Role was since removed).
 * @param {Actor} actor
 * @returns {Promise<Boolean>}
 */
export async function claimConsummatePerformer(actor) {
  const rolePoints = findRolePointsItem(actor, CHEER_POINTS_NAME);
  if (!rolePoints) {
    return false;
  }

  const newValue = Math.min(rolePoints.system.resource.max, rolePoints.system.resource.value + 1);
  await rolePoints.update({ "system.resource.value": newValue });
  return true;
}
