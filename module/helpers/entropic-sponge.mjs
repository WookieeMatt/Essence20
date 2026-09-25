import { getNearbyEnemyTokens } from "./enemies.mjs";

/**
 * Entropic Sponge (Finster's Monster-Magic Cookbook, Path of Frost, 13th level, p.291): "You gain
 * Edge on Initiative Skill Tests. Additionally, at the start of a combat scene, you can spend 1
 * Personal Power per enemy to impose Snag on each their Initiative Skill Tests and gain ↑1 to your
 * Initiative Skill Test per Personal Power spent (to a maximum of +3d6)." The Edge half is already
 * a compendium Active Effect (system.skills.initiative.edge) - only the Personal Power-spend half
 * is built here.
 *
 * Same "Anytime after Initiative order is determined, spend a resource to adjust your own already-
 * rolled Combatant#initiative" shape as helpers/boost-initiative.mjs, since by the time a player
 * can react to seeing the order (and choose how many enemies to spend on), Initiative has already
 * been auto-rolled for everyone (documents/combat.mjs calls prepareInitiativeRoll for every
 * combatant as combat starts, with no manual pre-roll step to hook a spend onto) - so this reads
 * back as a direct post-roll adjustment to Combatant#initiative rather than a dataset shiftUp/snag
 * feeding into the roll itself. Boost Initiative's own "+2 per Power" ratio is reused here for
 * BOTH halves (the caster's own gain and each Snagged enemy's penalty), translating RAW's "↑1
 * shift"/Snag into the same flat initiative-score unit Boost Initiative already established a
 * precedent for. The RAW cap "(to a maximum of +3d6)" mixes a shift with a bonus-die notation that
 * doesn't parse against anything else on this Perk - most likely a page-layout/OCR artifact
 * bleeding in from an unrelated table column rather than a real clause - so it isn't enforced here
 * (an uncapped per-PP-spent scaling is the one unambiguous half of that sentence).
 */

/**
 * Prompts for how many enemies to spend Personal Power on (1 per enemy).
 * @param {Number} maxSpend   The most it's possible to spend (min of available Power and enemies present).
 * @returns {Promise<Number|null>}   null if cancelled or invalid.
 */
async function pickEntropicSpongeSpend(maxSpend) {
  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('E20.EntropicSpongePickSpendTitle') },
    classes: ["window-app", "e20-window"],
    content: `<div class="form-group"><label>${
      game.i18n.format('E20.EntropicSpongePickSpendLabel', { max: maxSpend })
    }</label><input type="number" name="spend" min="0" max="${maxSpend}" step="1" value="${maxSpend}" /></div>`,
    modal: true,
    buttons: [
      {
        label: game.i18n.localize('E20.DialogConfirmButton'),
        action: 'confirm',
        callback: (event, button) => button.form.elements.spend.value,
      },
      { label: game.i18n.localize('E20.DialogCancelButton'), action: 'cancel' },
    ],
  });

  if (!chosen || chosen == 'cancel') {
    return null;
  }

  const value = Math.trunc(Number(chosen));
  return Number.isFinite(value) && value > 0 ? Math.min(value, maxSpend) : null;
}

/**
 * @param {Actor} actor
 * @returns {Promise<Boolean>}   Whether anything was actually spent/adjusted.
 */
export async function activateEntropicSponge(actor) {
  if (!game.combat || game.combat.round != 1) {
    return false;
  }

  const combatant = game.combat.combatants.find(c => c.actor?.id == actor.id);
  if (!combatant || combatant.initiative == null) {
    return false;
  }

  const enemies = getNearbyEnemyTokens(actor, Infinity)
    .map(token => game.combat.combatants.find(c => c.actor?.id == token.actor?.id))
    .filter(enemyCombatant => enemyCombatant?.initiative != null);
  const maxSpend = Math.min(actor.system.powers?.personal?.value ?? 0, enemies.length);
  if (maxSpend <= 0) {
    return false;
  }

  const amountSpent = await pickEntropicSpongeSpend(maxSpend);
  if (!amountSpent) {
    return false;
  }

  await actor.update({ 'system.powers.personal.value': actor.system.powers.personal.value - amountSpent });
  await combatant.update({ initiative: combatant.initiative + (2 * amountSpent) });

  for (const enemyCombatant of enemies.slice(0, amountSpent)) {
    await enemyCombatant.update({ initiative: enemyCombatant.initiative - 2 });
  }

  return true;
}
