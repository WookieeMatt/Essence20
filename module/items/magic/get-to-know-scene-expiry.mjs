import { registerSceneAdvanced } from "../../mechanics/item-hooks.mjs";
import { worldActors } from "../../mechanics/companions/companion-link.mjs";

/**
 * Get To Know (Dark Skies Over Equestria): the spell's Edge lasts "1 Scene" - an unspent Edge (the flag
 * items/magic/get-to-know.mjs banks) goes when the GM starts a new scene.
 */

const GET_TO_KNOW_EDGE_FLAG = 'pendingGetToKnowEdge';

/** Get To Know's unspent Edge lasts the spell's scene. */
export async function getToKnowSceneAdvanced() {
  for (const actor of worldActors()) {
    if (actor.flags?.essence20?.[GET_TO_KNOW_EDGE_FLAG]) {
      await actor.unsetFlag('essence20', GET_TO_KNOW_EDGE_FLAG);
    }
  }
}

registerSceneAdvanced(getToKnowSceneAdvanced);
