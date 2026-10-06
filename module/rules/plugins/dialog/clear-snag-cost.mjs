import { registerApplyDialog } from "../../../mechanics/item-hooks.mjs";
import { ruleDialogSwitches } from "../../adapter.mjs";
import { RULE_TYPES } from "../../types.mjs";

/**
 * DialogSwitch `clearSnagCost: free | move | standard` (round 15, uses) - ticked, and the roll has a Snag once the dialog
 * closes: that action is spent (in a combat; free outside one) and, when it could be, the Snag goes. With no Snag nothing is
 * paid. (Steady Hand: "when you would suffer Snag on an attack with an Adept Armament, you can spend a Free Action to roll
 * your Skill Test without Snag.") Give the switch a `key` (or another effect) so it validates.
 */

if (RULE_TYPES.DialogSwitch) {
  RULE_TYPES.DialogSwitch.params.clearSnagCost ??= { kind: 'enum', options: ['free', 'move', 'standard'] };
}

export async function applyClearSnagCost(actor, options, ctx = {}) {
  if (!options?.snag) {
    return;
  }

  const ticked = options.ext ?? {};
  const entry = ruleDialogSwitches(actor, ctx).find(({ name, entry: e }) => e?.rule?.clearSnagCost && ticked[name]);
  if (!entry) {
    return;
  }

  if (globalThis.game?.combat) {
    const { spend } = await import("../../../mechanics/actions/action-economy.mjs");
    const paid = await spend(actor, entry.entry.rule.clearSnagCost, { source: entry.label });
    if (paid?.blocked) {
      return;
    }
  }

  options.snag = false;
}

registerApplyDialog(applyClearSnagCost);
