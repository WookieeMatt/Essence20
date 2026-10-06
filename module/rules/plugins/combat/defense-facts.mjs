// Rules-engine plug-ins, round 16 (part b - docs/rules-batches/slLeftB16.md). Registered on import; see
// module/rules/plugins/index.mjs.
import { resolveValue } from "../../formula.mjs";
import { registerTag } from "../../predicate.mjs";
import { registerStep } from "../../steps.mjs";
import { itemsOf, localized } from "../shared/left-b-text.mjs";

/**
 * - Step `defenseFacts {of?: target | self}` - the first target's (or the actor's) Defenses the way an attack meets them
 *   (mechanics/combat/combat.mjs#getDefenseValue - a vehicle's driver's, Responsive...), into the run's vars:
 *   `{var.highestDefense}` (the key of the highest - ties to the first in Toughness, Evasion, Willpower, Cleverness
 *   order; a `rollVsEach {defense: "{var.highestDefense}"}` rolls against it), `{var.defenseValues}` ("Toughness 12,
 *   Evasion 10, ...") and `{var.hangUpNames}` (its Hang-Ups, comma-joined, or "none known"). No target: stops with a
 *   "needs a target" line. (Tech Specs.)
 * - Tag `target:amongUserTargets:<formula>` - the other party is one of the first N of this user's targeted tokens, N the
 *   formula (read with self = the rule's actor; 0 or less: none). Danger Close's "exclude a number of targets equal to your
 *   Smarts" - the player targets the ones to spare before using Ground Suppression.
 */

const DEFENSES = ['toughness', 'evasion', 'willpower', 'cleverness'];
const NAMES = { toughness: 'Toughness', evasion: 'Evasion', willpower: 'Willpower', cleverness: 'Cleverness' };

registerStep('defenseFacts', async (step, ctx) => {
  const actor = step.of == 'self' ? ctx.actor : ctx.targets?.[0];
  if (!actor) {
    ctx.chat.push(localized('E20.Rules.Step.NeedsTarget', { item: ctx.item?.name ?? '' }));
    return false;
  }

  const { getDefenseValue } = await import("../../../mechanics/combat/combat.mjs");
  let highest = DEFENSES[0];
  let best = -Infinity;
  const values = [];
  for (const key of DEFENSES) {
    const value = getDefenseValue(actor, key);
    values.push(`${NAMES[key]} ${value}`);
    if (value > best) {
      best = value;
      highest = key;
    }
  }

  const hangUps = itemsOf(actor).filter(item => item.type == 'hangUp').map(item => item.name);
  Object.assign(ctx.vars, {
    highestDefense: highest,
    // Round 17 (perm - plugins/shared/report-facts.mjs): its name and value too (Chrono-File Access).
    highestDefenseName: NAMES[highest],
    highestDefenseValue: best,
    defenseValues: values.join(', '),
    hangUpNames: hangUps.length ? hangUps.join(', ') : localized('E20.ChronoFileAccessNoHangUps'),
  });
}, { errors: (step, where) => (step.of && !['self', 'target'].includes(step.of) ? [`${where}: defenseFacts of must be self or target`] : []) });

registerTag('target:amongUserTargets', (rest, ctx) => {
  const other = ctx?.other;
  const count = Math.floor(Number(resolveValue(rest, { actor: ctx?.self, item: ctx?.ruleItem }, 0)) || 0);
  if (!other || count <= 0) {
    return false;
  }

  const first = [...(globalThis.game?.user?.targets ?? [])].slice(0, count);
  return first.some(token => token?.actor === other || (!!other.uuid && token?.actor?.uuid == other.uuid));
});
