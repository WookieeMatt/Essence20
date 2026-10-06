/**
 * Finster's Monster-Matic Cookbook leftovers: Nemesis Drain's scene expiry. (Incineration Blast's Critical Success burn
 * is the Incineration Blast Effect's own rules, Flames of Hate's armor-ignore an ignoreArmor Defense rule on its two
 * attacks, and Aura of Decay's Health cost the Power's own beforeRoll Trigger.)
 */
import { registerSceneAdvanced } from "../../extensions.mjs";
import { worldActors } from "../../companion-link.mjs";
import { isActiveGm } from "./common.mjs";

/* -------------------------------------------- */
/*  Nemesis Drain                                */
/* -------------------------------------------- */

// Nemesis Drain (p.284): the -1 lasts "until the end of the scene" - helpers/nemesis-drain.mjs never
// cleared it. (Its Toughness-only scope - It's Morphin Time!'s armor is a Toughness bonus - is the
// dice.mjs patch in scratchpad integration/pr2-patch.cjs.)
export const NEMESIS_PENALTY_FLAG = 'nemesisDrainPenaltyActive';

export async function clearNemesisDrain() {
  if (!isActiveGm()) {
    return;
  }

  const actors = new Set(worldActors());
  for (const token of globalThis.canvas?.tokens?.placeables ?? []) {
    if (token.actor) {
      actors.add(token.actor);
    }
  }

  for (const actor of actors) {
    if (actor?.flags?.essence20?.[NEMESIS_PENALTY_FLAG]) {
      await actor.unsetFlag('essence20', NEMESIS_PENALTY_FLAG);
    }
  }
}

registerSceneAdvanced(clearNemesisDrain);
