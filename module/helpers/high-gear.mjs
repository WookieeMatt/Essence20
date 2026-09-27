import { actorHasZordFeature } from "./zord-features.mjs";
import { getVehicleDriver } from "./combat.mjs";
import { getUsesThisScene, markUsedThisScene } from "./perks.mjs";

/**
 * High Gear (A Jump Through Time, Zord Feature, p.83, prerequisite Ground Movement 40ft+): "Once
 * per scene, while piloting your Zord, you may spend 1 Personal Power to double its Ground
 * Movement value for 2d2 turns. While this Movement boost is in effect, all Ranged Attacks
 * targeting the Zord suffer Snag. High Gear does not affect any Megaform containing your Zord."
 *
 * Modeled as a plain toggle flag, same idiom as helpers/warrior-mode.mjs's own identical shape
 * (spend a resource once on activation, no cost to end it). "2d2 turns" is approximated the same
 * way this project already accepts elsewhere for a short, hard-to-enforce duration (no per-turn
 * countdown bucket exists) - a manual re-toggle, left to the table. The Ground-doubling half is
 * consumed in documents/actor.mjs#_prepareMovement (same "ground *= 2" idiom Rush the Line already
 * establishes); the ranged-Snag-on-target half is consumed in dice.mjs's own target-status checks,
 * the same shape Ninja Powered: Shining Light already establishes. "Does not affect any Megaform" -
 * this system's own _prepareMegaformZordData reads each Zord's OWN system.movement.ground.base,
 * computed before this flag's doubling ever runs (see its own comment on ordering), so a Megaform's
 * aggregate is naturally unaffected without any extra exclusion needed.
 */
const HIGH_GEAR_ID = "Compendium.essence20.jump_through_time.Item.KlcZsUUo2jvZhqM3";
const HIGH_GEAR_FLAG = 'highGearActive';
const HIGH_GEAR_SCENE_FLAG = 'highGearUsedThisScene';
const HIGH_GEAR_COST = 1;

/**
 * @param {Actor} zordActor
 * @returns {Boolean}
 */
export function isHighGearActive(zordActor) {
  return !!zordActor?.getFlag?.('essence20', HIGH_GEAR_FLAG);
}

/**
 * Toggles High Gear on or off. Turning it on spends 1 of the Zord's current driver's own Personal
 * Power (refused with a warning if there's no driver seated, it can't be afforded, or the once-
 * per-scene use is already spent); turning it off costs nothing.
 * @param {Actor} zordActor
 */
export async function toggleHighGear(zordActor) {
  if (!zordActor || zordActor.type != 'zord' || !actorHasZordFeature(zordActor, HIGH_GEAR_ID)) {
    return;
  }

  if (isHighGearActive(zordActor)) {
    await zordActor.unsetFlag('essence20', HIGH_GEAR_FLAG);
    return;
  }

  if (getUsesThisScene(zordActor, HIGH_GEAR_SCENE_FLAG) > 0) {
    ui.notifications.warn(game.i18n.localize('E20.HighGearAlreadyUsed'));
    return;
  }

  const driver = getVehicleDriver(zordActor);
  if (!driver) {
    ui.notifications.warn(game.i18n.localize('E20.HighGearNoDriver'));
    return;
  }

  if ((driver.system.powers?.personal?.value ?? 0) < HIGH_GEAR_COST) {
    ui.notifications.warn(game.i18n.localize('E20.HighGearCannotAfford'));
    return;
  }

  await driver.update({
    'system.powers.personal.value': driver.system.powers.personal.value - HIGH_GEAR_COST,
  });
  await zordActor.setFlag('essence20', HIGH_GEAR_FLAG, true);
  await markUsedThisScene(zordActor, HIGH_GEAR_SCENE_FLAG);
}

export { HIGH_GEAR_ID };
