import { getNearbyEnemyTokens } from "./enemies.mjs";

// Whirlwind Strike (Power Rangers CRB, Yellow Ranger, 9th level, p.57): "by expending 1 Personal
// Power while Morphed, allow your attack action's melee attacks to target every enemy adjacent to
// you until the end of the round. You still only make a single attack Skill Test, but the result
// is applied to all enemies adjacent to you similar to an Area of Effect ranged attack."
//
// CORRECTED (2026-09-10): an earlier version of this Perk widened
// helpers/multiple-targets.mjs#isMultipleTargetsWeapon, the wrong mechanism - that function (and
// dice.mjs's own isMultipleTargetsAttack it feeds) drives an INDEPENDENT re-roll per target (the
// real "Multiple Targets (X)" weapon trait, p.198 - see Charge Into Battle's own correct use of
// it), the opposite of RAW's own explicit "you still only make a SINGLE attack Skill Test." This
// is the same "Blast/AoE" shape Absolute Menace/Elemental Storm/Explosive Beam already established
// instead - auto-target nearby enemies (getNearbyEnemyTokens), then let the player's own normal
// melee attack roll compare that ONE roll against every selected target's Defense, the system's
// own default multi-target behavior whenever a weapon does NOT carry the Multiple Targets trait.

const RANGE_FEET = 5; // "adjacent" - this system's own closest concrete radius for melee reach.

export function activateWhirlwindStrike(actor) {
  const enemies = getNearbyEnemyTokens(actor, RANGE_FEET);
  canvas.tokens.setTargets(enemies.map(token => token.id));
}
