import { evaluate, registerTag } from "../../predicate.mjs";
import { listOf } from "../shared/chat-speaker-helpers.mjs";

/**
 * Three small tags (round 10, group D - docs/rules-batches/slD10.md): combat:roundIs:<n>, allOf:<tag>&<tag>... (an AND
 * inside an `any` list) and attackHands:<n>.
 */

// combat:roundIs:<n> - the running combat is in that round.
registerTag('combat:roundIs', rest => {
  const combat = globalThis.game?.combat;
  return combat?.started ? Number(combat.round) == Number(rest) : false;
}, { phrase: ['in round {raw}', 'except in round {raw}'] });

// allOf:<tag>&<tag>... - every one of the tags holds (an AND inside an `any` list).
registerTag('allOf', (rest, ctx) => {
  const answers = String(rest).split('&').filter(Boolean).map(tag => evaluate([tag], ctx));
  return answers.includes(false) ? false : answers.includes(null) ? null : answers.length > 0;
}, { family: 'roll', param: 'text', phrase: (arg, w) => [w.describe(arg.split('&').filter(Boolean)), `not all of these: ${w.describe(arg.split('&').filter(Boolean))}`] });

// attackHands:<n> - the rolled attack belongs to a weapon held in at least n hands (its derived hands, else its hands,
// else the attack's own).
registerTag('attackHands', (rest, ctx) => {
  const effect = ctx.item;
  if (effect?.type != 'weaponEffect') {
    return false;
  }

  const parentId = effect.flags?.essence20?.parentId;
  const owner = effect.parent ?? ctx.self;
  const weapon = parentId ? owner?.items?.get?.(parentId) ?? listOf(owner?.items).find(item => item.id == parentId) ?? null : null;
  const hands = Number(weapon?.system?.derivedHands ?? weapon?.system?.hands ?? effect.system?.numHands ?? 1);
  return !!weapon && hands >= Number(rest);
}, { family: 'roll', param: 'text', phrase: ['the weapon is held in at least {raw} hands', 'the weapon is held in fewer than {raw} hands'] });
