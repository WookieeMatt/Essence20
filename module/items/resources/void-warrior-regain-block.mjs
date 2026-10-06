/**
 * Void Warrior (Across the Stars, Grid Power, p.73): "...for the remainder of the scene. While this
 * Grid Power is active, you cannot regain Personal Power." - regain is blocked in preUpdateActor,
 * and the Power ends with the scene (items/attacks/void-warrior.mjs sets the flag and never cleared it).
 */
import { registerSceneAdvanced } from "../../mechanics/item-hooks.mjs";
import { POWER, registerBeforePowerWrite } from "../../mechanics/resources/personal-power-spend.mjs";
import { setChanged } from "../shared/resource-team-lookups.mjs";
import { isActiveGm } from "../shared/hooks-and-clients.mjs";
import { T } from "../shared/item-lang.mjs";
import { num } from "../shared/numbers.mjs";
import { worldActors } from "../../mechanics/companions/companion-link.mjs";

const VOID_FLAG = 'voidWarriorActive';

// Void Warrior: no regaining Personal Power while it's active.
registerBeforePowerWrite((actor, changes, prev, next, userId) => {
  if (next !== undefined && num(next) > prev.power && actor.flags?.essence20?.[VOID_FLAG]) {
    setChanged(changes, POWER, prev.power);
    if (userId == game.user?.id) {
      ui.notifications?.info(T('ResVoidWarriorNoRegen', { name: actor.name }));
    }
  }
});

/* -------------------------------------------- */
/*  Void Warrior ends with the scene             */
/* -------------------------------------------- */

registerSceneAdvanced(async () => {
  if (!isActiveGm()) {
    return;
  }

  for (const actor of worldActors()) {
    if (actor.flags?.essence20?.[VOID_FLAG]) {
      await actor.unsetFlag('essence20', VOID_FLAG);
    }
  }
});
