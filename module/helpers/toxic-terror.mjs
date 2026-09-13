/**
 * Toxic Terror (Finster's Monster-Matic Cookbook, Path of Venom, 13th level, p.300): "Spend 1
 * Personal Power as a Free action to grant all your unarmed attacks the Alternate Effect: impose
 * a downshift (stacking, +1 per application) to the target's Strength- and Speed-based Skill
 * Tests, until the end of the scene. This benefit to your attacks lasts until the end of the
 * scene."
 *
 * Unlike Psycho Assault/Power Bleed (this book's own turn-scoped Perks), the activation itself
 * lasts the WHOLE SCENE - no active expiry is enforced (the same unenforced-duration idiom used
 * throughout this project), a player switches it back off manually once the scene should have
 * ended. The downshift itself stacks PER TARGET (each unarmed hit against a given target adds
 * another point), banked directly on that target actor - the same "read on the target's own later
 * rolls" shape Pack Mule's identical Strength/Speed downshift already establishes in dice.mjs,
 * just accumulating instead of a flat fixed amount.
 */
const TOXIC_TERROR_ACTIVE_FLAG = 'toxicTerrorActive';
const TOXIC_TERROR_STACKS_FLAG = 'toxicTerrorStacks';
const ACTIVATION_COST = 1;

export function isToxicTerrorActive(actor) {
  return !!actor?.getFlag?.('essence20', TOXIC_TERROR_ACTIVE_FLAG);
}

/**
 * Flips the actor's own Toxic Terror stance. Turning it ON spends 1 Personal Power; turning it
 * back OFF is free.
 * @param {Actor} actor
 * @returns {Promise<Boolean|null>}   The new state, or null if activation couldn't be afforded.
 */
export async function toggleToxicTerror(actor) {
  const nowActive = !isToxicTerrorActive(actor);
  if (nowActive) {
    if ((actor.system.powers?.personal?.value ?? 0) < ACTIVATION_COST) {
      return null;
    }

    await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - ACTIVATION_COST });
  }

  await actor.setFlag('essence20', TOXIC_TERROR_ACTIVE_FLAG, nowActive);
  return nowActive;
}

export function getToxicTerrorShiftDown(targetActor) {
  return targetActor?.getFlag?.('essence20', TOXIC_TERROR_STACKS_FLAG) ?? 0;
}

/**
 * Adds one more stacking point to the target's own downshift.
 * @param {Actor} targetActor
 */
export async function addToxicTerrorStack(targetActor) {
  const current = getToxicTerrorShiftDown(targetActor);
  await targetActor.setFlag('essence20', TOXIC_TERROR_STACKS_FLAG, current + 1);
}
