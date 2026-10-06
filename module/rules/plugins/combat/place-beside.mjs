// Rules-engine plug-ins, round 16 (part b - docs/rules-batches/slLeftB16.md). Registered on import; see
// module/rules/plugins/index.mjs.
import { recipients, registerStep } from "../../steps.mjs";

/**
 * Step `placeBeside {to?}` - each recipient's token (default the first target) is moved to the space just right of the
 * actor's token: x = the actor token's x + its width in grid squares, the same y (a token update, no movement rules or
 * animation choice - the GM's "move them adjacent", Try Me). Nothing happens off the canvas.
 */
registerStep('placeBeside', async (step, ctx) => {
  const mine = ctx.actor?.getActiveTokens?.()?.[0];
  if (!mine?.document) {
    return;
  }

  const size = Number(globalThis.canvas?.grid?.size) || 100;
  for (const other of recipients({ ...step, to: step.to ?? 'target' }, ctx)) {
    const token = other?.getActiveTokens?.()?.[0];
    if (token?.document?.update) {
      await token.document.update({ x: mine.document.x + (Number(mine.document.width) || 1) * size, y: mine.document.y });
    }
  }
});
