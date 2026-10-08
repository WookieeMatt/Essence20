import { recipients, registerStep } from "../../steps.mjs";
import { write } from "../shared/zord-crew-lookups.mjs";

/**
 * Round 16 (part a): step `keyedCount {flag, to?}` - one more on a counter the actor keeps per creature: for each
 * recipient (default the run's first target), flags.essence20.<flag>.<its uuid, dots as dashes> on the actor goes up by
 * 1. The `@targetKeyed.<path>` ref and the `target:keyedOnMe:` tag read it back (Analyze Target's analyzeTargetCounts,
 * read by Informed Accuracy, Target Breakdown and Anonymous). It never resets.
 */

registerStep('keyedCount', async (step, ctx) => {
  const actor = ctx.actor;
  if (!actor) {
    return false;
  }

  for (const other of recipients({ to: 'target', ...step }, ctx)) {
    if (!other?.uuid) {
      continue;
    }

    const key = other.uuid.replace(/\./g, '-');
    const counts = actor.flags?.essence20?.[step.flag] ?? {};
    const next = (Number(counts[key]) || 0) + 1;
    await write(actor, 'update', [{ [`flags.essence20.${step.flag}.${key}`]: next }]);
    // Seen at once by a second recipient in the same run.
    globalThis.foundry?.utils?.setProperty?.(actor, `flags.essence20.${step.flag}.${key}`, next);
  }
}, { errors: (step, where) => (/^[\w-]+$/.test(String(step.flag ?? '')) ? [] : [`${where}: keyedCount needs a flag (a plain name)`]) });
