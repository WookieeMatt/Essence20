/**
 * Group A: Movement rules at stage `derivedHook`, applied where a hand-written slice calls them among the derived hooks
 * (items/social/instructor-legacy-students.mjs - before the rules' own DerivedStats). Imports nothing, so a slice can load it early;
 * rules/plugins/zords/zord-timing-hooks.mjs hands in the rules' Movement stages once the engine has loaded.
 */

let stagesOf = null;

/** rules/adapter.mjs#ruleMovementStages, handed in by rules/plugins/zords/zord-timing-hooks.mjs. */
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
