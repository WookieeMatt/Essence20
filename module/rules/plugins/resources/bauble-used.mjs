import { registerEvent } from "../../types.mjs";

/**
 * The `baubleUsed` Trigger event (items/magic/magic-baubles.mjs): fired on the user after a Magic Bauble is used in any
 * form, the bauble as the roll item - so a bauble's own effect is
 * `{type: "Trigger", event: "baubleUsed", when: ["item:own"], steps: [...]}`. @var.succeeded is 1, or 0 when a scroll's
 * Spellcasting test (or an attack) failed - a potion or a talisman with no attack always works (MLP CRB p.141):
 * `when: ["item:own", "var:succeeded=1"]` for an effect that needs the cast to land.
 */
registerEvent('baubleUsed');

function targetsOf() {
  const targets = globalThis.game?.user?.targets;
  const tokens = targets?.[Symbol.iterator] ? [...targets] : [targets?.first?.()].filter(Boolean);
  return tokens.map(token => token?.actor).filter(Boolean);
}

/** Fire the bauble's baubleUsed Triggers for its user. */
export async function fireBaubleUsed(actor, bauble, succeeded = true) {
  if (!actor || !bauble) {
    return;
  }

  const { fireTriggers } = await import("../../triggers.mjs");
  await fireTriggers(actor, 'baubleUsed', { roll: { item: bauble }, targets: targetsOf(), vars: { succeeded: succeeded ? 1 : 0 } });
}
