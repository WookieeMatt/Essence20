// Rules-engine plug-ins, round 16 (part b - docs/rules-batches/slLeftB16.md). Registered on import; see
// module/rules/plugins/index.mjs.
import { registerConsumer } from "../../../mechanics/item-hooks.mjs";
import { isExpired } from "../../expiry.mjs";
import { RULE_TYPES } from "../../types.mjs";

/**
 * Marks used up one at a time, and a mark that keeps a spot on the map (Eye For Appraisal, Vantage Point):
 *
 *  - RollModifier `consumeCount: true` (with `consumeMark`): the roll takes ONE off the mark's count (`mark {count}`) instead
 *    of the whole mark; the mark goes when its count runs out. "Your next 2d2 ranged attacks against that target".
 *  - `inMarkedArea(attacker, target, token, key)` - the mark `key` the attacker set on the target keeps a point
 *    (`mark {text: "{var.pointX},{var.pointY},{var.pointScene}"}` after a pickPoint) and the attacker's token stands in
 *    the 20 x 20 ft square around it, on that scene. Read by `check:inAppraisedArea` (rules/plugins/tags/dice-checks.mjs).
 */

RULE_TYPES.RollModifier.params.consumeCount ??= { kind: 'bool' };

/** One use off a counted mark (every setter's copy under the key); gone at zero. */
export async function consumeOneMark(consume) {
  const actor = await globalThis.fromUuid?.(consume.actorUuid);
  const marks = actor?.flags?.essence20?.ruleMarks ?? {};
  const names = Object.keys(marks).filter(name => name == consume.key || name.startsWith(`${consume.key}--`));
  if (!names.length) {
    return;
  }

  const update = {};
  for (const name of names) {
    const left = (Number(marks[name]?.count) || 1) - 1;
    if (left > 0) {
      update[`flags.essence20.ruleMarks.${name}.count`] = left;
    } else {
      update[`flags.essence20.ruleMarks.${name}`] = new foundry.data.operators.ForcedDeletion();
    }
  }

  const { needsGmRelay, relayToGm } = await import("../../../mechanics/world/gm-relay.mjs");
  await (needsGmRelay(actor) ? relayToGm(actor, 'update', [update]) : actor.update(update));
}

registerConsumer('rulesMarkOne', consumeOneMark);

/**
 * Whether the attacker stands in the 20 x 20 ft square its `key` mark on the target keeps.
 * @param {Actor} attacker
 * @param {Actor} target
 * @param {Token} attackerToken
 * @param {String} [key]
 * @returns {Boolean}
 */
export function inMarkedArea(attacker, target, attackerToken, key = 'appraisal') {
  const mark = target?.flags?.essence20?.ruleMarks?.[key];
  if (!mark || isExpired(mark) || !attacker?.uuid || mark.by != attacker.uuid || !attackerToken) {
    return false;
  }

  const [x, y, sceneId] = String(mark.text ?? '').split(',');
  if (x === '' || y === '' || !Number.isFinite(Number(x)) || !Number.isFinite(Number(y)) || !sceneId || sceneId != globalThis.canvas?.scene?.id) {
    return false;
  }

  const half = 10 * (globalThis.canvas?.dimensions?.distancePixels ?? 1);
  return Math.abs(attackerToken.center.x - Number(x)) <= half && Math.abs(attackerToken.center.y - Number(y)) <= half;
}
