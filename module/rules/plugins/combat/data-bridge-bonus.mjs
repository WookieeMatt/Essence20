import { resolveValue } from "../../formula.mjs";
import { rulesOfType } from "../../index.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Round 15 (dice part): `DataBridgeBonus {max}` - a ranged attack by a Data Bridged actor (items/social/data-bridge.mjs)
 * gains ↑ equal to how many of its allies are Data Bridged, at most `max` (default 3), while the roller or any ally
 * token on the canvas holds the rule (Tactical Triangulation). Read by dice.mjs's ranged-attack block
 * (dataBridgeBonusOf); the source is named after the rule's item.
 */

registerRuleType('DataBridgeBonus', {
  params: { max: { kind: 'formula' } },
  scopes: ['self'],
});

/** The actor's DataBridgeBonus as {max, label}, or null. */
export function dataBridgeBonusOf(actor) {
  const entry = actor ? rulesOfType(actor, 'DataBridgeBonus')[0] : null;
  if (!entry) {
    return null;
  }

  return { max: Math.round(resolveValue(entry.rule.max ?? 3, { actor, item: entry.item }, 3)), label: entry.item?.name ?? '' };
}
