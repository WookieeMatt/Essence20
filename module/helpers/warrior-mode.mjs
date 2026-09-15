import { actorHasZordFeature } from "./zord-features.mjs";
import { getVehicleDriver } from "./combat.mjs";

/**
 * Warrior Mode (PR CRB, Zord Feature, p.140): "The Zord can shift into a different fighting form
 * by spending 3 of its Ranger's Personal Power, changing from its animal, mythological, or other
 * shape into that of a gigantic humanoid fighting form. When it does so, it makes the following
 * adjustments: Now is considered a Towering Size combatant; Grants ↑2 to Initiative Skill Tests;
 * Melee attacks deal 1 additional damage while in Warrior Mode; Warrior Mode lasts until the Zord
 * is involved in a Combiner Megaform or is subject to Recall for Repairs."
 *
 * Modeled as a plain toggle flag, the same idiom helpers/combat-stance.mjs's own declare/check
 * functions already establish for a declared, flag-tracked state - simpler here since there's no
 * target to track, just on/off. Spending Personal Power only happens on activation (RAW gives no
 * cost to end it early) via the same check-then-spend shape helpers/wisdom-of-the-elders.mjs
 * already uses for its own Personal Power cost - spent from "its Ranger" (the Zord's current
 * driver, resolved via helpers/combat.mjs's own getVehicleDriver, the same pilot lookup Martial
 * Zord/Zero-G already use), NOT the Zord's own system.powers - a Zord actor has no such field at
 * all (confirmed against the real schema; only playerCharacter/npc/companion track Personal
 * Power), matching RAW's own wording that this is the Ranger's resource, not the Zord's. No
 * driver seated means no Ranger to spend from, so activation is refused the same way a missing-
 * Personal-Power refusal is.
 *
 * Consumed in dice.mjs: the ↑2 Initiative half folds into prepareInitiativeRoll's shiftUp sum
 * (same slot as Light Chassis's own upshift); the +1 melee damage half folds into the same
 * damageBonusSources pattern as Auxiliary Zord/Thunder Upgrade.
 *
 * Ending conditions: "Recall for Repairs" is cleared from helpers/vehicle-defeat.mjs's own
 * handleZordZeroHealthTransition (the exact moment a Zord's Health hits 0); "involved in a
 * Combiner Megaform" is cleared from sheet-handlers/drop-handler.mjs's onDropActor (the moment a
 * Zord is linked to a Megaform's system.actors). Neither of those files import this one back -
 * both call toggleWarriorMode's own clearWarriorMode export directly, avoiding a circular import.
 * There's no "leaves combat" hook anywhere in this codebase to enforce RAW's implicit "until the
 * fight's over" boundary - left as a manual re-toggle, the same gap Combat Stance's own identical
 * ending conditions already accept.
 *
 * Towering Size while active is NOT applied to system.size - Defenses/Movement/Health derivation
 * doesn't key off size anywhere in this codebase (confirmed against this session's own Health/
 * Defense/Movement unification audit), so RAW's Size bump has no mechanical hook to attach to
 * yet; left undone rather than writing to system.size and having nothing read it back out
 * correctly (e.g. the Combiner size-aggregation math in actor.mjs, which reads a component's
 * system.size for its own Duo/Trio/Gestalt sizing - stomping a Zord's real size here would
 * corrupt that unrelated calculation for as long as Warrior Mode stays active).
 */
const WARRIOR_MODE_ID = "Compendium.essence20.pr_crb.Item.RsrUlBazkPwpRfxi";
const WARRIOR_MODE_FLAG = 'warriorModeActive';
const WARRIOR_MODE_COST = 3;

/**
 * @param {Actor} actor
 * @returns {Boolean}
 */
export function isWarriorModeActive(actor) {
  return !!actor?.getFlag?.('essence20', WARRIOR_MODE_FLAG);
}

/**
 * Toggles Warrior Mode on or off. Turning it on spends 3 of the Zord's current driver's own
 * Personal Power (refused with a warning if there's no driver seated, or the driver can't afford
 * it); turning it off costs nothing, per RAW.
 * @param {Actor} actor
 */
export async function toggleWarriorMode(actor) {
  if (!actor || actor.type != 'zord' || !actorHasZordFeature(actor, WARRIOR_MODE_ID)) {
    return;
  }

  if (isWarriorModeActive(actor)) {
    await actor.unsetFlag('essence20', WARRIOR_MODE_FLAG);
    return;
  }

  const driver = getVehicleDriver(actor);
  if (!driver) {
    ui.notifications.warn(game.i18n.localize('E20.WarriorModeNoDriver'));
    return;
  }

  if ((driver.system.powers?.personal?.value ?? 0) < WARRIOR_MODE_COST) {
    ui.notifications.warn(game.i18n.localize('E20.WarriorModeCannotAfford'));
    return;
  }

  await driver.update({
    'system.powers.personal.value': driver.system.powers.personal.value - WARRIOR_MODE_COST,
  });
  await actor.setFlag('essence20', WARRIOR_MODE_FLAG, true);
}

/**
 * Clears Warrior Mode without the toggle's own Feature/type checks - called from the two ending-
 * condition hooks (Recall for Repairs, joining a Combiner), which already know they're looking at
 * a Zord and don't need to re-verify it holds the Feature to clear a flag that can only be set on
 * one in the first place.
 * @param {Actor} actor
 */
export async function clearWarriorMode(actor) {
  if (isWarriorModeActive(actor)) {
    await actor.unsetFlag('essence20', WARRIOR_MODE_FLAG);
  }
}

export { WARRIOR_MODE_ID };
