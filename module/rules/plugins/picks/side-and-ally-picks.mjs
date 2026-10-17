import { registerPickSource, registerStep } from "../../steps.mjs";
import { escape, listOf, sameSide, worldActors } from "../shared/chat-speaker-helpers.mjs";
import { stepAmount as amount } from "../shared/step-amount.mjs";

/**
 * Picking from this actor's side (round 10, group D - docs/rules-batches/slD10.md): the sideActors pick source and the
 * checkAllies step (tick allies in range - they become the targets).
 */

// pick from: sideActors - this actor's side (the running combat's combatants, else every world actor), not the first
// target; inCombat / notSelf narrow it.
registerPickSource('sideActors', (step, ctx) => {
  const combat = globalThis.game?.combat;
  const pool = combat ? listOf(combat.combatants).map(c => c.actor).filter(Boolean) : worldActors();
  const target = ctx.targets[0];
  return [...new Set(pool)].filter(other => sameSide(other, ctx.actor) && other !== target && !(step.notSelf && other === ctx.actor))
    .map(other => ({ value: other.uuid, label: other.name }));
});

/** Tick allies (within `within` feet, not the actor) in one dialog: the chosen ones. */
async function askAllies(step, candidates, ctx) {
  if (ctx.askAllies) {
    return ctx.askAllies(step, candidates, ctx);
  }

  const { DialogV2 } = globalThis.foundry.applications.api;
  const chosen = await DialogV2.wait({
    window: { title: ctx.item?.name ?? '' },
    classes: ['window-app', 'e20-window'],
    content: `<p>${escape((step.prompt ?? '').replace(/\{target\}/g, ctx.targets[0]?.name ?? ''))}</p>`
      + candidates.map(ally => `<div class="form-group"><label><input type="checkbox" name="${ally.id}" /> ${escape(ally.name)}</label></div>`).join(''),
    buttons: [
      { action: 'ok', label: globalThis.game.i18n.localize('E20.DialogConfirmButton'), default: true, callback: (event, button) => candidates.filter(ally => button.form.elements[ally.id]?.checked) },
      { action: 'cancel', label: globalThis.game.i18n.localize('E20.DialogCancelButton') },
    ],
    rejectClose: false,
  });
  return Array.isArray(chosen) ? chosen : [];
}

// checkAllies {within, prompt?}: tick any of the allies within range (mechanics/combat/nearby-allies.mjs, not the actor) - they become
// the targets. None ticked (or none in range) stops the run.
registerStep('checkAllies', async (step, ctx) => {
  const { getNearbyAllyTokens } = await import("../../../mechanics/combat/nearby-allies.mjs");
  const within = step.within === undefined ? Infinity : amount(step.within, ctx, 0);
  const candidates = [...new Set(getNearbyAllyTokens(ctx.actor, within).map(token => token.actor).filter(ally => ally && ally.id != ctx.actor?.id))];
  if (!candidates.length) {
    return false;
  }

  const chosen = await askAllies(step, candidates, ctx);
  if (!chosen.length) {
    return false;
  }

  ctx.targets = chosen;
});
