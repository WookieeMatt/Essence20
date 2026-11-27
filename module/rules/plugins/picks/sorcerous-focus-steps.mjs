// Rules-engine plug-ins: a magical focus (Finster's Monster-Matic Cookbook, Building an Enchanted Item or Focus, p.274) -
// items/magic/sorcerous-focus.mjs. Registered on import; see module/rules/plugins/index.mjs. Plain Node safe (the
// dialogs are loaded lazily).
//
// Named *SorcerousFocus so none of them is ever mistaken for the `focus` step (a Role Focus pick,
// pick-and-loop-steps.mjs): a magical focus is a Sorcerous Power, never a `focus` Item.
import { registerStep } from "../../steps.mjs";
import { registerTag } from "../../predicate.mjs";
import { focusReady, isSorcerousFocus, readyFocus, useFocusFor } from "../../../items/magic/sorcerous-focus.mjs";

/**
 * Step `buildSorcerousFocus {}` - the Sorcery Perk's "Build an enchanted item or focus" Use: the builder dialog, then
 * the focus (a Sorcerous Power at its point cost), the Sorcerous trait on the weapon or armor it's built into, and the
 * attack or Power it grants. A cancelled dialog stops the run.
 */
registerStep('buildSorcerousFocus', async (step, ctx) => {
  if (!ctx.actor) {
    return false;
  }

  const { buildSorcerousFocus } = await import("../../../items/magic/sorcerous-focus.mjs");
  const line = await buildSorcerousFocus(ctx.actor);
  if (!line) {
    return false;
  }

  ctx.chat.push(line);
});

/**
 * Step `readySorcerousFocus {destroyed?}` - on the focus's own Use: back in hand (no longer lost, its weapon or armor
 * equipped again); destroyed: true also replaces a destroyed one.
 */
registerStep('readySorcerousFocus', async (step, ctx) => {
  if (!isSorcerousFocus(ctx.item)) {
    return false;
  }

  await readyFocus(ctx.item, { destroyed: !!step.destroyed });
});

/** Step `useSorcerousFocus {}` - after a Power that needs a focus is used: a one-use focus is spent. */
registerStep('useSorcerousFocus', async (step, ctx) => {
  const line = await useFocusFor(ctx.item);
  if (line) {
    ctx.chat.push(line);
  }
});

/**
 * `rule:sorcerousFocusReady` - the rule's item is a magical focus, or a Power that needs one, and that focus is wielded
 * or worn and neither lost nor destroyed. True for an item with no focus at all.
 */
registerTag('rule:sorcerousFocusReady', (rest, ctx) => (ctx?.ruleItem ? focusReady(ctx.ruleItem, ctx.ruleItem.parent ?? ctx.self) : null),
  { phrase: ['its magical focus is in hand', "its magical focus isn't in hand"] });
