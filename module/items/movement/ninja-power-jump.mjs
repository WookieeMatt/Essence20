import {
  registerRollSources, registerUse,
} from "../../mechanics/item-hooks.mjs";
import { IDS } from "../shared/pr-crb-ttsg-item-ids.mjs";
import { TSafe as T } from "../shared/item-lang.mjs";
import { escapeMarkup as escapeHtml } from "../shared/chat-lines.mjs";
import { isItem } from "../shared/item-lookups.mjs";
import { isThisRound, turnStamp } from "../shared/turn-stamps.mjs";

/**
 * Ninja Power (PR CRB, General Perk, p.97): "you may, as a Free action, jump up to 20 feet in any
 * direction. This jump does not modify your Movement for the round... Any attacks targeting you
 * this turn, after this jump, suffer ↓1." The Use button keeps the Perk's existing on/off switch
 * (items/attacks/ninja-power.mjs) and adds the jump while Ninja Power is active and you're Morphed; the
 * token is moved by hand. "This turn" is read as the rest of the round - an attack can only come
 * on someone else's turn.
 */
const NINJA_JUMP_FLAG = 'pr3NinjaJump';

registerUse({
  id: 'pr3NinjaPower',
  matches: item => isItem(item, IDS.ninjaPower),
  run: async (item, economy, pay) => {
    const actor = item.parent;
    const { isNinjaPowerActive, toggleNinjaPower } = await import("../attacks/ninja-power.mjs");
    let choice = 'toggle';
    if (isNinjaPowerActive(actor) && actor.system?.isMorphed) {
      const { chooseButtons } = await import("../../mechanics/resources/grants.mjs");
      choice = await chooseButtons(item.name, T('Pr3NinjaPrompt'), [['jump', T('Pr3NinjaJump')], ['toggle', T('Pr3NinjaOff')]]);
    }

    if (choice == 'jump') {
      if (!(await pay('free'))) {
        return null;
      }

      await actor.setFlag('essence20', NINJA_JUMP_FLAG, turnStamp() ?? { outOfCombat: true });
      return T('Pr3NinjaJumped', { name: escapeHtml(actor.name) });
    }

    if (choice != 'toggle') {
      return null;
    }

    const active = await toggleNinjaPower(actor);
    if (active === null) {
      ui.notifications.warn(game.i18n.localize('E20.PowerOverSpent'));
      return null;
    }

    return T(active ? 'Pr3NinjaOnLine' : 'Pr3NinjaOffLine', { name: escapeHtml(actor.name) });
  },
});

registerRollSources((actor, target, ctx) => {
  if (!target || !ctx?.isAttack || !isThisRound(target.flags?.essence20?.[NINJA_JUMP_FLAG])) {
    return {};
  }

  return { sources: [{ id: 'pr3NinjaJump', label: T('Pr3NinjaJumpSource', { name: target.name }), shiftDown: 1 }] };
});
