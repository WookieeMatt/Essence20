import { ruleId, ruleLabel, rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * `SummonOption {rounds, power?, action?}` (round 15, systems - docs/rules-batches/slSystems15.md): a faster way for a
 * Zord to arrive, offered when it's summoned (mechanics/vehicles/zord-summon.mjs#rollSummonTimer) - on the summoner's item
 * (Q-Rex Portal) or on the Zord's own (Manifested Zord, Assisted Summoning). Picked, the summoner pays `power` Personal
 * Power and / or the `action` (in a combat), and the Zord arrives in `rounds` rounds instead of the rolled 3d2. `when`
 * sees self = the rule's holder, target = the other one (the Zord, or its summoner).
 */
registerRuleType('SummonOption', {
  params: {
    rounds: { kind: 'number', required: true },
    power: { kind: 'number' },
    action: { kind: 'enum', options: ['standard', 'move', 'free'] },
  },
  scopes: ['self'],
});

const T = (key, data) => {
  const full = `E20.RulesExtSystems.${key}`;
  const i18n = globalThis.game?.i18n;
  const text = data ? i18n?.format?.(full, data) : i18n?.localize?.(full);
  return text && text != full ? text : key;
};

/**
 * The faster arrivals offered for this summon.
 * @param {Actor} summoner
 * @param {Actor} zord
 * @returns {Array<{key, label, rounds, power, action}>}
 */
export function ruleSummonOptions(summoner, zord) {
  const options = [];
  for (const [holder, other] of [[zord, summoner], [summoner, zord]]) {
    if (!holder) {
      continue;
    }

    for (const { rule, item, index } of rulesOfType(holder, 'SummonOption')) {
      if (evaluate(rule.when, contextFor({ self: holder, holder, ruleItem: item, other })) !== true) {
        continue;
      }

      options.push({
        key: ruleId(item, index), label: ruleLabel(rule, item), rounds: Math.max(1, Math.round(Number(rule.rounds) || 1)),
        power: Math.max(0, Math.round(Number(rule.power) || 0)), action: rule.action ?? null,
      });
    }
  }

  return options;
}

/**
 * Offer the faster arrivals (only the ones the summoner can afford) and pay for the one picked.
 * @returns {Promise<Number|false|null>}   The rounds until it arrives; null to roll as usual (nothing offered, or the
 *   normal roll picked); false when the picked option couldn't be paid (the summon stops).
 */
export async function pickSummonOption(summoner, zord) {
  const power = Number(summoner?.system?.powers?.personal?.value) || 0;
  const options = ruleSummonOptions(summoner, zord).filter(option => option.power <= power);
  if (!options.length) {
    return null;
  }

  const { chooseSelect } = await import("../../../mechanics/resources/grants.mjs");
  const roll = { value: 'roll', label: T('SummonRollNormally') };
  const picked = await chooseSelect(T('SummonOptionTitle', { name: zord?.name ?? '' }), T('SummonOptionPrompt'),
    [roll, ...options.map(option => ({ value: option.key, label: option.label }))]);
  const option = options.find(entry => entry.key == picked);
  if (!option) {
    return null;
  }

  if (option.action && globalThis.game?.combat?.started) {
    const { spend } = await import("../../../mechanics/actions/action-economy.mjs");
    const paid = await spend(summoner, option.action, { source: option.label });
    if (paid?.blocked) {
      return false;
    }
  }

  if (option.power) {
    await summoner.update({ 'system.powers.personal.value': power - option.power });
  }

  return option.rounds;
}
