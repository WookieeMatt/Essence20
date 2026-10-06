/**
 * Transformers (TF CRB) - Cover blasts: the Cover Grenade and every "Cover" weapon effect.
 */
import { registerApplyDialog, registerChatButton } from "../../mechanics/item-hooks.mjs";
import { T } from "../shared/item-lang.mjs";
import { escapeHtml as escape } from "../shared/chat-lines.mjs";
import { num } from "../shared/numbers.mjs";
import { writeDocResult as writeActor } from "../shared/relayed-writes.mjs";

/*
 * Cover Grenade (TF CRB p.124) and every "Cover" effect: "Cover: A nonlethal blast that fills an
 * area with a smoke or other effect that blocks the senses, granting creatures behind the blast area
 * [Cover] for the listed number of turns." Throwing one posts a card; its button gives the Cover
 * Condition, for that many rounds, to the tokens the clicking user has targeted (or selected).
 */
registerApplyDialog(async (actor, options, ctx) => {
  const item = ctx?.item;
  if (item?.type != 'weaponEffect' || item.system?.damageType != 'cover') {
    return;
  }

  const rounds = Math.max(1, num(item.system.damageValue));
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p>${T('O3CoverBlast', { name: escape(item.name), rounds })}</p>`
      + `<button type="button" data-e20-ext="o3CoverBlast" data-rounds="${rounds}">${T('O3CoverBlastApply')}</button>`,
  });
});

registerChatButton('o3CoverBlast', async (message, button) => {
  const rounds = Math.max(1, num(button.dataset.rounds));
  const tokens = game.user?.targets?.size ? [...game.user.targets] : (canvas?.tokens?.controlled ?? []);
  const { applyTimedCondition } = await import("../../mechanics/combat/timed-status.mjs");
  for (const token of tokens) {
    const target = token?.actor;
    if (!target) {
      continue;
    }

    if (target.isOwner) {
      await applyTimedCondition(target, 'cover', rounds);
    } else {
      await writeActor(target, 'toggleStatusEffect', ['cover', { active: true }]);
    }
  }
});

// (Overcharge Engines, the TF CRB Scientist Perk, is its own rules: two Use rules (twice a turn with
// Multiplication), an open Technology roll marking the feet, Movement rules adding them, a
// MovementAction ignoring Rough Terrain and a turnEnd Trigger clearing the mark.)
