// Round 15 (items1): step pickGeneralPerk - Why Do I Know That?
import { registerStep } from "../../steps.mjs";

/**
 * `pickGeneralPerk {}` - choose any General Perk the actor doesn't already hold (by its book source) and grant it outright,
 * the way dropping it on the sheet does (items/gear/why-do-i-know-that.mjs#activateWhyDoIKnowThat: the compendium picker,
 * then sheet-handlers/perk-handler.mjs#grantPerkOutright - not tied to the rule's item). None left: a warning. A
 * cancelled pick stops the run. `@var.picked` is the granted Perk's uuid.
 */
registerStep('pickGeneralPerk', async (step, ctx) => {
  const { activateWhyDoIKnowThat } = await import("../../../items/gear/why-do-i-know-that.mjs");
  const uuid = await activateWhyDoIKnowThat(ctx.actor);
  // optional (round 16, part b - A Hint of Independence): nothing picked, the run goes on.
  if (!uuid) {
    return step.optional ? undefined : false;
  }

  ctx.vars.picked = uuid;
});
