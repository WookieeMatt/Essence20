import { rebuildIndex, rulesOfType } from "../../index.mjs";
import { contextFor, evaluate, interpolate, isStatic } from "../../predicate.mjs";
import { resolveValue } from "../../formula.mjs";
import { ruleMovementStages } from "../../adapter.mjs";
import { registerDerived } from "../../../helpers/extensions.mjs";

/**
 * Two derived-data stages (round 10, group E):
 *
 *  - DerivedStat `stage: "early"` - applied in documents/actor.mjs#prepareDerivedData right before the poison
 *    training is worked out from system.poisonTraining (_preparePoisonTraining), so a step taken off it changes the
 *    training it gives (Metier). The ordinary DerivedStat pass (rules/adapter.mjs#ruleDerived) skips these.
 *  - Movement `stage: "derived"` - inside the extensions' derived pass (helpers/extensions.mjs#runDerived), before
 *    the `afterDerived` stage multiplies (Yo Joe!'s +10 ft before Shark's Fin's doubling). Actors holding a Movement
 *    rule that reads the combat (combat:, actionUsed, ownTurn) are re-prepared when the round or the action ledger
 *    changes, since neither touches the actor.
 */

const getProperty = (object, key) => key.split('.').reduce((at, part) => (at === null || at === undefined ? at : at[part]), object);

function setProperty(object, key, value) {
  const keys = key.split('.');
  const last = keys.pop();
  keys.reduce((at, part) => (at[part] ??= {}), object)[last] = value;
}

const OPS = {
  set: (current, value) => value,
  multiply: (current, value) => current * value,
  max: (current, value) => Math.max(current, value),
  min: (current, value) => Math.min(current, value),
  add: (current, value) => current + value,
};

/** DerivedStat rules at stage early, on this actor's own items. */
export function earlyDerivedStats(actor) {
  for (const { rule, item } of rulesOfType(actor, 'DerivedStat', 'self')) {
    if (rule.stage != 'early') {
      continue;
    }

    const path = interpolate(String(rule.path ?? ''), item);
    if (!path?.startsWith('system.') || !isStatic(rule.when) || evaluate(rule.when, contextFor({ self: actor, ruleItem: item })) !== true) {
      continue;
    }

    if (typeof rule.value == 'boolean') {
      setProperty(actor, path, rule.value);
      continue;
    }

    const current = getProperty(actor, path);
    if (current !== undefined && !Number.isFinite(Number(current))) {
      continue;
    }

    const value = resolveValue(rule.value, { actor, item }, 0);
    setProperty(actor, path, (OPS[rule.op ?? 'add'] ?? OPS.add)(Number(current) || 0, value));
  }
}

/** Movement rules at stage derived: each Movement type's total, inside the derived pass. */
export function derivedMovement(actor) {
  const stage = ruleMovementStages(actor);
  for (const type of Object.keys(actor?.system?.movement ?? {})) {
    const movement = actor.system.movement[type];
    const next = movement && typeof movement == 'object' ? stage('derived', type, Number(movement.total) || 0) : null;
    if (next !== null) {
      movement.total = next;
    }
  }
}

const COMBAT_TAG = /combat:|actionUsed|ownTurn/;

/** Whether an actor holds a Movement rule whose condition reads the combat. */
export function readsCombat(actor) {
  if (!actor) {
    return false;
  }

  rebuildIndex(actor);
  return rulesOfType(actor, 'Movement').some(({ rule }) => COMBAT_TAG.test(JSON.stringify(rule.when ?? [])));
}

/** Re-prepare the combatants whose Movement rules read the combat. */
export function refreshCombatMovement(combat) {
  const list = combat?.combatants?.contents ?? (combat?.combatants ? [...combat.combatants] : []);
  for (const combatant of list) {
    if (readsCombat(combatant.actor)) {
      combatant.actor.reset?.();
    }
  }
}

export function installDerived() {
  registerDerived(derivedMovement);
  globalThis.Hooks?.on?.('updateCombat', combat => refreshCombatMovement(combat));
  globalThis.Hooks?.on?.('updateCombatant', combatant => {
    if (readsCombat(combatant?.actor)) {
      combatant.actor.reset?.();
    }
  });
}
