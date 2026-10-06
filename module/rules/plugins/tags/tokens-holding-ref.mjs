// Rules-engine plug-ins, round 17 (split1 - docs/rules-batches/slSplit117.md): the @tokensHolding reference.
// Registered on import; see module/rules/plugins/index.mjs. Plain Node safe (reads the canvas only when asked).
import { registerRef } from "../../formula.mjs";

/**
 * `@tokensHolding.<16-character compendium id>.<feet>` - how many OTHER tokens in the viewed scene, of any side, stand
 * within that many feet of the actor's token (centre to centre, canvas.grid.measurePath) and belong to an actor holding
 * an item from that compendium entry (any printing - the id is the uuid's last part). 0 off the canvas. Colony
 * Changeling: `min(3, @tokensHolding.FRUWPAePJzm7Mlf0.5)` more Evasion.
 */

const sourceOf = item => item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource ?? null;
const itemsOf = actor => actor?.items?.contents ?? (actor?.items ? [...actor.items] : []);

/** Whether the actor holds an item from the compendium entry with that id. */
function holds(actor, id) {
  return itemsOf(actor).some(item => String(sourceOf(item) ?? '').split('.').pop() == id);
}

export function tokensHolding(actor, id, feet) {
  const own = actor?.getActiveTokens?.()?.[0];
  const canvas = globalThis.canvas;
  const tokens = canvas?.tokens?.placeables;
  if (!own || !Array.isArray(tokens) || !canvas?.grid?.measurePath || !id || !Number.isFinite(feet)) {
    return 0;
  }

  return tokens.filter(token => token !== own && token.actor && holds(token.actor, id)
    && canvas.grid.measurePath([token.center, own.center]).distance <= feet).length;
}

registerRef('tokensHolding', (key, scope, parts) => {
  const [id, feet] = parts;
  return tokensHolding(scope.actor, id, Number(feet));
});
