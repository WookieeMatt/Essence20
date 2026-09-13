import { getNearbyEnemyTokens } from "./enemies.mjs";

/**
 * Explosive Morph (A Jump Through Time, Quantum Ranger, Quantum Power option, p.45): "When you
 * activate your Quantum Morph Role Perk, you can create a massive energic explosion around you.
 * You may spend 1 Personal Power to roll an Attack Skill Test using your Technology Skill against
 * all targets within 20 feet of you that deals 1 Energy damage if it hits."
 *
 * "When you activate Quantum Morph" is the narrative trigger, not literally intercepted inside the
 * Morph toggle itself (sheet-handlers/power-ranger-handler.mjs#onMorph is a single, uninterrupted
 * async function already relied on elsewhere - Boosted Vigor/Growth Boost/Powered Plating's own
 * cleanup all run there unconditionally, with no room for a mid-toggle "spend Power?" prompt) -
 * dispatched instead as its own sheet "Use" button (banked-buffs.mjs), gated on actually being
 * Morphed, the same "the player is trusted to use this at the narratively appropriate moment"
 * idiom Powered Plating's own Morphed-only gate already establishes. RAW doesn't name a Defense
 * for the Attack - Evasion is used here (an explosion's blast is dodged, not armored against; the
 * same category of judgment call Duty Of The Graphite's own "a Social skill" default already
 * made), not Toughness.
 *
 * Same Absolute-Menace-style shape as Absolute Menace/Elemental Storm (auto-target every nearby
 * enemy via canvas.tokens.setTargets(), then trigger a real interactive roll via
 * actor._dice.rollSkill() with a synthetic dataset) - the damage itself is threaded through as a
 * synthetic damageValue/damageType, the same "non-weaponEffect Skill Test that still needs to feed
 * the ordinary Apply Damage pipeline" shape Psychoanalyst's own psychoanalystDamage already
 * established in dice.mjs.
 */
const RADIUS_FEET = 20;

/**
 * Targets every enemy within 20ft and kicks off the Technology-vs-Evasion Attack.
 * @param {Actor} actor
 */
export async function activateExplosiveMorph(actor) {
  const enemies = getNearbyEnemyTokens(actor, RADIUS_FEET);
  canvas.tokens.setTargets(enemies.map(token => token.id));

  await actor._dice.rollSkill({
    skill: 'technology',
    essence: 'smarts',
    shiftUp: 0,
    shiftDown: 0,
    defenseType: 'evasion',
    isExplosiveMorph: true,
  }, actor);
}
