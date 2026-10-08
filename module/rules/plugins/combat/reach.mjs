import { registerEvent } from "../../types.mjs";
import { rulesOfType } from "../../index.mjs";
import { registerTag } from "../../predicate.mjs";
import { attackRange, meleeReach } from "../tags/checks-and-refs.mjs";

/**
 * Reach and range (round 10, group C):
 *
 * - Trigger event `enemyEnteredReach` - an enemy token's move ended inside the holder's melee Reach (@reach.melee)
 *   having started outside it, in a combat. The mover is the Trigger's target (`to: target`). Asked on one client per
 *   holder (its first active non-GM owner, else the GM). No Escape.
 * - Tag `target:inRange:<attack | melee>` - the other party's token is within this actor's attack range (@reach.attack)
 *   or melee Reach (@reach.melee); false off the canvas. A Reaction's `when` sees the row's target (Synch Up).
 */

registerEvent('enemyEnteredReach');

function tokenOf(actor) {
  return actor?.getActiveTokens?.()?.[0] ?? null;
}

function measure(a, b) {
  return globalThis.canvas?.grid?.measurePath ? globalThis.canvas.grid.measurePath([a, b]).distance : null;
}

registerTag('target:inRange', (rest, ctx) => {
  const mine = tokenOf(ctx.self);
  const theirs = tokenOf(ctx.other);
  if (!mine || !theirs) {
    return false;
  }

  const distance = measure(mine.center, theirs.center);
  const range = rest == 'melee' ? meleeReach(ctx.self) : attackRange(ctx.self);
  return distance !== null && distance <= range;
}, { phrase: arg => (arg == 'melee' ? ['{who} {is} within your melee reach', "{who} {isnt} within your melee reach"] : ['{who} {is} within your attack range', "{who} {isnt} within your attack range"]) });

/** Different dispositions, neither neutral; off the canvas, PC against non-PC. */
export function areEnemies(a, b) {
  if (!a || !b || a === b || (a.uuid && a.uuid == b.uuid)) {
    return false;
  }

  const ta = tokenOf(a);
  const tb = tokenOf(b);
  if (ta && tb) {
    const da = ta.document?.disposition;
    const db = tb.document?.disposition;
    return da !== db && da !== 0 && db !== 0;
  }

  return (a.type == 'playerCharacter') != (b.type == 'playerCharacter');
}

/** The one client that acts for an actor: its first active non-GM owner, else the active GM. */
export function isResponsible(actor) {
  const game = globalThis.game;
  if (!actor || !game?.user) {
    return false;
  }

  const users = game.users?.contents ?? [...(game.users ?? [])];
  const owners = users.filter(user => user.active && !user.isGM && actor.testUserPermission?.(user, 'OWNER'))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  if (owners.length) {
    return owners[0].id == game.user.id;
  }

  return game.user.id == game.users?.activeGM?.id;
}

function centerOf(position) {
  const size = globalThis.canvas?.grid?.size ?? 100;
  return { x: (position?.x ?? 0) + ((position?.width ?? 1) * size) / 2, y: (position?.y ?? 0) + ((position?.height ?? 1) * size) / 2 };
}

/** A token finished a move: fire enemyEnteredReach for each holder whose melee Reach it stepped into. */
export async function onMoveToken(tokenDoc, movement) {
  const mover = tokenDoc?.actor;
  if (!mover || !globalThis.game?.combat || !globalThis.canvas?.grid?.measurePath || !movement?.origin || !movement?.destination) {
    return;
  }

  const from = centerOf(movement.origin);
  const to = centerOf(movement.destination);
  for (const token of globalThis.canvas.tokens?.placeables ?? []) {
    const holder = token.actor;
    if (!holder || holder === mover || !rulesOfType(holder, 'Trigger').some(entry => entry.rule.event == 'enemyEnteredReach')
      || !isResponsible(holder) || !areEnemies(holder, mover)) {
      continue;
    }

    const reach = meleeReach(holder);
    if (measure(token.center, to) <= reach && measure(token.center, from) > reach) {
      const { fireTriggers } = await import("../../triggers.mjs");
      await fireTriggers(holder, 'enemyEnteredReach', { targets: [mover] });
    }
  }
}

globalThis.Hooks?.on?.('moveToken', (tokenDoc, movement) => {
  onMoveToken(tokenDoc, movement).catch(error => console.error('Essence20 | enemyEnteredReach failed', error));
});
