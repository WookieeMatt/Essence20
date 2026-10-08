import { registerRollSources } from "../../../mechanics/item-hooks.mjs";
import { RULE_TYPES } from "../../types.mjs";
import { ruleId, ruleLabel, rulesOfType } from "../../index.mjs";
import { crewedBy } from "../../links.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";

/**
 * Round 15 (systems - docs/rules-batches/slSystems15.md):
 * - RollModifier `scope: "crewIncoming"` - the rule sits on a vehicle (or Zord) and changes rolls made against someone
 *   aboard it (not against the vehicle itself), the way an `incoming` rule changes rolls against its own holder (a Tinted
 *   Canopy's Snag on Laser attacks at the occupants). `when` sees self = the vehicle, target = the roller, `item:` the rolled
 *   item. One source per book item.
 * - DieSubstitution `scope: "crew"` - a vehicle's rule reaches the rolls of everyone crewing it (Kill Counter's Driving in
 *   place of Intimidation); the linked-scope reading every other crew rule already has.
 */
const ROLL_MODIFIER = RULE_TYPES.RollModifier;
if (ROLL_MODIFIER && !ROLL_MODIFIER.scopes.includes('crewIncoming')) {
  ROLL_MODIFIER.scopes.push('crewIncoming');
}

const DIE_SUBSTITUTION = RULE_TYPES.DieSubstitution;
if (DIE_SUBSTITUTION && !DIE_SUBSTITUTION.scopes.includes('crew')) {
  DIE_SUBSTITUTION.scopes.push('crew');
}

const sourceOf = item => item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource ?? item?.id;

export function crewIncomingSources(roller, target, ctx = {}) {
  const sources = [];
  if (!target || ['vehicle', 'zord'].includes(target.type)) {
    return { sources, consumes: [] };
  }

  const vehicle = crewedBy(target)?.vehicle;
  if (!vehicle) {
    return { sources, consumes: [] };
  }

  const seen = new Set();
  const isAttack = ctx.isAttack ?? ctx.item?.type == 'weaponEffect';
  const facts = { ...ctx, isAttack, isMelee: ctx.isMelee ?? (isAttack && ctx.item?.system?.classification?.style == 'melee') };
  for (const { rule, item, index } of rulesOfType(vehicle, 'RollModifier', 'crewIncoming')) {
    const key = sourceOf(item);
    if (seen.has(key) || evaluate(rule.when, contextFor({ ...facts, self: vehicle, holder: vehicle, ruleItem: item, other: roller })) !== true) {
      continue;
    }

    seen.add(key);
    sources.push({ id: `${ruleId(item, index)}-ci`, label: ruleLabel(rule, item), shiftUp: Number(rule.upshift) || 0, shiftDown: Number(rule.downshift) || 0, edge: !!rule.edge, snag: !!rule.snag });
  }

  return { sources, consumes: [] };
}

registerRollSources(crewIncomingSources);
