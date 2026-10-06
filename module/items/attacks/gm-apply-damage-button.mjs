import { registerChatButton } from "../../mechanics/item-hooks.mjs";
import { T } from "../shared/item-lang.mjs";

/**
 * A shared chat button (data-e20-ext="o1ApplyDamage") that hands damage to whoever owns the target - the GM, or the
 * target's player. Posted by items whose damage lands on someone the roller can't write to (Dominate Nanomites,
 * items/magic/dominate-nanomites.mjs).
 */

registerChatButton('o1ApplyDamage', async (message, button) => {
  const target = await fromUuid(button.dataset.targetUuid);
  if (!target?.isOwner) {
    ui.notifications.warn(T('O1NotOwner'));
    return;
  }

  const { applyDamage } = await import("../../mechanics/combat/combat.mjs");
  await applyDamage(target, Number(button.dataset.amount) || 0, button.dataset.damageType);
  button.disabled = true;
});
