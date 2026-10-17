// Rules-engine plug-ins, round 15 (rest-other - docs/rules-batches/slOther15.md): ReloadSkip.
// Registered on import; see module/rules/plugins/index.mjs. Import-light: reload-trait.mjs loads it directly.
import { rulesOfType } from "../../index.mjs";
import { recordUse, usesLeft } from "../../limits.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * `ReloadSkip {limit, combatOnly?, message?}` - a reload the weapon would need (mechanics/combat/reload-trait.mjs#requireReload:
 * the Reload trait, a Fanning volley, Burst-Fire's second shot, Empty the Mag) is ignored instead, while the rule's
 * limit lasts. `when` sees the weapon as `item:` (`item:isHost` - an upgrade's own weapon). `combatOnly`: only while a
 * combat exists (Deep Magazines' "per combat"). `message` - an `E20.` key (or text) told as an info toast, with {name}
 * (the actor) and {weapon}. Rules run in their `priority` order; the first that applies uses its limit up.
 */
registerRuleType('ReloadSkip', {
  params: {
    limit: { kind: 'object' },
    combatOnly: { kind: 'bool' },
    message: { kind: 'string' },
  },
  scopes: ['self'],
  validate: rule => (rule.limit === undefined || ['turn', 'round', 'scene', 'encounter', 'mission', 'session', 'rest'].includes(rule.limit?.per)
    ? [] : ['limit.per must be turn, round, scene, encounter, mission, session or rest']),
});

/**
 * Whether one of the actor's ReloadSkip rules skips this reload - and if so, uses it up and says so.
 * @param {Actor} actor
 * @param {Item} weapon
 * @returns {Promise<Boolean>}
 */
export async function ruleSkipsReload(actor, weapon) {
  if (!actor || !weapon) {
    return false;
  }

  for (const { rule, item, index } of rulesOfType(actor, 'ReloadSkip')) {
    if (rule.combatOnly && !globalThis.game?.combat) {
      continue;
    }

    if (usesLeft(actor, rule, item, index) < 1) {
      continue;
    }

    if (evaluate(rule.when, contextFor({ self: actor, holder: actor, ruleItem: item, item: weapon })) !== true) {
      continue;
    }

    await recordUse(actor, rule, item, index);
    if (rule.message) {
      const i18n = globalThis.game?.i18n;
      const text = i18n?.format ? i18n.format(rule.message, { name: actor.name ?? '', weapon: weapon.name ?? '' }) : rule.message;
      globalThis.ui?.notifications?.info(text);
    }

    return true;
  }

  return false;
}
