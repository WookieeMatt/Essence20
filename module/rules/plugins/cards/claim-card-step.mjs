import { registerStep } from "../../steps.mjs";
import { T, write } from "../shared/chat-speaker-helpers.mjs";

/**
 * The claimCard step (round 10, group D - docs/rules-batches/slD10.md); rules/buttons.mjs hands the card to the steps.
 */

// claimCard: in a button's steps - the actor pressing (each presser's own with runAs: clicker) may answer this card once;
// a second press by the same actor stops here. The claim is kept on the card (flags.essence20.ruleButton.claimed).
registerStep('claimCard', async (step, ctx) => {
  const message = ctx.buttonMessage;
  const uuid = ctx.actor?.uuid;
  if (!message || !uuid) {
    return false;
  }

  const claimed = message.flags?.essence20?.ruleButton?.claimed ?? [];
  if (claimed.includes(uuid)) {
    globalThis.ui?.notifications?.warn?.(T('AlreadyAnswered', { name: ctx.actor.name }));
    return false;
  }

  await write(message, 'update', [{ 'flags.essence20.ruleButton.claimed': [...claimed, uuid] }]);
});
