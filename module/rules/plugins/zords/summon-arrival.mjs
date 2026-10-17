// Rules-engine plug-ins, round 18 (convB - docs/rules-batches/slConvB18.md): the SummonArrival rule type.
// Registered on import; see module/rules/plugins/index.mjs. Plain Node safe.
import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * `SummonArrival {set: {path: value}}` on a Zord's item - "when the Zord answers its Call to Action, it arrives ...":
 * whenever the summon timer is written on the Zord (mechanics/vehicles/zord-summon.mjs sets
 * flags.essence20.zordSummonReadyRound; reduceTimer moves it), these values ride on that same write (preUpdateActor),
 * so the Zord arrives in that state. `when` sees the Zord as it was. Values are written as they are (true / false /
 * numbers / text). Megafauna: `{set: {"flags.essence20.zord1Megafauna": true}}`.
 */
registerRuleType('SummonArrival', {
  params: { set: { kind: 'object', required: true } },
  scopes: ['self'],
  validate: rule => (rule.set && typeof rule.set == 'object' && Object.keys(rule.set).length
    && Object.keys(rule.set).every(path => /^(system|flags)\.[\w.]+$/.test(path)) ? [] : ['set needs system. / flags. paths']),
});

function summonWrite(changes) {
  const flat = changes?.['flags.essence20.zordSummonReadyRound'];
  const ready = flat !== undefined ? flat : changes?.flags?.essence20?.zordSummonReadyRound;
  return ready !== undefined && ready !== null;
}

/** Add the Zord's SummonArrival values to a summon-timer write (mutates `changes`). */
export function applySummonArrival(zord, changes) {
  if (zord?.type != 'zord' || !summonWrite(changes)) {
    return;
  }

  for (const { rule, item } of rulesOfType(zord, 'SummonArrival')) {
    if (rule.disabled || evaluate(rule.when, contextFor({ self: zord, holder: zord, ruleItem: item })) !== true) {
      continue;
    }

    for (const [path, value] of Object.entries(rule.set ?? {})) {
      globalThis.foundry?.utils?.setProperty?.(changes, path, value);
    }
  }
}

globalThis.Hooks?.on?.('preUpdateActor', (actor, changes) => {
  applySummonArrival(actor, changes);
  return true;
});
