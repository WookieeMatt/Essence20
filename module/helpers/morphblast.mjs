import { getNearbyEnemyTokens } from "./enemies.mjs";

/**
 * Morphblast (A Jump Through Time, Grid Power, p.58): "Anytime you assume your Morphed form, you
 * can spend 1 Personal Power to emit a small energic explosion all around you—rolling an Attack
 * using 1d20+1d4 against all adjacent targets that inflicts 1 Energy damage if successful."
 *
 * Near-identical in shape to Explosive Morph (A Jump Through Time, Quantum Ranger, Quantum Power
 * option, p.45) - same Absolute-Menace-style auto-target-and-roll pattern, dispatched as its own
 * sheet "Use" button rather than literally intercepted inside onMorph (that function is a single,
 * uninterrupted async call already relied on elsewhere, with no room for a mid-toggle "spend
 * Power?" prompt) - the player is trusted to click it right after Morphing, the same "narratively
 * appropriate moment" idiom Explosive Morph/Powered Plating's own Morphed-only gates already
 * establish. RAW's own "1d20+1d4" is a flat, unspecified-skill roll with no named Attack skill at
 * all - approximated as Athletics (the same representative default Power Blast's own unspecified-
 * skill-choice RAW already uses), rather than inventing a bespoke non-skill roll formula this
 * engine has no other precedent for. "Adjacent" is read as 5 feet.
 */
const RADIUS_FEET = 5;

/**
 * Targets every enemy within 5ft and kicks off the Athletics-vs-Evasion Attack.
 * @param {Actor} actor
 */
export async function activateMorphblast(actor) {
  const enemies = getNearbyEnemyTokens(actor, RADIUS_FEET);
  canvas.tokens.setTargets(enemies.map(token => token.id));

  await actor._dice.rollSkill({
    skill: 'athletics',
    essence: 'strength',
    shiftUp: 0,
    shiftDown: 0,
    defenseType: 'evasion',
    isMorphblast: true,
  }, actor);
}
