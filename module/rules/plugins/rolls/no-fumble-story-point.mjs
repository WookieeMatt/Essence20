import { rulesOfType } from "../../index.mjs";
import { contextFor, evaluate } from "../../predicate.mjs";
import { registerRuleType } from "../../types.mjs";

/**
 * Round 15 (items2): rule type `NoFumbleStoryPoint {}` (+ `when`) - while `when` holds, the actor's Fumble adds no
 * Story Point (the core grant in dice.mjs, through its FUMBLE_STORY_POINT_SUPPRESSORS list). `when` sees the fumbled
 * Skill as `skill:` (`skill:choiceOf:<uuid>` - the Skill chosen on the actor's copy of that item). With no Skill
 * known, nothing is suppressed. (Agency's Hang-Up: a Fumble in the agency's Skill.)
 */
registerRuleType('NoFumbleStoryPoint', { params: {}, scopes: ['self'] });

/** Whether the actor's rules drop the Fumble Story Point for this Skill. */
export function ruleSuppressesFumbleStoryPoint(actor, skill) {
  if (!skill) {
    return false;
  }

  return rulesOfType(actor, 'NoFumbleStoryPoint').some(({ rule, item }) => evaluate(rule.when, contextFor({ self: actor, holder: actor, ruleItem: item, rolledSkill: skill })) === true);
}

/** Join dice.mjs's suppressor list (loaded lazily at setup, so this file stays light). */
export async function installNoFumbleStoryPoint(load = () => import("../../../dice.mjs")) {
  try {
    const dice = await load();
    if (Array.isArray(dice.FUMBLE_STORY_POINT_SUPPRESSORS) && !dice.FUMBLE_STORY_POINT_SUPPRESSORS.includes(ruleSuppressesFumbleStoryPoint)) {
      dice.FUMBLE_STORY_POINT_SUPPRESSORS.push(ruleSuppressesFumbleStoryPoint);
    }
  } catch (error) {
    console.error('Essence20 | NoFumbleStoryPoint not installed', error);
  }
}

globalThis.Hooks?.once?.('setup', () => {
  installNoFumbleStoryPoint();
});
