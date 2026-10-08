// Rules-engine plug-ins, round 15 (rest-other - docs/rules-batches/slOther15.md): Assist effects persist and rollFor.
// Registered on import; see module/rules/plugins/index.mjs. Import-light: mechanics/actions/lend-assistance.mjs loads it
// directly.
import { rulesOfType } from "../../index.mjs";
import { recordUse, usesLeft } from "../../limits.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { RULE_TYPES } from "../../types.mjs";
import { getUses, markUsed } from "../../../mechanics/resources/scene-clock.mjs";

/**
 * Two more Assist effects (rule type Assist, rules/types.mjs), read by mechanics/actions/lend-assistance.mjs:
 *   persist  (side give) - a Skill assist this helper lends lasts instead of being used up by one test (the banked
 *            Lend Assistance shift is marked persistent) while the rule's `limit` lasts (Those Who Know, Teach: 3 a
 *            scene), counted when it's lent.
 *   rollFor  (side receive) - a helper offering Lend Assistance to the holder may instead roll the holder's test
 *            themselves, with the holder's assistance (Conniving). `limit` is counted on the HELPER, per holder (the
 *            hand-written per-pair count, flag assistRollFor.<holder id>); scene / encounter only.
 * `when` sees the actor holding the rule, the other party as `target:` and the Skill as `skill:`.
 */
const ASSIST = RULE_TYPES.Assist;
if (ASSIST) {
  for (const effect of ['persist', 'rollFor']) {
    if (!ASSIST.params.effect.options.includes(effect)) {
      ASSIST.params.effect.options.push(effect);
    }
  }

  ASSIST.params.limit ??= { kind: 'object' };
}

function holding(actor, effect, side, other, skill) {
  return rulesOfType(actor, 'Assist').filter(({ rule, item }) => rule.effect == effect && (rule.side ?? 'give') == side
    && evaluate(rule.when, contextFor({ self: actor, holder: actor, other: other ?? null, ruleItem: item, rolledSkill: skill ?? null })) === true);
}

/**
 * Whether this helper's assist on that Skill persists - using one of its persist rule's uses when it does.
 * @param {Actor} helper
 * @param {Actor} ally
 * @param {String} skill
 * @returns {Promise<Boolean>}
 */
export async function useAssistPersist(helper, ally, skill) {
  const entry = holding(helper, 'persist', 'give', ally, skill).find(({ rule, item, index }) => usesLeft(helper, rule, item, index) > 0);
  if (!entry) {
    return false;
  }

  await recordUse(helper, entry.rule, entry.item, entry.index);
  return true;
}

/** Whether any of these allies holds a rollFor Assist rule (the Lend Assistance dialog offers the mode). */
export function rollForOffered(allies, helper = null) {
  return (allies ?? []).some(ally => holding(ally, 'rollFor', 'receive', helper, null).length > 0);
}

const rollForFlag = holder => `assistRollFor.${holder?.id ?? 'x'}`;

/**
 * The holder's rollFor rule this helper may use now (its limit counted on the helper, per holder), or null.
 * @param {Actor} helper
 * @param {Actor} holder
 * @param {String} [skill]
 */
export function rollForAvailable(helper, holder, skill = null) {
  return holding(holder, 'rollFor', 'receive', helper, skill).find(({ rule }) => {
    const per = rule.limit?.per;
    if (!per) {
      return true;
    }

    return getUses(helper, rollForFlag(holder), per) < Math.max(1, Number(rule.limit.max) || 1);
  }) ?? null;
}

/** Count the helper's use of a holder's rollFor rule. */
export async function recordRollFor(helper, holder, entry) {
  const per = entry?.rule?.limit?.per;
  if (per) {
    await markUsed(helper, rollForFlag(holder), { window: per });
  }
}
