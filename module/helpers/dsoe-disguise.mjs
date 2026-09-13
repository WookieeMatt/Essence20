/**
 * Disguise (Dark Skies Over Equestria, Elementary Aid spell, p.21): "You put on a disguise that
 * gives you an Edge on Deception and Infiltration Skill Tests when you pretend to be another
 * creature of your Origin."
 *
 * Same shape as Observer/Illusory Disguise's own identical "Edge on 2 named skills while a
 * disguise is active" pattern already established twice this arc - a flat-DIF non-Attack cast
 * (Elementary = Routine/10); on success, activates a one-way flag (RAW names no way to end it
 * early) on whichever token is currently targeted, or the caster themselves - granting an
 * unconditional Edge on Deception/Infiltration while active. "When you pretend to be another
 * creature of your Origin" is the same unenforceable narrative qualifier Observer's own identical
 * clause already drops.
 */
const DSOE_DISGUISE_FLAG = 'dsoeDisguiseActive';

export function isDsoeDisguiseActive(actor) {
  return !!actor.getFlag?.('essence20', DSOE_DISGUISE_FLAG);
}

export async function applyDsoeDisguise(targetActor) {
  await targetActor.setFlag('essence20', DSOE_DISGUISE_FLAG, true);
}
