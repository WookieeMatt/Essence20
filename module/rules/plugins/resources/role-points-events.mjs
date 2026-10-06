import { registerTag } from "../../predicate.mjs";
import { registerEvent } from "../../types.mjs";
import { DEFEAT_STAGES } from "../combat/defeat-stage.mjs";

/**
 * Round 15 (items2): Role Points switched on and off, and what Reckless Abandon's ending reads.
 *
 * - Trigger events `rolePointsActivated` / `rolePointsDeactivated` - a Role Points item's Active toggle
 *   (`system.isActive`) went on / off (the sheet's Activate button, or a step's `updateItem`), on the client that changed
 *   it. The item's own rules hear it first (even as it switches off), then the actor's other items' Triggers, with the
 *   Role Points item as the roll item (`item:` tags - `item:id:<16-char id>` names which one).
 * - Tag `self:enemiesStanding` - an enemy token stands on the viewed scene: not the actor's own, not hidden, not Defeated,
 *   of the opposite disposition (any other disposition for a neutral actor). True when the actor has no token or there's
 *   no canvas ("no enemies you can see" can't be judged - the hand-written Reckless Abandon kept it going).
 * - wouldBeDefeated `stage: "aegis"` - after beforeAegis, before last: where combat.mjs's hand-written Aegis clamp sat.
 * (Reckless Abandon's minute reads `@combat.round` - rules/plugins/zords/piloted-vehicle-or-target.mjs, round 15 banked.)
 */
registerEvent('rolePointsActivated');
registerEvent('rolePointsDeactivated');

if (!DEFEAT_STAGES.includes('aegis')) {
  DEFEAT_STAGES.splice(Math.max(0, DEFEAT_STAGES.indexOf('last')), 0, 'aegis');
}

/** Fire the toggle events for a Role Points item that just changed. */
export async function onRolePointsToggled(item, active) {
  const actor = item?.parent;
  if (actor?.documentName != 'Actor') {
    return;
  }

  const event = active ? 'rolePointsActivated' : 'rolePointsDeactivated';
  const { fireItemAdded, fireTriggers } = await import("../../triggers.mjs");
  await fireItemAdded(actor, item, { event });
  await fireTriggers(actor, event, { roll: { item }, skipItem: item });
}

globalThis.Hooks?.on?.('updateItem', (item, changed, options, userId) => {
  if (userId != globalThis.game?.user?.id || item?.type != 'rolePoints' || changed?.system?.isActive === undefined) {
    return;
  }

  onRolePointsToggled(item, !!changed.system.isActive).catch(error => console.error('Essence20 | Role Points Triggers failed', error));
});

/** Whether an enemy token stands on the viewed scene (see the file comment). */
export function enemiesStanding(actor) {
  const mine = actor?.getActiveTokens?.()?.[0];
  const placeables = globalThis.canvas?.tokens?.placeables;
  if (!mine || !Array.isArray(placeables)) {
    return true;
  }

  const hostile = -1 * (mine.document?.disposition || 0);
  return placeables.some(token => token !== mine && token.actor && !token.document?.hidden
    && (hostile ? token.document?.disposition == hostile : token.document?.disposition != mine.document?.disposition)
    && !token.actor.statuses?.has?.('defeated'));
}

registerTag('self:enemiesStanding', (rest, ctx) => enemiesStanding(ctx?.self), { phrase: ['an enemy is still standing', 'no enemy is left standing'] });
