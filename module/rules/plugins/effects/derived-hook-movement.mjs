import { registerDerived } from "../../../mechanics/item-hooks.mjs";

/**
 * Group A: Movement rules at stage `derivedHook`, applied among the derived hooks - before the rules' own DerivedStats
 * (Beneath the Helmet's Bend Physics doubling, the Unique Weapon (Two-Handed Melee)'s -10 ft; Beast Morpher's Cheetah
 * +20 is not doubled). items/index.mjs loads this file at the place among the item files where the registration
 * belongs. It imports only the (import-free) extension registry, so it can load early;
 * rules/plugins/effects/derived-hook-stage.mjs hands in the rules' Movement stages once the engine has loaded. (A
 * teammate prepared before the world loaded is prepared again once it has - ./team-rules-ready-reset.mjs.)
 */

let stagesOf = null;

/** rules/adapter.mjs#ruleMovementStages, handed in by rules/plugins/effects/derived-hook-stage.mjs. */
export function setMovementStages(fn) {
  stagesOf = fn;
}

/** Movement rules of one stage, on every movement type's total. */
export function applyMovementStage(actor, name) {
  const movement = actor?.system?.movement;
  if (!movement || !stagesOf) {
    return;
  }

  const apply = stagesOf(actor);
  for (const [type, speed] of Object.entries(movement)) {
    const next = speed && typeof speed == 'object' ? apply(name, type, Number(speed.total) || 0) : null;
    if (next !== null && next !== undefined) {
      speed.total = next;
    }
  }
}

/** The derivedHook stage (the registered derived function). */
export function applyDerivedHookMovement(actor) {
  applyMovementStage(actor, 'derivedHook');
}

registerDerived(applyDerivedHookMovement);
