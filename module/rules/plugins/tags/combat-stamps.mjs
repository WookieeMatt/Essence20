// Rules-engine plug-ins, round 15 (banked - docs/rules-batches/slBanked15.md). Registered on import; see
// module/rules/plugins/index.mjs.
import { registerRef } from "../../formula.mjs";
import { registerTag } from "../../predicate.mjs";
import { recipients, registerStep } from "../../steps.mjs";

/**
 * Tag `self:stamped:<flag>[:round | :turn]` (target: too) - `flags.essence20.<flag>` holds the {combatId, round, turn}
 * stamp hand-written code leaves (mechanics/characters/perks.mjs#markUsedThisRound / the "did something this round"
 * flags) and it is the running combat's, this round (default) or this turn. No combat - false. The Quiet One's "an ally
 * acted noisily this round" (`combat:ally:target:stamped:quietOneNoisyActionThisRound`).
 */
export function stampedNow(actor, rest, combat = globalThis.game?.combat) {
  const [flag, window = 'round'] = String(rest ?? '').split(':');
  const stamp = actor?.flags?.essence20?.[flag] ?? actor?.getFlag?.('essence20', flag);
  if (!combat || !stamp || stamp.combatId != combat.id || stamp.round != combat.round) {
    return false;
  }

  return window == 'turn' ? stamp.turn == combat.turn : true;
}

registerTag('self:stamped', (rest, ctx) => stampedNow(ctx?.self, rest, ctx?.combat ?? globalThis.game?.combat), { phrase: ['{who} {is} marked {arg} this round', '{who} {isnt} marked {arg} this round'] });
registerTag('target:stamped', (rest, ctx) => (ctx?.other ? stampedNow(ctx.other, rest, ctx?.combat ?? globalThis.game?.combat) : null), { phrase: ['{who} {is} marked {arg} this round', '{who} {isnt} marked {arg} this round'] });

/** The combatant just above / below an actor in the running combat's turn order, with a rolled Initiative, or null. */
export function turnNeighbour(actor, direction, combat = globalThis.game?.combat) {
  const turns = Array.isArray(combat?.turns) ? combat.turns : [];
  const index = turns.findIndex(combatant => combatant?.actor && actor && (combatant.actor === actor || combatant.actor.id == actor.id));
  const neighbour = index < 0 ? null : turns[direction == 'up' ? index - 1 : index + 1];
  return neighbour && neighbour.initiative != null ? neighbour : null;
}

/** Tag `target:turnNeighbour:up | down` (self: too) - there's a combatant with a rolled Initiative just above / below. */
registerTag('target:turnNeighbour', (rest, ctx) => (ctx?.other ? !!turnNeighbour(ctx.other, rest, ctx?.combat ?? globalThis.game?.combat) : null), { phrase: arg => [`someone's Initiative is just ${arg == 'down' ? 'below' : 'above'} {poss}`, `nobody's Initiative is just ${arg == 'down' ? 'below' : 'above'} {poss}`] });
registerTag('self:turnNeighbour', (rest, ctx) => !!turnNeighbour(ctx?.self, rest, ctx?.combat ?? globalThis.game?.combat), { phrase: arg => [`someone's Initiative is just ${arg == 'down' ? 'below' : 'above'} yours`, `nobody's Initiative is just ${arg == 'down' ? 'below' : 'above'} yours`] });

/**
 * Ref `@turnOrder.up` / `@turnOrder.down` - the Initiative of the combatant just above / below in the turn order, of the
 * actor a step acts on (writeInitiative's recipient), else the run's first target, else the actor (0 when none). Work the
 * Numbers' "move one place": `writeInitiative {value: "@turnOrder.up + 0.01", exact: true}`.
 */
registerRef('turnOrder', (key, scope) => Number(turnNeighbour(scope.recipient ?? scope.other ?? scope.actor, key)?.initiative) || 0);

/**
 * Step `stamp {flag, to?}` - each recipient (default: the actor) gets `flags.essence20.<flag>` = {combatId, round, turn}
 * of the running combat (all null out of combat): the "did it this round" record hand-written readers keep and the
 * `stamped:` tag above reads.
 */
registerStep('stamp', async (step, ctx) => {
  const combat = globalThis.game?.combat ?? null;
  const record = { combatId: combat?.id ?? null, round: combat?.round ?? null, turn: combat?.turn ?? null };
  const { needsGmRelay, relayToGm } = await import("../../../mechanics/world/gm-relay.mjs");
  for (const actor of recipients({ ...step, to: step.to ?? 'self' }, ctx)) {
    const update = { [`flags.essence20.${step.flag}`]: record };
    await (needsGmRelay(actor) ? relayToGm(actor, 'update', [update]) : actor.update(update));
  }
}, { errors: (step, where) => (/^[A-Za-z][A-Za-z0-9_]*$/.test(String(step.flag ?? '')) ? [] : [`${where}: stamp needs a flag name`]) });
