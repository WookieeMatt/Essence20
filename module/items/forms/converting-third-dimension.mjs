import { getSceneEpoch } from "../../mechanics/resources/scene-clock.mjs";
import { areEnemies } from "../shared/sides.mjs";
import { escapeMarkup as esc, say } from "../shared/chat-lines.mjs";
import { flagOf, has as holds } from "../shared/item-lookups.mjs";
import { SCOPE, TF3 } from "../shared/tf-crb-tf-one-item-ids.mjs";
import { stampNow } from "../shared/turn-stamps.mjs";
import { T } from "../shared/item-lang.mjs";
import { UNEXPECTED_FLAG } from "../rolls/unexpected-alternative.mjs";

/**
 * What happens to tf3 items outside the dice dialog: converting
 * (Unexpected Alternative), Third Dimension's movement. (One Bot Over Another's Requisition
 * access is a Qualification rule on the Perk; Training Through Familiarity's Kit waiver a KitPrerequisite rule.)
 */

const SEEN_FLAG = 'tf3SeenModes';
const flagKey = uuid => String(uuid ?? '').replace(/\./g, '-');

// Last Stand (a full turn when Defeated - a defeated Trigger), Roll With It (a push away from whoever hurt you - a
// takesDamage Trigger) and Intensive (a Patch Up shared with injured allies - a patchedUp Trigger) are rules on their
// Perks (rules/plugins/combat/combat-steps.mjs).

// (Irrefutable Order's Move action at the ordered creature's turn start is a queueTurnStart step on its rule; Stoic's
// end at the holder's next turn is its mark's own duration - rules/conv10-slC10.test.js.)

// Synch Up and No Escape are rules on their Perks (a Reaction, an enemyEnteredReach Trigger - rules/conv10-slC10.test.js).

/* -------------------------------------------- */
/*  Converting                                   */
/* -------------------------------------------- */

/**
 * Unexpected Alternative (Triple Changer, 3rd level, p.76): "when an enemy who has seen you Convert into
 * only one of your Alt Modes sees you Convert into your other Alt Mode for the first time, you gain an
 * Edge on Skill Tests targeting them until the end of your next turn." Every enemy token on the scene
 * is taken to see the Convert.
 * @returns {Object|null}   Flag updates to write.
 */
export function unexpectedUpdates(actor, altModeId, enemies) {
  if (!altModeId || !holds(actor, TF3.unexpectedAlternative)) {
    return null;
  }

  const seen = { ...(flagOf(actor, SEEN_FLAG) ?? {}) };
  const surprised = [];
  for (const enemy of enemies) {
    const key = flagKey(enemy.uuid);
    const modes = seen[key] ?? [];
    if (modes.length == 1 && modes[0] != altModeId) {
      surprised.push(enemy.uuid);
    }

    if (!modes.includes(altModeId)) {
      seen[key] = [...modes, altModeId];
    }
  }

  const updates = { [`flags.${SCOPE}.${SEEN_FLAG}`]: seen };
  if (surprised.length) {
    let scene = null;
    try {
      scene = getSceneEpoch();
    } catch {
      scene = null;
    }

    updates[`flags.${SCOPE}.${UNEXPECTED_FLAG}`] = { targets: surprised, stamp: stampNow(scene) };
  }

  return updates;
}

export async function onConverted(actor, changes) {
  const system = changes?.system ?? {};
  if (!('isTransformed' in system) && !('altModeId' in system)) {
    return;
  }

  if (actor.system?.isTransformed && actor.system?.altModeId) {
    const enemies = (canvas?.tokens?.placeables ?? []).map(t => t.actor).filter(other => other && areEnemies(actor, other));
    const updates = unexpectedUpdates(actor, actor.system.altModeId, enemies);
    if (updates) {
      await actor.update(updates);
      if (updates[`flags.${SCOPE}.${UNEXPECTED_FLAG}`]) {
        const names = updates[`flags.${SCOPE}.${UNEXPECTED_FLAG}`].targets.map(uuid => fromUuidSync?.(uuid)?.name ?? '').filter(Boolean);
        await say(actor, T('Tf3UnexpectedEdge', { name: esc(actor.name), targets: esc(names.join(', ')) }));
      }
    }
  }
}

/* -------------------------------------------- */
/*  Third Dimension                              */
/* -------------------------------------------- */

/**
 * Third Dimension (Triple Changer, 17th level, p.76): "when you change Movement types during your move,
 * you do not subtract the distance you have already moved from the new Movement type like you normally
 * would. Instead, you move up to the full distance of your second Movement type." Only the cost walked
 * since the last change of movement action counts against the current type's rating.
 */
export function thirdDimensionUsed(movement) {
  const waypoints = [
    ...(movement?.history?.recorded?.waypoints ?? []), ...(movement?.history?.unrecorded?.waypoints ?? []),
    ...(movement?.passed?.waypoints ?? []), ...(movement?.pending?.waypoints ?? []),
  ];
  const last = [...waypoints].reverse().find(w => w?.action)?.action;
  if (!last) {
    return null;
  }

  let used = 0;
  for (const waypoint of [...waypoints].reverse()) {
    if (waypoint?.action && waypoint.action != last) {
      break;
    }

    used += Number(waypoint?.cost) || 0;
  }

  return used;
}

export function onMovementUsed(actor, movement, out) {
  if (!out || !holds(actor, TF3.thirdDimension)) {
    return;
  }

  const used = thirdDimensionUsed(movement);
  if (Number.isFinite(used)) {
    out.used = Math.min(out.used ?? used, used);
  }
}

/* -------------------------------------------- */
/*  Registration                                 */
/* -------------------------------------------- */


const run = promise => promise?.catch?.(error => console.error('Essence20 | tf3 hook failed', error));
globalThis.Hooks?.on?.('updateActor', (actor, changes, options, userId) => {
  if (userId == game.user?.id) {
    run(onConverted(actor, changes));
  }
});
globalThis.Hooks?.on?.('essence20.movementUsed', onMovementUsed);
