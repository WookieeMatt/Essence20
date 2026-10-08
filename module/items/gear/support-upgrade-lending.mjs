import { getSceneEpoch } from "../../mechanics/resources/scene-clock.mjs";
import { sourceOf } from "../shared/item-lookups.mjs";

/**
 * GI Joe Core Rulebook: lending Upgrades (Support, Tech Support, Extended Support). (Delegate is its Perk's own Use rule;
 * two-weapon attacks, Bio-Tech Armor and the Armored Cabin / Drive-By vehicle traits are
 * items/attacks/two-light-weapons.mjs, items/defenses/two-armor-sets-warning.mjs and items/vehicles/armored-cabin.mjs.
 * The Laser Designator and Explosive Engineer's Hang-Up are item rules - rules/conv10-slC10.test.js; Frequency
 * Interference too - rules/conv10-slD10.test.js.)
 */
/* -------------------------------------------- */
/*  Support / Tech Support / Extended Support    */
/* -------------------------------------------- */

/**
 * Support (GI Joe CRB, Technician, 2nd level, p.103): a Free action lends an adjacent ally one of the
 * Technician's Upgrades until their next turn. Tech Support (9th level): any ally in Primary Tech
 * range. Extended Support (14th level, p.104): as a Move action instead, it lasts the scene.
 *
 * The ally gets a temporary copy of the Upgrade (items/attacks/weapon-perk-uses.mjs sweeps it when its
 * time is up): an armor Upgrade counts loose, a weapon Upgrade goes on the weapon they pick. The Uses are the Perks'
 * own rules (the lendItem step - rules/plugins/picks/lend-item.mjs); these are the stamp and the copy it makes.
 */
export function lendStamp(scene) {
  const combat = game?.combat;
  if (scene || !combat) {
    return { kind: 'scene', scene: getSceneEpoch() };
  }

  // "until the start of your next turn": weapon-perk-uses.mjs#isExpired ends 'nextTurn' after turn
  // index `turn` of the next round, so one index earlier is the start of the lender's turn.
  return { kind: 'nextTurn', combatId: combat.id, round: combat.round, turn: combat.turn - 1, scene: getSceneEpoch() };
}

export function lentCopy(upgrade, stamp, lender, weaponId = null) {
  const data = upgrade.toObject();
  delete data._id;
  const flags = data.flags ?? (data.flags = {});
  flags.core = { ...(flags.core ?? {}), sourceId: sourceOf(upgrade) ?? flags.core?.sourceId };
  flags.essence20 = { ...(flags.essence20 ?? {}), temporary: stamp, o2LentFrom: lender.name };
  delete flags.essence20.parentId;
  delete flags.essence20.collectionId;
  if (weaponId) {
    flags.essence20.parentId = weaponId;
  } else if (upgrade.system?.type == 'armor') {
    // documents/actor.mjs counts a loose armor Upgrade flagged as worn "whether you're wearing armor or not".
    flags.essence20.alterationWorn = true;
  }

  return data;
}
