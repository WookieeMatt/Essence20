import { registerRef } from "../../formula.mjs";
import { registerStep } from "../../steps.mjs";

/**
 * Weapons attacked with this turn (round 15, uses) - the `{combatId, round, turn, weapons}` record the hand-written Flurry
 * of Attacks kept at flags.essence20.<flag>:
 *   - Step `recordTurnWeapon {flag}` - in an afterRoll Trigger: the rolled attack's weapon (@var.itemUuid) is added to the
 *     record for the running combat's current turn (a new turn starts a new list). Nothing outside a combat.
 *   - Ref `@turnWeapons.<flag>` - how many OTHER weapons than the rolled attack's (a roll modifier's @rolled) are on this
 *     turn's record; 0 outside a combat or on another turn.
 */

function record(actor, flag) {
  const stamp = actor?.flags?.essence20?.[flag];
  const combat = globalThis.game?.combat;
  return stamp && combat && stamp.combatId == combat.id && stamp.round == combat.round && stamp.turn == combat.turn ? stamp.weapons ?? [] : [];
}

registerStep('recordTurnWeapon', async (step, ctx) => {
  const combat = globalThis.game?.combat;
  const rolled = ctx.vars?.itemUuid ? globalThis.fromUuidSync?.(ctx.vars.itemUuid, { strict: false }) : null;
  const weaponId = rolled?.flags?.essence20?.parentId;
  const flag = String(step.flag ?? '');
  if (!combat || !weaponId || !flag) {
    return;
  }

  const list = record(ctx.actor, flag);
  if (!list.includes(weaponId)) {
    await ctx.actor.setFlag('essence20', flag, { combatId: combat.id, round: combat.round, turn: combat.turn, weapons: [...list, weaponId] });
  }
}, { errors: (step, where) => (/^[\w-]+$/.test(String(step.flag ?? '')) ? [] : [`${where}: recordTurnWeapon needs a flag name`]) });

registerRef('turnWeapons', (key, scope) => {
  const own = scope.rolled?.flags?.essence20?.parentId ?? null;
  return record(scope.actor, key).filter(id => id != own).length;
});
