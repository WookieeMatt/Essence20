// Round 15 (items1): rule type TargetedDefense and the incomingAura scope - Scramble, Shield Modulation.
import { registerRollSources } from "../../../mechanics/item-hooks.mjs";
import { RULE_TYPES, registerRuleType } from "../../types.mjs";
import { ruleId, ruleLabel, rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";

/**
 * `TargetedDefense {defense}` (on the defender) - attacks and rolls against the holder target that Defense, whatever
 * Defense they would use: dice.mjs's per-target Defense is set to it where the hand-written "the Defense an attack
 * targets" overrides sit (after Ballistic / Grapple and Fly In The Future, before Fast Draw and Superstructure). `when`
 * sees self = the holder, target = the roller, `item:` the rolled item. The last rule that holds wins.
 */
const DEFENSES = ['toughness', 'evasion', 'willpower', 'cleverness'];
registerRuleType('TargetedDefense', {
  params: { defense: { kind: 'enum', required: true, options: DEFENSES } },
  scopes: ['self'],
});

/**
 * The Defense a roll against `defender` must use, or null to keep its own.
 * @param {Actor} defender
 * @param {?Actor} roller
 * @param {?Item} item   The rolled item.
 */
export function ruleTargetedDefense(defender, roller, item = null) {
  let defense = null;
  for (const { rule, item: ruleItem } of rulesOfType(defender, 'TargetedDefense')) {
    const isAttack = item?.type == 'weaponEffect';
    const ctx = contextFor({ self: defender, holder: defender, ruleItem, other: roller, item, isAttack, isMelee: isAttack && item.system?.classification?.style == 'melee' });
    if (evaluate(rule.when, ctx) === true) {
      defense = rule.defense;
    }
  }

  return defense;
}

/**
 * RollModifier `scope: "incomingAura"` + `radius` (feet): on rolls made against an ALLY of the holder - a token of the
 * holder's disposition, not the holder's own, whose center is within `radius` of the holder's (the grid's measured
 * path) - the way an `incoming` rule works on rolls against the holder itself (Shield Modulation's Snag for the allies
 * its Shield Upgrade covers). `when` sees self = the holder, target = the roller, `item:` the rolled item. One source
 * per book item, however many holders reach the target.
 */
const ROLL_MODIFIER = RULE_TYPES.RollModifier;
if (ROLL_MODIFIER && !ROLL_MODIFIER.scopes.includes('incomingAura')) {
  ROLL_MODIFIER.scopes.push('incomingAura');
  ROLL_MODIFIER.params.radius ??= { kind: 'number' };
}

const sourceOf = item => item?.flags?.core?.sourceId ?? item?._stats?.compendiumSource ?? item?.flags?.essence20?.rulesSource ?? item?.id;

export function incomingAuraSources(roller, target, ctx = {}) {
  const sources = [];
  const targetToken = target?.getActiveTokens?.()?.[0];
  const placeables = globalThis.canvas?.tokens?.placeables;
  const grid = globalThis.canvas?.grid;
  if (!targetToken || !Array.isArray(placeables) || !grid?.measurePath) {
    return { sources, consumes: [] };
  }

  const seen = new Set();
  const isAttack = ctx.isAttack ?? ctx.item?.type == 'weaponEffect';
  for (const token of placeables) {
    const holder = token?.actor;
    if (!holder || token === targetToken || holder === target || token.document?.disposition !== targetToken.document?.disposition) {
      continue;
    }

    for (const { rule, item, index } of rulesOfType(holder, 'RollModifier', 'incomingAura')) {
      const key = sourceOf(item);
      if (seen.has(key) || grid.measurePath([token.center, targetToken.center]).distance > (Number(rule.radius) || 0)) {
        continue;
      }

      const facts = { ...ctx, isAttack, isMelee: ctx.isMelee ?? (isAttack && ctx.item?.system?.classification?.style == 'melee') };
      if (evaluate(rule.when, contextFor({ ...facts, self: holder, holder, ruleItem: item, other: roller })) !== true) {
        continue;
      }

      seen.add(key);
      sources.push({ id: `${ruleId(item, index)}-ia`, label: ruleLabel(rule, item), shiftUp: Number(rule.upshift) || 0, shiftDown: Number(rule.downshift) || 0, edge: !!rule.edge, snag: !!rule.snag });
    }
  }

  return { sources, consumes: [] };
}

registerRollSources(incomingAuraSources);
