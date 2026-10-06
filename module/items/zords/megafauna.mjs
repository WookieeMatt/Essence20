import { ats } from "../shared/personal-power-and-ranger-weapons.mjs";
import { findSourcedAny as findSourced, flagOf } from "../shared/item-lookups.mjs";

/**
 * Zord-side Features: Megafauna (Across the Stars, Zord Feature, p.103) - the Zord's beast form. The form toggle (a
 * Standard action), arriving in form when the Feature is added, Animal Handling for the pilot's Driving, Smarts and Social 3,
 * the Combiner warning, its melee ↑1 and +3 Evasion are the Feature's own rules (rules/conv17-split2.test.js). This keeps
 * "when the Zord answers its Call to Action, it arrives in its Megafauna Form": the summon timer's write
 * (mechanics/vehicles/zord-summon.mjs, flags.essence20.zordSummonReadyRound) carries the form flag with it - no rule event
 * fires there. Rex Feature, Additional Zord, Terrorzord Nature and Phantom Focus: Ship Integration are their items' own
 * rules (module/rules/ext/a/ - scopes ownZord / driven, pick from ownedZords, SummonLimit).
 */

export const ZS = {
  megafauna: ats('c6plguiUVmJzGNsw'),
};

const MEGAFAUNA_FLAG = 'zord1Megafauna';

/** "When the Zord answers its Call to Action, it arrives in its Megafauna Form". */
export function megafaunaOnSummon(zord, changes) {
  const ready = changes?.flags?.essence20?.zordSummonReadyRound;
  if (zord?.type == 'zord' && ready != null && findSourced(zord, ZS.megafauna) && !flagOf(zord, MEGAFAUNA_FLAG)) {
    foundry.utils.setProperty(changes, 'flags.essence20.' + MEGAFAUNA_FLAG, true);
  }
}

// (Additional Zord's one-Zord-per-scene check is its SummonLimit rule's own preUpdateActor hook.)
globalThis.Hooks?.on?.('preUpdateActor', (actor, changes) => {
  if (actor?.type != 'zord') {
    return true;
  }

  megafaunaOnSummon(actor, changes);
  return true;
});
