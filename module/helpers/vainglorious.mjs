import { spend } from "./action-economy.mjs";

/**
 * Vainglorious (Transformers CRB, Hang-Up, p.43): "You are pompous and self-important, and your
 * reputation and good looks take precedence over being effective... On your first turn, after you
 * roll Initiative, you must spend your Standard action delivering a speech to your enemies or
 * preening and chest-thrusting."
 *
 * Modeled as an automatic Standard-action spend the moment the actor's first turn of THIS combat
 * starts (documents/combat.mjs#_onStartTurn, right after resetTurn() refills the turn) - "first
 * turn" is tracked per-combat rather than assumed to be round 1, so a Vainglorious character who
 * joins a fight already in progress still gets forced to preen on their own first turn rather than
 * being silently exempted. The flavor half (speech vs. preening) has nothing to automate; only the
 * Standard-action cost is a real budget effect.
 */
const VAINGLORIOUS_ID = "Compendium.essence20.tf_crb.Item.ztsvCKdnaDZzBR8Q";
const VAINGLORIOUS_FLAG = 'vainglorAlreadyActedThisCombat';

function hasVainglorious(actor) {
  return !!actor?.items?.find(item =>
    item.type == 'hangUp'
    && (item.flags?.core?.sourceId == VAINGLORIOUS_ID || item._stats?.compendiumSource == VAINGLORIOUS_ID),
  );
}

/**
 * Forces the Standard-action spend if this is the actor's first turn of the current combat and
 * they have Vainglorious. Safe to call every turn start - a no-op once already spent this combat,
 * or for anyone without the Hang-Up.
 * @param {Actor} actor
 * @returns {Promise<void>}
 */
export async function applyVainglorious(actor) {
  if (!actor || !game.combat || !hasVainglorious(actor)) {
    return;
  }

  if (actor.getFlag('essence20', VAINGLORIOUS_FLAG) === game.combat.id) {
    return;
  }

  await actor.setFlag('essence20', VAINGLORIOUS_FLAG, game.combat.id);
  await spend(actor, 'standard', { source: game.i18n.localize('E20.HangUpVainglorious') });
}
