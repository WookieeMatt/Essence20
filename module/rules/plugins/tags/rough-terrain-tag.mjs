// Rules-engine plug-ins, round 15 (rest-other - docs/rules-batches/slOther15.md): the inRoughTerrain tag.
// Registered on import; see module/rules/plugins/index.mjs. The terrain lookup (mechanics/world/environment.mjs) loads at
// `setup`, so this file stays importable under plain Node.
import { registerTag } from "../../predicate.mjs";

let roughLookup = null;

/** Set the lookup outright: (actor) => whether its token stands in Rough Terrain (tests). */
export function setRoughTerrainLookup(fn) {
  roughLookup = typeof fn == 'function' ? fn : null;
}

/** Hand the tag mechanics/world/environment.mjs#isInRoughTerrain (done at setup; tests may call it directly). */
export async function loadRoughTerrainLookup() {
  const { isInRoughTerrain } = await import("../../../mechanics/world/environment.mjs");
  roughLookup = isInRoughTerrain;
}

globalThis.Hooks?.once?.('setup', () => {
  loadRoughTerrainLookup().catch(error => console.error('Essence20 | rough terrain tag lookup failed to load', error));
});

/**
 * self:inRoughTerrain / target:inRoughTerrain - the actor's token stands in a Rough Terrain Region (the scene's terrain
 * data, environment.mjs#isInRoughTerrain). Unknown (null) before the lookup has loaded. Take Point's Cover:
 * Cover {mode: grant, against: true, when: ["self:inRoughTerrain"]}.
 */
function inRough(actor) {
  if (!actor) {
    return false;
  }

  return roughLookup ? !!roughLookup(actor) : null;
}

registerTag('self:inRoughTerrain', (rest, ctx) => inRough(ctx?.self));
registerTag('target:inRoughTerrain', (rest, ctx) => (ctx?.other ? inRough(ctx.other) : false));
