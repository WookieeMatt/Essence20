import { registerApplyDialog, registerDialogToggles, registerRollSources } from "../../extensions.mjs";
import { G2, T, allSourced, findSourced, hasItem } from "./shared.mjs";

/**
 * Acute Sense (GI JOE CRB, General Perk, p.129) and the drone upgrades that lean on it: Enhanced
 * Sensors (p.168) and Empathetic (p.168).
 */

/* -------------------------------------------- */
/*  Acute Sense's second bullet / Enhanced Sensors */
/* -------------------------------------------- */

// Acute Sense (p.129): "You may gain a ↑1 dice shift on a non-Alertness Skill Test where you can
// apply some use of your chosen Sense." The Alertness Edge bullet already lives in dice.mjs
// (ACUTE_SENSE_IDS). Whether the sense applies is the player's call, so this is a Roll Options
// Dialog checkbox on every non-Alertness test, naming the chosen sense(s).
//
// Enhanced Sensors (drone upgrade, p.168): "The drone gains the benefit of the Acute Senses General
// Perk. This upgrade can be taken multiple times, applying the benefit each time to an additional
// sense." The upgrade sits on the drone companion actor, so the drone gets both halves: the
// Alertness Edge as a listed source and the same ↑1 checkbox.
export const ACUTE_TOGGLE = 'gij2AcuteSense';

function senseLabel(value) {
  const key = CONFIG.E20?.senses?.[value];
  return key ? game.i18n.localize(key) : (value || '');
}

/** The senses this actor's Acute Sense copies were chosen for, and how many Enhanced Sensors it has. */
export function acuteSensesOf(actor) {
  const senses = allSourced(actor, G2.acuteSense).map(item => senseLabel(item.system?.choice)).filter(Boolean);
  const sensors = allSourced(actor, G2.enhancedSensors).length;
  return { perk: hasItem(actor, G2.acuteSense), senses, sensors };
}

export function acuteSenseSources(actor, target, { rolledSkill } = {}) {
  // Enhanced Sensors' Alertness Edge - skipped when a real Acute Sense already gives it in dice.mjs.
  if (rolledSkill == 'alertness' && hasItem(actor, G2.enhancedSensors)
    && ![G2.acuteSense, G2.acuteSenseTf, G2.acuteSensePr].some(uuid => hasItem(actor, uuid))) {
    return { sources: [{ id: 'gij2EnhancedSensors', label: findSourced(actor, G2.enhancedSensors).name, edge: true }] };
  }

  return null;
}

export function acuteSenseToggles(actor, { rolledSkill } = {}) {
  if (!rolledSkill || rolledSkill == 'alertness') {
    return [];
  }

  const { perk, senses, sensors } = acuteSensesOf(actor);
  if (!perk && !sensors) {
    return [];
  }

  const name = perk ? findSourced(actor, G2.acuteSense).name : findSourced(actor, G2.enhancedSensors).name;
  const which = senses.length ? senses.join(', ') : T('E20.Gij2AcuteSenseAnySense');
  return [{ name: ACUTE_TOGGLE, label: T('E20.Gij2AcuteSenseToggle', { perk: name, senses: which }), type: 'checkbox' }];
}

export function acuteSenseApply(actor, options) {
  if (options?.ext?.[ACUTE_TOGGLE]) {
    options.shiftUp = (Number(options.shiftUp) || 0) + 1;
  }
}

registerRollSources(acuteSenseSources);
registerDialogToggles(acuteSenseToggles);
registerApplyDialog(acuteSenseApply);

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

