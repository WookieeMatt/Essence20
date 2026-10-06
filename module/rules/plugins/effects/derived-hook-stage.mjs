import { ruleMovementStages } from "../../adapter.mjs";
import { RULE_TYPES } from "../../types.mjs";
import { setMovementStages } from "./derived-hook-movement.mjs";

/**
 * Group A (round 10): Movement stage `derivedHook` - where ./derived-hook-movement.mjs registers it among the
 * derived hooks (before the rules' own DerivedStats; Bend Physics' doubling, Unique Weapon (Two-Handed Melee)'s -10 ft).
 */

const stage = RULE_TYPES.Movement?.params?.stage;
if (stage?.options && !stage.options.includes('derivedHook')) {
  stage.options.push('derivedHook');
}

// The stage itself is applied by ./derived-hook-movement.mjs (where the slice's call sits); it reads the rules' stages
// from here.
setMovementStages(ruleMovementStages);
