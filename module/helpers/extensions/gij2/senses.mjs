import { G2, hasItem } from "./shared.mjs";

/**
 * Empathetic (GI JOE CRB drone upgrade, p.168): a Robot drone's Social Condition immunity. Acute Sense's
 * ↑1 switch and Enhanced Sensors are item rules now.
 */

/* -------------------------------------------- */
/*  Empathetic                                   */
/* -------------------------------------------- */

// Robot (drone, GI JOE CRB p.168): a drone is "immune to Conditions and effects that exclusively
// affect the living". Empathetic (p.168): "The drone is not immune to Conditions that affect Social
// Essense and Skills." So a drone's robot immunity covers the Social Conditions - Frightened (the
// Intimidation Condition) and Mesmerized ("Any Social tests by the mesmerizer gain Edge") - until it
// takes Empathetic. Nothing enforced the robot half, so Empathetic had nothing to lift; both are
// here: a drone carrying the Robot item and no Empathetic upgrade refuses those two Conditions.
export const SOCIAL_CONDITIONS = ['frightened', 'mesmerized'];

export function robotRefusesCondition(actor, statusId) {
  if (!SOCIAL_CONDITIONS.includes(statusId) || !hasItem(actor, G2.robot)) {
    return false;
  }

  return !hasItem(actor, G2.empathetic);
}

globalThis.Hooks?.on?.('preCreateActiveEffect', (effect) => {
  const actor = effect?.parent;
  if (!actor || actor.documentName != 'Actor') {
    return true;
  }

  for (const statusId of effect.statuses ?? []) {
    if (robotRefusesCondition(actor, statusId)) {
      const label = CONFIG.statusEffects?.find?.(s => s.id == statusId)?.name ?? statusId;
      ui.notifications?.warn?.(game.i18n.format('E20.ConditionImmuneWarning', { actor: actor.name, condition: game.i18n.localize(label) }));
      return false;
    }
  }

  return true;
});

