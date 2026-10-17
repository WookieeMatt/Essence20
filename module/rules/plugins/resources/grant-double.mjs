import { formulaError, resolveValue } from "../../formula.mjs";
import { ruleLabel, rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";
import { localize, T } from "../shared/copy-and-data-helpers.mjs";

/**
 * Group H: `GrantDouble {grants: [upshift | actions], prompt?, damage?: {amount, type}}` - when the holder grants another
 * actor upshifts on a banked bonus (mechanics/characters/perks.mjs#bankPendingBonus) or extra actions this turn
 * (mechanics/actions/action-economy.mjs#grantActionsThisTurn), the holder is asked; yes doubles the grant and deals
 * `damage` to the one receiving it. `prompt` (an E20. key or text) fills {granter}, {ally}, {what}. `when`: self = the
 * granter, target = the ally. Never for the holder granting themselves.
 */

export const GRANT_KINDS = ['upshift', 'actions'];

registerRuleType('GrantDouble', {
  params: { grants: { kind: 'strings', required: true }, prompt: { kind: 'string' }, damage: { kind: 'object' } },
  scopes: ['self'],
  validate: rule => [
    ...(Array.isArray(rule.grants) && rule.grants.length && rule.grants.every(kind => GRANT_KINDS.includes(kind)) ? [] : [`grants must list some of ${GRANT_KINDS.join(', ')}`]),
    ...(rule.damage !== undefined && (!rule.damage?.type || formulaError(rule.damage?.amount ?? 1)) ? ['damage needs {amount, type}'] : []),
  ],
});

/** The granter's GrantDouble rule for this kind of grant to that ally, or null. */
export function grantDoubleRule(granter, ally, kind) {
  if (!granter || !ally || granter === ally || (granter.uuid && granter.uuid == ally.uuid)) {
    return null;
  }

  return rulesOfType(granter, 'GrantDouble').find(({ rule, item }) => (rule.grants ?? []).includes(kind)
    && evaluate(rule.when, contextFor({ self: granter, holder: granter, other: ally, ruleItem: item })) === true) ?? null;
}

/**
 * Ask the granter whether to double what they grant the ally (`what` names it in the prompt). On a yes the rule's damage
 * lands on the ally. Resolves whether to double.
 */
export async function offerGrantDouble(granter, ally, kind, what) {
  const entry = grantDoubleRule(granter, ally, kind);
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (!entry || !DialogV2?.confirm) {
    return false;
  }

  const { rule, item } = entry;
  const data = { granter: granter.name, ally: ally.name, what };
  const prompt = rule.prompt ? localize(rule.prompt, data) : T('DoublePrompt', data);
  // Bound: DialogV2.confirm calls this.wait internally.
  const yes = await DialogV2.confirm.call(DialogV2, {
    window: { title: item?.name ?? ruleLabel(rule, item) },
    content: `<p>${prompt}</p>`,
    rejectClose: false,
  });
  if (!yes) {
    return false;
  }

  if (rule.damage?.type) {
    const amount = Math.round(resolveValue(rule.damage.amount ?? 1, { actor: granter, item, other: ally }, 1));
    const { applyDamage } = await import("../../../mechanics/combat/combat.mjs");
    await applyDamage(ally, amount, rule.damage.type);
  }

  return true;
}
