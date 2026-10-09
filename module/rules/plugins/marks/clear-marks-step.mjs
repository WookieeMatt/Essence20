import { recipients, registerStep } from "../../steps.mjs";
import { write } from "../shared/chat-speaker-helpers.mjs";

/**
 * The clearMarks step (round 10, group D - docs/rules-batches/slD10.md).
 */

// clearMarks {key, to}: every mark under the key on the recipients - each setter's own copy too (perSetter).
registerStep('clearMarks', async (step, ctx) => {
  for (const actor of recipients(step, ctx)) {
    const names = Object.keys(actor.flags?.essence20?.ruleMarks ?? {}).filter(name => name == step.key || name.startsWith(`${step.key}--`));
    if (names.length) {
      await write(actor, 'update', [Object.fromEntries(names.map(name => [`flags.essence20.ruleMarks.${name}`, new foundry.data.operators.ForcedDeletion()]))]);
    }
  }
}, { errors: (step, where) => (step.key ? [] : [`${where}: clearMarks needs a key`]) });
