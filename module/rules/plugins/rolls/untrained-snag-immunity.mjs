// Rules-engine plug-ins, round 15 (rest-other - docs/rules-batches/slOther15.md): UntrainedSnagImmunity.
// Registered on import; see module/rules/plugins/index.mjs. Import-light: mechanics/rolls/roll-dialog.mjs loads it directly.
import { rulesOfType } from "../../index.mjs";
import { recordUse, usesLeft } from "../../limits.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * `UntrainedSnagImmunity {limit, freeOutOfCombat?}` - a LIMITED lift of the automatic untrained Snag (an unlimited one is
 * RollModifier `immune: ["untrainedSnag"]`). Asked by mechanics/rolls/roll-dialog.mjs#_isUntrainedSnag after every
 * unlimited lift, so its use is only spent when nothing else lifted the Snag. `freeOutOfCombat`: with no combat it always
 * applies and counts nothing (Green, Transformers). Rules run in `priority` order; the first with a use left takes it.
 * `when` sees the actor and the rolled Skill (`skill:`).
 */
registerRuleType('UntrainedSnagImmunity', {
  params: { limit: { kind: 'object' }, freeOutOfCombat: { kind: 'bool' } },
  scopes: ['self'],
  validate: rule => (rule.limit === undefined || ['turn', 'round', 'scene', 'encounter', 'mission', 'session', 'rest'].includes(rule.limit?.per)
    ? [] : ['limit.per must be turn, round, scene, encounter, mission, session or rest']),
});

/**
 * Whether one of the actor's UntrainedSnagImmunity rules lifts this untrained Snag - spending its use when it does.
 * @param {Actor} actor
 * @param {?String} skill
 * @returns {Promise<Boolean>}
 */
export async function useUntrainedSnagImmunity(actor, skill = null) {
  if (!actor) {
    return false;
  }

  for (const { rule, item, index } of rulesOfType(actor, 'UntrainedSnagImmunity')) {
    if (evaluate(rule.when, contextFor({ self: actor, holder: actor, ruleItem: item, rolledSkill: skill })) !== true) {
      continue;
    }

    if (rule.freeOutOfCombat && !globalThis.game?.combat) {
      return true;
    }

    if (usesLeft(actor, rule, item, index) > 0) {
      await recordUse(actor, rule, item, index);
      return true;
    }
  }

  return false;
}
