import { epochFor } from "../../../mechanics/resources/scene-clock.mjs";
import { isExpired, isValidUntil, stampFor } from "../../expiry.mjs";
import { registerTag } from "../../predicate.mjs";
import { registerStep } from "../../steps.mjs";
import { stepSize } from "./size.mjs";
import { worldActors, write } from "../shared/zord-crew-lookups.mjs";

/**
 * Round 16 (part a): a size change that lasts a while - the stored size (system.size, which the token follows) is
 * written, the size before kept, and put back once the change runs out. Scarefying Appearance (one step up for 10
 * rounds), Massive Mug of Mammoth Measurements / Petite Pony's Shrink Drink (huge / small for the scene).
 *
 *   Step `sizeChange {key, steps? | set?, until? | rounds?, to?}`
 *     Each recipient (default the actor) gets the change under `key`: `steps` along the full size ladder (clamped at
 *     the ends; an unknown size stays) or `set` to that size. One change per key at a time - while one is live the
 *     step leaves it alone; one that has run out but not been put back yet is put back first. Lasts `until` (any rule
 *     duration - "scene"), or `rounds: N`: N combat rounds from now (the same point in the turn order), ending with the
 *     combat it counts in; out of combat it lasts the encounter (the Scene Clock window).
 *   Tags `self:sizeChanged:<key>` / `target:sizeChanged:<key>` - that change is live.
 *   Putting back: the active GM's client, when a combat's turn or round changes (its combatants), when a combat ends
 *   (the changes counting its rounds end with it) and when a new scene starts (every world actor and the unlinked token
 *   actors of every scene). Kept at flags.essence20.ruleSizeChanges.<key> = {original, until, stamp} or
 *   {original, rounds: {epoch, combatId?, untilRound, untilTurn}}.
 */

const FLAG = 'ruleSizeChanges';

const recordOf = (actor, key) => actor?.flags?.essence20?.[FLAG]?.[key] ?? null;

/** Whether a kept change has run out (combat: the game's current combat, or the one it counts in). */
export function sizeChangeExpired(record, combat = globalThis.game?.combat) {
  if (!record) {
    return true;
  }

  if (record.rounds) {
    const window = record.rounds;
    if (window.epoch != epochFor('encounter')) {
      return true;
    }

    if (!window.combatId) {
      return false;
    }

    const combats = globalThis.game?.combats;
    const running = combats?.get?.(window.combatId) ?? (combat?.id == window.combatId ? combat : null);
    if (!running) {
      return true;
    }

    const round = Number(running.round) || 0;
    const turn = Number(running.turn) || 0;
    return !(round < window.untilRound || (round == window.untilRound && turn < window.untilTurn));
  }

  return isExpired({ until: record.until, stamp: record.stamp }, combat);
}

/** Whether the actor's change under `key` is live. */
export function sizeChangeLive(actor, key) {
  const record = recordOf(actor, key);
  return !!record && !sizeChangeExpired(record);
}

/** Put a change back: the size before, and the record gone. */
export async function restoreSizeChange(actor, key) {
  const record = recordOf(actor, key);
  if (!record) {
    return;
  }

  await write(actor, 'update', [{ 'system.size': record.original, [`flags.essence20.${FLAG}.-=${key}`]: null }]);
}

function roundsWindow(rounds, combat = globalThis.game?.combat) {
  const window = { epoch: epochFor('encounter') };
  if (combat?.id && rounds > 0) {
    window.combatId = combat.id;
    window.untilRound = Math.max(Number(combat.round) || 0, 1) + rounds;
    window.untilTurn = Number(combat.turn) || 0;
  }

  return window;
}

registerStep('sizeChange', async (step, ctx) => {
  const { recipients } = await import("../../steps.mjs");
  for (const actor of recipients({ to: 'self', ...step }, ctx)) {
    const size = actor?.system?.size;
    if (!size) {
      continue;
    }

    const kept = recordOf(actor, step.key);
    if (kept && !sizeChangeExpired(kept)) {
      continue;
    }

    if (kept) {
      await restoreSizeChange(actor, step.key);
    }

    const original = actor.system.size;
    const next = step.set ?? stepSize(original, Math.round(Number(step.steps) || 0));
    const record = step.rounds !== undefined
      ? { original, rounds: roundsWindow(Math.round(Number(step.rounds) || 0)) }
      : { original, until: step.until ?? 'scene', stamp: stampFor(step.until ?? 'scene', undefined, actor) };
    await write(actor, 'update', [{ [`flags.essence20.${FLAG}.${step.key}`]: record, ...(next != original ? { 'system.size': next } : {}) }]);
  }
}, {
  errors: (step, where) => [
    ...(step.key ? [] : [`${where}: sizeChange needs key`]),
    ...(step.steps === undefined && !step.set ? [`${where}: sizeChange needs steps or set`] : []),
    ...(step.until !== undefined && !isValidUntil(step.until) ? [`${where}: sizeChange until "${step.until}" isn't a duration`] : []),
    ...(step.until !== undefined && step.rounds !== undefined ? [`${where}: sizeChange takes until or rounds, not both`] : []),
  ],
});

registerTag('self:sizeChanged', (rest, ctx) => (ctx.self ? sizeChangeLive(ctx.self, rest) : null));
registerTag('target:sizeChanged', (rest, ctx) => (ctx.other ? sizeChangeLive(ctx.other, rest) : false));

/** Every actor a timed size change could sit on: the world's actors and every scene's unlinked token actors. */
export function sizeChangeCandidates() {
  const actors = [...worldActors()];
  for (const scene of globalThis.game?.scenes ?? []) {
    for (const token of scene.tokens ?? []) {
      if (!token.actorLink && token.actor) {
        actors.push(token.actor);
      }
    }
  }

  return actors;
}

/**
 * Put back every change that has run out (and, with endedCombatId, every one counting that combat's rounds). Active GM
 * only, so nothing is written twice.
 * @param {Array<Actor>} [actors]
 * @param {String} [endedCombatId]
 */
export async function expireSizeChanges(actors = null, endedCombatId = null) {
  if (!globalThis.game?.users?.activeGM?.isSelf) {
    return;
  }

  for (const actor of actors ?? sizeChangeCandidates()) {
    for (const [key, record] of Object.entries(actor?.flags?.essence20?.[FLAG] ?? {})) {
      const endedWithCombat = !!endedCombatId && record?.rounds?.combatId == endedCombatId;
      if (endedWithCombat || sizeChangeExpired(record)) {
        await restoreSizeChange(actor, key);
      }
    }
  }
}

const combatActors = combat => [...(combat?.combatants ?? [])].map(combatant => combatant.actor).filter(Boolean);

globalThis.Hooks?.on?.('updateCombat', (combat, changes) => {
  if (changes && ('round' in changes || 'turn' in changes)) {
    expireSizeChanges(combatActors(combat));
  }
});
globalThis.Hooks?.on?.('deleteCombat', combat => expireSizeChanges(combatActors(combat), combat?.id));
globalThis.Hooks?.on?.('essence20.sceneAdvanced', () => expireSizeChanges());
