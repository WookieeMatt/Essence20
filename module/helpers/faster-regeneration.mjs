import { hasUsedThisEncounter, markUsedThisEncounter } from "./perks.mjs";

/**
 * Faster Regeneration (Power Rangers Core Rulebook, Grid Power, p.100): "Your Morphed form can
 * repair damage at an increased rate. You may spend 1 Power to heal 1d2 damage, usable once per
 * scene." The Power cost itself is already spent generically by
 * sheet-handlers/power-handler.mjs#powerCost before onPowerUse ever runs (see that file's own doc
 * comment) - this only needs to roll and apply the heal. "Once per scene" is tracked the same
 * encounter-scoped way every other once-per-scene grant in this project is
 * (hasUsedThisEncounter/markUsedThisEncounter) - there's no canUsePower-equivalent to onPerkUse's
 * own canUsePerk yet to hide the roll button once spent, so a second click this scene still spends
 * (and wastes) another Power, the same accepted "the click already resolved affordability, a
 * repeat click can waste the resource" idiom this project already lives with for several
 * onceEncounterFlag-gated Perks whose own onPerkUse doesn't re-check the flag either.
 */
const FASTER_REGENERATION_ENCOUNTER_FLAG = 'fasterRegenerationUsedThisEncounter';

/**
 * Rolls 1d2 and heals the actor, if Faster Regeneration hasn't already been used this scene.
 * @param {Actor} actor
 * @returns {Promise<Number|null>}   The amount healed, or null if already used this scene.
 */
export async function activateFasterRegeneration(actor) {
  if (hasUsedThisEncounter(actor, FASTER_REGENERATION_ENCOUNTER_FLAG)) {
    return null;
  }

  const healAmount = (await new Roll('1d2', actor.getRollData()).evaluate()).total;
  await actor.update({
    'system.health.value': Math.min(actor.system.health.max, actor.system.health.value + healAmount),
  });
  await markUsedThisEncounter(actor, FASTER_REGENERATION_ENCOUNTER_FLAG);

  return healAmount;
}
