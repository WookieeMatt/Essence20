import { forcedMovementChoiceOf } from "../../rules/plugins/combat/subsystem-readers.mjs";
import { needsGmRelay, relayToGm } from "../world/gm-relay.mjs";

/**
 * Moving another creature: pushing it back, pulling it somewhere, or putting it down elsewhere.
 *
 * Pushes run straight away from whoever pushed, one grid step at a time, and stop at the first wall
 * - "you only push them up to the edge of the hazard" (Barreling Beam, MLP CRB p.136) is the table's
 * call, since a hazard is only whatever the GM says it is. Used by Explosive Aftershock ("You push
 * them 10 feet", GI Joe CRB p.81), Muzzle Punch (Quartermaster's Guide p.30), a Shove (GI Joe CRB
 * p.118, PR CRB p.110: each success pushes the target straight back by the shover's natural Reach), Barreling Beam, Checkmate (GI Joe CRB p.87) and Teleporting Beam
 * (MLP CRB p.138), which put the target on a chosen spot instead.
 *
 * A creature with a ForcedMovementChoice rule (Immovable Object, GI Joe CRB, Juggernaut, 20th level, p.112) may choose not
 * to move: asked of whoever is doing the moving, with staying put as the default.
 *
 * A token the user can't move goes through the GM relay, the same as every other write to a target.
 */

const MOVEMENT_PENALTY_FLAG = 'movementPenalty';

function tokenOf(actor) {
  return actor?.token?.object ?? actor?.getActiveTokens?.()?.[0] ?? null;
}

function feetToPixels(feet) {
  return feet * (canvas?.dimensions?.distancePixels ?? (canvas.dimensions.size / canvas.dimensions.distance));
}

async function moveTokenTo(token, center) {
  const doc = token.document;
  let position = { x: center.x - token.w / 2, y: center.y - token.h / 2 };
  try {
    position = doc.getSnappedPosition(position);
  } catch (error) {
    // Gridless scene - keep the exact point.
  }

  const update = { x: Math.round(position.x), y: Math.round(position.y) };
  if (needsGmRelay(doc)) {
    return relayToGm(doc, 'update', [update]);
  }

  await doc.update(update);
  return true;
}

/**
 * Whether the creature chooses to stay put (a ForcedMovementChoice rule - Immovable Object).
 * @param {Actor} actor
 * @returns {Promise<Boolean>}
 */
export async function resistsForcedMovement(actor) {
  // Bullbar (TF CRB p.134): "Bot Mode: You're immune to effects that would shove you." Derived by
  // items/forms/mode-lock-energon-flush.mjs.
  if (actor?.system?.tf2ShoveImmune) {
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: game.i18n.format('E20.Tf2ShoveImmune', { name: actor.name }),
    });
    return true;
  }

  if (!forcedMovementChoiceOf(actor)) {
    return false;
  }

  const moved = await foundry.applications.api.DialogV2.confirm({
    window: { title: game.i18n.localize('E20.ForcedMovementTitle') },
    content: `<p>${game.i18n.format('E20.ForcedMovementImmovable', { name: actor.name })}</p>`,
    yes: { label: game.i18n.localize('E20.ForcedMovementLetMove') },
    no: { label: game.i18n.localize('E20.ForcedMovementStayPut'), default: true },
    rejectClose: false,
  });

  if (!moved) {
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: game.i18n.format('E20.ForcedMovementStayed', { name: actor.name }),
    });
  }

  return !moved;
}

/**
 * The furthest point along a straight line the token can reach without passing through a wall.
 * @param {Token} token
 * @param {{x: Number, y: Number}} direction   A unit vector.
 * @param {Number} feet
 * @returns {{x: Number, y: Number}}
 */
export function pushDestination(token, direction, feet) {
  const step = canvas.dimensions.size;
  const total = feetToPixels(feet);
  const origin = token.center;
  let reached = origin;
  for (let travelled = Math.min(step, total); travelled <= total + 0.5; travelled += step) {
    const next = { x: origin.x + direction.x * travelled, y: origin.y + direction.y * travelled };
    if (token.checkCollision?.(next, { origin: reached, type: 'move', mode: 'any' })) {
      break;
    }

    reached = next;
  }

  return reached;
}

/**
 * Push a creature straight away from something.
 * @param {Actor} target
 * @param {Actor|{x: Number, y: Number}} from   Whoever pushed, or a point (the centre of a blast).
 * @param {Number} feet
 * @returns {Promise<Boolean>}   Whether it moved.
 */
export async function pushActor(target, from, feet) {
  const token = tokenOf(target);
  const source = from?.x !== undefined ? from : tokenOf(from)?.center;
  if (!token || !source || feet <= 0 || await resistsForcedMovement(target)) {
    return false;
  }

  let dx = token.center.x - source.x;
  let dy = token.center.y - source.y;
  const length = Math.hypot(dx, dy);
  if (!length) {
    return false;
  }

  dx /= length;
  dy /= length;
  const destination = pushDestination(token, { x: dx, y: dy }, feet);
  if (destination.x == token.center.x && destination.y == token.center.y) {
    return false;
  }

  return moveTokenTo(token, destination);
}

/**
 * Put a creature on a chosen spot (Checkmate, Teleporting Beam).
 * @param {Actor} target
 * @param {{x: Number, y: Number}} point
 * @returns {Promise<Boolean>}
 */
export async function placeActorAt(target, point) {
  const token = tokenOf(target);
  if (!token || !point || await resistsForcedMovement(target)) {
    return false;
  }

  return moveTokenTo(token, point);
}

/**
 * Wait for a click on the canvas. Escape cancels.
 * @param {String} prompt   Shown as a notification while waiting.
 * @returns {Promise<{x: Number, y: Number}|null>}
 */
export function pickCanvasPoint(prompt) {
  return new Promise((resolve) => {
    if (!canvas?.stage) {
      resolve(null);
      return;
    }

    ui.notifications.info(prompt);
    let done = false;
    const finish = (point) => {
      if (done) {
        return;
      }

      done = true;
      canvas.stage.off('pointerdown', onClick);
      document.removeEventListener('keydown', onKey);
      resolve(point);
    };

    const onClick = (event) => finish(event?.getLocalPosition?.(canvas.stage) ?? canvas.mousePosition ?? null);
    const onKey = (event) => {
      if (event.key == 'Escape') {
        finish(null);
      }
    };

    canvas.stage.on('pointerdown', onClick);
    document.addEventListener('keydown', onKey);
  });
}

/**
 * The distance between two points, in feet.
 */
export function distanceFeet(a, b) {
  return canvas.grid.measurePath([a, b]).distance;
}

/**
 * "Their Movement is reduced by 5 feet on their next turn" (Muzzle Punch). Lands on whichever turn
 * of theirs comes next in the combat.
 * @param {Actor} target
 * @param {Number} feet
 */
export async function slowNextTurn(target, feet) {
  const combat = game.combat;
  if (!combat) {
    return;
  }

  const theirTurn = combat.turns.findIndex(c => c.actor?.id == target.id);
  const round = theirTurn > combat.turn ? combat.round : combat.round + 1;
  await target.setFlag('essence20', MOVEMENT_PENALTY_FLAG, { feet, combatId: combat.id, round });
}

/**
 * The Movement taken off this actor right now, for mechanics/combat/token-movement.mjs.
 * @param {Actor} actor
 * @returns {Number}
 */
export function movementPenaltyFor(actor) {
  const penalty = actor?.flags?.essence20?.[MOVEMENT_PENALTY_FLAG];
  const combat = game?.combat;
  if (!penalty || !combat || penalty.combatId != combat.id || penalty.round != combat.round) {
    return 0;
  }

  return combat.combatant?.actor?.id == actor.id ? penalty.feet : 0;
}
