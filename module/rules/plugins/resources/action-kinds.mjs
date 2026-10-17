// Rules-engine plug-ins, round 15 (rest-other - docs/rules-batches/slOther15.md): more cost kinds an ActionCost can name.
// Registered on import; see module/rules/plugins/index.mjs.
import { registerActionKind } from "../../actions.mjs";

/**
 * ActionCost `action: "reload"` - reloading a weapon (documents/item.mjs, before a Reload-trait weapon fires again). The
 * cost context's item is the weapon, so `item:` tags read it (`item:isHost` - an upgrade's own weapon). Rapid Reload:
 * {action: reload, to: free}; Ammo Belt: {action: reload, to: free, when: [item:isHost], limit: {per: scene}} (the limit
 * is counted per rule item, so per weapon).
 *
 * ActionCost `action: "morph"` - Morphing (mechanics/characters/morph-state.mjs#payForMorph). Rev Morpher: {action: morph,
 * to: move}.
 */
export const ACTION_KINDS = ['reload', 'morph'];

for (const kind of ACTION_KINDS) {
  registerActionKind(kind);
}
