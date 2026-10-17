import { registerConsumer } from "../../../mechanics/item-hooks.mjs";
import { RULE_TYPES } from "../../types.mjs";

/**
 * Round 16 (part a): two small roll facts.
 *
 *   RollModifier key: "<key>"   whenever the modifier is listed on a roll (an automatic source in the Roll Options
 *                               Dialog - even one the player switched off, as the hand-written "this bonus was on the
 *                               roll" checks read it), the roll carries the key: hit / miss / afterRoll Triggers ask
 *                               roll:switch:<key>, like a ticked DialogSwitch's key (Growl's ↑ read by Get The Horns).
 *                               dice.mjs#rollSkill adds the listed sources' keys to the roll's ruleKeys.
 *   RollModifier consumeOwn     with consumeMark: the roll uses up only the copy of a perSetter mark this modifier's
 *                               holder set, not every setter's (two Warthogs' Growls on one creature).
 *   hit Triggers' @var.row      the target's row on the card (0 = the first).
 *   Trigger oncePerRoll: true  a hit Trigger runs for the first hit of a roll that meets its `when` (and limit), not
 *                               for every target hit (rules/triggers.mjs - "the first legal target": Get A Grip, Get
 *                               The Horns).
 */

RULE_TYPES.RollModifier.params.key ??= { kind: 'string' };
RULE_TYPES.RollModifier.params.consumeOwn ??= { kind: 'bool' };
RULE_TYPES.Trigger.params.oncePerRoll ??= { kind: 'bool' };
{
  const inner = RULE_TYPES.Trigger.validate;
  RULE_TYPES.Trigger.validate = rule => [
    ...(inner?.(rule) ?? []),
    ...(rule.oncePerRoll && rule.event != 'hit' ? ['oncePerRoll only goes with a hit Trigger'] : []),
  ];
}

/** consumeOwn: the roll uses up only the copy of the mark the modifier's holder set (perSetter: <key>--<setter id>). */
export async function consumeOwnMark(consume) {
  const actor = await globalThis.fromUuid?.(consume.actorUuid);
  const marks = actor?.flags?.essence20?.ruleMarks ?? {};
  const name = consume.setterId && marks[`${consume.key}--${consume.setterId}`] ? `${consume.key}--${consume.setterId}` : null;
  if (!name) {
    return;
  }

  const { needsGmRelay, relayToGm } = await import("../../../mechanics/world/gm-relay.mjs");
  const update = { [`flags.essence20.ruleMarks.${name}`]: new foundry.data.operators.ForcedDeletion() };
  await (needsGmRelay(actor) ? relayToGm(actor, 'update', [update]) : actor.update(update));
}

registerConsumer('rulesMarkOwn', consumeOwnMark);

/** The keys of a roll's listed modifier sources (dice.mjs, merged into the roll's ruleKeys). */
export function sourceKeys(sources) {
  return (Array.isArray(sources) ? sources : []).map(source => source?.key).filter(Boolean);
}
