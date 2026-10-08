import { registerDialogToggles, registerApplyDialog } from "../../../mechanics/item-hooks.mjs";
import { resolveValue } from "../../formula.mjs";
import { ruleId, rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * The StanceSwitch rule type (round 10, group D - docs/rules-batches/slD10.md): All Out Attack / Evasive Fighting as a
 * number box in the Roll Options Dialog.
 */

// StanceSwitch {stance: allOutAttack | evasiveFighting, max}: a number box (0..max) in the Roll Options Dialog while
// `when` holds; the number chosen is that many ↓ on the roll and the actor's rider stance (target-riders.mjs - enemies
// attacking it get as many ↑ / ↓ until its next turn starts); All Out Attack's also adds that much damage to one hit.
registerRuleType('StanceSwitch', {
  params: { stance: { kind: 'enum', options: ['allOutAttack', 'evasiveFighting'], required: true }, max: { kind: 'formula' } },
  scopes: ['self'],
});

export function stanceToggles(actor, roll = {}) {
  return rulesOfType(actor, 'StanceSwitch').filter(({ rule, item }) => evaluate(rule.when, contextFor({ ...roll, self: actor, ruleItem: item, isAttack: roll.item?.type == 'weaponEffect' })) === true)
    .map(({ rule, item, index }) => ({
      name: `${ruleId(item, index)}-stance`, label: rule.label || item.name, type: 'number', value: 0,
      max: Math.max(0, Math.round(resolveValue(rule.max ?? 5, { actor, item }, 5))),
    }));
}

export async function stanceApply(actor, options) {
  const ext = options.ext ?? {};
  const totals = { allOutAttack: 0, evasiveFighting: 0 };
  for (const { rule, item, index } of rulesOfType(actor, 'StanceSwitch')) {
    const max = Math.max(0, Math.round(resolveValue(rule.max ?? 5, { actor, item }, 5)));
    totals[rule.stance] += Math.max(0, Math.min(max, Number(ext[`${ruleId(item, index)}-stance`]) || 0));
  }

  if (!totals.allOutAttack && !totals.evasiveFighting) {
    return;
  }

  options.shiftDown = (Number(options.shiftDown) || 0) + totals.allOutAttack + totals.evasiveFighting;
  options.allOutAttackShifts = (Number(options.allOutAttackShifts) || 0) + totals.allOutAttack;
  const riders = await import("../../../mechanics/combat/target-riders.mjs");
  const current = riders.stanceOf(actor);
  await actor.setFlag('essence20', 'riderStance', {
    allOutAttack: Math.max(current.allOutAttack, totals.allOutAttack),
    evasiveFighting: Math.max(current.evasiveFighting, totals.evasiveFighting),
    ...riders.untilStartOfNextTurn(actor),
  });
}

registerDialogToggles((actor, ctx) => stanceToggles(actor, ctx ?? {}));
registerApplyDialog((actor, options) => stanceApply(actor, options));
