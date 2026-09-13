/**
 * Lance of Light (A Jump Through Time, General Perk, p.55): "You can summon a powerful weapon of
 * the Light to your hands by spending 2 Personal Power, lasting until you dismiss it, the scene
 * ends, or until you are Defeated. Upon activating this Perk, you gain the following benefits: You
 * may spend your Standard action to inflict 1 Energy damage to any target within 10 feet without a
 * Skill Test. You have Resistance to Energy damage. Enemies with direct ties to the Dark
 * Dimensions... suffer ↓2 on any Skill Tests against you." Same on/off toggle shape as Power Boost
 * (2 Power to switch ON, free to switch back OFF) - only the Resistance half is built (see its own
 * check alongside the ordinary system.resistances read in dice.mjs's per-target block, scoped to
 * ENERGY_DAMAGE_TYPES rather than writing a permanent system.resistances.element like Hardened
 * Armor/Tough Enough do, since this one needs to turn back OFF when the toggle does). The
 * no-Skill-Test 1 Energy damage action and the named-enemy-only ↓2 (matching a fixed list of Dark
 * Dimension creature types this codebase has no classification for) are both left unbuilt - "spend
 * your Standard action" as a SECOND, independent action off the same Perk item has no precedent
 * anywhere in this project (every other Perk's sheet button is a single activate/deactivate/use
 * dispatch, never two different actions depending on state), and would need new UI to support
 * rather than a quick extension of the existing toggle.
 */
const LANCE_OF_LIGHT_FLAG = 'lanceOfLightActive';

export function isLanceOfLightActive(actor) {
  return !!actor.getFlag?.('essence20', LANCE_OF_LIGHT_FLAG);
}

/**
 * Flips the actor's own Lance of Light stance. Turning it ON spends 2 Personal Power (returns
 * null, spending nothing, if the actor can't afford it); turning it back OFF is free.
 * @param {Actor} actor
 * @returns {Promise<Boolean|null>}
 */
export async function toggleLanceOfLight(actor) {
  const nowActive = !isLanceOfLightActive(actor);
  if (nowActive) {
    if (actor.system.powers.personal.value < 2) {
      return null;
    }

    await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - 2 });
  }

  await actor.setFlag('essence20', LANCE_OF_LIGHT_FLAG, nowActive);
  return nowActive;
}
