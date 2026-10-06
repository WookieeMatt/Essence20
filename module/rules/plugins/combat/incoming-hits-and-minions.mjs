// Rules-engine plug-ins, round 16 (part b - docs/rules-batches/slLeftB16.md). Registered on import; see
// module/rules/plugins/index.mjs.
import { creatureTagsOf, isPuttyOrTenga } from "../../../mechanics/characters/creature-tags.mjs";
import { rulesOfType } from "../../index.mjs";
import { registerTag } from "../../predicate.mjs";
import { registerStep } from "../../steps.mjs";
import { RULE_TYPES } from "../../types.mjs";
import { HIT_RIDER_SOURCES } from "./hit-rider.mjs";

/**
 * - HitRider `scope: "incoming"` - the rule acts on hits that land on its HOLDER (any attacker): `self:` is the one who hit,
 *   `holder:` / `target:` the holder. "You reduce the damage dealt to you by minion ... enemies by 1" (Metallic Armor
 *   Power Up!) is `{type: HitRider, scope: incoming, note: -1, when: ["self:minion"]}` - the -1 noted on the hit, never
 *   below what the hit deals (target-riders.mjs's damage-bonus note).
 * - Tags `self:minion` / `target:minion` - a minion: not a Player Character, and tagged minion / minions / foot soldier
 *   / footsoldier / foot-soldier / mook / grunt (mechanics/characters/creature-tags.mjs), or a Putty or Tenga.
 * - Step `activatePower {}` - the rule's own Power is activated the sheet's way (sheet-handlers/power-handler.mjs#powerCost:
 *   its cost, then its powerUsed Triggers). For a Power whose Use button must also switch it on. The run then stops with nothing
 *   to say (the activation posts its own card).
 */

if (RULE_TYPES.HitRider && !RULE_TYPES.HitRider.scopes.includes('incoming')) {
  RULE_TYPES.HitRider.scopes.push('incoming');
}

HIT_RIDER_SOURCES.push((attacker, target) => (target && target !== attacker
  ? rulesOfType(target, 'HitRider').filter(({ rule }) => rule.scope == 'incoming').map(entry => ({ ...entry, holder: target }))
  : []));

const MINION_TAGS = ['minion', 'minions', 'foot soldier', 'footsoldier', 'foot-soldier', 'mook', 'grunt'];

/** Whether an actor counts as a minion / foot soldier. */
export function isMinion(actor) {
  if (!actor || actor.type == 'playerCharacter') {
    return false;
  }

  const tags = creatureTagsOf(actor);
  return MINION_TAGS.some(tag => tags.has(tag)) || !!isPuttyOrTenga(actor);
}

registerTag('self:minion', (rest, ctx) => (ctx?.self ? isMinion(ctx.self) : null));
registerTag('target:minion', (rest, ctx) => (ctx?.other ? isMinion(ctx.other) : false));

registerStep('activatePower', async (step, ctx) => {
  if (ctx.item?.type != 'power' || !ctx.actor) {
    return false;
  }

  const { powerCost } = await import("../../../sheet-handlers/power-handler.mjs");
  await powerCost(ctx.actor, ctx.item);
  // The activation posts its own card (its powerUsed Triggers): this run stops quietly, so the Use posts none.
  return false;
});
