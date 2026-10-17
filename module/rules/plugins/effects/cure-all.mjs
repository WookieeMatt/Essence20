import { recipients, registerStep } from "../../steps.mjs";
import { write } from "../shared/chat-speaker-helpers.mjs";

/**
 * Step `cureAll {to}` (round 15, dice part): each recipient goes back to full Health and loses every status it carries,
 * Defeated included (Panacea's successful cast - the work items/magic/panacea.mjs#applyPanaceaHeal did).
 */

registerStep('cureAll', async (step, ctx) => {
  for (const actor of recipients(step, ctx)) {
    const health = actor.system?.health;
    if (health) {
      await write(actor, 'update', [{ 'system.health.value': health.max }]);
    }

    for (const status of [...(actor.statuses ?? [])]) {
      await write(actor, 'toggleStatusEffect', [status, { active: false }]);
    }

    await write(actor, 'toggleStatusEffect', ['defeated', { active: false }]);
  }
});
